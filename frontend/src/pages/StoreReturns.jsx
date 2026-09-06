import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Package, RotateCcw, RefreshCw, Factory, Eye, Box, Undo2, CheckCircle2 } from 'lucide-react';
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
  if (status === 'RESTOCKED') return 'bg-teal-500/20 text-teal-400';
  if (status === 'ROUTED_TO_PRODUCTION') return 'bg-purple-500/20 text-purple-400';
  if (status === 'ACCEPTED') return 'bg-blue-500/20 text-blue-400';
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, acceptedRes, restockedRes, routedRes] = await Promise.all([
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', status: 'PENDING', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', status: 'ACCEPTED', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', status: 'RESTOCKED', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', status: 'ROUTED_TO_PRODUCTION', limit: 100 } })
      ]);
      const list = [...(pendingRes.data.cases || []), ...(acceptedRes.data.cases || []), ...(restockedRes.data.cases || []), ...(routedRes.data.cases || [])]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReturns(list);
    } catch { toast.error('Failed to load requests'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const acceptCase = async (record) => {
    if (!window.confirm(`Accept return of order ${record.orderNumber}? The Store will now process the returned goods.`)) return;
    setProcessingId(record.id);
    try {
      const res = await api.post(`/api/return-exchange/${record.id}/store-accept`);
      toast.success(res.data?.message || 'Return accepted');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept'); }
    setProcessingId(null);
  };

  const processCase = async (record, action, notes = '') => {
    setProcessingId(record.id);
    try {
      await api.post(`/api/return-exchange/${record.id}/store-process`, { action, notes });
      toast.success(action === 'restock' ? 'Returned goods restocked into inventory' : 'Routed to Production');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to process'); }
    setProcessingId(null);
  };

  const runRestock = async (record) => {
    if (!window.confirm(`Restock the returned goods of order ${record.orderNumber} back into inventory?`)) return;
    await processCase(record, 'restock');
  };
  const runProduction = async (record) => {
    const notes = window.prompt('Notes for Production (optional):') || '';
    if (!window.confirm(`Route order ${record.orderNumber} to Production?`)) return;
    await processCase(record, 'route_to_production', notes);
  };

  const completeReturnCase = async (record) => {
    if (!window.confirm(`Complete return of order ${record.orderNumber}? The returned goods have been restocked and this return will be marked completed.`)) return;
    if (completingId === record.id) return;
    setCompletingId(record.id);
    try {
      const res = await api.post(`/api/return-exchange/${record.id}/complete-return`);
      toast.success(res.data?.message || 'Return completed');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to complete return'); }
    setCompletingId(null);
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
                {c.status === 'RESTOCKED' && (
                  <button onClick={() => completeReturnCase(c)} disabled={processingId === c.id || completingId === c.id} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-3 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle2 size={14} /> {completingId === c.id ? 'Completing...' : 'Complete Return'}
                  </button>
                )}
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

                {c.status === 'ACCEPTED' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg">
                      Accepted by {c.storeAcceptedBy || 'Store'} • {fmtDateTime(c.storeAcceptedAt)}
                    </span>
                  </div>
                ) : c.status === 'RESTOCKED' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black bg-teal-500/20 text-teal-400 px-2 py-1 rounded-lg">
                      Restocked into inventory — ready to complete
                    </span>
                  </div>
                ) : c.status === 'ROUTED_TO_PRODUCTION' || c.status === 'IN_PRODUCTION' ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg">
                      Routed to Production
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => acceptCase(c)} disabled={processingId === c.id} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                      <Box size={14} /> Accept Return
                    </button>
                  </div>
                )}

                {c.status === 'ACCEPTED' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => runRestock(c)} disabled={processingId === c.id} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                      <Undo2 size={14} /> Restock into Inventory
                    </button>
                    <button onClick={() => runProduction(c)} disabled={processingId === c.id} className="bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                      <Factory size={14} /> Route to Production
                    </button>
                  </div>
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
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Returns</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store — Return Processing</p>
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
          <ReturnsSection title="Returns — Store" icon={<Box size={18} className="text-red-400" />} color="bg-red-500/20" list={returns} emptyText="No returns to process. Returned orders from Inventory View will appear here until they are completed." />
        </div>
      )}
    </div>
  );
};

export default StoreReturns;
