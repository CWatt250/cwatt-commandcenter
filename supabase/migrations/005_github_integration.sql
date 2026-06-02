-- Migration 005 — GitHub Integration (Phase 10)

-- Store the repo's default branch alongside the other repo metadata so the
-- New Project modal can persist what it auto-fetched from the GitHub API.
alter table projects add column if not exists default_branch text;

-- Single-row table holding the GitHub OAuth connection for the one app user.
-- The access token is sensitive, so NO row-level-security policy is granted to
-- authenticated/anon clients — it is readable and writable ONLY through the
-- service role used by the server-side API routes. The browser never sees it.
create table if not exists github_connection (
  id             integer primary key default 1,
  github_login   text,
  github_user_id bigint,
  access_token   text not null,
  scope          text,
  token_type     text,
  connected_at   timestamptz not null default now(),
  constraint github_connection_singleton check (id = 1)
);

alter table github_connection enable row level security;
-- (Intentionally no policies — service role bypasses RLS, everyone else is denied.)
