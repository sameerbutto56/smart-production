import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Loader2, Warehouse, Package, AlertTriangle, XCircle, TrendingUp, Activity,
  User, Users, X, RefreshCw, BarChart3, ShoppingCart, Gift, FileText, Clock,
  ChevronDown, Search, DollarSign, Eye, ChevronRight, Truck, Boxes,
  ArrowUpRight, ArrowDownRight, RotateCcw, CheckCircle, CheckCircle2, Calendar, CreditCard,
  Layers, Target
} from 'lucide-react';
import socket from '../socket';

const COLORS = {
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  red: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  pink: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  gray: { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
};

const fmt = (n) => `₨${(n || 0).toLocaleString()}`;

const InlineList = ({ items, columns, title, onClose, renderItem }) => (
  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
    <div className="glass rounded-2xl p-4 border theme-border mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-black theme-text-primary uppercase tracking-wider">{title} ({items.length})</h4>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-all"><X size={14} className="theme-text-muted" /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs theme-text-muted font-bold text-center py-6">No records found</p>
        ) : renderItem ? items.map((item, i) => renderItem(item, i)) : items.map((item, i) => (
          <div key={item.id || i} className="flex items-center justify-between p-2.5 theme-bg-subtle rounded-xl border theme-border">
            {columns.map((col, ci) => (
              <span key={ci} className={`text-[10px] font-bold ${col.color || 'theme-text-muted'} ${col.align === 'right' ? 'text-right' : 'text-left'} ${ci === 0 ? 'flex-1 min-w-0 truncate' : 'shrink-0 ml-2'}`}>
                {col.render ? col.render(item) : item[col.key] || '—'}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

const DetailModal = ({ title, items, columns, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      onClick={e => e.stopPropagation()}
      className="glass max-w-2xl w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">{title}</h3>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 transition-all"><X size={16} className="theme-text-muted" /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
            {columns.map((col, i) => (
              <th key={i} className={`py-2 ${col.align === 'right' ? 'text-right' : 'text-left'} ${i > 0 ? 'px-2' : 'pr-2'}`}>{col.label}</th>
            ))}
          </tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i} className="border-t border-gray-800 hover:bg-white/5">
                {columns.map((col, ci) => (
                  <td key={ci} className={`py-2 text-[11px] font-bold ${col.color || 'theme-text-primary'} ${col.align === 'right' ? 'text-right' : 'text-left'} ${ci > 0 ? 'px-2' : 'pr-2'}`}>
                    {col.render ? col.render(item) : item[col.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  </div>
);

const BarChartSimple = ({ data, labelKey, valueKey, color, maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-2">
      {data.slice(0, 12).map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] font-bold theme-text-muted w-16 shrink-0 truncate">{d[labelKey]}</span>
          <div className="flex-1 h-5 bg-gray-800 rounded-lg overflow-hidden">
            <div className={`h-full rounded-lg ${color || 'bg-blue-500'}`} style={{ width: `${Math.max(((d[valueKey] || 0) / max) * 100, 2)}%` }} />
          </div>
          <span className="text-[10px] font-black theme-text-primary w-10 text-right shrink-0">{d[valueKey] || 0}</span>
        </div>
      ))}
    </div>
  );
};

const WarehouseAnalyticsCard = ({ activeTab }) => {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [allocStats, setAllocStats] = useState({ perPerson: [], todayTotal: 0, activeTotal: 0, totalAllocated: 0 });
  const [allocRecords, setAllocRecords] = useState([]);
  const [demandStats, setDemandStats] = useState({ pending: 0, approved: 0, partiallyApproved: 0, rejected: 0, total: 0 });
  const [demands, setDemands] = useState([]);
  const [stockRequests, setStockRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [demandFilter, setDemandFilter] = useState('');
  const [allocPage, setAllocPage] = useState(1);
  const [activeSection, setActiveSection] = useState('overview');
  const [fetchErrors, setFetchErrors] = useState([]);
  const refreshRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setFetchErrors([]);
    const errors = [];
    try {
      const [invRes, salesRes, allocStatsRes, allocRecRes, demandAllRes, demandStatsRes, stockReqRes] = await Promise.allSettled([
        api.get('/api/inventory'),
        api.get('/api/warehouse/sales'),
        api.get('/api/inventory/allocations/stats'),
        api.get('/api/inventory/allocations', { params: { page: 1, limit: 200 } }),
        api.get('/api/demand/all'),
        api.get('/api/demand/stats'),
        api.get('/api/stock-requests', { params: { limit: 200 } }),
      ]);
      if (invRes.status === 'fulfilled') setInventory(invRes.value.data || []);
      else errors.push('Inventory: ' + (invRes.reason?.response?.data?.message || invRes.reason?.message || 'Failed to load'));
      if (salesRes.status === 'fulfilled') setSales(salesRes.value.data || []);
      else errors.push('Sales: ' + (salesRes.reason?.response?.data?.message || salesRes.reason?.message || 'Failed to load'));
      if (allocStatsRes.status === 'fulfilled') {
        const d = allocStatsRes.value.data;
        if (d.perPerson) setAllocStats(d);
      } else errors.push('Allocation Stats: ' + (allocStatsRes.reason?.response?.data?.message || allocStatsRes.reason?.message || 'Failed to load'));
      if (allocRecRes.status === 'fulfilled') setAllocRecords(allocRecRes.value.data?.records || []);
      else errors.push('Allocations: ' + (allocRecRes.reason?.response?.data?.message || allocRecRes.reason?.message || 'Failed to load'));
      if (demandAllRes.status === 'fulfilled') setDemands(demandAllRes.value.data || []);
      else errors.push('Demands: ' + (demandAllRes.reason?.response?.data?.message || demandAllRes.reason?.message || 'Failed to load'));
      if (demandStatsRes.status === 'fulfilled') setDemandStats(demandStatsRes.value.data || {});
      else errors.push('Demand Stats: ' + (demandStatsRes.reason?.response?.data?.message || demandStatsRes.reason?.message || 'Failed to load'));
      if (stockReqRes.status === 'fulfilled') setStockRequests(stockReqRes.value.data || []);
      else errors.push('Stock Requests: ' + (stockReqRes.reason?.response?.data?.message || stockReqRes.reason?.message || 'Failed to load'));
      if (errors.length > 0) setFetchErrors(errors);
    } catch (e) {
      console.error('Warehouse analytics fetch failed:', e);
      setFetchErrors(['Unexpected error: ' + e.message]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (activeTab === 'warehouse') fetchAll(); }, [activeTab, fetchAll]);

  useEffect(() => {
    if (activeTab !== 'warehouse') return;
    refreshRef.current = setInterval(fetchAll, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [activeTab, fetchAll]);

  useEffect(() => {
    if (activeTab !== 'warehouse') return;
    const refresh = () => fetchAll();
    socket.on('order-updated', refresh);
    socket.on('demand:updated', refresh);
    socket.on('demand:new', refresh);
    return () => { socket.off('order-updated', refresh); socket.off('demand:updated', refresh); socket.off('demand:new', refresh); };
  }, [activeTab, fetchAll]);

  const inv = useMemo(() => {
    const total = inventory.reduce((s, i) => s + (i.stock || 0), 0);
    const available = inventory.filter(i => (i.stock || 0) > 5);
    const low = inventory.filter(i => (i.stock || 0) > 0 && (i.stock || 0) <= 5);
    const outOfStock = inventory.filter(i => (i.stock || 0) === 0);
    const categories = {};
    inventory.forEach(i => {
      const cat = i.category || 'GENERAL';
      if (!categories[cat]) categories[cat] = { name: cat, count: 0, stock: 0, products: new Set() };
      categories[cat].count++;
      categories[cat].stock += (i.stock || 0);
      categories[cat].products.add(i.name || i.productName);
    });
    const cats = Object.values(categories).map(c => ({ ...c, products: c.products.size })).sort((a, b) => b.stock - a.stock);
    return { total, available, low, outOfStock, categories: cats, items: inventory };
  }, [inventory]);

  const pos = useMemo(() => {
    if (!sales.length) return { totalSales: 0, totalInvoices: 0, todaySales: 0, weeklySales: 0, monthlySales: 0, dailyAvg: 0, topProduct: null, leastProduct: null, paymentMethodBreakdown: {} };
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    let totalRevenue = 0;
    const productSales = {};
    const paymentMethods = {};
    let todayRev = 0, weekRev = 0, monthRev = 0;
    sales.forEach(s => {
      const amt = (s.cashAmount || 0) + (s.onlineAmount || 0) || s.totalAmount || s.grandTotal || 0;
      totalRevenue += amt;
      const sDate = s.createdAt?.split('T')[0] || '';
      if (sDate === today) todayRev += amt;
      if (sDate >= weekAgo) weekRev += amt;
      if (sDate >= monthStart) monthRev += amt;
      const pm = s.paymentMethod || 'CASH';
      paymentMethods[pm] = (paymentMethods[pm] || 0) + amt;
      (s.items || []).forEach(item => {
        const name = item.productName || item.name || 'Unknown';
        if (!productSales[name]) productSales[name] = { name, qty: 0, revenue: 0 };
        productSales[name].qty += (item.quantity || 0);
        productSales[name].revenue += (item.unitPrice || 0) * (item.quantity || 0);
      });
    });
    const prods = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
    const daysSinceFirst = sales.length > 0 ? Math.max(1, (now - new Date(sales[sales.length - 1]?.createdAt || now)) / 86400000) : 1;
    return {
      totalSales: totalRevenue, totalInvoices: sales.length, todaySales: todayRev,
      weeklySales: weekRev, monthlySales: monthRev,
      dailyAvg: Math.round(totalRevenue / daysSinceFirst),
      topProduct: prods[0] || null, leastProduct: prods[prods.length - 1] || null,
      paymentMethodBreakdown: paymentMethods,
      productSales: prods,
    };
  }, [sales]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    const q = searchTerm.toLowerCase();
    return inventory.filter(i => (i.name || i.productName || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q) || (i.color || '').toLowerCase().includes(q));
  }, [inventory, searchTerm]);

  const filteredDemands = useMemo(() => {
    if (!demandFilter) return demands;
    return demands.filter(d => (d.status || '').toUpperCase() === demandFilter.toUpperCase());
  }, [demands, demandFilter]);

  const filteredStockReqs = useMemo(() => {
    if (!searchTerm) return stockRequests;
    const q = searchTerm.toLowerCase();
    return stockRequests.filter(r => (r.outletName || '').toLowerCase().includes(q) || (r.itemName || '').toLowerCase().includes(q));
  }, [stockRequests, searchTerm]);

  const sectionNav = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'demands', label: 'Demands', icon: ShoppingCart },
    { id: 'allocations', label: 'Allocations', icon: Gift },
    { id: 'pos', label: 'POS Sales', icon: DollarSign },
    { id: 'charts', label: 'Charts', icon: TrendingUp },
  ];

  const inventoryOverviewStats = useMemo(() => [
    { label: 'Total SKUs', value: inventory.length, icon: Package, color: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' }, filterKey: null },
    { label: 'Total Stock', value: inv.total, icon: Layers, color: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' }, filterKey: null },
    { label: 'In Stock', value: inv.available.length, icon: CheckCircle, color: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' }, filterKey: 'available' },
    { label: 'Low Stock', value: inv.low.length, icon: AlertTriangle, color: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }, filterKey: 'low' },
    { label: 'Out of Stock', value: inv.outOfStock.length, icon: XCircle, color: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' }, filterKey: 'outOfStock' },
    { label: 'Categories', value: inv.categories.length, icon: Layers, color: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }, filterKey: null },
  ], [inventory, inv]);

  const demandOverviewStats = useMemo(() => [
    { label: 'Total Demands', value: demands.length, icon: ShoppingCart, color: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }, filterKey: null },
    { label: 'Pending', value: demandStats.pending || 0, icon: Clock, color: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' }, filterKey: 'PENDING' },
    { label: 'Approved', value: demandStats.approved || 0, icon: CheckCircle, color: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' }, filterKey: 'APPROVED' },
    { label: 'Partially Approved', value: demandStats.partiallyApproved || 0, icon: AlertTriangle, color: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }, filterKey: 'PARTIALLY_APPROVED' },
    { label: 'Rejected', value: demandStats.rejected || 0, icon: XCircle, color: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' }, filterKey: 'REJECTED' },
    { label: 'Stock Requests', value: stockRequests.length, icon: Layers, color: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' }, filterKey: null },
  ], [demands, demandStats, stockRequests]);

  const allocOverviewStats = useMemo(() => [
    { label: 'Total Allocated', value: allocStats.totalAllocated || 0, icon: Gift, color: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }, filterKey: null },
    { label: "Today's", value: allocStats.todayTotal || 0, icon: Clock, color: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' }, filterKey: null },
    { label: 'Active', value: allocStats.activeTotal || 0, icon: CheckCircle, color: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' }, filterKey: null },
    { label: 'Employees', value: allocStats.perPerson?.length || 0, icon: Users, color: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }, filterKey: null },
  ], [allocStats]);

  const posOverviewStats = useMemo(() => [
    { label: 'Total Revenue', value: fmt(pos.totalSales), icon: DollarSign, color: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' }, filterKey: null },
    { label: 'Total Invoices', value: pos.totalInvoices, icon: FileText, color: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' }, filterKey: null },
    { label: "Today's Sales", value: fmt(pos.todaySales), icon: TrendingUp, color: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' }, filterKey: null },
    { label: 'Weekly Sales', value: fmt(pos.weeklySales), icon: BarChart3, color: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' }, filterKey: null },
    { label: 'Monthly Sales', value: fmt(pos.monthlySales), icon: Calendar, color: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' }, filterKey: null },
    { label: 'Daily Average', value: fmt(pos.dailyAvg), icon: Target, color: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' }, filterKey: null },
  ], [pos]);

  const categoryStockData = useMemo(() => inv.categories.map(c => ({ name: c.name, stock: c.stock })), [inv]);
  const monthlySalesData = useMemo(() => {
    const months = {};
    sales.forEach(s => {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { month: key, count: 0, revenue: 0 };
      months[key].count++;
      months[key].revenue += (s.cashAmount || 0) + (s.onlineAmount || 0) || s.grandTotal || 0;
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  }, [sales]);
  const demandByStatus = useMemo(() => [
    { label: 'Pending', value: demandStats.pending || 0 },
    { label: 'Approved', value: demandStats.approved || 0 },
    { label: 'Partial', value: demandStats.partiallyApproved || 0 },
    { label: 'Rejected', value: demandStats.rejected || 0 },
  ], [demandStats]);
  const filteredItems = useMemo(() => {
    if (!selectedFilter) return [];
    if (['available', 'low', 'outOfStock'].includes(selectedFilter)) {
      return inv[selectedFilter] || [];
    }
    return [];
  }, [selectedFilter, inv]);
  const filteredTitle = useMemo(() => {
    if (!selectedFilter) return '';
    const map = { available: 'In Stock Items', low: 'Low Stock Items', outOfStock: 'Out of Stock Items' };
    return map[selectedFilter] || selectedFilter;
  }, [selectedFilter]);
  const filteredColumns = useMemo(() => [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'stock', label: 'Stock' },
  ], []);

  const handleFilterClick = (filterKey) => {
    setSelectedFilter(prev => prev === filterKey ? null : filterKey);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Fetch Error Banner */}
      {fetchErrors.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <h4 className="text-xs font-black text-red-400 uppercase tracking-wider">Data Loading Errors ({fetchErrors.length})</h4>
            </div>
            <button onClick={() => { fetchAll(); }} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <RefreshCw size={10} /> Retry All
            </button>
          </div>
          <div className="space-y-1">
            {fetchErrors.map((err, i) => (
              <p key={i} className="text-[10px] font-bold text-red-300">{err}</p>
            ))}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10">
            <Warehouse className="text-amber-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Warehouse Analytics</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Real-time inventory, demands, allocations & POS</p>
          </div>
        </div>
        <button onClick={() => { if (refreshRef.current) clearInterval(refreshRef.current); fetchAll(); refreshRef.current = setInterval(fetchAll, 30000); }}
          disabled={loading} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Section Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {sectionNav.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${activeSection === s.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'theme-bg-subtle theme-text-muted border theme-border hover:border-amber-500/20'}`}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search products, categories, outlets..."
          className="w-full pl-10 pr-4 py-2.5 theme-input rounded-xl text-xs font-bold" />
      </div>

      {/* ===================== OVERVIEW SECTION ===================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Inventory Overview */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} className="text-blue-400" /> Inventory Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {inventoryOverviewStats.map(card => (
                <div key={card.label} onClick={() => card.filterKey && handleFilterClick(card.filterKey)}
                  className={`${card.color.bg} rounded-2xl p-3 border ${card.color.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <card.icon size={14} className={card.color.text} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                  </div>
                  <p className={`text-xl font-black ${card.color.text}`}>{card.value}</p>
                  {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Demand & Requests Overview */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={16} className="text-purple-400" /> Demands & Requests
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {demandOverviewStats.map(card => (
                <div key={card.label} onClick={() => card.filterKey && handleFilterClick(card.filterKey)}
                  className={`${card.color.bg} rounded-2xl p-3 border ${card.color.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <card.icon size={14} className={card.color.text} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                  </div>
                  <p className={`text-xl font-black ${card.color.text}`}>{card.value}</p>
                  {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Allocation Overview */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Gift size={16} className="text-amber-400" /> Allocation Overview
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {allocOverviewStats.map(card => (
                <div key={card.label} onClick={() => card.filterKey && handleFilterClick(card.filterKey)}
                  className={`${card.color.bg} rounded-2xl p-3 border ${card.color.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <card.icon size={14} className={card.color.text} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                  </div>
                  <p className={`text-xl font-black ${card.color.text}`}>{card.value}</p>
                  {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
                </div>
              ))}
            </div>
            {/* Employee allocation breakdown */}
            {allocStats.perPerson?.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {allocStats.perPerson.slice(0, 6).map(p => (
                  <div key={p.personName} className="theme-bg-subtle rounded-xl p-3 border theme-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center"><User size={12} className="text-amber-400" /></div>
                      <div>
                        <p className="text-xs font-black theme-text-primary">{p.personName}</p>
                        <p className="text-[9px] font-bold text-gray-500">{p.timesTaken || 0} times</p>
                      </div>
                    </div>
                    <p className="text-xs font-black text-amber-400">{p.totalItems || 0} items</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* POS Overview */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" /> Warehouse POS
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {posOverviewStats.map(card => (
                <div key={card.label} onClick={() => card.filterKey && handleFilterClick(card.filterKey)}
                  className={`${card.color.bg} rounded-2xl p-3 border ${card.color.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <card.icon size={14} className={card.color.text} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                  </div>
                  <p className={`text-lg font-black ${card.color.text}`}>{card.value}</p>
                  {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
                </div>
              ))}
            </div>
            {/* Payment Method Breakdown */}
            {Object.keys(pos.paymentMethodBreakdown).length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(pos.paymentMethodBreakdown).map(([method, amt]) => (
                  <div key={method} className="theme-bg-subtle rounded-xl p-3 border theme-border text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{method}</p>
                    <p className="text-sm font-black text-emerald-400">{fmt(amt)}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Top & Least Product */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {pos.topProduct && (
                <div className="theme-bg-subtle rounded-xl p-3 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Top Selling</p>
                      <p className="text-xs font-black theme-text-primary">{pos.topProduct.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-emerald-400">{fmt(pos.topProduct.revenue)}</p>
                    <p className="text-[9px] font-bold text-gray-500">{pos.topProduct.qty} sold</p>
                  </div>
                </div>
              )}
              {pos.leastProduct && pos.leastProduct.name !== pos.topProduct?.name && (
                <div className="theme-bg-subtle rounded-xl p-3 border border-red-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight size={14} className="text-red-400" />
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Least Selling</p>
                      <p className="text-xs font-black theme-text-primary">{pos.leastProduct.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-red-400">{fmt(pos.leastProduct.revenue)}</p>
                    <p className="text-[9px] font-bold text-gray-500">{pos.leastProduct.qty} sold</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== INVENTORY SECTION ===================== */}
      {activeSection === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Details Table */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} className="text-blue-400" /> Complete Inventory ({filteredInventory.length} items)
            </h3>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 theme-bg"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="text-left py-2 pr-2">#</th>
                  <th className="text-left px-2">Product Name</th>
                  <th className="text-left px-2">Category</th>
                  <th className="text-left px-2">Color</th>
                  <th className="text-right px-2">Stock</th>
                  <th className="text-right px-2">Status</th>
                  <th className="text-right pl-2">Last Updated</th>
                </tr></thead>
                <tbody>
                  {filteredInventory.slice(0, 200).map((item, idx) => (
                    <tr key={item.id || idx} className="border-t border-gray-800 hover:bg-white/5">
                      <td className="py-2 pr-2 text-gray-500">{idx + 1}</td>
                      <td className="px-2 font-bold theme-text-primary">{item.name || item.productName || '—'}</td>
                      <td className="px-2 font-bold text-gray-400">{item.category || '—'}</td>
                      <td className="px-2 font-bold">{item.color || '—'}</td>
                      <td className={`px-2 text-right font-black ${(item.stock || 0) <= 0 ? 'text-red-400' : (item.stock || 0) <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{item.stock || 0}</td>
                      <td className="px-2 text-right">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${(item.stock || 0) <= 0 ? 'bg-red-500/20 text-red-400' : (item.stock || 0) <= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {(item.stock || 0) <= 0 ? 'OUT' : (item.stock || 0) <= 5 ? 'LOW' : 'OK'}
                        </span>
                      </td>
                      <td className="pl-2 text-[10px] text-gray-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Boxes size={16} className="text-purple-400" /> Category Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {inv.categories.map(cat => (
                <div key={cat.name} className="theme-bg-subtle rounded-xl p-3 border theme-border text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{cat.name}</p>
                  <p className="text-lg font-black text-blue-400 mt-1">{cat.stock}</p>
                  <p className="text-[9px] font-bold text-gray-500">{cat.count} items · {cat.products} products</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================== DEMANDS SECTION ===================== */}
      {activeSection === 'demands' && (
        <div className="space-y-6">
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {['', 'PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].map(status => (
              <button key={status} onClick={() => setDemandFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${demandFilter === status ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'theme-bg-subtle theme-text-muted border theme-border'}`}>
                {status || 'All'}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={16} className="text-purple-400" /> Demand Requests ({filteredDemands.length})
            </h3>
            {filteredDemands.length === 0 ? (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No demand requests found</p>
            ) : (
              <div className="space-y-3">
                {filteredDemands.map(d => (
                  <div key={d.id} className="theme-bg-subtle rounded-xl p-4 border theme-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${d.status === 'APPROVED' ? 'bg-emerald-400' : d.status === 'REJECTED' ? 'bg-red-400' : d.status === 'PARTIALLY_APPROVED' ? 'bg-cyan-400' : 'bg-amber-400'}`} />
                        <p className="text-sm font-black theme-text-primary">{d.outletName || 'Unknown Outlet'}</p>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${d.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : d.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : d.status === 'PARTIALLY_APPROVED' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {d.status || 'PENDING'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</span>
                    </div>
                    {d.items?.length > 0 && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead><tr className="text-gray-500 font-black uppercase">
                            <th className="text-left py-1">Product</th>
                            <th className="text-left px-2">Size</th>
                            <th className="text-left px-2">Color</th>
                            <th className="text-right px-2">Requested</th>
                            <th className="text-right pl-2">Approved</th>
                          </tr></thead>
                          <tbody>
                            {d.items.map((item, i) => (
                              <tr key={i} className="border-t border-gray-800">
                                <td className="py-1 font-bold">{item.productName || '—'}</td>
                                <td className="px-2">{item.size || '—'}</td>
                                <td className="px-2">{item.color || '—'}</td>
                                <td className="px-2 text-right font-bold">{item.requestedQty || item.quantity || 0}</td>
                                <td className="pl-2 text-right font-bold text-emerald-400">{item.approvedQty || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {d.storeNotes && (
                      <p className="text-[10px] text-gray-500 mt-2 italic">Notes: {d.storeNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Requests */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-pink-400" /> Stock Requests ({filteredStockReqs.length})
            </h3>
            {filteredStockReqs.length === 0 ? (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No stock requests found</p>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 theme-bg"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Outlet</th>
                    <th className="text-left px-2">Item</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-right px-2">Status</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {filteredStockReqs.slice(0, 100).map((r, i) => (
                      <tr key={r.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold theme-text-primary">{r.outletName || '—'}</td>
                        <td className="px-2 font-bold">{r.itemName || (r.items || []).map(it => it.itemName).join(', ') || '—'}</td>
                        <td className="px-2 text-right font-bold">{r.quantity || (r.items || []).reduce((s, it) => s + (it.quantity || 0), 0)}</td>
                        <td className="px-2 text-right">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : r.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.status || 'PENDING'}</span>
                        </td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ALLOCATIONS SECTION ===================== */}
      {activeSection === 'allocations' && (
        <div className="space-y-6">
          {/* Allocation Stats */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Gift size={16} className="text-amber-400" /> Allocation Analytics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total Allocated', value: allocStats.totalAllocated || 0, color: 'text-amber-400' },
                { label: 'Active', value: allocStats.activeTotal || 0, color: 'text-indigo-400' },
                { label: 'Today', value: allocStats.todayTotal || 0, color: 'text-emerald-400' },
                { label: 'People', value: allocStats.perPerson?.length || 0, color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="theme-bg-subtle rounded-xl p-3 border theme-border text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{s.label}</p>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Per-Person Breakdown */}
            {allocStats.perPerson?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-black theme-text-primary uppercase tracking-wider mb-3">Employee Breakdown</p>
                <div className="space-y-2">
                  {allocStats.perPerson.map(p => (
                    <div key={p.personName} className="flex items-center justify-between p-3 theme-bg-subtle rounded-xl border theme-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center"><User size={14} className="text-amber-400" /></div>
                        <div>
                          <p className="text-xs font-black theme-text-primary">{p.personName}</p>
                          <p className="text-[9px] font-bold text-gray-500">{p.timesTaken || 0} allocations</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-amber-400">{p.totalItems || 0} items</p>
                        {p.lastDate && <p className="text-[9px] font-bold text-gray-500">Last: {new Date(p.lastDate).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Allocation History */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock size={16} className="text-indigo-400" /> Allocation History ({allocRecords.length})
            </h3>
            {allocRecords.length === 0 ? (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No allocation records</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 theme-bg"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">Person</th>
                    <th className="text-left px-2">Items</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-left px-2">Notes</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {allocRecords.map((r, i) => (
                      <tr key={r.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 font-bold theme-text-primary">{r.personName || '—'}</td>
                        <td className="px-2 font-bold">{r.totalItems || r.items?.length || 0}</td>
                        <td className="px-2 text-right font-black text-amber-400">{r.totalQuantity || 0}</td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{r.status || 'PENDING'}</span>
                        </td>
                        <td className="px-2 text-[10px] text-gray-500 max-w-[120px] truncate">{r.notes || '—'}</td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== POS SECTION ===================== */}
      {activeSection === 'pos' && (
        <div className="space-y-6">
          {/* POS Summary Cards */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" /> POS Sales Analytics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Revenue', value: fmt(pos.totalSales), color: 'text-emerald-400' },
                { label: 'Today', value: fmt(pos.todaySales), color: 'text-blue-400' },
                { label: 'This Week', value: fmt(pos.weeklySales), color: 'text-purple-400' },
                { label: 'This Month', value: fmt(pos.monthlySales), color: 'text-indigo-400' },
                { label: 'Total Invoices', value: pos.totalInvoices, color: 'text-amber-400' },
                { label: 'Daily Average', value: fmt(pos.dailyAvg), color: 'text-teal-400' },
                { label: 'Top Product', value: pos.topProduct?.name || 'N/A', color: 'text-emerald-400' },
                { label: 'Top Revenue', value: pos.topProduct ? fmt(pos.topProduct.revenue) : '₨0', color: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="theme-bg-subtle rounded-xl p-3 border theme-border text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{s.label}</p>
                  <p className={`text-sm font-black ${s.color} mt-1`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          {Object.keys(pos.paymentMethodBreakdown).length > 0 && (
            <div className="glass rounded-2xl p-5 border-2 theme-border">
              <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-purple-400" /> Payment Method Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(pos.paymentMethodBreakdown).map(([method, amt]) => {
                  const pct = pos.totalSales > 0 ? ((amt / pos.totalSales) * 100).toFixed(1) : 0;
                  return (
                    <div key={method} className="theme-bg-subtle rounded-xl p-4 border theme-border text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{method}</p>
                      <p className="text-lg font-black text-emerald-400 mt-1">{fmt(amt)}</p>
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[9px] font-bold text-gray-500 mt-1">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Products */}
          {pos.productSales?.length > 0 && (
            <div className="glass rounded-2xl p-5 border-2 theme-border">
              <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400" /> Product Performance
              </h3>
              <div className="space-y-2">
                {pos.productSales.slice(0, 10).map((p, i) => {
                  const maxRev = pos.productSales[0]?.revenue || 1;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-gray-500 w-5 shrink-0">#{i + 1}</span>
                      <span className="text-xs font-bold theme-text-primary w-32 shrink-0 truncate">{p.name}</span>
                      <div className="flex-1 h-5 bg-gray-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-lg" style={{ width: `${(p.revenue / maxRev) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-emerald-400 w-16 text-right shrink-0">{fmt(p.revenue)}</span>
                      <span className="text-[10px] font-bold text-gray-500 w-10 text-right shrink-0">{p.qty} qty</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invoice History */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-amber-400" /> Invoice History ({sales.length})
            </h3>
            {sales.length === 0 ? (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No invoices yet</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 theme-bg"><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left px-2">Customer</th>
                    <th className="text-left px-2">Items</th>
                    <th className="text-right px-2">Amount</th>
                    <th className="text-left px-2">Method</th>
                    <th className="text-left px-2">Status</th>
                    <th className="text-right pl-2">Date</th>
                  </tr></thead>
                  <tbody>
                    {sales.slice(0, 100).map((s, i) => (
                      <tr key={s.id || i} className="border-t border-gray-800 hover:bg-white/5">
                        <td className="py-2 pr-2 text-gray-500">{i + 1}</td>
                        <td className="px-2 font-bold theme-text-primary">{s.customerName || 'Walk-in'}</td>
                        <td className="px-2 font-bold">{(s.items || []).length}</td>
                        <td className="px-2 text-right font-black text-emerald-400">{fmt((s.cashAmount || 0) + (s.onlineAmount || 0) || s.grandTotal || 0)}</td>
                        <td className="px-2 font-bold text-gray-400">{s.paymentMethod || 'CASH'}</td>
                        <td className="px-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${s.refundedAt ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {s.refundedAt ? 'REFUNDED' : 'PAID'}
                          </span>
                        </td>
                        <td className="pl-2 text-right text-[10px] text-gray-500">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== CHARTS SECTION ===================== */}
      {activeSection === 'charts' && (
        <div className="space-y-6">
          {/* Stock by Category */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Boxes size={16} className="text-purple-400" /> Stock Distribution by Category
            </h3>
            {categoryStockData.length > 0 ? (
              <BarChartSimple data={categoryStockData} labelKey="name" valueKey="stock" color="bg-purple-500" />
            ) : (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No inventory data</p>
            )}
          </div>

          {/* Monthly Sales Trend */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" /> Sales Trend (Monthly)
            </h3>
            {monthlySalesData.length > 0 ? (
              <BarChartSimple data={monthlySalesData} labelKey="month" valueKey="count" color="bg-emerald-500" />
            ) : (
              <p className="text-xs theme-text-muted font-bold text-center py-8">No sales data</p>
            )}
          </div>

          {/* Demand by Status */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingCart size={16} className="text-blue-400" /> Demand Distribution
            </h3>
            <BarChartSimple data={demandByStatus} labelKey="label" valueKey="value" color="bg-blue-500" />
          </div>

          {/* Inventory Levels - Visual */}
          <div className="glass rounded-2xl p-5 border-2 theme-border">
            <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={16} className="text-amber-400" /> Inventory Health
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Healthy (>5)', value: inv.available.length, total: inventory.length, color: 'bg-emerald-500' },
                { label: 'Low (1-5)', value: inv.low.length, total: inventory.length, color: 'bg-amber-500' },
                { label: 'Out of Stock', value: inv.outOfStock.length, total: inventory.length, color: 'bg-red-500' },
              ].map(s => {
                const pct = inventory.length > 0 ? (s.value / inventory.length) * 100 : 0;
                return (
                  <div key={s.label} className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-3">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="6" fill="none" className="text-gray-800" />
                        <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="6" fill="none"
                          strokeDasharray={`${pct * 2.2} ${220 - pct * 2.2}`} strokeLinecap="round"
                          className={s.color.replace('bg-', 'text-')} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-lg font-black theme-text-primary">{s.value}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{s.label}</p>
                    <p className="text-[9px] font-bold text-gray-600">{pct.toFixed(1)}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Performance Chart */}
          {pos.productSales?.length > 0 && (
            <div className="glass rounded-2xl p-5 border-2 theme-border">
              <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" /> Product Performance (Top 10)
              </h3>
              <BarChartSimple data={pos.productSales.slice(0, 10)} labelKey="name" valueKey="revenue" color="bg-cyan-500" />
            </div>
          )}
        </div>
      )}

      {/* ===================== CLICKABLE FILTER LISTS ===================== */}
      <AnimatePresence>
        {selectedFilter && filteredItems.length > 0 && (
          <InlineList items={filteredItems} title={filteredTitle} columns={filteredColumns} onClose={() => setSelectedFilter(null)} />
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDetail && (
          <DetailModal title={selectedDetail.title} items={selectedDetail.items} columns={selectedDetail.columns} onClose={() => setSelectedDetail(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WarehouseAnalyticsCard;
