# Cwatt-CommandCenter — Full Specification

---

## 1. Database Schema

Run all migrations in order via `npx supabase db push` or the Supabase dashboard SQL editor.

---

### Migration 001 — Initial Schema

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────
create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,           -- url-safe, e.g. "bidwatt"
  description text,
  repo_url    text,                           -- e.g. https://github.com/CWatt250/cwatt-bidboard
  repo_name   text,                           -- e.g. cwatt-bidboard
  color       text not null default '#F59E0B', -- hex accent color for this project
  icon        text not null default '📁',     -- emoji icon
  sort_order  integer not null default 0,     -- sidebar ordering
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────
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
  brief         text,                          -- full markdown brief for the agent
  status        task_status not null default 'brief_ready',
  priority      task_priority not null default 'medium',

  -- Agent tracking
  claimed_by    text,                          -- agent identifier e.g. "hermes-worker-1"
  claimed_at    timestamptz,                   -- when agent claimed this task
  branch_name   text,                          -- git branch created by agent
  pr_url        text,                          -- GitHub PR URL
  pr_number     integer,                       -- GitHub PR number

  -- Metadata
  sort_order    integer not null default 0,    -- column ordering
  tags          text[] default '{}',           -- optional labels
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz                    -- set when moved to done
);

-- Index for Hermes polling
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
```

---

### Migration 002 — RLS Policies

```sql
-- Enable RLS
alter table projects enable row level security;
alter table tasks enable row level security;

-- Authenticated user can do everything (single user app)
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

-- Service role bypasses RLS (used by Hermes API routes)
-- No policy needed — service role bypasses by default
```

---

### Migration 003 — Activity Log

```sql
create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  task_id     uuid references tasks(id) on delete set null,
  actor       text not null,                  -- "Colton" | "hermes" | "worker-1" etc
  action      text not null,                  -- "task_created" | "task_claimed" | "pr_opened" | etc
  details     jsonb default '{}',             -- flexible metadata
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
```

---

### Migration 004 — Seed Initial Projects

```sql
-- Seed Colton's existing projects
-- Run after initial setup, customize as needed

insert into projects (name, slug, description, repo_url, repo_name, color, icon, sort_order) values
  ('BidWatt',       'bidwatt',       'Full-stack bid management app for Irex Argus',           'https://github.com/CWatt250/cwatt-bidboard',   'cwatt-bidboard',   '#F59E0B', '⚡', 0),
  ('ReserveStack',  'reservestack',  'HOA/condo reserve study compliance SaaS for Washington', 'https://github.com/CWatt250/reservestack',      'reservestack',     '#3B82F6', '🏢', 1),
  ('SubWatt',       'subwatt',       'HFIAW jurisdiction map and travel rate estimator PWA',   'https://github.com/CWatt250/subwatt',           'subwatt',          '#10B981', '🗺️', 2),
  ('CommandCenter', 'commandcenter', 'This app — Cwatt-CommandCenter itself',                  'https://github.com/CWatt250/cwatt-commandcenter','cwatt-commandcenter','#A855F7','🎯', 3);
