// One-off data repair for order 50335: currently stuck at LOGO_DESIGN (PENDING) after the
// Store Keeper manually routed STORE -> LOGO_DESIGN (audit MANUAL_ROUTE 09:50:13). The order is
// READY_LOGO / INTERNAL with verification note "no need to customization" — it has no logo work.
// Per request, re-route to PRODUCTION_ACCEPTANCE (Production In) with exactly one active task.
//
// Mirrors manualRouteOrder (order.controller.js ~2861-3004): completes active LOGO_DESIGN rows,
// creates a single PRODUCTION_ACCEPTANCE PENDING row with deadline, updates currentStage/status,
// writes routingHistory + MANUAL_ROUTE audit, resets recipient seen tasks. All inside one $transaction.
// Idempotent: safe to re-run (skips when the order is already at PRODUCTION_ACCEPTANCE).
const prisma = require('../src/prisma');
const { createAuditLog } = require('../src/controllers/order-helpers');

const ORDER_QUERY = '50335';
const DEST = 'PRODUCTION_ACCEPTANCE';

function calculateDeadline(fromDate, hours) {
  const d = new Date(fromDate);
  let added = 0;
  while (added < hours) {
    d.setUTCHours(d.getUTCHours() + 1);
    if (d.getUTCDay() !== 6) added += 1; // skip Sundays
  }
  return d;
}

async function getStageDurations(priority = 'NORMAL') {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
  let config = {
    stageDurations: { STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48, STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
    slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
  };
  if (setting) {
    try { config = { ...config, ...JSON.parse(setting.value) }; } catch (e) { console.error('DEADLINE_CONFIG parse error:', e); }
  }
  const mul = config.slaMultipliers?.[priority] ?? 1;
  const durations = {};
  for (const [stage, hours] of Object.entries(config.stageDurations || {})) {
    durations[stage] = Math.round((hours * mul) * 100) / 100;
  }
  return durations;
}

const getRolesForStage = (stageName) => {
  const map = {
    'PRODUCTION_ACCEPTANCE': ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'],
    'PRODUCTION': ['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT']
  };
  return map[stageName] || ['ADMIN', 'FAISAL'];
};

async function main() {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { contains: ORDER_QUERY, mode: 'insensitive' } },
        { invoiceNumber: { contains: ORDER_QUERY, mode: 'insensitive' } }
      ]
    },
    include: { stages: { orderBy: { createdAt: 'asc' } } }
  });
  if (!order) { console.log('ORDER NOT FOUND'); return; }

  console.log(`Order: #${order.orderNumber} | currentStage=${order.currentStage} | status=${order.status}`);

  if (order.currentStage === DEST) {
    console.log('ALREADY AT PRODUCTION_ACCEPTANCE — nothing to do. Skipping.');
    return;
  }

  // Resolve acting user: SUPER_ADMIN (the admin running this repair) — mirrors MANUAL_ROUTE byline.
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true, name: true } });
  if (!admin) { console.log('NO SUPER_ADMIN USER FOUND'); return; }
  console.log(`Acting user: ${admin.name} (${admin.id})`);

  const currentStage = order.stages.find(s =>
    ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );
  console.log(`Active stage to close: ${currentStage?.stageName || 'NONE'} (${currentStage?.status || ''})`);

  const durations = await getStageDurations(order.priority || 'NORMAL');

  const result = await prisma.$transaction(async (tx) => {
    // 1. Close all active LOGO_DESIGN rows (same updateMany pattern as manualRouteOrder).
    const closed = await tx.orderStage.updateMany({
      where: {
        orderId: order.id,
        stageName: currentStage?.stageName || 'UNKNOWN',
        status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] }
      },
      data: { status: 'COMPLETED', completedAt: new Date(), rejectionReason: `Routed to ${DEST} by ${admin.name} (repair)` }
    });

    // 2. Create destination stage only if no active row exists (idempotent duplicate guard).
    const existingDestStage = await tx.orderStage.findFirst({
      where: { orderId: order.id, stageName: DEST, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'] } }
    });
    if (!existingDestStage) {
      const deadline = calculateDeadline(new Date(), durations[DEST] || 4);
      await tx.orderStage.create({
        data: { orderId: order.id, stageName: DEST, status: 'PENDING', deadlineAt: deadline }
      });
    }

    // 3. Update order current stage.
    await tx.order.update({
      where: { id: order.id },
      data: { currentStage: DEST, status: 'PENDING' }
    });

    // 4. Routing history (mirrors manualRouteOrder).
    const recipientUsers = await tx.user.findMany({
      where: { role: { in: getRolesForStage(DEST) } },
      select: { id: true }
    });
    await tx.routingHistory.create({
      data: {
        orderId: order.id,
        sentByUserId: admin.id,
        sentToStage: DEST,
        sentToUserIds: JSON.stringify(recipientUsers.map(u => u.id)),
        previousStage: currentStage?.stageName || 'UNKNOWN',
        newStage: DEST,
        remarks: `Repair: corrected routing from ${currentStage?.stageName || 'UNKNOWN'} to ${DEST} (READY_LOGO order with no customization)`,
        createdAt: new Date()
      }
    });

    // 5. Reset seen status for all recipients so the order lands in their unseen queue.
    await tx.seenTask.deleteMany({
      where: { userId: { in: recipientUsers.map(u => u.id) }, orderId: order.id, stageName: DEST }
    });

    return { closed: closed.count, recipients: recipientUsers.length };
  }, { timeout: 30000 });

  // Audit log after the transaction (mirrors manualRouteOrder).
  await createAuditLog(order.id, 'MANUAL_ROUTE', `Repair: routed from ${currentStage?.stageName || 'UNKNOWN'} to ${DEST} by ${admin.name}. Remarks: corrected routing — READY_LOGO order with no customization.`, admin.id);

  console.log(`DONE. Closed ${result.closed} active stage row(s); ${result.recipients} recipient user(s) notified; order now at ${DEST}.`);
}

main().finally(() => prisma.$disconnect());
