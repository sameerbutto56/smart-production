/* Repro: run the exact FaisalReplacements createAndSend flow (initiate +
   send-to-store) against live order 50335 using the REAL controller
   functions, capture the actual error, then fully clean up. */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const prisma = require('../src/prisma');
const { createReturnExchange, sendToStore } = require('../src/controllers/returnExchange.controller');

function mockRes() {
  const res = { _status: null, _json: null };
  res.status = function (s) { this._status = s; return this; };
  res.json = function (j) { this._json = j; return this; };
  return res;
}

function mockReq(over) {
  return {
    user: { id: null, name: 'Faisal' },
    body: {},
    params: {},
    query: {},
    app: { get: () => null },
    ...over
  };
}

async function main() {
  // 1. Locate order 50335 (bare + # prefixed + invoice contains)
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { orderNumber: { in: ['50335', '#50335'] } },
        { orderNumber: { contains: '50335' } },
        { invoiceNumber: { contains: '50335' } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  });
  if (!order) { console.log('RESULT: order 50335 NOT FOUND'); return; }
  console.log('Original order:', order.id, '| #', order.orderNumber, '|', order.customerName, '| source', order.source, '| stage', order.currentStage, '| status', order.status);

  // 2. Mirror the backend duplicate guard (initiate, keyed on original orderId)
  const existing = await prisma.returnExchange.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Existing returnExchange rows for original:', existing.length);
  if (existing.length) existing.forEach(c => console.log('  case', c.id, '| type', c.type, '| status', c.status, '| routedTo', c.routedTo, '| repOrder', c.replacementOrderId));

  // 3. Faisal user (FK for createdById / performedBy)
  const faisal = await prisma.user.findFirst({ where: { name: { contains: 'Faisal', mode: 'insensitive' } } });
  if (!faisal) { console.log('RESULT: Faisal user NOT FOUND'); return; }
  console.log('Acting user:', faisal.name, faisal.id);

  let caseId = null;
  let repOrderId = null;

  // 4. initiate — exact frontend payload shape
  const initReq = mockReq({
    user: { id: faisal.id, name: faisal.name },
    body: {
      orderId: order.id,
      type: 'REPLACEMENT',
      returnReason: 'Repro test - will be deleted',
      specialNote: 'Repro test - will be deleted',
      replacementItems: [{ name: 'Repro Test Item', color: 'Black', size: 'M', quantity: 1, notes: '' }]
    }
  });
  let initRes = mockRes();
  try {
    await createReturnExchange(initReq, initRes);
  } catch (e) {
    console.log('INITIATE THREW:', e.message);
    console.log(e.stack.split('\n').slice(0, 6).join('\n'));
  }
  console.log('INITIATE status:', initRes._status);
  if (initRes._json && initRes._json.id) {
    caseId = initRes._json.id;
    console.log('INITIATE case:', caseId, '| status', initRes._json.status, '| routedTo', initRes._json.routedTo);
  } else if (initRes._json) {
    console.log('INITIATE response:', JSON.stringify(initRes._json));
  }

  // 5. send-to-store — exact frontend payload shape (full item from buildItems)
  if (caseId) {
    const stsReq = mockReq({
      user: { id: faisal.id, name: faisal.name },
      params: { id: caseId },
      body: {
        replacementItems: [{
          name: 'Repro Test Item', productType: 'Repro Test Item', color: 'Black', size: 'M',
          quantity: 1, unitPrice: 100, notes: '',
          fabricType: '', gender: 'Male', sleeveLength: '', shirtLength: '',
          matchingCap: false, matchingCapQty: 0,
          sizeData: {}, engravingRequired: 'skip'
        }],
        replacementSummary: {
          originalItems: [{ index: 1, name: 'Original Item', color: '', size: '', quantity: 1 }],
          newItems: [{ name: 'Repro Test Item', color: 'Black', size: 'M', quantity: 1, notes: '' }],
          notes: 'Repro test', returnReason: 'Repro test', createdBy: 'Faisal', createdAt: new Date().toISOString()
        }
      }
    });
    const stsRes = mockRes();
    try {
      await sendToStore(stsReq, stsRes);
    } catch (e) {
      console.log('SEND-TO-STORE THREW:', e.message);
      console.log(e.stack.split('\n').slice(0, 8).join('\n'));
    }
    console.log('SEND-TO-STORE status:', stsRes._status);
    if (stsRes._json) {
      if (stsRes._json.id) {
        repOrderId = stsRes._json.replacementOrderId || null;
        console.log('SEND-TO-STORE case updated:', stsRes._json.status, '| routedTo', stsRes._json.routedTo, '| replacementOrderId', stsRes._json.replacementOrderId);
      } else {
        console.log('SEND-TO-STORE response:', JSON.stringify(stsRes._json));
      }
    }
  }

  // 6. Look up the created replacement order if any
  if (caseId) {
    const c = await prisma.returnExchange.findUnique({ where: { id: caseId } });
    if (c && c.replacementOrderId) repOrderId = c.replacementOrderId;
    if (repOrderId) {
      const rep = await prisma.order.findUnique({ where: { id: repOrderId } });
      console.log('Created replacement order:', repOrderId, '| #', rep ? rep.orderNumber : '?', '| stage', rep ? rep.currentStage : '?', '| status', rep ? rep.status : '?');
    }
  }

  // 7. CLEANUP
  console.log('--- CLEANUP ---');
  const createdRepId = repOrderId;
  let createdRepNumber = null;
  if (createdRepId) {
    const rep = await prisma.order.findUnique({ where: { id: createdRepId }, select: { orderNumber: true } });
    createdRepNumber = rep ? rep.orderNumber : null;
    const del = async (model, where) => {
      try { const r = await model.deleteMany({ where }); console.log(`  ${model.name}: ${r.count} deleted`, JSON.stringify(where).slice(0, 120)); }
      catch (e) { console.log('  cleanup err', model.name, e.message); }
    };
    await del(prisma.orderStage, { orderId: createdRepId });
    await del(prisma.routingHistory, { orderId: createdRepId });
    await del(prisma.auditLog, { orderId: createdRepId });
    await del(prisma.seenTask, { orderId: createdRepId });
    await prisma.order.delete({ where: { id: createdRepId } });
    console.log('  REP order deleted');
  }
  if (caseId) {
    const c = await prisma.returnExchange.findUnique({ where: { id: caseId } });
    // audit log written on the ORIGINAL order by initiate (REPLACEMENT_INITIATED) + by sendToStore (REPLACEMENT_ORDER_CREATED)
    if (c) {
      const orderId = c.orderId;
      await prisma.auditLog.deleteMany({ where: { orderId, action: { in: ['REPLACEMENT_INITIATED'] }, details: { contains: 'Repro test - will be deleted' } } });
      if (createdRepNumber) {
        await prisma.auditLog.deleteMany({ where: { orderId, action: 'REPLACEMENT_ORDER_CREATED', details: { contains: createdRepNumber } } });
      }
      await prisma.returnExchange.delete({ where: { id: caseId } });
      console.log('  case deleted + original-order repro audits removed');
    }
  }
  const leftover = await prisma.returnExchange.count({ where: { orderId: order.id } });
  console.log('Leftover cases for 50335:', leftover);
  console.log('DONE');
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
