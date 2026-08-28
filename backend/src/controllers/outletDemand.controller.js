const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');

const generateTransferNumber = async () => {
  const d = new Date();
  const dayPrefix = `TRF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const last = await prisma.outletDemandRequest.findFirst({
    where: { transferNumber: { startsWith: dayPrefix } },
    orderBy: { transferNumber: 'desc' },
    select: { transferNumber: true }
  });
  let nextNum = 1;
  if (last) {
    const parts = last.transferNumber.split('-');
    nextNum = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `${dayPrefix}-${String(nextNum).padStart(5, '0')}`;
};

const createDemandRequest = async (req, res) => {
  try {
    const { items, notes } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const outletName = req.user?.outletName ||
      (req.user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
       req.user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
       req.user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : req.user?.name || 'Outlet');

    const demand = await prisma.outletDemandRequest.create({
      data: {
        outletId: req.user.id,
        outletName,
        items: items.map(i => ({
          inventoryItemId: i.inventoryItemId || null,
          productName: i.productName,
          size: i.size || '',
          color: i.color || '',
          requestedQty: parseInt(i.requestedQty) || 1,
          approvedQty: 0
        })),
        notes: notes || '',
        status: 'PENDING',
        transferNumber: await generateTransferNumber()
      }
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('demand:new', {
        id: demand.id,
        outletName: demand.outletName,
        transferNumber: demand.transferNumber,
        status: demand.status,
        itemCount: items.length,
        createdAt: demand.createdAt
      });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Warehouse', path: '/warehouse', role: 'STORE', title: 'New Demand Request', message: `Demand from ${outletName}`, action: 'Demand Created', employeeName: req.user?.name }).catch(() => {});

    res.status(201).json(demand);
  } catch (error) {
    res.status(500).json({ message: 'Error creating demand request', error: error.message });
  }
};

const getMyDemandRequests = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const demands = await prisma.outletDemandRequest.findMany({
      where: { outletId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(demands);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand requests', error: error.message });
  }
};

const getAllDemandRequests = async (req, res) => {
  try {
    const { status, outletName } = req.query;
    const where = {};
    if (status) where.status = status;
    if (outletName) where.outletName = { contains: outletName, mode: 'insensitive' };
    const limit = parseInt(req.query.limit) || 200;
    const demands = await prisma.outletDemandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    res.json(demands);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand requests', error: error.message });
  }
};

const approveDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items, storeNotes } = req.body;
    const validStatuses = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: `Already ${existing.status.toLowerCase()}. Cannot modify.` });
    }

    const updateData = { status, storeNotes: storeNotes || '', approvedById: req.user.id };

    if (status === 'REJECTED') {
      updateData.items = existing.items.map(i => ({ ...i, approvedQty: 0 }));
    } else if (status === 'APPROVED' && items) {
      updateData.items = items.map(i => ({
        ...i,
        approvedQty: i.approvedQty !== undefined ? i.approvedQty : i.requestedQty
      }));
    } else if (status === 'PARTIALLY_APPROVED' && items) {
      updateData.items = items.map(i => ({
        ...i,
        approvedQty: i.approvedQty !== undefined ? i.approvedQty : 0
      }));
    } else if (status === 'APPROVED') {
      updateData.items = existing.items.map(i => ({ ...i, approvedQty: i.requestedQty }));
    }

    if (status !== 'REJECTED') {
      updateData.approvedAt = new Date();
    }

    // Atomic approval: status update + warehouse deduction + audit log in ONE
    // transaction. Previously the status was updated first and the deduction loop
    // ran outside a transaction — a mid-loop DB failure left the demand APPROVED
    // with a partial deduction and no audit log (retry was then blocked by the
    // PENDING-only guard). The in-transaction PENDING re-check also closes the
    // race where two concurrent approvals both passed the outer guard.
    let updated;
    let deductedCount = 0;
    let deductedSummary = [];

    await prisma.$transaction(async (tx) => {
      const existingNow = await tx.outletDemandRequest.findUnique({ where: { id } });
      if (!existingNow || existingNow.status !== 'PENDING') {
        const err = new Error('Demand request is no longer pending. Cannot approve.');
        err.code = 'DEMAND_NOT_PENDING';
        throw err;
      }

      updated = await tx.outletDemandRequest.update({
        where: { id },
        data: updateData
      });

      // Deduct approved quantities from live warehouse inventory immediately
      // (APPROVED / PARTIALLY_APPROVED). Stock is taken out the moment the demand
      // is approved so dashboard/reports always reflect actual available stock.
      if (status !== 'REJECTED') {
        for (const item of updated.items || []) {
          const approvedQty = parseInt(item.approvedQty) || 0;
          if (approvedQty <= 0) continue;
          const deducted = await deductWarehouseStock(item.inventoryItemId, item.color, item.size, approvedQty, tx);
          if (deducted > 0) {
            deductedCount++;
            deductedSummary.push(`${item.productName}${item.size ? ' ' + item.size : ''}: ${deducted}`);
          }
        }
      }

      await tx.auditLog.create({
        data: {
          orderId: null,
          action: 'DEMAND_REQUEST_' + status,
          details: `Demand request ${id} from ${existing.outletName} ${status.toLowerCase()} by ${req.user.name || req.user.id}${deductedCount ? ` | warehouse stock deducted: ${deductedSummary.join(', ')}` : ''}`,
          performedBy: req.user.id
        }
      });
    }, { timeout: 30000 });

    // Force inventory-dependent caches to rebuild immediately (synchronous — no .catch()).
    if (status !== 'REJECTED') {
      try {
        cache.delPattern('pos:');
        cache.delPattern('warehouse:');
        cache.delPattern('products:');
      } catch (cacheErr) {
        console.error('Cache invalidation error after demand approval:', cacheErr);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('demand:updated', {
        id: updated.id,
        outletName: updated.outletName,
        transferNumber: updated.transferNumber,
        status: updated.status,
        storeNotes: updated.storeNotes
      });
      if (deductedCount) io.emit('inventory-updated', { source: 'demand-approval', demandId: id });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Outlet Requests', path: '/outlet-requests', role: 'OUTLET', title: 'Demand Updated', message: `Demand #${existing.transferNumber} ${status}`, action: `Demand ${status}`, employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    if (error.code === 'DEMAND_NOT_PENDING') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating demand request', error: error.message });
  }
};

