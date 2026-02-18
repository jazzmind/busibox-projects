'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LinkIcon, Loader2, Unplug } from 'lucide-react';

interface JiraConfigResponse {
  connected: boolean;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiTokenMasked: string;
  webhookConfigured: boolean;
  updatedAt?: string;
}

interface JiraSettingsSectionProps {
  basePath?: string;
  onConnectedChange?: (connected: boolean) => void;
}

export function JiraSettingsSection({
  basePath = '',
  onConnectedChange,
}: JiraSettingsSectionProps) {
  const [config, setConfig] = useState<JiraConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    jiraBaseUrl: '',
    jiraEmail: '',
    jiraApiToken: '',
    registerWebhook: false,
  });

  async function loadConfig() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${basePath}/api/admin/jira/config`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load JIRA config');
      }
      const data = (await response.json()) as JiraConfigResponse;
      setConfig(data);
      setForm((prev) => ({
        ...prev,
        jiraBaseUrl: data.jiraBaseUrl || '',
        jiraEmail: data.jiraEmail || '',
      }));
      onConnectedChange?.(data.connected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load JIRA config');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function testConnection() {
    try {
      setTesting(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          registerWebhook: false,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to test connection' }));
        throw new Error(payload.error || payload.message || 'Failed to test connection');
      }

      const data = (await response.json()) as JiraConfigResponse;
      setConfig(data);
      setMessage('JIRA connection verified successfully.');
      onConnectedChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test JIRA connection');
      onConnectedChange?.(false);
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await fetch(`${basePath}/api/admin/jira/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to save configuration' }));
        throw new Error(payload.error || payload.message || 'Failed to save configuration');
      }

      const data = (await response.json()) as JiraConfigResponse;
      setConfig(data);
      setForm((prev) => ({ ...prev, jiraApiToken: '' }));
      setMessage('JIRA settings saved.');
      onConnectedChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save JIRA settings');
      onConnectedChange?.(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-4 space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading JIRA settings...
        </div>
      ) : null}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            JIRA Cloud URL
          </label>
          <input
            type="url"
            value={form.jiraBaseUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, jiraBaseUrl: event.target.value }))}
            placeholder="https://your-company.atlassian.net"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">JIRA Email</label>
          <input
            type="email"
            value={form.jiraEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, jiraEmail: event.target.value }))}
            placeholder="you@company.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Personal API Token
          </label>
          <input
            type="password"
            value={form.jiraApiToken}
            onChange={(event) => setForm((prev) => ({ ...prev, jiraApiToken: event.target.value }))}
            placeholder={config?.jiraApiTokenMasked || 'Paste Atlassian API token'}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={form.registerWebhook}
          onChange={(event) => setForm((prev) => ({ ...prev, registerWebhook: event.target.checked }))}
          className="rounded border-gray-300 dark:border-gray-600"
        />
        Register JIRA webhook (requires `JIRA_WEBHOOK_PUBLIC_URL`)
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={testConnection}
          disabled={testing || saving || !form.jiraBaseUrl || !form.jiraEmail || !form.jiraApiToken}
          className="px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={saveConnection}
          disabled={saving || testing || !form.jiraBaseUrl || !form.jiraEmail || !form.jiraApiToken}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save JIRA Connection'}
        </button>
        <a
          href="https://id.atlassian.com/manage-profile/security/api-tokens"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Create token
          <LinkIcon className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="text-sm">
        {config?.connected ? (
          <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            JIRA connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Unplug className="w-4 h-4" />
            JIRA not connected
          </span>
        )}
      </div>
    </div>
  );
}
