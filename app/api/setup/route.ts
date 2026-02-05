/**
 * Setup API Route
 * 
 * Initializes the data documents required for the status report app.
 * Call this once on first run to create the documents in data-api.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments, DOCUMENTS } from '@/lib/data-api-client';

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);

    return NextResponse.json({
      success: true,
      message: 'Data documents initialized successfully',
      documents: {
        projects: { name: DOCUMENTS.PROJECTS, id: documentIds.projects },
        tasks: { name: DOCUMENTS.TASKS, id: documentIds.tasks },
        updates: { name: DOCUMENTS.UPDATES, id: documentIds.updates },
      },
    });
  } catch (error) {
    console.error('[SETUP] Failed to initialize data documents:', error);
    return NextResponse.json(
      {
        error: 'Setup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);

    return NextResponse.json({
      initialized: true,
      documents: {
        projects: { name: DOCUMENTS.PROJECTS, id: documentIds.projects },
        tasks: { name: DOCUMENTS.TASKS, id: documentIds.tasks },
        updates: { name: DOCUMENTS.UPDATES, id: documentIds.updates },
      },
    });
  } catch (error) {
    console.error('[SETUP] Failed to check data documents:', error);
    return NextResponse.json(
      {
        initialized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
