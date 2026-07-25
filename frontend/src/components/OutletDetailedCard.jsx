import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import {
  LayoutDashboard, CreditCard, TrendingUp, Wallet, User, RotateCcw, FileText,
  ShoppingBag, Layers, Package, Users, ArrowLeftRight, ClipboardList, Scissors,
  BookOpen, Search, Filter, ChevronDown, ChevronRight, RefreshCw, Calendar, X,
  ArrowUpRight, Minus, AlertTriangle, CheckCircle, Clock, XCircle
} from 'lucide-react';

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : '-';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-PK') : '';

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
];

const STAGE_ORDER = ['Order Entry', 'Store', 'Logo Design', 'Production Acceptance', 'Production', 'Store Receive', 'Dispatch', 'Out for Delivery', 'Delivered'];

const OutletDetailedCard = ({ outlet }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [range, setRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const refreshRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (range && range !== 'all') params.range = range;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get(`/api/outlet-detailed/${outlet}`, { params });
      setData(res.data);
    } catch (e) {
      console.error('Outlet detailed fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [outlet, range, dateFrom, dateTo]);

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

  const rangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All' },
  ];

  const summary = data?.overview || {};
  const sales = data?.invoices || [];
  const orders = data?.orders || [];
  const customers = data?.customers || [];
  const inventory = data?.revenueAndInventory?.inventory || {};
  const inventoryProducts = data?.revenueAndInventory?.topProducts || [];
  const inventoryItems = data?.revenueAndInventory?.items || [];
  const returns = data?.returns || [];
  const faisalTakes = data?.faisalTakes || [];
  const balanceInvoices = data?.balanceInvoices || [];
  const transfers = data?.transfers || [];
  const requests = data?.stockRequests || [];
  const alterations = data?.alterations || [];
  const journalEntries = data?.journalEntries || [];
  const stageWiseTracking = data?.stageWiseTracking || [];
  const stageTracking = useMemo(() => {
    const map = {};
    stageWiseTracking.forEach(s => { map[s.stage] = s.count || 0; });
    return map;
  }, [stageWiseTracking]);
  const paymentSummary = data?.paymentBreakdown || {};
  const salesAnalytics = data?.salesAnalytics || {};
  const transferStats = data?.transferStats || {};
  const requestStats = data?.requestStats || {};
  const alterationStats = data?.alterationStats || {};
  const journalStats = data?.journalStats || {};

  const filteredSales = useMemo(() => {
    if (!searchTerm) return sales;
    const q = searchTerm.toLowerCase();
    return sales.filter(s =>
      (s.receiptNumber || '').toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.paymentMethod || '').toLowerCase().includes(q)
    );
  }, [sales, searchTerm]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(o =>
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.invoiceNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
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

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return sales;
    const q = searchTerm.toLowerCase();
    return sales.filter(s =>
      (s.receiptNumber || '').toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q)
    );
  }, [sales, searchTerm]);

  const filteredAlterations = useMemo(() => {
    if (!searchTerm) return alterations;
    const q = searchTerm.toLowerCase();
    return alterations.filter(a =>
      (a.customerName || '').toLowerCase().includes(q) ||
      (a.id || '').toString().includes(q)
    );
  }, [alterations, searchTerm]);

  const filteredJournal = useMemo(() => {
    if (!searchTerm) return journalEntries;
    const q = searchTerm.toLowerCase();
    return journalEntries.filter(j =>
      (j.employeeName || '').toLowerCase().includes(q) ||
      (j.title || '').toLowerCase().includes(q)
    );
  }, [journalEntries, searchTerm]);

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
    { label: 'Completed Invoices', value: summary.completedInvoices ?? 0, color: 'text-blue-400', icon: CheckCircle },
    { label: 'Generated Invoices', value: summary.generatedInvoices ?? sales.length, color: 'text-purple-400', icon: FileText },
    { label: 'Pending Orders', value: summary.pendingOrders ?? 0, color: 'text-yellow-400', icon: Clock },
    { label: 'Cancelled Orders', value: summary.cancelledOrders ?? 0, color: 'text-red-400', icon: XCircle },
  ];

  const salesTrend = salesAnalytics.salesTrend || [];
  const maxTrend = Math.max(...salesTrend.map(d => d.sales || d.count || 0), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-black text-white uppercase">{outlet}</h2>
        <span className="text-xs font-bold text-gray-500">360° Operational Dashboard</span>
        <button onClick={handleRefresh} disabled={loading}
          className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 transition-all">
          {loading ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 glass rounded-2xl border border-gray-700/50">
        {rangeOptions.map(opt => (
          <button key={opt.value} onClick={() => { setRange(opt.value); setDateFrom(''); setDateTo(''); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${range === opt.value ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-indigo-500/20'}`}>
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

      {(activeSection === 'overview' || activeSection === 'sales' || activeSection === 'balance' || activeSection === 'faisal-takes' || activeSection === 'returns' || activeSection === 'invoices' || activeSection === 'orders' || activeSection === 'customers' || activeSection === 'transfers' || activeSection === 'requests' || activeSection === 'alterations' || activeSection === 'journal' || activeSection === 'payments' || activeSection === 'inventory' || activeSection === 'tracking') && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-xs font-bold text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50" />
        </div>
      )}

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
                  <p className={`text-white font-black text-xl`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Sales Trend
            </h3>
            {salesTrend.length > 0 ? (
              <div className="flex items-end gap-1.5 h-40">
                {salesTrend.slice(-14).map((d, i) => {
                  const val = d.sales || d.count || 0;
                  const h = maxTrend > 0 ? (val / maxTrend) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] font-black text-indigo-400">{val > 0 ? (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val) : ''}</span>
                      <div className="w-full bg-gray-800 rounded-t-lg overflow-hidden" style={{ height: `${Math.max(h, 2)}%` }}>
                        <div className="w-full h-full bg-indigo-500 rounded-t-lg" />
                      </div>
                      <span className="text-[7px] font-bold text-gray-500 truncate w-full text-center">{d.label || d.date || ''}</span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'CASH', label: 'Cash', dotClass: 'bg-emerald-500', netClass: 'text-emerald-400' },
                { key: 'CARD', label: 'Card', dotClass: 'bg-purple-500', netClass: 'text-purple-400' },
                { key: 'ONLINE', label: 'Online', dotClass: 'bg-blue-500', netClass: 'text-blue-400' },
                { key: 'CASH_ONLINE', label: 'Cash+Online', dotClass: 'bg-amber-500', netClass: 'text-amber-400' },
              ].map(m => {
                const ps = paymentSummary[m.key] || {};
                return (
                  <div key={m.key} className={`glass rounded-2xl p-5 border-2 border-gray-700/50`}>
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

          {paymentSummary.totalRefunds != null && (
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <RotateCcw size={16} className="text-red-400" /> Total Refunds
              </h3>
              <div className="glass rounded-xl p-4 border border-red-500/20 text-center">
                <p className="text-red-400 font-black text-2xl">{fmt(paymentSummary.totalRefunds)}</p>
                <p className="text-gray-500 text-[10px] font-bold uppercase mt-1">Across all methods</p>
              </div>
            </div>
          )}
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
                <p className="text-gray-600 text-xs font-bold">No sales today</p>
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
                <p className="text-gray-600 text-xs font-bold">No invoices today</p>
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
                      <span className="text-[10px] font-bold text-gray-500 w-10 text-right shrink-0">{p.qty || p.quantity || 0} qty</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No product data</p>
            )}
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" /> Sales Trend (by Date)
            </h3>
            {(salesAnalytics.salesTrend || salesTrend).length > 0 ? (
              <div className="flex items-end gap-1 h-36">
                {(salesAnalytics.salesTrend || salesTrend).slice(-14).map((d, i) => {
                  const val = d.sales || d.revenue || d.count || 0;
                  const h = maxTrend > 0 ? (val / maxTrend) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[7px] font-black text-indigo-400">{val > 1000 ? `${(val / 1000).toFixed(0)}k` : val || ''}</span>
                      <div className="w-full bg-gray-800 rounded-t-lg overflow-hidden" style={{ height: `${Math.max(h, 2)}%` }}>
                        <div className="w-full h-full bg-indigo-500 rounded-t-lg" />
                      </div>
                      <span className="text-[7px] font-bold text-gray-500 truncate w-full text-center">{d.label || d.date || ''}</span>
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
              <p className="text-gray-500 text-[10px] font-bold uppercase mt-1">{balanceInvoices.length} Invoices with Balance</p>
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
                      const paid = inv.totalPaid || ((inv.advanceAmount || 0) + (inv.balancePayments || []).reduce((s, bp) => s + (bp.amountPaidNow || 0), 0));
                      const remaining = inv.remaining ?? Math.max(0, (inv.grandTotal || 0) - paid);
                      return (
                        <tr key={inv.id || i} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-2 font-bold text-white">{inv.receiptNumber || inv.invoiceNumber || '—'}</td>
                          <td className="px-2 font-bold text-gray-300">{inv.customerName || 'Walk-in'}</td>
                          <td className="px-2 text-right font-black text-white">{fmt(inv.grandTotal)}</td>
                          <td className="px-2 text-right font-black text-emerald-400">{fmt(paid)}</td>
                          <td className={`pl-2 text-right font-black ${remaining > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(remaining)}</td>
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
              <p className="text-indigo-400 font-black text-xl">{fmt(faisalTakes.reduce((s, ft) => s + (ft.totalAmount || ft.grandTotal || 0), 0))}</p>
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
                          <p className="text-[10px] font-bold text-gray-500">{ft.cashierName || ft.cashier || '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-indigo-400">{fmt(ft.totalAmount || ft.grandTotal || 0)}</p>
                        <p className="text-[10px] font-bold text-gray-500">{fmtDate(ft.createdAt)} {fmtTime(ft.createdAt)}</p>
                      </div>
                    </div>
                    {expandedId === `ft-${i}` && (ft.items || ft.saleItems || []).length > 0 && (
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
                            {(ft.items || ft.saleItems || []).map((item, j) => (
                              <tr key={j} className="border-t border-gray-800">
                                <td className="py-1 font-bold text-white">{item.productName || item.name || '—'}</td>
                                <td className="px-2 text-gray-300">{item.quantity || item.qty || 0}</td>
                                <td className="px-2 text-gray-300">{item.size || '—'}</td>
                                <td className="px-2 text-gray-300">{item.color || '—'}</td>
                                <td className="pl-2 text-right font-bold text-indigo-400">{fmt((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1))}</td>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Returns</p>
              <p className="text-white font-black text-xl">{returns.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Refunded</p>
              <p className="text-red-400 font-black text-xl">{fmt(returns.reduce((s, r) => s + (r.refundAmount || r.totalAmount || 0), 0))}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <RotateCcw size={16} className="text-red-400" /> Return History ({returns.length})
            </h3>
            {returns.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  const grouped = {};
                  returns.forEach(r => {
                    const d = fmtDate(r.createdAt);
                    if (!grouped[d]) grouped[d] = [];
                    grouped[d].push(r);
                  });
                  return Object.entries(grouped).map(([date, items]) => (
                    <div key={date}>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 mt-3">{date} ({items.length})</p>
                      {items.map((r, i) => (
                        <div key={r.id || i} className="glass rounded-xl p-3 border border-gray-700/50 mb-2 hover:bg-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-white">{r.receiptNumber || '—'}</p>
                              <p className="text-[10px] font-bold text-gray-500">{r.productName || (r.items || []).map(it => it.productName).join(', ') || '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-red-400">{fmt(r.refundAmount || r.totalAmount || 0)}</p>
                              <p className="text-[10px] font-bold text-gray-500">{r.paymentMethod || '—'}</p>
                            </div>
                          </div>
                          <p className="text-[9px] font-bold text-gray-600 mt-1">{fmtTime(r.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
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
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total</p>
              <p className="text-white font-black text-xl">{sales.length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Today</p>
              <p className="text-indigo-400 font-black text-xl">{sales.filter(s => fmtDate(s.createdAt) === fmtDate(new Date())).length}</p>
            </div>
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">This Week</p>
              <p className="text-amber-400 font-black text-xl">{sales.filter(s => { const d = new Date(s.createdAt); const now = new Date(); return (now - d) < 7 * 86400000; }).length}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" /> Invoice List ({filteredInvoices.length})
            </h3>
            {filteredInvoices.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Receipt #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Grand Total</th>
                    <th className="text-left px-2">Method</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {filteredInvoices.slice(0, 200).map((s, i) => (
                      <tr key={s.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{s.receiptNumber || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{s.customerName || 'Walk-in'}</td>
                        <td className="px-2 text-right font-black text-emerald-400">{fmt(s.grandTotal)}</td>
                        <td className="px-2 font-bold text-gray-400">{s.paymentMethod || 'CASH'}</td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(s.createdAt)} {fmtTime(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No invoices found</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== ORDERS ==================== */}
      {activeSection === 'orders' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-indigo-400" /> Order List ({filteredOrders.length})
            </h3>
            {filteredOrders.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Order #</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-right px-2">Amount</th>
                    <th className="text-left px-2">Stage</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-left px-2">Priority</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {filteredOrders.slice(0, 200).map((o, i) => (
                      <tr key={o.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{o.orderNumber || o.invoiceNumber || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{o.client?.name || o.customerName || '—'}</td>
                        <td className="px-2 text-right font-black text-emerald-400">{fmt(o.totalPrice || o.grandTotal)}</td>
                        <td className="px-2 font-bold text-gray-400">{o.currentStage || '—'}</td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${(o.paymentStatus || o.status) === 'COMPLETED' || (o.paymentStatus || o.status) === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' : (o.paymentStatus || o.status) === 'CANCELLED' ? 'bg-red-500/20 text-red-400' : (o.paymentStatus || o.status) === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {o.paymentStatus || o.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${o.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {o.priority || 'NORMAL'}
                          </span>
                        </td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No orders found</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== ORDER TRACKING ==================== */}
      {activeSection === 'tracking' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" /> Stage-wise Order Distribution
            </h3>
            {STAGE_ORDER.length > 0 ? (
              <div className="space-y-2">
                {STAGE_ORDER.map(stage => {
                  const count = stageTracking[stage] || 0;
                  const maxCount = Math.max(...Object.values(stageTracking).map(v => typeof v === 'number' ? v : 0), 1);
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  const isExpanded = expandedId === `stage-${stage}`;
                  return (
                    <div key={stage}>
                      <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-lg p-2 transition-all" onClick={() => setExpandedId(isExpanded ? null : `stage-${stage}`)}>
                        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <ChevronRight size={14} className="text-gray-500" />
                        </span>
                        <span className="text-xs font-bold text-gray-300 w-40 shrink-0">{stage}</span>
                        <div className="flex-1 h-6 bg-gray-800 rounded-lg overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-lg flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 2)}%` }}>
                            {count > 0 && <span className="text-[9px] font-black text-white">{count}</span>}
                          </div>
                        </div>
                        <span className="text-xs font-black text-white w-8 text-right">{count}</span>
                      </div>
                      {isExpanded && (
                        <div className="ml-8 mb-2 mt-1 space-y-1">
                          {orders.filter(o => o.currentStage === stage).slice(0, 20).map((o, i) => (
                            <div key={o.id || i} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg border border-gray-700/30">
                              <span className="text-[10px] font-bold text-white">{o.orderNumber || o.invoiceNumber || '—'}</span>
                              <span className="text-[10px] font-bold text-gray-400">{o.customerName || '—'}</span>
                              <span className="text-[10px] font-black text-indigo-400">{fmt(o.totalPrice || o.grandTotal)}</span>
                            </div>
                          ))}
                          {orders.filter(o => o.currentStage === stage).length > 20 && (
                            <p className="text-[9px] text-gray-600 font-bold text-center">+{orders.filter(o => o.currentStage === stage).length - 20} more</p>
                          )}
                          {orders.filter(o => o.currentStage === stage).length === 0 && (
                            <p className="text-[10px] text-gray-600 font-bold text-center py-2">No orders at this stage</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No tracking data</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== INVENTORY ==================== */}
      {activeSection === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'In Stock', value: inventory.inStock || 0, color: 'text-emerald-400' },
              { label: 'Low Stock', value: inventory.lowStock || 0, color: 'text-amber-400' },
              { label: 'Out of Stock', value: inventory.outOfStock || 0, color: 'text-red-400' },
              { label: 'Total Items', value: inventory.total || inventoryItems.length, color: 'text-white' },
              { label: 'Total Value', value: fmt(inventory.totalValue), color: 'text-indigo-400' },
            ].map(card => (
              <div key={card.label} className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{card.label}</p>
                <p className={`font-black text-xl ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {inventoryProducts.length > 0 && (
            <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Package size={16} className="text-indigo-400" /> Top Inventory Products (by Value)
              </h3>
              <div className="space-y-2">
                {inventoryProducts.slice(0, 10).map((item, i) => {
                  const maxVal = inventoryProducts[0]?.value || 1;
                  return (
                    <div key={item.name || i} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-500 w-5 shrink-0">#{i + 1}</span>
                      <span className="text-xs font-bold text-white w-40 shrink-0 truncate">{item.name || '—'}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-lg" style={{ width: `${(item.value / maxVal) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-indigo-400 w-20 text-right shrink-0">{fmt(item.value)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} className="text-indigo-400" /> Full Inventory ({filteredInventory.length})
            </h3>
            {filteredInventory.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left px-2">Name</th>
                    <th className="text-left px-2">Category</th>
                    <th className="text-left px-2">Color</th>
                    <th className="text-left px-2">Size</th>
                    <th className="text-right px-2">Stock</th>
                    <th className="text-right px-2">Price</th>
                    <th className="text-right pl-2">Barcode</th>
                  </tr></thead>
                  <tbody>
                    {filteredInventory.slice(0, 200).map((item, idx) => (
                      <tr key={item.id || idx} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 text-gray-500">{idx + 1}</td>
                        <td className="px-2 font-bold text-white">{item.productName || item.name || '—'}</td>
                        <td className="px-2 font-bold text-gray-400">{item.category || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{item.color || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{item.size || '—'}</td>
                        <td className={`px-2 text-right font-black ${(item.stock || 0) <= 0 ? 'text-red-400' : (item.stock || 0) <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{item.stock || 0}</td>
                        <td className="px-2 text-right font-bold text-gray-300">{fmt(item.price || item.unitPrice)}</td>
                        <td className="pl-2 text-right font-bold text-gray-500">{item.barcode || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No inventory items found</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== CUSTOMERS ==================== */}
      {activeSection === 'customers' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50 text-center">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Customers</p>
            <p className="text-white font-black text-xl">{customers.length}</p>
          </div>

          <div className="glass rounded-2xl p-5 border-2 border-gray-700/50">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} className="text-indigo-400" /> Customer List ({filteredCustomers.length})
            </h3>
            {filteredCustomers.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left px-2">Name</th>
                    <th className="text-left px-2">Phone</th>
                    <th className="text-left px-2">Gender</th>
                    <th className="text-left px-2">City</th>
                    <th className="text-right pl-2">Registered</th>
                  </tr></thead>
                  <tbody>
                    {filteredCustomers.slice(0, 200).map((c, i) => (
                      <tr key={c.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 text-gray-500">{i + 1}</td>
                        <td className="px-2 font-bold text-white">{c.name || '—'}</td>
                        <td className="px-2 font-bold text-gray-300">{c.phone || '—'}</td>
                        <td className="px-2 font-bold text-gray-400">{c.gender || '—'}</td>
                        <td className="px-2 font-bold text-gray-400">{c.city || '—'}</td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No customers found</p>
            )}
          </div>
        </div>
      )}

      {/* ==================== TRANSFERS ==================== */}
      {activeSection === 'transfers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total', value: transfers.length, color: 'text-white' },
              { label: 'Incoming', value: transfers.filter(t => t.type === 'INCOMING' || t.toOutlet === outlet).length, color: 'text-emerald-400' },
              { label: 'Outgoing', value: transfers.filter(t => t.type === 'OUTGOING' || t.fromOutlet === outlet).length, color: 'text-amber-400' },
              { label: 'Pending', value: transfers.filter(t => t.status === 'PENDING').length, color: 'text-yellow-400' },
              { label: 'Completed', value: transfers.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length, color: 'text-blue-400' },
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
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400">{(t.items || []).length || t.itemCount || 0} items</span>
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
              { label: 'Approved', value: requests.filter(r => r.status === 'APPROVED').length, color: 'text-emerald-400' },
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
              <ClipboardList size={16} className="text-indigo-400" /> Request History ({requests.length})
            </h3>
            {requests.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Item</th>
                    <th className="text-left px-2">Category</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-right px-2">Approved Qty</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {requests.map((r, i) => (
                      <tr key={r.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold text-white">{r.itemName || r.productName || '—'}</td>
                        <td className="px-2 font-bold text-gray-400">{r.category || '—'}</td>
                        <td className="px-2 text-right font-bold text-gray-300">{r.quantity || r.requestedQty || 0}</td>
                        <td className="px-2 text-right font-bold text-emerald-400">{r.approvedQty || '—'}</td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : r.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{r.status || 'PENDING'}</span>
                        </td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
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
                          <p className="text-xs font-black text-white">#{a.id || i + 1}</p>
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
                        {(a.products || a.items || []).length > 0 ? (
                          <table className="w-full text-[10px]">
                            <thead><tr className="text-gray-500 font-black uppercase">
                              <th className="text-left py-1">Product</th>
                              <th className="text-left px-2">Description</th>
                              <th className="text-right pl-2">Price</th>
                            </tr></thead>
                            <tbody>
                              {(a.products || a.items || []).map((p, j) => (
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
              { label: 'Total Entries', value: journalEntries.length, color: 'text-white' },
              { label: 'Total Deducted', value: fmt(journalEntries.reduce((s, j) => s + (j.amount || 0), 0)), color: 'text-red-400' },
              { label: 'Unique Employees', value: [...new Set(journalEntries.map(j => j.employeeName))].filter(Boolean).length, color: 'text-indigo-400' },
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
                  filteredJournal.forEach(j => {
                    const emp = j.employeeName || 'Unknown';
                    if (!grouped[emp]) grouped[emp] = [];
                    grouped[emp].push(j);
                  });
                  return Object.entries(grouped).map(([emp, entries]) => (
                    <div key={emp}>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 mt-3">{emp} ({entries.length} entries · {fmt(entries.reduce((s, e) => s + (e.amount || 0), 0))})</p>
                      {entries.map((j, i) => (
                        <div key={j.id || i} className="glass rounded-xl p-3 border border-gray-700/50 mb-2 hover:bg-white/5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-white">{j.title || '—'}</p>
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
              </div>
            ) : (
              <p className="text-xs text-gray-500 font-bold text-center py-8">No journal entries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletDetailedCard;
