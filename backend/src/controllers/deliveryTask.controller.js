const prisma = require('../prisma');

// Unified NBD (Delivery Boy) task view for Outlet Transfers and Demand dispatches.
// Covers the "Enamels Delivery Boy (NBD)" leg of both workflows. The destination
// inventory is only ever added by the receiving OUTLET's accept action — the NBD
// task here is tracking/notification only (source was already deducted at dispatch,
// destination is added at receiving-outlet acceptance).

const getDeliveryTasks = async (req, res) => {
  try {
    const role = req.user?.role;
    const isViewer = role === 'DELIVERY_BOY' || role === 'STORE' || role === 'STORE_EMPLOYEE' ||
      role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OUTLET';
    if (!isViewer) return res.status(403).json({ message: 'Not authorized to view delivery tasks' });

    const [, transfers, demands] = await Promise.all([
      Promise.resolve(),
      prisma.outletTransfer.findMany({
        where: { status: 'DISPATCHED', deliveryChannel: 'NBD' },
        orderBy: { dispatchedAt: 'desc' },
        include: { items: true }
      }),
      prisma.outletDemandRequest.findMany({
        where: { deliveredAt: null, dispatchedAt: { not: null }, deliveryChannel: 'NBD' },
        orderBy: { dispatchedAt: 'desc' }
      })
    ]);

    const transferTasks = transfers.map(t => ({
      type: 'TRANSFER',
      id: t.id,
      number: t.transferNumber,
      from: t.fromOutlet,
      to: t.toOutlet,
      status: t.status,
      deliveryChannel: t.deliveryChannel,
      deliveryBoyName: t.deliveryBoyName,
      dispatchedAt: t.dispatchedAt,
      deliveredAt: t.deliveredAt,
      items: Array.isArray(t.items) ? t.items.map(i => ({ productName: i.productName, color: i.color, size: i.size, qty: i.approvedQty || i.quantity })) : []
    }));

    const demandTasks = (demands || [])
      .filter(d => d.status === 'DISPATCHED' || (d.status === 'APPROVED' && d.dispatchedAt))
      .map(d => {
        const items = typeof d.items === 'string' ? (() => { try { return JSON.parse(d.items); } catch { return []; } })() : (d.items || []);
        return {
          type: 'DEMAND',
          id: d.id,
          number: d.transferNumber,
          from: 'Warehouse',
          to: d.outletName,
          status: d.status,
          deliveryChannel: d.deliveryChannel,
          deliveryBoyName: d.deliveryBoyName,
          dispatchedAt: d.dispatchedAt,
          deliveredAt: d.deliveredAt,
          items: items.map(i => ({ productName: i.productName, color: i.color, size: i.size, qty: i.approvedQty || i.requestedQty }))
        };
      });

    res.json({ tasks: [...demandTasks, ...transferTasks], count: demandTasks.length + transferTasks.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load delivery tasks', error: error.message });
  }
};

// NBD marks a dispatched transfer/demand as physically delivered (tracking only).
// Inventory is NOT touched here — the receiving outlet's accept adds the destination.
const markDelivered = async (req, res) => {
  try {
    const { type, id } = req.params;
    const role = req.user?.role;
    const isBoy = role === 'DELIVERY_BOY' || role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isBoy) return res.status(403).json({ message: 'Only a Delivery Boy can mark a delivery' });

    if (type === 'TRANSFER') {
      const t = await prisma.outletTransfer.update({
        where: { id },
        data: { deliveredAt: new Date() },
        include: { items: true }
      });
      if (t.deliveryBoyName && req.user?.name) {
        await prisma.outletTransfer.update({ where: { id }, data: { deliveryBoyName: t.deliveryBoyName } });
      }
      return res.json({ message: `Transfer #${t.transferNumber} marked delivered. Awaiting ${t.toOutlet} acceptance.`, task: { type: 'TRANSFER', id, number: t.transferNumber, deliveredAt: t.deliveredAt } });
    }

    if (type === 'DEMAND') {
      const d = await prisma.outletDemandRequest.update({
        where: { id },
        data: { deliveredAt: new Date() }
      });
      return res.json({ message: `Demand #${d.transferNumber || ''} marked delivered. Awaiting ${d.outletName} acceptance.`, task: { type: 'DEMAND', id, number: d.transferNumber, deliveredAt: d.deliveredAt } });
    }

    return res.status(400).json({ message: 'Unknown task type' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark delivery', error: error.message });
  }
};

module.exports = { getDeliveryTasks, markDelivered };
