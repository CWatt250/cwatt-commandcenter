'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useViewport,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Task } from '@/types';
import { colorForNode } from '@/hooks/usePipelineData';
import { MainNode } from './nodes/MainNode';
import { SubNode } from './nodes/SubNode';
import { YouNode } from './nodes/YouNode';
import { MergedNode } from './nodes/MergedNode';
import { TaskPill } from './TaskPill';

const nodeTypes = {
  youNode: YouNode,
  mainNode: MainNode,
  subNode: SubNode,
  mergedNode: MergedNode,
};

const BASE_NODES: Node[] = [
  { id: 'you', type: 'youNode', position: { x: 350, y: 20 }, data: { label: 'You', sub: 'via Telegram', icon: '📱' } },
  { id: 'hermes', type: 'mainNode', position: { x: 350, y: 140 }, data: { label: 'Hermes', sub: 'Orchestrator', icon: '🎯', color: 'amber' } },
  { id: 'router', type: 'mainNode', position: { x: 350, y: 260 }, data: { label: 'Task Router', sub: 'Classifier', icon: '⚖️' } },
  { id: 'nexus', type: 'mainNode', position: { x: 100, y: 390 }, data: { label: 'Nexus', sub: 'Local · Free', icon: '⚡', color: 'cyan' } },
  { id: 'claude', type: 'mainNode', position: { x: 600, y: 390 }, data: { label: 'Claude Code', sub: 'Cloud · Billed', icon: '🤖', color: 'amber' } },
  { id: 'n_work', type: 'subNode', position: { x: 0, y: 510 }, data: { label: 'Local Work', sub: 'qwen3-coder', icon: '⚙️', color: 'cyan' } },
  { id: 'n_qa', type: 'subNode', position: { x: 120, y: 510 }, data: { label: 'Visual QA', sub: 'qwen2.5vl', icon: '👁️', color: 'cyan' } },
  { id: 'n_mon', type: 'subNode', position: { x: 240, y: 510 }, data: { label: 'Monitor', sub: 'Board watch', icon: '📡', color: 'cyan' } },
  { id: 'c_pre', type: 'subNode', position: { x: 490, y: 510 }, data: { label: 'Preflight', sub: 'Brief enrich', icon: '🔬', color: 'amber' } },
  { id: 'c_work', type: 'subNode', position: { x: 610, y: 510 }, data: { label: 'CC Worker', sub: 'Sonnet 4.6', icon: '💻', color: 'amber' } },
  { id: 'c_push', type: 'subNode', position: { x: 730, y: 510 }, data: { label: 'Git + PR', sub: 'Auto-push', icon: '🚀', color: 'amber' } },
  { id: 'review', type: 'mainNode', position: { x: 350, y: 640 }, data: { label: 'PR Review', sub: 'Awaiting Colton', icon: '👀' } },
  { id: 'merged', type: 'mergedNode', position: { x: 350, y: 760 }, data: { label: 'Merged ✓', sub: 'Board updated', icon: '✅', color: 'green' } },
];

