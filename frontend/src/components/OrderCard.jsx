import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, ChevronRight, AlertCircle, ClipboardList } from 'lucide-react';
import axios from 'axios';

const OrderCard = ({ order, onUpdateStage }) => {
  const currentStage = order.stages[0]; // Assuming stages are sorted by date desc
  const [timeLeft, setTimeLeft] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      const deadline = new Date(currentStage.deadlineAt).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('DELAYED');
        setIsDelayed(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStage]);

  useEffect(() => {
    if (currentStage.stageName === 'STORE') {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      axios.get(`${API_URL}/api/inventory`)
        .then(res => setInventory(res.data))
        .catch(err => console.error('Error fetching inventory:', err));
    }
  }, [currentStage.stageName]);

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
      return null;
    }
  };

  const product = parseJSON(order.productDetails);
  const custom = parseJSON(order.customization);
  const sizes = parseJSON(order.sizeData);

  const pipeline = ['STORE', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'PRESSING', 'PACKAGING', 'OUT_FOR_DELIVERY'];

  const getNextStage = (current) => {
    if (current === 'ORDER_ENTRY') return 'STORE';
    const index = pipeline.indexOf(current);
    return index < pipeline.length - 1 ? pipeline[index + 1] : null;
  };

  const nextStageName = getNextStage(currentStage.stageName);

  const renderTasks = () => {
    const stage = currentStage.stageName;
    if (stage === 'STORE') {
      const items = [
        { label: 'Fabric', val: product?.fabricType },
        { label: 'Color', val: product?.color },
        { label: 'Base', val: product?.productType }
      ];
      return items.map((item, idx) => {
        const status = getStockStatus(item.val);
        return (
          <li key={idx} className="text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-blue-500 font-black">•</span>
              <span className="text-gray-300">{item.label}: {item.val || 'N/A'}</span>
            </div>
            {status === 'IN_STOCK' && <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase">Available</span>}
            {status === 'OUT_OF_STOCK' && <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-bold uppercase">Out of Stock</span>}
            {status === 'NOT_FOUND' && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded font-bold uppercase">Check Inv</span>}
          </li>
        );
      });
    }

    if (stage === 'CUTTING') {
      const specs = [
        { l: 'Chest', v: sizes?.chest },
        { l: 'Shoulder', v: sizes?.shoulder },
        { l: 'Length', v: sizes?.length },
        { l: 'Sleeve', v: sizes?.sleeve }
      ];
      return specs.filter(s => s.v).map((s, i) => (
        <li key={i} className="text-xs text-gray-300 flex items-center space-x-2">
          <span className="text-blue-500 font-black">•</span>
          <span>{s.l}: {s.v}"</span>
        </li>
      ));
    }

    const stageMap = {
      'STITCHING': ['Fit Check', 'Stitching Style', 'Embroidery Detail'],
      'QUALITY_CHECK': ['Check Specs', 'Check Stitches', 'Final Visual Audit'],
      'PACKAGING': ['Final Bagging', 'Labeling']
    };

    const tasks = stageMap[stage] || ['Follow Standard Protocol'];
    return tasks.map((t, i) => (
      <li key={i} className="text-xs text-gray-300 flex items-center space-x-2">
        <span className="text-blue-500 font-black">•</span>
        <span>{t}</span>
      </li>
    ));
  };

  const handleReject = () => {
    onUpdateStage(order.id, currentStage.id, 'REJECTED', 'ORDER_ENTRY');
  };

  const isOrderEntry = currentStage.stageName === 'ORDER_ENTRY';

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass rounded-3xl overflow-hidden mb-6 ${order.urgent ? 'card-urgent' : isDelayed ? 'card-delayed' : 'border border-gray-800'} ${order.status === 'REJECTED' ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : ''}`}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h3 className="font-black text-3xl tracking-tighter text-white">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                {order.urgent && (
                  <span className="bg-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase tracking-tighter">Urgent</span>
                )}
                {order.status === 'REJECTED' && (
                  <span className="bg-red-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Correction</span>
                )}
              </div>
              <p className="text-sm text-gray-400 font-bold tracking-wide">{order.customerName}</p>
            </div>
            <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${isDelayed ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-blue-500/20 text-blue-400 border border-blue-500/20'}`}>
              {currentStage.stageName.replace('_', ' ')}
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-950/50 p-4 rounded-2xl border border-gray-800/50 mb-6">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${isDelayed ? 'bg-red-500/10' : 'bg-gray-800/50'}`}>
                <Clock size={18} className={isDelayed ? 'text-red-500' : 'text-blue-400'} />
              </div>
              <span className={`font-mono text-base tracking-tighter ${isDelayed ? 'text-red-500 font-black' : 'text-gray-200'}`}>
                {timeLeft}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest bg-gray-900 px-3 py-1 rounded-lg">
              {new Date(currentStage.deadlineAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Clickable Short Summary Card */}
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
                {isOrderEntry ? 'Rework Summary' : 'Current Task Sheet'}
              </h4>
            </div>
            <ul className="space-y-3">
              {isOrderEntry ? (
                <li className="text-xs text-red-400 font-bold bg-red-400/5 p-3 rounded-xl border border-red-500/10">
                  Order was rejected. Click to see details & fix.
                </li>
              ) : renderTasks()}
            </ul>
            <div className="mt-5 pt-4 border-t border-gray-800 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Click to Expand Job Sheet</span>
              <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></div>
            </div>
          </motion.div>

          <div className="flex space-x-3">
            {currentStage.stageName === 'STORE' ? (
              <>
                {order.type === 'simple' ? (
                  <>
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'COMPLETED', 'CUTTING')}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg"
                    >
                      <span>Fabric: To Cutting</span>
                    </button>
                    <button
                      onClick={() => onUpdateStage(order.id, currentStage.id, 'COMPLETED', 'PACKAGING')}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center space-x-2 active:scale-95 shadow-lg"
                    >
                      <CheckCircle size={14} />
                      <span>Ready: To Packing</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onUpdateStage(order.id, currentStage.id, 'COMPLETED', 'CUTTING')}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-lg shadow-emerald-900/20"
                  >
                    <CheckCircle size={18} />
                    <span>Approve & Move</span>
                  </button>
                )}
              </>
            ) : currentStage.stageName === 'OUT_FOR_DELIVERY' ? (
              <button
                onClick={() => onUpdateStage(order.id, currentStage.id, 'COMPLETED', null)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-lg shadow-emerald-900/20"
              >
                <CheckCircle size={18} />
                <span>Mark Out for Delivery</span>
              </button>
            ) : (
              <button
                onClick={() => onUpdateStage(order.id, currentStage.id, 'COMPLETED', nextStageName)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-3 active:scale-95 shadow-lg shadow-emerald-900/20"
              >
                <CheckCircle size={18} />
                <span>{isOrderEntry ? 'Send Again to Store' : 'Approve & Move'}</span>
              </button>
            )}

            {!isOrderEntry && currentStage.stageName !== 'OUT_FOR_DELIVERY' && (
              <button 
                onClick={handleReject}
                title="Reject & Send back to Entry"
                className="p-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 active:scale-95 shadow-lg"
              >
                <AlertCircle size={20} />
              </button>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-900 flex px-1 pb-1">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
            style={{ width: `${(pipeline.indexOf(currentStage.stageName) + 1) / 8 * 100}%` }}
          ></div>
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
                <AlertCircle size={24} className="rotate-45" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              
              {/* Material & Product Section */}
              <section>
                <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6">01. Material & Product Specs</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Product Base', val: product?.productType },
                    { label: 'Fabric Type', val: product?.fabricType },
                    { label: 'Primary Color', val: product?.color },
                    { label: 'Order Size', val: product?.size },
                    { label: 'Quantity', val: '1 UNIT' }
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-950/50 p-6 rounded-3xl border border-gray-800/50">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{item.label}</p>
                      <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Measurements Section */}
              <section className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/10">
                <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">02. Precise Measurements (Inches)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Object.entries(sizes || {}).map(([key, val], i) => (
                    <div key={i} className="text-center p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm">
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-tighter mb-1">{key}</p>
                      <p className="text-xl font-black text-blue-400">{val}"</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Customization Section */}
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

            {/* Modal Footer */}
            <div className="p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
              <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>
                <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                <span>Stage: {currentStage.stageName}</span>
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
    </>
  );
};

export default OrderCard;
