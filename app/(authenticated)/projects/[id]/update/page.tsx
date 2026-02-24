'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { SimpleChatInterface } from '@jazzmind/busibox-app';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { ProjectStatusBadge, CheckpointProgress } from '@/components/projects';
import type { Project, Task } from '@/lib/types';

interface ProjectData {
  project: Project;
  tasks: Task[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StatusUpdatePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const session = useSession();
  const isReady = (session as { isReady?: boolean }).isReady ?? true;
  const refreshKey = (session as { refreshKey?: number }).refreshKey ?? 0;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  
  // Use proxy URL for agent API calls (handles auth server-side)
  // This avoids CORS issues and keeps internal IPs unexposed
  // Note: Don't include basePath - Next.js handles it automatically for API routes
  const agentApiUrl = '/api/agent';

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);

  // Fetch project data - wait for auth to be ready
  useEffect(() => {
    if (!isReady) {
      console.log('[StatusUpdate] Waiting for auth to be ready...');
      return;
    }
    
    async function fetchProject() {
      try {
        setLoading(true);
        const response = await fetch(`${basePath}/api/projects/${id}?includeDetails=true`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Project not found');
            return;
          }
          throw new Error('Failed to fetch project');
        }

        const data = await response.json();
        setProjectData(data);
      } catch (err) {
        console.error('Project fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id, basePath, isReady, refreshKey]);

  // Get API token for chat - wait for auth to be ready
  useEffect(() => {
    if (!isReady) return;
    
    async function getToken() {
      try {
        const response = await fetch(`${basePath}/api/auth/token`);

        if (response.ok) {
          const data = await response.json();
          setApiToken(data.token);
        } else {
          console.error('Failed to get API token:', response.status);
        }
      } catch (err) {
        console.error('Failed to get API token:', err);
      }
    }

    getToken();
  }, [basePath, isReady, refreshKey]);

  const handleBack = () => {
    // Note: router.push automatically prepends basePath from next.config.ts
    router.push(`/projects/${id}`);
  };

  // Build welcome message with context
  const buildWelcomeMessage = () => {
    if (!projectData) return 'Ready to update your project status.';

    const { project, tasks } = projectData;
    const activeTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'todo');
    const taskList = activeTasks.slice(0, 5).map(t => `- ${t.title}`).join('\n');

    return `Ready to update status for **${project.name}**.

Current progress: ${project.progress}%
Status: ${project.status}

${activeTasks.length > 0 ? `**Active tasks:**\n${taskList}${activeTasks.length > 5 ? `\n- ...and ${activeTasks.length - 5} more` : ''}` : 'No active tasks.'}

What have you been working on?`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading project...</div>
      </div>
    );
  }

  if (error || !projectData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {error || 'Project not found'}
            </h2>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Return to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { project, tasks } = projectData;
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to project
          </button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Update: {project.name}
                </h1>
                <ProjectStatusBadge status={project.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{activeTasks.length} active tasks</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {completedCount} completed
                </span>
              </div>
            </div>
            <div className="w-48 hidden sm:block">
              <CheckpointProgress
                overallProgress={project.progress}
                checkpointProgress={project.checkpointProgress}
                checkpointName={project.nextCheckpoint}
                checkpointDate={project.checkpointDate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-[calc(100vh-220px)] overflow-hidden">
          {apiToken ? (
            <SimpleChatInterface
              token={apiToken || ''} // Token passed for compatibility, but proxy uses cookie auth
              agentUrl={agentApiUrl}
              agentId="status-update"
              placeholder="What did you work on today?"
              welcomeMessage={buildWelcomeMessage()}
              enableWebSearch={false}
              enableDocSearch={true}
              allowAttachments={false}
              model="chat"
              useStreaming={true}
              useAgenticStreaming={true}
              onMessageSent={(message) => {
                console.log('Message sent:', message);
              }}
              onResponseReceived={(response) => {
                console.log('Response received:', response.substring(0, 100));
              }}
              {...{ metadata: { projectId: id, projectName: project.name, appName: 'busibox-projects' } } as any}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Connecting to AI assistant...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
