# Cwatt-CommandCenter — Claude Code Context

This file is read automatically by Claude Code. Read it fully before touching any file.

---

## What This App Is

**Cwatt-CommandCenter** is a personal mission control dashboard for Colton Watt (CWatt250). It manages all of his development projects via a Kanban board system. Each project has its own board. Hermes (an autonomous AI agent running on a local NIMO machine) polls this app's API to pick up tasks and spawn Claude Code workers. Claude Code workers do the actual coding on each project.

This app is the **command layer** — it does not do the coding. It manages what gets built, by whom, and tracks status in real-time.

**Single user. No multi-tenant. No public signup.**

---

## Owner

- GitHub: CWatt250
- App name: Cwatt-CommandCenter
- Repo: `CWatt250/cwatt-commandcenter`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (new project, separate from BidWatt) |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| Real-time | Supabase Realtime subscriptions |
| Auth | Supabase Auth (email/password, single user) |
| Hosting | Vercel |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Markdown | `react-markdown` + `remark-gfm` |

---

## Critical Rules — Never Break These

1. **Real-time is non-negotiable.** All card status changes must reflect instantly via Supabase subscriptions. If something requires a manual browser refresh, the implementation is wrong.
2. **Single user only.** No role system. No invitations. No tenant isolation. Auth is purely to protect the app from the open internet.
3. **Hermes API is the integration layer.** All Hermes-facing routes live under `/api/hermes/`. They are protected by a static API key (`HERMES_API_KEY` env var) passed as `X-Hermes-Key` header.
4. **Never hardcode project IDs, slugs, or repo names.** Everything is dynamic from the database.
5. **Mobile-first.** Every page must be fully usable on a phone. Sidebar collapses to a bottom nav or hamburger on mobile.
6. **No manual refresh required anywhere.** Use Supabase subscriptions for live updates.
7. **Task locking is critical.** When Hermes claims a task, it must be atomically locked so no two agents grab the same task. Use Supabase row-level locking or an optimistic `claimed_at` timestamp check.

---

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth (single user credentials — set once)
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Hermes Integration
HERMES_API_KEY=

# GitHub Integration (Phase 10)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

---

## File Structure

```
cwatt-commandcenter/
├── CLAUDE.md                          ← this file
├── SPEC.md                            ← full feature spec
├── IMPLEMENTATION.md                  ← build order
├── app/
│   ├── layout.tsx                     ← root layout, font, theme
│   ├── page.tsx                       ← redirect to /projects
│   ├── auth/
│   │   └── page.tsx                   ← login page
│   ├── projects/
│   │   ├── page.tsx                   ← project list / empty state
│   │   └── [slug]/
│   │       └── page.tsx               ← kanban board for project
│   ├── activity/
│   │   └── page.tsx                   ← global activity feed
│   └── settings/
│       └── page.tsx                   ← API key, preferences
├── api/
│   └── hermes/
│       ├── tasks/
│       │   ├── route.ts               ← GET available tasks
│       │   └── [id]/
│       │       ├── claim/route.ts     ← POST claim a task
│       │       ├── status/route.ts    ← PATCH update status
│       │       ├── pr/route.ts        ← PATCH attach PR link
│       │       └── unclaim/route.ts   ← POST release task
│       └── ping/route.ts              ← GET health check
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx               ← sidebar + main area wrapper
│   │   ├── Sidebar.tsx                ← project list, nav, new project
│   │   └── MobileNav.tsx              ← bottom nav for mobile
│   ├── board/
│   │   ├── KanbanBoard.tsx            ← 4-column board with DnD
│   │   ├── KanbanColumn.tsx           ← single column
│   │   └── TaskCard.tsx               ← draggable task card
│   ├── projects/
│   │   ├── NewProjectModal.tsx        ← create project wizard
│   │   └── ProjectListItem.tsx        ← sidebar project entry
│   ├── tasks/
│   │   ├── NewTaskModal.tsx           ← create task with brief
│   │   └── TaskDetailModal.tsx        ← full task view
│   └── ui/                            ← shadcn components (auto-generated)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  ← browser client
│   │   ├── server.ts                  ← server client
│   │   └── middleware.ts              ← auth middleware
│   ├── hermes.ts                      ← Hermes API key validation helper
│   └── utils.ts                       ← cn() and shared utilities
├── hooks/
│   ├── useProjects.ts                 ← project list with realtime
│   ├── useTasks.ts                    ← tasks for a board with realtime
│   └── useActivityLog.ts              ← activity feed with realtime
├── types/
│   └── index.ts                       ← all shared TypeScript types
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_activity_log.sql
└── middleware.ts                       ← protect all routes except /auth
```

---

## Design System

### Aesthetic Direction
**Dark industrial command center.** Think mission control meets modern SaaS. This is a tool for a builder — it should feel powerful, fast, and purposeful. Not playful. Not corporate. Precise.

### Colors (CSS variables in globals.css)
```css
--bg-base: #0A0C10;        /* page background */
--bg-surface: #111318;     /* sidebar, cards */
--bg-card: #1A1D24;        /* kanban cards */
--bg-elevated: #22262F;    /* modals, dropdowns */
--border: #2A2D34;         /* all borders */
--border-subtle: #1E2128;  /* subtle dividers */
--accent-amber: #F59E0B;   /* primary accent - construction/industrial */
--accent-blue: #3B82F6;    /* actions, links */
--accent-green: #10B981;   /* success, done */
--accent-red: #EF4444;     /* error, critical */
--text-primary: #E2E8F0;   /* main text */
--text-secondary: #94A3B8; /* secondary text */
--text-muted: #475569;     /* placeholders, timestamps */
```

### Typography
- **Display / headings:** `'DM Mono'` (Google Fonts) — industrial, technical feel
- **Body / UI:** `'Geist Sans'` (Vercel's font, available via `next/font`) — clean, modern
- **Code / briefs:** `'Geist Mono'` — for task briefs and technical content

### Status Colors
```
Brief Ready  → amber ring  (#F59E0B)
In Progress  → blue ring   (#3B82F6)
PR Review    → purple ring (#A855F7)
Done         → green ring  (#10B981)
```

### Priority Colors
```
Low      → slate  (#64748B)
Medium   → amber  (#F59E0B)
High     → orange (#F97316)
Critical → red    (#EF4444) + subtle pulse animation
```

---

## Dev Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # lint check
npx supabase db push # push migrations to Supabase
```

---

## Key Behaviors

- Navigating to `/` redirects to `/projects`
- If no projects exist, `/projects` shows a full-page onboarding/empty state with a "Create your first project" CTA
- Clicking a project in the sidebar navigates to `/projects/[slug]` and loads its Kanban board
- The active project is highlighted in the sidebar
- New Project modal can be opened from the sidebar "+ New" button or the empty state CTA
- New Task modal opens from a "+ Add Task" button in any column header
- Task cards are draggable between columns (updates status in DB instantly)
- Dragging a card to "In Progress" only works if Hermes hasn't claimed it yet (claimed tasks are locked, shown with an agent indicator)
- Task detail opens as a modal overlay on card click
- Activity feed shows all events across all projects, most recent first
