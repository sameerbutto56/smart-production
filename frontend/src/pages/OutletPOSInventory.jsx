import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Package, Search, RefreshCw, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';
import { setCache } from '../hooks/useCache';

const ALL_OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const OUTLET_SHORT = { 'Johar Town': 'JT', 'Jail Road': 'JR', 'Abbottabad': 'AB' };

const OutletPOSInventory = () => {
  const [allData, setAllData] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const results = {};
    try {
      const res = await Promise.all(
        ALL_OUTLETS.map(o =>
          api.get(`/api/pos/inventory?outlet=${o}`).then(r => ({ outlet: o, data: r.data }))
        )
      );
      for (const { outlet, data } of res) {
        results[outlet] = data;
        await setCache(`pos:inventory:${outlet}`, data, 2 * 60 * 1000);
      }
    } catch (e) {
      toast.error('Failed to load inventory');
    }
    setAllData(results);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const allItems = useMemo(() => {
    const items = [];
    for (const outlet of ALL_OUTLETS) {
      for (const item of (allData[outlet] || [])) {
        items.push({ ...item, outletName: outlet });
      }
    }
    return items;
  }, [allData]);

  const categories = [...new Set(allItems.map(i => i.category).filter(Boolean))].sort();

  const filtered = allItems.filter(i => {
    if (activeCategory && i.category !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const key = `${item.name}||${item.category}`;
      if (!map.has(key)) map.set(key, { name: item.name, category: item.category, imageUrl: item.imageUrl, fabric: item.fabric, variants: [] });
      const g = map.get(key);
      g.variants.push(item);
    }
    for (const g of map.values()) {
      g.variants.sort((a, b) => ALL_OUTLETS.indexOf(a.outletName) - ALL_OUTLETS.indexOf(b.outletName));
    }
    return Array.from(map.values());
  }, [filtered]);

  return (
    <div className="space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Outlet POS Inventory</h1>
          <p className="text-sm font-bold text-gray-400">View-only — All outlets stock at a glance</p>
        </div>
        <button onClick={fetchAll} disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-black px-4 py-3 rounded-xl text-sm">
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

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
      </div>

      {/* Product List */}
      {loading ? (
        <div className="text-center py-12"><RefreshCw className="animate-spin text-blue-400 inline" size={32} /></div>
      ) : (
        <div className="space-y-2">
          {grouped.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-bold">
              <Warehouse size={40} className="mx-auto mb-3 text-gray-700" />
              <p>No products found{search ? ' matching your search' : ''}.</p>
            </div>
          )}
          {grouped.map(group => {
            const groupId = group.name + group.category;
            const totalStock = group.variants.reduce((s, v) => s + (v.stock || 0), 0);
            return (
              <div key={groupId} className="bg-gray-900/60 rounded-xl border border-gray-700/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700/30">
                  <div className="flex items-center gap-3">
                    {group.imageUrl ? <img src={group.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{group.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{group.category} <span className={`ml-2 font-bold ${totalStock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>Total: {totalStock}</span></p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-800/50">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-4 py-1.5 text-[9px] font-black text-gray-600 uppercase tracking-wider">
                    <span>Variant</span>
                    <span>Barcode</span>
                    <span className="text-center">Price</span>
                    <span className="text-center w-[60px]">Stock / Outlet</span>
                  </div>
                  {group.variants.map(v => (
                    <div key={v.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-4 py-2 items-center">
                      <span className="text-[11px] font-bold text-gray-300 truncate">{[v.color, v.size].filter(Boolean).join(' • ') || 'Default'}</span>
                      <span className="text-[10px] font-mono text-gray-500 truncate">{v.barcode || 'N/A'}</span>
                      <span className="text-[11px] font-bold text-emerald-400 text-center">₨{(v.price || 0).toLocaleString()}</span>
                      <div className="flex items-center gap-1 w-[60px]">
                        {ALL_OUTLETS.map(o => (
                          <span key={o} className={`text-[9px] font-bold px-1 py-0.5 rounded ${(allData[o]||[]).find(x => x.id === v.id)?.stock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-600'}`}
                            title={`${o}: ${(allData[o]||[]).find(x => x.id === v.id)?.stock || 0}`}>
                            {OUTLET_SHORT[o]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OutletPOSInventory;
