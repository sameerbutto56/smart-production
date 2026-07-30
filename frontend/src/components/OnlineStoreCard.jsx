import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Loader2, Globe, TrendingUp, Activity, Package, User, X, RefreshCw,
  BarChart3, ShoppingCart, DollarSign, Eye, ChevronRight, Clock,
  CheckCircle2, AlertTriangle, Truck, RotateCcw, Search, ChevronDown,
  Calendar, CreditCard, Star, ArrowUpRight, ArrowDownRight, Users,
  FileText, Zap, Target, Crown, ShoppingBag, Percent, Heart,
  MessageSquare, Layers, CircleDot
} from 'lucide-react';
import socket from '../socket';
import { isPaidOrder, getRemainingBalance } from '../utils/paymentUtils';
import { toUrduName } from '../utils/urduDictionary';

const COLORS = {
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', ring: 'ring-cyan-500/20' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', ring: 'ring-emerald-500/20' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', ring: 'ring-blue-500/20' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', ring: 'ring-amber-500/20' },
  red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', ring: 'ring-red-500/20' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', ring: 'ring-purple-500/20' },
  pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30', ring: 'ring-pink-500/20' },
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', ring: 'ring-indigo-500/20' },
  gray: { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', ring: 'ring-gray-500/20' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', ring: 'ring-teal-500/20' },
  lime: { text: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30', ring: 'ring-lime-500/20' },
};

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', LOGO_DESIGN: 'Logo Design',
  PRODUCTION_ACCEPTANCE: 'Prod. Acceptance', PRODUCTION: 'Production',
  STORE_RECEIVE: 'Store Receive', DISPATCH: 'Dispatch',
  OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered',
};

const STAGE_COLORS = {
  ORDER_ENTRY: 'cyan', STORE: 'amber', LOGO_DESIGN: 'purple',
  PRODUCTION_ACCEPTANCE: 'blue', PRODUCTION: 'emerald',
  STORE_RECEIVE: 'teal', DISPATCH: 'indigo',
  OUT_FOR_DELIVERY: 'pink', DELIVERED: 'emerald',
};

const STATUS_COLORS = {
  PENDING: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  IN_PROGRESS: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  COMPLETED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  DELIVERED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  RETURNED: 'text-red-400 bg-red-500/10 border-red-500/30',
  REPLACED: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  CANCELLED: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const ORDER_TYPE_LABELS = {
  STANDARD: 'Standard', READY_LOGO: 'Ready Logo', CUSTOM_LOGO: 'Custom Logo', FULL_CUSTOM: 'Full Custom',
};

const PRIORITY_LABELS = {
  NORMAL: 'Normal', URGENT: 'Urgent', SUPER_URGENT: 'Super Urgent', LOW: 'Low', HIGH: 'High',
};

const PRIORITY_COLORS = {
  NORMAL: 'text-gray-400 bg-gray-500/10', URGENT: 'text-amber-400 bg-amber-500/10',
  SUPER_URGENT: 'text-red-400 bg-red-500/10', LOW: 'text-blue-400 bg-blue-500/10', HIGH: 'text-orange-400 bg-orange-500/10',
};

const InlineList = ({ items, title, columns, onClose, renderItem }) => (
  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    className="overflow-hidden mb-4">
    <div className="glass rounded-xl border theme-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="theme-text-primary font-bold text-sm">{title} ({items.length})</h4>
        <button onClick={onClose} className="theme-text-muted hover:text-red-400 transition-colors"><X size={16} /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {items.length === 0 && <p className="theme-text-muted text-xs text-center py-4">No items found</p>}
        {renderItem ? items.map((item, i) => <div key={i}>{renderItem(item, i)}</div>) :
          items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors text-xs">
              {columns.map((col, ci) => (
                <span key={ci} className={col.color || 'theme-text-secondary'}>
                  {col.render ? col.render(item) : item[col.key]}
                </span>
              ))}
            </div>
          ))}
      </div>
    </div>
  </motion.div>
);

