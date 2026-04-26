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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InventoryManagement = () => {
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
    fabric: ''
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/api/inventory`);
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
        fabric: item.fabric || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'SCRUBS', stock: 0, price: 0, color: '', fabric: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      if (editingItem) {
        await axios.put(`${API_URL}/api/inventory/${editingItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/api/inventory`, formData);
      }
      fetchInventory();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving inventory item:', error);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.color && item.color.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/20 rotate-2">
            <Package className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Inventory Control</h1>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">Master Product Management</p>
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-8 rounded-2xl shadow-2xl shadow-blue-900/30 transition-all flex items-center space-x-3 active:scale-95"
        >
          <PlusCircle size={24} />
          <span>INITIALIZE NEW STOCK</span>
        </button>
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
          {['ALL', 'SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'COLOR'].map(cat => (
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
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl shadow-xl ${
                  ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category) ? 'bg-blue-600/10 text-blue-400' :
                  item.category === 'FABRIC' ? 'bg-emerald-600/10 text-emerald-400' :
                  'bg-purple-600/10 text-purple-400'
                }`}>
                  {['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category) ? <Package size={24} /> : 
                   item.category === 'FABRIC' ? <Layers size={24} /> : <Palette size={24} />}
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => handleOpenModal(item)} className="p-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-xl text-white group-hover:text-emerald-400 transition-colors truncate">{item.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{item.category}</span>
                  {(item.color || item.fabric) && <div className="w-1 h-1 rounded-full bg-gray-800" />}
                  <span className="text-[10px] font-bold text-gray-400 uppercase italic">
                    {[item.color, item.fabric].filter(Boolean).join(' • ')}
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
              className="glass max-w-xl w-full p-10 rounded-[3rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden"
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

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">Product Description</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-6 focus:border-blue-600 outline-none transition-all font-bold text-lg"
                      placeholder="e.g. Ultra-Flex Scrub Top"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">Universal Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-6 outline-none font-bold text-gray-300 appearance-none"
                      >
                        <option value="SCRUBS">Scrubs</option>
                        <option value="COAT">Coat</option>
                        <option value="MASK">Mask</option>
                        <option value="SOCKS">Socks</option>
                        <option value="CAPS">Caps</option>
                        <option value="FABRIC">Fabric</option>
                        <option value="COLOR">Color</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">Current Stock Level</label>
                      <input
                        type="number"
                        required
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-6 focus:border-blue-600 outline-none font-black text-xl"
                      />
                    </div>
                  </div>

                  {/* New Fields: Color & Fabric */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1 text-purple-400">Fixed Color</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({...formData, color: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-6 focus:border-purple-600 outline-none transition-all font-bold"
                        placeholder="e.g. Royal Blue"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1 text-emerald-400">Fixed Fabric</label>
                      <input
                        type="text"
                        value={formData.fabric}
                        onChange={(e) => setFormData({...formData, fabric: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-6 focus:border-emerald-600 outline-none transition-all font-bold"
                        placeholder="e.g. Cotton Blend"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-2xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center space-x-3 active:scale-95 text-sm uppercase tracking-widest"
                  >
                    <Save size={24} />
                    <span>{editingItem ? 'Update Master Catalog' : 'Initialize Stock Asset'}</span>
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
