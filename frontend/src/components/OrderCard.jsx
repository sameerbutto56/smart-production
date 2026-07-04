import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, ChevronRight, AlertCircle, ClipboardList, Check, X, RefreshCcw, MessageSquare, History, Target, Trash2, Truck, Users, Phone, ShieldAlert, RotateCcw, Lock, Package, AlertTriangle, Printer } from 'lucide-react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import Button from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import { printJobSheet } from '../utils/printReport';
import toast from 'react-hot-toast';

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
      setProductAvailability(prev => ({ ...prev, [idx]: isAvailable }));

      await api.patch(`/api/orders/${order.id}/product-availability`, {
        productAvailability: { [idx]: isAvailable }
      });

      toast.success(isAvailable ? 'Item Completed' : 'Item Rejected');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update product availability');
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
        setUrgencyColor('text-gray-400');
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
        setUrgencyColor('text-red-500 font-bold animate-pulse');
        setDeadlineStatus('OVERDUE');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}${t('h')} ${minutes}${t('m')} ${seconds}${t('s')}`);
      
      if (hours < 1) { setUrgencyColor('text-red-500 font-bold'); setDeadlineStatus('OVERDUE'); }
      else if (hours < 4) { setUrgencyColor('text-amber-500 font-bold'); setDeadlineStatus('APPROACHING'); }
      else { setUrgencyColor('text-blue-500'); setDeadlineStatus('ON_TIME'); }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStage]);

  useEffect(() => {
    if (!showTimelineModal || !order?.id) return;
    setTimelineLoading(true);
    api.get(`/api/orders/${order.id}/timeline`).then(res => setTimelineData(res.data))
      .catch(() => toast.error('Failed to load timeline'))
      .finally(() => setTimelineLoading(false));
  }, [showTimelineModal, order?.id]);

  const handleInventoryCheck = useCallback(() => {
    if (!currentStage || invCheck) return;
    setInvCheckLoading(true);
    api.get(`/api/orders/${order.id}/inventory-check`)
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
      const firstItem = parsed[0]?.productDetails || parsed[0] || {};
      return { primary: firstItem, allItems: parsed, isMultiItem: true };
    }
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
              <li key="hdr-rej" className="text-xs font-bold text-red-500 uppercase tracking-widest py-1.5 px-2 bg-red-50 rounded-lg border border-red-200 mb-1">
                ✗ Rejected / Unavailable
              </li>
            );
          }
          if (isCompleted && !headerShown.completed) {
            headerShown.completed = true;
            rows.push(
              <li key="hdr-cmp" className="text-xs font-bold text-emerald-600 uppercase tracking-widest py-1.5 px-2 bg-emerald-50 rounded-lg border border-emerald-200 mb-1 mt-2">
                ✓ Completed
              </li>
            );
          }
          if (!isRejected && !isCompleted && !headerShown.pending && (hasRejected || hasCompleted)) {
            headerShown.pending = true;
            rows.push(
              <li key="hdr-pen" className="text-xs font-bold uppercase tracking-widest py-1.5 px-2 rounded-lg border mb-1 mt-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' }}>
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
              className={`text-xs md:text-sm flex items-center justify-between p-2 rounded-lg border ${isRejected ? 'bg-red-50 border-red-200 border-l-2' : isCompleted ? 'bg-emerald-50 border-emerald-200 border-l-2' : 'border border-gray-100'}`}
              style={isRejected ? { borderLeftColor: '#ef4444' } : isCompleted ? { borderLeftColor: '#10b981' } : { background: '#f8fafc' }}
            >
              <span className={`font-bold uppercase tracking-tighter ${isRejected ? 'text-orange-600' : isCompleted ? 'text-emerald-600' : 'text-slate-500'}`}>#{idx + 1} {p.productType || 'Item'}: {p.fabricType || 'STD'} / {p.color || '—'} / Size {p.size || '—'}{p.alteration && (p.alteration.trouserLength || p.alteration.shirtLength || p.alteration.sleeveLength) ? <span className="ml-1.5 text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded text-[9px]">Alt: {[p.alteration.trouserLength && `Trouser ${p.alteration.trouserLength}"`, p.alteration.shirtLength && `Shirt ${p.alteration.shirtLength}"`, p.alteration.sleeveLength && `Sleeve ${p.alteration.sleeveLength}"`].filter(Boolean).join(' ')}</span> : ''}</span>
              {isStoreRole && (
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, true); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${isCompleted ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 cursor-not-allowed' : isRejected ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600'}`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, false); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${isRejected ? 'bg-red-100 text-red-600 border border-red-200' : isCompleted ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-600'}`}
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
        { label: 'Base', val: product?.productType },
        ...(product?.alteration && (product.alteration.trouserLength || product.alteration.shirtLength || product.alteration.sleeveLength) ? [{ label: 'Alteration', val: [product.alteration.trouserLength && `Trouser ${product.alteration.trouserLength}"`, product.alteration.shirtLength && `Shirt ${product.alteration.shirtLength}"`, product.alteration.sleeveLength && `Sleeve ${product.alteration.sleeveLength}"`].filter(Boolean).join(' ') }] : [])
      ];
      const singleCompleted = productAvailability[0] === true;
      const singleRejected = productAvailability[0] === false;
      return (
        <>
          {isStoreRole && (
            <li className="flex items-center justify-between p-2 rounded-lg border mb-2" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <span className={`text-xs md:text-sm font-bold uppercase tracking-tighter ${singleCompleted ? 'text-emerald-600' : singleRejected ? 'text-red-500' : 'text-slate-500'}`}>
                Stock: {singleCompleted ? 'Completed' : singleRejected ? 'Rejected' : 'Pending'}
              </span>
              <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    disabled={singleCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, true); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${singleCompleted ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 cursor-not-allowed' : singleRejected ? 'bg-gray-100 text-gray-400 border border-gray-200' : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-emerald-50 hover:text-emerald-600'}`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    disabled={singleCompleted}
                    onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, false); }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${singleRejected ? 'bg-red-100 text-red-600 border border-red-200' : singleCompleted ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-red-50 hover:text-red-600'}`}
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
              className="text-xs md:text-sm flex items-center justify-between p-2 rounded-lg border" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
            >
              <span className="font-semibold uppercase tracking-tighter" style={{ color: '#64748b' }}>{item.label}: {item.val || 'N/A'}</span>
            </motion.li>
          ))}
        </>
      );
    }

    if (stage === 'PRODUCTION') {
      const { primary: _, allItems: prodItems, isMultiItem: isMultiProd } = normalizeProduct(order.productDetails);
      const items = isMultiProd && prodItems ? prodItems : [{ productDetails: normalizeProduct(order.productDetails).primary, customization: parseJSON(order.customization), sizeData: parseJSON(order.sizeData) }];
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
              <div key={idx} className={`${isMultiProd || items.length > 1 ? 'bg-gray-50 p-3 rounded-xl border border-gray-100' : ''}`}>
                {(isMultiProd || sortedItems.length > 1) && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}>#{idx + 1}</span>
                    <span className="text-xs font-bold" style={{ color: '#0f172a' }}>{p.productType || `Item ${idx + 1}`}</span>
                    {p.color && <span className="text-[9px]" style={{ color: '#94a3b8' }}>({p.color})</span>}
                    {isNotAvail && (
                      <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider badge-danger">
                        ⚠ To Be Manufactured
                      </span>
                    )}
                    {p.availabilityStatus === 'produced' && (
                      <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider badge-info">
                        ✓ Produced
                      </span>
                    )}
                    {p.availabilityStatus === 'available' && (
                      <span className="ml-auto px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider badge-success">
                        ✓ In Stock
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: t('Fabric'), v: p?.fabricType },
                    { l: t('Color'), v: p?.color },
                    { l: 'Size', v: p?.size },
                  ].filter(m => m.v).map((m, mi) => (
                    <div key={mi} className="p-2 rounded-lg border text-center" style={{ background: '#fef2f2', borderColor: 'rgba(244,63,94,0.1)' }}>
                      <p className="text-[9px] font-bold uppercase" style={{ color: '#f43f5e' }}>{m.l}</p>
                      <p className="text-xs md:text-sm font-bold truncate" style={{ color: '#0f172a' }}>{m.v}</p>
                    </div>
                  ))}
                  {p?.alteration && (p.alteration.trouserLength || p.alteration.shirtLength || p.alteration.sleeveLength) && (
                    <div className="p-2 rounded-lg border text-center col-span-3" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.3)' }}>
                      <p className="text-[9px] font-bold uppercase" style={{ color: '#d97706' }}>Alteration</p>
                      <p className="text-xs md:text-sm font-bold" style={{ color: '#b45309' }}>{[p.alteration.trouserLength && `Trouser ${p.alteration.trouserLength}"`, p.alteration.shirtLength && `Shirt ${p.alteration.shirtLength}"`, p.alteration.sleeveLength && `Sleeve ${p.alteration.sleeveLength}"`].filter(Boolean).join(' | ')}</p>
                    </div>
                  )}
                </div>

                {(p?.fabricSourceProduct || p?.colorSourceProduct || p?.designSourceProduct || p?.sizeSourceProduct || p?.additionalProductRef) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p?.fabricSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Fabric: {p.fabricSourceProduct}</span>}
                    {p?.colorSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Color: {p.colorSourceProduct}</span>}
                    {p?.designSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Design: {p.designSourceProduct}</span>}
                    {p?.sizeSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Size: {p.sizeSourceProduct}</span>}
                    {p?.additionalProductRef && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Extra: {p.additionalProductRef}</span>}
                  </div>
                )}

                <div className="p-3 rounded-xl border mt-3" style={{ background: '#eef2ff', borderColor: 'rgba(99,102,241,0.2)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#6366f1' }}>Production Specs</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                      <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Fit</p>
                      <p className="text-xs md:text-sm font-bold" style={{ color: '#0f172a' }}>{c?.fitType || 'REGULAR'}</p>
                    </div>
                    {!c?.skipEngraving && c?.engravingType && (
                      <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                        <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Engraving</p>
                        <p className="text-xs md:text-sm font-bold" style={{ color: '#7c3aed' }}>{c.engravingType === 'direct' ? 'Direct' : 'Patch'}</p>
                      </div>
                    )}
                    {p?.gender === 'Female' && (
                      <>
                        {(p?.sleeveLength || (female.sleeves && female.sleeves !== 'full')) && (
                          <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                            <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Sleeves</p>
                            <p className="text-xs md:text-sm font-bold" style={{ color: '#0f172a' }}>{p.sleeveLength ? ({'full':'Full','half':'Half','three-quarter':'3 Quarter'}[p.sleeveLength] || p.sleeveLength) : ({'full':'Full','half':'Half','medium':'Medium'}[female.sleeves] || female.sleeves || 'N/A')}</p>
                          </div>
                        )}
                        {(p?.shirtLength || (female.shirtLength && female.shirtLength !== 'long')) && (
                          <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                            <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Shirt L.</p>
                            <p className="text-xs md:text-sm font-bold" style={{ color: '#0f172a' }}>{p.shirtLength ? ({'long':'Long','short':'Short','regular':'Regular'}[p.shirtLength] || p.shirtLength) : ({'long':'Long','short':'Short'}[female.shirtLength] || female.shirtLength || 'N/A')}</p>
                          </div>
                        )}
                      </>
                    )}
                    {p?.sleeveLength && p?.gender !== 'Female' && (
                      <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                        <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Sleeves</p>
                        <p className="text-xs md:text-sm font-bold" style={{ color: '#0f172a' }}>{p.sleeveLength === 'full' ? 'Full' : p.sleeveLength === 'three-quarter' ? '3 Quarter' : p.sleeveLength === 'half' ? 'Half' : p.sleeveLength || 'Quarter'}</p>
                      </div>
                    )}
                    {p?.shirtLength && p?.gender !== 'Female' && (
                      <div className="p-2 rounded-lg" style={{ background: '#ffffff' }}>
                        <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Shirt L.</p>
                        <p className="text-xs md:text-sm font-bold" style={{ color: '#0f172a' }}>{p.shirtLength === 'long' ? 'Long' : p.shirtLength === 'regular' ? 'Regular' : 'Short'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {hasSizes && (
                  <div className="p-3 rounded-xl border mt-3" style={{ background: '#ffffff', borderColor: '#e2e8f0' }}>
                    <p className="text-xs md:text-sm font-bold uppercase tracking-widest mb-2 px-1" style={{ color: '#64748b' }}>Measurements</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: '#e2e8f0' }}>
                          <th className="text-left font-bold uppercase tracking-wider py-1.5 pr-2" style={{ color: '#64748b' }}>Measurement</th>
                          <th className="text-right font-bold uppercase tracking-wider py-1.5 pl-2 w-16" style={{ color: '#64748b' }}>Inches</th>
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
                          <tr key={si} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                            <td className="font-semibold py-1.5 pr-2" style={{ color: '#64748b' }}>{sm.l}</td>
                            <td className="text-right font-bold py-1.5 pl-2" style={{ color: '#0f172a' }}>{sm.v}"</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {s?.specialNote && (
                  <div className="p-3 rounded-xl border mt-3" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.1)' }}>
                    <p className="text-xs md:text-sm font-bold uppercase tracking-widest mb-1" style={{ color: '#d97706' }}>Special Note</p>
                    <p className="text-xs md:text-sm font-medium italic leading-tight" style={{ color: '#92400e' }}>{s.specialNote}</p>
                  </div>
                )}

                {!c?.skipEngraving && (c?.articleNames?.length > 0 || c?.nameSpelling) && (
                  <div className="p-3 rounded-xl border mt-3" style={{ background: '#faf5ff', borderColor: 'rgba(168,85,247,0.2)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>Name Lines</p>
                    <div className="flex flex-wrap gap-2">
                      {c.articleNames?.length > 0 ? (
                        c.articleNames.map((an, ai) => (
                          <span key={ai} className="px-2 py-1 rounded text-xs font-bold border" style={{ background: '#ede9fe', borderColor: 'rgba(168,85,247,0.2)', color: '#6d28d9' }}>
                            L{ai + 1}: {an}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-bold border" style={{ background: '#ede9fe', borderColor: 'rgba(168,85,247,0.2)', color: '#6d28d9' }}>L1: {c.nameSpelling}</span>
                      )}
                    </div>
                  </div>
                )}

                {!c?.skipEngraving && c?.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 && (
                  <div className="p-3 rounded-xl border mt-3" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.2)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#d97706' }}>Logos</p>
                    <div className="space-y-2">
                      {c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).map((logo, li) => (
                        <div key={li} className="p-2 rounded-lg border" style={{ background: '#fef3c7', borderColor: 'rgba(245,158,11,0.1)' }}>
                          <p className="text-xs md:text-sm font-bold" style={{ color: '#92400e' }}>{logo.name || logo.design}</p>
                          {logo.design && <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>{logo.design}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!c?.skipEngraving && c?.designNotes && (
                  <div className="p-3 rounded-xl border mt-3" style={{ background: '#fffbeb', borderColor: 'rgba(245,158,11,0.1)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center space-x-1" style={{ color: '#d97706' }}>
                      <MessageSquare size={10} />
                      <span>Special Note:</span>
                    </p>
                    <p className="text-xs md:text-sm font-medium italic leading-tight" style={{ color: '#78716c' }}>"{c.designNotes}"</p>
                  </div>
                )}

                {isFirst && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <div className="px-2 py-1 rounded text-xs md:text-sm font-bold uppercase tracking-tighter border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                      GENDER: {p?.gender || 'N/A'}
                    </div>
                    {female.dupatta && (
                      <div className="px-2 py-1 rounded text-xs md:text-sm font-bold uppercase tracking-tighter border" style={{ background: '#fdf2f8', borderColor: 'rgba(244,114,182,0.2)', color: '#db2777' }}>
                        + DUPATTA
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="p-4 rounded-2xl border text-center" style={{ background: '#eef2ff', borderColor: 'rgba(99,102,241,0.2)' }}>
             <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#6366f1' }}>Order ID</p>
             <h4 className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>#{order.orderNumber}</h4>
             <p className="text-xs md:text-sm font-semibold uppercase mt-1" style={{ color: '#64748b' }}>{order.customerName}</p>
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
      <li key={i} className="text-xs flex items-center space-x-2" style={{ color: '#475569' }}>
        <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>•</span>
        <span>{t}</span>
      </li>
    ));
  };

  const handleHoldAction = async (resume = false) => {
    try {
      await api.put(`/api/orders/${order.id}/hold`, { 
        reason: holdReason,
        resume
      });
      setShowHoldDialog(false);
      setHoldReason('');
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
        className="cursor-pointer overflow-hidden max-w-full mb-6 theme-card"
        style={{
          borderRadius: '16px',
          border: order.priority === 'SUPER_URGENT' ? '1.5px solid #f43f5e' : order.priority === 'URGENT' ? '1.5px solid #f59e0b' : isDelayed ? '1.5px solid #ef4444' : '1px solid #f1f5f9',
          boxShadow: order.priority === 'SUPER_URGENT' ? '0 4px 20px rgba(244,63,94,0.15)' : order.status === 'REJECTED' ? '0 4px 20px rgba(239,68,68,0.1)' : order.status === 'ON_HOLD' ? '0 4px 20px rgba(245,158,11,0.1)' : 'var(--shadow-sm)',
          background: '#ffffff'
        }}
      >
        <div className="p-3 md:p-4">
          <div className="flex justify-between items-start gap-2 md:gap-3 mb-2 md:mb-3">
            {onToggleSelect && (
              <div className="flex-shrink-0 pt-1" onClick={e => { e.stopPropagation(); onToggleSelect(order.id); }}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${selected ? 'border-rose-500' : 'border-gray-300 hover:border-rose-400'}`} style={{ background: selected ? '#f43f5e' : 'transparent' }}>
                  {selected && <Check size={12} className="text-white" />}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {order.productImage && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden border shadow-lg" style={{ borderColor: '#e2e8f0' }}>
                  <img src={order.productImage} alt="Product" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                  <h3 className="font-bold text-base md:text-lg tracking-tighter truncate max-w-[120px] md:max-w-none" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>#{order.orderNumber || order.id.substring(0, 8)}</h3>
                  {order.priority === 'SUPER_URGENT' && (
                    <span className="text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1" style={{ background: '#dc2626' }}>
                      <span>⚡</span> SUPER URGENT
                    </span>
                  )}
                  {order.priority === 'URGENT' && (
                    <span className="text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1" style={{ background: '#d97706' }}>
                      <span>⚡</span> URGENT
                    </span>
                  )}
                  <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter text-white ${
                    order.type === 'FULL_CUSTOM' ? '' : order.type === 'READY_LOGO' ? '' : ''
                  }`} style={{
                    background: order.type === 'FULL_CUSTOM' ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : order.type === 'READY_LOGO' ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : '#94a3b8'
                  }}>
                    {order.type}
                  </span>
                  {order.deliveryMethod && (
                    <span className="text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1" style={{ background: '#059669' }}>
                       <Truck size={7} /> {order.deliveryMethod.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-xs md:text-sm font-semibold tracking-wide truncate max-w-[140px] md:max-w-[200px]" style={{ color: '#475569' }}>
                    {order.customerName}
                    {order.shopifyOrderDate && (
                      <span className="text-purple-600 ml-2 font-bold text-[9px] md:text-[10px]">Shopify: {new Date(order.shopifyOrderDate).toLocaleDateString()}</span>
                    )}
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest border flex items-center gap-1 ${
                    order.status === 'ON_HOLD' ? 'badge-warning' : isWaitingApproval ? 'bg-amber-500 text-white animate-pulse border-amber-500' : 'badge-info'
                  }`}>
                    {(isWaitingApproval || order.status === 'ON_HOLD') && <AlertCircle size={7} />}
                    {order.status === 'ON_HOLD' ? t('Hold') : t(currentStage?.stageName)}
                  </span>
                  {!isWaitingApproval && order.status !== 'PENDING' && order.status !== 'REJECTED' && order.status !== 'ON_HOLD' && ['OUTLET'].includes(userRole) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tighter border flex items-center gap-0.5" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' }}>
                      <Lock size={7} />
                    </span>
                  )}
                  {(() => {
                    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID';
                    const hasAdvance = parseFloat(order.advanceAmount || 0) > 0;
                    const remainingAmt = Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0));
                    if (isPaid) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tighter badge-success">PAID</span>;
                    if (hasAdvance) return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tighter badge-warning">REMAINING COD: ₨{remainingAmt.toLocaleString()}</span>;
                    return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-tighter badge-danger">CASH ON DELIVERY</span>;
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {order.customerPhone && (
                    <span className="text-xs md:text-sm font-medium flex items-center gap-1" style={{ color: '#94a3b8' }}>
                      <Phone size={8} style={{ color: '#f43f5e' }} /> 
                      <span className="font-mono">{order.customerPhone}</span>
                    </span>
                  )}
                  {order.totalPrice > 0 && (
                    <span className={`text-xs md:text-sm font-bold flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${showPrice ? 'badge-success' : 'badge-neutral'}`}>
                      {showPrice ? <><span>₨</span><span>{order.totalPrice.toLocaleString()}</span></> : '★ ★ ★'}
                    </span>
                  )}
                </div>
                <p className="text-[9px] md:text-[10px] font-bold uppercase mt-0.5 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                  <Users size={7} style={{ color: '#f43f5e' }} />
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
                {deadlineStatus === 'ON_TIME' && <span className="text-[6px] px-1 py-0.5 rounded-sm font-bold uppercase badge-success">ON TIME</span>}
                {deadlineStatus === 'APPROACHING' && <span className="text-[6px] px-1 py-0.5 rounded-sm font-bold uppercase badge-warning">APPROACHING</span>}
                {deadlineStatus === 'OVERDUE' && <span className="text-[6px] px-1 py-0.5 rounded-sm font-bold uppercase animate-pulse badge-danger">OVERDUE</span>}
                {deadlineStatus === 'COMPLETED' && <span className="text-[6px] px-1 py-0.5 rounded-sm font-bold uppercase badge-neutral">COMPLETED</span>}
              </div>
              <span className="text-[6px] font-mono" style={{ color: '#94a3b8' }}>
                {currentStage?.deadlineAt ? new Date(currentStage.deadlineAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </span>
              {isCurrentlyInProduction && productionDeadline && (
                <div className={`text-[6px] font-mono ${new Date(productionDeadline).getTime() < Date.now() ? 'text-red-500' : 'text-emerald-600'}`}>
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
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider text-right" style={{ background: '#fffbeb', color: '#d97706' }}>
                  📍 {order.city}
                </span>
              )}
              {order.address && (
                <span className="text-[9px] font-medium truncate max-w-[90px] md:max-w-[140px] text-right" title={order.address} style={{ color: '#94a3b8' }}>
                  {order.address}
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                style={{ color: '#94a3b8' }}
              >
                <ChevronRight size={10} />
              </motion.div>
              {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`⚠ PERMANENTLY DELETE this order?\n\nOrder #${order.orderNumber || order.id.substring(0, 8)}\nCustomer: ${order.customerName}\n\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                      api.delete(`/api/orders/${order.id}`).then(() => {
                        toast.success('Order deleted permanently. Inventory restored.');
                      }).catch(err => {
                        alert(err.response?.data?.message || 'Failed to delete order');
                      });
                    }
                  }}
                  className="p-1 rounded-lg transition-all border mt-0.5" style={{ background: '#fef2f2', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                  title="Delete order permanently"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <>

          {/* Product Details Strip */}
          {(product?.color || product?.size || product?.fabricType || product?.productType || order.quantity > 0 || order.customizationPrice > 0 || order.logoCharges > 0 || order.namePrintingCharges > 0) && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 p-2 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              {product?.productType && (
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md truncate max-w-[100px]" style={{ background: '#f1f5f9', color: '#64748b' }}>{product.productType}</span>
              )}
              {product?.fabricType && (
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md truncate max-w-[100px]" style={{ background: '#f1f5f9', color: '#64748b' }}>{product.fabricType}</span>
              )}
              {product?.color && (
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[100px]" style={{ background: '#f1f5f9', color: '#0f172a' }}>
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: product.color.toLowerCase() }}></span>
                  {product.color}
                </span>
              )}
              {product?.size && (
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-md" style={{ background: '#f1f5f9', color: '#64748b' }}>Size: {product.size}</span>
              )}
              {(product?.fabricSourceProduct || product?.colorSourceProduct || product?.designSourceProduct || product?.sizeSourceProduct || product?.additionalProductRef) && (
                <>
                  {product?.fabricSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[100px]">F:{product.fabricSourceProduct}</span>}
                  {product?.colorSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[100px]">C:{product.colorSourceProduct}</span>}
                  {product?.designSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[100px]">D:{product.designSourceProduct}</span>}
                  {product?.sizeSourceProduct && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[100px]">S:{product.sizeSourceProduct}</span>}
                  {product?.additionalProductRef && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 truncate max-w-[100px]">E:{product.additionalProductRef}</span>}
                </>
              )}
              <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#eef2ff', color: '#6366f1' }}>Qty: {order.quantity || 1}</span>
              {order.logoCharges > 0 && (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#fffbeb', color: '#d97706' }}>Logo: {showPrice ? `₨${Number(order.logoCharges).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.namePrintingCharges > 0 && (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#faf5ff', color: '#7c3aed' }}>Name: {showPrice ? `₨${Number(order.namePrintingCharges).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.customizationPrice > 0 && (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#ecfdf5', color: '#059669' }}>Custom: {showPrice ? `₨${Number(order.customizationPrice).toLocaleString()}` : '★ ★ ★'}</span>
              )}
              {order.paymentStatus === 'PAID' && (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md badge-success">PAID</span>
              )}
              {order.courierDetails?.payments?.length > 0 && (
                <span className="text-[6px] md:text-[9px] font-bold" style={{ color: '#94a3b8' }}>
                  {showPrice ? `₨${order.courierDetails.payments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} / ₨${(order.totalPrice || 0).toLocaleString()}` : '★ ★ ★'}
                </span>
              )}
              {order.deliveryType && (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md uppercase truncate max-w-[120px]" style={{ background: '#faf5ff', color: '#7c3aed' }}>{order.deliveryType.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}
          {/* Dispatch Order Details */}
          {currentStage?.stageName === 'DISPATCH' && (
            <div className="mb-3 rounded-2xl border overflow-hidden" style={{ background: '#f8fafc', borderColor: 'rgba(6,182,212,0.5)' }}>
              <div className="p-3 md:p-4 space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2" style={{ color: '#06b6d4' }}>
                  <Package size={12} /> Order Details — Dispatch Verification
                </h4>
                {isMultiItem && orderItems?.length > 0 ? (
                  orderItems.map((item, idx) => {
                    const p = item.productDetails || item;
                    const ic = item.customization ? parseJSON(item.customization) : custom;
                    const isz = item.sizeData ? parseJSON(item.sizeData) : sizes;
                    const slip = { 'full':'Full','half':'Half','three-quarter':'3 Quarter' };
                    const shmp = { 'long':'Long','short':'Short','regular':'Regular' };
                    const fsl = { 'full':'Full','half':'Half','medium':'Medium' };
                    const fsh = { 'long':'Long','short':'Short' };
                    const slv = p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves ? p.femaleOptions.sleeves : null);
                    const shl = p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength ? p.femaleOptions.shirtLength : null);
                    return (
                      <div key={idx} className="border rounded-xl p-2.5 space-y-2" style={{ borderColor: '#e2e8f0', background: '#ffffff' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{ color: '#06b6d4' }}>#{idx + 1} {p.productType || 'Product'}</span>
                          <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Qty: {item.quantity || 1}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {p.category && <div><span style={{ color: '#94a3b8' }}>Category:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{p.category}</span></div>}
                          {p.color && <div><span style={{ color: '#94a3b8' }}>Color:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{p.color}</span></div>}
                          {p.size && <div><span style={{ color: '#94a3b8' }}>Size:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{p.size}</span></div>}
                          {p.fabricType && <div><span style={{ color: '#94a3b8' }}>Fabric:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{p.fabricType}</span></div>}
                          {p.gender && <div><span style={{ color: '#94a3b8' }}>Gender:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{p.gender}</span></div>}
                        </div>
                        {(slv || shl || ic?.fitType) && (
                          <div className="flex flex-wrap gap-1">
                            {slv && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-info">{slip[slv] || fsl[slv] || slv}</span>}
                            {shl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-info">{shmp[shl] || fsh[shl] || shl}</span>}
                            {ic?.fitType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#faf5ff', color: '#7c3aed' }}>{ic.fitType} Fit</span>}
                          </div>
                        )}
                        {order.type === 'FULL_CUSTOM' && p.size && (
                          <div>
                            <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Size</span>
                            <span className="text-[10px] font-bold ml-1 px-2 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#0f172a' }}>{p.size}</span>
                            {isz?.specialNote && <p className="text-[9px] italic mt-1" style={{ color: '#d97706' }}>Note: {isz.specialNote}</p>}
                          </div>
                        )}
                        {ic && !ic.skipEngraving && (ic.engravingType || ic.nameSpelling || ic.articleNames?.length > 0 || ic.logos?.length > 0 || ic.designNotes || ic.nameColor || ic.logoPlacement) && (
                          <div className="border-t pt-2 space-y-1" style={{ borderColor: '#e2e8f0' }}>
                            {(ic.engravingType || ic.nameSpelling || ic.articleNames?.length > 0) && (
                              <div>
                                <span className="text-[9px] font-bold uppercase" style={{ color: '#d97706' }}>Engraving</span>
                                {ic.engravingType && <span className="text-[9px] font-bold ml-2" style={{ color: '#b45309' }}>{ic.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                                {ic.articleNames?.length > 0 ? ic.articleNames.map((n, ai) => (
                                  <p key={ai} className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>L{ai + 1}: {n}</p>
                                )) : ic.nameSpelling && <p className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>{ic.nameSpelling}</p>}
                              </div>
                            )}
                            {ic.logos?.length > 0 && (
                              <div><span className="text-[9px] font-bold uppercase" style={{ color: '#d97706' }}>Logos</span>{ic.logos.map((l, li) => (
                                <p key={li} className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>{l.name}{l.design ? ` — ${l.design}` : ''}</p>
                              ))}</div>
                            )}
                            {ic.designNotes && <p className="text-[9px] italic" style={{ color: '#d97706' }}>Note: {ic.designNotes}</p>}
                            {(ic.nameColor || ic.logoPlacement) && (
                              <div className="flex gap-1">
                                {ic.nameColor && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fdf2f8', color: '#db2777' }}>Color: {ic.nameColor}</span>}
                                {ic.logoPlacement && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#ccfbf1', color: '#0d9488' }}>Pos: {ic.logoPlacement}</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border rounded-xl p-2.5 space-y-2" style={{ borderColor: '#e2e8f0', background: '#ffffff' }}>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      {product?.productType && <div><span style={{ color: '#94a3b8' }}>Product:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.productType}</span></div>}
                      {product?.category && <div><span style={{ color: '#94a3b8' }}>Category:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.category}</span></div>}
                      {product?.color && <div><span style={{ color: '#94a3b8' }}>Color:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.color}</span></div>}
                      {product?.size && <div><span style={{ color: '#94a3b8' }}>Size:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.size}</span></div>}
                      {product?.fabricType && <div><span style={{ color: '#94a3b8' }}>Fabric:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.fabricType}</span></div>}
                      {product?.gender && <div><span style={{ color: '#94a3b8' }}>Gender:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{product.gender}</span></div>}
                      <div><span style={{ color: '#94a3b8' }}>Qty:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.quantity || 1}</span></div>
                      <div><span style={{ color: '#94a3b8' }}>Type:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.type || 'STANDARD'}</span></div>
                    </div>
                    {(() => {
                      const slip = { 'full':'Full','half':'Half','three-quarter':'3 Quarter' };
                      const shmp = { 'long':'Long','short':'Short','regular':'Regular' };
                      const fsl = { 'full':'Full','half':'Half','medium':'Medium' };
                      const fsh = { 'long':'Long','short':'Short' };
                      const slv = product?.sleeveLength || (product?.gender === 'Female' && product?.femaleOptions?.sleeves ? product.femaleOptions.sleeves : null);
                      const shl = product?.shirtLength || (product?.gender === 'Female' && product?.femaleOptions?.shirtLength ? product.femaleOptions.shirtLength : null);
                      const hasCustom = slv || shl || custom?.fitType;
                      return hasCustom ? (
                        <div className="flex flex-wrap gap-1">
                          {slv && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-info">{slip[slv] || fsl[slv] || slv}</span>}
                          {shl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded badge-info">{shmp[shl] || fsh[shl] || shl}</span>}
                          {custom?.fitType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#faf5ff', color: '#7c3aed' }}>{custom.fitType} Fit</span>}
                        </div>
                      ) : null;
                    })()}
                    {order.type === 'FULL_CUSTOM' && product?.size && (
                      <div>
                        <span className="text-[9px] font-bold uppercase" style={{ color: '#64748b' }}>Size</span>
                        <span className="text-[10px] font-bold ml-1 px-2 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#0f172a' }}>{product.size}</span>
                        {sizes?.specialNote && <p className="text-[9px] italic mt-1" style={{ color: '#d97706' }}>Note: {sizes.specialNote}</p>}
                      </div>
                    )}
                    {custom && !custom.skipEngraving && (custom.engravingType || custom.nameSpelling || custom.articleNames?.length > 0 || custom.logos?.length > 0 || custom.designNotes || custom.nameColor || custom.logoPlacement) && (
                      <div className="border-t pt-2 space-y-1" style={{ borderColor: '#e2e8f0' }}>
                        {(custom.engravingType || custom.nameSpelling || custom.articleNames?.length > 0) && (
                          <div>
                            <span className="text-[9px] font-bold uppercase" style={{ color: '#d97706' }}>Engraving</span>
                            {custom.engravingType && <span className="text-[9px] font-bold ml-2" style={{ color: '#b45309' }}>{custom.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                            {custom.articleNames?.length > 0 ? custom.articleNames.map((n, ai) => (
                              <p key={ai} className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>L{ai + 1}: {n}</p>
                            )) : custom.nameSpelling && <p className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>{custom.nameSpelling}</p>}
                          </div>
                        )}
                        {custom.logos?.length > 0 && (
                          <div><span className="text-[9px] font-bold uppercase" style={{ color: '#d97706' }}>Logos</span>{custom.logos.map((l, li) => (
                            <p key={li} className="text-[10px] font-bold ml-2" style={{ color: '#0f172a' }}>{l.name}{l.design ? ` — ${l.design}` : ''}</p>
                          ))}</div>
                        )}
                        {custom.designNotes && <p className="text-[9px] italic" style={{ color: '#d97706' }}>Note: {custom.designNotes}</p>}
                        {(custom.nameColor || custom.logoPlacement) && (
                          <div className="flex gap-1">
                            {custom.nameColor && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#fdf2f8', color: '#db2777' }}>Color: {custom.nameColor}</span>}
                            {custom.logoPlacement && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#ccfbf1', color: '#0d9488' }}>Pos: {custom.logoPlacement}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Customer & Order Info */}
                <div className="border rounded-xl p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]" style={{ borderColor: '#e2e8f0', background: '#ffffff' }}>
                  <div><span style={{ color: '#94a3b8' }}>Customer:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.customerName || '—'}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Phone:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.customerPhone || '—'}</span></div>
                  {order.address && <div className="col-span-2"><span style={{ color: '#94a3b8' }}>Address:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.address}</span></div>}
                  {order.city && <div><span style={{ color: '#94a3b8' }}>City:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.city}</span></div>}
                  <div><span style={{ color: '#94a3b8' }}>Order #:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.orderNumber || order.id?.slice(0, 8)}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Order Type:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.type || 'STANDARD'}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Priority:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.priority || 'NORMAL'}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Source:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.outletName || order.source || '—'}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Payment:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.paymentStatus === 'PAID' ? 'PAID' : parseFloat(order.advanceAmount || 0) > 0 ? `Advance: ₨${parseFloat(order.advanceAmount).toLocaleString()}` : 'COD'}</span></div>
                  <div><span style={{ color: '#94a3b8' }}>Date:</span> <span className="font-bold" style={{ color: '#0f172a' }}>{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}</span></div>
                </div>
              </div>
            </div>
          )}
          {/* Collapsible Job Sheet Summary */}
          <div className="mb-3 rounded-2xl border overflow-hidden" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <button
              onClick={() => setShowJobSheet((prev) => !prev)}
              className="w-full flex items-center justify-between p-3 md:p-4 transition-colors" style={{ background: '#ffffff' }}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: '#fef2f2' }}>
                  <ClipboardList size={14} style={{ color: '#f43f5e' }} />
                </div>
                <span className="text-xs md:text-sm font-bold uppercase tracking-[0.15em]" style={{ color: '#64748b' }}>{t('Job Sheet Summary')}</span>
              </div>
              <div className="flex items-center gap-2">
                {!showJobSheet && (
                  <span className="text-[6px] font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>{t('Tap to View')}</span>
                )}
                <motion.div animate={{ rotate: showJobSheet ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={12} style={{ color: '#94a3b8' }} />
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
                          <div className={`p-2.5 rounded-xl border ${currentStage.rejectionReason.includes('Available') ? 'bg-emerald-50 border-emerald-200' : currentStage.rejectionReason.includes('PROBLEM') ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                            <p className={`text-xs md:text-sm font-bold uppercase tracking-widest mb-0.5 ${currentStage.rejectionReason.includes('Available') ? 'text-emerald-600' : currentStage.rejectionReason.includes('PROBLEM') ? 'text-amber-600' : 'text-red-600'}`}>
                              {currentStage.rejectionReason.includes('Inventory') ? 'Store Inventory Check:' : currentStage.rejectionReason.includes('PROBLEM') ? 'Worker Reported Problem:' : (order.source === 'OUTLET' ? 'Branch Rejection Reason:' : 'Faisal Rejection Reason:')}
                            </p>
                            <p className="text-xs md:text-sm italic leading-tight line-clamp-2" style={{ color: '#78716c' }}>{currentStage.rejectionReason.replace('PROBLEM:', '')}</p>
                          </div>
                        );
                      })()
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFullSheet(true); }}
                      className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#f43f5e' }}
                    >
                      {t('View Full Job Sheet')} →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsible Order Tracking (full timeline + routing) */}
          {order.stages?.length > 0 && (
            <div className="mb-3 rounded-2xl border overflow-hidden" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <button
                onClick={() => setShowProdHistory((prev) => !prev)}
                className="w-full flex items-center justify-between p-3 md:p-4 transition-colors" style={{ background: '#ffffff' }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ background: '#ecfeff' }}>
                    <Clock size={14} style={{ color: '#06b6d4' }} />
                  </div>
                  <span className="text-xs md:text-sm font-bold uppercase tracking-[0.15em]" style={{ color: '#64748b' }}>{t('Order Tracking')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[6px] font-bold" style={{ color: '#94a3b8' }}>{order.stages.length} stages</span>
                  <motion.div animate={{ rotate: showProdHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight size={12} style={{ color: '#94a3b8' }} />
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
                        {[...order.stages]
                          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                          .map((s, idx) => {
                            const dotColor = s.status === 'COMPLETED' ? '#10b981' : s.status === 'IN_PROGRESS' ? '#f43f5e' : '#94a3b8';
                            const fmt = (d) => d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
                            const delay = s.startedAt ? Math.round((new Date(s.startedAt) - new Date(s.createdAt)) / 60000) : null;
                            return (
                              <div key={s.id || idx} className="flex items-start gap-2.5">
                                <div className="flex flex-col items-center pt-0.5">
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }}></div>
                                  {idx < order.stages.length - 1 && (
                                    <div className="w-[1px] h-3.5" style={{ background: '#e2e8f0' }}></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap justify-between items-center gap-1">
                                    <span className="text-xs md:text-sm font-semibold uppercase tracking-tighter" style={{ color: '#64748b' }}>
                                      {s.stageName.replace(/_/g, ' ')}
                                    </span>
                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                      s.status === 'COMPLETED' ? 'badge-success' :
                                      s.status === 'IN_PROGRESS' ? 'badge-primary' :
                                      'badge-neutral'
                                    }`}>{s.status.replace(/_/g, ' ')}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] font-medium" style={{ color: '#94a3b8' }}>
                                    <span>Received: {fmt(s.createdAt)}</span>
                                    {s.startedAt && <span>Accepted: {fmt(s.startedAt)}</span>}
                                    {s.completedAt && <span>Completed: {fmt(s.completedAt)}</span>}
                                    {delay !== null && (
                                      <span className={delay > 60 ? 'text-red-500' : delay > 0 ? 'text-amber-500' : ''}>
                                        Delay: {delay} min
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      <button
                        onClick={() => { setShowTimelineModal(true); }}
                        className="mt-3 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5" style={{ background: '#f1f5f9', color: '#06b6d4' }}
                      >
                        <Clock size={12} />
                        View Full Timeline
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
            </>
          )}
        </AnimatePresence>

          <div className="flex flex-col gap-2 w-full">
            {isUnseen && !isAdmin ? (
              <button
                onClick={() => withActionLoading('accept', async () => {
                  try {
                                  await api.post(`/api/orders/${order.id}/accept-task`, {});
                    if (onMarkSeen) await onMarkSeen();
                    toast.success('Task accepted!');
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to accept task');
                  }
                })}
                disabled={!!actionLoading}
                className={`w-full text-white py-3 md:py-4 rounded-2xl text-xs md:text-xs font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl border ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.25)', borderColor: 'rgba(244,63,94,0.2)' }}
              >
                {actionLoading === 'accept' ? (
                  <LoadingSpinner size={16} text="Accepting..." />
                ) : (
                  <><CheckCircle size={14} className="text-rose-200" /><span>📥 ACCEPT TASK & START WORK</span></>
                )}
              </button>
            ) : isUnseen && isAdmin && currentStage?.stageName === 'STORE' ? (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#d97706' }}>
                  Move Order To
                  <span className="px-1 py-0.5 rounded text-[9px] tracking-wider" style={{ background: '#fffbeb', color: '#d97706' }}>MANUAL</span>
                </label>
                <select
                  className="w-full rounded-xl py-3 px-3 outline-none border-2 transition-all text-xs font-bold appearance-none"
                  style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
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
                  <option disabled className="text-gray-400">──────────</option>
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
                                      await api.post(`/api/orders/${order.id}/route`, {
                        destinationStage: nextStage,
                        remarks: `Routed by ${userRole} via Move To dropdown`
                      });
                      toast.success(`Order moved to ${nextStage.replace(/_/g, ' ')}`);
                      if (onMarkSeen) onMarkSeen();
                    } catch (err) {
                      alert('Route failed: ' + (err.response?.data?.message || err.message));
                    }
                  })}
                  disabled={!!actionLoading}
                  className={`w-full py-2.5 text-white rounded-xl text-xs md:text-sm font-bold uppercase tracking-widest transition-all active:scale-95 ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}
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
                className={`w-full text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 border ${actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ background: 'linear-gradient(135deg, #64748b, #475569)', borderColor: 'rgba(100,116,139,0.3)' }}
              >
                {actionLoading === 'view' ? <LoadingSpinner size={14} text="Loading..." /> : <><CheckCircle size={14} /><span>VIEW ORDER</span></>}
              </button>
            ) : isFaisal && order.status === 'ON_HOLD' ? (
              <ActionBtn name="resume" onClick={() => handleHoldAction(true)}
                className="w-full text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.2)' }}
              >
                <RefreshCcw size={14} />
                <span>RESUME ORDER</span>
              </ActionBtn>
            ) : isFaisal && (order.status === 'WAITING_APPROVAL' || order.status === 'PENDING') && currentStage?.status === 'COMPLETED' ? (
              <ActionBtn name="initiate" onClick={() => setShowApprovalDialog(true)}
                className="w-full text-white py-3 md:py-4 rounded-2xl text-xs md:text-sm font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}
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
                      className={`py-2.5 md:py-3 px-2 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95 border ${
                        order.status === 'ON_HOLD' 
                          ? 'text-emerald-600 border-emerald-200' 
                          : 'text-orange-600 border-orange-200'
                      }`}
                      style={order.status === 'ON_HOLD' ? { background: '#ecfdf5' } : { background: '#fffbeb' }}
                    >
                      <Clock size={14} />
                      <span>{order.status === 'ON_HOLD' ? 'RESUME' : t('Hold')}</span>
                    </ActionBtn>
                    {(order.paymentStatus !== 'PAID' && order.paymentStatus !== 'FULL_PAID' || ['SUPER_ADMIN', 'ADMIN'].includes(userRole)) && (
                      <div className="relative">
                        <ActionBtn name="more" onClick={() => setShowMoreActions(!showMoreActions)}
                          className="w-full py-2.5 md:py-3 px-1 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider transition-all border flex flex-col items-center justify-center gap-0.5 active:scale-95"
                          style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}
                        >
                          <span className="text-base leading-none">⋮</span>
                          <span>MORE</span>
                        </ActionBtn>
                        {showMoreActions && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowMoreActions(false)} />
                            <div className="absolute bottom-full right-0 z-40 mb-2 rounded-xl shadow-2xl overflow-hidden min-w-[170px]" style={{ background: '#ffffff', border: '1px solid #f1f5f9' }}>
                              {(order.paymentStatus !== 'PAID' && order.paymentStatus !== 'FULL_PAID') && (
                                <button
                                  onClick={() => { setShowMoreActions(false); setShowPaymentModal(true); setPaymentAmount(''); setPaymentMethod('CASH'); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b transition-all" style={{ color: '#d97706', borderColor: '#f1f5f9' }}
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
                                      if (destUpper === 'LOGO') destUpper = 'LOGO_DESIGN';
                                      const valid = ['STORE', 'WORKERS', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY', 'ORDER_ENTRY'];
                                      if (valid.includes(destUpper)) {
                                        try {
                                                                              await api.post(`/api/orders/${order.id}/route`, {
                                            destinationStage: destUpper,
                                            remarks: `Manual route from OrderCard by ${userRole}`
                                          });
                                          toast.success(`Order routed to ${destUpper.replace(/_/g, ' ')}`);
                                        } catch (err) {
                                          alert('Route failed: ' + (err.response?.data?.message || err.message));
                                        }
                                      } else {
                                        alert('Invalid destination. Valid: STORE, LOGO_DESIGN, PRODUCTION_ACCEPTANCE, PRODUCTION, STORE_RECEIVE, DISPATCH, OUT_FOR_DELIVERY, ORDER_ENTRY');
                                      }
                                    }
                                  }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b transition-all" style={{ color: '#f43f5e', borderColor: '#f1f5f9' }}
                              >
                                <Package size={14} />
                                <span>Route Order To...</span>
                              </button>
                              <button
                                onClick={() => { setShowMoreActions(false); setShowTimelineModal(true); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b transition-all" style={{ color: '#06b6d4', borderColor: '#f1f5f9' }}
                              >
                                <Clock size={14} />
                                <span>Timeline</span>
                              </button>
                              <button
                                onClick={async () => {
                                  setShowMoreActions(false);
                                  try {
                                                                    const res = await api.get(`/api/orders/${order.id}/routing-history`);
                                    const history = res.data;
                                    const historyStr = history.map((h, i) =>
                                      `${i + 1}. ${h.previousStage} → ${h.newStage} by ${h.sentBy || 'System'} (${new Date(h.createdAt).toLocaleString()})${h.remarks ? ': ' + h.remarks : ''}`
                                    ).join('\n');
                                    alert(historyStr || 'No routing history found for this order.');
                                  } catch (err) {
                                    alert('Error fetching routing history');
                                  }
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b transition-all" style={{ color: '#7c3aed', borderColor: '#f1f5f9' }}
                              >
                                <History size={14} />
                                <span>Routing History</span>
                              </button>
                              {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                                <button
                                  onClick={() => {
                                    setShowMoreActions(false);
                                    if (window.confirm(`⚠ PERMANENTLY DELETE this order?\n\nOrder #${order.orderNumber || order.id.substring(0, 8)}\nCustomer: ${order.customerName}\n\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                                      api.delete(`/api/orders/${order.id}`).then(() => {
                                        toast.success('Order deleted permanently. Inventory restored.');
                                      }).catch(err => {
                                        alert(err.response?.data?.message || 'Failed to delete order');
                                      });
                                    }
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-all" style={{ color: '#ef4444' }}
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
                <div className="flex-1 py-4 rounded-2xl text-xs md:text-sm font-bold uppercase text-center border italic" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' }}>
                  {t('Waiting for')} {order.source === 'OUTLET' ? t('Branch') : t('Faisal')} {t('Approval')}...
                </div>
              )
            ) : (
              !isFaisal && (
                currentStage?.status === 'COMPLETED' ? (
                  <div className="w-full p-4 rounded-2xl border" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                    <p className="text-xs md:text-sm font-bold uppercase tracking-widest mb-1" style={{ color: '#64748b' }}>Task Already Completed</p>
                    <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>This task was completed by another user. You can route it forward if needed.</p>
                    <div className="space-y-2">
                      <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}
                        className="w-full rounded-xl py-2.5 px-3 outline-none border-2 transition-all text-xs font-bold appearance-none"
                        style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}>
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
                          className="flex-1 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
                        >
                          Route Forward
                        </button>
                        <button onClick={() => onUpdateStage(order.id, currentStage.id, 'request', {})}
                          className="px-4 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        >
                          Re-request
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  currentStage?.stageName === 'STORE' ? (
                  <>
                    <div className="w-full mb-2 space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: '#f43f5e' }}>
                        Route Order To
                        <span className="px-1 py-0.5 rounded text-[9px] tracking-wider" style={{ background: '#fef2f2', color: '#f43f5e' }}>MANUAL</span>
                      </label>
                      <select
                        className="w-full rounded-xl py-2.5 px-3 outline-none border-2 transition-all text-xs font-bold appearance-none"
                        style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                        value={nextStage}
                        onChange={(e) => setNextStage(e.target.value)}
                      >
                        <option value="">Auto-route (default)</option>
                        <option value="PRODUCTION">Send to Production</option>
                        <option value="LOGO_DESIGN">Send to Logo Design</option>
                        <option value="WORKERS">Send to Workers</option>
                        <option value="DISPATCH">Send to Dispatch</option>
                        <option disabled className="text-gray-400">─ Return to Source ─</option>
                        {(!order.source || order.source === 'ONLINE') && <option value="RETURN_ONLINE">Send back to Online</option>}
                        {(!order.source || order.source === 'OUTLET') && <option value="RETURN_OUTLET">Send back to Outlet</option>}
                        <option disabled className="border-t border-gray-200">──────────</option>
                        <option value="HOLD">Hold / Pending</option>
                        <option value="NOT_AVAILABLE">Mark as Not Available</option>
                        <option value="REJECT">Reject Order</option>
                      </select>
                    </div>
                    {invCheckLoading ? (
                      <div className="w-full p-4 rounded-2xl border flex items-center justify-center space-x-3" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <RefreshCcw className="animate-spin" size={16} style={{ color: '#f43f5e' }} />
                        <span className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Checking inventory...</span>
                      </div>
                    ) : invCheck && invCheck.report ? (
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>Inventory Availability</span>
                          <button onClick={() => setInvCheckExpanded(!invCheckExpanded)} className="text-xs md:text-sm font-bold uppercase tracking-widest" style={{ color: '#f43f5e' }}>
                            {invCheckExpanded ? 'Collapse' : 'Details'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase border badge-success">
                            {invCheck.summary.available} Available
                          </span>
                          {invCheck.summary.insufficient > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase border badge-warning">
                              {invCheck.summary.insufficient} Low Stock
                            </span>
                          )}
                          {invCheck.summary.outOfStock > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs md:text-sm font-bold uppercase border badge-danger">
                              {invCheck.summary.outOfStock} Out of Stock
                            </span>
                          )}
                        </div>
                        {invCheckExpanded && (
                          <div className="space-y-1">
                            {invCheck.report.filter(r => r.status !== 'available').map((r, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-lg border" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                                <span className="text-[10px] font-semibold" style={{ color: '#c2410c' }}>{r.productType} / {r.color || '—'} / {r.size || '—'}</span>
                                <span className="text-[10px] font-bold" style={{ color: '#ea580c' }}>{r.available} / {r.required}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                    &nbsp;
                  </>
                ) : (
                  <div className="flex-1 py-4 rounded-2xl text-xs md:text-sm font-bold uppercase text-center border" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' }}>
                    {t('Waiting for Task')}...
                  </div>
                )
              )
            )
          )}
          </div>
        </div>
      </motion.div>

      {/* Full Sheet Modal */}
      <AnimatePresence>
        {showFullSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowFullSheet(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl" style={{ background: '#ffffff', borderColor: '#f1f5f9' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ color: '#0f172a', fontFamily: "'Poppins', sans-serif" }}>Job Sheet</h2>
                <button onClick={() => setShowFullSheet(false)} className="p-2 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}><X size={16} /></button>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold" style={{ color: '#64748b' }}>Order #{order.orderNumber}</p>
                <p className="text-sm font-bold" style={{ color: '#0f172a' }}>{order.customerName}</p>
              </div>
              <div className="space-y-3">
                {(() => {
                  try {
                    const pd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                    const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
                    return items.map((item, i) => {
                      const p = item.productDetails || item;
                      return (
                        <div key={i} className="p-3 rounded-xl border" style={{ background: '#f8fafc', borderColor: '#f1f5f9' }}>
                          <p className="text-sm font-bold" style={{ color: '#0f172a' }}>{p.productType || 'Item'}</p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs" style={{ color: '#64748b' }}>
                            <span>Fabric: <strong style={{ color: '#0f172a' }}>{p.fabricType || '—'}</strong></span>
                            <span>Color: <strong style={{ color: '#0f172a' }}>{p.color || '—'}</strong></span>
                            <span>Size: <strong style={{ color: '#0f172a' }}>{p.size || '—'}</strong></span>
                            <span>Qty: <strong style={{ color: '#0f172a' }}>{item.quantity || 1}</strong></span>
                          </div>
                        </div>
                      );
                    });
                  } catch { return null; }
                })()}
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => { printJobSheet(order); }} className="flex-1 py-2.5 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', boxShadow: '0 4px 15px rgba(244,63,94,0.2)' }}>
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setShowFullSheet(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: '#f1f5f9', color: '#64748b' }}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OrderCard;
