import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Package, ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  RefreshCcw, Search, Clock, Truck, Building2, PlusCircle,
  Eye, ThumbsUp, ThumbsDown, FileText, BarChart3, MinusCircle, Minus, Plus,
  CheckCircle, AlertCircle, Download, TrendingUp, User, Gift, Send,
  Factory, Trash2, ClipboardList, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import OrderCard from '../components/OrderCard';
import toast from 'react-hot-toast';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { usePolling } from '../hooks/usePolling';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const TABS = ['dashboard', 'tasks', 'inventory', 'production', 'allocation', 'demands'];
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];
const CATEGORIES = ['CAPS', 'SHIRTS', 'JACKETS', 'PANTS', 'ACCESSORIES', 'GENERAL'];

const WarehouseDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [personName, setPersonName] = useState('');
  const [allocationLoading, setAllocationLoading] = useState(false);
  // Selection-based allocation (Order Entry style)
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
  const [productionInventory, setProductionInventory] = useState([]);
  const [prodCategoryFilter, setProdCategoryFilter] = useState('');
  const [unseenTasks, setUnseenTasks] = useState(null);
  const [productionTasks, setProductionTasks] = useState(null);
  const [tasksSubTab, setTasksSubTab] = useState('incoming');
  const [storeDashboard, setStoreDashboard] = useState(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [routingModal, setRoutingModal] = useState(null);
  const [routeDestination, setRouteDestination] = useState('LOGO_DESIGN');
  const [routeRemarks, setRouteRemarks] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
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
  }, [activeTab, allocPage, demandFilter]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const token = sessionStorage.getItem('token');
    try {
      if (activeTab === 'dashboard' || activeTab === 'allocation' || activeTab === 'inventory') {
        const res = await axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setInventory(res.data);
      } else if (activeTab === 'production') {
        const invRes = await axios.get(`${API_URL}/api/production/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setProductionInventory(invRes.data);
      } else if (activeTab === 'tasks') {
        const results = await Promise.allSettled([
          axios.get(`${API_URL}/api/orders/store-dashboard`, { params: { limit: 250, source: sourceFilter !== 'ALL' ? sourceFilter : undefined }, headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/api/orders/production-returned`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (results[0].status === 'fulfilled') setStoreDashboard(results[0].value.data);
        if (results[1].status === 'fulfilled') setProductionTasks(results[1].value.data);
      }
    } catch (error) {
      if (!silent) console.error('Error fetching data:', error);
    }
    if (!silent) setLoading(false);
  };

  const fetchAllocations = async () => {
    setAllocLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const params = { page: allocPage, limit: 50 };
      if (allocSearch.trim()) params.personName = allocSearch.trim();
      const res = await axios.get(`${API_URL}/api/inventory/allocations`, { params, headers: { Authorization: `Bearer ${token}` } });
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
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/inventory/allocations/stats`, { headers: { Authorization: `Bearer ${token}` } });
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
      const token = sessionStorage.getItem('token');
      await axios.patch(`${API_URL}/api/inventory/allocations/${id}/status`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Allocation marked as ${status}`);
      fetchAllocations();
      fetchAllocationStats();
    } catch (error) {
      console.error('Allocation status update error:', error.response?.status, error.response?.data);
      toast.error(error.response?.data?.message || `Error ${error.response?.status || 'no response'}. Check console.`);
    }
  };

  const fetchDemands = async () => {
    setDemandLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const params = {};
      if (demandFilter) params.status = demandFilter;
      if (demandSearch.trim()) params.outletName = demandSearch.trim();
      const [allRes, statsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/demand/all`, { params, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/demand/stats`, { headers: { Authorization: `Bearer ${token}` } })
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
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/demand/${id}/approve`,
        { status, items, storeNotes: '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Demand request ${status.toLowerCase()}`);
      setDemandApproveModal(null);
      fetchDemands();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update demand');
    }
  };

  const fetchUnseenTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/orders/unseen-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnseenTasks(res.data);
    } catch (e) {
      console.error('Failed to fetch unseen tasks:', e);
    }
  };

  const fetchStoreDashboard = async () => {
    setStoreLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const params = { limit: 250 };
      if (sourceFilter !== 'ALL') params.source = sourceFilter;
      const res = await axios.get(`${API_URL}/api/orders/store-dashboard`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setStoreDashboard(res.data);
    } catch (e) {
      console.error('Failed to fetch store dashboard:', e);
    }
    setStoreLoading(false);
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${orderId}/accept-store`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Order accepted at Store');
      fetchStoreDashboard();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error accepting order');
    }
  };

  const handleRouteOrder = async () => {
    if (!routingModal) return;
    setRouteLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${routingModal.id}/store-route`,
        { destinationStage: routeDestination, remarks: routeRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Order routed to ${routeDestination.replace(/_/g, ' ')}`);
      setRoutingModal(null);
      setRouteDestination('LOGO_DESIGN');
      setRouteRemarks('');
      fetchStoreDashboard();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error routing order');
    }
    setRouteLoading(false);
  };

  const fetchProductionTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/orders/production-returned`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionTasks(res.data);
    } catch (e) {
      console.error('Failed to fetch production tasks:', e);
    }
  };

  const handleMarkSeen = async (orderId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${orderId}/mark-seen`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUnseenTasks();
      fetchProductionTasks();
    } catch (e) {
      console.error('Failed to mark order as seen:', e);
    }
  };

  const handleAllocate = async () => {
    if (!personName.trim()) { toast.error('Please enter person name'); return; }
    if (!allocCartItems.length) { toast.error('Add at least one product to cart'); return; }
    for (const item of allocCartItems) {
      const p = inventory.find(i => i.id === item.productId);
      const vs = p?.variants || [];
      if (vs.length && (!item.color || !item.size)) { toast.error('Select color and size for all items'); return; }
    }
    setAllocationLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/inventory/allocate`, {
        personName: personName.trim(),
        items: allocCartItems.map(i => ({
          itemId: i.productId,
          color: i.color,
          size: i.size,
          quantity: i.qty
        })),
        notes: allocNotes,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Products allocated successfully');
      setPersonName('');
      setAllocCartItems([]);
      setAllocNotes('');
      setAllocProdSearch('');
      setAllocSelectedProduct(null);
      fetchData(true);
      fetchAllocations();
      fetchAllocationStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error allocating products');
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
  usePolling(() => { if (pageVisible) fetchData(true); }, 60000);

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

  const filteredInventory = inventory.filter(item =>
    !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <button onClick={fetchData} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95 border border-gray-700">
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
                {tab === 'tasks' && <><ClipboardList size={14} className="inline mr-2" />Tasks</>}
                {tab === 'inventory' && <><Package size={14} className="inline mr-2" />Inventory</>}
                {tab === 'production' && <><Factory size={14} className="inline mr-2" />Production Inventory</>}
                {tab === 'allocation' && <><Gift size={14} className="inline mr-2" />Allocation</>}
                {tab === 'demands' && <><ShoppingCart size={14} className="inline mr-2" />Demands {demandStats.pending > 0 && <span className="ml-1 bg-red-500 text-white text-xs md:text-sm px-1.5 py-0.5 rounded-full">{demandStats.pending}</span>}</>}
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

            </div>
          )}

          {/* Store Profile - Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-4 md:space-y-6">
              {/* Source filter */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
                  <button onClick={() => { setSourceFilter('ALL'); fetchStoreDashboard(); }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'ALL' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    All Sources
                  </button>
                  <button onClick={() => { setSourceFilter('ONLINE'); fetchStoreDashboard(); }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'ONLINE' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <span className="text-blue-400 mr-1">🌐</span>Online
                  </button>
                  <button onClick={() => { setSourceFilter('OUTLET'); fetchStoreDashboard(); }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'OUTLET' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <span className="text-emerald-400 mr-1">🏪</span>Outlet
                  </button>
                  <button onClick={() => { setSourceFilter('INTERNAL'); fetchStoreDashboard(); }}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'INTERNAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <span className="text-purple-400 mr-1">⚙</span>Internal
                  </button>
                </div>
                <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
                  <button onClick={() => setTasksSubTab('incoming')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'incoming' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <ShoppingCart size={14} />Incoming {storeDashboard?.incoming?.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{storeDashboard.incoming.length}</span>}
                  </button>
                  <button onClick={() => setTasksSubTab('active')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'active' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <CheckCircle size={14} />Active ({storeDashboard?.active?.length || 0})
                  </button>
                  <button onClick={() => setTasksSubTab('returns')}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'returns' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                    <RefreshCcw size={14} />Returns ({(storeDashboard?.returnedFromLogo?.length || 0) + (storeDashboard?.returnedFromProduction?.length || 0) + (storeDashboard?.returnedFromDispatch?.length || 0)})
                  </button>
                </div>
              </div>

              {/* Store stats summary */}
              {storeDashboard && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="glass p-3 rounded-xl border-2 border-blue-500/20">
                    <p className="text-xs font-black theme-text-muted uppercase tracking-wider">Incoming</p>
                    <p className="text-lg font-black text-blue-400">{storeDashboard.incoming?.length || 0}</p>
                  </div>
                  <div className="glass p-3 rounded-xl border-2 border-emerald-500/20">
                    <p className="text-xs font-black theme-text-muted uppercase tracking-wider">Active</p>
                    <p className="text-lg font-black text-emerald-400">{storeDashboard.active?.length || 0}</p>
                  </div>
                  <div className="glass p-3 rounded-xl border-2 border-purple-500/20">
                    <p className="text-xs font-black theme-text-muted uppercase tracking-wider">Returns</p>
                    <p className="text-lg font-black text-purple-400">{(storeDashboard.returnedFromLogo?.length || 0) + (storeDashboard.returnedFromProduction?.length || 0) + (storeDashboard.returnedFromDispatch?.length || 0)}</p>
                  </div>
                  <div className="glass p-3 rounded-xl border-2 border-amber-500/20">
                    <p className="text-xs font-black theme-text-muted uppercase tracking-wider">Total</p>
                    <p className="text-lg font-black text-amber-400">{storeDashboard.total || 0}</p>
                  </div>
                </div>
              )}

              {/* Incoming Orders - Pending Acceptance */}
              {tasksSubTab === 'incoming' && (
                <div className="space-y-4">
                  {storeLoading ? (
                    <PageLoader text="Loading incoming orders..." />
                  ) : !storeDashboard?.incoming?.length ? (
                    <div className="text-center py-12 glass rounded-2xl theme-border">
                      <ShoppingCart size={48} className="mx-auto text-gray-600 mb-4" />
                      <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No incoming orders pending acceptance</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {storeDashboard.incoming.map(order => {
                        const storeStage = order.stages?.find(s => s.stageName === 'STORE');
                        const delay = storeStage?.createdAt ? Math.floor((Date.now() - new Date(storeStage.createdAt).getTime()) / 60000) : 0;
                        const sourceColor = order.source === 'ONLINE' ? 'text-blue-400' : order.source === 'OUTLET' ? 'text-emerald-400' : 'text-purple-400';
                        return (
                          <div key={order.id} className="glass p-4 rounded-2xl border-2 border-yellow-500/20 hover:border-yellow-500/40 transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-black theme-text-primary text-sm flex items-center gap-2">
                                  #{order.orderNumber || 'N/A'}
                                  {order.urgent && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-black">URGENT</span>}
                                </p>
                                <p className="font-bold theme-text-secondary text-xs mt-0.5">{order.customerName}</p>
                                {order.customerPhone && <p className="text-[10px] theme-text-muted font-mono">{order.customerPhone}</p>}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${sourceColor}`}>{order.source}</span>
                                {order.outletName && <span className="text-[9px] theme-text-muted">{order.outletName}</span>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] theme-text-muted font-bold mb-3">
                              <span>Received: {storeStage?.createdAt ? new Date(storeStage.createdAt).toLocaleString() : '-'}</span>
                              <span className={delay > 60 ? 'text-red-400' : delay > 30 ? 'text-yellow-400' : 'text-emerald-400'}>
                                {delay > 0 ? `${delay}m ago` : 'Just now'}
                              </span>
                            </div>
                            <button onClick={() => handleAcceptOrder(order.id)}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95">
                              <CheckCircle size={14} />
                              Accept Order
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Active Orders - Accepted, Ready to Route */}
              {tasksSubTab === 'active' && (
                <div className="space-y-4">
                  {storeLoading ? (
                    <PageLoader text="Loading active orders..." />
                  ) : !storeDashboard?.active?.length ? (
                    <div className="text-center py-12 glass rounded-2xl theme-border">
                      <CheckCircle size={48} className="mx-auto text-gray-600 mb-4" />
                      <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No active orders. Accept incoming orders first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {storeDashboard.active.map(order => {
                        const storeStage = order.stages?.find(s => s.stageName === 'STORE');
                        const acceptanceDelay = storeStage?.startedAt && storeStage?.createdAt
                          ? Math.floor((new Date(storeStage.startedAt).getTime() - new Date(storeStage.createdAt).getTime()) / 60000) : 0;
                        return (
                          <div key={order.id} className="glass p-4 rounded-2xl border-2 border-emerald-500/20 hover:border-emerald-500/40 transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-black theme-text-primary text-sm flex items-center gap-2">
                                  #{order.orderNumber || 'N/A'}
                                </p>
                                <p className="font-bold theme-text-secondary text-xs mt-0.5">{order.customerName}</p>
                                {order.customerPhone && <p className="text-[10px] theme-text-muted font-mono">{order.customerPhone}</p>}
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-wider ${order.source === 'ONLINE' ? 'text-blue-400' : order.source === 'OUTLET' ? 'text-emerald-400' : 'text-purple-400'}`}>{order.source}</span>
                            </div>
                            <div className="text-[10px] theme-text-muted font-bold mb-3 space-y-1">
                              <p>Accepted: {storeStage?.startedAt ? new Date(storeStage.startedAt).toLocaleString() : '-'}</p>
                              {acceptanceDelay > 0 && <p>Acceptance Delay: <span className={acceptanceDelay > 60 ? 'text-red-400' : 'text-yellow-400'}>{acceptanceDelay}m</span></p>}
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                              <button className="py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-blue-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('LOGO_DESIGN'); setRouteRemarks(''); }}>
                                🎨 Logo
                              </button>
                              <button className="py-1.5 bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-purple-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('PRODUCTION_ACCEPTANCE'); setRouteRemarks(''); }}>
                                🏭 Prod
                              </button>
                              <button className="py-1.5 bg-violet-600/20 text-violet-400 border border-violet-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-violet-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('PRODUCTION'); setRouteRemarks(''); }}>
                                ⚙️ Direct
                              </button>
                              <button className="py-1.5 bg-amber-600/20 text-amber-400 border border-amber-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-amber-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('DISPATCH'); setRouteRemarks(''); }}>
                                📦 Dispatch
                              </button>
                              <button className="py-1.5 bg-cyan-600/20 text-cyan-400 border border-cyan-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-cyan-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('STORE_RECEIVE'); setRouteRemarks(''); }}>
                                📥 Receive
                              </button>
                              <button className="py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('OUT_FOR_DELIVERY'); setRouteRemarks(''); }}>
                                🚚 Deliver
                              </button>
                              <button className="py-1.5 bg-gray-600/20 text-gray-400 border border-gray-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-gray-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('RETURN_TO_SOURCE'); setRouteRemarks(''); }}>
                                ↩ Source
                              </button>
                              <button className="py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-indigo-600/30 transition-all active:scale-95"
                                onClick={() => { setRoutingModal(order); setRouteDestination('ORDER_ENTRY'); setRouteRemarks(''); }}>
                                📝 Entry
                              </button>
                              <button className="py-1.5 bg-orange-600/20 text-orange-400 border border-orange-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-orange-600/30 transition-all active:scale-95 md:hidden"
                                onClick={() => { setRoutingModal(order); setRouteDestination('STORE'); setRouteRemarks(''); }}>
                                🏪 Store
                              </button>
                              <button onClick={() => { setRoutingModal(order); setRouteRemarks(''); }}
                                className="py-1.5 bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-amber-600/50 transition-all active:scale-95 col-span-2">
                                ⋯ More
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Returns Tab */}
              {tasksSubTab === 'returns' && (
                <div className="space-y-6">
                  {storeLoading ? (
                    <PageLoader text="Loading returns..." />
                  ) : (
                    <>
                      {/* Returned from Logo */}
                      {storeDashboard?.returnedFromLogo?.length > 0 && (
                        <div>
                          <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Returned from Logo ({storeDashboard.returnedFromLogo.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                            {storeDashboard.returnedFromLogo.map(order => {
                              const storeStage = order.stages?.find(s => s.stageName === 'STORE' && s.returnedFrom === 'LOGO_DESIGN');
                              return (
                                <div key={order.id} className="glass p-4 rounded-2xl border-2 border-blue-500/20">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                      <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                                    </div>
                                    <span className="text-[10px] text-blue-400 font-black uppercase">← Logo</span>
                                  </div>
                                  {storeStage?.returnReason && <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {storeStage.returnReason}</p>}
                                  <div className="flex gap-2">
                                    <button onClick={() => handleAcceptOrder(order.id)}
                                      className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                                      Re-accept
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Returned from Production */}
                      {storeDashboard?.returnedFromProduction?.length > 0 && (
                        <div>
                          <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            Returned from Production ({storeDashboard.returnedFromProduction.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                            {storeDashboard.returnedFromProduction.map(order => {
                              const storeStage = order.stages?.find(s => s.stageName === 'STORE' && (s.returnedFrom === 'PRODUCTION' || s.returnedFrom === 'PRODUCTION_ACCEPTANCE'));
                              return (
                                <div key={order.id} className="glass p-4 rounded-2xl border-2 border-purple-500/20">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                      <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                                    </div>
                                    <span className="text-[10px] text-purple-400 font-black uppercase">← Production</span>
                                  </div>
                                  {storeStage?.returnReason && <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {storeStage.returnReason}</p>}
                                  <div className="flex gap-2">
                                    <button onClick={() => handleAcceptOrder(order.id)}
                                      className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                                      Re-accept
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Returned from Dispatch */}
                      {storeDashboard?.returnedFromDispatch?.length > 0 && (
                        <div>
                          <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Returned from Dispatch ({storeDashboard.returnedFromDispatch.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                            {storeDashboard.returnedFromDispatch.map(order => {
                              const storeStage = order.stages?.find(s => s.stageName === 'STORE' && s.returnedFrom === 'DISPATCH');
                              return (
                                <div key={order.id} className="glass p-4 rounded-2xl border-2 border-amber-500/20">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                      <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                                    </div>
                                    <span className="text-[10px] text-amber-400 font-black uppercase">← Dispatch</span>
                                  </div>
                                  {storeStage?.returnReason && <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {storeStage.returnReason}</p>}
                                  <div className="flex gap-2">
                                    <button onClick={() => handleAcceptOrder(order.id)}
                                      className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                                      Re-accept
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {(!storeDashboard?.returnedFromLogo?.length && !storeDashboard?.returnedFromProduction?.length && !storeDashboard?.returnedFromDispatch?.length) && (
                        <div className="text-center py-12 glass rounded-2xl theme-border">
                          <RefreshCcw size={48} className="mx-auto text-gray-600 mb-4" />
                          <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No returned orders</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}



          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Warehouse Stock</h2>
                <div className="flex items-center space-x-4">
                  <input type="text" placeholder="Search inventory..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="theme-input rounded-xl py-2 px-4 focus:outline-none focus:border-amber-500 transition-all text-xs font-medium theme-text-secondary w-48"
                  />
                  <a href="/inventory" className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 text-xs uppercase tracking-wider active:scale-95">
                    <PlusCircle size={16} />
                    <span>Manage Inventory</span>
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`glass p-5 rounded-2xl border-2 transition-all ${
                      item.stock <= 10 ? 'border-red-500/20 hover:border-red-500/40' : item.stock <= 50 ? 'border-yellow-500/20 hover:border-yellow-500/40' : 'theme-border hover:border-emerald-500/30'
                    }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                        <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs md:text-sm font-black uppercase border ${
                        item.stock <= 10 ? 'border-red-500/20 bg-red-500/5 text-red-500' :
                        item.stock <= 50 ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500' :
                        'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'
                      }`}>
                        {item.stock <= 10 ? 'Low' : item.stock <= 50 ? 'Medium' : 'In Stock'}
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-black theme-text-primary">{item.stock}</p>
                      <span className="text-xs md:text-sm font-bold theme-text-muted uppercase">units</span>
                    </div>
                    {item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (
                      <div className="mt-3 pt-3 border-t theme-border space-y-1.5">
                        <div className="flex items-center justify-between text-xs theme-text-muted font-black uppercase tracking-wider pb-1">
                          <span>Variant</span>
                          <span>Stock</span>
                        </div>
                        {item.variants.filter(v => (v.stock || 0) > 0).map((v, vi) => (
                          <div key={vi} className="flex items-center justify-between text-xs md:text-sm">
                            <span className="theme-text-secondary font-bold">{v.color || ''} {v.size || ''}</span>
                            <span className="theme-text-primary font-black">{v.stock || 0} <span className="theme-text-muted font-bold">units</span></span>
                          </div>
                        ))}
                      </div>
                    ) : (item.color || item.size || item.fabric ? (
                      <p className="text-xs md:text-sm theme-text-muted font-bold mt-2">
                        {[item.color, item.size, item.fabric].filter(Boolean).join(' • ')}
                      </p>
                    ) : null)}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

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
                          <p className="text-[9px] font-bold theme-text-muted mt-2">{new Date(item.productionDate).toLocaleDateString()}</p>
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

                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input type="text" placeholder="Search products to allocate..." value={allocProdSearch}
                      onChange={(e) => setAllocProdSearch(e.target.value)}
                      className="w-full theme-input rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-amber-500 transition-all font-medium" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(allocProdSearch
                      ? inventory.filter(i => i.stock > 0 && i.name.toLowerCase().includes(allocProdSearch.toLowerCase()))
                      : inventory.filter(i => i.stock > 0)
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
                                            <p className={`text-[9px] font-bold truncate ${allocSelectedColor === c ? 'text-amber-300' : 'theme-text-primary'}`}>{c}</p>
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
                                if (vs.length > 0 && (!allocSelectedSize || !allocSelectedColor)) {
                                  toast.error('Select size and color first');
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
                    {inventory.filter(i => i.stock > 0).length === 0 && (
                      <div className="col-span-2 text-center py-12">
                        <Package size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="theme-text-muted font-black text-xs">No products in stock</p>
                      </div>
                    )}
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

              {/* Person Stats */}
              {allocationStats.length > 0 && (
              <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                    <User size={18} className="text-amber-400" />
                    <span>Allocation Summary by Person</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                          <tr className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                          <th className="pb-3 pr-4">Person</th>
                          <th className="pb-3 pr-4">Times Taken</th>
                          <th className="pb-3 pr-4">Total Items</th>
                          <th className="pb-3">Last Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocationStats.map(stat => (
                          <tr key={stat.personName} className="border-b border-gray-800/50 text-sm">
                            <td className="py-3 pr-4 font-bold theme-text-primary">{stat.personName}</td>
                            <td className="py-3 pr-4"><span className="font-black text-amber-400">{stat.timesTaken}x</span></td>
                            <td className="py-3 pr-4"><span className="font-black text-emerald-400">{stat.totalItems}</span></td>
                            <td className="py-3 text-xs theme-text-secondary">{new Date(stat.lastTaken).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Today</p>
                  <p className="text-2xl font-black text-blue-400 mt-1">{allocSummary.todayTotal}</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Active</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{allocSummary.activeTotal}</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Total Allocated</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{allocSummary.totalAllocated}</p>
                </div>
                <div className="glass p-4 rounded-xl border-2 border-gray-900">
                  <p className="text-xs font-black theme-text-muted uppercase tracking-widest">Records</p>
                  <p className="text-2xl font-black text-purple-400 mt-1">{allocTotal}</p>
                </div>
              </div>

              {/* Allocation History Cards */}
              <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-3">
                    <Clock size={18} className="text-blue-400" />
                    <span>Allocation History</span>
                  </h3>
                  <div className="flex items-center space-x-3">
                    <input type="text" placeholder="Search by person name..." value={allocSearch}
                      onChange={(e) => setAllocSearch(e.target.value)}
                      className="theme-input rounded-xl py-2 px-4 focus:border-amber-500 outline-none text-xs font-medium theme-text-secondary w-48"
                    />
                    <button onClick={() => { setAllocPage(1); fetchAllocations(); }}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all text-xs active:scale-95 border border-gray-700">
                      <Search size={14} className="inline" />
                    </button>
                  </div>
                </div>
                {allocLoading ? (
                  <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
                ) : allocationRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No allocation records yet</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {allocationRecords.map(rec => {
                        const statusColors = {
                          ACTIVE: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                          APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                          REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
                          COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        };
                        const sc = statusColors[rec.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
                        return (
                          <motion.div key={rec.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="glass p-4 rounded-xl border-2 border-gray-900 hover:border-gray-700 transition-all">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-black theme-text-primary text-sm">{rec.personName}</p>
                                <p className="text-xs theme-text-muted font-bold">{rec.itemName}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${sc}`}>
                                  {rec.status || 'ACTIVE'}
                                </span>
                                <span className="text-lg font-black text-amber-400">{rec.quantity}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs theme-text-secondary">
                              {rec.color && <span>Color: <span className="font-bold">{rec.color}</span></span>}
                              {rec.size && <span>Size: <span className="font-bold">{rec.size}</span></span>}
                            </div>
                            {rec.notes && <p className="text-xs theme-text-muted mt-1 italic">{rec.notes}</p>}
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800/50">
                              <p className="text-[10px] theme-text-muted">{new Date(rec.createdAt).toLocaleString()}</p>
                              <div className="flex space-x-1">
                                {rec.allocatedByName && <p className="text-[10px] theme-text-muted">by {rec.allocatedByName}</p>}
                                {rec.status === 'ACTIVE' && (
                                  <>
                                    <button onClick={() => updateAllocationStatus(rec.id, 'COMPLETED')}
                                      className="px-2 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black transition-all">
                                      Complete
                                    </button>
                                    <button onClick={() => updateAllocationStatus(rec.id, 'REJECTED')}
                                      className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black transition-all">
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-xs theme-text-muted font-bold">{allocTotal} total records</p>
                      <div className="flex space-x-2">
                        <button disabled={allocPage <= 1} onClick={() => { setAllocPage(p => p - 1); }}
                          className="px-4 py-2 bg-gray-800 rounded-xl text-xs font-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Previous
                        </button>
                        <button disabled={allocationRecords.length < 50} onClick={() => { setAllocPage(p => p + 1); }}
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
                              <p className="text-xs theme-text-muted font-bold">{new Date(req.createdAt).toLocaleString()}</p>
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

      {/* Routing Modal */}
      <AnimatePresence>
        {routingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <h2 className="text-xl font-black theme-text-primary mb-1">Route Order</h2>
              <p className="theme-text-secondary text-xs font-bold mb-6">
                #{routingModal.orderNumber || 'N/A'} — {routingModal.customerName}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Destination</label>
                  <select value={routeDestination} onChange={(e) => setRouteDestination(e.target.value)}
                    className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-bold text-white mt-2">
                    {(() => { const st = routingModal?.stages?.find(s => ['PENDING','IN_PROGRESS','WAITING_APPROVAL'].includes(s.status))?.stageName; return (<>
                      {st !== 'LOGO_DESIGN' && <option value="LOGO_DESIGN">🎨 Logo Design</option>}
                      {st !== 'PRODUCTION_ACCEPTANCE' && <option value="PRODUCTION_ACCEPTANCE">🏭 Production Acceptance</option>}
                      {st !== 'PRODUCTION' && <option value="PRODUCTION">⚙️ Production</option>}
                      {st !== 'STORE_RECEIVE' && <option value="STORE_RECEIVE">📥 Store Receive</option>}
                      {st !== 'DISPATCH' && <option value="DISPATCH">📦 Dispatch</option>}
                      {st !== 'OUT_FOR_DELIVERY' && <option value="OUT_FOR_DELIVERY">🚚 Out for Delivery</option>}
                      {st !== 'STORE' && <option value="STORE">🏪 Store</option>}
                      {st !== 'ORDER_ENTRY' && <option value="ORDER_ENTRY">📝 Order Entry</option>}
                      <option value="RETURN_TO_SOURCE">↩ Return to Source</option>
                    </>)})()}
                  </select>
                </div>
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Remarks (optional)</label>
                  <input type="text" value={routeRemarks} onChange={(e) => setRouteRemarks(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2"
                  />
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setRoutingModal(null)}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleRouteOrder} disabled={routeLoading}
                    className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {routeLoading ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                    {routeLoading ? 'Routing...' : `Route to ${routeDestination.replace(/_/g, ' ')}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



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
