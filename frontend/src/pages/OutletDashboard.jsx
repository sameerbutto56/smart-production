import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Search, Clock, CheckCircle, XCircle,
  Package, Truck, UserCheck, Send,
  RefreshCcw, Calendar, ListChecks, BarChart3, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import OutletPOSDashboard from '../components/OutletPOSDashboard';
import OutletInvoiceHistory from '../components/OutletInvoiceHistory';

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const DatePresetButtons = ({ value, onChange }) => {
  const presets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Weekly', value: 'week' },
    { label: 'Monthly', value: 'month' },
    { label: '3M', value: '3m' },
    { label: 'All', value: '' }
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            value === p.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

const getDateRange = (preset) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (!preset) return { dateFrom: undefined, dateTo: undefined };
  if (preset === 'today') return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (preset === 'week') {
    start.setDate(start.getDate() - 7);
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
  }
  if (preset === 'month') {
    start.setMonth(start.getMonth() - 1);
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
  }
  if (preset === '3m') {
    start.setMonth(start.getMonth() - 3);
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() };
  }
  return { dateFrom: undefined, dateTo: undefined };
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 flex items-center gap-4"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
    </div>
  </motion.div>
);

const TimelineEntry = ({ entry }) => (
  <div className="flex gap-3 py-2">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full ${
        entry.type === 'route' ? 'bg-blue-500' :
        entry.type === 'stage' && entry.status === 'COMPLETED' ? 'bg-emerald-500' :
        entry.type === 'stage' && entry.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-gray-600'
      }`} />
      <div className="w-0.5 flex-1 bg-gray-800 mt-1" />
    </div>
    <div className="flex-1 pb-3">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${
          entry.type === 'route' ? 'text-blue-400' :
          entry.type === 'stage' && entry.status === 'COMPLETED' ? 'text-emerald-400' :
          entry.type === 'stage' && entry.status === 'IN_PROGRESS' ? 'text-amber-400' : 'text-gray-400'
        }`}>
          {entry.type === 'stage' ? entry.stage?.replace(/_/g, ' ') : entry.label}
        </span>
        <span className="text-[10px] text-gray-600">
          {new Date(entry.timestamp).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {entry.actor && <p className="text-[10px] text-gray-600 mt-0.5">by {entry.actor}</p>}
      {entry.remarks && <p className="text-[10px] text-gray-500 mt-0.5 italic">{entry.remarks}</p>}
      {entry.returnReason && <p className="text-[10px] text-amber-400 mt-0.5">{entry.returnReason}</p>}
    </div>
  </div>
);

