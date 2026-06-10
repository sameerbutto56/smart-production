import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, Package, Factory, Truck, DollarSign, RefreshCcw, AlertTriangle, ChevronRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '';

const BRANCHES = [
  { value: 'all', label: 'All Branches' },
  { value: 'johar_town', label: 'Johar Town' },
  { value: 'abbottabad', label: 'Abbottabad' },
  { value: 'jail_road', label: 'Jail Road' },
  { value: 'online', label: 'Online' }
];

const VIEWS = [
  { key: 'overview', label: 'Overview', icon: BarChart3, color: 'from-blue-600 to-indigo-600' },
  { key: 'orders', label: 'Orders', icon: TrendingUp, color: 'from-emerald-600 to-teal-600' },
  { key: 'production', label: 'Production', icon: Factory, color: 'from-amber-600 to-orange-600' },
  { key: 'inventory', label: 'Inventory', icon: Package, color: 'from-purple-600 to-pink-600' },
  { key: 'dispatch', label: 'Dispatch', icon: Truck, color: 'from-cyan-600 to-blue-600' },
  { key: 'profit', label: 'Profit', icon: DollarSign, color: 'from-green-600 to-emerald-600' }
];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const formatCurrency = (v) => `₨${(v || 0).toLocaleString()}`;

const UnifiedAnalytics = () => {
  const [branch, setBranch] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/analytics/unified?branch=${branch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary || {};
  const prod = data?.production || {};

  const KpiCard = ({ label, value, sub, color, icon: Icon, onClick }) => (
    <button onClick={onClick} className={`relative overflow-hidden bg-gradient-to-br ${color} p-[1px] rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg`}>
      <div className="bg-gray-950/90 backdrop-blur-sm rounded-2xl p-4 h-full flex flex-col items-start text-left">
        <div className="flex items-center justify-between w-full mb-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</span>
          <Icon size={16} className="text-gray-500" />
        </div>
        <span className="text-xl md:text-2xl font-black text-white">{value}</span>
        {sub && <span className="text-[9px] text-gray-500 mt-1">{sub}</span>}
      </div>
    </button>
  );

  const StageBar = ({ name, count, max }) => (
    <div className="flex items-center gap-2 text-[9px]">
      <span className="w-28 font-bold text-gray-300 truncate">{name.replace(/_/g, ' ')}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: max > 0 ? `${(count / max) * 100}%` : '0%' }} />
      </div>
      <span className="w-8 text-right font-black text-white">{count}</span>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Orders" value={s.totalOrders || 0} sub={`${s.completedOrders || 0} Completed`} color="from-blue-600 to-indigo-600" icon={TrendingUp} onClick={() => setActiveView('orders')} />
        <KpiCard label="Total Revenue" value={formatCurrency(s.totalRevenue)} sub={`Profit: ${formatCurrency(s.totalNetProfit)}`} color="from-emerald-600 to-teal-600" icon={DollarSign} onClick={() => setActiveView('profit')} />
        <KpiCard label="Items Produced" value={s.totalProduced || 0} sub={`Cost: ${formatCurrency(s.prodCost)}`} color="from-amber-600 to-orange-600" icon={Factory} onClick={() => setActiveView('production')} />
        <KpiCard label="Inventory" value={s.totalInventoryItems || 0} sub={`${s.lowStockItems || 0} Low Stock`} color="from-purple-600 to-pink-600" icon={Package} onClick={() => setActiveView('inventory')} />
        <KpiCard label="Dispatch" value={s.dispatchPending || 0} sub={`${s.outForDelivery || 0} In Transit`} color="from-cyan-600 to-blue-600" icon={Truck} onClick={() => setActiveView('dispatch')} />
        <KpiCard label="Gross Profit" value={formatCurrency(s.totalGrossProfit)} sub={`Net: ${formatCurrency(s.totalNetProfit)}`} color="from-green-600 to-emerald-600" icon={DollarSign} onClick={() => setActiveView('profit')} />
        <KpiCard label="Online Orders" value={s.onlineOrders || 0} sub={`Revenue: ${formatCurrency(s.onlineRevenue)}`} color="from-violet-600 to-purple-600" icon={TrendingUp} onClick={() => { setBranch('online'); }} />
        <KpiCard label="Outlet Orders" value={s.outletOrders || 0} sub={`Revenue: ${formatCurrency(s.outletRevenue)}`} color="from-rose-600 to-pink-600" icon={TrendingUp} onClick={() => setActiveView('orders')} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
          <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Orders by Stage</h3>
          <div className="space-y-1.5">
            {Object.entries(data?.stageCounts || {}).map(([name, count]) => (
              <StageBar key={name} name={name} count={count} max={Math.max(...Object.values(data?.stageCounts || {}), 1)} />
            ))}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
          <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Production Monthly Trend</h3>
          {prod.monthlyTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={prod.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
                <Line type="monotone" dataKey="quantity" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-gray-600 text-center py-8">No production data yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderOrders = () => {
    const stageNames = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];
    const stageData = stageNames.map(n => ({ name: n.replace(/_/g, ' '), count: data?.stageCounts?.[n] || 0 }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={s.totalOrders || 0} sub="" color="from-blue-600 to-indigo-600" icon={TrendingUp} />
          <KpiCard label="Completed" value={s.completedOrders || 0} sub="" color="from-emerald-600 to-teal-600" icon={TrendingUp} />
          <KpiCard label="In Progress" value={s.inProgressOrders || 0} sub="" color="from-amber-600 to-orange-600" icon={TrendingUp} />
          <KpiCard label="Pending" value={s.pendingOrders || 0} sub="" color="from-gray-600 to-slate-600" icon={TrendingUp} />
        </div>
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
          <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Orders by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 8 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderProduction = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Items Produced" value={s.totalProduced || 0} sub="" color="from-amber-600 to-orange-600" icon={Factory} />
        <KpiCard label="Production Cost" value={formatCurrency(s.prodCost)} sub={`Raw: ${formatCurrency(s.rawMaterialCost)}`} color="from-red-600 to-rose-600" icon={Factory} />
        <KpiCard label="Earnings" value={formatCurrency(s.prodEarnings || prod.earnings)} sub="" color="from-emerald-600 to-teal-600" icon={Factory} />
        <KpiCard label="Profit" value={formatCurrency(s.prodProfit || prod.profit)} sub="" color="from-green-600 to-emerald-600" icon={Factory} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
          <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Monthly Trend</h3>
          {prod.monthlyTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={prod.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="quantity" stroke="#6366f1" strokeWidth={2} name="Quantity" />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[10px] text-gray-600 text-center py-12">No production data yet</p>
          )}
        </div>
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
          <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Product Breakdown</h3>
          {prod.byProduct?.length > 0 ? (
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {prod.byProduct.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-[9px] p-2 bg-gray-800/30 rounded-lg">
                  <span className="font-bold text-white truncate flex-1">{p.productName}</span>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-gray-400">{p.quantity} units</span>
                    <span className="text-emerald-400 font-black w-20">{formatCurrency(p.profit)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-600 text-center py-12">No products yet</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Items" value={s.totalInventoryItems || 0} sub="" color="from-purple-600 to-pink-600" icon={Package} />
        <KpiCard label="Total Value" value={formatCurrency(s.totalInventoryValue)} sub="" color="from-emerald-600 to-teal-600" icon={Package} />
        <KpiCard label="Low Stock" value={s.lowStockItems || 0} sub="" color="from-amber-600 to-orange-600" icon={AlertTriangle} />
        <KpiCard label="Out of Stock" value={s.outOfStockItems || 0} sub="" color="from-red-600 to-rose-600" icon={AlertTriangle} />
      </div>
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Stock Health</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={[
              { name: 'In Stock', value: Math.max(0, (s.totalInventoryItems || 0) - (s.lowStockItems || 0) - (s.outOfStockItems || 0)) },
              { name: 'Low Stock', value: s.lowStockItems || 0 },
              { name: 'Out of Stock', value: s.outOfStockItems || 0 }
            ]} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
              {CHART_COLORS.slice(0, 3).map((c, i) => <Cell key={i} fill={c} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderDispatch = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Pending Dispatch" value={s.dispatchPending || 0} sub="" color="from-amber-600 to-orange-600" icon={Truck} />
        <KpiCard label="Out for Delivery" value={s.outForDelivery || 0} sub="" color="from-blue-600 to-indigo-600" icon={Truck} />
        <KpiCard label="Delivered" value={s.deliveredOrders || 0} sub="" color="from-emerald-600 to-teal-600" icon={Truck} />
      </div>
    </div>
  );

  const renderProfit = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={formatCurrency(s.totalRevenue)} sub="" color="from-emerald-600 to-teal-600" icon={DollarSign} />
        <KpiCard label="Gross Profit" value={formatCurrency(s.totalGrossProfit)} sub="" color="from-green-600 to-emerald-600" icon={DollarSign} />
        <KpiCard label="Net Profit" value={formatCurrency(s.totalNetProfit)} sub="" color="from-blue-600 to-indigo-600" icon={DollarSign} />
        <KpiCard label="Production Cost" value={formatCurrency(s.totalProductionCost)} sub="" color="from-red-600 to-rose-600" icon={DollarSign} />
      </div>
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3">Online vs Outlet</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={[
            { name: 'Online', Revenue: s.onlineRevenue || 0, Profit: s.onlineProfit || 0 },
            { name: 'Outlet', Revenue: s.outletRevenue || 0, Profit: s.outletProfit || 0 }
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 9 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderActiveView = () => {
    switch (activeView) {
      case 'orders': return renderOrders();
      case 'production': return renderProduction();
      case 'inventory': return renderInventory();
      case 'dispatch': return renderDispatch();
      case 'profit': return renderProfit();
      default: return renderOverview();
    }
  };

  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-black text-white tracking-tight">Analytics</h1>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Unified Business Intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={branch}
            onChange={(e) => { setBranch(e.target.value); setActiveView('overview'); }}
            className="bg-gray-900 border border-gray-700 text-white text-[10px] font-bold rounded-xl px-3 py-2 outline-none focus:border-blue-500"
          >
            {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <button onClick={fetchData} className="p-2 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors">
            <RefreshCcw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeView === v.key
                ? `bg-gradient-to-r ${v.color} text-white shadow-lg`
                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
            }`}
          >
            <v.icon size={12} />
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCcw className="animate-spin text-blue-400" size={24} />
        </div>
      ) : (
        renderActiveView()
      )}
    </div>
  );
};

export default UnifiedAnalytics;
