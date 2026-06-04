# Cwatt-CommandCenter Integration Skill

This skill teaches Hermes how to poll Cwatt-CommandCenter, claim tasks, spawn Claude Code workers, and report back.

---

## Overview

Cwatt-CommandCenter is Colton's mission control dashboard. Tasks are created there with full briefs. Hermes's job is to:

1. Poll for available tasks
2. Claim one atomically
3. Load project memory and prepend it to the brief (before starting)
4. Spawn a Claude Code worker in the correct repo
5. Report status back to CommandCenter as work progresses
6. Write a project memory (wiki) entry after opening the PR
7. Notify Colton on Telegram when a PR is ready

---

## Base URL

```
COMMANDCENTER_URL=https://cwatt-commandcenter.vercel.app
COMMANDCENTER_KEY=<value of HERMES_API_KEY from env>
```

All requests: `X-Hermes-Key: {COMMANDCENTER_KEY}` header.

---

## Step 1: Poll for Tasks

```bash
curl -s -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  "$COMMANDCENTER_URL/api/hermes/tasks?limit=1"
```

Response contains `tasks[]`. If empty, no work available — check again in 60 seconds.

Each task contains:
- `id` — UUID, needed for all subsequent calls
- `title` — short task name
- `brief` — full markdown brief for Claude Code
- `repo_url` — GitHub repo URL
- `repo_name` — repo name (e.g. `cwatt-bidboard`)
- `project_slug` — project identifier
- `priority` — low | medium | high | critical

---

## Step 1.5: Load Project Memory — BEFORE starting the task (Phase 12 — Agent Memory)

**Before** you spawn a Claude Code worker, pull the project's accumulated memory
so the worker already knows the codebase. Use the task's `project_slug`:

```bash
curl -s -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  "$COMMANDCENTER_URL/api/hermes/projects/$PROJECT_SLUG/context" > /tmp/project_context.json

# Extract the markdown digest to prepend to the brief in Step 5
PROJECT_MEMORY=$(jq -r '.wiki.markdown // ""' /tmp/project_context.json)
```

Returns:
- `wiki.markdown` — the full project wiki rendered as a markdown digest, grouped
  by category (architecture, patterns, gotchas, decisions, stack, files).
- `wiki.entries[]` — the raw entries if you need them structured.
- `recent_tasks[]` — the last 5 completed tasks (title, brief, branch, PR).
- `open_prs[]` — tasks currently in PR review with an open PR.

**Prepend `wiki.markdown` to the task brief before passing it to Claude Code**
(see Step 5) so the worker starts with the project's memory already in context.

The matching write-back happens **after the PR is opened** — see Step 8.5.

---

## Step 2: Claim the Task (Atomic)

Pick the highest priority task first (critical > high > medium > low).

```bash
curl -s -X POST \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent": "hermes-worker-1"}' \
  "$COMMANDCENTER_URL/api/hermes/tasks/$TASK_ID/claim"
```

- If response is `200` → task is yours, proceed
- If response is `409` → another agent claimed it first, pick the next task
- Use a unique agent name per worker: `hermes-worker-1`, `hermes-worker-2`, etc.

---

## Step 3: Set Up Git Worktree

```bash
# Repos live at ~/repos/ on the NIMO
cd ~/repos/$REPO_NAME

# Create branch name from task
BRANCH="cc/$TASK_ID_SHORT-$SLUGIFIED_TITLE"
# e.g. cc/a1b2c3-fix-claim-button

# Create isolated worktree
git fetch origin
git worktree add .workers/$TASK_ID -b $BRANCH origin/main

cd .workers/$TASK_ID
```

---

## Step 4: Report In Progress

```bash
curl -s -X PATCH \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent\": \"hermes-worker-1\", \"status\": \"in_progress\", \"branch_name\": \"$BRANCH\"}" \
  "$COMMANDCENTER_URL/api/hermes/tasks/$TASK_ID/status"
```

---

## Step 5: Run Claude Code Worker

```bash
cd ~/repos/$REPO_NAME/.workers/$TASK_ID

# Build the brief: prepend the project memory from Step 1.5, THEN the task brief
{
  echo "## Project Memory (from CommandCenter)"
  echo "$PROJECT_MEMORY"
  echo
  echo "---"
  echo
  echo "## Task"
  echo "$TASK_BRIEF"
} > /tmp/task_brief.md

# Run Claude Code in print mode
claude -p "$(cat /tmp/task_brief.md)" \
  --dangerously-skip-permissions \
  --max-turns 50 \
  --model claude-sonnet-4-5

# Clean up temp file
rm /tmp/task_brief.md
```

