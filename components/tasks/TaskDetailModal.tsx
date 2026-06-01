'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Trash2, Edit, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn, formatRelative } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { PRIORITY_COLORS, STATUS_COLORS } from '@/types';
import type { Task, ActivityLog } from '@/types';
import { isSupabaseConfigured } from '@/lib/utils';

type Tab = 'brief' | 'activity';

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>('brief');
  const [editingBrief, setEditingBrief] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [briefDraft, setBriefDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [events, setEvents] = useState<ActivityLog[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setBriefDraft(task.brief ?? '');
      setTitleDraft(task.title);
      setTab('brief');
      setEditingBrief(false);
      setEditingTitle(false);
      setConfirmDelete(false);
    }
  }, [task]);

  useEffect(() => {
    if (!task || !isSupabaseConfigured()) return;
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('task_id', task!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      setEvents((data ?? []) as ActivityLog[]);
    }

    load();

    const channel = supabase
      .channel(`task-activity:${task.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `task_id=eq.${task.id}`,
        },
        (payload) => setEvents((prev) => [payload.new as ActivityLog, ...prev])
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [task]);

  if (!task) return null;

  async function saveBrief() {
    if (!task) return;
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ brief: briefDraft })
      .eq('id', task.id);
    setEditingBrief(false);
  }

  async function saveTitle() {
    if (!task) return;
    if (!titleDraft.trim() || titleDraft === task.title) {
      setTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ title: titleDraft.trim() })
      .eq('id', task.id);
    setEditingTitle(false);
  }

  async function handleDelete() {
    if (!task) return;
    const supabase = createClient();
    await supabase.from('tasks').delete().eq('id', task.id);
    onOpenChange(false);
  }

  const priorityColor = PRIORITY_COLORS[task.priority];
  const statusColor = STATUS_COLORS[task.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border max-w-3xl max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-3 min-w-0">
              {editingTitle ? (
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(task.title);
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="font-display text-lg"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="min-w-0 flex-1 truncate text-left font-display text-lg text-foreground hover:opacity-80"
                >
                  {task.title}
                </button>
              )}
              <span
                className="rounded px-2 py-0.5 text-[10px] font-mono uppercase"
                style={{
                  backgroundColor: statusColor + '22',
                  color: statusColor,
                }}
              >
                {task.status.replace('_', ' ')}
              </span>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-mono uppercase"
                style={{
                  backgroundColor: priorityColor + '22',
                  color: priorityColor,
                }}
              >
                {task.priority}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-0 md:flex-row">
          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="flex border-b border-border">
              <TabButton active={tab === 'brief'} onClick={() => setTab('brief')}>
                Brief
              </TabButton>
              <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
                Activity ({events.length})
              </TabButton>
            </div>

            <div className="p-4">
              {tab === 'brief' && (
                <div>
                  {editingBrief ? (
                    <div className="space-y-2">
                      <Textarea
                        value={briefDraft}
                        onChange={(e) => setBriefDraft(e.target.value)}
                        rows={16}
                        className="font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveBrief}
                          className="bg-amber text-[#0A0C10] hover:opacity-90"
                        >
                          <Save className="mr-1 h-3 w-3" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBriefDraft(task.brief ?? '');
                            setEditingBrief(false);
                          }}
                        >
                          <X className="mr-1 h-3 w-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setEditingBrief(true)}
                        className="absolute right-0 top-0 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-faint hover:bg-accent hover:text-foreground"
                      >
                        <Edit className="h-3 w-3" />
                        Edit
                      </button>
                      {task.brief ? (
                        <article className="prose prose-invert prose-sm max-w-none font-mono prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-code:text-amber prose-a:text-blue">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {task.brief}
                          </ReactMarkdown>
                        </article>
                      ) : (
                        <p className="text-sm text-faint italic">
                          No brief yet. Click Edit to add one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'activity' && (
                <ul className="space-y-2">
                  {events.length === 0 && (
                    <li className="text-sm text-faint">No activity yet.</li>
                  )}
                  {events.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-xs"
                    >
                      <span className="font-mono text-amber">{e.actor}</span>
                      <span className="text-muted-foreground">{e.action}</span>
                      <span className="ml-auto font-mono text-faint">
                        {formatRelative(e.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <aside className="border-t border-border bg-card/40 p-4 md:w-64 md:border-l md:border-t-0">
            <DetailRow label="Agent">
              {task.claimed_by ? (
                <span className="font-mono text-amber">{task.claimed_by}</span>
              ) : (
                <span className="text-faint">unclaimed</span>
              )}
            </DetailRow>
            <DetailRow label="Branch">
              {task.branch_name ? (
                <span className="font-mono text-xs text-muted-foreground">
                  {task.branch_name}
                </span>
              ) : (
                <span className="text-faint">—</span>
              )}
            </DetailRow>
            <DetailRow label="Pull Request">
              {task.pr_url ? (
                <a
                  href={task.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-purple hover:underline"
                >
                  PR #{task.pr_number ?? '?'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-faint">—</span>
              )}
            </DetailRow>
            {task.tags && task.tags.length > 0 && (
              <DetailRow label="Tags">
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </DetailRow>
            )}
            <DetailRow label="Created">
              <span className="text-xs text-muted-foreground">
                {formatRelative(task.created_at)}
              </span>
            </DetailRow>
            <DetailRow label="Updated">
              <span className="text-xs text-muted-foreground">
                {formatRelative(task.updated_at)}
              </span>
            </DetailRow>
            {task.completed_at && (
              <DetailRow label="Completed">
                <span className="text-xs text-green">
                  {formatRelative(task.completed_at)}
                </span>
              </DetailRow>
            )}

            <div className="mt-6 border-t border-border pt-4">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-xs text-faint">Delete this task forever?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                    >
                      Yes, delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-red hover:text-red"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete Task
                </Button>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-b-2 px-4 py-2 text-sm transition-colors',
        active
          ? 'border-amber text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-faint">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
