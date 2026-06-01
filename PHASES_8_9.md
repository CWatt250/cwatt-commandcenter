# Cwatt-CommandCenter — Remaining Phases (8 & 9)

Read CLAUDE.md before touching anything. These are the two remaining build phases after the core app (Phases 1–7) is deployed.

---

# PHASE 8 — Brief Builder (`/brief`)

## What it is

A Claude-powered chat page inside CommandCenter. Colton describes what he needs built (in plain English or by dropping a screenshot), Claude asks clarifying questions, they hash it out together, and Colton explicitly approves before anything touches the board. No auto-push ever.

## New env var required

Add to `.env.local` and Vercel:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## New files to create

```
app/brief/page.tsx                        ← the page
app/api/brief/chat/route.ts               ← streaming API route
app/api/brief/push/route.ts               ← push approved task to board
components/brief/BriefChat.tsx            ← main chat component
components/brief/BriefCard.tsx            ← rendered brief with approval chips
components/brief/ImageUpload.tsx          ← image attach + paste handler
```

## Do NOT touch

Anything outside the above files. No changes to existing board, tasks, or Hermes API routes.

---

## 8.1 — API Route: `POST /api/brief/chat`

Streaming route. Accepts conversation history + optional images. Calls Anthropic API and streams the response back as SSE.

```typescript
// app/api/brief/chat/route.ts
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const { messages, project } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a technical brief writer embedded in Cwatt-CommandCenter, 
a software project management tool. Your job is to help Colton (a developer/estimator) 
turn rough ideas into structured task briefs for his AI coding agents.

Current project: ${project.name} (repo: ${project.repo_name})

Rules:
- Ask at most ONE clarifying question before writing a brief
- If the request is clear enough, write the brief immediately
- When you write a brief, format it EXACTLY like this, with the markers:

---BRIEF_START---
TITLE: [short task title]
PRIORITY: [low|medium|high|critical]
AGENT: [auto|nexus|claude-code]
TAGS: [comma, separated, tags]
BRIEF:
## Task
[what needs done]

## Expected behavior
[numbered list]

## Files to touch
- [file paths]

## Do NOT touch
[what to leave alone]
---BRIEF_END---

- After writing a brief, ask "Want to change anything, or should I push it?"
- NEVER push to the board yourself — only Colton can approve
- If Colton says "push it" / "looks good" / "yes" / "go" respond ONLY with: APPROVED
- Keep messages short and direct. No padding.
- For image inputs: describe what you see and reference it in the brief`;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content, // supports text + image blocks
    })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 8.2 — API Route: `POST /api/brief/push`

Takes an approved brief object and creates a task in Supabase. Protected by Supabase auth (user must be logged in).

```typescript
// app/api/brief/push/route.ts
// Requires: { title, priority, agent_preference, tags[], brief, project_id }
// Action: INSERT into tasks table, INSERT into activity_log
// Returns: { task_id, task }
// On success: log action "task_created" with actor "Colton"
```

---

## 8.3 — `BriefCard` component

Parses Claude's `---BRIEF_START---...---BRIEF_END---` block and renders it as a styled card with approval chips.

**Props:** `raw: string` (the full brief text block), `onApprove: () => void`, `onDiscard: () => void`

**Parsing:** Extract TITLE, PRIORITY, AGENT, TAGS, and BRIEF from the markers using regex or split. Render BRIEF as markdown using `react-markdown`.

**Card structure:**
- Colored left bar (priority color: critical=red, high=orange, medium=amber, low=slate)
- Title + badges (priority badge, agent badge, tag badges)
- Brief body (monospace, markdown rendered)
- **Approval chips row:**
  - `✓ Push it` — green chip, calls `onApprove()`
  - `✏️ Edit` — amber chip, focuses the textarea with "change the [field]..." prefilled
  - `✕ Discard` — red chip, calls `onDiscard()`
- When stale (after approve or discard): `opacity: 0.4`, `pointer-events: none`

