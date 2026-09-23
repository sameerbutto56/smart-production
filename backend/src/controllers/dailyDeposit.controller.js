const prisma = require('../prisma');
const notify = require('../utils/notify');

const DEFAULT_CUTOFF_DATE = '2026-09-15'; // Default baseline: all cash prior to this is treated as cleared/deposited
const CUTOFF_DATE = DEFAULT_CUTOFF_DATE; // Preserved for backward compatibility

// Specific outlet cutoff dates:
// Jail Road: New deposit cycle starts 21 September 2026 (All transactions on or before 20 September 2026 are cleared)
const OUTLET_CUTOFF_DATES = {
  'Jail Road': '2026-09-21',
};

const getOutletCutoffDate = (outletName) => {
  return OUTLET_CUTOFF_DATES[outletName] || DEFAULT_CUTOFF_DATE;
};

const PK_OFFSET = 5 * 60 * 60 * 1000;

/**
 * Returns current date string 'YYYY-MM-DD' in Pakistan timezone (UTC+5).
 */
const getPktDateString = (date = new Date()) => {
  const pktMs = (date instanceof Date ? date.getTime() : new Date(date).getTime()) + PK_OFFSET;
  const d = new Date(pktMs);
  return d.toISOString().slice(0, 10);
};

/**
 * Converts 'YYYY-MM-DD' to strict half-open UTC interval [start, end)
 */
const getPktDayBounds = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, d) - PK_OFFSET;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startMs), end: new Date(endMs) };
};

/**
 * Calculates authoritative net cash generated for an outlet on a specific business date.
 * Gross cash (sales cash + balance clearance cash) minus cash returns minus journal expenses.
 */
const calculateAuthoritativeDailyCash = async (outletName, businessDate) => {
  const { start, end } = getPktDayBounds(businessDate);

  const [sales, balancePayments, returns, journalEntries] = await Promise.all([
    // Sales cash
    prisma.posSale.findMany({
      where: {
        outletName,
        createdAt: { gte: start, lt: end },
        faisalTake: false,
      },
      select: {
        id: true,
        grandTotal: true,
        advanceAmount: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
      },
    }),
    // Balance payments cash
    prisma.posBalancePayment.findMany({
      where: {
        posSale: { outletName },
        paidAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        amountPaidNow: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
      },
    }),
    // Returns cash
    prisma.posReturn.findMany({
      where: {
        OR: [
          { sale: { outletName } },
          { outletName },
        ],
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        refundAmount: true,
        refundPaymentMethod: true,
        sale: {
          select: {
            paymentMethod: true,
            cashAmount: true,
            onlineAmount: true,
          },
        },
      },
    }),
    // Journal expenses paid in cash
    prisma.journalEntry.findMany({
      where: {
        outletName,
        createdAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
      },
    }),
  ]);

  // 1. Sales cash collected
  let salesCash = 0;
  sales.forEach((s) => {
    const received = s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;
    if (s.paymentMethod === 'CASH') {
      salesCash += received;
    } else if (s.paymentMethod === 'CASH_ONLINE') {
      const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
      const ratio = totalCO > 0 ? (s.cashAmount || 0) / totalCO : 1;
      salesCash += received * ratio;
    }
  });

  // 2. Balance payments cash collected
  let balanceCash = 0;
  balancePayments.forEach((bp) => {
    const amt = bp.amountPaidNow || 0;
    if (bp.paymentMethod === 'CASH' || !bp.paymentMethod) {
      balanceCash += amt;
    } else if (bp.paymentMethod === 'CASH_ONLINE') {
      const cashPortion = bp.cashAmount !== null && bp.cashAmount !== undefined
        ? bp.cashAmount
        : (amt / 2);
      balanceCash += cashPortion;
    }
  });

  // 3. Cash refunds
  let cashRefunded = 0;
  returns.forEach((r) => {
    const refundMethod = r.refundPaymentMethod || r.sale?.paymentMethod || 'CASH';
    const amt = r.refundAmount || 0;
    if (refundMethod === 'CASH') {
      cashRefunded += amt;
    } else if (refundMethod === 'CASH_ONLINE') {
      const cashAmt = r.sale?.cashAmount || 0;
      const onlineAmt = r.sale?.onlineAmount || 0;
      const total = cashAmt + onlineAmt || 1;
      const ratio = cashAmt / total;
      cashRefunded += amt * ratio;
    }
  });

  // 4. Cash journal expenses (only filter CASH or null paymentMethod)
  const cashExpenses = journalEntries
    .filter(j => !j.paymentMethod || String(j.paymentMethod).toUpperCase() === 'CASH')
    .reduce((sum, j) => sum + (j.amount || 0), 0);

  // Net cash generated to deposit
  const netCash = Math.max(0, Math.round((salesCash + balanceCash - cashRefunded - cashExpenses) * 100) / 100);

  return {
    netCash,
    breakdown: {
      salesCash: Math.round(salesCash * 100) / 100,
      balanceCash: Math.round(balanceCash * 100) / 100,
      cashRefunded: Math.round(cashRefunded * 100) / 100,
      cashExpenses: Math.round(cashExpenses * 100) / 100,
    },
  };
};

