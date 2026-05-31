-- Migration 002 — RLS Policies

alter table projects enable row level security;
alter table tasks enable row level security;

create policy "authenticated full access - projects"
  on projects for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated full access - tasks"
  on tasks for all
  to authenticated
  using (true)
  with check (true);

-- Service role bypasses RLS automatically — used by Hermes API routes.
