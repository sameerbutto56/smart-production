import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowRightLeft, ArrowUp, ArrowDown, Plus, Minus, X, Search, ChevronDown, ChevronUp, Printer, Package, Barcode, CheckCircle, XCircle, Truck, Send, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const DESTINATIONS = [...OUTLETS, 'Warehouse'];
const DISPATCH_METHODS = [
  { value: 'RIDER', label: 'Delivery Rider' },
  { value: 'CUSTOMER', label: 'Customer Pickup' },
  { value: 'COURIER', label: 'Courier' },
];

const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';

const statusStyles = {
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  DISPATCHED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  APPROVED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusIcons = {
  PENDING: Clock, APPROVED: CheckCircle, REJECTED: XCircle, DISPATCHED: Truck, COMPLETED: Package, CANCELLED: XCircle,
};

const OutletTransfers = () => {
  const { user } = useAuth();
  const isWarehouse = user?.role === 'STORE';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const userOutlet = user?.role === 'OUTLET' ? user?.name : (isWarehouse ? 'Warehouse' : null);
  const canCreate = userOutlet || isAdmin;

  const [transfers, setTransfers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('list');
  const [filterTab, setFilterTab] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // New transfer form state
  const [destOutlet, setDestOutlet] = useState('');
  const [notes, setNotes] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState('RIDER');
  const [transferItems, setTransferItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [sourceInventory, setSourceInventory] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Dispatch modal
  const [dispatchModal, setDispatchModal] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        api.get('/api/transfers'),
        api.get('/api/transfers/stats')
      ]);
      setTransfers(tRes.data);
      setStats(sRes.data);
    } catch (e) {
      toast.error(`Failed to load: ${e.response?.data?.message || e.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchSourceInventory = useCallback(async () => {
    if (!userOutlet) return;
    try {
      const res = await api.get(`/api/pos/products?skipCache=true&outlet=${encodeURIComponent(userOutlet)}`);
      setSourceInventory(res.data);
    } catch {
      toast.error('Failed to load inventory');
    }
  }, [userOutlet]);

  useEffect(() => { if (tab === 'new' && userOutlet) fetchSourceInventory(); }, [tab, userOutlet, fetchSourceInventory]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return sourceInventory;
    const q = searchTerm.toLowerCase();
    return sourceInventory.filter(i => i.name.toLowerCase().includes(q) || (i.barcode && i.barcode.toLowerCase().includes(q)));
  }, [sourceInventory, searchTerm]);

  const groupedInventory = useMemo(() => {
    const groups = {};
    filteredInventory.forEach(item => {
      if (!groups[item.name]) groups[item.name] = [];
      groups[item.name].push(item);
    });
    return Object.entries(groups);
  }, [filteredInventory]);

  const addTransferItem = (item) => {
    const existing = transferItems.find(t => t.variantId === item.id);
    if (existing) {
      setTransferItems(transferItems.map(t => t.variantId === item.id ? { ...t, qty: Math.min(t.qty + 1, t.maxQty) } : t));
    } else {
      setTransferItems([...transferItems, {
        variantId: item.id, productName: item.name, color: item.color,
        size: item.size, barcode: item.barcode, maxQty: item.stock, qty: 1
      }]);
    }
  };

  const updateQty = (key, qty) => {
    if (qty < 1) return;
    setTransferItems(transferItems.map(t => t.variantId === key ? { ...t, qty: Math.min(qty, t.maxQty) } : t));
  };

  const removeTransferItem = (key) => setTransferItems(transferItems.filter(t => t.variantId !== key));

  const handleBarcodeLookup = (code) => {
    if (!code) return;
    code = code.trim();
    const v = sourceInventory.find(i => i.barcode && i.barcode.toUpperCase() === code.toUpperCase());
    if (!v) return toast.error(`Barcode not found: ${code}`);
    if (v.stock < 1) return toast.error(`"${v.name}" is out of stock`);
    addTransferItem(v);
    toast.success(`${v.name} added`);
  };

  const handleCreateTransfer = async () => {
    if (!destOutlet) return toast.error('Select destination');
    if (transferItems.length === 0) return toast.error('Add at least one item');
    setSubmitting(true);
    try {
      await api.post('/api/transfers', {
        toOutlet: destOutlet,
        items: transferItems.map(t => ({ variantId: t.variantId, quantity: t.qty })),
        dispatchMethod,
        notes: notes || null
      });
      toast.success('Transfer request created!');
      setDestOutlet(''); setNotes(''); setTransferItems([]);
      setTab('list');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer');
    }
    setSubmitting(false);
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await api.patch(`/api/transfers/${id}/approve`);
      toast.success('Transfer approved!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    } finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await api.patch(`/api/transfers/${rejectModal.id}/reject`, { reason: rejectReason });
      toast.success('Transfer rejected');
      setRejectModal(null); setRejectReason('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    } finally { setActionLoading(null); }
  };

  const handleDispatch = async (id, method) => {
    setActionLoading(id);
    try {
      await api.patch(`/api/transfers/${id}/dispatch`, { dispatchMethod: method });
      toast.success('Stock dispatched!');
      setDispatchModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed');
    } finally { setActionLoading(null); }
  };

  const handleAccept = async (id) => {
    setActionLoading(id);
    try {
      await api.patch(`/api/transfers/${id}/accept`);
      toast.success('Stock accepted! Inventory updated.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Accept failed');
    } finally { setActionLoading(null); }
  };

  const handleCancel = async (id) => {
    setActionLoading(id);
    try {
      await api.put(`/api/transfers/${id}/cancel`);
      toast.success('Transfer cancelled');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    } finally { setActionLoading(null); }
  };

  const printTransferSlip = (transfer) => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer Slip</title><style>
      @page{margin:10mm;size:A4}body{font-family:'Courier New',monospace;font-size:14px;color:#000}
      .header{text-align:center;margin-bottom:16px;padding-bottom:8px;border-bottom:3px solid #000}
      .header h1{font-size:32px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#000;color:#fff;font-size:12px;padding:8px;text-align:left}
      td{padding:8px;border-bottom:1px solid #ccc;font-size:13px}.right{text-align:right}
      .meta{margin:10px 0;padding:10px;border:2px solid #000;border-radius:6px}.meta p{margin:4px 0;font-size:14px}
    </style></head><body>`);
    win.document.write(getPrintLogoHTML());
    win.document.write(`<div class="header"><h1>TRANSFER SLIP</h1></div>`);
    win.document.write(`<div class="meta">`);
    win.document.write(`<p><strong>Transfer #:</strong> ${transfer.transferNumber}</p>`);
    win.document.write(`<p><strong>From:</strong> ${transfer.fromOutlet} → <strong>To:</strong> ${transfer.toOutlet}</p>`);
    win.document.write(`<p><strong>Date:</strong> ${formatDate(transfer.createdAt)}</p>`);
    win.document.write(`<p><strong>Status:</strong> ${transfer.status}</p>`);
    if (transfer.dispatchMethod) win.document.write(`<p><strong>Method:</strong> ${transfer.dispatchMethod}</p>`);
    if (transfer.notes) win.document.write(`<p><strong>Notes:</strong> ${transfer.notes}</p>`);
    win.document.write(`</div>`);
    win.document.write(`<table><thead><tr><th>#</th><th>Product</th><th>Color</th><th>Size</th><th class="right">Qty</th></tr></thead><tbody>`);
    (transfer.items || []).forEach((item, idx) => {
      win.document.write(`<tr><td>${idx + 1}</td><td>${item.productName}</td><td>${item.color || '—'}</td><td>${item.size || '—'}</td><td class="right">${item.approvedQty || item.quantity}</td></tr>`);
    });
    win.document.write(`</tbody></table>`);
    win.document.write(getPrintFooterHTML());
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 200);
  };

  const getTimeline = (t) => {
    const entries = [];
    entries.push({ label: 'Requested', date: t.createdAt, by: t.requestedByName, color: 'text-blue-400' });
    if (t.status === 'APPROVED' || t.status === 'DISPATCHED' || t.status === 'COMPLETED') {
      entries.push({ label: 'Approved', date: t.approvedAt, color: 'text-purple-400' });
    }
    if (t.status === 'REJECTED') {
      entries.push({ label: `Rejected${t.rejectionReason ? ': ' + t.rejectionReason : ''}`, date: t.rejectedAt, color: 'text-red-400' });
    }
    if (t.status === 'DISPATCHED' || t.status === 'COMPLETED') {
      entries.push({ label: `Dispatched${t.dispatchMethod ? ' (' + t.dispatchMethod + ')' : ''}`, date: t.dispatchedAt, color: 'text-blue-400' });
    }
    if (t.status === 'COMPLETED') {
      entries.push({ label: 'Accepted', date: t.completedAt, color: 'text-emerald-400' });
    }
    if (t.status === 'CANCELLED') {
      entries.push({ label: 'Cancelled', color: 'text-red-400' });
    }
    return entries;
  };

  const isIncoming = (t) => t.toOutlet === userOutlet || (isWarehouse && t.toOutlet === 'Warehouse');
  const isOutgoing = (t) => t.fromOutlet === userOutlet || (isWarehouse && t.fromOutlet === 'Warehouse');
  const isSource = (t) => isOutgoing(t);

  const canApproveReject = (t) => {
    if (t.status !== 'PENDING') return false;
    if (t.type === 'OUTLET_WAREHOUSE' || t.type === 'WAREHOUSE_OUTLET') return isWarehouse || isAdmin;
    return isSource(t);
  };

  const filteredTransfers = useMemo(() => {
    const incoming = (t) => t.toOutlet === userOutlet || (isWarehouse && t.toOutlet === 'Warehouse');
    const outgoing = (t) => t.fromOutlet === userOutlet || (isWarehouse && t.fromOutlet === 'Warehouse');
    let list = transfers;
    if (filterTab === 'incoming') list = list.filter(incoming);
    else if (filterTab === 'outgoing') list = list.filter(outgoing);
    return list;
  }, [transfers, filterTab, userOutlet, isWarehouse]);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <ArrowRightLeft size={24} />{isWarehouse ? 'Warehouse Transfers' : 'Outlet Transfers'}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Transfers</button>
          {canCreate && (
            <button onClick={() => setTab('new')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'new' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>+ New Request</button>
          )}
        </div>
      </div>

      {tab === 'list' && (
        <div className="space-y-3">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[['Total', stats.total], ['Pending', stats.PENDING], ['Approved', stats.APPROVED], ['Dispatched', stats.DISPATCHED], ['Completed', stats.COMPLETED], ['Rejected', stats.REJECTED]].map(([label, count]) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-2 text-center">
                <p className="text-lg font-black text-white">{count || 0}</p>
                <p className="text-[9px] font-bold text-gray-500 uppercase">{label}</p>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {[['all', 'All'], ['incoming', 'Incoming'], ['outgoing', 'Outgoing']].map(([key, label]) => (
              <button key={key} onClick={() => setFilterTab(key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black ${filterTab === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-center text-gray-500 py-8 font-bold">Loading...</p>
          ) : filteredTransfers.length === 0 ? (
            <p className="text-center text-gray-500 py-8 font-bold">No transfers found</p>
          ) : filteredTransfers.map(t => {
            const incoming = isIncoming(t);
            const StatusIcon = statusIcons[t.status] || Clock;
            return (
              <div key={t.id} className="bg-gray-900 border-2 border-gray-800 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${incoming ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      {incoming ? <ArrowDown size={16} className="text-emerald-400" /> : <ArrowUp size={16} className="text-red-400" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{t.transferNumber}</p>
                      <p className="text-[10px] text-gray-500">{t.fromOutlet} → {t.toOutlet}{t.type === 'OUTLET_WAREHOUSE' ? ' 🏭' : ''}</p>
                      <p className="text-[10px] text-gray-600">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border flex items-center gap-1 ${statusStyles[t.status] || ''}`}>
                      <StatusIcon size={10} />{t.status}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{t.totalItems} items</span>
                    {expandedId === t.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  </div>
                </button>

                {expandedId === t.id && (
                  <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                    {/* Items Table */}
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-500 font-bold uppercase">
                        <th className="text-left py-1">Product</th><th className="text-left">Color</th><th className="text-left">Size</th><th className="text-right">Requested</th><th className="text-right">Approved</th>
                      </tr></thead>
                      <tbody>
                        {(t.items || []).map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-800">
                            <td className="py-1.5 font-bold text-white">{item.productName}</td>
                            <td className="py-1.5 text-gray-400">{item.color || '—'}</td>
                            <td className="py-1.5 text-gray-400">{item.size || '—'}</td>
                            <td className="py-1.5 text-right font-bold text-white">{item.quantity}</td>
                            <td className="py-1.5 text-right font-bold text-purple-400">{item.approvedQty || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {t.notes && <p className="text-xs text-gray-500 italic">Notes: {t.notes}</p>}
                    {t.rejectionReason && <p className="text-xs text-red-400 italic">Rejection reason: {t.rejectionReason}</p>}
                    {t.dispatchMethod && <p className="text-xs text-gray-400">Dispatch: <span className="text-white font-bold">{t.dispatchMethod}</span></p>}

                    {/* Timeline */}
                    <div className="border-t border-gray-800 pt-2">
                      <p className="text-[10px] font-black text-gray-500 uppercase mb-1">Timeline</p>
                      <div className="flex flex-wrap gap-3">
                        {getTimeline(t).map((entry, i) => (
                          <div key={i} className={`text-[10px] ${entry.color}`}>
                            <span className="font-black">{entry.label}</span>
                            {entry.date && <span className="text-gray-600 ml-1">{formatDate(entry.date)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button onClick={() => printTransferSlip(t)} className="text-[10px] font-bold text-blue-400 bg-gray-800 px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <Printer size={12} />Print
                      </button>

                      {/* Source actions: Approve/Reject PENDING */}
                      {canApproveReject(t) && (
                        <>
                          <button onClick={() => handleApprove(t.id)} disabled={actionLoading === t.id}
                            className="text-[10px] font-black text-white bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-lg disabled:opacity-50">
                            {actionLoading === t.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button onClick={() => setRejectModal(t)} className="text-[10px] font-black text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg">
                            Reject
                          </button>
                        </>
                      )}

                      {/* Source actions: Dispatch APPROVED */}
                      {t.status === 'APPROVED' && isSource(t) && (
                        <button onClick={() => setDispatchModal(t)} className="text-[10px] font-black text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Truck size={12} />Dispatch
                        </button>
                      )}

                      {/* Destination actions: Accept DISPATCHED */}
                      {t.status === 'DISPATCHED' && isIncoming(t) && (
                        <button onClick={() => handleAccept(t.id)} disabled={actionLoading === t.id}
                          className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg disabled:opacity-50">
                          {actionLoading === t.id ? 'Accepting...' : 'Receive & Accept'}
                        </button>
                      )}

                      {/* Cancel */}
                      {['PENDING', 'APPROVED'].includes(t.status) && t.requestedByName === user?.name && (
                        <button onClick={() => handleCancel(t.id)} disabled={actionLoading === t.id}
                          className="text-[10px] font-bold text-red-400 bg-gray-800 px-3 py-1.5 rounded-lg disabled:opacity-50">
                          Cancel
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

      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><Send size={16} />Create Transfer Request</h2>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Destination</label>
              <select value={destOutlet} onChange={e => setDestOutlet(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none">
                <option value="">Select destination...</option>
                {DESTINATIONS.filter(o => o !== userOutlet).map(o => (
                  <option key={o} value={o}>{o === 'Warehouse' ? '🏭 Warehouse (Central Store)' : o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Dispatch Method</label>
              <div className="flex gap-2">
                {DISPATCH_METHODS.map(m => (
                  <button key={m.value} onClick={() => setDispatchMethod(m.value)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-xl border ${dispatchMethod === m.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes..."
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none resize-none" />
            </div>
            {transferItems.length > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Items ({transferItems.reduce((s, t) => s + t.qty, 0)} total)</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {transferItems.map(t => (
                    <div key={t.variantId} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-white truncate">{t.productName}</p>
                        <p className="text-[9px] text-gray-500">{[t.color, t.size].filter(Boolean).join(' • ') || 'Standard'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(t.variantId, t.qty - 1)} className="p-0.5 text-gray-500 hover:text-white"><Minus size={10} /></button>
                        <span className="text-xs font-bold text-white min-w-[16px] text-center">{t.qty}</span>
                        <button onClick={() => updateQty(t.variantId, t.qty + 1)} className="p-0.5 text-gray-500 hover:text-white"><Plus size={10} /></button>
                      </div>
                      <button onClick={() => removeTransferItem(t.variantId)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={handleCreateTransfer} disabled={submitting || transferItems.length === 0 || !destOutlet}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm">
              {submitting ? 'Creating...' : `Submit Request (${transferItems.reduce((s, t) => s + t.qty, 0)} items)`}
            </button>
          </div>

          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-4">
            <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Package size={16} />{userOutlet} Inventory</h2>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search products..."
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="relative mb-3">
              <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { handleBarcodeLookup(barcodeInput); setBarcodeInput(''); } }}
                placeholder="Scan barcode..."
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {groupedInventory.map(([name, variants]) => (
                <div key={name} className="bg-gray-800/40 rounded-xl p-2.5 border border-gray-800">
                  <p className="text-xs font-bold text-white">{name}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {variants.map(v => (
                      <button key={v.id} onClick={() => v.stock > 0 ? addTransferItem(v) : null} disabled={v.stock <= 0}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${v.stock <= 0 ? 'bg-gray-900/50 border-gray-800 text-gray-700 cursor-not-allowed' : transferItems.some(t => t.variantId === v.id) ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        {[v.color, v.size].filter(Boolean).join(' / ') || 'Standard'} ({v.stock})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-gray-900 border-2 border-red-500/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-red-400 mb-3">Reject Transfer {rejectModal.transferNumber}</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Reason for rejection (optional)..."
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 text-xs font-black">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading === rejectModal?.id}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black disabled:opacity-50">
                {actionLoading === rejectModal?.id ? 'Rejecting...' : 'Reject Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setDispatchModal(null)}>
          <div className="bg-gray-900 border-2 border-blue-500/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-blue-400 mb-3">Dispatch {dispatchModal.transferNumber}</h3>
            <p className="text-xs text-gray-400 mb-3">Select dispatch method:</p>
            <div className="space-y-2 mb-4">
              {DISPATCH_METHODS.map(m => (
                <button key={m.value} onClick={() => handleDispatch(dispatchModal.id, m.value)}
                  disabled={actionLoading === dispatchModal?.id}
                  className="w-full py-3 rounded-xl bg-gray-800 hover:bg-blue-600/20 border-2 border-gray-700 hover:border-blue-500/30 text-white text-xs font-black text-left px-4 disabled:opacity-50">
                  {m.label}
                </button>
              ))}
            </div>
            <button onClick={() => setDispatchModal(null)} className="w-full py-2 rounded-xl bg-gray-800 text-gray-400 text-xs font-black">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletTransfers;
