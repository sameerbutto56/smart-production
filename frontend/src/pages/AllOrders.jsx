import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  Download,
  RefreshCcw,
  Truck,
  X,
  Layers,
  ClipboardList,
  Trash2,
  Phone,
  Users,
  List,
  Grid
} from 'lucide-react';
import { motion } from 'framer-motion';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');

const AllOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { searchTerm: contextSearch, setSearchTerm: setContextSearch } = useSearch();
  const [searchTerm, setSearchTerm] = useState(contextSearch);

  useEffect(() => {
    setSearchTerm(contextSearch);
  }, [contextSearch]);

  const handleLocalSearch = (val) => {
    setSearchTerm(val);
    setContextSearch(val);
  };
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const location = useLocation();

  const dict = {
    queue: 'پیداواری قطار',
    monitoring: 'آرڈرز کی براہ راست نگرانی',
    search: 'آرڈر نمبر یا نام تلاش کریں...',
    all: 'تمام آرڈرز',
    customer: 'کسٹمر',
    details: 'تفصیلات',
    stage: 'مرحلہ',
    status: 'حالت',
    priority: 'ترجیح',
    orders: 'آرڈرز',
    quantity: 'تعداد',
    latest: 'تازہ ترین'
  };

  const localT = (key) => {
    if (!key) return '';
    if (isUrdu) return dict[key] || key;
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  useEffect(() => {
    if (location.state) {
      if (location.state.filterStatus) setFilterStatus(location.state.filterStatus);
      if (location.state.filterUrgent !== undefined) setFilterUrgent(location.state.filterUrgent);
      if (location.state.searchTerm) setSearchTerm(location.state.searchTerm);
    }
    fetchOrders();

    socket.on('order-updated', (data) => {
      // Refresh if I am admin/faisal OR if this is MY order
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'FAISAL' || data?.createdById === user?.id) {
        fetchOrders();
      }
    });

    socket.on('new-order', (order) => {
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'FAISAL' || order?.createdById === user?.id) {
        fetchOrders();
        toast(`New order created: #${order.orderNumber || order.id.substring(0,8)}`, { icon: '📦' });
      }
    });

    return () => {
      socket.off('order-updated');
      socket.off('new-order');
    };
  }, [location.state]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to connect to production server');
    }
    setLoading(false);
  };

  const handleSendForDelivery = async (orderId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/orders/${orderId}/send-for-delivery`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error sending for delivery:', error);
      toast.error('Failed to send for delivery');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY DELETE this order? This action cannot be undone.')) return;
    
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Order deleted permanently');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'READY_FOR_DELIVERY':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Order Number', 'Customer', 'Product', 'Color', 'Type', 'Status', 'Stage', 'Created At'];
    const csvRows = filteredOrders.map(order => {
      const product = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
      return [
        `"${order.orderNumber || order.id}"`,
        `"${order.customerName || 'Unknown'}"`,
        `"${product?.productType || 'N/A'}"`,
        `"${product?.color || 'N/A'}"`,
        `"${order.type}"`,
        `"${order.status}"`,
        `"${order.currentStage}"`,
        `"${new Date(order.createdAt).toLocaleDateString()}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `production_orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredOrders = (orders || []).filter(order => {
    if (!order) return false;
    const name = (order.customerName || '').toLowerCase();
    const id = (order.id || '').toLowerCase();
    const orderNum = (order.orderNumber || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();

    const matchesSearch = name.includes(search) || id.includes(search) || orderNum.includes(search);
    const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchesType = filterType === 'ALL' || order.type === filterType;
    const matchesUrgent = !filterUrgent || order.urgent;
    
    return matchesSearch && matchesStatus && matchesType && matchesUrgent;
  });

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
          statusSummary: {},
        };
      }
      const qty = parseInt(order.quantity) || 1;
      groups[phone].totalQuantity += qty;
      groups[phone].orderCount += 1;
      groups[phone].orders.push(order);
      
      const status = order.status;
      groups[phone].statusSummary[status] = (groups[phone].statusSummary[status] || 0) + 1;
      
      if (new Date(order.createdAt) > new Date(groups[phone].latestOrderDate)) {
        groups[phone].latestOrderDate = order.createdAt;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestOrderDate) - new Date(a.latestOrderDate));
  }, [filteredOrders]);
  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div className="flex items-center space-x-6">
          <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[1.8rem] shadow-2xl shadow-emerald-900/40 rotate-3">
            <Package className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-none">Production Queue</h1>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Live Monitoring</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="relative group w-full sm:w-72">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-emerald-500 transition-all duration-300" size={20} />
              <input
                type="text"
                placeholder="Search order number or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-950/80 border-2 border-gray-800 rounded-[1.5rem] py-4 pl-16 pr-6 focus:border-emerald-500 outline-none transition-all text-sm font-black text-white placeholder-gray-800"
              />
            </div>
            
            <button
              onClick={() => setIsGroupedView(!isGroupedView)}
              className={`px-8 py-4 bg-gray-900/50 border-2 border-gray-800 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-all flex items-center gap-3 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              {isGroupedView ? <List size={16} /> : <Users size={16} />}
              <span>{isGroupedView ? (isUrdu ? 'انفرادی منظر' : 'INDIVIDUAL VIEW') : (isUrdu ? 'بڑی تعداد کا منظر' : 'BULK VIEW')}</span>
            </button>

            <LanguageToggle />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text"
            placeholder="Search by customer name or order ID..."
            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-widest"
            >
              <option value="ALL">All Status</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_APPROVAL">Pending Approval</option>
              <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>

          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${showFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}
          >
            <Filter size={18} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Filters</span>
          </button>

          <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
            <button
              onClick={() => setIsGroupedView(false)}
              className={`p-2 rounded-lg transition-all ${!isGroupedView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              title="Individual View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setIsGroupedView(true)}
              className={`p-2 rounded-lg transition-all ${isGroupedView ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              title="Bulk Grouped View"
            >
              <Users size={18} />
            </button>
          </div>
        </div>

          {showFilters && (
            <div className="absolute right-0 mt-3 w-72 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6 z-50 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Order Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2 px-3 text-xs text-gray-300 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Order Type</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-2 px-3 text-xs text-gray-300 outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="STANDARD">Standard</option>
                  <option value="FULL_CUSTOM">Full Custom</option>
                  <option value="READY_LOGO">Ready with Logo</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-xl">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Urgent Only</span>
                <button 
                  onClick={() => setFilterUrgent(!filterUrgent)}
                  className={`w-10 h-5 rounded-full transition-all relative ${filterUrgent ? 'bg-blue-600' : 'bg-gray-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${filterUrgent ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <button 
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterType('ALL');
                  setFilterUrgent(false);
                  setShowFilters(false);
                }}
                className="w-full py-2 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700 bg-gray-900/50">
                {isGroupedView ? (
                  <>
                    <th className="px-6 py-4">Customer / Phone</th>
                    <th className="px-6 py-4 text-center">Orders</th>
                    <th className="px-6 py-4 text-center">Total Quantity</th>
                    <th className="px-6 py-4">Status Summary</th>
                    <th className="px-6 py-4">Latest Order</th>
                    <th className="px-6 py-4 text-right"></th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Order Details</th>
                    <th className="px-6 py-4">Current Stage</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                      Loading production orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-gray-500">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : isGroupedView ? (
                groupedOrders.map((group) => (
                  <tr 
                    key={group.id}
                    onClick={() => {
                      // Maybe open a list of orders or just the first one?
                      // For now, let's filter the search by phone to show individual orders
                      setSearchTerm(group.customerPhone);
                      setIsGroupedView(false);
                      toast(`Showing ${group.orderCount} orders for ${group.customerPhone}`);
                    }}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                        {group.customerName}
                      </div>
                      <div className="flex items-center space-x-2 text-gray-500 font-bold mt-1">
                        <Phone size={12} className="text-blue-500" />
                        <span className="text-xs">{group.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center bg-gray-800 w-10 h-10 rounded-full border border-gray-700 text-white font-black">
                        {group.orderCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/20 font-black text-xl">
                        {group.totalQuantity}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(group.statusSummary).map(([status, count]) => (
                          <span key={status} className={`text-[9px] font-black px-2 py-1 rounded-lg border ${getStatusStyle(status)}`}>
                            {count} {status.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-400 font-bold">
                        {new Date(group.latestOrderDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1 uppercase font-black tracking-widest">
                        {new Date(group.latestOrderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={18} className="text-gray-500 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : (
                filteredOrders.map((order) => {
                  const product = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                  const isWaitingApproval = order.stages?.some(s => s.status === 'WAITING_APPROVAL' && s.stageName === order.currentStage);
                  
                  return (
                  <tr 
                    key={order.id} 
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowModal(true);
                    }}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                        #{order.orderNumber || order.id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        {order.customerName}
                      </div>
                      {order.createdBy?.name && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            By: {order.createdBy.name}
                          </span>
                        </div>
                      )}
                      {order.customerPhone && (
                        <div className="text-[10px] text-gray-600 font-bold mt-0.5">
                          {order.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-200">
                        {product?.productType || 'Standard Item'}
                        {order.quantity > 1 && <span className="ml-2 text-blue-400">x{order.quantity}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                          {product?.fabricType || 'STD FABRIC'}
                        </span>
                        {product?.color && (
                          <div className="flex items-center space-x-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: product.color.toLowerCase().replace(' ', '') }}></div>
                            <span className="text-[10px] text-gray-500 font-medium uppercase">{product.color}</span>
                          </div>
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${product?.gender === 'Female' ? 'bg-pink-500/10 text-pink-500' : 'bg-blue-500/10 text-blue-400'}`}>
                          {product?.gender || 'MALE'}
                        </span>
                        {product?.femaleOptions?.dupatta && (
                          <span className="text-[9px] font-black bg-pink-600 text-white px-1.5 py-0.5 rounded uppercase">Dupatta</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {order.advancePaid ? 'Payment: Advance' : 'Payment: Pending'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`bg-gray-800 px-2 py-1 rounded-md text-[10px] font-black border border-gray-700 uppercase tracking-wider ${isWaitingApproval ? 'text-yellow-400 border-yellow-400/30' : 'text-gray-300'}`}>
                          {isWaitingApproval ? `WAITING: ${order.currentStage.replace(/_/g, ' ')}` : order.currentStage.replace(/_/g, ' ')}
                        </span>
                        
                        <div className="w-24 h-2 bg-gray-800 rounded-full mt-2 overflow-hidden border border-gray-700/50 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: (() => {
                                const pipelines = {
                                  'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                                  'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                                  'READY_LOGO': ['ORDER_ENTRY', 'LOGO_DESIGN', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY']
                                };
                                const currentPipeline = pipelines[order.type] || pipelines['STANDARD'];
                                const progress = ((currentPipeline.indexOf(order.currentStage) + 1) / currentPipeline.length) * 100;
                                return `${Math.max(5, progress)}%`;
                              })()
                            }}
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 shadow-[0_0_12px_#3b82f666] transition-all duration-1000"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.urgent ? (
                        <div className="flex items-center space-x-2 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>URGENT</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase border ${getStatusStyle(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.status === 'READY_FOR_DELIVERY' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendForDelivery(order.id);
                          }}
                          className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ml-auto"
                        >
                          <Truck size={16} />
                          <span>Send for Delivery</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Delete Action Removed per Request */}
                          <ChevronRight size={18} className="text-gray-500" />
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- JOB SHEET MODAL --- */}
      {showModal && selectedOrder && (() => {
        const product = typeof selectedOrder.productDetails === 'string' ? JSON.parse(selectedOrder.productDetails) : selectedOrder.productDetails;
        const custom = typeof selectedOrder.customization === 'string' ? JSON.parse(selectedOrder.customization) : selectedOrder.customization;
        const rawSizes = typeof selectedOrder.sizeData === 'string' ? JSON.parse(selectedOrder.sizeData) : selectedOrder.sizeData;
        
        const standardMeasurements = {
          'S': { chest: '36', shoulder: '14.5', length: '26', sleeve: '22', waist: '30', hips: '38' },
          'M': { chest: '38', shoulder: '15', length: '27', sleeve: '23', waist: '32', hips: '40' },
          'L': { chest: '40', shoulder: '16', length: '28', sleeve: '24', waist: '34', hips: '42' },
          'XL': { chest: '44', shoulder: '17', length: '29', sleeve: '25', waist: '38', hips: '46' },
          '2XL': { chest: '48', shoulder: '18', length: '30', sleeve: '26', waist: '42', hips: '50' }
        };

        const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : (standardMeasurements[product?.size] || {});
        
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl"
              onClick={() => setShowModal(false)}
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
                    <h2 className="text-4xl font-black tracking-tighter text-white">#{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}</h2>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 border text-[10px] font-black uppercase tracking-widest rounded-lg ${selectedOrder.source === 'OUTLET' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                        {selectedOrder.source || 'OUTLET'}: {selectedOrder.outletName || 'MAIN'}
                      </span>
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                        Full Job Sheet
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-400 font-bold tracking-wide">{selectedOrder.customerName}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-4 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar text-white">
                
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
                      { label: 'Payment', val: selectedOrder.paymentStatus || (selectedOrder.advancePaid ? 'ADVANCE' : 'PENDING') }
                    ].filter(i => i.val).map((item, i) => (
                      <div key={i} className="bg-gray-950/50 p-6 rounded-3xl border border-gray-800/50">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{item.label}</p>
                        <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/10">
                  <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">02. Precise Measurements (Inches)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(sizes || {}).map(([key, val], i) => (
                      <div key={i} className="text-center p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm">
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-tighter mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
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
                    <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">04. Design Notes & Reference</h4>
                    <div className="space-y-4">
                      <div className="bg-yellow-500/5 p-6 rounded-3xl border border-yellow-500/10 italic text-gray-300 text-sm shadow-inner">
                        <p className="text-[9px] text-yellow-600 font-black uppercase mb-2">Instructions:</p>
                        {custom?.designNotes || 'No special design notes.'}
                      </div>
                      {custom?.designReference && (
                        <div className="bg-blue-500/5 p-6 rounded-3xl border border-blue-500/10 italic text-gray-300 text-sm shadow-inner">
                          <p className="text-[9px] text-blue-600 font-black uppercase mb-2">Design Cross-Reference:</p>
                          {custom.designReference}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                   <div className="flex justify-between items-center mb-6">
                      <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em]">05. Production Timeline</h4>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
                        Total Workflow: {
                          (() => {
                            const pipelines = {
                              'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                              'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                              'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY']
                            };
                            return pipelines[selectedOrder.type]?.length || 8;
                          })()
                        } Steps
                      </span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(() => {
                        const pipelines = {
                          'STANDARD': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                          'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY'],
                          'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'CUTTING', 'STITCHING', 'QA', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY']
                        };
                        const currentPipeline = pipelines[selectedOrder.type] || pipelines['STANDARD'];
                        
                        // Count how many times order came to Faisal (WAITING_APPROVAL stages)
                        const faisalApprovals = selectedOrder.stages?.filter(s => s.status === 'COMPLETED' || s.status === 'WAITING_APPROVAL').length || 0;
                        
                        return currentPipeline.map((stageName, i) => {
                          const stageData = selectedOrder.stages?.find(s => s.stageName === stageName);
                          const isCompleted = stageData?.status === 'COMPLETED';
                          const isCurrent = selectedOrder.currentStage === stageName;
                          const isOrderEntry = stageName === 'ORDER_ENTRY';
                          
                          // For ORDER_ENTRY, show the order creation time
                          const displayTime = isCompleted ? (
                            new Date(stageData.completedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                          ) : isOrderEntry ? (
                            `Created: ${new Date(selectedOrder.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                          ) : stageData?.deadlineAt ? (
                            `Target: ${new Date(stageData.deadlineAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}`
                          ) : 'TBD';
                          
                          return (
                            <div key={stageName} className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                              isCompleted ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 
                              isCurrent ? 'bg-blue-600/10 border-blue-500 animate-pulse' : 
                              'bg-gray-950/50 border-gray-800'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                  isCompleted ? 'bg-emerald-500 text-white' : 
                                  isCurrent ? 'bg-blue-500 text-white' : 
                                  'bg-gray-800 text-gray-500'
                                }`}>
                                  {i + 1}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-gray-500'}`}>
                                  {stageName.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <span className={`text-[9px] font-bold font-mono whitespace-nowrap ${isCompleted ? 'text-emerald-600' : isOrderEntry ? 'text-gray-400' : 'text-gray-600'}`}>
                                {displayTime}
                              </span>
                            </div>
                          );
                        });
                      })()}
                   </div>
                   
                   {/* Faisal Approval Summary */}
                   <div className="mt-6 p-4 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                         <span className="text-yellow-500 text-sm">👨‍💼</span>
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Faisal Approvals</p>
                         <p className="text-[9px] text-gray-500 font-bold">Times this order came for review</p>
                       </div>
                     </div>
                     <span className="text-2xl font-black text-yellow-400">
                       {selectedOrder.stages?.filter(s => s.status === 'COMPLETED' && s.stageName !== 'ORDER_ENTRY').length || 0}x
                     </span>
                   </div>
                </section>
              </div>

              <div className="p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
                <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                  <span>Created: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                  <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                  <span>Stage: {selectedOrder.currentStage}</span>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close Job Sheet
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
};

export default AllOrders;
