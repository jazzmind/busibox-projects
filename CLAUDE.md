# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**AI Initiative Status** (busibox-projects) is a Next.js application for tracking and visualizing the status of AI initiatives with intelligent status updates via conversational AI agents. It integrates with the Busibox infrastructure using frontend-only mode (no direct database access).

**Key Architecture**: Pure frontend with data stored via data-api and intelligent chat via agent-api. No Prisma or direct database access.

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3003)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Linting
npm run lint
```

### Environment Setup

```bash
cp env.example .env.local
# Edit .env.local with your settings
```

### Initial Setup

On first run, the app automatically initializes data documents. You can also manually initialize:

```bash
# Via API
curl -X POST http://localhost:3003/api/setup

# Seed agents (one-time)
AGENT_API_URL=http://localhost:8000 AUTH_TOKEN=your-token npx tsx scripts/seed-agents.ts
```

### Deployment

**From Busibox Admin Workstation**:
```bash
cd /path/to/busibox/provision/ansible

# Deploy to production:
make install SERVICE=busibox-projects

# Deploy to staging:
make install SERVICE=busibox-projects INV=inventory/staging
```

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TypeScript 5, Tailwind CSS 4
- **Storage**: Busibox data-api (no direct database)
- **Chat**: Busibox agent-api with custom agents
- **Auth**: Busibox SSO via authz service (JWKS/RS256)
- **Shared Components**: @jazzmind/busibox-app
- **Deployment**: PM2, nginx (apps-lxc container), Ansible

### Project Structure

```
busibox-projects/
├── app/                           # Next.js App Router
│   ├── api/                       # API routes
│   │   ├── chat/status/           # Agent chat proxy
│   │   ├── projects/              # Project CRUD
│   │   ├── projects/[id]/         # Single project
│   │   ├── projects/[id]/tasks/   # Project tasks
│   │   ├── projects/[id]/updates/ # Status updates
│   │   ├── tasks/[taskId]/        # Single task
│   │   └── setup/                 # Initialize data documents
│   ├── projects/[id]/             # Project detail page
│   ├── projects/[id]/update/      # Status update chat
│   ├── chat/                      # General project chat
│   ├── page.tsx                   # Dashboard
│   ├── layout.tsx                 # Root layout
│   └── providers.tsx              # Client providers
├── components/
│   ├── projects/                  # Project components
│   │   ├── ProjectCard.tsx        # Project card with progress
│   │   ├── ProgressBar.tsx        # Progress visualization
│   │   ├── StatusBadge.tsx        # Status/priority badges
│   │   ├── TaskList.tsx           # Task list with actions
│   │   └── StatusTimeline.tsx     # Update history
│   ├── auth/                      # Auth components
│   └── CustomHeader.tsx           # App header
├── lib/
│   ├── data-api-client.ts         # Data-API client (projects, tasks, updates)
│   ├── status-agent.ts            # Agent configurations
│   ├── auth-middleware.ts         # Auth middleware
│   └── types.ts                   # TypeScript types
└── scripts/
    └── seed-agents.ts             # Seed agents script
```

### Data Model

Data is stored in three data-api documents:

**Projects** (`busibox-projects-projects`):
- id, name, description
- status (on-track, at-risk, off-track, completed, paused)
- progress, checkpointProgress, nextCheckpoint, checkpointDate
- owner, team, tags

**Tasks** (`busibox-projects-tasks`):
- id, projectId, title, description
- status (todo, in-progress, blocked, done)
- assignee, priority, dueDate, order

**Status Updates** (`busibox-projects-updates`):
- id, projectId, content (markdown)
- author, tasksCompleted, tasksAdded
- previousStatus, newStatus

### Agents

Two custom agents for intelligent interactions:

1. **status-update**: Guides users through quick status updates
   - Asks about completed work, blockers, next steps
   - Updates task statuses
   - Records status updates
   - Suggests project status changes

2. **status-assistant**: Answers questions about projects
   - Reports on project status
   - Identifies at-risk projects
   - Searches historical updates
   - Provides insights and summaries

## Key Patterns

### 1. Authentication (Busibox SSO)

All API routes use Zero Trust token exchange:

```typescript
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request, 'data-api');
  if (auth instanceof NextResponse) return auth;

  // Use auth.apiToken for data-api calls
}
```

### 2. Data-API Storage

All storage operations go through the data-api client:

```typescript
import { 
  ensureDataDocuments,
  listProjects,
  createProject,
  updateTask 
} from '@/lib/data-api-client';

