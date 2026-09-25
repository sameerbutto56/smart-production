// Debug script: inspect actual deliveryPayment records for today's delivered orders
const prisma = require('../src/prisma');
const { dateBoundToMs } = require('../src/utils/workingHours');

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const gte = new Date(dateBoundToMs(today, 'start'));
  const lte = new Date(dateBoundToMs(today, 'end'));

  console.log(`\n=== Date Window ===`);
  console.log(`Today: ${today}`);
  console.log(`gte: ${gte.toISOString()}`);
  console.log(`lte: ${lte.toISOString()}`);

  // Find all orders with delivery payments
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { deliveryType: 'ENAMELS' },
        { deliveryMethod: 'Enamels Delivery' },
        { currentStage: 'ENAMELS_DELIVERY' },
        { deliveryAttempts: { some: {} } },
        { deliveryPayments: { some: {} } },
        { orderAcceptances: { some: {} } }
      ]
    },
    include: {
      deliveryPayments: true,
      orderAcceptances: { orderBy: { assignedAt: 'desc' }, take: 1 },
      deliveryAttempts: { orderBy: { attemptNumber: 'asc' } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  console.log(`\nTotal Enamels delivery orders: ${orders.length}`);

  // Orders with delivery payments
  const withPayments = orders.filter(o => o.deliveryPayments.length > 0);
  console.log(`Orders with deliveryPayment records: ${withPayments.length}`);

  // Find delivered orders
  const delivered = orders.filter(o =>
    o.currentStage === 'DELIVERED' || o.status === 'COMPLETED' || o.deliveredAt
  );
  console.log(`Delivered orders: ${delivered.length}`);

  // Check which delivered orders have payments
  const deliveredWithPayments = delivered.filter(o => o.deliveryPayments.length > 0);
  console.log(`Delivered orders WITH payment records: ${deliveredWithPayments.length}`);
  const deliveredWithoutPayments = delivered.filter(o => o.deliveryPayments.length === 0);
  console.log(`Delivered orders WITHOUT payment records: ${deliveredWithoutPayments.length}`);

  console.log(`\n=== All DeliveryPayment Records ===`);
  for (const o of withPayments) {
    const total = parseFloat(o.totalPrice) || 0;
    const advance = parseFloat(o.advanceAmount) || 0;
    const isPrepaid = total <= 0.01 || advance >= total - 0.01;
    
    for (const p of o.deliveryPayments) {
      const colAt = p.collectedAt || p.createdAt;
      const colTime = new Date(colAt).getTime();
      const insideWindow = colTime >= gte.getTime() && colTime <= lte.getTime();
      console.log(`  Order #${o.orderNumber} | total=₨${total} advance=₨${advance} prepaid=${isPrepaid} | method=${p.paymentMethod} cash=${p.cashAmount} online=${p.onlineAmount} | collectedAt=${colAt ? new Date(colAt).toISOString() : 'NULL'} createdAt=${p.createdAt ? new Date(p.createdAt).toISOString() : 'NULL'} | IN_WINDOW=${insideWindow}`);
    }
  }

  // Show today's delivered orders that are COD (not prepaid)
  console.log(`\n=== Today's Delivered COD Orders (no prepaid) ===`);
  for (const o of delivered) {
    const total = parseFloat(o.totalPrice) || 0;
    const advance = parseFloat(o.advanceAmount) || 0;
    const isPrepaid = total <= 0.01 || advance >= total - 0.01 || o.isPrepaid;
    if (isPrepaid) continue;

    const assignedAt = o.orderAcceptances?.[0]?.assignedAt || o.createdAt;
    const assignedTime = new Date(assignedAt).getTime();
    const assignedInWindow = assignedTime >= gte.getTime() && assignedTime <= lte.getTime();
    const assignedBefore = assignedTime < gte.getTime();
    
    const deliveredAt = o.deliveredAt || null;
    const deliveredTime = deliveredAt ? new Date(deliveredAt).getTime() : null;
    const deliveredInWindow = deliveredTime ? (deliveredTime >= gte.getTime() && deliveredTime <= lte.getTime()) : false;

    const payments = o.deliveryPayments;
    const hasPaymentRecord = payments.length > 0;
    
    console.log(`  Order #${o.orderNumber} | total=₨${total} advance=₨${advance} due=₨${total - advance} | stage=${o.currentStage} status=${o.status} paymentStatus=${o.paymentStatus} paymentMethod=${o.paymentMethod}`);
    console.log(`    assigned=${new Date(assignedAt).toISOString()} inWin=${assignedInWindow} before=${assignedBefore}`);
    console.log(`    delivered=${deliveredAt ? new Date(deliveredAt).toISOString() : 'NULL'} inWin=${deliveredInWindow}`);
    console.log(`    hasPaymentRecord=${hasPaymentRecord}`);
    if (hasPaymentRecord) {
      for (const p of payments) {
        const colAt = p.collectedAt || p.createdAt;
        const colTime = new Date(colAt).getTime();
        const insideWindow = colTime >= gte.getTime() && colTime <= lte.getTime();
        console.log(`      payment: method=${p.paymentMethod} cash=${p.cashAmount} online=${p.onlineAmount} collectedAt=${colAt ? new Date(colAt).toISOString() : 'NULL'} IN_WINDOW=${insideWindow}`);
      }
    }
  }

  // Print summary of what the analytics endpoint would compute
  console.log(`\n=== Simulated Analytics Summary ===`);
  let totalCash = 0, totalOnline = 0;
  let paidCount = 0, codCount = 0;
  let codExpected = 0;
  
  // Simulate with matchedOrders (orders that have any event in window or carry forward)
  for (const o of orders) {
    const total = parseFloat(o.totalPrice) || 0;
    const advance = parseFloat(o.advanceAmount) || 0;
    const isPrepaid = total <= 0.01 || advance >= total - 0.01 || o.isPrepaid;
    
    const assignedAt = o.orderAcceptances?.[0]?.assignedAt || o.createdAt;
    const deliveredAt = o.deliveredAt;
    const isDelivered = o.currentStage === 'DELIVERED' || o.status === 'COMPLETED' || !!deliveredAt;
    
    // Check if ANY event is in today's window
    const anyInWindow = [assignedAt, deliveredAt, o.updatedAt].some(d => {
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= gte.getTime() && t <= lte.getTime();
    });
    
    const assignedBefore = new Date(assignedAt).getTime() < gte.getTime();
    const isTerminal = ['DELIVERED', 'RETURNED', 'CANCELLED'].includes(o.currentStage) || 
                       ['COMPLETED', 'RETURNED', 'CANCELLED'].includes(o.status);
    const isCarryForward = assignedBefore && !isTerminal;
    
    if (!anyInWindow && !isCarryForward) continue;
    
    if (isPrepaid) { paidCount++; continue; }
    
    const isCOD = !isPrepaid && total > 0.01;
    if (isCOD) {
      codCount++;
      const expected = Math.max(0, total - advance);
      codExpected += expected;
      
      const payments = o.deliveryPayments || [];
      let cashC = 0, onlineC = 0;
      if (payments.length > 0) {
        for (const p of payments) {
          const colAt = p.collectedAt || p.createdAt;
          const colTime = new Date(colAt).getTime();
          const insideWindow = colTime >= gte.getTime() && colTime <= lte.getTime();
          if (insideWindow) {
            if (['CASH', 'CASH_ONLINE'].includes(p.paymentMethod)) cashC += Number(p.cashAmount || 0);
            if (['ONLINE', 'CASH_ONLINE', 'MULTIPLE_ONLINE', 'CARD'].includes(p.paymentMethod)) onlineC += Number(p.onlineAmount || 0);
          }
        }
      } else if (isDelivered) {
        const delDate = deliveredAt || o.updatedAt;
        const delTime = new Date(delDate).getTime();
        if (delTime >= gte.getTime() && delTime <= lte.getTime()) {
          if (o.paymentMethod === 'ONLINE') onlineC = expected;
          else cashC = expected;
        }
      }
      totalCash += cashC;
      totalOnline += onlineC;
    }
  }
  
  console.log(`Paid orders: ${paidCount}`);
  console.log(`COD orders: ${codCount}`);
  console.log(`COD Expected: ₨${codExpected}`);
  console.log(`Cash Collected: ₨${totalCash}`);
  console.log(`Online Collected: ₨${totalOnline}`);
  console.log(`Total Collected: ₨${totalCash + totalOnline}`);
  console.log(`Remaining COD: ₨${codExpected - totalCash - totalOnline}`);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
