import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { Search, Filter, Loader2, Sparkles, AlertCircle, Activity, Clock, Target } from 'lucide-react';
import socket from '../socket';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const MyTasks = () => {
  const { user } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [searchTerm, setSearchTerm] = useState(contextSearch);

  useEffect(() => {
    setSearchTerm(contextSearch);
  }, [contextSearch]);

  const handleLocalSearch = (val) => {
    setSearchTerm(val);
    setContextSearch(val);
  };
  const [seenOrders, setSeenOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('seen_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState('unseen');

  const markAsSeen = (orderId) => {
    setSeenOrders(prev => {
      const updated = [...new Set([...prev, orderId])];
      localStorage.setItem('seen_orders', JSON.stringify(updated));
      return updated;
    });
    toast.success('Task accepted! Moved to active list.');
  };

  const [urgencyFilter, setUrgencyFilter] = useState('ALL');

  useEffect(() => {
    fetchTasks();

    socket.on('order-updated', () => {
      fetchTasks();
    });

    socket.on('stage-rejected', (data) => {
      fetchTasks();
      toast.error(`Task Rejected: Order #${data.orderId.substring(0, 8)}`, {
        duration: 8000,
        icon: <AlertCircle className="text-red-500" />
      });
    });

    return () => {
      socket.off('order-updated');
      socket.off('stage-rejected');
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/orders?status=active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      // Auto mark as seen on action
      if (!seenOrders.includes(orderId)) {
        setSeenOrders(prev => {
          const updated = [...new Set([...prev, orderId])];
          localStorage.setItem('seen_orders', JSON.stringify(updated));
          return updated;
        });
      }

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

  const shouldShowOrder = (order) => {
    if (!user) return false;
    const stageRoleMap = {
      'STORE': ['STORE'],
      'STORE_EMPLOYEE': ['STORE'],
      'PRODUCTION': ['PRODUCTION'],
      'LOGO_DESIGN': ['LOGO_DESIGN'],
      'LOGO_DESIGN_EMPLOYEE': ['LOGO_DESIGN'],
      'LOGO_DESIGNER': ['LOGO_DESIGN'],
      'DISPATCH': ['DISPATCH'],
      'MAIN_EMPLOYEE': ['DISPATCH'],
      'OUT_FOR_DELIVERY': ['OUT_FOR_DELIVERY'],
    };

    const targetStages = stageRoleMap[user.role] || [];
    
    if (!targetStages.includes(order.currentStage) || order.status === 'COMPLETED') {
      return false;
    }

    const currentStageData = order.stages?.find(s => s.stageName === order.currentStage);
    if (currentStageData && currentStageData.status === 'WAITING_APPROVAL') {
      return false;
    }

    return true;
  };

  const filteredOrders = useMemo(() => {
    const result = orders.filter(order => {
      // 1. Check if order should be visible to this role
      if (!shouldShowOrder(order)) return false;
      
      // 2. Urgency Filter (Apply even if no search term)
      if (urgencyFilter === 'URGENT' && order.priority === 'NORMAL') return false;
      if (urgencyFilter === 'STANDARD' && order.priority !== 'NORMAL') return false;

      // 3. If no search term, show everything remaining
      if (!searchTerm || searchTerm.trim() === "") return true;

      const searchLower = searchTerm.toLowerCase().trim();

      // 4. Check for matches (safely)
      const nameMatch = (order.customerName || "").toLowerCase().includes(searchLower);
      const idMatch = (order.id || "").toLowerCase().includes(searchLower);
      const orderNumMatch = (order.orderNumber || "").toLowerCase().includes(searchLower);

      return nameMatch || idMatch || orderNumMatch;
    });

    // Sort: Urgent first, then Delayed, then normally by createdAt
    result.sort((a, b) => {
      // 1. URGENT
      const aUrgent = !!a.urgent;
      const bUrgent = !!b.urgent;
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;

      // 2. Delayed
      const getDelay = (order) => {
        const stage = order.stages?.find(s => s.stageName === order.currentStage);
        if (!stage?.deadlineAt || stage.status === 'COMPLETED') return 0;
        const diff = new Date(stage.deadlineAt).getTime() - new Date().getTime();
        return diff < 0 ? Math.abs(diff) : 0; // The larger the positive delay, the more delayed
      };

      const aDelay = getDelay(a);
      const bDelay = getDelay(b);
      
      if (aDelay > 0 || bDelay > 0) {
        return bDelay - aDelay; // Most delayed first
      }

      // 3. Fallback to createdAt (oldest first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    return result;
  }, [orders, searchTerm, urgencyFilter, user]);

  // Split into unseen and seen
  const unseenTasks = useMemo(() => {
    return filteredOrders.filter(o => !seenOrders.includes(o.id));
  }, [filteredOrders, seenOrders]);

  const seenTasks = useMemo(() => {
    return filteredOrders.filter(o => seenOrders.includes(o.id));
  }, [filteredOrders, seenOrders]);

  const displayedOrders = activeTab === 'unseen' ? unseenTasks : seenTasks;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-900/30">
            <Activity className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Production Tasks</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Managing orders for {user?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search ID or Customer..."
              value={searchTerm}
              onChange={(e) => handleLocalSearch(e.target.value)}
              className="w-full bg-gray-900 border-2 border-gray-800 rounded-2xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>
          <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-800 shrink-0">
            {['ALL', 'URGENT', 'STANDARD'].map(type => (
              <button
                key={type}
                onClick={() => setUrgencyFilter(type)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                  urgencyFilter === type 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Unseen / Seen Tabs */}
      <div className="flex border-b border-gray-800 mb-6 gap-6 relative">
        <button
          onClick={() => setActiveTab('unseen')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
            activeTab === 'unseen' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>Unseen Tasks</span>
          {unseenTasks.length > 0 ? (
            <span className="w-5 h-5 bg-red-500 text-[10px] text-white flex items-center justify-center rounded-full font-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
              {unseenTasks.length}
            </span>
          ) : (
            <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full font-black">0</span>
          )}
          {activeTab === 'unseen' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('seen')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all relative flex items-center gap-2 ${
            activeTab === 'seen' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>Active / Seen Tasks</span>
          <span className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full font-black">
            {seenTasks.length}
          </span>
          {activeTab === 'seen' && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
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
                  <p className="text-4xl font-black text-white">{overdue.length}</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">Orders past production deadline</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock size={18} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Approaching</span>
                  </div>
                  <p className="text-4xl font-black text-white">{approaching.length}</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">Deadline within 4 hours</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Target size={18} className="text-emerald-400" />
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Earliest Deadline</span>
                  </div>
                  <p className="text-3xl font-black text-white">
                    {earliestDeadline ? earliestDeadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">
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
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Syncing floor data...</p>
        </div>
      ) : displayedOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {displayedOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                userRole={user?.role}
                onUpdateStage={handleAction}
                isUnseen={activeTab === 'unseen'}
                onMarkSeen={() => markAsSeen(order.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-96 flex flex-col items-center justify-center space-y-6 bg-gray-900/30 rounded-[3rem] border-2 border-dashed border-gray-800"
        >
          <div className="p-8 bg-gray-800/50 rounded-full">
            <Filter size={48} className="text-gray-600" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-gray-400">
              {activeTab === 'unseen' ? 'No Unseen Tasks' : 'No Active Tasks'}
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              {activeTab === 'unseen' 
                ? 'All newly assigned tasks have been acknowledged.' 
                : 'No active production tasks are currently in progress.'}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MyTasks;
