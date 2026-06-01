export type TaskStatus = 'brief_ready' | 'in_progress' | 'pr_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repo_url: string | null;
  repo_name: string | null;
  default_branch: string | null;
  color: string;
  icon: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  brief: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  claimed_by: string | null;
  claimed_at: string | null;
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  sort_order: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ActivityLog {
  id: string;
  project_id: string | null;
  task_id: string | null;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export type PrState = 'open' | 'merged' | 'closed';

export interface GitHubStatus {
  connected: boolean;
  login?: string | null;
  scope?: string | null;
  connected_at?: string | null;
}

export const KANBAN_COLUMNS: { id: TaskStatus; label: string; description: string }[] = [
  { id: 'brief_ready', label: '📋 Brief Ready', description: 'Waiting for an agent' },
  { id: 'in_progress', label: '🔄 In Progress', description: 'Agent is working' },
  { id: 'pr_review',   label: '👀 PR Review',   description: 'Pull request opened' },
  { id: 'done',        label: '✅ Done',         description: 'Merged and complete' },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: '#64748B',
  medium: '#F59E0B',
  high: '#F97316',
  critical: '#EF4444',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  brief_ready: '#F59E0B',
  in_progress: '#3B82F6',
  pr_review: '#A855F7',
  done: '#10B981',
};
