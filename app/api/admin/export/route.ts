import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  listProjects,
  listTasks,
  listStatusUpdates,
  listRoadmaps,
} from '@/lib/data-api-client';
import { exportToMarkdown } from '@/lib/markdown-io';
import type { Project, StatusUpdate, Task } from '@/lib/types';

const EXPORT_PAGE_LIMIT = 1000;

function formatErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    const withOriginal = error as Error & { originalError?: unknown };
    if (withOriginal.originalError) {
      if (typeof withOriginal.originalError === 'string') return withOriginal.originalError;
      try {
        return JSON.stringify(withOriginal.originalError);
      } catch {
        return String(withOriginal.originalError);
      }
    }
    return error.message;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function fetchAllProjects(token: string, documentId: string) {
  const projects: Project[] = [];
  let offset = 0;

  while (true) {
    const page = await listProjects(token, documentId, {
      limit: EXPORT_PAGE_LIMIT,
      offset,
    });
    projects.push(...page.projects);
    if (page.projects.length < EXPORT_PAGE_LIMIT) break;
    offset += page.projects.length;
  }

  return projects;
}

async function fetchAllTasks(token: string, documentId: string) {
  const tasks: Task[] = [];
  let offset = 0;

  while (true) {
    const page = await listTasks(token, documentId, {
      limit: EXPORT_PAGE_LIMIT,
      offset,
    });
    tasks.push(...page.tasks);
    if (page.tasks.length < EXPORT_PAGE_LIMIT) break;
    offset += page.tasks.length;
  }

  return tasks;
}

async function fetchAllStatusUpdates(token: string, documentId: string) {
  const updates: StatusUpdate[] = [];
  let offset = 0;

  while (true) {
    const page = await listStatusUpdates(token, documentId, {
      limit: EXPORT_PAGE_LIMIT,
      offset,
    });
    updates.push(...page.updates);
    if (page.updates.length < EXPORT_PAGE_LIMIT) break;
    offset += page.updates.length;
  }

  return updates;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'markdown').toLowerCase();
    if (format !== 'markdown' && format !== 'json') {
      return NextResponse.json(
        { error: 'Unsupported export format. Use "markdown" or "json".' },
        { status: 400 }
      );
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);

    const [projects, tasks, updates] = await Promise.all([
      fetchAllProjects(auth.apiToken, documentIds.projects),
      fetchAllTasks(auth.apiToken, documentIds.tasks),
      fetchAllStatusUpdates(auth.apiToken, documentIds.updates),
    ]);

    let roadmapsResult: { roadmaps: Awaited<ReturnType<typeof listRoadmaps>>['roadmaps'] };
    try {
      const loadedRoadmaps = await listRoadmaps(auth.apiToken, documentIds.roadmaps);
      roadmapsResult = { roadmaps: loadedRoadmaps.roadmaps };
    } catch (roadmapError) {
      console.warn('[EXPORT] Failed to load roadmaps, continuing with empty roadmaps:', roadmapError);
      roadmapsResult = { roadmaps: [] };
    }

    if (format === 'json') {
      return NextResponse.json({
        roadmaps: roadmapsResult.roadmaps,
        projects,
        tasks,
        updates,
      });
    }

    const markdown = exportToMarkdown({
      roadmaps: roadmapsResult.roadmaps,
      projects,
      tasks,
      updates,
    });

    const filename = `busibox-projects-${new Date().toISOString().split('T')[0]}.md`;

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT] Failed to export:', error);
    return NextResponse.json(
      {
        error: 'Failed to export',
        details: formatErrorDetails(error),
      },
      { status: 500 }
    );
  }
}
