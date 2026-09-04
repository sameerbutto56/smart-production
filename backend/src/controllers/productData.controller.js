const prisma = require('../prisma');
const { dateBoundToMs, pktDayStart, pktDayEnd } = require('../utils/workingHours');

/**
 * Helper to normalize outlet names for comparison
 */
function normalizeOutlet(name) {
  if (!name) return '';
  const s = String(name).trim().toLowerCase();
  if (s.includes('johar')) return 'Johar Town';
  if (s.includes('jail')) return 'Jail Road';
  if (s.includes('abbott')) return 'Abbottabad';
  if (s.includes('ware')) return 'Warehouse';
  if (s.includes('online')) return 'Online';
  return name.trim();
}

/**
 * Build date filter for queries based on preset or custom date range in PKT
 */
function buildDateRange(preset, dateFrom, dateTo) {
  const now = new Date();
  const nowMs = now.getTime();

  if (preset === 'today') {
    return {
      gte: new Date(pktDayStart(nowMs)),
      lte: new Date(pktDayEnd(nowMs))
    };
  }
  if (preset === 'yesterday') {
    const yMs = nowMs - 24 * 60 * 60 * 1000;
    return {
      gte: new Date(pktDayStart(yMs)),
      lte: new Date(pktDayEnd(yMs))
    };
  }
  if (preset === 'weekly') {
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    return {
      gte: new Date(pktDayStart(weekAgoMs)),
      lte: new Date(pktDayEnd(nowMs))
    };
  }
  if (preset === 'monthly') {
    const monthAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    return {
      gte: new Date(pktDayStart(monthAgoMs)),
      lte: new Date(pktDayEnd(nowMs))
    };
  }
  if (preset === 'custom' || dateFrom || dateTo) {
    const range = {};
    if (dateFrom) {
      const startMs = dateBoundToMs(dateFrom, 'start');
      if (startMs) range.gte = new Date(startMs);
    }
    if (dateTo) {
      const endMs = dateBoundToMs(dateTo, 'end');
      if (endMs) range.lte = new Date(endMs);
    }
    return Object.keys(range).length > 0 ? range : null;
  }
  if (preset === 'all') {
    return null;
  }

  // Default is today
  return {
    gte: new Date(pktDayStart(nowMs)),
    lte: new Date(pktDayEnd(nowMs))
  };
}

/**
 * Check if size is custom size
 */
function isCustomSize(size, sizeData, orderType) {
  if (orderType === 'FULL_CUSTOM' || orderType === 'CUSTOM') return true;
  if (size && (size.toUpperCase() === 'C' || size.toUpperCase() === 'CUSTOM')) return true;
  if (sizeData) {
    try {
      const parsed = typeof sizeData === 'string' ? JSON.parse(sizeData) : sizeData;
      if (parsed && typeof parsed === 'object') {
        const values = Object.values(parsed).filter(v => v && String(v).trim().length > 0);
        if (values.length > 0) return true;
      }
    } catch (e) {}
  }
  return false;
}

/**
 * GET /api/analytics/product-data/outlets
 */
const getOutlets = async (req, res) => {
  try {
    const defaultOutlets = ['All Outlets', 'Online', 'Johar Town', 'Jail Road', 'Abbottabad', 'Warehouse'];
    
    // Also fetch any distinct outlet names from PosSale and Order
    const [posOutlets, orderOutlets] = await Promise.all([
      prisma.posSale.groupBy({ by: ['outletName'], where: { outletName: { not: null } } }).catch(() => []),
      prisma.order.groupBy({ by: ['outletName'], where: { outletName: { not: null } } }).catch(() => [])
    ]);

    const set = new Set(defaultOutlets);
    for (const o of posOutlets) {
      const norm = normalizeOutlet(o.outletName);
      if (norm) set.add(norm);
    }
    for (const o of orderOutlets) {
      const norm = normalizeOutlet(o.outletName);
      if (norm) set.add(norm);
    }

    res.json({ outlets: Array.from(set) });
  } catch (err) {
    console.error('[getOutlets] error:', err);
    res.status(500).json({ message: 'Error fetching outlets', error: err.message });
  }
};

