import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';
import { updateTaskByPrefix } from '@/lib/hermes-task';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    agent?: string;
    reason?: string;
  };
  const { agent, reason } = body;

  if (!agent) {
    return Response.json({ error: 'agent is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Only release if this agent currently holds the task.
  // Uses prefix-aware matching so short (8-char) task IDs still resolve.
  const { data, error } = await updateTaskByPrefix(
    id,
    { claimed_by: null, claimed_at: null, status: 'brief_ready' },
    { claimed_by: agent },
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) {
    return Response.json(
      { error: 'Task not held by this agent' },
      { status: 409 }
    );
  }

  await supabase.from('activity_log').insert({
    project_id: data.project_id,
    task_id: data.id,
    actor: agent,
    action: 'task_released',
    details: { reason: reason ?? null },
  });

  return Response.json({ success: true, task: data });
}
