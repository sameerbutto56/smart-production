/**
 * posFinancialSummary.js
 * 
 * Standardized single source of truth for the simplified 4-tier POS Financial Summary:
 *  1. Sales Summary: Gross Sales, Discount, Net Revenue
 *  2. Payment Breakdown: Cash, Online, Card
 *  3. Deductions / Adjustments: Cash Returns, Online Returns, Card Returns, General Entries
 *  4. Final Position: Available Cash, Available Online, Available Card
 * 
 * Core Calculation Rules:
 *  - Net Revenue = Gross Sales − Discount = Cash + Online + Card
 *  - Discount is NOT treated as a cash withdrawal or deduction; it only affects sales/revenue
 *  - Returns MUST deduct from the same payment method as the original transaction
 *  - General Entries are deducted exclusively from Cash
 *  - Available Cash = Cash − Cash Returns − General Entries
 *  - Available Online = Online − Online Returns
 *  - Available Card = Card − Card Returns
 *  - Bank deposits are NOT deducted from Available Cash or Dashboard Cash
 */

export const computePosFinancialSummary = ({
  sales = [],
  returns = [],
  balancePayments = [],
  journalEntries = [],
  backendSummary = null,
  isFiltered = false,
}) => {
  // If backendSummary is present AND not filtered by client search/filters, use backend's authoritative aggregates
  if (backendSummary && !isFiltered) {
    const grossSales = Math.round(backendSummary.grossSales ?? (backendSummary.salesReceived + (backendSummary.totalDiscount || 0)));
    const discount = Math.round(backendSummary.totalDiscount ?? backendSummary.discountTotal ?? 0);
    const netRevenue = Math.max(0, grossSales - discount);

    const ps = backendSummary.paymentSummary || {};
    const pt = backendSummary.paymentTotals || {};
    const cash = Math.round(ps.cash ?? pt.CASH ?? backendSummary.cash ?? 0);
    const online = Math.round(ps.online ?? pt.ONLINE ?? backendSummary.online ?? 0);
    const card = Math.round(ps.card ?? pt.CARD ?? backendSummary.card ?? 0);

    const rs = backendSummary.returnSummary || {};
    const cashReturns = Math.round(rs.cash ?? 0);
    const onlineReturns = Math.round(rs.online ?? 0);
    const cardReturns = Math.round(rs.card ?? 0);
    const totalReturns = Math.round(backendSummary.totalReturns ?? backendSummary.refundAmount ?? (cashReturns + onlineReturns + cardReturns));

    const generalEntries = Math.round(backendSummary.cashJournalExpenses ?? backendSummary.totalJournalExpenses ?? journalEntries.reduce((s, j) => s + (j.amount || 0), 0));

    const availableCash = Math.round(cash - cashReturns - generalEntries);
    const availableOnline = Math.round(online - onlineReturns);
    const availableCard = Math.round(card - cardReturns);

    return {
      salesSummary: {
        grossSales,
        discount,
        netRevenue,
      },
      paymentBreakdown: {
        cash,
        online,
        card,
        total: cash + online + card,
      },
      deductions: {
        cashReturns,
        onlineReturns,
        cardReturns,
        totalReturns,
        generalEntries,
      },
      finalPosition: {
        availableCash,
        availableOnline,
        availableCard,
      },
      invoiceCount: backendSummary.invoiceCount ?? sales.length,
    };
  }

  // Client-side computation from active transaction arrays (for filtered views, search, etc.)
  let cash = 0;
  let online = 0;
  let card = 0;
  let discount = 0;

  sales.forEach((s) => {
    discount += (s.discountAmount || s.discount || 0);
    const received = s._amountReceived != null
      ? s._amountReceived
      : (s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : (s.grandTotal || 0));

    if (s.paymentMethod === 'CASH_ONLINE') {
      const c = s.cashAmount || 0;
      const o = s.onlineAmount || 0;
      const declared = c + o;
      if (declared > 0 && Math.abs(declared - received) > 0.5) {
        const ratio = received / declared;
        const scaledCash = Math.round(c * ratio);
        cash += scaledCash;
        online += (received - scaledCash);
      } else if (declared === 0) {
        const half = Math.round(received / 2);
        cash += half;
        online += (received - half);
      } else {
        cash += c;
        online += o;
      }
    } else if (s.paymentMethod === 'CARD') {
      card += received;
    } else if (s.paymentMethod === 'ONLINE') {
      online += received;
    } else {
      cash += received;
    }
  });

  // Balance clearances
  balancePayments.forEach((bp) => {
    const amt = bp.amountPaidNow || 0;
    if (bp.paymentMethod === 'CASH_ONLINE') {
      const c = bp.cashAmount !== null && bp.cashAmount !== undefined ? bp.cashAmount : Math.round(amt / 2);
      const o = bp.onlineAmount !== null && bp.onlineAmount !== undefined ? bp.onlineAmount : (amt - c);
      cash += c;
      online += o;
    } else if (bp.paymentMethod === 'CARD') {
      card += amt;
    } else if (bp.paymentMethod === 'ONLINE') {
      online += amt;
    } else {
      cash += amt;
    }
  });

  // Returns / Refunds by original payment method
  let cashReturns = 0;
  let onlineReturns = 0;
  let cardReturns = 0;

  returns.forEach((r) => {
    const amt = r.refundAmount || 0;
    const method = r.sale?.paymentMethod || r.refundPaymentMethod || 'CASH';
    if (method === 'CASH_ONLINE') {
      const c = r.sale?.cashAmount || 0;
      const o = r.sale?.onlineAmount || 0;
      const tot = c + o || 1;
      const ratio = c / tot;
      cashReturns += Math.round(amt * ratio);
      onlineReturns += (amt - Math.round(amt * ratio));
    } else if (method === 'CARD') {
      cardReturns += amt;
    } else if (method === 'ONLINE') {
      onlineReturns += amt;
    } else {
      cashReturns += amt;
    }
  });

  // General Entries
  const generalEntries = journalEntries.reduce((sum, j) => sum + (j.amount || 0), 0);

  cash = Math.round(cash);
  online = Math.round(online);
  card = Math.round(card);
  discount = Math.round(discount);
  cashReturns = Math.round(cashReturns);
  onlineReturns = Math.round(onlineReturns);
  cardReturns = Math.round(cardReturns);

  const netRevenue = cash + online + card;
  const grossSales = netRevenue + discount;
  const totalReturns = cashReturns + onlineReturns + cardReturns;

  const availableCash = Math.round(cash - cashReturns - generalEntries);
  const availableOnline = Math.round(online - onlineReturns);
  const availableCard = Math.round(card - cardReturns);

  return {
    salesSummary: {
      grossSales,
      discount,
      netRevenue,
    },
    paymentBreakdown: {
      cash,
      online,
      card,
      total: netRevenue,
    },
    deductions: {
      cashReturns,
      onlineReturns,
      cardReturns,
      totalReturns,
      generalEntries,
    },
    finalPosition: {
      availableCash,
      availableOnline,
      availableCard,
    },
    invoiceCount: sales.length,
  };
};
