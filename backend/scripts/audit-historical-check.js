require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../src/prisma');
const { computeBookSummary } = require('../src/controllers/pos.book.controller');

async function checkAuditIdempotency() {
  console.log('════════ AUDIT IDEMPOTENCY ════════');
  const audits = await prisma.inventoryAudit.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { items: true } }, adjustments: true },
  });
  console.log(`Total audits: ${audits.length}`);
  for (const a of audits) {
    if (a.status !== 'APPROVED') {
      console.log(`  AUD-${a.auditNumber || a.id?.slice(0,6)} status=${a.status} items=${a._count.items} adjLogs=${a.adjustments.length}`);
      continue;
    }
    const changed = (a.items || []).length > 0
      ? null
      : null;
    console.log(`  AUD-${a.auditNumber || a.id?.slice(0,6)} APPROVED adjLogs=${a.adjustments.length} approvedBy=${a.approvedBy} at=${a.approvedAt?.toISOString()}`);
    const seen = new Map();
    let dupes = 0;
    for (const ad of a.adjustments) {
      const key = `${ad.productId}|${ad.color}|${ad.size}|${ad.previousQty}|${ad.newQty}`;
      if (seen.has(key)) dupes++;
      seen.set(key, true);
    }
    console.log(`     duplicate adjustment rows (same productId/color/size/prev/new): ${dupes}`);
  }
}

async function checkHistoricalRegisters() {
  console.log('\n════════ HISTORICAL REGISTER ACCURACY (stored summary vs recompute) ════════');
  for (const outlet of ['Johar Town', 'Jail Road', 'Abbottabad']) {
    const sessions = await prisma.posBookSession.findMany({
      where: { outletName: outlet, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: 4,
    });
    for (const s of sessions) {
      let stored = null;
      try { stored = typeof s.summary === 'string' ? JSON.parse(s.summary) : (s.summary || {}); } catch { stored = {}; }
      const rec = await computeBookSummary(s);
      const st = stored.paymentSummary || {};
      const rt = rec.paymentSummary;
      const fields = {
        grandTotal: [st.grandTotal, rt.grandTotal],
        cash: [st.cash, rt.cash],
        card: [st.card, rt.card],
        online: [st.online, rt.online],
      };
      const mismatches = Object.entries(fields).filter(([, [a, b]]) => Number(a || 0).toFixed(2) !== Number(b || 0).toFixed(2));
      console.log(`  ${outlet} | closed ${s.closedAt?.toISOString()} | storedGTotal=${st.grandTotal} recompute=${rt.grandTotal} | ${mismatches.length ? 'MISMATCH ' + JSON.stringify(mismatches) : 'MATCH'}`);
    }
  }
}

async function checkDemandDeduction() {
  console.log('\n════════ DEMAND APPROVAL DEDUCTION ════════');
  const demands = await prisma.outletDemandRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  console.log(`Recent ${demands.length} demand requests:`);
  for (const d of demands) {
    const items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
    const approvedQty = items.reduce((s, i) => s + (parseInt(i.approvedQty) || 0), 0);
    const requestedQty = items.reduce((s, i) => s + (parseInt(i.requestedQty) || 0), 0);
    console.log(`  ${d.transferNumber} | ${d.outletName} | ${d.status} | requested=${requestedQty} approved=${approvedQty} | acceptedAt=${d.acceptedAt ? 'yes' : 'no'}`);
  }
  // Verify audit logs exist for approved demands with deduction details
  const approvedLogs = await prisma.auditLog.findMany({
    where: { action: { in: ['DEMAND_REQUEST_APPROVED', 'DEMAND_REQUEST_PARTIALLY_APPROVED'] } },
    orderBy: { timestamp: 'desc' },
    take: 10,
    select: { action: true, details: true, timestamp: true, performedBy: true },
  });
  console.log(`\nRecent demand approval audit logs:`);
  approvedLogs.forEach(l => console.log(`  [${(l.timestamp || new Date()).toISOString()}] ${l.action} -> ${(l.details || '').slice(0, 160)}`));
}

async function run() {
  await checkAuditIdempotency();
  await checkHistoricalRegisters();
  await checkDemandDeduction();
  await prisma.$disconnect();
}

run();
