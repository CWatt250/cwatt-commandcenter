'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PRIORITY_COLORS } from '@/types';
import type { TaskStatus, TaskPriority } from '@/types';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export function NewTaskModal({
  open,
  onOpenChange,
  projectId,
  initialStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialStatus: TaskStatus;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [tagsRaw, setTagsRaw] = useState('');
  const [brief, setBrief] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setPriority('medium');
      setTagsRaw('');
      setBrief('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        title: title.trim(),
        brief: brief.trim() || null,
        priority,
        status: initialStatus,
        tags,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create task');
      setSubmitting(false);
      return;
    }

    await supabase.from('activity_log').insert({
      project_id: projectId,
      task_id: data.id,
      actor: 'Colton',
      action: 'task_created',
      details: { title: data.title, priority: data.priority },
    });

    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-l border-border w-full sm:max-w-lg overflow-y-auto"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle className="font-display text-foreground">
              New Task
            </SheetTitle>
            <SheetDescription className="text-faint">
              Starts in <span className="font-mono">{initialStatus}</span> —
              Hermes will pick up brief_ready tasks.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="t-title">Title</Label>
              <Input
                id="t-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="grid grid-cols-4 gap-1.5 rounded-md border border-border p-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'rounded px-2 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors',
                      priority === p
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={
                      priority === p
                        ? {
                            backgroundColor: PRIORITY_COLORS[p] + '33',
                            color: PRIORITY_COLORS[p],
                          }
                        : undefined
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-tags">Tags (comma separated)</Label>
              <Input
                id="t-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="bug, frontend, urgent"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="t-brief">Brief (Markdown)</Label>
                <span className="text-[10px] font-mono text-faint">
                  {brief.length} chars
                </span>
              </div>
              <Textarea
                id="t-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={`## Brief\n\nWhat the agent needs to do…`}
                rows={14}
                className="font-mono text-xs"
              />
            </div>

            {error && <p className="text-sm text-red">{error}</p>}
          </div>

          <SheetFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim()}
              className="bg-amber text-[#0A0C10] hover:opacity-90"
            >
              {submitting ? 'Creating…' : 'Create Task'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
