import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments } from '@/lib/data-api-client';
import { getJiraStoriesForEpic } from '@/lib/jira-client';
import { getJiraConfig, getJiraTaskMappings } from '@/lib/jira-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const epicKey = searchParams.get('epicKey');
    if (!epicKey) {
      return NextResponse.json({ error: 'epicKey is required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    const [stories, taskMappings] = await Promise.all([
      getJiraStoriesForEpic(
        {
          jiraBaseUrl: config.jiraBaseUrl,
          jiraEmail: config.jiraEmail,
          jiraApiToken: config.jiraApiToken,
        },
        epicKey
      ),
      getJiraTaskMappings(auth.apiToken, documentIds.jira),
    ]);

    const mappedIssueKeys = new Set(taskMappings.map((mapping) => mapping.jiraIssueKey));
    return NextResponse.json({
      stories: stories.map((story) => ({
        id: story.id,
        key: story.key,
        summary: story.fields.summary,
        status: story.fields.status?.name,
        priority: story.fields.priority?.name,
        updated: story.fields.updated,
        mapped: mappedIssueKeys.has(story.key),
      })),
    });
  } catch (error) {
    console.error('[Admin/JIRA/stories] Failed to fetch stories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
