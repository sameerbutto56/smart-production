import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import socket from '../socket';
import {
  Truck, CheckCircle2, PhoneOff, Phone,
  RefreshCw, ClipboardList, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

/* ─── single order card ─── */
const OrderCard = ({ order, idx, onAction, loading, paymentMethods, setPaymentMethods }) => {
  const getStatus = () => {
    if (order.currentStage === 'DELIVERED' || order.status === 'COMPLETED') return 'DELIVERED';
    if (order.auditLogs?.find(l => l.action === 'NOT_RESPONDED')) return 'NOT_RESPONDED';
    return 'PENDING';
  };

  const status = getStatus();
  const isDelivered = status === 'DELIVERED';
  const isNoResponse = status === 'NOT_RESPONDED';

  let pd = {};
  try { let raw = JSON.parse(order.productDetails || '{}'); pd = Array.isArray(raw) ? (raw[0]?.productDetails || raw[0] || {}) : (raw || {}); } catch {}

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`rounded-[1.8rem] overflow-hidden border-2 transition-all ${
        isDelivered
          ? 'border-emerald-500/30 bg-emerald-950/20'
          : isNoResponse
          ? 'border-amber-500/30 bg-amber-950/20'
          : 'theme-border theme-bg'
      }`}
    >
      {/* Status strip at top */}
      <div className={`h-1.5 w-full ${isDelivered ? 'bg-emerald-500' : isNoResponse ? 'bg-amber-500' : 'bg-blue-600'}`} />

      <div className="p-5 space-y-4">
        {/* Row 1: Number + Name + Status */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center font-black text-lg text-gray-300 flex-shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black theme-text-primary text-xl leading-tight">{order.customerName}</p>
              {order.priority === 'SUPER_URGENT' && (
                <span className="text-[9px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                  ⚡ SUPER URGENT
                </span>
              )}
              {order.priority === 'URGENT' && (
                <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  ⚡ URGENT
                </span>
              )}
            </div>
            <p className="text-xs text-blue-400 font-black mt-1 tracking-wider">
              ORDER #{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] md:text-[10px] font-black border ${
            isDelivered
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : isNoResponse
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          }`}>
            {isDelivered ? '✓ Done' : isNoResponse ? '✗ No Reply' : '● Pending'}
          </div>
        </div>

        {/* Row 2: Phone + Address + Product + Amount */}
        <div className="space-y-2">
          {/* Call button */}
          {order.customerPhone ? (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl px-4 py-3"
            >
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">📞 Tap to Call</p>
                <p className="font-black theme-text-primary text-lg leading-tight">{order.customerPhone}</p>
              </div>
            </a>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl px-4 py-3 theme-text-muted text-sm font-bold">
              No phone number
            </div>
          )}

          {/* Delivery Address */}
          {order.address && (
            <div className="bg-gray-800/50 rounded-2xl px-4 py-3 border theme-border">
              <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">📍 Delivery Address</p>
              <p className="font-black theme-text-primary text-base mt-0.5 whitespace-pre-wrap">{order.address}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Product</p>
              <p className="font-black theme-text-primary text-base mt-0.5 truncate">{pd.productType || order.type || '—'}</p>
            </div>

            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Amount</p>
              <p className="font-black text-emerald-400 text-base mt-0.5">
                ₨{Number(order.totalPrice || 0).toLocaleString()}
              </p>
              <p className="text-[9px] theme-text-muted font-bold mt-0.5">
                {order.paymentMethod === 'ONLINE_TRANSFER' ? '💳 Online' : order.advancePaid ? '✅ Paid' : '💵 COD'}
              </p>
            </div>
          </div>
        </div>

        {/* Row 3: Payment Method + Action Buttons */}
        {!isDelivered && (
          <>
            {/* Payment Method Selector */}
            <div className="bg-gray-800/40 rounded-2xl p-3 border border-gray-700/50">
              <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest mb-2">Payment Method</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethods(prev => ({ ...prev, [order.id]: 'CASH' }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    (paymentMethods[order.id] || 'CASH') === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                      : 'bg-gray-800 theme-text-secondary border border-gray-700'
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethods(prev => ({ ...prev, [order.id]: 'ONLINE_TRANSFER' }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    paymentMethods[order.id] === 'ONLINE_TRANSFER'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-gray-800 theme-text-secondary border border-gray-700'
                  }`}
                >
                  💳 Online Transfer
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <button
                disabled={loading}
                onClick={() => onAction(order.id, 'DELIVERED', '', paymentMethods[order.id] || 'CASH')}
                className="flex flex-col items-center justify-center gap-1.5 py-5 bg-emerald-600 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40"
              >
                <CheckCircle2 size={28} />
                <span className="text-sm">Delivered</span>
                <span className="text-[9px] opacity-70 font-bold">مل گیا</span>
              </button>
              <button
                disabled={loading}
                onClick={() => onAction(order.id, 'NOT_RESPONDED', 'Customer did not respond')}
                className="flex flex-col items-center justify-center gap-1.5 py-5 bg-gray-800 border-2 border-amber-500/40 text-amber-400 rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50"
              >
                <PhoneOff size={28} />
                <span className="text-sm">No Response</span>
                <span className="text-[9px] opacity-70 font-bold">جواب نہیں</span>
              </button>
            </div>
          </>
        )}

        {/* Already delivered message */}
        {isDelivered && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
            <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 font-black text-sm">Order Delivered Successfully</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ─── main page ─── */
const DeliveryDashboard = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const token = sessionStorage.getItem('token');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [paymentMethods, setPaymentMethods] = useState({});

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/orders?status=delivery`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const relevant = res.data.filter(o =>
        (o.currentStage === 'OUT_FOR_DELIVERY' ||
        o.currentStage === 'DELIVERED' ||
        o.status === 'COMPLETED') &&
        (!o.deliveryMethod || o.deliveryMethod === 'ENAMELS_DELIVERY')
      );
      setOrders(relevant);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    socket.on('order-updated', fetchOrders);
    socket.on('new-order', fetchOrders);
    return () => {
      socket.off('order-updated', fetchOrders);
      socket.off('new-order', fetchOrders);
    };
  }, [fetchOrders]);

  const handleAction = async (orderId, deliveryStatus, remarks, paymentMethod) => {
    try {
      setActionLoading(true);
      await axios.put(`${API_URL}/api/orders/${orderId}/delivery`, { deliveryStatus, remarks, paymentMethod }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (deliveryStatus === 'DELIVERED') {
        toast.success('✅ Delivered!', { duration: 3000 });
      } else {
        toast('⚠️ No Response logged', { duration: 3000 });
      }
      fetchOrders();
    } catch {
      toast.error('Update failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatus = (order) => {
    if (order.currentStage === 'DELIVERED' || order.status === 'COMPLETED') return 'DELIVERED';
    if (order.auditLogs?.find(l => l.action === 'NOT_RESPONDED')) return 'NOT_RESPONDED';
    return 'PENDING';
  };

  const pending = orders.filter(o => getStatus(o) === 'PENDING');
  const delivered = orders.filter(o => getStatus(o) === 'DELIVERED');
  const noResponse = orders.filter(o => getStatus(o) === 'NOT_RESPONDED');

  const filtered = orders.filter(o => {
    const status = getStatus(o);
    const matchSearch = !search ||
      o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone?.includes(search);
    const matchFilter = filter === 'ALL' || status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="max-w-xl mx-auto pb-32 px-3 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between pt-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
            <Truck className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black theme-text-primary leading-none">Deliveries</h1>
            <p className="text-[9px] md:text-[10px] theme-text-muted font-bold mt-0.5">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats — big and colorful */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <button onClick={() => setFilter('PENDING')} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'PENDING' ? 'bg-blue-600 border-blue-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'PENDING' ? 'text-white' : 'text-blue-400'}`}>{pending.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'PENDING' ? 'text-blue-100' : 'theme-text-muted'}`}>{t('Pending')}</p>
        </button>
        <button onClick={() => setFilter('DELIVERED')} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'DELIVERED' ? 'bg-emerald-600 border-emerald-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'DELIVERED' ? 'text-white' : 'text-emerald-400'}`}>{delivered.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'DELIVERED' ? 'text-emerald-100' : 'theme-text-muted'}`}>{t('Delivered')}</p>
        </button>
        <button onClick={() => setFilter('NOT_RESPONDED')} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'NOT_RESPONDED' ? 'bg-amber-600 border-amber-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'NOT_RESPONDED' ? 'text-white' : 'text-amber-400'}`}>{noResponse.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'NOT_RESPONDED' ? 'text-amber-100' : 'theme-text-muted'}`}>{t('No Reply')}</p>
        </button>
      </div>

      {/* Show All button */}
      <button
        onClick={() => setFilter('ALL')}
        className={`w-full py-3 rounded-2xl text-sm font-black uppercase tracking-widest border-2 transition-all ${filter === 'ALL' ? 'bg-gray-700 border-gray-600 text-white' : 'theme-bg theme-border theme-text-muted'}`}
      >
        {t('Show All')} ({orders.length})
      </button>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full theme-input rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* Order list */}
      {loading ? (
        <div className="flex flex-col items-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="theme-text-muted text-sm font-bold">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 text-center">
          <ClipboardList size={40} className="theme-text-muted" />
          <p className="theme-text-muted font-black text-lg">No orders here</p>
          <p className="text-gray-700 text-sm max-w-[220px]">
            Tap a filter above or ask admin to assign deliveries.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order, idx) => (
            <OrderCard
              key={order.id}
              order={order}
              idx={idx}
              onAction={handleAction}
              loading={actionLoading}
              paymentMethods={paymentMethods}
              setPaymentMethods={setPaymentMethods}
            />
          ))}
        </div>
      )}

      {/* Fixed bottom bar — cash summary */}
      <div className="fixed bottom-0 left-0 right-0 z-40 theme-bg/95 backdrop-blur-xl border-t-2 theme-border px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">COD to Collect</p>
            <p className="text-xl font-black text-amber-400">
              ₨{pending
                .filter(o => !o.advancePaid)
                .reduce((s, o) => s + (Number(o.totalPrice) || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="h-10 w-px bg-gray-800" />
          <div className="text-center">
            <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Collected</p>
            <p className="text-xl font-black text-emerald-400">
              ₨{delivered
                .reduce((s, o) => s + (Number(o.totalPrice) || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="h-10 w-px bg-gray-800" />
          <div className="text-right">
            <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Remaining</p>
            <p className="text-xl font-black theme-text-primary">{pending.length} left</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
