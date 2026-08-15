import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, Loader2, MapPin, RefreshCw, PackageSearch, User, Phone, Hash, FileText, Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, Hourglass, Map, Info, Mail } from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';

const LOCATION_STYLES = {
  unseen: { label: 'Unseen — New Task', cls: 'bg-blue-600/20 border-blue-600/50 text-blue-300' },
  seen: { label: 'Seen / Accepted', cls: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-300' },
  active: { label: 'Active Task', cls: 'bg-violet-600/20 border-violet-600/50 text-violet-300' },
  completed: { label: 'Completed', cls: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-300' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-600/20 border-red-600/50 text-red-300' },
  rejected: { label: 'Rejected', cls: 'bg-amber-600/20 border-amber-600/50 text-amber-300' },
  verification: { label: 'Verification', cls: 'bg-indigo-600/20 border-indigo-600/50 text-indigo-300' },
  returned: { label: 'Returned to Faisal', cls: 'bg-rose-600/20 border-rose-600/50 text-rose-300' },
  stuck: { label: 'Stuck / Needs Review', cls: 'bg-orange-600/20 border-orange-600/50 text-orange-300' },
};

const TYPE_ICON = { stage: 'fa fa-layer-group', route: 'fa fa-arrow-right', audit: 'fa fa-scroll' };

function OrderTrackPanel() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return toast.error('Enter an order number, invoice number, or customer name.');
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(`/api/order-control/locate/${encodeURIComponent(q)}`);
      setData(res.data);
      if (!res.data.order) toast.error(res.data.message || 'Order not found.');
    } catch (err) {
      setData(null);
      toast.error(err?.response?.data?.message || err.message || 'Failed to locate order.');
    } finally {
      setLoading(false);
    }
  };

  const loc = data?.location;
  const locStyle = (loc && LOCATION_STYLES[loc.bucket]) || null;

  return (
    <div className="space-y-5">
      {/* Search card */}
      <div className="glass rounded-2xl border-2 border-gray-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <MapPin className="text-blue-400" /> Order Tracking — Exact Queue Location
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Locate any order (order #, invoice #, or customer name) and see exactly which profile queue it sits in
              right now — unseen task, seen/accepted, in-progress, stuck, returned, or final.
            </p>
          </div>
          <button onClick={() => { setData(null); setSearched(false); setQuery(''); }}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
            <RefreshCw size={15} /> Reset
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Order # (e.g. 49502) / Invoice # / Customer name"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-white focus:border-blue-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <PackageSearch size={16} />} Locate
          </button>
        </form>
      </div>

      {/* Result area */}
      {loading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={34} /></div>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Order Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="text-gray-500" size={15} />
                  <span className="text-gray-400">Order #</span>
                  <span className="ml-auto font-black text-white">{data.order.orderNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="text-gray-500" size={15} />
                  <span className="text-gray-400">Invoice #</span>
                  <span className="ml-auto font-bold text-white">{data.order.invoiceNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="text-gray-500" size={15} />
                  <span className="text-gray-400">Customer</span>
                  <span className="ml-auto font-bold text-white">{data.order.customerName || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="text-gray-500" size={15} />
                  <span className="text-gray-400">Phone</span>
                  <span className="ml-auto font-bold text-white">{data.order.customerPhone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="text-gray-500" size={15} />
                  <span className="text-gray-400">Created By</span>
                  <span className="ml-auto font-bold text-white">{data.order.createdBy?.name || '—'}</span>
                </div>
              </div>
            </div>

            {/* Location card */}
            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Current Location</h3>
              {locStyle ? (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black border ${locStyle.cls}`}>
                  <MapPin size={15} /> {locStyle.label}
                </div>
              ) : (
                <span className="text-sm font-bold text-gray-400">{loc?.label || 'Unknown'}</span>
              )}
              <p className="text-sm text-gray-300 mt-3">{loc?.description}</p>
              {loc?.queueLabel && (
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Queue</span>
                    <span className="ml-auto font-bold text-white">{loc.queueLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Profile</span>
                    <span className="ml-auto font-bold text-white">{loc.profile || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Current Stage</span>
                    <span className="ml-auto font-bold text-white">{loc.activeStage || data.order.currentStage || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Seen Count</span>
                    <span className="ml-auto font-bold text-white">{loc.seenCount ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Last activity + valid destinations */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Last Activity</h3>
              {data.lastActivity ? (
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">{data.lastActivity.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${data.lastActivity.type === 'route' ? 'bg-blue-600/20 border-blue-600/50 text-blue-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                      {data.lastActivity.type}
                    </span>
                  </div>
                  {data.lastActivity.remarks && <p className="text-gray-400 mt-1 text-xs">{data.lastActivity.remarks}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    <Calendar size={13} /> {formatDateTime(data.lastActivity.timestamp)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <User size={13} /> {data.lastActivity.actor || '—'}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No activity recorded yet.</p>
              )}
            </div>

            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Valid Routing Destinations</h3>
              {data.destStages?.length ? (
                <div className="flex flex-wrap gap-2">
                  {data.destStages.map(d => (
                    <span key={d.value} className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-gray-800 border-gray-600 text-gray-300">
                      {d.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No further routing applies (final state).</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-4">Order Timeline</h3>
            {data.timeline?.length ? (
              <div className="space-y-0">
                {data.timeline.map((ev, i) => (
                  <div key={i} className="relative flex gap-3 pb-4">
                    {i < data.timeline.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-gray-700" />}
                    <div className={`w-[15px] h-[15px] mt-1 rounded-full border-2 shrink-0 ${ev.type === 'route' ? 'bg-blue-500 border-blue-300' : ev.type === 'stage' ? 'bg-emerald-500 border-emerald-300' : 'bg-gray-600 border-gray-500'}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-white">{ev.label}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-black">{ev.type}</span>
                      </div>
                      {ev.remarks && <p className="text-xs text-gray-400 mt-0.5">{ev.remarks}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDateTime(ev.timestamp)}</span>
                        {ev.actor && <span className="flex items-center gap-1"><User size={11} /> {ev.actor}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No timeline available.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default OrderTrackPanel;
