'use client';

import { cn } from '@jazzmind/busibox-app/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pause,
  TrendingUp,
} from 'lucide-react';
import type { ProjectStatus, TaskStatus, TaskPriority } from '@/lib/types';

// ==========================================================================
// Project Status Badge
// ==========================================================================

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const projectStatusConfig: Record<ProjectStatus, {
  label: string;
  bgClass: string;
  textClass: string;
  icon: typeof CheckCircle2;
}> = {
  'on-track': {
    label: 'On Track',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    icon: TrendingUp,
  },
  'at-risk': {
    label: 'At Risk',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    icon: AlertTriangle,
  },
  'off-track': {
    label: 'Off Track',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  'completed': {
    label: 'Completed',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    icon: CheckCircle2,
  },
  'paused': {
    label: 'Paused',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-600 dark:text-gray-400',
    icon: Pause,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export function ProjectStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: ProjectStatusBadgeProps) {
  const config = projectStatusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.bgClass,
        config.textClass,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </span>
  );
}

// ==========================================================================
// Task Status Badge
// ==========================================================================

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const taskStatusConfig: Record<TaskStatus, {
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
}> = {
  'todo': {
    label: 'To Do',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-600 dark:text-gray-400',
    dotClass: 'bg-gray-400',
  },
  'in-progress': {
    label: 'In Progress',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  'blocked': {
    label: 'Blocked',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400',
    dotClass: 'bg-red-500',
  },
  'done': {
    label: 'Done',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    dotClass: 'bg-green-500',
  },
};

export function TaskStatusBadge({
  status,
  size = 'sm',
  className,
}: TaskStatusBadgeProps) {
  const config = taskStatusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.bgClass,
        config.textClass,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotClass)} />
      {config.label}
    </span>
  );
}

// ==========================================================================
// Task Priority Badge
// ==========================================================================

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
  className?: string;
}

const priorityConfig: Record<TaskPriority, {
  label: string;
  textClass: string;
}> = {
  'low': {
    label: 'Low',
    textClass: 'text-gray-500 dark:text-gray-400',
  },
  'medium': {
    label: 'Medium',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  'high': {
    label: 'High',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  'critical': {
    label: 'Critical',
    textClass: 'text-red-600 dark:text-red-400',
  },
};

export function TaskPriorityBadge({
  priority,
  size = 'sm',
  className,
}: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <span
      className={cn(
        'font-medium',
        config.textClass,
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      {config.label}
    </span>
  );
}
