const prisma = require('../prisma');
const cache = require('../utils/cache');
const CACHE_KEY_PREFIX = 'pos:';

const getOutletName = (req) => {
  let name = '';
  if (req.user?.role === 'OUTLET') {
    name = req.user?.name || '';
  } else {
    name = req.query.outlet || req.body.outlet || '';
  }
  if (!name) return null; // no outlet = all outlets (admin/store view)
  const n = name.toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return name;
};

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

const generateReceiptNumber = async () => {
  const d = new Date();
  const datePrefix = `RCP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const last = await prisma.posSale.findFirst({
    where: { receiptNumber: { startsWith: datePrefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true }
  });
  let nextNum = 1;
  if (last) {
    const parts = last.receiptNumber.split('-');
    nextNum = parseInt(parts[parts.length - 1] || '0', 10) + 1;
  }
  return `${datePrefix}-${String(nextNum).padStart(5, '0')}`;
};

/* ─── POS Inventory — read-only view of outlet inventory ─── */
const getPosInventory = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}inventory:${outlet || 'all'}`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const where = outlet ? { outletName: outlet } : {};
    const items = await prisma.outletInventory.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const result = items.map(item => {
      let variantDefs = parseItemVariants(item) || [{ color: item.color || null, size: item.size || null }];
      const colors = [...new Set(variantDefs.map(v => v.color).filter(Boolean))];
      const sizes = [...new Set(variantDefs.map(v => v.size).filter(Boolean))];
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        size: item.size,
        fabric: item.fabric,
        stock: item.stock,
        price: item.price || 0,
        imageUrl: item.imageUrl,
        barcode: item.barcode,
        colors,
        sizes,
        variants: item.variants,
        outletName: item.outletName,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    });

    cache.set(cacheKey, result, cache.POS_TTL);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch POS inventory', error: error.message });
  }
};

