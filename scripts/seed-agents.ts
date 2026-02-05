#!/usr/bin/env tsx
/**
 * Seed Script for Status Report Agents
 * 
 * Creates the status update and status assistant agents in the agent-api.
 * Run this script once during initial setup.
 * 
 * Usage:
 *   AGENT_API_URL=http://localhost:8000 AUTH_TOKEN=your-token npx tsx scripts/seed-agents.ts
 */

import { AGENT_DEFINITIONS } from '../lib/status-agent';

const AGENT_API_URL = process.env.AGENT_API_URL || 'http://localhost:8000';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

async function createAgent(agent: typeof AGENT_DEFINITIONS[0]) {
  console.log(`Creating agent: ${agent.name}...`);

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
    
    // Check if agent already exists
    if (response.status === 409 || error.includes('already exists')) {
      console.log(`  Agent "${agent.name}" already exists, skipping.`);
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