const BASE_EDGES: Edge[] = [
  { id: 'e-you-hermes', source: 'you', target: 'hermes', animated: true, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 } },
  { id: 'e-hermes-router', source: 'hermes', target: 'router', animated: true, style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 2 } },
  { id: 'e-router-nexus', source: 'router', target: 'nexus', animated: true, style: { stroke: 'rgba(34,211,238,0.4)', strokeWidth: 2 } },
  { id: 'e-router-claude', source: 'router', target: 'claude', animated: true, style: { stroke: 'rgba(245,158,11,0.4)', strokeWidth: 2 } },
  { id: 'e-nexus-n_work', source: 'nexus', target: 'n_work', style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  { id: 'e-nexus-n_qa', source: 'nexus', target: 'n_qa', style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  { id: 'e-nexus-n_mon', source: 'nexus', target: 'n_mon', style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.5 } },
  { id: 'e-claude-c_pre', source: 'claude', target: 'c_pre', style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  { id: 'e-claude-c_work', source: 'claude', target: 'c_work', style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  { id: 'e-claude-c_push', source: 'claude', target: 'c_push', style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 } },
  { id: 'e-n_work-review', source: 'n_work', target: 'review', style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-n_qa-review', source: 'n_qa', target: 'review', style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-n_mon-review', source: 'n_mon', target: 'review', style: { stroke: 'rgba(34,211,238,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_pre-review', source: 'c_pre', target: 'review', style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_work-review', source: 'c_work', target: 'review', style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  { id: 'e-c_push-review', source: 'c_push', target: 'review', style: { stroke: 'rgba(245,158,11,0.2)', strokeWidth: 1.5 } },
  { id: 'e-review-merged', source: 'review', target: 'merged', animated: true, style: { stroke: 'rgba(16,185,129,0.5)', strokeWidth: 2 } },
];

const SIZE: Record<string, { w: number; h: number }> = {
  youNode: { w: 120, h: 44 },
  mainNode: { w: 150, h: 54 },
  subNode: { w: 110, h: 40 },
  mergedNode: { w: 150, h: 60 },
};

// Completion timestamp in ms (0 if missing), used to rank overlapping
// completed pills so the most recently merged renders on top.
function completedTs(t: Task): number {
  return t.completed_at ? new Date(t.completed_at).getTime() : 0;
}

// Rewrite the alpha of an `rgba(r,g,b,a)` stroke to a fixed value, so an edge
// can be re-styled brighter (active) or dimmer (travelled) than its base.
function setAlpha(stroke: string | undefined, alpha: number): string | undefined {
  if (!stroke) return stroke;
  return stroke.replace(
    /rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
    `rgba($1,$2,$3,${alpha})`
  );
}

export function PipelineView({
  nodeActivity,
  activeEdges,
  traveledEdges,
}: {
  nodeActivity: Record<string, Task[]>;
  activeEdges: string[];
  traveledEdges: string[];
}) {
  const nodes = useMemo<Node[]>(
    () =>
      BASE_NODES.map((n) => {
        const count = nodeActivity[n.id]?.length ?? 0;
        return {
          ...n,
          draggable: false,
          selectable: false,
          data: { ...n.data, count, active: count > 0 },
        };
      }),
    [nodeActivity]
  );

  const edges = useMemo<Edge[]>(() => {
    const active = new Set(activeEdges);
    const traveled = new Set(traveledEdges);
    return BASE_EDGES.map((e) => {
      const stroke = e.style?.stroke as string | undefined;
      const width = (e.style?.strokeWidth as number) ?? 1.5;
      // Current hop — brightest and animated so the dash visibly flows.
      if (active.has(e.id)) {
        return {
          ...e,
          animated: true,
          style: { ...e.style, stroke: setAlpha(stroke, 0.95), strokeWidth: width + 0.8 },
        };
      }
      // Already-travelled segment — kept dimly lit, no flow, to show the route.
      if (traveled.has(e.id)) {
        return {
          ...e,
          animated: false,
          style: { ...e.style, stroke: setAlpha(stroke, 0.5), strokeWidth: width + 0.2 },
        };
      }
      return e;
    });
  }, [activeEdges, traveledEdges]);

  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          panOnDrag
          zoomOnScroll
          minZoom={0.4}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.04)"
          />
          <Controls
            showInteractive={false}
            style={{ background: '#131820', border: '1px solid #283344' }}
          />
        </ReactFlow>
        <PillsOverlay nodeActivity={nodeActivity} />
      </div>
    </ReactFlowProvider>
  );
}

function PillsOverlay({
  nodeActivity,
}: {
  nodeActivity: Record<string, Task[]>;
}) {
  const { x, y, zoom } = useViewport();

  const pills = useMemo(() => {
    const out: {
      task: Task;
      nodeId: string;
      left: number;
      top: number;
      zIndex: number;
    }[] = [];
    for (const node of BASE_NODES) {
      const tasks = nodeActivity[node.id];
      if (!tasks?.length) continue;
      const size = SIZE[node.type ?? 'mainNode'];
      const cx = node.position.x + size.w / 2;
      const cy = node.position.y + size.h / 2;
      // Completed pills overlap at the merged node, so the most recently
      // completed task must stack on top of older ones (higher z = more
      // recent). Rank by completed_at; oldest gets 0, newest the highest.
      const recencyRank =
        node.id === 'merged'
          ? new Map(
              [...tasks]
                .sort((a, b) => completedTs(a) - completedTs(b))
                .map((t, idx) => [t.id, idx])
            )
          : null;
      tasks.forEach((task, i) => {
        // Stack multiple tasks at one node so they don't fully overlap.
        const offset = (i - (tasks.length - 1) / 2) * 18;
        out.push({
          task,
          nodeId: node.id,
          left: cx * zoom + x,
          top: (cy + offset) * zoom + y,
          zIndex: 10 + (recencyRank?.get(task.id) ?? 0),
        });
      });
    }
    return out;
  }, [nodeActivity, x, y, zoom]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pills.map((p) => (
        <TaskPill
          key={p.task.id}
          task={p.task}
          nodeId={p.nodeId}
          color={colorForNode(p.nodeId)}
          style={{ left: p.left, top: p.top, zIndex: p.zIndex }}
        />
      ))}
    </div>
  );
}
