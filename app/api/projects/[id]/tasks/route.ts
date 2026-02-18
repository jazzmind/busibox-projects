/**
 * Project Tasks API Route
 * 
 * GET: List tasks for a project
 * POST: Create a new task for the project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  listTasks,
  createTask,
} from '@/lib/data-api-client';
import { syncProjectToJiraIfMapped } from '@/lib/jira-auto-sync';
import type { CreateTaskInput } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: projectId } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listTasks(auth.apiToken, documentIds.tasks, {
      projectId,
      status,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TASKS] Failed to list tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to list tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: projectId } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const body = await request.json() as Omit<CreateTaskInput, 'projectId'>;

    if (!body.title) {
      return NextResponse.json(
        { error: 'Task title is required' },
        { status: 400 }
      );
    }

    const task = await createTask(auth.apiToken, documentIds.tasks, {
      ...body,
      projectId,
    });
    await syncProjectToJiraIfMapped(auth.apiToken, projectId).catch((error) => {
      console.error('[TASKS] JIRA sync failed after create:', error);
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[TASKS] Failed to create task:', error);
    return NextResponse.json(
      {
        error: 'Failed to create task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