Use `--model claude-haiku-4-5` for low-priority simple tasks (faster, cheaper).
Use `--model claude-sonnet-4-5` for medium/high tasks.
Use `--model claude-opus-4-5` only for critical tasks requiring deep reasoning.

---

## Step 6: Commit and Push

```bash
cd ~/repos/$REPO_NAME/.workers/$TASK_ID

# Stage and commit
git add -A
git commit -m "feat: $TASK_TITLE [CommandCenter #$TASK_ID_SHORT]"
git push origin $BRANCH
```

---

## Step 7: Open Pull Request (GitHub CLI)

```bash
gh pr create \
  --repo CWatt250/$REPO_NAME \
  --head $BRANCH \
  --base main \
  --title "$TASK_TITLE" \
  --body "**CommandCenter Task:** $TASK_ID

**Brief:**
$(cat /tmp/task_brief_copy.md)

---
*Implemented by Hermes + Claude Code*"
```

Capture the PR URL from the output.

---

## Step 8: Report PR to CommandCenter

```bash
curl -s -X PATCH \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent\": \"hermes-worker-1\", \"pr_url\": \"$PR_URL\", \"pr_number\": $PR_NUMBER, \"branch_name\": \"$BRANCH\"}" \
  "$COMMANDCENTER_URL/api/hermes/tasks/$TASK_ID/pr"
```

---

## Step 8.5: Write Project Memory — AFTER opening the PR (Phase 12 — Agent Memory)

Once the PR is open and reported, append what the worker learned back to the
project wiki so the next task on this repo starts smarter:

```bash
curl -s -X POST \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content": "Summary of what was built and why.", "category": "decisions", "created_by": "hermes-worker-1"}' \
  "$COMMANDCENTER_URL/api/hermes/projects/$PROJECT_SLUG/wiki"
```

- `content` (required) — one concise summary of what was built and why. Append-only; one call per fact.
- `category` (required) — one of: `architecture`, `patterns`, `gotchas`, `decisions`, `stack`, `files`. Use `decisions` for build/PR summaries.
- `created_by` (optional) — the worker name, e.g. `hermes-worker-1`. Defaults to `agent`.

Write an entry for anything a future task on this repo would need to know:
a decision made, a gotcha hit, a pattern to follow, a key file touched.

---

## Step 9: Notify Colton on Telegram

Send a Telegram message:

```
✅ PR Ready: $TASK_TITLE

📁 Project: $PROJECT_NAME
🌿 Branch: $BRANCH
🔗 $PR_URL

Waiting for your review.
```

---

## Step 10: Clean Up Worktree

After Colton merges the PR (you can poll GitHub or wait for his Telegram confirmation):

```bash
cd ~/repos/$REPO_NAME
git worktree remove .workers/$TASK_ID --force
git branch -d $BRANCH
```

Optionally mark task as Done:

```bash
curl -s -X PATCH \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent": "hermes-worker-1", "status": "done"}' \
  "$COMMANDCENTER_URL/api/hermes/tasks/$TASK_ID/status"
```

---

## Error Handling

**If Claude Code fails or times out:**
```bash
curl -s -X POST \
  -H "X-Hermes-Key: $COMMANDCENTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"agent\": \"hermes-worker-1\", \"reason\": \"Worker timed out or errored\"}" \
  "$COMMANDCENTER_URL/api/hermes/tasks/$TASK_ID/unclaim"

# Clean up worktree
git worktree remove .workers/$TASK_ID --force
git branch -D $BRANCH

# Notify Colton
# "⚠️ Task '$TASK_TITLE' failed and was released back to the board. Check logs."
```

---

## Parallel Worker Rules

- Maximum 6 concurrent workers at once
- Each worker must use a unique `agent` name: `hermes-worker-1` through `hermes-worker-6`
- Workers on different repos can run truly in parallel
- Workers on the SAME repo must use git worktrees (already enforced by this skill)
- Never two workers on the same worktree path
- Poll interval: 60 seconds (don't hammer the API)

---

## Repo Paths on NIMO

```
~/repos/cwatt-bidboard/          → BidWatt
~/repos/reservestack/            → ReserveStack
~/repos/subwatt/                 → SubWatt
~/repos/cwatt-commandcenter/     → CommandCenter itself
```

Clone any new repo to `~/repos/` when first encountered.

---

## Priority Order

When multiple tasks are available, pick in this order:
1. `critical` — always first
2. `high`
3. `medium`
4. `low`

Within the same priority, pick oldest (`created_at` ASC) first.
