# AI Initiative Status

Track and visualize the status of AI initiatives with intelligent status updates via conversational AI agents.

## Features

- **Dashboard**: Visual overview of all projects with progress bars, status badges, and upcoming tasks
- **Project Detail**: Full task list with status management and historical timeline
- **Intelligent Updates**: Chat-based status updates with AI that asks about your progress
- **Cross-Project Chat**: Ask questions about any project, find blockers, get summaries

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3003](http://localhost:3003) to view the app.

## Architecture

This app uses **frontend-only mode** - all data is stored via the Busibox data-api service, and chat interactions are powered by the agent-api.

### Data Storage

Three data documents in data-api:
- **Projects**: Name, description, status, progress, checkpoints
- **Tasks**: Title, status, assignee, priority, due date
- **Status Updates**: Markdown content, task changes, status changes

### AI Agents

Two custom agents for intelligent interactions:
- **status-update**: Guides users through quick status updates (~5 min per project)
- **status-assistant**: Answers questions about projects and status

## Environment Variables

```bash
# Required
DATA_API_URL=http://localhost:8002      # Data storage
AGENT_API_URL=http://localhost:8000     # AI chat
AUTHZ_BASE_URL=http://localhost:8010    # Authentication
NEXT_PUBLIC_AI_PORTAL_URL=http://localhost:3000
```

See `env.example` for full configuration.

## Setup

### 1. Initialize Data Documents

The app auto-initializes on first access, or manually:

```bash
curl -X POST http://localhost:3003/api/setup
```

### 2. Seed Agents (One-time)

```bash
AGENT_API_URL=http://localhost:8000 AUTH_TOKEN=your-token npx tsx scripts/seed-agents.ts
```

## Deployment

Deploy via Busibox Ansible:

```bash
# From busibox/provision/ansible
make install SERVICE=status-report
```

## Development

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # Run linter
```

## Tech Stack

- Next.js 16 (App Router)
- React 19, TypeScript 5
- Tailwind CSS 4
- @jazzmind/busibox-app (shared components)

## License

Private - Busibox ecosystem application.
