import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  createProject,
  createTask,
  ensureDataDocuments,
  getProject,
  listTasks,
  updateProject,
} from '@/lib/data-api-client';
import { getJiraIssue, getJiraStoriesForEpic } from '@/lib/jira-client';
import {
  getJiraConfig,
  getJiraTaskMappingByIssueKey,
  upsertJiraSyncMapping,
  upsertJiraTaskMapping,
} from '@/lib/jira-data';
import { mapJiraEpicStatusToBusibox, mapJiraPriorityToBusibox, mapJiraStatusToBusibox } from '@/lib/jira-sync';

function jiraDescriptionToText(description: unknown): string | undefined {
  if (!description || typeof description !== 'object') return undefined;
  const blocks = (description as { content?: Array<{ content?: Array<{ text?: string }> }> }).content || [];
  const text = blocks
    .flatMap((block) => block.content || [])
    .map((item) => item.text || '')
    .join('\n')
    .trim();
  return text || undefined;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: 'create_project_from_epic' | 'import_stories_to_project';
          jiraProjectKey?: string;
          jiraEpicKey?: string;
          projectId?: string;
          storyKeys?: string[];
          importAllStories?: boolean;
        }
      | null;

    const action = body?.action;
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const jiraEpicKey = (body.jiraEpicKey || '').trim();
    if (!jiraEpicKey) {
      return NextResponse.json({ error: 'jiraEpicKey is required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const config = await getJiraConfig(auth.apiToken, documentIds.jira);
    if (!config?.connected) {
      return NextResponse.json({ error: 'JIRA is not connected' }, { status: 400 });
    }

    const client = {
      jiraBaseUrl: config.jiraBaseUrl,
      jiraEmail: config.jiraEmail,
      jiraApiToken: config.jiraApiToken,
    };

    const epic = await getJiraIssue(client, jiraEpicKey);
    const jiraProjectKey = body?.jiraProjectKey || epic.fields.project?.key;
    if (!jiraProjectKey) {
      return NextResponse.json({ error: 'jiraProjectKey is required' }, { status: 400 });
    }

    if (action === 'create_project_from_epic') {
      const newProject = await createProject(auth.apiToken, documentIds.projects, {
        name: epic.fields.summary || jiraEpicKey,
        description: jiraDescriptionToText(epic.fields.description),
        status: mapJiraEpicStatusToBusibox(epic.fields.status?.name),
        owner:
          epic.fields.assignee?.accountId ||
          epic.fields.assignee?.emailAddress ||
          epic.fields.assignee?.displayName,
        tags: epic.fields.labels || [],
        jiraProjectKey,
        jiraEpicKey,
        jiraSyncEnabled: true,
      });

      await upsertJiraSyncMapping(auth.apiToken, documentIds.jira, {
        projectId: newProject.id,
        jiraProjectKey,
        jiraEpicKey,
        jiraEpicIssueId: epic.id,
        syncEnabled: true,
        syncDirection: 'both',
      });

      const stories = await getJiraStoriesForEpic(client, jiraEpicKey);
      let importedCount = 0;
      for (const story of stories) {
        const existingTaskMapping = await getJiraTaskMappingByIssueKey(auth.apiToken, documentIds.jira, story.key);
        if (existingTaskMapping) continue;

        const task = await createTask(auth.apiToken, documentIds.tasks, {
          projectId: newProject.id,
          title: story.fields.summary || story.key,
          description: jiraDescriptionToText(story.fields.description),
          status: mapJiraStatusToBusibox(story.fields.status?.name),
          assignee:
            story.fields.assignee?.accountId ||
            story.fields.assignee?.emailAddress ||
            story.fields.assignee?.displayName,
          priority: mapJiraPriorityToBusibox(story.fields.priority?.name),
          dueDate: story.fields.duedate || undefined,
          jiraIssueKey: story.key,
        });

        await upsertJiraTaskMapping(auth.apiToken, documentIds.jira, {
          projectId: newProject.id,
          taskId: task.id,
          jiraIssueKey: story.key,
          jiraIssueId: story.id,
          syncEnabled: true,
        });
        importedCount += 1;
      }

      return NextResponse.json({
        success: true,
        project: newProject,
        importedStories: importedCount,
      });
    }

    if (action === 'import_stories_to_project') {
      const projectId = body?.projectId;
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for import_stories_to_project' }, { status: 400 });
      }

      const project = await getProject(auth.apiToken, documentIds.projects, projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      await upsertJiraSyncMapping(auth.apiToken, documentIds.jira, {
        projectId,
        jiraProjectKey,
        jiraEpicKey,
        jiraEpicIssueId: epic.id,
        syncEnabled: true,
        syncDirection: 'both',
      });
      await updateProject(auth.apiToken, documentIds.projects, projectId, {
        jiraSyncEnabled: true,
        jiraProjectKey,
        jiraEpicKey,
      });

      const localTasks = await listTasks(auth.apiToken, documentIds.tasks, { projectId, limit: 1000 });
      const localByIssueKey = new Set(localTasks.tasks.map((task) => task.jiraIssueKey).filter(Boolean));
      const stories = await getJiraStoriesForEpic(client, jiraEpicKey);
      const storyKeyFilter = new Set(body?.storyKeys || []);
      const selectedStories = body?.importAllStories
        ? stories
        : stories.filter((story) => storyKeyFilter.has(story.key));

      let importedCount = 0;
      for (const story of selectedStories) {
        if (localByIssueKey.has(story.key)) continue;

        const task = await createTask(auth.apiToken, documentIds.tasks, {
          projectId,
          title: story.fields.summary || story.key,
          description: jiraDescriptionToText(story.fields.description),
          status: mapJiraStatusToBusibox(story.fields.status?.name),
          assignee:
            story.fields.assignee?.accountId ||
            story.fields.assignee?.emailAddress ||
            story.fields.assignee?.displayName,
          priority: mapJiraPriorityToBusibox(story.fields.priority?.name),
          dueDate: story.fields.duedate || undefined,
          jiraIssueKey: story.key,
        });
        await upsertJiraTaskMapping(auth.apiToken, documentIds.jira, {
          projectId,
          taskId: task.id,
          jiraIssueKey: story.key,
          jiraIssueId: story.id,
          syncEnabled: true,
        });
        importedCount += 1;
      }

      return NextResponse.json({
        success: true,
        projectId,
        importedStories: importedCount,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('[Admin/JIRA/import] Failed to import from JIRA:', error);
    return NextResponse.json(
      { error: 'Failed to import from JIRA', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
