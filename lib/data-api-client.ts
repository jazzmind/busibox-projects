/**
 * Data API Client for Busibox Projects (AI Initiative Status)
 *
 * Provides typed CRUD operations for projects, tasks, and status updates
 * using the Busibox data-api service. Uses shared client from @jazzmind/busibox-app.
 */

import {
  generateId,
  getNow,
  queryRecords,
  insertRecords,
  updateRecords,
  deleteRecords,
  ensureDocuments,
} from '@jazzmind/busibox-app';
import type { AppDataSchema } from '@jazzmind/busibox-app';
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  StatusUpdate,
  CreateStatusUpdateInput,
} from './types';
import type { QueryFilter } from '@jazzmind/busibox-app';

// ==========================================================================
// Data Document Names
// ==========================================================================

export const DOCUMENTS = {
  PROJECTS: 'busibox-projects-projects',
  TASKS: 'busibox-projects-tasks',
  UPDATES: 'busibox-projects-updates',
} as const;

// ==========================================================================
// Schemas (with graphNode for Neo4j sync)
// ==========================================================================

export const projectSchema: AppDataSchema = {
  fields: {
    id: { type: 'string', required: true, hidden: true },
    name: { type: 'string', required: true, label: 'Project Name', order: 1 },
    description: { type: 'string', label: 'Description', multiline: true, order: 2 },
    status: {
      type: 'enum',
      values: ['on-track', 'at-risk', 'off-track', 'completed', 'paused'],
      label: 'Status',
      order: 3,
    },
    progress: { type: 'integer', min: 0, max: 100, label: 'Progress', widget: 'slider', order: 4 },
    nextCheckpoint: { type: 'string', label: 'Next Checkpoint', order: 5 },
    checkpointDate: { type: 'string', label: 'Checkpoint Date', widget: 'date', order: 6 },
    checkpointProgress: {
      type: 'integer',
      min: 0,
      max: 100,
      label: 'Checkpoint Progress',
      widget: 'slider',
      order: 7,
    },
    owner: { type: 'string', label: 'Owner', order: 8 },
    team: { type: 'array', label: 'Team Members', widget: 'tags', readonly: true, order: 9 },
    tags: { type: 'array', label: 'Tags', widget: 'tags', readonly: true, order: 10 },
    createdAt: { type: 'string', label: 'Created', readonly: true, hidden: true },
    updatedAt: { type: 'string', label: 'Updated', readonly: true, hidden: true },
  },
  displayName: 'Projects',
  itemLabel: 'Project',
  sourceApp: 'busibox-projects',
  visibility: 'personal',
  allowSharing: true,
  graphNode: 'StatusProject',
  graphRelationships: [],
  relations: {
    tasks: {
      type: 'hasMany',
      document: DOCUMENTS.TASKS,
      foreignKey: 'projectId',
      displayField: 'title',
      label: 'Tasks',
    },
    updates: {
      type: 'hasMany',
      document: DOCUMENTS.UPDATES,
      foreignKey: 'projectId',
      displayField: 'content',
      label: 'Status Updates',
    },
  },
};

export const taskSchema: AppDataSchema = {
  fields: {
    id: { type: 'string', required: true, hidden: true },
    projectId: { type: 'string', required: true, hidden: true },
    title: { type: 'string', required: true, label: 'Task Title', order: 1 },
    description: { type: 'string', label: 'Description', multiline: true, order: 2 },
    status: {
      type: 'enum',
      values: ['todo', 'in-progress', 'blocked', 'done'],
      label: 'Status',
      order: 3,
    },
    assignee: { type: 'string', label: 'Assignee', order: 4 },
    priority: {
      type: 'enum',
      values: ['low', 'medium', 'high', 'critical'],
      label: 'Priority',
      order: 5,
    },
    dueDate: { type: 'string', label: 'Due Date', widget: 'date', order: 6 },
    order: { type: 'integer', label: 'Order', hidden: true },
    createdAt: { type: 'string', label: 'Created', readonly: true, hidden: true },
    updatedAt: { type: 'string', label: 'Updated', readonly: true, hidden: true },
  },
  displayName: 'Tasks',
  itemLabel: 'Task',
  sourceApp: 'busibox-projects',
  visibility: 'personal',
  allowSharing: true,
  graphNode: 'StatusTask',
  graphRelationships: [
    {
      source_label: 'StatusTask',
      target_field: 'projectId',
      target_label: 'StatusProject',
      relationship: 'BELONGS_TO',
    },
  ],
  relations: {
    project: {
      type: 'belongsTo',
      document: DOCUMENTS.PROJECTS,
      foreignKey: 'projectId',
      displayField: 'name',
      label: 'Project',
    },
  },
};

