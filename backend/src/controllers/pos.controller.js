const prisma = require('../prisma');
const cache = require('../utils/cache');
const { getPendingAudit } = require('../utils/auditLock');
const errorLogger = require('../utils/errorLogger');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');
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

const seedReceiptSequence = async (datePrefix) => {
  const last = await prisma.posSale.findFirst({
    where: { receiptNumber: { startsWith: datePrefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true }
  });
  if (!last) return 1;
  const parts = last.receiptNumber.split('-');
  return parseInt(parts[parts.length - 1] || '0', 10) + 1;
};

const generateReceiptNumber = async () => {
  const d = new Date();
  const datePrefix = `RCP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = await prisma.posSaleSequence.upsert({
    where: { prefix: datePrefix },
    create: { prefix: datePrefix, nextValue: await seedReceiptSequence(datePrefix) },
    update: { nextValue: { increment: 1 } }
  });
  return `${datePrefix}-${String(seq.nextValue).padStart(5, '0')}`;
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
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, color: true, size: true, fabric: true, stock: true, price: true, imageUrl: true, barcode: true, variants: true, outletName: true, createdAt: true, updatedAt: true }
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

/* ─── View-only: all outlets inventory + Warehouse stock ─── */
const getAllOutletsView = async (req, res) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}inventory:all-outlets-view`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [outletItems, warehouseItems] = await Promise.all([
      prisma.outletInventory.findMany({
        orderBy: [{ name: 'asc' }, { outletName: 'asc' }]
      }),
      prisma.inventoryItem.findMany({
        orderBy: { name: 'asc' }
      })
    ]);

    const result = outletItems.map(item => ({
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

    // Flatten warehouse InventoryItem records, expanding variant arrays
    for (const item of warehouseItems) {
      let variantDefs = null;
      if (item.variants) {
        const parsed = typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants;
        if (Array.isArray(parsed) && parsed.length > 0) variantDefs = parsed;
      }
      if (variantDefs) {
        for (const v of variantDefs) {
          result.push({
            id: item.id,
            name: item.name,
            category: item.category,
            color: v.color || '',
            size: v.size || '',
            fabric: item.fabric || '',
            stock: v.stock || 0,
            price: v.price || item.price || 0,
            imageUrl: item.imageUrl || '',
            barcode: null,
            outletName: 'Warehouse',
          });
        }
      } else {
        result.push({
          id: item.id,
          name: item.name,
          category: item.category,
          color: item.color || '',
          size: item.size || '',
          fabric: item.fabric || '',
          stock: item.stock || 0,
          price: item.price || 0,
          imageUrl: item.imageUrl || '',
          barcode: null,
          outletName: 'Warehouse',
        });
      }
    }

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
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true, color: true, size: true, fabric: true, stock: true, price: true, imageUrl: true, barcode: true, variants: true, outletName: true }
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
    const { items, customerName, customerPhone, extraCharges, discountPercent, discountFixed, paymentMethod, advanceAmount, deliveryCharges, cardChargesPct, orderId, orderNumber, receiptNumber: manualReceipt, cashierName, faisalTake, cashAmount, onlineAmount, additionalNote } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });

    const outletName = getOutletName(req);

    // POS is locked while this branch has an audit awaiting Admin review.
    const pendingAudit = await getPendingAudit(prisma, { type: 'OUTLET', outletName });
    if (pendingAudit) {
      return res.status(423).json({
        message: `Inventory audit ${pendingAudit.auditNumber} approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.`,
        auditNumber: pendingAudit.auditNumber
      });
    }

    const receiptNumber = manualReceipt || await generateReceiptNumber();

    // Batch fetch all inventory variants in a single query
    const variantIds = items.map(i => i.variantId);
    if (variantIds.some(id => !id)) return res.status(400).json({ message: 'Each item must have a variantId' });
    const inventoryVariants = await prisma.outletInventory.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, stock: true, name: true, color: true, size: true, price: true }
    });
    const invMap = new Map(inventoryVariants.map(i => [i.id, i]));

    let subtotal = 0;
    let totalAlt = 0;
    let totalItemDiscount = 0;
    let netAfterItems = 0;
    const saleItems = [];
    const stockErrors = [];
    let exchangeTotal = 0;
    let nonExchangeTotal = 0;

    for (const item of items) {
      const inv = invMap.get(item.variantId);
      if (!inv) return res.status(400).json({ message: `Inventory item ${item.variantId} not found for outlet ${outletName || 'unknown'}` });
      const isEx = item.isExchange === true || item.isExchange === 'true';
      // Skip stock check for exchange items (customer returning the product)
      if (!isEx && inv.stock < (item.quantity || 1)) {
        stockErrors.push(`${inv.name} (${inv.color || ''} ${inv.size || ''}). Available: ${inv.stock}`);
      }
      const unitPrice = item.unitPrice || inv.price || 0;
      const qty = item.quantity || 1;
      const lineBase = unitPrice * qty;
      const itemAlt = parseFloat(item.alterationCharges || 0);
      const cust1 = item.customization1 ? 500 : 0;
      const cust2 = item.customization2 ? 1000 : 0;
      const engrave = item.nameEngrave ? 300 : 0;
      const logo = item.logoDesign ? 300 : 0;
      const custCharges = cust1 + cust2 + engrave + logo;
      const otherCharges = parseFloat(item.otherCharges || 0);
      const dpct = parseFloat(item.discountPct || 0);
      const dfixed = parseFloat(item.discountFixed || 0);
      const itemDiscount = (lineBase * dpct / 100) + dfixed * qty;
      const itemNet = Math.max(0, lineBase - itemDiscount) + itemAlt * qty + custCharges * qty + otherCharges;
      subtotal += lineBase;
      totalAlt += itemAlt * qty;
      totalItemDiscount += itemDiscount;
      netAfterItems += itemNet;
      if (isEx) exchangeTotal += itemNet;
      else nonExchangeTotal += itemNet;
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
        logoDesign: item.logoDesign || false,
        customizationCharges: custCharges,
        otherCharges,
        discountPct: dpct,
        discountFixed: dfixed,
        lineTotal: itemNet,
        isExchange: isEx
      });
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({ message: `Insufficient stock for: ${stockErrors.join('; ')}` });
    }

    const deliveryCharge = parseFloat(deliveryCharges || 0);
    const globalPct = parseFloat(discountPercent || 0);
    const globalFixed = parseFloat(discountFixed || 0);
    const globalDiscountAmt = (nonExchangeTotal * globalPct / 100) + globalFixed;
    const discountAmount = totalItemDiscount + globalDiscountAmt;
    const netAfterGlobal = nonExchangeTotal - globalDiscountAmt;
    const cardPct = parseFloat(cardChargesPct || 0);
    const cardChargesAmount = (nonExchangeTotal * cardPct) / 100;
    const grandTotal = Math.max(0, netAfterGlobal - exchangeTotal + cardChargesAmount + deliveryCharge);

    const isFaisalTake = faisalTake === true || faisalTake === 'true';

    // Validate CASH_ONLINE split amounts
    if (paymentMethod === 'CASH_ONLINE') {
      const cash = parseFloat(cashAmount || 0);
      const online = parseFloat(onlineAmount || 0);
      if (Math.abs(cash + online - grandTotal) > 0.01) {
        return res.status(400).json({ message: `Cash+Online total (${cash + online}) must equal invoice amount (${grandTotal})` });
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      // Exchange items: INCREMENT stock (return to inventory)
      // Non-exchange items: DECREMENT stock (sell)
      const exchangeItems = saleItems.filter(si => si.isExchange);
      const nonExchangeItems = saleItems.filter(si => !si.isExchange);
      await Promise.all([
        ...exchangeItems.map(si =>
          tx.outletInventory.updateMany({
            where: { id: si.outletVariantId },
            data: { stock: { increment: si.quantity } }
          }).then(result => {
            if (result.count === 0) throw new Error(`Exchange stock update failed for ${si.productName}`);
          })
        ),
        ...nonExchangeItems.map(si =>
          tx.outletInventory.updateMany({
            where: { id: si.outletVariantId, stock: { gte: si.quantity } },
            data: { stock: { decrement: si.quantity } }
          }).then(result => {
            if (result.count === 0) throw new Error(`Stock conflict for ${si.productName} - please retry`);
          })
        )
      ]);
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
          deliveryCharges: isFaisalTake ? 0 : deliveryCharge,
          orderId: isFaisalTake ? null : (orderId || null),
          orderNumber: isFaisalTake ? null : (orderNumber || null),
          cardChargesPct: isFaisalTake ? 0 : cardPct,
          cardChargesAmount: isFaisalTake ? 0 : cardChargesAmount,
          paymentMethod: isFaisalTake ? 'FAISAL_TAKE' : (paymentMethod || 'CASH'),
          cashAmount: isFaisalTake ? 0 : (parseFloat(cashAmount || 0)),
          onlineAmount: isFaisalTake ? 0 : (parseFloat(onlineAmount || 0)),
          additionalNote: isFaisalTake ? null : (additionalNote || null),
          faisalTake: isFaisalTake,
          faisalTakenAt: isFaisalTake ? new Date() : null,
          items: { create: saleItems.map(si => ({ ...si, lineTotal: isFaisalTake ? 0 : si.lineTotal })) }
        },
        include: { items: true }
      });
    }, { timeout: 30000 });

    // Respond immediately, invalidate caches asynchronously
    res.status(201).json(sale);
    setImmediate(() => {
      cache.delKeys(`${CACHE_KEY_PREFIX}products:${outletName}`, `${CACHE_KEY_PREFIX}inventory:${outletName}`, `${CACHE_KEY_PREFIX}inventory:all-outlets-view`);
      cache.delPattern(`${CACHE_KEY_PREFIX}dashboard:${outletName || 'all'}`);
      cache.delPattern(`${CACHE_KEY_PREFIX}sales:${outletName || 'all'}`);
      cache.delPattern(`outlet:analytics:${outletName}`);
      if (req.app.get('io')) req.app.get('io').emit('inventory-updated', { source: 'pos', outletName, saleId: sale.id });
    });
  } catch (error) {
    errorLogger.logError({
      module: 'outlet-pos:createSale',
      userId: req.user?.id,
      userName: req.user?.name || cashierName,
      outletName,
      context: receiptNumber || (clientRequestId ? `clientRequestId=${clientRequestId}` : null),
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to create sale', error: error.message });
  }
};

/* ─── Shared POS sales-date range — single source for POS History, Register (Close Book) and Excel export ─── */
const resolveSalesDateRange = ({ range, dateFrom, dateTo }) => {
  const now = new Date();
  let start = null;
  let end = null;
  if (dateFrom || dateTo) {
    if (dateFrom) { start = new Date(dateFrom); start.setHours(0, 0, 0, 0); }
    if (dateTo) { end = new Date(dateTo); end.setHours(23, 59, 59, 999); }
  } else if (range === 'today') { start = new Date(now); start.setHours(0, 0, 0, 0); end = now; }
  else if (range === 'yesterday') { start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); end = new Date(start); end.setHours(23, 59, 59, 999); }
  else if (range === 'week') { start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0); end = now; }
  else if (range === 'month') { start = new Date(now); start.setMonth(start.getMonth() - 1); start.setHours(0, 0, 0, 0); end = now; }
  else if (range === 'year') { start = new Date(now); start.setFullYear(start.getFullYear() - 1); start.setHours(0, 0, 0, 0); end = now; }
  return { start, end };
};

