import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, ShoppingCart, Store, Globe, TrendingUp, CalendarDays, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Week', days: 7 }, { label: 'Month', days: 30 },
  { label: 'Year', days: 365 }, { label: 'All', days: 0, all: true }
];

const SalesAnalytics = () => {
  const [datePreset, setDatePreset] = useState('Month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const getDateParams = () => {
    if (customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo };
    const preset = DATE_PRESETS.find(p => p.label === datePreset);
    if (!preset || preset.all) return {};
    const from = new Date();
    from.setDate(from.getDate() - preset.days);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
  };

  const fetchData = async () => {
    setLoading(true);
    const token = sessionStorage.getItem('token');
    const params = getDateParams();
    const qs = new URLSearchParams(params).toString();
    try {
      const res = await axios.get(`${API_URL}/api/revenue/sales?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error('Sales analytics error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [datePreset, customFrom, customTo]);

  const StatCard = ({ label, value, icon: Icon, color, suffix }) => (
    <div className="glass rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}><Icon size={16} className="text-white" /></div>
      </div>
      <p className="text-2xl md:text-3xl font-black text-white">
        {suffix === '₨' ? `₨${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()}
      </p>
    </div>
  );

  const SourceSection = ({ title, icon: Icon, iconColor, data: d }) => (
    <div className="glass rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center space-x-3 mb-6">
        <div className={`p-3 rounded-xl ${iconColor}`}><Icon size={20} className="text-white" /></div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">{title}</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Orders</p>
          <p className="text-xl font-black text-white mt-1">{d?.orders || 0}</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Items Sold</p>
          <p className="text-xl font-black text-blue-400 mt-1">{d?.itemsSold || 0}</p>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800/50">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Sales Value</p>
          <p className="text-xl font-black text-emerald-400 mt-1">₨{Number(d?.salesValue || 0).toLocaleString()}</p>
        </div>
      </div>
      {d?.profit !== undefined && (
        <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-[10px] font-bold">
          <span className="text-gray-500">Gross Profit</span>
          <span className={d.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            ₨{Number(d.profit).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <BarChart3 size={24} className="text-blue-400" />
            Sales Analytics
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Orders, Items & Revenue Per Source</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <CalendarDays size={14} className="text-gray-500" />
        {DATE_PRESETS.map(p => (
          <button key={p.label}
            onClick={() => { setDatePreset(p.label); setCustomFrom(''); setCustomTo(''); }}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
              datePreset === p.label && !customFrom ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >{p.label}</button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setDatePreset(''); }}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-[10px] text-white font-bold outline-none focus:border-blue-500" />
          <span className="text-gray-600 text-[10px]">to</span>
          <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setDatePreset(''); }}
            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-[10px] text-white font-bold outline-none focus:border-blue-500" />
        </div>
      </div>

      {data && (
        <>
          {/* Combined Performance */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" /> Combined Performance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Business Sales" value={data.combined.totalBusinessSales} icon={BarChart3} color="bg-emerald-600" suffix="₨" />
              <StatCard label="Total Orders" value={data.combined.totalOrders} icon={ShoppingCart} color="bg-blue-600" />
              <StatCard label="Total Products Sold" value={data.combined.totalProductsSold} icon={TrendingUp} color="bg-purple-600" />
            </div>
          </div>

          {/* Online Sales */}
          <SourceSection title="Online Sales" icon={Globe} iconColor="bg-blue-600" data={data.online} />

          {/* Per-Outlet Sales */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Store size={14} className="text-purple-400" /> Outlet Sales
            </h2>
            {data.outlets.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center border border-gray-800">
                <Store size={40} className="mx-auto text-gray-700 mb-3" />
                <p className="text-gray-500 font-black text-xs uppercase tracking-widest">No outlet sales data found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {data.outlets.map((outlet, i) => (
                  <SourceSection key={outlet.name} title={`Outlet ${i + 1}: ${outlet.name}`} icon={Store} iconColor="bg-purple-600" data={outlet} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" size={20} /></div>}
    </div>
  );
};

export default SalesAnalytics;
