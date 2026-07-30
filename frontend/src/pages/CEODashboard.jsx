import React, { useState, useCallback, useMemo, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users,
  BarChart3, PieChart, Activity, Calendar, Download, RefreshCcw,
  ChevronDown, Filter, X, Building2, Factory, Truck, CreditCard,
  Target, Award, AlertTriangle, Clock, Eye, Sparkles, ArrowUpRight,
  Globe, Store, UserCheck, UserMinus, Zap, Shield, Layers,
  FileText, Hash, Percent, Circle, CircleDot, Loader2
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart as RePie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16'];

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const LABELS = { revenue: 'Revenue', profit: 'Profit', cost: 'Cost', count: 'Count', sales: 'Sales', orders: 'Orders', units: 'Units' };

const formatCurrency = (n) => {
  if (n === null || n === undefined) return '₨0';
  return '₨' + Number(n).toLocaleString('en-US');
};

const formatPercent = (n) => {
  if (n === null || n === undefined) return '0%';
  return (n >= 0 ? '+' : '') + Number(n).toFixed(1) + '%';
};

const KpiCard = ({ title, value, subtitle, icon: Icon, color, trend, trendLabel, onClick }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 mb-0.5">{title}</p>
    <p className="text-xs font-medium text-gray-500">{subtitle}</p>
    {trendLabel && <p className="text-[10px] text-gray-400 mt-1">{trendLabel}</p>}
  </motion.div>
);

const SectionCard = ({ title, icon: Icon, color, children, className = '' }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? formatCurrency(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};

const CEODashboard = () => {
  const { user } = useAuth();
  const [range, setRange] = useState('thisMonth');
  const [branch, setBranch] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({});
  const [activeSection, setActiveSection] = useState('overview');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = { range };
    if (branch !== 'all') params.branch = branch;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    try {
      const [overview, sales, financial, branches, orders, products, inventory, production, employees, payments, customization] = await Promise.all([
        api.get('/api/ceo/overview', { params }).then(r => r.data),
        api.get('/api/ceo/sales', { params }).then(r => r.data),
        api.get('/api/ceo/financial', { params }).then(r => r.data),
        api.get('/api/ceo/branches', { params }).then(r => r.data),
        api.get('/api/ceo/orders', { params }).then(r => r.data),
        api.get('/api/ceo/products', { params }).then(r => r.data),
        api.get('/api/ceo/inventory', { params }).then(r => r.data),
        api.get('/api/ceo/production', { params }).then(r => r.data),
        api.get('/api/ceo/employees', { params }).then(r => r.data),
        api.get('/api/ceo/payments', { params }).then(r => r.data),
        api.get('/api/ceo/customization', { params }).then(r => r.data),
      ]);
      setData({ overview, sales, financial, branches, orders, products, inventory, production, employees, payments, customization });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
    setLoading(false);
  }, [range, branch, dateFrom, dateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sections = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Layers },
    { id: 'production', label: 'Production', icon: Factory },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'customization', label: 'Custom', icon: Sparkles },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-indigo-600 font-bold text-sm">Loading Executive Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-red-100 max-w-md text-center space-y-4">
          <AlertTriangle size={40} className="text-red-400 mx-auto" />
          <p className="text-red-600 font-bold">Failed to load dashboard</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={fetchAll} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-500 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, sales, financial, branches, orders, products, inventory, production, employees, payments, customization } = data;
  const s = overview?.summary || {};
  const g = overview?.growth || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200">
              <BarChart3 size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Executive Dashboard</h1>
              <p className="text-sm font-medium text-gray-500">CEO Portal — {user?.name || 'Enamels'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600'}`}>
              <Filter size={14} /> Filters
            </button>
            <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl text-sm font-bold hover:border-indigo-200 hover:text-indigo-600 transition-all">
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Period</label>
                  <div className="flex flex-wrap gap-1.5">
                    {RANGES.map(r => (
                      <button key={r.value} onClick={() => setRange(r.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${range === r.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Branch</label>
                  <select value={branch} onChange={e => setBranch(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:border-indigo-300 outline-none">
                    <option value="all">All Branches</option>
                    <option value="Johar Town">Johar Town</option>
                    <option value="Jail Road">Jail Road</option>
                    <option value="Abbottabad">Abbottabad</option>
                    <option value="online">Online Store</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:border-indigo-300 outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:border-indigo-300 outline-none" />
                </div>
                {(dateFrom || dateTo || branch !== 'all' || range !== 'thisMonth') && (
                  <button onClick={() => { setRange('thisMonth'); setBranch('all'); setDateFrom(''); setDateTo(''); }}
                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                    Reset
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {sections.map(sec => (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${activeSection === sec.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-indigo-200 hover:text-indigo-600'}`}>
              <sec.icon size={12} /> {sec.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════ OVERVIEW ═══════════════════ */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={formatCurrency(s.totalRevenue)} subtitle="Total Revenue" icon={DollarSign} color="bg-gradient-to-br from-emerald-500 to-emerald-600" trend={g.businessGrowth} trendLabel="vs previous period" />
              <KpiCard title={formatCurrency(s.totalProfit)} subtitle="Total Profit" icon={Target} color="bg-gradient-to-br from-blue-500 to-blue-600" trend={g.salesGrowth} trendLabel="Growth rate" />
              <KpiCard title={s.profitMargin?.toFixed(1) + '%'} subtitle="Profit Margin" icon={Percent} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={String(s.totalSales)} subtitle={`Total Sales · ${s.totalOrders} Orders`} icon={ShoppingCart} color="bg-gradient-to-br from-orange-500 to-orange-600" />
              <KpiCard title={formatCurrency(s.totalCost)} subtitle="Product Cost" icon={TrendingDown} color="bg-gradient-to-br from-rose-500 to-rose-600" />
              <KpiCard title={formatCurrency(s.totalExpenses)} subtitle="Total Expenses" icon={FileText} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={formatCurrency(s.totalDeposits)} subtitle="Bank Deposits" icon={Building2} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <KpiCard title={String(s.totalProducts)} subtitle="Products in Inventory" icon={Package} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
            </div>

            {/* Sales Trend Chart */}
            <SectionCard title="Sales Trend" icon={Activity} color="bg-gradient-to-br from-indigo-500 to-purple-600">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={sales?.salesTrend || []}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>

            {/* Branch Performance Summary */}
            {branches?.branches && branches.branches.length > 0 && (
              <SectionCard title="Branch Performance" icon={Building2} color="bg-gradient-to-br from-blue-500 to-cyan-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {branches.branches.map((b, i) => (
                    <div key={b.name} className={`p-4 rounded-xl border ${i === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-800">{b.name}</p>
                        {i === 0 && <Award size={16} className="text-emerald-500" />}
                      </div>
                      <p className="text-xl font-extrabold text-gray-900">{formatCurrency(b.revenue)}</p>
                      <p className="text-xs text-gray-500">{b.orders} orders · {formatCurrency(b.grandTotal)} gross</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ═══════════════════ SALES ═══════════════════ */}
        {activeSection === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={formatCurrency(sales?.totalRevenue)} subtitle="Total Sales Revenue" icon={DollarSign} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={String(sales?.totalSales)} subtitle="Total Transactions" icon={ShoppingCart} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={formatCurrency(sales?.onlineSales?.revenue || 0)} subtitle="Online Sales" icon={Globe} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={formatCurrency(sales?.outletSales?.revenue || 0)} subtitle="Outlet Sales" icon={Store} color="bg-gradient-to-br from-orange-500 to-orange-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Sales by Branch" icon={Building2} color="bg-gradient-to-br from-indigo-500 to-purple-600">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sales?.branchPerformance || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Payment Method Breakdown" icon={PieChart} color="bg-gradient-to-br from-pink-500 to-rose-500">
                <ResponsiveContainer width="100%" height={280}>
                  <RePie>
                    <Pie data={sales?.paymentBreakdown || []} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {(sales?.paymentBreakdown || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RePie>
                </ResponsiveContainer>
              </SectionCard>
            </div>

            <SectionCard title="Sales Trend" icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-500">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={sales?.salesTrend || []}>
                  <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#salesGrad)" strokeWidth={2} name="Revenue" />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fill="none" strokeWidth={2} name="Count" />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>

            {sales?.productSales && sales.productSales.length > 0 && (
              <SectionCard title="Top Products" icon={Package} color="bg-gradient-to-br from-amber-500 to-orange-500">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-bold">Product</th>
                      <th className="pb-2 font-bold text-right">Qty Sold</th>
                      <th className="pb-2 font-bold text-right">Revenue</th>
                      <th className="pb-2 font-bold text-right">Sales</th>
                    </tr></thead>
                    <tbody>
                      {sales.productSales.slice(0, 15).map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{p.name}</td>
                          <td className="py-2 text-right font-bold text-gray-700">{p.totalQty}</td>
                          <td className="py-2 text-right font-bold text-emerald-600">{formatCurrency(p.totalRevenue)}</td>
                          <td className="py-2 text-right text-gray-500">{p.saleCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ═══════════════════ FINANCIAL ═══════════════════ */}
        {activeSection === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={formatCurrency(financial?.grossProfit)} subtitle="Gross Profit" icon={DollarSign} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={formatCurrency(financial?.netProfit)} subtitle="Net Profit" icon={Target} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={financial?.profitMargin?.toFixed(1) + '%'} subtitle="Profit Margin" icon={Percent} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={formatCurrency(financial?.totalRevenue)} subtitle="Total Revenue" icon={TrendingUp} color="bg-gradient-to-br from-orange-500 to-orange-600" />
              <KpiCard title={formatCurrency(financial?.totalCost)} subtitle="Total Cost" icon={TrendingDown} color="bg-gradient-to-br from-rose-500 to-rose-600" />
              <KpiCard title={formatCurrency(financial?.totalExpenses)} subtitle="Total Expenses" icon={FileText} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={formatCurrency(financial?.totalDeposits)} subtitle="Bank Deposits" icon={Building2} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <KpiCard title={formatCurrency(financial?.outstandingReceivables)} subtitle="Outstanding Receivables" icon={AlertTriangle} color="bg-gradient-to-br from-red-500 to-red-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Expense Breakdown" icon={FileText} color="bg-gradient-to-br from-amber-500 to-orange-500">
                <div className="space-y-3">
                  {(financial?.expenseBreakdown || []).slice(0, 10).map((e, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs font-medium text-gray-700">{e.name}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                  {(!financial?.expenseBreakdown || financial.expenseBreakdown.length === 0) && <p className="text-xs text-gray-400 text-center py-4">No expense data</p>}
                </div>
              </SectionCard>

              <SectionCard title="Profit by Branch" icon={Building2} color="bg-gradient-to-br from-emerald-500 to-teal-500">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={financial?.profitByBranch || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} name="Profit" />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[0, 4, 4, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════════════ BRANCHES ═══════════════════ */}
        {activeSection === 'branches' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={branches?.bestPerforming?.name || '-'} subtitle="Best Performing Branch" icon={Award} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={branches?.lowestPerforming?.name || '-'} subtitle="Lowest Performing" icon={TrendingDown} color="bg-gradient-to-br from-rose-500 to-rose-600" />
              <KpiCard title={String(branches?.onlineStore?.orders || 0)} subtitle="Online Orders" icon={Globe} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={formatCurrency(branches?.onlineStore?.revenue || 0)} subtitle="Online Store Revenue" icon={DollarSign} color="bg-gradient-to-br from-purple-500 to-purple-600" />
            </div>

            <SectionCard title="Branch Comparison" icon={Building2} color="bg-gradient-to-br from-indigo-500 to-purple-600">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={branches?.branches || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="grandTotal" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Grand Total" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Monthly Growth Trend" icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-500">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={branches?.growthData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4 }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════ ORDERS ═══════════════════ */}
        {activeSection === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={String(orders?.totalOrders)} subtitle="Total Orders" icon={ShoppingCart} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={orders?.completionRate + '%' || '0%'} subtitle="Completion Rate" icon={Target} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={String(orders?.delivered)} subtitle="Delivered" icon={Truck} color="bg-gradient-to-br from-green-500 to-green-600" />
              <KpiCard title={String(orders?.pending)} subtitle="Pending" icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={String(orders?.cancelled)} subtitle="Cancelled" icon={X} color="bg-gradient-to-br from-rose-500 to-rose-600" />
              <KpiCard title={String(orders?.returned)} subtitle="Returned" icon={AlertTriangle} color="bg-gradient-to-br from-red-500 to-red-600" />
              <KpiCard title={String(orders?.superUrgent)} subtitle="Super Urgent" icon={Zap} color="bg-gradient-to-br from-orange-500 to-orange-600" />
              <KpiCard title={String(orders?.onlineOrders)} subtitle="Online Orders" icon={Globe} color="bg-gradient-to-br from-purple-500 to-purple-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Orders by Branch" icon={Building2} color="bg-gradient-to-br from-indigo-500 to-purple-600">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={orders?.ordersByBranch || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} name="Total" />
                    <Bar dataKey="delivered" fill="#10b981" radius={[0, 4, 4, 0]} name="Delivered" />
                    <Bar dataKey="pending" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Monthly Order Trend" icon={Activity} color="bg-gradient-to-br from-cyan-500 to-blue-500">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={orders?.orderTrend || []}>
                    <defs><linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#06b6d4" fill="url(#orderGrad)" strokeWidth={2} name="Total" />
                    <Area type="monotone" dataKey="delivered" stroke="#10b981" fill="none" strokeWidth={2} name="Delivered" />
                  </AreaChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════════════ PRODUCTS ═══════════════════ */}
        {activeSection === 'products' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={String(products?.totalProducts || 0)} subtitle="Products Sold" icon={Package} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
              <KpiCard title={String(products?.bestSelling?.length || 0)} subtitle="Best Selling (Top 10)" icon={Award} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={String(products?.highReturn?.length || 0)} subtitle="High Return Products" icon={AlertTriangle} color="bg-gradient-to-br from-red-500 to-red-600" />
              <KpiCard title={String(products?.slowMoving?.length || 0)} subtitle="Slow Moving" icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Best Selling Products" icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-500">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-bold">Product</th>
                      <th className="pb-2 font-bold text-right">Qty</th>
                      <th className="pb-2 font-bold text-right">Revenue</th>
                    </tr></thead>
                    <tbody>
                      {(products?.bestSelling || []).map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{p.name}</td>
                          <td className="py-2 text-right font-bold text-gray-700">{p.totalQty}</td>
                          <td className="py-2 text-right font-bold text-emerald-600">{formatCurrency(p.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="High Return Products" icon={AlertTriangle} color="bg-gradient-to-br from-red-500 to-rose-500">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-bold">Product</th>
                      <th className="pb-2 font-bold text-right">Return Qty</th>
                    </tr></thead>
                    <tbody>
                      {(products?.highReturn || []).map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{p.name}</td>
                          <td className="py-2 text-right font-bold text-red-600">{p.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Product Performance Ranking" icon={BarChart3} color="bg-gradient-to-br from-amber-500 to-orange-500">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(products?.allProducts || []).slice(0, 20)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={120} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalRevenue" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════ INVENTORY ═══════════════════ */}
        {activeSection === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={String(inventory?.totalItems || 0)} subtitle="Total Products" icon={Package} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
              <KpiCard title={String(inventory?.totalStock || 0)} subtitle="Warehouse Stock" icon={Layers} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={formatCurrency(inventory?.totalValue || 0)} subtitle="Inventory Value" icon={DollarSign} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={String(inventory?.turnoverRatio || '0.00')} subtitle="Turnover Ratio" icon={Activity} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={String(inventory?.lowStockCount || 0)} subtitle="Low Stock Items" icon={AlertTriangle} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={String(inventory?.outOfStockCount || 0)} subtitle="Out of Stock" icon={X} color="bg-gradient-to-br from-red-500 to-red-600" />
              <KpiCard title={String(inventory?.overstockCount || 0)} subtitle="Overstock Items" icon={TrendingUp} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard title="Branch Inventory" icon={Building2} color="bg-gradient-to-br from-indigo-500 to-purple-600">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inventory?.branchInventory || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="stock" fill="#6366f1" radius={[0, 4, 4, 0]} name="Stock" />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Value" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Low Stock Alerts" icon={AlertTriangle} color="bg-gradient-to-br from-amber-500 to-red-500">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-bold">Product</th>
                      <th className="pb-2 font-bold text-right">Stock</th>
                    </tr></thead>
                    <tbody>
                      {(inventory?.lowStockItems || []).slice(0, 10).map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{item.name || item.productName}</td>
                          <td className="py-2 text-right font-bold text-amber-600">{item.stock}</td>
                        </tr>
                      ))}
                      {(!inventory?.lowStockItems || inventory.lowStockItems.length === 0) && <tr><td colSpan={2} className="py-4 text-center text-gray-400">No low stock items</td></tr>}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════════════ PRODUCTION ═══════════════════ */}
        {activeSection === 'production' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={String(production?.totalUnits || 0)} subtitle="Total Units Produced" icon={Factory} color="bg-gradient-to-br from-indigo-500 to-indigo-600" />
              <KpiCard title={String(production?.unit1Output || 0)} subtitle="Production Unit 1" icon={Layers} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={String(production?.unit2Output || 0)} subtitle="Production Unit 2" icon={Layers} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={String(production?.unitsReceived || 0)} subtitle="Units to Warehouse" icon={Package} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
            </div>

            <SectionCard title="Daily Production" icon={Activity} color="bg-gradient-to-br from-amber-500 to-orange-500">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={production?.dailyProduction || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="units" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Units" />
                  <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════ EMPLOYEES ═══════════════════ */}
        {activeSection === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={employees?.bestEmployee || '-'} subtitle="Best Sales Employee" icon={UserCheck} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={employees?.lowestEmployee || '-'} subtitle="Lowest Sales Employee" icon={UserMinus} color="bg-gradient-to-br from-rose-500 to-rose-600" />
              <KpiCard title={String(employees?.employeeSalesRanking?.length || 0)} subtitle="Active Sales Staff" icon={Users} color="bg-gradient-to-br from-blue-500 to-blue-600" />
            </div>

            <SectionCard title="Employee Sales Ranking" icon={Users} color="bg-gradient-to-br from-indigo-500 to-purple-600">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-bold">#</th>
                    <th className="pb-2 font-bold">Employee</th>
                    <th className="pb-2 font-bold text-right">Total Sales</th>
                    <th className="pb-2 font-bold text-right">Revenue</th>
                    <th className="pb-2 font-bold text-right">Orders</th>
                  </tr></thead>
                  <tbody>
                    {(employees?.employeeSalesRanking || []).slice(0, 20).map((emp, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-bold text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium text-gray-800">{emp.name}</td>
                        <td className="py-2 text-right font-bold text-gray-700">{formatCurrency(emp.totalSales)}</td>
                        <td className="py-2 text-right font-bold text-emerald-600">{formatCurrency(emp.totalRevenue)}</td>
                        <td className="py-2 text-right text-gray-500">{emp.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Employee Productivity (Actions)" icon={Activity} color="bg-gradient-to-br from-cyan-500 to-blue-500">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(employees?.employeeProductivity || []).slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="actions" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════ PAYMENTS ═══════════════════ */}
        {activeSection === 'payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={formatCurrency(payments?.cashPayments?.total || 0)} subtitle="Cash Payments" icon={DollarSign} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={formatCurrency(payments?.cardPayments?.total || 0)} subtitle="Card Payments" icon={CreditCard} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <KpiCard title={formatCurrency(payments?.onlinePayments?.total || 0)} subtitle="Online Payments" icon={Globe} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={formatCurrency(payments?.codPayments?.total || 0)} subtitle="COD Orders" icon={Truck} color="bg-gradient-to-br from-orange-500 to-orange-600" />
              <KpiCard title={formatCurrency(payments?.advancePayments?.total || 0)} subtitle="Advance Payments" icon={ArrowUpRight} color="bg-gradient-to-br from-cyan-500 to-cyan-600" />
              <KpiCard title={String(payments?.pendingPayments || 0)} subtitle="Pending Payments" icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={formatCurrency(payments?.paidOrders?.total || 0)} subtitle="Paid Orders" icon={Shield} color="bg-gradient-to-br from-green-500 to-green-600" />
            </div>

            <SectionCard title="Payment Collection Trend" icon={TrendingUp} color="bg-gradient-to-br from-indigo-500 to-purple-600">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={payments?.collectionTrend || []}>
                  <defs><linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => '₨' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#cashGrad)" strokeWidth={2} name="Total" />
                  <Area type="monotone" dataKey="cash" stroke="#10b981" fill="none" strokeWidth={2} name="Cash" />
                  <Area type="monotone" dataKey="online" stroke="#8b5cf6" fill="none" strokeWidth={2} name="Online" />
                  <Area type="monotone" dataKey="card" stroke="#3b82f6" fill="none" strokeWidth={2} name="Card" />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════ CUSTOMIZATION ═══════════════════ */}
        {activeSection === 'customization' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title={String(customization?.totalCustomized || 0)} subtitle="Total Custom Orders" icon={Sparkles} color="bg-gradient-to-br from-purple-500 to-purple-600" />
              <KpiCard title={String(customization?.completedCustom || 0)} subtitle="Completed" icon={CheckCircle} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <KpiCard title={String(customization?.pendingCustom || 0)} subtitle="Pending" icon={Clock} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <KpiCard title={String(customization?.ordersWithEngraving || 0)} subtitle="With Engraving" icon={Sparkles} color="bg-gradient-to-br from-pink-500 to-pink-600" />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6 text-[10px] font-medium text-gray-400 border-t border-gray-100">
          Enamels CEO Portal · Data refreshed {new Date().toLocaleString()} · All figures in PKR
        </div>
      </div>
    </div>
  );
};

export default CEODashboard;
