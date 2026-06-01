import { createClient } from '@/lib/supabase/server';
import type { TaskPriority } from '@/types';

// Creates a board task from an approved brief. Protected by Supabase auth —
// the proxy middleware blocks unauthenticated requests, and we double-check the
// session here so the actor is real before writing.

const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

interface PushBody {
  title?: string;
  priority?: string;
  agent_preference?: string;
  tags?: string[];
  brief?: string;
  project_id?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: PushBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = body.title?.trim();
  const project_id = body.project_id;
  if (!title) {
    return Response.json({ error: 'title is required.' }, { status: 400 });
  }
  if (!project_id) {
    return Response.json({ error: 'project_id is required.' }, { status: 400 });
  }

  const priority: TaskPriority = VALID_PRIORITIES.includes(
    body.priority as TaskPriority
  )
    ? (body.priority as TaskPriority)
    : 'medium';

  // The tasks table has no agent column, so preserve a non-default agent
  // preference as a tag (e.g. `agent:claude-code`) and record it in the
  // activity details. `auto` is the default and not worth tagging.
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const agentPref = body.agent_preference?.trim();
  if (agentPref && agentPref !== 'auto' && !tags.includes(`agent:${agentPref}`)) {
    tags.push(`agent:${agentPref}`);
  }

  const { data: task, error: insertError } = await supabase
    .from('tasks')
    .insert({
      project_id,
      title,
      brief: body.brief?.trim() || null,
      priority,
      status: 'brief_ready',
      tags,
    })
    .select()
    .single();

  if (insertError || !task) {
    return Response.json(
      { error: insertError?.message ?? 'Failed to create task.' },
      { status: 500 }
    );
  }

  await supabase.from('activity_log').insert({
    project_id,
    task_id: task.id,
    actor: 'Colton',
    action: 'task_created',
    details: {
      title: task.title,
      priority: task.priority,
      source: 'brief_builder',
      agent_preference: agentPref ?? 'auto',
    },
  });

  return Response.json({ task_id: task.id, task });
}
