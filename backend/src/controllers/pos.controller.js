const prisma = require('../prisma');

const generateBarcode = (productId, size, color) => {
  const prefix = 'POS';
  const hash = ((parseInt(productId.replace(/-/g, '').slice(0, 8), 16) || 0) + (size ? size.charCodeAt(0) : 0) + (color ? color.charCodeAt(0) : 0)).toString(36).toUpperCase().slice(0, 6);
  return `${prefix}${hash}${size ? size[0] || 'X' : 'X'}${color ? color[0] || 'X' : 'X'}`;
};

const generateReceiptNumber = (() => {
  let counter = 0;
  return () => { counter++; const d = new Date(); return `RCP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(counter).padStart(5, '0')}`; };
})();

/* ─── Categories ─── */
const getCategories = async (req, res) => {
  try {
    const cats = await prisma.posCategory.findMany({ orderBy: { name: 'asc' } });
    res.json(cats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });
    const cat = await prisma.posCategory.create({ data: { name } });
    res.status(201).json(cat);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    await prisma.posCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
};

/* ─── Products ─── */
const getProducts = async (req, res) => {
  try {
    const products = await prisma.posProduct.findMany({
      include: { variants: true, category: true },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, categoryId, description, price, imageUrl, hasSizes, hasColors, colors, sizes } = req.body;
    if (!name) return res.status(400).json({ message: 'Product name is required' });
    const product = await prisma.posProduct.create({
      data: { name, categoryId: categoryId || null, description, price: parseFloat(price || 0), imageUrl, hasSizes: hasSizes !== false, hasColors: hasColors !== false }
    });
    const variantData = [];
    const colorArr = Array.isArray(colors) && colors.length ? colors : (hasColors !== false ? [null] : [null]);
    const sizeArr = Array.isArray(sizes) && sizes.length ? sizes : (hasSizes !== false ? [null] : [null]);
    for (const c of colorArr) {
      for (const s of sizeArr) {
        const barcode = generateBarcode(product.id, s, c);
        variantData.push({ productId: product.id, size: s || null, color: c || null, barcode, stock: 0, price: null });
      }
    }
    if (variantData.length > 0) {
      await prisma.posProductVariant.createMany({ data: variantData });
    }
    const full = await prisma.posProduct.findUnique({ where: { id: product.id }, include: { variants: true, category: true } });
    res.status(201).json(full);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { name, categoryId, description, price, imageUrl, hasSizes, hasColors } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (hasSizes !== undefined) data.hasSizes = hasSizes;
    if (hasColors !== undefined) data.hasColors = hasColors;
    const product = await prisma.posProduct.update({ where: { id: req.params.id }, data, include: { variants: true, category: true } });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    await prisma.posProductVariant.deleteMany({ where: { productId: req.params.id } });
    await prisma.posProduct.delete({ where: { id: req.params.id } });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

/* ─── Variants / Stock ─── */
const updateVariantStock = async (req, res) => {
  try {
    const { stock } = req.body;
    const variant = await prisma.posProductVariant.update({
      where: { id: req.params.id },
      data: { stock: parseInt(stock || 0) }
    });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update stock', error: error.message });
  }
};

const updateVariantPrice = async (req, res) => {
  try {
    const { price } = req.body;
    const variant = await prisma.posProductVariant.update({
      where: { id: req.params.id },
      data: { price: price !== null && price !== '' ? parseFloat(price) : null }
    });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update variant price', error: error.message });
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
      const variant = await prisma.posProductVariant.findUnique({ where: { id: item.variantId }, include: { product: true } });
      if (!variant) return res.status(400).json({ message: `Variant ${item.variantId} not found` });
      if (variant.stock < (item.quantity || 1)) return res.status(400).json({ message: `Insufficient stock for ${variant.product.name} (${variant.color || ''} ${variant.size || ''}). Available: ${variant.stock}` });
      const unitPrice = item.unitPrice || variant.price || variant.product.price || 0;
      const qty = item.quantity || 1;
      const lineTotal = unitPrice * qty;
      const itemAlt = parseFloat(item.alterationCharges || 0) * qty;
      subtotal += lineTotal;
      totalAlt += itemAlt;
      saleItems.push({
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        size: variant.size,
        color: variant.color,
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
        await tx.posProductVariant.update({
          where: { id: si.variantId },
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
    const { saleItemId, variantId, reason, quantity } = req.body;
    if (!variantId || !quantity) return res.status(400).json({ message: 'variantId and quantity are required' });

    const variant = await prisma.posProductVariant.findUnique({ where: { id: variantId } });
    if (!variant) return res.status(400).json({ message: 'Variant not found' });

    const saleItem = saleItemId ? await prisma.posSaleItem.findUnique({ where: { id: saleItemId } }) : null;
    const sale = saleItem ? await prisma.posSale.findUnique({ where: { id: saleItem.saleId } }) : null;
    const refundAmount = saleItem ? (saleItem.unitPrice + (saleItem.alterationCharges / saleItem.quantity)) * parseInt(quantity) : 0;

    const ret = await prisma.$transaction(async (tx) => {
      await tx.posProductVariant.update({ where: { id: variantId }, data: { stock: { increment: parseInt(quantity) } } });
      return tx.posReturn.create({
        data: {
          saleId: saleItem?.saleId || null,
          variantId,
          reason: reason || null,
          quantity: parseInt(quantity),
          refundAmount
        }
      });
    });

    res.status(201).json(ret);
  } catch (error) {
    res.status(500).json({ message: 'Failed to process return', error: error.message });
  }
};

const getReturns = async (req, res) => {
  try {
    const returns = await prisma.posReturn.findMany({
      include: { variant: { include: { product: true } }, sale: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch returns', error: error.message });
  }
};

/* ─── Barcode lookup ─── */
const lookupBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const variant = await prisma.posProductVariant.findUnique({
      where: { barcode },
      include: { product: { include: { category: true } } }
    });
    if (!variant) return res.status(404).json({ message: 'Barcode not found' });
    res.json(variant);
  } catch (error) {
    res.status(500).json({ message: 'Failed to lookup barcode', error: error.message });
  }
};

module.exports = {
  getCategories, createCategory, deleteCategory,
  getProducts, createProduct, updateProduct, deleteProduct,
  updateVariantStock, updateVariantPrice,
  createSale, getSales, getSalesDashboard,
  createReturn, getReturns,
  lookupBarcode
};
