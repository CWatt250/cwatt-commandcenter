'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify, parseRepoNameFromUrl, cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ICONS = ['📁', '⚡', '🏢', '🗺️', '🎯', '🔧', '🚀', '💡', '🔨', '🌐'];
const COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#10B981',
  '#A855F7',
  '#EF4444',
  '#F97316',
  '#06B6D4',
  '#8B5CF6',
];

export function NewProjectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub auto-fetch state
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoMeta, setRepoMeta] = useState<{
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
  } | null>(null);

  const slug = useMemo(() => slugify(name), [name]);
  const repoName = useMemo(
    () => repoMeta?.name ?? (repoUrl ? parseRepoNameFromUrl(repoUrl) : null),
    [repoMeta, repoUrl]
  );

  // Debounced auto-fetch of repo metadata from the GitHub API to pre-fill the
  // form when a GitHub repo URL is entered.
  useEffect(() => {
    const trimmed = repoUrl.trim();
    setRepoError(null);
    if (!/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/.test(trimmed)) {
      setRepoMeta(null);
      setRepoLoading(false);
      return;
    }

    let active = true;
    setRepoLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/github/repo?url=${encodeURIComponent(trimmed)}`
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setRepoMeta(null);
          setRepoError(data?.error ?? 'Failed to fetch repo.');
          return;
        }
        setRepoMeta(data);
        // Pre-fill empty fields — never overwrite what the user already typed.
        setName((prev) => (prev.trim() ? prev : data.name));
        setDescription((prev) =>
          prev.trim() ? prev : data.description ?? ''
        );
      } catch {
        if (active) {
          setRepoMeta(null);
          setRepoError('Failed to reach GitHub.');
        }
      } finally {
        if (active) setRepoLoading(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [repoUrl]);

  function reset() {
    setStep(1);
    setName('');
    setDescription('');
    setIcon(ICONS[0]);
    setColor(COLORS[0]);
    setRepoUrl('');
    setError(null);
    setSubmitting(false);
    setRepoLoading(false);
    setRepoError(null);
    setRepoMeta(null);
  }

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleCreate() {
    if (!name.trim() || !slug) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        repo_url: repoUrl.trim() || null,
        repo_name: repoName,
        default_branch: repoMeta?.default_branch ?? null,
        color,
        icon,
      })
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create project');
      setSubmitting(false);
      return;
    }

    await supabase.from('activity_log').insert({
      project_id: data.id,
      actor: 'Colton',
      action: 'project_created',
      details: { name: data.name, slug: data.slug },
    });

    handleClose(false);
    router.push(`/projects/${data.slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-popover border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">
            New Project — Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-name">Name</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BidWatt"
                autoFocus
              />
              {slug && (
                <p className="text-xs text-muted-foreground font-mono">
                  /projects/{slug}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description (optional)</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project for?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={cn(
                      'h-9 w-9 rounded-md border text-lg transition-colors',
                      icon === emoji
                        ? 'border-amber bg-accent'
                        : 'border-border hover:bg-accent'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform',
                      color === c ? 'scale-110 border-foreground' : 'border-border'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-repo">GitHub Repository URL (optional)</Label>
              <Input
                id="proj-repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/CWatt250/your-repo"
                autoFocus
              />
              {repoLoading && (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching repo details from GitHub…
                </p>
              )}
              {!repoLoading && repoMeta && (
                <div className="space-y-0.5 rounded-md border border-green/30 bg-green/5 px-3 py-2">
                  <p className="inline-flex items-center gap-1.5 text-xs text-green">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="font-mono">{repoMeta.full_name}</span>
                  </p>
                  <p className="text-[11px] text-faint font-mono">
                    default branch: {repoMeta.default_branch}
                  </p>
                </div>
              )}
              {!repoLoading && repoError && (
                <p className="inline-flex items-center gap-1.5 text-xs text-red">
                  <AlertCircle className="h-3 w-3" />
                  {repoError}
                </p>
              )}
              {!repoLoading && !repoMeta && !repoError && repoName && (
                <p className="text-xs text-muted-foreground font-mono">
                  Detected: {repoName}
                </p>
              )}
            </div>
            <p className="text-xs text-faint">
              Paste a GitHub URL to auto-fill the name, description, and default
              branch. Used by Hermes to clone the repo and create worktrees per
              task.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-md text-xl"
                style={{ backgroundColor: color + '22', border: `1px solid ${color}` }}
              >
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{name}</p>
                <p className="truncate text-xs text-muted-foreground font-mono">/{slug}</p>
              </div>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {repoName && (
              <p className="text-xs text-faint font-mono">↗ {repoUrl}</p>
            )}
            {repoMeta?.default_branch && (
              <p className="text-[11px] text-faint font-mono">
                default branch: {repoMeta.default_branch}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          {step < 3 && (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !name.trim()}
              className="bg-amber text-[#0A0C10] hover:opacity-90"
            >
              Next
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-amber text-[#0A0C10] hover:opacity-90"
            >
              {submitting ? 'Creating…' : 'Create Project'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
