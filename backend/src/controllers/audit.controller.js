const prisma = require('../prisma');
const cache = require('../utils/cache');
const { Prisma } = require('@prisma/client');

// Same djb2 + generateBarcode scheme as warehouse.controller.js — warehouse
// variant barcodes are computed on the fly, never persisted. Reusing it here
// guarantees the exact same barcode a Warehouse POS scanner reads.
const djb2 = (str) => {
  let hash = 5381;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'WRH';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|${attempt}`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

const AUDIT_ROLES = ['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const parseVariants = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return []; }
  }
  return [];
};

const computeItemDiff = (item) => {
  const diff = (item.physicalQty || 0) - (item.systemQty || 0);
  return { ...item, difference: diff, status: diff === 0 ? 'MATCH' : diff > 0 ? 'EXTRA' : 'MISSING' };
};

const computeAuditSummary = (items) => {
  let scannedCount = 0, matchedCount = 0, missingCount = 0, extraCount = 0;
  let lossValue = 0, extraValue = 0, totalScans = 0;
  for (const it of items) {
    const diff = (it.physicalQty || 0) - (it.systemQty || 0);
    if (it.scanned) scannedCount++;
    totalScans += it.scanCount || 0;
    if (diff === 0) matchedCount++;
    else if (diff > 0) { extraCount++; extraValue += diff * (it.price || 0); }
    else { missingCount++; lossValue += Math.abs(diff) * (it.price || 0); }
  }
  return {
    scannedCount, totalScans, matchedCount, missingCount, extraCount,
    lossValue, extraValue, differenceValue: lossValue + extraValue
  };
};

const persistSummary = async (auditId, items, tx) => {
  const s = computeAuditSummary(items);
  const client = tx || prisma;
  await client.inventoryAudit.update({
    where: { id: auditId },
    data: {
      scannedCount: s.scannedCount,
      totalScans: s.totalScans,
      matchedCount: s.matchedCount,
      missingCount: s.missingCount,
      extraCount: s.extraCount,
      differenceValue: s.differenceValue
    }
  });
  return s;
};

const generateAuditNumber = async () => {
  const d = new Date();
  const y = d.getFullYear();
  const last = await prisma.inventoryAudit.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { auditNumber: true }
  });
  let seq = 1;
  if (last) {
    const m = /AUD-(\d+)/.exec(last.auditNumber);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `AUD-${String(seq).padStart(4, '0')}`;
};

const loadAuditWithItems = (id) =>
  prisma.inventoryAudit.findUnique({
    where: { id },
    include: { items: { orderBy: { productName: 'asc' } }, adjustments: { orderBy: { createdAt: 'asc' } } }
  });

// ─── GET /api/audit/stats — dashboard card (admin + warehouse) ───
const getAuditStats = async (req, res) => {
  try {
    const [pending, approved, rejected, inProgress, totalAdjustments, adjustments, lastAudit] = await Promise.all([
      prisma.inventoryAudit.count({ where: { status: 'SUBMITTED' } }),
      prisma.inventoryAudit.count({ where: { status: 'APPROVED' } }),
      prisma.inventoryAudit.count({ where: { status: 'REJECTED' } }),
      prisma.inventoryAudit.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.inventoryAdjustmentLog.count(),
      prisma.inventoryAdjustmentLog.findMany({ select: { difference: true, productName: true, color: true, size: true, createdAt: true } }),
      prisma.inventoryAudit.findFirst({ where: { status: 'APPROVED' }, orderBy: { approvedAt: 'desc' }, select: { approvedAt: true, auditNumber: true } })
    ]);

    let lossValue = 0, extraValue = 0;
    const productMap = {};
    for (const a of adjustments) {
      if (a.difference < 0) lossValue += Math.abs(a.difference);
      else if (a.difference > 0) extraValue += a.difference;
      const key = `${a.productName}|${a.color || ''}|${a.size || ''}`;
      if (!productMap[key]) productMap[key] = { productName: a.productName, color: a.color, size: a.size, totalDiff: 0, count: 0 };
      productMap[key].totalDiff += a.difference;
      productMap[key].count += 1;
    }
    const highestDifferenceProducts = Object.values(productMap)
      .sort((a, b) => Math.abs(b.totalDiff) - Math.abs(a.totalDiff))
      .slice(0, 5);

    const [whStatus, outletStatus] = await Promise.all([
      prisma.inventoryAudit.findFirst({ where: { type: 'WAREHOUSE' }, orderBy: { createdAt: 'desc' }, select: { status: true, auditNumber: true, createdAt: true } }),
      prisma.inventoryAudit.findFirst({ where: { type: 'OUTLET' }, orderBy: { createdAt: 'desc' }, select: { status: true, auditNumber: true, outletName: true, createdAt: true } })
    ]);

    res.json({
      pending, approved, rejected, inProgress,
      totalAdjustments, lossValue, extraValue,
      lastAudit: lastAudit ? { auditNumber: lastAudit.auditNumber, approvedAt: lastAudit.approvedAt } : null,
      highestDifferenceProducts,
      warehouseStatus: whStatus,
      outletStatus: outletStatus
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit stats', error: error.message });
  }
};

// ─── POST /api/audit — start new audit (snapshot) ───
const startAudit = async (req, res) => {
  try {
    const { type, outletName, notes } = req.body;
    const auditType = String(type || '').toUpperCase();
    if (!['WAREHOUSE', 'OUTLET'].includes(auditType)) {
      return res.status(400).json({ message: 'type must be WAREHOUSE or OUTLET' });
    }
    if (auditType === 'OUTLET' && !outletName) {
      return res.status(400).json({ message: 'outletName is required for OUTLET audit' });
    }

    // Only one in-progress audit of the same scope at a time
    const existing = await prisma.inventoryAudit.findFirst({
      where: auditType === 'OUTLET'
        ? { type: 'OUTLET', outletName, status: { in: ['IN_PROGRESS', 'SUBMITTED'] } }
        : { type: 'WAREHOUSE', status: { in: ['IN_PROGRESS', 'SUBMITTED'] } }
    });
    if (existing) {
      return res.status(400).json({ message: `An audit (${existing.auditNumber}) is already in progress for this scope` });
    }

    let snapshotItems = [];
    let totalStock = 0;

    if (auditType === 'WAREHOUSE') {
      const items = await prisma.inventoryItem.findMany({ where: {}, orderBy: { name: 'asc' } });
      for (const item of items) {
        const variants = parseVariants(item.variants);
        if (variants.length > 0) {
          for (const v of variants) {
            const stock = parseInt(v.stock) || 0;
            totalStock += stock;
            snapshotItems.push({
              kind: 'WAREHOUSE_VARIANT',
              productId: item.id,
              productName: item.name,
              color: v.color || null,
              size: v.size || null,
              barcode: generateBarcode(item.id, v.size || null, v.color || null),
              systemQty: stock,
              price: parseFloat(v.price) || parseFloat(item.price) || 0
            });
          }
        } else {
          totalStock += item.stock || 0;
          snapshotItems.push({
            kind: 'WAREHOUSE_VARIANT',
            productId: item.id,
            productName: item.name,
            color: item.color || null,
            size: item.size || null,
            barcode: generateBarcode(item.id, item.size || null, item.color || null),
            systemQty: item.stock || 0,
            price: parseFloat(item.price) || 0
          });
        }
      }
    } else {
      const records = await prisma.outletInventory.findMany({
        where: { outletName },
        orderBy: { name: 'asc' }
      });
      for (const r of records) {
        totalStock += r.stock || 0;
        snapshotItems.push({
          kind: 'OUTLET_VARIANT',
          productId: r.id,
          productName: r.name,
          color: r.color || null,
          size: r.size || null,
          barcode: r.barcode || null,
          systemQty: r.stock || 0,
          price: parseFloat(r.price) || 0
        });
      }
    }

    if (snapshotItems.length === 0) {
      return res.status(400).json({ message: 'No inventory variants found to audit' });
    }

    const audit = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryAudit.create({
        data: {
          auditNumber: await generateAuditNumber(),
          type: auditType,
          outletName: auditType === 'OUTLET' ? outletName : null,
          status: 'IN_PROGRESS',
          totalVariants: snapshotItems.length,
          totalStock,
          notes: notes || null,
          createdBy: req.user?.name || 'Warehouse',
          createdById: req.user?.id || null
        }
      });
      await tx.inventoryAuditItem.createMany({
        data: snapshotItems.map(si => ({ ...si, auditId: created.id }))
      });
      return created;
    }, { timeout: 30000 });

    const fresh = await loadAuditWithItems(audit.id);
    fresh.items = fresh.items.map(computeItemDiff);
    res.status(201).json(fresh);
  } catch (error) {
    res.status(500).json({ message: 'Error starting audit', error: error.message });
  }
};
// ─── GET /api/audit — list audits (history) ───
const listAudits = async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = String(type).toUpperCase();

    if (req.user?.role === 'OUTLET') {
      return res.status(403).json({ message: 'Outlet users cannot access audits' });
    }

    const audits = await prisma.inventoryAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(req.query.limit) || 100,
      select: {
        id: true, auditNumber: true, type: true, outletName: true, status: true,
        totalVariants: true, totalStock: true, scannedCount: true, totalScans: true, matchedCount: true,
        missingCount: true, extraCount: true, differenceValue: true,
        createdBy: true, submittedAt: true, approvedBy: true, approvedAt: true,
        rejectedBy: true, rejectedAt: true, rejectionReason: true, createdAt: true
      }
    });
    res.json(audits);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audits', error: error.message });
  }
};

// ─── GET /api/audit/:id — full audit with items ───
const getAudit = async (req, res) => {
  try {
    const audit = await loadAuditWithItems(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    const items = audit.items.map(computeItemDiff);
    res.json({ ...audit, items });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching audit', error: error.message });
  }
};

// ─── POST /api/audit/:id/scan — barcode scan → physicalQty +1 ───
const scanBarcode = async (req, res) => {
  try {
    const { barcode, itemId } = req.body;
    const audit = await prisma.inventoryAudit.findUnique({ where: { id: req.params.id } });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Audit is not in progress' });

    let item = null;
    if (itemId) {
      item = await prisma.inventoryAuditItem.findFirst({ where: { id: itemId, auditId: audit.id } });
    } else if (barcode) {
      item = await prisma.inventoryAuditItem.findFirst({
        where: { auditId: audit.id, barcode: { equals: String(barcode).trim(), mode: 'insensitive' } }
      });
    }
    if (!item) return res.status(404).json({ message: 'Variant not found in this audit' });

    const updated = await prisma.inventoryAuditItem.update({
      where: { id: item.id },
      data: { physicalQty: { increment: 1 }, scanCount: { increment: 1 }, scanned: true, lastScannedAt: new Date() }
    });

    await persistSummary(audit.id, await prisma.inventoryAuditItem.findMany({ where: { auditId: audit.id } }));

    const fresh = await loadAuditWithItems(audit.id);
    fresh.items = fresh.items.map(computeItemDiff);
    res.json({ item: computeItemDiff(updated), audit: fresh });
  } catch (error) {
    res.status(500).json({ message: 'Error scanning barcode', error: error.message });
  }
};

// ─── POST /api/audit/:id/batch-scan — high-speed batched scan + manual-qty ops ───
// Accepts an ordered array of operations, each either:
//   { op: 'scan', itemId } | { op: 'scan', barcode }   → physicalQty +1, scanCount +1
//   { op: 'set', itemId, qty }                          → physicalQty = qty (manual, no scanCount)
// Operations are replayed per item so scan increments build on top of manual sets in
// the exact order the operator made them, then each item is written ONCE (aggregated)
// inside a single transaction. The UI keeps its own in-memory copy and flushes batches
// in the background, so the operator never waits on the database.
const batchScan = async (req, res) => {
  try {
    const { ops, scans } = req.body;
    let operations = ops;
    if (!Array.isArray(operations) || operations.length === 0) {
      if (Array.isArray(scans)) operations = scans.map(s => ({ op: 'scan', itemId: s?.itemId, barcode: s?.barcode }));
    }
    if (!Array.isArray(operations) || operations.length === 0) return res.status(400).json({ message: 'ops or scans array is required' });
    if (operations.length > 300) return res.status(400).json({ message: 'Batch too large (max 300)' });

    const audit = await prisma.inventoryAudit.findUnique({ where: { id: req.params.id } });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Audit is not in progress' });

    const items = await prisma.inventoryAuditItem.findMany({ where: { auditId: audit.id } });
    const byBarcode = new Map(items.map(it => [String(it.barcode || '').trim().toLowerCase(), it]));
    const byId = new Map(items.map(it => [it.id, it]));

    const notFound = [];
    // Replay ops per item in order: a manual set fixes the absolute count, then any
    // subsequent scans add on top. Aggregated here so each item writes to the DB once.
    const groups = new Map();
    for (const op of operations) {
      if (!op) continue;
      let item = null;
      if (op.itemId) item = byId.get(op.itemId);
      else if (op.barcode) item = byBarcode.get(String(op.barcode).trim().toLowerCase());
      if (!item) { notFound.push(op.barcode || op.itemId || '?'); continue; }
      const g = groups.get(item.id) || { item, current: item.physicalQty || 0, newScans: 0 };
      if (op.op === 'set') {
        g.current = Math.max(0, parseInt(op.qty) || 0);
      } else {
        g.current += 1;
        g.newScans += 1;
      }
      groups.set(item.id, g);
    }

    const now = new Date();
    const synced = [];
    let summary = null;
    let after = [];
    await prisma.$transaction(async (tx) => {
      for (const [itemId, g] of groups) {
        const u = await tx.inventoryAuditItem.update({
          where: { id: itemId },
          data: {
            physicalQty: g.current,
            scanCount: { increment: g.newScans },
            scanned: true,
            ...(g.newScans > 0 ? { lastScannedAt: now } : {})
          }
        });
        synced.push({ id: u.id, physicalQty: u.physicalQty, scanCount: u.scanCount, systemQty: u.systemQty, scanned: true, op: g.newScans > 0 ? 'scan' : 'set' });
      }
      after = await tx.inventoryAuditItem.findMany({ where: { auditId: audit.id } });
      summary = await persistSummary(audit.id, after, tx);
    }, { timeout: 30000 });

    let item = null;
    if (synced.length > 0) {
      const last = synced[synced.length - 1];
      const base = items.find(it => it.id === last.id);
      if (base) item = computeItemDiff({ ...base, physicalQty: last.physicalQty, scanCount: last.scanCount, scanned: true });
    }

    res.json({ processed: synced.length, notFound, summary, synced, item });
  } catch (error) {
    res.status(500).json({ message: 'Error in batch scan', error: error.message });
  }
};

// ─── POST /api/audit/:id/items/:itemId — manual physical qty ───
const setPhysicalQty = async (req, res) => {
  try {
    const { physicalQty } = req.body;
    const audit = await prisma.inventoryAudit.findUnique({ where: { id: req.params.id } });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Audit is not in progress' });

    const qty = Math.max(0, parseInt(physicalQty) || 0);
    await prisma.inventoryAuditItem.update({
      where: { id: req.params.itemId },
      data: { physicalQty: qty, scanned: true }
    });

    await persistSummary(audit.id, await prisma.inventoryAuditItem.findMany({ where: { auditId: audit.id } }));

    const fresh = await loadAuditWithItems(audit.id);
    fresh.items = fresh.items.map(computeItemDiff);
    res.json(fresh);
  } catch (error) {
    res.status(500).json({ message: 'Error setting physical quantity', error: error.message });
  }
};

// ─── POST /api/audit/:id/submit — audit becomes read-only ───
const submitAudit = async (req, res) => {
  try {
    const audit = await prisma.inventoryAudit.findUnique({ where: { id: req.params.id } });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Audit already submitted' });

    // Authoritative final physical counts from the client — guarantees the exact
    // scanned state lands in the DB even if a background batch sync was dropped.
    // Applied as a SINGLE parametrized SQL statement (CASE WHEN per id) — per-item
    // UPDATEs through the Supabase pooler cost ~0.5-0.8s each, so 180+ items blew
    // Prisma's 5s default AND Vercel's function cap (batch transactions still
    // execute serially over the pooler). One statement = one round trip.
    // Prisma binds JS-string params as TEXT, so the uuid column is cast to text for
    // comparison (`"id"::text`) — casting the PARAMETER (`$1::uuid`) does NOT work
    // (verified live: `text = uuid` operator error regardless of the param cast).
    const finalCounts = req.body?.finalCounts;
    if (finalCounts && typeof finalCounts === 'object' && Object.keys(finalCounts).length > 0) {
      const ids = Object.keys(finalCounts);
      const whens = ids.map(id => {
        const qty = Math.max(0, parseInt(finalCounts[id]) || 0);
        return Prisma.sql`WHEN ${id} THEN ${qty}`;
      });
      const idList = ids.map(id => Prisma.sql`${id}`);
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "InventoryAuditItem"
        SET "physicalQty" = CASE "id"::text ${Prisma.join(whens, ' ')} ELSE "physicalQty" END,
            "scanned" = true,
            "updatedAt" = now()
        WHERE "id"::text IN (${Prisma.join(idList, ',')})
          AND "auditId"::text = ${audit.id}
      `);
    }

    // Single fetch used for both summary computation and the response — a second
    // full fetch of a large audit pushed the function past Vercel's 30s cap.
    const items = await prisma.inventoryAuditItem.findMany({
      where: { auditId: audit.id },
      orderBy: { productName: 'asc' }
    });
    const summary = computeAuditSummary(items);

    const updated = await prisma.inventoryAudit.update({
      where: { id: audit.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        scannedCount: summary.scannedCount,
        totalScans: summary.totalScans,
        matchedCount: summary.matchedCount,
        missingCount: summary.missingCount,
        extraCount: summary.extraCount,
        differenceValue: summary.differenceValue,
        summary
      }
    });

    res.json({ ...updated, items: items.map(computeItemDiff), adjustments: [] });

    const io = req.app.get('io');
    io.emit('audit-updated', { auditId: audit.id, status: 'SUBMITTED' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting audit', error: error.message });
  }
};

