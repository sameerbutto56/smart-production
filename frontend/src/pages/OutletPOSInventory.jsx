import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Search, ChevronDown, ChevronUp, RefreshCw, Warehouse, Plus, X, CheckCircle2, Upload, Layers, Hash, Minus, PlusCircle, Pencil, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import useCache from '../hooks/useCache';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;
const ALL_OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const OutletPOSInventory = () => {
  const { user } = useAuth();
  const defaultOutlet = (() => {
    if (user?.role !== 'OUTLET') return 'Johar Town';
    const n = (user?.name || '').toLowerCase();
    if (n.includes('jail')) return 'Jail Road';
    if (n.includes('abbottabad')) return 'Abbottabad';
    return 'Johar Town';
  })();
  const [selectedOutlet, setSelectedOutlet] = useState(defaultOutlet);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'SCRUBS',
    fabric: '',
    imageUrl: '',
    variants: [{ color: '', size: '', price: 0 }]
  });

  const isOutlet = user?.role === 'OUTLET';
  const isReadOnly = isOutlet;

  const { data: items = [], loading, refresh } = useCache(`pos:inventory:${selectedOutlet}`, {
    fetcher: () => api.get(`/api/pos/inventory?outlet=${selectedOutlet}`).then(r => r.data),
    ttl: 60 * 1000,
  });

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filtered = items.filter(i => {
    if (activeCategory && i.category !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  /* ─── Product Form handlers ─── */
  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { color: '', size: '', price: 0 }]
    }));
  };

  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const handleOpenModal = () => {
    setFormData({ name: '', category: 'SCRUBS', fabric: '', imageUrl: '', variants: [{ color: '', size: '', price: 0 }] });
    setIsModalOpen(true);
  };

  /* ─── Edit Product ─── */
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', fabric: '', imageUrl: '' });
  const [editVariants, setEditVariants] = useState([]);
  const [removedVariantIds, setRemovedVariantIds] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleOpenEdit = (item) => {
    setEditItem(item);
    setEditForm({
      name: item.name || '',
      category: item.category || '',
      fabric: item.fabric || '',
      imageUrl: item.imageUrl || ''
    });
    setEditVariants((item.outletVariants || []).map(v => ({
      _key: v.id,
      id: v.id,
      color: v.color || '',
      size: v.size || '',
      barcode: v.barcode,
      stock: v.stock || 0,
      price: v.price || 0
    })));
    setRemovedVariantIds([]);
    setEditModalOpen(true);
  };

  const handleEditVariantChange = (key, field, value) => {
    setEditVariants(prev => prev.map(v => v._key === key ? { ...v, [field]: value } : v));
  };

  const handleEditAddVariant = () => {
    const newKey = `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setEditVariants(prev => [...prev, {
      _key: newKey,
      id: null,
      color: '',
      size: '',
      barcode: '',
      stock: 0,
      price: 0
    }]);
  };

  const handleEditRemoveVariant = (key) => {
    const variant = editVariants.find(v => v._key === key);
    if (variant.id) setRemovedVariantIds(prev => [...prev, variant.id]);
    setEditVariants(prev => prev.filter(v => v._key !== key));
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    setEditSubmitting(true);
    try {
      await api.patch(`/api/pos/products/${editItem.id}`, editForm);

      // Update existing variants
      const existing = editVariants.filter(v => v.id);
      await Promise.all(
        existing.map(v =>
          api.put(`/api/pos/variants/${v.id}`, {
            color: v.color || null,
            size: v.size || null,
            stock: v.stock,
            price: v.price
          })
        )
      );

      // Create new variants
      const news = editVariants.filter(v => !v.id);
      await Promise.all(
        news.map(v =>
          api.post(`/api/pos/products/${editItem.id}/variants`, {
            color: v.color || null,
            size: v.size || null,
            stock: v.stock,
            price: v.price
          })
        )
      );

      // Delete removed variants
      await Promise.all(
        removedVariantIds.map(id =>
          api.delete(`/api/pos/variants/${id}`)
        )
      );

      toast.success('Product updated');
      setEditModalOpen(false);
      setEditItem(null);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update product');
    }
    setEditSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        fabric: formData.fabric || undefined,
        imageUrl: formData.imageUrl || undefined,
        variants: formData.variants.filter(v => v.color || v.size || v.price > 0)
          .map(v => ({ ...v, stock: 0 /* stock always 0 in POS */ }))
      };
      await api.post('/api/pos/products', payload);
      toast.success('Product added to POS catalog');
      setIsModalOpen(false);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create product');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Outlet POS Inventory</h1>
          <p className="text-sm font-bold text-gray-400">
            {isOutlet ? 'View-only inventory (contact Store for changes)' : 'Manage all outlet inventories'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isReadOnly && (
            <button onClick={handleOpenModal} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-xl text-sm">
              <PlusCircle size={16} />Add Product
            </button>
          )}
          <button onClick={refresh} disabled={loading} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-black px-4 py-3 rounded-xl text-sm">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Outlet selector tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ALL_OUTLETS.map(outlet => {
          const isActive = outlet === selectedOutlet;
          return (
            <button key={outlet} onClick={() => setSelectedOutlet(outlet)}
              className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider transition-all ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {outlet}
            </button>
          );
        })}
      </div>
      {isOutlet && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-2">
          <Eye size={14} className="text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-amber-400">View only — You cannot add, edit, or modify inventory. Contact Store for changes.</span>
        </div>
      )}

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
                      <p className="text-[10px] text-gray-500 font-bold">{item.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(item); }}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-blue-600 rounded-lg transition-colors">
                        <Pencil size={12} className="text-white" />
                        <span className="text-[10px] font-bold text-white">Edit</span>
                      </button>
                    )}
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
                        <span className="font-bold text-emerald-400">{v.price ? formatCurrency(v.price) : '-'}</span>
                        <span className={`font-bold ml-2 ${v.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v.stock}</span>
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

      {/* ─── Add Product Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-gray-900 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-[2rem] border-2 border-gray-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Add Product</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">POS Catalog Entry</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-gray-800 text-gray-500 hover:text-white rounded-2xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Product Name</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-4 px-6 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all"
                  placeholder="e.g. Ultra-Flex Scrub Top" />
              </div>

              {/* Category + Fabric */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Category</label>
                  <select value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-4 px-4 font-bold text-white uppercase outline-none focus:border-blue-500 transition-all">
                    {['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT', 'ACCESSORIES'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Fabric</label>
                  <input type="text" value={formData.fabric}
                    onChange={(e) => setFormData({...formData, fabric: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-4 px-4 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all"
                    placeholder="Cotton Blend" />
                </div>
              </div>

              {/* Variants */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Variants (Color × Size × Price)</label>
                  <button type="button" onClick={addVariant}
                    className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.variants.map((v, vi) => (
                    <div key={vi} className="grid grid-cols-12 gap-2 items-center bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                      <div className="col-span-4">
                        <input type="text" value={v.color} placeholder="Color"
                          onChange={(e) => updateVariant(vi, 'color', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-3">
                        <input type="text" value={v.size} placeholder="Size"
                          onChange={(e) => updateVariant(vi, 'size', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" value={v.price} placeholder="Price"
                          onChange={(e) => updateVariant(vi, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button type="button" onClick={() => removeVariant(vi)}
                          className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all disabled:opacity-20"
                          disabled={formData.variants.length <= 1}>
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addVariant}
                  className="w-full py-3 border-2 border-dashed border-gray-700 rounded-xl text-xs font-black text-gray-500 uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Variant
                </button>
              </div>

              {/* Submit */}
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                {submitting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{submitting ? 'Creating...' : 'Add to POS Catalog'}</span>
              </button>
              <p className="text-[10px] text-gray-500 text-center font-bold">Stock is always 0 &bull; Stock arrives via demand request approval workflow</p>
            </form>
          </div>
        </div>
      )}
      {/* ─── Edit Product Modal ─── */}
      {editModalOpen && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-gray-900 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-[2rem] border-2 border-gray-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Edit Product</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{editItem.name}</p>
              </div>
              <button onClick={() => { setEditModalOpen(false); setEditItem(null); }} className="p-3 bg-gray-800 text-gray-500 hover:text-white rounded-2xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Product Details */}
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Product Details</label>
                <div className="space-y-2">
                  <input type="text" value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-4 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all"
                    placeholder="Product Name" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editForm.category}
                      onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-3 font-bold text-white uppercase outline-none focus:border-blue-500 transition-all">
                      {['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT', 'ACCESSORIES'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input type="text" value={editForm.fabric} placeholder="Fabric"
                      onChange={(e) => setEditForm({...editForm, fabric: e.target.value})}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-3 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all" />
                  </div>
                  <input type="text" value={editForm.imageUrl} placeholder="Image URL"
                    onChange={(e) => setEditForm({...editForm, imageUrl: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-4 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              {/* Variants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Variants (Color × Size × Price × Stock)</label>
                  <button type="button" onClick={handleEditAddVariant}
                    className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                  {editVariants.map(v => (
                    <div key={v._key} className="grid grid-cols-12 gap-1.5 items-center bg-gray-800/50 rounded-xl px-2 py-2 border border-gray-700/50">
                      <div className="col-span-3">
                        <input type="text" value={v.color} placeholder="Color"
                          onChange={(e) => handleEditVariantChange(v._key, 'color', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-1.5 px-2 text-[10px] font-bold text-white placeholder-gray-600 outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-2">
                        <input type="text" value={v.size} placeholder="Size"
                          onChange={(e) => handleEditVariantChange(v._key, 'size', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-1.5 px-2 text-[10px] font-bold text-white placeholder-gray-600 outline-none focus:border-blue-500" />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">₨</span>
                          <input type="number" min="0" step="0.01" value={v.price}
                            onChange={(e) => handleEditVariantChange(v._key, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-1.5 pl-5 pr-2 text-[10px] font-bold text-white outline-none focus:border-blue-500" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" value={v.stock}
                          onChange={(e) => handleEditVariantChange(v._key, 'stock', parseInt(e.target.value) || 0)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg py-1.5 px-2 text-[10px] font-bold text-white outline-none focus:border-blue-500 text-center" />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button type="button" onClick={() => handleEditRemoveVariant(v._key)}
                          className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all">
                          <Minus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleEditAddVariant}
                  className="w-full py-2 border-2 border-dashed border-gray-700 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all flex items-center justify-center gap-2">
                  <Plus size={12} /> Add Variant
                </button>
              </div>

              {/* Save */}
              <button onClick={handleEditSave} disabled={editSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                {editSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                <span>{editSubmitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletPOSInventory;
