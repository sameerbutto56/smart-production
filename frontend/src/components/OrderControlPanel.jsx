import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, Loader2, Navigation, AlertTriangle, CheckCircle2, RefreshCw, MapPin, ShieldAlert, ArrowRight, User, Hash, FileText, Clock, Info } from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';
import { useAuth } from '../context/AuthContext';

function OrderControlPanel() {
  const { user } = useAuth();
  const canReroute = user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [destStage, setDestStage] = useState('');
  const [reason, setReason] = useState('');
  const [rerouting, setRerouting] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return toast.error('Enter an order number, invoice number, or customer name.');
    setLoading(true);
    setSearched(true);
    setResult(null);
    try {
      const res = await api.get(`/api/order-control/locate/${encodeURIComponent(q)}`);
      setData(res.data);
      if (res.data.order) {
        setDestStage(res.data.destStages?.[0]?.value || '');
      } else {
        setDestStage('');
        toast.error(res.data.message || 'Order not found.');
      }
    } catch (err) {
      setData(null);
      setDestStage('');
      toast.error(err?.response?.data?.message || err.message || 'Failed to locate order.');
    } finally {
      setLoading(false);
    }
  };

  const handleReroute = async () => {
    if (!data?.order) return;
    if (!destStage) return toast.error('Select a destination stage.');
    if (!reason.trim()) return toast.error('A reason is required for the re-route (recorded in the audit trail).');
    setRerouting(true);
    setResult(null);
    try {
      const res = await api.post(`/api/order-control/${data.order.id}/reroute`, {
        destinationStage: destStage,
        reason: reason.trim(),
      });
      setResult(res.data);
      toast.success(res.data.message || 'Order re-routed successfully.');
      // Refresh location view
      try {
        const loc = await api.get(`/api/order-control/locate/${encodeURIComponent(query.trim())}`);
        setData(loc.data);
      } catch (_) { /* keep pre-reroute view */ }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to re-route order.');
    } finally {
      setRerouting(false);
    }
  };

  const loc = data?.location;

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="glass rounded-2xl border-2 border-gray-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Navigation className="text-amber-400" /> Order Control — Manual Re-Route
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Manually move a stuck or mis-routed order to the correct stage in one atomic transaction
              (stage completion, destination creation, seen-task reset, routing history, audit log, notification).
            </p>
          </div>
          <button onClick={() => { setData(null); setSearched(false); setQuery(''); setDestStage(''); setReason(''); setResult(null); }}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
            <RefreshCw size={15} /> Reset
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Order # (e.g. 49502) / Invoice # / Customer name"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-white focus:border-amber-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Find Order
          </button>
        </form>
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-amber-500" size={34} /></div>}

      {!loading && searched && !data?.order && (
        <div className="glass rounded-2xl border-2 border-red-700/50 py-14 text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={40} />
          <p className="text-white font-bold">{data?.message || 'Order not found.'}</p>
        </div>
      )}

      {!loading && data?.order && (
        <>
          {result?.nextStage && (
            <div className="glass rounded-2xl border-2 border-emerald-600/60 p-4 flex items-start gap-3">
              <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-white font-black">{result.message}</p>
                <p className="text-xs text-gray-300 mt-1">
                  Next stage: <span className="font-black text-emerald-300">{result.nextStage}</span>
                  {loc?.queueLabel ? <> · Now in: <span className="font-black text-emerald-300">{loc.queueLabel}</span></> : null}
                </p>
              </div>
            </div>
          )}

          {/* Order summary */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Order</h3>
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
                  <Info className="text-gray-500" size={15} />
                  <span className="text-gray-400">Source / Type</span>
                  <span className="ml-auto font-bold text-white">{data.order.source || '—'} · {data.order.type || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="text-gray-500" size={15} />
                  <span className="text-gray-400">Current Stage</span>
                  <span className="ml-auto font-bold text-white">{data.order.currentStage || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-gray-500" size={15} />
                  <span className="text-gray-400">Status</span>
                  <span className="ml-auto font-bold text-white">{data.order.status || '—'}</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl border-2 border-gray-700 p-5">
              <h3 className="text-sm font-black text-gray-300 uppercase tracking-wide mb-3">Current Location</h3>
              <p className="text-sm text-gray-300">{loc?.description || '—'}</p>
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
                    <span className="text-gray-400">Seen Count</span>
                    <span className="ml-auto font-bold text-white">{loc.seenCount ?? 0}</span>
                  </div>
                </div>
              )}
              {data.lastActivity && (
                <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400">
                  <span className="text-gray-500 font-bold uppercase">Last:</span> {data.lastActivity.label} · {formatDateTime(data.lastActivity.timestamp)}
                </div>
              )}
            </div>
          </div>

          {/* Re-route form */}
          <div className="glass rounded-2xl border-2 border-amber-600/40 p-5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="text-amber-400" size={18} />
              <h3 className="text-lg font-black text-white">Manual Re-Route</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Only <span className="font-bold text-amber-300">Super Admin / Admin</span> can re-route. The order is
              completed at its current stage, a new <span className="font-bold">PENDING</span> stage is created for the
              destination, the destination profile's seen-tasks are reset (it lands unseen), routing history + audit log are
              written, and the destination profile is notified. Production-bound routes from Store / Logo always land in
              <span className="font-bold text-amber-300"> PRODUCTION_ACCEPTANCE</span>.
            </p>

            {!canReroute && (
              <div className="bg-red-600/15 border border-red-700/60 rounded-xl p-3 text-sm text-red-300 font-bold">
                Your profile cannot re-route orders. Ask a Super Admin or Admin.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Destination Stage</label>
                <select value={destStage} onChange={e => setDestStage(e.target.value)} disabled={!canReroute}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-amber-500 outline-none disabled:opacity-50">
                  <option value="">Select destination…</option>
                  {(data.destStages || []).map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Reason (required — written to the audit trail)
                </label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} disabled={!canReroute} rows={3}
                  placeholder="e.g. Order was mis-routed to Store; correcting to Production Acceptance."
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-amber-500 outline-none disabled:opacity-50 resize-none" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <Info size={13} /> Terminal orders (cancelled / completed / rejected) cannot be re-routed.
              </p>
              <button onClick={handleReroute} disabled={!canReroute || rerouting}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-black px-5 py-2.5 rounded-xl text-sm disabled:opacity-40">
                {rerouting ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} Re-Route Order
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default OrderControlPanel;
