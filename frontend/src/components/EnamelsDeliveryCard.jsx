import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, Truck, User, Package, Activity, X, RefreshCw, Banknote, Clock, CheckCircle2, Eye, ChevronDown, ChevronUp, Calendar, Filter } from 'lucide-react';
import socket from '../socket';
import { isPaidOrder, getCodAmount } from '../utils/paymentUtils';

const COLORS = {
  pending: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  active: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  delivered: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  returned: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  noResponse: { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  total: { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  cash: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  online: { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  cashOnline: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

const PRESETS = [
  { key: 'today', label: 'Today', getRange: () => { const d = new Date(); d.setHours(0,0,0,0); return { dateFrom: d.toISOString(), dateTo: new Date().toISOString() }; } },
  { key: 'yesterday', label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate()-1); d.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); return { dateFrom: d.toISOString(), dateTo: e.toISOString() }; } },
  { key: 'week', label: 'This Week', getRange: () => { const d = new Date(); const s = new Date(d); s.setDate(s.getDate()-s.getDay()); s.setHours(0,0,0,0); return { dateFrom: s.toISOString(), dateTo: new Date().toISOString() }; } },
  { key: 'month', label: 'This Month', getRange: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); return { dateFrom: s.toISOString(), dateTo: new Date().toISOString() }; } },
  { key: 'custom', label: 'Custom Range' },
];

