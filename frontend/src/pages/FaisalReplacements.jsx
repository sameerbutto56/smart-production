import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { Package, RefreshCw, CheckCircle, XCircle, Eye, Search, Plus, Trash2, Send, FileText, RotateCcw, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';

const fmtDateTime = (d) => d ? formatDateTime(d) : '';

const parseJSON = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

const parseItems = (items) => {
  if (!items) return [];
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  if (Array.isArray(items)) return items;
  return [];
};

// "Chest: 42" / "Waist: 34" lines → { Chest: '42', Waist: '34' }
const parseMeasurements = (text) => {
  if (!text || !text.trim()) return null;
  const obj = {};
  text.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && v) obj[k] = v;
  });
  return Object.keys(obj).length ? obj : null;
};

const STATUS_BADGE = (status) => {
  if (status === 'COMPLETED' || status === 'REPLACEMENT_COMPLETED') return 'bg-emerald-500/20 text-emerald-400';
  if (status === 'DISPATCH_READY') return 'bg-amber-500/20 text-amber-400';
  if (status === 'IN_PRODUCTION') return 'bg-purple-500/20 text-purple-400';
  if (status === 'STORE_RECEIVE') return 'bg-cyan-500/20 text-cyan-400';
  if (status === 'FAISAL_APPROVED') return 'bg-blue-500/20 text-blue-400';
  if (status === 'PENDING') return 'bg-orange-500/20 text-orange-400';
  if (status === 'CANCELLED' || status === 'WAREHOUSE_REJECTED') return 'bg-red-500/20 text-red-400';
  return 'bg-gray-700 text-gray-400';
};

const newItemRow = () => ({
  name: '', productType: '', color: '', size: '', quantity: 1, unitPrice: '',
  fabricType: '', gender: 'Male', sleeveLength: 'full', shirtLength: 'long',
  matchingCap: false, matchingCapQty: 0, notes: '', measurements: '',
  engravingRequired: 'skip',
  engravingLines: [{ type: 'direct', name: '', designNotes: '' }]
});

