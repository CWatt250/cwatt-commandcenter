'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { createClient } from '@/lib/supabase/client';
import { useTasks } from '@/hooks/useTasks';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { KANBAN_COLUMNS } from '@/types';
import type { Task, TaskStatus } from '@/types';

export function KanbanBoard({
  projectId,
  onAddTask,
}: {
  projectId: string;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { tasks, tasksByStatus, setTasks, loading } = useTasks(projectId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onDragStart(event: DragStartEvent) {
    const t = tasks.find((x) => x.id === event.active.id);
    if (t) setActiveTask(t);
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    if (task.claimed_by) return; // locked

    const overId = String(over.id);
    if (!overId.startsWith('column:')) return;
    const targetStatus = overId.slice('column:'.length) as TaskStatus;
    if (task.status === targetStatus) return;

    // Compute new sort_order: max in target column + 1
    const targetTasks = tasksByStatus[targetStatus];
    const newSortOrder =
      targetTasks.length === 0
        ? 0
        : Math.max(...targetTasks.map((t) => t.sort_order)) + 1;

    const previous = tasks;
    const optimistic = tasks.map((t) =>
      t.id === task.id
        ? { ...t, status: targetStatus, sort_order: newSortOrder }
        : t
    );
    setTasks(optimistic);

    const supabase = createClient();
    const updates: Partial<Task> = {
      status: targetStatus,
      sort_order: newSortOrder,
    };
    if (targetStatus === 'done') {
      (updates as Record<string, unknown>).completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task.id);

    if (error) {
      setTasks(previous);
      return;
    }

    await supabase.from('activity_log').insert({
      project_id: task.project_id,
      task_id: task.id,
      actor: 'Colton',
      action: 'status_updated',
      details: { from: task.status, to: targetStatus, via: 'drag' },
    });
  }

  if (loading) {
    return (
      <div className="flex h-full gap-3 overflow-x-auto p-4 md:p-6">
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col.id}
            className="h-full min-w-[280px] flex-shrink-0 animate-pulse rounded-lg bg-accent/20"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className="flex h-full gap-3 overflow-x-auto p-4 md:p-6"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              status={col.id}
              label={col.label}
              description={col.description}
              tasks={tasksByStatus[col.id]}
              onAddTask={onAddTask}
              onCardClick={setOpenTask}
              isDragActive={Boolean(activeTask)}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="rotate-1 opacity-90">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailModal
        task={openTask}
        open={Boolean(openTask)}
        onOpenChange={(o) => !o && setOpenTask(null)}
      />
    </>
  );
}