const DetailModal = ({ title, items, columns, onClose, children }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={onClose}>
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
      className="glass rounded-[2rem] border-2 theme-border w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-6 pb-4 border-b theme-border">
        <h3 className="theme-text-primary font-black text-lg">{title}</h3>
        <button onClick={onClose} className="theme-text-muted hover:text-red-400 transition-colors"><X size={20} /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-6">
        {children || (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b theme-border">
                {columns.map((col, i) => <th key={i} className="text-left p-2 theme-text-muted font-bold">{col.label}</th>)}
              </tr></thead>
              <tbody>
                {(items || []).map((row, ri) => (
                  <tr key={ri} className="border-b theme-border/50 hover:bg-white/5">
                    {columns.map((col, ci) => (
                      <td key={ci} className="p-2 theme-text-secondary">
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  </motion.div>
);

const BarChartSimple = ({ data, labelKey, valueKey, color = 'cyan', maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 12).map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="theme-text-secondary text-xs w-28 truncate shrink-0" title={item[labelKey]}>{item[labelKey]}</span>
          <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${((item[valueKey] || 0) / max) * 100}%` }}
              className={`h-full rounded-full bg-${color}-500/60`} transition={{ delay: i * 0.05, duration: 0.4 }} />
          </div>
          <span className="theme-text-primary text-xs font-bold w-16 text-right">{(item[valueKey] || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const OnlineStoreCard = ({ activeTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [dateRange, setDateRange] = useState('all');
  const [dateFrom, setdateFrom] = useState('');
  const [dateTo, setdateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const refreshRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (dateRange === 'custom' && dateFrom && dateTo) {
        params.dateFrom = dateFrom;
        params.dateTo = dateTo;
      } else if (dateRange !== 'all') {
        params.range = dateRange;
      }
      const res = await api.get('/api/online-dashboard/stats', { params });
      setData(res.data);
    } catch (err) {
      console.error('Online Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'online_store') {
      setLoading(true);
      fetchData();
      refreshRef.current = setInterval(fetchData, 30000);
      return () => clearInterval(refreshRef.current);
    }
  }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'online_store') return;
    const handleUpdate = () => fetchData();
    socket.on('order-updated', handleUpdate);
    socket.on('new-order', handleUpdate);
    socket.on('stage-completion-requested', handleUpdate);
    socket.on('payment-updated', handleUpdate);
    return () => { socket.off('order-updated', handleUpdate); socket.off('new-order', handleUpdate); socket.off('stage-completion-requested', handleUpdate); socket.off('payment-updated', handleUpdate); };
  }, [activeTab, fetchData]);

  const filteredOrdersByFilter = useMemo(() => {
    const orders = data?.allOrders || data?.recentOrders || [];
    const activeStages = ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'];
    return {
      all: orders,
      active: orders.filter(o => activeStages.includes(o.currentStage) && o.status !== 'CANCELLED'),
      pending: orders.filter(o => o.status === 'PENDING'),
      inProgress: orders.filter(o => o.status === 'IN_PROGRESS'),
      delivered: orders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'DELIVERED' || o.status === 'COMPLETED'),
      returned: orders.filter(o => o.status === 'RETURNED'),
      replaced: orders.filter(o => o.status === 'REPLACED'),
      cancelled: orders.filter(o => o.status === 'CANCELLED'),
      urgent: orders.filter(o => o.priority === 'URGENT' || o.priority === 'SUPER_URGENT'),
      cod: orders.filter(o => o.paymentStatus === 'PENDING' || o.paymentStatus === 'WAITING_PAYMENT'),
      paid: orders.filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID'),
      normal: orders.filter(o => o.priority === 'NORMAL'),
      standard: orders.filter(o => o.type === 'STANDARD'),
      readyLogo: orders.filter(o => o.type === 'READY_LOGO'),
      customLogo: orders.filter(o => o.type === 'CUSTOM_LOGO'),
      fullCustom: orders.filter(o => o.type === 'FULL_CUSTOM'),
      ORDER_ENTRY: orders.filter(o => o.currentStage === 'ORDER_ENTRY'),
      STORE: orders.filter(o => o.currentStage === 'STORE'),
      LOGO_DESIGN: orders.filter(o => o.currentStage === 'LOGO_DESIGN'),
      PRODUCTION_ACCEPTANCE: orders.filter(o => o.currentStage === 'PRODUCTION_ACCEPTANCE'),
      PRODUCTION: orders.filter(o => o.currentStage === 'PRODUCTION'),
      STORE_RECEIVE: orders.filter(o => o.currentStage === 'STORE_RECEIVE'),
      DISPATCH: orders.filter(o => o.currentStage === 'DISPATCH'),
      OUT_FOR_DELIVERY: orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY'),
    };
  }, [data]);

  const filteredSearchOrders = useMemo(() => {
    const orders = data?.allOrders || data?.recentOrders || [];
    if (!searchTerm) return orders;
    const s = searchTerm.toLowerCase();
    return orders.filter(o =>
      (o.orderNumber || '').toLowerCase().includes(s) ||
      (o.customerName || '').toLowerCase().includes(s) ||
      (o.customerPhone || '').includes(s) ||
      (o.invoiceNumber || '').toLowerCase().includes(s)
    );
  }, [data, searchTerm]);

  const sectionNav = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'stages', label: 'Stages', icon: Layers },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'products', label: 'Products', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Heart },
    { id: 'priorities', label: 'Priorities', icon: Zap },
    { id: 'types', label: 'Order Types', icon: FileText },
    { id: 'orders', label: 'All Orders', icon: Globe },
  ];

  const handleFilterClick = (key) => setSelectedFilter(prev => prev === key ? null : key);

  const getFilteredItems = useCallback(() => {
    if (!filteredOrdersByFilter[selectedFilter]) return { items: [], title: '', columns: [] };
    const orders = filteredOrdersByFilter[selectedFilter];
    const titles = {
      all: 'All Orders', active: 'Active Orders', pending: 'Pending Orders', inProgress: 'In Progress',
      delivered: 'Delivered Orders', returned: 'Returned Orders', replaced: 'Replaced Orders',
      cancelled: 'Cancelled Orders', urgent: 'Urgent Orders', cod: 'COD Orders', paid: 'Paid Orders',
      normal: 'Normal Priority', standard: 'Standard Orders', readyLogo: 'Ready Logo',
      customLogo: 'Custom Logo', fullCustom: 'Full Custom',
      ORDER_ENTRY: 'Order Entry', STORE: 'Store', LOGO_DESIGN: 'Logo Design',
      PRODUCTION_ACCEPTANCE: 'Production Acceptance', PRODUCTION: 'Production',
      STORE_RECEIVE: 'Store Receive', DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery',
    };
    return {
      items: orders,
      title: titles[selectedFilter] || selectedFilter,
      columns: [
        { label: 'Order #', key: 'orderNumber' },
        { label: 'Customer', key: 'customerName' },
        { label: 'Amount', render: (r) => fmt(r.totalPrice) },
        { label: 'Stage', render: (r) => (
          <span className="text-[10px] font-bold theme-text-muted">{STAGE_LABELS[r.currentStage] || r.currentStage}</span>
        )},
        { label: 'Status', render: (r) => (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[r.status] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{r.status}</span>
        )},
        { label: 'Date', render: (r) => new Date(r.createdAt).toLocaleDateString() },
      ],
    };
  }, [selectedFilter, filteredOrdersByFilter]);

  if (loading && !data) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-cyan-400" size={40} />
    </div>
  );

  if (!data) return (
    <div className="text-center py-20 theme-text-muted">
      <AlertTriangle className="mx-auto mb-4" size={40} />
      <p>Failed to load online dashboard data</p>
      <button onClick={fetchData} className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl text-sm font-bold hover:bg-cyan-500/30 transition-colors">Retry</button>
    </div>
  );

  const { summary, stages, priorities, orderTypes, revenue, payments, employees, productPerformance, customers, recentOrders, dailyTrend } = data;

  const filteredItems = getFilteredItems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black theme-text-primary flex items-center gap-3">
            <Globe className="text-cyan-400" size={28} />
            Online Store Analytics
          </h2>
          <p className="theme-text-muted text-sm mt-1">Complete overview of online business operations</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="theme-bg-subtle theme-border border rounded-xl px-3 py-2 text-xs theme-text-primary font-bold">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setdateFrom(e.target.value)}
                className="theme-bg-subtle theme-border border rounded-xl px-3 py-2 text-xs theme-text-primary" />
              <input type="date" value={dateTo} onChange={e => setdateTo(e.target.value)}
                className="theme-bg-subtle theme-border border rounded-xl px-3 py-2 text-xs theme-text-primary" />
            </>
          )}
          <button onClick={fetchData}
            className={`p-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors ${loading ? 'animate-spin' : ''}`}>
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {sectionNav.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeSection === s.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'theme-bg-subtle theme-text-muted hover:text-cyan-400 border border-transparent'
              }`}>
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* === OVERVIEW SECTION === */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Orders', value: summary.total, icon: ShoppingCart, color: 'cyan', filterKey: 'all' },
              { label: 'Active Orders', value: summary.activeOrders, icon: Activity, color: 'blue', filterKey: 'active' },
              { label: 'Delivered', value: summary.delivered, icon: CheckCircle2, color: 'emerald', filterKey: 'delivered' },
              { label: 'Revenue', value: fmt(revenue.totalRevenue), icon: DollarSign, color: 'emerald' },
            ].map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl border-2 ${COLORS[card.color].border} p-4 ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''} transition-transform`}
                onClick={() => card.filterKey && handleFilterClick(card.filterKey)}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${COLORS[card.color].bg}`}><card.icon className={COLORS[card.color].text} size={20} /></div>
                  <div>
                    <p className="theme-text-muted text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
                    <p className="theme-text-primary font-black text-xl">{card.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Order Summary Row */}
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" /> ORDER SUMMARY
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Pending', value: summary.pending, color: 'amber', filterKey: 'pending' },
                { label: 'In Progress', value: summary.inProgress, color: 'blue', filterKey: 'inProgress' },
                { label: 'Returned', value: summary.returned, color: 'red', filterKey: 'returned' },
                { label: 'Replaced', value: summary.replaced, color: 'amber' },
                { label: 'Cancelled', value: summary.cancelled, color: 'gray' },
                { label: 'COD Orders', value: payments.codOrders, color: 'purple', filterKey: 'cod' },
                { label: 'Paid Orders', value: payments.paidOrders, color: 'emerald', filterKey: 'paid' },
                { label: 'Avg Order Value', value: fmt(revenue.avgOrderValue), color: 'indigo' },
              ].map((item, i) => (
                <motion.div key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className={`rounded-xl border ${COLORS[item.color].border} ${COLORS[item.color].bg} p-3 ${item.filterKey ? 'cursor-pointer' : ''}`}
                  onClick={() => item.filterKey && handleFilterClick(item.filterKey)}>
                  <p className="theme-text-muted text-[10px] font-bold uppercase">{item.label}</p>
                  <p className={`font-black text-lg ${COLORS[item.color].text}`}>{item.value}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Revenue & Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-400" /> REVENUE
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Revenue', value: fmt(revenue.totalRevenue), color: 'text-emerald-400' },
                  { label: 'Total Billing', value: fmt(revenue.totalBilling), color: 'text-cyan-400' },
                  { label: 'Total Profit', value: fmt(revenue.totalProfit), color: 'text-emerald-400' },
                  { label: 'Total Loss', value: fmt(revenue.totalLoss), color: 'text-red-400' },
                  { label: 'Returns Value', value: fmt(revenue.totalReturnsValue), color: 'text-amber-400' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b theme-border/30">
                    <span className="theme-text-muted text-xs">{r.label}</span>
                    <span className={`font-black text-sm ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-blue-400" /> PAYMENTS
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Cash Received', value: fmt(payments.cashReceived), color: 'text-emerald-400' },
                  { label: 'Online Received', value: fmt(payments.onlineReceived), color: 'text-blue-400' },
                  { label: 'Card Received', value: fmt(payments.cardReceived), color: 'text-purple-400' },
                  { label: 'Total Received', value: fmt(payments.totalReceived), color: 'text-cyan-400' },
                  { label: 'Outstanding', value: fmt(payments.outstanding), color: 'text-red-400' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b theme-border/30">
                    <span className="theme-text-muted text-xs">{r.label}</span>
                    <span className={`font-black text-sm ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority & Type Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <Zap size={16} className="text-amber-400" /> PRIORITIES
              </h3>
              <div className="space-y-2">
                {Object.entries(priorities).filter(([,v]) => v > 0).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[key] || ''}`}>{PRIORITY_LABELS[key] || key}</span>
                    <span className="theme-text-primary font-black text-sm">{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <FileText size={16} className="text-purple-400" /> ORDER TYPES
              </h3>
              <div className="space-y-2">
                {Object.entries(orderTypes).filter(([,v]) => v > 0).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/5">
                    <span className="theme-text-secondary text-xs font-bold">{ORDER_TYPE_LABELS[key] || key}</span>
                    <span className="theme-text-primary font-black text-sm">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          {dailyTrend.length > 0 && (
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" /> DAILY TREND (Last 30 Days)
              </h3>
              <BarChartSimple data={dailyTrend.map(d => ({ ...d, label: d.date.slice(5) }))} labelKey="label" valueKey="orders" color="cyan" />
            </div>
          )}
        </div>
      )}

      {/* === STAGES SECTION === */}
      {activeSection === 'stages' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" /> ORDER STAGE PIPELINE
            </h3>
            <p className="theme-text-muted text-xs mb-5">Live overview of where every online order currently is</p>
            <div className="space-y-3">
              {Object.entries(stages).map(([key, count]) => {
                const pct = summary.total > 0 ? (count / summary.total * 100) : 0;
                const color = STAGE_COLORS[key] || 'gray';
                return (
                  <div key={key} className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => handleFilterClick(key)}>
                    <div className={`w-2 h-2 rounded-full bg-${color}-400 shrink-0`} />
                    <span className="theme-text-secondary text-xs font-bold w-40">{STAGE_LABELS[key]}</span>
                    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        className={`h-full rounded-full bg-${color}-500/50`} transition={{ duration: 0.5 }} />
                    </div>
                    <span className="theme-text-primary font-black text-sm w-10 text-right">{count}</span>
                    <span className="theme-text-muted text-[10px] w-12 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage summary cards */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(stages).map(([key, count]) => {
              const color = STAGE_COLORS[key] || 'gray';
              return (
                <motion.div key={key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className={`rounded-xl border ${COLORS[color].border} ${COLORS[color].bg} p-3 text-center cursor-pointer`}
                  onClick={() => handleFilterClick(key)}>
                  <p className="theme-text-muted text-[10px] font-bold uppercase truncate">{STAGE_LABELS[key]}</p>
                  <p className={`font-black text-xl ${COLORS[color].text}`}>{count}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* === REVENUE SECTION === */}
      {activeSection === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Revenue', value: fmt(revenue.totalRevenue), color: 'emerald', icon: DollarSign },
              { label: 'Total Billing', value: fmt(revenue.totalBilling), color: 'cyan', icon: BarChart3 },
              { label: 'Total Profit', value: fmt(revenue.totalProfit), color: 'emerald', icon: TrendingUp },
              { label: 'Total Loss', value: fmt(revenue.totalLoss), color: 'red', icon: ArrowDownRight },
              { label: 'Returns Value', value: fmt(revenue.totalReturnsValue), color: 'amber', icon: RotateCcw },
              { label: 'Avg Order Value', value: fmt(revenue.avgOrderValue), color: 'blue', icon: Target },
            ].map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl border-2 ${COLORS[card.color].border} p-5`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${COLORS[card.color].bg}`}><card.icon className={COLORS[card.color].text} size={22} /></div>
                  <div>
                    <p className="theme-text-muted text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
                    <p className="theme-text-primary font-black text-2xl">{card.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Revenue Profitability */}
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4">PROFITABILITY ANALYSIS</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="theme-text-muted text-xs font-bold uppercase">Profit Margin</p>
                <p className="text-emerald-400 font-black text-2xl mt-1">
                  {revenue.totalRevenue > 0 ? `${((revenue.totalProfit / revenue.totalRevenue) * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="theme-text-muted text-xs font-bold uppercase">Loss Rate</p>
                <p className="text-red-400 font-black text-2xl mt-1">
                  {revenue.totalBilling > 0 ? `${((revenue.totalLoss / revenue.totalBilling) * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="theme-text-muted text-xs font-bold uppercase">Return Rate</p>
                <p className="text-amber-400 font-black text-2xl mt-1">
                  {summary.total > 0 ? `${((summary.returned / summary.total) * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue Trend */}
          {dailyTrend.length > 0 && (
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4">REVENUE TREND</h3>
              <BarChartSimple data={dailyTrend.filter(d => d.revenue > 0).map(d => ({ ...d, label: d.date.slice(5) }))} labelKey="label" valueKey="revenue" color="emerald" />
            </div>
          )}
        </div>
      )}

      {/* === PAYMENTS SECTION === */}
      {activeSection === 'payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Cash Received', value: fmt(payments.cashReceived), color: 'emerald', filterKey: 'cod' },
              { label: 'Online Received', value: fmt(payments.onlineReceived), color: 'blue' },
              { label: 'Card Received', value: fmt(payments.cardReceived), color: 'purple' },
              { label: 'Total Received', value: fmt(payments.totalReceived), color: 'cyan' },
            ].map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass rounded-2xl border-2 ${COLORS[card.color].border} p-4 ${card.filterKey ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-transform`}
                onClick={() => card.filterKey && handleFilterClick(card.filterKey)}>
                <p className="theme-text-muted text-[10px] font-bold uppercase">{card.label}</p>
                <p className={`font-black text-xl mt-1 ${COLORS[card.color].text}`}>{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Payment Breakdown */}
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4">PAYMENT BREAKDOWN</h3>
            <div className="space-y-3">
              {[
                { label: 'Cash', value: payments.cashReceived, total: payments.totalReceived, color: 'emerald' },
                { label: 'Online', value: payments.onlineReceived, total: payments.totalReceived, color: 'blue' },
                { label: 'Card', value: payments.cardReceived, total: payments.totalReceived, color: 'purple' },
              ].map((p, i) => {
                const pct = p.total > 0 ? (p.value / p.total * 100) : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="theme-text-secondary font-bold">{p.label}</span>
                      <span className="theme-text-primary font-black">{fmt(p.value)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        className={`h-full rounded-full bg-${p.color}-500/60`} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-3">ORDER STATUS</h3>
              <div className="space-y-2">
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => handleFilterClick('paid')}>
                  <span className="theme-text-secondary text-xs font-bold">Paid Orders</span>
                  <span className="text-emerald-400 font-black text-sm">{payments.paidOrders}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-white/5 cursor-pointer" onClick={() => handleFilterClick('cod')}>
                  <span className="theme-text-secondary text-xs font-bold">COD / Pending</span>
                  <span className="text-amber-400 font-black text-sm">{payments.codOrders}</span>
                </div>
                <div className="flex justify-between py-2 px-3 rounded-lg hover:bg-white/5">
                  <span className="theme-text-secondary text-xs font-bold">Outstanding Amount</span>
                  <span className="text-red-400 font-black text-sm">{fmt(payments.outstanding)}</span>
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-3">COLLECTION RATIO</h3>
              <div className="flex items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(34,197,94)" strokeWidth="12"
                      strokeDasharray={`${(payments.totalReceived / Math.max(revenue.totalBilling, 1)) * 251.2} 251.2`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="theme-text-primary font-black text-lg">
                      {revenue.totalBilling > 0 ? `${((payments.totalReceived / revenue.totalBilling) * 100).toFixed(0)}%` : '0%'}
                    </span>
                    <span className="theme-text-muted text-[9px] font-bold">Collected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === EMPLOYEES SECTION === */}
      {activeSection === 'employees' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
              <Users size={16} className="text-purple-400" /> EMPLOYEE PERFORMANCE
            </h3>
            <p className="theme-text-muted text-xs mb-4">Who created online orders and their performance</p>
            {employees.length === 0 ? (
              <p className="theme-text-muted text-sm text-center py-8">No employee data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b theme-border">
                      <th className="text-left p-3 theme-text-muted font-bold">#</th>
                      <th className="text-left p-3 theme-text-muted font-bold">Employee</th>
                      <th className="text-right p-3 theme-text-muted font-bold">Orders</th>
                      <th className="text-right p-3 theme-text-muted font-bold">Delivered</th>
                      <th className="text-right p-3 theme-text-muted font-bold">Returned</th>
                      <th className="text-right p-3 theme-text-muted font-bold">Revenue</th>
                      <th className="text-right p-3 theme-text-muted font-bold">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => (
                      <tr key={i} className="border-b theme-border/50 hover:bg-white/5">
                        <td className="p-3 theme-text-muted">{i + 1}</td>
                        <td className="p-3 theme-text-primary font-bold">{emp.name}</td>
                        <td className="p-3 text-right theme-text-primary font-black">{emp.totalOrders}</td>
                        <td className="p-3 text-right text-emerald-400 font-black">{emp.deliveredOrders}</td>
                        <td className="p-3 text-right text-red-400 font-black">{emp.returnedOrders}</td>
                        <td className="p-3 text-right text-cyan-400 font-black">{fmt(emp.revenue)}</td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.rank <= 3 ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 bg-gray-500/10'}`}>
                            {emp.rank <= 3 ? <Crown size={10} className="inline mr-1" /> : null}#{emp.rank}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Employee performance cards */}
          {employees.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {employees.slice(0, 6).map((emp, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl border theme-border p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <User className="text-purple-400" size={18} />
                    </div>
                    <div>
                      <p className="theme-text-primary font-black text-sm">{emp.name}</p>
                      <span className={`text-[10px] font-bold ${emp.rank <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {emp.rank <= 3 ? '🏆 ' : ''}Rank #{emp.rank}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="theme-text-muted text-[9px] font-bold">ORDERS</p>
                      <p className="theme-text-primary font-black text-sm">{emp.totalOrders}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="theme-text-muted text-[9px] font-bold">DELIVERED</p>
                      <p className="text-emerald-400 font-black text-sm">{emp.deliveredOrders}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="theme-text-muted text-[9px] font-bold">RETURNED</p>
                      <p className="text-red-400 font-black text-sm">{emp.returnedOrders}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="theme-text-muted text-[9px] font-bold">REVENUE</p>
                      <p className="text-cyan-400 font-black text-sm">{fmt(emp.revenue)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === PRODUCTS SECTION === */}
      {activeSection === 'products' && (
        <div className="space-y-6">
          {[
            { title: 'Top Selling Products', data: productPerformance.topSelling, icon: Star, color: 'emerald', valueKey: 'totalOrders' },
            { title: 'Highest Revenue Products', data: productPerformance.highestRevenue, icon: DollarSign, color: 'cyan', valueKey: 'totalRevenue' },
            { title: 'Most Returned Products', data: productPerformance.mostReturned, icon: RotateCcw, color: 'red', valueKey: 'returned' },
            { title: 'Least Selling Products', data: productPerformance.leastSelling, icon: ArrowDownRight, color: 'amber', valueKey: 'totalOrders' },
          ].map((section, si) => (
            <div key={si} className="glass rounded-2xl border theme-border p-5">
              <h3 className="theme-text-primary font-black text-sm mb-4 flex items-center gap-2">
                <section.icon size={16} className={COLORS[section.color].text} /> {section.title.toUpperCase()}
              </h3>
              {section.data.length === 0 ? (
                <p className="theme-text-muted text-xs text-center py-4">No product data</p>
              ) : (
                <div className="space-y-2">
                  {section.data.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setSelectedDetail({ title: section.title, items: [p], columns: [
                        { label: 'Product', key: 'name' }, { label: 'Orders', key: 'totalOrders' },
                        { label: 'Revenue', render: r => fmt(r.totalRevenue) }, { label: 'Delivered', key: 'delivered' },
                        { label: 'Returned', key: 'returned' },
                      ]})}>
                      <div className="flex items-center gap-3">
                        <span className="theme-text-muted text-xs w-6 text-right">{i + 1}.</span>
                        <span className="theme-text-primary text-xs font-bold">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="theme-text-secondary text-xs">{p.totalOrders} orders</span>
                        <span className={`${COLORS[section.color].text} text-xs font-black`}>{section.valueKey === 'totalRevenue' ? fmt(p.totalRevenue) : p[section.valueKey]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {section.data.length > 0 && (
                <BarChartSimple data={section.data.slice(0, 8)} labelKey="name" valueKey={section.valueKey} color={section.color}
                  maxValue={Math.max(...section.data.map(d => d[section.valueKey] || 0))} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* === CUSTOMERS SECTION === */}
      {activeSection === 'customers' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border theme-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="theme-text-primary font-black text-sm flex items-center gap-2">
                <Heart size={16} className="text-pink-400" /> CUSTOMER ORDER HISTORY
              </h3>
              <span className="theme-text-muted text-xs">{customers.length} customers</span>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by name, order #, phone..."
                className="w-full pl-10 pr-4 py-2.5 theme-bg-subtle theme-border border rounded-xl text-xs theme-text-primary placeholder-theme-text-muted focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900/90 backdrop-blur">
                  <tr className="border-b theme-border">
                    <th className="text-left p-2 theme-text-muted font-bold">Customer</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Phone</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Orders</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Delivered</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Returned</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Total Spent</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Last Order</th>
                  </tr>
                </thead>
                <tbody>
                  {(searchTerm ? customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone || '').includes(searchTerm)) : customers)
                    .slice(0, 50).map((c, i) => (
                    <tr key={i} className="border-b theme-border/50 hover:bg-white/5 cursor-pointer"
                      onClick={() => setSelectedDetail({
                        title: `${c.name} - Order History`,
                        columns: [
                          { label: 'Name', key: 'name' }, { label: 'Phone', key: 'phone' },
                          { label: 'Orders', key: 'orders' }, { label: 'Delivered', key: 'delivered' },
                          { label: 'Returned', key: 'returned' }, { label: 'Spent', render: r => fmt(r.totalSpent) },
                        ],
                        items: [c],
                      })}>
                      <td className="p-2 theme-text-primary font-bold">{c.name}</td>
                      <td className="p-2 theme-text-secondary">{c.phone || '-'}</td>
                      <td className="p-2 text-right theme-text-primary font-black">{c.orders}</td>
                      <td className="p-2 text-right text-emerald-400 font-black">{c.delivered}</td>
                      <td className="p-2 text-right text-red-400 font-black">{c.returned}</td>
                      <td className="p-2 text-right text-cyan-400 font-black">{fmt(c.totalSpent)}</td>
                      <td className="p-2 text-right theme-text-muted">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === PRIORITIES SECTION === */}
      {activeSection === 'priorities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(priorities).map(([key, count]) => (
              <motion.div key={key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className={`glass rounded-2xl border-2 border-${key === 'SUPER_URGENT' ? 'red' : key === 'URGENT' ? 'amber' : key === 'HIGH' ? 'orange' : key === 'LOW' ? 'blue' : 'gray'}-500/30 p-5 text-center cursor-pointer`}
                onClick={() => handleFilterClick(key === 'NORMAL' ? 'normal' : key === 'URGENT' || key === 'SUPER_URGENT' ? 'urgent' : 'pending')}>
                <p className="theme-text-muted text-[10px] font-bold uppercase">{PRIORITY_LABELS[key]}</p>
                <p className={`font-black text-3xl mt-2 ${PRIORITY_COLORS[key]?.split(' ')[0]}`}>{count}</p>
                <p className="theme-text-muted text-[10px] mt-1">{summary.total > 0 ? `${((count / summary.total) * 100).toFixed(0)}%` : '0%'}</p>
              </motion.div>
            ))}
          </div>

          {/* Priority breakdown chart */}
          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4">PRIORITY DISTRIBUTION</h3>
            <BarChartSimple
              data={Object.entries(priorities).filter(([,v]) => v > 0).map(([k, v]) => ({ name: PRIORITY_LABELS[k] || k, count: v }))}
              labelKey="name" valueKey="count" color="amber" />
          </div>
        </div>
      )}

      {/* === ORDER TYPES SECTION === */}
      {activeSection === 'types' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(orderTypes).map(([key, count]) => (
              <motion.div key={key} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="glass rounded-2xl border-2 border-purple-500/30 p-5 text-center cursor-pointer"
                onClick={() => handleFilterClick(key === 'STANDARD' ? 'standard' : key === 'READY_LOGO' ? 'readyLogo' : key === 'CUSTOM_LOGO' ? 'customLogo' : 'fullCustom')}>
                <p className="theme-text-muted text-[10px] font-bold uppercase">{ORDER_TYPE_LABELS[key]}</p>
                <p className="text-purple-400 font-black text-3xl mt-2">{count}</p>
                <p className="theme-text-muted text-[10px] mt-1">{summary.total > 0 ? `${((count / summary.total) * 100).toFixed(0)}%` : '0%'}</p>
              </motion.div>
            ))}
          </div>

          <div className="glass rounded-2xl border theme-border p-5">
            <h3 className="theme-text-primary font-black text-sm mb-4">ORDER TYPE DISTRIBUTION</h3>
            <BarChartSimple
              data={Object.entries(orderTypes).filter(([,v]) => v > 0).map(([k, v]) => ({ name: ORDER_TYPE_LABELS[k] || k, count: v }))}
              labelKey="name" valueKey="count" color="purple" />
          </div>
        </div>
      )}

      {/* === ALL ORDERS SECTION === */}
      {activeSection === 'orders' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl border theme-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="theme-text-primary font-black text-sm flex items-center gap-2">
                <Globe size={16} className="text-cyan-400" /> ALL ONLINE ORDERS ({(data?.allOrders || data?.recentOrders || []).length})
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search orders..."
                  className="pl-10 pr-4 py-2 theme-bg-subtle theme-border border rounded-xl text-xs theme-text-primary w-64 focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900/90 backdrop-blur">
                  <tr className="border-b theme-border">
                    <th className="text-left p-2 theme-text-muted font-bold">Order #</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Customer</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Amount</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Stage</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Status</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Priority</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Type</th>
                    <th className="text-left p-2 theme-text-muted font-bold">Employee</th>
                    <th className="text-right p-2 theme-text-muted font-bold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSearchOrders.slice(0, 100).map((o, i) => (
                    <tr key={o.id || i} className="border-b theme-border/50 hover:bg-white/5 cursor-pointer"
                      onClick={() => setSelectedOrder(o)}>
                      <td className="p-2 theme-text-primary font-bold">{o.orderNumber || o.invoiceNumber || '-'}</td>
                      <td className="p-2 theme-text-secondary">{o.customerName}</td>
                      <td className="p-2 text-right theme-text-primary font-black">{fmt(o.totalPrice)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${COLORS[STAGE_COLORS[o.currentStage] || 'gray']?.text} ${COLORS[STAGE_COLORS[o.currentStage] || 'gray']?.bg}`}>
                          {STAGE_LABELS[o.currentStage] || o.currentStage}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_COLORS[o.priority] || ''}`}>{PRIORITY_LABELS[o.priority] || o.priority}</span>
                      </td>
                      <td className="p-2 theme-text-secondary text-[10px]">{ORDER_TYPE_LABELS[o.type] || o.type}</td>
                      <td className="p-2 theme-text-secondary">{o.employeeName}</td>
                      <td className="p-2 text-right theme-text-muted">{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inline expand list */}
      <AnimatePresence>
        {selectedFilter && filteredItems.items.length > 0 && (
          <InlineList items={filteredItems.items} title={filteredItems.title} columns={filteredItems.columns}
            onClose={() => setSelectedFilter(null)} />
        )}
      </AnimatePresence>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <DetailModal title={`Order: ${selectedOrder.orderNumber || selectedOrder.invoiceNumber || selectedOrder.id}`} onClose={() => setSelectedOrder(null)}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Order #', value: selectedOrder.orderNumber || '-' },
                  { label: 'Invoice #', value: selectedOrder.invoiceNumber || '-' },
                  { label: 'Customer', value: selectedOrder.customerName },
                  { label: 'Phone', value: selectedOrder.customerPhone || '-' },
                  { label: 'Amount', value: fmt(selectedOrder.totalPrice) },
                  { label: 'Advance', value: fmt(selectedOrder.advanceAmount) },
                  { label: 'Stage', value: STAGE_LABELS[selectedOrder.currentStage] || selectedOrder.currentStage },
                  { label: 'Status', value: selectedOrder.status },
                  { label: 'Priority', value: PRIORITY_LABELS[selectedOrder.priority] || selectedOrder.priority },
                  { label: 'Type', value: ORDER_TYPE_LABELS[selectedOrder.type] || selectedOrder.type },
                  { label: 'Payment', value: selectedOrder.paymentStatus },
                  { label: 'Employee', value: selectedOrder.employeeName },
                  { label: 'Created', value: new Date(selectedOrder.createdAt).toLocaleString() },
                  { label: 'Delivered', value: selectedOrder.deliveredAt ? new Date(selectedOrder.deliveredAt).toLocaleString() : '-' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <p className="theme-text-muted text-[10px] font-bold uppercase">{item.label}</p>
                    <p className="theme-text-primary font-bold text-xs mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </DetailModal>
        )}
      </AnimatePresence>

      {/* Generic Detail Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <DetailModal title={selectedDetail.title} onClose={() => setSelectedDetail(null)}>
            {selectedDetail.columns && selectedDetail.items && (
              <table className="w-full text-xs">
                <thead><tr className="border-b theme-border">
                  {selectedDetail.columns.map((col, i) => <th key={i} className="text-left p-2 theme-text-muted font-bold">{col.label}</th>)}
                </tr></thead>
                <tbody>
                  {selectedDetail.items.map((row, ri) => (
                    <tr key={ri} className="border-b theme-border/50">
                      {selectedDetail.columns.map((col, ci) => (
                        <td key={ci} className="p-2 theme-text-secondary">{col.render ? col.render(row) : row[col.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DetailModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnlineStoreCard;
