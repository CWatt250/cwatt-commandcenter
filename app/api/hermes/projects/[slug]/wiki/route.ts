import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';
import { WIKI_CATEGORIES } from '@/types';
import type { WikiCategory } from '@/types';

// POST /api/hermes/projects/:slug/wiki
//
// An agent appends one memory entry to a project's wiki after completing a
// task. Append-only — every call adds a row, building the project's running
// memory. Service-role only, behind the Hermes key.

interface WikiBody {
  content?: string;
  category?: string;
  created_by?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { slug } = await params;

  let body: WikiBody;
  try {
    body = (await req.json()) as WikiBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }

  const category = body.category as WikiCategory | undefined;
  if (!category || !WIKI_CATEGORIES.includes(category)) {
    return Response.json(
      { error: `category must be one of ${WIKI_CATEGORIES.join(', ')}` },
      { status: 400 }
    );
  }

  const createdBy = body.created_by?.trim() || 'agent';

  const supabase = createServiceClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (projectError) {
    return Response.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: entry, error: insertError } = await supabase
    .from('project_wiki')
    .insert({
      project_id: project.id,
      content,
      category,
      created_by: createdBy,
    })
    .select()
    .single();

  if (insertError || !entry) {
    return Response.json(
      { error: insertError?.message ?? 'Failed to write wiki entry.' },
      { status: 500 }
    );
  }

  await supabase.from('activity_log').insert({
    project_id: project.id,
    actor: createdBy,
    action: 'wiki_updated',
    details: {
      category,
      preview: content.slice(0, 200),
    },
  });

  return Response.json({ entry }, { status: 201 });
}
