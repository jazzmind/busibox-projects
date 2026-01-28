# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor AI when working with code in this repository.

## Project Overview

**Busibox App Template** is a Next.js 16 application template designed for rapid development of apps that integrate with the Busibox infrastructure. It supports two operational modes:

1. **Frontend-Only Mode** (APP_MODE=frontend): Pure frontend with API proxying to backend services
2. **Prisma Mode** (APP_MODE=prisma): Direct database access via Prisma ORM

**Key Architecture**: Choose your mode based on whether your app needs direct database access or will proxy to existing backend APIs.

## Quick Start

### Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3002)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Linting
npm run lint

# Database (Prisma mode only)
npm run db:push          # Push schema changes
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio
```

### Environment Setup

```bash
cp env.example .env.local
# Edit .env.local with your settings
```

### Deployment

**From Busibox Admin Workstation**:
```bash
cd /path/to/busibox/provision/ansible

# Deploy to production:
make deploy-<app-name>

# Deploy to staging:
make deploy-<app-name> INV=inventory/staging
```

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router with Turbopack)
- **UI**: React 19, TypeScript 5, Tailwind CSS 4
- **Database**: Prisma 6 (optional, for prisma mode)
- **Auth**: Busibox SSO via authz service (JWKS/RS256)
- **Shared Components**: @jazzmind/busibox-app
- **Deployment**: PM2, nginx (apps-lxc container), Ansible

### Project Structure

```
app-template/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── health/        # Health check
│   │   ├── session/       # Session management
│   │   └── sso/           # SSO callback
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   ├── globals.css        # Tailwind CSS
│   ├── providers.tsx      # Client providers
│   └── app-shell.tsx      # App shell with auth
├── components/            # React components
│   └── auth/              # Auth components
├── lib/                   # Utilities
│   ├── auth-middleware.ts # Auth middleware
│   ├── authz-client.ts    # AuthZ service client
│   ├── sso.ts             # SSO validation (JWKS)
│   ├── prisma.ts          # Prisma client (prisma mode)
│   ├── api-client.ts      # API client (frontend mode)
│   └── types.ts           # Shared types
├── prisma/                # Prisma schema
├── scripts/               # Utility scripts
└── test/                  # Test setup
```

### Operational Modes

#### Frontend-Only Mode (APP_MODE=frontend)

Use when your app proxies to existing backend APIs:

```typescript
// app/api/items/route.ts
export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  const response = await fetch(`${BACKEND_API_URL}/items`, {
    headers: { 'Authorization': `Bearer ${auth.apiToken}` },
  });

  return NextResponse.json(await response.json());
}
```

#### Prisma Mode (APP_MODE=prisma)

Use when your app needs direct database access:

```typescript
// app/api/items/route.ts
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await prisma.item.findMany({
    where: { organizationId: session.organizationId },
  });

  return NextResponse.json(items);
}
```

## Key Patterns

### 1. Authentication (Busibox SSO)

All apps use Busibox SSO with Zero Trust token exchange:

```typescript
// Token flow:
// 1. User clicks app in AI Portal
// 2. AI Portal exchanges session JWT for app-scoped token via authz
// 3. authz verifies user has app access via RBAC
// 4. authz issues RS256 token with app_id claim
// 5. App validates token via authz JWKS endpoint
// 6. AuthContext exchanges token via POST /api/sso to set cookies
```

**Client-side Token Exchange (AuthContext):**

The `AuthContext` component handles token exchange from URL parameters:

```typescript
// IMPORTANT: Use POST to /api/sso for token exchange
// Do NOT use GET with redirect: 'manual' - browsers don't process 
// Set-Cookie headers from redirect responses in manual mode
const response = await fetch('/api/sso', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
  credentials: 'include',
});
```

**Server-side Auth Middleware (API routes):**

```typescript
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  // auth.ssoToken - original session JWT
  // auth.apiToken - exchanged API token
}
```

### 2. Server vs Client Components

**Default to Server Components**:
```typescript
// app/items/page.tsx
export default async function ItemsPage() {
  const items = await fetchItems();
  return <ItemList items={items} />;
}
```

**Use Client Components for interactivity**:
```typescript
// components/ItemForm.tsx
'use client';

import { useState } from 'react';

