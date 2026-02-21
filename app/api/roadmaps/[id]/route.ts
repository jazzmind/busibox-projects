import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  getRoadmap,
  updateRoadmap,
  deleteRoadmap,
  listProjects,
  updateProject,
} from '@/lib/data-api-client';
import type { UpdateRoadmapInput } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const roadmap = await getRoadmap(auth.apiToken, documentIds.roadmaps, id);

    if (!roadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error('[ROADMAPS] Failed to get roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to get roadmap', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateRoadmapInput;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const roadmap = await updateRoadmap(auth.apiToken, documentIds.roadmaps, id, body);

    if (!roadmap) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    return NextResponse.json(roadmap);
  } catch (error) {
    console.error('[ROADMAPS] Failed to update roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to update roadmap', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);

    // Remove this roadmap ID from all projects that reference it
    const { projects } = await listProjects(auth.apiToken, documentIds.projects, { limit: 500 });
    const affectedProjects = projects.filter((p) => p.roadmaps?.includes(id));
    for (const project of affectedProjects) {
      await updateProject(auth.apiToken, documentIds.projects, project.id, {
        roadmaps: (project.roadmaps || []).filter((r) => r !== id),
      });
    }

    const deleted = await deleteRoadmap(auth.apiToken, documentIds.roadmaps, id);
    if (!deleted) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ROADMAPS] Failed to delete roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to delete roadmap', details: String(error) },
      { status: 500 }
    );
  }
}
