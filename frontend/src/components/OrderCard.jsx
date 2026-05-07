import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, ChevronRight, AlertCircle, ClipboardList, Check, X, RefreshCcw, MessageSquare, History, Target } from 'lucide-react';
import axios from 'axios';

const OrderCard = ({ order, onUpdateStage, userRole }) => {
  const currentStage = order.stages.find(s => s.status === 'WAITING_APPROVAL') || 
                      order.stages.find(s => s.status === 'IN_PROGRESS') || 
                      order.stages.find(s => s.status === 'PENDING') || 
                      order.stages[0];

  const isFaisal = ['FAISAL', 'SUPER_ADMIN', 'ADMIN', 'ORDER_ENTRY'].includes(userRole);
  const [timeLeft, setTimeLeft] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [problemNote, setProblemNote] = useState('');
  const [showFullSheet, setShowFullSheet] = useState(false);
  const [urgencyColor, setUrgencyColor] = useState('text-blue-400');

  const [inventory, setInventory] = useState([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [customizationAmount, setCustomizationAmount] = useState('0');
  const [nextStage, setNextStage] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      if (!currentStage?.deadlineAt || currentStage.status === 'COMPLETED') {
        setTimeLeft('--:--');
        setUrgencyColor('text-gray-600');
        return;
      }
      const deadline = new Date(currentStage.deadlineAt).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        const absoluteDiff = Math.abs(diff);
        const h = Math.floor(absoluteDiff / (1000 * 60 * 60));
        const m = Math.floor((absoluteDiff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`DELAYED: ${h}h ${m}m`);
        setIsDelayed(true);
        setUrgencyColor('text-red-500 font-black animate-pulse');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      
      // Dynamic color based on time left
      if (hours < 1) setUrgencyColor('text-red-400 font-black');
      else if (hours < 4) setUrgencyColor('text-yellow-400 font-bold');
      else setUrgencyColor('text-blue-400');
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStage]);

  useEffect(() => {
    if (currentStage?.stageName === 'STORE') {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      axios.get(`${API_URL}/api/inventory`)
        .then(res => setInventory(res.data))
        .catch(err => console.error('Error fetching inventory:', err));
    }
  }, [currentStage?.stageName]);

  const getStockStatus = (itemName) => {
    if (!itemName || itemName === 'N/A') return null;
    const item = inventory.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) return 'NOT_FOUND';
    return item.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
  };

  const parseJSON = (data) => {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      return {};
    }
  };

  const standardMeasurements = {
    'S': { chest: '36', shoulder: '14.5', length: '26', sleeve: '22', waist: '30', hips: '38' },
    'M': { chest: '38', shoulder: '15', length: '27', sleeve: '23', waist: '32', hips: '40' },
    'L': { chest: '40', shoulder: '16', length: '28', sleeve: '24', waist: '34', hips: '42' },
    'XL': { chest: '44', shoulder: '17', length: '29', sleeve: '25', waist: '38', hips: '46' },
    '2XL': { chest: '48', shoulder: '18', length: '30', sleeve: '26', waist: '42', hips: '50' }
  };

  const product = parseJSON(order.productDetails);
  const rawSizes = parseJSON(order.sizeData);
  const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : (standardMeasurements[product?.size] || {});
  const custom = parseJSON(order.customization);

  const pipelines = {
    'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY']
  };

  const currentPipeline = pipelines[order.type] || pipelines['STANDARD'];

  const productionStages = ['CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING'];
  const productionDeadline = order.stages?.find(s => s.stageName === 'PRESSING_PACKING')?.deadlineAt;
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
        const status = getStockStatus(item.val);
        return (
          <motion.li 
            key={idx}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="text-[11px] flex items-center justify-between p-2 bg-gray-900/50 rounded-lg border border-gray-800/50 hover:border-blue-500/30 transition-all group/item"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'IN_STOCK' ? 'bg-emerald-500 shadow-[0_0_8px_#10b98166]' : 'bg-blue-500 shadow-[0_0_8px_#3b82f666]'}`} />
              <span className="text-gray-400 font-bold group-hover/item:text-gray-200 transition-colors uppercase tracking-tighter">{item.label}: {item.val || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              {status === 'IN_STOCK' && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-emerald-500/20">Ready</span>}
              {status === 'OUT_OF_STOCK' && <span className="text-[8px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-red-500/20">Empty</span>}
              {status === 'NOT_FOUND' && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-yellow-500/20">Check</span>}
              <ChevronRight size={10} className="text-gray-700 group-hover/item:text-blue-500 transition-colors" />
            </div>
          </motion.li>
        );
      });
    }

    if (stage === 'CUTTING') {
      const custom = parseJSON(order.customization);
      const product = parseJSON(order.productDetails);
      const female = product?.femaleOptions || {};

      const materials = [
        { l: 'Fabric', v: product?.fabricType },
        { l: 'Color', v: product?.color },
        { l: 'Gender', v: product?.gender }
      ];

      const measurements = [
        { l: 'Chest', v: sizes?.chest },
        { l: 'Shoulder', v: sizes?.shoulder },
        { l: 'Length', v: sizes?.length },
        { l: 'Sleeve', v: sizes?.sleeve },
        { l: 'Waist', v: sizes?.waist },
        { l: 'Hips', v: sizes?.hips }
      ];

      const tailoring = [
        { l: 'Fit', v: custom?.fitType },
        { l: 'Style', v: custom?.stitchingStyle },
        ...(product?.gender === 'Female' ? [
          { l: 'Sleeves', v: female.sleeves },
          { l: 'Shirt L.', v: female.shirtLength },
          { l: 'Dupatta', v: female.dupatta ? 'YES' : 'NO' }
        ] : [])
      ];

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {materials.filter(m => m.v).map((m, i) => (
              <div key={i} className="bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 text-center">
                <p className="text-[7px] text-blue-400 font-black uppercase">{m.l}</p>
                <p className="text-[10px] font-black text-white truncate">{m.v}</p>
              </div>
            ))}
          </div>
          
          {(order.type === 'STANDARD' || order.type === 'READY_LOGO') && (
            <div className="bg-blue-600/10 p-3 rounded-xl border border-blue-600/20 text-center mb-2">
               <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Base Size Pattern</p>
               <p className="text-xl font-black text-white">{product?.size || 'N/A'}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
            {measurements.filter(s => s.v).map((s, i) => (
              <div key={i} className="text-[11px] text-gray-300 flex items-center justify-between border-b border-gray-800/30 pb-1">
                <span className="font-bold text-gray-500">{s.l}:</span>
                <span className="text-white font-black">{s.v}"</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {tailoring.filter(t => t.v).map((t, i) => (
              <div key={i} className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
                {t.l}: <span className="text-blue-400">{t.v}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (stage === 'STITCHING') {
      const custom = parseJSON(order.customization);
      const product = parseJSON(order.productDetails);
      const female = product?.femaleOptions || {};

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-indigo-600/10 p-3 rounded-xl border border-indigo-600/20 text-center">
              <p className="text-[8px] text-indigo-400 font-black uppercase tracking-widest">Stitching Style</p>
              <p className="text-sm font-black text-white">{custom?.stitchingStyle || 'STANDARD'}</p>
            </div>
            <div className="bg-purple-600/10 p-3 rounded-xl border border-purple-600/20 text-center">
              <p className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Fit Profile</p>
              <p className="text-sm font-black text-white">{custom?.fitType || 'REGULAR'}</p>
            </div>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Critical Measurements</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                { l: 'Chest', v: sizes?.chest },
                { l: 'Shoulder', v: sizes?.shoulder },
                { l: 'Length', v: sizes?.length },
                { l: 'Sleeve', v: sizes?.sleeve }
              ].filter(s => s.v).map((s, i) => (
                <div key={i} className="text-[11px] text-gray-300 flex items-center justify-between border-b border-gray-800/30 pb-1">
                  <span className="font-bold text-gray-500">{s.l}:</span>
                  <span className="text-white font-black">{s.v}"</span>
                </div>
              ))}
            </div>
          </div>

          {custom?.designNotes && (
            <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10">
              <p className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mb-1 flex items-center space-x-1">
                <MessageSquare size={10} />
                <span>Special Tailor Notes:</span>
              </p>
              <p className="text-[11px] text-gray-300 italic font-medium leading-tight">"{custom.designNotes}"</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              FABRIC: <span className="text-blue-400">{product?.fabricType}</span>
            </div>
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              COLOR: <span className="text-blue-400">{product?.color}</span>
            </div>
            {product?.gender === 'Female' && (
              <>
                <div className="px-2 py-1 bg-pink-900/20 rounded text-[9px] font-black uppercase tracking-tighter text-pink-400 border border-pink-500/20">
                  SHIRT: {female.shirtLength}
                </div>
                {female.dupatta && (
                  <div className="px-2 py-1 bg-pink-900/20 rounded text-[9px] font-black uppercase tracking-tighter text-pink-400 border border-pink-500/20">
                    + DUPATTA
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    if (stage === 'QA') {
      const custom = parseJSON(order.customization);
      const product = parseJSON(order.productDetails);

      return (
        <div className="space-y-4">
          <div className="bg-emerald-600/10 p-3 rounded-xl border border-emerald-600/20">
            <p className="text-[8px] text-emerald-400 font-black uppercase tracking-widest mb-2 flex items-center space-x-2">
              <CheckCircle size={10} />
              <span>Branding Verification</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Name Spelling</p>
                <p className="text-[10px] font-black text-white">{custom?.nameSpelling || 'NONE'}</p>
              </div>
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Logo Detail</p>
                <p className="text-[10px] font-black text-white">{order.logoName || 'N/A'}</p>
              </div>
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Thread Color</p>
                <p className="text-[10px] font-black text-white">{custom?.nameColor || 'WHITE'}</p>
              </div>
              <div className="bg-gray-950/50 p-2 rounded-lg">
                <p className="text-[7px] text-gray-500 font-black uppercase">Placement</p>
                <p className="text-[10px] font-black text-white">{custom?.logoPlacement || 'LEFT CHEST'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2 px-1">Measurement Check</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Chst', v: sizes?.chest },
                { l: 'Shld', v: sizes?.shoulder },
                { l: 'Lnth', v: sizes?.length },
                { l: 'Slve', v: sizes?.sleeve },
                { l: 'Wst', v: sizes?.waist },
                { l: 'Hips', v: sizes?.hips }
              ].filter(s => s.v).map((s, i) => (
                <div key={i} className="text-center p-1 bg-gray-900 rounded border border-gray-800">
                  <p className="text-[7px] text-gray-500 font-bold uppercase">{s.l}</p>
                  <p className="text-[10px] font-black text-white">{s.v}"</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              FIT: {custom?.fitType || 'REGULAR'}
            </div>
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              STITCH: {custom?.stitchingStyle || 'STD'}
            </div>
            <div className="px-2 py-1 bg-gray-800 rounded text-[9px] font-black uppercase tracking-tighter text-gray-400 border border-gray-700">
              FABRIC: {product?.fabricType}
            </div>
          </div>
        </div>
      );
    }

    if (stage === 'PRESSING_PACKING') {
      const product = parseJSON(order.productDetails);
      const custom = parseJSON(order.customization);
      const female = product?.femaleOptions || {};

      return (
        <div className="space-y-4">
          <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 text-center">
             <p className="text-[8px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">Final Packing ID</p>
             <h4 className="text-xl font-black text-white">#{order.orderNumber}</h4>
             <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{order.customerName}</p>
          </div>

          <div className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-3 px-1">Packing Checklist</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <span className="font-bold">Product:</span>
                <span className="text-white font-black">{product?.productType} ({product?.size})</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <span className="font-bold">Color:</span>
                <span className="text-white font-black">{product?.color}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-300 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                <span className="font-bold text-orange-400">Ironing Fabric:</span>
                <span className="text-white font-black">{product?.fabricType}</span>
              </div>
              {product?.gender === 'Female' && female.dupatta && (
                <div className="flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <span className="font-bold italic underline">⚠️ INCLUDE DUPATTA</span>
                  <span className="font-black">REQUIRED</span>
                </div>
              )}
            </div>
          </div>

          {custom?.designNotes && (
            <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700">
              <p className="text-[7px] text-gray-500 font-black uppercase">Special Request Note</p>
              <p className="text-[10px] text-gray-400 italic">"{custom.designNotes.substring(0, 50)}..."</p>
            </div>
          )}
        </div>
      );
    }

    const stageMap = {
      'NAME_LOGO': ['Name Embroidery', 'Color Check'],
      'CUSTOM_LOGO': ['Logo Design Apply', 'Custom Pattern']
    };

    const tasks = stageMap[stage] || ['Follow Standard Protocol'];
    return tasks.map((t, i) => (
      <li key={i} className="text-xs text-gray-300 flex items-center space-x-2">
        <span className="text-blue-500 font-black">•</span>
        <span>{t}</span>
      </li>
    ));
  };

  const isWaitingApproval = currentStage?.status === 'WAITING_APPROVAL';

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass rounded-3xl overflow-hidden mb-6 ${order.urgent ? 'card-urgent' : isDelayed ? 'card-delayed' : 'border border-gray-800'} ${order.status === 'REJECTED' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}`}
      >
        <div className="p-4">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="text-[7px] text-gray-700 absolute top-1 right-3">v1.1</div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <h3 className="font-black text-lg tracking-tighter text-white break-all">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                {order.urgent && (
                   <span className="bg-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse uppercase tracking-tighter">Urgent</span>
                )}
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${
                  order.type === 'FULL_CUSTOM' ? 'bg-indigo-600' : order.type === 'READY_LOGO' ? 'bg-purple-600' : 'bg-gray-700'
                }`}>
                  {order.type}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-bold tracking-wide truncate">{order.customerName}</p>
            </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest ${isWaitingApproval ? 'bg-orange-500 text-white animate-pulse' : 'bg-blue-500/10 text-blue-400'} border border-current flex items-center gap-1`}>
                  {isWaitingApproval && <AlertCircle size={8} />}
                  {currentStage?.stageName?.replace(/_/g, ' ')}
                </span>
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
                  <span className="text-[7px] text-gray-500 font-black uppercase mt-0.5">Time Left</span>
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
                <span className="text-[10px] text-white font-black">
                  {new Date(productionDeadline).toLocaleDateString()} {new Date(productionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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
              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-blue-300 transition-colors">
                Job Sheet Summary
              </h4>
            </div>
            <ul className="space-y-3">
              {renderTasks()}
            </ul>
            {currentStage?.rejectionReason && (
              <div className={`mt-4 p-3 rounded-xl border ${currentStage.rejectionReason.includes('Available') ? 'bg-emerald-500/10 border-emerald-500/20' : currentStage.rejectionReason.includes('PROBLEM') ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${currentStage.rejectionReason.includes('Available') ? 'text-emerald-400' : currentStage.rejectionReason.includes('PROBLEM') ? 'text-orange-400' : 'text-red-400'}`}>
                  {currentStage.rejectionReason.includes('Inventory') ? 'Store Inventory Check:' : currentStage.rejectionReason.includes('PROBLEM') ? 'Worker Reported Problem:' : 'Faisal Rejection Reason:'}
                </p>
                <p className="text-xs text-gray-300 italic">{currentStage.rejectionReason.replace('PROBLEM:', '')}</p>
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Click to Expand Job Sheet</span>
              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
            </div>
          </motion.div>

          {/* Production Tracking Timeline */}
          {order.stages?.some(s => s.status === 'COMPLETED') && (
            <div className="mb-6 px-4 py-3 bg-gray-950/30 rounded-2xl border border-gray-800/50">
              <h5 className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={10} />
                  Production History
                </div>
                <span className="text-[8px] text-yellow-500 font-black">
                  👨‍💼 {order.stages.filter(s => s.status === 'COMPLETED' && s.stageName !== 'ORDER_ENTRY').length}x to Faisal
                </span>
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
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {s.stageName.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[8px] text-yellow-500/60">→ Faisal</span>
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
            {isFaisal && order.status === 'WAITING_APPROVAL' && currentStage?.status === 'COMPLETED' ? (
              <button
                onClick={() => setShowApprovalDialog(true)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-xl shadow-blue-900/20"
              >
                <ChevronRight size={14} />
                <span>Initiate Next Phase</span>
              </button>
            ) : isWaitingApproval ? (
              isFaisal ? (
                <>
                  <button
                    onClick={() => setShowApprovalDialog(true)}
                    className="flex-[1.5] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg"
                  >
                    <Check size={14} />
                    <span>Approve</span>
                  </button>
                  {(currentStage?.rejectionReason?.includes('Out of Stock') || currentStage?.rejectionReason?.includes('PROBLEM')) ? (
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'reject', { reason: 'Problem Resolved - Please Proceed' })}
                      className="flex-1 bg-yellow-600/10 hover:bg-yellow-600 text-yellow-500 hover:text-white py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 border border-yellow-500/20"
                    >
                      <RefreshCcw size={14} />
                      <span>Send Again</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowRejectionDialog(true)}
                      className="flex-1 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 border border-red-500/20"
                    >
                      <X size={14} />
                      <span>Reject</span>
                    </button>
                  )}
                  {order.paymentStatus !== 'FULL_PAID' && (
                    <button
                      onClick={() => {
                        const status = order.paymentStatus === 'PENDING' ? 'ADVANCE_PAID' : 'FULL_PAID';
                        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                        axios.put(`${API_URL}/api/orders/${order.id}/payment`, { paymentStatus: status }, {
                          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
                        }).then(() => {
                          // No reload needed! The socket will trigger re-fetch in parent
                          // but we can add a local feedback too
                        }).catch(err => {
                          console.error('Payment update failed:', err);
                          alert('Payment update failed');
                        });
                      }}
                      className="flex-1 py-3 px-2 bg-yellow-600/10 hover:bg-yellow-600 text-yellow-500 hover:text-white rounded-xl transition-all border border-yellow-500/20 active:scale-95 flex items-center justify-center"
                      title="Update Payment"
                    >
                      <span className="text-[10px] font-black">PAY</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex-1 bg-gray-800 text-gray-500 py-4 rounded-2xl text-[10px] font-black uppercase text-center border border-gray-700 italic">
                  Waiting for Faisal Approval...
                </div>
              )
            ) : (
              !isFaisal && currentStage?.status !== 'COMPLETED' && (
                currentStage?.stageName === 'STORE' ? (
                  <div className="flex w-full space-x-2">
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Available' })}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>Have It</span>
                    </button>
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'request', { inventoryStatus: 'Out of Stock' })}
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Missing</span>
                    </button>
                  </div>
                ) : ['LOGO_DESIGN', 'NAME_LOGO', 'CUSTOM_LOGO'].includes(currentStage?.stageName) ? (
                  <div className="flex w-full space-x-2">
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'request')}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                      <CheckCircle size={14} />
                      <span>Design Complete</span>
                    </button>
                    <button
                      onClick={() => setShowProblemModal(true)}
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex flex-col xl:flex-row items-center justify-center gap-1 active:scale-95 shadow-lg shadow-red-900/20"
                    >
                      <AlertCircle size={14} />
                      <span>Design Problem</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex w-full space-x-2">
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'request')}
                      className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                      <CheckCircle size={18} />
                      <span>{(() => {
                        const nextStageIdx = currentPipeline.indexOf(currentStage?.stageName) + 1;
                        const nextStage = currentPipeline[nextStageIdx];
                        if (currentStage?.stageName === 'PRESSING_PACKING') return 'PROCESS COMPLETE';
                        return nextStage ? `MOVE TO ${nextStage.replace(/_/g, ' ')}` : 'COMPLETE TASK';
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

          {/* Problem Reporting Modal */}
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
                  className="relative w-full max-w-lg bg-gray-900 border border-red-500/30 rounded-[2.5rem] p-8 shadow-2xl"
                >
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="p-3 bg-red-500/20 rounded-2xl text-red-500">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Report Problem</h3>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Sent directly to Faisal Control Center</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Describe what's wrong</label>
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
                      Send to Faisal
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isDelayed ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {currentStage?.status === 'WAITING_APPROVAL' ? 'Authorization Pending' : 'Current Stage Limit'}
                  </span>
                </div>
                <span className={`text-sm font-black font-mono ${urgencyColor}`}>
                  {timeLeft}
                </span>
              </div>

              {/* Combined Production Goal */}
              {isCurrentlyInProduction && productionDeadline && (
                <div className="p-4 bg-indigo-600/5 rounded-2xl border border-indigo-600/10 relative overflow-hidden group/goal">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/goal:opacity-30 transition-opacity">
                    <Target size={32} />
                  </div>
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Production Goal</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-300 font-mono">
                      {new Date(productionDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
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

      {/* --- FULL JOB SHEET MODAL --- */}
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
            className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
              <div>
                <div className="flex items-center space-x-4 mb-2">
                  <h2 className="text-4xl font-black tracking-tighter text-white">#{order.orderNumber || order.id.substring(0, 8)}</h2>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                    Full Production Job Sheet
                  </span>
                </div>
                <p className="text-gray-400 font-bold tracking-wide">{order.customerName}</p>
              </div>
              <button 
                onClick={() => setShowFullSheet(false)}
                className="p-4 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              
              {userRole !== 'LOGO_DESIGN' && (
                <section>
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6">01. Material & Product Specs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{item.label}</p>
                        <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {userRole !== 'LOGO_DESIGN' && order.type === 'FULL_CUSTOM' && (
                <section className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/10">
                  <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">02. Precise Measurements (Inches)</h4>
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

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-6">03. Branding & Tailoring</h4>
                  <div className="space-y-4">
                    {[
                      { l: 'Branding Name', v: custom?.nameSpelling },
                      { l: 'Embroidery Color', v: custom?.nameColor },
                      { l: 'Logo Location', v: custom?.logoPlacement },
                      { l: 'Fit Type', v: custom?.fitType },
                      { l: 'Stitching Style', v: custom?.stitchingStyle }
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                        <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{item.l}</span>
                        <span className="text-sm font-black text-emerald-400">{item.v || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">04. Design Notes & Special Requests</h4>
                  <div className="h-full min-h-[200px] bg-yellow-500/5 p-8 rounded-3xl border border-yellow-500/10 italic text-gray-300 leading-relaxed text-sm shadow-inner">
                    {custom?.designNotes || 'No special design notes provided for this order.'}
                  </div>
                </div>
              </section>

            </div>

            <div className="p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
              <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                <span>Stage: {currentStage?.stageName}</span>
              </div>
              <button 
                onClick={() => setShowFullSheet(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close Job Sheet
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* --- APPROVAL DIALOG --- */}
      {showApprovalDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass max-w-sm w-full p-8 rounded-[2rem] border-2 border-gray-800 shadow-2xl"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Approve & Send To...</h3>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center mb-8">Current Stage: {currentStage?.stageName.replace('_', ' ')} Complete</p>
            
            <div className="space-y-6 mb-8">
              {/* Next Stage Selection */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Destination Stage</label>
                <select 
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-4 px-6 outline-none focus:border-blue-500 transition-all text-white font-bold text-sm appearance-none"
                  onChange={(e) => setNextStage(e.target.value)}
                  value={nextStage || ''}
                >
                  <option value="">Select Next Hub/Spoke...</option>
                  <option value="STORE">Send to STORE</option>
                  <option value="CUTTING">Send to MANUFACTURING (Cutter)</option>
                  <option value="LOGO_DESIGN">Send to LOGO & NAME DESIGN</option>
                  <option value="DISPATCH">Send to DISPATCH</option>
                </select>
              </div>

              {(order.type === 'FULL_CUSTOM' || order.type === 'READY_LOGO') && currentStage?.stageName === 'STORE' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">Add Customization Amount ($)</label>
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
                disabled={!nextStage && currentStage?.stageName !== 'DISPATCH'}
                onClick={() => {
                  onUpdateStage(order.id, currentStage.id, 'approve', { 
                    nextStage, 
                    customizationPrice: customizationAmount 
                  });
                  setShowApprovalDialog(false);
                  setCustomizationAmount('0');
                  setNextStage('');
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20"
              >
                Confirm & Send
              </button>
              <button 
                onClick={() => setShowApprovalDialog(false)}
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
            className="glass max-w-sm w-full p-8 rounded-[2rem] border-2 border-red-500/30 shadow-2xl"
          >
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4 text-center">Reject & Return</h3>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center mb-8">Provide a reason for the worker</p>
            
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
    </>
  );
};

export default OrderCard;
