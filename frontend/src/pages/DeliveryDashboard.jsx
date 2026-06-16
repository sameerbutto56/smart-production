import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import socket from '../socket';
import {
  Truck, CheckCircle2, PhoneOff, Phone,
  RefreshCw, ClipboardList, Search, AlertCircle, Calendar,
  ChevronDown, ChevronUp, Clock, UserCheck, XCircle, RotateCcw,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { PageLoader, LoadingSpinner, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { printDeliveryReport } from '../utils/printReport';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);
const MAX_ATTEMPTS = 3;

/* ─── Attempt History Panel ─── */
const AttemptHistory = ({ attempts }) => {
  if (!attempts || attempts.length === 0) return null;
  return (
    <div className="bg-gray-800/60 rounded-2xl p-3 border border-gray-700/50 space-y-2">
      <p className="text-xs font-black theme-text-muted uppercase tracking-widest mb-1">Delivery Attempts ({attempts.length})</p>
      {attempts.map((a) => (
        <div key={a.id} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-3 py-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            a.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
            a.status === 'NO_RESPONSE' ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {a.status === 'DELIVERED' ? <CheckCircle2 size={14} /> :
             a.status === 'NO_RESPONSE' ? <PhoneOff size={14} /> : <XCircle size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white">
              Attempt #{a.attemptNumber} — {a.status === 'DELIVERED' ? 'Delivered' : a.status === 'NO_RESPONSE' ? 'No Response' : a.status}
            </p>
            <p className="text-[10px] theme-text-muted font-bold">
              {new Date(a.attemptedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              {a.attemptedAt && ` at ${new Date(a.attemptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              {a.riderName && ` · ${a.riderName}`}
            </p>
            {a.rescheduledTo && (
              <p className="text-[10px] text-amber-400 font-bold">
                Rescheduled to {new Date(a.rescheduledTo).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </p>
            )}
            {a.notes && <p className="text-[10px] theme-text-muted italic mt-0.5">{a.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── single order card ─── */
const OrderCard = ({ order, idx, onAction, onAccept, loading, acceptLoading,
  paymentMethods, setPaymentMethods, halfPayments, setHalfPayments, tab }) => {
  const [showHistory, setShowHistory] = useState(false);

  const isAccepted = !!order.riderAcceptedAt;
  const isDelivered = order.currentStage === 'DELIVERED' || order.status === 'COMPLETED';
  const noResponseCount = order.noResponseCount || 0;
  const maxReached = noResponseCount >= MAX_ATTEMPTS;
  const attempts = order.deliveryAttempts || [];

  const deliveryStage = order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
  const deliveredAt = order.deliveredAt || deliveryStage?.completedAt || deliveryStage?.updatedAt || order.updatedAt;

  let pd = {};
  try { let raw = JSON.parse(order.productDetails || '{}'); pd = Array.isArray(raw) ? (raw[0]?.productDetails || raw[0] || {}) : (raw || {}); } catch {}

  const isPending = tab === 'pending';
  const isNoResp = tab === 'noresponse';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={`rounded-[1.8rem] overflow-hidden border-2 transition-all ${
        isDelivered
          ? 'border-emerald-500/30 bg-emerald-950/20'
          : maxReached
          ? 'border-red-500/30 bg-red-950/20'
          : isNoResp
          ? 'border-amber-500/30 bg-amber-950/20'
          : isAccepted
          ? 'border-blue-500/30 bg-blue-950/10'
          : 'theme-border theme-bg'
      }`}
    >
      <div className={`h-1.5 w-full ${
        isDelivered ? 'bg-emerald-500' : maxReached ? 'bg-red-500' : isNoResp ? 'bg-amber-500' : isAccepted ? 'bg-blue-600' : 'bg-gray-600'
      }`} />

      <div className="p-5 space-y-4">
        {/* Row 1: Number + Name + Status + Attempt Badge */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center font-black text-lg text-gray-300 flex-shrink-0">
            {idx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black theme-text-primary text-xl leading-tight">{order.customerName}</p>
              {order.priority === 'SUPER_URGENT' && (
                <span className="text-xs md:text-sm font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                  ⚡ SUPER URGENT
                </span>
              )}
              {order.priority === 'URGENT' && (
                <span className="text-xs md:text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  ⚡ URGENT
                </span>
              )}
              {noResponseCount > 0 && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${
                  maxReached
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  Attempt {noResponseCount}/{MAX_ATTEMPTS}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-400 font-black mt-1 tracking-wider">
              ORDER #{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
            </p>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase ${
                order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}>
                {order.outletName || (order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL' ? 'ONLINE' : order.source || order.createdBy?.role || '—')}
              </span>
              {order.deliveryMethod && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase ${
                  order.deliveryMethod === 'ENAMELS' || order.deliveryMethod === 'ENAMELS_DELIVERY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {order.deliveryMethod}
                </span>
              )}
              {order.paymentStatus === 'PAID' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PAID
                </span>
              )}
            </div>
          </div>
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs md:text-sm font-black border ${
            isDelivered
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : maxReached
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : isNoResp
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : isAccepted
              ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
              : 'text-gray-400 bg-gray-800 border-gray-700'
          }`}>
            {isDelivered ? '✓ Done' : maxReached ? '✗ Max' : isNoResp ? '✗ No Reply' : isAccepted ? 'Active' : 'Pending'}
          </div>
        </div>

        {/* Row 2: Phone + Address + Product + Amount */}
        <div className="space-y-2">
          {order.customerPhone ? (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl px-4 py-3"
            >
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">📞 Tap to Call</p>
                <p className="font-black theme-text-primary text-lg leading-tight">{order.customerPhone}</p>
              </div>
            </a>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl px-4 py-3 theme-text-muted text-sm font-bold">
              No phone number
            </div>
          )}

          {order.address && (
            <div className="bg-gray-800/50 rounded-2xl px-4 py-3 border theme-border">
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">📍 Delivery Address</p>
              <p className="font-black theme-text-primary text-base mt-0.5 whitespace-pre-wrap">{order.address}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">Product</p>
              <p className="font-black theme-text-primary text-base mt-0.5 truncate">{pd.productType || order.type || '—'}</p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">Amount</p>
              <p className="font-black text-emerald-400 text-base mt-0.5">
                ₨{Number(order.totalPrice || 0).toLocaleString()}
              </p>
              <p className="text-xs md:text-sm theme-text-muted font-bold mt-0.5">
                {order.paymentMethod === 'ONLINE_TRANSFER' ? '💳 Online' : parseFloat(order.advanceAmount) > 0 ? `✅ Adv ₨${parseFloat(order.advanceAmount).toLocaleString()}` : '💵 COD'}
              </p>
            </div>
          </div>
        </div>

        {/* Pending tab: Accept button */}
        {isPending && !isAccepted && !isDelivered && (
          <button
            disabled={loading === order.id || acceptLoading === order.id}
            onClick={() => onAccept(order.id)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/40"
          >
            {acceptLoading === order.id ? (
              <LoadingSpinner size={16} text="Accepting..." />
            ) : (
              <><UserCheck size={22} /><span className="text-sm">Accept Order</span></>
            )}
          </button>
        )}

        {/* Active or No Response tab: Delivery actions */}
        {(isAccepted || isNoResp) && !isDelivered && !maxReached && (
          <>
            {noResponseCount > 0 && order.nextDeliveryDate && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                <RotateCcw size={18} className="text-amber-400 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-300">
                  Rescheduled to {new Date(order.nextDeliveryDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
            {order.paymentStatus === 'PAID' ? (
              /* Prepaid order: only show Deliver / No Response / Return — no payment collection */
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                  <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">Payment Status: PAID</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button disabled={loading === order.id} onClick={() => onAction(order.id, 'DELIVERED', '', 'CASH', 0, 0)} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5">
                    <span>✓</span> Deliver
                  </button>
                  <button disabled={loading === order.id} onClick={() => onAction(order.id, 'NOT_RESPONDED', '')} className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-900/40 flex items-center justify-center gap-1.5">
                    <PhoneOff size={14} /> No Reply
                  </button>
                  <button disabled={loading === order.id} onClick={() => onAction(order.id, 'CANCELLED', 'Returned - not delivered')} className="py-3 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-900/40 flex items-center justify-center gap-1.5">
                    <RotateCcw size={14} /> Return
                  </button>
                </div>
              </div>
            ) : (
              /* Unpaid order: show Payment Method selection + delivery actions */
              <div className="space-y-3">
                <div className="bg-gray-800/40 rounded-2xl p-3 border border-gray-700/50">
                  <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest mb-2">Payment Method</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [order.id]: 'CASH' })); setHalfPayments(prev => ({ ...prev, [order.id]: undefined })); }}
                      className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${(paymentMethods[order.id] || 'CASH') === 'CASH' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>💵 Cash</button>
                    <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [order.id]: 'ONLINE_TRANSFER' })); setHalfPayments(prev => ({ ...prev, [order.id]: undefined })); }}
                      className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethods[order.id] === 'ONLINE_TRANSFER' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>💳 Online</button>
                    <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [order.id]: 'HALF_CASH_HALF_ONLINE' })); if (!halfPayments?.[order.id]) { const total = Number(order.totalPrice || 0); setHalfPayments(prev => ({ ...prev, [order.id]: { cash: Math.floor(total / 2), online: Math.ceil(total / 2) } })); } }}
                      className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethods[order.id] === 'HALF_CASH_HALF_ONLINE' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>💜 Half & Half</button>
                  </div>
                  {paymentMethods[order.id] === 'HALF_CASH_HALF_ONLINE' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-xs theme-text-muted font-black uppercase tracking-widest mb-1">Cash Amount</p>
                        <input type="number" value={halfPayments?.[order.id]?.cash || 0} onChange={e => setHalfPayments(prev => ({ ...prev, [order.id]: { ...prev?.[order.id], cash: Math.min(Number(e.target.value) || 0, order.totalPrice || 0) } }))} className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500" min="0" max={order.totalPrice || 0} />
                      </div>
                      <div>
                        <p className="text-xs theme-text-muted font-black uppercase tracking-widest mb-1">Online Amount</p>
                        <input type="number" value={halfPayments?.[order.id]?.online || 0} onChange={e => setHalfPayments(prev => ({ ...prev, [order.id]: { ...prev?.[order.id], online: Math.min(Number(e.target.value) || 0, order.totalPrice || 0) } }))} className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500" min="0" max={order.totalPrice || 0} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={loading === order.id}
                    onClick={() => { const method = paymentMethods[order.id] || 'CASH'; if (method === 'HALF_CASH_HALF_ONLINE') { const hp = halfPayments?.[order.id] || { cash: 0, online: 0 }; onAction(order.id, 'DELIVERED', '', method, hp.cash, hp.online); } else { onAction(order.id, 'DELIVERED', '', method); } }}
                    className="flex flex-col items-center justify-center gap-1.5 py-5 bg-emerald-600 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40">
                    {loading === order.id ? <LoadingSpinner size={16} text="Processing..." /> : <><CheckCircle2 size={28} /><span className="text-sm">Delivered</span><span className="text-xs opacity-70 font-bold">مل گیا</span></>}
                  </button>
                  <button disabled={loading === order.id} onClick={() => onAction(order.id, 'NOT_RESPONDED', 'Customer did not respond')}
                    className="flex flex-col items-center justify-center gap-1.5 py-5 bg-gray-800 border-2 border-amber-500/40 text-amber-400 rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50">
                    {loading === order.id ? <LoadingSpinner size={16} text="Processing..." /> : <><PhoneOff size={28} /><span className="text-sm">No Response</span><span className="text-xs opacity-70 font-bold">جواب نہیں</span></>}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={loading === order.id} onClick={() => { const reason = prompt('Reason for return:'); if (!reason) return; onAction(order.id, 'RETURN', reason); }}
                    className="flex items-center justify-center gap-2 py-3 bg-orange-600/10 hover:bg-orange-600/20 rounded-2xl border border-orange-500/20 text-sm font-black uppercase tracking-wider text-orange-400 active:scale-95 transition-all">
                    {loading === order.id ? <LoadingSpinner size={16} text="Processing..." /> : <><AlertCircle size={18} />Return</>}
                  </button>
                  {attempts.length > 0 && (
                    <button onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center justify-center gap-2 py-3 bg-gray-800 rounded-2xl border border-gray-700 text-sm font-black text-gray-300 active:scale-95 transition-all">
                      {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      History ({attempts.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Max attempts reached */}
        {maxReached && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <XCircle size={22} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 font-black text-sm">Max delivery attempts reached — awaiting manual action</p>
            </div>
          </div>
        )}

        {/* Delivered message */}
        {isDelivered && (
          <div className="space-y-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400 font-black text-sm">Order Delivered Successfully</p>
            </div>
            {deliveredAt && (
              <p className="text-xs text-emerald-600/80 font-bold ml-9">
                {new Date(deliveredAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {attempts.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-xs font-black text-emerald-500/80 hover:text-emerald-400 ml-9 mt-1"
              >
                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Delivery History ({attempts.length})
              </button>
            )}
          </div>
        )}

        {/* Expandable history */}
        {showHistory && <AttemptHistory attempts={attempts} />}
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
  const [acceptLoading, setAcceptLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending');
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

  const handleAccept = async (orderId) => {
    try {
      setAcceptLoading(orderId);
      await axios.put(`${API_URL}/api/orders/${orderId}/accept-delivery`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order accepted!');
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Accept failed');
    } finally {
      setAcceptLoading(null);
    }
  };

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

  const pending = orders.filter(o =>
    !o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED'
  );
  const active = orders.filter(o =>
    o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED'
  );
  const noResponse = orders.filter(o =>
    (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED'
  );
  const completed = orders.filter(o =>
    o.currentStage === 'DELIVERED' || o.status === 'COMPLETED'
  );

  const filtered = orders.filter(o => {
    const inTab =
      tab === 'pending' ? (!o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'active' ? (o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'noresponse' ? ((o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'completed' ? (o.currentStage === 'DELIVERED' || o.status === 'COMPLETED') : true;
    if (!inTab) return false;
    const matchSearch = !search ||
      o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone?.includes(search);
    const matchOrderNo = !orderNoSearch ||
      (o.orderNumber || '').toLowerCase().includes(orderNoSearch.toLowerCase()) ||
      o.id?.toLowerCase().includes(orderNoSearch.toLowerCase());
    const delStage = o.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
    const stageDate = delStage?.completedAt || delStage?.updatedAt || o.updatedAt || o.createdAt;
    const matchDate = !selectedDate ||
      new Date(stageDate).toISOString().split('T')[0] === selectedDate;
    return matchSearch && matchOrderNo && matchDate;
  });

  return (
    <div className="max-w-xl mx-auto pb-36 px-3 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between pt-3 pb-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
            <Truck className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black theme-text-primary leading-none">Deliveries</h1>
            <p className="text-xs theme-text-muted font-bold mt-0.5">{user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printDeliveryReport(orders)}
            className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all"
            title="Print Delivery Report"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={fetchOrders}
            className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900/60 rounded-2xl p-1 border border-gray-800 overflow-x-auto">
        {[
          { key: 'pending', label: 'Pending', count: pending.length, color: 'bg-blue-600 text-white' },
          { key: 'active', label: 'Active', count: active.length, color: 'bg-blue-600 text-white' },
          { key: 'noresponse', label: 'No Reply', count: noResponse.length, color: 'bg-amber-600 text-white' },
          { key: 'completed', label: 'Done', count: completed.length, color: 'bg-emerald-600 text-white' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedDate(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              tab === t.key
                ? t.color + ' shadow-lg'
                : 'theme-text-muted hover:text-white'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full theme-input rounded-2xl py-2.5 pl-10 pr-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
          />
        </div>
        {selectedDate && (
          <button
            onClick={() => setSelectedDate('')}
            className="text-xs font-black text-red-400 uppercase tracking-wider px-2 hover:text-red-300 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative">
        <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
        <input
          type="text"
          value={orderNoSearch}
          onChange={e => setOrderNoSearch(e.target.value)}
          placeholder="Order number..."
          className="w-full theme-input rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
        />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or phone..."
          className="w-full theme-input rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {/* Order list */}
      {loading ? (
        <PageLoader text="Loading Delivery Dashboard..." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <ClipboardList size={36} className="theme-text-muted" />
          <p className="theme-text-muted font-black text-base">No orders here</p>
          <p className="text-gray-700 text-xs max-w-[200px]">
            {tab === 'pending' ? 'Orders will appear here when sent for delivery.' :
             tab === 'active' ? 'Accept orders from the Pending tab.' :
             tab === 'noresponse' ? 'No Response orders appear here.' :
             'Delivered orders appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, idx) => (
            <OrderCard
              key={order.id}
              order={order}
              idx={idx}
              tab={tab}
              onAction={handleAction}
              onAccept={handleAccept}
              loading={actionLoading}
              acceptLoading={acceptLoading}
              paymentMethods={paymentMethods}
              setPaymentMethods={setPaymentMethods}
              halfPayments={halfPayments}
              setHalfPayments={setHalfPayments}
            />
          ))}
        </div>
      )}

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 theme-bg/95 backdrop-blur-xl border-t-2 theme-border px-5 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">COD to Collect</p>
            <p className="text-lg font-black text-amber-400">
              ₨{pending
                .filter(o => !(parseFloat(o.advanceAmount) > 0))
                .reduce((s, o) => s + (Number(o.totalPrice) || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-800" />
          <div className="text-center">
            <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">Collected</p>
            <p className="text-lg font-black text-emerald-400">
              ₨{completed
                .reduce((s, o) => s + (Number(o.totalPrice) || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-800" />
          <div className="text-right">
            <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">Remaining</p>
            <p className="text-lg font-black theme-text-primary">{active.length} left</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
