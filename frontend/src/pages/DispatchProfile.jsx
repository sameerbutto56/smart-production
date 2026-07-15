import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PageLoader, LoadingSpinner } from '../components/LoadingSpinner';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import { Truck, Eye, Send, Search, Loader2, Clock, Phone, MapPin, ExternalLink, CheckCircle2, X, Printer, UserCheck, LogIn, Package, BarChart3, User } from 'lucide-react';

const EMPLOYEES = {
  Khawar: { password: 'K-1-7-0', label: 'Khawar', desc: 'Lahore Dispatch — Enamel Delivery / Forward to Faisal' },
  Faisal: { password: 'F-1-7-0', label: 'Faisal', desc: 'All Cities Dispatch — TCS / Post / Customer Takeaway' }
};

const PRIORITY_BADGE = {
  SUPER_URGENT: { bg: 'bg-red-600', text: 'text-white', label: 'SUPER URGENT' },
  URGENT: { bg: 'bg-amber-500', text: 'text-white', label: 'URGENT' },
  NORMAL: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'NORMAL' }
};

const KHAWAR_METHODS = [
  { id: 'ENAMELS', label: 'Enamel Delivery', desc: 'Send via Enamels delivery team', color: 'bg-emerald-600' },
  { id: 'FORWARD_TO_FAISAL', label: 'Faisal Dispatch', desc: 'Forward to Faisal for TCS/Post/Takeaway', color: 'bg-blue-600' }
];

const FAISAL_METHODS = [
  { id: 'TCS', label: 'TCS', desc: 'Book TCS courier', color: 'bg-purple-600' },
  { id: 'POST', label: 'Post', desc: 'Book Post courier', color: 'bg-indigo-600' },
  { id: 'CUSTOMER_TAKEAWAY', label: 'Customer Takeaway', desc: 'Customer picks up directly', color: 'bg-emerald-600' }
];

