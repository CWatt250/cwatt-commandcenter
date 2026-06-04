'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import { BriefCard, parseBrief, type ParsedBrief } from './BriefCard';
import {
  ImageUpload,
  readImageFile,
  MAX_IMAGES,
  type PendingImage,
} from './ImageUpload';

type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    };

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** User turns carry blocks (text + images); also used for the API request. */
  blocks?: ContentBlock[];
  /** Assistant/local turns carry plain text. */
  text?: string;
  /** Display-only (greeting, confirmations) — not sent to the model. */
  local?: boolean;
  brief?: ParsedBrief | null;
  briefState?: 'active' | 'pushed' | 'discarded';
}

const APPROVAL_PHRASES = [
  'push it',
  'push',
  'yes',
  'yeah',
  'go',
  'looks good',
  'ship it',
  'do it',
  'send it',
  'approved',
  '✓',
  '👍',
  'push that',
];

const isApproval = (text: string) =>
  APPROVAL_PHRASES.some((p) => text.toLowerCase().trim().startsWith(p));

const uid = () => crypto.randomUUID();

export function BriefChat({ project }: { project: Project }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // The brief that the chips currently act on. Held in a ref so the streaming
  // and push closures always see the latest value.
  const activeBriefRef = useRef<{ id: string; parsed: ParsedBrief } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Greeting on mount (the page remounts this component per project / "New").
  useEffect(() => {
    setMessages([
      {
        id: uid(),
        role: 'assistant',
        local: true,
        text: `What needs built? Describe it or drop a screenshot — we'll hash it out before anything touches ${project.name}.`,
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const addLocal = (text: string) =>
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'assistant', local: true, text },
    ]);

  async function addImages(files: File[]) {
    const room = MAX_IMAGES - pendingImages.length;
    const accepted = files
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, room));
    if (accepted.length === 0) return;
    const read = await Promise.all(accepted.map(readImageFile));
    setPendingImages((prev) => [...prev, ...read].slice(0, MAX_IMAGES));
  }

  async function handlePush() {
    const active = activeBriefRef.current;
    if (!active || isPushing) return;
    const { id, parsed } = active;
    setIsPushing(true);
    try {
      const res = await fetch('/api/brief/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parsed.title,
          priority: parsed.priority,
          agent_preference: parsed.agent,
          tags: parsed.tags,
          brief: parsed.brief,
          project_id: project.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Push failed.');

      activeBriefRef.current = null;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, briefState: 'pushed' } : m))
      );
      addLocal(
        `✅ Pushed to ${project.name} — “${parsed.title}” is in Brief Ready. Hermes picks it up on next poll.`
      );
      addLocal(`Anything else for ${project.name}, or want to switch projects?`);
    } catch (err) {
      addLocal(
        `⚠️ Couldn't push: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    } finally {
      setIsPushing(false);
    }
  }

  function handleDiscard() {
    const active = activeBriefRef.current;
    if (!active) return;
    activeBriefRef.current = null;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === active.id ? { ...m, briefState: 'discarded' } : m
      )
    );
    addLocal('Brief discarded.');
    addLocal('No problem — want to approach it differently?');
  }

  async function streamReply(history: ChatMessage[]) {
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', text: '' },
    ]);
    setIsStreaming(true);

    const apiMessages = history
      .filter((m) => !m.local)
      .map((m) => ({
        role: m.role,
        content: m.role === 'user' ? (m.blocks ?? []) : (m.text ?? ''),
      }));

    const update = (text: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text } : m))
      );

    let acc = '';
    try {
      const res = await fetch('/api/brief/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          project: { id: project.id, name: project.name, repo_name: project.repo_name },
        }),
      });

      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg.error ?? `Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.error) {
              acc += `\n\n⚠️ ${obj.error}`;
            } else if (obj.text) {
              acc += obj.text;
            }
            update(acc);
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    } catch (err) {
      acc += `\n\n⚠️ ${err instanceof Error ? err.message : 'Stream failed.'}`;
      update(acc);
    }

    setIsStreaming(false);

    const full = acc.trim();
    if (full === 'APPROVED' && activeBriefRef.current) {
      // Claude signalled approval — drop the bare "APPROVED" turn and push.
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      await handlePush();
      return;
    }

    const parsed = parseBrief(acc);
    if (parsed) {
      activeBriefRef.current = { id: assistantId, parsed };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, brief: parsed, briefState: 'active' }
            : m
        )
      );
    }
  }

  async function handleSend(textArg?: string) {
    const text = (textArg ?? input).trim();
    if ((!text && pendingImages.length === 0) || isStreaming || isPushing) {
      return;
    }

    const blocks: ContentBlock[] = pendingImages.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    }));
    if (text) blocks.push({ type: 'text', text });

    const userMsg: ChatMessage = { id: uid(), role: 'user', blocks, text };

    // Plain-text approval with an active brief → push directly, no model call.
    if (activeBriefRef.current && pendingImages.length === 0 && isApproval(text)) {
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      void handlePush();
      return;
    }

    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setPendingImages([]);
    await streamReply(history);
  }

  function handleEdit(field: string) {
    setInput(`Change ${field}: `);
    textareaRef.current?.focus();
  }

  return (
    <div
      className="flex h-full flex-col"
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void addImages(Array.from(e.dataTransfer.files));
        }
      }}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) => {
            const streamingEmpty =
              m.role === 'assistant' &&
              !m.local &&
              !m.text &&
              isStreaming;
            return (
              <MessageRow key={m.id} role={m.role}>
                {m.role === 'user' ? (
                  <UserBubble msg={m} />
                ) : streamingEmpty ? (
                  <TypingDots />
                ) : (
                  <AssistantBubble
                    msg={m}
                    onApprove={handlePush}
                    onDiscard={handleDiscard}
                    onEdit={handleEdit}
                  />
                )}
              </MessageRow>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-surface px-4 py-3 md:px-8">
        <div className="mx-auto max-w-2xl">
          <ImageUpload
            images={pendingImages}
            onAddFiles={addImages}
            onRemove={(id) =>
              setPendingImages((prev) => prev.filter((p) => p.id !== id))
            }
            disabled={isStreaming || isPushing}
          />
          <div className="mt-1 flex items-end gap-2 rounded-xl border border-border bg-card p-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              onPaste={(e) => {
                const imgs = Array.from(e.clipboardData.items)
                  .filter((it) => it.type.startsWith('image/'))
                  .map((it) => it.getAsFile())
                  .filter((f): f is File => !!f);
                if (imgs.length) {
                  e.preventDefault();
                  void addImages(imgs);
                }
              }}
              rows={1}
              placeholder={`Describe a task for ${project.name}…`}
              disabled={isStreaming || isPushing}
              className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-faint focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={
                isStreaming ||
                isPushing ||
                (!input.trim() && pendingImages.length === 0)
              }
              className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-amber text-[#0A0C10] transition-opacity hover:opacity-90 disabled:opacity-30"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {isPushing && (
            <p className="mt-2 text-center text-xs text-faint">
              Pushing to board…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[85%]">{children}</div>
    </div>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  const images = (msg.blocks ?? []).filter(
    (b): b is Extract<ContentBlock, { type: 'image' }> => b.type === 'image'
  );
  return (
    <div className="rounded-[16px_16px_4px_16px] bg-orange px-4 py-2.5 text-sm text-white">
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative h-20 w-20 overflow-hidden rounded-md"
            >
              <Image
                src={`data:${img.source.media_type};base64,${img.source.data}`}
                alt="attachment"
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}
      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
    </div>
  );
}

function AssistantBubble({
  msg,
  onApprove,
  onDiscard,
  onEdit,
}: {
  msg: ChatMessage;
  onApprove: () => void;
  onDiscard: () => void;
  onEdit: (field: string) => void;
}) {
  // When a brief is present, show only the prose around it; the card renders the brief.
  const displayText = msg.brief
    ? (msg.text ?? '').replace(msg.brief.raw, '').trim()
    : (msg.text ?? '');

  return (
    <div>
      {displayText && (
        <div className="rounded-[16px_16px_16px_4px] border border-border bg-card px-4 py-2.5 text-sm text-foreground">
          <article className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:text-foreground prose-headings:text-foreground prose-code:text-amber prose-a:text-blue">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayText}
            </ReactMarkdown>
          </article>
        </div>
      )}
      {msg.brief && (
        <BriefCard
          parsed={msg.brief}
          stale={msg.briefState !== 'active'}
          onApprove={onApprove}
          onDiscard={onDiscard}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="inline-flex items-center gap-1 rounded-[16px_16px_16px_4px] border border-border bg-card px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
