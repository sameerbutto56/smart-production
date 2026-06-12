import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import socket from '../socket';
import {
  Truck, CheckCircle2, PhoneOff, Phone,
  RefreshCw, ClipboardList, Search, AlertCircle, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { PageLoader, LoadingSpinner, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

/* ─── single order card ─── */
const OrderCard = ({ order, idx, onAction, loading, paymentMethods, setPaymentMethods, halfPayments, setHalfPayments }) => {
  const getStatus = () => {
    if (order.currentStage === 'DELIVERED' || order.status === 'COMPLETED') return 'DELIVERED';
    if (order.auditLogs?.find(l => l.action === 'NOT_RESPONDED')) return 'NOT_RESPONDED';
    return 'PENDING';
  };

  const status = getStatus();
  const isDelivered = status === 'DELIVERED';
  const isNoResponse = status === 'NOT_RESPONDED';

  const deliveryStage = order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
  const deliveredAt = deliveryStage?.completedAt || deliveryStage?.updatedAt || order.updatedAt;

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
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase mt-1 ${
              order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            }`}>
              {order.outletName || (order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL' ? 'ONLINE' : order.source || order.createdBy?.role || '—')}
            </span>
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
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setPaymentMethods(prev => ({ ...prev, [order.id]: 'CASH' })); setHalfPayments(prev => ({ ...prev, [order.id]: undefined })); }}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${
                    (paymentMethods[order.id] || 'CASH') === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                      : 'bg-gray-800 theme-text-secondary border border-gray-700'
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => { setPaymentMethods(prev => ({ ...prev, [order.id]: 'ONLINE_TRANSFER' })); setHalfPayments(prev => ({ ...prev, [order.id]: undefined })); }}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${
                    paymentMethods[order.id] === 'ONLINE_TRANSFER'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-gray-800 theme-text-secondary border border-gray-700'
                  }`}
                >
                  💳 Online
                </button>
                <button
                  onClick={() => {
                    setPaymentMethods(prev => ({ ...prev, [order.id]: 'HALF_CASH_HALF_ONLINE' }));
                    if (!halfPayments?.[order.id]) {
                      const total = Number(order.totalPrice || 0);
                      setHalfPayments(prev => ({ ...prev, [order.id]: { cash: Math.floor(total / 2), online: Math.ceil(total / 2) } }));
                    }
                  }}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${
                    paymentMethods[order.id] === 'HALF_CASH_HALF_ONLINE'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                      : 'bg-gray-800 theme-text-secondary border border-gray-700'
                  }`}
                >
                  💜 Half & Half
                </button>
              </div>
              {paymentMethods[order.id] === 'HALF_CASH_HALF_ONLINE' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-[8px] theme-text-muted font-black uppercase tracking-widest mb-1">Cash Amount</p>
                    <input
                      type="number"
                      value={halfPayments?.[order.id]?.cash || 0}
                      onChange={e => setHalfPayments(prev => ({ ...prev, [order.id]: { ...prev?.[order.id], cash: Math.min(Number(e.target.value) || 0, order.totalPrice || 0) } }))}
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500"
                      min="0"
                      max={order.totalPrice || 0}
                    />
                  </div>
                  <div>
                    <p className="text-[8px] theme-text-muted font-black uppercase tracking-widest mb-1">Online Amount</p>
                    <input
                      type="number"
                      value={halfPayments?.[order.id]?.online || 0}
                      onChange={e => setHalfPayments(prev => ({ ...prev, [order.id]: { ...prev?.[order.id], online: Math.min(Number(e.target.value) || 0, order.totalPrice || 0) } }))}
                      className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500"
                      min="0"
                      max={order.totalPrice || 0}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <button
                disabled={loading === order.id}
                onClick={() => {
                  const method = paymentMethods[order.id] || 'CASH';
                  if (method === 'HALF_CASH_HALF_ONLINE') {
                    const hp = halfPayments?.[order.id] || { cash: 0, online: 0 };
                    onAction(order.id, 'DELIVERED', '', method, hp.cash, hp.online);
                  } else {
                    onAction(order.id, 'DELIVERED', '', method);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1.5 py-5 bg-emerald-600 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40"
              >
                {loading === order.id ? (
                  <LoadingSpinner size={16} text="Processing..." />
                ) : (
                  <><CheckCircle2 size={28} /><span className="text-sm">Delivered</span><span className="text-[9px] opacity-70 font-bold">مل گیا</span></>
                )}
              </button>
              <button
                disabled={loading === order.id}
                onClick={() => onAction(order.id, 'NOT_RESPONDED', 'Customer did not respond')}
                className="flex flex-col items-center justify-center gap-1.5 py-5 bg-gray-800 border-2 border-amber-500/40 text-amber-400 rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50"
              >
                {loading === order.id ? (
                  <LoadingSpinner size={16} text="Processing..." />
                ) : (
                  <><PhoneOff size={28} /><span className="text-sm">No Response</span><span className="text-[9px] opacity-70 font-bold">جواب نہیں</span></>
                )}
              </button>
            </div>
            <button
              disabled={loading === order.id}
              onClick={() => {
                const reason = prompt('Reason for return:');
                if (!reason) return;
                onAction(order.id, 'RETURN', reason);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600/10 hover:bg-orange-600/20 rounded-2xl border border-orange-500/20 text-sm font-black uppercase tracking-wider text-orange-400 active:scale-95 transition-all"
            >
              {loading === order.id ? (
                <LoadingSpinner size={16} text="Processing..." />
              ) : (
                <><AlertCircle size={18} />Return Order</>
              )}
            </button>
          </>
        )}

        {/* Already delivered message */}
        {isDelivered && (
          <div className="space-y-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400 font-black text-sm">Order Delivered Successfully</p>
            </div>
            {deliveredAt && (
              <p className="text-[9px] text-emerald-600/80 font-bold ml-9">
                {new Date(deliveredAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
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
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [orderNoSearch, setOrderNoSearch] = useState('');
  const [paymentMethods, setPaymentMethods] = useState({});
  const [halfPayments, setHalfPayments] = useState({});

  const fetchOrders = useCallback(async (retries = 2) => {
    setLoading(true);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await axios.get(`${API_URL}/api/orders?status=delivery`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        });
        const relevant = res.data.filter(o =>
          o.currentStage === 'OUT_FOR_DELIVERY' ||
          o.currentStage === 'DELIVERED' ||
          o.status === 'COMPLETED'
        );
        setOrders(relevant);
        setLoading(false);
        return;
      } catch {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        toast.error('Failed to load orders');
        setLoading(false);
      }
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

  const handleAction = async (orderId, deliveryStatus, remarks, paymentMethod, cashAmount, onlineAmount) => {
    try {
      setActionLoading(orderId);
      if (deliveryStatus === 'RETURN') {
        await axios.post(`${API_URL}/api/orders/${orderId}/refund`, { reason: remarks || 'Returned by delivery boy' }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Order returned — moved to Refund Management');
        fetchOrders();
        return;
      }
      const body = { deliveryStatus, remarks, paymentMethod };
      if (paymentMethod === 'HALF_CASH_HALF_ONLINE') {
        body.cashAmount = cashAmount || 0;
        body.onlineAmount = onlineAmount || 0;
      }
      await axios.put(`${API_URL}/api/orders/${orderId}/delivery`, body, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
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
      setActionLoading(null);
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
      o.customerPhone?.includes(search);
    const matchOrderNo = !orderNoSearch ||
      (o.orderNumber || '').toLowerCase().includes(orderNoSearch.toLowerCase()) ||
      o.id?.toLowerCase().includes(orderNoSearch.toLowerCase());
    const matchFilter = filter === 'ALL' || status === filter;
    const delStage = o.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
    const stageDate = delStage?.completedAt || delStage?.updatedAt || o.updatedAt || o.createdAt;
    const matchDate = !selectedDate ||
      new Date(stageDate).toISOString().split('T')[0] === selectedDate;
    return matchSearch && matchOrderNo && matchFilter && matchDate;
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
        <button onClick={() => { setFilter('PENDING'); setSelectedDate(''); }} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'PENDING' ? 'bg-blue-600 border-blue-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'PENDING' ? 'text-white' : 'text-blue-400'}`}>{pending.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'PENDING' ? 'text-blue-100' : 'theme-text-muted'}`}>{t('Pending')}</p>
        </button>
        <button onClick={() => { setFilter('DELIVERED'); setSelectedDate(''); }} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'DELIVERED' ? 'bg-emerald-600 border-emerald-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'DELIVERED' ? 'text-white' : 'text-emerald-400'}`}>{delivered.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'DELIVERED' ? 'text-emerald-100' : 'theme-text-muted'}`}>{t('Delivered')}</p>
        </button>
        <button onClick={() => { setFilter('NOT_RESPONDED'); setSelectedDate(''); }} className={`rounded-2xl p-4 text-center transition-all border-2 ${filter === 'NOT_RESPONDED' ? 'bg-amber-600 border-amber-500' : 'theme-bg theme-border'}`}>
          <p className={`text-xl md:text-3xl font-black ${filter === 'NOT_RESPONDED' ? 'text-white' : 'text-amber-400'}`}>{noResponse.length}</p>
          <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${filter === 'NOT_RESPONDED' ? 'text-amber-100' : 'theme-text-muted'}`}>{t('No Reply')}</p>
        </button>
      </div>

      {/* Show All button */}
      <button
        onClick={() => { setFilter('ALL'); setSelectedDate(''); }}
        className={`w-full py-3 rounded-2xl text-sm font-black uppercase tracking-widest border-2 transition-all ${filter === 'ALL' ? 'bg-gray-700 border-gray-600 text-white' : 'theme-bg theme-border theme-text-muted'}`}
      >
        {t('Show All')} ({orders.length})
      </button>

      {/* Filters row: Date + Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full theme-input rounded-2xl py-3 pl-10 pr-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
          />
        </div>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate('')}
            className="text-[8px] font-black text-red-400 uppercase tracking-wider px-2 py-1 hover:text-red-300 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Order Number filter */}
      <div className="relative">
        <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
        <input
          type="text"
          value={orderNoSearch}
          onChange={e => setOrderNoSearch(e.target.value)}
          placeholder="Filter by order number..."
          className="w-full theme-input rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* Search by name/phone */}
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
        <PageLoader text="Loading Delivery Dashboard..." />
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
              halfPayments={halfPayments}
              setHalfPayments={setHalfPayments}
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
