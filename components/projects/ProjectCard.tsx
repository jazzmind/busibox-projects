'use client';

import Link from 'next/link';
import { cn } from '@jazzmind/busibox-app/lib/utils';
import {
  MoreHorizontal,
  MessageSquarePlus,
  ExternalLink,
  Users,
  Tag,
} from 'lucide-react';
import { CheckpointProgress } from './ProgressBar';
import { ProjectStatusBadge } from './StatusBadge';
import { TaskPreview } from './TaskList';
import { UpdatePreview } from './StatusTimeline';
import type { Project, Task, StatusUpdate } from '@/lib/types';

interface ProjectCardProps {
  project: Project;
  tasks?: Task[];
  recentUpdate?: StatusUpdate | null;
  /** Callback when update status is clicked */
  onUpdateClick?: (projectId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function ProjectCard({
  project,
  tasks = [],
  recentUpdate,
  onUpdateClick,
  className,
}: ProjectCardProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700',
        'shadow-sm hover:shadow-md transition-shadow duration-200',
        'overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link
              href={`${basePath}/projects/${project.id}`}
              className="group flex items-center gap-2"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            {project.description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>

        {/* Team & Tags */}
        {(project.team.length > 0 || project.tags.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.team.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Users className="w-3 h-3" />
                {project.team.slice(0, 3).join(', ')}
                {project.team.length > 3 && ` +${project.team.length - 3}`}
              </span>
            )}
            {project.tags.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Tag className="w-3 h-3" />
                {project.tags.slice(0, 2).join(', ')}
                {project.tags.length > 2 && ` +${project.tags.length - 2}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress Section */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        <CheckpointProgress
          overallProgress={project.progress}
          checkpointProgress={project.checkpointProgress}
          checkpointName={project.nextCheckpoint}
          checkpointDate={project.checkpointDate}
        />
      </div>

      {/* Tasks Preview */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Upcoming Tasks
          </span>
          <Link
            href={`${basePath}/projects/${project.id}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all
          </Link>
        </div>
        <TaskPreview tasks={tasks} maxItems={3} />
      </div>

      {/* Recent Update Preview */}
      {recentUpdate !== undefined && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
          <UpdatePreview update={recentUpdate} />
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onUpdateClick?.(project.id)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Update Status
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Project Card Skeleton
// ==========================================================================

export function ProjectCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mt-2" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        <div className="space-y-3">
          <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>

      {/* Tasks */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
        <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}
