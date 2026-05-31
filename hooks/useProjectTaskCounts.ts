'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';
import type { TaskStatus } from '@/types';

export type TaskCountsByProject = Record<
  string,
  Record<TaskStatus, number> & { total: number; open: number }
>;

export function useProjectTaskCounts() {
  const [counts, setCounts] = useState<TaskCountsByProject>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('tasks')
        .select('project_id, status');

      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }
      const next: TaskCountsByProject = {};
      for (const row of data ?? []) {
        const pid = (row as { project_id: string }).project_id;
        const status = (row as { status: TaskStatus }).status;
        if (!next[pid]) {
          next[pid] = {
            brief_ready: 0,
            in_progress: 0,
            pr_review: 0,
            done: 0,
            total: 0,
            open: 0,
          };
        }
        next[pid][status] += 1;
        next[pid].total += 1;
        if (status !== 'done') next[pid].open += 1;
      }
      setCounts(next);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('task-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { counts, loading };
}
