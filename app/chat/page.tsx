'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { SimpleChatInterface } from '@jazzmind/busibox-app';
import { useAuth } from '@jazzmind/busibox-app';
import type { Project } from '@/lib/types';

export default function GeneralChatPage() {
  const router = useRouter();
  const { authState } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const agentApiUrl = process.env.NEXT_PUBLIC_AGENT_API_URL || '';

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiToken, setApiToken] = useState<string | null>(null);

  // Fetch projects for context
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch(`${basePath}/api/projects`);
        if (response.ok) {
          const data = await response.json();
          setProjects(data.projects || []);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [basePath]);

  // Get API token for chat
  useEffect(() => {
    async function getToken() {
      try {
        const response = await fetch(`${basePath}/api/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audience: 'agent-api' }),
        });

        if (response.ok) {
          const data = await response.json();
          setApiToken(data.token);
        }
      } catch (err) {
        console.error('Failed to get API token:', err);
      }
    }

    getToken();
  }, [basePath]);

  const handleBack = () => {
    router.push(`${basePath}/`);
  };

  // Build welcome message with project context
  const buildWelcomeMessage = () => {
    if (projects.length === 0) {
      return `Hello! I'm your AI assistant for tracking project status.

You can ask me questions like:
- "What's the status of all projects?"
- "Which projects are at risk?"
- "What tasks are blocked?"
- "Show me recent updates"

You don't have any projects yet. Create one from the dashboard to get started!`;
    }

    const onTrack = projects.filter(p => p.status === 'on-track').length;
    const atRisk = projects.filter(p => p.status === 'at-risk').length;
    const offTrack = projects.filter(p => p.status === 'off-track').length;

    return `Hello! I'm your AI assistant for tracking project status.

**Current Overview:**
- ${projects.length} total projects
- ${onTrack} on track, ${atRisk} at risk, ${offTrack} off track

You can ask me questions like:
- "What's the status of [project name]?"
- "Which projects need attention?"
- "What tasks are due this week?"
- "Show me recent updates across all projects"
- "Summarize progress on AI initiatives"

How can I help you today?`;
  };

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
            Back to dashboard
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Project Assistant
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask questions about your projects and status
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-[calc(100vh-180px)] overflow-hidden">
          {apiToken ? (
            <SimpleChatInterface
              token={apiToken}
              agentUrl={agentApiUrl || undefined}
              agentId="status-assistant"
              placeholder="Ask about your projects..."
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
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Connecting to AI assistant...
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Sidebar - Optional */}
      {projects.length > 0 && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 hidden xl:block">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-lg">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
              Quick Topics
            </p>
            <div className="space-y-1">
              {['Overall status', 'At-risk projects', 'Blocked tasks', 'Recent updates'].map((topic) => (
                <button
                  key={topic}
                  className="block w-full text-left text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => {
                    // TODO: Inject question into chat
                    console.log('Quick topic:', topic);
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
