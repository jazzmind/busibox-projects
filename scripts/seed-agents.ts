#!/usr/bin/env tsx
/**
 * Seed Script for Status Report Agents
 * 
 * Creates or updates the status update and status assistant agents in the agent-api.
 * Run this script during initial setup or after changing agent definitions.
 * 
 * Usage:
 *   AGENT_API_URL=http://localhost:8000 AUTH_TOKEN=your-token npx tsx scripts/seed-agents.ts
 */

import { AGENT_DEFINITIONS } from '../lib/status-agent';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:8000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function getExistingAgent(name: string): Promise<{ id: string } | null> {
  try {
    // GET /agents returns all agents visible to the user (built-in + personal)
    const response = await fetch(`${AGENT_API_URL}/agents`, {
      headers: {
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
      },
    });
    if (!response.ok) return null;
    const agents = await response.json();
    const items = agents.items || agents;
    if (!Array.isArray(items)) return null;
    return items.find((a: { name: string }) => a.name === name) || null;
  } catch {
    return null;
  }
}

async function updateAgent(agentId: string, agent: typeof AGENT_DEFINITIONS[0]) {
  console.log(`  Updating agent "${agent.name}" (${agentId})...`);

  const response = await fetch(`${AGENT_API_URL}/agents/definitions/${agentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify(agent),
  });

  if (!response.ok) {
    const error = await response.text();
    // 403 on built-in agents means we're not the owner - that's OK, agent exists
    if (response.status === 403 && error.includes('Built-in')) {
      console.log(`  Agent "${agent.name}" exists as built-in (owned by another user). Skipping update.`);
      return;
    }
    throw new Error(`Failed to update agent "${agent.name}": ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log(`  Updated agent "${agent.name}" (${result.id})`);
}

async function createAgent(agent: typeof AGENT_DEFINITIONS[0]) {
  console.log(`Creating/updating agent: ${agent.name}...`);

  // Check if agent already exists
  const existing = await getExistingAgent(agent.name);
  if (existing) {
    await updateAgent(existing.id, agent);
    return;
  }

  const response = await fetch(`${AGENT_API_URL}/agents/definitions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify(agent),
  });

  if (!response.ok) {
    const error = await response.text();
    
    // Check if agent already exists (race condition)
    if (response.status === 409 || error.includes('already exists')) {
      console.log(`  Agent "${agent.name}" already exists, attempting update...`);
      const existingRetry = await getExistingAgent(agent.name);
      if (existingRetry) {
        await updateAgent(existingRetry.id, agent);
        return;
      }
      console.log(`  Could not find agent to update, skipping.`);
      return;
    }
    
    throw new Error(`Failed to create agent "${agent.name}": ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log(`  Created agent "${agent.name}" with ID: ${result.id}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Status Report Agent Seeder');
  console.log('='.repeat(60));
  console.log(`Agent API URL: ${AGENT_API_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN ? '[provided]' : '[not provided]'}`);
  console.log();

  try {
    for (const agent of AGENT_DEFINITIONS) {
      await createAgent(agent);
    }

    console.log();
    console.log('Done! Agents created successfully.');
    console.log();
    console.log('Available agents:');
    AGENT_DEFINITIONS.forEach(a => {
      console.log(`  - ${a.name}: ${a.description}`);
    });
  } catch (error) {
    console.error();
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
