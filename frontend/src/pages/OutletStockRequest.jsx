import React, { useState } from 'react';
import api from '../services/api';
import {
    ShoppingCart, Package, Building2,
    RefreshCcw, Search, Plus, Minus, Send, ClipboardList,
    Warehouse, Trash2, Download, ArrowLeftRight, CheckCircle
  } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';
import useCache from '../hooks/useCache';

const OutletStockRequest = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('demand');

  const outletName = user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
    user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
    user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : (user?.name || 'Outlet');

  // Cache-first: warehouse inventory for demand tab
  const { data: inventory = [], loading, refresh: refreshInventory } = useCache(
    activeTab === 'demand' ? 'outlet:demand:inventory' : null,
    { fetcher: () => api.get('/api/inventory').then(r => r.data), ttl: 30 * 1000 }
  );
  // Cache-first: my requests
  const { data: myRequests = [], loading: reqsLoading, refresh: refreshRequests } = useCache(
    activeTab === 'requests' ? 'outlet:demand:my-requests' : null,
    { fetcher: () => api.get('/api/demand/my').then(r => r.data), ttl: 30 * 1000 }
  );
  // Cache-first: catalog
  const { data: outletInventory = [], loading: invLoading, refresh: refreshCatalog } = useCache(
    activeTab === 'inventory' ? 'outlet:demand:catalog' : null,
    { fetcher: () => api.get('/api/demand/inventory').then(r => r.data), ttl: 30 * 1000 }
  );
  // Cache-first: returned orders
  const { data: returnedOrders = [], loading: returnsLoading, refresh: refreshReturns } = useCache(
    activeTab === 'returns' ? 'outlet:returns' : null,
    { fetcher: () => api.get('/api/outlet-orders/returns').then(r => r.data), ttl: 30 * 1000 }
  );

  const [receivingId, setReceivingId] = useState(null);

  // --- Demand Request State ---
  const [cartItems, setCartItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [requestNotes, setRequestNotes] = useState('');
  // Per-product selection state (size/color chosen by user, not from server)
  const [productSelections, setProductSelections] = useState({});

  const setProductSelection = (productId, field, value) => {
    setProductSelections(prev => ({ ...prev, [productId]: { ...(prev[productId] || {}), [field]: value } }));
  };

  const acceptRequest = async (reqId) => {
    if (!window.confirm('Accept this approved request? Stock will be added to Outlet POS inventory.')) return;
    setAcceptingId(reqId);
    try {
      await api.put(`/api/demand/${reqId}/accept`, {});
      toast.success('Request accepted! Stock added to outlet inventory.');
      refreshRequests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept request');
    }
    setAcceptingId(null);
  };

  // --- Inventory Visibility State ---
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('');

  // --- Demand Request Handlers ---
  const addToCart = (item) => {
    const variants = item.variants || [];
    const hasVariants = variants.length > 0;
    const sizes = hasVariants ? [...new Set(variants.map(v => v.size).filter(Boolean))] : (item.size ? [item.size] : []);
    const colors = hasVariants ? [...new Set(variants.map(v => v.color).filter(Boolean))] : (item.color ? [item.color] : []);
    const sel = productSelections[item.id] || {};
    setCartItems(prev => {
      const existing = prev.find(i => i.productId === item.id && i.size === sel.size && i.color === sel.color);
      if (existing) {
        return prev.map(i => i.productId === item.id && i.size === sel.size && i.color === sel.color
          ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        productId: item.id,
        productName: item.name,
        category: item.category,
        size: sel.size || (sizes[0] || ''),
        color: sel.color || (colors[0] || ''),
        qty: 1,
        availableSizes: sizes,
        availableColors: colors
      }];
    });
  };

  const updateCartItem = (idx, field, value) => {
    setCartItems(prev => prev.map((i, n) => n === idx ? { ...i, [field]: value } : i));
  };

  const removeCartItem = (idx) => {
    setCartItems(prev => prev.filter((_, n) => n !== idx));
  };

  const clearCart = () => setCartItems([]);

  const submitDemandRequest = async () => {
    if (!cartItems.length) {
      toast.error('Add at least one item to your demand request');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/demand', {
        items: cartItems.map(i => ({
          inventoryItemId: i.productId || null,
          productName: i.productName,
          size: i.size,
          color: i.color,
          requestedQty: i.qty
        })),
        notes: requestNotes
      });
      toast.success('Demand request submitted to Store');
      setCartItems([]);
      setRequestNotes('');
      setActiveTab('requests');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit demand request');
    }
    setSubmitting(false);
  };

  // --- Filtered inventory for demand creation ---
  const filteredInventory = inventory.filter(item =>
    !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  const cartTotal = cartItems.reduce((sum, i) => sum + i.qty, 0);

  // --- Status helpers ---
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIALLY_APPROVED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'REJECTED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const statusCounts = {
    pending: myRequests.filter(r => r.status === 'PENDING').length,
    approved: myRequests.filter(r => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length,
    rejected: myRequests.filter(r => r.status === 'REJECTED').length,
  };

  // Filter inventory visibility
  const filteredOutletInv = outletInventory.filter(item =>
    (!invSearch || item.name?.toLowerCase().includes(invSearch.toLowerCase()) || item.category?.toLowerCase().includes(invSearch.toLowerCase())) &&
    (!invCategory || item.category === invCategory)
  );

  const invCategories = [...new Set(outletInventory.map(i => i.category).filter(Boolean))];

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 rotate-2">
            <Building2 className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">{outletName}</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Outlet Portal</p>
          </div>
        </div>
        <button onClick={() => { refreshInventory(); refreshRequests(); refreshCatalog(); }} className="theme-bg-subtle hover:bg-gray-700 theme-text-primary font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95 border theme-border">
          <RefreshCcw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('demand')}
          className={`px-4 md:px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'demand' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <ShoppingCart size={14} />
          <span>Demand Request {cartTotal > 0 && <span className="ml-1 bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{cartTotal}</span>}</span>
        </button>
        <button onClick={() => setActiveTab('requests')}
          className={`px-4 md:px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'requests' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <ClipboardList size={14} />
          <span>My Requests {statusCounts.pending > 0 && <span className="ml-1 bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">{statusCounts.pending}</span>}</span>
        </button>
        <button onClick={() => setActiveTab('inventory')}
          className={`px-4 md:px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <Warehouse size={14} />
          <span>Warehouse Catalog</span>
        </button>
        <button onClick={() => setActiveTab('returns')}
          className={`px-4 md:px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center space-x-2 ${
            activeTab === 'returns' ? 'bg-amber-600 text-white shadow-lg' : 'theme-text-muted hover:text-white hover:bg-gray-800'
          }`}>
          <ArrowLeftRight size={14} />
          <span>Returns {returnedOrders.length > 0 && <span className="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{returnedOrders.length}</span>}</span>
        </button>
      </div>

      {loading && activeTab === 'demand' ? (
        <PageLoader text="Loading..." />
      ) : reqsLoading && activeTab === 'requests' ? (
        <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
      ) : invLoading && activeTab === 'inventory' ? (
        <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
      ) : (
        <>
          {/* ======= Demand Request Tab ======= */}
          {activeTab === 'demand' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
              {/* Product Selection */}
              <div className="lg:col-span-2 space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input type="text" placeholder="Search products..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full theme-input rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-blue-500 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredInventory.map((item, i) => {
                    const variants = item.variants || [];
                    const hasVariants = variants.length > 0;
                    const sizes = hasVariants ? [...new Set(variants.map(v => v.size).filter(Boolean))] : (item.size ? [item.size] : []);
                    const colors = hasVariants ? [...new Set(variants.map(v => v.color).filter(Boolean))] : (item.color ? [item.color] : []);
                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="glass p-4 md:p-5 rounded-2xl border-2 theme-border hover:border-blue-500/30 transition-all">
                        <div className="mb-3">
                          <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                          <p className="text-xs font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {sizes.length > 0 && (
                            <select value={productSelections[item.id]?.size || ''} onChange={(e) => setProductSelection(item.id, 'size', e.target.value)}
                              className="theme-bg-subtle border-2 theme-border rounded-lg py-1.5 px-2 text-xs font-medium text-white outline-none"
                              style={{ colorScheme: 'dark' }}>
                              <option value="" style={{ background: '#111', color: '#fff' }}>Size</option>
                              {sizes.map(s => <option key={s} value={s} style={{ background: '#111', color: '#fff' }}>{s}</option>)}
                            </select>
                          )}
                          {colors.length > 0 && (
                            <select value={productSelections[item.id]?.color || ''} onChange={(e) => setProductSelection(item.id, 'color', e.target.value)}
                              className="theme-bg-subtle border-2 theme-border rounded-lg py-1.5 px-2 text-xs font-medium text-white outline-none"
                              style={{ colorScheme: 'dark' }}>
                              <option value="" style={{ background: '#111', color: '#fff' }}>Color</option>
                              {colors.map(c => <option key={c} value={c} style={{ background: '#111', color: '#fff' }}>{c}</option>)}
                            </select>
                          )}
                        </div>
                        <button onClick={() => addToCart(item)}
                          className="w-full mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center space-x-2 active:scale-95">
                          <Plus size={14} />
                          <span>Add to Demand</span>
                        </button>
                      </motion.div>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <div className="col-span-2 text-center py-16">
                      <Package size={48} className="mx-auto text-gray-700 mb-4" />
                      <p className="theme-text-muted font-black text-xs">No products match your search</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cart Panel */}
              <div className="lg:col-span-1">
                <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border lg:sticky lg:top-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-2">
                      <ShoppingCart size={18} />
                      <span>Demand Cart</span>
                    </h2>
                    {cartItems.length > 0 && (
                      <button onClick={clearCart} className="text-xs font-black text-red-400 hover:text-red-300 uppercase tracking-wider">Clear</button>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="text-center py-10">
                      <Package size={40} className="mx-auto text-gray-700 mb-3" />
                      <p className="theme-text-muted font-black text-xs uppercase tracking-widest">Cart is empty</p>
                      <p className="text-xs theme-text-muted font-bold mt-1">Select a product to start</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                      {cartItems.map((item, idx) => (
                        <div key={idx} className="p-3 theme-bg-subtle rounded-xl border theme-border">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold theme-text-primary text-xs">{item.productName}</p>
                            <button onClick={() => removeCartItem(idx)} className="p-1 hover:bg-red-500/10 rounded-lg transition-all">
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1 mt-2">
                            <div>
                              <label className="text-[9px] font-black theme-text-muted uppercase">Size</label>
                              <select value={item.size} onChange={(e) => updateCartItem(idx, 'size', e.target.value)}
                                className="w-full theme-bg border rounded-lg py-1 px-1.5 text-[10px] font-medium text-white outline-none"
                                style={{ colorScheme: 'dark' }}>
                                {(item.availableSizes?.length ? item.availableSizes : [item.size]).map(s => (
                                  <option key={s} value={s} style={{ background: '#111', color: '#fff' }}>{s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-black theme-text-muted uppercase">Color</label>
                              <select value={item.color} onChange={(e) => updateCartItem(idx, 'color', e.target.value)}
                                className="w-full theme-bg border rounded-lg py-1 px-1.5 text-[10px] font-medium text-white outline-none"
                                style={{ colorScheme: 'dark' }}>
                                {(item.availableColors?.length ? item.availableColors : [item.color]).map(c => (
                                  <option key={c} value={c} style={{ background: '#111', color: '#fff' }}>{c}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-black theme-text-muted uppercase">Qty</label>
                              <div className="flex items-center border rounded-lg theme-bg">
                                <button onClick={() => updateCartItem(idx, 'qty', Math.max(1, (item.qty || 1) - 1))}
                                  className="px-1.5 py-1 text-gray-400 hover:text-white"><Minus size={10} /></button>
                                <input type="text" value={item.qty} readOnly
                                  className="w-full bg-transparent text-center text-[10px] font-black text-white outline-none py-1" />
                                <button onClick={() => updateCartItem(idx, 'qty', (item.qty || 1) + 1)}
                                  className="px-1.5 py-1 text-gray-400 hover:text-white"><Plus size={10} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cartItems.length > 0 && (
                    <>
                      <textarea value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)}
                        placeholder="Optional notes for Store..."
                        className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-2 px-3 text-xs font-medium text-white outline-none min-h-[60px] mb-3" />
                      <div className="flex justify-between items-center py-2 border-t theme-border mb-3">
                        <span className="text-xs font-bold theme-text-muted uppercase">Total Items</span>
                        <span className="font-black theme-text-primary text-lg">{cartTotal}</span>
                      </div>
                      <button onClick={submitDemandRequest} disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl transition-all flex items-center justify-center space-x-3 active:scale-95">
                        {submitting ? <RefreshCcw size={18} className="animate-spin" /> : <Send size={18} />}
                        <span>{submitting ? 'Submitting...' : 'Submit Demand to Store'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======= My Requests Tab ======= */}
          {activeTab === 'requests' && (
            <div className="space-y-6">
              {reqsLoading ? (
                <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
              ) : (
                <>
                  {/* Status Counts */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-2xl border-2 theme-border">
                      <p className="text-2xl font-black text-yellow-400">{statusCounts.pending}</p>
                      <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Pending</p>
                    </div>
                    <div className="glass p-4 rounded-2xl border-2 theme-border">
                      <p className="text-2xl font-black text-emerald-400">{statusCounts.approved}</p>
                      <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Approved</p>
                    </div>
                    <div className="glass p-4 rounded-2xl border-2 theme-border">
                      <p className="text-2xl font-black text-red-400">{statusCounts.rejected}</p>
                      <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Rejected</p>
                    </div>
                  </div>

                  {/* Request Cards */}
                  <div className="space-y-3">
                    {myRequests.length === 0 ? (
                      <div className="text-center py-16">
                        <ClipboardList size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No demand requests yet</p>
                      </div>
                    ) : (
                      myRequests.map((req, i) => {
                        const sc = getStatusColor(req.status);
                        const items = typeof req.items === 'string' ? JSON.parse(req.items) : req.items;
                        const totalRequested = items.reduce((s, it) => s + (it.requestedQty || 0), 0);
                        const totalApproved = items.reduce((s, it) => s + (it.approvedQty || 0), 0);
                        return (
                          <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${sc}`}>
                                  {req.status.replace('_', ' ')}
                                </span>
                                <p className="text-xs theme-text-muted font-bold">{new Date(req.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs theme-text-muted font-bold">Requested: <span className="text-white">{totalRequested}</span></p>
                                <p className="text-xs font-bold text-emerald-400">Approved: {totalApproved}</p>
                              </div>
                            </div>
                            {/* Items list */}
                            <div className="space-y-1.5">
                              {items.map((it, ii) => (
                                <div key={ii} className="flex items-center justify-between text-xs theme-bg-subtle rounded-lg px-3 py-2">
                                  <div className="flex items-center space-x-3">
                                    <span className="font-bold theme-text-primary">{it.productName}</span>
                                    {it.size && <span className="theme-text-muted">Size: {it.size}</span>}
                                    {it.color && <span className="theme-text-muted">Color: {it.color}</span>}
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <span className="theme-text-muted">{it.requestedQty}x</span>
                                    {it.approvedQty > 0 && <span className="text-emerald-400 font-bold">{it.approvedQty}x</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {req.storeNotes && (
                              <div className="mt-3 p-3 theme-bg-subtle rounded-xl border theme-border">
                                <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Store Notes</p>
                                <p className="text-xs theme-text-primary font-medium mt-0.5">{req.storeNotes}</p>
                              </div>
                            )}
                            {/* Accept button for approved/partially approved requests */}
                            {(req.status === 'APPROVED' || req.status === 'PARTIALLY_APPROVED') && !req.acceptedAt && (
                              <div className="mt-3 flex justify-end">
                                <button onClick={() => acceptRequest(req.id)} disabled={acceptingId === req.id}
                                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition-all flex items-center space-x-2 active:scale-95">
                                  {acceptingId === req.id ? <RefreshCcw size={14} className="animate-spin" /> : <Download size={14} />}
                                  <span>{acceptingId === req.id ? 'Accepting...' : 'Accept & Add to POS Stock'}</span>
                                </button>
                              </div>
                            )}
                            {req.acceptedAt && (
                              <div className="mt-3 flex justify-end">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  ✓ Accepted {new Date(req.acceptedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ======= Warehouse Catalog Tab ======= */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-2">
                  <Warehouse size={18} className="text-blue-400" />
                  <span>Warehouse Catalog</span>
                </h2>
                <p className="text-xs theme-text-muted font-bold">View available product variants</p>
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
                  <input type="text" placeholder="Search products..." value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setInvCategory('')}
                    className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                      !invCategory ? 'bg-blue-600 text-white border-blue-500' : 'theme-bg theme-text-muted theme-border hover:text-white'
                    }`}>All</button>
                  {invCategories.map(cat => (
                    <button key={cat} onClick={() => setInvCategory(cat)}
                      className={`px-3 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                        invCategory === cat ? 'bg-blue-600 text-white border-blue-500' : 'theme-bg theme-text-muted theme-border hover:text-white'
                      }`}>{cat}</button>
                  ))}
                </div>
              </div>

              {invLoading ? (
                <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOutletInv.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass p-4 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all">
                      <h3 className="font-black theme-text-primary text-sm mb-1">{item.name}</h3>
                      <p className="text-[10px] font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                      {(() => {
                        const v = item.variants || [];
                        if (v.length) {
                          const hasColor = v.some(x => x.color);
                          const hasSize = v.some(x => x.size);
                          if (!hasColor && hasSize) {
                            const sizes = v.map(x => ({ size: x.size, stock: x.stock ?? 0 }));
                            return (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {sizes.map(s => (
                                  <span key={s.size} className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${s.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {s.size} {s.stock > 0 ? `(${s.stock})` : '(0)'}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          const grouped = {};
                          v.forEach(x => {
                            const c = x.color || '-';
                            if (!grouped[c]) grouped[c] = [];
                            grouped[c].push({ size: x.size, stock: x.stock ?? 0 });
                          });
                          return (
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {Object.entries(grouped).map(([color, sizes]) => (
                                <div key={color}>
                                  <p className="text-[10px] font-bold text-gray-400 mb-0.5">{color}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {sizes.map(s => (
                                      <span key={s.size || 'x'} className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${s.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {s.size ? `${s.size} (${s.stock})` : `(${s.stock})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        const hasColor = item.color || item.size;
                        return hasColor ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.color && <span className="text-[10px] theme-text-muted bg-gray-800/50 px-2 py-0.5 rounded-lg">Color: {item.color}</span>}
                            {item.size && <span className="text-[10px] theme-text-muted bg-gray-800/50 px-2 py-0.5 rounded-lg">Size: {item.size}</span>}
                          </div>
                        ) : null;
                      })()}
                    </motion.div>
                  ))}
                  {filteredOutletInv.length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <Warehouse size={48} className="mx-auto text-gray-700 mb-4" />
                      <p className="theme-text-muted font-black text-xs">No products found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======= Returns Tab ======= */}
          {activeTab === 'returns' && (
            <div className="space-y-6">
              <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-2">
                <ArrowLeftRight size={18} className="text-amber-400" />
                <span>Returned Orders</span>
              </h2>
              {returnsLoading ? (
                <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-amber-400" size={32} /></div>
              ) : returnedOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Package size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No returned orders</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {returnedOrders.map((o, i) => {
                    const items = o.productDetails || [];
                    return (
                      <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="glass p-4 md:p-6 rounded-2xl border-2 border-amber-700/30 hover:border-amber-600/50 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-black theme-text-primary">#{o.orderNumber}</p>
                            <p className="text-xs theme-text-muted">{o.customerName} {o.customerPhone && `— ${o.customerPhone}`}</p>
                          </div>
                          <span className="text-[10px] font-black text-amber-400 uppercase bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">Pending Receive</span>
                        </div>
                        <div className="space-y-1 mb-3">
                          {items.map((it, ii) => (
                            <div key={ii} className="flex items-center justify-between text-xs bg-gray-800/40 rounded-lg px-3 py-1.5">
                              <span className="font-bold text-white">{it.name}</span>
                              <span className="text-gray-400">{it.color && `${it.color} / `}{it.size || ''} ×{it.quantity || 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()} — ₨{(o.totalPrice || 0).toLocaleString()}</p>
                          <button onClick={async () => {
                            setReceivingId(o.id);
                            try {
                              const res = await api.post(`/api/outlet-orders/${o.id}/receive`);
                              toast.success(res.data.message || `Order #${o.orderNumber} received`);
                              refreshReturns();
                            } catch (err) {
                              toast.error(err.response?.data?.message || 'Failed to receive order');
                            }
                            setReceivingId(null);
                          }} disabled={receivingId === o.id}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl disabled:opacity-50 flex items-center gap-1.5">
                            <CheckCircle size={14} />
                            {receivingId === o.id ? 'Receiving...' : 'Receive Order'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OutletStockRequest;
