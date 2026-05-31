-- Migration 001 — Initial Schema

create extension if not exists "pgcrypto";

-- PROJECTS
create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  repo_url    text,
  repo_name   text,
  color       text not null default '#F59E0B',
  icon        text not null default '📁',
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- TASKS
create type task_status as enum (
  'brief_ready',
  'in_progress',
  'pr_review',
  'done'
);

create type task_priority as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  brief         text,
  status        task_status not null default 'brief_ready',
  priority      task_priority not null default 'medium',

  claimed_by    text,
  claimed_at    timestamptz,
  branch_name   text,
  pr_url        text,
  pr_number     integer,

  sort_order    integer not null default 0,
  tags          text[] default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index tasks_status_idx on tasks(status) where status = 'brief_ready';
create index tasks_project_idx on tasks(project_id);
create index tasks_claimed_idx on tasks(claimed_by) where claimed_by is not null;

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();
