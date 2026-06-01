import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGitHubToken, githubApi, parsePrUrl } from '@/lib/github';
import type { PrState } from '@/types';

// Returns the live state (open / merged / closed) of a PR for the card badge.
// Auth-protected; cached at the edge for 60s to avoid hammering the GitHub API.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const prUrl = req.nextUrl.searchParams.get('pr_url');
  if (!prUrl) return Response.json({ error: 'pr_url is required.' }, { status: 400 });

  const parsed = parsePrUrl(prUrl);
  if (!parsed) return Response.json({ error: 'Invalid PR URL.' }, { status: 400 });

  const token = await getGitHubToken();
  if (!token) return Response.json({ connected: false });

  const res = await githubApi(
    `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
    token,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) {
    return Response.json({ connected: true, state: null, error: true });
  }

  const pr = (await res.json()) as { state: string; merged: boolean };
  const state: PrState = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';

  return Response.json({ connected: true, state });
}
