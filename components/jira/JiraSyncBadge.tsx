'use client';

import { ExternalLink } from 'lucide-react';

interface JiraSyncBadgeProps {
  jiraBaseUrl?: string;
  jiraEpicKey?: string;
  syncEnabled?: boolean;
}

export function JiraSyncBadge({ jiraBaseUrl, jiraEpicKey, syncEnabled }: JiraSyncBadgeProps) {
  if (!syncEnabled || !jiraEpicKey) return null;

  const url = jiraBaseUrl ? `${jiraBaseUrl.replace(/\/+$/, '')}/browse/${jiraEpicKey}` : null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
      JIRA {jiraEpicKey}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-200"
          aria-label={`Open ${jiraEpicKey} in Jira`}
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : null}
    </span>
  );
}
