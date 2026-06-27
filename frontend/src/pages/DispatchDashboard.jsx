import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import { Truck, Package, Eye, Send, Search, Loader2, Clock, Phone, MapPin, ExternalLink, CheckCircle2, X } from 'lucide-react';

const DISPATCH_OPTIONS = [
  { id: 'ENAMELS', label: 'Enamels Delivery', type: 'dispatch', desc: 'Assign to Enamels delivery team' },
  { id: 'TCS', label: 'TCS', type: 'courier', desc: 'Book TCS courier' },
  { id: 'POST_EX', label: 'PostEx', type: 'courier', desc: 'Book PostEx courier' },
  { id: 'WALK_IN', label: 'Received by Customer', type: 'walkin', desc: 'Mark delivered directly' },
  { id: 'OTHER', label: 'Other', type: 'courier', desc: 'Other courier service' },
];

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
  const [selectedOption, setSelectedOption] = useState(DISPATCH_OPTIONS[0]);
  const [otherCourierName, setOtherCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const queueRefreshRef = useRef(null);

  const toggleExpand = (orderId) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId);
  };

  const parseJSON = (data) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return {}; }
  };

  const slMap = { 'full':'Full', 'half':'Half', 'three-quarter':'3 Quarter' };
  const shMap = { 'long':'Long', 'short':'Short', 'regular':'Regular Length' };
  const slDisplay = (v) => v ? (slMap[v] || v) : '';
  const shDisplay = (v) => v ? (shMap[v] || v) : '';

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/dispatch/dashboard');
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
    const debouncedFetch = debounce(fetchDashboard, 300);
    socket.on('stage-accepted', handleStageAccepted);
    socket.on('dispatch-request', debouncedFetch);
    socket.on('order-updated', debouncedFetch);
    return () => {
      socket.off('stage-accepted', handleStageAccepted);
      socket.off('dispatch-request', debouncedFetch);
      socket.off('order-updated', debouncedFetch);
    };
  }, []);

  const handleAcceptTask = async (orderId) => {
    setAcceptLoading(orderId);
    try {
      await api.post(`/api/orders/${orderId}/accept-task`, {});
      toast.success('Task accepted!', { duration: 2000 });
      fetchDashboard();
    } catch (err) {
      toast.error('Failed to accept task: ' + (err.response?.data?.error || err.message));
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleBookCourier = async (orderId) => {
    const option = selectedOption;
    if (option.type === 'courier' && !trackingNumber.trim()) return;
    if (option.id === 'OTHER' && !otherCourierName.trim()) return;
    setSubmitting(true);
    try {
      if (option.id === 'WALK_IN') {
        await api.put(`/api/dispatch/${orderId}/status`,
          { status: 'DELIVERED', deliveredAt: new Date().toISOString() }
        );
      } else {
        const name = option.id === 'OTHER' ? otherCourierName.trim() : option.label;
        await api.post(`/api/dispatch/${orderId}/book`,
          { courierName: name, trackingNumber, estimatedDelivery: estimatedDelivery || null }
        );
      }
      setBookModal(null);
      setTrackingNumber('');
      setEstimatedDelivery('');
      setOtherCourierName('');
      setSelectedOption(DISPATCH_OPTIONS[0]);
      toast.success(option.id === 'WALK_IN' ? 'Order marked as received by customer!' : option.id === 'ENAMELS' ? 'Assigned to Enamels Delivery!' : 'Courier booked successfully!', { duration: 3000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const handleRequestCourier = async (orderId) => {
    if (!deliveryMethod.trim()) return;
    setSubmitting(true);
    try {
        await api.post(`/api/dispatch/${orderId}/book`,
          { courier: deliveryMethod }
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
        await api.post(`/api/orders/${orderId}/dispatch`,
          { dispatchMethod: 'ENAMELS' }
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
      await api.put(`/api/dispatch/${orderId}/pickup`, {});
      toast.success('Order marked as picked up!', { duration: 2000 });
      fetchDashboard();
    } catch (err) {
      alert('Failed to mark picked up: ' + (err.response?.data?.error || err.message));
    } finally {
      setStatusLoading(null);
    }
  };

  const getFilteredUnseen = () => {
    let items = data.unseen;
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

  const getFilteredAllOrders = () => {
    let items = data.allOrders;
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
    const isExpanded = expandedOrderId === order.id;
    const rawPd = parseJSON(order.productDetails);
    const allItems = Array.isArray(rawPd) ? rawPd : null;
    const isMultiItem = allItems && allItems.length > 0;
    const firstProduct = isMultiItem ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
    const custom = parseJSON(order.customization);
    return (
      <motion.div key={order.id} layout
        className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
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
              <span className="text-purple-400 text-xs font-black">{isExpanded ? '▲ HIDE' : '▼ DETAILS'}</span>
            </div>
            {order.trackingNumber && (
              <div className="mt-2 inline-flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                <ExternalLink size={12} className="text-blue-400" />
                <span className="text-xs md:text-sm font-black text-blue-400">Tracking: {order.trackingNumber}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 md:items-end shrink-0">
            <div className="flex gap-2 flex-wrap">
              {actions}
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
            {/* Products */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-2">Products</h4>
              <div className="space-y-2">
                {(isMultiItem ? allItems : [{ productDetails: firstProduct }]).map((item, idx) => {
                  const p = item.productDetails || item || {};
                  const extras = [p.sleeveLength ? `Sleeve: ${slDisplay(p.sleeveLength)}` : null, p.shirtLength ? `Length: ${shDisplay(p.shirtLength)}` : null].filter(Boolean).join(' | ');
                  return (
                    <div key={idx} className="flex items-center justify-between theme-bg-subtle rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm theme-text-primary">{p.productType || '—'}</p>
                        <p className="text-xs theme-text-muted font-bold">
                          {[p.fabricType, p.color, p.size, p.gender].filter(Boolean).join(' • ')}
                          {extras ? ` | ${extras}` : ''}
                        </p>
                      </div>
                      <span className="font-black text-sm theme-text-primary shrink-0 ml-2">{item.quantity || 1} × {item.totalPrice ? `₨${parseFloat(item.totalPrice).toLocaleString()}` : `₨${parseFloat(order.totalPrice || 0).toLocaleString()}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Order Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Type</p>
                <p className="text-sm font-black theme-text-primary">{order.type || 'STANDARD'}</p>
              </div>
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment</p>
                <p className={`text-sm font-black ${order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : (parseFloat(order.advanceAmount || 0) > 0 ? `ADV: ₨${parseFloat(order.advanceAmount).toLocaleString()}` : 'COD')}
                </p>
              </div>
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total</p>
                <p className="text-sm font-black theme-text-primary">₨{parseFloat(order.totalPrice || 0).toLocaleString()}</p>
              </div>
              {order.instructionNotes && (
                <div className="theme-bg-subtle rounded-xl px-3 py-2 col-span-2 md:col-span-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Instructions</p>
                  <p className="text-sm font-black text-amber-400">{order.instructionNotes}</p>
                </div>
              )}
            </div>
            {/* Engraving / Customization */}
            {custom && !custom.skipEngraving && (custom.nameSpelling || (custom.articleNames?.length > 0) || custom.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 || custom.designNotes) && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Engraving / Customization</h4>
                <div className="theme-bg-subtle rounded-xl p-3 space-y-1">
                  {custom.engravingType && <p className="text-xs font-bold theme-text-secondary">Type: {custom.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</p>}
                  {custom.nameSpelling && <p className="text-xs font-bold theme-text-secondary">Name: {custom.nameSpelling}</p>}
                  {custom.articleNames?.length > 0 && <p className="text-xs font-bold theme-text-secondary">Lines: {custom.articleNames.join(', ')}</p>}
                  {custom.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 && <p className="text-xs font-bold theme-text-secondary">Logos: {custom.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).map(l => l.name || l.design).join(', ')}</p>}
                  {custom.designNotes && <p className="text-xs font-bold text-amber-400">Note: {custom.designNotes}</p>}
                </div>
              </div>
            )}
            {/* Measurements for FULL_CUSTOM */}
            {order.type === 'FULL_CUSTOM' && (() => {
              const rawSizes = parseJSON(order.sizeData);
              const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : null;
              if (!sizes) return null;
              const meas = Object.entries(sizes).filter(([k, v]) => v && k !== 'specialNote');
              if (meas.length === 0 && !sizes.specialNote) return null;
              return (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Measurements</h4>
                  <div className="theme-bg-subtle rounded-xl p-3">
                    {meas.length > 0 && (
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
                        {meas.map(([k, v]) => (
                          <div key={k} className="text-center">
                            <p className="text-[10px] font-black uppercase text-gray-500">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                            <p className="text-sm font-black theme-text-primary">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {sizes.specialNote && <p className="text-xs font-bold text-amber-400">Note: {sizes.specialNote}</p>}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
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
                        {statusLoading === order.id ? <LoadingSpinner size={12} /> : <><Truck size={14} /> Dispatch</>}
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
              <h2 className="text-2xl font-black theme-text-primary mb-2">Dispatch Order</h2>
              <p className="theme-text-secondary text-xs font-bold mb-6">Order #{bookModal?.orderNumber || bookModal?.id?.substring(0, 8)} — {bookModal?.customerName}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Dispatch Method</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DISPATCH_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => { setSelectedOption(o); setTrackingNumber(''); setOtherCourierName(''); }}
                        className={`py-3 px-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border-2 ${
                          selectedOption.id === o.id ? 'border-purple-500 bg-purple-600 text-white' : 'theme-border theme-bg theme-text-muted'
                        }`} title={o.desc}>{o.label}</button>
                    ))}
                  </div>
                </div>
                {selectedOption.type === 'courier' && (
                  <>
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
                    {selectedOption.id === 'OTHER' && (
                      <div>
                        <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Courier Name</label>
                        <input type="text" value={otherCourierName} onChange={(e) => setOtherCourierName(e.target.value)}
                          className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black"
                          placeholder="Enter courier name..." />
                      </div>
                    )}
                  </>
                )}
                {selectedOption.type === 'dispatch' && (
                  <div>
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking URL (optional)</label>
                    <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black"
                      placeholder="Enter tracking URL or number..." />
                  </div>
                )}
                {selectedOption.type === 'walkin' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs md:text-sm font-black text-emerald-400">Order will be marked as received by customer directly.</p>
                  </div>
                )}
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setBookModal(null); setTrackingNumber(''); setEstimatedDelivery(''); setOtherCourierName(''); setSelectedOption(DISPATCH_OPTIONS[0]); }}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleBookCourier(bookModal.id)}
                  disabled={submitting || (selectedOption.type === 'courier' && !trackingNumber.trim()) || (selectedOption.id === 'OTHER' && !otherCourierName.trim())}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                  {selectedOption.id === 'WALK_IN' ? 'Confirm Received' : selectedOption.id === 'ENAMELS' ? 'Assign Delivery' : 'Book Courier'}
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
