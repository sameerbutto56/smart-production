import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Package, RefreshCw, CheckCircle, Eye, Undo2, Printer, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';
import { printJobSheet } from '../utils/printReport';

const fmtCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;
const fmtDateTime = (d) => d ? formatDateTime(d) : '';

const parseItems = (items) => {
  if (!items) return [];
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  if (Array.isArray(items)) return items;
  return [];
};

const STATUS_BADGE = (status) => {
  if (status === 'COMPLETED' || status === 'REPLACEMENT_COMPLETED') return 'bg-emerald-500/20 text-emerald-400';
  if (status === 'DISPATCH_READY') return 'bg-amber-500/20 text-amber-400';
  if (status === 'IN_PRODUCTION') return 'bg-purple-500/20 text-purple-400';
  if (status === 'STORE_RECEIVE') return 'bg-cyan-500/20 text-cyan-400';
  if (status === 'PENDING' || status === 'FAISAL_APPROVED') return 'bg-orange-500/20 text-orange-400';
  if (status === 'CANCELLED' || status === 'WAREHOUSE_REJECTED') return 'bg-red-500/20 text-red-400';
  return 'bg-gray-700 text-gray-400';
};

const StoreReplacements = ({ refreshKey }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', limit: 100 } });
      const list = (res.data.cases || []).filter(c =>
        c.routedTo === 'STORE' && ['FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'REPLACEMENT_COMPLETED', 'COMPLETED'].includes(c.status)
      );
      setCases(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { toast.error('Failed to load replacements'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const restockOriginal = async (record) => {
    if (!window.confirm(`Restock the ORIGINAL returned goods of order ${record.orderNumber} back into inventory?`)) return;
    setProcessingId(record.id);
    try {
      await api.post(`/api/return-exchange/${record.id}/restock-original`);
      toast.success('Original returned goods restocked into inventory');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to restock'); }
    setProcessingId(null);
  };

  const markCompleted = async (record) => {
    if (!window.confirm(`Mark replacement case for order ${record.orderNumber} as Completed?`)) return;
    setProcessingId(record.id);
    try {
      await api.post(`/api/return-exchange/${record.id}/update-status`, { status: 'REPLACEMENT_COMPLETED' });
      toast.success('Replacement case marked Completed');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update'); }
    setProcessingId(null);
  };

  const printJobSheetForCase = async (record) => {
    if (!record.replacementOrderId) { toast.error('No replacement order created yet'); return; }
    setPrintingId(record.id);
    try {
      const res = await api.get(`/api/return-exchange/${record.id}/job-sheet-order`);
      const order = res.data;
      printJobSheet({ ...order, productVerification: order.productVerification || undefined }, user?.role || 'STORE', 'ur', {});
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load job sheet'); }
    setPrintingId(null);
  };

  const searchMatch = (c) => !search ||
    (c.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.replacementOrderInfo?.orderNumber || '').toLowerCase().includes(search.toLowerCase());

  const filtered = cases.filter(searchMatch);
  const stats = {
    active: cases.filter(c => c.status !== 'REPLACEMENT_COMPLETED' && c.status !== 'COMPLETED' && c.status !== 'CANCELLED').length,
    awaitingRestock: cases.filter(c => !c.originalRestocked).length,
    withOrder: cases.filter(c => !!c.replacementOrderInfo).length,
    completed: cases.filter(c => c.status === 'REPLACEMENT_COMPLETED' || c.status === 'COMPLETED').length
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
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store — Replacement Processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # / customer / REP-..."
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500 w-56" />
          <button onClick={fetchCases} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all flex items-center gap-2 border border-gray-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: stats.active, color: 'text-orange-400' },
          { label: 'Awaiting Restock', value: stats.awaitingRestock, color: 'text-amber-400' },
          { label: 'Replacement Order', value: stats.withOrder, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' }
        ].map(s => (
          <div key={s.label} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] theme-text-muted uppercase font-black">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 font-bold">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="theme-bg-subtle border-2 theme-border rounded-2xl p-10 text-center">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-bold">No active replacements. Faisal-created replacements will appear here.</p>
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
                    {c.replacementOrderInfo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        Replacement: {c.replacementOrderInfo.orderNumber}
                      </span>
                    )}
                    {c.originalRestocked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Original Restocked</span>}
                  </div>
                  <p className="text-xs theme-text-secondary mt-0.5">{c.customerName} • {c.customerPhone}</p>
                  {c.returnReason && <p className="text-xs text-amber-400 mt-1 font-bold">Reason: {c.returnReason}</p>}
                  {c.specialNote && <p className="text-xs text-purple-400 mt-1 font-bold border-l-2 border-purple-500 pl-2">Special Note: {c.specialNote}</p>}
                  <p className="text-[10px] theme-text-muted mt-0.5">Initiated by {c.handledBy} • {fmtDateTime(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl text-xs flex items-center gap-1">
                    <Eye size={14} /> {expandedId === c.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="mt-4 space-y-3">
                  {/* Original returned goods → restock */}
                  <div>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <p className="text-[10px] font-black theme-text-muted uppercase">Original Returned Goods (restock)</p>
                      {c.originalRestocked ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          ✓ Restocked by {c.originalRestockedBy} on {fmtDateTime(c.originalRestockedAt)}
                        </span>
                      ) : (
                        <button onClick={() => restockOriginal(c)} disabled={processingId === c.id} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-3 rounded-xl text-[10px] flex items-center gap-1 disabled:opacity-50">
                          <Undo2 size={12} /> Restock Original
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {parseItems(c.originalProducts).map((item, i) => {
                        const pd = item.productDetails || item;
                        return (
                          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white">{pd.name || pd.productType || 'Product'}</p>
                              <p className="text-gray-500 text-[10px]">{(pd.color || '')} {(pd.size || '')} × {item.quantity || 1}</p>
                            </div>
                            <span className="text-amber-400 font-black text-xs">{fmtCurrency(pd.totalPrice || item.totalPrice)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* New replacement items */}
                  <div>
                    <p className="text-[10px] font-black theme-text-muted uppercase mb-2">New Replacement Items</p>
                    <div className="space-y-1.5">
                      {parseItems(c.replacementItems).map((item, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
                          <div>
                            <p className="font-bold text-white">{item.name || item.productName || 'Product'}</p>
                            <p className="text-gray-500 text-[10px]">{item.color || ''} {item.size || ''} × {item.quantity || 1}</p>
                            {item.notes && <p className="text-amber-400 text-[10px] mt-0.5">Note: {item.notes}</p>}
                          </div>
                          <span className="text-blue-400 font-black text-xs">{fmtCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Replacement order tracking */}
                  {c.replacementOrderInfo ? (
                    <div className="bg-gray-900 border border-blue-500/30 rounded-xl p-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase">Replacement Order</p>
                          <p className="text-sm font-black text-white">{c.replacementOrderInfo.orderNumber || 'N/A'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Current Stage</p>
                          <p className="text-sm font-black text-blue-300">{c.replacementOrderInfo.currentStage || 'N/A'} <span className="text-gray-500 text-[10px]">• {c.replacementOrderInfo.status || ''}</span></p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">
                        This order flows through the normal pipeline. In <span className="text-white font-bold">Store My Tasks</span>, tick each new product
                        <span className="text-emerald-400 font-bold"> In Stock ✓</span> to deduct it from inventory (fulfilled), or leave it
                        <span className="text-amber-400 font-bold"> Not Available</span> to route it to Production/Logo automatically.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <button onClick={() => window.open(`/tasks?search=${encodeURIComponent(c.replacementOrderInfo.orderNumber || '')}`, '_blank')}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl text-[10px] flex items-center gap-1 border border-gray-700">
                          <ArrowRight size={12} /> Open in Store Tasks
                        </button>
                        <button onClick={() => printJobSheetForCase(c)} disabled={printingId === c.id}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2 px-3 rounded-xl text-[10px] flex items-center gap-1 disabled:opacity-50">
                          <Printer size={12} /> {printingId === c.id ? 'Loading...' : 'Print Job Sheet'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-3">
                      <p className="text-[10px] font-black text-amber-400 uppercase">No Replacement Order Yet</p>
                      <p className="text-[10px] text-gray-500 mt-1">Faisal must send this case to Store (create the replacement order) before it can be processed.</p>
                    </div>
                  )}

                  {/* Completion */}
                  {c.status !== 'REPLACEMENT_COMPLETED' && c.status !== 'COMPLETED' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => markCompleted(c)} disabled={processingId === c.id}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                        <CheckCircle size={14} /> Mark Replacement Completed
                      </button>
                    </div>
                  )}
                  {c.replacementCompleted && (
                    <p className="text-[10px] text-emerald-400 font-bold">✓ Completed by {c.replacementCompletedBy} on {fmtDateTime(c.replacementCompletedAt)}</p>
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

export default StoreReplacements;
