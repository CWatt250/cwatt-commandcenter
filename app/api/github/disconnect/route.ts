import { createClient, createServiceClient } from '@/lib/supabase/server';

// Removes the stored OAuth connection. Auth-protected.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createServiceClient();
  const { error } = await service.from('github_connection').delete().eq('id', 1);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ connected: false });
}
