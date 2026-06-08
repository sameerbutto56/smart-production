import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, ChevronRight, AlertCircle, ClipboardList, Check, X, RefreshCcw, MessageSquare, History, Target, Trash2, Truck, Users, Phone, ShieldAlert, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import Button from './Button';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const OrderCard = ({ order, onUpdateStage, userRole, isUnseen = false, onMarkSeen }) => {
  const { t, isUrdu, LanguageToggle } = useLanguage();
  const currentStage = order.stages.find(s => s.status === 'WAITING_APPROVAL') || 
                      order.stages.find(s => s.status === 'ON_HOLD') ||
                      order.stages.find(s => s.status === 'IN_PROGRESS') || 
                      order.stages.find(s => s.status === 'PENDING') || 
                      order.stages[0];

  const isFaisal = ['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY', 'OUTLET'].includes(userRole);
  const [timeLeft, setTimeLeft] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);
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
  const [selectedDeliveryType, setSelectedDeliveryType] = useState('');
  const [showForceModal, setShowForceModal] = useState(false);
  const [forceAction, setForceAction] = useState('FORCE_MOVE');
  const [forceStage, setForceStage] = useState('');
  const [forceHours, setForceHours] = useState('');
  const [forceReason, setForceReason] = useState('');
  const [forceLoading, setForceLoading] = useState(false);
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'FAISAL'].includes(userRole);
  const [invCheck, setInvCheck] = useState(null);
  const [invCheckLoading, setInvCheckLoading] = useState(false);
  const [invCheckExpanded, setInvCheckExpanded] = useState(false);

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
    if (currentStage?.stageName === 'STORE' && order.id) {
      setInvCheckLoading(true);
      const token = sessionStorage.getItem('token');
      axios.get(`${API_URL}/api/orders/${order.id}/inventory-check`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => setInvCheck(res.data))
        .catch(err => console.error('Error checking inventory:', err))
        .finally(() => setInvCheckLoading(false));
    }
  }, [currentStage?.stageName, order.id]);

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

  const pipelines = {
    'STANDARD': ['ORDER_ENTRY', 'STORE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY']
  };

  const currentPipeline = pipelines[order.type] || pipelines['STANDARD'];

  const productionStages = ['PRODUCTION'];
  const productionDeadline = order.productionDeadline || order.stages?.find(s => s.stageName === 'PRODUCTION')?.deadlineAt;
  const isCurrentlyInProduction = productionStages.includes(currentStage?.stageName);

  const renderTasks = () => {
    const stage = currentStage?.stageName;
    if (stage === 'STORE') {
      const items = [
        { label: 'Fabric', val: product?.fabricType },
        { label: 'Color', val: product?.color },
        { label: 'Base', val: product?.productType }
      ];
      return items.map((item, idx) => {
        return (
          <motion.li 
            key={idx}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="text-[9px] md:text-[11px] flex items-center justify-between p-2 bg-gray-900/30 rounded-lg border border-gray-800/20"
          >
            <span className="text-gray-400 font-bold uppercase tracking-tighter">{item.label}: {item.val || 'N/A'}</span>
          </motion.li>
        );
      });
    }

    if (stage === 'PRODUCTION') {
      const custom = parseJSON(order.customization);
      const { primary: product } = normalizeProduct(order.productDetails);
      const female = product?.femaleOptions || {};

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: t('Fabric'), v: product?.fabricType },
              { l: t('Color'), v: product?.color },
              { l: 'Size', v: product?.size }
            ].filter(m => m.v).map((m, i) => (
              <div key={i} className="bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 text-center">
                <p className="text-[7px] text-blue-400 font-black uppercase">{m.l}</p>
                <p className="text-[9px] md:text-[10px] font-black text-white truncate">{m.v}</p>
              </div>
            ))}
          </div>

          <div className="bg-indigo-600/10 p-3 rounded-xl border border-indigo-600/20">
            <p className="text-[8px] text-indigo-400 font-black uppercase tracking-widest mb-2">Production Specs</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Fit</p>
                <p className="text-[9px] md:text-[10px] font-black text-white">{custom?.fitType || 'REGULAR'}</p>
              </div>
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Style</p>
                <p className="text-[9px] md:text-[10px] font-black text-white">{custom?.stitchingStyle || 'STANDARD'}</p>
              </div>
              {product?.gender === 'Female' && (
                <>
                  <div className="bg-gray-950/50 p-2 rounded-lg">
                    <p className="text-[7px] text-gray-500 font-black uppercase">Sleeves</p>
                    <p className="text-[9px] md:text-[10px] font-black text-white">{female.sleeves || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-950/50 p-2 rounded-lg">
                    <p className="text-[7px] text-gray-500 font-black uppercase">Shirt L.</p>
                    <p className="text-[9px] md:text-[10px] font-black text-white">{female.shirtLength || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Measurements</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Chst', v: sizes?.chest },
                { l: 'Shld', v: sizes?.shoulder },
                { l: 'Lnth', v: sizes?.length },
                { l: 'Slve', v: sizes?.sleeve },
                { l: 'Wst', v: sizes?.waist },
                { l: 'Hps', v: sizes?.hips }
              ].filter(s => s.v).map((s, i) => (
                <div key={i} className="text-center p-1 bg-gray-900 rounded border border-gray-800">
                  <p className="text-[7px] text-gray-500 font-bold uppercase">{s.l}</p>
                  <p className="text-[9px] md:text-[10px] font-black text-white">{s.v}"</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 text-center">
             <p className="text-[8px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">Order ID</p>
             <h4 className="text-xl font-black text-white">#{order.orderNumber}</h4>
             <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase mt-1">{order.customerName}</p>
          </div>

          {custom?.designNotes && (
            <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10">
              <p className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mb-1 flex items-center space-x-1">
                <MessageSquare size={10} />
                <span>Design Notes:</span>
              </p>
              <p className="text-[9px] md:text-[11px] text-gray-300 italic font-medium leading-tight">"{custom.designNotes}"</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              GENDER: {product?.gender || 'N/A'}
            </div>
            {female.dupatta && (
              <div className="px-2 py-1 bg-pink-900/20 rounded text-[9px] font-black uppercase tracking-tighter text-pink-400 border border-pink-500/20">
                + DUPATTA
              </div>
            )}
          </div>
        </div>
      );
    }

    const stageMap = {
      'NAME_LOGO': ['Name Embroidery', 'Color Check'],
      'CUSTOM_LOGO': ['Logo Design Apply', 'Custom Pattern'],
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
        className={`glass rounded-3xl overflow-hidden mb-6 ${order.priority === 'SUPER_URGENT' ? 'card-super-urgent border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : order.priority === 'URGENT' ? 'card-urgent' : isDelayed ? 'card-delayed' : 'border border-gray-800'} ${order.status === 'REJECTED' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : order.status === 'ON_HOLD' ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)]' : ''}`}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {order.productImage && (
                <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                  <img src={order.productImage} alt="Product" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <h3 className="font-black text-lg tracking-tighter text-white break-all">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                  {order.priority === 'SUPER_URGENT' && (
                    <span className="bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1">
                      <span>⚡</span> SUPER URGENT
                    </span>
                  )}
                  {order.priority === 'URGENT' && (
                    <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter flex items-center gap-1">
                      <span>⚡</span> URGENT
                    </span>
                  )}
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                    order.type === 'FULL_CUSTOM' ? 'bg-indigo-600' : order.type === 'READY_LOGO' ? 'bg-purple-600' : 'bg-gray-700'
                  }`}>
                    {order.type}
                  </span>
                  {order.deliveryMethod && (
                    <span className="bg-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-1">
                       <Truck size={8} /> {order.deliveryMethod.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-bold tracking-wide truncate">{order.customerName}</p>
                
                {order.customerPhone && (
                  <p className="text-[9px] md:text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                    <Phone size={10} className="text-pink-500/60" /> 
                    <span className="font-mono">{order.customerPhone}</span>
                  </p>
                )}
                
                {order.address && (
                  <p className="text-[9px] md:text-[10px] text-gray-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] md:text-[11px] select-none">📍</span> 
                    <span className="truncate" title={order.address}>{order.address}</span>
                  </p>
                )}

                {order.totalPrice > 0 && (
                  <p className="text-[9px] md:text-[10px] text-emerald-400 font-black flex items-center gap-1.5 mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 w-fit select-none">
                    <span className="text-xs">₨</span>
                    <span>{order.totalPrice.toLocaleString()}</span>
                  </p>
                )}

                <p className="text-[9px] text-gray-500 font-black uppercase mt-1.5 flex items-center gap-1.5">
                  <Users size={10} className="text-blue-500/50" />
                  {t('Placed By')}: <span className="text-gray-400">
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
                  </span>
                </p>
              </div>
            </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest ${order.status === 'ON_HOLD' ? 'bg-orange-500/20 text-orange-400' : isWaitingApproval ? 'bg-orange-500 text-white animate-pulse' : 'bg-blue-500/10 text-blue-400'} border border-current flex items-center gap-1`}>
                  {(isWaitingApproval || order.status === 'ON_HOLD') && <AlertCircle size={8} />}
                  {order.status === 'ON_HOLD' ? t('Hold') : t(currentStage?.stageName)}
                </span>
                {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`⚠ PERMANENTLY DELETE this order?\n\nOrder #${order.orderNumber || order.id.substring(0, 8)}\nCustomer: ${order.customerName}\n\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                        axios.delete(`${API_URL}/api/orders/${order.id}`, {
                          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                        }).then(() => {
                          toast.success('Order deleted permanently. Inventory restored.');
                          window.location.reload();
                        }).catch(err => {
                          alert(err.response?.data?.message || 'Failed to delete order');
                        });
                      }
                    }}
                    className="ml-2 p-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
                    title="Delete order permanently"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
          </div>

          <div className="flex flex-col bg-gray-950/50 p-3 rounded-xl border border-gray-800/50 mb-4 gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded-lg ${isDelayed ? 'bg-red-500/10' : 'bg-gray-800/50'}`}>
                  <Clock size={14} className={isDelayed ? 'text-red-500' : 'text-blue-400'} />
                </div>
                <div className="flex flex-col">
                  <span className={`font-mono text-sm tracking-tighter leading-none ${urgencyColor}`}>
                    {timeLeft}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[7px] text-gray-500 font-black uppercase">{t('Time Left')}</span>
                    {deadlineStatus === 'ON_TIME' && <span className="text-[6px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded-sm font-black uppercase">ON TIME</span>}
                    {deadlineStatus === 'APPROACHING' && <span className="text-[6px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded-sm font-black uppercase">APPROACHING</span>}
                    {deadlineStatus === 'OVERDUE' && <span className="text-[6px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded-sm font-black uppercase animate-pulse">OVERDUE</span>}
                    {deadlineStatus === 'COMPLETED' && <span className="text-[6px] bg-gray-500/10 text-gray-400 px-1 py-0.5 rounded-sm font-black uppercase">COMPLETED</span>}
                  </div>
                </div>
              </div>
              <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest bg-gray-900 px-2 py-0.5 rounded-md">
                {currentStage?.deadlineAt ? new Date(currentStage.deadlineAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NO DEADLINE'}
              </div>
            </div>

            {isCurrentlyInProduction && productionDeadline && (
              <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Target size={12} className="text-emerald-500" />
                  <span className="text-[9px] text-emerald-500 font-black uppercase">Production Goal:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] md:text-[10px] font-black ${new Date(productionDeadline).getTime() < Date.now() ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                    {(() => {
                      const diff = new Date(productionDeadline).getTime() - Date.now();
                      if (diff <= 0) return 'OVERDUE';
                      const h = Math.floor(diff / 3600000);
                      const m = Math.floor((diff % 3600000) / 60000);
                      return `${h}h ${m}m`;
                    })()}
                  </span>
                  <span className="text-[8px] text-gray-500">
                    {new Date(productionDeadline).toLocaleDateString()} {new Date(productionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
          </div>
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFullSheet(true)}
            className="mb-6 p-5 bg-gradient-to-br from-gray-900 to-black rounded-3xl border border-gray-800 hover:border-blue-500/50 transition-all cursor-pointer group shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight size={16} className="text-blue-400" />
            </div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                <ClipboardList size={16} className="text-blue-400" />
              </div>
              <h4 className="text-[9px] md:text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-blue-300 transition-colors">
                {t('Job Sheet Summary')}
              </h4>
            </div>
            <ul className="space-y-3">
              {renderTasks()}
            </ul>
            {currentStage?.rejectionReason && (
              (() => {
                const isOrderProfile = ['ORDER_ENTRY', 'OUTLET'].includes(String(userRole || '').toUpperCase().trim());
                const isInventoryReason = currentStage.rejectionReason.includes('Inventory') || currentStage.rejectionReason.includes('Stock');
                if (isOrderProfile && isInventoryReason) return null;
                
                return (
                  <div className={`mt-4 p-3 rounded-xl border ${currentStage.rejectionReason.includes('Available') ? 'bg-emerald-500/10 border-emerald-500/20' : currentStage.rejectionReason.includes('PROBLEM') ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 ${currentStage.rejectionReason.includes('Available') ? 'text-emerald-400' : currentStage.rejectionReason.includes('PROBLEM') ? 'text-orange-400' : 'text-red-400'}`}>
                      {currentStage.rejectionReason.includes('Inventory') ? 'Store Inventory Check:' : currentStage.rejectionReason.includes('PROBLEM') ? 'Worker Reported Problem:' : (order.source === 'OUTLET' ? 'Branch Rejection Reason:' : 'Faisal Rejection Reason:')}
                    </p>
                    <p className="text-xs text-gray-300 italic">{currentStage.rejectionReason.replace('PROBLEM:', '')}</p>
                  </div>
                );
              })()
            )}
            <div className="mt-5 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t('Click to Expand Job Sheet')}</span>
              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
            </div>
          </motion.div>

          {/* Production Tracking Timeline */}
          {order.stages?.some(s => s.status === 'COMPLETED') && (
            <div className="mb-6 px-4 py-3 bg-gray-950/30 rounded-2xl border border-gray-800/50">
              <h5 className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={10} />
                  {t('Production History')}
                </div>
              </h5>
              <div className="space-y-2 relative">
                {order.stages
                  .filter(s => s.status === 'COMPLETED')
                  .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
                  .map((s, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        {idx !== order.stages.filter(s => s.status === 'COMPLETED').length - 1 && (
                          <div className="w-[1px] h-4 bg-gray-800"></div>
                        )}
                      </div>
                      <div className="flex-1 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {s.stageName.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[8px] text-yellow-500/60">→ {order.source === 'OUTLET' ? t('Branch') : t('Faisal')}</span>
                        </div>
                        <span className="text-[9px] text-gray-600 font-medium">
                          {new Date(s.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} | {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {isUnseen ? (
              <button
                onClick={onMarkSeen}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-blue-900/40 border border-blue-400/20"
              >
                <CheckCircle size={16} className="text-blue-300" />
                <span>📥 ACCEPT TASK & START WORK</span>
              </button>
            ) : isFaisal && order.status === 'ON_HOLD' ? (
              <button
                onClick={() => handleHoldAction(true)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-emerald-900/20"
              >
                <RefreshCcw size={14} />
                <span>RESUME ORDER</span>
              </button>
            ) : isFaisal && (order.status === 'WAITING_APPROVAL' || order.status === 'PENDING') && currentStage?.status === 'COMPLETED' ? (
              <button
                onClick={() => setShowApprovalDialog(true)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-blue-900/20"
              >
                <ChevronRight size={14} />
                <span>{t('Initiate Next Phase')}</span>
              </button>
            ) : isWaitingApproval ? (
              isFaisal ? (
                <>
                  <div className="flex flex-wrap gap-2 w-full mt-2">
                    <button
                      onClick={() => setShowApprovalDialog(true)}
                      className="flex-1 btn-ghost-success rounded-xl py-3 text-[9px] md:text-[10px] flex-col gap-1"
                    >
                      <Check size={16} />
                      <span>{t('Approve')}</span>
                    </button>
                    {(currentStage?.rejectionReason?.includes('Out of Stock') || currentStage?.rejectionReason?.includes('PROBLEM')) ? (
                      <button
                        onClick={() => onUpdateStage(order.id, currentStage.id, 'reject', { reason: 'Problem Resolved - Please Proceed' })}
                        className="flex-1 btn-ghost-warning rounded-xl py-3 text-[9px] md:text-[10px] flex-col gap-1"
                      >
                        <RefreshCcw size={16} />
                        <span>{t('Send Again')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRejectionDialog(true)}
                        className="flex-1 btn-ghost-danger rounded-xl py-3 text-[9px] md:text-[10px] flex-col gap-1"
                      >
                        <X size={16} />
                        <span>{t('Reject')}</span>
                      </button>
                    )}
                    <div className="flex gap-2">

                      <button
                        onClick={() => order.status === 'ON_HOLD' ? handleHoldAction(true) : setShowHoldDialog(true)}
                        className={`flex-1 min-w-[100px] py-3 px-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 border ${
                          order.status === 'ON_HOLD' 
                            ? 'bg-emerald-600/20 text-emerald-500 border-emerald-500/30' 
                            : 'bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white border-orange-500/20'
                        }`}
                        title={order.status === 'ON_HOLD' ? 'Resume Order' : 'Put on Hold'}
                      >
                        <Clock size={16} />
                        <span>{order.status === 'ON_HOLD' ? 'RESUME' : t('Hold')}</span>
                      </button>

                      </div>
                    {order.paymentStatus !== 'FULL_PAID' && (
                      <button
                        onClick={() => {
                          const status = order.paymentStatus === 'PENDING' ? 'ADVANCE_PAID' : 'FULL_PAID';
                          axios.put(`${API_URL}/api/orders/${order.id}/payment`, { paymentStatus: status }, {
                            headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                          }).then(() => {
                          }).catch(err => {
                            console.error('Payment update failed:', err);
                            alert('Payment update failed');
                          });
                        }}
                        className="flex-1 min-w-[100px] py-3 px-2 bg-yellow-600/10 hover:bg-yellow-600 text-yellow-500 hover:text-white rounded-xl transition-all border border-yellow-500/20 active:scale-95 flex flex-col items-center justify-center gap-1"
                        title="Update Payment"
                      >
                        <AlertCircle size={16} />
                        <span className="text-[9px] md:text-[10px] font-black">{t('Pay')}</span>
                      </button>
                    )}
                    {['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
                      <button
                        onClick={() => {
                          if (window.confirm(`⚠ PERMANENTLY DELETE this order?\\n\\nOrder #${order.orderNumber || order.id.substring(0, 8)}\\nCustomer: ${order.customerName}\\n\\nThis will restore inventory and create an audit record. THIS CANNOT BE UNDONE.`)) {
                            axios.delete(`${API_URL}/api/orders/${order.id}`, {
                              headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                            }).then(() => {
                              toast.success('Order deleted permanently. Inventory restored.');
                              window.location.reload();
                            }).catch(err => {
                              alert(err.response?.data?.message || 'Failed to delete order');
                            });
                          }
                        }}
                        className="flex-1 min-w-[100px] py-3 px-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 active:scale-95 flex flex-col items-center justify-center gap-1"
                        title="Delete order permanently"
                      >
                        <Trash2 size={16} />
                        <span className="text-[9px] md:text-[10px] font-black">DELETE</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 bg-gray-800 text-gray-500 py-4 rounded-2xl text-[9px] md:text-[10px] font-black uppercase text-center border border-gray-700 italic">
                  {t('Waiting for')} {order.source === 'OUTLET' ? t('Branch') : t('Faisal')} {t('Approval')}...
                </div>
              )
            ) : (
              !isFaisal && currentStage?.status !== 'COMPLETED' && (
                currentStage?.stageName === 'STORE' ? (
                  <>
                    {/* Inventory Availability Report */}
                    {invCheckLoading ? (
                      <div className="w-full p-4 bg-gray-900/30 rounded-2xl border border-gray-800 flex items-center justify-center space-x-3">
                        <RefreshCcw className="animate-spin text-blue-400" size={16} />
                        <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Checking inventory...</span>
                      </div>
                    ) : invCheck && invCheck.report ? (
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">Inventory Availability</span>
                          <button onClick={() => setInvCheckExpanded(!invCheckExpanded)} className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                            {invCheckExpanded ? 'Collapse' : 'Details'}
                          </button>
                        </div>
                        {/* Summary badges */}
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                            {invCheck.summary.available} Available
                          </span>
                          {invCheck.summary.insufficient > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                              {invCheck.summary.insufficient} Low Stock
                            </span>
                          )}
                          {invCheck.summary.outOfStock > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-red-500/20 bg-red-500/10 text-red-400">
                              {invCheck.summary.outOfStock} Unavailable
                            </span>
                          )}
                        </div>
                        {/* Detailed table */}
                        {invCheckExpanded && (
                          <div className="overflow-x-auto bg-gray-950/50 rounded-xl border border-gray-800">
                            <table className="w-full text-[9px] md:text-[10px]">
                              <thead>
                                <tr className="border-b border-gray-800 text-[8px] font-black text-gray-500 uppercase tracking-widest">
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
                                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
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
                    ) : null}
                    <div className="flex w-full space-x-2">
                      <button
                        onClick={() => {
                          if (window.confirm('Confirm items are IN STOCK and allocate?')) {
                            onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Available' });
                          }
                        }}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                      >
                        <CheckCircle size={14} />
                        <span>Confirm & Allocate</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are items MISSING or OUT OF STOCK?')) {
                            onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Out of Stock' });
                          }
                        }}
                        className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                      >
                        <AlertCircle size={14} />
                        <span>Missing / Unavailable</span>
                      </button>
                    </div>
                  </>
                ) : ['LOGO_DESIGN', 'NAME_LOGO', 'CUSTOM_LOGO'].includes(currentStage?.stageName) ? (
                  <div className="flex w-full space-x-2">
                    <button
                      onClick={() => {
                        const nextIdx = currentPipeline.indexOf(currentStage?.stageName) + 1;
                        const nextStageName = currentPipeline[nextIdx]?.replace(/_/g, ' ') || 'NEXT STAGE';
                        if (window.confirm(`Design complete! Send to ${nextStageName}?`)) {
                          onUpdateStage(order.id, currentStage.id, 'request');
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>Design Complete</span>
                      <span className="text-[7px] text-emerald-200 tracking-widest">→ {(() => { const ni = currentPipeline.indexOf(currentStage?.stageName) + 1; return currentPipeline[ni]?.replace(/_/g, ' ') || 'NEXT'; })()}</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Design Problem</span>
                      <span className="text-[7px] text-red-200 tracking-widest">→ NOTIFY {order.source === 'OUTLET' ? 'BRANCH' : 'FAISAL'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full space-x-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Confirm this stage is fully complete?')) {
                          onUpdateStage(order.id, currentStage.id, 'request');
                        }
                      }}
                      className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                      <CheckCircle size={18} />
                      <span>{(() => {
                        const nextStageIdx = currentPipeline.indexOf(currentStage?.stageName) + 1;
                        const nextStage = currentPipeline[nextStageIdx];
                        if (currentStage?.stageName === 'OUT_FOR_DELIVERY') return t('DELIVERY COMPLETE');
                        return nextStage ? `${t('MOVE TO')} ${t(nextStage.replace(/_/g, ' '))}` : t('COMPLETE TASK');
                      })()}</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-2 border border-red-500/20 active:scale-95"
                    >
                      <AlertCircle size={16} />
                      <span>PROBLEM</span>
                    </button>
                  </div>
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
                      <p className="text-gray-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Sent directly to {order.source === 'OUTLET' ? 'Branch' : 'Faisal'} Control Center</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Describe what's wrong</label>
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
        </div>
        
        <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDelayed ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                  <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {currentStage?.status === 'WAITING_APPROVAL' ? 'Authorization Pending' : 'Current Stage Limit'}
                  </span>
                </div>
                <span className={`text-sm font-black font-mono ${urgencyColor}`}>
                  {timeLeft}
                </span>
              </div>
              <div className="flex gap-1 mt-1">
                {deadlineStatus === 'ON_TIME' && <span className="text-[6px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded-sm font-black uppercase">ON TIME</span>}
                {deadlineStatus === 'APPROACHING' && <span className="text-[6px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded-sm font-black uppercase">APPROACHING</span>}
                {deadlineStatus === 'OVERDUE' && <span className="text-[6px] bg-red-500/10 text-red-400 px-1 py-0.5 rounded-sm font-black uppercase animate-pulse">OVERDUE</span>}
                {deadlineStatus === 'COMPLETED' && <span className="text-[6px] bg-gray-500/10 text-gray-400 px-1 py-0.5 rounded-sm font-black uppercase">COMPLETED</span>}
              </div>

              {isCurrentlyInProduction && productionDeadline && (
                <div className="p-4 bg-indigo-600/5 rounded-2xl border border-indigo-600/10 relative overflow-hidden group/goal">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/goal:opacity-30 transition-opacity">
                    <Target size={32} />
                  </div>
                    <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-2">
                        <Target size={14} className="text-indigo-400" />
                        <span className="text-[9px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Production Goal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] md:text-[10px] font-black font-mono ${new Date(productionDeadline).getTime() < Date.now() ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                          {(() => {
                            const diff = new Date(productionDeadline).getTime() - Date.now();
                            if (diff <= 0) return 'OVERDUE';
                            const h = Math.floor(diff / 3600000);
                            const m = Math.floor((diff % 3600000) / 60000);
                            return `${h}h ${m}m`;
                          })()}
                        </span>
                        <span className="text-[9px] text-gray-500">
                          {new Date(productionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  <div className="mt-2 h-1 bg-gray-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 shadow-[0_0_10px_#4f46e566]"
                    />
                  </div>
                </div>
              )}

              <div className="w-full h-3 bg-gray-950 rounded-full overflow-hidden border border-gray-800 shadow-inner p-[2px]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${Math.max(5, ((currentPipeline.indexOf(currentStage?.stageName) + 1) / currentPipeline.length) * 100)}%`
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${isDelayed ? 'from-red-600 to-orange-500' : 'from-blue-600 to-emerald-500'} shadow-lg relative`}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </motion.div>
              </div>
            </div>
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
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-lg">
                    Full Production Job Sheet
                  </span>
                </div>
                <p className="text-gray-400 font-bold tracking-wide">{order.customerName}</p>
              </div>
              <button 
                onClick={() => setShowFullSheet(false)}
                className="p-4 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-10 custom-scrollbar">
              {userRole !== 'LOGO_DESIGN' && (
                <section>
                  <h4 className="text-[9px] md:text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6">01. Material & Product Specs</h4>
                  {isMultiItem ? (
                    <div className="overflow-x-auto rounded-2xl border border-gray-800">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-gray-800 bg-gray-950/80">
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">#</th>
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">Product</th>
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">Fabric & Color</th>
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest">Size & Gender</th>
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-center">Qty</th>
                            <th className="py-3 px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map((item, idx) => {
                            const p = item.productDetails || item;
                            const hasSleeves = p.femaleOptions?.sleeves && p.femaleOptions.sleeves !== 'full';
                            const hasShirtLength = p.femaleOptions?.shirtLength && p.femaleOptions.shirtLength !== 'long';
                            return (
                              <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
                                <td className="py-4 px-4 text-gray-500 font-black">{idx + 1}</td>
                                <td className="py-4 px-4 text-white font-bold uppercase">{p.productType || '—'}</td>
                                <td className="py-4 px-4">
                                  <div className="text-gray-300 uppercase">
                                    {p.fabricType && (
                                      <>{p.fabricType} • {p.color}</>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-gray-300 uppercase">
                                  <div>{p.size || 'Custom'} • {p.gender || 'MALE'}</div>
                                  {(hasSleeves || hasShirtLength) && (
                                    <div className="text-[9px] text-pink-400 font-black mt-0.5">
                                      {hasSleeves && `Sleeves: ${p.femaleOptions.sleeves}`} {hasShirtLength && `| Length: ${p.femaleOptions.shirtLength}`}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-center text-white font-black">{item.quantity || 1}</td>
                                <td className="py-4 px-4 text-right pr-4 text-emerald-400 font-black">₨{Number(item.totalPrice || 0).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                      {[
                        { label: 'Product Base', val: product?.productType },
                        { label: 'Fabric Type', val: product?.fabricType },
                        { label: 'Primary Color', val: product?.color },
                        { label: 'Order Size', val: product?.size },
                        { label: 'Gender', val: product?.gender },
                        ...(product?.femaleOptions?.dupatta ? [{ label: 'Dupatta', val: 'Included' }] : []),
                        { label: 'Customization Charge', val: `$${order.customizationPrice || 0}` },
                        { label: 'Payment', val: order.paymentStatus }
                      ].filter(i => i.val).map((item, i) => (
                        <div key={i} className="bg-gray-950/50 p-6 rounded-3xl border border-gray-800/50">
                          <p className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{item.label}</p>
                          <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {!isMultiItem && userRole !== 'LOGO_DESIGN' && order.type === 'FULL_CUSTOM' && (
                <section className="bg-blue-600/5 p-4 md:p-8 rounded-xl md:rounded-[2rem] border border-blue-500/10">
                  <h4 className="text-[9px] md:text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">02. Precise Measurements (Inches)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(sizes || {}).map(([key, val], i) => (
                      <div key={i} className="text-center p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm">
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-tighter mb-1">{key}</p>
                        <p className="text-xl font-black text-blue-400">{val}"</p>
                      </div>
                    ))}
                    {product?.gender === 'Female' && product?.femaleOptions?.sleeves && (
                      <div className="text-center p-4 bg-gray-900 rounded-2xl border border-pink-500/20 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter mb-1">SLEEVES</p>
                        <p className="text-sm font-black text-white uppercase">{product.femaleOptions.sleeves}</p>
                      </div>
                    )}
                    {product?.gender === 'Female' && product?.femaleOptions?.shirtLength && (
                      <div className="text-center p-4 bg-gray-900 rounded-2xl border border-pink-500/20 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter mb-1">SHIRT LENGTH</p>
                        <p className="text-sm font-black text-white uppercase">{product.femaleOptions.shirtLength}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                <div>
                  <h4 className="text-[9px] md:text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-6">03. Branding & Tailoring</h4>
                  <div className="space-y-4">
                    {[
                      { l: 'Branding Name', v: custom?.nameSpelling },
                      { l: 'Embroidery Color', v: custom?.nameColor },
                      { l: 'Logo Location', v: custom?.logoPlacement },
                      { l: 'Fit Type', v: custom?.fitType },
                      { l: 'Stitching Style', v: custom?.stitchingStyle }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                        <span className="text-[9px] md:text-[11px] text-gray-500 font-bold uppercase tracking-widest">{item.l}</span>
                        <span className="text-sm font-black text-emerald-400">{item.v || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[9px] md:text-[11px] font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">04. Design Notes & Special Requests</h4>
                  <div className="h-full min-h-[200px] bg-yellow-500/5 p-4 md:p-8 rounded-3xl border border-yellow-500/10 italic text-gray-300 leading-relaxed text-sm shadow-inner">
                    {custom?.designNotes || 'No special design notes provided for this order.'}
                  </div>
                </div>
              </section>
            </div>

            <div className="p-4 md:p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
              <div className="flex flex-wrap items-center space-x-4 text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                <span>Stage: {currentStage?.stageName}</span>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowForceModal(true)}
                    className="bg-red-900/30 hover:bg-red-800/50 text-red-400 px-4 py-3 rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-1.5"
                  >
                    <span className="text-xs">⚡</span> Force
                  </button>
                )}
                <button 
                  onClick={() => setShowFullSheet(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close Job Sheet
                </button>
              </div>
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
            <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center mb-8">Current Stage: {currentStage?.stageName.replace('_', ' ')} Complete</p>
            
            <div className="space-y-6 mb-8">
              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Destination Stage</label>
                <select 
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all text-white font-bold text-sm appearance-none"
                  onChange={(e) => setNextStage(e.target.value)}
                  value={nextStage || ''}
                >
                  <option value="">Select Next Stage...</option>
                  <option value="STORE">Send to STORE</option>
                  <option value="PRODUCTION">Send to PRODUCTION</option>
                  <option value="LOGO_DESIGN">Send to LOGO & NAME DESIGN</option>
                  <option value="DISPATCH">Send to DISPATCH</option>
                  <option value="OUT_FOR_DELIVERY">Send to DELIVERY</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Delivery Method (Optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'TCS', label: 'TCS Courier', icon: '📦' },
                    { value: 'SELF_PICKUP', label: 'Self Pickup', icon: '🏪' },
                    { value: 'ENAMELS_DELIVERY', label: 'Enamels Delivery', icon: '🚚' },
                    { value: 'SHOPIFY', label: 'Shopify Delivery', icon: '🛒' },
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
                      <span className="text-[9px] font-black uppercase tracking-wider">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(nextStage === 'DISPATCH' || currentStage?.stageName === 'DISPATCH') && (
                <div className="space-y-3">
                  <label className="text-[9px] md:text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">Delivery Type</label>
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
                        <span className="text-[9px] font-black uppercase tracking-wider">{dt.label}</span>
                        <span className="text-[7px] text-gray-600 block mt-0.5">{dt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(order.type === 'FULL_CUSTOM' || order.type === 'READY_LOGO') && currentStage?.stageName === 'STORE' && (
                <div className="space-y-3">
                  <label className="text-[9px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Add Customization Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black">$</span>
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
            <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center mb-8">Provide a reason for the worker</p>
            
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
            <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center mb-8">This will permanently stop production and notify the customer.</p>
            
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
            <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center mb-8">Explain why this order is being paused</p>
            
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
            <p className="text-gray-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-center mb-8">Admin override — all actions are logged</p>

            <div className="space-y-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {['FORCE_MOVE', 'FORCE_COMPLETE', 'EXTEND_DEADLINE'].map(a => (
                  <button
                    key={a}
                    onClick={() => setForceAction(a)}
                    className={`flex-1 py-2 px-1 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all ${
                      forceAction === a ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-500 border border-gray-800'
                    }`}
                  >
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {forceAction === 'FORCE_MOVE' && (
                <div>
                  <label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Target Stage</label>
                  <select value={forceStage} onChange={(e) => setForceStage(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-red-500 text-white font-bold text-sm">
                    <option value="">Select stage...</option>
                    <option value="STORE">STORE</option>
                    <option value="LOGO_DESIGN">LOGO DESIGN</option>
                    <option value="PRODUCTION">PRODUCTION</option>
                    <option value="DISPATCH">DISPATCH</option>
                    <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  </select>
                </div>
              )}

              {forceAction === 'EXTEND_DEADLINE' && (
                <div>
                  <label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Additional Hours</label>
                  <input type="number" min="1" value={forceHours} onChange={(e) => setForceHours(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 outline-none focus:border-red-500 text-white font-black text-lg" placeholder="e.g. 24" />
                </div>
              )}

              <div>
                <label className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Reason (required)</label>
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
                    window.location.reload();
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
    </>
  );
};

export default OrderCard;
