import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, ChevronRight, AlertCircle, ClipboardList, Check, X, RefreshCcw, MessageSquare, History, Target, Trash2, Truck, Users, Phone, ShieldAlert, RotateCcw, Lock, Package, AlertTriangle, Printer } from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import Button from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import { printJobSheet } from '../utils/printReport';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const OrderCard = ({ order, onUpdateStage, userRole, isUnseen = false, onMarkSeen, selected, onToggleSelect }) => {
  const { t, isUrdu, LanguageToggle } = useLanguage();
  const [localInventoryAdded, setLocalInventoryAdded] = useState(false);
  const currentStage = order.stages?.find(s => s.stageName === order.currentStage) || order.stages?.[0];

  const isFaisal = ['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET'].includes(userRole);
  const showPrice = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const priceDisplay = (v) => showPrice ? `₨${(v || 0).toLocaleString()}` : '★ ★ ★';
  const [timeLeft, setTimeLeft] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);
  const [printLang, setPrintLang] = useState('ur');
  const [showPrintFilter, setShowPrintFilter] = useState(false);
  const [printSections, setPrintSections] = useState({ measurements: true, engraving: true });
  const [urgencyColor, setUrgencyColor] = useState('text-blue-400');
  const [deadlineStatus, setDeadlineStatus] = useState(''); // ON_TIME, APPROACHING, OVERDUE, COMPLETED
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [nextStage, setNextStage] = useState('');
  const [customizationAmount, setCustomizationAmount] = useState('0');
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [problemNote, setProblemNote] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState('');
  const [showForceModal, setShowForceModal] = useState(false);
  const [storeRouteDest, setStoreRouteDest] = useState('DISPATCH');
  const [forceAction, setForceAction] = useState('FORCE_MOVE');
  const [forceStage, setForceStage] = useState('');
  const [forceHours, setForceHours] = useState('');
  const [forceReason, setForceReason] = useState('');
  const [forceLoading, setForceLoading] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'FAISAL'].includes(userRole);
  const [invCheck, setInvCheck] = useState(null);
  const [invCheckLoading, setInvCheckLoading] = useState(false);
  const [invCheckExpanded, setInvCheckExpanded] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showJobSheet, setShowJobSheet] = useState(false);
  const [showProdHistory, setShowProdHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const getItemStatus = useCallback((item) => {
    if (item.availabilityStatus === 'available') return true;
    if (item.availabilityStatus === 'not_available') return false;
    return undefined;
  }, []);

  const [productAvailability, setProductAvailability] = useState(() => {
    const init = {};
    if (order?.productDetails) {
      try {
        const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
        const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
        items.forEach((item, idx) => {
          const st = getItemStatus(item);
          if (st !== undefined) init[idx] = st;
        });
      } catch {}
    }
    return init;
  });

  useEffect(() => {
    if (order?.productDetails) {
      try {
        const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
        const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
        const next = {};
        items.forEach((item, idx) => {
          const st = getItemStatus(item);
          if (st !== undefined) next[idx] = st;
        });
        setProductAvailability(next);
      } catch {}
    }
  }, [order?.productDetails, getItemStatus]);

  const handleProductAvailabilityToggle = useCallback(async (idx, isAvailable) => {
    try {
      const token = sessionStorage.getItem('token');
      // Optimistically update local state
      setProductAvailability(prev => ({ ...prev, [idx]: isAvailable }));

      await axios.patch(`${API_URL}/api/orders/${order.id}/product-availability`, {
        productAvailability: { [idx]: isAvailable }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(isAvailable ? 'Item Completed' : 'Item Rejected');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update product availability');
      // Revert state to original
      if (order?.productDetails) {
        try {
          const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
          const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
          const originalStatus = items[idx]?.availabilityStatus;
          setProductAvailability(prev => {
            const next = { ...prev };
            if (originalStatus === 'available') next[idx] = true;
            else if (originalStatus === 'not_available') next[idx] = false;
            else delete next[idx];
            return next;
          });
        } catch {}
      }
    }
  }, [order?.id, order?.productDetails]);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const withActionLoading = useCallback(async (actionName, asyncFn) => {
    if (actionLoading) return;
    setActionLoading(actionName);
    try {
      const result = await asyncFn();
      return result;
    } finally {
      setActionLoading(null);
    }
  }, [actionLoading]);

  const ActionBtn = ({ name, children, onClick, className = '', disabled: btnDisabled = false, variant = 'default' }) => {
    const isLoading = actionLoading === name;
    const variantStyles = {
      default: 'text-white',
      success: 'btn-ghost-success',
      danger: 'btn-ghost-danger',
      warning: 'btn-ghost-warning',
      primary: 'btn-ghost-primary',
    };
    return (
      <button
        onClick={() => withActionLoading(name, onClick)}
        disabled={!!actionLoading || btnDisabled}
        className={`${variantStyles[variant] || variantStyles.default} ${className} ${isLoading || actionLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
      >
        {isLoading ? <LoadingSpinner size={12} text="Processing..." /> : children}
      </button>
    );
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!currentStage?.deadlineAt || currentStage.status === 'COMPLETED') {
        setTimeLeft('--:--');
        setUrgencyColor('text-gray-600');
        setDeadlineStatus('COMPLETED');
        return;
      }
      const deadline = new Date(currentStage.deadlineAt).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        const absoluteDiff = Math.abs(diff);
        const h = Math.floor(absoluteDiff / (1000 * 60 * 60));
        const m = Math.floor((absoluteDiff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${t('Delayed')}: ${h}${t('h')} ${m}${t('m')}`);
        setIsDelayed(true);
        setUrgencyColor('text-red-500 font-black animate-pulse');
        setDeadlineStatus('OVERDUE');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}${t('h')} ${minutes}${t('m')} ${seconds}${t('s')}`);
      
      // Dynamic color based on time left
      if (hours < 1) { setUrgencyColor('text-red-400 font-black'); setDeadlineStatus('OVERDUE'); }
      else if (hours < 4) { setUrgencyColor('text-yellow-400 font-bold'); setDeadlineStatus('APPROACHING'); }
      else { setUrgencyColor('text-blue-400'); setDeadlineStatus('ON_TIME'); }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStage]);

  useEffect(() => {
    if (!showTimelineModal || !order?.id) return;
    setTimelineLoading(true);
    const token = sessionStorage.getItem('token');
    axios.get(`${API_URL}/api/orders/${order.id}/timeline`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setTimelineData(res.data))
      .catch(() => toast.error('Failed to load timeline'))
      .finally(() => setTimelineLoading(false));
  }, [showTimelineModal, order?.id]);

  const handleInventoryCheck = useCallback(() => {
    if (!currentStage || invCheck) return;
    setInvCheckLoading(true);
    const token = sessionStorage.getItem('token');
    axios.get(`${API_URL}/api/orders/${order.id}/inventory-check`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => setInvCheck(res.data))
      .catch(err => console.error('Error checking inventory:', err))
      .finally(() => setInvCheckLoading(false));
  }, [order.id, currentStage, invCheck]);

  const parseJSON = (data) => {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return {};
    }
  };

  // Normalize productDetails: handles both single-item (object) and multi-item (array) formats
  const normalizeProduct = (rawPd) => {
    const parsed = parseJSON(rawPd);
    if (Array.isArray(parsed)) {
      // Multi-item order: each element is { productDetails: {...}, customization, sizeData, quantity, totalPrice }
      const firstItem = parsed[0]?.productDetails || parsed[0] || {};
      return { primary: firstItem, allItems: parsed, isMultiItem: true };
    }
    // Single-item order (legacy): productDetails is the object itself
    return { primary: parsed || {}, allItems: null, isMultiItem: false };
  };

  const standardMeasurements = {
    'S': { chest: '36', shoulder: '14.5', length: '26', sleeve: '22', waist: '30', hips: '38' },
    'M': { chest: '38', shoulder: '15', length: '27', sleeve: '23', waist: '32', hips: '40' },
    'L': { chest: '40', shoulder: '16', length: '28', sleeve: '24', waist: '34', hips: '42' },
    'XL': { chest: '44', shoulder: '17', length: '29', sleeve: '25', waist: '38', hips: '46' },
    '2XL': { chest: '48', shoulder: '18', length: '30', sleeve: '26', waist: '42', hips: '50' }
  };

  const { primary: product, allItems: orderItems, isMultiItem } = normalizeProduct(order.productDetails);
  const rawSizes = parseJSON(order.sizeData);
  const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : (standardMeasurements[product?.size] || {});
  const custom = parseJSON(order.customization);

  const productionStages = ['PRODUCTION_ACCEPTANCE', 'PRODUCTION'];
  const productionDeadline = order.productionDeadline || order.stages?.find(s => s.stageName === 'PRODUCTION')?.deadlineAt;
  const isCurrentlyInProduction = productionStages.includes(currentStage?.stageName);

  const renderTasks = () => {
    const stage = currentStage?.stageName;
    if (stage === 'STORE') {
      const isStoreRole = ['STORE', 'STORE_EMPLOYEE'].includes(userRole);
      if (isMultiItem && orderItems?.length > 1) {
        const sortedItems = orderItems.map((item, idx) => ({ item, idx, isRejected: productAvailability[idx] === false, isCompleted: productAvailability[idx] === true }));
        sortedItems.sort((a, b) => {
          const ag = a.isCompleted ? 2 : a.isRejected ? 0 : 1;
          const bg = b.isCompleted ? 2 : b.isRejected ? 0 : 1;
          return bg - ag;
        });
        const hasRejected = sortedItems.some(s => s.isRejected);
        const hasCompleted = sortedItems.some(s => s.isCompleted);
        let headerShown = { rejected: false, pending: false, completed: false };
        return sortedItems.flatMap(({ item, idx, isRejected, isCompleted }) => {
          const p = item.productDetails || {};
          const rows = [];
          if (isRejected && !headerShown.rejected) {
            headerShown.rejected = true;
            rows.push(
              <li key="hdr-rej" className="text-xs font-black text-red-400 uppercase tracking-widest py-1.5 px-2 bg-red-900/10 rounded-lg border border-red-500/20 mb-1">
                ✗ Rejected / Unavailable
              </li>
            );
          }
          if (isCompleted && !headerShown.completed) {
            headerShown.completed = true;
            rows.push(
              <li key="hdr-cmp" className="text-xs font-black text-emerald-400 uppercase tracking-widest py-1.5 px-2 bg-emerald-900/10 rounded-lg border border-emerald-500/20 mb-1 mt-2">
                ✓ Completed
              </li>
            );
          }
          if (!isRejected && !isCompleted && !headerShown.pending && (hasRejected || hasCompleted)) {
            headerShown.pending = true;
            rows.push(
              <li key="hdr-pen" className="text-xs font-black text-gray-400 uppercase tracking-widest py-1.5 px-2 bg-gray-800/30 rounded-lg border border-gray-700/20 mb-1 mt-2">
                ⏳ Pending
              </li>
            );
          }
          rows.push(
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`text-xs md:text-sm flex items-center justify-between p-2 rounded-lg border ${isRejected ? 'bg-red-900/10 border-red-500/30 border-l-2 border-l-red-500' : isCompleted ? 'bg-emerald-900/10 border-emerald-500/30 border-l-2 border-l-emerald-500' : 'bg-gray-900/30 border-gray-800/20'}`}
            >
              <span className={`font-bold uppercase tracking-tighter ${isRejected ? 'text-orange-300' : isCompleted ? 'text-emerald-300' : 'text-gray-400'}`}>#{idx + 1} {p.productType || 'Item'}: {p.fabricType || 'STD'} / {p.color || '—'} / Size {p.size || '—'}</span>
              {isStoreRole && (
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, true); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : isRejected ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, false); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${isRejected ? 'bg-red-500/20 text-red-400 border border-red-500/30' : isCompleted ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                  >
                    ✗
                  </button>
                </div>
              )}
            </motion.li>
          );
          return rows;
        });
      }
      const items = [
        { label: 'Fabric', val: product?.fabricType },
        { label: 'Color', val: product?.color },
        { label: 'Base', val: product?.productType }
      ];
      const singleCompleted = productAvailability[0] === true;
      const singleRejected = productAvailability[0] === false;
      return (
        <>
          {isStoreRole && (
            <li className="flex items-center justify-between p-2 bg-gray-900/30 rounded-lg border border-gray-800/20 mb-2">
              <span className={`text-xs md:text-sm font-bold uppercase tracking-tighter ${singleCompleted ? 'text-emerald-400' : singleRejected ? 'text-red-400' : 'text-gray-400'}`}>
                Stock: {singleCompleted ? 'Completed' : singleRejected ? 'Rejected' : 'Pending'}
              </span>
              <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    disabled={singleCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, true); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${singleCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : singleRejected ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    disabled={singleCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, false); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${singleRejected ? 'bg-red-500/20 text-red-400 border border-red-500/30' : singleCompleted ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                >
                  ✗
                </button>
              </div>
            </li>
          )}
          {items.map((item, idx) => (
            <motion.li 
              key={idx}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="text-xs md:text-sm flex items-center justify-between p-2 bg-gray-900/30 rounded-lg border border-gray-800/20"
            >
              <span className="text-gray-400 font-bold uppercase tracking-tighter">{item.label}: {item.val || 'N/A'}</span>
            </motion.li>
          ))}
        </>
      );
    }

    if (stage === 'PRODUCTION') {
      const { primary: _, allItems: prodItems, isMultiItem: isMultiProd } = normalizeProduct(order.productDetails);
      const items = isMultiProd && prodItems ? prodItems : [{ productDetails: normalizeProduct(order.productDetails).primary, customization: parseJSON(order.customization), sizeData: parseJSON(order.sizeData) }];
      // Sort: unavailable items first
      const sortedItems = [...items].sort((a, b) => {
        const aNA = (a.productDetails || a).availabilityStatus === 'not_available';
        const bNA = (b.productDetails || b).availabilityStatus === 'not_available';
        return aNA === bNA ? 0 : aNA ? -1 : 1;
      });

      return (
        <div className="space-y-4">
          {sortedItems.map((item, idx) => {
            const p = item.productDetails || {};
            const c = item.customization || {};
            const s = item.sizeData || {};
            const female = p?.femaleOptions || {};
            const hasSizes = s && Object.keys(s).some(k => s[k]);
            const isFirst = idx === 0;
            const isNotAvail = p.availabilityStatus === 'not_available';

            return (
              <div key={idx} className={`${isMultiProd || items.length > 1 ? 'bg-gray-900/40 p-3 rounded-xl border border-gray-800/70' : ''}`}>
                {/* Per-product header for multi-item */}
                {(isMultiProd || sortedItems.length > 1) && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-800/50">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black">#{idx + 1}</span>
                    <span className="text-xs font-black text-white uppercase">{p.productType || `Item ${idx + 1}`}</span>
                    {p.color && <span className="text-[9px] text-gray-500">({p.color})</span>}
                    {isNotAvail && (
                      <span className="ml-auto px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[9px] font-black text-red-400 uppercase tracking-wider">
                        ⚠ To Be Manufactured
                      </span>
                    )}
                    {p.availabilityStatus === 'produced' && (
                      <span className="ml-auto px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-[9px] font-black text-blue-400 uppercase tracking-wider">
                        ✓ Produced
                      </span>
                    )}
                    {p.availabilityStatus === 'available' && (
                      <span className="ml-auto px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                        ✓ In Stock
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: t('Fabric'), v: p?.fabricType },
                    { l: t('Color'), v: p?.color },
                    { l: 'Size', v: p?.size }
                  ].filter(m => m.v).map((m, mi) => (
                    <div key={mi} className="bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 text-center">
                      <p className="text-[9px] text-blue-400 font-black uppercase">{m.l}</p>
                      <p className="text-xs md:text-sm font-black text-white truncate">{m.v}</p>
                    </div>
                  ))}
                </div>

                {/* Custom Requirements */}
                {(p?.fabricSourceProduct || p?.colorSourceProduct || p?.designSourceProduct || p?.sizeSourceProduct || p?.additionalProductRef) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p?.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Fabric: {p.fabricSourceProduct}</span>}
                    {p?.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Color: {p.colorSourceProduct}</span>}
                    {p?.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Design: {p.designSourceProduct}</span>}
                    {p?.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Size: {p.sizeSourceProduct}</span>}
                    {p?.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Extra: {p.additionalProductRef}</span>}
                  </div>
                )}

                <div className="bg-indigo-600/10 p-3 rounded-xl border border-indigo-600/20 mt-3">
                  <p className="text-xs text-indigo-400 font-black uppercase tracking-widest mb-2">Production Specs</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-950/50 p-2 rounded-lg">
                      <p className="text-[9px] text-gray-500 font-black uppercase">Fit</p>
                      <p className="text-xs md:text-sm font-black text-white">{c?.fitType || 'REGULAR'}</p>
                    </div>
                    <div className="bg-gray-950/50 p-2 rounded-lg">
                      <p className="text-[9px] text-gray-500 font-black uppercase">Style</p>
                      <p className="text-xs md:text-sm font-black text-white">{c?.stitchingStyle ? (c.stitchingStyle === 'DBL' ? 'Double' : 'Single') : 'STANDARD'}</p>
                    </div>
                    {c?.engravingType && (
                      <div className="bg-gray-950/50 p-2 rounded-lg">
                        <p className="text-[9px] text-gray-500 font-black uppercase">Engraving</p>
                        <p className="text-xs md:text-sm font-black text-violet-400">{c.engravingType === 'direct' ? 'Direct' : 'Patch'}</p>
                      </div>
                    )}
                    {p?.gender === 'Female' && (
                      <>
                        {(p?.sleeveLength || (female.sleeves && female.sleeves !== 'full')) && (
                          <div className="bg-gray-950/50 p-2 rounded-lg">
                            <p className="text-[9px] text-gray-500 font-black uppercase">Sleeves</p>
                            <p className="text-xs md:text-sm font-black text-white">{p.sleeveLength ? ({'full':'Full Sleeve','half':'Half Sleeve','three-quarter':'3 Quarter Sleeve'}[p.sleeveLength] || p.sleeveLength) : ({'full':'Full Sleeve','half':'Half Sleeve','medium':'Medium Sleeve'}[female.sleeves] || female.sleeves || 'N/A')}</p>
                          </div>
                        )}
                        {(p?.shirtLength || (female.shirtLength && female.shirtLength !== 'long')) && (
                          <div className="bg-gray-950/50 p-2 rounded-lg">
                            <p className="text-[9px] text-gray-500 font-black uppercase">Shirt L.</p>
                            <p className="text-xs md:text-sm font-black text-white">{p.shirtLength ? ({'long':'Full Length','short':'Short Length','regular':'Regular Length'}[p.shirtLength] || p.shirtLength) : ({'long':'Full Length','short':'Short Length'}[female.shirtLength] || female.shirtLength || 'N/A')}</p>
                          </div>
                        )}
                      </>
                    )}
                    {p?.sleeveLength && p?.gender !== 'Female' && (
                      <div className="bg-gray-950/50 p-2 rounded-lg">
                        <p className="text-[9px] text-gray-500 font-black uppercase">Sleeves</p>
                        <p className="text-xs md:text-sm font-black text-white">{p.sleeveLength === 'full' ? 'Full' : p.sleeveLength === 'three-quarter' ? '3 Quarter' : p.sleeveLength === 'half' ? 'Half' : p.sleeveLength || 'Quarter'}</p>
                      </div>
                    )}
                    {p?.shirtLength && p?.gender !== 'Female' && (
                      <div className="bg-gray-950/50 p-2 rounded-lg">
                        <p className="text-[9px] text-gray-500 font-black uppercase">Shirt L.</p>
                        <p className="text-xs md:text-sm font-black text-white">{p.shirtLength === 'long' ? 'Full' : p.shirtLength === 'regular' ? 'Regular' : 'Short'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {hasSizes && (
                  <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50 mt-3">
                    <p className="text-xs md:text-sm text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Measurements</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left text-gray-500 font-black uppercase tracking-wider py-1.5 pr-2">Measurement</th>
                          <th className="text-right text-gray-500 font-black uppercase tracking-wider py-1.5 pl-2 w-16">Inches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { l: 'Chest', v: s?.chest },
                          { l: 'Shoulder', v: s?.shoulder },
                          { l: 'Length', v: s?.length },
                          { l: 'Sleeve', v: s?.sleeve },
                          { l: 'Waist', v: s?.waist },
                          { l: 'Hips', v: s?.hips }
                        ].filter(sm => sm.v).map((sm, si) => (
                          <tr key={si} className="border-b border-gray-800/30">
                            <td className="text-gray-400 font-bold py-1.5 pr-2">{sm.l}</td>
                            <td className="text-right text-white font-black py-1.5 pl-2">{sm.v}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s?.specialNote && (
                  <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10 mt-3">
                    <p className="text-xs md:text-sm font-black text-yellow-400 uppercase tracking-widest mb-1">Special Note</p>
                    <p className="text-xs md:text-sm font-bold text-yellow-300/90 italic leading-tight">{s.specialNote}</p>
                  </div>
                )}

                {/* Name Lines per product */}
                {(c?.articleNames?.length > 0 || c?.nameSpelling) && (
                  <div className="bg-purple-600/10 p-3 rounded-xl border border-purple-500/20 mt-3">
                    <p className="text-xs text-purple-400 font-black uppercase tracking-widest mb-2">Name Lines</p>
                    <div className="flex flex-wrap gap-2">
                      {c.articleNames?.length > 0 ? (
                        c.articleNames.map((an, ai) => (
                          <span key={ai} className="px-2 py-1 bg-purple-900/30 rounded text-xs font-black text-purple-300 border border-purple-500/20">
                            L{ai + 1}: {an}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-1 bg-purple-900/30 rounded text-xs font-black text-purple-300 border border-purple-500/20">L1: {c.nameSpelling}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Logos per product */}
                {c?.logos?.length > 0 && (
                  <div className="bg-amber-600/10 p-3 rounded-xl border border-amber-500/20 mt-3">
                    <p className="text-xs text-amber-400 font-black uppercase tracking-widest mb-2">Logos</p>
                    <div className="space-y-2">
                      {c.logos.map((logo, li) => (
                        <div key={li} className="bg-amber-900/20 p-2 rounded-lg border border-amber-500/10">
                          <p className="text-xs md:text-sm font-black text-amber-300">{logo.name || `Logo ${li + 1}`}</p>
                          {logo.design && <p className="text-xs text-gray-400 mt-0.5">{logo.design}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Special Notes per product */}
                {c?.designNotes && (
                  <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10 mt-3">
                    <p className="text-xs text-yellow-500 font-black uppercase tracking-widest mb-1 flex items-center space-x-1">
                      <MessageSquare size={10} />
                      <span>Special Note:</span>
                    </p>
                    <p className="text-xs md:text-sm text-gray-300 italic font-medium leading-tight">"{c.designNotes}"</p>
                  </div>
                )}

                {isFirst && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="px-2 py-1 bg-gray-800 rounded text-xs md:text-sm font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
                      GENDER: {p?.gender || 'N/A'}
                    </div>
                    {female.dupatta && (
                      <div className="px-2 py-1 bg-pink-900/20 rounded text-xs md:text-sm font-black uppercase tracking-tighter text-pink-400 border border-pink-500/20">
                        + DUPATTA
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 text-center">
             <p className="text-xs text-blue-400 font-black uppercase tracking-[0.2em] mb-1">Order ID</p>
             <h4 className="text-xl font-black text-white">#{order.orderNumber}</h4>
             <p className="text-xs md:text-sm text-gray-400 font-bold uppercase mt-1">{order.customerName}</p>
          </div>
        </div>
      );
    }

    const stageMap = {
      'NAME_LOGO': ['Name Embroidery', 'Color Check'],
      'CUSTOM_LOGO': ['Logo Design Apply', 'Custom Pattern'],
      'STORE_RECEIVE': ['Verify Items from Production', 'Check Quality & Quantity', 'Confirm Receipt'],
      'DISPATCH': ['Verify Packing ID', 'Attach Shipping Label', 'Assign to Delivery Partner'],
      'OUT_FOR_DELIVERY': ['Contact Customer', 'Verify Address', 'Deliver Package']
    };

    const tasks = stageMap[stage] || ['Follow Standard Protocol'];
    return tasks.map((t, i) => (
      <li key={i} className="text-xs text-gray-300 flex items-center space-x-2">
        <span className="text-blue-500 font-black">•</span>
        <span>{t}</span>
      </li>
    ));
  };

  const handleHoldAction = async (resume = false) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/orders/${order.id}/hold`, { 
        reason: holdReason,
        resume
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowHoldDialog(false);
      setHoldReason('');
      // Socket events from backend will trigger dashboard refresh automatically
    } catch (error) {
      console.error('Hold action error:', error);
      alert(error.response?.data?.message || 'Failed to update hold status');
    }
  };

  const isWaitingApproval = currentStage?.status === 'WAITING_APPROVAL';

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => {
          if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('a')) return;
          setIsExpanded(prev => !prev);
        }}
        className={`cursor-pointer glass rounded-3xl overflow-hidden max-w-full mb-6 ${order.priority === 'SUPER_URGENT' ? 'card-super-urgent border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : order.priority === 'URGENT' ? 'card-urgent' : isDelayed ? 'card-delayed' : 'border border-gray-800'} ${order.status === 'REJECTED' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : order.status === 'ON_HOLD' ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : ''}`}
      >
        <div className="p-3 md:p-4">
          <div className="flex justify-between items-start gap-2 md:gap-3 mb-2 md:mb-3">
            {onToggleSelect && (
              <div className="flex-shrink-0 pt-1" onClick={e => { e.stopPropagation(); onToggleSelect(order.id); }}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${selected ? 'bg-blue-600 border-blue-500' : 'border-gray-600 hover:border-blue-400'}`}>
                  {selected && <Check size={12} className="text-white" />}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {order.productImage && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                  <img src={order.productImage} alt="Product" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                  <h3 className="font-black text-base md:text-lg tracking-tighter text-white truncate max-w-[120px] md:max-w-none">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                  {order.priority === 'SUPER_URGENT' && (
                    <span className="bg-red-600 text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1">
                      <span>⚡</span> SUPER URGENT
                    </span>
                  )}
                  {order.priority === 'URGENT' && (
                    <span className="bg-amber-500 text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1">
                      <span>⚡</span> URGENT
                    </span>
                  )}
                  <span className={`text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                    order.type === 'FULL_CUSTOM' ? 'bg-indigo-600' : order.type === 'READY_LOGO' ? 'bg-purple-600' : 'bg-gray-700'
                  }`}>
                    {order.type}
                  </span>
                  {order.deliveryMethod && (
                    <span className="bg-emerald-600 text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                       <Truck size={7} /> {order.deliveryMethod.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-xs md:text-sm text-gray-400 font-bold tracking-wide truncate max-w-[140px] md:max-w-[200px]">
                    {order.customerName}
                    {order.shopifyOrderDate && (
                      <span className="text-purple-400 ml-2 font-black text-[9px] md:text-[10px]">Shopify: {new Date(order.shopifyOrderDate).toLocaleDateString()}</span>
                    )}
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-widest ${order.status === 'ON_HOLD' ? 'bg-orange-500/20 text-orange-400' : isWaitingApproval ? 'bg-orange-500 text-white animate-pulse' : 'bg-blue-500/10 text-blue-400'} border border-current flex items-center gap-1`}>
                    {(isWaitingApproval || order.status === 'ON_HOLD') && <AlertCircle size={7} />}
                    {order.status === 'ON_HOLD' ? t('Hold') : t(currentStage?.stageName)}
                  </span>
                  {!isWaitingApproval && order.status !== 'PENDING' && order.status !== 'REJECTED' && order.status !== 'ON_HOLD' && ['OUTLET'].includes(userRole) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter bg-gray-800/50 text-gray-500 border border-gray-700/50 flex items-center gap-0.5">
                      <Lock size={7} />
                    </span>
                  )}
                  {(() => {
                    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID';
                    const hasAdvance = parseFloat(order.advanceAmount || 0) > 0;
                    const remainingAmt = Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0));
                    if (isPaid) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PAID</span>;
                    if (hasAdvance) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter bg-orange-500/20 text-orange-400 border border-orange-500/30">REMAINING COD: ₨{remainingAmt.toLocaleString()}</span>;
                    return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter bg-red-500/20 text-red-400 border border-red-500/30">CASH ON DELIVERY</span>;
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {order.customerPhone && (
                    <span className="text-xs md:text-sm text-gray-500 font-medium flex items-center gap-1">
                      <Phone size={8} className="text-pink-500/60" /> 
                      <span className="font-mono">{order.customerPhone}</span>
                    </span>
                  )}
                  {order.totalPrice > 0 && (
                    <span className={`text-xs md:text-sm font-black flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${showPrice ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-500 bg-gray-800/50 border-gray-700/30'}`}>
                      {showPrice ? <><span>₨</span><span>{order.totalPrice.toLocaleString()}</span></> : '★ ★ ★'}
                    </span>
                  )}
                </div>
                <p className="text-[9px] md:text-[10px] text-gray-600 font-black uppercase mt-0.5 flex items-center gap-1">
                  <Users size={7} className="text-blue-500/50" />
                  {order.outletName === 'FAISAL CONTROL' ? 'ONLINE ORDER' : 
                   order.outletName || (
                     order.createdBy?.role === 'FAISAL' ? 'ONLINE ORDER' :
                     order.createdBy?.role === 'OUTLET' ? (
                       (order.createdBy?.name?.includes('1') || order.createdBy?.name?.toLowerCase().includes('johar')) ? 'JOHAR TOWN BRANCH' :
                       (order.createdBy?.name?.includes('2') || order.createdBy?.name?.toLowerCase().includes('jail')) ? 'JAIL ROAD BRANCH' :
                       (order.createdBy?.name?.includes('3') || order.createdBy?.name?.toLowerCase().includes('abbottabad')) ? 'ABBOTTABAD BRANCH' :
                       order.createdBy?.name
                     ) : order.createdBy?.name || 'System'
                  )}
                </p>
              </div>
            </div>
            {/* Compact Timer & SLA */}
            <div className="flex-shrink-0 flex flex-col items-end gap-0.5 min-w-[70px]">
              <div className={`font-mono text-xs md:text-sm tracking-tighter leading-none ${urgencyColor}`}>
                {timeLeft}
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {deadlineStatus === 'ON_TIME' && <span className="text-[6px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded-sm font-black uppercase">ON TIME</span>}
                {deadlineStatus === 'APPROACHING' && <span className="text-[6px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded-sm font-black uppercase">APPROACHING</span>}
                {deadlineStatus === 'OVERDUE' && <span className="text-[6px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded-sm font-black uppercase animate-pulse">OVERDUE</span>}
                {deadlineStatus === 'COMPLETED' && <span className="text-[6px] bg-gray-500/10 text-gray-400 px-1 py-0.5 rounded-sm font-black uppercase">COMPLETED</span>}
              </div>
              <span className="text-[6px] text-gray-600 font-mono">
                {currentStage?.deadlineAt ? new Date(currentStage.deadlineAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
              {isCurrentlyInProduction && productionDeadline && (
                <div className={`text-[6px] font-mono ${new Date(productionDeadline).getTime() < Date.now() ? 'text-red-400' : 'text-emerald-400'}`}>
                  🎯 {(() => {
                    const diff = new Date(productionDeadline).getTime() - Date.now();
                    if (diff <= 0) return 'OVERDUE';
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    return `${h}h ${m}m`;
                  })()}
                </div>
              )}
              {order.city && (
                <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider text-right">
                  📍 {order.city}
                </span>
              )}
              {order.address && (
                <span className="text-[9px] text-gray-500 font-medium truncate max-w-[90px] md:max-w-[140px] text-right" title={order.address}>
                  {order.address}
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="text-gray-600 mt-0.5"
              >
                <ChevronRight size={10} />
              </motion.div>
              {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`⚠ PERMANENTLY DELETE this order?\n\nOrder #${order.orderNumber || order.id.substring(0, 8)}\nCustomer: ${order.customerName}\n\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                      axios.delete(`${API_URL}/api/orders/${order.id}`, {
                        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                      }).then(() => {
                        toast.success('Order deleted permanently. Inventory restored.');
                        // Parent component will refresh via socket event
                      }).catch(err => {
                        alert(err.response?.data?.message || 'Failed to delete order');
                      });
                    }
                  }}
                  className="p-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20 mt-0.5"
                  title="Delete order permanently"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >

          {/* Product Details Strip */}
          {(product?.color || product?.size || product?.fabricType || product?.productType || order.quantity > 0 || order.customizationPrice > 0 || order.logoCharges > 0 || order.namePrintingCharges > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 bg-gray-950/50 p-2 rounded-xl border border-gray-800/50">
              {product?.productType && (
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-900 px-2 py-0.5 rounded-md truncate max-w-[100px]">{product.productType}</span>
              )}
              {product?.fabricType && (
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-900 px-2 py-0.5 rounded-md truncate max-w-[100px]">{product.fabricType}</span>
              )}
              {product?.color && (
                <span className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-tighter bg-gray-900 px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[100px]">
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: product.color.toLowerCase() }}></span>
                  {product.color}
                </span>
              )}
              {product?.size && (
                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-900 px-2 py-0.5 rounded-md">Size: {product.size}</span>
              )}
              {/* Custom Requirements */}
              {(product?.fabricSourceProduct || product?.colorSourceProduct || product?.designSourceProduct || product?.sizeSourceProduct || product?.additionalProductRef) && (
                <>
                  {product?.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[100px]">F:{product.fabricSourceProduct}</span>}
                  {product?.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[100px]">C:{product.colorSourceProduct}</span>}
                  {product?.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[100px]">D:{product.designSourceProduct}</span>}
                  {product?.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[100px]">S:{product.sizeSourceProduct}</span>}
                  {product?.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[100px]">E:{product.additionalProductRef}</span>}
                </>
              )}
              <span className="text-[9px] md:text-[10px] font-black text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-md">Qty: {order.quantity || 1}</span>
              {order.logoCharges > 0 && (
                <span className="text-[9px] md:text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-md">Logo: {showPrice ? `₨${Number(order.logoCharges).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.namePrintingCharges > 0 && (
                <span className="text-[9px] md:text-[10px] font-black text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-md">Name: {showPrice ? `₨${Number(order.namePrintingCharges).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.customizationPrice > 0 && (
                <span className="text-[9px] md:text-[10px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-md">Custom: {showPrice ? `₨${Number(order.customizationPrice).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.paymentStatus === 'PAID' && (
                <span className="text-[9px] md:text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">PAID</span>
              )}
              {order.courierDetails?.payments?.length > 0 && (
                <span className="text-[6px] md:text-[9px] font-bold text-gray-500">
                  {showPrice ? `₨${order.courierDetails.payments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} / ₨${(order.totalPrice || 0).toLocaleString()}` : '★ ★ ★'}
                </span>
              )}
              {order.deliveryType && (
                <span className="text-[9px] md:text-[10px] font-black text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-md uppercase truncate max-w-[120px]">{order.deliveryType.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}
          {/* Dispatch Order Details */}
          {currentStage?.stageName === 'DISPATCH' && (
            <div className="mb-3 bg-gray-950/30 rounded-2xl border border-cyan-800/50 overflow-hidden">
              <div className="p-3 md:p-4 space-y-3">
                <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <Package size={12} /> Order Details — Dispatch Verification
                </h4>
                {isMultiItem && orderItems?.length > 0 ? (
                  orderItems.map((item, idx) => {
                    const p = item.productDetails || item;
                    const ic = item.customization ? parseJSON(item.customization) : custom;
                    const isz = item.sizeData ? parseJSON(item.sizeData) : sizes;
                    const slip = { 'full':'Full Sleeve','half':'Half Sleeve','three-quarter':'3 Quarter Sleeve' };
                    const shmp = { 'long':'Full Length','short':'Short Length','regular':'Regular Length' };
                    const fsl = { 'full':'Full Sleeve','half':'Half Sleeve','medium':'Medium Sleeve' };
                    const fsh = { 'long':'Full Length','short':'Short Length' };
                    const slv = p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves ? p.femaleOptions.sleeves : null);
                    const shl = p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength ? p.femaleOptions.shirtLength : null);
                    return (
                      <div key={idx} className="border border-gray-800 rounded-xl p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400">#{idx + 1} {p.productType || 'Product'}</span>
                          <span className="text-[9px] font-black text-gray-500 uppercase">Qty: {item.quantity || 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {p.category && <div><span className="text-gray-500">Category:</span> <span className="text-white font-bold">{p.category}</span></div>}
                          {p.color && <div><span className="text-gray-500">Color:</span> <span className="text-white font-bold">{p.color}</span></div>}
                          {p.size && <div><span className="text-gray-500">Size:</span> <span className="text-white font-bold">{p.size}</span></div>}
                          {p.fabricType && <div><span className="text-gray-500">Fabric:</span> <span className="text-white font-bold">{p.fabricType}</span></div>}
                          {p.gender && <div><span className="text-gray-500">Gender:</span> <span className="text-white font-bold">{p.gender}</span></div>}
                        </div>
                        {(slv || shl || ic?.stitchingStyle || ic?.fitType) && (
                          <div className="flex flex-wrap gap-1">
                            {slv && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{slip[slv] || fsl[slv] || slv}</span>}
                            {shl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{shmp[shl] || fsh[shl] || shl}</span>}
                            {ic?.stitchingStyle && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{ic.stitchingStyle === 'DBL' ? 'Double Stitch' : ic.stitchingStyle === 'STD' ? 'Single Stitch' : ic.stitchingStyle}</span>}
                            {ic?.fitType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{ic.fitType} Fit</span>}
                          </div>
                        )}
                        {order.type === 'FULL_CUSTOM' && isz && Object.keys(isz).filter(k => k !== 'specialNote' && isz[k]).length > 0 && (
                          <div>
                            <span className="text-[9px] font-black text-gray-500 uppercase">Measurements</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(isz).filter(([k, v]) => v && k !== 'specialNote').map(([k, v]) => (
                                <span key={k} className="text-[9px] font-bold text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded">{k}: {v}</span>
                              ))}
                            </div>
                            {isz.specialNote && <p className="text-[9px] text-yellow-500 italic mt-1">{isz.specialNote}</p>}
                          </div>
                        )}
                        {ic && !ic.skipEngraving && (ic.engravingType || ic.nameSpelling || ic.articleNames?.length > 0 || ic.logos?.length > 0 || ic.designNotes || ic.stitchingStyle || ic.fitType || ic.nameColor || ic.logoPlacement) && (
                          <div className="border-t border-gray-800 pt-2 space-y-1">
                            {(ic.engravingType || ic.nameSpelling || ic.articleNames?.length > 0) && (
                              <div>
                                <span className="text-[9px] font-black text-amber-500 uppercase">Engraving</span>
                                {ic.engravingType && <span className="text-[9px] font-bold text-amber-400 ml-2">{ic.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                                {ic.articleNames?.length > 0 ? ic.articleNames.map((n, ai) => (
                                  <p key={ai} className="text-[10px] text-white font-bold ml-2">L{ai + 1}: {n}</p>
                                )) : ic.nameSpelling && <p className="text-[10px] text-white font-bold ml-2">{ic.nameSpelling}</p>}
                              </div>
                            )}
                            {ic.logos?.length > 0 && (
                              <div><span className="text-[9px] font-black text-amber-500 uppercase">Logos</span>{ic.logos.map((l, li) => (
                                <p key={li} className="text-[10px] text-white font-bold ml-2">{l.name}{l.design ? ` — ${l.design}` : ''}</p>
                              ))}</div>
                            )}
                            {ic.designNotes && <p className="text-[9px] text-yellow-500 italic">Note: {ic.designNotes}</p>}
                            {(ic.nameColor || ic.logoPlacement) && (
                              <div className="flex gap-1">
                                {ic.nameColor && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-900/30 text-pink-400">Color: {ic.nameColor}</span>}
                                {ic.logoPlacement && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-900/30 text-teal-400">Pos: {ic.logoPlacement}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border border-gray-800 rounded-xl p-2.5 space-y-2">
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      {product?.productType && <div><span className="text-gray-500">Product:</span> <span className="text-white font-bold">{product.productType}</span></div>}
                      {product?.category && <div><span className="text-gray-500">Category:</span> <span className="text-white font-bold">{product.category}</span></div>}
                      {product?.color && <div><span className="text-gray-500">Color:</span> <span className="text-white font-bold">{product.color}</span></div>}
                      {product?.size && <div><span className="text-gray-500">Size:</span> <span className="text-white font-bold">{product.size}</span></div>}
                      {product?.fabricType && <div><span className="text-gray-500">Fabric:</span> <span className="text-white font-bold">{product.fabricType}</span></div>}
                      {product?.gender && <div><span className="text-gray-500">Gender:</span> <span className="text-white font-bold">{product.gender}</span></div>}
                      <div><span className="text-gray-500">Qty:</span> <span className="text-white font-bold">{order.quantity || 1}</span></div>
                      <div><span className="text-gray-500">Type:</span> <span className="text-white font-bold">{order.type || 'STANDARD'}</span></div>
                    </div>
                    {(() => {
                      const slip = { 'full':'Full Sleeve','half':'Half Sleeve','three-quarter':'3 Quarter Sleeve' };
                      const shmp = { 'long':'Full Length','short':'Short Length','regular':'Regular Length' };
                      const fsl = { 'full':'Full Sleeve','half':'Half Sleeve','medium':'Medium Sleeve' };
                      const fsh = { 'long':'Full Length','short':'Short Length' };
                      const slv = product?.sleeveLength || (product?.gender === 'Female' && product?.femaleOptions?.sleeves ? product.femaleOptions.sleeves : null);
                      const shl = product?.shirtLength || (product?.gender === 'Female' && product?.femaleOptions?.shirtLength ? product.femaleOptions.shirtLength : null);
                      const hasCustom = slv || shl || custom?.stitchingStyle || custom?.fitType;
                      return hasCustom ? (
                        <div className="flex flex-wrap gap-1">
                          {slv && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{slip[slv] || fsl[slv] || slv}</span>}
                          {shl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">{shmp[shl] || fsh[shl] || shl}</span>}
                          {custom?.stitchingStyle && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{custom.stitchingStyle === 'DBL' ? 'Double Stitch' : custom.stitchingStyle === 'STD' ? 'Single Stitch' : custom.stitchingStyle}</span>}
                          {custom?.fitType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{custom.fitType} Fit</span>}
                        </div>
                      ) : null;
                    })()}
                    {order.type === 'FULL_CUSTOM' && sizes && Object.keys(sizes).filter(k => k !== 'specialNote' && sizes[k]).length > 0 && (
                      <div>
                        <span className="text-[9px] font-black text-gray-500 uppercase">Measurements</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(sizes).filter(([k, v]) => v && k !== 'specialNote').map(([k, v]) => (
                            <span key={k} className="text-[9px] font-bold text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded">{k}: {v}</span>
                          ))}
                        </div>
                        {sizes.specialNote && <p className="text-[9px] text-yellow-500 italic mt-1">{sizes.specialNote}</p>}
                      </div>
                    )}
                    {custom && !custom.skipEngraving && (custom.engravingType || custom.nameSpelling || custom.articleNames?.length > 0 || custom.logos?.length > 0 || custom.designNotes || custom.stitchingStyle || custom.fitType || custom.nameColor || custom.logoPlacement) && (
                      <div className="border-t border-gray-800 pt-2 space-y-1">
                        {(custom.engravingType || custom.nameSpelling || custom.articleNames?.length > 0) && (
                          <div>
                            <span className="text-[9px] font-black text-amber-500 uppercase">Engraving</span>
                            {custom.engravingType && <span className="text-[9px] font-bold text-amber-400 ml-2">{custom.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                            {custom.articleNames?.length > 0 ? custom.articleNames.map((n, ai) => (
                              <p key={ai} className="text-[10px] text-white font-bold ml-2">L{ai + 1}: {n}</p>
                            )) : custom.nameSpelling && <p className="text-[10px] text-white font-bold ml-2">{custom.nameSpelling}</p>}
                          </div>
                        )}
                        {custom.logos?.length > 0 && (
                          <div><span className="text-[9px] font-black text-amber-500 uppercase">Logos</span>{custom.logos.map((l, li) => (
                            <p key={li} className="text-[10px] text-white font-bold ml-2">{l.name}{l.design ? ` — ${l.design}` : ''}</p>
                          ))}</div>
                        )}
                        {custom.designNotes && <p className="text-[9px] text-yellow-500 italic">Note: {custom.designNotes}</p>}
                        {(custom.nameColor || custom.logoPlacement) && (
                          <div className="flex gap-1">
                            {custom.nameColor && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-900/30 text-pink-400">Color: {custom.nameColor}</span>}
                            {custom.logoPlacement && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-900/30 text-teal-400">Pos: {custom.logoPlacement}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Customer & Order Info */}
                <div className="border border-gray-800 rounded-xl p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                  <div><span className="text-gray-500">Customer:</span> <span className="text-white font-bold">{order.customerName || '—'}</span></div>
                  <div><span className="text-gray-500">Phone:</span> <span className="text-white font-bold">{order.customerPhone || '—'}</span></div>
                  {order.address && <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="text-white font-bold">{order.address}</span></div>}
                  {order.city && <div><span className="text-gray-500">City:</span> <span className="text-white font-bold">{order.city}</span></div>}
                  <div><span className="text-gray-500">Order #:</span> <span className="text-white font-bold">{order.orderNumber || order.id?.slice(0, 8)}</span></div>
                  <div><span className="text-gray-500">Order Type:</span> <span className="text-white font-bold">{order.type || 'STANDARD'}</span></div>
                  <div><span className="text-gray-500">Priority:</span> <span className="text-white font-bold">{order.priority || 'NORMAL'}</span></div>
                  <div><span className="text-gray-500">Source:</span> <span className="text-white font-bold">{order.outletName || order.source || '—'}</span></div>
                  <div><span className="text-gray-500">Payment:</span> <span className="text-white font-bold">{order.paymentStatus === 'PAID' ? 'PAID' : parseFloat(order.advanceAmount || 0) > 0 ? `Advance: ₨${parseFloat(order.advanceAmount).toLocaleString()}` : 'COD'}</span></div>
                  <div><span className="text-gray-500">Date:</span> <span className="text-white font-bold">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</span></div>
                </div>
              </div>
            </div>
          )}
          {/* Collapsible Job Sheet Summary */}
          <div className="mb-3 bg-gray-950/30 rounded-2xl border border-gray-800/50 overflow-hidden">
            <button
              onClick={() => setShowJobSheet((prev) => !prev)}
              className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-gray-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <ClipboardList size={14} className="text-blue-400" />
                </div>
                <span className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-[0.15em]">{t('Job Sheet Summary')}</span>
              </div>
              <div className="flex items-center gap-2">
                {!showJobSheet && (
                  <span className="text-[6px] text-blue-500/60 font-black uppercase tracking-widest">{t('Tap to View')}</span>
                )}
                <motion.div animate={{ rotate: showJobSheet ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={12} className="text-gray-500" />
                </motion.div>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {showJobSheet && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 md:px-4 pb-3 md:pb-4 space-y-3">
                    <ul className="space-y-2">
                      {renderTasks()}
                    </ul>
                    {currentStage?.rejectionReason && (
                      (() => {
                        const isOrderProfile = ['ORDER_ENTRY', 'OUTLET'].includes(String(userRole || '').toUpperCase().trim());
                        const isInventoryReason = currentStage.rejectionReason.includes('Inventory') || currentStage.rejectionReason.includes('Stock');
                        if (isOrderProfile && isInventoryReason) return null;
                        return (
                          <div className={`p-2.5 rounded-xl border ${currentStage.rejectionReason.includes('Available') ? 'bg-emerald-500/10 border-emerald-500/20' : currentStage.rejectionReason.includes('PROBLEM') ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <p className={`text-xs md:text-sm font-black uppercase tracking-widest mb-0.5 ${currentStage.rejectionReason.includes('Available') ? 'text-emerald-400' : currentStage.rejectionReason.includes('PROBLEM') ? 'text-orange-400' : 'text-red-400'}`}>
                              {currentStage.rejectionReason.includes('Inventory') ? 'Store Inventory Check:' : currentStage.rejectionReason.includes('PROBLEM') ? 'Worker Reported Problem:' : (order.source === 'OUTLET' ? 'Branch Rejection Reason:' : 'Faisal Rejection Reason:')}
                            </p>
                            <p className="text-xs md:text-sm text-gray-300 italic leading-tight line-clamp-2">{currentStage.rejectionReason.replace('PROBLEM:', '')}</p>
                          </div>
                        );
                      })()
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFullSheet(true); }}
                      className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 rounded-xl text-xs font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all border border-gray-800"
                    >
                      {t('View Full Job Sheet')} →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsible Production Timeline */}
          {order.stages?.some(s => s.status === 'COMPLETED') && (
            <div className="mb-3 bg-gray-950/30 rounded-2xl border border-gray-800/50 overflow-hidden">
              <button
                onClick={() => setShowProdHistory((prev) => !prev)}
                className="w-full flex items-center justify-between p-3 md:p-4 hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                    <History size={14} className="text-emerald-400" />
                  </div>
                  <span className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-[0.15em]">{t('Production History')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[6px] text-gray-600 font-black">{order.stages.filter(s => s.status === 'COMPLETED').length} stages</span>
                  <motion.div animate={{ rotate: showProdHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight size={12} className="text-gray-500" />
                  </motion.div>
                </div>
              </button>
              <AnimatePresence initial={false}>
                {showProdHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 md:px-4 pb-3 md:pb-4">
                      <div className="space-y-1.5 relative">
                        {order.stages
                          .filter(s => s.status === 'COMPLETED')
                          .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
                          .map((s, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              <div className="flex flex-col items-center pt-0.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                                {idx !== order.stages.filter(s => s.status === 'COMPLETED').length - 1 && (
                                  <div className="w-[1px] h-3.5 bg-gray-800"></div>
                                )}
                              </div>
                              <div className="flex-1 flex flex-wrap justify-between items-center gap-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-tighter">
                                    {s.stageName.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[9px] text-yellow-500/60">→ {order.source === 'OUTLET' ? t('Branch') : t('Faisal')}</span>
                                </div>
                                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                  {new Date(s.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full">
            {isUnseen && !isAdmin ? (
              <button
                onClick={() => withActionLoading('accept', async () => {
                  try {
                    const token = sessionStorage.getItem('token');
                    await axios.post(`${API_URL}/api/orders/${order.id}/accept-task`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (onMarkSeen) await onMarkSeen();
                    toast.success('Task accepted!');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to accept task');
                  }
                })}
                disabled={!!actionLoading}
                className={`w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 md:py-4 rounded-2xl text-xs md:text-xs font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-blue-900/40 border border-blue-400/20 ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {actionLoading === 'accept' ? (
                  <LoadingSpinner size={16} text="Accepting..." />
                ) : (
                  <><CheckCircle size={14} className="text-blue-300" /><span>📥 ACCEPT TASK & START WORK</span></>
                )}
              </button>
            ) : isUnseen && isAdmin && currentStage?.stageName === 'STORE' ? (
              <div className="space-y-2">
                <label className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  Move Order To
                  <span className="px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[9px] tracking-wider">MANUAL</span>
                </label>
                <select
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 px-3 outline-none focus:border-amber-500 transition-all text-white text-xs font-bold appearance-none"
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                >
                  <option value="">Select destination...</option>
                  {currentStage?.stageName !== 'LOGO_DESIGN' && <option value="LOGO_DESIGN">Logo Design</option>}
                  {currentStage?.stageName !== 'WORKERS' && <option value="WORKERS">Workers</option>}
                  {currentStage?.stageName !== 'PRODUCTION_ACCEPTANCE' && <option value="PRODUCTION_ACCEPTANCE">Production Acceptance</option>}
                  {currentStage?.stageName !== 'PRODUCTION' && <option value="PRODUCTION">Production</option>}
                  {currentStage?.stageName !== 'DISPATCH' && <option value="DISPATCH">Dispatch</option>}
                  {currentStage?.stageName !== 'ORDER_ENTRY' && <option value="ORDER_ENTRY">Order Entry</option>}
                  <option disabled className="text-gray-600">──────────</option>
                  <option value="HOLD">Hold / Pending</option>
                  <option value="REJECT">Reject Order</option>
                </select>
                <button
                  onClick={() => withActionLoading('move', async () => {
                    if (!nextStage) return;
                    if (['HOLD', 'REJECT'].includes(nextStage)) {
                      if (nextStage === 'REJECT') {
                        const reason = prompt('Reason for rejection:');
                        if (reason !== null) {
                          onUpdateStage(order.id, currentStage.id, 'reject', { reason: `Rejected by ${userRole}: ${reason}` });
                        }
                      } else {
                        if (window.confirm('Place order on HOLD?')) {
                          onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Hold', remarks: 'Hold by Admin' });
                        }
                      }
                      return;
                    }
                    try {
                      const token = sessionStorage.getItem('token');
                      await axios.post(`${API_URL}/api/orders/${order.id}/route`, {
                        destinationStage: nextStage,
                        remarks: `Routed by ${userRole} via Move To dropdown`
                      }, { headers: { Authorization: `Bearer ${token}` } });
                      toast.success(`Order moved to ${nextStage.replace(/_/g, ' ')}`);
                      if (onMarkSeen) onMarkSeen();
                    } catch (err) {
                      alert('Route failed: ' + (err.response?.data?.message || err.message));
                    }
                  })}
                  disabled={!!actionLoading}
                  className={`w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {actionLoading === 'move' ? (
                    <LoadingSpinner size={14} text="Routing..." />
                  ) : (
                    <><Package size={12} className="inline mr-1.5" />{nextStage ? `MOVE TO ${nextStage.replace(/_/g, ' ')}` : 'SELECT DESTINATION'}</>
                  )}
                </button>
              </div>
            ) : isUnseen && isAdmin ? (
              <button
                onClick={() => withActionLoading('view', async () => { if (onMarkSeen) await onMarkSeen(); })}
                disabled={!!actionLoading}
                className={`w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 border border-gray-600/30 ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {actionLoading === 'view' ? <LoadingSpinner size={14} text="Loading..." /> : <><CheckCircle size={14} /><span>VIEW ORDER</span></>}
              </button>
            ) : isFaisal && order.status === 'ON_HOLD' ? (
              <ActionBtn name="resume" onClick={() => handleHoldAction(true)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-emerald-900/20"
              >
                <RefreshCcw size={14} />
                <span>RESUME ORDER</span>
              </ActionBtn>
            ) : isFaisal && (order.status === 'WAITING_APPROVAL' || order.status === 'PENDING') && currentStage?.status === 'COMPLETED' ? (
              <ActionBtn name="initiate" onClick={() => setShowApprovalDialog(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-blue-900/20"
              >
                <ChevronRight size={14} />
                <span>{t('Initiate Next Phase')}</span>
              </ActionBtn>
            ) : isWaitingApproval ? (
              isFaisal ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 w-full">
                    <ActionBtn name="approve" onClick={() => setShowApprovalDialog(true)}
                      className="btn-ghost-success rounded-xl py-2.5 md:py-3 text-xs md:text-sm flex-col gap-0.5"
                    >
                      <Check size={14} />
                      <span>{t('Approve')}</span>
                    </ActionBtn>
                    {(currentStage?.rejectionReason?.includes('Out of Stock') || currentStage?.rejectionReason?.includes('PROBLEM')) ? (
                      <ActionBtn name="sendAgain" onClick={() => onUpdateStage(order.id, currentStage.id, 'reject', { reason: 'Problem Resolved - Please Proceed' })}
                        className="btn-ghost-warning rounded-xl py-2.5 md:py-3 text-xs md:text-sm flex-col gap-0.5"
                      >
                        <RefreshCcw size={14} />
                        <span>{t('Send Again')}</span>
                      </ActionBtn>
                    ) : (
                      <ActionBtn name="reject" onClick={() => setShowRejectionDialog(true)}
                        className="btn-ghost-danger rounded-xl py-2.5 md:py-3 text-xs md:text-sm flex-col gap-0.5"
                      >
                        <X size={14} />
                        <span>{t('Reject')}</span>
                      </ActionBtn>
                    )}
                    <ActionBtn name="hold" onClick={() => order.status === 'ON_HOLD' ? handleHoldAction(true) : setShowHoldDialog(true)}
                      className={`py-2.5 md:py-3 px-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 border ${
                        order.status === 'ON_HOLD' 
                          ? 'bg-emerald-600/20 text-emerald-500 border-emerald-500/30' 
                          : 'bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white border-orange-500/20'
                      }`}
                    >
                      <Clock size={14} />
                      <span>{order.status === 'ON_HOLD' ? 'RESUME' : t('Hold')}</span>
                    </ActionBtn>
                    {(order.paymentStatus !== 'PAID' && order.paymentStatus !== 'FULL_PAID' || ['SUPER_ADMIN', 'ADMIN'].includes(userRole)) && (
                      <div className="relative">
                        <ActionBtn name="more" onClick={() => setShowMoreActions(!showMoreActions)}
                          className="w-full py-2.5 md:py-3 px-1 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border border-gray-600/30 bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white flex flex-col items-center justify-center gap-0.5 active:scale-95"
                        >
                          <span className="text-base leading-none">⋮</span>
                          <span>MORE</span>
                        </ActionBtn>
                        {showMoreActions && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowMoreActions(false)} />
                            <div className="absolute bottom-full right-0 z-40 mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[170px]">
                              {(order.paymentStatus !== 'PAID' && order.paymentStatus !== 'FULL_PAID') && (
                                <button
                                  onClick={() => { setShowMoreActions(false); setShowPaymentModal(true); setPaymentAmount(''); setPaymentMethod('CASH'); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-black uppercase tracking-wider text-yellow-400 hover:bg-yellow-500/10 transition-all border-b border-gray-800"
                                >
                                  <AlertCircle size={14} />
                                  <span>Record Payment</span>
                                </button>
                              )}
                                <button
                                  onClick={async () => {
                                    setShowMoreActions(false);
                                    const dest = prompt('Route Order To:\n(STORE / WORKERS / LOGO_DESIGN / PRODUCTION_ACCEPTANCE / PRODUCTION / STORE_RECEIVE / DISPATCH / OUT_FOR_DELIVERY / ORDER_ENTRY)');
                                    if (dest) {
                                      let destUpper = dest.trim().toUpperCase().replace(/ /g, '_');
                                      // Auto-correct common shorthand
                                      if (destUpper === 'LOGO') destUpper = 'LOGO_DESIGN';
                                      const valid = ['STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'];
                                      if (valid.includes(destUpper)) {
                                        try {
                                          const token = sessionStorage.getItem('token');
                                          await axios.post(`${API_URL}/api/orders/${order.id}/route`, {
                                            destinationStage: destUpper,
                                            remarks: `Manual route from OrderCard by ${userRole}`
                                          }, { headers: { Authorization: `Bearer ${token}` } });
                                          toast.success(`Order routed to ${destUpper.replace(/_/g, ' ')}`);
                                        } catch (err) {
                                          alert('Route failed: ' + (err.response?.data?.message || err.message));
                                        }
                                      } else {
                                        alert('Invalid destination. Valid: STORE, LOGO_DESIGN, PRODUCTION_ACCEPTANCE, PRODUCTION, STORE_RECEIVE, DISPATCH, OUT_FOR_DELIVERY, ORDER_ENTRY');
                                      }
                                    }
                                  }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-black uppercase tracking-wider text-blue-400 hover:bg-blue-500/10 transition-all border-b border-gray-800"
                              >
                                <Package size={14} />
                                <span>Route Order To...</span>
                              </button>
                              <button
                                onClick={() => { setShowMoreActions(false); setShowTimelineModal(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-black uppercase tracking-wider text-cyan-400 hover:bg-cyan-500/10 transition-all border-b border-gray-800"
                              >
                                <Clock size={14} />
                                <span>Timeline</span>
                              </button>
                              <button
                                onClick={async () => {
                                  setShowMoreActions(false);
                                  try {
                                    const token = sessionStorage.getItem('token');
                                    const res = await axios.get(`${API_URL}/api/orders/${order.id}/routing-history`, {
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    const history = res.data;
                                    const historyStr = history.map((h, i) =>
                                      `${i + 1}. ${h.previousStage} → ${h.newStage} by ${h.sentBy || 'System'} (${new Date(h.createdAt).toLocaleString()})${h.remarks ? ': ' + h.remarks : ''}`
                                    ).join('\n');
                                    alert(historyStr || 'No routing history found for this order.');
                                  } catch (err) {
                                    alert('Error fetching routing history');
                                  }
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-black uppercase tracking-wider text-purple-400 hover:bg-purple-500/10 transition-all border-b border-gray-800"
                              >
                                <History size={14} />
                                <span>Routing History</span>
                              </button>
                              {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                                <button
                                  onClick={() => {
                                    setShowMoreActions(false);
                                    if (window.confirm(`⚠ PERMANENTLY DELETE this order?\n\nOrder #${order.orderNumber || order.id.substring(0, 8)}\nCustomer: ${order.customerName}\n\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                                      axios.delete(`${API_URL}/api/orders/${order.id}`, {
                                        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                                      }).then(() => {
                                        toast.success('Order deleted permanently. Inventory restored.');
                                      }).catch(err => {
                                        alert(err.response?.data?.message || 'Failed to delete order');
                                      });
                                    }
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-black uppercase tracking-wider text-red-400 hover:bg-red-500/10 transition-all"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete Order</span>
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 bg-gray-800 text-gray-500 py-4 rounded-2xl text-xs md:text-sm font-black uppercase text-center border border-gray-700 italic">
                  {t('Waiting for')} {order.source === 'OUTLET' ? t('Branch') : t('Faisal')} {t('Approval')}...
                </div>
              )
            ) : (
              !isFaisal && (
                currentStage?.status === 'COMPLETED' ? (
                  <div className="w-full p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
                    <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-1">Task Already Completed</p>
                    <p className="text-xs text-gray-500 mb-3">This task was completed by another user. You can route it forward if needed.</p>
                    <div className="space-y-2">
                      <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 transition-all text-white text-xs font-bold appearance-none">
                        <option value="">Select destination...</option>
                        {currentStage?.stageName !== 'LOGO_DESIGN' && <option value="LOGO_DESIGN">Logo Design</option>}
                        {currentStage?.stageName !== 'PRODUCTION_ACCEPTANCE' && <option value="PRODUCTION_ACCEPTANCE">Production Acceptance</option>}
                        {currentStage?.stageName !== 'PRODUCTION' && <option value="PRODUCTION">Production</option>}
                        {currentStage?.stageName !== 'STORE_RECEIVE' && <option value="STORE_RECEIVE">Store Receive</option>}
                        {currentStage?.stageName !== 'DISPATCH' && <option value="DISPATCH">Dispatch</option>}
                        {currentStage?.stageName !== 'OUT_FOR_DELIVERY' && <option value="OUT_FOR_DELIVERY">Out for Delivery</option>}
                        {currentStage?.stageName !== 'ORDER_ENTRY' && <option value="ORDER_ENTRY">Order Entry</option>}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          if (!nextStage) { toast.error('Select a destination'); return; }
                          onUpdateStage(order.id, currentStage.id, 'request', { nextStage });
                        }}
                          disabled={!nextStage}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Route Forward
                        </button>
                        <button onClick={() => onUpdateStage(order.id, currentStage.id, 'request', {})}
                          className="px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                        >
                          Re-request
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  currentStage?.stageName === 'STORE' ? (
                  <>
                    {/* Route Order To dropdown for manual routing */}
                    <div className="w-full mb-2 space-y-1.5">
                      <label className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                        Route Order To
                        <span className="px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] tracking-wider">MANUAL</span>
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 transition-all text-white text-xs font-bold appearance-none"
                        value={nextStage}
                        onChange={(e) => setNextStage(e.target.value)}
                      >
                        <option value="">Auto-route (default)</option>
                        <option value="PRODUCTION">Send to Production</option>
                        <option value="LOGO_DESIGN">Send to Logo Design</option>
                        <option value="WORKERS">Send to Workers</option>
                        <option value="DISPATCH">Send to Dispatch</option>
                        <option disabled className="text-gray-600">─ Return to Source ─</option>
                        {(!order.source || order.source === 'ONLINE') && <option value="RETURN_ONLINE">Send back to Online</option>}
                        {(!order.source || order.source === 'OUTLET') && <option value="RETURN_OUTLET">Send back to Outlet</option>}
                        <option disabled className="border-t border-gray-800">──────────</option>
                        <option value="HOLD">Hold / Pending</option>
                        <option value="NOT_AVAILABLE">Mark as Not Available</option>
                        <option value="REJECT">Reject Order</option>
                      </select>
                    </div>
                    {/* Inventory Availability Report */}
                    {invCheckLoading ? (
                      <div className="w-full p-4 bg-gray-900/30 rounded-2xl border border-gray-800 flex items-center justify-center space-x-3">
                        <RefreshCcw className="animate-spin text-blue-400" size={16} />
                        <span className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest">Checking inventory...</span>
                      </div>
                    ) : invCheck && invCheck.report ? (
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Inventory Availability</span>
                          <button onClick={() => setInvCheckExpanded(!invCheckExpanded)} className="text-xs md:text-sm font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                            {invCheckExpanded ? 'Collapse' : 'Details'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-black uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            {invCheck.summary.available} Available
                          </span>
                          {invCheck.summary.insufficient > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-black uppercase border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                              {invCheck.summary.insufficient} Low Stock
                            </span>
                          )}
                          {invCheck.summary.outOfStock > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-black uppercase border border-red-500/20 bg-red-500/10 text-red-400">
                              {invCheck.summary.outOfStock} Unavailable
                            </span>
                          )}
                        </div>
                        {invCheckExpanded && (
                          <div className="overflow-x-auto bg-gray-950/50 rounded-xl border border-gray-800">
                            <table className="w-full text-xs md:text-sm">
                              <thead>
                                <tr className="border-b border-gray-800 text-xs font-black text-gray-500 uppercase tracking-widest">
                                  <th className="text-left p-2">Item</th>
                                  <th className="text-center p-2">Required</th>
                                  <th className="text-center p-2">Available</th>
                                  <th className="text-right p-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {invCheck.report.map((item, idx) => (
                                  <tr key={idx} className="border-b border-gray-800/50">
                                    <td className="p-2 text-left font-bold text-white">{item.itemName}</td>
                                    <td className="p-2 text-center text-gray-300">{item.requiredQty}</td>
                                    <td className="p-2 text-center font-black">{item.availableQty}</td>
                                    <td className="p-2 text-right">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase ${
                                        item.status === 'available' ? 'bg-emerald-500/10 text-emerald-400' :
                                        item.status === 'insufficient' ? 'bg-yellow-500/10 text-yellow-400' :
                                        'bg-red-500/10 text-red-400'
                                      }`}>
                                        {item.status === 'available' ? 'Available' :
                                         item.status === 'insufficient' ? 'Low' : 'Out'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button onClick={handleInventoryCheck} className="w-full py-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs md:text-sm font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all">
                        <Package size={14} className="inline mr-1.5" />Check Inventory
                      </button>
                    )}
                    {invCheck && invCheck.report && (
                      <div className="w-full mb-3 p-3 bg-gray-900/40 rounded-xl border border-gray-800">
                        <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Routing Plan</p>
                        <div className="space-y-1.5">
                          {invCheck.report.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs md:text-sm">
                              <span className="text-white font-bold">{item.itemName} x{item.requiredQty}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase ${
                                item.classification === 'inventory'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {item.classification === 'inventory' ? 'From Inventory' : 'Send to Production'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (nextStage === 'NOT_AVAILABLE') {
                            if (window.confirm('Mark items as NOT AVAILABLE?')) {
                              onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Out of Stock' });
                            }
                          } else if (nextStage === 'REJECT') {
                            const reason = prompt('Reason for rejection:');
                            if (reason !== null) {
                              onUpdateStage(order.id, currentStage.id, 'reject', { reason: `Rejected by Store: ${reason}` });
                            }
                          } else if (nextStage === 'RETURN_ONLINE') {
                            if (window.confirm('Send back to Online?')) {
                              onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Available', nextStage: 'ORDER_ENTRY', remarks: 'Returned to Online by Store' });
                            }
                          } else if (nextStage === 'RETURN_OUTLET') {
                            if (window.confirm('Send back to Outlet?')) {
                              onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Available', nextStage: 'ORDER_ENTRY', remarks: 'Returned to Outlet by Store' });
                            }
                          } else if (nextStage === 'HOLD') {
                            if (window.confirm('Place order on HOLD / Pending?')) {
                              onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Hold', nextStage: 'ORDER_ENTRY', remarks: 'Hold / Pending by Store' });
                            }
                          } else {
                            const msg = nextStage ? `Route to ${nextStage.replace(/_/g, ' ')}?` : 'Confirm classification and route items?';
                            if (window.confirm(msg)) {
                              const itemsArray = isMultiItem && orderItems?.length > 1 ? orderItems : [product];
                              const availPayload = {};
                              itemsArray.forEach((_, idx) => {
                                if (productAvailability[idx] === true) availPayload[idx] = true;
                                if (productAvailability[idx] === false) availPayload[idx] = false;
                              });
                              onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Available', nextStage: nextStage || undefined, productAvailability: availPayload });
                            }
                          }
                        }}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                      >
                        <CheckCircle size={14} />
                        <span>{nextStage === 'NOT_AVAILABLE' ? 'Mark as Not Available' : nextStage === 'REJECT' ? 'Reject Order' : nextStage === 'RETURN_ONLINE' ? 'Send back to Online' : nextStage === 'RETURN_OUTLET' ? 'Send back to Outlet' : nextStage === 'HOLD' ? 'Place on Hold' : nextStage ? `Route to ${nextStage.replace(/_/g, ' ')}` : 'Process & Route'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are items MISSING or OUT OF STOCK?')) {
                            onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Out of Stock' });
                          }
                        }}
                        className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                      >
                        <AlertCircle size={14} />
                        <span>Missing / Unavailable</span>
                      </button>
                    </div>
                  </>
                ) : ['LOGO_DESIGN', 'NAME_LOGO', 'CUSTOM_LOGO'].includes(currentStage?.stageName) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Design complete! Send to Production?')) {
                          onUpdateStage(order.id, currentStage.id, 'request', { nextStage: 'PRODUCTION' });
                        }
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>Send to Production</span>
                      <span className="text-[6px] md:text-[9px] text-emerald-200 tracking-widest">→ PRODUCTION</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Design Problem</span>
                      <span className="text-[6px] md:text-[9px] text-red-200 tracking-widest">→ NOTIFY {order.source === 'OUTLET' ? 'BRANCH' : 'FAISAL'}</span>
                    </button>
                  </div>
                ) : currentStage?.stageName === 'PRODUCTION_ACCEPTANCE' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const token = sessionStorage.getItem('token');
                          await axios.post(`${API_URL}/api/orders/${order.id}/route`, {
                            destinationStage: 'PRODUCTION',
                            remarks: 'Accepted by Production'
                          }, { headers: { Authorization: `Bearer ${token}` } });
                          toast.success('Order accepted for production');
                          if (onMarkSeen) onMarkSeen();
                        } catch (err) {
                          toast.error('Failed to accept: ' + (err.response?.data?.message || err.message));
                        }
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={16} />
                      <span>Accept</span>
                      <span className="text-[6px] md:text-[9px] text-emerald-200 tracking-widest">→ PRODUCTION</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Report Problem</span>
                      <span className="text-[6px] md:text-[9px] text-red-200 tracking-widest">→ NOTIFY {order.source === 'OUTLET' ? 'BRANCH' : 'FAISAL'}</span>
                    </button>
                  </div>
                ) : currentStage?.stageName === 'PRODUCTION' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Production complete? Items will return to Store.')) {
                          onUpdateStage(order.id, currentStage.id, 'request', { nextStage: 'STORE_RECEIVE' });
                        }
                      }}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>Production Complete</span>
                      <span className="text-[6px] md:text-[9px] text-emerald-200 tracking-widest">→ Coming From Production</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Report Problem</span>
                      <span className="text-[6px] md:text-[9px] text-red-200 tracking-widest">→ NOTIFY {order.source === 'OUTLET' ? 'BRANCH' : 'FAISAL'}</span>
                    </button>
                  </div>
                ) : currentStage?.stageName === 'STORE_RECEIVE' ? (
                  <>
                    <div className="w-full mb-3 p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl border border-blue-500/40 shadow-lg shadow-blue-900/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-xl">
                          <RotateCcw size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Returned From Production</p>
                          {(() => {
                            const prodStage = order.stages?.find(s => s.stageName === 'PRODUCTION' && s.status === 'COMPLETED');
                            if (prodStage?.completedAt) {
                              return <p className="text-xs text-gray-500 font-medium mt-0.5">Completed {new Date(prodStage.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>;
                            }
                            return null;
                          })()}
                        </div>
                        <div className="px-2.5 py-1 bg-emerald-500/15 rounded-lg border border-emerald-500/30">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Completed</span>
                        </div>
                      </div>
                    </div>
                    {/* Produced Items List */}
                    {isMultiItem && orderItems?.length > 1 && (
                      <div className="w-full mb-3 space-y-1.5">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Items from Production</p>
                        {orderItems.filter(item => item.availabilityStatus === 'not_available' || item.availabilityStatus === 'produced').map((item, idx) => {
                          const p = item.productDetails || {};
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 bg-blue-900/10 rounded-lg border border-blue-500/20">
                              <span className="text-xs font-bold text-blue-300 uppercase">{p.productType || 'Item'}: {p.fabricType || '—'} / {p.color || '—'}</span>
                              <span className="text-xs font-black text-blue-400">x{item.quantity || 1}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(() => {
                      const inventoryAdded = localInventoryAdded || order.auditLogs?.some(l => l.action === 'INVENTORY_ADDED');
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          {!inventoryAdded ? (
                            <button
                              onClick={async () => {
                                try {
                                  const token = sessionStorage.getItem('token');
                                  await axios.post(`${API_URL}/api/orders/${order.id}/add-to-inventory`, {}, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  setLocalInventoryAdded(true);
                                  toast.success('Inventory updated!');
                                } catch (err) {
                                  alert('Failed: ' + (err.response?.data?.message || err.message));
                                }
                              }}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-blue-900/20"
                            >
                              <Package size={14} />
                              <span>Add to Inventory</span>
                              <span className="text-[6px] md:text-[9px] text-blue-200 tracking-widest">→ UPDATE STOCK</span>
                            </button>
                          ) : (
                            <div className="col-span-2 space-y-2">
                              <div className="flex flex-wrap gap-1">
                                {['LOGO_DESIGN','PRODUCTION_ACCEPTANCE','PRODUCTION','WORKERS','DISPATCH','OUT_FOR_DELIVERY','ORDER_ENTRY'].map(dest => (
                                  <button key={dest} onClick={() => setStoreRouteDest(dest)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all ${
                                      storeRouteDest === dest
                                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                                    }`}>
                                    {dest.replace(/_/g, ' ')}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const token = sessionStorage.getItem('token');
                                    await axios.post(`${API_URL}/api/orders/${order.id}/route`, { destinationStage: storeRouteDest, remarks: 'Inventory added, routing from Store' }, { headers: { Authorization: `Bearer ${token}` } });
                                    toast.success(`Sent to ${storeRouteDest.replace(/_/g, ' ')}`);
                                  } catch (err) {
                                    alert('Failed: ' + (err.response?.data?.message || err.message));
                                  }
                                }}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-emerald-900/20"
                              >
                                <Truck size={14} />
                                <span>Route to {storeRouteDest.replace(/_/g, ' ')}</span>
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => setShowProblemModal(true)}
                            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                          >
                            <AlertCircle size={14} />
                            <span>Report Problem</span>
                            <span className="text-[6px] md:text-[9px] text-red-200 tracking-widest">→ NOTIFY {order.source === 'OUTLET' ? 'BRANCH' : 'FAISAL'}</span>
                          </button>
                        </div>
                      );
                    })()}
                  </>
                ) : currentStage?.stageName === 'DISPATCH' ? (
                  <>
                    {!order.deliveryType ? (
                      <div className="w-full space-y-2">
                        <label className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Truck size={12} />
                          Delivery Method
                          <span className="px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[9px] tracking-wider">SELECT</span>
                        </label>
                        <select
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-purple-500 transition-all text-white text-xs font-bold appearance-none"
                          value={nextStage}
                          onChange={(e) => setNextStage(e.target.value)}
                        >
                          <option value="">Select delivery method...</option>
                          <option value="IMMENT">Through Enamels Delivery (Internal)</option>
                          <option value="TCS">TCS</option>
                          <option value="POST_EX">PostEx</option>
                          <option value="WALK_IN">Working Received by Customer / Received by Customer</option>
                        </select>
                        <input
                          type="text"
                          value={trackingUrl}
                          onChange={(e) => setTrackingUrl(e.target.value)}
                          placeholder="Tracking URL / Number (optional)"
                          className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-purple-500 transition-all text-white text-xs font-bold"
                        />
                        <button
                          onClick={async () => {
                            if (!nextStage) return alert('Please select delivery method');
                            try {
                              const token = sessionStorage.getItem('token');
                              await axios.post(`${API_URL}/api/orders/${order.id}/dispatch`, {
                                deliveryMethod: nextStage,
                                trackingUrl: trackingUrl || undefined
                              }, { headers: { Authorization: `Bearer ${token}` } });
                              toast.success(`Dispatched via ${nextStage}`);
                              setNextStage('');
                              setTrackingUrl('');
                            } catch (err) {
                              alert('Failed: ' + (err.response?.data?.message || err.message));
                            }
                          }}
                          className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20"
                        >
                          <ChevronRight size={12} />
                          <span>Confirm Dispatch</span>
                        </button>
                      </div>
                    ) : order.deliveryType === 'ENAMELS' ? (
                      <div className="w-full p-3 bg-emerald-600/10 rounded-xl border border-emerald-500/20 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <CheckCircle size={14} className="text-emerald-400" />
                          <span className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-widest">Routed to Enamels Delivery</span>
                        </div>
                        <span className="text-xs text-emerald-600/70">→ Out for Delivery</span>
                      </div>
                    ) : ['TCS', 'POST_EX'].includes(order.deliveryType) ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between p-2.5 bg-gray-900/40 rounded-xl border border-gray-800">
                          <div>
                            <span className="text-xs font-black text-purple-400 uppercase tracking-widest">{order.deliveryType}</span>
                            {order.trackingNumber && (
                              <p className="text-xs text-gray-500 mt-0.5">Tracking: {order.trackingNumber}</p>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase ${
                            order.dispatchStatus === 'DELIVERED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : order.dispatchStatus === 'RETURNED'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                          }`}>
                            {order.dispatchStatus || 'PENDING'}
                          </span>
                        </div>
                        {order.dispatchStatus === 'PENDING' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={async () => {
                                if (!window.confirm('Mark as DELIVERED?')) return;
                                try {
                                  const token = sessionStorage.getItem('token');
                                  await axios.put(`${API_URL}/api/orders/${order.id}/dispatch-status`, { dispatchStatus: 'DELIVERED' }, { headers: { Authorization: `Bearer ${token}` } });
                                  toast.success('Marked as Delivered');
                                } catch (err) {
                                  alert('Failed: ' + (err.response?.data?.message || err.message));
                                }
                              }}
                              className="py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-1"
                            >
                              <CheckCircle size={12} />
                              Mark Delivered
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm('Mark as RETURNED?')) return;
                                try {
                                  const token = sessionStorage.getItem('token');
                                  await axios.put(`${API_URL}/api/orders/${order.id}/dispatch-status`, { dispatchStatus: 'RETURNED' }, { headers: { Authorization: `Bearer ${token}` } });
                                  toast.success('Marked as Returned');
                                } catch (err) {
                                  alert('Failed: ' + (err.response?.data?.message || err.message));
                                }
                              }}
                              className="py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 flex items-center justify-center gap-1"
                            >
                              <X size={12} />
                              Mark Returned
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={12} />
                      <span>Report Problem</span>
                    </button>
                  </>
                ) : ['ORDER_ENTRY', 'OUTLET'].includes(currentStage?.stageName) ? (
                  <>
                    <div className="w-full space-y-2">
                      <label className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Truck size={12} />
                        Dispatch Method
                        <span className="px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] tracking-wider">SELECT</span>
                      </label>
                      <select
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2.5 px-3 outline-none focus:border-blue-500 transition-all text-white text-xs font-bold appearance-none"
                        value={nextStage}
                        onChange={(e) => setNextStage(e.target.value)}
                      >
                        <option value="">Select dispatch method...</option>
                        <option value="DISPATCH">Normal Delivery</option>
                        <option value="DISPATCH_TCS">TCS</option>
                        <option value="DISPATCH_RIDER">Rider / Delivery Boy</option>
                        <option value="DISPATCH_COURIER">Courier Service</option>
                        <option disabled className="border-t border-gray-800">──────────</option>
                        <option value="HOLD">Hold Order</option>
                        <option value="PRODUCTION">Return to Production</option>
                      </select>  
                      <button
                        onClick={() => {
                          const dispatchMethod = {
                            'DISPATCH': 'Normal Delivery',
                            'DISPATCH_TCS': 'TCS',
                            'DISPATCH_RIDER': 'Rider / Delivery Boy',
                            'DISPATCH_COURIER': 'Courier Service',
                            'HOLD': 'Hold',
                            'PRODUCTION': 'Return to Production'
                          }[nextStage] || '';
                          const confirmMsg = dispatchMethod === 'Hold'
                            ? 'Place order on HOLD?'
                            : dispatchMethod === 'Return to Production'
                              ? 'Return order back to production?'
                              : `Send for dispatch via ${dispatchMethod}?`;
                          if (!nextStage) return alert('Please select dispatch method');
                          if (window.confirm(confirmMsg)) {
                            const next = nextStage.startsWith('DISPATCH_') ? 'DISPATCH' : nextStage;
                            const remarks = nextStage.startsWith('DISPATCH_')
                              ? `Dispatched via ${dispatchMethod}`
                              : dispatchMethod === 'Hold'
                                ? 'Hold / Pending by Store'
                                : 'Returned to Production by Store';
                            onUpdateStage(order.id, currentStage.id, 'request', { nextStage: next, remarks, dispatchMethod: dispatchMethod === 'Normal Delivery' ? undefined : dispatchMethod });
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 ${
                          nextStage && !nextStage.startsWith('HOLD') && nextStage !== 'PRODUCTION'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/20'
                            : nextStage === 'HOLD'
                              ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white shadow-lg shadow-yellow-900/20'
                              : nextStage === 'PRODUCTION'
                                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-900/20'
                                : 'bg-gray-800 text-gray-500'
                        }`}
                      >
                        <ChevronRight size={12} />
                        <span>{nextStage === 'HOLD' ? 'Place on Hold' : nextStage === 'PRODUCTION' ? 'Return to Production' : 'Confirm & Dispatch'}</span>
                      </button>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const token = sessionStorage.getItem('token');
                          const res = await axios.get(`${API_URL}/api/orders/${order.id}/routing-history`, {
                            headers: { Authorization: `Bearer ${token}` }
                          });
                          const history = res.data;
                          const prodFiltered = history.filter(h =>
                            h.previousStage === 'PRODUCTION' || h.newStage === 'PRODUCTION' ||
                            h.previousStage === 'STORE_RECEIVE' || h.newStage === 'STORE_RECEIVE'
                          );
                          const display = (prodFiltered.length > 0 ? prodFiltered : history);
                          const historyStr = display.map((h, i) =>
                            `${i + 1}. ${h.previousStage} → ${h.newStage} by ${h.sentBy || 'System'} (${new Date(h.createdAt).toLocaleString()})${h.remarks ? ': ' + h.remarks : ''}`
                          ).join('\n');
                          alert(historyStr || 'No production history found for this order.');
                        } catch (err) {
                          alert('Error fetching production history');
                        }
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600/10 hover:bg-purple-600/20 rounded-xl border border-purple-500/20 text-xs font-black uppercase tracking-wider text-purple-400 transition-all"
                    >
                      <History size={12} />
                      View Production History
                    </button>
                  </>
                ) : (
                  <div className="w-full">
                    {currentStage?.stageName === 'OUT_FOR_DELIVERY' ? (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              if (window.confirm('Confirm delivery complete? This will mark order as COMPLETED.')) {
                                axios.put(`${API_URL}/api/orders/${order.id}/delivery`, {
                                  deliveryStatus: 'DELIVERED',
                                  remarks: 'Delivered successfully'
                                }, {
                                  headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                                }).then(() => { toast.success('Marked as DELIVERED'); }).catch(err => { alert('Failed: ' + (err.response?.data?.message || err.message)); });
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
                          >
                            <CheckCircle size={12} className="mx-auto mb-0.5" />
                            DELIVERED
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for failure?');
                              if (reason !== null) {
                                axios.put(`${API_URL}/api/orders/${order.id}/delivery`, {
                                  deliveryStatus: 'FAILED',
                                  remarks: reason || 'Delivery failed'
                                }, {
                                  headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                                }).then(() => { toast.success('Marked as FAILED'); }).catch(err => { alert('Failed: ' + (err.response?.data?.message || err.message)); });
                              }
                            }}
                            className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border border-red-500/20 active:scale-95"
                          >
                            <AlertTriangle size={12} className="mx-auto mb-0.5" />
                            FAILED
                          </button>
                          <button
                            onClick={() => {
                              const date = prompt('Reschedule to date? (YYYY-MM-DD) or leave blank for tomorrow');
                              axios.put(`${API_URL}/api/orders/${order.id}/delivery`, {
                                deliveryStatus: 'RESCHEDULED',
                                remarks: date ? `Rescheduled to ${date}` : 'Rescheduled to next day'
                              }, {
                                headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                              }).then(() => { toast.success('Delivery rescheduled'); }).catch(err => { alert('Failed: ' + (err.response?.data?.message || err.message)); });
                            }}
                            className="bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border border-amber-500/20 active:scale-95"
                          >
                            <Clock size={12} className="mx-auto mb-0.5" />
                            RESCHEDULE
                          </button>
                        </div>
                        <button
                          onClick={async () => {
                            if (window.confirm('Request refund for this order?')) {
                              try {
                                const token = sessionStorage.getItem('token');
                                const reason = prompt('Reason for refund:') || 'Not specified';
                                await axios.post(`${API_URL}/api/orders/${order.id}/refund`, { reason }, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                toast.success('Refund requested — moved to Refund Management');
                              } catch (err) {
                                alert('Refund failed: ' + (err.response?.data?.message || err.message));
                              }
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-600/10 hover:bg-orange-600/20 rounded-xl border border-orange-500/20 text-xs font-black uppercase tracking-wider text-orange-400 transition-all"
                        >
                          <AlertCircle size={12} />
                          Refund Order
                        </button>
                        <button
                          onClick={() => setShowProblemModal(true)}
                          className="bg-red-600/5 hover:bg-red-600/20 text-red-500/50 hover:text-red-400 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all border border-red-500/10"
                        >
                          REPORT PROBLEM
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Confirm this stage is fully complete?')) {
                          onUpdateStage(order.id, currentStage.id, 'request');
                        }
                      }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>{t('COMPLETE TASK')}</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-black uppercase transition-all flex items-center justify-center space-x-2 border border-red-500/20 active:scale-95"
                    >
                      <AlertCircle size={14} />
                      <span>PROBLEM</span>
                    </button>
                    </div>
                    )}
                  </div>
                )
              )
            )
          )}
          </div>

          <AnimatePresence>
            {showProblemModal && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm"
                  onClick={() => setShowProblemModal(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-gray-900 border border-red-500/30 rounded-xl md:rounded-[2.5rem] p-4 md:p-8 shadow-2xl"
                >
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-red-500/20 rounded-2xl text-red-500">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Report Problem</h3>
                      <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-widest">Sent directly to {order.source === 'OUTLET' ? 'Branch' : 'Faisal'} Control Center</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest ml-1">Describe what's wrong</label>
                    <textarea 
                      autoFocus
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-red-500/50 transition-all min-h-[120px] resize-none"
                      placeholder="e.g. Fabric is torn, Measurement mismatch, Thread color unavailable..."
                      value={problemNote}
                      onChange={(e) => setProblemNote(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setShowProblemModal(false)}
                      className="flex-1 py-4 rounded-2xl text-xs font-black uppercase text-gray-500 hover:bg-gray-800 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      disabled={!problemNote.trim()}
                      onClick={() => {
                        onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: `PROBLEM: ${problemNote}` });
                        setShowProblemModal(false);
                        setProblemNote('');
                      }}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white py-4 rounded-2xl text-xs font-black uppercase shadow-xl shadow-red-900/20 transition-all"
                    >
                      {t('Send to')} {order.source === 'OUTLET' ? t('Branch') : t('Faisal')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
        <div className="px-3 md:px-4 pb-3 md:pb-4">
          <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
            {currentStage?.status === 'WAITING_APPROVAL' ? 'Authorization Pending' : currentStage?.stageName?.replace(/_/g, ' ') || 'Processing'}
          </span>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {showFullSheet && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl"
            onClick={() => setShowFullSheet(false)}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 md:p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
              <div>
                <div className="flex items-center space-x-4 mb-2">
                  <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-white">#{order.orderNumber || order.id.substring(0, 8)}</h2>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs md:text-sm font-black uppercase tracking-widest rounded-lg">
                    {t('Full Production Job Sheet')}
                  </span>
                </div>
                <p className="text-gray-400 font-bold tracking-wide">
                  {order.customerName}
                  {order.city && (
                    <span className="ml-3 text-amber-400 font-black text-sm md:text-base bg-amber-500/10 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      📍 {order.city}
                    </span>
                  )}
                  {order.shopifyOrderDate && (
                    <span className="text-purple-400 ml-3 font-black text-xs md:text-sm">
                      Shopify: {new Date(order.shopifyOrderDate).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <button 
                onClick={() => setShowFullSheet(false)}
                className="p-4 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-10 custom-scrollbar">
              <section>
                <h4 className="text-xs md:text-sm font-black text-blue-500 uppercase tracking-[0.3em] mb-6">{t('01. Material & Product Specs')}</h4>
                  {isMultiItem ? (
                    <div className="overflow-x-auto rounded-2xl border border-gray-800">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-800 bg-gray-950/80">
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">#</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">{t('Product')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">{t('Fabric & Color')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">{t('Size & Gender')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest text-center">{t('Qty')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest text-center">{t('Stock')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest text-right">{t('Price')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const sorted = orderItems.map((item, idx) => ({ item, idx, isRejected: productAvailability[idx] === false, isCompleted: productAvailability[idx] === true }));
                            const hasRejected = sorted.some(s => s.isRejected);
                            const hasCompleted = sorted.some(s => s.isCompleted);
                            const hasPending = sorted.some(s => !s.isRejected && !s.isCompleted);
                            sorted.sort((a, b) => {
                              const ag = a.isCompleted ? 2 : a.isRejected ? 0 : 1;
                              const bg = b.isCompleted ? 2 : b.isRejected ? 0 : 1;
                              return bg - ag;
                            });
                            let headerShown = { rejected: false, completed: false, pending: false };
                            return sorted.flatMap(({ item, idx, isRejected, isCompleted }) => {
                              const p = item.productDetails || item;
                              const itemCust = item.customization ? parseJSON(item.customization) : null;
                              const hasSleeves = p.sleeveLength || (p.femaleOptions?.sleeves && p.femaleOptions.sleeves !== 'full');
                              const hasShirtLength = p.shirtLength || (p.femaleOptions?.shirtLength && p.femaleOptions.shirtLength !== 'long');
                              const hasArticleNames = itemCust?.articleNames && itemCust.articleNames.length > 0;
                              const hasLogos = itemCust?.logos && itemCust.logos.length > 0;
                              const hasCust = hasArticleNames || hasLogos || itemCust?.nameSpelling || itemCust?.stitchingStyle || itemCust?.fitType;
                              const isProdStage = currentStage?.stageName === 'PRODUCTION';
                              const isStoreRecv = currentStage?.stageName === 'STORE_RECEIVE';
                              const rows = [];
                              if (isRejected && !headerShown.rejected) {
                                headerShown.rejected = true;
                                rows.push(
                                  <tr key="hdr-rejected" className="bg-red-900/10 border-b border-red-500/20">
                                    <td colSpan={7} className="py-2 px-4">
                                      <span className="text-xs font-black text-red-400 uppercase tracking-widest">✗ {t('Rejected / Unavailable')}</span>
                                    </td>
                                  </tr>
                                );
                              }
                              if (isCompleted && !headerShown.completed) {
                                headerShown.completed = true;
                                rows.push(
                                  <tr key="hdr-completed" className="bg-emerald-900/10 border-b border-emerald-500/20">
                                    <td colSpan={7} className="py-2 px-4">
                                      <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">✓ {t('Completed')}</span>
                                    </td>
                                  </tr>
                                );
                              }
                              if (!isRejected && !isCompleted && !headerShown.pending && (hasRejected || hasCompleted)) {
                                headerShown.pending = true;
                                rows.push(
                                  <tr key="hdr-pending" className="bg-gray-800/30 border-b border-gray-700/20">
                                    <td colSpan={7} className="py-2 px-4">
                                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">⏳ {t('Pending')}</span>
                                    </td>
                                  </tr>
                                );
                              }
                              rows.push(
                                <React.Fragment key={idx}>
                                <tr className={`border-b border-gray-800/50 transition-colors ${isRejected ? 'bg-red-900/5 hover:bg-red-900/15 border-l-2 border-l-red-500/40' : isCompleted ? 'bg-emerald-900/5 hover:bg-emerald-900/15 border-l-2 border-l-emerald-500/40' : 'hover:bg-gray-900/30'}`}>
                                  <td className="py-4 px-4 text-gray-500 font-black">{idx + 1}</td>
                                  <td className="py-4 px-4 font-bold uppercase">{isRejected ? <span className="text-orange-300">{p.productType || '—'}</span> : isCompleted ? <span className="text-emerald-300">{p.productType || '—'}</span> : <span className="text-white">{p.productType || '—'}</span>}</td>
                                  <td className="py-4 px-4">
                                    <div className={`uppercase ${isRejected ? 'text-orange-200' : isCompleted ? 'text-emerald-200' : 'text-gray-300'}`}>
                                      {[p.fabricType, p.color].filter(Boolean).join(' • ') || '—'}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4 uppercase">
                                    <div className={isRejected ? 'text-orange-200' : isCompleted ? 'text-emerald-200' : 'text-gray-300'}>
                                      {p.size || 'Custom'} • {p.gender || 'MALE'}
                                    </div>
                                    {(hasSleeves || hasShirtLength) && (
                                      <div className={`text-xs md:text-sm font-black mt-0.5 ${isRejected ? 'text-orange-300' : isCompleted ? 'text-emerald-300' : 'text-pink-400'}`}>
                                        {hasSleeves && `${t('Sleeves')}: ${p.sleeveLength ? ({'full':'Full Sleeve','half':'Half Sleeve','three-quarter':'3 Quarter Sleeve'}[p.sleeveLength] || p.sleeveLength) : ({'full':'Full Sleeve','half':'Half Sleeve','medium':'Medium Sleeve'}[p.femaleOptions?.sleeves] || p.femaleOptions?.sleeves || '')}`} {hasShirtLength && `| ${t('Length')}: ${p.shirtLength ? ({'long':'Full Length','short':'Short Length','regular':'Regular Length'}[p.shirtLength] || p.shirtLength) : ({'long':'Full Length','short':'Short Length'}[p.femaleOptions?.shirtLength] || p.femaleOptions?.shirtLength || '')}`}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-center text-white font-black">{item.quantity || 1}</td>
                                  <td className="py-4 px-4 text-center">
                                    {['STORE', 'STORE_EMPLOYEE'].includes(userRole) && !isProdStage && !isStoreRecv ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          disabled={isCompleted}
                                          onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, true); }}
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : isRejected ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isCompleted}
                                          onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, false); }}
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${isRejected ? 'bg-red-500/20 text-red-400 border border-red-500/30' : isCompleted ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                                        >
                                          ✗
                                        </button>
                                      </div>
                                    ) : isRejected ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-xs font-black text-red-400">
                                        ✗ {t('Rejected')}
                                      </span>
                                    ) : isCompleted ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-black text-emerald-400">
                                        ✓ {t('Completed')}
                                      </span>
                                    ) : item.availabilityStatus === 'produced' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded text-xs font-black text-blue-400">
                                        ✓ {t('Produced')}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700/30 border border-gray-600/30 rounded text-xs font-black text-gray-400">
                                        ⏳ {t('Pending')}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-4 px-4 text-right pr-4 font-black ${showPrice ? 'text-emerald-400' : 'text-gray-500'}`}>{priceDisplay(item.totalPrice)}</td>
                                </tr>
                                {hasCust && (
                                  <tr className={`${isRejected ? 'bg-red-900/5' : 'bg-purple-900/5'} border-b border-gray-800/50`}>
                                    <td colSpan={7} className="py-3 px-6">
                                      <div className="flex flex-wrap gap-3">
                                        {hasArticleNames && itemCust.articleNames.map((an, ai) => (
                                          <span key={ai} className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                                            Name: {an}
                                          </span>
                                        ))}
                                        {!hasArticleNames && itemCust?.nameSpelling && (
                                          <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
                                            {t('Name:')} {itemCust.nameSpelling}
                                          </span>
                                        )}
                                        {hasLogos && itemCust.logos.map((logo, li) => (
                                          <span key={li} className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md">
                                            {t('Logo:')} {logo.name || `#${li + 1}`}{logo.design ? ` — ${logo.design.substring(0, 40)}${logo.design.length > 40 ? '...' : ''}` : ''}
                                          </span>
                                        ))}
                                        {(p.fabricSourceProduct || p.colorSourceProduct || p.designSourceProduct || p.sizeSourceProduct || p.additionalProductRef) && (
                                          <>
                                            {p.fabricSourceProduct && <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-500/20">{t('Fabric:')} {p.fabricSourceProduct}</span>}
                                            {p.colorSourceProduct && <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-500/20">{t('Color:')} {p.colorSourceProduct}</span>}
                                            {p.designSourceProduct && <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-500/20">{t('Design:')} {p.designSourceProduct}</span>}
                                            {p.sizeSourceProduct && <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-500/20">{t('Size:')} {p.sizeSourceProduct}</span>}
                                            {p.additionalProductRef && <span className="text-[10px] font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded-md border border-amber-500/20">{t('Extra:')} {p.additionalProductRef}</span>}
                                          </>
                                        )}
                                        {itemCust?.stitchingStyle && (
                                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
                                            {itemCust.stitchingStyle === 'DBL' ? t('Double Stitch') : t('Single Stitch')}
                                          </span>
                                        )}
                                        {itemCust?.fitType && (
                                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">
                                            {itemCust.fitType}{t(' Fit')}
                                          </span>
                                        )}
                                        {itemCust?.designNotes && (
                                          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-md italic truncate max-w-[200px]">
                                            📝 {itemCust.designNotes}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                              );
                              return rows;
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-gray-800">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-800 bg-gray-950/80">
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest w-1/3">{t('Property')}</th>
                            <th className="py-3 px-4 text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">{t('Value')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: t('Product'), val: product?.productType },
                            { label: t('Fabric'), val: product?.fabricType },
                            { label: t('Color'), val: product?.color },
                            { label: t('Size'), val: product?.size },
                            { label: t('Gender'), val: product?.gender },
                            ...(product?.femaleOptions?.dupatta ? [{ label: 'Dupatta', val: 'Included' }] : []),
                            ...(product?.sleeveLength ? [{ label: t('Sleeves'), val: product.sleeveLength === 'full' ? 'Full Sleeve' : product.sleeveLength === 'half' ? 'Half Sleeve' : product.sleeveLength === 'three-quarter' ? '3 Quarter Sleeve' : 'Quarter Sleeve' }] : []),
                            ...(product?.shirtLength ? [{ label: t('Length'), val: product.shirtLength === 'long' ? 'Full Length' : product.shirtLength === 'regular' ? 'Regular Length' : 'Short Length' }] : []),
                            ...(product?.fabricSourceProduct ? [{ label: 'Fabric Required', val: product.fabricSourceProduct }] : []),
                            ...(product?.colorSourceProduct ? [{ label: 'Color Required', val: product.colorSourceProduct }] : []),
                            ...(product?.designSourceProduct ? [{ label: 'Design Required', val: product.designSourceProduct }] : []),
                            ...(product?.sizeSourceProduct ? [{ label: 'Size Required', val: product.sizeSourceProduct }] : []),
                            ...(product?.additionalProductRef ? [{ label: 'Additional Ref', val: product.additionalProductRef }] : []),
                            ...(['SUPER_ADMIN', 'ADMIN'].includes(userRole) && order.logoCharges > 0 ? [{ label: 'Logo Charge', val: showPrice ? `₨${order.logoCharges}` : '★ ★ ★' }] : []),
                            ...(['SUPER_ADMIN', 'ADMIN'].includes(userRole) && order.namePrintingCharges > 0 ? [{ label: 'Name Printing', val: showPrice ? `₨${order.namePrintingCharges}` : '★ ★ ★' }] : []),
                            ...(['SUPER_ADMIN', 'ADMIN'].includes(userRole) ? [{ label: 'Customization Charge', val: showPrice ? `₨${order.customizationPrice || 0}` : '★ ★ ★' }] : []),
                            ...(['SUPER_ADMIN', 'ADMIN'].includes(userRole) ? [{ label: 'Payment', val: order.paymentStatus }] : [])
                          ].filter(i => i.val).map((item, i) => (
                            <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-900/20">
                              <td className="py-3 px-4 text-xs md:text-sm text-gray-500 font-black uppercase tracking-widest">{item.label}</td>
                              <td className="py-3 px-4 text-sm md:text-base font-black text-white">{item.val}</td>
                            </tr>
                          ))}
                          {['STORE', 'STORE_EMPLOYEE'].includes(userRole) && (
                            <tr className="border-b border-gray-800/30 hover:bg-gray-900/20">
                              <td className="py-3 px-4 text-xs md:text-sm text-gray-500 font-black uppercase tracking-widest">{t('Stock')}</td>
                              <td className="py-3 px-4">
                                {['STORE', 'STORE_EMPLOYEE'].includes(userRole) ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={productAvailability[0] === true}
                                      onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, true); }}
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${productAvailability[0] === true ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : productAvailability[0] === false ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      disabled={productAvailability[0] === true}
                                      onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, false); }}
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${productAvailability[0] === false ? 'bg-red-500/20 text-red-400 border border-red-500/30' : productAvailability[0] === true ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`text-sm font-black ${productAvailability[0] === true ? 'text-emerald-400' : productAvailability[0] === false ? 'text-red-400' : 'text-gray-400'}`}>
                                    {productAvailability[0] === true ? t('Completed') : productAvailability[0] === false ? t('Rejected') : t('Pending')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

              {!isMultiItem && order.type === 'FULL_CUSTOM' && (
                <section className="bg-blue-600/5 p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-blue-500/10">
                  <h4 className="text-xs md:text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-6">{t('02. Precise Measurements (Inches)')}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-blue-500/20">
                          <th className="text-left text-blue-400 font-black uppercase tracking-wider py-2 pr-4">{t('Measurement')}</th>
                          <th className="text-right text-blue-400 font-black uppercase tracking-wider py-2 pl-4 w-24">{t('Inches')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(sizes || {}).filter(([k, v]) => k !== 'specialNote' && v).map(([key, val], i) => (
                          <tr key={i} className="border-b border-blue-500/5">
                            <td className="text-gray-300 font-bold py-2 pr-4 capitalize">{key}</td>
                            <td className="text-right text-white font-black py-2 pl-4">{val}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(product?.sleeveLength || (product?.gender === 'Female' && product?.femaleOptions?.sleeves)) && (
                    <div className="mt-3 flex justify-between items-center p-3 bg-gray-900 rounded-xl border border-pink-500/20">
                      <span className="text-xs md:text-sm text-pink-500 font-black uppercase tracking-tighter">{t('SLEEVES')}</span>
                      <span className="text-sm font-black text-white uppercase">{product.sleeveLength ? ({'full':'Full Sleeve','half':'Half Sleeve','three-quarter':'3 Quarter Sleeve'}[product.sleeveLength] || product.sleeveLength) : ({'full':'Full Sleeve','half':'Half Sleeve','medium':'Medium Sleeve'}[product.femaleOptions?.sleeves] || product.femaleOptions?.sleeves || '—')}</span>
                    </div>
                  )}
                  {(product?.shirtLength || (product?.gender === 'Female' && product?.femaleOptions?.shirtLength)) && (
                    <div className="mt-2 flex justify-between items-center p-3 bg-gray-900 rounded-xl border border-pink-500/20">
                      <span className="text-xs md:text-sm text-pink-500 font-black uppercase tracking-tighter">{t('SHIRT LENGTH')}</span>
                      <span className="text-sm font-black text-white uppercase">{product.shirtLength ? ({'long':'Full Length','short':'Short Length','regular':'Regular Length'}[product.shirtLength] || product.shirtLength) : ({'long':'Full Length','short':'Short Length'}[product.femaleOptions?.shirtLength] || product.femaleOptions?.shirtLength || '—')}</span>
                    </div>
                  )}
                  {sizes?.specialNote && (
                    <div className="mt-3 p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10">
                      <p className="text-xs md:text-sm text-yellow-400 font-black uppercase tracking-tighter mb-1">Special Note</p>
                      <p className="text-sm font-bold text-yellow-300/90 italic leading-tight">{sizes.specialNote}</p>
                    </div>
                  )}
                </section>
              )}

              {order.type !== 'STANDARD' && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                <div>
                  <h4 className="text-xs md:text-sm font-black text-emerald-500 uppercase tracking-[0.3em] mb-6">{t('03. Engraving')}</h4>
                  <div className="space-y-4">
                    {custom?.articleNames && custom.articleNames.length > 0
                      ? custom.articleNames.map((an, ai) => (
                          <div key={`an-${ai}`} className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                            <span className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-widest">{t('Article Name')} {custom.articleNames.length > 1 ? `#${ai + 1}` : ''}</span>
                            <span className="text-sm font-black text-emerald-400">{an || 'N/A'}</span>
                          </div>
                        ))
                      : custom?.nameSpelling && (
                          <div className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                            <span className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-widest">{t('Article Name')}</span>
                            <span className="text-sm font-black text-emerald-400">{custom.nameSpelling || 'N/A'}</span>
                          </div>
                        )
                    }
                    {custom?.logos && custom.logos.length > 0 && (
                      <>
                        {custom.logos.map((logo, li) => (
                          <div key={`logo-${li}`} className="p-4 bg-gray-950/30 rounded-2xl border border-amber-500/20 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs md:text-sm text-amber-400 font-bold uppercase tracking-widest">{t('Logo')} {custom.logos.length > 1 ? `#${li + 1}` : ''}</span>
                              <span className="text-sm font-black text-amber-400">{logo.name || 'Untitled'}</span>
                            </div>
                            {logo.design && (
                              <p className="text-xs text-gray-300 leading-relaxed">{logo.design}</p>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    {[
                      { l: t('Engraving Type'), v: custom?.engravingType === 'direct' ? t('Direct Engraving') : custom?.engravingType === 'patch' ? t('Patch Engraving') : null },
                      { l: t('Embroidery Color'), v: custom?.nameColor },
                      { l: t('Logo Location'), v: custom?.logoPlacement },
                      { l: t('Fit Type'), v: custom?.fitType },
                      { l: t('Stitching Style'), v: custom?.stitchingStyle ? (custom.stitchingStyle === 'DBL' ? 'Double' : 'Single') : null }
                    ].filter(i => i.v).map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                        <span className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-widest">{item.l}</span>
                        <span className="text-sm font-black text-emerald-400">{item.v || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs md:text-sm font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">{t('04. Design Notes & Special Requests')}</h4>
                  <div className="h-full min-h-[200px] bg-yellow-500/5 p-4 md:p-8 rounded-3xl border border-yellow-500/10 text-gray-300 leading-relaxed text-sm shadow-inner">
                    {order?.instructionNotes && (
                      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">{t('📋 Instruction Notes')}</p>
                        <p className="text-sm font-bold text-amber-200">{order.instructionNotes}</p>
                      </div>
                    )}
                    {custom?.designNotes ? (
                      <p className="italic mb-4">{custom.designNotes}</p>
                    ) : (
                      <p className="italic text-gray-500">{t('No special design notes provided for this order.')}</p>
                    )}
                    {custom?.articleNames && custom.articleNames.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-yellow-500/10 space-y-2">
                        <p className="text-xs font-black text-yellow-400 uppercase tracking-widest not-italic">{t('Article Names')}</p>
                        {custom.articleNames.map((an, ai) => (
                          <p key={ai} className="font-bold text-yellow-200/80 not-italic">{an}</p>
                        ))}
                      </div>
                    )}
                    {custom?.logos && custom.logos.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-yellow-500/10 space-y-3">
                        <p className="text-xs font-black text-amber-400 uppercase tracking-widest not-italic">Logo Details</p>
                        {custom.logos.map((logo, li) => (
                          <div key={li} className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                            <p className="font-bold text-amber-300 not-italic text-sm">{logo.name || `Logo ${li + 1}`}</p>
                            {logo.design && <p className="text-gray-400 text-xs mt-1 not-italic">{logo.design}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
              )}
            </div>

            <div className="p-4 md:p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
              <div className="flex flex-wrap items-center gap-x-4 text-xs md:text-sm text-gray-500 font-black uppercase tracking-widest">
                <span className="text-emerald-400">{t('Entry:')} {new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="w-1.5 h-1.5 bg-gray-700 rounded-full shrink-0"></span>
                <span>{t('Stage:')} {currentStage?.stageName}</span>
                {order.deliveredAt && (
                  <>
                    <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full shrink-0"></span>
                    <span className="text-emerald-400">{t('Delivered:')} {new Date(order.deliveredAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} – {new Date(order.deliveredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowForceModal(true)}
                    className="bg-red-900/30 hover:bg-red-800/50 text-red-400 px-4 py-3 rounded-2xl text-xs md:text-sm font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-1.5"
                  >
                    <span className="text-xs">⚡</span> Force
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <select
                    value={printLang}
                    onChange={(e) => setPrintLang(e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-white text-xs font-black px-2 py-2 rounded-xl uppercase tracking-widest"
                  >
                    <option value="ur">اردو</option>
                    <option value="en">English</option>
                  </select>
                  <button
                    onClick={() => { setPrintSections({ measurements: true, engraving: true }); setShowPrintFilter(true); }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                  >
                    <Printer size={14} /> {t('Print Job Sheet')}
                  </button>
                  <button 
                    onClick={() => setShowFullSheet(false)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    {t('Close Job Sheet')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Print Filter Modal */}
      {showPrintFilter && order && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrintFilter(false)}></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative theme-bg rounded-3xl border theme-border p-6 md:p-8 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-lg font-black uppercase tracking-widest mb-6">{t('Print Job Sheet Sections')}</h3>
            <div className="space-y-4 mb-8">
              <label className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 cursor-not-allowed opacity-60">
                <input type="checkbox" checked={true} disabled className="w-5 h-5 accent-emerald-500" />
                <div>
                  <p className="text-sm font-black text-emerald-400">{t('Order & Product Details')}</p>
                  <p className="text-xs text-gray-500">{t('Customer info, order details, products')}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-2xl theme-bg-subtle border theme-border cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={printSections.measurements}
                  onChange={(e) => setPrintSections(p => ({ ...p, measurements: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-500"
                />
                <div>
                  <p className="text-sm font-black">{t('Measurements')}</p>
                  <p className="text-xs text-gray-500">{t('Size, custom measurements, special note')}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-2xl theme-bg-subtle border theme-border cursor-pointer hover:border-emerald-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={printSections.engraving}
                  onChange={(e) => setPrintSections(p => ({ ...p, engraving: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-500"
                />
                <div>
                  <p className="text-sm font-black">{t('Engraving / Customization')}</p>
                  <p className="text-xs text-gray-500">{t('Engraving text, logos, design notes')}</p>
                </div>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { printJobSheet(order, userRole, printLang, printSections); setShowPrintFilter(false); }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
              >
                {t('Print')}
              </button>
              <button
                onClick={() => setShowPrintFilter(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
              >
                {t('Cancel')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showApprovalDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-sm w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Approve & Send To...</h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-8">Current Stage: {currentStage?.stageName.replace('_', ' ')} Complete</p>
            
            <div className="space-y-6 mb-8">
              <div className="space-y-3">
                    <label className="text-xs md:text-sm font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <span>Route Order To</span>
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] font-black tracking-wider">MANUAL</span>
                    </label>
                    <select 
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all text-white font-bold text-sm appearance-none"
                      onChange={(e) => setNextStage(e.target.value)}
                      value={nextStage || ''}
                    >
                      <option value="">Select destination...</option>
                      <option value="STORE">Send to STORE</option>
                      <option value="LOGO_DESIGN">Send to LOGO & NAME DESIGN</option>
                      <option value="PRODUCTION">Send to PRODUCTION</option>
                      <option value="STORE_RECEIVE">Send to STORE — Coming From Production</option>
                      <option value="DISPATCH">Send to DISPATCH</option>
                      <option value="OUT_FOR_DELIVERY">Send to DELIVERY</option>
                      <option disabled className="border-t border-gray-800">──────────</option>
                      <option value="ORDER_ENTRY">Return to ORDER ENTRY</option>
                      <option value="NOT_AVAILABLE">Mark as NOT AVAILABLE</option>
                      <option value="REJECT">Reject Order</option>
                    </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs md:text-sm font-black text-emerald-500 uppercase tracking-widest ml-1">Delivery Method (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'ANIMAL', label: 'Animal Delivery', icon: '🐪' },
                    { value: 'TCS', label: 'TCS Courier', icon: '📦' },
                    { value: 'ASSIGNED_PARTNER', label: 'Assigned Partner', icon: '👤' },
                  ].map(method => (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setDeliveryMethod(prev => prev === method.value ? '' : method.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all active:scale-95 ${
                        deliveryMethod === method.value 
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-900/20' 
                          : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <span className="text-lg block mb-1">{method.icon}</span>
                      <span className="text-xs md:text-sm font-black uppercase tracking-wider">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(nextStage === 'DISPATCH' || currentStage?.stageName === 'DISPATCH') && (
                <div className="space-y-3">
                  <label className="text-xs md:text-sm font-black text-purple-500 uppercase tracking-widest ml-1">Delivery Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'COURIER', label: 'Courier', icon: '📦', desc: 'Ship via courier' },
                      { value: 'IN_CITY', label: 'In-City', icon: '🚚', desc: 'Local delivery' },
                      { value: 'PICKUP', label: 'Pickup', icon: '🏪', desc: 'Customer pickup' },
                    ].map(dt => (
                      <button key={dt.value} type="button"
                        onClick={() => setSelectedDeliveryType(prev => prev === dt.value ? '' : dt.value)}
                        className={`p-3 rounded-xl border-2 text-center transition-all active:scale-95 ${
                          selectedDeliveryType === dt.value
                            ? 'border-purple-500 bg-purple-500/10 text-purple-400 shadow-lg shadow-purple-900/20'
                            : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
                        }`}>
                        <span className="text-lg block mb-1">{dt.icon}</span>
                        <span className="text-xs md:text-sm font-black uppercase tracking-wider">{dt.label}</span>
                        <span className="text-[9px] text-gray-600 block mt-0.5">{dt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(order.type === 'FULL_CUSTOM' || order.type === 'READY_LOGO') && currentStage?.stageName === 'STORE' && (
                <div className="space-y-3">
                  <label className="text-xs md:text-sm font-black text-emerald-500 uppercase tracking-widest ml-1">Add Customization Amount (₨)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black">₨</span>
                    <input 
                      type="number"
                      value={customizationAmount}
                      onChange={(e) => setCustomizationAmount(e.target.value)}
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-emerald-500 transition-all text-white font-black text-xl"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col space-y-3">
              <button 
                disabled={!nextStage}
                onClick={() => {
                  if (window.confirm(`Are you sure you want to approve and send to ${nextStage.replace(/_/g, ' ')}?`)) {
                    onUpdateStage(order.id, currentStage.id, 'approve', { 
                      nextStage, 
                      customizationPrice: customizationAmount,
                      deliveryMethod: deliveryMethod || null,
                      deliveryType: selectedDeliveryType || null
                    });
                    setShowApprovalDialog(false);
                    setCustomizationAmount('0');
                    setNextStage('');
                    setDeliveryMethod('');
                    setSelectedDeliveryType('');
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
              >
                Confirm & Send
              </button>
              <button 
                onClick={() => { setShowApprovalDialog(false); setNextStage(''); setDeliveryMethod(''); setSelectedDeliveryType(''); }}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* --- REJECTION DIALOG --- */}
      {showRejectionDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-sm w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-red-500/30 shadow-2xl"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Reject & Return</h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-8">Provide a reason for the worker</p>
            
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-red-500 transition-all text-white font-bold text-sm min-h-[120px] mb-8"
              placeholder="Explain what needs to be fixed..."
            />

            <div className="flex flex-col space-y-3">
              <button 
                disabled={!rejectionReason.trim()}
                onClick={() => {
                  onUpdateStage(order.id, currentStage.id, 'reject', { reason: rejectionReason });
                  setShowRejectionDialog(false);
                  setRejectionReason('');
                }}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/20"
              >
                Confirm Rejection
              </button>
              <button 
                onClick={() => setShowRejectionDialog(false)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* --- CANCEL DIALOG --- */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-sm w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-red-900/50 shadow-2xl"
          >
            <div className="flex items-center justify-center mb-6">
              <div className="p-4 bg-red-500/20 rounded-full text-red-500">
                <ShieldAlert size={32} />
              </div>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Cancel Order?</h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-8">This will permanently stop production and notify the customer.</p>
            
            <textarea 
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-red-500 transition-all text-white font-bold text-sm min-h-[100px] mb-8"
              placeholder="Reason for cancellation..."
            />

            <div className="flex flex-col space-y-3">
              <button 
                disabled={!cancelReason.trim()}
                onClick={async () => {
                  try {
                    await axios.put(`${API_URL}/api/orders/${order.id}/cancel`, { reason: cancelReason }, {
                      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                    });
                    setShowCancelDialog(false);
                    setCancelReason('');
                  } catch (error) {
                    console.error('Cancellation failed:', error);
                    alert('Cancellation failed');
                  }
                }}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/20"
              >
                Permanently Cancel Order
              </button>
              <button 
                onClick={() => setShowCancelDialog(false)}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Keep Order
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showHoldDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-sm w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-orange-500/30 shadow-2xl"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">{t('Hold')} Order</h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-8">Explain why this order is being paused</p>
            
            <textarea 
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-orange-500 transition-all text-white font-bold text-sm min-h-[120px] mb-8"
              placeholder="Reason for hold..."
            />

            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => handleHoldAction(false)}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20"
              >
                Confirm Hold
              </button>
              <button 
                onClick={() => {
                  setShowHoldDialog(false);
                  setHoldReason('');
                }}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Go Back
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* --- FORCE ACTION MODAL --- */}
      {showForceModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-md w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-red-500/30 shadow-2xl"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 text-center flex items-center justify-center gap-2">
              ⚡ Force Action
            </h3>
            <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest text-center mb-8">Admin override — all actions are logged</p>

            <div className="space-y-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {['FORCE_MOVE', 'FORCE_COMPLETE', 'EXTEND_DEADLINE'].map(a => (
                  <button
                    key={a}
                    onClick={() => setForceAction(a)}
                    className={`flex-1 py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      forceAction === a ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-500 border border-gray-800'
                    }`}
                  >
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {forceAction === 'FORCE_MOVE' && (
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-2 block">Target Stage</label>
                  <select value={forceStage} onChange={(e) => setForceStage(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-red-500 text-white font-bold text-sm">
                    <option value="">Select stage...</option>
                    <option value="STORE">STORE</option>
                    <option value="LOGO_DESIGN">LOGO DESIGN</option>
                    <option value="PRODUCTION">PRODUCTION</option>
                    <option value="STORE_RECEIVE">STORE RECEIVE</option>
                    <option value="DISPATCH">DISPATCH</option>
                    <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  </select>
                </div>
              )}

              {forceAction === 'EXTEND_DEADLINE' && (
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-2 block">Additional Hours</label>
                  <input type="number" min="1" value={forceHours} onChange={(e) => setForceHours(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-red-500 text-white font-black text-lg" placeholder="e.g. 24" />
                </div>
              )}

              <div>
                <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-2 block">Reason (required)</label>
                <textarea value={forceReason} onChange={(e) => setForceReason(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-red-500 text-white font-bold text-sm min-h-[80px]" placeholder="Why is this force action needed?" />
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                disabled={!forceReason.trim() || forceLoading || (forceAction === 'FORCE_MOVE' && !forceStage) || (forceAction === 'EXTEND_DEADLINE' && !forceHours)}
                onClick={async () => {
                  setForceLoading(true);
                  try {
                    const body = { action: forceAction, reason: forceReason };
                    if (forceAction === 'FORCE_MOVE') body.stageName = forceStage;
                    if (forceAction === 'EXTEND_DEADLINE') body.hours = parseFloat(forceHours);
                    await axios.post(`${API_URL}/api/orders/${order.id}/force`, body, {
                      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                    });
                    setShowForceModal(false);
                    setForceAction('FORCE_MOVE');
                    setForceStage('');
                    setForceHours('');
                    setForceReason('');
                    toast.success('Force action executed successfully');
                  } catch (err) {
                    alert('Force action failed: ' + (err.response?.data?.error || err.message));
                  }
                  setForceLoading(false);
                }}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-900/20"
              >
                {forceLoading ? 'Processing...' : 'Execute Force Action'}
              </button>
              <button onClick={() => { setShowForceModal(false); setForceReason(''); setForceAction('FORCE_MOVE'); setForceStage(''); setForceHours(''); }}
                className="w-full bg-gray-900 hover:bg-gray-800 text-gray-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass max-w-sm w-full p-6 rounded-[2rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <AlertCircle className="text-yellow-400" size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Record Payment</h2>
                <p className="text-gray-400 text-xs font-bold">Order #{order.orderNumber || order.id.substring(0, 8)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Total Price</label>
                <p className={`text-2xl font-black mt-1 ${showPrice ? 'text-white' : 'text-gray-500'}`}>{priceDisplay(order.totalPrice)}</p>
              </div>

              {order.courierDetails?.payments?.length > 0 && (
                <div className="theme-bg rounded-xl p-3 border theme-border max-h-24 overflow-y-auto">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Payment History</p>
                  {order.courierDetails.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs md:text-sm py-0.5 border-b border-gray-800/50 last:border-0">
                      <span className="font-bold text-gray-400">{p.method}</span>
                      <span className={`font-black ${showPrice ? 'text-emerald-400' : 'text-gray-500'}`}>{priceDisplay(p.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs md:text-sm pt-1 mt-1 border-t border-gray-700">
                    <span className="font-black text-gray-300">Total Paid</span>
                    <span className={`font-black ${showPrice ? 'text-emerald-400' : 'text-gray-500'}`}>{priceDisplay(order.courierDetails.payments.reduce((s, p) => s + (p.amount || 0), 0))}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Amount (₨)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-yellow-500 text-white font-black text-lg mt-1"
                  placeholder="Enter payment amount"
                />
              </div>

              <div>
                <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'CASH', label: 'Cash', icon: '💵' },
                    { value: 'ONLINE', label: 'Online Transfer', icon: '🏦' },
                  ].map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        paymentMethod === m.value ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-gray-800 bg-gray-950 text-gray-400'
                      }`}
                    >
                      <span className="text-lg block mb-1">{m.icon}</span>
                      <span className="text-xs md:text-sm font-black uppercase">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentLoading}
                  onClick={async () => {
                    setPaymentLoading(true);
                    try {
                      const token = sessionStorage.getItem('token');
                      await axios.put(`${API_URL}/api/orders/${order.id}/payment`, {
                        paidAmount: parseFloat(paymentAmount),
                        paymentMethod,
                        paymentStatus: 'ADVANCE_PAID'
                      }, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      setShowPaymentModal(false);
                      toast.success('Payment recorded successfully');
                    } catch (err) {
                      alert('Payment failed: ' + (err.response?.data?.message || err.message));
                    }
                    setPaymentLoading(false);
                  }}
                  className="flex-1 py-3 bg-yellow-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {paymentLoading ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Timeline Modal */}
      {showTimelineModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-2xl w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 border-gray-800 shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Clock size={20} className="text-cyan-400" />
                  Order Timeline
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                  #{order.orderNumber || 'N/A'} — {order.customerName}
                </p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} className="text-gray-500 hover:text-white transition-colors p-2">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
              {timelineLoading ? (
                <div className="flex justify-center py-12"><RefreshCcw size={24} className="animate-spin text-cyan-400" /></div>
              ) : timelineData.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-black uppercase tracking-widest text-xs">No timeline data</div>
              ) : (
                timelineData.map((entry, idx) => {
                  const isStage = entry.type === 'stage';
                  const isRoute = entry.type === 'route';
                  const isAudit = entry.type === 'audit';
                  const dotColor = isStage
                    ? entry.status === 'COMPLETED' ? 'bg-emerald-500'
                      : entry.acceptedAt ? 'bg-blue-500'
                        : 'bg-gray-600'
                    : isRoute ? 'bg-amber-500'
                      : 'bg-purple-500';

                  return (
                    <div key={entry.id || idx} className="relative pl-10 pb-4">
                      {idx < timelineData.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-gray-800" />
                      )}
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-gray-900 flex items-center justify-center ${dotColor}`}>
                        {isStage ? (
                          <span className="text-[8px] text-white font-black">{entry.status === 'COMPLETED' ? '✓' : entry.acceptedAt ? '●' : '○'}</span>
                        ) : isRoute ? (
                          <span className="text-[8px]">→</span>
                        ) : (
                          <span className="text-[8px]">●</span>
                        )}
                      </div>

                      <div className="p-3 rounded-xl border border-gray-800 bg-gray-950/50">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-wider"
                            style={{ color: isStage
                              ? entry.status === 'COMPLETED' ? '#10b981' : entry.acceptedAt ? '#3b82f6' : '#6b7280'
                              : isRoute ? '#f59e0b' : '#a855f7'
                            }}
                          >
                            {isStage ? entry.stage.replace(/_/g, ' ') : isRoute ? `${entry.from?.replace(/_/g, ' ')} → ${entry.to?.replace(/_/g, ' ')}` : entry.label}
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {isStage && (
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500 font-medium">
                            <span>Received: {new Date(entry.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {entry.acceptedAt && (
                              <span>Accepted: {new Date(entry.acceptedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            {entry.completedAt && (
                              <span>Completed: {new Date(entry.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            {entry.delay !== null && (
                              <span className={entry.delay > 60 ? 'text-red-400' : 'text-yellow-400'}>
                                Delay: {entry.delay} min
                              </span>
                            )}
                            {entry.returnedFrom && (
                              <span className="text-orange-400">Returned from {entry.returnedFrom}</span>
                            )}
                          </div>
                        )}

                        {isRoute && entry.remarks && (
                          <p className="mt-1 text-[10px] text-gray-600 italic">{entry.remarks}</p>
                        )}

                        {isAudit && entry.details && (
                          <p className="mt-1 text-[10px] text-gray-600 italic">{entry.details}</p>
                        )}

                        {entry.actor && (
                          <p className="mt-1 text-[9px] text-gray-700 font-bold">{entry.actor}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button onClick={() => setShowTimelineModal(false)}
              className="mt-4 w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

    </>
  );
};

export default React.memo(OrderCard);
