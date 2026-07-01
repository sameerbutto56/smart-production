const prisma = require('../prisma');

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
          productName: i.productName,
          size: i.size || '',
          color: i.color || '',
          requestedQty: parseInt(i.requestedQty) || 1,
          approvedQty: 0
        })),
        notes: notes || '',
        status: 'PENDING'
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
    const { search } = req.query;
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
    let filtered = items;
    if (search) {
      const q = search.toLowerCase();
      filtered = items.filter(r =>
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

    const items = typeof existing.items === 'string' ? JSON.parse(existing.items) : existing.items;
    const results = [];

    for (const it of items) {
      if (!it.approvedQty || it.approvedQty <= 0) continue;
      // Find the inventory item by product name
      const invItems = await prisma.inventoryItem.findMany({
        where: { name: { contains: it.productName, mode: 'insensitive' } },
        include: { outletVariants: true }
      });
      if (invItems.length === 0) {
        results.push({ productName: it.productName, status: 'SKIPPED', reason: 'No warehouse product found' });
        continue;
      }
      const inv = invItems[0];

      // Find or create the matching OutletVariant
      let ov = inv.outletVariants.find(o => o.color === (it.color || null) && o.size === (it.size || null));
      if (!ov) {
        let barcode = generateBarcode(inv.id, it.size, it.color);
        let attempt = 0;
        // Need generateBarcode from pos.controller — redefine locally
        const genBarcode = (itemId, size, color, attempt = 0) => {
          const prefix = 'POS';
          const raw = itemId.replace(/-/g, '').slice(0, 8);
          const base = ((parseInt(raw, 16) || 0) + (size ? size.charCodeAt(0) : 0) + (color ? color.charCodeAt(0) : 0)).toString(36).toUpperCase().slice(0, 6);
          const suf = `${size ? size[0] || 'X' : 'X'}${color ? color[0] || 'X' : 'X'}`;
          return `${prefix}${base}${suf}${attempt > 0 ? attempt : ''}`;
        };
        let bc = genBarcode(inv.id, it.size, it.color);
        let a = 0;
        while (await prisma.outletVariant.findUnique({ where: { barcode: bc } })) {
          a++;
          bc = genBarcode(inv.id, it.size, it.color, a);
        }
        ov = await prisma.outletVariant.create({
          data: {
            inventoryItemId: inv.id,
            color: it.color || null,
            size: it.size || null,
            barcode: bc,
            stock: parseInt(it.approvedQty) || 0,
            isActive: true
          }
        });
        results.push({ productName: it.productName, color: it.color, size: it.size, status: 'CREATED', qty: it.approvedQty });
      } else {
        // Add stock to existing variant
        await prisma.outletVariant.update({
          where: { id: ov.id },
          data: { stock: { increment: parseInt(it.approvedQty) || 0 } }
        });
        results.push({ productName: it.productName, color: it.color, size: it.size, status: 'UPDATED', qty: it.approvedQty });
      }
    }

    // Mark demand as accepted
    await prisma.outletDemandRequest.update({
      where: { id },
      data: { acceptedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        orderId: null,
        action: 'DEMAND_REQUEST_ACCEPTED',
        details: `Demand request ${id} from ${existing.outletName} accepted by outlet — ${results.length} items processed`,
        performedBy: req.user.id
      }
    });

    res.json({ message: 'Demand accepted and stock added to outlet inventory', results });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting demand request', error: error.message });
  }
};

module.exports = { createDemandRequest, getMyDemandRequests, getAllDemandRequests, approveDemandRequest, acceptDemandRequest, getInventoryForOutlet, getDemandStats };