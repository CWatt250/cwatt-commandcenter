-- Migration 003 — Activity Log

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  task_id     uuid references tasks(id) on delete set null,
  actor       text not null,
  action      text not null,
  details     jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index activity_log_project_idx on activity_log(project_id);
create index activity_log_created_idx on activity_log(created_at desc);

alter table activity_log enable row level security;

create policy "authenticated full access - activity_log"
  on activity_log for all
  to authenticated
  using (true)
  with check (true);
