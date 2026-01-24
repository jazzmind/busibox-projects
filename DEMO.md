# Demo Features - Deletion Guide

**⚠️ DELETE ALL DEMO FEATURES BEFORE BUILDING YOUR PRODUCTION APP**

This document lists all demo features included in the app-template and provides instructions for removing them.

## Purpose

The demo features serve to test that your Busibox deployment is working correctly:

- **SSO Authentication**: Verifies user session from AI Portal
- **Database Operations**: Tests Prisma connectivity and CRUD operations
- **Agent API Calls**: Validates Zero Trust token exchange with downstream services

## What Gets Tested

### 1. SSO Authentication
- ✅ Session token validation
- ✅ User information extraction
- ✅ Role-based access control
- ✅ Cookie handling and refresh

### 2. Database Operations
- ✅ Prisma client initialization
- ✅ Database connectivity
- ✅ Schema migrations
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Data validation

### 3. Agent API Integration
- ✅ Zero Trust token exchange
- ✅ Downstream service authentication
- ✅ API token propagation
- ✅ Error handling and retries

## Deletion Checklist

Follow these steps to remove all demo features:

### Step 1: Delete Demo Files

```bash
# Delete demo page
rm -rf app/demo/

# Delete demo API routes
rm -rf app/api/demo/

# Delete seed script
rm prisma/seed.ts

# Delete this documentation
rm DEMO.md
```

### Step 2: Update Database Schema

Edit `prisma/schema.prisma`:

```bash
# Remove the entire DemoNote model section (lines marked with DEMO comments)
# Look for:
# // =============================================================================
# // DEMO MODEL - DELETE WHEN BUILDING REAL APP
# // =============================================================================
```

Then push the schema changes:

```bash
npm run db:push
```

### Step 3: Update Navigation

Edit `app/app-shell.tsx`:

Remove the demo link (marked with `{/* DEMO LINK - DELETE WHEN BUILDING REAL APP */}`):

```tsx
// DELETE THIS:
<Link href="/demo" className="...">
  Demo Features
</Link>
```

### Step 4: Update Home Page

Edit `app/page.tsx`:

Remove the demo section (marked with `{/* DEMO SECTION - DELETE WHEN BUILDING REAL APP */}`).

### Step 5: Update package.json

Edit `package.json`:

Remove the Prisma seed configuration if you don't need it:

```json
// Remove this section if not needed:
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

### Step 6: Update busibox.json

Edit `busibox.json`:

Update the manifest for your actual app:

```json
{
  "name": "Your App Name",
  "id": "your-app-id",
  "description": "Your app description",
  "database": {
    "required": true,  // or false if you don't need a database
    "preferredName": "your_app_db_name"
  }
}
```

### Step 7: Update README

Edit `README.md`:

Remove the "Demo Features" section.

### Step 8: Clean Database (Optional)

If you ran the seed script and want to clean up demo data:

```sql
-- Connect to your database and run:
DROP TABLE IF EXISTS "DemoNote";
```

Or use Prisma Studio:

```bash
npm run db:studio
```

### Step 9: Verify Deletion

Check that all demo code is removed:

```bash
# Search for remaining demo references
grep -r "DEMO" app/ --exclude-dir=node_modules
grep -r "demo" app/ --exclude-dir=node_modules

# Should return no results in application code
```

### Step 10: Test Your App

```bash
# Generate Prisma client with updated schema
npm run db:generate

# Start development server
npm run dev

# Visit http://localhost:3002
# Verify:
# - No /demo route exists (should 404)
# - No demo nav link
# - Home page updated
```

## Files to Delete Summary

### Required Deletions

- ✅ `app/demo/page.tsx` - Demo UI page
- ✅ `app/api/demo/notes/route.ts` - Notes CRUD API
- ✅ `app/api/demo/notes/[id]/route.ts` - Single note operations
- ✅ `app/api/demo/agent/route.ts` - Agent API demo
- ✅ `prisma/seed.ts` - Demo seed script
- ✅ `DEMO.md` - This file

### Required Modifications

- ✅ `busibox.json` - Update app identity
- ✅ `prisma/schema.prisma` - Remove DemoNote model
- ✅ `app/app-shell.tsx` - Remove demo nav link
- ✅ `app/page.tsx` - Remove demo section
- ✅ `README.md` - Remove demo documentation
- ✅ `package.json` - Optionally remove seed config

## After Deletion

Your app template will be clean and ready for your production application:

1. ✅ No demo code or routes
2. ✅ Clean database schema
3. ✅ Updated manifest
4. ✅ Production-ready structure

## Need Help?

If you encounter issues during deletion:

1. Check that you've deleted all files listed above
2. Run `npm run db:generate` after schema changes
3. Restart your development server
4. Clear browser cache if routes still appear

## Building Your Real App

Now that demo features are removed, you can:

1. Define your database schema in `prisma/schema.prisma`
2. Create your API routes in `app/api/`
3. Build your UI pages in `app/`
4. Update branding in `app/providers.tsx`
5. Configure environment in `.env.local`
6. Deploy to Busibox infrastructure

See `README.md` and `CLAUDE.md` for development guidance.
