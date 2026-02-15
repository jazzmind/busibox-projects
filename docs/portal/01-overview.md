---
title: "AI Initiative Status Overview"
category: "apps"
order: 1
description: "Track and visualize AI initiative status with intelligent conversational updates"
published: true
app_id: "busibox-projects"
app_name: "AI Initiative Status"
---

# AI Initiative Status

AI Initiative Status is a project tracking application that combines visual dashboards with AI-powered status updates. Instead of filling out forms, you have a conversation with an AI agent that asks about your progress, updates tasks, and records status changes.

## Key Features

- **Dashboard**: Visual overview of all projects with progress bars, status badges, and upcoming checkpoints
- **Project Detail**: Full task list with drag-and-drop status management and historical timeline
- **Intelligent Updates**: Chat-based status updates -- the AI asks about your progress, completed work, and blockers
- **Cross-Project Chat**: Ask questions about any project, find blockers across teams, get summaries

## How It Works

### Data Storage

AI Initiative Status stores all data through the Busibox data-api using three document collections:

- **Projects**: Name, description, status (on-track/at-risk/off-track/completed/paused), progress tracking, checkpoints
- **Tasks**: Title, status (todo/in-progress/blocked/done), assignee, priority, due date
- **Status Updates**: Markdown content, task changes made during the update, status transitions

### AI Agents

Two custom agents power the intelligent interactions:

- **status-update**: Guides you through a quick status update (~5 minutes per project). It asks about completed work, blockers, and next steps, then updates task statuses and records the update.
- **status-assistant**: Answers questions about projects and status history. It can report on at-risk projects, identify blockers, search historical updates, and provide summaries.

## Getting Started

1. Open the AI Portal and navigate to AI Initiative Status
2. The app automatically initializes its data documents on first access
3. Create your first project from the dashboard
4. Add tasks to track work items
5. Use the "Update Status" button to have a conversation about your progress
