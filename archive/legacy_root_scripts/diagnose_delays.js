const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Test updated delay logic
const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Dispatch',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  ORDER_ENTRY: 'Inventory Verification',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return Verification',
  DELIVERED: 'Completed',
};

const getEffectiveStage = (order) => {
  if (order?.verificationReturnedAt && !order?.verifiedAt && order?.currentStage === 'ORDER_ENTRY') return 'RETURN_VERIFICATION';
  if (order?.goForVerification && !order?.verifiedAt && !order?.verificationReturnedAt) return 'VERIFICATION';
  return order?.currentStage;
};

const getDelayInfoTest = (order, delayConfig = null) => {
  if (!order) return null;
  const status = String(order.status || '').toUpperCase();
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(status)) return null;

  const effectiveStage = getEffectiveStage(order);
  if (!effectiveStage || ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(effectiveStage)) return null;

  const stages = Array.isArray(order.stages) ? order.stages : [];
  const active = stages.find(
    (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );

  let phaseEnteredAt;
  if (!active && effectiveStage === 'VERIFICATION') {
    const entryStage = stages.find((s) => s.stageName === 'ORDER_ENTRY');
    phaseEnteredAt = (entryStage && (entryStage.completedAt || entryStage.updatedAt || entryStage.createdAt)) || order.createdAt;
  } else if (!active) {
    phaseEnteredAt = order.updatedAt || order.createdAt;
  } else {
    phaseEnteredAt = active.createdAt || order.createdAt;
  }
  if (!phaseEnteredAt) return null;

  const now = Date.now();
  const enteredMs = new Date(phaseEnteredAt).getTime();
  const allowedHours = 24; // baseline
  const allowedMs = allowedHours * 3600 * 1000;

  // Simple working hours calculation
  const elapsedMs = Math.max(0, now - enteredMs);
  if (elapsedMs < allowedMs) return null;

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';

  return {
    orderId: order.id,
    stage: effectiveStage,
    department,
    status,
    orderNumber: order.orderNumber
  };
};

async function main() {
  const activeOrders = await prisma.order.findMany({
    where: { status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] } },
    include: { stages: { orderBy: { createdAt: 'desc' } } }
  });

  const delayed = [];
  for (const o of activeOrders) {
    const d = getDelayInfoTest(o);
    if (d) delayed.push(d);
  }

  console.log(`Total Active Non-Returned Orders: ${activeOrders.length}`);
  console.log(`Total Delayed with RETURNED excluded: ${delayed.length}`);

  const byDept = {};
  for (const d of delayed) {
    byDept[d.department] = (byDept[d.department] || 0) + 1;
  }
  console.log('Delayed by Department:', byDept);

  const byStage = {};
  for (const d of delayed) {
    byStage[d.stage] = (byStage[d.stage] || 0) + 1;
  }
  console.log('Delayed by Stage:', byStage);
}

main().catch(console.error).finally(() => prisma.$disconnect());
