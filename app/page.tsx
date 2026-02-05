'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MessageSquare,
  RefreshCw,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { ProjectCard, ProjectCardSkeleton } from '@/components/projects';
import type { Project, Task, StatusUpdate } from '@/lib/types';

interface ProjectWithDetails extends Project {
  tasks: Task[];
  recentUpdates: StatusUpdate[];
}

interface DashboardData {
  projects: ProjectWithDetails[];
  stats: {
    totalProjects: number;
    onTrack: number;
    atRisk: number;
    offTrack: number;
    completed: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${basePath}/api/projects?includeTasks=true`);
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view your projects');
          return;
        }
        throw new Error('Failed to fetch projects');
      }

      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const initializeApp = async () => {
    try {
      setIsInitializing(true);
      const response = await fetch(`${basePath}/api/setup`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to initialize app');
      }
      await fetchDashboard();
    } catch (err) {
      console.error('Initialization error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleUpdateClick = (projectId: string) => {
    router.push(`${basePath}/projects/${projectId}/update`);
  };

  const handleNewProject = () => {
    // TODO: Open new project modal/page
    console.log('New project');
  };

  const handleOpenChat = () => {
    router.push(`${basePath}/chat`);
  };

  // Stats cards config
  const statsCards = data ? [
    { label: 'Total Projects', value: data.stats.totalProjects, icon: BarChart3, color: 'text-gray-600 dark:text-gray-400' },
    { label: 'On Track', value: data.stats.onTrack, icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
    { label: 'At Risk', value: data.stats.atRisk, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Off Track', value: data.stats.offTrack, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    { label: 'Completed', value: data.stats.completed, icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Initiative Status
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track progress across all your AI projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenChat}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => fetchDashboard()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
              <button
                onClick={initializeApp}
                disabled={isInitializing}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                {isInitializing ? 'Initializing...' : 'Initialize App'}
              </button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading State */}
        {loading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && data && data.projects.length === 0 && (
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No projects yet
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Create your first project to start tracking your AI initiatives.
            </p>
            <button
              onClick={handleNewProject}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create First Project
            </button>
          </div>
        )}

        {/* Project Cards Grid */}
        {!loading && data && data.projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={project.tasks}
                recentUpdate={project.recentUpdates[0] || null}
                onUpdateClick={handleUpdateClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
