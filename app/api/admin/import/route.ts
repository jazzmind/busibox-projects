import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  createRoadmap,
  createProject,
  createTask,
  createStatusUpdate,
  listRoadmaps,
} from '@/lib/data-api-client';
import { importFromMarkdown } from '@/lib/markdown-io';

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';
    let markdown: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      markdown = await file.text();
    } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
      markdown = await request.text();
    } else {
      const body = await request.json();
      markdown = body.markdown;
      if (!markdown) {
        return NextResponse.json({ error: 'No markdown content provided' }, { status: 400 });
      }
    }

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const parsed = importFromMarkdown(markdown);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        summary: {
          roadmaps: parsed.roadmaps.length,
          projects: parsed.projects.length,
          tasks: parsed.tasks.length,
          updates: parsed.updates.length,
        },
        roadmaps: parsed.roadmaps.map((r) => r.name),
        projects: parsed.projects.map((p) => ({ name: p.name, status: p.status, priority: p.priority })),
        tasks: parsed.tasks.map((t) => ({ title: t.title, status: t.status, projectRef: t._projectRef })),
        warnings: parsed.warnings,
      });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);

    // Resolve roadmap references: create roadmaps and build ref->id map
    const existingRoadmaps = await listRoadmaps(auth.apiToken, documentIds.roadmaps);
    const roadmapRefToId = new Map<string, string>();
    let createdRoadmaps = 0;

    for (const rmInput of parsed.roadmaps) {
      // Check if a roadmap with the same name already exists
      const existing = existingRoadmaps.roadmaps.find(
        (r) => r.name.toLowerCase() === rmInput.name.toLowerCase()
      );
      if (existing) {
        roadmapRefToId.set(slugify(rmInput.name), existing.id);
        // Also map by old ID if present in the color/sort metadata
      } else {
        const created = await createRoadmap(auth.apiToken, documentIds.roadmaps, rmInput);
        roadmapRefToId.set(slugify(rmInput.name), created.id);
        createdRoadmaps++;
      }
    }

    // Create projects and build ref->id map
    const projectRefToId = new Map<string, string>();
    let createdProjects = 0;

    for (const pInput of parsed.projects) {
      const { _refId, _roadmapRefs, ...projectInput } = pInput;

      // Resolve roadmap references to actual IDs
      const resolvedRoadmaps: string[] = [];
      for (const ref of _roadmapRefs) {
        const resolved = roadmapRefToId.get(ref) || roadmapRefToId.get(slugify(ref));
        if (resolved) resolvedRoadmaps.push(resolved);
      }

      const created = await createProject(auth.apiToken, documentIds.projects, {
        ...projectInput,
        roadmaps: resolvedRoadmaps.length > 0 ? resolvedRoadmaps : undefined,
      });
      projectRefToId.set(_refId, created.id);
      createdProjects++;
    }

    // Create tasks
    let createdTasks = 0;
    for (const tInput of parsed.tasks) {
      const { _projectRef, ...taskInput } = tInput;
      const projectId = projectRefToId.get(_projectRef);
      if (!projectId) {
        parsed.warnings.push(`Could not resolve project ref "${_projectRef}" for task "${taskInput.title}"`);
        continue;
      }
      await createTask(auth.apiToken, documentIds.tasks, {
        ...taskInput,
        projectId,
      });
      createdTasks++;
    }

    // Create status updates
    let createdUpdates = 0;
    for (const uInput of parsed.updates) {
      const { _projectRef, ...updateInput } = uInput;
      const projectId = projectRefToId.get(_projectRef);
      if (!projectId) {
        parsed.warnings.push(`Could not resolve project ref "${_projectRef}" for status update`);
        continue;
      }
      await createStatusUpdate(auth.apiToken, documentIds.updates, {
        ...updateInput,
        projectId,
      });
      createdUpdates++;
    }

    return NextResponse.json({
      success: true,
      created: {
        roadmaps: createdRoadmaps,
        projects: createdProjects,
        tasks: createdTasks,
        updates: createdUpdates,
      },
      warnings: parsed.warnings,
    });
  } catch (error) {
    console.error('[IMPORT] Failed to import:', error);
    return NextResponse.json(
      { error: 'Failed to import', details: String(error) },
      { status: 500 }
    );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
