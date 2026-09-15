import * as XLSX from 'xlsx';
import { formatDateTime, formatDateOnly } from './dateTime';
import { toUrduName } from './urduDictionary';

const fmt = (n) => typeof n === 'number' ? Math.round(n) : '';

/**
 * Resolves split payment amounts for sales invoices exactly as in Outlet POS History.
 */
const resolvePaymentAmounts = (s) => {
  const received = s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : (s.grandTotal || 0);
  let cash = 0, online = 0, card = 0;
  if (s.paymentMethod === 'CASH_ONLINE') {
    const totalCO = (s.cashAmount || 0) + (s.onlineAmount || 0);
    if (totalCO <= 0) {
      cash = Math.round(received / 2);
      online = received - cash;
    } else {
      const ratio = received / totalCO;
      cash = Math.round((s.cashAmount || 0) * ratio);
      online = received - cash;
    }
  } else if (s.paymentMethod === 'CARD') {
    card = received;
  } else if (s.paymentMethod === 'ONLINE') {
    online = received;
  } else {
    cash = received;
  }
  return { cash, online, card };
};

const fmtPayment = (s) => {
  if (s.paymentMethod === 'CASH_ONLINE') {
    const c = s.cashAmount !== null && s.cashAmount !== undefined ? s.cashAmount : '';
    const o = s.onlineAmount !== null && s.onlineAmount !== undefined ? s.onlineAmount : '';
    return `CASH+ONLINE (C:${c}, O:${o})`;
  }
  return s.paymentMethod || 'CASH';
};

/**
 * Exports Invoices according to the EXACT POS History Excel structure:
 *  - Sales rows with full payment breakdown
 *  - Return / Refund rows (negative amounts, items, reason, method)
 *  - Balance Clearance rows (actual payment method used, cash/card/online amounts)
 *  - General Entries / Expense rows
 *  - Authoritative financial Summary block at the bottom
 */
