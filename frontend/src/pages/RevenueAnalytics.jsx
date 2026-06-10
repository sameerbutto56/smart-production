import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, Package, Truck, Store, Users, Building2, Factory, CalendarDays, Loader2, ArrowUpRight, Circle, Sparkles } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const DATE_PRESETS = [
  { label: 'Today', days: 0 }, { label: 'Week', days: 7 }, { label: 'Month', days: 30 },
  { label: 'Year', days: 365 }, { label: 'All', days: 0, all: true }
];

const RevenueAnalytics = () => {
  const [datePreset, setDatePreset] = useState('Month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const [executive, setExecutive] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [production, setProduction] = useState(null);

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
      const [execRes, analRes, prodRes] = await Promise.all([
        axios.get(`${API_URL}/api/revenue/executive-summary?${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/revenue/analytics?${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/revenue/production?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setExecutive(execRes.data);
      setAnalytics(analRes.data);
      setProduction(prodRes.data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [datePreset, customFrom, customTo]);

  const StatCard = ({ label, value, icon: Icon, color, sub }) => (
    <div className="glass rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
        <div className={`p-2 rounded-xl ${color}`}><Icon size={16} className="text-white" /></div>
      </div>
      <p className="text-2xl md:text-3xl font-black text-white">₨{Number(value || 0).toLocaleString()}</p>
      {sub && <p className="text-[10px] text-gray-500 font-bold mt-1">{sub}</p>}
    </div>
  );

  const renderDateFilter = () => (
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
  );

  const renderTab = (id, label, icon) => (
    <button onClick={() => setActiveTab(id)}
      className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
        activeTab === id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
      }`}
    >{icon}{label}</button>
  );

  if (loading && !executive) {
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
            Revenue & Production Analytics
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Profit, Performance & Production Intelligence</p>
        </div>
      </div>

      {renderDateFilter()}

      <div className="flex flex-wrap gap-2 mb-6">
        {renderTab('executive', <Sparkles size={14} />, 'Executive Summary')}
        {renderTab('online', <ShoppingCart size={14} />, 'Online')}
        {renderTab('outlet', <Store size={14} />, 'Outlets')}
        {renderTab('production', <Factory size={14} />, 'Production')}
      </div>

      {activeTab === 'executive' && executive && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Revenue" value={executive.totalRevenue} icon={DollarSign} color="bg-emerald-600" />
            <StatCard label="Total Profit" value={executive.totalProfit} icon={TrendingUp} color="bg-blue-600" />
            <StatCard label="Total Orders" value={executive.totalOrders} icon={ShoppingCart} color="bg-purple-600" />
            <StatCard label="Production Cost" value={executive.productionCost} icon={Factory} color="bg-orange-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6 border border-gray-800">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Circle size={8} className="text-blue-400" /> Revenue Source Breakdown
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-600/10 rounded-xl border border-blue-500/20">
                  <div><p className="text-[10px] font-black text-white">Online</p><p className="text-[9px] text-gray-500">{executive.onlineOrders} orders</p></div>
                  <div className="text-right"><p className="text-sm font-black text-blue-400">₨{Number(executive.onlineRevenue).toLocaleString()}</p><p className="text-[9px] text-emerald-400">+₨{Number(executive.onlineProfit).toLocaleString()} profit</p></div>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-600/10 rounded-xl border border-purple-500/20">
                  <div><p className="text-[10px] font-black text-white">Outlet</p><p className="text-[9px] text-gray-500">{executive.outletOrders} orders</p></div>
                  <div className="text-right"><p className="text-sm font-black text-purple-400">₨{Number(executive.outletRevenue).toLocaleString()}</p><p className="text-[9px] text-emerald-400">+₨{Number(executive.outletProfit).toLocaleString()} profit</p></div>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 border border-gray-800">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package size={8} className="text-emerald-400" /> Order Type Breakdown
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-900 rounded-xl">
                  <span className="text-[10px] font-black text-white">Standard</span>
                  <span className="text-sm font-black text-gray-300">{executive.standardOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-900 rounded-xl">
                  <span className="text-[10px] font-black text-white">Logo</span>
                  <span className="text-sm font-black text-gray-300">{executive.logoOrders}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-900 rounded-xl">
                  <span className="text-[10px] font-black text-white">Custom</span>
                  <span className="text-sm font-black text-gray-300">{executive.customOrders}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-gray-800">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ArrowUpRight size={12} className="text-emerald-400" /> Key Metrics Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Online Revenue', value: executive.onlineRevenue },
                { label: 'Outlet Revenue', value: executive.outletRevenue },
                { label: 'Online Profit', value: executive.onlineProfit },
                { label: 'Outlet Profit', value: executive.outletProfit },
              ].map(m => (
                <div key={m.label} className="bg-gray-900/50 p-3 rounded-xl border border-gray-800/50">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{m.label}</p>
                  <p className="text-sm font-black text-white mt-1">₨{Number(m.value).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'online' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const online = analytics.bySource?.find(s => s.source === 'ONLINE');
              return <>
                <StatCard label="Online Revenue" value={online?.revenue || 0} icon={DollarSign} color="bg-blue-600" />
                <StatCard label="Online Profit" value={online?.profit || 0} icon={TrendingUp} color="bg-emerald-600" />
                <StatCard label="Online Orders" value={online?.orders || 0} icon={ShoppingCart} color="bg-purple-600" />
                <StatCard label="Production Cost" value={online?.productionCost || 0} icon={Factory} color="bg-orange-600" />
              </>;
            })()}
          </div>

          {analytics.byType?.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-gray-800">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Online Orders by Type</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead><tr className="border-b border-gray-800 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                    <th className="text-left p-3">Type</th><th className="text-right p-3">Orders</th><th className="text-right p-3">Revenue</th><th className="text-right p-3">Profit</th>
                  </tr></thead>
                  <tbody>
                    {analytics.byType.map(t => (
                      <tr key={t.type} className="border-b border-gray-800/50">
                        <td className="p-3 font-black text-white">{t.type.replace('_', ' ')}</td>
                        <td className="p-3 text-right text-gray-300">{t.orders}</td>
                        <td className="p-3 text-right text-emerald-400 font-black">₨{Number(t.revenue).toLocaleString()}</td>
                        <td className="p-3 text-right text-blue-400 font-black">₨{Number(t.profit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'outlet' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const outlet = analytics.bySource?.find(s => s.source === 'OUTLET');
              return <>
                <StatCard label="Outlet Revenue" value={outlet?.revenue || 0} icon={DollarSign} color="bg-purple-600" />
                <StatCard label="Outlet Profit" value={outlet?.profit || 0} icon={TrendingUp} color="bg-emerald-600" />
                <StatCard label="Outlet Orders" value={outlet?.orders || 0} icon={Building2} color="bg-blue-600" />
                <StatCard label="Production Cost" value={outlet?.productionCost || 0} icon={Factory} color="bg-orange-600" />
              </>;
            })()}
          </div>

          <div className="glass rounded-2xl p-6 border border-gray-800">
            <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Outlet Performance <span className="text-gray-600">(Ranked by Revenue)</span></h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-gray-800 text-[8px] font-black text-gray-500 uppercase tracking-widest">
                  <th className="text-left p-3">#</th><th className="text-left p-3">Outlet</th><th className="text-right p-3">Orders</th><th className="text-right p-3">Revenue</th><th className="text-right p-3">Profit</th>
                </tr></thead>
                <tbody>
                  {analytics.byOutlet?.map((o, i) => (
                    <tr key={o.outletName} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                      <td className="p-3 text-gray-500 font-black">{i + 1}</td>
                      <td className="p-3 font-black text-white">{o.outletName}</td>
                      <td className="p-3 text-right text-gray-300">{o.orders}</td>
                      <td className="p-3 text-right text-emerald-400 font-black">₨{Number(o.revenue).toLocaleString()}</td>
                      <td className="p-3 text-right text-blue-400 font-black">₨{Number(o.profit).toLocaleString()}</td>
                    </tr>
                  ))}
                  {(!analytics.byOutlet || analytics.byOutlet.length === 0) && (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-500 text-[10px] font-black">No outlet data found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'production' && production && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Products Produced" value={production.totalProduced} icon={Package} color="bg-blue-600" sub="Total items through Production" />
            <StatCard label="Production Cost" value={production.totalProductionCost} icon={Factory} color="bg-orange-600" />
            <StatCard label="Production Revenue" value={production.totalProductionRevenue} icon={DollarSign} color="bg-emerald-600" />
            <StatCard label="Production Profit" value={production.productionProfit} icon={TrendingUp} color="bg-purple-600" />
          </div>

          {production.byType?.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-gray-800">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Production by Order Type</h3>
              <div className="space-y-3">
                {production.byType.map(t => (
                  <div key={t.type} className="flex justify-between items-center p-3 bg-gray-900 rounded-xl">
                    <span className="text-[10px] font-black text-white">{t.type.replace('_', ' ')}</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-gray-300">{t.count} units</span>
                      <span className="text-[10px] text-gray-500 ml-3">₨{Number(t.cost).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {production.recentProduction?.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-gray-800">
              <h3 className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Recent Production Activity</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {production.recentProduction.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg text-[10px]">
                    <span className="font-mono text-gray-400">{p.orderId?.substring(0, 8)}</span>
                    <span className="text-gray-500">{p.type?.replace('_', ' ')}</span>
                    <span className="text-gray-600">{p.completedAt ? new Date(p.completedAt).toLocaleString() : '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-blue-500" size={20} /></div>}
    </div>
  );
};

export default RevenueAnalytics;