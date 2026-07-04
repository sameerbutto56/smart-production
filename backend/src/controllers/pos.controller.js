const prisma = require('../prisma');
const cache = require('../utils/cache');
const CACHE_KEY_PREFIX = 'pos:';

const getOutletName = (req) => req.query.outlet || (req.user?.role === 'OUTLET' ? req.user?.name : null);

const parseItemVariants = (item) => {
  const raw = typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants;
  return Array.isArray(raw) && raw.length > 0 ? raw : null;
};

const djb2 = (s) => {
  if (!s) return 0;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'POS';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|${attempt}`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

/* ─── Helper: ensure OutletVariants exist for a warehouse item ─── */
const ensureOutletVariants = async (item, outletName) => {
  if (!item) return [];
  let variantDefs = [];
  if (Array.isArray(item.variants) && item.variants.length > 0) {
    variantDefs = item.variants;
  } else {
    variantDefs = [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
  }
  const existing = await prisma.outletVariant.findMany({ where: { inventoryItemId: item.id, outletName } });
  const created = [];
  for (const vd of variantDefs) {
    let ov = existing.find(o => o.color === (vd.color || null) && o.size === (vd.size || null));
    if (!ov) {
      let barcode = generateBarcode(item.id, vd.size, vd.color);
      let attempt = 0;
      while (await prisma.outletVariant.findFirst({ where: { barcode, outletName } })) {
        attempt++;
        barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
      }
      ov = await prisma.outletVariant.create({
        data: {
          inventoryItemId: item.id,
          outletName,
          color: vd.color || null,
          size: vd.size || null,
          barcode,
          stock: 0,
          price: vd.price || null,
          isActive: true
        }
      });
      created.push(ov);
    }
  }
  return created;
};

const generateReceiptNumber = (() => {
  let counter = 0;
  const startDate = new Date().toISOString().slice(0, 10);
  return () => {
    counter++;
    const d = new Date();
    const dayKey = d.toISOString().slice(0, 10);
    if (dayKey !== startDate) { counter = 1; }
    return `RCP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(counter).padStart(5, '0')}`;
  };
})();

/* ─── POS Inventory — read-only view of all warehouse products with outlet stock ─── */
const getPosInventory = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}inventory:${outlet || 'all'}`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const items = await prisma.inventoryItem.findMany({
      include: { outletVariants: outlet ? { where: { outletName: outlet } } : true },
      orderBy: { name: 'asc' }
    });

    // Auto-create missing OutletVariants for ALL outlets (so products appear everywhere)
    const outletsToEnsure = outlet ? [...new Set([outlet, ...OUTLETS])] : OUTLETS;
    for (const oName of outletsToEnsure) {
      const existingMap = new Map();
      const existingVariants = await prisma.outletVariant.findMany({ where: { outletName: oName } });
      for (const ev of existingVariants) {
        const key = `${ev.color || ''}|${ev.size || ''}|${ev.inventoryItemId}`;
        existingMap.set(key, ev);
      }
      const toCreate = [];
      for (const item of items) {
        let variantDefs = parseItemVariants(item) || [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
        for (const vd of variantDefs) {
          const key = `${vd.color || ''}|${vd.size || ''}|${item.id}`;
          if (!existingMap.has(key)) {
            let barcode = generateBarcode(item.id, vd.size, vd.color);
            let attempt = 0;
            while (toCreate.some(c => c.barcode === barcode) || await prisma.outletVariant.findFirst({ where: { barcode, outletName: oName } })) {
              attempt++;
              barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
            }
            toCreate.push({
              inventoryItemId: item.id,
              outletName: oName,
              color: vd.color || null,
              size: vd.size || null,
              barcode,
              stock: 0,
              price: vd.price || null,
              isActive: true
            });
          }
        }
      }
      if (toCreate.length > 0) {
        await prisma.outletVariant.createMany({ data: toCreate });
      }
    }
    // Re-fetch variants for the requested outlet
    if (outlet) {
      const allVariants = await prisma.outletVariant.findMany({ where: { outletName: outlet } });
      for (const item of items) {
        item.outletVariants = allVariants.filter(ov => ov.inventoryItemId === item.id);
      }
    }

    const result = items.map(item => {
      let variantDefs = parseItemVariants(item) || [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];

      const colors = [...new Set(variantDefs.map(v => v.color).filter(Boolean))];
      const sizes = [...new Set(variantDefs.map(v => v.size).filter(Boolean))];
      const vars = Array.isArray(item.outletVariants) ? item.outletVariants : [];

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price || 0,
        imageUrl: item.imageUrl,
        colors,
        sizes,
        outletName: outlet || null,
        outletVariants: vars.map(ov => ({
          id: ov.id,
          color: ov.color,
          size: ov.size,
          barcode: ov.barcode,
          stock: ov.stock,
          price: ov.price,
          outletName: ov.outletName
        }))
      };
    });

    cache.set(cacheKey, result, cache.POS_TTL);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch POS inventory', error: error.message });
  }
};