/**
 * GET /api/analytics/product-data/products
 */
const getProductsCatalog = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const q = search.trim().toLowerCase();

    // Fetch distinct products from PosSaleItem and OutletInventory
    const [posItems, invItems] = await Promise.all([
      prisma.posSaleItem.groupBy({
        by: ['productName', 'color', 'size'],
        _count: { id: true },
        take: 300
      }).catch(() => []),
      prisma.outletInventory.groupBy({
        by: ['name', 'color', 'size'],
        _count: { id: true },
        take: 300
      }).catch(() => [])
    ]);

    const productMap = new Map();

    const addProduct = (name, color, size) => {
      if (!name) return;
      const key = `${name}__${color || ''}__${size || ''}`;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productName: name,
          color: color || '',
          size: size || ''
        });
      }
    };

    for (const it of posItems) addProduct(it.productName, it.color, it.size);
    for (const it of invItems) addProduct(it.name, it.color, it.size);

    let list = Array.from(productMap.values());
    if (q) {
      list = list.filter(p =>
        p.productName.toLowerCase().includes(q) ||
        (p.color && p.color.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => a.productName.localeCompare(b.productName));
    res.json({ products: list.slice(0, 150) });
  } catch (err) {
    console.error('[getProductsCatalog] error:', err);
    res.status(500).json({ message: 'Error fetching products catalog', error: err.message });
  }
};

/**
 * GET /api/analytics/product-data/summary
 */
