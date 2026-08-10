const prisma = require('../src/prisma');

const withRetry = async (fn, label) => {
  for (let i = 1; i <= 5; i++) {
    try { return await fn(); }
    catch (e) {
      if (e && String(e.message).includes('6543')) { await new Promise(r => setTimeout(r, 3000)); continue; }
      throw e;
    }
  }
  throw new Error('retry exhausted: ' + label);
};

(async () => {
  const outlets = ['Johar Town', 'Jail Road', 'Abbottabad'];
  for (const outlet of outlets) {
    const q = {
      transfers: prisma.outletTransfer.count({ where: { OR: [{ fromOutlet: outlet }, { toOutlet: outlet }] } }),
      requests: prisma.stockRequest.count({ where: { outletName: outlet } }),
      alterations: prisma.alteration.count({ where: { sourceOutlet: outlet } }),
      journal: prisma.journalEntry.count({ where: { outletName: outlet } }),
      bankDeposits: prisma.bankDeposit.count({ where: { outletName: outlet } }),
      clients: prisma.client.count({ where: { outletName: outlet } }),
      posSales: prisma.posSale.count({ where: { outletName: outlet } }),
      orders: prisma.order.count({ where: { source: 'OUTLET', outletName: outlet } }),
      registers: prisma.posBookSession.count({ where: { outletName: outlet } }),
    };
    const r = await withRetry(() => Promise.all(Object.entries(q).map(async ([k, p]) => [k, await p])), outlet);
    const out = Object.fromEntries(r);
    console.log(outlet, JSON.stringify(out));
  }
  // Raw distinct outletName values to catch casing mismatches
  console.log('transfer outlets:', JSON.stringify(await withRetry(() => prisma.outletTransfer.findMany({ distinct: ['fromOutlet'], select: { fromOutlet: true } }), 'tf-from')));
  console.log('transfer to:', JSON.stringify(await withRetry(() => prisma.outletTransfer.findMany({ distinct: ['toOutlet'], select: { toOutlet: true } }), 'tf-to')));
  console.log('request outlets:', JSON.stringify(await withRetry(() => prisma.stockRequest.findMany({ distinct: ['outletName'], select: { outletName: true } }), 'sr')));
  console.log('alteration outlets:', JSON.stringify(await withRetry(() => prisma.alteration.findMany({ distinct: ['sourceOutlet'], select: { sourceOutlet: true } }), 'alt')));
  console.log('journal outlets:', JSON.stringify(await withRetry(() => prisma.journalEntry.findMany({ distinct: ['outletName'], select: { outletName: true } }), 'jr')));
  console.log('bankDeposit outlets:', JSON.stringify(await withRetry(() => prisma.bankDeposit.findMany({ distinct: ['outletName'], select: { outletName: true } }), 'bd')));
  console.log('client outlets:', JSON.stringify(await withRetry(() => prisma.client.findMany({ distinct: ['outletName'], select: { outletName: true } }), 'cl')));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
