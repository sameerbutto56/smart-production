import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import useCache from '../hooks/useCache';
import {
  BarChart3, RefreshCw, Calendar, ChevronDown, Users, Store, Palette,
  Factory, Package, Truck, Clock, CheckCircle2, XCircle, ArrowRight, Shield
} from 'lucide-react';

const FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

function getDateRange(filter, customFrom, customTo) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (filter) {
    case 'today':
      return { from: new Date(y, m, d).toISOString(), to: new Date(y, m, d + 1).toISOString() };
    case 'yesterday': {
      const yd = new Date(y, m, d - 1);
      return { from: yd.toISOString(), to: new Date(y, m, d).toISOString() };
    }
    case 'last7': {
      const w = new Date(y, m, d - 6);
      return { from: w.toISOString(), to: new Date(y, m, d + 1).toISOString() };
    }
    case 'last30': {
      const mo = new Date(y, m, d - 29);
      return { from: mo.toISOString(), to: new Date(y, m, d + 1).toISOString() };
    }
    case 'thisMonth':
      return { from: new Date(y, m, 1).toISOString(), to: new Date(y, m, d + 1).toISOString() };
    case 'custom':
      return { from: customFrom, to: customTo };
    default:
      return { from: '', to: '' };
  }
}

const DEPARTMENTS = [
  { key: 'faisal', label: 'Faisal Order Entry', icon: Users, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', metrics: [
    { key: 'entered', label: 'Orders Entered' }
  ]},
  { key: 'verification', label: 'Inventory Verification', icon: Shield, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', metrics: [
    { key: 'verified', label: 'Verified' },
    { key: 'pendingVerification', label: 'Pending' },
    { key: 'returned', label: 'Returned' }
  ]},
  { key: 'store', label: 'Store Performance', icon: Store, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', metrics: [
    { key: 'accepted', label: 'Accepted' },
    { key: 'sentForward', label: 'Sent Forward' },
    { key: 'pending', label: 'Pending' }
  ]},
  { key: 'logo', label: 'Logo Department', icon: Palette, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', metrics: [
    { key: 'accepted', label: 'Accepted' },
    { key: 'sentForward', label: 'Sent Forward' },
    { key: 'pending', label: 'Pending' }
  ]},
  { key: 'production', label: 'Production Performance', icon: Factory, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', metrics: [
    { key: 'accepted', label: 'Accepted' },
    { key: 'sentForward', label: 'Sent Forward' },
    { key: 'pending', label: 'Pending' }
  ]},
  { key: 'dispatch', label: 'Dispatch Performance', icon: Package, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', metrics: [
    { key: 'received', label: 'Received' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'pending', label: 'Pending' }
  ]},
  { key: 'delivery', label: 'Delivery Performance', icon: Truck, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', metrics: [
    { key: 'assigned', label: 'Assigned' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'returned', label: 'Returned' },
    { key: 'pending', label: 'Pending' }
  ]},
];

function MetricBadge({ label, value, accent }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${accent} transition-colors`}>
      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-black ${value > 0 ? 'text-white' : 'text-gray-500'}`}>{value}</span>
    </div>
  );
}

