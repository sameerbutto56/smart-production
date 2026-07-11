import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3, TrendingUp, DollarSign, RefreshCcw, X, Search,
  ShoppingCart, CheckCircle2, RotateCcw, Clock, Filter,
  CreditCard, Banknote, Landmark, ArrowLeft, Eye, FileText, Printer, Store, Award, Receipt, Users
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { PageLoader } from '../components/LoadingSpinner';
import BiSection from '../components/BiSection';

const outletForSource = (sourceId) => {
  if (sourceId === 'jail_road') return 'Jail Road';
  if (sourceId === 'johar_town') return 'Johar Town';
  if (sourceId === 'abbottabad') return 'Abbottabad';
  return null;
};

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
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

const PAYMENT_METHODS = [
  { value: 'all', label: 'All Payments' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CASH_ONLINE', label: 'Hybrid' },
  { value: 'advance', label: 'Advance Payment' }
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

const DetailModal = React.memo(({ title, children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-sm font-black text-white uppercase tracking-widest">{title}</h2>
        <button onClick={onClose} className="p-1.5 bg-gray-800 rounded-xl hover:bg-gray-700"><X size={14} /></button>
      </div>
      <div className="overflow-y-auto max-h-[70vh] p-4">{children}</div>
    </div>
  </div>
));

const KpiCard = React.memo(({ label, value, sub, color, icon: Icon, onClick, active }) => (
  <button onClick={onClick}
    className={`relative overflow-hidden bg-gradient-to-br ${color} p-[1px] rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg ${active ? 'ring-2 ring-white/30 scale-[1.02]' : ''} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
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

const POS_KpiCard = React.memo(({ label, value, icon: Icon, color, onClick }) => (
  <button onClick={onClick}
    className={`bg-gray-800/40 rounded-xl p-3 border border-gray-700/30 ${onClick ? 'cursor-pointer hover:border-purple-500/50 hover:bg-gray-800/60' : 'cursor-default'} transition-all text-left w-full`}>
    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
    <p className={`text-lg font-black ${color}`}>{fmt(value)}</p>
  </button>
));

const BranchStatCard = React.memo(({ label, value, sub, color }) => (
  <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-700/30">
    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
    <p className={`text-lg font-black ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
  </div>
));

const ANALYTICS_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'bi', label: 'Business Intelligence', icon: TrendingUp },
  { id: 'business', label: 'Business Analytics', icon: Award },
];

const UnifiedAnalytics = () => {
  const { user } = useAuth();
  const filteredTabs = useMemo(() => {
    if (user?.role === 'OUTLET') {
      const name = user.name?.toLowerCase().replace(/\s+/g, '_') || '';
      const tab = SOURCE_TABS.find(t => t.id === name);
      return tab ? [SOURCE_TABS[0], tab] : [SOURCE_TABS[0]];
    }
    return SOURCE_TABS;
  }, [user]);

  const initialSource = (() => {
    if (user?.role === 'OUTLET') {
      return user.name?.toLowerCase().replace(/\s+/g, '_') || 'all';
    }
    return 'all';
  })();

  const [mainTab, setMainTab] = useState('overview');
  const [source, setSource] = useState(initialSource);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('-2');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('all');
  const [drillView, setDrillView] = useState(null);
  const [subDrill, setSubDrill] = useState(null);
  const [orderList, setOrderList] = useState(null);
  const [orderListTitle, setOrderListTitle] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [posData, setPosData] = useState(null);
  const [posLoading, setPosLoading] = useState(false);
  const [branchCashier, setBranchCashier] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentDetailModal, setPaymentDetailModal] = useState(null);
  const [paymentDetailData, setPaymentDetailData] = useState(null);
  const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);
  const [cashierInvoices, setCashierInvoices] = useState(null);
  const [cashierInvoiceLoading, setCashierInvoiceLoading] = useState(false);

  const isOnlineSource = source === 'online';
  const isBranchSource = outletForSource(source) !== null;
  const isAllSources = source === 'all';
  const selectedOutlet = outletForSource(source);
  const showOnlineSection = isAllSources || isOnlineSource;
  const showPOSSection = isAllSources || isBranchSource;

  const getBranchEmployees = (branch) => {
    const name = branch?.toLowerCase() || '';
    if (name.includes('jail')) return ['Junaid', 'Ibrar', 'Amir'];
    if (name.includes('johar')) return ['Gull', 'Junaid', 'Sajawal', 'Zain'];
    if (name.includes('abbottabad')) return ['Gull', 'Junaid', 'Sajawal', 'Zain'];
    return ['Gull', 'Junaid', 'Sajawal', 'Zain'];
  };

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

  // Online Orders data
  const fetchData = useCallback(async () => {
    if (!showOnlineSection) { setData(null); return; }
    setLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr });
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cityFilter) params.set('city', cityFilter);
      if (deliveryStatus !== 'all') params.set('deliveryStatus', deliveryStatus);
      const src = isAllSources ? 'all' : 'online';
      const res = await api.get(`/api/analytics/source/${src}?${params}`);
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  }, [source, datePreset, customStart, customEnd, paymentMethod, statusFilter, cityFilter, deliveryStatus, getDateRange, showOnlineSection, isAllSources]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // POS data
  const fetchPosData = useCallback(async () => {
    if (!showPOSSection) { setPosData(null); return; }
    setPosLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams();
      if (dr.startDate) params.set('startDate', dr.startDate);
      if (dr.endDate) params.set('endDate', dr.endDate);
      if (selectedOutlet) params.set('outlet', selectedOutlet);
      if (branchCashier) params.set('cashier', branchCashier);
      if (paymentMethod !== 'all' && paymentMethod !== 'advance') {
        if (paymentMethod === 'CASH_ONLINE') params.set('paymentMethod', 'CASH_ONLINE');
        else params.set('paymentMethod', paymentMethod);
      }
      const res = await api.get(`/api/pos/sales/dashboard?${params}`);
      setPosData(res.data);
    } catch { setPosData(null); }
    setPosLoading(false);
  }, [source, selectedOutlet, branchCashier, paymentMethod, getDateRange, showPOSSection]);

  useEffect(() => { fetchPosData(); }, [fetchPosData]);

  // Detail modal fetchers
  const openSalesDetail = async () => {
    setDetailModal('sales');
    setDetailLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, limit: '100' });
      if (selectedOutlet) params.set('outlet', selectedOutlet);
      if (branchCashier) params.set('cashier', branchCashier);
      const res = await api.get(`/api/pos/sales?${params}`);
      setDetailData(res.data);
    } catch { setDetailData([]); }
    setDetailLoading(false);
  };

  const openRevenueDetail = async () => {
    setDetailModal('revenue');
    setDetailLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, limit: '100' });
      if (selectedOutlet) params.set('outlet', selectedOutlet);
      if (branchCashier) params.set('cashier', branchCashier);
      const res = await api.get(`/api/pos/sales?${params}`);
      setDetailData(res.data);
    } catch { setDetailData([]); }
    setDetailLoading(false);
  };

  const openTransactionDetail = async () => {
    setDetailModal('transactions');
    setDetailLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, limit: '100' });
      if (selectedOutlet) params.set('outlet', selectedOutlet);
      if (branchCashier) params.set('cashier', branchCashier);
      const res = await api.get(`/api/pos/sales?${params}`);
      setDetailData(res.data);
    } catch { setDetailData([]); }
    setDetailLoading(false);
  };

  const fetchOrders = async (type, label) => {
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, type, limit: '100' });
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cityFilter) params.set('city', cityFilter);
      const src = isAllSources ? 'all' : 'online';
      const res = await api.get(`/api/analytics/source/${src}/orders?${params}`);
      setOrderList(res.data);
      setOrderListTitle(label);
    } catch { setOrderList([]); setOrderListTitle(label); }
  };

  const PAYMENT_METHOD_LABELS = {
    CASH: 'Cash Received',
    CARD: 'Card Payments',
    ONLINE: 'Online Payments',
    CASH_ONLINE: 'Hybrid (Cash + Online)'
  };

  const openPaymentDetail = async (method) => {
    setPaymentDetailModal(method);
    setPaymentDetailLoading(true);
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ limit: '200' });
      if (dr.startDate) params.set('dateFrom', dr.startDate);
      if (dr.endDate) params.set('dateTo', dr.endDate);
      if (selectedOutlet) params.set('outlet', selectedOutlet);
      if (branchCashier) params.set('cashier', branchCashier);
      if (method) params.set('paymentMethod', method);
      const res = await api.get(`/api/pos/sales?${params}`);
      setPaymentDetailData(res.data);
    } catch { setPaymentDetailData([]); }
    setPaymentDetailLoading(false);
  };

  // Fetch cashier invoices when branch + cashier selected
  useEffect(() => {
    if (isBranchSource && branchCashier) {
      (async () => {
        setCashierInvoiceLoading(true);
        try {
          const dr = getDateRange();
          const params = new URLSearchParams({ limit: '500' });
          if (dr.startDate) params.set('dateFrom', dr.startDate);
          if (dr.endDate) params.set('dateTo', dr.endDate);
          if (selectedOutlet) params.set('outlet', selectedOutlet);
          params.set('cashier', branchCashier);
          const res = await api.get(`/api/pos/sales?${params}`);
          setCashierInvoices(res.data);
        } catch { setCashierInvoices([]); }
        setCashierInvoiceLoading(false);
      })();
    } else {
      setCashierInvoices(null);
    }
  }, [isBranchSource, branchCashier, getDateRange, selectedOutlet]);

  // CSV download
  const handleDownloadPosCSV = () => {
    if (!posData) return;
    const rows = [['Metric', 'Value']];
    rows.push(['Total POS Sales', posData.totalSales || 0]);
    rows.push(['Total Orders', posData.totalOrders || 0]);
    rows.push(['Total Returns', posData.returnedOrders || 0]);
    rows.push(['Net Revenue', posData.netRevenue || 0]);
    rows.push(['Total Discount', posData.totalDiscount || 0]);
    if (posData.branchPerformance) {
      rows.push(['']);
      rows.push(['--- Branch Performance ---', '']);
      posData.branchPerformance.forEach(bp => {
        rows.push([`${bp.branch} Revenue`, bp.revenue || 0]);
        rows.push([`${bp.branch} Orders`, bp.orders || 0]);
      });
    }
    if (posData.bestSellingProducts) {
      rows.push(['']);
      rows.push(['--- Best Selling Products ---', '']);
      posData.bestSellingProducts.forEach(p => rows.push([p.name, p.qty]));
    }
    if (posData.paymentBreakdown) {
      rows.push(['']);
      rows.push(['--- Payment Breakdown ---', '']);
      posData.paymentBreakdown.forEach(p => {
        rows.push([`${p.method} Gross`, p.gross || 0]);
        rows.push([`${p.method} Returns`, p.returns || 0]);
        rows.push([`${p.method} Net`, p.net || 0]);
      });
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pos_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handlePrint = () => { window.print(); };

  // Download Online Orders Excel
  const handleExportExcel = async () => {
    try {
      const dr = getDateRange();
      const params = new URLSearchParams({ ...dr, source: isAllSources ? 'all' : 'online' });
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cityFilter) params.set('city', cityFilter);
      if (deliveryStatus !== 'all') params.set('deliveryStatus', deliveryStatus);
      const response = await api.get(`/api/analytics/export-excel?${params}`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `analytics_${source}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export analytics failed:', error);
      alert('Failed to export analytics: ' + (error.response?.data?.message || error.message));
    }
  };

  const s = data?.summary || {};
  const db = data?.deliveredBreakdown || {};
  const ra = data?.returnsAnalytics || {};
  const pa = data?.pendingAnalytics || {};
  const fin = useMemo(() => data?.financials || {}, [data?.financials]);
  const trends = useMemo(() => data?.trends?.monthly || [], [data?.trends?.monthly]);

  const handleSourceClick = (id) => {
    setSource(id);
    setDrillView(null);
    setSubDrill(null);
    setOrderList(null);
    setBranchCashier('');
  };

  // ─── Page-level Source Tabs ───
  const renderSourceTabs = () => (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {filteredTabs.map(t => (
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

  // ─── Page-level Date / Payment Filters ───
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
            {PAYMENT_METHODS.map(pm => (
              <option key={pm.value} value={pm.value}>{pm.label}</option>
            ))}
          </select>
          {showOnlineSection && (
            <>
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
            </>
          )}
          {isBranchSource && (
            <div className="flex items-center gap-1.5">
              <Users size={10} className="text-gray-500" />
              <select value={branchCashier} onChange={e => setBranchCashier(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-[10px] font-bold">
                <option value="">All Cashiers</option>
                {getBranchEmployees(selectedOutlet).map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Online Order Summary Cards ───
  const renderOnlineSummary = () => {
    const totalVal = s.totalOrders || 0;
    const deliveredVal = s.deliveredOrders || 0;
    const returnedVal = s.returnedOrders || 0;
    const pendingVal = s.pendingOrders || 0;
    return (
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
  };

  const renderDeliveredDrill = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      <BranchStatCard label="Cash on Delivery" value={`${db.cod.count} orders`} sub={`Amount: ${fmt(db.cod.amount)}`} color="text-white" />
      <BranchStatCard label="Online Payment" value={`${db.online.count} orders`} sub={`Amount: ${fmt(db.online.amount)}`} color="text-white" />
      <BranchStatCard label="Prepaid Orders" value={`${db.prepaid.count} orders`} sub={`Revenue: ${fmt(db.prepaid.amount)}`} color="text-white" />
    </div>
  );

  const renderReturnsDrill = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      <BranchStatCard label="Returned Paid" value={`${ra.paidReturns.count} orders`} sub={`Refunded: ${fmt(ra.paidReturns.refundAmount)}`} color="text-red-400" />
      <BranchStatCard label="Returned COD" value={`${ra.codReturns.count} orders`} sub={`Impact: ${fmt(ra.codReturns.amountImpact)}`} color="text-red-400" />
      <BranchStatCard label="Financial Impact" value={fmt(ra.financialImpact.totalRefunded)} sub={`Net Loss: ${fmt(ra.financialImpact.netRevenueLoss)}`} color="text-red-400" />
    </div>
  );

  const renderPendingDrill = () => {
    const stageItems = Object.entries(pa.byStage).filter(([, c]) => c > 0);
    return (
      <div className="space-y-1.5">
        {stageItems.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">No pending orders</p>
        ) : stageItems.map(([stage, count]) => (
          <div key={stage} className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
            <StageBadge stage={stage} />
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(count / Math.max(...stageItems.map(([, c]) => c), 1)) * 100}%` }} />
            </div>
            <span className="text-xs font-black text-white w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderFinancials = () => (
    <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Financial Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BranchStatCard label="Total Revenue" value={fmt(fin.totalRevenue)} color="text-emerald-400" />
        <BranchStatCard label="COD Revenue" value={fmt(fin.codRevenue)} color="text-white" />
        <BranchStatCard label="Online Revenue" value={fmt(fin.onlineRevenue)} color="text-white" />
        <BranchStatCard label="Prepaid Revenue" value={fmt(fin.prepaidRevenue)} color="text-white" />
        <BranchStatCard label="Total Refunded" value={fmt(fin.totalRefunded)} sub={`${fin.refundedCount} orders (${fin.pendingRefundCount} pending)`} color="text-red-400" />
        <BranchStatCard label="Net Revenue" value={fmt(fin.netRevenue)} sub={`${fmt(fin.totalRevenue)} – ${fmt(fin.totalRefunded)} (refunds)`} color="text-emerald-400" />
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

  // ─── POS Section ───
  const renderPOSSection = () => (
    <div className="bg-gray-900/30 rounded-2xl border border-gray-800/50 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Store size={16} className="text-purple-500" />
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
          {selectedOutlet ? `${selectedOutlet} POS Analytics` : 'Point of Sale Analytics'}
        </h3>
        {posLoading && <RefreshCcw size={12} className="animate-spin text-gray-500" />}
      </div>
      {posData ? (
        <>
          {/* POS KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <POS_KpiCard label="POS Sales" value={posData.totalSales} icon={Store} color="text-purple-400" onClick={isBranchSource ? openSalesDetail : null} />
            <POS_KpiCard label="POS Transactions" value={posData.totalOrders} icon={Receipt} color="text-white" onClick={isBranchSource ? openTransactionDetail : null} />
            <POS_KpiCard label="POS Returns" value={posData.returnedOrders} icon={RotateCcw} color="text-red-400" />
            <POS_KpiCard label="Total Discount" value={posData.totalDiscount} icon={DollarSign} color="text-amber-400" />
          </div>

          {/* Branch Performance — only in All Sources, NOT clickable */}
          {isAllSources && posData.branchPerformance && posData.branchPerformance.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Branch Performance</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {posData.branchPerformance.map((bp) => (
                  <div key={bp.branch} className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
                    <p className="text-xs font-black text-white">{bp.branch}</p>
                    <p className="text-sm font-black text-emerald-400">{fmt(bp.revenue)}</p>
                    <p className="text-[10px] text-gray-500">{bp.orders} orders</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branch-specific Net Revenue */}
          {isBranchSource && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <POS_KpiCard label="Net Revenue" value={posData.netRevenue} icon={TrendingUp} color="text-emerald-400" onClick={isBranchSource ? openRevenueDetail : null} />
              <POS_KpiCard label="Completed" value={posData.completedOrders} icon={CheckCircle2} color="text-emerald-400" />
              <POS_KpiCard label="Cancelled" value={posData.cancelledOrders} icon={X} color="text-red-400" />
              <POS_KpiCard label="Highest Day" value={posData.highestSalesDay?.amount} icon={Award} color="text-amber-400" sub={posData.highestSalesDay?.date} />
            </div>
          )}

          {/* Payment Breakdown */}
          {posData.paymentBreakdown && posData.paymentBreakdown.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Payment Breakdown</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {posData.paymentBreakdown.map(pm => (
                  <button key={pm.method} onClick={isBranchSource ? () => openPaymentDetail(pm.method) : undefined}
                    className={`bg-gray-800/40 rounded-xl p-2.5 border border-gray-700/30 text-left w-full transition-all ${isBranchSource ? 'cursor-pointer hover:border-purple-500/50 hover:bg-gray-800/60' : 'cursor-default'}`}>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{PAYMENT_METHOD_LABELS[pm.method] || pm.method}</p>
                    <p className="text-sm font-black text-white">{fmt(pm.gross)}</p>
                    <p className="text-[9px] text-gray-500">Returns: {fmt(pm.returns)} | Net: {fmt(pm.net)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Best Selling Products */}
          {posData.bestSellingProducts && posData.bestSellingProducts.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Best Selling Products</p>
              <div className="flex flex-wrap gap-1.5">
                {posData.bestSellingProducts.map((p, i) => (
                  <span key={i} className="text-[10px] font-bold text-white bg-gray-800/60 px-2.5 py-1 rounded-lg border border-gray-700/30">
                    {i + 1}. {p.name} <span className="text-emerald-400">({p.qty} sold)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Daily Trend */}
          {posData.reportData && posData.reportData.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Daily POS Sales Trend</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={posData.reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 8 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 8 }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, fontSize: 10 }} formatter={(v) => fmt(v)} />
                  <Area type="monotone" dataKey="sales" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} name="Sales" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Faisal Takes */}
          {posData.faisalTakes && posData.faisalTakes.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Faisal Takes</p>
              <div className="flex flex-wrap gap-1.5">
                {posData.faisalTakes.slice(0, 5).map((ft, i) => (
                  <span key={i} className="text-[10px] font-bold text-white bg-amber-800/40 px-2.5 py-1 rounded-lg border border-amber-700/30">
                    {ft.receiptNumber} — {ft.items?.[0]?.productName || 'N/A'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cashier Invoice History — shown when branch + cashier selected */}
          {isBranchSource && branchCashier && cashierInvoices && cashierInvoices.length > 0 && (
            <div className="mt-4 bg-gray-900/50 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">{branchCashier}'s Invoice History</h3>
                  {cashierInvoiceLoading && <RefreshCcw size={12} className="animate-spin text-gray-500" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => {
                    const rows = [['Invoice#', 'Date', 'Customer', 'Products', 'Qty', 'Amount', 'Discount', 'Payment', 'Status', 'Branch']];
                    cashierInvoices.forEach(s => {
                      const items = s.items?.map(it => it.productName).join('; ') || '';
                      const qty = s.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0;
                      rows.push([s.receiptNumber || '', new Date(s.createdAt).toLocaleDateString(), s.customerName || 'Walk-in', items, qty, s.grandTotal, s.discountAmount || 0, s.paymentMethod || '', s._balanceStatus || 'paid', s.outletName || '']);
                    });
                    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `cashier_${branchCashier}_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"><FileText size={11} /> CSV</button>
                  <button onClick={() => {
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<html><head><title>Cashier Report - ${branchCashier}</title><style>
                      body{font-family:Arial,sans-serif;padding:20px;color:#333}
                      h2{color:#6366f1}table{width:100%;border-collapse:collapse;margin:10px 0}
                      th,td{padding:6px 10px;text-align:left;border:1px solid #ddd;font-size:12px}
                      th{background:#f0f0f0;font-weight:bold}
                      .summary{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
                      .summary-item{background:#f5f5f5;padding:10px 15px;border-radius:8px}
                      .summary-label{font-size:10px;color:#666;text-transform:uppercase}
                      .summary-value{font-size:16px;font-weight:bold;color:#111}
                    </style></head><body>`);
                    w.document.write(`<h2>Cashier Invoice Report — ${branchCashier}</h2>`);
                    w.document.write(`<p>Branch: ${selectedOutlet} | Period: ${getDateRange().startDate || 'All'} → ${getDateRange().endDate || 'All'}</p>`);
                    const totalSales = cashierInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
                    const totalDiscount = cashierInvoices.reduce((s, inv) => s + (inv.discountAmount || 0), 0);
                    const totalQty = cashierInvoices.reduce((s, inv) => s + (inv.items?.reduce((q, it) => q + (it.quantity || 0), 0) || 0), 0);
                    w.document.write('<div class="summary">');
                    w.document.write(`<div class="summary-item"><div class="summary-label">Total Invoices</div><div class="summary-value">${cashierInvoices.length}</div></div>`);
                    w.document.write(`<div class="summary-item"><div class="summary-label">Total Sales</div><div class="summary-value">₨${totalSales.toLocaleString()}</div></div>`);
                    w.document.write(`<div class="summary-item"><div class="summary-label">Total Items</div><div class="summary-value">${totalQty}</div></div>`);
                    w.document.write(`<div class="summary-item"><div class="summary-label">Total Discount</div><div class="summary-value">₨${totalDiscount.toLocaleString()}</div></div>`);
                    w.document.write('</div>');
                    w.document.write('<table><thead><tr><th>Invoice#</th><th>Date</th><th>Customer</th><th>Products</th><th>Qty</th><th>Amount</th><th>Discount</th><th>Payment</th><th>Status</th></tr></thead><tbody>');
                    cashierInvoices.forEach(inv => {
                      const items = inv.items?.map(it => it.productName).join(', ') || '';
                      const qty = inv.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0;
                      w.document.write(`<tr><td>${inv.receiptNumber || ''}</td><td>${new Date(inv.createdAt).toLocaleDateString()}</td><td>${inv.customerName || 'Walk-in'}</td><td>${items}</td><td>${qty}</td><td>₨${(inv.grandTotal || 0).toLocaleString()}</td><td>₨${(inv.discountAmount || 0).toLocaleString()}</td><td>${inv.paymentMethod || ''}</td><td>${inv._balanceStatus || 'paid'}</td></tr>`);
                    });
                    w.document.write('</tbody></table>');
                    w.document.write(`<p>Generated: ${new Date().toLocaleString()} | Branch: ${selectedOutlet} | Cashier: ${branchCashier}</p>`);
                    w.document.write('</body></html>');
                    w.document.close(); w.print();
                  }} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"><Printer size={11} /> Print</button>
                </div>
              </div>

              {/* Cashier Summary */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/30">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Invoices</p>
                  <p className="text-lg font-black text-white">{cashierInvoices.length}</p>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/30">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Total Sales</p>
                  <p className="text-lg font-black text-emerald-400">{fmt(cashierInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0))}</p>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/30">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Discounts</p>
                  <p className="text-lg font-black text-amber-400">{fmt(cashierInvoices.reduce((s, inv) => s + (inv.discountAmount || 0), 0))}</p>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/30">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Cash Payments</p>
                  <p className="text-lg font-black text-white">{fmt(cashierInvoices.filter(inv => inv.paymentMethod === 'CASH').reduce((s, inv) => s + (inv.grandTotal || 0), 0))}</p>
                </div>
                <div className="bg-gray-800/30 rounded-xl p-2.5 border border-gray-700/30">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Card + Online</p>
                  <p className="text-lg font-black text-white">{fmt(cashierInvoices.filter(inv => inv.paymentMethod === 'CARD' || inv.paymentMethod === 'ONLINE' || inv.paymentMethod === 'CASH_ONLINE').reduce((s, inv) => s + (inv.grandTotal || 0), 0))}</p>
                </div>
              </div>

              {/* Cashier Invoice Table */}
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-gray-900/95">
                    <tr className="font-black text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      <th className="py-2 pr-2">Invoice</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Customer</th>
                      <th className="py-2 pr-2">Products</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2 text-right">Amount</th>
                      <th className="py-2 pr-2 text-right">Discount</th>
                      <th className="py-2 pr-2">Payment</th>
                      <th className="py-2 pr-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashierInvoices.map((inv, i) => (
                      <tr key={inv.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-1.5 pr-2 font-bold text-white">{inv.receiptNumber || '—'}</td>
                        <td className="py-1.5 pr-2 text-gray-400">{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '—'}</td>
                        <td className="py-1.5 pr-2 text-gray-300 max-w-[100px] truncate">{inv.customerName || 'Walk-in'}</td>
                        <td className="py-1.5 pr-2 text-gray-400 max-w-[120px] truncate">{inv.items?.map(it => it.productName).join(', ') || '—'}</td>
                        <td className="py-1.5 pr-2 text-right text-white">{inv.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0}</td>
                        <td className="py-1.5 pr-2 text-right font-bold text-emerald-400">{fmt(inv.grandTotal)}</td>
                        <td className="py-1.5 pr-2 text-right text-amber-400">{fmt(inv.discountAmount || 0)}</td>
                        <td className="py-1.5 pr-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{inv.paymentMethod || '—'}</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${inv._balanceStatus === 'balance' ? 'bg-amber-800/40 text-amber-400' : 'bg-emerald-800/40 text-emerald-400'}`}>
                            {inv._balanceStatus === 'balance' ? 'BAL' : 'PAID'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-600 text-center py-4">No POS data for selected period</p>
      )}
    </div>
  );

  return (
    <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-black text-white tracking-tight">Analytics</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            {mainTab === 'overview' ? 'Performance Dashboard' : mainTab === 'bi' ? 'Business Intelligence' : 'Business Analytics'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainTab === 'overview' && (
            <div className="flex items-center gap-1.5">
              <button onClick={handleDownloadPosCSV} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30">
                <FileText size={14} /> CSV
              </button>
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg">
                <Printer size={14} /> Print
              </button>
              {showOnlineSection && (
                <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30">
                  <FileText size={14} /> Excel
                </button>
              )}
            </div>
          )}
          <button onClick={() => { fetchData(); fetchPosData(); }} className="p-2 bg-gray-900 border border-gray-700 rounded-xl hover:bg-gray-800 transition-colors">
            <RefreshCcw size={14} className={`text-gray-400 ${loading || posLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* PAGE-LEVEL SOURCE TABS */}
      {renderSourceTabs()}

      {/* PAGE-LEVEL DATE / PAYMENT / EMPLOYEE FILTERS */}
      {renderFilters()}

      {/* MAIN TABS */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ANALYTICS_TABS.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              mainTab === t.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {mainTab === 'overview' && (
        <>
          {loading && showOnlineSection ? (
            <PageLoader text="Loading Analytics..." />
          ) : (
            <div className="space-y-3">
              {/* Online Order Section — only for All Sources or Online */}
              {showOnlineSection && (
                <>
                  {renderOnlineSummary()}
                  {drillView === 'delivered' && renderDeliveredDrill()}
                  {drillView === 'returns' && renderReturnsDrill()}
                  {drillView === 'pending' && renderPendingDrill()}
                  {!drillView && (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="lg:col-span-2">{renderFinancials()}</div>
                        {revenuePie}
                      </div>
                      {trendsChart}
                    </>
                  )}
                </>
              )}

              {/* POS Section — only for All Sources or Branches */}
              {showPOSSection && renderPOSSection()}
            </div>
          )}
        </>
      )}

      {/* ── BUSINESS INTELLIGENCE TAB ── */}
      {mainTab === 'bi' && (
        <BiSection
          source={source}
          startDate={getDateRange().startDate}
          endDate={getDateRange().endDate}
        />
      )}

      {/* ── BUSINESS ANALYTICS TAB ── */}
      {mainTab === 'business' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 rounded-2xl"><Award className="text-amber-400" size={20} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Business Analytics</h2>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                {isAllSources ? 'All Sources' : isOnlineSource ? 'Online Orders' : selectedOutlet}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* POS Orders */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">POS Orders</p>
              {posData ? (
                <>
                  <p className="text-3xl font-black text-white">{posData.totalOrders}</p>
                  <p className="text-xs text-gray-500 mt-1">{posData.totalOrders} total | {posData.completedOrders} completed</p>
                </>
              ) : <p className="text-gray-600 text-sm">No data</p>}
            </div>

            {/* Revenue */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Total Revenue</p>
              <p className="text-3xl font-black text-emerald-400">
                {isOnlineSource || isAllSources ? fmt(fin.totalRevenue || 0) : fmt(posData?.totalSales || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isOnlineSource || isAllSources ? 'Online + POS combined' : `${selectedOutlet} POS`}
              </p>
            </div>

            {/* Returns */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Returns</p>
              <p className="text-3xl font-black text-red-400">
                {isOnlineSource || isAllSources ? fmt(fin.totalRefunded || 0) : fmt(posData?.totalSales - posData?.netRevenue || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isOnlineSource || isAllSources ? `${fin.refundedCount || 0} orders refunded` : `${posData?.returnedOrders || 0} returns`}
              </p>
            </div>

            {/* Discounts */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Discounts Given</p>
              <p className="text-3xl font-black text-amber-400">{fmt(posData?.totalDiscount || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Total discount on POS sales</p>
            </div>

            {/* Products */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Best Selling Products</p>
              {posData?.bestSellingProducts?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {posData.bestSellingProducts.slice(0, 3).map((p, i) => (
                    <span key={i} className="text-[10px] font-bold text-white bg-gray-800/60 px-2 py-1 rounded-lg">
                      {i + 1}. {p.name} <span className="text-emerald-400">({p.qty})</span>
                    </span>
                  ))}
                </div>
              ) : <p className="text-gray-600 text-sm mt-2">No product data</p>}
            </div>

            {/* Quick Invoice Report */}
            <div className="glass rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Quick Invoice Report</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-gray-400">Total Invoices</span><span className="font-bold text-white">{posData?.totalOrders || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Total Sales</span><span className="font-bold text-emerald-400">{fmt(posData?.totalSales || 0)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Avg per Invoice</span><span className="font-bold text-white">{fmt(posData?.totalOrders > 0 ? (posData.totalSales / posData.totalOrders) : 0)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Online Order List Modal */}
      {orderList && (
        <DetailModal title={orderListTitle} onClose={() => setOrderList(null)}>
          <div className="space-y-2">
            {orderList.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm font-bold">No orders found</p>
            ) : orderList.map((o, i) => (
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
        </DetailModal>
      )}

      {/* POS Detail Modals */}
      {detailModal && (
        <DetailModal
          title={detailModal === 'sales' ? `Sales History ${selectedOutlet ? `- ${selectedOutlet}` : ''}`
            : detailModal === 'revenue' ? `Revenue Breakdown ${selectedOutlet ? `- ${selectedOutlet}` : ''}`
            : `Transaction History ${selectedOutlet ? `- ${selectedOutlet}` : ''}`}
          onClose={() => { setDetailModal(null); setDetailData(null); }}
        >
          {detailLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCcw size={24} className="animate-spin text-purple-500" /></div>
          ) : detailData && detailData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="font-black text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Cashier</th>
                    <th className="py-2 pr-3">Products</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 pr-3">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.slice(0, 50).map((s, i) => (
                    <tr key={s.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-3 font-bold text-white">{s.receiptNumber || '—'}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                      <td className="py-2 pr-3 text-gray-300">{s.customerName || 'Walk-in'}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.cashierName || '—'}</td>
                      <td className="py-2 pr-3 text-gray-400">{s.items?.length || 0} items</td>
                      <td className="py-2 pr-3 text-right text-white">{s.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0}</td>
                      <td className="py-2 pr-3 text-right font-bold text-emerald-400">{fmt(s.grandTotal)}</td>
                      <td className="py-2 pr-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300">{s.paymentMethod || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8 text-sm font-bold">No records found</p>
          )}
        </DetailModal>
      )}

      {/* Payment Detail Modal */}
      {paymentDetailModal && (
        <DetailModal
          title={`${PAYMENT_METHOD_LABELS[paymentDetailModal] || paymentDetailModal} — ${selectedOutlet || 'All Branches'}`}
          onClose={() => { setPaymentDetailModal(null); setPaymentDetailData(null); }}
        >
          {paymentDetailLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCcw size={24} className="animate-spin text-purple-500" /></div>
          ) : paymentDetailData && paymentDetailData.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{paymentDetailData.length} invoices</p>
                <button onClick={() => {
                  const rows = [['Invoice#', 'Date', 'Customer', 'Cashier', 'Branch', 'Products', 'Qty', 'Amount', 'Discount', 'Payment', 'Payment Breakdown']];
                  paymentDetailData.forEach(s => {
                    const items = s.items?.map(it => `${it.productName}×${it.quantity}`).join('; ') || '';
                    const qty = s.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0;
                    const breakdown = s.paymentMethod === 'CASH_ONLINE' ? `Cash: ${fmt(s.cashAmount)} / Online: ${fmt(s.onlineAmount)}` : '';
                    rows.push([s.receiptNumber || '', new Date(s.createdAt).toLocaleDateString(), s.customerName || 'Walk-in', s.cashierName || '', s.outletName || '', items, qty, s.grandTotal, s.discountAmount || 0, s.paymentMethod || '', breakdown]);
                  });
                  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `payment_${paymentDetailModal}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click(); URL.revokeObjectURL(url);
                }} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"><FileText size={11} /> CSV</button>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-gray-900/95">
                    <tr className="font-black text-gray-500 uppercase tracking-wider border-b border-gray-800">
                      <th className="py-2 pr-2">Invoice</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Customer</th>
                      <th className="py-2 pr-2">Cashier</th>
                      <th className="py-2 pr-2">Branch</th>
                      <th className="py-2 pr-2">Products</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2 text-right">Amount</th>
                      <th className="py-2 pr-2 text-right">Discount</th>
                      <th className="py-2 pr-2">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentDetailData.map((s, i) => {
                      const qty = s.items?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 0;
                      const items = s.items?.map(it => it.productName).join(', ') || '—';
                      return (
                        <tr key={s.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 pr-2 font-bold text-white">{s.receiptNumber || '—'}</td>
                          <td className="py-2 pr-2 text-gray-400">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                          <td className="py-2 pr-2 text-gray-300 max-w-[80px] truncate">{s.customerName || 'Walk-in'}</td>
                          <td className="py-2 pr-2 text-gray-400">{s.cashierName || '—'}</td>
                          <td className="py-2 pr-2 text-gray-400">{s.outletName || '—'}</td>
                          <td className="py-2 pr-2 text-gray-400 max-w-[100px] truncate" title={items}>{items}</td>
                          <td className="py-2 pr-2 text-right text-white">{qty}</td>
                          <td className="py-2 pr-2 text-right font-bold text-emerald-400">{fmt(s.grandTotal)}</td>
                          <td className="py-2 pr-2 text-right text-amber-400">{fmt(s.discountAmount || 0)}</td>
                          <td className="py-2 pr-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">{s.paymentMethod || '—'}</span>
                            {s.paymentMethod === 'CASH_ONLINE' && (
                              <span className="text-[8px] text-gray-500 block">Cash: {fmt(s.cashAmount)} / Online: {fmt(s.onlineAmount)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8 text-sm font-bold">No invoices found for this payment method</p>
          )}
        </DetailModal>
      )}
    </div>
  );
};

export default React.memo(UnifiedAnalytics);
