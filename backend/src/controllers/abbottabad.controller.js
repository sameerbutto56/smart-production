const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { resolvePktDateRange } = require('../utils/workingHours');
const { resolveMasterPrice } = require('../utils/priceSync');
const { computeUnifiedSalesSummary } = require('../utils/posUnified');

const JWT_SECRET = process.env.JWT_SECRET || 'abbottabad-secret-key-2026';
const ABBOTTABAD_PASSWORD_KEY = 'ABBOTTABAD_DASHBOARD_PASSWORD_HASH';
const DEFAULT_ABBOTTABAD_PASS = 'abbottabad@2026';

// ---------------------------------------------------------------------
// 1. Password Protection & Authentication Gate
// ---------------------------------------------------------------------

const getOrInitPasswordHash = async () => {
  let setting = await prisma.systemSetting.findUnique({
    where: { key: ABBOTTABAD_PASSWORD_KEY }
  });
  if (!setting) {
    const hash = await bcrypt.hash(DEFAULT_ABBOTTABAD_PASS, 10);
    setting = await prisma.systemSetting.create({
      data: { key: ABBOTTABAD_PASSWORD_KEY, value: hash }
    });
  }
  return setting.value;
};

const verifyAbbottabadPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const storedHash = await getOrInitPasswordHash();
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Abbottabad password. Access denied.' });
    }

    const token = jwt.sign(
      {
        sub: req.user.id,
        role: req.user.role,
        name: req.user.name,
        access: 'ABBOTTABAD_DASHBOARD'
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      message: 'Abbottabad access authorized',
      token,
      expiresIn: 12 * 3600
    });
  } catch (error) {
    res.status(500).json({ message: 'Authentication error', error: error.message });
  }
};