export function ItemForm() {
  const [value, setValue] = useState('');
  // Client-side state and effects
}
```

### 3. Dynamic Route Parameters (Next.js 16)

Route params are async and must be awaited:

```typescript
// app/items/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemPage({ params }: PageProps) {
  const { id } = await params;
  const item = await fetchItem(id);

  if (!item) notFound();

  return <ItemDetail item={item} />;
}
```

### 4. API Route Params

```typescript
// app/api/items/[id]/route.ts
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params;
  // ...
}
```

## Environment Variables

### Required (All Modes)

```bash
# Application
NODE_ENV=development
PORT=3002
NEXT_PUBLIC_BASE_PATH=          # e.g., /myapp for nginx proxy
NEXT_PUBLIC_APP_URL=http://localhost:3002

# Authentication
NEXT_PUBLIC_AI_PORTAL_URL=http://localhost:3000
AUTHZ_BASE_URL=http://localhost:8010
AUTHZ_CLIENT_ID=my-app
AUTHZ_CLIENT_SECRET=secret
APP_NAME=My App                 # For token audience validation
```

### Frontend-Only Mode

```bash
# Backend API URLs
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
```

### Prisma Mode

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
```

## Development Workflow

### Adding a New Feature

1. **Plan the feature**:
   - Determine if frontend-only or prisma access needed
   - Design UI components
   - Define API routes

2. **Create API routes**:
   ```typescript
   // app/api/feature/route.ts
   export async function GET(request: NextRequest) {
     // Implementation based on mode
   }
   ```

3. **Create components**:
   ```typescript
   // components/feature/FeatureComponent.tsx
   export function FeatureComponent() {
     // Implementation
   }
   ```

4. **Add pages**:
   ```typescript
   // app/feature/page.tsx
   export default function FeaturePage() {
     // Implementation
   }
   ```

### Adding Database Models (Prisma Mode)

1. Edit `prisma/schema.prisma`
2. Run `npm run db:push` (development) or create migration
3. Run `npm run db:generate`

## Testing

### Unit Tests

```bash
npm test
```

### Writing Tests

```typescript
// app/api/items/route.test.ts
import { describe, it, expect } from 'vitest';

describe('Items API', () => {
  it('should return items for authenticated user', async () => {
    // Test implementation
  });
});
```

## Busibox Integration

### Shared Components

The `@jazzmind/busibox-app` package provides:

- **ThemeProvider**: Dark/light mode
- **BusiboxApiProvider**: API configuration
- **CustomizationProvider**: Branding
- **FetchWrapper**: Auth-aware fetch
- **Footer, VersionBar**: Standard UI elements

### Deployment

Apps are deployed to the apps-lxc container via Ansible:

1. Code pushed to GitHub
2. Ansible pulls and deploys
3. PM2 manages the process
4. nginx proxies requests

### Service Discovery

```bash
# Production IPs
AI Portal:    10.96.200.201:3000
AuthZ:        10.96.200.210:8010
Apps LXC:     10.96.200.201

# Staging IPs
AI Portal:    10.96.201.201:3000
AuthZ:        10.96.201.210:8010
Apps LXC:     10.96.201.201
```

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow Next.js App Router conventions
- Use Server Components by default
- Keep components small and focused
- Use Tailwind CSS for styling

### API Routes

- Always authenticate requests
- Handle errors gracefully
- Return appropriate status codes
- Use proper TypeScript types

### Database (Prisma Mode)

- Always filter by organizationId for multi-tenant data
- Use transactions for multi-record operations
- Handle errors with try/catch
- Use `prisma db push` for development, migrations for production

### Security

- Never expose secrets in client code
- Validate all user input
- Use RBAC for authorization
- Log security events

## Troubleshooting

### Auth Issues

```bash
# Check AuthZ service
curl http://authz:8010/health

# Check JWKS endpoint
curl http://authz:8010/.well-known/jwks.json
```

### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Prisma Issues

```bash
# Regenerate client
npm run db:generate

# Reset database (development only)
npx prisma db push --force-reset  # CAUTION: destroys data
```

## Related Projects

- **Busibox**: Infrastructure and deployment automation
- **AI Portal**: Main dashboard application
- **Busibox-App**: Shared component library (@jazzmind/busibox-app)
- **Agent Manager**: Reference implementation (frontend-only mode)

## Important Notes

1. **Choose your mode**: Set APP_MODE=frontend or APP_MODE=prisma based on your needs
2. **Authentication**: All apps use Busibox SSO - no custom auth needed
3. **Deployment**: Always use Ansible for deployment to Busibox infrastructure
4. **Port**: Default port is 3002 (adjust in env if needed)
5. **Base Path**: Configure NEXT_PUBLIC_BASE_PATH for nginx proxy routing
