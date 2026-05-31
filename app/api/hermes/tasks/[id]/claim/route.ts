import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateHermesKey, hermesUnauthorized } from '@/lib/hermes';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateHermesKey(req)) return hermesUnauthorized();

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { agent?: string };
  const agent = body.agent;

  if (!agent || typeof agent !== 'string') {
    return Response.json(
      { success: false, error: 'agent is required' },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Atomic claim — only updates if not already claimed and status is brief_ready
  const { data, error } = await supabase
    .from('tasks')
    .update({
      claimed_by: agent,
      claimed_at: new Date().toISOString(),
      status: 'in_progress',
    })
    .eq('id', id)
    .is('claimed_by', null)
    .eq('status', 'brief_ready')
    .select()
    .maybeSingle();

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json(
      { success: false, error: 'Task already claimed or not in brief_ready' },
      { status: 409 }
    );
  }

  await supabase.from('activity_log').insert({
    project_id: data.project_id,
    task_id: data.id,
    actor: agent,
    action: 'task_claimed',
    details: { agent },
  });

  return Response.json({ success: true, task: data });
}
