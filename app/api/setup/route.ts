/**
 * Setup API Route
 * 
 * Initializes the data documents and agents required for the status report app.
 * Call this once on first run to set up everything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { getApiToken } from '@/lib/authz-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz';
import { ensureDataDocuments, DOCUMENTS } from '@/lib/data-api-client';
import { AGENT_DEFINITIONS } from '@/lib/status-agent';

const AGENT_API_URL = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

async function createAgents(agentApiToken: string): Promise<{ created: string[]; existing: string[]; failed: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const failed: string[] = [];

  for (const agent of AGENT_DEFINITIONS) {
    try {
      const response = await fetch(`${AGENT_API_URL}/agents/definitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentApiToken}`,
        },
        body: JSON.stringify(agent),
      });

      if (response.ok) {
        created.push(agent.name);
      } else if (response.status === 409) {
        existing.push(agent.name);
      } else {
        console.error(`[SETUP] Failed to create agent "${agent.name}": ${response.status}`);
        failed.push(agent.name);
      }
    } catch (err) {
      console.error(`[SETUP] Error creating agent "${agent.name}":`, err);
      failed.push(agent.name);
    }
  }

  return { created, existing, failed };
}

export async function POST(request: NextRequest) {
  // Get tokens for both data-api and agent-api
  const dataAuth = await requireAuthWithTokenExchange(request, 'data-api');
  if (dataAuth instanceof NextResponse) return dataAuth;

  // Get SSO token for agent-api exchange
  const ssoToken = getTokenFromRequest(request);
  let agentApiToken: string | null = null;
  
  if (ssoToken) {
    try {
      agentApiToken = await getApiToken(ssoToken, 'agent-api');
    } catch (err) {
      console.warn('[SETUP] Failed to get agent-api token:', err);
    }
  }

  try {
    // Step 1: Initialize data documents
    const documentIds = await ensureDataDocuments(dataAuth.apiToken);

    // Step 2: Create agents (if we have agent-api token)
    let agentResult = { created: [] as string[], existing: [] as string[], failed: [] as string[] };
    if (agentApiToken) {
      agentResult = await createAgents(agentApiToken);
    }

    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
      documents: {
        projects: { name: DOCUMENTS.PROJECTS, id: documentIds.projects },
        tasks: { name: DOCUMENTS.TASKS, id: documentIds.tasks },
        updates: { name: DOCUMENTS.UPDATES, id: documentIds.updates },
      },
      agents: {
        created: agentResult.created,
        existing: agentResult.existing,
        failed: agentResult.failed,
        skipped: !agentApiToken,
      },
    });
  } catch (error) {
    console.error('[SETUP] Failed to initialize:', error);
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
