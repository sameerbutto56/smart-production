/* Read-only verification of every Admin Outlet Detailed section query against live DB.
   Mirrors outletDetailed.controller.js + pos.book getBookHistory + bankDeposit getDepositsByOutlet. */
const prisma = require('../src/prisma');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withRetry = async (fn, tries = 5, delay = 3000) => {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) {
      if (i === tries) throw e;
      await sleep(delay);
    }
  }
};

const now = new Date();
const startAll = new Date(0);

async function verify(outlet) {
  const dateWhereAll = { gte: startAll, lte: now };
  const q = (label, fn) => withRetry(async () => {
    const r = await fn();
    return [label, 'OK', Array.isArray(r) ? r.length : (r._count ? r._count : JSON.stringify(r).slice(0, 60))];
  }).catch(e => [label, 'ERR', e.message.slice(0, 80)]);

  const results = await Promise.all([
    q('salesAgg', () => prisma.posSale.aggregate({ where: { outletName: outlet, createdAt: dateWhereAll, faisalTake: { not: true } }, _count: true })),
    q('salesAll', () => prisma.posSale.findMany({ where: { outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('returns', () => prisma.posReturn.findMany({ where: { outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('balancePayments', () => prisma.posBalancePayment.findMany({ where: { posSale: { outletName: outlet }, paidAt: dateWhereAll }, select: { id: true } })),
    q('orders(OUTLET)', () => prisma.order.findMany({ where: { source: 'OUTLET', outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('clients', () => prisma.client.findMany({ where: { outletName: outlet, isActive: true }, select: { id: true } })),
    q('transfers', () => prisma.outletTransfer.findMany({ where: { OR: [{ fromOutlet: outlet }, { toOutlet: outlet }], createdAt: dateWhereAll }, include: { items: true } })),
    q('stockRequests', () => prisma.stockRequest.findMany({ where: { outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('demandRequests', () => prisma.outletDemandRequest.findMany({ where: { outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('alterations', () => prisma.alteration.findMany({ where: { sourceOutlet: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('journal', () => prisma.journalEntry.findMany({ where: { outletName: outlet, createdAt: dateWhereAll }, select: { id: true } })),
    q('inventory', () => prisma.outletInventory.findMany({ where: { outletName: outlet }, select: { id: true } })),
    q('bestSelling', () => prisma.posSaleItem.findMany({ where: { sale: { outletName: outlet, createdAt: dateWhereAll, refundedAt: null } }, select: { id: true } })),
    q('faisalTakes', () => prisma.posSale.findMany({ where: { outletName: outlet, faisalTake: true, createdAt: dateWhereAll }, select: { id: true } })),
    q('bookHistory(CLOSED)', () => prisma.posBookSession.findMany({ where: { outletName: outlet, status: 'CLOSED' }, orderBy: { closedAt: 'desc' } })),
    q('bookSessions(OPEN)', () => prisma.posBookSession.findMany({ where: { outletName: outlet, status: 'OPEN' }, select: { id: true } })),
    q('bankDeposits', () => prisma.bankDeposit.findMany({ where: { outletName: outlet }, orderBy: { createdAt: 'desc' } })),
    q('demandByStatus', () => prisma.outletDemandRequest.groupBy({ by: ['status'], where: { outletName: outlet }, _count: { _all: true } })),
  ]);

  console.log(`\n===== ${outlet} =====`);
  results.forEach(([label, ok, count]) => {
    let extra = '';
    if (label === 'demandByStatus') {
      extra = ' -> ' + JSON.stringify(count);
      count = '-';
    }
    console.log(`  ${ok === 'OK' ? 'OK  ' : 'ERR '} ${label.padEnd(24)} ${count}${extra}`);
  });
  return results;
}

(async () => {
  const outlets = ['Johar Town', 'Jail Road', 'Abbottabad'];
  for (const o of outlets) {
    await verify(o).catch(e => console.log(`FAILED ${o}: ${e.message}`));
  }
  await prisma.$disconnect();
})();