export const exportInvoicesToExcel = ({
  sales = [],
  returns = [],
  balancePayments = [],
  journalEntries = [],
  summary = {},
  paymentSummary = {},
  outlet = 'Outlet',
  rangeLabel = 'All',
  isUrdu = false,
}) => {
  // 1. Per-invoice data rows
  const saleRows = sales.map((s) => {
    const pay = resolvePaymentAmounts(s);
    const balancePaid = (s.balancePayments || []).reduce((a, p) => a + (p.amountPaidNow || 0), 0);
    const received = s.advanceAmount > 0
      ? Math.min(s.advanceAmount, s.grandTotal) + balancePaid
      : (s.grandTotal || 0);
    const remaining = Math.max(0, (s.grandTotal || 0) - received);

    return {
      'Receipt #': s.receiptNumber || '',
      'Date': formatDateTime(s.createdAt),
      'Cashier': s.cashierName || '',
      'Customer': s.customerName || '',
      'Phone': s.customerPhone || '',
      'Items': (s.items || []).map(i => `${i.productName}${i.color ? ' (' + (isUrdu ? toUrduName(i.color) : i.color) + ')' : ''}${i.size ? ' ' + i.size : ''} x${i.quantity}`).join(', '),
      'Subtotal': s.subtotal || 0,
      'Discount': s.discountAmount || 0,
      'Card Charges': s.cardChargesAmount || 0,
      'Invoice Total': s.grandTotal || 0,
      'Amount Received': received,
      'Payment Method': fmtPayment(s),
      'Cash Amount': pay.cash,
      'Card Amount': pay.card,
      'Online Amount': pay.online,
      'Advance': s.advanceAmount || 0,
      'Balance Remaining': remaining,
      'Status': s.refundedAt ? 'RETURN' : (remaining > 0.01 ? 'BALANCE' : 'PAID'),
    };
  });

  // 2. Return rows
  const returnRows = returns.map((r) => ({
    'Receipt #': r.receiptNumber || (r.sale ? `RET-${r.sale.receiptNumber}` : 'RETURN'),
    'Date': formatDateTime(r.createdAt),
    'Cashier': r.processedBy || r.cashierName || r.sale?.cashierName || '',
    'Customer': r.customerName || r.sale?.customerName || '',
    'Phone': r.sale?.customerPhone || '',
    'Items': (r.sale?.items || []).map(i => `${i.productName} x${i.quantity}`).join(', '),
    'Subtotal': 0,
    'Discount': 0,
    'Card Charges': 0,
    'Invoice Total': -(r.refundAmount || 0),
    'Amount Received': -(r.refundAmount || 0),
    'Payment Method': r.refundPaymentMethod || r.sale?.paymentMethod || 'CASH',
    'Cash Amount': '',
    'Card Amount': '',
    'Online Amount': '',
    'Advance': 0,
    'Balance Remaining': 0,
    'Status': 'RETURN / REFUND',
  }));

  // 3. Balance Clearance rows
  const balanceRows = balancePayments.map((bp) => {
    let bpCash = 0, bpCard = 0, bpOnline = 0;
    const amt = bp.amountPaidNow || 0;
    if (bp.paymentMethod === 'CASH_ONLINE') {
      bpCash = bp.cashAmount ?? Math.round(amt / 2);
      bpOnline = bp.onlineAmount ?? (amt - bpCash);
    } else if (bp.paymentMethod === 'CARD') {
      bpCard = amt;
    } else if (bp.paymentMethod === 'ONLINE') {
      bpOnline = amt;
    } else {
      bpCash = amt;
    }
    return {
      'Receipt #': bp.receiptNumber || `BP-${bp.id?.slice(0, 8)}`,
      'Date': formatDateTime(bp.paidAt),
      'Cashier': bp.cashierName || '',
      'Customer': bp.posSale?.customerName || '',
      'Phone': '',
      'Items': `Balance clearance for ${bp.originalInvoiceNumber || ''}`,
      'Subtotal': 0,
      'Discount': 0,
      'Card Charges': 0,
      'Invoice Total': amt,
      'Amount Received': amt,
      'Payment Method': fmtPayment(bp),
      'Cash Amount': bpCash,
      'Card Amount': bpCard,
      'Online Amount': bpOnline,
      'Advance': 0,
      'Balance Remaining': bp.outstandingBalanceAfterPayment || 0,
      'Status': 'BALANCE CLEARANCE',
    };
  });

  // 4. General Entries (Expenses)
  const emptyPayCols = { 'Cash Amount': '', 'Card Amount': '', 'Online Amount': '' };
  const journalDataRows = journalEntries.map((ge) => ({
    'Receipt #': 'GENERAL ENTRY',
    'Date': formatDateTime(ge.createdAt),
    'Cashier': ge.employeeName || '',
    'Customer': ge.expenseTitle || ge.title || '',
    'Phone': '',
    'Items': ge.notes || '',
    'Subtotal': '',
    'Discount': '',
    'Card Charges': '',
    'Invoice Total': '',
    'Amount Received': -(ge.amount || 0),
    'Payment Method': 'EXPENSE',
    ...emptyPayCols,
    'Advance': '',
    'Balance Remaining': '',
    'Status': 'GENERAL',
  }));

  // 5. Authoritative Summary Section
  const S = (label, value) => ({ 'Receipt #': label, 'Amount Received': typeof value === 'number' ? Math.round(value) : (value || '') });
  const grossSales = summary.grossSales ?? summary.totalSales ?? 0;
  const discountTotal = summary.totalDiscount ?? summary.discountTotal ?? 0;
  const totalReceived = summary.totalReceived ?? 0;
  const returnedAmount = summary.totalReturns ?? summary.refundAmount ?? 0;
  const netSales = summary.netSales ?? Math.max(0, grossSales - discountTotal - returnedAmount);
  const netRevenue = summary.netRevenue ?? 0;
  const totalGeneralEntries = summary.totalJournalExpenses ?? journalEntries.reduce((s, j) => s + (j.amount || 0), 0);

  const cashGross = paymentSummary.CASH?.gross ?? paymentSummary.cash ?? 0;
  const cardGross = paymentSummary.CARD?.gross ?? paymentSummary.card ?? 0;
  const onlineGross = paymentSummary.ONLINE?.gross ?? paymentSummary.online ?? 0;

  const summaryRows = [
    {}, {},
    S('═══════════════════════════════', ''),
    S('S U M M A R Y', ''),
    S('═══════════════════════════════', ''),
    {},
    S('Invoice Count', sales.length),
    S('Gross Sales (before discounts)', grossSales),
    S('Discounts', discountTotal),
    S('Sales Received (after discounts)', summary.salesReceived ?? (totalReceived - (summary.totalBalanceCollections || 0))),
    S('Balance Collections', summary.totalBalanceCollections ?? 0),
    S('Total Received (Sales + Balance)', totalReceived),
    {},
    S('─── Payment Breakdown (Sales + Balance Collections) ───', ''),
    S('Cash — Gross', cashGross),
    S('Card — Gross', cardGross),
    S('Online — Gross', onlineGross),
    {},
    S('─── Returns / Refunds ───', ''),
    S('Total Returns', returnedAmount),
    {},
    S('─── Net per Payment Method ───', ''),
    S('Cash Net (gross − returns − expenses)', paymentSummary.CASH?.net ?? Math.max(0, cashGross - (paymentSummary.CASH?.returns || 0) - totalGeneralEntries)),
    S('Card Net (gross − returns)', paymentSummary.CARD?.net ?? Math.max(0, cardGross - (paymentSummary.CARD?.returns || 0))),
    S('Online Net (gross − returns)', paymentSummary.ONLINE?.net ?? Math.max(0, onlineGross - (paymentSummary.ONLINE?.returns || 0))),
    {},
    S('─── Other ───', ''),
    S('General Entries (Expenses)', totalGeneralEntries),
    {},
    S('─── Final ───', ''),
    S('Net Sales (received − returns)', netSales),
    S('Net Revenue (total received − returns − expenses)', netRevenue),
  ];

  // 6. Assemble workbook
  const allRows = [...saleRows, ...returnRows, ...balanceRows, ...journalDataRows, ...summaryRows];
  const ws = XLSX.utils.json_to_sheet(allRows);

  ws['!cols'] = [
    { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'POS History');

  const fileName = `pos_history_${outlet.replace(/\s+/g, '_')}_${rangeLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Universal export function for all other Outlet Dashboard sections.
 */
export const exportSectionToExcel = (sectionId, data, outlet = 'Outlet', rangeLabel = 'All') => {
  const wb = XLSX.utils.book_new();
  const dateStr = new Date().toISOString().split('T')[0];

  switch (sectionId) {
    case 'payments': {
      const rows = Object.entries(data.paymentBreakdown || {}).map(([method, p]) => ({
        'Payment Method': method,
        'Gross Received': fmt(p.gross),
        'Returns': fmt(p.returns),
        'Net Collected': fmt(p.net),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Payments');
      XLSX.writeFile(wb, `payments_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'sales': {
      const trendRows = (data.salesAnalytics?.salesTrend || []).map(t => ({
        'Date': t.date,
        'Sales Amount': fmt(t.sales),
        'Invoices Count': t.count || 0,
      }));
      const prodRows = (data.salesAnalytics?.bestSellingProducts || []).map(p => ({
        'Product Name': p.name,
        'Quantity Sold': p.qty,
        'Total Revenue': fmt(p.revenue),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendRows), 'Sales Trend');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodRows), 'Top Products');
      XLSX.writeFile(wb, `sales_analytics_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'balance': {
      const balInvoices = (data.balanceInvoices || []).map(b => ({
        'Receipt #': b.receiptNumber,
        'Customer': b.customerName,
        'Order #': b.orderNumber || '-',
        'Grand Total': fmt(b.grandTotal),
        'Advance Paid': fmt(b.advanceAmount),
        'Balance Paid': fmt(b.balancePaid),
        'Remaining Balance': fmt(b.remaining),
        'Date': formatDateTime(b.createdAt),
      }));
      const balPayments = (data.balancePayments || []).map(p => ({
        'Receipt #': p.receiptNumber || '-',
        'Original Invoice': p.originalInvoiceNumber,
        'Customer': p.posSale?.customerName || '-',
        'Method': p.paymentMethod || 'CASH',
        'Amount Paid': fmt(p.amountPaidNow),
        'Cashier': p.cashierName,
        'Date': formatDateTime(p.paidAt),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balInvoices), 'Balance Invoices');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balPayments), 'Balance Collections');
      XLSX.writeFile(wb, `balance_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'faisal-takes': {
      const rows = (data.faisalTakes || []).map(ft => ({
        'Receipt #': ft.receiptNumber,
        'Date': formatDateTime(ft.createdAt),
        'Cashier': ft.cashierName,
        'Customer': ft.customerName,
        'Items': (ft.items || []).map(i => `${i.productName} x${i.quantity}`).join(', '),
        'Total Items': (ft.items || []).reduce((s, it) => s + (it.quantity || 0), 0),
        'Estimated Value': (ft.items || []).reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 0), 0),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Faisal Takes');
      XLSX.writeFile(wb, `faisal_takes_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'returns': {
      const rows = (data.returns || []).map(r => ({
        'Return Date': formatDateTime(r.createdAt),
        'Sale Receipt #': r.sale?.receiptNumber || '-',
        'Order #': r.sale?.orderNumber || '-',
        'Customer': r.customerName || r.sale?.customerName || '-',
        'Phone': r.sale?.customerPhone || '-',
        'Items': (r.sale?.items || []).map(i => `${i.productName} x${i.quantity}`).join(', '),
        'Refund Method': r.refundPaymentMethod || r.sale?.paymentMethod || 'CASH',
        'Refund Amount': fmt(r.refundAmount),
        'Reason': r.reason || '-',
        'Processed By': r.processedBy || r.cashierName || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Returns');
      XLSX.writeFile(wb, `returns_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'orders': {
      const rows = (data.orders || []).map(o => ({
        'Order #': o.orderNumber,
        'Invoice #': o.invoiceNumber || '-',
        'Customer': o.customerName,
        'Phone': o.customerPhone,
        'Status': o.status,
        'Total Amount': fmt(o.totalPrice),
        'Advance Paid': fmt(o.advancePayment),
        'Balance': fmt(o.balanceAmount),
        'Created Date': formatDateTime(o.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      XLSX.writeFile(wb, `orders_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'inventory': {
      const rows = (data.revenueAndInventory?.items || []).map(i => ({
        'Product Name': i.productName || i.name,
        'Category': i.category || '-',
        'Color': i.color || '-',
        'Size': i.size || '-',
        'Barcode': i.barcode || '-',
        'Stock Quantity': i.quantity ?? i.stock ?? 0,
        'Unit Price': fmt(i.price ?? i.unitPrice ?? 0),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `inventory_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'customers': {
      const rows = (data.customers || []).map(c => ({
        'Client #': c.clientNumber || '-',
        'Customer Name': c.name,
        'Phone': c.phone,
        'City': c.city || '-',
        'Total Orders': c.orders?.length || 0,
        'Balance Due': fmt(c.currentBalance || 0),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');
      XLSX.writeFile(wb, `customers_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'transfers': {
      const rows = (data.transfers || []).map(t => ({
        'Transfer #': t.transferNumber || t.id?.slice(0, 8),
        'From': t.sourceOutlet,
        'To': t.targetOutlet,
        'Items': (t.items || []).map(i => `${i.productName} x${i.quantity}`).join(', '),
        'Status': t.status,
        'Date': formatDateTime(t.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Transfers');
      XLSX.writeFile(wb, `transfers_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'requests': {
      const rows = (data.demandRequests || data.stockRequests || []).map(r => ({
        'Transfer #': r.transferNumber || '-',
        'Status': r.status,
        'Items Count': (r.items || []).length,
        'Requested Qty': (r.items || []).reduce((s, it) => s + (it.requestedQty || 0), 0),
        'Approved Qty': (r.items || []).reduce((s, it) => s + (it.approvedQty || 0), 0),
        'Notes': r.notes || r.storeNotes || '-',
        'Date': formatDateTime(r.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Requests');
      XLSX.writeFile(wb, `demand_requests_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'alterations': {
      const rows = (data.alterations || []).map(a => ({
        'Alteration #': a.alterationNumber || a.id?.slice(0, 8),
        'Customer': a.customerName,
        'Phone': a.customerPhone,
        'Status': a.status,
        'Notes': a.notes || '-',
        'Date': formatDateTime(a.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Alterations');
      XLSX.writeFile(wb, `alterations_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    case 'journal': {
      const rows = (data.journalEntries || []).map(j => ({
        'Date': formatDateTime(j.createdAt),
        'Title': j.expenseTitle || j.title || '-',
        'Employee': j.employeeName || '-',
        'Amount': fmt(j.amount),
        'Notes': j.notes || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'General Entries');
      XLSX.writeFile(wb, `general_entries_${outlet.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
      break;
    }

    default:
      console.warn('Unknown section for export:', sectionId);
  }
};

/**
 * Exports Daily Cash Deposits to Excel.
 */
export const exportDailyDepositsToExcel = (requirements = [], outlet = 'Outlet') => {
  const rows = requirements.map(r => ({
    'Business Date': r.businessDate,
    'Cash Generated': fmt(r.cashGenerated),
    'Previous Pending': fmt(r.previousPending),
    'Required Deposit': fmt(r.requiredAmount),
    'Actual Deposit': fmt(r.depositedAmount),
    'Applied to Previous': fmt((r.allocations || []).filter(a => a.allocationType === 'PREVIOUS_PENDING').reduce((s, a) => s + a.amount, 0)),
    'Applied to Today': fmt((r.allocations || []).filter(a => a.allocationType === 'CURRENT_DAY').reduce((s, a) => s + a.amount, 0)),
    'Remaining Pending': fmt(r.pendingAmount),
    'Excess Deposit': fmt(r.excessAmount),
    'Status': r.status,
    'Last Updated': formatDateTime(r.updatedAt),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Cash Deposits');
  XLSX.writeFile(wb, `daily_cash_deposits_${outlet.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
