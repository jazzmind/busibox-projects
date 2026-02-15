'use client';

/**
 * ProjectGraph - Interactive force-directed graph showing project/task relationships
 * 
 * Domain-specific visualization for the Status Report app:
 * - Projects appear as large hub nodes, color-coded by project status
 * - Tasks orbit as medium nodes, color-coded by task status
 * - Status Updates appear as small nodes connected to their project
 * - Click any node to see details and navigate to the entity
 * - Expand nodes to discover neighbors
 * 
 * Uses react-force-graph-2d (Canvas-based, performant) backed by the
 * data-api /data/graph endpoints which read from Neo4j.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { UserAvatar, type UserProfile } from '@jazzmind/busibox-app';
import {
  Search, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  Loader2, AlertCircle, Network, X, ChevronRight,
  FolderKanban, CheckSquare, FileText, ExternalLink,
  Play, Pause,
} from 'lucide-react';
import { GraphBackground } from './GraphBackground';
// Status types are used implicitly via the color maps below

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// =============================================================================
// Types
// =============================================================================

interface GraphNode {
  node_id: string;
  name?: string;
  title?: string; // Tasks use title instead of name
  entity_type?: string;
  labels?: string[];
  _labels?: string[]; // Neo4j labels returned by backend
  // Domain fields that may come from Neo4j properties
  status?: string;
  priority?: string;
  progress?: number;
  projectId?: string;
  description?: string;
  [key: string]: unknown;
  // Force-graph internal
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  type: string;
  from: string;
  to: string;
  similarity_score?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  total_nodes: number;
  total_edges: number;
  graph_available: boolean;
}

interface GraphStats {
  available: boolean;
  total_nodes: number;
  total_relationships: number;
  labels: Record<string, number>;
  relationship_types: Record<string, number>;
}

interface ForceGraphNode extends GraphNode {
  id: string;
  val: number;
  color: string;
  borderColor?: string;
}

interface ForceGraphLink {
  source: string;
  target: string;
  label: string;
  similarityScore?: number;
}

interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}

// =============================================================================
// Status-aware color schemes
// =============================================================================

/** Project status → node color */
const PROJECT_STATUS_COLORS: Record<string, string> = {
  'on-track': '#16a34a',    // green-600
  'at-risk': '#d97706',     // amber-600
  'off-track': '#dc2626',   // red-600
  'completed': '#2563eb',   // blue-600
  'paused': '#6b7280',      // gray-500
};

/** Task status → node color */
const TASK_STATUS_COLORS: Record<string, string> = {
  'todo': '#9ca3af',        // gray-400
  'in-progress': '#3b82f6', // blue-500
  'blocked': '#ef4444',     // red-500
  'done': '#22c55e',        // green-500
};

/** Entity type → fallback color (for non-project/task nodes) */
const ENTITY_TYPE_COLORS: Record<string, string> = {
  StatusProject: '#16a34a',
  StatusTask: '#3b82f6',
  StatusUpdate: '#8b5cf6',
  Default: '#9ca3af',
};

/** Entity type → node size multiplier */
const NODE_SIZES: Record<string, number> = {
  StatusProject: 10,
  StatusTask: 5,
  StatusUpdate: 3,
};

function getEntityType(node: GraphNode): string {
  // Check explicit entity_type property first
  if (node.entity_type) return node.entity_type;
  // Check Neo4j labels (_labels from backend, or labels)
  const allLabels = node._labels || node.labels || [];
  const domainLabel = allLabels.find(
    (l: string) => l !== 'GraphNode' && l !== 'Entity'
  );
  if (domainLabel) return domainLabel;
  return 'Unknown';
}

function getNodeColor(node: GraphNode): string {
  const entityType = getEntityType(node);

  // Use status-aware colors for projects and tasks
  if (entityType === 'StatusProject' && node.status) {
    return PROJECT_STATUS_COLORS[node.status] || ENTITY_TYPE_COLORS.StatusProject;
  }
  if (entityType === 'StatusTask' && node.status) {
    return TASK_STATUS_COLORS[node.status] || ENTITY_TYPE_COLORS.StatusTask;
  }

  return ENTITY_TYPE_COLORS[entityType] || ENTITY_TYPE_COLORS.Default;
}

function getNodeSize(node: GraphNode): number {
  const entityType = getEntityType(node);
  return NODE_SIZES[entityType] || 2;
}

/** Get the best display name for a node */
function getDisplayName(node: GraphNode): string {
  // Tasks use "title" not "name"
  if (node.title) return node.title;
  if (node.name) return node.name;
  // Fallback to friendly type for nodes without a name
  return getFriendlyType(node);
}

