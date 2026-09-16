const prisma = require('../prisma');
const notify = require('../utils/notify');

// ════════════════════════════════════════════════════════════════════════════
// OFFICE SUPPLY — completely isolated from Warehouse / POS / Product Inventory.
// Two workflows:
//   (A) Outlet demand -> Store approve -> Transfer -> Outlet accept
//   (B) Direct Store transfer (no demand)
// All stock-changing operations run inside Prisma transactions.
// ════════════════════════════════════════════════════════════════════════════

const STORE_ROLES = ['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN'];
const OUTLET_ROLES = ['OUTLET', 'FAISAL', 'SUPER_ADMIN', 'ADMIN'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// Resolve the acting outlet from the logged-in user name (matches inDispatch pattern).
function getOutletName(user) {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'FAISAL') return 'Faisal';
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('faisal')) return 'Faisal';
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return 'Johar Town';
}

// Atomic per-year document numbering (mirrors vendor.nextSequence).
async function nextDocNumber(db, prefix) {
  const year = new Date().getFullYear();
  const row = await db.officeSupplySequence.upsert({
    where: { prefix_year: { prefix, year } },
    create: { prefix, year, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
  });
  const current = await db.officeSupplySequence.findUnique({
    where: { prefix_year: { prefix, year } },
  });
  const d = new Date();
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  return `${prefix}-${ymd}-${String(current.nextValue - 1).padStart(5, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCTS  (Store maintains the product master; outlets only read names/units)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/office-supply/products?search=&includeInactive=
const getProducts = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = req.user?.role;
    const includeInactive = ADMIN_ROLES.includes(role) ? String(req.query.includeInactive) === 'true' : false;
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const products = await prisma.officeSupplyProduct.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        stock: { orderBy: { location: 'asc' } },
      },
    });
    return res.json({ products });
  } catch (error) {
    console.error('officeSupply getProducts error:', error);
    return res.status(500).json({ message: 'Failed to load products' });
  }
};

// POST /api/office-supply/products
const createProduct = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can manage office supply products' });
    }
    const { name, sku, unit, description, initialStock } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    const initialQty = Math.max(0, parseInt(initialStock, 10) || 0);

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.officeSupplyProduct.create({
        data: {
          name: String(name).trim(),
          sku: sku ? String(sku).trim() : null,
          unit: unit || 'Pcs',
          description: description ? String(description) : null,
        },
      });

      if (initialQty > 0) {
        const stock = await tx.officeSupplyStock.create({
          data: {
            productId: p.id,
            location: 'STORE',
            locationType: 'STORE',
            quantity: initialQty,
          },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId: p.id,
            stockId: stock.id,
            fromLocation: null,
            toLocation: 'STORE',
            movementType: 'ADD',
            quantity: initialQty,
            referenceType: 'INITIAL_STOCK',
            notes: 'Initial stock on product creation',
            performedBy: req.user?.name || 'Store',
          },
        });
      }

      return p;
    });

    return res.status(201).json({ product });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ message: 'A product with this SKU already exists' });
    }
    console.error('officeSupply createProduct error:', error);
    return res.status(500).json({ message: 'Failed to create product' });
  }
};

// PATCH /api/office-supply/products/:id
const updateProduct = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can manage office supply products' });
    }
    const { id } = req.params;
    const { name, sku, unit, description, isActive, quantity } = req.body || {};
    const existing = await prisma.officeSupplyProduct.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.officeSupplyProduct.update({
        where: { id },
        data: {
          name: name !== undefined && String(name).trim() ? String(name).trim() : existing.name,
          sku: sku !== undefined ? (String(sku).trim() || null) : existing.sku,
          unit: unit !== undefined ? (unit || 'Pcs') : existing.unit,
          description: description !== undefined ? (description ? String(description) : null) : existing.description,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        },
      });

      if (quantity !== undefined && quantity !== null && String(quantity).trim() !== '') {
        const qty = Math.max(0, parseInt(quantity, 10) || 0);
        const location = 'STORE';
        const currentRow = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId: id, location } },
        });
        const prevQty = currentRow ? currentRow.quantity : 0;
        if (!currentRow || currentRow.quantity !== qty) {
          const stockRow = await tx.officeSupplyStock.upsert({
            where: { productId_location: { productId: id, location } },
            create: { productId: id, location, locationType: 'STORE', quantity: qty },
            update: { quantity: qty },
          });
          await tx.officeSupplyStockMovement.create({
            data: {
              productId: id,
              stockId: stockRow.id,
              fromLocation: location,
              toLocation: location,
              movementType: 'ADJUSTMENT',
              quantity: qty - prevQty,
              referenceType: 'ADJUSTMENT',
              notes: `Stock adjusted on product edit (was ${prevQty}, now ${qty})`,
              performedBy: req.user?.name || 'Store',
            },
          });
        }
      }

      return updated;
    }, { timeout: 30000 });
    return res.json({ product });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ message: 'A product with this SKU already exists' });
    }
    console.error('officeSupply updateProduct error:', error);
    return res.status(500).json({ message: 'Failed to update product' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// STOCK
// ════════════════════════════════════════════════════════════════════════════

// GET /api/office-supply/stock?location=STORE|Johar Town|Jail Road|Abbottabad
// Store may request any location; OUTLET is locked to its own location.
const getStock = async (req, res) => {
  try {
    const role = req.user?.role;
    let location = String(req.query.location || '').trim();
    if (!STORE_ROLES.includes(role)) {
      location = getOutletName(req.user);
    }
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }
    const rows = await prisma.officeSupplyStock.findMany({
      where: { location },
      orderBy: { updatedAt: 'desc' },
      include: { product: true },
    });
    const items = rows.map((s) => ({
      stockId: s.id,
      productId: s.productId,
      productName: s.product.name,
      sku: s.product.sku,
      unit: s.product.unit,
      quantity: s.quantity,
      updatedAt: s.updatedAt,
    }));
    return res.json({ location, items });
  } catch (error) {
    console.error('officeSupply getStock error:', error);
    return res.status(500).json({ message: 'Failed to load stock' });
  }
};

// POST /api/office-supply/stock/add  { location?, items: [{ productId, quantity }] }
const addStock = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can add office supply stock' });
    }
    const location = String(req.body?.location || 'STORE').trim() || 'STORE';
    const locationType = location === 'STORE' ? 'STORE' : 'OUTLET';
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const result = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const it of items) {
        const productId = String(it.productId || '');
        const qty = Number(it.quantity);
        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          const err = new Error('Each item needs a valid productId and positive quantity');
          err.httpStatus = 400;
          throw err;
        }
        const product = await tx.officeSupplyProduct.findUnique({ where: { id: productId } });
        if (!product) {
          const err = new Error(`Product ${productId} not found`);
          err.httpStatus = 400;
          throw err;
        }
        const upsert = await tx.officeSupplyStock.upsert({
          where: { productId_location: { productId, location } },
          create: { productId, location, locationType, quantity: qty },
          update: { quantity: { increment: qty } },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId,
            stockId: upsert.id,
            fromLocation: null,
            toLocation: location,
            movementType: 'ADD',
            quantity: qty,
            referenceType: 'ADD',
            notes: `Stock added to ${location} by Store`,
            performedBy: req.user?.name || 'Store',
          },
        });
        created.push({ stockId: upsert.id, productId, quantity: upsert.quantity });
      }
      return { items: created };
    }, { timeout: 30000 });
    return res.status(201).json({ message: 'Stock added', ...result });
  } catch (error) {
    console.error('officeSupply addStock error:', error);
    if (error?.httpStatus) {
      return res.status(error.httpStatus).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to add stock' });
  }
};

// POST /api/office-supply/stock/adjust  { location, items: [{ productId, quantity }] }
const adjustStock = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can adjust office supply stock' });
    }
    const location = String(req.body?.location || '').trim() || 'STORE';
    const locationType = location === 'STORE' ? 'STORE' : 'OUTLET';
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const result = await prisma.$transaction(async (tx) => {
      const updated = [];
      for (const it of items) {
        const productId = String(it.productId || '');
        const qty = Math.max(0, Number(it.quantity) || 0);
        if (!productId) {
          const err = new Error('Each item needs a valid productId');
          err.httpStatus = 400;
          throw err;
        }
        const curr = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId, location } },
        });
        const prevQty = curr ? curr.quantity : 0;
        if (curr && curr.quantity === qty) {
          updated.push({ productId, quantity: qty });
          continue;
        }
        const delta = qty - prevQty;
        const next = await tx.officeSupplyStock.upsert({
          where: { productId_location: { productId, location } },
          create: {
            productId,
            location,
            locationType,
            quantity: qty,
          },
          update: { quantity: qty },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId,
            stockId: next.id,
            fromLocation: location,
            toLocation: location,
            movementType: 'ADJUSTMENT',
            quantity: delta,
            referenceType: 'ADJUSTMENT',
            notes: `Stock adjusted by Store (was ${prevQty}, now ${qty})`,
            performedBy: req.user?.name || 'Store',
          },
        });
        updated.push({ productId, quantity: qty });
      }
      return { items: updated };
    }, { timeout: 30000 });
    return res.json({ message: 'Stock adjusted', ...result });
  } catch (error) {
    console.error('officeSupply adjustStock error:', error);
    return res.status(500).json({ message: 'Failed to adjust stock' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// DEMANDS  (workflow A)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/office-supply/demands  { items: [{ productId, requestedQty, unit? }], notes }
const createDemand = async (req, res) => {
  try {
    if (!OUTLET_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Outlet users can create demands' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const outletName = getOutletName(req.user);
    const demand = await prisma.$transaction(async (tx) => {
      const demandNumber = await nextDocNumber(tx, 'DEM');
      const created = await tx.officeSupplyDemand.create({
        data: {
          demandNumber,
          outletName,
          outletRequestedBy: req.user?.name || 'Outlet User',
          outletRequestedById: req.user?.id || null,
          status: 'PENDING',
          notes: req.body?.notes ? String(req.body.notes) : null,
          items: {
            create: items.map((it) => ({
              productId: String(it.productId),
              productName: String(it.productName || ''),
              requestedQty: Number(it.requestedQty),
              unit: it.unit || 'Pcs',
            })),
          },
        },
        include: { items: true },
      });
      return created;
    }, { timeout: 30000 });
    notify
      .create(req, {
        type: 'office_supply',
        moduleName: 'Office Supply',
        path: '/office-supplies',
        role: STORE_ROLES,
        title: 'New Office Supply Demand',
        message: `Outlet ${outletName} requested ${items.length} office supply item(s)`,
        action: 'demand_created',
        employeeName: req.user?.name,
      })
      .catch(() => {});
    return res.status(201).json({ demand });
  } catch (error) {
    console.error('officeSupply createDemand error:', error);
    return res.status(500).json({ message: 'Failed to create demand' });
  }
};

// GET /api/office-supply/demands?status=&search=
// Store sees all; OUTLET sees only its own outlet.
const getDemands = async (req, res) => {
  try {
    const role = req.user?.role;
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const where = {};
    if (!STORE_ROLES.includes(role)) {
      where.outletName = getOutletName(req.user);
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { demandNumber: { contains: search, mode: 'insensitive' } },
        { outletName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const demands = await prisma.officeSupplyDemand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 250,
    });
    return res.json({ demands });
  } catch (error) {
    console.error('officeSupply getDemands error:', error);
    return res.status(500).json({ message: 'Failed to load demands' });
  }
};

// GET /api/office-supply/demands/:id
const getDemand = async (req, res) => {
  try {
    const { id } = req.params;
    const demand = await prisma.officeSupplyDemand.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!demand) {
      return res.status(404).json({ message: 'Demand not found' });
    }
    if (!STORE_ROLES.includes(req.user?.role) && demand.outletName !== getOutletName(req.user)) {
      return res.status(403).json({ message: 'You can only view your own outlet demands' });
    }
    return res.json({ demand });
  } catch (error) {
    console.error('officeSupply getDemand error:', error);
    return res.status(500).json({ message: 'Failed to load demand' });
  }
};

// POST /api/office-supply/demands/:id/approve
// body: { items: [{ id: demandItemId, approvedQty }], storeNotes }
const approveDemand = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can approve demands' });
    }
    const { id } = req.params;
    const bodyItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!bodyItems.length) {
      return res.status(400).json({ message: 'Approved items are required' });
    }
    const demand = await prisma.officeSupplyDemand.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!demand) {
      return res.status(404).json({ message: 'Demand not found' });
    }
    if (demand.status !== 'PENDING') {
      return res.status(400).json({ message: `Demand is already ${demand.status}` });
    }
    const map = new Map(bodyItems.map((b) => [String(b.id), Math.max(0, Number(b.approvedQty) || 0)]));
    const updates = [];
    for (const item of demand.items) {
      const approved = map.get(item.id);
      if (approved === undefined) {
        return res.status(400).json({ message: `Missing approval for item ${item.productName}` });
      }
      if (approved < 1) {
        return res.status(400).json({ message: `Approved quantity must be at least 1 for ${item.productName}` });
      }
      if (approved > item.requestedQty) {
        return res.status(400).json({ message: `Cannot approve more than requested for ${item.productName}` });
      }
      updates.push(tx_officeSupplyDemandItemUpdate(item.id, approved));
    }
    const totalRequested = demand.items.reduce((s, it) => s + it.requestedQty, 0);
    const totalApproved = demand.items.reduce((s, it) => s + map.get(it.id), 0);
    const status = totalApproved >= totalRequested ? 'APPROVED' : 'PARTIALLY_APPROVED';
    const updated = await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.officeSupplyDemandItem.update({ where: { id: u.id }, data: { approvedQty: u.approvedQty } });
      }
      return tx.officeSupplyDemand.update({
        where: { id },
        data: {
          status,
          storeNotes: req.body?.storeNotes ? String(req.body.storeNotes) : demand.storeNotes,
          approvedAt: new Date(),
          approvedById: req.user?.id || null,
          approvedByName: req.user?.name || 'Store',
        },
        include: { items: true },
      });
    }, { timeout: 30000 });
    notify
      .create(req, {
        type: 'office_supply',
        moduleName: 'Office Supply',
        path: '/office-supplies-outlet',
        role: OUTLET_ROLES,
        title: 'Office Supply Demand ' + status,
        message: `Demand ${demand.demandNumber} for ${demand.outletName} was ${status.toLowerCase()} by Store`,
        action: 'demand_approved',
        employeeName: req.user?.name,
      })
      .catch(() => {});
    return res.json({ demand: updated });
  } catch (error) {
    console.error('officeSupply approveDemand error:', error);
    return res.status(500).json({ message: 'Failed to approve demand' });
  }
};

// Helper: produces the tx update call primitive (plain object description).
function tx_officeSupplyDemandItemUpdate(id, approvedQty) {
  return { id, approvedQty };
}

// POST /api/office-supply/demands/:id/reject
const rejectDemand = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can reject demands' });
    }
    const { id } = req.params;
    const demand = await prisma.officeSupplyDemand.findUnique({ where: { id } });
    if (!demand) {
      return res.status(404).json({ message: 'Demand not found' });
    }
    if (demand.status !== 'PENDING') {
      return res.status(400).json({ message: `Demand is already ${demand.status}` });
    }
    const updated = await prisma.officeSupplyDemand.update({
      where: { id },
      data: {
        status: 'REJECTED',
        storeNotes: req.body?.storeNotes ? String(req.body.storeNotes) : demand.storeNotes,
        rejectedAt: new Date(),
        rejectedById: req.user?.id || null,
        rejectedByName: req.user?.name || 'Store',
      },
      include: { items: true },
    });
    notify
      .create(req, {
        type: 'office_supply',
        moduleName: 'Office Supply',
        path: '/office-supplies-outlet',
        role: OUTLET_ROLES,
        title: 'Office Supply Demand Rejected',
        message: `Demand ${demand.demandNumber} for ${demand.outletName} was rejected by Store`,
        action: 'demand_rejected',
        employeeName: req.user?.name,
      })
      .catch(() => {});
    return res.json({ demand: updated });
  } catch (error) {
    console.error('officeSupply rejectDemand error:', error);
    return res.status(500).json({ message: 'Failed to reject demand' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// TRANSFERS
// ════════════════════════════════════════════════════════════════════════════

// POST /api/office-supply/transfers
// DEMAND body: { type:'DEMAND', demandId, items:[{ productId, quantity }], notes }
// DIRECT body: { type:'DIRECT', toLocation, items:[{ productId, quantity }], notes }
const createTransfer = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can create transfers' });
    }
    const type = String(req.body?.type || '').toUpperCase();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!['DEMAND', 'DIRECT'].includes(type)) {
      return res.status(400).json({ message: "type must be 'DEMAND' or 'DIRECT'" });
    }
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    let demand = null;
    let toLocation = '';
    if (type === 'DEMAND') {
      const demandId = String(req.body?.demandId || '');
      demand = await prisma.officeSupplyDemand.findUnique({ where: { id: demandId }, include: { items: true } });
      if (!demand) {
        return res.status(404).json({ message: 'Demand not found' });
      }
      if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(demand.status)) {
        return res.status(400).json({ message: 'Demand must be approved before transfer' });
      }
      toLocation = demand.outletName;
    } else {
      toLocation = String(req.body?.toLocation || '').trim();
      if (!toLocation) {
        return res.status(400).json({ message: 'toLocation is required for direct transfers' });
      }
    }

    const transfer = await prisma.$transaction(async (tx) => {
      // Resolve authoritative product data
      const pIds = items.map((it) => String(it.productId || ''));
      const dbProducts = await tx.officeSupplyProduct.findMany({
        where: { id: { in: pIds } },
      });
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      // Pre-validate stock availability for all items before any writes
      const resolvedItems = [];
      for (const it of items) {
        const productId = String(it.productId || '');
        const qty = Number(it.quantity);
        const prod = prodMap.get(productId);
        const productName = prod ? prod.name : String(it.productName || 'Product');
        const unit = prod ? prod.unit : (it.unit || 'Pcs');

        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          const err = new Error(`Quantity for "${productName}" must be greater than 0`);
          err.httpStatus = 400;
          throw err;
        }

        const stock = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId, location: 'STORE' } },
        });
        const available = stock ? stock.quantity : 0;
        if (available < qty) {
          const err = new Error(`Insufficient Office Supply stock for "${productName}". Available: ${available}, Requested: ${qty}.`);
          err.httpStatus = 400;
          throw err;
        }

        resolvedItems.push({
          productId,
          productName,
          quantity: qty,
          unit,
          previousStock: available,
          remainingStock: available - qty,
          stockId: stock.id,
        });
      }

      const transferNumber = await nextDocNumber(tx, 'OSTR');
      const created = await tx.officeSupplyTransfer.create({
        data: {
          transferNumber,
          type,
          demandId: type === 'DEMAND' ? demand.id : null,
          fromLocation: 'STORE',
          toLocation,
          status: 'IN_TRANSIT',
          notes: req.body?.notes ? String(req.body.notes) : null,
          sentAt: new Date(),
          sentById: req.user?.id || null,
          sentByName: req.user?.name || 'Store',
          items: {
            create: resolvedItems.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              quantity: it.quantity,
              unit: it.unit,
              previousStock: it.previousStock,
              remainingStock: it.remainingStock,
            })),
          },
        },
        include: { items: true },
      });

      // Deduct STORE stock and log movements atomically
      for (const it of resolvedItems) {
        await tx.officeSupplyStock.update({
          where: { id: it.stockId },
          data: { quantity: { decrement: it.quantity } },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId: it.productId,
            stockId: it.stockId,
            fromLocation: 'STORE',
            toLocation,
            movementType: 'TRANSFER_OUT',
            quantity: it.quantity,
            referenceId: created.id,
            referenceType: 'TRANSFER',
            notes: `Transfer ${transferNumber} to ${toLocation} (Prev: ${it.previousStock}, Rem: ${it.remainingStock})`,
            performedBy: req.user?.name || 'Store',
          },
        });
      }

      // Track sent quantities on the linked demand.
      if (type === 'DEMAND') {
        const byProduct = new Map(created.items.map((it) => [it.productId, it.quantity]));
        for (const ditem of demand.items) {
          const sent = byProduct.get(ditem.productId);
          if (sent) {
            await tx.officeSupplyDemandItem.update({
              where: { id: ditem.id },
              data: { sentQty: { increment: sent } },
            });
          }
        }
      }

      return created;
    }, { timeout: 30000 });

    notify
      .create(req, {
        type: 'office_supply',
        moduleName: 'Office Supply',
        path: '/office-supplies-outlet',
        role: OUTLET_ROLES,
        title: 'Office Supply Transfer',
        message: `Transfer ${transfer.transferNumber} is in transit to ${toLocation}`,
        action: 'transfer_created',
        employeeName: req.user?.name,
      })
      .catch(() => {});
    return res.status(201).json({ transfer });
  } catch (error) {
    console.error('officeSupply createTransfer error:', error);
    if (error?.httpStatus) {
      return res.status(error.httpStatus).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to create transfer' });
  }
};

// GET /api/office-supply/transfers?status=&search=
// Store sees all; OUTLET sees only inbound transfers to its own outlet.
const getTransfers = async (req, res) => {
  try {
    const role = req.user?.role;
    const status = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const where = {};
    if (!STORE_ROLES.includes(role)) {
      where.toLocation = getOutletName(req.user);
    }
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { transferNumber: { contains: search, mode: 'insensitive' } },
        { toLocation: { contains: search, mode: 'insensitive' } },
      ];
    }
    const transfers = await prisma.officeSupplyTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
      take: 250,
    });
    // Resolve linked demand manually (OfficeSupplyTransfer has no `demand`
    // relation; include would throw and fail the whole list).
    if (transfers.length) {
      const demandIds = [...new Set(transfers.filter(t => t.demandId).map(t => t.demandId))];
      const demands = demandIds.length
        ? await prisma.officeSupplyDemand.findMany({ where: { id: { in: demandIds } } })
        : [];
      const demandById = new Map(demands.map(d => [d.id, d]));
      transfers.forEach(t => {
        if (t.demandId) t.demand = demandById.get(t.demandId) || null;
      });
    }
    return res.json({ transfers });
  } catch (error) {
    console.error('officeSupply getTransfers error:', error);
    return res.status(500).json({ message: 'Failed to load transfers' });
  }
};

// GET /api/office-supply/transfers/:id
const getTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.officeSupplyTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }
    if (!STORE_ROLES.includes(req.user?.role) && transfer.toLocation !== getOutletName(req.user)) {
      return res.status(403).json({ message: 'You can only view transfers addressed to your outlet' });
    }
    return res.json({ transfer });
  } catch (error) {
    console.error('officeSupply getTransfer error:', error);
    return res.status(500).json({ message: 'Failed to load transfer' });
  }
};

// POST /api/office-supply/transfers/:id/accept
// Outlet receives the goods: adds to outlet stock, marks RECEIVED (idempotent).
const acceptTransfer = async (req, res) => {
  try {
    if (!OUTLET_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only the receiving Outlet can accept transfers' });
    }
    const { id } = req.params;
    const outletName = getOutletName(req.user);
    const transfer = await prisma.officeSupplyTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }
    if (transfer.toLocation !== outletName) {
      return res.status(403).json({ message: 'This transfer is addressed to another outlet' });
    }
    if (transfer.status !== 'IN_TRANSIT') {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const it of transfer.items) {
        const stock = await tx.officeSupplyStock.upsert({
          where: { productId_location: { productId: it.productId, location: outletName } },
          create: { productId: it.productId, location: outletName, locationType: 'OUTLET', quantity: it.quantity },
          update: { quantity: { increment: it.quantity } },
        });
        await tx.officeSupplyTransferItem.update({
          where: { id: it.id },
          data: { receivedQty: it.quantity },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId: it.productId,
            stockId: stock.id,
            fromLocation: 'STORE',
            toLocation: outletName,
            movementType: 'TRANSFER_IN',
            quantity: it.quantity,
            referenceId: transfer.id,
            referenceType: 'TRANSFER',
            notes: `Received transfer ${transfer.transferNumber}`,
            performedBy: req.user?.id || 'SYSTEM',
          },
        });
      }

      // Advance demand completion state when linked.
      let demandUpdate = null;
      const transferred = await tx.officeSupplyTransfer.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedAt: new Date(),
          receivedById: req.user?.id || null,
          receivedByName: req.user?.name || 'Outlet User',
        },
        include: { items: true },
      });

      if (transfer.demandId) {
        const demand = await tx.officeSupplyDemand.findUnique({
          where: { id: transfer.demandId },
          include: { items: true },
        });
        const byProduct = new Map(transferred.items.map((it) => [it.productId, it.quantity]));
        for (const ditem of demand.items) {
          const recv = byProduct.get(ditem.productId);
          if (recv) {
            await tx.officeSupplyDemandItem.update({
              where: { id: ditem.id },
              data: { receivedQty: { increment: recv } },
            });
          }
        }
        const after = await tx.officeSupplyDemand.findUnique({ where: { id: transfer.demandId }, include: { items: true } });
        const allReceived = after.items.every((d) => (d.receivedQty || 0) >= d.requestedQty);
        demandUpdate = await tx.officeSupplyDemand.update({
          where: { id: transfer.demandId },
          data: allReceived ? { status: 'FULFILLED', fulfilledAt: new Date() } : { status: 'PARTIALLY_FULFILLED' },
          include: { items: true },
        });
      }

      return { transfer: transferred, demand: demandUpdate };
    }, { timeout: 30000 });

    notify
      .create(req, {
        type: 'office_supply',
        moduleName: 'Office Supply',
        path: '/office-supplies',
        role: STORE_ROLES,
        title: 'Office Supply Transfer Received',
        message: `Transfer ${transfer.transferNumber} was received by ${outletName}`,
        action: 'transfer_received',
        employeeName: req.user?.name,
      })
      .catch(() => {});
    return res.json({ transfer: updated.transfer, demand: updated.demand });
  } catch (error) {
    console.error('officeSupply acceptTransfer error:', error);
    return res.status(500).json({ message: 'Failed to accept transfer' });
  }
};

// POST /api/office-supply/transfers/:id/cancel
// Store cancels an in-transit transfer and restores Store stock.
const cancelTransfer = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store can cancel transfers' });
    }
    const { id } = req.params;
    const transfer = await prisma.officeSupplyTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      return res.status(404).json({ message: 'Transfer not found' });
    }
    if (!['PENDING', 'IN_TRANSIT'].includes(transfer.status)) {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}` });
    }
    const updated = await prisma.$transaction(async (tx) => {
      for (const it of transfer.items) {
        await tx.officeSupplyStock.update({
          where: { productId_location: { productId: it.productId, location: 'STORE' } },
          data: { quantity: { increment: it.quantity } },
        });
        await tx.officeSupplyStockMovement.create({
          data: {
            productId: it.productId,
            fromLocation: 'STORE',
            toLocation: null,
            movementType: 'ADJUSTMENT',
            quantity: it.quantity,
            referenceId: transfer.id,
            referenceType: 'TRANSFER',
            notes: `Transfer ${transfer.transferNumber} cancelled — stock restored`,
            performedBy: req.user?.id || 'SYSTEM',
          },
        });
      }
      return tx.officeSupplyTransfer.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user?.id || null },
      });
    }, { timeout: 30000 });
    return res.json({ transfer: updated });
  } catch (error) {
    console.error('officeSupply cancelTransfer error:', error);
    return res.status(500).json({ message: 'Failed to cancel transfer' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// MOVEMENTS (audit ledger)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/office-supply/movements?location=STORE|outlet&limit=
const getMovements = async (req, res) => {
  try {
    const role = req.user?.role;
    const limit = Math.min(500, Number(req.query.limit) || 200);
    const location = String(req.query.location || '').trim();
    const filterLoc = STORE_ROLES.includes(role) && location ? location : STORE_ROLES.includes(role) ? 'STORE' : getOutletName(req.user);
    const movements = await prisma.officeSupplyStockMovement.findMany({
      where: {
        OR: [{ fromLocation: filterLoc }, { toLocation: filterLoc }],
      },
      orderBy: { createdAt: 'desc' },
      include: { product: true },
      take: limit,
    });
    const items = movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name || 'Unknown',
      fromLocation: m.fromLocation,
      toLocation: m.toLocation,
      movementType: m.movementType,
      quantity: m.quantity,
      referenceId: m.referenceId,
      referenceType: m.referenceType,
      notes: m.notes,
      performedBy: m.performedBy,
      createdAt: m.createdAt,
    }));
    return res.json({ movements: items, location: filterLoc });
  } catch (error) {
    console.error('officeSupply getMovements error:', error);
    return res.status(500).json({ message: 'Failed to load movements' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// SELF USE  (Store internal consumption with immutable audit record)
// ════════════════════════════════════════════════════════════════════════════

// POST /api/office-supply/self-use  { items: [{ productId, quantity }], reason }
const recordSelfUse = async (req, res) => {
  try {
    if (!STORE_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only Store users can record self-use' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    const reason = String(req.body?.reason || req.body?.notes || 'Store internal self use').trim();
    const usedBy = req.user?.name || 'Store User';

    const result = await prisma.$transaction(async (tx) => {
      // Resolve authoritative product metadata
      const pIds = items.map((it) => String(it.productId || ''));
      const dbProducts = await tx.officeSupplyProduct.findMany({
        where: { id: { in: pIds } },
      });
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      // Validate stock availability for all items before writing
      const resolvedItems = [];
      for (const it of items) {
        const productId = String(it.productId || '');
        const qty = Number(it.quantity);
        const prod = prodMap.get(productId);
        const productName = prod ? prod.name : String(it.productName || 'Product');
        const unit = prod ? prod.unit : (it.unit || 'Pcs');

        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          const err = new Error(`Quantity for "${productName}" must be greater than 0`);
          err.httpStatus = 400;
          throw err;
        }

        const stock = await tx.officeSupplyStock.findUnique({
          where: { productId_location: { productId, location: 'STORE' } },
        });
        const available = stock ? stock.quantity : 0;
        if (available < qty) {
          const err = new Error(`Insufficient Store stock for "${productName}". Available: ${available}, Requested: ${qty}.`);
          err.httpStatus = 400;
          throw err;
        }

        resolvedItems.push({
          productId,
          productName,
          quantity: qty,
          unit,
          previousStock: available,
          remainingStock: available - qty,
          stockId: stock.id,
        });
      }

      const transferNumber = await nextDocNumber(tx, 'OSU');
      const transfer = await tx.officeSupplyTransfer.create({
        data: {
          transferNumber,
          type: 'SELF_USE',
          fromLocation: 'STORE',
          toLocation: 'STORE_SELF_USE',
          status: 'RECEIVED',
          notes: reason,
          sentAt: new Date(),
          sentById: req.user?.id || null,
          sentByName: usedBy,
          receivedAt: new Date(),
          receivedById: req.user?.id || null,
          receivedByName: usedBy,
          items: {
            create: resolvedItems.map((it) => ({
              productId: it.productId,
              productName: it.productName,
              quantity: it.quantity,
              receivedQty: it.quantity,
              unit: it.unit,
              previousStock: it.previousStock,
              remainingStock: it.remainingStock,
            })),
          },
        },
        include: { items: true },
      });

      // Deduct from STORE stock and record immutable movement logs
      for (const it of resolvedItems) {
        await tx.officeSupplyStock.update({
          where: { id: it.stockId },
          data: { quantity: { decrement: it.quantity } },
        });

        await tx.officeSupplyStockMovement.create({
          data: {
            productId: it.productId,
            stockId: it.stockId,
            fromLocation: 'STORE',
            toLocation: 'STORE_SELF_USE',
            movementType: 'SELF_USE',
            quantity: it.quantity,
            referenceId: transfer.id,
            referenceType: 'SELF_USE',
            notes: `Self-Use (${transferNumber}): ${reason} (Prev: ${it.previousStock}, Used: ${it.quantity}, Rem: ${it.remainingStock})`,
            performedBy: usedBy,
          },
        });
      }

      return transfer;
    }, { timeout: 30000 });

    return res.status(201).json({ success: true, selfUse: result, message: `Recorded self-use of ${items.length} item(s)` });
  } catch (error) {
    console.error('officeSupply recordSelfUse error:', error);
    if (error?.httpStatus) {
      return res.status(error.httpStatus).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to record self-use' });
  }
};

// GET /api/office-supply/self-use?search=
const getSelfUseRecords = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = { type: 'SELF_USE' };
    if (search) {
      where.OR = [
        { transferNumber: { contains: search, mode: 'insensitive' } },
        { sentByName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const records = await prisma.officeSupplyTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
      take: 250,
    });
    return res.json({ records });
  } catch (error) {
    console.error('officeSupply getSelfUseRecords error:', error);
    return res.status(500).json({ message: 'Failed to load self-use records' });
  }
};

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  getStock,
  addStock,
  adjustStock,
  createDemand,
  getDemands,
  getDemand,
  approveDemand,
  rejectDemand,
  createTransfer,
  getTransfers,
  getTransfer,
  acceptTransfer,
  cancelTransfer,
  getMovements,
  recordSelfUse,
  getSelfUseRecords,
};