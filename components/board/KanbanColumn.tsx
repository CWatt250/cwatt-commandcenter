'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { STATUS_COLORS } from '@/types';
import type { Task, TaskStatus } from '@/types';

export function KanbanColumn({
  status,
  label,
  description,
  tasks,
  onAddTask,
  onCardClick,
  isDragActive,
}: {
  status: TaskStatus;
  label: string;
  description: string;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onCardClick: (task: Task) => void;
  isDragActive?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });

  const color = STATUS_COLORS[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full min-w-[280px] flex-shrink-0 flex-col rounded-lg border bg-surface/50 transition-colors',
        'snap-start',
        isOver ? 'border-amber bg-amber/5' : 'border-border'
      )}
      style={{ scrollSnapAlign: 'start' }}
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <h2 className="truncate text-sm font-medium text-foreground">{label}</h2>
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddTask(status)}
          aria-label="Add task"
          className="flex h-6 w-6 items-center justify-center rounded text-faint hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.length === 0 ? (
          <div
            className={cn(
              'flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-faint',
              isOver
                ? 'border-amber text-amber'
                : 'border-border'
            )}
          >
            {isDragActive ? 'Drop here' : description}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}
