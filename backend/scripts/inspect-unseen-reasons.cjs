const prisma = require('../src/prisma');

async function inspectUnseenReasons() {
  const startOfDay = new Date("2026-09-01T19:00:00.000Z"); // PKT 2026-09-02 00:00:00
  const endOfDay = new Date("2026-09-02T18:59:59.999Z");   // PKT 2026-09-02 23:59:59

  const routings = await prisma.routingHistory.findMany({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
      newStage: { in: ['DISPATCH', 'IN_DISPATCH'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  const orderIds = [...new Set(routings.map(r => r.orderId))];
  
  const baseSelect = {
    id: true, orderNumber: true, customerName: true, customerPhone: true,
    address: true, city: true, source: true, outletName: true,
    currentStage: true, status: true, dispatchStatus: true,
    deliveryType: true, deliveryMethod: true, priority: true,
    trackingNumber: true, courierDetails: true,
    totalPrice: true, paymentStatus: true, advanceAmount: true,
    type: true, productDetails: true, customization: true, sizeData: true,
    instructionNotes: true, dispatchOfficer: true, forwardedBy: true,
    deliveredAt: true, returnedAt: true, refundStatus: true,
    createdAt: true, updatedAt: true,
    stages: {
      orderBy: { createdAt: 'asc' },
      select: { id: true, stageName: true, status: true, deadlineAt: true, startedAt: true, rejectionReason: true, completedAt: true, createdAt: true }
    }
  };

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: baseSelect
  });

  const workedAssignmentIds = new Set();
  const assignments = await prisma.deliveryAssignment.findMany({
    where: { orderId: { in: orders.map(o => o.id) } },
    select: { orderId: true }
  });
  for (const a of assignments) workedAssignmentIds.add(a.orderId);

  console.log(`Analyzing ${orders.length} orders routed today:`);

  for (const order of orders) {
    const dispatchStages = (order.stages || []).filter(s => s.stageName === 'DISPATCH');
    const latestDispatch = dispatchStages[dispatchStages.length - 1];
    
    // Check pending dispatch stage vs completed dispatch stage
    const pendingDispatchStage = (order.stages || []).find(s => s.stageName === 'DISPATCH' && (s.status === 'PENDING' || s.status === 'IN_PROGRESS'));

    const dispatchCompleted = !!latestDispatch && latestDispatch.status === 'COMPLETED';
    const dispatchStarted =
      !!latestDispatch &&
      ['IN_PROGRESS', 'WAITING_APPROVAL'].includes(latestDispatch.status);
    const hasWorkSignal =
      dispatchStarted ||
      dispatchCompleted ||
      workedAssignmentIds.has(order.id) ||
      !!order.trackingNumber ||
      !!order.courierDetails ||
      !!order.deliveredAt ||
      !!order.returnedAt ||
      (order.dispatchStatus && order.dispatchStatus !== 'PENDING' && order.dispatchStatus !== 'OUT_FOR_DELIVERY');

    console.log(`Order #${order.orderNumber} (${order.id.slice(0,8)}):`);
    console.log(`  currentStage=${order.currentStage}, status=${order.status}, dispatchOfficer=${order.dispatchOfficer}`);
    console.log(`  dispatchStatus=${order.dispatchStatus}, trackingNumber=${order.trackingNumber}, courierDetails=${order.courierDetails}`);
    console.log(`  workedAssignment=${workedAssignmentIds.has(order.id)}`);
    console.log(`  dispatchStages count=${dispatchStages.length}`);
    dispatchStages.forEach((s, idx) => {
      console.log(`    Stage [${idx}]: id=${s.id.slice(0,8)} status=${s.status} createdAt=${s.createdAt.toISOString()} rejectionReason="${s.rejectionReason}"`);
    });
    console.log(`  -> dispatchCompleted=${dispatchCompleted}, hasWorkSignal=${hasWorkSignal}`);
    console.log(`  -> pendingDispatchStage exists=${!!pendingDispatchStage}`);
    console.log("------------------------------------------------------------------");
  }
}

inspectUnseenReasons().catch(console.error).finally(() => prisma.$disconnect());
