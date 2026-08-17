import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { debounce } from '../utils/debounce';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';
import { formatDateTime, formatDateOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';
import {
  DollarSign, ShoppingCart, RefreshCw, TrendingUp, TrendingDown, RotateCcw,
  CheckCircle, Clock, XCircle, CreditCard, Globe, Award, Package,
  AlertTriangle, BarChart3, Download, Printer, FileText, User, Wallet, History
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const OutletPOSDashboard = ({ outlet }) => {
  const { isUrdu } = useLanguage();
  const [range, setRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cashier, setCashier] = useState('');
  const [employees, setEmployees] = useState([]);
  const cacheVersion = useRef('v3');

  useEffect(() => {
    api.get(`/api/pos/employees?outlet=${outlet}`).then(r => setEmployees(r.data)).catch(() => {});
  }, [outlet]);

  const dashboardKey = `pos:dashboard:${cacheVersion.current}:${outlet}:${range}:${dateFrom}:${dateTo}`;
  const salesKey = `pos:sales:${cacheVersion.current}:${outlet}`;

  const { data: dashboard = null, loading, error, refresh } = useCache(dashboardKey, {
    fetcher: () => api.get('/api/pos/sales/dashboard', {
      params: { outlet, range, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, cashier: cashier || undefined }
    }).then(r => r.data),
    ttl: 30000,
  });

  const { data: sales = [] } = useCache(`${salesKey}:range:all::`, {
    fetcher: () => api.get(`/api/pos/sales?outlet=${outlet}`).then(r => r.data),
    ttl: 5 * 60 * 1000,
  });

  const [journalEntries, setJournalEntries] = useState([]);
  const [cashSummary, setCashSummary] = useState(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const journalRef = useRef(null);

  const fetchJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const [entriesRes, cashRes] = await Promise.all([
        api.get(`/api/journal?outlet=${outlet}`),
        api.get(`/api/journal/cash-summary?outlet=${outlet}`)
      ]);
      setJournalEntries(entriesRes.data);
      setCashSummary(cashRes.data);
    } catch (e) {
      console.error('Journal/ cash fetch error:', e);
    } finally {
      setJournalLoading(false);
    }
  }, [outlet]);

  const [clearedBalances, setClearedBalances] = useState(null);
  const [clearedLoading, setClearedLoading] = useState(false);

  const fetchClearedBalances = useCallback(async () => {
    setClearedLoading(true);
    try {
      const res = await api.get(`/api/pos/balance-collections?outlet=${outlet}`);
      setClearedBalances(res.data);
    } catch (e) {
      console.error('Cleared balance fetch error:', e);
    } finally {
      setClearedLoading(false);
    }
  }, [outlet]);

  useEffect(() => { fetchJournal(); fetchClearedBalances(); }, [fetchJournal, fetchClearedBalances]);

  // Debounced journal fetch — coalesces rapid triggers (focus + visibility + broadcast)
  const debouncedFetchJournal = useCallback(debounce(() => fetchJournal(), 500), [fetchJournal]);
  const debouncedFetchCleared = useCallback(debounce(() => fetchClearedBalances(), 500), [fetchClearedBalances]);

  // Re-fetch when tab becomes visible or window regains focus (covers navigation back)
  useEffect(() => {
    const handler = () => { debouncedFetchJournal(); debouncedFetchCleared(); };
    window.addEventListener('journal-entry-saved', handler);
    window.addEventListener('balance-payment-saved', handler);
    window.addEventListener('focus', handler);
    const visHandler = () => { if (document.visibilityState === 'visible') handler(); };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('journal-entry-saved', handler);
      window.removeEventListener('balance-payment-saved', handler);
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [debouncedFetchJournal, debouncedFetchCleared]);

  // Cross-tab sync via BroadcastChannel
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('smart-production');
      bc.onmessage = (e) => {
        if (e.data === 'journal-entry-saved' || e.data?.type === 'journal-entry-saved') debouncedFetchJournal();
        if (e.data === 'bank-deposit-saved' || e.data?.type === 'bank-deposit-saved') { debouncedFetchJournal(); refresh(); }
        if (e.data === 'balance-payment-saved' || e.data?.type === 'balance-payment-saved') { debouncedFetchCleared(); refresh(); }
      };
      journalRef.current = bc;
    } catch (_) {}
    return () => { try { journalRef.current?.close(); } catch (_) {} };
  }, [debouncedFetchJournal]);

  const balanceData = dashboard ? (() => {
    const orders = dashboard.balanceOrders || [];
    const pending = orders.filter(b => b.remaining > 0.01);
    const totalPending = pending.reduce((sum, b) => sum + b.remaining, 0);
    const totalCleared = orders.filter(b => b.remaining <= 0.01 && (b.paid || 0) > 0).reduce((sum, b) => sum + (b.paid || 0), 0);
    return { pending: totalPending, pendingCount: pending.length, totalCleared, clearedCount: orders.length - pending.length };
  })() : null;

  const kpis = dashboard ? [
    { icon: TrendingUp, label: 'Gross Sales', value: formatCurrency(dashboard.grossSales), sub: 'Before discounts', color: 'from-indigo-600 to-blue-600' },
    { icon: DollarSign, label: 'Total Sales', value: formatCurrency(dashboard.totalSales), sub: `${dashboard.totalOrders || 0} orders`, color: 'from-blue-600 to-cyan-600' },
    { icon: TrendingDown, label: 'Net Revenue', value: formatCurrency(dashboard.netRevenue), sub: 'Sales − Discount − Returns − Expenses', color: 'from-emerald-600 to-green-600' },
    { icon: BarChart3, label: 'Total Discount', value: formatCurrency(dashboard.totalDiscount || 0), sub: 'Discounts given', color: 'from-amber-600 to-yellow-600' },
    { icon: RotateCcw, label: 'Returned Orders', value: dashboard.returnedOrders || 0, sub: 'Items returned', color: 'from-red-600 to-rose-600' },
    { icon: CheckCircle, label: 'Completed Orders', value: (dashboard.completedOrders || 0), sub: 'POS + Standard Completed', color: 'from-emerald-600 to-teal-600' },
    { icon: Clock, label: 'Pending Orders', value: dashboard.pendingOrders || 0, sub: 'Awaiting production/dispatch', color: 'from-amber-600 to-orange-600' },
    { icon: XCircle, label: 'Cancelled Orders', value: dashboard.cancelledOrders || 0, sub: 'Rejected / Cancelled', color: 'from-red-600 to-pink-600' },
    { icon: FileText, label: 'General Entry Deduction', value: formatCurrency(dashboard.totalJournalExpenses || 0), sub: `Bank Deposits: ${formatCurrency(dashboard.totalBankDeposits || 0)}`, color: 'from-orange-600 to-red-600' },
    { icon: DollarSign, label: 'Bank Deposited', value: formatCurrency(dashboard.totalBankDeposits || 0), sub: `${(dashboard.bankDeposits || []).length} deposits`, color: 'from-blue-600 to-indigo-600' }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
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
            <button onClick={() => { refresh(); }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs">Apply</button>
          </div>
        )}
        <button onClick={() => {
          if (!dashboard) return;
          const rows = [];
          rows.push(['POS Dashboard Export', new Date().toISOString().split('T')[0]].join(','));
          rows.push('');
          rows.push(['KPI', 'Value'].join(','));
          rows.push(['Gross Sales', dashboard.grossSales || 0].join(','));
          rows.push(['Total Sales', dashboard.totalSales || 0].join(','));
          rows.push(['Net Revenue', dashboard.netRevenue || 0].join(','));
          rows.push(['Total Discount', dashboard.totalDiscount || 0].join(','));
          rows.push(['Returned Orders', dashboard.returnedOrders || 0].join(','));
          rows.push(['Completed', dashboard.completedOrders || 0].join(','));
          rows.push(['Pending', dashboard.pendingOrders || 0].join(','));
          rows.push(['Cancelled', dashboard.cancelledOrders || 0].join(','));
          rows.push(['Bank Deposits', dashboard.totalBankDeposits || 0].join(','));
          if (balanceData) {
            rows.push(['Pending Balance', balanceData.pending || 0].join(','));
            rows.push(['Pending Balance Orders', balanceData.pendingCount || 0].join(','));
            rows.push(['Cleared Balance (Total Payments)', clearedBalances?.totalCollected || 0].join(','));
          }
          rows.push('');
          rows.push('');
          rows.push(['Payment Method', 'Gross', 'Net'].join(','));
          (dashboard.paymentBreakdown || []).forEach(p => rows.push([p.method, p.gross, p.net].join(',')));
          rows.push('');
          rows.push(['Date', 'Sales'].join(','));
          (dashboard.reportData || []).forEach(d => rows.push([d.date, d.sales].join(',')));
          rows.push('');
          rows.push(['Top Products', 'Quantity'].join(','));
          (dashboard.bestSellingProducts || []).forEach(p => rows.push([isUrdu ? toUrduName(p.name) : p.name, p.qty].join(',')));
          const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `pos-dashboard-${outlet}-${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          toast.success('CSV exported');
        }} disabled={!dashboard} title="Download CSV"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded-lg transition-all disabled:opacity-40">
          <Download size={14} />
        </button>
        <button onClick={() => {
          if (!dashboard) return;
          const printW = window.open('', '_blank');
          if (!printW) return;
          const pmRows = (dashboard.paymentBreakdown || []).map(p => `<tr><td>${p.method}</td><td>₨${(p.gross || 0).toLocaleString()}</td><td>₨${(p.net || 0).toLocaleString()}</td></tr>`).join('');
          const trendRows = (dashboard.reportData || []).map(d => `<tr><td>${d.date}</td><td>₨${(d.sales || 0).toLocaleString()}</td></tr>`).join('');
          const topRows = (dashboard.bestSellingProducts || []).map(p => `<tr><td>${p.name}</td><td>${p.qty}</td></tr>`).join('');
          printW.document.write(`<!DOCTYPE html><html><head><title>POS Dashboard - ${outlet}</title>
            <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.card{border:1px solid #ddd;border-radius:4px;padding:8px;text-align:center}.label{font-size:10px;color:#666}.val{font-size:14px;font-weight:700;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{padding:6px 8px;text-align:left;font-size:11px;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-weight:700}h2{font-size:14px;margin:16px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
            ${getPrintLogoHTML()}
            <h1>${outlet} — POS Dashboard</h1>
            <p class="sub">${formatDateTime(new Date())} | ${range} range</p>
            <div class="grid">
              <div class="card"><div class="label">Gross Sales</div><div class="val">₨${(dashboard.grossSales || 0).toLocaleString()}</div></div>
              <div class="card"><div class="label">Total Sales</div><div class="val">₨${(dashboard.totalSales || 0).toLocaleString()}</div></div>
              <div class="card"><div class="label">Net Revenue</div><div class="val">₨${(dashboard.netRevenue || 0).toLocaleString()}</div></div>
              <div class="card"><div class="label">Orders</div><div class="val">${dashboard.totalOrders || 0}</div></div>
            </div>
            <h2>Payment Methods</h2>
            <table><tr><th>Method</th><th>Gross</th><th>Net</th></tr>${pmRows}</table>
            <h2>Bank Deposits</h2>
            <p>Total Bank Deposits: ₨${(dashboard.totalBankDeposits || 0).toLocaleString()}</p>
            <table><tr><th>Employee</th><th>Slip #</th><th>Amount</th><th>Date</th></tr>${(dashboard.bankDeposits || []).map(d => `<tr><td>${d.employeeName}</td><td>${d.slipNumber}</td><td>₨${(d.amount || 0).toLocaleString()}</td><td>${formatDateOnly(d.createdAt)}</td></tr>`).join('')}</table>
            <h2>Sales Trend</h2>
            <table><tr><th>Date</th><th>Sales</th></tr>${trendRows}</table>
            <h2>Top Products</h2>
            <table><tr><th>Product</th><th>Quantity</th></tr>${topRows}</table>
            ${getPrintFooterHTML()}</body></html>`);
          printW.document.close();
          setTimeout(() => { printW.focus(); printW.print(); }, 500);
        }} disabled={!dashboard} title="Print Dashboard"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-cyan-400 rounded-lg transition-all disabled:opacity-40">
          <Printer size={14} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select value={cashier} onChange={e => setCashier(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-blue-500/50">
            <option value="">All Employees</option>
            {employees.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <button onClick={refresh} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition-all">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : error ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="text-red-400 mb-2" size={32} />
          <p className="text-red-400 font-black text-sm mb-2">Failed to load dashboard</p>
          <p className="text-gray-500 text-xs mb-4 max-w-md">{error.message}</p>
          <button onClick={refresh} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-xs">Retry</button>
        </div>
      ) : dashboard ? (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className={`bg-gradient-to-br ${kpi.color} p-[1px] rounded-2xl shadow-lg`}>
                  <div className="bg-gray-950/90 rounded-2xl p-4 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                      <Icon size={14} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-black text-white">{kpi.value}</p>
                      <p className="text-[10px] text-gray-500 font-bold mt-1">{kpi.sub}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment Method Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            {['CASH', 'CARD', 'ONLINE'].map(method => {
              const pm = dashboard.paymentBreakdown?.find(p => p.method === method) || { method, gross: 0, returns: 0, net: 0 };
              const PaymentIcon = { CASH: DollarSign, ONLINE: Globe, CARD: CreditCard }[pm.method] || DollarSign;
              const colors = { CASH: 'from-emerald-600 to-green-600', ONLINE: 'from-blue-600 to-indigo-600', CARD: 'from-purple-600 to-violet-600' };
              return (
                <div key={pm.method} className={`bg-gradient-to-br ${colors[pm.method] || 'from-gray-600 to-slate-600'} p-[1px] rounded-2xl shadow-lg`}>
                  <div className="bg-gray-950/90 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <PaymentIcon size={14} /> {pm.method}
                      </span>
                    </div>
                    <p className="text-lg font-black text-white">{formatCurrency(pm.net)}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                      <span className="text-emerald-400 font-bold">Gross: {formatCurrency(pm.gross)}</span>
                      {pm.returns > 0 && <span className="text-red-400 font-bold">Returns: -{formatCurrency(pm.returns)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Balance Summary — Pending + Cleared History */}
          {dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pending Balance Orders */}
              <div className="bg-gray-900 border border-amber-800/50 rounded-2xl p-4">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Wallet size={14} /> Pending Balance
                </h3>
                <div className="flex items-center gap-3 mb-3 bg-gray-950 rounded-xl p-3 border border-gray-800">
                  <DollarSign size={14} className="text-amber-400" />
                  <span className="text-sm font-black text-amber-300">{formatCurrency(balanceData.pending)}</span>
                  <span className="text-[10px] text-gray-500 font-bold">across {balanceData.pendingCount} order{balanceData.pendingCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(dashboard.balanceOrders || []).filter(b => b.remaining > 0.01).slice(0, 10).map(b => (
                    <div key={b.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-white">{b.orderNumber || b.receiptNumber}</p>
                          <p className="text-[10px] text-gray-500">{b.customerName || 'Walk-in'} &bull; {formatDateOnly(b.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-amber-400">-{formatCurrency(b.remaining)}</p>
                          <p className="text-[10px] text-gray-500">Paid: {formatCurrency(b.paid)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {balanceData.pendingCount > 10 && (
                    <p className="text-center text-[10px] text-gray-600 pt-1">+ {balanceData.pendingCount - 10} more</p>
                  )}
                  {balanceData.pendingCount === 0 && (
                    <p className="text-center text-gray-500 font-bold py-4 text-xs">No pending balances</p>
                  )}
                </div>
              </div>

              {/* Cleared Balance History */}
              <div className="bg-gray-900 border border-emerald-800/50 rounded-2xl p-4">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <History size={14} /> Cleared Balance History
                </h3>
                <div className="flex items-center gap-3 mb-3 bg-gray-950 rounded-xl p-3 border border-gray-800">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-sm font-black text-emerald-300">{formatCurrency(clearedBalances?.totalCollected || 0)}</span>
                  <span className="text-[10px] text-gray-500 font-bold">{clearedBalances?.count || 0} payment{(clearedBalances?.count || 0) !== 1 ? 's' : ''}</span>
                </div>
                {clearedLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="animate-spin text-gray-500" size={20} />
                  </div>
                ) : (clearedBalances?.payments || []).length === 0 ? (
                  <p className="text-center text-gray-500 font-bold py-6 text-xs">No balance payments recorded</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {(clearedBalances?.payments || []).slice(0, 10).map(p => (
                      <div key={p.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-black text-white">{p.posSale?.customerName || 'Walk-in'}</p>
                            <p className="text-[10px] text-gray-500">{p.originalInvoiceNumber || p.posSale?.receiptNumber || 'N/A'} &bull; {formatDateOnly(p.paidAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-400">+{formatCurrency(p.amountPaidNow)}</p>
                            <p className="text-[10px] text-gray-500">{p.paymentMethod}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(clearedBalances?.payments || []).length > 10 && (
                      <p className="text-center text-[10px] text-gray-600 pt-1">+ {(clearedBalances?.payments || []).length - 10} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Peak Day & Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" /> Highest Sales Day
              </h3>
              <p className="text-xl font-black text-white">{formatCurrency(dashboard.highestSalesDay?.amount || 0)}</p>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestSalesDay?.date || 'N/A'}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-blue-500" /> Highest Orders Day
              </h3>
              <p className="text-xl font-black text-white">{dashboard.highestOrdersDay?.count || 0} Orders</p>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestOrdersDay?.date || 'N/A'}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Orders</h3>
              <p className="text-xl font-black text-white">{dashboard.totalOrders || 0}</p>
              <p className="text-[10px] text-gray-500 font-bold mt-1">Total transactions</p>
            </div>
          </div>

          {/* Sales Trend Chart */}
          {dashboard.reportData && dashboard.reportData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Sales Trend</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <AreaChart data={dashboard.reportData}>
                    <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `₨${(v/1000)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }} formatter={(v) => formatCurrency(v)} labelStyle={{ color: '#fff' }} />
                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Selling Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Top Selling Products</h3>
              <div className="space-y-2">
                {dashboard.bestSellingProducts && dashboard.bestSellingProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                    <span className="font-black text-white">{p.name}</span>
                    <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">{p.qty} sold</span>
                  </div>
                ))}
                {(!dashboard.bestSellingProducts || dashboard.bestSellingProducts.length === 0) && (
                  <p className="text-center text-gray-500 py-4 font-bold">No product sales data in range</p>
                )}
              </div>
            </div>

            {/* Recent Sales */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales Transactions</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sales.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div>
                      <p className="font-black text-white">{s.receiptNumber} {s.orderId && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded-full ml-1">ORD</span>}</p>
                      <p className="text-[10px] text-gray-500">{formatDateOnly(s.createdAt)} &bull; {s.items?.length || 0} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-400">{formatCurrency(s.grandTotal)}</p>
                      <p className="text-[10px] text-gray-500">{s.paymentMethod}</p>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No recent sales</p>}
              </div>
            </div>
          </div>

          {/* Faisal Takes */}
          {dashboard.faisalTakes && dashboard.faisalTakes.length > 0 && (
            <div className="bg-gray-900 border border-amber-800/50 rounded-2xl p-4">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Package size={14} /> Faisal Takes
              </h3>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {dashboard.faisalTakes.map(ft => (
                  <div key={ft.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-amber-300">{ft.cashierName || 'Faisal'}</p>
                      <p className="text-[9px] text-gray-500">{formatDateTime(ft.faisalTakenAt || ft.createdAt)}</p>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {ft.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{item.productName} {item.size ? `(${item.size})` : ''} {item.color ? `[${isUrdu ? toUrduName(item.color) : item.color}]` : ''}</span>
                          <span className="font-bold text-white">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bank Deposits */}
          {dashboard.bankDeposits && dashboard.bankDeposits.length > 0 && (
            <div className="bg-gray-900 border border-indigo-800/50 rounded-2xl p-4">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <DollarSign size={14} /> Bank Deposits
              </h3>
              <div className="flex items-center gap-3 mb-3 bg-gray-950 rounded-xl p-3 border border-gray-800">
                <span className="text-xs text-gray-400 font-bold">Total Deposited:</span>
                <span className="text-sm font-black text-indigo-400">{formatCurrency(dashboard.totalBankDeposits)}</span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {dashboard.bankDeposits.slice(0, 10).map(d => (
                  <div key={d.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-indigo-400" />
                        <p className="font-black text-white">{d.employeeName}</p>
                      </div>
                      <p className="text-[9px] text-gray-500">{formatDateTime(d.createdAt)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Slip: {d.slipNumber}</span>
                      <span className="font-black text-indigo-400">-{formatCurrency(d.amount)}</span>
                    </div>
                    {d.notes && <p className="text-[9px] text-gray-600 italic mt-0.5">{d.notes}</p>}
                  </div>
                ))}
                {dashboard.bankDeposits.length > 10 && (
                  <p className="text-center text-[10px] text-gray-600 pt-1">+ {dashboard.bankDeposits.length - 10} more deposits</p>
                )}
              </div>
            </div>
          )}

          {/* Journal Entries */}
          <div className="bg-gray-900 border border-blue-800/50 rounded-2xl p-4">
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <FileText size={14} /> Journal Entries — Cash Expenses
            </h3>
            {cashSummary && (
              <div className="flex items-center gap-3 mb-3 bg-gray-950 rounded-xl p-3 border border-gray-800 flex-wrap">
                <DollarSign size={14} className="text-emerald-400" />
                <span className="text-xs text-gray-400 font-bold">Available Cash:</span>
                <span className={`text-sm font-black ${cashSummary.availableCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(cashSummary.availableCash)}
                </span>
                <span className="text-[10px] text-gray-600">Expenses: -{formatCurrency(cashSummary.totalExpenses)}</span>
                <span className="text-[10px] text-gray-600">Bank Dep: -{formatCurrency(cashSummary.totalBankDeposits || 0)}</span>
              </div>
            )}
            {journalLoading ? (
              <div className="flex items-center justify-center py-6">
                <RefreshCw className="animate-spin text-gray-500" size={20} />
              </div>
            ) : journalEntries.length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-6 text-xs">No journal entries recorded</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {journalEntries.slice(0, 10).map(entry => (
                  <div key={entry.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-blue-400" />
                        <p className="font-black text-white">{entry.employeeName}</p>
                      </div>
                      <p className="text-[9px] text-gray-500">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{entry.expenseTitle}</span>
                      <span className="font-black text-red-400">-{formatCurrency(entry.amount)}</span>
                    </div>
                    {entry.notes && <p className="text-[9px] text-gray-600 italic mt-0.5">{entry.notes}</p>}
                  </div>
                ))}
                {journalEntries.length > 10 && (
                  <p className="text-center text-[10px] text-gray-600 pt-1">+ {journalEntries.length - 10} more entries</p>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default OutletPOSDashboard;
