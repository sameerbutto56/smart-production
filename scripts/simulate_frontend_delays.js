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
  OUTLET_RECEIVE: 'Dispatch',
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

async function main() {
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      stages: {
        select: { id: true, stageName: true, status: true, deadlineAt: true, startedAt: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  const now = Date.now();
  const departmentDelays = {};
  const stageDelays = {};
  const delayedOrders = [];

  for (const order of activeOrders) {
    const effectiveStage = order.currentStage;
    if (!effectiveStage || ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(effectiveStage)) continue;

    const activeStageRecord = order.stages.find(
      (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
    );

    const phaseEnteredAt = activeStageRecord?.createdAt || order.updatedAt || order.createdAt;
    if (!phaseEnteredAt) continue;

    const enteredMs = new Date(phaseEnteredAt).getTime();
    const allowedHours = FALLBACK_STAGE_HOURS[effectiveStage] || 24;
    const allowedMs = allowedHours * 3600 * 1000;
    const phaseWorkingMs = computeWorkingMs(enteredMs, now);

    if (phaseWorkingMs >= allowedMs) {
      const dept = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
      departmentDelays[dept] = (departmentDelays[dept] || 0) + 1;
      stageDelays[effectiveStage] = (stageDelays[effectiveStage] || 0) + 1;
      delayedOrders.push({
        orderNumber: order.orderNumber,
        stage: effectiveStage,
        department: dept,
        enteredAt: phaseEnteredAt,
        workingHours: (phaseWorkingMs / 3600000).toFixed(1),
        allowedHours
      });
    }
  }

  console.log('\n--- DELAYED BY DEPARTMENT ---');
  console.log(departmentDelays);

  console.log('\n--- DELAYED BY STAGE ---');
  console.log(stageDelays);

  console.log('\n--- DELAYED ORDERS LIST ---');
  console.table(delayedOrders);
}

main().catch(console.error).finally(() => prisma.$disconnect());
