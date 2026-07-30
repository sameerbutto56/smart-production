import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName, translateGender } from '../utils/urduDictionary';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import { printDispatchSheet } from '../utils/printReport';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';
import { Truck, Package, Eye, Send, Search, Loader2, Clock, Phone, MapPin, CheckCircle2, X, Printer, LogIn, User, MessageCircle, TrendingUp, Activity, UserCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const EMPLOYEES = {
  Khawar: { password: 'K170', label: 'Khawar', desc: 'Lahore Orders' },
  Faisal: { password: 'F170', label: 'Faisal', desc: 'All Cities + Forwarded' }
};

const KHAWAR_OPTIONS = [
  { id: 'ENAMELS', label: 'Enamels Delivery (BHC)', type: 'dispatch', desc: 'Assign to Enamels delivery team' },
  { id: 'TCS', label: 'TCS', type: 'courier', desc: 'Book TCS courier' },
  { id: 'POST_EX', label: 'PostEx', type: 'courier', desc: 'Book PostEx courier' },
  { id: 'CUSTOMER_TAKEAWAY', label: 'Customer Takeaway', type: 'walkin', desc: 'Customer picks up directly' }
];

const FAISAL_OPTIONS = [
  { id: 'ENAMELS', label: 'Enamels Delivery (BHC)', type: 'dispatch', desc: 'Assign to Enamels delivery team' },
  { id: 'TCS', label: 'TCS', type: 'courier', desc: 'Book TCS courier' },
  { id: 'POST_EX', label: 'PostEx', type: 'courier', desc: 'Book PostEx courier' },
  { id: 'CUSTOMER_TAKEAWAY', label: 'Customer Takeaway', type: 'walkin', desc: 'Customer picks up directly' }
];

const DISPATCH_OPTIONS = [
  { id: 'ENAMELS', label: 'Enamels Delivery', type: 'dispatch', desc: 'Assign to Enamels delivery team' },
  { id: 'TCS', label: 'TCS', type: 'courier', desc: 'Book TCS courier' },
  { id: 'POST_EX', label: 'PostEx', type: 'courier', desc: 'Book PostEx courier' },
  { id: 'WALK_IN', label: 'Received by Customer', type: 'walkin', desc: 'Mark delivered directly' },
  { id: 'OTHER', label: 'Other', type: 'courier', desc: 'Other courier service' },
];

const PRIORITY_BADGE = {
  SUPER_URGENT: { bg: 'bg-red-600', text: 'text-white', label: 'SUPER URGENT' },
  URGENT: { bg: 'bg-amber-500', text: 'text-white', label: 'URGENT' },
  NORMAL: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'NORMAL' }
};

