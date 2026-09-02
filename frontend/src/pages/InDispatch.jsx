import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Route as RouteIcon, Truck, Send, UserCheck, RefreshCcw,
  Calendar, Phone, Package, CheckCircle2, XCircle, Plus,
  MapPin, User, FileText, CheckSquare, Layers, Printer, Wallet, Search, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';
import { getDelayInfo, fmtDuration } from '../utils/delayUtils';

// Dedicated In Dispatch module — JOHAR TOWN outlet only.
// Isolated from the existing Dispatch (dispatch officer) workflow.
// Only orders explicitly routed via "Send to In Dispatch" appear here.

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const InDispatch = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);
  const isJoharTown = outletName === 'Johar Town';
  const userRole = String(user?.role || '').toUpperCase();
  const isAdminRole = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'FAISAL', 'DISPATCH', 'SOFTWARE_SETTINGS'].includes(userRole);
  const canAccessInDispatch = isJoharTown || isAdminRole;

  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedForRoute, setSelectedForRoute] = useState(new Set());
  const [routeForm, setRouteForm] = useState({ routeName: '', area: '', deliveryPerson: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // Search — filter the In Dispatch queue by order number, customer name, or phone.
  const [searchQuery, setSearchQuery] = useState('');

  // Clear Balance — collect the remaining balance when printing the Dispatch Slip.
  const [clearBalanceOrder, setClearBalanceOrder] = useState(null);
  const [clearAmount, setClearAmount] = useState('');
  const [clearMethod, setClearMethod] = useState('CASH');
  const [clearCashAmount, setClearCashAmount] = useState('');
  const [clearOnlineAmount, setClearOnlineAmount] = useState('');
  const [clearingBalance, setClearingBalance] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/in-dispatch/orders');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('In Dispatch orders error:', e);
      toast.error(e.response?.data?.message || 'Failed to load In Dispatch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    setRoutesLoading(true);
    try {
      const res = await api.get('/api/in-dispatch/routes');
      setRoutes(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('In Dispatch routes error:', e);
      toast.error(e.response?.data?.message || 'Failed to load delivery routes');
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchRoutes();
  }, [fetchOrders, fetchRoutes]);

  useEffect(() => {
    if (canAccessInDispatch) refreshAll();
  }, [canAccessInDispatch, refreshAll]);

  const activeRoutes = routes.filter(r => r.status === 'ACTIVE');
  const completedRoutes = routes.filter(r => r.status === 'COMPLETED');
  const assignedIds = new Set(
    activeRoutes.flatMap(r => { try { return JSON.parse(r.orderIds || '[]'); } catch (_) { return []; } })
  );

  // Client-side search over the loaded dispatch orders (order #, customer name, phone).
  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = q
    ? orders.filter(o => {
        const hay = `${o.orderNumber || ''} ${o.invoiceNumber || ''} ${o.customerName || ''} ${o.customerPhone || ''}`.toLowerCase();
        return hay.includes(q);
      })
    : orders;

  const toggleSelect = (orderId) => {
    setSelectedForRoute(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const handleRouteOrder = async (orderId, action, targetOutlet) => {
    setActionLoading(orderId + action);
    try {
      await api.post(`/api/in-dispatch/orders/${orderId}/route`, { action, targetOutlet });
      toast.success(action === 'customerTakeDeliver' ? 'Order completed' : 'Order routed');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Route failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRoute = async () => {
    if (!routeForm.routeName.trim()) {
      toast.error('Route name is required');
      return;
    }
    if (selectedForRoute.size === 0) {
      toast.error('Select at least one order');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/in-dispatch/routes', {
        routeName: routeForm.routeName,
        area: routeForm.area,
        deliveryPerson: routeForm.deliveryPerson,
        notes: routeForm.notes,
        orderIds: Array.from(selectedForRoute)
      });
      toast.success('Delivery route created');
      setShowCreateModal(false);
      setSelectedForRoute(new Set());
      setRouteForm({ routeName: '', area: '', deliveryPerson: '', notes: '' });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create route');
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteRoute = async (routeId) => {
    if (!window.confirm('Mark this delivery route as completed?')) return;
    setActionLoading('complete' + routeId);
    try {
      await api.post(`/api/in-dispatch/routes/${routeId}/complete`);
      toast.success('Delivery route completed');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to complete route');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRoute = async (routeId) => {
    if (!window.confirm('Cancel this delivery route? Orders will return to the queue.')) return;
    setActionLoading('cancel' + routeId);
    try {
      await api.post(`/api/in-dispatch/routes/${routeId}/cancel`);
      toast.success('Delivery route cancelled');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel route');
    } finally {
      setActionLoading(null);
    }
  };

  // Print Dispatch Slip — when the order has an outstanding balance, prompt to
  // collect it first (Clear Balance). If fully paid (or no POS link), print directly.
  const handlePrintSlipClick = (order) => {
    const pay = order._payment;
    if (pay?.linked && pay?.remaining > 0.01) {
      setClearBalanceOrder(order);
      setClearAmount(String(pay.remaining));
      setClearMethod('CASH');
      setClearCashAmount('');
      setClearOnlineAmount('');
    } else {
      printDispatchSlip(order);
    }
  };

  const openClearBalance = (order) => {
    const pay = order._payment || {};
    setClearBalanceOrder(order);
    setClearAmount(String(pay.remaining || ''));
    setClearMethod('CASH');
    setClearCashAmount('');
    setClearOnlineAmount('');
  };

  const handleClearBalance = async () => {
    const order = clearBalanceOrder;
    if (!order) return;
    const remaining = Number(order._payment?.remaining || 0);
    const amount = Number(clearAmount);
    if (!amount || amount <= 0) { toast.error('Enter the balance amount'); return; }
    if (amount > remaining + 0.01) { toast.error(`Amount exceeds remaining balance of ₨${remaining.toLocaleString()}`); return; }
    if (clearMethod === 'CASH_ONLINE') {
      const total = (Number(clearCashAmount) || 0) + (Number(clearOnlineAmount) || 0);
      if (Math.abs(total - amount) > 0.01) { toast.error('Cash + Online must equal the total amount'); return; }
    }
    setClearingBalance(true);
    try {
      const res = await api.post(`/api/in-dispatch/orders/${order.id}/clear-balance`, {
        amountPaidNow: amount,
        paymentMethod: clearMethod,
        cashAmount: Number(clearCashAmount) || 0,
        onlineAmount: Number(clearOnlineAmount) || 0
      });
      toast.success('Balance cleared — order is now Paid');
      const pay = order._payment || {};
      const newPaid = Math.round((Number(pay.paid || 0) + amount) * 100) / 100;
      const newRemaining = Math.max(0, Math.round((Number(pay.remaining || 0) - amount) * 100) / 100);
      const updatedPayment = {
        ...pay,
        paid: newPaid,
        remaining: newRemaining,
        status: newRemaining <= 0.01 ? 'Paid' : 'Partially Paid',
        method: clearMethod,
        balanceReceipt: res.data?.receiptNumber || null
      };
      order._payment = updatedPayment;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, _payment: updatedPayment } : o));
      setClearBalanceOrder(null);
      setClearAmount(''); setClearCashAmount(''); setClearOnlineAmount(''); setClearMethod('CASH');
      refreshAll();
      printDispatchSlip({ ...order, _payment: updatedPayment });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to clear balance');
    } finally {
      setClearingBalance(false);
    }
  };

  const productsSummary = (order) => {
    const items = order.productDetails || [];
    if (items.length === 0) return null;
    return items.map((p, i) => (
      <span key={i} className="inline-flex items-center gap-1 text-[11px] text-gray-300 bg-gray-800/60 border border-gray-700/50 rounded-lg px-2 py-0.5">
        <Package size={10} className="text-violet-400 shrink-0" />
        {p.name}{p.color ? ` (${p.color}` : ''}{p.size ? ` / ${p.size}` : ''}{p.color || p.size ? ')' : ''} × {p.quantity || 1}
      </span>
    ));
  };

  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtPkr = (n) => `₨${(Number(n) || 0).toLocaleString()}`;
  const fmtDate = (v) => {
    try {
      if (!v) return '—';
      return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return '—'; }
  };
  const methodLabel = (m) => {
    const map = { CASH: 'Cash', ONLINE: 'Online', CARD: 'Card', CASH_ONLINE: 'Cash + Online', FAISAL_TAKE: 'Faisal Take', COD: 'COD' };
    return map[m] || m || '—';
  };
  const statusColor = (s) => {
    if (s === 'Paid') return '#059669';
    if (s === 'Partially Paid') return '#d97706';
    return '#dc2626';
  };

  const parseCustom = (v) => {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return {}; }
  };
  const parseJsonSafe = (v) => {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
  };

  // Flatten order.productDetails (array / single object / JSON string) into slip rows.
  const slipProducts = (order) => {
    let raw = [];
    if (Array.isArray(order.productDetails)) raw = order.productDetails;
    else if (typeof order.productDetails === 'string') raw = parseJsonSafe(order.productDetails) || [];
    else if (order.productDetails && typeof order.productDetails === 'object') raw = [order.productDetails];
    const orderSizeData = parseJsonSafe(order.sizeData) || {};
    // Real per-product pricing from the linked POS transaction (when present).
    // Outlet orders often store unitPrice 0 on productDetails, so fall back to
    // the POS sale items so UNIT/TOTAL on the slip always match the receipt.
    const posItems = (Array.isArray(order._posItems) ? order._posItems : []).map(it => ({
      name: String(it.productName || '').trim().toLowerCase(),
      color: String(it.color || '').trim().toLowerCase(),
      size: String(it.size || '').trim().toLowerCase(),
      unitPrice: Number(it.unitPrice) || 0,
      lineTotal: Number(it.lineTotal) || 0
    }));
    const findPosItem = (name, color, size) => {
      const n = String(name || '').trim().toLowerCase();
      const c = String(color || '').trim().toLowerCase();
      const s = String(size || '').trim().toLowerCase();
      return posItems.find(x => x.name === n && x.color === c && x.size === s)
        || posItems.find(x => x.name === n && x.color === c)
        || posItems.find(x => x.name === n)
        || null;
    };
    return raw.map((item, idx) => {
      const p = (item && typeof item === 'object' && item.productDetails && typeof item.productDetails === 'object') ? item.productDetails : item;
      if (!p || typeof p !== 'object') return null;
      const cust = parseCustom(p.customization);
      const pSizeData = (orderSizeData && typeof orderSizeData === 'object')
        ? (orderSizeData[p.productType || p.name] || orderSizeData[idx] || {})
        : (parseJsonSafe(p.sizeData) || {});
      const measurements = Object.entries(pSizeData || {})
        .filter(([k, v]) => v && k !== '_standardSize' && k !== 'specialNote')
        .map(([k, v]) => `${k}: ${v}`);
      const articleNames = Array.isArray(cust.articleNames)
        ? cust.articleNames.filter(Boolean)
        : (cust.nameSpelling ? [cust.nameSpelling] : []);
      const logoLines = Array.isArray(cust.logos)
        ? cust.logos.map(l => l && (l.name || l.design)).filter(Boolean)
        : [];
      const name = p.productType || p.name || p.product || '—';
      const qty = Number(p.quantity) || 1;
      const fallbackUnit = Number(p.unitPrice) || 0;
      const fallbackLine = Number(p.totalPrice) || (fallbackUnit * qty + (Number(p.capCharges) || 0));
      const posItem = findPosItem(name, p.color, p.size);
      const unitPrice = fallbackUnit > 0 ? fallbackUnit : (posItem ? posItem.unitPrice : fallbackUnit);
      const lineTotal = fallbackLine > 0 ? fallbackLine : (posItem ? (posItem.lineTotal || (posItem.unitPrice * qty)) : fallbackLine);
      return {
        name,
        variant: p.variant || '',
        color: p.color || '—',
        size: p.size || '—',
        qty,
        unitPrice,
        lineTotal,
        fabric: p.fabricType || p.fabric || '',
        gender: p.gender || '',
        engravingType: cust.engravingType || '',
        logoPlacement: cust.logoPlacement || p.logoPlacement || '',
        nameColor: cust.nameColor || '',
        articleNames,
        logos: logoLines,
        notes: p.specialNote || p.measurementSpecialNote || cust.designNotes || '',
        measurements
      };
    }).filter(Boolean);
  };

  // Print Dispatch Slip — A4 professional layout mirroring the Dispatch Sheet
  // (ENAMELS branding, customer box, product table, financial summary, officer).
  // Payment info is auto-retrieved from the linked POS sale via the Order Number
  // and appears ONLY on this slip, never on the Production Job Sheet.
  const printDispatchSlip = async (order) => {
    const pay = order._payment || {};
    const products = slipProducts(order);
    const productTotal = products.reduce((s, p) => s + (Number(p.lineTotal) || 0), 0);
    const title = `Dispatch Slip — ${order.orderNumber || ''}`;
    let logoUrl = window.location.origin + '/logo.png';
    try { const r = await fetch(logoUrl); const b = await r.blob(); logoUrl = URL.createObjectURL(b); } catch {}

    const productRows = products.map((p, i) => {
      const detailParts = [
        p.variant, p.fabric, p.gender ? `For ${p.gender}` : '',
        p.engravingType ? `Logo/Engraving: ${p.engravingType}` : '',
        p.logoPlacement ? `Placement: ${p.logoPlacement}` : ''
      ].filter(Boolean);
      const names = p.articleNames.length ? `Names: ${esc(p.articleNames.join(', '))}${p.nameColor ? ` (${esc(p.nameColor)})` : ''}` : '';
      const logos = p.logos.length ? `Logos: ${esc(p.logos.join(', '))}` : '';
      const notes = p.notes ? `Notes: ${esc(p.notes)}` : '';
      const msr = p.measurements.length ? `Measurements: ${esc(p.measurements.join(' · '))}` : '';
      const detail = [names, logos, ...detailParts, notes, msr].filter(Boolean).join('<br>');
      return `<tr>
        <td style="text-align:center;font-weight:700">${i + 1}</td>
        <td style="font-weight:700">${esc(p.name)}</td>
        <td style="text-align:center">${esc(p.color)}</td>
        <td style="text-align:center">${esc(p.size)}</td>
        <td style="text-align:center;font-weight:700">${p.qty}</td>
        <td style="text-align:right">${fmtPkr(p.unitPrice)}</td>
        <td style="text-align:right;font-weight:700">${fmtPkr(p.lineTotal)}</td>
      </tr>${detail ? `<tr><td></td><td colspan="6" style="font-size:9px;color:#444;background:#fafafa;line-height:1.5">${detail}</td></tr>` : ''}`;
    }).join('');

    const payMethod = methodLabel(pay.method);
    const statusBg = statusColor(pay.status);
    const deliveryCharges = Number(order.deliveryCharges) || 0;
    const showDelivery = deliveryCharges > 0;
    const orderInfoRows = [
      ['Order No.', esc(order.orderNumber || '—')],
      ['Invoice No.', esc(order.invoiceNumber || '—')],
      ['POS Reference', pay.receiptNumber ? esc(pay.receiptNumber) : (pay.linked ? '—' : '<em style="color:#b45309">Not linked</em>')],
      ['Order Date', fmtDate(order.createdAt)],
      ['Dispatch Date', fmtDate(order._dispatchDate)],
      ['Order Type', esc((order.type || 'STANDARD').replace(/_/g, ' '))],
      ['Priority', esc(order.urgent ? 'Urgent' : (order.priority === 'SUPER_URGENT' ? 'Super Urgent' : (order.priority === 'URGENT' ? 'Urgent' : 'Regular')))]
    ].map(([k, v]) => `<tr><td style="width:40%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">${k}</td><td style="font-weight:700">${v}</td></tr>`).join('');

    const financeRows = [
      ['Products Subtotal', fmtPkr(productTotal)],
      ...(showDelivery ? [['Delivery Charges', fmtPkr(deliveryCharges)]] : []),
      ['Total Order Amount', fmtPkr(pay.total)],
      ['Advance Payment', fmtPkr(pay.advance)],
      ['Paid Amount', `<b>${fmtPkr(pay.paid)}</b>`],
      ['Remaining Balance', `<span style="color:${statusBg};font-weight:900">${fmtPkr(pay.remaining)}</span>`],
      ['Payment Method', esc(payMethod)],
      ['Payment Status', `<span style="display:inline-block;padding:2px 10px;border-radius:3px;color:#fff;font-weight:900;font-size:10px;background:${statusBg}">${esc(pay.status)}</span>`]
    ].map(([k, v]) => `<tr><td style="width:40%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">${k}</td><td style="font-weight:700">${v}</td></tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: sans-serif; color: #000; padding: 6px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  th, td { padding: 3px 5px; border: 1px solid #000; text-align: left; }
  th { background: #f3f4f6; font-size: 10px; font-weight: 900; text-transform: uppercase; }
  td { font-size: 11px; }
  .brand-header { text-align: center; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 3px solid #000; }
  .brand-header p { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin: 2px 0 0; }
  .brand-header .sub { font-size: 9px; font-weight: 700; letter-spacing: 2px; margin: 0; color: #444; }
  .officer { text-align: center; margin-bottom: 4px; }
  .officer span { font-size: 13px; font-weight: 900; color: #1d4ed8; background: #dbeafe; display: inline-block; padding: 3px 12px; }
  .order-title { text-align: center; margin-bottom: 4px; }
  .order-title h2 { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
  .customer-box { border: 1.5px solid #000; padding: 5px 8px; margin-bottom: 4px; }
  .customer-box .name { font-size: 14px; font-weight: 900; margin: 0 0 2px; }
  .customer-box .phone { font-size: 12px; font-weight: 600; margin: 0 0 1px; }
  .customer-box .addr { font-size: 11px; margin: 0 0 1px; }
  .city-badge { font-size: 13px; font-weight: 900; background: #fef3c7; display: inline-block; padding: 2px 8px; margin-top: 2px; text-transform: uppercase; }
  .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; margin: 6px 0 2px; padding-bottom: 2px; border-bottom: 2px solid #000; }
  .sig { display: flex; justify-content: space-between; margin-top: 14px; }
  .sig div { text-align: center; }
  .sig .line { width: 150px; border-top: 1.5px solid #000; margin: 0 auto 2px; }
  .sig span { font-size: 10px; font-weight: 700; }
  .footer { text-align: center; margin-top: 10px; border-top: 1px dashed #999; padding-top: 5px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #444; }
  @media print { @page { margin: 6mm; } body { padding: 0; } }
</style></head><body>
  <div class="brand-header">
    <img src="${logoUrl}" alt="ENAMELS" style="height:50px;margin-bottom:2px;">
    <p>Dispatch Slip</p>
    <div class="sub">JOHAR TOWN OUTLET · IN DISPATCH</div>
  </div>

  <div class="officer"><span>Dispatch Officer: Johar Town</span></div>

  <div class="order-title"><h2>Order #${esc(order.orderNumber || order.id?.slice(0, 8))}</h2></div>

  <div class="customer-box">
    <p class="name">${esc(order.customerName || '—')}</p>
    ${order.customerPhone ? `<p class="phone">${esc(order.customerPhone)}</p>` : ''}
    ${order.address ? `<p class="addr">${esc(order.address)}</p>` : ''}
    ${order.city ? `<span class="city-badge">City: ${esc(order.city)}</span>` : ''}
  </div>

  <div class="section-title">Order Information</div>
  <table>${orderInfoRows}</table>

  <div class="section-title">Products (${products.length})</div>
  ${products.length ? `<table>
    <thead><tr><th style="text-align:center">#</th><th>Product</th><th style="text-align:center">Color</th><th style="text-align:center">Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${productRows}</tbody>
  </table>` : '<p style="color:#444">No products</p>'}

  <div class="section-title">Financial Summary</div>
  <table>${financeRows}</table>
  ${pay.linked ? '' : `<p style="font-size:9px;color:#b45309;margin:2px 0">No POS sale was linked to this Order Number — amounts shown are from the order record. Link the POS sale by using the same Order Number in the POS and in Outlet Order Entry.</p>`}

  <div class="sig">
    <div><div class="line"></div><span>Dispatch Officer Signature</span></div>
    <div><div class="line"></div><span>Receiver Signature</span></div>
  </div>
  <div class="footer">ENAMELS · Johar Town Outlet · ${fmtDate(new Date())}</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
      }, 1000);
    }, 350);
  };

  const selectedOrders = orders.filter(o => selectedForRoute.has(o.id));

  if (!canAccessInDispatch) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900/70 border border-red-500/30 rounded-2xl p-10 text-center max-w-md shadow-2xl">
          <XCircle className="mx-auto text-red-500 mb-3" size={48} />
          <p className="text-white font-black text-lg">Access Restricted</p>
          <p className="text-sm text-gray-400 mt-2">The In Dispatch module is only available to the <span className="text-white font-bold">JOHAR TOWN</span> outlet.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-white">In Dispatch</h1>
            <span className="px-2.5 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-black tracking-widest rounded-full border border-violet-500/30">JOHAR TOWN</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Dedicated outlet dispatch queue — only orders sent via "Send to In Dispatch"</p>
        </div>
        <button onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all border border-gray-700/50">
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900/80 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-violet-500/20 rounded-xl text-violet-400"><Layers size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{orders.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">In Dispatch Orders</p>
          </div>
        </div>
        <div className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400"><RouteIcon size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{activeRoutes.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active Routes</p>
          </div>
        </div>
        <div className="bg-gray-900/80 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><CheckCircle2 size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{completedRoutes.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Completed Routes</p>
          </div>
        </div>
      </div>

      {/* Delivery Routes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon size={16} className="text-cyan-400" />
            <p className="text-sm font-black text-white uppercase tracking-widest">Delivery Routes</p>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-cyan-900/30 active:scale-95">
            <Plus size={14} /> Create Delivery Route
          </button>
        </div>

        {routesLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-28" />)}
          </div>
        ) : routes.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-10 text-center">
            <RouteIcon className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-500 font-bold">No delivery routes yet</p>
            <p className="text-xs text-gray-600 mt-1">Group In Dispatch orders into routes for the delivery run</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {routes.map(route => {
              const isActive = route.status === 'ACTIVE';
              return (
                <motion.div key={route.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-900/80 backdrop-blur-sm border rounded-2xl p-5 space-y-3 shadow-lg ${isActive ? 'border-cyan-500/25' : 'border-emerald-500/20'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-white">{route.routeName}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Created {formatDateOnly(route.createdAt)}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${isActive ? 'bg-cyan-500/20 text-cyan-300' : route.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-600/20 text-gray-400'}`}>
                      {route.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                    {route.area && <span className="flex items-center gap-1"><MapPin size={11} className="text-blue-400" /> {route.area}</span>}
                    {route.deliveryPerson && <span className="flex items-center gap-1"><User size={11} className="text-cyan-400" /> {route.deliveryPerson}</span>}
                    <span className="flex items-center gap-1"><Package size={11} className="text-violet-400" /> {route.orders.length} order{route.orders.length !== 1 ? 's' : ''}</span>
                  </div>

                  {route.orders.length > 0 && (
                    <div className="space-y-1.5">
                      {route.orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-white">{o.orderNumber}</p>
                            <p className="text-[11px] text-gray-400">{o.customerName}</p>
                          </div>
                          <span className="text-[10px] text-gray-500">{o.currentStage === 'IN_DISPATCH' ? 'IN DISPATCH' : o.currentStage}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {route.notes && (
                    <p className="flex items-start gap-1.5 text-[11px] text-gray-400 bg-gray-800/40 rounded-xl px-3 py-2">
                      <FileText size={11} className="text-amber-400 shrink-0 mt-0.5" /> {route.notes}
                    </p>
                  )}

                  {isActive && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => handleCompleteRoute(route.id)} disabled={actionLoading === 'complete' + route.id}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === 'complete' + route.id ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Complete Route
                      </button>
                      <button onClick={() => handleCancelRoute(route.id)} disabled={actionLoading === 'cancel' + route.id}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-600/20 disabled:opacity-50 text-gray-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all border border-gray-700/50">
                        {actionLoading === 'cancel' + route.id ? <RefreshCcw className="animate-spin" size={14} /> : <XCircle size={14} />} Cancel
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* In Dispatch Queue */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-violet-400" />
            <p className="text-sm font-black text-white uppercase tracking-widest">In Dispatch Queue</p>
            {selectedForRoute.size > 0 && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-black rounded-full">{selectedForRoute.size} selected for route</span>
            )}
          </div>
          {selectedForRoute.size > 0 && (
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-black transition-all active:scale-95">
              <RouteIcon size={13} /> Create Route ({selectedForRoute.size})
            </button>
          )}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by order number, customer name, or phone..."
            className="w-full bg-gray-800/70 border border-gray-700/60 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-12 text-center">
            <Truck className="mx-auto text-gray-600 mb-3" size={44} />
            <p className="text-gray-500 font-bold">{q ? 'No orders match your search' : 'No orders in dispatch'}</p>
            <p className="text-xs text-gray-600 mt-1">{q ? 'Try a different order number, customer name, or phone' : 'Orders will appear here after they are sent via "Send to In Dispatch" from My Tasks'}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map(order => {
              const inRoute = assignedIds.has(order.id);
              const isSelected = selectedForRoute.has(order.id);
              const delayInfo = getDelayInfo(order);
              const isDelayed = !!delayInfo;
              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-900/80 backdrop-blur-sm border rounded-2xl p-5 space-y-3 shadow-lg ${
                    isDelayed
                      ? 'border-2 border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.25)] bg-red-950/20'
                      : inRoute
                      ? 'border-cyan-500/30'
                      : isSelected
                      ? 'border-blue-500/40'
                      : 'border-violet-500/20'
                  }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-black text-white">{order.orderNumber}</p>
                      <p className="text-sm text-gray-400">{order.customerName}</p>
                      {order.customerPhone && <p className="flex items-center gap-1 text-xs text-gray-500"><Phone size={10} /> {order.customerPhone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {isDelayed ? (
                        <span className="px-2.5 py-1 bg-red-600 text-white border border-red-500 text-[10px] font-black rounded-full animate-pulse shadow-md shadow-red-900/50 flex items-center gap-1">
                          <Clock size={10} className="animate-spin text-white" />
                          IN DISPATCH (DELAYED)
                        </span>
                      ) : inRoute ? (
                        <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 text-[10px] font-black rounded-full">IN ROUTE</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-black rounded-full">IN DISPATCH</span>
                      )}
                      {order._payment && (
                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${
                          order._payment.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-300'
                          : order._payment.status === 'Partially Paid' ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                        }`}>
                          {order._payment.status}
                        </span>
                      )}
                      <button onClick={() => toggleSelect(order.id)} disabled={inRoute}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-500' : inRoute ? 'bg-gray-800/50 text-gray-600 border-gray-700/40 cursor-not-allowed' : 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:border-blue-500/50 hover:text-blue-300'}`}>
                        <CheckSquare size={11} /> {isSelected ? 'Selected' : 'Add to Route'}
                      </button>
                    </div>
                  </div>

                  {isDelayed && (
                    <div className="flex items-center gap-1.5 text-xs text-red-400 font-black bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-xl animate-pulse">
                      <Clock size={12} className="animate-spin text-red-400" />
                      <span>Overdue by {fmtDuration(delayInfo.delayDuration)} in stage</span>
                    </div>
                  )}

                  {productsSummary(order) && (
                    <div className="flex flex-wrap gap-1.5">{productsSummary(order)}</div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={12} />
                    {formatDateOnly(order.createdAt)}
                    {(order._payment?.total || order.totalPrice) > 0 && <span className="ml-auto font-bold text-white">₨{(order._payment?.total || order.totalPrice || 0).toLocaleString()}</span>}
                  </div>

                  {order._payment && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className={order._payment.paid > 0 ? 'text-emerald-400 font-bold' : 'text-gray-500'}>Paid ₨{(order._payment.paid || 0).toLocaleString()}</span>
                      <span className="text-gray-700">•</span>
                      <span className={order._payment.remaining > 0.01 ? 'text-amber-400 font-bold' : 'text-gray-500'}>Balance ₨{(order._payment.remaining || 0).toLocaleString()}</span>
                      {order._payment.linked && (
                        <>
                          <span className="text-gray-700">•</span>
                          <span>{order._payment.receiptNumber}</span>
                        </>
                      )}
                      {!order._payment.linked && <span className="text-red-400">• No POS link</span>}
                    </div>
                  )}

                  {!inRoute && (
                    <div className="space-y-2 pt-1 border-t border-gray-800">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleRouteOrder(order.id, 'sendToEnamelsDelivery')} disabled={actionLoading === order.id + 'sendToEnamelsDelivery'}
                          className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-[9px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'sendToEnamelsDelivery' ? <RefreshCcw className="animate-spin" size={13} /> : <Truck size={13} />} Enamels Delivery Boy
                        </button>
                        <button onClick={() => handleRouteOrder(order.id, 'sendToOutlet', 'Jail Road')} disabled={actionLoading === order.id + 'sendToOutlet'}
                          className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[9px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'sendToOutlet' ? <RefreshCcw className="animate-spin" size={13} /> : <Send size={13} />} Send to Jail Road
                        </button>
                        <button onClick={() => handleRouteOrder(order.id, 'sendToOutlet', 'Johar Town')} disabled={actionLoading === order.id + 'sendToOutlet'}
                          className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-[9px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'sendToOutlet' ? <RefreshCcw className="animate-spin" size={13} /> : <MapPin size={13} />} Send to Johar Town
                        </button>
                        <button onClick={() => handleRouteOrder(order.id, 'sendToDispatch')} disabled={actionLoading === order.id + 'sendToDispatch'}
                          className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[9px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'sendToDispatch' ? <RefreshCcw className="animate-spin" size={13} /> : <Layers size={13} />} Send to Dispatch
                        </button>
                        <button onClick={() => handleRouteOrder(order.id, 'customerTakeDeliver')} disabled={actionLoading === order.id + 'customerTakeDeliver'}
                          className="col-span-2 flex flex-col items-center justify-center gap-1 px-2 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[9px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'customerTakeDeliver' ? <RefreshCcw className="animate-spin" size={13} /> : <UserCheck size={13} />} Customer Take
                        </button>
                      </div>
                      {order._payment?.linked && order._payment?.remaining > 0.01 && (
                        <button onClick={() => openClearBalance(order)} disabled={actionLoading === order.id + 'clearBalance'}
                          className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-amber-600/90 hover:bg-amber-600 disabled:opacity-50 text-white text-[10px] font-bold rounded-xl transition-all">
                          {actionLoading === order.id + 'clearBalance' ? <RefreshCcw className="animate-spin" size={13} /> : <Wallet size={13} />} Clear Balance — ₨{(order._payment.remaining || 0).toLocaleString()}
                        </button>
                      )}
                      <button onClick={() => handlePrintSlipClick(order)}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-2 bg-gray-800 hover:bg-violet-700 disabled:opacity-50 text-gray-300 hover:text-white text-[10px] font-bold rounded-xl transition-all border border-gray-700/60">
                        <Printer size={13} /> Print Dispatch Slip
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Delivery Route Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-lg bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <RouteIcon size={18} className="text-cyan-400" />
                  <p className="text-white font-black">Create Delivery Route</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white"><XCircle size={20} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Route Name *</label>
                  <input value={routeForm.routeName} onChange={e => setRouteForm({ ...routeForm, routeName: e.target.value })}
                    placeholder="e.g. Gulberg Morning Run" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Area</label>
                    <input value={routeForm.area} onChange={e => setRouteForm({ ...routeForm, area: e.target.value })}
                      placeholder="e.g. DHA Phase 5" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Delivery Person</label>
                    <input value={routeForm.deliveryPerson} onChange={e => setRouteForm({ ...routeForm, deliveryPerson: e.target.value })}
                      placeholder="e.g. Enamels Delivery" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Notes</label>
                  <textarea value={routeForm.notes} onChange={e => setRouteForm({ ...routeForm, notes: e.target.value })}
                    placeholder="Optional notes for this delivery run" rows={2}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none resize-none" />
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">Selected Orders ({selectedOrders.length})</p>
                {selectedOrders.length === 0 ? (
                  <p className="text-xs text-gray-600 bg-gray-800/40 rounded-xl px-3 py-3">No orders selected. Use "Add to Route" on the queue cards.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                    {selectedOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-xs font-bold text-white">{o.orderNumber}</p>
                          <p className="text-[11px] text-gray-400">{o.customerName}</p>
                        </div>
                        <button onClick={() => toggleSelect(o.id)} className="text-[10px] text-red-400 hover:text-red-300 font-black">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleCreateRoute} disabled={creating || selectedForRoute.size === 0}
                className="w-full mt-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                {creating ? <RefreshCcw className="animate-spin" size={16} /> : <RouteIcon size={16} />}
                Create Delivery Route
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Balance Modal */}
      <AnimatePresence>
        {clearBalanceOrder && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm" onClick={() => setClearBalanceOrder(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md bg-gray-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Wallet size={18} className="text-amber-400" />
                  <p className="text-white font-black">Clear Balance</p>
                </div>
                <button onClick={() => setClearBalanceOrder(null)} className="text-gray-500 hover:text-white"><XCircle size={20} /></button>
              </div>

              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 mb-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Order</span>
                  <span className="text-sm font-black text-white">{clearBalanceOrder.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Customer</span>
                  <span className="text-xs font-bold text-gray-300">{clearBalanceOrder.customerName || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Total Amount</span>
                  <span className="text-xs font-bold text-white">₨{(clearBalanceOrder._payment?.total || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Already Paid</span>
                  <span className="text-xs font-bold text-emerald-400">₨{(clearBalanceOrder._payment?.paid || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-700/60">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Remaining Balance</span>
                  <span className="text-base font-black text-amber-400">₨{(clearBalanceOrder._payment?.remaining || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Balance Amount *</label>
                  <input type="number" value={clearAmount} onChange={e => setClearAmount(e.target.value)} min="0"
                    placeholder="0" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-amber-500/60 outline-none" />
                  <p className="text-[10px] text-gray-500 mt-1">Full remaining balance is pre-filled. Enter a partial amount to collect only part of it.</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Payment Method</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {['CASH', 'ONLINE', 'CARD', 'CASH_ONLINE'].map(m => (
                      <button key={m} onClick={() => setClearMethod(m)}
                        className={`px-2 py-2 rounded-xl text-[10px] font-black transition-all border ${clearMethod === m ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800/70 text-gray-400 border-gray-700/60 hover:border-amber-500/50'}`}>
                        {methodLabel(m)}
                      </button>
                    ))}
                  </div>
                </div>
                {clearMethod === 'CASH_ONLINE' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Cash Amount</label>
                      <input type="number" value={clearCashAmount} onChange={e => setClearCashAmount(e.target.value)} min="0"
                        placeholder="0" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-amber-500/60 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Online Amount</label>
                      <input type="number" value={clearOnlineAmount} onChange={e => setClearOnlineAmount(e.target.value)} min="0"
                        placeholder="0" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-amber-500/60 outline-none" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <button onClick={handleClearBalance} disabled={clearingBalance}
                  className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                  {clearingBalance ? <RefreshCcw className="animate-spin" size={16} /> : <Wallet size={16} />}
                  {clearingBalance ? 'Clearing Balance...' : `Clear Balance & Print Slip`}
                </button>
                <button onClick={() => { setClearBalanceOrder(null); printDispatchSlip(clearBalanceOrder); }}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-all border border-gray-700/60">
                  Skip — Print Slip Only
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InDispatch;
