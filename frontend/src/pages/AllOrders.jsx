import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { debounce } from '../utils/debounce';
import useCache, { setCache } from '../hooks/useCache';
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
import { printJobSheet, romanToUrdu } from '../utils/printReport';
import { toUrduName, translateGender } from '../utils/urduDictionary';
import { formatDateTime, formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import { isPaidOrder, getRemainingBalance, getCodAmount } from '../utils/paymentUtils';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import OrderCard from '../components/OrderCard';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

const POS_MAP = { 'LeftChest': 'Left Chest', 'RightChest': 'Right Chest', 'Sleeve': 'Sleeve Cuff', 'Back': 'Upper Back', 'Cuff': 'Cuff' };
const fmtPos = (v) => POS_MAP[v] || v;

// --- Admin Order Priority & Delay Tracking helpers ---
const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'Dispatch',
  OUTLET_RECEIVE: 'Dispatch',
  ENAMELS_DELIVERY: 'Dispatch',
  OUT_FOR_DELIVERY: 'Dispatch',
  ORDER_ENTRY: 'Inventory Verification',
  DELIVERED: 'Delivered',
};

const DELAY_REASONS = {
  'Store': 'Delayed in Store',
  'Production': 'Delayed in Production',
  'Logo': 'Delayed in Logo Department',
  'Dispatch': 'Delayed in Dispatch',
  'Inventory Verification': 'Delayed in Inventory Verification',
};

// Fallback expected phase duration (hours) when a stage has no deadlineAt (legacy rows)
const FALLBACK_STAGE_HOURS = {
  STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48,
  STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12,
  OUT_FOR_DELIVERY: 12, ORDER_ENTRY: 24, IN_DISPATCH: 24,
};

// <24h → "X Hours"; ≥24h → "X Day(s)" (never "48 Hours")
const fmtDuration = (ms) => {
  const h = Math.floor((ms || 0) / 3600000);
  if (h < 24) return `${Math.max(h, 1)} Hour${Math.max(h, 1) === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} Day${d === 1 ? '' : 's'}`;
};

// Auto delay detection from the order's active stage deadline (same machinery as the
// backend escalation scan: stage.deadlineAt < now → delayed). Returns null when on time.
const getDelayInfo = (order) => {
  if (!order || !Array.isArray(order.stages) || order.stages.length === 0) return null;
  const active = order.stages.find(
    (s) => s.stageName === order.currentStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );
  if (!active) return null;
  const now = Date.now();
  const phaseStart = active.startedAt || active.createdAt || order.createdAt ? new Date(active.startedAt || active.createdAt || order.createdAt).getTime() : now;
  let expectedDeadline = active.deadlineAt ? new Date(active.deadlineAt).getTime() : null;
  if (!expectedDeadline) {
    expectedDeadline = phaseStart + ((FALLBACK_STAGE_HOURS[active.stageName] || 24) * 3600000);
  }
  if (expectedDeadline >= now) return null;
  const department = STAGE_DEPARTMENTS[active.stageName] || 'Store';
  const totalStart = order.createdAt ? new Date(order.createdAt).getTime() : phaseStart;
  return {
    orderId: order.id,
    stage: active.stageName,
    department,
    reason: DELAY_REASONS[department] || `Delayed in ${department}`,
    phaseElapsed: Math.max(0, now - phaseStart),
    totalElapsed: Math.max(0, now - totalStart),
    delayDuration: Math.max(0, now - expectedDeadline),
  };
};

const getDateRange = (key) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = startOfToday.getTime() + 86400000;
  switch (key) {
    case 'today': return { start: startOfToday.getTime(), end: endOfToday.getTime() };
    case 'yesterday': return { start: startOfToday.getTime() - 86400000, end: startOfToday.getTime() };
    case 'last7': return { start: startOfToday.getTime() - 6 * 86400000, end: endOfToday.getTime() };
    case 'thisMonth': return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end: endOfToday.getTime() };
    default: return null;
  }
};

