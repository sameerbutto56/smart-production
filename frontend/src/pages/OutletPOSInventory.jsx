import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Printer, Search, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const OutletPOSInventory = () => {
  const [products, setProducts] = useState([]);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/pos/products');
      setProducts(res.data);
    } catch { toast.error('Failed to load products'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const filtered = products.filter(p => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const updateStock = async (variantId, stock) => {
    try {
      await api.put(`/api/pos/variants/${variantId}/stock`, { stock: parseInt(stock || 0) });
      setProducts(prev => prev.map(p => ({
        ...p,
        outletVariants: p.outletVariants.map(v => v.id === variantId ? { ...v, stock: parseInt(stock || 0) } : v)
      })));
      toast.success('Stock updated');
    } catch { toast.error('Failed to update stock'); }
  };

  const updatePrice = async (variantId, price) => {
    try {
      await api.put(`/api/pos/variants/${variantId}/price`, { price: price !== '' ? parseFloat(price) : null });
      setProducts(prev => prev.map(p => ({
        ...p,
        outletVariants: p.outletVariants.map(v => v.id === variantId ? { ...v, price: price !== '' ? parseFloat(price) : null } : v)
      })));
      toast.success('Price updated');
    } catch { toast.error('Failed to update price'); }
  };

  const printBarcode = (variant, productName) => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, variant.barcode, { format: 'CODE128', width: 1.5, height: 30, displayValue: true, fontSize: 10 });
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode</title><style>
      @page { margin: 0; size: 50mm 30mm; }
      body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; width: 50mm; height: 30mm; font-family: Arial, sans-serif; }
      .label { text-align: center; padding: 2px; }
      .label .name { font-size: 9px; font-weight: bold; margin-bottom: 1px; }
      .label .detail { font-size: 7px; color: #555; margin-bottom: 2px; }
      .label .price { font-size: 10px; font-weight: bold; margin-top: 1px; }
      img { max-width: 48mm; }
    </style></head><body><div class="label">
      <div class="name">${productName}</div>
      <div class="detail">${[variant.color, variant.size].filter(Boolean).join(' / ') || ''}</div>
      <img src="${dataUrl}" />
      <div class="price">${formatCurrency(variant.price || 0)}</div>
    </div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <div className="space-y-6 pb-20 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Outlet Inventory</h1>
          <p className="text-sm font-bold text-gray-400">Products sourced from warehouse &bull; Outlet stock managed independently</p>
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

      {/* Product List */}
      <div className="glass p-4 rounded-2xl border-2 border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          </div>
          <span className="text-xs font-bold text-gray-500">{filtered.length} products</span>
        </div>
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="bg-gray-900/60 rounded-xl border border-gray-700/50">
              <button onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                className="w-full flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {p.imageUrl ? <img src={p.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">{p.name}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{p.category} &bull; {formatCurrency(p.price)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">{p.outletVariants?.length || 0} variants</span>
                  {expandedProduct === p.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </button>
              {expandedProduct === p.id && (
                <div className="px-4 pb-3 border-t border-gray-700/50 pt-2">
                  {p.outletVariants?.length > 0 ? (
                    <div className="grid gap-1.5">
                      {p.outletVariants.map(v => (
                        <div key={v.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                          <span className="font-bold text-gray-300 min-w-[80px]">{[v.color, v.size].filter(Boolean).join(' \u2022 ') || 'Default'}</span>
                          <span className="text-[10px] font-mono text-gray-500 flex-1">{v.barcode}</span>
                          <button onClick={() => printBarcode(v, p.name)} className="text-blue-400 hover:text-blue-300" title="Print barcode label"><Printer size={14} /></button>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 text-[10px]">Stock:</span>
                            <input type="number" value={v.stock} onChange={e => updateStock(v.id, e.target.value)}
                              className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" />
                            <span className="text-gray-500 text-[10px]">₨</span>
                            <input type="number" value={v.price !== null && v.price !== undefined ? v.price : ''} onChange={e => updatePrice(v.id, e.target.value)}
                              className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" placeholder={String(p.price)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-500">No variants available. Add colors/sizes in warehouse inventory first.</p>}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-500 font-bold py-8">No products found in warehouse inventory</p>}
        </div>
      </div>
    </div>
  );
};

export default OutletPOSInventory;
