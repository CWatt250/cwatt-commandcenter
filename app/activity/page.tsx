'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Circle,
  GitPullRequest,
  Hammer,
  RotateCcw,
  Folder,
  CheckCircle2,
  PackageOpen,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { EnrichedActivity } from '@/hooks/useActivityLog';
import { formatRelative } from '@/lib/utils';

const ACTION_META: Record<
  string,
  { label: (e: EnrichedActivity) => string; icon: typeof Circle; color: string }
> = {
  task_created: {
    label: (e) => `${e.actor} created a task`,
    icon: PackageOpen,
    color: '#94A3B8',
  },
  task_claimed: {
    label: (e) => `${e.actor} picked up this task`,
    icon: Hammer,
    color: '#F59E0B',
  },
  status_updated: {
    label: (e) =>
      `${e.actor} moved to ${(e.details?.status as string) ?? '?'}`,
    icon: Circle,
    color: '#3B82F6',
  },
  pr_opened: {
    label: (e) => `${e.actor} opened a pull request`,
    icon: GitPullRequest,
    color: '#A855F7',
  },
  task_released: {
    label: (e) => `${e.actor} released this task`,
    icon: RotateCcw,
    color: '#EF4444',
  },
  task_completed: {
    label: (e) => `${e.actor} completed this task`,
    icon: CheckCircle2,
    color: '#10B981',
  },
  project_created: {
    label: (e) => `${e.actor} created a project`,
    icon: Folder,
    color: '#F59E0B',
  },
};

export default function ActivityPage() {
  const { projects } = useProjects();
  const [filter, setFilter] = useState<string>('all');
  const { events, loading, hasMore, loadMore } = useActivityLog(
    filter === 'all' ? null : filter
  );

  return (
    <AppShell>
      <div className="p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-foreground">Activity</h1>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-mono text-foreground"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 max-w-3xl">
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-md bg-accent/30"
                />
              ))}
            </div>
          )}

          {!loading && events.length === 0 && (
            <p className="text-sm text-faint">No activity yet.</p>
          )}

          <ul className="relative space-y-3 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
            {events.map((e) => {
              const meta = ACTION_META[e.action] ?? {
                label: (x: EnrichedActivity) => `${x.actor} → ${x.action}`,
                icon: Circle,
                color: '#94A3B8',
              };
              const Icon = meta.icon;
              return (
                <li key={e.id} className="relative">
                  <span
                    className="absolute -left-6 top-2 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background"
                    style={{ color: meta.color }}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="rounded-md border border-border bg-card p-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm text-foreground">
                        {meta.label(e)}
                      </span>
                      <span className="ml-auto font-mono text-[11px] text-faint">
                        {formatRelative(e.created_at)}
                      </span>
                    </div>
                    {(e.task_title || e.project_name) && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        {e.project_name && e.project_slug && (
                          <Link
                            href={`/projects/${e.project_slug}`}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono"
                            style={{
                              backgroundColor:
                                (e.project_color ?? '#F59E0B') + '22',
                              color: e.project_color ?? '#F59E0B',
                            }}
                          >
                            {e.project_icon} {e.project_name}
                          </Link>
                        )}
                        {e.task_title && (
                          <span className="truncate text-muted-foreground">
                            {e.task_title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              className="mt-6 w-full rounded-md border border-border py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
