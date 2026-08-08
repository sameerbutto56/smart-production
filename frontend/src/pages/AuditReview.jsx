import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  ClipboardCheck, Package, Building2, RefreshCcw, CheckCircle2, XCircle, Clock, User,
  AlertTriangle, Eye, ThumbsUp, ThumbsDown, TrendingDown, TrendingUp, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';

const STATUS_STYLES = {
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  SUBMITTED: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;

const diffBadge = (d) => {
  if (d === 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  if (d > 0) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  return 'bg-red-500/20 text-red-400 border-red-500/40';
};

const AuditReview = () => {
  const [stats, setStats] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingList, setPendingList] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, p] = await Promise.all([
        api.get('/api/audit/stats'),
        api.get('/api/audit', { params: statusFilter ? { status: statusFilter } : {} }),
        api.get('/api/audit', { params: { status: 'SUBMITTED' } })
      ]);
      setStats(s.data);
      setAudits(a.data);
      setPendingList(p.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load audits');
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openDetail = async (audit) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/audit/${audit.id}`);
      setSelected(res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load audit detail');
    } finally { setDetailLoading(false); }
  };

  const approve = async () => {
    if (!selected) return;
    if (!window.confirm(`Approve audit ${selected.auditNumber}? Inventory will be updated automatically and adjustment records created.`)) return;
    setDecisionLoading(true);
    try {
      const res = await api.post(`/api/audit/${selected.id}/approve`);
      toast.success(res.data.message || 'Audit approved');
      setSelected(null);
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to approve audit');
    } finally { setDecisionLoading(false); }
  };

  const reject = async () => {
    if (!selected) return;
    if (!window.confirm(`Reject audit ${selected.auditNumber}? No inventory changes will be applied.`)) return;
    setDecisionLoading(true);
    try {
      await api.post(`/api/audit/${selected.id}/reject`, { reason: rejectReason || null });
      toast.success('Audit rejected');
      setSelected(null);
      setRejectReason('');
      loadAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reject audit');
    } finally { setDecisionLoading(false); }
  };

  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Inventory Audit Review</h1>
          <p className="theme-text-secondary text-xs md:text-sm font-bold uppercase tracking-widest">Verify physical vs system stock — approve to auto-apply adjustments</p>
        </div>
        <button onClick={loadAll} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3 px-6 rounded-2xl flex items-center gap-2 text-xs uppercase tracking-widest">
          <RefreshCcw size={15} /> Refresh
        </button>
      </div>

      {/* Pending-approval banner — branches locked until decision */}
      {pendingList.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-black theme-text-primary">Audit approval pending — affected branches' POS is locked</p>
            <p className="text-xs font-bold theme-text-muted mt-1">
              Warehouse/Outlet stays locked ("Audit Approval Pending") until each submitted audit is approved or rejected. No inventory has changed yet — adjustments apply only on approval.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {pendingList.map(a => (
                <button key={a.id} onClick={() => openDetail(a)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-black text-amber-400 border border-amber-500/30">
                  Review {a.auditNumber} <span className="text-gray-500">({a.type === 'OUTLET' ? a.outletName : 'Warehouse'})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass p-4 rounded-2xl border-2 border-amber-500/20">
              <p className="text-2xl md:text-3xl font-black text-amber-400">{stats.pending}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Pending Audit</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-emerald-500/20">
              <p className="text-2xl md:text-3xl font-black text-emerald-400">{stats.approved}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Approved Audits</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-red-500/20">
              <p className="text-2xl md:text-3xl font-black text-red-400">{stats.rejected}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Rejected Audits</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-gray-700/50">
              <p className="text-2xl md:text-3xl font-black theme-text-primary">{stats.inProgress}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">In Progress</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass p-4 rounded-2xl border-2 theme-border">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Inventory Adjustments</p>
              <p className="text-xl md:text-2xl font-black theme-text-primary mt-1">{stats.totalAdjustments}</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-red-500/20">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Total Loss Value</p>
              <p className="text-xl md:text-2xl font-black text-red-400 mt-1">{fmt(stats.lossValue)}</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-yellow-500/20">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Total Extra Stock Value</p>
              <p className="text-xl md:text-2xl font-black text-yellow-400 mt-1">{fmt(stats.extraValue)}</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 theme-border">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Last Audit</p>
              <p className="text-sm font-black theme-text-primary mt-1">{stats.lastAudit ? `${stats.lastAudit.auditNumber} • ${new Date(stats.lastAudit.approvedAt).toLocaleDateString()}` : '—'}</p>
            </div>
          </div>

          {stats.highestDifferenceProducts?.length > 0 && (
            <div className="glass rounded-2xl border-2 theme-border p-4">
              <p className="text-xs font-black theme-text-muted uppercase tracking-widest mb-3">Highest Difference Products</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {stats.highestDifferenceProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-black theme-text-primary truncate">{p.productName}</p>
                      <p className="text-[10px] font-bold text-gray-500">{p.color || '—'} / {p.size || '—'}</p>
                    </div>
                    <span className={`text-sm font-black ${p.totalDiff < 0 ? 'text-red-400' : p.totalDiff > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                      {p.totalDiff > 0 ? `+${p.totalDiff}` : p.totalDiff}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Audit list */}
      <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-5 py-4 border-b border-gray-800/50">
          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Audits</span>
          <div className="flex gap-2 flex-wrap">
            {['', 'SUBMITTED', 'APPROVED', 'REJECTED'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
        {loading ? <PageLoader text="Loading audits..." /> : audits.length === 0 ? (
          <p className="text-center text-sm font-bold theme-text-muted py-10">No audits found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50">
                  <th className="px-5 py-3 text-left">Audit #</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-center">Items</th>
                  <th className="px-5 py-3 text-center">Scanned</th>
                  <th className="px-5 py-3 text-center">Unscanned</th>
                  <th className="px-5 py-3 text-center">Zeroed</th>
                  <th className="px-5 py-3 text-left">Diff Value</th>
                  <th className="px-5 py-3 text-left">Auditor</th>
                  <th className="px-5 py-3 text-left">Submitted</th>
                  <th className="px-5 py-3 text-left">Decision</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {audits.map(a => (
                  <tr key={a.id} className="border-b border-gray-800/40 hover:bg-gray-800/30 cursor-pointer" onClick={() => openDetail(a)}>
                    <td className="px-5 py-3 font-black theme-text-primary">{a.auditNumber}</td>
                    <td className="px-5 py-3 text-gray-300 font-bold">
                      {a.type === 'OUTLET' ? <><Building2 size={12} className="inline mr-1 text-purple-400" />{a.outletName}</> : <><Package size={12} className="inline mr-1 text-amber-400" />Warehouse</>}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-300 font-bold">{a.totalVariants}</td>
                    <td className="px-5 py-3 text-center font-black text-blue-400">{a.scannedCount}</td>
                    <td className="px-5 py-3 text-center font-black text-gray-400">{a.unscannedCount || 0}</td>
                    <td className="px-5 py-3 text-center font-black text-red-400">{a.zeroedCount || 0}</td>
                    <td className="px-5 py-3 font-black text-orange-400">{fmt(a.differenceValue)}</td>
                    <td className="px-5 py-3 text-gray-300 font-bold">{a.createdBy}</td>
                    <td className="px-5 py-3 text-gray-400 font-bold text-xs">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}</td>
                    <td className="px-5 py-3 text-[10px] font-black">
                      {a.status === 'APPROVED'
                        ? <span className="text-emerald-400">✓ {a.approvedBy} • {new Date(a.approvedAt).toLocaleDateString()}</span>
                        : a.status === 'REJECTED'
                          ? <span className="text-red-400">✕ {a.rejectedBy} • {new Date(a.rejectedAt).toLocaleDateString()}</span>
                          : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-5 py-3"><span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${STATUS_STYLES[a.status]}`}>{a.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3 text-purple-400 font-black text-xs"><Eye size={13} className="inline" /> Review</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
            {detailLoading ? <PageLoader text="Loading audit detail..." /> : (
              <div className="bg-gray-900 rounded-3xl border border-gray-700 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black theme-text-primary">{selected.auditNumber}</h2>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${STATUS_STYLES[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs font-bold theme-text-muted mt-1">
                      {selected.type === 'OUTLET' ? <><Building2 size={11} className="inline mr-1" />{selected.outletName}</> : <><Package size={11} className="inline mr-1" />Warehouse</>}
                      {' '}• Started {new Date(selected.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 bg-gray-800 rounded-xl hover:bg-gray-700 text-gray-300"><XCircle size={16} /></button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  {[
                    ['Total Items', selected.totalVariants],
                    ['Inventory Value', fmt(selected.totalValue ?? 0)],
                    ['Scanned Items', selected.scannedCount],
                    ['Scanned Qty', selected.scannedQty || 0],
                    ['Unscanned', selected.unscannedCount || 0],
                    ['Zeroed', selected.zeroedCount || 0],
                    ['Missing', selected.missingCount],
                    ['Extra', selected.extraCount]
                  ].map(([l, v]) => (
                    <div key={l} className={`bg-gray-800/50 rounded-xl p-3 ${l === 'Zeroed' ? 'border border-red-500/30' : ''}`}>
                      <p className={`text-xl font-black ${l === 'Zeroed' ? 'text-red-400' : 'theme-text-primary'}`}>{v}</p>
                      <p className="text-[9px] font-black theme-text-muted uppercase tracking-wider mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                  <FileText size={18} className="text-orange-400" />
                  <div>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Difference Value</p>
                    <p className="text-xl font-black text-orange-300">{fmt(selected.differenceValue)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold theme-text-muted flex-wrap">
                  <User size={12} /> Auditor: {selected.createdBy} • Submitted: {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}
                  {selected.approvedBy && <><Clock size={12} className="ml-2" /> Approved: {new Date(selected.approvedAt).toLocaleString()} by {selected.approvedBy}</>}
                  {selected.rejectedBy && <><XCircle size={12} className="ml-2 text-red-400" /> Rejected: {selected.rejectedAt ? new Date(selected.rejectedAt).toLocaleString() : ''} by {selected.rejectedBy}{selected.rejectionReason ? ` — ${selected.rejectionReason}` : ''}</>}
                </div>

                {selected.status === 'SUBMITTED' && (
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <div className="flex-1">
                      {rejectReason ? (
                        <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (optional)"
                          className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-red-500" />
                      ) : null}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={reject} disabled={decisionLoading} className="flex-1 sm:flex-none px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                        <ThumbsDown size={14} /> Reject
                      </button>
                      <button onClick={approve} disabled={decisionLoading} className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                        <ThumbsUp size={14} /> Approve
                      </button>
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="max-h-[380px] overflow-auto rounded-2xl border border-gray-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900 z-10">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50">
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-left">Color</th>
                        <th className="px-4 py-3 text-left">Size</th>
                        <th className="px-4 py-3 text-center">Snapshot</th>
                        <th className="px-4 py-3 text-center">Physical</th>
                        <th className="px-4 py-3 text-center">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.items || []).filter(i => i.scanned).map(i => (
                        <tr key={i.id} className="border-b border-gray-800/40">
                          <td className="px-4 py-2.5 font-black theme-text-primary">{i.productName}</td>
                          <td className="px-4 py-2.5 text-gray-300 font-bold">{i.color || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-300 font-bold">{i.size || '—'}</td>
                          <td className="px-4 py-2.5 text-center font-black text-gray-300">{i.systemQty}</td>
                          <td className="px-4 py-2.5 text-center font-black theme-text-primary">{i.physicalQty}
                            {i.zeroed && <span className="ml-1 text-[9px] font-black text-red-400 bg-red-500/10 px-1 py-0.5 rounded border border-red-500/40">ABSENT</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${diffBadge(i.difference)}`}>
                              {i.difference > 0 ? `+${i.difference}` : i.difference}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(selected.items || []).filter(i => i.scanned).length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-gray-500">No scanned items</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selected.status === 'APPROVED' && (selected.adjustments?.length || 0) > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-xs font-bold text-emerald-400">
                    <CheckCircle2 size={13} className="inline mr-1" /> {selected.adjustments.length} automatic inventory adjustment(s) created and applied.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditReview;
