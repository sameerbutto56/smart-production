import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  TrendingUp, DollarSign, Package, Layers, ShoppingCart, Store,
  Truck, Archive, AlertTriangle, BarChart3, PieChart, Activity,
  Filter, CalendarDays, Loader2, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const SOURCES = [
  { value: 'all', label: 'All Sources' },
  { value: 'ONLINE', label: 'Online Orders' },
  { value: 'OUTLET', label: 'Outlet Orders' },
];

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6', '#f97316'];

const BiSection = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [source, setSource] = useState('all');

  const fetchData = async (preset, from, to, src) => {
    setLoading(true);
    try {
      const params = {};
      const now = new Date();
      if (preset === 'today') {
        params.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (preset === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        params.startDate = start.toISOString();
      } else if (preset === 'month') {
        params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (preset === 'year') {
        params.startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      } else if (preset === 'custom' && from) {
        params.startDate = new Date(from).toISOString();
        if (to) params.endDate = new Date(to).toISOString();
      }
      if (src && src !== 'all') params.source = src;
      const res = await axios.get(`${API_URL}/api/bi/dashboard`, { params, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
      setData(res.data);
    } catch (err) {
      console.error('BI fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(datePreset, customFrom, customTo, source);
  }, [datePreset, source]);

  const applyCustom = () => fetchData('custom', customFrom, customTo, source);

  const KpiCard = ({ label, value, icon: Icon, color, prefix }) => (
    <div className="glass rounded-2xl p-4 md:p-5 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}><Icon size={14} className="text-white" /></div>
      </div>
      <p className="text-lg md:text-2xl font-black text-white truncate">{prefix || ''}{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value || 0}</p>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  const { inventoryValuation, consumption, remainingValue, profitAnalytics, charts } = data || {};
  const iv = inventoryValuation || {};
  const cons = consumption || {};
  const pa = profitAnalytics || {};
  const ch = charts || {};

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-blue-500/10 rounded-2xl">
          <BarChart3 className="text-blue-400" size={20} />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Business Intelligence</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Inventory valuation, consumption &amp; profit analytics</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map(p => (
          <button key={p.key} onClick={() => setDatePreset(p.key)}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              datePreset === p.key ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
            }`}>{p.label}</button>
        ))}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
            <span className="text-gray-600 text-xs">—</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
            <button onClick={applyCustom}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-500 transition-all">Apply</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-gray-500" />
        {SOURCES.map(s => (
          <button key={s.value} onClick={() => setSource(s.value)}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              source === s.value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
            }`}>{s.label}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Inventory Value" value={iv.totalValue} icon={DollarSign} color="bg-emerald-600" prefix="₨" />
        <KpiCard label="Total Inventory Qty" value={iv.totalQuantity} icon={Package} color="bg-blue-600" />
        <KpiCard label="Online Consumed" value={cons.onlineOrders?.value} icon={ShoppingCart} color="bg-indigo-600" prefix="₨" />
        <KpiCard label="Outlet Consumed" value={cons.outletOrders?.value} icon={Store} color="bg-purple-600" prefix="₨" />
        <KpiCard label="Allocation Consumed" value={cons.allocation?.value} icon={Archive} color="bg-amber-600" prefix="₨" />
        <KpiCard label="Demand Consumed" value={cons.demandOrders?.value} icon={Truck} color="bg-orange-600" prefix="₨" />
        <KpiCard label="Total Consumed Value" value={cons.totalConsumed?.value} icon={BarChart3} color="bg-rose-600" prefix="₨" />
        <KpiCard label="Remaining Inventory" value={remainingValue} icon={Activity} color="bg-teal-600" prefix="₨" />
      </div>

      {/* Profit Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={pa.totalRevenue} icon={TrendingUp} color="bg-emerald-600" prefix="₨" />
        <KpiCard label="Total Cost" value={pa.totalCost} icon={DollarSign} color="bg-red-600" prefix="₨" />
        <KpiCard label="Gross Profit" value={pa.grossProfit} icon={Activity} color="bg-blue-600" prefix="₨" />
        <KpiCard label="Profit Margin" value={pa.profitMargin ? pa.profitMargin.toFixed(2) + '%' : '0%'} icon={PieChart} color="bg-violet-600" />
      </div>

      {/* Charts */}
      {ch.inventoryDistribution?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Distribution */}
          <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 size={14} /> Inventory Distribution by Category
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ch.inventoryDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Sources Pie */}
          {ch.revenueSources?.length > 0 && (
            <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <PieChart size={14} /> Revenue Sources
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie data={ch.revenueSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {ch.revenueSources.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Profit Trend Chart */}
      {ch.profitTrend?.length > 0 && (
        <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} /> Profit Trend
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ch.profitTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-16">
          <BarChart3 className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-500 font-bold">No data available</p>
        </div>
      )}
    </section>
  );
};

export default BiSection;
