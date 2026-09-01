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
  CheckCircle,
  Store,
  Globe,
  Building,
  MessageSquare,
  ClipboardCheck,
  LogIn,
  Ban
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import socket from '../socket';
import OrderCard from '../components/OrderCard';
import AdminSettings from './AdminSettings';
import DispatchAnalyticsCard from '../components/DispatchAnalyticsCard';
import EnamelsDeliveryCard from '../components/EnamelsDeliveryCard';
import WarehouseAnalyticsCard from '../components/WarehouseAnalyticsCard';
import OnlineStoreCard from '../components/OnlineStoreCard';
import AlterationTrackingCard from '../components/AlterationTrackingCard';
import OutletDetailedCard from '../components/OutletDetailedCard';
import AdminFeedbackDashboard from '../components/AdminFeedbackDashboard';
import OrderPerformanceCard from '../components/OrderPerformanceCard';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { useSystemPause } from '../context/SystemPauseContext';
import { toUrduName } from '../utils/urduDictionary';
import toast from 'react-hot-toast';
import { isPaidOrder, getRemainingBalance } from '../utils/paymentUtils';
import { getStageDelays } from '../utils/delayUtils';


const TOP_TABS = [
  { id: 'all_phases', label: 'Control Center', icon: LayoutDashboard },
  { id: 'online_store', label: 'Online Store', icon: Globe },
  { id: 'dispatch_analytics', label: 'Dispatch', icon: BarChart3 },
  { id: 'enamels_delivery', label: 'Enamels Delivery', icon: Truck },
  { id: 'warehouse', label: 'Warehouse', icon: Package },
  { id: 'outlet_johar', label: 'Johar Town Outlet', icon: Store },
  { id: 'outlet_jail', label: 'Jail Road Outlet', icon: Store },
  { id: 'outlet_abbottabad', label: 'Abbottabad Outlet', icon: Building },
  { id: 'customer_feedback', label: 'Customer Feedback', icon: MessageSquare },
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

const EMPTY_ARRAY = [];

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.adminTab || null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingTimeline, setTrackingTimeline] = useState([]);
  const [trackingTimelineLoading, setTrackingTimelineLoading] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRequestData, setReviewRequestData] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [expandedEditRequest, setExpandedEditRequest] = useState(null);
  const [inventorySearchResults, setInventorySearchResults] = useState({});
  const [inventorySearchLoading, setInventorySearchLoading] = useState(false);

  // Profile login time tracking (Admin Dashboard card)
  const [loginSessions, setLoginSessions] = useState([]);
  const [loginSessionsActive, setLoginSessionsActive] = useState(0);
  const [loginSessionsLoading, setLoginSessionsLoading] = useState(false);
  const [showLoginSessions, setShowLoginSessions] = useState(false);

  const fetchLoginSessions = useCallback(async () => {
    setLoginSessionsLoading(true);
    try {
      const res = await api.get('/api/auth/sessions', { params: { limit: 200, days: 30 } });
      setLoginSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []);
      setLoginSessionsActive(res.data?.activeCount || 0);
    } catch (e) {
      console.error('Error fetching login sessions:', e);
    }
    setLoginSessionsLoading(false);
  }, []);

  useEffect(() => { fetchLoginSessions(); }, [fetchLoginSessions]);

  // Wrong Order Number Attempt monitoring (Admin Dashboard card + timeline)
  const [wrongStats, setWrongStats] = useState(null);
  const [wrongLoading, setWrongLoading] = useState(false);
  const [showWrongAttempts, setShowWrongAttempts] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState([]);
  const [wrongAttemptsLoading, setWrongAttemptsLoading] = useState(false);

  const fetchWrongStats = useCallback(async () => {
    setWrongLoading(true);
    try {
      const res = await api.get('/api/wrong-attempts/stats');
      setWrongStats(res.data || null);
    } catch (e) {
      console.error('Error fetching wrong attempt stats:', e);
    }
    setWrongLoading(false);
  }, []);

  const fetchWrongAttempts = useCallback(async () => {
    setWrongAttemptsLoading(true);
    try {
      const res = await api.get('/api/wrong-attempts');
      setWrongAttempts(Array.isArray(res.data?.attempts) ? res.data.attempts : []);
    } catch (e) {
      console.error('Error fetching wrong attempts:', e);
    }
    setWrongAttemptsLoading(false);
  }, []);

  useEffect(() => { fetchWrongStats(); }, [fetchWrongStats]);

  const [filterStage, setFilterStage] = useState('ALL');
  const [storeSubTab, setStoreSubTab] = useState('unseen');
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState('');
  const [bulkRouting, setBulkRouting] = useState(false);

  const dashboardRefreshRef = useRef();
  const analyticsRefreshRef = useRef();
  const unseenRefreshRef = useRef();
  const prodReturnedRefreshRef = useRef();
  const editRequestsRefreshRef = useRef();
  const queueRefreshRef = useRef();

  const { periods: pausePeriods, myProfile: pauseProfile } = useSystemPause();

  const needsData = activeTab !== null;
  const { data: allOrdersData, loading: ordersLoading, error: ordersError, refresh: refreshDashboard } = useCache(needsData ? 'admin:dashboard:orders' : null, { fetcher: () => api.get('/api/orders').then(r => Array.isArray(r.data) ? r.data : []), ttl: 60000 });
  const { data: analytics, refresh: refreshAnalytics } = useCache(needsData ? 'admin:dashboard:analytics' : null, { fetcher: () => api.get('/api/orders/analytics').then(r => r.data), ttl: 60000 });
  const { data: storeUnseenData, refresh: refreshUnseen } = useCache(needsData ? 'admin:store-unseen' : null, { fetcher: () => api.get('/api/orders/unseen-tasks').then(r => r.data), ttl: 30000 });
  const { data: storeProductionData, refresh: refreshProdReturned } = useCache(needsData ? 'admin:store-production' : null, { fetcher: () => api.get('/api/orders/production-returned').then(r => r.data), ttl: 30000 });
  const { data: editRequestsData, loading: editRequestsLoading, refresh: refreshEditRequests } = useCache(needsData ? 'admin:edit-requests' : null, { fetcher: () => api.get('/api/edit-requests', { params: { status: 'PENDING' } }).then(r => Array.isArray(r.data) ? r.data : []), ttl: 30000 });

  const allOrders = allOrdersData || EMPTY_ARRAY;
  const editRequests = useMemo(() => Array.isArray(editRequestsData) ? editRequestsData : EMPTY_ARRAY, [editRequestsData]);
  const delayBreakdown = useMemo(() => getStageDelays(allOrders, null, pausePeriods, pauseProfile), [allOrders, pausePeriods, pauseProfile]);
  const stats = useMemo(() => ({
    totalOrders: allOrders.length,
    urgentOrders: allOrders.filter(o => o?.urgent).length,
    delayedOrders: delayBreakdown.reduce((sum, d) => sum + d.count, 0),
    completedToday: allOrders.filter(o => o?.status === 'COMPLETED').length
  }), [allOrders, delayBreakdown]);

  const loading = ordersLoading;
  const fetchingError = !!ordersError;

  const refreshTimerRef = useRef(null);
  const queueRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      dashboardRefreshRef.current?.();
      analyticsRefreshRef.current?.();
      unseenRefreshRef.current?.();
      prodReturnedRefreshRef.current?.();
    }, 100);
  }, []);

  useEffect(() => {
    dashboardRefreshRef.current = refreshDashboard;
    analyticsRefreshRef.current = refreshAnalytics;
    unseenRefreshRef.current = refreshUnseen;
    prodReturnedRefreshRef.current = refreshProdReturned;
    editRequestsRefreshRef.current = refreshEditRequests;
    queueRefreshRef.current = queueRefresh;
  }, [refreshDashboard, refreshAnalytics, refreshUnseen, refreshProdReturned, refreshEditRequests, queueRefresh]);

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
        const pd = rc.productDetails;
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
    api.get(`/api/orders/${trackedOrder.id}/timeline`).then(res => {
      setTrackingTimeline([
        ...(res.data.stageEntries || []),
        ...(res.data.routeEntries || [])
      ]);
    })
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

  const handleDashboardSearch = (val) => {
    setContextSearch(val);
  };

  useEffect(() => {
    if (trackedOrder && allOrders.length > 0) {
      const updated = allOrders.find(o => o.id === trackedOrder.id);
      if (updated && updated !== trackedOrder) setTrackedOrder(updated);
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
    { title: 'Delayed Orders', value: stats.delayedOrders, icon: Clock, color: 'text-red-400', bg: 'bg-red-400/10', path: '/orders', state: { filterCategory: 'delayed' } },
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
      {/* Module Cards Landing Page — shown when no tab is selected */}
      {!activeTab && (
        <>
          <div className="flex flex-col items-center text-center gap-2 pt-4">
            <h1 className="text-2xl md:text-4xl font-black theme-text-primary tracking-tight uppercase">Admin Dashboard</h1>
            <p className="theme-text-muted text-xs md:text-sm font-bold uppercase tracking-[0.3em]">Select a department to view analytics</p>
          </div>

          {/* Delay Orders Analysis — per-stage breakdown with drill-down filters */}
          <div className="glass p-5 md:p-6 rounded-3xl border-2 border-red-500/30 shadow-lg shadow-red-500/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10">
                  <Clock className="text-red-400" size={26} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Delay Orders</h2>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">Live delay analysis by workflow stage</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/orders', { state: { filterCategory: 'delayed' } })}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-all"
              >
                View All Delayed ({stats.delayedOrders}) <ArrowUpRight size={14} />
              </button>
            </div>

            {delayBreakdown.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 md:gap-3 mt-4">
                {delayBreakdown.map(({ stage, label, count }) => (
                  <button
                    key={stage}
                    onClick={() => navigate('/orders', { state: { filterCategory: 'delayed', filterDelayStage: stage } })}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-left transition-all"
                    title={`View orders delayed in ${label}`}
                  >
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest theme-text-primary">{label}</span>
                    <span className="text-sm md:text-base font-black text-red-400">{count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <CheckCircle size={16} /> No delayed orders right now
              </div>
            )}
          </div>

          {/* Profile Login Time — real login/logout session records */}
          <div className="glass p-5 md:p-6 rounded-3xl border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10">
                  <LogIn className="text-emerald-400" size={26} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Profile Login Time</h2>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">Real login / logout session records</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {loginSessionsLoading && <Loader2 size={16} className="animate-spin text-emerald-400" />}
                <button
                  onClick={fetchLoginSessions}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest transition-all"
                >
                  <RefreshCcw size={14} /> Refresh
                </button>
                <button
                  onClick={() => setShowLoginSessions(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all"
                >
                  View Login History ({loginSessions.length}) <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            {loginSessions.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-xl border theme-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-800/40 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <th className="px-3 py-2">Profile</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Login Time</th>
                      <th className="px-3 py-2">Logout Time</th>
                      <th className="px-3 py-2">Device</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginSessions.slice(0, 8).map((s) => (
                      <tr key={s.id} className="border-t theme-border hover:bg-gray-800/20">
                        <td className="px-3 py-2 font-bold theme-text-primary">{s.userName}</td>
                        <td className="px-3 py-2 theme-text-muted">{s.role}</td>
                        <td className="px-3 py-2 theme-text-muted">{new Date(s.loginAt).toLocaleString()}</td>
                        <td className="px-3 py-2 theme-text-muted">{s.logoutAt ? new Date(s.logoutAt).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 theme-text-muted">{s.deviceName || '—'}</td>
                        <td className="px-3 py-2">
                          {s.status === 'ACTIVE'
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400 text-[10px] font-black uppercase tracking-widest">Logged Out</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <CheckCircle size={16} /> {loginSessionsLoading ? 'Loading login records…' : 'No login records in the last 30 days'}
              </div>
            )}
            <div className="mt-3 text-[10px] font-black uppercase tracking-widest theme-text-muted">
              {loginSessionsActive} profile(s) currently logged in · latest {Math.min(loginSessions.length, 8)} of {loginSessions.length} records shown
            </div>
          </div>

          {/* Login History modal */}
          {showLoginSessions && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowLoginSessions(false)}>
              <div className="glass max-w-4xl w-full max-h-[85vh] overflow-hidden rounded-2xl border-2 border-emerald-500/30 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b theme-border">
                  <div>
                    <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Profile Login History</h3>
                    <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest">Last 30 days · {loginSessionsActive} currently logged in</p>
                  </div>
                  <button onClick={() => setShowLoginSessions(false)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto flex-1 p-4">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <th className="px-3 py-2">Profile</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Login Time</th>
                        <th className="px-3 py-2">Logout Time</th>
                        <th className="px-3 py-2">Device</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginSessions.map((s) => (
                        <tr key={s.id} className="border-t theme-border hover:bg-gray-800/20">
                          <td className="px-3 py-2 font-bold theme-text-primary">{s.userName}</td>
                          <td className="px-3 py-2 theme-text-muted">{s.role}</td>
                          <td className="px-3 py-2 theme-text-muted">{new Date(s.loginAt).toLocaleString()}</td>
                          <td className="px-3 py-2 theme-text-muted">{s.logoutAt ? new Date(s.logoutAt).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 theme-text-muted">{s.deviceName || '—'}</td>
                          <td className="px-3 py-2">
                            {s.status === 'ACTIVE'
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Active</span>
                              : <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400 text-[10px] font-black uppercase tracking-widest">Logged Out</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Wrong Order Number Attempt Monitoring — blocked invalid range entries */}
          <div className="glass p-5 md:p-6 rounded-3xl border-2 border-red-500/30 shadow-lg shadow-red-500/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10">
                  <Ban className="text-red-400" size={26} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Wrong Attempts</h2>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-widest">Blocked invalid order numbers outside the allowed range</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {wrongLoading && <Loader2 size={16} className="animate-spin text-red-400" />}
                <button
                  onClick={fetchWrongStats}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-black uppercase tracking-widest transition-all"
                >
                  <RefreshCcw size={14} /> Refresh
                </button>
                <button
                  onClick={() => { fetchWrongAttempts(); setShowWrongAttempts(true); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-all"
                >
                  View Wrong Attempts ({wrongStats?.total || 0}) <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <div className="text-2xl font-black text-red-400">{wrongStats?.total ?? '—'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest theme-text-muted mt-0.5">Total Attempts</div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <div className="text-2xl font-black text-red-400">{wrongStats?.today ?? '—'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest theme-text-muted mt-0.5">Today</div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <div className="text-2xl font-black text-red-400">{wrongStats?.blockedCount ?? '—'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest theme-text-muted mt-0.5">Blocked Entries</div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                <div className="text-xl font-black text-red-400 truncate">{wrongStats?.recent?.orderNumber ? `#${wrongStats.recent.orderNumber}` : '—'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest theme-text-muted mt-0.5">Recent Attempt</div>
              </div>
            </div>

            {wrongStats?.recent ? (
              <div className="mt-3 text-[10px] font-black uppercase tracking-widest theme-text-muted">
                Last blocked at {new Date(wrongStats.recent.attemptedAt).toLocaleString()} · attempted {wrongStats.recent.orderNumber} from {wrongStats.recent.role || 'Unknown'} profile
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                <CheckCircle size={16} /> No blocked attempts recorded
              </div>
            )}
          </div>

          {/* Wrong Attempts Timeline modal */}
          {showWrongAttempts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowWrongAttempts(false)}>
              <div className="glass max-w-4xl w-full max-h-[85vh] overflow-hidden rounded-2xl border-2 border-red-500/30 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b theme-border">
                  <div>
                    <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Wrong Attempts Timeline</h3>
                    <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest">Blocked invalid order numbers — {wrongStats?.total || 0} total · {wrongStats?.today || 0} today</p>
                  </div>
                  <button onClick={() => setShowWrongAttempts(false)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"><X size={18} /></button>
                </div>
                <div className="flex items-center justify-between px-5 py-2 border-b theme-border">
                  <span className="text-[10px] font-black uppercase tracking-widest theme-text-muted">At this time, this profile attempted to create this invalid order number.</span>
                  <button onClick={fetchWrongAttempts} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-black uppercase tracking-widest">
                    <RefreshCcw size={12} /> Refresh
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-4">
                  {wrongAttemptsLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
                  ) : wrongAttempts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Ban size={32} className="text-emerald-400" />
                      <p className="mt-2 text-emerald-400 text-xs font-black uppercase tracking-widest">No blocked attempts recorded</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-gray-900">
                        <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Profile / User</th>
                          <th className="px-3 py-2">Attempted Order</th>
                          <th className="px-3 py-2">Allowed Range</th>
                          <th className="px-3 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wrongAttempts.map((a) => (
                          <tr key={a.id} className="border-t theme-border hover:bg-gray-800/20">
                            <td className="px-3 py-2 theme-text-muted whitespace-nowrap">{new Date(a.attemptedAt).toLocaleString()}</td>
                            <td className="px-3 py-2 font-bold theme-text-primary">{a.userName || 'Unknown'} <span className="text-[10px] text-gray-500">({a.role || 'N/A'})</span></td>
                            <td className="px-3 py-2 text-red-400 font-black">#{a.orderNumber}</td>
                            <td className="px-3 py-2 theme-text-muted">{a.allowedRange || '—'}</td>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest">Blocked</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Module Cards Grid — Large Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 pt-4">
            {[
              { id: 'all_phases', label: 'Control Center', desc: 'Production pipeline overview, order approval workflow & real-time stage tracking', icon: LayoutDashboard, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', glow: 'hover:shadow-red-500/20' },
              { id: 'warehouse', label: 'Warehouse', desc: 'Inventory management, stock levels, allocations & warehouse POS analytics', icon: Warehouse, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20' },
              { id: 'dispatch_analytics', label: 'Dispatch', desc: 'Dispatch operations, employee performance, delivery tracking & urgent orders', icon: BarChart3, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', glow: 'hover:shadow-indigo-500/20' },
              { id: 'enamels_delivery', label: 'Enamels Delivery', desc: 'Delivery tracking, earnings at Rs.200/order, COD collection & payment analytics', icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'hover:shadow-emerald-500/20' },
              { id: 'outlet_johar', label: 'Johar Town Outlet', desc: 'Complete 360° operational dashboard — sales, orders, inventory, transfers & more', icon: Store, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'hover:shadow-purple-500/20', outletName: 'Johar Town' },
              { id: 'outlet_jail', label: 'Jail Road Outlet', desc: 'Complete 360° operational dashboard — sales, orders, inventory, transfers & more', icon: Store, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', glow: 'hover:shadow-pink-500/20', outletName: 'Jail Road' },
              { id: 'outlet_abbottabad', label: 'Abbottabad Outlet', desc: 'Complete 360° operational dashboard — sales, orders, inventory, transfers & more', icon: Building, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', glow: 'hover:shadow-teal-500/20', outletName: 'Abbottabad' },
              { id: 'online_store', label: 'Online Store', desc: 'Online orders, revenue analytics, customer management & order processing', icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', glow: 'hover:shadow-cyan-500/20' },
              { id: 'customer_feedback', label: 'Customer Feedback', desc: 'QR feedback system, customer ratings, satisfaction analytics & feedback management', icon: MessageSquare, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', glow: 'hover:shadow-yellow-500/20' },
              { id: 'order_performance', label: 'Order Performance', desc: 'Department-wise operational counts — Faisal, Store, Logo, Production, Dispatch & Delivery', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', glow: 'hover:shadow-blue-500/20' },
              { id: 'audit', label: 'Inventory Audit', desc: 'Approve/reject stock audits — auto-applies physical inventory adjustments & adjustment logs', icon: ClipboardCheck, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', glow: 'hover:shadow-purple-500/20', path: '/audit-review' },
              { id: 'postex', label: 'PostEx Courier', desc: 'Courier shipment tracking, delivery analytics, COD collection & status sync', icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20', path: '/postex-dashboard' },
              { id: 'vendors', label: 'Vendors', desc: 'Vendor accounts, purchase orders, approvals, production-ready stock, payments & document printing', icon: Building, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20', path: '/vendors-admin' },
              { id: 'asm', label: 'ASM', desc: 'Area Sales Manager orders, approvals, analytics & delivery tracking', icon: Users, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', glow: 'hover:shadow-amber-500/20', path: '/vendors-admin' },
            ].map((card, i) => (
              <motion.div key={card.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                whileHover={{ scale: 1.015, y: -3 }} whileTap={{ scale: 0.985 }}
                onClick={() => card.path ? navigate(card.path) : setActiveTab(card.id)}
                className={`glass p-6 md:p-8 rounded-3xl border-2 ${card.border} cursor-pointer transition-all hover:shadow-xl ${card.glow} group`}>
                <div className="flex items-start gap-5">
                  <div className={`p-4 rounded-2xl ${card.bg} shrink-0 transition-transform group-hover:scale-110`}>
                    <card.icon className={card.color} size={36} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">{card.label}</h3>
                    <p className="text-xs md:text-sm font-bold theme-text-muted mt-1.5 uppercase tracking-wider leading-relaxed">{card.desc}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-black text-gray-600 uppercase tracking-widest group-hover:text-gray-400 transition-colors">
                  <span>Open Dashboard</span>
                  <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Tab Header — shown when a tab is selected */}
      {activeTab && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveTab(null)}
                className="p-2 rounded-xl hover:bg-gray-800 transition-all theme-text-muted hover:text-white">
                <X size={18} />
              </button>
              <div>
                <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">
                  {TOP_TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
                </h1>
                <p className="theme-text-secondary font-bold uppercase tracking-widest text-xs md:text-sm mt-1">
                  {activeTab === 'all_phases' && 'Production Approval Hub'}
                  {activeTab === 'online_store' && 'Online Business Analytics'}
                  {activeTab === 'dispatch_analytics' && 'Dispatch Operations & Analytics'}
                  {activeTab === 'enamels_delivery' && 'Delivery Tracking & Earnings'}
                  {activeTab === 'warehouse' && 'Inventory & Allocation Overview'}
                  {activeTab === 'outlet_johar' && 'Johar Town Operations'}
                  {activeTab === 'outlet_jail' && 'Jail Road Operations'}
                  {activeTab === 'outlet_abbottabad' && 'Abbottabad Operations'}
                  {activeTab === 'customer_feedback' && 'QR Feedback Management & Analytics'}
                  {activeTab === 'order_performance' && 'Department-wise Order Performance Analytics'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <button onClick={() => alert('Notification Alert Broadcasted!')}
                  className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500 hover:text-white text-yellow-500 border border-yellow-500/20 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95">
                  <BellRing size={16} />
                  <span>Send Alert</span>
                </button>
              )}
            </div>
          </div>

          {/* Search + Track — only for all_phases */}
          {activeTab === 'all_phases' && (
            <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input type="text" value={contextSearch} onChange={(e) => handleDashboardSearch(e.target.value)}
                    placeholder="Search orders by ID, name, or order number..."
                    className="w-full theme-input rounded-xl py-3 pl-12 pr-4 text-sm font-bold" />
                </div>
                <button onClick={async () => {
                  if (!contextSearch.trim()) return;
                  try {
                    const res = await api.get(`/api/orders/track/${contextSearch.trim().replace(/^#/, '')}`);
                    setTrackedOrder(res.data);
                    setTrackingError('');
                  } catch (err) {
                    setTrackedOrder(null);
                    setTrackingError('Order not found');
                  }
                }} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all whitespace-nowrap">
                  Track Order
                </button>
              </div>
          )}
        </>
      )}
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
            {/* Online Store Tab */}
            {activeTab === 'online_store' && (
              <OnlineStoreCard activeTab={activeTab} />
            )}

            {/* Dispatch Analytics Tab */}
            {activeTab === 'dispatch_analytics' && (
              <DispatchAnalyticsCard activeTab={activeTab} />
            )}

            {/* Enamels Delivery Tab */}
            {activeTab === 'enamels_delivery' && (
              <EnamelsDeliveryCard activeTab={activeTab} />
            )}

            {/* All Phases Tab — Pipeline Sub-Tabs */}
            {activeTab === 'all_phases' && (
              <>
                {/* Module Shortcuts */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Warehouse', desc: 'Inventory & stock', icon: Warehouse, color: 'text-amber-400', bg: 'bg-amber-500/10', tab: 'warehouse' },
                    { label: 'Dispatch', desc: 'Delivery operations', icon: Truck, color: 'text-indigo-400', bg: 'bg-indigo-500/10', tab: 'dispatch_analytics' },
                    { label: 'Enamels Delivery', desc: 'Rider earnings & COD', icon: Truck, color: 'text-emerald-400', bg: 'bg-emerald-500/10', tab: 'enamels_delivery' },
                    { label: 'Online Store', desc: 'E-commerce orders', icon: Globe, color: 'text-cyan-400', bg: 'bg-cyan-500/10', tab: 'online_store' },
                    { label: 'Customer Feedback', desc: 'QR ratings & reviews', icon: MessageSquare, color: 'text-yellow-400', bg: 'bg-yellow-500/10', tab: 'customer_feedback' },
                    { label: 'Johar Town', desc: 'JT Outlet dashboard', icon: Store, color: 'text-purple-400', bg: 'bg-purple-500/10', tab: 'outlet_johar' },
                    { label: 'Jail Road', desc: 'JR Outlet dashboard', icon: Store, color: 'text-pink-400', bg: 'bg-pink-500/10', tab: 'outlet_jail' },
                    { label: 'Abbottabad', desc: 'AB Outlet dashboard', icon: Building, color: 'text-teal-400', bg: 'bg-teal-500/10', tab: 'outlet_abbottabad' },
                  ].map((mod) => (
                    <button key={mod.tab} onClick={() => setActiveTab(mod.tab)}
                      className={`glass p-3 rounded-xl border border-gray-800/50 hover:border-gray-700 text-left transition-all hover:shadow-lg group`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${mod.bg} shrink-0`}>
                          <mod.icon className={mod.color} size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black theme-text-primary uppercase tracking-tight truncate">{mod.label}</p>
                          <p className="text-[10px] font-bold theme-text-muted uppercase tracking-wider truncate">{mod.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

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
              <WarehouseAnalyticsCard activeTab={activeTab} />
            )}

            {/* Alterations Tab */}
            {activeTab === 'alterations' && (
              <AlterationTrackingCard />
            )}

            {/* Order Performance Tab */}
            {activeTab === 'order_performance' && (
              <OrderPerformanceCard activeTab={activeTab} />
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
                        const pd = order.productDetails;
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
                          const pd = rc.productDetails;
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
                                              <p className="text-[9px] theme-text-muted">
                                                {[isUrdu ? toUrduName(p.color) : p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
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
                                              <p className="text-[9px] theme-text-muted">
                                                {[isUrdu ? toUrduName(p.color) : p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
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
                                          +{p.qty} {p.name} {p.color ? `(${isUrdu ? toUrduName(p.color) : p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} returned to stock
                                        </p>
                                      ))}
                                      {requestedProducts.map((p, i) => (
                                        <p key={i} className="text-xs font-bold text-red-400">
                                          -{p.qty} {p.name} {p.color ? `(${isUrdu ? toUrduName(p.color) : p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} deducted from stock
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
                                const paid = isPaidOrder(o);
                                const remaining = getRemainingBalance(o);
                                if (paid) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">PAID</span>;
                                if (remaining > 0) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-orange-500/20 text-orange-400">COD: ₨{remaining.toLocaleString()}</span>;
                                return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-red-500/20 text-red-400">CASH ON DELIVERY</span>;
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

      {/* Customer Feedback */}
      {activeTab === 'customer_feedback' && <AdminFeedbackDashboard />}

      {/* Outlet Detailed Dashboards */}
      {activeTab === 'outlet_johar' && <OutletDetailedCard outlet="Johar Town" />}
      {activeTab === 'outlet_jail' && <OutletDetailedCard outlet="Jail Road" />}
      {activeTab === 'outlet_abbottabad' && <OutletDetailedCard outlet="Abbottabad" />}

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