const getInventoryForOutlet = async (req, res) => {
  try {
    const { search, outletName: queryOutlet } = req.query;
    const outletName = queryOutlet || req.user?.outletName || '';
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        size: true,
        fabric: true,
        variants: true
      }
    });
    let outletStockMap = {};
    if (outletName) {
      const outletItems = await prisma.outletInventory.findMany({
        where: { outletName }
      });
      for (const oi of outletItems) {
        const key = `${oi.name}|${oi.color || ''}|${oi.size || ''}`;
        outletStockMap[key] = oi;
      }
    }
    const merged = items.map(item => {
      const key = `${item.name}|${item.color || ''}|${item.size || ''}`;
      const outletData = outletStockMap[key];
      return {
        ...item,
        outletStock: outletData ? outletData.stock : 0,
        outletBarcode: outletData ? outletData.barcode : null,
        outletPrice: outletData ? outletData.price : null,
        outletInventoryId: outletData ? outletData.id : null,
        inOutlet: !!outletData
      };
    });
    let filtered = merged;
    if (search) {
      const q = search.toLowerCase();
      filtered = merged.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.color?.toLowerCase().includes(q)
      );
    }
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

const getDemandStats = async (req, res) => {
  try {
    const [pending, approved, partially, rejected, total] = await Promise.all([
      prisma.outletDemandRequest.count({ where: { status: 'PENDING' } }),
      prisma.outletDemandRequest.count({ where: { status: 'APPROVED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'PARTIALLY_APPROVED' } }),
      prisma.outletDemandRequest.count({ where: { status: 'REJECTED' } }),
      prisma.outletDemandRequest.count()
    ]);
    res.json({ pending, approved, partiallyApproved: partially, rejected, total });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand stats', error: error.message });
  }
};

const djb2 = (s) => {
  if (!s) return 0;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};
const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'POS';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|${attempt}`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

const deductWarehouseStock = async (inventoryItemId, color, size, qty, tx) => {
  if (!inventoryItemId || !qty || qty <= 0) return false;
  const client = tx || prisma;
  const inv = await client.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!inv) return false;

  let deductedQty = 0;

  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    // Find the matching variant in variants JSON (case-insensitive, empty color/size = any)
    let found = false;
    const variants = inv.variants.map(v => {
      if (found) return v;
      const matchColor = !color || (v.color || '').toString().toLowerCase() === String(color).toLowerCase();
      const matchSize = !size || (v.size || '').toString().toLowerCase() === String(size).toLowerCase();
      if (!matchColor || !matchSize) return v;
      const deduct = Math.min(qty, v.stock || 0);
      if (deduct <= 0) return v;
      found = true;
      deductedQty = deduct;
      return { ...v, stock: (v.stock || 0) - deduct };
    });
    if (found) {
      // Recompute total stock from variants so Dashboard/Reports always stay consistent
      const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
      await client.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { variants, stock: newTotal }
      });
    }
  } else {
    // Simple stock field — clamp so stock never goes negative
    deductedQty = Math.min(qty, inv.stock || 0);
    await client.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { stock: { decrement: deductedQty } }
    });
  }
  return deductedQty;
};

const acceptDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {
      return res.status(400).json({ message: `Cannot accept a ${existing.status.toLowerCase()} request. Only approved/partially approved requests can be accepted.` });
    }

    let results = [];
    let transferNumber = existing.transferNumber;
    let outletName = existing.outletName;

    // Atomic accept: claim (acceptedAt null -> set) + outlet-inventory additions + audit
    // log in ONE transaction, with an in-tx conditional re-check so two concurrent
    // accepts (e.g. a double-click / simultaneous API calls) can NEVER both apply.
    // Previously the acceptedAt guard + write happened first and the actual inventory
    // additions ran asynchronously in setImmediate OUTSIDE the guard — so a double click
    // could pass the guard twice and both background blocks would increment outlet POS
    // stock twice. setImmediate also risked Vercel terminating the function (no guarantee
    // background work after res.json() completes). 30s tx fits within maxDuration=60.
    try {
      await prisma.$transaction(async (tx) => {
        // Idempotency/claim: only one caller can flip acceptedAt null -> set.
        const claim = await tx.outletDemandRequest.updateMany({
          where: { id, acceptedAt: null },
          data: { acceptedAt: new Date(), acceptedById: req.user.id }
        });
        if (claim.count === 0) {
          const err = new Error('This demand has already been accepted.');
          err.code = 'DEMAND_ALREADY_ACCEPTED';
          throw err;
        }

        const items = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items;

        for (const it of items) {
          if (!it.approvedQty || it.approvedQty <= 0) continue;

          let inv = null;
          if (it.inventoryItemId) {
            inv = await tx.inventoryItem.findUnique({ where: { id: it.inventoryItemId } });
          }
          if (!inv) {
            const invItems = await tx.inventoryItem.findMany({
              where: { name: { contains: it.productName, mode: 'insensitive' } }
            });
            inv = invItems[0] || null;
          }
          if (!inv) {
            results.push({ productName: it.productName, status: 'SKIPPED', reason: 'No warehouse product found' });
            continue;
          }

          let oi = await tx.outletInventory.findFirst({
            where: {
              outletName: existing.outletName,
              name: inv.name,
              category: inv.category,
              color: it.color || null,
              size: it.size || null
            }
          });
          if (!oi) {
            let bc = generateBarcode(inv.id, it.size, it.color);
            let a = 0;
            while (await tx.outletInventory.findFirst({ where: { barcode: bc, outletName: existing.outletName } })) {
              a++;
              bc = generateBarcode(inv.id, it.size, it.color, a);
            }
            await tx.outletInventory.create({
              data: {
                outletName: existing.outletName,
                name: inv.name,
                category: inv.category || '',
                color: it.color || null,
                size: it.size || null,
                fabric: inv.fabric || null,
                barcode: bc,
                stock: parseInt(it.approvedQty) || 0,
                price: null,
                metadata: JSON.stringify({ sourceStoreItemId: inv.id })
              }
            });
          } else {
            await tx.outletInventory.update({
              where: { id: oi.id },
              data: { stock: { increment: parseInt(it.approvedQty) || 0 } }
            });
          }

          results.push({
            productName: it.productName,
            color: it.color,
            size: it.size,
            status: 'ACCEPTED',
            qty: it.approvedQty
          });
        }

        await tx.auditLog.create({
          data: {
            orderId: null,
            action: 'DEMAND_REQUEST_ACCEPTED',
            details: `Demand request ${id} (${existing.transferNumber || ''}) from ${existing.outletName} accepted — ${results.length} items added to outlet inventory`,
            performedBy: req.user.id
          }
        });
      }, { timeout: 30000 });
    } catch (txErr) {
      if (txErr.code === 'DEMAND_ALREADY_ACCEPTED') {
        return res.status(409).json({ message: txErr.message });
      }
      throw txErr;
    }

    // Cache + socket + notify stay outside the transaction (fail-soft).
    try {
      cache.delPattern('pos:');
    } catch (cacheErr) {
      console.error('Cache invalidation error after demand accept:', cacheErr);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('demand:accepted', {
        id,
        outletName,
        transferNumber,
        status: existing.status
      });
      io.emit('inventory-updated', { source: 'demand-accept', demandId: id });
    }

    await notify.create(req, { type: 'demand', moduleName: 'Inventory View', path: '/outlet-requests', role: 'STORE', title: 'Demand Accepted', message: `Demand #${existing.transferNumber} accepted — ${results.length} items added to outlet inventory`, action: 'Demand Accepted', employeeName: req.user?.name }).catch(() => {});

    console.log(`Demand ${id} accepted: ${results.length} items added to outlet inventory`);
    res.json({ message: 'Demand accepted.', accepted: results.length, items: results });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting demand request', error: error.message });
  }
};

module.exports = { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, acceptDemandRequest, getInventoryForOutlet, getDemandStats };