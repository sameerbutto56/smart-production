import React, { useState } from 'react';
import api from '../services/api';
import { Search, ArrowLeft, RefreshCcw, User, Calendar, Clock, Package, ArrowRight, CheckCircle2, Play, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive', DELIVERED: 'Delivered'
};

const STAGE_ORDER = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const formatDateTime = (ts) => {
  if (!ts) return { date: '—', time: '—' };
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  };
};

const getEntryStyle = (action) => {
  switch (action) {
    case 'COMPLETED': return 'border-emerald-500 bg-emerald-500/10';
    case 'ACCEPTED': return 'border-blue-500 bg-blue-500/10';
    case 'ROUTED': return 'border-purple-500 bg-purple-500/10';
    case 'RECEIVED': return 'border-amber-500 bg-amber-500/10';
    default: return 'border-gray-600 bg-gray-600/10';
  }
};

const getDotColor = (action) => {
  switch (action) {
    case 'COMPLETED': return 'bg-emerald-500';
    case 'ACCEPTED': return 'bg-blue-500';
    case 'ROUTED': return 'bg-purple-500';
    case 'RECEIVED': return 'bg-amber-500';
    default: return 'bg-gray-500';
  }
};

const OrderTrack = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState('');
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
        setTimeline(tlRes.data || []);
      } catch { } finally { setTimelineLoading(false); }
    } catch (e) {
      setError(e.response?.status === 404 ? 'Order not found' : 'Error fetching order');
    } finally { setLoading(false); }
  };

  const currentStageIdx = STAGE_ORDER.indexOf(order?.currentStage);

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
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2">
                <p className="text-gray-500 font-bold uppercase text-[10px]">Current Stage</p>
                <p className="text-white font-black mt-0.5">{STAGE_LABELS[order.currentStage] || order.currentStage}</p>
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

          {/* Stage Pipeline */}
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Stage Pipeline</p>
            <div className="flex flex-wrap gap-1">
              {STAGE_ORDER.map((stage, idx) => {
                const completed = order.stages?.some(s => s.stageName === stage && s.status === 'COMPLETED');
                const active = order.currentStage === stage;
                return (
                  <React.Fragment key={stage}>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${completed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : active ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse' : 'bg-gray-800/40 text-gray-600'}`}>
                      {STAGE_LABELS[stage]}
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
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Complete Timeline</p>
              {timelineLoading && <RefreshCcw size={12} className="text-purple-400 animate-spin" />}
            </div>

            {timeline.length === 0 && !timelineLoading ? (
              <p className="text-xs text-gray-500 font-bold text-center py-4">No timeline data available</p>
            ) : (
              <div className="relative">
                {timeline.map((entry, idx) => {
                  const dt = formatDateTime(entry.timestamp);
                  const dotColor = getDotColor(entry.action);
                  const borderCol = getEntryStyle(entry.action);
                  const isLast = idx === timeline.length - 1;
                  return (
                    <div key={entry.id || idx} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-3 h-3 rounded-full ${dotColor} mt-1.5 shadow-lg`} />
                        {!isLast && <div className="w-0.5 flex-1 bg-gray-800 min-h-[20px]" />}
                      </div>
                      <div className={`flex-1 border-l-2 ${borderCol} rounded-r-lg p-2.5 mb-2`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded ${borderCol}`}>
                              {entry.label}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {entry.actor && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-gray-800/80 px-2 py-0.5 rounded-full">
                                  <User size={9} /> {entry.actor}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                <Calendar size={9} /> {dt.date}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                <Clock size={9} /> {dt.time}
                              </span>
                            </div>
                            {entry.details && <p className="text-[10px] text-gray-400 font-bold mt-1 italic">{entry.details}</p>}
                            {entry.remarks && <p className="text-[10px] text-gray-400 font-bold mt-1 italic">Remarks: {entry.remarks}</p>}
                            {entry.returnReason && <p className="text-[10px] text-red-400 font-bold mt-1">Return reason: {entry.returnReason}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTrack;