/**
 * Fetches authoritative register cash amount directly from Closed Register (PosBookSession)
 * for a specific outlet and business date.
 * If no closed register session exists (e.g. in-progress current day),
 * falls back to real-time POS cash collected.
 */
const getAuthoritativeRegisterCash = async (outletName, businessDate) => {
  const { start, end } = getPktDayBounds(businessDate);

  // 1. Check for PosBookSession for this business date
  const session = await prisma.posBookSession.findFirst({
    where: {
      outletName,
      openedAt: { gte: start, lt: end },
    },
    orderBy: { openedAt: 'desc' },
  });

  if (session && session.summary) {
    try {
      const s = typeof session.summary === 'string' ? JSON.parse(session.summary) : session.summary;
      const rawCash = s.paymentSummary?.cashCollected ?? s.paymentSummary?.cash;
      if (rawCash !== undefined && rawCash !== null) {
        const generatedCash = Math.max(0, Math.round(Number(rawCash) * 100) / 100);
        const generalEntryReduction = Math.max(0, Math.round(Number(s.totalJournalEntries || 0) * 100) / 100);
        const availableCash = Math.max(0, Math.round((generatedCash - generalEntryReduction) * 100) / 100);
        return {
          generatedCash,
          generalEntryReduction,
          availableCash,
          journalEntries: s.journalEntries || [],
          isClosedSession: session.status === 'CLOSED',
          found: true,
        };
      }
    } catch (e) {}
  }

  // 2. Fallback to real-time POS sales cash query and journal entries
  const sales = await prisma.posSale.findMany({
    where: {
      outletName,
      createdAt: { gte: start, lt: end },
      faisalTake: false,
    },
    select: {
      grandTotal: true,
      advanceAmount: true,
      paymentMethod: true,
      cashAmount: true,
      onlineAmount: true,
    },
  });

  let totalCash = 0;
  sales.forEach((s) => {
    const received = s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;
    if (s.paymentMethod === 'CASH') {
      totalCash += received;
    } else if (s.paymentMethod === 'CASH_ONLINE') {
      const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
      const ratio = totalCO > 0 ? (s.cashAmount || 0) / totalCO : 1;
      totalCash += received * ratio;
    }
  });

  const balancePayments = await prisma.posBalancePayment.findMany({
    where: {
      posSale: { outletName },
      paidAt: { gte: start, lt: end },
    },
    select: {
      amountPaidNow: true,
      paymentMethod: true,
      cashAmount: true,
    },
  });

  balancePayments.forEach((bp) => {
    const amt = bp.amountPaidNow || 0;
    if (bp.paymentMethod === 'CASH' || !bp.paymentMethod) {
      totalCash += amt;
    } else if (bp.paymentMethod === 'CASH_ONLINE') {
      const cashPortion = bp.cashAmount !== null && bp.cashAmount !== undefined
        ? bp.cashAmount
        : (amt / 2);
      totalCash += cashPortion;
    }
  });

  const journals = await prisma.journalEntry.findMany({
    where: {
      outletName,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: 'asc' },
  });

  const generatedCash = Math.max(0, Math.round(totalCash * 100) / 100);
  const generalEntryReduction = Math.max(0, Math.round(journals.reduce((sum, j) => sum + (j.amount || 0), 0) * 100) / 100);
  const availableCash = Math.max(0, Math.round((generatedCash - generalEntryReduction) * 100) / 100);

  return {
    generatedCash,
    generalEntryReduction,
    availableCash,
    journalEntries: journals,
    isClosedSession: false,
    found: false,
  };
};

