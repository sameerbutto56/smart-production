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
  AlertCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const DeliverySheet = () => {
  const { user } = useAuth();
  const { isUrdu } = useLanguage();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/orders?status=delivery`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching orders:', error.response?.data || error);
      const errorMsg = error.response?.data?.error || error.message;
      toast.error(`Failed to load orders: ${errorMsg}`);
    }
    setLoading(false);
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
      // Must be in delivery loop
      const isInDelivery = 
        order.currentStage === 'OUT_FOR_DELIVERY' || 
        order.currentStage === 'DELIVERED' || 
        order.status === 'COMPLETED' ||
        order.status === 'OUT_FOR_DELIVERY';

      if (!isInDelivery) return false;

      // Filter by dispatch date
      const dispatchDate = getStageDate(order);
      if (dispatchDate !== selectedDate) return false;

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
  }, [orders, selectedDate, searchTerm]);

  // Calculations for bottom summaries
  const summary = useMemo(() => {
    let totalCash = 0; // COD
    let totalOnline = 0; // Prepaid
    let totalAmount = 0;

    filteredOrders.forEach(o => {
      const amt = Number(o.totalPrice || 0);
      const isCOD = !o.advancePaid; // If advancePaid is false initially, it's COD

      if (isCOD) {
        totalCash += amt;
      } else {
        totalOnline += amt;
      }
      totalAmount += amt;
    });

    return { totalCash, totalOnline, totalAmount };
  }, [filteredOrders]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4 space-y-8 screen-only">
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
            padding: 8px 6px !important;
            font-size: 11px !important;
            color: #000000 !important;
            text-align: left !important;
          }
          th {
            background-color: #fef08a !important; /* Yellow-200 background */
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
            padding: 12px !important;
            width: 300px !important;
            margin-left: auto !important;
          }
          .summary-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 12px !important;
            font-weight: bold !important;
            border-bottom: 1px dashed #000000 !important;
            padding: 4px 0 !important;
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
            className="p-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-400 hover:text-white transition-all hover:scale-105"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-black uppercase tracking-wider">manifest</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight mt-1">Delivery Sheet</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Selector */}
          <div className="relative group">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-[1.2rem] py-3 pl-12 pr-4 outline-none focus:border-yellow-500 text-sm font-bold text-white transition-all"
            />
          </div>

          {/* Search bar */}
          <div className="relative group w-full sm:w-60">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search rider sheet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-[1.2rem] py-3 pl-12 pr-4 outline-none focus:border-yellow-500 text-sm font-bold text-white transition-all placeholder-gray-800"
            />
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2.5 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black px-6 py-3.5 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-yellow-500/10"
          >
            <Printer size={16} />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Manifest Sheet */}
        <div className="lg:col-span-9 glass p-8 rounded-[2.5rem] border border-gray-800/80 shadow-2xl relative overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl" />
          
          <div className="flex items-center justify-between border-b border-gray-800/50 pb-5">
            <div className="flex items-center gap-3">
              <FileText className="text-yellow-500" size={24} />
              <h3 className="text-xl font-black text-white tracking-tight">Rider Dispatch Manifest</h3>
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-950 px-4 py-2 rounded-full border border-gray-800">
              Date: {new Date(selectedDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-[10px] uppercase font-black tracking-wider border-b border-gray-800 bg-gray-950/40">
                  <th className="py-4 px-3 w-10">Sr.</th>
                  <th className="py-4 px-3 w-28">Order ID</th>
                  <th className="py-4 px-3">Customer</th>
                  <th className="py-4 px-3 w-32">Phone</th>
                  <th className="py-4 px-3">Address</th>
                  <th className="py-4 px-3">Product</th>
                  <th className="py-4 px-3 w-12 text-center">Qty</th>
                  <th className="py-4 px-3 w-24">Payment</th>
                  <th className="py-4 px-3 w-24">Amount</th>
                  <th className="py-4 px-3 w-28 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="py-16 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-4"></div>
                        Generating delivery manifest...
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-16 text-center text-gray-500 text-sm font-bold">
                      No orders dispatched/delivered on this date.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    let pd = {};
                    let productSummary = 'Standard';
                    try {
                      let raw = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                      if (Array.isArray(raw) && raw.length > 1) {
                        productSummary = raw.map(item => {
                          const p = item.productDetails || item;
                          return `${p.productType || 'Item'} (${item.quantity || 1})`;
                        }).join(', ');
                      } else if (Array.isArray(raw)) {
                        pd = raw[0]?.productDetails || raw[0] || {};
                        productSummary = pd?.productType || 'Standard';
                      } else {
                        pd = raw || {};
                        productSummary = pd?.productType || 'Standard';
                      }
                    } catch {}
                    
                    const isCOD = !order.advancePaid;
                    const payMethod = order.paymentMethod || (isCOD ? 'CASH' : 'ONLINE_TRANSFER');

                    return (
                      <tr key={order.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-3 font-black text-gray-400 text-xs">{idx + 1}</td>
                        <td className="py-4 px-3 font-black text-yellow-500 text-xs">
                          {order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-4 px-3 font-bold text-gray-200 text-xs">{order.customerName}</td>
                        <td className="py-4 px-3 text-gray-400 font-bold text-xs">{order.customerPhone || '—'}</td>
                        <td className="py-4 px-3 text-gray-400 text-xs max-w-xs truncate" title={order.address}>
                          {order.address || '—'}
                        </td>
                        <td className="py-4 px-3 text-gray-300 font-bold text-xs">
                          {productSummary}
                        </td>
                        <td className="py-4 px-3 text-center font-black text-gray-200 text-xs">{order.quantity}</td>
                        <td className="py-4 px-3 text-xs">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            payMethod === 'ONLINE_TRANSFER'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : payMethod === 'CASH'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {payMethod === 'ONLINE_TRANSFER' ? 'Online' : payMethod === 'CASH' ? 'Cash' : 'Paid'}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-black text-emerald-400 text-xs">
                          ₨{Number(order.totalPrice || 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-3 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${
                            order.currentStage === 'DELIVERED' || order.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              order.currentStage === 'DELIVERED' || order.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-yellow-500'
                            }`} />
                            {order.currentStage === 'DELIVERED' || order.status === 'COMPLETED' ? 'Delivered' : 'Pending'}
                          </span>
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
        <div className="lg:col-span-3 space-y-6">
          <div className="glass p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl relative overflow-hidden space-y-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <div className="flex items-center space-x-3 text-emerald-400">
              <TrendingUp size={24} />
              <h4 className="text-lg font-black text-white">Daily Ledger</h4>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-950 p-6 rounded-3xl border border-gray-800 flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">COD Collected</p>
                  <p className="text-2xl font-black text-white mt-1">₨{summary.totalCash.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center font-black">
                  💵
                </div>
              </div>

              <div className="bg-gray-950 p-6 rounded-3xl border border-gray-800 flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Online / Prepaid</p>
                  <p className="text-2xl font-black text-white mt-1">₨{summary.totalOnline.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center font-black">
                  💳
                </div>
              </div>

              <div className="bg-yellow-500/10 p-6 rounded-3xl border-2 border-yellow-500/20 flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[10px] text-yellow-500 font-black uppercase tracking-wider">Total Value</p>
                  <p className="text-3xl font-black text-white mt-1">₨{summary.totalAmount.toLocaleString()}</p>
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
            <p style={{ fontSize: '11px', margin: '3px 0 0 0', fontWeight: 'bold', color: '#666666' }}>Smart Production Conveyor Belt Manifest</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0' }}>Date: {new Date(selectedDate).toLocaleDateString()}</p>
            <p style={{ fontSize: '10px', color: '#666666', margin: '2px 0 0 0' }}>Printed: {new Date().toLocaleString()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '3%' }}>Sr.</th>
              <th style={{ width: '12%' }}>Order ID</th>
              <th style={{ width: '15%' }}>Customer</th>
              <th style={{ width: '13%' }}>Phone</th>
              <th style={{ width: '22%' }}>Address</th>
              <th style={{ width: '12%' }}>Product</th>
              <th style={{ width: '4%', textAlign: 'center' }}>Qty</th>
              <th style={{ width: '10%' }}>Payment</th>
              <th style={{ width: '10%' }}>Amount</th>
              <th style={{ width: '9%' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>
                  No orders scheduled for delivery on this date.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order, idx) => {
                let pd = {};
                let productSummary = 'Standard';
                try {
                  let raw = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                  if (Array.isArray(raw) && raw.length > 1) {
                    productSummary = raw.map(item => {
                      const p = item.productDetails || item;
                      return `${p.productType || 'Item'} (${item.quantity || 1})`;
                    }).join(', ');
                  } else if (Array.isArray(raw)) {
                    pd = raw[0]?.productDetails || raw[0] || {};
                    productSummary = pd?.productType || 'Standard';
                  } else {
                    pd = raw || {};
                    productSummary = pd?.productType || 'Standard';
                  }
                } catch {}
                const isCOD = !order.advancePaid;
                const payMethod = order.paymentMethod || (isCOD ? 'CASH' : 'ONLINE_TRANSFER');
                return (
                  <tr key={order.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}</td>
                    <td style={{ fontWeight: 'bold' }}>{order.customerName}</td>
                    <td>{order.customerPhone || '—'}</td>
                    <td>{order.address || '—'}</td>
                    <td>{productSummary}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{order.quantity}</td>
                    <td>{payMethod === 'ONLINE_TRANSFER' ? 'Online' : 'Cash'}</td>
                    <td style={{ fontWeight: 'bold' }}>Rs. {Number(order.totalPrice || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '9px', color: '#555555' }}>
                      {order.stages?.find(s => s.stageName === 'DELIVERED' || s.stageName === 'OUT_FOR_DELIVERY')?.rejectionReason || ''}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="summary-box">
          <div className="summary-row">
            <span>Total Cash (COD):</span>
            <span>Rs. {summary.totalCash.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>Total Online:</span>
            <span>Rs. {summary.totalOnline.toLocaleString()}</span>
          </div>
          <div className="summary-row" style={{ fontSize: '14px', borderTop: '2px solid #000000', paddingTop: '6px', marginTop: '6px' }}>
            <span>Total Amount:</span>
            <span>Rs. {summary.totalAmount.toLocaleString()}</span>
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