**Approval detection:** The parent `BriefChat` also detects approval phrases in user messages:
```typescript
const APPROVAL_PHRASES = ['push it', 'push', 'yes', 'yeah', 'go', 'looks good', 
  'ship it', 'do it', 'send it', 'approved', '✓', '👍', 'push that'];
const isApproval = (text: string) => 
  APPROVAL_PHRASES.some(p => text.toLowerCase().trim().startsWith(p));
```

When Claude responds with exactly `APPROVED` → trigger the push flow automatically.

---

## 8.4 — `ImageUpload` component

Handles three input methods:
1. **File picker** — `<input type="file" accept="image/*" multiple>`
2. **Clipboard paste** — `onPaste` event on the textarea, detect `image/*` items
3. **Drag and drop** — `onDrop` on the chat area

For each image:
- Show a thumbnail preview strip above the input bar
- Convert to base64 for the API: `reader.readAsDataURL(file)` → strip the `data:image/...;base64,` prefix
- Store as `{ base64: string, mediaType: string, preview: string }[]` in component state
- On send, include in the message as Anthropic image blocks:
```typescript
{
  type: 'image',
  source: { type: 'base64', media_type: file.mediaType, data: file.base64 }
}
```
- Remove button (✕) on each thumbnail
- Max 4 images per message

---

## 8.5 — `BriefChat` main component

**State:**
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const [currentBrief, setCurrentBrief] = useState<ParsedBrief | null>(null);
const [isPushing, setIsPushing] = useState(false);
```

**Initial message on mount:**
```
"What needs built? Describe it or drop a screenshot — 
we'll hash it out before anything touches [Project Name]."
```

**Send flow:**
1. Build user message with text + image blocks
2. Append to messages state
3. Clear input + image previews
4. Call `/api/brief/chat` with full history
5. Stream response, building the assistant message in real-time
6. On stream complete: parse for `---BRIEF_START---` block → set `currentBrief`
7. Parse for `APPROVED` → trigger `handlePush()`
8. Detect user approval phrases → trigger `handlePush()`

**Push flow (`handlePush`):**
1. `setIsPushing(true)`
2. POST to `/api/brief/push` with brief data + project_id
3. On success: show push confirmation message inline
4. Append to messages: "✅ Pushed to [Project] as card #N — Brief Ready. Hermes picks it up on next poll."
5. `setCurrentBrief(null)`
6. Append follow-up: "Anything else for [Project], or want to switch projects?"

**Discard flow:**
1. Mark brief as stale
2. Append message: "Brief discarded."
3. `setCurrentBrief(null)`
4. Append: "No problem — want to approach it differently?"

---

## 8.6 — `/brief` page

```typescript
// app/brief/page.tsx
// - Authenticated (middleware handles redirect)
// - Fetches projects list (useProjects hook)
// - Renders AppShell with BriefChat as main content
// - Project selector in topbar (dropdown, same as mockup)
// - "↺ New" button clears conversation
// - On mobile: full-screen, bottom nav visible
```

**Design matches the mockup exactly:**
- Dark background
- AI bubbles: `bg-card` with `border-b1`, `border-radius: 16px 16px 16px 4px`
- User bubbles: `background: #F97316` (solid orange), white text, `border-radius: 16px 16px 4px 16px`
- Typing indicator: 3 animated dots
- Project pill: amber accent, dropdown with colored dots per project
- Bottom nav on mobile with Brief tab active
- Image thumbnails in a horizontal strip above input

---

## 8.7 — Sidebar + nav update

Add Brief Builder link to `Sidebar.tsx` and `MobileNav.tsx`:
- Icon: ✏️
- Route: `/brief`
- Label: "Brief Builder"

---

# PHASE 9 — Live Pipeline (`/pipeline`)

## What it is

A real-time animated visualization of the agent pipeline. Tasks flow top-to-bottom through nodes (You → Hermes → Router → Nexus/Claude Code → sub-stages → PR Review → Merged). Driven by live Supabase data — not simulated. Uses React Flow for the graph.