/**
 * Generates an array of date strings 'YYYY-MM-DD' from startDate to endDate inclusive.
 */
const getDateRangeList = (startDateStr, endDateStr) => {
  const dates = [];
  let curr = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
};

/**
 * Synchronizes daily deposit requirements for an outlet from outletCutoff to targetDate.
 * Enforces Outlet Register as the single source of truth for base cash and date-specific 1:1 allocations.
 */
const syncDailyRequirements = async (outletName, targetDate = getPktDateString()) => {
  const outletCutoff = getOutletCutoffDate(outletName);
  if (targetDate < outletCutoff) {
    targetDate = outletCutoff;
  }

  const dates = getDateRangeList(outletCutoff, targetDate);

  // Fetch all existing requirements with allocations in range
  const existingReqs = await prisma.dailyCashRequirement.findMany({
    where: {
      outletName,
      businessDate: { gte: outletCutoff, lte: targetDate },
    },
    include: {
      allocations: {
        include: {
          cashDeposit: true,
        },
      },
    },
  });

  const reqMap = new Map();
  for (const r of existingReqs) {
    reqMap.set(r.businessDate, r);
  }

  const toCreate = [];
  const toUpdate = [];
  const syncedResults = [];

  for (const bDate of dates) {
    // 1. Authoritative Register Cash & General Entry Reduction
    const regData = await getAuthoritativeRegisterCash(outletName, bDate);
    const req = reqMap.get(bDate);

    // 2. Base required deposit equals Available Cash = Generated Cash - General Entry Reductions
    const cashGenerated = regData.generatedCash;
    const generalEntryReduction = regData.generalEntryReduction;
    const requiredAmount = regData.availableCash;
    const notes = generalEntryReduction > 0
      ? JSON.stringify({ generalEntryReduction, journalEntries: regData.journalEntries })
      : null;

    // 3. Deposited amount equals sum of all deposit allocations credited to this business date
    const allocations = req?.allocations || [];
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
    const depositedAmount = Math.round(totalAllocated * 100) / 100;

    // 4. Calculate exact remaining and excess
    const pendingAmount = Math.max(0, Math.round((requiredAmount - depositedAmount) * 100) / 100);
    const excessAmount = Math.max(0, Math.round((depositedAmount - requiredAmount) * 100) / 100);

    // 5. Determine exact status
    let status = 'PENDING';
    if (depositedAmount >= requiredAmount && (requiredAmount > 0 || depositedAmount > 0)) {
      status = depositedAmount > requiredAmount ? 'EXCESS' : 'DEPOSITED';
    } else if (depositedAmount > 0 && pendingAmount > 0) {
      status = 'PARTIALLY_DEPOSITED';
    } else if (requiredAmount === 0 && depositedAmount === 0) {
      status = 'CLEARED';
    } else {
      status = 'PENDING';
    }

    if (!req) {
      toCreate.push({
        outletName,
        businessDate: bDate,
        cashGenerated,
        previousPending: 0,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
        notes,
      });
      syncedResults.push({
        outletName,
        businessDate: bDate,
        cashGenerated,
        previousPending: 0,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
        notes,
        allocations: [],
      });
    } else {
      const isDifferent =
        req.cashGenerated !== cashGenerated ||
        req.previousPending !== 0 ||
        req.requiredAmount !== requiredAmount ||
        req.depositedAmount !== depositedAmount ||
        req.pendingAmount !== pendingAmount ||
        req.excessAmount !== excessAmount ||
        req.status !== status ||
        req.notes !== notes;

      if (isDifferent) {
        toUpdate.push({
          id: req.id,
          data: {
            cashGenerated,
            previousPending: 0,
            requiredAmount,
            depositedAmount,
            pendingAmount,
            excessAmount,
            status,
            notes,
          },
        });
      }

      syncedResults.push({
        ...req,
        cashGenerated,
        previousPending: 0,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
        notes,
      });
    }
  }

  // Batch database writes
  const ops = [];
  for (const c of toCreate) {
    ops.push(prisma.dailyCashRequirement.create({ data: c, include: { allocations: true } }));
  }
  for (const u of toUpdate) {
    ops.push(prisma.dailyCashRequirement.update({ where: { id: u.id }, data: u.data, include: { allocations: true } }));
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  return syncedResults;
};

/**
 * GET /api/daily-deposits/:outletName
 */
const getDailyDeposits = async (req, res) => {
  try {
    const outletName = req.params?.outletName || req.query?.outletName || req.query?.outlet;
    const todayPkt = getPktDateString();
    const outletCutoff = getOutletCutoffDate(outletName);

    // Ensure state is synchronized up to today
    await syncDailyRequirements(outletName, todayPkt);

    // Date range filter
    const { range, dateFrom, dateTo } = req.query || {};
    let queryStartStr = outletCutoff;
    let queryEndStr = todayPkt;

    if (dateFrom) queryStartStr = dateFrom.slice(0, 10);
    if (dateTo) queryEndStr = dateTo.slice(0, 10);

    // Enforce cutoff: never display pre-cutoff as pending
    if (queryStartStr < outletCutoff && range !== 'all') {
      queryStartStr = outletCutoff;
    }

    // Fetch requirements
    const requirements = await prisma.dailyCashRequirement.findMany({
      where: {
        outletName,
        businessDate: {
          gte: queryStartStr,
          lte: queryEndStr,
        },
      },
      include: {
        allocations: {
          include: {
            cashDeposit: true,
          },
        },
      },
      orderBy: { businessDate: 'desc' },
    });

    // Fetch deposits
    const deposits = await prisma.cashDeposit.findMany({
      where: {
        outletName,
        businessDate: {
          gte: queryStartStr,
          lte: queryEndStr,
        },
      },
      include: {
        allocations: true,
      },
      orderBy: { actualDepositDate: 'desc' },
    });

    // Today's specific requirement
    const todayReq = await prisma.dailyCashRequirement.findUnique({
      where: {
        outletName_businessDate: { outletName, businessDate: todayPkt },
      },
      include: {
        allocations: true,
      },
    });

    // Latest deposit made in the active cycle
    const lastDeposit = await prisma.cashDeposit.findFirst({
      where: {
        outletName,
        businessDate: { gte: outletCutoff },
      },
      orderBy: { actualDepositDate: 'desc' },
    });

    // All active pending across all dates >= outletCutoff
    const allPendingReqs = await prisma.dailyCashRequirement.findMany({
      where: {
        outletName,
        businessDate: { gte: outletCutoff },
        pendingAmount: { gt: 0 },
      },
    });
    const totalPendingAllTime = allPendingReqs.reduce((sum, r) => sum + r.pendingAmount, 0);

    // Previous pending: sum of active pending for dates prior to today
    const pastPendingReqs = await prisma.dailyCashRequirement.findMany({
      where: {
        outletName,
        businessDate: { gte: outletCutoff, lt: todayPkt },
        pendingAmount: { gt: 0 },
      },
    });
    const previousPending = pastPendingReqs.reduce((sum, r) => sum + r.pendingAmount, 0);

    let todayReduction = 0;
    if (todayReq?.notes) {
      try {
        const p = JSON.parse(todayReq.notes);
        if (typeof p?.generalEntryReduction === 'number') todayReduction = p.generalEntryReduction;
      } catch (e) {}
    }
    if (!todayReduction && todayReq && todayReq.cashGenerated > todayReq.requiredAmount) {
      todayReduction = Math.max(0, Math.round((todayReq.cashGenerated - todayReq.requiredAmount) * 100) / 100);
    }

    const summary = {
      todayCashGenerated: todayReq ? todayReq.cashGenerated : 0,
      todayGeneralEntryReduction: todayReduction,
      todayAvailableCash: todayReq ? todayReq.requiredAmount : 0,
      todayRequiredDeposit: todayReq ? todayReq.requiredAmount : 0,
      todayDeposited: todayReq ? todayReq.depositedAmount : 0,
      todayPending: todayReq ? todayReq.pendingAmount : 0,
      previousPending: Math.round(previousPending * 100) / 100,
      excessDeposit: todayReq ? todayReq.excessAmount : 0,
      depositStatus: todayReq ? todayReq.status : 'PENDING',
      totalPendingAllTime: Math.round(totalPendingAllTime * 100) / 100,
      lastDeposit: lastDeposit
        ? {
            id: lastDeposit.id,
            amount: lastDeposit.amount,
            referenceNumber: lastDeposit.referenceNumber,
            actualDepositDate: lastDeposit.actualDepositDate,
            createdByName: lastDeposit.createdByName,
            notes: lastDeposit.notes,
          }
        : null,
    };

    const enhancedRequirements = requirements.map(r => {
      let generalEntryReduction = 0;
      let journalEntries = [];
      if (r.notes) {
        try {
          const parsed = JSON.parse(r.notes);
          if (typeof parsed?.generalEntryReduction === 'number') {
            generalEntryReduction = parsed.generalEntryReduction;
          }
          if (Array.isArray(parsed?.journalEntries)) {
            journalEntries = parsed.journalEntries;
          }
        } catch (e) {}
      }
      if (!generalEntryReduction && r.cashGenerated > r.requiredAmount) {
        generalEntryReduction = Math.max(0, Math.round((r.cashGenerated - r.requiredAmount) * 100) / 100);
      }

      return {
        ...r,
        generatedCash: r.cashGenerated,
        registerCash: r.cashGenerated,
        generalEntryReduction,
        journalEntries,
        availableCash: r.requiredAmount,
        remainingAmount: r.pendingAmount,
      };
    });

    res.json({
      outletName,
      cutoffDate: outletCutoff,
      todayDate: todayPkt,
      summary,
      requirements: enhancedRequirements,
      deposits,
    });
  } catch (error) {
    console.error('getDailyDeposits error:', error);
    res.status(500).json({ message: 'Failed to fetch daily deposits', error: error.message });
  }
};

/**
 * POST /api/daily-deposits/:outletName
 * Records a cash deposit and allocates it directly to the specified businessDate requirement.
 */
const submitDailyDeposit = async (req, res) => {
  try {
    const { outletName } = req.params;
    const {
      amount,
      actualDepositDate,
      businessDate: reqBusinessDate,
      referenceNumber,
      bankName,
      notes,
      employeeName,
    } = req.body;

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ message: 'Deposit amount must be greater than 0' });
    }

    const todayPkt = getPktDateString();
    const effectiveBusinessDate = reqBusinessDate || todayPkt;
    const effectiveActualDate = actualDepositDate ? new Date(actualDepositDate) : new Date();

    // 1. Ensure requirements are synchronized up to today
    await syncDailyRequirements(outletName, todayPkt);

    // 2. Perform deposit and 1:1 date allocation inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create CashDeposit record
      const cashDeposit = await tx.cashDeposit.create({
        data: {
          outletName,
          businessDate: effectiveBusinessDate,
          actualDepositDate: effectiveActualDate,
          amount: depositAmount,
          bankName: bankName || null,
          referenceNumber: referenceNumber ? referenceNumber.trim() : `DEP-${Date.now().toString().slice(-6)}`,
          notes: notes || null,
          createdById: req.user?.id || null,
          createdByName: employeeName || req.user?.name || 'Authorized Staff',
        },
      });

      // Also create a BankDeposit for backward compatibility and till cash synchronization
      await tx.bankDeposit.create({
        data: {
          outletName,
          employeeName: employeeName || req.user?.name || 'Authorized Staff',
          slipNumber: cashDeposit.referenceNumber,
          amount: depositAmount,
          notes: notes || `Daily deposit for ${effectiveBusinessDate}`,
          status: 'COMPLETED',
          createdBy: req.user?.name || employeeName || 'System',
          createdAt: effectiveActualDate,
        },
      });

      // Fetch or ensure requirement for effectiveBusinessDate
      let targetReq = await tx.dailyCashRequirement.findUnique({
        where: {
          outletName_businessDate: { outletName, businessDate: effectiveBusinessDate },
        },
        include: { allocations: true },
      });

      if (!targetReq) {
        const regData = await getAuthoritativeRegisterCash(outletName, effectiveBusinessDate);
        targetReq = await tx.dailyCashRequirement.create({
          data: {
            outletName,
            businessDate: effectiveBusinessDate,
            cashGenerated: regData.generatedCash,
            requiredAmount: regData.availableCash,
            pendingAmount: regData.availableCash,
            status: regData.availableCash > 0 ? 'PENDING' : 'CLEARED',
            notes: regData.generalEntryReduction > 0
              ? JSON.stringify({ generalEntryReduction: regData.generalEntryReduction, journalEntries: regData.journalEntries })
              : null,
          },
          include: { allocations: true },
        });
      }

      const existingDeposited = (targetReq.allocations || []).reduce((s, a) => s + (a.amount || 0), 0);
      const neededToClear = Math.max(0, targetReq.requiredAmount - existingDeposited);
      const allocToCurrent = Math.min(neededToClear, depositAmount);
      const excess = Math.max(0, depositAmount - allocToCurrent);

      const allocationsToCreate = [];
      if (allocToCurrent > 0) {
        allocationsToCreate.push({
          cashDepositId: cashDeposit.id,
          requirementId: targetReq.id,
          businessDate: effectiveBusinessDate,
          amount: Math.round(allocToCurrent * 100) / 100,
          allocationType: 'CURRENT_DAY',
        });
      }

      if (excess > 0) {
        allocationsToCreate.push({
          cashDepositId: cashDeposit.id,
          requirementId: targetReq.id,
          businessDate: effectiveBusinessDate,
          amount: Math.round(excess * 100) / 100,
          allocationType: 'EXCESS',
        });
      }

      if (allocationsToCreate.length > 0) {
        await tx.cashDepositAllocation.createMany({
          data: allocationsToCreate,
        });
      }

      return { cashDeposit, allocations: allocationsToCreate };
    });

    // 3. Re-sync all requirements to update exact pendingAmount, depositedAmount, and statuses
    await syncDailyRequirements(outletName, todayPkt);

    // Notify administrators
    await notify.create(req, {
      type: 'bank_deposit',
      moduleName: 'Daily Cash Deposit',
      path: '/admin',
      role: 'ADMIN',
      title: 'Daily Cash Deposit Recorded',
      message: `₨${depositAmount.toLocaleString()} deposited for ${outletName} (Date: ${effectiveBusinessDate})`,
      action: 'Deposit Recorded',
      employeeName: req.user?.name || employeeName,
    }).catch(() => {});

    res.status(201).json({
      message: 'Daily cash deposit recorded successfully',
      deposit: result.cashDeposit,
      allocations: result.allocations,
    });
  } catch (error) {
    console.error('submitDailyDeposit error:', error);
    res.status(500).json({ message: 'Failed to record daily deposit', error: error.message });
  }
};

