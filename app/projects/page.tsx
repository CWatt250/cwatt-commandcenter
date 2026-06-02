'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { NewProjectModal } from '@/components/projects/NewProjectModal';
import { useProjects } from '@/hooks/useProjects';
import { useProjectTaskCounts } from '@/hooks/useProjectTaskCounts';
import { useProjectWikiCounts } from '@/hooks/useProjectWikiCounts';
import { KANBAN_COLUMNS, STATUS_COLORS } from '@/types';
import type { TaskStatus } from '@/types';

export default function ProjectsPage() {
  const { projects, loading } = useProjects();
  const { counts } = useProjectTaskCounts();
  const { counts: wikiCounts } = useProjectWikiCounts();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 md:p-10">
          <div className="mx-auto h-6 w-32 animate-pulse rounded bg-accent/40" />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-accent/30" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (projects.length === 0) {
    return (
      <AppShell>
        <div className="flex min-h-dvh items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface text-3xl">
              📁
            </div>
            <h1 className="font-display text-2xl text-foreground">No projects yet</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Create your first project to get started.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber px-4 py-2 text-sm font-medium text-[#0A0C10] hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          </div>
        </div>
        <NewProjectModal open={modalOpen} onOpenChange={setModalOpen} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-foreground">Projects</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-amber px-3 py-2 text-sm font-medium text-[#0A0C10] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const c = counts[p.id];
            const wiki = wikiCounts[p.id] ?? 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.slug}`}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors hover:border-accent hover:bg-accent"
              >
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-md text-xl"
                    style={{
                      backgroundColor: p.color + '22',
                      border: `1px solid ${p.color}55`,
                    }}
                  >
                    {p.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium text-foreground">{p.name}</h2>
                    {p.repo_name && (
                      <p className="truncate text-xs text-faint font-mono">
                        {p.repo_name}
                      </p>
                    )}
                  </div>
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  {wiki > 0 && (
                    <span
                      title={`${wiki} project memory ${wiki === 1 ? 'entry' : 'entries'}`}
                      className="rounded bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                    >
                      🧠 {wiki} memory
                    </span>
                  )}
                  {KANBAN_COLUMNS.map((col) => {
                    const n = c?.[col.id as TaskStatus] ?? 0;
                    if (n === 0) return null;
                    return (
                      <span
                        key={col.id}
                        className="rounded px-1.5 py-0.5 text-[10px] font-mono"
                        style={{
                          backgroundColor: STATUS_COLORS[col.id] + '22',
                          color: STATUS_COLORS[col.id],
                        }}
                      >
                        {n} {col.label.split(' ').slice(1).join(' ').toLowerCase()}
                      </span>
                    );
                  })}
                  {(!c || c.total === 0) && (
                    <span className="text-[10px] text-faint">no tasks yet</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <NewProjectModal open={modalOpen} onOpenChange={setModalOpen} />
    </AppShell>
  );
}
