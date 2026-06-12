import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FileEdit, RotateCcw, Loader2, CheckCircle2, ThumbsUp, ThumbsDown,
  ChevronDown, Package, X, Clock, Search, AlertTriangle,
  Globe, Store, Users, ListOrdered, ChevronRight, Circle, CheckCircle,
  XCircle, RefreshCw, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const STAGE_ORDER = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED'];
const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', LOGO_DESIGN: 'Logo Design',
  PRODUCTION: 'Production', DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  COMPLETED: 'Completed', DELIVERED: 'Delivered'
};

const EditRequestDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, byStatus: {}, bySource: {} });
  const [activeTab, setActiveTab] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [inventoryResults, setInventoryResults] = useState({});
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/edit-requests?stats=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
      setAllRequests(Array.isArray(res.data.requests) ? res.data.requests : []);
    } catch (err) {
      console.error('Error fetching edit requests:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    socket.on('global-alert', fetchRequests);
    return () => socket.off('global-alert', fetchRequests);
  }, [fetchRequests]);

  useEffect(() => {
    if (!expandedId) return;
    const req = allRequests.find(r => r.id === expandedId);
    if (!req) return;
    let productTypes = [];
    try {
      const rc = req.requestedChanges;
      if (rc?.items && Array.isArray(rc.items)) {
        productTypes = [...new Set(rc.items.map(i => (i.productDetails?.productType || i.productType || '')).filter(Boolean))];
      } else if (rc?.productDetails) {
        const pd = typeof rc.productDetails === 'string' ? JSON.parse(rc.productDetails) : rc.productDetails;
        if (pd?.productType) productTypes = [pd.productType];
      }
    } catch {}
    if (productTypes.length === 0) return;
    const doFetch = async () => {
      setInventoryLoading(true);
      const token = sessionStorage.getItem('token');
      if (!token) { setInventoryLoading(false); return; }
      const results = {};
      for (const name of productTypes) {
        try {
          const res = await axios.get(`${API_URL}/api/inventory/search`, {
            params: { name }, headers: { Authorization: `Bearer ${token}` }
          });
          results[name] = Array.isArray(res.data) ? res.data : [];
        } catch { results[name] = []; }
      }
      setInventoryResults(prev => ({ ...prev, ...results }));
      setInventoryLoading(false);
    };
    doFetch();
  }, [expandedId, allRequests]);

  const handleApprove = async () => {
    if (!reviewData) return;
    setReviewSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/edit-requests/${reviewData.id}/approve`,
        { adminRemarks: reviewRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowReviewModal(false);
      setReviewData(null);
      setReviewRemarks('');
      fetchRequests();
      toast.success('Edit request approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
    setReviewSubmitting(false);
  };

  const handleReject = async () => {
    if (!reviewData) return;
    setReviewSubmitting(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/edit-requests/${reviewData.id}/reject`,
        { adminRemarks: reviewRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowReviewModal(false);
      setReviewData(null);
      setReviewRemarks('');
      fetchRequests();
      toast.success('Edit request rejected');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
    setReviewSubmitting(false);
  };

  const getOrderSource = (req) => {
    if (req.requestedBy?.role === 'FAISAL') return { label: 'Online Order', icon: Globe, color: 'text-blue-400', bg: 'bg-blue-500/10' };
    return { label: req.order?.outletName || 'Outlet', icon: Store, color: 'text-purple-400', bg: 'bg-purple-500/10' };
  };

  const getStatusBadge = (status) => {
    const map = {
      PENDING: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400' },
      APPROVED: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-400' },
      REJECTED: { label: 'Rejected', cls: 'bg-red-500/15 text-red-400' }
    };
    return map[status] || { label: status, cls: 'bg-gray-500/15 text-gray-400' };
  };

  const getCurrentStageIndex = (currentStage) => STAGE_ORDER.indexOf(currentStage);

  const filteredRequests = activeTab === 'ALL' ? allRequests : allRequests.filter(r => r.status === activeTab);

  const parseItems = (data) => {
    const items = [];
    try {
      const pd = typeof data === 'string' ? JSON.parse(data) : data;
      if (Array.isArray(pd)) {
        pd.forEach(item => {
          const d = item.productDetails || item;
          items.push({ name: d.productType || '', color: d.color || '', size: d.size || '', qty: item.quantity || 1 });
        });
      } else if (pd?.productType) {
        items.push({ name: pd.productType, color: pd.color || '', size: pd.size || '', qty: 1 });
      }
    } catch {}
    return items;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 rounded-2xl">
            <FileEdit className="text-amber-400" size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Edit Requests</h1>
            <p className="theme-text-muted text-[9px] md:text-[10px] font-black uppercase tracking-widest mt-0.5">
              {stats.total} total request{stats.total !== 1 ? 's' : ''} — {stats.byStatus?.PENDING || 0} pending
            </p>
          </div>
        </div>
        <button onClick={fetchRequests} className="btn-ghost btn-sm">
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: ListOrdered, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Pending', value: stats.byStatus?.PENDING || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Approved', value: stats.byStatus?.APPROVED || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Rejected', value: stats.byStatus?.REJECTED || 0, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
          ...Object.entries(stats.bySource || {}).map(([source, count]) => ({
            label: source, value: count, icon: source === 'ONLINE' ? Globe : Store,
            color: source === 'ONLINE' ? 'text-blue-400' : 'text-purple-400',
            bg: source === 'ONLINE' ? 'bg-blue-500/10' : 'bg-purple-500/10'
          }))
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-4 border theme-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <p className="text-[8px] font-bold theme-text-muted uppercase tracking-wider">{stat.label}</p>
            </div>
            <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-900/20'
                : 'bg-gray-900/50 text-gray-500 border border-gray-800 hover:border-gray-600'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            {tab !== 'ALL' && (
              <span className="ml-1.5 text-[8px] opacity-60">
                ({tab === 'PENDING' ? (stats.byStatus?.PENDING || 0) : tab === 'APPROVED' ? (stats.byStatus?.APPROVED || 0) : (stats.byStatus?.REJECTED || 0)})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Request List */}
      {loading && allRequests.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={32} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="glass rounded-2xl md:rounded-[2rem] p-8 md:p-12 border theme-border text-center space-y-4">
          <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto border-2 border-gray-800">
            <CheckCircle2 className="text-gray-700" size={32} />
          </div>
          <h3 className="text-lg font-black text-gray-500 uppercase">No {activeTab === 'ALL' ? '' : activeTab.toLowerCase()} requests</h3>
          <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">All clear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const order = req.order || {};
            const source = getOrderSource(req);
            const isExpanded = expandedId === req.id;
            const oldItems = parseItems(order.productDetails);
            const newItems = parseItems(req.requestedChanges?.productDetails || (req.requestedChanges?.items ? null : null)) ||
              (req.requestedChanges?.items ? req.requestedChanges.items.map(i => {
                const d = i.productDetails || i;
                return { name: d.productType || '', color: d.color || '', size: d.size || '', qty: i.quantity || 1 };
              }) : []);
            const statusBadge = getStatusBadge(req.status);
            const currentStageIdx = getCurrentStageIndex(order.currentStage);

            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-2xl border transition-all ${
                  isExpanded ? 'border-amber-500/40 shadow-lg shadow-amber-900/20' : 'theme-border hover:border-amber-500/30'
                }`}
              >
                {/* Collapsed summary */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="p-4 md:p-5 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl ${source.bg} shrink-0`}>
                        <source.icon size={16} className={source.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black theme-text-primary truncate">#{order.orderNumber || order.id?.substring(0, 8) || 'N/A'}</p>
                        <p className="text-[8px] theme-text-muted font-bold truncate">{order.customerName || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`text-[8px] font-bold px-2 py-1 rounded-lg ${
                        order.currentStage && currentStageIdx >= STAGE_ORDER.indexOf('PRODUCTION')
                          ? 'bg-sky-500/15 text-sky-400' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {STAGE_LABELS[order.currentStage] || order.currentStage || '—'}
                      </span>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-600">
                        <ChevronDown size={14} />
                      </motion.div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[8px] font-bold theme-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(req.requestedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-gray-700">|</span>
                    <span>by {req.requestedBy?.name || '?'}</span>
                    {req.reason && (
                      <>
                        <span className="text-gray-700">|</span>
                        <span className="truncate max-w-[120px] md:max-w-[200px]">"{req.reason}"</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded view */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 md:px-5 pb-5 border-t theme-border pt-4 space-y-4">
                        {/* Order Lifecycle Timeline */}
                        <div className="theme-bg rounded-xl p-3 border theme-border">
                          <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Activity size={10} /> Order Lifecycle
                          </p>
                          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                            {STAGE_ORDER.filter(s => s !== 'DELIVERED').map((stage, idx) => {
                              const stageIdx = STAGE_ORDER.indexOf(stage);
                              const isCompleted = currentStageIdx > stageIdx;
                              const isCurrent = currentStageIdx === stageIdx;
                              const isPending = currentStageIdx < stageIdx;
                              const isCancelled = order.currentStage === 'CANCELLED';
                              return (
                                <React.Fragment key={stage}>
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                                      isCancelled ? 'border-red-500 bg-red-500/20' :
                                      isCompleted ? 'border-emerald-500 bg-emerald-500/20' :
                                      isCurrent ? 'border-amber-500 bg-amber-500/20 ring-2 ring-amber-500/30' :
                                      'border-gray-700 bg-gray-900'
                                    }`}>
                                      {isCancelled ? <X size={10} className="text-red-400" /> :
                                       isCompleted ? <CheckCircle size={10} className="text-emerald-400" /> :
                                       isCurrent ? <Circle size={10} className="text-amber-400" /> :
                                       <div className="w-2 h-2 rounded-full bg-gray-700" />}
                                    </div>
                                    <p className={`text-[6px] font-bold mt-1 whitespace-nowrap ${
                                      isCompleted ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-gray-600'
                                    }`}>
                                      {STAGE_LABELS[stage]}
                                    </p>
                                  </div>
                                  {idx < STAGE_ORDER.filter(s => s !== 'DELIVERED').length - 1 && (
                                    <div className={`flex-1 h-px min-w-[12px] md:min-w-[20px] ${
                                      isCancelled ? 'bg-red-500/30' :
                                      isCompleted ? 'bg-emerald-500/50' : 'bg-gray-800'
                                    }`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>



                        {/* Old vs New */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="theme-bg rounded-xl p-3 border border-red-500/20">
                            <p className="text-[8px] font-black text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-red-400" /> Old Item(s)
                            </p>
                            {oldItems.length > 0 ? oldItems.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-red-500/10 last:border-0">
                                <span className="text-[9px] font-black text-red-400 w-4">{i + 1}.</span>
                                <div>
                                  <p className="text-[10px] font-bold theme-text-primary">{p.name}</p>
                                  {(p.color || p.size) && (
                                    <p className="text-[8px] font-medium theme-text-muted">
                                      {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )) : <p className="text-[8px] theme-text-muted italic">No items</p>}
                          </div>
                          <div className="theme-bg rounded-xl p-3 border border-emerald-500/20">
                            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-emerald-400" /> New Item(s)
                            </p>
                            {newItems.length > 0 ? newItems.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-emerald-500/10 last:border-0">
                                <span className="text-[9px] font-black text-emerald-400 w-4">{i + 1}.</span>
                                <div>
                                  <p className="text-[10px] font-bold theme-text-primary">{p.name}</p>
                                  {(p.color || p.size) && (
                                    <p className="text-[8px] font-medium theme-text-muted">
                                      {[p.color, p.size].filter(Boolean).join(' / ')} × {p.qty}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )) : <p className="text-[8px] theme-text-muted italic">No items</p>}
                          </div>
                        </div>

                        {/* Inventory Impact */}
                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
                          <p className="text-[8px] font-black text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <RefreshCw size={10} /> Inventory Impact
                          </p>
                          <div className="space-y-1">
                            {oldItems.map((p, i) => (
                              <p key={i} className="text-[8px] font-bold text-green-400">
                                +{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} returned to stock
                              </p>
                            ))}
                            {newItems.map((p, i) => (
                              <p key={i} className="text-[8px] font-bold text-red-400">
                                -{p.qty} {p.name} {p.color ? `(${p.color}` : ''}{p.color && p.size ? ' / ' : ''}{p.size ? `${p.size})` : ''} deducted from stock
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Inventory Availability */}
                        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3">
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Package size={10} /> Inventory Availability
                          </p>
                          {inventoryLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <Loader2 className="animate-spin text-indigo-400" size={12} />
                              <span className="text-[8px] font-bold theme-text-muted">Checking inventory...</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {newItems.map((p, i) => {
                                const products = inventoryResults[p.name] || [];
                                
                                // Variant lookup
                                let foundVariant = null;
                                let totalStock = 0;
                                let hasProduct = products.length > 0;
                                let hasVariant = false;

                                if (hasProduct) {
                                  for (const prod of products) {
                                    const variants = prod.variants && Array.isArray(prod.variants)
                                      ? prod.variants
                                      : [{ color: prod.color, size: prod.size, stock: prod.stock }];
                                    
                                    const match = variants.find(v => 
                                      (!p.color || v.color?.toLowerCase() === p.color.toLowerCase()) &&
                                      (!p.size || v.size?.toLowerCase() === p.size.toLowerCase())
                                    );
                                    if (match) {
                                      foundVariant = match;
                                      totalStock = match.stock || 0;
                                      hasVariant = true;
                                      break;
                                    }
                                  }
                                }

                                // Stock checks
                                let badgeText = '';
                                let badgeClass = '';
                                if (!hasProduct) {
                                  badgeText = '❌ Out of Stock (No record found)';
                                  badgeClass = 'bg-red-500/15 text-red-400 border border-red-500/30';
                                } else if (!hasVariant) {
                                  badgeText = `❌ Out of Stock (Variant ${[p.color, p.size].filter(Boolean).join('/')} not found)`;
                                  badgeClass = 'bg-red-500/15 text-red-400 border border-red-500/30';
                                } else if (totalStock >= p.qty) {
                                  badgeText = `✅ Stock Available (Stock: ${totalStock} / Need: ${p.qty})`;
                                  badgeClass = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
                                } else if (totalStock > 0) {
                                  badgeText = `⚠️ Insufficient Stock (Stock: ${totalStock} / Need: ${p.qty})`;
                                  badgeClass = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
                                } else {
                                  badgeText = `❌ Out of Stock (Stock: 0 / Need: ${p.qty})`;
                                  badgeClass = 'bg-red-500/15 text-red-400 border border-red-500/30';
                                }

                                return (
                                  <div key={i} className="theme-bg rounded-xl p-3 border theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-indigo-500/20 transition-all duration-300">
                                    <div>
                                      <p className="text-[10px] font-black theme-text-primary uppercase tracking-wider">{p.name}</p>
                                      {(p.color || p.size) && (
                                        <p className="text-[8px] font-bold theme-text-muted mt-0.5">
                                          Variant: <span className="theme-text-secondary">{[p.color, p.size].filter(Boolean).join(' / ')}</span>
                                        </p>
                                      )}
                                      <p className="text-[8px] font-bold theme-text-muted">Requested Qty: <span className="theme-text-secondary">{p.qty}</span></p>
                                    </div>
                                    <div className="flex items-center shrink-0">
                                      <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${badgeClass}`}>
                                        {badgeText}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Reason */}
                        {req.reason && (
                          <div className="theme-bg rounded-xl p-3 border theme-border">
                            <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider mb-1">Reason</p>
                            <p className="text-[9px] font-medium italic theme-text-secondary">"{req.reason}"</p>
                          </div>
                        )}

                        {/* Request Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[8px] font-bold theme-text-muted">
                          <div className="flex items-center gap-3">
                            <span>Requested by: {req.requestedBy?.name || 'Unknown'} ({req.requestedBy?.role || '?'})</span>
                            {req.reviewedBy && (
                              <span>| Reviewed by: {req.reviewedBy?.name || 'Unknown'}</span>
                            )}
                          </div>
                          <span>{new Date(req.requestedAt).toLocaleString()}</span>
                        </div>

                        {/* Review Details for non-pending */}
                        {req.status !== 'PENDING' && req.adminRemarks && (
                          <div className="theme-bg rounded-xl p-3 border theme-border">
                            <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider mb-1">Admin Remarks</p>
                            <p className="text-[9px] font-medium italic theme-text-secondary">"{req.adminRemarks}"</p>
                            {req.reviewedAt && (
                              <p className="text-[7px] font-bold theme-text-muted mt-1">Reviewed {new Date(req.reviewedAt).toLocaleString()}</p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {req.status === 'PENDING' && (
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => { setReviewData(req); setReviewAction('approve'); setReviewRemarks(''); setShowReviewModal(true); }}
                              className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                            >
                              <ThumbsUp size={13} /> Approve
                            </button>
                            <button
                              onClick={() => { setReviewData(req); setReviewAction('reject'); setReviewRemarks(''); setShowReviewModal(true); }}
                              className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
                            >
                              <ThumbsDown size={13} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && reviewData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${reviewAction === 'approve' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {reviewAction === 'approve' ? <ThumbsUp className="text-emerald-400" size={24} /> : <ThumbsDown className="text-red-400" size={24} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{reviewAction === 'approve' ? 'Approve Edit' : 'Reject Edit'}</h2>
                  <p className="text-gray-400 text-xs font-bold">Order #{reviewData.order?.orderNumber || reviewData.orderId?.substring(0, 8)}</p>
                </div>
              </div>

              {reviewAction === 'approve' && (
                <div className="space-y-3 mb-4">
                  <div className="theme-bg rounded-xl p-4 border theme-border">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">⚠ Inventory will auto-adjust</p>
                    <p className="text-[9px] font-medium theme-text-muted">The system will automatically restore stock for removed products and deduct stock for new products.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Admin Remarks (Optional)</label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-gray-600 outline-none font-medium text-sm text-white mt-2 resize-none h-24"
                    placeholder="Add remarks or comments..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowReviewModal(false); setReviewData(null); }}
                    disabled={reviewSubmitting}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={reviewAction === 'approve' ? handleApprove : handleReject}
                    disabled={reviewSubmitting}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-red-600 text-white hover:bg-red-500'
                    }`}
                  >
                    {reviewSubmitting ? <Loader2 className="animate-spin" size={14} /> : reviewAction === 'approve' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                    <span>{reviewSubmitting ? 'Processing...' : reviewAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EditRequestDashboard;
