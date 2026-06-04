'use client';

import { FilterChips, type ChipOption } from './FilterChips';
import type { EnrichedActivity } from '@/hooks/useActivityLog';

export type StatusFilter = 'all' | 'in_progress' | 'pr_review' | 'done';
export type AgentFilter = 'all' | 'hermes' | 'nexus';
export type ActionFilter = 'all' | 'created' | 'claimed' | 'pr_opened' | 'merged';
export type DateFilter = 'today' | 'week' | 'all';

export interface ActivityFilterState {
  status: StatusFilter;
  agent: AgentFilter;
  action: ActionFilter;
  date: DateFilter;
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilterState = {
  status: 'all',
  agent: 'all',
  action: 'all',
  date: 'all',
};

const STATUS_OPTIONS: ChipOption<StatusFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'pr_review', label: 'PR Review' },
  { value: 'done', label: 'Done' },
];

const AGENT_OPTIONS: ChipOption<AgentFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'hermes', label: 'Hermes' },
  { value: 'nexus', label: 'Nexus' },
];

const ACTION_OPTIONS: ChipOption<ActionFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'pr_opened', label: 'PR Opened' },
  { value: 'merged', label: 'Merged' },
];

const DATE_OPTIONS: ChipOption<DateFilter>[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'all', label: 'All Time' },
];

interface ActivityFiltersProps {
  value: ActivityFilterState;
  onChange: (next: ActivityFilterState) => void;
}

/**
 * Stacked, single-select filter chip groups for the Activity page. All groups
 * compound (AND) with each other and with the upstream project filter. Filtering
 * itself is client-side — see {@link filterActivities}.
 */
export function ActivityFilters({ value, onChange }: ActivityFiltersProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex min-w-max flex-wrap items-center gap-x-5 gap-y-3">
        <FilterChips
          label="Status"
          options={STATUS_OPTIONS}
          value={value.status}
          onChange={(status) => onChange({ ...value, status })}
        />
        <FilterChips
          label="Agent"
          options={AGENT_OPTIONS}
          value={value.agent}
          onChange={(agent) => onChange({ ...value, agent })}
        />
        <FilterChips
          label="Action"
          options={ACTION_OPTIONS}
          value={value.action}
          onChange={(action) => onChange({ ...value, action })}
        />
        <FilterChips
          label="Date"
          options={DATE_OPTIONS}
          value={value.date}
          onChange={(date) => onChange({ ...value, date })}
        />
      </div>
    </div>
  );
}

function matchesStatus(action: string, filter: StatusFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'in_progress':
      return action === 'task_claimed' || action === 'status_updated';
    case 'pr_review':
      return action === 'pr_opened';
    case 'done':
      return action === 'task_completed';
  }
}

function matchesAgent(actor: string, filter: AgentFilter): boolean {
  if (filter === 'all') return true;
  return actor.toLowerCase().includes(filter);
}

function matchesAction(action: string, filter: ActionFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'created':
      return action === 'task_created';
    case 'claimed':
      return action === 'task_claimed';
    case 'pr_opened':
      return action === 'pr_opened';
    case 'merged':
      return action === 'task_completed';
  }
}

function matchesDate(createdAt: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const created = new Date(createdAt).getTime();
  const now = new Date();
  if (filter === 'today') {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    return created >= startOfToday;
  }
  // 'week' — trailing 7 days
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return created >= weekAgo;
}

/** Apply all four chip groups (AND) to an already-loaded events array. */
export function filterActivities(
  events: EnrichedActivity[],
  f: ActivityFilterState
): EnrichedActivity[] {
  return events.filter(
    (e) =>
      matchesStatus(e.action, f.status) &&
      matchesAgent(e.actor, f.agent) &&
      matchesAction(e.action, f.action) &&
      matchesDate(e.created_at, f.date)
  );
}
