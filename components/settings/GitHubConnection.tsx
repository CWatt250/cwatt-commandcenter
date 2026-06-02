'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GitBranch, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GitHubStatus } from '@/types';

export function GitHubConnection() {
  const params = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const justConnected = params.get('github') === 'connected';
  const errorReason = params.get('github') === 'error' ? params.get('reason') : null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/github/status');
      const data = (await res.json()) as GitHubStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch('/api/github/disconnect', { method: 'POST' });
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status?.connected;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <GitBranch className="h-4 w-4 text-amber" />
        GitHub Integration
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Connect a GitHub account to auto-fill repo details when creating projects,
        show live PR status on cards, and let repo webhooks move tasks to{' '}
        <span className="text-green">Done</span> when their PR merges.
      </p>

      {errorReason && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
          <AlertCircle className="h-3.5 w-3.5" />
          GitHub connection failed ({errorReason}). Please try again.
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-40 animate-pulse rounded-md bg-accent/30" />
        ) : connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-green/40 bg-green/10 px-3 py-2 text-xs text-green">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected{status?.login ? ` as @${status.login}` : ''}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={disconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <a href="/api/github/oauth/login">
            <Button
              size="sm"
              className="bg-amber text-[#0A0C10] hover:opacity-90"
            >
              <GitBranch className="mr-1 h-3 w-3" />
              Connect GitHub
            </Button>
          </a>
        )}
      </div>

      {justConnected && connected && (
        <p className="mt-3 text-[11px] text-faint">
          ✓ GitHub connected. Add a webhook on your repo pointing to{' '}
          <code className="font-mono text-amber">/api/webhooks/github</code> with the{' '}
          <code className="font-mono">GITHUB_WEBHOOK_SECRET</code> to enable
          auto-sync.
        </p>
      )}
    </section>
  );
}
