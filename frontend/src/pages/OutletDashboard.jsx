import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Search, Clock, CheckCircle, XCircle,
  Package, Truck, UserCheck, Send,
  RefreshCcw, Calendar, ListChecks, BarChart3, DollarSign,
  ChevronDown, TrendingUp, ShoppingCart, AlertTriangle,
  CreditCard, Globe, Layers, Award, TrendingDown,
  ArrowUpRight, ArrowDownRight, Activity, Eye, Phone, MapPin,
  Download, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import OutletPOSDashboard from '../components/OutletPOSDashboard';
import OutletInvoiceHistory from '../components/OutletInvoiceHistory';

const COLORS = { emerald: '#10b981', amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444', purple: '#8b5cf6', cyan: '#06b6d4', pink: '#ec4899' };
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
};

const DatePresetButtons = ({ value, onChange }) => {
  const presets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: '7 Days', value: 'week' },
    { label: '30 Days', value: 'month' },
    { label: '3 Months', value: '3m' },
    { label: 'All Time', value: '' }
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(p => (
        <button key={p.value} onClick={() => onChange(p.value)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${value === p.value ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/50'}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, gradient, trend, trendUp }) => (
  <motion.div variants={itemVariants} className={`bg-gradient-to-br ${gradient} p-[1.5px] rounded-2xl shadow-lg`}>
    <div className="bg-gray-950/90 backdrop-blur-sm rounded-2xl p-5 h-full flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="flex justify-between items-start mb-3 relative">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">{label}</span>
        <div className="p-2.5 bg-gray-800/80 rounded-xl">
          <Icon size={16} className="text-white/70" />
        </div>
      </div>
      <div className="relative">
        <p className="text-2xl md:text-3xl font-black text-white tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <p className="text-[11px] text-gray-500 font-semibold">{sub}</p>}
          {trend !== undefined && (
            <span className={`flex items-center gap-0.5 text-[11px] font-bold ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend}%
            </span>
          )}
        </div>
      </div>
    </div>
  </motion.div>
);

const ChartCard = ({ title, icon: Icon, children, className = '' }) => (
  <motion.div variants={itemVariants} className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800/80 rounded-2xl p-5 shadow-lg ${className}`}>
    <h3 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.15em] mb-5 flex items-center gap-2">
      {Icon && <div className="p-1.5 bg-blue-500/10 rounded-lg"><Icon size={14} className="text-blue-400" /></div>}
      {title}
    </h3>
    {children}
  </motion.div>
);

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-gray-900/95 border border-gray-700/80 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm">
      <p className="text-xs text-gray-400 font-bold mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-black" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const TimelineEntry = ({ entry }) => (
  <div className="flex gap-3 py-2">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full ring-2 ring-gray-800 ${entry.type === 'route' ? 'bg-blue-500' : entry.type === 'stage' && entry.status === 'COMPLETED' ? 'bg-emerald-500' : entry.type === 'stage' && entry.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-gray-600'}`} />
      <div className="w-0.5 flex-1 bg-gray-800 mt-1" />
    </div>
    <div className="flex-1 pb-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${entry.type === 'route' ? 'text-blue-400' : entry.type === 'stage' && entry.status === 'COMPLETED' ? 'text-emerald-400' : entry.type === 'stage' && entry.status === 'IN_PROGRESS' ? 'text-amber-400' : 'text-gray-400'}`}>
          {entry.type === 'stage' ? entry.stage?.replace(/_/g, ' ') : entry.label}
        </span>
        <span className="text-[10px] text-gray-600">{new Date(entry.timestamp).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {entry.actor && <p className="text-[10px] text-gray-600 mt-0.5">by {entry.actor}</p>}
      {entry.remarks && <p className="text-[10px] text-gray-500 mt-0.5 italic">{entry.remarks}</p>}
      {entry.returnReason && <p className="text-[10px] text-amber-400 mt-0.5">{entry.returnReason}</p>}
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, sub }) => (
  <div className="h-48 flex flex-col items-center justify-center text-center">
    <div className="p-3 bg-gray-800/50 rounded-2xl mb-3">
      <Icon size={24} className="text-gray-600" />
    </div>
    <p className="text-sm font-bold text-gray-500">{title}</p>
    {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
  </div>
);

const OutletDashboard = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const [datePreset, setDatePreset] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAnalytics = useCallback(async (preset) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const { dateFrom, dateTo } = getDateRange(preset);
      const params = { range: preset || 'all' };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/api/outlet-orders/analytics', { params });
      setAnalytics(res.data);
    } catch (e) {
      setAnalyticsError(e.message);
      console.error('Analytics error:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    setRecentOrdersLoading(true);
    try {
      const res = await api.get('/api/outlet-orders', { params: { limit: 10 } });
      setRecentOrders(Array.isArray(res.data) ? res.data.slice(0, 8) : []);
    } catch (e) {
      console.error('Recent orders error:', e);
    } finally {
      setRecentOrdersLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.get('/api/outlet-orders/tasks');
      setTasks(res.data);
    } catch (e) {
      console.error('Tasks error:', e);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchAnalytics(datePreset);
      fetchRecentOrders();
    }
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, datePreset, fetchAnalytics, fetchRecentOrders, fetchTasks]);

  useEffect(() => {
    if (!showTabDropdown) return;
    const handler = () => setShowTabDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showTabDropdown]);

  const getDateRange = (preset) => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (!preset) return { dateFrom: undefined, dateTo: undefined };
    if (preset === 'today') return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
    if (preset === 'yesterday') { start.setDate(start.getDate() - 1); const end = new Date(start); end.setHours(23, 59, 59, 999); return { dateFrom: start.toISOString(), dateTo: end.toISOString() }; }
    if (preset === 'week') { start.setDate(start.getDate() - 7); return { dateFrom: start.toISOString(), dateTo: now.toISOString() }; }
    if (preset === 'month') { start.setMonth(start.getMonth() - 1); return { dateFrom: start.toISOString(), dateTo: now.toISOString() }; }
    if (preset === '3m') { start.setMonth(start.getMonth() - 3); return { dateFrom: start.toISOString(), dateTo: now.toISOString() }; }
    return { dateFrom: undefined, dateTo: undefined };
  };

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    setTrackingLoading(true);
    setTimeline([]);
    setTrackedOrder(null);
    try {
      const orderRes = await api.get(`/api/orders/track/${trackingNumber.trim()}`);
      setTrackedOrder(orderRes.data);
      const timelineRes = await api.get(`/api/orders/${orderRes.data.id}/timeline`);
      setTimeline(timelineRes.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Order not found');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleFinalAction = async (orderId, action) => {
    setActionLoading(orderId + action);
    try {
      let endpoint;
      if (action === 'dispatch') endpoint = '/api/orders/' + orderId + '/send-for-delivery';
      else if (action === 'inhouse') endpoint = '/api/outlet-orders/' + orderId + '/in-house-delivery';
      else if (action === 'customer-taken') endpoint = '/api/outlet-orders/' + orderId + '/customer-taken';
      await api.post(endpoint);
      toast.success('Action completed successfully');
      fetchTasks();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

  const exportAnalyticsCSV = () => {
    if (!analytics) return;
    const rows = [];
    rows.push(['Outlet Dashboard Export', new Date().toISOString().split('T')[0]].join(','));
    rows.push('');
    rows.push(['KPI', 'Value'].join(','));
    rows.push(['Total Orders', (orderStats.totalOrders || 0)].join(','));
    rows.push(['Outlet Revenue', (orderStats.totalRevenue || 0)].join(','));
    rows.push(['POS Sales', (posSummary.totalSales || 0)].join(','));
    rows.push(['POS Transactions', (posSummary.orderCount || 0)].join(','));
    rows.push(['Paid Orders', (paymentBD.paidOrders || 0)].join(','));
    rows.push(['Pending Payment', (paymentBD.pendingPaymentOrders || 0)].join(','));
    rows.push('');
    rows.push(['Date', 'Revenue', 'Orders'].join(','));
    const allDates = [...new Set([...salesTrend.map(s => s.date), ...ordersTrend.map(o => o.date)])].sort();
    allDates.forEach(d => {
      const rev = salesTrend.find(s => s.date === d);
      const ord = ordersTrend.find(o => o.date === d);
      rows.push([d, rev?.revenue || 0, ord?.count || 0].join(','));
    });
    rows.push('');
    rows.push(['Top Products', 'Quantity Sold'].join(','));
    topProducts.slice(0, 10).forEach(p => rows.push([p.name, p.qty].join(',')));
    rows.push('');
    rows.push(['Order Type', 'Count'].join(','));
    orderTypeDist.forEach(t => rows.push([t.name, t.count].join(',')));
    rows.push('');
    rows.push(['Inventory', 'Count'].join(','));
    rows.push(['In Stock', invOverview.inStock || 0].join(','));
    rows.push(['Low Stock', invOverview.lowStock || 0].join(','));
    rows.push(['Out of Stock', invOverview.outOfStock || 0].join(','));
    rows.push('');
    rows.push(['Recent Orders', 'Customer', 'Status', 'Total', 'Date'].join(','));
    recentOrders.forEach(o => rows.push([o.orderNumber || '', o.customerName || '', o.status || '', o.totalPrice || '', o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-PK') : ''].join(',')));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `outlet-dashboard-${outletName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('CSV exported');
  };

  const printDashboard = () => {
    const printW = window.open('', '_blank');
    if (!printW) { window.print(); return; }
    printW.document.write(`<!DOCTYPE html><html><head><title>Dashboard - ${outletName}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h1{font-size:18px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th,td{padding:6px 8px;text-align:left;font-size:11px;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-weight:700}h2{font-size:14px;margin:16px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.kpi-card{border:1px solid #ddd;border-radius:4px;padding:8px;text-align:center}.kpi-label{font-size:10px;color:#666}.kpi-value{font-size:16px;font-weight:700;margin-top:2px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
      <h1>${outletName} — Dashboard Report</h1>
      <p class="sub">${new Date().toLocaleString('en-PK')} | ${datePreset || 'All Time'} range</p>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">Total Orders</div><div class="kpi-value">${orderStats.totalOrders || 0}</div></div>
        <div class="kpi-card"><div class="kpi-label">Outlet Revenue</div><div class="kpi-value">PKR ${(orderStats.totalRevenue || 0).toLocaleString()}</div></div>
        <div class="kpi-card"><div class="kpi-label">POS Sales</div><div class="kpi-value">PKR ${(posSummary.totalSales || 0).toLocaleString()}</div></div>
        <div class="kpi-card"><div class="kpi-label">Paid / Pending</div><div class="kpi-value">${paymentBD.paidOrders || 0} / ${paymentBD.pendingPaymentOrders || 0}</div></div>
      </div>
      <h2>Revenue Trend</h2>
      <table><tr><th>Date</th><th>Revenue</th><th>Orders</th></tr>
      ${allDates.map(d => { const rev = salesTrend.find(s => s.date === d); const ord = ordersTrend.find(o => o.date === d); return `<tr><td>${d}</td><td>PKR ${(rev?.revenue || 0).toLocaleString()}</td><td>${ord?.count || 0}</td></tr>`; }).join('')}</table>
      <h2>Top Products</h2>
      <table><tr><th>Product</th><th>Quantity</th></tr>${topProducts.slice(0,10).map(p => `<tr><td>${p.name}</td><td>${p.qty}</td></tr>`).join('')}</table>
      <h2>Order Types</h2>
      <table><tr><th>Type</th><th>Count</th></tr>${orderTypeDist.map(t => `<tr><td>${t.name}</td><td>${t.count}</td></tr>`).join('')}</table>
      <h2>Recent Orders</h2>
      <table><tr><th>Order #</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr>${recentOrders.map(o => `<tr><td>${o.orderNumber || ''}</td><td>${o.customerName || ''}</td><td>${o.status || ''}</td><td>${o.totalPrice ? 'PKR ' + o.totalPrice.toLocaleString() : '-'}</td><td>${o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-PK') : ''}</td></tr>`).join('')}</table>
      <p class="sub" style="margin-top:24px">Generated by Smart Production Dashboard</p>
    </body></html>`);
    printW.document.close();
    setTimeout(() => { printW.focus(); printW.print(); }, 500);
  };

  const a = analytics || {};
  const orderStats = a.orderStats || {};
  const paymentBD = a.paymentBreakdown || {};
  const salesTrend = a.salesTrend || [];
  const ordersTrend = a.ordersTrend || [];
  const topProducts = a.topProducts || [];
  const orderTypeDist = a.orderTypeDistribution || [];
  const invOverview = a.inventoryOverview || {};
  const posSummary = a.posSummary || {};

  const combinedRevenue = (orderStats.totalRevenue || 0) + (posSummary.totalSales || 0);
  const combinedOrders = (orderStats.totalOrders || 0) + (posSummary.orderCount || 0);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos-dashboard', label: 'POS Dashboard', icon: BarChart3 },
    { id: 'invoices', label: 'Total Invoices', icon: DollarSign },
    { id: 'tracking', label: 'Order Track', icon: Search },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, badge: tasks.length }
  ];

  const statusData = [
    { name: 'Pending', value: orderStats.pendingOrders || 0, color: COLORS.amber },
    { name: 'In Progress', value: orderStats.inProgressOrders || 0, color: COLORS.blue },
    { name: 'Completed', value: orderStats.completedOrders || 0, color: COLORS.emerald },
    { name: 'Cancelled', value: orderStats.cancelledOrders || 0, color: COLORS.red }
  ].filter(d => d.value > 0);

  const renderDashboardTab = () => (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Date & Summary Bar */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <DatePresetButtons value={datePreset} onChange={setDatePreset} />
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-2 bg-gray-800/80 px-4 py-2 rounded-xl border border-gray-700/50">
            <Activity size={14} className="text-blue-400" />
            <span className="text-gray-400 font-semibold">Total Revenue:</span>
            <span className="text-white font-black">{formatCurrency(combinedRevenue)}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-800/80 px-4 py-2 rounded-xl border border-gray-700/50">
            <ShoppingCart size={14} className="text-emerald-400" />
            <span className="text-gray-400 font-semibold">Orders:</span>
            <span className="text-white font-black">{combinedOrders}</span>
          </div>
          <button onClick={exportAnalyticsCSV} disabled={!analytics} title="Download CSV"
            className="p-2.5 bg-gray-800/80 border border-gray-700/50 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-40">
            <Download size={14} className="text-blue-400" />
          </button>
          <button onClick={printDashboard} disabled={!analytics} title="Print Dashboard"
            className="p-2.5 bg-gray-800/80 border border-gray-700/50 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-40">
            <Printer size={14} className="text-cyan-400" />
          </button>
        </div>
      </motion.div>

      {analyticsLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-72" />)}
          </div>
        </div>
      ) : analyticsError ? (
        <motion.div variants={itemVariants} className="py-20 flex flex-col items-center justify-center text-center bg-gray-900/60 rounded-2xl border border-red-800/30">
          <AlertTriangle className="text-red-400 mb-3" size={36} />
          <p className="text-red-400 font-black text-sm mb-1">Failed to load analytics</p>
          <p className="text-gray-500 text-xs mb-5 max-w-md">{analyticsError}</p>
          <button onClick={() => fetchAnalytics(datePreset)} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl text-xs shadow-lg">Retry</button>
        </motion.div>
      ) : analytics ? (
        <>
          {/* KPI Cards Row */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Package} label="Outlet Orders" value={orderStats.totalOrders || 0} sub={`${orderStats.inProgressOrders || 0} in progress`} gradient="from-blue-600 to-cyan-600" />
            <KpiCard icon={DollarSign} label="Outlet Revenue" value={formatCurrency(orderStats.totalRevenue || 0)} sub="From paid orders" gradient="from-emerald-600 to-teal-600" />
            <KpiCard icon={ShoppingCart} label="POS Sales" value={formatCurrency(posSummary.totalSales || 0)} sub={`${posSummary.orderCount || 0} transactions`} gradient="from-purple-600 to-pink-600" />
            <KpiCard icon={Award} label="Top Product" value={topProducts[0]?.name || 'N/A'} sub={topProducts[0] ? `${topProducts[0].qty} sold` : 'No data'} gradient="from-amber-600 to-orange-600" />
          </motion.div>

          {/* Revenue Trend + Orders Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Revenue Trend" icon={TrendingUp}>
              {salesTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.2}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" strokeOpacity={0.5} />
                      <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `PKR ${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#revGrad)" name="Revenue" dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#1e293b', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={TrendingUp} title="No revenue data" sub="No paid orders in this date range" />
              )}
            </ChartCard>

            <ChartCard title="Orders Trend" icon={ShoppingCart}>
              {ordersTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ordersTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" strokeOpacity={0.5} />
                      <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#ordGrad)" name="Orders" dot={false} activeDot={{ r: 5, fill: '#10b981', stroke: '#1e293b', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={ShoppingCart} title="No order data" sub="No orders created in this date range" />
              )}
            </ChartCard>
          </div>

          {/* Three Column: Payment Status, Order Status, Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ChartCard title="Payment Status" icon={CreditCard}>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Paid', value: paymentBD.paidOrders || 0 },
                      { name: 'Pending', value: paymentBD.pendingPaymentOrders || 0 }
                    ]} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                      {paymentBD.paidOrders > 0 && <Cell fill={COLORS.emerald} />}
                      {paymentBD.pendingPaymentOrders > 0 && <Cell fill={COLORS.amber} />}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Order Status" icon={Layers}>
              <div className="h-52">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={Activity} title="No orders" sub="No orders in this date range" />
                )}
              </div>
            </ChartCard>

            <ChartCard title="Inventory Status" icon={AlertTriangle}>
              <div className="h-52 flex flex-col justify-center">
                {invOverview.total ? (
                  <div className="space-y-4 px-2">
                    {[
                      { label: 'In Stock', value: invOverview.inStock || 0, color: COLORS.emerald, pct: Math.round((invOverview.inStock / invOverview.total) * 100) },
                      { label: 'Low Stock (≤5)', value: invOverview.lowStock || 0, color: COLORS.amber, pct: Math.round((invOverview.lowStock / invOverview.total) * 100) },
                      { label: 'Out of Stock', value: invOverview.outOfStock || 0, color: COLORS.red, pct: Math.round((invOverview.outOfStock / invOverview.total) * 100) }
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400 font-bold">{item.label}</span>
                          <span className="font-black text-white">{item.value}</span>
                        </div>
                        <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ duration: 1, delay: 0.2 }}
                            className="h-full rounded-full" style={{ backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-600 font-semibold text-center pt-1">{invOverview.total} total items</p>
                  </div>
                ) : (
                  <EmptyState icon={Package} title="No inventory data" sub="Inventory not loaded yet" />
                )}
              </div>
            </ChartCard>
          </div>

          {/* Bottom Row: Top Products + Order Types + Recent Orders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ChartCard title="Top Selling Products" icon={Award} className="md:col-span-1">
              {topProducts.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 70, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" strokeOpacity={0.5} horizontal={false} />
                      <XAxis type="number" stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} width={65} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937' }} />
                      <Bar dataKey="qty" radius={[0, 6, 6, 0]} barSize={16}>
                        {topProducts.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={Award} title="No product data" sub="No products sold in this range" />
              )}
            </ChartCard>

            <ChartCard title="Order Types" icon={Layers}>
              <div className="h-64">
                {orderTypeDist.length > 0 ? (
                  <div className="space-y-3 px-2 pt-2">
                    {orderTypeDist.map((t, i) => (
                      <div key={t.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300 font-bold capitalize">{t.name.toLowerCase()}</span>
                            <span className="text-white font-black">{t.count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((t.count / Math.max(...orderTypeDist.map(x => x.count))) * 100)}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                              className="h-full rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Layers} title="No order types" sub="No orders in this range" />
                )}
              </div>
            </ChartCard>

            <ChartCard title="Recent Orders" icon={Eye}>
              <div className="h-64 overflow-y-auto custom-scrollbar space-y-2 -mx-1 px-1">
                {recentOrdersLoading ? (
                  <div className="space-y-2">
                    {[1,2,3,4].map(i => <div key={i} className="bg-gray-800/40 rounded-xl p-3 animate-pulse h-14" />)}
                  </div>
                ) : recentOrders.length > 0 ? (
                  recentOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between bg-gray-800/30 hover:bg-gray-800/50 rounded-xl p-3 transition-all group cursor-default border border-transparent hover:border-gray-700/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white truncate">{o.orderNumber}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${o.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : o.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : o.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{o.status === 'IN_PROGRESS' ? 'IN PRGRSS' : o.status}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{o.customerName || 'No name'}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs font-black text-emerald-400">{o.totalPrice ? formatCurrency(o.totalPrice) : '-'}</p>
                        <p className="text-[9px] text-gray-600">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-PK') : ''}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState icon={Eye} title="No recent orders" sub="Recent outlet orders will appear here" />
                )}
              </div>
            </ChartCard>
          </div>
        </>
      ) : null}
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg shadow-blue-600/20">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{outletName}</h1>
            <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">Outlet Dashboard</p>
          </div>
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 bg-gray-800/90 border border-gray-700/50 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-gray-800 transition-all" onClick={e => { e.stopPropagation(); setShowTabDropdown(!showTabDropdown); }}>
            {(() => {
              const t = tabs.find(t => t.id === activeTab);
              if (!t) return null;
              const Icon = t.icon;
              return <><Icon size={14} className="text-blue-400" /><span className="text-xs font-bold text-white">{t.label}</span></>;
            })()}
            <ChevronDown size={14} className="text-gray-500" />
          </div>
          {showTabDropdown && (
            <div className="absolute right-0 top-full mt-1.5 bg-gray-900/95 backdrop-blur-sm border border-gray-700/80 rounded-xl shadow-2xl z-50 min-w-[190px] overflow-hidden" onClick={e => e.stopPropagation()}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowTabDropdown(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-xs font-bold transition-all hover:bg-gray-800/80 ${activeTab === tab.id ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'}`}>
                    <Icon size={14} />
                    {tab.label}
                    {tab.badge > 0 && <span className="ml-auto bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'dashboard' && renderDashboardTab()}

      {activeTab === 'pos-dashboard' && <OutletPOSDashboard outlet={outletName} />}

      {activeTab === 'invoices' && <OutletInvoiceHistory outlet={outletName} />}

      {activeTab === 'tracking' && (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-lg">
            <form onSubmit={handleTrackOrder} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="text" placeholder="Enter order number (JT-, JL-, AB-...)" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 uppercase tracking-wider" />
              </div>
              <button type="submit" disabled={trackingLoading}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20">
                {trackingLoading ? <RefreshCcw className="animate-spin" size={16} /> : <Search size={16} />} Track
              </button>
            </form>
          </motion.div>

          {trackedOrder && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-blue-400" /> Order Timeline
                </h3>
                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-sm">No timeline entries found</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {timeline.map(entry => <TimelineEntry key={entry.id} entry={entry} />)}
                  </div>
                )}
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 space-y-4 shadow-lg">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Order Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Order #</p>
                    <p className="text-white font-black">{trackedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Customer</p>
                    <p className="text-white font-bold">{trackedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${trackedOrder.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : trackedOrder.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-300'}`}>{trackedOrder.status}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Stage</p>
                    <p className="text-white font-bold">{trackedOrder.currentStage?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Created</p>
                    <p className="text-white font-bold">{new Date(trackedOrder.createdAt).toLocaleString('en-PK')}</p>
                  </div>
                  {trackedOrder.totalPrice > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total</p>
                      <p className="text-white font-black text-lg">PKR {trackedOrder.totalPrice.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{tasks.length} order{tasks.length !== 1 ? 's' : ''} returned to outlet</p>
            <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all border border-gray-700/50">
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}
            </div>
          ) : tasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-12 text-center shadow-lg">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-500 font-bold">No tasks pending</p>
              <p className="text-xs text-gray-600 mt-1">Returned orders will appear here</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(order => {
                const products = order.productDetails || [];
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/80 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-6 space-y-4 shadow-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-black text-white">{order.orderNumber}</p>
                        <p className="text-sm text-gray-400">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-gray-500">{order.customerPhone}</p>}
                      </div>
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">RETURNS</span>
                    </div>
                    {products.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Products</p>
                        {products.map((p, i) => (
                          <p key={i} className="text-xs text-gray-300">{p.name} {p.color ? `(${p.color}` : ''}{p.size ? ` / ${p.size}` : ''}{p.color || p.size ? ')' : ''} × {p.quantity || 1}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar size={12} />
                      {new Date(order.createdAt).toLocaleDateString('en-PK')}
                      {order.totalPrice > 0 && <span className="ml-auto font-bold text-white">PKR {order.totalPrice.toLocaleString()}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                      <button onClick={() => handleFinalAction(order.id, 'dispatch')} disabled={actionLoading === order.id + 'dispatch'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'dispatch' ? <RefreshCcw className="animate-spin" size={14} /> : <Send size={14} />} Dispatch
                      </button>
                      <button onClick={() => handleFinalAction(order.id, 'inhouse')} disabled={actionLoading === order.id + 'inhouse'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'inhouse' ? <RefreshCcw className="animate-spin" size={14} /> : <Truck size={14} />} In-House
                      </button>
                      <button onClick={() => handleFinalAction(order.id, 'customer-taken')} disabled={actionLoading === order.id + 'customer-taken'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'customer-taken' ? <RefreshCcw className="animate-spin" size={14} /> : <UserCheck size={14} />} Customer
                      </button>
                    </div>
                    <div className="flex gap-1 text-[10px] text-gray-600 justify-center">
                      <span className="flex items-center gap-1"><Send size={10} className="text-blue-400" /> Dispatch</span>
                      <span className="mx-1">|</span>
                      <span className="flex items-center gap-1"><Truck size={10} className="text-emerald-400" /> In-House</span>
                      <span className="mx-1">|</span>
                      <span className="flex items-center gap-1"><UserCheck size={10} className="text-violet-400" /> Customer</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutletDashboard;
