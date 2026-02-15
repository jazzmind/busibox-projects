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
import {
  Search, ZoomIn, ZoomOut, Maximize2, RotateCcw,
  Loader2, AlertCircle, Network, X, ChevronRight,
  FolderKanban, CheckSquare, FileText, ExternalLink,
} from 'lucide-react';
// Status types are used implicitly via the color maps below

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// =============================================================================
// Types
// =============================================================================

interface GraphNode {
  node_id: string;
  name: string;
  entity_type?: string;
  labels?: string[];
  // Domain fields that may come from Neo4j properties
  status?: string;
  priority?: string;
  progress?: number;
  projectId?: string;
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
  StatusProject: 6,
  StatusTask: 3,
  StatusUpdate: 1.5,
};

function getNodeColor(node: GraphNode): string {
  const entityType = node.entity_type ||
    (node.labels && node.labels.find(l => l !== 'GraphNode' && l !== 'Entity')) ||
    'Default';

  // Use status-aware colors for projects and tasks
  if (entityType === 'StatusProject' && node.status) {
    return PROJECT_STATUS_COLORS[node.status] || ENTITY_TYPE_COLORS.StatusProject;
  }
  if (entityType === 'StatusTask' && node.status) {
    return TASK_STATUS_COLORS[node.status] || ENTITY_TYPE_COLORS.StatusTask;
  }

  return ENTITY_TYPE_COLORS[entityType] || ENTITY_TYPE_COLORS.Default;
}

function getEntityType(node: GraphNode): string {
  return node.entity_type ||
    (node.labels && node.labels.find(l => l !== 'GraphNode' && l !== 'Entity')) ||
    'Unknown';
}

function getNodeSize(node: GraphNode): number {
  const entityType = getEntityType(node);
  return NODE_SIZES[entityType] || 2;
}

/** Friendly label for entity types */
const ENTITY_LABELS: Record<string, string> = {
  StatusProject: 'Project',
  StatusTask: 'Task',
  StatusUpdate: 'Update',
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

      // Convert to force-graph format
      const nodeMap = new Map<string, ForceGraphNode>();
      for (const node of data.nodes) {
        nodeMap.set(node.node_id, {
          ...node,
          id: node.node_id,
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
  }, [fetchGraphData, fetchStats]);

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
            newNodes.push({
              ...neighbor,
              id: neighbor.node_id,
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
        .filter(n => (n.name || '').toLowerCase().includes(query))
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
  // Canvas Rendering
  // ==========================================================================

  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || node.id || '';
      const entityType = getEntityType(node);
      const fontSize = Math.max(10 / globalScale, 2);
      const baseRadius = Math.max(5 * Math.sqrt(node.val || 1), 3);

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color || '#9ca3af';
      ctx.fill();

      // Projects get a thicker border ring
      if (entityType === 'StatusProject') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Highlight if selected
      if (selectedNode && node.id === selectedNode.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 / globalScale;
        ctx.stroke();
        ctx.strokeStyle = node.color || '#9ca3af';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
      }

      // Draw progress ring for projects
      if (entityType === 'StatusProject' && typeof node.progress === 'number') {
        const progress = node.progress / 100;
        const ringRadius = baseRadius + 3 / globalScale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Draw label if zoomed in enough
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
    [selectedNode]
  );

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: Math.max(rect.height, 600),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

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

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
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
      <div className="flex gap-3">
        {/* Graph Canvas */}
        <div
          ref={containerRef}
          className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ minHeight: 600 }}
        >
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            nodeId="id"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeLabel={(node: any) => `${node.name || node.id} (${getFriendlyType(node)})`}
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
            linkColor={() => {
              const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
              return isDark ? '#4b5563' : '#d1d5db';
            }}
            linkWidth={0.8}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            linkLabel={(link: any) => link.label}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onNodeClick={(node: any) => handleNodeClick(node as ForceGraphNode)}
            width={selectedNode ? dimensions.width - 340 : dimensions.width}
            height={dimensions.height}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            onEngineStop={() => {
              if (graphRef.current) {
                graphRef.current.zoomToFit(400, 50);
              }
            }}
            backgroundColor="transparent"
          />
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="w-80 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 max-h-[700px] overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <EntityIcon type={getEntityType(selectedNode)} className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {getFriendlyType(selectedNode)} Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</span>
                <p className="text-sm text-gray-900 dark:text-gray-100 font-medium mt-0.5">
                  {selectedNode.name || selectedNode.id}
                </p>
              </div>

              {/* Status */}
              {selectedNode.status && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedNode.color }}
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                      {(selectedNode.status as string).replace(/-/g, ' ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Progress (projects) */}
              {typeof selectedNode.progress === 'number' && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Progress</span>
                  <div className="mt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${selectedNode.progress}%`,
                            backgroundColor: selectedNode.color,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {selectedNode.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Priority (tasks) */}
              {selectedNode.priority && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Priority</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100 capitalize mt-0.5">
                    {selectedNode.priority as string}
                  </p>
                </div>
              )}

              {/* Connections */}
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Connections</span>
                <div className="mt-1 space-y-1">
                  {graphData.links
                    .filter(l => {
                      const sourceId = typeof l.source === 'string' ? l.source : (l.source as unknown as ForceGraphNode)?.id;
                      const targetId = typeof l.target === 'string' ? l.target : (l.target as unknown as ForceGraphNode)?.id;
                      return sourceId === selectedNode.id || targetId === selectedNode.id;
                    })
                    .slice(0, 20)
                    .map((link, i) => {
                      const sourceId = typeof link.source === 'string' ? link.source : (link.source as unknown as ForceGraphNode)?.id;
                      const targetId = typeof link.target === 'string' ? link.target : (link.target as unknown as ForceGraphNode)?.id;
                      const otherId = sourceId === selectedNode.id ? targetId : sourceId;
                      const otherNode = graphData.nodes.find(n => n.id === otherId);
                      const isOutgoing = sourceId === selectedNode.id;
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <ChevronRight
                            className={`w-3 h-3 text-gray-400 ${!isOutgoing ? 'rotate-180' : ''}`}
                          />
                          <span className="text-gray-500 dark:text-gray-400 font-mono">{link.label}</span>
                          <span className="text-gray-400">→</span>
                          <button
                            onClick={() => {
                              const node = graphData.nodes.find(n => n.id === otherId) as ForceGraphNode;
                              if (node) handleNodeClick(node);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                          >
                            {otherNode?.name || otherId}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Navigate button */}
              {(getEntityType(selectedNode) === 'StatusProject' ||
                (getEntityType(selectedNode) === 'StatusTask' && selectedNode.projectId) ||
                (getEntityType(selectedNode) === 'StatusUpdate' && selectedNode.projectId)) && (
                <button
                  onClick={() => navigateToEntity(selectedNode)}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 inline-flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View {getFriendlyType(selectedNode)}
                </button>
              )}
            </div>
          </div>
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
          <span className="ml-auto text-gray-400 dark:text-gray-500">Click nodes to expand | Scroll to zoom | Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
