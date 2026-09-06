const prisma = require('../src/prisma');
const { acceptReturn, sendReturnToStore, getIncomingReturns } = require('../src/controllers/returnExchange.controller');

const INVENTORY_USER = { id: '6ebb0688-835b-4385-855f-f49e3a57bda1', name: 'Customer Query' };
const RIDER = { id: '00000000-0000-4000-8000-000000000001', name: 'Test Rider' };

function makeRes(label) {
  const state = { statusCode: 200, body: null };
  const res = {
    json: (data) => { state.body = data; console.log(`[${label}] JSON:`, JSON.stringify(data, null, 2)); return res; },
    status: (code) => { state.statusCode = code; console.log(`[${label}] STATUS:`, code); return res; }
  };
  return { res, state };
}

function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exitCode = 1; }
  else console.log(`PASS: ${msg}`);
}

async function run() {
  console.log("=== RETURN FLOW: delivery-return → accept → send-to-store ===");

  // 1. Reuse an existing numeric-ID order, else create a disposable one
  let order = await prisma.order.findFirst({
    where: { orderNumber: { not: null } },
    orderBy: { createdAt: 'desc' }
  });
  let disposable = false;
  if (!order) {
    order = await prisma.order.create({
      data: { customerName: 'Return Flow Test Customer', type: 'STANDARD', status: 'PENDING', currentStage: 'ORDER_ENTRY', quantity: 1 }
    });
    disposable = true;
    console.log("Created disposable order:", order.id);
  } else {
    console.log("Reusing order:", order.id, order.orderNumber);
  }

  try {
    // 2. Create the RETURN case exactly as performDeliveryReturn does (Delivery Boy path)
    const existingCase = await prisma.returnExchange.findFirst({
      where: { orderId: order.id, type: 'RETURN', status: 'PENDING' }
    });
    let caseRecord = existingCase;
    if (!existingCase) {
      caseRecord = await prisma.returnExchange.create({
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          type: 'RETURN',
          status: 'PENDING',
          routedTo: 'INVENTORY_VIEW',
          returnReason: 'Test return',
          originalProducts: typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails,
          deliveryReturnedBy: RIDER.name,
          deliveryReturnedById: RIDER.id,
          deliveryReturnedAt: new Date()
        }
      });
    }
    console.log("Case created (Delivery Boy path):", caseRecord.id, "status:", caseRecord.status, "routedTo:", caseRecord.routedTo);
    assert(caseRecord.status === 'PENDING', 'case starts PENDING');
    assert(caseRecord.routedTo === 'INVENTORY_VIEW', 'case starts routedTo INVENTORY_VIEW');

    // 3. acceptReturn — Case 1 branch (id !== 'new')
    const { res: resA, state: stA } = makeRes('acceptReturn');
    await acceptReturn({
      params: { id: caseRecord.id },
      body: { orderId: order.id },
      user: INVENTORY_USER,
      app: { get: () => undefined }
    }, resA);
    assert(stA.statusCode === 200, `acceptReturn returns 200 (got ${stA.statusCode})`);
    assert(stA.body?.status === 'ACCEPTED', 'acceptReturn response status ACCEPTED');

    const accepted = await prisma.returnExchange.findUnique({ where: { id: caseRecord.id } });
    assert(accepted.status === 'ACCEPTED', 'case transitioned to ACCEPTED');
    assert(accepted.acceptedById === INVENTORY_USER.id, 'acceptedById set to inventory user id');

    const acceptAudit = await prisma.auditLog.findFirst({
      where: { orderId: order.id, action: 'RETURN_ACCEPTED_BY_INVENTORY' },
      orderBy: { timestamp: 'desc' }
    });
    assert(!!acceptAudit, 'RETURN_ACCEPTED_BY_INVENTORY audit created');
    assert(acceptAudit?.performedBy === INVENTORY_USER.id, 'accept audit performedBy = inventory user id');

    // 4. sendReturnToStore
    const { res: resB, state: stB } = makeRes('sendReturnToStore');
    await sendReturnToStore({
      params: { id: caseRecord.id },
      body: { returnReason: 'Customer refused the product', notes: 'Test notes' },
      user: INVENTORY_USER,
      app: { get: () => undefined }
    }, resB);
    assert(stB.statusCode === 200, `sendReturnToStore returns 200 (got ${stB.statusCode})`);
    assert(stB.body?.case?.status === 'PENDING', 'send response case status PENDING');
    assert(stB.body?.case?.routedTo === 'STORE', 'send response case routedTo STORE');

    const sent = await prisma.returnExchange.findUnique({ where: { id: caseRecord.id } });
    assert(sent.status === 'PENDING', 'case is PENDING after send (awaiting Store)');
    assert(sent.routedTo === 'STORE', 'case routedTo STORE after send');
    assert(!!sent.returnReason && sent.returnReason.includes('refused'), 'returnReason persisted');

    const sentAudit = await prisma.auditLog.findFirst({
      where: { orderId: order.id, action: 'RETURN_SENT_TO_STORE' },
      orderBy: { timestamp: 'desc' }
    });
    assert(!!sentAudit, 'RETURN_SENT_TO_STORE audit created');
    assert(sentAudit?.performedBy === INVENTORY_USER.id, 'send audit performedBy = inventory user id');

    // 5. sendReturnToStore guards
    const { res: resG, state: stG } = makeRes('sendReturnToStore-guard');
    await sendReturnToStore({
      params: { id: caseRecord.id },
      body: { returnReason: 'again' },
      user: INVENTORY_USER,
      app: { get: () => undefined }
    }, resG);
    assert(stG.statusCode === 400, `re-send after STORE returns 400 (got ${stG.statusCode}, msg=${stG.body?.message})`);

    // 6. acceptReturn guard after sent to Store
    const { res: resA2, state: stA2 } = makeRes('acceptReturn-after-send');
    await acceptReturn({
      params: { id: caseRecord.id },
      body: { orderId: order.id },
      user: INVENTORY_USER,
      app: { get: () => undefined }
    }, resA2);
    assert(stA2.statusCode === 400, `accept after store returns 400 (got ${stA2.statusCode}, msg=${stA2.body?.message})`);

    // 7. getIncomingReturns must hide the sent case (acceptedById set + status PENDING != ACCEPTED)
    const { res: resI, state: stI } = makeRes('getIncomingReturns');
    await getIncomingReturns({
      query: { type: 'RETURN' },
      user: INVENTORY_USER,
      app: { get: () => undefined }
    }, resI);
    assert(Array.isArray(stI.body?.cases), 'getIncomingReturns returns { cases }');
    const inList = (stI.body?.cases || []).some(c => c.id === caseRecord.id);
    assert(!inList, 'case absent from incoming returns after being sent to Store');

  } finally {
    // Cleanup: delete the case + its audit logs; delete disposable order
    const caseRows = await prisma.returnExchange.findMany({ where: { orderId: order.id, type: 'RETURN' } });
    await prisma.returnExchange.deleteMany({ where: { orderId: order.id, type: 'RETURN' } });
    await prisma.auditLog.deleteMany({ where: { orderId: order.id } });
    if (disposable) await prisma.order.delete({ where: { id: order.id } });
    console.log(`Cleanup: removed ${caseRows.length} return case(s) for order ${order.id}`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
