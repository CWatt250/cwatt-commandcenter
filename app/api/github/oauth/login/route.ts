import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { GITHUB_OAUTH_SCOPES } from '@/lib/github';

// Kicks off the GitHub OAuth dance: sets a CSRF `state` cookie and redirects the
// browser to GitHub's authorize screen. Reached via the "Connect GitHub" button.
export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'GITHUB_CLIENT_ID is not configured.' },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', `${appUrl}/api/github/oauth/callback`);
  authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPES);
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
