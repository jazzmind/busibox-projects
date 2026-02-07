/**
 * Shared Types for Status Report App
 */

// ==========================================================================
// Authentication Types
// ==========================================================================

export interface User {
  id: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  roles: string[];
}

export interface Session {
  user: User | null;
  isAuthenticated: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// ==========================================================================
// API Types
// ==========================================================================

export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ==========================================================================
// Project Types
// ==========================================================================

export type ProjectStatus = "on-track" | "at-risk" | "off-track" | "completed" | "paused";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  progress: number; // 0-100
  nextCheckpoint?: string;
  checkpointDate?: string; // ISO date
  checkpointProgress: number; // 0-100
  owner?: string;
  team: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  progress?: number;
  nextCheckpoint?: string;
  checkpointDate?: string;
  checkpointProgress?: number;
  owner?: string;
  team?: string[];
  tags?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  progress?: number;
  nextCheckpoint?: string;
  checkpointDate?: string;
  checkpointProgress?: number;
  owner?: string;
  team?: string[];
  tags?: string[];
}

// ==========================================================================
// Task Types
// ==========================================================================

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee?: string;
  priority: TaskPriority;
  dueDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  priority?: TaskPriority;
  dueDate?: string;
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  priority?: TaskPriority;
  dueDate?: string;
  order?: number;
}

// ==========================================================================
// Status Update Types
// ==========================================================================

export interface StatusUpdate {
  id: string;
  projectId: string;
  content: string; // Markdown
  author?: string;
  tasksCompleted: string[];
  tasksAdded: string[];
  previousStatus?: ProjectStatus;
  newStatus?: ProjectStatus;
  createdAt: string;
}

export interface CreateStatusUpdateInput {
  projectId: string;
  content: string;
  author?: string;
  tasksCompleted?: string[];
  tasksAdded?: string[];
  previousStatus?: ProjectStatus;
  newStatus?: ProjectStatus;
}

// ==========================================================================
// Data Document Types (for data-api)
// ==========================================================================

export interface DataDocument {
  id: string;
  name: string;
  schema?: DataSchema;
  recordCount: number;
  visibility: "personal" | "shared";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataSchema {
  fields: Record<string, FieldDefinition>;
  indexes?: string[];
  embedFields?: string[];
  // Display metadata for app data libraries
  displayName?: string; // Human-readable name for the document type (e.g., "Projects")
  itemLabel?: string; // Singular item name (e.g., "Project")
  sourceApp?: string; // App identifier (e.g., "status-report")
  visibility?: "personal" | "shared"; // Default visibility for new items
  allowSharing?: boolean; // Whether items can be shared
}

export interface FieldDefinition {
  type: "string" | "integer" | "number" | "boolean" | "array" | "object" | "enum" | "datetime";
  required?: boolean;
  values?: string[]; // For enum types
  min?: number;
  max?: number;
  // Display hints for form rendering
  label?: string; // Human-readable field name
  hidden?: boolean; // Don't show in list/form (e.g., id)
  multiline?: boolean; // Use textarea for strings
  widget?: "text" | "textarea" | "select" | "slider" | "number" | "date" | "checkbox" | "tags"; // Override default widget
  readonly?: boolean; // Cannot edit in form (complex types)
  order?: number; // Display order in form
  placeholder?: string; // Placeholder text for input
}

export interface QueryFilter {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains" | "startswith" | "endswith";
  value: unknown;
}

export interface QueryCondition {
  and?: (QueryFilter | QueryCondition)[];
  or?: (QueryFilter | QueryCondition)[];
}

export interface QueryOptions {
  select?: string[];
  where?: QueryFilter | QueryCondition;
  orderBy?: { field: string; direction: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
}

// ==========================================================================
// Utility Types
// ==========================================================================

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

// ==========================================================================
// Dashboard Types
// ==========================================================================

export interface ProjectWithTasks extends Project {
  tasks: Task[];
  recentUpdates: StatusUpdate[];
}

export interface DashboardData {
  projects: ProjectWithTasks[];
  stats: {
    totalProjects: number;
    onTrack: number;
    atRisk: number;
    offTrack: number;
    completed: number;
  };
}
