/**
 * Graph Entity API Route
 * 
 * GET: Get entity details and neighbors from the graph
 * 
 * Proxies to data-api /data/graph/entity/{node_id}
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:8002';

interface RouteParams {
  params: Promise<{ nodeId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { nodeId } = await params;
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const url = `${DATA_API_URL}/data/graph/entity/${encodeURIComponent(nodeId)}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/graph/entity] Data API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get entity data', detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/graph/entity] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
