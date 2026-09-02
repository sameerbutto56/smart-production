/**
 * Check how long today's active DISPATCH orders have been waiting
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PKT = UTC+5, working hours 9AM-7PM
const PKT = 5 * 60 * 60 * 1000;
const WORK_START = 9, WORK_END = 19; // 9AM - 7PM
const DISPATCH_ALLOWED_HOURS = 12; // From delayUtils.js fallback

function workingMsBetween(startMs, endMs) {
  if (endMs <= startMs) return 0;
  let total = 0;
  const cursor = new Date(startMs);
  const end = new Date(endMs);
  while (cursor < end) {
    const day = cursor.getDay(); // 0=Sun,6=Sat
    if (day !== 0) { // Exclude Sundays
      const pkt = new Date(cursor.getTime() + PKT);
      const dayStart = new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate(), WORK_START - 5, 0, 0)); // 9AM PKT = 4AM UTC
      const dayEnd   = new Date(Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate(), WORK_END - 5, 0, 0));  // 7PM PKT = 2PM UTC
      const s = Math.max(cursor.getTime(), dayStart.getTime());
      const e = Math.min(end.getTime(), dayEnd.getTime());
      if (e > s) total += e - s;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }
  return total;
}

async function main() {
  const active = await prisma.order.findMany({
    where: {
      currentStage: 'DISPATCH',
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      stages: {
        where: { stageName: 'DISPATCH' },
        select: { status: true, createdAt: true, startedAt: true }
      }
    }
  });

  const now = Date.now();
  const allowedMs = DISPATCH_ALLOWED_HOURS * 3600 * 1000;

  console.log(`\n${active.length} active DISPATCH orders — working-hours delay check (${DISPATCH_ALLOWED_HOURS}h limit):\n`);

  let onTime = 0, delayed = 0;
  active.forEach(o => {
    const stage = o.stages[0];
    if (!stage) return;
    const enteredAt = new Date(stage.createdAt).getTime();
    const workingMs = workingMsBetween(enteredAt, now);
    const workingHours = (workingMs / 3600000).toFixed(1);
    const isDelayed = workingMs > allowedMs;
    if (isDelayed) delayed++; else onTime++;
    console.log(`  #${o.orderNumber} | entered=${new Date(stage.createdAt).toISOString()} | stageStatus=${stage.status} | workingHrs=${workingHours} | ${isDelayed ? '🔴 DELAYED' : '🟢 ON TIME'}`);
  });

  console.log(`\nSummary: ${onTime} on time, ${delayed} delayed`);
  console.log(`(Delay threshold: ${DISPATCH_ALLOWED_HOURS} working hours)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