const OrderDetailModal = ({ order, onClose }) => {
  if (!order) return null;
  const attempts = order.deliveryAttempts || [];
  const payments = order.deliveryPayments || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="glass max-w-lg w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Delivery Details</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 transition-all"><X size={16} className="theme-text-muted" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Order #</p>
              <p className="text-sm font-black theme-text-primary">#{order.orderNumber || order.id?.slice(0, 8)}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Customer</p>
              <p className="text-sm font-black theme-text-primary">{order.customerName || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Phone</p>
              <p className="text-sm font-black theme-text-primary">{order.customerPhone || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">City</p>
              <p className="text-sm font-black theme-text-primary">{order.city || '—'}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Amount</p>
              <p className="text-sm font-black text-emerald-400">₨{parseFloat(order.totalPrice || 0).toLocaleString()}</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Status</p>
              <p className="text-sm font-black theme-text-primary">{order.currentStage?.replace(/_/g, ' ') || '—'}</p>
            </div>
            {order.riderName && (
              <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Assigned Rider</p>
                <p className="text-sm font-black text-indigo-400">{order.riderName}</p>
              </div>
            )}
          </div>
          {order.address && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Address</p>
              <p className="text-xs font-bold theme-text-primary">{order.address}</p>
            </div>
          )}
          {attempts.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Attempts</p>
              <div className="space-y-1.5">
                {attempts.map((a, i) => (
                  <div key={a.id || i} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'DELIVERED' ? 'bg-emerald-400' : a.status === 'NO_RESPONSE' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="font-bold theme-text-primary">{a.status}</span>
                    <span className="text-gray-600">—</span>
                    {a.riderName && <span className="font-bold text-indigo-400">{a.riderName}</span>}
                    <span className="text-gray-600">—</span>
                    <span className="font-bold text-gray-400">{a.attemptedAt ? new Date(a.attemptedAt).toLocaleString() : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {payments.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Payments</p>
              <div className="space-y-1.5">
                {payments.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between text-[10px]">
                    <span className="font-bold theme-text-primary">{p.paymentMethod}</span>
                    <span className="font-black text-emerald-400">₨{((p.cashAmount || 0) + (p.onlineAmount || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const InlineOrderList = ({ orders, title, onClose }) => (
  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    className="overflow-hidden">
    <div className="glass rounded-2xl p-4 border theme-border mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-black theme-text-primary uppercase tracking-wider">{title} ({orders.length})</h4>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-all"><X size={14} className="theme-text-muted" /></button>
      </div>
      <div className="max-h-[300px] overflow-y-auto space-y-1.5">
        {orders.length === 0 ? (
          <p className="text-xs theme-text-muted font-bold text-center py-6">No orders found</p>
        ) : orders.map(o => {
          const attempts = o.deliveryAttempts || [];
          return (
            <div key={o.id} className="flex items-center justify-between p-2.5 theme-bg-subtle rounded-xl border theme-border hover:border-emerald-500/30 transition-all cursor-pointer">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-black theme-text-primary shrink-0">#{o.orderNumber || o.id?.slice(0, 6)}</span>
                <span className="text-xs font-bold theme-text-muted truncate">{o.customerName || '—'}</span>
                {o.riderName && <span className="text-[10px] font-bold text-indigo-400 shrink-0">{o.riderName}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-gray-500">{attempts.length} attempts</span>
                <span className="text-xs font-black text-emerald-400">₨{parseFloat(o.totalPrice || 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </motion.div>
);

const PayEmployeeModal = ({ employee, onClose, onSuccess }) => {
  const [payAmount, setPayAmount] = useState(employee?.remainingPayable || 0);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!payAmount || payAmount <= 0) return toast.error('Enter a valid amount');
    setLoading(true);
    try {
      await api.post('/api/delivery/pay-employee', {
        riderName: employee.name,
        amount: parseFloat(payAmount),
        paidByName: 'Super Admin',
        remarks: remarks || `Paid ${employee.name} ₨${parseFloat(payAmount).toLocaleString()}`
      });
      toast.success(`Paid ₨${parseFloat(payAmount).toLocaleString()} to ${employee.name}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="glass max-w-md w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Pay Delivery Employee</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 transition-all"><X size={16} className="theme-text-muted" /></button>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 mb-4">
          <p className="text-xs font-black text-emerald-400 mb-1">{employee.name}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-gray-500">Earnings:</span> <span className="font-black text-emerald-400">₨{employee.totalEarnings?.toLocaleString()}</span></div>
            <div><span className="text-gray-500">Already Paid:</span> <span className="font-black text-blue-400">₨{employee.totalPaid?.toLocaleString()}</span></div>
            <div className="col-span-2"><span className="text-gray-500">Remaining Payable:</span> <span className="font-black text-amber-400">₨{employee.remainingPayable?.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Payment Amount (PKR)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
              max={employee.remainingPayable}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-black theme-text-primary focus:outline-none focus:border-emerald-500 transition-all" />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1 block">Remarks (Optional)</label>
            <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Payment notes..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold theme-text-primary focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-600" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all">Cancel</button>
          <button onClick={handlePay} disabled={loading || !payAmount || payAmount <= 0}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Banknote size={14} />}
            Confirm Payment
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PaymentHistoryModal = ({ payments, employeeName, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      onClick={e => e.stopPropagation()}
      className="glass max-w-lg w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Payment History</h3>
          {employeeName && <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{employeeName}</p>}
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-800 transition-all"><X size={16} className="theme-text-muted" /></button>
      </div>
      {!payments || payments.length === 0 ? (
        <div className="text-center py-10"><p className="theme-text-muted font-black uppercase text-xs">No payments recorded</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
              <th className="text-left py-2 pr-3">#</th>
              <th className="text-left px-2">Date</th>
              <th className="text-left px-2">Time</th>
              <th className="text-left px-2">Paid By</th>
              <th className="text-left px-2">Remarks</th>
              <th className="text-right px-2">Amount</th>
              <th className="text-right pl-2">Orders</th>
            </tr></thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id || i} className="border-t border-gray-800">
                  <td className="py-2 pr-3 font-bold theme-text-primary">{i + 1}</td>
                  <td className="px-2 font-bold">{new Date(p.paidAt).toLocaleDateString()}</td>
                  <td className="px-2 text-gray-400">{new Date(p.paidAt).toLocaleTimeString()}</td>
                  <td className="px-2 font-bold text-blue-400">{p.paidByName || '—'}</td>
                  <td className="px-2 font-bold text-gray-400 max-w-[120px] truncate">{p.remarks || '—'}</td>
                  <td className="px-2 font-black text-emerald-400 text-right">₨{(p.totalAmount || 0).toLocaleString()}</td>
                  <td className="pl-2 font-bold text-gray-400 text-right">{p.chargeCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  </div>
);

const EmployeeCard = ({ emp, onPay, onViewHistory }) => {
  const [expanded, setExpanded] = useState(false);
  const paidPercent = emp.totalEarnings > 0 ? Math.round((emp.totalPaid / emp.totalEarnings) * 100) : 0;

  return (
    <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <User size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black theme-text-primary uppercase">{emp.name}</p>
              <p className="text-[10px] font-bold text-gray-500">{emp.totalDelivered} deliveries @ ₨{emp.ratePerDelivery}/order</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {emp.remainingPayable > 0 && (
              <button onClick={() => onPay(emp)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all">
                <Banknote size={12} /> Pay
              </button>
            )}
            <button onClick={() => onViewHistory(emp)}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-all">
              <Clock size={14} className="theme-text-muted" />
            </button>
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-all">
              {expanded ? <ChevronUp size={14} className="theme-text-muted" /> : <ChevronDown size={14} className="theme-text-muted" />}
            </button>
          </div>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${paidPercent}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Assigned</p>
            <p className="text-sm font-black text-blue-400">{emp.totalAssigned}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Delivered</p>
            <p className="text-sm font-black text-emerald-400">{emp.totalDelivered}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Active</p>
            <p className="text-sm font-black text-indigo-400">{emp.activeDeliveries}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Returned</p>
            <p className="text-sm font-black text-red-400">{emp.returnedOrders}</p>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-800">
            <div className="p-4 bg-gray-900/30">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Total Earnings</p>
                  <p className="text-lg font-black text-emerald-400">₨{(emp.totalEarnings || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Amount Paid</p>
                  <p className="text-lg font-black text-blue-400">₨{(emp.totalPaid || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1">Remaining</p>
                  <p className="text-lg font-black text-amber-400">₨{(emp.remainingPayable || 0).toLocaleString()}</p>
                </div>
              </div>
              {emp.paymentHistory?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Recent Payments</p>
                  {emp.paymentHistory.slice(0, 5).map((p, i) => (
                    <div key={p.id || i} className="flex items-center justify-between text-[10px] py-1 border-t border-gray-800">
                      <span className="text-gray-400">{new Date(p.paidAt).toLocaleDateString()}</span>
                      <span className="font-bold text-gray-400">{p.paidByName || '—'}</span>
                      <span className="font-black text-emerald-400">₨{(p.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EnamelsDeliveryCard = ({ activeTab }) => {
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [charges, setCharges] = useState({ charges: [], totalPending: 0, payments: [], totalPaid: 0 });
  const [codSummary, setCodSummary] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [employeeStats, setEmployeeStats] = useState({ employees: [], paymentAnalytics: {} });
  const [activityData, setActivityData] = useState({ audits: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyEmployee, setHistoryEmployee] = useState('');
  const refreshRef = useRef(null);

  const [datePreset, setDatePreset] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateParams, setDateParams] = useState(() => PRESETS[0].getRange());

  useEffect(() => {
    if (datePreset === 'custom') {
      if (customFrom && customTo) {
        setDateParams({ dateFrom: new Date(customFrom).toISOString(), dateTo: new Date(customTo + 'T23:59:59').toISOString() });
      }
    } else {
      const preset = PRESETS.find(p => p.key === datePreset);
      if (preset?.getRange) setDateParams(preset.getRange());
    }
  }, [datePreset, customFrom, customTo]);

  const buildUrl = useCallback((base, params = {}) => {
    const qs = new URLSearchParams();
    if (dateParams?.dateFrom) qs.set('dateFrom', dateParams.dateFrom);
    if (dateParams?.dateTo) qs.set('dateTo', dateParams.dateTo);
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return `${base}?${qs.toString()}`;
  }, [dateParams]);

  const fetchData = useCallback(async () => {
    const safeGet = async (url, fallback) => { try { const r = await api.get(url); return r.data; } catch { return fallback; } };
    const [ordersRes, chargesRes, codRes, perfRes, empStatsRes, actRes] = await Promise.all([
      safeGet(buildUrl('/api/delivery/orders', { deliveryType: 'ENAMELS' }), []),
      safeGet(buildUrl('/api/delivery/charges'), { charges: [], totalPending: 0, payments: [], totalPaid: 0 }),
      safeGet(buildUrl('/api/delivery/cod'), null),
      safeGet(buildUrl('/api/delivery/performance'), null),
      safeGet(buildUrl('/api/delivery/employee-stats'), { employees: [], paymentAnalytics: {} }),
      safeGet(buildUrl('/api/delivery/activity'), { audits: [], orders: [] }),
    ]);
    setDeliveryOrders(Array.isArray(ordersRes) ? ordersRes : []);
    setCharges(chargesRes || { charges: [], totalPending: 0, payments: [], totalPaid: 0 });
    setCodSummary(codRes);
    setPerformance(perfRes);
    setEmployeeStats(empStatsRes || { employees: [], paymentAnalytics: {} });
    setActivityData(actRes || { audits: [], orders: [] });
    setLoading(false);
  }, [buildUrl]);

  useEffect(() => { if (activeTab === 'enamels_delivery') fetchData(); }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'enamels_delivery') return;
    refreshRef.current = setInterval(fetchData, 30000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [activeTab, fetchData]);

  useEffect(() => {
    if (activeTab !== 'enamels_delivery') return;
    const refresh = () => fetchData();
    socket.on('order-updated', refresh);
    socket.on('delivery-updated', refresh);
    return () => { socket.off('order-updated', refresh); socket.off('delivery-updated', refresh); };
  }, [activeTab, fetchData]);

  const computedStats = useMemo(() => {
    const active = deliveryOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY').length;
    const delivered = deliveryOrders.filter(o => o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED').length;
    const returned = deliveryOrders.filter(o => o.status === 'RETURNED').length;
    const noResponse = deliveryOrders.filter(o => (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED').length;
    const pending = deliveryOrders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && !o.riderAcceptedAt).length;

    const filteredEarnings = performance?.filteredEarnings || 0;
    const filteredDelivered = performance?.filteredDelivered || 0;

    let cashTotal = 0, onlineTotal = 0, cashOnlineTotal = 0;
    deliveryOrders.filter(o => o.deliveryPayments?.length > 0).forEach(o => {
      o.deliveryPayments.forEach(p => {
        if (p.paymentMethod === 'CASH') cashTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
        else if (p.paymentMethod === 'ONLINE') onlineTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
        else if (p.paymentMethod === 'CASH_ONLINE') cashOnlineTotal += (p.cashAmount || 0) + (p.onlineAmount || 0);
      });
    });

    return {
      totalAssigned: deliveryOrders.length,
      active, pending, delivered, returned, noResponse,
      filteredDelivered, filteredEarnings,
      earningsToday: performance?.deliveredToday * 200 || 0,
      earningsWeek: performance?.deliveredThisWeek * 200 || 0,
      earningsMonth: performance?.deliveredThisMonth * 200 || 0,
      earningsLifetime: (performance?.allTimeDelivered || 0) * 200,
      cashTotal, onlineTotal, cashOnlineTotal,
    };
  }, [deliveryOrders, performance]);

  const filteredOrders = useMemo(() => {
    if (!selectedFilter) return [];
    return deliveryOrders.filter(o => {
      if (selectedFilter === 'pending') return o.currentStage === 'OUT_FOR_DELIVERY' && !o.riderAcceptedAt;
      if (selectedFilter === 'active') return o.currentStage === 'OUT_FOR_DELIVERY' && o.riderAcceptedAt;
      if (selectedFilter === 'delivered') return o.currentStage === 'DELIVERED' || o.currentStage === 'COMPLETED';
      if (selectedFilter === 'returned') return o.status === 'RETURNED';
      if (selectedFilter === 'noResponse') return (o.noResponseCount || 0) > 0 && o.currentStage !== 'DELIVERED';
      return false;
    });
  }, [deliveryOrders, selectedFilter]);

  const handlePayEmployee = (emp) => { setSelectedEmployee(emp); setShowPayModal(true); };

  const handleViewHistory = async (emp) => {
    setHistoryEmployee(emp.name);
    try {
      const qs = new URLSearchParams({ riderName: emp.name });
      if (dateParams?.dateFrom) qs.set('dateFrom', dateParams.dateFrom);
      if (dateParams?.dateTo) qs.set('dateTo', dateParams.dateTo);
      const res = await api.get(`/api/delivery/payment-history?${qs.toString()}`);
      setHistoryPayments(res.data?.payments || []);
    } catch { setHistoryPayments(emp.paymentHistory || []); }
    setShowHistoryModal(true);
  };

  const handleStatClick = (filterKey) => { setSelectedFilter(prev => prev === filterKey ? null : filterKey); };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>;
  }

  const pa = employeeStats.paymentAnalytics || {};
  const activePresetLabel = PRESETS.find(p => p.key === datePreset)?.label || 'Custom';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <Truck className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">Enamels Delivery Analytics</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Real-time delivery tracking & employee payments</p>
          </div>
        </div>
        <button onClick={() => { if (refreshRef.current) clearInterval(refreshRef.current); fetchData(); refreshRef.current = setInterval(fetchData, 30000); }}
          disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="glass rounded-2xl p-4 border-2 theme-border">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-emerald-400" />
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Date Range Filter</p>
          <span className="text-[10px] font-black text-emerald-400 ml-auto">{activePresetLabel}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setDatePreset(p.key)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                datePreset === p.key ? 'bg-emerald-600 text-white' : 'theme-bg-subtle theme-text-muted hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="flex items-center gap-3 mt-3">
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold theme-text-primary focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold theme-text-primary focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}
      </div>

      {/* 1. Overall Summary */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-emerald-400" /> Overall Delivery Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Assigned', key: 'total', value: computedStats.totalAssigned, filterKey: null },
            { label: 'Active', key: 'active', value: computedStats.active, filterKey: 'active' },
            { label: 'Pending', key: 'pending', value: computedStats.pending, filterKey: 'pending' },
            { label: 'Delivered', key: 'delivered', value: computedStats.delivered, filterKey: 'delivered' },
            { label: 'Returned', key: 'returned', value: computedStats.returned, filterKey: 'returned' },
            { label: 'No Response', key: 'noResponse', value: computedStats.noResponse, filterKey: 'noResponse' },
            { label: 'Date-Filtered Delivered', key: 'delivered', value: computedStats.filteredDelivered, filterKey: 'delivered' },
            { label: 'Date-Filtered Earnings', key: 'total', value: `₨${computedStats.filteredEarnings.toLocaleString()}`, filterKey: null },
          ].map(card => {
            const c = COLORS[card.key] || COLORS.total;
            return (
              <div key={card.label} onClick={() => handleStatClick(card.filterKey)}
                className={`${c.bg} rounded-2xl p-3 border ${c.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className={`text-xl font-black ${c.text}`}>{card.value || 0}</p>
                {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {selectedFilter && (
            <InlineOrderList orders={filteredOrders} title={`${selectedFilter} delivery orders`} onClose={() => setSelectedFilter(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* 2. Delivery Performance */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Delivery Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Delivered Today', value: performance?.deliveredToday || 0, color: 'text-emerald-400' },
            { label: 'Delivered This Week', value: performance?.deliveredThisWeek || 0, color: 'text-indigo-400' },
            { label: 'Delivered This Month', value: performance?.deliveredThisMonth || 0, color: 'text-purple-400' },
            { label: 'All Time Deliveries', value: performance?.allTimeDelivered || 0, color: 'text-amber-400' },
          ].map(card => (
            <div key={card.label} className="theme-bg-subtle rounded-2xl p-3 border theme-border text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Delivery Earnings */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider flex items-center gap-2">
            <User size={16} className="text-emerald-400" /> Delivery Earnings (₨200/order)
          </h3>
          {charges.totalPending > 0 && (
            <button onClick={async () => {
              if (!window.confirm(`Clear ALL ₨${charges.totalPending.toLocaleString()} outstanding earnings for all delivery employees?`)) return;
              try {
                await api.post('/api/delivery/charges/clear');
                toast.success(`Cleared ₨${charges.totalPending.toLocaleString()} — all employees paid`);
                fetchData();
              } catch (err) { toast.error(err.response?.data?.message || 'Clear failed'); }
            }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all">
              <Banknote size={14} /> Clear All Payments (₨{(charges.totalPending || 0).toLocaleString()})
            </button>
          )}
          {(!charges.totalPending || charges.totalPending === 0) && (
            <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> All Paid
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Today's Earnings", value: computedStats.earningsToday },
            { label: 'Weekly Earnings', value: computedStats.earningsWeek },
            { label: 'Monthly Earnings', value: computedStats.earningsMonth },
            { label: 'Lifetime Earnings', value: computedStats.earningsLifetime },
          ].map(card => (
            <div key={card.label} className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className="text-xl font-black text-emerald-400">₨{(card.value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
        {charges.totalPending > 0 && (
          <div className="mt-3 theme-bg-subtle rounded-xl p-3 border theme-border flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Outstanding Earnings</p>
              <p className="text-lg font-black text-amber-400">₨{(charges.totalPending || 0).toLocaleString()}</p>
            </div>
            <p className="text-[10px] font-bold text-gray-500">{employeeStats.employees?.length || 0} employees • {charges.charges?.length || 0} unpaid orders</p>
          </div>
        )}
      </div>

      {/* 4. Payment Analytics */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-purple-400" /> Payment Analytics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Cash Collected', value: computedStats.cashTotal, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Online Collected', value: computedStats.onlineTotal, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
            { label: 'Cash+Online', value: computedStats.cashOnlineTotal, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
            { label: 'Pending COD', value: codSummary?.pendingCODAmount || 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-3 border ${card.border} text-center`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className={`text-xl font-black ${card.color}`}>₨{(card.value || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Employee Payment Management */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Banknote size={16} className="text-emerald-400" /> Employee Payment Management
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Total Earnings</p>
            <p className="text-lg font-black text-emerald-400">₨{(pa.totalEarnings || 0).toLocaleString()}</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Total Paid</p>
            <p className="text-lg font-black text-blue-400">₨{(pa.totalPaid || 0).toLocaleString()}</p>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-3 border border-amber-500/20 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Outstanding</p>
            <p className="text-lg font-black text-amber-400">₨{(pa.totalOutstanding || 0).toLocaleString()}</p>
          </div>
          <div className="bg-purple-500/10 rounded-xl p-3 border border-purple-500/20 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Payments Made</p>
            <p className="text-lg font-black text-purple-400">{pa.totalPayments || 0}</p>
          </div>
          <div className="bg-indigo-500/10 rounded-xl p-3 border border-indigo-500/20 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Last Payment</p>
            <p className="text-sm font-black text-indigo-400">{pa.lastPaymentDate ? new Date(pa.lastPaymentDate).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        {employeeStats.employees?.length === 0 ? (
          <div className="text-center py-8"><p className="theme-text-muted font-black uppercase text-xs">No delivery employees found</p></div>
        ) : (
          <div className="space-y-4">
            {employeeStats.employees?.map(emp => (
              <EmployeeCard key={emp.name} emp={emp} onPay={handlePayEmployee} onViewHistory={handleViewHistory} />
            ))}
          </div>
        )}
      </div>

      {/* 6. Activity Timeline */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" /> Activity Timeline
        </h3>
        {activityData.audits?.length === 0 && activityData.orders?.length === 0 ? (
          <div className="text-center py-10"><p className="theme-text-muted font-black uppercase text-xs">No activity in selected date range</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                <th className="text-left py-2 pr-2">Order#</th>
                <th className="text-left px-2">Customer</th>
                <th className="text-left px-2">City</th>
                <th className="text-left px-2">Rider</th>
                <th className="text-left px-2">Action</th>
                <th className="text-left pl-2">Date & Time</th>
              </tr></thead>
              <tbody>
                {activityData.audits?.slice(0, 50).map(audit => {
                  const order = audit.order;
                  const riderFromDetails = audit.details?.match(/Rider (.+?) accepted|by (.+?) via|by (.+?):/);
                  const riderName = order?.riderName || riderFromDetails?.[1] || riderFromDetails?.[2] || riderFromDetails?.[3] || '—';
                  return (
                    <tr key={audit.id} className="border-t border-gray-800 hover:bg-white/5 cursor-pointer"
                      onClick={() => order && setSelectedOrder({ ...order, deliveryAttempts: [], deliveryPayments: [], noResponseLogs: [] })}>
                      <td className="py-2 pr-2 font-bold theme-text-primary">#{order?.orderNumber || audit.orderId?.slice(0, 6)}</td>
                      <td className="px-2 font-bold">{order?.customerName || '—'}</td>
                      <td className="px-2">{order?.city || '—'}</td>
                      <td className="px-2 font-bold text-indigo-400">{riderName}</td>
                      <td className="px-2">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          audit.action === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' :
                          audit.action === 'DELIVERY_ACCEPTED' ? 'bg-blue-500/20 text-blue-400' :
                          audit.action === 'DISPATCH_RETURNED' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>{audit.action?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="pl-2 text-[10px] text-gray-500">
                        {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. COD Collection */}
      {codSummary && (
        <div className="glass rounded-2xl p-5 border-2 theme-border">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <Package size={16} className="text-purple-400" /> COD Collection Summary
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="theme-bg-subtle rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Date-Filtered COD</p>
              <p className="text-xl font-black text-emerald-400">₨{(codSummary.filteredCODAmount || 0).toLocaleString()}</p>
              <p className="text-[10px] font-bold text-gray-500">{codSummary.filteredCODOrders || 0} orders</p>
            </div>
            <div className="theme-bg-subtle rounded-xl p-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Pending COD</p>
              <p className="text-xl font-black text-amber-400">₨{(codSummary.pendingCODAmount || 0).toLocaleString()}</p>
              <p className="text-[10px] font-bold text-gray-500">{codSummary.pendingCODOrders || 0} orders</p>
            </div>
          </div>
          {codSummary.pendingDeliveries?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="text-left py-1 pr-2">Order#</th>
                  <th className="text-left px-2">Customer</th>
                  <th className="text-left px-2">Method</th>
                  <th className="text-right pl-2">Amount</th>
                </tr></thead>
                <tbody>
                  {codSummary.pendingDeliveries.slice(0, 20).map(o => {
                    const remaining = isPaidOrder(o) ? 0 : getCodAmount(o);
                    return (
                      <tr key={o.id} className="border-t border-gray-800">
                        <td className="py-1 pr-2 font-bold theme-text-primary">#{o.orderNumber || o.id?.slice(0, 6)}</td>
                        <td className="px-2 font-bold">{o.customerName || '—'}</td>
                        <td className="px-2 text-[10px] font-bold text-gray-400">{o.paymentMethod || 'CASH'}</td>
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

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      </AnimatePresence>

      {/* Pay Employee Modal */}
      <AnimatePresence>
        {showPayModal && selectedEmployee && (
          <PayEmployeeModal employee={selectedEmployee} onClose={() => { setShowPayModal(false); setSelectedEmployee(null); }}
            onSuccess={() => { setShowPayModal(false); setSelectedEmployee(null); fetchData(); }} />
        )}
      </AnimatePresence>

      {/* Payment History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <PaymentHistoryModal payments={historyPayments} employeeName={historyEmployee}
            onClose={() => { setShowHistoryModal(false); setHistoryPayments([]); setHistoryEmployee(''); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnamelsDeliveryCard;
