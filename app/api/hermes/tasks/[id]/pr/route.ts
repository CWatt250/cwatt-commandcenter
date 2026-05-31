import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    agent?: string;
    pr_url?: string;
    pr_number?: number;
    branch_name?: string;
  };
  const { agent, pr_url, pr_number, branch_name } = body;

  if (!agent) {
    return Response.json({ error: 'agent is required' }, { status: 400 });
  }
  if (!pr_url || typeof pr_url !== 'string') {
    return Response.json({ error: 'pr_url is required' }, { status: 400 });
  }
  if (typeof pr_number !== 'number') {
    return Response.json({ error: 'pr_number must be a number' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const updates: Record<string, unknown> = {
    pr_url,
    pr_number,
    status: 'pr_review',
  };
  if (branch_name) updates.branch_name = branch_name;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Task not found' }, { status: 404 });

  await supabase.from('activity_log').insert({
    project_id: data.project_id,
    task_id: data.id,
    actor: agent,
    action: 'pr_opened',
    details: { pr_url, pr_number, branch_name },
  });

  return Response.json({ success: true, task: data });
}
