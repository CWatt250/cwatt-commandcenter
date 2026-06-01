import { createClient } from '@/lib/supabase/server';
import { getGitHubConnection } from '@/lib/github';

// Reports whether GitHub is connected (and as whom) for the Settings page.
// Never returns the access token.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await getGitHubConnection();
  if (!conn) return Response.json({ connected: false });

  return Response.json({
    connected: true,
    login: conn.github_login,
    scope: conn.scope,
    connected_at: conn.connected_at,
  });
}
