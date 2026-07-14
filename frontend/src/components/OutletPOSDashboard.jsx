import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import toast from 'react-hot-toast';
import {
  DollarSign, ShoppingCart, RefreshCw, TrendingDown, RotateCcw,
  CheckCircle, Clock, XCircle, CreditCard, Globe, Award, Package,
  AlertTriangle, BarChart3, Download, Printer, FileText, User
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
  const [range, setRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cashier, setCashier] = useState('');
  const [employees, setEmployees] = useState([]);
  const cacheVersion = useRef('v3');

  useEffect(() => {
    api.get(`/api/pos/employees?outlet=${outlet}`).then(r => setEmployees(r.data)).catch(() => {});
  }, [outlet]);

  const dashboardKey = `pos:dashboard:${cacheVersion.current}:${outlet}:${range}:${dateFrom}:${dateTo}:${cashier}`;
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
    const cacheBust = Date.now();
    setJournalLoading(true);
    try {
      const [entriesRes, cashRes] = await Promise.all([
        api.get(`/api/journal?outlet=${outlet}&_=${cacheBust}`),
        api.get(`/api/journal/cash-summary?outlet=${outlet}&_=${cacheBust}`)
      ]);
      setJournalEntries(entriesRes.data);
      setCashSummary(cashRes.data);
    } catch (e) {
      console.error('Journal/ cash fetch error:', e);
    } finally {
      setJournalLoading(false);
    }
  }, [outlet]);

  useEffect(() => { fetchJournal(); }, [fetchJournal]);

  // Re-fetch when tab becomes visible or window regains focus (covers navigation back)
  useEffect(() => {
    const handler = () => fetchJournal();
    window.addEventListener('journal-entry-saved', handler);
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') handler(); });
    return () => {
      window.removeEventListener('journal-entry-saved', handler);
      window.removeEventListener('focus', handler);
    };
  }, [fetchJournal]);

  // Cross-tab sync via BroadcastChannel
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('smart-production');
      bc.onmessage = (e) => {
        if (e.data === 'journal-entry-saved' || e.data?.type === 'journal-entry-saved') fetchJournal();
      };
      journalRef.current = bc;
    } catch (_) {}
    return () => { try { journalRef.current?.close(); } catch (_) {} };
  }, [fetchJournal]);

  const kpis = dashboard ? [
    { icon: DollarSign, label: 'Total Sales', value: formatCurrency(dashboard.totalSales), sub: `${dashboard.totalOrders || 0} orders`, color: 'from-blue-600 to-cyan-600' },
    { icon: TrendingDown, label: 'Net Revenue', value: formatCurrency(dashboard.netRevenue), sub: `Refunds: ${formatCurrency(dashboard.totalSales - dashboard.netRevenue || 0)}`, color: 'from-emerald-600 to-green-600' },
    { icon: BarChart3, label: 'Total Discount', value: formatCurrency(dashboard.totalDiscount || 0), sub: 'Discounts given', color: 'from-amber-600 to-yellow-600' },
    { icon: RotateCcw, label: 'Returned Orders', value: dashboard.returnedOrders || 0, sub: 'Items returned', color: 'from-red-600 to-rose-600' },
    { icon: CheckCircle, label: 'Completed Orders', value: (dashboard.completedOrders || 0), sub: 'POS + Standard Completed', color: 'from-emerald-600 to-teal-600' },
    { icon: Clock, label: 'Pending Orders', value: dashboard.pendingOrders || 0, sub: 'Awaiting production/dispatch', color: 'from-amber-600 to-orange-600' },
    { icon: XCircle, label: 'Cancelled Orders', value: dashboard.cancelledOrders || 0, sub: 'Rejected / Cancelled', color: 'from-red-600 to-pink-600' },
    { icon: FileText, label: 'General Entry Deduction', value: formatCurrency(dashboard.totalJournalExpenses || 0), sub: `Available Cash: ${formatCurrency((dashboard.totalSales || 0) - (dashboard.totalJournalExpenses || 0))}`, color: 'from-orange-600 to-red-600' }
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
          rows.push(['Total Sales', dashboard.totalSales || 0].join(','));
          rows.push(['Net Revenue', dashboard.netRevenue || 0].join(','));
          rows.push(['Total Discount', dashboard.totalDiscount || 0].join(','));
          rows.push(['Returned Orders', dashboard.returnedOrders || 0].join(','));
          rows.push(['Completed', dashboard.completedOrders || 0].join(','));
          rows.push(['Pending', dashboard.pendingOrders || 0].join(','));
          rows.push(['Cancelled', dashboard.cancelledOrders || 0].join(','));
          rows.push('');
          rows.push(['Payment Method', 'Gross', 'Net'].join(','));
          (dashboard.paymentBreakdown || []).forEach(p => rows.push([p.method === 'CASH_ONLINE' ? 'CASH+ONLINE' : p.method, p.gross, p.net].join(',')));
          rows.push('');
          rows.push(['Date', 'Sales'].join(','));
          (dashboard.reportData || []).forEach(d => rows.push([d.date, d.sales].join(',')));
          rows.push('');
          rows.push(['Top Products', 'Quantity'].join(','));
          (dashboard.bestSellingProducts || []).forEach(p => rows.push([p.name, p.qty].join(',')));
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
          const pmRows = (dashboard.paymentBreakdown || []).map(p => `<tr><td>${p.method === 'CASH_ONLINE' ? 'CASH+ONLINE' : p.method}</td><td>₨${(p.gross || 0).toLocaleString()}</td><td>₨${(p.net || 0).toLocaleString()}</td></tr>`).join('');
          const trendRows = (dashboard.reportData || []).map(d => `<tr><td>${d.date}</td><td>₨${(d.sales || 0).toLocaleString()}</td></tr>`).join('');
          const topRows = (dashboard.bestSellingProducts || []).map(p => `<tr><td>${p.name}</td><td>${p.qty}</td></tr>`).join('');
          printW.document.write(`<!DOCTYPE html><html><head><title>POS Dashboard - ${outlet}</title>
            <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.card{border:1px solid #ddd;border-radius:4px;padding:8px;text-align:center}.label{font-size:10px;color:#666}.val{font-size:14px;font-weight:700;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{padding:6px 8px;text-align:left;font-size:11px;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-weight:700}h2{font-size:14px;margin:16px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
            <h1>${outlet} — POS Dashboard</h1>
            <p class="sub">${new Date().toLocaleString('en-PK')} | ${range} range</p>
            <div class="grid">
              <div class="card"><div class="label">Total Sales</div><div class="val">₨${(dashboard.totalSales || 0).toLocaleString()}</div></div>
              <div class="card"><div class="label">Net Revenue</div><div class="val">₨${(dashboard.netRevenue || 0).toLocaleString()}</div></div>
              <div class="card"><div class="label">Orders</div><div class="val">${dashboard.totalOrders || 0}</div></div>
              <div class="card"><div class="label">Returned</div><div class="val">${dashboard.returnedOrders || 0}</div></div>
            </div>
            <h2>Payment Methods</h2>
            <table><tr><th>Method</th><th>Gross</th><th>Net</th></tr>${pmRows}</table>
            <h2>Sales Trend</h2>
            <table><tr><th>Date</th><th>Sales</th></tr>${trendRows}</table>
            <h2>Top Products</h2>
            <table><tr><th>Product</th><th>Quantity</th></tr>${topRows}</table>
            <p class="sub" style="margin-top:24px">Generated by Smart Production POS Dashboard</p></body></html>`);
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['CASH', 'CARD', 'ONLINE', 'CASH_ONLINE'].map(method => {
              const pm = dashboard.paymentBreakdown?.find(p => p.method === method) || { method, gross: 0, returns: 0, net: 0 };
              const PaymentIcon = { CASH: DollarSign, ONLINE: Globe, CARD: CreditCard, CASH_ONLINE: DollarSign }[pm.method] || DollarSign;
              const colors = { CASH: 'from-emerald-600 to-green-600', ONLINE: 'from-blue-600 to-indigo-600', CARD: 'from-purple-600 to-violet-600', CASH_ONLINE: 'from-cyan-600 to-teal-600' };
              return (
                <div key={pm.method} className={`bg-gradient-to-br ${colors[pm.method] || 'from-gray-600 to-slate-600'} p-[1px] rounded-2xl shadow-lg`}>
                  <div className="bg-gray-950/90 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <PaymentIcon size={14} /> {pm.method === 'CASH_ONLINE' ? 'CASH+ONLINE' : pm.method}
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
                      <p className="text-[10px] text-gray-500">{new Date(s.createdAt).toLocaleDateString()} &bull; {s.items?.length || 0} items</p>
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
                      <p className="text-[9px] text-gray-500">{new Date(ft.faisalTakenAt || ft.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {ft.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{item.productName} {item.size ? `(${item.size})` : ''} {item.color ? `[${item.color}]` : ''}</span>
                          <span className="font-bold text-white">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Journal Entries */}
          <div className="bg-gray-900 border border-blue-800/50 rounded-2xl p-4">
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <FileText size={14} /> Journal Entries — Cash Expenses
            </h3>
            {cashSummary && (
              <div className="flex items-center gap-3 mb-3 bg-gray-950 rounded-xl p-3 border border-gray-800">
                <DollarSign size={14} className="text-emerald-400" />
                <span className="text-xs text-gray-400 font-bold">Available Cash:</span>
                <span className={`text-sm font-black ${cashSummary.availableCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(cashSummary.availableCash)}
                </span>
                <span className="text-[10px] text-gray-600">(Expenses: {formatCurrency(cashSummary.totalExpenses)})</span>
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
                      <p className="text-[9px] text-gray-500">{new Date(entry.createdAt).toLocaleString('en-PK')}</p>
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
