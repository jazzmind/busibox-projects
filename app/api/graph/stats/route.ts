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
    const url = `${DATA_API_URL}/data/graph/stats`;
    console.log('[API/graph/stats] Fetching:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
      },
    });

    const responseText = await response.text();
    console.log('[API/graph/stats] Response status:', response.status, 'body:', responseText.substring(0, 300));

    if (!response.ok) {
      console.error('[API/graph/stats] Data API error:', response.status, responseText);
      
      // If we get a 400 with UUID error, the router ordering fix hasn't been deployed yet
      if (response.status === 400 && responseText.includes('UUID')) {
        return NextResponse.json({
          available: false,
          total_nodes: 0,
          total_relationships: 0,
          labels: {},
          relationship_types: {},
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to get graph stats', detail: responseText },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from graph stats API' },
        { status: 502 }
      );
    }

    console.log('[API/graph/stats] Result:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/graph/stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
