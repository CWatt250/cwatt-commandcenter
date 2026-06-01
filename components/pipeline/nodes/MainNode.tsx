'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface PipelineNodeData {
  label: string;
  sub: string;
  icon: string;
  color?: 'amber' | 'cyan' | 'green';
  count?: number;
  active?: boolean;
}

export const GLOW = {
  amber: { border: '#F59E0B', shadow: '0 0 16px 2px rgba(245,158,11,0.35)' },
  cyan: { border: '#22D3EE', shadow: '0 0 16px 2px rgba(34,211,238,0.35)' },
  green: { border: '#10B981', shadow: '0 0 18px 3px rgba(16,185,129,0.45)' },
} as const;

const handleStyle = {
  width: 6,
  height: 6,
  background: '#283344',
  border: 'none',
};

export function MainNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData;
  const glow = GLOW[d.color ?? 'amber'];
  const active = !!d.active;

  return (
    <div
      className="relative flex items-center gap-2 rounded-lg px-3"
      style={{
        width: 150,
        height: 54,
        background: '#131820',
        border: `1px solid ${active ? glow.border : '#283344'}`,
        boxShadow: active ? glow.shadow : undefined,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span className="text-lg leading-none">{d.icon}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-xs font-medium text-[#E2E8F0]">
          {d.label}
        </div>
        <div className="truncate text-[10px] text-[#64748B]">{d.sub}</div>
      </div>
      {!!d.count && (
        <span
          className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full px-1 text-[10px] font-bold text-[#0A0C10]"
          style={{ background: glow.border }}
        >
          {d.count}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}
