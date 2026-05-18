import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle, 
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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalOrders: 0,
    urgentOrders: 0,
    delayedOrders: 0,
    completedToday: 0
  });
  const [allOrders, setAllOrders] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');

  const handleDashboardSearch = (val) => {
    setContextSearch(val);
  };
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalUrgencyFilter, setApprovalUrgencyFilter] = useState('ALL');
  const [analytics, setAnalytics] = useState(null);
  const [filterStage, setFilterStage] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [fetchingError, setFetchingError] = useState(false);

  const stageList = [
    { id: 'ORDER_ENTRY', icon: ClipboardList },
    { id: 'STORE', icon: Package },
    { id: 'CUTTING', icon: Circle },
    { id: 'STITCHING', icon: Circle },
    { id: 'QA', icon: CheckCircle2 },
    { id: 'LOGO_DESIGN', icon: Circle },
    { id: 'PRESSING_PACKING', icon: Package },
    { id: 'DISPATCH', icon: Truck },
    { id: 'OUT_FOR_DELIVERY', icon: Truck },
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchAnalytics();

    const playNotification = () => {
      const audio = new Audio(NOTIFICATION_SOUND);
      audio.play().catch(e => console.error('Audio play failed:', e));
    };

    socket.on('order-updated', (data) => {
      fetchDashboardData();
      fetchAnalytics();
      if (data?.paymentStatus) {
        toast.success(`Payment updated: ${data.paymentStatus}`);
      }
    });

    socket.on('new-order', (order) => {
      fetchDashboardData();
      fetchAnalytics();
      toast.success(`New Order Received: #${order.orderNumber || order.id.substring(0, 8)}`, {
        icon: '🛍️',
        duration: 5000
      });
      playNotification();
    });

    socket.on('stage-completion-requested', (data) => {
      fetchDashboardData();
      fetchAnalytics();
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-gray-900 shadow-2xl rounded-[1.5rem] pointer-events-auto flex ring-1 ring-emerald-500/50 border border-emerald-500/20 p-4`}>
          <div className="flex-1 w-0 p-1">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ClipboardList size={20} />
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
      playNotification();
    });

    socket.on('payment-updated', (data) => {
        fetchDashboardData();
        toast.success(`Order #${data.orderId?.substring(0, 8)}: Payment ${data.order.paymentStatus}`, { icon: '💰' });
    });

    return () => {
      socket.off('order-updated');
      socket.off('new-order');
      socket.off('stage-completion-requested');
      socket.off('payment-updated');
    };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const response = await axios.get(`${API_URL}/api/orders/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      }
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setFetchingError(false);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const response = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orders = Array.isArray(response.data) ? response.data : [];
      
      setAllOrders(orders);
      setStats({
        totalOrders: orders.length,
        urgentOrders: orders.filter(o => o?.urgent).length,
        delayedOrders: 0,
        completedToday: orders.filter(o => o?.status === 'COMPLETED').length
      });

      if (trackedOrder) {
        const updated = orders.find(o => o.id === trackedOrder.id);
        if (updated) setTrackedOrder(updated);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setFetchingError(true);
      if (error.response?.status === 401) {
        navigate('/login');
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
      fetchDashboardData();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      alert(error.response?.data?.message || 'Action failed');
    }
  };

  const handleClearData = async (e) => {
    e.preventDefault();
    setIsClearing(true);
    setError('');
    
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/admin/clear-data`, 
        { password: adminPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setShowClearModal(false);
      setAdminPassword('');
      alert('System data cleared successfully.');
      fetchDashboardData();
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

   const approvalQueue = useMemo(() => 
    allOrders.filter(o => {
      const isWaiting = o.status === 'WAITING_APPROVAL' || o.status === 'ON_HOLD' || o.stages?.some(s => s.status === 'WAITING_APPROVAL');
      if (!isWaiting) return false;
      if (approvalUrgencyFilter === 'URGENT' && !o.urgent) return false;
      if (approvalUrgencyFilter === 'STANDARD' && o.urgent) return false;

      // Use contextSearch as the primary filter
      if (!contextSearch && !approvalSearch) return true;
      const search = (contextSearch || approvalSearch).toLowerCase();
      return o.id.toLowerCase().includes(search) || 
             (o.orderNumber && o.orderNumber.toLowerCase().includes(search)) || 
             (o.customerName && o.customerName.toLowerCase().includes(search));
    }).sort((a, b) => {
      // 0. Search Match Priority (Boost to top)
      const activeSearch = (contextSearch || approvalSearch)?.toLowerCase();
      if (activeSearch) {
        const aMatch = a.orderNumber?.toLowerCase().includes(activeSearch) || a.id.toLowerCase().includes(activeSearch);
        const bMatch = b.orderNumber?.toLowerCase().includes(activeSearch) || b.id.toLowerCase().includes(activeSearch);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // 1. URGENT
      const aUrgent = !!a.urgent;
      const bUrgent = !!b.urgent;
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      // 2. Delayed
      const getDelay = (order) => {
        const stage = order.stages?.find(s => s.status === 'WAITING_APPROVAL' || s.stageName === order.currentStage);
        if (!stage?.deadlineAt || stage.status === 'COMPLETED') return 0;
        const diff = new Date(stage.deadlineAt).getTime() - new Date().getTime();
        return diff < 0 ? Math.abs(diff) : 0;
      };

      const aDelay = getDelay(a);
      const bDelay = getDelay(b);
      if (aDelay > 0 || bDelay > 0) return bDelay - aDelay;

      // 3. Fallback to createdAt (oldest first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    }), [allOrders, approvalSearch, contextSearch, approvalUrgencyFilter]);

  const initiationQueue = useMemo(() => 
    allOrders.filter(o => {
      const isPending = o.status === 'PENDING' || o.status === 'WAITING_PAYMENT';
      if (!isPending) return false;
      
      const activeSearch = contextSearch || approvalSearch;
      if (!activeSearch) return true;
      const search = activeSearch.toLowerCase();
      return o.id.toLowerCase().includes(search) || 
             (o.orderNumber && o.orderNumber.toLowerCase().includes(search)) || 
             (o.customerName && o.customerName.toLowerCase().includes(search));
    }).sort((a, b) => {
      // Search Match Priority
      const activeSearch = (contextSearch || approvalSearch)?.toLowerCase();
      if (activeSearch) {
        const aMatch = a.orderNumber?.toLowerCase().includes(activeSearch) || a.id.toLowerCase().includes(activeSearch);
        const bMatch = b.orderNumber?.toLowerCase().includes(activeSearch) || b.id.toLowerCase().includes(activeSearch);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
  , [allOrders, approvalSearch, contextSearch]);

  const activeOrdersCount = useMemo(() => 
    allOrders.filter(o => o.status !== 'COMPLETED').length
  , [allOrders]);

  const getStageCount = useCallback((stageId) => {
    return allOrders.filter(o => o.currentStage === stageId && o.status !== 'COMPLETED').length;
  }, [allOrders]);

  const filteredOrdersByStage = useMemo(() => {
    if (filterStage === 'ALL') return [];
    return allOrders.filter(o => o.currentStage === filterStage && o.status !== 'COMPLETED');
  }, [allOrders, filterStage]);

  if (loading && allOrders.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-blue-500" size={48} />
        <p className="text-gray-500 font-black uppercase tracking-[0.3em] text-xs">Syncing Production Hub...</p>
      </div>
    );
  }

  if (fetchingError && allOrders.length === 0) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-6 glass rounded-[3rem] border-2 border-red-500/20">
        <AlertTriangle className="text-red-500" size={64} />
        <div className="text-center">
          <h2 className="text-2xl font-black text-white uppercase italic">Connection Fragmented</h2>
          <p className="text-gray-500 mt-2 font-bold">The production server is currently unreachable.</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 shadow-xl shadow-blue-900/40"
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
          <h1 className="text-3xl font-black text-white tracking-tight">Control Center</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">Production Approval Hub</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const audio = new Audio(NOTIFICATION_SOUND);
              audio.play().catch(e => console.log('Audio play failed:', e));
              alert('Notification Alert Broadcasted!');
            }}
            className="flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500 hover:text-white text-yellow-500 border border-yellow-500/20 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95"
          >
            <BellRing size={16} />
            <span>Send Alert</span>
          </button>
        </div>
      </div>

      {/* Global Dashboard Search - Moved to TOP */}
      <section className="glass rounded-[2rem] p-6 border-2 border-blue-500/30 bg-blue-500/5 relative overflow-hidden shadow-2xl shadow-blue-900/20">
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Search size={80} />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="flex items-center space-x-4 shrink-0">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20 rotate-3">
              <Search className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Search Production</h2>
              <p className="text-gray-500 text-[9px] font-black uppercase tracking-widest mt-0.5">Find any order instantly</p>
            </div>
          </div>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={24} />
            <input
              type="text"
              placeholder="ENTER ORDER NUMBER (e.g. 070) OR CUSTOMER NAME..."
              value={contextSearch}
              onChange={(e) => handleDashboardSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   const query = contextSearch.trim().toLowerCase();
                   const found = allOrders.find(o => 
                    o.orderNumber?.toLowerCase().includes(query) || 
                    o.id.toLowerCase().includes(query) ||
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
              className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 pl-16 pr-8 focus:outline-none focus:border-blue-500 transition-all text-xl font-black tracking-widest placeholder:text-gray-700 shadow-inner"
            />
          </div>
          
          <button
            onClick={() => {
              const query = trackingQuery.trim().toLowerCase();
              if (!query) return;
              const found = allOrders.find(o => 
                o.orderNumber?.toLowerCase().includes(query) || 
                o.id.toLowerCase().includes(query) ||
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
            className="px-10 py-6 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all active:scale-95 shadow-xl shadow-blue-900/40 shrink-0 text-sm"
          >
            Track Order
          </button>
        </div>

        {/* Restore Result Section inside the Search Box glass */}
        <AnimatePresence mode="wait">
          {trackingError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-8 text-center py-6 bg-red-500/5 rounded-3xl border border-red-500/10 text-red-400 font-bold"
            >
              {trackingError}
            </motion.div>
          )}

          {trackedOrder && (
            <motion.div
              key={trackedOrder.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 bg-gray-900/50 rounded-[2.5rem] p-10 border border-gray-800 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center space-x-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-xl">
                    {trackedOrder.customerName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white tracking-tight">{trackedOrder.customerName}</h4>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Order #{trackedOrder.orderNumber || trackedOrder.id.substring(0, 8)}</p>
                  </div>
                </div>
                <div className="text-right">
                    <span className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                        {trackedOrder.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[10px] text-gray-500 font-black mt-2 uppercase tracking-widest">{trackedOrder.currentStage.replace(/_/g, ' ')} Phase</p>
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Production Timeline</span>
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Step {trackedOrder.stages?.filter(s => s.status === 'COMPLETED').length + 1} of {
                      (() => {
                        const pipelines = {
                          'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                          'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                          'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY']
                        };
                        return pipelines[trackedOrder.type]?.length || 8;
                      })()
                    }
                  </span>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const pipelines = {
                      'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                      'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                      'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'LOGO_DESIGN', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY']
                    };
                    const currentPipeline = pipelines[trackedOrder.type] || pipelines['STANDARD'];
                    
                    return currentPipeline.map((stageName, i) => {
                      const stageData = trackedOrder.stages?.find(s => s.stageName === stageName);
                      const isCompleted = stageData?.status === 'COMPLETED';
                      const isCurrent = trackedOrder.currentStage === stageName;
                      const isOrderEntry = stageName === 'ORDER_ENTRY';
                      
                      const displayTime = isCompleted ? (
                        `Finished: ${new Date(stageData.completedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                      ) : isOrderEntry ? (
                        `Created: ${new Date(trackedOrder.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                      ) : stageData?.deadlineAt ? (
                        `Target: ${new Date(stageData.deadlineAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                      ) : 'Waiting';
                      
                      return (
                        <div key={stageName} className="flex items-center gap-4 group">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                              isCompleted ? 'bg-emerald-600 border-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                              isCurrent ? 'bg-blue-600 border-blue-600 text-white animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.3)]' :
                              'bg-gray-950 border-gray-800 text-gray-700'
                            }`}>
                              {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={8} />}
                            </div>
                            {i < currentPipeline.length - 1 && (
                              <div className={`w-0.5 h-8 ${isCompleted ? 'bg-emerald-600' : 'bg-gray-800'}`} />
                            )}
                          </div>
                          
                          <div className="flex-1 pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-gray-600'}`}>
                                  {stageName.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <span className={`text-[10px] font-bold font-mono ${isCompleted ? 'text-emerald-600' : isOrderEntry ? 'text-gray-400' : 'text-gray-500'}`}>
                                {displayTime}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                
                <button
                  onClick={() => navigate('/orders', { state: { searchTerm: trackedOrder.orderNumber } })}
                  className="w-full mt-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  View Full Detailed Job Sheet
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>


      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => stat.path && navigate(stat.path, { state: stat.state })}
            className="glass p-6 rounded-[1.5rem] border border-gray-800 hover:border-blue-500/50 hover:scale-[1.02] transition-all group cursor-pointer active:scale-95"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={stat.color} size={22} />
              </div>
              <span className="flex items-center text-emerald-400 text-[9px] font-black bg-emerald-400/10 px-2 py-1 rounded-full uppercase tracking-widest">
                <ArrowUpRight size={10} className="mr-1" />
                Live
              </span>
            </div>
            <h3 className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em]">{stat.title}</h3>
            <p className="text-3xl font-black text-white mt-1 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>
      


      

      {/* Phase Filter Bar */}
      <div className="bg-gray-900/50 p-4 rounded-[2rem] border border-gray-800 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-3 min-w-max">
          <button
            onClick={() => setFilterStage('ALL')}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              filterStage === 'ALL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'bg-gray-950 text-gray-500 hover:text-gray-300'
            }`}
          >
            All Phases ({activeOrdersCount})
          </button>
          <div className="w-px h-8 bg-gray-800 mx-2"></div>
          {stageList.map((stage) => {
            const count = getStageCount(stage.id);
            return (
              <button
                key={stage.id}
                onClick={() => setFilterStage(stage.id)}
                className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  filterStage === stage.id 
                    ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-900/10' 
                    : 'bg-gray-950 border-transparent text-gray-600 hover:border-gray-800 hover:text-gray-400'
                }`}
              >
                <stage.icon size={14} />
                <span>{stage.id.replace(/_/g, ' ')}</span>
                <span className={`ml-2 px-2 py-0.5 rounded-md ${filterStage === stage.id ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Orders List */}
      {filterStage !== 'ALL' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <Package className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">{filterStage.replace(/_/g, ' ')} Orders</h2>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Active orders in this phase</p>
              </div>
            </div>
            <button 
              onClick={() => setFilterStage('ALL')}
              className="text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest flex items-center gap-2"
            >
              <X size={14} /> Close Filter
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredOrdersByStage.length > 0 ? (
              filteredOrdersByStage.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  userRole={user?.role}
                  onUpdateStage={handleAction}
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center glass rounded-[3rem] border border-gray-800">
                <Package className="mx-auto text-gray-800 mb-4" size={48} />
                <h3 className="text-gray-500 font-black uppercase">No orders in this phase</h3>
              </div>
            )}
          </div>
        </section>
      )}
 
      {/* Initiation Queue */}
      {initiationQueue.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <Sparkles className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Initiation Queue</h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">New orders waiting to start production</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {initiationQueue.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                userRole={user?.role}
                onUpdateStage={handleAction}
              />
            ))}
          </div>
        </section>
      )}

      


      {/* Approval Queue */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <ClipboardList className="text-emerald-400" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Approval Queue</h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Module requests waiting for your authorization</p>
            </div>
            {approvalQueue.length > 0 && !approvalSearch && (
              <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
                {approvalQueue.length} NEW
              </span>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-auto min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
                className="w-full bg-gray-900/50 border-2 border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-all text-sm font-bold text-white"
              />
            </div>
            <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800 shrink-0">
              {['ALL', 'URGENT', 'STANDARD'].map(type => (
                <button
                  key={type}
                  onClick={() => setApprovalUrgencyFilter(type)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    approvalUrgencyFilter === type 
                      ? 'bg-emerald-600 text-white shadow-lg' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {approvalQueue.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {approvalQueue.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                userRole={user?.role}
                onUpdateStage={handleAction}
              />
            ))}
          </div>
        ) : (
          <div className="glass p-16 rounded-[3rem] border border-gray-800 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto border-2 border-gray-800">
              <CheckCircle2 className="text-gray-700" size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-500 uppercase">All clear</h3>
            <p className="text-gray-600 text-sm font-bold max-w-xs mx-auto uppercase tracking-widest">No pending module requests.</p>
          </div>
        )}
      </section>

    </div>
  );
};

export default AdminDashboard;
