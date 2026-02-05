/**
 * Status Chat API Route
 * 
 * Proxies chat requests to the agent-api for status update conversations.
 * Supports both streaming and non-streaming responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'agent-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const streaming = searchParams.get('stream') !== 'false';

    // Determine the endpoint based on streaming preference
    const endpoint = streaming
      ? '/chat/message/stream/agentic'
      : '/chat/message';

    const response = await fetch(`${AGENT_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        // Default to using the status update agent if not specified
        selected_agents: body.selected_agents || ['status-update'],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      return NextResponse.json(
        { error: error.error || 'Chat request failed' },
        { status: response.status }
      );
    }

    // For streaming responses, return the stream directly
    if (streaming && response.body) {
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // For non-streaming, return JSON
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[CHAT] Failed to process chat request:', error);
    return NextResponse.json(
      {
        error: 'Chat request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
