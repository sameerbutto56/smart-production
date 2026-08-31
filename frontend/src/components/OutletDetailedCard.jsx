import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import useDateRange from '../hooks/useDateRange';
import {
  LayoutDashboard, CreditCard, TrendingUp, Wallet, User, RotateCcw, FileText,
  ShoppingBag, Layers, Package, Users, ArrowLeftRight, ClipboardList, Scissors,
  BookOpen, Book, Search, ChevronRight, RefreshCw, Calendar, X,
  Minus, CheckCircle, Clock, Phone, Landmark,
  ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import OutletRegisters from './OutletRegisters';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import { pktDayISO } from '../utils/pktRange';

const saleRevenue = (s) => s.advanceAmount > 0 ? Math.min(s.advanceAmount, s.grandTotal) : s.grandTotal;
const fmt = (n) => `PKR ${(n || 0).toLocaleString()}`;
const fmtDate = (d) => d ? formatDateOnly(d) : '-';
const fmtTime = (d) => d ? formatTimeOnly(d) : '';
const fmtShortDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth() + 1}`;
};

const sectionNav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'sales', label: 'Sales Analytics', icon: TrendingUp },
  { id: 'balance', label: 'Balance', icon: Wallet },
  { id: 'faisal-takes', label: 'Faisal Takes', icon: User },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'tracking', label: 'Order Tracking', icon: Layers },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'alterations', label: 'Alterations', icon: Scissors },
  { id: 'journal', label: 'General Entries', icon: BookOpen },
  { id: 'registers', label: 'Registers', icon: Book },
  { id: 'bank-deposits', label: 'Bank Deposits', icon: Landmark },
];

const ITEMS_PER_PAGE = 25;

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onPageChange(1)} disabled={currentPage === 1}
        className="p-1 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
        <ChevronsLeft size={14} />
      </button>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="p-1 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
        <ChevronLeft size={14} />
      </button>
      <span className="text-[10px] font-black text-gray-400 px-2">Page {currentPage} of {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="p-1 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
        <ChevronRight size={14} />
      </button>
      <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages}
        className="p-1 rounded-lg bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
        <ChevronsRight size={14} />
      </button>
    </div>
  );
};

const InvoiceDetailModal = ({ sale, onClose }) => {
  if (!sale) return null;
  const items = sale.items || [];
  const returns = sale.returns || [];
  const balancePayments = sale.balancePayments || [];
  const itemsTotal = items.reduce((a, it) => a + (it.lineTotal || 0), 0);
  const balancePaid = balancePayments.reduce((a, p) => a + (p.amountPaidNow || 0), 0);
  const received = sale.advanceAmount > 0
    ? Math.min(sale.advanceAmount, sale.grandTotal) + balancePaid
    : (sale.grandTotal || 0);
  const remaining = Math.max(0, (sale.grandTotal || 0) - received);
  const discount = sale.discountAmount || Math.max(0, itemsTotal - (sale.grandTotal || 0));
  const method = sale.paymentMethod || 'CASH';
  const methodBadge = method === 'CASH' ? 'bg-emerald-500/20 text-emerald-400'
    : method === 'CARD' ? 'bg-purple-500/20 text-purple-400'
    : method === 'ONLINE' ? 'bg-blue-500/20 text-blue-400'
    : 'bg-amber-500/20 text-amber-400';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl border-2 border-gray-600/60 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-700/60 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" /> Invoice Detail
            </h3>
            <p className="text-[10px] font-bold text-gray-400 mt-0.5">{sale.receiptNumber || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-800/60 border border-gray-700/60 text-gray-400 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Date & Time</p>
              <p className="text-white font-bold">{fmtDate(sale.createdAt)} {fmtTime(sale.createdAt)}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Cashier</p>
              <p className="text-white font-bold">{sale.cashierName || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Customer</p>
              <p className="text-white font-bold">{sale.customerName || 'Walk-in'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Phone</p>
              <p className="text-white font-bold">{sale.customerPhone || '—'}</p>
            </div>
            {sale.orderNumber && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Order #</p>
                <p className="text-amber-400 font-bold">{sale.orderNumber}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Outlet</p>
              <p className="text-white font-bold">{sale.outletName || '—'}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Payment</p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${methodBadge}`}>{method}</span>
              {sale.faisalTake && <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">FAISAL</span>}
              {sale.refundedAt && <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">REFUNDED</span>}
            </div>
            {(method === 'CASH_ONLINE') && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Split</p>
                <p className="text-white font-bold">Cash {fmt(sale.cashAmount)} + Online {fmt(sale.onlineAmount)}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Items ({items.length})</h4>
            {items.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 font-black uppercase tracking-wider text-[9px] border-b border-gray-700/50">
                    <th className="text-left py-1.5 pr-2">#</th>
                    <th className="text-left px-2">Product</th>
                    <th className="text-left px-2">Color</th>
                    <th className="text-left px-2">Size</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-right px-2">Unit</th>
                    <th className="text-right pl-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 text-gray-500 font-bold">{idx + 1}</td>
                      <td className="px-2 font-bold text-white">
                        {it.productName}
                        {(it.nameEngrave || it.logoDesign) && (
                          <span className="ml-1.5 text-[8px] font-black text-pink-400">
                            {[it.nameEngrave ? 'NAME' : null, it.logoDesign ? 'LOGO' : null].filter(Boolean).join('/')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-gray-400">{it.color || '—'}</td>
                      <td className="px-2 text-gray-400">{it.size || '—'}</td>
                      <td className="px-2 text-right text-gray-300 font-bold">{it.quantity}</td>
                      <td className="px-2 text-right text-gray-400">{fmt(it.unitPrice)}</td>
                      <td className="pl-2 text-right font-black text-emerald-400">{fmt(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-4">No items</p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Items Total</p>
              <p className="text-white font-black">{fmt(itemsTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Discount</p>
              <p className="text-rose-400 font-black">{fmt(discount)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Grand Total</p>
              <p className="text-emerald-400 font-black">{fmt(sale.grandTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Advance</p>
              <p className="text-amber-400 font-black">{fmt(sale.advanceAmount)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Balance Paid</p>
              <p className="text-white font-black">{fmt(balancePaid)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Total Received</p>
              <p className="text-white font-black">{fmt(received)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${remaining > 0.01 ? 'border-red-500/40' : 'border-gray-700/50'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Remaining</p>
              <p className={`font-black ${remaining > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(remaining)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Status</p>
              <p className={`font-black ${remaining > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>{remaining > 0.01 ? 'BALANCE' : 'PAID'}</p>
            </div>
          </div>

          {balancePayments.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Balance Payments ({balancePayments.length})</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 font-black uppercase tracking-wider text-[9px] border-b border-gray-700/50">
                    <th className="text-left py-1.5 pr-2">Date</th>
                    <th className="text-left px-2">Method</th>
                    <th className="text-right pl-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {balancePayments.map((p, idx) => (
                    <tr key={idx} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 text-gray-400">{fmtDate(p.paidAt)} {fmtTime(p.paidAt)}</td>
                      <td className="px-2"><span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-300">{p.paymentMethod || 'CASH'}</span></td>
                      <td className="pl-2 text-right font-black text-emerald-400">{fmt(p.amountPaidNow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {returns.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Returns ({returns.length})</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 font-black uppercase tracking-wider text-[9px] border-b border-gray-700/50">
                    <th className="text-left py-1.5 pr-2">Date</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-left px-2">Method</th>
                    <th className="text-left px-2">Reason</th>
                    <th className="text-right pl-2">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r, idx) => (
                    <tr key={r.id || idx} className="border-b border-gray-800/60">
                      <td className="py-2 pr-2 text-gray-400">{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}</td>
                      <td className="px-2 text-right text-gray-300 font-bold">{r.quantity || '—'}</td>
                      <td className="px-2"><span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{r.refundPaymentMethod || 'CASH'}</span></td>
                      <td className="px-2 text-gray-400 max-w-[180px] truncate">{r.reason || '—'}</td>
                      <td className="pl-2 text-right font-black text-red-400">{fmt(r.refundAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-700/60 px-6 py-3 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const OutletDetailedCard = ({ outlet }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const { range, setRange, dateFrom, setDateFrom, dateTo, setDateTo, label: rangeLabel, queryParams, presets } = useDateRange();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const [returnDetailId, setReturnDetailId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const refreshRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/api/outlet-detailed/${outlet}`, { params: queryParams });
      setData(res.data);
    } catch (e) {
      console.error('Outlet detailed fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [outlet, queryParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    refreshRef.current = setInterval(fetchData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchData]);

  const handleRefresh = () => {
    if (refreshRef.current) clearInterval(refreshRef.current);
    fetchData();
    refreshRef.current = setInterval(fetchData, 30000);
  };

  const summary = data?.overview || {};
  const sales = data?.invoices || [];
  const orders = data?.orders || [];
  const customers = data?.customers || [];
  const inventory = data?.revenueAndInventory?.inventory || {};
  const inventoryItems = data?.revenueAndInventory?.items || [];
  const returns = data?.returns || [];
  const faisalTakes = data?.faisalTakes || [];
  const balancePayments = data?.balancePayments || [];
  const balanceInvoices = data?.balanceInvoices || [];
  const transfers = data?.transfers || [];
  const requests = data?.demandRequests || data?.stockRequests || [];
  const alterations = data?.alterations || [];
  const journalEntries = data?.journalEntries || [];
  const stageWiseTracking = data?.stageWiseTracking || [];
  const paymentSummary = data?.paymentBreakdown || {};
  const salesAnalytics = data?.salesAnalytics || {};
  const orderStatusCounts = summary.orderStatusCounts || {};

  // Faisal Take value derives from its items — grandTotal is stored as 0 for Faisal Takes.
  const ftValue = (ft) => (ft.items || []).reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 0), 0);
  const totalFaisalTakeValue = summary.totalFaisalTakeValue ?? faisalTakes.reduce((s, ft) => s + ftValue(ft), 0);

  const stageTracking = useMemo(() => {
    const map = {};
    stageWiseTracking.forEach(s => { map[s.stage] = s.count || 0; });
    return map;
  }, [stageWiseTracking]);

  const nonFaisalSales = useMemo(() => sales.filter(s => !s.faisalTake), [sales]);

  const filteredSales = useMemo(() => {
    if (!searchTerm) return nonFaisalSales;
    const q = searchTerm.toLowerCase();
    return nonFaisalSales.filter(s =>
      (s.receiptNumber || '').toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.paymentMethod || '').toLowerCase().includes(q) ||
      (s.cashierName || '').toLowerCase().includes(q)
    );
  }, [nonFaisalSales, searchTerm]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(o =>
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.invoiceNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.clientNumber || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventoryItems;
    const q = searchTerm.toLowerCase();
    return inventoryItems.filter(i =>
      (i.productName || i.name || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.color || '').toLowerCase().includes(q) ||
      (i.barcode || '').toLowerCase().includes(q)
    );
  }, [inventoryItems, searchTerm]);

  const filteredAlterations = useMemo(() => {
    if (!searchTerm) return alterations;
    const q = searchTerm.toLowerCase();
    return alterations.filter(a =>
      (a.customerName || '').toLowerCase().includes(q) ||
      (a.alterationNumber || '').toLowerCase().includes(q) ||
      (a.id || '').toString().includes(q)
    );
  }, [alterations, searchTerm]);

  const filteredJournal = useMemo(() => {
    if (!searchTerm) return journalEntries;
    const q = searchTerm.toLowerCase();
    return journalEntries.filter(j =>
      (j.employeeName || '').toLowerCase().includes(q) ||
      (j.expenseTitle || j.title || '').toLowerCase().includes(q) ||
      (j.notes || '').toLowerCase().includes(q)
    );
  }, [journalEntries, searchTerm]);

  const filteredReturns = useMemo(() => {
    if (!searchTerm) return returns;
    const q = searchTerm.toLowerCase();
    return returns.filter(r =>
      (r.sale?.receiptNumber || '').toLowerCase().includes(q) ||
      (r.sale?.customerName || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    );
  }, [returns, searchTerm]);

  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * ITEMS_PER_PAGE;
    return filteredSales.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSales, invoicePage]);
  const totalInvoicePages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, orderPage]);
  const totalOrderPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const start = (customerPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCustomers, customerPage]);
  const totalCustomerPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);

  const paginatedJournal = useMemo(() => {
    const start = (journalPage - 1) * ITEMS_PER_PAGE;
    return filteredJournal.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJournal, journalPage]);
  const totalJournalPages = Math.ceil(filteredJournal.length / ITEMS_PER_PAGE);

  useEffect(() => { setInvoicePage(1); }, [searchTerm]);
  useEffect(() => { setOrderPage(1); }, [searchTerm]);
  useEffect(() => { setCustomerPage(1); }, [searchTerm]);
  useEffect(() => { setJournalPage(1); }, [searchTerm]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  const kpiStats = [
    { label: 'Total Sales', value: fmt(summary.totalSales), color: 'text-emerald-400', icon: TrendingUp },
    { label: 'Net Revenue', value: fmt(summary.netRevenue), color: 'text-green-400', icon: Wallet },
    { label: 'Total Discount', value: fmt(summary.totalDiscount), color: 'text-red-400', icon: Minus },
    { label: 'Returned Products', value: summary.returnCount ?? returns.length, color: 'text-orange-400', icon: RotateCcw },
    { label: 'Total Invoices', value: summary.totalInvoices ?? nonFaisalSales.length, color: 'text-blue-400', icon: FileText },
    { label: 'General Entries', value: summary.totalJournalExpenses != null ? fmt(summary.totalJournalExpenses) : fmt(journalEntries.reduce((s, j) => s + (j.amount || 0), 0)), color: 'text-pink-400', icon: BookOpen },
    { label: 'Completed Orders', value: orderStatusCounts.completed + orderStatusCounts.delivered || 0, color: 'text-emerald-400', icon: CheckCircle },
    { label: 'Pending Orders', value: orderStatusCounts.pending + orderStatusCounts.inProgress + orderStatusCounts.waitingPayment || 0, color: 'text-yellow-400', icon: Clock },
  ];

  const salesTrend = salesAnalytics.salesTrend || [];
  const maxTrend = Math.max(...salesTrend.map(d => d.sales || d.count || 0), 1);

  const totalAllPayments = Object.values(paymentSummary).reduce((s, m) => s + (m.net || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-black text-white uppercase">{outlet}</h2>
        <span className="text-xs font-bold text-gray-500">360 Degree Operational Dashboard</span>
        <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{rangeLabel}</span>
        <button onClick={handleRefresh} disabled={loading}
          className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-all">
          {loading ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 glass rounded-2xl border border-gray-700/50">
        {presets.map(opt => (
          <button key={opt.key} onClick={() => { setRange(opt.key); setDateFrom(''); setDateTo(''); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${range === opt.key ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-indigo-500/20'}`}>
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <Calendar size={12} className="text-gray-500" />
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setRange('custom'); }}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-300 w-28" />
          <span className="text-gray-600 text-[10px]">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setRange('custom'); }}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-300 w-28" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {sectionNav.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${activeSection === s.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-indigo-500/20'}`}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search across all sections..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-xs font-bold text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50" />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <LayoutDashboard size={16} className="text-indigo-400" /> Key Performance Indicators
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiStats.map(card => (
                <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <card.icon size={14} className={card.color} />
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{card.label}</p>
                  </div>
                  <p className="text-white font-black text-xl">{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Sales Trend
            </h3>
            {salesTrend.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {salesTrend.slice(-14).map((d, i) => {
                  const val = d.sales || d.count || 0;
                  const h = maxTrend > 0 ? (val / maxTrend) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-indigo-400">{val > 0 ? (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)) : ''}</span>
                      <div className="w-full bg-gray-800 rounded-t-lg overflow-hidden" style={{ height: `${Math.max(h, 2)}%` }}>
                        <div className="w-full h-full bg-indigo-500 rounded-t-lg" />
                      </div>
                      <span className="text-[7px] font-bold text-gray-500 truncate w-full text-center">{fmtShortDate(d.date || d.label)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No trend data</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== PAYMENTS ==================== */}
      {activeSection === 'payments' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-400" /> Payment Method Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'CASH', label: 'Cash', dotClass: 'bg-emerald-500', netClass: 'text-emerald-400' },
                { key: 'CARD', label: 'Card', dotClass: 'bg-purple-500', netClass: 'text-purple-400' },
                { key: 'ONLINE', label: 'Online', dotClass: 'bg-blue-500', netClass: 'text-blue-400' },
              ].map(m => {
                const ps = paymentSummary[m.key] || { gross: 0, returns: 0, net: 0 };
                return (
                  <div key={m.key} className="glass rounded-2xl p-5 border-2 border-gray-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${m.dotClass}`} />
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{m.label}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-gray-500">Gross</span>
                        <span className="text-white font-black text-sm">{fmt(ps.gross)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-gray-500">Returns</span>
                        <span className="text-red-400 font-black text-sm">-{fmt(ps.returns)}</span>
                      </div>
                      <div className="border-t border-gray-700/50 pt-2 flex justify-between">
                        <span className="text-[10px] font-bold text-gray-500">Net</span>
                        <span className={`${m.netClass} font-black text-lg`}>{fmt(ps.net)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-400" /> Payment Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4 border border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Gross</p>
                <p className="text-white font-black text-lg">{fmt(Object.values(paymentSummary).reduce((s, m) => s + (m.gross || 0), 0))}</p>
              </div>
              <div className="glass rounded-xl p-4 border border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Returns</p>
                <p className="text-red-400 font-black text-lg">-{fmt(data?.totalRefunds || Object.values(paymentSummary).reduce((s, m) => s + (m.returns || 0), 0))}</p>
              </div>
              <div className="glass rounded-xl p-4 border border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase mb-1">Total Net</p>
                <p className="text-emerald-400 font-black text-lg">{fmt(totalAllPayments)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SALES ANALYTICS ==================== */}
      {activeSection === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Highest Sale of the Day</p>
              {salesAnalytics.highestSale ? (
                <div>
                  <p className="text-white font-black text-lg">{fmt(salesAnalytics.highestSale.amount)}</p>
                  <p className="text-gray-500 text-xs font-bold">{salesAnalytics.highestSale.receiptNumber || '—'}</p>
                </div>
              ) : (
                <p className="text-gray-600 text-xs font-bold">No sales in this period</p>
              )}
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">Highest Value Invoice</p>
              {salesAnalytics.highestInvoice ? (
                <div>
                  <p className="text-white font-black text-lg">{fmt(salesAnalytics.highestInvoice.amount)}</p>
                  <p className="text-gray-500 text-xs font-bold">{salesAnalytics.highestInvoice.receiptNumber || '—'}</p>
                  <p className="text-gray-500 text-[10px] font-bold">{salesAnalytics.highestInvoice.customerName || 'Walk-in'}</p>
                </div>
              ) : (
                <p className="text-gray-600 text-xs font-bold">No invoices in this period</p>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Top Selling Products
            </h3>
            {(salesAnalytics.bestSellingProducts || []).length > 0 ? (
              <div className="space-y-2">
                {salesAnalytics.bestSellingProducts.slice(0, 10).map((p, i) => {
                  const maxRev = salesAnalytics.bestSellingProducts[0]?.revenue || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-500 w-5 shrink-0">#{i + 1}</span>
                      <span className="text-xs font-bold text-white w-32 shrink-0 truncate">{p.name || p.productName}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-lg" style={{ width: `${((p.revenue || 0) / maxRev) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 w-16 text-right shrink-0">{fmt(p.revenue)}</span>
                      <span className="text-[10px] font-bold text-gray-500 w-10 text-right shrink-0">{p.qty || 0} qty</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No product data in this period</p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Sales Trend (by Date)
            </h3>
            {salesTrend.length > 0 ? (
              <div className="flex items-end gap-1 h-36">
                {salesTrend.slice(-14).map((d, i) => {
                  const val = d.sales || d.revenue || d.count || 0;
                  const h = maxTrend > 0 ? (val / maxTrend) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[7px] font-black text-indigo-400">{val > 0 ? (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)) : ''}</span>
                      <div className="w-full bg-gray-800 rounded-t-lg overflow-hidden" style={{ height: `${Math.max(h, 2)}%` }}>
                        <div className="w-full h-full bg-indigo-500 rounded-t-lg" />
                      </div>
                      <span className="text-[7px] font-bold text-gray-500 truncate w-full text-center">{fmtShortDate(d.date || d.label)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No trend data</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== BALANCE ==================== */}
      {activeSection === 'balance' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wallet size={16} className="text-amber-400" /> Outstanding Balance
            </h3>
            <div className="glass rounded-xl p-4 border border-amber-500/20 text-center mb-4">
              <p className="text-amber-400 font-black text-2xl">{fmt(balanceInvoices.reduce((s, inv) => s + (inv.remaining || 0), 0))}</p>
              <p className="text-gray-500 text-[10px] font-bold uppercase mt-1">{balanceInvoices.length} Invoice{balanceInvoices.length !== 1 ? 's' : ''} with Outstanding Balance</p>
            </div>
            {balanceInvoices.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Invoice #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Grand Total</th>
                    <th className="text-right px-2">Paid</th>
                    <th className="text-right pl-2">Remaining</th>
                  </tr></thead>
                  <tbody>
                    {balanceInvoices.map((inv, i) => {
                      return (
                        <tr key={inv.id || i} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-2 font-bold text-white">{inv.receiptNumber || '—'}</td>
                          <td className="px-2 font-bold text-gray-300">{inv.customerName || 'Walk-in'}</td>
                          <td className="px-2 text-right font-black text-white">{fmt(inv.grandTotal)}</td>
                          <td className="px-2 text-right font-black text-emerald-400">{fmt(inv.totalPaid)}</td>
                          <td className="pl-2 text-right font-black text-red-400">{fmt(inv.remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No outstanding balances</p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet size={16} className="text-amber-400" /> Balance Payments Collected ({balancePayments.length})
            </h3>
            {balancePayments.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Receipt</th>
                    <th className="text-left px-2">Original Invoice</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Amount</th>
                    <th className="text-right px-2">Method</th>
                    <th className="text-right px-2">Cashier</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {balancePayments.map((bp, i) => (
                      <tr key={bp.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{bp.receiptNumber || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{bp.originalInvoiceNumber || bp.posSale?.receiptNumber || '—'}</td>
                        <td className="px-2 text-gray-300">{bp.posSale?.customerName || '—'}</td>
                        <td className="px-2 text-right font-black text-emerald-400">{fmt(bp.amountPaidNow)}</td>
                        <td className="px-2 text-right text-gray-300">{bp.paymentMethod || '—'}</td>
                        <td className="px-2 text-right text-gray-300">{bp.cashierName || '—'}</td>
                        <td className="pl-2 text-right text-gray-400">{fmtDate(bp.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No balance payments collected in this period</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== FAISAL TAKES ==================== */}
      {activeSection === 'faisal-takes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Takes</p>
              <p className="text-white font-black text-xl">{faisalTakes.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Value</p>
              <p className="text-indigo-400 font-black text-xl">{fmt(totalFaisalTakeValue)}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <User size={16} className="text-indigo-400" /> Faisal Takes History ({faisalTakes.length})
            </h3>
            {faisalTakes.length > 0 ? (
              <div className="space-y-2">
                {faisalTakes.map((ft, i) => (
                  <div key={ft.id || i} className="glass rounded-xl border border-gray-700/50 overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5" onClick={() => setExpandedId(expandedId === `ft-${i}` ? null : `ft-${i}`)}>
                      <div className="flex items-center gap-3">
                        <span className={`transition-transform ${expandedId === `ft-${i}` ? 'rotate-90' : ''}`}>
                          <ChevronRight size={14} className="text-gray-500" />
                        </span>
                        <div>
                          <p className="text-xs font-black text-white">{ft.receiptNumber || '—'}</p>
                          <p className="text-[10px] font-bold text-gray-500">{ft.cashierName || '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-indigo-400">{fmt(ftValue(ft))}</p>
                        <p className="text-[10px] font-bold text-gray-500">{fmtDate(ft.createdAt)} {fmtTime(ft.createdAt)}</p>
                      </div>
                    </div>
                    {expandedId === `ft-${i}` && (ft.items || []).length > 0 && (
                      <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                        <table className="w-full text-[10px]">
                          <thead><tr className="text-gray-500 font-black uppercase">
                            <th className="text-left py-1">Product</th>
                            <th className="text-left px-2">Qty</th>
                            <th className="text-left px-2">Size</th>
                            <th className="text-left px-2">Color</th>
                            <th className="text-right pl-2">Price</th>
                          </tr></thead>
                          <tbody>
                            {ft.items.map((item, j) => (
                              <tr key={j} className="border-t border-gray-800">
                                <td className="py-1 font-bold text-white">{item.productName || '—'}</td>
                                <td className="px-2 text-gray-300">{item.quantity || 0}</td>
                                <td className="px-2 text-gray-300">{item.size || '—'}</td>
                                <td className="px-2 text-gray-300">{item.color || '—'}</td>
                                <td className="pl-2 text-right font-bold text-indigo-400">{fmt((item.unitPrice || 0) * (item.quantity || 1))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No Faisal takes recorded</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== RETURNS ==================== */}
      {activeSection === 'returns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Returns</p>
              <p className="text-white font-black text-xl">{returns.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Refunded</p>
              <p className="text-red-400 font-black text-xl">{fmt(returns.reduce((s, r) => s + (r.refundAmount || 0), 0))}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Items Returned</p>
              <p className="text-orange-400 font-black text-xl">{returns.reduce((s, r) => s + (r.quantity || 1), 0)}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <RotateCcw size={16} className="text-red-400" /> Return History ({filteredReturns.length})
            </h3>
            {filteredReturns.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Invoice #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-left px-2">Product(s)</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-right px-2">Refund</th>
                    <th className="text-left px-2">Reason</th>
                    <th className="text-left px-2">Payment</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {filteredReturns.map((r, i) => {
                      const sale = r.sale || {};
                      const saleItems = sale.items || [];
                      const productNames = saleItems.length > 0
                        ? saleItems.map(it => `${it.productName || '—'}${it.color ? ` (${it.color})` : ''}${it.size ? ` [${it.size}]` : ''}`).join(', ')
                        : '—';
                      return (
                        <tr key={r.id || i} className="border-t border-gray-800 hover:bg-white/5 cursor-pointer" onClick={() => setReturnDetailId(returnDetailId === r.id ? null : r.id)}>
                          <td className="py-2 pr-2 font-bold text-white">{sale.receiptNumber || '—'}</td>
                          <td className="px-2 font-bold text-gray-300">{sale.customerName || 'Walk-in'}</td>
                          <td className="px-2 text-gray-300 max-w-[200px] truncate">{productNames}</td>
                          <td className="px-2 text-right font-bold text-gray-300">{r.quantity || 1}</td>
                          <td className="px-2 text-right font-black text-red-400">{fmt(r.refundAmount)}</td>
                          <td className="px-2 text-gray-400 max-w-[120px] truncate">{r.reason || '—'}</td>
                          <td className="px-2 font-bold text-gray-300">{r.refundPaymentMethod || sale.paymentMethod || '—'}</td>
                          <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No returns recorded</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== INVOICES ==================== */}
      {activeSection === 'invoices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Invoices</p>
              <p className="text-white font-black text-xl">{nonFaisalSales.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Faisal Takes</p>
              <p className="text-indigo-400 font-black text-xl">{sales.length - nonFaisalSales.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Sales</p>
              <p className="text-emerald-400 font-black text-xl">{fmt(summary.totalSales)}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" /> All Invoices ({filteredSales.length})
            </h3>
            {filteredSales.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Invoice #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Amount</th>
                    <th className="text-left px-2">Payment</th>
                    <th className="text-left px-2">Cashier</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {paginatedInvoices.map((s, i) => (
                      <tr key={s.id || i} onClick={() => setSelectedInvoice(selectedInvoice?.id === s.id ? null : s)}
                        className={`border-t border-gray-800 hover:bg-white/5 cursor-pointer transition-all ${selectedInvoice?.id === s.id ? 'bg-indigo-500/10' : ''}`}>
                        <td className="py-2 pr-2 font-bold text-white flex items-center gap-1.5">
                          {s.receiptNumber || '—'}
                          {s.refundedAt && <span className="text-[8px] font-black px-1 py-0.5 rounded bg-red-500/20 text-red-400">REFUNDED</span>}
                        </td>
                        <td className="px-2 font-bold text-gray-300">{s.customerName || 'Walk-in'}</td>
                        <td className="px-2 text-right font-black text-emerald-400">{fmt(saleRevenue(s))}</td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${s.paymentMethod === 'CASH' ? 'bg-emerald-500/20 text-emerald-400' : s.paymentMethod === 'CARD' ? 'bg-purple-500/20 text-purple-400' : s.paymentMethod === 'ONLINE' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{s.paymentMethod || 'CASH'}</span>
                        </td>
                        <td className="px-2 text-[10px] font-bold text-gray-500">{s.cashierName || '—'}</td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(s.createdAt)} {fmtTime(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No invoices found</p>
            )}
            <Pagination currentPage={invoicePage} totalPages={totalInvoicePages} onPageChange={setInvoicePage} />
          </div>
        </div>
      )}

      {/* ==================== ORDERS ==================== */}
      {activeSection === 'orders' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: orderStatusCounts.total || orders.length, color: 'text-white' },
              { label: 'Pending', value: orderStatusCounts.pending || 0, color: 'text-yellow-400' },
              { label: 'In Progress', value: orderStatusCounts.inProgress || 0, color: 'text-blue-400' },
              { label: 'Completed', value: orderStatusCounts.completed || 0, color: 'text-emerald-400' },
              { label: 'Delivered', value: orderStatusCounts.delivered || 0, color: 'text-green-400' },
              { label: 'Cancelled', value: orderStatusCounts.cancelled || 0, color: 'text-red-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-4 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-lg ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-indigo-400" /> All Orders ({filteredOrders.length})
            </h3>
            {filteredOrders.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Order #</th>
                    <th className="text-left px-2">Invoice #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Amount</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-left px-2">Stage</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {paginatedOrders.map((o, i) => {
                      const st = (o.status || '').toUpperCase();
                      const stColor = st === 'DELIVERED' ? 'text-green-400 bg-green-500/20' : st === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/20' : st === 'CANCELLED' || st === 'REJECTED' ? 'text-red-400 bg-red-500/20' : st === 'IN_PROGRESS' ? 'text-blue-400 bg-blue-500/20' : 'text-yellow-400 bg-yellow-500/20';
                      return (
                        <tr key={o.id || i} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-2 font-bold text-white">{o.orderNumber || '—'}</td>
                          <td className="px-2 font-bold text-gray-400">{o.invoiceNumber || '—'}</td>
                          <td className="px-2 font-bold text-gray-300">{o.customerName || '—'}</td>
                          <td className="px-2 text-right font-black text-emerald-400">{fmt(o.totalPrice)}</td>
                          <td className="px-2"><span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${stColor}`}>{o.status || 'PENDING'}</span></td>
                          <td className="px-2 text-[10px] font-bold text-gray-500">{o.currentStage || '—'}</td>
                          <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(o.createdAt)} {fmtTime(o.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No orders found</p>
            )}
            <Pagination currentPage={orderPage} totalPages={totalOrderPages} onPageChange={setOrderPage} />
          </div>
        </div>
      )}

      {/* ==================== ORDER TRACKING ==================== */}
      {activeSection === 'tracking' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" /> Order Status Distribution
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Pending', value: orderStatusCounts.pending || 0, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
                { label: 'In Progress', value: orderStatusCounts.inProgress || 0, color: 'text-blue-400', bg: 'bg-blue-500/20' },
                { label: 'Completed', value: orderStatusCounts.completed || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
                { label: 'Delivered', value: orderStatusCounts.delivered || 0, color: 'text-green-400', bg: 'bg-green-500/20' },
                { label: 'Cancelled', value: orderStatusCounts.cancelled || 0, color: 'text-red-400', bg: 'bg-red-500/20' },
                { label: 'Waiting Payment', value: orderStatusCounts.waitingPayment || 0, color: 'text-purple-400', bg: 'bg-purple-500/20' },
                { label: 'Total Orders', value: orderStatusCounts.total || orders.length, color: 'text-white', bg: 'bg-white/10' },
                { label: 'Active', value: (orderStatusCounts.pending || 0) + (orderStatusCounts.inProgress || 0) + (orderStatusCounts.waitingPayment || 0), color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
              ].map(c => (
                <div key={c.label} className={`glass rounded-xl p-4 border border-gray-700/50 text-center ${c.bg}`}>
                  <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1">{c.label}</p>
                  <p className={`font-black text-xl ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" /> Pipeline (Active Orders per Stage)
            </h3>
            {stageWiseTracking.length > 0 ? (
              <div className="space-y-3">
                {stageWiseTracking.map((s, i) => {
                  const maxCount = Math.max(...stageWiseTracking.map(st => st.count || 0), 1);
                  const w = ((s.count || 0) / maxCount) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-400 w-32 shrink-0 text-right">{s.label || s.stage}</span>
                      <div className="flex-1 h-6 bg-gray-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-lg flex items-center pl-2" style={{ width: `${Math.max(w, 4)}%` }}>
                          <span className="text-[9px] font-black text-white">{s.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No active orders in pipeline</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== INVENTORY ==================== */}
      {activeSection === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Products', value: inventory.total || 0, color: 'text-white' },
              { label: 'In Stock', value: inventory.inStock || 0, color: 'text-emerald-400' },
              { label: 'Low Stock', value: inventory.lowStock || 0, color: 'text-yellow-400' },
              { label: 'Out of Stock', value: inventory.outOfStock || 0, color: 'text-red-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-xl ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} className="text-indigo-400" /> Inventory Items ({filteredInventory.length})
            </h3>
            {filteredInventory.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Product</th>
                    <th className="text-left px-2">Category</th>
                    <th className="text-left px-2">Color</th>
                    <th className="text-left px-2">Size</th>
                    <th className="text-right px-2">Stock</th>
                    <th className="text-right px-2">Price</th>
                    <th className="text-right pl-2">Value</th>
                  </tr></thead>
                  <tbody>
                    {filteredInventory.map((item, i) => (
                      <tr key={item.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{item.name || '—'}</td>
                        <td className="px-2 font-bold text-gray-400">{item.category || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{item.color || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{item.size || '—'}</td>
                        <td className="px-2 text-right font-black">
                          <span className={(item.stock || 0) === 0 ? 'text-red-400' : (item.stock || 0) <= 5 ? 'text-yellow-400' : 'text-emerald-400'}>{item.stock || 0}</span>
                        </td>
                        <td className="px-2 text-right font-bold text-gray-300">{fmt(item.price)}</td>
                        <td className="pl-2 text-right font-black text-indigo-400">{fmt((item.stock || 0) * (item.price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No inventory items</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== CUSTOMERS ==================== */}
      {activeSection === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Registered Clients</p>
              <p className="text-white font-black text-xl">{customers.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Male Clients</p>
              <p className="text-blue-400 font-black text-xl">{customers.filter(c => (c.gender || '').toUpperCase() === 'MALE').length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Female Clients</p>
              <p className="text-pink-400 font-black text-xl">{customers.filter(c => (c.gender || '').toUpperCase() === 'FEMALE').length}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} className="text-indigo-400" /> Registered Clients ({filteredCustomers.length})
            </h3>
            {filteredCustomers.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Client #</th>
                    <th className="text-left px-2">Name</th>
                    <th className="text-left px-2">Phone</th>
                    <th className="text-left px-2">Gender</th>
                    <th className="text-left px-2">City</th>
                    <th className="text-right px-2">Orders</th>
                    <th className="text-right pl-2">Registered</th>
                  </tr></thead>
                  <tbody>
                    {paginatedCustomers.map((c, i) => (
                      <tr key={c.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{c.clientNumber || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{c.name || '—'}</td>
                        <td className="px-2">
                          <span className="flex items-center gap-1 text-gray-300">
                            <Phone size={10} className="text-gray-600" />{c.phone || '—'}
                          </span>
                        </td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${(c.gender || '').toUpperCase() === 'MALE' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>{c.gender || '—'}</span>
                        </td>
                        <td className="px-2 font-bold text-gray-400">{c.city || '—'}</td>
                        <td className="px-2 text-right font-black text-indigo-400">{c._count?.Order || 0}</td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No registered clients</p>
            )}
            <Pagination currentPage={customerPage} totalPages={totalCustomerPages} onPageChange={setCustomerPage} />
          </div>
        </div>
      )}

      {/* ==================== TRANSFERS ==================== */}
      {activeSection === 'transfers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total', value: transfers.length, color: 'text-white' },
              { label: 'Incoming', value: transfers.filter(t => t.toOutlet === outlet).length, color: 'text-emerald-400' },
              { label: 'Outgoing', value: transfers.filter(t => t.fromOutlet === outlet).length, color: 'text-amber-400' },
              { label: 'Pending', value: transfers.filter(t => t.status === 'PENDING').length, color: 'text-yellow-400' },
              { label: 'Completed', value: transfers.filter(t => t.status === 'COMPLETED' || t.status === 'ACCEPTED').length, color: 'text-blue-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-xl ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-indigo-400" /> Transfer History ({transfers.length})
            </h3>
            {transfers.length > 0 ? (
              <div className="space-y-2">
                {transfers.map((t, i) => (
                  <div key={t.id || i} className="glass rounded-xl border border-gray-700/50 overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5" onClick={() => setExpandedId(expandedId === `tf-${i}` ? null : `tf-${i}`)}>
                      <div className="flex items-center gap-3">
                        <span className={`transition-transform ${expandedId === `tf-${i}` ? 'rotate-90' : ''}`}>
                          <ChevronRight size={14} className="text-gray-500" />
                        </span>
                        <div>
                          <p className="text-xs font-black text-white">{t.transferNumber || t.id || '—'}</p>
                          <p className="text-[10px] font-bold text-gray-500">{t.fromOutlet || '—'} → {t.toOutlet || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">{(t.items || []).length || t.totalItems || 0} items</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${t.status === 'COMPLETED' || t.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : t.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{t.status || 'PENDING'}</span>
                        <span className="text-[10px] font-bold text-gray-500">{fmtDate(t.createdAt)}</span>
                      </div>
                    </div>
                    {expandedId === `tf-${i}` && (t.items || []).length > 0 && (
                      <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                        <table className="w-full text-[10px]">
                          <thead><tr className="text-gray-500 font-black uppercase">
                            <th className="text-left py-1">Product</th>
                            <th className="text-left px-2">Color</th>
                            <th className="text-left px-2">Size</th>
                            <th className="text-right pl-2">Qty</th>
                          </tr></thead>
                          <tbody>
                            {t.items.map((item, j) => (
                              <tr key={j} className="border-t border-gray-800">
                                <td className="py-1 font-bold text-white">{item.productName || item.name || '—'}</td>
                                <td className="px-2 text-gray-300">{item.color || '—'}</td>
                                <td className="px-2 text-gray-300">{item.size || '—'}</td>
                                <td className="pl-2 text-right font-bold text-indigo-400">{item.quantity || item.qty || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No transfer records</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== REQUESTS ==================== */}
      {activeSection === 'requests' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: requests.length, color: 'text-white' },
              { label: 'Pending', value: requests.filter(r => r.status === 'PENDING').length, color: 'text-yellow-400' },
              { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED' || r.status === 'ACCEPTED').length, color: 'text-emerald-400' },
              { label: 'Rejected', value: requests.filter(r => r.status === 'REJECTED').length, color: 'text-red-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-xl ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ClipboardList size={16} className="text-indigo-400" /> Demand Request History ({requests.length})
            </h3>
            {requests.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Request #</th>
                    <th className="text-left px-2">Items</th>
                    <th className="text-right px-2">Requested Qty</th>
                    <th className="text-right px-2">Approved Qty</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-left px-2">Notes</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {requests.map((r, i) => {
                      const items = Array.isArray(r.items) ? r.items : [];
                      const reqQty = items.reduce((s, it) => s + (parseInt(it.requestedQty) || 0), 0);
                      const appQty = items.reduce((s, it) => s + (parseInt(it.approvedQty) || 0), 0);
                      return (
                        <tr key={r.id || i} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-2 font-black text-indigo-400">{r.transferNumber || '—'}</td>
                          <td className="px-2 font-bold text-white">{items.length}</td>
                          <td className="px-2 text-right font-bold text-gray-300">{reqQty}</td>
                          <td className="px-2 text-right font-bold text-emerald-400">{appQty || '—'}</td>
                          <td className="px-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : r.status === 'PARTIALLY_APPROVED' ? 'bg-blue-500/20 text-blue-400' : r.status === 'ACCEPTED' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{r.status || 'PENDING'}</span>
                          </td>
                          <td className="px-2 text-gray-500 max-w-[160px] truncate">{r.notes || r.storeNotes || '—'}</td>
                          <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(r.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No request records</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== ALTERATIONS ==================== */}
      {activeSection === 'alterations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {[
              { label: 'Total', value: alterations.length, color: 'text-white' },
              { label: 'Pending', value: alterations.filter(a => a.status === 'PENDING').length, color: 'text-yellow-400' },
              { label: 'Accepted', value: alterations.filter(a => a.status === 'ACCEPTED').length, color: 'text-blue-400' },
              { label: 'In Progress', value: alterations.filter(a => a.status === 'IN_PROGRESS').length, color: 'text-indigo-400' },
              { label: 'Completed', value: alterations.filter(a => a.status === 'COMPLETED').length, color: 'text-emerald-400' },
              { label: 'Done', value: alterations.filter(a => a.status === 'DONE').length, color: 'text-green-400' },
              { label: 'Rejected', value: alterations.filter(a => a.status === 'REJECTED').length, color: 'text-red-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-4 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-lg ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Scissors size={16} className="text-indigo-400" /> Alteration History ({filteredAlterations.length})
            </h3>
            {filteredAlterations.length > 0 ? (
              <div className="space-y-2">
                {filteredAlterations.map((a, i) => (
                  <div key={a.id || i} className="glass rounded-xl border border-gray-700/50 overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5" onClick={() => setExpandedId(expandedId === `alt-${i}` ? null : `alt-${i}`)}>
                      <div className="flex items-center gap-3">
                        <span className={`transition-transform ${expandedId === `alt-${i}` ? 'rotate-90' : ''}`}>
                          <ChevronRight size={14} className="text-gray-500" />
                        </span>
                        <div>
                          <p className="text-xs font-black text-white">{a.alterationNumber || `#${(a.id || '').slice(0, 8)}`}</p>
                          <p className="text-[10px] font-bold text-gray-500">{a.customerName || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${a.status === 'COMPLETED' || a.status === 'DONE' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : a.status === 'IN_PROGRESS' ? 'bg-indigo-500/20 text-indigo-400' : a.status === 'ACCEPTED' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{a.status || 'PENDING'}</span>
                        <span className="text-[10px] font-bold text-gray-500">{fmtDate(a.createdAt)}</span>
                      </div>
                    </div>
                    {expandedId === `alt-${i}` && (
                      <div className="border-t border-gray-800 p-3 bg-gray-900/30">
                        {(a.products || []).length > 0 ? (
                          <table className="w-full text-[10px]">
                            <thead><tr className="text-gray-500 font-black uppercase">
                              <th className="text-left py-1">Product</th>
                              <th className="text-left px-2">Description</th>
                              <th className="text-right pl-2">Price</th>
                            </tr></thead>
                            <tbody>
                              {(a.products || []).map((p, j) => (
                                <tr key={j} className="border-t border-gray-800">
                                  <td className="py-1 font-bold text-white">{p.productName || p.name || '—'}</td>
                                  <td className="px-2 text-gray-300">{p.description || p.notes || '—'}</td>
                                  <td className="pl-2 text-right font-bold text-indigo-400">{fmt(p.price || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-[10px] text-gray-500 font-bold">No product details available</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No alteration records</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== GENERAL ENTRIES (JOURNAL) ==================== */}
      {activeSection === 'journal' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Entries', value: filteredJournal.length, color: 'text-white' },
              { label: 'Total Deducted', value: fmt(filteredJournal.reduce((s, j) => s + (j.amount || 0), 0)), color: 'text-red-400' },
              { label: 'Unique Employees', value: [...new Set(filteredJournal.map(j => j.employeeName))].filter(Boolean).length, color: 'text-indigo-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-xl ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-400" /> General Entries ({filteredJournal.length})
            </h3>
            {filteredJournal.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const grouped = {};
                  paginatedJournal.forEach(j => {
                    const emp = j.employeeName || 'Unknown';
                    if (!grouped[emp]) grouped[emp] = [];
                    grouped[emp].push(j);
                  });
                  return Object.entries(grouped).map(([emp, entries]) => (
                    <div key={emp}>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 mt-3">{emp} ({entries.length} entries - {fmt(entries.reduce((s, e) => s + (e.amount || 0), 0))})</p>
                      {entries.map((j, i) => (
                        <div key={j.id || i} className="glass rounded-xl p-3 border border-gray-700/50 mb-2 hover:bg-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-white">{j.expenseTitle || j.title || '—'}</p>
                              <p className="text-[10px] font-bold text-gray-500">{j.notes || '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-red-400">-{fmt(j.amount)}</p>
                              <p className="text-[10px] font-bold text-gray-500">{fmtDate(j.createdAt)} {fmtTime(j.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
                <Pagination currentPage={journalPage} totalPages={totalJournalPages} onPageChange={setJournalPage} />
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No journal entries found</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== REGISTER HISTORY ==================== */}
      {activeSection === 'registers' && (
        <div className="space-y-4">
          <OutletRegisters outlet={outlet} />
        </div>
      )}

      {/* ==================== BANK DEPOSITS ==================== */}
      {activeSection === 'bank-deposits' && (
        <BankDepositsSection outlet={outlet} />
      )}
      <InvoiceDetailModal sale={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
};

const BankDepositsSection = ({ outlet }) => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState({ totalAmount: 0, count: 0, todayAmount: 0, todayCount: 0, monthAmount: 0, monthCount: 0 });

  const { range, setRange, dateFrom, setDateFrom, dateTo, setDateTo, start, end, label, presets } = useDateRange({ initialRange: 'today' });

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const fromISO = start ? pktDayISO(start) : '';
      const toISO = end ? pktDayISO(end) : '';
      if (fromISO) params.set('dateFrom', fromISO);
      if (toISO) params.set('dateTo', toISO);
      if (search) params.set('search', search);
      const res = await api.get(`/api/bank-deposit/deposits/${encodeURIComponent(outlet)}?${params.toString()}`);
      setDeposits(res.data.deposits || []);
      setSummary({
        totalAmount: res.data.totalAmount || 0,
        count: res.data.count || 0,
        todayAmount: res.data.todayAmount || 0,
        todayCount: res.data.todayCount || 0,
        monthAmount: res.data.monthAmount || 0,
        monthCount: res.data.monthCount || 0,
      });
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
    } finally {
      setLoading(false);
    }
  }, [outlet, start, end, search]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleClearFilters = () => {
    setRange('today');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase">Today's Deposits</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{fmt(summary.todayAmount)}</p>
          <p className="text-[10px] text-gray-500">{summary.todayCount} deposit{summary.todayCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase">This Month</p>
          <p className="text-xl font-black text-blue-400 mt-1">{fmt(summary.monthAmount)}</p>
          <p className="text-[10px] text-gray-500">{summary.monthCount} deposit{summary.monthCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
          <p className="text-[10px] text-gray-500 font-bold uppercase">All Time Total</p>
          <p className="text-xl font-black text-purple-400 mt-1">{fmt(summary.totalAmount)}</p>
          <p className="text-[10px] text-gray-500">{summary.count} deposit{summary.count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 glass rounded-2xl border border-gray-700/50">
        {presets.map(opt => (
          <button key={opt.key} onClick={() => { setRange(opt.key); setDateFrom(''); setDateTo(''); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${range === opt.key ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-indigo-500/20'}`}>
            {opt.label}
          </button>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <Calendar size={12} className="text-gray-500" />
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setRange('custom'); }}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-300 w-28" />
          <span className="text-gray-600 text-[10px]">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setRange('custom'); }}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-300 w-28" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search slip # or employee..."
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 transition-all" />
        </div>
        {(search || range !== 'today') && (
          <button onClick={handleClearFilters}
            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all">
            <X size={12} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8"><RefreshCw size={16} className="animate-spin text-gray-500 mx-auto" /></div>
      ) : deposits.length === 0 ? (
        <div className="text-center py-8">
          <Landmark size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-bold">No deposits found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 font-bold uppercase">Slip #</th>
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 font-bold uppercase">Employee</th>
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 font-bold uppercase">Date</th>
                <th className="text-right py-2 px-3 text-[10px] text-gray-500 font-bold uppercase">Amount</th>
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 font-bold uppercase">Notes</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map(d => (
                <tr key={d.id} className="border-b border-gray-700/20 hover:bg-gray-800/30 transition-all">
                  <td className="py-2.5 px-3 font-black text-emerald-400">{d.slipNumber}</td>
                  <td className="py-2.5 px-3 font-bold text-white">{d.employeeName}</td>
                  <td className="py-2.5 px-3 text-gray-400">{fmtDate(d.createdAt)} {fmtTime(d.createdAt)}</td>
                  <td className="py-2.5 px-3 text-right font-black text-white">{fmt(d.amount)}</td>
                  <td className="py-2.5 px-3 text-gray-500 max-w-[150px] truncate">{d.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OutletDetailedCard;
