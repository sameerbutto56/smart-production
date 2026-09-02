import React, { useState } from 'react';
import api from '../services/api';
import { Search, ArrowLeft, RefreshCcw, Package, ArrowRight, ArrowRightLeft, CheckCircle2, Truck, MapPin, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive', IN_DISPATCH: 'In Dispatch',
  VERIFICATION: 'Verification', RETURNED_FROM_VERIFICATION: 'Returned from Verification', DELIVERED: 'Delivered'
};

const STAGE_DEPARTMENTS = {
  ORDER_ENTRY: 'Order Entry', VERIFICATION: 'Verification', STORE: 'Store', STORE_RECEIVE: 'Store',
  WORKERS: 'Production', LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production', PRODUCTION: 'Production',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out of Delivery', OUTLET_RECEIVE: 'Outlet', IN_DISPATCH: 'In Dispatch',
  ENAMELS_DELIVERY: 'Delivery', DELIVERED: 'Completed'
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

const formatDate = (ts) => ts ? formatDateOnly(ts) : '—';
const formatTime = (ts) => ts ? formatTimeOnly(ts) : '—';

const StoreOrderTracker = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [linkedOriginal, setLinkedOriginal] = useState(null);
  const [linkedReplacement, setLinkedReplacement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const navigate = useNavigate();

  const loadOrder = async (query, resetLinked = true) => {
    if (!query || !String(query).trim()) { setError('Please enter an order number'); return; }
    const clean = String(query).trim();
    setLoading(true); setError('');
    setOrderNumber(clean);
    if (resetLinked) { setOrder(null); setTimeline([]); setLinkedOriginal(null); setLinkedReplacement(null); setSearchResults(null); }
    try {
      const res = await api.get(`/api/orders/track/${encodeURIComponent(clean)}`);
      if (res.data.multiple) {
        setSearchResults(res.data.results);
        setOrder(null); setTimeline([]);
        setLoading(false);
        return;
      }
      setSearchResults(null);
      setOrder(res.data);
      setLinkedOriginal(res.data._originalOrder || null);
      setLinkedReplacement(res.data._replacementOrder || null);
      setTimelineLoading(true);
      try {
        const tlRes = await api.get(`/api/orders/${res.data.id}/timeline`);
        setTimeline(tlRes.data?.flatEntries || tlRes.data || []);
      } catch { } finally { setTimelineLoading(false); }
    } catch (e) {
      setError(e.response?.status === 404 ? 'Order not found' : 'Error fetching order');
    } finally { setLoading(false); }
  };

  const handleTrack = () => {
    if (!orderNumber.trim()) { setError('Please enter an order number'); return; }
    loadOrder(orderNumber);
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
          <h1 className="text-lg font-black text-white tracking-tight">Order Tracker</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Search and track order status</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTrack()}
          placeholder="Order #, invoice #, customer name, or phone..."
          className="flex-1 bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 transition-colors" />
        <button onClick={handleTrack} disabled={loading}
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} Track
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      {searchResults && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
              <FileText size={12} className="inline mr-1" />
              {searchResults.length} order{searchResults.length !== 1 ? 's' : ''} found
            </p>
            <button onClick={() => { setSearchResults(null); setOrderNumber(''); }}
              className="text-[10px] font-bold text-gray-500 hover:text-gray-300 transition-colors">Clear</button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {searchResults.map((r) => (
              <button key={r.id} onClick={() => loadOrder(r.orderNumber)}
                className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-purple-500/50 rounded-xl p-3 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-white">#{r.orderNumber}</p>
                      {r.invoiceNumber && <span className="text-[10px] font-bold text-gray-500">{r.invoiceNumber}</span>}
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-bold mt-1">
                      {r.customerName}{r.customerPhone ? ` · ${r.customerPhone}` : ''}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                      {STAGE_LABELS[r.trackingStatus] || r.currentStage}
                      {r.totalPrice ? ` · Rs.${r.totalPrice.toLocaleString()}` : ''}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-gray-600 shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {order && (
        <div className="space-y-4">
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-lg font-black text-white">#{order.orderNumber}</p>
                {order.editedByAdmin && (
                  <span className="inline-block bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mt-1">ADMIN EDITED ORDER</span>
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
                {order.cancelledAt && (
                  <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-red-700/40 text-red-300">CANCELLED — {order.cancelledByName || 'Admin'}</span>
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
                <p className="text-emerald-400 font-black mt-0.5">Rs.{(order.totalPrice || 0).toLocaleString()}</p>
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

          {(linkedOriginal || linkedReplacement) && (
            <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/40 rounded-2xl border border-purple-500/30 p-4">
              <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <ArrowRightLeft size={12} /> Connected {order?.source === 'REPLACEMENT' ? 'Original Order' : 'Replacement Order'}
              </p>
              <div className="flex flex-wrap gap-2">
                {linkedReplacement && (
                  <button onClick={() => loadOrder(linkedReplacement.orderNumber, false)}
                    className="flex-1 min-w-[200px] text-left bg-gray-900/70 border border-purple-500/40 rounded-xl p-3 hover:border-purple-400 transition-colors">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Replacement Order</p>
                    <p className="text-sm font-black text-white mt-0.5">{linkedReplacement.orderNumber}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      {linkedReplacement.customerName} • {STAGE_LABELS[linkedReplacement.trackingStatus] || linkedReplacement.currentStage}
                      <span className="text-purple-400"> — View Timeline →</span>
                    </p>
                  </button>
                )}
                {linkedOriginal && (
                  <button onClick={() => loadOrder(linkedOriginal.orderNumber, false)}
                    className="flex-1 min-w-[200px] text-left bg-gray-900/70 border border-indigo-500/40 rounded-xl p-3 hover:border-indigo-400 transition-colors">
                    <p className="text-[10px] text-gray-400 font-black uppercase">Original Order</p>
                    <p className="text-sm font-black text-white mt-0.5">#{linkedOriginal.orderNumber}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                      {linkedOriginal.customerName} • {STAGE_LABELS[linkedOriginal.trackingStatus] || linkedOriginal.currentStage}
                      <span className="text-indigo-400"> — View Timeline →</span>
                    </p>
                  </button>
                )}
              </div>
            </div>
          )}

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

          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Full Lifecycle Timeline</p>
                <p className="text-[10px] text-gray-600 font-bold mt-0.5">Complete audit trail — every stage, accepted & completed, in order</p>
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
                                <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">Latest</span>
                              )}
                            </div>
                            {(entry.stageLabel || entry.stage) && (
                              <p className="text-[10px] text-gray-400 font-bold mt-1">
                                {entry.stageLabel || STAGE_LABELS[entry.stage] || entry.stage}
                                {department ? ` · ${department}` : ''}
                              </p>
                            )}
                            {entry.actor && (
                              <p className="text-[10px] text-gray-500 font-bold mt-0.5">{entry.actor}</p>
                            )}
                            {entry.details && (
                              <p className="text-[10px] text-gray-500 font-bold mt-0.5">{entry.details}</p>
                            )}
                            {entry.remarks && (
                              <p className="text-[10px] text-gray-500 italic mt-0.5">{entry.remarks}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.text}</span>
                            <p className="text-[10px] text-gray-500 font-bold mt-1">{dt}</p>
                            <p className="text-[10px] text-gray-500 font-bold">{tm}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {order.productDetails && (() => {
            let items = [];
            try {
              const parsed = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
              items = Array.isArray(parsed) ? parsed : [];
            } catch { return null; }
            if (items.length === 0) return null;
            return (
              <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Product Details</p>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const pd = item.productDetails || item;
                    return (
                      <div key={idx} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-black text-white">{pd.productName || pd.name || pd.productType || `Product ${idx + 1}`}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {pd.color && <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{pd.color}</span>}
                              {pd.size && <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{pd.size}</span>}
                              {pd.fabricType && <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{pd.fabricType}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-white">x{item.quantity || 1}</p>
                            {item.unitPrice > 0 && <p className="text-[10px] font-bold text-gray-400">Rs.{item.unitPrice.toLocaleString()}</p>}
                          </div>
                        </div>
                        {item.sizeData && typeof item.sizeData === 'object' && Object.keys(item.sizeData).length > 1 && (
                          <div className="mt-2 pt-2 border-t border-gray-700/50 grid grid-cols-3 gap-1">
                            {Object.entries(item.sizeData).filter(([k]) => k !== 'specialNote' && k !== '_standardSize').map(([field, val]) => (
                              val ? <div key={field} className="text-[10px]"><span className="text-gray-500">{field}:</span> <span className="text-gray-300 font-bold">{val}</span></div> : null
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {!order && !searchResults && !loading && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-8 text-center">
          <Search size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-black text-gray-500">Search for an order to track its progress</p>
          <p className="text-[10px] text-gray-600 font-bold mt-1">Enter order number, invoice number, customer name, or phone number</p>
        </div>
      )}
    </div>
  );
};

export default StoreOrderTracker;
