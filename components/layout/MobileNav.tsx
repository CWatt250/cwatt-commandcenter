'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Activity, Settings, SquarePen, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();

  const items = [
    { href: '/projects', label: 'Projects', icon: LayoutGrid },
    { href: '/brief', label: 'Brief', icon: SquarePen },
    { href: '/pipeline', label: 'Pipeline', icon: Zap },
    { href: '/activity', label: 'Activity', icon: Activity },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === '/projects'
            ? pathname === '/projects' || pathname.startsWith('/projects/')
            : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider',
              active ? 'text-amber' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
