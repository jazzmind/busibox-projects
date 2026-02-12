/**
 * Status Update Agent Configuration
 * 
 * Defines the agent configuration for intelligent status updates.
 * This can be used to create the agent via the agent-api.
 */

export const STATUS_UPDATE_AGENT = {
  name: 'status-update',
  display_name: 'Status Update Assistant',
  description: 'Helps users quickly update project status through conversational interactions.',
  instructions: `You are a concise status update assistant. Given project and task data with the user's update, summarize what was changed.

Guidelines:
- Be brief and efficient
- List changes as bullet points
- Show before/after for status changes
- Suggest next steps if appropriate
- Keep responses under 200 words`,
  model: 'agent',
  tools: {
    names: [
      'list_data_documents',
      'create_data_document',
      'query_data',
      'insert_records',
      'update_records',
    ],
  },
  workflows: {
    execution_mode: 'run_max_iterations',
    tool_strategy: 'predefined_pipeline',
    max_iterations: 20,
  },
  allow_frontier_fallback: true,
  is_builtin: true,
  scopes: ['data:read', 'data:write'],
};

export const STATUS_ASSISTANT_AGENT = {
  name: 'status-assistant',
  display_name: 'Project Status Assistant',
  description: 'Answers questions, processes meeting notes, and manages projects and tasks across all initiatives.',
  instructions: `You are a project status assistant. Given tool results and user context, create a clear, well-organized response.

Guidelines:
- Start with a brief summary of what was done or found
- Use **bold** for project names and key terms
- Use bullet points for lists
- Include relevant metrics (record counts, progress %)
- Be concise and actionable
- If records were created, list what was created with a checkmark
- If querying data, format results in a readable way

Data Schema Reference:
- Projects: name, description, status (on-track/at-risk/off-track/completed/paused), progress (0-100), owner, tags
- Tasks: projectId, title, description, status (todo/in-progress/blocked/done), assignee, priority (low/medium/high/urgent)
- Updates: projectId, content, author, tasksCompleted, tasksAdded, previousStatus, newStatus`,
  model: 'agent',
  tools: {
    names: [
      'list_data_documents',
      'create_data_document',
      'query_data',
      'insert_records',
      'update_records',
    ],
  },
  workflows: {
    execution_mode: 'run_max_iterations',
    tool_strategy: 'predefined_pipeline',
    max_iterations: 20,
  },
  allow_frontier_fallback: true,
  is_builtin: true,
  scopes: ['data:read', 'data:write'],
};

/**
 * Agent definitions for seeding
 */
export const AGENT_DEFINITIONS = [
  STATUS_UPDATE_AGENT,
  STATUS_ASSISTANT_AGENT,
];
