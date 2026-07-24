import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, Truck, User, Package, Activity, X, RefreshCw } from 'lucide-react';
import socket from '../socket';
import { isPaidOrder, getCodAmount } from '../utils/paymentUtils';

const COLORS = {
  pending: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  active: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  delivered: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  returned: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  noResponse: { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  total: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  cash: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  online: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  cashOnline: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

const OrderDetailModal = ({ order, onClose }) => {
  if (!order) return null;
  const attempts = order.deliveryAttempts || [];
  const payments = order.deliveryPayments || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="glass max-w-lg w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Delivery Details</h3>
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
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Phone</p>
              <p className="text-sm font-black theme-text-primary">{order.customerPhone || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">City</p>
              <p className="text-sm font-black theme-text-primary">{order.city || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Amount</p>
              <p className="text-sm font-black text-emerald-400">₨{parseFloat(order.totalPrice || 0).toLocaleString()}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Status</p>
              <p className="text-sm font-black theme-text-primary">{order.currentStage?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          {order.address && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Address</p>
              <p className="text-xs font-bold theme-text-primary">{order.address}</p>
            </div>
          )}
          {attempts.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Attempts</p>
              <div className="space-y-1.5">
                {attempts.map((a, i) => (
                  <div key={a.id || i} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'DELIVERED' ? 'bg-emerald-400' : a.status === 'NO_RESPONSE' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="font-bold theme-text-primary">{a.status}</span>
                    <span className="text-gray-600">—</span>
                    <span className="font-bold text-gray-400">{a.attemptedAt ? new Date(a.attemptedAt).toLocaleString() : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {payments.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Payments</p>
              <div className="space-y-1.5">
                {payments.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between text-[10px]">
                    <span className="font-bold theme-text-primary">{p.paymentMethod}</span>
                    <span className="font-black text-emerald-400">₨{((p.cashAmount || 0) + (p.onlineAmount || 0)).toLocaleString()}</span>
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
        ) : orders.map(o => {
          const attempts = o.deliveryAttempts || [];
          return (
            <div key={o.id} className="flex items-center justify-between p-2.5 theme-bg-subtle rounded-xl border theme-border hover:border-emerald-500/30 transition-all cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-black theme-text-primary shrink-0">#{o.orderNumber || o.id?.slice(0, 6)}</span>
                <span className="text-xs font-bold theme-text-muted truncate">{o.customerName || '—'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-gray-500">{attempts.length} attempts</span>
                <span className="text-xs font-black text-emerald-400">₨{parseFloat(o.totalPrice || 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </motion.div>
);

const EnamelsDeliveryCard = ({ activeTab }) => {
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [charges, setCharges] = useState({ charges: [], totalPending: 0, payments: [], totalPaid: 0 });
  const [codSummary, setCodSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const refreshRef = useRef(null);

  const fetchData = useCallback(async () => {
    const safeGet = async (url, fallback) => { try { const r = await api.get(url); return r.data; } catch { return fallback; } };
    const [ordersRes, chargesRes, codRes, perfRes] = await Promise.all([
      safeGet('/api/delivery/orders?deliveryType=ENAMELS', []),
      safeGet('/api/delivery/charges', { charges: [], totalPending: 0, payments: [], totalPaid: 0 }),
      safeGet('/api/delivery/cod', null),
      safeGet('/api/delivery/performance', null),
    ]);
    setDeliveryOrders(Array.isArray(ordersRes) ? ordersRes : []);
    setCharges(chargesRes || { charges: [], totalPending: 0, payments: [], totalPaid: 0 });
    setCodSummary(codRes);
    setPerformance(perfRes);
    setLoading(false);
  }, []);

  useEffect(() => { if (activeTab === 'enamels_delivery') fetchData(); }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'enamels_delivery') return;
    refreshRef.current = setInterval(fetchData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'enamels_delivery') return;
    const refresh = () => fetchData();
    socket.on('order-updated', refresh);
    return () => { socket.off('order-updated', refresh); };
  }, [activeTab, fetchData]);

  const computedStats = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const weekAgo = Date.now() - 7 * 86400000;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const assignedToday = deliveryOrders.filter(o => new Date(o.createdAt).toDateString() === today).length;
    const assignedYesterday = deliveryOrders.filter(o => new Date(o.createdAt).toDateString() === yesterday).length;
    const active = deliveryOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY').length;
    const delivered = deliveryOrders.filter(o => o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED').length;
    const returned = deliveryOrders.filter(o => o.status === 'RETURNED').length;
    const noResponse = deliveryOrders.filter(o => (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED').length;
    const pending = deliveryOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && !o.riderAcceptedAt).length;

    const deliveredToday = deliveryOrders.filter(o => (o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED') && new Date(o.deliveredAt || o.updatedAt).toDateString() === today).length;
    const deliveredWeek = deliveryOrders.filter(o => (o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED') && new Date(o.deliveredAt || o.updatedAt).getTime() >= weekAgo).length;
    const deliveredMonth = deliveryOrders.filter(o => (o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED') && new Date(o.deliveredAt || o.updatedAt).getTime() >= monthStart).length;

    const earningsToday = deliveredToday * 200;
    const earningsWeek = deliveredWeek * 200;
    const earningsMonth = deliveredMonth * 200;
    const earningsLifetime = (performance?.allTimeDelivered || delivered) * 200;

    let cashTotal = 0, onlineTotal = 0, cashOnlineTotal = 0;
    deliveryOrders.filter(o => o.deliveryPayments?.length > 0).forEach(o => {
      o.deliveryPayments.forEach(p => {
        if (p.paymentMethod === 'CASH') cashTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
        else if (p.paymentMethod === 'ONLINE') onlineTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
        else if (p.paymentMethod === 'CASH_ONLINE') cashOnlineTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
      });
    });

    return {
      totalAssigned: deliveryOrders.length,
      assignedToday, assignedYesterday, active, pending, delivered, returned, noResponse,
      deliveredToday, deliveredWeek, deliveredMonth, deliveredLifetime: performance?.allTimeDelivered || delivered,
      earningsToday, earningsWeek, earningsMonth, earningsLifetime,
      cashTotal, onlineTotal, cashOnlineTotal,
    };
  }, [deliveryOrders, performance]);

  const filteredOrders = useMemo(() => {
    if (!selectedFilter) return [];
    return deliveryOrders.filter(o => {
      if (selectedFilter === 'pending') return o.currentStage === 'OUT_FOR_DELIVERY' && !o.riderAcceptedAt;
      if (selectedFilter === 'active') return o.currentStage === 'OUT_FOR_DELIVERY' && o.riderAcceptedAt;
      if (selectedFilter === 'delivered') return o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED';
      if (selectedFilter === 'returned') return o.status === 'RETURNED';
      if (selectedFilter === 'noResponse') return (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED';
      return false;
    });
  }, [deliveryOrders, selectedFilter]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>;
  }

  const handleStatClick = (filterKey) => {
    setSelectedFilter(prev => prev === filterKey ? null : filterKey);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <Truck className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Enamels Delivery Analytics</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Real-time delivery tracking & earnings</p>
          </div>
        </div>
        <button onClick={() => { if (refreshRef.current) clearInterval(refreshRef.current); fetchData(); refreshRef.current = setInterval(fetchData, 30000); }}
          disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* 1. Overall Summary */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-emerald-400" /> Overall Delivery Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Assigned', key: 'total', value: computedStats.totalAssigned, filterKey: null },
            { label: 'Assigned Today', key: 'total', value: computedStats.assignedToday, filterKey: null },
            { label: 'Active', key: 'active', value: computedStats.active, filterKey: 'active' },
            { label: 'Pending', key: 'pending', value: computedStats.pending, filterKey: 'pending' },
            { label: 'Delivered', key: 'delivered', value: computedStats.delivered, filterKey: 'delivered' },
            { label: 'Returned', key: 'returned', value: computedStats.returned, filterKey: 'returned' },
            { label: 'No Response', key: 'noResponse', value: computedStats.noResponse, filterKey: 'noResponse' },
            { label: 'Yesterday', key: 'total', value: computedStats.assignedYesterday, filterKey: null },
          ].map(card => {
            const c = COLORS[card.key] || COLORS.total;
            return (
              <div key={card.label + card.key} onClick={() => handleStatClick(card.filterKey)}
                className={`${c.bg} rounded-2xl p-3 border ${c.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className={`text-xl font-black ${c.text}`}>{card.value || 0}</p>
                {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {selectedFilter && (
              <InlineOrderList orders={filteredOrders} title={`${selectedFilter} delivery orders`} onClose={() => setSelectedFilter(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* 2. Delivery Performance */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Delivery Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Delivered Today', value: computedStats.deliveredToday, color: 'text-emerald-400' },
            { label: 'Delivered This Week', value: computedStats.deliveredWeek, color: 'text-indigo-400' },
            { label: 'Delivered This Month', value: computedStats.deliveredMonth, color: 'text-purple-400' },
            { label: 'All Time Deliveries', value: computedStats.deliveredLifetime, color: 'text-amber-400' },
          ].map(card => (
            <div key={card.label} className="theme-bg-subtle rounded-2xl p-3 border theme-border text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className={`text-xl font-black ${card.color}`}>{card.value || 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Delivery Earnings */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={16} className="text-emerald-400" /> Delivery Earnings (₨200/order)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Today's Earnings", value: computedStats.earningsToday },
            { label: 'Weekly Earnings', value: computedStats.earningsWeek },
            { label: 'Monthly Earnings', value: computedStats.earningsMonth },
            { label: 'Lifetime Earnings', value: computedStats.earningsLifetime },
          ].map(card => (
            <div key={card.label} className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className="text-xl font-black text-emerald-400">₨{(card.value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Payment Analytics */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-purple-400" /> Payment Analytics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Cash Collected', value: computedStats.cashTotal, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Online Collected', value: computedStats.onlineTotal, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
            { label: 'Cash+Online', value: computedStats.cashOnlineTotal, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Pending COD', value: codSummary?.pendingCODAmount || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-3 border ${card.border} text-center`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className={`text-xl font-black ${card.color}`}>₨{(card.value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Activity Timeline */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" /> Activity Timeline
        </h3>
        {deliveryOrders.length === 0 ? (
          <div className="text-center py-10"><p className="theme-text-muted font-black uppercase text-xs">No delivery orders</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 pr-2">Order#</th>
                <th className="text-left px-2">Customer</th>
                <th className="text-left px-2">City</th>
                <th className="text-left px-2">Attempts</th>
                <th className="text-left px-2">Status</th>
                <th className="text-left pl-2">Last Activity</th>
              </tr></thead>
              <tbody>
                {deliveryOrders.slice(0, 50).map(order => {
                  const attempts = order.deliveryAttempts || [];
                  const latestAttempt = attempts[0];
                  const noRespCount = order.noResponseLogs?.length || 0;
                  return (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} className="border-t border-gray-800 hover:bg-white/5 cursor-pointer">
                      <td className="py-2 pr-2 font-bold theme-text-primary">#{order.orderNumber || order.id?.slice(0, 6)}</td>
                      <td className="px-2 font-bold">{order.customerName || '—'}</td>
                      <td className="px-2">{order.city || '—'}</td>
                      <td className="px-2">
                        <span className="font-bold">{attempts.length}</span>
                        {noRespCount > 0 && <span className="text-[10px] text-amber-400 ml-1">({noRespCount} NR)</span>}
                      </td>
                      <td className="px-2">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          order.currentStage === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                          order.currentStage === 'OUT_FOR_DELIVERY' ? 'bg-indigo-500/20 text-indigo-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>{order.currentStage?.replace(/_/g, ' ') || 'PENDING'}</span>
                      </td>
                      <td className="pl-2 text-[10px] text-gray-500">
                        {latestAttempt?.attemptedAt ? new Date(latestAttempt.attemptedAt).toLocaleString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Delivery Boy Earnings */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={16} className="text-emerald-400" /> Delivery Boy Earnings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="theme-bg-subtle rounded-xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Pending Charges</p>
            <p className="text-2xl font-black text-emerald-400">₨{(charges.totalPending || 0).toLocaleString()}</p>
            <p className="text-[10px] font-bold text-gray-500 mt-1">{charges.charges?.length || 0} pending deliveries</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Total Paid</p>
            <p className="text-2xl font-black text-blue-400">₨{(charges.totalPaid || 0).toLocaleString()}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-4 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Rate / Delivery</p>
            <p className="text-2xl font-black text-amber-400">₨200</p>
          </div>
        </div>
      </div>

      {/* 7. COD Collection */}
      {codSummary && (
        <div className="glass rounded-2xl p-5 border-2 theme-border">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package size={16} className="text-purple-400" /> COD Collection Summary
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="theme-bg-subtle rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Today COD</p>
              <p className="text-xl font-black text-emerald-400">₨{(codSummary.todayCODAmount || 0).toLocaleString()}</p>
              <p className="text-[10px] font-bold text-gray-500">{codSummary.todayCODOrders || 0} orders</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pending COD</p>
              <p className="text-xl font-black text-amber-400">₨{(codSummary.pendingCODAmount || 0).toLocaleString()}</p>
              <p className="text-[10px] font-bold text-gray-500">{codSummary.pendingCODOrders || 0} orders</p>
            </div>
          </div>
          {codSummary.pendingDeliveries?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="text-left py-1 pr-2">Order#</th>
                  <th className="text-left px-2">Customer</th>
                  <th className="text-right pl-2">Amount</th>
                </tr></thead>
                <tbody>
                  {codSummary.pendingDeliveries.slice(0, 20).map(o => {
                    const remaining = isPaidOrder(o) ? 0 : getCodAmount(o);
                    return (
                      <tr key={o.id} className="border-t border-gray-800">
                        <td className="py-1 pr-2 font-bold theme-text-primary">#{o.orderNumber || o.id?.slice(0, 6)}</td>
                        <td className="px-2 font-bold">{o.customerName || '—'}</td>
                        <td className="text-right pl-2 font-bold text-amber-400">₨{remaining.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default EnamelsDeliveryCard;
