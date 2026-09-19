import React, { useState } from 'react';
import api from '../services/api';
import {
  Search, RefreshCcw, PackageX, AlertCircle, CheckCircle2, Calendar, Clock,
  User, Phone, ArrowRight, XCircle, RotateCcw, AlertTriangle, Info, History
} from 'lucide-react';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';
import BackButton from '../components/BackButton';

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
  const [history, setHistory] = useState([]);
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
    setOrder(null); setRequest(null); setHistory([]); setTimeline([]);
    try {
      const res = await api.get('/api/orders/cancellation-request', { params: { orderNumber: clean } });
      setOrder(res.data.order);
      setRequest(res.data.request);
      setHistory(res.data.cancellationHistory || []);
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
  const nextCycleNumber = (history.length || 0) + (isPending ? 0 : 1);

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto space-y-4">
      <div>
        <BackButton className="mb-3" />
        <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
          <PackageX size={18} className="text-red-400" /> Order Cancellation
        </h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          Search an order by number, review it, then request cancellation or re-cancellation for Admin approval
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={orderNumber}
          onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(orderNumber)}
          placeholder="Enter order number (e.g., 50335 or REP-50335)..."
          className="flex-1 bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500 transition-colors"
        />
        <button
          onClick={() => load(orderNumber)}
          disabled={loading}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
        >
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} Search
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      {order && (
        <div className="space-y-4">
          {/* Cancellation status banner */}
          {isCancelled ? (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex items-start gap-3">
              <PackageX size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-red-400 uppercase tracking-widest">Order Status: CANCELLED</p>
                  <span className="bg-red-500/20 text-red-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Final State</span>
                </div>
                <p className="text-xs text-gray-200 font-bold mt-1">This order has been permanently cancelled after Admin approval.</p>
                {request?.reason && <p className="text-xs text-red-300 font-bold mt-1 italic">Approved Reason: {request.reason}</p>}
                {request?.decidedByName && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1">Approved by {request.decidedByName} — {fmt(request.decidedAt)}</p>
                )}
                <p className="text-[10px] text-red-400/80 font-bold mt-2">Re-cancellation is not available because the order is already cancelled.</p>
              </div>
            </div>
          ) : isPending ? (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
              <Clock size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-amber-400 uppercase tracking-widest">
                    Cancellation Status: PENDING (Cycle #{request?.cycleNumber || 1})
                  </p>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Awaiting Decision</span>
                </div>
                <p className="text-xs text-gray-200 font-bold mt-1">
                  A cancellation request for this order is awaiting Admin approval. The order remains active in stage <span className="text-white font-black">{STAGE_LABELS[order.trackingStatus] || order.currentStage}</span> until approved.
                </p>
                {request?.reason && <p className="text-xs text-amber-300 font-bold mt-1 italic">Requested Reason: {request.reason}</p>}
                {request?.requestedByName && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1">Requested by {request.requestedByName} — {fmt(request.createdAt)}</p>
                )}
                <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs px-3 py-1.5 rounded-xl">
                  <Clock size={14} /> Cancellation Request Pending — Cannot submit another request until Admin decides
                </div>
              </div>
            </div>
          ) : isRejected ? (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-red-400 uppercase tracking-widest">Cancellation Status: REJECTED</p>
                    <span className="bg-red-500/20 text-red-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Cycle #{request?.cycleNumber || 1} Rejected</span>
                  </div>
                  <p className="text-xs text-white font-black mt-1 bg-red-950/60 px-2 py-1 rounded-lg inline-block border border-red-800/50">
                    This order is rejected, not cancelled. The order remains active in operational workflow ({STAGE_LABELS[order.trackingStatus] || order.currentStage}).
                  </p>
                  {request?.reason && <p className="text-xs text-gray-300 font-bold mt-2">Requested Reason: <span className="italic">{request.reason}</span></p>}
                  {request?.decisionNote ? (
                    <div className="mt-2 bg-red-900/30 border border-red-500/30 rounded-xl p-2.5">
                      <p className="text-[10px] font-black uppercase text-red-400">Admin Rejection Reason:</p>
                      <p className="text-xs font-bold text-red-200 mt-0.5 italic">"{request.decisionNote}"</p>
                    </div>
                  ) : (
                    <p className="text-xs text-red-300 font-bold mt-1 italic">Admin rejected this cancellation request.</p>
                  )}
                  {request?.decidedByName && (
                    <p className="text-[10px] text-gray-400 font-bold mt-1">Rejected by {request.decidedByName} — {fmt(request.decidedAt)}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCancelModal(true)}
                className="shrink-0 flex items-center gap-2 text-xs font-black px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-900/30"
              >
                <RotateCcw size={15} /> RE-CANCEL (Cycle #{nextCycleNumber})
              </button>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">No Active Cancellation Request</p>
                  <p className="text-xs text-gray-300 font-bold mt-1">This order is active in stage <span className="text-white font-black">{STAGE_LABELS[order.trackingStatus] || order.currentStage}</span>. You can request its cancellation — Admin approval is required.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCancelModal(true)}
                className="shrink-0 flex items-center gap-1.5 text-xs font-black px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-900/30"
              >
                <PackageX size={15} /> Cancel Order
              </button>
            </div>
          )}

          {/* Order details grid */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-lg font-black text-white">#{order.orderNumber}</p>
                <p className="text-xs text-gray-400 font-bold">{order.customerName}{order.customerPhone ? ` — ${order.customerPhone}` : ''}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">Entered {fmt(order.createdAt)}</p>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${isCancelled ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'}`}>
                {isCancelled ? 'CANCELLED' : 'ACTIVE IN WORKFLOW'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Current Stage</p>
                <p className="font-black mt-0.5 text-white">{STAGE_LABELS[order.trackingStatus] || order.currentStage || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Total Price</p>
                <p className="text-emerald-400 font-black mt-0.5">₨{(order.totalPrice || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Type</p>
                <p className="text-white font-bold mt-0.5">{order.type || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2.5">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Source / Outlet</p>
                <p className="text-white font-bold mt-0.5">{order.source || order.outletName || '—'}</p>
              </div>
            </div>
          </div>

          {/* Cancellation History multi-cycle view */}
          {history.length > 0 && (
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><History size={14} className="text-red-400" /> Cancellation Request History ({history.length} Cycle{history.length > 1 ? 's' : ''})</span>
                <span className="text-[10px] text-gray-500 font-bold">Historical cycles are preserved permanently</span>
              </p>
              <div className="space-y-3">
                {history.map((reqItem, idx) => {
                  const reqStatus = reqItem.status;
                  const cycleNum = reqItem.cycleNumber || (history.length - idx);
                  return (
                    <div key={reqItem.id || idx} className="bg-gray-950 border border-gray-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            reqStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                            reqStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                            'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          }`}>
                            Cycle #{cycleNum} — {reqStatus}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold">Requested {fmt(reqItem.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-300 font-bold">
                        <span className="text-gray-500">Requested By:</span> {reqItem.requestedByName || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-300 font-bold bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                        <span className="text-gray-400 text-[10px] uppercase font-black block mb-0.5">Cancellation Reason:</span>
                        "{reqItem.reason}"
                      </div>
                      {reqStatus === 'REJECTED' && (
                        <div className="text-xs text-red-300 font-bold bg-red-950/40 p-2 rounded-lg border border-red-900/40">
                          <span className="text-red-400 text-[10px] uppercase font-black block mb-0.5">Admin Rejection Reason:</span>
                          "{reqItem.decisionNote || 'No rejection note provided'}"
                          {reqItem.decidedByName && (
                            <span className="block text-[10px] text-gray-400 mt-1 font-normal">Rejected by {reqItem.decidedByName} — {fmt(reqItem.decidedAt)}</span>
                          )}
                        </div>
                      )}
                      {reqStatus === 'APPROVED' && (
                        <div className="text-xs text-emerald-300 font-bold bg-emerald-950/40 p-2 rounded-lg border border-emerald-900/40">
                          <span className="text-emerald-400 text-[10px] uppercase font-black block mb-0.5">Admin Decision:</span>
                          Cancellation Approved by {reqItem.decidedByName || 'Admin'} — {fmt(reqItem.decidedAt)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Clock size={12} /> Operational Timeline <ArrowRight size={10} />
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {timeline.map((e, idx) => (
                  <div key={e.id || idx} className="flex items-center gap-2 text-[11px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      e.action === 'COMPLETED' ? 'bg-emerald-500' :
                      e.action === 'ACCEPTED' ? 'bg-blue-500' :
                      (e.action || '').includes('REJECT') ? 'bg-red-400' :
                      (e.action || '').includes('CANCELL') ? 'bg-red-500' : 'bg-gray-600'
                    }`} />
                    <span className="text-gray-300 font-bold min-w-0 truncate">{e.label || e.stageLabel || e.stage}</span>
                    {e.details && <span className="text-gray-500 truncate max-w-[200px] text-[10px]">({e.details})</span>}
                    <span className="text-gray-500 font-bold ml-auto shrink-0">{fmt(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel / Re-Cancel modal */}
      {showCancelModal && order && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-gray-900 border-2 border-red-900/60 rounded-2xl p-4 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={22} className="text-red-400" />
              <h3 className="text-lg font-black text-white">
                {isRejected ? `Re-Cancel Order #${order.orderNumber}` : `Request Cancellation`}
              </h3>
            </div>
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-1">
              <p className="text-xs text-gray-400 font-bold">Order Number: <span className="text-white font-black">#{order.orderNumber}</span></p>
              <p className="text-xs text-gray-400 font-bold">Customer: <span className="text-white">{order.customerName}</span></p>
              <p className="text-xs text-gray-400 font-bold">Current Cycle: <span className="text-amber-400 font-black">Cycle #{nextCycleNumber}</span></p>
            </div>
            {isRejected && request?.decisionNote && (
              <div className="bg-red-950/50 border border-red-900/60 p-3 rounded-xl">
                <p className="text-[10px] font-black text-red-400 uppercase">Previous Rejection Note:</p>
                <p className="text-xs text-red-200 font-bold italic mt-0.5">"{request.decisionNote}"</p>
              </div>
            )}
            <p className="text-xs text-gray-400">
              This will submit a new cancellation request (Cycle #{nextCycleNumber}) to the Admin for approval. The order remains active until approved.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-1">Reason for Cancellation *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={4}
                placeholder={isRejected ? "Enter reason for requesting cancellation again (e.g. customer delivery timeline changed)..." : "Reason for cancellation..."}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 resize-none font-bold"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3 rounded-xl text-sm transition-all"
              >
                Keep Order Active
              </button>
              <button
                disabled={submitting || !reason.trim()}
                onClick={submitCancellation}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
              >
                {submitting ? 'Submitting...' : <><PackageX size={16} /> Submit Request</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaisalOrderCancellation;