const FaisalReplacements = ({ refreshKey }) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [expandedId, setExpandedId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [notes, setNotes] = useState({});

  // Track by original or REP- order number
  const [trackQuery, setTrackQuery] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackData, setTrackData] = useState(null);
  const [trackError, setTrackError] = useState('');

  // Hub: search original order
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [orderFound, setOrderFound] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Create replacement form
  const [showCreate, setShowCreate] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [newItems, setNewItems] = useState([newItemRow()]);
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/return-exchange/cases', { params: { type: 'REPLACEMENT', limit: 100 } });
      setCases((res.data.cases || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch { toast.error('Failed to load requests'); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases, refreshKey]);

  const lookupOrder = async () => {
    const q = search.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError('');
    setOrderFound(null);
    try {
      const res = await api.get(`/api/return-exchange/lookup/${encodeURIComponent(q)}`);
      setOrderFound(res.data);
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Order not found');
    }
    setSearchLoading(false);
  };

  const trackReplacement = async () => {
    const q = trackQuery.trim();
    if (!q) return;
    setTrackLoading(true);
    setTrackError('');
    setTrackData(null);
    try {
      const res = await api.get(`/api/return-exchange/track/${encodeURIComponent(q)}`);
      setTrackData(res.data);
    } catch (err) {
      setTrackError(err.response?.data?.message || 'No replacement found for this reference');
    }
    setTrackLoading(false);
  };

  const openCreate = () => {
    setSpecialNote('');
    setReturnReason('');
    setNewItems([newItemRow()]);
    setShowCreate(true);
  };

  const updateItem = (idx, field, value) => {
    setNewItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const updateEngravingLine = (idx, lineIdx, field, value) => {
    setNewItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const lines = (it.engravingLines || []).map((l, li) => (li === lineIdx ? { ...l, [field]: value } : l));
      return { ...it, engravingLines: lines };
    }));
  };

  const addEngravingLine = (idx) => {
    setNewItems(prev => prev.map((it, i) => (
      i === idx ? { ...it, engravingLines: [...(it.engravingLines || []), { type: 'direct', name: '', designNotes: '' }] } : it
    )));
  };

  const removeEngravingLine = (idx, lineIdx) => {
    setNewItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const lines = (it.engravingLines || []).filter((_, li) => li !== lineIdx);
      return { ...it, engravingLines: lines.length ? lines : [{ type: 'direct', name: '', designNotes: '' }] };
    }));
  };

  const addItem = () => setNewItems(prev => [...prev, newItemRow()]);
  const removeItem = (idx) => setNewItems(prev => prev.filter((_, i) => i !== idx));

  const buildItems = () => newItems.filter(it => (it.name || '').trim()).map(it => {
    const engravingReq = it.engravingRequired === 'yes';
    const engravingLines = (it.engravingLines || [])
      .filter(l => (l.name || '').trim() || (l.designNotes || '').trim())
      .map(l => ({ type: l.type || 'direct', name: (l.name || '').trim(), designNotes: (l.designNotes || '').trim() }));
    const articleNames = engravingLines.map(l => l.name).filter(Boolean);
    return {
      name: it.name.trim(),
      productType: (it.productType || '').trim() || it.name.trim(),
      color: it.color || '',
      size: it.size || '',
      quantity: parseInt(it.quantity) || 1,
      unitPrice: parseFloat(it.unitPrice) || 0,
      fabricType: it.fabricType || '',
      gender: it.gender || 'Male',
      sleeveLength: it.sleeveLength || '',
      shirtLength: it.shirtLength || '',
      matchingCap: !!it.matchingCap,
      matchingCapQty: parseInt(it.matchingCapQty) || 0,
      notes: it.notes || '',
      measurementSpecialNote: it.notes || '',
      sizeData: parseMeasurements(it.measurements),
      engravingRequired: engravingReq ? 'yes' : 'skip',
      engraving: engravingReq ? {
        engravingType: engravingLines[0]?.type || 'direct',
        nameSpelling: articleNames[0] || '',
        articleNames,
        engravingLines,
        designNotes: engravingLines.length > 0 ? engravingLines.map(l => l.designNotes).filter(Boolean).join('\n') : '',
        nameColor: '',
        logoColor: '',
        logoPlacement: '',
        logos: []
      } : undefined
    };
  });

  const buildSummary = () => {
    const originalItems = parseItems(orderFound?.productDetails).map((item, i) => {
      const pd = item.productDetails || item;
      return { index: i + 1, name: pd.name || pd.productType || '', color: pd.color || '', size: pd.size || '', quantity: item.quantity || 1 };
    });
    const newProducts = buildItems().map(it => ({ name: it.name, color: it.color, size: it.size, quantity: it.quantity, notes: it.notes }));
    return { originalItems, newItems: newProducts, notes: specialNote, returnReason, createdBy: 'Faisal', createdAt: new Date().toISOString() };
  };

  const createAndSend = async () => {
    if (!returnReason.trim()) { toast.error('A replacement reason is required'); return; }
    const validItems = buildItems();
    if (validItems.length === 0) { toast.error('Add at least one replacement product with a name'); return; }
    if (!orderFound) { toast.error('Load the original order first'); return; }

    // Refuse to start a duplicate replacement while one is already active
    const activeCase = (orderFound.returnExchangeCases || []).find(c =>
      c.type === 'REPLACEMENT' && ['PENDING', 'FAISAL_APPROVED', 'IN_PRODUCTION', 'STORE_RECEIVE', 'DISPATCH_READY', 'WAREHOUSE_APPROVED'].includes(c.status)
    );
    if (activeCase) {
      toast.error(activeCase.routedTo === 'FAISAL'
        ? 'This order already has a replacement awaiting your review.'
        : 'A replacement for this order is already being processed.');
      return;
    }

    setCreating(true);
    try {
      const initRes = await api.post('/api/return-exchange/initiate', {
        orderId: orderFound.id,
        type: 'REPLACEMENT',
        returnReason: returnReason.trim() || 'Replacement requested',
        specialNote: specialNote.trim(),
        replacementItems: validItems.map(it => ({ name: it.name, color: it.color, size: it.size, quantity: it.quantity, notes: it.notes }))
      });
      const record = initRes.data;
      await api.post(`/api/return-exchange/${record.id}/send-to-store`, {
        replacementItems: validItems,
        replacementSummary: buildSummary()
      });
      toast.success('Replacement order created and sent to Store');
      setShowCreate(false);
      setOrderFound(null);
      setSearch('');
      await fetchCases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create replacement');
    }
    setCreating(false);
  };

  // Approve/reject a legacy case (created via Inventory View / Outlet POS form)
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

  // Send a legacy pending case to Store by creating its replacement order
  const sendToStore = async (record) => {
    const items = parseItems(record.replacementItems);
    if (items.length === 0) { toast.error('This case has no replacement items defined yet'); return; }
    setProcessingId(record.id);
    try {
      const summary = {
        originalItems: parseItems(record.originalProducts).map((item, i) => {
          const pd = item.productDetails || item;
          return { index: i + 1, name: pd.name || pd.productType || '', color: pd.color || '', size: pd.size || '', quantity: item.quantity || 1 };
        }),
        newItems: items.map(it => ({ name: it.name || it.productName || '', color: it.color || '', size: it.size || '', quantity: it.quantity || 1, notes: it.notes || '' })),
        notes: record.specialNote || '',
        createdBy: 'Faisal',
        createdAt: new Date().toISOString()
      };
      await api.post(`/api/return-exchange/${record.id}/send-to-store`, { replacementItems: items, replacementSummary: summary });
      toast.success('Replacement order created and sent to Store');
      await fetchCases();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send to Store'); }
    setProcessingId(null);
  };

  const filtered = cases.filter(c => {
    // "Awaiting Review" means the case is actually sitting WITH Faisal —
    // a PENDING case routed to STORE belongs to the Store queue, not here.
    if (filter === 'PENDING') return c.status === 'PENDING' && c.routedTo === 'FAISAL';
    if (!filter) return true;
    return c.status === filter;
  });

  const stats = {
    total: cases.length,
    pending: cases.filter(c => c.status === 'PENDING' && c.routedTo === 'FAISAL').length,
    approved: cases.filter(c => c.status === 'FAISAL_APPROVED' && c.routedTo === 'STORE').length,
    completed: cases.filter(c => c.status === 'COMPLETED' || c.status === 'REPLACEMENT_COMPLETED').length,
    rejected: cases.filter(c => c.status === 'CANCELLED').length
  };

  const renderOriginal = (c) => {
    const items = parseItems(c.originalProducts);
    return items.length === 0 ? <p className="text-xs text-gray-600">No original items recorded</p> : (
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pd = item.productDetails || item;
          return (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs">
              <p className="font-bold text-white">{pd.name || pd.productType || 'Product'}</p>
              <p className="text-gray-500 text-[10px]">{pd.color || ''} {pd.size || ''} × {item.quantity || 1}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderReplacement = (c) => {
    const items = parseItems(c.replacementItems);
    if (items.length === 0) return <p className="text-xs text-gray-600">No replacement items defined yet</p>;
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs">
            <p className="font-bold text-white">{item.name || item.productName || 'Product'}</p>
            <p className="text-gray-500 text-[10px]">{item.color || ''} {item.size || ''} × {item.quantity || 1}</p>
            {item.notes && <p className="text-amber-400 text-[10px] mt-0.5">Note: {item.notes}</p>}
          </div>
        ))}
      </div>
    );
  };

  const renderSummary = (c) => {
    if (!c.replacementSummary) return null;
    let s;
    try { s = typeof c.replacementSummary === 'string' ? JSON.parse(c.replacementSummary) : c.replacementSummary; } catch { return null; }
    return (
      <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-3">
        <p className="text-[10px] font-black text-amber-400 uppercase mb-1.5">Replacement Summary</p>
        <p className="text-[11px] theme-text-secondary"><span className="font-bold text-white">Original:</span> {(s.originalItems || []).map(o => `${o.name} ${o.color} ${o.size} ×${o.quantity}`).join(', ') || 'N/A'}</p>
        <p className="text-[11px] theme-text-secondary mt-0.5"><span className="font-bold text-white">New:</span> {(s.newItems || []).map(n => `${n.name} ${n.color} ${n.size} ×${n.quantity}`).join(', ') || 'N/A'}</p>
        {s.notes && <p className="text-[11px] text-purple-400 mt-0.5">Note: {s.notes}</p>}
      </div>
    );
  };

  const timelineColor = (type) => {
    if (type === 'original') return 'bg-gray-500';
    if (type === 'request') return 'bg-orange-500';
    if (type === 'faisal') return 'bg-blue-500';
    if (type === 'restock') return 'bg-emerald-500';
    if (type === 'complete') return 'bg-emerald-600';
    return 'bg-purple-500';
  };

  const RenderTrackTimeline = ({ data }) => (
    <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-black text-emerald-400 uppercase">Replacement Found</p>
          <p className="text-sm font-black text-white">
            Original <span className="text-gray-400">#{data.originalOrder?.orderNumber || 'N/A'}</span>
            {data.replacementOrder && (
              <> → <span className="text-blue-400">#{data.replacementOrder.orderNumber}</span></>
            )}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">{data.originalOrder?.customerName} • {data.originalOrder?.customerPhone}</p>
        </div>
        <div className="text-right">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE(data.case?.status)}`}>{(data.case?.status || '').replace(/_/g, ' ')}</span>
          <p className="text-[10px] text-gray-500 mt-1">Current Stage: <span className="text-white font-bold">{data.replacementOrder?.currentStage || '—'}</span></p>
        </div>
      </div>

      <div className="mt-3 space-y-0">
        {(data.timeline || []).map((e, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full ${timelineColor(e.type)} mt-1`} />
              {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-gray-700 min-h-[16px]" />}
            </div>
            <div className="pb-3">
              <p className="text-xs font-bold text-white">{e.title}</p>
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock size={10} /> {fmtDateTime(e.at)}
                {e.by && <span> • by <span className="text-emerald-400">{e.by}</span></span>}
                {e.orderNumber && <span> • #{e.orderNumber}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const EngravingFields = ({ it, idx }) => {
    const lines = it.engravingLines && it.engravingLines.length ? it.engravingLines : [{ type: 'direct', name: '', designNotes: '' }];
    return (
      <div className="mt-2 bg-gray-800/60 border border-purple-500/30 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-black text-purple-400 uppercase">Engraving Lines — one per line</p>
          <button onClick={() => addEngravingLine(idx)} className="bg-purple-600 hover:bg-purple-500 text-white font-black py-1 px-2.5 rounded-lg text-[10px] flex items-center gap-1">
            <Plus size={11} /> Add Line
          </button>
        </div>
        {lines.map((line, li) => (
          <div key={li} className="mb-2 bg-gray-900 border border-purple-500/20 rounded-xl p-2.5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className="text-[9px] font-bold theme-text-muted uppercase block mb-1">Line {li + 1} Type</label>
                <select value={line.type} onChange={e => updateEngravingLine(idx, li, 'type', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-purple-500">
                  <option value="direct">Direct</option>
                  <option value="patch">Patch</option>
                  <option value="embroidery">Embroidery</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold theme-text-muted uppercase block mb-1">Name / Article</label>
                <input value={line.name} onChange={e => updateEngravingLine(idx, li, 'name', e.target.value)} placeholder="e.g. DR FAROOQUE ALI"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-purple-500" />
              </div>
              <div className="col-span-2 md:col-span-1 flex items-end justify-end">
                <button onClick={() => removeEngravingLine(idx, li)} disabled={lines.length === 1}
                  className="flex items-center justify-center bg-red-600/20 hover:bg-red-600/40 text-red-400 font-black rounded-lg px-2.5 py-2 text-xs disabled:opacity-30">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="text-[9px] font-bold theme-text-muted uppercase block mb-1">Text / Design Notes</label>
                <input value={line.designNotes} onChange={e => updateEngravingLine(idx, li, 'designNotes', e.target.value)} placeholder="Engraving instructions for this line"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-purple-500" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Faisal — Workflow Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCases} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all flex items-center gap-2 border border-gray-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Track by original or REP- order number */}
      <div className="theme-bg-subtle border-2 border-emerald-500/30 rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-2 rounded-xl bg-emerald-500/20"><RotateCcw size={18} className="text-emerald-400" /></div>
          <div className="flex-1 min-w-[200px]">
            <input
              value={trackQuery}
              onChange={e => setTrackQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') trackReplacement(); }}
              placeholder="Track by Original Order # (JT-123456) or Replacement Order # (REP-123456)..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          <button onClick={trackReplacement} disabled={trackLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
            <Search size={14} /> {trackLoading ? 'Tracking...' : 'Track'}
          </button>
        </div>
        {trackError && <p className="text-xs text-red-400 font-bold mt-3">⚠ {trackError}</p>}
        {trackData && <div className="mt-4"><RenderTrackTimeline data={trackData} /></div>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Awaiting Review', value: stats.pending, color: 'text-orange-400' },
          { label: 'With Store', value: stats.approved, color: 'text-blue-400' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' }
        ].map(s => (
          <div key={s.label} className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] theme-text-muted uppercase font-black">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search original order */}
      <div className="theme-bg-subtle border-2 theme-border rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-2 rounded-xl bg-blue-500/20"><Search size={18} className="text-blue-400" /></div>
          <div className="flex-1 min-w-[200px]">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') lookupOrder(); }}
              placeholder="Search original Order # / Invoice # / Phone..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={lookupOrder} disabled={searchLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
            <Search size={14} /> {searchLoading ? 'Searching...' : 'Load Order'}
          </button>
        </div>

        {searchError && <p className="text-xs text-red-400 font-bold mt-3">⚠ {searchError}</p>}

        {orderFound && (
          <div className="mt-4 bg-gray-900 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-white">#{orderFound.orderNumber || 'N/A'}</span>
                  {orderFound.invoiceNumber && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{orderFound.invoiceNumber}</span>}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">{orderFound.source}</span>
                </div>
                <p className="text-xs theme-text-secondary mt-1">{orderFound.customerName} • {orderFound.customerPhone} • {orderFound.city || ''}</p>
                <p className="text-[10px] theme-text-muted mt-0.5">Stage: {orderFound.currentStage} • {orderFound.status} • Total: PKR {(orderFound.totalPrice || 0).toLocaleString()}</p>
              </div>
              <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1">
                <Plus size={14} /> Create Replacement
              </button>
            </div>

            <div className="mt-3 grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black theme-text-muted uppercase mb-1.5">Original Order Items</p>
                <div className="space-y-1.5">
                  {parseItems(orderFound.productDetails).map((item, i) => {
                    const pd = item.productDetails || item;
                    const sizeData = parseJSON(orderFound.sizeData);
                    return (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                        <p className="font-bold text-white">{pd.name || pd.productType || 'Product'}</p>
                        <p className="text-gray-500 text-[10px]">{pd.color || ''} {pd.size || ''} × {item.quantity || 1}</p>
                        {sizeData && <p className="text-gray-500 text-[9px] mt-0.5">Measurements: {Object.entries(sizeData).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black theme-text-muted uppercase mb-1.5">Existing Cases for this Order</p>
                <div className="space-y-1.5">
                  {(orderFound.returnExchangeCases || []).length === 0 ? (
                    <p className="text-xs text-gray-600">No previous cases</p>
                  ) : (
                    orderFound.returnExchangeCases.map(c => (
                      <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                        <span className="font-bold text-white">{c.type}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'PENDING', label: 'Awaiting Review' },
          { value: 'FAISAL_APPROVED', label: 'With Store' },
          { value: 'IN_PRODUCTION', label: 'In Production' },
          { value: 'STORE_RECEIVE', label: 'Back at Store' },
          { value: 'DISPATCH_READY', label: 'Dispatch Ready' },
          { value: 'REPLACEMENT_COMPLETED', label: 'Completed' },
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
                    {c.replacementOrderInfo && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                        Replacement: {c.replacementOrderInfo.orderNumber} • {c.replacementOrderInfo.currentStage}
                      </span>
                    )}
                    {c.originalRestocked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Original Restocked</span>}
                  </div>
                  <p className="text-xs theme-text-secondary mt-0.5">{c.customerName} • {c.customerPhone}</p>
                  {c.returnReason && <p className="text-xs text-amber-400 mt-1 font-bold">Reason: {c.returnReason}</p>}
                  {c.specialNote && (
                    <p className="text-xs text-purple-400 mt-1 font-bold border-l-2 border-purple-500 pl-2">Special Note: {c.specialNote}</p>
                  )}
                  <p className="text-[10px] theme-text-muted mt-0.5">Initiated by {c.handledBy} • {fmtDateTime(c.createdAt)}</p>
                  {c.faisalApprovedAt && <p className="text-[10px] text-emerald-400 mt-0.5">Approved & sent to Store: {c.faisalApprovedBy} on {fmtDateTime(c.faisalApprovedAt)}</p>}
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
                      {renderOriginal(c)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black theme-text-muted uppercase mb-2">Replacement Items</p>
                      {renderReplacement(c)}
                    </div>
                  </div>
                  {renderSummary(c)}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {c.status === 'PENDING' && c.routedTo === 'FAISAL' && !c.replacementOrderId && (
                      <>
                        <button onClick={() => sendToStore(c)} disabled={processingId === c.id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                          <Send size={14} /> Send to Store — Create Order
                        </button>
                        <button onClick={() => handleDecision(c, 'REJECT')} disabled={processingId === c.id}
                          className="bg-red-600 hover:bg-red-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Replacement modal */}
      {showCreate && orderFound && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="theme-bg-subtle border-2 theme-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20"><FileText size={18} className="text-blue-400" /></div>
                <div>
                  <h2 className="text-lg font-black theme-text-primary">Create Replacement</h2>
                  <p className="text-xs theme-text-muted">#{orderFound.orderNumber} — {orderFound.customerName}</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white font-black text-xl">&times;</button>
            </div>

            <div>
              <label className="text-[10px] font-bold theme-text-muted uppercase block mb-1">Replacement Reason <span className="text-red-400">*</span></label>
              <input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Why is this order being replaced? (required)"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="text-[10px] font-bold theme-text-muted uppercase block mb-1">Special Note (optional)</label>
              <textarea value={specialNote} onChange={e => setSpecialNote(e.target.value)} rows={2}
                placeholder="Additional instructions/information (optional)"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none" />
            </div>

            {/* Original Order Details */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Original Order Details (read-only)</p>
              <div className="space-y-1.5">
                {parseItems(orderFound.productDetails).map((item, i) => {
                  const pd = item.productDetails || item;
                  return (
                    <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs">
                      <p className="font-bold text-white">{pd.name || pd.productType || 'Product'}</p>
                      <p className="text-gray-500 text-[10px]">
                        {pd.color || ''} {pd.size || ''} × {item.quantity || 1}
                        {pd.fabricType && <span> • {pd.fabricType}</span>}
                        {pd.gender && <span> • {pd.gender}</span>}
                      </p>
                      {(pd.sleeveLength || pd.shirtLength) && <p className="text-gray-500 text-[9px]">Sleeve: {pd.sleeveLength || '—'} • Length: {pd.shirtLength || '—'}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Replacement Details */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-black theme-text-muted uppercase">New Replacement Product(s) — Full Details</p>
                <button onClick={addItem} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-1.5 px-3 rounded-lg text-[10px] flex items-center gap-1">
                  <Plus size={12} /> Add Product
                </button>
              </div>
              <div className="space-y-2">
                {newItems.map((it, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Product name *"
                        className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.productType} onChange={e => updateItem(idx, 'productType', e.target.value)} placeholder="Type (default = name)"
                        className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.color} onChange={e => updateItem(idx, 'color', e.target.value)} placeholder="Color"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.size} onChange={e => updateItem(idx, 'size', e.target.value)} placeholder="Size"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} type="number" min="1" placeholder="Qty"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} type="number" min="0" placeholder="Unit Price (optional)"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <input value={it.fabricType} onChange={e => updateItem(idx, 'fabricType', e.target.value)} placeholder="Fabric"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <select value={it.gender} onChange={e => updateItem(idx, 'gender', e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Unisex">Unisex</option>
                      </select>
                      <select value={it.sleeveLength} onChange={e => updateItem(idx, 'sleeveLength', e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                        <option value="full">Full Sleeve</option>
                        <option value="half">Half Sleeve</option>
                        <option value="three-quarter">3 Quarter Sleeve</option>
                      </select>
                      <select value={it.shirtLength} onChange={e => updateItem(idx, 'shirtLength', e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                        <option value="long">Long</option>
                        <option value="regular">Regular</option>
                        <option value="short">Short</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-gray-300 font-bold bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer">
                        <input type="checkbox" checked={it.matchingCap} onChange={e => updateItem(idx, 'matchingCap', e.target.checked)} className="accent-blue-500" />
                        Matching Cap
                      </label>
                      {it.matchingCap && (
                        <input value={it.matchingCapQty} onChange={e => updateItem(idx, 'matchingCapQty', e.target.value)} type="number" min="0" placeholder="Cap Qty"
                          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      )}
                      <input value={it.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="Special note (optional)"
                        className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
                      <textarea value={it.measurements} onChange={e => updateItem(idx, 'measurements', e.target.value)} rows={2}
                        placeholder="Measurements — one per line, e.g.&#10;Chest: 42&#10;Waist: 34&#10;Shoulder: 18"
                        className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none" />
                      <button onClick={() => removeItem(idx)} disabled={newItems.length === 1}
                        className="flex items-center justify-center bg-red-600/20 hover:bg-red-600/40 text-red-400 font-black rounded-lg py-2 text-xs disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Engraving Yes / Skip */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black theme-text-muted uppercase">Engraving:</span>
                      <button onClick={() => updateItem(idx, 'engravingRequired', it.engravingRequired === 'yes' ? 'skip' : 'yes')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${it.engravingRequired === 'yes' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        Yes
                      </button>
                      <button onClick={() => updateItem(idx, 'engravingRequired', 'skip')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${it.engravingRequired !== 'yes' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        Skip
                      </button>
                    </div>
                    {it.engravingRequired === 'yes' && <EngravingFields it={it} idx={idx} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary preview */}
            <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-3">
              <p className="text-[10px] font-black text-amber-400 uppercase mb-1.5">Generated Summary</p>
              <p className="text-[11px] theme-text-secondary"><span className="font-bold text-white">Original:</span> {parseItems(orderFound.productDetails).map((item, i) => { const pd = item.productDetails || item; return `${pd.name || pd.productType || ''} ${pd.color || ''} ${pd.size || ''} ×${item.quantity || 1}`; }).join(', ') || 'N/A'}</p>
              <p className="text-[11px] theme-text-secondary mt-0.5"><span className="font-bold text-white">New:</span> {buildItems().map(it => `${it.name} ${it.color} ${it.size} ×${it.quantity}${it.engravingRequired === 'yes' ? (it.engraving?.engravingLines?.length ? ` [Engraving ×${it.engraving.engravingLines.length} lines]` : ' [Engraving]') : ''}`).join(', ') || 'N/A'}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2.5 px-4 rounded-xl text-xs">Cancel</button>
              <button onClick={createAndSend} disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-5 rounded-xl text-xs flex items-center gap-1 disabled:opacity-50">
                <Send size={14} /> {creating ? 'Creating...' : 'Create Order & Send to Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaisalReplacements;
