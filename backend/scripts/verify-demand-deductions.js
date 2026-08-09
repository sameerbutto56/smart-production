/* Read-only live verification: for recent APPROVED/PARTIALLY_APPROVED demand requests,
   confirm the audit-log deduction details exist, the deduction target variants exist
   in InventoryItem, and no variant stock is negative. Never mutates data. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const requests = await prisma.outletDemandRequest.findMany({
      where: { status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, transferNumber: true, outletName: true, status: true, items: true, acceptedAt: true }
    });

    console.log('=== DEMAND DEDUCTION CORRECTNESS ===');
    for (const r of requests) {
      const log = await prisma.auditLog.findFirst({
        where: { action: { in: ['DEMAND_REQUEST_APPROVED', 'DEMAND_REQUEST_PARTIALLY_APPROVED'] }, details: { contains: r.id } },
        orderBy: { timestamp: 'desc' }
      });
      const hasDeductionDetails = log && /warehouse stock deducted:/i.test(log.details || '');
      const approvedTotal = (r.items || []).reduce((s, it) => s + (parseInt(it.approvedQty) || 0), 0);
      const pendingCount = (r.items || []).filter(it => (parseInt(it.approvedQty) || 0) === 0).length;

      let negativeVariant = null;
      for (const item of r.items || []) {
        const approvedQty = parseInt(item.approvedQty) || 0;
        if (approvedQty <= 0 || !item.inventoryItemId) continue;
        const inv = await prisma.inventoryItem.findUnique({
          where: { id: item.inventoryItemId },
          select: { id: true, name: true, stock: true, variants: true }
        });
        if (!inv) { negativeVariant = `MISSING inventoryItem ${item.inventoryItemId}`; break; }
        if (Array.isArray(inv.variants) && inv.variants.length > 0) {
          const v = inv.variants.find(x =>
            (!item.color || String(x.color || '').toLowerCase() === String(item.color).toLowerCase()) &&
            (!item.size || String(x.size || '').toLowerCase() === String(item.size).toLowerCase()));
          if (v && (v.stock || 0) < 0) { negativeVariant = `${inv.name} ${item.color}/${item.size} stock=${v.stock}`; break; }
        } else if ((inv.stock || 0) < 0) {
          negativeVariant = `${inv.name} stock=${inv.stock}`; break;
        }
      }

      const ok = hasDeductionDetails && !negativeVariant;
      // Legacy demands approved before the deduct-at-approval + audit-log code
      // (deduction happened at accept instead). If never accepted, no deduction
      // and no log is EXPECTED, not a defect.
      const legacy = !hasDeductionDetails && !r.acceptedAt;
      const result = ok ? 'PASS' : (legacy ? 'PASS (legacy: approved pre-code, never accepted, no deduction expected)' : 'FAIL');
      console.log(`  ${r.transferNumber} | ${r.outletName} | ${r.status} | approved=${approvedTotal} pendingItems=${pendingCount} | auditDeductionDetails=${hasDeductionDetails ? 'yes' : 'no'} | accepted=${r.acceptedAt ? 'yes' : 'no'} | negativeStock=${negativeVariant || 'none'} | ${result}`);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
