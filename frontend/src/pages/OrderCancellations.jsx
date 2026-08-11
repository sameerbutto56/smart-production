import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  ShieldAlert, RefreshCcw, CheckCircle2, XCircle, Clock, User, Search,
  ThumbsUp, ThumbsDown, PackageX, Phone, Hash, AlertTriangle, CalendarDays
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';

const STATUS_STYLES = {
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDateTime = (d) => {
  if (!d) return '—';
  return `${formatDate(d)} · ${formatTime(d)}`;
};

const OrderCancellations = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'cancelled'
  const [search, setSearch] = useState('');
  const [pendingList, setPendingList] = useState([]);
  const [cancelledList, setCancelledList] = useState([]);
  const [rejectedList, setRejectedList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const [pending, cancelled, rejected] = await Promise.all([
        api.get('/api/orders/cancellation-requests', { params: { ...params, status: 'PENDING' } }),
        api.get('/api/orders/cancellation-requests', { params: { ...params, status: 'APPROVED' } }),
        api.get('/api/orders/cancellation-requests', { params: { ...params, status: 'REJECTED' } })
      ]);
      setPendingList(pending.data.requests || []);
      setCancelledList(cancelled.data.requests || []);
      setRejectedList(rejected.data.requests || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load cancellation requests');
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const approve = async () => {
    if (!selected) return;
    if (!window.confirm(`Approve cancellation of order #${selected.orderNumber}? The order will be permanently cancelled, inventory restored, and the order number locked forever.`)) return;
    setDecisionLoading(true);
    try {
      const res = await api.post(`/api/orders/cancellation-requests/${selected.id}/approve`);
      toast.success(res.data.message || 'Cancellation approved');
      setSelected(null);
      setDecisionNote('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to approve cancellation');
    } finally { setDecisionLoading(false); }
  };

  const reject = async () => {
    if (!selected) return;
    if (!window.confirm(`Reject cancellation of order #${selected.orderNumber}? The order will remain active.`)) return;
    setDecisionLoading(true);
    try {
      const res = await api.post(`/api/orders/cancellation-requests/${selected.id}/reject`, { decisionNote: decisionNote || null });
      toast.success(res.data.message || 'Cancellation rejected');
      setSelected(null);
      setDecisionNote('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reject cancellation');
    } finally { setDecisionLoading(false); }
  };

  const counts = {
    PENDING: pendingList.length,
    APPROVED: cancelledList.length,
    REJECTED: rejectedList.length,
  };

  const displayedRequests = activeTab === 'pending' ? pendingList : cancelledList;

  if (loading && pendingList.length === 0 && cancelledList.length === 0) return <PageLoader />;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
              <span className="p-2 bg-red-500/20 rounded-xl text-red-500"><PackageX size={26} /></span>
              Order Cancellations
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1">Review cancellation requests. Approving permanently cancels the order and locks its number.</p>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-black uppercase text-xs tracking-widest">Pending Approval</span>
              <Clock size={20} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black mt-2 text-amber-300">{counts.PENDING}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 font-black uppercase text-xs tracking-widest">Cancelled</span>
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black mt-2 text-emerald-300">{counts.APPROVED}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-red-400 font-black uppercase text-xs tracking-widest">Rejected</span>
              <XCircle size={20} className="text-red-400" />
            </div>
            <div className="text-3xl font-black mt-2 text-red-300">{counts.REJECTED}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <Clock size={14} /> Pending ({counts.PENDING})
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
              activeTab === 'cancelled'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <CalendarDays size={14} /> Cancelled ({counts.APPROVED})
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, customer name or phone..."
            className="w-full bg-gray-900 border-2 border-gray-800 rounded-xl py-3 pl-11 pr-4 text-white font-bold text-sm outline-none focus:border-blue-500 transition-all"
          />
        </div>

        {activeTab === 'pending' ? (
          displayedRequests.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/50 border border-gray-800 rounded-2xl">
              <ShieldAlert size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 font-bold">No pending cancellation requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedRequests.map((r) => {
                const order = r.order || {};
                return (
                  <div key={r.id} className={`bg-gray-900/70 border rounded-2xl p-5 md:p-6 transition-all ${STATUS_STYLES[r.status] || 'border-gray-800'}`}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${STATUS_STYLES[r.status] || 'border-gray-700 text-gray-400'}`}>
                            {r.status}
                          </span>
                          <span className="font-black text-lg flex items-center gap-2">
                            <Hash size={14} className="text-gray-500" /> {r.orderNumber}
                          </span>
                          {order.status === 'CANCELLED' && (
                            <span className="text-xs font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/40 px-3 py-1 rounded-full">Cancelled</span>
                          )}
                        </div>
                        <p className="text-gray-300 font-bold text-sm">{order.customerName || 'Unknown customer'}</p>
                        {order.customerPhone && (
                          <p className="text-gray-500 text-xs font-bold flex items-center gap-1.5">
                            <Phone size={12} /> {order.customerPhone}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 font-bold">
                          <span className="inline-flex items-center gap-1.5">
                            <User size={12} /> Requested by {r.requestedByName || 'Unknown'}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock size={12} /> {formatDateTime(r.createdAt)}
                          </span>
                        </div>
                        <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                          <p className="text-xs font-black uppercase tracking-widest text-red-400 mb-1">Cancellation Reason</p>
                          <p className="text-gray-200 text-sm font-bold">{r.reason}</p>
                        </div>
                        {r.decidedByName && (
                          <div className="mt-2 text-xs text-gray-400 font-bold">
                            Decided by {r.decidedByName} on {formatDateTime(r.decidedAt)}
                            {r.decisionNote && <span className="text-gray-300"> — {r.decisionNote}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                        {order.totalPrice != null && <span className="text-amber-400 font-black text-lg">{fmt(order.totalPrice)}</span>}
                        <span className="text-xs text-gray-500 font-bold">Stage: {order.currentStage || '—'}</span>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { setSelected(r); setDecisionNote(''); }}
                            disabled={decisionLoading}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-4 py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
                          >
                            <ThumbsUp size={14} /> Approve
                          </button>
                          <button
                            onClick={() => { setSelected(r); setDecisionNote(''); }}
                            disabled={decisionLoading}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black px-4 py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
                          >
                            <ThumbsDown size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          displayedRequests.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/50 border border-gray-800 rounded-2xl">
              <PackageX size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400 font-bold">No cancelled orders yet</p>
            </div>
          ) : (
            <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-900 text-gray-500 text-xs font-black uppercase tracking-widest">
                      <th className="px-4 py-4">Order #</th>
                      <th className="px-4 py-4">Customer</th>
                      <th className="px-4 py-4">Cancellation Reason</th>
                      <th className="px-4 py-4">Requested By</th>
                      <th className="px-4 py-4">Approved By</th>
                      <th className="px-4 py-4">Cancellation Date</th>
                      <th className="px-4 py-4">Cancellation Time</th>
                      <th className="px-4 py-4">Final Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRequests.map((r) => {
                      const order = r.order || {};
                      return (
                        <tr key={r.id} className="border-t border-gray-800 hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-4 font-black text-white flex items-center gap-2">
                            <Hash size={12} className="text-gray-500" /> {r.orderNumber}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-gray-200 font-bold text-sm">{order.customerName || 'Unknown customer'}</p>
                            {order.customerPhone && <p className="text-gray-500 text-xs font-bold">{order.customerPhone}</p>}
                          </td>
                          <td className="px-4 py-4 text-gray-300 text-sm font-bold max-w-[260px]">{r.reason}</td>
                          <td className="px-4 py-4 text-gray-300 text-sm font-bold">{r.requestedByName || '—'}</td>
                          <td className="px-4 py-4 text-gray-300 text-sm font-bold">{r.decidedByName || '—'}</td>
                          <td className="px-4 py-4 text-gray-300 text-sm font-bold">{formatDate(r.decidedAt)}</td>
                          <td className="px-4 py-4 text-gray-300 text-sm font-bold">{formatTime(r.decidedAt)}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                              order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400 border-red-500/40' : STATUS_STYLES[r.status] || 'border-gray-700 text-gray-400'
                            }`}>
                              {order.status === 'CANCELLED' ? 'CANCELLED' : (r.status || '—')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Decision modal */}
      {selected && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="glass max-w-md w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-red-900/50 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-amber-500/20 rounded-full text-amber-500">
                <AlertTriangle size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 text-center">
              {selected.status === 'PENDING' ? 'Cancellation Decision' : 'Already Decided'}
            </h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-6">
              Order <span className="text-white">#{selected.orderNumber}</span> · {selected.order?.customerName}
            </p>

            <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4 mb-5 space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-red-400">Reason</p>
              <p className="text-gray-200 text-sm font-bold">{selected.reason}</p>
              <p className="text-xs font-black uppercase tracking-widest text-gray-500 mt-2">Requested by</p>
              <p className="text-gray-300 text-sm font-bold">{selected.requestedByName} · {formatDateTime(selected.createdAt)}</p>
            </div>

            {selected.status === 'PENDING' && (
              <>
                <textarea
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-red-500 transition-all text-white font-bold text-sm min-h-[80px] mb-6"
                  placeholder="Decision note (optional, shown in order history)..."
                />
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={approve}
                    disabled={decisionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20"
                  >
                    {decisionLoading ? 'Processing...' : 'Approve — Permanently Cancel Order'}
                  </button>
                  <button
                    onClick={reject}
                    disabled={decisionLoading}
                    className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/20"
                  >
                    {decisionLoading ? 'Processing...' : 'Reject — Keep Order Active'}
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
            {selected.status !== 'PENDING' && (
              <button
                onClick={() => setSelected(null)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCancellations;
