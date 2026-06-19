import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Printer, 
  Calendar, 
  ArrowLeft, 
  FileText, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  CheckCircle, 
  AlertCircle,
  Truck,
  PackageCheck,
  RotateCcw,
  RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PageLoader, LoadingSpinner, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { printDeliveryReport } from '../utils/printReport';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const DeliverySheet = () => {
  const { user } = useAuth();
  const { isUrdu } = useLanguage();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState('ALL');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (retries = 2) => {
    setLoading(true);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = sessionStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/orders?limit=all`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        });
        setOrders(Array.isArray(response.data) ? response.data : []);
        setLoading(false);
        return;
      } catch (error) {
        console.error('Error fetching orders:', error.response?.data || error);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        const errorMsg = error.response?.data?.error || error.message;
        toast.error(`Failed to load orders: ${errorMsg}`);
        setLoading(false);
      }
    }
  };

  const getStageDate = (order) => {
    // Find when it went OUT_FOR_DELIVERY or DELIVERED
    const deliveryStage = order.stages?.find(s => s.stageName === 'OUT_FOR_DELIVERY' || s.stageName === 'DELIVERED');
    if (deliveryStage?.completedAt || deliveryStage?.updatedAt) {
      return new Date(deliveryStage.completedAt || deliveryStage.updatedAt).toISOString().split('T')[0];
    }
    return new Date(order.updatedAt || order.createdAt).toISOString().split('T')[0];
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Must be an online order
      const isOnline = 
        order.source === 'ONLINE' || 
        order.source === 'INTERNAL' ||
        order.source === 'ONLINE ORDER' ||
        order.createdBy?.role === 'FAISAL';
      if (!isOnline) return false;

      // Must be in delivery-related stage
      const deliveryStages = ['OUT_FOR_DELIVERY', 'DISPATCH', 'STORE_RECEIVE', 'DELIVERED'];
      const isDeliveryStage = deliveryStages.includes(order.currentStage) || order.status === 'COMPLETED';
      if (!isDeliveryStage) return false;

      // Filter by delivery method
      if (deliveryMethodFilter !== 'ALL') {
        let method = (order.deliveryMethod || order.deliveryType || '').toUpperCase();
        if (method === 'ENAMELS_DELIVERY') method = 'ENAMELS';
        if (method !== deliveryMethodFilter) return false;
      }

      // Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const num = (order.orderNumber || '').toLowerCase();
        const name = (order.customerName || '').toLowerCase();
        const phone = (order.customerPhone || '').toLowerCase();
        return num.includes(query) || name.includes(query) || phone.includes(query);
      }

      return true;
    });
  }, [orders, searchTerm, deliveryMethodFilter]);

  // Calculations for bottom summaries
  const summary = useMemo(() => {
    let totalCash = 0; // COD
    let totalOnline = 0; // Prepaid
    let totalAmount = 0;

    filteredOrders.forEach(o => {
      const amt = Number(o.totalPrice || 0);
      const isCOD = !(parseFloat(o.advanceAmount) > 0); // If no advance amount, it's COD

      if (isCOD) {
        totalCash += amt;
      } else {
        totalOnline += amt;
      }
      totalAmount += amt;
    });

    return { totalCash, totalOnline, totalAmount };
  }, [filteredOrders]);

  const deliveryMethods = useMemo(() => {
    const methods = new Set();
    orders.forEach(o => {
      let m = (o.deliveryMethod || o.deliveryType || '').toUpperCase();
      if (!m) return;
      if (m === 'ENAMELS_DELIVERY') m = 'ENAMELS';
      methods.add(m);
    });
    return Array.from(methods).sort();
  }, [orders]);

  const methodCounts = useMemo(() => {
    const counts = {};
    deliveryMethods.forEach(m => {
      counts[m] = filteredOrders.filter(o => {
        let method = (o.deliveryMethod || o.deliveryType || '').toUpperCase();
        if (method === 'ENAMELS_DELIVERY') method = 'ENAMELS';
        return method === m;
      }).length;
    });
    return counts;
  }, [filteredOrders, deliveryMethods]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4 space-y-4 md:space-y-8 screen-only">
      {/* Print Stylesheet injection */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-family: 'Helvetica Neue', Arial, sans-serif !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .screen-only {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
          }
          th, td {
            border: 1px solid #000000 !important;
            padding: 10px 8px !important;
            font-size: 13px !important;
            color: #000000 !important;
            text-align: left !important;
          }
          th {
            background-color: #fef08a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
          .summary-box {
            border: 2px solid #000000 !important;
            background-color: #fef08a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin-top: 20px !important;
            padding: 16px !important;
            width: 320px !important;
            margin-left: auto !important;
          }
          .summary-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 14px !important;
            font-weight: bold !important;
            border-bottom: 1px dashed #000000 !important;
            padding: 6px 0 !important;
          }
          .summary-row:last-child {
            border-bottom: none !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Breadcrumb / Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-3 theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white transition-all hover:scale-105"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-black uppercase tracking-wider">manifest</span>
            </div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight mt-1">Delivery Sheet</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`theme-input rounded-[1.2rem] py-3 pl-12 pr-4 outline-none focus:border-yellow-500 text-sm font-bold transition-all ${!selectedDate ? 'text-gray-500' : ''}`}
              placeholder="All Dates"
            />
          </div>
          {selectedDate && (
            <button onClick={() => setSelectedDate('')} className="text-xs md:text-sm font-black text-red-400 hover:text-red-300 uppercase tracking-wider transition-all px-2">
              Clear
            </button>
          )}

          {/* Search bar */}
          <div className="relative group w-full sm:w-60">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
            <input 
              type="text" 
              placeholder="Search rider sheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="theme-input rounded-[1.2rem] py-3 pl-12 pr-4 outline-none focus:border-yellow-500 text-sm font-bold transition-all placeholder-gray-800"
            />
          </div>

          {/* Print Buttons */}
          <button
            onClick={() => printDeliveryReport(filteredOrders)}
            className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-6 py-3.5 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
          >
            <Printer size={16} />
            <span>Report</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2.5 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black px-6 py-3.5 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-500/10"
          >
            <Printer size={16} />
            <span>Sheet</span>
          </button>
        </div>
      </div>

      {/* Delivery Method Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2 px-1">
        <button
          onClick={() => setDeliveryMethodFilter('ALL')}
          className={`px-3 py-2 rounded-xl text-[9px] md:text-xs font-black uppercase tracking-wider transition-all border ${
            deliveryMethodFilter === 'ALL'
              ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg shadow-yellow-500/20'
              : 'theme-bg-subtle theme-border theme-text-secondary hover:text-white hover:border-yellow-500/50'
          }`}
        >
          All ({filteredOrders.length})
        </button>
        {deliveryMethods.map(method => {
          const label = method === 'ENAMELS' ? 'In-House / Animals' : method === 'TCS' ? 'TCS Courier' : method === 'POST_EX' ? 'PostEx' : method === 'DCS' ? 'DCS' : method;
          return (
            <button
              key={method}
              onClick={() => setDeliveryMethodFilter(method)}
              className={`px-3 py-2 rounded-xl text-[9px] md:text-xs font-black uppercase tracking-wider transition-all border ${
                deliveryMethodFilter === method
                  ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg shadow-yellow-500/20'
                  : 'theme-bg-subtle theme-border theme-text-secondary hover:text-white hover:border-yellow-500/50'
              }`}
            >
              {label} ({methodCounts[method] || 0})
            </button>
          );
        })}
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        
        {/* Left Side: Manifest Sheet */}
        <div className="lg:col-span-9 glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border theme-border shadow-2xl relative overflow-hidden space-y-4 md:space-y-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl" />
          
          <div className="flex items-center justify-between border-b theme-border pb-5">
            <div className="flex items-center gap-3">
              <PackageCheck className="text-yellow-500" size={24} />
              <h3 className="text-xl font-black theme-text-primary tracking-tight">Delivery Records</h3>
            </div>
            <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest theme-bg px-4 py-2 rounded-full border theme-border">
              {filteredOrders.length} Online Orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="theme-text-secondary text-xs uppercase font-black tracking-wider border-b theme-border theme-bg-subtle">
                  <th className="py-4 px-3 w-10">Sr.</th>
                  <th className="py-4 px-3 w-28">Order ID</th>
                  <th className="py-4 px-3">Customer</th>
                  <th className="py-4 px-3 w-24">Method</th>
                  <th className="py-4 px-3 w-20">Source</th>
                  <th className="py-4 px-3 w-24">Dispatch Status</th>
                  <th className="py-4 px-3 w-24">Delivery Date</th>
                  <th className="py-4 px-3 w-16">Attempts</th>
                  <th className="py-4 px-3 w-24">Next Delivery</th>
                  <th className="py-4 px-3 w-20">Payment</th>
                  <th className="py-4 px-3 w-24">Completion Status</th>
                  <th className="py-4 px-3 w-28">Delivered At</th>
                  <th className="py-4 px-3 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="12" className="py-16 text-center theme-text-muted">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-4"></div>
                        Loading delivery records...
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-16 text-center theme-text-muted text-sm font-bold">
                      No online delivery orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const deliveryDate = order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
                    const dispatchStage = order.stages?.find(s => s.stageName === 'OUT_FOR_DELIVERY' || s.stageName === 'DISPATCH');
                    const method = order.deliveryMethod || order.deliveryType || '—';
                    const source = order.outletName || (order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL' ? 'ONLINE' : order.source || order.createdBy?.role || '—');

                    return (
                      <tr key={order.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-3 font-black theme-text-secondary text-xs">{idx + 1}</td>
                        <td className="py-4 px-3 font-black text-yellow-500 text-xs">
                          {order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-4 px-3 font-bold theme-text-primary text-xs">{order.customerName}</td>
                        <td className="py-4 px-3 text-xs font-black">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase ${
                            method === 'ENAMELS' || method === 'ENAMELS_DELIVERY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : method !== '—'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>
                            {method === 'ENAMELS' || method === 'ENAMELS_DELIVERY' ? 'In-House' : method}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-xs">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase ${
                            source === 'ONLINE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {source}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-xs">
                          <span className="text-gray-400 font-bold">
                            {dispatchStage ? (
                              dispatchStage.status === 'COMPLETED' ? 'Dispatched' : 'Pending'
                            ) : '—'}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-xs font-bold theme-text-secondary">
                          {deliveryDate?.completedAt
                            ? new Date(deliveryDate.completedAt).toLocaleDateString()
                            : order.completedAt
                            ? new Date(order.completedAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-4 px-3 text-xs font-black">
                          {order.noResponseCount ? (
                            <span className={`${order.noResponseCount >= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                              {order.noResponseCount}/3
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-4 px-3 text-xs font-bold theme-text-secondary">
                          {order.nextDeliveryDate
                            ? new Date(order.nextDeliveryDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-4 px-3 text-xs font-black">
                          {(() => {
                            const _isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID';
                            const _hasAdv = parseFloat(order.advanceAmount || 0) > 0;
                            const _rem = Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0));
                            if (_isPaid) return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PAID</span>;
                            if (_hasAdv) return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">REMAINING COD: ₨{_rem.toLocaleString()}</span>;
                            return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase bg-red-500/10 text-red-400 border border-red-500/20">CASH ON DELIVERY</span>;
                          })()}
                        </td>
                        <td className="py-4 px-3 text-xs">
                          {order.status === 'COMPLETED' || order.currentStage === 'DELIVERED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-black border uppercase bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-black border uppercase bg-gray-500/10 text-gray-400 border-gray-500/20">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-xs font-bold">
                          {order.deliveredAt ? (
                            <span className="text-emerald-400">
                              {new Date(order.deliveredAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} – {new Date(order.deliveredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : deliveryDate?.completedAt ? (
                            <span className="text-gray-500">
                              {new Date(deliveryDate.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} – {new Date(deliveryDate.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={actionLoading === order.id}
                              onClick={async () => {
                                if (order.status === 'COMPLETED') { toast('Already completed'); return; }
                                if (!window.confirm('Mark this order as Complete?')) return;
                                setActionLoading(order.id);
                                try {
                                  await axios.put(`${API_URL}/api/orders/${order.id}/delivery`, { deliveryStatus: 'DELIVERED', remarks: 'Order completed' }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
                                  toast.success('Order completed');
                                  fetchOrders();
                                } catch (err) { toast.error(err.response?.data?.message || err.message); }
                                finally { setActionLoading(null); }
                              }}
                              className="text-[9px] font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                            >
                              {actionLoading === order.id ? <LoadingSpinner size={10} /> : 'Complete'}
                            </button>
                            <button
                              disabled={actionLoading === order.id}
                              onClick={async () => {
                                if (order.status === 'COMPLETED') { toast('Cannot return a completed order'); return; }
                                const reason = prompt('Reason for return:');
                                if (!reason) return;
                                setActionLoading(order.id);
                                try {
                                  await axios.post(`${API_URL}/api/orders/${order.id}/refund`, { reason }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
                                  toast.success('Order returned');
                                  fetchOrders();
                                } catch (err) { toast.error(err.response?.data?.message || err.message); }
                                finally { setActionLoading(null); }
                              }}
                              className="text-[9px] font-black uppercase bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-lg transition-all disabled:opacity-50"
                            >
                              {actionLoading === order.id ? <LoadingSpinner size={10} /> : 'Return'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Financial & Summary Card */}
        <div className="lg:col-span-3 space-y-4 md:space-y-6">
          <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border theme-border shadow-2xl relative overflow-hidden space-y-4 md:space-y-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <div className="flex items-center space-x-3 text-emerald-400">
              <TrendingUp size={24} />
              <h4 className="text-lg font-black theme-text-primary">Daily Ledger</h4>
            </div>

            <div className="space-y-6">
              <div className="theme-bg p-4 md:p-6 rounded-3xl border theme-border flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-wider">COD Collected</p>
                  <p className="text-2xl font-black theme-text-primary mt-1">₨{summary.totalCash.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center font-black">
                  💵
                </div>
              </div>

              <div className="theme-bg p-4 md:p-6 rounded-3xl border theme-border flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-wider">Online / Prepaid</p>
                  <p className="text-2xl font-black theme-text-primary mt-1">₨{summary.totalOnline.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center font-black">
                  💳
                </div>
              </div>

              <div className="bg-yellow-500/10 p-4 md:p-6 rounded-3xl border-2 border-yellow-500/20 flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-xs md:text-sm text-yellow-500 font-black uppercase tracking-wider">Total Value</p>
                  <p className="text-xl md:text-3xl font-black theme-text-primary mt-1">₨{summary.totalAmount.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-500 text-black rounded-xl flex items-center justify-center font-black text-xl shadow-lg">
                  ₨
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* 🖨️ PRINT ONLY MARKUP (Invisible in browser, perfectly formatted on print) */}
      <div className="print-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '10px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', textTransform: 'uppercase', letterSpacing: '1px' }}>Enamels Delivery Sheet</h1>
            <p style={{ fontSize: '11px', margin: '3px 0 0 0', fontWeight: 'bold', color: '#666666' }}>Unified Delivery Records</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0' }}>Printed: {new Date().toLocaleString()}</p>
            <p style={{ fontSize: '10px', color: '#666666', margin: '2px 0 0 0' }}>{filteredOrders.length} orders</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '3%' }}>Sr.</th>
              <th style={{ width: '10%' }}>Order ID</th>
              <th style={{ width: '13%' }}>Customer</th>
              <th style={{ width: '8%' }}>Method</th>
              <th style={{ width: '8%' }}>Source</th>
              <th style={{ width: '10%' }}>Dispatch Status</th>
              <th style={{ width: '9%' }}>Delivery Date</th>
              <th style={{ width: '6%' }}>Att.</th>
              <th style={{ width: '9%' }}>Next Del.</th>
              <th style={{ width: '7%' }}>Payment</th>
              <th style={{ width: '8%' }}>Status</th>
              <th style={{ width: '8%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>
                  No online delivery orders found.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, idx) => {
                const deliveryDate = order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY');
                const dispatchStage = order.stages?.find(s => s.stageName === 'OUT_FOR_DELIVERY' || s.stageName === 'DISPATCH');
                const method = order.deliveryMethod || order.deliveryType || '—';
                const source = order.outletName || (order.source === 'ONLINE' || order.source === 'ONLINE ORDER' || order.createdBy?.role === 'FAISAL' ? 'ONLINE' : order.source || order.createdBy?.role || '—');
                return (
                  <tr key={order.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}</td>
                    <td style={{ fontWeight: 'bold' }}>{order.customerName}</td>
                    <td>{method === 'ENAMELS' || method === 'ENAMELS_DELIVERY' ? 'In-House' : method}</td>
                    <td>{source}</td>
                    <td>{dispatchStage?.status === 'COMPLETED' ? 'Dispatched' : '—'}</td>
                    <td>{deliveryDate?.completedAt ? new Date(deliveryDate.completedAt).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 'bold', color: order.noResponseCount >= 3 ? '#dc2626' : order.noResponseCount > 0 ? '#d97706' : '#000' }}>{order.noResponseCount ? `${order.noResponseCount}/3` : '—'}</td>
                    <td>{order.nextDeliveryDate ? new Date(order.nextDeliveryDate).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 'bold', color: (order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID') ? '#059669' : '#dc2626' }}>{order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : parseFloat(order.advanceAmount) > 0 ? `REMAINING COD: ₨${Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0)).toLocaleString()}` : 'CASH ON DELIVERY'}</td>
                    <td>{order.status === 'COMPLETED' || order.currentStage === 'DELIVERED' ? 'Completed' : 'Pending'}</td>
                    <td style={{ fontWeight: 'bold' }}>₨ {Number(order.totalPrice || 0).toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="summary-box">
          <div className="summary-row">
            <span>Total Cash (COD):</span>
            <span>₨ {summary.totalCash.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>Total Online:</span>
            <span>₨ {summary.totalOnline.toLocaleString()}</span>
          </div>
          <div className="summary-row" style={{ fontSize: '14px', borderTop: '2px solid #000000', paddingTop: '6px', marginTop: '6px' }}>
            <span>Total Amount:</span>
            <span>₨ {summary.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
          <div style={{ borderTop: '1px solid #000000', width: '200px', textAlign: 'center', paddingTop: '5px' }}>
            Rider Signature
          </div>
          <div style={{ borderTop: '1px solid #000000', width: '200px', textAlign: 'center', paddingTop: '5px' }}>
            Dispatcher Signature
          </div>
        </div>
      </div>

    </div>
  );
};

export default DeliverySheet;
