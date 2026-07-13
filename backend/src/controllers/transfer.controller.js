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

const createTransfer = async (req, res) => {
  try {
    const { toOutlet, items, notes, fromOutlet: bodyFromOutlet, pickupMethod } = req.body;
    const fromOutlet = req.user?.role === 'OUTLET' ? req.user?.name : (bodyFromOutlet || null);
    if (!fromOutlet) return res.status(400).json({ message: 'Source outlet not determined' });
    if (!toOutlet || !OUTLETS.includes(toOutlet)) return res.status(400).json({ message: 'Invalid destination outlet' });
    if (fromOutlet === toOutlet) return res.status(400).json({ message: 'Source and destination cannot be the same' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    // Batch load source inventory items
    const variantIds = items.map(i => i.variantId);
    const sourceVariants = await prisma.outletInventory.findMany({
      where: { id: { in: variantIds }, outletName: fromOutlet }
    });
    const srcMap = Object.fromEntries(sourceVariants.map(v => [v.id, v]));

    let totalItems = 0;
    const transferItems = [];

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
        transferNumber,
        fromOutlet,
        toOutlet,
        totalItems,
        pickupMethod: pickupMethod || 'RIDER',
        notes: notes || null,
        requestedById: req.user?.id || null,
        requestedByName: req.user?.name || null,
        status: 'PENDING',
        items: {
          create: transferItems.map(ti => ({
            outletVariantId: ti.outletVariantId,
            outletInventoryId: ti.outletInventoryId,
            productName: ti.productName,
            color: ti.color,
            size: ti.size,
            barcode: ti.barcode,
            quantity: ti.quantity,
            unitPrice: ti.unitPrice
          }))
        }
      },
      include: { items: true }
    });

    cache.delPattern('pos:');
    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create transfer request', error: error.message });
  }
};

const dispatchTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await prisma.outletTransfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(400).json({ message: `Transfer is already ${transfer.status.toLowerCase()}` });

    // Verify source has sufficient stock at dispatch time
    for (const item of transfer.items) {
      const ov = await prisma.outletInventory.findUnique({
        where: { id: item.outletVariantId }
      });
      if (!ov || ov.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${item.productName} at source outlet` });
      }
    }

    const updated = await prisma.outletTransfer.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        approvedById: req.user?.id || null,
        approvedAt: new Date()
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
    const transfer = await prisma.outletTransfer.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'DISPATCHED') {
      return res.status(400).json({ message: 'Can only accept transfers that are in DISPATCHED status.' });
    }

    // Process stock updates — run sequentially to avoid PgBouncer connection pool issues
    for (const item of transfer.items) {
      const sourceOv = await prisma.outletInventory.findUnique({
        where: { id: item.outletVariantId }
      });
      if (!sourceOv || sourceOv.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${item.productName} in source outlet` });
      }
      // Decrement source stock
      await prisma.outletInventory.update({
        where: { id: item.outletVariantId },
        data: { stock: { decrement: item.quantity } }
      });
      // Find or create destination inventory
      const destOv = await prisma.outletInventory.findFirst({
        where: {
          name: sourceOv.name,
          category: sourceOv.category,
          outletName: transfer.toOutlet,
          color: sourceOv.color,
          size: sourceOv.size,
          fabric: sourceOv.fabric
        }
      });
      if (destOv) {
        await prisma.outletInventory.update({
          where: { id: destOv.id },
          data: { stock: { increment: item.quantity } }
        });
      } else {
        let barcode = item.barcode;
        let attempt = 0;
        while (await prisma.outletInventory.findFirst({ where: { barcode, outletName: transfer.toOutlet } })) {
          attempt++;
          barcode = generateBarcode(sourceOv.id, item.size, item.color, attempt);
        }
        await prisma.outletInventory.create({
          data: {
            name: sourceOv.name,
            category: sourceOv.category,
            outletName: transfer.toOutlet,
            color: item.color || null,
            size: item.size || null,
            fabric: sourceOv.fabric,
            barcode,
            stock: item.quantity,
            price: item.unitPrice || null,
            metadata: JSON.stringify({ sourceStoreItemId: sourceOv.id })
          }
        });
      }
    }

    const completed = await prisma.outletTransfer.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedById: req.user?.id || null,
        completedAt: new Date()
      },
      include: { items: true }
    });

    cache.delPattern('pos:');
    res.json(completed);
  } catch (error) {
    res.status(500).json({ message: 'Failed to accept transfer: ' + error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const userOutlet = req.user?.role === 'OUTLET' ? req.user?.name : null;
    const where = {};
    if (userOutlet) {
      where.OR = [{ fromOutlet: userOutlet }, { toOutlet: userOutlet }];
    }
    const status = req.query.status;
    if (status) where.status = status;

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

const cancelTransfer = async (req, res) => {
  try {
    const transfer = await prisma.outletTransfer.findUnique({ where: { id: req.params.id } });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(400).json({ message: 'Can only cancel PENDING transfers' });

    await prisma.outletTransfer.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });
    cache.delPattern('pos:');
    res.json({ message: 'Transfer cancelled' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel transfer', error: error.message });
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  getTransferById,
  cancelTransfer,
  dispatchTransfer,
  acceptTransfer
};
