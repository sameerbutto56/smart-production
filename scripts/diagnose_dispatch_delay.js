/**
 * Diagnose: Why do 56 orders show as delayed in Dispatch
 * when there are only 19 active DISPATCH orders (all from today)?
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const now = new Date();

async function main() {
  // 1. What does the delay API actually query?
  // Check the delay logic — find all orders where delay is attributed to DISPATCH
  const allActive = await prisma.order.findMany({
    where: {
      status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] }
    },
    select: {
      id: true,
      orderNumber: true,
      currentStage: true,
      status: true,
      createdAt: true,
      stages: {
        select: { id: true, stageName: true, status: true, deadlineAt: true, startedAt: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  // Find orders with an active DISPATCH stage that is past deadline
  const dispatchDelayed = [];

  for (const order of allActive) {
    const dispatchStage = order.stages.find(s => 
      s.stageName === 'DISPATCH' && 
      s.status !== 'COMPLETED'
    );
    
    if (dispatchStage) {
      const deadline = dispatchStage.deadlineAt;
      const started = dispatchStage.startedAt || dispatchStage.createdAt;
      const isOverdue = deadline && new Date(deadline) < now;
      
      dispatchDelayed.push({
        orderNumber: order.orderNumber,
        currentStage: order.currentStage,
        dispatchStageStatus: dispatchStage.status,
        deadlineAt: deadline ? new Date(deadline).toISOString() : 'none',
        startedAt: started ? new Date(started).toISOString() : 'none',
        isOverdue,
        hoursOld: started ? Math.floor((now - new Date(started)) / 3600000) : 0
      });
    }
  }

  console.log(`\nOrders with active DISPATCH stage (not COMPLETED): ${dispatchDelayed.length}`);
  console.log(`Of those, overdue (past deadlineAt): ${dispatchDelayed.filter(o => o.isOverdue).length}`);
  
  console.log('\nBreakdown by currentStage of orders with active DISPATCH stage:');
  const byStage = {};
  dispatchDelayed.forEach(o => {
    byStage[o.currentStage] = (byStage[o.currentStage] || 0) + 1;
  });
  Object.entries(byStage).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\nTop overdue ones (>24h in dispatch stage):');
  dispatchDelayed
    .filter(o => o.hoursOld > 24)
    .slice(0, 20)
    .forEach(o => console.log(`  #${o.orderNumber} | currentStage=${o.currentStage} | dispatchStatus=${o.dispatchStageStatus} | hours=${o.hoursOld} | deadline=${o.deadlineAt}`));

  // Also check: what stages are in ACTIVE DISPATCH stage but not currentStage=DISPATCH
  const wrongStage = dispatchDelayed.filter(o => o.currentStage !== 'DISPATCH');
  console.log(`\nOrders with DISPATCH stage active but currentStage ≠ DISPATCH: ${wrongStage.length}`);
  wrongStage.slice(0, 15).forEach(o => 
    console.log(`  #${o.orderNumber} | currentStage=${o.currentStage} | dispatchStatus=${o.dispatchStageStatus}`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
