/**
 * JIRA sync engine.
 */

import { getNow } from '@jazzmind/busibox-app';
import type {
  JiraConfig,
  JiraSyncDirection,
  JiraSyncMapping,
  JiraTaskMapping,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from '@/lib/types';
import {
  createProject,
  createTask,
  getProject,
  listTasks,
  updateProject,
  updateTask,
} from '@/lib/data-api-client';
import {
  createJiraIssue,
  getJiraEpics,
  getJiraIssue,
  getJiraStoriesForEpic,
  JiraConnectionConfig,
  JiraIssue,
  updateJiraIssue,
} from '@/lib/jira-client';
import {
  getJiraTaskMappings,
  getJiraTaskMappingByIssueKey,
  getJiraTaskMappingByTaskId,
  upsertJiraSyncMapping,
  upsertJiraTaskMapping,
} from '@/lib/jira-data';

interface SyncDocumentIds {
  projects: string;
  tasks: string;
  jira: string;
}

function toClientConfig(config: JiraConfig): JiraConnectionConfig {
  return {
    jiraBaseUrl: config.jiraBaseUrl,
    jiraEmail: config.jiraEmail,
    jiraApiToken: config.jiraApiToken,
  };
}

function parseDate(value?: string): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function resolveConflicts(localUpdatedAt?: string, remoteUpdatedAt?: string): 'local' | 'remote' {
  return parseDate(localUpdatedAt) >= parseDate(remoteUpdatedAt) ? 'local' : 'remote';
}

export function mapJiraStatusToBusibox(statusName?: string): TaskStatus {
  const value = (statusName || '').toLowerCase();
  if (value.includes('block')) return 'blocked';
  if (value.includes('progress') || value.includes('doing') || value.includes('in dev')) return 'in-progress';
  if (value.includes('done') || value.includes('complete') || value.includes('closed') || value.includes('resolved')) {
    return 'done';
  }
  return 'todo';
}

export function mapBusiboxStatusToJira(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return 'Done';
    case 'in-progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    case 'todo':
    default:
      return 'To Do';
  }
}

export function mapJiraEpicStatusToBusibox(statusName?: string): ProjectStatus {
  const value = (statusName || '').toLowerCase();
  if (value.includes('done') || value.includes('complete') || value.includes('closed')) return 'completed';
  if (value.includes('pause') || value.includes('hold')) return 'paused';
  if (value.includes('risk') || value.includes('warning')) return 'at-risk';
  if (value.includes('block') || value.includes('off')) return 'off-track';
  return 'on-track';
}

export function mapBusiboxProjectStatusToJira(status: ProjectStatus): string {
  switch (status) {
    case 'completed':
      return 'Done';
    case 'paused':
      return 'On Hold';
    case 'at-risk':
      return 'At Risk';
    case 'off-track':
      return 'Blocked';
    case 'on-track':
    default:
      return 'In Progress';
  }
}

function mapBusiboxPriorityToJira(priority: TaskPriority): string {
  switch (priority) {
    case 'critical':
      return 'Highest';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
    default:
      return 'Low';
  }
}

function mapJiraPriorityToBusibox(priorityName?: string): TaskPriority {
  const value = (priorityName || '').toLowerCase();
  if (value.includes('highest') || value.includes('critical')) return 'critical';
  if (value.includes('high')) return 'high';
  if (value.includes('medium')) return 'medium';
  return 'low';
}

function toJiraDescription(text?: string): unknown {
  if (!text) return undefined;
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

function fromJiraDescription(description: unknown): string | undefined {
  if (!description || typeof description !== 'object') return undefined;
  const blocks = (description as { content?: Array<{ content?: Array<{ text?: string }> }> }).content || [];
  const text = blocks
    .flatMap((b) => b.content || [])
    .map((c) => c.text || '')
    .join('\n')
    .trim();
  return text || undefined;
}

function buildEpicFields(project: Project, jiraProjectKey: string): Record<string, unknown> {
  return {
    project: { key: jiraProjectKey },
    issuetype: { name: 'Epic' },
    summary: project.name,
    description: toJiraDescription(project.description),
    labels: project.tags || [],
  };
}

function buildStoryFields(task: Task, projectKey: string, epicKey: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: { name: 'Story' },
    summary: task.title,
    description: toJiraDescription(task.description),
    labels: [],
    duedate: task.dueDate || null,
    priority: { name: mapBusiboxPriorityToJira(task.priority) },
    parent: { key: epicKey },
  };
  return fields;
}

