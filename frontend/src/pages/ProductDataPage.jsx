import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  Search,
  Calendar,
  Building2,
  Package,
  Scissors,
  Download,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Hash,
  User,
  ShoppingBag,
  Percent,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom Range' },
  { id: 'all', label: 'All Time' },
];

const TABS = [
  { id: 'sales', label: 'Product Sales', icon: ShoppingBag },
  { id: 'discount', label: 'Discounts', icon: Percent },
  { id: 'customization', label: 'Customization', icon: Sparkles },
  { id: 'sizes', label: 'Sizes', icon: Layers },
  { id: 'engraving', label: 'Engraving Analytics', icon: Scissors },
  { id: 'employees', label: 'Employee Activity', icon: User },
  { id: 'drilldown', label: 'Order Drill-Down', icon: Receipt },
];

export default function ProductDataPage() {
  // Filters
  const [outlets, setOutlets] = useState(['All Outlets', 'Online', 'Johar Town', 'Jail Road', 'Abbottabad', 'Warehouse']);
  const [selectedOutlet, setSelectedOutlet] = useState('All Outlets');
  const [preset, setPreset] = useState('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [activeTab, setActiveTab] = useState('sales');

  // Data states
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);

  // Drilldown states
  const [drilldownOrders, setDrilldownOrders] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownPage, setDrilldownPage] = useState(1);
  const [drilldownTotalPages, setDrilldownTotalPages] = useState(1);
  const [drilldownTotal, setDrilldownTotal] = useState(0);
  const [drilldownFilter, setDrilldownFilter] = useState('all');
  const [drilldownSearch, setDrilldownSearch] = useState('');

  // Fetch Outlets
  useEffect(() => {
    api.get('/api/analytics/product-data/outlets')
      .then(res => {
        if (res.data?.outlets?.length) {
          setOutlets(res.data.outlets);
        }
      })
      .catch(err => console.error('Failed to load outlets:', err));
  }, []);

  // Fetch Summary Data
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        outlet: selectedOutlet,
        preset,
        search: productSearch
      };
      if (preset === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await api.get('/api/analytics/product-data/summary', { params });
      setSummaryData(res.data);
    } catch (err) {
      console.error('Error fetching product data summary:', err);
      toast.error('Failed to load product analytics');
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet, preset, dateFrom, dateTo, productSearch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch Drilldown Orders
  const fetchDrilldown = useCallback(async () => {
    if (activeTab !== 'drilldown') return;
    setDrilldownLoading(true);
    try {
      const params = {
        outlet: selectedOutlet,
        preset,
        page: drilldownPage,
        limit: 50,
        filterType: drilldownFilter,
        search: drilldownSearch || productSearch
      };
      if (preset === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }

      const res = await api.get('/api/analytics/product-data/orders', { params });
      setDrilldownOrders(res.data?.orders || []);
      setDrilldownTotalPages(res.data?.pagination?.totalPages || 1);
      setDrilldownTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching drilldown orders:', err);
    } finally {
      setDrilldownLoading(false);
    }
  }, [activeTab, selectedOutlet, preset, dateFrom, dateTo, drilldownPage, drilldownFilter, drilldownSearch, productSearch]);

  useEffect(() => {
    fetchDrilldown();
  }, [fetchDrilldown]);

  // Date banner string
  const activeDateBanner = useMemo(() => {
    const outletLabel = `Outlet: ${selectedOutlet}`;
    if (preset === 'today') {
      const todayStr = new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' }).format(new Date());
      return `${outletLabel} • Date: ${todayStr} (Today)`;
    }
    if (preset === 'yesterday') {
      const yDate = new Date(Date.now() - 86400000);
      const yStr = new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' }).format(yDate);
      return `${outletLabel} • Date: ${yStr} (Yesterday)`;
    }
    if (preset === 'weekly') return `${outletLabel} • Date Range: Last 7 Days`;
    if (preset === 'monthly') return `${outletLabel} • Date Range: Last 30 Days`;
    if (preset === 'all') return `${outletLabel} • All Time Records`;
    if (preset === 'custom') {
      return `${outletLabel} • Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}`;
    }
    return outletLabel;
  }, [selectedOutlet, preset, dateFrom, dateTo]);

  // Format currency
  const fmtPKR = (num) => {
    return '₨ ' + (Number(num) || 0).toLocaleString();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!summaryData?.productSales?.length) {
      return toast.error('No product sales data to export');
    }

    const headers = ['Product Name', 'Color', 'Size', 'Orders Count', 'Quantity Sold', 'Total Sales Amount'];
    const rows = summaryData.productSales.map(p => [
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${(p.color || '').replace(/"/g, '""')}"`,
      `"${(p.size || '').replace(/"/g, '""')}"`,
      p.ordersCount,
      p.quantitySold,
      p.totalSalesAmount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `product_data_${selectedOutlet.replace(/\s+/g, '_')}_${preset}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Product data CSV exported');
  };

  const summary = summaryData?.summary || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-600/20">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Product Data & Engraving Analytics
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Admin Intelligence
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Analyze outlet-wise product sales, discounts, customizations, standard/custom sizes, POS engravings & employee activity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-3.5 backdrop-blur">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Outlet Selector */}
          <div className="md:col-span-3">
            <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-purple-400" /> Select Outlet
            </label>
            <select
              value={selectedOutlet}
              onChange={e => setSelectedOutlet(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-purple-500 outline-none transition"
            >
              {outlets.map(out => (
                <option key={out} value={out}>{out}</option>
              ))}
            </select>
          </div>

          {/* Date Presets */}
          <div className="md:col-span-5">
            <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-400" /> Date Filter
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    preset === p.id
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Search */}
          <div className="md:col-span-4">
            <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Search className="w-3 h-3 text-emerald-400" /> Product Filter
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name, article, color, size..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-white text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Range Pickers (if Custom chosen) */}
        {preset === 'custom' && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">From:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">To:</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* Active Context Banner */}
        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-300">{activeDateBanner}</span>
            {productSearch && (
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-medium text-emerald-400 border border-slate-700">
                Product: "{productSearch}"
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            Strict PKT Calendar Boundaries • Valid Records Only
          </span>
        </div>
      </div>

      {/* 8 TOP SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Orders</span>
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white">{loading ? '...' : summary.totalOrders || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Valid sales</div>
        </div>

        {/* Total Quantity Sold */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-indigo-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Units Sold</span>
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-indigo-300">{loading ? '...' : summary.totalQuantity || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Items billed</div>
        </div>

        {/* Total Sales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Total Sales</span>
            <span className="text-xs font-black text-emerald-400">₨</span>
          </div>
          <div className="text-base font-black text-emerald-400 truncate">{loading ? '...' : fmtPKR(summary.totalSales)}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Net revenue</div>
        </div>

        {/* Total Discount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Discount</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-base font-black text-amber-400 truncate">{loading ? '...' : fmtPKR(summary.totalDiscount)}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">{summary.ordersWithDiscount || 0} orders disc.</div>
        </div>

        {/* Customized Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-pink-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Customized</span>
            <Sparkles className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-xl font-black text-pink-300">{loading ? '...' : summary.customizedOrders || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">{summary.customizedProducts || 0} custom units</div>
        </div>

        {/* Total Engravings */}
        <div className="bg-slate-900 border border-purple-500/40 bg-purple-950/20 rounded-2xl p-3.5 flex flex-col justify-between shadow-lg shadow-purple-950/40 hover:border-purple-400 transition">
          <div className="flex items-center justify-between text-purple-300 mb-2">
            <span className="text-[10px] uppercase font-black tracking-wider">Engravings</span>
            <Scissors className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-black text-purple-200">{loading ? '...' : summary.totalEngravings || 0}</div>
          <div className="text-[10px] text-purple-400/80 mt-1 font-semibold">POS + Order units</div>
        </div>

        {/* Custom Size Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Custom Size</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-300">{loading ? '...' : summary.customSizeOrders || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">{summary.customSizeProducts || 0} custom items</div>
        </div>

        {/* Avg Discount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider">Avg Disc.</span>
            <Percent className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-base font-black text-blue-300 truncate">{loading ? '...' : fmtPKR(summary.averageDiscount)}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-medium">Per disc. order</div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="border-b border-slate-800 flex flex-wrap gap-2 pt-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-bold text-xs rounded-t-xl transition border-t-2 border-x border-b-0 ${
                isActive
                  ? 'bg-slate-900 text-white border-purple-500 border-x-slate-800'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-500'}`} />
              {tab.label}
              {tab.id === 'sales' && summaryData?.productSales?.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-normal">
                  {summaryData.productSales.length}
                </span>
              )}
              {tab.id === 'engraving' && summary.totalEngravings > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900/50 text-purple-300 font-bold">
                  {summary.totalEngravings}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        {/* 1. PRODUCT SALES TAB */}
        {activeTab === 'sales' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">Product-Wise Sales Table</h2>
                <p className="text-xs text-slate-400">Actual units sold, order frequency, and revenue per product line</p>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Showing {summaryData?.productSales?.length || 0} product variants
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4 text-center">Orders</th>
                    <th className="py-3 px-4 text-center">Qty Sold</th>
                    <th className="py-3 px-4 text-right">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">Loading product sales...</td>
                    </tr>
                  ) : summaryData?.productSales?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">No sales recorded for the selected filters.</td>
                    </tr>
                  ) : (
                    summaryData?.productSales?.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          {p.productName}
                          {p.productName.toLowerCase().includes('crown') && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-amber-500/20 text-amber-300 rounded font-bold">Crown</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{p.color || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.size === 'Custom Size' || p.size === 'C' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {p.size || 'Standard'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-300">{p.ordersCount}</td>
                        <td className="py-3 px-4 text-center font-black text-purple-400">{p.quantitySold}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-400">{fmtPKR(p.totalSalesAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. DISCOUNT TAB */}
        {activeTab === 'discount' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-black text-white">Discount Analytics</h2>
              <p className="text-xs text-slate-400">Total discounts granted, order proportions, and breakdown by product & date</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Discount Penetration</span>
                <div className="text-2xl font-black text-white">
                  {summary.totalOrders > 0 ? Math.round(((summary.ordersWithDiscount || 0) / summary.totalOrders) * 100) : 0}%
                </div>
                <div className="text-xs text-slate-400 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>With Discount:</span>
                    <span className="font-bold text-emerald-400">{summary.ordersWithDiscount || 0} orders</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Without Discount:</span>
                    <span className="font-bold text-slate-400">{summary.ordersWithoutDiscount || 0} orders</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Discount Given</span>
                <div className="text-2xl font-black text-amber-400">{fmtPKR(summary.totalDiscount)}</div>
                <div className="text-xs text-slate-400 mt-2">
                  Average per discounted order: <strong className="text-white">{fmtPKR(summary.averageDiscount)}</strong>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Discount Rate</span>
                <div className="text-2xl font-black text-indigo-400">
                  {summary.totalSales > 0 ? ((summary.totalDiscount / (summary.totalSales + summary.totalDiscount)) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-slate-400 mt-2">Discount as % of gross billed sales</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Product-wise discounts */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-slate-300 mb-3">Discounts by Product</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {summaryData?.discountBreakdown?.byProduct?.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">No product-specific discounts</div>
                  ) : (
                    summaryData?.discountBreakdown?.byProduct?.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50">
                        <span className="font-medium text-slate-200">{d.product}</span>
                        <span className="font-bold text-amber-400">{fmtPKR(d.discount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Date-wise discounts */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-slate-300 mb-3">Discounts by Date</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {summaryData?.discountBreakdown?.byDate?.length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center">No discounts recorded</div>
                  ) : (
                    summaryData?.discountBreakdown?.byDate?.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50">
                        <span className="font-medium text-slate-400">{d.date}</span>
                        <span className="font-bold text-amber-400">{fmtPKR(d.discount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. CUSTOMIZATION TAB */}
        {activeTab === 'customization' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-black text-white">Customization Analytics & Type Breakdown</h2>
              <p className="text-xs text-slate-400">Detailed count of customizations: Crown, Engraving, Custom Size, Logo Design, and Alterations</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {summaryData?.customizationBreakdown?.types?.map((t, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 hover:border-purple-500/40 transition">
                  <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">{t.type}</span>
                  <div className="text-2xl font-black text-white">{t.products}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{t.orders} applicable orders</div>
                </div>
              ))}
            </div>

            {/* Custom Size + Engraving Deep Dive */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs uppercase font-black text-cyan-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Custom Size & Engraving Correlation
              </h3>
              <p className="text-xs text-slate-400">
                Understand how many custom-size items also required engraving:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block">Custom Size Orders</span>
                  <span className="text-lg font-black text-white">{summaryData?.customizationBreakdown?.customSizeStats?.orders || 0}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block">Custom Size Products</span>
                  <span className="text-lg font-black text-cyan-300">{summaryData?.customizationBreakdown?.customSizeStats?.products || 0}</span>
                </div>
                <div className="bg-slate-900 border border-purple-500/30 rounded-lg p-3 bg-purple-950/20">
                  <span className="text-[10px] text-purple-300 block font-bold">Custom Size + Engraving</span>
                  <span className="text-lg font-black text-purple-300">{summaryData?.customizationBreakdown?.customSizeStats?.withEngraving || 0}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3">
                  <span className="text-[10px] text-slate-400 block">Custom Size Without Engraving</span>
                  <span className="text-lg font-black text-slate-300">{summaryData?.customizationBreakdown?.customSizeStats?.withoutEngraving || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. SIZES TAB */}
        {activeTab === 'sizes' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-black text-white">Size-Wise Customization & Engraving Table</h2>
              <p className="text-xs text-slate-400">Products sold, customizations performed, and engravings required per standard & custom size</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4 text-center">Products Sold</th>
                    <th className="py-3 px-4 text-center">Customized Count</th>
                    <th className="py-3 px-4 text-center">Engraved Count</th>
                    <th className="py-3 px-4 text-right">Customization %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {summaryData?.sizeBreakdown?.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          s.size === 'Custom Size' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-200'
                        }`}>
                          {s.size}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-300">{s.productsSold}</td>
                      <td className="py-3 px-4 text-center font-black text-pink-400">{s.customized}</td>
                      <td className="py-3 px-4 text-center font-black text-purple-400">{s.engraved}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-400">
                        {s.productsSold > 0 ? Math.round((s.customized / s.productsSold) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. ENGRAVING ANALYTICS TAB */}
        {activeTab === 'engraving' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-purple-300 flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-purple-400" />
                  Detailed POS & Order Engraving Analytics
                </h2>
                <p className="text-xs text-slate-400">
                  Actual unit-level engravings tracked from POS billing transactions and order management
                </p>
              </div>
              <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-500/40 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-slate-400">Total Engravings:</span>
                <span className="text-base font-black text-purple-300">{summary.totalEngravings || 0}</span>
              </div>
            </div>

            {/* Detailed Engraving Breakdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* By Product */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Product</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.byProduct?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-200 truncate pr-2">{item.product}</span>
                      <span className="font-black text-purple-400 shrink-0">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Color */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Color</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.byColor?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-200">{item.color}</span>
                      <span className="font-black text-purple-400">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Size */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Size</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.bySize?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-200">{item.size}</span>
                      <span className="font-black text-purple-400">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Outlet */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Outlet</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.byOutlet?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-200">{item.outlet}</span>
                      <span className="font-black text-purple-400">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Employee */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Employee</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.byEmployee?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-200">{item.employee}</span>
                      <span className="font-black text-purple-400">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Date */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs uppercase font-black text-purple-400 mb-2.5">Engravings by Date</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {summaryData?.engravingBreakdown?.byDate?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40">
                      <span className="font-medium text-slate-400">{item.date}</span>
                      <span className="font-black text-purple-400">{item.engravings}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. EMPLOYEE ACTIVITY TAB */}
        {activeTab === 'employees' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-black text-white">Employee Customization Activity Table</h2>
              <p className="text-xs text-slate-400">Actual employees who processed customizations, engravings, and custom-size orders</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Branch / Outlet</th>
                    <th className="py-3 px-4 text-center">Orders Handled</th>
                    <th className="py-3 px-4 text-center">Customizations</th>
                    <th className="py-3 px-4 text-center">Engravings</th>
                    <th className="py-3 px-4 text-center">Custom Sizes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {summaryData?.employeeBreakdown?.map((emp, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-[10px] font-black text-purple-300">
                          {emp.employeeName.charAt(0)}
                        </div>
                        {emp.employeeName}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{emp.outlet}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">{emp.ordersHandled}</td>
                      <td className="py-3 px-4 text-center font-black text-pink-400">{emp.customizationsCompleted}</td>
                      <td className="py-3 px-4 text-center font-black text-purple-400">{emp.engravingsCompleted}</td>
                      <td className="py-3 px-4 text-center font-black text-cyan-400">{emp.customSizeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. ORDER DRILL-DOWN TAB */}
        {activeTab === 'drilldown' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white">Order-Level Verification & Drill-Down</h2>
                <p className="text-xs text-slate-400">Drill down from summary analytics to verify actual underlying orders and POS invoices</p>
              </div>

              {/* Sub-filters for drilldown */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filter:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'engraved', label: 'Engraved' },
                  { id: 'custom_size', label: 'Custom Size' },
                  { id: 'discounted', label: 'Discounted' },
                  { id: 'customized', label: 'Any Custom' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setDrilldownFilter(f.id); setDrilldownPage(1); }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition border ${
                      drilldownFilter === f.id
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drilldown Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter drilldown orders by customer, order #, employee, product..."
                value={drilldownSearch}
                onChange={e => { setDrilldownSearch(e.target.value); setDrilldownPage(1); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            </div>

            {/* Drilldown Orders Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Order / Receipt #</th>
                    <th className="py-3 px-3">Outlet</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Employee</th>
                    <th className="py-3 px-3">Products & Customization Details</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {drilldownLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">Loading drilldown orders...</td>
                    </tr>
                  ) : drilldownOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">No orders match the drilldown filter.</td>
                    </tr>
                  ) : (
                    drilldownOrders.map((ord, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white font-mono">{ord.orderNumber}</div>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            ord.source === 'POS' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {ord.source}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-300">{ord.outlet}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200">{ord.customerName}</div>
                          <div className="text-[10px] text-slate-500">{ord.customerPhone}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300 font-medium">{ord.employee}</td>
                        <td className="py-3 px-3 space-y-1.5 max-w-xs">
                          {ord.items?.map((it, iIdx) => (
                            <div key={iIdx} className="text-[11px] bg-slate-950/60 rounded p-1.5 border border-slate-800/40">
                              <div className="font-bold text-slate-200">
                                {it.productName} × {it.quantity}
                                {it.color && <span className="text-slate-400 font-normal"> ({it.color})</span>}
                                {it.size && (
                                  <span className={`ml-1 text-[9px] font-black px-1 rounded ${
                                    it.isCustomSize ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {it.size}
                                  </span>
                                )}
                              </div>
                              {it.engravingText && (
                                <div className="text-[10px] text-purple-300 font-semibold mt-0.5 flex items-center gap-1">
                                  <Scissors className="w-2.5 h-2.5" />
                                  Engraving: "{it.engravingText}" ({it.engravingCount || 1})
                                </div>
                              )}
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-black text-emerald-400">{fmtPKR(ord.netAmount)}</div>
                          {ord.discountAmount > 0 && (
                            <div className="text-[10px] text-amber-400 font-bold">Disc: {fmtPKR(ord.discountAmount)}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(ord.orderDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 text-xs">
              <span className="text-slate-500">
                Total {drilldownTotal} orders • Page {drilldownPage} of {drilldownTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrilldownPage(p => Math.max(1, p - 1))}
                  disabled={drilldownPage <= 1 || drilldownLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDrilldownPage(p => Math.min(drilldownTotalPages, p + 1))}
                  disabled={drilldownPage >= drilldownTotalPages || drilldownLoading}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
