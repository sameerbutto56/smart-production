import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { getPrintFooterHTML } from '../utils/printTemplate';
import { printReceipt, printBalanceReceipt, printBalanceGatePass, printReturnReceipt } from '../utils/POSPrint';
import { formatDateTime, formatDateOnly } from '../utils/dateTime';
import { Search, Clock, Printer, RefreshCw, DollarSign, AlertTriangle, Download, ChevronDown, ChevronUp, X, CreditCard, RotateCcw } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const datePresets = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom Range', value: 'custom' }
];

const OutletInvoiceHistory = ({ outlet }) => {
  const { isUrdu } = useLanguage();
  const [range, setRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cashier, setCashier] = useState('');
  const [employees, setEmployees] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [balancePayments, setBalancePayments] = useState([]);
  const [backendSummary, setBackendSummary] = useState(null);
  const [transactionTab, setTransactionTab] = useState('all'); // 'all', 'sales', 'returns', 'balance'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [refunding, setRefunding] = useState(null);

  useEffect(() => {
    api.get(`/api/pos/employees?outlet=${outlet}`).then(r => setEmployees(r.data)).catch(() => {});
  }, [outlet]);

  /* ─── Balance Payment Modals ─── */
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payCashAmount, setPayCashAmount] = useState(0);
  const [payOnlineAmount, setPayOnlineAmount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPayHistory, setShowPayHistory] = useState(false);
  const [payHistory, setPayHistory] = useState([]);
  const [payHistoryLoading, setPayHistoryLoading] = useState(false);
  const [payHistorySale, setPayHistorySale] = useState(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/pos/sales?outlet=${outlet}&range=${range}&includeTransactions=true`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (statusFilter !== 'all') url += `&statusFilter=${statusFilter}`;
      if (cashier) url += `&cashier=${encodeURIComponent(cashier)}`;
      const res = await api.get(url);
      if (res.data && res.data.sales) {
        setSales(res.data.sales);
        setReturns(res.data.returns || []);
        setBalancePayments(res.data.balancePayments || []);
        setBackendSummary(res.data.summary || null);
      } else {
        setSales(Array.isArray(res.data) ? res.data : []);
        setReturns([]);
        setBalancePayments([]);
        setBackendSummary(null);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [outlet, range, dateFrom, dateTo, statusFilter, cashier]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  /* ─── Refund Invoice ─── */
  const handleReturnInvoice = async (sale) => {
    if (sale.refundedAt) return toast.error('Invoice already refunded');
    if (sale.faisalTake) return toast.error('Cannot refund Faisal Take');
    if (!window.confirm(`Refund full invoice ${sale.receiptNumber} for ${formatCurrency(sale.grandTotal)}? All items will be returned to inventory. This cannot be undone.`)) return;
    setRefunding(sale.id);
    try {
      await api.post(`/api/pos/sales/${sale.id}/refund`);
      toast.success('Invoice fully refunded');
      fetchSales();
      printReturnReceipt({ ...sale, refundedAt: new Date() });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed');
    }
    setRefunding(null);
  };

  /* ─── Pay Balance ─── */
  const handlePayOpen = async (sale) => {
    try {
      const res = await api.get(`/api/pos/balance-invoices/${sale.id}`);
      setSelectedInvoice(res.data);
      setPayAmount(Math.ceil(res.data.remaining));
      setPayMethod('CASH');
      setPayCashAmount(Math.ceil(res.data.remaining));
      setPayOnlineAmount(0);
      setShowPayModal(true);
    } catch (e) {
      toast.error('Failed to load invoice');
    }
  };

  const handlePayBalance = async () => {
    if (!selectedInvoice || payAmount <= 0) return toast.error('Enter a valid amount');
    if (payAmount > selectedInvoice.remaining) return toast.error(`Amount exceeds remaining balance of ₨${selectedInvoice.remaining.toLocaleString()}`);
    if (payMethod === 'CASH_ONLINE' && Math.abs((payCashAmount + payOnlineAmount) - payAmount) > 0.01) {
      return toast.error(`Cash + Online must equal payment amount`);
    }
    setPaying(true);
    try {
      const payload = { amountPaidNow: payAmount, paymentMethod: payMethod };
      if (payMethod === 'CASH_ONLINE') {
        payload.cashAmount = payCashAmount;
        payload.onlineAmount = payOnlineAmount;
      }
      const res = await api.post(`/api/pos/balance-invoices/${selectedInvoice.id}/pay`, payload);
      setLastPayment(res.data);
      setShowPayModal(false);
      setShowReceipt(true);
      toast.success('Balance payment recorded — invoice status will update automatically');
      fetchSales();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  /* Balance receipt/gate-pass printing now uses the shared printers in utils/POSPrint.js
     (the previous local zero-arg printBalanceReceipt shadowed the import and ignored its arguments). */

  /* ─── Payment History ─── */
  const openPayHistory = async (sale) => {
    setShowPayHistory(true);
    setPayHistorySale(sale);
    setPayHistoryLoading(true);
    try {
      const res = await api.get(`/api/pos/balance-invoices/${sale.id}/history`);
      setPayHistory(res.data);
    } catch (e) {
      toast.error('Failed to load payment history');
    } finally {
      setPayHistoryLoading(false);
    }
  };

  /* ─── Download Excel ─── */
  const downloadExcel = async () => {
    try {
      const fmtPayment = (s) => s.paymentMethod === 'CASH_ONLINE' ? 'Cash+Online' : s.paymentMethod === 'CASH' ? 'Cash' : s.paymentMethod === 'CARD' ? 'Card' : s.paymentMethod === 'ONLINE' ? 'Online' : s.paymentMethod || '';
      const src = filteredSales;

      // ── Fetch journal/expense entries ──
      let journalEntries = [];
      try {
        const params = { outlet };
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
        if (!dateFrom && !dateTo && range !== 'all') params.range = range;
        const res = await api.get('/api/pos/journal-entries', { params });
        journalEntries = res.data || [];
      } catch (e) { /* silent */ }

      const totalGeneralEntries = journalEntries.reduce((sum, ge) => sum + (ge.amount || 0), 0);

      // ── Helper: resolve per-invoice Cash / Online / Card amounts ──
      const resolvePaymentAmounts = (s) => {
        const received = s._amountReceived || 0;
        let cash = 0, online = 0, card = 0;
        if (s.paymentMethod === 'CASH_ONLINE') {
          cash = s.cashAmount || 0;
          online = s.onlineAmount || 0;
          // Scale if advance/partial: e.g. grandTotal=10k, advance=5k → ratio=0.5
          const declared = cash + online;
          if (declared > 0 && Math.abs(declared - received) > 0.5) {
            const ratio = received / declared;
            cash = Math.round(cash * ratio);
            online = received - cash; // remainder to avoid rounding drift
          }
        } else if (s.paymentMethod === 'CARD') {
          card = received;
        } else if (s.paymentMethod === 'ONLINE') {
          online = received;
        } else {
          cash = received; // CASH or unknown → cash
        }
        return { cash, online, card };
      };

      // ── Per-invoice data rows with full payment breakdown ──
      const data = src.map(s => {
        const pay = resolvePaymentAmounts(s);
        return {
          'Receipt #': s.receiptNumber || '',
          'Date': formatDateTime(s.createdAt),
          'Cashier': s.cashierName || '',
          'Customer': s.customerName || '',
          'Phone': s.customerPhone || '',
          'Items': (s.items || []).map(i => `${i.productName}${i.color ? ' ('+(isUrdu ? toUrduName(i.color) : i.color)+')' : ''}${i.size ? ' '+i.size : ''} x${i.quantity}`).join(', '),
          'Subtotal': s.subtotal || 0,
          'Discount': s.discountAmount || 0,
          'Card Charges': s.cardChargesAmount || 0,
          'Invoice Total': s.grandTotal || 0,
          'Amount Received': s._amountReceived || 0,
          'Payment Method': fmtPayment(s),
          'Cash Amount': pay.cash,
          'Card Amount': pay.card,
          'Online Amount': pay.online,
          'Advance': s.advanceAmount || 0,
          'Balance Remaining': s._balanceRemaining || 0,
          'Status': s.refundedAt ? 'RETURN' : (s._balanceStatus === 'balance' ? 'BALANCE' : 'PAID'),
        };
      });

      // ── Authoritative summary from backend (same source as Register / Dashboard) ──
      // The backend computeUnifiedSalesSummary already routes balance clearances to
      // their actual payment method: Cash clearance → Cash total, Online → Online, etc.
      let summary = null;
      if (!(search || '').trim()) {
        try {
          const params = { outlet, skipCache: 'true' };
          if (dateFrom) params.dateFrom = dateFrom;
          if (dateTo) params.dateTo = dateTo;
          if (!dateFrom && !dateTo && range !== 'all') params.range = range;
          const res = await api.get('/api/pos/sales-summary', { params });
          summary = res.data || null;
        } catch (e) { /* silent fallback below */ }
      }

      // Client-side fallback only when no backend summary (e.g. search mode)
      if (!summary) {
        let CASH = 0, ONLINE = 0, CARD = 0;
        src.forEach(s => {
          const pay = resolvePaymentAmounts(s);
          CASH += pay.cash; ONLINE += pay.online; CARD += pay.card;
        });
        const bpCash = filteredBalancePayments.filter(b => b.paymentMethod === 'CASH' || (!b.paymentMethod)).reduce((s, b) => s + (b.amountPaidNow || 0), 0);
        const bpOnline = filteredBalancePayments.filter(b => b.paymentMethod === 'ONLINE').reduce((s, b) => s + (b.amountPaidNow || 0), 0);
        const bpCard = filteredBalancePayments.filter(b => b.paymentMethod === 'CARD').reduce((s, b) => s + (b.amountPaidNow || 0), 0);
        const bpCashOnline = filteredBalancePayments.filter(b => b.paymentMethod === 'CASH_ONLINE');
        bpCashOnline.forEach(b => {
          const c = b.cashAmount || ((b.amountPaidNow || 0) / 2);
          const o = b.onlineAmount || ((b.amountPaidNow || 0) / 2);
          CASH += c; ONLINE += o;
        });
        CASH += bpCash; ONLINE += bpOnline; CARD += bpCard;
        const returnedAmount = filteredReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
        const discountTotal = src.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
        const balTotal = filteredBalancePayments.reduce((sum, b) => sum + (b.amountPaidNow || 0), 0);
        const salesReceived = src.reduce((sum, s) => sum + (s._amountReceived || 0), 0);
        summary = {
          paymentSummary: { cash: CASH, card: CARD, online: ONLINE, cashOnlineTotal: 0 },
          paymentBreakdown: [
            { method: 'CASH', gross: CASH, returns: 0, net: CASH - totalGeneralEntries },
            { method: 'CARD', gross: CARD, returns: 0, net: CARD },
            { method: 'ONLINE', gross: ONLINE, returns: 0, net: ONLINE },
          ],
          grossSales: salesReceived + discountTotal,
          salesReceived,
          totalReceived: salesReceived + balTotal,
          refundAmount: returnedAmount,
          totalReturns: returnedAmount,
          totalDiscount: discountTotal,
          discountTotal,
          totalBalanceCollections: balTotal,
          netSales: Math.max(0, salesReceived - returnedAmount),
          netRevenue: Math.max(0, salesReceived + balTotal - returnedAmount - totalGeneralEntries),
          invoiceCount: src.length,
          totalJournalExpenses: totalGeneralEntries,
          totalBankDeposits: 0,
        };
      }

      // ── Extract authoritative figures from summary ──
      const ps = summary.paymentSummary || {};
      const pb = summary.paymentBreakdown || [];
      const cashGross = Math.round(ps.cash ?? 0);
      const cardGross = Math.round(ps.card ?? 0);
      const onlineGross = Math.round(ps.online ?? 0);
      const cashOnlineRaw = Math.round(ps.cashOnlineTotal ?? 0);
      // Note: paymentSummary.cash already includes Cash+Online's cash portion,
      // so grandTotalReceived = cash + card + online (no need to add cashOnlineTotal separately)
      const salesReceived = Math.round(summary.salesReceived ?? (cashGross + cardGross + onlineGross));
      const balanceCollections = Math.round(summary.totalBalanceCollections ?? summary.totalBalanceCleared ?? 0);
      const totalReceived = Math.round(summary.totalReceived ?? (salesReceived + balanceCollections));
      const grossSales = Math.round(summary.grossSales ?? 0);
      const discountTotal = Math.round(summary.discountTotal ?? summary.totalDiscount ?? 0);
      const returnedAmount = Math.round(summary.refundAmount ?? summary.totalReturns ?? summary.returnedAmount ?? 0);
      const invoiceCount = summary.invoiceCount ?? src.length;
      const netSales = Math.round(summary.netSales ?? Math.max(0, salesReceived - returnedAmount));
      const netRevenue = Math.round(summary.netRevenue ?? 0);
      const totalAdvancePayments = src.reduce((sum, s) => sum + (s.advanceAmount || 0), 0);
      const outstandingBalance = src.reduce((sum, s) => sum + (s._outstandingBalance || 0), 0);
      const bankDeposits = Math.round(summary.totalBankDeposits ?? 0);

      // Per-method net (gross − returns − expenses for Cash)
      const findPB = (m) => pb.find(p => p.method === m) || { gross: 0, returns: 0, net: 0 };
      const cashPB = findPB('CASH');
      const cardPB = findPB('CARD');
      const onlinePB = findPB('ONLINE');

      // ── Journal / Expense data rows ──
      const emptyPayCols = { 'Cash Amount': '', 'Card Amount': '', 'Online Amount': '' };
      const journalDataRows = journalEntries.map(ge => ({
        'Receipt #': 'GENERAL ENTRY',
        'Date': formatDateTime(ge.createdAt),
        'Cashier': ge.employeeName || '',
        'Customer': ge.expenseTitle || '',
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

      // ── Return rows ──
      const returnRows = filteredReturns.map(r => ({
        'Receipt #': r.receiptNumber || `RET-${r.id?.slice(0, 8)}`,
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

      // ── Balance Clearance rows — payment method shows actual method used ──
      const balanceRows = filteredBalancePayments.map(bp => {
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

      // ── Comprehensive Summary Section ──
      const S = (label, value) => ({ 'Receipt #': label, 'Amount Received': typeof value === 'number' ? value : '' });
      const summaryRows = [
        {}, {},
        S('═══════════════════════════════', ''),
        S('S U M M A R Y', ''),
        S('═══════════════════════════════', ''),
        {},
        S('Invoice Count', invoiceCount),
        S('Gross Sales (before discounts)', grossSales),
        S('Discounts', discountTotal),
        S('Sales Received (after discounts)', salesReceived),
        S('Balance Collections', balanceCollections),
        S('Total Received (Sales + Balance)', totalReceived),
        {},
        S('─── Payment Breakdown (Sales + Balance Collections) ───', ''),
        S('Cash — Gross', cashGross),
        S('Card — Gross', cardGross),
        S('Online — Gross', onlineGross),
        ...(cashOnlineRaw > 0 ? [S('Cash+Online (combined raw)', cashOnlineRaw)] : []),
        {},
        S('─── Returns / Refunds ───', ''),
        S('Total Returns', returnedAmount),
        S('Returns via Cash', Math.round(cashPB.returns || 0)),
        S('Returns via Card', Math.round(cardPB.returns || 0)),
        S('Returns via Online', Math.round(onlinePB.returns || 0)),
        {},
        S('─── Net per Payment Method ───', ''),
        S('Cash Net (gross − returns − expenses − deposits)', Math.round(cashPB.net || 0)),
        S('Card Net (gross − returns)', Math.round(cardPB.net || 0)),
        S('Online Net (gross − returns)', Math.round(onlinePB.net || 0)),
        {},
        S('─── Other ───', ''),
        S('Total Advance Payments', totalAdvancePayments),
        S('Outstanding Balance', outstandingBalance),
        S('General Entries (Expenses)', Math.round(totalGeneralEntries)),
        S('Bank Deposits', bankDeposits),
        {},
        S('─── Final ───', ''),
        S('Net Sales (received − returns)', netSales),
        S('Net Revenue (total received − returns − expenses)', netRevenue),
      ];

      // ── Assemble workbook ──
      const allRows = [...data, ...returnRows, ...balanceRows, ...journalDataRows, ...summaryRows];
      const ws = XLSX.utils.json_to_sheet(allRows);

      const colWidths = [
        { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
        { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 14 }, { wch: 10 },
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'POS History');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pos_history_${outlet}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      console.error('Excel download failed:', err);
      toast.error('Excel download failed');
    }
  };

  /* ─── Derived Filters ─── */
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (s.receiptNumber || '').toLowerCase().includes(q)
          || (s.customerName || '').toLowerCase().includes(q)
          || (s.cashierName || '').toLowerCase().includes(q);
    });
  }, [sales, search]);

  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      if (statusFilter === 'balance') return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (r.receiptNumber || '').toLowerCase().includes(q)
          || (r.sale?.receiptNumber || '').toLowerCase().includes(q)
          || (r.sale?.orderNumber || '').toLowerCase().includes(q)
          || (r.customerName || r.sale?.customerName || '').toLowerCase().includes(q)
          || (r.cashierName || r.processedBy || r.sale?.cashierName || '').toLowerCase().includes(q)
          || (r.reason || '').toLowerCase().includes(q);
    });
  }, [returns, search, statusFilter]);

  const filteredBalancePayments = useMemo(() => {
    return balancePayments.filter(bp => {
      if (statusFilter === 'paid') return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (bp.receiptNumber || '').toLowerCase().includes(q)
          || (bp.originalInvoiceNumber || '').toLowerCase().includes(q)
          || (bp.posSale?.customerName || '').toLowerCase().includes(q)
          || (bp.cashierName || '').toLowerCase().includes(q);
    });
  }, [balancePayments, search, statusFilter]);

  /* ─── Unified Transaction List ─── */
  const allTransactions = useMemo(() => {
    const list = [];
    if (transactionTab === 'all' || transactionTab === 'sales') {
      filteredSales.forEach(s => list.push({ type: 'SALE', id: `sale-${s.id}`, date: new Date(s.createdAt).getTime(), data: s }));
    }
    if (transactionTab === 'all' || transactionTab === 'returns') {
      filteredReturns.forEach(r => list.push({ type: 'RETURN', id: `return-${r.id}`, date: new Date(r.createdAt).getTime(), data: r }));
    }
    if (transactionTab === 'all' || transactionTab === 'balance') {
      filteredBalancePayments.forEach(bp => list.push({ type: 'BALANCE', id: `balance-${bp.id}`, date: new Date(bp.paidAt).getTime(), data: bp }));
    }
    return list.sort((a, b) => b.date - a.date);
  }, [filteredSales, filteredReturns, filteredBalancePayments, transactionTab]);

  /* ─── Authoritative Summary Figures ─── */
  const grossSalesVal = backendSummary?.grossSales ?? (
    filteredSales.reduce((sum, s) => sum + (s._amountReceived || 0) + (s.discountAmount || 0), 0)
  );
  const discountTotalVal = backendSummary?.totalDiscount ?? (
    filteredSales.reduce((sum, s) => sum + (s.discountAmount || 0), 0)
  );
  const salesReceivedVal = backendSummary?.salesReceived ?? (
    filteredSales.reduce((sum, s) => sum + (s._amountReceived || 0), 0)
  );
  const totalReturnsVal = backendSummary?.totalReturns ?? (
    filteredReturns.reduce((sum, r) => sum + (r.refundAmount || 0), 0)
  );
  const netRevenueVal = backendSummary?.netRevenue ?? (salesReceivedVal - totalReturnsVal);

  const paymentSummary = {
    CASH: backendSummary?.paymentSummary?.cash ?? filteredSales.filter(s => s.paymentMethod === 'CASH').reduce((acc, s) => acc + (s._amountReceived || 0), 0),
    CARD: backendSummary?.paymentSummary?.card ?? filteredSales.filter(s => s.paymentMethod === 'CARD').reduce((acc, s) => acc + (s._amountReceived || 0), 0),
    ONLINE: backendSummary?.paymentSummary?.online ?? filteredSales.filter(s => s.paymentMethod === 'ONLINE').reduce((acc, s) => acc + (s._amountReceived || 0), 0),
    CASH_ONLINE: backendSummary?.paymentSummary?.cashOnlineTotal ?? filteredSales.filter(s => s.paymentMethod === 'CASH_ONLINE').reduce((acc, s) => acc + (s._amountReceived || 0), 0),
  };

  const paymentMethods = [
    { key: 'CASH', label: 'Cash', color: 'from-emerald-600 to-green-600' },
    { key: 'ONLINE', label: 'Online', color: 'from-blue-600 to-indigo-600' },
    { key: 'CARD', label: 'Card', color: 'from-purple-600 to-violet-600' },
    { key: 'CASH_ONLINE', label: 'Cash+Online', color: 'from-cyan-600 to-teal-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        {datePresets.map(p => (
          <button key={p.value} onClick={() => { setRange(p.value); if (p.value !== 'custom') { setDateFrom(''); setDateTo(''); } }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${range === p.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {p.label}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" />
            <span className="text-gray-500 text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" />
          </div>
        )}
      </div>

      {/* Search + Filter + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input type="text" placeholder="Search receipt, customer, cashier, order #..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2 pl-9 pr-4 text-xs text-white font-bold focus:outline-none focus:border-blue-500/50" />
        </div>
        <div className="flex bg-gray-800 rounded-xl p-0.5">
          {[
            { value: 'all', label: 'All Invoices' },
            { value: 'paid', label: 'Paid' },
            { value: 'balance', label: 'Balance' }
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={cashier} onChange={e => setCashier(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-2 text-[10px] text-white font-bold focus:outline-none focus:border-blue-500/50">
          <option value="">All Employees</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={fetchSales} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all">
          <RefreshCw size={14} />
        </button>
        <button onClick={downloadExcel} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all">
          <Download size={14} /> Excel
        </button>
      </div>

      {/* Authoritative Financial KPI Cards */}
      {!loading && !error && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gross Sales</p>
              <p className="text-sm font-black text-white mt-1">{formatCurrency(grossSalesVal)}</p>
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Discounts</p>
              <p className="text-sm font-black text-amber-400 mt-1">-{formatCurrency(discountTotalVal)}</p>
            </div>
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Received</p>
              <p className="text-sm font-black text-cyan-400 mt-1">{formatCurrency(salesReceivedVal)}</p>
            </div>
            <div className="bg-gray-950 border border-red-500/30 rounded-xl p-3">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Returns / Refunds</p>
              <p className="text-sm font-black text-red-400 mt-1">-{formatCurrency(totalReturnsVal)}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-950/60 to-gray-950 border border-emerald-500/40 rounded-xl p-3 col-span-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Net Revenue / Sales</p>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">Exact Rupee</span>
              </div>
              <p className="text-base font-black text-emerald-400 mt-1">{formatCurrency(netRevenueVal)}</p>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {paymentMethods.map(pm => {
              const total = paymentSummary[pm.key] || 0;
              return (
                <div key={pm.key} className={`bg-gradient-to-br ${pm.color} p-[1px] rounded-xl`}>
                  <div className="bg-gray-950 rounded-xl p-3">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{pm.label}</p>
                    <p className="text-sm font-black text-white mt-1">{formatCurrency(total)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction View Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800">
        <button
          onClick={() => setTransactionTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            transactionTab === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>All Transactions</span>
          <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded-full">
            {filteredSales.length + filteredReturns.length + filteredBalancePayments.length}
          </span>
        </button>
        <button
          onClick={() => setTransactionTab('sales')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            transactionTab === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Sales Invoices</span>
          <span className="text-[10px] bg-emerald-900/60 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
            {filteredSales.length}
          </span>
        </button>
        <button
          onClick={() => setTransactionTab('returns')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            transactionTab === 'returns' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Returns & Refunds</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            filteredReturns.length > 0 ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {filteredReturns.length}
          </span>
        </button>
        <button
          onClick={() => setTransactionTab('balance')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            transactionTab === 'balance' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <span>Balance Clearances</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            filteredBalancePayments.length > 0 ? 'bg-purple-950 text-purple-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {filteredBalancePayments.length}
          </span>
        </button>
      </div>

      {/* Loading / Error / Empty */}
      {loading ? (
        <div className="py-16 flex justify-center"><RefreshCw className="animate-spin text-blue-500" size={28} /></div>
      ) : error ? (
        <div className="py-16 flex flex-col items-center text-center">
          <AlertTriangle className="text-red-400 mb-2" size={32} />
          <p className="text-red-400 font-black text-sm mb-2">{error}</p>
          <button onClick={fetchSales} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs">Retry</button>
        </div>
      ) : allTransactions.length === 0 ? (
        <div className="py-16 text-center">
          <Clock className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-500 font-bold">No transactions found</p>
        </div>
      ) : (
        /* Unified Transaction List */
        <div className="space-y-3">
          {allTransactions.map(tx => {
            if (tx.type === 'SALE') {
              const sale = tx.data;
              const isExpanded = expandedId === sale.id;
              const isBalance = sale._balanceStatus === 'balance';
              const adv = parseFloat(sale.advanceAmount) || 0;
              return (
                <div key={tx.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : sale.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-white truncate">{sale.receiptNumber}</span>
                          {sale.faisalTake && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">FT</span>}
                          {isBalance && <span className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded-full font-bold">BAL</span>}
                          {!isBalance && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">PAID</span>}
                          {!!sale.orderId && <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-bold">ORD</span>}
                        </div>
                        <p className="text-xs text-gray-400">{sale.customerName || 'Walk-in'} {sale.customerPhone ? `(${sale.customerPhone})` : ''}</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-600 mt-1">
                          <span>{formatDateOnly(sale.createdAt)}</span>
                          <span>{sale.cashierName || ''}</span>
                          <span>{sale.paymentMethod === 'CASH_ONLINE' ? 'Cash+Online' : sale.paymentMethod}</span>
                          <span>{(sale.items || []).length} items</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-base font-black text-white">{formatCurrency(sale.grandTotal)}</p>
                        {isBalance && <p className="text-[10px] text-amber-400 font-bold">Rem: {formatCurrency(sale._balanceRemaining)}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                      {/* Items */}
                      {(sale.items || []).map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <div>
                            <p className="font-black text-white">{item.productName}</p>
                            <p className="text-[10px] text-gray-500">{[isUrdu ? toUrduName(item.color) : item.color, item.size].filter(Boolean).join(' / ')}{item.alterationCharges ? ` +Alt:${item.alterationCharges}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-white">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                            <p className="text-[10px] text-gray-500">{formatCurrency(item.lineTotal)}</p>
                          </div>
                        </div>
                      ))}

                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <p className="text-gray-500">Subtotal</p>
                          <p className="font-bold text-white">{formatCurrency(sale.subtotal)}</p>
                        </div>
                        {sale.alterationCharges > 0 && (
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Alteration</p>
                            <p className="font-bold text-white">{formatCurrency(sale.alterationCharges)}</p>
                          </div>
                        )}
                        {sale.discountAmount > 0 && (
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Discount</p>
                            <p className="font-bold text-red-400">-{formatCurrency(sale.discountAmount)}</p>
                          </div>
                        )}
                        {sale.cardChargesAmount > 0 && (
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Card Charges</p>
                            <p className="font-bold text-amber-400">+{formatCurrency(sale.cardChargesAmount)}</p>
                          </div>
                        )}
                        {adv > 0 && (
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Advance Paid</p>
                            <p className="font-bold text-emerald-400">{formatCurrency(adv)}</p>
                          </div>
                        )}
                        {sale.paymentMethod === 'CASH_ONLINE' && (
                          <>
                            <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-gray-500">Cash Amount</p>
                              <p className="font-bold text-emerald-400">{formatCurrency(sale.cashAmount)}</p>
                            </div>
                            <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-gray-500">Online Amount</p>
                              <p className="font-bold text-blue-400">{formatCurrency(sale.onlineAmount)}</p>
                            </div>
                          </>
                        )}
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 col-span-2">
                          <p className="text-gray-500">Grand Total</p>
                          <p className="text-base font-black text-white">{formatCurrency(sale.grandTotal)}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <button onClick={() => printReceipt(sale)} disabled={printing === sale.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                          {printing === sale.id ? <RefreshCw className="animate-spin" size={12} /> : <Printer size={12} />} Print
                        </button>
                        {!sale.refundedAt && !sale.faisalTake && (
                          <button onClick={() => handleReturnInvoice(sale)} disabled={refunding === sale.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                            {refunding === sale.id ? <RefreshCw className="animate-spin" size={12} /> : <RotateCcw size={12} />} Return
                          </button>
                        )}
                        {sale.refundedAt && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><RotateCcw size={12} /> Refunded</span>}
                        {isBalance && (
                          <button onClick={() => handlePayOpen(sale)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all">
                            <DollarSign size={12} /> Pay Balance
                          </button>
                        )}
                        <button onClick={() => openPayHistory(sale)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-xl transition-all">
                          <Clock size={12} /> Payment History
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (tx.type === 'RETURN') {
              const ret = tx.data;
              return (
                <div key={tx.id} className="bg-gray-900 border border-red-500/30 rounded-2xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-red-400 truncate">
                            {ret.receiptNumber || `RET-${ret.id?.slice(0, 8)}`}
                          </span>
                          <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                            <RotateCcw size={10} /> RETURN / REFUND
                          </span>
                          {ret.sale?.receiptNumber && (
                            <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md font-bold">
                              Orig Sale: {ret.sale.receiptNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300">
                          Customer: <span className="font-bold text-white">{ret.customerName || ret.sale?.customerName || 'Walk-in'}</span>
                          {ret.sale?.customerPhone ? ` (${ret.sale.customerPhone})` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 mt-1">
                          <span>{formatDateTime(ret.createdAt)}</span>
                          <span>Cashier: <b className="text-gray-300">{ret.processedBy || ret.cashierName || ret.sale?.cashierName || 'N/A'}</b></span>
                          <span className="text-purple-400 font-bold">Refund Method: {ret.refundPaymentMethod || 'CARD'}</span>
                          {ret.reason && <span className="text-amber-400 font-medium">Reason: {ret.reason}</span>}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-base font-black text-red-400">-{formatCurrency(ret.refundAmount || ret.amount)}</p>
                        <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Inventory Restocked</span>
                      </div>
                    </div>
                    {/* If returned items exist */}
                    {ret.sale?.items && ret.sale.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-800/80 space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Returned Product Items:</p>
                        {ret.sale.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs bg-gray-950 px-3 py-1.5 rounded-lg text-gray-300 border border-gray-800/60">
                            <span>{item.productName} {item.color ? `(${item.color})` : ''} {item.size || ''} × {item.quantity}</span>
                            <span className="font-bold text-red-400">-{formatCurrency(item.lineTotal || (item.unitPrice * item.quantity))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (tx.type === 'BALANCE') {
              const bp = tx.data;
              return (
                <div key={tx.id} className="bg-gray-900 border border-emerald-500/30 rounded-2xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-emerald-400 truncate">
                            {bp.receiptNumber || `BP-${bp.id?.slice(0, 8)}`}
                          </span>
                          <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                            <DollarSign size={10} /> BALANCE CLEARANCE
                          </span>
                          {bp.originalInvoiceNumber && (
                            <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md font-bold">
                              Orig Invoice: {bp.originalInvoiceNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300">
                          Customer: <span className="font-bold text-white">{bp.posSale?.customerName || 'Customer'}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 mt-1">
                          <span>{formatDateTime(bp.paidAt)}</span>
                          <span>Cashier: <b className="text-gray-300">{bp.cashierName || 'N/A'}</b></span>
                          <span className="text-cyan-400 font-bold">Payment Method: {bp.paymentMethod}</span>
                          {bp.outstandingBalanceAfterPayment !== undefined && (
                            <span className="text-gray-400">Remaining Balance: <b className="text-amber-400">{formatCurrency(bp.outstandingBalanceAfterPayment)}</b></span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-base font-black text-emerald-400">+{formatCurrency(bp.amountPaidNow)}</p>
                        <span className="text-[9px] text-gray-400">Paid Now</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* ─── Pay Balance Modal ─── */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">Pay Remaining Balance</h3>
            <div className="space-y-2 text-xs bg-gray-950 p-3 rounded-xl">
              <p className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-bold text-white">{selectedInvoice.receiptNumber}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold text-white">{selectedInvoice.customerName || 'Walk-in'}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Original Total</span><span className="font-bold text-white">{formatCurrency(selectedInvoice.grandTotal)}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-bold text-emerald-400">{formatCurrency(selectedInvoice.totalPaid || (selectedInvoice.grandTotal - selectedInvoice.remaining))}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Remaining</span><span className="font-bold text-amber-400">{formatCurrency(selectedInvoice.remaining)}</span></p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">Payment Method</p>
              <div className="flex gap-1.5 mb-3">
                {[{ v: 'CASH', l: 'Cash' }, { v: 'CARD', l: 'Card' }, { v: 'ONLINE', l: 'Online' }, { v: 'CASH_ONLINE', l: 'Cash+Online' }].map(({ v, l }) => (
                  <button key={v} onClick={() => { setPayMethod(v); if (v !== 'CASH_ONLINE') { setPayCashAmount(0); setPayOnlineAmount(0); } else { setPayCashAmount(Math.ceil(selectedInvoice.remaining)); setPayOnlineAmount(0); } }}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border ${payMethod === v ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300' : 'border-gray-700 text-gray-500'}`}>{l}</button>
                ))}
              </div>
              {payMethod === 'CASH_ONLINE' && (
                <div className="space-y-2 mb-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-500 font-bold mb-0.5">Cash</p>
                      <input type="number" value={payCashAmount} min="0" max={payAmount}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; setPayCashAmount(v); setPayOnlineAmount(Math.max(0, payAmount - v)); }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-500 font-bold mb-0.5">Online</p>
                      <input type="number" value={payOnlineAmount} min="0" max={payAmount}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; setPayOnlineAmount(v); setPayCashAmount(Math.max(0, payAmount - v)); }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500/50" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 text-center">Total: {formatCurrency(payCashAmount + payOnlineAmount)} / {formatCurrency(payAmount)}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">Payment Amount</p>
              <input type="number" value={payAmount} min={0} max={selectedInvoice.remaining}
                onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Cancel</button>
              <button onClick={handlePayBalance} disabled={paying}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                {paying ? <RefreshCcw className="animate-spin" size={14} /> : <DollarSign size={14} />} Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Balance Payment Success / Receipt ─── */}
      {lastPayment && showReceipt && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => { setShowReceipt(false); setLastPayment(null); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <DollarSign size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-white">Payment Successful</h3>
              <p className="text-[10px] text-gray-500 mt-1">Balance payment recorded — status updated automatically</p>
            </div>
            <div className="text-xs bg-gray-950 p-3 rounded-xl space-y-1.5">
              <p className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-emerald-400">{formatCurrency(lastPayment.amountPaidNow ?? lastPayment.amount)}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Remaining</span><span className="font-bold text-white">{formatCurrency(lastPayment.outstandingBalanceAfterPayment ?? lastPayment.remaining)}</span></p>
              {(lastPayment.outstandingBalanceAfterPayment ?? lastPayment.remaining ?? 0) <= 0.01 && <p className="text-[10px] text-emerald-400 font-bold text-center mt-1">✓ Fully Paid — Invoice moved to Paid</p>}
              <p className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-bold text-white">{lastPayment.paymentMethod || 'CASH'}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-bold text-white">{formatDateTime(lastPayment.paidAt || lastPayment.createdAt)}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => printBalanceReceipt(lastPayment, selectedInvoice)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <Printer size={14} /> Receipt
              </button>
              <button onClick={() => printBalanceGatePass(lastPayment, selectedInvoice)} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Printer size={14} /> Gate Pass</button><button onClick={() => { setShowReceipt(false); setLastPayment(null); }}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Payment History Modal ─── */}
      {showPayHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPayHistory(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white mb-4">Balance Payment History</h3>
            {payHistoryLoading ? (
              <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-500" size={24} /></div>
            ) : payHistory.length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-8">No balance payments recorded</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                  {payHistory.map((ph, i) => (
                    <div key={i} className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-cyan-400">{ph.receiptNumber || `Payment #${i + 1}`}</span>
                        <span className="text-[10px] text-gray-500">{formatDateTime(ph.paidAt || ph.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-emerald-400">{formatCurrency(ph.amountPaidNow || ph.amount)}</span>
                        <span className="text-[10px] text-gray-500">{ph.paymentMethod || 'CASH'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-1">
                        {ph.remainingBalanceBeforePayment > 0 && <span>Before: {formatCurrency(ph.remainingBalanceBeforePayment)}</span>}
                        {ph.outstandingBalanceAfterPayment > 0 && <span className="text-amber-400">Remaining: {formatCurrency(ph.outstandingBalanceAfterPayment)}</span>}
                        {ph.outstandingBalanceAfterPayment <= 0 && <span className="text-emerald-400 font-bold">✓ FULLY PAID</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {ph.cashierName && <span className="text-[10px] text-gray-600">Cashier: {ph.cashierName}</span>}
                        <div className="flex items-center gap-1"><button onClick={() => printBalanceReceipt(ph, payHistorySale)} className="text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-lg text-[10px] font-bold"><Printer size={10} className="inline mr-0.5" />Receipt</button><button onClick={() => printBalanceGatePass(ph, payHistorySale)} className="text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg text-[10px] font-bold"><Printer size={10} className="inline mr-0.5" />Gate Pass</button></div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <button onClick={() => setShowPayHistory(false)}
              className="mt-4 w-full py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletInvoiceHistory;
