import React, { useState, useEffect, useMemo, useCallback } from 'react';
import BackButton from '../components/BackButton';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, ShoppingCart, Search, Plus, Trash2, CheckCircle2, RotateCcw,
  Printer, ArrowRight, X, AlertCircle, RefreshCw, FileText, Check, User,
  Building2, ChevronRight, ChevronDown, Layers, LayoutGrid, List, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

// Status badge sub-component for ASM Handover Requests
const StatusBadge = ({ status }) => {
  switch (status) {
    case 'SUBMITTED':
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
          Pending ASM Acceptance
        </span>
      );
    case 'ACCEPTED':
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
          Handed Over / With ASM
        </span>
      );
    case 'PARTIALLY_RETURNED':
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
          Partially Returned
        </span>
      );
    case 'FULLY_RETURNED':
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ✓ Fully Returned
        </span>
      );
    case 'REJECTED':
    case 'CANCELLED':
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-red-500/20 text-red-400 border border-red-500/30">
          {status}
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-gray-500/20 text-gray-400 border border-gray-500/30">
          {status || 'Unknown'}
        </span>
      );
  }
};

const AsmAllowedStorePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new-handover'); // 'new-handover' | 'requests' | 'returns' | 'history'

  // Catalog & Variants state
  const [catalog, setCatalog] = useState([]);
  const [catalogVariants, setCatalogVariants] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewLayout, setViewLayout] = useState('table'); // 'table' | 'grouped'
  const [expandedProducts, setExpandedProducts] = useState({});
  const [rowAllocQty, setRowAllocQty] = useState({});

  // Handover Cart state
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

  // Bulk Allocation state
  const [bulkOrders, setBulkOrders] = useState([]);
  const [bulkOrdersLoading, setBulkOrdersLoading] = useState(false);
  const [bulkAllocations, setBulkAllocations] = useState({});

  // Fetch warehouse catalog with product + color + size variants
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get('/api/asm-stock/warehouse-catalog', {
        params: { search: searchQuery, category: selectedCategory }
      });
      setCatalog(res.data?.items || []);
      setCatalogVariants(res.data?.variants || []);
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

  // Fetch Bulk Orders
  const fetchBulkOrders = useCallback(async () => {
    setBulkOrdersLoading(true);
    try {
      const res = await api.get('/api/vendors/orders/store-allocation');
      const orders = res.data?.orders || [];
      setBulkOrders(orders);
      
      const initialAllocs = {};
      orders.forEach(order => {
        if (order.currentStage === 'SENT_TO_STORE') {
          initialAllocs[order.id] = {};
          order.items.forEach(item => {
            initialAllocs[order.id][item.id] = Math.max(0, Math.min(item.quantity, item.availableWarehouseStock || 0));
          });
        }
      });
      setBulkAllocations(initialAllocs);
    } catch (err) {
      toast.error('Failed to load bulk allocation orders');
    }
    setBulkOrdersLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'new-handover') fetchCatalog();
    else if (activeTab === 'requests' || activeTab === 'history') fetchRequests();
    else if (activeTab === 'returns') fetchReturns();
    else if (activeTab === 'bulk-allocation') fetchBulkOrders();
  }, [activeTab, fetchCatalog, fetchRequests, fetchReturns, fetchBulkOrders]);

  // Categories list derived from loaded variants
  const categories = useMemo(() => {
    const set = new Set(catalog.map(i => i.category).filter(Boolean));
    return Array.from(set).sort();
  }, [catalog]);

  // Grouped variants by Product Name
  const groupedProducts = useMemo(() => {
    const map = new Map();
    for (const v of catalogVariants) {
      if (!map.has(v.productName)) {
        map.set(v.productName, {
          productName: v.productName,
          category: v.category,
          fabric: v.fabric,
          imageUrl: v.imageUrl,
          inventoryItemId: v.inventoryItemId,
          variants: []
        });
      }
      map.get(v.productName).variants.push(v);
    }
    return Array.from(map.values());
  }, [catalogVariants]);

  // Add a specific variant to the handover cart
  const addToCart = (variant, qty) => {
    const quantity = parseInt(qty) || 1;
    if (quantity <= 0) return toast.error('Allocation quantity must be at least 1');
    if (quantity > variant.availableStock) {
      return toast.error(`Cannot allocate more than available warehouse stock (${variant.availableStock}) for ${variant.productName} (${variant.color} / ${variant.size})`);
    }

    const cartKey = `${variant.inventoryItemId}-${variant.color || ''}-${variant.size || ''}`;
    setCart(prev => {
      const existing = prev.find(c => c.cartKey === cartKey);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (nextQty > variant.availableStock) {
          toast.error(`Total handover quantity (${nextQty}) exceeds available warehouse stock (${variant.availableStock})`);
          return prev;
        }
        toast.success(`Updated ${variant.productName} (${variant.color} / ${variant.size}) to ${nextQty} units`);
        return prev.map(c => c.cartKey === cartKey ? { ...c, quantity: nextQty } : c);
      }
      toast.success(`Added ${quantity}x ${variant.productName} (${variant.color} / ${variant.size}) to handover`);
      return [...prev, {
        cartKey,
        inventoryItemId: variant.inventoryItemId,
        productName: variant.productName,
        category: variant.category,
        color: variant.color,
        size: variant.size,
        fabric: variant.fabric || '',
        stock: variant.availableStock, // authoritative variant available stock
        quantity,
        unit: 'Pieces',
        price: variant.price || 0
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
    if (cart.length === 0) return toast.error('Add at least one product variant to allocate');
    if (!selectedAsmId) return toast.error('Please select a target ASM');

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

      toast.success(`ASM Stock Allocation ${res.data?.request?.requestNumber} submitted!`);
      const created = res.data?.request;
      setCart([]);
      setNotes('');
      setSelectedAsmId('');
      if (created) {
        setPrintRequest(created);
      }
      fetchCatalog();
      setActiveTab('requests');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit allocation request');
    }
    setSubmitting(false);
  };

  // Accept Return
  const handleAcceptReturn = async (returnId) => {
    setAcceptingReturnId(returnId);
    try {
      const res = await api.post(`/api/asm-stock/returns/${returnId}/accept`);
      toast.success(`Return ${res.data?.returnRecord?.returnNumber} accepted! Warehouse Inventory restored.`);
      fetchReturns();
      fetchCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept return');
    }
    setAcceptingReturnId(null);
  };

  // Handle Bulk Allocation Submit
  const handleBulkAllocate = async (orderId) => {
    const orderAllocs = bulkAllocations[orderId];
    if (!orderAllocs) return;
    
    const allocations = Object.entries(orderAllocs).map(([itemId, allocatedQuantity]) => ({
      itemId: parseInt(itemId) || itemId,
      allocatedQuantity: parseInt(allocatedQuantity) || 0
    }));

    try {
      await api.post(`/api/vendors/orders/${orderId}/store-allocate`, { allocations });
      toast.success('Order allocated and sent to ASM!');
      fetchBulkOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allocate order');
    }
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
          <h3 style="margin: 5px 0 0 0;">ASM STOCK ALLOCATION & HANDOVER SHEET</h3>
        </div>
        <div class="meta">
          <div>
            <p><strong>Handover Number:</strong> ${reqData.requestNumber}</p>
            <p><strong>Store / Warehouse:</strong> ${reqData.storeName || 'Warehouse Store'}</p>
            <p><strong>Prepared By:</strong> ${reqData.submittedByName || 'Store'}</p>
          </div>
          <div>
            <p><strong>Date & Time:</strong> ${formatDateTime(reqData.submittedAt || new Date())}</p>
            <p><strong>Target ASM:</strong> ${reqData.asmName || 'Authorized ASM'}</p>
            <p><strong>Status:</strong> ${reqData.status}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Color</th>
              <th>Size</th>
              <th style="text-align: right;">Quantity Given</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${reqData.notes ? `<p style="font-size: 13px;"><strong>Special Instructions:</strong> ${reqData.notes}</p>` : ''}

        <div class="signatures">
          <div class="sig-box">
            <p>Store In-Charge Signature</p>
          </div>
          <div class="sig-box">
            <p>ASM Physical Receiving Signature</p>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const totalAvailableUnits = useMemo(() => {
    return catalogVariants.reduce((sum, v) => sum + (v.availableStock || 0), 0);
  }, [catalogVariants]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass p-6 rounded-3xl border border-gray-800">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <Package className="text-amber-400" size={28} /> ASM Stock Allocation
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Store ↔ ASM Stock Allocation, Live Warehouse Inventory (Product + Color + Size) & Returns
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 bg-gray-900/80 p-1.5 rounded-2xl border border-gray-800">
          <button onClick={() => setActiveTab('new-handover')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'new-handover' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <Plus size={14} /> Allocate Stock
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <FileText size={14} /> Allocation Records ({requests.length})
          </button>
          <button onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'returns' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <RotateCcw size={14} /> ASM Returns {returns.filter(r => r.status === 'PENDING_STORE_ACCEPT').length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{returns.filter(r => r.status === 'PENDING_STORE_ACCEPT').length}</span>}
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <CheckCircle2 size={14} /> History
          </button>
          <button onClick={() => setActiveTab('bulk-allocation')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === 'bulk-allocation' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-white'}`}>
            <Layers size={14} /> Bulk Order Allocation
          </button>
        </div>
      </div>

      {/* ═══════════════════ Tab 1: New Handover / Allocation ═══════════════════ */}
      {activeTab === 'new-handover' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Warehouse Inventory Panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[220px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by product, color, size, fabric, category..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 font-medium"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
                >
                  <option value="">All Categories ({categories.length})</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* View Layout Toggle */}
                <div className="flex items-center bg-gray-900 rounded-xl p-1 border border-gray-700">
                  <button
                    onClick={() => setViewLayout('table')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewLayout === 'table' ? 'bg-amber-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
                    title="Detailed Variant Table View (Product + Color + Size)"
                  >
                    <List size={14} /> Table
                  </button>
                  <button
                    onClick={() => setViewLayout('grouped')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${viewLayout === 'grouped' ? 'bg-amber-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
                    title="Grouped by Product View"
                  >
                    <LayoutGrid size={14} /> Grouped
                  </button>
                </div>

                <button
                  onClick={fetchCatalog}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2.5 rounded-xl border border-gray-700 transition"
                  title="Refresh Warehouse Inventory"
                >
                  <RefreshCw size={16} className={catalogLoading ? 'animate-spin text-amber-400' : ''} />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-800/80 pt-2 px-1">
                <span className="font-bold flex items-center gap-2 text-gray-300">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                  Warehouse Source of Truth: <span className="text-white font-black">{catalogVariants.length}</span> Active Variants ({catalog.length} Products)
                </span>
                <span className="font-black text-amber-400">
                  Total Available: {totalAvailableUnits.toLocaleString()} units
                </span>
              </div>
            </div>

            {/* Inventory Display Container */}
            <div className="glass p-4 rounded-2xl border border-gray-800 space-y-3">
              {catalogLoading ? (
                <div className="py-20 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={24} className="animate-spin text-amber-400" />
                  <span>Loading live warehouse inventory with color & size breakdown...</span>
                </div>
              ) : catalogVariants.length === 0 ? (
                <div className="py-16 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-2">
                  <Package size={32} className="text-gray-600" />
                  <span>No warehouse inventory items found matching your filter</span>
                </div>
              ) : viewLayout === 'table' ? (
                /* ═════════ Table View: Product + Color + Size Wise ═════════ */
                <div className="overflow-x-auto rounded-xl border border-gray-800 max-h-[620px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-950/90 sticky top-0 z-10 text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Color</th>
                        <th className="py-3 px-3">Size</th>
                        <th className="py-3 px-3 text-right">Available Qty</th>
                        <th className="py-3 px-3 text-center w-36">Allocation Qty</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 bg-gray-900/40">
                      {catalogVariants.map(variant => {
                        const cartKey = `${variant.inventoryItemId}-${variant.color || ''}-${variant.size || ''}`;
                        const inCart = cart.find(c => c.cartKey === cartKey);
                        const allocQty = rowAllocQty[variant.id] ?? 1;

                        return (
                          <tr key={variant.id} className={`hover:bg-gray-800/50 transition-colors ${inCart ? 'bg-amber-500/10' : ''}`}>
                            <td className="py-2.5 px-4">
                              <p className="font-bold text-white text-xs">{variant.productName}</p>
                              {variant.fabric && <span className="text-[10px] text-gray-400">Fabric: {variant.fabric}</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700 uppercase">
                                {variant.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[11px] font-bold text-gray-200 bg-gray-800/90 px-2.5 py-0.5 rounded-lg border border-gray-700/60 inline-block">
                                {variant.color}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[11px] font-black text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30 inline-block">
                                {variant.size}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${variant.availableStock <= 5 ? 'text-red-400 bg-red-500/15 border border-red-500/30' : variant.availableStock <= 20 ? 'text-yellow-400 bg-yellow-500/15 border border-yellow-500/30' : 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'}`}>
                                {variant.availableStock} <span className="text-[10px] font-medium text-gray-400">units</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.max(1, allocQty - 1) }))}
                                  className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold flex items-center justify-center"
                                >
                                  <Minus size={11} />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={variant.availableStock}
                                  value={allocQty}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 1;
                                    setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.min(variant.availableStock, Math.max(1, val)) }));
                                  }}
                                  className="w-14 bg-gray-950 border border-gray-700 rounded text-center text-xs font-black text-white py-1 outline-none focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.min(variant.availableStock, allocQty + 1) }))}
                                  className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold flex items-center justify-center"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {inCart ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                    ✓ In Cart: {inCart.quantity}
                                  </span>
                                  <button
                                    onClick={() => removeFromCart(cartKey)}
                                    className="text-red-400 hover:text-red-300 p-1 rounded transition"
                                    title="Remove from Cart"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => addToCart(variant, allocQty)}
                                  disabled={variant.availableStock <= 0}
                                  className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-black px-3 py-1 rounded-lg text-xs transition-all border border-amber-500/30 flex items-center gap-1 mx-auto whitespace-nowrap"
                                >
                                  <Plus size={12} /> Allocate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ═════════ Grouped by Product View (with Color & Size expansion) ═════════ */
                <div className="space-y-3 max-h-[620px] overflow-y-auto">
                  {groupedProducts.map(group => {
                    const isExpanded = expandedProducts[group.productName] ?? true; // default open
                    const groupTotalStock = group.variants.reduce((sum, v) => sum + (v.availableStock || 0), 0);

                    return (
                      <div key={group.productName} className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 space-y-3">
                        <div
                          className="flex items-center justify-between cursor-pointer select-none"
                          onClick={() => setExpandedProducts(prev => ({ ...prev, [group.productName]: !isExpanded }))}
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Package size={18} />
                            </span>
                            <div>
                              <h3 className="text-sm font-black text-white">{group.productName}</h3>
                              <p className="text-[11px] text-gray-400">
                                <span className="font-bold text-gray-300">{group.category}</span>
                                {group.fabric && ` • Fabric: ${group.fabric}`} • {group.variants.length} Variants
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                              Total Stock: {groupTotalStock} units
                            </span>
                            {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                          </div>
                        </div>

                        {/* Variants Breakdown Table */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-gray-800 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-gray-400 font-bold uppercase text-[10px] border-b border-gray-800">
                                  <th className="py-2">Color</th>
                                  <th className="py-2">Size</th>
                                  <th className="py-2 text-right">Available Qty</th>
                                  <th className="py-2 text-center w-32">Allocation Qty</th>
                                  <th className="py-2 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-800/40">
                                {group.variants.map(variant => {
                                  const cartKey = `${variant.inventoryItemId}-${variant.color || ''}-${variant.size || ''}`;
                                  const inCart = cart.find(c => c.cartKey === cartKey);
                                  const allocQty = rowAllocQty[variant.id] ?? 1;

                                  return (
                                    <tr key={variant.id} className={`hover:bg-gray-800/40 ${inCart ? 'bg-amber-500/10' : ''}`}>
                                      <td className="py-2 font-bold text-gray-200">{variant.color}</td>
                                      <td className="py-2 font-black text-amber-300">{variant.size}</td>
                                      <td className="py-2 text-right">
                                        <span className="font-black text-emerald-400">{variant.availableStock}</span> units
                                      </td>
                                      <td className="py-2">
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.max(1, allocQty - 1) }))}
                                            className="w-5 h-5 rounded bg-gray-800 text-gray-300 font-bold flex items-center justify-center"
                                          >
                                            <Minus size={10} />
                                          </button>
                                          <input
                                            type="number"
                                            min="1"
                                            max={variant.availableStock}
                                            value={allocQty}
                                            onChange={e => {
                                              const val = parseInt(e.target.value) || 1;
                                              setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.min(variant.availableStock, Math.max(1, val)) }));
                                            }}
                                            className="w-12 bg-gray-950 border border-gray-700 rounded text-center text-xs font-black text-white py-0.5"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => setRowAllocQty(prev => ({ ...prev, [variant.id]: Math.min(variant.availableStock, allocQty + 1) }))}
                                            className="w-5 h-5 rounded bg-gray-800 text-gray-300 font-bold flex items-center justify-center"
                                          >
                                            <Plus size={10} />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-2 text-center">
                                        {inCart ? (
                                          <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                            ✓ In Cart ({inCart.quantity})
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => addToCart(variant, allocQty)}
                                            className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black font-black px-2.5 py-0.5 rounded text-[11px] border border-amber-500/30"
                                          >
                                            Allocate
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Handover Cart & Submission Panel */}
          <div className="space-y-4">
            <div className="glass p-5 rounded-2xl border border-gray-800 space-y-4 sticky top-6">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-amber-400" /> Handover Cart
                </span>
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-black">
                  {cart.reduce((s, i) => s + i.quantity, 0)} Units ({cart.length} SKUs)
                </span>
              </h2>

              {/* Target ASM Selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Target ASM Profile *
                </label>
                <select
                  value={selectedAsmId}
                  onChange={e => setSelectedAsmId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 font-bold"
                >
                  <option value="">Select ASM Profile</option>
                  {asmUsers.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                  ))}
                </select>
              </div>

              {/* Cart Items List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto border-t border-b border-gray-800 py-3">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-xs font-bold flex flex-col items-center justify-center gap-2">
                    <ShoppingCart size={24} className="text-gray-600" />
                    <span>Handover cart is empty. Select product, color & size variants to allocate.</span>
                  </div>
                ) : (
                  cart.map(c => (
                    <div key={c.cartKey} className="bg-gray-900/90 rounded-xl p-3 text-xs space-y-1.5 border border-gray-800">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-white">{c.productName}</p>
                          <div className="flex items-center gap-2 text-[10px] mt-0.5">
                            <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-bold">{c.color}</span>
                            <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded font-black">{c.size}</span>
                            {c.category && <span className="text-gray-500">({c.category})</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(c.cartKey)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Remove from Cart"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-800/60">
                        <span className="text-[10px] text-gray-400">
                          Warehouse Stock: <strong className="text-emerald-400">{c.stock}</strong>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 font-bold">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            max={c.stock}
                            value={c.quantity}
                            onChange={e => updateCartQty(c.cartKey, e.target.value)}
                            className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-white text-center font-bold outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Handover Notes */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Handover Notes / Instructions
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes for ASM physical handover receipt..."
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={submitting || cart.length === 0 || !selectedAsmId}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
              >
                {submitting ? 'Allocating Warehouse Stock...' : 'Submit ASM Stock Allocation'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ Tab 2 / Tab 4: Requests / History ═══════════════════ */}
      {(activeTab === 'requests' || activeTab === 'history') && (
        <div className="glass p-6 rounded-3xl border border-gray-800 space-y-4">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            {activeTab === 'history' ? 'Completed ASM Stock Allocation History' : 'Active ASM Stock Handover Requests'}
          </h2>
          {requestsLoading ? (
            <div className="py-12 text-center text-gray-500 font-bold">Loading handover requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-bold">No handover requests found</div>
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

                  {/* Items Table with Color + Size breakdown */}
                  {selectedRequest?.id === reqData.id && (
                    <div className="pt-2 space-y-3">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                              <th className="py-2">Product</th>
                              <th className="py-2">Category</th>
                              <th className="py-2">Color / Size</th>
                              <th className="py-2 text-right">Qty Given</th>
                              <th className="py-2 text-right">Qty Returned</th>
                              <th className="py-2 text-right">Remaining with ASM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reqData.items.map(item => (
                              <tr key={item.id} className="border-b border-gray-800/50 text-gray-300">
                                <td className="py-2 font-bold text-white">{item.productName}</td>
                                <td className="py-2 text-gray-400">{item.category}</td>
                                <td className="py-2 text-gray-400">
                                  <span className="font-bold text-gray-200">{item.color || '—'}</span> / <span className="font-bold text-amber-300">{item.size || '—'}</span>
                                </td>
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
              Verify physical returned stock before accepting. Stock will be restored to Warehouse Inventory (exact Product, Color & Size) upon Store Accept.
            </p>
          </div>

          {returnsLoading ? (
            <div className="py-12 text-center text-gray-500 font-bold">Loading returned stock requests...</div>
          ) : returns.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-bold">No pending stock returns to verify</div>
          ) : (
            <div className="space-y-4">
              {returns.map(retRec => (
                <div key={retRec.id} className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-emerald-400">{retRec.returnNumber}</span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${retRec.status === 'STORE_ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {retRec.status === 'STORE_ACCEPTED' ? '✓ Accepted & Restored to Warehouse' : '⚠️ Pending Store Acceptance'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        ASM: <span className="text-white font-bold">{retRec.asmName}</span> | Handover #: <span className="text-amber-300 font-bold">{retRec.request?.requestNumber}</span> | Date: {formatDateTime(retRec.submittedAt)}
                      </p>
                    </div>

                    {retRec.status === 'PENDING_STORE_ACCEPT' && (
                      <button onClick={() => handleAcceptReturn(retRec.id)} disabled={acceptingReturnId === retRec.id}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30">
                        {acceptingReturnId === retRec.id ? 'Restoring Warehouse Stock...' : 'Verify & Accept Return'} <Check size={16} />
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
                          <th className="py-2">Color</th>
                          <th className="py-2">Size</th>
                          <th className="py-2 text-right">Quantity Returned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retRec.items.map(item => (
                          <tr key={item.id} className="border-b border-gray-800/50 text-gray-300">
                            <td className="py-2 font-bold text-white">{item.productName}</td>
                            <td className="py-2 text-gray-400">{item.category}</td>
                            <td className="py-2 font-bold text-gray-200">{item.color || '—'}</td>
                            <td className="py-2 font-black text-amber-300">{item.size || '—'}</td>
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

      {/* ═══════════════════ Tab 4: Bulk Allocation ═══════════════════ */}
      {activeTab === 'bulk-allocation' && (
        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border border-gray-800">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-1">
              Pending Bulk Allocations
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Review requests from vendors and allocate available warehouse stock.
            </p>
            
            {bulkOrdersLoading ? (
              <div className="py-12 text-center text-gray-500 font-bold">Loading bulk orders...</div>
            ) : bulkOrders.filter(o => o.currentStage === 'SENT_TO_STORE').length === 0 ? (
              <div className="py-12 text-center text-gray-500 font-bold">No pending bulk allocation orders</div>
            ) : (
              <div className="space-y-6">
                {bulkOrders.filter(o => o.currentStage === 'SENT_TO_STORE').map(order => (
                  <div key={order.id} className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-amber-400">{order.orderNumber}</span>
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-400">
                            Pending Store Allocation
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Vendor: <span className="text-white font-bold">{order.vendor?.name}</span> | ASM: <span className="text-gray-300">{order.asm?.name}</span> | Date: {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleBulkAllocate(order.id)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20"
                      >
                        Confirm Allocation & Send to ASM <ArrowRight size={16} />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                            <th className="py-2">Product</th>
                            <th className="py-2">Color</th>
                            <th className="py-2">Size</th>
                            <th className="py-2 text-right">Requested Qty</th>
                            <th className="py-2 text-right">Warehouse Available</th>
                            <th className="py-2 text-center w-36">Allocate Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map(item => {
                            const allocQty = bulkAllocations[order.id]?.[item.id] || 0;
                            const stockLow = (item.availableWarehouseStock || 0) < item.quantity;
                            
                            return (
                              <tr key={item.id} className={`border-b border-gray-800/50 text-gray-300 ${stockLow ? 'bg-amber-500/10' : ''}`}>
                                <td className="py-2 font-bold text-white">{item.productName}</td>
                                <td className="py-2 font-bold text-gray-200">{item.color || '—'}</td>
                                <td className="py-2 font-black text-amber-300">{item.size || '—'}</td>
                                <td className="py-2 text-right font-bold text-blue-400">{item.quantity}</td>
                                <td className="py-2 text-right font-bold text-emerald-400">{item.availableWarehouseStock || 0}</td>
                                <td className="py-2">
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max={item.availableWarehouseStock || 0}
                                      value={allocQty}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setBulkAllocations(prev => ({
                                          ...prev,
                                          [order.id]: {
                                            ...prev[order.id],
                                            [item.id]: Math.max(0, Math.min(item.availableWarehouseStock || 0, val))
                                          }
                                        }));
                                      }}
                                      className="w-16 bg-gray-950 border border-gray-700 rounded text-center text-xs font-black text-white py-1 outline-none focus:border-amber-500"
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Already Allocated Section */}
          <div className="glass p-6 rounded-3xl border border-gray-800">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              Processed / Allocated Orders
            </h2>
            {bulkOrdersLoading ? (
              <div className="py-8 text-center text-gray-500 font-bold">Loading...</div>
            ) : bulkOrders.filter(o => ['SENT_TO_ASM', 'ASM_ACCEPTED'].includes(o.currentStage)).length === 0 ? (
              <div className="py-8 text-center text-gray-500 font-bold">No processed orders</div>
            ) : (
              <div className="space-y-4">
                {bulkOrders.filter(o => ['SENT_TO_ASM', 'ASM_ACCEPTED'].includes(o.currentStage)).map(order => (
                  <div key={order.id} className="bg-gray-900/40 rounded-2xl p-4 border border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-gray-300">{order.orderNumber}</span>
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-blue-500/20 text-blue-400">
                            {order.currentStage.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Vendor: <span className="text-gray-400">{order.vendor?.name}</span> | ASM: <span className="text-gray-400">{order.asm?.name}</span>
                        </p>
                      </div>
                    </div>
                    <div className="overflow-x-auto opacity-75">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-600 font-bold uppercase">
                            <th className="py-1">Product</th>
                            <th className="py-1 text-right">Requested</th>
                            <th className="py-1 text-right">Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map(item => (
                            <tr key={item.id} className="border-b border-gray-800/30 text-gray-400">
                              <td className="py-1">{item.productName} ({item.color}/{item.size})</td>
                              <td className="py-1 text-right">{item.quantity}</td>
                              <td className="py-1 text-right font-bold text-emerald-400">{item.allocatedQuantity || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AsmAllowedStorePage;
