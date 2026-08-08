import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { Package, RefreshCw, CheckCircle, XCircle, Eye, ArrowRight, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';

const fmtDateTime = (d) => d ? formatDateTime(d) : '';

const parseItems = (items) => {
  if (!items) return [];
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  if (Array.isArray(items)) return items;
  return [];
};

const STATUS_BADGE = (status) => {
  if (status === 'COMPLETED') return 'bg-emerald-500/20 text-emerald-400';
  if (status === 'DISPATCH_READY') return 'bg-amber-500/20 text-amber-400';
  if (status === 'IN_PRODUCTION') return 'bg-purple-500/20 text-purple-400';
  if (status === 'PENDING' || status === 'FAISAL_APPROVED') return 'bg-orange-500/20 text-orange-400';
  if (status === 'CANCELLED' || status === 'WAREHOUSE_REJECTED') return 'bg-red-500/20 text-red-400';
  return 'bg-gray-700 text-gray-400';
};

const FaisalReplacements = ({ refreshKey }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('PENDING');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [notes, setNotes] = useState({});

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', limit: 100 } });
      setCases((res.data.cases || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { toast.error('Failed to load requests'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const handleDecision = async (record, action) => {
    setProcessingId(record.id);
    try {
      await api.post(`/api/return-exchange/${record.id}/faisal-approve`, {
        action,
        notes: notes[record.id] || ''
      });
      toast.success(action === 'APPROVE' ? 'Approved — sent to Store for processing' : 'Rejected');
      setNotes(prev => ({ ...prev, [record.id]: '' }));
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setProcessingId(null);
  };

  const filtered = cases.filter(c => {
    const statusMatch = !filter || c.status === filter;
    const searchMatch = !search ||
      (c.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customerName || '').toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.status === 'PENDING' && c.routedTo === 'FAISAL').length,
    approved: cases.filter(c => c.status === 'FAISAL_APPROVED').length,
    completed: cases.filter(c => c.status === 'COMPLETED').length,
    rejected: cases.filter(c => c.status === 'CANCELLED').length
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 -rotate-2">
            <Package className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Replacements</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Faisal — Review & Approve</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or customer..."
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500 w-56" />
          <button onClick={fetchCases} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all flex items-center gap-2 border border-gray-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Awaiting Review', value: stats.pending, color: 'text-orange-400' },
          { label: 'Approved → Store', value: stats.approved, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' }
        ].map(s => (
          <div key={s.label} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] theme-text-muted uppercase font-black">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'PENDING', label: 'Awaiting Review' },
          { value: 'FAISAL_APPROVED', label: 'Approved → Store' },
          { value: 'DISPATCH_READY', label: 'Dispatch Ready' },
          { value: 'IN_PRODUCTION', label: 'In Production' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Rejected' }
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filter === f.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${filter === '' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          All
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 font-bold">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="theme-bg-subtle border-2 theme-border rounded-2xl p-10 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-bold">No replacement requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black theme-text-primary">#{c.orderNumber || 'N/A'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                    {c.routedTo === 'FAISAL' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Awaiting Faisal</span>}
                  </div>
                  <p className="text-xs theme-text-secondary mt-0.5">{c.customerName} • {c.customerPhone}</p>
                  {c.returnReason && <p className="text-xs text-amber-400 mt-1 font-bold">Reason: {c.returnReason}</p>}
                  {c.specialNote && (
                    <p className="text-xs text-purple-400 mt-1 font-bold border-l-2 border-purple-500 pl-2">Special Note: {c.specialNote}</p>
                  )}
                  <p className="text-[10px] theme-text-muted mt-0.5">Initiated by {c.handledBy} • {fmtDateTime(c.createdAt)}</p>
                </div>
                <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl text-xs flex items-center gap-1">
                  <Eye size={14} /> {expandedId === c.id ? 'Hide' : 'Details'}
                </button>
              </div>

              {expandedId === c.id && (
                <div className="mt-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black theme-text-muted uppercase mb-2">Original Items</p>
                      <div className="space-y-1.5">
                        {parseItems(c.originalProducts).map((item, i) => {
                          const pd = item.productDetails || item;
                          return (
                            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs">
                              <p className="font-bold text-white">{pd.name || pd.productType || 'Product'}</p>
                              <p className="text-gray-500 text-[10px]">{pd.color || ''} {pd.size || ''} × {item.quantity || 1}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black theme-text-muted uppercase mb-2">Replacement Items</p>
                      <div className="space-y-1.5">
                        {parseItems(c.replacementItems).map((item, i) => (
                          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs">
                            <p className="font-bold text-white">{item.name || item.productName || 'Product'}</p>
                            <p className="text-gray-500 text-[10px]">{item.color || ''} {item.size || ''} × {item.quantity || 1}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {c.status === 'PENDING' && c.routedTo === 'FAISAL' && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-[10px] font-bold theme-text-muted uppercase block mb-1">Review Notes (optional)</label>
                        <textarea value={notes[c.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [c.id]: e.target.value }))} rows={2}
                          placeholder="Notes for the Store..."
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleDecision(c, 'APPROVE')} disabled={processingId === c.id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                          <CheckCircle size={14} /> Approve → Send to Store
                        </button>
                        <button onClick={() => handleDecision(c, 'REJECT')} disabled={processingId === c.id}
                          className="bg-red-600 hover:bg-red-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FaisalReplacements;