---

## Install

```bash
npm install @xyflow/react
```

---

## New files to create

```
app/pipeline/page.tsx                     ← the page
components/pipeline/PipelineView.tsx      ← main React Flow component
components/pipeline/nodes/MainNode.tsx    ← large pipeline node
components/pipeline/nodes/SubNode.tsx     ← small sub-stage node
components/pipeline/nodes/YouNode.tsx     ← top "You" node
components/pipeline/nodes/MergedNode.tsx  ← bottom completion node
components/pipeline/TaskPill.tsx          ← floating task pill overlay
components/pipeline/EventLog.tsx          ← right-side live event log
hooks/usePipelineData.ts                  ← maps Supabase tasks to pipeline positions
```

## Do NOT touch

Existing board, brief, or Hermes API routes. No changes to existing components.

---

## 9.1 — Node definitions

```typescript
// Node IDs and their pipeline positions
const PIPELINE_NODES = [
  // Main flow
  { id: 'you',     type: 'youNode',   position: { x: 350, y: 20  }, data: { label: 'You', sub: 'via Telegram', icon: '📱' } },
  { id: 'hermes',  type: 'mainNode',  position: { x: 350, y: 140 }, data: { label: 'Hermes', sub: 'Orchestrator', icon: '🎯', color: 'amber' } },
  { id: 'router',  type: 'mainNode',  position: { x: 350, y: 260 }, data: { label: 'Task Router', sub: 'Classifier', icon: '⚖️' } },
  
  // Branch hubs
  { id: 'nexus',   type: 'mainNode',  position: { x: 100, y: 390 }, data: { label: 'Nexus', sub: 'Local · Free', icon: '⚡', color: 'cyan' } },
  { id: 'claude',  type: 'mainNode',  position: { x: 600, y: 390 }, data: { label: 'Claude Code', sub: 'Cloud · Billed', icon: '🤖', color: 'amber' } },
  
  // Nexus sub-nodes
  { id: 'n_work',  type: 'subNode',   position: { x: 0,   y: 510 }, data: { label: 'Local Work', sub: 'qwen3-coder', icon: '⚙️', color: 'cyan' } },
  { id: 'n_qa',    type: 'subNode',   position: { x: 120, y: 510 }, data: { label: 'Visual QA', sub: 'qwen2.5vl', icon: '👁️', color: 'cyan' } },
  { id: 'n_mon',   type: 'subNode',   position: { x: 240, y: 510 }, data: { label: 'Monitor', sub: 'Board watch', icon: '📡', color: 'cyan' } },
  
  // Claude sub-nodes
  { id: 'c_pre',   type: 'subNode',   position: { x: 490, y: 510 }, data: { label: 'Preflight', sub: 'Brief enrich', icon: '🔬', color: 'amber' } },
  { id: 'c_work',  type: 'subNode',   position: { x: 610, y: 510 }, data: { label: 'CC Worker', sub: 'Sonnet 4.6', icon: '💻', color: 'amber' } },
  { id: 'c_push',  type: 'subNode',   position: { x: 730, y: 510 }, data: { label: 'Git + PR', sub: 'Auto-push', icon: '🚀', color: 'amber' } },
  
  // Convergence
  { id: 'review',  type: 'mainNode',  position: { x: 350, y: 640 }, data: { label: 'PR Review', sub: 'Awaiting Colton', icon: '👀' } },
  { id: 'merged',  type: 'mergedNode',position: { x: 350, y: 760 }, data: { label: 'Merged ✓', sub: 'Board updated', icon: '✅', color: 'green' } },
];
```

---

## 9.2 — Edge definitions

