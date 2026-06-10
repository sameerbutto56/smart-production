const prisma = require('../prisma');

const getProductionRecords = async (req, res) => {
  try {
    const { startDate, endDate, source, page = 1, limit = 50 } = req.query;
    const where = {};
    if (source) where.source = source;
    if (startDate || endDate) {
      where.productionDate = {};
      if (startDate) where.productionDate.gte = new Date(startDate);
      if (endDate) where.productionDate.lte = new Date(endDate);
    }
    const [records, total] = await Promise.all([
      prisma.productionRecord.findMany({
        where,
        orderBy: { productionDate: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.productionRecord.count({ where })
    ]);
    res.json({ records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production records', error: error.message });
  }
};

const createProductionRecord = async (req, res) => {
  try {
    const { productName, quantity, rawMaterialCost, productionCost, sellingValue, source, orderId, notes, productionDate } = req.body;
    if (!productName || !quantity) {
      return res.status(400).json({ message: 'productName and quantity are required' });
    }
    const qty = parseInt(quantity) || 1;
    const rawCost = parseFloat(rawMaterialCost) || 0;
    const prodCost = parseFloat(productionCost) || 0;
    const totalCost = rawCost + prodCost;
    const sellVal = parseFloat(sellingValue) || 0;
    const profit = sellVal - totalCost;

    const record = await prisma.productionRecord.create({
      data: {
        productName,
        quantity: qty,
        rawMaterialCost: rawCost,
        productionCost: prodCost,
        totalCost,
        sellingValue: sellVal,
        profit,
        source: source || 'OUTLET',
        orderId: orderId || null,
        notes: notes || null,
        productionDate: productionDate ? new Date(productionDate) : new Date()
      }
    });

    // Also upsert into ProductionInventory
    const existing = await prisma.productionInventory.findFirst({
      where: { productName, productionCost: prodCost, sellingValue: sellVal, source: source || 'OUTLET' }
    });
    if (existing) {
      await prisma.productionInventory.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: qty },
          profitMargin: ((sellVal - totalCost) / (sellVal || 1)) * 100
        }
      });
    } else {
      await prisma.productionInventory.create({
        data: {
          productName,
          quantity: qty,
          productionCost: prodCost,
          sellingValue: sellVal,
          profitMargin: ((sellVal - totalCost) / (sellVal || 1)) * 100,
          source: source || 'OUTLET',
          productionDate: new Date()
        }
      });
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error creating production record', error: error.message });
  }
};

const updateProductionRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, quantity, rawMaterialCost, productionCost, sellingValue, source, notes, productionDate } = req.body;
    const existing = await prisma.productionRecord.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Production record not found' });

    const qty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
    const rawCost = rawMaterialCost !== undefined ? parseFloat(rawMaterialCost) : existing.rawMaterialCost;
    const prodCost = productionCost !== undefined ? parseFloat(productionCost) : existing.productionCost;
    const totalCost = rawCost + prodCost;
    const sellVal = sellingValue !== undefined ? parseFloat(sellingValue) : existing.sellingValue;
    const profit = sellVal - totalCost;

    const record = await prisma.productionRecord.update({
      where: { id },
      data: {
        productName: productName || existing.productName,
        quantity: qty,
        rawMaterialCost: rawCost,
        productionCost: prodCost,
        totalCost,
        sellingValue: sellVal,
        profit,
        source: source || existing.source,
        notes: notes !== undefined ? notes : existing.notes,
        productionDate: productionDate ? new Date(productionDate) : existing.productionDate
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: 'Error updating production record', error: error.message });
  }
};

const deleteProductionRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.productionRecord.delete({ where: { id } });
    res.json({ message: 'Production record deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting production record', error: error.message });
  }
};

