const prisma = require('../prisma');
const cache = require('../utils/cache');
const { generateBarcode } = require('./pos.controller');

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
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject transfer', error: error.message });
  }
};

const dispatchTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatchMethod } = req.body;
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

    for (const item of transfer.items) {
      const qty = item.approvedQty || item.quantity;
      if (transfer.type === 'WAREHOUSE_OUTLET') {
        const invItem = await prisma.inventoryItem.findFirst({
          where: { name: item.productName, color: item.color || undefined, size: item.size || undefined }
        });
        if (!invItem || invItem.stock < qty) {
          return res.status(400).json({ message: `Insufficient warehouse stock for ${item.productName}. Available: ${invItem?.stock || 0}` });
        }
      } else if (item.outletInventoryId) {
        const ov = await prisma.outletInventory.findUnique({ where: { id: item.outletInventoryId } });
        if (!ov || ov.stock < qty) {
          return res.status(400).json({ message: `Insufficient stock for ${item.productName}. Available: ${ov?.stock || 0}` });
        }
      }
    }

    const updated = await prisma.outletTransfer.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        dispatchedById: req.user?.id || null,
        dispatchedAt: new Date(),
        dispatchMethod: dispatchMethod || transfer.dispatchMethod || 'RIDER'
      },
      include: { items: true }
    });
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to dispatch transfer', error: error.message });
  }
};

const acceptTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.outletTransfer.findUnique({ where: { id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'DISPATCHED') return res.status(400).json({ message: 'Can only accept DISPATCHED transfers' });

    const userOutlet = req.user?.name;
    const isDest = transfer.toOutlet === userOutlet || (transfer.toOutlet === 'Warehouse' && ['STORE', 'ADMIN', 'SUPER_ADMIN'].includes(req.user?.role));
    if (!isDest) return res.status(403).json({ message: 'Only the destination location can accept' });

    if (transfer.type === 'OUTLET_OUTLET' || transfer.type === 'OUTLET_WAREHOUSE') {
      for (const item of transfer.items) {
        const qty = item.approvedQty || item.quantity;
        const srcId = item.outletInventoryId || item.outletVariantId;
        if (!srcId) return res.status(400).json({ message: `Missing source inventory reference for ${item.productName}` });

        const sourceOv = await prisma.outletInventory.findUnique({ where: { id: srcId } });
        if (!sourceOv || sourceOv.stock < qty) {
          return res.status(400).json({ message: `Insufficient stock for ${item.productName} at source` });
        }

        await prisma.outletInventory.update({ where: { id: srcId }, data: { stock: { decrement: qty } } });

        if (transfer.type === 'OUTLET_WAREHOUSE') {
          let destItem = await prisma.inventoryItem.findFirst({
            where: { name: sourceOv.name, color: sourceOv.color || undefined, size: sourceOv.size || undefined }
          });
          if (destItem) {
            const newStock = (destItem.stock || 0) + qty;
            let newVariants = destItem.variants;
            if (Array.isArray(newVariants) && newVariants.length > 0) {
              newVariants = newVariants.map(v => {
                if ((v.color || null) === (sourceOv.color || null) && (v.size || null) === (sourceOv.size || null)) {
                  return { ...v, stock: (v.stock || 0) + qty };
                }
                return v;
              });
            }
            await prisma.inventoryItem.update({ where: { id: destItem.id }, data: { stock: newStock, variants: newVariants } });
          } else {
            await prisma.inventoryItem.create({
              data: {
                name: sourceOv.name, category: sourceOv.category,
                color: sourceOv.color || null, size: sourceOv.size || null,
                fabric: sourceOv.fabric, stock: qty,
                price: sourceOv.price || null,
                variants: [{ color: sourceOv.color || null, size: sourceOv.size || null, stock: qty, price: sourceOv.price || 0 }]
              }
            });
          }
        } else {
          let destOv = await prisma.outletInventory.findFirst({
            where: { barcode: item.barcode, outletName: transfer.toOutlet }
          });
          if (!destOv) {
            const candidates = await prisma.outletInventory.findMany({
              where: { outletName: transfer.toOutlet, name: sourceOv.name }
            });
            destOv = candidates.find(r =>
              (item.color ? r.color === item.color : !r.color) &&
              (item.size ? r.size === item.size : !r.size)
            );
          }
          if (destOv) {
            await prisma.outletInventory.update({ where: { id: destOv.id }, data: { stock: { increment: qty } } });
          } else {
            await prisma.outletInventory.create({
              data: {
                name: sourceOv.name, category: sourceOv.category,
                outletName: transfer.toOutlet,
                color: item.color || null, size: item.size || null,
                fabric: sourceOv.fabric, barcode: item.barcode,
                stock: qty, price: item.unitPrice || null,
                metadata: JSON.stringify({ sourceStoreItemId: sourceOv.id })
              }
            });
          }
        }
      }
    } else if (transfer.type === 'WAREHOUSE_OUTLET') {
      for (const item of transfer.items) {
        const qty = item.approvedQty || item.quantity;

        const srcItem = await prisma.inventoryItem.findFirst({
          where: { name: item.productName, color: item.color || undefined, size: item.size || undefined }
        });
        if (!srcItem || srcItem.stock < qty) {
          return res.status(400).json({ message: `Insufficient warehouse stock for ${item.productName}. Available: ${srcItem?.stock || 0}` });
        }

        const newStock = (srcItem.stock || 0) - qty;
        let newVariants = srcItem.variants;
        if (Array.isArray(newVariants) && newVariants.length > 0) {
          newVariants = newVariants.map(v => {
            if ((v.color || null) === (item.color || null) && (v.size || null) === (item.size || null)) {
              return { ...v, stock: Math.max(0, (v.stock || 0) - qty) };
            }
            return v;
          });
        }
        await prisma.inventoryItem.update({ where: { id: srcItem.id }, data: { stock: newStock, variants: newVariants } });

        let destOv = await prisma.outletInventory.findFirst({
          where: { barcode: item.barcode, outletName: transfer.toOutlet }
        });
        if (!destOv) {
          const candidates = await prisma.outletInventory.findMany({
            where: { outletName: transfer.toOutlet, name: item.productName }
          });
          destOv = candidates.find(r =>
            (item.color ? r.color === item.color : !r.color) &&
            (item.size ? r.size === item.size : !r.size)
          );
        }
        if (destOv) {
          await prisma.outletInventory.update({ where: { id: destOv.id }, data: { stock: { increment: qty } } });
        } else {
          await prisma.outletInventory.create({
            data: {
              name: item.productName, category: srcItem.category || null,
              outletName: transfer.toOutlet,
              color: item.color || null, size: item.size || null,
              fabric: srcItem.fabric || null, barcode: item.barcode,
              stock: qty, price: item.unitPrice || srcItem.price || null,
              metadata: JSON.stringify({ sourceInventoryItemId: srcItem.id })
            }
          });
        }
      }
    }

    const updated = await prisma.outletTransfer.update({
      where: { id },
      data: { status: 'COMPLETED', completedById: req.user?.id || null, completedAt: new Date() },
      include: { items: true }
    });
    cache.delPattern('pos:');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept transfer: ' + error.message });
  }
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
