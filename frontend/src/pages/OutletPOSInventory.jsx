import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { Package, Search, ChevronDown, ChevronUp, RefreshCw, Warehouse, Plus, X, CheckCircle2, Minus, PlusCircle, Pencil, Trash2, Eye, EyeOff, Database, Download, UploadCloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import useCache, { setCache } from '../hooks/useCache';

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
    selectedProductId: null,
    variants: [{ color: '', size: '', stock: 0, price: 0 }]
  });
  const [storeProducts, setStoreProducts] = useState([]);
  const [storeProductsLoading, setStoreProductsLoading] = useState(false);

  const isOutlet = user?.role === 'OUTLET';
  const canInit = user?.role === 'STORE' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isReadOnly = !['STORE', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const backupJsonRef = React.useRef(null);
  const backupExcelRef = React.useRef(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const handleExportJSON = async () => {
    try {
      setBackupLoading(true);
      const response = await api.get('/api/inventory/backup/export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('JSON backup exported!');
    } catch (error) {
      toast.error('Export failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setBackupLoading(true);
      const response = await api.get('/api/inventory/backup/export-excel', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_backup_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Excel backup exported!');
    } catch (error) {
      toast.error('Export failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('\u26a0\ufe0f This will REPLACE all inventory data with the JSON backup. Continue?')) {
      if (backupJsonRef.current) backupJsonRef.current.value = '';
      return;
    }
    try {
      setBackupLoading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/inventory/backup/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Restored ${res.data.itemsImported} products, ${res.data.variantsImported} variants`);
      refresh();
    } catch (error) {
      toast.error('Import failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setBackupLoading(false);
      if (backupJsonRef.current) backupJsonRef.current.value = '';
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('\u26a0\ufe0f This will REPLACE all inventory data with the Excel backup. Continue?')) {
      if (backupExcelRef.current) backupExcelRef.current.value = '';
      return;
    }
    try {
      setBackupLoading(true);
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/inventory/backup/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Restored ${res.data.itemsImported} products, ${res.data.variantsImported} variants`);
      refresh();
    } catch (error) {
      toast.error('Import failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setBackupLoading(false);
      if (backupExcelRef.current) backupExcelRef.current.value = '';
    }
  };

  const { data: items = [], loading, refresh } = useCache(`pos:inventory:${selectedOutlet}`, {
    fetcher: () => api.get(`/api/pos/inventory?outlet=${selectedOutlet}`).then(r => r.data),
    ttl: 2 * 60 * 1000,
  });

  useEffect(() => {
    const otherOutlets = ALL_OUTLETS.filter(o => o !== selectedOutlet);
    otherOutlets.forEach(o => {
      api.get(`/api/pos/inventory?outlet=${o}`).then(async (res) => {
        await setCache(`pos:inventory:${o}`, res.data, 2 * 60 * 1000);
      }).catch(() => {});
    });
  }, [selectedOutlet]);

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  const filtered = items.filter(i => {
    if (activeCategory && i.category !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const key = `${item.name}||${item.category}||${item.outletName}`;
      if (!map.has(key)) map.set(key, { name: item.name, category: item.category, outletName: item.outletName, imageUrl: item.imageUrl, fabric: item.fabric, variants: [] });
      map.get(key).variants.push(item);
    }
    return Array.from(map.values());
  }, [filtered]);

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { color: '', size: '', stock: 0, price: 0 }]
    }));
  };

  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariantField = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const handleOpenModal = async () => {
    setFormData({ selectedProductId: null, variants: [{ color: '', size: '', stock: 0, price: 0 }] });
    setIsModalOpen(true);
    setStoreProductsLoading(true);
    try {
      const res = await api.get('/api/inventory');
      setStoreProducts(res.data);
    } catch {
      toast.error('Failed to load store products');
    }
    setStoreProductsLoading(false);
  };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', fabric: '', imageUrl: '' });
  const [editVariants, setEditVariants] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleOpenEdit = (item) => {
    setEditItem(item);
    const standardCategories = ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT', 'ACCESSORIES'];
    const isCustom = !standardCategories.includes(item.category);
    setEditForm({
      name: item.name || '',
      category: isCustom ? 'CUSTOM' : (item.category || ''),
      fabric: item.fabric || '',
      imageUrl: item.imageUrl || ''
    });
    setEditVariants([{
      _key: item.id,
      id: item.id,
      color: item.color || '',
      size: item.size || '',
      barcode: item.barcode,
      stock: item.stock || 0,
      price: item.price || 0
    }]);
    setEditModalOpen(true);
  };

  const handleEditVariantChange = (key, field, value) => {
    setEditVariants(prev => prev.map(v => v._key === key ? { ...v, [field]: value } : v));
  };

  const handleEditSave = async () => {
    if (!editItem) return;
    setEditSubmitting(true);
    try {
      const resolvedCategory = editForm.category === 'CUSTOM' ? editCustomCategory.trim().toUpperCase() : editForm.category;
      if (!resolvedCategory) {
        toast.error('Please specify a category');
        setEditSubmitting(false);
        return;
      }
      const variant = editVariants[0];
      await api.put(`/api/pos/variants/${editItem.id}`, {
        name: editForm.name,
        category: resolvedCategory,
        fabric: editForm.fabric || null,
        imageUrl: editForm.imageUrl || null,
        color: variant?.color || null,
        size: variant?.size || null,
        stock: variant?.stock || 0,
        price: variant?.price || 0
      });
      toast.success('Inventory item updated');
      setEditModalOpen(false);
      setEditItem(null);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update inventory item');
    }
    setEditSubmitting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.selectedProductId) {
      toast.error('Please select a store product');
      return;
    }
    setSubmitting(true);
    try {
      const validVariants = formData.variants.filter(v => v.color || v.size || v.stock > 0 || v.price > 0);
      if (validVariants.length === 0) {
        toast.error('At least one variant is required');
        setSubmitting(false);
        return;
      }
      for (const v of validVariants) {
        await api.post(`/api/pos/products/${formData.selectedProductId}/variants?outlet=${encodeURIComponent(selectedOutlet)}`, {
          color: v.color || null,
          size: v.size || null,
          stock: v.stock || 0,
          price: v.price || 0
        });
      }
      toast.success('Product added to outlet inventory');
      setIsModalOpen(false);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add product');
    }
    setSubmitting(false);
  };

  const handleDeleteVariant = async (item) => {
    if (!window.confirm(`Delete variant "${item.name}" (${[item.color, item.size].filter(Boolean).join(' • ') || 'Default'})?`)) return;
    try {
      await api.delete(`/api/pos/variants/${item.id}`);
      toast.success('Variant deleted');
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete variant');
    }
  };

  const handleDeleteProduct = async (group) => {
    if (!window.confirm(`Delete ALL variants of "${group.name}" from ${group.outletName}?`)) return;
    try {
      const res = await api.delete(`/api/pos/products/${encodeURIComponent(group.name)}/variants?outlet=${encodeURIComponent(group.outletName)}`);
      toast.success(res.data.message);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const [customCategory, setCustomCategory] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('');

  /* ─── Initialize Inventory ─── */
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [initData, setInitData] = useState({});
  const [initProducts, setInitProducts] = useState([]);
  const [initLoading, setInitLoading] = useState(false);

  const openInitModal = useCallback(async () => {
    setInitLoading(true);
    setInitModalOpen(true);
    try {
      const res = await api.get('/api/inventory');
      const storeItems = res.data;
      setInitProducts(storeItems);
      const data = {};
      for (const item of storeItems) {
        let vdefs = [];
        if (item.variants) {
          const parsed = typeof item.variants === 'string' ? JSON.parse(item.variants) : item.variants;
          if (Array.isArray(parsed) && parsed.length > 0) {
            vdefs = parsed.map(v => ({ color: v.color || '', size: v.size || '' }));
          }
        }
        if (vdefs.length === 0) vdefs.push({ color: item.color || '', size: item.size || '' });
        data[item.id] = {
          name: item.name,
          category: item.category,
          fabric: item.fabric || '',
          imageUrl: item.imageUrl || '',
          variants: item.variants,
          sourceItemId: item.id,
          productVariants: vdefs.map(vd => ({
            color: vd.color, size: vd.size,
            stocks: { 'Johar Town': 0, 'Jail Road': 0, 'Abbottabad': 0 }
          }))
        };
      }
      setInitData(data);
    } catch (e) {
      toast.error('Failed to load store products for initialization');
    }
    setInitLoading(false);
  }, []);

  const handleInitStockChange = (sourceItemId, vi, outlet, value) => {
    setInitData(prev => {
      const updated = { ...prev };
      const product = { ...updated[sourceItemId], productVariants: [...updated[sourceItemId].productVariants] };
      const variant = { ...product.productVariants[vi], stocks: { ...product.productVariants[vi].stocks } };
      variant.stocks[outlet] = parseInt(value) || 0;
      product.productVariants[vi] = variant;
      updated[sourceItemId] = product;
      return updated;
    });
  };

  const handleInitSubmit = async () => {
    setInitSubmitting(true);
    try {
      const stockData = {};
      for (const outlet of ALL_OUTLETS) stockData[outlet] = [];
      for (const [sourceItemId, product] of Object.entries(initData)) {
        for (const v of product.productVariants) {
          for (const outlet of ALL_OUTLETS) {
            const stock = v.stocks[outlet] || 0;
            if (stock > 0) {
              stockData[outlet].push({
                sourceItemId,
                name: product.name,
                category: product.category,
                color: v.color || null,
                size: v.size || null,
                fabric: product.fabric || null,
                price: null,
                stock,
                imageUrl: product.imageUrl || null,
                variants: product.variants || null
              });
            }
          }
        }
      }
      const res = await api.post('/api/pos/initialize-inventory', { stockData });
      toast.success(`Initialized: ${res.data.summary.created} created, ${res.data.summary.updated} updated`);
      setInitModalOpen(false);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initialize inventory');
    }
    setInitSubmitting(false);
  };

  return (
    <div className="space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Outlet POS Inventory <span className="text-blue-400 text-base">[{selectedOutlet}]</span></h1>
          <p className="text-sm font-bold text-gray-400">
            {isReadOnly ? 'View-only — You are viewing another outlet' : 'Manage all outlet inventories'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canInit && (
            <button onClick={openInitModal} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-black px-4 py-3 rounded-xl text-sm">
              <Database size={16} />Init All
            </button>
          )}
          {canInit && (
            <button onClick={handleOpenModal} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-xl text-sm">
              <PlusCircle size={16} />Add Product
            </button>
          )}
          <button onClick={refresh} disabled={loading} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-black px-4 py-3 rounded-xl text-sm">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
          {canInit && (
            <>
              <input type="file" ref={backupJsonRef} onChange={handleImportJSON} accept=".json" className="hidden" />
              <input type="file" ref={backupExcelRef} onChange={handleImportExcel} accept=".xlsx,.xls" className="hidden" />
              <button onClick={handleExportJSON} disabled={backupLoading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-3 rounded-xl text-sm disabled:opacity-50">
                <Download size={16} />Export JSON
              </button>
              <button onClick={handleExportExcel} disabled={backupLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-3 rounded-xl text-sm disabled:opacity-50">
                <Download size={16} />Export Excel
              </button>
              <button onClick={() => backupJsonRef.current?.click()} disabled={backupLoading}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-3 rounded-xl text-sm disabled:opacity-50">
                <UploadCloud size={16} />Restore JSON
              </button>
              <button onClick={() => backupExcelRef.current?.click()} disabled={backupLoading}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-black px-4 py-3 rounded-xl text-sm disabled:opacity-50">
                <UploadCloud size={16} />Restore Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Outlet selector tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ALL_OUTLETS.map(outlet => {
          const isActive = outlet === selectedOutlet;
          return (
            <button key={outlet} onClick={() => setSelectedOutlet(outlet)}
              className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider transition-all ${
                isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {outlet}
            </button>
          );
        })}
      </div>
      {isReadOnly && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-2">
          <Eye size={14} className="text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold text-amber-400">View only — You are viewing another outlet's inventory. Switch to your outlet to make changes.</span>
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
          {grouped.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-bold">
              <Warehouse size={40} className="mx-auto mb-3 text-gray-700" />
              <p>No products found{search ? ' matching your search' : ''}.</p>
              {canInit && <p className="text-[10px] mt-1">Click <span className="text-violet-400">Init All</span> to pre-populate all outlets with opening stock.</p>}
              {!canInit && <p className="text-[10px] mt-1 text-gray-600">No products in catalog yet. Contact Store to add products.</p>}
            </div>
          )}
          {grouped.map(group => {
            const totalStock = group.variants.reduce((s, v) => s + (v.stock || 0), 0);
            const groupId = group.name + group.category + group.outletName;
            const isExpanded = expandedId === groupId;
            return (
              <div key={groupId} className="bg-gray-900/60 rounded-xl border border-gray-700/50">
                <button onClick={() => setExpandedId(isExpanded ? null : groupId)}
                  className="w-full flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {group.imageUrl ? <img src={group.imageUrl} className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center"><Package size={18} className="text-gray-500" /></div>}
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{group.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{group.category} {group.outletName && <span className="text-blue-400 ml-1">[{group.outletName}]</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && (
                      <>
                        {group.variants.length === 1 ? (
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(group.variants[0]); }}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-blue-600 rounded-lg transition-colors">
                            <Pencil size={12} className="text-white" />
                            <span className="text-[10px] font-bold text-white">Edit</span>
                          </button>
                        ) : null}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(group); }}
                          className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-red-600 rounded-lg transition-colors">
                          <Trash2 size={12} className="text-white" />
                          <span className="text-[10px] font-bold text-white">Delete</span>
                        </button>
                      </>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${totalStock > 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                      Stock: {totalStock}
                    </span>
                    {group.variants.length > 1 && (isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />)}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-700/50 pt-2 space-y-1.5">
                    {group.variants.map(v => (
                      <div key={v.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                        <span className="font-bold text-gray-300 min-w-[80px]">{[v.color, v.size].filter(Boolean).join(' • ') || 'Default'}</span>
                        <span className="text-[10px] font-mono text-gray-500 flex-1">{v.barcode || 'N/A'}</span>
                        <span className="font-bold text-emerald-400">{v.price ? formatCurrency(v.price) : '-'}</span>
                        <span className={`font-bold ml-2 ${v.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v.stock}</span>
                        {!isReadOnly && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(v); }}
                              className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors">
                              <Pencil size={11} className="text-white" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteVariant(v); }}
                              className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors">
                              <Trash2 size={11} className="text-white" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Initialize Inventory Modal ─── */}
      {initModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-gray-900 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-[2rem] border-2 border-gray-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Initialize All Outlets</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Set opening stock for each outlet</p>
              </div>
              <button onClick={() => setInitModalOpen(false)} className="p-3 bg-gray-800 text-gray-500 hover:text-white rounded-2xl transition-colors">
                <X size={20} />
              </button>
            </div>

            {initLoading ? (
              <div className="text-center py-12"><RefreshCw className="animate-spin text-blue-400 inline" size={32} /></div>
            ) : (
              <div className="space-y-4">
                <div className="text-[11px] text-gray-400 font-bold flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 rounded-xl px-4 py-3">
                  <Database size={14} className="text-blue-400 shrink-0" />
                  Set the initial stock quantity for each product variant in each outlet. Products with stock=0 will still appear in the catalog.
                </div>

                {initProducts.map(product => {
                  const pData = initData[product.id];
                  if (!pData || !pData.productVariants.length) return null;
                  return (
                    <div key={product.id} className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-4">
                      <p className="font-bold text-white text-sm mb-3">{product.name} <span className="text-[10px] text-gray-500">({product.category})</span></p>
                      {pData.productVariants.map((v, vi) => (
                        <div key={`${v.color}|${v.size}`} className="grid grid-cols-5 gap-2 items-center mb-2 last:mb-0">
                          <span className="text-[11px] font-bold text-gray-300 col-span-1">{[v.color, v.size].filter(Boolean).join(' • ') || 'Default'}</span>
                          {ALL_OUTLETS.map(outlet => (
                            <div key={outlet} className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 font-bold uppercase w-[14px]">{outlet === 'Johar Town' ? 'JT' : outlet === 'Jail Road' ? 'JR' : 'AB'}</span>
                              <input type="number" min="0" value={v.stocks[outlet]}
                                onChange={(e) => handleInitStockChange(product.id, vi, outlet, e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-1.5 px-2 text-xs font-bold text-white outline-none focus:border-blue-500 text-center" />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {initProducts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 font-bold">
                    <Package size={32} className="mx-auto mb-2 text-gray-700" />
                    <p>No products found in store catalog. Add products first.</p>
                  </div>
                )}

                <button onClick={handleInitSubmit} disabled={initSubmitting || initProducts.length === 0}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                  {initSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Database size={18} />}
                  <span>{initSubmitting ? 'Initializing...' : 'Save Opening Stock for All Outlets'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Add Product Modal ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-gray-900 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-[2rem] border-2 border-gray-700 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Add Product to Inventory</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Select from store catalog and configure variants</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-gray-800 text-gray-500 hover:text-white rounded-2xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Select Store Product</label>
                {storeProductsLoading ? (
                  <div className="py-4 text-center"><RefreshCw className="animate-spin text-blue-400 inline" size={20} /></div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-800 rounded-xl border border-gray-700 p-2">
                    {storeProducts.map(sp => {
                      const spVariants = (() => {
                        if (!sp.variants) return null;
                        const p = typeof sp.variants === 'string' ? JSON.parse(sp.variants) : sp.variants;
                        return Array.isArray(p) && p.length > 0 ? p : null;
                      })();
                      const colorLabel = spVariants ? [...new Set(spVariants.map(v => v.color || '').filter(Boolean))].join(', ') : (sp.color || 'N/A');
                      const sizeLabel = spVariants ? [...new Set(spVariants.map(v => v.size || '').filter(Boolean))].join(', ') : (sp.size || 'N/A');
                      const priceLabel = spVariants ? [...new Set(spVariants.map(v => v.price || 0))].join(', ') : (sp.price || 'N/A');
                      return (
                        <button key={sp.id} type="button"
                          onClick={() => {
                            const selected = storeProducts.find(p => p.id === sp.id);
                            let newVariants = [];
                            if (spVariants) {
                              newVariants = spVariants.map(v => ({ color: v.color || '', size: v.size || '', stock: 0, price: v.price || 0 }));
                            } else {
                              newVariants = [{ color: selected.color || '', size: selected.size || '', stock: 0, price: selected.price || 0 }];
                            }
                            setFormData(prev => ({ ...prev, selectedProductId: sp.id, variants: newVariants }));
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                            formData.selectedProductId === sp.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                          }`}>
                          <div className="flex flex-col">
                            <span>{sp.name} <span className="text-[10px] opacity-60 uppercase">({sp.category})</span></span>
                            {formData.selectedProductId === sp.id && (
                              <span className="text-[10px] mt-0.5 opacity-80">
                                Color: {colorLabel} | Size: {sizeLabel} | Price: ₨{priceLabel}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {storeProducts.length === 0 && <p className="text-gray-500 text-xs text-center py-2">No store products available</p>}
                  </div>
                )}
              </div>

              {formData.selectedProductId && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Variants (Color × Size × Stock × Price)</label>
                      <button type="button" onClick={addVariant}
                        className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all">
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.variants.map((v, vi) => (
                        <div key={vi} className="grid grid-cols-12 gap-2 items-center bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                          <div className="col-span-3">
                            <input type="text" value={v.color} placeholder="Color"
                              onChange={(e) => updateVariantField(vi, 'color', e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                          </div>
                          <div className="col-span-2">
                            <input type="text" value={v.size} placeholder="Size"
                              onChange={(e) => updateVariantField(vi, 'size', e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-3 text-xs font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500" />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">₨</span>
                              <input type="number" min="0" step="0.01" value={v.price}
                                onChange={(e) => updateVariantField(vi, 'price', parseFloat(e.target.value) || 0)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 pl-5 pr-2 text-xs font-bold text-white outline-none focus:border-blue-500" />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="0" value={v.stock}
                              onChange={(e) => updateVariantField(vi, 'stock', parseInt(e.target.value) || 0)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2.5 px-2 text-xs font-bold text-white outline-none focus:border-blue-500 text-center" />
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

                  <button type="submit" disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-95">
                    {submitting ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    <span>{submitting ? 'Adding...' : 'Add to Outlet Inventory'}</span>
                  </button>
                </>
              )}
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
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Edit Inventory Item</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{editItem.name}</p>
              </div>
              <button onClick={() => { setEditModalOpen(false); setEditItem(null); }} className="p-3 bg-gray-800 text-gray-500 hover:text-white rounded-2xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Product Details</label>
                <div className="space-y-2">
                  <input type="text" value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-4 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all"
                    placeholder="Product Name" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col">
                      <select value={editForm.category}
                        onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-3 font-bold text-white uppercase outline-none focus:border-blue-500 transition-all">
                        {['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT', 'ACCESSORIES'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="CUSTOM">— ENTER CUSTOM CATEGORY —</option>
                      </select>
                      {editForm.category === 'CUSTOM' && (
                        <input type="text" required value={editCustomCategory}
                          onChange={(e) => setEditCustomCategory(e.target.value)}
                          className="w-full bg-gray-850 border border-blue-500/50 rounded-xl py-2 px-3 font-bold text-white placeholder-gray-500 outline-none mt-1 text-xs uppercase"
                          placeholder="Type custom category" />
                      )}
                    </div>
                    <input type="text" value={editForm.fabric} placeholder="Fabric"
                      onChange={(e) => setEditForm({...editForm, fabric: e.target.value})}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-3 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all" />
                  </div>
                  <input type="text" value={editForm.imageUrl} placeholder="Image URL"
                    onChange={(e) => setEditForm({...editForm, imageUrl: e.target.value})}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 px-4 font-bold text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Variant (Color × Size × Stock × Price)</label>
                <div className="space-y-1.5">
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
                      <div className="col-span-2 flex justify-center">
                        <span className="text-[9px] font-mono text-gray-500 truncate">{v.barcode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