const changeAbbottabadPassword = async (req, res) => {
  try {
    const { newPassword, currentPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const storedHash = await getOrInitPasswordHash();
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, storedHash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.systemSetting.upsert({
      where: { key: ABBOTTABAD_PASSWORD_KEY },
      update: { value: newHash },
      create: { key: ABBOTTABAD_PASSWORD_KEY, value: newHash }
    });

    res.json({ success: true, message: 'Abbottabad password successfully updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
};

// Middleware to guard sensitive Abbottabad cost endpoints
const requireAbbottabadAuth = async (req, res, next) => {
  try {
    const token = req.headers['x-abbottabad-token'] || req.query.abbottabadToken;
    if (!token) {
      return res.status(403).json({
        message: 'Abbottabad dashboard authentication required. Enter password to view financial data.'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.access !== 'ABBOTTABAD_DASHBOARD') {
        return res.status(403).json({ message: 'Invalid token access claim' });
      }
      req.abbottabadAuth = decoded;
      next();
    } catch (jwtErr) {
      return res.status(401).json({ message: 'Abbottabad session expired or invalid. Please re-authenticate.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Authorization error', error: error.message });
  }
};

// ---------------------------------------------------------------------
// 2. Cost Price Resolution Helpers
// ---------------------------------------------------------------------

const findProductCostPrice = async (item) => {
  const { productName, size, color } = item;
  if (size || color) {
    const specificMatch = await prisma.abbottabadCostPriceItem.findFirst({
      where: {
        productName: { equals: productName, mode: 'insensitive' },
        ...(size ? { size: { equals: size, mode: 'insensitive' } } : {}),
        ...(color ? { color: { equals: color, mode: 'insensitive' } } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    if (specificMatch && specificMatch.costPrice > 0) return specificMatch.costPrice;
  }

  const nameMatch = await prisma.abbottabadCostPriceItem.findFirst({
    where: { productName: { equals: productName, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' }
  });
  if (nameMatch && nameMatch.costPrice > 0) return nameMatch.costPrice;

  if (item.inventoryItemId) {
    const inv = await prisma.inventoryItem.findUnique({
      where: { id: item.inventoryItemId },
      select: { costPrice: true }
    });
    if (inv && inv.costPrice != null && parseFloat(inv.costPrice) > 0) {
      return parseFloat(inv.costPrice);
    }
  }

  return null;
};

// ---------------------------------------------------------------------
// 3. Demand Financial Summary & Drilldown
// ---------------------------------------------------------------------

const getDemandFinancialSummary = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const canSeeCost = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(req.user.role);

    let dateFilter = {};
    if (range !== 'all') {
      const { start, end } = resolvePktDateRange({ range: range || 'today', dateFrom, dateTo });
      dateFilter = { gte: start, lt: end };
    }

    const where = {
      outletName: { contains: 'Abbottabad', mode: 'insensitive' },
      ...(range !== 'all' ? { createdAt: dateFilter } : {})
    };

    const demands = await prisma.outletDemandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const demandIds = demands.map(d => d.id);
    const financials = await prisma.abbottabadDemandFinancial.findMany({
      where: { demandId: { in: demandIds } }
    });
    const finMap = new Map(financials.map(f => [f.demandId, f]));

    let totalProductValue = 0;
    let totalBilty = 0;
    let totalActualPlusBilty = 0;
    let totalCostAmount = 0;
    let totalCostPlusBilty = 0;
    let missingCostDemandsCount = 0;
    const missingProductNamesSet = new Set();

    for (const d of demands) {
      const fin = finMap.get(d.id);
      if (fin) {
        totalProductValue += fin.productValue || 0;
        totalBilty += fin.biltyAmount || 0;
        totalActualPlusBilty += fin.actualPlusBilty || 0;
        if (fin.costAmount != null) {
          totalCostAmount += fin.costAmount;
          totalCostPlusBilty += (fin.costPlusBilty || (fin.costAmount + (fin.biltyAmount || 0)));
        }
        if (fin.costPriceMissing) {
          missingCostDemandsCount++;
          if (Array.isArray(fin.missingProductNames)) {
            fin.missingProductNames.forEach(p => missingProductNamesSet.add(p));
          }
        }
      } else {
        const items = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
        let dProductValue = 0;
        for (const it of items) {
          const qty = it.approvedQty > 0 ? it.approvedQty : (it.requestedQty || 1);
          const price = parseFloat(it.actualUnitPrice) || 0;
          dProductValue += qty * price;
        }
        totalProductValue += dProductValue;
        totalActualPlusBilty += dProductValue;
      }
    }

    let posSales = {
      grossSales: 0,
      totalSales: 0,
      netSales: 0,
      netRevenue: 0,
      totalDiscount: 0,
      totalReceived: 0,
      totalReturns: 0,
      totalJournalExpenses: 0,
      cash: 0,
      card: 0,
      online: 0,
    };

    try {
      const pkt = range !== 'all' ? resolvePktDateRange({ range: range || 'today', dateFrom, dateTo }) : { start: null, end: null };
      const unified = await computeUnifiedSalesSummary(prisma, {
        outlet: 'Abbottabad',
        start: pkt.start,
        end: pkt.end,
        isHalfOpen: true
      });
      if (unified) {
        posSales = {
          grossSales: unified.grossSales || unified.totalSales || 0,
          totalSales: unified.totalSales || unified.grossSales || 0,
          netSales: unified.netSales || 0,
          netRevenue: unified.netRevenue || 0,
          totalDiscount: unified.totalDiscount || 0,
          totalReceived: unified.totalReceived || 0,
          totalReturns: unified.refundAmount || 0,
          totalJournalExpenses: unified.totalJournalExpenses || 0,
          cash: unified.paymentSummary?.cash || 0,
          card: unified.paymentSummary?.card || 0,
          online: unified.paymentSummary?.online || 0,
        };
      }
    } catch (posErr) {
      console.error('Failed to compute POS sales summary for Abbottabad:', posErr);
    }

    res.json({
      range: range || 'today',
      totalDemands: demands.length,
      productValue: totalProductValue,
      biltyAmount: totalBilty,
      actualPlusBilty: totalActualPlusBilty,
      costAmount: canSeeCost ? totalCostAmount : null,
      costPlusBilty: canSeeCost ? totalCostPlusBilty : null,
      missingCostDemandsCount: canSeeCost ? missingCostDemandsCount : null,
      missingProducts: canSeeCost ? Array.from(missingProductNamesSet) : null,
      posSales
    });
  } catch (error) {
    res.status(500).json({ message: 'Error computing demand summary', error: error.message });
  }
};

const getDemandFinancialDetails = async (req, res) => {
  try {
    const { range, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const canSeeCost = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(req.user.role);

    let dateFilter = {};
    if (range !== 'all') {
      const { start, end } = resolvePktDateRange({ range: range || 'today', dateFrom, dateTo });
      dateFilter = { gte: start, lt: end };
    }

    const where = {
      outletName: { contains: 'Abbottabad', mode: 'insensitive' },
      ...(range !== 'all' ? { createdAt: dateFilter } : {})
    };

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [total, demands] = await Promise.all([
      prisma.outletDemandRequest.count({ where }),
      prisma.outletDemandRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      })
    ]);

    const demandIds = demands.map(d => d.id);
    const financials = await prisma.abbottabadDemandFinancial.findMany({
      where: { demandId: { in: demandIds } }
    });
    const finMap = new Map(financials.map(f => [f.demandId, f]));

    const records = demands.map(d => {
      const fin = finMap.get(d.id);
      const rawItems = typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []);
      const itemFinancials = fin?.itemFinancials
        ? (typeof fin.itemFinancials === 'string' ? JSON.parse(fin.itemFinancials) : fin.itemFinancials)
        : rawItems.map(it => ({
            productName: it.productName,
            size: it.size || '',
            color: it.color || '',
            requestedQty: it.requestedQty || 0,
            approvedQty: it.approvedQty || 0,
            actualUnitPrice: it.actualUnitPrice || 0,
            actualLineTotal: (it.approvedQty || it.requestedQty || 0) * (parseFloat(it.actualUnitPrice) || 0),
            costUnitPrice: canSeeCost ? (it.costUnitPrice || null) : null,
            costLineTotal: canSeeCost ? (it.costLineTotal || null) : null,
            costMissing: it.costMissing !== false
          }));

      const sanitizedItems = itemFinancials.map(it => ({
        ...it,
        costUnitPrice: canSeeCost ? it.costUnitPrice : undefined,
        costLineTotal: canSeeCost ? it.costLineTotal : undefined,
        costMissing: canSeeCost ? it.costMissing : undefined
      }));

      return {
        id: d.id,
        transferNumber: d.transferNumber,
        status: d.status,
        outletName: d.outletName,
        createdAt: d.createdAt,
        dispatchedAt: d.dispatchedAt,
        acceptedAt: d.acceptedAt,
        deliveryChannel: d.deliveryChannel,
        biltyType: fin?.biltyType || (d.deliveryChannel === 'BILTY' ? 'BILTY' : 'TCS'),
        biltyAmount: fin ? fin.biltyAmount : 0,
        productValue: fin ? fin.productValue : 0,
        actualPlusBilty: fin ? fin.actualPlusBilty : 0,
        costAmount: canSeeCost ? fin?.costAmount : undefined,
        costPlusBilty: canSeeCost ? fin?.costPlusBilty : undefined,
        costPriceMissing: canSeeCost ? fin?.costPriceMissing : undefined,
        missingProductNames: canSeeCost ? fin?.missingProductNames : undefined,
        items: sanitizedItems
      };
    });

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      records
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching demand details', error: error.message });
  }
};

// ---------------------------------------------------------------------
// 4. Cost Price Excel Upload & Audit
// ---------------------------------------------------------------------

const uploadCostPriceExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ message: 'Excel file contains no sheets' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ message: 'Uploaded sheet contains no data rows' });
    }

    let matchedCount = 0;
    let missingCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    const findValue = (row, candidates) => {
      for (const k of Object.keys(row)) {
        const cleaned = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const c of candidates) {
          if (cleaned === c.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            return row[k];
          }
        }
      }
      return '';
    };

    const uploadRecord = await prisma.abbottabadCostPriceUpload.create({
      data: {
        fileName: req.file.originalname || 'cost_prices.xlsx',
        uploadedById: req.user.id,
        uploadedByName: req.user.name || req.user.email,
        totalRows: rawRows.length
      }
    });

    const parsedItems = [];

    for (const row of rawRows) {
      const productName = String(findValue(row, ['productname', 'product', 'name', 'item', 'title'])).trim();
      const article = String(findValue(row, ['article', 'articleno', 'artno'])).trim();
      const sku = String(findValue(row, ['sku', 'itemcode', 'barcode'])).trim();
      const productCode = String(findValue(row, ['productcode', 'code'])).trim();
      const variant = String(findValue(row, ['variant'])).trim();
      const size = String(findValue(row, ['size'])).trim();
      const color = String(findValue(row, ['color', 'colour'])).trim();
      const rawCost = findValue(row, ['costprice', 'cost', 'costrate', 'rate', 'purchaseprice', 'unitcost']);

      const costPrice = parseFloat(String(rawCost).replace(/[^0-9.]/g, ''));

      if (!productName && !sku && !article) {
        failedCount++;
        continue;
      }

      if (Number.isNaN(costPrice) || costPrice <= 0) {
        missingCount++;
        continue;
      }

      parsedItems.push({
        uploadId: uploadRecord.id,
        productName: productName || (sku ? `SKU: ${sku}` : `Article: ${article}`),
        article: article || null,
        sku: sku || null,
        productCode: productCode || null,
        variant: variant || null,
        size: size || null,
        color: color || null,
        costPrice
      });
      matchedCount++;
    }

    if (parsedItems.length > 0) {
      await prisma.abbottabadCostPriceItem.createMany({
        data: parsedItems
      });
    }

    await prisma.abbottabadCostPriceUpload.update({
      where: { id: uploadRecord.id },
      data: {
        matchedRows: matchedCount,
        missingRows: missingCount,
        updatedRows: updatedCount,
        failedRows: failedCount
      }
    });

    // Backfill any AbbottabadDemandFinancial records that were marked with costPriceMissing
    const incompleteFinancials = await prisma.abbottabadDemandFinancial.findMany({
      where: { costPriceMissing: true }
    });

    for (const fin of incompleteFinancials) {
      let items = typeof fin.itemFinancials === 'string' ? JSON.parse(fin.itemFinancials) : fin.itemFinancials;
      if (!Array.isArray(items)) continue;

      let stillMissing = false;
      let newCostTotal = 0;
      const missingList = [];

      for (const it of items) {
        if (it.costMissing || it.costUnitPrice == null) {
          const resolvedCost = await findProductCostPrice(it);
          if (resolvedCost != null && resolvedCost > 0) {
            it.costUnitPrice = resolvedCost;
            it.costLineTotal = (it.approvedQty || it.requestedQty || 1) * resolvedCost;
            it.costMissing = false;
          } else {
            stillMissing = true;
            missingList.push(it.productName);
          }
        }
        newCostTotal += (it.costLineTotal || 0);
      }

      await prisma.abbottabadDemandFinancial.update({
        where: { id: fin.id },
        data: {
          costAmount: newCostTotal,
          costPlusBilty: newCostTotal + fin.biltyAmount,
          costPriceMissing: stillMissing,
          missingProductNames: missingList,
          itemFinancials: items,
          costUploadVersionId: uploadRecord.id
        }
      });
    }

    res.json({
      success: true,
      message: 'Cost price Excel processed successfully',
      uploadId: uploadRecord.id,
      fileName: uploadRecord.fileName,
      totalRows: rawRows.length,
      matchedProducts: matchedCount,
      missingPrices: missingCount,
      failedRows: failedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing cost price Excel', error: error.message });
  }
};

const getCostPriceUploadHistory = async (req, res) => {
  try {
    const uploads = await prisma.abbottabadCostPriceUpload.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching upload history', error: error.message });
  }
};

// ---------------------------------------------------------------------
// 5. Abbottabad "Amount" Control System
// ---------------------------------------------------------------------

const getOrCreateAmountAccount = async () => {
  let acc = await prisma.abbottabadAmountAccount.findUnique({
    where: { outletName: 'Abbottabad' }
  });
  if (!acc) {
    acc = await prisma.abbottabadAmountAccount.create({
      data: {
        outletName: 'Abbottabad',
        approvedAmount: 0,
        runningBalance: 0,
        totalConsumed: 0,
        isCleared: false
      }
    });
  }
  return acc;
};

const getAmountAccountState = async (req, res) => {
  try {
    const account = await getOrCreateAmountAccount();
    const pendingProposal = await prisma.abbottabadAmountProposal.findFirst({
      where: {
        accountId: account.id,
        status: { in: ['PENDING', 'ADMIN_APPROVED', 'ABBOTTABAD_APPROVED'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      account: {
        id: account.id,
        outletName: account.outletName,
        approvedAmount: account.approvedAmount,
        runningBalance: account.runningBalance,
        totalConsumed: account.totalConsumed,
        isCleared: account.isCleared,
        lastClearedAt: account.lastClearedAt
      },
      pendingProposal
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching amount state', error: error.message });
  }
};

const proposeAmountChange = async (req, res) => {
  try {
    const { type, amount, notes } = req.body || {};
    const validTypes = ['INITIAL_AMOUNT', 'INCREASE', 'DECREASE', 'CLEAR', 'ADJUSTMENT'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: `Invalid proposal type. Must be one of: ${validTypes.join(', ')}` });
    }

    const numericAmount = type === 'CLEAR' ? 0 : parseFloat(amount);
    if (type !== 'CLEAR' && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      return res.status(400).json({ message: 'Amount must be a valid positive number' });
    }

    const account = await getOrCreateAmountAccount();

    const existingPending = await prisma.abbottabadAmountProposal.findFirst({
      where: {
        accountId: account.id,
        status: { in: ['PENDING', 'ADMIN_APPROVED', 'ABBOTTABAD_APPROVED'] }
      }
    });
    if (existingPending) {
      return res.status(409).json({
        message: 'A proposal is already pending dual approval. Please approve or reject it first.',
        pendingProposal: existingPending
      });
    }

    const isOutletUser = req.user.role === 'OUTLET' || String(req.user.name).toLowerCase().includes('abbottabad');
    const proposedBy = isOutletUser ? 'ABBOTTABAD' : 'ADMIN';
    const initialStatus = proposedBy === 'ADMIN' ? 'ADMIN_APPROVED' : 'ABBOTTABAD_APPROVED';

    const proposal = await prisma.abbottabadAmountProposal.create({
      data: {
        accountId: account.id,
        type,
        proposedAmount: numericAmount,
        previousApprovedAmount: account.approvedAmount,
        previousRunningBalance: account.runningBalance,
        proposedBy,
        proposedById: req.user.id,
        proposedByName: req.user.name || req.user.email,
        status: initialStatus,
        ...(proposedBy === 'ADMIN' ? {
          adminApprovedAt: new Date(),
          adminApprovedById: req.user.id,
          adminApprovedByName: req.user.name || req.user.email
        } : {
          abbottabadApprovedAt: new Date(),
          abbottabadApprovedById: req.user.id,
          abbottabadApprovedByName: req.user.name || req.user.email
        }),
        notes: notes || ''
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('abbottabad:amount-updated', { type: 'proposal-created', proposal });
    }

    res.status(201).json({
      message: `Proposal submitted. Waiting for ${proposedBy === 'ADMIN' ? 'Abbottabad' : 'Admin'} approval.`,
      proposal
    });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting amount proposal', error: error.message });
  }
};

const approveAmountProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.abbottabadAmountProposal.findUnique({ where: { id } });
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      return res.status(400).json({ message: `Proposal has already been ${proposal.status.toLowerCase()}` });
    }

    const isOutletUser = req.user.role === 'OUTLET' || String(req.user.name).toLowerCase().includes('abbottabad');
    const isAdminUser = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(req.user.role);

    let canApprove = false;
    if (proposal.status === 'ADMIN_APPROVED' && isOutletUser) {
      canApprove = true;
    } else if (proposal.status === 'ABBOTTABAD_APPROVED' && isAdminUser) {
      canApprove = true;
    }

    if (!canApprove) {
      return res.status(403).json({
        message: proposal.status === 'ADMIN_APPROVED'
          ? 'This proposal requires approval from Abbottabad side'
          : 'This proposal requires approval from Admin side'
      });
    }

    let updatedAccount;
    let ledgerEntry;

    await prisma.$transaction(async (tx) => {
      const acc = await tx.abbottabadAmountAccount.findUnique({ where: { id: proposal.accountId } });
      if (!acc) throw new Error('Amount account not found');

      const prevApproved = acc.approvedAmount;
      const prevBalance = acc.runningBalance;
      let newApproved = prevApproved;
      let newBalance = prevBalance;
      let adjustmentDelta = proposal.proposedAmount;

      switch (proposal.type) {
        case 'INITIAL_AMOUNT':
          newApproved = proposal.proposedAmount;
          newBalance = proposal.proposedAmount;
          adjustmentDelta = proposal.proposedAmount;
          break;
        case 'INCREASE':
          newApproved = prevApproved + proposal.proposedAmount;
          newBalance = prevBalance + proposal.proposedAmount;
          adjustmentDelta = proposal.proposedAmount;
          break;
        case 'DECREASE':
          newApproved = prevApproved - proposal.proposedAmount;
          newBalance = prevBalance - proposal.proposedAmount;
          adjustmentDelta = -proposal.proposedAmount;
          break;
        case 'CLEAR':
          newApproved = 0;
          newBalance = 0;
          adjustmentDelta = -prevBalance;
          break;
        case 'ADJUSTMENT':
          newApproved = prevApproved + proposal.proposedAmount;
          newBalance = prevBalance + proposal.proposedAmount;
          adjustmentDelta = proposal.proposedAmount;
          break;
      }

      await tx.abbottabadAmountProposal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          ...(isOutletUser ? {
            abbottabadApprovedAt: new Date(),
            abbottabadApprovedById: req.user.id,
            abbottabadApprovedByName: req.user.name || req.user.email
          } : {
            adminApprovedAt: new Date(),
            adminApprovedById: req.user.id,
            adminApprovedByName: req.user.name || req.user.email
          })
        }
      });

      updatedAccount = await tx.abbottabadAmountAccount.update({
        where: { id: acc.id },
        data: {
          approvedAmount: newApproved,
          runningBalance: newBalance,
          isCleared: proposal.type === 'CLEAR',
          ...(proposal.type === 'CLEAR' ? { lastClearedAt: new Date() } : {})
        }
      });

      ledgerEntry = await tx.abbottabadAmountLedger.create({
        data: {
          accountId: acc.id,
          proposalId: proposal.id,
          actionType: proposal.type,
          previousAmount: prevApproved,
          adjustmentAmount: adjustmentDelta,
          newAmount: newApproved,
          previousBalance: prevBalance,
          consumedAmount: 0,
          newBalance: newBalance,
          details: `${proposal.type} approved by both Admin and Abbottabad`,
          performedById: req.user.id,
          performedByName: req.user.name || req.user.email,
          performedByRole: req.user.role
        }
      });
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('abbottabad:amount-updated', { type: 'approved', account: updatedAccount, ledger: ledgerEntry });
    }

    res.json({
      message: `Amount ${proposal.type.toLowerCase()} successfully approved and applied`,
      account: updatedAccount,
      ledger: ledgerEntry
    });
  } catch (error) {
    res.status(500).json({ message: 'Error approving proposal', error: error.message });
  }
};

const rejectAmountProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const proposal = await prisma.abbottabadAmountProposal.findUnique({ where: { id } });
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      return res.status(400).json({ message: `Proposal is already ${proposal.status.toLowerCase()}` });
    }

    const updated = await prisma.abbottabadAmountProposal.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: req.user.id,
        rejectedByName: req.user.name || req.user.email,
        rejectionReason: reason || 'Rejected by reviewer'
      }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('abbottabad:amount-updated', { type: 'rejected', proposal: updated });
    }

    res.json({
      message: 'Proposal rejected. Active amount and balance remain unchanged.',
      proposal: updated
    });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting proposal', error: error.message });
  }
};

