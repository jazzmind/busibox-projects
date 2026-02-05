/**
 * Single Project API Route
 * 
 * GET: Get project by ID (with optional tasks and updates)
 * PUT: Update project
 * DELETE: Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  getProject,
  updateProject,
  deleteProject,
  getProjectWithDetails,
} from '@/lib/data-api-client';
import type { UpdateProjectInput } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('includeDetails') === 'true';

    if (includeDetails) {
      const result = await getProjectWithDetails(auth.apiToken, documentIds, id);
      if (!result) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    const project = await getProject(auth.apiToken, documentIds.projects, id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('[PROJECT] Failed to get project:', error);
    return NextResponse.json(
      {
        error: 'Failed to get project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const body = await request.json() as UpdateProjectInput;

    const project = await updateProject(auth.apiToken, documentIds.projects, id, body);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('[PROJECT] Failed to update project:', error);
    return NextResponse.json(
      {
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
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

    const deleted = await deleteProject(auth.apiToken, documentIds.projects, id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PROJECT] Failed to delete project:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
