const prisma = require('../prisma');
const xlsx = require('xlsx');

const createRequest = async (req, res) => {
  try {
    const { outletName, items } = req.body;
    if (!outletName || !items || !items.length) {
      return res.status(400).json({ message: 'outletName and items are required' });
    }
    const requests = await Promise.all(
      items.map(item =>
        prisma.stockRequest.create({
          data: {
            outletName,
            itemName: item.itemName,
            itemCategory: item.itemCategory,
            quantity: item.quantity,
            createdById: req.user.id,
          },
        })
      )
    );
    res.status(201).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error creating stock request', error: error.message });
  }
};

const getRequests = async (req, res) => {
  try {
    const { status, outletName } = req.query;
    const where = {};
    if (status) where.status = status;
    if (outletName) where.outletName = outletName;
    if (req.user.role === 'OUTLET') {
      const name = req.user.name || '';
      let detectedOutlet = '';
      if (name.toLowerCase().includes('johar')) detectedOutlet = 'Johar Town';
      else if (name.toLowerCase().includes('jail')) detectedOutlet = 'Jail Road';
      else if (name.toLowerCase().includes('abbottabad')) detectedOutlet = 'Abbottabad';
      else detectedOutlet = name;
      where.outletName = detectedOutlet;
    }
    const requests = await prisma.stockRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

const getRequestById = async (req, res) => {
  try {
    const request = await prisma.stockRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching request', error: error.message });
  }
};

const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedQty } = req.body;
    const request = await prisma.stockRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'Request is not pending' });

    const qty = approvedQty !== undefined ? approvedQty : request.quantity;
    const status = qty <= 0 ? 'REJECTED' : qty >= request.quantity ? 'APPROVED' : 'PARTIALLY_APPROVED';

    const updated = await prisma.stockRequest.update({
      where: { id },
      data: { approvedQty: qty, status },
    });

    // Deduct from inventory
    if (qty > 0) {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { name: { contains: request.itemName, mode: 'insensitive' }, category: request.itemCategory },
      });
      if (inventoryItem && inventoryItem.stock >= qty) {
        if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
          let updatedVariants = [...inventoryItem.variants];
          let remaining = qty;
          for (let i = 0; i < updatedVariants.length && remaining > 0; i++) {
            if ((updatedVariants[i].stock || 0) > 0) {
              const deductFromVariant = Math.min(remaining, updatedVariants[i].stock);
              updatedVariants[i] = { ...updatedVariants[i], stock: updatedVariants[i].stock - deductFromVariant };
              remaining -= deductFromVariant;
            }
          }
          const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { variants: updatedVariants, stock: newTotal },
          });
        } else {
          await prisma.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: { stock: inventoryItem.stock - qty },
          });
        }
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error approving request', error: error.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const request = await prisma.stockRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: 'Request is not pending' });

    const updated = await prisma.stockRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedQty: 0, notes: notes || null },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting request', error: error.message });
  }
};

const completeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.stockRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (!['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status)) {
      return res.status(400).json({ message: 'Request must be approved first' });
    }
    const updated = await prisma.stockRequest.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error completing request', error: error.message });
  }
};

const getLowStockItems = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const items = await prisma.inventoryItem.findMany({
      where: { stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching low stock items', error: error.message });
  }
};

const exportRequestsExcel = async (req, res) => {
  try {
    const requests = await prisma.stockRequest.findMany({
      orderBy: [{ outletName: 'asc' }, { createdAt: 'desc' }],
    });
    const data = requests.map(r => ({
      'Outlet': r.outletName,
      'Item': r.itemName,
      'Category': r.itemCategory,
      'Requested Qty': r.quantity,
      'Approved Qty': r.approvedQty,
      'Pending Qty': r.quantity - r.approvedQty,
      'Status': r.status,
      'Notes': r.notes || '',
      'Request Date': new Date(r.createdAt).toISOString().split('T')[0],
      'Last Updated': new Date(r.updatedAt).toISOString().split('T')[0],
    }));
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Column widths
    ws['!cols'] = [
      { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
      { wch: 14 }, { wch: 14 },
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'StockRequests');

    // Summary sheet
    const summary = await prisma.stockRequest.groupBy({
      by: ['outletName'],
      _sum: { quantity: true, approvedQty: true },
      _count: true,
    });
    const summaryData = summary.map(s => ({
      'Outlet': s.outletName,
      'Total Requests': s._count,
      'Total Requested': s._sum.quantity || 0,
      'Total Approved': s._sum.approvedQty || 0,
    }));
    const ws2 = xlsx.utils.json_to_sheet(summaryData);
    ws2['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    xlsx.utils.book_append_sheet(wb, ws2, 'Summary');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=stock-requests-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Error exporting requests', error: error.message });
  }
};

module.exports = { createRequest, getRequests, getRequestById, approveRequest, rejectRequest, completeRequest, getLowStockItems, exportRequestsExcel };