export async function syncProjectToJira(
  token: string,
  project: Project,
  tasks: Task[],
  jiraConfig: JiraConfig,
  mapping: JiraSyncMapping,
  documentIds: SyncDocumentIds
): Promise<{
  mapping: JiraSyncMapping;
  syncedTasks: number;
}> {
  const client = toClientConfig(jiraConfig);
  let jiraEpicKey = mapping.jiraEpicKey || project.jiraEpicKey;

  if (!jiraEpicKey) {
    const createdEpic = await createJiraIssue(client, buildEpicFields(project, mapping.jiraProjectKey));
    jiraEpicKey = createdEpic.key;
  } else {
    await updateJiraIssue(client, jiraEpicKey, buildEpicFields(project, mapping.jiraProjectKey));
  }

  const updatedProject = await updateProject(token, documentIds.projects, project.id, {
    jiraSyncEnabled: true,
    jiraProjectKey: mapping.jiraProjectKey,
    jiraEpicKey,
  });

  const activeProject = updatedProject || project;
  const taskMappings = await getJiraTaskMappings(token, documentIds.jira, project.id);
  const taskMapByTaskId = new Map(taskMappings.map((item) => [item.taskId, item]));

  let syncedTasks = 0;
  for (const task of tasks) {
    const existingTaskMapping = taskMapByTaskId.get(task.id);
    let jiraIssueKey = existingTaskMapping?.jiraIssueKey || task.jiraIssueKey;

    if (!jiraIssueKey) {
      const createdIssue = await createJiraIssue(
        client,
        buildStoryFields(task, mapping.jiraProjectKey, jiraEpicKey)
      );
      jiraIssueKey = createdIssue.key;

      await updateTask(token, documentIds.tasks, task.id, { jiraIssueKey });
      await upsertJiraTaskMapping(token, documentIds.jira, {
        projectId: activeProject.id,
        taskId: task.id,
        jiraIssueKey,
        jiraIssueId: createdIssue.id,
        syncEnabled: true,
        lastSyncAt: getNow(),
        lastBusiboxUpdatedAt: task.updatedAt,
      });
    } else {
      await updateJiraIssue(client, jiraIssueKey, buildStoryFields(task, mapping.jiraProjectKey, jiraEpicKey));
      await upsertJiraTaskMapping(token, documentIds.jira, {
        id: existingTaskMapping?.id,
        projectId: activeProject.id,
        taskId: task.id,
        jiraIssueKey,
        jiraIssueId: existingTaskMapping?.jiraIssueId,
        syncEnabled: true,
        lastSyncAt: getNow(),
        lastBusiboxUpdatedAt: task.updatedAt,
      });
    }

    syncedTasks += 1;
  }

  const updatedMapping = await upsertJiraSyncMapping(token, documentIds.jira, {
    id: mapping.id,
    projectId: activeProject.id,
    jiraProjectKey: mapping.jiraProjectKey,
    jiraEpicKey,
    jiraEpicIssueId: mapping.jiraEpicIssueId,
    syncEnabled: true,
    syncDirection: mapping.syncDirection || 'both',
    lastSyncAt: getNow(),
    lastBusiboxUpdatedAt: activeProject.updatedAt,
  });

  return {
    mapping: updatedMapping,
    syncedTasks,
  };
}

function mapJiraIssueToProjectUpdate(issue: JiraIssue): Partial<Project> {
  return {
    name: issue.fields.summary,
    description: fromJiraDescription(issue.fields.description),
    status: mapJiraEpicStatusToBusibox(issue.fields.status?.name),
    owner:
      issue.fields.assignee?.accountId ||
      issue.fields.assignee?.emailAddress ||
      issue.fields.assignee?.displayName,
    tags: issue.fields.labels || [],
  };
}

function mapJiraIssueToTaskUpdate(issue: JiraIssue): Partial<Task> {
  return {
    title: issue.fields.summary,
    description: fromJiraDescription(issue.fields.description),
    status: mapJiraStatusToBusibox(issue.fields.status?.name),
    assignee:
      issue.fields.assignee?.accountId ||
      issue.fields.assignee?.emailAddress ||
      issue.fields.assignee?.displayName,
    priority: mapJiraPriorityToBusibox(issue.fields.priority?.name),
    dueDate: issue.fields.duedate || undefined,
  };
}

