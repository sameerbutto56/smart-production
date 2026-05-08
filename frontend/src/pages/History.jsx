import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  History as HistoryIcon, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileText,
  Calendar,
  ChevronRight,
  User,
  ShieldCheck,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');

const History = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      const completedOrders = response.data.filter(order => ['COMPLETED', 'DELIVERED', 'DISPATCHED'].includes(order.status));
      setOrders(completedOrders);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
    setLoading(false);
  };

  const filteredOrders = orders.filter(o => 
    o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center space-x-5">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] shadow-2xl shadow-indigo-900/30 rotate-3">
            <HistoryIcon className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Archive & Audit</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Production Performance History</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
           <div className="relative group w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search archive..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900/50 border-2 border-gray-800 rounded-2xl py-3 pl-12 pr-4 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
              />
            </div>
            <button 
              onClick={async () => {
                if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
                  setIsClearing(true);
                  try {
                    const token = sessionStorage.getItem('token');
                    await axios.delete(`${API_URL}/api/orders/history`, { headers: { Authorization: `Bearer ${token}` } });
                    fetchHistory();
                  } catch (error) {
                    console.error('Error clearing history:', error);
                  }
                  setIsClearing(false);
                }
              }}
              disabled={isClearing || orders.length === 0}
              className="px-6 py-3.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 border border-red-500/20"
            >
              {isClearing ? 'Clearing...' : 'Wipe Archive'}
            </button>
        </div>
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Loading archive data...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="glass p-32 text-center rounded-[3rem] border-2 border-dashed border-gray-800">
            <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
               <FileText className="text-gray-700" size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-400">Archive is Empty</h3>
            <p className="text-gray-600 text-sm mt-2 font-medium">Completed orders will appear here for audit.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredOrders.map((order, i) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className="glass p-6 rounded-[2rem] border border-gray-800 hover:border-indigo-500/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-center space-x-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                    order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-900/10' : 'bg-indigo-500/10 text-indigo-400 shadow-indigo-900/10'
                  }`}>
                    {order.status === 'DELIVERED' ? <CheckCircle2 size={24} /> : <HistoryIcon size={24} />}
                  </div>
                  <div>
                    <h3 className="font-black text-2xl tracking-tighter text-white">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                    <div className="flex items-center space-x-4 mt-1">
                       <span className="text-gray-400 text-sm font-bold">{order.customerName}</span>
                       <div className="w-1 h-1 bg-gray-700 rounded-full" />
                       <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest flex items-center">
                         <Calendar size={10} className="mr-1.5" />
                         {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden lg:flex items-center space-x-2">
                    <span className="px-3 py-1 bg-gray-900/50 rounded-lg text-[9px] font-black text-gray-500 uppercase tracking-widest border border-gray-800">
                      {order.type}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedAuditLog(order)}
                    className="flex items-center space-x-2 bg-gray-900 hover:bg-indigo-600 text-indigo-400 hover:text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-gray-800 active:scale-95 group/btn"
                  >
                    <span>View Audit Trail</span>
                    <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Premium Audit Log Modal */}
      <AnimatePresence>
        {selectedAuditLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-950/90 backdrop-blur-xl" onClick={() => setSelectedAuditLog(null)}>
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900/80 border-2 border-gray-800 rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <div className="p-10 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                    <ShieldCheck className="text-indigo-400" size={32} />
                    Audit Trail
                  </h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Order Log #{selectedAuditLog.orderNumber || selectedAuditLog.id.substring(0, 8)}</p>
                </div>
                <button 
                  onClick={() => setSelectedAuditLog(null)} 
                  className="p-3 bg-gray-800 rounded-full text-gray-500 hover:text-white hover:bg-red-500 transition-all active:scale-90"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-10 max-h-[60vh] overflow-y-auto no-scrollbar space-y-6">
                {selectedAuditLog.auditLogs && selectedAuditLog.auditLogs.length > 0 ? (
                  selectedAuditLog.auditLogs
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .map((log, idx) => (
                    <div key={log.id} className="relative pl-10">
                      {/* Timeline Line */}
                      {idx !== selectedAuditLog.auditLogs.length - 1 && (
                        <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-gray-800" />
                      )}
                      
                      {/* Node */}
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-gray-900 flex items-center justify-center ${
                        log.action.includes('Approved') ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                        log.action.includes('Rejected') ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                        'bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]'
                      }`} />
                      
                      <div className="glass p-6 rounded-2xl border border-gray-800/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{log.action}</h4>
                          <span className="text-[10px] font-mono text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center">
                            <User size={12} className="text-gray-400" />
                          </div>
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{log.user?.name || log.performedBy}</span>
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-gray-500 italic bg-gray-950/50 p-3 rounded-xl border border-gray-800">
                             "{log.details}"
                          </p>
                        )}
                        <p className="text-[9px] text-gray-600 font-medium">
                          {new Date(log.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20">
                     <FileText className="text-gray-800 mx-auto mb-4" size={48} />
                     <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">No activity logs recorded.</p>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-gray-950/50 border-t border-gray-800 text-center">
                 <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em]">Verified Secure Production Audit Trail</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;
