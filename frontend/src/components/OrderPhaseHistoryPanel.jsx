import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, Loader2, History, RefreshCw, PackageSearch, User, Phone, Hash, FileText, Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight, MapPin, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';

const PHASE_COLORS = {
  ORDER_ENTRY: { bg: 'bg-blue-600/20', border: 'border-blue-600/50', text: 'text-blue-300', dot: 'bg-blue-500' },
  STORE: { bg: 'bg-amber-600/20', border: 'border-amber-600/50', text: 'text-amber-300', dot: 'bg-amber-500' },
  LOGO_DESIGN: { bg: 'bg-purple-600/20', border: 'border-purple-600/50', text: 'text-purple-300', dot: 'bg-purple-500' },
  PRODUCTION_ACCEPTANCE: { bg: 'bg-teal-600/20', border: 'border-teal-600/50', text: 'text-teal-300', dot: 'bg-teal-500' },
  PRODUCTION: { bg: 'bg-orange-600/20', border: 'border-orange-600/50', text: 'text-orange-300', dot: 'bg-orange-500' },
  STORE_RECEIVE: { bg: 'bg-amber-600/20', border: 'border-amber-600/50', text: 'text-amber-300', dot: 'bg-amber-500' },
  DISPATCH: { bg: 'bg-indigo-600/20', border: 'border-indigo-600/50', text: 'text-indigo-300', dot: 'bg-indigo-500' },
  OUT_FOR_DELIVERY: { bg: 'bg-emerald-600/20', border: 'border-emerald-600/50', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  OUTLET_RECEIVE: { bg: 'bg-cyan-600/20', border: 'border-cyan-600/50', text: 'text-cyan-300', dot: 'bg-cyan-500' },
  IN_DISPATCH: { bg: 'bg-violet-600/20', border: 'border-violet-600/50', text: 'text-violet-300', dot: 'bg-violet-500' },
  ENAMELS_DELIVERY: { bg: 'bg-emerald-600/20', border: 'border-emerald-600/50', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  VERIFICATION: { bg: 'bg-indigo-600/20', border: 'border-indigo-600/50', text: 'text-indigo-300', dot: 'bg-indigo-500' },
  CANCELLED: { bg: 'bg-red-600/20', border: 'border-red-600/50', text: 'text-red-300', dot: 'bg-red-500' },
  DELIVERED: { bg: 'bg-emerald-600/20', border: 'border-emerald-600/50', text: 'text-emerald-300', dot: 'bg-emerald-500' },
  System: { bg: 'bg-gray-600/20', border: 'border-gray-600/50', text: 'text-gray-300', dot: 'bg-gray-500' },
};

const EVENT_TYPE_STYLES = {
  phase_start: { icon: <ChevronDown size={13} />, label: 'CREATED', cls: 'bg-blue-600/20 border-blue-600/50 text-blue-300' },
  phase_accepted: { icon: <CheckCircle2 size={13} />, label: 'ACCEPTED', cls: 'bg-teal-600/20 border-teal-600/50 text-teal-300' },
  phase_complete: { icon: <CheckCircle2 size={13} />, label: 'COMPLETED', cls: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-300' },
  phase_rejected: { icon: <XCircle size={13} />, label: 'REJECTED', cls: 'bg-red-600/20 border-red-600/50 text-red-300' },
  route: { icon: <ArrowRight size={13} />, label: 'ROUTED', cls: 'bg-violet-600/20 border-violet-600/50 text-violet-300' },
  audit: { icon: <FileText size={13} />, label: 'LOG', cls: 'bg-gray-600/20 border-gray-600/50 text-gray-300' },
  verification: { icon: <CheckCircle2 size={13} />, label: 'VERIFIED', cls: 'bg-indigo-600/20 border-indigo-600/50 text-indigo-300' },
  verification_return: { icon: <AlertTriangle size={13} />, label: 'RETURNED', cls: 'bg-amber-600/20 border-amber-600/50 text-amber-300' },
  cancellation: { icon: <XCircle size={13} />, label: 'CANCELLED', cls: 'bg-red-600/20 border-red-600/50 text-red-300' },
  delivered: { icon: <CheckCircle2 size={13} />, label: 'DELIVERED', cls: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-300' },
};

function OrderPhaseHistoryPanel() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState('ALL');
  const [expandedPhases, setExpandedPhases] = useState(new Set());
  const [showAllEvents, setShowAllEvents] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return toast.error('Enter an order number, invoice number, or customer name.');
    setLoading(true);
    setSearched(true);
    setShowAllEvents(false);
    setPhaseFilter('ALL');
    try {
      const res = await api.get(`/api/order-control/phase-history/${encodeURIComponent(q)}`);
      setData(res.data);
      if (!res.data.order) toast.error(res.data.message || 'Order not found.');
    } catch (err) {
      setData(null);
      toast.error(err?.response?.data?.message || err.message || 'Failed to load phase history.');
    } finally {
      setLoading(false);
    }
  };

  const togglePhase = (phaseName) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseName)) next.delete(phaseName);
      else next.add(phaseName);
      return next;
    });
  };

  const o = data?.order;
  const phases = data?.phaseSummary || [];
  const timeline = data?.timeline || [];
  const stats = data?.stats || {};

  // Filter timeline by phase.
  const filteredTimeline = phaseFilter === 'ALL' ? timeline : timeline.filter(e => e.phase === phaseFilter);
  const visibleTimeline = showAllEvents ? filteredTimeline : filteredTimeline.slice(0, 50);

  // Get unique phases from timeline.
  const uniquePhases = [...new Set(timeline.map(e => e.phase).filter(Boolean))];

  // Duration formatting.
  const fmtDuration = (ms) => {
    if (!ms) return '—';
    const hours = ms / 3600000;
    if (hours < 1) return `${Math.round(ms / 60000)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`;
  };

  return (
    <div className="space-y-5">
      {/* Search card */}
      <div className="glass rounded-2xl border-2 border-gray-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <History className="text-purple-400" /> Order Phase History
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Search any order to see its complete chronological timeline — every phase it passed through, timestamps, users, and routes.
            </p>
          </div>
          <button onClick={() => { setData(null); setSearched(false); setQuery(''); setPhaseFilter('ALL'); setShowAllEvents(false); }}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
            <RefreshCw size={15} /> Reset
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Order # (e.g. 49502) / Invoice # / Customer name"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-white focus:border-purple-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <PackageSearch size={16} />} Search
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-purple-500" size={34} /></div>
      )}

      {!loading && searched && !data?.order && (
        <div className="glass rounded-2xl border-2 border-red-700/50 py-14 text-center">
          <XCircle className="mx-auto text-red-400 mb-3" size={40} />
          <p className="text-white font-bold">{data?.message || 'Order not found.'}</p>
          <p className="text-sm text-gray-400 mt-1">Try the exact order number, invoice number, or a customer name.</p>
        </div>
      )}

      {!loading && data?.order && (
        <>
          {/* Order summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Order Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="text-gray-500" size={15} />
                  <span className="text-gray-400">Order #</span>
                  <span className="ml-auto font-black text-white">{o.orderNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="text-gray-500" size={15} />
                  <span className="text-gray-400">Invoice #</span>
                  <span className="ml-auto font-bold text-white">{o.invoiceNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="text-gray-500" size={15} />
                  <span className="text-gray-400">Customer</span>
                  <span className="ml-auto font-bold text-white">{o.customerName || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="text-gray-500" size={15} />
                  <span className="text-gray-400">Phone</span>
                  <span className="ml-auto font-bold text-white">{o.customerPhone || '—'}</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Current Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="text-gray-500" size={15} />
                  <span className="text-gray-400">Stage</span>
                  <span className="ml-auto font-black text-white">{o.currentStage || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-gray-500" size={15} />
                  <span className="text-gray-400">Status</span>
                  <span className={`ml-auto font-black px-2 py-0.5 rounded text-[11px] uppercase ${
                    o.status === 'COMPLETED' || o.status === 'DELIVERED' ? 'bg-emerald-600/20 text-emerald-300' :
                    o.status === 'CANCELLED' || o.status === 'REJECTED' ? 'bg-red-600/20 text-red-300' :
                    'bg-blue-600/20 text-blue-300'
                  }`}>{o.status || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-gray-500" size={15} />
                  <span className="text-gray-400">Source</span>
                  <span className="ml-auto font-bold text-white">{o.source || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="text-gray-500" size={15} />
                  <span className="text-gray-400">Type</span>
                  <span className="ml-auto font-bold text-white">{o.type || '—'}</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Timeline Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="text-gray-500" size={15} />
                  <span className="text-gray-400">Total Phases</span>
                  <span className="ml-auto font-black text-white">{stats.totalPhases || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="text-gray-500" size={15} />
                  <span className="text-gray-400">Total Events</span>
                  <span className="ml-auto font-black text-white">{stats.totalEvents || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="text-gray-500" size={15} />
                  <span className="text-gray-400">Routing Events</span>
                  <span className="ml-auto font-black text-white">{stats.totalRoutingEvents || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="text-gray-500" size={15} />
                  <span className="text-gray-400">Duration</span>
                  <span className="ml-auto font-black text-white">{fmtDuration(stats.durationMs)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Phase Summary Grid */}
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-4">Phases Passed Through</h3>
            {phases.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {phases.map((ph, i) => {
                  const colors = PHASE_COLORS[ph.name] || PHASE_COLORS.System;
                  const isActive = ph.name === o.currentStage;
                  return (
                    <div key={i}
                      className={`${colors.bg} ${colors.border} border rounded-xl p-3 cursor-pointer hover:opacity-80 transition-opacity ${isActive ? 'ring-2 ring-white/30' : ''}`}
                      onClick={() => { setPhaseFilter(phaseFilter === ph.name ? 'ALL' : ph.name); }}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${colors.dot} ${isActive ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs font-black ${colors.text} uppercase`}>{ph.label}</span>
                        {isActive && <span className="ml-auto text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded text-white">CURRENT</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 space-y-0.5">
                        <div>Entered: {formatDateTime(ph.enteredAt)}</div>
                        {ph.acceptedAt && <div>Accepted: {formatDateTime(ph.acceptedAt)}</div>}
                        {ph.completedAt && <div>Completed: {formatDateTime(ph.completedAt)}</div>}
                        <div className={`font-bold uppercase ${
                          ph.status === 'COMPLETED' ? 'text-emerald-400' :
                          ph.status === 'IN_PROGRESS' ? 'text-blue-400' :
                          ph.status === 'RETURNED' ? 'text-amber-400' :
                          ph.status === 'REJECTED' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>{ph.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No phase data available.</p>
            )}
          </div>

          {/* Phase filter chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPhaseFilter('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                phaseFilter === 'ALL' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}>
              <Filter size={12} /> All Events ({timeline.length})
            </button>
            {uniquePhases.map(phase => {
              const count = timeline.filter(e => e.phase === phase).length;
              const colors = PHASE_COLORS[phase] || PHASE_COLORS.System;
              return (
                <button key={phase}
                  onClick={() => setPhaseFilter(phaseFilter === phase ? 'ALL' : phase)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    phaseFilter === phase ? `${colors.bg} ${colors.border} ${colors.text}` : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}>
                  {phase} ({count})
                </button>
              );
            })}
          </div>

          {/* Full Timeline */}
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-4">
              Complete Timeline {phaseFilter !== 'ALL' && <span className="text-purple-400">— Filtered: {phaseFilter}</span>}
            </h3>
            {visibleTimeline.length > 0 ? (
              <div className="space-y-0">
                {visibleTimeline.map((ev, i) => {
                  const typeStyle = EVENT_TYPE_STYLES[ev.type] || EVENT_TYPE_STYLES.audit;
                  const phaseColors = PHASE_COLORS[ev.phase] || PHASE_COLORS.System;
                  return (
                    <div key={i} className="relative flex gap-3 pb-4">
                      {i < visibleTimeline.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-700" />}
                      <div className={`w-[15px] h-[15px] mt-1 rounded-full border-2 shrink-0 ${phaseColors.dot} border-white/30`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">{ev.label}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${typeStyle.cls}`}>
                            {typeStyle.label}
                          </span>
                          {ev.phase && ev.phase !== 'System' && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${phaseColors.bg} ${phaseColors.text}`}>
                              {ev.phaseLabel || ev.phase}
                            </span>
                          )}
                        </div>
                        {ev.details && <p className="text-xs text-gray-400 mt-0.5 max-w-lg">{ev.details}</p>}
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={11} /> {formatDateTime(ev.ts)}</span>
                          {ev.actor && <span className="flex items-center gap-1"><User size={11} /> {ev.actor}</span>}
                          {ev.from && ev.to && (
                            <span className="flex items-center gap-1">
                              <ArrowRight size={11} />
                              <span className="text-gray-500">{ev.from}</span>
                              <span className="text-gray-600">→</span>
                              <span className="text-violet-400 font-bold">{ev.to}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No events match the current filter.</p>
            )}

            {!showAllEvents && filteredTimeline.length > 50 && (
              <button onClick={() => setShowAllEvents(true)}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300 font-bold">
                Show all {filteredTimeline.length} events...
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default OrderPhaseHistoryPanel;
