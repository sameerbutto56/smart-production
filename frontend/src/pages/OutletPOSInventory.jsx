import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Package, Plus, X, Save, Trash2, Search, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

const OutletPOSInventory = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '', categoryId: '', description: '', price: '', imageUrl: '',
    hasSizes: true, hasColors: true, colors: '', sizes: ''
  });

  const fetchData = async () => {
    try {
      const [c, p] = await Promise.all([
        api.get('/api/pos/categories'),
        api.get('/api/pos/products')
      ]);
      setCategories(c.data);
      setProducts(p.data);
    } catch { toast.error('Failed to load data'); }
  };

  useEffect(() => { fetchData(); }, []);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await api.post('/api/pos/categories', { name: newCat.trim() });
      setNewCat('');
      toast.success('Category added');
      fetchData();
    } catch { toast.error('Failed to add category'); }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Delete category?')) return;
    try {
      await api.delete(`/api/pos/categories/${id}`);
      toast.success('Category deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Product name required');
    try {
      const colors = form.hasColors ? form.colors.split(',').map(s => s.trim()).filter(Boolean) : [];
      const sizes = form.hasSizes ? form.sizes.split(',').map(s => s.trim()).filter(Boolean) : [];
      await api.post('/api/pos/products', {
        name: form.name.trim(), categoryId: form.categoryId || null,
        description: form.description, price: parseFloat(form.price || 0),
        imageUrl: form.imageUrl, hasSizes: form.hasSizes, hasColors: form.hasColors,
        colors, sizes
      });
      setShowAddProduct(false);
      setForm({ name: '', categoryId: '', description: '', price: '', imageUrl: '', hasSizes: true, hasColors: true, colors: '', sizes: '' });
      toast.success('Product created with variants');
      fetchData();
    } catch { toast.error('Failed to create product'); }
  };

  const updateStock = async (variantId, stock) => {
    try {
      await api.put(`/api/pos/variants/${variantId}/stock`, { stock });
      fetchData();
    } catch { toast.error('Failed to update stock'); }
  };

  const updatePrice = async (variantId, price) => {
    try {
      await api.put(`/api/pos/variants/${variantId}/price`, { price });
      fetchData();
    } catch { toast.error('Failed to update price'); }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product and all its variants?')) return;
    try {
      await api.delete(`/api/pos/products/${id}`);
      toast.success('Product deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">POS Inventory</h1>
          <p className="text-sm font-bold text-gray-400">Manage outlet products & stock</p>
        </div>
        <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-3 rounded-xl text-sm">
          <Plus size={16} />Add Product
        </button>
      </div>

      {/* Categories */}
      <div className="glass p-4 rounded-2xl border-2 border-gray-700">
        <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-2"><Tag size={14} />Categories</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {categories.map(c => (
            <span key={c.id} className="flex items-center gap-1 bg-gray-800 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-700">
              {c.name}
              <button onClick={() => deleteCategory(c.id)} className="text-red-400 hover:text-red-300"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name"
            className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          <button onClick={addCategory} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs"><Plus size={14} /></button>
        </div>
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
                    <p className="text-[10px] text-gray-500 font-bold">{p.category?.name || 'No category'} • ₨{p.price}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">{p.variants?.length || 0} variants</span>
                  {expandedProduct === p.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </button>
              {expandedProduct === p.id && (
                <div className="px-4 pb-3 space-y-2 border-t border-gray-700/50 pt-2">
                  <button onClick={() => deleteProduct(p.id)} className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12} />Delete product</button>
                  {p.variants?.length > 0 ? (
                    <div className="grid gap-1.5">
                      {p.variants.map(v => (
                        <div key={v.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                          <span className="font-bold text-gray-300 min-w-[80px]">{[v.color, v.size].filter(Boolean).join(' • ') || 'Default'}</span>
                          <span className="text-[10px] font-mono text-gray-500">{v.barcode}</span>
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-gray-500 text-[10px]">Stock:</span>
                            <input type="number" value={v.stock} onChange={e => updateStock(v.id, e.target.value)}
                              className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" />
                            <span className="text-gray-500 text-[10px]">₨</span>
                            <input type="number" value={v.price || p.price || ''} onChange={e => updatePrice(v.id, e.target.value)}
                              className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" placeholder="Price" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-500">No variants. Delete & recreate with colors/sizes.</p>}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-500 font-bold py-8">No products found</p>}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowAddProduct(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">New Product</h2>
              <button onClick={() => setShowAddProduct(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Product Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Category</label>
                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none">
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Price (₨)</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Image URL</label>
                  <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                  <input type="checkbox" checked={form.hasSizes} onChange={e => setForm({ ...form, hasSizes: e.target.checked })} className="w-4 h-4" />
                  Has Sizes
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
                  <input type="checkbox" checked={form.hasColors} onChange={e => setForm({ ...form, hasColors: e.target.checked })} className="w-4 h-4" />
                  Has Colors
                </label>
              </div>
              {form.hasColors && (
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Colors (comma separated, e.g. Red,Blue,Black)</label>
                  <input value={form.colors} onChange={e => setForm({ ...form, colors: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                </div>
              )}
              {form.hasSizes && (
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Sizes (comma separated, e.g. S,M,L,XL)</label>
                  <input value={form.sizes} onChange={e => setForm({ ...form, sizes: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                </div>
              )}
              <div className="text-[10px] text-gray-500 font-bold p-3 bg-gray-800 rounded-xl">
                Variants will be auto-generated: {form.hasColors ? (form.colors.split(',').filter(Boolean).length || '?') : 1} colors × {form.hasSizes ? (form.sizes.split(',').filter(Boolean).length || '?') : 1} sizes = {(form.hasColors ? Math.max(form.colors.split(',').filter(Boolean).length, 1) : 1) * (form.hasSizes ? Math.max(form.sizes.split(',').filter(Boolean).length, 1) : 1)} variants with unique barcodes
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm"><Save size={16} className="inline mr-2" />Create Product</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletPOSInventory;
