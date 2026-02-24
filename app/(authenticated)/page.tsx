'use client';

import { useEffect, useMemo, useState } from 'react';
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
  X,
  Layers,
} from 'lucide-react';
import { ProjectCard, ProjectCardSkeleton } from '@/components/projects';
import { UserPicker, type UserProfile } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import type { Project, Task, StatusUpdate, CreateProjectInput, ProjectStatus, Roadmap } from '@/lib/types';

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

type SortOption =
  | 'updated-desc'
  | 'created-desc'
  | 'alpha-asc'
  | 'progress-desc'
  | 'progress-asc'
  | 'status-asc';

const SORT_STORAGE_KEY = 'busibox-projects-dashboard-sort';

const SORT_LABELS: Record<SortOption, string> = {
  'updated-desc': 'Last Updated',
  'created-desc': 'Date Created',
  'alpha-asc': 'Alphabetical (A-Z)',
  'progress-desc': 'Progress (High to Low)',
  'progress-asc': 'Progress (Low to High)',
  'status-asc': 'Status',
};

const STATUS_ORDER: Record<ProjectStatus, number> = {
  'on-track': 1,
  'at-risk': 2,
  'off-track': 3,
  'paused': 4,
  'completed': 5,
};

export default function DashboardPage() {
  const router = useRouter();
  const session = useSession();
  const isReady = (session as { isReady?: boolean }).isReady ?? true;
  const refreshKey = (session as { refreshKey?: number }).refreshKey ?? 0;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('updated-desc');
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [filterRoadmap, setFilterRoadmap] = useState<string>('all');
  const [groupByRoadmap, setGroupByRoadmap] = useState(false);
  
  // New Project Modal state
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectInput>({
    name: '',
    description: '',
    status: 'on-track' as ProjectStatus,
  });

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

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${basePath}/api/users`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch {
      setUsers([]);
    }
  };

  const fetchRoadmaps = async () => {
    try {
      const response = await fetch(`${basePath}/api/roadmaps`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      setRoadmaps(Array.isArray(payload.roadmaps) ? payload.roadmaps : []);
    } catch {
      setRoadmaps([]);
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

  // Wait for auth to be ready before fetching data
  // Also refetch when refreshKey changes (after token refresh)
  useEffect(() => {
    if (!isReady) {
      console.log('[Dashboard] Waiting for auth to be ready...');
      return;
    }
    console.log('[Dashboard] Auth ready, fetching dashboard...');
    fetchDashboard();
    fetchUsers();
    fetchRoadmaps();
  }, [isReady, refreshKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(SORT_STORAGE_KEY) as SortOption | null;
    if (saved && saved in SORT_LABELS) {
      setSortOption(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SORT_STORAGE_KEY, sortOption);
  }, [sortOption]);

  const handleUpdateClick = (projectId: string) => {
    // Note: router.push automatically prepends basePath from next.config.ts
    router.push(`/projects/${projectId}/update`);
  };

  const handleNewProject = () => {
    setNewProject({ name: '', description: '', status: 'on-track' });
    setShowNewProjectModal(true);
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    
    try {
      setIsCreating(true);
      const response = await fetch(`${basePath}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      
      const createdProject = await response.json();
      setShowNewProjectModal(false);
      
      // Navigate to the new project (router.push auto-prepends basePath)
      router.push(`/projects/${createdProject.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChat = () => {
    // Note: router.push automatically prepends basePath from next.config.ts
    router.push('/chat');
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`${basePath}/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Remove from local state
      if (data) {
        setData({
          ...data,
          projects: data.projects.filter(p => p.id !== projectId),
          stats: {
            ...data.stats,
            totalProjects: data.stats.totalProjects - 1,
          },
        });
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
    }
  };

  // Stats cards config
  const statsCards = data ? [
    { label: 'Total Projects', value: data.stats.totalProjects, icon: BarChart3, color: 'text-gray-600 dark:text-gray-400' },
    { label: 'On Track', value: data.stats.onTrack, icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
    { label: 'At Risk', value: data.stats.atRisk, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Off Track', value: data.stats.offTrack, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
    { label: 'Completed', value: data.stats.completed, icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400' },
  ] : [];

  const filteredByRoadmap = useMemo(() => {
    if (!data?.projects) return [];
    if (filterRoadmap === 'all') return data.projects;
    if (filterRoadmap === '__unassigned__') {
      return data.projects.filter((p) => !p.roadmaps?.length);
    }
    return data.projects.filter((p) => p.roadmaps?.includes(filterRoadmap));
  }, [data?.projects, filterRoadmap]);

  const sortedProjects = useMemo(() => {
    const projects = [...filteredByRoadmap];
    projects.sort((a, b) => {
      switch (sortOption) {
        case 'created-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'alpha-asc':
          return a.name.localeCompare(b.name);
        case 'progress-desc':
          return b.progress - a.progress;
        case 'progress-asc':
          return a.progress - b.progress;
        case 'status-asc': {
          const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (statusDiff !== 0) return statusDiff;
          return a.name.localeCompare(b.name);
        }
        case 'updated-desc':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
    return projects;
  }, [filteredByRoadmap, sortOption]);

  const roadmapGroups = useMemo(() => {
    if (!groupByRoadmap || !data?.projects) return null;
    const roadmapMap = new Map<string, Roadmap>();
    for (const rm of roadmaps) roadmapMap.set(rm.id, rm);

    const groups = new Map<string, { roadmap: Roadmap | null; projects: typeof sortedProjects }>();

    for (const project of sortedProjects) {
      const rmIds = (project.roadmaps?.length) ? project.roadmaps : ['__unassigned__'];
      for (const rmId of rmIds) {
        if (!groups.has(rmId)) {
          groups.set(rmId, {
            roadmap: roadmapMap.get(rmId) || null,
            projects: [],
          });
        }
        groups.get(rmId)!.projects.push(project);
      }
    }

    return [...groups.entries()]
      .sort(([, a], [, b]) => (a.roadmap?.sortOrder ?? 9999) - (b.roadmap?.sortOrder ?? 9999));
  }, [groupByRoadmap, sortedProjects, roadmaps, data?.projects]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Initiative Status
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track progress across all your projects
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Roadmap filter */}
              {roadmaps.length > 0 && (
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterRoadmap}
                    onChange={(e) => setFilterRoadmap(e.target.value)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Roadmaps</option>
                    {roadmaps.map((rm) => (
                      <option key={rm.id} value={rm.id}>{rm.name}</option>
                    ))}
                    <option value="__unassigned__">Unassigned</option>
                  </select>
                  <button
                    onClick={() => setGroupByRoadmap(!groupByRoadmap)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      groupByRoadmap
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                    title="Group by roadmap"
                  >
                    Group
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label
                  htmlFor="dashboard-sort"
                  className="text-sm text-gray-600 dark:text-gray-300"
                >
                  Sort
                </label>
                <select
                  id="dashboard-sort"
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(SORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
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
        {!loading && data && data.projects.length > 0 && !roadmapGroups && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={project.tasks}
                recentUpdate={project.recentUpdates[0] || null}
                onUpdateClick={handleUpdateClick}
                onDelete={handleDeleteProject}
                users={users}
              />
            ))}
          </div>
        )}

        {/* Grouped by Roadmap */}
        {!loading && data && data.projects.length > 0 && roadmapGroups && (
          <div className="space-y-8">
            {roadmapGroups.map(([rmId, group]) => (
              <div key={rmId}>
                <div className="flex items-center gap-3 mb-4">
                  {group.roadmap ? (
                    <>
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: group.roadmap.color }}
                      />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {group.roadmap.name}
                      </h2>
                    </>
                  ) : (
                    <>
                      <div className="w-4 h-4 rounded-full bg-gray-400" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Unassigned
                      </h2>
                    </>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({group.projects.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.projects.map((project) => (
                    <ProjectCard
                      key={`${rmId}-${project.id}`}
                      project={project}
                      tasks={project.tasks}
                      recentUpdate={project.recentUpdates[0] || null}
                      onUpdateClick={handleUpdateClick}
                      onDelete={handleDeleteProject}
                      users={users}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowNewProjectModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  New Project
                </h2>
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="project-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Project Name *
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                    placeholder="e.g., AI Customer Service Bot"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="project-description"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="project-description"
                    value={newProject.description || ''}
                    onChange={(e) =>
                      setNewProject({ ...newProject, description: e.target.value })
                    }
                    placeholder="Brief description of the project..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="project-status"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Initial Status
                  </label>
                  <select
                    id="project-status"
                    value={newProject.status}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="on-track">On Track</option>
                    <option value="at-risk">At Risk</option>
                    <option value="off-track">Off Track</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Owner
                  </label>
                  <UserPicker
                    users={users}
                    value={newProject.owner}
                    placeholder="Assign owner"
                    onChange={(userId) =>
                      setNewProject({
                        ...newProject,
                        owner: userId || undefined,
                      })
                    }
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim() || isCreating}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
