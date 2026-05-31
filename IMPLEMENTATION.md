# Cwatt-CommandCenter — Implementation Plan

Claude Code: follow this plan in order. Complete each phase fully before moving to the next. Check off items as you go.

---

## Before You Start

1. Read `CLAUDE.md` fully
2. Read `SPEC.md` fully
3. Scaffold the Next.js project:
   ```bash
   npx create-next-app@latest cwatt-commandcenter \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir=false \
     --import-alias="@/*"
   ```
4. Install all dependencies in one shot:
   ```bash
   npm install \
     @supabase/supabase-js \
     @supabase/auth-helpers-nextjs \
     @dnd-kit/core \
     @dnd-kit/sortable \
     @dnd-kit/utilities \
     react-markdown \
     remark-gfm \
     lucide-react \
     clsx \
     tailwind-merge \
     date-fns
   ```
5. Install shadcn/ui:
   ```bash
   npx shadcn@latest init
   ```
   Then add components:
   ```bash
   npx shadcn@latest add button input label textarea badge dialog sheet dropdown-menu tooltip separator skeleton avatar
   ```
6. Add Google Fonts (DM Mono) to `app/layout.tsx` via `next/font/google`
7. Add Geist font (from `next/font/local` or `geist` npm package)
8. Create `.env.local` with all variables from CLAUDE.md (fill in values)
9. Push Supabase migrations (all 4 from SPEC.md)

---

## Phase 1 — Foundation

**Goal:** App loads, auth works, sidebar renders, routing works.

### 1.1 — Global Styles & Theme
- [ ] `app/globals.css` — add all CSS variables from SPEC.md design system
- [ ] Set `background: var(--bg-base)` on `body`
- [ ] Set `color: var(--text-primary)` on `body`
- [ ] Tailwind config — add custom colors mapping to CSS variables

### 1.2 — Supabase Clients
- [ ] `lib/supabase/client.ts` — browser client using `createClientComponentClient`
- [ ] `lib/supabase/server.ts` — server client using `createServerComponentClient`
- [ ] `lib/hermes.ts` — `validateHermesKey(request: Request): boolean` helper

### 1.3 — TypeScript Types
- [ ] `types/index.ts` — all types from SPEC.md section 2

### 1.4 — Middleware
- [ ] `middleware.ts` — from SPEC.md section 7
- [ ] Test: unauthenticated → redirects to `/auth`

### 1.5 — Auth Page
- [ ] `app/auth/page.tsx` — full-page dark login
- [ ] Dark background, centered card
- [ ] App logo/name: `⌘ CommandCenter` in DM Mono
- [ ] Tagline: "Your projects. Your agents. Your control."
- [ ] Email + password form → Supabase `signInWithPassword`
- [ ] Error state (wrong credentials)
- [ ] Loading state on submit button
- [ ] On success → router.push('/projects')

### 1.6 — Root Layout
- [ ] `app/layout.tsx` — load fonts (DM Mono, Geist), metadata, html/body

### 1.7 — Root Redirect
- [ ] `app/page.tsx` — server component, redirect to `/projects`

### 1.8 — AppShell
- [ ] `components/layout/AppShell.tsx` — sidebar + main area layout
- [ ] Desktop: sidebar fixed left 240px, main fills rest
- [ ] All authenticated pages wrap with `<AppShell>`

### 1.9 — Sidebar (static first)
- [ ] `components/layout/Sidebar.tsx` — render static placeholder
- [ ] App name header
- [ ] "Projects" section label
- [ ] Placeholder project items
- [ ] Navigation links: Activity, Settings
- [ ] "+ New Project" button (no function yet)
- [ ] Agent status area at bottom (static "0 agents active")

**Phase 1 done when:** Login works, sidebar renders on all pages, routing between `/projects`, `/activity`, `/settings` works.

---

## Phase 2 — Projects System

**Goal:** Create, list, and navigate projects. Sidebar is live.

### 2.1 — Hooks
- [ ] `hooks/useProjects.ts`
  - Fetches all non-archived projects ordered by `sort_order`
  - Subscribes to Supabase Realtime on `projects` table
  - Returns `{ projects, loading, error }`

### 2.2 — Sidebar (live)
- [ ] Wire `useProjects` into `Sidebar.tsx`
- [ ] Render project list with icon, name, task count badge
- [ ] Highlight active project (match current URL slug)
- [ ] Task count: show count of non-done tasks (query separately or join)

