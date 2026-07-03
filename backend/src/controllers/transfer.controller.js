const prisma = require('../prisma');
const cache = require('../utils/cache');

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
    const { toOutlet, items, notes, fromOutlet: bodyFromOutlet } = req.body;
    const fromOutlet = req.user?.role === 'OUTLET' ? req.user?.name : (bodyFromOutlet || null);
    if (!fromOutlet) return res.status(400).json({ message: 'Source outlet not determined' });
    if (!toOutlet || !OUTLETS.includes(toOutlet)) return res.status(400).json({ message: 'Invalid destination outlet' });
    if (fromOutlet === toOutlet) return res.status(400).json({ message: 'Source and destination cannot be the same' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    // Batch load source variants + find dest variants in one go
    const variantIds = items.map(i => i.variantId);
    const sourceVariants = await prisma.outletVariant.findMany({
      where: { id: { in: variantIds }, outletName: fromOutlet },
      include: { inventoryItem: true }
    });
    const srcMap = Object.fromEntries(sourceVariants.map(v => [v.id, v]));
    const invItemIds = [...new Set(sourceVariants.map(v => v.inventoryItemId))];
    const destVariants = await prisma.outletVariant.findMany({
      where: { inventoryItemId: { in: invItemIds }, outletName: toOutlet }
    });
    const destKey = (v) => `${v.color || ''}|${v.size || ''}`;
    const destMap = Object.fromEntries(destVariants.map(v => [destKey(v), v]));

    let totalItems = 0;
    const transferItems = [];

    for (const item of items) {
      if (!item.variantId || !item.quantity) return res.status(400).json({ message: 'Each item must have variantId and quantity' });
      const ov = srcMap[item.variantId];
      if (!ov) return res.status(400).json({ message: `Variant ${item.variantId} not found in ${fromOutlet}` });
      if (ov.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${ov.inventoryItem.name}. Available: ${ov.stock}, requested: ${item.quantity}` });
      totalItems += item.quantity;
      transferItems.push({
        outletVariantId: ov.id,
        inventoryItemId: ov.inventoryItemId,
        productName: ov.inventoryItem.name,
        color: ov.color,
        size: ov.size,
        barcode: ov.barcode,
        quantity: item.quantity,
        unitPrice: ov.price || ov.inventoryItem.price || 0,
        destVariant: destMap[destKey(ov)] || null
      });
    }

    const transferNumber = generateTransferNumber();

    const transfer = await prisma.$transaction(async (tx) => {
      for (const ti of transferItems) {
        await tx.outletVariant.update({
          where: { id: ti.outletVariantId },
          data: { stock: { decrement: ti.quantity } }
        });
        if (ti.destVariant) {
          await tx.outletVariant.update({
            where: { id: ti.destVariant.id },
            data: { stock: { increment: ti.quantity } }
          });
        }
      }
      return tx.outletTransfer.create({
        data: {
          transferNumber,
          fromOutlet,
          toOutlet,
          totalItems,
          notes: notes || null,
          requestedById: req.user?.id || null,
          requestedByName: req.user?.name || null,
          status: 'COMPLETED',
          completedById: req.user?.id || null,
          completedAt: new Date(),
          items: {
            create: transferItems.map(ti => ({
              outletVariantId: ti.outletVariantId,
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
    });

    cache.delPattern('pos:');
    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create transfer', error: error.message });
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
  cancelTransfer
};
