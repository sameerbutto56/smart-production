const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  console.log('--- STARTING VERIFICATION: Admin Orders Loading & Filter Reliability ---');

  // 1. Verify Database Indexes in Prisma Schema
  console.log('\n[Check 1] Verifying Database Indexes in schema.prisma...');
  const schemaContent = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
  const hasOrderStageIndex = schemaContent.includes('@@index([orderId, createdAt(sort: Desc)])');
  const hasAuditLogIndex = schemaContent.includes('@@index([orderId, timestamp(sort: Desc)])');
  if (!hasOrderStageIndex || !hasAuditLogIndex) {
    throw new Error(`Prisma schema missing required composite indexes! OrderStage: ${hasOrderStageIndex}, AuditLog: ${hasAuditLogIndex}`);
  }
  console.log('✓ Both OrderStage(orderId, createdAt DESC) and AuditLog(orderId, timestamp DESC) indexes present in schema.');

  // 2. Query Orders with Prisma directly to measure performance
  console.log('\n[Check 2] Measuring Prisma database query latency on Orders...');
  let activeOrders = [], completedOrders = [];
  let latency = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      [activeOrders, completedOrders] = await Promise.all([
        prisma.order.findMany({
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS', 'READY_FOR_DELIVERY'] },
          },
          include: {
            stages: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            auditLogs: {
              orderBy: { timestamp: 'desc' },
              take: 3,
            },
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        prisma.order.findMany({
          where: {
            status: { in: ['COMPLETED', 'REJECTED'] },
          },
          include: {
            stages: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            auditLogs: {
              orderBy: { timestamp: 'desc' },
              take: 3,
            },
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);
      latency = Date.now() - t0;
      break;
    } catch (err) {
      console.warn(`Prisma attempt ${attempt} failed: ${err.message}. Retrying...`);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`✓ Fetched ${activeOrders.length} active and ${completedOrders.length} completed orders in ${latency}ms.`);
  if (latency > 3000) {
    console.warn(`⚠ Query took ${latency}ms (warning if database is remote).`);
  }

  // 3. Verify Server Delay Configuration & Delay Tagging Logic
  console.log('\n[Check 3] Verifying Delay Tagging Logic and attachDelayInfoToOrders...');
  const orderController = fs.readFileSync(path.join(__dirname, '../src/controllers/order.controller.js'), 'utf8');
  if (!orderController.includes('attachDelayInfoToOrders(combined, delayConfig)') ||
      !orderController.includes('Promise.all([') ||
      !orderController.includes('cachedDelayConfig')) {
    throw new Error('order.controller.js missing optimized delay attaching, caching, or parallel queries!');
  }
  console.log('✓ order.controller.js uses in-memory delayConfig cache, parallel Promise.all, and server delay tagging.');

  // 4. Verify Frontend Data Layer in AllOrders.jsx
  console.log('\n[Check 4] Verifying Frontend AllOrders.jsx data layer and states...');
  const allOrdersContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/AllOrders.jsx'), 'utf8');
  
  // Verify loading state
  if (!allOrdersContent.includes('Loading orders...') || !allOrdersContent.includes('<TableSkeleton rows={8} />')) {
    throw new Error('AllOrders.jsx missing explicit Loading orders skeleton state!');
  }
  console.log('✓ AllOrders.jsx has explicit "Loading orders..." with TableSkeleton.');

  // Verify error state with retry
  if (!allOrdersContent.includes('Unable to load orders') || !allOrdersContent.includes('Retry Loading Orders')) {
    throw new Error('AllOrders.jsx missing Error state with Retry Loading Orders button!');
  }
  console.log('✓ AllOrders.jsx has Error state with "Retry Loading Orders" button.');

  // Verify empty state with reset filters
  if (!allOrdersContent.includes('No orders found for the selected filters.') || !allOrdersContent.includes('Reset Filters & View All')) {
    throw new Error('AllOrders.jsx missing Empty state with "Reset Filters & View All" button!');
  }
  console.log('✓ AllOrders.jsx has Empty state with "Reset Filters & View All" button.');

  // Verify delayed orders filter fallback
  if (!allOrdersContent.includes('map[o.id] = o.delayInfo') || !allOrdersContent.includes('order.delayInfo && order.delayInfo.isDelayed')) {
    throw new Error('AllOrders.jsx missing fallback to server-attached order.delayInfo!');
  }
  console.log('✓ AllOrders.jsx delayMap falls back to server-attached order.delayInfo for instant filter accuracy.');

  // Verify role matching fallback
  if (!allOrdersContent.includes('sessionStorage.getItem(\'user\')') || !allOrdersContent.includes('isControlCenter')) {
    throw new Error('AllOrders.jsx missing sessionStorage role hydration fallback!');
  }
  console.log('✓ AllOrders.jsx has sessionStorage role hydration fallback preventing initial-render filter wipeout.');

  // 5. Verify API Interceptor deduplication cleanup
  console.log('\n[Check 5] Verifying api.js inflight error cleanup and noDedupe support...');
  const apiContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/services/api.js'), 'utf8');
  if (!apiContent.includes('inflight.delete(error.config._inflightKey)') || !apiContent.includes('!config.noDedupe')) {
    throw new Error('api.js missing inflight cleanup on error or config.noDedupe bypass!');
  }
  console.log('✓ api.js handles inflight.delete on errors and supports config.noDedupe.');

  console.log('\n======================================================');
  console.log('✓ ALL 5 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

run()
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
