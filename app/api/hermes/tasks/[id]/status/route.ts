import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';
import { updateTaskByPrefix } from '@/lib/hermes-task';

const VALID_STATUSES = ['in_progress', 'pr_review', 'done'] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    agent?: string;
    status?: string;
    branch_name?: string;
  };
  const { agent, status, branch_name } = body;

  if (!agent) {
    return Response.json({ error: 'agent is required' }, { status: 400 });
  }
  if (!status || !VALID_STATUSES.includes(status as ValidStatus)) {
    return Response.json(
      { error: `status must be one of ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const updates: Record<string, unknown> = { status };
  if (branch_name) updates.branch_name = branch_name;
  if (status === 'done') updates.completed_at = new Date().toISOString();

  const { data, error } = await updateTaskByPrefix(id, updates, { claimed_by: agent });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: 'Task not found' }, { status: 404 });

  await supabase.from('activity_log').insert({
    project_id: data.project_id,
    task_id: data.id,
    actor: agent,
    action: 'status_updated',
    details: { status, branch_name },
  });

  return Response.json({ success: true, task: data });
}
