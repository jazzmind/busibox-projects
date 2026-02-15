/**
 * Graph Stats API Route
 * 
 * GET: Get graph statistics (node counts, relationship types, etc.)
 * 
 * Proxies to data-api /data/graph/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:8002';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const response = await fetch(`${DATA_API_URL}/data/graph/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      // Router ordering issue fallback
      if (response.status === 400 && text.includes('UUID')) {
        return NextResponse.json({
          available: false,
          total_nodes: 0,
          total_relationships: 0,
          labels: {},
          relationship_types: {},
        });
      }
      return NextResponse.json(
        { error: 'Failed to get graph stats', detail: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/graph/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