```

---

## 2. TypeScript Types

File: `types/index.ts`

```typescript
export type TaskStatus = 'brief_ready' | 'in_progress' | 'pr_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repo_url: string | null;
  repo_name: string | null;
  color: string;
  icon: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  brief: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  claimed_by: string | null;
  claimed_at: string | null;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  sort_order: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ActivityLog {
  id: string;
  project_id: string | null;
  task_id: string | null;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

// Column definitions for the Kanban board
export const KANBAN_COLUMNS: { id: TaskStatus; label: string; description: string }[] = [
  { id: 'brief_ready', label: '📋 Brief Ready',  description: 'Waiting for an agent' },
  { id: 'in_progress', label: '🔄 In Progress',  description: 'Agent is working' },
  { id: 'pr_review',   label: '👀 PR Review',    description: 'Pull request opened' },
  { id: 'done',        label: '✅ Done',          description: 'Merged and complete' },
];
```

---

## 3. Pages

### `/` — Root
Middleware redirects unauthenticated users to `/auth`. Authenticated users are redirected to `/projects`.

---

### `/auth` — Login
- Full-page dark login screen
- Email + password form (Supabase auth)
- Show app name and a subtle tagline: "Your projects. Your agents. Your control."
- No signup link — this is a private app
- On success → redirect to `/projects`

---

### `/projects` — Project List

**Empty state (no projects):**
- Centered hero with icon, heading: "No projects yet"
- Subtext: "Create your first project to get started"
- Large "Create Project" button
- Shows the NewProjectModal on click

**With projects:**
- Grid of project cards (2-col on tablet, 3-col on desktop)
- Each card shows: icon, name, description, repo name, task counts by status (pills)
- Clicking a card navigates to `/projects/[slug]`
- "+ New Project" button top right

---

### `/projects/[slug]` — Kanban Board

This is the main view. Full-width 4-column Kanban board.

**Header:**
- Project icon + name (left)
- Repo link (opens GitHub in new tab) (left, subtle)
- Agent status indicator — shows how many workers are active on this project (right)
- "+ Add Task" button (right, amber accent)

**Board:**
- 4 columns: Brief Ready | In Progress | PR Review | Done
- Each column shows task count in header
- Tasks are cards sorted by sort_order within column
- Cards are draggable between columns (except locked/claimed tasks cannot be manually moved out of In Progress)
- Empty columns show a subtle dashed-border empty state

**Task Card (compact view):**
- Priority indicator (colored left border)
- Task title (bold)
- Tags (small pills)
- If claimed: agent name badge + spinning indicator
- If PR exists: "View PR" link
- Bottom row: created date, drag handle

**Real-time:**
- Board subscribes to Supabase Realtime on `tasks` table filtered by `project_id`
- Any change (from Hermes, from drag, from any modal) reflects instantly

---

### `/activity` — Global Activity Feed

- Timeline of all events across all projects
- Filter by project (dropdown)
- Each event shows: icon, actor, action description, task name (linked), project name, timestamp
- Paginated (50 per page, load more button)
- Real-time: new events appear at top automatically

---

### `/settings` — Settings

- **Hermes API Key** section: show masked key, "Regenerate" button (updates `HERMES_API_KEY` is env-based, so show instructions rather than edit)
- **Projects** section: list all projects with Archive / Delete options
- **Account** section: change password, sign out button

---

## 4. Components

### `AppShell.tsx`
Wraps every authenticated page. Contains:
- `<Sidebar />` (desktop)
- `<MobileNav />` (mobile, bottom bar)
- `<main>` content area

### `Sidebar.tsx`
Left sidebar, fixed, ~240px wide.

Structure:
```
[Logo/App Name]           ← "⌘ CommandCenter" in DM Mono
──────────────
▸ Projects                ← section header
  > BidWatt         [3]   ← active project highlight + task count
    ReserveStack    [1]
    SubWatt         [0]
  + New Project           ← amber text button
──────────────
▸ Navigation
  📊 Activity
  ⚙️ Settings
──────────────
[Agent Status]            ← bottom: "2 agents active" indicator
```

On mobile: sidebar hidden, replaced by bottom nav with icons only.

### `KanbanBoard.tsx`
- Wraps all 4 `KanbanColumn` components in a DnD context
- Handles drag end: updates task status + sort_order in Supabase
- Locked tasks (claimed_by is set) cannot be dragged
- Optimistic updates: move card immediately, revert on error

### `KanbanColumn.tsx`
Props: `status`, `tasks[]`, `onAddTask`
- Column header with label, count badge, "+ Add" icon button
- Droppable zone
- Maps `tasks` to `<TaskCard />` components
- Empty state: dashed border box with "Drop tasks here" text

### `TaskCard.tsx`
Props: `task`, `onClick`
- Draggable (unless `task.claimed_by` is set)
- Priority color: left 3px border
- Contents:
  - Top: priority badge (small) + tags
  - Middle: title (1-2 lines, truncate)
  - Bottom: claimed indicator OR created date
  - If PR exists: small "↗ PR #123" link (non-draggable click zone)
- Hover: slight elevation, border lightens
- Claimed cards: subtle pulsing amber glow, agent name shown

### `NewProjectModal.tsx`
3-step wizard:
1. **Name & Icon** — text input for name (slug auto-generated), emoji picker (10 options), color picker (8 preset hex colors)
2. **Repository** — optional GitHub repo URL input, auto-parses repo name
3. **Confirm** — summary, "Create Project" button

On create: inserts to DB, navigates to new project board.

### `NewTaskModal.tsx`
Single form, opens as sheet/drawer from right side.
Fields:
- Title (text input, required)
- Priority (segmented control: Low / Medium / High / Critical)
- Tags (tag input, comma-separated)
- Brief (full markdown textarea — this is the agent's brief, use monospace font, tall textarea)

On create: inserts task with `status: 'brief_ready'`, logs to activity, closes modal.

### `TaskDetailModal.tsx`
Opens on task card click. Full overlay modal.
Sections:
- Header: title (editable inline), status badge, priority badge
- **Brief** tab: rendered markdown (react-markdown), "Edit" toggle
- **Activity** tab: task-specific activity log timeline
- **Details** sidebar: agent name, branch name (linked to GitHub), PR link, created/updated timestamps
- Footer: "Delete Task" (destructive, confirm dialog)

---

## 5. Hermes API Endpoints

All routes: `/api/hermes/[...]`
All routes: require `X-Hermes-Key: {HERMES_API_KEY}` header. Return 401 if missing or wrong.
All routes: use Supabase service role client (bypasses RLS).

---

### `GET /api/hermes/ping`
Health check.
```json
{ "status": "ok", "timestamp": "2026-05-21T00:00:00Z" }
```

---

### `GET /api/hermes/tasks`
Returns all `brief_ready` tasks across all projects (or filtered by project slug).

Query params:
- `?project=bidwatt` (optional) — filter by project slug
- `?limit=10` (optional, default 10)

Response:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "project_slug": "bidwatt",
      "project_name": "BidWatt",
      "repo_url": "https://github.com/CWatt250/cwatt-bidboard",
      "repo_name": "cwatt-bidboard",
      "title": "Fix Claim button on My Workspace",
      "brief": "## Brief\n\nFix the Claim button...",
      "priority": "high",
      "tags": ["bug", "workspace"],
      "created_at": "2026-05-21T00:00:00Z"
    }
  ],
  "count": 1
}
```

Only returns tasks where `claimed_by IS NULL` and `status = 'brief_ready'`.

---

### `POST /api/hermes/tasks/[id]/claim`
Atomically claims a task. Uses a single UPDATE with a WHERE clause to prevent race conditions.

Request body:
```json
{ "agent": "hermes-worker-1" }
```

Implementation (critical — prevents double-claiming):
```sql
UPDATE tasks
SET claimed_by = $agent, claimed_at = now(), status = 'in_progress'
WHERE id = $id
  AND claimed_by IS NULL
  AND status = 'brief_ready'
RETURNING *
```

Response 200 (success):
```json
{ "success": true, "task": { ...full task object... } }
```

Response 409 (already claimed):
```json
{ "success": false, "error": "Task already claimed" }
```

Logs to activity_log: `action: "task_claimed"`, `actor: agent`, `details: { agent }`

---

### `PATCH /api/hermes/tasks/[id]/status`
Update task status. Called by Hermes to move cards.

Request body:
```json
{
  "agent": "hermes-worker-1",
  "status": "pr_review",
  "branch_name": "feat/fix-claim-button"
}
```

Valid status values: `in_progress` | `pr_review` | `done`
(Cannot set back to `brief_ready` via this endpoint)

Sets `completed_at` automatically when status is `done`.

Logs to activity_log with action `"status_updated"`.

---

### `PATCH /api/hermes/tasks/[id]/pr`
Attach a PR link to a task. Call this when the Claude Code worker opens a PR.

Request body:
```json
{
  "agent": "hermes-worker-1",
  "pr_url": "https://github.com/CWatt250/cwatt-bidboard/pull/68",
  "pr_number": 68,
  "branch_name": "feat/fix-claim-button"
}
```

Automatically sets status to `pr_review` if it isn't already.

Logs to activity_log with action `"pr_opened"`.

---

### `POST /api/hermes/tasks/[id]/unclaim`
Release a task back to `brief_ready` (e.g., worker failed or timed out).

Request body:
```json
{ "agent": "hermes-worker-1", "reason": "Worker timed out after 30 minutes" }
```

Only works if `claimed_by` matches `agent`. Clears `claimed_by`, `claimed_at`, resets status to `brief_ready`.

Logs to activity_log with action `"task_released"`.

---

## 6. Real-time Subscriptions

### `useProjects` hook
```typescript
// Subscribe to all project changes
supabase
  .channel('projects')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, handler)
  .subscribe()
```

### `useTasks` hook
```typescript
// Subscribe to tasks for a specific project
supabase
  .channel(`tasks:${projectId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tasks',
    filter: `project_id=eq.${projectId}`
  }, handler)
  .subscribe()