/**
 * Re-allocates all cash deposits directly to their business date requirements.
 * Strictly respects branch isolation: only rebuilds the requested outlet.
 */
const rebuildOutletDepositState = async (req, res) => {
  try {
    const targetOutlet = typeof req === 'string'
      ? req
      : (req?.body?.outletName || req?.params?.outletName || req?.query?.outlet);
    const outletsToRebuild = targetOutlet && targetOutlet !== 'all'
      ? [targetOutlet]
      : ['Johar Town', 'Jail Road'];

    const todayPkt = getPktDateString();
    const results = {};

    for (const outletName of outletsToRebuild) {
      const outletCutoff = getOutletCutoffDate(outletName);

      // 1. Wipe existing allocations and requirements from outletCutoff in one transaction
      await prisma.$transaction([
        prisma.cashDepositAllocation.deleteMany({
          where: { cashDeposit: { outletName }, businessDate: { gte: outletCutoff } },
        }),
        prisma.dailyCashRequirement.deleteMany({
          where: { outletName, businessDate: { gte: outletCutoff } },
        }),
      ]);

      // 2. Compute initial requirements with 0 allocations
      await syncDailyRequirements(outletName, todayPkt);

      // 3. Fetch all base requirements and deposits for this outlet
      const [allRequirements, allDeposits] = await Promise.all([
        prisma.dailyCashRequirement.findMany({
          where: {
            outletName,
            businessDate: { gte: outletCutoff, lte: todayPkt },
          },
          orderBy: { businessDate: 'asc' },
        }),
        prisma.cashDeposit.findMany({
          where: {
            outletName,
            businessDate: { gte: outletCutoff },
          },
          orderBy: [
            { businessDate: 'asc' },
            { actualDepositDate: 'asc' },
            { createdAt: 'asc' },
          ],
        }),
      ]);

      // 4. Map deposits 1:1 to their business date requirements
      const reqMap = new Map();
      allRequirements.forEach(r => reqMap.set(r.businessDate, { ...r, depositedSum: 0 }));

      const allocationsToCreate = [];

      for (const deposit of allDeposits) {
        const r = reqMap.get(deposit.businessDate);
        if (r) {
          const needed = Math.max(0, r.requiredAmount - r.depositedSum);
          const allocAmt = Math.min(needed, deposit.amount);
          const excessAmt = Math.max(0, deposit.amount - allocAmt);

          if (allocAmt > 0) {
            allocationsToCreate.push({
              cashDepositId: deposit.id,
              requirementId: r.id,
              businessDate: r.businessDate,
              amount: Math.round(allocAmt * 100) / 100,
              allocationType: 'CURRENT_DAY',
            });
            r.depositedSum += allocAmt;
          }
          if (excessAmt > 0) {
            allocationsToCreate.push({
              cashDepositId: deposit.id,
              requirementId: r.id,
              businessDate: r.businessDate,
              amount: Math.round(excessAmt * 100) / 100,
              allocationType: 'EXCESS',
            });
            r.depositedSum += excessAmt;
          }
        }
      }

      // 5. Batch insert all allocations in a single database call
      if (allocationsToCreate.length > 0) {
        await prisma.cashDepositAllocation.createMany({
          data: allocationsToCreate,
        });
      }

      // 6. Final fast sync to update exact pendingAmount, depositedAmount, and statuses
      const updatedReqs = await syncDailyRequirements(outletName, todayPkt);
      results[outletName] = updatedReqs.length;
    }

    if (res) {
      res.json({ message: 'Outlet deposit state rebuilt successfully', results });
    } else {
      return results;
    }
  } catch (error) {
    console.error('rebuildOutletDepositState error:', error);
    if (res) {
      res.status(500).json({ message: 'Failed to rebuild deposit state', error: error.message });
    } else {
      throw error;
    }
  }
};

module.exports = {
  DEFAULT_CUTOFF_DATE,
  CUTOFF_DATE,
  OUTLET_CUTOFF_DATES,
  getOutletCutoffDate,
  getAuthoritativeRegisterCash,
  calculateAuthoritativeDailyCash,
  syncDailyRequirements,
  getDailyDeposits,
  submitDailyDeposit,
  rebuildOutletDepositState,
};


