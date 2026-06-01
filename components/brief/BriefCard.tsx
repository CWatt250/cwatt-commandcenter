'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_COLORS } from '@/types';
import type { TaskPriority } from '@/types';

export interface ParsedBrief {
  title: string;
  priority: TaskPriority;
  agent: string;
  tags: string[];
  brief: string;
  /** The full raw text block, kept so it can be re-sent or re-parsed. */
  raw: string;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

/**
 * Parse Claude's `---BRIEF_START--- ... ---BRIEF_END---` block. Returns null if
 * the markers aren't present, so callers can treat ordinary chat text as-is.
 */
export function parseBrief(text: string): ParsedBrief | null {
  const match = text.match(/---BRIEF_START---([\s\S]*?)---BRIEF_END---/);
  if (!match) return null;

  const body = match[1];
  const field = (name: string) => {
    const m = body.match(new RegExp(`^\\s*${name}:\\s*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
  };

  const rawPriority = field('PRIORITY').toLowerCase();
  const priority = (PRIORITIES as string[]).includes(rawPriority)
    ? (rawPriority as TaskPriority)
    : 'medium';

  // Everything after the `BRIEF:` label is the markdown body.
  const briefMatch = body.match(/^\s*BRIEF:\s*([\s\S]*)$/m);
  const brief = briefMatch ? briefMatch[1].trim() : '';

  return {
    title: field('TITLE') || 'Untitled task',
    priority,
    agent: field('AGENT') || 'auto',
    tags: field('TAGS')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    brief,
    raw: match[0],
  };
}

export function BriefCard({
  parsed,
  stale = false,
  onApprove,
  onDiscard,
  onEdit,
}: {
  parsed: ParsedBrief;
  stale?: boolean;
  onApprove: () => void;
  onDiscard: () => void;
  onEdit?: (field: string) => void;
}) {
  const accent = PRIORITY_COLORS[parsed.priority];

  return (
    <div
      className={cn(
        'mt-2 flex overflow-hidden rounded-xl border border-border bg-elevated transition-opacity',
        stale && 'pointer-events-none opacity-40'
      )}
    >
      {/* Priority bar */}
      <div
        className={cn(
          'w-1 flex-shrink-0',
          parsed.priority === 'critical' && 'animate-pulse'
        )}
        style={{ backgroundColor: accent }}
      />

      <div className="min-w-0 flex-1 p-4">
        {/* Title + badges */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-sm text-foreground">
            {parsed.title}
          </h3>
          <Badge color={accent}>{parsed.priority}</Badge>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            {parsed.agent}
          </span>
          {parsed.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>

        {/* Brief body */}
        {parsed.brief && (
          <article className="prose prose-invert prose-sm mt-3 max-w-none font-mono prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-code:text-amber prose-a:text-blue">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {parsed.brief}
            </ReactMarkdown>
          </article>
        )}

        {/* Approval chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip
            onClick={onApprove}
            className="bg-green/15 text-green hover:bg-green/25"
            icon={<Check className="h-3.5 w-3.5" />}
            label="Push it"
          />
          <Chip
            onClick={() => onEdit?.('the title')}
            className="bg-amber/15 text-amber hover:bg-amber/25"
            icon={<Pencil className="h-3.5 w-3.5" />}
            label="Edit"
          />
          <Chip
            onClick={onDiscard}
            className="bg-red/15 text-red hover:bg-red/25"
            icon={<X className="h-3.5 w-3.5" />}
            label="Discard"
          />
        </div>
      </div>
    </div>
  );
}

function Badge({ children, color }: { children: string; color: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  );
}

function Chip({
  onClick,
  className,
  icon,
  label,
}: {
  onClick: () => void;
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        className
      )}
    >
      {icon}
      {label}
    </button>
  );
}
