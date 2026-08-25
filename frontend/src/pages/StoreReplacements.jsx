import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Package, RefreshCw, CheckCircle, Eye, Undo2, Printer, Check, Minus, Plus } from 'lucide-react';
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
  if (status === 'PARTIALLY_RESTOCKED') return 'bg-teal-500/20 text-teal-400';
  if (status === 'PARTIALLY_RECEIVED') return 'bg-cyan-500/20 text-cyan-400';
  if (status === 'ACCEPTED') return 'bg-blue-500/20 text-blue-400';
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
  const [routingId, setRoutingId] = useState(null);
  const [ticks, setTicks] = useState({});
  const [routeDest, setRouteDest] = useState({});
  const [acceptQty, setAcceptQty] = useState({});
  const [restockQty, setRestockQty] = useState({});

  const itemsFor = (record) => {
    const pd = record?.replacementOrderInfo?.productDetails;
    const parsed = parseItems(pd);
    if (parsed.length > 0) return parsed;
    return parseItems(record?.replacementItems).map(it => ({ productDetails: it, quantity: it.quantity || 1 }));
  };

  const defaultTicks = (record) => {
    const init = {};
    itemsFor(record).forEach((it, idx) => {
      const inner = it?.productDetails || it || {};
      init[String(idx)] = inner?.availabilityStatus !== 'not_available' && inner?.availabilityStatus !== 'produced';
    });
    return init;
  };

  const caseTicks = (record) => ticks[record.id] || defaultTicks(record);
  const acceptedProducts = (record) => parseItems(record?.acceptedProducts);
  const restockedProducts = (record) => parseItems(record?.restockedProducts);

  const toggleTick = (record, idx) => {
    setTicks(prev => {
      const cur = { ...defaultTicks(record), ...(prev[record.id] || {}) };
      cur[String(idx)] = !cur[String(idx)];
      return { ...prev, [record.id]: cur };
    });
  };

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, acceptedRes, completedRes] = await Promise.all([
        api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', status: 'FAISAL_APPROVED', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', status: 'ACCEPTED', limit: 100 } }),
        api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', status: 'REPLACEMENT_COMPLETED', limit: 50 } })
      ]);
      const list = [...(pendingRes.data.cases || []), ...(acceptedRes.data.cases || []), ...(completedRes.data.cases || [])].filter(c => {
        if (c.routedTo !== 'STORE') return false;
        if (['REPLACEMENT_COMPLETED', 'COMPLETED', 'CANCELLED'].includes(c.status)) return true;
        if (c.status === 'FAISAL_APPROVED') {
          return !c.replacementOrderInfo || c.replacementOrderInfo.currentStage === 'STORE';
        }
        if (['ACCEPTED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RESTOCKED'].includes(c.status)) return true;
        return false;
      });
      setCases(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { toast.error('Failed to load replacements'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const acceptCase = async (record) => {
    if (!window.confirm(`Accept replacement for order ${record.orderNumber}? The Store will now process it per-product.`)) return;
    setProcessingId(record.id);
    try {
      const res = await api.post(`/api/return-exchange/${record.id}/store-accept`);
      toast.success(res.data?.message || 'Replacement accepted');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept'); }
    setProcessingId(null);
  };

  const handleAcceptProduct = async (record, idx, maxQty) => {
    const key = `${record.id}-${idx}`;
    const qty = parseInt(acceptQty[key] ?? maxQty, 10);
    if (qty < 0 || qty > maxQty) { toast.error(`Qty must be 0-${maxQty}`); return; }
    try {
      await api.post(`/api/return-exchange/${record.id}/accept-product`, { idx, acceptedQty: qty });
      toast.success(`${qty > 0 ? `Accepted ${qty} unit(s)` : 'Skipped'} for product #${idx + 1}`);
      setAcceptQty(prev => { const n = { ...prev }; delete n[key]; return n; });
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept product'); }
  };

  const handleRestockProduct = async (record, idx, acceptedQty) => {
    const key = `${record.id}-${idx}`;
    const qty = parseInt(restockQty[key] ?? acceptedQty, 10);
    if (qty < 0 || qty > acceptedQty) { toast.error(`Qty must be 0-${acceptedQty}`); return; }
    if (qty > 0 && !window.confirm(`Restock ${qty} unit(s) of product #${idx + 1} into inventory?`)) return;
    try {
      await api.post(`/api/return-exchange/${record.id}/restock-product`, { idx, restockedQty: qty });
      toast.success(`${qty > 0 ? `Restocked ${qty} unit(s)` : 'Skipped'} for product #${idx + 1}`);
      setRestockQty(prev => { const n = { ...prev }; delete n[key]; return n; });
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to restock product'); }
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

  const routeReplacement = async (record) => {
    const dest = routeDest[record.id];
    if (!dest) { toast.error('Select a destination first'); return; }
    const accepted = acceptedProducts(record);
    if (accepted.length === 0 || accepted.every(a => (a.acceptedQty || 0) <= 0)) {
      toast.error('At least one product must be accepted before routing'); return;
    }
    if (!window.confirm(`Route replacement for order ${record.orderNumber} to ${dest.replace(/_/g, ' ')}?\nAccepted items will be processed; in-stock items deducted from inventory.`)) return;
    setRoutingId(record.id);
    try {
      const items = itemsFor(record);
      const productAvailability = {};
      const tickState = caseTicks(record);
      items.forEach((_, idx) => { productAvailability[String(idx)] = !!tickState[String(idx)]; });
      await api.post(`/api/return-exchange/${record.id}/route`, { nextStage: dest, productAvailability });
      toast.success(`Replacement routed to ${dest.replace(/_/g, ' ')}`);
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to route replacement'); }
    setRoutingId(null);
  };

  const searchMatch = (c) => !search ||
    (c.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.replacementOrderInfo?.orderNumber || '').toLowerCase().includes(search.toLowerCase());

  const filtered = cases.filter(searchMatch);
  const stats = {
    active: cases.filter(c => !['REPLACEMENT_COMPLETED', 'COMPLETED', 'CANCELLED'].includes(c.status)).length,
    partiallyReceived: cases.filter(c => c.status === 'PARTIALLY_RECEIVED').length,
    awaitingRestock: cases.filter(c => ['ACCEPTED', 'PARTIALLY_RECEIVED'].includes(c.status)).length,
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
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store — Per-Product Replacement Processing</p>
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
          { label: 'Partially Received', value: stats.partiallyReceived, color: 'text-cyan-400' },
          { label: 'Awaiting Restock', value: stats.awaitingRestock, color: 'text-amber-400' },
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
          {filtered.map(c => {
            const accepted = acceptedProducts(c);
            const restocked = restockedProducts(c);
            const originals = parseItems(c.originalProducts);
            const totalOriginalQty = originals.reduce((s, p) => s + (p.quantity || 1), 0);
            const totalAcceptedQty = accepted.reduce((s, p) => s + (p.acceptedQty || 0), 0);
            const totalRestockedQty = restocked.reduce((s, p) => s + (p.restockedQty || 0), 0);
            const allReceived = totalAcceptedQty >= totalOriginalQty && totalOriginalQty > 0;
            const allRestocked = totalRestockedQty >= totalAcceptedQty && totalAcceptedQty > 0;
            const canRoute = accepted.length > 0 && accepted.some(a => (a.acceptedQty || 0) > 0);

            return (
              <div key={c.id} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black theme-text-primary">#{c.orderNumber || 'N/A'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE(c.status)}`}>{(c.status || '').replace(/_/g, ' ')}</span>
                      {c.replacementOrderInfo && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                          Replacement: {c.replacementOrderInfo.orderNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs theme-text-secondary mt-0.5">{c.customerName} • {c.customerPhone}</p>
                    {c.returnReason && <p className="text-xs text-amber-400 mt-1 font-bold">Reason: {c.returnReason}</p>}
                    {c.specialNote && <p className="text-xs text-purple-400 mt-1 font-bold border-l-2 border-purple-500 pl-2">Special Note: {c.specialNote}</p>}
                    <p className="text-[10px] theme-text-muted mt-0.5">Initiated by {c.handledBy} • {fmtDateTime(c.createdAt)}</p>
                    {/* Per-product progress bar */}
                    {accepted.length > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold">
                        <span className="text-cyan-400">Received: {totalAcceptedQty}/{totalOriginalQty}</span>
                        {totalRestockedQty > 0 && <span className="text-teal-400">Restocked: {totalRestockedQty}/{totalAcceptedQty}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl text-xs flex items-center gap-1">
                      <Eye size={14} /> {expandedId === c.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {expandedId === c.id && (
                  <div className="mt-4 space-y-3">
                    {/* Accept case button (FAISAL_APPROVED only) */}
                    {c.status === 'FAISAL_APPROVED' && (
                      <div className="bg-blue-950 border-2 border-blue-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Replacement Received — Awaiting Store Acceptance</p>
                            <p className="text-[10px] text-gray-500 mt-1">Accept the case to begin per-product processing (receive, restock, route).</p>
                          </div>
                          <button onClick={() => acceptCase(c)} disabled={processingId === c.id}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50 shrink-0">
                            <CheckCircle size={14} /> {processingId === c.id ? 'Accepting...' : 'Accept Case'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Per-product original goods — accept with qty + restock */}
                    <div>
                      <p className="text-[10px] font-black theme-text-muted uppercase mb-2">Original Returned Goods — Accept & Restock Per Product</p>
                      <div className="space-y-2">
                        {originals.map((item, i) => {
                          const pd = item.productDetails || item;
                          const name = pd.name || pd.productType || 'Product';
                          const color = pd.color || '';
                          const size = pd.size || '';
                          const maxQty = item.quantity || 1;
                          const accEntry = accepted.find(a => a.idx === i);
                          const rstEntry = restocked.find(r => r.idx === i);
                          const isAccepted = accEntry && (accEntry.acceptedQty || 0) > 0;
                          const isRestocked = rstEntry && (rstEntry.restockedQty || 0) > 0;
                          const acceptedQty = accEntry?.acceptedQty || 0;
                          const restockedQty = rstEntry?.restockedQty || 0;
                          const showAccept = ['ACCEPTED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RESTOCKED'].includes(c.status) || (c.status === 'FAISAL_APPROVED');
                          const showRestock = isAccepted && !isRestocked && acceptedQty > 0;
                          const acceptKey = `${c.id}-${i}`;
                          const restockKey = `${c.id}-${i}`;

                          return (
                            <div key={i} className={`bg-gray-900 border rounded-xl px-3 py-2.5 ${isRestocked ? 'border-teal-500/40' : isAccepted ? 'border-emerald-500/30' : 'border-gray-800'}`}>
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-white text-xs truncate">{name}</p>
                                    {isRestocked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">✓ RESTOCKED {restockedQty}/{acceptedQty}</span>}
                                    {isAccepted && !isRestocked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">✓ ACCEPTED {acceptedQty}/{maxQty}</span>}
                                    {!isAccepted && showAccept && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">PENDING</span>}
                                  </div>
                                  <p className="text-gray-500 text-[10px]">{color} {size && `• ${size}`} • Ordered: {maxQty}</p>
                                  {accEntry && <p className="text-[9px] text-gray-600 mt-0.5">Accepted by {accEntry.acceptedBy} • {fmtDateTime(accEntry.acceptedAt)}</p>}
                                  {rstEntry && <p className="text-[9px] text-teal-600 mt-0.5">Restocked by {rstEntry.restockedBy} • {fmtDateTime(rstEntry.restockedAt)}</p>}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Accept with qty */}
                                  {showAccept && !isAccepted && (
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                                        <button onClick={() => setAcceptQty(prev => ({ ...prev, [acceptKey]: Math.max(0, parseInt(prev[acceptKey] ?? maxQty, 10) - 1) }))}
                                          className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800"><Minus size={12} /></button>
                                        <input type="number" min="0" max={maxQty} value={acceptQty[acceptKey] ?? maxQty}
                                          onChange={e => setAcceptQty(prev => ({ ...prev, [acceptKey]: Math.max(0, Math.min(maxQty, parseInt(e.target.value || '0', 10))) }))}
                                          className="w-10 text-center text-[10px] font-black text-white bg-transparent outline-none border-x border-gray-800 py-1" />
                                        <button onClick={() => setAcceptQty(prev => ({ ...prev, [acceptKey]: Math.min(maxQty, parseInt(prev[acceptKey] ?? maxQty, 10) + 1) }))}
                                          className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800"><Plus size={12} /></button>
                                      </div>
                                      <button onClick={() => handleAcceptProduct(c, i, maxQty)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-2.5 rounded-lg text-[10px] flex items-center gap-1">
                                        <Check size={11} /> Accept
                                      </button>
                                    </div>
                                  )}
                                  {/* Restock with qty */}
                                  {showRestock && (
                                    <div className="flex items-center gap-1">
                                      <div className="flex items-center bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
                                        <button onClick={() => setRestockQty(prev => ({ ...prev, [restockKey]: Math.max(0, parseInt(prev[restockKey] ?? acceptedQty, 10) - 1) }))}
                                          className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800"><Minus size={12} /></button>
                                        <input type="number" min="0" max={acceptedQty} value={restockQty[restockKey] ?? acceptedQty}
                                          onChange={e => setRestockQty(prev => ({ ...prev, [restockKey]: Math.max(0, Math.min(acceptedQty, parseInt(e.target.value || '0', 10))) }))}
                                          className="w-10 text-center text-[10px] font-black text-white bg-transparent outline-none border-x border-gray-800 py-1" />
                                        <button onClick={() => setRestockQty(prev => ({ ...prev, [restockKey]: Math.min(acceptedQty, parseInt(prev[restockKey] ?? acceptedQty, 10) + 1) }))}
                                          className="px-1.5 py-1 text-gray-400 hover:text-white hover:bg-gray-800"><Plus size={12} /></button>
                                      </div>
                                      <button onClick={() => handleRestockProduct(c, i, acceptedQty)}
                                        className="bg-teal-600 hover:bg-teal-500 text-white font-black py-1.5 px-2.5 rounded-lg text-[10px] flex items-center gap-1">
                                        <Undo2 size={11} /> Restock
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
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
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button onClick={() => printJobSheetForCase(c)} disabled={printingId === c.id}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2 px-3 rounded-xl text-[10px] flex items-center gap-1 disabled:opacity-50">
                            <Printer size={12} /> {printingId === c.id ? 'Loading...' : 'Print Job Sheet'}
                          </button>
                        </div>

                        {/* Per-product availability ticks + routing (only when accepted AND order at STORE) */}
                        {canRoute && c.replacementOrderInfo.currentStage === 'STORE' && (
                          <div className="mt-3 border-t border-gray-800 pt-3">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <CheckCircle size={12} /> Process Replacement — Availability & Route
                            </p>
                            <p className="text-[10px] text-gray-500 mb-2">Ticked items are deducted from inventory; unticked items flow to Production/Logo.</p>
                            <div className="space-y-1.5 mb-3">
                              {itemsFor(c).map((it, idx) => {
                                const inner = it?.productDetails || it || {};
                                const on = !!caseTicks(c)[String(idx)];
                                return (
                                  <div key={idx} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="font-bold text-white text-xs truncate">{inner.name || inner.productType || 'Product'}</p>
                                      <p className="text-gray-500 text-[10px]">{(inner.color || '')} {(inner.size || '')} × {it.quantity || inner.quantity || 1}</p>
                                    </div>
                                    <button onClick={() => toggleTick(c, idx)}
                                      title={on ? 'In Stock — will deduct from inventory' : 'Not Available — no deduction'}
                                      className={`rounded-lg flex items-center justify-center text-[10px] font-black tracking-wider transition-all px-2 h-7 ${on ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}>
                                      {on ? '✓ IN STK' : '✗ NO STK'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select value={routeDest[c.id] || ''} onChange={e => setRouteDest(prev => ({ ...prev, [c.id]: e.target.value }))}
                                className="flex-1 bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 transition-all text-white text-xs font-bold appearance-none">
                                <option value="">Select destination...</option>
                                <option value="PRODUCTION">Send to Production</option>
                                <option value="LOGO_DESIGN">Send to Logo Design</option>
                                <option value="WORKERS">Send to Workers</option>
                                <option value="DISPATCH">Send to Dispatch</option>
                              </select>
                              <button onClick={() => routeReplacement(c)} disabled={routingId === c.id}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 justify-center disabled:opacity-50 shadow-lg shadow-emerald-900/20">
                                <Check size={14} /> {routingId === c.id ? 'Routing...' : 'Route & Deduct In-Stock'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-[10px] font-black text-amber-400 uppercase">No Replacement Order Yet</p>
                        <p className="text-[10px] text-gray-500 mt-1">Faisal must send this case to Store (create the replacement order) before it can be processed.</p>
                      </div>
                    )}

                    {/* Completion */}
                    {allReceived && allRestocked && c.status !== 'REPLACEMENT_COMPLETED' && c.status !== 'COMPLETED' && (
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StoreReplacements;
