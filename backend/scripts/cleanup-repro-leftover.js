// Cleanup script — removes repro leftovers from backend/scripts/repro-replacement-50335.js run 2.
// Run 1 cleaned fully (leftover 0). Run 2 created case c2264029-4017-4a82-9aa3-696dcdea835e +
// audit logs on the original order 7cc5626d-44da-4724-a84a-d8e5cba58ba9, but its cleanup FATAL'd
// after deleting the REP order (re-fetched a deleted row). This removes exactly those leftovers.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CASE_ID = 'c2264029-4017-4a82-9aa3-696dcdea835e';
const ORIGINAL_ID = '7cc5626d-44da-4724-a84a-d8e5cba58ba9';

async function main() {
  const existing = await prisma.returnExchange.findUnique({ where: { id: CASE_ID }, select: { id: true, status: true, routedTo: true, replacementOrderId: true } });
  if (existing) {
    console.log('Found orphan case:', existing.status, existing.routedTo, 'replacementOrderId=', existing.replacementOrderId);
    if (existing.replacementOrderId) {
      const rep = await prisma.order.findUnique({ where: { id: existing.replacementOrderId }, select: { id: true, orderNumber: true } });
      console.log('Replacement order still present?', rep ? rep.orderNumber : 'no (already deleted)');
    }
    await prisma.returnExchange.delete({ where: { id: CASE_ID } });
    console.log('Orphan case deleted');
  } else {
    console.log('Case not found — already clean');
  }

  const audits = await prisma.auditLog.findMany({
    where: {
      orderId: ORIGINAL_ID,
      action: { in: ['REPLACEMENT_INITIATED', 'REPLACEMENT_ORDER_CREATED'] }
    },
    select: { id: true, action: true, details: true }
  });
  for (const a of audits) {
    if (String(a.details || '').includes('Repro test - will be deleted') || String(a.details || '').includes('REP-50335')) {
      await prisma.auditLog.delete({ where: { id: a.id } });
      console.log('Deleted repro audit', a.action);
    } else {
      console.log('KEEP (not repro)', a.action, '-', a.details);
    }
  }

  const leftover = await prisma.returnExchange.count({ where: { orderId: ORIGINAL_ID } });
  console.log('Remaining returnExchange rows for original:', leftover);
  console.log('CLEANUP DONE');
}

main().catch(e => { console.error('CLEANUP FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