export default function OrderPerformanceCard({ activeTab }) {
  const [filter, setFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { from, to } = useMemo(() => getDateRange(filter, customFrom, customTo), [filter, customFrom, customTo]);

  const params = useMemo(() => {
    const p = {};
    if (from) p.from = from;
    if (to) p.to = to;
    return p;
  }, [from, to]);

  const cacheKey = activeTab === 'order_performance' ? `admin:order-performance:${from}:${to}` : null;

  const { data, loading, refresh } = useCache(cacheKey, {
    fetcher: () => api.get('/api/orders/performance', { params }).then(r => r.data),
    ttl: 30000
  });

  // Auto-refresh every 30s while tab is active
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (activeTab !== 'order_performance') return;
    const interval = setInterval(() => refreshRef.current?.(), 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  if (activeTab !== 'order_performance') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-6xl mx-auto space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <BarChart3 className="text-blue-400" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Order Performance</h2>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Department-wise operational summary</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-xs font-black text-gray-300 uppercase tracking-widest hover:bg-gray-700/50 transition-all"
            >
              <Calendar size={14} />
              {FILTERS.find(f => f.value === filter)?.label || 'Filter'}
              <ChevronDown size={12} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl z-50 overflow-hidden" onMouseLeave={() => setDropdownOpen(false)}>
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setFilter(f.value); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold tracking-wider transition-colors ${filter === f.value ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Custom Date Inputs */}
          {filter === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2.5 py-2 text-xs text-white font-bold" />
              <span className="text-gray-500 text-xs">to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2.5 py-2 text-xs text-white font-bold" />
            </div>
          )}
          <button onClick={refresh} className="p-2.5 text-gray-400 hover:text-white bg-gray-800/50 rounded-xl hover:bg-gray-700/50 transition-all" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEPARTMENTS.map(d => (
            <div key={d.key} className={`rounded-2xl border ${d.border} ${d.bg} p-5 animate-pulse`}>
              <div className="h-4 w-32 bg-gray-700/50 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-8 bg-gray-700/30 rounded" />
                <div className="h-8 bg-gray-700/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Grid */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEPARTMENTS.map(d => {
            const deptData = data[d.key] || {};
            const total = Object.values(deptData).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
            return (
              <motion.div
                key={d.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border ${d.border} ${d.bg} p-5 transition-all hover:shadow-lg`}
              >
                {/* Department Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${d.bg} border ${d.border}`}>
                    <d.icon size={18} className={d.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider truncate">{d.label}</h3>
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Total: {total}</span>
                  </div>
                </div>
                {/* Metrics */}
                <div className="space-y-1.5">
                  {d.metrics.map(m => {
                    const val = deptData[m.key] ?? 0;
                    const accent = m.key === 'pending' || m.key === 'pendingVerification' ? 'bg-amber-500/10 border border-amber-500/20' :
                      m.key === 'accepted' || m.key === 'received' || m.key === 'assigned' || m.key === 'entered' ? 'bg-blue-500/10 border border-blue-500/20' :
                      m.key === 'sentForward' || m.key === 'dispatched' || m.key === 'delivered' || m.key === 'verified' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                      m.key === 'returned' ? 'bg-red-500/10 border border-red-500/20' :
                      'bg-gray-500/10 border border-gray-500/20';
                    return (
                      <div key={m.key} className={`flex items-center justify-between px-3 py-2 rounded-lg ${accent}`}>
                        <div className="flex items-center gap-2">
                          {(m.key === 'pending' || m.key === 'pendingVerification') && <Clock size={12} className="text-amber-400" />}
                          {m.key === 'accepted' && <CheckCircle2 size={12} className="text-blue-400" />}
                          {(m.key === 'sentForward' || m.key === 'dispatched' || m.key === 'delivered' || m.key === 'verified') && <CheckCircle2 size={12} className="text-emerald-400" />}
                          {m.key === 'returned' && <XCircle size={12} className="text-red-400" />}
                          {m.key === 'entered' && <Users size={12} className="text-blue-400" />}
                          {m.key === 'received' && <Package size={12} className="text-blue-400" />}
                          {m.key === 'assigned' && <Truck size={12} className="text-cyan-400" />}
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{m.label}</span>
                        </div>
                        <span className={`text-sm font-black ${val > 0 ? 'text-white' : 'text-gray-500'}`}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {data && !DEPARTMENTS.some(d => Object.values(data[d.key] || {}).some(v => v > 0)) && (
        <div className="text-center py-16">
          <BarChart3 size={48} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500 font-bold text-sm">No order activity in this period</p>
        </div>
      )}
    </motion.div>
  );
}
