import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';
import { wikiToMarkdown } from '@/lib/wiki';
import type { ProjectWiki } from '@/types';

// GET /api/hermes/projects/:slug/context
//
// The pre-task context an agent (Nexus / Claude Code worker) pulls before it
// starts any work on a project: the full project wiki, the last 5 completed
// tasks, and the currently-open PRs. Service-role only, behind the Hermes key.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug, name, description, repo_url, repo_name')
    .eq('slug', slug)
    .maybeSingle();

  if (projectError) {
    return Response.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  // Pull wiki, recent completions, and open PRs together.
  const [wikiRes, recentRes, prsRes] = await Promise.all([
    supabase
      .from('project_wiki')
      .select('id, content, category, created_by, created_at')
      .eq('project_id', project.id)
      .order('category', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id, title, brief, branch_name, pr_url, pr_number, completed_at')
      .eq('project_id', project.id)
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(5),
    supabase
      .from('tasks')
      .select('id, title, branch_name, pr_url, pr_number, claimed_by, updated_at')
      .eq('project_id', project.id)
      .eq('status', 'pr_review')
      .not('pr_url', 'is', null)
      .order('updated_at', { ascending: false }),
  ]);

  const firstError = wikiRes.error ?? recentRes.error ?? prsRes.error;
  if (firstError) {
    return Response.json({ error: firstError.message }, { status: 500 });
  }

  const wiki = (wikiRes.data ?? []) as Pick<
    ProjectWiki,
    'id' | 'content' | 'category' | 'created_by' | 'created_at'
  >[];

  return Response.json({
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      repo_url: project.repo_url,
      repo_name: project.repo_name,
    },
    wiki: {
      count: wiki.length,
      entries: wiki,
      // Pre-rendered digest so agents can drop it straight into a prompt.
      markdown: wikiToMarkdown(wiki),
    },
    recent_tasks: recentRes.data ?? [],
    open_prs: prsRes.data ?? [],
  });
}
