import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../components/Button';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  Palette, 
  Layers, 
  RefreshCcw,
  PlusCircle,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Upload,
  Image as ImageIcon,
  Hash,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePolling } from '../hooks/usePolling';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const InventoryManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();

  if (authLoading) {
    return null;
  }

  const userRole = String(user?.role || '').toUpperCase().trim();
  if (user && !['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'STORE'].includes(userRole)) {
    return <Navigate to="/dashboard" replace={true} />;
  }
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const VARIANTS_PREVIEW = 3;
  const [formData, setFormData] = useState({
    name: '',
    category: 'SCRUBS',
    fabric: '',
    imageUrl: '',
    variants: [{ color: '', size: '', stock: 0, price: 0 }]
  });

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, imageUrl: response.data.url }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Only images up to 5MB are allowed.');
    }
    setUploading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
    setLoading(false);
  };

  usePolling(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data);
    } catch (error) {}
  }, 15000);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        fabric: item.fabric || '',
        imageUrl: item.imageUrl || '',
        variants: (item.variants && Array.isArray(item.variants) && item.variants.length > 0)
          ? item.variants.map(v => ({ ...v }))
          : [{ color: item.color || '', size: item.size || '', stock: item.stock || 0, price: item.price || 0 }]
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'SCRUBS', fabric: '', imageUrl: '', variants: [{ color: '', size: '', stock: 0, price: 0 }] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        name: formData.name,
        category: formData.category,
        fabric: formData.fabric,
        imageUrl: formData.imageUrl,
        variants: formData.variants.filter(v => v.color || v.size || parseInt(v.stock) > 0)
      };
      if (editingItem) {
        await axios.put(`${API_URL}/api/inventory/${editingItem.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/api/inventory`, payload, { headers });
      }
      fetchInventory();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving inventory item:', error);
    }
  };

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

  const updateVariant = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const totalStock = formData.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

  const filteredItems = items.filter(item => {
    const term = searchTerm.toLowerCase();
    if (item.name?.toLowerCase().includes(term)) return true;
    if (item.category?.toLowerCase().includes(term)) return true;
    if (item.color?.toLowerCase().includes(term)) return true;
    if (item.variants && Array.isArray(item.variants)) {
      if (item.variants.some(v => 
        (v.color && v.color.toLowerCase().includes(term)) ||
        (v.size && v.size.toLowerCase().includes(term))
      )) return true;
    }
    return false;
  });

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_URL}/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInventory();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
    }
  };

  const fileInputRef = React.useRef(null);

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/inventory/bulk-upload`, uploadData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert(`Success! Imported ${response.data.count} items.`);
      fetchInventory();
    } catch (error) {
      console.error('Bulk upload failed:', error);
      alert('Failed to upload Excel file: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uniqueCategories = [...new Set(items.map(item => item.category?.toUpperCase()).filter(Boolean))];
  const defaultCategories = ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC'];
  const allCategories = [...new Set([...defaultCategories, ...uniqueCategories])];

  return (
    <div className="space-y-8 pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/20 rotate-2">
            <Package className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black theme-text-primary tracking-tight">Inventory</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Master Product Management</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            className="hidden" 
          />
          {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/30 font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center space-x-3 active:scale-95"
              >
                <Upload size={24} />
                <span className="hidden sm:inline">Bulk Import (Excel/CSV)</span>
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('⚠️  Delete ALL inventory items?\n\nThis action CANNOT be undone!')) return;
                  if (window.prompt('Type "DELETE ALL" to confirm:') !== 'DELETE ALL') return;
                  try {
                    const token = sessionStorage.getItem('token');
                    await axios.delete(`${API_URL}/api/inventory`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    fetchInventory();
                  } catch (error) {
                    console.error('Error clearing inventory:', error);
                  }
                }}
                className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black py-4 px-6 rounded-2xl border border-red-500/30 transition-all flex items-center space-x-3 active:scale-95"
              >
                <Trash2 size={20} />
                <span className="hidden sm:inline text-sm">Delete All</span>
              </button>
            </>
          )}
          <button 
            onClick={() => handleOpenModal()}
            className="btn-solid-primary btn-xl"
          >
            <PlusCircle size={24} />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search catalog by name, color, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full theme-input rounded-2xl py-4 pl-14 pr-6"
          />
        </div>
        <div className="flex theme-bg-subtle border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
          {['ALL', ...allCategories].map(cat => (
            <button 
              key={cat} 
              onClick={() => setSearchTerm(cat === 'ALL' ? '' : cat)}
              className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all whitespace-nowrap ${
                (searchTerm === cat || (cat === 'ALL' && searchTerm === '')) 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'theme-text-muted hover:text-white hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4">
              <RefreshCcw className="animate-spin text-blue-500" size={48} />
              <p className="text-gray-500 font-black text-xs uppercase tracking-widest">Accessing Secure Database...</p>
            </div>
          ) : filteredItems.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03 }}
              className="glass p-8 rounded-[2.5rem] border-2 theme-border hover:border-emerald-500/40 transition-all group relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl shadow-xl overflow-hidden ${
                  ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category || '') ? 'bg-blue-600/10 text-blue-400' :
                  item.category === 'FABRIC' ? 'bg-emerald-600/10 text-emerald-400' :
                  'bg-purple-600/10 text-purple-400'
                }`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-6 h-6 object-cover rounded-md" />
                  ) : (
                    ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category || '') ? <Package size={24} /> : 
                    item.category === 'FABRIC' ? <Layers size={24} /> : <Palette size={24} />
                  )}
                </div>
                <div className="flex space-x-2 relative z-10">
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }} className="p-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-xl theme-text-primary group-hover:text-emerald-400 transition-colors leading-tight">{item.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest theme-text-muted">{item.category}</span>
                  {(item.fabric) && <><div className="w-1 h-1 rounded-full bg-gray-800" /><span className="text-[10px] font-bold theme-text-secondary uppercase italic">{item.fabric}</span></>}
                </div>
              </div>

              {/* Variants List */}
              {(item.variants && Array.isArray(item.variants) && item.variants.length > 0) ? (
                <div className="mt-6 space-y-2">
                  {item.variants.slice(0, expandedItems[item.id] ? item.variants.length : VARIANTS_PREVIEW).map((v, vi) => (
                    <div key={vi} className="flex items-center justify-between theme-bg-subtle rounded-xl px-4 py-2.5 theme-border">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full border-2 border-gray-700" style={{ backgroundColor: v.color ? undefined : 'transparent' }} />
                        <span className="text-xs font-bold theme-text-secondary">
                          {[v.color, v.size].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-black theme-text-primary">{v.stock}</span>
                        {v.price > 0 && <span className="text-[10px] font-bold text-emerald-500">₨{v.price}</span>}
                      </div>
                    </div>
                  ))}
                  {item.variants.length > VARIANTS_PREVIEW && (
                    <button
                      onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest theme-text-muted hover:text-emerald-400 transition-all"
                    >
                      {expandedItems[item.id] ? '▲ Show Less' : `▼ Show More (${item.variants.length - VARIANTS_PREVIEW} more)`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-6 flex items-center justify-between theme-bg-subtle rounded-xl px-4 py-2.5 theme-border">
                  <span className="text-xs font-bold theme-text-secondary">
                    {[item.color, item.size].filter(Boolean).join(' • ') || 'Standard'}
                  </span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-black theme-text-primary">{item.stock}</span>
                    {item.price > 0 && <span className="text-[10px] font-bold text-emerald-500">₨{item.price}</span>}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <span className="block text-4xl font-black theme-text-primary tracking-tighter">
                    {item.variants && Array.isArray(item.variants) 
                      ? item.variants.reduce((s, v) => s + (v.stock || 0), 0)
                      : item.stock}
                  </span>
                  <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Total Units</span>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 ${
                  (item.stock || 0) > 50 ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 
                  (item.stock || 0) > 0 ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500' : 
                  'border-red-500/20 bg-red-500/5 text-red-500'
                }`}>
                  {(item.stock || 0) > 50 ? 'STOCK SECURE' : (item.stock || 0) > 0 ? 'REPLENISH' : 'DEPLETED'}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="glass max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative"
            >
              <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 pointer-events-none">
                <Package size={200} />
              </div>

              <div className="relative z-10">
                <div className="flex justify-between items-center mb-10">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black theme-text-primary uppercase tracking-tighter">
                      {editingItem ? 'Update Prototype' : 'Initialize Product'}
                    </h2>
                    <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Universal Catalog Entry</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-3 bg-gray-900 text-gray-500 hover:text-white rounded-2xl transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 mb-1">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <ClipboardList size={16} className="text-blue-400" />
                      </div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Product Specification</label>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full theme-input rounded-[1.5rem] py-5 px-8 shadow-inner font-bold text-lg"
                      placeholder="e.g. Ultra-Flex Scrub Top"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Layers size={16} className="text-purple-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Category</label>
                      </div>
                      <input
                        list="category-options"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value.toUpperCase()})}
                        className="w-full theme-input rounded-[1.25rem] py-4 px-6 font-bold uppercase"
                        placeholder="Type or select category..."
                      />
                      <datalist id="category-options">
                        {allCategories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <Layers size={16} className="text-indigo-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Material/Fabric</label>
                      </div>
                      <input
                        type="text"
                        value={formData.fabric}
                        onChange={(e) => setFormData({...formData, fabric: e.target.value})}
                        className="w-full theme-input rounded-[1.25rem] py-4 px-6 shadow-inner font-bold"
                        placeholder="e.g. Cotton Blend"
                      />
                    </div>
                  </div>

                  {/* Variants Builder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-pink-500/10 rounded-lg">
                          <Hash size={16} className="text-pink-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Variants (Color × Size × Stock × Price)</label>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-black text-emerald-400">Total: {totalStock}</span>
                        <button type="button" onClick={addVariant}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {formData.variants.map((v, vi) => (
                        <div key={vi} className="grid grid-cols-12 gap-2 items-center theme-bg-subtle rounded-xl p-3 theme-border">
                          <div className="col-span-3">
                            <input type="text" value={v.color} placeholder="Color"
                              onChange={(e) => updateVariant(vi, 'color', e.target.value)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-bold transition-all"
                            />
                          </div>
                          <div className="col-span-2">
                            <input type="text" value={v.size} placeholder="Size"
                              onChange={(e) => updateVariant(vi, 'size', e.target.value)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-bold transition-all"
                            />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="0" value={v.stock} placeholder="Qty"
                              onChange={(e) => updateVariant(vi, 'stock', parseInt(e.target.value) || 0)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-black transition-all"
                            />
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="0" step="0.01" value={v.price} placeholder="Price"
                              onChange={(e) => updateVariant(vi, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-black transition-all"
                            />
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
                      className="w-full py-3 border-2 border-dashed border-gray-800 rounded-xl text-[10px] font-black text-gray-600 uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all flex items-center justify-center space-x-2">
                      <Plus size={14} />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 mb-1">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <ImageIcon size={16} className="text-yellow-400" />
                      </div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Product Image</label>
                    </div>
                    
                    <div 
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`relative w-48 h-48 rounded-[1.25rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 overflow-hidden ${
                        dragActive ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-800 bg-gray-950/50'
                      } ${formData.imageUrl ? 'border-solid border-emerald-500/40' : ''}`}
                    >
                      {formData.imageUrl ? (
                        <>
                          <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2 backdrop-blur-sm">
                            <Upload size={32} className="text-white" />
                            <span className="text-[10px] font-black text-white uppercase">Replace</span>
                          </div>
                        </>
                      ) : (
                        <>
                          {uploading ? (
                            <RefreshCcw size={32} className="text-yellow-500 animate-spin" />
                          ) : (
                            <Upload size={32} className="text-gray-700" />
                          )}
                          <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{uploading ? 'Processing...' : 'Drop image'}</p>
                            <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase">or click</p>
                          </div>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => handleFileUpload(e.target.files[0])}
                        accept="image/*"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit"
                    variant="primary"
                    size="xl"
                    icon={CheckCircle2}
                    className="w-full justify-center"
                  >
                    {editingItem ? 'Finalize Master Update' : 'Initialize Stock Asset'}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryManagement;
