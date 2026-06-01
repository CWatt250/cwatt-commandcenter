'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/utils';
import { useActivityLog, type EnrichedActivity } from '@/hooks/useActivityLog';
import type { Task } from '@/types';

export type PillColor = 'cyan' | 'amber' | 'green';

export interface PipelineStats {
  waiting: number;
  inFlight: number;
  review: number;
  completed: number;
}

export interface PipelineData {
  nodeActivity: Record<string, Task[]>;
  activeEdges: string[];
  recentActivity: EnrichedActivity[];
  stats: PipelineStats;
  loading: boolean;
}

const UI_TAGS = ['ui', 'frontend', 'visual'];
const NEXUS_NODES = ['nexus', 'n_work', 'n_qa', 'n_mon'];
const CLAUDE_NODES = ['claude', 'c_pre', 'c_work', 'c_push'];

function hasUiTag(t: Task): boolean {
  return (t.tags ?? []).some((tag) => UI_TAGS.includes(tag.toLowerCase()));
}

/**
 * The tasks table has no agent_type column, so infer the routing side from the
 * worker that claimed it (`nexus-worker-*` / `hermes-worker-*`) and fall back to
 * the `agent:*` tag the Brief Builder writes.
 */
function agentSide(t: Task): 'nexus' | 'claude' {
  const cb = (t.claimed_by ?? '').toLowerCase();
  if (cb.startsWith('nexus')) return 'nexus';
  if (cb.startsWith('hermes') || cb.startsWith('claude')) return 'claude';
  if ((t.tags ?? []).includes('agent:nexus')) return 'nexus';
  return 'claude';
}

/** Which pipeline node a task currently sits on, or null if it shouldn't show. */
function nodeForTask(t: Task, now: number): string | null {
  switch (t.status) {
    case 'brief_ready':
      return t.claimed_by ? 'hermes' : 'you';
    case 'in_progress': {
      if (agentSide(t) === 'nexus') return hasUiTag(t) ? 'n_qa' : 'n_work';
      if (hasUiTag(t)) return 'c_push';
      // Claude path advances Preflight → Worker → Git+PR over time.
      const elapsed = t.claimed_at
        ? now - new Date(t.claimed_at).getTime()
        : 0;
      if (elapsed < 90_000) return 'c_pre';
      if (elapsed < 300_000) return 'c_work';
      return 'c_push';
    }
    case 'pr_review':
      return 'review';
    case 'done':
      return t.completed_at &&
        now - new Date(t.completed_at).getTime() < 30 * 60_000
        ? 'merged'
        : null;
    default:
      return null;
  }
}

export function colorForNode(nodeId: string): PillColor {
  if (nodeId === 'merged') return 'green';
  if (nodeId === 'nexus' || nodeId.startsWith('n_')) return 'cyan';
  return 'amber';
}

function computeActiveEdges(occupied: (id: string) => boolean): string[] {
  const active = new Set<string>();
  const anyNexus = NEXUS_NODES.some(occupied);
  const anyClaude = CLAUDE_NODES.some(occupied);

  if (anyNexus) active.add('e-router-nexus');
  if (anyClaude) active.add('e-router-claude');

  const fan: [string, string][] = [
    ['n_work', 'e-nexus-n_work'],
    ['n_qa', 'e-nexus-n_qa'],
    ['n_mon', 'e-nexus-n_mon'],
    ['c_pre', 'e-claude-c_pre'],
    ['c_work', 'e-claude-c_work'],
    ['c_push', 'e-claude-c_push'],
  ];
  const converge: [string, string][] = [
    ['n_work', 'e-n_work-review'],
    ['n_qa', 'e-n_qa-review'],
    ['n_mon', 'e-n_mon-review'],
    ['c_pre', 'e-c_pre-review'],
    ['c_work', 'e-c_work-review'],
    ['c_push', 'e-c_push-review'],
  ];
  for (const [n, e] of fan) if (occupied(n)) active.add(e);
  for (const [n, e] of converge) if (occupied(n)) active.add(e);

  if (occupied('merged')) active.add('e-review-merged');

  // Light the top spine whenever anything is in motion downstream.
  if (anyNexus || anyClaude || occupied('router') || occupied('hermes')) {
    active.add('e-you-hermes');
    active.add('e-hermes-router');
  }
  return [...active];
}

export function usePipelineData(): PipelineData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // Ticks every 15s so time-based Claude sub-stage progression stays live.
  const [tick, setTick] = useState(0);
  const { events: recentActivity } = useActivityLog();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(300);
      if (!mounted) return;
      setTasks((data ?? []) as Task[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`pipeline-tasks-${crypto.randomUUID()}`)
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

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const { nodeActivity, activeEdges, stats } = useMemo(() => {
    const now = Date.now();
    const activity: Record<string, Task[]> = {};
    for (const t of tasks) {
      const node = nodeForTask(t, now);
      if (!node) continue;
      (activity[node] ??= []).push(t);
    }
    const occupied = (id: string) => (activity[id]?.length ?? 0) > 0;
    const count = (ids: string[]) =>
      ids.reduce((n, id) => n + (activity[id]?.length ?? 0), 0);

    return {
      nodeActivity: activity,
      activeEdges: computeActiveEdges(occupied),
      stats: {
        waiting: count(['you', 'hermes']),
        inFlight: count([...NEXUS_NODES, ...CLAUDE_NODES]),
        review: count(['review']),
        completed: count(['merged']),
      },
    };
    // tick drives time-based re-evaluation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, tick]);

  return { nodeActivity, activeEdges, recentActivity, stats, loading };
}
