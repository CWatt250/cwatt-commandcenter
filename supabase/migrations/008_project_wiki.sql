-- Migration 008 — Project Wiki (Phase 12: Agent Memory)
--
-- Persistent per-project memory. Agents (Nexus / Claude Code workers) read the
-- whole wiki before starting a task (GET /api/hermes/projects/:slug/context)
-- and append a summary after finishing one (POST /api/hermes/projects/:slug/wiki).
-- The Brief Builder also injects this wiki as context so Claude already knows the
-- codebase when drafting a brief.

create table if not exists project_wiki (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  content     text not null,
  category    text not null
    check (category in ('architecture', 'patterns', 'gotchas', 'decisions', 'stack', 'files')),
  created_by  text not null default 'agent',
  created_at  timestamptz not null default now()
);

-- Reading the full wiki for one project is the hot path (context endpoint +
-- per-project memory counts on /projects and the sidebar).
create index if not exists project_wiki_project_idx on project_wiki(project_id);
create index if not exists project_wiki_project_category_idx on project_wiki(project_id, category);

alter table project_wiki enable row level security;

-- Browser (authenticated single user) reads counts via the anon client; the
-- Hermes API routes use the service role, which bypasses RLS.
create policy "authenticated full access - project_wiki"
  on project_wiki for all
  to authenticated
  using (true)
  with check (true);