/* ─── Canonical POS sales summary for a date window — single source of truth so that
       POS History, the Register (Close Book), the Dashboard and the Excel export produce
       identical figures (invoice count, totals, cash/online/card split, discounts, returns,
       net sales). Rules:
       - Sales counted by createdAt in window (incl. Faisal Takes, incl. refunded sales —
         the revenue is counted on the SALE day, so History/Register/Dashboard/Excel all
         agree; the refund is deducted on its PROCESSING date via returnedAmount).
       - Balance payments counted on their paidAt (date-based revenue).
       - Returns counted by their own createdAt, using the refundAmount actually refunded.
       - Revenue per sale: advance>0 ? min(advance, grandTotal) : grandTotal. ─── */
const computeSalesSummary = async (prismaClient, { outlet, start, end, _sales, _balancePayments, _returns, _journals }) => {
  const dayEnd = end || new Date();
  const dayFilter = {};
  if (start) dayFilter.gte = start;
  if (end) dayFilter.lte = end;
  const [allSales, balancePayments, returns, journals] = _sales
    ? [_sales, _balancePayments || [], _returns || [], _journals || []]
    : await Promise.all([
        prismaClient.posSale.findMany({ where: { outletName: outlet, ...(Object.keys(dayFilter).length ? { createdAt: dayFilter } : {}) }, orderBy: { createdAt: 'asc' } }),
        prismaClient.posBalancePayment.findMany({ where: { posSale: { outletName: outlet }, ...(Object.keys(dayFilter).length ? { paidAt: dayFilter } : {}) }, orderBy: { paidAt: 'asc' } }),
        prismaClient.posReturn.findMany({ where: { outletName: outlet, ...(Object.keys(dayFilter).length ? { createdAt: dayFilter } : {}) } }),
        prismaClient.journalEntry.findMany({ where: { outletName: outlet, ...(Object.keys(dayFilter).length ? { createdAt: dayFilter } : {}) } }),
      ]);

  const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;

  let CASH = 0, CARD = 0, ONLINE = 0, CASH_ONLINE = 0, CASH_ONLINE_CASH = 0, CASH_ONLINE_ONLINE = 0;
  for (const s of allSales) {
    // Revenue is counted on the sale day even for refunded sales (refund deducted on its
    // processing date) — prevents double-deduction for cross-day refunds and keeps every
    // module (History / Register / Dashboard / Excel) identical.
    const revenue = saleRevenue(s);
    if (s.paymentMethod === 'CASH_ONLINE') {
      const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
      const ratio = totalCO > 0 ? revenue / totalCO : 1;
      CASH_ONLINE += revenue;
      CASH_ONLINE_CASH += (s.cashAmount || 0) * ratio;
      CASH_ONLINE_ONLINE += (s.onlineAmount || 0) * ratio;
    } else if (s.paymentMethod === 'CARD') CARD += revenue;
    else if (s.paymentMethod === 'ONLINE') ONLINE += revenue;
    else CASH += revenue;
  }
  for (const bp of balancePayments) {
    const amt = bp.amountPaidNow || 0;
    if (bp.paymentMethod === 'CARD') CARD += amt;
    else if (bp.paymentMethod === 'ONLINE') ONLINE += amt;
    else if (bp.paymentMethod === 'CASH_ONLINE') { CASH_ONLINE += amt; CASH_ONLINE_CASH += amt / 2; CASH_ONLINE_ONLINE += amt / 2; }
    else CASH += amt;
  }

  const discountTotal = allSales.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
  const returnedAmount = returns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);

  return {
    outlet,
    start,
    end: dayEnd,
    invoiceCount: allSales.length,
    grossSales: (CASH + CARD + ONLINE + CASH_ONLINE) + discountTotal,
    grandTotal: CASH + CARD + ONLINE + CASH_ONLINE,
    cash: CASH,
    online: ONLINE,
    card: CARD,
    cashOnline: CASH_ONLINE,
    cashOnlineCash: CASH_ONLINE_CASH,
    cashOnlineOnline: CASH_ONLINE_ONLINE,
    discountTotal,
    returnedAmount,
    totalFaisalTake: allSales.filter(s => s.faisalTake).reduce((sum, s) => sum + (s.grandTotal || 0), 0),
    journalExpenses: journals.reduce((sum, j) => sum + (j.amount || 0), 0),
    netSales: (CASH + CARD + ONLINE + CASH_ONLINE) - returnedAmount,
    balancePaymentTotal: balancePayments.reduce((sum, b) => sum + (b.amountPaidNow || 0), 0),
  };
};

