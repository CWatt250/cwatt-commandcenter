'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PipelineNodeData } from './MainNode';

export function MergedNode({ data }: NodeProps) {
  const d = data as unknown as PipelineNodeData;
  const count = d.count ?? 0;
  const active = count > 0;

  return (
    <div
      className="relative flex items-center gap-2 rounded-lg px-3"
      style={{
        width: 150,
        height: 60,
        background: '#101C16',
        border: `1px solid ${active ? '#10B981' : '#1E3A2E'}`,
        boxShadow: active ? '0 0 20px 3px rgba(16,185,129,0.4)' : undefined,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ width: 6, height: 6, background: '#1E3A2E', border: 'none' }}
      />
      <span className="text-xl leading-none">{d.icon}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-xs font-medium text-[#86EFAC]">
          {d.label}
        </div>
        <div className="truncate text-[10px] text-[#3F7A5C]">{d.sub}</div>
      </div>
      <span className="ml-auto font-display text-lg font-bold text-green">
        {count}
      </span>
    </div>
  );
}
