import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import { Truck, Search, Loader2, LogIn, User, MessageCircle, TrendingUp, Activity, BarChart3, Package, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { isPaidOrder, getRemainingBalance, getCodAmount } from '../utils/paymentUtils';

const EMPLOYEES = {
  Khawar: { password: 'K170', label: 'Khawar', desc: 'Lahore Orders' },
  Faisal: { password: 'F170', label: 'Faisal', desc: 'All Cities + Forwarded' }
};

const DispatchDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDispatchRole = ['DISPATCH', 'MAIN_EMPLOYEE'].includes(user?.role || '');

  const [employeeName, setEmployeeName] = useState(() => sessionStorage.getItem('dispatchDashboardEmployee') || '');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => !!sessionStorage.getItem('dispatchDashboardEmployee'));
  const [loginLoading, setLoginLoading] = useState(false);
  const isKhawar = employeeName === 'Khawar';
  const isFaisal = employeeName === 'Faisal';

  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashEmployee, setDashEmployee] = useState('');
  const [dashCity, setDashCity] = useState('');
  const [dashStatus, setDashStatus] = useState('');
  const [dashPayment, setDashPayment] = useState('');
  const [dashDateFrom, setDashDateFrom] = useState('');
  const [dashDateTo, setDashDateTo] = useState('');

  const [enamelsData, setEnamelsData] = useState({ deliveryOrders: [], charges: { charges: [], totalPending: 0, payments: [], totalPaid: 0 }, codSummary: null, tracking: null, performance: null });
  const [enamelsLoading, setEnamelsLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const enamelsRefreshRef = useRef(null);

  const fetchEnamelsData = useCallback(async () => {
    if (!loggedIn || !employeeName) return;
    setEnamelsLoading(true);
    const safeGet = async (url, fallback) => { try { const r = await api.get(url); return r.data; } catch (e) { console.error('Enamels fetch error:', url, e.message); return fallback; } };
    const [ordersRes, chargesRes, codRes, trackingRes, perfRes] = await Promise.all([
      safeGet(`/api/delivery/orders?deliveryType=ENAMELS`, []),
      safeGet(`/api/delivery/charges`, { charges: [], totalPending: 0, payments: [], totalPaid: 0 }),
      safeGet(`/api/delivery/cod`, null),
      safeGet(`/api/delivery/dispatch-tracking?dispatchOfficer=${employeeName}`, null),
      safeGet(`/api/delivery/performance`, null)
    ]);
    setEnamelsData({
      deliveryOrders: Array.isArray(ordersRes) ? ordersRes : [],
      charges: chargesRes || { charges: [], totalPending: 0, payments: [], totalPaid: 0 },
      codSummary: codRes,
      tracking: trackingRes,
      performance: perfRes
    });
    setEnamelsLoading(false);
  }, [loggedIn, employeeName]);

  // Auto-refresh enamels data every 60s
  const POLL_INTERVAL = 60000;
  useEffect(() => {
    if (!loggedIn) return;
    enamelsRefreshRef.current = setInterval(fetchEnamelsData, POLL_INTERVAL);
    return () => { if (enamelsRefreshRef.current) clearInterval(enamelsRefreshRef.current); };
  }, [loggedIn, fetchEnamelsData]);

  // Socket-driven refresh — no need to re-create the interval, socket events replace polling
  useEffect(() => {
    if (!loggedIn) return;
    const doRefresh = () => { fetchEnamelsData(); };
    socket.on('order-updated', doRefresh);
    socket.on('dispatch-request', doRefresh);
    return () => { socket.off('order-updated', doRefresh); socket.off('dispatch-request', doRefresh); };
  }, [loggedIn, fetchEnamelsData]);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const params = new URLSearchParams();
      if (dashEmployee) params.set('employee', dashEmployee);
      if (dashCity) params.set('city', dashCity);
      if (dashStatus) params.set('status', dashStatus);
      if (dashPayment) params.set('payment', dashPayment);
      if (dashDateFrom) params.set('dateFrom', dashDateFrom);
      if (dashDateTo) params.set('dateTo', dashDateTo);
      const res = await api.get(`/api/dispatch-profile/dashboard?${params.toString()}`);
      setDashboardData(res.data);
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [dashEmployee, dashCity, dashStatus, dashPayment, dashDateFrom, dashDateTo]);

  useEffect(() => {
    if (loggedIn) {
      fetchDashboard();
      fetchEnamelsData();
    }
  }, [loggedIn, fetchDashboard, fetchEnamelsData]);

  const handleLogin = () => {
    const emp = EMPLOYEES[employeeName];
    if (!emp) { toast.error('Please select an employee'); return; }
    if (password !== emp.password) { toast.error('Invalid password'); return; }
    setLoginLoading(true);
    setTimeout(() => {
      setLoggedIn(true);
      setPassword('');
      sessionStorage.setItem('dispatchDashboardEmployee', employeeName);
      toast.success(`Logged in as ${employeeName}`);
      setLoginLoading(false);
    }, 400);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setEmployeeName('');
    setPassword('');
    sessionStorage.removeItem('dispatchDashboardEmployee');
    setDashboardData(null);
    setEnamelsData({ deliveryOrders: [], charges: { charges: [], totalPending: 0, payments: [], totalPaid: 0 }, codSummary: null, tracking: null, performance: null });
  };

  if (isDispatchRole && !loggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass max-w-md w-full p-8 rounded-[3rem] border-2 theme-border shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="text-blue-400" size={32} />
            </div>
            <h1 className="text-3xl font-black theme-text-primary uppercase tracking-tight">Dispatch Dashboard</h1>
            <p className="theme-text-muted text-xs font-bold uppercase tracking-widest mt-2">Employee Login</p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2 block">Select Employee</label>
              <select value={employeeName} onChange={(e) => { setEmployeeName(e.target.value); setPassword(''); }}
                className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black appearance-none">
                <option value="">— Select Employee —</option>
                {Object.entries(EMPLOYEES).map(([key, emp]) => (
                  <option key={key} value={key}>{emp.label} — {emp.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2 block">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                  className="w-full theme-input rounded-xl py-3 px-4 pr-12 focus:border-blue-500 outline-none font-black"
                  placeholder="Enter password..." />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs font-black">
                  {showPwd ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={loginLoading || !employeeName || !password}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loginLoading ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
              Login as {employeeName || 'Employee'}
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-700/30">
            <p className="text-xs font-bold theme-text-muted text-center">Secure dispatch dashboard access</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (dashboardLoading && !dashboardData) {
    return <PageLoader text="Loading Dispatch Dashboard..." />;
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <BarChart3 className="text-emerald-400" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tight">
              {loggedIn ? `${employeeName}'s Dashboard` : 'Dispatch Dashboard'}
            </h1>
            <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">
              Analytics, reports & delivery tracking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loggedIn && (
            <>
              <button onClick={() => navigate('/chat')}
                className="px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
                <MessageCircle size={14} /> {employeeName}'s Chat
              </button>
              <button onClick={handleLogout}
                className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
                <X size={14} /> Logout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dashboard Analytics */}
      <div className="space-y-6">
        {dashboardLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-400" size={32} /></div>
        ) : !dashboardData ? (
          <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
            <BarChart3 className="mx-auto text-gray-800 mb-4" size={48} />
            <h3 className="theme-text-muted font-black uppercase">No Dashboard Data</h3>
            <button onClick={fetchDashboard} className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider">Load Dashboard</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <select value={dashEmployee} onChange={(e) => setDashEmployee(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
                <option value="">All Employees</option>
                <option value="Khawar">Khawar</option>
                <option value="Faisal">Faisal</option>
              </select>
              <select value={dashCity} onChange={(e) => setDashCity(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
                <option value="">All Cities</option>
                <option value="Lahore">Lahore</option>
                <option value="Other">Other Cities</option>
              </select>
              <select value={dashStatus} onChange={(e) => setDashStatus(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={dashPayment} onChange={(e) => setDashPayment(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider">
                <option value="">All Payment</option>
                <option value="paid">Paid</option>
                <option value="cod">Cash on Delivery</option>
              </select>
              <input type="date" value={dashDateFrom} onChange={(e) => setDashDateFrom(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black" />
              <input type="date" value={dashDateTo} onChange={(e) => setDashDateTo(e.target.value)}
                className="theme-input rounded-xl py-2 px-3 text-xs font-black" />
              <button onClick={fetchDashboard}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">Apply</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {[
                { label: 'Total', value: dashboardData.summary.totalOrders, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Pending', value: dashboardData.summary.pending, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Active', value: dashboardData.summary.active, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'Delivered', value: dashboardData.summary.delivered, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Returned', value: dashboardData.summary.returned, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Rejected', value: dashboardData.summary.rejected, color: 'text-gray-400', bg: 'bg-gray-500/10' },
                { label: 'COD', value: dashboardData.summary.cod, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Paid', value: dashboardData.summary.paid, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map(card => (
                <div key={card.label} className={`${card.bg} rounded-2xl p-3 border border-white/5 text-center`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                  <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Employee Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['Khawar', 'Faisal'].map(name => {
                const es = dashboardData.employeeStats[name];
                return (
                  <div key={name} className="glass rounded-2xl p-5 border theme-border">
                    <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User size={18} className="text-blue-400" /> {name}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Total Assigned', value: es.totalAssigned },
                        { label: 'Total Dispatched', value: es.totalDispatched },
                        { label: 'Pending', value: es.pending, color: 'text-amber-400' },
                        { label: 'Delivered', value: es.delivered, color: 'text-emerald-400' },
                        { label: 'Returned', value: es.returned, color: 'text-red-400' },
                        { label: 'Rejected', value: es.rejected, color: 'text-gray-400' },
                        { label: 'Avg Dispatch Time', value: es.averageDispatchTime, span: true },
                        { label: 'Last Dispatch', value: es.lastDispatch ? new Date(es.lastDispatch).toLocaleDateString() : 'N/A', span: true },
                      ].map(s => (
                        <div key={s.label} className={`theme-bg-subtle rounded-xl p-3 ${s.span ? 'col-span-2' : ''}`}>
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{s.label}</p>
                          <p className={`text-sm font-black ${s.color || 'theme-text-primary'}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {dashboardData.employeeMonthly?.[name]?.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Monthly Breakdown</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead><tr className="text-gray-500 font-black uppercase tracking-wider">
                              <th className="text-left py-1 pr-2">Month</th>
                              <th className="text-right px-1">Disp</th>
                              <th className="text-right px-1">Del</th>
                              <th className="text-right px-1">Ret</th>
                              <th className="text-right pl-1">Pend</th>
                            </tr></thead>
                            <tbody>
                              {dashboardData.employeeMonthly[name].map(m => (
                                <tr key={m.month} className="border-t border-gray-800">
                                  <td className="py-1 pr-2 font-bold theme-text-primary">{m.month}</td>
                                  <td className="text-right px-1 font-bold text-blue-400">{m.dispatches}</td>
                                  <td className="text-right px-1 font-bold text-emerald-400">{m.deliveries}</td>
                                  <td className="text-right px-1 font-bold text-red-400">{m.returns}</td>
                                  <td className="text-right pl-1 font-bold text-amber-400">{m.pending}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {dashboardData.monthlyReport?.length > 0 && (
              <div className="glass rounded-2xl p-5 border theme-border">
                <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-purple-400" /> Monthly Performance Report
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                      <th className="text-left py-2 pr-3">Month</th>
                      <th className="text-right px-2">Total</th>
                      <th className="text-right px-2">Delivered</th>
                      <th className="text-right px-2">Returned</th>
                      <th className="text-right px-2">Rejected</th>
                      <th className="text-right px-2">Pending</th>
                      <th className="text-right px-2">COD</th>
                      <th className="text-right pl-2">Paid</th>
                    </tr></thead>
                    <tbody>
                      {dashboardData.monthlyReport.map(m => (
                        <tr key={m.month} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-3 font-bold theme-text-primary">{m.month}</td>
                          <td className="text-right px-2 font-bold">{m.total}</td>
                          <td className="text-right px-2 font-bold text-emerald-400">{m.delivered}</td>
                          <td className="text-right px-2 font-bold text-red-400">{m.returned}</td>
                          <td className="text-right px-2 font-bold text-gray-400">{m.rejected}</td>
                          <td className="text-right px-2 font-bold text-amber-400">{m.pending}</td>
                          <td className="text-right px-2 font-bold text-purple-400">{m.cod}</td>
                          <td className="text-right pl-2 font-bold text-emerald-400">{m.paid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {dashboardData.trackingData?.length > 0 && (
              <div className="glass rounded-2xl p-5 border theme-border">
                <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" /> Dispatch Tracking
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                      <th className="text-left py-2 pr-2">Order#</th>
                      <th className="text-left px-2">Customer</th>
                      <th className="text-left px-2">City</th>
                      <th className="text-left px-2">Officer</th>
                      <th className="text-left px-2">Method</th>
                      <th className="text-left px-2">Status</th>
                      <th className="text-left pl-2">Dates</th>
                    </tr></thead>
                    <tbody>
                      {dashboardData.trackingData.slice(0, 50).map(t => (
                        <tr key={t.id} className="border-t border-gray-800 hover:bg-white/5">
                          <td className="py-2 pr-2 font-bold theme-text-primary">#{t.orderNumber || t.id.slice(0, 6)}</td>
                          <td className="px-2 font-bold">{t.customerName || '—'}</td>
                          <td className="px-2">{t.city || '—'}</td>
                          <td className="px-2 font-bold text-blue-400">{t.dispatchOfficer || '—'}</td>
                          <td className="px-2">{t.dispatchMethod}</td>
                          <td className="px-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              t.dispatchStatus === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                              t.dispatchStatus === 'RETURNED' || t.dispatchStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                              t.dispatchStatus === 'DISPATCHED' ? 'bg-indigo-500/20 text-indigo-400' :
                              t.dispatchStatus === 'BOOKED' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>{t.dispatchStatus || 'PENDING'}</span>
                          </td>
                          <td className="pl-2 text-[10px] text-gray-500">
                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                            {t.deliveredAt ? ` → ${new Date(t.deliveredAt).toLocaleDateString()}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Enamels Delivery Data */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Truck size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-black theme-text-primary uppercase tracking-tight">Enamels Delivery Data</h2>
              <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Real-time delivery tracking & earnings</p>
            </div>
          </div>
          <button onClick={() => { if (enamelsRefreshRef.current) clearInterval(enamelsRefreshRef.current); fetchEnamelsData(); enamelsRefreshRef.current = setInterval(fetchEnamelsData, 30000); }} disabled={enamelsLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
            {enamelsLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>

        {enamelsLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>
        ) : (
          <>
            {enamelsData.performance && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { label: 'Assigned Today', value: enamelsData.performance.assignedToday, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Delivered Today', value: enamelsData.performance.deliveredToday, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Delivered Week', value: enamelsData.performance.deliveredThisWeek, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  { label: 'Delivered Month', value: enamelsData.performance.deliveredThisMonth, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { label: 'All Time', value: enamelsData.performance.allTimeDelivered, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                ].map(c => (
                  <div key={c.label} className={`${c.bg} rounded-2xl p-3 border border-white/5 text-center`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{c.label}</p>
                    <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="glass rounded-2xl p-5 border theme-border">
              <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={18} className="text-emerald-400" /> Delivery Boy Earnings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="theme-bg-subtle rounded-xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Pending Charges</p>
                  <p className="text-2xl font-black text-emerald-400">₨{(enamelsData.charges?.totalPending || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-500 mt-1">{enamelsData.charges?.charges?.length || 0} pending deliveries</p>
                </div>
                <div className="theme-bg-subtle rounded-xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Total Paid</p>
                  <p className="text-2xl font-black text-blue-400">₨{(enamelsData.charges?.totalPaid || 0).toLocaleString()}</p>
                </div>
                <div className="theme-bg-subtle rounded-xl p-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Rate / Delivery</p>
                  <p className="text-2xl font-black text-amber-400">₨200</p>
                </div>
              </div>
              {enamelsData.charges?.totalPending > 0 && (
                <button onClick={() => {
                  if (!window.confirm(`Clear ₨${(enamelsData.charges.totalPending).toLocaleString()} for ${enamelsData.charges.charges.length} deliveries?`)) return;
                  setPayLoading(true);
                  api.post('/api/delivery/charges/clear').then(() => {
                    toast.success('Delivery charges cleared!');
                    fetchEnamelsData();
                  }).catch(err => toast.error('Failed: ' + (err.response?.data?.message || err.message)))
                  .finally(() => setPayLoading(false));
                }} disabled={payLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {payLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Pay ₨{(enamelsData.charges.totalPending).toLocaleString()} — Clear All Pending
                </button>
              )}
            </div>

            {enamelsData.charges?.payments?.length > 0 && (
              <div className="glass rounded-2xl p-5 border theme-border">
                <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity size={18} className="text-blue-400" /> Payment History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left px-2">Date</th>
                      <th className="text-right pl-2">Amount</th>
                    </tr></thead>
                    <tbody>
                      {enamelsData.charges.payments.map((p, i) => (
                        <tr key={p.id || i} className="border-t border-gray-800">
                          <td className="py-2 pr-3 font-bold theme-text-primary">{i + 1}</td>
                          <td className="px-2 font-bold">{new Date(p.paidAt).toLocaleDateString()}</td>
                          <td className="text-right pl-2 font-bold text-emerald-400">₨{(p.totalAmount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="glass rounded-2xl p-5 border theme-border">
              <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" /> Activity Timeline
              </h3>
              {enamelsData.deliveryOrders.length === 0 ? (
                <div className="text-center py-10"><p className="theme-text-muted font-black uppercase text-xs">No delivery orders found</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                      <th className="text-left py-2 pr-2">Order#</th>
                      <th className="text-left px-2">Customer</th>
                      <th className="text-left px-2">City</th>
                      <th className="text-left px-2">Attempts</th>
                      <th className="text-left px-2">Status</th>
                      <th className="text-left pl-2">Last Activity</th>
                    </tr></thead>
                    <tbody>
                      {enamelsData.deliveryOrders.slice(0, 50).map(order => {
                        const attempts = order.deliveryAttempts || [];
                        const latestAttempt = attempts[0];
                        const noRespCount = order.noResponseLogs?.length || 0;
                        return (
                          <tr key={order.id} className="border-t border-gray-800 hover:bg-white/5">
                            <td className="py-2 pr-2 font-bold theme-text-primary">#{order.orderNumber || order.id.slice(0, 6)}</td>
                            <td className="px-2 font-bold">{order.customerName || '—'}</td>
                            <td className="px-2">{order.city || '—'}</td>
                            <td className="px-2">
                              <span className="font-bold">{attempts.length}</span>
                              {noRespCount > 0 && <span className="text-[10px] text-amber-400 ml-1">({noRespCount} NR)</span>}
                            </td>
                            <td className="px-2">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                order.currentStage === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                                order.currentStage === 'OUT_FOR_DELIVERY' ? 'bg-indigo-500/20 text-indigo-400' :
                                'bg-amber-500/20 text-amber-400'
                              }`}>{order.currentStage?.replace(/_/g, ' ') || 'PENDING'}</span>
                            </td>
                            <td className="pl-2 text-[10px] text-gray-500">
                              {latestAttempt?.attemptedAt ? new Date(latestAttempt.attemptedAt).toLocaleString() : order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enamelsData.codSummary && (
                <div className="glass rounded-2xl p-5 border theme-border">
                  <h3 className="text-lg font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Package size={18} className="text-purple-400" /> COD Collection Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="theme-bg-subtle rounded-xl p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Today COD</p>
                      <p className="text-xl font-black text-emerald-400">₨{(enamelsData.codSummary.todayCODAmount || 0).toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-500">{enamelsData.codSummary.todayCODOrders || 0} orders</p>
                    </div>
                    <div className="theme-bg-subtle rounded-xl p-3 text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pending COD</p>
                      <p className="text-xl font-black text-amber-400">₨{(enamelsData.codSummary.pendingCODAmount || 0).toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-500">{enamelsData.codSummary.pendingCODOrders || 0} orders</p>
                    </div>
                  </div>
                  {enamelsData.codSummary.pendingDeliveries?.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                          <th className="text-left py-1 pr-2">Order#</th>
                          <th className="text-left px-2">Customer</th>
                          <th className="text-right pl-2">Amount</th>
                        </tr></thead>
                        <tbody>
                          {enamelsData.codSummary.pendingDeliveries.slice(0, 20).map(o => {
                            const remaining = isPaidOrder(o) ? 0 : getCodAmount(o);
                            return (
                              <tr key={o.id} className="border-t border-gray-800">
                                <td className="py-1 pr-2 font-bold theme-text-primary">#{o.orderNumber || o.id.slice(0, 6)}</td>
                                <td className="px-2 font-bold">{o.customerName || '—'}</td>
                                <td className="text-right pl-2 font-bold text-amber-400">₨{remaining.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DispatchDashboard;
