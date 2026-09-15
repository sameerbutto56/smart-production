const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    // Search for orders containing 47916 or 47929 in their orderNumber
    console.log('=== Searching for orders containing 47916 ===');
    const o1 = await p.order.findMany({
      where: { orderNumber: { contains: '47916' } },
      select: { id: true, orderNumber: true, status: true, currentStage: true, source: true, outletName: true }
    });
    console.log(JSON.stringify(o1, null, 2));

    console.log('\n=== Searching for orders containing 47929 ===');
    const o2 = await p.order.findMany({
      where: { orderNumber: { contains: '47929' } },
      select: { id: true, orderNumber: true, status: true, currentStage: true, source: true, outletName: true }
    });
    console.log(JSON.stringify(o2, null, 2));

    // Also check if they are invoice numbers
    console.log('\n=== Searching by invoiceNumber 47916 & 47929 ===');
    const inv = await p.order.findMany({
      where: { invoiceNumber: { in: ['47916', '47929'] } },
      select: { id: true, orderNumber: true, invoiceNumber: true, status: true, currentStage: true, source: true }
    });
    console.log(JSON.stringify(inv, null, 2));

    // REP-51239 deep dive: check why it's stuck at STORE
    // The order's currentStage is STORE but the ReturnExchange is REPLACEMENT_COMPLETED
    // Let's check what the Store profile query looks like
    console.log('\n=== REP-51239 store visibility analysis ===');
    const repOrder = await p.order.findFirst({
      where: { orderNumber: 'REP-51239' },
      select: {
        id: true, orderNumber: true, status: true, currentStage: true,
        source: true, outletName: true, storeRequested: true, storeAcceptedAt: true,
        orderDestination: true, type: true,
        stages: {
          select: { stageName: true, status: true, startedAt: true, completedAt: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    console.log(JSON.stringify(repOrder, null, 2));
    
    // Check: Is the STORE stage PENDING or IN_PROGRESS?
    if (repOrder) {
      const storeStage = repOrder.stages.filter(s => s.stageName === 'STORE');
      console.log('\n=== STORE stages for REP-51239 ===');
      console.log(JSON.stringify(storeStage, null, 2));
    }

  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
})();
