import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getJiraIssue } from '@/lib/jira-client';
import {
  getJiraConfig,
  getJiraSyncMappingByEpicKey,
  getJiraTaskMappingByIssueKey,
  upsertJiraSyncMapping,
} from '@/lib/jira-data';
import { syncJiraToBusibox, syncSingleJiraIssueToTask } from '@/lib/jira-sync';

interface JiraWebhookPayload {
  webhookEvent?: string;
  issue?: {
    id?: string;
    key?: string;
    fields?: {
      issuetype?: { name?: string };
      parent?: { key?: string };
      updated?: string;
    };
  };
}

function isSecretValid(request: NextRequest, expected?: string): boolean {
  if (!expected) return true;
  const headerSecret = request.headers.get('x-busibox-jira-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');
  return headerSecret === expected || querySecret === expected;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const payload = (await request.json().catch(() => null)) as JiraWebhookPayload | null;
    if (!payload?.issue?.key) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    if (!isSecretValid(request, config.webhookSecret)) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const issueKey = payload.issue.key;
    const taskMapping = await getJiraTaskMappingByIssueKey(auth.apiToken, documentIds.jira, issueKey);
    if (taskMapping) {
      const issue = await getJiraIssue(
        {
          jiraBaseUrl: config.jiraBaseUrl,
          jiraEmail: config.jiraEmail,
          jiraApiToken: config.jiraApiToken,
        },
        issueKey
      );
      await syncSingleJiraIssueToTask(
        auth.apiToken,
        documentIds.jira,
        documentIds.tasks,
        issue,
        taskMapping.projectId
      );

      return NextResponse.json({ success: true, type: 'task', issueKey });
    }

    const epicMapping = await getJiraSyncMappingByEpicKey(auth.apiToken, documentIds.jira, issueKey);
    if (epicMapping) {
      await syncJiraToBusibox(auth.apiToken, config, epicMapping, documentIds);
      await upsertJiraSyncMapping(auth.apiToken, documentIds.jira, {
        ...epicMapping,
        lastJiraUpdatedAt: payload.issue.fields?.updated,
      });
      return NextResponse.json({ success: true, type: 'epic', issueKey });
    }

    const parentEpicKey = payload.issue.fields?.parent?.key;
    if (parentEpicKey) {
      const parentMapping = await getJiraSyncMappingByEpicKey(auth.apiToken, documentIds.jira, parentEpicKey);
      if (parentMapping) {
        await syncJiraToBusibox(auth.apiToken, config, parentMapping, documentIds);
        return NextResponse.json({ success: true, type: 'parent-epic', issueKey, parentEpicKey });
      }
    }

    return NextResponse.json({ success: true, ignored: true, issueKey });
  } catch (error) {
    console.error('[Webhook/JIRA] Failed handling webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
