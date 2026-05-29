import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const InventoryManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();

  if (authLoading) {
    return null;
  }

  const userRole = String(user?.role || '').toUpperCase().trim();
  if (user && !['SUPER_ADMIN', 'ADMIN', 'FAISAL'].includes(userRole)) {
    return <Navigate to="/dashboard" replace={true} />;
  }
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'SCRUBS',
    stock: 0,
    price: 0,
    color: '',
    fabric: '',
    imageUrl: ''
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

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        stock: item.stock,
        price: item.price || 0,
        color: item.color || '',
        fabric: item.fabric || '',
        imageUrl: item.imageUrl || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'SCRUBS', stock: 0, price: 0, color: '', fabric: '', imageUrl: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      if (editingItem) {
        await axios.put(`${API_URL}/api/inventory/${editingItem.id}`, formData, { headers });
      } else {
        await axios.post(`${API_URL}/api/inventory`, formData, { headers });
      }
      fetchInventory();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving inventory item:', error);
    }
  };

  const filteredItems = items.filter(item => 
    (item.name && item.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.color && item.color.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            <h1 className="text-3xl font-black text-white tracking-tight">Inventory</h1>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">Master Product Management</p>
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
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/30 font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center space-x-3 active:scale-95"
          >
            <Upload size={24} />
            <span className="hidden sm:inline">Bulk Import (Excel/CSV)</span>
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-8 rounded-2xl shadow-2xl shadow-blue-900/30 transition-all flex items-center space-x-3 active:scale-95"
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
            className="w-full bg-gray-950 border-2 border-gray-900 rounded-2xl py-4 pl-14 pr-6 focus:outline-none focus:border-emerald-500 transition-all font-medium text-gray-300"
          />
        </div>
        <div className="flex bg-gray-950 border-2 border-gray-900 rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
          {['ALL', ...allCategories].map(cat => (
            <button 
              key={cat} 
              onClick={() => setSearchTerm(cat === 'ALL' ? '' : cat)}
              className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all whitespace-nowrap ${
                (searchTerm === cat || (cat === 'ALL' && searchTerm === '')) 
                  ? 'bg-emerald-600 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
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
              className="glass p-8 rounded-[2.5rem] border-2 border-gray-900 hover:border-emerald-500/40 transition-all group relative overflow-hidden"
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
                <h3 className="font-black text-xl text-white group-hover:text-emerald-400 transition-colors leading-tight">{item.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{item.category}</span>
                  {(item.color || item.size || item.fabric) && <div className="w-1 h-1 rounded-full bg-gray-800" />}
                  <span className="text-[10px] font-bold text-gray-400 uppercase italic">
                    {[item.color, item.size, item.fabric].filter(Boolean).join(' • ')}
                  </span>
                </div>
              </div>

              <div className="mt-10 flex items-end justify-between">
                <div>
                  <span className="block text-4xl font-black text-white tracking-tighter">{item.stock}</span>
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Units Ready</span>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 ${
                  item.stock > 50 ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 
                  item.stock > 0 ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500' : 
                  'border-red-500/20 bg-red-500/5 text-red-500'
                }`}>
                  {item.stock > 50 ? 'STOCK SECURE' : item.stock > 0 ? 'REPLENISH' : 'DEPLETED'}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="glass max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative"
            >
              <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 pointer-events-none">
                <Package size={200} />
              </div>

              <div className="relative z-10">
                <div className="flex justify-between items-center mb-10">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                      {editingItem ? 'Update Prototype' : 'Initialize Product'}
                    </h2>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Universal Catalog Entry</p>
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
                      className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.5rem] py-5 px-8 focus:border-blue-500 outline-none transition-all font-bold text-lg text-white shadow-inner"
                      placeholder="e.g. Ultra-Flex Scrub Top"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                        className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 px-6 outline-none font-bold text-gray-300 focus:border-purple-500 uppercase"
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
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Package size={16} className="text-emerald-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Stock Count</label>
                      </div>
                      <input
                        type="number"
                        required
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 px-6 focus:border-emerald-500 outline-none font-black text-xl text-white shadow-inner"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <Save size={16} className="text-emerald-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Unit Price</label>
                      </div>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                          className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 pl-12 pr-6 focus:border-emerald-500 outline-none font-black text-xl text-emerald-400 shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-pink-500/10 rounded-lg">
                          <Palette size={16} className="text-pink-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Primary Color</label>
                      </div>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({...formData, color: e.target.value})}
                        className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 px-6 focus:border-pink-500 outline-none transition-all font-bold text-white shadow-inner"
                        placeholder="e.g. Royal Blue"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Layers size={16} className="text-blue-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Size</label>
                      </div>
                      <input
                        type="text"
                        value={formData.size || ''}
                        onChange={(e) => setFormData({...formData, size: e.target.value})}
                        className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 px-6 focus:border-blue-500 outline-none transition-all font-bold text-white shadow-inner"
                        placeholder="e.g. XL, 35, 10"
                      />
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
                        className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-[1.25rem] py-4 px-6 focus:border-indigo-500 outline-none transition-all font-bold text-white shadow-inner"
                        placeholder="e.g. Cotton Blend"
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                          <ImageIcon size={16} className="text-yellow-400" />
                        </div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Product Image (Drag & Drop)</label>
                      </div>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`relative w-full aspect-video rounded-[1.25rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 overflow-hidden ${
                          dragActive ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-800 bg-gray-950/50'
                        } ${formData.imageUrl ? 'border-solid border-emerald-500/40' : ''}`}
                      >
                        {formData.imageUrl ? (
                          <>
                            <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2 backdrop-blur-sm">
                              <Upload size={32} className="text-white" />
                              <span className="text-[10px] font-black text-white uppercase">Replace Photo</span>
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
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{uploading ? 'Processing Image...' : 'Drop image here'}</p>
                              <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase">or click to browse</p>
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
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-6 rounded-[1.5rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center space-x-4 active:scale-[0.98] text-sm uppercase tracking-[0.2em]"
                  >
                    <CheckCircle2 size={24} />
                    <span>{editingItem ? 'Finalize Master Update' : 'Initialize Stock Asset'}</span>
                  </button>
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
