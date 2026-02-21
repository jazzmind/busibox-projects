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

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);

    const [projectsResult, tasksResult, updatesResult, roadmapsResult] = await Promise.all([
      listProjects(auth.apiToken, documentIds.projects, { limit: 500 }),
      listTasks(auth.apiToken, documentIds.tasks, { limit: 2000 }),
      listStatusUpdates(auth.apiToken, documentIds.updates, { limit: 2000 }),
      listRoadmaps(auth.apiToken, documentIds.roadmaps),
    ]);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'markdown';

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
      { error: 'Failed to export', details: String(error) },
      { status: 500 }
    );
  }
}
