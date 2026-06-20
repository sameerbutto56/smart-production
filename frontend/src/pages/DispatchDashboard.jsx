import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Package, MapPin, Clock, Search, Loader2, Phone, CheckCircle2, X, ExternalLink, User, Hash, AlertTriangle, Globe, Send, Store, ShoppingBag, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import socket from '../socket';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const COURIER_OPTIONS = ['TCS', 'Leopards', 'M&P', 'Trax', 'Other'];

const PRIORITY_BADGE = {
  SUPER_URGENT: { bg: 'bg-red-600', text: 'text-white', label: 'SUPER URGENT' },
  URGENT: { bg: 'bg-amber-500', text: 'text-white', label: 'URGENT' },
  NORMAL: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'NORMAL' }
};

const DispatchDashboard = () => {
  const { user } = useAuth();
  const isOutlet = user?.role === 'OUTLET';
  const isDispatchAdmin = ['SUPER_ADMIN', 'FAISAL', 'ADMIN'].includes(user?.role || '');
  const [activeTab, setActiveTab] = useState('unseen');
  const [data, setData] = useState({ unseen: [], active: [], allOrders: [], counts: { unseen: 0, active: 0, all: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [bookModal, setBookModal] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [notes, setNotes] = useState('');
  const [courierName, setCourierName] = useState('TCS');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const queueRefreshRef = useRef(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/dispatch/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch dispatch dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStageAccepted = () => {
      if (queueRefreshRef.current) clearTimeout(queueRefreshRef.current);
      queueRefreshRef.current = setTimeout(fetchDashboard, 500);
    };
    socket.on('stage-accepted', handleStageAccepted);
    socket.on('dispatch-request', fetchDashboard);
    socket.on('order-updated', fetchDashboard);
    return () => {
      socket.off('stage-accepted', handleStageAccepted);
      socket.off('dispatch-request', fetchDashboard);
      socket.off('order-updated', fetchDashboard);
    };
  }, []);

  const handleAcceptTask = async (orderId) => {
    setAcceptLoading(orderId);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${orderId}/accept-task`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Task accepted!', { duration: 2000 });
      fetchDashboard();
    } catch (err) {
      toast.error('Failed to accept task: ' + (err.response?.data?.error || err.message));
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleBookCourier = async (orderId) => {
    if (!trackingNumber.trim() || !courierName) return;
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/dispatch/${orderId}/book`,
        { courierName, trackingNumber, estimatedDelivery: estimatedDelivery || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookModal(null);
      setTrackingNumber('');
      setEstimatedDelivery('');
      toast.success('Courier booked successfully!', { duration: 3000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed to book courier: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const handleRequestCourier = async (orderId) => {
    if (!deliveryMethod.trim()) return;
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/dispatch/${orderId}/request`,
        { deliveryMethod, destinationCity, notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequestModal(null);
      setDeliveryMethod('');
      setDestinationCity('');
      setNotes('');
      toast.success('Courier dispatch requested! Dispatch department notified.', { duration: 4000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed to request courier: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (orderId, dispatchStatus) => {
    setStatusLoading(orderId);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/dispatch/${orderId}/status`,
        { dispatchStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Status updated to ${dispatchStatus}`, { duration: 2000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed to update: ' + (err.response?.data?.error || err.message));
    } finally {
      setStatusLoading(null);
    }
  };

  const handleMarkPickedUp = async (orderId) => {
    setStatusLoading(orderId);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/dispatch/${orderId}/pickup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order marked as picked up!', { duration: 3000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed to mark as picked up: ' + (err.response?.data?.error || err.message));
    } finally {
      setStatusLoading(null);
    }
  };

  const getFilteredAllOrders = () => {
    let items = data.allOrders;
    const q = search.toLowerCase();
    if (q) items = items.filter(o =>
      o.customerName?.toLowerCase().includes(q) ||
      (o.orderNumber || '').toLowerCase().includes(q) ||
      o.outletName?.toLowerCase().includes(q)
    );
    if (cityFilter) items = items.filter(o => (o.city || '').toLowerCase() === cityFilter.toLowerCase());
    if (methodFilter) items = items.filter(o => (o.deliveryType || '').toLowerCase() === methodFilter.toLowerCase());
    return items;
  };

  const getFilteredActive = () => {
    let items = data.active;
    const q = search.toLowerCase();
    if (q) items = items.filter(o =>
      o.customerName?.toLowerCase().includes(q) ||
      (o.orderNumber || '').toLowerCase().includes(q) ||
      o.outletName?.toLowerCase().includes(q)
    );
    if (cityFilter) items = items.filter(o => (o.city || '').toLowerCase() === cityFilter.toLowerCase());
    if (methodFilter) items = items.filter(o => (o.deliveryMethod || '').toLowerCase().includes(methodFilter.toLowerCase()));
    return items;
  };

  const allCities = [...new Set([...data.active, ...data.allOrders].map(o => o.city).filter(Boolean))];

  const tabs = [
    { id: 'unseen', label: 'Unseen Tasks', icon: Eye, desc: 'Orders awaiting acceptance', count: data.counts.unseen },
    { id: 'active', label: 'Active Tasks', icon: Package, desc: 'Accepted orders in progress', count: data.counts.active },
    { id: 'all', label: 'All Orders', icon: Truck, desc: 'Processed & delivered orders', count: data.counts.all },
  ];

  const renderOrderCard = (order, actions) => {
    const badge = PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL;
    return (
      <motion.div key={order.id} layout
        className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
              <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'ONLINE' : order.source}
              </span>
              {order.outletName && <span className="text-xs md:text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{order.outletName}</span>}
              {order.deliveryType && (
                <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${
                  order.deliveryType === 'COURIER' ? 'bg-purple-500/10 text-purple-400' :
                  order.deliveryType === 'PICKUP' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>{order.deliveryType.replace(/_/g, ' ')}</span>
              )}
              {order.dispatchStatus && !['PENDING'].includes(order.dispatchStatus) && (
                <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${
                  order.dispatchStatus === 'DELIVERED' || order.dispatchStatus === 'PICKED_UP' ? 'bg-emerald-500/10 text-emerald-400' :
                  order.dispatchStatus === 'DISPATCHED' ? 'bg-indigo-500/10 text-indigo-400' :
                  order.dispatchStatus === 'IN_TRANSIT' ? 'bg-yellow-500/10 text-yellow-400' :
                  order.dispatchStatus === 'BOOKED' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-amber-500/10 text-amber-400'
                }`}>{order.dispatchStatus.replace(/_/g, ' ')}</span>
              )}
            </div>
            <h3 className="font-black text-xl theme-text-primary truncate">#{order.orderNumber || order.id.substring(0, 8)} — {order.customerName}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm theme-text-secondary font-bold">
              <span className="flex items-center gap-1"><Phone size={12} />{order.customerPhone || 'N/A'}</span>
              {order.address && <span className="flex items-center gap-1 text-blue-400 font-black max-w-[300px] truncate" title={order.address}><MapPin size={12} />{order.address}</span>}
              {order.city && <span className="flex items-center gap-1"><MapPin size={12} />{order.city}</span>}
              {order.deliveryMethod && <span className="flex items-center gap-1"><Package size={12} />{order.deliveryMethod}</span>}
              <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
            </div>
            {order.trackingNumber && (
              <div className="mt-2 inline-flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                <ExternalLink size={12} className="text-blue-400" />
                <span className="text-xs md:text-sm font-black text-blue-400">Tracking: {order.trackingNumber}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex gap-2 flex-wrap">
              {actions}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading && !data.unseen.length && !data.active.length && !data.allOrders.length) {
    return <PageLoader text="Loading Dispatch Dashboard..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-12">
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-3 rounded-2xl ${isOutlet ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
          <Truck className={`${isOutlet ? 'text-blue-400' : 'text-purple-400'}`} size={28} />
        </div>
        <div>
          <h1 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tight">
            {isOutlet ? 'Outlet Dispatch' : 'Dispatch Control Center'}
          </h1>
          <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">
            Centralized courier & delivery management
          </p>
        </div>
      </div>

      <div className="flex gap-1 theme-bg-subtle p-1 rounded-2xl border theme-border mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); setCityFilter(''); setMethodFilter(''); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all relative ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'theme-text-muted hover:text-gray-300'
              }`}>
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  activeTab === tab.id ? 'bg-white text-purple-700' : 'bg-purple-500/20 text-purple-400'
                }`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'unseen' && (
        <>
          {data.unseen.length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Eye className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Unseen Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">All dispatch orders have been accepted. Great work!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {data.unseen.map(order => renderOrderCard(order, (
                <button onClick={() => handleAcceptTask(order.id)}
                  disabled={acceptLoading === order.id}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                  {acceptLoading === order.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  ACCEPT TASK & START WORK
                </button>
              )))}
            </div>
          )}
        </>
      )}

      {activeTab === 'active' && (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
              <input type="text" placeholder="Search by order #, customer, or outlet..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full theme-input border-2 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm font-bold" />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                className="theme-input rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider border-2">
                <option value="">All Cities</option>
                {allCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
                className="theme-input rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider border-2">
                <option value="">All Methods</option>
                <option value="courier">Courier</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>
          </div>

          {getFilteredActive().length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Package className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Active Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">Accepted dispatch orders awaiting action will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {getFilteredActive().map(order => renderOrderCard(order, (
                isOutlet ? (
                  !order.dispatchStatus || order.dispatchStatus === 'PENDING' ? (
                    <button onClick={() => setRequestModal(order)}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
                      <Send size={14} /> Request Courier
                    </button>
                  ) : (
                    <span className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider ${
                      order.dispatchStatus === 'COURIER_REQUIRED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      order.dispatchStatus === 'BOOKED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      order.dispatchStatus === 'DISPATCHED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                      order.dispatchStatus === 'IN_TRANSIT' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>{order.dispatchStatus?.replace(/_/g, ' ')}</span>
                  )
                ) : (
                  <>
                    {(!order.dispatchStatus || order.dispatchStatus === 'PENDING' || order.dispatchStatus === 'COURIER_REQUIRED') ? (
                      <button onClick={() => setBookModal(order)}
                        disabled={statusLoading === order.id}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : <><Truck size={14} /> Book Courier</>}
                      </button>
                    ) : order.dispatchStatus === 'BOOKED' ? (
                      <button onClick={() => handleUpdateStatus(order.id, 'DISPATCHED')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Dispatched'}
                      </button>
                    ) : order.dispatchStatus === 'DISPATCHED' ? (
                      <button onClick={() => handleUpdateStatus(order.id, 'IN_TRANSIT')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark In Transit'}
                      </button>
                    ) : order.dispatchStatus === 'IN_TRANSIT' ? (
                      <button onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Delivered'}
                      </button>
                    ) : null}
                  </>
                )
              )))}
            </div>
          )}
        </>
      )}

      {activeTab === 'all' && (
        <>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
              <input type="text" placeholder="Search by order #, customer, or outlet..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full theme-input border-2 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm font-bold" />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                className="theme-input rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider border-2">
                <option value="">All Cities</option>
                {allCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
                className="theme-input rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider border-2">
                <option value="">All Methods</option>
                <option value="courier">Courier</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>
          </div>

          {getFilteredAllOrders().length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Truck className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Orders Found</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {getFilteredAllOrders().map(order => {
                const isPickup = order.deliveryType === 'PICKUP';
                const isPickedUp = order.dispatchStatus === 'PICKED_UP' || order.currentStage === 'COMPLETED';
                const canMarkPickup = isPickup && !isPickedUp;

                return renderOrderCard(order, (
                  <>
                    {order.dispatchStatus === 'BOOKED' && isDispatchAdmin && (
                      <button onClick={() => handleUpdateStatus(order.id, 'DISPATCHED')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Dispatched'}
                      </button>
                    )}
                    {order.dispatchStatus === 'DISPATCHED' && isDispatchAdmin && (
                      <button onClick={() => handleUpdateStatus(order.id, 'IN_TRANSIT')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark In Transit'}
                      </button>
                    )}
                    {order.dispatchStatus === 'IN_TRANSIT' && isDispatchAdmin && (
                      <button onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                        disabled={statusLoading === order.id}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Delivered'}
                      </button>
                    )}
                    {canMarkPickup && (
                      <button onClick={() => {
                        if (window.confirm(`Confirm pickup for Order #${order.orderNumber || order.id.substring(0, 8)}?`)) {
                          handleMarkPickedUp(order.id);
                        }
                      }}
                        disabled={statusLoading === order.id}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : <><CheckCircle2 size={14} /> Mark Picked Up</>}
                      </button>
                    )}
                    {!canMarkPickup && !['BOOKED', 'DISPATCHED', 'IN_TRANSIT'].includes(order.dispatchStatus) && (
                      <span className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider ${
                        isPickedUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        order.dispatchStatus === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        'theme-bg theme-text-muted border theme-border'
                      }`}>{order.dispatchStatus?.replace(/_/g, ' ') || 'Awaiting Action'}</span>
                    )}
                  </>
                ));
              })}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {requestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Request Courier</h2>
              <p className="theme-text-secondary text-xs font-bold mb-2">Order #{requestModal?.orderNumber || requestModal?.id?.substring(0, 8)} — {requestModal?.customerName}</p>
              <p className="theme-text-muted text-xs md:text-sm font-bold mb-6">This request will be sent to the Central Dispatch Department for processing.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Delivery Method *</label>
                  <input type="text" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black"
                    placeholder="e.g. TCS, Leopards, Own Delivery..." />
                </div>
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Destination City</label>
                  <input type="text" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black"
                    placeholder="City name..." />
                </div>
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black resize-none"
                    rows={3} placeholder="Any special instructions..." />
                </div>
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setRequestModal(null); setDeliveryMethod(''); setDestinationCity(''); setNotes(''); }}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleRequestCourier(requestModal.id)} disabled={submitting || !deliveryMethod.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Request Courier
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {bookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Book Courier</h2>
              <p className="theme-text-secondary text-xs font-bold mb-6">Order #{bookModal?.orderNumber || bookModal?.id?.substring(0, 8)} — {bookModal?.customerName}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Courier Service</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {COURIER_OPTIONS.map(c => (
                      <button key={c} onClick={() => setCourierName(c)}
                        className={`py-3 px-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border-2 ${
                          courierName === c ? 'border-purple-500 bg-purple-600 text-white' : 'theme-border theme-bg theme-text-muted'
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking Number</label>
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black"
                    placeholder="Enter tracking number..." />
                </div>
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Estimated Delivery Date (optional)</label>
                  <input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)}
                    className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black" />
                </div>
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setBookModal(null); setTrackingNumber(''); setEstimatedDelivery(''); }}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleBookCourier(bookModal.id)} disabled={submitting || !trackingNumber.trim()}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                  Book Courier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DispatchDashboard;
