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

    const [projectsResult, tasksResult, updatesResult] = await Promise.all([
      listProjects(auth.apiToken, documentIds.projects, { limit: 500 }),
      listTasks(auth.apiToken, documentIds.tasks, { limit: 2000 }),
      listStatusUpdates(auth.apiToken, documentIds.updates, { limit: 2000 }),
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
        projects: projectsResult.projects,
        tasks: tasksResult.tasks,
        updates: updatesResult.updates,
      });
    }

    const markdown = exportToMarkdown({
      roadmaps: roadmapsResult.roadmaps,
      projects: projectsResult.projects,
      tasks: tasksResult.tasks,
      updates: updatesResult.updates,
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
