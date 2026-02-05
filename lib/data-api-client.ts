/**
 * Data API Client for Status Report App
 * 
 * Provides typed CRUD operations for projects, tasks, and status updates
 * using the Busibox data-api service.
 */

import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  StatusUpdate,
  CreateStatusUpdateInput,
  DataDocument,
  DataSchema,
  QueryOptions,
  QueryFilter,
  QueryCondition,
} from './types';

const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:8002';

// ==========================================================================
// Data Document Names
// ==========================================================================

export const DOCUMENTS = {
  PROJECTS: 'status-report-projects',
  TASKS: 'status-report-tasks',
  UPDATES: 'status-report-updates',
} as const;

// ==========================================================================
// Schemas
// ==========================================================================

export const projectSchema: DataSchema = {
  fields: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    description: { type: 'string' },
    status: { type: 'enum', values: ['on-track', 'at-risk', 'off-track', 'completed', 'paused'] },
    progress: { type: 'integer', min: 0, max: 100 },
    nextCheckpoint: { type: 'string' },
    checkpointDate: { type: 'string' },
    checkpointProgress: { type: 'integer', min: 0, max: 100 },
    owner: { type: 'string' },
    team: { type: 'array' },
    tags: { type: 'array' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export const taskSchema: DataSchema = {
  fields: {
    id: { type: 'string', required: true },
    projectId: { type: 'string', required: true },
    title: { type: 'string', required: true },
    description: { type: 'string' },
    status: { type: 'enum', values: ['todo', 'in-progress', 'blocked', 'done'] },
    assignee: { type: 'string' },
    priority: { type: 'enum', values: ['low', 'medium', 'high', 'critical'] },
    dueDate: { type: 'string' },
    order: { type: 'integer' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export const updateSchema: DataSchema = {
  fields: {
    id: { type: 'string', required: true },
    projectId: { type: 'string', required: true },
    content: { type: 'string', required: true },
    author: { type: 'string' },
    tasksCompleted: { type: 'array' },
    tasksAdded: { type: 'array' },
    previousStatus: { type: 'string' },
    newStatus: { type: 'string' },
    createdAt: { type: 'string' },
  },
};

// ==========================================================================
// Helper Functions
// ==========================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function getNow(): string {
  return new Date().toISOString();
}

async function dataApiRequest<T>(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${DATA_API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || `API error: ${response.status}`);
  }

  return response.json();
}

// ==========================================================================
// Document Management
// ==========================================================================

interface DocumentInfo {
  id: string;
  name: string;
  recordCount: number;
}

export async function listDataDocuments(token: string): Promise<DocumentInfo[]> {
  const response = await dataApiRequest<{ documents: DocumentInfo[] }>(
    token,
    '/data'
  );
  return response.documents || [];
}

export async function createDataDocument(
  token: string,
  name: string,
  schema: DataSchema,
  visibility: 'personal' | 'shared' = 'shared'
): Promise<DataDocument> {
  return dataApiRequest<DataDocument>(token, '/data', {
    method: 'POST',
    body: JSON.stringify({
      name,
      schema,
      visibility,
      enableCache: false,
    }),
  });
}

export async function getDocumentByName(
  token: string,
  name: string
): Promise<DataDocument | null> {
  const documents = await listDataDocuments(token);
  const doc = documents.find(d => d.name === name);
  if (!doc) return null;
  
  return dataApiRequest<DataDocument>(token, `/data/${doc.id}`);
}

export async function ensureDataDocuments(token: string): Promise<{
  projects: string;
  tasks: string;
  updates: string;
}> {
  const documents = await listDataDocuments(token);
  
  let projectsDoc = documents.find(d => d.name === DOCUMENTS.PROJECTS);
  let tasksDoc = documents.find(d => d.name === DOCUMENTS.TASKS);
  let updatesDoc = documents.find(d => d.name === DOCUMENTS.UPDATES);

  if (!projectsDoc) {
    const created = await createDataDocument(token, DOCUMENTS.PROJECTS, projectSchema, 'shared');
    projectsDoc = { id: created.id, name: created.name, recordCount: 0 };
  }

  if (!tasksDoc) {
    const created = await createDataDocument(token, DOCUMENTS.TASKS, taskSchema, 'shared');
    tasksDoc = { id: created.id, name: created.name, recordCount: 0 };
  }

  if (!updatesDoc) {
    const created = await createDataDocument(token, DOCUMENTS.UPDATES, updateSchema, 'shared');
    updatesDoc = { id: created.id, name: created.name, recordCount: 0 };
  }

  return {
    projects: projectsDoc.id,
    tasks: tasksDoc.id,
    updates: updatesDoc.id,
  };
}

// ==========================================================================
// Generic Record Operations
// ==========================================================================

async function queryRecords<T>(
  token: string,
  documentId: string,
  options: QueryOptions = {}
): Promise<{ records: T[]; total: number }> {
  return dataApiRequest<{ records: T[]; total: number }>(
    token,
    `/data/${documentId}/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        select: options.select,
        where: options.where,
        orderBy: options.orderBy,
        limit: options.limit || 100,
        offset: options.offset || 0,
      }),
    }
  );
}

async function insertRecords<T>(
  token: string,
  documentId: string,
  records: T[]
): Promise<{ count: number; recordIds: string[] }> {
  return dataApiRequest<{ count: number; recordIds: string[] }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'POST',
      body: JSON.stringify({ records, validate: true }),
    }
  );
}

async function updateRecords(
  token: string,
  documentId: string,
  updates: Record<string, unknown>,
  where?: QueryFilter | QueryCondition
): Promise<{ count: number }> {
  return dataApiRequest<{ count: number }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'PUT',
      body: JSON.stringify({ updates, where, validate: true }),
    }
  );
}

async function deleteRecords(
  token: string,
  documentId: string,
  where?: QueryFilter | QueryCondition,
  recordIds?: string[]
): Promise<{ count: number }> {
  return dataApiRequest<{ count: number }>(
    token,
    `/data/${documentId}/records`,
    {
      method: 'DELETE',
      body: JSON.stringify({ where, recordIds }),
    }
  );
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
    ? { field: 'status', op: 'eq' as const, value: options.status }
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

  const where = conditions.length > 0
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
  
  // Get max order for this project
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
    ? { field: 'projectId', op: 'eq' as const, value: options.projectId }
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
  // Fetch all projects
  const { projects } = await listProjects(token, documentIds.projects, { limit: 100 });
  
  // Fetch all tasks and updates in parallel
  const [allTasks, allUpdates] = await Promise.all([
    listTasks(token, documentIds.tasks, { limit: 500 }),
    listStatusUpdates(token, documentIds.updates, { limit: 100 }),
  ]);

  // Group tasks and updates by project
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

  // Build project data with tasks and updates
  const projectsWithDetails = projects.map(project => ({
    ...project,
    tasks: (tasksByProject.get(project.id) || []).filter(t => t.status !== 'done').slice(0, 5),
    recentUpdates: (updatesByProject.get(project.id) || []).slice(0, 3),
  }));

  // Calculate stats
  const stats = {
    totalProjects: projects.length,
    onTrack: projects.filter(p => p.status === 'on-track').length,
    atRisk: projects.filter(p => p.status === 'at-risk').length,
    offTrack: projects.filter(p => p.status === 'off-track').length,
    completed: projects.filter(p => p.status === 'completed').length,
  };

  return { projects: projectsWithDetails, stats };
}
