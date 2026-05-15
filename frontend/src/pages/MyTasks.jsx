import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import { Search, Filter, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import socket from '../socket';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');

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
      const response = await axios.get(`${API_URL}/api/orders`, {
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
      'CUTTING': ['CUTTING'],
      'STITCHING': ['STITCHING'],
      'QA': ['QA'],
      'PRESSING_PACKING': ['PRESSING_PACKING'],
      'LOGO_DESIGN': ['LOGO_DESIGN'],
      'DISPATCH': ['DISPATCH'],
      'MAIN_EMPLOYEE': ['DISPATCH'], // For compatibility with existing seed
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
      if (urgencyFilter === 'URGENT' && !order.urgent) return false;
      if (urgencyFilter === 'STANDARD' && order.urgent) return false;

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

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 rotate-3">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{t('Production Tasks')}</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Managing orders for {user?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-4 w-full md:w-auto">
          <LanguageToggle />
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

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Syncing floor data...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                userRole={user?.role}
                onUpdateStage={handleAction}
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
            <h3 className="text-xl font-bold text-gray-400">Clear Horizon</h3>
            <p className="text-sm text-gray-600 mt-2">Your department is caught up with all tasks.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MyTasks;
