'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PipelineNodeData } from './MainNode';

export function YouNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData;
  const active = !!d.active;

  return (
    <div
      className="relative flex items-center gap-2 rounded-full px-4"
      style={{
        height: 44,
        background: '#1A1D24',
        border: `1px solid ${active ? '#F59E0B' : '#283344'}`,
        boxShadow: active ? '0 0 16px 2px rgba(245,158,11,0.3)' : undefined,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      <span className="text-lg leading-none">{d.icon}</span>
      <div className="min-w-0">
        <div className="font-display text-xs font-semibold text-[#E2E8F0]">
          {d.label}
        </div>
        <div className="text-[10px] text-[#64748B]">{d.sub}</div>
      </div>
      {!!d.count && (
        <span
          className="grid h-4 min-w-[1rem] place-items-center rounded-full bg-amber px-1 text-[10px] font-bold text-[#0A0C10]"
        >
          {d.count}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ width: 6, height: 6, background: '#283344', border: 'none' }}
      />
    </div>
  );
}
