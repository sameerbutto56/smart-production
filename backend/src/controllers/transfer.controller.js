const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');
const errorLogger = require('../utils/errorLogger');
const { generateBarcode } = require('./pos.controller');
const { resolveMasterPrice } = require('../utils/priceSync');
const { recordInventoryMovement } = require('../utils/inventoryMovement');

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const generateTransferNumber = (() => {
  let counter = 0;
  return () => {
    counter++;
    const d = new Date();
    return `TRF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(counter).padStart(5, '0')}`;
  };
})();

const createTransferRequest = async (req, res) => {
  try {
    const { toOutlet, items, notes, fromOutlet: bodyFromOutlet, dispatchMethod } = req.body;
    const fromOutlet = req.user?.role === 'OUTLET' ? req.user?.name : (bodyFromOutlet || null);
    if (!fromOutlet) return res.status(400).json({ message: 'Source location not determined' });

    const isWarehouseDest = toOutlet === 'Warehouse';
    const isWarehouseSource = fromOutlet === 'Warehouse';

    if (isWarehouseSource) {
      if (!toOutlet || (!OUTLETS.includes(toOutlet) && toOutlet !== 'Warehouse')) {
        return res.status(400).json({ message: 'Invalid destination' });
      }
    } else if (!isWarehouseDest) {
      if (!toOutlet || !OUTLETS.includes(toOutlet)) {
        return res.status(400).json({ message: 'Invalid destination outlet' });
      }
    }

    if (fromOutlet === toOutlet) return res.status(400).json({ message: 'Source and destination cannot be the same' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    let type = 'OUTLET_OUTLET';
    if (isWarehouseDest) type = 'OUTLET_WAREHOUSE';
    if (isWarehouseSource) type = 'WAREHOUSE_OUTLET';

    const transferItems = [];

    if (type === 'OUTLET_WAREHOUSE') {
      const variantIds = items.map(i => i.variantId).filter(Boolean);
      const sourceVariants = await prisma.outletInventory.findMany({
        where: { id: { in: variantIds }, outletName: fromOutlet }
      });
      const srcMap = Object.fromEntries(sourceVariants.map(v => [v.id, v]));

      let totalItems = 0;
      for (const item of items) {
        if (!item.variantId || !item.quantity) return res.status(400).json({ message: 'Each item must have variantId and quantity' });
        const ov = srcMap[item.variantId];
        if (!ov) return res.status(400).json({ message: `Variant ${item.variantId} not found in ${fromOutlet}` });
        if (ov.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${ov.name}. Available: ${ov.stock}, requested: ${item.quantity}` });
        totalItems += item.quantity;
        transferItems.push({
          outletVariantId: ov.id,
          outletInventoryId: ov.id,
          productName: ov.name,
          color: ov.color,
          size: ov.size,
          barcode: ov.barcode,
          quantity: item.quantity,
          unitPrice: ov.price || 0
        });
      }

      const transferNumber = generateTransferNumber();
      const transfer = await prisma.outletTransfer.create({
        data: {
          transferNumber, type, fromOutlet, toOutlet: 'Warehouse',
          totalItems, dispatchMethod: dispatchMethod || null,
          notes: notes || null,
          requestedById: req.user?.id || null,
          requestedByName: req.user?.name || null,
          status: 'PENDING',
          items: { create: transferItems }
        },
        include: { items: true }
      });
      await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'STORE', title: 'New Transfer Request', message: `Transfer #${transfer.transferNumber} from ${fromOutlet}`, action: 'Transfer Created', employeeName: req.user?.name }).catch(() => {});
      cache.delPattern('pos:');
      return res.status(201).json(transfer);

    } else if (type === 'OUTLET_OUTLET') {
      const variantIds = items.map(i => i.variantId).filter(Boolean);
      const sourceVariants = await prisma.outletInventory.findMany({
        where: { id: { in: variantIds }, outletName: fromOutlet }
      });
      const srcMap = Object.fromEntries(sourceVariants.map(v => [v.id, v]));

      let totalItems = 0;
      for (const item of items) {
        if (!item.variantId || !item.quantity) return res.status(400).json({ message: 'Each item must have variantId and quantity' });
        const ov = srcMap[item.variantId];
        if (!ov) return res.status(400).json({ message: `Variant ${item.variantId} not found in ${fromOutlet}` });
        if (ov.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${ov.name}. Available: ${ov.stock}, requested: ${item.quantity}` });
        totalItems += item.quantity;
        transferItems.push({
          outletVariantId: ov.id,
          outletInventoryId: ov.id,
          productName: ov.name,
          color: ov.color,
          size: ov.size,
          barcode: ov.barcode,
          quantity: item.quantity,
          unitPrice: ov.price || 0
        });
      }

      const transferNumber = generateTransferNumber();
      const transfer = await prisma.outletTransfer.create({
        data: {
          transferNumber, type, fromOutlet, toOutlet,
          totalItems, dispatchMethod: dispatchMethod || null,
          notes: notes || null,
          requestedById: req.user?.id || null,
          requestedByName: req.user?.name || null,
          status: 'PENDING',
          items: { create: transferItems }
        },
        include: { items: true }
      });
      await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'STORE', title: 'New Transfer Request', message: `Transfer #${transfer.transferNumber} from ${fromOutlet}`, action: 'Transfer Created', employeeName: req.user?.name }).catch(() => {});
      cache.delPattern('pos:');
      return res.status(201).json(transfer);

    } else if (type === 'WAREHOUSE_OUTLET') {
      let totalItems = 0;
      for (const item of items) {
        if (!item.quantity) return res.status(400).json({ message: 'Each item must have quantity' });
        let invItem = null;
        if (item.inventoryItemId) {
          invItem = await prisma.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
        } else if (item.barcode) {
          invItem = await findWarehouseItem(prisma, item.productName || '', item.color, item.size, item.barcode);
        } else if (item.productName) {
          invItem = await findWarehouseItem(prisma, item.productName, item.color, item.size);
        }
        if (!invItem) return res.status(400).json({ message: `Product ${item.productName || item.barcode} not found in Warehouse` });

        let itemBarcode = item.barcode;
        let itemPrice = Number(item.unitPrice) || parseFloat(invItem.price) || 0;
        let availableStock = invItem.stock || 0;

        if (Array.isArray(invItem.variants) && invItem.variants.length > 0) {
          const matchedVar = invItem.variants.find(v => (item.barcode && v.barcode === item.barcode) || (eqField(v.color, item.color) && eqField(v.size, item.size)));
          if (matchedVar) {
            itemBarcode = matchedVar.barcode || itemBarcode;
            if (matchedVar.price) itemPrice = parseFloat(matchedVar.price);
            availableStock = matchedVar.stock || 0;
          }
        }

        if (availableStock < item.quantity) {
          return res.status(400).json({ message: `Insufficient warehouse stock for ${invItem.name}. Available: ${availableStock}, requested: ${item.quantity}` });
        }

        totalItems += item.quantity;
        transferItems.push({
          productName: invItem.name,
          color: item.color || invItem.color || null,
          size: item.size || invItem.size || null,
          barcode: itemBarcode || invItem.barcode || null,
          quantity: item.quantity,
          unitPrice: itemPrice
        });
      }

      const transferNumber = generateTransferNumber();
      const transfer = await prisma.outletTransfer.create({
        data: {
          transferNumber, type, fromOutlet: 'Warehouse', toOutlet,
          totalItems, dispatchMethod: dispatchMethod || null,
          notes: notes || null,
          requestedById: req.user?.id || null,
          requestedByName: req.user?.name || null,
          status: 'PENDING',
          items: { create: transferItems }
        },
        include: { items: true }
      });
      await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'STORE', title: 'New Warehouse Transfer Request', message: `Transfer #${transfer.transferNumber} to ${toOutlet}`, action: 'Transfer Created', employeeName: req.user?.name }).catch(() => {});
      cache.delPattern('pos:');
      return res.status(201).json(transfer);

    } else {
      return res.status(400).json({ message: 'Invalid transfer type' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to create transfer request', error: error.message });
  }
};

const approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { items: approvalItems } = req.body;
    const transfer = await prisma.outletTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(400).json({ message: `Transfer is ${transfer.status.toLowerCase()}, cannot approve` });

    const userOutlet = req.user?.name;
    const userRole = req.user?.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

    let canApprove = false;
    if (transfer.type === 'OUTLET_WAREHOUSE') {
      canApprove = userRole === 'STORE' || isAdmin;
    } else if (transfer.type === 'WAREHOUSE_OUTLET') {
      canApprove = userRole === 'STORE' || isAdmin;
    } else {
      canApprove = transfer.fromOutlet === userOutlet || isAdmin;
    }
    if (!canApprove) return res.status(403).json({ message: 'Not authorized to approve this transfer' });

    for (const item of transfer.items) {
      const approvedItem = approvalItems?.find(ai => ai.itemId === item.id);
      const approvedQty = approvedItem ? approvedItem.approvedQty : item.quantity;
      if (approvedQty > item.quantity) return res.status(400).json({ message: `Approved qty for ${item.productName} exceeds requested qty` });
    }

    if (transfer.type !== 'WAREHOUSE_OUTLET') {
      for (const item of transfer.items) {
        const approvedItem = approvalItems?.find(ai => ai.itemId === item.id);
        const approvedQty = approvedItem ? approvedItem.approvedQty : item.quantity;
        if (item.outletInventoryId) {
          const ov = await prisma.outletInventory.findUnique({ where: { id: item.outletInventoryId } });
          if (!ov || ov.stock < approvedQty) {
            return res.status(400).json({ message: `Insufficient stock for ${item.productName}. Available: ${ov?.stock || 0}` });
          }
        }
      }
    }

    const updateData = {
      status: 'APPROVED',
      approvedById: req.user?.id || null,
      approvedAt: new Date()
    };

    if (approvalItems && Array.isArray(approvalItems)) {
      for (const ai of approvalItems) {
        await prisma.outletTransferItem.update({
          where: { id: ai.itemId },
          data: { approvedQty: ai.approvedQty }
        });
      }
    } else {
      for (const item of transfer.items) {
        await prisma.outletTransferItem.update({
          where: { id: item.id },
          data: { approvedQty: item.quantity }
        });
      }
    }

    const updated = await prisma.outletTransfer.update({ where: { id }, data: updateData, include: { items: true } });
    await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'OUTLET', title: 'Transfer Approved', message: `Transfer #${transfer.transferNumber} approved`, action: 'Transfer Approved', employeeName: req.user?.name }).catch(() => {});
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve transfer', error: error.message });
  }
};

const rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const transfer = await prisma.outletTransfer.findUnique({ where: { id } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(400).json({ message: `Transfer is ${transfer.status.toLowerCase()}, cannot reject` });

    const userOutlet = req.user?.name;
    const userRole = req.user?.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

    let canReject = false;
    if (transfer.type === 'OUTLET_WAREHOUSE') {
      canReject = userRole === 'STORE' || isAdmin;
    } else if (transfer.type === 'WAREHOUSE_OUTLET') {
      canReject = userRole === 'STORE' || isAdmin;
    } else {
      canReject = transfer.fromOutlet === userOutlet || isAdmin;
    }
    if (!canReject) return res.status(403).json({ message: 'Not authorized to reject this transfer' });

    const updated = await prisma.outletTransfer.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: req.user?.id || null,
        rejectedAt: new Date(),
        rejectionReason: reason || null
      },
      include: { items: true }
    });
    await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'OUTLET', title: 'Transfer Rejected', message: `Transfer #${transfer.transferNumber} rejected`, action: 'Transfer Rejected', employeeName: req.user?.name }).catch(() => {});
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject transfer', error: error.message });
  }
};

const dispatchTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatchMethod, deliveryChannel, deliveryBoyName } = req.body;
    const transfer = await prisma.outletTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'APPROVED') return res.status(400).json({ message: `Transfer must be APPROVED before dispatch. Current: ${transfer.status}` });

    const userOutlet = req.user?.name;
    const userRole = req.user?.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

    let isSource = false;
    if (transfer.type === 'WAREHOUSE_OUTLET') {
      isSource = userRole === 'STORE' || isAdmin;
    } else {
      isSource = transfer.fromOutlet === userOutlet || isAdmin;
    }
    if (!isSource) return res.status(403).json({ message: 'Only the source location can dispatch' });

    const channel = deliveryChannel || (dispatchMethod ? (dispatchMethod === 'RIDER' ? 'NBD' : dispatchMethod) : 'NBD');

    // Atomic dispatch: guard (only APPROVED one) + SOURCE stock deduction + dispatch
    // fields all in ONE 30s transaction so stock can NEVER be deducted twice for a
    // double-dispatch (e.g. double-click). Destination stock is NOT touched here.
    const updated = await prisma.$transaction(async (tx) => {
      const recheck = await tx.outletTransfer.findUnique({ where: { id }, include: { items: true } });
      if (!recheck || recheck.status !== 'APPROVED') {
        const err = new Error('Transfer is no longer APPROVED. Cannot dispatch.');
        err.validation = true;
        throw err;
      }

      for (const item of recheck.items) {
        const qty = item.approvedQty || item.quantity;
        if (recheck.type === 'WAREHOUSE_OUTLET') {
          // Match warehouse InventoryItem by barcode or name
          const invItem = await findWarehouseItem(tx, item.productName, item.color, item.size, item.barcode);
          if (!invItem || (invItem.stock || 0) < qty) {
            const err = new Error(`Insufficient warehouse stock for ${item.productName}. Available: ${invItem?.stock || 0}`);
            err.validation = true;
            throw err;
          }
          const deduction = await deductSourceWarehouse(tx, invItem.id, item.color, item.size, qty, item.barcode);
          await recordInventoryMovement({
            movementType: 'TRANSFER_OUT',
            location: 'Warehouse',
            productId: invItem.id,
            productName: invItem.name,
            color: item.color,
            size: item.size,
            barcode: deduction?.barcode || item.barcode || invItem.barcode,
            previousQty: deduction?.prevStock ?? invItem.stock,
            newQty: deduction?.newStock ?? (invItem.stock - qty),
            difference: -qty,
            referenceId: recheck.transferNumber,
            notes: `Transfer dispatched to ${recheck.toOutlet}`,
            performedBy: req.user?.name || 'Staff',
            tx
          });
        } else if (item.outletInventoryId || item.outletVariantId) {
          const srcId = item.outletInventoryId || item.outletVariantId;
          const ov = await tx.outletInventory.findUnique({ where: { id: srcId } });
          if (!ov || (ov.stock || 0) < qty) {
            const err = new Error(`Insufficient stock for ${item.productName}. Available: ${ov?.stock || 0}`);
            err.validation = true;
            throw err;
          }
          const prevStock = ov.stock || 0;
          const newStock = Math.max(0, prevStock - qty);
          await tx.outletInventory.update({ where: { id: srcId }, data: { stock: { decrement: qty } } });
          await recordInventoryMovement({
            movementType: 'TRANSFER_OUT',
            location: recheck.fromOutlet,
            productId: ov.id,
            productName: ov.name,
            color: ov.color,
            size: ov.size,
            barcode: ov.barcode || item.barcode,
            previousQty: prevStock,
            newQty: newStock,
            difference: -qty,
            referenceId: recheck.transferNumber,
            notes: `Transfer dispatched to ${recheck.toOutlet}`,
            performedBy: req.user?.name || 'Staff',
            tx
          });
        }
      }

      return tx.outletTransfer.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          dispatchedById: req.user?.id || null,
          dispatchedAt: new Date(),
          dispatchMethod: dispatchMethod || transfer.dispatchMethod || 'RIDER',
          deliveryChannel: channel,
          deliveryBoyName: channel === 'NBD' && (deliveryBoyName || req.body.riderName) ? (deliveryBoyName || req.body.riderName) : null
        },
        include: { items: true }
      });
    }, { timeout: 30000 });

    await notify.create(req, { type: 'transfer', moduleName: channel === 'NBD' ? 'Delivery Boy' : 'Transfers', path: channel === 'NBD' ? '/delivery-tasks' : '/transfers', role: channel === 'NBD' ? 'DELIVERY_BOY' : 'OUTLET', title: 'Transfer Dispatched', message: `Transfer #${transfer.transferNumber} dispatched`, action: 'Transfer Dispatched', employeeName: req.user?.name }).catch(() => {});
    cache.delPattern('pos:');
    cache.delPattern('warehouse:');
    cache.delPattern('products:');
    res.json(updated);
  } catch (error) {
    if (error && error.validation) return res.status(400).json({ message: error.message });
    errorLogger.logError({ module: 'transfer:dispatch', userId: req.user?.id, userName: req.user?.name, outletName: req.user?.name, context: `transfer ${req.params?.id}`, message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to dispatch transfer', error: error.message });
  }
};

// Null-safe, case-insensitive comparison for color/size identity matching.
const eqField = (a, b) => {
  const na = (a || '').toString().trim().toLowerCase();
  const nb = (b || '').toString().trim().toLowerCase();
  if (!na && !nb) return true;
  return na === nb;
};

// Find a warehouse InventoryItem by barcode first (inside variants JSON), then by name (case-insensitive).
const findWarehouseItem = async (tx, productName, color, size, barcode) => {
  // 1. Barcode match first across all Warehouse items by searching variants JSON array
  if (barcode) {
    const candidateVariants = await tx.inventoryItem.findMany();
    for (const c of candidateVariants) {
      const variants = typeof c.variants === 'string' ? JSON.parse(c.variants) : (Array.isArray(c.variants) ? c.variants : []);
      if (variants.some(v => v.barcode === String(barcode).trim())) {
        return c;
      }
    }
  }

  // 2. Try exact top-level match (handles simple single-variant items)
  let item = await tx.inventoryItem.findFirst({
    where: {
      name: { equals: productName, mode: 'insensitive' },
      color: color || undefined,
      size: size || undefined
    }
  });
  if (item) return item;

  // 3. Search by name (case-insensitive), then check inside the variants JSON array
  const candidates = await tx.inventoryItem.findMany({
    where: { name: { equals: productName, mode: 'insensitive' } }
  });
  if (candidates.length === 0) return null;

  // Prefer the candidate whose variants array contains the matching color/size
  for (const c of candidates) {
    const variants = typeof c.variants === 'string' ? JSON.parse(c.variants) : (Array.isArray(c.variants) ? c.variants : []);
    if (variants.length === 0) {
      if (eqField(c.color, color) && eqField(c.size, size)) return c;
      continue;
    }
    const hasVariant = variants.some(v => eqField(v.color, color) && eqField(v.size, size));
    if (hasVariant) return c;
  }

  // 4. Fallback: return the first candidate with the same name
  return candidates[0];
};

// Increment warehouse InventoryItem stock for a specific variant (or add variant to existing product).
// Never creates a new InventoryItem. Recomputes top-level stock as sum of all variant stocks.
const incrementWarehouseStock = async (tx, destItem, color, size, qty, price, barcode) => {
  let variants = typeof destItem.variants === 'string'
    ? JSON.parse(destItem.variants)
    : (Array.isArray(destItem.variants) ? [...destItem.variants] : []);

  let matched = false;
  let prevStock = 0;
  let newStock = qty;
  let finalBarcode = barcode || destItem.barcode;

  variants = variants.map(v => {
    if (matched) return v;
    const matchBarcode = barcode && v.barcode === barcode;
    const matchIdentity = eqField(v.color, color) && eqField(v.size, size);
    if (matchBarcode || matchIdentity) {
      matched = true;
      prevStock = v.stock || 0;
      newStock = prevStock + qty;
      finalBarcode = v.barcode || finalBarcode || generateBarcode(destItem.name, size, color);
      return { ...v, stock: newStock, barcode: finalBarcode };
    }
    return v;
  });

  if (!matched) {
    // Variant doesn't exist yet on this existing Product Master — append it to the product's variants
    finalBarcode = barcode || generateBarcode(destItem.name, size, color);
    variants.push({
      color: color || null,
      size: size || null,
      stock: qty,
      price: price || destItem.price || 0,
      barcode: finalBarcode
    });
  }

  const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
  await tx.inventoryItem.update({
    where: { id: destItem.id },
    data: { stock: newTotal, variants }
  });

  return { prevStock, newStock, barcode: finalBarcode };
};

// Deduct a warehouse InventoryItem at dispatch (variant-aware), recomputing top-level stock.
const deductSourceWarehouse = async (tx, inventoryItemId, color, size, qty, barcode) => {
  const inv = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!inv) return null;
  let prevStock = 0;
  let newStock = 0;
  let finalBarcode = barcode || inv.barcode;

  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    let done = false;
    const variants = inv.variants.map(v => {
      if (done) return v;
      const matchBarcode = barcode && v.barcode === barcode;
      const matchIdentity = (!color || eqField(v.color, color)) && (!size || eqField(v.size, size));
      if (!matchBarcode && !matchIdentity) return v;
      done = true;
      prevStock = v.stock || 0;
      newStock = Math.max(0, prevStock - qty);
      finalBarcode = v.barcode || finalBarcode;
      return { ...v, stock: newStock };
    });
    const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
    await tx.inventoryItem.update({ where: { id: inv.id }, data: { variants, stock: newTotal } });
  } else {
    prevStock = inv.stock || 0;
    newStock = Math.max(0, prevStock - qty);
    await tx.inventoryItem.update({ where: { id: inv.id }, data: { stock: newStock } });
  }

  return { prevStock, newStock, barcode: finalBarcode, inv };
};

const acceptTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.outletTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'DISPATCHED') return res.status(400).json({ message: 'Can only accept DISPATCHED transfers' });

    const userOutlet = req.user?.name;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.user?.role);
    const isDest = isAdmin || transfer.toOutlet === userOutlet || (transfer.toOutlet === 'Warehouse' && req.user?.role === 'STORE');
    if (!isDest) return res.status(403).json({ message: 'Only the destination location can accept' });

    const updated = await prisma.$transaction(async (tx) => {
    // ── Idempotency guard: prevent double-accept ──
    const recheck = await tx.outletTransfer.findUnique({ where: { id } });
    if (!recheck || recheck.status !== 'DISPATCHED') {
      throw vErr('Transfer has already been accepted or is no longer in DISPATCHED state.');
    }

    if (transfer.type === 'OUTLET_OUTLET' || transfer.type === 'OUTLET_WAREHOUSE') {
      for (const item of transfer.items) {
        const qty = item.approvedQty || item.quantity;
        const srcId = item.outletInventoryId || item.outletVariantId;
        const sourceOv = srcId ? await tx.outletInventory.findUnique({ where: { id: srcId } }) : null;

        const prodName = sourceOv?.name || item.productName;
        const cat = sourceOv?.category || null;
        const col = item.color || sourceOv?.color || null;
        const sz = item.size || sourceOv?.size || null;
        const fab = sourceOv?.fabric || null;
        const price = item.unitPrice != null ? item.unitPrice : (sourceOv?.price || null);

        if (transfer.type === 'OUTLET_WAREHOUSE') {
          // Rule 31 & 32: Match existing Warehouse Master item (barcode first, then name/variants)
          const destItem = await findWarehouseItem(tx, prodName, col, sz, item.barcode);
          if (!destItem) {
            throw vErr(`Product "${prodName}" does not exist in Warehouse Master. Transfers cannot create new products.`);
          }
          const inc = await incrementWarehouseStock(tx, destItem, col, sz, qty, price, item.barcode);
          await recordInventoryMovement({
            movementType: 'TRANSFER_IN',
            location: 'Warehouse',
            productId: destItem.id,
            productName: destItem.name,
            color: col,
            size: sz,
            barcode: inc.barcode || item.barcode || destItem.barcode,
            previousQty: inc.prevStock,
            newQty: inc.newStock,
            difference: qty,
            referenceId: transfer.transferNumber,
            notes: `Transfer received from ${transfer.fromOutlet}`,
            performedBy: req.user?.name || 'Staff',
            tx
          });
        } else {
          // ── OUTLET_OUTLET: Barcode-first matching, identity fallback ──
          let destOv = null;
          if (item.barcode) {
            destOv = await tx.outletInventory.findFirst({
              where: { barcode: item.barcode, outletName: transfer.toOutlet }
            });
          }
          if (!destOv) {
            const candidates = await tx.outletInventory.findMany({
              where: { outletName: transfer.toOutlet, name: { equals: prodName, mode: 'insensitive' } }
            });
            destOv = candidates.find(r =>
              eqField(r.color, col) && eqField(r.size, sz)
            );
          }

          if (destOv) {
            const prevStock = destOv.stock || 0;
            const newStock = prevStock + qty;
            await tx.outletInventory.update({ where: { id: destOv.id }, data: { stock: { increment: qty } } });
            await recordInventoryMovement({
              movementType: 'TRANSFER_IN',
              location: transfer.toOutlet,
              productId: destOv.id,
              productName: destOv.name,
              color: destOv.color,
              size: destOv.size,
              barcode: destOv.barcode || item.barcode,
              previousQty: prevStock,
              newQty: newStock,
              difference: qty,
              referenceId: transfer.transferNumber,
              notes: `Transfer received from ${transfer.fromOutlet}`,
              performedBy: req.user?.name || 'Staff',
              tx
            });
          } else {
            const finalBarcode = item.barcode || sourceOv?.barcode || generateBarcode(prodName, sz, col);
            try {
              const created = await tx.outletInventory.create({
                data: {
                  name: prodName, category: cat,
                  outletName: transfer.toOutlet,
                  color: col || null, size: sz || null,
                  fabric: fab, barcode: finalBarcode,
                  stock: qty, price,
                  metadata: JSON.stringify({ sourceStoreItemId: sourceOv?.id || null })
                }
              });
              await recordInventoryMovement({
                movementType: 'TRANSFER_IN',
                location: transfer.toOutlet,
                productId: created.id,
                productName: created.name,
                color: created.color,
                size: created.size,
                barcode: finalBarcode,
                previousQty: 0,
                newQty: qty,
                difference: qty,
                referenceId: transfer.transferNumber,
                notes: `Transfer received from ${transfer.fromOutlet}`,
                performedBy: req.user?.name || 'Staff',
                tx
              });
            } catch (err) {
              if (err.code === 'P2002') {
                const existing = await tx.outletInventory.findFirst({
                  where: { outletName: transfer.toOutlet, barcode: finalBarcode }
                });
                if (existing) {
                  const prevStock = existing.stock || 0;
                  const newStock = prevStock + qty;
                  await tx.outletInventory.update({ where: { id: existing.id }, data: { stock: { increment: qty } } });
                  await recordInventoryMovement({
                    movementType: 'TRANSFER_IN',
                    location: transfer.toOutlet,
                    productId: existing.id,
                    productName: existing.name,
                    color: existing.color,
                    size: existing.size,
                    barcode: finalBarcode,
                    previousQty: prevStock,
                    newQty: newStock,
                    difference: qty,
                    referenceId: transfer.transferNumber,
                    notes: `Transfer received from ${transfer.fromOutlet}`,
                    performedBy: req.user?.name || 'Staff',
                    tx
                  });
                } else {
                  throw err;
                }
              } else {
                throw err;
              }
            }
          }
        }
      }
    } else if (transfer.type === 'WAREHOUSE_OUTLET') {
      for (const item of transfer.items) {
        const qty = item.approvedQty || item.quantity;

        // Source warehouse stock was already deducted atomically at dispatch.
        // Acceptance only ADDS to the destination outlet inventory.
        const srcItem = await findWarehouseItem(tx, item.productName, item.color, item.size, item.barcode);

        // ── Barcode-first matching, identity fallback ──
        let destOv = null;
        if (item.barcode) {
          destOv = await tx.outletInventory.findFirst({
            where: { barcode: item.barcode, outletName: transfer.toOutlet }
          });
        }
        if (!destOv) {
          const candidates = await tx.outletInventory.findMany({
            where: { outletName: transfer.toOutlet, name: { equals: item.productName, mode: 'insensitive' } }
          });
          destOv = candidates.find(r =>
            eqField(r.color, item.color) && eqField(r.size, item.size)
          );
        }

        if (destOv) {
          const prevStock = destOv.stock || 0;
          const newStock = prevStock + qty;
          const updData = { stock: { increment: qty } };
          const masterPrice = resolveMasterPrice(srcItem, item.color, item.size);
          const curP = parseFloat(destOv.price);
          const hasValid = !Number.isNaN(curP) && curP > 0;
          if (!hasValid && masterPrice != null) updData.price = masterPrice;
          if (!destOv.barcode && item.barcode) updData.barcode = item.barcode;
          await tx.outletInventory.update({ where: { id: destOv.id }, data: updData });
          await recordInventoryMovement({
            movementType: 'TRANSFER_IN',
            location: transfer.toOutlet,
            productId: destOv.id,
            productName: destOv.name,
            color: destOv.color,
            size: destOv.size,
            barcode: destOv.barcode || item.barcode,
            previousQty: prevStock,
            newQty: newStock,
            difference: qty,
            referenceId: transfer.transferNumber,
            notes: `Transfer received from Warehouse`,
            performedBy: req.user?.name || 'Staff',
            tx
          });
        } else {
          const masterPrice = resolveMasterPrice(srcItem, item.color, item.size);
          const unitPrice = Number(item.unitPrice);
          let price = null;
          if (!Number.isNaN(unitPrice) && unitPrice > 0) price = unitPrice;
          else if (masterPrice != null) price = masterPrice;
          else if (srcItem && parseFloat(srcItem.price) > 0) price = parseFloat(srcItem.price);

          let finalBarcode = item.barcode;
          if (!finalBarcode && srcItem && Array.isArray(srcItem.variants)) {
            const matchedVar = srcItem.variants.find(v => eqField(v.color, item.color) && eqField(v.size, item.size));
            if (matchedVar?.barcode) finalBarcode = matchedVar.barcode;
          }
          if (!finalBarcode) finalBarcode = generateBarcode(item.productName, item.size, item.color);

          try {
            const created = await tx.outletInventory.create({
              data: {
                name: item.productName, category: srcItem?.category || null,
                outletName: transfer.toOutlet,
                color: item.color || null, size: item.size || null,
                fabric: srcItem?.fabric || null, barcode: finalBarcode,
                stock: qty, price,
                metadata: JSON.stringify({ sourceInventoryItemId: srcItem?.id, sourceStoreItemId: srcItem?.id })
              }
            });
            await recordInventoryMovement({
              movementType: 'TRANSFER_IN',
              location: transfer.toOutlet,
              productId: created.id,
              productName: created.name,
              color: created.color,
              size: created.size,
              barcode: finalBarcode,
              previousQty: 0,
              newQty: qty,
              difference: qty,
              referenceId: transfer.transferNumber,
              notes: `Transfer received from Warehouse`,
              performedBy: req.user?.name || 'Staff',
              tx
            });
          } catch (err) {
            if (err.code === 'P2002') {
              const existing = await tx.outletInventory.findFirst({
                where: { outletName: transfer.toOutlet, barcode: finalBarcode }
              });
              if (existing) {
                const prevStock = existing.stock || 0;
                const newStock = prevStock + qty;
                await tx.outletInventory.update({ where: { id: existing.id }, data: { stock: { increment: qty } } });
                await recordInventoryMovement({
                  movementType: 'TRANSFER_IN',
                  location: transfer.toOutlet,
                  productId: existing.id,
                  productName: existing.name,
                  color: existing.color,
                  size: existing.size,
                  barcode: finalBarcode,
                  previousQty: prevStock,
                  newQty: newStock,
                  difference: qty,
                  referenceId: transfer.transferNumber,
                  notes: `Transfer received from Warehouse`,
                  performedBy: req.user?.name || 'Staff',
                  tx
                });
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
        }
      }
    }

    return tx.outletTransfer.update({
      where: { id },
      data: { status: 'COMPLETED', completedById: req.user?.id || null, completedAt: new Date(), deliveredById: req.user?.id || null, deliveredAt: new Date() },
      include: { items: true }
    });
    }, { timeout: 30000 });

    await notify.create(req, { type: 'transfer', moduleName: 'Transfers', path: '/transfers', role: 'STORE', title: 'Transfer Completed', message: `Transfer #${transfer.transferNumber} completed at destination`, action: 'Transfer Completed', employeeName: req.user?.name }).catch(() => {});
    cache.delPattern('pos:');
    cache.delPattern('warehouse:');
    cache.delPattern('products:');
    res.json(updated);
  } catch (error) {
    if (error && error.validation) {
      return res.status(400).json({ message: error.message });
    }
    errorLogger.logError({
      module: 'transfer:accept',
      userId: req.user?.id,
      userName: req.user?.name,
      outletName: req.user?.name,
      context: `transfer ${req.params?.id}`,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to accept transfer: ' + error.message });
  }
};

const vErr = (message) => {
  const err = new Error(message);
  err.validation = true;
  return err;
};

const cancelTransfer = async (req, res) => {
  try {
    const transfer = await prisma.outletTransfer.findUnique({ where: { id: req.params.id } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (!['PENDING', 'APPROVED'].includes(transfer.status)) return res.status(400).json({ message: 'Can only cancel PENDING or APPROVED transfers' });

    const updated = await prisma.outletTransfer.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel transfer', error: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userOutlet = req.user?.name;
    const where = {};

    if (userRole === 'OUTLET') {
      where.OR = [{ fromOutlet: userOutlet }, { toOutlet: userOutlet }];
    } else if (userRole === 'STORE') {
      where.OR = [{ fromOutlet: 'Warehouse' }, { toOutlet: 'Warehouse' }];
    }

    if (req.query.status) where.status = req.query.status;
    if (req.query.type) where.type = req.query.type;

    if (req.query.tab === 'sent' && userOutlet) {
      delete where.OR;
      where.fromOutlet = userOutlet;
    } else if (req.query.tab === 'received' && userOutlet) {
      delete where.OR;
      where.toOutlet = userOutlet;
    } else if (req.query.tab === 'sent' && userRole === 'STORE') {
      delete where.OR;
      where.fromOutlet = 'Warehouse';
    } else if (req.query.tab === 'received' && userRole === 'STORE') {
      delete where.OR;
      where.toOutlet = 'Warehouse';
    }

    const transfers = await prisma.outletTransfer.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transfers', error: error.message });
  }
};

const getTransferById = async (req, res) => {
  try {
    const transfer = await prisma.outletTransfer.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    res.json(transfer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transfer', error: error.message });
  }
};

const getTransferStats = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userOutlet = req.user?.name;
    const where = {};

    if (userRole === 'OUTLET') {
      where.OR = [{ fromOutlet: userOutlet }, { toOutlet: userOutlet }];
    } else if (userRole === 'STORE') {
      where.OR = [{ fromOutlet: 'Warehouse' }, { toOutlet: 'Warehouse' }];
    }

    const all = await prisma.outletTransfer.findMany({ where, select: { status: true } });
    const stats = { total: all.length, PENDING: 0, APPROVED: 0, REJECTED: 0, DISPATCHED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const t of all) { if (stats[t.status] !== undefined) stats[t.status]++; }
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transfer stats', error: error.message });
  }
};

const getWarehouseInventory = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch warehouse inventory', error: error.message });
  }
};

module.exports = {
  createTransferRequest, approveTransfer, rejectTransfer,
  dispatchTransfer, acceptTransfer, cancelTransfer,
  getTransfers, getTransferById, getTransferStats, getWarehouseInventory
};
