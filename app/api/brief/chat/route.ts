import Anthropic from '@anthropic-ai/sdk';

// Streaming brief-writer chat. Accepts the full conversation (text + base64
// image blocks) and streams Claude's reply back as Server-Sent Events.
// Auth is enforced by the proxy middleware (everything except /api/hermes is
// behind Supabase auth), so an unauthenticated browser never reaches here.

export const runtime = 'nodejs';

interface BriefProject {
  name: string;
  repo_name: string | null;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
      { status: 503 }
    );
  }

  let messages: Anthropic.MessageParam[];
  let project: BriefProject;
  try {
    const body = await req.json();
    messages = body.messages;
    project = body.project;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages is required.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a technical brief writer embedded in Cwatt-CommandCenter,
a software project management tool. Your job is to help Colton (a developer/estimator)
turn rough ideas into structured task briefs for his AI coding agents.

Current project: ${project?.name ?? 'Unknown'} (repo: ${project?.repo_name ?? 'n/a'})

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

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          // Spec called for claude-sonnet-4-5; using the current Sonnet ID.
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          // Large, static prefix — cache it so repeated turns don't re-bill it.
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              )
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Claude API error (${err.status}): ${err.message}`
            : err instanceof Error
              ? err.message
              : 'Unknown error while streaming.';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
