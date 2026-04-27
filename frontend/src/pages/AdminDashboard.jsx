import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Trash2,
  Lock,
  ShieldAlert,
  X,
  ClipboardList,
  Truck,
  Search,
  MapPin,
  CheckCircle2,
  Circle,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL);

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    urgentOrders: 0,
    delayedOrders: 0,
    completedToday: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  const [trackingQuery, setTrackingQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');

  useEffect(() => {
    fetchDashboardData();

    socket.on('order-updated', fetchDashboardData);
    socket.on('new-order', fetchDashboardData);

    return () => {
      socket.off('order-updated');
      socket.off('new-order');
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      const orders = response.data;
      
      setAllOrders(orders);
      setRecentOrders(orders.slice(0, 5));
      setStats({
        totalOrders: orders.length,
        urgentOrders: orders.filter(o => o.urgent).length,
        delayedOrders: 0,
        completedToday: orders.filter(o => o.status === 'COMPLETED').length
      });

      // Update tracked order in real-time
      if (trackedOrder) {
        const updated = orders.find(o => o.id === trackedOrder.id);
        if (updated) setTrackedOrder(updated);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const statCards = [
    { title: 'Total Active Orders', value: stats.totalOrders, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { title: 'Urgent Priority', value: stats.urgentOrders, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { title: 'Delayed Stages', value: stats.delayedOrders, icon: Clock, color: 'text-red-400', bg: 'bg-red-400/10' },
    { title: 'Completed Today', value: stats.completedToday, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ];

  const handleUpdateStage = async (orderId, stageId, nextStage) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${API_URL}/api/orders/${orderId}/stages/${stageId}`, {
        status: 'COMPLETED',
        nextStage
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error moving stage:', error);
    }
  };

  const handleSendToOrderList = async (orderId, stageId) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await axios.put(`${API_URL}/api/orders/${orderId}/stages/${stageId}`, {
        status: 'COMPLETED'
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error sending to order list:', error);
    }
  };

  const getNextStage = (current) => {
    const pipeline = ['STORE', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'PRESSING', 'PACKAGING', 'DISPATCH'];
    const index = pipeline.indexOf(current);
    return index < pipeline.length - 1 ? pipeline[index + 1] : null;
  };

  const handleClearData = async (e) => {
    e.preventDefault();
    setIsClearing(true);
    setError('');
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      
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

  return (
    <div className="space-y-8">
      {/* ... header and stats ... */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Overview</h1>
          <p className="text-gray-400">Real-time status of all factory floors</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-6 rounded-2xl"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={stat.color} size={24} />
              </div>
              <span className="flex items-center text-emerald-400 text-xs font-bold bg-emerald-400/10 px-2 py-1 rounded-lg">
                <ArrowUpRight size={12} className="mr-1" />
                12%
              </span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">{stat.title}</h3>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Order Tracking Section */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-xl">
            <MapPin className="text-blue-400" size={22} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Track Order</h3>
            <p className="text-gray-500 text-xs">Enter order ID to track in real-time</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Enter order ID (e.g. ORD-772)..."
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = trackingQuery.trim().toLowerCase();
                  if (!query) return;
                  const found = allOrders.find(o =>
                    o.id.toLowerCase().includes(query) ||
                    (o.orderNumber && o.orderNumber.toLowerCase().includes(query))
                  );
                  if (found) {
                    setTrackedOrder(found);
                    setTrackingError('');
                  } else {
                    setTrackedOrder(null);
                    setTrackingError('No order found with that ID.');
                  }
                }
              }}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <button
            onClick={() => {
              const query = trackingQuery.trim().toLowerCase();
              if (!query) return;
              const found = allOrders.find(o =>
                o.id.toLowerCase().includes(query) ||
                (o.orderNumber && o.orderNumber.toLowerCase().includes(query))
              );
              if (found) {
                setTrackedOrder(found);
                setTrackingError('');
              } else {
                setTrackedOrder(null);
                setTrackingError('No order found with that ID.');
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
          >
            <Search size={16} />
            Track
          </button>
        </div>

        {trackingError && (
          <div className="text-center py-6 text-red-400 text-sm font-medium">
            {trackingError}
          </div>
        )}

        {trackedOrder && (() => {
          const pipeline = ['STORE', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'PRESSING', 'PACKAGING', 'DISPATCH'];
          const finalStatuses = ['READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
          const isFinal = finalStatuses.includes(trackedOrder.status);
          const currentIndex = isFinal ? pipeline.length : pipeline.indexOf(trackedOrder.currentStage);

          // Build stage info from order stages
          const stageMap = {};
          if (trackedOrder.stages) {
            trackedOrder.stages.forEach(s => {
              stageMap[s.stageName] = s;
            });
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50"
            >
              {/* Order Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center font-black text-lg shadow-lg">
                    {trackedOrder.customerName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{trackedOrder.customerName}</h4>
                    <p className="text-xs text-gray-500">Order #{trackedOrder.orderNumber || trackedOrder.id.substring(0, 8)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {trackedOrder.urgent && (
                    <span className="text-blue-400 text-xs font-bold flex items-center bg-blue-400/10 px-3 py-1.5 rounded-full">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                      URGENT
                    </span>
                  )}
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    isFinal ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                  }`}>
                    {trackedOrder.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Visual Pipeline Map */}
              <div className="relative">
                {/* Desktop: Horizontal */}
                <div className="hidden md:flex items-start justify-between relative">
                  {/* Connection line */}
                  <div className="absolute top-5 left-[5%] right-[5%] h-1 bg-gray-700 rounded-full z-0">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${currentIndex >= 0 ? (currentIndex / (pipeline.length - 1)) * 100 : 0}%` }}
                      transition={{ duration: 1, ease: 'easeInOut' }}
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                    />
                  </div>

                  {pipeline.map((stage, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex && !isFinal;
                    const isPending = index > currentIndex;
                    const stageData = stageMap[stage];

                    return (
                      <div key={stage} className="flex flex-col items-center relative z-10" style={{ width: `${100 / pipeline.length}%` }}>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                            : isCurrent ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/40 animate-pulse'
                            : 'bg-gray-800 border-gray-600 text-gray-500'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 size={18} /> : isCurrent ? <Package size={18} /> : <Circle size={14} />}
                        </motion.div>
                        <p className={`text-[10px] font-bold mt-2 text-center uppercase tracking-tight ${
                          isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-gray-600'
                        }`}>
                          {stage.replace(/_/g, ' ')}
                        </p>
                        {stageData && stageData.completedAt && (
                          <p className="text-[8px] text-gray-600 mt-1">
                            {new Date(stageData.completedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Final: Delivery */}
                  <div className="flex flex-col items-center relative z-10" style={{ width: `${100 / pipeline.length}%` }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: pipeline.length * 0.1 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isFinal ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-gray-800 border-gray-600 text-gray-500'
                      }`}
                    >
                      <Truck size={18} />
                    </motion.div>
                    <p className={`text-[10px] font-bold mt-2 text-center uppercase tracking-tight ${
                      isFinal ? 'text-emerald-400' : 'text-gray-600'
                    }`}>
                      DELIVERY
                    </p>
                  </div>
                </div>

                {/* Mobile: Vertical */}
                <div className="md:hidden space-y-1">
                  {pipeline.map((stage, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex && !isFinal;
                    const stageData = stageMap[stage];

                    return (
                      <div key={stage} className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            isCompleted ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isCurrent ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                            : 'bg-gray-800 border-gray-600 text-gray-500'
                          }`}>
                            {isCompleted ? <CheckCircle2 size={14} /> : isCurrent ? <Package size={14} /> : <Circle size={10} />}
                          </div>
                          {index < pipeline.length - 1 && (
                            <div className={`w-0.5 h-6 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-gray-700'
                            }`} />
                          )}
                        </div>
                        <div className="pb-6">
                          <p className={`text-xs font-bold uppercase ${
                            isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-gray-600'
                          }`}>
                            {stage.replace(/_/g, ' ')}
                          </p>
                          {stageData && stageData.completedAt && (
                            <p className="text-[9px] text-gray-600">
                              {new Date(stageData.completedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Final delivery node */}
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      isFinal ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-500'
                    }`}>
                      <Truck size={14} />
                    </div>
                    <p className={`text-xs font-bold uppercase ${
                      isFinal ? 'text-emerald-400' : 'text-gray-600'
                    }`}>DELIVERY</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-bold">Recent Production Orders</h3>
            <button className="text-blue-400 text-sm hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-gray-700">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Current Stage</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentOrders.map((order) => {
                  const currentStageObj = order.stages?.[0];
                  const nextStage = currentStageObj ? getNextStage(currentStageObj.stageName) : null;
                  const isDispatch = order.currentStage === 'DISPATCH';
                  
                  return (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-xs text-gray-500">#{order.id.substring(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 uppercase text-[10px]">
                          {order.currentStage.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {order.urgent ? (
                          <span className="text-blue-400 text-xs font-bold flex items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                            Urgent
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === 'COMPLETED' || order.status === 'OUT_FOR_DELIVERY' ? 'bg-emerald-400/10 text-emerald-400' 
                          : order.status === 'READY_FOR_DELIVERY' ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-yellow-400/10 text-yellow-400'
                        }`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isDispatch && order.status !== 'COMPLETED' && order.status !== 'READY_FOR_DELIVERY' && currentStageObj ? (
                          <button 
                            onClick={() => handleSendToOrderList(order.id, currentStageObj.id)}
                            className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ml-auto"
                          >
                            <ClipboardList size={14} />
                            <span>Send to Order List</span>
                          </button>
                        ) : order.status !== 'COMPLETED' && order.status !== 'READY_FOR_DELIVERY' && order.status !== 'OUT_FOR_DELIVERY' && currentStageObj && nextStage ? (
                          <button 
                            onClick={() => handleUpdateStage(order.id, currentStageObj.id, nextStage)}
                            className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ml-auto"
                          >
                            <span>Move to {nextStage.replace(/_/g, ' ')}</span>
                            <ArrowUpRight size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass p-6 rounded-2xl">
          <h3 className="font-bold mb-6">Efficiency metrics</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Cutting Efficiency</span>
                <span className="text-emerald-400">92%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[92%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Stitching Speed</span>
                <span className="text-blue-400">78%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[78%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Quality Pass Rate</span>
                <span className="text-yellow-400">85%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 w-[85%]"></div>
              </div>
            </div>
          </div>

          <div className="mt-10 p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl">
            <h4 className="text-sm font-bold text-blue-400 mb-1">Weekly Summary</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Production is up by 15% compared to last week. Most delays are occurring in the Stitching department.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-12 p-8 border-2 border-red-500/20 bg-red-500/5 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 rounded-2xl">
              <ShieldAlert className="text-red-500" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Danger Zone</h3>
              <p className="text-gray-400 text-sm max-w-xl">
                Clearing all data will permanently delete all orders, inventory items, and logs. 
                This action is irreversible. Use with extreme caution.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowClearModal(true)}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap"
          >
            <Trash2 size={20} />
            Wipe System Data
          </button>
        </div>
      </div>

      {/* Clear Data Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !isClearing && setShowClearModal(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md glass p-8 rounded-3xl border border-red-500/30 shadow-2xl shadow-red-500/10"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Lock className="text-red-500" size={20} />
                </div>
                <h3 className="text-xl font-bold">Admin Verification</h3>
              </div>
              {!isClearing && (
                <button onClick={() => setShowClearModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              )}
            </div>

            <form onSubmit={handleClearData} className="space-y-6">
              <p className="text-gray-400 text-sm">
                Please enter your admin password to confirm the permanent deletion of all system data.
              </p>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Password</label>
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-red-500/50 transition-colors text-white"
                  placeholder="Enter admin password"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  disabled={isClearing}
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isClearing || !adminPassword}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {isClearing ? 'Clearing...' : 'Confirm Wipe'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
