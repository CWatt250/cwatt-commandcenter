'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';
import type { ActivityLog } from '@/types';

const PAGE_SIZE = 50;

export type EnrichedActivity = ActivityLog & {
  project_name: string | null;
  project_slug: string | null;
  project_color: string | null;
  project_icon: string | null;
  task_title: string | null;
};

export function useActivityLog(projectId?: string | null) {
  const [events, setEvents] = useState<EnrichedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('activity_log')
        .select(
          `*, project:projects ( name, slug, color, icon ), task:tasks ( title )`
        )
        .order('created_at', { ascending: false })
        .range(from, to);

      if (projectId) query = query.eq('project_id', projectId);

      const { data, error } = await query;
      if (error) {
        setLoading(false);
        return;
      }

      type Row = ActivityLog & {
        project: { name: string; slug: string; color: string; icon: string } | null;
        task: { title: string } | null;
      };

      const enriched = (data as unknown as Row[]).map((r) => ({
        id: r.id,
        project_id: r.project_id,
        task_id: r.task_id,
        actor: r.actor,
        action: r.action,
        details: r.details,
        created_at: r.created_at,
        project_name: r.project?.name ?? null,
        project_slug: r.project?.slug ?? null,
        project_color: r.project?.color ?? null,
        project_icon: r.project?.icon ?? null,
        task_title: r.task?.title ?? null,
      }));

      setEvents((prev) => (replace ? enriched : [...prev, ...enriched]));
      setHasMore(enriched.length === PAGE_SIZE);
      setLoading(false);
    },
    [projectId]
  );

  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchPage(0, true);
  }, [fetchPage]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`activity-log-stream-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        async (payload) => {
          const row = payload.new as ActivityLog;
          if (projectId && row.project_id !== projectId) return;

          type ProjectMeta = {
            name: string;
            slug: string;
            color: string;
            icon: string;
          };
          let projectMeta: ProjectMeta | null = null;
          if (row.project_id) {
            const { data } = await supabase
              .from('projects')
              .select('name, slug, color, icon')
              .eq('id', row.project_id)
              .maybeSingle();
            projectMeta = (data as ProjectMeta | null) ?? null;
          }
          let taskTitle: string | null = null;
          if (row.task_id) {
            const { data } = await supabase
              .from('tasks')
              .select('title')
              .eq('id', row.task_id)
              .maybeSingle();
            taskTitle = (data as { title: string } | null)?.title ?? null;
          }

          setEvents((prev) => [
            {
              ...row,
              project_name: projectMeta?.name ?? null,
              project_slug: projectMeta?.slug ?? null,
              project_color: projectMeta?.color ?? null,
              project_icon: projectMeta?.icon ?? null,
              task_title: taskTitle,
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPage(next, false);
  }

  return { events, loading, hasMore, loadMore };
}
