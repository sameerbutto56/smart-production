import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import useCache from '../hooks/useCache';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { Navigate } from 'react-router-dom';
import { Search, Filter, Loader2, Sparkles, AlertCircle, Activity, Clock, Target, History, X, Eye, CheckCircle, RefreshCcw, Scissors, FileText, Calendar } from 'lucide-react';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import socket from '../socket';
import toast from 'react-hot-toast';

const MyTasks = () => {
  const { user } = useAuth();
  if (user?.role === 'INVENTORY_VIEW') return <Navigate to="/inventory" replace={true} />;
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const hasTaskFilters = ['STORE', 'STORE_EMPLOYEE', 'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER', 'DISPATCH', 'MAIN_EMPLOYEE'].includes(user?.role);
  const showProductionTab = ['STORE', 'STORE_EMPLOYEE'].includes(user?.role);
  const isProductionIn = user?.role === 'PRODUCTION_IN';
  const isProductionOut = user?.role === 'PRODUCTION_OUT';
  const isOutlet = user?.role === 'OUTLET';
  const [taskFilter, setTaskFilter] = useState(isOutlet ? 'orders' : (isProductionOut ? 'assigned' : 'unseen'));
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [searchTerm, setSearchTerm] = useState(contextSearch);
  const [routingHistory, setRoutingHistory] = useState([]);
  const [showRoutingHistory, setShowRoutingHistory] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState('');
  const [bulkRouting, setBulkRouting] = useState(false);

  // OUTLET-specific: alteration and engraving returned tasks
  const [altTasks, setAltTasks] = useState([]);
  const [altTasksLoading, setAltTasksLoading] = useState(false);
  const [engTasks, setEngTasks] = useState([]);
  const [engTasksLoading, setEngTasksLoading] = useState(false);
  const [altActionLoading, setAltActionLoading] = useState(null);
  const [engActionLoading, setEngActionLoading] = useState(null);

  const fetchAltTasks = useCallback(async () => {
    setAltTasksLoading(true);
    try { const res = await api.get('/api/alterations/outlet-tasks'); setAltTasks(res.data); } catch {}
    setAltTasksLoading(false);
  }, []);

  const fetchEngTasks = useCallback(async () => {
    setEngTasksLoading(true);
    try { const res = await api.get('/api/engravings/outlet-tasks'); setEngTasks(res.data); } catch {}
    setEngTasksLoading(false);
  }, []);

  const handleAltDone = async (id) => {
    setAltActionLoading(id);
    try { await api.patch(`/api/alterations/${id}/done`); toast.success('Alteration completed'); fetchAltTasks(); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setAltActionLoading(null);
  };

  const handleEngDone = async (id) => {
    setEngActionLoading(id);
    try { await api.patch(`/api/engravings/${id}/done`); toast.success('Engraving received'); fetchEngTasks(); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setEngActionLoading(null);
  };

  // Cache-first: unseen tasks (hasTaskFilters users)
  const { data: unseenData = null, loading: unseenLoading, refresh: refreshUnseen } = useCache(
    hasTaskFilters ? `v2:my-tasks:unseen:${user?.role}` : null,
    { fetcher: () => api.get('/api/orders/unseen-tasks').then(r => r.data), ttl: 60 * 1000 }
  );
  // Cache-first: production returned (STORE only)
  const { data: productionData = null, refresh: refreshProduction } = useCache(
    showProductionTab ? 'v2:my-tasks:production-returned' : null,
    { fetcher: () => api.get('/api/orders/production-returned').then(r => r.data), ttl: 60 * 1000 }
  );
  // Cache-first: active orders (non-task-filter users)
  const { data: fetchedOrders = [], loading: ordersLoading, refresh: refreshOrders } = useCache(
    !hasTaskFilters ? 'v2:my-tasks:active' : null,
    { fetcher: () => api.get('/api/orders?status=active').then(r => Array.isArray(r.data) ? r.data : (r.data?.orders || [])), ttl: 60 * 1000 }
  );

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

  // Manual refetch — called after user actions or via Refresh button
  const refreshTasks = () => {
    if (hasTaskFilters) {
      refreshUnseen();
      if (showProductionTab) refreshProduction();
    } else {
      refreshOrders();
    }
    if (isOutlet) {
      fetchAltTasks();
      fetchEngTasks();
    }
  };

  // Listen for real-time events that should trigger a task refresh
  useEffect(() => {
    const onStageRejected = (data) => {
      toast.error(`Task Rejected: Order #${data.orderId.substring(0, 8)}`, {
        duration: 8000,
        icon: <AlertCircle className="text-red-500" />
      });
    };
    const onOrderVerified = () => { refreshTasks(); };
    const onOrderUpdated = () => { refreshTasks(); };
    const onNewNotification = (data) => {
      if (!data.role || data.role === user?.role) refreshTasks();
    };
    socket.on('stage-rejected', onStageRejected);
    socket.on('order-verified', onOrderVerified);
    socket.on('order-updated', onOrderUpdated);
    socket.on('notification:new', onNewNotification);
    return () => {
      socket.off('stage-rejected', onStageRejected);
      socket.off('order-verified', onOrderVerified);
      socket.off('order-updated', onOrderUpdated);
      socket.off('notification:new', onNewNotification);
    };
  }, [user?.role]);

  // Refresh once on mount
  useEffect(() => { refreshTasks(); }, []);

  // Polling fallback for environments where socket events may be missed
  useEffect(() => {
    if (!user?.role) return;
    const poll = () => refreshTasks();
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [user?.role]);

  // Fetch alteration/engraving tasks when those tabs are selected
  useEffect(() => {
    if (isOutlet && taskFilter === 'alterations') fetchAltTasks();
    if (isOutlet && taskFilter === 'engravings') fetchEngTasks();
  }, [taskFilter, isOutlet]);

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




      {/* Multi-filter tabs + Routing History */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {hasTaskFilters ? (
          <div className="flex theme-bg-subtle p-1 rounded-xl theme-border shrink-0 flex-wrap">
            {isOutlet && (
              <button onClick={() => setTaskFilter('orders')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'orders' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <Activity size={14} /> Orders ({unseenData?.unseen?.length || 0})
              </button>
            )}
            {isOutlet && (
              <button onClick={() => setTaskFilter('alterations')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'alterations' ? 'bg-purple-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <Scissors size={14} /> Alterations {altTasks.length > 0 && <span className="ml-1 bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{altTasks.length}</span>}
              </button>
            )}
            {isOutlet && (
              <button onClick={() => setTaskFilter('engravings')}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                  taskFilter === 'engravings' ? 'bg-cyan-600 text-white shadow-lg' : 'theme-text-muted hover:theme-text-primary hover:bg-gray-800/50'
                }`}
              >
                <Sparkles size={14} /> Engravings {engTasks.length > 0 && <span className="ml-1 bg-cyan-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{engTasks.length}</span>}
              </button>
            )}
            {(!isOutlet) && (!isProductionOut) && (
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
          onClick={refreshTasks}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest text-gray-400 transition-all"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
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

          {/* OUTLET: Orders tab (unseen + accepted orders) */}
          {isOutlet && taskFilter === 'orders' && (
            <div className="space-y-6">
              {(unseenData?.unseen?.length > 0 || unseenData?.seen?.length > 0) ? (
                <>
                  {filterBySearch(unseenData?.unseen).length > 0 && (
                    <div>
                      <h3 className="font-black text-xs theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        New Orders ({filterBySearch(unseenData.unseen).length})
                      </h3>
                      {renderOrderCards(filterBySearch(unseenData.unseen), { showUnseen: true, onMarkSeen: handleMarkSeen })}
                    </div>
                  )}
                  {filterBySearch(unseenData?.seen).length > 0 && (
                    <div>
                      <h3 className="font-black text-xs theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-400" />
                        Accepted Orders ({filterBySearch(unseenData.seen).length})
                      </h3>
                      {renderOrderCards(filterBySearch(unseenData.seen))}
                    </div>
                  )}
                </>
              ) : (
                renderEmpty(<Activity size={36} className="theme-text-muted" />, 'No Orders', 'No order tasks assigned to you.')
              )}
            </div>
          )}

          {/* OUTLET: Alterations tab */}
          {isOutlet && taskFilter === 'alterations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{altTasks.length} completed alteration{altTasks.length !== 1 ? 's' : ''} returned</p>
                <button onClick={fetchAltTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 border border-gray-700/50">
                  <RefreshCcw size={14} /> Refresh
                </button>
              </div>
              {altTasksLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}</div>
              ) : altTasks.length === 0 ? (
                renderEmpty(<Scissors size={36} className="theme-text-muted" />, 'No Alterations', 'No completed alterations returned yet.')
              ) : (
                <div className="space-y-3">
                  {altTasks.map(alt => {
                    let prods = [];
                    try { prods = typeof alt.products === 'string' ? JSON.parse(alt.products) : (alt.products || []); } catch {}
                    return (
                      <div key={alt.id} className="bg-gray-900/80 border border-purple-500/20 rounded-2xl p-6 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-lg font-black text-white">{alt.alterationNumber}</p>
                            {alt.orderNumber && alt.orderNumber !== alt.alterationNumber && <p className="text-xs text-gray-400">Order: {alt.orderNumber}</p>}
                            <p className="text-sm text-gray-400">{alt.customerName}</p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">RETURNED</span>
                        </div>
                        {prods.map((p, i) => (
                          <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
                            <p className="text-xs font-bold text-white">{p.productName} {p.color ? `(${p.color})` : ''} {p.size ? `(${p.size})` : ''}</p>
                            {p.alterationNote && <p className="text-[11px] text-purple-300 italic mt-1">Special Note: {p.alterationNote}</p>}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Calendar size={12} />
                          {alt.completedAt && new Date(alt.completedAt).toLocaleDateString('en-PK')}
                        </div>
                        <button onClick={() => handleAltDone(alt.id)} disabled={altActionLoading === alt.id}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                          {altActionLoading === alt.id ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle size={14} />} Done
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* OUTLET: Engravings tab */}
          {isOutlet && taskFilter === 'engravings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{engTasks.length} completed engraving{engTasks.length !== 1 ? 's' : ''} returned</p>
                <button onClick={fetchEngTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 border border-gray-700/50">
                  <RefreshCcw size={14} /> Refresh
                </button>
              </div>
              {engTasksLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}</div>
              ) : engTasks.length === 0 ? (
                renderEmpty(<Sparkles size={36} className="theme-text-muted" />, 'No Engravings', 'No completed engravings returned yet.')
              ) : (
                <div className="space-y-3">
                  {engTasks.map(eng => {
                    let prods = [];
                    try { prods = typeof eng.products === 'string' ? JSON.parse(eng.products) : (eng.products || []); } catch {}
                    return (
                      <div key={eng.id} className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-6 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-lg font-black text-white">{eng.engravingNumber}</p>
                            {eng.orderNumber && eng.orderNumber !== eng.engravingNumber && <p className="text-xs text-gray-400">Order: {eng.orderNumber}</p>}
                            <p className="text-sm text-gray-400">{eng.customerName}</p>
                          </div>
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">RETURNED</span>
                        </div>
                        {prods.map((p, i) => (
                          <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
                            <p className="text-xs font-bold text-white">{p.productName} {p.color ? `(${p.color})` : ''} {p.size ? `(${p.size})` : ''}</p>
                            {p.engravingText && <p className="text-[11px] text-cyan-300">Text: {p.engravingText}</p>}
                            {p.position && <p className="text-[11px] text-gray-400">Position: {p.position}</p>}
                            {p.instructions && <p className="text-[11px] text-gray-400 italic">{p.instructions}</p>}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Calendar size={12} />
                          {eng.completedAt && new Date(eng.completedAt).toLocaleDateString('en-PK')}
                        </div>
                        <button onClick={() => handleEngDone(eng.id)} disabled={engActionLoading === eng.id}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                          {engActionLoading === eng.id ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle size={14} />} Done
                        </button>
                      </div>
                    );
                  })}
                </div>
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
