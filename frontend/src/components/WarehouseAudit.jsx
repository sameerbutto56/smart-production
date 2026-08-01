import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  ClipboardCheck, Package, Building2, Search, PlusCircle, Play, X, RefreshCcw,
  CheckCircle2, AlertTriangle, ArrowLeft, ScanLine, Printer, Minus, Plus, History, Eye, Clock, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';

const STATUS_STYLES = {
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  SUBMITTED: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/40',
};

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;

const diffStyle = (d) => {
  if (d === 0) return { dot: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  if (d > 0) return { dot: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
  return { dot: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/40' };
};

// Lightweight WebAudio beep — success tick on a matched scan, low buzz on a miss.
let audioCtx = null;
const beep = (ok) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = ok ? 'sine' : 'square';
    o.frequency.value = ok ? 880 : 200;
    g.gain.setValueAtTime(ok ? 0.05 : 0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    o.start();
    o.stop(audioCtx.currentTime + 0.16);
  } catch {}
};

// Mirrors backend computeAuditSummary — recomputed locally per scan so header
// cards (Scanned / Matched / Missing / Extra / Difference Value) always match the table.
const computeLocalSummary = (items) => {
  let scannedCount = 0, matchedCount = 0, missingCount = 0, extraCount = 0, differenceValue = 0;
  for (const it of items) {
    const d = (it.physicalQty || 0) - (it.systemQty || 0);
    if (it.scanned) scannedCount++;
    if (d === 0) matchedCount++;
    else if (d > 0) { extraCount++; differenceValue += d * (it.price || 0); }
    else { missingCount++; differenceValue += Math.abs(d) * (it.price || 0); }
  }
  return { scannedCount, matchedCount, missingCount, extraCount, differenceValue };
};

const WarehouseAudit = () => {
  const { user } = useAuth();
  const [view, setView] = useState('history'); // history | start | active | detail
  const [audits, setAudits] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAudit, setActiveAudit] = useState(null);
  const [detailAudit, setDetailAudit] = useState(null);

  // start wizard
  const [auditType, setAuditType] = useState('WAREHOUSE');
  const [outletName, setOutletName] = useState('');
  const [notes, setNotes] = useState('');
  const [starting, setStarting] = useState(false);

  // live scanning
  const [barcode, setBarcode] = useState('');
  const [manualQty, setManualQty] = useState({});
  const [itemSearch, setItemSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const scanRef = useRef(null);
  const barcodeMapRef = useRef(new Map());
  const lastScannedRef = useRef(null);
  const pendingScanRef = useRef([]);
  const flushingRef = useRef(false);
  const flushTimerRef = useRef(null);
  const activeAuditIdRef = useRef(null);

  const loadStats = useCallback(() => {
    api.get('/api/audit/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const loadAudits = useCallback(() => {
    setLoading(true);
    api.get('/api/audit').then(r => setAudits(r.data)).catch(e => toast.error(e.response?.data?.message || 'Failed to load audits')).finally(() => setLoading(false));
  }, []);

  // In-memory barcode → itemId lookup. Barcodes never change during an audit, so
  // this is built once per audit open and scanning is a pure Map.get() — POS speed.
  const buildBarcodeMap = useCallback((items) => {
    const map = new Map();
    (items || []).forEach(it => {
      if (it.barcode) map.set(String(it.barcode).trim().toLowerCase(), it.id);
    });
    barcodeMapRef.current = map;
  }, []);

  // Background batched sync — scans accumulate in memory and flush to the server
  // in a single request (debounced 350ms, or immediately at 20 scans). The UI
  // never awaits a database write; a failure simply requeues the events.
  const flushScans = useCallback(async () => {
    if (flushingRef.current) return;
    const auditId = activeAuditIdRef.current;
    if (!auditId) return;
    flushingRef.current = true;
    try {
      while (pendingScanRef.current.length > 0) {
        const events = pendingScanRef.current;
        pendingScanRef.current = [];
        setPendingCount(0);
        try {
          await api.post(`/api/audit/${auditId}/batch-scan`, { scans: events.map(itemId => ({ itemId })) });
        } catch (err) {
          pendingScanRef.current = [...events, ...pendingScanRef.current];
          setPendingCount(pendingScanRef.current.length);
          break;
        }
      }
    } finally {
      flushingRef.current = false;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (pendingScanRef.current.length > 0) {
        flushTimerRef.current = setTimeout(() => { flushTimerRef.current = null; flushScans(); }, 350);
      }
    }
  }, []);

  const queueScan = useCallback((itemId) => {
    pendingScanRef.current.push(itemId);
    setPendingCount(pendingScanRef.current.length);
    if (pendingScanRef.current.length >= 20) { flushScans(); }
    else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => { flushTimerRef.current = null; flushScans(); }, 350);
    }
  }, [flushScans]);

  // Drain the queue before submitting so every scan is persisted (retry loop).
  const forceFlush = useCallback(async () => {
    for (let i = 0; i < 4; i++) {
      while (flushingRef.current) await new Promise(r => setTimeout(r, 100));
      if (pendingScanRef.current.length === 0) return true;
      await flushScans();
      if (pendingScanRef.current.length === 0) return true;
      await new Promise(r => setTimeout(r, 350));
    }
    return pendingScanRef.current.length === 0;
  }, [flushScans]);

  const goBack = () => {
    if (!flushingRef.current && pendingScanRef.current.length > 0 && activeAuditIdRef.current) flushScans();
    pendingScanRef.current = [];
    setPendingCount(0);
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    activeAuditIdRef.current = null;
    setActiveAudit(null); setDetailAudit(null); setView('history');
  };

  // If focus lands on a non-interactive element (e.g. a stray click on the page),
  // Enter returns it to the barcode field so scanning never requires the mouse.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      const ae = document.activeElement;
      const isScan = ae === scanRef.current;
      const interactive = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.tagName === 'BUTTON' || ae.isContentEditable);
      if (!isScan && !interactive) scanRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    loadStats();
    loadAudits();
  }, [loadStats, loadAudits]);

  const openAudit = async (id) => {
    try {
      const res = await api.get(`/api/audit/${id}`);
      setActiveAudit(res.data);
      activeAuditIdRef.current = id;
      lastScannedRef.current = null;
      buildBarcodeMap(res.data.items);
      setView(res.data.status === 'IN_PROGRESS' ? 'active' : 'detail');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to open audit');
    }
  };

  const startAudit = async () => {
    if (auditType === 'OUTLET' && !outletName) { toast.error('Select an outlet'); return; }
    setStarting(true);
    try {
      const res = await api.post('/api/audit', { type: auditType, outletName: auditType === 'OUTLET' ? outletName : undefined, notes });
      setActiveAudit(res.data);
      activeAuditIdRef.current = res.data.id;
      lastScannedRef.current = null;
      buildBarcodeMap(res.data.items);
      setAuditType('WAREHOUSE'); setOutletName(''); setNotes(''); setBarcode('');
      setView('active');
      loadAudits();
      loadStats();
      toast.success(`Audit ${res.data.auditNumber} started — snapshot created`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start audit');
    } finally { setStarting(false); }
  };

  const handleScan = (e) => {
    e?.preventDefault();
    const code = barcode.trim();
    if (!code) { scanRef.current?.focus(); return; }
    const itemId = barcodeMapRef.current.get(code.toLowerCase());
    if (!itemId) {
      beep(false);
      toast.error('Barcode not found.');
      setBarcode('');
      scanRef.current?.focus();
      return;
    }
    beep(true);
    setActiveAudit(a => {
      let captured = null;
      const items = a.items.map(it => {
        if (it.id !== itemId) return it;
        const newQty = (it.physicalQty || 0) + 1;
        captured = { ...it, physicalQty: newQty, scanned: true, difference: newQty - (it.systemQty || 0) };
        return captured;
      });
      if (!captured) return a;
      lastScannedRef.current = captured;
      return { ...a, items, ...computeLocalSummary(items) };
    });
    setManualQty(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    setBarcode('');
    scanRef.current?.focus();
    queueScan(itemId);
  };

  const updateManualQty = async (itemId, qty) => {
    try {
      const res = await api.post(`/api/audit/${activeAudit.id}/items/${itemId}`, { physicalQty: qty });
      setActiveAudit(res.data);
      setManualQty(prev => ({ ...prev, [itemId]: qty }));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update quantity');
    }
  };

  const submitAudit = async () => {
    if (!window.confirm(`Submit audit ${activeAudit.auditNumber}? It becomes read-only and moves to Admin review.`)) return;
    setSubmitting(true);
    try {
      const synced = await forceFlush();
      if (!synced) { toast.error('Could not sync all scanned counts — please retry'); setSubmitting(false); return; }
      const items = activeAudit?.items || [];
      const finalCounts = {};
      items.forEach(it => { if (it.scanned || it.physicalQty) finalCounts[it.id] = it.physicalQty || 0; });
      const res = await api.post(`/api/audit/${activeAudit.id}/submit`, { finalCounts });
      setActiveAudit(res.data);
      setView('detail');
      loadAudits();
      loadStats();
      toast.success('Audit submitted for Admin review');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit audit');
    } finally { setSubmitting(false); }
  };

  const printAudit = () => {
    if (!activeAudit && !detailAudit) return;
    const a = activeAudit || detailAudit;
    const items = (a.items || []).filter(i => i.scanned);
    const rows = items.map((i, idx) => {
      const ds = diffStyle(i.difference);
      return `<tr>
        <td style="padding:8px 10px;font-size:13px;font-weight:700;color:#000;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:8px 10px;font-size:14px;font-weight:900;color:#000;border-bottom:1px solid #eee;">${i.productName}</td>
        <td style="padding:8px 10px;font-size:13px;font-weight:700;color:#000;border-bottom:1px solid #eee;">${i.color || '-'}</td>
        <td style="padding:8px 10px;font-size:13px;font-weight:700;color:#000;border-bottom:1px solid #eee;">${i.size || '-'}</td>
        <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:center;color:#000;border-bottom:1px solid #eee;">${i.barcode || '-'}</td>
        <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:center;color:#000;border-bottom:1px solid #eee;">${i.systemQty}</td>
        <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:center;color:#000;border-bottom:1px solid #eee;">${i.physicalQty}</td>
        <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:center;color:${i.difference === 0 ? '#059669' : i.difference > 0 ? '#d97706' : '#dc2626'};border-bottom:1px solid #eee;">${i.difference > 0 ? '+' : ''}${i.difference}</td>
      </tr>`;
    }).join('');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Audit Report ${a.auditNumber}</title>
      <style>@page{margin:15mm 10mm;}*{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#000;padding:20px;font-size:14px;}
      h1{font-size:22px;font-weight:900;margin-bottom:4px;}h2{font-size:13px;font-weight:700;color:#555;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;}th{background:#111827;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase;padding:8px 10px;text-align:left;}
      .meta{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;font-size:13px;font-weight:700;color:#333;}
      .sum{display:flex;gap:24px;margin:12px 0 16px;}h3{font-size:14px;font-weight:900;margin-bottom:8px;}</style></head><body>
      <h1>ENAMELS — Inventory Audit Report</h1>
      <h2>${a.auditNumber} • ${a.type === 'OUTLET' ? a.outletName : 'Warehouse'} • ${new Date(a.createdAt).toLocaleString()}</h2>
      <div class="meta">
        <span>Auditor: ${a.createdBy || '-'}</span>
        <span>Total Variants: ${a.totalVariants}</span>
        <span>Scanned: ${a.scannedCount}</span>
        <span>Matched: ${a.matchedCount}</span>
        <span>Missing: ${a.missingCount}</span>
        <span>Extra: ${a.extraCount}</span>
        <span>Difference Value: ${fmt(a.differenceValue)}</span>
      </div>
      <table><thead><tr><th>#</th><th>Product</th><th>Color</th><th>Size</th><th>Barcode</th><th>System</th><th>Physical</th><th>Diff</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  // ─── History view ───
  if (view === 'history') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-2xl font-black theme-text-primary tracking-tight">Inventory Audit</h2>
            <p className="theme-text-secondary text-xs font-bold uppercase tracking-widest">Verify physical stock against system stock — updates apply only after Admin approval</p>
          </div>
          <button onClick={() => setView('start')} className="bg-amber-600 hover:bg-amber-500 text-white font-black py-3 px-6 rounded-2xl transition-all flex items-center gap-2 active:scale-95 shadow-lg">
            <PlusCircle size={16} /> Start New Audit
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass p-4 rounded-2xl border-2 border-amber-500/20">
              <p className="text-2xl font-black text-amber-400">{stats.pending}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Pending Admin Review</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-emerald-500/20">
              <p className="text-2xl font-black text-emerald-400">{stats.approved}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Approved</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-red-500/20">
              <p className="text-2xl font-black text-red-400">{stats.rejected}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Rejected</p>
            </div>
            <div className="glass p-4 rounded-2xl border-2 border-gray-700/50">
              <p className="text-2xl font-black theme-text-primary">{stats.inProgress}</p>
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">In Progress</p>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50">
            <div className="flex items-center gap-2">
              <History size={16} className="theme-text-muted" />
              <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Audit History</span>
            </div>
            <button onClick={() => { loadAudits(); loadStats(); }} className="p-2 hover:bg-gray-800 rounded-lg"><RefreshCcw size={14} className="text-gray-400" /></button>
          </div>
          {loading ? <PageLoader text="Loading audits..." /> : audits.length === 0 ? (
            <p className="text-center text-sm font-bold theme-text-muted py-10">No audits yet — start your first inventory audit</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50">
                    <th className="px-5 py-3 text-left">Audit #</th>
                    <th className="px-5 py-3 text-left">Type</th>
                    <th className="px-5 py-3 text-left">Variants</th>
                    <th className="px-5 py-3 text-left">Diff Value</th>
                    <th className="px-5 py-3 text-left">Auditor</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map(a => (
                    <tr key={a.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                      <td className="px-5 py-3 font-black theme-text-primary">{a.auditNumber}</td>
                      <td className="px-5 py-3 text-gray-300 font-bold">
                        {a.type === 'OUTLET' ? <><Building2 size={12} className="inline mr-1 text-purple-400" />{a.outletName}</> : <><Package size={12} className="inline mr-1 text-amber-400" />Warehouse</>}
                      </td>
                      <td className="px-5 py-3 text-gray-300 font-bold">{a.totalVariants}</td>
                      <td className="px-5 py-3 font-black text-orange-400">{fmt(a.differenceValue)}</td>
                      <td className="px-5 py-3 text-gray-300 font-bold">{a.createdBy}</td>
                      <td className="px-5 py-3 text-gray-400 font-bold text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3"><span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${STATUS_STYLES[a.status]}`}>{a.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-3">
                        <button onClick={() => openAudit(a.id)} className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-black text-xs uppercase"><Eye size={13} /> Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Start wizard ───
  if (view === 'start') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('history')} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800"><ArrowLeft size={16} className="text-gray-400" /></button>
          <div>
            <h2 className="text-lg md:text-2xl font-black theme-text-primary">Start New Audit</h2>
            <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">A read-only snapshot is created the moment the audit starts</p>
          </div>
        </div>

        <div className="glass rounded-2xl border-2 theme-border p-5 space-y-5">
          <div>
            <p className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2">Audit Type</p>
            <div className="grid grid-cols-2 gap-3">
              {['WAREHOUSE', 'OUTLET'].map(t => (
                <button key={t} onClick={() => setAuditType(t)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${auditType === t ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 hover:border-gray-500'}`}>
                  <p className="text-sm font-black theme-text-primary">{t === 'WAREHOUSE' ? 'Warehouse' : 'Outlet'}</p>
                  <p className="text-[10px] font-bold theme-text-muted mt-1 uppercase tracking-wider">
                    {t === 'WAREHOUSE' ? 'Audit warehouse inventory variants' : 'Audit a specific outlet inventory'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {auditType === 'OUTLET' && (
            <div>
              <p className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2">Select Outlet</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {OUTLETS.map(o => (
                  <button key={o} onClick={() => setOutletName(o)}
                    className={`p-3 rounded-xl border-2 text-sm font-black transition-all ${outletName === o ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-gray-700 hover:border-gray-500'}`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2">Notes (optional)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setView('history')} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
            <button onClick={startAudit} disabled={starting}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              {starting ? <RefreshCcw size={14} className="animate-spin" /> : <Play size={14} />} Start Audit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active / Detail view ───
  const audit = activeAudit || detailAudit;
  if (!audit) return <PageLoader text="Loading audit..." />;
  const isActive = audit.status === 'IN_PROGRESS';
  const items = (audit.items || []);
  const filteredItems = itemSearch
    ? items.filter(i => (i.productName || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.color || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.size || '').toLowerCase().includes(itemSearch.toLowerCase()) || (i.barcode || '').toLowerCase().includes(itemSearch.toLowerCase()))
    : items;
  const totalVariants = audit.totalVariants || items.length;
  const progressPct = totalVariants > 0 ? Math.round(((audit.scannedCount || 0) / totalVariants) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800"><ArrowLeft size={16} className="text-gray-400" /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-2xl font-black theme-text-primary">{audit.auditNumber}</h2>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${STATUS_STYLES[audit.status]}`}>{audit.status.replace('_', ' ')}</span>
            </div>
            <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">
              {audit.type === 'OUTLET' ? <><Building2 size={11} className="inline mr-1" />{audit.outletName}</> : <><Package size={11} className="inline mr-1" />Warehouse</>} • {new Date(audit.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={printAudit} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"><Printer size={14} /> Print</button>
          {isActive && (
            <button onClick={submitAudit} disabled={submitting} className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              {submitting ? <RefreshCcw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submit Audit
            </button>
          )}
        </div>
      </div>

      {/* Snapshot header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass p-4 rounded-2xl border-2 theme-border">
          <p className="text-2xl font-black theme-text-primary">{totalVariants}</p>
          <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Total Variants</p>
        </div>
        <div className="glass p-4 rounded-2xl border-2 theme-border">
          <p className="text-2xl font-black theme-text-primary">{audit.totalStock}</p>
          <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Snapshot Stock</p>
        </div>
        <div className="glass p-4 rounded-2xl border-2 border-blue-500/20">
          <p className="text-2xl font-black text-blue-400">{audit.scannedCount || 0}</p>
          <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Scanned</p>
        </div>
        <div className="glass p-4 rounded-2xl border-2 border-gray-700/50">
          <p className="text-2xl font-black text-gray-300">{Math.max(0, totalVariants - (audit.scannedCount || 0))}</p>
          <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mt-1">Remaining</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="glass rounded-2xl border-2 theme-border p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Audit Progress</span>
          <span className="text-xs font-black text-purple-400">{progressPct}% Completed</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-600 to-amber-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"><CheckCircle2 size={11} /> Matched: {audit.matchedCount || 0}</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40"><AlertTriangle size={11} /> Missing: {audit.missingCount || 0}</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"><AlertTriangle size={11} /> Extra: {audit.extraCount || 0}</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/40">Difference Value: {fmt(audit.differenceValue)}</span>
        </div>
      </div>

      {/* Scanner */}
      {isActive && (
        <div className="glass rounded-2xl border-2 border-purple-500/30 p-4">
          <form onSubmit={handleScan} className="flex gap-3">
            <div className="flex-1 relative">
              <ScanLine size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
              <input ref={scanRef} value={barcode} onChange={e => setBarcode(e.target.value)} autoFocus
                placeholder="Scan barcode → physical count +1"
                className="w-full bg-gray-900 border-2 border-gray-800 rounded-xl pl-12 pr-4 py-3.5 text-sm font-black text-white outline-none focus:border-purple-500" />
            </div>
            <button type="submit" disabled={!barcode.trim()} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <ScanLine size={14} /> Scan
            </button>
          </form>
          {pendingCount > 0 && (
            <p className="mt-2 text-[10px] font-bold text-amber-400 flex items-center gap-1">
              <RefreshCcw size={10} className="animate-spin" /> Syncing {pendingCount} scan(s)…
            </p>
          )}
          {lastScannedRef.current && (
            <div className="mt-3 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-emerald-400 truncate">{lastScannedRef.current.productName} <span className="text-gray-400">({lastScannedRef.current.color || '—'} {lastScannedRef.current.size || '—'})</span></p>
                <p className="text-[10px] font-bold text-gray-500">{lastScannedRef.current.barcode} • count {lastScannedRef.current.physicalQty}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live comparison grid */}
      <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 px-5 py-4 border-b border-gray-800/50">
          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Variant-Level Comparison</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search product / color / size / barcode"
              className="bg-gray-900 border-2 border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-purple-500 w-full md:w-72" />
          </div>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Color</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-left">Barcode</th>
                <th className="px-4 py-3 text-center">System</th>
                <th className="px-4 py-3 text-center">Physical</th>
                <th className="px-4 py-3 text-center">Diff</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(i => {
                const ds = diffStyle(i.difference);
                return (
                  <tr key={i.id} className={`border-b border-gray-800/40 ${i.scanned ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-2.5 font-black theme-text-primary">{i.productName}</td>
                    <td className="px-4 py-2.5 text-gray-300 font-bold">{i.color || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-300 font-bold">{i.size || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-bold text-xs">{i.barcode || '—'}</td>
                    <td className="px-4 py-2.5 text-center font-black text-gray-300">{i.systemQty}</td>
                    <td className="px-4 py-2.5 text-center">
                      {isActive ? (
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => updateManualQty(i.id, Math.max(0, (i.physicalQty || 0) - 1))} className="p-1 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300"><Minus size={12} /></button>
                          <input type="number" value={manualQty[i.id] ?? i.physicalQty ?? 0} min={0}
                            onChange={e => { const v = Number(e.target.value); if (!isNaN(v) && v >= 0) updateManualQty(i.id, v); }}
                            className="w-14 bg-gray-900 border border-gray-700 rounded-md text-center text-sm font-black text-white outline-none focus:border-purple-500 py-1" />
                          <button onClick={() => updateManualQty(i.id, (i.physicalQty || 0) + 1)} className="p-1 bg-gray-800 hover:bg-gray-700 rounded-md text-gray-300"><Plus size={12} /></button>
                        </div>
                      ) : (
                        <span className="font-black theme-text-primary">{i.physicalQty}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-black ${ds.text}`}>
                        <span className={`w-2 h-2 rounded-full ${ds.dot}`} />
                        {i.difference > 0 ? `+${i.difference}` : i.difference}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-bold text-gray-500">No variants match your search</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustments (approved audits) */}
      {audit.status === 'APPROVED' && (audit.adjustments?.length > 0) && (
        <div className="glass rounded-2xl border-2 border-emerald-500/30 p-4">
          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">Automatic Inventory Adjustments Applied</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50">
                <th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-left">Color/Size</th>
                <th className="px-3 py-2 text-center">Previous</th><th className="px-3 py-2 text-center">New</th>
                <th className="px-3 py-2 text-center">Diff</th><th className="px-3 py-2 text-left">Approved By</th>
              </tr></thead>
              <tbody>
                {audit.adjustments.map(adj => (
                  <tr key={adj.id} className="border-b border-gray-800/40">
                    <td className="px-3 py-2 font-black theme-text-primary">{adj.productName}</td>
                    <td className="px-3 py-2 text-gray-300 font-bold">{adj.color || '—'} / {adj.size || '—'}</td>
                    <td className="px-3 py-2 text-center font-black text-gray-300">{adj.previousQty}</td>
                    <td className="px-3 py-2 text-center font-black text-emerald-400">{adj.newQty}</td>
                    <td className={`px-3 py-2 text-center font-black ${adj.difference > 0 ? 'text-yellow-400' : 'text-red-400'}`}>{adj.difference > 0 ? `+${adj.difference}` : adj.difference}</td>
                    <td className="px-3 py-2 text-gray-400 font-bold text-xs"><User size={11} className="inline mr-1" />{adj.approvedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isActive && audit.approvedBy && (
        <p className="text-xs font-bold theme-text-muted">Approved by <span className="text-emerald-400">{audit.approvedBy}</span> on {new Date(audit.approvedAt).toLocaleString()}</p>
      )}
      {audit.status === 'REJECTED' && (
        <p className="text-xs font-bold text-red-400">Rejected by {audit.rejectedBy} on {audit.rejectedAt && new Date(audit.rejectedAt).toLocaleString()}{audit.rejectionReason ? ` — ${audit.rejectionReason}` : ''}</p>
      )}
      <p className="text-[10px] font-bold theme-text-muted flex items-center gap-1"><Clock size={11} /> Auditor: {audit.createdBy}</p>
    </div>
  );
};

export default WarehouseAudit;
