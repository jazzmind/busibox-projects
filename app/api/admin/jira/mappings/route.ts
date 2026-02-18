import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments, getProject, listProjects, updateProject } from '@/lib/data-api-client';
import { createJiraIssue } from '@/lib/jira-client';
import { getJiraConfig, deleteJiraSyncMapping, getJiraSyncMappings, upsertJiraSyncMapping } from '@/lib/jira-data';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const [mappings, projectsResult] = await Promise.all([
      getJiraSyncMappings(auth.apiToken, documentIds.jira),
      listProjects(auth.apiToken, documentIds.projects, { limit: 500 }),
    ]);

    const projectMap = new Map(projectsResult.projects.map((project) => [project.id, project]));

    return NextResponse.json({
      mappings: mappings.map((mapping) => ({
        ...mapping,
        projectName: projectMap.get(mapping.projectId)?.name || mapping.projectId,
      })),
    });
  } catch (error) {
    console.error('[Admin/JIRA/mappings] Failed to load mappings:', error);
    return NextResponse.json(
      { error: 'Failed to load mappings', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          projectId?: string;
          jiraProjectKey?: string;
          jiraEpicKey?: string;
          syncEnabled?: boolean;
          syncDirection?: 'push' | 'pull' | 'both';
          createEpicIfMissing?: boolean;
        }
      | null;

    if (!body?.projectId || !body?.jiraProjectKey) {
      return NextResponse.json({ error: 'projectId and jiraProjectKey are required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const [project, config] = await Promise.all([
      getProject(auth.apiToken, documentIds.projects, body.projectId),
      getJiraConfig(auth.apiToken, documentIds.jira),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    let jiraEpicKey = body.jiraEpicKey?.trim();
    if (!jiraEpicKey && body.createEpicIfMissing) {
      const createdEpic = await createJiraIssue(
        {
          jiraBaseUrl: config.jiraBaseUrl,
          jiraEmail: config.jiraEmail,
          jiraApiToken: config.jiraApiToken,
        },
        {
          project: { key: body.jiraProjectKey },
          issuetype: { name: 'Epic' },
          summary: project.name,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: project.description || '' }],
              },
            ],
          },
          labels: project.tags || [],
        }
      );
      jiraEpicKey = createdEpic.key;
    }

    if (!jiraEpicKey) {
      return NextResponse.json({ error: 'jiraEpicKey is required unless createEpicIfMissing=true' }, { status: 400 });
    }

    const mapping = await upsertJiraSyncMapping(auth.apiToken, documentIds.jira, {
      projectId: body.projectId,
      jiraProjectKey: body.jiraProjectKey,
      jiraEpicKey,
      syncEnabled: body.syncEnabled ?? true,
      syncDirection: body.syncDirection ?? 'both',
    });

    await updateProject(auth.apiToken, documentIds.projects, body.projectId, {
      jiraSyncEnabled: mapping.syncEnabled,
      jiraProjectKey: mapping.jiraProjectKey,
      jiraEpicKey: mapping.jiraEpicKey,
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error('[Admin/JIRA/mappings] Failed to save mapping:', error);
    return NextResponse.json(
      { error: 'Failed to save mapping', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const deleted = await deleteJiraSyncMapping(auth.apiToken, documentIds.jira, projectId);
    await updateProject(auth.apiToken, documentIds.projects, projectId, {
      jiraSyncEnabled: false,
      jiraProjectKey: undefined,
      jiraEpicKey: undefined,
    });

    if (!deleted) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin/JIRA/mappings] Failed to delete mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