const OutletDashboard = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [datePreset, setDatePreset] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Tracking
  const [trackingNumber, setTrackingNumber] = useState('');
  const [timeline, setTimeline] = useState([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState(null);

  // Tasks
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchStats = useCallback(async (preset) => {
    setStatsLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRange(preset);
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/api/outlet-orders/dashboard-stats', { params });
      setStats(res.data);
    } catch (e) {
      console.error('Stats error:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.get('/api/outlet-orders/tasks');
      setTasks(res.data);
    } catch (e) {
      console.error('Tasks error:', e);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') fetchStats(datePreset);
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, datePreset, fetchStats, fetchTasks]);

  const handleTrackOrder = async (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    setTrackingLoading(true);
    setTimeline([]);
    setTrackedOrder(null);
    try {
      const orderRes = await api.get(`/api/orders/track/${trackingNumber.trim()}`);
      setTrackedOrder(orderRes.data);
      const timelineRes = await api.get(`/api/orders/${orderRes.data.id}/timeline`);
      setTimeline(timelineRes.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Order not found');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleFinalAction = async (orderId, action) => {
    setActionLoading(orderId + action);
    try {
      let endpoint;
      if (action === 'dispatch') endpoint = '/api/orders/' + orderId + '/send-for-delivery';
      else if (action === 'inhouse') endpoint = '/api/outlet-orders/' + orderId + '/in-house-delivery';
      else if (action === 'customer-taken') endpoint = '/api/outlet-orders/' + orderId + '/customer-taken';
      await api.post(endpoint);
      toast.success('Action completed successfully');
      fetchTasks();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos-dashboard', label: 'POS Dashboard', icon: BarChart3 },
    { id: 'invoices', label: 'Total Invoices', icon: DollarSign },
    { id: 'tracking', label: 'Order Track', icon: Search },
    { id: 'tasks', label: 'Tasks', icon: ListChecks, badge: tasks.length }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <LayoutDashboard className="text-blue-400" size={24} />
          {outletName} — Dashboard
        </h1>
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div>
            <p className="text-xs text-gray-500 font-bold mb-2">Date Range</p>
            <DatePresetButtons value={datePreset} onChange={setDatePreset} />
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-gray-900/60 rounded-2xl p-6 animate-pulse h-24" />
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard icon={Package} label="Total Orders" value={stats.totalOrders} color="bg-blue-600" />
              <StatCard icon={Clock} label="Pending" value={stats.pendingOrders} color="bg-amber-600" />
              <StatCard icon={CheckCircle} label="Completed" value={stats.completedOrders} color="bg-emerald-600" />
              <StatCard icon={XCircle} label="Cancelled" value={stats.cancelledOrders} color="bg-red-600" />
            </div>
          )}
        </div>
      )}

      {activeTab === 'pos-dashboard' && (
        <OutletPOSDashboard outlet={outletName} />
      )}

      {activeTab === 'invoices' && (
        <OutletInvoiceHistory outlet={outletName} />
      )}

      {activeTab === 'tracking' && (
        <div className="space-y-6">
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
            <form onSubmit={handleTrackOrder} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Enter order number (JT-, JL-, AB-...)"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 uppercase tracking-wider"
                />
              </div>
              <button
                type="submit"
                disabled={trackingLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2"
              >
                {trackingLoading ? <RefreshCcw className="animate-spin" size={16} /> : <Search size={16} />}
                Track
              </button>
            </form>
          </div>

          {trackedOrder && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Order Timeline</h3>
                {timeline.length === 0 ? (
                  <p className="text-gray-500 text-sm">No timeline entries found</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {timeline.map(entry => (
                      <TimelineEntry key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Order Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Order #</p>
                    <p className="text-white font-bold">{trackedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Customer</p>
                    <p className="text-white font-bold">{trackedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      trackedOrder.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                      trackedOrder.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-gray-700 text-gray-300'
                    }`}>{trackedOrder.status}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Stage</p>
                    <p className="text-white font-bold">{trackedOrder.currentStage?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Created</p>
                    <p className="text-white font-bold">{new Date(trackedOrder.createdAt).toLocaleString('en-PK')}</p>
                  </div>
                  {trackedOrder.totalPrice > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total</p>
                      <p className="text-white font-bold">₨{trackedOrder.totalPrice.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {tasks.length} order{tasks.length !== 1 ? 's' : ''} returned to outlet
            </p>
            <button
              onClick={fetchTasks}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all"
            >
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-gray-900/60 rounded-2xl p-6 animate-pulse h-32" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-12 text-center">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-500 font-bold">No tasks pending</p>
              <p className="text-xs text-gray-600 mt-1">Returned orders will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(order => {
                const products = order.productDetails || [];
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900/60 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-black text-white">{order.orderNumber}</p>
                        <p className="text-sm text-gray-400">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-gray-500">{order.customerPhone}</p>}
                      </div>
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                        RETURNS
                      </span>
                    </div>

                    {products.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Products</p>
                        {products.map((p, i) => (
                          <p key={i} className="text-xs text-gray-300">
                            {p.name} {p.color ? `(${p.color}` : ''}{p.size ? ` / ${p.size}` : ''}{p.color || p.size ? ')' : ''} × {p.quantity || 1}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar size={12} />
                      {new Date(order.createdAt).toLocaleDateString('en-PK')}
                      {order.totalPrice > 0 && (
                        <span className="ml-auto font-bold text-white">₨{order.totalPrice.toLocaleString()}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                      <button
                        onClick={() => handleFinalAction(order.id, 'dispatch')}
                        disabled={actionLoading === order.id + 'dispatch'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        {actionLoading === order.id + 'dispatch' ? <RefreshCcw className="animate-spin" size={14} /> : <Send size={14} />}
                        Dispatch
                      </button>
                      <button
                        onClick={() => handleFinalAction(order.id, 'inhouse')}
                        disabled={actionLoading === order.id + 'inhouse'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        {actionLoading === order.id + 'inhouse' ? <RefreshCcw className="animate-spin" size={14} /> : <Truck size={14} />}
                        In-House
                      </button>
                      <button
                        onClick={() => handleFinalAction(order.id, 'customer-taken')}
                        disabled={actionLoading === order.id + 'customer-taken'}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        {actionLoading === order.id + 'customer-taken' ? <RefreshCcw className="animate-spin" size={14} /> : <UserCheck size={14} />}
                        Customer
                      </button>
                    </div>
                    <div className="flex gap-1 text-[10px] text-gray-600 justify-center">
                      <span className="flex items-center gap-1"><Send size={10} className="text-blue-400" /> Dispatch</span>
                      <span className="mx-1">|</span>
                      <span className="flex items-center gap-1"><Truck size={10} className="text-emerald-400" /> In-House</span>
                      <span className="mx-1">|</span>
                      <span className="flex items-center gap-1"><UserCheck size={10} className="text-violet-400" /> Customer</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutletDashboard;