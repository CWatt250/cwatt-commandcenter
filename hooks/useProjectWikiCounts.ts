'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';

// Number of wiki (memory) entries per project id, kept live so the 🧠 badge on
// /projects and the sidebar reflects new entries the moment an agent writes one.
export function useProjectWikiCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
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
        .from('project_wiki')
        .select('project_id');

      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }
      const next: Record<string, number> = {};
      for (const row of data ?? []) {
        const pid = (row as { project_id: string }).project_id;
        next[pid] = (next[pid] ?? 0) + 1;
      }
      setCounts(next);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`wiki-counts-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_wiki' },
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