```typescript
const PIPELINE_EDGES = [
  // Main flow
  { id: 'e-you-hermes',   source: 'you',    target: 'hermes',  animated: true, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 } },
  { id: 'e-hermes-router',source: 'hermes', target: 'router',  animated: true, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 } },
  
  // Branching
  { id: 'e-router-nexus', source: 'router', target: 'nexus',   animated: true, style: { stroke: 'rgba(34,211,238,0.4)', strokeWidth: 2 } },
  { id: 'e-router-claude',source: 'router', target: 'claude',  animated: true, style: { stroke: 'rgba(245,158,11,0.4)', strokeWidth: 2 } },
  
  // Nexus fan
  { id: 'e-nexus-n_work', source: 'nexus',  target: 'n_work',  animated: false, style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  { id: 'e-nexus-n_qa',   source: 'nexus',  target: 'n_qa',    animated: false, style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  { id: 'e-nexus-n_mon',  source: 'nexus',  target: 'n_mon',   animated: false, style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  
  // Claude fan
  { id: 'e-claude-c_pre', source: 'claude', target: 'c_pre',   animated: false, style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  { id: 'e-claude-c_work',source: 'claude', target: 'c_work',  animated: false, style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  { id: 'e-claude-c_push',source: 'claude', target: 'c_push',  animated: false, style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  
  // Converge to review
  { id: 'e-n_work-review', source: 'n_work', target: 'review', animated: false, style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-n_qa-review',   source: 'n_qa',   target: 'review', animated: false, style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-n_mon-review',  source: 'n_mon',  target: 'review', animated: false, style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_pre-review',  source: 'c_pre',  target: 'review', animated: false, style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_work-review', source: 'c_work', target: 'review', animated: false, style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_push-review', source: 'c_push', target: 'review', animated: false, style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  
  // Done
  { id: 'e-review-merged', source: 'review', target: 'merged', animated: true, style: { stroke: 'rgba(16,185,129,0.5)', strokeWidth: 2 } },
];
```

Active edges (when a task is on them) should have `animated: true` and brighter stroke color. Update dynamically based on task positions.

---

## 9.3 — `usePipelineData` hook

Maps live Supabase task data to pipeline node activity.

```typescript
// Returns:
interface PipelineData {
  nodeActivity: Record<string, Task[]>;  // nodeId → tasks currently at that node
  activeEdges: string[];                 // edge IDs currently lit (task in transit)
  recentActivity: ActivityLog[];         // last 20 events for event log
}

// Mapping logic (based on task.status + task.claimed_by + task.agent_type):
// status = 'brief_ready'  AND claimed_by IS NULL  → node: 'you' (waiting)
// status = 'brief_ready'  AND claimed_by IS SET   → node: 'hermes' (being routed)
// status = 'in_progress'  AND agent_type = 'nexus' → node: 'nexus' or sub-node
// status = 'in_progress'  AND agent_type = 'claude-code' → node: 'claude' or sub-node
// status = 'pr_review'    → node: 'review'
// status = 'done'         AND completed_at < 30min ago → node: 'merged' (briefly shown)

// Sub-node assignment (when in_progress):
// Use task.tags to determine sub-node:
//   tags includes 'ui'|'frontend'|'visual' → n_qa or c_push
//   claimed_by starts with 'nexus-worker'  → n_work (default) or n_qa (UI tags)
//   claimed_by starts with 'hermes-worker' → c_pre → c_work → c_push based on time elapsed
```

Subscribe to Supabase Realtime on both `tasks` and `activity_log` tables.

---

## 9.4 — Node components

**`MainNode`** — 150×54px card
- Dark card background (`#131820`)
- 1px border (default: `#283344`, active: color-dependent glow)
- Icon (emoji) + label + subtitle
- Activity badge top-right (count of tasks at this node)
- Active states: cyan glow for Nexus-side, amber for Claude-side, green for merged
- Use `Handle` from `@xyflow/react` for connection points

**`SubNode`** — 110×40px, smaller version of MainNode

**`YouNode`** — special top node, pill shape

**`MergedNode`** — green glow, shows total completed count for session

---

## 9.5 — `TaskPill` floating overlay

Task pills float OVER the React Flow canvas as absolute-positioned DOM elements (not React Flow nodes). They animate between node positions using CSS transitions.

