const prisma = require('../prisma');
const cache = require('../utils/cache');
const { getPendingAudit } = require('../utils/auditLock');
const errorLogger = require('../utils/errorLogger');
const CACHE_KEY_PREFIX = 'warehouse:';

const djb2 = (str) => {
  let hash = 5381;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'WRH';
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
  const datePrefix = `WRH-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const seq = await prisma.posSaleSequence.upsert({
    where: { prefix: datePrefix },
    create: { prefix: datePrefix, nextValue: await seedReceiptSequence(datePrefix) },
    update: { nextValue: { increment: 1 } }
  });
  return `${datePrefix}-${String(seq.nextValue).padStart(5, '0')}`;
};

/* ─── Add to Inventory (from Store after Production completes) ─── */
const addToInventory = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' });
    }

    const results = [];

    for (const item of items) {
      const { productType, color, size, quantity, orderId } = item;
      const qty = parseInt(quantity || 1);

      // Find matching InventoryItem by name + category
      let invItem = await prisma.inventoryItem.findFirst({
        where: {
          name: productType
        }
      });

      if (invItem) {
        // Product exists — update or add variant
        let variants = typeof invItem.variants === 'string' ? JSON.parse(invItem.variants) : (Array.isArray(invItem.variants) ? invItem.variants : []);

        const existingIdx = variants.findIndex(v =>
          (v.color || null) === (color || null) &&
          (v.size || null) === (size || null)
        );

        if (existingIdx >= 0) {
          variants[existingIdx].stock = (variants[existingIdx].stock || 0) + qty;
        } else {
          variants.push({ color: color || null, size: size || null, stock: qty, price: invItem.price || 0 });
        }

        const totalStock = (invItem.stock || 0) + qty;

        await prisma.inventoryItem.update({
          where: { id: invItem.id },
          data: {
            stock: totalStock,
            variants: variants
          }
        });

        results.push({ id: invItem.id, name: invItem.name, color, size, added: qty, totalStock });
      } else {
        // New product — create InventoryItem
        const newItem = await prisma.inventoryItem.create({
          data: {
            name: productType,
            category: orderId ? 'ORDER' : 'GENERAL',
            color: color || null,
            size: size || null,
            stock: qty,
            price: 0,
            variants: [{ color: color || null, size: size || null, stock: qty, price: 0 }]
          }
        });
        results.push({ id: newItem.id, name: newItem.name, color, size, added: qty, totalStock: qty });
      }
    }

    res.json({ message: 'Inventory updated', items: results });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add to inventory', error: error.message });
  }
};

/* ─── Get all Warehouse products ─── */
const getProducts = async (req, res) => {
  try {
    const skip = req.query.skipCache === 'true';
    const cacheKey = `${CACHE_KEY_PREFIX}products`;

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const items = await prisma.inventoryItem.findMany({
      where: {},
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, category: true, color: true, size: true,
        fabric: true, stock: true, price: true, imageUrl: true,
        variants: true, createdAt: true, updatedAt: true
      }
    });

    const products = items.map(item => {
      let variantDefs = [];
      const raw = typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants;
      if (Array.isArray(raw) && raw.length > 0) variantDefs = raw;

      // Assign barcodes to each variant
      const variantsWithBarcodes = variantDefs.map(v => ({
        ...v,
        barcode: generateBarcode(item.id, v.size || null, v.color || null)
      }));

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
        barcode: generateBarcode(item.id, null, null),
        colors,
        sizes,
        variants: variantsWithBarcodes
      };
    });

    cache.set(cacheKey, products, cache.POS_TTL || 30000);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch warehouse products', error: error.message });
  }
};

/* ─── Barcode lookup ─── */
const lookupBarcode = async (req, res) => {
  try {
    const barcode = req.params.barcode.toUpperCase();
    let inv = null;

    const items = await prisma.inventoryItem.findMany({ where: {} });

    for (const store of items) {
      const baseBarcode = generateBarcode(store.id, null, null);
      if (baseBarcode.toUpperCase() === barcode) {
        inv = { ...store, _matchedColor: null, _matchedSize: null, _barcode: baseBarcode };
        break;
      }
      const variants = typeof store.variants === 'string' ? JSON.parse(store.variants) : (Array.isArray(store.variants) ? store.variants : []);
      for (const v of variants) {
        const vb = generateBarcode(store.id, v.size || null, v.color || null);
        if (vb.toUpperCase() === barcode) {
          inv = { ...store, _matchedColor: v.color || null, _matchedSize: v.size || null, _barcode: vb, _variantStock: v.stock || 0, _variantPrice: v.price || store.price || 0 };
          break;
        }
      }
      if (inv) break;
    }

    if (!inv) return res.status(404).json({ message: 'Barcode not found in warehouse' });

    const result = {
      id: inv.id,
      productName: inv.name,
      category: inv.category,
      imageUrl: inv.imageUrl,
      color: inv._matchedColor,
      size: inv._matchedSize,
      barcode: inv._barcode,
      stock: inv._variantStock ?? inv.stock,
      price: inv._variantPrice || inv.price || 0
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to lookup barcode', error: error.message });
  }
};

/* ─── Create Sale (deduct from warehouse InventoryItem) ─── */
const createSale = async (req, res) => {
  try {
    const { items, customerName, customerPhone, extraCharges, discountPercent, discountFixed, paymentMethod, advanceAmount, deliveryCharges, cardChargesPct, receiptNumber: manualReceipt, cashierName, cashAmount, onlineAmount, clientRequestId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    // Warehouse POS is locked while a warehouse audit awaits Admin review.
    const pendingAudit = await getPendingAudit(prisma, { type: 'WAREHOUSE' });
    if (pendingAudit) {
      return res.status(423).json({
        message: `Inventory audit ${pendingAudit.auditNumber} approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.`,
        auditNumber: pendingAudit.auditNumber
      });
    }

    // Idempotency check — return existing sale if same clientRequestId was already processed
    if (clientRequestId) {
      const existing = await prisma.posSale.findUnique({
        where: { clientRequestId },
        include: { items: true }
      });
      if (existing) return res.status(201).json(existing);
    }

    const receiptNumber = manualReceipt || await generateReceiptNumber();

    // Bulk-fetch all required products in ONE query (replaces N individual findUnique calls)
    const productIds = [...new Set(items.map(i => i.productId))];
    const storeItems = await prisma.inventoryItem.findMany({
      where: { id: { in: productIds } }
    });
    const storeItemMap = new Map(storeItems.map(si => [si.id, si]));

    // Build sale items and validate stock using pre-fetched data
    const saleItems = [];
    const stockErrors = [];
    let subtotal = 0;
    let totalAlt = 0;
    let totalItemDiscount = 0;
    let netAfterItems = 0;

    for (const item of items) {
      const { productId, color, size, quantity, unitPrice, alterationCharges, customization1, customization2, nameEngrave, logoDesign, otherCharges, discountPct, discountFixed: itemDiscountFixed } = item;

      const storeItem = storeItemMap.get(productId);
      if (!storeItem) {
        return res.status(400).json({ message: `Product ${productId} not found` });
      }

      // Check variant stock from pre-fetched data
      let availableStock = 0;
      if (color || size) {
        const variants = typeof storeItem.variants === 'string' ? JSON.parse(storeItem.variants) : (Array.isArray(storeItem.variants) ? storeItem.variants : []);
        const match = variants.find(v =>
          (v.color || null) === (color || null) &&
          (v.size || null) === (size || null)
        );
        availableStock = match ? (match.stock || 0) : 0;
      } else {
        availableStock = storeItem.stock || 0;
      }

      const qty = quantity || 1;
      if (availableStock < qty) {
        stockErrors.push(`${storeItem.name} (${color || ''} ${size || ''}). Available: ${availableStock}`);
      }

      const unitP = unitPrice || storeItem.price || 0;
      const lineBase = unitP * qty;
      const cust1 = customization1 ? 500 : 0;
      const cust2 = customization2 ? 1000 : 0;
      const engrave = nameEngrave ? 300 : 0;
      const logo = logoDesign ? 300 : 0;
      const custCharges = cust1 + cust2 + engrave + logo;
      const altCharges = parseFloat(alterationCharges || 0);
      const other = parseFloat(otherCharges || 0);
      const dpct = parseFloat(discountPct || 0);
      const dfixed = parseFloat(itemDiscountFixed || 0);
      const itemDiscount = (lineBase * dpct / 100) + dfixed * qty;
      const itemNet = Math.max(0, lineBase - itemDiscount) + altCharges * qty + custCharges * qty + other;

      subtotal += lineBase;
      totalAlt += altCharges * qty;
      totalItemDiscount += itemDiscount;
      netAfterItems += itemNet;

      saleItems.push({
        productName: storeItem.name,
        size: size || null,
        color: color || null,
        quantity: qty,
        unitPrice: unitP,
        alterationCharges: altCharges,
        customization1: customization1 || false,
        customization2: customization2 || false,
        nameEngrave: nameEngrave || false,
        logoDesign: logoDesign || false,
        customizationCharges: custCharges,
        otherCharges: other,
        discountPct: dpct,
        discountFixed: dfixed,
        lineTotal: itemNet
      });
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({ message: `Insufficient stock for: ${stockErrors.join('; ')}` });
    }

    const deliveryCharge = parseFloat(deliveryCharges || 0);
    const globalPct = parseFloat(discountPercent || 0);
    const globalFixed = parseFloat(discountFixed || 0);
    const globalDiscountAmt = (netAfterItems * globalPct / 100) + globalFixed;
    const discountAmount = totalItemDiscount + globalDiscountAmt;
    const netAfterGlobal = netAfterItems - globalDiscountAmt;
    const cardPct = parseFloat(cardChargesPct || 0);
    const cardChargesAmount = (netAfterItems * cardPct) / 100;
    const grandTotal = netAfterGlobal + cardChargesAmount + deliveryCharge;

    const sale = await prisma.$transaction(async (tx) => {
      // Decrement stock from InventoryItem — use pre-fetched data, no re-fetch
      for (const item of items) {
        const storeItem = storeItemMap.get(item.productId);
        const qty = item.quantity || 1;

        if (item.color || item.size) {
          let variants = typeof storeItem.variants === 'string' ? JSON.parse(storeItem.variants) : (Array.isArray(storeItem.variants) ? [...storeItem.variants] : []);
          const idx = variants.findIndex(v =>
            (v.color || null) === (item.color || null) &&
            (v.size || null) === (item.size || null)
          );
          if (idx < 0) throw new Error(`Variant ${item.color}/${item.size} not found for ${storeItem.name}`);
          if ((variants[idx].stock || 0) < qty) throw new Error(`Insufficient stock for ${storeItem.name} (${item.color || ''} ${item.size || ''})`);

          variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) - qty };

          await tx.inventoryItem.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: qty },
              variants: variants
            }
          });
        } else {
          await tx.inventoryItem.update({
            where: { id: item.productId },
            data: { stock: { decrement: qty } }
          });
        }
      }

      return tx.posSale.create({
        data: {
          receiptNumber,
          clientRequestId: clientRequestId || null,
          outletName: 'Warehouse',
          cashierName: cashierName || req.user?.name || 'Cashier',
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          subtotal,
          alterationCharges: totalAlt,
          discountPercent: globalPct,
          discountAmount,
          grandTotal,
          advanceAmount: parseFloat(advanceAmount || 0),
          deliveryCharges: deliveryCharge,
          cardChargesPct: cardPct,
          cardChargesAmount,
          paymentMethod: paymentMethod || 'COD',
          cashAmount: parseFloat(cashAmount || 0),
          onlineAmount: parseFloat(onlineAmount || 0),
          items: { create: saleItems }
        },
        include: { items: true }
      });
    }, { timeout: 30000 });

    res.status(201).json(sale);
    setImmediate(() => {
      cache.delPattern(`${CACHE_KEY_PREFIX}*`);
    });
  } catch (error) {
    errorLogger.logError({
      module: 'warehouse-pos:createSale',
      userId: req.user?.id,
      userName: req.user?.name || cashierName,
      outletName: 'Warehouse',
      context: receiptNumber || (clientRequestId ? `clientRequestId=${clientRequestId}` : null),
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to create sale', error: error.message });
  }
};

/* ─── Create Return (increment warehouse stock) ─── */
const createReturn = async (req, res) => {
  try {
    const { productId, color, size, reason, quantity, saleId, refundPaymentMethod } = req.body;
    if (!productId || !quantity) {
      return res.status(400).json({ message: 'productId and quantity are required' });
    }

    // Warehouse POS is locked while a warehouse audit awaits Admin review.
    const pendingAudit = await getPendingAudit(prisma, { type: 'WAREHOUSE' });
    if (pendingAudit) {
      return res.status(423).json({
        message: `Inventory audit ${pendingAudit.auditNumber} approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.`,
        auditNumber: pendingAudit.auditNumber
      });
    }

    const storeItem = await prisma.inventoryItem.findUnique({ where: { id: productId } });
    if (!storeItem) return res.status(400).json({ message: 'Product not found' });

    const qty = parseInt(quantity);
    const refundAmount = (storeItem.price || 0) * qty;

    const ret = await prisma.$transaction(async (tx) => {
      if (color || size) {
        let variants = typeof storeItem.variants === 'string' ? JSON.parse(storeItem.variants) : (Array.isArray(storeItem.variants) ? [...storeItem.variants] : []);
        const idx = variants.findIndex(v =>
          (v.color || null) === (color || null) &&
          (v.size || null) === (size || null)
        );
        if (idx >= 0) {
          variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) + qty };
        }
        await tx.inventoryItem.update({
          where: { id: productId },
          data: {
            stock: { increment: qty },
            variants: variants
          }
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: productId },
          data: { stock: { increment: qty } }
        });
      }

      return tx.posReturn.create({
        data: {
          outletName: 'Warehouse',
          saleId: saleId || null,
          reason: reason || null,
          quantity: qty,
          refundAmount,
          refundPaymentMethod: refundPaymentMethod || 'CASH'
        }
      });
    }, { timeout: 30000 });

    res.status(201).json(ret);
  } catch (error) {
    errorLogger.logError({
      module: 'warehouse-pos:createReturn',
      userId: req.user?.id,
      userName: req.user?.name,
      outletName: 'Warehouse',
      context: productId ? `productId=${productId} qty=${quantity}` : null,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to process return', error: error.message });
  }
};

/* ─── Full Invoice Refund ─── */
const refundInvoice = async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await prisma.posSale.findUnique({
      where: { id: saleId },
      include: { items: true }
    });
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.refundedAt) return res.status(400).json({ message: 'Invoice already refunded' });
    if (sale.outletName !== 'Warehouse') return res.status(400).json({ message: 'Not a Warehouse sale' });

    // Whole refund is atomic — stock restore + return records + refundedAt stamp
    // commit or roll back together, so a failure never double-restores stock.
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.posSale.findUnique({
        where: { id: saleId },
        select: { refundedAt: true }
      });
      if (fresh?.refundedAt) throw new Error('Invoice already refunded');

      for (const item of sale.items) {
        // Find matching InventoryItem
        const storeItem = await tx.inventoryItem.findFirst({
          where: { name: item.productName }
        });

        if (storeItem) {
          if (item.color || item.size) {
            let variants = typeof storeItem.variants === 'string' ? JSON.parse(storeItem.variants) : (Array.isArray(storeItem.variants) ? [...storeItem.variants] : []);
            const idx = variants.findIndex(v =>
              (v.color || null) === (item.color || null) &&
              (v.size || null) === (item.size || null)
            );
            if (idx >= 0) {
              variants[idx] = { ...variants[idx], stock: (variants[idx].stock || 0) + item.quantity };
            }
            await tx.inventoryItem.update({
              where: { id: storeItem.id },
              data: { stock: { increment: item.quantity }, variants }
            });
          } else {
            await tx.inventoryItem.update({
              where: { id: storeItem.id },
              data: { stock: { increment: item.quantity } }
            });
          }
        }

        await tx.posReturn.create({
          data: {
            outletName: 'Warehouse',
            saleId: sale.id,
            reason: 'Full invoice refund',
            quantity: item.quantity,
            refundAmount: item.lineTotal,
            refundPaymentMethod: sale.paymentMethod
          }
        });
      }

      await tx.posSale.update({
        where: { id: saleId },
        data: { refundedAt: new Date(), refundReason: 'Full invoice refund' }
      });
    }, { timeout: 30000 });

    res.json({ message: 'Invoice fully refunded', saleId });
  } catch (error) {
    errorLogger.logError({
      module: 'warehouse-pos:refundInvoice',
      userId: req.user?.id,
      userName: req.user?.name,
      outletName: 'Warehouse',
      context: `saleId=${req.params?.saleId}`,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to refund invoice', error: error.message });
  }
};

/* ─── Get Sales History ─── */
const getSales = async (req, res) => {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}sales`;
    const skip = req.query.skipCache === 'true';

    if (!skip) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const sales = await prisma.posSale.findMany({
      where: { outletName: 'Warehouse' },
      include: { items: true, returns: true },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    cache.set(cacheKey, sales, cache.POS_TTL || 30000);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales', error: error.message });
  }
};

module.exports = {
  addToInventory,
  getProducts,
  lookupBarcode,
  createSale,
  createReturn,
  refundInvoice,
  getSales
};
