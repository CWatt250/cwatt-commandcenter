'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';

export type ActiveAgent = {
  task_id: string;
  task_title: string;
  agent: string;
  project_id: string;
};

export function useActiveAgents() {
  const [agents, setAgents] = useState<ActiveAgent[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, claimed_by, project_id, status')
        .not('claimed_by', 'is', null)
        .eq('status', 'in_progress');

      if (!mounted || !data) return;

      setAgents(
        data.map((t) => ({
          task_id: t.id,
          task_title: t.title,
          agent: t.claimed_by,
          project_id: t.project_id,
        }))
      );
    }

    load();

    const channel = supabase
      .channel(`active-agents-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => load()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return agents;
}