const getAmountLedger = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const account = await getOrCreateAmountAccount();
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [total, entries] = await Promise.all([
      prisma.abbottabadAmountLedger.count({ where: { accountId: account.id } }),
      prisma.abbottabadAmountLedger.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      })
    ]);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      entries
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ledger', error: error.message });
  }
};

// ---------------------------------------------------------------------
// 6. Excel Export
// ---------------------------------------------------------------------

const exportDemandsExcel = async (req, res) => {
  try {
    const { range, dateFrom, dateTo } = req.query;
    const canSeeCost = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(req.user.role);

    let dateFilter = {};
    if (range !== 'all') {
      const { start, end } = resolvePktDateRange({ range: range || 'today', dateFrom, dateTo });
      dateFilter = { gte: start, lt: end };
    }

    const where = {
      outletName: { contains: 'Abbottabad', mode: 'insensitive' },
      ...(range !== 'all' ? { createdAt: dateFilter } : {})
    };

    const demands = await prisma.outletDemandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const demandIds = demands.map(d => d.id);
    const financials = await prisma.abbottabadDemandFinancial.findMany({
      where: { demandId: { in: demandIds } }
    });
    const finMap = new Map(financials.map(f => [f.demandId, f]));

    const rows = [];
    for (const d of demands) {
      const fin = finMap.get(d.id);
      const items = fin?.itemFinancials
        ? (typeof fin.itemFinancials === 'string' ? JSON.parse(fin.itemFinancials) : fin.itemFinancials)
        : (typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []));

      for (const it of items) {
        const row = {
          'Demand #': d.transferNumber || d.id.slice(0, 8),
          'Date': new Date(d.createdAt).toLocaleDateString('en-GB'),
          'Product Name': it.productName,
          'Color': it.color || '-',
          'Size': it.size || '-',
          'Quantity': it.approvedQty > 0 ? it.approvedQty : (it.requestedQty || 1),
          'Actual Unit Price': parseFloat(it.actualUnitPrice) || 0,
          'Actual Line Total': parseFloat(it.actualLineTotal) || 0,
          'Bilty Type': fin?.biltyType || 'TCS',
          'Bilty Amount': fin?.biltyAmount || 0,
          'Actual + Bilty': fin?.actualPlusBilty || 0,
          'Status': d.status
        };

        if (canSeeCost) {
          row['Cost Price'] = it.costUnitPrice != null ? parseFloat(it.costUnitPrice) : 'Cost Price Missing';
          row['Total Cost'] = it.costLineTotal != null ? parseFloat(it.costLineTotal) : 'Cost Price Missing';
          row['Cost + Bilty'] = fin?.costPlusBilty != null ? fin.costPlusBilty : 'Cost Price Missing';
        }

        rows.push(row);
      }
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, 'Abbottabad Demands');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=Abbottabad_Demands_${Date.now()}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: 'Error exporting Excel', error: error.message });
  }
};

module.exports = {
  verifyAbbottabadPassword,
  changeAbbottabadPassword,
  requireAbbottabadAuth,
  findProductCostPrice,
  getDemandFinancialSummary,
  getDemandFinancialDetails,
  uploadCostPriceExcel,
  getCostPriceUploadHistory,
  getAmountAccountState,
  proposeAmountChange,
  approveAmountProposal,
  rejectAmountProposal,
  getAmountLedger,
  exportDemandsExcel
};