export const updateSchema: AppDataSchema = {
  fields: {
    id: { type: 'string', required: true, hidden: true },
    projectId: { type: 'string', required: true, hidden: true },
    content: {
      type: 'string',
      required: true,
      label: 'Update Content',
      multiline: true,
      order: 1,
    },
    author: { type: 'string', label: 'Author', order: 2 },
    tasksCompleted: { type: 'array', label: 'Tasks Completed', readonly: true, order: 3 },
    tasksAdded: { type: 'array', label: 'Tasks Added', readonly: true, order: 4 },
    previousStatus: { type: 'string', label: 'Previous Status', readonly: true, order: 5 },
    newStatus: { type: 'string', label: 'New Status', readonly: true, order: 6 },
    createdAt: { type: 'string', label: 'Created', readonly: true, hidden: true },
  },
  displayName: 'Status Updates',
  itemLabel: 'Update',
  sourceApp: 'busibox-projects',
  visibility: 'personal',
  allowSharing: true,
  graphNode: 'StatusUpdate',
  graphRelationships: [
    {
      source_label: 'StatusUpdate',
      target_field: 'projectId',
      target_label: 'StatusProject',
      relationship: 'BELONGS_TO',
    },
  ],
  relations: {
    project: {
      type: 'belongsTo',
      document: DOCUMENTS.PROJECTS,
      foreignKey: 'projectId',
      displayField: 'name',
      label: 'Project',
    },
  },
};

// ==========================================================================
// ensureDataDocuments
// ==========================================================================

export async function ensureDataDocuments(token: string): Promise<{
  projects: string;
  tasks: string;
  updates: string;
}> {
  const ids = await ensureDocuments(
    token,
    {
      projects: {
        name: DOCUMENTS.PROJECTS,
        schema: projectSchema,
        visibility: 'personal',
      },
      tasks: {
        name: DOCUMENTS.TASKS,
        schema: taskSchema,
        visibility: 'personal',
      },
      updates: {
        name: DOCUMENTS.UPDATES,
        schema: updateSchema,
        visibility: 'personal',
      },
    },
    'busibox-projects'
  );
  return ids as { projects: string; tasks: string; updates: string };
}

// ==========================================================================
// Project Operations
// ==========================================================================

