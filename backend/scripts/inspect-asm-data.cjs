const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  const vendors = await prisma.vendor.findMany({
    include: {
      orders: {
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
          documentRevisions: true,
          documents: true,
          allocations: true,
          inventoryAudits: true,
        },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Total Vendors found:', vendors.length);
  for (const v of vendors) {
    console.log('\n--- Vendor:', v.id, '| Name:', v.name, '| Phone:', v.phone, '| Created:', v.createdAt.toISOString(), '---');
    console.log('Orders count:', v.orders.length);
    for (const o of v.orders) {
      console.log('  Order:', o.id, '| Number:', o.orderNumber, '| Stage:', o.currentStage, '| Status:', o.status, '| GrandTotal:', o.grandTotal, '| Created:', o.createdAt.toISOString());
      console.log('    Items count:', o.items.length);
      for (const it of o.items.slice(0, 5)) {
        console.log('      Item:', it.productName, '| Color:', it.color, '| Size:', it.size, '| Qty:', it.quantity, '| Alloc:', it.allocatedQuantity);
      }
      if (o.items.length > 5) console.log('      ... and', o.items.length - 5, 'more items');
      console.log('    Allocations:', o.allocations.length, '| Audits:', o.inventoryAudits.length, '| DocRevisions:', o.documentRevisions.length, '| Docs:', o.documents.length);
    }
  }

  const allOrders = await prisma.vendorOrder.findMany({
    select: { id: true, orderNumber: true, currentStage: true, vendorId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\nTotal VendorOrders in DB:', allOrders.length);
  for (const ord of allOrders) {
    console.log('  Order #:', ord.orderNumber, '| Stage:', ord.currentStage, '| Created:', ord.createdAt.toISOString());
  }

  await prisma.$disconnect();
}

inspect().catch(e => { console.error(e); process.exit(1); });
