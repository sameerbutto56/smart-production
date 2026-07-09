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

/* ─── View-only: all outlets inventory (bypasses OUTLET role restriction) ─── */
const getAllOutletsView = async (req, res) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}inventory:all-outlets-view`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const items = await prisma.outletInventory.findMany({
      orderBy: [{ name: 'asc' }, { outletName: 'asc' }]
    });

    const result = items.map(item => ({
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
      outletName: item.outletName,
    }));

    cache.set(cacheKey, result, cache.POS_TTL);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch all outlets view', error: error.message });
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
      where: { name: decodedName, outletName: outlet },
      select: { id: true }
    });
    if (items.length === 0) return res.status(404).json({ message: 'Product not found in this outlet' });

    const itemIds = items.map(i => i.id);
    const [saleItems, returnItems] = await Promise.all([
      prisma.posSaleItem.findMany({ where: { outletVariantId: { in: itemIds } }, select: { outletVariantId: true } }),
      prisma.posReturn.findMany({ where: { outletVariantId: { in: itemIds } }, select: { outletVariantId: true } })
    ]);
    const hasHistoryIds = new Set([
      ...saleItems.map(s => s.outletVariantId),
      ...returnItems.map(r => r.outletVariantId)
    ]);

    let deleted = 0, zeroed = 0;
    for (const item of items) {
      if (hasHistoryIds.has(item.id)) {
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
    const { items, customerName, customerPhone, extraCharges, discountPercent, discountFixed, paymentMethod, advanceAmount, cardChargesPct, orderId, receiptNumber: manualReceipt, cashierName, faisalTake } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const outletName = getOutletName(req);
    const receiptNumber = manualReceipt || await generateReceiptNumber();
    let subtotal = 0;
    let totalAlt = 0;
    let totalItemDiscount = 0;
    let netAfterItems = 0;
    const saleItems = [];

    for (const item of items) {
      if (!item.variantId) return res.status(400).json({ message: 'Each item must have a variantId' });
      const inv = await prisma.outletInventory.findUnique({ where: { id: item.variantId } });
      if (!inv) return res.status(400).json({ message: `Inventory item ${item.variantId} not found for outlet ${outletName || 'unknown'}` });
      if (inv.stock < (item.quantity || 1)) return res.status(400).json({ message: `Insufficient stock for ${inv.name} (${inv.color || ''} ${inv.size || ''}). Available: ${inv.stock}` });
      const unitPrice = item.unitPrice || inv.price || 0;
      const qty = item.quantity || 1;
      const lineBase = unitPrice * qty;
      const itemAlt = parseFloat(item.alterationCharges || 0);
      const cust1 = item.customization1 ? 500 : 0;
      const cust2 = item.customization2 ? 1000 : 0;
      const engrave = item.nameEngrave ? 300 : 0;
      const custCharges = cust1 + cust2 + engrave;
      const otherCharges = parseFloat(item.otherCharges || 0);
      const dpct = parseFloat(item.discountPct || 0);
      const dfixed = parseFloat(item.discountFixed || 0);
      const itemDiscount = (lineBase * dpct / 100) + dfixed;
      const itemNet = Math.max(0, lineBase - itemDiscount) + itemAlt + custCharges + otherCharges;
      subtotal += lineBase;
      totalAlt += itemAlt;
      totalItemDiscount += itemDiscount;
      netAfterItems += itemNet;
      saleItems.push({
        outletVariantId: inv.id,
        productName: inv.name,
        size: inv.size,
        color: inv.color,
        quantity: qty,
        unitPrice,
        alterationCharges: itemAlt,
        customization1: item.customization1 || false,
        customization2: item.customization2 || false,
        nameEngrave: item.nameEngrave || false,
        customizationCharges: custCharges,
        otherCharges,
        discountPct: dpct,
        discountFixed: dfixed,
        lineTotal: itemNet
      });
    }

    const globalPct = parseFloat(discountPercent || 0);
    const globalFixed = parseFloat(discountFixed || 0);
    const globalDiscountAmt = (netAfterItems * globalPct / 100) + globalFixed;
    const discountAmount = totalItemDiscount + globalDiscountAmt;
    const netAfterGlobal = netAfterItems - globalDiscountAmt;
    const cardPct = parseFloat(cardChargesPct || 0);
    const cardChargesAmount = (netAfterItems * cardPct) / 100;
    const grandTotal = netAfterGlobal + cardChargesAmount;

    const isFaisalTake = faisalTake === true || faisalTake === 'true';

    const sale = await prisma.$transaction(async (tx) => {
      for (const si of saleItems) {
        await tx.outletInventory.update({
          where: { id: si.outletVariantId },
          data: { stock: { decrement: si.quantity } }
        });
      }
      if (orderId) {
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'PAID' }
        });
      }
      return tx.posSale.create({
        data: {
          receiptNumber,
          outletName,
          cashierName: cashierName || req.user?.name || 'Cashier',
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          subtotal: isFaisalTake ? 0 : subtotal,
          alterationCharges: isFaisalTake ? 0 : totalAlt,
          discountPercent: isFaisalTake ? 0 : globalPct,
          discountAmount: isFaisalTake ? 0 : discountAmount,
          grandTotal: isFaisalTake ? 0 : grandTotal,
          advanceAmount: isFaisalTake ? 0 : (parseFloat(advanceAmount || 0)),
          orderId: isFaisalTake ? null : (orderId || null),
          cardChargesPct: isFaisalTake ? 0 : cardPct,
          cardChargesAmount: isFaisalTake ? 0 : cardChargesAmount,
          paymentMethod: isFaisalTake ? 'FAISAL_TAKE' : (paymentMethod || 'CASH'),
          faisalTake: isFaisalTake,
          faisalTakenAt: isFaisalTake ? new Date() : null,
          items: { create: saleItems.map(si => ({ ...si, lineTotal: isFaisalTake ? 0 : si.lineTotal })) }
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
    const { range, search, dateFrom, dateTo } = req.query;
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}sales:${outlet || 'all'}:${range || 'all'}${dateFrom ? `:${dateFrom}` : ''}${dateTo ? `:${dateTo}` : ''}${search ? `:${search}` : ''}`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const now = new Date();
    let dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) { const s = new Date(dateFrom); s.setHours(0, 0, 0, 0); dateFilter.createdAt.gte = s; }
      if (dateTo) { const e = new Date(dateTo); e.setHours(23, 59, 59, 999); dateFilter.createdAt.lte = e; }
    } else if (range === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
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

    const whereClause = { faisalTake: { not: true } };
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

    // 3. Fetch all sales for trend charts & revenue calculation
    const allSales = await prisma.posSale.findMany({
      where: whereClause,
      select: { id: true, createdAt: true, grandTotal: true, advanceAmount: true, receiptNumber: true, outletName: true, paymentMethod: true }
    });
    const saleIds = allSales.map(s => s.id);
    const balancePayments = saleIds.length > 0 ? await prisma.posBalancePayment.findMany({
      where: { posSaleId: { in: saleIds } },
      select: { posSaleId: true, amountPaidNow: true, paidAt: true, paymentMethod: true }
    }) : [];

    // Calculate total sales by actual payment dates
    // For each sale: count advanceAmount on sale date (or full grandTotal if fully paid upfront)
    // Balance payments are counted on their payment dates (handled above in salesByDay)
    let totalSales = 0;
    allSales.forEach(s => {
      totalSales += s.advanceAmount >= s.grandTotal ? s.grandTotal : s.advanceAmount;
    });
    balancePayments.forEach(bp => {
      totalSales += bp.amountPaidNow;
    });
    const totalOrders = salesAgg._count || 0;
    const totalReturns = returnsAgg._count || 0;
    const refundAmount = returnsAgg._sum.refundAmount || 0;
    const netRevenue = totalSales - refundAmount;
    const totalDiscount = discountAgg._sum.discountAmount || 0;

    // Payment method breakdown — by actual payment received (not invoice total)
    // For original sales: count advanceAmount (or full grandTotal if paid upfront) by sale's paymentMethod
    // For balance payments: count amountPaidNow by balance payment's paymentMethod
    const paymentTotals = {};
    allSales.forEach(s => {
      const method = ['CASH', 'CARD', 'ONLINE'].includes(s.paymentMethod) ? s.paymentMethod : 'CASH';
      const received = s.advanceAmount >= s.grandTotal ? s.grandTotal : s.advanceAmount;
      paymentTotals[method] = (paymentTotals[method] || 0) + received;
    });
    // Add balance payments by their payment method
    balancePayments.forEach(bp => {
      const method = ['CASH', 'CARD', 'ONLINE'].includes(bp.paymentMethod) ? bp.paymentMethod : 'CASH';
      paymentTotals[method] = (paymentTotals[method] || 0) + bp.amountPaidNow;
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
    const paymentBreakdown = ['CASH', 'CARD', 'ONLINE'].map(method => {
      const gross = paymentTotals[method] || 0;
      const ret = returnsByMethod[method] || 0;
      return { method, gross, returns: ret, net: gross - ret };
    });

    // 2. Balance orders — POS sales linked to orders with advance payments
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

    const salesByDay = {};
    const ordersByDay = {};

    allSales.forEach(s => {
      const day = s.createdAt.toISOString().split('T')[0];
      // For fully paid sales (advance = grandTotal), count full amount on sale date
      // For partial payment sales, count only the advance amount on sale date
      const saleRevenue = s.advanceAmount >= s.grandTotal ? s.grandTotal : s.advanceAmount;
      salesByDay[day] = (salesByDay[day] || 0) + saleRevenue;
      ordersByDay[day] = (ordersByDay[day] || 0) + 1;
    });

    // Add balance payments by their payment dates
    balancePayments.forEach(bp => {
      const day = bp.paidAt.toISOString().split('T')[0];
      salesByDay[day] = (salesByDay[day] || 0) + bp.amountPaidNow;
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

    // 7. Balance orders — POS sales linked to orders with advance
    const balanceSales = await prisma.posSale.findMany({
      where: { ...whereClause, orderId: { not: null } },
      select: {
        id: true, receiptNumber: true, grandTotal: true, advanceAmount: true,
        customerName: true, paymentMethod: true, createdAt: true, orderId: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const balanceOrders = balanceSales.map(ps => ({
      id: ps.id,
      receiptNumber: ps.receiptNumber,
      customerName: ps.customerName,
      paid: ps.grandTotal,
      advanceAmount: ps.advanceAmount,
      totalWithAdvance: ps.grandTotal + ps.advanceAmount,
      paymentMethod: ps.paymentMethod,
      createdAt: ps.createdAt,
      orderId: ps.orderId
    }));

    // 8. Faisal Takes — products taken by Faisal (not sales)
    const faisalTakes = await prisma.posSale.findMany({
      where: { ...whereClause, faisalTake: true },
      select: {
        id: true, receiptNumber: true, cashierName: true, createdAt: true, faisalTakenAt: true,
        items: { select: { productName: true, quantity: true, size: true, color: true, unitPrice: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const result = {
      totalSales,
      totalOrders,
      completedOrders: totalOrders + completedOrders,
      pendingOrders,
      cancelledOrders,
      returnedOrders: totalReturns,
      netRevenue,
      totalDiscount,
      paymentBreakdown,
      balanceOrders,
      highestSalesDay,
      highestOrdersDay,
      bestSellingProducts,
      branchPerformance,
      reportData,
      outletName: outlet || 'All Branches',
      faisalTakes
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
    const { variantId, reason, quantity, saleId, refundPaymentMethod } = req.body;
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
          refundAmount,
          refundPaymentMethod: refundPaymentMethod || 'CASH'
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
    const { name, category, fabric, imageUrl, price, variants } = req.body;
    if (!name || !category) {
      return res.status(400).json({ message: 'Product name and category are required' });
    }

    let computedPrice = price;
    if ((!price || price === 0) && variants && Array.isArray(variants) && variants.length > 0) {
      const firstPrice = parseFloat(variants[0].price);
      computedPrice = isNaN(firstPrice) ? 0 : firstPrice;
    } else if (!price || price === 0) {
      computedPrice = 0;
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category,
        fabric: fabric || null,
        imageUrl: imageUrl || null,
        stock: 0,
        price: parseFloat(computedPrice) || 0,
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
    const barcode = req.params.barcode.toUpperCase();
    const outlet = getOutletName(req);
    if (!outlet) return res.status(400).json({ message: 'Outlet required' });
    const cacheKey = `${CACHE_KEY_PREFIX}barcode:${outlet}:${barcode}`;

    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    let inv = await prisma.outletInventory.findFirst({
      where: { barcode: { equals: barcode, mode: 'insensitive' }, outletName: outlet }
    });

    if (!inv) {
      inv = await createOutletVariantFromBarcode(barcode, outlet);
    }

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

const createOutletVariantFromBarcode = async (barcode, outlet) => {
  const stores = await prisma.inventoryItem.findMany({ where: { isActive: true } });
  for (const store of stores) {
    const baseBarcode = generateBarcode(store.id, null, null);
    if (baseBarcode.toUpperCase() === barcode) {
      return prisma.outletInventory.create({
        data: {
          outletName: outlet, name: store.name, category: store.category,
          color: null, size: null, fabric: store.fabric, barcode: baseBarcode,
          stock: 0, price: store.price || 0, imageUrl: store.imageUrl,
          variants: store.variants,
          metadata: JSON.stringify({ sourceStoreItemId: store.id, autoCreated: true })
        }
      });
    }
    const variants = typeof store.variants === 'string' ? JSON.parse(store.variants) : store.variants;
    if (Array.isArray(variants)) {
      for (const v of variants) {
        const vb = generateBarcode(store.id, v.size || null, v.color || null);
        if (vb.toUpperCase() === barcode) {
          return prisma.outletInventory.create({
            data: {
              outletName: outlet, name: store.name, category: store.category,
              color: v.color || null, size: v.size || null, fabric: store.fabric, barcode: vb,
              stock: 0, price: v.price || store.price || 0, imageUrl: store.imageUrl,
              variants: store.variants,
              metadata: JSON.stringify({ sourceStoreItemId: store.id, autoCreated: true })
            }
          });
        }
      }
    }
  }
  return null;
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

const orderLookup = async (req, res) => {
  try {
    const { orderNumber, phone } = req.query;
    if (!orderNumber && !phone) return res.status(400).json({ message: 'orderNumber or phone is required' });
    const where = orderNumber ? { orderNumber } : { customerPhone: phone };
    const order = await prisma.order.findFirst({ where });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.paymentStatus === 'PAID') return res.json({ paid: true, message: 'This order is already fully paid', orderNumber: order.orderNumber });
    let productDetails = [];
    try { productDetails = JSON.parse(order.productDetails || '[]'); } catch {}
    const totalPrice = order.totalPrice || productDetails.reduce((s, p) => s + (parseFloat(p.totalPrice) || 0), 0);
    const adv = parseFloat(order.advanceAmount) || 0;
    const balance = totalPrice - adv;
    res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalPrice,
      advanceAmount: adv,
      balance,
      paymentStatus: order.paymentStatus,
      productDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Order lookup failed', error: error.message });
  }
};

/* ─── Balance Payment ─── */

// Generate receipt number for balance payments
const generateBalanceReceiptNumber = async () => {
  const d = new Date();
  const prefix = `BP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
  let isUnique = false;
  let receiptNumber;
  while (!isUnique) {
    const seq = Math.floor(1000 + Math.random() * 9000);
    receiptNumber = `${prefix}${seq}`;
    const existing = await prisma.posBalancePayment.findUnique({ where: { receiptNumber }, select: { id: true } });
    if (!existing) isUnique = true;
  }
  return receiptNumber;
};

// List invoices with outstanding balance
const getBalanceInvoices = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const where = { faisalTake: { not: true }, orderId: { not: null } };
    if (outlet) where.outletName = outlet;

    const sales = await prisma.posSale.findMany({
      where,
      include: { balancePayments: { select: { amountPaidNow: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const invoices = sales
      .map(s => {
        const totalPaid = s.advanceAmount + s.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
        const remaining = s.grandTotal - totalPaid;
        return {
          id: s.id,
          receiptNumber: s.receiptNumber,
          customerName: s.customerName,
          customerPhone: s.customerPhone,
          grandTotal: s.grandTotal,
          advanceAmount: s.advanceAmount,
          totalPaid,
          remaining,
          paymentMethod: s.paymentMethod,
          createdAt: s.createdAt,
          paymentCount: s.balancePayments.length
        };
      })
      .filter(inv => inv.remaining > 0.01)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch balance invoices', error: error.message });
  }
};

// Get detailed invoice with payment history
const getInvoiceBalance = async (req, res) => {
  try {
    const { saleId } = req.params;
    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: {
        balancePayments: { orderBy: { paidAt: 'asc' } }
      }
    });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });

    const totalPaidFromPayments = sale.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
    const totalPaid = sale.advanceAmount + totalPaidFromPayments;
    const remaining = sale.grandTotal - totalPaid;

    res.json({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      grandTotal: sale.grandTotal,
      advanceAmount: sale.advanceAmount,
      totalPaid,
      remaining: Math.max(0, remaining),
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt,
      cashierName: sale.cashierName,
      paymentHistory: sale.balancePayments.map(bp => ({
        id: bp.id,
        receiptNumber: bp.receiptNumber,
        amountPaidNow: bp.amountPaidNow,
        remainingBalanceBeforePayment: bp.remainingBalanceBeforePayment,
        outstandingBalanceAfterPayment: bp.outstandingBalanceAfterPayment,
        paymentMethod: bp.paymentMethod,
        cashierName: bp.cashierName,
        paidAt: bp.paidAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch invoice details', error: error.message });
  }
};

// Pay remaining balance
const payBalance = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { amountPaidNow, paymentMethod } = req.body;
    const outletName = getOutletName(req);

    if (!amountPaidNow || amountPaidNow <= 0) return res.status(400).json({ message: 'Amount must be greater than 0' });

    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: { balancePayments: { select: { amountPaidNow: true } } }
    });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });
    if (sale.faisalTake) return res.status(400).json({ message: 'Cannot pay balance on Faisal Take' });

    const totalPaidFromPayments = sale.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
    const totalPaid = sale.advanceAmount + totalPaidFromPayments;
    const remaining = sale.grandTotal - totalPaid;

    if (remaining <= 0.01) return res.status(400).json({ message: 'Invoice is already fully paid' });
    if (amountPaidNow > remaining + 0.01) return res.status(400).json({ message: `Amount exceeds remaining balance of ₨${remaining.toFixed(2)}` });

    const receiptNumber = await generateBalanceReceiptNumber();
    const outstandingAfter = Math.max(0, remaining - amountPaidNow);

    const payment = await prisma.posBalancePayment.create({
      data: {
        posSaleId: saleId,
        receiptNumber,
        originalInvoiceNumber: sale.receiptNumber,
        originalInvoiceTotal: sale.grandTotal,
        previouslyPaidAmount: totalPaid,
        remainingBalanceBeforePayment: remaining,
        amountPaidNow,
        outstandingBalanceAfterPayment: outstandingAfter,
        paymentMethod: paymentMethod || 'CASH',
        cashierName: req.user?.name || 'Cashier',
        paidAt: new Date()
      }
    });

    cache.delPattern(CACHE_KEY_PREFIX);
    if (req.app.get('io')) req.app.get('io').emit('inventory-updated', { source: 'pos', outletName, balancePayment: true });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to process balance payment', error: error.message });
  }
};

// Balance collections dashboard card data
const getBalanceCollections = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { dateFrom, dateTo, range } = req.query;

    const now = new Date();
    let startLimit = null;
    let endLimit = null;

    if (dateFrom) startLimit = new Date(dateFrom);
    if (dateTo) { endLimit = new Date(dateTo); endLimit.setHours(23, 59, 59, 999); }

    if (!startLimit && !endLimit) {
      if (range === 'today') { startLimit = new Date(now); startLimit.setHours(0, 0, 0, 0); }
      else if (range === 'yesterday') {
        startLimit = new Date(now); startLimit.setDate(startLimit.getDate() - 1); startLimit.setHours(0, 0, 0, 0);
        endLimit = new Date(startLimit); endLimit.setHours(23, 59, 59, 999);
      }
      else if (range === 'month') { startLimit = new Date(now); startLimit.setMonth(startLimit.getMonth() - 1); startLimit.setHours(0, 0, 0, 0); }
    }

    const where = {};
    if (outlet) {
      where.posSale = { outletName: outlet };
    }
    if (startLimit || endLimit) {
      where.paidAt = {};
      if (startLimit) where.paidAt.gte = startLimit;
      if (endLimit) where.paidAt.lte = endLimit;
    }

    const payments = await prisma.posBalancePayment.findMany({
      where,
      include: { posSale: { select: { customerName: true, receiptNumber: true, outletName: true } } },
      orderBy: { paidAt: 'desc' }
    });

    const totalCollected = payments.reduce((sum, p) => sum + p.amountPaidNow, 0);
    const count = payments.length;

    res.json({ totalCollected, count, payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch balance collections', error: error.message });
  }
};

// Payment history for a single invoice
const getBalancePaymentHistory = async (req, res) => {
  try {
    const { saleId } = req.params;
    const payments = await prisma.posBalancePayment.findMany({
      where: { posSaleId: saleId },
      orderBy: { paidAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payment history', error: error.message });
  }
};

module.exports = {
  getPosInventory,
  getProducts,
  getVariant,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, deleteProductVariants, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode, orderLookup, getAllOutletsView,
  createPosProduct,
  updateProduct,
  generateBarcode,
  initializeInventory,
  getBalanceInvoices,
  getInvoiceBalance,
  payBalance,
  getBalanceCollections,
  getBalancePaymentHistory
};

