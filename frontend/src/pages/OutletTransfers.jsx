import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowRightLeft, ArrowUp, ArrowDown, Plus, Minus, X, Search, ChevronDown, ChevronUp, Printer, Package, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const formatCurrency = (n) => `Rs${(n || 0).toLocaleString()}`;
const formatDate = (d) => new Date(d).toLocaleString();

const statusStyles = {
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const OutletTransfers = () => {
  const { user } = useAuth();
  const userOutlet = user?.role === 'OUTLET' ? user?.name : null;
  const canCreateTransfer = user?.role === 'OUTLET' || user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [transfers, setTransfers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_transfers') || '[]'); } catch { return []; }
  });
  const [inventory, setInventory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos_products') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('list');

  const [destOutlet, setDestOutlet] = useState('');
  const [notes, setNotes] = useState('');
  const [transferItems, setTransferItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const t = await api.get('/api/transfers');
      setTransfers(t.data);
      localStorage.setItem('pos_transfers', JSON.stringify(t.data));
    } catch (e) {
      toast.error(`Failed to load transfers: ${e.response?.data?.message || e.message}`);
    }
    try {
      const inv = await api.get('/api/pos/products?skipCache=true');
      setInventory(inv.data);
      localStorage.setItem('pos_products', JSON.stringify(inv.data));
    } catch (e) {
      toast.error(`Failed to load products: ${e.response?.data?.message || e.message}`);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredInventory = useMemo(() => {
    let items = inventory;
    if (searchTerm) items = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return items;
  }, [inventory, searchTerm]);

  const addTransferItem = (product, variant) => {
    const key = `${product.id}|${variant.color || ''}|${variant.size || ''}`;
    if (transferItems.some(t => t.key === key)) {
      setTransferItems(transferItems.map(t => t.key === key ? { ...t, qty: t.qty + 1 } : t));
    } else {
      setTransferItems([...transferItems, {
        key,
        variantId: variant.id,
        productName: product.name,
        color: variant.color,
        size: variant.size,
        barcode: variant.barcode,
        maxQty: variant.stock,
        qty: 1
      }]);
    }
  };

  const updateQty = (key, qty) => {
    if (qty < 1) return;
    setTransferItems(transferItems.map(t => t.key === key ? { ...t, qty: Math.min(qty, t.maxQty) } : t));
  };

  const removeTransferItem = (key) => setTransferItems(transferItems.filter(t => t.key !== key));

  const handleCreateTransfer = async () => {
    if (!destOutlet) return toast.error('Select destination outlet');
    if (transferItems.length === 0) return toast.error('Add at least one item');
    setSubmitting(true);
    try {
      await api.post('/api/transfers', {
        toOutlet: destOutlet,
        items: transferItems.map(t => ({ variantId: t.variantId, quantity: t.qty })),
        notes: notes || null
      });
      toast.success('Transfer completed!');
      setDestOutlet('');
      setNotes('');
      setTransferItems([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
    setSubmitting(false);
  };

  const printTransferSlip = (transfer) => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transfer Slip</title><style>
      @page { margin: 10mm; size: A4; }
      body { font-family: 'Courier New', monospace; font-size: 14px; color: #000; }
      .header { text-align: center; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 3px solid #000; }
      .header h1 { font-size: 32px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin: 0; }
      .header p { font-size: 16px; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th { background: #000; color: #fff; font-size: 12px; padding: 8px; text-align: left; text-transform: uppercase; }
      td { padding: 8px; border-bottom: 1px solid #ccc; font-size: 13px; }
      .right { text-align: right; }
      .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; border-top: 2px solid #000; padding-top: 10px; }
      .meta { margin: 10px 0; padding: 10px; border: 2px solid #000; border-radius: 6px; }
      .meta p { margin: 4px 0; font-size: 14px; }
    </style></head><body>`);
    win.document.write(`<div class="header"><h1>ENAMELS</h1><p>TRANSFER SLIP</p></div>`);
    win.document.write(`<div class="meta">`);
    win.document.write(`<p><strong>Transfer #:</strong> ${transfer.transferNumber}</p>`);
    win.document.write(`<p><strong>From:</strong> ${transfer.fromOutlet} <strong>→ To:</strong> ${transfer.toOutlet}</p>`);
    win.document.write(`<p><strong>Date:</strong> ${new Date(transfer.createdAt).toLocaleString()}</p>`);
    win.document.write(`<p><strong>Status:</strong> ${transfer.status}</p>`);
    if (transfer.notes) win.document.write(`<p><strong>Notes:</strong> ${transfer.notes}</p>`);
    win.document.write(`</div>`);
    win.document.write(`<table><thead><tr><th>#</th><th>Product</th><th>Color</th><th>Size</th><th class="right">Qty</th><th class="right">Price</th></tr></thead><tbody>`);
    (transfer.items || []).forEach((item, idx) => {
      win.document.write(`<tr>`);
      win.document.write(`<td>${idx + 1}</td>`);
      win.document.write(`<td>${item.productName}</td>`);
      win.document.write(`<td>${item.color || '—'}</td>`);
      win.document.write(`<td>${item.size || '—'}</td>`);
      win.document.write(`<td class="right">${item.quantity}</td>`);
      win.document.write(`<td class="right">${formatCurrency(item.unitPrice)}</td>`);
      win.document.write(`</tr>`);
    });
    win.document.write(`</tbody></table>`);
    win.document.write(`<div class="footer"><p>Generated by ENAMELS POS System</p></div>`);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 200);
  };

  const availableOutlets = OUTLETS.filter(o => o !== (userOutlet || ''));

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><ArrowRightLeft size={24} />Outlet Transfers</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>History</button>
          {canCreateTransfer && <button onClick={() => setTab('new')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'new' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'}`}>New Transfer</button>}
        </div>
      </div>

      {tab === 'list' && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-gray-500 py-8 font-bold">Loading...</p>
          ) : transfers.length === 0 ? (
            <p className="text-center text-gray-500 py-8 font-bold">No transfers yet</p>
          ) : transfers.map(t => (
            <div key={t.id} className="bg-gray-900 border-2 border-gray-800 rounded-2xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${t.fromOutlet === userOutlet ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                    {t.fromOutlet === userOutlet ? <ArrowUp size={16} className="text-red-400" /> : <ArrowDown size={16} className="text-emerald-400" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{t.transferNumber}</p>
                    <p className="text-[10px] text-gray-500">{t.fromOutlet} → {t.toOutlet}</p>
                    <p className="text-[10px] text-gray-600">{formatDate(t.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${statusStyles[t.status] || 'bg-gray-700 text-gray-400'}`}>{t.status}</span>
                  <span className="text-xs font-bold text-gray-400">{t.totalItems} items</span>
                  {expandedId === t.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                </div>
              </button>
              {expandedId === t.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 font-bold uppercase tracking-wider">
                          <th className="text-left py-1">Product</th>
                          <th className="text-left">Color</th>
                          <th className="text-left">Size</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.items || []).map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-800">
                            <td className="py-1.5 font-bold text-white">{item.productName}</td>
                            <td className="py-1.5 text-gray-400">{item.color || '—'}</td>
                            <td className="py-1.5 text-gray-400">{item.size || '—'}</td>
                            <td className="py-1.5 text-right font-bold text-white">{item.quantity}</td>
                            <td className="py-1.5 text-right text-gray-400">{formatCurrency(item.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {t.notes && <p className="text-xs text-gray-500 mt-2 italic">Notes: {t.notes}</p>}
                  <button onClick={() => printTransferSlip(t)} className="mt-2 text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-gray-800 px-3 py-1.5 rounded-lg">
                    <Printer size={12} className="inline mr-1" />Print Slip
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-4">
            <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Building2 size={16} />New Transfer</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Destination Outlet</label>
                <select value={destOutlet} onChange={e => setDestOutlet(e.target.value)} className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none">
                  <option value="">Select outlet...</option>
                  {availableOutlets.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes for this transfer..."
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none resize-none" />
              </div>
              {transferItems.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Transfer Items ({transferItems.reduce((s, t) => s + t.qty, 0)} total)</label>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {transferItems.map(t => (
                      <div key={t.key} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-2.5 py-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-white truncate">{t.productName}</p>
                          <p className="text-[9px] text-gray-500">{[t.color, t.size].filter(Boolean).join(' • ') || 'Standard'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(t.key, t.qty - 1)} className="p-0.5 text-gray-500 hover:text-white"><Minus size={10} /></button>
                          <span className="text-xs font-bold text-white min-w-[16px] text-center">{t.qty}</span>
                          <button onClick={() => updateQty(t.key, t.qty + 1)} className="p-0.5 text-gray-500 hover:text-white"><Plus size={10} /></button>
                        </div>
                        <button onClick={() => removeTransferItem(t.key)} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleCreateTransfer} disabled={submitting || transferItems.length === 0 || !destOutlet}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm">
                {submitting ? 'Transferring...' : `Transfer ${transferItems.reduce((s, t) => s + t.qty, 0)} Items`}
              </button>
            </div>
          </div>

          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-4">
            <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2"><Package size={16} />Your Inventory</h2>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search products..."
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {filteredInventory.map(p => (
                <div key={p.id} className="bg-gray-800/40 rounded-xl p-2.5 border border-gray-800">
                  <p className="text-xs font-bold text-white">{p.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(p.outletVariants || []).length === 0 ? (
                      <span className="text-[9px] text-gray-600 italic">No variants</span>
                    ) : (
                      p.outletVariants.map(v => (
                        <button key={v.id}
                          onClick={() => v.stock > 0 ? addTransferItem(p, v) : null}
                          disabled={v.stock <= 0}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                            v.stock <= 0 ? 'bg-gray-900/50 border-gray-800 text-gray-700 cursor-not-allowed' :
                            transferItems.some(t => t.variantId === v.id) ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                          }`}>
                          {[v.color, v.size].filter(Boolean).join(' / ') || 'Standard'} ({v.stock})
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
              {filteredInventory.length === 0 && <p className="text-center text-gray-500 py-4 text-xs font-bold">No products found</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletTransfers;
