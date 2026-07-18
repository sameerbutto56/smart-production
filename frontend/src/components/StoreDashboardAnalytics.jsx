import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  BarChart3, DollarSign, Package, ShoppingCart, RotateCcw, AlertTriangle,
  TrendingUp, TrendingDown, Clock, RefreshCw, Search, Eye, AlertCircle,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, FileText, Timer,
  Factory, Store, Users, CreditCard, Activity, Zap, Target,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="glass p-4 md:p-5 rounded-2xl border-2 border-gray-700/50 hover:border-amber-500/30 transition-all">
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

const SectionTitle = ({ icon: Icon, title, color }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className={`p-2 rounded-lg ${color || 'bg-amber-500/10'}`}>
      <Icon size={16} className={color ? 'text-white' : 'text-amber-400'} />
    </div>
    <h2 className="text-sm font-black text-white uppercase tracking-wider">{title}</h2>
  </div>
);

const StoreDashboardAnalytics = () => {
  const [, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [range, setRange] = useState('monthly');
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    sales: true, inventory: true, tasks: true, invoices: false,
    products: true, returns: true, delays: true, performance: true
  });

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const fetchData = async (r, s) => {
    setLoading(true);
    try {
      const res = await api.get('/api/store-dashboard', { params: { range: r || range, search: s || '' } });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load dashboard analytics');
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData();
    setRefreshKey(k => k + 1);
  };

  // Search debounce
  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => fetchData(range, search), 400);
      return () => clearTimeout(timer);
    }
  }, [search]);

  const handleRangeChange = (r) => {
    setRange(r);
    fetchData(r, search);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="animate-spin text-amber-400" size={32} />
        <span className="ml-3 text-gray-400 text-sm font-bold">Loading analytics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-gray-500">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
        <p className="text-sm font-bold">Failed to load analytics</p>
        <button onClick={handleRefresh} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold">Retry</button>
      </div>
    );
  }

  const { sales, inventory, tasks, invoiceTracking, products, returns, delays, performance } = data;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
          {['daily', 'weekly', 'monthly', 'yearly'].map(r => (
            <button key={r} onClick={() => handleRangeChange(r)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${range === r ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-white'}`}>
              {r === 'daily' ? 'Today' : r === 'weekly' ? '7 Days' : r === 'monthly' ? '30 Days' : 'Year'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search invoices or orders..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-amber-500" />
        </div>
        <button onClick={handleRefresh} className="px-3 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white border border-gray-700 text-xs">
          <RefreshCw size={14} className="inline mr-1" /> Refresh
        </button>
      </div>

      {/* 1. Sales Analytics */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('sales')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={DollarSign} title="Sales Analytics" color="bg-emerald-500/10" />
          {expandedSections.sales ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.sales && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={ShoppingCart} label="Total Sales" value={sales.totalSales} color="bg-blue-500/10" />
              <StatCard icon={DollarSign} label="Total Revenue" value={formatCurrency(sales.totalRevenue)} color="bg-emerald-500/10" />
              <StatCard icon={FileText} label="Total Orders" value={sales.totalOrders} color="bg-purple-500/10" />
              <StatCard icon={RotateCcw} label="Total Returns" value={sales.totalReturns} color="bg-red-500/10" />
            </div>
            {sales.salesTrend.length > 0 && (
              <div className="mt-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Sales Trend</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4 text-right">Sales</th>
                        <th className="pb-2 pr-4 text-right">Revenue</th>
                        <th className="pb-2 text-right">Returns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.salesTrend.slice(0, 31).map(d => (
                        <tr key={d.date} className="border-b border-gray-800/30">
                          <td className="py-1.5 pr-4 text-gray-400">{d.date}</td>
                          <td className="py-1.5 pr-4 text-right text-white font-bold">{d.count}</td>
                          <td className="py-1.5 pr-4 text-right text-emerald-400">{formatCurrency(d.revenue)}</td>
                          <td className="py-1.5 text-right text-red-400">{d.returns}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Inventory Analytics */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('inventory')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={Package} title="Inventory Analytics" color="bg-blue-500/10" />
          {expandedSections.inventory ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.inventory && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Package} label="Total Inventory Items" value={inventory.totalItems} color="bg-blue-500/10" />
              <StatCard icon={Store} label="Warehouse Stock" value={inventory.totalWarehouseStock.toLocaleString()} color="bg-amber-500/10" />
              <StatCard icon={Building2} label="Outlet Stock" value={inventory.totalOutletStock.toLocaleString()} color="bg-purple-500/10" />
              <StatCard icon={DollarSign} label="Stock Value" value={formatCurrency(inventory.totalStockValue)} color="bg-emerald-500/10" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={AlertTriangle} label="Low Stock Items" value={inventory.lowStockCount} sub="Stock ≤ 5" color="bg-orange-500/10" />
              <StatCard icon={XCircle} label="Out of Stock" value={inventory.outOfStockCount} sub="Zero stock items" color="bg-red-500/10" />
            </div>
            {inventory.lowStockItems.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Low Stock Items
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {inventory.lowStockItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 bg-orange-500/5 rounded-xl border border-orange-500/10">
                      <div>
                        <p className="text-xs font-bold text-white">{item.name}</p>
                        <p className="text-[9px] text-gray-500">{item.category}{item.color ? ` / ${item.color}` : ''}{item.size ? ` / ${item.size}` : ''}</p>
                      </div>
                      <span className="text-sm font-black text-orange-400">{item.stock}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Store Task Overview */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('tasks')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={CheckCircle2} title="Store Task Overview" color="bg-amber-500/10" />
          {expandedSections.tasks ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.tasks && (
          <div className="px-4 md:px-5 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Eye} label="Unseen Tasks" value={tasks.unseenTasks} color="bg-blue-500/10" sub="Pending STORE stages" />
              <StatCard icon={CheckCircle2} label="Seen Tasks" value={tasks.seenTasks} color="bg-purple-500/10" sub="Viewed by employees" />
              <StatCard icon={Activity} label="Active Tasks" value={tasks.activeTasks} color="bg-green-500/10" sub="In Progress" />
              <StatCard icon={Factory} label="From Production" value={tasks.ordersInStore} color="bg-amber-500/10" sub="Orders in STORE stage" />
            </div>
          </div>
        )}
      </div>

      {/* 4. Invoice & Order Tracking */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('invoices')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={FileText} title="Invoices & Orders" color="bg-purple-500/10" />
          {expandedSections.invoices ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.invoices && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={FileText} label="Warehouse Invoices" value={invoiceTracking.totalInvoices} color="bg-blue-500/10" />
              <StatCard icon={ShoppingCart} label="Production Orders" value={invoiceTracking.totalOrders} color="bg-amber-500/10" />
            </div>
            {invoiceTracking.invoices.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Recent Invoices</h3>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                        <th className="pb-2 pr-3">Receipt</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3 text-right">Amount</th>
                        <th className="pb-2 pr-3">Method</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceTracking.invoices.slice(0, 50).map(inv => (
                        <tr key={inv.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                          <td className="py-1.5 pr-3 text-white font-bold">{inv.receiptNumber}</td>
                          <td className="py-1.5 pr-3 text-gray-400 truncate max-w-[120px]">{inv.customerName || '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-emerald-400 font-bold">{formatCurrency(inv.grandTotal)}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              inv.paymentMethod === 'CASH' ? 'bg-emerald-900/50 text-emerald-400' :
                              inv.paymentMethod === 'CARD' ? 'bg-purple-900/50 text-purple-400' :
                              inv.paymentMethod === 'ONLINE' ? 'bg-blue-900/50 text-blue-400' :
                              'bg-amber-900/50 text-amber-400'
                            }`}>{inv.paymentMethod}</span>
                          </td>
                          <td className="py-1.5 text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {invoiceTracking.orders.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 mt-3">Production Orders</h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                        <th className="pb-2 pr-3">Order #</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Stage</th>
                        <th className="pb-2 pr-3">Status</th>
                        <th className="pb-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceTracking.orders.map(o => (
                        <tr key={o.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                          <td className="py-1.5 pr-3 text-white font-bold">{o.orderNumber || 'N/A'}</td>
                          <td className="py-1.5 pr-3 text-gray-400 truncate max-w-[120px]">{o.customerName}</td>
                          <td className="py-1.5 pr-3">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-700 text-gray-300">{o.currentStage}</span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              o.status === 'COMPLETED' ? 'bg-emerald-900/50 text-emerald-400' :
                              o.status === 'PENDING' ? 'bg-amber-900/50 text-amber-400' :
                              'bg-blue-900/50 text-blue-400'
                            }`}>{o.status}</span>
                          </td>
                          <td className="py-1.5 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Product Analytics */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('products')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={Target} title="Product Analytics" color="bg-cyan-500/10" />
          {expandedSections.products ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.products && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Best selling */}
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
                </div>
              </div>
              {/* Lowest selling */}
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
                </div>
              </div>
              {/* Most returned */}
              <div className="bg-orange-500/5 rounded-2xl border border-orange-500/10 p-3">
                <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <RotateCcw size={12} /> Most Returned
                </h3>
                <div className="space-y-2">
                  {products.mostReturned.length === 0 && (
                    <p className="text-[10px] text-gray-500">No returns recorded</p>
                  )}
                  {products.mostReturned.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px] text-white truncate">{p.name}</span>
                      <span className="text-[10px] font-bold text-orange-400 ml-2">{p.qty} returns</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Full ranking */}
            <div>
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Product Sales Ranking</h3>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Product</th>
                      <th className="pb-2 pr-3 text-right">Qty Sold</th>
                      <th className="pb-2 pr-3 text-right">Revenue</th>
                      <th className="pb-2 text-right">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.productRanking.map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                        <td className="py-1 pr-3 text-gray-500 font-bold">{i + 1}</td>
                        <td className="py-1 pr-3 text-white truncate max-w-[150px]">{p.name}{p.color ? ` (${p.color})` : ''}{p.size ? ` / ${p.size}` : ''}</td>
                        <td className="py-1 pr-3 text-right text-white font-bold">{p.totalQty}</td>
                        <td className="py-1 pr-3 text-right text-emerald-400">{formatCurrency(p.totalRevenue)}</td>
                        <td className="py-1 text-right text-gray-400">{p.saleCount}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Return Analytics */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('returns')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={RotateCcw} title="Return Analytics" color="bg-red-500/10" />
          {expandedSections.returns ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.returns && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard icon={RotateCcw} label="Total Returns" value={returns.totalReturns} color="bg-red-500/10" />
              <StatCard icon={BarChart3} label="Return Rate" value={`${returns.returnPercentage}%`} color="bg-orange-500/10" />
            </div>
            {returns.recentReturns.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Recent Returns</h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Reason</th>
                        <th className="pb-2 pr-3 text-right">Qty</th>
                        <th className="pb-2 pr-3">Refund Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.recentReturns.map(r => (
                        <tr key={r.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                          <td className="py-1.5 pr-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="py-1.5 pr-3 text-gray-400 truncate max-w-[150px]">{r.reason || 'N/A'}</td>
                          <td className="py-1.5 pr-3 text-right text-white font-bold">{r.quantity}</td>
                          <td className="py-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-700 text-gray-300">{r.refundPaymentMethod}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Delay Monitoring */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('delays')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={Timer} title="Delay Monitoring" color="bg-red-500/10" />
          {expandedSections.delays ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.delays && (
          <div className="px-4 md:px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={AlertCircle} label="Total Delayed" value={delays.totalDelayed} color="bg-red-500/10" />
              <StatCard icon={Store} label="Delayed in Store" value={delays.delayedInStore} color="bg-orange-500/10" />
              <StatCard icon={Factory} label="Delayed in Production" value={delays.delayedInProduction} color="bg-yellow-500/10" />
              <StatCard icon={AlertTriangle} label="In Other Stages" value={delays.delayedInOther} color="bg-gray-500/10" />
            </div>
            {delays.urgentOrders.length > 0 && (
              <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-3">
                <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Zap size={12} /> Urgent — Over 48 Hours Delayed
                </h3>
                <div className="space-y-2">
                  {delays.urgentOrders.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg border border-red-500/10">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-white">{d.orderNumber}</span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                            d.delayedStage === 'STORE' ? 'bg-orange-900/50 text-orange-400' :
                            d.delayedStage === 'PRODUCTION' ? 'bg-yellow-900/50 text-yellow-400' :
                            'bg-gray-700 text-gray-300'
                          }`}>{d.delayedStage}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-0.5">{d.customerName}</p>
                      </div>
                      <span className="text-[10px] font-bold text-red-400 ml-2 whitespace-nowrap">
                        {d.delayDurationHours >= 24
                          ? `${Math.floor(d.delayDurationHours / 24)}d ${d.delayDurationHours % 24}h`
                          : `${d.delayDurationHours}h`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {delays.delayedOrders.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">All Delayed Orders</h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[10px]">
                    <thead className="sticky top-0 bg-gray-900">
                      <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-gray-700/50">
                        <th className="pb-2 pr-3">Order</th>
                        <th className="pb-2 pr-3">Customer</th>
                        <th className="pb-2 pr-3">Stage</th>
                        <th className="pb-2 pr-3 text-right">Duration</th>
                        <th className="pb-2">Deadline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delays.delayedOrders.map(d => (
                        <tr key={d.orderId} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                          <td className="py-1.5 pr-3 text-white font-bold">{d.orderNumber}</td>
                          <td className="py-1.5 pr-3 text-gray-400 truncate max-w-[100px]">{d.customerName}</td>
                          <td className="py-1.5 pr-3">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-700 text-gray-300">{d.delayedStage}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-right">
                            <span className="text-[10px] font-bold text-red-400">
                              {d.delayDurationHours >= 24
                                ? `${Math.floor(d.delayDurationHours / 24)}d ${d.delayDurationHours % 24}h`
                                : `${d.delayDurationHours}h`}
                            </span>
                          </td>
                          <td className="py-1.5 text-gray-500">{new Date(d.deadlineAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {delays.delayedOrders.length === 0 && (
              <p className="text-center text-gray-500 text-xs py-4">
                <CheckCircle2 size={16} className="inline mr-1 text-emerald-400" /> No delayed orders
              </p>
            )}
          </div>
        )}
      </div>

      {/* 8. Performance Summary */}
      <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
        <button onClick={() => toggleSection('performance')} className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-gray-800/30 transition-colors">
          <SectionTitle icon={Activity} title="Performance Metrics" color="bg-emerald-500/10" />
          {expandedSections.performance ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </button>
        {expandedSections.performance && (
          <div className="px-4 md:px-5 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={DollarSign} label="Revenue/Day" value={formatCurrency(performance.salesPerDay)} color="bg-emerald-500/10" />
              <StatCard icon={ShoppingCart} label="Avg Order Value" value={formatCurrency(performance.avgOrderValue)} color="bg-blue-500/10" />
              <StatCard icon={RotateCcw} label="Return Rate" value={`${performance.returnRate}%`} color="bg-orange-500/10" />
              <StatCard icon={RefreshCw} label="Stock Turnover" value={performance.stockTurnoverRate} color="bg-purple-500/10" sub="Sold / Total Stock" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDashboardAnalytics;
