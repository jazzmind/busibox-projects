'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play, Pause, ZoomIn, ZoomOut, Maximize2, ChevronRight,
  ChevronDown, ExternalLink, Loader2, AlertCircle, X,
  Filter, Layers,
} from 'lucide-react';
import type { Project, Roadmap, ProjectStatus, ProjectPriority } from '@/lib/types';

// =============================================================================
// Types
// =============================================================================

interface ProjectWithTasks extends Project {
  taskCount?: number;
  completedTasks?: number;
}

interface RoadmapTimelineProps {
  initialRoadmapId?: string;
}

interface TimelineProject {
  project: ProjectWithTasks;
  roadmap: Roadmap | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_COLORS: Record<ProjectStatus, { bg: string; border: string; text: string; glow: string }> = {
  'on-track': { bg: '#dcfce7', border: '#16a34a', text: '#15803d', glow: 'rgba(22,163,74,0.3)' },
  'at-risk': { bg: '#fef3c7', border: '#d97706', text: '#b45309', glow: 'rgba(217,119,6,0.3)' },
  'off-track': { bg: '#fee2e2', border: '#dc2626', text: '#b91c1c', glow: 'rgba(220,38,38,0.3)' },
  'completed': { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8', glow: 'rgba(37,99,235,0.3)' },
  'paused': { bg: '#f3f4f6', border: '#6b7280', text: '#4b5563', glow: 'rgba(107,114,128,0.2)' },
};

const STATUS_COLORS_DARK: Record<ProjectStatus, { bg: string; border: string; text: string; glow: string }> = {
  'on-track': { bg: '#14532d', border: '#22c55e', text: '#86efac', glow: 'rgba(34,197,94,0.25)' },
  'at-risk': { bg: '#451a03', border: '#f59e0b', text: '#fcd34d', glow: 'rgba(245,158,11,0.25)' },
  'off-track': { bg: '#450a0a', border: '#ef4444', text: '#fca5a5', glow: 'rgba(239,68,68,0.25)' },
  'completed': { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', glow: 'rgba(59,130,246,0.25)' },
  'paused': { bg: '#1f2937', border: '#6b7280', text: '#d1d5db', glow: 'rgba(107,114,128,0.15)' },
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Minimal',
};

const UNASSIGNED_ROADMAP: Roadmap = {
  id: '__unassigned__',
  name: 'Unassigned',
  description: 'Projects not assigned to any roadmap',
  color: '#6b7280',
  sortOrder: 9999,
  createdAt: '',
  updatedAt: '',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LANE_HEIGHT = 140;
const CARD_HEIGHT = 100;
const CARD_MIN_WIDTH = 180;
const CARD_MAX_WIDTH = 320;
const HEADER_HEIGHT = 80;
const LANE_PADDING = 20;
const TIMELINE_HEADER_HEIGHT = 50;
const PIXELS_PER_DAY = 6;

// =============================================================================
// Component
// =============================================================================

export function RoadmapTimeline({ initialRoadmapId }: RoadmapTimelineProps) {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const autoplayRef = useRef<number>(0);

  // Data
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const [autoplaySpeed, setAutoplaySpeed] = useState(0.5); // px per frame

  // Filters
  const [filterRoadmap, setFilterRoadmap] = useState<string>(initialRoadmapId || 'all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());

  // Dark mode detection
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ==========================================================================
  // Data fetching
  // ==========================================================================

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [projectsRes, roadmapsRes] = await Promise.all([
          fetch(`${basePath}/api/projects?includeTasks=true`),
          fetch(`${basePath}/api/roadmaps`),
        ]);

        if (!projectsRes.ok || !roadmapsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const projectsData = await projectsRes.json();
        const roadmapsData = await roadmapsRes.json();

        const enrichedProjects: ProjectWithTasks[] = (projectsData.projects || []).map(
          (p: ProjectWithTasks & { tasks?: { status: string }[] }) => ({
            ...p,
            taskCount: p.tasks?.length || 0,
            completedTasks: p.tasks?.filter((t: { status: string }) => t.status === 'done').length || 0,
            roadmaps: p.roadmaps || [],
            priority: p.priority || 3,
          })
        );

        setProjects(enrichedProjects);
        setRoadmaps(roadmapsData.roadmaps || []);
      } catch (err) {
        console.error('[RoadmapTimeline] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [basePath]);

  // ==========================================================================
  // Computed layout
  // ==========================================================================

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (filterRoadmap !== 'all') {
      if (filterRoadmap === '__unassigned__') {
        filtered = filtered.filter((p) => !p.roadmaps?.length);
      } else {
        filtered = filtered.filter((p) => p.roadmaps?.includes(filterRoadmap));
      }
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((p) => p.status === filterStatus);
    }
    return filtered;
  }, [projects, filterRoadmap, filterStatus]);

  const { timelineProjects, lanes, timeRange, totalWidth, totalHeight } = useMemo(() => {
    if (filteredProjects.length === 0) {
      return { timelineProjects: [], lanes: [], timeRange: { start: new Date(), end: new Date() }, totalWidth: 800, totalHeight: 400 };
    }

    const now = new Date();
    const dates = filteredProjects.flatMap((p) => {
      const result: Date[] = [];
      if (p.startDate) result.push(new Date(p.startDate));
      if (p.targetDate) result.push(new Date(p.targetDate));
      if (p.checkpointDate) result.push(new Date(p.checkpointDate));
      if (result.length === 0) result.push(new Date(p.createdAt));
      return result;
    });

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime()), now.getTime()));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime()), now.getTime()));

    // Add padding of 1 month before and 2 months after
    const startDate = new Date(minDate);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(1);

    const endDate = new Date(maxDate);
    endDate.setMonth(endDate.getMonth() + 3);
    endDate.setDate(0);

    const totalDays = Math.max(
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      90
    );
    const tw = totalDays * PIXELS_PER_DAY * zoom;

    // Group projects by roadmap lanes
    const roadmapMap = new Map<string, Roadmap>();
    for (const rm of roadmaps) roadmapMap.set(rm.id, rm);

    const laneGroups = new Map<string, { roadmap: Roadmap; projects: ProjectWithTasks[] }>();

    for (const p of filteredProjects) {
      const rmIds = (p.roadmaps?.length) ? p.roadmaps : ['__unassigned__'];
      for (const rmId of rmIds) {
        if (!laneGroups.has(rmId)) {
          laneGroups.set(rmId, {
            roadmap: roadmapMap.get(rmId) || { ...UNASSIGNED_ROADMAP, id: rmId },
            projects: [],
          });
        }
        laneGroups.get(rmId)!.projects.push(p);
      }
    }

    const sortedLanes = [...laneGroups.values()].sort(
      (a, b) => a.roadmap.sortOrder - b.roadmap.sortOrder
    );

    const laneResults: Array<{ roadmap: Roadmap; y: number; height: number }> = [];
    const projectResults: TimelineProject[] = [];

    let currentY = HEADER_HEIGHT + TIMELINE_HEADER_HEIGHT;

    for (const lane of sortedLanes) {
      const isCollapsed = collapsedLanes.has(lane.roadmap.id);
      const sortedProjects = [...lane.projects].sort((a, b) => (a.priority || 3) - (b.priority || 3));

      const laneY = currentY;
      const laneH = isCollapsed ? 40 : Math.max(LANE_HEIGHT, sortedProjects.length * (CARD_HEIGHT + LANE_PADDING) + LANE_PADDING * 2);

      laneResults.push({ roadmap: lane.roadmap, y: laneY, height: laneH });

      if (!isCollapsed) {
        sortedProjects.forEach((p, idx) => {
          const pStart = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
          const pEnd = p.targetDate ? new Date(p.targetDate) : new Date(pStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          const startDays = (pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          const durationDays = Math.max((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24), 14);

          const x = startDays * PIXELS_PER_DAY * zoom;
          const w = Math.max(CARD_MIN_WIDTH, Math.min(durationDays * PIXELS_PER_DAY * zoom, CARD_MAX_WIDTH * zoom));
          const y = laneY + LANE_PADDING + idx * (CARD_HEIGHT + LANE_PADDING);

          projectResults.push({
            project: p,
            roadmap: lane.roadmap,
            x,
            y,
            width: w,
            height: CARD_HEIGHT,
          });
        });
      }

      currentY += laneH;
    }

    return {
      timelineProjects: projectResults,
      lanes: laneResults,
      timeRange: { start: startDate, end: endDate },
      totalWidth: tw,
      totalHeight: currentY + 40,
    };
  }, [filteredProjects, roadmaps, zoom, collapsedLanes]);

  // ==========================================================================
  // Canvas rendering
  // ==========================================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dimensions.width;
    const h = dimensions.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const colors = isDark ? STATUS_COLORS_DARK : STATUS_COLORS;
    const bgColor = isDark ? '#111827' : '#f9fafb';
    const headerBg = isDark ? '#1f2937' : '#ffffff';
    const lineDark = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const lineLight = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const textPrimary = isDark ? '#f9fafb' : '#111827';
    const textSecondary = isDark ? '#9ca3af' : '#6b7280';
    const textMuted = isDark ? '#6b7280' : '#9ca3af';
    const todayColor = isDark ? 'rgba(239,68,68,0.6)' : 'rgba(239,68,68,0.5)';

    // Clear
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-scrollX, -scrollY);

