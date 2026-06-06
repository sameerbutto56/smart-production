import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ShoppingCart, Package, Building2, CheckCircle2, XCircle, AlertTriangle,
  RefreshCcw, Search, Clock, Plus, Minus, Send, Eye, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { usePolling } from '../hooks/usePolling';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const OutletStockRequest = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState('request');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const outletName = user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
    user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
    user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : (user?.name || 'Outlet');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const pollData = useCallback(async () => {
    const token = sessionStorage.getItem('token');
    try {
      if (activeTab === 'request') {
        const invRes = await axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setInventory(invRes.data);
      } else {
        const reqRes = await axios.get(`${API_URL}/api/stock-requests`, { headers: { Authorization: `Bearer ${token}` } });
        setRequests(reqRes.data);
      }
    } catch (error) {}
  }, [activeTab]);

  usePolling(pollData, 10000);

  const fetchData = async () => {
    setLoading(true);
    const token = sessionStorage.getItem('token');
    try {
      if (activeTab === 'request') {
        const invRes = await axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setInventory(invRes.data);
      } else {
        const reqRes = await axios.get(`${API_URL}/api/stock-requests`, { headers: { Authorization: `Bearer ${token}` } });
        setRequests(reqRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const addToCart = (item) => {
    setCart(prev => ({
      ...prev,
      [item.id]: { ...item, qty: (prev[item.id]?.qty || 0) + 1 }
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        if (updated[itemId].qty <= 1) {
          delete updated[itemId];
        } else {
          updated[itemId] = { ...updated[itemId], qty: updated[itemId].qty - 1 };
        }
      }
      return updated;
    });
  };

  const clearCart = () => setCart({});

  const submitRequest = async () => {
    const items = Object.values(cart);
    if (!items.length) {
      toast.error('Add at least one item to request');
      return;
    }
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      const payload = {
        outletName,
        items: items.map(i => ({
          itemName: i.name,
          itemCategory: i.category,
          quantity: i.qty,
        }))
      };
      await axios.post(`${API_URL}/api/stock-requests`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Request sent! ${items.length} item(s) requested from warehouse`);
      setCart({});
      setActiveTab('status');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    }
    setSubmitting(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIALLY_APPROVED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'REJECTED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'COMPLETED': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const filteredInventory = inventory.filter(item =>
    !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const categories = [...new Set(inventory.map(i => i.category).filter(Boolean))];

  const statusCounts = {
    pending: requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length,
    rejected: requests.filter(r => r.status === 'REJECTED').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 rotate-2">
            <Building2 className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black theme-text-primary tracking-tight">{outletName}</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Outlet Stock Request Portal</p>
          </div>
        </div>
        <button onClick={fetchData} className="theme-bg-subtle hover:bg-gray-700 theme-text-primary font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95 border theme-border">
          <RefreshCcw size={20} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('request')}
          className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'request' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <ShoppingCart size={14} />
          <span>Request Stock {cartTotal > 0 && <span className="ml-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{cartTotal}</span>}</span>
        </button>
        <button onClick={() => setActiveTab('status')}
          className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'status' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <ClipboardList size={14} />
          <span>Request Status {statusCounts.pending > 0 && <span className="ml-1 bg-yellow-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{statusCounts.pending}</span>}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center space-y-4">
          <RefreshCcw className="animate-spin text-blue-500" size={48} />
          <p className="theme-text-muted font-black text-xs uppercase tracking-widest">Loading...</p>
        </div>
      ) : (
        <>
          {/* Stock Request Tab */}
          {activeTab === 'request' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Inventory Items */}
              <div className="lg:col-span-2 space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input type="text" placeholder="Search items to request..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full theme-input rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500 transition-all font-medium"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSearchTerm('')}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl border transition-all ${
                      !searchTerm ? 'bg-blue-600 text-white border-blue-500' : 'theme-bg theme-text-muted theme-border hover:text-white'
                    }`}>All</button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSearchTerm(cat)}
                      className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl border transition-all ${
                        searchTerm === cat ? 'bg-blue-600 text-white border-blue-500' : 'theme-bg theme-text-muted theme-border hover:text-white'
                      }`}>{cat}</button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredInventory.map((item, i) => {
                    const inCart = cart[item.id];
                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="glass p-5 rounded-2xl border-2 theme-border hover:border-blue-500/30 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                            <p className="text-[10px] font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${
                            item.stock <= 10 ? 'border-red-500/20 bg-red-500/5 text-red-500' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'
                          }`}>
                            {item.stock} left
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <p className="text-lg font-bold theme-text-secondary">{item.color ? [item.color, item.size].filter(Boolean).join(' • ') : item.size || item.fabric || ''}</p>
                          <div className="flex items-center space-x-2">
                            {inCart ? (
                              <>
                                <button onClick={() => removeFromCart(item.id)} className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all">
                                  <Minus size={16} />
                                </button>
                                <span className="font-black text-white w-8 text-center">{inCart.qty}</span>
                                <button onClick={() => addToCart(item)} className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all">
                                  <Plus size={16} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => addToCart(item)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all flex items-center space-x-2 active:scale-95">
                                <Plus size={14} />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Cart Sidebar */}
              <div className="glass p-6 rounded-2xl border-2 theme-border lg:sticky lg:top-6 h-fit">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-2">
                    <ShoppingCart size={18} />
                    <span>Cart</span>
                  </h2>
                  {cartItems.length > 0 && (
                    <button onClick={clearCart} className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-wider">Clear</button>
                  )}
                </div>

                {cartItems.length === 0 ? (
                  <div className="text-center py-10">
                    <Package size={40} className="mx-auto text-gray-700 mb-3" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">Cart is empty</p>
                    <p className="text-[10px] theme-text-muted font-bold mt-1">Add items to request stock</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 theme-bg-subtle rounded-xl border theme-border">
                        <div className="flex-1">
                          <p className="font-bold theme-text-primary text-xs">{item.name}</p>
                          <p className="text-[9px] theme-text-muted font-bold uppercase">{item.category}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => removeFromCart(item.id)} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all">
                            <Minus size={12} />
                          </button>
                          <span className="font-black text-white text-sm w-6 text-center">{item.qty}</span>
                          <button onClick={() => addToCart(item)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {cartItems.length > 0 && (
                  <>
                    <div className="flex justify-between items-center py-3 border-t theme-border mb-4">
                      <span className="text-xs font-bold theme-text-muted uppercase tracking-wider">Total Items</span>
                      <span className="font-black theme-text-primary text-lg">{cartTotal}</span>
                    </div>
                    <button onClick={submitRequest} disabled={submitting}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all flex items-center justify-center space-x-3 active:scale-95">
                      {submitting ? (
                        <RefreshCcw size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                      <span>{submitting ? 'Sending...' : 'Send Request to Warehouse'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Request Status Tab */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* Status Counts */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-4 rounded-2xl border-2 theme-border">
                  <p className="text-2xl font-black text-yellow-400">{statusCounts.pending}</p>
                  <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Pending</p>
                </div>
                <div className="glass p-4 rounded-2xl border-2 theme-border">
                  <p className="text-2xl font-black text-emerald-400">{statusCounts.approved}</p>
                  <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Approved</p>
                </div>
                <div className="glass p-4 rounded-2xl border-2 theme-border">
                  <p className="text-2xl font-black text-red-400">{statusCounts.rejected}</p>
                  <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Rejected</p>
                </div>
                <div className="glass p-4 rounded-2xl border-2 theme-border">
                  <p className="text-2xl font-black text-purple-400">{statusCounts.completed}</p>
                  <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Completed</p>
                </div>
              </div>

              {/* Request List */}
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <div className="text-center py-16">
                    <ClipboardList size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No requests yet</p>
                    <p className="text-[10px] theme-text-muted font-bold mt-1">Go to Request Stock tab to place an order</p>
                  </div>
                ) : (
                  requests.map((req, i) => {
                    const sc = getStatusColor(req.status);
                    const statusIcon = {
                      'PENDING': <Clock size={14} />,
                      'APPROVED': <CheckCircle2 size={14} />,
                      'PARTIALLY_APPROVED': <AlertTriangle size={14} />,
                      'REJECTED': <XCircle size={14} />,
                      'COMPLETED': <CheckCircle2 size={14} />,
                    }[req.status];
                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="glass p-5 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-xl ${sc}`}>
                              {statusIcon}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="font-black theme-text-primary">{req.itemName}</p>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${sc}`}>{req.status.replace('_', ' ')}</span>
                              </div>
                              <div className="flex items-center space-x-4 mt-1">
                                <p className="text-[10px] font-bold theme-text-muted">Requested: {req.quantity}</p>
                                <p className="text-[10px] font-bold text-emerald-500">Approved: {req.approvedQty}</p>
                                <p className="text-[10px] font-bold theme-text-muted">{new Date(req.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-lg font-black theme-text-primary">{req.quantity - req.approvedQty}</p>
                              <p className="text-[9px] theme-text-muted font-bold uppercase">Pending</p>
                            </div>
                          </div>
                        </div>
                        {req.notes && (
                          <div className="mt-3 p-3 theme-bg-subtle rounded-xl border theme-border">
                            <p className="text-[9px] font-black theme-text-muted uppercase tracking-wider">Store Notes</p>
                            <p className="text-sm theme-text-primary font-medium mt-1">{req.notes}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OutletStockRequest;
