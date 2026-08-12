const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const pending = await p.returnExchange.findMany({
    where: { type: 'REPLACEMENT', status: 'PENDING' },
    select: { id: true, orderId: true, orderNumber: true, customerName: true, routedTo: true, createdAt: true }
  });

  console.log(`PENDING replacement cases found: ${pending.length}`);

  const toCancel = [];
  for (const c of pending) {
    const newerProgressed = await p.returnExchange.findFirst({
      where: {
        orderId: c.orderId,
        type: 'REPLACEMENT',
        status: { in: ['FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'REPLACEMENT_COMPLETED'] },
        createdAt: { gt: c.createdAt }
      },
      select: { id: true, status: true, replacementOrderId: true, createdAt: true }
    });
    if (newerProgressed) {
      toCancel.push({ case: c, newer: newerProgressed });
      console.log(`  SUPERSEDED: #${c.orderNumber} ${c.customerName} (created ${c.createdAt}) -> newer ${newerProgressed.status} (${newerProgressed.createdAt})`);
    }
  }

  console.log(`\nWill cancel ${toCancel.length} superseded case(s)...`);

  for (const { case: c, newer } of toCancel) {
    await p.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id: c.id },
        data: {
          status: 'CANCELLED',
          warehouseNotes: `Superseded — a newer replacement case (${newer.status}) already exists for this order. Auto-cancelled to keep Faisal's review queue accurate.`
        }
      });
      await tx.auditLog.create({
        data: {
          orderId: c.orderId,
          action: 'REPLACEMENT_CANCELLED_SUPERSEDED',
          details: `Duplicate replacement request #${c.orderNumber || ''} auto-cancelled because a newer replacement case (${newer.status}) was already created for the same order. Performed: ${new Date().toLocaleString()}.`,
          performedBy: '57680058-746a-4698-973f-740a04f17a26'
        }
      });
    });
    console.log(`  cancelled ${c.id}`);
  }

  const remaining = await p.returnExchange.findMany({ where: { type: 'REPLACEMENT', status: 'PENDING' }, select: { id: true, orderNumber: true, routedTo: true } });
  console.log(`\nRemaining PENDING replacement cases: ${remaining.length}`);
  remaining.forEach(r => console.log(`  #${r.orderNumber} routedTo=${r.routedTo} (${r.id})`));

  await p.$disconnect();
}

main().catch(async (e) => { console.error(e); await p.$disconnect().catch(() => {}); });
