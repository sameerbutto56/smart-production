import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, BarChart3, TrendingUp, Activity, Package, User, X, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import socket from '../socket';

const SECTION_COLORS = {
  pending: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  active: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  delivered: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  returned: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  rejected: { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  cod: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  paid: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  total: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  urgent: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const OrderDetailModal = ({ order, onClose }) => {
  if (!order) return null;
  const stages = order.stages || [];
  const auditLogs = order.auditLogs || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="glass max-w-lg w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Order Details</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 transition-all"><X size={16} className="theme-text-muted" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Order #</p>
              <p className="text-sm font-black theme-text-primary">#{order.orderNumber || order.id?.slice(0, 8)}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Customer</p>
              <p className="text-sm font-black theme-text-primary">{order.customerName || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">City</p>
              <p className="text-sm font-black theme-text-primary">{order.city || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Phone</p>
              <p className="text-sm font-black theme-text-primary">{order.customerPhone || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Amount</p>
              <p className="text-sm font-black text-emerald-400">₨{parseFloat(order.totalPrice || 0).toLocaleString()}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Status</p>
              <p className="text-sm font-black theme-text-primary">{order.status || '—'}</p>
            </div>
          </div>
          {order.address && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Address</p>
              <p className="text-xs font-bold theme-text-primary">{order.address}</p>
            </div>
          )}
          {stages.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Stage Timeline</p>
              <div className="space-y-1.5">
                {stages.map((s, i) => (
                  <div key={s.id || i} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'COMPLETED' ? 'bg-emerald-400' : s.status === 'IN_PROGRESS' ? 'bg-blue-400' : 'bg-gray-600'}`} />
                    <span className="font-bold theme-text-primary">{s.stageName?.replace(/_/g, ' ')}</span>
                    <span className="text-gray-600">—</span>
                    <span className="font-bold text-gray-400">{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const InlineOrderList = ({ orders, title, onClose }) => (
  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    className="overflow-hidden">
    <div className="glass rounded-2xl p-4 border theme-border mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-black theme-text-primary uppercase tracking-wider">{title} ({orders.length})</h4>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-all"><X size={14} className="theme-text-muted" /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto space-y-1.5">
        {orders.length === 0 ? (
          <p className="text-xs theme-text-muted font-bold text-center py-6">No orders found</p>
        ) : orders.map(o => (
          <div key={o.id} className="flex items-center justify-between p-2.5 theme-bg-subtle rounded-xl border theme-border hover:border-blue-500/30 transition-all cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-black theme-text-primary shrink-0">#{o.orderNumber || o.id?.slice(0, 6)}</span>
              <span className="text-xs font-bold theme-text-muted truncate">{o.customerName || '—'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black text-gray-500">{o.city || '—'}</span>
              <span className="text-xs font-black text-emerald-400">₨{parseFloat(o.totalPrice || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

const DispatchAnalyticsCard = ({ activeTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [employee, setEmployee] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const refreshRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (employee) params.set('employee', employee);
      if (city) params.set('city', city);
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/api/dispatch-profile/dashboard?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error('Dispatch analytics fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [employee, city, status, dateFrom, dateTo]);

  useEffect(() => { if (activeTab === 'dispatch_analytics') fetchData(); }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'dispatch_analytics') return;
    refreshRef.current = setInterval(fetchData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'dispatch_analytics') return;
    const refresh = () => fetchData();
    socket.on('order-updated', refresh);
    socket.on('dispatch-request', refresh);
    return () => { socket.off('order-updated', refresh); socket.off('dispatch-request', refresh); };
  }, [activeTab, fetchData]);

  const filteredOrdersByStatus = useMemo(() => {
    if (!data?.trackingData || !selectedFilter) return [];
    return data.trackingData.filter(t => {
      if (selectedFilter === 'pending') return !t.dispatchStatus || t.dispatchStatus === 'PENDING';
      if (selectedFilter === 'active') return ['DISPATCHED', 'IN_TRANSIT', 'BOOKED'].includes(t.dispatchStatus);
      if (selectedFilter === 'delivered') return t.dispatchStatus === 'DELIVERED';
      if (selectedFilter === 'returned') return t.dispatchStatus === 'RETURNED';
      if (selectedFilter === 'rejected') return t.dispatchStatus === 'REJECTED';
      return false;
    });
  }, [data, selectedFilter]);

  const urgentOrders = useMemo(() => {
    if (!data?.trackingData) return [];
    return data.trackingData.filter(t => t.priority === 'URGENT' || t.priority === 'SUPER_URGENT');
  }, [data]);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-400" size={32} /></div>;
  }

  if (!data) {
    return (
      <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
        <BarChart3 className="mx-auto text-gray-800 mb-4" size={48} />
        <h3 className="theme-text-muted font-black uppercase">No Dispatch Data</h3>
        <button onClick={fetchData} className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider">Load Data</button>
      </div>
    );
  }

  const s = data.summary || {};
  const summaryCards = [
    { label: 'Total', key: 'total', value: s.totalOrders, filterKey: null },
    { label: 'Pending', key: 'pending', value: s.pending, filterKey: 'pending' },
    { label: 'Active', key: 'active', value: s.active, filterKey: 'active' },
    { label: 'Delivered', key: 'delivered', value: s.delivered, filterKey: 'delivered' },
    { label: 'Returned', key: 'returned', value: s.returned, filterKey: 'returned' },
    { label: 'Rejected', key: 'rejected', value: s.rejected, filterKey: 'rejected' },
    { label: 'COD', key: 'cod', value: s.cod, filterKey: null },
    { label: 'Paid', key: 'paid', value: s.paid, filterKey: null },
  ];

  const handleStatClick = (filterKey) => {
    if (!filterKey) return;
    setSelectedFilter(prev => prev === filterKey ? null : filterKey);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-500/10">
            <BarChart3 className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Dispatch Analytics</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Real-time dispatch operations & employee performance</p>
          </div>
        </div>
        <button onClick={() => { if (refreshRef.current) clearInterval(refreshRef.current); fetchData(); refreshRef.current = setInterval(fetchData, 30000); }}
          disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={employee} onChange={e => setEmployee(e.target.value)} className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
          <option value="">All Employees</option>
          <option value="Khawar">Khawar</option>
          <option value="Faisal">Faisal</option>
        </select>
        <select value={city} onChange={e => setCity(e.target.value)} className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
          <option value="">All Cities</option>
          <option value="Lahore">Lahore</option>
          <option value="Other">Other Cities</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="delivered">Delivered</option>
          <option value="returned">Returned</option>
          <option value="rejected">Rejected</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="theme-input rounded-xl py-2 px-3 text-xs font-black" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="theme-input rounded-xl py-2 px-3 text-xs font-black" />
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">Apply</button>
      </div>

      {/* 1. Overall Summary */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-blue-400" /> Overall Dispatch Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map(card => {
            const colors = SECTION_COLORS[card.key] || SECTION_COLORS.total;
            return (
              <div key={card.key} onClick={() => handleStatClick(card.filterKey)}
                className={`${colors.bg} rounded-2xl p-3 border ${colors.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className={`text-xl font-black ${colors.text}`}>{card.value || 0}</p>
                {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {selectedFilter && (
            <InlineOrderList orders={filteredOrdersByStatus} title={`${selectedFilter} orders`} onClose={() => setSelectedFilter(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* 2. Employee Performance */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={16} className="text-emerald-400" /> Employee Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Khawar', 'Faisal'].map(name => {
            const es = data.employeeStats?.[name] || {};
            return (
              <div key={name} className="theme-bg-subtle rounded-2xl p-4 border theme-border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <User size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black theme-text-primary">{name}</p>
                    <p className="text-[9px] font-bold text-gray-500 uppercase">{es.totalAssigned || 0} assigned</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Dispatched', value: es.totalDispatched, color: 'text-blue-400' },
                    { label: 'Delivered', value: es.delivered, color: 'text-emerald-400' },
                    { label: 'Pending', value: es.pending, color: 'text-amber-400' },
                    { label: 'Returned', value: es.returned, color: 'text-red-400' },
                    { label: 'Rejected', value: es.rejected, color: 'text-gray-400' },
                    { label: 'Avg Time', value: es.averageDispatchTime || 'N/A', color: 'text-indigo-400' },
                  ].map(item => (
                    <div key={item.label} className="theme-bg rounded-xl p-2 border theme-border">
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">{item.label}</p>
                      <p className={`text-xs font-black ${item.color}`}>{item.value || 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Monthly Breakdown */}
      {data.monthlyReport?.length > 0 && (
        <div className="glass rounded-2xl p-5 border-2 theme-border">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-purple-400" /> Monthly Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 pr-3">Month</th>
                <th className="text-right px-2">Total</th>
                <th className="text-right px-2">Delivered</th>
                <th className="text-right px-2">Returned</th>
                <th className="text-right px-2">Rejected</th>
                <th className="text-right px-2">Pending</th>
                <th className="text-right px-2">COD</th>
                <th className="text-right pl-2">Paid</th>
              </tr></thead>
              <tbody>
                {data.monthlyReport.map(m => (
                  <tr key={m.month} className="border-t border-gray-800 hover:bg-white/5">
                    <td className="py-2 pr-3 font-bold theme-text-primary">{m.month}</td>
                    <td className="text-right px-2 font-bold">{m.total}</td>
                    <td className="text-right px-2 font-bold text-emerald-400">{m.delivered}</td>
                    <td className="text-right px-2 font-bold text-red-400">{m.returned}</td>
                    <td className="text-right px-2 font-bold text-gray-400">{m.rejected}</td>
                    <td className="text-right px-2 font-bold text-amber-400">{m.pending}</td>
                    <td className="text-right px-2 font-bold text-purple-400">{m.cod}</td>
                    <td className="text-right pl-2 font-bold text-emerald-400">{m.paid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Dispatch Tracking */}
      {data.trackingData?.length > 0 && (
        <div className="glass rounded-2xl p-5 border-2 theme-border">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={16} className="text-blue-400" /> Dispatch Tracking
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 pr-2">Order#</th>
                <th className="text-left px-2">Customer</th>
                <th className="text-left px-2">City</th>
                <th className="text-left px-2">Officer</th>
                <th className="text-left px-2">Method</th>
                <th className="text-left px-2">Status</th>
                <th className="text-left pl-2">Dates</th>
              </tr></thead>
              <tbody>
                {data.trackingData.slice(0, 50).map(t => (
                  <tr key={t.id} onClick={() => setSelectedOrder(t)} className="border-t border-gray-800 hover:bg-white/5 cursor-pointer">
                    <td className="py-2 pr-2 font-bold theme-text-primary">#{t.orderNumber || t.id?.slice(0, 6)}</td>
                    <td className="px-2 font-bold">{t.customerName || '—'}</td>
                    <td className="px-2">{t.city || '—'}</td>
                    <td className="px-2 font-bold text-blue-400">{t.dispatchOfficer || '—'}</td>
                    <td className="px-2">{t.dispatchMethod}</td>
                    <td className="px-2">
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        t.dispatchStatus === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                        t.dispatchStatus === 'RETURNED' || t.dispatchStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                        t.dispatchStatus === 'DISPATCHED' ? 'bg-indigo-500/20 text-indigo-400' :
                        t.dispatchStatus === 'BOOKED' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>{t.dispatchStatus || 'PENDING'}</span>
                    </td>
                    <td className="pl-2 text-[10px] text-gray-500">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                      {t.deliveredAt ? ` → ${new Date(t.deliveredAt).toLocaleDateString()}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Urgent Orders */}
      {urgentOrders.length > 0 && (
        <div className="glass rounded-2xl p-5 border-2 border-red-500/20">
          <h3 className="text-sm font-black text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> Urgent Orders ({urgentOrders.length})
          </h3>
          <div className="space-y-2">
            {urgentOrders.map(o => (
              <div key={o.id} onClick={() => setSelectedOrder(o)} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10 cursor-pointer hover:border-red-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black theme-text-primary">#{o.orderNumber || o.id?.slice(0, 6)}</span>
                  <span className="text-xs font-bold theme-text-muted">{o.customerName || '—'}</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                  o.dispatchStatus === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                  o.dispatchStatus === 'RETURNED' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>{o.dispatchStatus || 'PENDING'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default DispatchAnalyticsCard;
