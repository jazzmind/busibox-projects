/**
 * ============================================
 * DEMO FILE - DELETE WHEN BUILDING REAL APP
 * ============================================
 * 
 * This file is part of the app-template demo.
 * Delete this entire file when starting your real app.
 * 
 * See DEMO.md for complete deletion checklist.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data...');

  // Use test user ID from environment or default
  const testUserId = process.env.TEST_USER_ID || 'test-user-id';

  // Create demo notes
  const demoNotes = [
    {
      title: 'Welcome to the Demo',
      content: 'This is a demo note to test CRUD operations. You can create, read, update, and delete notes.',
      userId: testUserId,
    },
    {
      title: 'Database Testing',
      content: 'This note demonstrates that Prisma is working correctly with PostgreSQL.',
      userId: testUserId,
    },
    {
      title: 'SSO Authentication',
      content: 'If you can see this note, it means SSO authentication is working and your userId is being correctly extracted from the session token.',
      userId: testUserId,
    },
  ];

  for (const note of demoNotes) {
    const created = await prisma.demoNote.create({
      data: note,
    });
    console.log(`✅ Created demo note: ${created.title} (${created.id})`);
  }

  console.log('✅ Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
