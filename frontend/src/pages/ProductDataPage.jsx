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
  FileSpreadsheet,
  Boxes,
  Warehouse,
  Store,
  Eye,
  ArrowUpDown,
  RotateCcw,
  AlertTriangle,
  Tag,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  X
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
  { id: 'inventory-stock', label: 'Inventory Stock Report', icon: Boxes },
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

  // Inventory Stock Report states
  const [stockLocation, setStockLocation] = useState('All Locations');
  const [stockCategory, setStockCategory] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [stockVariant, setStockVariant] = useState('');
  const [stockStatus, setStockStatus] = useState('all'); // all, in_stock, low_stock, out_of_stock
  const [stockPage, setStockPage] = useState(1);
  const [stockLimit, setStockLimit] = useState(50);
  const [stockSortBy, setStockSortBy] = useState('name');
  const [stockSortOrder, setStockSortOrder] = useState('asc');
  const [stockLoading, setStockLoading] = useState(false);
  const [stockData, setStockData] = useState(null);
  const [breakdownModalItem, setBreakdownModalItem] = useState(null);
  const [showCategoryTable, setShowCategoryTable] = useState(true);


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

  // Fetch Inventory Stock Report
  const fetchInventoryStock = useCallback(async (isRefresh = false) => {
    setStockLoading(true);
    try {
      const params = {
        location: stockLocation,
        category: stockCategory,
        search: stockSearch,
        variant: stockVariant,
        status: stockStatus,
        sortBy: stockSortBy,
        sortOrder: stockSortOrder,
        page: stockPage,
        limit: stockLimit,
        preset,
        refresh: isRefresh ? 'true' : 'false'
      };
      if (preset === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      const res = await api.get('/api/analytics/product-data/inventory-stock', { params });
      setStockData(res.data);
      if (isRefresh) toast.success('Inventory stock refreshed');
    } catch (err) {
      console.error('Error fetching inventory stock report:', err);
      toast.error('Failed to load inventory stock report');
    } finally {
      setStockLoading(false);
    }
  }, [stockLocation, stockCategory, stockSearch, stockVariant, stockStatus, stockSortBy, stockSortOrder, stockPage, stockLimit, preset, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'inventory-stock') {
      fetchInventoryStock();
    }
  }, [activeTab, fetchInventoryStock]);

  // Export CSV handler
  const handleExportStockReport = async () => {
    try {
      toast.loading('Generating inventory export...', { id: 'export-stock' });
      const params = {
        location: stockLocation,
        category: stockCategory,
        search: stockSearch,
        variant: stockVariant,
        status: stockStatus,
        sortBy: stockSortBy,
        sortOrder: stockSortOrder,
        limit: 'all',
        preset
      };
      if (preset === 'custom') {
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;
      }
      const res = await api.get('/api/analytics/product-data/inventory-stock', { params });
      const variants = res.data?.variants || [];
      const configuredOutlets = res.data?.configuredOutlets || [];

      if (!variants.length) {
        toast.error('No inventory records found for export', { id: 'export-stock' });
        return;
      }

      // Build CSV
      const headers = [
        'Product Name',
        'Category',
        'Color',
        'Size',
        'SKU',
        'Barcode',
        'Warehouse Stock',
        ...configuredOutlets.map(o => `${o} Stock`),
        'Total Physical Stock',
        'Reserved / Allocated',
        'Available Stock',
        'Sold Qty (Period)',
        'Sales Remaining (Unsold)'
      ];

      const csvRows = [headers.join(',')];

      for (const v of variants) {
        const outletCols = configuredOutlets.map(o => {
          const breakdown = v.locationBreakdown?.find(lb => lb.location === o);
          return breakdown ? breakdown.quantity : 0;
        });

        const row = [
          `"${(v.productName || '').replace(/"/g, '""')}"`,
          `"${(v.category || '').replace(/"/g, '""')}"`,
          `"${(v.color || '').replace(/"/g, '""')}"`,
          `"${(v.size || '').replace(/"/g, '""')}"`,
          `"${(v.sku || '').replace(/"/g, '""')}"`,
          `"${(v.barcode || '').replace(/"/g, '""')}"`,
          v.warehouseStock || 0,
          ...outletCols,
          v.totalPhysicalStock || 0,
          v.allocatedStock || 0,
          v.availableStock || 0,
          v.soldQuantity || 0,
          v.salesRemaining || 0
        ];
        csvRows.push(row.join(','));
      }

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Inventory_Stock_Report_${stockLocation.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${variants.length} inventory records`, { id: 'export-stock' });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export inventory report', { id: 'export-stock' });
    }
  };

  // Reset Filters handler
  const handleResetStockFilters = () => {
    setStockLocation('All Locations');
    setStockCategory('');
    setStockSearch('');
    setStockVariant('');
    setStockStatus('all');
    setStockPage(1);
    setStockSortBy('name');
    setStockSortOrder('asc');
    toast.success('Inventory filters reset to default');
  };


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
              {tab.id === 'inventory-stock' && stockData?.summary?.totalVariants > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-900/50 text-indigo-300 font-bold">
                  {stockData.summary.totalStock.toLocaleString()}
                </span>
              )}
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
        {/* 0. INVENTORY STOCK REPORT TAB */}
        {activeTab === 'inventory-stock' && (
          <div className="space-y-6">
            {/* Header & Primary Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      Inventory Stock Report
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                        Live Ledger
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time physical stock across Warehouse and Outlets, active allocations, period sales & unsold remaining
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {stockData?.lastUpdated && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Updated: {new Date(stockData.lastUpdated).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => fetchInventoryStock(true)}
                  disabled={stockLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition"
                  title="Force re-fetch from database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${stockLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleExportStockReport}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV / Excel
                </button>
                <button
                  onClick={handleResetStockFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700 transition"
                  title="Clear all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  Reset
                </button>
              </div>
            </div>

            {/* Comprehensive Filter Toolbar */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Location Filter */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-400" /> Location
                  </label>
                  <select
                    value={stockLocation}
                    onChange={e => {
                      setStockLocation(e.target.value);
                      setStockPage(1);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 outline-none transition cursor-pointer"
                  >
                    {(stockData?.locations || ['All Locations', 'Warehouse', 'Johar Town', 'Jail Road']).map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Category Filter */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-purple-400" /> Category
                  </label>
                  <select
                    value={stockCategory}
                    onChange={e => {
                      setStockCategory(e.target.value);
                      setStockPage(1);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-purple-500 outline-none transition cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    {(stockData?.allCategories || []).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Product Search Filter */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Search className="w-3 h-3 text-emerald-400" /> Product Name / Barcode
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search name, barcode, SKU..."
                      value={stockSearch}
                      onChange={e => {
                        setStockSearch(e.target.value);
                        setStockPage(1);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none transition"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    {stockSearch && (
                      <button
                        onClick={() => { setStockSearch(''); setStockPage(1); }}
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Variant (Color/Size) Filter */}
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-400" /> Variant (Color / Size)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. M, Navy Blue, XL..."
                      value={stockVariant}
                      onChange={e => {
                        setStockVariant(e.target.value);
                        setStockPage(1);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition"
                    />
                    <Layers className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                    {stockVariant && (
                      <button
                        onClick={() => { setStockVariant(''); setStockPage(1); }}
                        className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Filter Pills & Quick Toggles */}
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                    <SlidersHorizontal className="w-3 h-3 text-indigo-400" /> Status:
                  </span>
                  {[
                    { id: 'all', label: 'All Items', count: stockData?.summary?.totalVariants },
                    { id: 'in_stock', label: 'In Stock', count: (stockData?.summary?.totalVariants || 0) - (stockData?.summary?.outOfStockCount || 0) },
                    { id: 'low_stock', label: 'Low Stock (1-5)', count: stockData?.summary?.lowStockCount, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                    { id: 'out_of_stock', label: 'Out of Stock (0)', count: stockData?.summary?.outOfStockCount, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
                  ].map(st => {
                    const active = stockStatus === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          setStockStatus(st.id);
                          setStockPage(1);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {st.label}
                        {st.count != null && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            st.badgeColor && !active ? st.badgeColor : 'bg-slate-800 text-slate-300'
                          }`}>
                            {st.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Scope Note */}
                <span className="text-[11px] text-slate-400 font-medium">
                  Scope: <strong className="text-white">{stockLocation}</strong>
                  {stockCategory && <> • Category: <strong className="text-purple-300">{stockCategory}</strong></>}
                </span>
              </div>
            </div>

            {/* 6 TOP INVENTORY SUMMARY CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Card 1: Total Stock Quantity */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-indigo-500/40 transition">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300">Total Stock</span>
                  <Boxes className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {stockLoading ? '...' : (stockData?.summary?.totalStock ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  Physical units at {stockLocation === 'All Locations' ? 'All Locations' : stockLocation}
                </div>
              </div>

              {/* Card 2: Distinct Products / Variants */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-purple-500/40 transition">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-purple-300">Variants</span>
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-200">
                  {stockLoading ? '...' : (stockData?.summary?.totalVariants ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Distinct product lines</div>
              </div>

              {/* Card 3: Warehouse Stock */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-300">Warehouse</span>
                  <Warehouse className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300">
                  {stockLoading ? '...' : (stockData?.summary?.warehouseStock ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">Central Warehouse</div>
              </div>

              {/* Card 4: Outlet Stock */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-cyan-500/40 transition">
                <div className="flex items-center justify-between text-slate-400 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-cyan-300">Outlet Stock</span>
                  <Store className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-cyan-300">
                  {stockLoading ? '...' : (stockData?.summary?.outletStock ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {stockLocation === 'Warehouse' ? 'Not selected' : (stockLocation === 'All Locations' ? 'All Retail Outlets' : stockLocation)}
                </div>
              </div>

              {/* Card 5: Low Stock Items */}
              <div className="bg-slate-900/90 border border-amber-500/30 bg-amber-950/10 rounded-2xl p-3.5 flex flex-col justify-between hover:border-amber-400 transition">
                <div className="flex items-center justify-between text-amber-300 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider">Low Stock</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-300">
                  {stockLoading ? '...' : (stockData?.summary?.lowStockCount ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-amber-400/80 mt-1 font-semibold">1 to 5 units remaining</div>
              </div>

              {/* Card 6: Out-of-Stock Items */}
              <div className="bg-slate-900/90 border border-rose-500/30 bg-rose-950/10 rounded-2xl p-3.5 flex flex-col justify-between hover:border-rose-400 transition">
                <div className="flex items-center justify-between text-rose-300 mb-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider">Out of Stock</span>
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-300">
                  {stockLoading ? '...' : (stockData?.summary?.outOfStockCount ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-rose-400/80 mt-1 font-semibold">0 physical units</div>
              </div>
            </div>

            {/* Critical Metric Distinction Ribbon */}
            <div className="rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Physical Stock:</span>
                  <span className="font-black text-white">{stockLoading ? '...' : (stockData?.summary?.totalStock || 0).toLocaleString()}</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400/90 font-bold">− Reserved / Allocated:</span>
                  <span className="font-black text-amber-300">{stockLoading ? '...' : (stockData?.summary?.totalAllocated || 0).toLocaleString()}</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">= Available Stock:</span>
                  <span className="font-black text-emerald-300">{stockLoading ? '...' : (stockData?.summary?.totalAvailable || 0).toLocaleString()}</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-400 font-bold">Sold (Active Period):</span>
                  <span className="font-black text-purple-300">{stockLoading ? '...' : (stockData?.summary?.totalSold || 0).toLocaleString()}</span>
                </div>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <span className="text-amber-300 font-black">Sales Remaining (Unsold):</span>
                  <span className="font-black text-amber-200">{stockLoading ? '...' : (stockData?.summary?.salesRemaining || 0).toLocaleString()}</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-medium italic">
                * Physical inventory remaining and period sales remaining are distinct values.
              </span>
            </div>

            {/* Category-Wise Stock Breakdown (Collapsible) */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowCategoryTable(prev => !prev)}
                className="w-full px-4 py-3 bg-slate-900/70 border-b border-slate-800 flex items-center justify-between text-left hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black text-white">Category-Wise Stock Summary</span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ({stockData?.categoriesBreakdown?.length || 0} Categories • Click row to filter product ledger below)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{showCategoryTable ? 'Hide Table' : 'Show Table'}</span>
                  {showCategoryTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showCategoryTable && (
                <div className="overflow-x-auto p-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Warehouse Stock</th>
                        <th className="py-2.5 px-3 text-right">Outlet Stock</th>
                        <th className="py-2.5 px-3 text-right">Total Physical Stock</th>
                        <th className="py-2.5 px-3 text-center">Variants</th>
                        <th className="py-2.5 px-3 text-right">% of Total</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {stockLoading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-500">Loading category totals...</td>
                        </tr>
                      ) : !stockData?.categoriesBreakdown?.length ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-500">No categories found matching filters.</td>
                        </tr>
                      ) : (
                        stockData.categoriesBreakdown.map((cat, idx) => {
                          const totalAll = stockData.summary.totalStock || 1;
                          const pct = ((cat.totalStock / totalAll) * 100).toFixed(1);
                          const isSelected = stockCategory.toLowerCase() === cat.category.toLowerCase();
                          return (
                            <tr
                              key={idx}
                              onClick={() => {
                                setStockCategory(isSelected ? '' : cat.category);
                                setStockPage(1);
                              }}
                              className={`cursor-pointer transition ${
                                isSelected ? 'bg-purple-900/30 hover:bg-purple-900/40' : 'hover:bg-slate-900/60'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                  isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-purple-300'
                                }`}>
                                  {cat.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-400 font-mono font-bold">
                                {cat.warehouseStock.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right text-cyan-400 font-mono font-bold">
                                {cat.outletStock.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right text-white font-mono font-black">
                                {cat.totalStock.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {cat.variantCount}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(0, Number(pct)))}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400 font-bold">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStockCategory(isSelected ? '' : cat.category);
                                    setStockPage(1);
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition border ${
                                    isSelected
                                      ? 'bg-purple-600 text-white border-purple-500'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                                  }`}
                                >
                                  {isSelected ? 'Active Filter' : 'Filter Ledger'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {/* Summary Footer Row */}
                    {stockData?.categoriesBreakdown?.length > 0 && (
                      <tfoot className="bg-slate-950 font-black text-xs border-t-2 border-slate-800 text-white">
                        <tr>
                          <td className="py-3 px-3 uppercase tracking-wider text-slate-400">Total Across Categories</td>
                          <td className="py-3 px-3 text-right text-emerald-400 font-mono">
                            {(stockData.summary.warehouseStock || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-cyan-400 font-mono">
                            {(stockData.summary.outletStock || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right text-indigo-300 font-mono font-black text-sm">
                            {(stockData.summary.totalStock || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">
                            {stockData.summary.totalVariants}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">100.0%</td>
                          <td className="py-3 px-3 text-center text-[10px] text-emerald-400 font-bold">100% Balanced</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Detailed Product-Wise Inventory Ledger */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    Product & Variant Stock Ledger
                    <span className="text-xs font-normal text-slate-400">
                      (Showing {stockData?.variants?.length || 0} of {stockData?.pagination?.total || 0} variants)
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sortable ledger with location quantities, reserved allocations, and period sales
                  </p>
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 text-[11px]">Rows per page:</span>
                  <select
                    value={stockLimit}
                    onChange={e => {
                      setStockLimit(Number(e.target.value));
                      setStockPage(1);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Main Ledger Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3">#</th>
                      <th
                        className="py-3 px-3 cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('name');
                          setStockSortOrder(o => (stockSortBy === 'name' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Product Name
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('category');
                          setStockSortOrder(o => (stockSortBy === 'category' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Category
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        </div>
                      </th>
                      <th className="py-3 px-3">Color & Size</th>
                      <th className="py-3 px-3">SKU / Barcode</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('warehouse');
                          setStockSortOrder(o => (stockSortBy === 'warehouse' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Warehouse
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('outlet');
                          setStockSortOrder(o => (stockSortBy === 'outlet' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {stockLocation === 'All Locations' || stockLocation === 'Warehouse' ? 'Outlets' : stockLocation}
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('stock');
                          setStockSortOrder(o => (stockSortBy === 'stock' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center justify-end gap-1 text-indigo-300">
                          Total Stock
                          <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right text-amber-300">Allocated</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('available');
                          setStockSortOrder(o => (stockSortBy === 'available' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center justify-end gap-1 text-emerald-300">
                          Available
                          <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                        onClick={() => {
                          setStockSortBy('sold');
                          setStockSortOrder(o => (stockSortBy === 'sold' && o === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        <div className="flex items-center justify-end gap-1 text-purple-300">
                          Sold ({preset})
                          <ArrowUpDown className="w-3 h-3 text-purple-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right text-amber-300">Sales Remaining</th>
                      <th className="py-3 px-3 text-center">Locations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {stockLoading ? (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                            <span>Loading inventory records...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !stockData?.variants?.length ? (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-slate-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Package className="w-8 h-8 text-slate-600" />
                            <span className="font-bold text-slate-400">No inventory products found matching your active filters.</span>
                            <button
                              onClick={handleResetStockFilters}
                              className="mt-1 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:text-white"
                            >
                              Reset Filters & Show All
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      stockData.variants.map((v, idx) => {
                        const rowNum = ((stockPage - 1) * stockLimit) + idx + 1;
                        const isZero = v.physicalStock === 0;
                        const isLow = v.physicalStock > 0 && v.physicalStock <= 5;
                        return (
                          <tr
                            key={v.id || idx}
                            className={`hover:bg-slate-800/40 transition ${
                              isZero ? 'bg-rose-950/5' : (isLow ? 'bg-amber-950/5' : '')
                            }`}
                          >
                            <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{rowNum}</td>
                            <td className="py-3 px-3 font-bold text-white">
                              <div className="flex items-center gap-2.5">
                                {v.imageUrl ? (
                                  <img
                                    src={v.imageUrl}
                                    alt={v.productName}
                                    className="w-8 h-8 rounded-lg object-contain bg-slate-900 border border-slate-800 p-0.5"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-white hover:text-indigo-300 transition">
                                    {v.productName}
                                  </div>
                                  {isZero && (
                                    <span className="text-[9px] font-bold text-rose-400">Out of Stock</span>
                                  )}
                                  {isLow && (
                                    <span className="text-[9px] font-bold text-amber-400">Low Stock ({v.physicalStock} left)</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300">
                                {v.category}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {v.color && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-300">
                                    {v.color}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">
                                  {v.size || 'Standard'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                              <div>{v.sku || '—'}</div>
                              {v.barcode && (
                                <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1">
                                  <Hash className="w-2.5 h-2.5" /> {v.barcode}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                              {v.warehouseStock.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400">
                              {v.outletStock.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-white text-sm">
                              {v.physicalStock.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              {v.allocatedStock > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {v.allocatedStock}
                                </span>
                              ) : (
                                <span className="text-slate-600">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-300">
                              {v.availableStock.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-purple-300">
                              {v.soldQuantity.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-black text-amber-300">
                              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                {v.salesRemaining.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => setBreakdownModalItem(v)}
                                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500 hover:bg-indigo-950/40 text-[10px] font-bold flex items-center gap-1 mx-auto transition"
                                title="Inspect distribution across warehouse and outlets"
                              >
                                <Eye className="w-3 h-3 text-indigo-400" />
                                Breakdown
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {stockData?.pagination && stockData.pagination.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs">
                  <span className="text-slate-500">
                    Showing {((stockPage - 1) * stockLimit) + 1} to {Math.min(stockData.pagination.total, stockPage * stockLimit)} of {stockData.pagination.total} variants
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setStockPage(p => Math.max(1, p - 1))}
                      disabled={stockPage <= 1 || stockLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 font-bold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: Math.min(5, stockData.pagination.totalPages) }, (_, i) => {
                      let pageNumber = stockPage - 2 + i;
                      if (stockPage <= 3) pageNumber = i + 1;
                      else if (stockPage >= stockData.pagination.totalPages - 2) {
                        pageNumber = stockData.pagination.totalPages - 4 + i;
                      }
                      if (pageNumber < 1 || pageNumber > stockData.pagination.totalPages) return null;
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setStockPage(pageNumber)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition border ${
                            stockPage === pageNumber
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setStockPage(p => Math.min(stockData.pagination.totalPages, p + 1))}
                      disabled={stockPage >= stockData.pagination.totalPages || stockLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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

      {/* LOCATION BREAKDOWN MODAL */}
      {breakdownModalItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {breakdownModalItem.imageUrl ? (
                  <img
                    src={breakdownModalItem.imageUrl}
                    alt={breakdownModalItem.productName}
                    className="w-12 h-12 rounded-xl object-contain bg-slate-950 border border-slate-800 p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400">
                    <Boxes className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-black text-white">{breakdownModalItem.productName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300">
                      {breakdownModalItem.category}
                    </span>
                    {breakdownModalItem.color && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-950 border border-slate-800 text-slate-300">
                        Color: {breakdownModalItem.color}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">
                      Size: {breakdownModalItem.size}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBreakdownModalItem(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Identifier & Total Stock Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Physical</span>
                <span className="text-base font-black text-white font-mono">
                  {breakdownModalItem.totalPhysicalStock.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Allocated</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {breakdownModalItem.allocatedStock.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Available</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {breakdownModalItem.availableStock.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Period Sold</span>
                <span className="text-base font-black text-purple-400 font-mono">
                  {breakdownModalItem.soldQuantity.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Outlet Breakdown Table */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Physical Stock Distribution by Location
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3">Variant</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {(breakdownModalItem.locationBreakdown || []).map((loc, idx) => {
                      const total = breakdownModalItem.totalPhysicalStock || 1;
                      const sharePct = ((loc.quantity / total) * 100).toFixed(0);
                      const isZero = loc.quantity === 0;
                      const isLow = loc.quantity > 0 && loc.quantity <= 5;
                      const isWarehouse = loc.location.toLowerCase().includes('warehouse');
                      return (
                        <tr key={idx} className="hover:bg-slate-900/50 transition">
                          <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                            {isWarehouse ? (
                              <Warehouse className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Store className="w-3.5 h-3.5 text-cyan-400" />
                            )}
                            {loc.location}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {breakdownModalItem.color || 'Standard'} / {breakdownModalItem.size}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-white text-sm">
                            {loc.quantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isZero ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                Low ({loc.quantity})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isWarehouse ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                                  style={{ width: `${Math.min(100, Math.max(0, Number(sharePct)))}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 font-bold">{sharePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Barcode: <strong className="text-slate-300 font-mono">{breakdownModalItem.barcode || '—'}</strong>
                {breakdownModalItem.sku && <> • SKU: <strong className="text-slate-300 font-mono">{breakdownModalItem.sku}</strong></>}
              </span>
              <button
                onClick={() => setBreakdownModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

