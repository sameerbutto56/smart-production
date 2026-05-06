import React, { useState, useEffect } from 'react';
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
  Circle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import OrderCard from '../components/OrderCard';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const NOTIFICATION_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const AdminDashboard = () => {
  const { user } = useAuth();
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
  const [trackingQuery, setTrackingQuery] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [analytics, setAnalytics] = useState(null);

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
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/orders/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      const orders = response.data;
      
      setAllOrders(orders);
      setStats({
        totalOrders: orders.length,
        urgentOrders: orders.filter(o => o.urgent).length,
        delayedOrders: 0,
        completedToday: orders.filter(o => o.status === 'COMPLETED').length
      });

      if (trackedOrder) {
        const updated = orders.find(o => o.id === trackedOrder.id);
        if (updated) setTrackedOrder(updated);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleAction = async (orderId, stageId, action, payload = {}) => {
    try {
      const token = localStorage.getItem('token');
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

  const statCards = [
    { title: 'Total Active Orders', value: stats.totalOrders, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { title: 'Urgent Priority', value: stats.urgentOrders, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { title: 'Delayed Stages', value: stats.delayedOrders, icon: Clock, color: 'text-red-400', bg: 'bg-red-400/10' },
    { title: 'Completed Today', value: stats.completedToday, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ];

  const approvalQueue = allOrders.filter(o => o.stages?.some(s => s.status === 'WAITING_APPROVAL'));

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Faisal Control Center</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2">Production Approval Hub</p>
        </div>
        
        {/* Executive Summary Bar */}
        <div className="flex bg-gray-900/50 backdrop-blur-xl rounded-[2rem] p-2 border border-gray-800 shadow-2xl">
          <div className="px-8 py-4 border-r border-gray-800">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Today's Revenue</p>
            <p className="text-2xl font-black text-emerald-400 tracking-tighter">
              ${allOrders.filter(o => {
                const today = new Date().toISOString().split('T')[0];
                return o.updatedAt.split('T')[0] === today;
              }).reduce((acc, curr) => acc + (curr.customizationPrice || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="px-8 py-4 border-r border-gray-800">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Approvals Done</p>
            <p className="text-2xl font-black text-blue-400 tracking-tighter">
              {allOrders.filter(o => {
                const today = new Date().toISOString().split('T')[0];
                return o.updatedAt.split('T')[0] === today && o.status !== 'PENDING';
              }).length}
            </p>
          </div>
          <div className="px-8 py-4 hidden md:block">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Avg Lead Time</p>
            <p className="text-2xl font-black text-purple-400 tracking-tighter">
              {analytics?.stagePerformance ? (Object.values(analytics.stagePerformance).reduce((acc, curr) => acc + parseFloat(curr.avgHours), 0) / Object.keys(analytics.stagePerformance).length).toFixed(1) : '0.0'}h
            </p>
          </div>
        </div>
      </div>


      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-8 rounded-[2rem] border border-gray-800 hover:border-gray-700 transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-[1.25rem] ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={stat.color} size={28} />
              </div>
              <span className="flex items-center text-emerald-400 text-[10px] font-black bg-emerald-400/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
                <ArrowUpRight size={12} className="mr-1" />
                Live
              </span>
            </div>
            <h3 className="text-gray-500 text-[11px] font-black uppercase tracking-[0.2em]">{stat.title}</h3>
            <p className="text-4xl font-black text-white mt-2 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      </section>
      
      {/* Stock Awareness Alert */}
      {allOrders.filter(o => o.currentStage === 'STORE').length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center space-x-6">
            <div className="p-4 bg-amber-500/10 rounded-2xl">
              <Package className="text-amber-500" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Stock Review Needed</h3>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                {allOrders.filter(o => o.currentStage === 'STORE').length} Orders waiting for material verification in STORE
              </p>
            </div>
          </div>
          <Link 
            to="/inventory" 
            className="px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-900/20"
          >
            Check Inventory Stock
          </Link>
        </motion.div>
      )}

      {/* Approval Queue */}
      <section>
        <div className="flex items-center space-x-4 mb-8">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <ClipboardList className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Approval Queue</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Module requests waiting for your authorization</p>
          </div>
          {approvalQueue.length > 0 && (
            <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
              {approvalQueue.length} NEW
            </span>
          )}
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

      {/* Order Tracking */}
      <section className="glass rounded-[3rem] p-12 border border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5">
            <MapPin size={200} />
        </div>
        
        <div className="flex items-center space-x-4 mb-10">
          <div className="p-3 bg-blue-500/10 rounded-2xl">
            <Search className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Advanced Tracking</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Search and track any order across the production line</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-12 relative z-10">
          <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="Enter Order Number or ID..."
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              className="w-full bg-gray-900/50 border-2 border-gray-800 rounded-2xl py-5 pl-16 pr-6 focus:outline-none focus:border-blue-500 transition-all text-lg font-bold"
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
            className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
          >
            Track Order
          </button>
        </div>

        <AnimatePresence mode="wait">
          {trackingError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-10 bg-red-500/5 rounded-3xl border border-red-500/10 text-red-400 font-bold"
            >
              {trackingError}
            </motion.div>
          )}

          {trackedOrder && (
            <motion.div
              key={trackedOrder.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/50 rounded-[2.5rem] p-10 border border-gray-800"
            >
              {/* Simplified Tracking UI */}
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
                </div>
              </div>

              {/* Order Flow Visual */}
              <div className="relative pt-8 pb-4 px-4">
                <div className="absolute top-[50px] left-0 right-0 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-blue-500 shadow-[0_0_15px_#3b82f6]" 
                        style={{ width: `${(trackedOrder.stages?.length / 8) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between relative z-10">
                    {['ENTRY', 'STORE', 'CUTTING', 'STITCH', 'QA', 'PACK', 'DISPATCH'].map((s, i) => (
                        <div key={s} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                i < trackedOrder.stages?.length ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-900 border-gray-800 text-gray-600'
                            }`}>
                                {i < trackedOrder.stages?.length ? <CheckCircle2 size={20} /> : <Circle size={12} />}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tighter mt-3 ${i < trackedOrder.stages?.length ? 'text-blue-400' : 'text-gray-600'}`}>
                                {s}
                            </span>
                        </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      </section>
      
      {/* Quick Payment Management */}
      <section className="glass rounded-[3rem] p-12 border border-gray-800">
        <div className="flex items-center space-x-4 mb-10">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <CheckCircle2 className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Payment Tracker</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Unpaid customization fees and balances</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="pb-6 text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Order #</th>
                <th className="pb-6 text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Customer</th>
                <th className="pb-6 text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Custom Fee</th>
                <th className="pb-6 text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">Status</th>
                <th className="pb-6 text-[10px] font-black text-gray-500 uppercase tracking-widest px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {allOrders.filter(o => o.paymentStatus !== 'FULL_PAID' && o.customizationPrice > 0).map(order => (
                <tr key={order.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-6 px-4 font-black text-blue-400">#{order.orderNumber || order.id.substring(0, 8)}</td>
                  <td className="py-6 px-4 font-bold">{order.customerName}</td>
                  <td className="py-6 px-4 font-black text-emerald-400">${order.customizationPrice.toFixed(2)}</td>
                  <td className="py-6 px-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${order.paymentStatus === 'ADVANCE_PAID' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-6 px-4 text-right">
                    <button 
                      onClick={() => {
                        const status = order.paymentStatus === 'PENDING' ? 'ADVANCE_PAID' : 'FULL_PAID';
                        axios.put(`${API_URL}/api/orders/${order.id}/payment`, { paymentStatus: status }, {
                          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                        }).then(() => fetchDashboardData());
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/20"
                    >
                      Mark as {order.paymentStatus === 'PENDING' ? 'Advance' : 'Paid'}
                    </button>
                  </td>
                </tr>
              ))}
              {allOrders.filter(o => o.paymentStatus !== 'FULL_PAID' && o.customizationPrice > 0).length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">All accounts settled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Efficiency & Danger Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="glass p-10 rounded-[3rem] border border-gray-800">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Stage Performance (Avg Time)</h3>
            <div className="space-y-6">
                {analytics?.stagePerformance ? Object.entries(analytics.stagePerformance).map(([stage, stats]) => (
                    <div key={stage}>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                            <span>{stage.replace(/_/g, ' ')}</span>
                            <span className="text-blue-400">{stats.avgHours} hrs</span>
                        </div>
                        <div className="h-2 bg-gray-900 rounded-full overflow-hidden p-0.5 border border-gray-800">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (parseFloat(stats.avgHours) / 48) * 100)}%` }}
                                className={`h-full ${parseFloat(stats.avgHours) > 24 ? 'bg-red-500' : 'bg-blue-500'} rounded-full`}
                            />
                        </div>
                    </div>
                )) : (
                    <p className="text-gray-600 text-sm italic">Gathering performance data...</p>
                )}
            </div>
        </div>

        <div className="border-2 border-red-500/20 bg-red-500/5 rounded-[3rem] p-10 flex flex-col justify-between">
            <div>
                <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                        <ShieldAlert className="text-red-500" size={24} />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Danger Zone</h3>
                </div>
                <p className="text-gray-500 text-sm font-bold uppercase tracking-wide leading-relaxed">
                    Wiping system data is permanent. This will delete all order history, logs, and tracking data.
                </p>
            </div>
            <button 
                onClick={() => setShowClearModal(true)}
                className="mt-8 w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border border-red-500/20"
            >
                Wipe All Production Data
            </button>
        </div>
      </div>

      {/* Modal remains same but with updated styles */}
      {showClearModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => !isClearing && setShowClearModal(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md bg-gray-900 border border-red-500/30 p-10 rounded-[2.5rem] shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Authorize Wipe</h3>
              {!isClearing && (
                <button onClick={() => setShowClearModal(false)} className="text-gray-500 hover:text-white">
                  <X size={24} />
                </button>
              )}
            </div>

            <form onSubmit={handleClearData} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Admin Password</label>
                <input 
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl px-6 py-4 outline-none focus:border-red-500 transition-all text-white font-bold"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button 
                  type="button"
                  disabled={isClearing}
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isClearing || !adminPassword}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-900/20"
                >
                  {isClearing ? 'Wiping...' : 'Confirm'}
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
