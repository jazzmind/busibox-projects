/**
 * Admin Agents API Route
 * 
 * GET: List configured agents and their status
 * POST: Create/sync agents to agent-api
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';
import { AGENT_DEFINITIONS } from '@/lib/status-agent';

const AGENT_API_URL = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

interface AgentStatus {
  name: string;
  displayName: string;
  description: string;
  exists: boolean;
  id?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'agent-api');
  if (auth instanceof NextResponse) return auth;

  try {
    const statuses: AgentStatus[] = [];

    for (const agent of AGENT_DEFINITIONS) {
      try {
        // Try to fetch agent by name
        const response = await fetch(`${AGENT_API_URL}/agents/definitions?name=${agent.name}`, {
          headers: {
            'Authorization': `Bearer ${auth.apiToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const existingAgent = data.agents?.find((a: { name: string }) => a.name === agent.name);
          
          statuses.push({
            name: agent.name,
            displayName: agent.display_name,
            description: agent.description,
            exists: !!existingAgent,
            id: existingAgent?.id,
          });
        } else {
          statuses.push({
            name: agent.name,
            displayName: agent.display_name,
            description: agent.description,
            exists: false,
          });
        }
      } catch (err) {
        statuses.push({
          name: agent.name,
          displayName: agent.display_name,
          description: agent.description,
          exists: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      agents: statuses,
      total: AGENT_DEFINITIONS.length,
      created: statuses.filter(a => a.exists).length,
    });
  } catch (error) {
    console.error('[ADMIN] Failed to check agents:', error);
    return NextResponse.json(
      {
        error: 'Failed to check agents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'agent-api');
  if (auth instanceof NextResponse) return auth;

  // Check if we should force update
  const { searchParams } = new URL(request.url);
  const forceUpdate = searchParams.get('update') === 'true';

  try {
    const results: { name: string; success: boolean; action: string; id?: string; error?: string }[] = [];

    for (const agent of AGENT_DEFINITIONS) {
      try {
        // First, check if agent exists
        const checkResponse = await fetch(`${AGENT_API_URL}/agents/definitions?name=${agent.name}`, {
          headers: {
            'Authorization': `Bearer ${auth.apiToken}`,
          },
        });

        let existingAgent: { id: string; name: string } | null = null;
        if (checkResponse.ok) {
          const data = await checkResponse.json();
          existingAgent = data.agents?.find((a: { name: string }) => a.name === agent.name);
        }

        if (existingAgent && forceUpdate) {
          // Update existing agent
          console.log(`[ADMIN] Updating agent: ${agent.name} (ID: ${existingAgent.id})`);

          const updateResponse = await fetch(`${AGENT_API_URL}/agents/definitions/${existingAgent.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${auth.apiToken}`,
            },
            body: JSON.stringify(agent),
          });

          if (updateResponse.ok) {
            console.log(`[ADMIN] Updated agent "${agent.name}"`);
            results.push({
              name: agent.name,
              success: true,
              action: 'updated',
              id: existingAgent.id,
            });
          } else {
            const error = await updateResponse.text();
            console.error(`[ADMIN] Failed to update agent "${agent.name}": ${error}`);
            results.push({
              name: agent.name,
              success: false,
              action: 'update_failed',
              error: `${updateResponse.status}: ${error}`,
            });
          }
        } else if (existingAgent) {
          // Agent exists, no update requested
          console.log(`[ADMIN] Agent "${agent.name}" already exists, skipping`);
          results.push({
            name: agent.name,
            success: true,
            action: 'exists',
            id: existingAgent.id,
          });
        } else {
          // Create new agent
          console.log(`[ADMIN] Creating agent: ${agent.name}`);

          const createResponse = await fetch(`${AGENT_API_URL}/agents/definitions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${auth.apiToken}`,
            },
            body: JSON.stringify(agent),
          });

          if (createResponse.ok) {
            const result = await createResponse.json();
            console.log(`[ADMIN] Created agent "${agent.name}" with ID: ${result.id}`);
            results.push({
              name: agent.name,
              success: true,
              action: 'created',
              id: result.id,
            });
          } else {
            const error = await createResponse.text();
            console.error(`[ADMIN] Failed to create agent "${agent.name}": ${error}`);
            results.push({
              name: agent.name,
              success: false,
              action: 'create_failed',
              error: `${createResponse.status}: ${error}`,
            });
          }
        }
      } catch (err) {
        console.error(`[ADMIN] Error processing agent "${agent.name}":`, err);
        results.push({
          name: agent.name,
          success: false,
          action: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const allSuccess = results.every(r => r.success);
    const successCount = results.filter(r => r.success).length;
    const createdCount = results.filter(r => r.action === 'created').length;
    const updatedCount = results.filter(r => r.action === 'updated').length;

    let message = '';
    if (createdCount > 0 && updatedCount > 0) {
      message = `${createdCount} created, ${updatedCount} updated`;
    } else if (createdCount > 0) {
      message = `${createdCount} agents created`;
    } else if (updatedCount > 0) {
      message = `${updatedCount} agents updated`;
    } else if (allSuccess) {
      message = 'All agents already up to date';
    } else {
      message = `${successCount}/${results.length} agents processed`;
    }

    return NextResponse.json({
      success: allSuccess,
      message,
      results,
    });
  } catch (error) {
    console.error('[ADMIN] Failed to process agents:', error);
    return NextResponse.json(
      {
        error: 'Failed to process agents',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
