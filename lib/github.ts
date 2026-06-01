import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// `repo` lets us read PR status on private repos; `read:user` lets us label the
// connection with the GitHub login.
export const GITHUB_OAUTH_SCOPES = 'repo read:user';

const GITHUB_API = 'https://api.github.com';

export interface GitHubConnectionRow {
  id: number;
  github_login: string | null;
  github_user_id: number | null;
  access_token: string;
  scope: string | null;
  token_type: string | null;
  connected_at: string;
}

/** Reads the single OAuth connection row via the service role (RLS-exempt). */
export async function getGitHubConnection(): Promise<GitHubConnectionRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('github_connection')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return (data as GitHubConnectionRow | null) ?? null;
}

export async function getGitHubToken(): Promise<string | null> {
  const conn = await getGitHubConnection();
  return conn?.access_token ?? null;
}

/** Authenticated (or anonymous, if token is null) request to the GitHub REST API. */
export function githubApi(
  path: string,
  token: string | null,
  init?: RequestInit & { next?: { revalidate?: number } }
) {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cwatt-commandcenter',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

/** Verifies a GitHub webhook `X-Hub-Signature-256` header against the raw body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!signature || !secret) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Parses `https://github.com/owner/repo/pull/123` → { owner, repo, number }. */
export function parsePrUrl(
  url: string
): { owner: string; repo: string; number: number } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: Number(m[3]) };
  } catch {
    return null;
  }
}

/** Parses a repo URL `https://github.com/owner/repo(.git)` → { owner, repo }. */
export function parseOwnerRepoFromUrl(
  url: string
): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
    const parts = u.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}
