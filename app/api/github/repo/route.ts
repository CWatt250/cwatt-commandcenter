import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getGitHubToken,
  githubApi,
  parseOwnerRepoFromUrl,
} from '@/lib/github';

// Fetches repo metadata so the New Project modal can pre-fill name, description,
// and default branch. Uses the stored OAuth token when present (so private repos
// resolve), otherwise falls back to anonymous access for public repos.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return Response.json({ error: 'url is required.' }, { status: 400 });

  const parsed = parseOwnerRepoFromUrl(url);
  if (!parsed) {
    return Response.json({ error: 'Not a valid GitHub repo URL.' }, { status: 400 });
  }

  const token = await getGitHubToken();
  const res = await githubApi(
    `/repos/${parsed.owner}/${parsed.repo}`,
    token,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) {
    const status = res.status === 404 ? 404 : 502;
    return Response.json(
      {
        error:
          res.status === 404
            ? 'Repo not found or not accessible with the connected GitHub account.'
            : 'Failed to reach GitHub.',
      },
      { status }
    );
  }

  const repo = (await res.json()) as {
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    private: boolean;
  };

  return Response.json({
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    default_branch: repo.default_branch,
    private: repo.private,
  });
}
