import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  BarChart3, DollarSign, Package, ShoppingCart, RotateCcw, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, Search, Eye, Activity, Clock,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, FileText, Timer,
  Store, Users, CreditCard, Zap, Target, ChevronDown, ChevronUp,
  LayoutDashboard, Warehouse, Factory, ThumbsUp, ThumbsDown,
  ShoppingBag, GitBranch, PlusCircle, ListOrdered
} from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

const KpiCard = ({ icon: Icon, label, value, sub, color, onClick, trend }) => (
  <div onClick={onClick} className={`glass p-4 md:p-5 rounded-2xl border-2 border-gray-700/50 hover:border-amber-500/30 transition-all ${onClick ? 'cursor-pointer' : ''}`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-xl ${color || 'bg-blue-500/10'}`}>
        <Icon size={18} className={color ? 'text-white' : 'text-blue-400'} />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center gap-1 text-[10px] font-black ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-xl md:text-2xl font-black text-white">{value}</p>
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    {sub && <p className="text-[9px] text-gray-600 mt-1">{sub}</p>}
  </div>
);

const SectionHeader = ({ icon: Icon, title, color, badge }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <div className={`p-2 rounded-lg ${color || 'bg-amber-500/10'}`}>
        <Icon size={16} className={color ? 'text-white' : 'text-amber-400'} />
      </div>
      <h2 className="text-sm font-black text-white uppercase tracking-wider">{title}</h2>
    </div>
    {badge !== undefined && (
      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400">{badge}</span>
    )}
  </div>
);

const CollapsibleSection = ({ icon, title, color, badge, defaultOpen, children }) => {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
        <SectionHeader icon={icon} title={title} color={color} badge={badge} />
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="px-4 md:px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
};

const MiniTable = ({ headers, rows }) => (
  <div className="overflow-x-auto max-h-64 overflow-y-auto">
    <table className="w-full text-left text-[10px]">
      <thead className="sticky top-0 bg-gray-900">
        <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
          {headers.map((h, i) => (
            <th key={i} className={`pb-2 ${i < headers.length - 1 ? 'pr-3' : ''} ${h.right ? 'text-right' : ''}`}>{h.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-b border-gray-800/30 hover:bg-gray-800/20">
            {row.cells.map((cell, ci) => (
              <td key={ci} className={`py-1.5 ${ci < row.cells.length - 1 ? 'pr-3' : ''} ${cell.right ? 'text-right' : ''} ${cell.bold ? 'font-bold' : ''} ${cell.color || 'text-gray-400'}`}>
                {cell.value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StoreDashboardPage = () => {
  const navigate = useNavigate();
  const [, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState('monthly');
  const [search, setSearch] = useState('');

  const fetchData = async (r, s) => {
    setLoading(true);
    try {
      const res = await api.get('/api/store-dashboard', { params: { range: r || range, search: s || '' } });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load dashboard');
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => { fetchData(); setRefreshKey(k => k + 1); };

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => fetchData(range, search), 400);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const handleRangeChange = (r) => { setRange(r); fetchData(r, search); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <RefreshCw className="animate-spin text-amber-400" size={32} />
        <span className="ml-3 text-gray-400 text-sm font-bold">Loading Store Dashboard...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center py-20 text-gray-500">
          <LayoutDashboard size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-bold">Failed to load dashboard</p>
          <button onClick={handleRefresh} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">Retry</button>
        </div>
      </div>
    );
  }

  const { sales, inventory, tasks, invoiceTracking, products, returns, delays, performance, demands, allocations } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
            <LayoutDashboard size={20} className="text-amber-400" /> Store Dashboard
          </h1>
          <p className="text-[10px] text-gray-500 font-bold mt-0.5">Central analytics hub for the Store module</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
            {['daily', 'weekly', 'monthly', 'yearly', 'all'].map(r => (
              <button key={r} onClick={() => handleRangeChange(r)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${range === r ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white'}`}>
                {r === 'daily' ? 'Today' : r === 'weekly' ? '7D' : r === 'monthly' ? '30D' : r === 'yearly' ? 'Year' : 'All'}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-[200px] hidden md:block">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-amber-500" />
          </div>
          <button onClick={handleRefresh} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white border border-gray-700 text-xs">
            <RefreshCw size={14} className="inline mr-1" /> Refresh
          </button>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <KpiCard icon={ShoppingCart} label="Total Sales" value={sales.totalSales} color="bg-blue-500/10" />
        <KpiCard icon={DollarSign} label="Revenue" value={formatCurrency(sales.totalRevenue)} color="bg-emerald-500/10" />
        <KpiCard icon={Package} label="Stock Value" value={formatCurrency(inventory.totalStockValue)} color="bg-purple-500/10" />
        <KpiCard icon={Warehouse} label="Warehouse Stock" value={inventory.totalWarehouseStock.toLocaleString()} color="bg-amber-500/10" />
        <KpiCard icon={Eye} label="Unseen Tasks" value={tasks.unseenTasks} onClick={() => navigate('/tasks')} color="bg-red-500/10" />
        <KpiCard icon={ListOrdered} label="Pending Demands" value={demands.pending} onClick={() => navigate('/warehouse')} color="bg-orange-500/10" />
        <KpiCard icon={GitBranch} label="Allocations" value={allocations.total} color="bg-cyan-500/10" />
      </div>

      {/* 1. Order Analytics */}
      <CollapsibleSection icon={Activity} title="Order Analytics" color="bg-blue-500/10" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Eye} label="Unseen Orders" value={tasks.unseenTasks} sub="Pending in STORE stage" onClick={() => navigate('/tasks')} color="bg-blue-500/10" />
          <KpiCard icon={CheckCircle2} label="Seen Orders" value={tasks.seenTasks} sub="Viewed by employees" color="bg-purple-500/10" />
          <KpiCard icon={Activity} label="Active Orders" value={tasks.activeTasks} sub="In progress" color="bg-emerald-500/10" />
          <KpiCard icon={Factory} label="From Production" value={tasks.ordersInStore} sub="Orders in STORE stage" onClick={() => navigate('/tasks')} color="bg-amber-500/10" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Clock} label="Delayed Orders" value={delays.totalDelayed} sub={`${delays.urgentOrders.length} urgent (48h+)`} color="bg-red-500/10" />
          <KpiCard icon={Timer} label="Delayed in Store" value={delays.delayedInStore} color="bg-orange-500/10" />
          <KpiCard icon={TrendingUp} label="Total Orders (all)" value={sales.totalOrders} color="bg-indigo-500/10" />
          <KpiCard icon={RotateCcw} label="Return Rate" value={`${returns.returnPercentage}%`} color="bg-pink-500/10" />
        </div>
        {delays.urgentOrders.length > 0 && (
          <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-3">
            <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Zap size={12} /> Urgent Orders (48h+ Delayed)
            </h3>
            <div className="space-y-1.5">
              {delays.urgentOrders.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white">{d.orderNumber}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange-900/50 text-orange-400">{d.delayedStage}</span>
                    <span className="text-[9px] text-gray-500">{d.customerName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-400">
                    {Math.floor(d.delayDurationHours / 24)}d {d.delayDurationHours % 24}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* 2. Warehouse POS Analytics */}
      <CollapsibleSection icon={ShoppingCart} title="Warehouse POS Analytics" color="bg-emerald-500/10" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={ShoppingCart} label="Total Sales" value={sales.totalSales} color="bg-blue-500/10" />
          <KpiCard icon={DollarSign} label="Total Revenue" value={formatCurrency(sales.totalRevenue)} color="bg-emerald-500/10" />
          <KpiCard icon={RotateCcw} label="Total Returns" value={sales.totalReturns} color="bg-red-500/10" />
          <KpiCard icon={DollarSign} label="Total Discounts" value={formatCurrency(sales.totalDiscounts)} color="bg-orange-500/10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-blue-500/5 rounded-2xl border border-blue-500/10 p-3">
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <CreditCard size={12} /> Payment Breakdown
            </h3>
            <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
              <span className="text-xs text-white font-bold">COD</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-emerald-400">{sales.codSales} sales</span>
                <span className="text-[10px] text-gray-400">{formatCurrency(sales.codRevenue)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-white font-bold">Online Paid</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-blue-400">{sales.onlineSales} sales</span>
                <span className="text-[10px] text-gray-400">{formatCurrency(sales.onlineRevenue)}</span>
              </div>
            </div>
          </div>
          <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-3">
            <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BarChart3 size={12} /> Performance
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Avg Order Value</span>
                <span className="text-[10px] font-bold text-white">{formatCurrency(performance.avgOrderValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Revenue/Day</span>
                <span className="text-[10px] font-bold text-white">{formatCurrency(performance.salesPerDay)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Return Rate</span>
                <span className="text-[10px] font-bold text-red-400">{performance.returnRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Stock Turnover</span>
                <span className="text-[10px] font-bold text-purple-400">{performance.stockTurnoverRate}</span>
              </div>
            </div>
          </div>
        </div>
        {sales.salesTrend.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Sales Trend ({range})</h3>
            <MiniTable
              headers={[
                { label: 'Date' },
                { label: 'Sales', right: true },
                { label: 'Revenue', right: true },
                { label: 'COD', right: true },
                { label: 'Online', right: true },
                { label: 'Returns', right: true },
              ]}
              rows={sales.salesTrend.slice(0, 31).map(d => ({
                cells: [
                  { value: d.date, color: 'text-gray-400' },
                  { value: d.count, color: 'text-white font-bold', right: true },
                  { value: formatCurrency(d.revenue), color: 'text-emerald-400', right: true },
                  { value: d.cod || 0, color: 'text-emerald-400', right: true },
                  { value: d.online || 0, color: 'text-blue-400', right: true },
                  { value: d.returns, color: 'text-red-400', right: true },
                ]
              }))}
            />
          </div>
        )}
      </CollapsibleSection>

      {/* 3. Product Analytics */}
      <CollapsibleSection icon={Target} title="Product Analytics" color="bg-cyan-500/10" badge={`${products.totalProductsSold} products`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-3">
            <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <TrendingUp size={12} /> Best Selling
            </h3>
            <div className="space-y-2">
              {products.bestSelling.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-black text-gray-600 w-4">{i + 1}.</span>
                    <span className="text-[10px] text-white truncate">{p.name}{p.color ? ` (${p.color})` : ''}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 ml-2">{p.totalQty} sold</span>
                </div>
              ))}
              {products.bestSelling.length === 0 && <p className="text-[10px] text-gray-500">No sales data</p>}
            </div>
          </div>
          <div className="bg-red-500/5 rounded-2xl border border-red-500/10 p-3">
            <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <TrendingDown size={12} /> Lowest Selling
            </h3>
            <div className="space-y-2">
              {products.lowestSelling.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[9px] font-black text-gray-600 w-4">{i + 1}.</span>
                    <span className="text-[10px] text-white truncate">{p.name}{p.color ? ` (${p.color})` : ''}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-400 ml-2">{p.totalQty} sold</span>
                </div>
              ))}
              {products.lowestSelling.length === 0 && <p className="text-[10px] text-gray-500">No sales data</p>}
            </div>
          </div>
          <div className="bg-orange-500/5 rounded-2xl border border-orange-500/10 p-3">
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <RotateCcw size={12} /> Most Returned
            </h3>
            <div className="space-y-2">
              {products.mostReturned.length === 0 && <p className="text-[10px] text-gray-500">No returns</p>}
              {products.mostReturned.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[10px] text-white truncate">{p.name}</span>
                  <span className="text-[10px] font-bold text-orange-400 ml-2">{p.qty} returns</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {products.productRanking.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Full Product Ranking</h3>
            <MiniTable
              headers={[
                { label: '#' },
                { label: 'Product' },
                { label: 'Qty Sold', right: true },
                { label: 'Revenue', right: true },
                { label: 'Sales', right: true },
              ]}
              rows={products.productRanking.slice(0, 20).map((p, i) => ({
                cells: [
                  { value: i + 1, color: 'text-gray-500 font-bold' },
                  { value: p.name + (p.color ? ` (${p.color})` : '') + (p.size ? ` / ${p.size}` : ''), color: 'text-white truncate max-w-[150px]' },
                  { value: p.totalQty, color: 'text-white font-bold', right: true },
                  { value: formatCurrency(p.totalRevenue), color: 'text-emerald-400', right: true },
                  { value: `${p.saleCount}x`, color: 'text-gray-400', right: true },
                ]
              }))}
            />
          </div>
        )}
      </CollapsibleSection>

      {/* 4. Warehouse Inventory Analytics */}
      <CollapsibleSection icon={Package} title="Warehouse Inventory Analytics" color="bg-blue-500/10" badge={`${inventory.totalItems} items`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Package} label="Total Items" value={inventory.totalItems} color="bg-blue-500/10" />
          <KpiCard icon={Warehouse} label="Warehouse Stock" value={inventory.totalWarehouseStock.toLocaleString()} color="bg-amber-500/10" />
          <KpiCard icon={DollarSign} label="Inventory Value" value={formatCurrency(inventory.totalStockValue)} color="bg-emerald-500/10" />
          <KpiCard icon={PlusCircle} label="Newly Added (7d)" value={inventory.newlyAddedCount} color="bg-cyan-500/10" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={AlertTriangle} label="Low Stock (≤5)" value={inventory.lowStockCount} sub="Items needing reorder" onClick={() => navigate('/warehouse')} color="bg-orange-500/10" />
          <KpiCard icon={XCircle} label="Out of Stock" value={inventory.outOfStockCount} sub="Zero stock items" onClick={() => navigate('/warehouse')} color="bg-red-500/10" />
          <KpiCard icon={Store} label="Outlet Stock" value={inventory.totalOutletStock.toLocaleString()} color="bg-purple-500/10" />
        </div>
        {inventory.lowStockItems.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Low Stock Items
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {inventory.lowStockItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2.5 bg-orange-500/5 rounded-xl border border-orange-500/10">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    <p className="text-[9px] text-gray-500">{item.category}{item.color ? ` / ${item.color}` : ''}{item.size ? ` / ${item.size}` : ''}</p>
                  </div>
                  <span className="text-sm font-black text-orange-400 ml-2">{item.stock}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {inventory.newlyAddedItems.length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <PlusCircle size={12} /> Recently Added
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {inventory.newlyAddedItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    <p className="text-[9px] text-gray-500">{item.category} / Stock: {item.stock}</p>
                  </div>
                  <span className="text-[9px] text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* 5. Demand Management */}
      <CollapsibleSection icon={ShoppingBag} title="Demand Management" color="bg-orange-500/10" badge={`${demands.total} total`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={ListOrdered} label="Pending Demands" value={demands.pending}
            onClick={() => navigate('/warehouse')} color="bg-orange-500/10" sub="Awaiting store action" />
          <KpiCard icon={CheckCircle2} label="Approved" value={demands.approved} color="bg-emerald-500/10" />
          <KpiCard icon={XCircle} label="Rejected" value={demands.rejected} color="bg-red-500/10" />
          <KpiCard icon={ThumbsUp} label="Completed" value={demands.completed} color="bg-blue-500/10" />
        </div>
        <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Demand Status Summary</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-[10px] text-gray-400">Pending: <strong className="text-white">{demands.pending}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-400">Approved: <strong className="text-white">{demands.approved}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] text-gray-400">Rejected: <strong className="text-white">{demands.rejected}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] text-gray-400">Completed: <strong className="text-white">{demands.completed}</strong></span>
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden flex">
            {demands.total > 0 && (
              <>
                <div style={{ width: `${(demands.pending / demands.total) * 100}%` }} className="bg-orange-400 h-full transition-all" />
                <div style={{ width: `${(demands.approved / demands.total) * 100}%` }} className="bg-emerald-400 h-full transition-all" />
                <div style={{ width: `${(demands.rejected / demands.total) * 100}%` }} className="bg-red-400 h-full transition-all" />
                <div style={{ width: `${(demands.completed / demands.total) * 100}%` }} className="bg-blue-400 h-full transition-all" />
              </>
            )}
          </div>
        </div>
        <p className="text-[9px] text-gray-600 italic">
          Click the Pending count to view and manage demands in the Warehouse panel.
        </p>
      </CollapsibleSection>

      {/* 6. Allocation Analytics */}
      <CollapsibleSection icon={GitBranch} title="Allocation Analytics" color="bg-purple-500/10" badge={`${allocations.total} total`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={GitBranch} label="Total Allocations" value={allocations.total} color="bg-purple-500/10" />
          <KpiCard icon={Clock} label="Pending" value={allocations.pending} onClick={() => navigate('/warehouse')} color="bg-orange-500/10" />
          <KpiCard icon={CheckCircle2} label="Completed" value={allocations.completed} color="bg-emerald-500/10" />
        </div>
        {Object.keys(allocations.byPerson || {}).length > 0 && (
          <div>
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">By Person</h3>
            <MiniTable
              headers={[{ label: 'Person' }, { label: 'Allocations', right: true }]}
              rows={Object.entries(allocations.byPerson || {}).map(([person, info]) => ({
                cells: [
                  { value: person, color: 'text-white font-bold' },
                  { value: info.count, color: 'text-purple-400 font-bold', right: true },
                ]
              }))}
            />
          </div>
        )}
      </CollapsibleSection>

      {/* 7. Complete Store Analytics */}
      <CollapsibleSection icon={BarChart3} title="Complete Store Analytics" color="bg-amber-500/10" defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div onClick={() => navigate('/warehouse')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-blue-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-blue-500/10 w-fit mb-2"><Package size={16} className="text-blue-400" /></div>
            <p className="text-lg font-black text-white">{inventory.totalItems}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Inventory Items</p>
            <p className="text-[8px] text-gray-600 mt-0.5">Value: {formatCurrency(inventory.totalStockValue)}</p>
          </div>
          <div onClick={() => navigate('/warehouse-pos')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-emerald-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 w-fit mb-2"><ShoppingCart size={16} className="text-emerald-400" /></div>
            <p className="text-lg font-black text-white">{sales.totalSales}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">POS Sales</p>
            <p className="text-[8px] text-gray-600 mt-0.5">Revenue: {formatCurrency(sales.totalRevenue)}</p>
          </div>
          <div onClick={() => navigate('/warehouse')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-orange-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-orange-500/10 w-fit mb-2"><ShoppingBag size={16} className="text-orange-400" /></div>
            <p className="text-lg font-black text-white">{demands.total}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Demands</p>
            <p className="text-[8px] text-gray-600 mt-0.5">{demands.pending} pending, {demands.completed} completed</p>
          </div>
          <div onClick={() => navigate('/warehouse')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-purple-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-purple-500/10 w-fit mb-2"><GitBranch size={16} className="text-purple-400" /></div>
            <p className="text-lg font-black text-white">{allocations.total}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Allocations</p>
            <p className="text-[8px] text-gray-600 mt-0.5">{allocations.pending} pending</p>
          </div>
          <div onClick={() => navigate('/warehouse-pos')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-red-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-red-500/10 w-fit mb-2"><RotateCcw size={16} className="text-red-400" /></div>
            <p className="text-lg font-black text-white">{returns.totalReturns}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Returns</p>
            <p className="text-[8px] text-gray-600 mt-0.5">Rate: {returns.returnPercentage}%</p>
          </div>
          <div onClick={() => navigate('/tasks')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-amber-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-amber-500/10 w-fit mb-2"><Activity size={16} className="text-amber-400" /></div>
            <p className="text-lg font-black text-white">{tasks.unseenTasks + tasks.activeTasks}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Active Orders</p>
            <p className="text-[8px] text-gray-600 mt-0.5">{tasks.unseenTasks} unseen, {tasks.activeTasks} in progress</p>
          </div>
          <div onClick={() => navigate('/warehouse')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-cyan-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 w-fit mb-2"><TrendingUp size={16} className="text-cyan-400" /></div>
            <p className="text-lg font-black text-white">{products.totalSoldQty}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Units Sold</p>
            <p className="text-[8px] text-gray-600 mt-0.5">{products.totalProductsSold} unique products</p>
          </div>
          <div onClick={() => navigate('/warehouse-pos')} className="glass p-4 rounded-2xl border-2 border-gray-700/50 hover:border-pink-500/30 cursor-pointer transition-all">
            <div className="p-2.5 rounded-xl bg-pink-500/10 w-fit mb-2"><DollarSign size={16} className="text-pink-400" /></div>
            <p className="text-lg font-black text-white">{formatCurrency(sales.totalRevenue)}</p>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-[8px] text-gray-600 mt-0.5">{sales.totalSales} transactions</p>
          </div>
        </div>

        {/* Performance Summary Table */}
        <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
              <p className="text-lg font-black text-emerald-400">{formatCurrency(performance.salesPerDay)}</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Revenue / Day</p>
            </div>
            <div className="bg-blue-500/5 rounded-xl p-3 border border-blue-500/10">
              <p className="text-lg font-black text-blue-400">{formatCurrency(performance.avgOrderValue)}</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p>
            </div>
            <div className="bg-orange-500/5 rounded-xl p-3 border border-orange-500/10">
              <p className="text-lg font-black text-orange-400">{performance.returnRate}%</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Return Rate</p>
            </div>
            <div className="bg-purple-500/5 rounded-xl p-3 border border-purple-500/10">
              <p className="text-lg font-black text-purple-400">{performance.stockTurnoverRate}</p>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Stock Turnover</p>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default StoreDashboardPage;
