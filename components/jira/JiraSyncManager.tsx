'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Unlink2 } from 'lucide-react';
import type { Project } from '@/lib/types';

interface JiraProjectOption {
  id: string;
  key: string;
  name: string;
}

interface JiraEpicOption {
  id: string;
  key: string;
  summary?: string;
  status?: string;
  mapped?: boolean;
}

interface JiraStoryOption {
  id: string;
  key: string;
  summary?: string;
  status?: string;
  priority?: string;
  mapped?: boolean;
}

interface JiraSyncMappingView {
  id: string;
  projectId: string;
  projectName: string;
  jiraProjectKey: string;
  jiraEpicKey: string;
  syncEnabled: boolean;
  syncDirection: 'push' | 'pull' | 'both';
  lastSyncAt?: string;
}

interface JiraSyncManagerProps {
  basePath?: string;
  enabled: boolean;
}

export function JiraSyncManager({ basePath = '', enabled }: JiraSyncManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraProjectOption[]>([]);
  const [epics, setEpics] = useState<JiraEpicOption[]>([]);
  const [stories, setStories] = useState<JiraStoryOption[]>([]);
  const [selectedStoryKeys, setSelectedStoryKeys] = useState<string[]>([]);
  const [mappings, setMappings] = useState<JiraSyncMappingView[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedJiraProjectKey, setSelectedJiraProjectKey] = useState('');
  const [selectedEpicKey, setSelectedEpicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBusiboxProjects() {
    const response = await fetch(`${basePath}/api/projects?limit=500`);
    if (!response.ok) throw new Error('Failed to load busibox projects');
    const payload = await response.json();
    setProjects(payload.projects || []);
  }

  async function loadJiraProjects() {
    const response = await fetch(`${basePath}/api/admin/jira/projects`, { cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load JIRA projects');
    }
    const payload = await response.json();
    setJiraProjects(payload.projects || []);
  }

  async function loadMappings() {
    const response = await fetch(`${basePath}/api/admin/jira/mappings`, { cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load mappings');
    }
    const payload = await response.json();
    setMappings(payload.mappings || []);
  }

  async function loadEpics(projectKey: string) {
    if (!projectKey) {
      setEpics([]);
      return;
    }
    const response = await fetch(
      `${basePath}/api/admin/jira/epics?projectKey=${encodeURIComponent(projectKey)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load epics');
    }
    const payload = await response.json();
    setEpics(payload.epics || []);
  }

  async function loadStories(epicKey: string) {
    if (!epicKey) {
      setStories([]);
      setSelectedStoryKeys([]);
      return;
    }
    const response = await fetch(
      `${basePath}/api/admin/jira/stories?epicKey=${encodeURIComponent(epicKey)}`,
      { cache: 'no-store' }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to load stories');
    }
    const payload = await response.json();
    const loadedStories = payload.stories || [];
    setStories(loadedStories);
    setSelectedStoryKeys(loadedStories.filter((story: JiraStoryOption) => !story.mapped).map((story: JiraStoryOption) => story.key));
  }

  async function refreshAll() {
    if (!enabled) return;
    try {
      setLoading(true);
      setError(null);
      await Promise.all([loadBusiboxProjects(), loadJiraProjects(), loadMappings()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load JIRA sync data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      fetch(`${basePath}/api/admin/jira/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true, direction: 'both' }),
      }).catch(() => {
        // Keep polling resilient without disrupting active UI flows.
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [enabled, basePath]);

  useEffect(() => {
    loadEpics(selectedJiraProjectKey).catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load epics')
    );
  }, [selectedJiraProjectKey]);

  useEffect(() => {
    loadStories(selectedEpicKey).catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load stories')
    );
  }, [selectedEpicKey]);

  async function linkMapping() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          jiraProjectKey: selectedJiraProjectKey,
          jiraEpicKey: selectedEpicKey || undefined,
          createEpicIfMissing: !selectedEpicKey,
          syncEnabled: true,
          syncDirection: 'both',
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to link mapping');
      }
      setMessage('Project linked to JIRA successfully.');
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link mapping');
    } finally {
      setSaving(false);
    }
  }

  async function unlinkMapping(projectId: string) {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(
        `${basePath}/api/admin/jira/mappings?projectId=${encodeURIComponent(projectId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to unlink mapping');
      }
      setMessage('JIRA mapping removed.');
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink mapping');
    } finally {
      setSaving(false);
    }
  }

  async function syncProject(projectId: string) {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, direction: 'both' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to sync project');
      }
      setMessage('Project sync completed.');
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync project');
    } finally {
      setSyncing(false);
    }
  }

  async function syncAll() {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncAll: true, direction: 'both' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to sync all projects');
      }
      setMessage('All mapped projects synced.');
      await loadMappings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync all projects');
    } finally {
      setSyncing(false);
    }
  }

  async function createProjectFromEpic() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_project_from_epic',
          jiraProjectKey: selectedJiraProjectKey,
          jiraEpicKey: selectedEpicKey,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to create project from epic');
      }
      const payload = await response.json();
      setMessage(`Created project "${payload.project?.name || payload.project?.id}" from ${selectedEpicKey}.`);
      await Promise.all([loadBusiboxProjects(), loadMappings(), loadEpics(selectedJiraProjectKey), loadStories(selectedEpicKey)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project from epic');
    } finally {
      setSaving(false);
    }
  }

  async function importStoriesToProject() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_stories_to_project',
          projectId: selectedProjectId,
          jiraProjectKey: selectedJiraProjectKey,
          jiraEpicKey: selectedEpicKey,
          storyKeys: selectedStoryKeys,
          importAllStories: false,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || 'Failed to import stories');
      }
      const payload = await response.json();
      setMessage(`Imported ${payload.importedStories || 0} stories into the selected project.`);
      await Promise.all([loadMappings(), loadStories(selectedEpicKey)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import stories');
    } finally {
      setSaving(false);
    }
  }

  const canLink = useMemo(() => {
    return Boolean(enabled && selectedProjectId && selectedJiraProjectKey && !saving);
  }, [enabled, selectedProjectId, selectedJiraProjectKey, saving]);

  const canCreateProjectFromEpic = useMemo(() => {
    return Boolean(enabled && selectedJiraProjectKey && selectedEpicKey && !saving);
  }, [enabled, selectedJiraProjectKey, selectedEpicKey, saving]);

  const canImportStories = useMemo(() => {
    return Boolean(enabled && selectedProjectId && selectedEpicKey && selectedStoryKeys.length > 0 && !saving);
  }, [enabled, selectedProjectId, selectedEpicKey, selectedStoryKeys, saving]);

  if (!enabled) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        Connect JIRA above before managing sync mappings.
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-4">
      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
          {message}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Mappings</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            disabled={loading || syncing}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={syncAll}
            disabled={syncing || loading || mappings.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select busibox project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          value={selectedJiraProjectKey}
          onChange={(event) => setSelectedJiraProjectKey(event.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="">Select JIRA project</option>
          {jiraProjects.map((project) => (
            <option key={project.id} value={project.key}>
              {project.key} - {project.name}
            </option>
          ))}
        </select>
        <select
          value={selectedEpicKey}
          onChange={(event) => setSelectedEpicKey(event.target.value)}
          disabled={!selectedJiraProjectKey}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
        >
          <option value="">Create new epic from busibox project</option>
          {epics.map((epic) => (
            <option key={epic.id} value={epic.key} disabled={epic.mapped}>
              {epic.key} - {epic.summary}
              {epic.mapped ? ' (mapped)' : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={linkMapping}
        disabled={!canLink}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Linking...' : 'Link Project to Epic'}
      </button>

      {selectedEpicKey ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              JIRA Epic Stories ({stories.length})
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={createProjectFromEpic}
                disabled={!canCreateProjectFromEpic}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
              >
                Create Project from Epic
              </button>
              <button
                onClick={importStoriesToProject}
                disabled={!canImportStories}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                Import Selected Stories
              </button>
            </div>
          </div>

          {stories.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No stories found under this epic.</p>
          ) : (
            <div className="max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
              {stories.map((story) => {
                const checked = selectedStoryKeys.includes(story.key);
                return (
                  <label
                    key={story.id}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(story.mapped)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedStoryKeys((prev) => Array.from(new Set([...prev, story.key])));
                        } else {
                          setSelectedStoryKeys((prev) => prev.filter((key) => key !== story.key));
                        }
                      }}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <span className="font-medium">{story.key}</span>
                    <span className="truncate">{story.summary || '(No summary)'}</span>
                    {story.mapped ? <span className="text-amber-600 dark:text-amber-400">(already mapped)</span> : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading mappings...
          </div>
        ) : mappings.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No mappings configured.</div>
        ) : (
          mappings.map((mapping) => (
            <div key={mapping.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{mapping.projectName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {mapping.jiraProjectKey} / {mapping.jiraEpicKey} | Direction: {mapping.syncDirection} | Last sync:{' '}
                  {mapping.lastSyncAt ? new Date(mapping.lastSyncAt).toLocaleString() : 'Never'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncProject(mapping.projectId)}
                  disabled={syncing || saving}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50"
                >
                  Sync now
                </button>
                <button
                  onClick={() => unlinkMapping(mapping.projectId)}
                  disabled={syncing || saving}
                  className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Unlink2 className="w-3.5 h-3.5" />
                  Unlink
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