// Ensure documents exist
const documentIds = await ensureDataDocuments(token);

// Query projects
const { projects } = await listProjects(token, documentIds.projects);

// Create project
const project = await createProject(token, documentIds.projects, { name: 'My Project' });
```

### 3. Chat Integration

Uses `SimpleChatInterface` from `@jazzmind/busibox-app`:

```typescript
<SimpleChatInterface
  token={apiToken}
  agentId="status-update"
  placeholder="What did you work on today?"
  welcomeMessage={buildWelcomeMessage()}
  enableDocSearch={true}
  useAgenticStreaming={true}
/>
```

## Environment Variables

### Required

```bash
# Application
NODE_ENV=development
PORT=3003
APP_NAME=busibox-projects

# Authentication
NEXT_PUBLIC_BUSIBOX_PORTAL_URL=http://localhost:3000
AUTHZ_BASE_URL=http://localhost:8010

# Backend Services
DATA_API_URL=http://localhost:8002
AGENT_API_URL=http://localhost:8000
```

### Optional

```bash
NEXT_PUBLIC_BASE_PATH=           # /status for nginx proxy
VERBOSE_AUTHZ_LOGGING=false
```

## Development Workflow

### Adding Features

1. **Data changes**: Update types in `lib/types.ts`, update client in `lib/data-api-client.ts`
2. **API routes**: Add routes in `app/api/`
3. **UI components**: Add to `components/projects/`
4. **Pages**: Add to `app/`

### Agent Changes

1. Update agent config in `lib/status-agent.ts`
2. Re-run seed script: `npx tsx scripts/seed-agents.ts`

## Busibox Integration

### Service Dependencies

- **Data API** (data-lxc): Stores projects, tasks, updates
- **Agent API** (agent-lxc): Powers chat interactions
- **Apps Container** (apps-lxc): Hosts the Next.js application

### Deployment

Apps are deployed via Ansible:

1. Code pushed to GitHub
2. Ansible pulls and deploys
3. PM2 manages the process
4. nginx proxies requests at `/status`

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Server Components by default
- Keep components focused
- Use Tailwind CSS for styling

### Data Operations

- Use `ensureDataDocuments()` before CRUD operations
- Handle not-found cases properly
- Use optimistic updates for UI responsiveness

### Security

- Never expose tokens in client code
- Use `requireAuthWithTokenExchange()` for all authenticated routes
- Validate all user input

## Troubleshooting

### Auth Issues

```bash
# Check AuthZ service
curl http://authz:8010/health

# Check JWKS endpoint
curl http://authz:8010/.well-known/jwks.json
```

### Data-API Issues

```bash
# Check data-api health
curl http://data-api:8002/health

# List data documents (with token)
curl -H "Authorization: Bearer $TOKEN" http://data-api:8002/data
```

### Agent Issues

```bash
# Check agent-api health
curl http://agent-api:8000/health

# List agents
curl -H "Authorization: Bearer $TOKEN" http://agent-api:8000/agents
```

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Related Projects

- **Busibox**: Infrastructure and deployment automation
- **busibox-portal**: Main dashboard application
- **Busibox-App**: Shared component library (@jazzmind/busibox-app)
- **App Template**: Base template this was built from

## Important Notes

1. **Frontend Mode**: Uses data-api for all storage, no direct database
2. **Authentication**: Uses Busibox SSO with Zero Trust token exchange
3. **Agents**: Requires seeding agents via `scripts/seed-agents.ts`
4. **Dev Port**: 3003
5. **Base Path**: `/status` when deployed via nginx proxy
