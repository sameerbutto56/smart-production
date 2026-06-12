import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
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
  X,
  Phone,
  Users,
  List,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const History = () => {
  const { user } = useAuth();
  const { isUrdu, LanguageToggle } = useLanguage();
  const useUrdu = isUrdu;
  const isAdmin = ['SUPER_ADMIN', 'FAISAL'].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const t = (key) => {
    const urdu = {
      archive: 'آرکائیو اور آڈٹ',
      performance: 'پیداواری کارکردگی کی تاریخ',
      search: 'آرکائیو تلاش کریں...',
      order: 'آرڈر',
      customer: 'گاہک',
      date: 'تاریخ',
      status: 'حالت',
      viewAudit: 'آڈٹ دیکھیں',
      noHistory: 'تاریخ خالی ہے',
      completedOrders: 'مکمل شدہ آرڈرز یہاں ظاہر ہوں گے',
      back: 'واپس',
      bulkView: 'بلک ویو (فون کے ذریعے)',
      individualView: 'انفرادی ویو'
    };
    const english = {
      archive: 'Archive & Audit',
      performance: 'Production Performance History',
      search: 'Search archive...',
      order: 'Order',
      customer: 'Customer',
      date: 'Date',
      status: 'Status',
      viewAudit: 'View Audit Trail',
      noHistory: 'Archive is Empty',
      completedOrders: 'Completed orders will appear here',
      back: 'Back',
      bulkView: 'Bulk View (by Phone)',
      individualView: 'Individual View'
    };
    return isUrdu ? urdu[key] : english[key];
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/orders?status=completed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone?.includes(searchTerm);
      
    const userRole = String(user?.role || '').toUpperCase().trim();
    const isOwner = o.createdById === user?.id;
    const isControlCenter = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    
    return matchesSearch && (isControlCenter || isOwner);
  });

  const [isGroupedView, setIsGroupedView] = useState(false);

  const exportToExcel = () => {
    const data = (searchTerm ? filteredOrders : orders).map((order, idx) => {
      let rawPd = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails || '{}') : order.productDetails;
      const product = Array.isArray(rawPd) ? (rawPd[0]?.productDetails || rawPd[0] || {}) : (rawPd || {});
      return {
        'Sr': idx + 1,
        'Date': new Date(order.createdAt).toLocaleDateString(),
        'Order ID': order.orderNumber || order.id?.slice(0, 8).toUpperCase(),
        'Customer Name': order.customerName || '',
        'Phone Number': order.customerPhone || '',
        'Product': product.productType || order.type || '',
        'Color': product.color || '',
        'Size': product.size || '',
        'Quantity': order.quantity || 1,
        'Payment Method': order.advancePaid ? 'Advance Paid' : 'COD',
        'Amount (PKR)': order.totalPrice || 0,
        'Delivery Status': order.status,
        'Source': order.source || '',
        'Outlet': order.outletName || '',
        'Delivery Date': order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : '',
        'Remarks': order.auditLogs?.map(l => `${l.action}: ${l.details || ''}`).join(' | ') || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery History');

    // Auto column widths
    const cols = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 14) }));
    ws['!cols'] = cols;

    const fileName = `Enamels_History_${new Date().toLocaleDateString('en-PK').replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const phone = order.customerPhone || 'No Phone';
      if (!groups[phone]) {
        groups[phone] = {
          id: `group-${phone}`,
          customerPhone: phone,
          customerName: order.customerName,
          totalQuantity: 0,
          orderCount: 0,
          orders: [],
          latestOrderDate: order.createdAt,
        };
      }
      const qty = parseInt(order.quantity) || 1;
      groups[phone].totalQuantity += qty;
      groups[phone].orderCount += 1;
      groups[phone].orders.push(order);
      if (new Date(order.createdAt) > new Date(groups[phone].latestOrderDate)) {
        groups[phone].latestOrderDate = order.createdAt;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestOrderDate) - new Date(a.latestOrderDate));
  }, [filteredOrders]);

  return (
    <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex items-center space-x-3 md:space-x-6">
          <div className="p-4 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[1.8rem] shadow-2xl shadow-indigo-900/40 rotate-3">
            <HistoryIcon className="text-white" size={32} />
          </div>
          <div className={isUrdu ? 'text-right' : ''}>
            <h1 className="text-2xl md:text-4xl font-black theme-text-primary tracking-tight leading-none">{t('archive')}</h1>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-[0.4em] mt-2">{t('performance')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="relative group w-full sm:w-80">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-indigo-500 transition-all duration-300" size={20} />
              <input
                type="text"
                placeholder="Search archive..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full theme-input rounded-[1.5rem] py-4 pl-16 pr-6 focus:border-indigo-500 outline-none transition-all text-sm font-black placeholder-gray-800"
              />
            </div>
            
            <button
              onClick={() => setIsGroupedView(!isGroupedView)}
              className={`px-8 py-4 theme-bg-subtle border-2 theme-border rounded-2xl theme-text-primary font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-gray-800 transition-all flex items-center gap-3 ${useUrdu ? 'flex-row-reverse' : ''}`}
            >
              {isGroupedView ? <List size={16} /> : <Users size={16} />}
              <span>{isGroupedView ? t('individualView') : t('bulkView')}</span>
            </button>

            {isAdmin && orders.length > 0 && (
              <button
                onClick={exportToExcel}
                className="flex items-center gap-3 px-8 py-4 bg-emerald-700 hover:bg-emerald-600 border-2 border-emerald-600 rounded-2xl text-white font-black text-xs md:text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/30 active:scale-95"
                title="Export complete history to Excel — Admin Only"
              >
                <Download size={16} />
                <span>Export Excel</span>
              </button>
            )}

            <LanguageToggle />
        </div>
      </div>

      {/* History Grid */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <PageLoader text="Loading archive data..." />
        ) : filteredOrders.length === 0 ? (
          <div className="glass p-32 text-center rounded-2xl md:rounded-[3rem] border-2 border-dashed theme-border">
            <div className="w-20 h-20 theme-bg rounded-full flex items-center justify-center mx-auto mb-6">
               <FileText className="text-gray-700" size={32} />
            </div>
            <h3 className="text-xl font-bold theme-text-secondary">{t('noHistory')}</h3>
            <p className="theme-text-muted text-sm mt-2 font-medium">{t('completedOrders')}</p>
          </div>
        ) : isGroupedView ? (
          <AnimatePresence>
            {groupedOrders.map((group, i) => (
              <motion.div
                key={group.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`glass p-4 md:p-8 rounded-[2.5rem] border theme-border hover:border-indigo-500/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center space-x-3 md:space-x-6 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Users size={32} />
                  </div>
                  <div className={useUrdu ? 'text-right' : ''}>
                    <h3 className="font-black text-2xl tracking-tighter theme-text-primary">{group.customerName}</h3>
                    <div className={`flex items-center mt-1 theme-text-muted font-bold ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
                      <Phone size={14} />
                      <span className="text-sm">{group.customerPhone}</span>
                      <div className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
                      <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">{group.orderCount} {t('order').toUpperCase()}S</span>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-4 md:gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className="text-center">
                    <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-1">{useUrdu ? 'تعداد' : 'QUANTITY'}</p>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{group.totalQuantity}</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSearchTerm(group.customerPhone);
                      setIsGroupedView(false);
                    }}
                    className="flex items-center space-x-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/30 hover:scale-105 active:scale-95"
                  >
                    <span>{useUrdu ? 'تفصیل دیکھیں' : 'DETAILS'}</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
                className={`glass p-4 md:p-6 rounded-[2rem] border theme-border hover:border-indigo-500/30 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex items-center space-x-3 md:space-x-6 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                    order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-900/10' : 'bg-indigo-500/10 text-indigo-400 shadow-indigo-900/10'
                  }`}>
                    {order.status === 'DELIVERED' ? <CheckCircle2 size={20} /> : <HistoryIcon size={20} />}
                  </div>
                  <div className={useUrdu ? 'text-right' : ''}>
                    <h3 className="font-black text-2xl tracking-tighter theme-text-primary">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                    <div className={`flex items-center mt-1 ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                       <span className="theme-text-secondary text-sm font-bold">{order.customerName}</span>
                       <div className="w-1 h-1 bg-gray-700 rounded-full" />
                       <span className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-1.5">
                         <Users size={10} className="text-indigo-500/50" />
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
                       <div className="w-1 h-1 bg-gray-700 rounded-full" />
                       <span className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest flex items-center">
                         <Calendar size={10} className={useUrdu ? "ml-1.5" : "mr-1.5"} />
                         {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                       </span>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-4 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className={`hidden lg:flex items-center space-x-2 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <span className="px-3 py-1 theme-bg rounded-lg text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest border theme-border">
                      {order.type}
                    </span>
                    <span className={`px-3 py-1 rounded-lg text-xs md:text-sm font-black uppercase tracking-widest border ${
                      order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedAuditLog(order)}
                    className="flex items-center space-x-2 theme-bg hover:bg-indigo-600 text-indigo-400 hover:text-white px-5 py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border theme-border active:scale-95 group/btn"
                  >
                    <span className={useUrdu ? 'order-2' : 'order-1'}>{t('viewAudit')}</span>
                    <ChevronRight size={14} className={`transition-transform ${useUrdu ? 'order-1 rotate-180 group-hover:-translate-x-1' : 'order-2 group-hover/btn:translate-x-1'}`} />
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
              className="theme-bg border-2 theme-border rounded-2xl md:rounded-[3rem] w-full max-w-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
            >
              <div className="p-4 md:p-10 border-b theme-border flex justify-between items-center theme-bg-subtle">
                <div>
                  <h3 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tight flex items-center gap-4">
                    <ShieldCheck className="text-indigo-400" size={32} />
                    Audit Trail
                  </h3>
                  <p className="theme-text-muted text-xs font-bold uppercase tracking-widest mt-1">Order Log #{selectedAuditLog.orderNumber || selectedAuditLog.id.substring(0, 8)}</p>
                </div>
                <button 
                  onClick={() => setSelectedAuditLog(null)} 
                  className="p-3 bg-gray-800 rounded-full theme-text-muted hover:text-white hover:bg-red-500 transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 md:p-10 max-h-[60vh] overflow-y-auto no-scrollbar space-y-4 md:space-y-6">
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
                      
                      <div className="glass p-4 md:p-6 rounded-2xl border theme-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black theme-text-primary uppercase tracking-tight">{log.action}</h4>
                          <span className="text-xs md:text-sm font-mono theme-text-muted">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center">
                            <User size={12} className="theme-text-secondary" />
                          </div>
                          <span className="text-xs theme-text-secondary font-bold uppercase tracking-widest">{log.user?.name || log.performedBy}</span>
                        </div>
                        {log.details && (
                          <p className="text-xs md:text-sm theme-text-muted italic theme-bg-subtle p-3 rounded-xl border theme-border">
                             "{log.details}"
                          </p>
                        )}
                        <p className="text-xs md:text-sm theme-text-muted font-medium">
                          {new Date(log.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20">
                     <FileText className="text-gray-800 mx-auto mb-4" size={48} />
                     <p className="theme-text-muted font-bold uppercase tracking-widest text-xs">No activity logs recorded.</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 md:p-8 theme-bg-subtle border-t theme-border text-center">
                 <p className="text-xs md:text-sm text-gray-700 font-black uppercase tracking-[0.3em]">Verified Secure Production Audit Trail</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;