### 2.3 — New Project Modal
- [ ] `components/projects/NewProjectModal.tsx`
- [ ] Step 1: Name input (auto-generate slug from name), emoji picker, color picker
  - Emoji options: 📁 ⚡ 🏢 🗺️ 🎯 🔧 🚀 💡 🔨 🌐
  - Color options: #F59E0B #3B82F6 #10B981 #A855F7 #EF4444 #F97316 #06B6D4 #8B5CF6
- [ ] Step 2: GitHub repo URL (optional), auto-parse repo name
- [ ] Step 3: Review + Create
- [ ] On create: INSERT to `projects`, navigate to new project board
- [ ] Wire "+ New Project" button in sidebar to open this modal

### 2.4 — Projects List Page
- [ ] `app/projects/page.tsx`
- [ ] If no projects: full-page empty state, "Create your first project" CTA
- [ ] If projects: grid of project cards
  - Icon, color accent, name, description, repo name
  - Task count pills by status (4 colored pills)
  - Click → navigate to `/projects/[slug]`
- [ ] "+ New Project" button top right

### 2.5 — Project Board Page Shell
- [ ] `app/projects/[slug]/page.tsx`
- [ ] Fetch project by slug (404 if not found)
- [ ] Render page header: icon, name, repo link, "+ Add Task" button
- [ ] Placeholder for board (4 empty columns for now)

**Phase 2 done when:** Can create a project, see it in sidebar, navigate to its page.

---

## Phase 3 — Task & Kanban System

**Goal:** Full Kanban board with tasks, drag & drop, task creation and detail.

### 3.1 — Tasks Hook
- [ ] `hooks/useTasks.ts`
  - Accepts `projectId: string`
  - Fetches all tasks for project, ordered by `sort_order`
  - Subscribes to Realtime filtered by `project_id`
  - Groups tasks by status: `{ brief_ready[], in_progress[], pr_review[], done[] }`
  - Handles INSERT (add to column), UPDATE (move/update in place), DELETE (remove)

### 3.2 — Task Card
- [ ] `components/board/TaskCard.tsx`
- [ ] Priority color on left border (3px solid)
- [ ] Title (truncate at 2 lines)
- [ ] Tags as small pills
- [ ] Bottom: if claimed → agent name + amber pulse indicator; else → relative date
- [ ] If PR exists: "↗ PR #[number]" link (stop propagation on click — opens GitHub)
- [ ] Draggable via `@dnd-kit/sortable` — disabled if `claimed_by` is set
- [ ] Hover: `bg-elevated`, border lightens
- [ ] Click (not drag) → open TaskDetailModal

### 3.3 — Kanban Column
- [ ] `components/board/KanbanColumn.tsx`
- [ ] Props: `status`, `label`, `tasks[]`
- [ ] Header: label, count badge, "+ Add" icon button
- [ ] Droppable via `@dnd-kit/core`
- [ ] Empty state: dashed border, status-colored, subtle text
- [ ] Vertical scroll if many cards

### 3.4 — Kanban Board
- [ ] `components/board/KanbanBoard.tsx`
- [ ] `DndContext` wrapping all 4 columns
- [ ] `onDragEnd`:
  - Find task, determine new status from target column
  - If task has `claimed_by` → do nothing (locked)
  - Optimistic update: move card immediately
  - UPDATE task in Supabase (status + sort_order)
  - On error: revert to original position
- [ ] Horizontal scroll on mobile (4 columns side by side, each min-width 280px)

### 3.5 — New Task Modal
- [ ] `components/tasks/NewTaskModal.tsx`
- [ ] Opens as right-side sheet/drawer (shadcn Sheet)
- [ ] Fields: Title (required), Priority (segmented), Tags (multi-input), Brief (tall monospace textarea)
- [ ] Character count on brief
- [ ] Submit: INSERT task, close sheet, log to activity_log
- [ ] Starts in the column whose "+ Add" was clicked (pass initial status as prop)
- [ ] Wire to board "+ Add Task" header button (defaults to brief_ready)

