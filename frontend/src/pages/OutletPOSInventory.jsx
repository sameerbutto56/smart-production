import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Search, ChevronDown, ChevronUp, RefreshCw, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';

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

  return (
    <div className="space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Outlet POS Inventory</h1>
          <p className="text-sm font-bold text-gray-400">
            Products are auto-available from warehouse &bull; Stock arrives via Store approval workflow
          </p>
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
          {filtered.map(item => {
            const totalStock = item.outletVariants?.reduce((s, v) => s + v.stock, 0) || 0;
            return (
              <div key={item.id} className="bg-gray-900/60 rounded-xl border border-gray-700/50">
                <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{item.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{item.category} &bull; {formatCurrency(item.price)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${totalStock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      Stock: {totalStock}
                    </span>
                    {expandedId === item.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </div>
                </button>
                {expandedId === item.id && (
                  <div className="px-4 pb-3 border-t border-gray-700/50 pt-2 space-y-1.5">
                    <p className="text-[10px] text-gray-500 font-bold">Colors: {item.colors?.join(', ') || 'N/A'} &bull; Sizes: {item.sizes?.join(', ') || 'N/A'}</p>
                    {item.outletVariants?.map(v => (
                      <div key={v.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                        <span className="font-bold text-gray-300 min-w-[80px]">{[v.color, v.size].filter(Boolean).join(' • ') || 'Default'}</span>
                        <span className="text-[10px] font-mono text-gray-500 flex-1">{v.barcode}</span>
                        <span className={`font-bold ${v.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v.stock}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-bold">
              <Warehouse size={40} className="mx-auto mb-3 text-gray-700" />
              <p>No products found{search ? ' matching your search' : ''}.</p>
              <p className="text-[10px] mt-1">All warehouse products are automatically available. Stock arrives via approved demand requests.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutletPOSInventory;
