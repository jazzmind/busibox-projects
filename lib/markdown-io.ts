/**
 * Markdown Import/Export for Busibox Projects
 *
 * Exports roadmaps, projects, tasks and status updates into a structured
 * markdown document that can be round-tripped back into the system.
 *
 * Format overview:
 *   # Roadmap: <name>
 *   <!-- roadmap: {"id":"...","color":"#3b82f6","sortOrder":1} -->
 *   > description
 *
 *   ## Project: <name>
 *   <!-- project: {"id":"...","status":"on-track","progress":40,...} -->
 *   > description
 *
 *   ### Tasks
 *   - [x] Task title `P:high` `@assignee` `due:2025-06-01`
 *     <!-- task: {"id":"...","order":1} -->
 *     > task description
 *
 *   ### Status Updates
 *   <!-- update: {"id":"...","author":"...","createdAt":"..."} -->
 *   > update content
 *
 * Projects not assigned to any roadmap appear under "# Unassigned Projects".
 */

import type {
  Roadmap,
  Project,
  Task,
  StatusUpdate,
  CreateRoadmapInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateStatusUpdateInput,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  ProjectPriority,
} from './types';

// =============================================================================
// Export
// =============================================================================

interface ExportData {
  roadmaps: Roadmap[];
  projects: Project[];
  tasks: Task[];
  updates: StatusUpdate[];
}

