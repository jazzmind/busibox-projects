'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
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
  Sparkles,
  Link2,
  Layers,
  Download,
  Upload,
  FileText,
  FileDown,
} from 'lucide-react';
import { JiraSettingsSection } from '@/components/jira/JiraSettingsSection';
import { JiraSyncManager } from '@/components/jira/JiraSyncManager';
import { RoadmapManager } from '@/components/roadmap/RoadmapManager';

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

interface AdminSettings {
  id: string;
  leadImageStyleInstructions: string;
  updatedAt: string;
}

interface ImageGenerationSummary {
  mode: 'missing' | 'all';
  totalProjects: number;
  targetedProjects: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    projectId: string;
    projectName: string;
    success: boolean;
    error?: string;
  }>;
}

export default function AdminPage() {
  const session = useSession();
  const isReady = (session as { isReady?: boolean }).isReady ?? true;
  const refreshKey = (session as { refreshKey?: number }).refreshKey ?? 0;
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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [leadImageStyle, setLeadImageStyle] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [imageJobRunning, setImageJobRunning] = useState(false);
  const [imageJobError, setImageJobError] = useState<string | null>(null);
  const [imageJobResult, setImageJobResult] = useState<ImageGenerationSummary | null>(null);
  const [jiraConnected, setJiraConnected] = useState(false);

  // Import/Export state
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    dryRun: boolean;
    summary: { roadmaps: number; projects: number; tasks: number; updates: number };
    warnings: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    created: { roadmaps: number; projects: number; tasks: number; updates: number };
    warnings: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      setSettingsError(null);
      const response = await fetch(`${basePath}/api/admin/settings`);
      if (!response.ok) {
        throw new Error('Failed to load image settings');
      }
      const data: AdminSettings = await response.json();
      setLeadImageStyle(data.leadImageStyleInstructions || '');
    } catch (err) {
      console.error('Failed to load settings:', err);
      setSettingsError(err instanceof Error ? err.message : 'Failed to load image settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSettingsSaving(true);
      setSettingsError(null);
      setSettingsMessage(null);

      const response = await fetch(`${basePath}/api/admin/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadImageStyleInstructions: leadImageStyle }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save image settings');
      }

      setSettingsMessage('Lead image style instructions saved.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSettingsError(err instanceof Error ? err.message : 'Failed to save image settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const runImageGeneration = async (mode: 'missing' | 'all') => {
    try {
      setImageJobRunning(true);
      setImageJobError(null);
      setImageJobResult(null);

      const response = await fetch(`${basePath}/api/admin/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to run image generation');
      }

      const result: ImageGenerationSummary = await response.json();
      setImageJobResult(result);
    } catch (err) {
      console.error('Failed to run image generation:', err);
      setImageJobError(err instanceof Error ? err.message : 'Failed to run image generation');
    } finally {
      setImageJobRunning(false);
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

  const handleExportMarkdown = async () => {
    try {
      setExporting(true);
      const response = await fetch(`${basePath}/api/admin/export`);
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `busibox-projects-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setImportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJson = async () => {
    try {
      setExporting(true);
      const response = await fetch(`${basePath}/api/admin/export?format=json`);
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `busibox-projects-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setImportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${basePath}/api/admin/template`);
      if (!response.ok) throw new Error('Template download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'busibox-projects-template.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download failed:', err);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      setImportError(null);
      setImportResult(null);
      setImportPreview(null);
      setPendingFile(file);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${basePath}/api/admin/import?dryRun=true`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Preview failed');
      }

      const preview = await response.json();
      setImportPreview(preview);
    } catch (err) {
      console.error('Import preview failed:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to preview import');
      setPendingFile(null);
    }
  };

  const handleImportConfirm = async () => {
    if (!pendingFile) return;
    try {
      setImporting(true);
      setImportError(null);

      const formData = new FormData();
      formData.append('file', pendingFile);

      const response = await fetch(`${basePath}/api/admin/import`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Import failed');
      }

      const result = await response.json();
      setImportResult(result);
      setImportPreview(null);
      setPendingFile(null);
    } catch (err) {
      console.error('Import failed:', err);
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleImportCancel = () => {
    setPendingFile(null);
    setImportPreview(null);
    setImportError(null);
  };

  useEffect(() => {
    if (!isReady) return;
    fetchAgentStatus();
    fetchSettings();
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

        {/* Roadmaps Section */}
        <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Roadmaps
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create and manage roadmaps to organize your projects into strategic tracks
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <RoadmapManager />
          </div>
        </section>

        {/* JIRA Integration Section */}
        <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  JIRA Integration
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect your personal JIRA Cloud account and manage bi-directional epic/story sync.
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/40">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connection</h3>
            </div>
            <JiraSettingsSection basePath={basePath} onConnectedChange={setJiraConnected} />
          </div>

          <div>
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Project Mapping & Sync</h3>
            </div>
            <JiraSyncManager basePath={basePath} enabled={jiraConnected} />
          </div>
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

        {/* Lead Image Generation Section */}
        <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Lead Image Generation
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Set style guidance used by project image generation and run bulk image generation jobs.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4">
            {settingsError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{settingsError}</p>
              </div>
            )}

            {settingsMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-700 dark:text-green-300">{settingsMessage}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="lead-image-style"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Style Instructions
              </label>
              <textarea
                id="lead-image-style"
                rows={4}
                value={leadImageStyle}
                onChange={(event) => setLeadImageStyle(event.target.value)}
                placeholder="Example: cinematic matte painting, dramatic lighting, cool color palette, no text"
                disabled={settingsLoading || settingsSaving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y disabled:opacity-60"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Used when clicking the image button in project details and when running bulk generation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveSettings}
                disabled={settingsLoading || settingsSaving || !leadImageStyle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsSaving ? 'Saving...' : 'Save Style Instructions'}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Bulk Image Operations
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => runImageGeneration('missing')}
                  disabled={imageJobRunning || settingsLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imageJobRunning ? 'Running...' : 'Generate Missing Images'}
                </button>
                <button
                  onClick={() => runImageGeneration('all')}
                  disabled={imageJobRunning || settingsLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imageJobRunning ? 'Running...' : 'Regenerate All Images'}
                </button>
              </div>

              {imageJobError && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{imageJobError}</p>
                </div>
              )}

              {imageJobResult && (
                <div className="mt-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Mode: <strong>{imageJobResult.mode === 'all' ? 'Regenerate All' : 'Missing Only'}</strong> | Targets: <strong>{imageJobResult.targetedProjects}</strong> | Success: <strong>{imageJobResult.successCount}</strong> | Failed: <strong>{imageJobResult.failedCount}</strong>
                  </p>
                  {imageJobResult.failedCount > 0 && (
                    <ul className="mt-2 text-xs text-red-600 dark:text-red-300 space-y-1">
                      {imageJobResult.results
                        .filter((item) => !item.success)
                        .slice(0, 10)
                        .map((item) => (
                          <li key={item.projectId}>
                            {item.projectName}: {item.error || 'Unknown error'}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Import / Export Section */}
        <section className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Import &amp; Export
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Export your roadmaps, projects and tasks as markdown or import from a file
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 space-y-6">
            {importError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{importError}</p>
                </div>
              </div>
            )}

            {importResult && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Import successful</p>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Created: {importResult.created.roadmaps} roadmaps, {importResult.created.projects} projects,{' '}
                  {importResult.created.tasks} tasks, {importResult.created.updates} updates
                </p>
                {importResult.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Warnings:</p>
                    <ul className="text-xs text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                      {importResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Export */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Export
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportMarkdown}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                  {exporting ? 'Exporting...' : 'Export Markdown'}
                </button>
                <button
                  onClick={handleExportJson}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                  Export JSON
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  Download Template
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                The template includes a schema reference so an AI can populate it with your project data.
              </p>
            </div>

            {/* Import */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Import
              </h3>

              {!importPreview ? (
                <div>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span>{' '}
                        or drag a markdown file
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        .md files exported from this system or created from the template
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".md,.markdown,text/markdown,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                      Import Preview
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                      File: <strong>{pendingFile?.name}</strong>
                    </p>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {importPreview.summary.roadmaps}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Roadmaps</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {importPreview.summary.projects}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {importPreview.summary.tasks}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {importPreview.summary.updates}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Updates</p>
                      </div>
                    </div>
                    {importPreview.warnings.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Warnings:</p>
                        <ul className="text-xs text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                          {importPreview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleImportConfirm}
                      disabled={importing}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Upload className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
                      {importing ? 'Importing...' : 'Confirm Import'}
                    </button>
                    <button
                      onClick={handleImportCancel}
                      disabled={importing}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
