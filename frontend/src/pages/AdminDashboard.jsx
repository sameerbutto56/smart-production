import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import {
  BarChart3,
  Users,
  Clock,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  Trash2,
  Lock,
  ShieldAlert,
  X,
  ClipboardList,
  MapPin,
  Search,
  CheckCircle2,
  Package,
  Truck,
  Circle,
  Loader2,
  BellRing,
  Sparkles,
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Filter,
  FileEdit,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  History,
  LayoutDashboard,
  Warehouse,
  Gift,
  FileText,
  RefreshCcw,
  Plus,
  Minus,
  XCircle,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import OrderCard from '../components/OrderCard';
import AdminSettings from './AdminSettings';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import { PauseCircle, PlayCircle } from 'lucide-react';


const TOP_TABS = [
  { id: 'all_phases', label: 'All Phases', icon: LayoutDashboard },
  { id: 'warehouse', label: 'Warehouse', icon: Package },
  { id: 'edit_requests', label: 'Order Change Requests', icon: FileEdit },
  { id: 'recent_orders', label: 'Recent Orders', icon: History },
  { id: 'settings', label: 'System Settings', icon: ShieldAlert },
];

const PIPELINE_STAGES = [
  { id: 'ORDER_ENTRY', label: 'Order Entry', icon: ClipboardList },
  { id: 'STORE', label: 'Store', icon: Package },
  { id: 'LOGO_DESIGN', label: 'Logo Design', icon: Circle },
  { id: 'PRODUCTION_ACCEPTANCE', label: 'Production Acceptance', icon: Circle },
  { id: 'PRODUCTION', label: 'Production', icon: Circle },
  { id: 'DISPATCH', label: 'Dispatch', icon: Truck },
  { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', icon: Truck },
];

const BRANCHES = [
  { value: '', label: 'All Outlets' },
  { value: 'JOHAR TOWN BRANCH', label: 'Johar Town Branch' },
  { value: 'ABBOTTABAD BRANCH', label: 'Abbottabad Branch' },
  { value: 'JAIL ROAD BRANCH', label: 'Jail Road Branch' },
  { value: 'ONLINE', label: 'Online System' },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingTimeline, setTrackingTimeline] = useState([]);
  const [trackingTimelineLoading, setTrackingTimelineLoading] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pausePassword, setPausePassword] = useState('');
  const [pausing, setPausing] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRequestData, setReviewRequestData] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [expandedEditRequest, setExpandedEditRequest] = useState(null);
  const [inventorySearchResults, setInventorySearchResults] = useState({});
  const [inventorySearchLoading, setInventorySearchLoading] = useState(false);

  const [filterStage, setFilterStage] = useState('ALL');
  const [storeSubTab, setStoreSubTab] = useState('unseen');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState('');
  const [bulkRouting, setBulkRouting] = useState(false);

  const dashboardRefreshRef = useRef();
  const analyticsRefreshRef = useRef();
  const pauseRefreshRef = useRef();
  const unseenRefreshRef = useRef();
  const prodReturnedRefreshRef = useRef();
  const editRequestsRefreshRef = useRef();

  const { data: allOrders = [], loading: ordersLoading, error: ordersError, refresh: refreshDashboard } = useCache('admin:dashboard:orders', { fetcher: () => api.get('/api/orders').then(r => Array.isArray(r.data) ? r.data : []), ttl: 60000 });
  const { data: analytics, refresh: refreshAnalytics } = useCache('admin:dashboard:analytics', { fetcher: () => api.get('/api/orders/analytics').then(r => r.data), ttl: 60000 });
  const { data: systemPaused = false, refresh: refreshPause } = useCache('admin:pause-status', { fetcher: () => api.get('/api/admin/pause-status').then(r => r.data.paused), ttl: 300000 });
  const { data: storeUnseenData, refresh: refreshUnseen } = useCache('admin:store-unseen', { fetcher: () => api.get('/api/orders/unseen-tasks').then(r => r.data), ttl: 30000 });
  const { data: storeProductionData, refresh: refreshProdReturned } = useCache('admin:store-production', { fetcher: () => api.get('/api/orders/production-returned').then(r => r.data), ttl: 30000 });
  const { data: editRequestsData, loading: editRequestsLoading, refresh: refreshEditRequests } = useCache('admin:edit-requests', { fetcher: () => api.get('/api/edit-requests', { params: { status: 'PENDING' } }).then(r => Array.isArray(r.data) ? r.data : []), ttl: 30000 });
  const editRequests = Array.isArray(editRequestsData) ? editRequestsData : [];
  const stats = useMemo(() => ({
    totalOrders: allOrders.length,
    urgentOrders: allOrders.filter(o => o?.urgent).length,
    delayedOrders: 0,
    completedToday: allOrders.filter(o => o?.status === 'COMPLETED').length
  }), [allOrders]);

  const loading = ordersLoading;
  const fetchingError = !!ordersError;

  dashboardRefreshRef.current = refreshDashboard;
  analyticsRefreshRef.current = refreshAnalytics;
  pauseRefreshRef.current = refreshPause;
  unseenRefreshRef.current = refreshUnseen;
  prodReturnedRefreshRef.current = refreshProdReturned;
  editRequestsRefreshRef.current = refreshEditRequests;

  const queueRefreshRef = useRef();

  useEffect(() => {
    const onOrderUpdated = () => queueRefreshRef.current?.();
    const onNewOrder = (order) => {
      queueRefreshRef.current?.();
      toast.success(`New Order Received: #${order.orderNumber || order.id.substring(0, 8)}`, {
        icon: '🛍️',
        duration: 5000
      });
    };
    const onStageCompletionRequested = (data) => {
      queueRefreshRef.current?.();
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-gray-900 shadow-2xl rounded-[1.5rem] pointer-events-auto flex ring-1 ring-emerald-500/50 border border-emerald-500/20 p-4`}>
          <div className="flex-1 w-0 p-1">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ClipboardList size={16} />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-black text-white uppercase tracking-tight">New Approval Request</p>
                <p className="mt-1 text-xs text-gray-400 font-bold uppercase tracking-widest">
                  {data.stage?.stageName?.replace('_', ' ')} completed for Order #{data.orderId?.substring(0, 8)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ), { duration: 6000 });
    };
    const onPaymentUpdated = (data) => {
        queueRefreshRef.current?.();
        toast.success(`Order #${data.orderId?.substring(0, 8)}: Payment ${data.order.paymentStatus}`, { icon: '💰' });
    };
    const onStageRejected = () => { queueRefreshRef.current?.(); };

    socket.on('order-updated', onOrderUpdated);
    socket.on('new-order', onNewOrder);
    socket.on('stage-completion-requested', onStageCompletionRequested);
    socket.on('payment-updated', onPaymentUpdated);
    socket.on('stage-rejected', onStageRejected);
    socket.on('stage-accepted', () => queueRefreshRef.current?.());

    return () => {
      socket.off('order-updated', onOrderUpdated);
      socket.off('new-order', onNewOrder);
      socket.off('stage-completion-requested', onStageCompletionRequested);
      socket.off('payment-updated', onPaymentUpdated);
      socket.off('stage-rejected', onStageRejected);
      socket.off('stage-accepted');
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
      editRequestsRefreshRef.current?.();
    }
    socket.on('global-alert', () => {
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
        editRequestsRefreshRef.current?.();
      }
    });
    return () => {
      socket.off('global-alert');
    };
  }, []);

  useEffect(() => {
    if (!expandedEditRequest) return;
    const req = editRequests.find(r => r.id === expandedEditRequest);
    if (!req) return;
    let productTypes = [];
    try {
      const rc = req.requestedChanges;
      if (rc?.items && Array.isArray(rc.items)) {
        productTypes = [...new Set(rc.items.map(i => (i.productDetails?.productType || i.productType || '')).filter(Boolean))];
      } else if (rc?.productDetails) {
        const pd = typeof rc.productDetails === 'string' ? JSON.parse(rc.productDetails) : rc.productDetails;
        if (pd?.productType) productTypes = [pd.productType];
      }
    } catch {}
    if (productTypes.length === 0) return;
    const fetchInventoryForProducts = async () => {
      setInventorySearchLoading(true);
      const results = {};
      for (const name of productTypes) {
        try {
          const res = await api.get('/api/inventory/search', {
            params: { name }
          });
          results[name] = Array.isArray(res.data) ? res.data : [];
        } catch { results[name] = []; }
      }
      setInventorySearchResults(prev => ({ ...prev, ...results }));
      setInventorySearchLoading(false);
    };
    fetchInventoryForProducts();
  }, [expandedEditRequest, editRequests]);

  // Fetch timeline when tracking an order
  useEffect(() => {
    if (!trackedOrder?.id) { setTrackingTimeline([]); return; }
    setTrackingTimelineLoading(true);
    api.get(`/api/orders/${trackedOrder.id}/timeline`).then(res => setTrackingTimeline(res.data))
      .catch(() => setTrackingTimeline([]))
      .finally(() => setTrackingTimelineLoading(false));
  }, [trackedOrder?.id]);

  const handleApproveEditRequest = async () => {
    if (!reviewRequestData) return;
    setReviewSubmitting(true);
    try {
      await api.put(`/api/edit-requests/${reviewRequestData.id}/approve`,
        { adminRemarks: reviewRemarks }
      );
      setShowReviewModal(false);
      setReviewRequestData(null);
      setReviewRemarks('');
      editRequestsRefreshRef.current?.();
      dashboardRefreshRef.current?.();
      toast.success('Edit request approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve edit request');
    }
    setReviewSubmitting(false);
  };

  const handleRejectEditRequest = async () => {
    if (!reviewRequestData) return;
    setReviewSubmitting(true);
    try {
      await api.put(`/api/edit-requests/${reviewRequestData.id}/reject`,
        { adminRemarks: reviewRemarks }
      );
      setShowReviewModal(false);
      setReviewRequestData(null);
      setReviewRemarks('');
      editRequestsRefreshRef.current?.();
      toast.success('Edit request rejected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject edit request');
    }
    setReviewSubmitting(false);
  };

  const handleTogglePause = async (e) => {
    e.preventDefault();
    setPausing(true);
    try {
      const res = await api.post('/api/admin/pause',
        { password: pausePassword }
      );
      setShowPauseModal(false);
      setPausePassword('');
      toast.success(res.data.message);
      pauseRefreshRef.current?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle pause');
    }
    setPausing(false);
  };

  const handleDashboardSearch = (val) => {
    setContextSearch(val);
  };

  useEffect(() => {
    if (trackedOrder && allOrders.length > 0) {
      const updated = allOrders.find(o => o.id === trackedOrder.id);
      if (updated) setTrackedOrder(updated);
    }
  }, [allOrders, trackedOrder?.id]);

  const markAsSeen = async (orderId) => {
    try {
      await api.post(`/api/orders/${orderId}/mark-seen`);
      unseenRefreshRef.current?.();
      prodReturnedRefreshRef.current?.();
    } catch (error) {
      console.error('Error marking as seen:', error);
      alert(error.response?.data?.error || 'Failed to mark as seen');
    }
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      const endpoint = `/api/orders/${orderId}/stages/${stageId}/${action}`;
      await api.put(endpoint, payload);
      dashboardRefreshRef.current?.();
      analyticsRefreshRef.current?.();
      unseenRefreshRef.current?.();
      prodReturnedRefreshRef.current?.();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(error.response?.data?.message || 'Action failed');
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectAllOrders = (orders) => {
    if (selectedOrderIds.size > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.id)));
    }
  };

  const handleBulkRoute = async () => {
    if (!bulkDestination || selectedOrderIds.size === 0) return;
    setBulkRouting(true);
    try {
      await api.post('/api/orders/bulk-route', {
        orderIds: Array.from(selectedOrderIds),
        destinationStage: bulkDestination,
        remarks: `Bulk routed from ${filterStage}`
      });
      alert(`Routed ${selectedOrderIds.size} order(s) to ${bulkDestination.replace(/_/g, ' ')}`);
      setSelectedOrderIds(new Set());
      setBulkDestination('');
      dashboardRefreshRef.current?.();
      unseenRefreshRef.current?.();
      prodReturnedRefreshRef.current?.();
    } catch (err) {
      alert(err.response?.data?.message || 'Bulk route failed');
    } finally {
      setBulkRouting(false);
    }
  };

  const handleClearData = async (e) => {
    e.preventDefault();
    setIsClearing(true);
    setError('');
    
    try {
      await api.post('/api/admin/clear-data', 
        { password: adminPassword }
      );
      
      setShowClearModal(false);
      setAdminPassword('');
      alert('System data cleared successfully.');
      dashboardRefreshRef.current?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  const statCards = [
    { title: 'Total Active Orders', value: stats.totalOrders, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-400/10', path: '/orders' },
    { title: 'Urgent Priority', value: stats.urgentOrders, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', path: '/orders', state: { filterUrgent: true } },
    { title: 'Delayed Stages', value: stats.delayedOrders, icon: Clock, color: 'text-red-400', bg: 'bg-red-400/10', path: '/orders', state: { filterUrgent: true } },
    { title: 'Completed Today', value: stats.completedToday, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', path: '/orders', state: { filterStatus: 'COMPLETED' } },
  ];

  const deliverySetupQueue = useMemo(() => 
    allOrders.filter(o => {
      if (o.status === 'COMPLETED' || o.currentStage === 'COMPLETED') return false;
      const atDispatch = o.currentStage === 'DISPATCH' && o.status !== 'COMPLETED';
      if (!atDispatch) return false;
      const activeSearch = contextSearch;
      if (!activeSearch) return true;
      const search = activeSearch.toLowerCase();
      return o.id?.toLowerCase().includes(search) || 
             (o.orderNumber && o.orderNumber.toLowerCase().includes(search)) || 
             (o.customerName && o.customerName.toLowerCase().includes(search));
    }).sort((a, b) => {
      const pa = a.priority === 'SUPER_URGENT' ? 0 : a.priority === 'URGENT' ? 1 : 2;
      const pb = b.priority === 'SUPER_URGENT' ? 0 : b.priority === 'URGENT' ? 1 : 2;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt) - new Date(b.createdAt);
    })
  , [allOrders, contextSearch]);

  const initiationQueue = useMemo(() => 
    allOrders.filter(o => {
      const isPending = o.status === 'PENDING' || o.status === 'WAITING_PAYMENT';
      if (!isPending) return false;
      
      const activeSearch = contextSearch;
      if (!activeSearch) return true;
      const search = activeSearch.toLowerCase();
      return o.id?.toLowerCase().includes(search) || 
             (o.orderNumber && o.orderNumber.toLowerCase().includes(search)) || 
             (o.customerName && o.customerName.toLowerCase().includes(search));
    }).sort((a, b) => {
      const activeSearch = contextSearch?.toLowerCase();
      if (activeSearch) {
        const aMatch = o => o.orderNumber?.toLowerCase().includes(activeSearch) || o.id?.toLowerCase().includes(activeSearch);
        const bMatch = o => o.orderNumber?.toLowerCase().includes(activeSearch) || o.id?.toLowerCase().includes(activeSearch);
        if (aMatch(a) && !bMatch(b)) return -1;
        if (!aMatch(a) && bMatch(b)) return 1;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    })
  , [allOrders, contextSearch]);

  const refreshTimerRef = useRef(null);
  const queueRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      dashboardRefreshRef.current?.();
      analyticsRefreshRef.current?.();
      unseenRefreshRef.current?.();
      prodReturnedRefreshRef.current?.();
    }, 100);
  };
  queueRefreshRef.current = queueRefresh;

  const activeOrdersCount = useMemo(() => 
    allOrders.filter(o => o.status !== 'COMPLETED').length
  , [allOrders]);

  const getStageCount = useCallback((stageId) => {
    if (stageId === 'STORE') {
      return allOrders.filter(o => o.currentStage === 'STORE' && o.status !== 'COMPLETED').length;
    }
    return allOrders.filter(o => o.currentStage === stageId && o.status !== 'COMPLETED').length;
  }, [allOrders]);

  const filteredOrdersByStage = useMemo(() => {
    if (filterStage === 'ALL') return [];
    return allOrders.filter(o => o.currentStage === filterStage && o.status !== 'COMPLETED');
  }, [allOrders, filterStage]);

  const recentOrdersList = useMemo(() => {
    return [...allOrders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);
  }, [allOrders]);

  // Warehouse dashboard data
  const { data: warehouseInventory = [], loading: warehouseLoading } = useCache(
    activeTab === 'warehouse' ? 'admin:warehouse:inventory' : null,
    { fetcher: () => api.get('/api/inventory').then(r => r.data), ttl: 60000 }
  );
  const [warehouseAllocSummary, setWarehouseAllocSummary] = useState({ todayTotal: 0, activeTotal: 0, totalAllocated: 0 });
  const [warehouseRecentAllocs, setWarehouseRecentAllocs] = useState([]);
  const [warehousePendingCarts, setWarehousePendingCarts] = useState([]);

  useEffect(() => {
    if (activeTab !== 'warehouse') return;
    api.get('/api/inventory/allocations/stats').then(r => {
      const d = r.data;
      if (d.perPerson) setWarehouseAllocSummary({ todayTotal: d.todayTotal || 0, activeTotal: d.activeTotal || 0, totalAllocated: d.totalAllocated || 0 });
      else setWarehouseAllocSummary({ todayTotal: 0, activeTotal: 0, totalAllocated: 0 });
    }).catch(() => {});
    api.get('/api/inventory/allocations', { params: { page: 1, limit: 10 } }).then(r => setWarehouseRecentAllocs(r.data.records || [])).catch(() => {});
    api.get('/api/inventory/carts', { params: { status: 'PENDING', page: 1, limit: 10 } }).then(r => setWarehousePendingCarts(r.data.records || [])).catch(() => {});
  }, [activeTab]);

  const whTotalStock = warehouseInventory.reduce((s, i) => s + i.stock, 0);
  const whLowStock = warehouseInventory.filter(i => i.stock > 0 && i.stock <= 5);
  const whOutOfStock = warehouseInventory.filter(i => i.stock === 0);

  const handleWarehouseCartStatus = async (id, status) => {
    try {
      await api.patch(`/api/inventory/carts/${id}/status`, { status });
      toast.success(`Cart ${status.toLowerCase()} successfully`);
      const res = await api.get('/api/inventory/carts', { params: { status: 'PENDING', page: 1, limit: 10 } });
      setWarehousePendingCarts(res.data.records || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error updating cart');
    }
  };

  if (loading && allOrders.length === 0) {
    return <PageLoader text="Syncing Production Hub..." />;
  }

  if (fetchingError && allOrders.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-6 glass rounded-2xl md:rounded-[3rem] border-2 border-red-500/20">
        <AlertTriangle className="text-red-500" size={64} />
        <div className="text-center">
          <h2 className="text-2xl font-black theme-text-primary uppercase italic">Connection Fragmented</h2>
          <p className="theme-text-muted mt-2 font-bold">The production server is currently unreachable.</p>
        </div>
        <button 
          onClick={() => dashboardRefreshRef.current?.()}
          className="btn-solid-primary btn-lg"
        >
          Re-Initialize
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Control Center</h1>
          <p className="theme-text-secondary font-bold uppercase tracking-widest text-xs md:text-sm mt-1">Production Approval Hub</p>
        </div>
        <div className="flex items-center gap-4">
          {systemPaused && (
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 px-4 py-2.5 rounded-xl">
              <PauseCircle className="text-red-400" size={18} />
              <span className="text-red-400 font-black text-xs md:text-sm uppercase tracking-widest">System Paused</span>
            </div>
          )}
          {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (<>
          <button
            onClick={() => setShowPauseModal(true)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95 ${
              systemPaused
                ? 'bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20'
            }`}
          >
            {systemPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            <span>{systemPaused ? 'Resume System' : 'Pause System'}</span>
          </button>
          <button
            onClick={() => {
              alert('Notification Alert Broadcasted!');
            }}
            className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500 hover:text-white text-yellow-500 border border-yellow-500/20 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95"
          >
            <BellRing size={16} />
            <span>Send Alert</span>
          </button>
          </>) : null}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => stat.path && navigate(stat.path, { state: stat.state })}
            className="glass p-6 rounded-[1.5rem] theme-border hover:border-blue-500/50 hover:scale-[1.02] transition-all group cursor-pointer active:scale-95"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={stat.color} size={22} />
              </div>
              <span className="flex items-center text-emerald-400 text-xs md:text-sm font-black bg-emerald-400/10 px-2 py-1 rounded-full uppercase tracking-widest">
                <ArrowUpRight size={10} className="mr-1" />
                Live
              </span>
            </div>
            <h3 className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-[0.2em]">{stat.title}</h3>
            <p className="text-xl md:text-3xl font-black theme-text-primary mt-1 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search Bar (compact, always visible) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search order by number or customer..."
            value={contextSearch}
            onChange={(e) => handleDashboardSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const query = contextSearch.trim().toLowerCase();
                const found = allOrders.find(o => 
                  o.orderNumber?.toLowerCase().includes(query) || 
                  o.id?.toLowerCase().includes(query) ||
                  o.customerName?.toLowerCase().includes(query)
                );
                if (found) {
                  setTrackedOrder(found);
                  setTrackingError('');
                } else {
                  setTrackedOrder(null);
                  setTrackingError('No order found.');
                }
              }
            }}
            className="w-full theme-input rounded-xl py-3 pl-12 pr-4 text-sm font-bold"
          />
        </div>
        <button
          onClick={() => {
            const query = contextSearch.trim().toLowerCase();
            if (!query) return;
            const found = allOrders.find(o => 
              o.orderNumber?.toLowerCase().includes(query) || 
              o.id?.toLowerCase().includes(query) ||
              o.customerName?.toLowerCase().includes(query)
            );
            if (found) {
              setTrackedOrder(found);
              setTrackingError('');
            } else {
              setTrackedOrder(null);
              setTrackingError('No order found with that ID or Name.');
            }
          }}
          className="btn-solid-primary px-5 py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest"
        >
          Track
        </button>
        {trackedOrder && (
          <button onClick={() => { setTrackedOrder(null); setTrackingError(''); }} className="text-gray-500 hover:text-white text-xs md:text-sm font-black uppercase tracking-widest">
            Clear
          </button>
        )}
      </div>

      {/* Tracked Order Result — Full Timeline */}
      <AnimatePresence mode="wait">
        {trackingError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-4 bg-red-500/5 rounded-2xl border border-red-500/10 text-red-400 font-bold text-xs md:text-sm"
          >
            {trackingError}
          </motion.div>
        )}

        {trackedOrder && (
          <motion.div
            key={trackedOrder.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="theme-bg rounded-2xl p-4 md:p-6 theme-border"
          >
            {/* Order Header */}
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg md:text-xl shadow-xl">
                  {trackedOrder.customerName?.charAt(0) || '?'}
                </div>
                <div>
                  <h4 className="text-base md:text-lg font-black theme-text-primary">{trackedOrder.customerName}</h4>
                  <p className="theme-text-muted font-bold uppercase tracking-widest text-[10px] md:text-xs">Order #{trackedOrder.orderNumber || trackedOrder.id.substring(0, 8)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border ${
                  trackedOrder.priority === 'SUPER_URGENT' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  trackedOrder.priority === 'URGENT' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-gray-500/10 text-gray-400 border-gray-500/20'
                }`}>{trackedOrder.priority || 'NORMAL'}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border ${
                  trackedOrder.paymentStatus === 'PAID' || trackedOrder.paymentStatus === 'FULL_PAID' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  parseFloat(trackedOrder.advanceAmount || 0) > 0 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>{trackedOrder.paymentStatus === 'PAID' || trackedOrder.paymentStatus === 'FULL_PAID' ? 'PAID' : parseFloat(trackedOrder.advanceAmount || 0) > 0 ? 'ADVANCE' : 'COD'}</span>
                <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border border-blue-500/20">
                  {trackedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Progress Pipeline */}
            {(() => {
              const stages = ['ORDER_ENTRY','STORE','LOGO_DESIGN','PRODUCTION_ACCEPTANCE','PRODUCTION','STORE_RECEIVE','DISPATCH','OUT_FOR_DELIVERY','DELIVERED'];
              const currentIdx = stages.indexOf(trackedOrder.currentStage);
              return (
                <div className="mb-4 overflow-x-auto no-scrollbar">
                  <div className="flex gap-1 min-w-max">
                    {stages.map((s, i) => {
                      const isPast = i < currentIdx;
                      const isCurrent = i === currentIdx;
                      const isFuture = i > currentIdx;
                      return (
                        <div key={s} className="flex items-center gap-1">
                          <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider whitespace-nowrap ${
                            isPast ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            isCurrent ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 ring-2 ring-blue-500/40' :
                            'bg-gray-800/50 text-gray-600 border border-gray-800'
                          }`}>
                            {isPast && <CheckCircle2 size={10} className="inline mr-1 -mt-0.5" />}
                            {s.replace(/_/g, ' ')}
                          </div>
                          {i < stages.length - 1 && (
                            <div className={`w-3 h-[2px] ${i < currentIdx ? 'bg-emerald-500/40' : 'bg-gray-800'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Full Timeline Entries */}
            {trackingTimelineLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
            ) : trackingTimeline.length === 0 ? (
              <div className="text-center py-8 text-gray-500 font-black uppercase tracking-widest text-xs">Loading timeline...</div>
            ) : (
              <div className="space-y-1 mb-4">
                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Stage Timeline</h5>
                {trackingTimeline
                  .filter(e => e.type === 'stage')
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                  .map((entry, idx, arr) => {
                    const dotColor = entry.status === 'COMPLETED' ? 'bg-emerald-500' : entry.acceptedAt ? 'bg-blue-500' : 'bg-gray-500';
                    const delay = entry.delay;
                    const fmt = (d) => d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
                    return (
                      <div key={entry.id || idx} className="relative pl-8 pb-3">
                        {idx < arr.length - 1 && <div className="absolute left-[11px] top-3 bottom-0 w-[2px] bg-gray-800" />}
                        <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 border-gray-900 flex items-center justify-center ${dotColor}`}>
                          {entry.status === 'COMPLETED' ? <CheckCircle2 size={12} className="text-white" /> : entry.acceptedAt ? <Circle size={8} className="text-white fill-current" /> : <Circle size={8} className="text-white" />}
                        </div>
                        <div className="p-2.5 rounded-xl border border-gray-800 bg-gray-950/50">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className={`text-[11px] font-black uppercase tracking-wider ${entry.status === 'COMPLETED' ? 'text-emerald-400' : entry.acceptedAt ? 'text-blue-400' : 'text-gray-400'}`}>
                              {entry.stage.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              entry.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/10' :
                              entry.acceptedAt ? 'text-blue-400 bg-blue-500/10' :
                              'text-gray-500 bg-gray-800/50'
                            }`}>{entry.status.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-gray-500 font-medium">
                            <span>Received: {fmt(entry.receivedAt)}</span>
                            {entry.acceptedAt && <span>Accepted: {fmt(entry.acceptedAt)}</span>}
                            {entry.completedAt && <span>Completed: {fmt(entry.completedAt)}</span>}
                            {delay !== null && (
                              <span className={delay > 60 ? 'text-red-400' : delay > 0 ? 'text-yellow-400' : 'text-gray-600'}>
                                Delay: {delay} min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Route transitions */}
            {trackingTimeline.filter(e => e.type === 'route').length > 0 && (
              <div className="mb-4">
                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Routing History</h5>
                <div className="space-y-1">
                  {trackingTimeline
                    .filter(e => e.type === 'route')
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map((entry, idx) => (
                      <div key={entry.id || idx} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <Truck size={12} className="text-amber-400 shrink-0" />
                        <span className="text-[10px] font-bold text-amber-400">{entry.from?.replace(/_/g, ' ')} → {entry.to?.replace(/_/g, ' ')}</span>
                        <span className="text-[9px] text-gray-600">{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {entry.actor && <span className="text-[9px] text-gray-700 ml-auto">by {entry.actor}</span>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Products Summary */}
            {(() => {
              try {
                const pd = typeof trackedOrder.productDetails === 'string' ? JSON.parse(trackedOrder.productDetails) : trackedOrder.productDetails;
                const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
                if (items.length === 0) return null;
                return (
                  <div className="mb-4">
                    <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Products</h5>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package size={12} className="text-purple-400 shrink-0" />
                            <span className="text-[10px] font-bold text-white truncate">{item.productType || 'Item'} — {item.fabricType || 'STD'} / {item.color || '—'} / {item.size || '—'}</span>
                          </div>
                          <span className="text-[10px] font-black text-gray-400 shrink-0 ml-2">x{item.quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Customer Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Phone</p>
                <p className="text-[10px] font-bold text-white">{trackedOrder.customerPhone || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">City</p>
                <p className="text-[10px] font-bold text-white">{trackedOrder.city || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Source</p>
                <p className="text-[10px] font-bold text-white">{trackedOrder.source || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Total</p>
                <p className="text-[10px] font-bold text-white">₨{parseFloat(trackedOrder.totalPrice || 0).toLocaleString()}</p>
              </div>
            </div>
            {trackedOrder.address && (
              <div className="p-2 rounded-lg bg-gray-900/50 border border-gray-800 mb-4">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Address</p>
                <p className="text-[10px] font-bold text-white">{trackedOrder.address}</p>
              </div>
            )}

            <button
              onClick={() => navigate('/orders', { state: { searchTerm: trackedOrder.orderNumber } })}
              className="w-full btn-ghost py-2.5 text-[10px] md:text-xs"
            >
              View Full Detailed Job Sheet →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Bar */}
      <div className="theme-bg-subtle p-2 rounded-[2rem] theme-border overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {TOP_TABS.map((tab) => {
            const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
            if ((tab.id === 'edit_requests' || tab.id === 'warehouse' || tab.id === 'settings') && !isAdmin) return null;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(prev => prev === tab.id ? null : tab.id);
                  if (tab.id === 'all_phases') setFilterStage('ALL');
                  if (tab.id === 'edit_requests') editRequestsRefreshRef.current?.();
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.id === 'edit_requests' && editRequests.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black">{editRequests.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* All Phases Tab — Pipeline Sub-Tabs */}
            {activeTab === 'all_phases' && (
              <>
                {/* Pipeline Sub-Tab Bar */}
                <div className="theme-bg-subtle p-2 rounded-[2rem] theme-border overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-1.5 min-w-max">
                    <button
                      onClick={() => setFilterStage('ALL')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all ${
                        filterStage === 'ALL'
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      <LayoutDashboard size={13} />
                      All ({activeOrdersCount})
                    </button>
                    {PIPELINE_STAGES.map((stage) => {
                      const count = getStageCount(stage.id);
                      return (
                        <button
                          key={stage.id}
                          onClick={() => setFilterStage(stage.id)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            filterStage === stage.id
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                          }`}
                        >
                          <stage.icon size={13} />
                          {stage.label}
                          <span className="ml-0.5 px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px] font-black">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pipeline Stage Content */}
                {filterStage === 'STORE' ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl">
                          <Package className="text-blue-400" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Store</h2>
                          <p className="theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest">Orders currently in Store phase</p>
                        </div>
                      </div>
                      <button onClick={() => setFilterStage('ALL')} className="theme-text-muted hover:text-white transition-colors text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <X size={14} /> Close
                      </button>
                    </div>

                    {/* Order counts */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(() => {
                        const storeOrders = allOrders.filter(o => o.currentStage === 'STORE');
                        const total = storeOrders.length;
                        const pending = storeOrders.filter(o => o.status === 'PENDING').length;
                        const inProgress = storeOrders.filter(o => o.status === 'IN_PROGRESS').length;
                        const completed = storeOrders.filter(o => o.status === 'COMPLETED').length;
                        return (
                          <>
                            <div className="theme-bg border theme-border rounded-2xl p-4 text-center">
                              <p className="text-2xl font-black text-blue-400">{total}</p>
                              <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">Total</p>
                            </div>
                            <div className="theme-bg border theme-border rounded-2xl p-4 text-center">
                              <p className="text-2xl font-black text-amber-400">{pending}</p>
                              <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">Pending</p>
                            </div>
                            <div className="theme-bg border theme-border rounded-2xl p-4 text-center">
                              <p className="text-2xl font-black text-emerald-400">{inProgress}</p>
                              <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">In Progress</p>
                            </div>
                            <div className="theme-bg border theme-border rounded-2xl p-4 text-center">
                              <p className="text-2xl font-black text-gray-400">{completed}</p>
                              <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">Completed</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Orders list */}
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                        {allOrders.filter(o => o.currentStage === 'STORE').length > 0 ? (
                          allOrders.filter(o => o.currentStage === 'STORE').map(order => (
                            <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                          ))
                        ) : (
                          <div className="col-span-full py-6 md:py-20 text-center glass rounded-2xl md:rounded-[3rem] theme-border">
                            <Package className="mx-auto theme-text-muted mb-4" size={48} />
                            <h3 className="theme-text-muted font-black uppercase">No orders in Store</h3>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : filterStage === 'DISPATCH' ? (
                  <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-amber-500/10 rounded-2xl">
                          <ClipboardList className="text-amber-400" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Delivery Setup</h2>
                          <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Orders at Dispatch awaiting delivery configuration</p>
                        </div>
                      </div>
                      <div className="relative w-full md:w-auto min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                          type="text"
                          placeholder="Search by ID or Name..."
                          value={contextSearch}
                          onChange={(e) => handleDashboardSearch(e.target.value)}
                          className="w-full theme-input rounded-xl py-3 pl-12 pr-4 text-sm font-bold"
                        />
                      </div>
                    </div>
                    {deliverySetupQueue.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                        {deliverySetupQueue.map(order => (
                          <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                        ))}
                      </div>
                    ) : (
                      <div className="glass p-4 md:p-16 rounded-2xl md:rounded-[3rem] border border-gray-800 text-center space-y-4">
                        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto border-2 border-gray-800">
                          <CheckCircle2 className="text-gray-700" size={40} />
                        </div>
                        <h3 className="text-xl font-black text-gray-500 uppercase">All delivered</h3>
                        <p className="text-gray-600 text-sm font-bold max-w-xs mx-auto uppercase tracking-widest">No orders pending delivery configuration.</p>
                      </div>
                    )}
                  </section>
                ) : filterStage !== 'ALL' ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl">
                          <Package className="text-blue-400" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">{filterStage.replace(/_/g, ' ')} Orders</h2>
                          <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Active orders in this phase</p>
                        </div>
                      </div>
                      <button onClick={() => setFilterStage('ALL')} className="theme-text-muted hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <X size={14} /> Close
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                      {filteredOrdersByStage.length > 0 ? (
                        filteredOrdersByStage.map(order => (
                          <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                        ))
                      ) : (
                        <div className="col-span-full py-6 md:py-20 text-center glass rounded-2xl md:rounded-[3rem] theme-border">
                          <Package className="mx-auto theme-text-muted mb-4" size={48} />
                          <h3 className="theme-text-muted font-black uppercase">No orders in this phase</h3>
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  /* All — Show Initiation Queue + all pipeline stages grouped */
                  <div className="space-y-10">
                    {/* Initiation Queue */}
                    {initiationQueue.length > 0 && (
                      <section className="mb-6 md:mb-12">
                        <div className="flex items-center space-x-4 mb-8">
                          <div className="p-3 bg-blue-500/10 rounded-2xl">
                            <Sparkles className="text-blue-400" size={20} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Initiation Queue</h2>
                            <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">New orders waiting to start production</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                          {initiationQueue.map(order => (
                            <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                          ))}
                        </div>
                      </section>
                    )}
                    {/* Each Pipeline Stage */}
                    {PIPELINE_STAGES.map(stage => {
                      const stageOrders = allOrders.filter(o => o.currentStage === stage.id && o.status !== 'COMPLETED');
                      if (stageOrders.length === 0) return null;
                      return (
                        <section key={stage.id}>
                          <div className="flex items-center space-x-4 mb-6">
                            <div className="p-3 bg-blue-500/10 rounded-2xl">
                              <stage.icon className="text-blue-400" size={20} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">{stage.label}</h2>
                                <button
                                  onClick={() => setFilterStage(stage.id)}
                                  className="text-xs font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-all px-3 py-1 rounded-lg hover:bg-blue-500/10"
                                >
                                  View All ({stageOrders.length})
                                </button>
                              </div>
                              <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Active orders in {stage.label}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                            {stageOrders.map(order => (
                              <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                    {/* Empty state when no orders at all */}
                    {initiationQueue.length === 0 && allOrders.filter(o => o.status !== 'COMPLETED').length === 0 && (
                      <div className="py-16 text-center glass rounded-2xl md:rounded-[3rem] theme-border">
                        <Package className="mx-auto theme-text-muted mb-4" size={48} />
                        <h3 className="theme-text-muted font-black uppercase">No active orders</h3>
                        <p className="text-gray-600 text-xs font-bold mt-2">All orders have been completed</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Warehouse Tab */}
            {activeTab === 'warehouse' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl">
                    <Warehouse className="text-amber-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Warehouse</h2>
                    <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Inventory & Allocation Overview</p>
                  </div>
                </div>

                {warehouseLoading ? (
                  <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-blue-400" size={32} /></div>
                ) : (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="glass p-5 rounded-2xl border-2 theme-border">
                        <div className="flex items-center justify-between mb-2">
                          <Package className="text-blue-400" size={20} />
                          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Total</span>
                        </div>
                        <p className="text-3xl font-black theme-text-primary">{whTotalStock}</p>
                        <p className="text-xs font-bold theme-text-muted mt-1">Units in Stock</p>
                      </div>
                      <div className="glass p-5 rounded-2xl border-2 theme-border">
                        <div className="flex items-center justify-between mb-2">
                          <AlertTriangle className="text-red-400" size={20} />
                          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Low</span>
                        </div>
                        <p className="text-3xl font-black text-red-400">{whLowStock.length}</p>
                        <p className="text-xs font-bold theme-text-muted mt-1">Low Stock Items</p>
                      </div>
                      <div className="glass p-5 rounded-2xl border-2 theme-border">
                        <div className="flex items-center justify-between mb-2">
                          <XCircle className="text-gray-400" size={20} />
                          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Out</span>
                        </div>
                        <p className="text-3xl font-black text-gray-400">{whOutOfStock.length}</p>
                        <p className="text-xs font-bold theme-text-muted mt-1">Out of Stock</p>
                      </div>
                      <div className="glass p-5 rounded-2xl border-2 theme-border">
                        <div className="flex items-center justify-between mb-2">
                          <Gift className="text-amber-400" size={20} />
                          <span className="text-xs font-black theme-text-muted uppercase tracking-widest">Today</span>
                        </div>
                        <p className="text-3xl font-black text-amber-400">{warehouseAllocSummary.todayTotal}</p>
                        <p className="text-xs font-bold theme-text-muted mt-1">Today's Allocations</p>
                      </div>
                    </div>

                    {/* Low Stock Alert */}
                    {whLowStock.length > 0 && (
                      <div className="glass p-5 rounded-2xl border-2 border-red-500/20">
                        <div className="flex items-center space-x-3 mb-4">
                          <AlertTriangle className="text-red-400" size={18} />
                          <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm">Low Stock Alert</h3>
                        </div>
                        <div className="space-y-2">
                          {whLowStock.slice(0, 5).map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                              <div>
                                <p className="font-bold theme-text-primary text-sm">{item.name}</p>
                                <p className="text-xs theme-text-muted font-bold uppercase">{item.category}</p>
                              </div>
                              <p className="font-black text-red-400">{item.stock}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allocation Summary */}
                    <div className="glass p-5 rounded-2xl border-2 theme-border">
                      <div className="flex items-center space-x-3 mb-4">
                        <Gift className="text-amber-400" size={18} />
                        <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm">Allocation Summary</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                          <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Active</p>
                          <p className="text-xl font-black text-amber-400 mt-1">{warehouseAllocSummary.activeTotal}</p>
                        </div>
                        <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                          <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Total Allocated</p>
                          <p className="text-xl font-black text-emerald-400 mt-1">{warehouseAllocSummary.totalAllocated}</p>
                        </div>
                        <div className="p-3 theme-bg-subtle rounded-xl border theme-border">
                          <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Pending Carts</p>
                          <p className="text-xl font-black text-yellow-400 mt-1">{warehousePendingCarts.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Recent Allocations */}
                    <div className="glass p-5 rounded-2xl border-2 theme-border">
                      <div className="flex items-center space-x-3 mb-4">
                        <FileText className="text-amber-400" size={18} />
                        <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm">Recent Allocations</h3>
                      </div>
                      {warehouseRecentAllocs.length === 0 ? (
                        <p className="text-xs theme-text-muted font-bold text-center py-6">No allocation records</p>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {warehouseRecentAllocs.map(rec => (
                            <div key={rec.id} className="flex items-center justify-between p-3 theme-bg-subtle rounded-xl border theme-border">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold theme-text-primary text-xs">{rec.personName}</p>
                                <p className="text-[10px] theme-text-muted">{new Date(rec.createdAt).toLocaleString()}</p>
                              </div>
                              <p className="font-black text-amber-400 text-xs shrink-0 ml-3">{rec.totalQuantity || 0} qty</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pending Carts */}
                    {warehousePendingCarts.length > 0 && (
                      <div className="glass p-5 rounded-2xl border-2 border-yellow-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <ShoppingCart className="text-yellow-400" size={18} />
                            <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm">Pending Carts</h3>
                          </div>
                          <span className="text-xs font-bold text-yellow-400">{warehousePendingCarts.length} awaiting approval</span>
                        </div>
                        <div className="space-y-3">
                          {warehousePendingCarts.map(cart => (
                            <div key={cart.id} className="flex items-center justify-between p-3 theme-bg-subtle rounded-xl border border-yellow-500/20">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold theme-text-primary text-xs">{cart.personName}</p>
                                <p className="text-[10px] theme-text-muted">{cart.totalItems} products · {cart.totalQuantity} qty</p>
                              </div>
                              <div className="flex space-x-2 shrink-0 ml-4">
                                <button onClick={() => handleWarehouseCartStatus(cart.id, 'APPROVED')}
                                  className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center space-x-1">
                                  <CheckCircle size={12} />
                                  <span>Approve</span>
                                </button>
                                <button onClick={() => handleWarehouseCartStatus(cart.id, 'REJECTED')}
                                  className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center space-x-1">
                                  <XCircle size={12} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Order Change Requests Tab */}
            {activeTab === 'edit_requests' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                      <FileEdit className="text-amber-400" size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Order Change Requests</h2>
                      <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-0.5">
                        {editRequests.length} pending request{editRequests.length !== 1 ? 's' : ''} — Auto-refreshing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                    <button onClick={() => editRequestsRefreshRef.current?.()} className="btn-ghost btn-sm">
                      <RotateCcw size={14} /> Refresh
                    </button>
                  </div>
                </div>

                {editRequestsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-amber-500" size={28} />
                  </div>
                ) : editRequests.length === 0 ? (
                  <div className="glass rounded-2xl md:rounded-[2rem] p-8 md:p-12 border theme-border text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto border-2 border-gray-800">
                      <CheckCircle2 className="text-gray-700" size={32} />
                    </div>
                    <h3 className="text-lg font-black text-gray-500 uppercase">No Pending Requests</h3>
                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">All order change requests have been processed.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {editRequests.map((req) => {
                      const order = req.order || {};
                      const source = req.requestedBy?.role === 'FAISAL' ? 'ONLINE ORDER' : order.outletName || req.requestedBy?.name || 'Unknown';
                      const isExpanded = expandedEditRequest === req.id;

                      let currentProducts = [];
                      try {
                        const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                        if (Array.isArray(pd)) {
                          currentProducts = pd.map(item => {
                            const d = item.productDetails || item;
                            return { name: d.productType || '', color: d.color || '', size: d.size || '', qty: item.quantity || 1 };
                          });
                        } else if (pd?.productType) {
                          currentProducts = [{ name: pd.productType, color: pd.color || '', size: pd.size || '', qty: order.quantity || 1 }];
                        }
                      } catch { currentProducts = []; }

                      let requestedProducts = [];
                      try {
                        const rc = req.requestedChanges;
                        if (rc?.items && Array.isArray(rc.items)) {
                          requestedProducts = rc.items.map(item => {
                            const d = item.productDetails || item;
                            return { name: d.productType || '', color: d.color || '', size: d.size || '', qty: item.quantity || 1 };
                          });
                        } else if (rc?.productDetails) {
                          const pd = typeof rc.productDetails === 'string' ? JSON.parse(rc.productDetails) : rc.productDetails;
                          if (pd?.productType) {
                            requestedProducts = [{ name: pd.productType, color: pd.color || '', size: pd.size || '', qty: rc.quantity || 1 }];
                          }
                        }
                      } catch { requestedProducts = []; }

                      return (
                        <motion.div
                          key={req.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`glass rounded-2xl border transition-all cursor-pointer ${
                            isExpanded ? 'border-amber-500/40 shadow-lg shadow-amber-900/20' : 'theme-border hover:border-amber-500/30'
                          }`}
                        >
                          <div
                            onClick={() => setExpandedEditRequest(isExpanded ? null : req.id)}
                            className="p-5"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-black text-sm">
                                  <FileEdit size={16} />
                                </div>
                                <div>
                                  <p className="text-sm font-black theme-text-primary">#{order.orderNumber || order.id?.substring(0, 8) || 'N/A'}</p>
                                  <p className="text-xs md:text-sm theme-text-muted font-bold">{order.customerName || 'Unknown'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-black uppercase tracking-wider">
                                  {req.status}
                                </span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-600">
                                  <ChevronDown size={14} />
                                </motion.div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs md:text-sm font-bold theme-text-muted">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${source === 'ONLINE ORDER' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                {source}
                              </span>
                              <span className="text-gray-700">|</span>
                              <span>{new Date(req.requestedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-5 border-t theme-border pt-4 space-y-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="theme-bg rounded-xl p-3 border border-red-500/20">
                                      <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-red-400" /> Old Item(s)
                                      </p>
                                      {currentProducts.length > 0 ? currentProducts.map((p, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-red-500/10 last:border-0">
                                          <span className="text-xs md:text-sm font-black text-red-400 w-4">{i + 1}.</span>
                                          <div>
                                            <p className="text-xs font-bold theme-text-primary">{p.name}</p>
                                            {(p.color || p.size) && (
                                              <p className="text-xs font-medium theme-text-muted">
                                                {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )) : <p className="text-xs theme-text-muted italic">No items</p>}
                                    </div>

                                    <div className="theme-bg rounded-xl p-3 border border-emerald-500/20">
                                      <p className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-emerald-400" /> New Item(s)
                                      </p>
                                      {requestedProducts.length > 0 ? requestedProducts.map((p, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-emerald-500/10 last:border-0">
                                          <span className="text-xs md:text-sm font-black text-emerald-400 w-4">{i + 1}.</span>
                                          <div>
                                            <p className="text-xs font-bold theme-text-primary">{p.name}</p>
                                            {(p.color || p.size) && (
                                              <p className="text-xs font-medium theme-text-muted">
                                                {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )) : <p className="text-xs theme-text-muted italic">No items</p>}
                                    </div>
                                  </div>

                                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                                    <p className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <RotateCcw size={10} /> Inventory Impact
                                    </p>
                                    <div className="space-y-1">
                                      {currentProducts.map((p, i) => (
                                        <p key={i} className="text-xs font-bold text-green-400">
                                          +{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} returned to stock
                                        </p>
                                      ))}
                                      {requestedProducts.map((p, i) => (
                                        <p key={i} className="text-xs font-bold text-red-400">
                                          -{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} deducted from stock
                                        </p>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
                                    <p className="text-xs font-black text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Package size={10} /> Inventory Availability
                                    </p>
                                    {inventorySearchLoading ? (
                                      <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="animate-spin text-indigo-400" size={12} />
                                        <span className="text-xs font-bold theme-text-muted">Checking inventory...</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {requestedProducts.map((p, i) => {
                                          const items = inventorySearchResults[p.name] || [];
                                          return (
                                            <div key={i} className="theme-bg rounded-lg p-2 border theme-border">
                                              <p className="text-xs font-black theme-text-primary mb-1.5 uppercase tracking-wider">{p.name}</p>
                                              {items.length === 0 ? (
                                                <p className="text-xs font-bold text-red-400 italic">No inventory records found</p>
                                              ) : (
                                                items.map((item, idx) => {
                                                  const v = item.variants && Array.isArray(item.variants) ? item.variants : [{ color: item.color || 'Default', size: item.size || 'Default', stock: item.stock || 0 }];
                                                  return (
                                                    <div key={idx} className="mb-1 last:mb-0">
                                                      {v.length === 1 && !item.variants ? (
                                                        <div className="flex items-center justify-between py-1">
                                                          <span className="text-xs font-medium theme-text-secondary">
                                                            {[v[0].color, v[0].size].filter(Boolean).join(' / ')}
                                                          </span>
                                                          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
                                                            v[0].stock === 0 ? 'bg-red-500/15 text-red-400' :
                                                            v[0].stock <= 5 ? 'bg-amber-500/15 text-amber-400' :
                                                            'bg-emerald-500/15 text-emerald-400'
                                                          }`}>
                                                            {v[0].stock} in stock
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <div className="space-y-0.5">
                                                          {v.map((variant, vi) => (
                                                            <div key={vi} className="flex items-center justify-between py-0.5">
                                                              <span className="text-[9px] font-medium theme-text-secondary">
                                                                {[variant.color, variant.size].filter(Boolean).join(' / ')}
                                                              </span>
                                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                                (variant.stock || 0) === 0 ? 'bg-red-500/15 text-red-400' :
                                                                (variant.stock || 0) <= 5 ? 'bg-amber-500/15 text-amber-400' :
                                                                'bg-emerald-500/15 text-emerald-400'
                                                              }`}>
                                                                {variant.stock || 0} in stock
                                                              </span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {req.reason && (
                                    <div className="theme-bg rounded-xl p-3 border theme-border">
                                      <p className="text-xs font-black theme-text-muted uppercase tracking-wider mb-1">Reason</p>
                                      <p className="text-xs md:text-sm font-medium italic theme-text-secondary">"{req.reason}"</p>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-xs font-bold theme-text-muted">
                                    <span>Requested by: {req.requestedBy?.name || 'Unknown'} ({req.requestedBy?.role || '?'})</span>
                                    <span>{new Date(req.requestedAt).toLocaleString()}</span>
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      onClick={() => { setReviewRequestData(req); setReviewAction('approve'); setReviewRemarks(''); setShowReviewModal(true); }}
                                      className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                                    >
                                      <ThumbsUp size={13} /> Approve
                                    </button>
                                    <button
                                      onClick={() => { setReviewRequestData(req); setReviewAction('reject'); setReviewRemarks(''); setShowReviewModal(true); }}
                                      className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
                                    >
                                      <ThumbsDown size={13} /> Reject
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Recent Orders Tab */}
            {activeTab === 'recent_orders' && (
              <section>
                <div className="flex items-center space-x-4 mb-6">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <History className="text-indigo-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Recent Orders</h2>
                    <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Latest 20 orders</p>
                  </div>
                </div>
                <div className="glass rounded-2xl p-5 border theme-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                          <th className="py-3 pr-4">Order</th>
                          <th className="py-3 pr-4">Customer</th>
                          <th className="py-3 pr-4">Source</th>
                          <th className="py-3 pr-4">Stage</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3 pr-4 text-right">Amount</th>
                          <th className="py-3 pr-4 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrdersList.map(o => (
                          <tr key={o.id} className="border-b border-gray-800/50 text-sm hover:bg-gray-800/20 cursor-pointer" onClick={() => {
                            setTrackedOrder(o);
                            setActiveTab(null);
                          }}>
                            <td className="py-3 pr-4 font-bold text-white">#{o.orderNumber || o.id.substring(0, 6)}</td>
                            <td className="py-3 pr-4 text-gray-300">{o.customerName}</td>
                            <td className="py-3 pr-4 text-gray-400 text-xs md:text-sm">{o.outletName || o.source || '—'}</td>
                            <td className="py-3 pr-4 text-gray-400 text-xs md:text-sm font-bold uppercase">{o.currentStage?.replace(/_/g, ' ')}</td>
                            <td className="py-3 pr-4">
                              <span className={`text-xs md:text-sm font-black px-2 py-1 rounded ${
                                o.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                o.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                                o.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>{o.status}</span>
                              {(() => {
                                const _p = o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID';
                                const _a = parseFloat(o.advanceAmount || 0) > 0;
                                const _r = Math.max(0, (o.totalPrice || 0) - parseFloat(o.advanceAmount || 0));
                                if (_p) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">PAID</span>;
                                if (_a) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-orange-500/20 text-orange-400">REMAINING COD</span>;
                                return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-red-500/20 text-red-400">COD</span>;
                              })()}
                            </td>
                            <td className="py-3 pr-4 text-right font-bold text-white">₨{o.totalPrice || 0}</td>
                            <td className="py-3 pr-4 text-right font-bold text-gray-400 text-xs md:text-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}


          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Settings */}
      {activeTab === 'settings' && <AdminSettings />}

      {/* Pause Modal */}
      <AnimatePresence>
        {showPauseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${systemPaused ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {systemPaused ? <PlayCircle className="text-emerald-400" size={28} /> : <PauseCircle className="text-red-400" size={28} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{systemPaused ? 'Resume System' : 'Pause System'}</h2>
                  <p className="text-gray-400 text-sm font-bold">{systemPaused ? 'Reactivate all production operations.' : 'Stop all production operations for holidays.'}</p>
                </div>
              </div>
              <form onSubmit={handleTogglePause} className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Confirm Password</label>
                  <input type="password" value={pausePassword} onChange={(e) => setPausePassword(e.target.value)}
                    className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-red-500 outline-none font-black text-lg text-white mt-2"
                    placeholder="Enter your password" required />
                </div>
                <p className="text-xs text-gray-500 font-bold">Enter your admin password to {systemPaused ? 'resume' : 'pause'} the system.</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => { setShowPauseModal(false); setPausePassword(''); }}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                  <button type="submit" disabled={pausing || !pausePassword}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                      systemPaused ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'
                    } disabled:opacity-50`}>
                    {pausing ? <Loader2 className="animate-spin" size={16} /> : systemPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                    <span>{pausing ? 'Processing...' : systemPaused ? 'Resume System' : 'Pause System'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Edit Request Modal */}
      <AnimatePresence>
        {showReviewModal && reviewRequestData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${reviewAction === 'approve' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {reviewAction === 'approve' ? <ThumbsUp className="text-emerald-400" size={24} /> : <ThumbsDown className="text-red-400" size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{reviewAction === 'approve' ? 'Approve Edit' : 'Reject Edit'}</h2>
                  <p className="text-gray-400 text-xs font-bold">Order #{reviewRequestData.order?.orderNumber || reviewRequestData.orderId?.substring(0, 8)}</p>
                </div>
              </div>

              {reviewAction === 'approve' && (
                <div className="theme-bg rounded-xl p-4 border theme-border mb-4">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">⚠ Inventory will auto-adjust</p>
                  <p className="text-xs md:text-sm font-medium theme-text-muted">The system will automatically restore stock for removed products and deduct stock for new products.</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Admin Remarks (Optional)</label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-gray-600 outline-none font-medium text-sm text-white mt-2 resize-none h-24"
                    placeholder="Add remarks or comments..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowReviewModal(false); setReviewRequestData(null); }}
                    disabled={reviewSubmitting}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reviewAction === 'approve' ? handleApproveEditRequest : handleRejectEditRequest}
                    disabled={reviewSubmitting}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-red-600 text-white hover:bg-red-500'
                    }`}
                  >
                    {reviewSubmitting ? <Loader2 className="animate-spin" size={14} /> : reviewAction === 'approve' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                    <span>{reviewSubmitting ? 'Processing...' : reviewAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedOrderIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 theme-bg/95 backdrop-blur-xl border-t-2 theme-border px-4 py-4 md:px-6"
          >
            <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setSelectedOrderIds(new Set())}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs font-black text-gray-400 transition-all"
              >
                Clear ({selectedOrderIds.size})
              </button>
              <div className="h-6 w-px bg-gray-700/50" />
              <select
                value={bulkDestination}
                onChange={e => setBulkDestination(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-blue-500 min-w-[130px]"
              >
                <option value="">Send to...</option>
                <option value="STORE">Store</option>
                <option value="LOGO_DESIGN">Logo Design</option>
                <option value="WORKERS">Workers</option>
                <option value="PRODUCTION_ACCEPTANCE">Production Acceptance</option>
                <option value="PRODUCTION">Production</option>
                <option value="STORE_RECEIVE">Store Inventory</option>
                <option value="DISPATCH">Dispatch</option>
              </select>
              <button
                disabled={!bulkDestination || bulkRouting}
                onClick={handleBulkRoute}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                {bulkRouting ? <Loader2 className="animate-spin" size={14} /> : <ArrowUpRight size={14} />}
                Send Selected ({selectedOrderIds.size})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
