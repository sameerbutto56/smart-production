const prisma = require('../prisma');
const cache = require('../utils/cache');

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

    const updated = await prisma.outletDemandRequest.update({
      where: { id },
      data: updateData
    });

    await prisma.auditLog.create({
      data: {
        orderId: null,
        action: 'DEMAND_REQUEST_' + status,
        details: `Demand request ${id} from ${existing.outletName} ${status.toLowerCase()} by ${req.user.name || req.user.id}`,
        performedBy: req.user.id
      }
    });

    res.json(updated);
  } catch (error) {
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

const deductWarehouseStock = async (inventoryItemId, color, size, qty) => {
  const inv = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!inv) return false;

  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    // Find matching variant in variants JSON
    const variants = inv.variants.map(v => {
      if (v.color === (color || null) && v.size === (size || null)) {
        return { ...v, stock: Math.max(0, (v.stock || 0) - qty) };
      }
      return v;
    });
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        variants,
        stock: { decrement: qty } // also decrement total stock
      }
    });
  } else {
    // Simple stock field
    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { stock: { decrement: qty } }
    });
  }
  return true;
};

const acceptDemandRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.outletDemandRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Demand request not found' });
    if (existing.status !== 'APPROVED' && existing.status !== 'PARTIALLY_APPROVED') {
      return res.status(400).json({ message: `Cannot accept a ${existing.status.toLowerCase()} request. Only approved/partially approved requests can be accepted.` });
    }
    if (existing.acceptedAt) {
      return res.status(400).json({ message: 'Already accepted. Cannot accept again.' });
    }

    // Mark accepted immediately so the button won't re-trigger
    await prisma.outletDemandRequest.update({
      where: { id },
      data: { acceptedAt: new Date(), acceptedById: req.user.id }
    });

    res.json({ message: 'Demand accepted. Processing items in background.' });

    // Process items asynchronously (respond first to avoid 504 timeout)
    setImmediate(async () => {
      try {
        const items = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items;
        const results = [];

        for (const it of items) {
          if (!it.approvedQty || it.approvedQty <= 0) continue;

          let inv = null;
          if (it.inventoryItemId) {
            inv = await prisma.inventoryItem.findUnique({ where: { id: it.inventoryItemId } });
          }
          if (!inv) {
            const invItems = await prisma.inventoryItem.findMany({
              where: { name: { contains: it.productName, mode: 'insensitive' } }
            });
            inv = invItems[0] || null;
          }
          if (!inv) {
            results.push({ productName: it.productName, status: 'SKIPPED', reason: 'No warehouse product found' });
            continue;
          }

          let oi = await prisma.outletInventory.findFirst({
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
            while (await prisma.outletInventory.findFirst({ where: { barcode: bc, outletName: existing.outletName } })) {
              a++;
              bc = generateBarcode(inv.id, it.size, it.color, a);
            }
            await prisma.outletInventory.create({
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
            await prisma.outletInventory.update({
              where: { id: oi.id },
              data: { stock: { increment: parseInt(it.approvedQty) || 0 } }
            });
          }

          await deductWarehouseStock(inv.id, it.color || null, it.size || null, parseInt(it.approvedQty) || 0);
          results.push({
            productName: it.productName,
            color: it.color,
            size: it.size,
            status: 'ACCEPTED',
            qty: it.approvedQty
          });
        }

        await prisma.auditLog.create({
          data: {
            orderId: null,
            action: 'DEMAND_REQUEST_ACCEPTED',
            details: `Demand request ${id} (${existing.transferNumber || ''}) from ${existing.outletName} accepted — ${results.length} items processed, warehouse deducted`,
            performedBy: req.user.id
          }
        });

        cache.delPattern('pos:');
        console.log(`Demand ${id} background processing complete: ${results.length} items`);
      } catch (bgErr) {
        console.error('Background demand processing error:', bgErr);
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting demand request', error: error.message });
  }
};

module.exports = { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, acceptDemandRequest, getInventoryForOutlet, getDemandStats };