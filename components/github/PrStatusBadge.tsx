'use client';

import { useEffect, useState } from 'react';
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrState } from '@/types';

// Module-level cache keyed by PR URL so re-renders and sibling cards don't
// re-hit the API. The server route is also edge-cached for 60s.
const cache = new Map<string, PrState | null>();
const inflight = new Map<string, Promise<PrState | null>>();

function loadStatus(prUrl: string): Promise<PrState | null> {
  if (inflight.has(prUrl)) return inflight.get(prUrl)!;
  const p = fetch(`/api/github/pr-status?pr_url=${encodeURIComponent(prUrl)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const state: PrState | null =
        d && d.connected && d.state ? (d.state as PrState) : null;
      cache.set(prUrl, state);
      return state;
    })
    .catch(() => null)
    .finally(() => inflight.delete(prUrl));
  inflight.set(prUrl, p);
  return p;
}

const STYLES: Record<
  PrState,
  { cls: string; Icon: typeof GitPullRequest; label: string }
> = {
  open: {
    cls: 'bg-purple/15 text-purple hover:bg-purple/25',
    Icon: GitPullRequest,
    label: 'open',
  },
  merged: {
    cls: 'bg-green/15 text-green hover:bg-green/25',
    Icon: GitMerge,
    label: 'merged',
  },
  closed: {
    cls: 'bg-red/15 text-red hover:bg-red/25',
    Icon: GitPullRequestClosed,
    label: 'closed',
  },
};

export function PrStatusBadge({
  prUrl,
  prNumber,
}: {
  prUrl: string;
  prNumber: number | null;
}) {
  const [state, setState] = useState<PrState | null>(
    () => cache.get(prUrl) ?? null
  );

  useEffect(() => {
    let active = true;
    if (cache.has(prUrl)) {
      setState(cache.get(prUrl) ?? null);
      return;
    }
    loadStatus(prUrl).then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, [prUrl]);

  // Until a state resolves (or if GitHub isn't connected), fall back to the
  // neutral purple PR pill so the link is always present.
  const style = state ? STYLES[state] : null;
  const Icon = style?.Icon ?? GitPullRequest;

  return (
    <a
      href={prUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-no-card-click="true"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors',
        style ? style.cls : 'bg-purple/15 text-purple hover:bg-purple/25'
      )}
    >
      <Icon className="h-3 w-3" />
      PR #{prNumber ?? '?'}
      {style && <span className="opacity-80">· {style.label}</span>}
    </a>
  );
}
