import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import useCache from '../hooks/useCache';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { Navigate } from 'react-router-dom';
import { Search, Filter, Loader2, Sparkles, AlertCircle, Activity, Clock, Target, History, X, Eye, CheckCircle, RefreshCcw, ShoppingCart, CheckCircle2, Send } from 'lucide-react';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import socket from '../socket';
import toast from 'react-hot-toast';
import DispatchDashboard from './DispatchDashboard';

const MyTasks = () => {
  const { user } = useAuth();
  if (user?.role === 'INVENTORY_VIEW') return <Navigate to="/inventory" replace={true} />;
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const hasTaskFilters = ['STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'DISPATCH', 'MAIN_EMPLOYEE'].includes(user?.role);
  const showProductionTab = ['STORE', 'STORE_EMPLOYEE'].includes(user?.role);
  const isProductionIn = user?.role === 'PRODUCTION_IN';
  const isProductionOut = user?.role === 'PRODUCTION_OUT';
  const [taskFilter, setTaskFilter] = useState(isProductionOut ? 'assigned' : 'unseen');
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [searchTerm, setSearchTerm] = useState(contextSearch);
  const [routingHistory, setRoutingHistory] = useState([]);
  const [showRoutingHistory, setShowRoutingHistory] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState('');
  const [bulkRouting, setBulkRouting] = useState(false);
  const isStoreRole = user?.role === 'STORE';
  const [storeSubTab, setStoreSubTab] = useState('incoming');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [routingModal, setRoutingModal] = useState(null);
  const [routeDestination, setRouteDestination] = useState('LOGO_DESIGN');
  const [routeRemarks, setRouteRemarks] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);

  // Cache-first: unseen tasks (hasTaskFilters users)
  const { data: unseenData = null, loading: unseenLoading, refresh: refreshUnseen } = useCache(
    hasTaskFilters ? `my-tasks:unseen:${user?.role}` : null,
    { fetcher: () => api.get('/api/orders/unseen-tasks').then(r => r.data), ttl: 60 * 1000 }
  );
  // Cache-first: production returned (STORE only)
  const { data: productionData = null, refresh: refreshProduction } = useCache(
    showProductionTab ? 'my-tasks:production-returned' : null,
    { fetcher: () => api.get('/api/orders/production-returned').then(r => r.data), ttl: 60 * 1000 }
  );
  // Cache-first: active orders (non-task-filter users)
  const { data: fetchedOrders = [], loading: ordersLoading, refresh: refreshOrders } = useCache(
    !hasTaskFilters ? 'my-tasks:active' : null,
    { fetcher: () => api.get('/api/orders?status=active').then(r => Array.isArray(r.data) ? r.data : (r.data?.orders || [])), ttl: 60 * 1000 }
  );
  const { data: storeDashboardData, loading: storeLoading, refresh: refreshStoreDashboard } = useCache(
    isStoreRole ? `my-tasks:store-dashboard:${sourceFilter}` : null,
    {
      fetcher: async () => {
        const results = await Promise.allSettled([
          api.get('/api/orders/store-dashboard', { params: { limit: 250, source: sourceFilter !== 'ALL' ? sourceFilter : undefined } }),
          api.get('/api/orders/production-returned')
        ]);
        return {
          storeDashboard: results[0].status === 'fulfilled' ? results[0].value.data : null,
          productionTasks: results[1].status === 'fulfilled' ? results[1].value.data : null,
        };
      },
      ttl: 60 * 1000,
    }
  );
  const storeDashboard = storeDashboardData?.storeDashboard || null;

  const orders = hasTaskFilters ? [] : fetchedOrders;
  const loading = hasTaskFilters ? unseenLoading : ordersLoading;

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const handleBulkRoute = async () => {
    if (!bulkDestination || selectedOrderIds.size === 0) return;
    setBulkRouting(true);
    try {
      await api.post('/api/orders/bulk-route', {
        orderIds: Array.from(selectedOrderIds),
        destinationStage: bulkDestination,
        remarks: 'Bulk routed from MyTasks'
      });
      toast.success(`Routed ${selectedOrderIds.size} order(s) to ${bulkDestination.replace(/_/g, ' ')}`);
      setSelectedOrderIds(new Set());
      setBulkDestination('');
      refreshTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk route failed');
    } finally {
      setBulkRouting(false);
    }
  };

  useEffect(() => {
    setSearchTerm(contextSearch);
  }, [contextSearch]);

  const handleLocalSearch = (val) => {
    setSearchTerm(val);
    setContextSearch(val);
  };

  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const isDispatchRole = ['DISPATCH', 'MAIN_EMPLOYEE'].includes(user?.role);
  const [dispatchDeliveryFilter, setDispatchDeliveryFilter] = useState('ALL');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState('ALL');

  const filterDispatchOrders = useMemo(() => {
    return (orders) => (orders || []).filter(o => {
      if (dispatchDeliveryFilter !== 'ALL' && o.deliveryType !== dispatchDeliveryFilter) return false;
      if (dispatchStatusFilter !== 'ALL' && o.dispatchStatus !== dispatchStatusFilter) return false;
      return true;
    });
  }, [dispatchDeliveryFilter, dispatchStatusFilter]);

  const filterBySearch = (orders) => {
    if (!searchTerm || searchTerm.trim() === "") return orders || [];
    const s = searchTerm.toLowerCase().trim();
    return (orders || []).filter(o =>
      (o.customerName || "").toLowerCase().includes(s) ||
      (o.id || "").toLowerCase().includes(s) ||
      (o.orderNumber || "").toLowerCase().includes(s)
    );
  };

  const fetchRoutingHistory = async () => {
    try {
      const res = await api.get('/api/orders/routing-history');
      setRoutingHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching routing history:', err);
    }
  };

  const refreshTasks = () => {
    if (hasTaskFilters) {
      refreshUnseen();
      if (showProductionTab) refreshProduction();
    } else {
      refreshOrders();
    }
    if (isStoreRole) refreshStoreDashboard();
  };
  const taskTimerRef = useRef(null);
  const queueTaskRefresh = () => {
    if (taskTimerRef.current) clearTimeout(taskTimerRef.current);
    taskTimerRef.current = setTimeout(refreshTasks, 100);
  };

  useEffect(() => {
    const onOrderUpdated = () => queueTaskRefresh();
    const onStageRejected = (data) => {
      queueTaskRefresh();
      toast.error(`Task Rejected: Order #${data.orderId.substring(0, 8)}`, {
        duration: 8000,
        icon: <AlertCircle className="text-red-500" />
      });
    };
    const onNewOrder = () => queueTaskRefresh();
    const onStageCompletionRequested = () => queueTaskRefresh();
    const onPaymentUpdated = () => queueTaskRefresh();

    socket.on('order-updated', onOrderUpdated);
    socket.on('stage-rejected', onStageRejected);
    socket.on('new-order', onNewOrder);
    socket.on('stage-completion-requested', onStageCompletionRequested);
    socket.on('payment-updated', onPaymentUpdated);
    socket.on('stage-accepted', () => queueTaskRefresh());

    return () => {
      socket.off('order-updated', onOrderUpdated);
      socket.off('stage-rejected', onStageRejected);
      socket.off('new-order', onNewOrder);
      socket.off('stage-completion-requested', onStageCompletionRequested);
      socket.off('payment-updated', onPaymentUpdated);
      socket.off('stage-accepted');
    };
  }, [queueTaskRefresh]);

  // Refresh unseen + production on mount
  useEffect(() => { refreshTasks(); }, []);

  // Polling fallback every 120 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => refreshTasks(), 120000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchUnseenTasks = () => refreshUnseen();

  const fetchProductionTasks = () => refreshProduction();

  const handleMarkSeen = async (orderId) => {
    try {
      await api.post(`/api/orders/${orderId}/mark-seen`);
      fetchUnseenTasks();
      fetchProductionTasks();
    } catch (e) {
      console.error('Failed to mark order as seen:', e);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await api.post(`/api/orders/${orderId}/accept-store`);
      toast.success('Order accepted at Store');
      refreshStoreDashboard();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error accepting order');
    }
  };

  const handleRouteOrder = async () => {
    if (!routingModal) return;
    setRouteLoading(true);
    try {
      await api.post(`/api/orders/${routingModal.id}/store-route`,
        { destinationStage: routeDestination, remarks: routeRemarks }
      );
      toast.success(`Order routed to ${routeDestination.replace(/_/g, ' ')}`);
      setRoutingModal(null);
      setRouteDestination('LOGO_DESIGN');
      setRouteRemarks('');
      refreshStoreDashboard();
      refreshTasks();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error routing order');
    }
    setRouteLoading(false);
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      const endpoint = `/api/orders/${orderId}/stages/${stageId}/${action}`;
      await api.put(endpoint, payload);
      refreshTasks();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(error.response?.data?.error || error.response?.data?.message || 'Action failed');
    }
  };

  const displayedOrders = useMemo(() => {
    if (!searchTerm || searchTerm.trim() === "") return orders;
    const searchLower = searchTerm.toLowerCase().trim();
    return orders.filter(order => {
      const nameMatch = (order.customerName || "").toLowerCase().includes(searchLower);
      const idMatch = (order.id || "").toLowerCase().includes(searchLower);
      const orderNumMatch = (order.orderNumber || "").toLowerCase().includes(searchLower);
      return nameMatch || idMatch || orderNumMatch;
    });
  }, [orders, searchTerm]);

  // Apply urgency filter
  const filteredOrders = useMemo(() => {
    if (urgencyFilter === 'ALL') return displayedOrders;
    return displayedOrders.filter(o =>
      urgencyFilter === 'URGENT' ? o.priority !== 'NORMAL' : o.priority === 'NORMAL'
    );
  }, [displayedOrders, urgencyFilter]);

  const renderOrderCards = (orderList, opts = {}) => {
    const { showUnseen = false, onMarkSeen } = opts;
    if (!orderList || orderList.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
        <AnimatePresence mode="popLayout">
          {orderList.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              userRole={user?.role}
              onUpdateStage={handleAction}
              isUnseen={showUnseen}
              onMarkSeen={onMarkSeen ? () => onMarkSeen(order.id) : undefined}
              selected={selectedOrderIds.has(order.id)}
              onToggleSelect={toggleOrderSelection}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const renderEmpty = (icon, title, subtitle) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-64 flex flex-col items-center justify-center space-y-4 theme-bg-subtle rounded-2xl md:rounded-[3rem] border-2 border-dashed theme-border"
    >
      <div className="p-4 md:p-6 theme-bg-subtle rounded-full">
        {icon}
      </div>
      <div className="text-center">
        <h3 className="text-lg font-bold theme-text-secondary">{title}</h3>
        <p className="text-xs theme-text-muted mt-1">{subtitle}</p>
      </div>
    </motion.div>
  );

  if (user?.role === 'DISPATCH') {
    return <DispatchDashboard />;
  }

  return (
    <div className="space-y-4 md:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-900/30">
            <Activity className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">
              {hasTaskFilters ? 'My Tasks' : 'Active Tasks'}
            </h1>
            <p className="theme-text-secondary text-xs font-bold uppercase tracking-widest mt-1">Managing orders for {user?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search ID or Customer..."
              value={searchTerm}
              onChange={(e) => handleLocalSearch(e.target.value)}
              className="w-full theme-input rounded-2xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>
          {!hasTaskFilters && (
            <div className="flex theme-bg-subtle p-1 rounded-xl theme-border shrink-0">
              {['ALL', 'URGENT', 'STANDARD'].map(type => (
                <button
                  key={type}
                  onClick={() => setUrgencyFilter(type)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    urgencyFilter === type 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Store Section (STORE role only) */}
      {isStoreRole && (
        <div className="space-y-4 md:space-y-6">
          {/* Source filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
              <button onClick={() => setSourceFilter('ALL')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'ALL' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                All Sources
              </button>
              <button onClick={() => setSourceFilter('ONLINE')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'ONLINE' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                <span className="text-blue-400 mr-1">🌐</span>Online
              </button>
              <button onClick={() => setSourceFilter('JOHAR_TOWN')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'JOHAR_TOWN' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                Johar Town
              </button>
              <button onClick={() => setSourceFilter('JAIL_ROAD')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'JAIL_ROAD' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                Jail Road
              </button>
              <button onClick={() => setSourceFilter('ABBOTTABAD')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${sourceFilter === 'ABBOTTABAD' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                Abbottabad
              </button>
            </div>
            <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
              <button onClick={() => setStoreSubTab('incoming')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${storeSubTab === 'incoming' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                <ShoppingCart size={14} />Incoming {storeDashboard?.incoming?.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{storeDashboard.incoming.length}</span>}
              </button>
              <button onClick={() => setStoreSubTab('active')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${storeSubTab === 'active' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                <CheckCircle2 size={14} />Active ({storeDashboard?.active?.length || 0})
              </button>
              <button onClick={() => setStoreSubTab('returns')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${storeSubTab === 'returns' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}>
                <RefreshCcw size={14} />Returns ({(storeDashboard?.returnedFromLogo?.length || 0) + (storeDashboard?.returnedFromProduction?.length || 0) + (storeDashboard?.returnedFromDispatch?.length || 0)})
              </button>
            </div>
          </div>

          {/* Stats cards */}
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

          {/* Incoming */}
          {storeSubTab === 'incoming' && (
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
                          <CheckCircle2 size={14} />
                          Accept Order
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active Orders */}
          {storeSubTab === 'active' && (
            <div className="space-y-4">
              {storeLoading ? (
                <PageLoader text="Loading active orders..." />
              ) : !storeDashboard?.active?.length ? (
                <div className="text-center py-12 glass rounded-2xl theme-border">
                  <CheckCircle2 size={48} className="mx-auto text-gray-600 mb-4" />
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
                          <button className="py-1.5 bg-pink-600/20 text-pink-400 border border-pink-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-pink-600/30 transition-all active:scale-95"
                            onClick={() => { setRoutingModal(order); setRouteDestination('WORKERS'); setRouteRemarks(''); }}>
                            👷 Workers
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
                          <button className="py-1.5 bg-orange-600/20 text-orange-400 border border-orange-500/20 rounded-lg font-black text-[9px] uppercase tracking-wider hover:bg-orange-600/30 transition-all active:scale-95"
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
          {storeSubTab === 'returns' && (
            <div className="space-y-6">
              {storeLoading ? (
                <PageLoader text="Loading returns..." />
              ) : (
                <>
                  {storeDashboard?.returnedFromLogo?.length > 0 && (
                    <div>
                      <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Returned from Logo ({storeDashboard.returnedFromLogo.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {storeDashboard.returnedFromLogo.map(order => (
                          <div key={order.id} className="glass p-4 rounded-2xl border-2 border-blue-500/20">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                              </div>
                              <span className="text-[10px] text-blue-400 font-black uppercase">← Logo</span>
                            </div>
                            {order.stages?.find(s => s.stageName === 'STORE' && s.returnedFrom === 'LOGO_DESIGN')?.returnReason &&
                              <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {order.stages.find(s => s.stageName === 'STORE' && s.returnedFrom === 'LOGO_DESIGN').returnReason}</p>}
                            <button onClick={() => handleAcceptOrder(order.id)}
                              className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                              Re-accept
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {storeDashboard?.returnedFromProduction?.length > 0 && (
                    <div>
                      <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Returned from Production ({storeDashboard.returnedFromProduction.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {storeDashboard.returnedFromProduction.map(order => (
                          <div key={order.id} className="glass p-4 rounded-2xl border-2 border-purple-500/20">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                              </div>
                              <span className="text-[10px] text-purple-400 font-black uppercase">← Production</span>
                            </div>
                            {order.stages?.find(s => s.stageName === 'STORE' && (s.returnedFrom === 'PRODUCTION' || s.returnedFrom === 'PRODUCTION_ACCEPTANCE'))?.returnReason &&
                              <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {order.stages.find(s => s.stageName === 'STORE' && (s.returnedFrom === 'PRODUCTION' || s.returnedFrom === 'PRODUCTION_ACCEPTANCE')).returnReason}</p>}
                            <button onClick={() => handleAcceptOrder(order.id)}
                              className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                              Re-accept
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {storeDashboard?.returnedFromDispatch?.length > 0 && (
                    <div>
                      <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Returned from Dispatch ({storeDashboard.returnedFromDispatch.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                        {storeDashboard.returnedFromDispatch.map(order => (
                          <div key={order.id} className="glass p-4 rounded-2xl border-2 border-amber-500/20">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-black theme-text-primary text-sm">#{order.orderNumber || 'N/A'}</p>
                                <p className="font-bold theme-text-secondary text-xs">{order.customerName}</p>
                              </div>
                              <span className="text-[10px] text-amber-400 font-black uppercase">← Dispatch</span>
                            </div>
                            {order.stages?.find(s => s.stageName === 'STORE' && s.returnedFrom === 'DISPATCH')?.returnReason &&
                              <p className="text-[10px] theme-text-muted font-bold mb-2">Reason: {order.stages.find(s => s.stageName === 'STORE' && s.returnedFrom === 'DISPATCH').returnReason}</p>}
                            <button onClick={() => handleAcceptOrder(order.id)}
                              className="w-full py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-emerald-600/30 transition-all active:scale-95">
                              Re-accept
                            </button>
                          </div>
                        ))}
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

      {/* Multi-filter tabs + Routing History */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {hasTaskFilters ? (
          <div className="flex theme-bg-subtle p-1 rounded-xl theme-border shrink-0">
            {(!isProductionOut) && (
              <button onClick={() => setTaskFilter('unseen')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'unseen' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <Eye size={14} />
                Unseen Tasks {unseenData?.unseen?.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unseenData.unseen.length}</span>}
              </button>
            )}
            {(!isProductionIn) && (
              <button onClick={() => setTaskFilter('assigned')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'assigned' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <CheckCircle size={14} />
                Assigned/Accepted ({unseenData?.seen?.length || 0})
              </button>
            )}
            {showProductionTab && (
              <button onClick={() => setTaskFilter('production')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'production' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <RefreshCcw size={14} />
                Active Tasks ({((productionData?.unseen?.length || 0) + (productionData?.seen?.length || 0)) > 0 && <span className="ml-1 bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{(productionData?.unseen?.length || 0) + (productionData?.seen?.length || 0)}</span>})
              </button>
            )}
          </div>
        ) : null}
        <button
          onClick={() => { fetchRoutingHistory(); setShowRoutingHistory(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest text-gray-400 transition-all"
        >
          <History size={14} />
          Routing History
        </button>
      </div>

      {/* Dispatch Delivery Method Filter */}
      {isDispatchRole && hasTaskFilters && (
        <>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-1">Delivery:</span>
            {[
              { value: 'ALL', label: 'All' },
              { value: 'IMMENT', label: 'Enamels' },
              { value: 'TCS', label: 'TCS' },
              { value: 'POST_EX', label: 'PostEx' },
              { value: 'WALK_IN', label: 'Working Received' },
            ].map(dm => (
              <button
                key={dm.value}
                onClick={() => setDispatchDeliveryFilter(dm.value)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dispatchDeliveryFilter === dm.value
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {dm.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-1">Status:</span>
            {[
              { value: 'ALL', label: 'All' },
              { value: 'PENDING', label: 'Deliver Pending' },
              { value: 'RETURNED', label: 'Return' },
            ].map(ds => (
              <button
                key={ds.value}
                onClick={() => setDispatchStatusFilter(ds.value)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dispatchStatusFilter === ds.value
                    ? 'bg-rose-600 text-white shadow-lg'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {ds.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Production Deadline Summary for PRODUCTION workers */}
      {(['PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT'].includes(user?.role)) && filteredOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {(() => {
            const now = Date.now();
            const ordersWithProdDeadline = filteredOrders.filter(o => o.productionDeadline);
            const overdue = ordersWithProdDeadline.filter(o => new Date(o.productionDeadline).getTime() < now);
            const approaching = ordersWithProdDeadline.filter(o => {
              const diff = new Date(o.productionDeadline).getTime() - now;
              return diff > 0 && diff < 4 * 60 * 60 * 1000;
            });
            const earliestDeadline = ordersWithProdDeadline.length > 0
              ? new Date(Math.min(...ordersWithProdDeadline.map(o => new Date(o.productionDeadline).getTime())))
              : null;
            return (
              <>
                <div className="glass rounded-2xl p-5 border border-red-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle size={18} className="text-red-400" />
                    <span className="text-xs font-black text-red-400 uppercase tracking-wider">Overdue</span>
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-white">{overdue.length}</p>
                  <p className="text-xs md:text-sm theme-text-secondary font-bold mt-1">Orders past production deadline</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={18} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Approaching</span>
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-white">{approaching.length}</p>
                  <p className="text-xs md:text-sm theme-text-secondary font-bold mt-1">Deadline within 4 hours</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Target size={18} className="text-emerald-400" />
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Earliest Deadline</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black text-white">
                    {earliestDeadline ? earliestDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                  <p className="text-xs md:text-sm theme-text-secondary font-bold mt-1">
                    {earliestDeadline ? earliestDeadline.toLocaleDateString() : 'No deadlines set'}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {loading ? (
        <PageLoader text="Syncing floor data..." />
      ) : hasTaskFilters ? (
        <>
          {/* Unseen Tasks */}
          {taskFilter === 'unseen' && (
            <div className="space-y-6">
              {filterBySearch(isDispatchRole ? filterDispatchOrders(unseenData?.unseen) : unseenData?.unseen).length > 0
                ? renderOrderCards(
                    filterBySearch(
                      isDispatchRole
                        ? filterDispatchOrders(unseenData?.unseen)
                        : unseenData?.unseen || []
                    ),
                    { showUnseen: true, onMarkSeen: handleMarkSeen }
                  )
                : renderEmpty(<Eye size={36} className="theme-text-muted" />, 'No Unseen Tasks', 'All new orders have been reviewed and accepted.')
              }
            </div>
          )}

          {/* Assigned/Accepted Tasks */}
          {taskFilter === 'assigned' && (
            <div className="space-y-6">
              {filterBySearch(isDispatchRole ? filterDispatchOrders(unseenData?.seen) : unseenData?.seen).length > 0
                ? renderOrderCards(
                    filterBySearch(
                      isDispatchRole
                        ? filterDispatchOrders(unseenData?.seen)
                        : unseenData?.seen || []
                    )
                  )
                : renderEmpty(<CheckCircle size={36} className="theme-text-muted" />, 'No Assigned Tasks', 'You have not accepted any tasks yet.')
              }
            </div>
          )}

          {/* Production Tasks (STORE only) */}
          {taskFilter === 'production' && showProductionTab && (
            <div className="space-y-6">
              {productionData === null ? (
                <PageLoader text="Loading production tasks..." />
              ) : (
                <>
                  {filterBySearch(productionData?.unseen).length > 0 && (
                    <div>
                      <h3 className="font-black text-xs theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        New Active Tasks ({filterBySearch(productionData.unseen).length})
                      </h3>
                      {renderOrderCards(filterBySearch(productionData.unseen), { showUnseen: true, onMarkSeen: handleMarkSeen })}
                    </div>
                  )}
                  {filterBySearch(productionData?.seen).length > 0 && (
                    <div>
                      <h3 className="font-black text-xs theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-400" />
                        Reviewed Production ({filterBySearch(productionData.seen).length})
                      </h3>
                      {renderOrderCards(filterBySearch(productionData.seen))}
                    </div>
                  )}
                  {(!filterBySearch(productionData?.unseen).length && !filterBySearch(productionData?.seen).length) &&
                    renderEmpty(<RefreshCcw size={36} className="theme-text-muted" />, 'No Production Tasks', 'No orders returned from production yet.')
                  }
                </>
              )}
            </div>
          )}
        </>
      ) : filteredOrders.length > 0 ? (
        renderOrderCards(filteredOrders)
      ) : (
        renderEmpty(<Filter size={36} className="theme-text-muted" />, 'No Tasks', 'No orders assigned to you at this time.')
      )}

      {/* Routing History Modal */}
      <AnimatePresence>
        {showRoutingHistory && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm"
              onClick={() => setShowRoutingHistory(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl md:rounded-[2.5rem] p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Routing History</h3>
                  <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-widest">Complete audit trail</p>
                </div>
                <button onClick={() => setShowRoutingHistory(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {routingHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-black uppercase tracking-widest text-xs md:text-sm">
                  No routing history found
                </div>
              ) : (
                <div className="space-y-3">
                  {routingHistory.map((entry, idx) => (
                    <div key={entry.id || idx} className="flex items-start gap-4 p-4 bg-gray-950/50 rounded-xl border border-gray-800">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <History size={14} className="text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-white">{entry.sentBy || 'System'}</span>
                          <span className="text-gray-600 text-xs">→</span>
                          <span className="text-xs md:text-sm font-black text-blue-400 uppercase tracking-wider">{entry.sentToStage?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold">
                          <span className="text-gray-600">{entry.previousStage?.replace(/_/g, ' ')}</span> → <span className="text-blue-400">{entry.newStage?.replace(/_/g, ' ')}</span>
                        </p>
                        {entry.remarks && (
                          <p className="text-xs text-gray-600 italic mt-1">{entry.remarks}</p>
                        )}
                        <p className="text-[9px] text-gray-700 font-bold mt-1">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Routing Modal (STORE role) */}
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
                      {st !== 'WORKERS' && <option value="WORKERS">👷 Workers</option>}
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
                {bulkRouting ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                Send Selected ({selectedOrderIds.size})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyTasks;
