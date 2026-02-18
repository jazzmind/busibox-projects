/**
 * JIRA Cloud REST API client.
 */

export interface JiraConnectionConfig {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self?: string;
  fields: {
    summary?: string;
    description?: unknown;
    status?: { id: string; name: string };
    assignee?: { accountId?: string; displayName?: string; emailAddress?: string } | null;
    labels?: string[];
    priority?: { id?: string; name?: string } | null;
    duedate?: string | null;
    updated?: string;
    issuetype?: JiraIssueType;
    project?: { id: string; key: string; name?: string };
    parent?: { id: string; key: string };
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export interface JiraWebhookRegistration {
  webhookRegistrationResult?: Array<{
    createdWebhookId: number;
    errors?: string[];
  }>;
}

function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildAuthHeader(config: JiraConnectionConfig): string {
  const token = Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');
  return `Basic ${token}`;
}

async function jiraRequest<T>(
  config: JiraConnectionConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const baseUrl = sanitizeBaseUrl(config.jiraBaseUrl);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: buildAuthHeader(config),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`JIRA request failed (${response.status}): ${bodyText || response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function testJiraConnection(config: JiraConnectionConfig): Promise<{
  ok: boolean;
  currentUser?: { accountId: string; displayName: string; emailAddress?: string };
}> {
  const me = await jiraRequest<{ accountId: string; displayName: string; emailAddress?: string }>(
    config,
    '/rest/api/3/myself'
  );
  return {
    ok: true,
    currentUser: me,
  };
}

export async function getJiraProjects(config: JiraConnectionConfig): Promise<JiraProject[]> {
  const response = await jiraRequest<{ values: JiraProject[] }>(
    config,
    '/rest/api/3/project/search?maxResults=100'
  );
  return response.values || [];
}

export async function getJiraIssueTypesForProject(
  config: JiraConnectionConfig,
  projectIdOrKey: string
): Promise<JiraIssueType[]> {
  const response = await jiraRequest<Array<{ id: string; issueTypes: JiraIssueType[] }>>(
    config,
    `/rest/api/3/issue/createmeta/${encodeURIComponent(projectIdOrKey)}/issuetypes`
  );
  const first = response[0];
  return first?.issueTypes || [];
}

export async function searchJiraIssues(
  config: JiraConnectionConfig,
  params: {
    jql: string;
    maxResults?: number;
    startAt?: number;
    fields?: string[];
  }
): Promise<JiraSearchResult> {
  const body = {
    jql: params.jql,
    maxResults: params.maxResults ?? 50,
    startAt: params.startAt ?? 0,
    fields:
      params.fields ??
      ['summary', 'description', 'status', 'assignee', 'labels', 'priority', 'duedate', 'updated'],
  };

  return jiraRequest<JiraSearchResult>(config, '/rest/api/3/search/jql', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getJiraEpics(
  config: JiraConnectionConfig,
  projectKey: string
): Promise<JiraIssue[]> {
  const result = await searchJiraIssues(config, {
    jql: `project = "${projectKey}" AND issuetype = Epic ORDER BY updated DESC`,
    maxResults: 100,
  });
  return result.issues;
}

export async function getJiraStoriesForEpic(
  config: JiraConnectionConfig,
  epicKey: string
): Promise<JiraIssue[]> {
  try {
    const byParent = await searchJiraIssues(config, {
      jql: `parent = "${epicKey}" ORDER BY updated DESC`,
      maxResults: 200,
    });
    return byParent.issues;
  } catch {
    const byEpicLink = await searchJiraIssues(config, {
      jql: `"Epic Link" = "${epicKey}" ORDER BY updated DESC`,
      maxResults: 200,
    });
    return byEpicLink.issues;
  }
}

export async function getJiraIssue(config: JiraConnectionConfig, issueKey: string): Promise<JiraIssue> {
  return jiraRequest<JiraIssue>(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
}

export async function createJiraIssue(
  config: JiraConnectionConfig,
  fields: Record<string, unknown>
): Promise<{ id: string; key: string; self: string }> {
  return jiraRequest<{ id: string; key: string; self: string }>(config, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

export async function updateJiraIssue(
  config: JiraConnectionConfig,
  issueKey: string,
  fields: Record<string, unknown>
): Promise<void> {
  await jiraRequest<void>(config, `/rest/api/3/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });
}

export async function registerJiraWebhook(
  config: JiraConnectionConfig,
  callbackUrl: string,
  jqlFilter = 'project IS NOT EMPTY'
): Promise<number | null> {
  const payload = {
    url: callbackUrl,
    webhooks: [
      {
        jqlFilter,
        events: ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted'],
      },
    ],
  };

  const response = await jiraRequest<JiraWebhookRegistration>(config, '/rest/api/3/webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.webhookRegistrationResult?.[0]?.createdWebhookId ?? null;
}

export async function deleteJiraWebhook(
  config: JiraConnectionConfig,
  webhookId: number | string
): Promise<void> {
  await jiraRequest<void>(config, `/rest/api/3/webhook/${encodeURIComponent(String(webhookId))}`, {
    method: 'DELETE',
  });
}