const AllOrders = () => {
  const { user } = useAuth();
  const { data: orders = [], loading, refresh } = useCache('orders:all', {
    fetcher: () => api.get('/api/orders').then(r => Array.isArray(r.data) ? r.data : []),
    ttl: 60 * 1000,
  });
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
  const [productAvailability, setProductAvailability] = useState({});

  // Sync selectedOrder with freshest cache data when orders refresh
  useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const fresh = orders.find(o => o.id === selectedOrder.id);
      if (fresh) setSelectedOrder(fresh);
    }
  }, [orders]);

  useEffect(() => {
    if (selectedOrder?.productDetails) {
      try {
        const pd = selectedOrder.productDetails;
        const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
        const init = {};
        items.forEach((item, idx) => {
          if (item.availabilityStatus === 'available') init[idx] = true;
          else if (item.availabilityStatus === 'not_available') init[idx] = false;
        });
        setProductAvailability(init);
      } catch {}
    } else {
      setProductAvailability({});
    }
  }, [selectedOrder]);

  const handleProductAvailabilityToggle = async (idx, isAvailable) => {
    if (!selectedOrder) return;
    try {
      // Optimistically update local state
      setProductAvailability(prev => ({ ...prev, [idx]: isAvailable }));

      await api.patch(`/api/orders/${selectedOrder.id}/product-availability`, {
        productAvailability: { [idx]: isAvailable }
      });

      // Update selectedOrder details locally so print uses correct details
      setSelectedOrder(prev => {
        if (!prev) return null;
        try {
          const pd = prev.productDetails;
          const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
          const updatedItems = items.map((item, i) => {
            if (i === idx) {
              return { ...item, availabilityStatus: isAvailable ? 'available' : 'not_available' };
            }
            return item;
          });
          return { ...prev, productDetails: updatedItems };
        } catch {
          return prev;
        }
      });

      // Optimistically update cache so dashboard reflects the change immediately
      setCache('orders:all', orders.map(o => {
        if (o.id === selectedOrder.id) {
          try {
            const pd = o.productDetails;
            const items = Array.isArray(pd) ? pd : (pd?.productType ? [pd] : []);
            const updatedItems = items.map((item, i) => {
              if (i === idx) {
                return { ...item, availabilityStatus: isAvailable ? 'available' : 'not_available' };
              }
              return item;
            });
            return { ...o, productDetails: updatedItems };
          } catch {
            return o;
          }
        }
        return o;
      }));

      toast.success(isAvailable ? 'Item Completed' : 'Item Rejected');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update product availability');
      // Revert state
      if (selectedOrder?.productDetails) {
        try {
          const pd = selectedOrder.productDetails;
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
  };

  const [showModal, setShowModal] = useState(false);
  const [printLang, setPrintLang] = useState('ur');
  const [showPrintFilter, setShowPrintFilter] = useState(false);
  const [printSections, setPrintSections] = useState({ measurements: true, engraving: true });
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isGroupedView, setIsGroupedView] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('all'); // all|standard|custom|urgent|super_urgent|delayed
  const [dateFilter, setDateFilter] = useState('all'); // all|today|yesterday|last7|thisMonth
  const [filterDepartment, setFilterDepartment] = useState(null); // Store|Production|Logo|Dispatch|Inventory Verification
  
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

    const debouncedRefresh = debounce(refresh, 300);

    const onOrderUpdated = () => { debouncedRefresh(); };
    const onNewOrder = (order) => {
      debouncedRefresh();
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || order?.createdById === user?.id) {
        toast(`New order created: #${order.orderNumber || order.id.substring(0,8)}`, { icon: '📦' });
      }
    };

    socket.on('order-updated', onOrderUpdated);
    socket.on('new-order', onNewOrder);
    socket.on('stage-accepted', debouncedRefresh);

    return () => {
      socket.off('order-updated', onOrderUpdated);
      socket.off('new-order', onNewOrder);
      socket.off('stage-accepted', debouncedRefresh);
    };
  }, [location.state]);

  const handleSendForDelivery = async (orderId) => {
    try {
      await api.put(`/api/orders/${orderId}/send-for-delivery`);
      refresh();
    } catch (error) {
      console.error('Error sending for delivery:', error);
      toast.error('Failed to send for delivery');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY DELETE this order? This action cannot be deleted.')) return;
    
    try {
      await api.delete(`/api/orders/${orderId}`);
      toast.success('Order deleted permanently');
      refresh();
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
    const headers = ['Order Number', 'Customer', 'Product', 'Color', 'Type', 'Priority', 'Status', 'Stage', 'Delay', 'Created At'];
    const csvRows = filteredOrders.map(order => {
      let rawPd = order.productDetails || {};
      const product = Array.isArray(rawPd) ? (rawPd[0]?.productDetails || rawPd[0] || {}) : (rawPd || {});
      const delay = delayMap[order.id];
      return [
        `"${order.orderNumber || order.id}"`,
        `"${order.customerName || 'Unknown'}"`,
        `"${product?.productType || product?.name || 'N/A'}"`,
        `"${product?.color || 'N/A'}"`,
        `"${order.type}"`,
        `"${order.priority || 'NORMAL'}"`,
        `"${order.status}"`,
        `"${order.currentStage}"`,
        `"${delay ? delay.reason : ''}"`,
        `"${formatDateOnly(order.createdAt)}"`
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

  const delayMap = useMemo(() => {
    const map = {};
    (orders || []).forEach(o => {
      const d = getDelayInfo(o);
      if (d) map[o.id] = d;
    });
    return map;
  }, [orders]);

  const departmentDelays = useMemo(() => {
    const counts = {};
    Object.values(delayMap).forEach(d => {
      counts[d.department] = (counts[d.department] || 0) + 1;
    });
    return counts;
  }, [delayMap]);

  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);

  const summaryCounts = useMemo(() => {
    const counts = { total: 0, standard: 0, custom: 0, urgent: 0, superUrgent: 0, delayed: 0 };
    (orders || []).forEach(o => {
      const created = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (dateRange && (created < dateRange.start || created >= dateRange.end)) return;
      counts.total++;
      if (o.type === 'STANDARD') counts.standard++;
      if (o.type === 'READY_LOGO' || o.type === 'FULL_CUSTOM') counts.custom++;
      if (o.priority === 'URGENT') counts.urgent++;
      if (o.priority === 'SUPER_URGENT') counts.superUrgent++;
      if (delayMap[o.id]) counts.delayed++;
    });
    return counts;
  }, [orders, dateRange, delayMap]);

  const filteredOrders = useMemo(() => (orders || []).filter(order => {
    if (!order) return false;
    const name = (order.customerName || '').toLowerCase();
    const id = (order.id || '').toLowerCase();
    const orderNum = (order.orderNumber || '').toLowerCase();
    const search = (searchTerm || '').toLowerCase();

    const cityField = (order.city || '').toLowerCase();
    const matchesSearch = name.includes(search) || id.includes(search) || orderNum.includes(search) || cityField.includes(search);
    const matchesStatus = filterStatus === 'ALL' || order.status === filterStatus;
    const matchesType = filterType === 'ALL' || order.type === filterType;
    const matchesUrgent = !filterUrgent || order.urgent;
    const matchesCity = !filterCity || cityField.includes(filterCity.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' ? true
      : filterCategory === 'standard' ? order.type === 'STANDARD'
      : filterCategory === 'custom' ? (order.type === 'READY_LOGO' || order.type === 'FULL_CUSTOM')
      : filterCategory === 'urgent' ? order.priority === 'URGENT'
      : filterCategory === 'super_urgent' ? order.priority === 'SUPER_URGENT'
      : filterCategory === 'delayed' ? !!delayMap[order.id]
      : true;
    const matchesDepartment = !filterDepartment || delayMap[order.id]?.department === filterDepartment;
    const orderCreated = order.createdAt ? new Date(order.createdAt).getTime() : 0;
    const matchesDate = !dateRange || (orderCreated >= dateRange.start && orderCreated < dateRange.end);
    
    // Strict Role Filtering
    const userRole = String(user?.role || '').toUpperCase().trim();
    const isOwner = order.createdById === user?.id;
    const isControlCenter = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    const matchesRole = isControlCenter || isOwner;
    
    // STORE_RECEIVE is Store-only — never show in Online/Outlet/AllOrders views
    const isStoreRole = ['STORE', 'STORE_EMPLOYEE'].includes(userRole);
    const notStoreReceive = isStoreRole || order.currentStage !== 'STORE_RECEIVE';
    
    return matchesSearch && matchesStatus && matchesType && matchesUrgent && matchesCity && matchesRole && notStoreReceive && matchesCategory && matchesDepartment && matchesDate;
  }).sort((a, b) => {
    const numA = parseInt(a.orderNumber) || 0;
    const numB = parseInt(b.orderNumber) || 0;
    return sortOrder === 'asc' ? numA - numB : numB - numA;
  }), [orders, searchTerm, filterStatus, filterType, filterUrgent, filterCity, sortOrder, user?.role, user?.id, filterCategory, filterDepartment, dateRange, delayMap]);

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
      
      const payStatus = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : (parseFloat(order.advanceAmount) > 0 ? 'REMAINING' : 'COD');
      groups[phone].paymentSummary = groups[phone].paymentSummary || {};
      groups[phone].paymentSummary[payStatus] = (groups[phone].paymentSummary[payStatus] || 0) + 1;
      
      if (new Date(order.createdAt) > new Date(groups[phone].latestOrderDate)) {
        groups[phone].latestOrderDate = order.createdAt;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestOrderDate) - new Date(a.latestOrderDate));
  }, [filteredOrders]);
  return (
    <div className="space-y-6 md:space-y-10 max-w-7xl mx-auto pb-20 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-10">
        <div className="flex items-center space-x-3 md:space-x-6">
          <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[1.8rem] shadow-2xl shadow-emerald-900/40 rotate-3">
            <Package className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black theme-text-primary tracking-tight leading-none">Production Queue</h1>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-[0.4em] mt-2">Live Monitoring</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="relative group w-full sm:w-72">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-emerald-500 transition-all duration-300" size={16} />
              <input
                type="text"
                placeholder="Search order number or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full theme-input rounded-[1.5rem] py-4 pl-16 pr-6 focus:border-emerald-500 outline-none transition-all text-sm font-black placeholder-gray-800"
              />
            </div>
            
            <button
              onClick={() => setIsGroupedView(!isGroupedView)}
              className={`px-8 py-4 theme-bg-subtle border-2 theme-border rounded-2xl theme-text-primary font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-gray-800 transition-all flex items-center gap-3 ${isUrdu ? 'flex-row-reverse' : ''}`}
            >
              {isGroupedView ? <List size={16} /> : <Users size={16} />}
              <span>{isGroupedView ? (isUrdu ? 'انفرادی منظر' : 'INDIVIDUAL VIEW') : (isUrdu ? 'بڑی تعداد کا منظر' : 'BULK VIEW')}</span>
            </button>

            <LanguageToggle />
        </div>
      </div>

      <div className="flex gap-2 mb-2">
        <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest bg-blue-600 text-white shadow-lg shadow-blue-900/40">
          <Package size={13} />
          All Orders
          <span className="ml-1 px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px] font-black">{orders.length}</span>
        </div>
      </div>

      {/* Priority & Delay summary cards (respect date filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        {[
          { key: 'total', label: 'Total', value: summaryCounts.total, cls: 'bg-blue-600/10 border-blue-500/20 text-blue-400' },
          { key: 'standard', label: '🟢 Standard', value: summaryCounts.standard, cls: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400' },
          { key: 'custom', label: '🧵 Custom', value: summaryCounts.custom, cls: 'bg-purple-600/10 border-purple-500/20 text-purple-400' },
          { key: 'urgent', label: '🟡 Urgent', value: summaryCounts.urgent, cls: 'bg-yellow-600/10 border-yellow-500/20 text-yellow-400' },
          { key: 'super_urgent', label: '🟠 Super Urgent', value: summaryCounts.superUrgent, cls: 'bg-orange-600/10 border-orange-500/20 text-orange-400' },
          { key: 'delayed', label: '🔴 Delayed', value: summaryCounts.delayed, cls: 'bg-red-600/10 border-red-500/20 text-red-400' },
        ].map((c) => (
          <button
            key={c.key}
            onClick={() => setFilterCategory(filterCategory === c.key ? 'all' : c.key)}
            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${c.cls} ${filterCategory === c.key ? 'ring-2 ring-offset-1 ring-blue-500' : 'hover:brightness-125'}`}
            title={`${c.label} orders in selected date range`}
          >
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">{c.label}</span>
            <span className="text-sm md:text-base font-black">{c.value}</span>
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'standard', label: '🟢 Standard' },
          { key: 'custom', label: '🧵 Custom' },
          { key: 'urgent', label: '🟡 Urgent' },
          { key: 'super_urgent', label: '🟠 Super Urgent' },
          { key: 'delayed', label: `🔴 Delayed${summaryCounts.delayed > 0 ? ` (${summaryCounts.delayed})` : ''}` },
        ].map((chip) => {
          const active = filterCategory === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => {
                setFilterCategory(active ? 'all' : chip.key);
                if (chip.key !== 'delayed') setFilterDepartment(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${active
                ? chip.key === 'delayed'
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40 animate-delayed-badge'
                  : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40'
                : 'theme-bg-subtle theme-border theme-text-secondary hover:bg-gray-800 hover:text-white'}`}
            >
              {chip.label}
            </button>
          );
        })}

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="theme-input rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
          title="Summary cards respect this date filter"
        >
          <option value="all">📅 All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 Days</option>
          <option value="thisMonth">This Month</option>
        </select>
      </div>

      {/* Department-wise delayed summary (click to filter that department's delayed orders) */}
      {Object.keys(departmentDelays).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest theme-text-muted">Delayed by Department:</span>
          {Object.entries(departmentDelays).map(([dept, count]) => {
            const active = filterDepartment === dept;
            return (
              <button
                key={dept}
                onClick={() => {
                  setFilterDepartment(active ? null : dept);
                  setFilterCategory('delayed');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${active
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40'
                  : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
              >
                {dept} ({count})
              </button>
            );
          })}
          {filterDepartment && (
            <button
              onClick={() => { setFilterDepartment(null); }}
              className="px-2 py-1 rounded-lg text-xs font-black uppercase tracking-widest theme-text-muted hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      
        <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 theme-text-muted" size={18} />
          <input 
            type="text"
            placeholder="Search by customer name or order ID..."
            className="w-full theme-input rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="theme-input rounded-xl px-4 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 uppercase tracking-widest"
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
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${showFilters ? 'bg-blue-600 border-blue-500 text-white' : 'theme-bg-subtle theme-border theme-text-secondary hover:bg-gray-800 hover:text-white'}`}
          >
            <Filter size={18} />
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Filters</span>
          </button>

           <div className="flex theme-bg border theme-border rounded-xl p-1">
            <button
              onClick={() => setIsGroupedView(false)}
              className={`p-2 rounded-lg transition-all ${!isGroupedView ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white'}`}
              title="Individual View"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setIsGroupedView(true)}
              className={`p-2 rounded-lg transition-all ${isGroupedView ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted hover:text-white'}`}
              title="Bulk Grouped View"
            >
              <Users size={18} />
            </button>
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${sortOrder === 'asc' ? 'bg-amber-600/20 border-amber-500/30 text-amber-400' : 'theme-bg-subtle theme-border theme-text-secondary hover:bg-gray-800 hover:text-white'}`}
            title={sortOrder === 'asc' ? 'Sort: Ascending (oldest first)' : 'Sort: Descending (newest first)'}
          >
            <span className="text-xs font-black uppercase tracking-widest"># {sortOrder === 'asc' ? '↑' : '↓'}</span>
          </button>
        </div>

          {showFilters && (
            <div className="absolute right-0 mt-3 w-72 theme-bg border theme-border rounded-2xl shadow-2xl p-4 md:p-6 z-50 space-y-6">
              <div className="space-y-3">
                <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Order Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full theme-input rounded-xl py-2 px-3 text-xs outline-none focus:border-blue-500"
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
                <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Order Type</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full theme-input rounded-xl py-2 px-3 text-xs outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Types</option>
                  <option value="STANDARD">Standard</option>
                  <option value="FULL_CUSTOM">Full Custom</option>
                  <option value="READY_LOGO">Ready with Logo</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">City</label>
                <input
                  type="text"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="w-full theme-input rounded-xl py-2 px-3 text-xs outline-none focus:border-amber-500"
                  placeholder="Filter by city..."
                />
              </div>

              <div className="flex items-center justify-between p-4 theme-bg border theme-border rounded-xl">
                <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Urgent Only</span>
                <button 
                  onClick={() => setFilterUrgent(!filterUrgent)}
                  className={`w-10 h-5 rounded-full transition-all relative ${filterUrgent ? 'bg-blue-600' : 'bg-gray-800'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${filterUrgent ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 theme-bg border theme-border rounded-xl">
                <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Sort Order</span>
                <button 
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${sortOrder === 'asc' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'}`}
                >
                  #{sortOrder === 'asc' ? ' ↑ Asc' : ' ↓ Desc'}
                </button>
              </div>

              <button 
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterType('ALL');
                  setFilterUrgent(false);
                  setFilterCity('');
                  setShowFilters(false);
                }}
                className="w-full py-2 text-xs md:text-sm font-black uppercase theme-text-muted hover:text-white transition-colors"
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
              <tr className="theme-text-secondary text-xs uppercase border-b border-gray-700 theme-bg-subtle">
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
                  <td colSpan="6" className="px-6 py-20 text-center theme-text-muted">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                      Loading production orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center theme-text-muted">
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
                      <div className="font-bold text-lg theme-text-primary group-hover:text-blue-400 transition-colors">
                        {group.customerName}
                      </div>
                      <div className="flex items-center space-x-2 theme-text-muted font-bold mt-1">
                        <Phone size={12} className="text-blue-500" />
                        <span className="text-xs">{group.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center bg-gray-800 w-10 h-10 rounded-full border border-gray-700 theme-text-primary font-black">
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
                          <span key={status} className={`text-xs md:text-sm font-black px-2 py-1 rounded-lg border ${getStatusStyle(status)}`}>
                            {count} {status.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {Object.entries(group.paymentSummary || {}).map(([payStatus, count]) => (
                          <span key={payStatus} className={`text-xs md:text-sm font-black px-2 py-1 rounded-lg border ${
                            payStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : payStatus === 'REMAINING'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            {count} {payStatus === 'REMAINING' ? 'PARTIAL' : payStatus}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs theme-text-secondary font-bold">
                        {formatDateOnly(group.latestOrderDate)}
                      </div>
                      <div className="text-xs md:text-sm theme-text-muted mt-1 uppercase font-black tracking-widest">
                        {formatTimeOnly(group.latestOrderDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={18} className="theme-text-muted ml-auto" />
                    </td>
                  </tr>
                ))
              ) : (
                filteredOrders.map((order) => {
                  let rawPd = order.productDetails || {};
                  const product = Array.isArray(rawPd) ? (rawPd[0]?.productDetails || rawPd[0] || {}) : (rawPd || {});
                  const isMultiItem = Array.isArray(rawPd) && rawPd.length > 1;
                  const isWaitingApproval = order.stages?.some(s => s.status === 'WAITING_APPROVAL' && s.stageName === order.currentStage);
                  const delay = delayMap[order.id] || null;
                  
                  return (
                  <tr 
                    key={order.id} 
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowModal(true);
                    }}
                    className={`hover:bg-white/5 transition-colors group cursor-pointer ${delay ? 'animate-delayed-row' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg theme-text-primary group-hover:text-blue-400 transition-colors">
                        #{order.orderNumber || order.id.substring(0, 8)}
                      </div>
                      {order.editedByAdmin && (
                        <span className="inline-block bg-amber-500 text-black text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter mt-1">✏️ ADMIN EDITED</span>
                      )}
                      <div className="text-xs theme-text-muted font-medium mt-1">
                        {order.customerName}
                        {order.city && (
                          <span className="ml-2 text-amber-400 font-black bg-amber-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">📍 {order.city}</span>
                        )}
                        {order.deliveryType && (
                          <span className={`ml-2 font-black px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px] ${
                            order.deliveryType === 'DELIVERY'
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-purple-400 bg-purple-500/10'
                          }`}>
                            {order.deliveryType === 'DELIVERY' ? '🚚 Delivery' : '🏪 Self Collection'}
                          </span>
                        )}
                        {order.shopifyOrderDate && (
                          <span className="text-purple-400 ml-2 font-black">Shopify: {formatDateOnly(order.shopifyOrderDate)}</span>
                        )}
                      </div>
                      {order.createdBy?.name && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs md:text-sm font-black bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            By: {order.createdBy.name}
                          </span>
                        </div>
                      )}
                      {order.customerPhone && (
                        <div className="text-xs md:text-sm theme-text-muted font-bold mt-0.5">
                          {order.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold theme-text-primary">
                        {product?.productType || product?.name || 'Standard Item'}
                        {isMultiItem && <span className="ml-2 text-purple-400 text-xs md:text-sm font-black bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">+{rawPd.length - 1} more</span>}
                        {order.quantity > 1 && <span className="ml-2 text-blue-400">x{order.quantity}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs md:text-sm theme-text-muted font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                          {isUrdu ? toUrduName(product?.fabricType || 'STD FABRIC') : (product?.fabricType || 'STD FABRIC')}
                        </span>
                        {product?.color && (
                          <div className="flex items-center space-x-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: product.color.toLowerCase().replace(' ', '') }}></div>
                            <span className="text-xs md:text-sm theme-text-muted font-medium uppercase">{isUrdu ? toUrduName(product.color) : product.color}</span>
                          </div>
                        )}
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded uppercase ${product?.gender === 'Female' ? 'bg-pink-500/10 text-pink-500' : 'bg-blue-500/10 text-blue-400'}`}>
                          {translateGender(product?.gender || 'MALE', isUrdu)}
                        </span>
                        {product?.femaleOptions?.dupatta && (
                          <span className="text-xs md:text-sm font-black bg-pink-600 text-white px-1.5 py-0.5 rounded uppercase">Dupatta</span>
                        )}
                      </div>
                      {/* Custom Requirements */}
                      {(product?.fabricSourceProduct || product?.colorSourceProduct || product?.designSourceProduct || product?.sizeSourceProduct || product?.additionalProductRef) && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {product?.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Fabric: {product.fabricSourceProduct}</span>}
                          {product?.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Color: {product.colorSourceProduct}</span>}
                          {product?.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Design: {product.designSourceProduct}</span>}
                          {product?.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Size: {product.sizeSourceProduct}</span>}
                          {product?.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Extra: {product.additionalProductRef}</span>}
                        </div>
                      )}
                      <div className="text-xs md:text-sm theme-text-muted mt-1">
                        {isPaidOrder(order) ? 'Fully Paid' : getRemainingBalance(order) > 0 ? `COD: ₨${getRemainingBalance(order).toLocaleString()}` : 'CASH ON DELIVERY'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`bg-gray-800 px-2 py-1 rounded-md text-xs md:text-sm font-black border border-gray-700 uppercase tracking-wider ${isWaitingApproval ? 'text-yellow-400 border-yellow-400/30' : 'text-gray-300'}`}>
                        {isWaitingApproval ? `WAITING: ${order.currentStage.replace(/_/g, ' ')}` : order.currentStage.replace(/_/g, ' ')}
                      </span>
                      {delay && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="animate-delayed-badge inline-flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            🔴 DELAYED
                          </span>
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">{delay.department}</span>
                        </div>
                      )}
                      {delay && (
                        <div className="text-[10px] font-bold text-red-400/90 mt-0.5">
                          ⏳ {fmtDuration(delay.delayDuration)} overdue
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {delay ? (
                        <div className="flex items-center space-x-2 text-red-400 text-xs md:text-sm font-black uppercase tracking-widest">
                          <span>🔴</span>
                          <span className="animate-delayed-badge">DELAYED</span>
                        </div>
                      ) : order.priority === 'SUPER_URGENT' ? (
                        <div className="flex items-center space-x-2 text-orange-400 text-xs md:text-sm font-black uppercase tracking-widest">
                          <span>🟠</span>
                          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                          <span>SUPER URGENT</span>
                        </div>
                      ) : order.priority === 'URGENT' ? (
                        <div className="flex items-center space-x-2 text-yellow-400 text-xs md:text-sm font-black uppercase tracking-widest">
                          <span>🟡</span>
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span>URGENT</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-emerald-400 text-xs md:text-sm font-black uppercase tracking-widest">
                          <span>🟢</span>
                          <span>Standard</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs md:text-sm font-black px-2 py-1 rounded-full uppercase border ${getStatusStyle(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      {(() => {
                        const paid = isPaidOrder(order);
                        const remaining = getRemainingBalance(order);
                        const hasAdv = parseFloat(order.advanceAmount) > 0;
                        if (paid) return <span className="text-xs md:text-sm font-black px-2 py-1 rounded-full uppercase border ml-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">PAID</span>;
                        if (hasAdv) return <span className="text-xs md:text-sm font-black px-2 py-1 rounded-full border ml-2 bg-orange-500/10 text-orange-400 border-orange-500/20">COD: ₨{remaining.toLocaleString()}</span>;
                        return <span className="text-xs md:text-sm font-black px-2 py-1 rounded-full uppercase border ml-2 bg-red-500/10 text-red-400 border-red-500/20">CASH ON DELIVERY</span>;
                      })()}
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
                          {['SUPER_ADMIN', 'ADMIN'].includes(user?.role) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                              className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white p-2 rounded-lg transition-all"
                              title="Delete order permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <ChevronRight size={18} className="theme-text-muted" />
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
        let rawPd = selectedOrder.productDetails || {};
        const product = Array.isArray(rawPd) ? (rawPd[0]?.productDetails || rawPd[0] || {}) : (rawPd || {});
        const allItems = Array.isArray(rawPd) ? rawPd : null;
        const isMultiItem = allItems && allItems.length > 0;
        const custom = typeof selectedOrder.customization === 'string' ? JSON.parse(selectedOrder.customization) : selectedOrder.customization;
        const rawSizes = typeof selectedOrder.sizeData === 'string' ? JSON.parse(selectedOrder.sizeData) : selectedOrder.sizeData;
        const isOutletSizeData = rawSizes && typeof rawSizes === 'object' && !Array.isArray(rawSizes) && Object.values(rawSizes).some(v => typeof v === 'object' && v !== null && !Array.isArray(v) && !v._extra);
        const flatSizes = isOutletSizeData ? Object.values(rawSizes).reduce((acc, v) => ({ ...acc, ...v }), {}) : rawSizes;
        
        const standardMeasurements = {
          'S': { chest: '36', shoulder: '14.5', length: '26', sleeve: '22', waist: '30', hips: '38' },
          'M': { chest: '38', shoulder: '15', length: '27', sleeve: '23', waist: '32', hips: '40' },
          'L': { chest: '40', shoulder: '16', length: '28', sleeve: '24', waist: '34', hips: '42' },
          'XL': { chest: '44', shoulder: '17', length: '29', sleeve: '25', waist: '38', hips: '46' },
          '2XL': { chest: '48', shoulder: '18', length: '30', sleeve: '26', waist: '42', hips: '50' }
        };

        const sizes = (flatSizes && Object.keys(flatSizes).length > 0) ? flatSizes : (standardMeasurements[product?.size] || {});
        const hasCustomData = isMultiItem
          ? allItems.some(item => {
              const c = item.customization || {};
              return !c.skipEngraving && (c.engravingType || c.nameSpelling || c.nameColor || c.logoPlacement || c.logos?.length > 0 || c.designNotes || c.designReference || c.articleNames?.length > 0);
            })
          : !custom?.skipEngraving && (custom?.engravingType || custom?.nameSpelling || custom?.nameColor || custom?.logoPlacement || custom?.logos?.length > 0 || custom?.designNotes || custom?.designReference || custom?.articleNames?.length > 0);
        
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
              className="relative w-full max-w-4xl theme-bg border theme-border rounded-xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 md:p-8 border-b theme-border flex justify-between items-center theme-bg-subtle backdrop-blur-md sticky top-0 z-10">
                <div>
                  <div className="flex items-center space-x-4 mb-2">
                    <h2 className="text-2xl md:text-4xl font-black tracking-tighter theme-text-primary">#{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}</h2>
                    {selectedOrder.editedByAdmin && (
                      <span className="bg-amber-500 text-black text-[10px] md:text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">✏️ ADMIN EDITED ORDER</span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 border text-xs md:text-sm font-black uppercase tracking-widest rounded-lg ${selectedOrder.source === 'OUTLET' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                        {selectedOrder.source || 'OUTLET'}: {selectedOrder.outletName || 'MAIN'}
                      </span>
                      <span className="px-3 py-1 bg-gray-800 border border-gray-700 theme-text-secondary text-xs md:text-sm font-black uppercase tracking-widest rounded-lg">
                        Full Job Sheet
                      </span>
                    </div>
                  </div>
                  <p className="theme-text-secondary font-bold tracking-wide">
                    {selectedOrder.customerName}
                    {selectedOrder.city && (
                      <span className="ml-3 text-amber-400 font-black text-sm md:text-base bg-amber-500/10 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                        📍 {selectedOrder.city}
                      </span>
                    )}
                    {selectedOrder.deliveryType && (
                      <span className={`ml-3 font-black text-xs md:text-sm px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                        selectedOrder.deliveryType === 'DELIVERY'
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-purple-400 bg-purple-500/10'
                      }`}>
                        {selectedOrder.deliveryType === 'DELIVERY' ? '🚚 Delivery' : '🏪 Self Collection'}
                      </span>
                    )}
                    {selectedOrder.shopifyOrderDate && (
                      <span className="text-purple-400 ml-3 font-black text-xs md:text-sm">
                        Shopify: {formatDateOnly(selectedOrder.shopifyOrderDate)}
                      </span>
                    )}
                  </p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-4 hover:bg-gray-800 rounded-full theme-text-secondary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-10 custom-scrollbar theme-text-primary">

                {delayMap[selectedOrder.id] && (() => {
                  const d = delayMap[selectedOrder.id];
                  return (
                    <div className="animate-delayed-row rounded-2xl border border-red-500/40 p-4 md:p-5 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="animate-delayed-badge bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full">🔴 DELAYED</span>
                        <span className="text-sm md:text-base font-black text-red-400 uppercase tracking-wider">{d.reason}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                          <p className="text-red-400/70 font-black uppercase tracking-widest text-[9px]">Department</p>
                          <p className="font-black text-red-300">{d.department}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                          <p className="text-red-400/70 font-black uppercase tracking-widest text-[9px]">Overdue By</p>
                          <p className="font-black text-red-300">{fmtDuration(d.delayDuration)}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                          <p className="text-red-400/70 font-black uppercase tracking-widest text-[9px]">In Phase</p>
                          <p className="font-black text-red-300">{fmtDuration(d.phaseElapsed)}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                          <p className="text-red-400/70 font-black uppercase tracking-widest text-[9px]">Total Time</p>
                          <p className="font-black text-red-300">{fmtDuration(d.totalElapsed)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <section>
                  <h4 className="text-xs md:text-sm font-black text-blue-500 uppercase tracking-[0.3em] mb-6">01. Material & Product Specs</h4>
                  {isMultiItem ? (
                    <div className="space-y-6">
                      <div className="overflow-x-auto theme-bg border theme-border rounded-3xl p-4">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b theme-border theme-text-muted uppercase tracking-widest font-black text-xs md:text-sm">
                              <th className="pb-3 pl-4">#</th>
                              <th className="pb-3">Product Base</th>
                              <th className="pb-3">Fabric & Color</th>
                              <th className="pb-3">Size & Gender</th>
                              <th className="pb-3 text-center">Qty</th>
                              <th className="pb-3 text-center">Stock</th>
                              <th className="pb-3 text-right pr-4">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allItems.map((item, idx) => {
                              const p = item.productDetails || {};
                              const c = item.customization || {};
                              const perItemS = item.sizeData;
                              const orderS = rawSizes;
                              const outletS = isOutletSizeData ? (rawSizes?.[p.productType || p.name] || {}) : null;
                              const chartS = standardMeasurements[p.size] || {};
                              const s = (perItemS && Object.values(perItemS).some(v => v)) ? perItemS
                                : (outletS && Object.values(outletS).some(v => v)) ? outletS
                                : (orderS && Object.values(orderS).some(v => v)) ? orderS
                                : chartS;
                              const hasSleeves = p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves);
                              const hasShirtLength = p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength);
                              const hasSizeValues = Object.keys(s).length > 0 && Object.entries(s).some(([k, v]) => v && k !== 'specialNote');
                              const hasSpecialNote = !!(s?.specialNote);

                              return (
                                <tr key={idx} className="border-b theme-border last:border-0 hover:bg-white/5 font-bold">
                                  <td className="py-4 pl-4 font-mono theme-text-muted">{idx + 1}</td>
                                  <td className="py-4 text-white">
                                    {(selectedOrder.productVerification && selectedOrder.productVerification[String(idx)] === true) ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 text-[10px] font-black mr-1.5 align-middle" title="Verified">✓</span> : ''}<span className="text-sm font-black">{p.productType || p.name}</span>
                                    {p.femaleOptions?.dupatta && (
                                      <span className="ml-2 bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs md:text-sm px-1.5 py-0.5 rounded font-black uppercase">Dupatta</span>
                                    )}
                                    {(c.nameSpelling || c.articleNames?.length || c.logos?.length) && (
                                      <div className="mt-1.5 space-y-1.5 text-xs md:text-sm theme-text-secondary font-normal normal-case">
                                        {/* Name Lines */}
                                        {(c.articleNames?.length > 0 || c.nameSpelling) && (
                                          <div className="bg-purple-900/15 rounded-lg p-1.5 border border-purple-500/10">
                                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Names:</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {c.articleNames?.length > 0 ? (
                                                c.articleNames.map((an, ai) => (
                                                  <span key={ai} className="text-xs font-black text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded">L{ai + 1}: {an}</span>
                                                ))
                                              ) : (
                                                <span className="text-xs font-black text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded">{c.nameSpelling}</span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {/* Branding specs */}
                                        {(c.nameColor || c.logoPlacement || c.logoColor || c.engravingType) && (
                                          <div className="flex flex-wrap gap-1">
                                            {c.engravingType && <span className="text-[9px] font-black text-violet-400 bg-violet-900/30 px-1.5 py-0.5 rounded">{c.engravingType === 'direct' ? 'Direct' : 'Patch'} Engraving</span>}
                                            {c.nameColor && <span className="text-[9px] font-black text-rose-400 bg-rose-900/30 px-1.5 py-0.5 rounded">Color: {c.nameColor}</span>}
                                            {c.logoPlacement && <span className="text-[9px] font-black text-teal-400 bg-teal-900/30 px-1.5 py-0.5 rounded">Pos: {fmtPos(c.logoPlacement)}</span>}
                                            {c.logoColor && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">Logo: {c.logoColor}</span>}
                                          </div>
                                        )}
                                        {/* Logos */}
                                        {c.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).map((l, li) => (
                                              <span key={li} className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">{l.name || l.design}{l.design ? `: ${l.design}` : ''}</span>
                                            ))}
                                          </div>
                                        )}
                                        {/* Custom Requirements */}
                                        {(p.fabricSourceProduct || p.colorSourceProduct || p.designSourceProduct || p.sizeSourceProduct || p.additionalProductRef) && (
                                          <div className="flex flex-wrap gap-1">
                                            {p.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Fabric Req: {p.fabricSourceProduct}</span>}
                                            {p.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Color Req: {p.colorSourceProduct}</span>}
                                            {p.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Design Req: {p.designSourceProduct}</span>}
                                            {p.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Size Req: {p.sizeSourceProduct}</span>}
                                            {p.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Extra: {p.additionalProductRef}</span>}
                                          </div>
                                        )}
                                        {/* Special Notes */}
                                        {c.designNotes && (
                                          <div className="text-[10px] text-yellow-400 font-black bg-yellow-900/20 px-1.5 py-0.5 rounded italic leading-tight">📝 {isUrdu ? romanToUrdu(c.designNotes) : c.designNotes}</div>
                                        )}
                                      </div>
                                    )}

                                    {hasSpecialNote && (
                                      <div className="mt-1 text-[10px] text-yellow-400 font-black bg-yellow-900/20 px-1.5 py-0.5 rounded italic leading-tight">📝 Special Note: {isUrdu ? romanToUrdu(s.specialNote) : s.specialNote}</div>
                                    )}
                                  </td>
                                  <td className="py-4 theme-text-secondary">
                                    <div>{isUrdu ? toUrduName(p.fabricType || 'STD FABRIC') : (p.fabricType || 'STD FABRIC')}</div>
                                    <div className="text-xs md:text-sm theme-text-muted font-medium uppercase mt-0.5 flex items-center gap-1.5">
                                      {p.color && (
                                        <>
                                          <div className="w-2 h-2 rounded-full border border-gray-800" style={{ backgroundColor: p.color.toLowerCase().replace(' ', '') }}></div>
                                          {isUrdu ? toUrduName(p.color) : p.color}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 theme-text-secondary uppercase">
                                    <div>{p.size ? `Size ${p.size}${p.gender ? ` • ${translateGender(p.gender, isUrdu)}` : ''}` : translateGender(p.gender, isUrdu) || 'Custom'}</div>
                                    {(hasSleeves || hasShirtLength) && (
                                      <div className="text-xs md:text-sm text-pink-400 font-black mt-0.5">
                                        {hasSleeves && `Sleeves بازو: ${p.sleeveLength ? (isUrdu ? toUrduName({'full':'Full','half':'Half','three-quarter':'3 Quarter'}[p.sleeveLength] || p.sleeveLength) : ({'full':'Full','half':'Half','three-quarter':'3 Quarter'}[p.sleeveLength] || p.sleeveLength)) : (isUrdu ? toUrduName({'full':'Full','half':'Half','medium':'Medium'}[p.femaleOptions?.sleeves] || p.femaleOptions?.sleeves) : ({'full':'Full','half':'Half','medium':'Medium'}[p.femaleOptions?.sleeves] || p.femaleOptions?.sleeves || ''))}`} {hasShirtLength && `| Length: ${p.shirtLength ? (isUrdu ? toUrduName({'long':'Long','short':'Short','regular':'Regular'}[p.shirtLength] || p.shirtLength) : ({'long':'Long','short':'Short','regular':'Regular'}[p.shirtLength] || p.shirtLength)) : (isUrdu ? toUrduName({'long':'Long','short':'Short'}[p.femaleOptions?.shirtLength] || p.femaleOptions?.shirtLength) : ({'long':'Long','short':'Short'}[p.femaleOptions?.shirtLength] || p.femaleOptions?.shirtLength || ''))}`}
                                        {p.alteration && (p.alteration.trouserLength || p.alteration.shirtLength || p.alteration.sleeveLength) && (
                                          <span className="ml-1 text-amber-400 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px]">
                                            Alt: {[p.alteration.trouserLength && `Trouser ${p.alteration.trouserLength}"`, p.alteration.shirtLength && `Shirt ${p.alteration.shirtLength}"`, p.alteration.sleeveLength && `Sleeve ${p.alteration.sleeveLength}"`].filter(Boolean).join(' ')}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {!hasSleeves && !hasShirtLength && p.alteration && (p.alteration.trouserLength || p.alteration.shirtLength || p.alteration.sleeveLength) && (
                                      <div className="text-xs md:text-sm text-amber-400 font-black mt-0.5 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded inline-block">
                                        Alt: {[p.alteration.trouserLength && `Trouser ${p.alteration.trouserLength}"`, p.alteration.shirtLength && `Shirt ${p.alteration.shirtLength}"`, p.alteration.sleeveLength && `Sleeve ${p.alteration.sleeveLength}"`].filter(Boolean).join(' ')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 text-center text-white font-black">{item.quantity || 1}</td>
                                  <td className="py-4 text-center">
                                    {['STORE', 'STORE_EMPLOYEE'].includes(user?.role) && selectedOrder.currentStage !== 'PRODUCTION' && selectedOrder.currentStage !== 'STORE_RECEIVE' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          disabled={productAvailability[idx] === true}
                                          onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, true); }}
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${productAvailability[idx] === true ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : productAvailability[idx] === false ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          disabled={productAvailability[idx] === true}
                                          onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(idx, false); }}
                                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${productAvailability[idx] === false ? 'bg-red-500/20 text-red-400 border border-red-500/30' : productAvailability[idx] === true ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                                        >
                                          ✗
                                        </button>
                                      </div>
                                    ) : productAvailability[idx] === false ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-xs font-black text-red-400">
                                        ✗ {t('Rejected')}
                                      </span>
                                    ) : productAvailability[idx] === true ? (
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
                                  <td className="py-4 text-right pr-4 text-emerald-400 font-black">₨{Number(item.totalPrice || 0).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                      {[
                        { label: 'Product Base', val: (selectedOrder.productVerification && selectedOrder.productVerification['0'] === true ? '✓ ' : '') + (product?.productType || product?.name) },
                        { label: 'Fabric Type', val: isUrdu ? toUrduName(product?.fabricType) : product?.fabricType },
                        { label: 'Primary Color', val: isUrdu ? toUrduName(product?.color) : product?.color },
                        { label: 'Order Size', val: product?.size },
                        { label: 'Gender', val: translateGender(product?.gender, isUrdu) },
                        ...(product?.femaleOptions?.dupatta ? [{ label: 'Dupatta', val: 'Included' }] : []),
                        ...(product?.sleeveLength ? [{ label: 'Sleeve Length', val: isUrdu ? toUrduName({'full':'Full','half':'Half','three-quarter':'3 Quarter'}[product.sleeveLength] || product.sleeveLength) : ({'full':'Full','half':'Half','three-quarter':'3 Quarter'}[product.sleeveLength] || product.sleeveLength) }] : []),
                        ...(product?.shirtLength ? [{ label: 'Shirt Length', val: isUrdu ? toUrduName({'long':'Long','short':'Short','regular':'Regular'}[product.shirtLength] || product.shirtLength) : ({'long':'Long','short':'Short','regular':'Regular'}[product.shirtLength] || product.shirtLength) }] : []),
                        ...(product?.fabricSourceProduct ? [{ label: 'Fabric Required', val: product.fabricSourceProduct }] : []),
                        ...(product?.colorSourceProduct ? [{ label: 'Color Required', val: product.colorSourceProduct }] : []),
                        ...(product?.designSourceProduct ? [{ label: 'Design Required', val: product.designSourceProduct }] : []),
                        ...(product?.sizeSourceProduct ? [{ label: 'Size Required', val: product.sizeSourceProduct }] : []),
                        ...(product?.additionalProductRef ? [{ label: 'Additional Reference', val: product.additionalProductRef }] : []),
                        { label: 'Payment', val: isPaidOrder(selectedOrder) ? 'PAID' : getRemainingBalance(selectedOrder) > 0 ? 'COD' : 'COD' },
                        { label: 'Stock', val: 'toggle' }
                      ].filter(i => i.val).map((item, i) => (
                        <div key={i} className="theme-bg p-4 md:p-6 rounded-3xl border theme-border">
                          <p className="text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest mb-2">{item.label}</p>
                          {item.label === 'Payment' ? (
                            (() => {
                              const paid = isPaidOrder(selectedOrder);
                              const remaining = getRemainingBalance(selectedOrder);
                              if (paid) return <span className="text-lg font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAID</span>;
                              if (remaining > 0) return <span className="text-lg font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">COD: ₨{remaining.toLocaleString()}</span>;
                              return <span className="text-lg font-black px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">CASH ON DELIVERY</span>;
                            })()
                          ) : item.label === 'Stock' ? (
                            (() => {
                              const isStoreRole = ['STORE', 'STORE_EMPLOYEE'].includes(user?.role);
                              const isStoreStage = selectedOrder.currentStage !== 'PRODUCTION' && selectedOrder.currentStage !== 'STORE_RECEIVE';
                              const singleCompleted = productAvailability[0] === true;
                              const singleRejected = productAvailability[0] === false;
                              if (isStoreRole && isStoreStage) {
                                return (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={singleCompleted}
                                      onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, true); }}
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${singleCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-not-allowed' : singleRejected ? 'bg-gray-800 text-gray-500 border border-gray-700' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      disabled={singleCompleted}
                                      onClick={(e) => { e.stopPropagation(); handleProductAvailabilityToggle(0, false); }}
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${singleRejected ? 'bg-red-500/20 text-red-400 border border-red-500/30' : singleCompleted ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-red-500/10 hover:text-red-400'}`}
                                    >
                                      ✗
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <span className={`text-lg font-black ${singleCompleted ? 'text-emerald-400' : singleRejected ? 'text-red-400' : 'text-gray-400'}`}>
                                  {singleCompleted ? t('Completed') : singleRejected ? t('Rejected') : t('Pending')}
                                </span>
                              );
                            })()
                          ) : (
                            <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Outlet Engraving — order-level fields */}
                  {(() => {
                    const en = selectedOrder.engravingNames ? (typeof selectedOrder.engravingNames === 'string' ? (() => { try { return JSON.parse(selectedOrder.engravingNames); } catch { return []; } })() : selectedOrder.engravingNames) : [];
                    const el = selectedOrder.engravingLogos ? (typeof selectedOrder.engravingLogos === 'string' ? (() => { try { return JSON.parse(selectedOrder.engravingLogos); } catch { return []; } })() : selectedOrder.engravingLogos) : [];
                    const hasEng = en.length > 0 || el.length > 0 || selectedOrder.engravingText || selectedOrder.engravingInstructions || selectedOrder.logoRequired || selectedOrder.logoDesign || selectedOrder.instructionNotes;
                    if (!hasEng || selectedOrder.outletName) return null;
                    return (
                      <section className="bg-purple-600/5 p-4 md:p-8 rounded-[2rem] border border-purple-500/10 mt-4">
                        <h4 className="text-xs md:text-sm font-black text-purple-400 uppercase tracking-[0.3em] mb-6">ENGRAVING</h4>
                        <div className="space-y-3">
                          {selectedOrder.engravingType && (
                            <p className="text-purple-400 font-black text-xs uppercase tracking-wider">
                              Type: {selectedOrder.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}
                            </p>
                          )}
                          {selectedOrder.engravingText && <p className="text-white font-bold">{isUrdu ? romanToUrdu(selectedOrder.engravingText) : selectedOrder.engravingText}</p>}
                          {en.length > 0 && (
                            <div>
                              <p className="text-xs font-black text-purple-400 uppercase mb-2">Names:</p>
                              <div className="flex flex-wrap gap-1">
                                {en.filter(Boolean).map((n, i) => (
                                  <span key={i} className="text-xs font-black text-purple-300 bg-purple-900/30 px-1.5 py-0.5 rounded">L{i+1}: {n}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedOrder.logoDesign && (
                            <div>
                              <p className="text-xs font-black text-purple-400 uppercase mb-2">Logo:</p>
                              <span className="text-xs font-black text-amber-300 bg-amber-900/30 px-2 py-1 rounded">{selectedOrder.logoDesign}</span>
                            </div>
                          )}
                          {selectedOrder.logoRequired && el.length > 0 && (
                            <div>
                              <p className="text-xs font-black text-purple-400 uppercase mb-2">Logos:</p>
                              <div className="flex flex-wrap gap-1">
                                {el.filter(Boolean).map((l, i) => (
                                  <span key={i} className="text-xs font-black text-amber-300 bg-amber-900/30 px-1.5 py-0.5 rounded">{l}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedOrder.engravingInstructions && (
                            <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3">
                              <p className="text-xs font-black text-yellow-400 uppercase mb-1">Special Notes:</p>
                              <p className="text-sm text-yellow-300 font-medium italic">{isUrdu ? romanToUrdu(selectedOrder.engravingInstructions) : selectedOrder.engravingInstructions}</p>
                            </div>
                          )}
                          {selectedOrder.instructionNotes && (
                            <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 mt-2">
                              <p className="text-xs font-black text-yellow-400 uppercase mb-1">Instruction Notes:</p>
                              <p className="text-sm text-yellow-300 font-medium italic">{selectedOrder.instructionNotes}</p>
                            </div>
                          )}
                        </div>
                      </section>
                    );
                  })()}
                </section>



                {selectedOrder.type !== 'STANDARD' && hasCustomData && (
                <section>
                  <h4 className="text-xs md:text-sm font-black text-emerald-500 uppercase tracking-[0.3em] mb-6">
                    {isMultiItem ? '03. Per-Product Engraving' : '03. Engraving'}
                  </h4>
                  {isMultiItem ? (
                    <div className="space-y-6">
                      {allItems.map((item, idx) => {
                        const c = item.customization || {};
                        const p = item.productDetails || {};
                        return (
                          <div key={idx} className="bg-gray-900/50 p-4 md:p-6 rounded-2xl border border-gray-800/70">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">#{idx + 1}</span>
                              <span className="text-sm font-black text-white uppercase">{p.productType || `Item ${idx + 1}`}</span>
                              {p.color && <span className="text-xs font-black text-gray-400">({isUrdu ? toUrduName(p.color) : p.color})</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Names / Lines */}
                              {(c.articleNames?.length > 0 || c.nameSpelling) && (
                                <div className="bg-purple-500/5 p-3 rounded-xl border border-purple-500/10">
                                  <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-2">Name Lines</p>
                                  <div className="space-y-1.5">
                                    {c.articleNames?.length > 0 ? (
                                      c.articleNames.map((an, ai) => (
                                        <div key={ai} className="flex items-center gap-2">
                                          <span className="text-[9px] font-black text-purple-500 bg-purple-900/30 w-10 py-0.5 rounded text-center">L{ai + 1}</span>
                                          <span className="text-sm font-black text-purple-300">{an}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-purple-500 bg-purple-900/30 w-10 py-0.5 rounded text-center">L1</span>
                                        <span className="text-sm font-black text-purple-300">{c.nameSpelling}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {/* Branding Specs */}
                              <div className="space-y-2">
                                {(c.nameColor || c.logoPlacement || c.engravingType) && (
                                  <div className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-2">Tailoring Specs</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {c.engravingType && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Engraving</span><p className="text-xs font-black text-violet-400">{c.engravingType === 'direct' ? 'Direct' : 'Patch'}</p></div>}
                                      {c.nameColor && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Color</span><p className="text-xs font-black text-rose-400">{c.nameColor}</p></div>}
                                      {c.logoPlacement && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Position</span><p className="text-xs font-black text-teal-400">{fmtPos(c.logoPlacement)}</p></div>}
                                      {c.logoColor && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Logo Color</span><p className="text-xs font-black text-amber-400">{c.logoColor}</p></div>}
                                    </div>
                                  </div>
                                )}
                                {/* Custom Requirements */}
                                {(p.fabricSourceProduct || p.colorSourceProduct || p.designSourceProduct || p.sizeSourceProduct || p.additionalProductRef) && (
                                  <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                                    <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-2">Custom Requirements</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {p.fabricSourceProduct && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Fabric Req</span><p className="text-xs font-black text-amber-300">{p.fabricSourceProduct}</p></div>}
                                      {p.colorSourceProduct && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Color Req</span><p className="text-xs font-black text-amber-300">{p.colorSourceProduct}</p></div>}
                                      {p.designSourceProduct && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Design Req</span><p className="text-xs font-black text-amber-300">{p.designSourceProduct}</p></div>}
                                      {p.sizeSourceProduct && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Size Req</span><p className="text-xs font-black text-amber-300">{p.sizeSourceProduct}</p></div>}
                                      {p.additionalProductRef && <div><span className="text-[9px] text-gray-500 font-bold uppercase">Extra Ref</span><p className="text-xs font-black text-amber-300">{p.additionalProductRef}</p></div>}
                                    </div>
                                  </div>
                                )}
                                {/* Logos */}
                                {c.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 && (
                                  <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                                    <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-2">Logos</p>
                                    {c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).map((l, li) => (
                                      <div key={li} className="text-xs font-black text-amber-300 bg-amber-900/20 px-2 py-1 rounded border border-amber-500/20 mb-1 last:mb-0">
                                        {l.name || l.design}{l.name && l.design ? ` — ${l.design}` : ''}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Special Notes for this product */}
                            {c.designNotes && (
                              <div className="mt-3 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10">
                                <p className="text-[10px] text-yellow-400 font-black uppercase tracking-widest mb-0.5">Special Note</p>
                                <p className="text-xs font-bold text-yellow-300/90 italic leading-tight">{isUrdu ? romanToUrdu(c.designNotes) : c.designNotes}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                      <div>
                        <div className="space-y-4">
                          {[
                            { l: 'Engraving Type', v: custom?.engravingType === 'direct' ? 'Direct Engraving' : custom?.engravingType === 'patch' ? 'Patch Engraving' : null },
                            { l: 'Branding Name', v: custom?.nameSpelling },
                            { l: 'Embroidery Color', v: custom?.nameColor },
                            { l: 'Logo Location', v: custom?.logoPlacement ? fmtPos(custom.logoPlacement) : null },
                          ].filter(item => item.v).map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-4 theme-bg rounded-2xl border theme-border">
                              <span className="text-xs md:text-sm theme-text-muted font-bold uppercase tracking-widest">{item.l}</span>
                              <span className="text-sm font-black text-emerald-400">{item.v || 'N/A'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs md:text-sm font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">04. Design Notes & Reference</h4>
                        <div className="space-y-4">
                          <div className="bg-yellow-500/5 p-4 md:p-6 rounded-3xl border border-yellow-500/10 italic theme-text-secondary text-sm shadow-inner">
                            <p className="text-xs md:text-sm text-yellow-600 font-black uppercase mb-2">Instructions:</p>
                            {custom?.designNotes ? (isUrdu ? romanToUrdu(custom.designNotes) : custom.designNotes) : 'No special design notes.'}
                          </div>
                          {custom?.designReference && (
                            <div className="bg-blue-500/5 p-4 md:p-6 rounded-3xl border border-blue-500/10 italic theme-text-secondary text-sm shadow-inner">
                              <p className="text-xs md:text-sm text-blue-600 font-black uppercase mb-2">Design Cross-Reference:</p>
                              {custom.designReference}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
                )}

                {selectedOrder.type === 'FULL_CUSTOM' || delayMap[selectedOrder.id] ? (
                <section>
                    <div className="flex justify-between items-center mb-6">
                       <h4 className={`text-xs md:text-sm font-black uppercase tracking-[0.3em] ${delayMap[selectedOrder.id] ? 'text-red-500' : 'text-blue-500'}`}>
                         {delayMap[selectedOrder.id] ? '🔴 05. Production Timeline (Delayed Phase Highlighted)' : '05. Production Timeline'}
                       </h4>
                       <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest bg-gray-950 px-3 py-1 rounded-full border border-gray-800">
                         {selectedOrder.stages?.length || 0} Stages
                       </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {(() => {
                         const orderDelay = delayMap[selectedOrder.id] || null;
                         const stages = [...(selectedOrder.stages || [])]
                           .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                           .map((stageData, i) => {
                           const isCompleted = stageData.status === 'COMPLETED';
                           const isCurrent = selectedOrder.currentStage === stageData.stageName;
                           const isOrderEntry = stageData.stageName === 'ORDER_ENTRY';
                           const isDelayed = orderDelay && orderDelay.stage === stageData.stageName && isCurrent;
                           
                           const displayTime = isCompleted ? (
                             formatDateTime(stageData.completedAt)
                           ) : isOrderEntry ? (
                             `Created: ${formatDateTime(selectedOrder.createdAt)}`
                           ) : stageData.deadlineAt ? (
                             `Target: ${formatDateTime(stageData.deadlineAt)}`
                           ) : '-';
                           
                           return (
                             <div key={stageData.id || i} className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                               isDelayed ? 'bg-red-600/10 border-red-500 animate-delayed-row' :
                               isCompleted ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 
                               isCurrent ? 'bg-blue-600/10 border-blue-500 animate-pulse' : 
                               'theme-bg theme-border'
                             }`}>
                               <div className="flex items-center gap-3">
                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs md:text-sm font-black ${
                                   isDelayed ? 'bg-red-500 text-white animate-delayed-badge' :
                                   isCompleted ? 'bg-emerald-500 text-white' : 
                                   isCurrent ? 'bg-blue-500 text-white' : 
                                   'bg-gray-800 theme-text-muted'
                                 }`}>
                                   {i + 1}
                                 </div>
                                 <span className={`text-xs md:text-sm font-black uppercase tracking-widest ${isDelayed ? 'text-red-400' : isCompleted ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'theme-text-muted'}`}>
                                   {stageData.stageName.replace(/_/g, ' ')}
                                 </span>
                                 {isDelayed && (
                                   <span className="animate-delayed-badge bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">DELAYED</span>
                                 )}
                               </div>
                               <span className={`text-xs md:text-sm font-bold font-mono whitespace-nowrap ${isDelayed ? 'text-red-400' : isCompleted ? 'text-emerald-600' : isOrderEntry ? 'theme-text-secondary' : 'theme-text-muted'}`}>
                                 {displayTime}
                               </span>
                             </div>
                           );
                         });
                         return stages.length > 0 ? stages : <p className="text-gray-500 text-sm">No stages recorded</p>;
                       })()}
                    </div>
                    

                 </section>
                ) : null}

               </div>

               <div className="p-4 md:p-8 theme-bg border-t theme-border flex justify-between items-center">
                <div className="flex items-center gap-3 text-xs md:text-sm theme-text-muted font-black uppercase tracking-widest flex-wrap">
                  <span className="text-emerald-400">Entry: {formatDateTime(selectedOrder.createdAt)}</span>
                  <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                  <span>Stage: {selectedOrder.currentStage}</span>
                </div>
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
                    <Download size={14} /> Print Job Sheet
                  </button>
                  <button 
                    onClick={() => setShowModal(false)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Close Job Sheet
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Print Filter Modal */}
      {showPrintFilter && selectedOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrintFilter(false)}></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative theme-bg rounded-3xl border theme-border p-6 md:p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-lg font-black uppercase tracking-widest mb-6">Print Job Sheet Sections</h3>
              <div className="space-y-4 mb-8">
                <label className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 cursor-not-allowed opacity-60">
                  <input type="checkbox" checked={true} disabled className="w-5 h-5 accent-emerald-500" />
                  <div>
                    <p className="text-sm font-black text-emerald-400">Order & Product Details</p>
                    <p className="text-xs text-gray-500">Customer info, order details, products</p>
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
                    <p className="text-sm font-black">Measurements</p>
                    <p className="text-xs text-gray-500">Size, custom measurements, special note</p>
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
                    <p className="text-sm font-black">Engraving / Customization</p>
                    <p className="text-xs text-gray-500">Engraving text, logos, design notes</p>
                  </div>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { printJobSheet(selectedOrder, user?.role, printLang, printSections); setShowPrintFilter(false); }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                >
                  Print
                </button>
                <button
                  onClick={() => setShowPrintFilter(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
};

export default AllOrders;