const DispatchProfile = () => {
  const [employeeName, setEmployeeName] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState({ unseen: [], active: [], counts: { unseen: 0, active: 0 } });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('unseen');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [acceptLoading, setAcceptLoading] = useState(null);
  const [dispatchLoading, setDispatchLoading] = useState(null);
  const [dispatchModal, setDispatchModal] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const queueRefreshRef = useRef(null);

  const doRefresh = useCallback(async () => {
    if (!loggedIn || !employeeName) return;
    setOrdersLoading(true);
    try {
      const res = await api.get(`/api/dispatch-profile/orders?employeeName=${employeeName}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [loggedIn, employeeName]);

  const fetchStats = useCallback(async () => {
    if (!loggedIn || !employeeName) return;
    setStatsLoading(true);
    try {
      const res = await api.get(`/api/dispatch-profile/stats?employeeName=${employeeName}`);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [loggedIn, employeeName]);

  useEffect(() => {
    if (loggedIn) {
      doRefresh();
      fetchStats();
    }
  }, [loggedIn, doRefresh, fetchStats]);

  useEffect(() => {
    if (!loggedIn) return;
    const interval = setInterval(doRefresh, 15000);
    return () => clearInterval(interval);
  }, [loggedIn, doRefresh]);

  useEffect(() => {
    if (!loggedIn) return;
    const handleUpdate = () => {
      if (queueRefreshRef.current) clearTimeout(queueRefreshRef.current);
      queueRefreshRef.current = setTimeout(doRefresh, 500);
    };
    const debouncedRefresh = debounce(doRefresh, 300);
    socket.on('stage-accepted', handleUpdate);
    socket.on('dispatch-request', debouncedRefresh);
    socket.on('order-updated', debouncedRefresh);
    return () => {
      socket.off('stage-accepted', handleUpdate);
      socket.off('dispatch-request', debouncedRefresh);
      socket.off('order-updated', debouncedRefresh);
    };
  }, [loggedIn, doRefresh]);

  const handleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      const emp = EMPLOYEES[employeeName];
      if (!emp) {
        toast.error('Please select an employee');
        setLoading(false);
        return;
      }
      if (password !== emp.password) {
        toast.error('Invalid password');
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      setPassword('');
      toast.success(`Logged in as ${employeeName}`);
      setLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setEmployeeName('');
    setPassword('');
    setOrders({ unseen: [], active: [], counts: { unseen: 0, active: 0 } });
    setStats(null);
  };

  const handleAccept = async (orderId) => {
    setAcceptLoading(orderId);
    try {
      await api.post(`/api/dispatch-profile/${orderId}/accept`, { employeeName });
      toast.success('Dispatch accepted!');
      doRefresh();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setAcceptLoading(null);
    }
  };

  const handleDispatch = async () => {
    if (!dispatchModal || !selectedMethod) return;
    setDispatchLoading(dispatchModal.id);
    try {
      await api.post(`/api/dispatch-profile/${dispatchModal.id}/dispatch`, {
        employeeName,
        dispatchMethod: selectedMethod.id,
        trackingUrl: trackingUrl || undefined
      });
      setDispatchModal(null);
      setSelectedMethod(null);
      setTrackingUrl('');
      toast.success(`Dispatched via ${selectedMethod.label}`);
      doRefresh();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setDispatchLoading(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedOrderId(prev => prev === id ? null : id);
  };

  const parseJSON = (data) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return {}; }
  };

  const printDispatchSheet = (order) => {
    const title = 'Dispatch Sheet — ' + (order.orderNumber || order.id?.slice(0, 8));
    const iframe = document.createElement('iframe');
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.position = 'absolute';
    iframe.style.left = '0';
    iframe.style.top = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    const PRINT_CSS = `@page{margin:12mm}body{font-family:sans-serif;color:#000;padding:20px;font-size:14px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{padding:8px 10px;border:1px solid #000;text-align:left}th{background:#f3f4f6;font-size:14px;font-weight:900;text-transform:uppercase}td{font-size:14px}.section-title{font-size:18px;font-weight:900;text-transform:uppercase;margin:16px 0 8px;padding-bottom:4px;border-bottom:3px solid #000}`;
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
    doc.write(`<div style="text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:4px solid #000">`);
    doc.write(`<h1 style="font-size:42px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#000;margin:0">ENAMELS</h1>`);
    doc.write(`<p style="font-size:18px;font-weight:800;color:#000;text-transform:uppercase;letter-spacing:2px;margin-top:2px">DISPATCH SHEET</p>`);
    doc.write(`</div>`);
    doc.write(`<div style="text-align:center;margin-bottom:10px">`);
    doc.write(`<h2 style="font-size:36px;font-weight:900;text-transform:uppercase;color:#000;letter-spacing:1px">Order #${order.orderNumber || order.id?.slice(0, 8)}</h2>`);
    doc.write(`</div>`);
    doc.write(`<div style="text-align:center;margin-bottom:10px">`);
    doc.write(`<h3 style="font-size:24px;font-weight:900;color:#1d4ed8;background:#dbeafe;display:inline-block;padding:6px 20px;border-radius:8px">Dispatch Officer: ${employeeName}</h3>`);
    doc.write(`</div>`);
    doc.write(`<div style="border:2px solid #000;border-radius:8px;padding:10px 14px;margin-bottom:12px">`);
    doc.write(`<p style="font-size:22px;font-weight:900;color:#000;margin-bottom:4px">${order.customerName || '—'}</p>`);
    doc.write(`<p style="font-size:18px;font-weight:600;color:#000;margin-bottom:2px">${order.customerPhone || ''}</p>`);
    if (order.address) doc.write(`<p style="font-size:16px;color:#000;margin-bottom:2px">${order.address}</p>`);
    if (order.city) doc.write(`<p style="font-size:20px;font-weight:900;color:#000;background:#fef3c7;display:inline-block;padding:4px 14px;border-radius:6px;margin-top:4px;text-transform:uppercase">CITY: ${order.city}</p>`);
    doc.write(`</div>`);
    doc.write(`<div class="section-title">Dispatch Info</div>`);
    doc.write(`<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">`);
    const infoItems = [
      { label: 'Officer', value: employeeName },
      { label: 'Source', value: order.outletName || order.source || '—' },
      { label: 'Type', value: order.type || '—' },
      { label: 'Payment', value: order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : 'COD' },
    ];
    infoItems.forEach(item => {
      doc.write(`<div style="background:#f3f4f6;padding:6px 14px;border-radius:6px"><span style="font-size:12px;font-weight:700;color:#6b7280;display:block">${item.label}</span><span style="font-size:16px;font-weight:900">${item.value}</span></div>`);
    });
    doc.write(`</div>`);
    doc.write(`<div class="section-title">Products</div>`);
    const rawPd = parseJSON(order.productDetails);
    const allItems = Array.isArray(rawPd) ? rawPd : null;
    const firstProduct = allItems ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
    const isMultiItem = allItems && allItems.length > 0;
    if (isMultiItem) {
      doc.write(`<table><thead><tr><th>#</th><th>Product</th><th>Color / Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>`);
      allItems.forEach((item, idx) => {
        const p = item.productDetails || item || {};
        doc.write(`<tr>`);
        doc.write(`<td style="font-weight:700">${idx + 1}</td>`);
        doc.write(`<td style="font-weight:700">${p.productType || p.name || '—'}</td>`);
        doc.write(`<td>${[p.fabricType, p.color, p.size, p.gender].filter(Boolean).join(' • ') || '—'}</td>`);
        doc.write(`<td style="text-align:center;font-weight:700">${item.quantity || 1}</td>`);
        doc.write(`<td style="text-align:right;font-weight:700">₨${parseFloat(item.totalPrice || 0).toLocaleString()}</td>`);
        doc.write(`</tr>`);
      });
      doc.write(`</tbody></table>`);
    } else {
      doc.write(`<div style="border:2px solid #000;border-radius:8px;padding:10px 14px;margin-bottom:12px">`);
      doc.write(`<p style="font-size:18px;font-weight:900">${firstProduct.productType || firstProduct.name || '—'}</p>`);
      doc.write(`<p style="font-size:16px">${[firstProduct.fabricType, firstProduct.color, firstProduct.size, firstProduct.gender].filter(Boolean).join(' • ') || '—'}</p>`);
      doc.write(`<p style="font-size:16px;font-weight:700;margin-top:4px">Qty: 1 | ₨${parseFloat(order.totalPrice || 0).toLocaleString()}</p>`);
      doc.write(`</div>`);
    }
    doc.write(`<div style="margin-top:20px;border-top:3px solid #000;padding-top:10px;text-align:center">`);
    doc.write(`<p style="font-size:14px;font-weight:700">Dispatch Officer: ${employeeName}</p>`);
    doc.write(`<p style="font-size:14px;font-weight:700">Date: ${new Date().toLocaleDateString()} | Time: ${new Date().toLocaleTimeString()}</p>`);
    doc.write(`<div style="display:flex;justify-content:space-between;margin-top:30px">`);
    doc.write(`<div style="text-align:center"><div style="width:180px;border-top:2px solid #000;margin:0 auto 4px"></div><span style="font-size:14px;font-weight:700">Dispatch Officer Signature</span></div>`);
    doc.write(`<div style="text-align:center"><div style="width:180px;border-top:2px solid #000;margin:0 auto 4px"></div><span style="font-size:14px;font-weight:700">Receiver Signature</span></div>`);
    doc.write(`</div></div>`);
    doc.write(`</body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const getFilteredOrders = (items) => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(o =>
      o.customerName?.toLowerCase().includes(q) ||
      (o.orderNumber || '').toLowerCase().includes(q) ||
      o.outletName?.toLowerCase().includes(q) ||
      o.city?.toLowerCase().includes(q)
    );
  };

  const renderOrderCard = (order, actions) => {
    const badge = PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.NORMAL;
    const isExpanded = expandedOrderId === order.id;
    const rawPd = parseJSON(order.productDetails);
    const allItems = Array.isArray(rawPd) ? rawPd : null;
    const firstProduct = allItems ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
    return (
      <motion.div key={order.id} layout
        className={`glass rounded-[2rem] p-4 md:p-6 border ${order.priority === 'SUPER_URGENT' ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'theme-border'}`}>
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(order.id)}>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
              <span className={`text-xs md:text-sm font-black px-2 py-0.5 rounded-full ${order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                {order.source === 'ONLINE ORDER' || order.source === 'INTERNAL' ? 'ONLINE' : order.source}
              </span>
              {order.outletName && <span className="text-xs md:text-sm font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{order.outletName}</span>}
              {order.forwardedBy === 'Khawar' && (
                <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">FORWARDED BY KHAWAR</span>
              )}
              {order.dispatchOfficer && (
                <span className="text-xs md:text-sm font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">ASSIGNED: {order.dispatchOfficer}</span>
              )}
            </div>
            <h3 className="font-black text-xl theme-text-primary truncate">#{order.orderNumber || order.id.substring(0, 8)} — {order.customerName}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs md:text-sm theme-text-secondary font-bold">
              <span className="flex items-center gap-1"><Phone size={12} />{order.customerPhone || 'N/A'}</span>
              {order.address && <span className="flex items-center gap-1 text-blue-400 font-black max-w-[300px] truncate" title={order.address}><MapPin size={12} />{order.address}</span>}
              <span className="flex items-center gap-1"><MapPin size={12} />{order.city || 'N/A'}</span>
              <span className="flex items-center gap-1"><Clock size={12} />{new Date(order.createdAt).toLocaleDateString()}</span>
              <span className="text-purple-400 text-xs font-black">{isExpanded ? '▲ HIDE' : '▼ DETAILS'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end shrink-0">
            <div className="flex gap-2 flex-wrap">
              <button onClick={(e) => { e.stopPropagation(); printDispatchSheet(order); }}
                className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all" title="Print Dispatch Sheet">
                <Printer size={16} />
              </button>
              {actions}
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-2">Products</h4>
              <div className="space-y-2">
                {(isMultiItem ? allItems : [{ productDetails: firstProduct }]).map((item, idx) => {
                  const p = item.productDetails || item || {};
                  return (
                    <div key={idx} className="flex items-center justify-between theme-bg-subtle rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm theme-text-primary">{p.productType || p.name || p.productName || '—'}</p>
                        <p className="text-xs theme-text-muted font-bold">
                          {[p.fabricType, p.color, p.size, p.gender].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <span className="font-black text-sm theme-text-primary shrink-0 ml-2">{item.quantity || 1} × ₨{parseFloat(item.totalPrice || order.totalPrice || 0).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Type</p>
                <p className="text-sm font-black theme-text-primary">{order.type || 'STANDARD'}</p>
              </div>
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Delivery</p>
                <p className="text-sm font-black theme-text-primary">{order.deliveryMethod || order.deliveryType || '—'}</p>
              </div>
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Payment</p>
                <p className={`text-sm font-black ${order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : 'COD'}
                </p>
              </div>
              <div className="theme-bg-subtle rounded-xl px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total</p>
                <p className="text-sm font-black theme-text-primary">₨{parseFloat(order.totalPrice || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // ─── LOGIN SCREEN ───
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
                  <option key={key} value={key}>{emp.label} — {key === 'Khawar' ? 'Lahore Orders' : 'All Cities'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black theme-text-muted uppercase tracking-widest mb-2 block">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                  className="w-full theme-input rounded-xl py-3 px-4 pr-12 focus:border-blue-500 outline-none font-black"
                  placeholder="Enter password..." />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs font-black">
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading || !employeeName || !password}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <LogIn size={16} />}
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

  // ─── MAIN DASHBOARD ───
  const methods = employeeName === 'Khawar' ? KHAWAR_METHODS : FAISAL_METHODS;
  const isKhawar = employeeName === 'Khawar';

  const tabs = [
    { id: 'unseen', label: 'Unseen Tasks', icon: Eye, desc: 'Orders awaiting acceptance', count: orders.counts.unseen },
    { id: 'active', label: 'Active Tasks', icon: Package, desc: 'Accepted orders', count: orders.counts.active },
  ];

  const filteredUnseen = getFilteredOrders(orders.unseen);
  const filteredActive = getFilteredOrders(orders.active);

  return (
    <div className="space-y-4 md:space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-500/10">
            <UserCheck className="text-blue-400" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tight">
              {employeeName}'s Dispatch
            </h1>
            <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">
              {isKhawar ? 'Lahore Orders Only' : 'All Cities Dispatch'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchStats} disabled={statsLoading}
            className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all" title="Refresh stats">
            <BarChart3 size={16} />
          </button>
          <button onClick={handleLogout}
            className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5">
            <X size={14} /> Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="theme-bg-subtle rounded-2xl p-4 border theme-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Accepted</p>
            <p className="text-2xl font-black text-emerald-400">{stats.accepted}</p>
          </div>
          <div className="theme-bg-subtle rounded-2xl p-4 border theme-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Dispatched</p>
            <p className="text-2xl font-black text-blue-400">{stats.dispatched}</p>
          </div>
          <div className="theme-bg-subtle rounded-2xl p-4 border theme-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Forwarded</p>
            <p className="text-2xl font-black text-amber-400">{stats.forwarded}</p>
          </div>
          <div className="theme-bg-subtle rounded-2xl p-4 border theme-border">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Actions</p>
            <p className="text-2xl font-black text-purple-400">{stats.totalActions}</p>
          </div>
          {Object.entries(stats.methodBreakdown || {}).map(([method, count]) => (
            <div key={method} className="theme-bg-subtle rounded-2xl p-4 border theme-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{method.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-black text-indigo-400">{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 theme-bg-subtle p-1 rounded-2xl border theme-border mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all relative ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'theme-text-muted hover:text-gray-300'
              }`}>
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  activeTab === tab.id ? 'bg-white text-blue-700' : 'bg-blue-500/20 text-blue-400'
                }`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
        <input type="text" placeholder="Search by order #, customer, outlet, or city..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full theme-input border-2 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-all text-sm font-bold" />
      </div>

      {/* Unseen Tab */}
      {activeTab === 'unseen' && (
        <>
          {ordersLoading && !filteredUnseen.length ? (
            <PageLoader text="Loading orders..." />
          ) : filteredUnseen.length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Eye className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Unseen Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">All {employeeName}'s dispatch orders have been accepted.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredUnseen.map(order => renderOrderCard(order, (
                <button onClick={() => handleAccept(order.id)}
                  disabled={acceptLoading === order.id}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                  {acceptLoading === order.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  ACCEPT
                </button>
              )))}
            </div>
          )}
        </>
      )}

      {/* Active Tab */}
      {activeTab === 'active' && (
        <>
          {ordersLoading && !filteredActive.length ? (
            <PageLoader text="Loading orders..." />
          ) : filteredActive.length === 0 ? (
            <div className="glass rounded-2xl md:rounded-[3rem] border theme-border p-6 md:p-20 text-center">
              <Package className="mx-auto text-gray-800 mb-4" size={48} />
              <h3 className="theme-text-muted font-black uppercase">No Active Tasks</h3>
              <p className="theme-text-muted text-xs font-bold mt-2">Accepted orders awaiting dispatch will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredActive.map(order => renderOrderCard(order, (
                <button onClick={() => { setDispatchModal(order); setSelectedMethod(null); setTrackingUrl(''); }}
                  disabled={dispatchLoading === order.id}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50">
                  {dispatchLoading === order.id ? <Loader2 className="animate-spin" size={14} /> : <><Send size={14} /> Dispatch</>}
                </button>
              )))}
            </div>
          )}
        </>
      )}

      {/* Dispatch Modal */}
      <AnimatePresence>
        {dispatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 theme-border shadow-2xl">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Dispatch Order</h2>
              <p className="theme-text-secondary text-xs font-bold mb-1">Order #{dispatchModal?.orderNumber || dispatchModal?.id?.substring(0, 8)} — {dispatchModal?.customerName}</p>
              <p className="theme-text-muted text-xs font-bold mb-4">City: {dispatchModal?.city || 'N/A'} | {isKhawar ? 'Enamel Delivery / Forward to Faisal' : 'TCS / Post / Customer Takeaway'}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Dispatch Method</label>
                  <div className="grid grid-cols-1 gap-2">
                    {methods.map(m => (
                      <button key={m.id} onClick={() => setSelectedMethod(m)}
                        className={`py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all border-2 text-left flex items-center gap-2 ${
                          selectedMethod?.id === m.id ? `border-blue-500 bg-blue-600 text-white` : 'theme-border theme-bg theme-text-muted hover:border-gray-500'
                        }`}>
                        <div className={`w-3 h-3 rounded-full ${m.color} ${selectedMethod?.id === m.id ? 'opacity-100' : 'opacity-50'}`} />
                        <div>
                          <p>{m.label}</p>
                          <p className="text-[10px] font-bold opacity-60">{m.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedMethod && selectedMethod.id !== 'CUSTOMER_TAKEAWAY' && selectedMethod.id !== 'FORWARD_TO_FAISAL' && (
                  <div>
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest mb-2 block">Tracking URL / Number (optional)</label>
                    <input type="text" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-blue-500 outline-none font-black"
                      placeholder="Enter tracking URL or number..." />
                  </div>
                )}
                {selectedMethod?.id === 'CUSTOMER_TAKEAWAY' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs md:text-sm font-black text-emerald-400">Order will be marked as received by customer directly.</p>
                  </div>
                )}
                {selectedMethod?.id === 'FORWARD_TO_FAISAL' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs md:text-sm font-black text-blue-400">Order will be forwarded to Faisal for dispatch via TCS/Post/Takeaway.</p>
                  </div>
                )}
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => { setDispatchModal(null); setSelectedMethod(null); setTrackingUrl(''); }}
                  className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">Cancel</button>
                <button onClick={handleDispatch}
                  disabled={!selectedMethod || dispatchLoading === dispatchModal.id}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {dispatchLoading === dispatchModal.id ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  {selectedMethod ? `Dispatch via ${selectedMethod.label}` : 'Select Method'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DispatchProfile;