### 3.6 — Task Detail Modal
- [ ] `components/tasks/TaskDetailModal.tsx`
- [ ] Opens as full overlay dialog on card click
- [ ] Two tabs: "Brief" | "Activity"
- [ ] Brief tab: rendered markdown (react-markdown + remark-gfm), "Edit" toggle → textarea
- [ ] Activity tab: task-specific events from activity_log
- [ ] Right sidebar (or below on mobile): agent name, branch (link to GitHub), PR link, timestamps
- [ ] Inline title edit (click to edit, enter/blur to save)
- [ ] Footer: Delete button with confirmation dialog
- [ ] On delete: DELETE task, close modal

### 3.7 — Wire board to project page
- [ ] `app/projects/[slug]/page.tsx` — replace placeholder with `<KanbanBoard />`
- [ ] Pass projectId to KanbanBoard
- [ ] Pass tasks from `useTasks` hook

**Phase 3 done when:** Can create tasks, drag them between columns, view/edit task details. Changes are live (no refresh needed).

---

## Phase 4 — Hermes API

**Goal:** All Hermes API endpoints work and are secured.

### 4.1 — API Key Validation
- [ ] `lib/hermes.ts` — `validateHermesKey(req: Request): boolean`
  - Check `X-Hermes-Key` header against `process.env.HERMES_API_KEY`
  - Return false if missing or mismatch

### 4.2 — Ping Endpoint
- [ ] `app/api/hermes/ping/route.ts`
- [ ] No auth required (health check)
- [ ] GET → `{ status: "ok", timestamp }`

### 4.3 — Get Tasks Endpoint
- [ ] `app/api/hermes/tasks/route.ts`
- [ ] Validate Hermes key → 401 if invalid
- [ ] Parse query params: `project`, `limit`
- [ ] Query: tasks WHERE status='brief_ready' AND claimed_by IS NULL
- [ ] Join project data (slug, name, repo_url, repo_name)
- [ ] Return array + count

### 4.4 — Claim Task Endpoint
- [ ] `app/api/hermes/tasks/[id]/claim/route.ts`
- [ ] Validate Hermes key
- [ ] Parse body: `{ agent }`
- [ ] Run atomic UPDATE (see SPEC.md section 5)
- [ ] If 0 rows updated → 409 already claimed
- [ ] If 1 row updated → 200 success + task data
- [ ] Insert activity_log entry

### 4.5 — Update Status Endpoint
- [ ] `app/api/hermes/tasks/[id]/status/route.ts`
- [ ] Validate Hermes key
- [ ] Parse body: `{ agent, status, branch_name? }`
- [ ] Validate status is one of: in_progress, pr_review, done
- [ ] UPDATE task, set `completed_at` if done
- [ ] Insert activity_log entry

### 4.6 — Attach PR Endpoint
- [ ] `app/api/hermes/tasks/[id]/pr/route.ts`
- [ ] Validate Hermes key
- [ ] Parse body: `{ agent, pr_url, pr_number, branch_name? }`
- [ ] UPDATE task: pr_url, pr_number, branch_name, status='pr_review'
- [ ] Insert activity_log entry

### 4.7 — Unclaim Endpoint
- [ ] `app/api/hermes/tasks/[id]/unclaim/route.ts`
- [ ] Validate Hermes key
- [ ] Parse body: `{ agent, reason? }`
- [ ] Only update if claimed_by matches agent
- [ ] Reset: claimed_by=null, claimed_at=null, status='brief_ready'
- [ ] Insert activity_log entry

### 4.8 — Manual API Test
Test all endpoints with curl before moving on:
```bash
# Ping
curl https://your-app.vercel.app/api/hermes/ping

# Get tasks
curl -H "X-Hermes-Key: your-key" https://your-app.vercel.app/api/hermes/tasks

# Claim task
curl -X POST -H "X-Hermes-Key: your-key" -H "Content-Type: application/json" \
  -d '{"agent":"test-worker"}' \
  https://your-app.vercel.app/api/hermes/tasks/[id]/claim
```

**Phase 4 done when:** All 6 Hermes endpoints respond correctly, key validation works, atomic claim prevents double-claiming.

---

## Phase 5 — Activity Feed & Settings

### 5.1 — Activity Hook
- [ ] `hooks/useActivityLog.ts`
  - Accepts optional `projectId?: string`
  - Fetches activity_log, ordered by created_at DESC, limit 50
  - Realtime: new inserts appear at top
  - Joins task title and project name

