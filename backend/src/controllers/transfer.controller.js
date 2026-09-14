const prisma = require('../prisma');
const cache = require('../utils/cache');
const notify = require('../utils/notify');
const errorLogger = require('../utils/errorLogger');
const { generateBarcode } = require('./pos.controller');
const { resolveMasterPrice } = require('../utils/priceSync');

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
          // Match warehouse InventoryItem by name only, then validate variant stock
          const invItem = await findWarehouseItem(tx, item.productName, item.color, item.size);
          if (!invItem || (invItem.stock || 0) < qty) {
            const err = new Error(`Insufficient warehouse stock for ${item.productName}. Available: ${invItem?.stock || 0}`);
            err.validation = true;
            throw err;
          }
          await deductSourceWarehouse(tx, invItem.id, item.color, item.size, qty);
        } else if (item.outletInventoryId || item.outletVariantId) {
          const srcId = item.outletInventoryId || item.outletVariantId;
          const ov = await tx.outletInventory.findUnique({ where: { id: srcId } });
          if (!ov || (ov.stock || 0) < qty) {
            const err = new Error(`Insufficient stock for ${item.productName}. Available: ${ov?.stock || 0}`);
            err.validation = true;
            throw err;
          }
          await tx.outletInventory.update({ where: { id: srcId }, data: { stock: { decrement: qty } } });
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

// Find a warehouse InventoryItem by name, searching BOTH top-level fields AND the
// variants JSON array. Warehouse products typically store color: null, size: null at
// the top level with all variants inside the JSON array.
const findWarehouseItem = async (tx, productName, color, size) => {
  // 1. Try exact top-level match first (handles simple single-variant items)
  let item = await tx.inventoryItem.findFirst({
    where: { name: productName, color: color || undefined, size: size || undefined }
  });
  if (item) return item;

  // 2. Search by name only, then check inside the variants JSON array
  const candidates = await tx.inventoryItem.findMany({
    where: { name: productName }
  });
  if (candidates.length === 0) return null;

  // Prefer the candidate whose variants array contains the matching color/size
  for (const c of candidates) {
    const variants = typeof c.variants === 'string' ? JSON.parse(c.variants) : (Array.isArray(c.variants) ? c.variants : []);
    if (variants.length === 0) {
      // No variants array — match if top-level color/size are compatible
      if (eqField(c.color, color) && eqField(c.size, size)) return c;
      continue;
    }
    const hasVariant = variants.some(v => eqField(v.color, color) && eqField(v.size, size));
    if (hasVariant) return c;
  }

  // 3. Fallback: return the first candidate with the same name (the variant will be added)
  return candidates[0];
};

// Increment warehouse InventoryItem stock for a specific variant (or add new variant).
// Recomputes top-level stock as sum of all variant stocks.
const incrementWarehouseStock = async (tx, destItem, color, size, qty, price) => {
  let variants = typeof destItem.variants === 'string'
    ? JSON.parse(destItem.variants)
    : (Array.isArray(destItem.variants) ? [...destItem.variants] : []);

  let matched = false;
  variants = variants.map(v => {
    if (matched) return v;
    if (eqField(v.color, color) && eqField(v.size, size)) {
      matched = true;
      return { ...v, stock: (v.stock || 0) + qty };
    }
    return v;
  });

  if (!matched) {
    // Variant doesn't exist yet — add it
    variants.push({
      color: color || null,
      size: size || null,
      stock: qty,
      price: price || destItem.price || 0
    });
  }

  const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
  await tx.inventoryItem.update({
    where: { id: destItem.id },
    data: { stock: newTotal, variants }
  });
};

// Deduct a warehouse InventoryItem at dispatch (variant-aware), recomputing top-level stock.
const deductSourceWarehouse = async (tx, inventoryItemId, color, size, qty) => {
  const inv = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!inv) return;
  if (Array.isArray(inv.variants) && inv.variants.length > 0) {
    let done = false;
    const variants = inv.variants.map(v => {
      if (done) return v;
      const matchColor = !color || (v.color || '').toString().toLowerCase() === String(color).toLowerCase();
      const matchSize = !size || (v.size || '').toString().toLowerCase() === String(size).toLowerCase();
      if (!matchColor || !matchSize) return v;
      done = true;
      return { ...v, stock: Math.max(0, (v.stock || 0) - qty) };
    });
    const newTotal = variants.reduce((s, v) => s + (v.stock || 0), 0);
    await tx.inventoryItem.update({ where: { id: inv.id }, data: { variants, stock: newTotal } });
  } else {
    await tx.inventoryItem.update({ where: { id: inv.id }, data: { stock: { decrement: Math.min(qty, inv.stock || 0) } } });
  }
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
          // ── FIXED: Match warehouse InventoryItem by name, then search variants JSON ──
          const destItem = await findWarehouseItem(tx, prodName, col, sz);
          if (destItem) {
            await incrementWarehouseStock(tx, destItem, col, sz, qty, price);
          } else {
            // Genuinely new product — create InventoryItem
            await tx.inventoryItem.create({
              data: {
                name: prodName, category: cat,
                color: null, size: null,
                fabric: fab, stock: qty,
                price: price || null,
                variants: [{ color: col || null, size: sz || null, stock: qty, price: price || 0 }]
              }
            });
          }
        } else {
          // ── OUTLET_OUTLET: Identity-based matching first, barcode fallback ──
          let destOv = null;

          // 1. Match by identity (outletName + name + color + size)
          const candidates = await tx.outletInventory.findMany({
            where: { outletName: transfer.toOutlet, name: prodName }
          });
          destOv = candidates.find(r =>
            eqField(r.color, col) && eqField(r.size, sz)
          );

          // 2. Fallback: barcode match
          if (!destOv && item.barcode) {
            destOv = await tx.outletInventory.findFirst({
              where: { barcode: item.barcode, outletName: transfer.toOutlet }
            });
          }

          if (destOv) {
            await tx.outletInventory.update({ where: { id: destOv.id }, data: { stock: { increment: qty } } });
          } else {
            await tx.outletInventory.create({
              data: {
                name: prodName, category: cat,
                outletName: transfer.toOutlet,
                color: col || null, size: sz || null,
                fabric: fab, barcode: item.barcode,
                stock: qty, price,
                metadata: JSON.stringify({ sourceStoreItemId: sourceOv?.id || null })
              }
            });
          }
        }
      }
    } else if (transfer.type === 'WAREHOUSE_OUTLET') {
      for (const item of transfer.items) {
        const qty = item.approvedQty || item.quantity;

        // Source warehouse stock was already deducted atomically at dispatch.
        // Acceptance only ADDS to the destination outlet inventory.

        // ── FIXED: Use name-only + variant-aware matching for srcItem ──
        const srcItem = await findWarehouseItem(tx, item.productName, item.color, item.size);

        // ── Identity-based matching first, barcode fallback ──
        let destOv = null;
        const candidates = await tx.outletInventory.findMany({
          where: { outletName: transfer.toOutlet, name: item.productName }
        });
        destOv = candidates.find(r =>
          eqField(r.color, item.color) && eqField(r.size, item.size)
        );
        if (!destOv && item.barcode) {
          destOv = await tx.outletInventory.findFirst({
            where: { barcode: item.barcode, outletName: transfer.toOutlet }
          });
        }

        if (destOv) {
          const updData = { stock: { increment: qty } };
          const masterPrice = resolveMasterPrice(srcItem, item.color, item.size);
          const curP = parseFloat(destOv.price);
          const hasValid = !Number.isNaN(curP) && curP > 0;
          if (!hasValid && masterPrice != null) updData.price = masterPrice;
          await tx.outletInventory.update({ where: { id: destOv.id }, data: updData });
        } else {
          const masterPrice = resolveMasterPrice(srcItem, item.color, item.size);
          const unitPrice = Number(item.unitPrice);
          let price = null;
          if (!Number.isNaN(unitPrice) && unitPrice > 0) price = unitPrice;
          else if (masterPrice != null) price = masterPrice;
          else if (srcItem && parseFloat(srcItem.price) > 0) price = parseFloat(srcItem.price);

          await tx.outletInventory.create({
            data: {
              name: item.productName, category: srcItem?.category || null,
              outletName: transfer.toOutlet,
              color: item.color || null, size: item.size || null,
              fabric: srcItem?.fabric || null, barcode: item.barcode,
              stock: qty, price,
              metadata: JSON.stringify({ sourceInventoryItemId: srcItem?.id, sourceStoreItemId: srcItem?.id })
            }
          });
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
