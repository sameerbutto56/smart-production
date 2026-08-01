import React, { useState, useEffect } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import {
  Package, ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  RefreshCcw, Search, Clock, Truck, Building2, PlusCircle,
  Eye, ThumbsUp, ThumbsDown, FileText, BarChart3, MinusCircle, Minus, Plus,
  CheckCircle, AlertCircle, Download, TrendingUp, User, Gift, Send,
  Factory, Trash2, ClipboardList, X, Activity, Printer, FileSpreadsheet, Layers, ArrowLeft, RotateCcw, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import OrderCard from '../components/OrderCard';
import toast from 'react-hot-toast';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { usePolling } from '../hooks/usePolling';
import InventoryManagement from './InventoryManagement';
import StoreDashboardAnalytics from '../components/StoreDashboardAnalytics';
import WarehouseReturns from '../components/WarehouseReturns';
import WarehouseAudit from '../components/WarehouseAudit';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';
import { formatDateOnly, formatTimeOnly, formatDateTime } from '../utils/dateTime';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const TABS = ['dashboard', 'analytics', 'inventory', 'inv-print', 'production', 'allocation', 'demands', 'returns', 'audit'];
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
const CATEGORIES = ['CAPS', 'SHIRTS', 'JACKETS', 'PANTS', 'ACCESSORIES', 'GENERAL'];

const WarehouseDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [personName, setPersonName] = useState('');
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocCartItems, setAllocCartItems] = useState([]);
  const [allocProdSearch, setAllocProdSearch] = useState('');
  const [allocSelectedProduct, setAllocSelectedProduct] = useState(null);
  const [allocSelectedSize, setAllocSelectedSize] = useState('');
  const [allocSelectedColor, setAllocSelectedColor] = useState('');
  const [allocQty, setAllocQty] = useState(1);
  const [allocNotes, setAllocNotes] = useState('');
  const [allocationRecords, setAllocationRecords] = useState([]);
  const [allocationStats, setAllocationStats] = useState([]);
  const [allocTotal, setAllocTotal] = useState(0);
  const [allocPage, setAllocPage] = useState(1);
  const [allocSearch, setAllocSearch] = useState('');
  const [allocLoading, setAllocLoading] = useState(false);
  const [carts, setCarts] = useState([]);
  const [cartsTotal, setCartsTotal] = useState(0);
  const [cartsPage, setCartsPage] = useState(1);
  const [cartsSearch, setCartsSearch] = useState('');
  const [cartsStatusFilter, setCartsStatusFilter] = useState('');
  const [cartsLoading, setCartsLoading] = useState(false);
  const [expandedCart, setExpandedCart] = useState(null);
  const [prodCategoryFilter, setProdCategoryFilter] = useState('');

  // Inventory Print state
  const [invPrintCategory, setInvPrintCategory] = useState(null);
  const [invPrintProduct, setInvPrintProduct] = useState(null);
  const [printQty, setPrintQty] = useState({});
  const [printNotes, setPrintNotes] = useState('');

  const handlePrintQtyChange = (key, value) => {
    setPrintQty(prev => ({ ...prev, [key]: value }));
  };

  const handlePrintStockRequest = () => {
    if (!invPrintCategory || !invPrintProduct) return;
    const items = inventory.filter(i => i.category === invPrintCategory && i.name === invPrintProduct);
    if (!items.length) { toast.error('No items to print'); return; }
    const productLabel = invPrintProduct;

    const now = new Date();
    const dateStr = formatDateOnly(now);
    const timeStr = formatTimeOnly(now);

    const qtyEntered = Object.values(printQty).some(v => v !== '' && Number(v) > 0);
    const catIcons = { CAPS: '🧢', SCRUBS: '🥼', COAT: '🧥', MASK: '😷', SOCKS: '🧦', SHOES: '👟', CLOGS: '🩴', LABCOAT: '🥼', FABRIC: '🧵', ACCESSORIES: '🎒', GENERAL: '📦' };

    let tableRows = '';
    let rowIdx = 0;
    items.forEach(item => {
      const vs = item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? item.variants : null;
      if (vs && vs.length > 0) {
        vs.forEach(v => {
          const key = `${item.id}-${v.color || ''}-${v.size || ''}`;
          const qty = printQty[key] ?? '';
          rowIdx++;
          tableRows += `<tr>
            <td style="padding: 8px 10px; font-size: 14px; font-weight: 700; color: #000;">${rowIdx}</td>
            <td style="padding: 8px 10px; font-size: 16px; font-weight: 900; color: #000;">${item.name}</td>
            <td style="padding: 8px 10px; font-size: 18px; font-weight: 900; color: #000;">${v.color || '-'}</td>
            <td style="padding: 8px 10px; font-size: 18px; font-weight: 900; color: #000;">${v.size || '-'}</td>
            <td style="padding: 8px 10px; font-size: 20px; font-weight: 900; text-align: right; color: ${(v.stock ?? item.stock) <= 0 ? '#dc2626' : (v.stock ?? item.stock) <= 5 ? '#d97706' : '#059669'};">${v.stock ?? item.stock}</td>
            <td style="padding: 8px 10px; font-size: 20px; font-weight: 900; text-align: right; color: #b45309;">${qty !== '' && Number(qty) > 0 ? qty : '<span style="color:#999;font-weight:700;">—</span>'}</td>
          </tr>`;
        });
      } else {
        const key = `${item.id}-${item.color || ''}-${item.size || ''}`;
        const qty = printQty[key] ?? '';
        rowIdx++;
        tableRows += `<tr>
          <td style="padding: 8px 10px; font-size: 14px; font-weight: 700; color: #000;">${rowIdx}</td>
          <td style="padding: 8px 10px; font-size: 16px; font-weight: 900; color: #000;">${item.name}</td>
          <td style="padding: 8px 10px; font-size: 18px; font-weight: 900; color: #000;">${item.color || '-'}</td>
          <td style="padding: 8px 10px; font-size: 18px; font-weight: 900; color: #000;">${item.size || '-'}</td>
          <td style="padding: 8px 10px; font-size: 20px; font-weight: 900; text-align: right; color: ${item.stock <= 0 ? '#dc2626' : item.stock <= 5 ? '#d97706' : '#059669'};">${item.stock}</td>
          <td style="padding: 8px 10px; font-size: 20px; font-weight: 900; text-align: right; color: #b45309;">${qty !== '' && Number(qty) > 0 ? qty : '<span style="color:#999;font-weight:700;">—</span>'}</td>
        </tr>`;
      }
    });

    const printContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Stock Request - ${invPrintCategory} - ${productLabel}</title>
<style>
  @page { margin: 15mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #000; padding: 20px; font-size: 16px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #000; }
  .header-left h1 { font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 1px; }
  .header-left h1 span { font-size: 32px; margin-right: 6px; }
  .header-left p { font-size: 14px; color: #555; margin-top: 2px; font-weight: 700; }
  .header-right { text-align: right; }
  .header-right .date { font-size: 15px; color: #333; font-weight: 700; }
  .header-right .badge { display: inline-block; margin-top: 4px; padding: 4px 14px; background: #000; border-radius: 20px; font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { padding: 12px 10px; font-size: 14px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 1.5px; text-align: left; border-bottom: 3px solid #000; background: #f0f0f0; }
  thead th:last-child, thead th:nth-last-child(2) { text-align: right; }
  tbody tr { border-bottom: 2px solid #ccc; }
  tbody tr:last-child { border-bottom: none; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 3px solid #000; }
  .footer .notes-label { font-size: 14px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
  .footer .notes-content { font-size: 16px; color: #222; font-weight: 700; line-height: 1.5; padding: 12px 16px; background: #f9f9f9; border-radius: 8px; border: 2px solid #ccc; min-height: 40px; }
  .footer .print-meta { margin-top: 12px; font-size: 13px; color: #666; text-align: center; font-weight: 700; }
  .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; color: #333; border-top: 3px solid #000; margin-top: 8px; font-weight: 700; }
  .summary-row strong { color: #000; font-weight: 900; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style></head><body>
  ${getPrintLogoHTML()}
  <div class="header">
    <div class="header-left">
      <h1><span>${catIcons[invPrintCategory] || '📦'}</span>${invPrintCategory}</h1>
      <p style="font-size: 18px; font-weight: 900; color: #000; margin-top: 4px;">${productLabel}</p>
      <p style="font-size: 14px; color: #555; margin-top: 2px; font-weight: 700;">Stock Request Sheet</p>
    </div>
    <div class="header-right">
      <div class="date">${dateStr} · ${timeStr}</div>
      <div class="badge">Warehouse Inventory</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="width:32px;">#</th>
      <th>Product</th>
      <th style="width:120px; text-align:center;">Color</th>
      <th style="width:120px; text-align:center;">Size</th>
      <th style="width:100px; text-align:right;">Stock</th>
      <th style="width:120px; text-align:right;">Required Qty</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="summary-row">
    <span>Total Items: <strong>${rowIdx}</strong></span>
    <span>Total Current Stock: <strong>${items.reduce((s, i) => {
      const vs = i.variants && Array.isArray(i.variants) && i.variants.length > 0 ? i.variants : null;
      return vs ? s + vs.reduce((a, v) => a + (v.stock ?? i.stock), 0) : s + i.stock;
    }, 0)}</strong></span>
    <span>Items with Qty: <strong>${Object.values(printQty).filter(v => v !== '' && Number(v) > 0).length}</strong></span>
  </div>
  <div class="footer">
    <div class="notes-label">Notes</div>
    <div class="notes-content">${printNotes.trim() ? printNotes : '<span style="color:#999;font-weight:700;">No additional notes</span>'}</div>
    ${getPrintFooterHTML()}
  </div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printContent);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 500);
    }, 500);
  };

  const [demandRequests, setDemandRequests] = useState([]);
  const [demandStats, setDemandStats] = useState({ pending: 0, approved: 0, partiallyApproved: 0, rejected: 0, total: 0 });
  const [demandLoading, setDemandLoading] = useState(false);
  const [demandSearch, setDemandSearch] = useState('');
  const [demandFilter, setDemandFilter] = useState('');
  const [demandApproveModal, setDemandApproveModal] = useState(null);
  const [demandApproveItems, setDemandApproveItems] = useState([]);

  useEffect(() => {
    if (activeTab === 'allocation') {
      fetchAllocations();
      fetchAllocationStats();
    }
    if (activeTab === 'demands') {
      fetchDemands();
    }
  }, [activeTab, allocPage, cartsPage, demandFilter]);

  // Cache-first: inventory tab
  const { data: inventory = [], loading, refresh: refreshInventory } = useCache(
    activeTab === 'dashboard' || activeTab === 'inventory' || activeTab === 'allocation' ? 'warehouse:inventory' : null,
    { fetcher: () => api.get('/api/inventory').then(r => r.data), ttl: 60 * 1000 }
  );
  // Cache-first: production tab
  const { data: productionInventory = [], refresh: refreshProduction } = useCache(
    activeTab === 'production' ? 'warehouse:production-inventory' : null,
    { fetcher: () => api.get('/api/production/inventory').then(r => r.data), ttl: 60 * 1000 }
  );

  const fetchAllocations = async () => {
    setAllocLoading(true);
    try {

      const params = { page: allocPage, limit: 50 };
      if (allocSearch.trim()) params.personName = allocSearch.trim();
      const res = await api.get('/api/inventory/allocations', { params });
      setAllocationRecords(res.data.records);
      setAllocTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
    setAllocLoading(false);
  };

  const [allocSummary, setAllocSummary] = useState({ todayTotal: 0, activeTotal: 0, totalAllocated: 0, recent: [] });

  const fetchAllocationStats = async () => {
    try {

      const res = await api.get('/api/inventory/allocations/stats');
      const data = res.data;
      // New format: { perPerson: [...], todayTotal, activeTotal, totalAllocated, recent }
      if (data.perPerson) {
        setAllocationStats(data.perPerson);
        setAllocSummary({ todayTotal: data.todayTotal || 0, activeTotal: data.activeTotal || 0, totalAllocated: data.totalAllocated || 0, recent: data.recent || [] });
      } else {
        // Legacy format: array of person stats
        setAllocationStats(data);
        setAllocSummary({ todayTotal: 0, activeTotal: 0, totalAllocated: 0, recent: [] });
      }
    } catch (error) {
      console.error('Error fetching allocation stats:', error);
    }
  };

  const updateAllocationStatus = async (id, status) => {
    try {

      await api.patch(`/api/inventory/allocations/${id}/status`, { status });
      toast.success(`Allocation marked as ${status}`);
      fetchAllocations();
      fetchAllocationStats();
    } catch (error) {
      console.error('Allocation status update error:', error.response?.status, error.response?.data);
      toast.error(error.response?.data?.message || `Error ${error.response?.status || 'no response'}. Check console.`);
    }
  };

  const fetchCarts = async (overrides = {}) => {
    setCartsLoading(true);
    try {
      const { from, to, status, search, page } = overrides;
      const params = { page: page !== undefined ? page : cartsPage, limit: 50 };
      const finalSearch = search !== undefined ? search : cartsSearch;
      const finalStatus = status !== undefined ? status : cartsStatusFilter;
      const finalFrom = from !== undefined ? from : cartsDateFrom;
      const finalTo = to !== undefined ? to : cartsDateTo;
      if (finalSearch.trim()) params.personName = finalSearch.trim();
      if (finalStatus) params.status = finalStatus;
      if (finalFrom) params.from = finalFrom;
      if (finalTo) params.to = finalTo;
      const res = await api.get('/api/inventory/carts', { params });
      setCarts(res.data.records);
      setCartsTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching carts:', error);
    }
    setCartsLoading(false);
  };

  const handleCartStatus = async (id, status) => {
    try {

      await api.patch(`/api/inventory/carts/${id}/status`, { status });
      toast.success(`Cart ${status.toLowerCase()} successfully`);
      fetchCarts();
      fetchAllocationStats();
      refreshActiveTab();
    } catch (error) {
      console.error('Cart status update error:', error.response?.status, error.response?.data);
      toast.error(error.response?.data?.message || `Error ${error.response?.status || 'no response'}. Check console.`);
    }
  };

  const fetchDemands = async () => {
    setDemandLoading(true);
    try {

      const params = {};
      if (demandFilter) params.status = demandFilter;
      if (demandSearch.trim()) params.outletName = demandSearch.trim();
      const [allRes, statsRes] = await Promise.allSettled([
        api.get('/api/demand/all', { params }),
        api.get('/api/demand/stats')
      ]);
      if (allRes.status === 'fulfilled') setDemandRequests(allRes.value.data);
      if (statsRes.status === 'fulfilled') setDemandStats(statsRes.value.data);
    } catch (error) {
      console.error('Error fetching demands:', error);
    }
    setDemandLoading(false);
  };

  const handleDemandApprove = async (id, status, items) => {
    try {

      await api.put(`/api/demand/${id}/approve`,
        { status, items, storeNotes: '' }
      );
      toast.success(`Demand request ${status.toLowerCase()}`);
      setDemandApproveModal(null);
      fetchDemands();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update demand');
    }
  };



  const handleAllocate = async () => {
    if (!personName.trim()) { toast.error('Please enter person name'); return; }
    if (!allocCartItems.length) { toast.error('Add at least one product to cart'); return; }
    for (const item of allocCartItems) {
      const p = inventory.find(i => i.id === item.productId);
      const vs = p?.variants || [];
      const uniqSizes = [...new Set(vs.map(v => v.size).filter(Boolean))];
      const uniqColors = [...new Set(vs.map(v => v.color).filter(Boolean))];
    }
    setAllocationLoading(true);
    try {

      const res = await api.post('/api/inventory/allocate-cart', {
        personName: personName.trim(),
        items: allocCartItems.map(i => ({
          itemId: i.productId,
          color: i.color,
          size: i.size,
          quantity: i.qty
        })),
        notes: allocNotes,
      });
      toast.success(res.data.message || 'Cart created successfully');
      setPersonName('');
      setAllocCartItems([]);
      setAllocNotes('');
      setAllocProdSearch('');
      setAllocSelectedProduct(null);
      refreshActiveTab();
      fetchAllocations();
      fetchAllocationStats();
      fetchCarts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error creating cart allocation');
    }
    setAllocationLoading(false);
  };

  // Check tab visibility to avoid polling when user isn't looking
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const handler = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  const refreshActiveTab = () => {
    if (activeTab === 'dashboard' || activeTab === 'allocation') {
      refreshInventory();
      if (activeTab === 'dashboard') {
        fetchDashboardCarts();
        fetchAllocationStats();
        fetchCarts();
      }
    }
    else if (activeTab === 'production') refreshProduction();
  };
  usePolling(() => { if (pageVisible) refreshActiveTab(); }, 60000);

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

  const getOutletColor = (outlet) => {
    const name = (outlet || '').toLowerCase();
    if (name.includes('johar')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    if (name.includes('jail')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    if (name.includes('abbottabad')) return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
    return { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
  };

  const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
  const lowStockItems = inventory.filter(item => item.stock > 0 && item.stock <= 5);
  const outOfStockItems = inventory.filter(item => item.stock === 0);

  const filteredInventory = inventory.filter(item =>
    !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dashboard allocation state
  const [dashPendingCarts, setDashPendingCarts] = useState([]);
  const [dashCartsLoading, setDashCartsLoading] = useState(false);
  // Allocation Summary filter
  const [sumSearch, setSumSearch] = useState('');
  // Allocation Carts date filter
  const [cartsDateFrom, setCartsDateFrom] = useState('');
  const [cartsDateTo, setCartsDateTo] = useState('');

  const fetchDashboardCarts = async () => {
    setDashCartsLoading(true);
    try {
      const res = await api.get('/api/inventory/carts', { params: { status: 'PENDING', page: 1, limit: 10 } });
      setDashPendingCarts(res.data.records || []);
    } catch (error) {
      console.error('Error fetching dashboard carts:', error);
    }
    setDashCartsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardCarts();
      fetchAllocationStats();
      fetchCarts();
    }
  }, [activeTab]);

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-amber-600 rounded-2xl shadow-xl shadow-amber-900/20 -rotate-2">
            <Building2 className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Warehouse</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store & Inventory Management</p>
          </div>
        </div>
        <button onClick={refreshActiveTab} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95 border border-gray-700">
          <RefreshCcw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${
              activeTab === tab ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'
            }`}
          >
                {tab === 'dashboard' && <><BarChart3 size={14} className="inline mr-2" />Dashboard</>}
                {tab === 'analytics' && <><Activity size={14} className="inline mr-2" />Analytics</>}
                {tab === 'inventory' && <><Package size={14} className="inline mr-2" />Inventory</>}
                {tab === 'inv-print' && <><Printer size={14} className="inline mr-2" />Print Stock</>}
                {tab === 'production' && <><Factory size={14} className="inline mr-2" />Production Inventory</>}
                {tab === 'allocation' && <><Gift size={14} className="inline mr-2" />Allocation</>}
                {tab === 'demands' && <><ShoppingCart size={14} className="inline mr-2" />Demands {demandStats.pending > 0 && <span className="ml-1 bg-red-500 text-white text-xs md:text-sm px-1.5 py-0.5 rounded-full">{demandStats.pending}</span>}</>}
                {tab === 'returns' && <><RotateCcw size={14} className="inline mr-2" />Returns</>}
                {tab === 'audit' && <><ClipboardCheck size={14} className="inline mr-2" />Audit</>}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader text="Loading Warehouse Data..." />
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 md:space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl"><Package className="text-blue-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Total</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{totalStock}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Units in Stock</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><AlertTriangle className="text-red-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Low</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{lowStockItems.length}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Low Stock Items</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-gray-700/50 rounded-xl"><XCircle className="text-gray-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Out</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{outOfStockItems.length}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Out of Stock</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-amber-500/10 rounded-xl"><Gift className="text-amber-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Today</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black text-amber-400">{allocSummary.todayTotal}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Today's Allocations</p>
                </motion.div>
              </div>

              {/* Low Stock Alert */}
              {lowStockItems.length > 0 && (
                <div className="glass p-4 md:p-6 rounded-2xl border-2 border-red-500/20">
                  <div className="flex items-center space-x-3 mb-6">
                    <AlertTriangle className="text-red-400" size={20} />
                    <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm">Low Stock Alert</h2>
                  </div>
                  <div className="space-y-3">
                    {lowStockItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                        <div>
                          <p className="font-bold theme-text-primary text-sm">{item.name}</p>
                          <p className="text-xs md:text-sm theme-text-muted font-bold uppercase">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-red-400">{item.stock}</p>
                          <p className="text-xs md:text-sm theme-text-muted font-bold uppercase">Remaining</p>
                        </div>
                      </div>
                    ))}
                    {lowStockItems.length > 5 && (
                      <p className="text-xs theme-text-muted font-bold text-center">+{lowStockItems.length - 5} more items low on stock</p>
                    )}
                  </div>
                </div>
              )}

              {/* Allocation Summary */}
              <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Gift className="text-amber-400" size={20} />
                    <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm">Allocation Summary</h2>
                  </div>
                  <span className="text-xs font-bold theme-text-muted">{allocSummary.totalAllocated} total allocated</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                    <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Active Allocations</p>
                    <p className="text-xl font-black text-amber-400 mt-1">{allocSummary.activeTotal}</p>
                  </div>
                  <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                    <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Total Items</p>
                    <p className="text-xl font-black text-emerald-400 mt-1">{allocSummary.totalAllocated}</p>
                  </div>
                  <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                    <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Pending Carts</p>
                    <p className="text-xl font-black text-yellow-400 mt-1">{dashPendingCarts.length}</p>
                  </div>
                  <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                    <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Today</p>
                    <p className="text-xl font-black text-blue-400 mt-1">{allocSummary.todayTotal}</p>
                  </div>
                </div>
                <div className="border-t theme-border pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    <h3 className="font-bold theme-text-primary text-xs uppercase tracking-wider flex items-center space-x-2">
                      <User size={14} className="text-amber-400" />
                      <span>By Person</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <input type="text" placeholder="Search by person..." value={sumSearch}
                        onChange={(e) => setSumSearch(e.target.value)}
                        className="theme-input rounded-lg py-1.5 px-3 text-xs font-medium outline-none focus:border-amber-500 w-36" />
                    </div>
                  </div>
                  {(() => {
                    const filtered = sumSearch
                      ? allocationStats.filter(s => s.personName?.toLowerCase().includes(sumSearch.toLowerCase()))
                      : allocationStats;
                    return filtered.length > 0 ? (
                      <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                              <th className="pb-2 pr-4">Person</th>
                              <th className="pb-2 pr-4">Times</th>
                              <th className="pb-2 pr-4">Items</th>
                              <th className="pb-2">Last</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(stat => (
                              <tr key={stat.personName} className="border-b border-gray-800/30 text-xs">
                                <td className="py-2 pr-4 font-bold theme-text-primary whitespace-nowrap">{stat.personName}</td>
                                <td className="py-2 pr-4"><span className="font-black text-amber-400">{stat.timesTaken}x</span></td>
                                <td className="py-2 pr-4"><span className="font-black text-emerald-400">{stat.totalItems}</span></td>
                                <td className="py-2 text-[10px] theme-text-secondary">{formatDateOnly(stat.lastTaken)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs theme-text-muted text-center py-4">No matching persons found</p>
                    );
                  })()}
                </div>
              </div>

              {/* Allocation Carts */}
              <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-3">
                    <ShoppingCart size={18} className="text-amber-400" />
                    <span>Allocation Carts</span>
                    {dashPendingCarts.length > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
                        {dashPendingCarts.length} pending
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-col md:flex-row items-end md:items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <select value={cartsStatusFilter} onChange={(e) => { const v = e.target.value; setCartsStatusFilter(v); setCartsPage(1); fetchCarts({ status: v, page: 1 }); }}
                        className="theme-bg-subtle border-2 theme-border rounded-xl py-2 px-3 text-xs font-medium text-white outline-none">
                        <option value="">All Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                      <input type="text" placeholder="Search..." value={cartsSearch}
                        onChange={(e) => setCartsSearch(e.target.value)}
                        className="theme-input rounded-xl py-2 px-4 focus:border-amber-500 outline-none text-xs font-medium theme-text-secondary w-36"
                      />
                      <button onClick={() => { setCartsPage(1); fetchCarts({ search: cartsSearch, page: 1 }); }}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-3 rounded-xl transition-all text-xs active:scale-95 border border-gray-700">
                        <Search size={14} />
                      </button>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button onClick={() => { const d = new Date(); const f = d.toISOString().split('T')[0]; setCartsDateFrom(f); setCartsDateTo(f); setCartsPage(1); fetchCarts({ from: f, to: f, page: 1 }); }}
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${(!cartsDateFrom && !cartsDateTo) || (new Date(cartsDateFrom).toDateString() === new Date().toDateString() && new Date(cartsDateTo).toDateString() === new Date().toDateString()) ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Daily</button>
                      <button onClick={() => { const d = new Date(); const w = new Date(d); w.setDate(w.getDate() - 7); const f = w.toISOString().split('T')[0]; const t = d.toISOString().split('T')[0]; setCartsDateFrom(f); setCartsDateTo(t); setCartsPage(1); fetchCarts({ from: f, to: t, page: 1 }); }}
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${cartsDateFrom && cartsDateTo && new Date(cartsDateFrom) <= new Date(new Date().setDate(new Date().getDate() - 7)) && new Date(cartsDateTo).toDateString() === new Date().toDateString() ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Weekly</button>
                      <button onClick={() => { const d = new Date(); const m = new Date(d); m.setMonth(m.getMonth() - 1); const f = m.toISOString().split('T')[0]; const t = d.toISOString().split('T')[0]; setCartsDateFrom(f); setCartsDateTo(t); setCartsPage(1); fetchCarts({ from: f, to: t, page: 1 }); }}
                        className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider bg-gray-800 text-gray-400 hover:bg-gray-700 transition-all">Monthly</button>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <input type="date" value={cartsDateFrom}
                        onChange={(e) => setCartsDateFrom(e.target.value)}
                        className="theme-input rounded-lg py-1.5 px-2 text-[10px] font-medium outline-none focus:border-amber-500 w-28" />
                      <span className="text-[10px] theme-text-muted">-</span>
                      <input type="date" value={cartsDateTo}
                        onChange={(e) => setCartsDateTo(e.target.value)}
                        className="theme-input rounded-lg py-1.5 px-2 text-[10px] font-medium outline-none focus:border-amber-500 w-28" />
                      <button onClick={() => { setCartsPage(1); fetchCarts({ from: cartsDateFrom, to: cartsDateTo, page: 1 }); }}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-black py-1.5 px-3 rounded-lg text-xs transition-all active:scale-95">Filter</button>
                      <button onClick={() => { setCartsDateFrom(''); setCartsDateTo(''); setCartsSearch(''); setCartsStatusFilter(''); setCartsPage(1); fetchCarts({ from: '', to: '', status: '', search: '', page: 1 }); }}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-400 font-black py-1.5 px-3 rounded-lg text-xs transition-all active:scale-95 border border-gray-700">Reset</button>
                    </div>
                  </div>
                </div>
                {cartsLoading ? (
                  <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
                ) : carts.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No allocation carts yet</p>
                    <p className="text-[10px] theme-text-muted mt-2">Create a cart by selecting products and clicking Allocate</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {carts.map(cart => {
                        const cartStatusColors = {
                          PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                          APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                          REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30'
                        };
                        const cartStatusLabels = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' };
                        const sc = cartStatusColors[cart.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
                        const isExpanded = expandedCart === cart.id;
                        return (
                          <div key={cart.id}
                            className="glass rounded-xl border-2 border-gray-900 hover:border-gray-700 transition-all overflow-hidden">
                            <div className="p-4 cursor-pointer" onClick={() => setExpandedCart(isExpanded ? null : cart.id)}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-1">
                                    <span className="font-black theme-text-primary text-sm">{cart.displayId || cart.id.slice(0, 8)}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${sc}`}>
                                      {cartStatusLabels[cart.status] || cart.status}
                                    </span>
                                  </div>
                                  <p className="font-bold theme-text-primary text-xs break-words" title={cart.personName}>{cart.personName}</p>
                                </div>
                                <div className="flex items-center space-x-4 text-xs theme-text-muted shrink-0">
                                  <span className="font-bold">{cart.totalItems} products</span>
                                  <span className="font-bold text-amber-400">{cart.totalQuantity} qty</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center space-x-3 text-[10px] theme-text-muted">
                                  <span>{formatDateTime(cart.createdAt)}</span>
                                  {cart.allocatedByName && <span>by {cart.allocatedByName}</span>}
                                  {cart.approvedAt && <span>Approved: {formatDateTime(cart.approvedAt)}</span>}
                                </div>
                                {cart.status === 'PENDING' && (
                                  <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleCartStatus(cart.id, 'APPROVED')}
                                      className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center space-x-1">
                                      <CheckCircle size={12} />
                                      <span>Approve All</span>
                                    </button>
                                    <button onClick={() => handleCartStatus(cart.id, 'REJECTED')}
                                      className="px-4 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center space-x-1">
                                      <XCircle size={12} />
                                      <span>Reject All</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-gray-800/50 px-4 py-3 space-y-2">
                                <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mb-2">Cart Items</p>
                                {cart.items.map((item, idx) => (
                                  <div key={item.id} className="flex items-center justify-between py-1.5 px-3 theme-bg-subtle rounded-lg">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold theme-text-primary">{item.itemName}</p>
                                      <div className="flex items-center space-x-3 text-[10px] theme-text-muted">
                                        {item.color && <span>Color: {item.color}</span>}
                                        {item.size && <span>Size: {item.size}</span>}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3 shrink-0">
                                      <span className="text-xs font-black text-amber-400">x{item.quantity}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                        item.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                        item.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                      }`}>
                                        {item.status === 'ACCEPTED' ? 'Accepted' : item.status === 'REJECTED' ? 'Rejected' : 'Active'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {cart.notes && (
                                  <p className="text-[10px] theme-text-muted italic mt-2 px-3">Notes: {cart.notes}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-xs theme-text-muted font-bold">{cartsTotal} total carts</p>
                      <div className="flex space-x-2">
                        <button disabled={cartsPage <= 1} onClick={() => { const n = cartsPage - 1; setCartsPage(n); fetchCarts({ page: n }); }}
                          className="px-4 py-2 bg-gray-800 rounded-xl text-xs font-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Previous
                        </button>
                        <button disabled={carts.length < 50} onClick={() => { const n = cartsPage + 1; setCartsPage(n); fetchCarts({ page: n }); }}
                          className="px-4 py-2 bg-gray-800 rounded-xl text-xs font-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <StoreDashboardAnalytics />
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <InventoryManagement />
          )}




          {/* Inventory Print Tab - Category Wise */}
          {activeTab === 'inv-print' && (() => {
            const allCats = [...new Set(inventory.map(i => i.category).filter(Boolean))].sort();
            const catIcons = { CAPS: '🧢', SCRUBS: '🥼', COAT: '🧥', MASK: '😷', SOCKS: '🧦', SHOES: '👟', CLOGS: '🩴', LABCOAT: '🥼', FABRIC: '🧵', ACCESSORIES: '🎒', GENERAL: '📦' };
            const catColors = { CAPS: 'bg-blue-500/10 border-blue-500/20', SCRUBS: 'bg-emerald-500/10 border-emerald-500/20', COAT: 'bg-purple-500/10 border-purple-500/20', MASK: 'bg-rose-500/10 border-rose-500/20', SOCKS: 'bg-orange-500/10 border-orange-500/20', SHOES: 'bg-amber-500/10 border-amber-500/20', CLOGS: 'bg-teal-500/10 border-teal-500/20', LABCOAT: 'bg-cyan-500/10 border-cyan-500/20', FABRIC: 'bg-pink-500/10 border-pink-500/20', ACCESSORIES: 'bg-violet-500/10 border-violet-500/20' };
            const prodMap = {};
            allCats.forEach(cat => { prodMap[cat] = inventory.filter(i => i.category === cat); });

            return (
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider flex items-center gap-2">
                    <Printer size={20} className="text-amber-400" />
                    Stock Request Sheets
                  </h2>
                  <span className="text-xs font-bold theme-text-muted">{allCats.length} categories</span>
                </div>

                {!invPrintCategory ? (
                  /* Category Grid */
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {allCats.map(cat => {
                      const items = prodMap[cat] || [];
                      const totalStock = items.reduce((s, i) => s + i.stock, 0);
                      const variantCount = items.reduce((s, i) => {
                        const vs = i.variants && Array.isArray(i.variants) ? i.variants : [];
                        return s + (vs.length > 0 ? vs.length : (i.size || i.color ? 1 : 0));
                      }, 0);
                      return (
                        <motion.button key={cat} onClick={() => setInvPrintCategory(cat)}
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className={`glass p-4 md:p-5 rounded-2xl border-2 text-left transition-all ${catColors[cat] || 'theme-border hover:border-amber-500/30'}`}>
                          <div className="text-2xl mb-2">{catIcons[cat] || '📦'}</div>
                          <h3 className="font-black theme-text-primary text-sm uppercase tracking-wider">{cat}</h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-bold text-amber-400">{items.length} products</span>
                            <span className="text-[10px] theme-text-muted">·</span>
                            <span className="text-xs font-bold text-emerald-400">{totalStock} stock</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                ) : !invPrintProduct ? (
                  /* Product List for Selected Category */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setInvPrintCategory(null); setPrintQty({}); setPrintNotes(''); }}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 transition-all active:scale-95">
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="font-black theme-text-primary text-base uppercase tracking-wider flex items-center gap-2">
                        <span>{catIcons[invPrintCategory] || '📦'}</span>
                        {invPrintCategory}
                      </h3>
                      <span className="text-xs font-bold theme-text-muted">({prodMap[invPrintCategory]?.length || 0} items)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                      {(() => {
                        const seen = new Set();
                        const uniqueItems = (prodMap[invPrintCategory] || []).filter(item => {
                          const key = item.name.toLowerCase();
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                        return uniqueItems.map(item => {
                          const catItems = prodMap[invPrintCategory] || [];
                          const totalStock = catItems.filter(i => i.name === item.name).reduce((s, i) => {
                            const vs = i.variants && Array.isArray(i.variants) && i.variants.length > 0 ? i.variants : null;
                            return vs ? s + vs.reduce((a, v) => a + (v.stock ?? i.stock), 0) : s + i.stock;
                          }, 0);
                          const variantCount = catItems.filter(i => i.name === item.name).reduce((s, i) => {
                            const vs = i.variants && Array.isArray(i.variants) ? i.variants : [];
                            return s + (vs.length > 0 ? vs.length : (i.size || i.color ? 1 : 0));
                          }, 0);
                          return (
                            <motion.button key={item.name} onClick={() => { setInvPrintProduct(item.name); setPrintQty({}); setPrintNotes(''); }}
                              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              className="glass p-4 md:p-5 rounded-2xl border-2 theme-border hover:border-amber-500/30 text-left transition-all">
                              <div className="p-3 bg-amber-500/10 rounded-xl w-fit mb-3"><Package size={20} className="text-amber-400" /></div>
                              <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs font-bold text-amber-400">{variantCount} variants</span>
                                <span className="text-[10px] theme-text-muted">·</span>
                                <span className="text-xs font-bold text-emerald-400">{totalStock} stock</span>
                              </div>
                            </motion.button>
                          );
                        });
                      })()}
                    </div>
                    {(!prodMap[invPrintCategory] || prodMap[invPrintCategory].length === 0) && (
                      <div className="text-center py-16">
                        <Package size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No products in this category</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Variant Table for Selected Product */
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setInvPrintProduct(null); setPrintQty({}); setPrintNotes(''); }}
                          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 transition-all active:scale-95">
                          <ArrowLeft size={18} />
                        </button>
                        <h3 className="font-black theme-text-primary text-base uppercase tracking-wider flex items-center gap-2">
                          <span>{catIcons[invPrintCategory] || '📦'}</span>
                          {invPrintCategory}
                        </h3>
                        <span className="text-[10px] theme-text-muted">/</span>
                        <span className="font-bold text-amber-400 text-sm">{invPrintProduct}</span>
                      </div>
                      <button onClick={handlePrintStockRequest}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-amber-900/20">
                        <Printer size={16} />
                        Print Stock Request
                      </button>
                    </div>

                    {/* Variants Table */}
                    <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[10px] font-black theme-text-muted uppercase tracking-widest border-b theme-border bg-gray-900/50">
                              <th className="p-3 pr-2">#</th>
                              <th className="p-3 pr-2">Product</th>
                              <th className="p-3 pr-2">Color</th>
                              <th className="p-3 pr-2">Size</th>
                              <th className="p-3 pr-2 text-right">Stock</th>
                              <th className="p-3 text-right w-28">Required Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const catItems = inventory.filter(i => i.category === invPrintCategory && i.name === invPrintProduct);
                              if (!catItems.length) return <tr><td colSpan="6" className="p-8 text-center"><p className="text-xs theme-text-muted font-bold">No items found</p></td></tr>;
                              const rows = [];
                              let rowIdx = 0;
                              catItems.forEach(item => {
                                const vs = item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? item.variants : null;
                                if (vs && vs.length > 0) {
                                  vs.forEach(v => {
                                    const key = `${item.id}-${v.color || ''}-${v.size || ''}`;
                                    const colorVal = v.color || '-';
                                    const sizeVal = v.size || '-';
                                    const stockVal = v.stock ?? item.stock;
                                    rowIdx++;
                                    rows.push(
                                      <tr key={key} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                                        <td className="p-3 pr-2 text-[10px] theme-text-muted font-mono">{rowIdx}</td>
                                        <td className="p-3 pr-2 font-bold theme-text-primary text-xs">{item.name}</td>
                                        <td className="p-3 pr-2 text-xs theme-text-secondary">{colorVal}</td>
                                        <td className="p-3 pr-2 text-xs theme-text-secondary">{sizeVal}</td>
                                        <td className="p-3 pr-2 text-right"><span className={`text-xs font-black ${stockVal <= 0 ? 'text-red-400' : stockVal <= 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>{stockVal}</span></td>
                                        <td className="p-3 text-right">
                                          <input type="number" min="0" value={printQty[key] ?? ''}
                                            onChange={(e) => handlePrintQtyChange(key, e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-20 theme-bg-subtle border-2 theme-border rounded-lg py-1.5 px-2 text-xs font-black text-white text-right outline-none focus:border-amber-500" placeholder="0" />
                                        </td>
                                      </tr>
                                    );
                                  });
                                } else {
                                  const key = `${item.id}-${item.color || ''}-${item.size || ''}`;
                                  rowIdx++;
                                  rows.push(
                                    <tr key={key} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                                      <td className="p-3 pr-2 text-[10px] theme-text-muted font-mono">{rowIdx}</td>
                                      <td className="p-3 pr-2 font-bold theme-text-primary text-xs">{item.name}</td>
                                      <td className="p-3 pr-2 text-xs theme-text-secondary">{item.color || '-'}</td>
                                      <td className="p-3 pr-2 text-xs theme-text-secondary">{item.size || '-'}</td>
                                      <td className="p-3 pr-2 text-right"><span className={`text-xs font-black ${item.stock <= 0 ? 'text-red-400' : item.stock <= 5 ? 'text-yellow-400' : 'text-emerald-400'}`}>{item.stock}</span></td>
                                      <td className="p-3 text-right">
                                        <input type="number" min="0" value={printQty[key] ?? ''}
                                          onChange={(e) => handlePrintQtyChange(key, e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                                          className="w-20 theme-bg-subtle border-2 theme-border rounded-lg py-1.5 px-2 text-xs font-black text-white text-right outline-none focus:border-amber-500" placeholder="0" />
                                      </td>
                                    </tr>
                                  );
                                }
                              });
                              return rows;
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="glass p-4 md:p-5 rounded-2xl border-2 theme-border">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-wider flex items-center gap-2 mb-2">
                        <FileText size={14} />
                        Notes / Additional Instructions
                      </label>
                      <textarea value={printNotes} onChange={(e) => setPrintNotes(e.target.value)}
                        placeholder="Enter any notes or instructions for this stock request..."
                        className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium theme-text-secondary resize-none text-xs"
                        rows={3} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Production Inventory Tab - Category Wise */}
          {activeTab === 'production' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider flex items-center gap-2">
                  <Factory size={20} className="text-amber-400" />
                  Production Inventory
                </h2>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Search items..."
                    className="theme-input rounded-xl py-2 px-4 text-xs font-medium outline-none focus:border-amber-500 w-40"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <select value={prodCategoryFilter || ''} onChange={(e) => setProdCategoryFilter(e.target.value)}
                    className="theme-input rounded-xl py-2 px-3 text-xs font-bold outline-none focus:border-amber-500">
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-xs font-bold theme-text-muted">{productionInventory.length} total</span>
                </div>
              </div>
              {productionInventory.length === 0 ? (
                <div className="text-center py-16">
                  <Factory size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No production inventory items yet</p>
                </div>
              ) : (() => {
                const filtered = productionInventory.filter(item => {
                  const matchSearch = !searchTerm || item.productName?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchCat = !prodCategoryFilter || item.category === prodCategoryFilter;
                  return matchSearch && matchCat;
                });
                const grouped = filtered.reduce((acc, item) => {
                  const cat = item.category || 'GENERAL';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {});
                const catOrder = ['CAPS', 'SHIRTS', 'JACKETS', 'PANTS', 'ACCESSORIES', 'GENERAL'];
                const sortedCats = Object.keys(grouped).sort((a, b) => {
                  const ai = catOrder.indexOf(a), bi = catOrder.indexOf(b);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });
                const catIcons = { CAPS: '🧢', SHIRTS: '👕', JACKETS: '🧥', PANTS: '👖', ACCESSORIES: '🎒', GENERAL: '📦' };
                return sortedCats.map(cat => (
                  <div key={cat}>
                    <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span>{catIcons[cat] || '📦'}</span>
                      {cat} <span className="text-xs theme-text-muted font-bold">({grouped[cat].length} items, {grouped[cat].reduce((s, i) => s + i.quantity, 0)} units)</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      {grouped[cat].map((item, i) => (
                        <div key={item.id} className="glass p-4 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="p-2 bg-amber-500/10 rounded-lg"><Factory size={14} className="text-amber-400" /></div>
                              <div>
                                <h4 className="font-black theme-text-primary text-xs">{item.productName}</h4>
                                <span className="text-[9px] font-black uppercase text-blue-400">{item.source}</span>
                              </div>
                            </div>
                            <div className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">{item.quantity} units</div>
                          </div>
                          {item.orderId && <p className="text-[9px] theme-text-muted font-mono mb-2">Order: {item.orderId.slice(0, 8)}...</p>}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t theme-border text-center text-[10px]">
                            <div><p className="font-black theme-text-muted uppercase">Cost</p><p className="font-bold theme-text-primary">₨{item.productionCost?.toLocaleString()}</p></div>
                            <div><p className="font-black theme-text-muted uppercase">Value</p><p className="font-bold text-emerald-400">₨{item.sellingValue?.toLocaleString()}</p></div>
                            <div><p className="font-black theme-text-muted uppercase">Margin</p><p className={`font-bold ${item.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{item.profitMargin?.toFixed(1)}%</p></div>
                          </div>
                          <p className="text-[9px] font-bold theme-text-muted mt-2">{formatDateOnly(item.productionDate)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}



          {/* Allocation Tab */}
          {activeTab === 'allocation' && (
            <div className="space-y-4 md:space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Allocate Products</h2>
                <span className="text-xs font-bold theme-text-muted">Assign inventory to workers</span>
              </div>

              {/* Selection-Based Allocation (Order Entry Style) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Person Name + Product Browser */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="glass p-4 md:p-6 rounded-xl md:rounded-[2.5rem] border-2 border-gray-900">
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Recipient Name *</label>
                    <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Enter person's name"
                      className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2" />
                  </div>

                  <div className="glass p-4 md:p-6 rounded-xl md:rounded-[2.5rem] border-2 border-gray-900">
                    <div className="relative group mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-amber-500 transition-colors" size={18} />
                      <input type="text" placeholder="Search products to allocate..." value={allocProdSearch}
                        onChange={(e) => setAllocProdSearch(e.target.value)}
                        className="w-full theme-input rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-amber-500 transition-all font-medium" />
                    </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(allocProdSearch
                      ? inventory.filter(i => i.name.toLowerCase().includes(allocProdSearch.toLowerCase()))
                      : inventory
                    ).map((item, i) => {
                      const variants = item.variants || [];
                      const hasVariants = variants.length > 0;
                      const uniqueSizes = hasVariants ? [...new Set(variants.map(v => v.size).filter(Boolean))] : [];
                      const uniqueColors = hasVariants ? [...new Set(variants.map(v => v.color).filter(Boolean))] : [];
                      const isSelected = allocSelectedProduct?.id === item.id;
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className={`glass p-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-amber-500 bg-amber-500/5' : 'theme-border hover:border-amber-500/30'}`}
                          onClick={() => { setAllocSelectedProduct(item); setAllocSelectedSize(''); setAllocSelectedColor(''); setAllocQty(1); }}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                              <p className="text-[10px] font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              item.stock <= 3 ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                            }`}>
                              {item.stock} left
                            </span>
                          </div>
                          {isSelected && hasVariants && (
                            <div className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
                              {uniqueColors.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mb-1.5">Color</p>
                                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                    {uniqueColors.map(c => {
                                      const stockForColor = variants.filter(v => v.color === c).reduce((s, v) => s + (v.stock || 0), 0);
                                      const disabled = stockForColor <= 0;
                                      const colorMap = {
                                        'white': '#ffffff', 'black': '#1a1a1a', 'navy': '#1e3a5f', 'royal blue': '#4169e1',
                                        'dark blue': '#0a2351', 'light blue': '#add8e6', 'sky blue': '#87ceeb',
                                        'red': '#dc2626', 'dark red': '#8b0000', 'maroon': '#800000', 'wine': '#722f37',
                                        'green': '#16a34a', 'dark green': '#064e3b', 'olive': '#808000', 'teal': '#008080',
                                        'grey': '#6b7280', 'gray': '#6b7280', 'dark grey': '#374151', 'dark gray': '#374151',
                                        'light grey': '#d1d5db', 'light gray': '#d1d5db', 'silver': '#c0c0c0', 'gold': '#d4af37',
                                        'purple': '#9333ea', 'indigo': '#4f46e5', 'pink': '#ec4899', 'brown': '#8b4513',
                                        'khaki': '#c3b091', 'beige': '#f5f5dc', 'cream': '#fffdd0', 'tan': '#d2b48c',
                                        'orange': '#f97316', 'yellow': '#eab308', 'coral': '#ff7f50', 'mint': '#98ff98',
                                        'peach': '#ffdab9', 'lavender': '#e6e6fa', 'turquoise': '#40e0d0', 'magenta': '#ff00ff',
                                        'burgundy': '#900020', 'charcoal': '#36454f', 'camel': '#c19a6b', 'rust': '#b7410e'
                                      };
                                      const normalizedKey = c.toLowerCase().trim();
                                      const bgHex = colorMap[normalizedKey] || '#374151';
                                      const darkColors = new Set(['black','navy','dark blue','dark red','maroon','wine','dark green','olive','teal','grey','gray','dark grey','dark gray','purple','indigo','brown','charcoal','burgundy','rust']);
                                      const textClass = darkColors.has(normalizedKey) ? 'text-white' : 'text-gray-900';
                                      return (
                                        <button key={c} type="button"
                                          onClick={() => { setAllocSelectedColor(c === allocSelectedColor ? '' : c); setAllocSelectedSize(''); }}
                                          disabled={disabled}
                                          className={`relative rounded-xl border-2 transition-all overflow-hidden ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'} ${
                                            allocSelectedColor === c ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105 z-10' : 'border-gray-700 hover:border-gray-500'
                                          }`}>
                                          <div className="w-full aspect-square flex items-center justify-center" style={{ backgroundColor: bgHex }}>
                                            {allocSelectedColor === c && <CheckCircle2 size={16} className={textClass + ' drop-shadow-lg'} />}
                                          </div>
                                          <div className="py-1 px-1 theme-bg text-center">
                                            <p className={`text-[9px] font-bold break-words leading-tight ${allocSelectedColor === c ? 'text-amber-300' : 'theme-text-primary'}`}>{c}</p>
                                            <p className="text-[8px] font-bold theme-text-muted">{stockForColor} left</p>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {uniqueSizes.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mb-1.5">Size</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {uniqueSizes.map(s => {
                                      const stockForSize = allocSelectedColor
                                        ? variants.filter(v => v.color === allocSelectedColor && v.size === s).reduce((sum, v) => sum + (v.stock || 0), 0)
                                        : variants.filter(v => v.size === s).reduce((sum, v) => sum + (v.stock || 0), 0);
                                      const disabled = stockForSize <= 0;
                                      return (
                                        <button key={s} type="button"
                                          onClick={() => setAllocSelectedSize(s === allocSelectedSize ? '' : s)}
                                          disabled={disabled}
                                          className={`w-14 py-2 rounded-lg text-xs font-black border-2 transition-all ${
                                            allocSelectedSize === s
                                              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                              : disabled
                                              ? 'border-gray-800 text-gray-600 cursor-not-allowed opacity-40'
                                              : 'border-gray-700 text-gray-300 hover:border-gray-500'
                                          }`}>
                                          {s}
                                          <span className="block text-[9px] font-bold mt-0.5">{stockForSize}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {isSelected && (
                            <div className="flex items-center justify-between mt-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center space-x-2">
                                <button onClick={() => setAllocQty(q => Math.max(1, q - 1))}
                                  className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all text-gray-300">
                                  <Minus size={14} />
                                </button>
                                <span className="font-black text-white text-sm w-8 text-center">{allocQty}</span>
                                <button onClick={() => {
                                  const maxQ = hasVariants && allocSelectedSize && allocSelectedColor
                                    ? (variants.find(v => v.size === allocSelectedSize && v.color === allocSelectedColor)?.stock || 999)
                                    : 999;
                                  setAllocQty(q => q < maxQ ? q + 1 : q);
                                }}
                                  className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all text-gray-300">
                                  <Plus size={14} />
                                </button>
                                {hasVariants && allocSelectedSize && allocSelectedColor && (
                                  <span className="text-[9px] theme-text-muted font-bold">
                                    / {variants.find(v => v.size === allocSelectedSize && v.color === allocSelectedColor)?.stock || 0}
                                  </span>
                                )}
                              </div>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                const vs = item.variants || [];
                                const uniqSizes = [...new Set(vs.map(v => v.size).filter(Boolean))];
                                const uniqColors = [...new Set(vs.map(v => v.color).filter(Boolean))];

                                if (hasVariants && uniqColors.length > 0 && uniqSizes.length > 0 && (!allocSelectedColor || !allocSelectedSize)) {
                                  toast.error('Please select both color and size before adding to cart');
                                  return;
                                }
                                if (hasVariants && uniqColors.length > 0 && !allocSelectedColor) {
                                  toast.error('Please select a color');
                                  return;
                                }
                                if (hasVariants && uniqSizes.length > 0 && !allocSelectedSize) {
                                  toast.error('Please select a size');
                                  return;
                                }

                                setAllocCartItems(prev => {
                                  const existing = prev.findIndex(i => i.productId === item.id && i.size === allocSelectedSize && i.color === allocSelectedColor);
                                  if (existing >= 0) {
                                    const updated = [...prev];
                                    updated[existing] = { ...updated[existing], qty: updated[existing].qty + allocQty };
                                    return updated;
                                  }
                                  return [...prev, { productId: item.id, productName: item.name, size: allocSelectedSize, color: allocSelectedColor, qty: allocQty }];
                                });
                                toast.success('Added to allocation cart');
                              }}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all active:scale-95 flex items-center space-x-1.5">
                                <PlusCircle size={14} />
                                <span>Add to Cart</span>
                              </button>
                            </div>
                          )}
                          {!isSelected && (
                            <div className="flex items-center space-x-2 mt-2 text-[10px] theme-text-muted">
                              {hasVariants && <span>{uniqueSizes.length} sizes • {uniqueColors.length} colors</span>}
                              {!hasVariants && <span>{item.size || item.fabric || 'No variants'}</span>}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    {inventory.length === 0 && (
                      <div className="col-span-2 text-center py-12">
                        <Package size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="theme-text-muted font-black text-xs">No products found</p>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                {/* Cart Panel */}
                <div className="lg:col-span-1">
                  <div className="glass p-4 md:p-6 rounded-xl md:rounded-[2.5rem] border-2 border-gray-900 lg:sticky lg:top-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-2">
                        <ShoppingCart size={16} className="text-amber-400" />
                        <span>Allocation Cart</span>
                      </h3>
                      {allocCartItems.length > 0 && (
                        <button onClick={() => setAllocCartItems([])} className="text-xs font-black text-red-400 hover:text-red-300 uppercase tracking-wider">Clear</button>
                      )}
                    </div>

                    {allocCartItems.length === 0 ? (
                      <div className="text-center py-8">
                        <Package size={36} className="mx-auto text-gray-700 mb-3" />
                        <p className="theme-text-muted font-black text-xs uppercase tracking-widest">Cart is empty</p>
                        <p className="text-[10px] theme-text-muted font-bold mt-1">Select a product and add to cart</p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4 max-h-[320px] overflow-y-auto">
                        {allocCartItems.map((item, idx) => {
                          const p = inventory.find(i => i.id === item.productId);
                          const maxQ = (() => {
                            if (!p) return 999;
                            const vs = p.variants || [];
                            if (vs.length && item.size && item.color) {
                              const v = vs.find(x => x.size === item.size && x.color === item.color);
                              return v ? v.stock : 999;
                            }
                            return p.stock || 999;
                          })();
                          return (
                            <div key={idx} className="p-3 theme-bg-subtle rounded-xl border theme-border">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-bold theme-text-primary text-xs">{item.productName}</p>
                                <button onClick={() => setAllocCartItems(prev => prev.filter((_, n) => n !== idx))}
                                  className="p-1 hover:bg-red-500/10 rounded-lg transition-all">
                                  <X size={12} className="text-red-400" />
                                </button>
                              </div>
                              <div className="flex items-center space-x-2 text-[10px] theme-text-muted mb-2">
                                {item.size && <span>Size: {item.size}</span>}
                                {item.color && <span>Color: {item.color}</span>}
                              </div>
                              <div className="flex items-center space-x-2">
                                <button onClick={() => setAllocCartItems(prev => prev.map((i, n) => n === idx ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                                  className="p-1 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all text-gray-300">
                                  <Minus size={12} />
                                </button>
                                <span className="font-black text-white text-xs w-6 text-center">{item.qty}</span>
                                <button onClick={() => setAllocCartItems(prev => prev.map((i, n) => n === idx ? { ...i, qty: Math.min(i.qty + 1, maxQ) } : i))}
                                  className="p-1 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all text-gray-300">
                                  <Plus size={12} />
                                </button>
                                <span className="text-[9px] theme-text-muted ml-1">max {maxQ}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {allocCartItems.length > 0 && (
                      <>
                        <textarea value={allocNotes} onChange={(e) => setAllocNotes(e.target.value)}
                          placeholder="Optional notes..."
                          className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-2 px-3 text-xs font-medium text-white outline-none min-h-[50px] mb-3" />
                        <div className="flex justify-between items-center py-2 border-t theme-border mb-3">
                          <span className="text-xs font-bold theme-text-muted uppercase">Total Items</span>
                          <span className="font-black theme-text-primary">{allocCartItems.reduce((s, i) => s + i.qty, 0)}</span>
                        </div>
                        <button onClick={handleAllocate}
                          disabled={allocationLoading || !personName.trim()}
                          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition-all flex items-center justify-center space-x-3 active:scale-95">
                          {allocationLoading ? <RefreshCcw className="animate-spin" size={18} /> : <Send size={18} />}
                          <span>{allocationLoading ? 'Allocating...' : `Allocate to ${personName.trim() || 'Person'}`}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Demands Tab */}
          {activeTab === 'demands' && (
            <div className="space-y-4 md:space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="font-black theme-text-primary uppercase tracking-wider text-lg flex items-center space-x-3">
                  <ShoppingCart size={20} className="text-amber-400" />
                  <span>Outlet Demand Requests</span>
                </h2>
                <div className="flex items-center space-x-3">
                  <input type="text" placeholder="Search by outlet..." value={demandSearch}
                    onChange={(e) => setDemandSearch(e.target.value)}
                    className="theme-input rounded-xl py-2 px-4 text-xs font-medium w-44"
                  />
                  <select value={demandFilter} onChange={(e) => setDemandFilter(e.target.value)}
                    className="theme-bg-subtle border-2 theme-border rounded-xl py-2 px-3 text-xs font-medium text-white outline-none">
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PARTIALLY_APPROVED">Partially Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                  <button onClick={() => { setDemandSearch(''); setDemandFilter(''); fetchDemands(); }}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl text-xs border border-gray-700">
                    <RefreshCcw size={14} />
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-2xl font-black theme-text-primary">{demandStats.total}</p>
                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Total</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-2xl font-black text-yellow-400">{demandStats.pending}</p>
                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Pending</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-2xl font-black text-emerald-400">{demandStats.approved}</p>
                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Approved</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-2xl font-black text-blue-400">{demandStats.partiallyApproved}</p>
                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Partial</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-2xl font-black text-red-400">{demandStats.rejected}</p>
                  <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Rejected</p>
                </div>
              </div>

              {/* Demand Request Cards */}
              {demandLoading ? (
                <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
              ) : demandRequests.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No demand requests</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {demandRequests.map((req, i) => {
                    const items = typeof req.items === 'string' ? JSON.parse(req.items) : req.items;
                    const totalReq = items.reduce((s, it) => s + (it.requestedQty || 0), 0);
                    const totalApp = items.reduce((s, it) => s + (it.approvedQty || 0), 0);
                    const isPending = req.status === 'PENDING';
                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 md:p-6 rounded-xl md:rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-xl ${isPending ? 'bg-yellow-500/10 text-yellow-400' : req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {isPending ? <Clock size={18} /> : req.status === 'REJECTED' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                            </div>
                            <div>
                              <p className="font-black theme-text-primary">{req.outletName}</p>
                              <p className="text-xs theme-text-muted font-bold">{formatDateTime(req.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-xs theme-text-muted font-bold">Requested: <span className="text-white font-black">{totalReq}</span></p>
                              <p className="text-xs font-bold text-emerald-400">Approved: {totalApp}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                              req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                              req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>{req.status.replace('_', ' ')}</span>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-[10px] font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                                <th className="pb-2 pr-3">Product</th>
                                <th className="pb-2 pr-3">Size</th>
                                <th className="pb-2 pr-3">Color</th>
                                <th className="pb-2 pr-3 text-center">Requested</th>
                                <th className="pb-2 text-center">Approved</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, ii) => (
                                <tr key={ii} className="border-b border-gray-800/30">
                                  <td className="py-2 pr-3 font-bold theme-text-primary">{it.productName}</td>
                                  <td className="py-2 pr-3 theme-text-secondary">{it.size || '-'}</td>
                                  <td className="py-2 pr-3 theme-text-secondary">{it.color || '-'}</td>
                                  <td className="py-2 pr-3 text-center font-bold text-white">{it.requestedQty}</td>
                                  <td className="py-2 text-center font-bold text-emerald-400">{it.approvedQty || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Actions */}
                        {isPending && (
                          <div className="flex justify-end space-x-3 mt-3 pt-3 border-t theme-border">
                            <button onClick={() => {
                              setDemandApproveItems(items.map(it => ({ ...it, approvedQty: it.approvedQty || it.requestedQty })));
                              setDemandApproveModal({ type: 'approve', request: req });
                            }}
                              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition-all flex items-center space-x-2">
                              <CheckCircle2 size={14} />
                              <span>Approve</span>
                            </button>
                            <button onClick={() => {
                              setDemandApproveItems(items.map(it => ({ ...it, approvedQty: it.approvedQty || 0 })));
                              setDemandApproveModal({ type: 'partial', request: req });
                            }}
                              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition-all flex items-center space-x-2">
                              <AlertTriangle size={14} />
                              <span>Partial</span>
                            </button>
                            <button onClick={() => handleDemandApprove(req.id, 'REJECTED', items)}
                              className="px-5 py-2 bg-red-600/80 hover:bg-red-600 text-white font-black text-xs rounded-xl transition-all flex items-center space-x-2">
                              <XCircle size={14} />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}
                        {!isPending && req.storeNotes && (
                          <div className="mt-3 p-3 theme-bg-subtle rounded-xl border theme-border">
                            <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider">Store Notes</p>
                            <p className="text-xs theme-text-primary font-medium mt-0.5">{req.storeNotes}</p>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Returns Tab */}
      {activeTab === 'returns' && (
        <div className="theme-bg-subtle rounded-2xl p-4 md:p-6 border-2 theme-border">
          <WarehouseReturns />
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <WarehouseAudit />
      )}




      {/* Demand Approve Modal */}
      <AnimatePresence>
        {demandApproveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={() => setDemandApproveModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="glass max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <h2 className="text-xl font-black theme-text-primary mb-1">
                {demandApproveModal.type === 'approve' ? 'Approve Demand' : 'Partially Approve'}
              </h2>
              <p className="theme-text-secondary text-xs font-bold mb-6">
                #{demandApproveModal.request.outletName} — {demandApproveModal.request.id.slice(0, 8)}
              </p>
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                        <th className="pb-3 pr-3">Product</th>
                        <th className="pb-3 pr-3">Size</th>
                        <th className="pb-3 pr-3">Color</th>
                        <th className="pb-3 pr-3 text-center">Requested</th>
                        <th className="pb-3 text-center">Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demandApproveItems.map((it, ii) => (
                        <tr key={ii} className="border-b border-gray-800/30">
                          <td className="py-3 pr-3 font-bold theme-text-primary text-sm">{it.productName}</td>
                          <td className="py-3 pr-3 theme-text-secondary text-xs">{it.size || '-'}</td>
                          <td className="py-3 pr-3 theme-text-secondary text-xs">{it.color || '-'}</td>
                          <td className="py-3 pr-3 text-center font-black text-white">{it.requestedQty}</td>
                          <td className="py-3 text-center">
                            <input type="number" min="0" max={it.requestedQty} value={it.approvedQty}
                              onChange={(e) => {
                                const newItems = [...demandApproveItems];
                                newItems[ii] = { ...newItems[ii], approvedQty: Math.min(parseInt(e.target.value) || 0, it.requestedQty) };
                                setDemandApproveItems(newItems);
                              }}
                              className="w-16 theme-bg-subtle border-2 theme-border rounded-lg py-1.5 px-2 text-sm font-black text-white text-center outline-none focus:border-amber-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button onClick={() => setDemandApproveModal(null)}
                    className="px-6 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  <button onClick={() => {
                    const allApproved = demandApproveItems.every(it => it.approvedQty >= it.requestedQty);
                    const someApproved = demandApproveItems.some(it => it.approvedQty > 0);
                    const status = allApproved ? 'APPROVED' : someApproved ? 'PARTIALLY_APPROVED' : 'REJECTED';
                    handleDemandApprove(demandApproveModal.request.id, status, demandApproveItems);
                  }}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2">
                    <CheckCircle2 size={16} />
                    <span>Confirm</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WarehouseDashboard;
