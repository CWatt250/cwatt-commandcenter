'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { MobileNav } from '@/components/layout/MobileNav';
import { EventLog } from '@/components/pipeline/EventLog';
import { usePipelineData } from '@/hooks/usePipelineData';

// React Flow touches `window`, so load the canvas client-only.
const PipelineView = dynamic(
  () => import('@/components/pipeline/PipelineView').then((m) => m.PipelineView),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading pipeline…
      </div>
    ),
  }
);

export default function PipelinePage() {
  const { nodeActivity, activeEdges, traveledEdges, recentActivity, stats } =
    usePipelineData();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="font-display text-sm text-foreground">
            <span className="text-amber">⌘</span> CommandCenter
            <span className="text-faint"> — Live Pipeline</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green/40 bg-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green">
            <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse-amber" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <Stat label="In-flight" value={stats.inFlight} color="#F59E0B" />
          <Stat label="Review" value={stats.review} color="#A855F7" />
          <Stat label="Done" value={stats.completed} color="#10B981" />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 pb-16 md:pb-0">
        <div className="relative min-w-0 flex-1">
          <PipelineView
            nodeActivity={nodeActivity}
            activeEdges={activeEdges}
            traveledEdges={traveledEdges}
          />
        </div>
        <EventLog events={recentActivity} />
      </div>

      <MobileNav />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-faint">{label}</span>
      <span className="font-bold" style={{ color }}>
        {value}
      </span>
    </span>
  );
}
