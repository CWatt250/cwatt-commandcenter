'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Trash2, KeyRound, LogOut, Eye, EyeOff } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import type { Project } from '@/types';

export default function SettingsPage() {
  const router = useRouter();
  const { projects, loading } = useProjects();
  const [showKey, setShowKey] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function archive(p: Project) {
    const supabase = createClient();
    await supabase.from('projects').update({ archived: true }).eq('id', p.id);
  }

  async function unarchive(p: Project) {
    const supabase = createClient();
    await supabase.from('projects').update({ archived: false }).eq('id', p.id);
  }

  async function deleteProject(p: Project) {
    const supabase = createClient();
    await supabase.from('projects').delete().eq('id', p.id);
    setConfirmDeleteId(null);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-3xl">
        <h1 className="font-display text-2xl text-foreground">Settings</h1>

        {/* API Key */}
        <section className="mt-8 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound className="h-4 w-4 text-amber" />
            Hermes API Key
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Set via the <code className="font-mono text-amber">HERMES_API_KEY</code>{' '}
            environment variable. Hermes must send it as the{' '}
            <code className="font-mono">X-Hermes-Key</code> header on every request.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
              {showKey
                ? 'See HERMES_API_KEY in your env config'
                : 'hkey_••••••••••••••••••••••••••••'}
            </code>
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-faint">
            To rotate: generate a new key (e.g.{' '}
            <code className="font-mono">openssl rand -hex 32</code>), update the env
            var in Vercel, and restart deployments.
          </p>
        </section>

        {/* Projects */}
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Projects</h2>
            <span className="text-[11px] font-mono text-faint">
              {projects.length} project{projects.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading && (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md bg-accent/30"
                />
              ))}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <p className="mt-4 text-sm text-faint">
              No projects yet. Create one from the sidebar.
            </p>
          )}

          <ul className="mt-4 divide-y divide-border">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-md text-base"
                  style={{
                    backgroundColor: p.color + '22',
                    border: `1px solid ${p.color}55`,
                  }}
                >
                  {p.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{p.name}</p>
                  <p className="truncate font-mono text-[11px] text-faint">
                    /{p.slug}
                  </p>
                </div>
                {p.archived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unarchive(p)}
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => archive(p)}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                )}
                {confirmDeleteId === p.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteProject(p)}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDeleteId(p.id)}
                    className="text-red"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Account */}
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-medium text-foreground">Account</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Single-user app — manage password in your Supabase dashboard.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={signOut}
          >
            <LogOut className="mr-1 h-3 w-3" />
            Sign out
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