/* ─── Products for Outlet POS ─── */
const getProducts = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}products:${outlet || 'all'}`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const where = outlet ? { outletName: outlet } : {};
    const items = await prisma.outletInventory.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    const products = items.map(item => {
      let variantDefs = parseItemVariants(item) || [{ color: item.color || null, size: item.size || null }];
      const colors = [...new Set(variantDefs.map(v => v.color).filter(Boolean))];
      const sizes = [...new Set(variantDefs.map(v => v.size).filter(Boolean))];
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        color: item.color,
        size: item.size,
        fabric: item.fabric,
        stock: item.stock,
        price: item.price || 0,
        imageUrl: item.imageUrl,
        barcode: item.barcode,
        colors,
        sizes,
        variants: item.variants,
        outletName: item.outletName
      };
    });

    cache.set(cacheKey, products, cache.POS_TTL);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

/* ─── Outlet Inventory CRUD ─── */
const getVariant = async (req, res) => {
  try {
    const item = await prisma.outletInventory.findUnique({
      where: { id: req.params.id }
    });
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch inventory item', error: e.message });
  }
};

const updateVariantStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const item = await prisma.outletInventory.update({
      where: { id: req.params.id },
      data: { stock: parseInt(stock || 0) }
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update stock', error: error.message });
  }
};

const updateVariantPrice = async (req, res) => {
  try {
    const { price } = req.body;
    const item = await prisma.outletInventory.update({
      where: { id: req.params.id },
      data: { price: price !== null && price !== '' ? parseFloat(price) : null }
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update price', error: error.message });
  }
};

const createVariant = async (req, res) => {
  try {
    const { productId } = req.params;
    const outlet = getOutletName(req);
    const { color, size, stock, price } = req.body;
    const storeItem = await prisma.inventoryItem.findUnique({ where: { id: productId } });
    if (!storeItem) return res.status(404).json({ message: 'Store product not found' });

    let attempt = 0;
    while (true) {
      const barcode = generateBarcode(productId, size, color, attempt);
      try {
        const item = await prisma.outletInventory.create({
          data: {
            outletName: outlet || 'Johar Town',
            name: storeItem.name,
            category: storeItem.category,
            color: color || null,
            size: size || null,
            fabric: storeItem.fabric,
            barcode,
            stock: parseInt(stock || 0),
            price: price !== null && price !== '' ? parseFloat(price) : null,
            imageUrl: storeItem.imageUrl,
            metadata: JSON.stringify({ sourceStoreItemId: storeItem.id })
          }
        });
        cache.delPattern(CACHE_KEY_PREFIX);
        return res.json(item);
      } catch (createErr) {
        if (createErr.code === 'P2002' && attempt < 100) {
          attempt++;
          continue;
        }
        throw createErr;
      }
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to create inventory item', error: error.message });
  }
};

const deleteVariant = async (req, res) => {
  try {
    const item = await prisma.outletInventory.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    const saleCount = await prisma.posSaleItem.count({ where: { outletVariantId: req.params.id } });
    const returnCount = await prisma.posReturn.count({ where: { outletVariantId: req.params.id } });
    if (saleCount > 0 || returnCount > 0) {
      await prisma.outletInventory.update({
        where: { id: req.params.id },
        data: { stock: 0 }
      });
      cache.delPattern(CACHE_KEY_PREFIX);
      return res.json({ message: 'Item has transaction history, stock set to 0' });
    }
    await prisma.outletInventory.delete({ where: { id: req.params.id } });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: 'Inventory item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete inventory item', error: error.message });
  }
};

const deleteProductVariants = async (req, res) => {
  try {
    const { productName } = req.params;
    const outlet = getOutletName(req);
    if (!outlet) return res.status(400).json({ message: 'Outlet is required' });
    const decodedName = decodeURIComponent(productName);

    const items = await prisma.outletInventory.findMany({
      where: { name: decodedName, outletName: outlet }
    });
    if (items.length === 0) return res.status(404).json({ message: 'Product not found in this outlet' });

    let deleted = 0, zeroed = 0;
    for (const item of items) {
      const saleCount = await prisma.posSaleItem.count({ where: { outletVariantId: item.id } });
      const returnCount = await prisma.posReturn.count({ where: { outletVariantId: item.id } });
      if (saleCount > 0 || returnCount > 0) {
        await prisma.outletInventory.update({ where: { id: item.id }, data: { stock: 0 } });
        zeroed++;
      } else {
        await prisma.outletInventory.delete({ where: { id: item.id } });
        deleted++;
      }
    }
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: `Product removed. Deleted: ${deleted}, Zeroed (has history): ${zeroed}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product variants', error: error.message });
  }
};

const updateVariant = async (req, res) => {
  try {
    const { color, size, stock, price, name, category, fabric, imageUrl } = req.body;
    const existing = await prisma.outletInventory.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Inventory item not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (fabric !== undefined) data.fabric = fabric;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (color !== undefined) data.color = color || null;
    if (size !== undefined) data.size = size || null;
    if (stock !== undefined) {
      const parsedStock = parseInt(stock);
      data.stock = isNaN(parsedStock) ? 0 : parsedStock;
    }
    if (price !== undefined) {
      data.price = (price === '' || price === null) ? null : (isNaN(parseFloat(price)) ? null : parseFloat(price));
    }
    if (color !== undefined || size !== undefined) {
      const newColor = color !== undefined ? (color || null) : existing.color;
      const newSize = size !== undefined ? (size || null) : existing.size;
      if (newColor !== existing.color || newSize !== existing.size) {
        let barcode = generateBarcode(existing.id, newSize, newColor);
        let attempt = 0;
        while (await prisma.outletInventory.findFirst({ where: { barcode, outletName: existing.outletName, id: { not: existing.id } } })) {
          attempt++;
          if (attempt > 100) break;
          barcode = generateBarcode(existing.id, newSize, newColor, attempt);
        }
        data.barcode = barcode;
      }
    }

    const item = await prisma.outletInventory.update({
      where: { id: req.params.id },
      data
    });
    cache.delPattern(CACHE_KEY_PREFIX);
    res.json(item);
  } catch (error) {
    console.error('[updateVariant] error:', error.message, error.code);
    res.status(500).json({ message: 'Failed to update inventory item', error: error.message });
  }
};


