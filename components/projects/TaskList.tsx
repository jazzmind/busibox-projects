'use client';

import { useState } from 'react';
import { cn } from '@jazzmind/busibox-app/lib/utils';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
} from 'lucide-react';
import { TaskStatusBadge, TaskPriorityBadge } from './StatusBadge';
import type { Task, TaskStatus } from '@/lib/types';

interface TaskListProps {
  tasks: Task[];
  /** Show only incomplete tasks */
  hideCompleted?: boolean;
  /** Maximum tasks to show (rest collapsed) */
  maxVisible?: number;
  /** Callback when task status changes */
  onTaskStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  /** Callback when task is clicked */
  onTaskClick?: (task: Task) => void;
  /** Show compact view */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const statusIcons: Record<TaskStatus, typeof Circle> = {
  'todo': Circle,
  'in-progress': Clock,
  'blocked': AlertCircle,
  'done': CheckCircle,
};

const statusIconColors: Record<TaskStatus, string> = {
  'todo': 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300',
  'in-progress': 'text-blue-500 hover:text-blue-600',
  'blocked': 'text-red-500 hover:text-red-600',
  'done': 'text-green-500 hover:text-green-600',
};

export function TaskList({
  tasks,
  hideCompleted = false,
  maxVisible,
  onTaskStatusChange,
  onTaskClick,
  compact = false,
  className,
}: TaskListProps) {
  const [expanded, setExpanded] = useState(false);

  const filteredTasks = hideCompleted
    ? tasks.filter(t => t.status !== 'done')
    : tasks;

  const visibleTasks = maxVisible && !expanded
    ? filteredTasks.slice(0, maxVisible)
    : filteredTasks;

  const hasMore = maxVisible && filteredTasks.length > maxVisible;

  const cycleStatus = (currentStatus: TaskStatus): TaskStatus => {
    const order: TaskStatus[] = ['todo', 'in-progress', 'done'];
    const currentIndex = order.indexOf(currentStatus);
    return order[(currentIndex + 1) % order.length];
  };

  const handleStatusClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (onTaskStatusChange) {
      const newStatus = cycleStatus(task.status);
      onTaskStatusChange(task.id, newStatus);
    }
  };

  if (filteredTasks.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500 dark:text-gray-400 py-4 text-center', className)}>
        No tasks
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {visibleTasks.map((task) => {
        const StatusIcon = statusIcons[task.status];
        
        return (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            className={cn(
              'group flex items-start gap-3 p-2 rounded-lg transition-colors',
              onTaskClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
              task.status === 'done' && 'opacity-60'
            )}
          >
            {/* Status Icon (clickable) */}
            <button
              onClick={(e) => handleStatusClick(e, task)}
              className={cn(
                'flex-shrink-0 mt-0.5 transition-colors',
                statusIconColors[task.status],
                onTaskStatusChange && 'cursor-pointer'
              )}
              disabled={!onTaskStatusChange}
            >
              <StatusIcon className="w-5 h-5" />
            </button>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    'text-sm font-medium text-gray-900 dark:text-gray-100',
                    task.status === 'done' && 'line-through'
                  )}
                >
                  {task.title}
                </p>
                {!compact && (
                  <TaskPriorityBadge priority={task.priority} />
                )}
              </div>

              {!compact && (
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {task.assignee && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {task.assignee}
                    </span>
                  )}
                  {task.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                  {task.status !== 'todo' && task.status !== 'done' && (
                    <TaskStatusBadge status={task.status} />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Show More / Less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              {filteredTasks.length - maxVisible} more tasks
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ==========================================================================
// Compact Task Preview (for cards)
// ==========================================================================

interface TaskPreviewProps {
  tasks: Task[];
  maxItems?: number;
  className?: string;
}

export function TaskPreview({ tasks, maxItems = 3, className }: TaskPreviewProps) {
  const incompleteTasks = tasks.filter(t => t.status !== 'done');
  const visibleTasks = incompleteTasks.slice(0, maxItems);
  const remaining = incompleteTasks.length - maxItems;

  if (incompleteTasks.length === 0) {
    return (
      <div className={cn('text-xs text-gray-500 dark:text-gray-400', className)}>
        All tasks completed
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {visibleTasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              task.status === 'blocked' ? 'bg-red-500' :
              task.status === 'in-progress' ? 'bg-blue-500' :
              'bg-gray-400'
            )}
          />
          <span className="truncate">{task.title}</span>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-xs text-gray-400 dark:text-gray-500 pl-3.5">
          +{remaining} more
        </div>
      )}
    </div>
  );
}
