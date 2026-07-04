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
  DollarSign,
  ShoppingCart,
  RotateCcw,
  CalendarDays,
  Filter,
  Store as StoreIcon,
  FileEdit,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  History,
  LayoutDashboard
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
import BiSection from '../components/BiSection';

const TOP_TABS = [
  { id: 'all_phases', label: 'All Phases', icon: LayoutDashboard },
  { id: 'edit_requests', label: 'Order Change Requests', icon: FileEdit },
  { id: 'recent_orders', label: 'Recent Orders', icon: History },
  { id: 'bi', label: 'Business Intelligence', icon: BarChart3 },
  { id: 'analytics', label: 'Outlet Analytics', icon: StoreIcon },
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
  const [outletFilter, setOutletFilter] = useState('');
  const [outletDateRange, setOutletDateRange] = useState('all');
  const [outletCustomFrom, setOutletCustomFrom] = useState('');
  const [outletCustomTo, setOutletCustomTo] = useState('');
  const [outletCustomNonce, setOutletCustomNonce] = useState(0);
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

  const outletAnalyticsKey = outletDateRange !== 'custom'
    ? `admin:outlet-analytics:${outletFilter}:${outletDateRange}`
    : `admin:outlet-analytics:${outletFilter}:custom:${outletCustomFrom}:${outletCustomTo}:${outletCustomNonce}`;
  const { data: outletAnalytics, loading: outletAnalyticsLoading, refresh: refreshOutletAnalytics } = useCache(outletAnalyticsKey, { fetcher: () => {
    const params = {};
    if (outletFilter) params.outletName = outletFilter;
    const now = new Date();
    if (outletDateRange === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      params.dateFrom = weekAgo.toISOString();
    } else if (outletDateRange === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      params.dateFrom = monthAgo.toISOString();
    } else if (outletDateRange === 'custom') {
      if (outletCustomFrom) params.dateFrom = new Date(outletCustomFrom).toISOString();
      if (outletCustomTo) params.dateTo = new Date(outletCustomTo).toISOString();
    }
    return api.get('/api/orders/outlet-analytics', { params }).then(r => r.data);
  }, ttl: 60000 });

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
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full shadow-2xl rounded-2xl pointer-events-auto flex border p-4`} style={{ background: '#ffffff', borderColor: '#06b6d4' }}>
          <div className="flex-1 w-0 p-1">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                  <ClipboardList size={16} />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold uppercase tracking-tight" style={{ color: '#0f172a' }}>New Approval Request</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>
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
    { title: 'Total Active Orders', value: stats.totalOrders, icon: BarChart3, accent: '#f43f5e', bg: '#fef2f2' },
    { title: 'Urgent Priority', value: stats.urgentOrders, icon: AlertTriangle, accent: '#f59e0b', bg: '#fffbeb' },
    { title: 'Delayed Stages', value: stats.delayedOrders, icon: Clock, accent: '#ef4444', bg: '#fef2f2' },
    { title: 'Completed Today', value: stats.completedToday, icon: TrendingUp, accent: '#10b981', bg: '#ecfdf5' },
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

  if (loading && allOrders.length === 0) {
    return <PageLoader text="Syncing Production Hub..." />;
  }

  if (fetchingError && allOrders.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-6 rounded-2xl md:rounded-[3rem] border-2 p-10" style={{ background: '#ffffff', borderColor: 'rgba(239,68,68,0.2)' }}>
        <AlertTriangle className="text-red-500" size={64} />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase italic" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Connection Fragmented</h2>
          <p className="mt-2 font-semibold" style={{ color: '#64748b' }}>The production server is currently unreachable.</p>
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
          <h1 className="text-xl md:text-3xl font-bold tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Control Center</h1>
          <p className="font-semibold uppercase tracking-widest text-xs md:text-sm mt-1" style={{ color: '#64748b' }}>Production Approval Hub</p>
        </div>
        <div className="flex items-center gap-4">
          {systemPaused && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <PauseCircle className="text-red-500" size={18} />
              <span className="font-bold text-xs md:text-sm uppercase tracking-widest" style={{ color: '#dc2626' }}>System Paused</span>
            </div>
          )}
          {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (<>
          <button
            onClick={() => setShowPauseModal(true)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95 ${
              systemPaused
                ? 'text-emerald-600 border' : 'text-red-600 border'
            }`}
            style={systemPaused ? { background: '#ecfdf5', borderColor: '#a7f3d0' } : { background: '#fef2f2', borderColor: '#fecaca' }}
          >
            {systemPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            <span>{systemPaused ? 'Resume System' : 'Pause System'}</span>
          </button>
          <button
            onClick={() => {
              alert('Notification Alert Broadcasted!');
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95 border"
            style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#d97706' }}
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
            className="kpi-card cursor-pointer active:scale-[0.98]"
            onClick={() => { if (stat.path) navigate(stat.path, { state: stat.state }); }}
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${stat.accent}, #06b6d4)`, opacity: 1 }} />
            <div className="flex justify-between items-start mb-4">
              <div className="kpi-icon" style={{ background: stat.bg, color: stat.accent }}>
                <stat.icon size={18} />
              </div>
              <span className="flex items-center text-xs font-bold px-2 py-1 rounded-full uppercase tracking-widest" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <ArrowUpRight size={10} className="mr-1" />
                Live
              </span>
            </div>
            <h3 className="kpi-label">{stat.title}</h3>
            <p className="kpi-value mt-1" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search Bar (compact, always visible) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={16} style={{ color: '#94a3b8' }} />
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
            className="w-full rounded-xl py-3 pl-12 pr-4 text-sm font-medium border-2 outline-none transition-all"
            style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
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
          className="btn-solid-primary px-5 py-3 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest"
        >
          Track
        </button>
        {trackedOrder && (
          <button onClick={() => { setTrackedOrder(null); setTrackingError(''); }} className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
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
            className="text-center py-4 rounded-2xl border font-bold text-xs md:text-sm" style={{ background: '#fef2f2', borderColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          >
            {trackingError}
          </motion.div>
        )}

        {trackedOrder && (
          <motion.div
            key={trackedOrder.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 md:p-6 border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}
          >
            {/* Order Header */}
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-bold text-lg md:text-xl shadow-lg text-white" style={{ background: 'linear-gradient(135deg, #f43f5e, #06b6d4)' }}>
                  {trackedOrder.customerName?.charAt(0) || '?'}
                </div>
                <div>
                  <h4 className="text-base md:text-lg font-bold" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{trackedOrder.customerName}</h4>
                  <p className="font-semibold uppercase tracking-widest text-[10px] md:text-xs" style={{ color: '#94a3b8' }}>Order #{trackedOrder.orderNumber || trackedOrder.id.substring(0, 8)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border ${
                  trackedOrder.priority === 'SUPER_URGENT' ? 'badge-danger' :
                  trackedOrder.priority === 'URGENT' ? 'badge-warning' :
                  'badge-neutral'
                }`}>{trackedOrder.priority || 'NORMAL'}</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border ${
                  trackedOrder.paymentStatus === 'PAID' || trackedOrder.paymentStatus === 'FULL_PAID' ? 'badge-success' :
                  parseFloat(trackedOrder.advanceAmount || 0) > 0 ? 'badge-warning' :
                  'badge-danger'
                }`}>{trackedOrder.paymentStatus === 'PAID' || trackedOrder.paymentStatus === 'FULL_PAID' ? 'PAID' : parseFloat(trackedOrder.advanceAmount || 0) > 0 ? 'ADVANCE' : 'COD'}</span>
                <span className="badge-info px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border">
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
                      return (
                        <div key={s} className="flex items-center gap-1">
                          <div className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${
                            isPast ? 'badge-success' :
                            isCurrent ? 'badge-primary border-2' :
                            'badge-neutral'
                          }`}>
                            {isPast && <CheckCircle2 size={10} className="inline mr-1 -mt-0.5" />}
                            {s.replace(/_/g, ' ')}
                          </div>
                          {i < stages.length - 1 && (
                            <div className={`w-3 h-[2px] ${i < currentIdx ? 'bg-emerald-400' : ''}`} style={{ background: i < currentIdx ? '#10b981' : '#e2e8f0' }} />
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
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: '#f43f5e' }} /></div>
            ) : trackingTimeline.length === 0 ? (
              <div className="text-center py-8 font-bold uppercase tracking-widest text-xs" style={{ color: '#94a3b8' }}>Loading timeline...</div>
            ) : (
              <div className="space-y-1 mb-4">
                <h5 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#94a3b8' }}>Stage Timeline</h5>
                {trackingTimeline
                  .filter(e => e.type === 'stage')
                  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                  .map((entry, idx, arr) => {
                    const dotColor = entry.status === 'COMPLETED' ? '#10b981' : entry.acceptedAt ? '#f43f5e' : '#94a3b8';
                    const delay = entry.delay;
                    const fmt = (d) => d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
                    return (
                      <div key={entry.id || idx} className="relative pl-8 pb-3">
                        {idx < arr.length - 1 && <div className="absolute left-[11px] top-3 bottom-0 w-[2px]" style={{ background: '#e2e8f0' }} />}
                        <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center`} style={{ background: dotColor, borderColor: '#ffffff' }}>
                          {entry.status === 'COMPLETED' ? <CheckCircle2 size={12} className="text-white" /> : <Circle size={8} className="text-white fill-current" />}
                        </div>
                        <div className="p-2.5 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className={`text-[11px] font-bold uppercase tracking-wider ${entry.status === 'COMPLETED' ? 'text-emerald-600' : entry.acceptedAt ? 'text-rose-600' : 'text-slate-500'}`}>
                              {entry.stage.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              entry.status === 'COMPLETED' ? 'badge-success' :
                              entry.acceptedAt ? 'badge-primary' :
                              'badge-neutral'
                            }`}>{entry.status.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-medium" style={{ color: '#94a3b8' }}>
                            <span>Received: {fmt(entry.receivedAt)}</span>
                            {entry.acceptedAt && <span>Accepted: {fmt(entry.acceptedAt)}</span>}
                            {entry.completedAt && <span>Completed: {fmt(entry.completedAt)}</span>}
                            {delay !== null && (
                              <span className={delay > 60 ? 'text-red-500' : delay > 0 ? 'text-amber-500' : ''}>
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
                <h5 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>Routing History</h5>
                <div className="space-y-1">
                  {trackingTimeline
                    .filter(e => e.type === 'route')
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map((entry, idx) => (
                      <div key={entry.id || idx} className="flex items-center gap-2 p-2 rounded-lg border" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.1)' }}>
                        <Truck size={12} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] font-bold text-amber-600">{entry.from?.replace(/_/g, ' ')} → {entry.to?.replace(/_/g, ' ')}</span>
                        <span className="text-[9px]" style={{ color: '#94a3b8' }}>{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {entry.actor && <span className="text-[9px] ml-auto" style={{ color: '#94a3b8' }}>by {entry.actor}</span>}
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
                    <h5 className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>Products</h5>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Package size={12} className="text-purple-500 shrink-0" />
                            <span className="text-[10px] font-bold truncate" style={{ color: '#0f172a' }}>{item.productType || 'Item'} — {item.fabricType || 'STD'} / {item.color || '—'} / {item.size || '—'}</span>
                          </div>
                          <span className="text-[10px] font-bold shrink-0 ml-2" style={{ color: '#64748b' }}>x{item.quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Customer Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div className="p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Phone</p>
                <p className="text-[10px] font-bold" style={{ color: '#0f172a' }}>{trackedOrder.customerPhone || '—'}</p>
              </div>
              <div className="p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>City</p>
                <p className="text-[10px] font-bold" style={{ color: '#0f172a' }}>{trackedOrder.city || '—'}</p>
              </div>
              <div className="p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Source</p>
                <p className="text-[10px] font-bold" style={{ color: '#0f172a' }}>{trackedOrder.source || '—'}</p>
              </div>
              <div className="p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Total</p>
                <p className="text-[10px] font-bold" style={{ color: '#0f172a' }}>₨{parseFloat(trackedOrder.totalPrice || 0).toLocaleString()}</p>
              </div>
            </div>
            {trackedOrder.address && (
              <div className="p-2 rounded-lg border mb-4" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: '#94a3b8' }}>Address</p>
                <p className="text-[10px] font-bold" style={{ color: '#0f172a' }}>{trackedOrder.address}</p>
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
      <div className="p-2 rounded-2xl border overflow-x-auto no-scrollbar" style={{ background: '#f1f5f9', borderColor: '#e2e8f0' }}>
        <div className="flex items-center gap-1.5 min-w-max">
          {TOP_TABS.map((tab) => {
            const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
            if ((tab.id === 'edit_requests' || tab.id === 'bi' || tab.id === 'analytics' || tab.id === 'settings') && !isAdmin) return null;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(prev => prev === tab.id ? null : tab.id);
                  if (tab.id === 'all_phases') setFilterStage('ALL');
                  if (tab.id === 'edit_requests') editRequestsRefreshRef.current?.();
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-white shadow-lg'
                    : 'hover:bg-white/50'
                }`}
                style={activeTab === tab.id ? { background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.25)' } : { color: '#64748b' }}
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.id === 'edit_requests' && editRequests.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-white rounded text-[9px] font-bold" style={{ background: '#f59e0b' }}>{editRequests.length}</span>
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
                <div className="p-2 rounded-2xl border overflow-x-auto no-scrollbar" style={{ background: '#f1f5f9', borderColor: '#e2e8f0' }}>
                  <div className="flex items-center gap-1.5 min-w-max">
                    <button
                      onClick={() => setFilterStage('ALL')}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
                        filterStage === 'ALL'
                          ? 'text-white shadow-lg'
                          : 'hover:bg-white/50'
                      }`}
                      style={filterStage === 'ALL' ? { background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.25)' } : { color: '#64748b' }}
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
                          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                            filterStage === stage.id
                              ? 'text-white shadow-lg'
                              : 'hover:bg-white/50'
                          }`}
                          style={filterStage === stage.id ? { background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.25)' } : { color: '#64748b' }}
                        >
                          <stage.icon size={13} />
                          {stage.label}
                          <span className="ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold" 
                            style={filterStage === stage.id ? { background: 'rgba(255,255,255,0.2)', color: '#ffffff' } : { background: '#e2e8f0', color: '#64748b' }}>{count}</span>
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
                        <div className="p-3 rounded-2xl" style={{ background: '#fef2f2' }}>
                          <Package className="text-rose-500" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Store</h2>
                          <p className="text-xs md:text-sm font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Orders currently in Store phase</p>
                        </div>
                      </div>
                      <button onClick={() => setFilterStage('ALL')} className="text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#94a3b8' }}>
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
                            <div className="theme-card p-4 text-center rounded-2xl border">
                              <p className="text-2xl font-bold" style={{ color: '#f43f5e' }}>{total}</p>
                              <p className="text-xs md:text-sm font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Total</p>
                            </div>
                            <div className="theme-card p-4 text-center rounded-2xl border">
                              <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{pending}</p>
                              <p className="text-xs md:text-sm font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Pending</p>
                            </div>
                            <div className="theme-card p-4 text-center rounded-2xl border">
                              <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{inProgress}</p>
                              <p className="text-xs md:text-sm font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>In Progress</p>
                            </div>
                            <div className="theme-card p-4 text-center rounded-2xl border">
                              <p className="text-2xl font-bold" style={{ color: '#64748b' }}>{completed}</p>
                              <p className="text-xs md:text-sm font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Completed</p>
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
                          <div className="col-span-full py-6 md:py-20 text-center rounded-2xl md:rounded-[3rem] border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                            <Package className="mx-auto mb-4" size={48} style={{ color: '#94a3b8' }} />
                            <h3 className="font-bold uppercase" style={{ color: '#94a3b8' }}>No orders in Store</h3>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : filterStage === 'DISPATCH' ? (
                  <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl" style={{ background: '#fffbeb' }}>
                          <ClipboardList className="text-amber-500" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Delivery Setup</h2>
                          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Orders at Dispatch awaiting delivery configuration</p>
                        </div>
                      </div>
                      <div className="relative w-full md:w-auto min-w-[200px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={16} style={{ color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search by ID or Name..."
                          value={contextSearch}
                          onChange={(e) => handleDashboardSearch(e.target.value)}
                          className="w-full rounded-xl py-3 pl-12 pr-4 text-sm font-medium border-2 outline-none transition-all"
                          style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
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
                      <div className="p-4 md:p-16 rounded-2xl md:rounded-[3rem] border text-center space-y-4" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                          <CheckCircle2 className="text-emerald-500" size={40} />
                        </div>
                        <h3 className="text-xl font-bold uppercase" style={{ color: '#94a3b8' }}>All delivered</h3>
                        <p className="text-sm font-semibold max-w-xs mx-auto uppercase tracking-widest" style={{ color: '#94a3b8' }}>No orders pending delivery configuration.</p>
                      </div>
                    )}
                  </section>
                ) : filterStage !== 'ALL' ? (
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl" style={{ background: '#fef2f2' }}>
                          <Package className="text-rose-500" size={20} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{filterStage.replace(/_/g, ' ')} Orders</h2>
                          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Active orders in this phase</p>
                        </div>
                      </div>
                      <button onClick={() => setFilterStage('ALL')} className="text-xs font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#94a3b8' }}>
                        <X size={14} /> Close
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                      {filteredOrdersByStage.length > 0 ? (
                        filteredOrdersByStage.map(order => (
                          <OrderCard key={order.id} order={order} userRole={user?.role} onUpdateStage={handleAction} selected={selectedOrderIds.has(order.id)} onToggleSelect={toggleOrderSelection} />
                        ))
                      ) : (
                        <div className="col-span-full py-6 md:py-20 text-center rounded-2xl md:rounded-[3rem] border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                          <Package className="mx-auto mb-4" size={48} style={{ color: '#94a3b8' }} />
                          <h3 className="font-bold uppercase" style={{ color: '#94a3b8' }}>No orders in this phase</h3>
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
                          <div className="p-3 rounded-2xl" style={{ background: '#fef2f2' }}>
                            <Sparkles className="text-rose-500" size={20} />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Initiation Queue</h2>
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>New orders waiting to start production</p>
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
                            <div className="p-3 rounded-2xl" style={{ background: '#fef2f2' }}>
                              <stage.icon className="text-rose-500" size={20} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{stage.label}</h2>
                                <button
                                  onClick={() => setFilterStage(stage.id)}
                                  className="text-xs font-bold uppercase tracking-widest transition-all px-3 py-1 rounded-lg" style={{ color: '#f43f5e' }}
                                >
                                  View All ({stageOrders.length})
                                </button>
                              </div>
                              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Active orders in {stage.label}</p>
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
                      <div className="py-16 text-center rounded-2xl md:rounded-[3rem] border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                        <Package className="mx-auto mb-4" size={48} style={{ color: '#94a3b8' }} />
                        <h3 className="font-bold uppercase" style={{ color: '#94a3b8' }}>No active orders</h3>
                        <p className="text-xs font-semibold mt-2" style={{ color: '#94a3b8' }}>All orders have been completed</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Order Change Requests Tab */}
            {activeTab === 'edit_requests' && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-2xl" style={{ background: '#fffbeb' }}>
                      <FileEdit className="text-amber-500" size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Order Change Requests</h2>
                      <p className="text-xs md:text-sm font-bold uppercase tracking-widest mt-0.5" style={{ color: '#64748b' }}>
                        {editRequests.length} pending request{editRequests.length !== 1 ? 's' : ''} — Auto-refreshing
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden sm:inline-flex items-center gap-2 text-xs md:text-sm font-semibold px-3 py-1.5 rounded-full border" style={{ background: '#ecfdf5', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
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
                    <Loader2 className="animate-spin" size={28} style={{ color: '#f59e0b' }} />
                  </div>
                ) : editRequests.length === 0 ? (
                  <div className="rounded-2xl md:rounded-[2rem] p-8 md:p-12 border text-center space-y-4" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <CheckCircle2 className="text-emerald-500" size={32} />
                    </div>
                    <h3 className="text-lg font-bold uppercase" style={{ color: '#94a3b8' }}>No Pending Requests</h3>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>All order change requests have been processed.</p>
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
                          className="theme-card rounded-2xl border transition-all cursor-pointer"
                          style={isExpanded ? { borderColor: 'rgba(245,158,11,0.4)', boxShadow: '0 10px 40px rgba(245,158,11,0.1)' } : {}}
                        >
                          <div
                            onClick={() => setExpandedEditRequest(isExpanded ? null : req.id)}
                            className="p-5"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                                  <FileEdit size={16} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold" style={{ color: '#0f172a' }}>#{order.orderNumber || order.id?.substring(0, 8) || 'N/A'}</p>
                                  <p className="text-xs md:text-sm font-semibold" style={{ color: '#64748b' }}>{order.customerName || 'Unknown'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider badge-warning">
                                  {req.status}
                                </span>
                                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} style={{ color: '#94a3b8' }}>
                                  <ChevronDown size={14} />
                                </motion.div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs md:text-sm font-semibold" style={{ color: '#64748b' }}>
                              <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${source === 'ONLINE ORDER' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                                {source}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>|</span>
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
                                <div className="px-5 pb-5 border-t pt-4 space-y-4" style={{ borderColor: '#f1f5f9' }}>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl p-3 border" style={{ background: '#fef2f2', borderColor: 'rgba(239,68,68,0.2)' }}>
                                      <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-red-500" /> Old Item(s)
                                      </p>
                                      {currentProducts.length > 0 ? currentProducts.map((p, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(239,68,68,0.1)' }}>
                                          <span className="text-xs md:text-sm font-bold text-red-500 w-4">{i + 1}.</span>
                                          <div>
                                            <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>{p.name}</p>
                                            {(p.color || p.size) && (
                                              <p className="text-xs font-medium" style={{ color: '#64748b' }}>
                                                {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )) : <p className="text-xs italic" style={{ color: '#94a3b8' }}>No items</p>}
                                    </div>

                                    <div className="rounded-xl p-3 border" style={{ background: '#ecfdf5', borderColor: 'rgba(16,185,129,0.2)' }}>
                                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500" /> New Item(s)
                                      </p>
                                      {requestedProducts.length > 0 ? requestedProducts.map((p, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1.5 border-b last:border-0" style={{ borderColor: 'rgba(16,185,129,0.1)' }}>
                                          <span className="text-xs md:text-sm font-bold text-emerald-600 w-4">{i + 1}.</span>
                                          <div>
                                            <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>{p.name}</p>
                                            {(p.color || p.size) && (
                                              <p className="text-xs font-medium" style={{ color: '#64748b' }}>
                                                {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )) : <p className="text-xs italic" style={{ color: '#94a3b8' }}>No items</p>}
                                    </div>
                                  </div>

                                  <div className="rounded-xl p-3 border" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.15)' }}>
                                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <RotateCcw size={10} /> Inventory Impact
                                    </p>
                                    <div className="space-y-1">
                                      {currentProducts.map((p, i) => (
                                        <p key={i} className="text-xs font-bold text-emerald-600">
                                          +{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} returned to stock
                                        </p>
                                      ))}
                                      {requestedProducts.map((p, i) => (
                                        <p key={i} className="text-xs font-bold text-red-500">
                                          -{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} deducted from stock
                                        </p>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-xl p-3 border" style={{ background: '#eef2ff', borderColor: 'rgba(99,102,241,0.15)' }}>
                                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Package size={10} /> Inventory Availability
                                    </p>
                                    {inventorySearchLoading ? (
                                      <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="animate-spin" size={12} style={{ color: '#6366f1' }} />
                                        <span className="text-xs font-semibold" style={{ color: '#64748b' }}>Checking inventory...</span>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {requestedProducts.map((p, i) => {
                                          const items = inventorySearchResults[p.name] || [];
                                          return (
                                            <div key={i} className="rounded-lg p-2 border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                                              <p className="text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: '#0f172a' }}>{p.name}</p>
                                              {items.length === 0 ? (
                                                <p className="text-xs font-bold text-red-500 italic">No inventory records found</p>
                                              ) : (
                                                items.map((item, idx) => {
                                                  const v = item.variants && Array.isArray(item.variants) ? item.variants : [{ color: item.color || 'Default', size: item.size || 'Default', stock: item.stock || 0 }];
                                                  return (
                                                    <div key={idx} className="mb-1 last:mb-0">
                                                      {v.length === 1 && !item.variants ? (
                                                        <div className="flex items-center justify-between py-1">
                                                          <span className="text-xs font-medium" style={{ color: '#64748b' }}>
                                                            {[v[0].color, v[0].size].filter(Boolean).join(' / ')}
                                                          </span>
                                                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                                            v[0].stock === 0 ? 'badge-danger' :
                                                            v[0].stock <= 5 ? 'badge-warning' :
                                                            'badge-success'
                                                          }`}>
                                                            {v[0].stock} in stock
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <div className="space-y-0.5">
                                                          {v.map((variant, vi) => (
                                                            <div key={vi} className="flex items-center justify-between py-0.5">
                                                              <span className="text-[9px] font-medium" style={{ color: '#64748b' }}>
                                                                {[variant.color, variant.size].filter(Boolean).join(' / ')}
                                                              </span>
                                                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                                (variant.stock || 0) === 0 ? 'badge-danger' :
                                                                (variant.stock || 0) <= 5 ? 'badge-warning' :
                                                                'badge-success'
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
                                    <div className="rounded-xl p-3 border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                                      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#64748b' }}>Reason</p>
                                      <p className="text-xs md:text-sm font-medium italic" style={{ color: '#475569' }}>"{req.reason}"</p>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#64748b' }}>
                                    <span>Requested by: {req.requestedBy?.name || 'Unknown'} ({req.requestedBy?.role || '?'})</span>
                                    <span>{new Date(req.requestedAt).toLocaleString()}</span>
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      onClick={() => { setReviewRequestData(req); setReviewAction('approve'); setReviewRemarks(''); setShowReviewModal(true); }}
                                      className="flex-1 py-3.5 text-white rounded-xl font-bold text-xs md:text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}
                                    >
                                      <ThumbsUp size={13} /> Approve
                                    </button>
                                    <button
                                      onClick={() => { setReviewRequestData(req); setReviewAction('reject'); setReviewRemarks(''); setShowReviewModal(true); }}
                                      className="flex-1 py-3.5 text-white rounded-xl font-bold text-xs md:text-sm uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                                      style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 15px rgba(239,68,68,0.3)' }}
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
                  <div className="p-3 rounded-2xl" style={{ background: '#eef2ff' }}>
                    <History className="text-indigo-500" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Recent Orders</h2>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Latest 20 orders</p>
                  </div>
                </div>
                <div className="rounded-2xl p-5 border" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left theme-table">
                      <thead>
                        <tr className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
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
                          <tr key={o.id} className="text-sm cursor-pointer" onClick={() => {
                            setTrackedOrder(o);
                            setActiveTab(null);
                          }}>
                            <td className="py-3 pr-4 font-bold" style={{ color: '#0f172a' }}>#{o.orderNumber || o.id.substring(0, 6)}</td>
                            <td className="py-3 pr-4" style={{ color: '#334155' }}>{o.customerName}</td>
                            <td className="py-3 pr-4 text-xs md:text-sm" style={{ color: '#64748b' }}>{o.outletName || o.source || '—'}</td>
                            <td className="py-3 pr-4 text-xs md:text-sm font-bold uppercase" style={{ color: '#64748b' }}>{o.currentStage?.replace(/_/g, ' ')}</td>
                            <td className="py-3 pr-4">
                              <span className={`text-xs md:text-sm font-bold px-2 py-1 rounded ${
                                o.status === 'COMPLETED' ? 'badge-success' :
                                o.status === 'IN_PROGRESS' ? 'badge-info' :
                                o.status === 'PENDING' ? 'badge-warning' :
                                'badge-danger'
                              }`}>{o.status}</span>
                              {(() => {
                                const _p = o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID';
                                const _a = parseFloat(o.advanceAmount || 0) > 0;
                                const _r = Math.max(0, (o.totalPrice || 0) - parseFloat(o.advanceAmount || 0));
                                if (_p) return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-success">PAID</span>;
                                if (_a) return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-warning">REMAINING COD</span>;
                                return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-danger">COD</span>;
                              })()}
                            </td>
                            <td className="py-3 pr-4 text-right font-bold" style={{ color: '#0f172a' }}>₨{o.totalPrice || 0}</td>
                            <td className="py-3 pr-4 text-right font-bold text-xs md:text-sm" style={{ color: '#64748b' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {/* Business Intelligence Tab */}
            {activeTab === 'bi' && <BiSection />}

            {/* Outlet Analytics Tab */}
            {activeTab === 'analytics' && (
              <section className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-2xl" style={{ background: '#faf5ff' }}>
                    <StoreIcon className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Outlet Analytics</h2>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#64748b' }}>Branch-wise performance &amp; revenue</p>
                  </div>
                </div>

                {/* Branch Selector */}
                <div className="flex flex-wrap gap-2">
                  {BRANCHES.map(b => (
                    <button
                      key={b.value}
                      onClick={() => setOutletFilter(b.value)}
                      className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
                        outletFilter === b.value
                          ? 'text-white shadow-lg'
                          : 'border'
                      }`}
                      style={outletFilter === b.value ? { background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 4px 15px rgba(168,85,247,0.25)' } : { background: '#ffffff', borderColor: '#e2e8f0', color: '#64748b' }}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                {/* Time Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: 'week', label: 'Weekly' },
                    { key: 'month', label: 'Monthly' },
                  ].map(r => (
                    <button
                      key={r.key}
                      onClick={() => setOutletDateRange(r.key)}
                      className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all ${
                        outletDateRange === r.key ? 'text-white shadow-lg' : 'border'
                      }`}
                      style={outletDateRange === r.key ? { background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 4px 15px rgba(168,85,247,0.25)' } : { background: '#ffffff', borderColor: '#e2e8f0', color: '#64748b' }}
                    >
                      {r.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setOutletDateRange('custom')}
                    className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-1 ${
                      outletDateRange === 'custom' ? 'text-white shadow-lg' : 'border'
                    }`}
                    style={outletDateRange === 'custom' ? { background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 4px 15px rgba(168,85,247,0.25)' } : { background: '#ffffff', borderColor: '#e2e8f0', color: '#64748b' }}
                  >
                    <CalendarDays size={12} /> Custom
                  </button>
                  {outletDateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input type="date" value={outletCustomFrom} onChange={(e) => setOutletCustomFrom(e.target.value)}
                        className="rounded-xl py-2 px-3 text-xs font-bold outline-none border-2 transition-all"
                        style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }} />
                      <span className="text-xs" style={{ color: '#94a3b8' }}>—</span>
                      <input type="date" value={outletCustomTo} onChange={(e) => setOutletCustomTo(e.target.value)}
                        className="rounded-xl py-2 px-3 text-xs font-bold outline-none border-2 transition-all"
                        style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }} />
                      <button
                        onClick={() => setOutletCustomNonce(n => n + 1)}
                        className="px-4 py-2 text-white rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all"
                        style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                {/* Analytics Cards */}
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="animate-spin" size={32} style={{ color: '#a855f7' }} />
                  </div>
                ) : outletAnalytics ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Total Orders</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>{outletAnalytics.summary.totalOrders}</p>
                      </div>
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Completed</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#10b981', fontFamily: "'Poppins', sans-serif" }}>{outletAnalytics.summary.completedOrders}</p>
                      </div>
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>In Progress</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#f43f5e', fontFamily: "'Poppins', sans-serif" }}>{outletAnalytics.summary.inProgressOrders}</p>
                      </div>
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Pending</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#f59e0b', fontFamily: "'Poppins', sans-serif" }}>{outletAnalytics.summary.pendingOrders}</p>
                      </div>
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Cancelled</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#ef4444', fontFamily: "'Poppins', sans-serif" }}>{outletAnalytics.summary.cancelledOrders}</p>
                      </div>
                      <div className="theme-card rounded-xl p-4 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Total Revenue</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#10b981', fontFamily: "'Poppins', sans-serif" }}>₨{Number(outletAnalytics.summary.totalRevenue).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="theme-card rounded-xl p-5 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#64748b' }}>
                          <DollarSign size={12} className="text-emerald-500" /> Total Revenue
                        </p>
                        <p className="text-xl md:text-3xl font-bold mt-2" style={{ color: '#10b981', fontFamily: "'Poppins', sans-serif" }}>₨{Number(outletAnalytics.summary.totalRevenue).toLocaleString()}</p>
                        <p className="text-xs font-semibold uppercase tracking-widest mt-1" style={{ color: '#94a3b8' }}>Completed &amp; Delivered Orders Only</p>
                      </div>
                      <div className="theme-card rounded-xl p-5 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#64748b' }}>
                          <ShoppingCart size={12} className="text-rose-500" /> Avg Order Value
                        </p>
                        <p className="text-xl md:text-3xl font-bold mt-2" style={{ color: '#f43f5e', fontFamily: "'Poppins', sans-serif" }}>₨{Number(outletAnalytics.summary.avgOrderValue).toFixed(2)}</p>
                        <p className="text-xs font-semibold uppercase tracking-widest mt-1" style={{ color: '#94a3b8' }}>Completed &amp; Delivered Orders Only</p>
                      </div>
                    </div>

                    {/* Recent Orders */}
                    {outletAnalytics.recentOrders?.length > 0 && (
                      <div className="theme-card rounded-xl p-5 border">
                        <p className="text-xs md:text-sm font-bold uppercase tracking-widest mb-3" style={{ color: '#64748b' }}>Recent Orders</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left theme-table">
                            <thead>
                              <tr className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
                                <th className="py-2 pr-4">Order</th>
                                <th className="py-2 pr-4">Customer</th>
                                <th className="py-2 pr-4">Outlet</th>
                                <th className="py-2 pr-4">Status</th>
                                <th className="py-2 pr-4 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {outletAnalytics.recentOrders.map(o => (
                                <tr key={o.id} className="text-sm">
                                  <td className="py-2 pr-4 font-bold" style={{ color: '#0f172a' }}>#{o.orderNumber || o.id.substring(0, 6)}</td>
                                  <td className="py-2 pr-4" style={{ color: '#334155' }}>{o.customerName}</td>
                                  <td className="py-2 pr-4 text-xs md:text-sm" style={{ color: '#64748b' }}>{o.outletName || '—'}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`text-xs md:text-sm font-bold px-2 py-1 rounded ${
                                      o.status === 'COMPLETED' ? 'badge-success' :
                                      o.status === 'IN_PROGRESS' ? 'badge-info' :
                                      o.status === 'PENDING' ? 'badge-warning' :
                                      'badge-danger'
                                    }`}>{o.status}</span>
                                    {(() => {
                                      const _p = o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID';
                                      const _a = parseFloat(o.advanceAmount || 0) > 0;
                                      const _r = Math.max(0, (o.totalPrice || 0) - parseFloat(o.advanceAmount || 0));
                                      if (_p) return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-success">PAID</span>;
                                      if (_a) return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-warning">REMAINING COD</span>;
                                      return <span className="ml-1 text-xs font-bold px-2 py-1 rounded badge-danger">COD</span>;
                                    })()}
                                  </td>
                                  <td className="py-2 pr-4 text-right font-bold" style={{ color: '#0f172a' }}>₨{o.totalPrice || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md w-full p-4 md:p-8 rounded-2xl border-2 shadow-xl" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${systemPaused ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {systemPaused ? <PlayCircle className="text-emerald-600" size={28} /> : <PauseCircle className="text-red-600" size={28} />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: '#0f172a' }}>{systemPaused ? 'Resume System' : 'Pause System'}</h2>
                  <p className="text-sm font-semibold" style={{ color: '#64748b' }}>{systemPaused ? 'Reactivate all production operations.' : 'Stop all production operations for holidays.'}</p>
                </div>
              </div>
              <form onSubmit={handleTogglePause} className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Confirm Password</label>
                  <input type="password" value={pausePassword} onChange={(e) => setPausePassword(e.target.value)}
                    className="w-full rounded-xl py-3 px-4 outline-none border-2 transition-all font-bold text-lg mt-2"
                    style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                    placeholder="Enter your password" required />
                </div>
                <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Enter your admin password to {systemPaused ? 'resume' : 'pause'} the system.</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => { setShowPauseModal(false); setPausePassword(''); }}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all" style={{ background: '#f1f5f9', color: '#64748b' }}>Cancel</button>
                  <button type="submit" disabled={pausing || !pausePassword}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-white`}
                    style={systemPaused ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : { background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-md w-full p-4 md:p-8 rounded-2xl border-2 shadow-xl" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${reviewAction === 'approve' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  {reviewAction === 'approve' ? <ThumbsUp className="text-emerald-600" size={24} /> : <ThumbsDown className="text-red-600" size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: '#0f172a' }}>{reviewAction === 'approve' ? 'Approve Edit' : 'Reject Edit'}</h2>
                  <p className="text-xs font-semibold" style={{ color: '#64748b' }}>Order #{reviewRequestData.order?.orderNumber || reviewRequestData.orderId?.substring(0, 8)}</p>
                </div>
              </div>

              {reviewAction === 'approve' && (
                <div className="rounded-xl p-4 border mb-4" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">⚠ Inventory will auto-adjust</p>
                  <p className="text-xs md:text-sm font-medium" style={{ color: '#64748b' }}>The system will automatically restore stock for removed products and deduct stock for new products.</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Admin Remarks (Optional)</label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full rounded-xl py-3 px-4 outline-none border-2 transition-all font-medium text-sm resize-none h-24 mt-2"
                    style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                    placeholder="Add remarks or comments..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowReviewModal(false); setReviewRequestData(null); }}
                    disabled={reviewSubmitting}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                    style={{ background: '#f1f5f9', color: '#64748b' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reviewAction === 'approve' ? handleApproveEditRequest : handleRejectEditRequest}
                    disabled={reviewSubmitting}
                    className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white`}
                    style={reviewAction === 'approve' ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : { background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
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
            className="fixed bottom-0 left-0 right-0 z-50 border-t-2 px-4 py-4 md:px-6 action-bar"
          >
            <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setSelectedOrderIds(new Set())}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: '#f1f5f9', color: '#64748b' }}
              >
                Clear ({selectedOrderIds.size})
              </button>
              <div className="h-6 w-px" style={{ background: '#e2e8f0' }} />
              <select
                value={bulkDestination}
                onChange={e => setBulkDestination(e.target.value)}
                className="rounded-xl px-3 py-2 text-xs font-bold outline-none border-2 transition-all min-w-[130px]"
                style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
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
                className="flex items-center gap-2 px-5 py-2 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
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