export async function listProjects(
  token: string,
  documentId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<{ projects: Project[]; total: number }> {
  const where = options?.status
    ? ({ field: 'status', op: 'eq' as const, value: options.status } satisfies QueryFilter)
    : undefined;

  const result = await queryRecords<Project>(token, documentId, {
    where,
    orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    limit: options?.limit,
    offset: options?.offset,
  });

  return { projects: result.records, total: result.total };
}

export async function getProject(
  token: string,
  documentId: string,
  projectId: string
): Promise<Project | null> {
  const result = await queryRecords<Project>(token, documentId, {
    where: { field: 'id', op: 'eq', value: projectId },
    limit: 1,
  });

  return result.records[0] || null;
}

export async function createProject(
  token: string,
  documentId: string,
  input: CreateProjectInput
): Promise<Project> {
  const now = getNow();
  const project: Project = {
    id: generateId(),
    name: input.name,
    description: input.description,
    status: input.status || 'on-track',
    progress: input.progress || 0,
    nextCheckpoint: input.nextCheckpoint,
    checkpointDate: input.checkpointDate,
    checkpointProgress: input.checkpointProgress || 0,
    owner: input.owner,
    team: input.team || [],
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  await insertRecords(token, documentId, [project]);
  return project;
}

export async function updateProject(
  token: string,
  documentId: string,
  projectId: string,
  input: UpdateProjectInput
): Promise<Project | null> {
  const existing = await getProject(token, documentId, projectId);
  if (!existing) return null;

  const updates = {
    ...input,
    updatedAt: getNow(),
  };

  await updateRecords(
    token,
    documentId,
    updates,
    { field: 'id', op: 'eq', value: projectId }
  );

  return { ...existing, ...updates };
}

export async function deleteProject(
  token: string,
  documentId: string,
  projectId: string
): Promise<boolean> {
  const result = await deleteRecords(
    token,
    documentId,
    { field: 'id', op: 'eq', value: projectId }
  );
  return result.count > 0;
}

// ==========================================================================
// Task Operations
// ==========================================================================

export async function listTasks(
  token: string,
  documentId: string,
  options?: { projectId?: string; status?: string; limit?: number; offset?: number }
): Promise<{ tasks: Task[]; total: number }> {
  const conditions: QueryFilter[] = [];

  if (options?.projectId) {
    conditions.push({ field: 'projectId', op: 'eq', value: options.projectId });
  }
  if (options?.status) {
    conditions.push({ field: 'status', op: 'eq', value: options.status });
  }

  const where =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : { and: conditions }
      : undefined;

  const result = await queryRecords<Task>(token, documentId, {
    where,
    orderBy: [
      { field: 'order', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ],
    limit: options?.limit,
    offset: options?.offset,
  });

  return { tasks: result.records, total: result.total };
}

export async function getTask(
  token: string,
  documentId: string,
  taskId: string
): Promise<Task | null> {
  const result = await queryRecords<Task>(token, documentId, {
    where: { field: 'id', op: 'eq', value: taskId },
    limit: 1,
  });

  return result.records[0] || null;
}

export async function createTask(
  token: string,
  documentId: string,
  input: CreateTaskInput
): Promise<Task> {
  const now = getNow();

  const existingTasks = await listTasks(token, documentId, { projectId: input.projectId });
  const maxOrder = existingTasks.tasks.reduce((max, t) => Math.max(max, t.order || 0), 0);

  const task: Task = {
    id: generateId(),
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    status: input.status || 'todo',
    assignee: input.assignee,
    priority: input.priority || 'medium',
    dueDate: input.dueDate,
    order: input.order ?? maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  await insertRecords(token, documentId, [task]);
  return task;
}

export async function updateTask(
  token: string,
  documentId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<Task | null> {
  const existing = await getTask(token, documentId, taskId);
  if (!existing) return null;

  const updates = {
    ...input,
    updatedAt: getNow(),
  };

  await updateRecords(
    token,
    documentId,
    updates,
    { field: 'id', op: 'eq', value: taskId }
  );

  return { ...existing, ...updates };
}

export async function deleteTask(
  token: string,
  documentId: string,
  taskId: string
): Promise<boolean> {
  const result = await deleteRecords(
    token,
    documentId,
    { field: 'id', op: 'eq', value: taskId }
  );
  return result.count > 0;
}

// ==========================================================================
// Status Update Operations
// ==========================================================================

export async function listStatusUpdates(
  token: string,
  documentId: string,
  options?: { projectId?: string; limit?: number; offset?: number }
): Promise<{ updates: StatusUpdate[]; total: number }> {
  const where = options?.projectId
    ? ({ field: 'projectId', op: 'eq' as const, value: options.projectId } satisfies QueryFilter)
    : undefined;

  const result = await queryRecords<StatusUpdate>(token, documentId, {
    where,
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
    limit: options?.limit,
    offset: options?.offset,
  });

  return { updates: result.records, total: result.total };
}

export async function getStatusUpdate(
  token: string,
  documentId: string,
  updateId: string
): Promise<StatusUpdate | null> {
  const result = await queryRecords<StatusUpdate>(token, documentId, {
    where: { field: 'id', op: 'eq', value: updateId },
    limit: 1,
  });

  return result.records[0] || null;
}

export async function createStatusUpdate(
  token: string,
  documentId: string,
  input: CreateStatusUpdateInput
): Promise<StatusUpdate> {
  const now = getNow();
  const update: StatusUpdate = {
    id: generateId(),
    projectId: input.projectId,
    content: input.content,
    author: input.author,
    tasksCompleted: input.tasksCompleted || [],
    tasksAdded: input.tasksAdded || [],
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    createdAt: now,
  };

  await insertRecords(token, documentId, [update]);
  return update;
}

// ==========================================================================
// Aggregate Operations
// ==========================================================================

export async function getProjectWithDetails(
  token: string,
  documentIds: { projects: string; tasks: string; updates: string },
  projectId: string
): Promise<{ project: Project; tasks: Task[]; updates: StatusUpdate[] } | null> {
  const project = await getProject(token, documentIds.projects, projectId);
  if (!project) return null;

  const [tasksResult, updatesResult] = await Promise.all([
    listTasks(token, documentIds.tasks, { projectId, limit: 100 }),
    listStatusUpdates(token, documentIds.updates, { projectId, limit: 20 }),
  ]);

  return {
    project,
    tasks: tasksResult.tasks,
    updates: updatesResult.updates,
  };
}

export async function getDashboardData(
  token: string,
  documentIds: { projects: string; tasks: string; updates: string }
): Promise<{
  projects: Array<Project & { tasks: Task[]; recentUpdates: StatusUpdate[] }>;
  stats: {
    totalProjects: number;
    onTrack: number;
    atRisk: number;
    offTrack: number;
    completed: number;
  };
}> {
  const { projects } = await listProjects(token, documentIds.projects, { limit: 100 });

  const [allTasks, allUpdates] = await Promise.all([
    listTasks(token, documentIds.tasks, { limit: 500 }),
    listStatusUpdates(token, documentIds.updates, { limit: 100 }),
  ]);

  const tasksByProject = new Map<string, Task[]>();
  const updatesByProject = new Map<string, StatusUpdate[]>();

  for (const task of allTasks.tasks) {
    if (!tasksByProject.has(task.projectId)) {
      tasksByProject.set(task.projectId, []);
    }
    tasksByProject.get(task.projectId)!.push(task);
  }

  for (const update of allUpdates.updates) {
    if (!updatesByProject.has(update.projectId)) {
      updatesByProject.set(update.projectId, []);
    }
    updatesByProject.get(update.projectId)!.push(update);
  }

  const projectsWithDetails = projects.map((project) => ({
    ...project,
    tasks: (tasksByProject.get(project.id) || []).filter((t) => t.status !== 'done').slice(0, 5),
    recentUpdates: (updatesByProject.get(project.id) || []).slice(0, 3),
  }));

  const stats = {
    totalProjects: projects.length,
    onTrack: projects.filter((p) => p.status === 'on-track').length,
    atRisk: projects.filter((p) => p.status === 'at-risk').length,
    offTrack: projects.filter((p) => p.status === 'off-track').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  };

  return { projects: projectsWithDetails, stats };
}
