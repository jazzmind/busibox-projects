/**
 * Agent API Catch-All Proxy
 *
 * Proxies all /api/agent/* requests to the internal agent API.
 * This allows the browser to call the agent API without direct access to internal IPs.
 * 
 * Used by SimpleChatInterface and other client-side components that need to 
 * communicate with the agent API.
 * 
 * Authentication:
 * - Uses the busibox-session cookie (not the Authorization header)
 * - Exchanges the session JWT for an agent-api token server-side
 * - The client doesn't need to pass any token - cookies are included automatically
 * 
 * Based on busibox-agents's implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentApiUrl } from '@/lib/agent-api-client';
import { getAgentApiToken } from '@/lib/authz-client';

// Get agent API URL (server-side uses internal IP)
const AGENT_API_URL = getAgentApiUrl();
const STATUS_PROJECT_AGENTS = ['status-assistant', 'status-update'] as const;
const CHAT_MESSAGE_PATHS = new Set([
  'chat/message',
  'chat/message/stream',
  'chat/message/stream/agentic',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyBusiboxProjectsAgentDefaults(targetPath: string, body: unknown): unknown {
  if (!CHAT_MESSAGE_PATHS.has(targetPath) || !isRecord(body)) {
    return body;
  }

  const metadata = isRecord(body.metadata) ? body.metadata : undefined;
  if (metadata?.appName !== 'busibox-projects') {
    return body;
  }

  const selectedAgents = Array.isArray(body.selected_agents)
    ? body.selected_agents.filter((value): value is string => typeof value === 'string')
    : [];

  const hasStatusAssistant = selectedAgents.includes('status-assistant');
  const hasStatusUpdate = selectedAgents.includes('status-update');

  // For busibox-projects chat, always allow both status agents so the dispatcher
  // can choose query vs write/update flows correctly.
  if (selectedAgents.length === 0 || (hasStatusAssistant && !hasStatusUpdate)) {
    return {
      ...body,
      selected_agents: [...new Set([...selectedAgents, ...STATUS_PROJECT_AGENTS])],
    };
  }

  return body;
}

async function proxyToAgentAPI(request: NextRequest, method: string, path: string[]) {
  try {
    // Get session token from cookie (busibox-session)
    // We explicitly use the cookie, NOT the Authorization header
    // This is because the client might pass an agent-api token in the header,
    // but we need the session token to exchange for a fresh agent-api token
    const sessionCookie = request.cookies.get('busibox-session');
    
    if (!sessionCookie?.value) {
      // Try TEST_SESSION_JWT for local development
      const testSessionJwt = process.env.TEST_SESSION_JWT;
      if (!testSessionJwt) {
        return NextResponse.json(
          { error: 'Authentication required', message: 'Please log in through Busibox Portal' },
          { status: 401 }
        );
      }
      
      // Use test token
      const agentApiToken = await getAgentApiToken(testSessionJwt);
      return await forwardRequest(request, method, path, agentApiToken);
    }
    
    // Exchange session token for agent-api token
    const agentApiToken = await getAgentApiToken(sessionCookie.value);
    return await forwardRequest(request, method, path, agentApiToken);
  } catch (error: unknown) {
    console.error('[AGENT PROXY] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to proxy request to agent API';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function forwardRequest(
  request: NextRequest,
  method: string,
  path: string[],
  agentApiToken: string
) {
  try {
    // Build target URL
    const targetPath = path.join('/');
    const url = new URL(`${AGENT_API_URL}/${targetPath}`);
    
    // Copy query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Prepare request options
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${agentApiToken}`,
      },
    };

    // Add body for non-GET requests
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          const rawBody = await request.json();
          const body = applyBusiboxProjectsAgentDefaults(targetPath, rawBody);
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
          };
          options.body = JSON.stringify(body);
        } catch {
          // If JSON parsing fails, just pass through
        }
      } else if (contentType) {
        options.headers = {
          ...options.headers,
          'Content-Type': contentType,
        };
        options.body = await request.text();
      }
    }

    console.log('[AGENT PROXY] Forwarding:', method, targetPath);

    // Forward request to agent API
    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AGENT PROXY] Agent API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Agent API error: ${errorText}` },
        { status: response.status }
      );
    }

    // Check if response is streaming (text/event-stream or chunked)
    const contentType = response.headers.get('Content-Type') || '';
    const isStreaming = contentType.includes('text/event-stream') || 
                       contentType.includes('stream') ||
                       response.headers.get('Transfer-Encoding') === 'chunked';

    if (isStreaming) {
      // Stream the response back to the client
      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle 204 No Content (e.g., DELETE responses)
    if (response.status === 204) {
      return new Response(null, { status: 204 });
    }

    // For non-streaming responses, parse and return JSON
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    console.error('[AGENT PROXY] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to proxy request to agent API';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'GET', path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'POST', path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'PUT', path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'PATCH', path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToAgentAPI(request, 'DELETE', path);
}