const DispatchPage = () => {
  const { user } = useAuth();
  const { isUrdu } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDispatchRole = ['DISPATCH', 'MAIN_EMPLOYEE'].includes(user?.role || '');
  const isOutlet = user?.role === 'OUTLET';
  const isDispatchAdmin = ['SUPER_ADMIN', 'FAISAL', 'ADMIN'].includes(user?.role || '');

  const [employeeName, setEmployeeName] = useState(() => sessionStorage.getItem('dispatchEmployee') || '');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => !!sessionStorage.getItem('dispatchEmployee'));
  const [loginLoading, setLoginLoading] = useState(false);

  const isKhawar = employeeName === 'Khawar';
  const isFaisal = employeeName === 'Faisal';
  const dispatchOptions = isKhawar ? KHAWAR_OPTIONS : (isFaisal ? FAISAL_OPTIONS : DISPATCH_OPTIONS);

  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || sessionStorage.getItem('dispatchActiveTab') || 'unseen');
  const [search, setSearch] = useState(() => sessionStorage.getItem('dispatchSearch') || '');

  const [methodFilter, setMethodFilter] = useState(() => sessionStorage.getItem('dispatchMethodFilter') || '');
  const [bookModal, setBookModal] = useState(null);
  const [requestModal, setRequestModal] = useState(null);
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedOption, setSelectedOption] = useState(dispatchOptions[0] || DISPATCH_OPTIONS[0]);
  const [otherCourierName, setOtherCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [stats, setStats] = useState(null);
  const queueRefreshRef = useRef(null);

  const [data, setData] = useState({ unseen: [], seen: [], active: [], allOrders: [], counts: { unseen: 0, seen: 0, active: 0 } });
  const [loading, setLoading] = useState(false);

  const dataUrl = loggedIn && (isKhawar || isFaisal)
    ? `/api/dispatch-profile/orders?employeeName=${employeeName}`
    : '/api/dispatch/dashboard';

  const doRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(dataUrl).then(r => r.data);
      setData({
        unseen: res?.unseen || [],
        seen: res?.seen || [],
        active: res?.active || [],
        allOrders: res?.allOrders || res?.active || [],
        counts: res?.counts || { unseen: 0, seen: 0, active: 0 }
      });
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [dataUrl, loggedIn, isKhawar, isFaisal]);

  const fetchStats = useCallback(async () => {
    if (!loggedIn || !employeeName) return;
    try {
      const res = await api.get(`/api/dispatch-profile/stats?employeeName=${employeeName}`);
      setStats(res.data);
    } catch (err) {
      console.error('Stats fetch failed:', err);
    }
  }, [loggedIn, employeeName]);

  const prevTabRef = useRef(searchParams.get('tab'));
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    const prevTab = prevTabRef.current;
    prevTabRef.current = currentTab;
    if (currentTab !== prevTab) {
      setActiveTab(currentTab || 'unseen');
    }
  }, [searchParams]);

  useEffect(() => { if (loggedIn) sessionStorage.setItem('dispatchActiveTab', activeTab); }, [activeTab, loggedIn]);
  useEffect(() => { if (loggedIn) sessionStorage.setItem('dispatchSearch', search); }, [search, loggedIn]);

  useEffect(() => { if (loggedIn) sessionStorage.setItem('dispatchMethodFilter', methodFilter); }, [methodFilter, loggedIn]);

  useEffect(() => {
    doRefresh();
    if (loggedIn && (isKhawar || isFaisal)) fetchStats();
  }, [loggedIn, employeeName, doRefresh, fetchStats, isKhawar, isFaisal]);

  useEffect(() => {
    const handleStageAccepted = () => {
      if (queueRefreshRef.current) clearTimeout(queueRefreshRef.current);
      queueRefreshRef.current = setTimeout(doRefresh, 500);
    };
    const debouncedRefresh = debounce(doRefresh, 300);
    socket.on('stage-accepted', handleStageAccepted);
    socket.on('dispatch-request', debouncedRefresh);
    socket.on('order-updated', debouncedRefresh);
    return () => {
      socket.off('stage-accepted', handleStageAccepted);
      socket.off('dispatch-request', debouncedRefresh);
      socket.off('order-updated', debouncedRefresh);
    };
  }, [doRefresh]);

  useEffect(() => {
    setSelectedOption(dispatchOptions[0] || DISPATCH_OPTIONS[0]);
  }, [employeeName, dispatchOptions]);

  const handleLogin = () => {
    const emp = EMPLOYEES[employeeName];
    if (!emp) { toast.error('Please select an employee'); return; }
    if (password !== emp.password) { toast.error('Invalid password'); return; }
    setLoginLoading(true);
    setTimeout(() => {
      setLoggedIn(true);
      setPassword('');
      sessionStorage.setItem('dispatchEmployee', employeeName);
      toast.success(`Logged in as ${employeeName}`);
      setLoginLoading(false);
    }, 400);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setEmployeeName('');
    setPassword('');
    sessionStorage.removeItem('dispatchEmployee');
    sessionStorage.removeItem('dispatchActiveTab');
    sessionStorage.removeItem('dispatchSearch');
    sessionStorage.removeItem('dispatchCityFilter');
    sessionStorage.removeItem('dispatchMethodFilter');
    setData({ unseen: [], seen: [], active: [], allOrders: [], counts: { unseen: 0, seen: 0, active: 0, all: 0 } });
    setStats(null);
  };

  const handleAcceptTask = async (orderId) => {
    setAcceptLoading(orderId);
    try {
      if (loggedIn && (isKhawar || isFaisal)) {
        await api.post(`/api/dispatch-profile/${orderId}/accept`, { employeeName });
      } else {
        await api.post(`/api/orders/${orderId}/accept-task`, {});
      }
      toast.success('Task accepted!');
      doRefresh();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleDispatch = async (orderId) => {
    const option = selectedOption;
    setSubmitting(true);
    try {
      if (loggedIn && (isKhawar || isFaisal)) {
        await api.post(`/api/dispatch-profile/${orderId}/dispatch`, {
          employeeName,
          dispatchMethod: option.id,
          trackingUrl: trackingNumber || undefined
        });
      } else if (option.id === 'WALK_IN') {
        await api.put(`/api/dispatch/${orderId}/status`, { status: 'DELIVERED', deliveredAt: new Date().toISOString() });
      } else {
        const name = option.id === 'OTHER' ? otherCourierName.trim() : option.label;
        await api.post(`/api/dispatch/${orderId}/book`, { courierName: name, trackingNumber, estimatedDelivery: estimatedDelivery || null });
      }
      setBookModal(null);
      setTrackingNumber('');
      setEstimatedDelivery('');
      setOtherCourierName('');
      setSelectedOption(dispatchOptions[0] || DISPATCH_OPTIONS[0]);
      toast.success(`Dispatched via ${option.label}`);
      doRefresh();
      if (loggedIn && (isKhawar || isFaisal)) fetchStats();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const handleRequestCourier = async (orderId) => {
    if (!deliveryMethod.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/dispatch/${orderId}/book`, { courier: deliveryMethod });
      setRequestModal(null);
      setDeliveryMethod('');
      setDestinationCity('');
      setNotes('');
      toast.success('Courier dispatch requested!');
      doRefresh();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (orderId, dispatchStatus) => {
    setStatusLoading(orderId);
    try {
      await api.put(`/api/dispatch/${orderId}/status`, { dispatchStatus });
      toast.success(`Order ${dispatchStatus === 'DELIVERED' ? 'Delivered' : dispatchStatus === 'RETURNED' ? 'Returned' : `marked ${dispatchStatus}`}`);
      doRefresh();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setStatusLoading(null);
    }
  };

  const handleMarkPickedUp = async (orderId) => {
    setStatusLoading(orderId);
    try {
      await api.put(`/api/dispatch/${orderId}/pickup`, {});
      toast.success('Order marked as picked up!');
      doRefresh();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setStatusLoading(null);
    }
  };

  const toggleExpand = (orderId) => setExpandedOrderId(prev => prev === orderId ? null : orderId);

  const parseJSON = (data) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return {}; }
  };

  const printDispatchSheetWithOfficer = async (order) => {
    const title = 'Dispatch Sheet — ' + (order.orderNumber || order.id?.slice(0, 8));
    const officerName = loggedIn && (isKhawar || isFaisal) ? employeeName : '';
    let logoUrl = window.location.origin + '/logo.png';
    try {
      const logoResp = await fetch(logoUrl);
      const logoBlob = await logoResp.blob();
      logoUrl = URL.createObjectURL(logoBlob);
    } catch {}
    const iframe = document.createElement('iframe');
    iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.position = 'absolute'; iframe.style.left = '0'; iframe.style.top = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    const PRINT_CSS = `@page{margin:6mm}body{font-family:sans-serif;color:#000;padding:6px;font-size:11px}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:3px 5px;border:1px solid #000;text-align:left}th{background:#f3f4f6;font-size:10px;font-weight:900;text-transform:uppercase}td{font-size:11px}`;
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
    doc.write(`<div style="text-align:center;margin-bottom:4px;padding-bottom:4px;border-bottom:3px solid #000">`);
    doc.write(`<img src="${logoUrl}" alt="ENAMELS" style="height:50px;margin-bottom:2px;"><p style="font-size:12px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:2px;margin:0">DISPATCH SHEET</p></div>`);
    if (officerName) {
      doc.write(`<div style="text-align:center;margin-bottom:4px">`);
      doc.write(`<span style="font-size:13px;font-weight:900;color:#1d4ed8;background:#dbeafe;display:inline-block;padding:3px 12px">Dispatch Officer: ${officerName}</span></div>`);
    }
    doc.write(`<div style="text-align:center;margin-bottom:4px">`);
    doc.write(`<h2 style="font-size:18px;font-weight:900;text-transform:uppercase;color:#000;letter-spacing:1px;margin:0">Order #${order.orderNumber || order.id?.slice(0, 8)}</h2></div>`);
    doc.write(`<div style="border:1.5px solid #000;padding:5px 8px;margin-bottom:4px">`);
    doc.write(`<p style="font-size:14px;font-weight:900;color:#000;margin:0 0 2px">${order.customerName || '—'}</p>`);
    doc.write(`<p style="font-size:12px;font-weight:600;color:#000;margin:0 0 1px">${order.customerPhone || ''}</p>`);
    if (order.address) doc.write(`<p style="font-size:11px;color:#000;margin:0 0 1px">${order.address}</p>`);
    if (order.city) doc.write(`<span style="font-size:13px;font-weight:900;color:#000;background:#fef3c7;display:inline-block;padding:2px 8px;margin-top:2px;text-transform:uppercase">CITY: ${order.city}</span>`);
    doc.write(`</div>`);
    doc.write(`<div style="font-size:12px;font-weight:900;text-transform:uppercase;margin:4px 0 2px;padding-bottom:2px;border-bottom:2px solid #000">Products</div>`);
    const rawPd = parseJSON(order.productDetails);
    const allItems = Array.isArray(rawPd) ? rawPd : null;
    const firstProduct = allItems ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
    if (allItems && allItems.length > 0) {
      doc.write(`<table><thead><tr><th>#</th><th>Product</th><th>Color / Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>`);
      allItems.forEach((item, idx) => {
        const p = item.productDetails || item || {};
        const pName = p.productType || p.name || '—';
        const pColor = isUrdu ? toUrduName(p.color) : p.color;
        doc.write(`<tr><td style="font-weight:700">${idx + 1}</td><td style="font-weight:700">${pName}</td><td>${[p.fabricType, pColor, p.size, translateGender(p.gender, isUrdu)].filter(Boolean).join(' • ') || '—'}</td><td style="text-align:center;font-weight:700">${item.quantity || 1}</td><td style="text-align:right;font-weight:700">₨${parseFloat(item.totalPrice || 0).toLocaleString()}</td></tr>`);
      });
      doc.write(`</tbody></table>`);
    } else {
      const fpName = firstProduct.productType || firstProduct.name || '—';
      const fpColor = isUrdu ? toUrduName(firstProduct.color) : firstProduct.color;
      doc.write(`<div style="padding:4px 6px;margin-bottom:4px"><p style="font-size:12px;font-weight:900;margin:0">${fpName}</p><p style="font-size:11px;margin:0">${[firstProduct.fabricType, fpColor, firstProduct.size, translateGender(firstProduct.gender, isUrdu)].filter(Boolean).join(' • ') || '—'}</p><p style="font-size:11px;font-weight:700;margin:2px 0 0">Qty: 1 | ₨${parseFloat(order.totalPrice || 0).toLocaleString()}</p></div>`);
    }
    if (officerName) {
      doc.write(`<div style="margin-top:6px;border-top:2px solid #000;padding-top:4px;text-align:center">`);
      doc.write(`<p style="font-size:10px;font-weight:700;margin:0 0 1px">Dispatch Officer: ${officerName} | ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>`);
      doc.write(`<div style="display:flex;justify-content:space-between;margin-top:10px">`);
      doc.write(`<div style="text-align:center"><div style="width:150px;border-top:1.5px solid #000;margin:0 auto 2px"></div><span style="font-size:10px;font-weight:700">Dispatch Officer Signature</span></div>`);
      doc.write(`<div style="text-align:center"><div style="width:150px;border-top:1.5px solid #000;margin:0 auto 2px"></div><span style="font-size:10px;font-weight:700">Receiver Signature</span></div>`);
      doc.write(`</div></div>`);
    }
    doc.write(getPrintFooterHTML());
    doc.write(`</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe); if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }, 1000); }, 300);
  };

  const getFiltered = (items) => {
    let list = items;
    const q = search.toLowerCase();
    if (q) list = list.filter(o => o.customerName?.toLowerCase().includes(q) || (o.orderNumber || '').toLowerCase().includes(q) || o.outletName?.toLowerCase().includes(q) || o.city?.toLowerCase().includes(q));
    if (methodFilter) list = list.filter(o => (o.deliveryMethod || '').toLowerCase().includes(methodFilter.toLowerCase()));
    return list;
  };

  const tabs = [
    { id: 'unseen', label: 'Unseen Tasks', icon: Eye, count: data.counts.unseen },
    { id: 'seen', label: 'Seen Tasks', icon: UserCheck, count: data.counts.seen },
    { id: 'active', label: 'Active Tasks', icon: Package, count: data.counts.active }
  ];

  if (!loggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass max-w-md w-full p-8 rounded-[3rem] border-2 theme-border shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Truck className="text-blue-400" size={32} />
            </div>
            <h1 className="text-3xl font-black theme-text-primary uppercase tracking-tight">Dispatch Profile</h1>
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
            <p className="text-xs font-bold theme-text-muted text-center">Secure dispatch profile access</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading && !data.unseen.length && !data.active.length && !data.allOrders.length) {
    return <PageLoader text="Loading Dispatch..." />;
  }

  const isEmployeeMode = loggedIn && (isKhawar || isFaisal);

  return (
    <div className="space-y-4 md:space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${isOutlet ? 'bg-blue-500/10' : isEmployeeMode ? 'bg-emerald-500/10' : 'bg-purple-500/10'}`}>
            <Truck className={`${isOutlet ? 'text-blue-400' : isEmployeeMode ? 'text-emerald-400' : 'text-purple-400'}`} size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tight">
              {isEmployeeMode ? `${employeeName}'s Dispatch` : (isOutlet ? 'Outlet Dispatch' : 'Dispatch Center')}
            </h1>
            <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">
              {isEmployeeMode ? (isKhawar ? 'Lahore Orders Only' : 'All Cities + Forwarded') : 'Task processing'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEmployeeMode && (
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

      <div className="flex gap-1 theme-bg-subtle p-1 rounded-2xl border theme-border mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(''); setMethodFilter(''); }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all relative ${
                  activeTab === tab.id
                    ? (isEmployeeMode ? 'bg-emerald-600 text-white shadow-lg' : 'bg-purple-600 text-white shadow-lg')
                    : 'theme-text-muted hover:text-gray-300'
                }`}>
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    activeTab === tab.id ? 'bg-white text-purple-700' : 'bg-purple-500/20 text-purple-400'
                  }`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
            <input type="text" placeholder="Search by order #, customer, or outlet..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full theme-input border-2 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-purple-500 transition-all text-sm font-bold" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}
              className="theme-input rounded-xl py-2.5 px-3 text-xs font-black uppercase tracking-wider border-2">
              <option value="">All Methods</option>
              <option value="courier">Courier</option>
              <option value="pickup">Pickup</option>
            </select>
          </div>
        </div>

      {activeTab === 'unseen' && (
        <>
          {getFiltered(data.unseen).length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Eye className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Unseen Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">All dispatch orders have been accepted. Great work!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {getFiltered(data.unseen).map(order => (
                <motion.div key={order.id} layout
                  className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).bg} ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).text}`}>{(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).label}</span>
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'ONLINE' : order.source}</span>
                        {order.outletName && <span className="text-xs md:text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{order.outletName}</span>}
                        {order.forwardedBy === 'Khawar' && <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">FORWARDED BY KHAWAR</span>}
                        {order.dispatchOfficer && <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">ASSIGNED: {order.dispatchOfficer}</span>}
                      </div>
                      <h3 className="font-black text-xl theme-text-primary truncate">#{order.orderNumber || order.id.substring(0, 8)} — {order.customerName}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm theme-text-secondary font-bold">
                        <span className="flex items-center gap-1"><Phone size={12} />{order.customerPhone || 'N/A'}</span>
                        {order.city && <span className="flex items-center gap-1"><MapPin size={12} />{order.city}</span>}
                        <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); printDispatchSheetWithOfficer(order); }}
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all"><Printer size={16} /></button>
                      <button onClick={() => handleAcceptTask(order.id)}
                        disabled={acceptLoading === order.id}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                        {acceptLoading === order.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        ACCEPT
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'seen' && (
        <>
          {getFiltered(data.seen).length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <UserCheck className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Seen Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">Accepted orders awaiting dispatch will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {getFiltered(data.seen).map(order => (
                <motion.div key={order.id} layout
                  className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).bg} ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).text}`}>{(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).label}</span>
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'ONLINE' : order.source}</span>
                        {order.outletName && <span className="text-xs md:text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{order.outletName}</span>}
                        {order.forwardedBy === 'Khawar' && <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">FORWARDED BY KHAWAR</span>}
                        {order.dispatchOfficer && <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">ASSIGNED: {order.dispatchOfficer}</span>}
                      </div>
                      <h3 className="font-black text-xl theme-text-primary truncate">#{order.orderNumber || order.id.substring(0, 8)} — {order.customerName}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm theme-text-secondary font-bold">
                        <span className="flex items-center gap-1"><Phone size={12} />{order.customerPhone || 'N/A'}</span>
                        {order.city && <span className="flex items-center gap-1"><MapPin size={12} />{order.city}</span>}
                        <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); printDispatchSheetWithOfficer(order); }}
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all"><Printer size={16} /></button>
                      <button onClick={() => { setBookModal(order); setSelectedOption(dispatchOptions[0] || DISPATCH_OPTIONS[0]); setTrackingNumber(''); }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
                        <Send size={14} /> Dispatch
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'active' && (
        <>
          {getFiltered(data.active).length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Package className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Active Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">Dispatched orders being tracked will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {getFiltered(data.active).map(order => (
                <motion.div key={order.id} layout
                  className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).bg} ${(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).text}`}>{(PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL).label}</span>
                        <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'ONLINE' : order.source}</span>
                        {order.outletName && <span className="text-xs md:text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{order.outletName}</span>}
                        {order.forwardedBy === 'Khawar' && <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">FORWARDED BY KHAWAR</span>}
                      </div>
                      <h3 className="font-black text-xl theme-text-primary truncate">#{order.orderNumber || order.id.substring(0, 8)} — {order.customerName}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm theme-text-secondary font-bold">
                        <span className="flex items-center gap-1"><Phone size={12} />{order.customerPhone || 'N/A'}</span>
                        {order.city && <span className="flex items-center gap-1"><MapPin size={12} />{order.city}</span>}
                        <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); printDispatchSheetWithOfficer(order); }}
                        className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all"><Printer size={16} /></button>
                      {(isEmployeeMode && (isFaisal || isKhawar)) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {order.dispatchStatus === 'DELIVERED' ? (
                            <span className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={14} /> Delivered</span>
                          ) : order.dispatchStatus === 'RETURNED' || order.dispatchStatus === 'REJECTED' ? (
                            <span className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><X size={14} /> {order.dispatchStatus}</span>
                          ) : (
                            <>
                              {order.dispatchStatus === 'BOOKED' && (
                                <button onClick={() => handleUpdateStatus(order.id, 'DISPATCHED')} disabled={statusLoading === order.id}
                                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                                  {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Dispatched'}
                                </button>
                              )}
                              {order.dispatchStatus === 'DISPATCHED' && (
                                <button onClick={() => handleUpdateStatus(order.id, 'IN_TRANSIT')} disabled={statusLoading === order.id}
                                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                                  {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'In Transit'}
                                </button>
                              )}
                              <button onClick={() => handleUpdateStatus(order.id, 'DELIVERED')} disabled={statusLoading === order.id}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                                {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Deliver ✓'}
                              </button>
                              <button onClick={() => { if (window.confirm('Return this order?')) handleUpdateStatus(order.id, 'RETURNED') }} disabled={statusLoading === order.id}
                                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                                {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Return ✗'}
                              </button>
                              <button onClick={() => { if (window.confirm('Reject this order?')) handleUpdateStatus(order.id, 'REJECTED') }} disabled={statusLoading === order.id}
                                className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">
                                {statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Reject'}
                              </button>
                            </>
                          )}
                        </div>
                      ) : isEmployeeMode ? (
                        <button onClick={() => { setBookModal(order); setSelectedOption(dispatchOptions[0] || DISPATCH_OPTIONS[0]); setTrackingNumber(''); }}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
                          <Send size={14} /> Dispatch
                        </button>
                      ) : isOutlet ? (
                        !order.dispatchStatus || order.dispatchStatus === 'PENDING' ? (
                          <button onClick={() => setRequestModal(order)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5"><Send size={14} /> Request Courier</button>
                        ) : (
                          <span className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider ${order.dispatchStatus === 'COURIER_REQUIRED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : order.dispatchStatus === 'BOOKED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : order.dispatchStatus === 'DISPATCHED' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : order.dispatchStatus === 'IN_TRANSIT' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>{order.dispatchStatus?.replace(/_/g, ' ')}</span>
                        )
                      ) : (
                        <>
                          {(() => {
                            const isPickup = order.deliveryType === 'PICKUP';
                            const isPickedUp = order.dispatchStatus === 'PICKED_UP' || order.currentStage === 'COMPLETED';
                            const canMarkPickup = isPickup && !isPickedUp;
                            if (isPickedUp) {
                              return <span className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={14} /> Picked Up</span>;
                            }
                            if (order.dispatchStatus === 'RETURNED') {
                              return <span className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">RETURNED</span>;
                            }
                            if (order.currentStage === 'COMPLETED' || order.dispatchStatus === 'DELIVERED') {
                              return <span className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 size={14} /> DELIVERED</span>;
                            }
                            if (!order.dispatchStatus || order.dispatchStatus === 'PENDING' || order.dispatchStatus === 'COURIER_REQUIRED') {
                              return (
                                <button onClick={() => setBookModal(order)} disabled={statusLoading === order.id}
                                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                                  {statusLoading === order.id ? <LoadingSpinner size={12} /> : <><Truck size={14} /> Dispatch</>}
                                </button>
                              );
                            }
                            return (
                              <div className="flex flex-wrap gap-1.5">
                                {order.dispatchStatus === 'BOOKED' && <button onClick={() => handleUpdateStatus(order.id, 'DISPATCHED')} disabled={statusLoading === order.id} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">{statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Mark Dispatched'}</button>}
                                {order.dispatchStatus === 'DISPATCHED' && <button onClick={() => handleUpdateStatus(order.id, 'IN_TRANSIT')} disabled={statusLoading === order.id} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">{statusLoading === order.id ? <LoadingSpinner size={12} /> : 'In Transit'}</button>}
                                <button onClick={() => handleUpdateStatus(order.id, 'DELIVERED')} disabled={statusLoading === order.id} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">{statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Deliver ✓'}</button>
                                <button onClick={() => { if (window.confirm('Return this order?')) handleUpdateStatus(order.id, 'RETURNED') }} disabled={statusLoading === order.id} className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50">{statusLoading === order.id ? <LoadingSpinner size={12} /> : 'Return ✗'}</button>
                                {canMarkPickup && <button onClick={() => { if (window.confirm(`Confirm pickup for Order #${order.orderNumber || order.id.substring(0, 8)}?`)) handleMarkPickedUp(order.id); }} disabled={statusLoading === order.id} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"><CheckCircle2 size={14} /> Pickup</button>}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}



      <AnimatePresence>
        {bookModal && isEmployeeMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Dispatch Order</h2>
              <p className="theme-text-secondary text-xs font-bold mb-1">Order #{bookModal?.orderNumber || bookModal?.id?.substring(0, 8)} — {bookModal?.customerName}</p>
              <p className="theme-text-muted text-xs font-bold mb-4">City: {bookModal?.city || 'N/A'} | Dispatch Officer: {employeeName}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Dispatch Method</label>
                  <div className="grid grid-cols-1 gap-2">
                    {dispatchOptions.map(m => (
                      <button key={m.id} onClick={() => setSelectedOption(m)}
                        className={`py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border-2 text-left flex items-center gap-2 ${
                          selectedOption?.id === m.id ? 'border-emerald-500 bg-emerald-600 text-white' : 'theme-border theme-bg theme-text-muted hover:border-gray-500'
                        }`}>
                        <div className={`w-3 h-3 rounded-full ${m.id === 'ENAMELS' ? 'bg-emerald-500' : m.id === 'TCS' ? 'bg-purple-500' : m.id === 'POST_EX' ? 'bg-indigo-500' : 'bg-emerald-500'} ${selectedOption?.id === m.id ? 'opacity-100' : 'opacity-50'}`} />
                        <div><p>{m.label}</p><p className="text-[10px] font-bold opacity-60">{m.desc}</p></div>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedOption && selectedOption.type !== 'walkin' && (
                  <div>
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking URL / Number (optional)</label>
                    <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-black"
                      placeholder="Enter tracking URL or number..." />
                  </div>
                )}
                {selectedOption?.id === 'CUSTOMER_TAKEAWAY' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs md:text-sm font-black text-emerald-400">Order will be marked as received by customer directly.</p>
                  </div>
                )}
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setBookModal(null); setTrackingNumber(''); }}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleDispatch(bookModal.id)}
                  disabled={!selectedOption || submitting}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  {selectedOption ? `Dispatch via ${selectedOption.label}` : 'Select Method'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {bookModal && !isEmployeeMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Dispatch Order</h2>
              <p className="theme-text-secondary text-xs font-bold mb-6">Order #{bookModal?.orderNumber || bookModal?.id?.substring(0, 8)} — {bookModal?.customerName}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Dispatch Method</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DISPATCH_OPTIONS.map(o => (
                      <button key={o.id} onClick={() => { setSelectedOption(o); setTrackingNumber(''); setOtherCourierName(''); }}
                        className={`py-3 px-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border-2 ${selectedOption.id === o.id ? 'border-purple-500 bg-purple-600 text-white' : 'theme-border theme-bg theme-text-muted'}`} title={o.desc}>{o.label}</button>
                    ))}
                  </div>
                </div>
                {selectedOption.type === 'courier' && (
                  <>
                    <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking Number</label><input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black" placeholder="Enter tracking number..." /></div>
                    <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Estimated Delivery Date (optional)</label><input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black" /></div>
                    {selectedOption.id === 'OTHER' && <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Courier Name</label><input type="text" value={otherCourierName} onChange={(e) => setOtherCourierName(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black" placeholder="Enter courier name..." /></div>}
                  </>
                )}
                {selectedOption.type === 'dispatch' && <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking URL (optional)</label><input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-purple-500 outline-none font-black" placeholder="Enter tracking URL or number..." /></div>}
                {selectedOption.type === 'walkin' && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center"><p className="text-xs md:text-sm font-black text-emerald-400">Order will be marked as received by customer directly.</p></div>}
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setBookModal(null); setTrackingNumber(''); setEstimatedDelivery(''); setOtherCourierName(''); setSelectedOption(DISPATCH_OPTIONS[0]); }} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleDispatch(bookModal.id)} disabled={submitting || (selectedOption.id === 'OTHER' && !otherCourierName.trim())} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                  {selectedOption.id === 'WALK_IN' ? 'Confirm Received' : selectedOption.id === 'ENAMELS' ? 'Assign Delivery' : 'Book Courier'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {requestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Request Courier</h2>
              <p className="theme-text-secondary text-xs font-bold mb-2">Order #{requestModal?.orderNumber || requestModal?.id?.substring(0, 8)} — {requestModal?.customerName}</p>
              <p className="theme-text-muted text-xs md:text-sm font-bold mb-6">This request will be sent to the Central Dispatch Department for processing.</p>
              <div className="space-y-4">
                <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Delivery Method *</label><input type="text" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black" placeholder="e.g. TCS, Leopards, Own Delivery..." /></div>
                <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Destination City</label><input type="text" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black" placeholder="City name..." /></div>
                <div><label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Notes (optional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black resize-none" rows={3} placeholder="Any special instructions..." /></div>
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setRequestModal(null); setDeliveryMethod(''); setDestinationCity(''); setNotes(''); }} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={() => handleRequestCourier(requestModal.id)} disabled={submitting || !deliveryMethod.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Request Courier
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DispatchPage;
