/**
 * Graph Visualization API Route
 * 
 * GET: Get graph visualization data (nodes + edges) from the data-api
 * 
 * Proxies to data-api /data/graph with Zero Trust token exchange.
 * Automatically filters to status-report node types unless a label
 * parameter is explicitly provided.
 * 
 * Supports query parameters: center, label, depth, limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

const DATA_API_URL = process.env.DATA_API_URL || 'http://localhost:8002';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    // Filter to only status-report node types (exclude ingested document entities)
    if (!searchParams.has('label')) {
      searchParams.set('label', 'StatusProject,StatusTask,StatusUpdate');
    }
    const queryString = searchParams.toString();
    const url = `${DATA_API_URL}/data/graph?${queryString}`;

    const response = await fetch(url, {
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
          nodes: [],
          edges: [],
          total_nodes: 0,
          total_edges: 0,
          graph_available: false,
          error: 'Graph API routing issue - data-api needs redeployment.',
        });
      }
      return NextResponse.json(
        { error: 'Failed to get graph data', detail: text },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/graph] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
