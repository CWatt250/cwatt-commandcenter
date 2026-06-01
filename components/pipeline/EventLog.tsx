'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Circle,
  GitPullRequest,
  Hammer,
  RotateCcw,
  CheckCircle2,
  PackageOpen,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnrichedActivity } from '@/hooks/useActivityLog';

const ACTION_META: Record<string, { icon: typeof Circle; color: string }> = {
  task_created: { icon: PackageOpen, color: '#94A3B8' },
  task_claimed: { icon: Hammer, color: '#F59E0B' },
  status_updated: { icon: Circle, color: '#3B82F6' },
  pr_opened: { icon: GitPullRequest, color: '#A855F7' },
  task_released: { icon: RotateCcw, color: '#EF4444' },
  task_completed: { icon: CheckCircle2, color: '#10B981' },
  project_created: { icon: Folder, color: '#F59E0B' },
};

function hhmm(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function EventLog({ events }: { events: EnrichedActivity[] }) {
  // Local "Clear" — hide everything up to now; live events still flow in.
  const [clearedAt, setClearedAt] = useState<number>(0);
  const topRef = useRef<HTMLDivElement>(null);

  const visible = events
    .filter((e) => new Date(e.created_at).getTime() > clearedAt)
    .slice(0, 50);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visible.length]);

  return (
    <aside className="hidden w-[260px] flex-shrink-0 flex-col border-l border-border bg-surface md:flex">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-xs uppercase tracking-wider text-faint">
          Event Log
        </h2>
        <button
          type="button"
          onClick={() => setClearedAt(Date.now())}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div ref={topRef} />
        {visible.length === 0 && (
          <p className="px-1 py-4 text-xs text-faint">No recent activity.</p>
        )}
        <ul className="space-y-1.5">
          {visible.map((e) => {
            const meta = ACTION_META[e.action] ?? {
              icon: Circle,
              color: '#94A3B8',
            };
            const Icon = meta.icon;
            return (
              <li
                key={e.id}
                className="animate-in slide-in-from-right-2 fade-in flex items-start gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5 duration-300"
              >
                <Icon
                  className="mt-0.5 h-3 w-3 flex-shrink-0"
                  style={{ color: meta.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[10px] text-faint">
                      {hhmm(e.created_at)}
                    </span>
                    <span
                      className={cn('truncate text-[11px]')}
                      style={{ color: e.project_color ?? '#E2E8F0' }}
                    >
                      {e.task_title ?? e.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {e.project_name && (
                    <span className="text-[10px] text-muted-foreground">
                      {e.project_icon} {e.project_name}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