### 5.2 — Activity Page
- [ ] `app/activity/page.tsx`
- [ ] Timeline layout (vertical line, event dots)
- [ ] Each event: icon by action type, actor name, description, project badge, timestamp
- [ ] Project filter dropdown (all | per-project)
- [ ] "Load more" button (fetch next 50)
- [ ] Realtime: new events appear at top with subtle animation

Action → human-readable description mapping:
- `task_created` → "[actor] created a task"
- `task_claimed` → "[actor] picked up this task"
- `status_updated` → "[actor] moved to [status]"
- `pr_opened` → "[actor] opened a pull request"
- `task_released` → "[actor] released this task"

### 5.3 — Settings Page
- [ ] `app/settings/page.tsx`
- [ ] **API Key section:** Show masked key (`hkey_••••••••••••`), note that key is set via environment variable
- [ ] **Projects section:** Table of all projects, Archive button, Delete button (with confirm)
- [ ] **Account section:** Sign out button

**Phase 5 done when:** Activity feed shows live events. Settings page renders.

---

## Phase 6 — Polish & Mobile

### 6.1 — Mobile Nav
- [ ] `components/layout/MobileNav.tsx`
- [ ] Fixed bottom bar, visible below 768px
- [ ] Icons: Projects, Activity, Settings
- [ ] Active state indicator (amber dot or underline)
- [ ] Hide sidebar below 768px breakpoint

### 6.2 — Agent Status Indicator (Sidebar)
- [ ] Query: count of tasks WHERE status='in_progress' AND claimed_by IS NOT NULL
- [ ] Subscribe to realtime
- [ ] Show: "● 2 agents active" in amber when > 0, "● idle" in muted when 0
- [ ] Tooltip on hover: list of active agents + their task titles

### 6.3 — Loading States
- [ ] All data-fetching components show skeleton cards while loading
- [ ] `KanbanColumn` skeleton: 2-3 skeleton task cards
- [ ] `Sidebar` skeleton: 3 placeholder project items

### 6.4 — Error States
- [ ] If project not found (bad slug) → centered "Project not found" with back link
- [ ] If Supabase error → toast notification (use shadcn Toast)
- [ ] API error → appropriate error response

### 6.5 — Animations & Micro-interactions
- [ ] Task card drag: slight scale up (1.02) + shadow on grab
- [ ] Column drop zone: amber border highlight when card is over it
- [ ] New task appears: slide-in animation from bottom of column
- [ ] Card status change: brief flash of new status color
- [ ] Modal open/close: smooth fade + scale

### 6.6 — Claimed Task Visual
- [ ] Cards with `claimed_by` set:
  - Slightly different background (bg-elevated)
  - Amber left border (not priority color)
  - Small pulsing amber dot in top-right corner
  - Agent name shown as small monospace text
  - Drag handle hidden / cursor: default

### 6.7 — Board Horizontal Scroll (Mobile)
- [ ] Board container: `overflow-x: auto`, `display: flex`
- [ ] Each column: `min-width: 280px`, `flex-shrink: 0`
- [ ] Snap scrolling on mobile: `scroll-snap-type: x mandatory`
- [ ] Each column: `scroll-snap-align: start`

---

## Phase 7 — Deploy to Vercel

### 7.1 — Pre-deploy Checklist
- [ ] All env vars set in Vercel project settings
- [ ] `HERMES_API_KEY` — generate a random 32-char string
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase
- [ ] `NEXT_PUBLIC_APP_URL` — your Vercel URL

### 7.2 — Deploy
```bash
# Push to GitHub
git add .
git commit -m "feat: initial Cwatt-CommandCenter build"
git push origin main

# Connect to Vercel (first time)
npx vercel --prod

# Or via Vercel dashboard: Import GitHub repo
```

### 7.3 — Post-deploy
- [ ] Test auth flow on Vercel URL
- [ ] Test Hermes API endpoints on live URL
- [ ] Test mobile layout on actual phone
- [ ] Seed initial projects (run Migration 004 SQL in Supabase dashboard)
- [ ] Share live URL with Colton

---

## Build Notes

- Use `use client` directive only where required (event handlers, hooks, realtime). Keep server components where possible.
- Supabase Realtime requires client-side code — all hooks are client components.
- The service role key MUST only be used in API routes (server-side). Never expose it to the browser.
- DnD Kit requires `use client` on all board components.
- When testing drag and drop, use two browser windows to verify realtime sync works.
- The seed migration (004) should be run manually, not part of the automated migration flow.
