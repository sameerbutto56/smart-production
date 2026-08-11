import React, { useState } from 'react';
import api from '../services/api';
import { Search, RefreshCcw, PackageX, AlertCircle, CheckCircle2, Calendar, Clock, User, Phone, ArrowRight } from 'lucide-react';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive', IN_DISPATCH: 'In Dispatch',
  VERIFICATION: 'Verification', RETURNED_FROM_VERIFICATION: 'Returned from Verification',
  CANCELLED: 'Cancelled', DELIVERED: 'Delivered'
};

const fmt = (ts) => (ts ? `${formatDateOnly(ts)} ${formatTimeOnly(ts)}` : '—');

const FaisalOrderCancellation = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [request, setRequest] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async (query) => {
    const clean = String(query || '').trim().replace(/^#/, '');
    if (!clean) { setError('Please enter an order number'); return; }
    setLoading(true); setError('');
    setOrder(null); setRequest(null); setTimeline([]);
    try {
      const res = await api.get('/api/orders/cancellation-request', { params: { orderNumber: clean } });
      setOrder(res.data.order);
      setRequest(res.data.request);
      try {
        const tlRes = await api.get(`/api/orders/${res.data.order.id}/timeline`);
        setTimeline(tlRes.data?.flatEntries || tlRes.data || []);
      } catch { /* timeline is supplementary */ }
    } catch (e) {
      setError(e.response?.status === 404 ? 'Order not found' : 'Error fetching order');
    } finally { setLoading(false); }
  };

  const submitCancellation = async () => {
    if (!reason.trim()) { toast.error('Please enter a reason for cancellation'); return; }
    setSubmitting(true);
    try {
      const res = await api.put(`/api/orders/${order.id}/cancel`, { reason: reason.trim() });
      toast.success(res.data.message || 'Cancellation request sent to Admin for approval');
      setShowCancelModal(false);
      setReason('');
      load(order.orderNumber);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancellation request failed');
    } finally { setSubmitting(false); }
  };

  const isCancelled = order?.status === 'CANCELLED' || order?.currentStage === 'CANCELLED';
  const isPending = request?.status === 'PENDING';
  const isRejected = request?.status === 'REJECTED';
  const canRequest = order && !isCancelled && !isPending;

  const cancellationEvents = timeline.filter(e =>
    (e.action && (e.action.includes('CANCELL') || e.action.includes('CANCELLATION'))) || e.label?.includes('Cancel'));

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <PackageX size={18} className="text-red-400" /> Order Cancellation
        </h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          Search an order by number, review it, then request cancellation for Admin approval
        </p>
      </div>

      <div className="flex gap-2">
        <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(orderNumber)}
          placeholder="Enter order number (e.g., 49502 or REP-49502)..."
          className="flex-1 bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500 transition-colors" />
        <button onClick={() => load(orderNumber)} disabled={loading}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      {order && (
        <div className="space-y-4">
          {/* Cancellation status banner */}
          {isCancelled ? (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex items-start gap-3">
              <PackageX size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">Order Cancelled</p>
                <p className="text-xs text-gray-300 font-bold mt-1">This order has been permanently cancelled.</p>
                {request?.reason && <p className="text-xs text-red-300 font-bold mt-1 italic">Reason: {request.reason}</p>}
                {request?.decidedByName && <p className="text-[10px] text-gray-400 font-bold mt-1">Approved by {request.decidedByName} — {fmt(request.decidedAt)}</p>}
              </div>
            </div>
          ) : isPending ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
              <Clock size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-400 uppercase tracking-widest">Cancellation Requested</p>
                <p className="text-xs text-gray-300 font-bold mt-1">
                  A cancellation request for this order is awaiting Admin approval. The order stays active until approved.
                </p>
                {request?.reason && <p className="text-xs text-amber-300 font-bold mt-1 italic">Reason: {request.reason}</p>}
                {request?.requestedByName && <p className="text-[10px] text-gray-400 font-bold mt-1">Requested by {request.requestedByName} — {fmt(request.createdAt)}</p>}
              </div>
            </div>
          ) : isRejected ? (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">Cancellation Rejected</p>
                <p className="text-xs text-gray-300 font-bold mt-1">The previous cancellation request for this order was not approved.</p>
                {request?.reason && <p className="text-xs text-red-300 font-bold mt-1 italic">Requested reason: {request.reason}</p>}
                {request?.decisionNote && <p className="text-xs text-red-300 font-bold mt-1 italic">Admin note: {request.decisionNote}</p>}
                {request?.decidedByName && <p className="text-[10px] text-gray-400 font-bold mt-1">Decided by {request.decidedByName} — {fmt(request.decidedAt)}</p>}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">No Cancellation Requested</p>
                  <p className="text-xs text-gray-300 font-bold mt-1">This order is active. You can request its cancellation — Admin approval is required.</p>
                </div>
              </div>
              <button onClick={() => setShowCancelModal(true)}
                className="shrink-0 flex items-center gap-1 text-xs font-black px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all">
                <PackageX size={14} /> Cancel Order
              </button>
            </div>
          )}

          {/* Order details */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-lg font-black text-white">#{order.orderNumber}</p>
                <p className="text-xs text-gray-400 font-bold">{order.customerName}{order.customerPhone ? ` — ${order.customerPhone}` : ''}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">Entered {fmt(order.createdAt)}</p>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isCancelled ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {isCancelled ? 'CANCELLED' : 'IN PROGRESS'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Current Stage</p>
                <p className="font-black mt-0.5 text-white">{STAGE_LABELS[order.trackingStatus] || order.currentStage || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Total</p>
                <p className="text-emerald-400 font-black mt-0.5">₨{(order.totalPrice || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Type</p>
                <p className="text-white font-bold mt-0.5">{order.type || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Source</p>
                <p className="text-white font-bold mt-0.5">{order.source || order.outletName || '—'}</p>
              </div>
            </div>
          </div>

          {/* Cancellation history */}
          {cancellationEvents.length > 0 && (
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                <PackageX size={12} /> Cancellation History
              </p>
              <div className="space-y-2">
                {cancellationEvents.map((e, idx) => (
                  <div key={e.id || idx} className="flex items-start gap-3 bg-gray-800/40 rounded-xl p-3">
                    <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${e.action?.includes('APPROVED') ? 'bg-red-500' : e.action?.includes('REJECTED') ? 'bg-red-400' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white">{e.label || e.action || e.stageLabel}</p>
                      {e.details && <p className="text-[10px] text-gray-400 font-bold mt-0.5 italic">{e.details}</p>}
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">{e.actor ? `${e.actor} • ` : ''}{fmt(e.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full history */}
          {timeline.length > 0 && (
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Clock size={12} /> Order History <ArrowRight size={10} />
                <span className="text-gray-600 normal-case font-bold tracking-normal">see Order Track for the full timeline</span>
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {timeline.map((e, idx) => (
                  <div key={e.id || idx} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.action === 'COMPLETED' ? 'bg-emerald-500' : e.action === 'ACCEPTED' ? 'bg-blue-500' : e.action === 'ROUTED' ? 'bg-purple-500' : (e.action || '').includes('CANCELL') || (e.action || '').includes('RETURN') ? 'bg-red-500' : 'bg-gray-600'}`} />
                    <span className="text-gray-300 font-bold min-w-0 truncate">{e.label || e.stageLabel || e.stage}</span>
                    <span className="text-gray-500 font-bold ml-auto shrink-0">{fmt(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && order && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-400" />
              <h3 className="text-lg font-black text-white">Request Cancellation</h3>
            </div>
            <p className="text-sm text-gray-400">Order: <span className="text-white font-black">#{order.orderNumber}</span></p>
            <p className="text-xs text-gray-500">This submits a cancellation request to the Admin for approval. The order stays active until approved.</p>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Reason for Cancellation *</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="e.g. Customer no longer wants this order..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-black py-3 rounded-xl text-sm transition-all">Keep Order</button>
              <button
                disabled={submitting || !reason.trim()}
                onClick={submitCancellation}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {submitting ? 'Sending...' : <><PackageX size={16} /> Request Cancellation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaisalOrderCancellation;