/* ─── Products for Outlet POS (auto-created from warehouse) ─── */
const getProducts = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}products:${outlet || 'all'}`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const allItems = await prisma.inventoryItem.findMany({
      include: { outletVariants: outlet ? { where: { outletName: outlet } } : true },
      orderBy: { name: 'asc' }
    });

    // Re-fetch all variants with inventory items
    const allVariants = await prisma.outletVariant.findMany({
      where: outlet ? { outletName: outlet } : {},
      include: { inventoryItem: true }
    });

    const grouped = {};
    for (const ov of allVariants) {
      const item = ov.inventoryItem;
      if (!item) continue;
      if (!grouped[item.id]) {
        grouped[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price || 0,
          imageUrl: item.imageUrl,
          colors: new Set(),
          sizes: new Set(),
          outletVariants: []
        };
      }
      if (ov.color) grouped[item.id].colors.add(ov.color);
      if (ov.size) grouped[item.id].sizes.add(ov.size);
      grouped[item.id].outletVariants.push({
        id: ov.id,
        color: ov.color,
        size: ov.size,
        barcode: ov.barcode,
        stock: ov.stock,
        price: ov.price
      });
    }

    const products = Object.values(grouped).map(g => ({
      ...g,
      colors: [...g.colors],
      sizes: [...g.sizes]
    }));

    cache.set(cacheKey, products, cache.POS_TTL);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

/* ─── Variants / Stock (outlet-specific) ─── */
const updateVariantStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const variant = await prisma.outletVariant.update({
      where: { id: req.params.id },
      data: { stock: parseInt(stock || 0) }
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update stock', error: error.message });
  }
};

const updateVariantPrice = async (req, res) => {
  try {
    const { price } = req.body;
    const variant = await prisma.outletVariant.update({
      where: { id: req.params.id },
      data: { price: price !== null && price !== '' ? parseFloat(price) : null }
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update variant price', error: error.message });
  }
};

const createVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const outlet = getOutletName(req);
    const { color, size, stock, price } = req.body;
    const item = await prisma.inventoryItem.findUnique({ where: { id: productId } });
    if (!item) return res.status(404).json({ message: 'Product not found' });

    let barcode = generateBarcode(productId, size, color);
    let attempt = 0;
    while (await prisma.outletVariant.findFirst({ where: { barcode, outletName: outlet } })) {
      attempt++;
      barcode = generateBarcode(productId, size, color, attempt);
    }

    const variant = await prisma.outletVariant.create({
      data: {
        inventoryItemId: productId,
        outletName: outlet || 'Johar Town',
        color: color || null,
        size: size || null,
        barcode,
        stock: parseInt(stock || 0),
        price: price !== null && price !== '' ? parseFloat(price) : null
      }
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create variant', error: error.message });
  }
};

const deleteVariant = async (req, res) => {
  try {
    const variant = await prisma.outletVariant.findUnique({ where: { id: req.params.id } });
    if (!variant) return res.status(404).json({ message: 'Variant not found' });
    const saleCount = await prisma.posSaleItem.count({ where: { outletVariantId: req.params.id } });
    const returnCount = await prisma.posReturn.count({ where: { outletVariantId: req.params.id } });
    if (saleCount > 0 || returnCount > 0) {
      await prisma.outletVariant.update({
        where: { id: req.params.id },
        data: { stock: 0 }
      });
      cache.delPattern(CACHE_KEY_PREFIX);
      return res.json({ message: 'Variant has transaction history, stock set to 0' });
    }
    await prisma.outletVariant.delete({ where: { id: req.params.id } });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: 'Variant deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete variant', error: error.message });
  }
};

const updateVariant = async (req, res) => {
  try {
    const { color, size, stock, price } = req.body;
    const existing = await prisma.outletVariant.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Variant not found' });

    const newColor = color !== undefined ? (color || null) : existing.color;
    const newSize = size !== undefined ? (size || null) : existing.size;

    // If color or size changed, check for duplicate color/size combo in this outlet
    if (newColor !== existing.color || newSize !== existing.size) {
      const duplicate = await prisma.outletVariant.findFirst({
        where: {
          inventoryItemId: existing.inventoryItemId,
          outletName: existing.outletName,
          color: newColor,
          size: newSize,
          id: { not: existing.id }
        }
      });
      if (duplicate) {
        return res.status(400).json({ message: `A variant with color "${newColor || 'Standard'}" and size "${newSize || 'Standard'}" already exists in ${existing.outletName}.` });
      }
    }

    const data = {};
    if (color !== undefined) data.color = color || null;
    if (size !== undefined) data.size = size || null;
    if (stock !== undefined) data.stock = parseInt(stock);
    if (price !== undefined) data.price = price !== '' ? parseFloat(price) : null;

    // Regenerate barcode if color/size changed to keep scan data consistent
    if (newColor !== existing.color || newSize !== existing.size) {
      let barcode = generateBarcode(existing.inventoryItemId, newSize, newColor);
      let attempt = 0;
      while (await prisma.outletVariant.findFirst({ where: { barcode, outletName: existing.outletName, id: { not: existing.id } } })) {
        attempt++;
        barcode = generateBarcode(existing.inventoryItemId, newSize, newColor, attempt);
      }
      data.barcode = barcode;
    }

    const variant = await prisma.outletVariant.update({
      where: { id: req.params.id },
      data
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update variant', error: error.message });
  }
};

/* ─── Sales ─── */
const createSale = async (req, res) => {
  try {
    const { items, customerName, alterationCharges, extraCharges, discountPercent, discountFixed, paymentMethod, receiptNumber: manualReceipt } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const outletName = req.user?.name || 'Outlet';
    const receiptNumber = manualReceipt || generateReceiptNumber();
    let subtotal = 0;
    let totalAlt = parseFloat(alterationCharges || 0);
    let totalExtra = parseFloat(extraCharges || 0);
    const saleItems = [];

    for (const item of items) {
      if (!item.variantId) return res.status(400).json({ message: 'Each item must have a variantId' });
      const ov = await prisma.outletVariant.findFirst({
        where: { id: item.variantId, outletName },
        include: { inventoryItem: true }
      });
      if (!ov) return res.status(400).json({ message: `Variant ${item.variantId} not found for outlet ${outletName}` });
      if (ov.stock < (item.quantity || 1)) return res.status(400).json({ message: `Insufficient stock for ${ov.inventoryItem.name} (${ov.color || ''} ${ov.size || ''}). Available: ${ov.stock}` });
      const unitPrice = item.unitPrice || ov.price || ov.inventoryItem.price || 0;
      const qty = item.quantity || 1;
      const lineTotal = unitPrice * qty;
      const itemAlt = parseFloat(item.alterationCharges || 0) * qty;
      subtotal += lineTotal;
      totalAlt += itemAlt;
      saleItems.push({
        outletVariantId: ov.id,
        productName: ov.inventoryItem.name,
        size: ov.size,
        color: ov.color,
        quantity: qty,
        unitPrice,
        alterationCharges: itemAlt,
        lineTotal: lineTotal + itemAlt
      });
    }

    const discountPct = parseFloat(discountPercent || 0);
    const discountFixedVal = parseFloat(discountFixed || 0);
    const discountAmount = ((subtotal + totalAlt + totalExtra) * discountPct) / 100 + discountFixedVal;
    const grandTotal = subtotal + totalAlt + totalExtra - discountAmount;

    const sale = await prisma.$transaction(async (tx) => {
      for (const si of saleItems) {
        await tx.outletVariant.update({
          where: { id: si.outletVariantId },
          data: { stock: { decrement: si.quantity } }
        });
      }
      return tx.posSale.create({
        data: {
          receiptNumber,
          outletName,
          cashierName: req.user?.name || 'Cashier',
          customerName: customerName || null,
          subtotal,
          alterationCharges: totalAlt,
          extraCharges: totalExtra,
          discountPercent: discountPct,
          discountAmount,
          grandTotal,
          paymentMethod: paymentMethod || 'CASH',
          items: { create: saleItems }
        },
        include: { items: true }
      });
    });

    cache.delPattern(CACHE_KEY_PREFIX);
    if (req.app.get('io')) req.app.get('io').emit('inventory-updated', { source: 'pos', outletName, saleId: sale.id });
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create sale', error: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range } = req.query;
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}sales:${outlet || 'all'}:${range || 'all'}`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const now = new Date();
    let dateFilter = {};
    if (range === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'yesterday') { const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); dateFilter = { createdAt: { gte: s, lte: e } }; }
    else if (range === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'month') { const s = new Date(now); s.setMonth(s.getMonth() - 1); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'year') { const s = new Date(now); s.setFullYear(s.getFullYear() - 1); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }

    const where = { ...dateFilter };
    if (outlet) where.outletName = outlet;

    const sales = await prisma.posSale.findMany({
      where,
      include: { items: true, returns: true },
      orderBy: { createdAt: 'desc' }
    });

    cache.set(cacheKey, sales, cache.DASHBOARD_TTL);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales', error: error.message });
  }
};

