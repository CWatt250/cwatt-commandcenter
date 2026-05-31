import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="hidden md:flex md:w-60 md:flex-shrink-0 md:border-r md:border-border md:bg-surface">
        <Sidebar />
      </aside>
      <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
