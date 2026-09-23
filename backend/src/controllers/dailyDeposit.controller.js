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

const DEPOSIT_CACHE_TTL_MS = 15 * 1000; // 15 seconds in-memory cache for fast polling
const depositsResponseCache = new Map();

const invalidateDepositCache = (outletName) => {
  if (!outletName || outletName === 'all') {
    depositsResponseCache.clear();
  } else {
    for (const key of depositsResponseCache.keys()) {
      if (key.startsWith(outletName)) {
        depositsResponseCache.delete(key);
      }
    }
  }
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
        const cashReturns = Math.max(0, Math.round(Number(s.returnSummary?.cash || 0) * 100) / 100);
        const faisalTake = Math.max(0, Math.round(Number(s.totalFaisalTake || 0) * 100) / 100);
        const availableCash = Math.max(0, Math.round((generatedCash - generalEntryReduction - cashReturns - faisalTake) * 100) / 100);
        return {
          generatedCash,
          generalEntryReduction,
          cashReturns,
          faisalTake,
          availableCash,
          journalEntries: s.journalEntries || [],
          isClosedSession: session.status === 'CLOSED',
          found: true,
        };
      }
    } catch (e) {}
  }

  // 2. Fallback to real-time POS sales cash query, returns, and journal entries
  const [sales, balancePayments, returns, journals] = await Promise.all([
    prisma.posSale.findMany({
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
    }),
    prisma.posBalancePayment.findMany({
      where: {
        posSale: { outletName },
        paidAt: { gte: start, lt: end },
      },
      select: {
        amountPaidNow: true,
        paymentMethod: true,
        cashAmount: true,
      },
    }),
    prisma.posReturn.findMany({
      where: {
        OR: [{ sale: { outletName } }, { outletName }],
        createdAt: { gte: start, lt: end },
      },
      select: {
        refundAmount: true,
        refundPaymentMethod: true,
        sale: { select: { paymentMethod: true, cashAmount: true, onlineAmount: true } },
      },
    }),
    prisma.journalEntry.findMany({
      where: {
        outletName,
        createdAt: { gte: start, lt: end },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

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

  const generatedCash = Math.max(0, Math.round(totalCash * 100) / 100);
  const generalEntryReduction = Math.max(0, Math.round(journals.reduce((sum, j) => sum + (j.amount || 0), 0) * 100) / 100);
  const cashReturns = Math.max(0, Math.round(cashRefunded * 100) / 100);
  const availableCash = Math.max(0, Math.round((generatedCash - generalEntryReduction - cashReturns) * 100) / 100);

  return {
    generatedCash,
    generalEntryReduction,
    cashReturns,
    faisalTake: 0,
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
/**
 * Synchronizes daily deposit requirements and running carry-forward ledger for an outlet from outletCutoff to targetDate.
 * Enforces:
 * 1. Outlet Register as single source of truth for base cash and general entry deductions.
 * 2. Running Ledger Carry-Forward:
 *    - Short / Pending balance carries forward as previous pending to next business day.
 *    - Excess balance carries forward as credit to reduce next business day's required deposit.
 * 3. Priority Rule for new deposits:
 *    Oldest Pending -> Current Day Requirement -> Excess Carry-Forward.
 */
const syncDailyRequirements = async (outletName, targetDate = getPktDateString(), options = {}) => {
  const { forceRequery = false } = options;
  const outletCutoff = getOutletCutoffDate(outletName);
  if (targetDate < outletCutoff) {
    targetDate = outletCutoff;
  }

  const dates = getDateRangeList(outletCutoff, targetDate);

  // 1. Fetch existing requirements and cash deposits in range
  const [existingReqs, allDeposits] = await Promise.all([
    prisma.dailyCashRequirement.findMany({
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

  const reqMap = new Map();
  for (const r of existingReqs) {
    reqMap.set(r.businessDate, r);
  }

  // Group deposits by their businessDate
  const depositsByDate = new Map();
  for (const d of allDeposits) {
    if (!depositsByDate.has(d.businessDate)) {
      depositsByDate.set(d.businessDate, []);
    }
    depositsByDate.get(d.businessDate).push(d);
  }

  // 2. Ensure all requirement rows exist in database
  const dayBaseData = [];
  for (const bDate of dates) {
    let req = reqMap.get(bDate);
    let regData;

    // Fast-path: if requirement row already exists for a past closed date,
    // its register figures (generatedCash, requiredAmount, generalEntryReduction) are frozen.
    // Reuse them directly to avoid slow sequential DB queries over remote network.
    if (!forceRequery && req && bDate < targetDate) {
      let journalEntries = [];
      let generalEntryReduction = Math.max(0, Math.round(((req.cashGenerated || 0) - (req.requiredAmount || 0)) * 100) / 100);
      if (req.notes) {
        try {
          const parsed = typeof req.notes === 'string' ? JSON.parse(req.notes) : req.notes;
          if (Array.isArray(parsed?.journalEntries)) journalEntries = parsed.journalEntries;
          if (typeof parsed?.generalEntryReduction === 'number') generalEntryReduction = parsed.generalEntryReduction;
        } catch (e) {}
      }

      regData = {
        generatedCash: req.cashGenerated,
        generalEntryReduction,
        cashReturns: 0,
        faisalTake: 0,
        availableCash: req.requiredAmount,
        journalEntries,
        isClosedSession: true,
        found: true,
      };
    } else {
      regData = await getAuthoritativeRegisterCash(outletName, bDate);
    }

    if (!req) {
      req = await prisma.dailyCashRequirement.create({
        data: {
          outletName,
          businessDate: bDate,
          cashGenerated: regData.generatedCash,
          previousPending: 0,
          requiredAmount: regData.availableCash,
          depositedAmount: 0,
          pendingAmount: regData.availableCash,
          excessAmount: 0,
          status: regData.availableCash > 0 ? 'PENDING' : 'CLEARED',
        },
      });
      reqMap.set(bDate, req);
    }

    dayBaseData.push({
      businessDate: bDate,
      reqId: req.id,
      regData,
    });
  }

  // 3. Chronological priority allocation & running ledger simulation
  const allocationsToCreate = [];
  const reqUpdates = [];

  // Track unresolved requirement needs from past dates: array of { reqId, date, needed }
  const unfulfilledReqQueue = [];
  let carriedExcess = 0;

  for (const day of dayBaseData) {
    const { businessDate: bDate, reqId, regData } = day;
    const baseRequired = regData.availableCash;
    const generatedCash = regData.generatedCash;
    const generalEntryReduction = regData.generalEntryReduction;
    const journalEntries = regData.journalEntries;

    const dayDeposits = depositsByDate.get(bDate) || [];
    const totalDayDeposit = Math.round(dayDeposits.reduce((sum, d) => sum + (d.amount || 0), 0) * 100) / 100;

    // A. Apply Previous Excess Credit (if any) to reduce current day requirement
    const prevExcess = carriedExcess;
    let excessConsumed = 0;
    let unconsumedExcess = 0;
    let effectiveDayReq = baseRequired;

    if (prevExcess > 0) {
      excessConsumed = Math.min(baseRequired, prevExcess);
      effectiveDayReq = Math.max(0, Math.round((baseRequired - prevExcess) * 100) / 100);
      unconsumedExcess = Math.max(0, Math.round((prevExcess - baseRequired) * 100) / 100);
    }

    // B. Calculate previous pending from unfulfilled requirements queue
    const prevPending = Math.round(unfulfilledReqQueue.reduce((sum, u) => sum + u.needed, 0) * 100) / 100;
    const netRequired = Math.round((effectiveDayReq + prevPending) * 100) / 100;

    // C. Allocate today's deposits according to Priority:
    //    1. Oldest Pending -> 2. Current Day Effective Requirement -> 3. New Excess
    let todaySatisfiedSoFar = 0;
    let todayExcessSoFar = 0;
    let totalAppliedToPrev = 0;

    for (const dep of dayDeposits) {
      let depLeft = dep.amount;

      // Priority 1: Clear older unfulfilled requirements
      while (depLeft > 0 && unfulfilledReqQueue.length > 0) {
        const oldest = unfulfilledReqQueue[0];
        const allocAmt = Math.min(depLeft, oldest.needed);
        if (allocAmt > 0) {
          allocationsToCreate.push({
            cashDepositId: dep.id,
            requirementId: oldest.reqId,
            businessDate: oldest.date,
            amount: Math.round(allocAmt * 100) / 100,
            allocationType: 'PREVIOUS_PENDING',
          });
          oldest.needed = Math.round((oldest.needed - allocAmt) * 100) / 100;
          depLeft = Math.round((depLeft - allocAmt) * 100) / 100;
          totalAppliedToPrev = Math.round((totalAppliedToPrev + allocAmt) * 100) / 100;
        }
        if (oldest.needed <= 0.001) {
          unfulfilledReqQueue.shift();
        }
      }

      // Priority 2: Clear current day's effective requirement
      const neededForToday = Math.max(0, Math.round((effectiveDayReq - todaySatisfiedSoFar) * 100) / 100);
      if (depLeft > 0 && neededForToday > 0) {
        const allocAmt = Math.min(depLeft, neededForToday);
        allocationsToCreate.push({
          cashDepositId: dep.id,
          requirementId: reqId,
          businessDate: bDate,
          amount: Math.round(allocAmt * 100) / 100,
          allocationType: 'CURRENT_DAY',
        });
        todaySatisfiedSoFar = Math.round((todaySatisfiedSoFar + allocAmt) * 100) / 100;
        depLeft = Math.round((depLeft - allocAmt) * 100) / 100;
      }

      // Priority 3: Excess
      if (depLeft > 0) {
        allocationsToCreate.push({
          cashDepositId: dep.id,
          requirementId: reqId,
          businessDate: bDate,
          amount: Math.round(depLeft * 100) / 100,
          allocationType: 'EXCESS',
        });
        todayExcessSoFar = Math.round((todayExcessSoFar + depLeft) * 100) / 100;
        depLeft = 0;
      }
    }

    // D. Check leftover needed for today's requirement
    const todayLeftover = Math.max(0, Math.round((effectiveDayReq - todaySatisfiedSoFar) * 100) / 100);
    if (todayLeftover > 0) {
      unfulfilledReqQueue.push({ reqId, date: bDate, needed: todayLeftover });
    }

    // E. Running totals and carry-forward to next day
    const appliedToCurrent = todaySatisfiedSoFar;
    const newExcess = Math.round((todayExcessSoFar + unconsumedExcess) * 100) / 100;
    carriedExcess = newExcess;

    const notesObj = {
      generalEntryReduction,
      journalEntries,
      previousPending: prevPending,
      previousExcess: prevExcess,
      consumedCredit: excessConsumed,
      netRequired,
      appliedToPrev: totalAppliedToPrev,
      appliedToCurrent,
      newExcess,
    };

    reqUpdates.push({
      id: reqId,
      businessDate: bDate,
      cashGenerated: generatedCash,
      requiredAmount: baseRequired,
      previousPending: prevPending,
      depositedAmount: totalDayDeposit,
      excessAmount: newExcess,
      notesObj,
    });
  }

  // F. Final pass: Map unfulfilled amounts to each requirement's remaining pendingAmount
  const unfulfilledMap = new Map();
  for (const u of unfulfilledReqQueue) {
    unfulfilledMap.set(u.reqId, u.needed);
  }

  let hasChanges = false;
  const existingTotalAllocations = existingReqs.reduce((sum, r) => sum + (r.allocations?.length || 0), 0);
  if (allocationsToCreate.length !== existingTotalAllocations) {
    hasChanges = true;
  }

  const dbUpdateOps = [];

  for (const ru of reqUpdates) {
    const remainingPending = Math.round((unfulfilledMap.get(ru.id) || 0) * 100) / 100;
    const newExcess = ru.excessAmount;
    const baseReq = ru.requiredAmount;
    const depAmt = ru.depositedAmount;
    const prevExcess = ru.notesObj.previousExcess;
    const netReq = ru.notesObj.netRequired;

    let status = 'PENDING';
    if (newExcess > 0) {
      status = 'EXCESS';
    } else if (remainingPending === 0) {
      if (baseReq > 0 && depAmt === 0 && prevExcess >= baseReq) {
        status = 'CLEARED_BY_CARRY_FORWARD';
      } else if (depAmt > 0 || baseReq === 0) {
        status = 'DEPOSITED';
      } else {
        status = 'CLEARED';
      }
    } else if (depAmt > 0 && remainingPending > 0) {
      status = 'PARTIALLY_DEPOSITED';
    } else if (baseReq === 0 && netReq === 0) {
      status = 'CLEARED';
    } else {
      status = 'PENDING';
    }

    ru.notesObj.remainingPending = remainingPending;
    ru.notesObj.status = status;
    const notesStr = JSON.stringify(ru.notesObj);

    const existing = reqMap.get(ru.businessDate);
    if (!existing ||
        existing.cashGenerated !== ru.cashGenerated ||
        existing.requiredAmount !== ru.requiredAmount ||
        existing.previousPending !== ru.previousPending ||
        existing.depositedAmount !== ru.depositedAmount ||
        existing.pendingAmount !== remainingPending ||
        existing.excessAmount !== newExcess ||
        existing.status !== status ||
        existing.notes !== notesStr) {
      hasChanges = true;
    }

    dbUpdateOps.push(
      prisma.dailyCashRequirement.update({
        where: { id: ru.id },
        data: {
          cashGenerated: ru.cashGenerated,
          requiredAmount: ru.requiredAmount,
          previousPending: ru.previousPending,
          depositedAmount: ru.depositedAmount,
          pendingAmount: remainingPending,
          excessAmount: newExcess,
          status,
          notes: notesStr,
        },
      })
    );
  }

  let finalRequirements;
  if (hasChanges) {
    // G. Execute database updates & allocations atomically in a transaction
    await prisma.$transaction([
      prisma.cashDepositAllocation.deleteMany({
        where: {
          requirement: { outletName },
          businessDate: { gte: outletCutoff },
        },
      }),
      ...(allocationsToCreate.length > 0
        ? [prisma.cashDepositAllocation.createMany({ data: allocationsToCreate })]
        : []),
      ...dbUpdateOps,
    ]);

    // H. Return fresh requirements with allocations
    finalRequirements = await prisma.dailyCashRequirement.findMany({
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
      orderBy: { businessDate: 'desc' },
    });
  } else {
    finalRequirements = [...existingReqs].sort((a, b) => b.businessDate.localeCompare(a.businessDate));
  }

  finalRequirements.deposits = allDeposits;
  return finalRequirements;
};

/**
 * GET /api/daily-deposits/:outletName
 */
const getDailyDeposits = async (req, res) => {
  try {
    const outletName = req.params?.outletName || req.query?.outletName || req.query?.outlet;
    const { range, dateFrom, dateTo } = req.query || {};
    const cacheKey = `${outletName}:${range || ''}:${dateFrom || ''}:${dateTo || ''}`;

    const cached = depositsResponseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < DEPOSIT_CACHE_TTL_MS)) {
      return res.json(cached.payload);
    }

    const todayPkt = getPktDateString();
    const outletCutoff = getOutletCutoffDate(outletName);

    // Ensure state and running carry-forward ledger are synchronized up to today
    const requirementsResult = await syncDailyRequirements(outletName, todayPkt);
    const allDeposits = requirementsResult.deposits || (await prisma.cashDeposit.findMany({
      where: {
        outletName,
        businessDate: { gte: outletCutoff },
      },
      include: {
        allocations: true,
      },
      orderBy: { actualDepositDate: 'desc' },
    }));

    let queryStartStr = outletCutoff;
    let queryEndStr = todayPkt;

    if (dateFrom) queryStartStr = dateFrom.slice(0, 10);
    if (dateTo) queryEndStr = dateTo.slice(0, 10);

    // Enforce cutoff: never display pre-cutoff as pending
    if (queryStartStr < outletCutoff && range !== 'all') {
      queryStartStr = outletCutoff;
    }

    // Filter in-memory from sync results (zero extra redundant DB queries!)
    const requirements = requirementsResult.filter(
      r => r.businessDate >= queryStartStr && r.businessDate <= queryEndStr
    );

    const deposits = allDeposits.filter(
      d => d.businessDate >= queryStartStr && d.businessDate <= queryEndStr
    );

    // Today's specific requirement
    const todayReq = requirementsResult.find(r => r.businessDate === todayPkt) || null;

    // Latest deposit made in the active cycle
    const lastDeposit = allDeposits.length > 0
      ? [...allDeposits].sort((a, b) => new Date(b.actualDepositDate) - new Date(a.actualDepositDate))[0]
      : null;

    // All active pending across all dates >= outletCutoff
    const allPendingReqs = requirementsResult.filter(r => r.pendingAmount > 0);
    const totalPendingAllTime = allPendingReqs.reduce((sum, r) => sum + r.pendingAmount, 0);

    // Previous pending: sum of active pending for dates prior to today
    const pastPendingReqs = requirementsResult.filter(r => r.businessDate < todayPkt && r.pendingAmount > 0);
    const previousPending = pastPendingReqs.reduce((sum, r) => sum + r.pendingAmount, 0);

    let todayReduction = 0;
    let todayPrevPending = 0;
    let todayPrevExcess = 0;
    let todayNetRequired = todayReq ? todayReq.requiredAmount : 0;
    let todayConsumedCredit = 0;

    if (todayReq?.notes) {
      try {
        const p = JSON.parse(todayReq.notes);
        if (typeof p?.generalEntryReduction === 'number') todayReduction = p.generalEntryReduction;
        if (typeof p?.previousPending === 'number') todayPrevPending = p.previousPending;
        if (typeof p?.previousExcess === 'number') todayPrevExcess = p.previousExcess;
        if (typeof p?.consumedCredit === 'number') todayConsumedCredit = p.consumedCredit;
        if (typeof p?.netRequired === 'number') todayNetRequired = p.netRequired;
      } catch (e) {}
    }
    if (!todayReduction && todayReq && todayReq.cashGenerated > todayReq.requiredAmount) {
      todayReduction = Math.max(0, Math.round((todayReq.cashGenerated - todayReq.requiredAmount) * 100) / 100);
    }

    const summary = {
      todayCashGenerated: todayReq ? todayReq.cashGenerated : 0,
      todayGeneralEntryReduction: todayReduction,
      todayAvailableCash: todayReq ? todayReq.requiredAmount : 0,
      todayBaseRequired: todayReq ? todayReq.requiredAmount : 0,
      todayPreviousPending: todayPrevPending,
      todayPreviousExcess: todayPrevExcess,
      todayConsumedCredit: todayConsumedCredit,
      todayNetRequired: todayNetRequired,
      todayRequiredDeposit: todayNetRequired,
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
      let previousPending = r.previousPending || 0;
      let previousExcess = 0;
      let consumedCredit = 0;
      let netRequired = r.requiredAmount;
      let appliedToPrev = 0;
      let appliedToCurrent = r.depositedAmount;

      if (r.notes) {
        try {
          const parsed = JSON.parse(r.notes);
          if (typeof parsed?.generalEntryReduction === 'number') {
            generalEntryReduction = parsed.generalEntryReduction;
          }
          if (Array.isArray(parsed?.journalEntries)) {
            journalEntries = parsed.journalEntries;
          }
          if (typeof parsed?.previousPending === 'number') {
            previousPending = parsed.previousPending;
          }
          if (typeof parsed?.previousExcess === 'number') {
            previousExcess = parsed.previousExcess;
          }
          if (typeof parsed?.consumedCredit === 'number') {
            consumedCredit = parsed.consumedCredit;
          }
          if (typeof parsed?.netRequired === 'number') {
            netRequired = parsed.netRequired;
          }
          if (typeof parsed?.appliedToPrev === 'number') {
            appliedToPrev = parsed.appliedToPrev;
          }
          if (typeof parsed?.appliedToCurrent === 'number') {
            appliedToCurrent = parsed.appliedToCurrent;
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
        baseRequired: r.requiredAmount,
        availableCash: r.requiredAmount,
        previousPending,
        previousExcess,
        consumedCredit,
        netRequired,
        appliedToPrev,
        appliedToCurrent,
        remainingAmount: r.pendingAmount,
      };
    });

    const payload = {
      outletName,
      cutoffDate: outletCutoff,
      todayDate: todayPkt,
      summary,
      requirements: enhancedRequirements,
      deposits,
    };

    depositsResponseCache.set(cacheKey, { payload, timestamp: Date.now() });
    res.json(payload);
  } catch (error) {
    console.error('getDailyDeposits error:', error);
    res.status(500).json({ message: 'Failed to fetch daily deposits', error: error.message });
  }
};

/**
 * POST /api/daily-deposits/:outletName
 * Records a cash deposit and reconciles it through the chronological carry-forward ledger.
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

    // 1. Create CashDeposit and BankDeposit records in transaction
    const cashDeposit = await prisma.$transaction(async (tx) => {
      const cd = await tx.cashDeposit.create({
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

      await tx.bankDeposit.create({
        data: {
          outletName,
          employeeName: employeeName || req.user?.name || 'Authorized Staff',
          slipNumber: cd.referenceNumber,
          amount: depositAmount,
          notes: notes || `Daily deposit for ${effectiveBusinessDate}`,
          status: 'COMPLETED',
          createdBy: req.user?.name || employeeName || 'System',
          createdAt: effectiveActualDate,
        },
      });

      return cd;
    });

    // 2. Reconcile running carry-forward ledger and build priority allocations
    await syncDailyRequirements(outletName, todayPkt);
    invalidateDepositCache(outletName);

    // 3. Fetch newly generated allocations for this deposit
    const allocations = await prisma.cashDepositAllocation.findMany({
      where: { cashDepositId: cashDeposit.id },
      include: { requirement: true },
    });

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
      deposit: cashDeposit,
      allocations,
    });
  } catch (error) {
    console.error('submitDailyDeposit error:', error);
    res.status(500).json({ message: 'Failed to record daily deposit', error: error.message });
  }
};

/**
 * Re-allocates all cash deposits and rebuilds the running carry-forward ledger.
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
      const updatedReqs = await syncDailyRequirements(outletName, todayPkt, { forceRequery: true });
      results[outletName] = updatedReqs.length;
    }

    invalidateDepositCache(targetOutlet);

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