```

Handlers:
- `INSERT` → add card to correct column
- `UPDATE` → move card if status changed, update fields in place
- `DELETE` → remove card

### `useActivityLog` hook
```typescript
supabase
  .channel('activity_log')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, handler)
  .subscribe()
```

---

## 7. Auth & Middleware

File: `middleware.ts` (root level)

Protected routes: everything except `/auth` and `/api/hermes/[...]`.

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Skip auth check for Hermes API routes
  if (req.nextUrl.pathname.startsWith('/api/hermes')) {
    return res
  }

  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname !== '/auth') {
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  if (session && req.nextUrl.pathname === '/auth') {
    return NextResponse.redirect(new URL('/projects', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 8. Hermes Integration Notes

Hermes should be configured with the following behavior:

**Polling:** Poll `GET /api/hermes/tasks` every 30–60 seconds for available work.

**Worker spawn flow:**
1. GET `/api/hermes/tasks` — find a `brief_ready` task
2. POST `/api/hermes/tasks/[id]/claim` — claim it atomically
3. On 409 → skip, try next task
4. On 200 → spawn Claude Code worker:
   ```bash
   cd /path/to/repo
   git worktree add .workers/[task-id] -b [branch-name]
   cd .workers/[task-id]
   claude -p "[brief]" --dangerously-skip-permissions --max-turns 50
   ```
5. PATCH `/api/hermes/tasks/[id]/status` with `in_progress` + `branch_name`
6. When worker opens PR → PATCH `/api/hermes/tasks/[id]/pr` with PR details
7. Send Telegram message to Colton: "✅ PR ready for [task title]: [pr_url]"
8. If worker fails → POST `/api/hermes/tasks/[id]/unclaim`

**Parallel workers:** Hermes can claim up to 6 tasks simultaneously. Each gets its own git worktree. Different tasks can be on different repos.

**Branch naming convention:** `cc/[task-id-short]-[slugified-title]`
Example: `cc/a1b2c3-fix-claim-button`

---

## 9. Responsive Design Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 768px` (mobile) | No sidebar. Bottom nav with icons. Board scrolls horizontally. Single column view on very small screens. |
| `768px–1024px` (tablet) | Collapsed sidebar (icons only, expands on hover/click). Full 4-column board. |
| `> 1024px` (desktop) | Full sidebar 240px. Full 4-column board. |

The app must be fully functional on a phone — creating tasks, viewing boards, checking PR status.
