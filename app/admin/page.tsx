'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@jazzmind/busibox-app';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  Settings,
  AlertTriangle,
  Network,
  Database,
} from 'lucide-react';

interface AgentStatus {
  name: string;
  displayName: string;
  description: string;
  exists: boolean;
  id?: string;
  error?: string;
}

interface AgentData {
  agents: AgentStatus[];
  total: number;
  created: number;
}

interface GraphSyncResult {
  document: string;
  documentId: string;
  graphNode: string;
  recordCount: number;
  syncedCount: number;
  error?: string;
}

interface GraphSyncData {
  success: boolean;
  message: string;
  results: GraphSyncResult[];
  totalRecords: number;
  totalSynced: number;
}

export default function AdminPage() {
  const { isReady, refreshKey } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Graph sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GraphSyncData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchAgentStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${basePath}/api/admin/agents`);

      if (!response.ok) {
        throw new Error('Failed to fetch agent status');
      }

      const data = await response.json();
      setAgentData(data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to load agent status');
    } finally {
      setLoading(false);
    }
  };

  const createAgents = async (update = false) => {
    try {
      setCreating(true);
      setError(null);
      setSuccessMessage(null);

      const url = update 
        ? `${basePath}/api/admin/agents?update=true`
        : `${basePath}/api/admin/agents`;
      
      const response = await fetch(url, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(update ? 'Failed to update agents' : 'Failed to create agents');
      }

      const result = await response.json();
      setSuccessMessage(result.message);

      // Refresh agent status
      await fetchAgentStatus();
    } catch (err) {
      console.error('Failed to create agents:', err);
      setError(err instanceof Error ? err.message : 'Failed to create agents');
    } finally {
      setCreating(false);
    }
  };

  const syncGraphData = async () => {
    try {
      setSyncing(true);
      setSyncError(null);
      setSyncResult(null);

      const response = await fetch(`${basePath}/api/admin/graph-sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || data?.detail || `Failed to sync graph data (${response.status})`);
      }

      const result: GraphSyncData = await response.json();
      setSyncResult(result);
    } catch (err) {
      console.error('Failed to sync graph:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to sync graph data');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!isReady) return;
    fetchAgentStatus();
  }, [isReady, refreshKey]);

  const allAgentsExist = agentData?.agents.every(a => a.exists) ?? false;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Admin Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure agents and app settings
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Agent Setup Section */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Agents
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Agents required for chat and status updates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAgentStatus}
                  disabled={loading}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {allAgentsExist ? (
                  <button
                    onClick={() => createAgents(true)}
                    disabled={creating || loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {creating ? 'Updating...' : 'Update Agents'}
                  </button>
                ) : (
                  <button
                    onClick={() => createAgents(false)}
                    disabled={creating || loading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-4 h-4" />
                    {creating ? 'Creating...' : 'Create Agents'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Agent List */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && !agentData ? (
              <div className="px-6 py-8 text-center">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Loading agent status...</p>
              </div>
            ) : agentData?.agents.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-gray-600 dark:text-gray-400">No agents configured</p>
              </div>
            ) : (
              agentData?.agents.map((agent) => (
                <div key={agent.name} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        agent.exists
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-amber-100 dark:bg-amber-900/30'
                      }`}
                    >
                      {agent.exists ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.displayName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {agent.description}
                      </p>
                      {agent.error && !agent.exists && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                          Error: {agent.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {agent.exists ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                        Not Created
                      </span>
                    )}
                    {agent.id && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                        {agent.id.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          {agentData && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {agentData.created} of {agentData.total} agents active
                </span>
                {allAgentsExist && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    All agents ready
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Graph Sync Section */}
        <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Graph Database
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sync project data to Neo4j for relationship visualization
                  </p>
                </div>
              </div>
              <button
                onClick={syncGraphData}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Database className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync to Graph'}
              </button>
            </div>
          </div>

          <div className="px-6 py-4">
            {/* Sync Error */}
            {syncError && (
              <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{syncError}</p>
                </div>
              </div>
            )}

            {/* Sync Results */}
            {syncResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  syncResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center gap-2">
                    {syncResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${
                      syncResult.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}>
                      {syncResult.message}
                    </p>
                  </div>
                </div>

                {/* Per-document results */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {syncResult.results.map((result) => (
                    <div key={result.documentId} className="py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          result.error
                            ? 'bg-red-100 dark:bg-red-900/30'
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                          {result.error ? (
                            <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {result.document}
                          </span>
                          {result.graphNode && (
                            <span className="ml-2 text-xs text-gray-400 font-mono">
                              ({result.graphNode})
                            </span>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">
                              {result.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {!result.error && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {result.syncedCount} / {result.recordCount} records
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info when no sync has been run */}
            {!syncResult && !syncError && !syncing && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click &quot;Sync to Graph&quot; to push all existing projects, tasks, and status updates
                to the graph database. This enables the Graph visualization page to show
                relationships between your data.
              </p>
            )}

            {/* Syncing indicator */}
            {syncing && (
              <div className="flex items-center gap-3 py-4">
                <RefreshCw className="w-5 h-5 text-violet-500 animate-spin" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Syncing projects, tasks, and updates to graph database...
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            About AI Agents
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            This app uses two AI agents to provide intelligent status tracking:
          </p>
          <ul className="mt-2 text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>
              <strong>Status Update Assistant</strong> - Helps you quickly update project status
              through conversation
            </li>
            <li>
              <strong>Project Status Assistant</strong> - Answers questions about your projects and
              provides insights
            </li>
          </ul>
          <p className="mt-2 text-sm text-blue-700 dark:text-blue-400">
            Click &quot;Create Agents&quot; to initialize these agents in the system.
          </p>
        </div>
      </div>
    </div>
  );
}
