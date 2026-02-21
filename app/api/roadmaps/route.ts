import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { ensureDataDocuments, listRoadmaps, createRoadmap } from '@/lib/data-api-client';
import type { CreateRoadmapInput } from '@/lib/types';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const documentIds = await ensureDataDocuments(auth.apiToken);
    const result = await listRoadmaps(auth.apiToken, documentIds.roadmaps);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ROADMAPS] Failed to list roadmaps:', error);
    return NextResponse.json(
      { error: 'Failed to list roadmaps', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await request.json()) as CreateRoadmapInput;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const documentIds = await ensureDataDocuments(auth.apiToken);
    const roadmap = await createRoadmap(auth.apiToken, documentIds.roadmaps, body);
    return NextResponse.json(roadmap, { status: 201 });
  } catch (error) {
    console.error('[ROADMAPS] Failed to create roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to create roadmap', details: String(error) },
      { status: 500 }
    );
  }
}
