/**
 * Inspect Verification and Return Verification stage state & delay calculation
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const WORK_START = 9, WORK_END = 19;

function computeWorkingMs(startMs, endMs) {
  if (!startMs || !endMs || endMs <= startMs) return 0;
  let total = 0;
  let cursor = new Date(startMs);
  const end = new Date(endMs);

  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0) { // Exclude Sunday
      const pkt = new Date(cursor.getTime() + PKT_OFFSET_MS);
      const dayStart = new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate(), WORK_START - 5, 0, 0));
      const dayEnd = new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate(), WORK_END - 5, 0, 0));
      const s = Math.max(cursor.getTime(), dayStart.getTime());
      const e = Math.min(end.getTime(), dayEnd.getTime());
      if (e > s) total += (e - s);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }
  return total;
}

const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Outlet',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  ORDER_ENTRY: 'Inventory Verification',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return Verification',
  DELIVERED: 'Completed',
};

const FALLBACK_STAGE_HOURS = {
  ORDER_ENTRY: 4,
  VERIFICATION: 4,
  RETURN_VERIFICATION: 4,
  STORE: 24,
  STORE_RECEIVE: 12,
  WORKERS: 24,
  PRODUCTION_ACCEPTANCE: 4,
  PRODUCTION: 48,
  LOGO_DESIGN: 24,
  DISPATCH: 12,
  IN_DISPATCH: 24,
  OUTLET_RECEIVE: 48,
  ENAMELS_DELIVERY: 24,
  OUT_FOR_DELIVERY: 12,
};

function getEffectiveStage(order) {
  if (order.verificationReturnedAt && !order.verifiedAt && order.currentStage === 'ORDER_ENTRY') return 'RETURN_VERIFICATION';
  if (order.goForVerification && !order.verifiedAt && !order.verificationReturnedAt) return 'VERIFICATION';
  return order.currentStage;
}

function getDelayInfo(order) {
  if (!order) return null;
  const status = (order.status || '').toUpperCase();
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
  const allowedHours = FALLBACK_STAGE_HOURS[effectiveStage] || 24;
  const allowedMs = allowedHours * 3600 * 1000;

  const phaseWorkingMs = computeWorkingMs(enteredMs, now);

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';

  if (phaseWorkingMs < allowedMs) return null;

  const delayDuration = Math.max(0, phaseWorkingMs - allowedMs);

  return {
    orderId: order.id,
    stage: effectiveStage,
    department,
    phaseEnteredAt: enteredMs,
    phaseWorkingMs,
    allowedHours,
    delayDuration,
  };
}

const targetNumbers = ['51157', '51175', '51202', '51515', '51588', '51590', '51156', '50846', '51417', '51328'];

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      orderNumber: { in: targetNumbers }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      goForVerification: true,
      verifiedAt: true,
      verificationReturnedAt: true,
      stages: {
        select: { id: true, stageName: true, status: true, deadlineAt: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  console.log(`\nFound ${orders.length} target orders out of ${targetNumbers.length}\n`);

  orders.forEach(o => {
    const delay = getDelayInfo(o);
    const effStage = getEffectiveStage(o);
    console.log(`--------------------------------------------------`);
    console.log(`Order #${o.orderNumber} | status=${o.status} | currentStage=${o.currentStage} | effectiveStage=${effStage}`);
    console.log(`  goForVerification=${o.goForVerification} | verifiedAt=${o.verifiedAt} | verificationReturnedAt=${o.verificationReturnedAt}`);
    console.log(`  stages in DB:`, o.stages.map(s => `${s.stageName}(${s.status})`).join(', '));
    console.log(`  Computed Delay Info:`, delay ? {
      stage: delay.stage,
      department: delay.department,
      delayDuration: (delay.delayDuration / 3600000).toFixed(1) + 'h',
      allowedHours: delay.allowedHours,
      phaseEnteredAt: new Date(delay.phaseEnteredAt).toISOString()
    } : '🟢 ON TIME / NO DELAY DETECTED');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
