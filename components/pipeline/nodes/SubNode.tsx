'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GLOW, type PipelineNodeData } from './MainNode';

const handleStyle = {
  width: 5,
  height: 5,
  background: '#283344',
  border: 'none',
};

export function SubNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData;
  const glow = GLOW[d.color ?? 'cyan'];
  const active = !!d.active;

  return (
    <div
      className="relative flex items-center gap-1.5 rounded-md px-2"
      style={{
        width: 110,
        height: 40,
        background: '#131820',
        border: `1px solid ${active ? glow.border : '#283344'}`,
        boxShadow: active ? glow.shadow : undefined,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <span className="text-sm leading-none">{d.icon}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-[10px] font-medium text-[#E2E8F0]">
          {d.label}
        </div>
        <div className="truncate text-[9px] text-[#64748B]">{d.sub}</div>
      </div>
      {!!d.count && (
        <span
          className="absolute -right-1 -top-1 grid h-3.5 min-w-[0.875rem] place-items-center rounded-full px-1 text-[9px] font-bold text-[#0A0C10]"
          style={{ background: glow.border }}
        >
          {d.count}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
}
