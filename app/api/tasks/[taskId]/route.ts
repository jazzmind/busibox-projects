/**
 * Single Task API Route
 * 
 * GET: Get task by ID
 * PUT: Update task
 * DELETE: Delete task
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  getTask,
  updateTask,
  deleteTask,
} from '@/lib/data-api-client';
import { syncProjectToJiraIfMapped } from '@/lib/jira-auto-sync';
import type { UpdateTaskInput } from '@/lib/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { taskId } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);

    const task = await getTask(auth.apiToken, documentIds.tasks, taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[TASK] Failed to get task:', error);
    return NextResponse.json(
      {
        error: 'Failed to get task',
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
    const { taskId } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const body = await request.json() as UpdateTaskInput;

    const task = await updateTask(auth.apiToken, documentIds.tasks, taskId, body);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    await syncProjectToJiraIfMapped(auth.apiToken, task.projectId).catch((error) => {
      console.error('[TASK] JIRA sync failed after update:', error);
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('[TASK] Failed to update task:', error);
    return NextResponse.json(
      {
        error: 'Failed to update task',
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
    const { taskId } = await params;
    const documentIds = await ensureDataDocuments(auth.apiToken);

    const deleted = await deleteTask(auth.apiToken, documentIds.tasks, taskId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TASK] Failed to delete task:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete task',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
