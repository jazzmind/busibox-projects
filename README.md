# Busibox App Template

A production-ready Next.js 16 template for building apps that integrate with the Busibox infrastructure.

## Features

- **Next.js 16** with App Router and Turbopack
- **React 19** with Server and Client Components
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **Busibox SSO** authentication via authz service
- **Dual Mode Support**: Frontend-only (API proxy) or Prisma (direct DB)
- **AI-Optimized**: Comprehensive cursor rules and CLAUDE.md for AI-assisted development
- **Production Ready**: Standalone output for container deployment

## Quick Start

### 1. Clone and Install

```bash
# Copy template to new project
cp -r app-template my-new-app
cd my-new-app

# Update package.json name
npm pkg set name="my-new-app"

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp env.example .env.local

# Edit with your settings
nano .env.local
```

Key settings to update:
- `APP_NAME` - Your app name
- `APP_MODE` - `frontend` or `prisma`
- `NEXT_PUBLIC_AI_PORTAL_URL` - AI Portal URL
- `AUTHZ_BASE_URL` - AuthZ service URL

### 3. Start Development

```bash
npm run dev
```

Visit http://localhost:3002

## Demo Features (Delete Before Production)

**⚠️ This template includes working demo features for testing deployment.**

### What's Included

The demo features test three critical aspects of your Busibox deployment:

1. **SSO Authentication** - Validates user sessions from AI Portal
2. **Database CRUD** - Tests Prisma operations with PostgreSQL
3. **Agent API Calls** - Verifies Zero Trust token exchange

### Try the Demo

Visit `/demo` after starting the development server to test:

- View authenticated user information
- Create, read, update, and delete notes
- Make downstream calls to agent-api with proper authentication

### Removing Demo Features

**Before deploying to production, delete all demo features using the checklist in `DEMO.md`.**

Quick deletion:

```bash
# Delete demo files
rm -rf app/demo/ app/api/demo/ prisma/seed.ts DEMO.md

# Update schema (remove DemoNote model)
# Edit prisma/schema.prisma to remove DEMO MODEL section

# Update navigation and home page
# Remove sections marked with "DEMO" comments

# Push schema changes
npm run db:push
```

See [`DEMO.md`](DEMO.md) for the complete step-by-step deletion guide.

## Operational Modes

### Frontend-Only Mode (Default)

Best for apps that proxy to existing backend APIs.

```bash
# .env.local
APP_MODE=frontend
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
```

### Prisma Mode

Best for apps that need direct database access.

```bash
# .env.local
APP_MODE=prisma
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
```

Then set up the database:

```bash
npm run db:push      # Push schema
npm run db:generate  # Generate client
```

## Project Structure

```
my-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Tailwind CSS
├── components/            # React components
├── lib/                   # Utilities
│   ├── auth-middleware.ts # Auth middleware
│   ├── authz-client.ts    # AuthZ client
│   ├── sso.ts             # SSO validation
│   └── prisma.ts          # Prisma client (prisma mode)
├── prisma/                # Prisma schema
├── .cursor/rules/         # Cursor AI rules
├── CLAUDE.md              # Claude Code guidance
└── env.example            # Environment template
```

## Customization

### 1. Update Branding

Edit `app/providers.tsx`:

```typescript
const defaultCustomization: PortalCustomization = {
  companyName: "Your Company",
  siteName: "Your App",
  slogan: "Your tagline",
  primaryColor: "#0f172a",
  // ...
};
```

### 2. Update Metadata

Edit `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Your App",
  description: "Your app description",
};
```

### 3. Add Navigation

Edit `app/app-shell.tsx` to add your navigation links.

### 4. Add Routes

Create new routes in `app/` directory:

```typescript
// app/dashboard/page.tsx
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
```

## Authentication

All apps use Busibox SSO via the authz service.

### API Route Authentication

```typescript
// app/api/items/route.ts
import { requireAuthWithTokenExchange } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuthWithTokenExchange(request);
  if (auth instanceof NextResponse) return auth;

  // Use auth.apiToken for backend calls
  const response = await fetch(`${BACKEND_URL}/items`, {
    headers: { 'Authorization': `Bearer ${auth.apiToken}` },
  });

  return NextResponse.json(await response.json());
}
```

### Session Check

```typescript
// components/ProtectedComponent.tsx
'use client';

import { useAuth } from '@/components/auth/AuthContext';

export function ProtectedComponent() {
  const { authState } = useAuth();
  
  if (!authState.isAuthenticated) {
    return <div>Please log in</div>;
  }
  
  return <div>Welcome, {authState.user?.email}</div>;
}
```

## Development

### Commands

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run start         # Start production server
npm test              # Run tests
npm run test:watch    # Test watch mode
npm run test:coverage # Test with coverage
npm run lint          # Lint code
```

### Database (Prisma Mode)

```bash
npm run db:push       # Push schema to database
npm run db:generate   # Generate Prisma client
npm run db:studio     # Open Prisma Studio
```

### Busibox App Package

```bash
npm run update:busibox-app  # Update to latest version
npm run link:busibox        # Link local busibox-app
npm run unlink:busibox      # Unlink and restore npm version
```

## Deployment

### Busibox Infrastructure

Deploy via Ansible:

```bash
cd /path/to/busibox/provision/ansible

# Production
make deploy-my-app

# Staging
make deploy-my-app INV=inventory/staging
```

### Standalone Build

The app builds with `output: 'standalone'` for container deployment:

```bash
npm run build
node .next/standalone/server.js
```

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
  it('should return items', async () => {
    // Test implementation
  });
});
```

## AI-Assisted Development

This template is optimized for AI-assisted development:

- **CLAUDE.md** - Comprehensive guidance for Claude Code
- **.cursor/rules/** - 9 cursor rules for consistent patterns
- **Typed APIs** - Full TypeScript for better AI understanding

### Key Rules

- `001-architect.mdc` - Planning and architecture
- `002-nextjs-patterns.mdc` - Next.js 16 patterns
- `003-component-org.mdc` - Component organization
- `004-database.mdc` - Prisma patterns
- `005-api-routes.mdc` - API route patterns
- `006-authentication.mdc` - Busibox SSO

## Troubleshooting

### Auth Issues

```bash
# Check AuthZ service
curl http://localhost:8010/health

# Check JWKS endpoint
curl http://localhost:8010/.well-known/jwks.json
```

### Build Issues

```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
```

### Prisma Issues

```bash
# Regenerate client
npm run db:generate

# Check database connection
npx prisma db pull
```

## Related Projects

- **Busibox** - Infrastructure and deployment
- **AI Portal** - Main dashboard application
- **Agent Manager** - Reference frontend-only implementation
- **@jazzmind/busibox-app** - Shared component library

## License

Private - Jazzmind Inc.