const getSalesDashboard = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { dateFrom, dateTo, range = 'all' } = req.query;
    
    // We bypass cache if custom dates or skipCache are requested
    const skip = req.query.skipCache === 'true' || dateFrom || dateTo;
    const cacheKey = `${CACHE_KEY_PREFIX}dashboard:${outlet || 'all'}:${range}`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const now = new Date();
    let startLimit = null;
    let endLimit = null;

    if (dateFrom) {
      startLimit = new Date(dateFrom);
    }
    if (dateTo) {
      endLimit = new Date(dateTo);
      endLimit.setHours(23, 59, 59, 999);
    }

    if (!startLimit && !endLimit) {
      if (range === 'today') {
        startLimit = new Date(now); startLimit.setHours(0, 0, 0, 0);
      } else if (range === 'yesterday') {
        startLimit = new Date(now); startLimit.setDate(startLimit.getDate() - 1); startLimit.setHours(0, 0, 0, 0);
        endLimit = new Date(startLimit); endLimit.setHours(23, 59, 59, 999);
      } else if (range === 'week') {
        startLimit = new Date(now); startLimit.setDate(startLimit.getDate() - 7); startLimit.setHours(0, 0, 0, 0);
      } else if (range === 'month') {
        startLimit = new Date(now); startLimit.setMonth(startLimit.getMonth() - 1); startLimit.setHours(0, 0, 0, 0);
      } else if (range === 'year') {
        startLimit = new Date(now); startLimit.setFullYear(startLimit.getFullYear() - 1); startLimit.setHours(0, 0, 0, 0);
      }
    }

    const whereClause = {};
    if (outlet) {
      whereClause.outletName = outlet;
    }
    if (startLimit || endLimit) {
      whereClause.createdAt = {};
      if (startLimit) whereClause.createdAt.gte = startLimit;
      if (endLimit) whereClause.createdAt.lte = endLimit;
    }

    // 1. Basic Stats aggregation
    const [salesAgg, returnsAgg, discountAgg] = await Promise.all([
      prisma.posSale.aggregate({
        where: whereClause,
        _sum: { grandTotal: true, subtotal: true },
        _count: true
      }),
      prisma.posReturn.aggregate({
        where: outlet ? { outletName: outlet, ...(startLimit || endLimit ? { createdAt: { gte: startLimit || undefined, lte: endLimit || undefined } } : {}) } : (startLimit || endLimit ? { createdAt: { gte: startLimit || undefined, lte: endLimit || undefined } } : {}),
        _sum: { refundAmount: true },
        _count: true
      }),
      prisma.posSale.aggregate({
        where: whereClause,
        _sum: { discountAmount: true }
      })
    ]);

    const totalSales = salesAgg._sum.grandTotal || 0;
    const totalOrders = salesAgg._count || 0;
    const totalReturns = returnsAgg._count || 0;
    const refundAmount = returnsAgg._sum.refundAmount || 0;
    const netRevenue = totalSales - refundAmount;
    const totalDiscount = discountAgg._sum.discountAmount || 0;

    // 2. Fetch completed/pending/cancelled orders from main order table for comparison
    const orderWhere = {};
    if (outlet) {
      // Normalize comparison for outlet names in Order model vs POS outlet name
      orderWhere.outletName = { contains: outlet, mode: 'insensitive' };
    }
    if (startLimit || endLimit) {
      orderWhere.createdAt = {};
      if (startLimit) orderWhere.createdAt.gte = startLimit;
      if (endLimit) orderWhere.createdAt.lte = endLimit;
    }

    const [completedOrders, pendingOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where: { ...orderWhere, status: 'COMPLETED' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'PENDING' } }),
      prisma.order.count({ where: { ...orderWhere, status: 'CANCELLED' } })
    ]);

    // 3. Fetch all sales for trend charts & peak day analysis
    const allSales = await prisma.posSale.findMany({
      where: whereClause,
      select: { createdAt: true, grandTotal: true, receiptNumber: true, outletName: true }
    });

    const salesByDay = {};
    const ordersByDay = {};
    
    allSales.forEach(s => {
      const day = s.createdAt.toISOString().split('T')[0];
      salesByDay[day] = (salesByDay[day] || 0) + s.grandTotal;
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    });

    let highestSalesDay = { date: 'N/A', amount: 0 };
    let highestOrdersDay = { date: 'N/A', count: 0 };

    Object.entries(salesByDay).forEach(([date, amount]) => {
      if (amount > highestSalesDay.amount) {
        highestSalesDay = { date, amount };
      }
    });

    Object.entries(ordersByDay).forEach(([date, count]) => {
      if (count > highestOrdersDay.count) {
        highestOrdersDay = { date, count };
      }
    });

    // 4. Best selling products (aggregate line items)
    const saleItems = await prisma.posSaleItem.findMany({
      where: {
        sale: whereClause
      },
      select: { productName: true, quantity: true }
    });

    const productCounts = {};
    saleItems.forEach(item => {
      productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
    });

    const bestSellingProducts = Object.entries(productCounts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // 5. Best performing branch (comparison if viewing 'all')
    const branchPerformance = [];
    if (!outlet) {
      const branches = ['Johar Town', 'Jail Road', 'Abbottabad'];
      for (const b of branches) {
        const bSales = allSales.filter(s => s.outletName && s.outletName.toLowerCase().includes(b.toLowerCase()));
        const revenue = bSales.reduce((sum, s) => sum + s.grandTotal, 0);
        const orders = bSales.length;
        branchPerformance.push({ branch: b, revenue, orders });
      }
      branchPerformance.sort((a, b) => b.revenue - a.revenue);
    }

    // 6. Trend reports structured for charting (last 12 months, days, etc.)
    const reportData = Object.entries(salesByDay).map(([date, sales]) => ({
      date,
      sales,
      orders: ordersByDay[date] || 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      totalSales,
      totalOrders,
      completedOrders: totalOrders + completedOrders, // POS + main table completed
      pendingOrders,
      cancelledOrders,
      returnedOrders: totalReturns,
      netRevenue,
      totalDiscount,
      highestSalesDay,
      highestOrdersDay,
      bestSellingProducts,
      branchPerformance,
      reportData,
      outletName: outlet || 'All Branches'
    };

    if (!skip) {
      cache.set(cacheKey, result, cache.DASHBOARD_TTL);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard sales analytics', error: error.message });
  }
};

/* ─── Returns ─── */
const createReturn = async (req, res) => {
  try {
    const { variantId, reason, quantity } = req.body;
    const outlet = getOutletName(req);
    if (!variantId || !quantity) return res.status(400).json({ message: 'variantId and quantity are required' });

    const ov = await prisma.outletVariant.findUnique({ where: { id: variantId }, include: { inventoryItem: true } });
    if (!ov) return res.status(400).json({ message: 'Variant not found' });
    const refundAmount = (ov.price || ov.inventoryItem.price || 0) * parseInt(quantity);

    const ret = await prisma.$transaction(async (tx) => {
      await tx.outletVariant.update({ where: { id: variantId }, data: { stock: { increment: parseInt(quantity) } } });
      return tx.posReturn.create({
        data: {
          outletVariantId: variantId,
          outletName: outlet || 'Johar Town',
          reason: reason || null,
          quantity: parseInt(quantity),
          refundAmount
        }
      });
    });

    cache.delPattern(CACHE_KEY_PREFIX);
    res.status(201).json(ret);
  } catch (error) {
    res.status(500).json({ message: 'Failed to process return', error: error.message });
  }
};

const getReturns = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}returns:${outlet || 'all'}`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const where = outlet ? { outletName: outlet } : {};
    const returns = await prisma.posReturn.findMany({
      where,
      include: { outletVariant: { include: { inventoryItem: true } }, sale: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    const mapped = returns.map(r => ({
      ...r,
      _variant: {
        product: r.outletVariant?.inventoryItem ? { name: r.outletVariant.inventoryItem.name } : null,
        color: r.outletVariant?.color,
        size: r.outletVariant?.size,
        barcode: r.outletVariant?.barcode
      }
    }));

    cache.set(cacheKey, mapped, cache.DASHBOARD_TTL);
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch returns', error: error.message });
  }
};

/* ─── Create a new product from POS (product master + OutletVariants for all outlets, stock always 0) ─── */
const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const createPosProduct = async (req, res) => {
  try {
    const { name, category, fabric, imageUrl, variants } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: 'Product name and category are required' });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        fabric: fabric || null,
        imageUrl: imageUrl || null,
        stock: 0,
        price: null,
        variants: variants || null
      }
    });

    // Auto-create OutletVariants for each outlet
    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const vd of variants) {
        for (const outletName of OUTLETS) {
          let barcode = generateBarcode(item.id, vd.size, vd.color);
          let attempt = 0;
          while (await prisma.outletVariant.findFirst({ where: { barcode, outletName } })) {
            attempt++;
            barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
          }
          await prisma.outletVariant.create({
            data: {
              inventoryItemId: item.id,
              outletName,
              color: vd.color || null,
              size: vd.size || null,
              barcode,
              stock: 0,
              price: vd.price || null,
              isActive: true
            }
          });
        }
      }
    } else {
      // Single variant if no variants array
      for (const outletName of OUTLETS) {
        let barcode = generateBarcode(item.id, null, null);
        let attempt = 0;
        while (await prisma.outletVariant.findFirst({ where: { barcode, outletName } })) {
          attempt++;
          barcode = generateBarcode(item.id, null, null, attempt);
        }
        await prisma.outletVariant.create({
          data: {
            inventoryItemId: item.id,
            outletName,
            color: null,
            size: null,
            barcode,
            stock: 0,
            price: null,
            isActive: true
          }
        });
      }
    }

    const itemWithVariants = await prisma.inventoryItem.findUnique({
      where: { id: item.id },
      include: { outletVariants: true }
    });

    cache.delPattern(CACHE_KEY_PREFIX);
    res.status(201).json(itemWithVariants);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

/* ─── Barcode lookup ─── */
const lookupBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const outlet = getOutletName(req);
    const cacheKey = `${CACHE_KEY_PREFIX}barcode:${outlet || 'all'}:${barcode}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const ov = await prisma.outletVariant.findFirst({
      where: { barcode, ...(outlet ? { outletName: outlet } : {}) },
      include: { inventoryItem: true }
    });
    if (!ov) return res.status(404).json({ message: 'Barcode not found' });

    const result = {
      id: ov.id,
      inventoryItemId: ov.inventoryItemId,
      productName: ov.inventoryItem.name,
      category: ov.inventoryItem.category,
      imageUrl: ov.inventoryItem.imageUrl,
      color: ov.color,
      size: ov.size,
      barcode: ov.barcode,
      stock: ov.stock,
      price: ov.price || ov.inventoryItem.price || 0,
      product: { id: ov.inventoryItem.id, name: ov.inventoryItem.name, price: ov.inventoryItem.price || 0 }
    };

    cache.set(cacheKey, result, cache.BARCODE_TTL);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to lookup barcode', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { name, category, fabric, imageUrl } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (fabric !== undefined) data.fabric = fabric;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

/* ─── Bulk Initialize Inventory (one-time: ensures all outlets have variants, sets opening stock) ─── */
const initializeInventory = async (req, res) => {
  try {
    const { stockData } = req.body; // { "Johar Town": [{ productId, color, size, stock }], ... }
    if (!stockData || typeof stockData !== 'object') {
      return res.status(400).json({ message: 'stockData object required with outlet keys' });
    }
    const summary = { variantsCreated: 0, variantsUpdated: 0, byOutlet: {} };
    const allItems = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });

    for (const outletName of OUTLETS) {
      const outletItems = stockData[outletName] || [];
      const itemMap = Object.fromEntries(outletItems.map(i => [`${i.productId}|${i.color || ''}|${i.size || ''}`, i]));
      let created = 0, updated = 0;

      for (const item of allItems) {
        let variantDefs = parseItemVariants(item) || [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
        for (const vd of variantDefs) {
          const key = `${item.id}|${vd.color || ''}|${vd.size || ''}`;
          const desiredStock = itemMap[key]?.stock;
          const existing = await prisma.outletVariant.findFirst({
            where: { inventoryItemId: item.id, outletName, color: vd.color || null, size: vd.size || null }
          });
          if (existing) {
            if (desiredStock !== undefined && desiredStock !== existing.stock) {
              await prisma.outletVariant.update({ where: { id: existing.id }, data: { stock: desiredStock } });
              updated++;
            }
          } else {
            let barcode = generateBarcode(item.id, vd.size, vd.color);
            let attempt = 0;
            while (await prisma.outletVariant.findFirst({ where: { barcode, outletName } })) {
              attempt++;
              barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
            }
            await prisma.outletVariant.create({
              data: {
                inventoryItemId: item.id,
                outletName,
                color: vd.color || null,
                size: vd.size || null,
                barcode,
                stock: desiredStock !== undefined ? desiredStock : 0,
                price: vd.price || null,
                isActive: true
              }
            });
            created++;
          }
        }
      }
      summary.byOutlet[outletName] = { created, updated };
      summary.variantsCreated += created;
      summary.variantsUpdated += updated;
    }

    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: 'Inventory initialized', summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to initialize inventory', error: error.message });
  }
};

module.exports = {
  getPosInventory,
  getProducts,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode,
  createPosProduct,
  updateProduct,
  generateBarcode,
  initializeInventory
};