const getSalesSummary = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range, dateFrom, dateTo } = req.query;
    const skip = req.query.skipCache === 'true';
    if (!outlet) return res.status(400).json({ message: 'Outlet is required' });
    const cacheKey = `${CACHE_KEY_PREFIX}summary:${outlet}:${range || 'all'}${dateFrom ? `:${dateFrom}` : ''}${dateTo ? `:${dateTo}` : ''}`;
    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }
    const { start, end } = resolveSalesDateRange({ range, dateFrom, dateTo });
    const summary = await computeSalesSummary(prisma, { outlet, start, end });
    res.json(summary);
    cache.set(cacheKey, summary, cache.DASHBOARD_TTL);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales summary', error: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range, search, dateFrom, dateTo, statusFilter, cashier, paymentMethod } = req.query;
    const skip = req.query.skipCache === 'true';
    const cacheKey = search
      ? `${CACHE_KEY_PREFIX}sales:${outlet || 'all'}:search:${search}${statusFilter ? `:${statusFilter}` : ''}${cashier ? `:${cashier}` : ''}`
      : `${CACHE_KEY_PREFIX}sales:${outlet || 'all'}:${range || 'all'}${dateFrom ? `:${dateFrom}` : ''}${dateTo ? `:${dateTo}` : ''}${statusFilter ? `:${statusFilter}` : ''}${cashier ? `:${cashier}` : ''}`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const now = new Date();
    let dateFilter = {};
    // Search mode queries the ENTIRE POS invoice database — date/range filters are ignored.
    if (!search) {
      const { start, end } = resolveSalesDateRange({ range, dateFrom, dateTo });
      if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.gte = start;
        if (end) dateFilter.createdAt.lte = end;
      }
    }

    const where = { ...dateFilter };
    if (outlet) where.outletName = outlet;
    if (search) {
      const q = search;
      // Match order-linked sales by Order invoiceNumber / orderNumber (INV-…, JT-…).
      const orderMatches = await prisma.order.findMany({
        where: { OR: [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { orderNumber: { contains: q, mode: 'insensitive' } }] },
        select: { id: true }
      });
      const orderIds = orderMatches.map(o => o.id);
      where.OR = [
        { receiptNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q } },
        { orderNumber: { contains: q, mode: 'insensitive' } },
        ...(orderIds.length ? [{ orderId: { in: orderIds } }] : []),
      ];
    }
    if (cashier) where.cashierName = cashier;
    if (paymentMethod && paymentMethod !== 'all') where.paymentMethod = paymentMethod;

    let sales = await prisma.posSale.findMany({
      where,
      include: { items: true, returns: true, balancePayments: { select: { amountPaidNow: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch invoice numbers for order-linked sales
    const orderIds = sales.filter(s => s.orderId).map(s => s.orderId);
    const orderMap = new Map();
    if (orderIds.length > 0) {
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, invoiceNumber: true }
      });
      orders.forEach(o => orderMap.set(o.id, o.invoiceNumber));
    }

    sales = sales.map(s => {
      const totalAdvance = s.advanceAmount || 0;
      const totalBalancePayments = s.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
      // Actual amount received for this invoice:
      //  - Fully-paid-at-checkout invoices (no advance, no balance payments) count the full grandTotal.
      //  - Advance/balance-linked invoices count what has actually been received so far (advance + balance payments).
      const isFullyPaidAtCheckout = totalAdvance === 0 && s.balancePayments.length === 0;
      const totalReceived = isFullyPaidAtCheckout ? (s.grandTotal || 0) : (totalAdvance + totalBalancePayments);
      const remaining = isFullyPaidAtCheckout ? 0 : Math.max(0, s.grandTotal - totalReceived);
      const { balancePayments, ...saleData } = s;
      return {
        ...saleData,
        _amountReceived: totalReceived,
        _outstandingBalance: Math.max(0, s.grandTotal - totalReceived),
        _balanceRemaining: remaining,
        _balanceStatus: remaining > 0.01 ? 'balance' : 'paid',
        _invoiceNumber: s.orderId ? (orderMap.get(s.orderId) || null) : null
      };
    });

    if (statusFilter === 'paid') {
      sales = sales.filter(s => s._balanceStatus === 'paid');
    } else if (statusFilter === 'balance') {
      sales = sales.filter(s => s._balanceStatus === 'balance');
    }

    // Search priority: exact invoice/receipt/order/phone number match → prefix match → name match.
    if (search) {
      const q = search.toLowerCase();
      sales = sales.map(s => {
        const numbers = [s.receiptNumber, s.orderNumber, s._invoiceNumber, s.customerPhone].filter(Boolean).map(x => x.toLowerCase());
        const names = [s.customerName].filter(Boolean).map(x => x.toLowerCase());
        let score = 3;
        if (numbers.some(x => x === q)) score = 0;
        else if (numbers.some(x => x.startsWith(q))) score = 1;
        else if (names.some(x => x.includes(q))) score = 2;
        return { ...s, _searchScore: score };
      }).sort((a, b) => (a._searchScore - b._searchScore) || (new Date(b.createdAt) - new Date(a.createdAt)));
    }

    res.json(sales);
    const salesTtl = range === 'all' ? 300000 : cache.DASHBOARD_TTL;
    cache.set(cacheKey, sales, salesTtl);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales', error: error.message });
  }
};