    // --- Timeline header (months/quarters) ---
    const headerY = HEADER_HEIGHT;
    ctx.fillStyle = headerBg;
    ctx.fillRect(scrollX, headerY, w, TIMELINE_HEADER_HEIGHT);

    // Draw month columns
    const cursor = new Date(timeRange.start);
    while (cursor <= timeRange.end) {
      const dayOffset = (cursor.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
      const x = dayOffset * PIXELS_PER_DAY * zoom;

      // Month line
      ctx.strokeStyle = cursor.getDate() === 1 ? lineDark : lineLight;
      ctx.lineWidth = cursor.getDate() === 1 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, headerY);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();

      // Month label
      if (cursor.getDate() === 1) {
        ctx.fillStyle = textSecondary;
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
          x + 6,
          headerY + 20
        );

        // Quarter label
        if (cursor.getMonth() % 3 === 0) {
          ctx.fillStyle = textMuted;
          ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          ctx.fillText(
            `Q${Math.floor(cursor.getMonth() / 3) + 1}`,
            x + 6,
            headerY + 38
          );
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    // --- Today line ---
    const today = new Date();
    if (today >= timeRange.start && today <= timeRange.end) {
      const todayDays = (today.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
      const todayX = todayDays * PIXELS_PER_DAY * zoom;

      ctx.save();
      ctx.strokeStyle = todayColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(todayX, headerY);
      ctx.lineTo(todayX, totalHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // "Today" label
      ctx.fillStyle = isDark ? '#fca5a5' : '#dc2626';
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TODAY', todayX, headerY + 46);
      ctx.restore();
    }

    // --- Lane backgrounds ---
    for (const lane of lanes) {
      const laneX = scrollX;
      const isCollapsed = collapsedLanes.has(lane.roadmap.id);

      // Lane background with roadmap color tint
      const laneColor = lane.roadmap.color || '#6b7280';
      ctx.fillStyle = isDark
        ? `${laneColor}08`
        : `${laneColor}06`;
      ctx.fillRect(laneX, lane.y, w, lane.height);

      // Lane separator
      ctx.strokeStyle = isDark ? `${laneColor}20` : `${laneColor}15`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(laneX, lane.y);
      ctx.lineTo(laneX + w, lane.y);
      ctx.stroke();

      // Lane label (sticky left)
      const labelX = scrollX + 16;
      const labelY = lane.y + (isCollapsed ? 26 : 24);

      // Roadmap color dot
      ctx.fillStyle = laneColor;
      ctx.beginPath();
      ctx.arc(labelX, labelY - 4, 5, 0, Math.PI * 2);
      ctx.fill();

      // Roadmap name
      ctx.fillStyle = textPrimary;
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(lane.roadmap.name, labelX + 14, labelY);

      // Collapse indicator
      ctx.fillStyle = textMuted;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      const projCount = filteredProjects.filter(
        (p) => p.roadmaps?.includes(lane.roadmap.id) || (!p.roadmaps?.length && lane.roadmap.id === '__unassigned__')
      ).length;
      ctx.fillText(
        `${projCount} project${projCount !== 1 ? 's' : ''}${isCollapsed ? ' (collapsed)' : ''}`,
        labelX + 14,
        labelY + 16
      );
    }

    // --- Project cards ---
    for (const tp of timelineProjects) {
      const { project, x, y, width: cardW, height: cardH } = tp;
      const sc = colors[project.status] || colors['paused'];
      const isHovered = hoveredProject === project.id;
      const isSelected = selectedProject?.id === project.id;
      const priorityScale = 1 + (5 - (project.priority || 3)) * 0.04;

      ctx.save();

      // Glow for hovered/selected
      if (isHovered || isSelected) {
        ctx.shadowColor = sc.glow;
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
      }

      // Card background
      const cardScale = isHovered ? 1.02 : 1;
      const sx = x + (cardW * (1 - cardScale)) / 2;
      const sy = y + (cardH * (1 - cardScale)) / 2;
      const sw = cardW * cardScale * priorityScale;
      const sh = cardH * cardScale;

      // Rounded rect
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(sx + radius, sy);
      ctx.lineTo(sx + sw - radius, sy);
      ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + radius);
      ctx.lineTo(sx + sw, sy + sh - radius);
      ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - radius, sy + sh);
      ctx.lineTo(sx + radius, sy + sh);
      ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - radius);
      ctx.lineTo(sx, sy + radius);
      ctx.quadraticCurveTo(sx, sy, sx + radius, sy);
      ctx.closePath();

      ctx.fillStyle = sc.bg;
      ctx.fill();
      ctx.strokeStyle = sc.border;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      ctx.restore();

      // Left accent bar
      ctx.fillStyle = sc.border;
      ctx.beginPath();
      ctx.moveTo(sx + radius, sy);
      ctx.lineTo(sx + 4, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + radius);
      ctx.lineTo(sx, sy + sh - radius);
      ctx.quadraticCurveTo(sx, sy + sh, sx + 4, sy + sh);
      ctx.lineTo(sx + radius, sy + sh);
      ctx.lineTo(sx + radius, sy);
      ctx.closePath();
      ctx.fill();

      // Project name
      ctx.fillStyle = sc.text;
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      const nameMaxW = sw - 24;
      let name = project.name;
      while (ctx.measureText(name).width > nameMaxW && name.length > 3) {
        name = name.slice(0, -4) + '...';
      }
      ctx.fillText(name, sx + 16, sy + 22);

      // Status badge
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      const statusLabel = project.status.replace('-', ' ').toUpperCase();
      const statusW = ctx.measureText(statusLabel).width + 12;
      ctx.fillStyle = sc.border + '30';
      roundRect(ctx, sx + 16, sy + 30, statusW, 16, 4);
      ctx.fill();
      ctx.fillStyle = sc.text;
      ctx.fillText(statusLabel, sx + 22, sy + 42);

      // Priority badge
      const priLabel = `P${project.priority || 3}`;
      ctx.fillStyle = textMuted;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillText(priLabel, sx + 22 + statusW + 6, sy + 42);

      // Progress bar
      const barY = sy + 55;
      const barW = Math.min(sw - 32, 120);
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
      roundRect(ctx, sx + 16, barY, barW, 6, 3);
      ctx.fill();
      if (project.progress > 0) {
        ctx.fillStyle = sc.border;
        roundRect(ctx, sx + 16, barY, barW * (project.progress / 100), 6, 3);
        ctx.fill();
      }

      // Progress label
      ctx.fillStyle = textSecondary;
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${project.progress}%`, sx + barW + 22, barY + 6);

      // Date range
      if (project.startDate || project.targetDate) {
        ctx.fillStyle = textMuted;
        ctx.font = '10px system-ui, -apple-system, sans-serif';
        const dateStr = formatDateRange(project.startDate, project.targetDate);
        ctx.fillText(dateStr, sx + 16, sy + sh - 10);
      }

      // Checkpoint marker
      if (project.checkpointDate) {
        const cpDate = new Date(project.checkpointDate);
        if (cpDate >= timeRange.start && cpDate <= timeRange.end) {
          const cpDays = (cpDate.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
          const cpX = cpDays * PIXELS_PER_DAY * zoom;

          ctx.fillStyle = isDark ? '#fbbf24' : '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(cpX, y + cardH / 2 - 6);
          ctx.lineTo(cpX + 6, y + cardH / 2);
          ctx.lineTo(cpX, y + cardH / 2 + 6);
          ctx.lineTo(cpX - 6, y + cardH / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // --- Fixed header overlay ---
    ctx.fillStyle = headerBg;
    ctx.fillRect(0, 0, w, HEADER_HEIGHT);
    ctx.strokeStyle = lineDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_HEIGHT);
    ctx.lineTo(w, HEADER_HEIGHT);
    ctx.stroke();

    // Title
    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Roadmap Timeline', 20, 35);

    // Subtitle
    ctx.fillStyle = textSecondary;
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `${filteredProjects.length} projects across ${lanes.length} roadmap${lanes.length !== 1 ? 's' : ''}`,
      20,
      55
    );

  }, [
    dimensions, scrollX, scrollY, zoom, isDark, timelineProjects, lanes,
    timeRange, totalWidth, totalHeight, hoveredProject, selectedProject,
    filteredProjects, collapsedLanes,
  ]);

  // Render loop
  useEffect(() => {
    render();
  }, [render]);

  // ==========================================================================
  // Autoplay
  // ==========================================================================

  useEffect(() => {
    if (!autoplay || loading || timelineProjects.length === 0) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      const speed = autoplaySpeed * (delta / 16);
      setScrollX((prev) => {
        const maxScroll = Math.max(0, totalWidth - dimensions.width);
        const next = prev + speed;
        if (next >= maxScroll) {
          // Loop back
          return 0;
        }
        return next;
      });

      autoplayRef.current = requestAnimationFrame(animate);
    };

    autoplayRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(autoplayRef.current);
  }, [autoplay, loading, autoplaySpeed, totalWidth, dimensions.width, timelineProjects.length]);

  // ==========================================================================
  // Interaction handlers
  // ==========================================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (autoplay) setAutoplay(false);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, scrollX, scrollY });
  }, [scrollX, scrollY, autoplay]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = dragStart.x - e.clientX;
      const dy = dragStart.y - e.clientY;
      setScrollX(Math.max(0, Math.min(totalWidth - dimensions.width, dragStart.scrollX + dx)));
      setScrollY(Math.max(0, Math.min(totalHeight - dimensions.height, dragStart.scrollY + dy)));
      return;
    }

    // Hit testing for hover
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left + scrollX;
    const my = e.clientY - rect.top + scrollY;

    let found: string | null = null;
    for (const tp of timelineProjects) {
      if (mx >= tp.x && mx <= tp.x + tp.width && my >= tp.y && my <= tp.y + tp.height) {
        found = tp.project.id;
        break;
      }
    }
    setHoveredProject(found);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = found ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
    }
  }, [isDragging, dragStart, scrollX, scrollY, timelineProjects, totalWidth, totalHeight, dimensions]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left + scrollX;
    const my = e.clientY - rect.top + scrollY;

    // Check lane header clicks (collapse/expand)
    for (const lane of lanes) {
      if (my >= lane.y && my <= lane.y + 40 && mx >= scrollX && mx <= scrollX + 300) {
        setCollapsedLanes((prev) => {
          const next = new Set(prev);
          if (next.has(lane.roadmap.id)) {
            next.delete(lane.roadmap.id);
          } else {
            next.add(lane.roadmap.id);
          }
          return next;
        });
        return;
      }
    }

    // Check project card clicks
    for (const tp of timelineProjects) {
      if (mx >= tp.x && mx <= tp.x + tp.width && my >= tp.y && my <= tp.y + tp.height) {
        setSelectedProject(tp.project);
        if (autoplay) setAutoplay(false);
        return;
      }
    }

    setSelectedProject(null);
  }, [isDragging, scrollX, scrollY, timelineProjects, lanes, autoplay]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (autoplay) setAutoplay(false);

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((prev) => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.002)));
    } else {
      setScrollX((prev) => Math.max(0, Math.min(totalWidth - dimensions.width, prev + e.deltaX + e.deltaY)));
    }
  }, [autoplay, totalWidth, dimensions.width]);

  const handleZoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));
  const handleFitView = () => {
    setZoom(dimensions.width / (totalWidth || dimensions.width));
    setScrollX(0);
    setScrollY(0);
  };

  const scrollToToday = () => {
    const today = new Date();
    const dayOffset = (today.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const todayX = dayOffset * PIXELS_PER_DAY * zoom;
    setScrollX(Math.max(0, todayX - dimensions.width / 2));
    if (autoplay) setAutoplay(false);
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading roadmap...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-160px)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-160px)] overflow-hidden" ref={containerRef}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      {/* Controls overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg shadow-md border transition-colors ${
            showFilters
              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title="Filters"
        >
          <Filter className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-1">
          <button
            onClick={() => setAutoplay(!autoplay)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title={autoplay ? 'Pause' : 'Play'}
          >
            {autoplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3ch] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
          <button
            onClick={handleFitView}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Fit to view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={scrollToToday}
            className="px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium text-red-600 dark:text-red-400"
            title="Scroll to today"
          >
            Today
          </button>
        </div>

        {/* Autoplay speed */}
        {autoplay && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 px-3 py-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">Speed</span>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={autoplaySpeed}
              onChange={(e) => setAutoplaySpeed(parseFloat(e.target.value))}
              className="w-16 h-1"
            />
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="absolute top-14 right-4 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Roadmap
              </label>
              <select
                value={filterRoadmap}
                onChange={(e) => setFilterRoadmap(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Roadmaps</option>
                {roadmaps.map((rm) => (
                  <option key={rm.id} value={rm.id}>{rm.name}</option>
                ))}
                <option value="__unassigned__">Unassigned</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="on-track">On Track</option>
                <option value="at-risk">At Risk</option>
                <option value="off-track">Off Track</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Selected project detail panel */}
      {selectedProject && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl animate-slide-up">
          <div className="max-w-4xl mx-auto p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: (isDark ? STATUS_COLORS_DARK : STATUS_COLORS)[selectedProject.status]?.border }}
                  />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                    {selectedProject.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                    {selectedProject.status.replace('-', ' ')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    P{selectedProject.priority || 3} - {PRIORITY_LABELS[selectedProject.priority || 3]}
                  </span>
                </div>

                {selectedProject.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {selectedProject.description}
                  </p>
                )}

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-400 dark:text-gray-500">Progress</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${selectedProject.progress}%`,
                            backgroundColor: (isDark ? STATUS_COLORS_DARK : STATUS_COLORS)[selectedProject.status]?.border,
                          }}
                        />
                      </div>
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        {selectedProject.progress}%
                      </span>
                    </div>
                  </div>

                  {selectedProject.targetDate && (
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Target</span>
                      <p className="text-gray-600 dark:text-gray-300 font-medium mt-1">
                        {new Date(selectedProject.targetDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {selectedProject.nextCheckpoint && (
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Next Checkpoint</span>
                      <p className="text-gray-600 dark:text-gray-300 font-medium mt-1">
                        {selectedProject.nextCheckpoint}
                      </p>
                    </div>
                  )}

                  {selectedProject.taskCount !== undefined && (
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Tasks</span>
                      <p className="text-gray-600 dark:text-gray-300 font-medium mt-1">
                        {selectedProject.completedTasks}/{selectedProject.taskCount} done
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => router.push(`/projects/${selectedProject.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredProjects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <Layers className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No projects to display
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filterRoadmap !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'Create projects and assign them to roadmaps to see the timeline'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDateRange(start?: string, end?: string): string {
  const fmt = (d: string) => {
    const date = new Date(d);
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Due ${fmt(end)}`;
  return '';
}
