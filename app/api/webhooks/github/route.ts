import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyWebhookSignature } from '@/lib/github';
import type { Task } from '@/types';

// GitHub webhook receiver. Verifies the HMAC signature, then on pull_request
// events keeps the board in sync:
//   • opened/reopened → attach pr_url + pr_number to the task matching the PR's
//     head branch, move it to PR Review.
//   • closed & merged → move the task matching pr_number to Done.
// No browser session here — the auth proxy bypasses /api/webhooks.
export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event');

  const raw = await req.text();
  if (!verifyWebhookSignature(raw, signature, secret)) {
    return Response.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  if (event === 'ping') return Response.json({ ok: true });
  if (event !== 'pull_request') return Response.json({ ignored: true });

  let payload: GitHubPrEvent;
  try {
    payload = JSON.parse(raw) as GitHubPrEvent;
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { action, pull_request: pr, repository } = payload;
  const repoName = repository?.name;
  if (!pr || !repoName) return Response.json({ ignored: true });

  const supabase = createServiceClient();

  // Find every project pointed at this repo (repo_name is the bare repo name,
  // which matches the webhook's repository.name).
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('repo_name', repoName);
  const projectIds = (projects ?? []).map((p) => p.id as string);
  if (projectIds.length === 0) {
    return Response.json({ ignored: true, reason: 'no matching project' });
  }

  if (action === 'opened' || action === 'reopened') {
    const branch = pr.head?.ref;
    if (!branch) return Response.json({ ignored: true, reason: 'no head ref' });

    const { data: rows } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds)
      .eq('branch_name', branch)
      .order('created_at', { ascending: false })
      .limit(1);
    const task = (rows?.[0] as Task | undefined) ?? null;
    if (!task) return Response.json({ ignored: true, reason: 'no matching task' });

    await supabase
      .from('tasks')
      .update({ pr_url: pr.html_url, pr_number: pr.number, status: 'pr_review' })
      .eq('id', task.id);

    await supabase.from('activity_log').insert({
      project_id: task.project_id,
      task_id: task.id,
      actor: 'github',
      action: 'pr_opened',
      details: { pr_url: pr.html_url, pr_number: pr.number, branch_name: branch },
    });

    return Response.json({ ok: true, task_id: task.id, status: 'pr_review' });
  }

  if (action === 'closed' && pr.merged) {
    const { data: rows } = await supabase
      .from('tasks')
      .select('*')
      .in('project_id', projectIds)
      .eq('pr_number', pr.number)
      .order('created_at', { ascending: false })
      .limit(1);
    const task = (rows?.[0] as Task | undefined) ?? null;
    if (!task) return Response.json({ ignored: true, reason: 'no matching task' });

    await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', task.id);

    await supabase.from('activity_log').insert({
      project_id: task.project_id,
      task_id: task.id,
      actor: 'github',
      action: 'pr_merged',
      details: { pr_url: pr.html_url, pr_number: pr.number },
    });

    return Response.json({ ok: true, task_id: task.id, status: 'done' });
  }

  return Response.json({ ignored: true, action });
}

interface GitHubPrEvent {
  action?: string;
  repository?: { name?: string; full_name?: string };
  pull_request?: {
    number: number;
    html_url: string;
    merged?: boolean;
    head?: { ref?: string };
  };
}
