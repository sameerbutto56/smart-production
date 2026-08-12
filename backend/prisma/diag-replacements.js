const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cases = await p.returnExchange.findMany({
    where: { type: 'REPLACEMENT' },
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true, orderNumber: true, customerName: true, status: true, routedTo: true,
      replacementOrderId: true, originalRestocked: true, replacementCompleted: true,
      createdAt: true, updatedAt: true, faisalApprovedAt: true, storeProcessedAt: true,
      handledBy: true, returnReason: true, warehouseNotes: true,
      order: { select: { currentStage: true, status: true } }
    }
  });

  console.log('=== ALL REPLACEMENT CASES (detail) ===');
  for (const c of cases) {
    const repStage = c.replacementOrderId ? 'repOrder=yes' : 'repOrder=NO';
    console.log(`#${c.orderNumber} | ${c.customerName}`);
    console.log(`   status=${c.status} routedTo=${c.routedTo} ${repStage}`);
    console.log(`   created=${c.createdAt} updated=${c.updatedAt}`);
    console.log(`   faisalApprovedAt=${c.faisalApprovedAt || '-'} storeProcessedAt=${c.storeProcessedAt || '-'}`);
    console.log(`   handledBy=${c.handledBy || '-'} restocked=${c.originalRestocked} completed=${c.replacementCompleted}`);
    console.log(`   orderStage=${c.order?.currentStage || '-'} orderStatus=${c.order?.status || '-'}`);
    console.log(`   reason=${(c.returnReason || '').slice(0, 80)}`);
    console.log('');
  }

  console.log('=== DUPLICATE active cases per order ===');
  const dupes = {};
  for (const c of cases) {
    const active = ['PENDING', 'FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'WAREHOUSE_APPROVED'].includes(c.status);
    if (!active) continue;
    const k = c.orderNumber || c.orderId;
    dupes[k] = dupes[k] || [];
    dupes[k].push(`${c.status}/${c.routedTo}`);
  }
  for (const [k, v] of Object.entries(dupes)) {
    if (v.length > 1) console.log(`  ${k}: ${v.join(' | ')}`);
  }
  if (!Object.values(dupes).some(v => v.length > 1)) console.log('  (no duplicate active cases)');

  await p.$disconnect();
}

main().catch(async (e) => { console.error(e); await p.$disconnect().catch(() => {}); });
