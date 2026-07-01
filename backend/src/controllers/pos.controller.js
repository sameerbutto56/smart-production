const prisma = require('../prisma');
const cache = require('../utils/cache');
const CACHE_KEY_PREFIX = 'pos:';

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
const ensureOutletVariants = async (item) => {
  if (!item) return [];
  let variantDefs = [];
  if (Array.isArray(item.variants) && item.variants.length > 0) {
    variantDefs = item.variants;
  } else {
    variantDefs = [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
  }
  const existing = await prisma.outletVariant.findMany({ where: { inventoryItemId: item.id } });
  const created = [];
  for (const vd of variantDefs) {
    let ov = existing.find(o => o.color === (vd.color || null) && o.size === (vd.size || null));
    if (!ov) {
          let barcode = generateBarcode(item.id, vd.size, vd.color);
          let attempt = 0;
          while (await prisma.outletVariant.findUnique({ where: { barcode } }) || missing.some(m => m.barcode === barcode)) {
            attempt++;
            barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
          }
      ov = await prisma.outletVariant.create({
        data: {
          inventoryItemId: item.id,
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
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}inventory`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const items = await prisma.inventoryItem.findMany({
      include: { outletVariants: true },
      orderBy: { name: 'asc' }
    });

    // Auto-create missing OutletVariants
    for (const item of items) {
      const missing = [];
      let variantDefs = [];
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        variantDefs = item.variants;
      } else {
        variantDefs = [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
      }
      for (const vd of variantDefs) {
        const exists = item.outletVariants.some(ov => ov.color === (vd.color || null) && ov.size === (vd.size || null));
        if (!exists) {
          let barcode = generateBarcode(item.id, vd.size, vd.color);
          let attempt = 0;
          while (await prisma.outletVariant.findUnique({ where: { barcode } })) {
            attempt++;
            barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
          }
          missing.push({
            inventoryItemId: item.id,
            color: vd.color || null,
            size: vd.size || null,
            barcode,
            stock: 0,
            price: vd.price || null,
            isActive: true
          });
        }
      }
      if (missing.length > 0) {
        for (const md of missing) {
          await prisma.outletVariant.create({ data: md });
        }
        // Re-fetch to include new variants
        item.outletVariants = await prisma.outletVariant.findMany({ where: { inventoryItemId: item.id } });
      }
    }

    const result = items.map(item => {
      let variantDefs = [];
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        variantDefs = item.variants;
      } else {
        variantDefs = [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
      }

      const colors = [...new Set(variantDefs.map(v => v.color).filter(Boolean))];
      const sizes = [...new Set(variantDefs.map(v => v.size).filter(Boolean))];

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price || 0,
        imageUrl: item.imageUrl,
        colors,
        sizes,
        outletVariants: item.outletVariants.map(ov => ({
          id: ov.id,
          color: ov.color,
          size: ov.size,
          barcode: ov.barcode,
          stock: ov.stock,
          price: ov.price
        }))
      };
    });

    cache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch POS inventory', error: error.message });
  }
};

/* ─── (removed) addToPosInventory / removeFromPosInventory — now auto-created ─── */

/* ─── Products for Outlet POS (auto-created from warehouse) ─── */
const getProducts = async (req, res) => {
  try {
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}products`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    // Auto-create OutletVariants for all warehouse products
    const allItems = await prisma.inventoryItem.findMany({
      include: { outletVariants: true },
      orderBy: { name: 'asc' }
    });

    for (const item of allItems) {
      let variantDefs = [];
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        variantDefs = item.variants;
      } else {
        variantDefs = [{ color: item.color || null, size: item.size || null, stock: item.stock, price: item.price }];
      }
      for (const vd of variantDefs) {
        const exists = item.outletVariants.some(ov => ov.color === (vd.color || null) && ov.size === (vd.size || null));
        if (!exists) {
          let barcode = generateBarcode(item.id, vd.size, vd.color);
          let attempt = 0;
          while (await prisma.outletVariant.findUnique({ where: { barcode } })) {
            attempt++;
            barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
          }
          await prisma.outletVariant.create({
            data: {
              inventoryItemId: item.id,
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
    }

    // Re-fetch all variants with inventory items
    const allVariants = await prisma.outletVariant.findMany({
      include: { inventoryItem: true }
    });

    const grouped = {};
    for (const ov of allVariants) {
      const item = ov.inventoryItem;
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

    cache.set(cacheKey, products);
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
    const { color, size, stock, price } = req.body;
    const item = await prisma.inventoryItem.findUnique({ where: { id: productId } });
    if (!item) return res.status(404).json({ message: 'Product not found' });

    let barcode = generateBarcode(productId, size, color);
    let attempt = 0;
    while (await prisma.outletVariant.findUnique({ where: { barcode } })) {
      attempt++;
      barcode = generateBarcode(productId, size, color, attempt);
    }

    const variant = await prisma.outletVariant.create({
      data: {
        inventoryItemId: productId,
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
    const data = {};
    if (color !== undefined) data.color = color || null;
    if (size !== undefined) data.size = size || null;
    if (stock !== undefined) data.stock = parseInt(stock);
    if (price !== undefined) data.price = price !== '' ? parseFloat(price) : null;
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
    const { items, customerName, alterationCharges, extraCharges, discountPercent, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const outletName = req.user?.name || 'Outlet';
    const receiptNumber = generateReceiptNumber();
    let subtotal = 0;
    let totalAlt = parseFloat(alterationCharges || 0);
    let totalExtra = parseFloat(extraCharges || 0);
    const saleItems = [];

    for (const item of items) {
      if (!item.variantId) return res.status(400).json({ message: 'Each item must have a variantId' });
      const ov = await prisma.outletVariant.findUnique({ where: { id: item.variantId }, include: { inventoryItem: true } });
      if (!ov) return res.status(400).json({ message: `Variant ${item.variantId} not found` });
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
    const discountAmount = ((subtotal + totalAlt + totalExtra) * discountPct) / 100;
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
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create sale', error: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const { range } = req.query;
    const now = new Date();
    let dateFilter = {};
    if (range === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'yesterday') { const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); dateFilter = { createdAt: { gte: s, lte: e } }; }
    else if (range === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'month') { const s = new Date(now); s.setMonth(s.getMonth() - 1); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }
    else if (range === 'year') { const s = new Date(now); s.setFullYear(s.getFullYear() - 1); s.setHours(0, 0, 0, 0); dateFilter = { createdAt: { gte: s } }; }

    const sales = await prisma.posSale.findMany({
      where: dateFilter,
      include: { items: true, returns: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales', error: error.message });
  }
};

const getSalesDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startYesterday = new Date(now); startYesterday.setDate(startYesterday.getDate() - 1); startYesterday.setHours(0, 0, 0, 0);
    const endYesterday = new Date(startYesterday); endYesterday.setHours(23, 59, 59, 999);
    const startWeek = new Date(now); startWeek.setDate(startWeek.getDate() - 7); startWeek.setHours(0, 0, 0, 0);
    const startMonth = new Date(now); startMonth.setMonth(startMonth.getMonth() - 1); startMonth.setHours(0, 0, 0, 0);
    const startYear = new Date(now); startYear.setFullYear(startYear.getFullYear() - 1); startYear.setHours(0, 0, 0, 0);

    const [today, yesterday, week, month, year, all] = await Promise.all([
      prisma.posSale.aggregate({ where: { createdAt: { gte: startToday } }, _sum: { grandTotal: true }, _count: true }),
      prisma.posSale.aggregate({ where: { createdAt: { gte: startYesterday, lte: endYesterday } }, _sum: { grandTotal: true }, _count: true }),
      prisma.posSale.aggregate({ where: { createdAt: { gte: startWeek } }, _sum: { grandTotal: true }, _count: true }),
      prisma.posSale.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { grandTotal: true }, _count: true }),
      prisma.posSale.aggregate({ where: { createdAt: { gte: startYear } }, _sum: { grandTotal: true }, _count: true }),
      prisma.posSale.aggregate({ _sum: { grandTotal: true }, _count: true }),
    ]);

    res.json({
      todaySales: today._sum.grandTotal || 0, todayOrders: today._count,
      yesterdaySales: yesterday._sum.grandTotal || 0, yesterdayOrders: yesterday._count,
      weekSales: week._sum.grandTotal || 0, weekOrders: week._count,
      monthSales: month._sum.grandTotal || 0, monthOrders: month._count,
      yearSales: year._sum.grandTotal || 0, yearOrders: year._count,
      totalSales: all._sum.grandTotal || 0, totalOrders: all._count
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard', error: error.message });
  }
};

/* ─── Returns ─── */
const createReturn = async (req, res) => {
  try {
    const { variantId, reason, quantity } = req.body;
    if (!variantId || !quantity) return res.status(400).json({ message: 'variantId and quantity are required' });

    const ov = await prisma.outletVariant.findUnique({ where: { id: variantId }, include: { inventoryItem: true } });
    if (!ov) return res.status(400).json({ message: 'Variant not found' });
    const refundAmount = (ov.price || ov.inventoryItem.price || 0) * parseInt(quantity);

    const ret = await prisma.$transaction(async (tx) => {
      await tx.outletVariant.update({ where: { id: variantId }, data: { stock: { increment: parseInt(quantity) } } });
      return tx.posReturn.create({
        data: {
          outletVariantId: variantId,
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
    const returns = await prisma.posReturn.findMany({
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
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch returns', error: error.message });
  }
};

/* ─── Create a new product from POS (product master + OutletVariants, stock always 0) ─── */
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

    // Auto-create OutletVariants with price copied from each variant def
    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const vd of variants) {
        let barcode = generateBarcode(item.id, vd.size, vd.color);
        let attempt = 0;
        while (await prisma.outletVariant.findUnique({ where: { barcode } })) {
          attempt++;
          barcode = generateBarcode(item.id, vd.size, vd.color, attempt);
        }
        await prisma.outletVariant.create({
          data: {
            inventoryItemId: item.id,
            color: vd.color || null,
            size: vd.size || null,
            barcode,
            stock: 0,
            price: vd.price || null,
            isActive: true
          }
        });
      }
    } else {
      // Single variant if no variants array
      let barcode = generateBarcode(item.id, null, null);
      let attempt = 0;
      while (await prisma.outletVariant.findUnique({ where: { barcode } })) {
        attempt++;
        barcode = generateBarcode(item.id, null, null, attempt);
      }
      await prisma.outletVariant.create({
        data: {
          inventoryItemId: item.id,
          color: null,
          size: null,
          barcode,
          stock: 0,
          price: null,
          isActive: true
        }
      });
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
    const ov = await prisma.outletVariant.findUnique({
      where: { barcode },
      include: { inventoryItem: true }
    });
    if (!ov) return res.status(404).json({ message: 'Barcode not found' });
    res.json({
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
    });
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

module.exports = {
  getPosInventory,
  getProducts,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, updateVariant,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode,
  createPosProduct,
  updateProduct
};
