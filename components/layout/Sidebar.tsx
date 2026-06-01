'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Settings, Plus, Folder, SquarePen, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/hooks/useProjects';
import { useProjectTaskCounts } from '@/hooks/useProjectTaskCounts';
import { useActiveAgents } from '@/hooks/useActiveAgents';
import { NewProjectModal } from '@/components/projects/NewProjectModal';

export function Sidebar() {
  const pathname = usePathname();
  const { projects, loading } = useProjects();
  const { counts } = useProjectTaskCounts();
  const agents = useActiveAgents();
  const [modalOpen, setModalOpen] = useState(false);

  const activeSlug = pathname.startsWith('/projects/')
    ? pathname.split('/')[2]
    : null;

  return (
    <nav className="flex h-full w-full flex-col">
      <div className="border-b border-border px-5 py-5">
        <Link
          href="/projects"
          className="font-display text-lg tracking-tight text-foreground"
        >
          <span className="text-amber">⌘</span> CommandCenter
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <SectionLabel>Projects</SectionLabel>
        <ul className="mt-2 space-y-0.5">
          {loading && (
            <>
              <li className="mx-3 my-1 h-7 animate-pulse rounded-md bg-accent/40" />
              <li className="mx-3 my-1 h-7 animate-pulse rounded-md bg-accent/40" />
              <li className="mx-3 my-1 h-7 animate-pulse rounded-md bg-accent/40" />
            </>
          )}

          {!loading && projects.length === 0 && (
            <li className="px-3 py-2 text-xs text-faint italic">No projects yet</li>
          )}

          {projects.map((p) => {
            const active = activeSlug === p.slug;
            const open = counts[p.id]?.open ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.slug}`}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <span className="text-base" aria-hidden>
                    {p.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {open > 0 && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-mono"
                      style={{
                        backgroundColor: p.color + '22',
                        color: p.color,
                      }}
                    >
                      {open}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-amber hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>

        <div className="mt-6">
          <SectionLabel>Navigation</SectionLabel>
          <ul className="mt-2 space-y-0.5">
            <SidebarLink
              href="/brief"
              icon={<SquarePen className="h-4 w-4" />}
              label="Brief Builder"
              active={pathname === '/brief'}
            />
            <SidebarLink
              href="/pipeline"
              icon={<Zap className="h-4 w-4" />}
              label="Pipeline"
              active={pathname === '/pipeline'}
            />
            <SidebarLink
              href="/activity"
              icon={<Activity className="h-4 w-4" />}
              label="Activity"
              active={pathname === '/activity'}
            />
            <SidebarLink
              href="/settings"
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              active={pathname === '/settings'}
            />
          </ul>
        </div>
      </div>

      <div className="border-t border-border px-5 py-4 text-xs">
        <span
          title={
            agents.length > 0
              ? agents.map((a) => `${a.agent} — ${a.task_title}`).join('\n')
              : undefined
          }
          className={cn(
            'inline-flex items-center gap-2 cursor-default',
            agents.length > 0 ? 'text-amber' : 'text-faint'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              agents.length > 0
                ? 'bg-amber animate-pulse-amber'
                : 'bg-faint'
            )}
          />
          {agents.length === 0
            ? 'idle'
            : `${agents.length} agent${agents.length === 1 ? '' : 's'} active`}
        </span>
      </div>

      <NewProjectModal open={modalOpen} onOpenChange={setModalOpen} />
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 text-[10px] font-medium uppercase tracking-wider text-faint">
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        {icon}
        {label}
      </Link>
    </li>
  );
}

export { Folder };