```typescript
// Position each pill at the center of its current node
// Node positions come from React Flow's useNodes() + getBoundingClientRect
// CSS transition: left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s same

interface TaskPillProps {
  task: Task;
  nodeId: string;  // current pipeline node
  color: 'cyan' | 'amber' | 'green';
}
```

---

## 9.6 — `EventLog` component

Right sidebar (260px), scrolling log of recent activity.

- Powered by `recentActivity` from `usePipelineData`
- New events slide in from right, auto-scroll to latest
- Each entry: timestamp (HH:MM), icon by action type, colored task name, project name
- Shows last 50 events
- "Clear" button at top

---

## 9.7 — `/pipeline` page

```typescript
// app/pipeline/page.tsx
// - Authenticated
// - Full-screen layout: pipeline canvas (flex:1) + EventLog (260px right)
// - Header: "⌘ CommandCenter — Live Pipeline" + live badge + session stats
// - ReactFlow canvas: pannable, zoomable, fitView on mount
// - Background: dark dots pattern (ReactFlow Background component with variant='dots')
// - No sidebar (full-screen experience)
// - Mobile: hide EventLog, show pipeline full-width, bottom nav
```

**ReactFlow config:**
```typescript
<ReactFlow
  nodes={nodes}
  edges={computedEdges}
  nodeTypes={nodeTypes}
  fitView
  panOnDrag
  zoomOnScroll
  minZoom={0.5}
  maxZoom={1.5}
  proOptions={{ hideAttribution: true }}
>
  <Background variant="dots" gap={20} size={1} color="rgba(255,255,255,0.04)" />
  <Controls style={{ background: '#131820', border: '1px solid #283344' }} />
</ReactFlow>
```

---

## 9.8 — Sidebar + nav update

Add to `Sidebar.tsx` and `MobileNav.tsx`:
- Icon: ⚡
- Route: `/pipeline`
- Label: "Pipeline"

---

## Install summary

Run before starting Phase 9:
```bash
npm install @xyflow/react
```

Run before starting Phase 8:
```bash
npm install @anthropic-ai/sdk
```

---

## Phase completion checklist

### Phase 8 done when:
- [ ] `/brief` page loads, shows greeting message
- [ ] Typing a task description and sending gets a response from Claude API
- [ ] Dropping/pasting an image sends it to Claude and gets a vision-aware response
- [ ] Claude writes a brief in the correct format and it renders as a BriefCard
- [ ] Clicking "✓ Push it" creates a real task in Supabase and confirms in chat
- [ ] Saying "push it" in the chat also triggers the push
- [ ] "✕ Discard" removes the brief card
- [ ] Project switcher changes which board tasks are pushed to
- [ ] Mobile: full-screen, orange user bubbles, input bar visible above bottom nav

### Phase 9 done when:
- [ ] `/pipeline` loads with all nodes and edges rendered
- [ ] Tasks in `in_progress` in Supabase show as active pills on the correct nodes
- [ ] Nodes glow when tasks are at them
- [ ] Branch edges light up for Nexus vs Claude Code paths
- [ ] Realtime: moving a task card on the board moves its pill on the pipeline
- [ ] Event log streams live activity from activity_log table
- [ ] Session stats (completed, in-flight) update in real time
- [ ] Panning and zooming work on desktop
- [ ] Mobile: pipeline scrollable, event log hidden

---

## Notes

- Phase 8 requires `ANTHROPIC_API_KEY` in Vercel env vars before deploying
- Phase 9 requires `@xyflow/react` — ensure it's in package.json before building
- Both phases are independent — can be built in either order
- The Brief Builder mockup is at `/home/cwatt250/Dev/cwatt-commandcenter/MOCKUPS/brief-chat.html` for visual reference
- The Pipeline mockup is at `/home/cwatt250/Dev/cwatt-commandcenter/MOCKUPS/pipeline-live.html` for visual reference
