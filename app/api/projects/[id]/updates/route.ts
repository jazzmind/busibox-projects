/**
 * Project Status Updates API Route
 * 
 * GET: List status updates for a project
 * POST: Create a new status update
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import {
  ensureDataDocuments,
  listStatusUpdates,
  createStatusUpdate,
} from '@/lib/data-api-client';
import type { CreateStatusUpdateInput } from '@/lib/types';

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
    
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listStatusUpdates(auth.apiToken, documentIds.updates, {
      projectId,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[UPDATES] Failed to list status updates:', error);
    return NextResponse.json(
      {
        error: 'Failed to list status updates',
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
    const body = await request.json() as Omit<CreateStatusUpdateInput, 'projectId'>;

    if (!body.content) {
      return NextResponse.json(
        { error: 'Update content is required' },
        { status: 400 }
      );
    }

    const update = await createStatusUpdate(auth.apiToken, documentIds.updates, {
      ...body,
      projectId,
    });

    return NextResponse.json(update, { status: 201 });
  } catch (error) {
    console.error('[UPDATES] Failed to create status update:', error);
    return NextResponse.json(
      {
        error: 'Failed to create status update',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
