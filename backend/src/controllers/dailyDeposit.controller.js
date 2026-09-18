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
 * Recomputes cash generated in a vectorized batch, carries forward pending amounts FIFO, and assigns exact statuses.
 */
const syncDailyRequirements = async (outletName, targetDate = getPktDateString()) => {
  if (targetDate < CUTOFF_DATE) {
    targetDate = CUTOFF_DATE;
  }

  const dates = getDateRangeList(CUTOFF_DATE, targetDate);
  const intervalStart = getPktDayBounds(CUTOFF_DATE).start;
  const intervalEnd = getPktDayBounds(targetDate).end;

  // 1. Parallel fetch for all days in the interval in a single round-trip
  const [sales, balancePayments, returns, journalEntries, existingReqs] = await Promise.all([
    // Sales cash
    prisma.posSale.findMany({
      where: {
        outletName,
        createdAt: { gte: intervalStart, lt: intervalEnd },
        faisalTake: false,
      },
      select: {
        id: true,
        grandTotal: true,
        advanceAmount: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
        createdAt: true,
      },
    }),
    // Balance payments cash
    prisma.posBalancePayment.findMany({
      where: {
        posSale: { outletName },
        paidAt: { gte: intervalStart, lt: intervalEnd },
      },
      select: {
        id: true,
        amountPaidNow: true,
        paymentMethod: true,
        cashAmount: true,
        onlineAmount: true,
        paidAt: true,
      },
    }),
    // Returns cash
    prisma.posReturn.findMany({
      where: {
        OR: [
          { sale: { outletName } },
          { outletName },
        ],
        createdAt: { gte: intervalStart, lt: intervalEnd },
      },
      select: {
        id: true,
        refundAmount: true,
        refundPaymentMethod: true,
        createdAt: true,
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
        createdAt: { gte: intervalStart, lt: intervalEnd },
      },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        createdAt: true,
      },
    }),
    // Existing requirements with allocations
    prisma.dailyCashRequirement.findMany({
      where: {
        outletName,
        businessDate: { gte: CUTOFF_DATE, lte: targetDate },
      },
      include: {
        allocations: true,
      },
    }),
  ]);

  // Group by PKT date in-memory
  const salesByDate = {};
  for (const s of sales) {
    const d = getPktDateString(s.createdAt);
    if (!salesByDate[d]) salesByDate[d] = [];
    salesByDate[d].push(s);
  }

  const balanceByDate = {};
  for (const bp of balancePayments) {
    const d = getPktDateString(bp.paidAt);
    if (!balanceByDate[d]) balanceByDate[d] = [];
    balanceByDate[d].push(bp);
  }

  const returnsByDate = {};
  for (const r of returns) {
    const d = getPktDateString(r.createdAt);
    if (!returnsByDate[d]) returnsByDate[d] = [];
    returnsByDate[d].push(r);
  }

  const journalsByDate = {};
  for (const j of journalEntries) {
    const d = getPktDateString(j.createdAt);
    if (!journalsByDate[d]) journalsByDate[d] = [];
    journalsByDate[d].push(j);
  }

  const reqMap = new Map();
  for (const r of existingReqs) {
    reqMap.set(r.businessDate, r);
  }

  let carryForwardPending = 0;
  const toCreate = [];
  const toUpdate = [];
  const syncedResults = [];

  for (const bDate of dates) {
    // 1. Sales cash collected
    const salesForDate = salesByDate[bDate] || [];
    let salesCash = 0;
    for (const s of salesForDate) {
      const received = s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;
      if (s.paymentMethod === 'CASH') {
        salesCash += received;
      } else if (s.paymentMethod === 'CASH_ONLINE') {
        const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
        const ratio = totalCO > 0 ? (s.cashAmount || 0) / totalCO : 1;
        salesCash += received * ratio;
      }
    }

    // 2. Balance payments cash collected
    const balanceForDate = balanceByDate[bDate] || [];
    let balanceCash = 0;
    for (const bp of balanceForDate) {
      const amt = bp.amountPaidNow || 0;
      if (bp.paymentMethod === 'CASH' || !bp.paymentMethod) {
        balanceCash += amt;
      } else if (bp.paymentMethod === 'CASH_ONLINE') {
        const cashPortion = bp.cashAmount !== null && bp.cashAmount !== undefined
          ? bp.cashAmount
          : (amt / 2);
        balanceCash += cashPortion;
      }
    }

    // 3. Cash refunds
    const returnsForDate = returnsByDate[bDate] || [];
    let cashRefunded = 0;
    for (const r of returnsForDate) {
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
    }

    // 4. Cash journal expenses
    const journalsForDate = journalsByDate[bDate] || [];
    const cashExpenses = journalsForDate
      .filter(j => !j.paymentMethod || String(j.paymentMethod).toUpperCase() === 'CASH')
      .reduce((sum, j) => sum + (j.amount || 0), 0);

    // Net cash generated to deposit
    const netCash = Math.max(0, Math.round((salesCash + balanceCash - cashRefunded - cashExpenses) * 100) / 100);

    // 2. Previous pending carried forward
    const previousPending = carryForwardPending;
    const requiredAmount = Math.round((netCash + previousPending) * 100) / 100;

    // 3. Existing requirement
    const req = reqMap.get(bDate);
    const totalAllocated = (req?.allocations || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const depositedAmount = Math.round(totalAllocated * 100) / 100;
    const pendingAmount = Math.max(0, Math.round((requiredAmount - depositedAmount) * 100) / 100);
    const excessAmount = Math.max(0, Math.round((depositedAmount - requiredAmount) * 100) / 100);

    // 4. Determine exact status
    let status = 'PENDING';
    if (excessAmount > 0) {
      status = 'EXCESS';
    } else if (pendingAmount === 0 && (depositedAmount > 0 || requiredAmount === 0)) {
      const hasLaterAllocation = (req?.allocations || []).some(a => a.businessDate > bDate);
      status = hasLaterAllocation ? 'CLEARED_BY_CARRY_FORWARD' : 'DEPOSITED';
    } else if (depositedAmount > 0 && pendingAmount > 0) {
      status = 'PARTIALLY_DEPOSITED';
    } else {
      status = 'PENDING';
    }

    if (!req) {
      toCreate.push({
        outletName,
        businessDate: bDate,
        cashGenerated: netCash,
        previousPending,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
      });
      syncedResults.push({
        outletName,
        businessDate: bDate,
        cashGenerated: netCash,
        previousPending,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
        allocations: [],
      });
    } else {
      const isDifferent =
        req.cashGenerated !== netCash ||
        req.previousPending !== previousPending ||
        req.requiredAmount !== requiredAmount ||
        req.depositedAmount !== depositedAmount ||
        req.pendingAmount !== pendingAmount ||
        req.excessAmount !== excessAmount ||
        req.status !== status;

      if (isDifferent) {
        toUpdate.push({
          id: req.id,
          data: {
            cashGenerated: netCash,
            previousPending,
            requiredAmount,
            depositedAmount,
            pendingAmount,
            excessAmount,
            status,
          },
        });
      }

      syncedResults.push({
        ...req,
        cashGenerated: netCash,
        previousPending,
        requiredAmount,
        depositedAmount,
        pendingAmount,
        excessAmount,
        status,
      });
    }

    carryForwardPending = pendingAmount;
  }

  // 5. Batch database writes
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
      for (const reqItem of allRequirements) {
        if (remainingToAllocate <= 0) break;

        const stillPending = reqItem.pendingAmount;
        if (stillPending > 0) {
          const allocAmount = Math.min(stillPending, remainingToAllocate);
          const isPrevious = reqItem.businessDate < effectiveBusinessDate;
          const allocationType = isPrevious ? 'PREVIOUS_PENDING' : 'CURRENT_DAY';

          const alloc = await tx.cashDepositAllocation.create({
            data: {
              cashDepositId: cashDeposit.id,
              requirementId: reqItem.id,
              businessDate: reqItem.businessDate,
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

/**
 * Re-allocates all cash deposits chronologically from CUTOFF_DATE onward for an outlet or all outlets.
 */
const rebuildOutletDepositState = async (req, res) => {
  try {
    const targetOutlet = req?.body?.outletName || req?.params?.outletName || req?.query?.outlet;
    const outletsToRebuild = targetOutlet && targetOutlet !== 'all'
      ? [targetOutlet]
      : ['Johar Town', 'Jail Road', 'Abbottabad', 'Hyderabad', 'Hotel'];

    const todayPkt = getPktDateString();
    const results = {};

    for (const outletName of outletsToRebuild) {
      await prisma.$transaction(async (tx) => {
        // 1. Delete all deposit allocations for this outlet
        await tx.cashDepositAllocation.deleteMany({
          where: { cashDeposit: { outletName } },
        });

        // 2. Reset all requirements from CUTOFF_DATE onward
        await tx.dailyCashRequirement.deleteMany({
          where: { outletName, businessDate: { gte: CUTOFF_DATE } },
        });
      });

      // 3. Re-create requirements
      await syncDailyRequirements(outletName, todayPkt);

      // 4. Fetch all deposits chronologically
      const allDeposits = await prisma.cashDeposit.findMany({
        where: {
          outletName,
          businessDate: { gte: CUTOFF_DATE },
        },
        orderBy: [
          { businessDate: 'asc' },
          { actualDepositDate: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // 5. Re-allocate each deposit FIFO
      for (const deposit of allDeposits) {
        const depositAmount = deposit.amount;
        const effectiveBusinessDate = deposit.businessDate;

        // Ensure requirement chain up to deposit date
        await syncDailyRequirements(outletName, effectiveBusinessDate);

        // Fetch requirements up to deposit date
        const requirements = await prisma.dailyCashRequirement.findMany({
          where: {
            outletName,
            businessDate: { gte: CUTOFF_DATE, lte: effectiveBusinessDate },
          },
          orderBy: { businessDate: 'asc' },
        });

        let remainingToAllocate = depositAmount;

        for (const r of requirements) {
          if (remainingToAllocate <= 0) break;
          const pending = r.pendingAmount;
          if (pending > 0) {
            const allocAmt = Math.min(pending, remainingToAllocate);
            const isPrevious = r.businessDate < effectiveBusinessDate;
            const allocationType = isPrevious ? 'PREVIOUS_PENDING' : 'CURRENT_DAY';

            await prisma.cashDepositAllocation.create({
              data: {
                cashDepositId: deposit.id,
                requirementId: r.id,
                businessDate: r.businessDate,
                amount: Math.round(allocAmt * 100) / 100,
                allocationType,
              },
            });

            remainingToAllocate = Math.round((remainingToAllocate - allocAmt) * 100) / 100;
            r.pendingAmount = Math.max(0, Math.round((r.pendingAmount - allocAmt) * 100) / 100);
          }
        }

        if (remainingToAllocate > 0) {
          let currentDayReq = requirements.find(r => r.businessDate === effectiveBusinessDate);
          if (!currentDayReq && requirements.length > 0) {
            currentDayReq = requirements[requirements.length - 1];
          }
          if (currentDayReq) {
            await prisma.cashDepositAllocation.create({
              data: {
                cashDepositId: deposit.id,
                requirementId: currentDayReq.id,
                businessDate: currentDayReq.businessDate,
                amount: remainingToAllocate,
                allocationType: 'EXCESS',
              },
            });
          }
        }
      }

      // 6. Final sync to set authoritative totals and statuses
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
  CUTOFF_DATE,
  calculateAuthoritativeDailyCash,
  syncDailyRequirements,
  getDailyDeposits,
  submitDailyDeposit,
  rebuildOutletDepositState,
};