export async function syncJiraToBusibox(
  token: string,
  jiraConfig: JiraConfig,
  mapping: JiraSyncMapping,
  documentIds: SyncDocumentIds
): Promise<{
  projectId: string;
  tasksSynced: number;
}> {
  const client = toClientConfig(jiraConfig);
  const project = await getProject(token, documentIds.projects, mapping.projectId);
  if (!project) {
    throw new Error(`Project not found for mapping projectId=${mapping.projectId}`);
  }

  const epic = await getJiraIssue(client, mapping.jiraEpicKey);
  const prefer = resolveConflicts(project.updatedAt, epic.fields.updated);
  if (prefer === 'remote') {
    const updates = mapJiraIssueToProjectUpdate(epic);
    await updateProject(token, documentIds.projects, project.id, {
      ...updates,
      jiraSyncEnabled: true,
      jiraProjectKey: mapping.jiraProjectKey,
      jiraEpicKey: mapping.jiraEpicKey,
    });
  }

  const jiraStories = await getJiraStoriesForEpic(client, mapping.jiraEpicKey);
  const localTasks = await listTasks(token, documentIds.tasks, { projectId: project.id, limit: 1000 });
  const localTaskByJiraIssueKey = new Map(localTasks.tasks.filter((t) => t.jiraIssueKey).map((t) => [t.jiraIssueKey!, t]));
  const taskMappings = await getJiraTaskMappings(token, documentIds.jira, project.id);
  const taskMappingByIssueKey = new Map(taskMappings.map((item) => [item.jiraIssueKey, item]));

  let tasksSynced = 0;
  for (const issue of jiraStories) {
    const existingTask = localTaskByJiraIssueKey.get(issue.key);
    const existingTaskMapping = taskMappingByIssueKey.get(issue.key);

    if (existingTask) {
      const winner = resolveConflicts(existingTask.updatedAt, issue.fields.updated);
      if (winner === 'remote') {
        const update = mapJiraIssueToTaskUpdate(issue);
        await updateTask(token, documentIds.tasks, existingTask.id, {
          title: update.title,
          description: update.description,
          status: update.status,
          assignee: update.assignee,
          priority: update.priority,
          dueDate: update.dueDate,
          jiraIssueKey: issue.key,
        });
      }

      await upsertJiraTaskMapping(token, documentIds.jira, {
        id: existingTaskMapping?.id,
        projectId: project.id,
        taskId: existingTask.id,
        jiraIssueKey: issue.key,
        jiraIssueId: issue.id,
        syncEnabled: true,
        lastSyncAt: getNow(),
        lastJiraUpdatedAt: issue.fields.updated,
      });
      tasksSynced += 1;
      continue;
    }

    const created = await createTask(token, documentIds.tasks, {
      projectId: project.id,
      title: issue.fields.summary || issue.key,
      description: fromJiraDescription(issue.fields.description),
      status: mapJiraStatusToBusibox(issue.fields.status?.name),
      assignee:
        issue.fields.assignee?.accountId ||
        issue.fields.assignee?.emailAddress ||
        issue.fields.assignee?.displayName,
      priority: mapJiraPriorityToBusibox(issue.fields.priority?.name),
      dueDate: issue.fields.duedate || undefined,
      jiraIssueKey: issue.key,
    });

    await upsertJiraTaskMapping(token, documentIds.jira, {
      projectId: project.id,
      taskId: created.id,
      jiraIssueKey: issue.key,
      jiraIssueId: issue.id,
      syncEnabled: true,
      lastSyncAt: getNow(),
      lastJiraUpdatedAt: issue.fields.updated,
    });

    tasksSynced += 1;
  }

  await upsertJiraSyncMapping(token, documentIds.jira, {
    id: mapping.id,
    projectId: project.id,
    jiraProjectKey: mapping.jiraProjectKey,
    jiraEpicKey: mapping.jiraEpicKey,
    jiraEpicIssueId: mapping.jiraEpicIssueId,
    syncEnabled: mapping.syncEnabled,
    syncDirection: mapping.syncDirection,
    lastSyncAt: getNow(),
    lastJiraUpdatedAt: epic.fields.updated,
  });

  return {
    projectId: project.id,
    tasksSynced,
  };
}

