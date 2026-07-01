import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Printer, Search, ChevronDown, ChevronUp, RefreshCw, Plus, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const OutletPOSInventory = () => {
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/pos/inventory');
      setItems(res.data);
    } catch { toast.error('Failed to load POS inventory'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filtered = items.filter(i => {
    if (activeCategory && i.category !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addToPos = async (item) => {
    try {
      await api.post(`/api/pos/inventory/add/${item.id}`);
      toast.success(`${item.name} added to POS inventory with barcodes`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to add to POS');
    }
  };

  const removeFromPos = async (item) => {
    if (!window.confirm(`Remove "${item.name}" from POS inventory? Products will no longer appear in the POS.`)) return;
    try {
      await api.delete(`/api/pos/inventory/remove/${item.id}`);
      toast.success(`${item.name} removed from POS inventory`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove from POS');
    }
  };

  const printBarcode = (variant, productName) => {
    const qty = prompt(`How many barcode labels for "${productName}" ${[variant.color, variant.size].filter(Boolean).join(' / ')}?`, '1');
    const count = parseInt(qty);
    if (!count || count < 1) return;

    const canvas = document.createElement('canvas');
    JsBarcode(canvas, variant.barcode, { format: 'CODE128', width: 1.5, height: 30, displayValue: true, fontSize: 10 });
    const dataUrl = canvas.toDataURL('image/png');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode Labels</title><style>
      @page { margin: 0; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
      .labels { display: flex; flex-wrap: wrap; }
      .label { width: 50mm; height: 30mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-inside: avoid; box-sizing: border-box; padding: 2px; border: 0.5px dashed #ccc; }
      .label .name { font-size: 8px; font-weight: bold; }
      .label .detail { font-size: 7px; color: #555; }
      .label .price { font-size: 9px; font-weight: bold; margin-top: 1px; }
      img { max-width: 46mm; }
    </style></head><body><div class="labels">
      ${Array(count).fill(`<div class="label">
        <div class="name">${productName}</div>
        <div class="detail">${[variant.color, variant.size].filter(Boolean).join(' / ') || ''}</div>
        <img src="${dataUrl}" />
        <div class="price">${formatCurrency(variant.price || 0)}</div>
      </div>`).join('')}
    </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  const activeItems = filtered.filter(i => i.isActive);
  const inactiveItems = filtered.filter(i => !i.isActive);

  return (
    <div className="space-y-6 pb-20 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Store POS Inventory</h1>
          <p className="text-sm font-bold text-gray-400">Add products from warehouse to Outlet POS &bull; Generate barcodes &amp; print labels</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-black px-4 py-3 rounded-xl text-sm">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      {/* Categories filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setActiveCategory('')}
          className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${!activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          All
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${activeCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Active in POS section */}
      <div className="glass p-4 rounded-2xl border-2 border-emerald-700/50">
        <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Check size={14} />Active in POS ({activeItems.length} products)
        </h2>
        <div className="space-y-2">
          {activeItems.map(item => (
            <div key={item.id} className="bg-gray-900/60 rounded-xl border border-emerald-700/30">
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{item.name}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{item.category} &bull; {formatCurrency(item.price)} &bull; {item.activeVariantCount}/{item.variantCount} variants active</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-lg">Active</span>
                  {expandedId === item.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </button>
              {expandedId === item.id && (
                <div className="px-4 pb-3 border-t border-gray-700/50 pt-2 space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => printBarcode(item.outletVariants.find(v => v.isActive) || item.outletVariants[0], item.name)} className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"><Printer size={12} />Print barcode labels</button>
                    <button onClick={() => removeFromPos(item)} className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"><X size={12} />Remove from POS</button>
                  </div>
                  {item.outletVariants.filter(v => v.isActive).map(v => (
                    <div key={v.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                      <span className="font-bold text-gray-300 min-w-[80px]">{[v.color, v.size].filter(Boolean).join(' \u2022 ') || 'Default'}</span>
                      <span className="text-[10px] font-mono text-gray-500 flex-1">{v.barcode}</span>
                      <button onClick={() => printBarcode(v, item.name)} className="text-blue-400 hover:text-blue-300" title="Print barcode label"><Printer size={14} /></button>
                      <span className="text-gray-500 text-[10px]">Stock:</span>
                      <span className="font-bold text-white">{v.stock}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {activeItems.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No products added to POS yet. Browse the warehouse catalog below.</p>}
        </div>
      </div>

      {/* Warehouse catalog — add to POS */}
      <div className="glass p-4 rounded-2xl border-2 border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest">Warehouse Catalog — Add to POS</h2>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          </div>
        </div>
        <div className="space-y-2">
          {inactiveItems.map(item => (
            <div key={item.id} className="bg-gray-900/60 rounded-xl border border-gray-700/50">
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{item.name}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{item.category} &bull; {formatCurrency(item.price)} &bull; {item.variantCount} variants</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); addToPos(item); }} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                    <Plus size={12} />Add to POS
                  </button>
                  {expandedId === item.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </button>
              {expandedId === item.id && (
                <div className="px-4 pb-3 border-t border-gray-700/50 pt-2">
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] text-gray-500 font-bold bg-gray-800/30 rounded-lg px-3 py-2">
                    <span>Colors: {item.colors?.join(', ') || 'N/A'}</span>
                    <span>Sizes: {item.sizes?.join(', ') || 'N/A'}</span>
                    <span>Warehouse price: {formatCurrency(item.price)}</span>
                    <span>Variants to create: {item.variantCount}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          {inactiveItems.length === 0 && <p className="text-center text-gray-500 font-bold py-4">All warehouse products are already in POS inventory</p>}
        </div>
      </div>
    </div>
  );
};

export default OutletPOSInventory;
