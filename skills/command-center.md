# Command Center — Hermes Task Poller

Polls Colton's Command Center task board and executes tasks locally.

## Config

```bash
COMMAND_CENTER_URL=https://cwatt-commandcenter.vercel.app
COMMAND_CENTER_KEY=43ee1404aac27f577712a230313f72cbf732cec18486b81c647ced1e6b799f46
```

## Task Lifecycle

1. **Poll** — `GET /api/hermes/tasks?agent_type=nexus` every 60s for low/medium priority
2. **Claim** — `POST /api/hermes/tasks/{id}/claim` with `{"agent":"nexus-worker-1"}`
3. **Pull context** — `GET /api/hermes/projects/{slug}/context` and prepend the
   returned wiki context to the task brief before executing. Graceful: if the API
   is down or the project has no wiki, the task runs without it.
4. **Execute** — Run locally:
   - Code → qwen3-coder:30b
   - Docs → qwen3:4b
   - Visual QA → qwen2.5vl
5. **Ship** — Open PR, then `PATCH /api/hermes/tasks/{id}/pr` with PR URL
6. **Record** — `POST /api/hermes/projects/{slug}/wiki` with
   `{"content":"PR #… - summary","category":"decisions","created_by":"nexus-worker-1"}`
   so the next task on that project inherits the decision.
7. **Notify** — Ping Colton on Telegram when PR is ready

## Agent memory (context in → wiki out)

The poller (`projects/hermes-worker/hermes_worker.py`) closes the loop on its own:

- **Before** running a skill it calls `fetch_project_context(slug)` and
  `inject_context(task, context)` — the slug is resolved from the task's
  `slug` / `project_slug` / `project` field via `resolve_slug`.
- **After** `complete_task` it calls `post_wiki_entry(slug, result)`, which scans
  the result for a PR reference (`extract_pr`) and posts a `decisions` entry.

All four network calls share `X-Hermes-Key` and swallow failures with a warning —
a memory hiccup never fails the task.
