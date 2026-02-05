/**
 * Projects API Route
 * 
 * GET: List all projects
 * POST: Create a new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  listProjects,
  createProject,
  getDashboardData,
} from '@/lib/data-api-client';
import type { CreateProjectInput } from '@/lib/types';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeTasks = searchParams.get('includeTasks') === 'true';

    if (includeTasks) {
      // Return full dashboard data with tasks and updates
      const dashboardData = await getDashboardData(auth.apiToken, documentIds);
      return NextResponse.json(dashboardData);
    }

    // Just list projects
    const result = await listProjects(auth.apiToken, documentIds.projects, {
      status,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PROJECTS] Failed to list projects:', error);
    return NextResponse.json(
      {
        error: 'Failed to list projects',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const body = await request.json() as CreateProjectInput;

    if (!body.name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const project = await createProject(auth.apiToken, documentIds.projects, body);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[PROJECTS] Failed to create project:', error);
    return NextResponse.json(
      {
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
