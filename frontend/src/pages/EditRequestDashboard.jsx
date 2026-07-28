import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { debounce } from '../utils/debounce';
import useCache from '../hooks/useCache';
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
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

const STAGE_ORDER = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED'];
const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', LOGO_DESIGN: 'Logo Design',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance', PRODUCTION: 'Production', DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
  COMPLETED: 'Completed', DELIVERED: 'Delivered'
};

const EditRequestDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data, loading, refresh } = useCache('edit-requests:all', {
    fetcher: async () => {
      const res = await api.get('/api/edit-requests?stats=true');
      return { stats: res.data, requests: Array.isArray(res.data.requests) ? res.data.requests : [] };
    },
    ttl: 60 * 1000,
  });
  const stats = data?.stats || { total: 0, byStatus: {}, bySource: {} };
  const allRequests = data?.requests || [];

  const [activeTab, setActiveTab] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    const debouncedRefresh = debounce(refresh, 300);
    socket.on('global-alert', debouncedRefresh);
    return () => socket.off('global-alert', debouncedRefresh);
  }, [refresh]);

  const handleApprove = async () => {
    if (!reviewData) return;
    setReviewSubmitting(true);
    try {
      await api.put(`/api/edit-requests/${reviewData.id}/approve`,
        { adminRemarks: reviewRemarks }
      );
      setShowReviewModal(false);
      setReviewData(null);
      setReviewRemarks('');
      refresh();
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
      await api.put(`/api/edit-requests/${reviewData.id}/reject`,
        { adminRemarks: reviewRemarks }
      );
      setShowReviewModal(false);
      setReviewData(null);
      setReviewRemarks('');
      refresh();
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
          const cust = item.customization || {};
          items.push({
            name: d.productType || '',
            color: d.color || '',
            size: d.size || '',
            fabricType: d.fabricType || '',
            gender: d.gender || '',
            qty: item.quantity || 1,
            totalPrice: item.totalPrice || 0,
            sleeveLength: d.sleeveLength || '',
            shirtLength: d.shirtLength || '',
            matchingCap: d.matchingCap ? 'Yes' : 'No',
            matchingCapQty: d.matchingCapQty || 0,
            nameSpelling: cust.nameSpelling || '',
            nameColor: cust.nameColor || '',
            logoColor: cust.logoColor || '',
            logoPlacement: cust.logoPlacement || '',
            designNotes: cust.designNotes || '',
            logoDesign: cust.logoDesign || item.logoDesign || '',
            logoName: item.logoName || '',
            logoCharges: item.logoCharges || 0,
            namePrintingCharges: item.namePrintingCharges || 0,
            customizationPrice: item.customizationPrice || 0,
            capCharges: item.capCharges || 0,
          });
        });
      } else if (pd?.productType) {
        const cust = parseJSON(pd.customization) || {};
        items.push({
          name: pd.productType,
          color: pd.color || '',
          size: pd.size || '',
          fabricType: pd.fabricType || '',
          gender: pd.gender || '',
          qty: data?.quantity || 1,
          totalPrice: pd.totalPrice || 0,
          sleeveLength: pd.sleeveLength || '',
          shirtLength: pd.shirtLength || '',
          matchingCap: pd.matchingCap ? 'Yes' : 'No',
          matchingCapQty: pd.matchingCapQty || 0,
          nameSpelling: cust.nameSpelling || '',
          nameColor: cust.nameColor || '',
          logoColor: cust.logoColor || '',
          logoPlacement: cust.logoPlacement || '',
          designNotes: cust.designNotes || '',
          logoDesign: cust.logoDesign || '',
          logoName: '',
          logoCharges: 0,
          namePrintingCharges: 0,
          customizationPrice: 0,
          capCharges: 0,
        });
      }
    } catch {}
    return items;
  };

  const parseJSON = (data) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; }
    catch { return {}; }
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
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-0.5">
              {stats.total} total request{stats.total !== 1 ? 's' : ''} — {stats.byStatus?.PENDING || 0} pending
            </p>
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost btn-sm">
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
              <p className="text-xs font-bold theme-text-muted uppercase tracking-wider">{stat.label}</p>
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
            className={`px-4 py-2 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-900/20'
                : 'bg-gray-900/50 text-gray-500 border border-gray-800 hover:border-gray-600'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            {tab !== 'ALL' && (
              <span className="ml-1.5 text-xs opacity-60">
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
                        <p className="text-xs theme-text-muted font-bold truncate">{order.customerName || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
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
                  <div className="flex items-center gap-3 text-xs font-bold theme-text-muted">
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
                          <p className="text-xs font-black theme-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
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


                        {/* Current Department / Holder */}
                        <div className="theme-bg rounded-xl p-3 border theme-border">
                          <p className="text-xs font-black theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Activity size={10} /> Current Department / Holder
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`px-2.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                              order.currentStage && currentStageIdx >= STAGE_ORDER.indexOf('PRODUCTION')
                                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}>
                              {STAGE_LABELS[order.currentStage] || order.currentStage || '—'}
                            </div>
                            {(() => {
                              const prodIdx = STAGE_ORDER.indexOf('PRODUCTION');
                              const prodCompleted = order.stages?.some(s => s.stageName === 'PRODUCTION' && s.status === 'COMPLETED');
                              const prodCurrent = order.currentStage === 'PRODUCTION';
                              if (prodCurrent) return <span className="text-xs font-bold px-2 py-1 bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/30">&#9881; In Production</span>;
                              if (prodCompleted) return <span className="text-xs font-bold px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/30">&#10003; Production Complete</span>;
                              if (currentStageIdx >= 0 && currentStageIdx < prodIdx) return <span className="text-xs font-bold px-2 py-1 bg-gray-800 text-gray-500 rounded-lg border border-gray-700">&#9203; Pre-Production</span>;
                              if (currentStageIdx > prodIdx) return <span className="text-xs font-bold px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/30">&#10003; Past Production</span>;
                              return null;
                            })()}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-bold theme-text-muted">
                            <span>Order Source: <span className="theme-text-primary uppercase">{order.source || order.outletName || 'N/A'}</span></span>
                            <span className="text-gray-700">|</span>
                            <span>Created: <span className="theme-text-primary">{new Date(order.createdAt).toLocaleDateString()}</span></span>
                          </div>
                        </div>


                        {/* Customer Info Changes */}
                        {(() => {
                          const rc = req.requestedChanges || {};
                          const order = req.order || {};
                          const customerFields = [
                            { label: 'Customer', field: 'customerName', oldVal: order.customerName, newVal: rc.customerName },
                            { label: 'Phone', field: 'customerPhone', oldVal: order.customerPhone, newVal: rc.customerPhone },
                            { label: 'Address', field: 'address', oldVal: order.address, newVal: rc.address },
                            { label: 'City', field: 'city', oldVal: order.city, newVal: rc.city },
                            { label: 'Type', field: 'type', oldVal: order.type, newVal: rc.type },
                            { label: 'Priority', field: 'priority', oldVal: order.priority, newVal: rc.priority },
                            { label: 'Advance Amount', field: 'advanceAmount', oldVal: `₨${parseFloat(order.advanceAmount || 0).toLocaleString()}`, newVal: `₨${parseFloat(rc.advanceAmount || 0).toLocaleString()}` },
                            { label: 'Delivery Charges', field: 'deliveryCharges', oldVal: `₨${parseFloat(order.deliveryCharges || 0).toLocaleString()}`, newVal: `₨${parseFloat(rc.deliveryCharges || 0).toLocaleString()}` },
                            { label: 'Engraving Required', field: 'engravingRequired', oldVal: order.engravingRequired !== false ? 'Yes' : 'No', newVal: rc.engravingRequired !== false ? 'Yes' : 'No' },
                            { label: 'Engraving Instructions', field: 'engravingInstructions', oldVal: order.engravingInstructions || '', newVal: rc.engravingInstructions || '' },
                            { label: 'Special Notes', field: 'instructionNotes', oldVal: order.instructionNotes || '', newVal: rc.instructionNotes || '' },
                            { label: 'Logo Name', field: 'logoName', oldVal: order.logoName || '', newVal: rc.logoName || '' },
                            { label: 'Logo Design', field: 'logoDesign', oldVal: order.logoDesign || '', newVal: rc.logoDesign || '' },
                            { label: 'Logo Charges', field: 'logoCharges', oldVal: `₨${parseFloat(order.logoCharges || 0).toLocaleString()}`, newVal: `₨${parseFloat(rc.logoCharges || 0).toLocaleString()}` },
                            { label: 'Name Print Charges', field: 'namePrintingCharges', oldVal: `₨${parseFloat(order.namePrintingCharges || 0).toLocaleString()}`, newVal: `₨${parseFloat(rc.namePrintingCharges || 0).toLocaleString()}` },
                            { label: 'Customization Charges', field: 'customizationPrice', oldVal: `₨${parseFloat(order.customizationPrice || 0).toLocaleString()}`, newVal: `₨${parseFloat(rc.customizationPrice || 0).toLocaleString()}` },
                            { label: 'Shopify Order Date', field: 'shopifyOrderDate', oldVal: order.shopifyOrderDate ? new Date(order.shopifyOrderDate).toLocaleDateString() : '—', newVal: rc.shopifyOrderDate ? new Date(rc.shopifyOrderDate).toLocaleDateString() : '—' },
                          ];
                          const changedFields = customerFields.filter(f => {
                            if (f.newVal === undefined) return false;
                            return String(f.oldVal || '').trim() !== String(f.newVal || '').trim();
                          });
                          if (changedFields.length === 0) return null;
                          return (
                            <div className="theme-bg rounded-xl p-3 border border-blue-500/20">
                              <p className="text-xs font-black text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Users size={10} /> Customer Info Changes
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs md:text-sm">
                                  <thead>
                                    <tr className="border-b border-blue-500/20">
                                      <th className="text-left py-1.5 pr-2 font-black text-gray-500 uppercase tracking-wider">Field</th>
                                      <th className="text-left py-1.5 px-2 font-black text-red-400 uppercase tracking-wider">Current</th>
                                      <th className="text-left py-1.5 pl-2 font-black text-emerald-400 uppercase tracking-wider">Requested</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {changedFields.map((f, i) => (
                                      <tr key={i} className="border-b border-blue-500/10">
                                        <td className="py-1.5 pr-2 font-bold theme-text-primary">{f.label}</td>
                                        <td className="py-1.5 px-2 text-red-400 line-through">{String(f.oldVal ?? '—')}</td>
                                        <td className="py-1.5 pl-2 text-emerald-400 font-bold">{String(f.newVal ?? '—')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Old vs New — Full Comparison Table */}
                        <div className="theme-bg rounded-xl p-3 border border-amber-500/20">
                          <p className="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <RefreshCw size={10} /> Items Comparison — Old vs New
                          </p>
                          {(() => {
                            // Build merged comparison list
                            const merged = [];
                            const maxLen = Math.max(oldItems.length, newItems.length);
                            for (let i = 0; i < maxLen; i++) {
                              const old = oldItems[i] || null;
                              const nw = newItems[i] || null;
                              merged.push({ old, nw, idx: i + 1 });
                            }
                            if (merged.length === 0) return <p className="text-xs theme-text-muted italic">No items</p>;
                            return (
                              <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-xs md:text-sm">
                                  <thead>
                                    <tr className="border-b border-amber-500/20">
                                      <th className="text-left py-1.5 pr-1 font-black text-gray-500 uppercase tracking-wider">#</th>
                                      <th className="text-left py-1.5 px-1 font-black text-gray-500 uppercase tracking-wider">Detail</th>
                                      <th className="text-left py-1.5 px-2 font-black text-red-400 uppercase tracking-wider">Current</th>
                                      <th className="text-left py-1.5 pl-2 font-black text-emerald-400 uppercase tracking-wider">Requested</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {merged.map(({ old, nw, idx }) => {
                                      // Define rows for each item
                                      const rows = [
                                        { label: 'Product', oldVal: old?.name || '—', newVal: nw?.name || '—' },
                                        { label: 'Color', oldVal: old?.color || '—', newVal: nw?.color || '—' },
                                        { label: 'Size', oldVal: old?.size || '—', newVal: nw?.size || '—' },
                                        { label: 'Fabric', oldVal: old?.fabricType || '—', newVal: nw?.fabricType || '—' },
                                        { label: 'Gender', oldVal: old?.gender || '—', newVal: nw?.gender || '—' },
                                        { label: 'Quantity', oldVal: String(old?.qty ?? '—'), newVal: String(nw?.qty ?? '—') },
                                        { label: 'Price', oldVal: old?.totalPrice ? `₨${Number(old.totalPrice).toLocaleString()}` : '—', newVal: nw?.totalPrice ? `₨${Number(nw.totalPrice).toLocaleString()}` : '—' },
                                        { label: 'Sleeve Length', oldVal: old?.sleeveLength || '—', newVal: nw?.sleeveLength || '—' },
                                        { label: 'Shirt Length', oldVal: old?.shirtLength || '—', newVal: nw?.shirtLength || '—' },
                                        { label: 'Matching Cap', oldVal: old?.matchingCap || 'No', newVal: nw?.matchingCap || 'No' },
                                        { label: 'Name Spelling', oldVal: old?.nameSpelling || '—', newVal: nw?.nameSpelling || '—' },
                                        { label: 'Name Color', oldVal: old?.nameColor || '—', newVal: nw?.nameColor || '—' },
                                        { label: 'Logo Color', oldVal: old?.logoColor || '—', newVal: nw?.logoColor || '—' },
                                        { label: 'Logo Placement', oldVal: old?.logoPlacement || '—', newVal: nw?.logoPlacement || '—' },
                                        { label: 'Design Notes', oldVal: old?.designNotes || '—', newVal: nw?.designNotes || '—' },
                                        { label: 'Logo Name', oldVal: old?.logoName || '—', newVal: nw?.logoName || '—' },
                                        { label: 'Logo Design', oldVal: old?.logoDesign || '—', newVal: nw?.logoDesign || '—' },
                                        { label: 'Logo Charges', oldVal: old?.logoCharges ? `₨${Number(old.logoCharges).toLocaleString()}` : '—', newVal: nw?.logoCharges ? `₨${Number(nw.logoCharges).toLocaleString()}` : '—' },
                                        { label: 'Name Print Charges', oldVal: old?.namePrintingCharges ? `₨${Number(old.namePrintingCharges).toLocaleString()}` : '—', newVal: nw?.namePrintingCharges ? `₨${Number(nw.namePrintingCharges).toLocaleString()}` : '—' },
                                        { label: 'Customization Charges', oldVal: old?.customizationPrice ? `₨${Number(old.customizationPrice).toLocaleString()}` : '—', newVal: nw?.customizationPrice ? `₨${Number(nw.customizationPrice).toLocaleString()}` : '—' },
                                      ];
                                      return rows.map((row, ri) => {
                                        const isChanged = row.oldVal !== row.newVal;
                                        if (!isChanged && !nw) return null;
                                        if (!nw && row.oldVal === '—') return null;
                                        return (
                                          <tr key={`${idx}-${ri}`} className={`border-b border-amber-500/5 ${ri === 0 ? 'border-t border-amber-500/10' : ''}`}>
                                            {ri === 0 && (
                                              <td rowSpan={rows.length} className="py-1.5 pr-1 align-top pt-2">
                                                <span className="text-xs md:text-sm font-black text-amber-400">{idx}.</span>
                                              </td>
                                            )}
                                            <td className={`py-1 px-1 font-bold ${isChanged ? 'text-amber-400' : 'text-gray-500'}`}>
                                              {row.label}
                                            </td>
                                            <td className={`py-1 px-2 ${!old ? 'text-gray-600 italic' : isChanged ? 'text-red-400 line-through' : 'theme-text-primary'}`}>
                                              {old ? row.oldVal : '—'}
                                            </td>
                                            <td className={`py-1 pl-2 font-bold ${!nw ? 'text-gray-600 italic' : isChanged ? 'text-emerald-400' : 'theme-text-primary'}`}>
                                              {nw ? row.newVal : '(removed)'}
                                            </td>
                                          </tr>
                                        );
                                      });
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}

                          {/* Pricing Summary */}
                          {(() => {
                            const oldTotal = oldItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
                            const newTotal = newItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
                            if (oldTotal === 0 && newTotal === 0) return null;
                            const diff = newTotal - oldTotal;
                            return (
                              <div className="mt-3 pt-3 border-t border-amber-500/20 grid grid-cols-3 gap-3">
                                <div className="text-center">
                                  <p className="text-[9px] font-black text-red-400 uppercase tracking-wider">Current Total</p>
                                  <p className="text-sm font-black theme-text-primary">₨{oldTotal.toLocaleString()}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Requested Total</p>
                                  <p className="text-sm font-black theme-text-primary">₨{newTotal.toLocaleString()}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-wider">Difference</p>
                                  <p className={`text-sm font-black ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {diff > 0 ? '+' : ''}{diff === 0 ? '₨0' : `₨${diff.toLocaleString()}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Inventory Note */}
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                          <p className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Package size={10} /> Inventory Unchanged
                          </p>
                          <p className="text-xs font-bold theme-text-muted mt-1">
                            Stock levels will not be affected. The order will be sent back to Store with updated details.
                          </p>
                        </div>

                        {/* Reason */}
                        {req.reason && (
                          <div className="theme-bg rounded-xl p-3 border theme-border">
                            <p className="text-xs font-black theme-text-muted uppercase tracking-wider mb-1">Reason</p>
                            <p className="text-xs md:text-sm font-medium italic theme-text-secondary">"{req.reason}"</p>
                          </div>
                        )}

                        {/* Request Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold theme-text-muted">
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
                            <p className="text-xs font-black theme-text-muted uppercase tracking-wider mb-1">Admin Remarks</p>
                            <p className="text-xs md:text-sm font-medium italic theme-text-secondary">"{req.adminRemarks}"</p>
                            {req.reviewedAt && (
                              <p className="text-[9px] font-bold theme-text-muted mt-1">Reviewed {new Date(req.reviewedAt).toLocaleString()}</p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {req.status === 'PENDING' && (
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => { setReviewData(req); setReviewAction('approve'); setReviewRemarks(''); setShowReviewModal(true); }}
                              className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                            >
                              <ThumbsUp size={13} /> Approve
                            </button>
                            <button
                              onClick={() => { setReviewData(req); setReviewAction('reject'); setReviewRemarks(''); setShowReviewModal(true); }}
                              className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-900/30"
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
                  <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">✓ No inventory changes</p>
                    <p className="text-xs md:text-sm font-medium theme-text-muted">Stock levels will not be affected. The order will be sent back to Store with updated details.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Admin Remarks (Optional)</label>
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
