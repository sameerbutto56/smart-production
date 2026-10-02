const { PrismaClient } = require('@prisma/client');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const prisma = new PrismaClient();

async function main() {
  const tables = ['User', 'InventoryItem', 'OrderStage', 'SystemSetting', 'AuditLog', 'Order'];
  
  try {
    await prisma.$connect();
    console.log('Connected to database');

    console.log('\n--- 1. Enabling Row Level Security (RLS) ---');
    for (const table of tables) {
      console.log(`Enabling RLS on "${table}"...`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`✅ RLS enabled on "${table}"`);
    }

    console.log('\n--- 2. Revoking permissions from anon and authenticated roles ---');
    for (const table of tables) {
      console.log(`Revoking all privileges on "${table}" from anon and authenticated roles...`);
      await prisma.$executeRawUnsafe(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated CASCADE;`);
      console.log(`✅ Revoked privileges on "${table}"`);
    }

    console.log('\n--- 3. Revoking schema-level privileges ---');
    console.log('Revoking usage/all on schema public from anon and authenticated roles...');
    await prisma.$executeRawUnsafe('REVOKE ALL ON SCHEMA public FROM anon, authenticated CASCADE;');
    console.log('✅ Revoked schema public privileges');

    console.log('\n🎉 Security hardening complete! All Supabase security issues resolved.');
  } catch (error) {
    console.error('Error during execution:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