// ─── POST /api/audit/:id/approve — apply adjustments + logs (Admin only) ───
const approveAudit = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Admin can approve audits' });
    }
    const audit = await prisma.inventoryAudit.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'SUBMITTED') return res.status(400).json({ message: 'Only submitted audits can be approved' });

    const items = audit.items.map(computeItemDiff);
    const changed = items.filter(i => i.difference !== 0);
    const adjustments = [];

    // Build ALL adjustments + in-memory inventory targets FIRST (no per-item DB
    // writes). The Supabase pooler makes each UPDATE ~0.5-0.8s, so hundreds of
    // diffs blew Prisma's 30s transaction timeout on large audits (reproduced:
    // AUD-0007 "Transaction API error: Transaction not found" at ~33s).
    // Inventory is applied below via ONE raw SQL statement per table.
    const outletIds = [];
    const outletWhens = [];
    const storeByProduct = new Map();

    for (const item of changed) {
      const newQty = Math.max(0, item.physicalQty || 0);
      adjustments.push({
        auditId: audit.id,
        auditNumber: audit.auditNumber,
        type: audit.type,
        location: audit.type === 'OUTLET' ? (audit.outletName || 'Outlet') : 'Warehouse',
        productId: item.productId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        barcode: item.barcode,
        previousQty: item.systemQty,
        newQty,
        difference: item.difference,
        approvedBy: req.user?.name || 'Admin'
      });

      if (item.kind === 'OUTLET_VARIANT') {
        outletIds.push(item.productId);
        outletWhens.push(Prisma.sql`WHEN ${item.productId} THEN ${newQty}`);
      } else {
        if (!storeByProduct.has(item.productId)) storeByProduct.set(item.productId, []);
        storeByProduct.get(item.productId).push(item);
      }
    }

    // Group store (InventoryItem) changes per product so all variant edits for
    // one product accumulate onto the SAME variants array before the SQL WHENs
    // are built (CASE returns the first matching WHEN, so duplicates would win).
    const storeVariantEntries = [];
    const storeFlatEntries = [];
    if (storeByProduct.size > 0) {
      const storeRows = await prisma.inventoryItem.findMany({ where: { id: { in: [...storeByProduct.keys()] } } });
      const byId = new Map(storeRows.map(s => [s.id, s]));
      for (const [pid, itemList] of storeByProduct) {
        const storeItem = byId.get(pid);
        if (!storeItem) continue;
        const variants = parseVariants(storeItem.variants);
        if (variants.length > 0) {
          let variantChanged = false;
          for (const it of itemList) {
            const newQty = Math.max(0, it.physicalQty || 0);
            const idx = variants.findIndex(v =>
              (v.color || null) === (it.color || null) && (v.size || null) === (it.size || null)
            );
            if (idx >= 0) {
              variants[idx] = { ...variants[idx], stock: newQty };
              variantChanged = true;
            } else if (newQty > 0) {
              variants.push({ color: it.color || null, size: it.size || null, stock: newQty, price: it.price || storeItem.price || 0 });
              variantChanged = true;
            }
          }
          if (variantChanged) {
            storeVariantEntries.push({
              pid,
              variants,
              stock: variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
            });
          }
        } else {
          storeFlatEntries.push({ pid, stock: Math.max(0, itemList[itemList.length - 1].physicalQty || 0) });
        }
      }
    }

    // One interactive transaction with only 2-4 fast statements (single round
    // trip each) — atomic, and far under the 30s pooler headroom.
    await prisma.$transaction(async (tx) => {
      if (outletWhens.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "OutletInventory"
          SET "stock" = CASE "id"::text ${Prisma.join(outletWhens, ' ')} ELSE "stock" END
          WHERE "id"::text IN (${Prisma.join(outletIds, ',')})
        `);
      }
      if (storeVariantEntries.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "InventoryItem"
          SET "variants" = CASE "id"::text ${Prisma.join(storeVariantEntries.map(e => Prisma.sql`WHEN ${e.pid} THEN ${JSON.stringify(e.variants)}::jsonb`), ' ')} ELSE "variants" END,
              "stock" = CASE "id"::text ${Prisma.join(storeVariantEntries.map(e => Prisma.sql`WHEN ${e.pid} THEN ${e.stock}`), ' ')} ELSE "stock" END
          WHERE "id"::text IN (${Prisma.join(storeVariantEntries.map(e => e.pid), ',')})
        `);
      }
      if (storeFlatEntries.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "InventoryItem"
          SET "stock" = CASE "id"::text ${Prisma.join(storeFlatEntries.map(e => Prisma.sql`WHEN ${e.pid} THEN ${e.stock}`), ' ')} ELSE "stock" END
          WHERE "id"::text IN (${Prisma.join(storeFlatEntries.map(e => e.pid), ',')})
        `);
      }
      await tx.inventoryAudit.update({
        where: { id: audit.id },
        data: { status: 'APPROVED', approvedBy: req.user?.name || 'Admin', approvedAt: new Date() }
      });
      if (adjustments.length > 0) {
        await tx.inventoryAdjustmentLog.createMany({ data: adjustments });
        await tx.inventoryAudit.update({
          where: { id: audit.id },
          data: { summary: { ...(audit.summary || {}), appliedAdjustments: adjustments.length } }
        });
      }
    }, { timeout: 30000 });

    const [updatedAudit] = await prisma.$transaction([
      prisma.inventoryAudit.update({
        where: { id: audit.id },
        data: { status: 'APPROVED', approvedBy: req.user?.name || 'Admin', approvedAt: new Date() }
      }),
      ...(adjustments.length > 0
        ? [prisma.inventoryAdjustmentLog.createMany({ data: adjustments })]
        : []),
      ...(adjustments.length > 0
        ? [prisma.inventoryAudit.update({
            where: { id: audit.id },
            data: { summary: { ...(audit.summary || {}), appliedAdjustments: adjustments.length } }
          })]
        : [])
    ]);

    // Invalidate inventory caches so POS/warehouse reflect the new quantities
    cache.delPattern('warehouse:');
    cache.delPattern('products:');

    const io = req.app.get('io');
    io.emit('audit-updated', { auditId: audit.id, status: 'APPROVED', adjustments: adjustments.length });
    io.emit('inventory-updated', { audit: true });

    res.json({ message: `Audit approved — ${adjustments.length} adjustment(s) applied`, adjustments: adjustments.length, audit: await loadAuditWithItems(audit.id) });
  } catch (error) {
    res.status(500).json({ message: 'Error approving audit', error: error.message });
  }
};

// ─── POST /api/audit/:id/reject — Admin only ───
const rejectAudit = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Admin can reject audits' });
    }
    const audit = await prisma.inventoryAudit.findUnique({ where: { id: req.params.id } });
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'SUBMITTED') return res.status(400).json({ message: 'Only submitted audits can be rejected' });

    const updated = await prisma.inventoryAudit.update({
      where: { id: audit.id },
      data: {
        status: 'REJECTED',
        rejectedBy: req.user?.name || 'Admin',
        rejectedAt: new Date(),
        rejectionReason: req.body?.reason || null
      }
    });

    const io = req.app.get('io');
    io.emit('audit-updated', { auditId: audit.id, status: 'REJECTED' });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting audit', error: error.message });
  }
};

module.exports = {
  getAuditStats,
  startAudit,
  listAudits,
  getAudit,
  scanBarcode,
  batchScan,
  setPhysicalQty,
  submitAudit,
  approveAudit,
  rejectAudit
};
