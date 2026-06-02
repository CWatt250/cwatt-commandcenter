-- Migration 007 — Nexus support
--
-- Adds the agent-routing columns the pipeline + claim flow rely on. Migration
-- 005 (from COMMANDCENTER_UPDATE_1.md) that originally introduced these was
-- never applied, so we (re)create them idempotently here.

-- How the brief author wants this task routed. `auto` lets the Task Router
-- decide; `nexus`/`claude-code` pin it to a side.
alter table tasks add column if not exists agent_preference
  text not null default 'auto'
  check (agent_preference in ('auto', 'nexus', 'claude-code'));

-- Which agent actually picked the task up, set at claim time from the worker
-- name prefix. NULL until claimed.
alter table tasks add column if not exists agent_type text
  check (agent_type in ('nexus', 'claude-code', null));

-- Hot path for workers polling for claimable, unclaimed briefs by side.
create index if not exists tasks_nexus_idx
  on tasks(status, priority, agent_preference)
  where status = 'brief_ready' and claimed_by is null;
