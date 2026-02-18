import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getJiraEpics } from '@/lib/jira-client';
import { getJiraConfig, getJiraSyncMappings } from '@/lib/jira-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const projectKey = searchParams.get('projectKey');
    if (!projectKey) {
      return NextResponse.json({ error: 'projectKey is required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    const [epics, mappings] = await Promise.all([
      getJiraEpics(
        {
          jiraBaseUrl: config.jiraBaseUrl,
          jiraEmail: config.jiraEmail,
          jiraApiToken: config.jiraApiToken,
        },
        projectKey
      ),
      getJiraSyncMappings(auth.apiToken, documentIds.jira),
    ]);

    const mappedEpicKeys = new Set(mappings.map((item) => item.jiraEpicKey));
    return NextResponse.json({
      epics: epics.map((epic) => ({
        id: epic.id,
        key: epic.key,
        summary: epic.fields.summary,
        status: epic.fields.status?.name,
        updated: epic.fields.updated,
        mapped: mappedEpicKeys.has(epic.key),
      })),
    });
  } catch (error) {
    console.error('[Admin/JIRA/epics] Failed to fetch epics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epics', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