const getProductDataSummary = async (req, res) => {
  try {
    const { outlet, preset = 'today', dateFrom, dateTo, search = '', product = '' } = req.query;
    const dateRange = buildDateRange(preset, dateFrom, dateTo);
    const selectedOutlet = outlet && outlet !== 'All Outlets' ? outlet : null;
    const prodFilter = (product || search || '').trim().toLowerCase();

    // 1. Where clause for Orders
    const orderWhere = {
      status: { notIn: ['CANCELLED', 'REJECTED'] }
    };
    if (dateRange) {
      orderWhere.createdAt = dateRange;
    }
    if (selectedOutlet) {
      if (selectedOutlet === 'Online') {
        orderWhere.OR = [
          { outletName: { contains: 'Online', mode: 'insensitive' } },
          { source: 'INTERNAL' },
          { outletName: null }
        ];
      } else {
        orderWhere.outletName = { contains: selectedOutlet, mode: 'insensitive' };
      }
    }

    // 2. Where clause for PosSale
    const posWhere = {
      refundedAt: null
    };
    if (dateRange) {
      posWhere.createdAt = dateRange;
    }
    if (selectedOutlet) {
      if (selectedOutlet === 'Online') {
        // POS is in-store, but allow if specifically tagged
        posWhere.outletName = { contains: 'Online', mode: 'insensitive' };
      } else {
        posWhere.outletName = { contains: selectedOutlet, mode: 'insensitive' };
      }
    }

    // Query both datasets
    const [orders, posSales] = await Promise.all([
      selectedOutlet === 'Warehouse' ? Promise.resolve([]) : prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderNumber: true,
          invoiceNumber: true,
          customerName: true,
          customerPhone: true,
          outletName: true,
          source: true,
          type: true,
          quantity: true,
          totalPrice: true,
          baseProductAmount: true,
          discountAmount: true,
          productDetails: true,
          sizeData: true,
          customization: true,
          customizationPrice: true,
          engravingRequired: true,
          engravingText: true,
          engravingNames: true,
          engravingType: true,
          placedBy: true,
          orderTakenBy: true,
          createdAt: true,
          stages: {
            where: { stageName: { in: ['LOGO_DESIGN', 'PRODUCTION'] } },
            select: { stageName: true, status: true, assignedEmployee: { select: { name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.posSale.findMany({
        where: posWhere,
        include: {
          items: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Data aggregation containers
    let totalOrders = 0;
    let totalQuantity = 0;
    let totalSales = 0;
    let totalDiscount = 0;
    let customizedOrdersCount = 0;
    let customizedProductsCount = 0;
    let totalEngravingsCount = 0;
    let customSizeOrdersCount = 0;
    let customSizeProductsCount = 0;
    let ordersWithDiscount = 0;
    let ordersWithoutDiscount = 0;

    const productSalesMap = new Map();
    const productDiscountMap = new Map();
    const dateDiscountMap = new Map();
    const customizationTypesMap = {
      Crown: { orders: 0, products: 0 },
      Engraving: { orders: 0, products: 0 },
      'Custom Size': { orders: 0, products: 0 },
      'Logo Design': { orders: 0, products: 0 },
      Alteration: { orders: 0, products: 0 }
    };
    const sizeMap = new Map();
    const engravingByProduct = new Map();
    const engravingByColor = new Map();
    const engravingBySize = new Map();
    const engravingByDate = new Map();
    const engravingByOutlet = new Map();
    const engravingByEmployee = new Map();
    const customSizeStats = {
      orders: 0,
      products: 0,
      withEngraving: 0,
      withoutEngraving: 0
    };
    const employeeMap = new Map();

    // Helper to get or create employee stats
    const getEmployeeStat = (empName, outletName) => {
      const name = empName && empName.trim() ? empName.trim() : 'Unassigned';
      if (!employeeMap.has(name)) {
        employeeMap.set(name, {
          employeeName: name,
          outlet: normalizeOutlet(outletName) || 'All',
          customizationsCompleted: 0,
          engravingsCompleted: 0,
          customSizeCount: 0,
          otherCustomizations: 0,
          ordersHandled: 0
        });
      }
      return employeeMap.get(name);
    };

    // Helper to format date string YYYY-MM-DD
    const fmtDate = (d) => {
      try {
        return new Date(d).toISOString().split('T')[0];
      } catch (e) {
        return 'Unknown';
      }
    };

    // PROCESS POS SALES
    for (const sale of posSales) {
      let saleMatched = false;
      let saleHasCustom = false;
      let saleHasCustomSize = false;
      let saleHasEngraving = false;
      let saleTotalQty = 0;
      let saleLineTotal = 0;

      const emp = getEmployeeStat(sale.cashierName, sale.outletName);
      const saleDateStr = fmtDate(sale.createdAt);

      for (const item of sale.items) {
        const prodName = item.productName || 'General Item';
        const color = item.color || '';
        const size = item.size || 'Standard';
        const qty = item.quantity || 1;
        const lineTotal = item.lineTotal != null ? item.lineTotal : (item.unitPrice * qty);

        // Check product filter
        if (prodFilter) {
          const match =
            prodName.toLowerCase().includes(prodFilter) ||
            color.toLowerCase().includes(prodFilter) ||
            size.toLowerCase().includes(prodFilter);
          if (!match) continue;
        }

        saleMatched = true;
        saleTotalQty += qty;
        saleLineTotal += lineTotal;

        // Customization check for item
        const isCrown = prodName.toLowerCase().includes('crown') || item.logoDesign;
        const isEngraved = item.nameEngrave || (item.engravingCharges > 0);
        const isCustom = isCustomSize(size, null, null);
        const isAlt = (item.alterationCharges > 0);
        const itemHasAnyCustom = isCrown || isEngraved || isCustom || isAlt || item.customization1 || item.customization2;

        if (itemHasAnyCustom) {
          customizedProductsCount += qty;
          saleHasCustom = true;
          emp.customizationsCompleted += qty;
        }

        if (isCrown) {
          customizationTypesMap.Crown.products += qty;
        }
        if (isAlt) {
          customizationTypesMap.Alteration.products += qty;
        }
        if (item.logoDesign) {
          customizationTypesMap['Logo Design'].products += qty;
        }

        // Custom size tracking
        if (isCustom) {
          saleHasCustomSize = true;
          customSizeProductsCount += qty;
          customSizeStats.products += qty;
          emp.customSizeCount += qty;
          customizationTypesMap['Custom Size'].products += qty;
          if (isEngraved) customSizeStats.withEngraving += qty;
          else customSizeStats.withoutEngraving += qty;
        }

        // Engraving tracking
        if (isEngraved) {
          saleHasEngraving = true;
          const engCount = item.engravingCount != null && item.engravingCount > 0 ? item.engravingCount : qty;
          totalEngravingsCount += engCount;
          emp.engravingsCompleted += engCount;
          customizationTypesMap.Engraving.products += engCount;

          // Engraving breakdowns
          engravingByProduct.set(prodName, (engravingByProduct.get(prodName) || 0) + engCount);
          if (color) engravingByColor.set(color, (engravingByColor.get(color) || 0) + engCount);
          engravingBySize.set(isCustom ? 'Custom Size' : size, (engravingBySize.get(isCustom ? 'Custom Size' : size) || 0) + engCount);
          engravingByDate.set(saleDateStr, (engravingByDate.get(saleDateStr) || 0) + engCount);
          const outName = normalizeOutlet(sale.outletName) || 'Johar Town';
          engravingByOutlet.set(outName, (engravingByOutlet.get(outName) || 0) + engCount);
          engravingByEmployee.set(emp.employeeName, (engravingByEmployee.get(emp.employeeName) || 0) + engCount);
        }

        // Size stats
        const sizeKey = isCustom ? 'Custom Size' : size;
        if (!sizeMap.has(sizeKey)) {
          sizeMap.set(sizeKey, { size: sizeKey, productsSold: 0, customized: 0, engraved: 0 });
        }
        const sStat = sizeMap.get(sizeKey);
        sStat.productsSold += qty;
        if (itemHasAnyCustom) sStat.customized += qty;
        if (isEngraved) sStat.engraved += (item.engravingCount || qty);

        // Product Sales map
        const pKey = `${prodName}__${color}__${size}`;
        if (!productSalesMap.has(pKey)) {
          productSalesMap.set(pKey, {
            productName: prodName,
            color,
            size,
            ordersCount: 0,
            quantitySold: 0,
            totalSalesAmount: 0
          });
        }
        const pStat = productSalesMap.get(pKey);
        pStat.ordersCount += 1;
        pStat.quantitySold += qty;
        pStat.totalSalesAmount += lineTotal;

        // Item discounts
        const itemDisc = (item.discountFixed || 0) * qty + ((lineTotal * (item.discountPct || 0)) / 100);
        if (itemDisc > 0) {
          productDiscountMap.set(prodName, (productDiscountMap.get(prodName) || 0) + itemDisc);
        }
      }

      if (saleMatched) {
        totalOrders += 1;
        totalQuantity += saleTotalQty;
        const finalSaleTotal = sale.grandTotal != null ? sale.grandTotal : saleLineTotal;
        totalSales += finalSaleTotal;
        emp.ordersHandled += 1;

        if (saleHasCustom) {
          customizedOrdersCount += 1;
        }
        if (saleHasCustomSize) {
          customSizeOrdersCount += 1;
          customSizeStats.orders += 1;
          customizationTypesMap['Custom Size'].orders += 1;
        }
        if (saleHasEngraving) {
          customizationTypesMap.Engraving.orders += 1;
        }

        const disc = sale.discountAmount || 0;
        totalDiscount += disc;
        if (disc > 0) {
          ordersWithDiscount += 1;
          dateDiscountMap.set(saleDateStr, (dateDiscountMap.get(saleDateStr) || 0) + disc);
        } else {
          ordersWithoutDiscount += 1;
        }
      }
    }

    // PROCESS ONLINE / OUTLET ORDERS
    for (const order of orders) {
      let orderMatched = false;
      let orderHasCustom = false;
      let orderHasCustomSize = false;
      let orderHasEngraving = false;
      let orderTotalQty = 0;
      let orderLineTotal = 0;

      const orderEmpName = order.placedBy || order.orderTakenBy || order.stages?.[0]?.assignedEmployee?.name || 'Faisal';
      const emp = getEmployeeStat(orderEmpName, order.outletName || 'Online');
      const orderDateStr = fmtDate(order.createdAt);

      const items = Array.isArray(order.productDetails) ? order.productDetails : [];

      if (items.length > 0) {
        for (const item of items) {
          const pd = item.productDetails || {};
          const prodName = pd.productType || pd.name || item.name || 'Enamels Scrub';
          const color = pd.color || item.color || '';
          const size = pd.size || item.size || 'Standard';
          const qty = item.quantity || 1;
          const lineTotal = item.totalPrice || (item.unitPrice ? item.unitPrice * qty : 0);

          if (prodFilter) {
            const match =
              prodName.toLowerCase().includes(prodFilter) ||
              color.toLowerCase().includes(prodFilter) ||
              size.toLowerCase().includes(prodFilter);
            if (!match) continue;
          }

          orderMatched = true;
          orderTotalQty += qty;
          orderLineTotal += lineTotal;

          const isCrown = prodName.toLowerCase().includes('crown') || order.type === 'READY_LOGO' || !!item.logoDesign;
          const isEngraved = order.engravingRequired || !!order.engravingText || !!order.engravingNames || !!item.customization?.nameSpelling;
          const isCustom = isCustomSize(size, item.sizeData || order.sizeData, order.type);
          const isAlt = !!pd.alteration && (pd.alteration.shirtLength || pd.alteration.sleeveLength || pd.alteration.trouserLength);
          const itemHasAnyCustom = isCrown || isEngraved || isCustom || isAlt || (item.customizationPrice && item.customizationPrice > 0);

          if (itemHasAnyCustom) {
            customizedProductsCount += qty;
            orderHasCustom = true;
            emp.customizationsCompleted += qty;
          }

          if (isCrown) {
            customizationTypesMap.Crown.products += qty;
          }
          if (isAlt) {
            customizationTypesMap.Alteration.products += qty;
          }
          if (order.type === 'READY_LOGO' || item.logoDesign) {
            customizationTypesMap['Logo Design'].products += qty;
          }

          if (isCustom) {
            orderHasCustomSize = true;
            customSizeProductsCount += qty;
            customSizeStats.products += qty;
            emp.customSizeCount += qty;
            customizationTypesMap['Custom Size'].products += qty;
            if (isEngraved) customSizeStats.withEngraving += qty;
            else customSizeStats.withoutEngraving += qty;
          }

          if (isEngraved) {
            orderHasEngraving = true;
            let engCount = qty;
            if (order.engravingNames) {
              try {
                const names = typeof order.engravingNames === 'string' ? JSON.parse(order.engravingNames) : order.engravingNames;
                if (Array.isArray(names) && names.length > 0) engCount = names.length;
              } catch (e) {}
            }
            totalEngravingsCount += engCount;
            emp.engravingsCompleted += engCount;
            customizationTypesMap.Engraving.products += engCount;

            engravingByProduct.set(prodName, (engravingByProduct.get(prodName) || 0) + engCount);
            if (color) engravingByColor.set(color, (engravingByColor.get(color) || 0) + engCount);
            engravingBySize.set(isCustom ? 'Custom Size' : size, (engravingBySize.get(isCustom ? 'Custom Size' : size) || 0) + engCount);
            engravingByDate.set(orderDateStr, (engravingByDate.get(orderDateStr) || 0) + engCount);
            const outName = normalizeOutlet(order.outletName) || 'Online';
            engravingByOutlet.set(outName, (engravingByOutlet.get(outName) || 0) + engCount);
            engravingByEmployee.set(emp.employeeName, (engravingByEmployee.get(emp.employeeName) || 0) + engCount);
          }

          const sizeKey = isCustom ? 'Custom Size' : size;
          if (!sizeMap.has(sizeKey)) {
            sizeMap.set(sizeKey, { size: sizeKey, productsSold: 0, customized: 0, engraved: 0 });
          }
          const sStat = sizeMap.get(sizeKey);
          sStat.productsSold += qty;
          if (itemHasAnyCustom) sStat.customized += qty;
          if (isEngraved) sStat.engraved += qty;

          const pKey = `${prodName}__${color}__${size}`;
          if (!productSalesMap.has(pKey)) {
            productSalesMap.set(pKey, {
              productName: prodName,
              color,
              size,
              ordersCount: 0,
              quantitySold: 0,
              totalSalesAmount: 0
            });
          }
          const pStat = productSalesMap.get(pKey);
          pStat.ordersCount += 1;
          pStat.quantitySold += qty;
          pStat.totalSalesAmount += lineTotal;
        }
      } else {
        // Fallback for order with no productDetails array
        const prodName = 'Enamels Scrub';
        if (!prodFilter || prodName.toLowerCase().includes(prodFilter)) {
          orderMatched = true;
          const qty = order.quantity || 1;
          orderTotalQty += qty;
          orderLineTotal += (order.totalPrice || 0);

          const isCustom = isCustomSize(null, order.sizeData, order.type);
          const isEngraved = order.engravingRequired || !!order.engravingText || !!order.engravingNames;

          if (isCustom) {
            orderHasCustomSize = true;
            customSizeProductsCount += qty;
            customSizeStats.products += qty;
            if (isEngraved) customSizeStats.withEngraving += qty;
            else customSizeStats.withoutEngraving += qty;
          }
          if (isEngraved) {
            orderHasEngraving = true;
            totalEngravingsCount += qty;
          }
        }
      }

      if (orderMatched) {
        totalOrders += 1;
        totalQuantity += orderTotalQty;
        const finalOrderTotal = order.totalPrice != null ? order.totalPrice : orderLineTotal;
        totalSales += finalOrderTotal;
        emp.ordersHandled += 1;

        if (orderHasCustom) customizedOrdersCount += 1;
        if (orderHasCustomSize) {
          customSizeOrdersCount += 1;
          customSizeStats.orders += 1;
          customizationTypesMap['Custom Size'].orders += 1;
        }
        if (orderHasEngraving) {
          customizationTypesMap.Engraving.orders += 1;
        }

        const disc = order.discountAmount || 0;
        totalDiscount += disc;
        if (disc > 0) {
          ordersWithDiscount += 1;
          dateDiscountMap.set(orderDateStr, (dateDiscountMap.get(orderDateStr) || 0) + disc);
        } else {
          ordersWithoutDiscount += 1;
        }
      }
    }

    // Convert breakdown maps to arrays
    const productSales = Array.from(productSalesMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
    const sizeBreakdown = Array.from(sizeMap.values()).sort((a, b) => b.productsSold - a.productsSold);
    const employeeBreakdown = Array.from(employeeMap.values()).sort((a, b) => b.ordersHandled - a.ordersHandled);

    const mapToSortedArray = (map, keyName = 'name', valName = 'count') =>
      Array.from(map.entries())
        .map(([k, v]) => ({ [keyName]: k, [valName]: v }))
        .sort((a, b) => b[valName] - a[valName]);

    res.json({
      summary: {
        totalOrders,
        totalQuantity,
        totalSales,
        totalDiscount,
        averageDiscount: ordersWithDiscount > 0 ? Math.round(totalDiscount / ordersWithDiscount) : 0,
        ordersWithDiscount,
        ordersWithoutDiscount,
        customizedOrders: customizedOrdersCount,
        customizedProducts: customizedProductsCount,
        totalEngravings: totalEngravingsCount,
        customSizeOrders: customSizeOrdersCount,
        customSizeProducts: customSizeProductsCount
      },
      productSales,
      sizeBreakdown,
      customizationBreakdown: {
        types: Object.entries(customizationTypesMap).map(([type, counts]) => ({
          type,
          orders: counts.orders,
          products: counts.products
        })),
        customSizeStats
      },
      engravingBreakdown: {
        totalOrders: customizationTypesMap.Engraving.orders,
        totalProducts: customizationTypesMap.Engraving.products,
        totalEngravings: totalEngravingsCount,
        byProduct: mapToSortedArray(engravingByProduct, 'product', 'engravings'),
        byColor: mapToSortedArray(engravingByColor, 'color', 'engravings'),
        bySize: mapToSortedArray(engravingBySize, 'size', 'engravings'),
        byDate: mapToSortedArray(engravingByDate, 'date', 'engravings'),
        byOutlet: mapToSortedArray(engravingByOutlet, 'outlet', 'engravings'),
        byEmployee: mapToSortedArray(engravingByEmployee, 'employee', 'engravings')
      },
      discountBreakdown: {
        byProduct: mapToSortedArray(productDiscountMap, 'product', 'discount'),
        byDate: mapToSortedArray(dateDiscountMap, 'date', 'discount')
      },
      employeeBreakdown
    });
  } catch (err) {
    console.error('[getProductDataSummary] error:', err);
    res.status(500).json({ message: 'Error computing product data summary', error: err.message });
  }
};

/**
 * GET /api/analytics/product-data/orders
 * Paginated drilldown table of underlying orders & POS sales
 */
const getProductDataOrders = async (req, res) => {
  try {
    const {
      outlet,
      preset = 'today',
      dateFrom,
      dateTo,
      search = '',
      page = 1,
      limit = 50,
      filterType = 'all' // all, engraved, custom_size, discounted, customized
    } = req.query;

    const dateRange = buildDateRange(preset, dateFrom, dateTo);
    const selectedOutlet = outlet && outlet !== 'All Outlets' ? outlet : null;
    const q = search.trim().toLowerCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(limit, 10) || 50));

    // Fetch POS sales and Orders
    const orderWhere = { status: { notIn: ['CANCELLED', 'REJECTED'] } };
    if (dateRange) orderWhere.createdAt = dateRange;
    if (selectedOutlet) {
      if (selectedOutlet === 'Online') {
        orderWhere.OR = [
          { outletName: { contains: 'Online', mode: 'insensitive' } },
          { source: 'INTERNAL' },
          { outletName: null }
        ];
      } else {
        orderWhere.outletName = { contains: selectedOutlet, mode: 'insensitive' };
      }
    }

    const posWhere = { refundedAt: null };
    if (dateRange) posWhere.createdAt = dateRange;
    if (selectedOutlet) {
      posWhere.outletName = { contains: selectedOutlet, mode: 'insensitive' };
    }

    const [posSales, orders] = await Promise.all([
      prisma.posSale.findMany({
        where: posWhere,
        include: { items: true },
        orderBy: { createdAt: 'desc' }
      }),
      selectedOutlet === 'Warehouse' ? Promise.resolve([]) : prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderNumber: true,
          invoiceNumber: true,
          customerName: true,
          customerPhone: true,
          outletName: true,
          type: true,
          totalPrice: true,
          discountAmount: true,
          productDetails: true,
          sizeData: true,
          customization: true,
          engravingRequired: true,
          engravingText: true,
          engravingNames: true,
          placedBy: true,
          orderTakenBy: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const allRecords = [];

    // Normalize POS sales
    for (const sale of posSales) {
      const items = sale.items || [];
      const isEngraved = items.some(i => i.nameEngrave || i.engravingCharges > 0);
      const isCustomSizeOrder = items.some(i => isCustomSize(i.size, null, null));
      const hasDiscount = (sale.discountAmount || 0) > 0;
      const isCustomized = isEngraved || isCustomSizeOrder || items.some(i => i.customization1 || i.customization2 || i.logoDesign || i.alterationCharges > 0);

      // Filter check
      if (filterType === 'engraved' && !isEngraved) continue;
      if (filterType === 'custom_size' && !isCustomSizeOrder) continue;
      if (filterType === 'discounted' && !hasDiscount) continue;
      if (filterType === 'customized' && !isCustomized) continue;

      const record = {
        id: sale.id,
        source: 'POS',
        orderNumber: sale.orderNumber || sale.receiptNumber,
        invoiceNumber: sale.receiptNumber,
        customerName: sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerPhone || 'N/A',
        outlet: normalizeOutlet(sale.outletName) || 'Johar Town',
        employee: sale.cashierName || 'Cashier',
        orderDate: sale.createdAt,
        totalAmount: sale.grandTotal || 0,
        discountAmount: sale.discountAmount || 0,
        netAmount: sale.grandTotal || 0,
        isEngraved,
        isCustomSize: isCustomSizeOrder,
        items: items.map(i => ({
          productName: i.productName,
          color: i.color || '',
          size: i.size || '',
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || 0,
          engravingText: i.engravingText || (i.nameEngrave ? 'Yes' : null),
          engravingCount: i.engravingCount || (i.nameEngrave ? i.quantity : 0),
          isCustomSize: isCustomSize(i.size, null, null)
        }))
      };

      if (q) {
        const text = `${record.orderNumber} ${record.invoiceNumber} ${record.customerName} ${record.customerPhone} ${record.outlet} ${record.employee} ${record.items.map(i => i.productName).join(' ')}`.toLowerCase();
        if (!text.includes(q)) continue;
      }

      allRecords.push(record);
    }

    // Normalize Orders
    for (const order of orders) {
      const items = Array.isArray(order.productDetails) ? order.productDetails : [];
      const isEngraved = order.engravingRequired || !!order.engravingText || !!order.engravingNames;
      const isCustomSizeOrder = isCustomSize(null, order.sizeData, order.type) || items.some(i => isCustomSize(i.productDetails?.size || i.size, i.sizeData, order.type));
      const hasDiscount = (order.discountAmount || 0) > 0;
      const isCustomized = isEngraved || isCustomSizeOrder || order.type === 'READY_LOGO' || (order.customizationPrice && order.customizationPrice > 0);

      if (filterType === 'engraved' && !isEngraved) continue;
      if (filterType === 'custom_size' && !isCustomSizeOrder) continue;
      if (filterType === 'discounted' && !hasDiscount) continue;
      if (filterType === 'customized' && !isCustomized) continue;

      const record = {
        id: order.id,
        source: 'ORDER',
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber || order.orderNumber,
        customerName: order.customerName || 'Customer',
        customerPhone: order.customerPhone || 'N/A',
        outlet: normalizeOutlet(order.outletName) || 'Online',
        employee: order.placedBy || order.orderTakenBy || 'Faisal',
        orderDate: order.createdAt,
        totalAmount: order.totalPrice || 0,
        discountAmount: order.discountAmount || 0,
        netAmount: order.totalPrice || 0,
        isEngraved,
        isCustomSize: isCustomSizeOrder,
        items: items.map(i => {
          const pd = i.productDetails || {};
          return {
            productName: pd.productType || pd.name || i.name || 'Enamels Scrub',
            color: pd.color || i.color || '',
            size: pd.size || i.size || '',
            quantity: i.quantity || 1,
            unitPrice: i.unitPrice || 0,
            engravingText: order.engravingText || order.engravingNames || (order.engravingRequired ? 'Yes' : null),
            engravingCount: order.engravingRequired ? (i.quantity || 1) : 0,
            isCustomSize: isCustomSize(pd.size || i.size, i.sizeData || order.sizeData, order.type)
          };
        })
      };

      if (q) {
        const text = `${record.orderNumber} ${record.invoiceNumber} ${record.customerName} ${record.customerPhone} ${record.outlet} ${record.employee} ${record.items.map(i => i.productName).join(' ')}`.toLowerCase();
        if (!text.includes(q)) continue;
      }

      allRecords.push(record);
    }

    // Sort descending by date
    allRecords.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    const totalCount = allRecords.length;
    const startIndex = (pageNum - 1) * pageSize;
    const paginated = allRecords.slice(startIndex, startIndex + pageSize);

    res.json({
      orders: paginated,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (err) {
    console.error('[getProductDataOrders] error:', err);
    res.status(500).json({ message: 'Error fetching drilldown orders', error: err.message });
  }
};

module.exports = {
  getOutlets,
  getProductsCatalog,
  getProductDataSummary,
  getProductDataOrders
};
