import React, { useState } from 'react';
import api from '../services/api';
import { Search, ArrowLeft, RefreshCcw, User, Calendar, Clock, Package, ArrowRight, CheckCircle2, Play, AlertTriangle, Truck, MapPin, ShieldCheck, AlertCircle, PackageX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive', IN_DISPATCH: 'In Dispatch',
  VERIFICATION: 'Verification', RETURNED_FROM_VERIFICATION: 'Returned from Verification', DELIVERED: 'Delivered'
};

// Department for each workflow stage (shown alongside the responsible user)
const STAGE_DEPARTMENTS = {
  ORDER_ENTRY: 'Order Entry', VERIFICATION: 'Verification', STORE: 'Store', STORE_RECEIVE: 'Store',
  WORKERS: 'Production', LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production', PRODUCTION: 'Production',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Delivery', OUTLET_RECEIVE: 'Outlet', IN_DISPATCH: 'Dispatch',
  ENAMELS_DELIVERY: 'Delivery', DELIVERED: 'Delivery'
};

const STAGE_ORDER = ['ORDER_ENTRY', 'VERIFICATION', 'STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'OUTLET_RECEIVE', 'IN_DISPATCH', 'DELIVERED'];

const STAGE_ICONS = {
  ORDER_ENTRY: Package, VERIFICATION: ShieldCheck, STORE: Package, WORKERS: Package,
  LOGO_DESIGN: Package, PRODUCTION_ACCEPTANCE: Package,
  PRODUCTION: Package, STORE_RECEIVE: Package,
  DISPATCH: Truck, OUT_FOR_DELIVERY: Truck,
  OUTLET_RECEIVE: MapPin, IN_DISPATCH: Truck, DELIVERED: CheckCircle2
};

const ENTRY_COLORS = {
  COMPLETED: { dot: 'bg-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  ACCEPTED: { dot: 'bg-blue-500', border: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  ROUTED: { dot: 'bg-purple-500', border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  RECEIVED: { dot: 'bg-amber-500', border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  FAILED: { dot: 'bg-red-500', border: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/40' },
  VERIFIED: { dot: 'bg-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  EDIT: { dot: 'bg-amber-500', border: 'border-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  RESTART: { dot: 'bg-orange-500', border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  audit: { dot: 'bg-gray-500', border: 'border-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
};

const getEntryColors = (entry) => {
  if (entry.action === 'COMPLETED') return ENTRY_COLORS.COMPLETED;
  if (entry.action === 'ACCEPTED') return ENTRY_COLORS.ACCEPTED;
  if (entry.action === 'ROUTED') return ENTRY_COLORS.ROUTED;
  if (entry.action === 'RECEIVED') return ENTRY_COLORS.RECEIVED;
  if (entry.action === 'ORDER_VERIFIED' || entry.action === 'VERIFIED') return ENTRY_COLORS.VERIFIED;
  if (entry.action === 'RETURNED_FOR_CORRECTION' || entry.action === 'ORDER_CANCELLED' || entry.action === 'DELIVERY_FAILED') return ENTRY_COLORS.FAILED;
  if (entry.action === 'RESUBMITTED_AFTER_VERIFICATION' || entry.action?.includes('EDIT')) return ENTRY_COLORS.EDIT;
  if (entry.action === 'WORKFLOW_RESTARTED') return ENTRY_COLORS.RESTART;
  if (entry.status === 'VERIFIED') return ENTRY_COLORS.VERIFIED;
  if (entry.status === 'RETURNED') return ENTRY_COLORS.FAILED;
  if (entry.status === 'RESUBMITTED') return ENTRY_COLORS.EDIT;
  if (entry.action?.includes('FAIL') || entry.action?.includes('RETURN') || entry.action?.includes('CANCELL')) return ENTRY_COLORS.FAILED;
  return ENTRY_COLORS.audit;
};

// Status badge text + styling derived from the entry's action/status
const getStatusBadge = (entry) => {
  if (entry.action === 'COMPLETED') return { text: 'COMPLETED', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  if (entry.action === 'ACCEPTED') return { text: 'IN PROGRESS', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  if (entry.action === 'ROUTED') return { text: 'ROUTED', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
  if (entry.action === 'RECEIVED') {
    if (entry.status === 'COMPLETED') return { text: 'COMPLETED', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    return { text: 'RECEIVED', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
  }
  if (entry.status === 'VERIFIED') return { text: 'VERIFIED', cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' };
  if (entry.status === 'RETURNED') return { text: 'RETURNED', cls: 'bg-red-500/20 text-red-400 border-red-500/40' };
  if (entry.status === 'RESUBMITTED') return { text: 'RESUBMITTED', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
  if (entry.status === 'PENDING') return { text: 'PENDING', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
  if (entry.status === 'ROUTED') return { text: 'ROUTED', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/40' };
  if (entry.status === 'IN_PROGRESS') return { text: 'IN PROGRESS', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
  return { text: entry.status || 'LOG', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/40' };
};

const formatDate = (ts) => {
  if (!ts) return '—';
  return formatDateOnly(ts);
};

const formatTime = (ts) => {
  if (!ts) return '—';
  return formatTimeOnly(ts);
};

const formatDuration = (startTs, endTs) => {
  if (!startTs || !endTs) return null;
  const diffMs = new Date(endTs) - new Date(startTs);
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return `${hrs}h ${rem}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
};

const OrderTrack = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleTrack = async () => {
    if (!orderNumber.trim()) { setError('Please enter an order number'); return; }
    setLoading(true); setError(''); setOrder(null); setTimeline([]);
    try {
      const res = await api.get(`/api/orders/track/${orderNumber.trim().replace(/^#/, '')}`);
      setOrder(res.data);
      setTimelineLoading(true);
      try {
        const tlRes = await api.get(`/api/orders/${res.data.id}/timeline`);
        setTimeline(tlRes.data?.flatEntries || tlRes.data || []);
      } catch { } finally { setTimelineLoading(false); }
    } catch (e) {
      setError(e.response?.status === 404 ? 'Order not found' : 'Error fetching order');
    } finally { setLoading(false); }
  };

  const completedStages = new Set(order?.stages?.filter(s => s.status === 'COMPLETED').map(s => s.stageName) || []);
  const trackingStatus = order?.trackingStatus || order?.currentStage;
  const isReturnedFromVerification = trackingStatus === 'RETURNED_FROM_VERIFICATION';
  const isInVerification = trackingStatus === 'VERIFICATION';
  const activeStage = isReturnedFromVerification ? 'ORDER_ENTRY' : trackingStatus;

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
          <ArrowLeft size={16} className="text-gray-400" />
        </button>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Order Tracking</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Complete order lifecycle timeline</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTrack()}
          placeholder="Enter order number (e.g., JT-836194)..."
          className="flex-1 bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 transition-colors" />
        <button onClick={handleTrack} disabled={loading}
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} Track
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      {order && (
        <div className="space-y-4">
          {/* Order Info */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-lg font-black text-white">#{order.orderNumber}</p>
                {order.editedByAdmin && (
                  <span className="inline-block bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mt-1">✏️ ADMIN EDITED ORDER</span>
                )}
                <p className="text-xs text-gray-400 font-bold">{order.customerName}{order.customerPhone ? ` — ${order.customerPhone}` : ''}</p>
                {order.createdBy && <p className="text-[10px] text-gray-500 font-bold mt-0.5">Created by: {order.createdBy.name}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${order.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' : order.status === 'HOLD' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {order.status === 'COMPLETED' ? 'COMPLETED' : order.status === 'CANCELLED' ? 'CANCELLED' : order.status === 'HOLD' ? 'ON HOLD' : 'IN PROGRESS'}
                </span>
                {order.paymentStatus && (
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {order.paymentStatus}
                  </span>
                )}
                {order.goForVerification && (
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${order.verifiedAt ? 'bg-cyan-500/20 text-cyan-400' : order.verificationReturnedAt ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {order.verifiedAt ? `VERIFIED by ${order.verifiedByName || 'Admin'}` : order.verificationReturnedAt ? 'RETURNED FROM VERIFICATION' : 'PENDING VERIFICATION'}
                  </span>
                )}
                {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                  <button onClick={() => { setCancelModal(true); setCancelReason(''); }}
                    className="flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 transition-colors">
                    <PackageX size={10} /> Request Cancellation
                  </button>
                )}
                {order.cancelledAt && (
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-red-700/40 text-red-300">CANCELLED — {order.cancelledByName || 'Admin'} {order.cancelledAt ? `(${formatDate(order.cancelledAt)})` : ''}</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Current Stage</p>
                <p className={`font-black mt-0.5 ${isReturnedFromVerification ? 'text-red-400' : isInVerification ? 'text-yellow-400' : 'text-white'}`}>
                  {STAGE_LABELS[trackingStatus] || trackingStatus}
                </p>
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
              {order.goForVerification && order.verifiedAt && (
                <>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Advance Collected</p>
                    <p className="text-emerald-400 font-black mt-0.5">₨{(order.verifiedAdvanceAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-2">
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Remaining Balance</p>
                    <p className="text-orange-400 font-black mt-0.5">₨{(order.verifiedRemainingBalance || 0).toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Returned from Verification banner */}
          {isReturnedFromVerification && (
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">Returned from Verification</p>
                <p className="text-xs text-gray-300 font-bold mt-1">
                  This order was returned for corrections and is back at Order Entry, awaiting edits before re-submission.
                </p>
                {order.verificationReturnNote && (
                  <p className="text-xs text-red-300 font-bold mt-1 italic">Reason: {order.verificationReturnNote}</p>
                )}
                {order.verificationReturnedAt && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1">
                    Returned on {formatDate(order.verificationReturnedAt)} at {formatTime(order.verificationReturnedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stage Pipeline */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Stage Pipeline</p>
            <div className="flex flex-wrap gap-1 items-center">
              {STAGE_ORDER.map((stage, idx) => {
                const completed = completedStages.has(stage);
                const active = activeStage === stage && order.status !== 'COMPLETED';
                const returnedChip = isReturnedFromVerification && stage === 'VERIFICATION';
                const Icon = STAGE_ICONS[stage] || Package;
                return (
                  <React.Fragment key={stage}>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black transition-all ${completed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : active ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse' : returnedChip ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-gray-800/40 text-gray-600'}`}>
                      <Icon size={10} />
                      {STAGE_LABELS[stage]}{returnedChip ? ' (Returned)' : ''}
                    </div>
                    {idx < STAGE_ORDER.length - 1 && <ArrowRight size={10} className="text-gray-700 mx-0.5 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Complete Timeline */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Full Lifecycle Timeline</p>
                <p className="text-[10px] text-gray-600 font-bold mt-0.5">Complete audit trail — every stage, accepted &amp; completed, in order</p>
              </div>
              {timelineLoading && <RefreshCcw size={12} className="text-purple-400 animate-spin" />}
            </div>

            {timeline.length === 0 && !timelineLoading ? (
              <p className="text-xs text-gray-500 font-bold text-center py-4">No timeline data available</p>
            ) : (
              <div className="relative">
                {timeline.map((entry, idx) => {
                  const colors = getEntryColors(entry);
                  const isLast = idx === timeline.length - 1;
                  const badge = getStatusBadge(entry);
                  const dt = formatDate(entry.timestamp);
                  const tm = formatTime(entry.timestamp);
                  const department = STAGE_DEPARTMENTS[entry.stage] || (entry.stage ? STAGE_LABELS[entry.stage] : null);
                  const latest = entry.isLatest || isLast;
                  return (
                    <div key={entry.id || idx} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-3 h-3 rounded-full ${colors.dot} mt-2 shadow-lg ${latest ? 'ring-4 ring-white/10' : ''}`} />
                        {!isLast && <div className={`w-0.5 flex-1 border-l-2 border-dashed min-h-[16px] opacity-30 ${colors.border}`} />}
                      </div>
                      <div className={`flex-1 border-l-2 ${colors.border} ${colors.bg} rounded-r-xl p-3 mb-2 ${latest ? 'ring-1 ring-white/10 shadow-lg' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded border ${colors.badge}`}>
                                {entry.label}
                              </span>
                              {latest && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">● Latest</span>
                              )}
                            </div>
                            {/* Workflow stage + department */}
                            {(entry.stageLabel || entry.stage) && (
                              <p className="text-[10px] font-black text-gray-300 mt-1.5 uppercase tracking-wider">
                                {entry.stageLabel || STAGE_LABELS[entry.stage] || entry.stage}
                                {department && <span className="text-gray-500 font-bold normal-case tracking-normal"> · {department}</span>}
                              </p>
                            )}
                            {/* Responsible user */}
                            {entry.actor && (
                              <p className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-gray-800/80 px-2 py-0.5 rounded-full mt-1.5">
                                <User size={9} /> {entry.actor}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${badge.cls}`}>{badge.text}</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-white">
                              <Calendar size={10} className="text-gray-500" /> {dt}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-gray-400">
                              <Clock size={10} className="text-gray-600" /> {tm}
                            </span>
                          </div>
                        </div>
                        {entry.details && <p className="text-[10px] text-gray-400 font-bold mt-1.5 italic">{entry.details}</p>}
                        {entry.remarks && entry.details !== entry.remarks && <p className="text-[10px] text-gray-400 font-bold mt-1 italic">Remarks: {entry.remarks}</p>}
                        {entry.returnReason && <p className="text-[10px] text-red-400 font-bold mt-1">Return reason: {entry.returnReason}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Request Modal */}
      {cancelModal && order && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setCancelModal(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-400" />
              <h3 className="text-lg font-black text-white">Request Cancellation</h3>
            </div>
            <p className="text-sm text-gray-400">Order: <span className="text-white font-black">#{order.orderNumber}</span></p>
            <p className="text-xs text-gray-500">This will submit a cancellation request to the Admin for approval. The order stays active until approved.</p>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Reason for Cancellation *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={4} placeholder="e.g. Customer no longer wants this order..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-black py-3 rounded-xl text-sm transition-all">Keep Order</button>
              <button
                disabled={cancelSubmitting || !cancelReason.trim()}
                onClick={async () => {
                  setCancelSubmitting(true);
                  try {
                    await api.put(`/api/orders/${order.id}/cancel`, { reason: cancelReason });
                    toast.success('Cancellation request sent to Admin for approval');
                    setCancelModal(false);
                    setCancelReason('');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Cancellation request failed');
                  } finally {
                    setCancelSubmitting(false);
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {cancelSubmitting ? 'Sending...' : <><AlertCircle size={16} /> Request Cancellation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTrack;
