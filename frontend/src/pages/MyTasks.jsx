import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import socket from '../socket';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MyTasks = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
      const response = await axios.get(`${API_URL}/api/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      const token = localStorage.getItem('token');
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
      'NAME_LOGO': ['NAME_LOGO'],
      'CUSTOM_LOGO': ['CUSTOM_LOGO'],
      'DISPATCH': ['DISPATCH'],
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

  const filteredOrders = orders.filter(order => 
    shouldShowOrder(order) && 
    (order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
     order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (order.orderNumber && order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 rotate-3">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Active Production Queue</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Managing orders for {user?.role?.replace('_', ' ')}</p>
          </div>
        </div>

        <div className="relative group w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search ID or Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border-2 border-gray-800 rounded-2xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none transition-all text-sm font-medium"
          />
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
