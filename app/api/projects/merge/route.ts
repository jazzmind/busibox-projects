import { NextRequest, NextResponse } from 'next/server';
import { updateRecords } from '@jazzmind/busibox-app';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  getProject,
  listTasks,
  listStatusUpdates,
  updateProject,
  deleteProject,
} from '@/lib/data-api-client';
import {
  getJiraSyncMappingByProjectId,
  deleteJiraSyncMapping,
  upsertJiraSyncMapping,
  getJiraTaskMappingByTaskId,
  upsertJiraTaskMapping,
} from '@/lib/jira-data';
import type { MergeProjectsInput, MergeProjectsResult, Project } from '@/lib/types';

function unique(values: string[] | undefined): string[] {
  return [...new Set((values || []).filter(Boolean))];
}

function pickEarliestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function pickLatestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function mergeProjectMetadata(target: Project, sources: Project[]): Partial<Project> {
  const all = [target, ...sources];
  const priorityNumbers = all.map((p) => p.priority ?? 3);
  const minPriority = priorityNumbers.reduce<number>((min, value) => Math.min(min, value), 5);
  const priority = Math.max(1, Math.min(5, minPriority)) as Project['priority'];

  return {
    description: target.description || sources.find((s) => s.description)?.description,
    owner: target.owner || sources.find((s) => s.owner)?.owner,
    leadImage: target.leadImage || sources.find((s) => s.leadImage)?.leadImage,
    jiraEpicKey: target.jiraEpicKey || sources.find((s) => s.jiraEpicKey)?.jiraEpicKey,
    jiraProjectKey: target.jiraProjectKey || sources.find((s) => s.jiraProjectKey)?.jiraProjectKey,
    jiraSyncEnabled: target.jiraSyncEnabled || sources.some((s) => !!s.jiraSyncEnabled),
    team: unique(all.flatMap((p) => p.team || [])),
    tags: unique(all.flatMap((p) => p.tags || [])),
    roadmaps: unique(all.flatMap((p) => p.roadmaps || [])),
    priority,
    progress: Math.max(...all.map((p) => p.progress || 0)),
    checkpointProgress: Math.max(...all.map((p) => p.checkpointProgress || 0)),
    startDate: all.reduce<string | undefined>((date, p) => pickEarliestDate(date, p.startDate), undefined),
    targetDate: all.reduce<string | undefined>((date, p) => pickLatestDate(date, p.targetDate), undefined),
    checkpointDate: all.reduce<string | undefined>((date, p) => pickLatestDate(date, p.checkpointDate), undefined),
    nextCheckpoint: target.nextCheckpoint || sources.find((s) => s.nextCheckpoint)?.nextCheckpoint,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as MergeProjectsInput;
    const targetProjectId = body?.targetProjectId?.trim();
    const sourceProjectIds = unique(body?.sourceProjectIds?.map((id) => id.trim()));

    if (!targetProjectId || sourceProjectIds.length === 0) {
      return NextResponse.json(
        { error: 'targetProjectId and sourceProjectIds are required' },
        { status: 400 }
      );
    }
    if (sourceProjectIds.includes(targetProjectId)) {
      return NextResponse.json(
        { error: 'target project cannot also be a source project' },
        { status: 400 }
      );
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const targetProject = await getProject(auth.apiToken, documentIds.projects, targetProjectId);
    if (!targetProject) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    const sourceProjects = await Promise.all(
      sourceProjectIds.map((id) => getProject(auth.apiToken, documentIds.projects, id))
    );
    const missingSource = sourceProjectIds.filter((_, idx) => !sourceProjects[idx]);
    if (missingSource.length > 0) {
      return NextResponse.json(
        { error: `Source project(s) not found: ${missingSource.join(', ')}` },
        { status: 404 }
      );
    }
    const validSourceProjects = sourceProjects.filter((p): p is Project => !!p);

    const now = new Date().toISOString();
    let movedTasks = 0;
    let movedUpdates = 0;

    let targetJiraMapping = await getJiraSyncMappingByProjectId(
      auth.apiToken,
      documentIds.jira,
      targetProjectId
    );

    for (const sourceId of sourceProjectIds) {
      const { tasks } = await listTasks(auth.apiToken, documentIds.tasks, { projectId: sourceId, limit: 5000 });
      const { updates } = await listStatusUpdates(auth.apiToken, documentIds.updates, { projectId: sourceId, limit: 5000 });

      movedTasks += tasks.length;
      movedUpdates += updates.length;

      if (tasks.length > 0) {
        await updateRecords(
          auth.apiToken,
          documentIds.tasks,
          { projectId: targetProjectId, updatedAt: now },
          { field: 'projectId', op: 'eq', value: sourceId }
        );
      }

      if (updates.length > 0) {
        await updateRecords(
          auth.apiToken,
          documentIds.updates,
          { projectId: targetProjectId },
          { field: 'projectId', op: 'eq', value: sourceId }
        );
      }

      for (const task of tasks) {
        const taskMapping = await getJiraTaskMappingByTaskId(auth.apiToken, documentIds.jira, task.id);
        if (!taskMapping) continue;
        await upsertJiraTaskMapping(auth.apiToken, documentIds.jira, {
          ...taskMapping,
          projectId: targetProjectId,
          lastBusiboxUpdatedAt: now,
        });
      }

      const sourceMapping = await getJiraSyncMappingByProjectId(auth.apiToken, documentIds.jira, sourceId);
      if (sourceMapping) {
        if (!targetJiraMapping) {
          targetJiraMapping = await upsertJiraSyncMapping(auth.apiToken, documentIds.jira, {
            ...sourceMapping,
            projectId: targetProjectId,
            lastBusiboxUpdatedAt: now,
          });
        }
        await deleteJiraSyncMapping(auth.apiToken, documentIds.jira, sourceId);
      }
    }

    const mergedMetadata = mergeProjectMetadata(targetProject, validSourceProjects);
    const mergedProject = await updateProject(
      auth.apiToken,
      documentIds.projects,
      targetProjectId,
      mergedMetadata
    );

    if (!mergedProject) {
      return NextResponse.json({ error: 'Failed to update target project' }, { status: 500 });
    }

    for (const sourceId of sourceProjectIds) {
      await deleteProject(auth.apiToken, documentIds.projects, sourceId);
    }

    const result: MergeProjectsResult = {
      mergedProject,
      mergedSourceProjectIds: sourceProjectIds,
      movedTasks,
      movedUpdates,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PROJECTS/merge] Failed to merge projects:', error);
    return NextResponse.json(
      {
        error: 'Failed to merge projects',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
