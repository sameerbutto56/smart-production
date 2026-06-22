import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart3, TrendingUp, DollarSign, RefreshCcw, ChevronRight, X, Search,
  ShoppingCart, CheckCircle2, RotateCcw, Clock, Filter, Calendar,
  CreditCard, Banknote, Landmark, AlertTriangle, ArrowLeft, Eye, FileText
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { PageLoader } from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || '';
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const fmt = (v) => `₨${(v || 0).toLocaleString()}`;

const DATE_PRESETS = [
  { label: 'All Time', days: -2 }, { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 },
  { label: 'This Week', days: 7 }, { label: 'This Month', days: 30 },
  { label: 'Last 3 Months', days: 90 }, { label: 'Custom', days: -1 }
];

const SOURCE_TABS = [
  { id: 'all', label: 'All Sources', icon: BarChart3 },
  { id: 'online', label: 'Online Orders', icon: ShoppingCart },
  { id: 'jail_road', label: 'Jail Road', icon: Landmark },
  { id: 'johar_town', label: 'Johar Town', icon: Landmark },
  { id: 'abbottabad', label: 'Abbottabad', icon: Landmark }
];

const StageBadge = React.memo(({ stage }) => {
  const colors = {
    ORDER_ENTRY: 'bg-blue-500/20 text-blue-400',
    STORE: 'bg-purple-500/20 text-purple-400',
    LOGO_DESIGN: 'bg-pink-500/20 text-pink-400',
    PRODUCTION_ACCEPTANCE: 'bg-amber-500/20 text-amber-400',
    PRODUCTION: 'bg-orange-500/20 text-orange-400',
    STORE_RECEIVE: 'bg-teal-500/20 text-teal-400',
    DISPATCH: 'bg-cyan-500/20 text-cyan-400',
    OUT_FOR_DELIVERY: 'bg-emerald-500/20 text-emerald-400'
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${colors[stage] || 'bg-gray-500/20 text-gray-400'}`}>
      {stage.replace(/_/g, ' ')}
    </span>
  );
});

const KpiCard = React.memo(({ label, value, sub, color, icon: Icon, onClick, active }) => (
  <button onClick={onClick} className={`relative overflow-hidden bg-gradient-to-br ${color} p-[1px] rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg ${active ? 'ring-2 ring-white/30 scale-[1.02]' : ''}`}>
    <div className="bg-gray-950/90 backdrop-blur-sm rounded-2xl p-4 h-full flex flex-col items-start text-left">
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
        <Icon size={14} className="text-gray-500" />
      </div>
      <span className="text-xl md:text-2xl font-black text-white">{value}</span>
      {sub && <span className="text-xs text-gray-500 mt-1">{sub}</span>}
    </div>
  </button>
));

const OrderListModal = React.memo(({ title, orders, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
        <button onClick={onClose} className="p-1.5 bg-gray-800 rounded-xl hover:bg-gray-700"><X size={14} /></button>
      </div>
      <div className="overflow-y-auto max-h-[65vh] p-4 space-y-2">
        {orders.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm font-bold">No orders found</p>
        ) : orders.map((o, i) => (
          <div key={o.id || i} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-black text-white">#{o.orderNumber}</span>
              <span className="text-gray-300 truncate max-w-[180px]">{o.customerName}</span>
              <span className="text-gray-500">{o.city || '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-emerald-400">{fmt(o.totalPrice)}</span>
              <span className="text-gray-500">{o.paymentMethod || '—'}</span>
              <StageBadge stage={o.currentStage} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
));

const DrillDetail = React.memo(({ title, items, onBack, onViewOrders }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <button onClick={onBack} className="p-1.5 bg-gray-800 rounded-xl hover:bg-gray-700"><ArrowLeft size={12} /></button>
      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{title}</h3>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {items.map((item, i) => (
        <div key={i} className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/50">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
          <p className="text-sm font-black text-white">{item.value}</p>
          {item.sub && <p className="text-[10px] text-gray-500 mt-0.5">{item.sub}</p>}
          {item.onViewOrders && (
            <button onClick={item.onViewOrders} className="mt-2 flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300">
              <Eye size={10} /> View Orders
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
));

const UnifiedAnalytics = () => {
  const [source, setSource] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('-2');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('all');
  const [drillView, setDrillView] = useState(null); // 'delivered' | 'returns' | 'pending'
  const [subDrill, setSubDrill] = useState(null); // 'delivered-cod' | etc
  const [orderList, setOrderList] = useState(null);
  const [orderListTitle, setOrderListTitle] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const getDateRange = useCallback(() => {
    const d = parseInt(datePreset);
    if (d === -2) return {};
    if (d === -1) return { startDate: customStart, endDate: customEnd };
    if (d === 0) {
      const t = new Date(); return { startDate: t.toISOString().split('T')[0], endDate: t.toISOString().split('T')[0] };
    }
    if (d === 1) {
      const t = new Date(); t.setDate(t.getDate() - 1);
      return { startDate: t.toISOString().split('T')[0], endDate: t.toISOString().split('T')[0] };
    }
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - d);
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
  }, [datePreset, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr });
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cityFilter) params.set('city', cityFilter);
      if (deliveryStatus !== 'all') params.set('deliveryStatus', deliveryStatus);
      const res = await axios.get(`${API_URL}/api/analytics/source/${source}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [source, datePreset, customStart, customEnd, paymentMethod, statusFilter, cityFilter, deliveryStatus, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchOrders = async (type, label) => {
    try {
      const token = sessionStorage.getItem('token');
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, type, limit: '100' });
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cityFilter) params.set('city', cityFilter);
      const res = await axios.get(`${API_URL}/api/analytics/source/${source}/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrderList(res.data);
      setOrderListTitle(label);
    } catch { setOrderList([]); setOrderListTitle(label); }
  };

  const s = data?.summary || {};
  const db = data?.deliveredBreakdown || {};
  const ra = data?.returnsAnalytics || {};
  const pa = data?.pendingAnalytics || {};
  const fin = useMemo(() => data?.financials || {}, [data?.financials]);
  const trends = useMemo(() => data?.trends?.monthly || [], [data?.trends?.monthly]);
  const totalVal = s.totalOrders || 0;
  const deliveredVal = s.deliveredOrders || 0;
  const returnedVal = s.returnedOrders || 0;
  const pendingVal = s.pendingOrders || 0;

  const handleSourceClick = (id) => {
    setSource(id);
    setDrillView(null);
    setSubDrill(null);
    setOrderList(null);
  };

  const renderSourceTabs = () => (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {SOURCE_TABS.map(t => (
        <button key={t.id} onClick={() => handleSourceClick(t.id)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
            source === t.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
          }`}
        >
          <t.icon size={12} /> {t.label}
        </button>
      ))}
    </div>
  );

  const renderFilters = () => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map(p => (
          <button key={p.days} onClick={() => setDatePreset(String(p.days))}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
              datePreset === String(p.days) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >{p.label}</button>
        ))}
        <button onClick={() => setShowFilters(!showFilters)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
            showFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        ><Filter size={10} /> More</button>
      </div>
      {datePreset === '-1' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-xs font-bold" />
          <span className="text-gray-500">→</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-xs font-bold" />
        </div>
      )}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-gray-900/80 rounded-xl border border-gray-800">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold">
            <option value="all">All Payments</option>
            <option value="CASH">Cash</option>
            <option value="ONLINE">Online</option>
            <option value="HALF_CASH_HALF_ONLINE">Half & Half</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold">
            <option value="all">All Delivery</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
          </select>
          <div className="flex items-center gap-1">
            <Search size={10} className="text-gray-500" />
            <input type="text" placeholder="City..." value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold w-24" />
          </div>
        </div>
      )}
    </div>
  );

  const renderSummaryCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <KpiCard label="Total Orders" value={totalVal.toLocaleString()} sub={`${source === 'all' ? 'All Sources' : SOURCE_TABS.find(t => t.id === source)?.label}`} color="from-blue-600 to-indigo-600" icon={BarChart3}
        onClick={() => { setDrillView(null); setSubDrill(null); }} active={!drillView} />
      <KpiCard label="Delivered" value={deliveredVal.toLocaleString()} sub={`${totalVal ? Math.round(deliveredVal / totalVal * 100) : 0}% delivery rate`} color="from-emerald-600 to-teal-600" icon={CheckCircle2}
        onClick={() => { setDrillView('delivered'); setSubDrill(null); setOrderList(null); }} active={drillView === 'delivered' && !subDrill} />
      <KpiCard label="Returned" value={returnedVal.toLocaleString()} sub={`${totalVal ? Math.round(returnedVal / totalVal * 100) : 0}% return rate`} color="from-rose-600 to-red-600" icon={RotateCcw}
        onClick={() => { setDrillView('returns'); setSubDrill(null); setOrderList(null); }} active={drillView === 'returns' && !subDrill} />
      <KpiCard label="Pending" value={pendingVal.toLocaleString()} sub={`Value: ${fmt(pa.totalValue)}`} color="from-amber-600 to-orange-600" icon={Clock}
        onClick={() => { setDrillView('pending'); setSubDrill(null); setOrderList(null); }} active={drillView === 'pending' && !subDrill} />
    </div>
  );

  const renderDeliveredDrill = () => (
    <DrillDetail title="Delivered Orders Breakdown" onBack={() => { setDrillView(null); setSubDrill(null); }}
      items={[
        { label: 'Cash on Delivery', value: `${db.cod.count} orders`, sub: `Amount: ${fmt(db.cod.amount)}`, onViewOrders: () => fetchOrders('delivered-cod', 'COD Delivered Orders') },
        { label: 'Online Payment', value: `${db.online.count} orders`, sub: `Amount: ${fmt(db.online.amount)}`, onViewOrders: () => fetchOrders('delivered-online', 'Online Payment Orders') },
        { label: 'Prepaid Orders', value: `${db.prepaid.count} orders`, sub: `Revenue: ${fmt(db.prepaid.amount)}`, onViewOrders: () => fetchOrders('delivered-prepaid', 'Prepaid Orders') }
      ]}
    />
  );

  const renderReturnsDrill = () => (
    <DrillDetail title="Return Analytics" onBack={() => { setDrillView(null); setSubDrill(null); }}
      items={[
        { label: 'Returned Paid Orders', value: `${ra.paidReturns.count} orders`, sub: `Refunded: ${fmt(ra.paidReturns.refundAmount)}\nCompleted: ${ra.paidReturns.completedRefunds} | Pending: ${ra.paidReturns.pendingRefunds}`, onViewOrders: () => fetchOrders('returned-paid', 'Returned Paid Orders') },
        { label: 'Returned COD Orders', value: `${ra.codReturns.count} orders`, sub: `Impact: ${fmt(ra.codReturns.amountImpact)}`, onViewOrders: () => fetchOrders('returned-cod', 'Returned COD Orders') },
        { label: 'Financial Impact', value: fmt(ra.financialImpact.totalRefunded), sub: `Net Revenue Loss: ${fmt(ra.financialImpact.netRevenueLoss)}` }
      ]}
    />
  );

  const renderPendingDrill = () => {
    const stageItems = Object.entries(pa.byStage).filter(([,c]) => c > 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => { setDrillView(null); setSubDrill(null); }} className="p-1.5 bg-gray-800 rounded-xl hover:bg-gray-700"><ArrowLeft size={12} /></button>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Pending Orders by Stage</h3>
          <span className="text-xs text-gray-500 ml-auto">Total Value: {fmt(pa.totalValue)}</span>
        </div>
        <div className="space-y-1.5">
          {stageItems.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">No pending orders</p>
          ) : stageItems.map(([stage, count]) => (
            <div key={stage} className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
              <StageBadge stage={stage} />
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(count / Math.max(...stageItems.map(([,c]) => c), 1)) * 100}%` }} />
              </div>
              <span className="text-xs font-black text-white w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
        <button onClick={() => fetchOrders('pending', 'All Pending Orders')} className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300">
          <Eye size={10} /> View All Pending Orders
        </button>
      </div>
    );
  };

  const renderFinancials = () => (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Financial Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-800/40 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">Total Revenue</p>
          <p className="text-lg font-black text-emerald-400">{fmt(fin.totalRevenue)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">COD Revenue</p>
          <p className="text-lg font-black text-white">{fmt(fin.codRevenue)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">Online Revenue</p>
          <p className="text-lg font-black text-white">{fmt(fin.onlineRevenue)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">Prepaid Revenue</p>
          <p className="text-lg font-black text-white">{fmt(fin.prepaidRevenue)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">Total Refunded</p>
          <p className="text-lg font-black text-red-400">{fmt(fin.totalRefunded)}</p>
          <p className="text-[10px] text-gray-500">{fin.refundedCount} orders ({fin.pendingRefundCount} pending)</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-3 col-span-1 sm:col-span-3">
          <p className="text-[10px] font-black text-gray-500 uppercase">Net Revenue</p>
          <p className="text-2xl font-black text-emerald-400">{fmt(fin.netRevenue)}</p>
          <p className="text-[10px] text-gray-500">{fmt(fin.totalRevenue)} – {fmt(fin.totalRefunded)} (refunds)</p>
        </div>
      </div>
    </div>
  );

  const trendsChart = useMemo(() => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Order & Revenue Trend</h3>
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <YAxis yAxisId="left" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Area yAxisId="left" type="monotone" dataKey="orders" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} name="Orders" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Revenue (₨)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-600 text-center py-12">No data for selected period</p>
        )}
      </div>
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Return Trend</h3>
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Line type="monotone" dataKey="returns" stroke="#ef4444" strokeWidth={2} name="Returns" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2} name="Orders" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-600 text-center py-12">No data for selected period</p>
        )}
      </div>
    </div>
  ), [trends]);

  const pieData = useMemo(() => [
    { name: 'COD', value: fin.codRevenue || 0, color: '#6366f1' },
    { name: 'Online', value: fin.onlineRevenue || 0, color: '#10b981' },
    { name: 'Prepaid', value: fin.prepaidRevenue || 0, color: '#f59e0b' }
  ].filter(d => d.value > 0), [fin.codRevenue, fin.onlineRevenue, fin.prepaidRevenue]);

  const revenuePie = useMemo(() => {
    if (pieData.length === 0) return null;
    return (
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Revenue Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12 }} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }, [pieData]);

  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-black text-white tracking-tight">Analytics</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Source-Wise Performance Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors">
            <RefreshCcw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Source Tabs */}
      {renderSourceTabs()}

      {/* Filters */}
      {renderFilters()}

      {/* Main Content */}
      {loading ? (
        <PageLoader text="Loading Analytics..." />
      ) : (
        <div className="space-y-3">
          {/* Summary Cards */}
          {renderSummaryCards()}

          {/* Drill-down Content */}
          {drillView === 'delivered' && renderDeliveredDrill()}
          {drillView === 'returns' && renderReturnsDrill()}
          {drillView === 'pending' && renderPendingDrill()}

          {/* Financial Overview */}
          {!drillView && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="lg:col-span-2">{renderFinancials()}</div>
                {revenuePie}
              </div>
              {/* Trends */}
              {trendsChart}
            </>
          )}
        </div>
      )}

      {/* Order List Modal */}
      {orderList && (
        <OrderListModal title={orderListTitle} orders={orderList} onClose={() => setOrderList(null)} />
      )}
    </div>
  );
};

export default React.memo(UnifiedAnalytics);
