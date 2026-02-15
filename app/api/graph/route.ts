/**
 * Graph Visualization API Route
 * 
 * GET: Get graph visualization data (nodes + edges) from the data-api
 * 
 * Proxies to data-api /data/graph with Zero Trust token exchange.
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
    const queryString = searchParams.toString();
    const url = `${DATA_API_URL}/data/graph${queryString ? `?${queryString}` : ''}`;

    console.log('[API/graph] Fetching:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
      },
    });

    const responseText = await response.text();
    console.log('[API/graph] Response status:', response.status, 'body length:', responseText.length);

    if (!response.ok) {
      console.error('[API/graph] Data API error:', response.status, responseText);
      
      // If we get a 400 with UUID error, the router ordering fix hasn't been deployed yet
      if (response.status === 400 && responseText.includes('UUID')) {
        console.error('[API/graph] Router ordering issue - /data/graph being caught by /data/{document_id}. Deploy data-api with updated main.py.');
        return NextResponse.json({
          nodes: [],
          edges: [],
          total_nodes: 0,
          total_edges: 0,
          graph_available: false,
          error: 'Graph API routing issue. The data-api needs to be redeployed with the router ordering fix.',
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to get graph data', detail: responseText },
        { status: response.status }
      );
    }

    // Parse and log summary
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[API/graph] Failed to parse response:', responseText.substring(0, 200));
      return NextResponse.json(
        { error: 'Invalid response from graph API' },
        { status: 502 }
      );
    }

    console.log('[API/graph] Result:', {
      graph_available: data.graph_available,
      nodes: data.nodes?.length ?? 0,
      edges: data.edges?.length ?? 0,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/graph] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
