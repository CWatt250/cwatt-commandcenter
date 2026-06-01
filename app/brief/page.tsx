'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, FolderPlus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { BriefChat } from '@/components/brief/BriefChat';

export default function BriefPage() {
  const { projects, loading } = useProjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bumped by "New" to remount BriefChat and clear the conversation.
  const [convKey, setConvKey] = useState(0);

  // Default to the first project once they load (or if the selection vanished).
  useEffect(() => {
    if (projects.length === 0) return;
    if (!selectedId || !projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-4rem)] flex-col md:h-dvh">
        {/* Topbar */}
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg text-foreground">
              <span className="text-amber">✎</span> Brief Builder
            </h1>
            {selected && (
              <div className="flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 py-1 pl-2 pr-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
                <select
                  value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="bg-transparent text-xs font-mono text-amber focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-elevated text-foreground">
                      {p.icon} {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => setConvKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New
            </button>
          )}
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1">
          {!loading && projects.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <FolderPlus className="h-10 w-10 text-faint" />
              <div>
                <p className="text-foreground">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a project before drafting briefs for it.
                </p>
              </div>
              <Link
                href="/projects"
                className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-[#0A0C10] hover:opacity-90"
              >
                Go to Projects
              </Link>
            </div>
          ) : selected ? (
            <BriefChat key={`${selected.id}:${convKey}`} project={selected} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-faint">
              Loading projects…
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