/* ─── Sales ─── */
const createSale = async (req, res) => {
  try {
    const { items, customerName, alterationCharges, extraCharges, discountPercent, discountFixed, paymentMethod, receiptNumber: manualReceipt } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const outletName = getOutletName(req);
    const receiptNumber = manualReceipt || await generateReceiptNumber();
    let subtotal = 0;
    let totalAlt = parseFloat(alterationCharges || 0);
    let totalExtra = parseFloat(extraCharges || 0);
    const saleItems = [];

    for (const item of items) {
      if (!item.variantId) return res.status(400).json({ message: 'Each item must have a variantId' });
      const inv = await prisma.outletInventory.findUnique({ where: { id: item.variantId } });
      if (!inv) return res.status(400).json({ message: `Inventory item ${item.variantId} not found for outlet ${outletName || 'unknown'}` });
      if (inv.stock < (item.quantity || 1)) return res.status(400).json({ message: `Insufficient stock for ${inv.name} (${inv.color || ''} ${inv.size || ''}). Available: ${inv.stock}` });
      const unitPrice = item.unitPrice || inv.price || 0;
      const qty = item.quantity || 1;
      const lineTotal = unitPrice * qty;
      const itemAlt = parseFloat(item.alterationCharges || 0) * qty;
      subtotal += lineTotal;
      totalAlt += itemAlt;
      saleItems.push({
        outletVariantId: inv.id,
        productName: inv.name,
        size: inv.size,
        color: inv.color,
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
        await tx.outletInventory.update({
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
    const { range, search } = req.query;
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}sales:${outlet || 'all'}:${range || 'all'}${search ? `:${search}` : ''}`;

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
    if (search) where.receiptNumber = { contains: search, mode: 'insensitive' };

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

    // Payment method breakdown
    const salesByMethod = await prisma.posSale.groupBy({
      by: ['paymentMethod'],
      where: whereClause,
      _sum: { grandTotal: true }
    });
    const returnsWithSale = await prisma.posReturn.findMany({
      where: {
        ...(outlet ? { outletName: outlet } : {}),
        ...(startLimit || endLimit ? { createdAt: { gte: startLimit || undefined, lte: endLimit || undefined } } : {}),
        saleId: { not: null }
      },
      select: { refundAmount: true, sale: { select: { paymentMethod: true } } }
    });
    const returnsByMethod = {};
    returnsWithSale.forEach(r => {
      const method = r.sale?.paymentMethod || 'CASH';
      returnsByMethod[method] = (returnsByMethod[method] || 0) + r.refundAmount;
    });
    const paymentBreakdown = salesByMethod.map(sm => {
      const method = sm.paymentMethod;
      const gross = sm._sum.grandTotal || 0;
      const ret = returnsByMethod[method] || 0;
      return { method, gross, returns: ret, net: gross - ret };
    });

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
      paymentBreakdown,
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
    const { variantId, reason, quantity, saleId } = req.body;
    const outlet = getOutletName(req);
    if (!variantId || !quantity) return res.status(400).json({ message: 'variantId and quantity are required' });

    const inv = await prisma.outletInventory.findUnique({ where: { id: variantId } });
    if (!inv) return res.status(400).json({ message: 'Inventory item not found' });
    const refundAmount = (inv.price || 0) * parseInt(quantity);

    const ret = await prisma.$transaction(async (tx) => {
      await tx.outletInventory.update({ where: { id: variantId }, data: { stock: { increment: parseInt(quantity) } } });
      return tx.posReturn.create({
        data: {
          outletVariantId: variantId,
          outletName: outlet || 'Johar Town',
          saleId: saleId || null,
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
      include: { sale: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    // Look up outlet item names for display
    const variantIds = returns.map(r => r.outletVariantId).filter(Boolean);
    const items = variantIds.length > 0 ? await prisma.outletInventory.findMany({ where: { id: { in: variantIds } }, select: { id: true, name: true, color: true, size: true, barcode: true } }) : [];
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
    const mapped = returns.map(r => ({
      ...r,
      _variant: itemMap[r.outletVariantId] ? { product: { name: itemMap[r.outletVariantId].name }, color: itemMap[r.outletVariantId].color, size: itemMap[r.outletVariantId].size, barcode: itemMap[r.outletVariantId].barcode } : null
    }));

    cache.set(cacheKey, mapped, cache.DASHBOARD_TTL);
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch returns', error: error.message });
  }
};

/* ─── Create a new Store Inventory product (master catalog only) ─── */
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

    cache.delPattern(CACHE_KEY_PREFIX);
    res.status(201).json(item);
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

    const inv = await prisma.outletInventory.findFirst({
      where: { barcode, ...(outlet ? { outletName: outlet } : {}) }
    });
    if (!inv) return res.status(404).json({ message: 'Barcode not found' });

    const result = {
      id: inv.id,
      productName: inv.name,
      category: inv.category,
      imageUrl: inv.imageUrl,
      color: inv.color,
      size: inv.size,
      barcode: inv.barcode,
      stock: inv.stock,
      price: inv.price || 0
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

/* ─── Bulk Initialize Outlet Inventory (creates OutletInventory records from Store Inventory data) ─── */
const initializeInventory = async (req, res) => {
  try {
    const { stockData } = req.body; // { "Johar Town": [{ sourceItemId, name, category, color, size, fabric, price, stock, imageUrl, variants }], ... }
    if (!stockData || typeof stockData !== 'object') {
      return res.status(400).json({ message: 'stockData object required with outlet keys' });
    }
    const summary = { created: 0, updated: 0, byOutlet: {} };

    for (const outletName of OUTLETS) {
      const outletItems = stockData[outletName] || [];
      let created = 0, updated = 0;

      for (const sd of outletItems) {
        const existing = await prisma.outletInventory.findFirst({
          where: {
            outletName,
            name: sd.name,
            color: sd.color || null,
            size: sd.size || null
          }
        });
        if (existing) {
          const upd = {};
          if (sd.stock !== undefined) upd.stock = sd.stock;
          if (sd.price !== undefined) upd.price = sd.price;
          if (Object.keys(upd).length > 0) {
            await prisma.outletInventory.update({ where: { id: existing.id }, data: upd });
            updated++;
          }
        } else {
          let barcode = generateBarcode(sd.sourceItemId, sd.size, sd.color);
          let attempt = 0;
          while (await prisma.outletInventory.findFirst({ where: { barcode, outletName } })) {
            attempt++;
            barcode = generateBarcode(sd.sourceItemId, sd.size, sd.color, attempt);
          }
          await prisma.outletInventory.create({
            data: {
              outletName,
              name: sd.name,
              category: sd.category,
              color: sd.color || null,
              size: sd.size || null,
              fabric: sd.fabric || null,
              stock: sd.stock !== undefined ? sd.stock : 0,
              price: sd.price !== undefined ? sd.price : null,
              imageUrl: sd.imageUrl || null,
              barcode,
              variants: sd.variants || null,
              metadata: JSON.stringify({ sourceStoreItemId: sd.sourceItemId })
            }
          });
          created++;
        }
      }
      summary.byOutlet[outletName] = { created, updated };
      summary.created += created;
      summary.updated += updated;
    }

    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: 'Inventory initialized', summary });
  } catch (error) {
    res.status(500).json({ message: 'Failed to initialize inventory', error: error.message });
  }
};

// Trigger Vercel redeploy
module.exports = {
  getPosInventory,
  getProducts,
  getVariant,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, deleteProductVariants, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode,
  createPosProduct,
  updateProduct,
  generateBarcode,
  initializeInventory
};

