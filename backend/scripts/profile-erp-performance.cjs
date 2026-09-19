/**
 * ERP Performance Audit & Profiling Script
 * Measures database query times, payload sizes, endpoint execution times,
 * and identifies bottlenecks across Admin Dashboard, Orders, and My Tasks.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

let queryCount = 0;
let totalQueryTimeMs = 0;
const queryLog = [];

prisma.$on('query', (e) => {
  queryCount++;
  totalQueryTimeMs += e.duration;
  queryLog.push({ query: e.query.slice(0, 120), duration: e.duration, params: e.params });
});

async function main() {
  console.log('================================================================');
  console.log('STARTING ERP PERFORMANCE & DATABASE PROFILING AUDIT');
  console.log('================================================================\n');

  // 1. Database table sizes
  console.log('--- 1. DATABASE VOLUME AUDIT ---');
  const t0 = Date.now();
  const [orderCount, stageCount, auditCount, userCount, seenCount] = await Promise.all([
    prisma.order.count(),
    prisma.orderStage.count(),
    prisma.auditLog.count(),
    prisma.user.count(),
    prisma.seenTask.count(),
  ]);
  console.log(`- Orders in DB: ${orderCount}`);
  console.log(`- OrderStages in DB: ${stageCount}`);
  console.log(`- AuditLogs in DB: ${auditCount}`);
  console.log(`- Users in DB: ${userCount}`);
  console.log(`- SeenTasks in DB: ${seenCount}`);
  console.log(`- Volume check duration: ${Date.now() - t0}ms\n`);

  // 2. Profile default /api/orders (what Admin Dashboard & Orders currently load)
  console.log('--- 2. PROFILING DEFAULT GET /api/orders (Current Monolithic Fetch) ---');
  queryCount = 0;
  totalQueryTimeMs = 0;
  queryLog.length = 0;

  const startMonolithic = Date.now();
  // Simulating the exact query in order.controller.js lines 863-892
  const [activeOrders, completedOrders] = await prisma.$transaction([
    prisma.order.findMany({
      where: { status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] } },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    }),
    prisma.order.findMany({
      where: { status: { in: ['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'] } },
      include: {
        stages: { orderBy: { createdAt: 'desc' }, select: { id: true, stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, timestamp: true, details: true, performedBy: true } },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);
  const endMonolithic = Date.now();
  const totalOrdersLoaded = activeOrders.length + completedOrders.length;
  const rawPayload = JSON.stringify([...activeOrders, ...completedOrders]);
  const payloadSizeKb = (Buffer.byteLength(rawPayload, 'utf8') / 1024).toFixed(2);

  console.log(`- Orders fetched: ${totalOrdersLoaded} (${activeOrders.length} active + ${completedOrders.length} completed)`);
  console.log(`- Wall-clock query time: ${endMonolithic - startMonolithic}ms`);
  console.log(`- Prisma reported query time: ${totalQueryTimeMs}ms across ${queryCount} queries`);
  console.log(`- Response payload size: ${payloadSizeKb} KB (${(payloadSizeKb / 1024).toFixed(2)} MB)`);
  console.log(`- Average per-record overhead: ${(Buffer.byteLength(rawPayload, 'utf8') / (totalOrdersLoaded || 1) / 1024).toFixed(2)} KB/order\n`);

  // 3. Profile Paginated /api/orders (Target Optimization)
  console.log('--- 3. PROFILING PAGINATED GET /api/orders (Target Pattern: page=1, limit=25) ---');
  queryCount = 0;
  totalQueryTimeMs = 0;
  queryLog.length = 0;

  const startPaginated = Date.now();
  const [paginatedOrders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where: {},
      take: 25,
      skip: 0,
      select: {
        id: true,
        orderNumber: true,
        invoiceNumber: true,
        customerName: true,
        customerPhone: true,
        city: true,
        status: true,
        currentStage: true,
        priority: true,
        urgent: true,
        source: true,
        type: true,
        totalPrice: true,
        advanceAmount: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
        shopifyOrderDate: true,
        outletName: true,
        isPrOrder: true,
        stages: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, stageName: true, status: true, deadlineAt: true, startedAt: true, completedAt: true }
        },
        createdBy: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.order.count({ where: {} })
  ]);
  const endPaginated = Date.now();
  const paginatedPayload = JSON.stringify({ orders: paginatedOrders, total: totalCount, page: 1, totalPages: Math.ceil(totalCount / 25) });
  const paginatedSizeKb = (Buffer.byteLength(paginatedPayload, 'utf8') / 1024).toFixed(2);

  console.log(`- Paginated orders fetched: ${paginatedOrders.length} (Total available: ${totalCount})`);
  console.log(`- Wall-clock query time: ${endPaginated - startPaginated}ms`);
  console.log(`- Prisma reported query time: ${totalQueryTimeMs}ms across ${queryCount} queries`);
  console.log(`- Response payload size: ${paginatedSizeKb} KB`);
  console.log(`- Speedup: ${( (endMonolithic - startMonolithic) / (endPaginated - startPaginated || 1) ).toFixed(1)}x faster`);
  console.log(`- Payload reduction: ${( (1 - paginatedSizeKb / payloadSizeKb) * 100 ).toFixed(1)}% smaller\n`);

  // 4. Profile Admin Dashboard Summary API vs Monolithic Order Calculation
  console.log('--- 4. PROFILING DASHBOARD SUMMARY AGGREGATION VS IN-MEMORY JAVASCRIPT ---');
  queryCount = 0;
  totalQueryTimeMs = 0;
  const startSummary = Date.now();

  const [
    totalOrdersAgg,
    urgentOrdersAgg,
    completedTodayAgg,
    stageCountsRaw
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { OR: [{ priority: 'URGENT' }, { priority: 'SUPER_URGENT' }, { urgent: true }] } }),
    prisma.order.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      }
    }),
    prisma.order.groupBy({
      by: ['currentStage'],
      where: { status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] } },
      _count: true
    })
  ]);
  const endSummary = Date.now();
  const summaryPayload = JSON.stringify({
    totalOrders: totalOrdersAgg,
    urgentOrders: urgentOrdersAgg,
    completedToday: completedTodayAgg,
    stages: stageCountsRaw
  });
  const summarySizeKb = (Buffer.byteLength(summaryPayload, 'utf8') / 1024).toFixed(2);

  console.log(`- Aggregated Summary duration: ${endSummary - startSummary}ms`);
  console.log(`- Prisma query time: ${totalQueryTimeMs}ms across ${queryCount} queries`);
  console.log(`- Summary payload size: ${summarySizeKb} KB`);
  console.log(`- Total orders: ${totalOrdersAgg}, Urgent: ${urgentOrdersAgg}, Completed Today: ${completedTodayAgg}`);
  console.log(`- Stage counts: ${JSON.stringify(stageCountsRaw)}\n`);

  // 5. Profile Order Search
  console.log('--- 5. PROFILING ORDER SEARCH ---');
  const sampleOrder = paginatedOrders[0];
  if (sampleOrder) {
    queryCount = 0;
    totalQueryTimeMs = 0;
    const startSearch = Date.now();
    const searchResult = await prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: sampleOrder.orderNumber, mode: 'insensitive' } },
          { customerPhone: { contains: sampleOrder.customerPhone || '' } }
        ]
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        currentStage: true,
        status: true
      },
      take: 20
    });
    const endSearch = Date.now();
    console.log(`- Order search for "${sampleOrder.orderNumber}": ${endSearch - startSearch}ms (Prisma: ${totalQueryTimeMs}ms, returned: ${searchResult.length} rows)\n`);
  }

  console.log('================================================================');
  console.log('AUDIT COMPLETED');
  console.log('================================================================\n');
}

main()
  .catch(err => {
    console.error('Audit error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
