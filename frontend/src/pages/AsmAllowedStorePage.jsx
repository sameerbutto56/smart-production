import React, { useState, useEffect, useMemo, useCallback } from 'react';
import BackButton from '../components/BackButton';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Package, ShoppingCart, Search, Plus, Trash2, CheckCircle2, RotateCcw,
  Printer, ArrowRight, X, AlertCircle, RefreshCw, FileText, Check, User,
  Building2, ChevronRight, ChevronDown, Layers, LayoutGrid, List, Minus,
  Sparkles, Factory, Palette, Truck, ShieldCheck, CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';
import { printDeliverySheet, printVendorJobSheet } from '../utils/vendorDocumentPrint';

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

  // Bulk Allocation & Routing state
  const [bulkOrders, setBulkOrders] = useState([]);
  const [bulkOrdersLoading, setBulkOrdersLoading] = useState(false);
  const [bulkAllocations, setBulkAllocations] = useState({});
  const [bulkSubTab, setBulkSubTab] = useState('pending'); // 'pending' | 'pipeline' | 'returns'
  const [productionReturns, setProductionReturns] = useState([]);
  const [productionReturnsLoading, setProductionReturnsLoading] = useState(false);
  const [routingModalOrder, setRoutingModalOrder] = useState(null);
  const [routeConfig, setRouteConfig] = useState({});
  const [routingNotes, setRoutingNotes] = useState({ logoNotes: '', prodNotes: '' });
  const [actionInProgress, setActionInProgress] = useState(null);

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
        initialAllocs[order.id] = {};
        order.items?.forEach(item => {
          const routing = order.routingItems?.find(r => r.orderItemId === item.id);
          const currentStoreAvail = routing?.storeAvailableQuantity ?? item.allocatedQuantity;
          initialAllocs[order.id][item.id] = (currentStoreAvail !== undefined && currentStoreAvail > 0)
            ? currentStoreAvail
            : Math.max(0, Math.min(item.quantity, item.availableWarehouseStock || 0));
        });
      });
      setBulkAllocations(initialAllocs);
    } catch (err) {
      toast.error('Failed to load bulk allocation orders');
    }
    setBulkOrdersLoading(false);
  }, []);

  // Fetch Production Returns
  const fetchProductionReturns = useCallback(async () => {
    setProductionReturnsLoading(true);
    try {
      const res = await api.get('/api/vendors/orders/production-returns');
      setProductionReturns(res.data?.items || []);
    } catch (err) {
      // Non-blocking
    }
    setProductionReturnsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'new-handover') fetchCatalog();
    else if (activeTab === 'requests' || activeTab === 'history') fetchRequests();
    else if (activeTab === 'returns') fetchReturns();
    else if (activeTab === 'bulk-allocation') {
      fetchBulkOrders();
      fetchProductionReturns();
    }
  }, [activeTab, fetchCatalog, fetchRequests, fetchReturns, fetchBulkOrders, fetchProductionReturns]);

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

  // Handle Bulk Allocation Submit (legacy & quick one-click)
  const handleBulkAllocate = async (orderId) => {
    const orderAllocs = bulkAllocations[orderId];
    if (!orderAllocs) return;
    setActionInProgress(orderId);
    const allocations = Object.entries(orderAllocs).map(([itemId, allocatedQuantity]) => ({
      itemId,
      allocatedQuantity: parseInt(allocatedQuantity) || 0
    }));

    try {
      await api.post(`/api/vendors/orders/${orderId}/store-allocate`, { allocations });
      toast.success('Order allocated and sent to ASM!');
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allocate order');
    }
    setActionInProgress(null);
  };

  // 1-Click Action: All Products Available
  const handleAllProductsAvailable = async (orderId) => {
    setActionInProgress(orderId);
    try {
      const res = await api.post(`/api/vendors/orders/${orderId}/all-products-available`);
      toast.success(res.data?.message || 'All products verified available and warehouse inventory deducted!');
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark all products available');
    }
    setActionInProgress(null);
  };

  // Item-by-item availability check and partial warehouse deduction
  const handleCheckAvailability = async (orderId) => {
    const orderAllocs = bulkAllocations[orderId];
    if (!orderAllocs) return;
    setActionInProgress(orderId);
    const items = Object.entries(orderAllocs).map(([itemId, availableQuantity]) => ({
      itemId,
      availableQuantity: parseInt(availableQuantity) || 0
    }));

    try {
      const res = await api.post(`/api/vendors/orders/${orderId}/store-check-availability`, { items });
      toast.success(res.data?.message || 'Store availability confirmed and inventory deducted!');
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check store availability');
    }
    setActionInProgress(null);
  };

  // Open Routing Modal
  const handleOpenRoutingModal = (order) => {
    setRoutingModalOrder(order);
    const initialConfig = {};
    order.items?.forEach(item => {
      const routing = order.routingItems?.find(r => r.orderItemId === item.id);
      const avail = routing ? routing.storeAvailableQuantity : (bulkAllocations[order.id]?.[item.id] || 0);
      const rem = Math.max(0, item.quantity - avail);
      initialConfig[item.id] = {
        availableRoute: avail > 0 ? 'ASM' : 'NONE',
        processingRoute: rem > 0 ? 'PRODUCTION' : 'NONE',
        processingQuantity: rem,
      };
    });
    setRouteConfig(initialConfig);
    setRoutingNotes({ logoNotes: '', prodNotes: '' });
  };

  // Confirm and Execute Store Routing
  const handleConfirmRouting = async (orderId) => {
    setActionInProgress(orderId);
    const routes = Object.entries(routeConfig).map(([itemId, cfg]) => ({
      itemId,
      availableRoute: cfg.availableRoute,
      processingRoute: cfg.processingRoute,
      processingQuantity: parseInt(cfg.processingQuantity) || 0,
      logoNotes: routingNotes.logoNotes,
      productionNotes: routingNotes.prodNotes,
    }));

    try {
      const res = await api.post(`/api/vendors/orders/${orderId}/store-route`, { routes });
      toast.success(res.data?.message || 'Order items routed successfully!');
      setRoutingModalOrder(null);
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to route order');
    }
    setActionInProgress(null);
  };

  // Store receives returned goods from Production — ZERO secondary inventory deduction!
  const handleReceiveProductionReturn = async (orderId) => {
    setActionInProgress(orderId);
    try {
      const res = await api.post(`/api/vendors/orders/${orderId}/receive-production-return`);
      toast.success(res.data?.message || 'Returned stock received in store (0 secondary inventory deduction)!');
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to receive returned stock');
    }
    setActionInProgress(null);
  };

  // Store secondary routing: Send returned goods to ASM
  const handleReturnToAsm = async (orderId) => {
    setActionInProgress(orderId);
    try {
      const res = await api.post(`/api/vendors/orders/${orderId}/return-to-asm`);
      toast.success(res.data?.message || 'Returned stock sent to ASM! Delivery Sheet ready.');
      fetchBulkOrders();
      fetchProductionReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send returned stock to ASM');
    }
    setActionInProgress(null);
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
      {activeTab === 'bulk-allocation' && (() => {
        const pendingOrders = bulkOrders.filter(o => o.currentStage === 'SENT_TO_STORE');
        const returnOrders = bulkOrders.filter(o => ['RETURN_FROM_PRODUCTION', 'STORE_RECEIVED'].includes(o.currentStage));
        const pipelineOrders = bulkOrders.filter(o => ['LOGO', 'STORE_TO_LOGO', 'LOGO_ACCEPTED', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'SENT_TO_ASM', 'ASM_ACCEPTED', 'ASM_RECEIVED'].includes(o.currentStage));

        return (
          <div className="space-y-6">
            {/* Sub-tab Switcher */}
            <div className="flex flex-wrap gap-2 glass p-2 rounded-2xl border border-gray-800">
              <button
                onClick={() => setBulkSubTab('pending')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  bulkSubTab === 'pending'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Package size={14} /> Store Availability Verification
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${bulkSubTab === 'pending' ? 'bg-black/30 text-black' : 'bg-gray-800 text-gray-300'}`}>
                  {pendingOrders.length}
                </span>
              </button>
              <button
                onClick={() => setBulkSubTab('returns')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  bulkSubTab === 'returns'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <RotateCcw size={14} /> Return From Production
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${bulkSubTab === 'returns' ? 'bg-black/30 text-black' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {returnOrders.length + productionReturns.length}
                </span>
              </button>
              <button
                onClick={() => setBulkSubTab('pipeline')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  bulkSubTab === 'pipeline'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Layers size={14} /> Active Processing Pipeline
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${bulkSubTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-300'}`}>
                  {pipelineOrders.length}
                </span>
              </button>
            </div>

            {/* ── SUB-TAB 1: Store Availability Verification ─────────────────── */}
            {bulkSubTab === 'pending' && (
              <div className="glass p-6 rounded-3xl border border-gray-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                      <Package size={16} className="text-amber-400" /> Pending Bulk Orders Awaiting Store Verification
                    </h2>
                    <p className="text-xs text-gray-400">
                      Verify warehouse availability (Product + Color + Size). Allocate available quantities or trigger single-click All Products Available.
                    </p>
                  </div>
                  <button
                    onClick={() => { fetchBulkOrders(); fetchProductionReturns(); }}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw size={13} className={bulkOrdersLoading ? 'animate-spin' : ''} /> Refresh Orders
                  </button>
                </div>

                {bulkOrdersLoading ? (
                  <div className="py-12 text-center text-gray-500 font-bold">Loading bulk orders...</div>
                ) : pendingOrders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-bold flex flex-col items-center gap-2">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                    <span>No pending bulk allocation orders. All orders have been verified or routed!</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingOrders.map(order => {
                      const isOrderBusy = actionInProgress === order.id;
                      const hasAllStock = order.canAllProductsAvailable;

                      return (
                        <div key={order.id} className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 space-y-4 shadow-xl">
                          {/* Order Header */}
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-base font-black text-amber-400 tracking-wider">{order.orderNumber}</span>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  SENT TO STORE
                                </span>
                                {hasAllStock && (
                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <Sparkles size={11} /> 100% In Stock
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Vendor: <span className="text-white font-bold">{order.vendor?.name}</span>
                                {order.vendor?.companyName ? ` (${order.vendor.companyName})` : ''} | ASM: <span className="text-gray-300 font-bold">{order.asm?.name}</span> | Date: {formatDateTime(order.createdAt)}
                              </p>
                            </div>

                            {/* 1-Click Action: All Products Available */}
                            <div className="flex flex-wrap items-center gap-2">
                              {hasAllStock && (
                                <button
                                  onClick={() => handleAllProductsAvailable(order.id)}
                                  disabled={isOrderBusy}
                                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition transform hover:-translate-y-0.5"
                                  title="Atomically deduct all items and mark available in store"
                                >
                                  <Sparkles size={14} className="text-amber-300" />
                                  {isOrderBusy ? 'Processing...' : 'All Products Available (1-Click)'}
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenRoutingModal(order)}
                                disabled={isOrderBusy}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-900/30 transition"
                              >
                                <ArrowRight size={14} /> Route Order
                              </button>
                            </div>
                          </div>

                          {/* Items Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                                  <th className="py-2">Product Name</th>
                                  <th className="py-2">Color</th>
                                  <th className="py-2">Size</th>
                                  <th className="py-2 text-right">Requested</th>
                                  <th className="py-2 text-right">Warehouse Stock</th>
                                  <th className="py-2 text-center w-36">Store Available</th>
                                  <th className="py-2 text-right">Remaining</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map(item => {
                                  const allocQty = bulkAllocations[order.id]?.[item.id] ?? (item.allocatedQuantity || 0);
                                  const availStock = item.availableWarehouseStock || 0;
                                  const stockLow = availStock < item.quantity;
                                  const remaining = Math.max(0, item.quantity - allocQty);

                                  return (
                                    <tr key={item.id} className={`border-b border-gray-800/50 text-gray-300 ${stockLow ? 'bg-amber-500/5' : ''}`}>
                                      <td className="py-2 font-bold text-white">{item.productName}</td>
                                      <td className="py-2 font-bold text-gray-200">{item.color || '—'}</td>
                                      <td className="py-2 font-black text-amber-300">{item.size || '—'}</td>
                                      <td className="py-2 text-right font-bold text-blue-400">{item.quantity}</td>
                                      <td className="py-2 text-right font-bold text-emerald-400">
                                        {availStock}
                                        {stockLow && <span className="ml-1 text-[10px] text-amber-400 font-normal">(low)</span>}
                                      </td>
                                      <td className="py-2">
                                        <div className="flex items-center justify-center">
                                          <input
                                            type="number"
                                            min="0"
                                            max={item.quantity}
                                            value={allocQty}
                                            onChange={e => {
                                              const val = parseInt(e.target.value) || 0;
                                              const bounded = Math.max(0, Math.min(item.quantity, val));
                                              setBulkAllocations(prev => ({
                                                ...prev,
                                                [order.id]: {
                                                  ...prev[order.id],
                                                  [item.id]: bounded
                                                }
                                              }));
                                            }}
                                            className="w-16 bg-gray-950 border border-gray-700 rounded text-center text-xs font-black text-white py-1 outline-none focus:border-amber-500"
                                          />
                                        </div>
                                      </td>
                                      <td className={`py-2 text-right font-bold ${remaining > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                                        {remaining}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Action Footer */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/60">
                            <span className="text-[11px] text-gray-400">
                              * Inventory is deducted atomically when availability is confirmed.
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCheckAvailability(order.id)}
                                disabled={isOrderBusy}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                              >
                                <CheckCheck size={14} className="text-emerald-400" />
                                {isOrderBusy ? 'Saving...' : 'Confirm Store Availability'}
                              </button>
                              <button
                                onClick={() => handleBulkAllocate(order.id)}
                                disabled={isOrderBusy}
                                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                              >
                                Send to ASM <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB 2: Return From Production ─────────────────────────── */}
            {bulkSubTab === 'returns' && (
              <div className="glass p-6 rounded-3xl border border-gray-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                      <RotateCcw size={16} className="text-emerald-400" /> Return From Production & Store Receiving
                    </h2>
                    <p className="text-xs text-gray-400">
                      Completed items returned from Production. Store verifies count and receives into Store with ZERO secondary inventory deduction.
                    </p>
                  </div>
                  <button
                    onClick={() => { fetchBulkOrders(); fetchProductionReturns(); }}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw size={13} className={productionReturnsLoading ? 'animate-spin' : ''} /> Refresh Returns
                  </button>
                </div>

                {returnOrders.length === 0 && productionReturns.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-bold flex flex-col items-center gap-2">
                    <CheckCircle2 size={32} className="text-gray-600" />
                    <span>No pending goods returned from Production</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {returnOrders.map(order => {
                      const isOrderBusy = actionInProgress === order.id;
                      const isReceivedInStore = order.currentStage === 'STORE_RECEIVED';

                      return (
                        <div key={order.id} className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-emerald-400">{order.orderNumber}</span>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                  isReceivedInStore
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}>
                                  {isReceivedInStore ? '✓ STORE RECEIVED (Awaiting Handover)' : 'RETURN FROM PRODUCTION'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Vendor: <span className="text-white font-bold">{order.vendor?.name}</span> | ASM: <span className="text-gray-300 font-bold">{order.asm?.name}</span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {!isReceivedInStore ? (
                                <button
                                  onClick={() => handleReceiveProductionReturn(order.id)}
                                  disabled={isOrderBusy}
                                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition"
                                >
                                  <ShieldCheck size={14} />
                                  {isOrderBusy ? 'Receiving...' : 'Receive From Production'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleReturnToAsm(order.id)}
                                    disabled={isOrderBusy}
                                    className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
                                  >
                                    <ArrowRight size={14} /> Send to ASM
                                  </button>
                                  <button
                                    onClick={() => printDeliverySheet(order)}
                                    className="bg-teal-600 hover:bg-teal-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition"
                                  >
                                    <Printer size={14} /> Delivery Sheet
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Items Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                                  <th className="py-2">Product Name</th>
                                  <th className="py-2">Color</th>
                                  <th className="py-2">Size</th>
                                  <th className="py-2 text-right">Required</th>
                                  <th className="py-2 text-right">Returned Qty</th>
                                  <th className="py-2 text-right">Stage Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map(item => {
                                  const rItem = order.routingItems?.find(r => r.orderItemId === item.id);
                                  const returnedQty = rItem?.storeReceivedReturnQty || rItem?.productionOutQuantity || rItem?.processingQuantity || item.quantity;

                                  return (
                                    <tr key={item.id} className="border-b border-gray-800/50 text-gray-300">
                                      <td className="py-2 font-bold text-white">{item.productName}</td>
                                      <td className="py-2 font-bold text-gray-200">{item.color || '—'}</td>
                                      <td className="py-2 font-black text-amber-300">{item.size || '—'}</td>
                                      <td className="py-2 text-right font-bold text-blue-400">{item.quantity}</td>
                                      <td className="py-2 text-right font-black text-emerald-400">{returnedQty}</td>
                                      <td className="py-2 text-right">
                                        <span className="text-[10px] font-bold text-gray-400">
                                          {rItem?.currentProcessingStage || order.currentStage}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="bg-gray-950/60 p-3 rounded-xl text-[11px] text-gray-400 flex items-center gap-2 border border-gray-800/50">
                            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                            <span>Zero secondary inventory deduction: goods produced and returned directly from production floor.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB 3: Active Processing Pipeline ───────────────────────── */}
            {bulkSubTab === 'pipeline' && (
              <div className="glass p-6 rounded-3xl border border-gray-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                      <Layers size={16} className="text-blue-400" /> Active Order Processing Pipeline
                    </h2>
                    <p className="text-xs text-gray-400">
                      Tracking orders in Logo customization, Production manufacturing, Store handover, and ASM delivery.
                    </p>
                  </div>
                  <button
                    onClick={() => { fetchBulkOrders(); fetchProductionReturns(); }}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw size={13} className={bulkOrdersLoading ? 'animate-spin' : ''} /> Refresh Pipeline
                  </button>
                </div>

                {pipelineOrders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-bold">No active orders in processing pipeline</div>
                ) : (
                  <div className="space-y-4">
                    {pipelineOrders.map(order => {
                      const isLogo = ['LOGO', 'STORE_TO_LOGO', 'LOGO_ACCEPTED'].includes(order.currentStage);
                      const isProd = ['PRODUCTION', 'PRODUCTION_ACCEPTANCE'].includes(order.currentStage);
                      const isHandover = ['SENT_TO_ASM', 'ASM_ACCEPTED', 'ASM_RECEIVED'].includes(order.currentStage);

                      return (
                        <div key={order.id} className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-white">{order.orderNumber}</span>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                                  isLogo
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : isProd
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                }`}>
                                  {order.currentStage.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Vendor: <span className="text-gray-200 font-bold">{order.vendor?.name}</span> | ASM: <span className="text-gray-300">{order.asm?.name}</span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Print Job Sheet for Logo */}
                              {(isLogo || order.routingItems?.some(r => r.processingRoute === 'LOGO')) && (
                                <button
                                  onClick={() => printVendorJobSheet(order, 'LOGO', order.items)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold transition shadow"
                                >
                                  <Printer size={13} /> Job Sheet (Logo)
                                </button>
                              )}

                              {/* Print Job Sheet for Production */}
                              {(isProd || order.routingItems?.some(r => r.processingRoute === 'PRODUCTION')) && (
                                <button
                                  onClick={() => printVendorJobSheet(order, 'PRODUCTION', order.items)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold transition shadow"
                                >
                                  <Printer size={13} /> Job Sheet (Production)
                                </button>
                              )}

                              {/* Print Delivery Sheet for ASM */}
                              <button
                                onClick={() => printDeliverySheet(order)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/80 hover:bg-teal-600 text-white text-xs font-bold transition shadow"
                              >
                                <Printer size={13} /> Delivery Sheet
                              </button>
                            </div>
                          </div>

                          {/* Items summary */}
                          <div className="overflow-x-auto opacity-85">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-gray-800 text-gray-500 font-bold uppercase">
                                  <th className="py-1">Product</th>
                                  <th className="py-1">Color / Size</th>
                                  <th className="py-1 text-right">Requested</th>
                                  <th className="py-1 text-right">Allocated</th>
                                  <th className="py-1 text-right">Job Sheet #</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map(item => {
                                  const rItem = order.routingItems?.find(r => r.orderItemId === item.id);
                                  return (
                                    <tr key={item.id} className="border-b border-gray-800/30 text-gray-300">
                                      <td className="py-1 font-bold text-white">{item.productName}</td>
                                      <td className="py-1 text-gray-400">{item.color || '—'} / {item.size || '—'}</td>
                                      <td className="py-1 text-right text-blue-400">{item.quantity}</td>
                                      <td className="py-1 text-right font-black text-emerald-400">{item.allocatedQuantity || 0}</td>
                                      <td className="py-1 text-right font-mono text-[11px] text-amber-300">{rItem?.jobSheetNumber || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── MODAL: Store Item-Level Routing ───────────────────────────── */}
            {routingModalOrder && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <ArrowRight size={18} className="text-blue-400" /> Route Order #{routingModalOrder.orderNumber}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Vendor: <span className="text-white font-bold">{routingModalOrder.vendor?.name}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setRoutingModalOrder(null)}
                      className="p-1 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs text-gray-300">
                      Configure item destination. Available units can go directly to <strong>ASM</strong>, while remaining units can be routed to <strong>Logo</strong> or <strong>Production</strong>.
                    </p>

                    <div className="space-y-3">
                      {routingModalOrder.items.map(item => {
                        const cfg = routeConfig[item.id] || {};
                        const allocQty = bulkAllocations[routingModalOrder.id]?.[item.id] ?? (item.allocatedQuantity || 0);
                        const remQty = Math.max(0, item.quantity - allocQty);

                        return (
                          <div key={item.id} className="p-3 bg-gray-950/80 border border-gray-800 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-white">{item.productName}</span>
                                <span className="text-gray-400 ml-2">({item.color || '—'} / {item.size || '—'})</span>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-400">Total: </span>
                                <span className="font-bold text-blue-400">{item.quantity}</span> |
                                <span className="text-emerald-400 ml-1">Store Avail: {allocQty}</span> |
                                <span className="text-amber-400 ml-1">Rem: {remQty}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-gray-800/50">
                              {/* Available Units Route */}
                              <div className="text-xs">
                                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                                  Available Units ({allocQty})
                                </label>
                                <select
                                  value={cfg.availableRoute || 'ASM'}
                                  onChange={e => setRouteConfig(prev => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], availableRoute: e.target.value }
                                  }))}
                                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                  <option value="ASM">Send to ASM (Allocated: {allocQty})</option>
                                  <option value="NONE">Keep in Store</option>
                                </select>
                              </div>

                              {/* Remaining Units Processing Route */}
                              <div className="text-xs">
                                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                                  Remaining / Custom Units ({remQty})
                                </label>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={cfg.processingRoute || 'NONE'}
                                    onChange={e => setRouteConfig(prev => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], processingRoute: e.target.value }
                                    }))}
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                  >
                                    <option value="NONE">None (Fully Available)</option>
                                    <option value="LOGO">Send to Logo</option>
                                    <option value="PRODUCTION">Send to Production</option>
                                  </select>
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    value={cfg.processingQuantity ?? remQty}
                                    onChange={e => {
                                      const val = parseInt(e.target.value) || 0;
                                      setRouteConfig(prev => ({
                                        ...prev,
                                        [item.id]: { ...prev[item.id], processingQuantity: val }
                                      }));
                                    }}
                                    className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center text-white"
                                    placeholder="Qty"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Operational Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-bold text-gray-300 block mb-1">
                          Logo Notes (Printing / Embroidery Specs)
                        </label>
                        <textarea
                          rows={2}
                          value={routingNotes.logoNotes}
                          onChange={e => setRoutingNotes(prev => ({ ...prev, logoNotes: e.target.value }))}
                          placeholder="Chest logo, gold embroidery, placement details..."
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-300 block mb-1">
                          Production Notes (Tailoring / Stitching Specs)
                        </label>
                        <textarea
                          rows={2}
                          value={routingNotes.prodNotes}
                          onChange={e => setRoutingNotes(prev => ({ ...prev, prodNotes: e.target.value }))}
                          placeholder="Length specifications, pocket placement, urgency..."
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                    <button
                      onClick={() => setRoutingModalOrder(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirmRouting(routingModalOrder.id)}
                      disabled={actionInProgress === routingModalOrder.id}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-900/30 transition"
                    >
                      {actionInProgress === routingModalOrder.id ? 'Routing...' : 'Confirm Routing & Generate Job Sheets'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AsmAllowedStorePage;
