import React from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency, formatPaymentMethod } from '../utils/POSPrint';
import { formatDateTime, formatDateOnly } from '../utils/dateTime';
import { BarChart3, DollarSign, TrendingUp, Tag, RotateCcw, CheckCircle2, Clock, X, Award, CreditCard, Globe, ShoppingCart, Download, Calendar, RefreshCw, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const POSDashboard = () => {
  const { isUrdu } = useLanguage();
  const {
    dashboard, dashboardLoading, dashboardError, refreshDashboard,
    selectedOutlet, dashboardRange, setDashboardRange,
    dashboardDateFrom, setDashboardDateFrom, dashboardDateTo, setDashboardDateTo,
    invalidateKey, dashboardKey,
    balanceInvoices, balanceInvoicesLoading,
    handlePayBalanceOpen, handleViewBalanceHistory,
    balanceCollectionRange, setBalanceCollectionRange,
    balanceCollectionDateFrom, setBalanceCollectionDateFrom,
    balanceCollectionDateTo, setBalanceCollectionDateTo,
    balanceCollectionData, loadingBalanceAction,
    sales, downloadDashboardExcel, setTab
  } = usePOS();

  const kpis = dashboard ? [
    { label: 'Total Sales', value: formatCurrency(dashboard.totalSales), sub: `${dashboard.totalOrders} orders`, color: 'from-blue-600 to-indigo-600', icon: DollarSign },
    { label: 'Net Revenue', value: formatCurrency(dashboard.netRevenue), sub: `Refunds: ${formatCurrency(dashboard.totalSales - dashboard.netRevenue)}`, color: 'from-emerald-600 to-teal-600', icon: TrendingUp },
    { label: 'Total Discount', value: formatCurrency(dashboard.totalDiscount), sub: 'Discounts given', color: 'from-amber-600 to-orange-600', icon: Tag },
    { label: 'Returned Orders', value: dashboard.returnedOrders, sub: 'Items returned', color: 'from-red-600 to-rose-600', icon: RotateCcw },
    { label: 'Completed Orders', value: dashboard.completedOrders, sub: 'POS + Standard Completed', color: 'from-purple-600 to-violet-600', icon: CheckCircle2 },
    { label: 'Pending Orders', value: dashboard.pendingOrders, sub: 'Awaiting production/dispatch', color: 'from-cyan-600 to-blue-600', icon: Clock },
    { label: 'Cancelled Orders', value: dashboard.cancelledOrders, sub: 'Rejected / Cancelled', color: 'from-gray-600 to-slate-600', icon: X },
  ] : [];

  const datePresets = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
    { label: 'This Year', value: 'year' },
    { label: 'Custom Range', value: 'custom' }
  ];

  return (
    <>
    <div className="space-y-6 pb-20 px-4 overflow-y-auto h-full pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-500" />
            Sales & Performance Dashboard
          </h1>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">
            Outlet: {selectedOutlet}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadDashboardExcel} className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1.5"><Download size={14} />Excel</button>
          <button onClick={() => setTab('pos')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5">
            <ShoppingCart size={14} />
            Back to POS Register
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-gray-500 uppercase tracking-wider mr-2">Select Range:</span>
          {datePresets.map(preset => (
            <button
              key={preset.value}
              onClick={() => {
                setDashboardRange(preset.value);
                if (preset.value !== 'custom') {
                  setDashboardDateFrom('');
                  setDashboardDateTo('');
                }
              }}
              className={`text-[10px] font-black px-3.5 py-2 rounded-xl border transition-all ${
                dashboardRange === preset.value
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {dashboardRange === 'custom' && (
          <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800 w-fit">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={14} />
              <span>From:</span>
            </div>
            <input
              type="date"
              value={dashboardDateFrom}
              onChange={e => setDashboardDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-500 font-bold">&rarr;</span>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={14} />
              <span>To:</span>
            </div>
            <input
              type="date"
              value={dashboardDateTo}
              onChange={e => setDashboardDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
            />
            <button
              onClick={() => {
                invalidateKey(dashboardKey);
                refreshDashboard();
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Dashboard statistics */}
      {dashboardLoading ? (
        <div className="py-20 flex justify-center items-center">
          <RefreshCw className="animate-spin text-blue-500" size={32} />
        </div>
      ) : dashboardError ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-red-400 font-black text-sm mb-2">Failed to load dashboard</p>
          <p className="text-gray-500 text-xs mb-4 max-w-md">{dashboardError.message}</p>
          <button onClick={refreshDashboard} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-xs">
            Retry
          </button>
        </div>
      ) : dashboard ? (
        <div className="space-y-6">
          {/* KPIs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className={`bg-gradient-to-br ${kpi.color} p-[1px] rounded-2xl shadow-lg`}>
                  <div className="bg-gray-950/90 rounded-2xl p-4 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                      <Icon size={14} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xl md:text-2xl font-black text-white">{kpi.value}</p>
                      <p className="text-[10px] text-gray-500 font-bold mt-1">{kpi.sub}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Balance Collection Card */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-[1px] rounded-2xl shadow-lg">
            <div className="bg-gray-950/90 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                  <DollarSign size={14} className="text-violet-400" />
                  Balance Collections
                </h3>
                <div className="flex gap-1">
                  {['today', 'yesterday', 'month', 'custom'].map(r => (
                    <button key={r} onClick={() => setBalanceCollectionRange(r)}
                      className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-all ${balanceCollectionRange === r ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                      {r === 'today' ? 'Today' : r === 'yesterday' ? 'Yest' : r === 'month' ? 'Month' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {balanceCollectionRange === 'custom' && (
                <div className="flex items-center gap-2 mb-3">
                  <input type="date" value={balanceCollectionDateFrom}
                    onChange={e => setBalanceCollectionDateFrom(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] text-white flex-1" />
                  <span className="text-gray-500 text-[9px]">to</span>
                  <input type="date" value={balanceCollectionDateTo}
                    onChange={e => setBalanceCollectionDateTo(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] text-white flex-1" />
                </div>
              )}
              {balanceCollectionData ? (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-white">{formatCurrency(balanceCollectionData.totalCollected)}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-1">{balanceCollectionData.count} payment{balanceCollectionData.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">Collected on:</p>
                    <p className="text-xs font-bold text-violet-400">
                      {balanceCollectionRange === 'today' ? 'Today' :
                       balanceCollectionRange === 'yesterday' ? 'Yesterday' :
                       balanceCollectionRange === 'month' ? 'This Month' : 'Custom'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center">
                  <RefreshCw className="animate-spin text-gray-600" size={20} />
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Breakdown — always show all 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['CASH', 'CARD', 'ONLINE'].map(method => {
              const pm = dashboard.paymentBreakdown?.find(p => p.method === method) || { method, gross: 0, returns: 0, net: 0 };
              const icons = { CASH: DollarSign, ONLINE: Globe, CARD: CreditCard };
              const colors = { CASH: 'from-emerald-600 to-green-600', ONLINE: 'from-blue-600 to-indigo-600', CARD: 'from-purple-600 to-violet-600' };
              const bgColors = { CASH: 'text-emerald-400', ONLINE: 'text-blue-400', CARD: 'text-purple-400' };
              const Icon = icons[pm.method] || DollarSign;
              return (
                <div key={pm.method} className={`bg-gradient-to-br ${colors[pm.method] || 'from-gray-600 to-slate-600'} p-[1px] rounded-2xl shadow-lg`}>
                  <div className="bg-gray-950/90 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Icon size={14} className={bgColors[pm.method] || 'text-gray-400'} />
                        {pm.method}
                      </span>
                    </div>
                    <p className="text-lg font-black text-white">{formatCurrency(pm.net)}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                      <span className="text-emerald-400 font-bold">Gross: {formatCurrency(pm.gross)}</span>
                      {pm.returns > 0 && (
                        <span className="text-red-400 font-bold">Returns: -{formatCurrency(pm.returns)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Peak day & comparisons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Award size={14} className="text-amber-500" />
                  Highest Sales Day
                </h3>
                <p className="text-xl font-black text-white">{formatCurrency(dashboard.highestSalesDay?.amount || 0)}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestSalesDay?.date || 'N/A'}</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Award size={14} className="text-blue-500" />
                  Highest Orders Day
                </h3>
                <p className="text-xl font-black text-white">{dashboard.highestOrdersDay?.count || 0} Orders</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestOrdersDay?.date || 'N/A'}</p>
              </div>
            </div>

            {/* Best branch performance comparison (if viewing 'all' admin mode) */}
            {dashboard.branchPerformance && dashboard.branchPerformance.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Branch Comparison</h3>
                <div className="space-y-2">
                  {dashboard.branchPerformance.map((bp, idx) => (
                    <div key={bp.branch} className="flex items-center justify-between text-xs border-b border-gray-800 pb-1.5">
                      <span className="font-bold text-gray-300">{idx + 1}. {bp.branch}</span>
                      <span className="font-black text-emerald-400">{formatCurrency(bp.revenue)} ({bp.orders} ord)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sales Chart */}
          {dashboard.reportData && dashboard.reportData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Sales Trend</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.reportData}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `\u20a6${(v/1000)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }} formatter={(v) => formatCurrency(v)} labelStyle={{ color: '#fff', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Best Selling Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Top Selling Products</h3>
              <div className="space-y-2">
                {dashboard.bestSellingProducts && dashboard.bestSellingProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                    <span className="font-black text-white">{p.name}</span>
                    <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">{p.qty} sold</span>
                  </div>
                ))}
                {(!dashboard.bestSellingProducts || dashboard.bestSellingProducts.length === 0) && (
                  <p className="text-center text-gray-500 py-4 font-bold">No product sales data in range</p>
                )}
              </div>
            </div>

            {/* Remaining Balance — unpaid/partially-paid invoices */}
            <div className="bg-gray-900 border border-amber-800/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard size={14} />
                  Remaining Balance
                </h3>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">{balanceInvoices.length} invoice{balanceInvoices.length !== 1 ? 's' : ''}</span>
              </div>
              {balanceInvoicesLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="animate-spin text-gray-500" size={20} />
                </div>
              ) : balanceInvoices.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {balanceInvoices.map(inv => (
                  <div key={inv.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black text-white">{inv.receiptNumber}</p>
                        <p className="text-[10px] text-gray-500">{inv.customerName || 'No name'} &bull; {formatPaymentMethod(inv.paymentMethod)}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="font-black text-amber-400">Due: {formatCurrency(inv.remaining)}</p>
                        <p className="text-[9px] text-gray-500">Total: {formatCurrency(inv.grandTotal)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => handlePayBalanceOpen(inv)} disabled={loadingBalanceAction}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-1.5 rounded-lg text-[10px] transition-all">
                        {loadingBalanceAction ? 'Loading...' : `Pay Remaining \u20a6${inv.remaining.toLocaleString()}`}
                      </button>
                      <button onClick={() => handleViewBalanceHistory(inv)} disabled={loadingBalanceAction}
                        className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 rounded-lg text-[10px] transition-all">
                        {loadingBalanceAction ? 'Loading...' : 'History'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              ) : (
                <p className="text-center text-gray-500 font-bold py-4 text-xs">No outstanding balances</p>
              )}
            </div>

            {/* Faisal Takes — products taken by Faisal (not sales) */}
            <div className="bg-gray-900 border border-amber-800/50 rounded-2xl p-4">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Package size={14} />
                Faisal Takes
              </h3>
              {dashboard.faisalTakes && dashboard.faisalTakes.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {dashboard.faisalTakes.map(ft => (
                  <div key={ft.id} className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-amber-300">{ft.cashierName || 'Faisal'}</p>
                      <p className="text-[9px] text-gray-500">{formatDateTime(ft.faisalTakenAt || ft.createdAt)}</p>
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {ft.items && ft.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{item.productName} {item.size ? `(${item.size})` : ''} {item.color ? `[${isUrdu ? toUrduName(item.color) : item.color}]` : ''}</span>
                          <span className="font-bold text-white">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              ) : (
                <p className="text-center text-gray-500 font-bold py-4 text-xs">No Faisal Take records in this range</p>
              )}
            </div>

          {/* Recent Sales list */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales Transactions</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sales.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                    <div>
                      <p className="font-black text-white">{s.receiptNumber} {s.orderId && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded-full ml-1">ORD</span>}</p>
                      <p className="text-[10px] text-gray-500">{formatDateOnly(s.createdAt)} &bull; {s.items?.length || 0} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-400">{formatCurrency(s.grandTotal)}</p>
                      <p className="text-[10px] text-gray-500">{formatPaymentMethod(s.paymentMethod)}</p>
                    </div>
                  </div>
                ))}
                {sales.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No recent sales</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </>
  );
};

export default POSDashboard;
