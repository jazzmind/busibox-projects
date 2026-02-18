import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getJiraProjects } from '@/lib/jira-client';
import { getJiraConfig } from '@/lib/jira-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    const projects = await getJiraProjects({
      jiraBaseUrl: config.jiraBaseUrl,
      jiraEmail: config.jiraEmail,
      jiraApiToken: config.jiraApiToken,
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[Admin/JIRA/projects] Failed to fetch JIRA projects:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch JIRA projects',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
