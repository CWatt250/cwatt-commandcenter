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
  /** Brightest edges — the hop each task is currently traversing. */
  activeEdges: string[];
  /** Dimmer edges — the route already travelled behind the active hop. */
  traveledEdges: string[];
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
      // Claude path reflects real task data, not a timer: the pill only moves
      // when Supabase fields actually change.
      if (t.pr_url) return 'c_push'; // Git + PR — a PR exists
      if (t.branch_name) return 'c_work'; // CC Worker — branch pushed
      return 'c_pre'; // Preflight — claimed, no branch yet
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

// Ordered sub-node lanes. A task moves through these stages over time, so the
// edge feeding the current stage is the "active" hop and the earlier stages'
// edges are "travelled" — this is what lets the dashed line trace the route
// sequentially instead of jumping from one branch to the next.
const CLAUDE_LANE = ['c_pre', 'c_work', 'c_push'];

/**
 * The edges a single task has lit up: `active` is the one hop it is currently
 * traversing (rendered brightest), `traveled` is everything behind it on the
 * path it took (rendered dimmer). Returns nulls/empties for tasks not on the
 * board.
 */
function routeForTask(
  node: string,
  side: 'nexus' | 'claude'
): { active: string | null; traveled: string[] } {
  if (node === 'you') return { active: null, traveled: [] };

  const spine = ['e-you-hermes', 'e-hermes-router'];
  const routerEdge = side === 'nexus' ? 'e-router-nexus' : 'e-router-claude';

  if (node === 'hermes') return { active: 'e-you-hermes', traveled: [] };
  if (node === 'router')
    return { active: 'e-hermes-router', traveled: ['e-you-hermes'] };
  if (node === 'review')
    return { active: routerEdge, traveled: spine };
  if (node === 'merged')
    return { active: 'e-review-merged', traveled: [...spine, routerEdge] };

  // Sub-node lanes.
  const traveled = [...spine, routerEdge];

  if (side === 'claude') {
    const idx = Math.max(0, CLAUDE_LANE.indexOf(node));
    // Light each fan edge up to (but not including) the current stage dimly,
    // so the path traced so far stays visible.
    for (let i = 0; i < idx; i++) traveled.push(`e-claude-${CLAUDE_LANE[i]}`);
    // The converge edge shows where the current hop is heading.
    traveled.push(`e-${node}-review`);
    return { active: `e-claude-${node}`, traveled };
  }

  // Nexus side: a task sits on a single sub-node (n_work / n_qa / n_mon).
  traveled.push(`e-${node}-review`);
  return { active: `e-nexus-${node}`, traveled };
}

export function usePipelineData(): PipelineData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { events: recentActivity } = useActivityLog();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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

    // (Re)establish the realtime channel. Mobile Safari aggressively kills the
    // websocket when the tab is backgrounded, so we tear down any stale channel
    // and resubscribe whenever the socket errors, times out, or closes.
    function subscribe() {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      channel = supabase
        .channel(`pipeline-tasks-${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks' },
          () => load()
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Pull fresh state on every successful (re)connect.
            load();
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            if (mounted && !reconnectTimer) {
              reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (mounted) subscribe();
              }, 2_000);
            }
          }
        });
    }

    load();
    subscribe();

    // 15s polling fallback — keeps the board fresh on mobile even if the
    // websocket has silently dropped. Skipped while the tab is hidden.
    const pollId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, 15_000);

    // When the tab returns to the foreground (or the network comes back),
    // force an immediate reload and re-establish realtime.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
        subscribe();
      }
    };
    const onOnline = () => {
      load();
      subscribe();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const { nodeActivity, activeEdges, traveledEdges, stats } = useMemo(() => {
    const now = Date.now();
    const activity: Record<string, Task[]> = {};
    const activeSet = new Set<string>();
    const traveledSet = new Set<string>();

    for (const t of tasks) {
      const node = nodeForTask(t, now);
      if (!node) continue;
      (activity[node] ??= []).push(t);

      const { active, traveled } = routeForTask(node, agentSide(t));
      if (active) activeSet.add(active);
      for (const e of traveled) traveledSet.add(e);
    }
    // A bright (active) hop for one task always wins over a dim (travelled)
    // segment from another, so never render the same edge in both tiers.
    for (const e of activeSet) traveledSet.delete(e);

    const count = (ids: string[]) =>
      ids.reduce((n, id) => n + (activity[id]?.length ?? 0), 0);

    return {
      nodeActivity: activity,
      activeEdges: [...activeSet],
      traveledEdges: [...traveledSet],
      stats: {
        waiting: count(['you', 'hermes']),
        inFlight: count([...NEXUS_NODES, ...CLAUDE_NODES]),
        review: count(['review']),
        completed: count(['merged']),
      },
    };
  }, [tasks]);

  return {
    nodeActivity,
    activeEdges,
    traveledEdges,
    recentActivity,
    stats,
    loading,
  };
}
