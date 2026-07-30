import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import useCache from '../hooks/useCache';
import {
  Truck, CheckCircle2, PhoneOff, Phone,
  RefreshCw, Search, AlertCircle, Calendar,
  ChevronDown, ChevronUp, Clock, UserCheck, XCircle, RotateCcw,
  Printer, DollarSign, BarChart3, Wallet, CreditCard, Building2, Eye,
  Plus, Minus, TrendingUp, ListOrdered, Award,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { isPaidOrder, getRemainingBalance, getCodAmount } from '../utils/paymentUtils';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import { printDeliveryReport } from '../utils/printReport';

const MAX_ATTEMPTS = 3;

/* ─── multiple online inputs ─── */
const MultipleOnlineInputs = ({ entries, setEntries }) => {
  const addEntry = () => setEntries([...entries, { provider: '', amount: '', ref: '' }]);
  const removeEntry = (i) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateEntry = (i, field, val) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    setEntries(next);
  };
  return (
    <div className="space-y-2 bg-gray-800/40 rounded-xl p-3 border border-blue-500/20">
      <p className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
        <Building2 size={14} /> Multiple Online Sources
      </p>
      {entries.map((e, i) => (
        <div key={i} className="grid grid-cols-3 gap-1.5">
          <input type="text" placeholder="Source" value={e.provider} onChange={(v) => updateEntry(i, 'provider', v.target.value)}
            className="px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs font-bold text-white outline-none focus:border-blue-500" />
          <input type="number" placeholder="Amount" value={e.amount} onChange={(v) => updateEntry(i, 'amount', v.target.value)}
            className="px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs font-bold text-white outline-none focus:border-blue-500" />
          <div className="flex gap-1">
            <input type="text" placeholder="Ref" value={e.ref} onChange={(v) => updateEntry(i, 'ref', v.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs font-bold text-white outline-none focus:border-blue-500" />
            {entries.length > 1 && <button onClick={() => removeEntry(i)} className="p-1.5 text-red-400 hover:text-red-300"><XCircle size={14} /></button>}
          </div>
        </div>
      ))}
      <button onClick={addEntry} className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1">
        <Plus size={14} /> Add Source
      </button>
    </div>
  );
};

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

/* ─── single order card ─── */
const OrderCard = ({ order, idx, onAction, onAccept, loading, acceptLoading,
  paymentMethods, setPaymentMethods, halfPayments, setHalfPayments, multiOnlineEntries, setMultiOnlineEntries, tab }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showCODSummary, setShowCODSummary] = useState(false);
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
  let allProducts = [];
  try {
    const raw = order.productDetails;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      allProducts = parsed.map(item => item?.productDetails || item || {});
      pd = allProducts[0] || {};
    } else {
      pd = parsed || {};
      allProducts = [pd];
    }
  } catch { pd = {}; allProducts = [{}]; }

  const isPending = tab === 'pending';
  const isNoResp = tab === 'noresponse';

  const orderId = order.id;
  const totalRemaining = getRemainingBalance(order);

  // Multiple online entries state per order
  const multiEntries = multiOnlineEntries[orderId] || [{ provider: '', amount: totalRemaining || '', ref: '' }];

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
              {(() => {
                const paid = isPaidOrder(order);
                const remaining = getRemainingBalance(order);
                if (paid) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PAID</span>;
                if (remaining > 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">COD: ₨{remaining.toLocaleString()}</span>;
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">CASH ON DELIVERY</span>;
              })()}
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
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">Products ({allProducts.length})</p>
              <div className="space-y-1 mt-1">
                {allProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-blue-400 bg-blue-500/20 px-1 rounded">{i + 1}</span>
                    <p className="font-black theme-text-primary text-sm truncate">
                      {p.productType || p.name || '—'}
                      {p.color ? <span className="text-xs text-gray-500"> ({p.color})</span> : null}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800/60 rounded-2xl px-4 py-3">
              <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest">Amount</p>
              <p className="font-black text-emerald-400 text-base mt-0.5">₨{Number(order.totalPrice || 0).toLocaleString()}</p>
              {!isPaidOrder(order) && totalRemaining > 0 ? (
                <button onClick={() => setShowCODSummary(true)} className="w-full text-left mt-0.5 group">
                  <p className="text-xs md:text-sm font-bold mt-0.5 text-orange-400 group-hover:text-orange-300 underline decoration-dotted">💰 COD: ₨{totalRemaining.toLocaleString()} — tap for breakdown</p>
                </button>
              ) : (
                <p className="text-xs md:text-sm theme-text-muted font-bold mt-0.5">
                  {isPaidOrder(order) ? '✅ PAID — No COD Due' : `💰 COD: ₨${totalRemaining.toLocaleString()}`}
                </p>
              )}
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
            {(() => {
              const paid = isPaidOrder(order);
              const statusBanner = paid
                ? <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-3"><span className="text-emerald-400 font-black text-xs uppercase tracking-wider">Payment Status: PAID — No COD Due</span></div>
                : <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-4 py-2.5 flex items-center gap-3"><span className="text-orange-400 font-black text-xs uppercase tracking-wider">COD: ₨{totalRemaining.toLocaleString()}</span></div>;
              if (paid) return (
                <div className="space-y-3">
                  {statusBanner}
                  <div className="grid grid-cols-3 gap-3">
                    <button disabled={loading === order.id} onClick={() => onAction(order.id, 'DELIVERED', '', 'CASH', 0, 0, [])} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5">
                      <span>✓</span> Deliver
                    </button>
                    <button disabled={loading === order.id} onClick={() => onAction(order.id, 'NOT_RESPONDED', '')} className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-900/40 flex items-center justify-center gap-1.5">
                      <PhoneOff size={14} /> No Reply
                    </button>
                    <button disabled={loading === order.id} onClick={() => onAction(order.id, 'CANCELLED', 'Returned')} className="py-3 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-900/40 flex items-center justify-center gap-1.5">
                      <RotateCcw size={14} /> Return
                    </button>
                  </div>
                </div>
              );
              return (
                <div className="space-y-3">
                  {statusBanner}
                  {/* Payment Method Selection */}
                  <div className="bg-gray-800/40 rounded-2xl p-3 border border-gray-700/50">
                    <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest mb-2">Payment Method</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [orderId]: 'CASH' })); setHalfPayments(prev => ({ ...prev, [orderId]: undefined })); setMultiOnlineEntries(prev => ({ ...prev, [orderId]: [{ provider: '', amount: totalRemaining || '', ref: '' }] })); }}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${(paymentMethods[orderId] || 'CASH') === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>
                        💵 Cash
                      </button>
                      <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [orderId]: 'ONLINE' })); setHalfPayments(prev => ({ ...prev, [orderId]: undefined })); setMultiOnlineEntries(prev => ({ ...prev, [orderId]: [{ provider: '', amount: totalRemaining || '', ref: '' }] })); }}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethods[orderId] === 'ONLINE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>
                        💳 Online
                      </button>
                      <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [orderId]: 'CASH_ONLINE' })); if (!halfPayments?.[orderId]) { setHalfPayments(prev => ({ ...prev, [orderId]: { cash: Math.floor(totalRemaining / 2), online: Math.ceil(totalRemaining / 2) } })); } setMultiOnlineEntries(prev => ({ ...prev, [orderId]: [{ provider: '', amount: totalRemaining || '', ref: '' }] })); }}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethods[orderId] === 'CASH_ONLINE' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>
                        💜 Cash + Online
                      </button>
                      <button onClick={() => { setPaymentMethods(prev => ({ ...prev, [orderId]: 'MULTIPLE_ONLINE' })); setHalfPayments(prev => ({ ...prev, [orderId]: undefined })); }}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-xs font-black transition-all ${paymentMethods[orderId] === 'MULTIPLE_ONLINE' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-800 theme-text-secondary border border-gray-700'}`}>
                        📱 Multiple Online
                      </button>
                    </div>

                    {/* Cash+Online split inputs */}
                    {paymentMethods[orderId] === 'CASH_ONLINE' && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs theme-text-muted font-black uppercase tracking-widest mb-1">Cash Amount</p>
                          <input type="number" value={halfPayments?.[orderId]?.cash || 0} onChange={e => setHalfPayments(prev => ({ ...prev, [orderId]: { ...prev?.[orderId], cash: Math.min(Number(e.target.value) || 0, totalRemaining) } }))} className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500" min="0" max={totalRemaining} />
                        </div>
                        <div>
                          <p className="text-xs theme-text-muted font-black uppercase tracking-widest mb-1">Online Amount</p>
                          <input type="number" value={halfPayments?.[orderId]?.online || 0} onChange={e => setHalfPayments(prev => ({ ...prev, [orderId]: { ...prev?.[orderId], online: Math.min(Number(e.target.value) || 0, totalRemaining) } }))} className="w-full px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white font-black text-sm outline-none focus:border-purple-500" min="0" max={totalRemaining} />
                        </div>
                      </div>
                    )}

                    {/* Multiple Online inputs */}
                    {paymentMethods[orderId] === 'MULTIPLE_ONLINE' && (
                      <div className="mt-3">
                        <MultipleOnlineInputs entries={multiEntries} setEntries={(updater) => {
                          const next = typeof updater === 'function' ? updater(multiEntries) : updater;
                          setMultiOnlineEntries(prev => ({ ...prev, [orderId]: next }));
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={loading === order.id}
                      onClick={() => {
                        const method = paymentMethods[orderId] || 'CASH';
                        if (method === 'CASH_ONLINE') {
                          const hp = halfPayments?.[orderId] || { cash: 0, online: 0 };
                          onAction(orderId, 'DELIVERED', '', method, hp.cash, hp.online, []);
                        } else if (method === 'MULTIPLE_ONLINE') {
                          const totalMulti = multiEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                          onAction(orderId, 'DELIVERED', '', method, 0, totalMulti, multiEntries.filter(e => e.amount));
                        } else if (method === 'CASH') {
                          onAction(orderId, 'DELIVERED', '', method, totalRemaining, 0, []);
                        } else {
                          onAction(orderId, 'DELIVERED', '', method, 0, totalRemaining, []);
                        }
                      }}
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
              );
            })()}
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

        {/* COD Payment Summary Modal */}
        {showCODSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowCODSummary(false)}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-white">COD Payment Summary</h3>
                <button onClick={() => setShowCODSummary(false)} className="p-1 text-gray-400 hover:text-white"><XCircle size={18} /></button>
              </div>
              <div className="space-y-2 text-xs">
                {(() => {
                  const pdArr = allProducts;
                  const subtotal = pdArr.reduce((s, p) => s + (Number(p.unitPrice || p.price || 0) * Number(p.quantity || order.quantity || 1)), 0);
                  const totalQty = pdArr.reduce((s, p) => s + Number(p.quantity || order.quantity || 1), 0);
                  const advance = Number(order.advanceAmount || 0);
                  const delivery = Number(order.deliveryCharges || 0);
                  const customization = Number(order.customizationPrice || 0);
                  const logo = Number(order.logoCharges || 0);
                  const namePrint = Number(order.namePrintingCharges || 0);
                  const productCost = Number(order.productCost || 0);
                  const grossProfit = Number(order.grossProfit || 0);
                  const lines = [];
                  lines.push({ label: 'Products', value: pdArr.map(p => (p.productType || p.name)).join(', ') || '—', isText: true });
                  lines.push({ label: 'Subtotal', value: subtotal || Number(order.totalPrice || 0) - delivery - customization - logo - namePrint });
                  lines.push({ label: 'Quantity', value: totalQty || order.quantity || 1 });
                  if (delivery > 0) lines.push({ label: 'Delivery Charges', value: delivery });
                  if (customization > 0) lines.push({ label: 'Customization', value: customization });
                  if (logo > 0) lines.push({ label: 'Logo Charges', value: logo });
                  if (namePrint > 0) lines.push({ label: 'Name/Engraving', value: namePrint });
                  lines.push({ label: 'Total Invoice', value: Number(order.totalPrice || 0), bold: true });
                  if (advance > 0) lines.push({ label: 'Advance Paid', value: -advance, color: 'text-emerald-400' });
                  lines.push({ label: 'Remaining COD', value: totalRemaining, bold: true, highlight: true });
                  return lines.map((l, i) => (
                    <div key={i} className={`flex justify-between py-1.5 ${l.bold ? 'border-t border-gray-700 pt-2 mt-1' : ''} ${l.highlight ? 'bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-2 -mx-2' : ''}`}>
                      <span className={`font-bold ${l.highlight ? 'text-orange-400' : 'text-gray-400'}`}>{l.label}</span>
                      {l.isText ? <span className="text-white font-bold text-right max-w-[60%] truncate">{l.value}</span>
                        : <span className={`font-black ${l.color || (l.highlight ? 'text-orange-400 text-sm' : l.bold ? 'text-white' : 'text-gray-300')}`}>
                            {typeof l.value === 'number' ? `₨${Math.abs(l.value).toLocaleString()}${l.value < 0 ? ' (deducted)' : ''}` : l.value}
                          </span>}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ─── Delivery Charges Ledger ─── */
const DeliveryChargesPanel = ({ refresh }) => {
  const [chargesData, setChargesData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/delivery/charges');
      setChargesData(res.data);
    } catch { toast.error('Failed to load charges'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCharges(); }, [fetchCharges]);

  if (loading) return <LoadingSpinner text="Loading charges..." />;
  if (!chargesData) return null;

  const { charges, totalPending, payments, totalPaid } = chargesData;
  let runningTotal = 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
          <DollarSign size={16} /> Delivery Charges Ledger
        </h3>
        <span className="text-xs font-black text-gray-500">PKR 200 / order</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded-xl p-3 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Pending</p>
          <p className="text-xl font-black text-emerald-400">₨{totalPending.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 font-bold">{charges.length} orders</p>
        </div>
        <div className="bg-gray-800/60 rounded-xl p-3 border border-blue-500/20">
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Total Paid</p>
          <p className="text-xl font-black text-blue-400">₨{totalPaid.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 font-bold">{payments?.length || 0} clearances</p>
        </div>
      </div>

      {/* Charges list */}
      {charges.length > 0 && (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="px-3 py-2 bg-gray-900/60 border-b border-gray-700/50 grid grid-cols-4 gap-2 text-[9px] font-black text-gray-500 uppercase tracking-widest">
            <span>Order</span>
            <span>Customer</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
          </div>
          {charges.map((c) => {
            runningTotal += c.amount;
            return (
              <div key={c.id} className="px-3 py-2 border-b border-gray-800/30 grid grid-cols-4 gap-2 text-xs font-bold text-gray-300">
                <span className="text-blue-400">#{c.orderNumber || '—'}</span>
                <span className="truncate">{c.customerName || '—'}</span>
                <span className="text-gray-500">{new Date(c.deliveredAt).toLocaleDateString()}</span>
                <span className="text-right text-emerald-400">₨{c.amount.toLocaleString()}</span>
              </div>
            );
          })}
          <div className="px-3 py-2 bg-gray-900/60 grid grid-cols-4 gap-2 text-xs font-black text-white">
            <span>Total</span>
            <span />
            <span />
            <span className="text-right text-emerald-400">₨{runningTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments?.length > 0 && (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden mt-3">
          <p className="px-3 py-2 text-[10px] font-black text-blue-400 uppercase tracking-widest border-b border-gray-700/50">Payment History</p>
          {payments.map((p) => (
            <div key={p.id} className="px-3 py-2 border-b border-gray-800/30 flex items-center justify-between text-xs">
              <span className="text-gray-400">{new Date(p.paidAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="font-black text-emerald-400">₨{(p.totalAmount || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── COD Collection Panel ─── */
const CODCollectionPanel = ({ refresh }) => {
  const [codData, setCodData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const fetchCOD = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/delivery/cod');
      setCodData(res.data);
    } catch (err) { console.error('COD fetch error:', err?.response?.data || err.message); toast.error(err?.response?.data?.error || 'Failed to load COD data'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCOD(); }, [fetchCOD]);

  if (loading) return <LoadingSpinner text="Loading COD..." />;
  if (!codData) return null;

  const { filteredCODAmount = 0, filteredCODOrders = 0, pendingCODAmount = 0, pendingCODOrders = 0, pendingDeliveries = [], collections = [] } = codData || {};

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
        <Wallet size={16} /> COD Collection
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Filtered COD</p>
          <p className="text-xl font-black text-amber-400">₨{filteredCODAmount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 font-bold">{filteredCODOrders} orders</p>
        </div>
        <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20">
          <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Pending COD</p>
          <p className="text-xl font-black text-orange-400">₨{pendingCODAmount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 font-bold">{pendingCODOrders} orders</p>
        </div>
      </div>

      {/* Pending deliveries detail */}
      {pendingDeliveries?.length > 0 && (
        <div>
          <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest">
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Pending COD Orders ({pendingDeliveries.length})
          </button>
          {showDetails && (
            <div className="mt-2 bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
              <div className="px-3 py-2 bg-gray-900/60 border-b border-gray-700/50 grid grid-cols-4 gap-2 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                <span>Order</span>
                <span>Customer</span>
                <span>COD Amount</span>
                <span>Date</span>
              </div>
              {pendingDeliveries.map((o) => {
                const codAmount = isPaidOrder(o) ? 0 : getCodAmount(o);
                return (
                  <div key={o.id} className="px-3 py-2 border-b border-gray-800/30 grid grid-cols-4 gap-2 text-xs font-bold text-gray-300">
                    <span className="text-blue-400">#{o.orderNumber || '—'}</span>
                    <span className="truncate">{o.customerName}</span>
                    <span className="text-amber-400">₨{codAmount.toLocaleString()}</span>
                    <span className="text-gray-500">{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString() : '—'}</span>
                  </div>
                );
              })}
              <div className="px-3 py-2 bg-gray-900/60 grid grid-cols-4 gap-2 text-xs font-black text-white">
                <span>Total COD</span>
                <span />
                <span className="text-amber-400">₨{pendingCODAmount.toLocaleString()}</span>
                <span />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collection history */}
      {collections?.length > 0 && (
        <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-700/50">Clearance History</p>
          {collections.map((c) => (
            <div key={c.id} className="px-3 py-2 border-b border-gray-800/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-300 font-bold">{c.dispatchOfficer}</span>
                {c.deliveryBoyName && <span className="text-gray-500 ml-2">→ {c.deliveryBoyName}</span>}
                <p className="text-[10px] text-gray-600">{new Date(c.clearedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <span className="font-black text-emerald-400">₨{(c.totalAmount || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Performance Panel ─── */
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
  const [paymentMethods, setPaymentMethods] = useState({});
  const [halfPayments, setHalfPayments] = useState({});
  const [multiOnlineEntries, setMultiOnlineEntries] = useState({});
  const [view, setView] = useState('orders'); // orders, charges, cod, performance

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

  const handleAction = async (orderId, deliveryStatus, remarks, paymentMethod, cashAmount, onlineAmount, multiOnline) => {
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
      const body = { paymentMethod, riderName: user?.name };
      if (paymentMethod === 'CASH') { body.cashAmount = onlineAmount ? 0 : parseFloat(cashAmount) || 0; body.onlineAmount = 0; }
      else if (paymentMethod === 'ONLINE') { body.cashAmount = 0; body.onlineAmount = parseFloat(onlineAmount) || 0; }
      else if (paymentMethod === 'CASH_ONLINE') { body.cashAmount = cashAmount || 0; body.onlineAmount = onlineAmount || 0; }
      else if (paymentMethod === 'MULTIPLE_ONLINE') { body.cashAmount = 0; body.onlineAmount = parseFloat(onlineAmount) || 0; body.multipleOnlineDetails = multiOnline || []; }
      await api.put(`/api/delivery/${orderId}/deliver`, body);
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

  const bottomBarCOD = pending
    .reduce((s, o) => s + getCodAmount(o), 0);

  const filteredCompleted = orders.filter(o => {
    const isCompleted = o.currentStage === 'DELIVERED' || o.status === 'COMPLETED';
    if (!isCompleted) return false;
    const matchSearch = !search || o.customerName?.toLowerCase().includes(search.toLowerCase()) || o.customerPhone?.includes(search);
    const matchOrderNo = !orderNoSearch || (o.orderNumber || '').toLowerCase().includes(orderNoSearch.toLowerCase()) || o.id?.toLowerCase().includes(orderNoSearch.toLowerCase());
    const delStage = o.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
    const stageDate = delStage?.completedAt || delStage?.updatedAt || o.updatedAt || o.createdAt;
    const matchDate = !selectedDate || new Date(stageDate).toISOString().split('T')[0] === selectedDate;
    return matchSearch && matchOrderNo && matchDate;
  });

  const paymentSummary = (() => {
    let totalDeliveries = filteredCompleted.length;
    let cashCollected = 0;
    let onlineCollected = 0;
    let cardCollected = 0;
    let cashOnlineCash = 0;
    let cashOnlineOnline = 0;
    let codCollected = 0;

    for (const o of filteredCompleted) {
      const dps = o.deliveryPayments;
      if (dps && dps.length > 0) {
        for (const dp of dps) {
          if (dp.paymentMethod === 'CASH') {
            cashCollected += dp.cashAmount || 0;
          } else if (dp.paymentMethod === 'ONLINE') {
            onlineCollected += dp.onlineAmount || 0;
          } else if (dp.paymentMethod === 'CASH_ONLINE') {
            cashCollected += dp.cashAmount || 0;
            onlineCollected += dp.onlineAmount || 0;
            cashOnlineCash += dp.cashAmount || 0;
            cashOnlineOnline += dp.onlineAmount || 0;
          } else if (dp.paymentMethod === 'MULTIPLE_ONLINE') {
            onlineCollected += dp.onlineAmount || 0;
          } else if (dp.paymentMethod === 'CARD') {
            cardCollected += (dp.cashAmount || 0) + (dp.onlineAmount || 0);
          }
        }
      } else {
        const collected = Number(o.totalPrice || 0) - Number(o.advanceAmount || 0);
        if (o.paymentMethod === 'CASH') cashCollected += collected;
        else if (o.paymentMethod === 'ONLINE') onlineCollected += collected;
        else if (o.paymentMethod === 'CARD') cardCollected += collected;
        else if (o.paymentMethod === 'CASH_ONLINE') { cashCollected += collected / 2; onlineCollected += collected / 2; }
        else if (o.paymentMethod === 'MULTIPLE_ONLINE') onlineCollected += collected;
        else cashCollected += collected;
      }
      const orderCollected = dps && dps.length > 0
        ? dps.reduce((s, dp) => s + (dp.cashAmount || 0) + (dp.onlineAmount || 0), 0)
        : Number(o.totalPrice || 0) - Number(o.advanceAmount || 0);
      codCollected += orderCollected;
    }

    return { totalDeliveries, cashCollected, onlineCollected, cardCollected, cashOnlineCash, cashOnlineOnline, codCollected };
  })();

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
          <button onClick={() => printDeliveryReport(orders)} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all" title="Print Report">
            <Printer size={18} />
          </button>
          <button onClick={refresh} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 bg-gray-900/60 rounded-2xl p-1 border border-gray-800 overflow-x-auto">
        {[
          { key: 'orders', label: 'Orders', icon: Truck },
          { key: 'charges', label: 'Charges', icon: DollarSign },
          { key: 'cod', label: 'COD', icon: Wallet },
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

          {/* Payment Summary Cards */}
          {filteredCompleted.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800/60 rounded-xl p-2.5 border border-blue-500/20">
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Total Deliveries</p>
                <p className="text-lg font-black text-blue-400">{paymentSummary.totalDeliveries}</p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-2.5 border border-emerald-500/20">
                <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">Cash Collected</p>
                <p className="text-lg font-black text-emerald-400">₨{paymentSummary.cashCollected.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-2.5 border border-blue-500/20">
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Online Collected</p>
                <p className="text-lg font-black text-blue-400">₨{paymentSummary.onlineCollected.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/60 rounded-xl p-2.5 border border-purple-500/20">
                <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest">Cash + Online</p>
                <p className="text-lg font-black text-purple-400">₨{(paymentSummary.cashCollected + paymentSummary.onlineCollected).toLocaleString()}</p>
              </div>
              {paymentSummary.cardCollected > 0 && (
                <div className="bg-gray-800/60 rounded-xl p-2.5 border border-amber-500/20">
                  <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest">Card Collected</p>
                  <p className="text-lg font-black text-amber-400">₨{paymentSummary.cardCollected.toLocaleString()}</p>
                </div>
              )}
              <div className="bg-gray-800/60 rounded-xl p-2.5 border border-orange-500/20">
                <p className="text-[9px] text-orange-400 font-black uppercase tracking-widest">COD Collected</p>
                <p className="text-lg font-black text-orange-400">₨{paymentSummary.codCollected.toLocaleString()}</p>
              </div>
            </div>
          )}

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
                  loading={actionLoading} acceptLoading={acceptLoading}
                  paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods}
                  halfPayments={halfPayments} setHalfPayments={setHalfPayments}
                  multiOnlineEntries={multiOnlineEntries} setMultiOnlineEntries={setMultiOnlineEntries} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Delivery Charges View */}
      {view === 'charges' && <DeliveryChargesPanel refresh={refresh} />}

      {/* COD Collection View */}
      {view === 'cod' && <CODCollectionPanel refresh={refresh} />}

      {/* Performance View */}
      {view === 'performance' && <PerformancePanel />}

      {/* Fixed bottom bar */}
      {view === 'orders' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 theme-bg/95 backdrop-blur-xl border-t-2 theme-border px-5 py-3">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">COD to Collect</p>
              <p className="text-lg font-black text-amber-400">₨{bottomBarCOD.toLocaleString()}</p>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="text-center">
              <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">Collected</p>
              <p className="text-lg font-black text-emerald-400">₨{completed.reduce((s, o) => {
                const dps = o.deliveryPayments;
                if (dps && dps.length > 0) return s + dps.reduce((ds, dp) => ds + (dp.cashAmount || 0) + (dp.onlineAmount || 0), 0);
                return s + Math.max(0, Number(o.totalPrice || 0) - Number(o.advanceAmount || 0));
              }, 0).toLocaleString()}</p>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="text-right">
              <p className="text-[10px] theme-text-muted font-black uppercase tracking-widest">Remaining</p>
              <p className="text-lg font-black theme-text-primary">{active.length} left</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryDashboard;
