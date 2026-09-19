const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const assert = require('assert');

async function main() {
  console.log('--- Verifying Shopify Day Preference Persistence ---');

  // Find or create test user
  let user = await prisma.user.findFirst({ where: { role: 'FAISAL' } });
  if (!user) {
    user = await prisma.user.findFirst();
  }
  assert(user, 'User must exist in DB');

  // 1. Update preferences with day, month, year
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      shopifyDayPreference: 15,
      shopifyMonthPreference: 9,
      shopifyYearPreference: 2026
    },
    select: {
      id: true,
      email: true,
      shopifyDayPreference: true,
      shopifyMonthPreference: true,
      shopifyYearPreference: true
    }
  });

  assert.strictEqual(updated.shopifyDayPreference, 15, 'shopifyDayPreference must be 15');
  assert.strictEqual(updated.shopifyMonthPreference, 9, 'shopifyMonthPreference must be 9');
  assert.strictEqual(updated.shopifyYearPreference, 2026, 'shopifyYearPreference must be 2026');
  console.log('✓ Successfully persisted shopifyDayPreference: 15, Month: 9, Year: 2026 to User in DB');

  // 2. Fetch and confirm values survive
  const fetched = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      shopifyDayPreference: true,
      shopifyMonthPreference: true,
      shopifyYearPreference: true
    }
  });
  assert.strictEqual(fetched.shopifyDayPreference, 15);
  assert.strictEqual(fetched.shopifyMonthPreference, 9);
  assert.strictEqual(fetched.shopifyYearPreference, 2026);
  console.log('✓ Verified preferences read accurately from database');

  console.log('\nALL SHOPIFY DATE PREFERENCE TESTS PASSED!');
}

main()
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
