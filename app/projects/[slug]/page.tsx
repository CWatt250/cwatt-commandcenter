'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { useActiveAgents } from '@/hooks/useActiveAgents';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { NewTaskModal } from '@/components/tasks/NewTaskModal';
import type { TaskStatus } from '@/types';

export default function ProjectBoardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { projects, loading } = useProjects();
  const agents = useActiveAgents();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [initialStatus, setInitialStatus] = useState<TaskStatus>('brief_ready');

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 md:p-10">
          <div className="h-8 w-48 animate-pulse rounded bg-accent/40" />
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-lg bg-accent/30" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    return (
      <AppShell>
        <div className="flex min-h-dvh items-center justify-center px-6">
          <div className="text-center">
            <h1 className="font-display text-2xl text-foreground">
              Project not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No project with slug{' '}
              <code className="font-mono text-foreground">{slug}</code>
            </p>
            <Link
              href="/projects"
              className="mt-6 inline-block text-sm text-amber underline-offset-4 hover:underline"
            >
              ← Back to projects
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const projectAgents = agents.filter((a) => a.project_id === project.id);

  function openNewTask(status: TaskStatus = 'brief_ready') {
    setInitialStatus(status);
    setTaskModalOpen(true);
  }

  return (
    <AppShell>
      <div className="flex h-dvh flex-col">
        <header className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-xl"
              style={{
                backgroundColor: project.color + '22',
                border: `1px solid ${project.color}55`,
              }}
            >
              {project.icon}
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl text-foreground">
                {project.name}
              </h1>
              {project.repo_url && (
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-faint font-mono hover:text-amber"
                >
                  {project.repo_name ?? project.repo_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {projectAgents.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-md border border-amber/40 bg-amber/10 px-2.5 py-1 text-xs text-amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-amber" />
                {projectAgents.length} agent{projectAgents.length === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              onClick={() => openNewTask('brief_ready')}
              className="inline-flex items-center gap-2 rounded-md bg-amber px-3 py-2 text-sm font-medium text-[#0A0C10] hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <KanbanBoard projectId={project.id} onAddTask={openNewTask} />
        </div>
      </div>

      <NewTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        projectId={project.id}
        initialStatus={initialStatus}
      />
    </AppShell>
  );
}
