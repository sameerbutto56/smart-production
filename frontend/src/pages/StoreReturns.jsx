import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Package, RotateCcw, RefreshCw, CheckCircle, Factory, Eye, Box, Undo2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';

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

const StoreReturns = ({ refreshKey }) => {
  const { user } = useAuth();
  const [returns, setReturns] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const [retRes, repRes] = await Promise.all([
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', status: 'PENDING', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', limit: 100 } })
      ]);
      const retList = (retRes.data.cases || []).filter(c => c.routedTo === 'STORE');
      const repList = (repRes.data.cases || []).filter(c =>
        c.routedTo === 'STORE' && ['FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'REPLACEMENT_COMPLETED', 'COMPLETED'].includes(c.status)
      );
      setReturns(retList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setReplacements(repList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { toast.error('Failed to load requests'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const processCase = async (record, action, notes = '') => {
    setProcessingId(record.id);
    try {
      await api.post(`/api/return-exchange/${record.id}/store-process`, { action, notes });
      toast.success(action === 'restock' ? 'Returned goods restocked into inventory' : action === 'deduct' ? 'Replacement deducted — ready for dispatch' : 'Routed to Production');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to process'); }
    setProcessingId(null);
  };

  const runRestock = async (record) => {
    if (!window.confirm(`Restock the returned goods of order ${record.orderNumber} back into inventory?`)) return;
    await processCase(record, 'restock');
  };
  const runDeduct = async (record) => {
    if (!window.confirm(`Deduct the replacement items of order ${record.orderNumber} from inventory and mark ready for dispatch?`)) return;
    await processCase(record, 'deduct');
  };
  const runProduction = async (record) => {
    const notes = window.prompt('Notes for Production (optional):') || '';
    if (!window.confirm(`Route order ${record.orderNumber} to Production?`)) return;
    await processCase(record, 'route_to_production', notes);
  };

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

  const searchMatch = (c) => !search ||
    (c.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(search.toLowerCase());

  const ReturnsSection = ({ title, icon, color, list, emptyText }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <h2 className="text-lg font-black theme-text-primary">{title}</h2>
        <span className="text-xs font-black bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="theme-bg-subtle border-2 theme-border rounded-2xl p-8 text-center">
          <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-bold">{emptyText}</p>
        </div>
      ) : (
        list.filter(searchMatch).map(c => (
          <div key={c.id} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 md:p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black theme-text-primary">#{c.orderNumber || 'N/A'}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs theme-text-secondary mt-0.5">{c.customerName} • {c.customerPhone}</p>
                {c.returnReason && <p className="text-xs text-amber-400 mt-1 font-bold">Reason: {c.returnReason}</p>}
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
                <div>
                  <p className="text-[10px] font-black theme-text-muted uppercase mb-2">Returned Goods (to restock)</p>
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => runRestock(c)} disabled={processingId === c.id} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                    <Undo2 size={14} /> Restock into Inventory
                  </button>
                  <button onClick={() => runProduction(c)} disabled={processingId === c.id} className="bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                    <Factory size={14} /> Route to Production
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const ReplacementsSection = ({ title, icon, color, list, emptyText }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
        <h2 className="text-lg font-black theme-text-primary">{title}</h2>
        <span className="text-xs font-black bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="theme-bg-subtle border-2 theme-border rounded-2xl p-8 text-center">
          <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-bold">{emptyText}</p>
        </div>
      ) : (
        list.filter(searchMatch).map(c => (
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
                {c.faisalApprovedBy && <p className="text-[10px] text-emerald-400 mt-0.5">Faisal approved: {c.faisalApprovedBy} on {fmtDateTime(c.faisalApprovedAt)}</p>}
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
                      <button onClick={() => window.open(`/orders?search=${encodeURIComponent(c.replacementOrderInfo.orderNumber || '')}`, '_blank')}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl text-[10px] flex items-center gap-1 border border-gray-700">
                        <ArrowRight size={12} /> Open in Orders
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
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-rose-600 rounded-2xl shadow-xl shadow-rose-900/20 -rotate-2">
            <RotateCcw className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Returns & Replacements</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store — Processing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order # or customer..."
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-rose-500 w-56" />
          <button onClick={fetchCases} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all flex items-center gap-2 border border-gray-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 font-bold">Loading...</div>
      ) : (
        <div className="space-y-8">
          <ReturnsSection title="Returns — Awaiting Store" icon={<Box size={18} className="text-red-400" />} color="bg-red-500/20" list={returns} emptyText="No pending returns. Returned orders from Inventory View will appear here." />
          <ReplacementsSection title="Replacements — Track & Process" icon={<Package size={18} className="text-blue-400" />} color="bg-blue-500/20" list={replacements} emptyText="No active replacements. Faisal-created replacements will appear here." />
        </div>
      )}
    </div>
  );
};

export default StoreReturns;
