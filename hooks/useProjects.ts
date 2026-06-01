'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';
import type { Project } from '@/types';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('archived', false)
        .order('sort_order', { ascending: true });

      if (!mounted) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setProjects((data ?? []) as Project[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`projects-changes-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects((prev) =>
              [...prev, payload.new as Project].sort(
                (a, b) => a.sort_order - b.sort_order
              )
            );
          } else if (payload.eventType === 'UPDATE') {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === (payload.new as Project).id ? (payload.new as Project) : p
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setProjects((prev) =>
              prev.filter((p) => p.id !== (payload.old as Project).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { projects, loading, error };
}