/** Friendly label for entity types */
const ENTITY_LABELS: Record<string, string> = {
  StatusProject: 'Project',
  StatusTask: 'Task',
  StatusUpdate: 'Update',
  DataDocument: 'Document',
};

function getFriendlyType(node: GraphNode): string {
  return ENTITY_LABELS[getEntityType(node)] || getEntityType(node);
}

/** Icon component for entity type */
function EntityIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'StatusProject': return <FolderKanban className={className} />;
    case 'StatusTask': return <CheckSquare className={className} />;
    case 'StatusUpdate': return <FileText className={className} />;
    default: return <Network className={className} />;
  }
}

// =============================================================================
// Animated Detail Panel
// =============================================================================

/** Status icon for tasks with animated check */
function TaskStatusIcon({ status }: { status?: string }) {
  switch (status) {
    case 'done':
      return (
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white animate-[scale-in_0.3s_ease-out]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    case 'in-progress':
      return (
        <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </span>
      );
    case 'blocked':
      return (
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      );
    default: // todo
      return (
        <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500" />
      );
  }
}

/** Priority badge */
function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${colors[priority] || colors.low}`}>
      {priority}
    </span>
  );
}

/** Animated progress bar that fills from 0 on mount */
function AnimatedProgress({ value, color }: { value: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

interface DetailPanelProps {
  node: ForceGraphNode;
  graphData: ForceGraphData;
  usersMap: Map<string, UserProfile>;
  onClose: () => void;
  onNavigate: (node: ForceGraphNode) => void;
}

function DetailPanel({ node, graphData, usersMap, onClose, onNavigate }: DetailPanelProps) {
  const entityType = getEntityType(node);
  const isProject = entityType === 'StatusProject';

  // Derive connected tasks and updates from graph links
  const connectedTasks = useMemo(() => {
    if (!isProject) return [];
    return graphData.links
      .filter(l => {
        if (l.label !== 'BELONGS_TO') return false;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
        return targetId === node.id;
      })
      .map(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
        return graphData.nodes.find(n => n.id === sourceId);
      })
      .filter((n): n is ForceGraphNode => !!n && getEntityType(n) === 'StatusTask')
      .sort((a, b) => {
        // Sort: in-progress first, then todo, blocked, done last
        const order: Record<string, number> = { 'in-progress': 0, 'blocked': 1, 'todo': 2, 'done': 3 };
        return (order[a.status || 'todo'] ?? 2) - (order[b.status || 'todo'] ?? 2);
      });
  }, [isProject, graphData, node.id]);

  const connectedUpdates = useMemo(() => {
    if (!isProject) return [];
    return graphData.links
      .filter(l => {
        if (l.label !== 'BELONGS_TO') return false;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
        return targetId === node.id;
      })
      .map(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
        return graphData.nodes.find(n => n.id === sourceId);
      })
      .filter((n): n is ForceGraphNode => !!n && getEntityType(n) === 'StatusUpdate')
      .slice(0, 3); // Show latest 3
  }, [isProject, graphData, node.id]);

  // Task stats
  const taskStats = useMemo(() => {
    const done = connectedTasks.filter(t => t.status === 'done').length;
    const inProgress = connectedTasks.filter(t => t.status === 'in-progress').length;
    const blocked = connectedTasks.filter(t => t.status === 'blocked').length;
    const todo = connectedTasks.filter(t => t.status === 'todo').length;
    return { done, inProgress, blocked, todo, total: connectedTasks.length };
  }, [connectedTasks]);

  const uniqueAssigneeIds = useMemo(() => {
    return Array.from(
      new Set(
        connectedTasks
          .map((task) => task.assignee)
          .filter((assignee): assignee is string => Boolean(assignee))
      )
    );
  }, [connectedTasks]);

  // Visible tasks animate in one by one
  const [visibleTasks, setVisibleTasks] = useState(0);
  useEffect(() => {
    if (connectedTasks.length === 0) return;
    setVisibleTasks(0);
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setVisibleTasks(count);
      if (count >= connectedTasks.length) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [connectedTasks.length, node.id]);

  return (
    <div className="absolute top-4 right-4 z-10 w-96 animate-[slide-in_0.35s_ease-out] overflow-hidden rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header — colored banner with optional lead image */}
      <div
        className="px-5 py-4 text-white relative overflow-hidden"
        style={{ backgroundColor: node.color || '#6b7280' }}
      >
        {/* Lead image background (projects only) */}
        {isProject && Boolean((node as unknown as GraphNode).leadImage) && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={String((node as unknown as GraphNode).leadImage)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/10" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <EntityIcon type={entityType} className="w-4 h-4 text-white/80" />
                <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                  {getFriendlyType(node)}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-tight truncate">
                {node.name || (node as unknown as GraphNode).title || node.id}
              </h3>
              {isProject && Boolean((node as unknown as GraphNode).owner) ? (
                <div className="mt-2 inline-flex items-center gap-2 bg-white/20 rounded-full px-2 py-1 text-xs">
                  <UserAvatar
                    size="xs"
                    name={usersMap.get(String((node as unknown as GraphNode).owner))?.displayName}
                    email={usersMap.get(String((node as unknown as GraphNode).owner))?.email || String((node as unknown as GraphNode).owner)}
                    avatarUrl={usersMap.get(String((node as unknown as GraphNode).owner))?.avatarUrl}
                    favoriteColor={usersMap.get(String((node as unknown as GraphNode).owner))?.favoriteColor}
                  />
                  <span>
                    {usersMap.get(String((node as unknown as GraphNode).owner))?.displayName ||
                      usersMap.get(String((node as unknown as GraphNode).owner))?.email ||
                      String((node as unknown as GraphNode).owner)}
                  </span>
                </div>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors ml-2 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status pill */}
          {node.status && (
            <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-white/20 backdrop-blur-sm capitalize">
              {(node.status as string).replace(/-/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm max-h-[500px] overflow-y-auto">
        {/* Description */}
        {Boolean((node as unknown as GraphNode).description) ? (
          <div className="px-5 pt-4 pb-2">
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 italic">
              {String((node as unknown as GraphNode).description)}
            </p>
          </div>
        ) : null}

        {/* Progress bar (projects) */}
        {isProject && typeof node.progress === 'number' ? (
          <div className="px-5 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Progress
              </span>
              <span className="text-sm font-bold" style={{ color: node.color }}>
                {node.progress}%
              </span>
            </div>
            <AnimatedProgress value={node.progress} color={node.color} />
            {Boolean((node as unknown as GraphNode).nextCheckpoint) ? (
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Next: {String((node as unknown as GraphNode).nextCheckpoint)}</span>
                {Boolean((node as unknown as GraphNode).checkpointDate) ? (
                  <span>{new Date(String((node as unknown as GraphNode).checkpointDate)).toLocaleDateString()}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Task summary counters (projects) */}
        {isProject && taskStats.total > 0 ? (
          <div className="px-5 pt-3">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Done', value: taskStats.done, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Active', value: taskStats.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { label: 'Blocked', value: taskStats.blocked, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                { label: 'Todo', value: taskStats.todo, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-700/50' },
              ].map(s => (
                <div key={s.label} className={`rounded-lg px-2 py-1.5 text-center ${s.bg}`}>
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Task list — slides in one by one */}
        {isProject && connectedTasks.length > 0 ? (
          <div className="px-5 pt-4 pb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Tasks ({connectedTasks.length})
            </span>
            {uniqueAssigneeIds.length > 0 ? (
              <div className="mt-2 flex items-center gap-1">
                {uniqueAssigneeIds.map((assigneeId) => {
                  const user = usersMap.get(assigneeId);
                  return (
                    <UserAvatar
                      key={assigneeId}
                      size="xs"
                      name={user?.displayName}
                      email={user?.email || assigneeId}
                      avatarUrl={user?.avatarUrl}
                      favoriteColor={user?.favoriteColor}
                    />
                  );
                })}
              </div>
            ) : null}
            <div className="mt-2 space-y-1">
              {connectedTasks.map((task, i) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  style={{
                    opacity: i < visibleTasks ? 1 : 0,
                    transform: i < visibleTasks ? 'translateX(0)' : 'translateX(20px)',
                    transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
                  }}
                >
                  <TaskStatusIcon status={task.status} />
                  <span className={`text-sm flex-1 min-w-0 truncate ${
                    task.status === 'done'
                      ? 'text-gray-400 dark:text-gray-500 line-through'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}>
                    {task.name || String((task as unknown as GraphNode).title || '')}
                  </span>
                  {task.assignee ? (
                    <UserAvatar
                      size="xs"
                      name={usersMap.get(String(task.assignee))?.displayName}
                      email={usersMap.get(String(task.assignee))?.email || String(task.assignee)}
                      avatarUrl={usersMap.get(String(task.assignee))?.avatarUrl}
                      favoriteColor={usersMap.get(String(task.assignee))?.favoriteColor}
                    />
                  ) : null}
                  <PriorityBadge priority={task.priority} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Recent updates (projects) */}
        {isProject && connectedUpdates.length > 0 ? (
          <div className="px-5 pt-3 pb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Recent Updates
            </span>
            <div className="mt-2 space-y-2">
              {connectedUpdates.map((update, i) => (
                <div
                  key={update.id}
                  className="text-xs text-gray-600 dark:text-gray-300 border-l-2 pl-3 py-1 animate-[fade-in_0.4s_ease-out]"
                  style={{
                    borderColor: node.color,
                    animationDelay: `${0.5 + i * 0.15}s`,
                    animationFillMode: 'backwards',
                  }}
                >
                  <p className="line-clamp-2">{String((update as unknown as GraphNode).content || update.name || '')}</p>
                  {Boolean((update as unknown as GraphNode).author) ? (
                    <span className="text-gray-400 dark:text-gray-500 mt-0.5 block">
                      — {String((update as unknown as GraphNode).author)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Task detail (when a task is selected, not a project) */}
        {entityType === 'StatusTask' ? (
          <div className="px-5 pt-3 pb-2 space-y-3">
            {node.priority ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</span>
                <PriorityBadge priority={node.priority} />
              </div>
            ) : null}
            {Boolean((node as unknown as GraphNode).assignee) ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assignee</span>
                <span className="text-sm text-gray-800 dark:text-gray-200 inline-flex items-center gap-1.5">
                  <UserAvatar
                    size="xs"
                    name={usersMap.get(String((node as unknown as GraphNode).assignee))?.displayName}
                    email={usersMap.get(String((node as unknown as GraphNode).assignee))?.email || String((node as unknown as GraphNode).assignee)}
                    avatarUrl={usersMap.get(String((node as unknown as GraphNode).assignee))?.avatarUrl}
                    favoriteColor={usersMap.get(String((node as unknown as GraphNode).assignee))?.favoriteColor}
                  />
                  {usersMap.get(String((node as unknown as GraphNode).assignee))?.displayName ||
                    usersMap.get(String((node as unknown as GraphNode).assignee))?.email ||
                    String((node as unknown as GraphNode).assignee)}
                </span>
              </div>
            ) : null}
            {Boolean((node as unknown as GraphNode).dueDate) ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Due</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  {new Date(String((node as unknown as GraphNode).dueDate)).toLocaleDateString()}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Navigate button */}
        {(isProject ||
          (entityType === 'StatusTask' && node.projectId) ||
          (entityType === 'StatusUpdate' && node.projectId)) ? (
          <div className="px-5 pt-2 pb-4">
            <button
              onClick={() => onNavigate(node)}
              className="w-full px-3 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View {getFriendlyType(node)}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function ProjectGraph() {
  const router = useRouter();

  // State
  const [graphData, setGraphData] = useState<ForceGraphData>({ nodes: [], links: [] });
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ForceGraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<UserProfile[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoFitRef = useRef(false);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchGraphData = useCallback(async (center?: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (center) params.set('center', center);
      // Focus on our domain node types
      params.set('depth', '2');
      params.set('limit', '300');

      const response = await fetch(`/api/graph?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${response.status}`);
      }

      const data: GraphData = await response.json();

      if (!data.graph_available) {
        setError('Graph database is not available. Neo4j may not be running.');
        setGraphData({ nodes: [], links: [] });
        return;
      }

      // Convert to force-graph format, filtering out DataDocument container nodes
      const nodeMap = new Map<string, ForceGraphNode>();
      for (const node of data.nodes) {
        const entityType = getEntityType(node);
        // Skip DataDocument nodes (they're internal containers, not meaningful to users)
        if (entityType === 'DataDocument') continue;
        nodeMap.set(node.node_id, {
          ...node,
          id: node.node_id,
          name: getDisplayName(node),
          val: getNodeSize(node),
          color: getNodeColor(node),
        });
      }

      const links: ForceGraphLink[] = data.edges
        .filter(edge => nodeMap.has(edge.from) && nodeMap.has(edge.to))
        .map(edge => ({
          source: edge.from,
          target: edge.to,
          label: edge.type,
          similarityScore: typeof edge.similarity_score === 'number' ? edge.similarity_score : undefined,
        }));

      setGraphData({
        nodes: Array.from(nodeMap.values()),
        links,
      });
    } catch (err) {
      console.error('[ProjectGraph] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/graph/stats');
      if (response.ok) {
        const data: GraphStats = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[ProjectGraph] Stats fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
    fetchStats();
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        setUsers(Array.isArray(payload.users) ? payload.users : []);
      } catch {
        setUsers([]);
      }
    };
    fetchUsers();
  }, [fetchGraphData, fetchStats]);

  const usersMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // ==========================================================================
  // Node Expansion
  // ==========================================================================

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedNodes.has(nodeId)) return;

    try {
      const response = await fetch(`/api/graph/entity/${encodeURIComponent(nodeId)}?depth=1&limit=30`);
      if (!response.ok) return;

      const data = await response.json();
      const neighbors = data.neighbors || [];
      const relationships = data.relationships || [];

      if (neighbors.length === 0) return;

      setGraphData(prev => {
        const existingIds = new Set(prev.nodes.map(n => n.id));
        const newNodes: ForceGraphNode[] = [];

        for (const neighbor of neighbors) {
          if (!existingIds.has(neighbor.node_id)) {
            const entityType = getEntityType(neighbor);
            if (entityType === 'DataDocument') continue; // Skip container nodes
            newNodes.push({
              ...neighbor,
              id: neighbor.node_id,
              name: getDisplayName(neighbor),
              val: getNodeSize(neighbor),
              color: getNodeColor(neighbor),
            });
          }
        }

        const newLinks: ForceGraphLink[] = [];
        for (const rel of relationships) {
          const from = rel.from || rel.source;
          const to = rel.to || rel.target;
          if (from && to) {
            newLinks.push({
              source: from,
              target: to,
              label: rel.type || 'RELATED_TO',
            });
          }
        }

        return {
          nodes: [...prev.nodes, ...newNodes],
          links: [...prev.links, ...newLinks],
        };
      });

      setExpandedNodes(prev => new Set([...prev, nodeId]));
    } catch (err) {
      console.error('[ProjectGraph] Expand error:', err);
    }
  }, [expandedNodes]);

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    setSelectedNode(node);
    expandNode(node.id);
  }, [expandNode]);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 300);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 300);
    }
  }, []);

  const handleFitToView = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 40);
    }
  }, []);

  const handleReset = useCallback(() => {
    setExpandedNodes(new Set());
    setSelectedNode(null);
    setSearchQuery('');
    fetchGraphData();
  }, [fetchGraphData]);

  /** Navigate to the entity's detail page */
  const navigateToEntity = useCallback((node: ForceGraphNode) => {
    const entityType = getEntityType(node);
    if (entityType === 'StatusProject') {
      // node_id is the record ID from data-api
      router.push(`/projects/${node.id}`);
    } else if (entityType === 'StatusTask' && node.projectId) {
      // Navigate to the parent project (tasks don't have their own page)
      router.push(`/projects/${node.projectId}`);
    } else if (entityType === 'StatusUpdate' && node.projectId) {
      router.push(`/projects/${node.projectId}`);
    }
  }, [router]);

  // ==========================================================================
  // Search & Filter
  // ==========================================================================

  const filteredData = useMemo(() => {
    if (!searchQuery) return graphData;

    const query = searchQuery.toLowerCase();
    const matchingNodeIds = new Set(
      graphData.nodes
        .filter(n => {
          const searchable = `${n.name || ''} ${(n as GraphNode).title || ''} ${(n as GraphNode).description || ''}`.toLowerCase();
          return searchable.includes(query);
        })
        .map(n => n.id)
    );

    return {
      nodes: graphData.nodes.filter(n => matchingNodeIds.has(n.id)),
      links: graphData.links.filter(l => {
        const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
        const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
        return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
      }),
    };
  }, [graphData, searchQuery]);

  // ==========================================================================
  // Canvas Rendering — avatar helpers
  // ==========================================================================

  // Image cache for avatar URLs (persists across renders)
  const avatarImageCache = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(new Map());

  function getAvatarImage(url: string): HTMLImageElement | null {
    const cached = avatarImageCache.current.get(url);
    if (cached === 'loading' || cached === 'error') return null;
    if (cached) return cached;

    // Start loading
    avatarImageCache.current.set(url, 'loading');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      avatarImageCache.current.set(url, img);
      // Force re-render by triggering a graph tick
      graphRef.current?.d3ReheatSimulation?.();
    };
    img.onerror = () => {
      avatarImageCache.current.set(url, 'error');
    };
    img.src = url;
    return null;
  }

  // Simple initials builder (mirrors busibox-app UserAvatar logic)
  function buildInitials(name?: string, email?: string): string {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0]?.[0]?.toUpperCase() || 'U';
    }
    const fallback = (email || '').split('@')[0];
    const emailParts = fallback.split(/[._-]/).filter(Boolean);
    if (emailParts.length >= 2) return `${emailParts[0][0]}${emailParts[1][0]}`.toUpperCase();
    return fallback.slice(0, 2).toUpperCase() || 'U';
  }

  // Gradient palette for initials fallback (matches busibox-app)
  const AVATAR_COLORS = [
    '#3b82f6', '#10b981', '#f97316', '#06b6d4', '#d946ef',
    '#84cc16', '#f43f5e', '#6366f1', '#f59e0b', '#64748b',
  ];

  function stringHash(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  // ==========================================================================
  // Canvas Rendering
  // ==========================================================================

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.title || getFriendlyType(node);
      const entityType = getEntityType(node);
      const fontSize = Math.max(10 / globalScale, 2);
      const baseRadius = Math.max(5 * Math.sqrt(node.val || 1), 3);
      const nodeColor = node.color || '#9ca3af';

      // Determine the relevant user for this node
      const userId = entityType === 'StatusProject' ? node.owner : node.assignee;
      const user = userId ? usersMap.get(String(userId)) : undefined;

      // Ring thickness (the status color ring)
      const ringThickness = Math.max(2.5 / globalScale, 0.8);
      const avatarRadius = baseRadius * 0.8;

      // 1. Draw status color ring (full circle background)
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // 2. Draw avatar inside the ring (if user exists)
      if (user) {
        const avatarImg = user.avatarUrl ? getAvatarImage(user.avatarUrl) : null;

        ctx.save();
        // Clip to inner circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, avatarRadius, 0, 2 * Math.PI);
        ctx.clip();

        if (avatarImg) {
          // Draw avatar image
          ctx.drawImage(
            avatarImg,
            node.x - avatarRadius,
            node.y - avatarRadius,
            avatarRadius * 2,
            avatarRadius * 2
          );
        } else {
          // Draw initials circle
          const seed = user.email || user.displayName || userId;
          const bgColor = user.favoriteColor || AVATAR_COLORS[stringHash(seed) % AVATAR_COLORS.length];
          ctx.fillStyle = bgColor;
          ctx.fill();

          // Draw initials text
          const initials = buildInitials(user.displayName, user.email);
          const initialsFontSize = Math.max(avatarRadius * 0.9, 2);
          ctx.font = `bold ${initialsFontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(initials, node.x, node.y);
        }
        ctx.restore();
      }

      // 3. Thicker border ring for projects (on top of avatar)
      if (entityType === 'StatusProject') {
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = ringThickness;
        ctx.stroke();
      }

      // 4. Highlight if selected
      if (selectedNode && node.id === selectedNode.id) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius + 1 / globalScale, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // 5. Draw progress ring for projects
      if (entityType === 'StatusProject' && typeof node.progress === 'number') {
        const progress = node.progress / 100;
        const ringRadius = baseRadius + 3 / globalScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // 6. Draw label if zoomed in enough
      if (globalScale > 0.5) {
        const maxChars = globalScale > 2 ? 30 : globalScale > 1 ? 20 : 12;
        const displayLabel = label.length > maxChars ? label.substring(0, maxChars) + '...' : label;

        ctx.font = `${entityType === 'StatusProject' ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text background
        const textWidth = ctx.measureText(displayLabel).width;
        const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
        ctx.fillStyle = isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(
          node.x - textWidth / 2 - 2,
          node.y + baseRadius + 2,
          textWidth + 4,
          fontSize + 3
        );

        // Text
        ctx.fillStyle = isDark ? '#e5e7eb' : '#374151';
        ctx.fillText(displayLabel, node.x, node.y + baseRadius + 3);
      }
    },
    [selectedNode, usersMap]
  );

  // Container dimensions - use simple window-based sizing.
  // The container is w-full so width = parent width.
  // Height is fixed at 70vh via CSS; we read it once and on resize.
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.floor(rect.width) || 900;
      const h = Math.floor(rect.height) || 600;
      setDimensions(prev => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
    };

    // Measure after first paint (container needs to be in DOM)
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Camera tracking for parallax background
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const cameraRafRef = useRef<number | null>(null);

  useEffect(() => {
    let running = true;
    const trackCamera = () => {
      if (!running) return;
      const graph = graphRef.current;
      if (graph) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = graph as any;
        const centerAt = g.centerAt?.();
        const zoom = g.zoom?.();
        if (centerAt && typeof zoom === 'number') {
          setCamera(prev => {
            const nx = centerAt.x ?? 0;
            const ny = centerAt.y ?? 0;
            if (Math.abs(prev.x - nx) < 0.5 && Math.abs(prev.y - ny) < 0.5 && Math.abs(prev.zoom - zoom) < 0.01) {
              return prev;
            }
            return { x: nx, y: ny, zoom };
          });
        }
      }
      cameraRafRef.current = requestAnimationFrame(trackCamera);
    };
    cameraRafRef.current = requestAnimationFrame(trackCamera);
    return () => {
      running = false;
      if (cameraRafRef.current) cancelAnimationFrame(cameraRafRef.current);
    };
  }, []);

  // Tune force simulation once after data loads.
  // Uses a ref to track whether tuning has been applied so we don't
  // re-trigger on every render (which caused infinite CPU loops).
  const hasTunedRef = useRef(false);

  useEffect(() => {
    if (!graphRef.current || filteredData.nodes.length === 0) return;
    if (hasTunedRef.current) return;
    hasTunedRef.current = true;

    const tuneForces = async () => {
      const graph = graphRef.current;
      if (!graph) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkForce: any = graph.d3Force('link');
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance((link: ForceGraphLink) => {
          if (link.label === 'BELONGS_TO') return 155;
          if (link.label === 'SIMILAR_TO') return 170;
          return 105;
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chargeForce: any = graph.d3Force('charge');
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(-125);
      }

      const d3 = (await import('d3-force')) as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forceCollide: (radius: (node: any) => number) => any;
      };
      graph.d3Force(
        'collision',
        d3.forceCollide((node: ForceGraphNode) => {
          const type = getEntityType(node);
          if (type === 'StatusProject') return 48;
          if (type === 'StatusTask') return 34;
          if (type === 'StatusUpdate') return 28;
          return 24;
        })
      );

      graph.d3ReheatSimulation();
    };

    void tuneForces();
  }, [filteredData.nodes.length, filteredData.links.length]);

  // ==========================================================================
  // Summary counts
  // ==========================================================================

  const counts = useMemo(() => {
    const projects = graphData.nodes.filter(n => getEntityType(n) === 'StatusProject');
    const tasks = graphData.nodes.filter(n => getEntityType(n) === 'StatusTask');
    const updates = graphData.nodes.filter(n => getEntityType(n) === 'StatusUpdate');
    return { projects: projects.length, tasks: tasks.length, updates: updates.length };
  }, [graphData.nodes]);

  // ==========================================================================
  // Auto-Tour: cycle through projects every 5 seconds
  // ==========================================================================

  const [touring, setTouring] = useState(true); // default to play
  const tourIndexRef = useRef(0);
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collect project nodes (stable reference via useMemo)
  const projectNodes = useMemo(
    () => filteredData.nodes.filter(n => getEntityType(n) === 'StatusProject'),
    [filteredData.nodes]
  );

  // The core tour action: center on a project and select it
  const visitProject = useCallback(
    (index: number) => {
      if (projectNodes.length === 0 || !graphRef.current) return;
      const idx = index % projectNodes.length;
      const node = projectNodes[idx];
      if (!node) return;

      // Select the node (opens detail panel + expands spokes)
      handleNodeClick(node);

      // Smoothly center the camera on the node
      graphRef.current.centerAt(node.x, node.y, 800);
      graphRef.current.zoom(2.5, 800);
    },
    [projectNodes, handleNodeClick]
  );

  // Schedule the next tour step
  const scheduleNextTour = useCallback(() => {
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    tourTimerRef.current = setTimeout(() => {
      tourIndexRef.current += 1;
      visitProject(tourIndexRef.current);
      scheduleNextTour();
    }, 5000);
  }, [visitProject]);

  // Start / stop the tour when `touring` changes
  useEffect(() => {
    if (!touring || projectNodes.length === 0) {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
      return;
    }

    // Kick off the first visit after the simulation has had time to settle
    const initialDelay = setTimeout(() => {
      visitProject(tourIndexRef.current);
      scheduleNextTour();
    }, 2000);

    return () => {
      clearTimeout(initialDelay);
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    };
  }, [touring, projectNodes.length, visitProject, scheduleNextTour]);

  // Pause the tour when the user manually clicks a node
  const handleNodeClickWithTourPause = useCallback(
    (node: ForceGraphNode) => {
      // If the tour triggered this, don't pause
      // But if the user clicked, pause the tour
      setTouring(false);
      handleNodeClick(node);
    },
    [handleNodeClick]
  );

  // Toggle play/pause
  const toggleTour = useCallback(() => {
    setTouring(prev => {
      if (!prev) {
        // Resuming: advance to the next project
        tourIndexRef.current += 1;
      }
      return !prev;
    });
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading && graphData.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600 dark:text-gray-300">Loading project graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Graph Unavailable</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">{error}</p>
        <button
          onClick={handleReset}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Network className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Graph Data Yet</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Create some projects and tasks first. The graph database syncs automatically
          when records are created or updated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4 text-green-600" />
            <span className="text-gray-600 dark:text-gray-400">Projects:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{counts.projects}</span>
          </div>
          <div className="text-gray-300 dark:text-gray-600">|</div>
          <div className="flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4 text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">Tasks:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{counts.tasks}</span>
          </div>
          <div className="text-gray-300 dark:text-gray-600">|</div>
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-violet-500" />
            <span className="text-gray-600 dark:text-gray-400">Updates:</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{counts.updates}</span>
          </div>
          {stats && stats.available && stats.total_relationships > 0 && (
            <>
              <div className="text-gray-300 dark:text-gray-600">|</div>
              <div className="flex items-center gap-1.5">
                <Network className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">Relationships:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{stats.total_relationships}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search and Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects, tasks..."
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tour + Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTour}
              className={`p-1.5 border rounded-md transition-colors ${
                touring
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={touring ? 'Pause Tour' : 'Play Tour'}
            >
              {touring ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button
              onClick={handleZoomIn}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleFitToView}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Fit to View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Graph + Detail Panel */}
      <div className="relative">
        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="w-full h-[70vh] min-h-[600px] rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden relative"
        >
          {/* Parallax background */}
          <GraphBackground
            cameraX={camera.x}
            cameraY={camera.y}
            zoom={camera.zoom}
            width={dimensions.width}
            height={dimensions.height}
          />
          <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full">
          <ForceGraph2D
              ref={graphRef}
              graphData={filteredData}
              nodeId="id"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeLabel={(node: any) => `${node.name || node.title || node.id} (${getFriendlyType(node)})`}
              nodeCanvasObject={nodeCanvasObject}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                const r = Math.max(5 * Math.sqrt(node.val || 1), 3) + 2;
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkColor={(link: any) => {
                if (link.label === 'SIMILAR_TO') return '#a855f7';
                const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
                return isDark ? '#4b5563' : '#d1d5db';
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkWidth={(link: any) => (link.label === 'SIMILAR_TO' ? 1.6 : 0.8)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkLineDash={(link: any) => (link.label === 'SIMILAR_TO' ? [6, 3] : null)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              linkLabel={(link: any) =>
                link.label === 'SIMILAR_TO' && typeof link.similarityScore === 'number'
                  ? `${link.label} (${Math.round(link.similarityScore * 100)}%)`
                  : link.label
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onNodeClick={(node: any) => handleNodeClickWithTourPause(node as ForceGraphNode)}
              width={dimensions.width}
              height={dimensions.height}
              cooldownTicks={200}
              d3AlphaDecay={0.012}
              d3VelocityDecay={0.28}
              onEngineStop={() => {
                if (graphRef.current && !hasAutoFitRef.current) {
                  graphRef.current.zoomToFit(600, 110);
                  hasAutoFitRef.current = true;
                }
              }}
              backgroundColor="transparent"
            />
          </div>
        </div>

        {/* Detail Panel — animated project dashboard */}
        {selectedNode && (
          <DetailPanel
            key={selectedNode.id}
            node={selectedNode}
            graphData={graphData}
            usersMap={usersMap}
            onClose={() => setSelectedNode(null)}
            onNavigate={navigateToEntity}
          />
        )}
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Project Status:</span>
          {Object.entries(PROJECT_STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status.replace(/-/g, ' ')}</span>
            </span>
          ))}
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">Task Status:</span>
          {Object.entries(TASK_STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize">{status.replace(/-/g, ' ')}</span>
            </span>
          ))}
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ENTITY_TYPE_COLORS.StatusUpdate }} />
            Updates
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-5 h-0.5 border-t-2 border-dashed border-violet-500" />
            Similarity Links
          </span>
          <span className="ml-auto text-gray-400 dark:text-gray-500">
            {touring ? 'Auto-touring projects...' : 'Click nodes to expand'} | Scroll to zoom | Drag to pan
          </span>
        </div>
      </div>
    </div>
  );
}
