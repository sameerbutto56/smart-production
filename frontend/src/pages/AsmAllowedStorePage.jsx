import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, ShoppingCart, Search, Plus, Trash2, CheckCircle2, RotateCcw,
  Printer, ArrowRight, X, AlertCircle, RefreshCw, FileText, Check, User, Building2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

const AsmAllowedStorePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new-handover'); // 'new-handover' | 'requests' | 'returns' | 'history'

  // Catalog & Cart state
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [asmUsers, setAsmUsers] = useState([]);
  const [selectedAsmId, setSelectedAsmId] = useState('');
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Requests state
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Returns state
  const [returns, setReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [acceptingReturnId, setAcceptingReturnId] = useState(null);

  // Print modal state
  const [printRequest, setPrintRequest] = useState(null);

  // Fetch warehouse catalog
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get('/api/asm-stock/warehouse-catalog', {
        params: { search: searchQuery, category: selectedCategory }
      });
      setCatalog(res.data?.items || []);
    } catch (err) {
      toast.error('Failed to load warehouse catalog');
    }
    setCatalogLoading(false);
  }, [searchQuery, selectedCategory]);

  // Fetch ASM users
  useEffect(() => {
    api.get('/api/asm-stock/asms')
      .then(res => setAsmUsers(res.data?.asms || []))
      .catch(() => {});
  }, []);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await api.get('/api/asm-stock/requests', {
        params: { mode: activeTab === 'history' ? 'history' : 'active' }
      });
      setRequests(res.data?.requests || []);
    } catch (err) {
      toast.error('Failed to load stock requests');
    }
    setRequestsLoading(false);
  }, [activeTab]);

  // Fetch Returns
  const fetchReturns = useCallback(async () => {
    setReturnsLoading(true);
    try {
      const res = await api.get('/api/asm-stock/returns', {
        params: { mode: activeTab === 'returns' ? 'pending' : 'all' }
      });
      setReturns(res.data?.returns || []);
    } catch (err) {
      toast.error('Failed to load stock returns');
    }
    setReturnsLoading(false);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'new-handover') fetchCatalog();
    else if (activeTab === 'requests' || activeTab === 'history') fetchRequests();
    else if (activeTab === 'returns') fetchReturns();
  }, [activeTab, fetchCatalog, fetchRequests, fetchReturns]);

  // Cart helper functions
  const addToCart = (item, color, size, qty) => {
    const quantity = parseInt(qty) || 1;
    if (quantity <= 0) return toast.error('Quantity must be at least 1');
    if (quantity > item.stock) return toast.error(`Cannot add more than available stock (${item.stock})`);

    const cartKey = `${item.id}-${color || ''}-${size || ''}`;
    setCart(prev => {
      const existing = prev.find(c => c.cartKey === cartKey);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (nextQty > item.stock) {
          toast.error(`Total quantity exceeds stock (${item.stock})`);
          return prev;
        }
        toast.success(`Updated ${item.name} quantity to ${nextQty}`);
        return prev.map(c => c.cartKey === cartKey ? { ...c, quantity: nextQty } : c);
      }
      toast.success(`Added ${item.name} to cart`);
      return [...prev, {
        cartKey,
        inventoryItemId: item.id,
        productName: item.name,
        category: item.category,
        color: color || item.color || '',
        size: size || item.size || '',
        fabric: item.fabric || '',
        stock: item.stock,
        quantity,
        unit: 'Pieces',
        price: item.price || 0
      }];
    });
  };

  const removeFromCart = (cartKey) => {
    setCart(prev => prev.filter(c => c.cartKey !== cartKey));
  };

  const updateCartQty = (cartKey, qty) => {
    const quantity = parseInt(qty) || 1;
    setCart(prev => prev.map(c => {
      if (c.cartKey !== cartKey) return c;
      const validQty = Math.min(c.stock, Math.max(1, quantity));
      return { ...c, quantity: validQty };
    }));
  };

  // Submit Handover Request
  const handleSubmitRequest = async () => {
    if (cart.length === 0) return toast.error('Add at least one product to cart');
    if (!selectedAsmId) return toast.error('Please select an ASM');

    const selectedAsm = asmUsers.find(a => a.id === selectedAsmId);

    setSubmitting(true);
    try {
      const res = await api.post('/api/asm-stock/requests', {
        storeName: 'Warehouse Store',
        asmId: selectedAsmId,
        asmName: selectedAsm ? selectedAsm.name : '',
        notes,
        items: cart.map(c => ({
          inventoryItemId: c.inventoryItemId,
          productName: c.productName,
          category: c.category,
          color: c.color,
          size: c.size,
          fabric: c.fabric,
          quantityGiven: c.quantity,
          unit: c.unit,
          price: c.price
        }))
      });

      toast.success(`ASM Stock Handover ${res.data?.request?.requestNumber} submitted!`);
      const created = res.data?.request;
      setCart([]);
      setNotes('');
      setSelectedAsmId('');
      if (created) {
        setPrintRequest(created);
      }
      setActiveTab('requests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    }
    setSubmitting(false);
  };

  // Accept Return
  const handleAcceptReturn = async (returnId) => {
    setAcceptingReturnId(returnId);
    try {
      const res = await api.post(`/api/asm-stock/returns/${returnId}/accept`);
      toast.success(`Return ${res.data?.returnRecord?.returnNumber} accepted! Inventory restored.`);
      fetchReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept return');
    }
    setAcceptingReturnId(null);
  };

  // Printable Handover Sheet generator
  const triggerPrint = (reqData) => {
    const printWindow = window.open('', '_blank');
    const itemsHtml = reqData.items.map((item, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #ccc;"><strong>${item.productName}</strong></td>
        <td style="padding: 8px; border: 1px solid #ccc;">${item.category || 'General'}</td>
        <td style="padding: 8px; border: 1px solid #ccc;">${item.color || '—'}</td>
        <td style="padding: 8px; border: 1px solid #ccc;">${item.size || '—'}</td>
        <td style="padding: 8px; border: 1px solid #ccc; text-align: right;"><strong>${item.quantityGiven}</strong></td>
        <td style="padding: 8px; border: 1px solid #ccc;">${item.unit || 'Pieces'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ASM Stock Handover — ${reqData.requestNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
          th { background: #f0f0f0; padding: 8px; border: 1px solid #ccc; text-align: left; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; font-size: 13px; }
          .sig-box { width: 45%; border-top: 1px solid #000; text-align: center; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">ENAMELS WAREHOUSE</h2>
          <h3 style="margin: 5px 0 0 0;">ASM STOCK HANDOVER SHEET</h3>
        </div>
        <div class="meta">
          <div>
            <p><strong>Request Number:</strong> ${reqData.requestNumber}</p>
            <p><strong>Store:</strong> ${reqData.storeName || 'Warehouse Store'}</p>
            <p><strong>Prepared By:</strong> ${reqData.submittedByName || 'Store'}</p>
          </div>
          <div>
            <p><strong>Date & Time:</strong> ${formatDateTime(reqData.submittedAt || new Date())}</p>
            <p><strong>ASM:</strong> ${reqData.asmName || 'Unassigned ASM'}</p>
            <p><strong>Status:</strong> ${reqData.status}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Color</th>
              <th>Size</th>
              <th style="text-align: right;">Quantity</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        ${reqData.notes ? `<p><strong>Notes / Special Instructions:</strong> ${reqData.notes}</p>` : ''}
        <div class="signatures">
          <div class="sig-box">Store Handover Signature & Date</div>
          <div class="sig-box">ASM Received Signature & Date</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const categories = useMemo(() => {
    const set = new Set(catalog.map(i => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [catalog]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-3xl border border-gray-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <Package className="text-amber-400" size={28} /> ASM Allowed Stock Movement
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Store ↔ ASM Stock Handover & Verification Return System
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800">
          <button onClick={() => setActiveTab('new-handover')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'new-handover' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <Plus size={14} /> New Handover
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <FileText size={14} /> Handovers ({requests.length})
          </button>
          <button onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'returns' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <RotateCcw size={14} /> ASM Returns {returns.filter(r => r.status === 'PENDING_STORE_ACCEPT').length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{returns.filter(r => r.status === 'PENDING_STORE_ACCEPT').length}</span>}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <CheckCircle2 size={14} /> History
          </button>
        </div>
      </div>

      {/* ═══════════════════ Tab 1: New Handover ═══════════════════ */}
      {activeTab === 'new-handover' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Warehouse Catalog Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search warehouse inventory by name, color, size..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500" />
                </div>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500">
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={fetchCatalog} className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2.5 rounded-xl">
                  <RefreshCw size={16} className={catalogLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Inventory List */}
            <div className="glass p-4 rounded-2xl border border-gray-800 space-y-3 max-h-[600px] overflow-y-auto">
              <h2 className="text-xs font-black uppercase text-gray-400 tracking-wider">
                Live Warehouse Stock ({catalog.length} Available)
              </h2>
              {catalogLoading ? (
                <div className="py-12 text-center text-gray-500 font-bold">Loading warehouse catalog...</div>
              ) : catalog.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-bold">No available stock matching query</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {catalog.map(item => (
                    <CatalogCard key={item.id} item={item} onAddToCart={addToCart} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart & Submission Panel */}
          <div className="space-y-4">
            <div className="glass p-5 rounded-2xl border border-gray-800 space-y-4">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-2"><ShoppingCart size={16} className="text-amber-400" /> Handover Cart</span>
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.quantity, 0)} Items</span>
              </h2>

              {/* Target ASM Selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Target ASM *</label>
                <select value={selectedAsmId} onChange={e => setSelectedAsmId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-bold">
                  <option value="">Select ASM Profile</option>
                  {asmUsers.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>

              {/* Cart List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto border-t border-b border-gray-800 py-3">
                {cart.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 py-6 font-bold">Cart is empty. Add products from the catalog.</p>
                ) : (
                  cart.map(c => (
                    <div key={c.cartKey} className="bg-gray-900/90 rounded-xl p-3 text-xs space-y-1 border border-gray-800">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-white">{c.productName}</p>
                          <p className="text-[10px] text-gray-400">
                            {[c.category, c.color, c.size, c.fabric].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                        <button onClick={() => removeFromCart(c.cartKey)} className="text-red-400 hover:text-red-300 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-gray-500">Max: {c.stock}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400">Qty:</span>
                          <input type="number" min="1" max={c.stock} value={c.quantity}
                            onChange={e => updateCartQty(c.cartKey, e.target.value)}
                            className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white text-center font-bold outline-none" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Special Instructions Notes */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Handover Notes / Instructions</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Special instructions for ASM..."
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500" />
              </div>

              {/* Submit Button */}
              <button onClick={handleSubmitRequest} disabled={submitting || cart.length === 0 || !selectedAsmId}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all">
                {submitting ? 'Submitting Handover...' : 'Submit ASM Stock Request'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ Tab 2 / Tab 4: Requests / History ═══════════════════ */}
      {(activeTab === 'requests' || activeTab === 'history') && (
        <div className="glass p-6 rounded-3xl border border-gray-800 space-y-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            {activeTab === 'history' ? 'Completed ASM Handover History' : 'Active ASM Handover Requests'}
          </h2>
          {requestsLoading ? (
            <div className="py-12 text-center text-gray-500">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No requests found</div>
          ) : (
            <div className="space-y-3">
              {requests.map(reqData => (
                <div key={reqData.id} className="bg-gray-900/80 rounded-2xl p-4 border border-gray-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-amber-400">{reqData.requestNumber}</span>
                        <StatusBadge status={reqData.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Target ASM: <span className="text-white font-bold">{reqData.asmName || 'ASM'}</span> | Submitted by: <span className="text-gray-300">{reqData.submittedByName}</span> | {formatDateTime(reqData.submittedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => triggerPrint(reqData)}
                        className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Printer size={14} /> Print Sheet
                      </button>
                      <button onClick={() => setSelectedRequest(selectedRequest?.id === reqData.id ? null : reqData)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                        {selectedRequest?.id === reqData.id ? 'Hide Details' : 'View Items'}
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  {selectedRequest?.id === reqData.id && (
                    <div className="pt-2 space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                              <th className="py-2">Product</th>
                              <th className="py-2">Category</th>
                              <th className="py-2">Color / Size</th>
                              <th className="py-2 text-right">Given</th>
                              <th className="py-2 text-right">Returned</th>
                              <th className="py-2 text-right">Remaining</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reqData.items.map(item => (
                              <tr key={item.id} className="border-b border-gray-800/50 text-gray-300">
                                <td className="py-2 font-bold text-white">{item.productName}</td>
                                <td className="py-2 text-gray-400">{item.category}</td>
                                <td className="py-2 text-gray-400">{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                                <td className="py-2 text-right font-bold text-blue-400">{item.quantityGiven}</td>
                                <td className="py-2 text-right font-bold text-emerald-400">{item.quantityReturned}</td>
                                <td className="py-2 text-right font-bold text-amber-400">{item.quantityRemaining}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reqData.auditLogs?.length > 0 && (
                        <div className="bg-gray-950/50 p-3 rounded-xl text-[11px] space-y-1">
                          <p className="font-bold text-gray-400 uppercase tracking-wider">Audit Log:</p>
                          {reqData.auditLogs.map(log => (
                            <p key={log.id} className="text-gray-500">
                              <span className="text-amber-400">[{formatDateTime(log.createdAt)}]</span> {log.details}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ Tab 3: ASM Returns (Pending Store Verification) ═══════════════════ */}
      {activeTab === 'returns' && (
        <div className="glass p-6 rounded-3xl border border-gray-800 space-y-4">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              Pending ASM Returned Stock Verification & Acceptance
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Verify physical returned stock before accepting. Stock will be restored to Warehouse Inventory ONLY upon Store Accept.
            </p>
          </div>

          {returnsLoading ? (
            <div className="py-12 text-center text-gray-500">Loading returned stock requests...</div>
          ) : returns.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No pending stock returns to verify</div>
          ) : (
            <div className="space-y-4">
              {returns.map(retRec => (
                <div key={retRec.id} className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-emerald-400">{retRec.returnNumber}</span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${retRec.status === 'STORE_ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {retRec.status === 'STORE_ACCEPTED' ? '✓ Accepted & Restored' : '⚠️ Pending Store Acceptance'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        ASM: <span className="text-white font-bold">{retRec.asmName}</span> | Handover #: <span className="text-amber-300 font-bold">{retRec.request?.requestNumber}</span> | Date: {formatDateTime(retRec.submittedAt)}
                      </p>
                    </div>

                    {retRec.status === 'PENDING_STORE_ACCEPT' && (
                      <button onClick={() => handleAcceptReturn(retRec.id)} disabled={acceptingReturnId === retRec.id}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30">
                        {acceptingReturnId === retRec.id ? 'Restoring Inventory...' : 'Verify & Accept Return'} <Check size={16} />
                      </button>
                    )}
                  </div>

                  {/* Return Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                          <th className="py-2">Product Name</th>
                          <th className="py-2">Category</th>
                          <th className="py-2">Color / Size</th>
                          <th className="py-2 text-right">Quantity Returned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retRec.items.map(item => (
                          <tr key={item.id} className="border-b border-gray-800/50 text-gray-300">
                            <td className="py-2 font-bold text-white">{item.productName}</td>
                            <td className="py-2 text-gray-400">{item.category}</td>
                            <td className="py-2 text-gray-400">{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                            <td className="py-2 text-right font-black text-emerald-400">+{item.quantityReturned} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {retRec.notes && (
                    <div className="bg-gray-950/50 p-3 rounded-xl text-xs text-gray-400">
                      <span className="font-bold text-gray-300">ASM Return Notes:</span> {retRec.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Catalog Item Sub-component with variant selection
const CatalogCard = ({ item, onAddToCart }) => {
  const [selectedColor, setSelectedColor] = useState(item.color || '');
  const [selectedSize, setSelectedSize] = useState(item.size || '');
  const [qty, setQty] = useState(1);

  return (
    <div className="bg-gray-900/90 rounded-xl p-3 border border-gray-800 hover:border-amber-500/40 transition-all space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-black text-white">{item.name}</p>
          <span className="text-[10px] text-gray-500 font-bold uppercase">{item.category}</span>
        </div>
        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Stock: {item.stock}
        </span>
      </div>

      <div className="flex gap-2 text-[10px] text-gray-400">
        {item.fabric && <span>Fabric: {item.fabric}</span>}
        {item.color && <span>Color: {item.color}</span>}
        {item.size && <span>Size: {item.size}</span>}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
        <input type="number" min="1" max={item.stock} value={qty}
          onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-center font-bold outline-none" />
        <button onClick={() => onAddToCart(item, selectedColor, selectedSize, qty)}
          className="flex-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 font-black py-1 px-3 rounded text-xs flex items-center justify-center gap-1">
          <Plus size={12} /> Add to Cart
        </button>
      </div>
    </div>
  );
};

export default AsmAllowedStorePage;
