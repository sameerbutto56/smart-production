import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Search, Clock, CheckCircle, XCircle,
  Package, Truck, UserCheck, Send,
  RefreshCcw, Calendar, ListChecks, BarChart3, DollarSign,
  ChevronDown, TrendingUp, ShoppingCart, AlertTriangle,
  CreditCard, Globe, Layers, Award
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

const DatePresetButtons = ({ value, onChange }) => {
  const presets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
    { label: '3M', value: '3m' },
    { label: 'All', value: '' }
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(p => (
        <button key={p.value} onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${value === p.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, sub, gradient }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`bg-gradient-to-br ${gradient} p-[1px] rounded-2xl shadow-lg`}>
    <div className="bg-gray-950/90 rounded-2xl p-4 h-full flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
        <Icon size={14} className="text-gray-500" />
      </div>
      <div>
        <p className="text-xl md:text-2xl font-black text-white">{value}</p>
        {sub && <p className="text-[10px] text-gray-500 font-bold mt-1">{sub}</p>}
      </div>
    </div>
  </motion.div>
);

const TimelineEntry = ({ entry }) => (
  <div className="flex gap-3 py-2">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full ${entry.type === 'route' ? 'bg-blue-500' : entry.type === 'stage' && entry.status === 'COMPLETED' ? 'bg-emerald-500' : entry.type === 'stage' && entry.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-gray-600'}`} />
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

const ChartCard = ({ title, icon: Icon, children, className = '' }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`bg-gray-900 border border-gray-800 rounded-2xl p-4 ${className}`}>
    <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-1.5">
      {Icon && <Icon size={14} className="text-blue-500" />} {title}
    </h3>
    {children}
  </motion.div>
);

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const OutletDashboard = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const [datePreset, setDatePreset] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Tracking
  const [trackingNumber, setTrackingNumber] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState(null);

  // Tasks
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
    if (activeTab === 'dashboard') fetchAnalytics(datePreset);
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, datePreset, fetchAnalytics, fetchTasks]);

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

  const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

  const a = analytics || {};
  const orderStats = a.orderStats || {};
  const paymentBD = a.paymentBreakdown || {};
  const salesTrend = a.salesTrend || [];
  const ordersTrend = a.ordersTrend || [];
  const topProducts = a.topProducts || [];
  const orderTypeDist = a.orderTypeDistribution || [];
  const invOverview = a.inventoryOverview || {};
  const posSummary = a.posSummary || {};

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos-dashboard', label: 'POS Dashboard', icon: BarChart3 },
    { id: 'invoices', label: 'Total Invoices', icon: DollarSign },
    { id: 'tracking', label: 'Order Track', icon: Search },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, badge: tasks.length }
  ];

  const renderDashboardTab = () => (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-bold mb-2">Date Range</p>
        <DatePresetButtons value={datePreset} onChange={setDatePreset} />
      </div>

      {analyticsLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-gray-900/60 rounded-2xl p-6 animate-pulse h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1,2].map(i => <div key={i} className="bg-gray-900/60 rounded-2xl p-6 animate-pulse h-64" />)}
          </div>
        </div>
      ) : analyticsError ? (
        <div className="py-16 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="text-red-400 mb-2" size={32} />
          <p className="text-red-400 font-black text-sm mb-2">Failed to load analytics</p>
          <button onClick={() => fetchAnalytics(datePreset)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-xs">Retry</button>
        </div>
      ) : analytics ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="Total Orders" value={orderStats.totalOrders || 0} sub={`${orderStats.inProgressOrders || 0} in progress`} gradient="from-blue-600 to-cyan-600" />
            <KpiCard icon={Clock} label="Pending" value={orderStats.pendingOrders || 0} sub="Awaiting acceptance" gradient="from-amber-600 to-yellow-600" />
            <KpiCard icon={CheckCircle} label="Completed" value={orderStats.completedOrders || 0} sub="Delivered to customer" gradient="from-emerald-600 to-green-600" />
            <KpiCard icon={XCircle} label="Cancelled" value={orderStats.cancelledOrders || 0} sub="Rejected / Cancelled" gradient="from-red-600 to-pink-600" />
          </div>

          {/* Revenue & Orders Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Revenue Trend" icon={TrendingUp}>
              {salesTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrend}>
                      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `₨${(v/1000)}k`} />
                      <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" name="Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 text-sm font-bold">No revenue data in this range</div>
              )}
            </ChartCard>

            <ChartCard title="Orders Trend" icon={ShoppingCart}>
              {ordersTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ordersTrend}>
                      <defs><linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#ordGrad)" name="Orders" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 text-sm font-bold">No order data in this range</div>
              )}
            </ChartCard>
          </div>

          {/* Payment Breakdown + Order Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Payment Status" icon={CreditCard}>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Paid', value: paymentBD.paidOrders || 0 },
                      { name: 'Pending', value: paymentBD.pendingPaymentOrders || 0 }
                    ]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      <Cell fill={COLORS.emerald} />
                      <Cell fill={COLORS.amber} />
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Order Types" icon={Layers}>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={orderTypeDist.length > 0 ? orderTypeDist : [{ name: 'No Data', value: 1 }]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="count">
                      {orderTypeDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      {orderTypeDist.length === 0 && <Cell fill="#374151" />}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Inventory Status" icon={AlertTriangle}>
              <div className="h-48 flex flex-col justify-center">
                <div className="space-y-3 px-2">
                  {[
                    { label: 'In Stock', value: invOverview.inStock || 0, color: COLORS.emerald, pct: invOverview.total ? Math.round((invOverview.inStock / invOverview.total) * 100) : 0 },
                    { label: 'Low Stock', value: invOverview.lowStock || 0, color: COLORS.amber, pct: invOverview.total ? Math.round((invOverview.lowStock / invOverview.total) * 100) : 0 },
                    { label: 'Out of Stock', value: invOverview.outOfStock || 0, color: COLORS.red, pct: invOverview.total ? Math.round((invOverview.outOfStock / invOverview.total) * 100) : 0 }
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 font-bold">{item.label}</span>
                        <span className="font-bold text-white">{item.value}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                  {!invOverview.total && <p className="text-center text-gray-500 text-xs font-bold py-4">No inventory data</p>}
                </div>
              </div>
            </ChartCard>
          </div>

          {/* Top Products + POS Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Top Selling Products" icon={Award}>
              {topProducts.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                      <XAxis type="number" stroke="#9ca3af" fontSize={10} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} width={75} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                        {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500 text-sm font-bold">No product data in this range</div>
              )}
            </ChartCard>

            <ChartCard title="POS Summary" icon={ShoppingCart}>
              <div className="h-64 flex flex-col justify-center items-center text-center">
                <div className="grid grid-cols-2 gap-6 w-full px-4">
                  <div className="bg-gray-950 rounded-2xl p-4 border border-gray-800">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">POS Revenue</p>
                    <p className="text-xl font-black text-emerald-400">{formatCurrency(posSummary.totalSales)}</p>
                  </div>
                  <div className="bg-gray-950 rounded-2xl p-4 border border-gray-800">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">POS Orders</p>
                    <p className="text-xl font-black text-blue-400">{posSummary.orderCount || 0}</p>
                  </div>
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <LayoutDashboard className="text-blue-400" size={24} />
          {outletName} — Dashboard
        </h1>
        <div className="relative">
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-2 cursor-pointer" onClick={e => { e.stopPropagation(); setShowTabDropdown(!showTabDropdown); }}>
            {(() => {
              const t = tabs.find(t => t.id === activeTab);
              if (!t) return null;
              const Icon = t.icon;
              return <><Icon size={14} className="text-blue-400" /><span className="text-xs font-bold text-white">{t.label}</span></>;
            })()}
            <ChevronDown size={14} className="text-gray-500" />
          </div>
          {showTabDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden" onClick={e => e.stopPropagation()}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setShowTabDropdown(false); }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs font-bold transition-all hover:bg-gray-800 ${activeTab === tab.id ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'}`}>
                    <Icon size={14} />
                    {tab.label}
                    {tab.badge > 0 && <span className="ml-auto bg-amber-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{tab.badge}</span>}
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
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
            <form onSubmit={handleTrackOrder} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input type="text" placeholder="Enter order number (JT-, JL-, AB-...)" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 uppercase tracking-wider" />
              </div>
              <button type="submit" disabled={trackingLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2">
                {trackingLoading ? <RefreshCcw className="animate-spin" size={16} /> : <Search size={16} />} Track
              </button>
            </form>
          </div>

          {trackedOrder && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Order Timeline</h3>
                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-sm">No timeline entries found</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {timeline.map(entry => <TimelineEntry key={entry.id} entry={entry} />)}
                  </div>
                )}
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Order Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Order #</p>
                    <p className="text-white font-bold">{trackedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Customer</p>
                    <p className="text-white font-bold">{trackedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trackedOrder.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : trackedOrder.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-300'}`}>{trackedOrder.status}</span>
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
                      <p className="text-white font-bold">₨{trackedOrder.totalPrice.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{tasks.length} order{tasks.length !== 1 ? 's' : ''} returned to outlet</p>
            <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all">
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="bg-gray-900/60 rounded-2xl p-6 animate-pulse h-32" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-12 text-center">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-500 font-bold">No tasks pending</p>
              <p className="text-xs text-gray-600 mt-1">Returned orders will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(order => {
                const products = order.productDetails || [];
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/60 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-6 space-y-4">
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
                      {order.totalPrice > 0 && <span className="ml-auto font-bold text-white">₨{order.totalPrice.toLocaleString()}</span>}
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