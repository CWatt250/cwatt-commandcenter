'use client';

import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  /** Short group label shown to the left of the chips. */
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * A single-select group of filter chips. The active chip is filled (amber),
 * inactive chips are outlined. Designed to sit inside a horizontally
 * scrollable filter bar.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 font-mono text-xs transition-colors',
                active
                  ? 'border-amber bg-amber/15 text-amber'
                  : 'border-border bg-card text-muted-foreground hover:border-amber/50 hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
