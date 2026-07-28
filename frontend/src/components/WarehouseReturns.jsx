import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Package, RotateCcw, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Eye, Search, ArrowRight, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';

const fmtCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;
const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : '';

const WarehouseReturns = ({ refreshKey }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [stockCheck, setStockCheck] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const [retRes, repRes] = await Promise.all([
        api.get('/api/return-exchange/cases', { params: { type: 'RETURN', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', limit: 100 } })
      ]);
      const all = [...(retRes.data.cases || []), ...(repRes.data.cases || [])];
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setCases(all);
    } catch { toast.error('Failed to load requests'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const filtered = cases.filter(c => {
    const statusMatch = !filter || c.status === filter;
    const searchMatch = !search || 
      (c.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.customerName || '').toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.status === 'PENDING').length,
    approved: cases.filter(c => ['WAREHOUSE_APPROVED', 'DISPATCH_READY', 'COMPLETED'].includes(c.status)).length,
    rejected: cases.filter(c => c.status === 'WAREHOUSE_REJECTED').length
  };

  const parseItems = (items) => {
    if (!items) return [];
    if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
    if (Array.isArray(items)) return items;
    return [];
  };

  const parseOriginalProducts = (products) => {
    if (!products) return [];
    if (typeof products === 'string') { try { products = JSON.parse(products); } catch { return []; } }
    if (!Array.isArray(products)) return [];
    return products.map(p => {
      const pd = p.productDetails || p;
      return { name: pd.name || pd.productType || 'Product', color: pd.color || '', size: pd.size || '', quantity: p.quantity || 1, price: pd.price || p.totalPrice || 0 };
    });
  };

  const handleApprove = async (caseItem) => {
    setApprovingId(caseItem.id);
    try {
      await api.post(`/api/return-exchange/${caseItem.id}/approve`, { action: 'APPROVE', warehouseNotes: 'Approved by Warehouse' });
      toast.success(`${caseItem.type} approved — inventory updated`);
      fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve'); }
    setApprovingId(null);
    setStockCheck(null);
  };

  const handleReject = async (caseItem) => {
    setApprovingId(caseItem.id);
    try {
      await api.post(`/api/return-exchange/${caseItem.id}/approve`, { action: 'REJECT', warehouseNotes: 'Rejected by Warehouse' });
      toast.success(`${caseItem.type} rejected`);
      fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject'); }
    setApprovingId(null);
  };

  const checkStock = async (caseItem) => {
    setStockLoading(true);
    try {
      const replacements = parseItems(caseItem.replacementItems);
      if (!replacements.length) { setStockCheck([]); setStockLoading(false); return; }
      const items = replacements.map(r => ({ name: r.name || r.productName, color: r.color, size: r.size, quantity: r.quantity || 1 }));
      const res = await api.post('/api/return-exchange/check-stock', { items });
      setStockCheck({ id: caseItem.id, items: res.data });
    } catch (err) { toast.error('Failed to check stock'); }
    setStockLoading(false);
  };

  const handleDispatch = async (caseItem) => {
    setApprovingId(caseItem.id);
    try {
      await api.post(`/api/return-exchange/${caseItem.id}/dispatch`, { dispatchNotes: 'Dispatched by Warehouse' });
      toast.success('Replacement dispatched successfully');
      fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to dispatch'); }
    setApprovingId(null);
  };

  const statusColor = (s) => {
    switch (s) {
      case 'PENDING': return 'bg-orange-500/20 text-orange-400';
      case 'WAREHOUSE_APPROVED': return 'bg-blue-500/20 text-blue-400';
      case 'DISPATCH_READY': return 'bg-emerald-500/20 text-emerald-400';
      case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400';
      case 'WAREHOUSE_REJECTED': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white flex items-center gap-2">
          <RotateCcw size={20} className="text-amber-400" />
          Return & Replace Requests
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Pending', value: stats.pending, color: 'text-orange-400' },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' }
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center border border-gray-700">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order # or customer..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500" />
        </div>
        {['PENDING', 'WAREHOUSE_APPROVED', 'DISPATCH_READY', 'COMPLETED', 'WAREHOUSE_REJECTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filter === s ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12"><RefreshCw className="animate-spin text-amber-400 inline" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Package size={40} className="mx-auto mb-3 text-gray-700" /><p className="text-gray-500 font-bold text-sm">No requests found</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const originals = parseOriginalProducts(c.originalProducts);
            const replacements = parseItems(c.replacementItems);
            const isExpanded = expandedId === c.id;
            const isPending = c.status === 'PENDING';
            const isDispatchReady = c.status === 'DISPATCH_READY';
            const stockData = stockCheck?.id === c.id ? stockCheck.items : null;

            return (
              <div key={c.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${c.type === 'RETURN' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{c.type}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${statusColor(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-black text-white">{c.orderNumber || 'N/A'}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{fmtDateTime(c.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Customer: <span className="text-white font-bold">{c.customerName || 'N/A'}</span> {c.customerPhone && <span className="text-gray-500">({c.customerPhone})</span>}</p>
                      {c.handledBy && <p className="text-[10px] text-gray-500 mt-0.5">Requested by: {c.handledBy}</p>}
                      {c.warehouseApprovedBy && <p className="text-[10px] text-emerald-400 mt-0.5">Approved by: {c.warehouseApprovedBy}</p>}
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                      <Eye size={12} /> {isExpanded ? 'Less' : 'Details'}
                    </button>
                  </div>
                  {c.returnReason && <p className="text-[10px] text-gray-500 mt-1">Reason: {c.returnReason}</p>}
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-700 pt-3">
                    {/* Original Products */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Original Products</p>
                      <div className="space-y-1">
                        {originals.map((p, i) => (
                          <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                            <span className="text-white font-bold">{p.name} {p.color && `(${p.color})`} {p.size && `- ${p.size}`}</span>
                            <span className="text-gray-500">Qty: {p.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Replacement Products (if REPLACEMENT) */}
                    {c.type === 'REPLACEMENT' && replacements.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Requested Replacements</p>
                        <div className="space-y-1">
                          {replacements.map((r, i) => {
                            const name = r.name || r.productName || '';
                            const stockItem = stockData?.find(s => s.name === name && s.color === r.color && s.size === r.size);
                            return (
                              <div key={i} className="bg-blue-900/20 border border-blue-500/20 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-blue-400 font-bold">{name} {r.color && `(${r.color})`} {r.size && `- ${r.size}`}</span>
                                  <span className="text-gray-500 ml-2">Qty: {r.quantity || 1}</span>
                                </div>
                                {stockItem && (
                                  <span className={`text-[10px] font-bold ${stockItem.available ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {stockItem.available ? `In Stock: ${stockItem.stock}` : `Short (Need ${r.quantity || 1}, Have ${stockItem.stock})`}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Warehouse Notes */}
                    {c.warehouseNotes && (
                      <div className="bg-gray-900 rounded-lg p-3 text-xs">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-0.5">Warehouse Notes</p>
                        <p className="text-gray-300">{c.warehouseNotes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {isPending && (
                        <>
                          <button onClick={() => checkStock(c)} disabled={stockLoading}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50">
                            {stockLoading ? 'Checking...' : 'Check Stock'}
                          </button>
                          <button onClick={() => handleApprove(c)} disabled={approvingId === c.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1">
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button onClick={() => handleReject(c)} disabled={approvingId === c.id}
                            className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white font-black text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1">
                            <XCircle size={14} /> Reject
                          </button>
                        </>
                      )}
                      {isDispatchReady && (
                        <button onClick={() => handleDispatch(c)} disabled={approvingId === c.id}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1">
                          <ArrowRight size={14} /> Dispatch
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WarehouseReturns;
