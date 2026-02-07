'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageSquarePlus,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@jazzmind/busibox-app/lib/utils';
import {
  ProjectStatusBadge,
  TaskStatusBadge,
  TaskPriorityBadge,
  CheckpointProgress,
  StatusTimeline,
} from '@/components/projects';
import { useAuth } from '@jazzmind/busibox-app';
import type { Project, Task, StatusUpdate, TaskStatus } from '@/lib/types';

interface ProjectDetailData {
  project: Project;
  tasks: Task[];
  updates: StatusUpdate[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { isReady, refreshKey } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${basePath}/api/projects/${id}?includeDetails=true`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Project not found');
          return;
        }
        throw new Error('Failed to fetch project');
      }

      const projectData = await response.json();
      setData(projectData);
    } catch (err) {
      console.error('Project fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (!isReady) {
      console.log('[ProjectDetail] Waiting for auth to be ready...');
      return;
    }
    console.log('[ProjectDetail] Auth ready, fetching project...');
    fetchProject();
  }, [id, isReady, refreshKey]);

  const handleUpdateStatus = () => {
    // Note: router.push automatically prepends basePath from next.config.ts
    router.push(`/projects/${id}/update`);
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!data) return;

    try {
      setUpdatingTaskId(taskId);

      const response = await fetch(`${basePath}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      // Update local state
      setData({
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
      });
    } catch (err) {
      console.error('Task update error:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const cycleStatus = (currentStatus: TaskStatus): TaskStatus => {
    const order: TaskStatus[] = ['todo', 'in-progress', 'done'];
    const currentIndex = order.indexOf(currentStatus);
    return order[(currentIndex + 1) % order.length];
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {error || 'Project not found'}
            </h2>
            <Link
              href={`${basePath}/`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { project, tasks, updates } = data;
  const incompleteTasks = tasks.filter((t) => t.status !== 'done');
  const completedTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back link */}
          <Link
            href={`${basePath}/`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>

          {/* Project header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {project.name}
                </h1>
                <ProjectStatusBadge status={project.status} size="lg" />
              </div>
              {project.description && (
                <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchProject()}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={handleUpdateStatus}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <MessageSquarePlus className="w-4 h-4" />
                Update Status
              </button>
            </div>
          </div>

          {/* Progress section */}
          <div className="mt-6">
            <CheckpointProgress
              overallProgress={project.progress}
              checkpointProgress={project.checkpointProgress}
              checkpointName={project.nextCheckpoint}
              checkpointDate={project.checkpointDate}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tasks
              </h2>
              <button className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {/* Incomplete Tasks */}
              {incompleteTasks.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No pending tasks
                </div>
              ) : (
                incompleteTasks.map((task) => {
                  const StatusIcon = statusIcons[task.status];
                  return (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <button
                        onClick={() => handleTaskStatusChange(task.id, cycleStatus(task.status))}
                        disabled={updatingTaskId === task.id}
                        className={cn(
                          'flex-shrink-0 mt-0.5 transition-colors',
                          statusIconColors[task.status],
                          updatingTaskId === task.id && 'opacity-50'
                        )}
                      >
                        <StatusIcon className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {task.title}
                          </p>
                          <button className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <TaskStatusBadge status={task.status} />
                          <TaskPriorityBadge priority={task.priority} />
                          {task.assignee && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {task.assignee}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Completed Tasks (collapsed) */}
              {completedTasks.length > 0 && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {completedTasks.length} completed tasks
                    </summary>
                    <div className="mt-3 space-y-2">
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400"
                        >
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="line-through">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>

          {/* Status Updates Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Status History
              </h2>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <StatusTimeline updates={updates} maxItems={10} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