export function exportToMarkdown(data: ExportData): string {
  const { roadmaps, projects, tasks, updates } = data;

  const roadmapMap = new Map<string, Roadmap>();
  for (const rm of roadmaps) roadmapMap.set(rm.id, rm);

  const tasksByProject = groupBy(tasks, (t) => t.projectId);
  const updatesByProject = groupBy(updates, (u) => u.projectId);

  // Group projects by roadmap
  const projectsByRoadmap = new Map<string, Project[]>();
  const unassigned: Project[] = [];

  for (const project of projects) {
    if (!project.roadmaps?.length) {
      unassigned.push(project);
    } else {
      for (const rmId of project.roadmaps) {
        if (!projectsByRoadmap.has(rmId)) {
          projectsByRoadmap.set(rmId, []);
        }
        projectsByRoadmap.get(rmId)!.push(project);
      }
    }
  }

  const lines: string[] = [];

  lines.push('---');
  lines.push(`title: Busibox Projects Export`);
  lines.push(`exported: ${new Date().toISOString()}`);
  lines.push(`version: 1`);
  lines.push(`roadmaps: ${roadmaps.length}`);
  lines.push(`projects: ${projects.length}`);
  lines.push(`tasks: ${tasks.length}`);
  lines.push(`updates: ${updates.length}`);
  lines.push('---');
  lines.push('');

  // Sorted roadmaps
  const sortedRoadmaps = [...roadmaps].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  for (const rm of sortedRoadmaps) {
    const rmProjects = projectsByRoadmap.get(rm.id) || [];
    lines.push(...renderRoadmap(rm, rmProjects, tasksByProject, updatesByProject));
    lines.push('');
  }

  // Unassigned projects
  if (unassigned.length > 0) {
    lines.push('# Unassigned Projects');
    lines.push('');
    for (const project of unassigned) {
      lines.push(...renderProject(project, tasksByProject, updatesByProject));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function renderRoadmap(
  rm: Roadmap,
  projects: Project[],
  tasksByProject: Map<string, Task[]>,
  updatesByProject: Map<string, StatusUpdate[]>,
): string[] {
  const lines: string[] = [];
  const meta: Record<string, unknown> = {
    id: rm.id,
    color: rm.color,
    sortOrder: rm.sortOrder,
  };

  lines.push(`# Roadmap: ${rm.name}`);
  lines.push(`<!-- roadmap: ${JSON.stringify(meta)} -->`);
  if (rm.description) {
    lines.push('');
    lines.push(`> ${rm.description}`);
  }
  lines.push('');

  const sorted = [...projects].sort((a, b) => (a.priority || 3) - (b.priority || 3));
  for (const project of sorted) {
    lines.push(...renderProject(project, tasksByProject, updatesByProject));
    lines.push('');
  }

  return lines;
}

function renderProject(
  project: Project,
  tasksByProject: Map<string, Task[]>,
  updatesByProject: Map<string, StatusUpdate[]>,
): string[] {
  const lines: string[] = [];

  const meta: Record<string, unknown> = {
    id: project.id,
    status: project.status,
    progress: project.progress,
    priority: project.priority || 3,
    owner: project.owner || undefined,
    team: project.team?.length ? project.team : undefined,
    tags: project.tags?.length ? project.tags : undefined,
    roadmaps: project.roadmaps?.length ? project.roadmaps : undefined,
    startDate: project.startDate || undefined,
    targetDate: project.targetDate || undefined,
    checkpointDate: project.checkpointDate || undefined,
    nextCheckpoint: project.nextCheckpoint || undefined,
    checkpointProgress: project.checkpointProgress || undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  // Remove undefined keys
  for (const key of Object.keys(meta)) {
    if (meta[key] === undefined) delete meta[key];
  }

  lines.push(`## Project: ${project.name}`);
  lines.push(`<!-- project: ${JSON.stringify(meta)} -->`);

  // Inline metadata line for human readability
  const badges: string[] = [];
  badges.push(`**Status:** ${formatStatus(project.status)}`);
  badges.push(`**Progress:** ${project.progress}%`);
  badges.push(`**Priority:** P${project.priority || 3}`);
  if (project.owner) badges.push(`**Owner:** ${project.owner}`);
  if (project.startDate) badges.push(`**Start:** ${formatDate(project.startDate)}`);
  if (project.targetDate) badges.push(`**Target:** ${formatDate(project.targetDate)}`);
  lines.push('');
  lines.push(badges.join(' | '));

  if (project.description) {
    lines.push('');
    lines.push(`> ${project.description.replace(/\n/g, '\n> ')}`);
  }

  // Tasks
  const projectTasks = tasksByProject.get(project.id) || [];
  if (projectTasks.length > 0) {
    lines.push('');
    lines.push('### Tasks');
    lines.push('');
    const sorted = [...projectTasks].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const task of sorted) {
      lines.push(...renderTask(task));
    }
  }

  // Status Updates
  const projectUpdates = updatesByProject.get(project.id) || [];
  if (projectUpdates.length > 0) {
    lines.push('');
    lines.push('### Status Updates');
    lines.push('');
    const sorted = [...projectUpdates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    for (const update of sorted) {
      lines.push(...renderUpdate(update));
    }
  }

  return lines;
}

function renderTask(task: Task): string[] {
  const lines: string[] = [];
  const checked = task.status === 'done' ? 'x' : ' ';
  const inline: string[] = [];

  if (task.status !== 'done' && task.status !== 'todo') {
    inline.push(`\`status:${task.status}\``);
  }
  if (task.priority && task.priority !== 'medium') {
    inline.push(`\`P:${task.priority}\``);
  }
  if (task.assignee) inline.push(`\`@${task.assignee}\``);
  if (task.dueDate) inline.push(`\`due:${formatDate(task.dueDate)}\``);

  const suffix = inline.length > 0 ? ' ' + inline.join(' ') : '';

  const taskMeta: Record<string, unknown> = {
    id: task.id,
    order: task.order,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee || undefined,
    dueDate: task.dueDate || undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  for (const key of Object.keys(taskMeta)) {
    if (taskMeta[key] === undefined) delete taskMeta[key];
  }

  lines.push(`- [${checked}] ${task.title}${suffix}`);
  lines.push(`  <!-- task: ${JSON.stringify(taskMeta)} -->`);

  if (task.description) {
    lines.push(`  > ${task.description.replace(/\n/g, '\n  > ')}`);
  }

  return lines;
}

function renderUpdate(update: StatusUpdate): string[] {
  const lines: string[] = [];

  const meta: Record<string, unknown> = {
    id: update.id,
    author: update.author || undefined,
    previousStatus: update.previousStatus || undefined,
    newStatus: update.newStatus || undefined,
    tasksCompleted: update.tasksCompleted?.length ? update.tasksCompleted : undefined,
    tasksAdded: update.tasksAdded?.length ? update.tasksAdded : undefined,
    createdAt: update.createdAt,
  };
  for (const key of Object.keys(meta)) {
    if (meta[key] === undefined) delete meta[key];
  }

  const dateStr = formatDate(update.createdAt);
  const authorStr = update.author ? ` by ${update.author}` : '';
  lines.push(`**${dateStr}${authorStr}**`);
  lines.push(`<!-- update: ${JSON.stringify(meta)} -->`);
  lines.push('');

  // Content as blockquote
  const contentLines = update.content.split('\n');
  for (const line of contentLines) {
    lines.push(`> ${line}`);
  }
  lines.push('');

  return lines;
}

// =============================================================================
// Import
// =============================================================================

export interface ImportResult {
  roadmaps: CreateRoadmapInput[];
  projects: (CreateProjectInput & { _refId: string; _roadmapRefs: string[] })[];
  tasks: (CreateTaskInput & { _projectRef: string })[];
  updates: (CreateStatusUpdateInput & { _projectRef: string })[];
  warnings: string[];
}

/**
 * Parse a markdown document into structured data ready for import.
 *
 * `_refId` on projects is an opaque reference used to link tasks/updates back
 * to the correct project during import. It comes from the original `id` in the
 * metadata comment, or a slug derived from the project name.
 */
export function importFromMarkdown(markdown: string): ImportResult {
  const lines = markdown.split('\n');
  const warnings: string[] = [];

  const roadmaps: CreateRoadmapInput[] = [];
  const projects: ImportResult['projects'] = [];
  const tasks: ImportResult['tasks'] = [];
  const updates: ImportResult['updates'] = [];

  let currentRoadmapRef: string | null = null;
  let currentProjectRef: string | null = null;
  let section: 'none' | 'tasks' | 'updates' = 'none';
  let pendingUpdateMeta: Record<string, unknown> | null = null;
  let pendingUpdateContent: string[] = [];

  const roadmapRefIds: string[] = [];

  function flushPendingUpdate() {
    if (pendingUpdateMeta && currentProjectRef && pendingUpdateContent.length > 0) {
      updates.push({
        projectId: '', // filled during actual import
        _projectRef: currentProjectRef,
        content: pendingUpdateContent.join('\n'),
        author: (pendingUpdateMeta.author as string) || undefined,
        previousStatus: (pendingUpdateMeta.previousStatus as ProjectStatus) || undefined,
        newStatus: (pendingUpdateMeta.newStatus as ProjectStatus) || undefined,
        tasksCompleted: (pendingUpdateMeta.tasksCompleted as string[]) || undefined,
        tasksAdded: (pendingUpdateMeta.tasksAdded as string[]) || undefined,
      });
    }
    pendingUpdateMeta = null;
    pendingUpdateContent = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip frontmatter
    if (trimmed === '---') {
      // Skip until next ---
      if (i === 0 || (i > 0 && lines.slice(0, i).every((l) => l.trim() === '' || l.trim() === '---'))) {
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '---') j++;
        i = j;
        continue;
      }
    }

    // # Roadmap: Name  or  # Unassigned Projects
    if (trimmed.startsWith('# ')) {
      flushPendingUpdate();
      section = 'none';
      currentProjectRef = null;

      if (trimmed.startsWith('# Roadmap:')) {
        const name = trimmed.replace(/^# Roadmap:\s*/, '').trim();
        const meta = extractMeta(lines, i + 1, 'roadmap');

        const refId = (meta?.id as string) || slugify(name);
        roadmapRefIds.push(refId);
        currentRoadmapRef = refId;

        const description = extractBlockquote(lines, meta ? i + 2 : i + 1);

        roadmaps.push({
          name,
          description: description || undefined,
          color: (meta?.color as string) || undefined,
          sortOrder: (meta?.sortOrder as number) || undefined,
        });
      } else if (trimmed === '# Unassigned Projects') {
        currentRoadmapRef = null;
      }
      continue;
    }

    // ## Project: Name
    if (trimmed.startsWith('## Project:') || trimmed.startsWith('## ')) {
      flushPendingUpdate();
      section = 'none';

      const isExplicit = trimmed.startsWith('## Project:');
      const name = isExplicit
        ? trimmed.replace(/^## Project:\s*/, '').trim()
        : trimmed.replace(/^## /, '').trim();

      const meta = extractMeta(lines, i + 1, 'project');

      const refId = (meta?.id as string) || slugify(name);
      currentProjectRef = refId;

      const roadmapRefs: string[] = [];
      if (meta?.roadmaps && Array.isArray(meta.roadmaps)) {
        roadmapRefs.push(...(meta.roadmaps as string[]));
      } else if (currentRoadmapRef) {
        roadmapRefs.push(currentRoadmapRef);
      }

      // Find description (blockquote after meta or inline badges line)
      let descStart = meta ? i + 2 : i + 1;
      // Skip blank lines and badge lines
      while (descStart < lines.length) {
        const dl = lines[descStart]?.trim();
        if (!dl || dl.startsWith('**Status:**') || dl.startsWith('**Progress:**')) {
          descStart++;
          continue;
        }
        break;
      }
      const description = extractBlockquote(lines, descStart);

      projects.push({
        _refId: refId,
        _roadmapRefs: roadmapRefs,
        name,
        description: description || undefined,
        status: (meta?.status as ProjectStatus) || 'on-track',
        progress: (meta?.progress as number) ?? 0,
        priority: (meta?.priority as ProjectPriority) ?? 3,
        owner: (meta?.owner as string) || undefined,
        team: (meta?.team as string[]) || undefined,
        tags: (meta?.tags as string[]) || undefined,
        startDate: (meta?.startDate as string) || undefined,
        targetDate: (meta?.targetDate as string) || undefined,
        checkpointDate: (meta?.checkpointDate as string) || undefined,
        nextCheckpoint: (meta?.nextCheckpoint as string) || undefined,
        checkpointProgress: (meta?.checkpointProgress as number) || undefined,
      });
      continue;
    }

    // ### Tasks / ### Status Updates
    if (trimmed === '### Tasks') {
      flushPendingUpdate();
      section = 'tasks';
      continue;
    }
    if (trimmed === '### Status Updates') {
      flushPendingUpdate();
      section = 'updates';
      continue;
    }

    // Task line: - [x] Title `P:high` `@user` `due:2025-01-01`
    if (section === 'tasks' && /^- \[[ xX]\]/.test(trimmed)) {
      if (!currentProjectRef) {
        warnings.push(`Line ${i + 1}: Task found outside a project, skipping`);
        continue;
      }

      const checked = /^- \[[xX]\]/.test(trimmed);
      let titlePart = trimmed.replace(/^- \[[ xX]\]\s*/, '');

      // Extract inline annotations
      let priority: TaskPriority = 'medium';
      let assignee: string | undefined;
      let dueDate: string | undefined;
      let status: TaskStatus = checked ? 'done' : 'todo';

      const backtickPattern = /`([^`]+)`/g;
      let match;
      const annotations: string[] = [];
      while ((match = backtickPattern.exec(titlePart)) !== null) {
        annotations.push(match[1]);
      }
      // Remove annotations from title
      titlePart = titlePart.replace(/\s*`[^`]+`/g, '').trim();

      for (const ann of annotations) {
        if (ann.startsWith('P:')) {
          const p = ann.replace('P:', '').toLowerCase();
          if (['low', 'medium', 'high', 'critical'].includes(p)) {
            priority = p as TaskPriority;
          }
        } else if (ann.startsWith('@')) {
          assignee = ann.slice(1);
        } else if (ann.startsWith('due:')) {
          dueDate = ann.replace('due:', '');
        } else if (ann.startsWith('status:')) {
          const s = ann.replace('status:', '');
          if (['todo', 'in-progress', 'blocked', 'done'].includes(s)) {
            status = s as TaskStatus;
          }
        }
      }

      // Check for task meta comment on next line
      const taskMeta = extractMeta(lines, i + 1, 'task');
      if (taskMeta) {
        if (taskMeta.priority) priority = taskMeta.priority as TaskPriority;
        if (taskMeta.assignee) assignee = taskMeta.assignee as string;
        if (taskMeta.dueDate) dueDate = taskMeta.dueDate as string;
        if (taskMeta.status) status = taskMeta.status as TaskStatus;
      }

      // Check for description blockquote (indented)
      let descLine = taskMeta ? i + 2 : i + 1;
      let taskDesc: string | undefined;
      const descLines: string[] = [];
      while (descLine < lines.length && /^\s+>/.test(lines[descLine])) {
        descLines.push(lines[descLine].replace(/^\s+>\s?/, ''));
        descLine++;
      }
      if (descLines.length > 0) taskDesc = descLines.join('\n');

      tasks.push({
        _projectRef: currentProjectRef,
        projectId: '', // filled during actual import
        title: titlePart,
        description: taskDesc,
        status,
        priority,
        assignee,
        dueDate,
        order: (taskMeta?.order as number) || undefined,
      });
      continue;
    }

    // Update meta
    if (section === 'updates') {
      const updateMeta = extractMeta(lines, i, 'update');
      if (updateMeta) {
        flushPendingUpdate();
        pendingUpdateMeta = updateMeta;
        continue;
      }

      // Bold header line for an update (date line)
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && !pendingUpdateMeta) {
        flushPendingUpdate();
        pendingUpdateMeta = {};
        continue;
      }

      // Blockquote content for current update
      if (pendingUpdateMeta && trimmed.startsWith('>')) {
        pendingUpdateContent.push(trimmed.replace(/^>\s?/, ''));
        continue;
      }
    }
  }

  flushPendingUpdate();

  return { roadmaps, projects, tasks, updates, warnings };
}

// =============================================================================
// Template / Schema export
// =============================================================================

export function exportTemplate(): string {
  return `---
title: Busibox Projects Template
description: >
  Use this template to create roadmaps, projects and tasks that can be imported
  into Busibox Projects. Follow the structure below. An AI assistant can fill
  this out based on your requirements.
version: 1
---

# Roadmap: <Roadmap Name>
<!-- roadmap: {"color":"#3b82f6","sortOrder":1} -->

> Brief description of the roadmap's strategic goal.

## Project: <Project Name>
<!-- project: {"status":"on-track","progress":0,"priority":3} -->

**Status:** On Track | **Progress:** 0% | **Priority:** P3

> Describe the project goals, scope and expected outcomes.

### Tasks

- [ ] First task title \`P:high\` \`due:2025-06-01\`
  > Optional task description with more detail.
- [ ] Second task title \`P:medium\` \`@assignee-name\`
- [ ] Third task title
- [x] Completed task example

### Status Updates

**Feb 17, 2026**
<!-- update: {} -->

> Initial project kickoff. Defined scope and milestones.

---

# Unassigned Projects

## Project: <Standalone Project>
<!-- project: {"status":"paused","progress":0,"priority":4} -->

**Status:** Paused | **Progress:** 0% | **Priority:** P4

> Projects that don't belong to a roadmap go here.

### Tasks

- [ ] Example task

---

# Schema Reference

## Roadmap Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | H1 heading after "Roadmap:" |
| description | string | no | Blockquote under heading |
| color | hex string | no | e.g. "#3b82f6", auto-assigned if omitted |
| sortOrder | number | no | Display order, auto-assigned if omitted |

## Project Fields
| Field | Type | Required | Values / Notes |
|-------|------|----------|----------------|
| name | string | yes | H2 heading after "Project:" |
| description | string | no | Blockquote under heading |
| status | enum | no | on-track, at-risk, off-track, completed, paused (default: on-track) |
| progress | number | no | 0-100 (default: 0) |
| priority | number | no | 1 (Critical) to 5 (Minimal), default 3 |
| owner | string | no | User ID or name |
| team | string[] | no | Array of user IDs |
| tags | string[] | no | Freeform tags |
| startDate | ISO date | no | e.g. "2025-03-01" |
| targetDate | ISO date | no | e.g. "2025-09-30" |
| checkpointDate | ISO date | no | Next milestone date |
| nextCheckpoint | string | no | Milestone name |
| checkpointProgress | number | no | 0-100, progress toward checkpoint |

## Task Fields
| Field | Type | Required | Values / Notes |
|-------|------|----------|----------------|
| title | string | yes | Text after "- [ ]" or "- [x]" |
| description | string | no | Indented blockquote under task |
| status | enum | no | todo, in-progress, blocked, done. Checkbox [x] = done, [ ] = todo |
| priority | enum | no | low, medium, high, critical. Inline: \`P:high\` |
| assignee | string | no | Inline: \`@username\` |
| dueDate | ISO date | no | Inline: \`due:2025-06-01\` |
| order | number | no | Display order, auto-assigned by position |

## Status Update Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| content | string | yes | Blockquote content (markdown) |
| author | string | no | In metadata comment |
| previousStatus | enum | no | Project status before update |
| newStatus | enum | no | Project status after update |
| tasksCompleted | string[] | no | IDs of tasks marked done |
| tasksAdded | string[] | no | IDs of new tasks created |

## Tips for AI Generation

1. Create roadmaps for strategic themes (e.g., "Infrastructure", "User Experience")
2. Group related projects under a roadmap
3. Set realistic start/target dates
4. Assign priorities: P1 for urgent/critical, P3 for normal, P5 for nice-to-have
5. Break projects into 3-8 concrete tasks
6. Use status updates to capture decisions and progress
7. Projects without a roadmap go under "# Unassigned Projects"
8. Metadata in \`<!-- -->\` comments is optional; the parser extracts what it can from the markdown structure
`;
}

// =============================================================================
// Helpers
// =============================================================================

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function formatStatus(status: string): string {
  return status.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().split('T')[0];
  } catch {
    return iso;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Look at line `lineIdx` for a metadata comment like:
 *   <!-- type: {...json...} -->
 * Returns parsed JSON or null.
 */
function extractMeta(
  lines: string[],
  lineIdx: number,
  type: string
): Record<string, unknown> | null {
  if (lineIdx >= lines.length) return null;
  const line = lines[lineIdx].trim();
  const pattern = new RegExp(`^<!--\\s*${type}:\\s*(\\{.*\\})\\s*-->$`);
  const match = pattern.exec(line);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Starting from lineIdx, collect contiguous blockquote lines (> ...) and
 * return the combined text. Skips one blank line before the blockquote.
 */
function extractBlockquote(lines: string[], startIdx: number): string | null {
  let idx = startIdx;
  // Skip blank lines
  while (idx < lines.length && lines[idx].trim() === '') idx++;
  const result: string[] = [];
  while (idx < lines.length && lines[idx].trim().startsWith('>')) {
    result.push(lines[idx].trim().replace(/^>\s?/, ''));
    idx++;
  }
  return result.length > 0 ? result.join('\n') : null;
}
