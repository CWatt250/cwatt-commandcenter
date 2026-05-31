'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';
import { KANBAN_COLUMNS } from '@/types';

export type TasksByStatus = Record<TaskStatus, Task[]>;

function emptyGroups(): TasksByStatus {
  return KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = [];
    return acc;
  }, {} as TasksByStatus);
}

function groupTasks(tasks: Task[]): TasksByStatus {
  const groups = emptyGroups();
  for (const t of tasks) {
    if (groups[t.status]) groups[t.status].push(t);
  }
  for (const key of Object.keys(groups) as TaskStatus[]) {
    groups[key].sort((a, b) => a.sort_order - b.sort_order);
  }
  return groups;
}

export function useTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setTasks((data ?? []) as Task[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [...prev, payload.new as Task]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === (payload.new as Task).id ? (payload.new as Task) : t
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) =>
              prev.filter((t) => t.id !== (payload.old as Task).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    tasks,
    tasksByStatus: groupTasks(tasks),
    setTasks,
    loading,
    error,
  };
}
