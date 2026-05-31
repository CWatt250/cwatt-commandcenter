import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';

export async function GET(req: NextRequest) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const url = new URL(req.url);
  const projectSlug = url.searchParams.get('project');
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 100);

  const supabase = createServiceClient();

  let query = supabase
    .from('tasks')
    .select(
      `id, project_id, title, brief, priority, tags, status, claimed_by, created_at,
       project:projects!inner ( id, slug, name, repo_url, repo_name )`
    )
    .eq('status', 'brief_ready')
    .is('claimed_by', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (projectSlug) {
    query = query.eq('project.slug', projectSlug);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    project_id: string;
    title: string;
    brief: string | null;
    priority: string;
    tags: string[] | null;
    created_at: string;
    project: {
      slug: string;
      name: string;
      repo_url: string | null;
      repo_name: string | null;
    } | null;
  };

  const tasks = (data as unknown as Row[]).map((t) => ({
    id: t.id,
    project_id: t.project_id,
    project_slug: t.project?.slug ?? null,
    project_name: t.project?.name ?? null,
    repo_url: t.project?.repo_url ?? null,
    repo_name: t.project?.repo_name ?? null,
    title: t.title,
    brief: t.brief,
    priority: t.priority,
    tags: t.tags ?? [],
    created_at: t.created_at,
  }));

  return Response.json({ tasks, count: tasks.length });
}
