import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { Search, Filter, Loader2, Sparkles, AlertCircle, Activity, Clock, Target, History, X } from 'lucide-react';
import socket from '../socket';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const MyTasks = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const [unseenOrders, setUnseenOrders] = useState([]);
  const [seenOrders, setSeenOrders] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [searchTerm, setSearchTerm] = useState(contextSearch);
  const [routingHistory, setRoutingHistory] = useState([]);
  const [showRoutingHistory, setShowRoutingHistory] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState('');
  const [bulkRouting, setBulkRouting] = useState(false);

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
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/bulk-route`, {
        orderIds: Array.from(selectedOrderIds),
        destinationStage: bulkDestination,
        remarks: 'Bulk routed from MyTasks'
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`Routed ${selectedOrderIds.size} order(s) to ${bulkDestination.replace(/_/g, ' ')}`);
      setSelectedOrderIds(new Set());
      setBulkDestination('');
      fetchOrders();
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

  const [activeTab, setActiveTab] = useState('unseen');

  const markAsSeen = async (orderId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${orderId}/mark-seen`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Move from unseen to seen locally
      const moved = unseenOrders.filter(o => o.id === orderId);
      setUnseenOrders(prev => prev.filter(o => o.id !== orderId));
      setSeenOrders(prev => [...moved, ...prev]);
      toast.success('Task accepted! Moved to active list.');
    } catch (error) {
      console.error('Error marking as seen:', error);
      toast.error(error.response?.data?.error || 'Failed to mark as seen');
    }
  };

  const [urgencyFilter, setUrgencyFilter] = useState('ALL');

  const fetchRoutingHistory = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/orders/routing-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRoutingHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching routing history:', err);
    }
  };

  const taskTimerRef = useRef(null);
  const queueTaskRefresh = () => {
    if (taskTimerRef.current) clearTimeout(taskTimerRef.current);
    taskTimerRef.current = setTimeout(() => {
      taskTimerRef.current = null;
      fetchTasks();
    }, 100);
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

    return () => {
      socket.off('order-updated', onOrderUpdated);
      socket.off('stage-rejected', onStageRejected);
      socket.off('new-order', onNewOrder);
      socket.off('stage-completion-requested', onStageCompletionRequested);
      socket.off('payment-updated', onPaymentUpdated);
    };
  }, [queueTaskRefresh]);

  // Initial data load
  useEffect(() => { fetchTasks(); }, []);

  // Polling fallback every 30 seconds (reduced from 15s)
  useEffect(() => {
    const pollInterval = setInterval(() => { fetchTasks(); }, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  const fetchTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const [tasksRes, prodRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders/unseen-tasks`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/orders/production-returned`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null)
      ]);
      setUnseenOrders(tasksRes.data.unseen || []);
      setSeenOrders(tasksRes.data.seen || []);
      if (prodRes) {
        setProductionOrders(prodRes.data.seen ? [...(prodRes.data.unseen || []), ...(prodRes.data.seen || [])] : (prodRes.data || []));
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/orders?status=active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUnseenOrders(response.data || []);
        setSeenOrders([]);
      } catch (e2) {
        console.error('Fallback error:', e2);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      const token = sessionStorage.getItem('token');
      const endpoint = `${API_URL}/api/orders/${orderId}/stages/${stageId}/${action}`;
      await axios.put(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTasks();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(error.response?.data?.message || 'Action failed');
    }
  };

  const displayedOrders = useMemo(() => {
    const source = activeTab === 'unseen' ? unseenOrders : activeTab === 'seen' ? seenOrders : productionOrders;
    if (!searchTerm || searchTerm.trim() === "") return source;

    const searchLower = searchTerm.toLowerCase().trim();
    return source.filter(order => {
      const nameMatch = (order.customerName || "").toLowerCase().includes(searchLower);
      const idMatch = (order.id || "").toLowerCase().includes(searchLower);
      const orderNumMatch = (order.orderNumber || "").toLowerCase().includes(searchLower);
      return nameMatch || idMatch || orderNumMatch;
    });
  }, [activeTab, unseenOrders, seenOrders, productionOrders, searchTerm]);

  // Apply urgency filter
  const filteredOrders = useMemo(() => {
    if (urgencyFilter === 'ALL') return displayedOrders;
    return displayedOrders.filter(o =>
      urgencyFilter === 'URGENT' ? o.priority !== 'NORMAL' : o.priority === 'NORMAL'
    );
  }, [displayedOrders, urgencyFilter]);

  return (
    <div className="space-y-4 md:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-900/30">
            <Activity className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Production Tasks</h1>
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
        </div>
      </div>

      {/* Unseen / Seen / Production Tabs */}
      <div className="flex border-b theme-border mb-6 gap-3 md:gap-6 relative">
        <button
          onClick={() => setActiveTab('unseen')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
            activeTab === 'unseen' ? 'text-blue-500' : 'theme-text-muted hover:theme-text-primary'
          }`}
        >
          <span>Unseen Tasks</span>
          {unseenOrders.length > 0 ? (
            <span className="w-5 h-5 bg-red-500 text-[9px] md:text-[10px] text-white flex items-center justify-center rounded-full font-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
              {unseenOrders.length}
            </span>
          ) : (
            <span className="text-[9px] md:text-[10px] bg-gray-800 theme-text-muted px-2 py-0.5 rounded-full font-black">0</span>
          )}
          {activeTab === 'unseen' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('seen')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
            activeTab === 'seen' ? 'text-blue-500' : 'theme-text-muted hover:theme-text-primary'
          }`}
        >
          <span>Active / Seen Tasks</span>
          <span className="text-[9px] md:text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full font-black">
            {seenOrders.length}
          </span>
          {activeTab === 'seen' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>

        {user?.role === 'STORE' && (
          <button
            onClick={() => setActiveTab('production')}
            className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
              activeTab === 'production' ? 'text-blue-500' : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <span>Production Orders</span>
            <span className="text-[9px] md:text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
              {productionOrders.length}
            </span>
            {activeTab === 'production' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        )}
      </div>

      {/* Routing History Button */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { fetchRoutingHistory(); setShowRoutingHistory(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 transition-all"
        >
          <History size={14} />
          Routing History
        </button>
      </div>

      {/* Production Deadline Summary for PRODUCTION workers */}
      {user?.role === 'PRODUCTION' && filteredOrders.length > 0 && (
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
                  <p className="text-[9px] md:text-[10px] theme-text-secondary font-bold mt-1">Orders past production deadline</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={18} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Approaching</span>
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-white">{approaching.length}</p>
                  <p className="text-[9px] md:text-[10px] theme-text-secondary font-bold mt-1">Deadline within 4 hours</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Target size={18} className="text-emerald-400" />
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Earliest Deadline</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black text-white">
                    {earliestDeadline ? earliestDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                  <p className="text-[9px] md:text-[10px] theme-text-secondary font-bold mt-1">
                    {earliestDeadline ? earliestDeadline.toLocaleDateString() : 'No deadlines set'}
                  </p>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p className="theme-text-secondary font-bold uppercase tracking-widest text-xs">Syncing floor data...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
          <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  userRole={user?.role}
                  onUpdateStage={handleAction}
                  isUnseen={activeTab === 'unseen' || activeTab === 'production'}
                  onMarkSeen={() => markAsSeen(order.id)}
                  selected={selectedOrderIds.has(order.id)}
                  onToggleSelect={toggleOrderSelection}
                />
              ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-96 flex flex-col items-center justify-center space-y-6 theme-bg-subtle rounded-2xl md:rounded-[3rem] border-2 border-dashed theme-border"
        >
          <div className="p-4 md:p-8 theme-bg-subtle rounded-full">
            <Filter size={48} className="theme-text-muted" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold theme-text-secondary">
              {activeTab === 'unseen' ? 'No Unseen Tasks' : activeTab === 'seen' ? 'No Active Tasks' : 'No Production Orders'}
            </h3>
            <p className="text-sm theme-text-muted mt-2">
              {activeTab === 'unseen' 
                ? 'All newly assigned tasks have been acknowledged.' 
                : activeTab === 'seen'
                ? 'No active production tasks are currently in progress.'
                : 'No orders have been received from production yet.'}
            </p>
          </div>
        </motion.div>
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
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Complete audit trail</p>
                </div>
                <button onClick={() => setShowRoutingHistory(false)} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {routingHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-black uppercase tracking-widest text-[9px]">
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
                          <span className="text-[10px] font-black text-white">{entry.sentBy || 'System'}</span>
                          <span className="text-gray-600 text-[8px]">→</span>
                          <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider">{entry.sentToStage?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-[8px] text-gray-500 font-bold">
                          <span className="text-gray-600">{entry.previousStage?.replace(/_/g, ' ')}</span> → <span className="text-blue-400">{entry.newStage?.replace(/_/g, ' ')}</span>
                        </p>
                        {entry.remarks && (
                          <p className="text-[8px] text-gray-600 italic mt-1">{entry.remarks}</p>
                        )}
                        <p className="text-[7px] text-gray-700 font-bold mt-1">
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