const getProductionDashboard = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.productionDate = {};
      if (startDate) where.productionDate.gte = new Date(startDate);
      if (endDate) where.productionDate.lte = new Date(endDate);
    }

    const records = await prisma.productionRecord.findMany({ where });

    const totalEarnings = records.reduce((s, r) => s + r.sellingValue, 0);
    const totalProfit = records.reduce((s, r) => s + r.profit, 0);
    const totalQuantity = records.reduce((s, r) => s + r.quantity, 0);
    const totalCost = records.reduce((s, r) => s + r.totalCost, 0);

    const onlineRecords = records.filter(r => r.source?.toUpperCase() === 'ONLINE');
    const outletRecords = records.filter(r => r.source?.toUpperCase() !== 'ONLINE');
    const onlineEarnings = onlineRecords.reduce((s, r) => s + r.sellingValue, 0);
    const outletEarnings = outletRecords.reduce((s, r) => s + r.sellingValue, 0);
    const onlineProfit = onlineRecords.reduce((s, r) => s + r.profit, 0);
    const outletProfit = outletRecords.reduce((s, r) => s + r.profit, 0);

    // Production-wise breakdown
    const productMap = {};
    records.forEach(r => {
      if (!productMap[r.productName]) {
        productMap[r.productName] = { productName: r.productName, quantity: 0, totalCost: 0, sellingValue: 0, profit: 0, count: 0 };
      }
      productMap[r.productName].quantity += r.quantity;
      productMap[r.productName].totalCost += r.totalCost;
      productMap[r.productName].sellingValue += r.sellingValue;
      productMap[r.productName].profit += r.profit;
      productMap[r.productName].count += 1;
    });
    const productBreakdown = Object.values(productMap).sort((a, b) => b.profit - a.profit);

    // Monthly aggregation
    const monthlyMap = {};
    records.forEach(r => {
      const month = new Date(r.productionDate).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!monthlyMap[month]) monthlyMap[month] = { name: month, quantity: 0, profit: 0, sellingValue: 0 };
      monthlyMap[month].quantity += r.quantity;
      monthlyMap[month].profit += r.profit;
      monthlyMap[month].sellingValue += r.sellingValue;
    });
    const monthlyData = Object.values(monthlyMap).sort((a, b) => {
      const da = new Date(a.name + ' 2000'), db = new Date(b.name + ' 2000');
      return da - db;
    });

    res.json({
      totalEarnings,
      totalProfit,
      totalQuantity,
      totalCost,
      onlineEarnings,
      outletEarnings,
      onlineProfit,
      outletProfit,
      productBreakdown,
      monthlyData,
      recordCount: records.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production dashboard', error: error.message });
  }
};

const getProductionInventory = async (req, res) => {
  try {
    const items = await prisma.productionInventory.findMany({ orderBy: { productionDate: 'desc' } });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production inventory', error: error.message });
  }
};

const addToProductionInventory = async (req, res) => {
  try {
    const { productName, quantity, productionCost, sellingValue, source, productionDate } = req.body;
    if (!productName || !quantity) {
      return res.status(400).json({ message: 'productName and quantity are required' });
    }
    const qty = parseInt(quantity) || 1;
    const prodCost = parseFloat(productionCost) || 0;
    const sellVal = parseFloat(sellingValue) || 0;
    const margin = sellVal > 0 ? ((sellVal - prodCost) / sellVal) * 100 : 0;

    const existing = await prisma.productionInventory.findFirst({
      where: { productName, productionCost: prodCost, sellingValue: sellVal, source: source || 'OUTLET' }
    });
    if (existing) {
      const updated = await prisma.productionInventory.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty }, profitMargin: margin }
      });
      return res.json(updated);
    }
    const item = await prisma.productionInventory.create({
      data: {
        productName,
        quantity: qty,
        productionCost: prodCost,
        sellingValue: sellVal,
        profitMargin: margin,
        source: source || 'OUTLET',
        productionDate: productionDate ? new Date(productionDate) : new Date()
      }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to production inventory', error: error.message });
  }
};

const deleteProductionInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.productionInventory.delete({ where: { id } });
    res.json({ message: 'Production inventory item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting production inventory item', error: error.message });
  }
};

module.exports = {
  getProductionRecords,
  createProductionRecord,
  updateProductionRecord,
  deleteProductionRecord,
  getProductionDashboard,
  getProductionInventory,
  addToProductionInventory,
  deleteProductionInventoryItem
};
