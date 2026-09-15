const prisma = require('../prisma');
const notify = require('../utils/notify');

const CUTOFF_DATE = '2026-09-15'; // All cash prior to this is treated as cleared/deposited
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

  // 4. Cash journal expenses
  const cashExpenses = journalEntries.reduce((sum, j) => sum + (j.amount || 0), 0);

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
 * Synchronizes the daily deposit requirement chain for an outlet from CUTOFF_DATE to targetDate.
 * Recomputes cash generated, carries forward pending amounts FIFO, and assigns exact statuses.
 */
const syncDailyRequirements = async (outletName, targetDate = getPktDateString()) => {
  if (targetDate < CUTOFF_DATE) {
    targetDate = CUTOFF_DATE;
  }

  const dates = getDateRangeList(CUTOFF_DATE, targetDate);
  let carryForwardPending = 0;
  const syncedRequirements = [];

  for (const bDate of dates) {
    // 1. Authoritative cash generated
    const { netCash } = await calculateAuthoritativeDailyCash(outletName, bDate);

    // 2. Previous pending carried forward
    const previousPending = carryForwardPending;
    const requiredAmount = Math.round((netCash + previousPending) * 100) / 100;

    // 3. Find or create requirement record
    let req = await prisma.dailyCashRequirement.findUnique({
      where: {
        outletName_businessDate: { outletName, businessDate: bDate },
      },
      include: {
        allocations: true,
      },
    });

    if (!req) {
      req = await prisma.dailyCashRequirement.create({
        data: {
          outletName,
          businessDate: bDate,
          cashGenerated: netCash,
          previousPending,
          requiredAmount,
          depositedAmount: 0,
          pendingAmount: requiredAmount,
          excessAmount: 0,
          status: requiredAmount > 0 ? 'PENDING' : 'DEPOSITED',
        },
        include: {
          allocations: true,
        },
      });
    }

    // 4. Sum up allocations
    const totalAllocated = (req.allocations || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const depositedAmount = Math.round(totalAllocated * 100) / 100;
    const pendingAmount = Math.max(0, Math.round((requiredAmount - depositedAmount) * 100) / 100);
    const excessAmount = Math.max(0, Math.round((depositedAmount - requiredAmount) * 100) / 100);

    // 5. Determine exact status
    let status = 'PENDING';
    if (excessAmount > 0) {
      status = 'EXCESS';
    } else if (pendingAmount === 0 && (depositedAmount > 0 || requiredAmount === 0)) {
      const hasLaterAllocation = (req.allocations || []).some(a => a.businessDate > bDate);
      status = hasLaterAllocation ? 'CLEARED_BY_CARRY_FORWARD' : 'DEPOSITED';
    } else if (depositedAmount > 0 && pendingAmount > 0) {
      status = 'PARTIALLY_DEPOSITED';
    } else {
      status = 'PENDING';
    }

    // Update if changed
    req = await prisma.dailyCashRequirement.update({
      where: { id: req.id },
      data: {
        cashGenerated: netCash,
        previousPending,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
      },
      include: {
        allocations: true,
      },
    });

    syncedRequirements.push(req);
    carryForwardPending = pendingAmount;
  }

  return syncedRequirements;
};

/**
 * GET /api/daily-deposits/:outletName
 */
const getDailyDeposits = async (req, res) => {
  try {
    const { outletName } = req.params;
    const todayPkt = getPktDateString();

    // Ensure state is synchronized up to today
    await syncDailyRequirements(outletName, todayPkt);

    // Date range filter
    const { range, dateFrom, dateTo } = req.query;
    let queryStartStr = CUTOFF_DATE;
    let queryEndStr = todayPkt;

    if (dateFrom) queryStartStr = dateFrom.slice(0, 10);
    if (dateTo) queryEndStr = dateTo.slice(0, 10);

    // Enforce cutoff: never display pre-cutoff as pending
    if (queryStartStr < CUTOFF_DATE && range !== 'all') {
      queryStartStr = CUTOFF_DATE;
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

    // Latest deposit made
    const lastDeposit = await prisma.cashDeposit.findFirst({
      where: { outletName },
      orderBy: { actualDepositDate: 'desc' },
    });

    // All active pending across all dates >= CUTOFF_DATE
    const allPendingReqs = await prisma.dailyCashRequirement.findMany({
      where: {
        outletName,
        businessDate: { gte: CUTOFF_DATE },
        pendingAmount: { gt: 0 },
      },
    });
    const totalPendingAllTime = allPendingReqs.reduce((sum, r) => sum + r.pendingAmount, 0);

    const summary = {
      todayCashGenerated: todayReq ? todayReq.cashGenerated : 0,
      todayRequiredDeposit: todayReq ? todayReq.requiredAmount : 0,
      todayDeposited: todayReq ? todayReq.depositedAmount : 0,
      todayPending: todayReq ? todayReq.pendingAmount : 0,
      previousPending: todayReq ? todayReq.previousPending : 0,
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

    res.json({
      outletName,
      cutoffDate: CUTOFF_DATE,
      todayDate: todayPkt,
      summary,
      requirements,
      deposits,
    });
  } catch (error) {
    console.error('getDailyDeposits error:', error);
    res.status(500).json({ message: 'Failed to fetch daily deposits', error: error.message });
  }
};

/**
 * POST /api/daily-deposits/:outletName
 * Records a cash deposit and allocates it FIFO against oldest pending requirements first.
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

    // 1. First ensure requirement chain is synchronized up to effectiveBusinessDate
    await syncDailyRequirements(outletName, effectiveBusinessDate);

    // 2. Perform deposit and FIFO allocation inside a transaction
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

      // Fetch all requirements chronologically from CUTOFF_DATE to effectiveBusinessDate
      const allRequirements = await tx.dailyCashRequirement.findMany({
        where: {
          outletName,
          businessDate: {
            gte: CUTOFF_DATE,
            lte: effectiveBusinessDate,
          },
        },
        orderBy: { businessDate: 'asc' },
      });

      let remainingToAllocate = depositAmount;
      const createdAllocations = [];

      // FIFO allocation: clear oldest pending first
      for (const req of allRequirements) {
        if (remainingToAllocate <= 0) break;

        const stillPending = req.pendingAmount;
        if (stillPending > 0) {
          const allocAmount = Math.min(stillPending, remainingToAllocate);
          const isPrevious = req.businessDate < effectiveBusinessDate;
          const allocationType = isPrevious ? 'PREVIOUS_PENDING' : 'CURRENT_DAY';

          const alloc = await tx.cashDepositAllocation.create({
            data: {
              cashDepositId: cashDeposit.id,
              requirementId: req.id,
              businessDate: req.businessDate,
              amount: Math.round(allocAmount * 100) / 100,
              allocationType,
            },
          });

          createdAllocations.push(alloc);
          remainingToAllocate = Math.round((remainingToAllocate - allocAmount) * 100) / 100;
        }
      }

      // If any amount is still left over after all pending requirements up to today are cleared -> EXCESS
      if (remainingToAllocate > 0) {
        // Find today's requirement (or latest in the window)
        let currentDayReq = allRequirements.find(r => r.businessDate === effectiveBusinessDate);
        if (!currentDayReq && allRequirements.length > 0) {
          currentDayReq = allRequirements[allRequirements.length - 1];
        }

        if (currentDayReq) {
          const excessAlloc = await tx.cashDepositAllocation.create({
            data: {
              cashDepositId: cashDeposit.id,
              requirementId: currentDayReq.id,
              businessDate: currentDayReq.businessDate,
              amount: remainingToAllocate,
              allocationType: 'EXCESS',
            },
          });
          createdAllocations.push(excessAlloc);
        }
      }

      return { cashDeposit, allocations: createdAllocations };
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

module.exports = {
  CUTOFF_DATE,
  calculateAuthoritativeDailyCash,
  syncDailyRequirements,
  getDailyDeposits,
  submitDailyDeposit,
};
