import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { githubApi } from '@/lib/github';

// GitHub redirects the browser back here with `code` + `state`. We verify the
// CSRF state, exchange the code for an access token, persist it (service role),
// and bounce back to Settings. This route is bypassed by the auth proxy.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(`${appUrl}/settings?github=error&reason=${reason}`);

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('github_oauth_state')?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('state');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('config');

  // Exchange the authorization code for an access token.
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${appUrl}/api/github/oauth/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    token_type?: string;
  };
  if (!tokenJson.access_token) return fail('token');

  // Look up the authenticated GitHub user to label the connection.
  let login: string | null = null;
  let userId: number | null = null;
  try {
    const userRes = await githubApi('/user', tokenJson.access_token);
    if (userRes.ok) {
      const user = (await userRes.json()) as { login?: string; id?: number };
      login = user.login ?? null;
      userId = user.id ?? null;
    }
  } catch {
    // Non-fatal — we still store the token.
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('github_connection').upsert({
    id: 1,
    access_token: tokenJson.access_token,
    scope: tokenJson.scope ?? null,
    token_type: tokenJson.token_type ?? null,
    github_login: login,
    github_user_id: userId,
    connected_at: new Date().toISOString(),
  });
  if (error) return fail('store');

  const res = NextResponse.redirect(`${appUrl}/settings?github=connected`);
  res.cookies.delete('github_oauth_state');
  return res;
}