const getSalesDashboard = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { dateFrom, dateTo, range = 'all', cashier } = req.query;
    
    // We bypass cache if custom dates or skipCache are requested
    const skip = req.query.skipCache === 'true' || dateFrom || dateTo;
    const cacheKey = `${CACHE_KEY_PREFIX}dashboard:${outlet || 'all'}:${range}:${cashier || 'all'}`;

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
    if (cashier) {
      whereClause.cashierName = cashier;
    }
    if (startLimit || endLimit) {
      whereClause.createdAt = {};
      if (startLimit) whereClause.createdAt.gte = startLimit;
      if (endLimit) whereClause.createdAt.lte = endLimit;
    }

    // 1. UNIFIED sales calculation — single source of truth shared by the POS
    //    Dashboard, Outlet Dashboard (POS Sales card), Admin Outlet Detailed, and
    //    Register/Close Book. Same outlet + window ⇒ identical numbers everywhere.
    const unified = await computeUnifiedSalesSummary(prisma, {
      outlet,
      start: startLimit,
      end: endLimit,
      cashier,
    });

    const {
      grossSales,
      totalSales,
      totalOrders,
      refundAmount,
      netRevenue,
      totalDiscount,
      totalJournalExpenses,
      totalBankDeposits,
      paymentBreakdown,
      salesByDay,
      ordersByDay,
      bestSellingProducts,
      sales: allSales,
      balancePayments,
    } = unified;
    const totalReturns = unified.returns.length;
    const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;

    // Fetch bank deposits list for display
    const bankDeposits = await prisma.bankDeposit.findMany({
      where: {
        ...(outlet ? { outletName: outlet } : {}),
        ...(startLimit || endLimit ? { createdAt: { gte: startLimit || undefined, lte: endLimit || undefined } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50
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

    // 5. Best performing branch (comparison if viewing 'all')
    const branchPerformance = [];
    if (!outlet) {
      const branches = ['Johar Town', 'Jail Road', 'Abbottabad'];
      for (const b of branches) {
        const bSales = allSales.filter(s => s.outletName && s.outletName.toLowerCase().includes(b.toLowerCase()));
        let revenue = bSales.reduce((sum, s) => sum + saleRevenue(s), 0);
        balancePayments.forEach(bp => {
          const ownerOutlet = bp.posSale?.outletName;
          if (ownerOutlet && ownerOutlet.toLowerCase().includes(b.toLowerCase())) {
            revenue += bp.amountPaidNow || 0;
          }
        });
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
      where: { ...whereClause, OR: [{ orderId: { not: null } }, { orderNumber: { not: null } }] },
      select: {
        id: true, receiptNumber: true, grandTotal: true, advanceAmount: true,
        customerName: true, paymentMethod: true, createdAt: true, orderId: true, orderNumber: true,
        balancePayments: { select: { amountPaidNow: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const balanceOrders = balanceSales.map(ps => {
      const collected = (ps.balancePayments || []).reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
      const fullCheckout = (ps.advanceAmount === 0 && (ps.balancePayments || []).length === 0);
      const paid = fullCheckout ? ps.grandTotal : (ps.advanceAmount || 0) + collected;
      const remaining = Math.max(0, ps.grandTotal - paid);
      return {
        id: ps.id,
        receiptNumber: ps.receiptNumber,
        customerName: ps.customerName,
        paid,
        advanceAmount: ps.advanceAmount,
        totalWithAdvance: ps.grandTotal,
        remaining,
        paymentMethod: ps.paymentMethod,
        createdAt: ps.createdAt,
        orderId: ps.orderId,
        orderNumber: ps.orderNumber
      };
    });

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
      grossSales,
      totalSales,
      totalOrders,
      completedOrders: totalOrders + completedOrders,
      pendingOrders,
      cancelledOrders,
      returnedOrders: totalReturns,
      netRevenue,
      refundAmount,
      totalDiscount,
      totalJournalExpenses,
      totalBankDeposits,
      bankDeposits,
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
      const ttl = range === 'all' ? 300000 : cache.DASHBOARD_TTL;
      cache.set(cacheKey, result, ttl);
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

    // POS is locked while this branch has an audit awaiting Admin review.
    const pendingAudit = await getPendingAudit(prisma, { type: 'OUTLET', outletName: outlet });
    if (pendingAudit) {
      return res.status(423).json({
        message: `Inventory audit ${pendingAudit.auditNumber} approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.`,
        auditNumber: pendingAudit.auditNumber
      });
    }

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
    }, { timeout: 30000 });

    cache.delPattern(CACHE_KEY_PREFIX);
    res.status(201).json(ret);
  } catch (error) {
    errorLogger.logError({
      module: 'outlet-pos:createReturn',
      userId: req.user?.id,
      userName: req.user?.name,
      outletName: outlet,
      context: variantId ? `variantId=${variantId} qty=${quantity}` : null,
      message: error.message,
      stack: error.stack
    });
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

/* ─── Full Invoice Refund ─── */
const refundInvoice = async (req, res) => {
  try {
    const { saleId } = req.params;
    const outlet = getOutletName(req);

    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.refundedAt) return res.status(400).json({ message: 'Invoice already refunded' });
    if (sale.faisalTake) return res.status(400).json({ message: 'Cannot refund Faisal Take' });

    // Restore inventory and create return records for each item — whole refund
    // is atomic so a failure never leaves partial restores / double refunds.
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.posSale.findUnique({
        where: { id: saleId },
        select: { refundedAt: true }
      });
      if (fresh?.refundedAt) throw new Error('Invoice already refunded');

      for (const item of sale.items) {
        if (item.outletVariantId) {
          await tx.outletInventory.update({
            where: { id: item.outletVariantId },
            data: { stock: { increment: item.quantity } }
          });
        }
        const refundAmount = item.lineTotal;
        await tx.posReturn.create({
          data: {
            outletVariantId: item.outletVariantId,
            outletName: outlet || sale.outletName || 'Johar Town',
            saleId: sale.id,
            reason: 'Full invoice refund',
            quantity: item.quantity,
            refundAmount,
            refundPaymentMethod: sale.paymentMethod
          }
        });
      }

      // Mark sale as refunded
      await tx.posSale.update({
        where: { id: saleId },
        data: { refundedAt: new Date(), refundReason: 'Full invoice refund' }
      });
    }, { timeout: 30000 });

    cache.delPattern(CACHE_KEY_PREFIX);
    res.json({ message: 'Invoice fully refunded', saleId });
  } catch (error) {
    errorLogger.logError({
      module: 'outlet-pos:refundInvoice',
      userId: req.user?.id,
      userName: req.user?.name,
      outletName: outlet,
      context: `saleId=${req.params?.saleId}`,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to refund invoice', error: error.message });
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
    // Barcode lookups skip cache to always return real-time stock
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
    const productDetails = order.productDetails || [];
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
    const where = { faisalTake: { not: true } };
    if (outlet) where.outletName = outlet;

    const sales = await prisma.posSale.findMany({
      where,
      include: { balancePayments: { select: { amountPaidNow: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const invoices = sales
      .map(s => {
        const totalPaid = s.advanceAmount + s.balancePayments.reduce((sum, bp) => sum + bp.amountPaidNow, 0);
        // If no advance and no balance payments, the invoice was fully paid at checkout
        const remaining = (s.advanceAmount === 0 && s.balancePayments.length === 0) ? 0 : Math.max(0, s.grandTotal - totalPaid);
        return {
          id: s.id,
          receiptNumber: s.receiptNumber,
          orderNumber: s.orderNumber,
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
    console.log('getInvoiceBalance called with saleId:', saleId);
    if (!saleId) return res.status(400).json({ message: 'Missing saleId' });
    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: {
        balancePayments: { orderBy: { paidAt: 'asc' } }
      }
    });
    console.log('getInvoiceBalance: sale found:', !!sale);
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
    const { amountPaidNow, paymentMethod, cashAmount: cashSplit, onlineAmount: onlineSplit } = req.body;
    const outletName = getOutletName(req);

    if (!amountPaidNow || amountPaidNow <= 0) return res.status(400).json({ message: 'Amount must be greater than 0' });
    if (paymentMethod === 'CASH_ONLINE') {
      const total = (cashSplit || 0) + (onlineSplit || 0);
      if (Math.abs(total - amountPaidNow) > 0.01) return res.status(400).json({ message: `Cash (${cashSplit || 0}) + Online (${onlineSplit || 0}) must equal total amount (${amountPaidNow})` });
    }

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
        cashAmount: paymentMethod === 'CASH_ONLINE' ? (cashSplit || 0) : (paymentMethod === 'CASH' ? amountPaidNow : 0),
        onlineAmount: paymentMethod === 'CASH_ONLINE' ? (onlineSplit || 0) : (paymentMethod === 'ONLINE' ? amountPaidNow : 0),
        cashierName: req.user?.name || 'Cashier',
        paidAt: new Date()
      }
    });

    cache.delPattern(CACHE_KEY_PREFIX);
    cache.delPattern(`outlet:analytics:${outletName}`);
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
      else if (range === 'month') { startLimit = new Date(now.getFullYear(), now.getMonth(), 1); endLimit = new Date(now); endLimit.setHours(23, 59, 59, 999); }
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

    const methodBreakdown = {};
    payments.forEach(p => {
      const m = p.paymentMethod || 'CASH';
      if (m === 'CASH_ONLINE') {
        methodBreakdown.CASH = (methodBreakdown.CASH || 0) + (p.cashAmount || 0);
        methodBreakdown.ONLINE = (methodBreakdown.ONLINE || 0) + (p.onlineAmount || 0);
      } else {
        methodBreakdown[m] = (methodBreakdown[m] || 0) + p.amountPaidNow;
      }
    });

    res.json({ totalCollected, count, payments, methodBreakdown });
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

const getJournalEntries = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const { range, dateFrom, dateTo } = req.query;
    const now = new Date();
    let where = {};
    if (outlet) where.outletName = outlet;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) { const s = new Date(dateFrom); s.setHours(0, 0, 0, 0); where.createdAt.gte = s; }
      if (dateTo) { const e = new Date(dateTo); e.setHours(23, 59, 59, 999); where.createdAt.lte = e; }
    } else if (range === 'today') { const s = new Date(now); s.setHours(0, 0, 0, 0); where.createdAt = { gte: s }; }
    else if (range === 'yesterday') { const s = new Date(now); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setHours(23, 59, 59, 999); where.createdAt = { gte: s, lte: e }; }
    else if (range === 'week') { const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0); where.createdAt = { gte: s }; }
    else if (range === 'month') { const s = new Date(now); s.setMonth(s.getMonth() - 1); s.setHours(0, 0, 0, 0); where.createdAt = { gte: s }; }
    else if (range === 'year') { const s = new Date(now); s.setFullYear(s.getFullYear() - 1); s.setHours(0, 0, 0, 0); where.createdAt = { gte: s }; }
    const entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch journal entries', error: error.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    const outlet = getOutletName(req);
    const emps = await prisma.outletEmployee.findMany({
      where: { outletName: outlet, isActive: true },
      select: { name: true },
      orderBy: { name: 'asc' }
    });
    res.json(emps.map(e => e.name));
  } catch {
    const outlet = getOutletName(req);
    if (outlet === 'Jail Road') return res.json(['Junaid', 'Ibrar', 'Aamir']);
    res.json(['Gul', 'Junaid', 'Sajawal', 'Zain']);
  }
};

module.exports = {
  generateBalanceReceiptNumber,
  getPosInventory,
  getProducts,
  getVariant,
  updateVariantStock, updateVariantPrice,
  createVariant, deleteVariant, deleteProductVariants, updateVariant,
  createSale, getSales, getSalesDashboard, getSalesSummary,
  computeSalesSummary,
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
  getBalancePaymentHistory,
  getEmployees,
  getJournalEntries,
  refundInvoice
};

