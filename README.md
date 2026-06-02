# ⌘ Cwatt-CommandCenter

> Personal mission control for autonomous AI-driven software development. Brief tasks from your phone, watch agents build them in real time, merge the PR.

**Live:** [cwatt-commandcenter.vercel.app](https://cwatt-commandcenter.vercel.app)

-----

## What It Does

CommandCenter is the command layer for a fully autonomous development pipeline. You describe what needs built — in plain English or by dropping a screenshot — and a network of AI agents picks it up, writes the code, opens a PR, and notifies you when it’s ready to review.

You brief it. They build it. You merge it.

-----

## The Pipeline

```
You (Telegram / Web)
        │
        ▼
┌───────────────┐
│    Hermes     │  Orchestrator — polls the board, routes tasks,
│  (DeepSeek)   │  spawns workers, manages up to 6 parallel agents
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Task Router  │  Classifies by priority + complexity
└───────┬───────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
⚡ Nexus   🤖 Claude Code
Local      Cloud
Free       Billed

Light tasks    Heavy tasks
Docs/copy      Multi-file features
Visual QA      Deep refactors
Board monitor  Complex builds
   │         │
   └────┬────┘
        │
        ▼
┌───────────────┐
│   PR Review   │  Awaiting Colton
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Merged ✓    │  Card auto-moves to Done
└───────────────┘
```

-----

## Agent Roles

### Hermes (Orchestrator)

- Runs on NIMO (local AMD Ryzen AI Max+ 395, 128GB RAM)
- Powered by DeepSeek via Ollama
- Polls `/api/hermes/tasks` every 60 seconds
- Claims tasks atomically (no double-claiming)
- Spawns Claude Code workers per task in isolated git worktrees
- Reports status back to the board in real time
- Pings Colton on Telegram at every stage

### ⚡ Nexus (Local Worker)

- Always-on agent on NIMO, zero cloud cost
- Routes: `qwen3:4b` (chat) → `qwen3-coder:30b` (code) → `qwen2.5vl` (vision)
- Handles light/medium tasks: docs, copy, config, small fixes
- Visual QA: screenshots the running app after UI changes, runs vision analysis, passes/fails before Colton sees the PR
- Board monitor: auto-releases stalled tasks after 45 minutes
- Pre-flight researcher: enriches briefs with codebase context before Claude Code workers start

### 🤖 Claude Code (Heavy Worker)

- Spawned by Hermes per task via CLI
- Model: claude-sonnet-4-6
- Runs in isolated git worktrees — up to 6 parallel workers, no branch conflicts
- Handles: complex features, multi-file refactors, architecture changes
- Auto-commits, pushes branch, opens PR via `gh` CLI

-----

## Tech Stack

|Layer        |Choice                                      |
|-------------|--------------------------------------------|
|Framework    |Next.js 16 (App Router)                     |
|Database     |Supabase (PostgreSQL + Realtime)            |
|UI           |shadcn/ui + Tailwind CSS                    |
|Pipeline Viz |React Flow (`@xyflow/react`)                |
|Brief Builder|Anthropic API (claude-sonnet-4-6, streaming)|
|Drag & Drop  |@dnd-kit                                    |
|Auth         |Supabase Auth                               |
|Hosting      |Vercel (auto-deploy on push)                |
|Local Agents |Ollama + llama.cpp (Vulkan/RADV)            |

-----

## Pages

### 📋 `/projects` — Kanban Boards

Per-project Kanban board with 4 columns: Brief Ready → In Progress → PR Review → Done. Drag and drop. Real-time updates via Supabase subscriptions. Task cards show priority, tags, assigned agent, and PR link.

### ✏️ `/brief` — Brief Builder

Chat interface powered by Claude API. Describe what needs built in plain English or drop a screenshot. Claude asks clarifying questions, writes a structured task brief, waits for your approval before pushing anything to the board. Nothing auto-pushes — you have to say “push it.”

### ⚡ `/pipeline` — Live Pipeline

Real-time DAG visualization of the agent pipeline using React Flow. Task pills flow top-to-bottom through nodes as work progresses. Nexus tasks glow cyan, Claude Code tasks glow amber. Active edges light up as tasks travel through the graph. Live event log on the right.

### 📊 `/activity` — Activity Feed

Global event log across all projects. Every task_created, task_claimed, pr_opened, and merged event logged in real time.

-----

## Hermes API

All endpoints under `/api/hermes/*` are protected by `X-Hermes-Key` header.

```
GET  /api/hermes/ping                    Health check
GET  /api/hermes/tasks                   Get available tasks (brief_ready, unclaimed)
POST /api/hermes/tasks/:id/claim         Atomically claim a task
PATCH /api/hermes/tasks/:id/status       Update task status
PATCH /api/hermes/tasks/:id/pr           Attach PR URL to task
POST /api/hermes/tasks/:id/unclaim       Release task back to Brief Ready
GET  /api/hermes/tasks/active            Get in-progress tasks (for stall detection)
```

Claim endpoint uses atomic SQL to prevent race conditions — if two agents try to claim the same task simultaneously, only one wins (200), the other gets a 409.

-----

## Database Schema

```sql
projects        id, name, slug, repo_url, color, icon, archived
tasks           id, project_id, title, brief, status, priority,
                claimed_by, claimed_at, branch_name, pr_url,
                pr_number, agent_preference, tags
activity_log    id, project_id, task_id, actor, action, details
```

Task status flow:

```
brief_ready → in_progress → pr_review → done
```

-----

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
HERMES_API_KEY=
ANTHROPIC_API_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

-----

## Projects Managed

|Project        |Repo               |Description                      |
|---------------|-------------------|---------------------------------|
|⚡ BidWatt      |cwatt-bidboard     |Bid management for Irex Argus    |
|🏢 ReserveStack |reservestack       |HOA reserve study compliance SaaS|
|🗺️ SubWatt      |subwatt            |HFIAW jurisdiction map PWA       |
|🎯 CommandCenter|cwatt-commandcenter|This app                         |

-----

## How It Works End to End

```
1. Open /brief on phone
2. Describe what needs built (or drop a screenshot)
3. Chat with Claude — hash it out
4. Say "push it" — task appears on Kanban board
5. Hermes polls board, claims task, creates branch
6. Hermes spawns Claude Code worker in git worktree
7. Claude Code builds the feature, commits, pushes, opens PR
8. Hermes PATCHes PR link back to task card
9. Colton gets Telegram ping: "✅ PR Ready: [title] 🔗 [url]"
10. Colton reviews and merges
11. Card moves to Done (Phase 10: auto via GitHub webhook)
```

-----

## Local Setup

```bash
git clone https://github.com/CWatt250/cwatt-commandcenter
cd cwatt-commandcenter
npm install
cp .env.local.example .env.local
# Fill in env vars
npm run dev
```

Run Supabase migrations:

```bash
# In Supabase SQL editor, run in order:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_activity_log.sql
```

-----

## Build Status

|Phase|Feature                                |Status       |
|-----|---------------------------------------|-------------|
|1–7  |Core app, Kanban, Hermes API, Auth     |✅ Live       |
|8    |Brief Builder (Claude API chat)        |✅ Live       |
|9    |Live Pipeline (React Flow DAG)         |✅ Live       |
|10   |GitHub Integration (OAuth + Webhooks)  |🔨 In Progress|
|11   |Telegram Bot (create tasks via message)|📋 Planned    |
|12   |Agent Memory (Nexus wiki + Mem0 RAG)   |📋 Planned    |

-----

*Built by [CWatt250](https://github.com/CWatt250) with Claude, Hermes, and Nexus.*