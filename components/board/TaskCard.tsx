'use client';

import { useDraggable } from '@dnd-kit/core';
import { ExternalLink, GripVertical } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';
import { PRIORITY_COLORS } from '@/types';
import type { Task } from '@/types';

export function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: (task: Task) => void;
}) {
  const isLocked = Boolean(task.claimed_by);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isLocked,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(1.02)`,
        zIndex: 50,
      }
    : undefined;

  const priorityColor = PRIORITY_COLORS[task.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-md border bg-card p-3 transition-shadow',
        'border-border hover:border-accent hover:bg-accent',
        isDragging && 'shadow-lg ring-1 ring-amber',
        isLocked && 'animate-claimed-glow'
      )}
      onClick={(e) => {
        // Don't open detail if a drag just happened
        if (isDragging) return;
        // Ignore clicks on the PR link / drag handle
        const target = e.target as HTMLElement;
        if (target.closest('[data-no-card-click="true"]')) return;
        onClick(task);
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-md"
        style={{ backgroundColor: isLocked ? '#F59E0B' : priorityColor }}
        aria-hidden
      />

      {isLocked && (
        <span
          className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber animate-pulse-amber"
          aria-label="Claimed"
        />
      )}

      <div className="flex items-start gap-2 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide"
              style={{
                backgroundColor: priorityColor + '22',
                color: priorityColor,
              }}
            >
              {task.priority}
            </span>
            {task.tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <h3 className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
            {task.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-faint font-mono">
              {isLocked ? task.claimed_by : formatRelative(task.created_at)}
            </span>
            {task.pr_url && (
              <a
                href={task.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                data-no-card-click="true"
                className="inline-flex items-center gap-0.5 rounded bg-purple/15 px-1.5 py-0.5 text-purple hover:bg-purple/25"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                PR #{task.pr_number ?? '?'}
              </a>
            )}
          </div>
        </div>

        {!isLocked && (
          <button
            {...attributes}
            {...listeners}
            type="button"
            data-no-card-click="true"
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag task"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