export async function fullSync(
  token: string,
  jiraConfig: JiraConfig,
  mapping: JiraSyncMapping,
  documentIds: SyncDocumentIds,
  direction: JiraSyncDirection = 'both'
): Promise<{
  direction: JiraSyncDirection;
  projectId: string;
  tasksSynced: number;
}> {
  const project = await getProject(token, documentIds.projects, mapping.projectId);
  if (!project) {
    throw new Error(`Project not found: ${mapping.projectId}`);
  }

  const tasks = await listTasks(token, documentIds.tasks, {
    projectId: project.id,
    limit: 1000,
  });

  if (direction === 'push') {
    const pushed = await syncProjectToJira(token, project, tasks.tasks, jiraConfig, mapping, documentIds);
    return {
      direction,
      projectId: project.id,
      tasksSynced: pushed.syncedTasks,
    };
  }

  if (direction === 'pull') {
    const pulled = await syncJiraToBusibox(token, jiraConfig, mapping, documentIds);
    return {
      direction,
      projectId: project.id,
      tasksSynced: pulled.tasksSynced,
    };
  }

  await syncJiraToBusibox(token, jiraConfig, mapping, documentIds);
  const refreshedProject = await getProject(token, documentIds.projects, mapping.projectId);
  const refreshedTasks = await listTasks(token, documentIds.tasks, { projectId: mapping.projectId, limit: 1000 });
  const pushed = await syncProjectToJira(
    token,
    refreshedProject || project,
    refreshedTasks.tasks,
    jiraConfig,
    mapping,
    documentIds
  );

  return {
    direction,
    projectId: mapping.projectId,
    tasksSynced: pushed.syncedTasks,
  };
}

export async function discoverMatchingEpicBySummary(
  jiraConfig: JiraConfig,
  jiraProjectKey: string,
  projectName: string
): Promise<JiraIssue | null> {
  const epics = await getJiraEpics(toClientConfig(jiraConfig), jiraProjectKey);
  return epics.find((epic) => (epic.fields.summary || '').trim().toLowerCase() === projectName.trim().toLowerCase()) || null;
}

export async function syncSingleTaskToJira(
  token: string,
  jiraConfig: JiraConfig,
  mapping: JiraSyncMapping,
  task: Task,
  documentIds: SyncDocumentIds
): Promise<JiraTaskMapping> {
  const client = toClientConfig(jiraConfig);
  const existingMapping = await getJiraTaskMappingByTaskId(token, documentIds.jira, task.id);
  let issueKey = existingMapping?.jiraIssueKey || task.jiraIssueKey;
  let issueId = existingMapping?.jiraIssueId;

  if (!issueKey) {
    const created = await createJiraIssue(client, buildStoryFields(task, mapping.jiraProjectKey, mapping.jiraEpicKey));
    issueKey = created.key;
    issueId = created.id;
    await updateTask(token, documentIds.tasks, task.id, { jiraIssueKey: issueKey });
  } else {
    await updateJiraIssue(client, issueKey, buildStoryFields(task, mapping.jiraProjectKey, mapping.jiraEpicKey));
  }

  return upsertJiraTaskMapping(token, documentIds.jira, {
    id: existingMapping?.id,
    projectId: task.projectId,
    taskId: task.id,
    jiraIssueKey: issueKey,
    jiraIssueId: issueId,
    syncEnabled: true,
    lastSyncAt: getNow(),
    lastBusiboxUpdatedAt: task.updatedAt,
  });
}

export async function syncSingleJiraIssueToTask(
  token: string,
  jiraDocumentId: string,
  taskDocumentId: string,
  issue: JiraIssue,
  projectId: string
): Promise<void> {
  const mapping = await getJiraTaskMappingByIssueKey(token, jiraDocumentId, issue.key);
  if (!mapping) return;

  await updateTask(token, taskDocumentId, mapping.taskId, {
    title: issue.fields.summary,
    description: fromJiraDescription(issue.fields.description),
    status: mapJiraStatusToBusibox(issue.fields.status?.name),
    assignee:
      issue.fields.assignee?.accountId ||
      issue.fields.assignee?.emailAddress ||
      issue.fields.assignee?.displayName,
    priority: mapJiraPriorityToBusibox(issue.fields.priority?.name),
    dueDate: issue.fields.duedate || undefined,
    jiraIssueKey: issue.key,
  });

  await upsertJiraTaskMapping(token, jiraDocumentId, {
    id: mapping.id,
    projectId,
    taskId: mapping.taskId,
    jiraIssueKey: issue.key,
    jiraIssueId: issue.id,
    syncEnabled: mapping.syncEnabled,
    lastSyncAt: getNow(),
    lastJiraUpdatedAt: issue.fields.updated,
  });
}
