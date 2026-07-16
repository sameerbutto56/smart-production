/**
 * Data archiving script — moves old orders, audit logs, and chat messages
 * to dedicated archive tables and JSON backup files.
 *
 * Usage:
 *   node scripts/archive-old-data.js [options]
 *
 * Options:
 *   --dry-run       Show what would be done without modifying data
 *   --months <N>    Archive records older than N months (default: 6)
 *   --type <type>   One of: orders, audit, chat, all (default: all)
 *
 * Safety: never touches inventory, users, clients, or financial records.
 * Creates timestamped JSON backups before any deletion.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// ─── Config ───
const BATCH_SIZE = 50;
const ARCHIVE_DIR = path.join(__dirname, '..', 'archives');

// Terminal statuses — orders in these states are safe to archive
const TERMINAL_STATUSES = ['COMPLETED', 'DELIVERED', 'REJECTED', 'CANCELLED', 'REFUNDED'];

// ─── Parse CLI args ───
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const monthsIdx = args.indexOf('--months');
const CUTOFF_MONTHS = monthsIdx >= 0 ? parseInt(args[monthsIdx + 1], 10) || 6 : 6;
const typeIdx = args.indexOf('--type');
const ARCHIVE_TYPE = typeIdx >= 0 ? args[typeIdx + 1] || 'all' : 'all';

// ─── Helpers ───
const cutoffDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - CUTOFF_MONTHS);
  d.setHours(0, 0, 0, 0);
  return d;
};

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const backupJson = (type, records) => {
  if (records.length === 0) return null;
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const file = path.join(ARCHIVE_DIR, `${type}-${timestamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(records, null, 2));
  console.log(`  → Backup written: ${file}`);
  return file;
};

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// ─── Order Archiving ───
async function archiveOrders() {
  log(`Archiving orders (cutoff: ${CUTOFF_MONTHS} months, terminal statuses: ${TERMINAL_STATUSES.join(', ')})`);

  const cutoff = cutoffDate();
  const where = {
    createdAt: { lt: cutoff },
    status: { in: TERMINAL_STATUSES },
  };

  const total = await prisma.order.count({ where });
  if (total === 0) { log('  No orders to archive.'); return; }
  log(`  Found ${total} orders to archive (batch size: ${BATCH_SIZE})`);

  let processed = 0;
  let skipped = 0;

  while (processed < total) {
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      skip: processed,
    });

    if (orders.length === 0) break;

    // Check which orders are already archived
    const orderIds = orders.map(o => o.id);
    const existingArchived = await prisma.archivedOrder.findMany({
      where: { id: { in: orderIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingArchived.map(e => e.id));
    const toArchive = orders.filter(o => !existingIds.has(o.id));

    if (toArchive.length === 0) {
      processed += orders.length;
      continue;
    }

    // Collect child records for each order
    const childRecords = await fetchOrderChildren(toArchive.map(o => o.id));

    if (DRY_RUN) {
      for (const order of toArchive) {
        const children = childRecords[order.id] || {};
        const childCount = Object.values(children).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
        console.log(`  [DRY-RUN] WOULD archive Order ${order.orderNumber || order.id} (${order.status}, ${order.createdAt.toISOString().split('T')[0]}) with ${childCount} child records`);
      }
      processed += orders.length;
      skipped += toArchive.length;
      continue;
    }

    // Backup child records and orders
    const backupPayload = toArchive.map(order => ({
      ...order,
      children: childRecords[order.id] || {},
    }));
    backupJson('orders', backupPayload);

    // Archive each order in its own transaction
    for (const order of toArchive) {
      const children = childRecords[order.id] || {};
      const { id, createdAt, updatedAt, ...scalarFields } = order;

      try {
        await prisma.$transaction(async (tx) => {
          // Create archived order
          await tx.archivedOrder.create({
            data: {
              id,
              originalCreatedAt: createdAt,
              updatedAt,
              ...scalarFields,
              stages: children.stages || [],
              editRequests: children.editRequests || [],
              deliveryAttempts: children.deliveryAttempts || [],
              deliveryPayments: children.deliveryPayments || [],
              noResponseLogs: children.noResponseLogs || [],
              deliveryChargeRecords: children.deliveryChargeRecords || [],
              orderAcceptances: children.orderAcceptances || [],
              dispatchLogs: children.dispatchLogs || [],
            },
          });

          // Delete child records (reverse FK order)
          if (children.deliveryChargeRecords?.length) {
            const ids = children.deliveryChargeRecords.map(r => r.id);
            await tx.deliveryCharge.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.noResponseLogs?.length) {
            const ids = children.noResponseLogs.map(r => r.id);
            await tx.noResponseLog.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.deliveryPayments?.length) {
            const ids = children.deliveryPayments.map(r => r.id);
            await tx.deliveryPayment.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.deliveryAttempts?.length) {
            const ids = children.deliveryAttempts.map(r => r.id);
            await tx.deliveryAttempt.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.orderAcceptances?.length) {
            const ids = children.orderAcceptances.map(r => r.id);
            await tx.orderAcceptance.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.editRequests?.length) {
            const ids = children.editRequests.map(r => r.id);
            await tx.orderEditRequest.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.stages?.length) {
            const ids = children.stages.map(r => r.id);
            await tx.orderStage.deleteMany({ where: { id: { in: ids } } });
          }
          if (children.dispatchLogs?.length) {
            const ids = children.dispatchLogs.map(r => r.id);
            await tx.dispatchLog.deleteMany({ where: { id: { in: ids } } });
          }

          // Update AuditLog records referencing this order (detach orderId)
          await tx.auditLog.updateMany({
            where: { orderId: id },
            data: { orderId: null },
          });

          // Delete the order itself
          await tx.order.delete({ where: { id } });
        });
      } catch (err) {
        console.error(`  ✗ Failed to archive Order ${order.orderNumber || order.id}: ${err.message}`);
        skipped++;
        continue;
      }
      processed++;
    }

    log(`  Archived ${toArchive.length} orders (${processed}/${total})`);
  }

  log(`Orders done: ${processed} archived, ${skipped} skipped\n`);
}

async function fetchOrderChildren(orderIds) {
  const result = {};
  for (const id of orderIds) result[id] = {};

  if (orderIds.length === 0) return result;

  const [stages, editRequests, deliveryAttempts, deliveryPayments, noResponseLogs, deliveryCharges, orderAcceptances, dispatchLogs] = await Promise.all([
    prisma.orderStage.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderEditRequest.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.deliveryAttempt.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.deliveryPayment.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.noResponseLog.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.deliveryCharge.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.orderAcceptance.findMany({ where: { orderId: { in: orderIds } } }),
    prisma.dispatchLog.findMany({ where: { orderId: { in: orderIds } } }),
  ]);

  const groupByOrderId = (records, field = 'orderId') => {
    const groups = {};
    for (const r of records) {
      const oid = r[field];
      if (!groups[oid]) groups[oid] = [];
      groups[oid].push(r);
    }
    return groups;
  };

  const stageMap = groupByOrderId(stages);
  const editReqMap = groupByOrderId(editRequests);
  const deliveryAttemptMap = groupByOrderId(deliveryAttempts);
  const deliveryPaymentMap = groupByOrderId(deliveryPayments);
  const noResponseMap = groupByOrderId(noResponseLogs);
  const deliveryChargeMap = groupByOrderId(deliveryCharges);
  const acceptanceMap = groupByOrderId(orderAcceptances);
  const dispatchMap = groupByOrderId(dispatchLogs);

  for (const id of orderIds) {
    result[id] = {
      stages: stageMap[id] || [],
      editRequests: editReqMap[id] || [],
      deliveryAttempts: deliveryAttemptMap[id] || [],
      deliveryPayments: deliveryPaymentMap[id] || [],
      noResponseLogs: noResponseMap[id] || [],
      deliveryChargeRecords: deliveryChargeMap[id] || [],
      orderAcceptances: acceptanceMap[id] || [],
      dispatchLogs: dispatchMap[id] || [],
    };
  }

  return result;
}

// ─── Audit Log Archiving ───
async function archiveAuditLogs() {
  log(`Archiving audit logs (cutoff: ${CUTOFF_MONTHS} months)`);
  const cutoff = cutoffDate();
  const where = { timestamp: { lt: cutoff } };
  const total = await prisma.auditLog.count({ where });
  if (total === 0) { log('  No audit logs to archive.'); return; }
  log(`  Found ${total} audit logs to archive`);

  let processed = 0;
  let skipped = 0;

  while (processed < total) {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: BATCH_SIZE,
      skip: processed,
    });
    if (logs.length === 0) break;

    // Check for already archived
    const logIds = logs.map(l => l.id);
    const existing = await prisma.archivedAuditLog.findMany({
      where: { id: { in: logIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(e => e.id));
    const toArchive = logs.filter(l => !existingIds.has(l.id));

    if (toArchive.length === 0) { processed += logs.length; continue; }

    if (DRY_RUN) {
      const first = toArchive[0];
      const last = toArchive[toArchive.length - 1];
      console.log(`  [DRY-RUN] WOULD archive ${toArchive.length} audit logs (${first.timestamp.toISOString().split('T')[0]} → ${last.timestamp.toISOString().split('T')[0]})`);
      processed += logs.length;
      skipped += toArchive.length;
      continue;
    }

    // Backup to JSON
    backupJson('audit-logs', toArchive);

    // Batch create archived records
    const archiveData = toArchive.map(l => ({
      id: l.id,
      orderId: l.orderId,
      action: l.action,
      details: l.details,
      performedBy: l.performedBy,
      timestamp: l.timestamp,
    }));
    await prisma.archivedAuditLog.createMany({ data: archiveData });
    await prisma.auditLog.deleteMany({ where: { id: { in: toArchive.map(l => l.id) } } });

    processed += toArchive.length;
    log(`  Archived ${toArchive.length} audit logs (${processed}/${total})`);
  }

  log(`Audit logs done: ${processed} archived, ${skipped} skipped\n`);
}

// ─── Chat Message Archiving ───
async function archiveChatMessages() {
  log(`Archiving chat messages (cutoff: ${CUTOFF_MONTHS} months)`);
  const cutoff = cutoffDate();
  const where = { createdAt: { lt: cutoff }, isPinned: false };
  const total = await prisma.chatMessage.count({ where });
  if (total === 0) { log('  No chat messages to archive.'); return; }
  log(`  Found ${total} chat messages to archive`);

  let processed = 0;
  let skipped = 0;

  while (processed < total) {
    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      skip: processed,
      include: { readReceipts: true },
    });
    if (messages.length === 0) break;

    const msgIds = messages.map(m => m.id);
    const existing = await prisma.archivedChatMessage.findMany({
      where: { id: { in: msgIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(e => e.id));
    const toArchive = messages.filter(m => !existingIds.has(m.id));

    if (toArchive.length === 0) { processed += messages.length; continue; }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] WOULD archive ${toArchive.length} chat messages`);
      processed += messages.length;
      skipped += toArchive.length;
      continue;
    }

    // Backup to JSON
    backupJson('chat-messages', toArchive);

    // Create archived records
    const archiveData = toArchive.map(m => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      senderBranch: m.senderBranch || null,
      message: m.message || null,
      voiceUrl: m.voiceUrl || null,
      isPinned: m.isPinned || false,
      createdAt: m.createdAt,
      deliveredAt: m.deliveredAt || null,
      readAt: m.readAt || null,
      playedAt: m.playedAt || null,
      readReceipts: m.readReceipts || [],
      voiceFileDeleted: false,
    }));
    await prisma.archivedChatMessage.createMany({ data: archiveData });

    // Delete read receipts + messages (cascade handles receipts)
    await prisma.chatMessageReadReceipt.deleteMany({ where: { messageId: { in: toArchive.map(m => m.id) } } });
    await prisma.chatMessage.deleteMany({ where: { id: { in: toArchive.map(m => m.id) } } });

    processed += toArchive.length;
    log(`  Archived ${toArchive.length} chat messages (${processed}/${total})`);
  }

  log(`Chat messages done: ${processed} archived, ${skipped} skipped\n`);
}

// ─── Main ───
async function main() {
  console.log('══════════════════════════════════════════');
  console.log('  Data Archiving Script');
  console.log(`  Mode:      ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`  Cutoff:    ${CUTOFF_MONTHS} months (before ${cutoffDate().toISOString().split('T')[0]})`);
  console.log(`  Type:      ${ARCHIVE_TYPE}`);
  console.log(`  Batches:   ${BATCH_SIZE}`);
  console.log('══════════════════════════════════════════\n');

  const start = Date.now();

  try {
    if (ARCHIVE_TYPE === 'all' || ARCHIVE_TYPE === 'orders') {
      await archiveOrders();
    }
    if (ARCHIVE_TYPE === 'all' || ARCHIVE_TYPE === 'audit') {
      await archiveAuditLogs();
    }
    if (ARCHIVE_TYPE === 'all' || ARCHIVE_TYPE === 'chat') {
      await archiveChatMessages();
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\nDone in ${elapsed}s${DRY_RUN ? ' (dry run — no data modified)' : ''}`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
