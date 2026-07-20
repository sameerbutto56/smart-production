import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import useCache from '../hooks/useCache';
import {
  Truck, CheckCircle2, PhoneOff, Phone,
  RefreshCw, Search, AlertCircle,
  ChevronDown, ChevronUp, Clock, UserCheck, XCircle, RotateCcw,
  Printer, BarChart3, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import { printDeliveryReport } from '../utils/printReport';

const MAX_ATTEMPTS = 3;

/* ─── Attempt History Panel ─── */
const AttemptHistory = ({ attempts, noResponseLogs }) => {
  const logs = noResponseLogs || [];
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
      {logs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-500/20">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">No Response Log</p>
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[10px] text-amber-300 font-bold">
              <span>Day {l.attemptNumber}</span>
              <span>·</span>
              <span>{new Date(l.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Performance Panel (read-only stats) ─── */
const PerformancePanel = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/delivery/performance?riderName=${encodeURIComponent(user?.name || '')}`);
      setStats(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [user?.name]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return <LoadingSpinner text="Loading stats..." />;
  if (!stats) return null;

  const items = [
    { label: 'Assigned Today', value: stats.assignedToday, color: 'text-blue-400', icon: UserCheck },
    { label: 'Delivered Today', value: stats.deliveredToday, color: 'text-emerald-400', icon: CheckCircle2 },
    { label: 'This Week', value: stats.deliveredThisWeek, color: 'text-teal-400', icon: TrendingUp },
    { label: 'This Month', value: stats.deliveredThisMonth, color: 'text-purple-400', icon: Award },
    { label: 'All Time', value: stats.allTimeDelivered, color: 'text-amber-400', icon: ListOrdered },
    { label: 'Pending', value: stats.pendingDeliveries, color: 'text-gray-400', icon: Clock },
    { label: 'Active', value: stats.activeDeliveries, color: 'text-blue-400', icon: Truck },
    { label: 'Returned', value: stats.returnedCount, color: 'text-orange-400', icon: RotateCcw },
    { label: 'No Response', value: stats.noResponseCount, color: 'text-red-400', icon: PhoneOff },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
        <BarChart3 size={16} /> Performance
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="bg-gray-800/50 rounded-xl p-2.5 border border-gray-700/30">
            <item.icon size={14} className={item.color} />
            <p className={`text-lg font-black ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── single order card (simplified — no payment UI) ─── */
const OrderCard = ({ order, idx, onAction, onAccept, loading, acceptLoading, tab }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { isUrdu } = useLanguage();

  const isAccepted = !!order.riderAcceptedAt;
  const isDelivered = order.currentStage === 'DELIVERED' || order.status === 'COMPLETED';
  const noResponseCount = order.noResponseCount || 0;
  const maxReached = noResponseCount >= MAX_ATTEMPTS;
  const attempts = order.deliveryAttempts || [];
  const noResponseLogs = order.noResponseLogs || [];

  const deliveryStage = order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
  const deliveredAt = order.deliveredAt || deliveryStage?.completedAt || deliveryStage?.updatedAt || order.updatedAt;

  let pd = {};
  try { let raw = order.productDetails || {}; pd = Array.isArray(raw) ? (raw[0]?.productDetails || raw[0] || {}) : (raw || {}); } catch {}

  const isPending = tab === 'pending';
  const isNoResp = tab === 'noresponse';

  const orderId = order.id;
  const totalRemaining = Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0));

  const _isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID';
  const _hasAdv = parseFloat(order.advanceAmount || 0) > 0;

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
                <span className="text-xs md:text-sm font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">⚡ SUPER URGENT</span>
              )}
              {order.priority === 'URGENT' && (
                <span className="text-xs md:text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">⚡ URGENT</span>
              )}
              {noResponseCount > 0 && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${
                  maxReached ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
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
              {_isPaid
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PAID</span>
                : _hasAdv
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">COD: ₨{totalRemaining.toLocaleString()}</span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">CASH ON DELIVERY</span>
              }
            </div>
          </div>
          <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs md:text-sm font-black border ${
            isDelivered ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
            maxReached ? 'text-red-400 bg-red-500/10 border-red-500/20' :
            isNoResp ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
            isAccepted ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
            'text-gray-400 bg-gray-800 border-gray-700'
          }`}>
            {isDelivered ? '✓ Done' : maxReached ? '✗ Max' : isNoResp ? '✗ No Reply' : isAccepted ? 'Active' : 'Pending'}
          </div>
        </div>

        {/* Row 2: Phone + Address + Product + Amount */}
        <div className="space-y-2">
          {order.customerPhone ? (
            <a href={`tel:${order.customerPhone}`} className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all rounded-2xl px-4 py-3">
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">📞 Tap to Call</p>
                <p className="font-black theme-text-primary text-lg leading-tight">{order.customerPhone}</p>
              </div>
            </a>
          ) : (
            <div className="bg-gray-800/50 rounded-2xl px-4 py-3 theme-text-muted text-sm font-bold">No phone number</div>
          )}

          {order.city && (
            <div className="bg-amber-500/10 rounded-2xl px-4 py-3 border border-amber-500/20">
              <p className="font-black text-amber-400 text-base md:text-lg uppercase tracking-wider">📍 {order.city}</p>
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
              <p className="font-black theme-text-primary text-base mt-0.5 truncate">{isUrdu ? toUrduName(pd.productType || order.type || '—') : (pd.productType || order.type || '—')}</p>
            </div>
            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">Amount</p>
              <p className="font-black text-emerald-400 text-base mt-0.5">₨{Number(order.totalPrice || 0).toLocaleString()}</p>
              <p className="text-xs md:text-sm theme-text-muted font-bold mt-0.5">
                {_isPaid ? '✅ PAID' : `💰 COD: ₨${totalRemaining.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Pending tab: Accept button */}
        {isPending && !isAccepted && !isDelivered && (
          <button disabled={loading === order.id || acceptLoading === order.id}
            onClick={() => onAccept(order.id)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/40">
            {acceptLoading === order.id ? <LoadingSpinner size={16} text="Accepting..." /> : <><UserCheck size={22} /><span className="text-sm">Accept Order</span></>}
          </button>
        )}

        {/* Active or No Response tab: Delivery actions (simplified — no payment UI) */}
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
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                <span className="text-emerald-400 font-black text-xs uppercase tracking-wider">
                  {_isPaid ? 'Payment Status: PAID' : `COD: ₨${totalRemaining.toLocaleString()}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={loading === order.id}
                  onClick={() => onAction(order.id, 'DELIVERED', '')}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 bg-emerald-600 text-white rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40">
                  {loading === order.id ? <LoadingSpinner size={16} text="Processing..." /> : <><CheckCircle2 size={28} /><span className="text-sm">Delivered</span><span className="text-xs opacity-70 font-bold">مل گیا</span></>}
                </button>
                <button disabled={loading === order.id} onClick={() => onAction(orderId, 'NOT_RESPONDED', '')}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 bg-gray-800 border-2 border-amber-500/40 text-amber-400 rounded-2xl font-black active:scale-95 transition-all disabled:opacity-50">
                  {loading === order.id ? <LoadingSpinner size={16} text="Processing..." /> : <><PhoneOff size={28} /><span className="text-sm">No Response</span><span className="text-xs opacity-70 font-bold">جواب نہیں</span></>}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={loading === order.id} onClick={() => { const reason = prompt('Reason for return:'); if (!reason) return; onAction(orderId, 'RETURN', reason); }}
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
              <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-xs font-black text-emerald-500/80 hover:text-emerald-400 ml-9 mt-1">
                {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Delivery History ({attempts.length})
              </button>
            )}
          </div>
        )}

        {/* Expandable history */}
        {showHistory && <AttemptHistory attempts={attempts} noResponseLogs={noResponseLogs} />}
      </div>
    </motion.div>
  );
};

/* ─── main page ─── */
const DeliveryDashboard = () => {
  const { user } = useAuth();
  const { LanguageToggle, isUrdu } = useLanguage();

  const [actionLoading, setActionLoading] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending');
  const [selectedDate, setSelectedDate] = useState('');
  const [orderNoSearch, setOrderNoSearch] = useState('');
  const [view, setView] = useState('orders'); // orders, performance

  const dt = user?.name?.toLowerCase().includes('enamels') ? 'ENAMELS' : '';
  const cacheKey = `orders:delivery:${dt || 'default'}:v2`;
  const { data: orders = [], loading, refresh } = useCache(cacheKey, {
    fetcher: async () => {
      const params = `status=delivery${dt ? `&deliveryType=${dt}` : ''}`;
      const res = await api.get(`/api/orders?${params}`, { timeout: 15000 });
      return res.data.filter(o =>
        o.currentStage === 'OUT_FOR_DELIVERY' ||
        o.currentStage === 'DELIVERED' ||
        o.status === 'COMPLETED'
      );
    },
    ttl: 60 * 1000,
  });

  useEffect(() => {
    const debouncedRefresh = debounce(refresh, 300);
    socket.on('order-updated', debouncedRefresh);
    socket.on('new-order', debouncedRefresh);
    socket.on('stage-accepted', debouncedRefresh);
    return () => {
      socket.off('order-updated', debouncedRefresh);
      socket.off('new-order', debouncedRefresh);
      socket.off('stage-accepted', debouncedRefresh);
    };
  }, [refresh]);

  const handleAccept = async (orderId) => {
    try {
      setAcceptLoading(orderId);
      await api.put(`/api/delivery/${orderId}/accept`, { riderName: user?.name });
      toast.success('Order accepted!');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Accept failed');
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleAction = async (orderId, deliveryStatus, remarks) => {
    try {
      setActionLoading(orderId);
      if (deliveryStatus === 'RETURN') {
        await api.put(`/api/delivery/${orderId}/return`, { reason: remarks || 'Returned', riderName: user?.name });
        toast.success('Order returned to dispatch');
        refresh();
        return;
      }
      if (deliveryStatus === 'NOT_RESPONDED') {
        await api.put(`/api/delivery/${orderId}/no-response`, { riderName: user?.name });
        toast('No Response logged');
        refresh();
        return;
      }
      await api.put(`/api/delivery/${orderId}/deliver`, { paymentMethod: 'CASH', riderName: user?.name });
      toast.success('Delivered!', { duration: 3000 });
      refresh();
    } catch {
      toast.error('Update failed. Try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = orders.filter(o => !o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED');
  const active = orders.filter(o => o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED');
  const noResponse = orders.filter(o => (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED');
  const completed = orders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'COMPLETED');

  const filtered = orders.filter(o => {
    const inTab =
      tab === 'pending' ? (!o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'active' ? (o.riderAcceptedAt && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'noresponse' ? ((o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED' && o.status !== 'COMPLETED') :
      tab === 'completed' ? (o.currentStage === 'DELIVERED' || o.status === 'COMPLETED') : true;
    if (!inTab) return false;
    const matchSearch = !search || o.customerName?.toLowerCase().includes(search.toLowerCase()) || o.customerPhone?.includes(search);
    const matchOrderNo = !orderNoSearch || (o.orderNumber || '').toLowerCase().includes(orderNoSearch.toLowerCase()) || o.id?.toLowerCase().includes(orderNoSearch.toLowerCase());
    const delStage = o.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
    const stageDate = delStage?.completedAt || delStage?.updatedAt || o.updatedAt || o.createdAt;
    const matchDate = !selectedDate || new Date(stageDate).toISOString().split('T')[0] === selectedDate;
    return matchSearch && matchOrderNo && matchDate;
  });

  return (
    <div className="max-w-xl mx-auto pb-24 px-3 space-y-3">
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
          <button onClick={() => printDeliveryReport(orders)} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all" title="Print Report">
            <Printer size={18} />
          </button>
          <button onClick={refresh} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* View switcher (Orders + Stats only) */}
      <div className="flex gap-1 bg-gray-900/60 rounded-2xl p-1 border border-gray-800 overflow-x-auto">
        {[
          { key: 'orders', label: 'Orders', icon: Truck },
          { key: 'performance', label: 'Stats', icon: BarChart3 },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${view === v.key ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white'}`}>
            <v.icon size={14} /> {v.label}
          </button>
        ))}
      </div>

      {/* Orders View */}
      {view === 'orders' && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-900/60 rounded-2xl p-1 border border-gray-800 overflow-x-auto">
            {[
              { key: 'pending', label: 'Pending', count: pending.length, color: 'bg-blue-600 text-white' },
              { key: 'active', label: 'Active', count: active.length, color: 'bg-blue-600 text-white' },
              { key: 'noresponse', label: 'No Reply', count: noResponse.length, color: 'bg-amber-600 text-white' },
              { key: 'completed', label: 'Done', count: completed.length, color: 'bg-emerald-600 text-white' },
            ].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSelectedDate(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === t.key ? t.color + ' shadow-lg' : 'theme-text-muted hover:text-white'}`}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="w-full theme-input rounded-2xl py-2.5 pl-10 pr-3 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all" />
            </div>
            {selectedDate && <button onClick={() => setSelectedDate('')} className="text-xs font-black text-red-400 uppercase tracking-wider px-2 hover:text-red-300">Clear</button>}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={15} />
            <input type="text" value={orderNoSearch} onChange={e => setOrderNoSearch(e.target.value)} placeholder="Order number..."
              className="w-full theme-input rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all" />
          </div>

          <div className="relative">
            <ClipboardList size={15} className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..."
              className="w-full theme-input rounded-2xl py-2.5 pl-12 pr-4 text-xs font-bold text-white outline-none focus:border-blue-500 transition-all" />
          </div>

          {/* Order list */}
          {loading ? <PageLoader text="Loading Delivery Dashboard..." /> : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 text-center">
              <ClipboardList size={36} className="theme-text-muted" />
              <p className="theme-text-muted font-black text-base">No orders here</p>
              <p className="text-gray-700 text-xs max-w-[200px]">
                {tab === 'pending' ? 'Orders will appear here when sent for delivery.' :
                 tab === 'active' ? 'Accept orders from the Pending tab.' :
                 tab === 'noresponse' ? 'No Response orders appear here.' : 'Delivered orders appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((order, idx) => (
                <OrderCard key={order.id} order={order} idx={idx} tab={tab}
                  onAction={handleAction} onAccept={handleAccept}
                  loading={actionLoading} acceptLoading={acceptLoading} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Performance View (read-only stats) */}
      {view === 'performance' && <PerformancePanel />}
    </div>
  );
};

export default DeliveryDashboard;
