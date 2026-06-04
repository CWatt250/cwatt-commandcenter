'use client';

import type { CSSProperties } from 'react';
import { PRIORITY_COLORS } from '@/types';
import type { Task } from '@/types';
import type { PillColor } from '@/hooks/usePipelineData';

const PILL_COLORS: Record<PillColor, string> = {
  cyan: '#22D3EE',
  amber: '#F59E0B',
  green: '#10B981',
};

/**
 * A single task token that floats over the React Flow canvas. Positioning
 * (left/top) is supplied by the overlay; the CSS transition makes it glide
 * between nodes when its assigned node changes.
 */
export function TaskPill({
  task,
  color,
  style,
}: {
  task: Task;
  nodeId?: string;
  color: PillColor;
  style: CSSProperties;
}) {
  const accent = PILL_COLORS[color];
  return (
    <div
      className="pointer-events-none absolute flex max-w-[160px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white shadow-lg"
      style={{
        zIndex: 10,
        ...style,
        transform: 'translate(-50%, -50%)',
        background: 'rgba(10,12,16,0.92)',
        border: `1px solid ${accent}`,
        boxShadow: `0 0 10px ${accent}66`,
        transition:
          'left 0.8s cubic-bezier(0.4,0,0.2,1), top 0.8s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: PRIORITY_COLORS[task.priority] }}
      />
      <span className="truncate">{task.title}</span>
    </div>
  );
}
