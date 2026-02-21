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
  roadmaps: string[]; // roadmap IDs this project belongs to
  priority: ProjectPriority; // 1 (highest) to 5 (lowest)
  startDate?: string; // ISO date - when work begins
  targetDate?: string; // ISO date - target delivery
  leadImage?: string; // URL to AI-generated project lead image
  jiraEpicKey?: string;
  jiraProjectKey?: string;
  jiraSyncEnabled?: boolean;
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
  roadmaps?: string[];
  priority?: ProjectPriority;
  startDate?: string;
  targetDate?: string;
  leadImage?: string;
  jiraEpicKey?: string;
  jiraProjectKey?: string;
  jiraSyncEnabled?: boolean;
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
  roadmaps?: string[];
  priority?: ProjectPriority;
  startDate?: string;
  targetDate?: string;
  leadImage?: string;
  jiraEpicKey?: string;
  jiraProjectKey?: string;
  jiraSyncEnabled?: boolean;
}

export interface AppSettings {
  id: string;
  leadImageStyleInstructions: string;
  updatedAt: string;
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
  jiraIssueKey?: string;
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
  jiraIssueKey?: string;
  order?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignee?: string;
  priority?: TaskPriority;
  dueDate?: string;
  jiraIssueKey?: string;
  order?: number;
}

// ==========================================================================
// JIRA Integration Types
// ==========================================================================

export type JiraSyncDirection = 'push' | 'pull' | 'both';

export interface JiraConfig {
  id: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  webhookSecret?: string;
  webhookId?: string;
  connected: boolean;
  updatedAt: string;
}

export interface JiraSyncMapping {
  id: string;
  projectId: string;
  jiraProjectKey: string;
  jiraEpicKey: string;
  jiraEpicIssueId?: string;
  syncEnabled: boolean;
  syncDirection: JiraSyncDirection;
  lastSyncAt?: string;
  lastBusiboxUpdatedAt?: string;
  lastJiraUpdatedAt?: string;
  updatedAt: string;
}

export interface JiraTaskMapping {
  id: string;
  projectId: string;
  taskId: string;
  jiraIssueKey: string;
  jiraIssueId?: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  lastBusiboxUpdatedAt?: string;
  lastJiraUpdatedAt?: string;
  updatedAt: string;
}

// ==========================================================================
// Roadmap Types
// ==========================================================================

export interface Roadmap {
  id: string;
  name: string;
  description?: string;
  color: string; // hex color for visual identification
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoadmapInput {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateRoadmapInput {
  name?: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export type ProjectPriority = 1 | 2 | 3 | 4 | 5;

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
// Data Document Types (re-export from busibox-app)
// ==========================================================================

export type {
  UserProfile,
  QueryFilter,
  QueryCondition,
  QueryOptions,
  DataDocument,
  DocumentInfo,
} from "@jazzmind/busibox-app";

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
