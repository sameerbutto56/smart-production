// Shared helper: find the inventory audit that is awaiting an Admin decision
// (status = SUBMITTED) for a given scope. The branch's POS stays locked while
// such an audit exists — the audit is a read-only snapshot, so no new sales may
// be processed until reconciliation is reviewed.
const getPendingAudit = async (prisma, { type = 'OUTLET', outletName } = {}) => {
  const where = { status: 'SUBMITTED' };
  if (type === 'WAREHOUSE') {
    where.type = 'WAREHOUSE';
  } else {
    where.type = 'OUTLET';
    if (outletName) where.outletName = outletName;
  }
  return prisma.inventoryAudit.findFirst({
    where,
    orderBy: { createdAt: 'desc' }
  });
};

module.exports = { getPendingAudit };
