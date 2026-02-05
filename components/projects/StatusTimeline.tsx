'use client';

import { cn } from '@jazzmind/busibox-app/lib/utils';
import {
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Plus,
  User,
} from 'lucide-react';
import { ProjectStatusBadge } from './StatusBadge';
import type { StatusUpdate, ProjectStatus } from '@/lib/types';

interface StatusTimelineProps {
  updates: StatusUpdate[];
  /** Maximum updates to show */
  maxItems?: number;
  /** Show full content or truncated */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function StatusTimeline({
  updates,
  maxItems,
  compact = false,
  className,
}: StatusTimelineProps) {
  const visibleUpdates = maxItems ? updates.slice(0, maxItems) : updates;

  if (updates.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500 dark:text-gray-400 py-4 text-center', className)}>
        No status updates yet
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('relative', className)}>
      {/* Timeline line */}
      <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* Updates */}
      <div className="space-y-4">
        {visibleUpdates.map((update, index) => (
          <div key={update.id} className="relative flex gap-4">
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-white dark:bg-gray-900 border-2 border-blue-500 flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-blue-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-4">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {update.author && (
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <User className="w-3 h-3" />
                    {update.author}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(update.createdAt)}
                  {' at '}
                  {formatTime(update.createdAt)}
                </span>
              </div>

              {/* Status change indicator */}
              {update.previousStatus && update.newStatus && (
                <div className="flex items-center gap-2 mb-2">
                  <ProjectStatusBadge status={update.previousStatus} size="sm" />
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <ProjectStatusBadge status={update.newStatus} size="sm" />
                </div>
              )}

              {/* Content */}
              <div
                className={cn(
                  'text-sm text-gray-700 dark:text-gray-300',
                  compact && 'line-clamp-3'
                )}
              >
                {update.content}
              </div>

              {/* Tasks completed/added */}
              {(update.tasksCompleted.length > 0 || update.tasksAdded.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {update.tasksCompleted.length > 0 && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" />
                      {update.tasksCompleted.length} completed
                    </span>
                  )}
                  {update.tasksAdded.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Plus className="w-3 h-3" />
                      {update.tasksAdded.length} added
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show more indicator */}
      {maxItems && updates.length > maxItems && (
        <div className="text-center pt-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            +{updates.length - maxItems} more updates
          </span>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Compact Update Preview (for cards)
// ==========================================================================

interface UpdatePreviewProps {
  update: StatusUpdate | null;
  className?: string;
}

export function UpdatePreview({ update, className }: UpdatePreviewProps) {
  if (!update) {
    return (
      <div className={cn('text-xs text-gray-500 dark:text-gray-400', className)}>
        No recent updates
      </div>
    );
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          Last update
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          {formatRelativeTime(update.createdAt)}
        </span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
        {update.content}
      </p>
    </div>
  );
}
