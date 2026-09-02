import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, Truck, User, Package, Activity, X, RefreshCw, Banknote, Clock, CheckCircle2, ChevronDown, ChevronUp, Calendar, MapPin, Phone, Filter, Building2 } from 'lucide-react';
import socket from '../socket';
import { formatDateOnly, formatTimeOnly, formatDateTime } from '../utils/dateTime';
import { STATUS_BADGE, STATUS_LABEL, STAT_COLORS } from '../utils/deliveryStatusUtils';
import useDateRange from '../hooks/useDateRange';

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'custom', label: 'Custom Range' },
];

const C = STAT_COLORS;

/* ─── Carry-forward helpers ─── */
/* Carry On = any unresolved order (Pending/Active/No Response) still active
   for next day; NOT Delivered, Completed, Cancelled, or Final Return. */
const CARRY_FORWARD_TERMINAL = ['delivered', 'returned', 'cancelled'];
const isCarryForwardOrder = (order) => {
  if (CARRY_FORWARD_TERMINAL.includes(order?.primaryStatus)) return false;
  const raw = order?.timeline?.assignedAt;
  if (!raw) return false;
  const d = new Date(raw);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
};

const formatDuration = (mins) => {
  if (mins == null || isNaN(mins)) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
};

const fmt = (d) => (d ? formatDateTime(d) : '—');
const fmtDate = (d) => (d ? formatDateOnly(d) : '—');

const OrderDetailModal = ({ order, onClose }) => {
  if (!order) return null;
  const attempts = order.attempts || [];
  const payments = order.payments || [];
  const t = order.timeline || {};
  const charge = order.deliveryCharge;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="glass max-w-lg w-full p-6 rounded-[2rem] border-2 theme-border shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">Delivery Details</h3>
            <p className="text-[10px] font-black uppercase tracking-wider">
              <span className={STATUS_BADGE[order.primaryStatus] || 'bg-gray-500/20 text-gray-400'} style={{ padding: '2px 8px', borderRadius: 8 }}>
                {STATUS_LABEL[order.primaryStatus] || order.primaryStatus || '—'}
              </span>
            </p>
          </div>
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
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Outlet</p>
              <p className="text-sm font-black text-purple-400">{order.outletName || '—'}</p>
            </div>
            {order.riderName && (
              <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Rider</p>
                <p className="text-sm font-black text-indigo-400">{order.riderName}</p>
              </div>
            )}
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Duration</p>
              <p className="text-sm font-black theme-text-primary">{formatDuration(t.durationMinutes)}</p>
            </div>
          </div>

          {/* Delivery Timeline */}
          <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Timeline</p>
            <div className="space-y-1.5">
              {[['Assigned', t.assignedAt], ['Accepted', t.acceptedAt], ['Picked Up', t.pickedUpAt], ['Delivered', t.deliveredAt], ['Returned', t.returnedAt], ['No Response', t.noResponseAt]].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-gray-400">{label}</span>
                  <span className={`font-black ${val ? 'text-emerald-400' : 'text-gray-600'}`}>{fmt(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {charge && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Earnings</p>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold theme-text-primary">Rider {charge.riderName || order.riderName || '—'}</span>
                <span className={`font-black ${charge.isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ₨{(charge.amount || 0).toLocaleString()} {charge.isPaid ? '• Paid' : '• Pending'}
                </span>
              </div>
            </div>
          )}

          {attempts.length > 0 && (
            <div className="theme-bg-subtle rounded-xl p-3 border theme-border">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Attempts</p>
              <div className="space-y-1.5">
                {attempts.map((a, i) => (
                  <div key={a.id || i} className="flex items-center gap-2 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'DELIVERED' ? 'bg-emerald-400' : a.status === 'NO_RESPONSE' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <span className="font-bold theme-text-primary">{a.status?.replace(/_/g, ' ')}</span>
                    <span className="text-gray-600">—</span>
                    {a.riderName && <span className="font-bold text-indigo-400">{a.riderName}</span>}
                    <span className="text-gray-600">—</span>
                    <span className="font-bold text-gray-400">{fmt(a.attemptedAt)}</span>
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
                    <span className="font-bold theme-text-primary">{p.paymentMethod?.replace(/_/g, ' ')}</span>
                    <span className="font-black text-emerald-400">₨{((p.cashAmount || 0) + (p.onlineAmount || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="theme-bg-subtle rounded-xl p-3 border theme-border grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-gray-500">Cash Collected:</span> <span className="font-black text-emerald-400">₨{(order.cashCollected || 0).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Online:</span> <span className="font-black text-purple-400">₨{(order.onlineCollected || 0).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Outstanding:</span> <span className="font-black text-amber-400">₨{(order.outstanding || 0).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Advance:</span> <span className="font-black text-blue-400">₨{(order.advanceAmount || 0).toLocaleString()}</span></div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const InlineOrderList = ({ orders, title, onClose, onSelect }) => (
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
        ) : orders.map(o => (
          <div key={o.id} onClick={() => onSelect && onSelect(o)}
            className="flex items-center justify-between p-2.5 theme-bg-subtle rounded-xl border theme-border hover:border-emerald-500/30 transition-all cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-black theme-text-primary shrink-0">#{o.orderNumber || o.id?.slice(0, 6)}</span>
              <span className="text-xs font-bold theme-text-muted truncate">{o.customerName || '—'}</span>
              {o.riderName && <span className="text-[10px] font-bold text-indigo-400 shrink-0">{o.riderName}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-gray-500">{o.outletName || '—'}</span>
              <span className="text-xs font-black text-emerald-400">₨{parseFloat(o.totalPrice || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
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
        riderName: employee.riderName,
        amount: parseFloat(payAmount),
        paidByName: 'Super Admin',
        remarks: remarks || `Paid ${employee.riderName} ₨${parseFloat(payAmount).toLocaleString()}`
      });
      toast.success(`Paid ₨${parseFloat(payAmount).toLocaleString()} to ${employee.riderName}`);
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
          <p className="text-xs font-black text-emerald-400 mb-1">{employee.riderName}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span className="text-gray-500">Earnings:</span> <span className="font-black text-emerald-400">₨{(employee.totalEarnings || 0).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Already Paid:</span> <span className="font-black text-blue-400">₨{(employee.totalPaid || 0).toLocaleString()}</span></div>
            <div className="col-span-2"><span className="text-gray-500">Remaining Payable:</span> <span className="font-black text-amber-400">₨{(employee.remainingPayable || 0).toLocaleString()}</span></div>
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
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left px-1">Employee</th>
              <th className="text-left px-1">Date</th>
              <th className="text-left px-1">Time</th>
              <th className="text-left px-1">Paid By</th>
              <th className="text-left px-1">Remarks</th>
              <th className="text-right px-1">Amount</th>
              <th className="text-right pl-1">Orders</th>
            </tr></thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id || i} className="border-t border-gray-800">
                  <td className="py-2 pr-2 font-bold theme-text-primary">{i + 1}</td>
                  <td className="px-1 font-bold text-indigo-400">{p.riderName || '—'}</td>
                  <td className="px-1 font-bold">{formatDateOnly(p.paidAt)}</td>
                  <td className="px-1 text-gray-400">{formatTimeOnly(p.paidAt)}</td>
                  <td className="px-1 font-bold text-blue-400">{p.paidByName || '—'}</td>
                  <td className="px-1 font-bold text-gray-400 max-w-[100px] truncate" title={p.remarks || ''}>{p.remarks || '—'}</td>
                  <td className="px-1 font-black text-emerald-400 text-right">₨{(p.totalAmount || 0).toLocaleString()}</td>
                  <td className="pl-1 font-bold text-gray-400 text-right">{p.chargeCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  </div>
);

const RiderCard = ({ rider, onPay, onViewHistory }) => {
  const [expanded, setExpanded] = useState(false);
  const paidPercent = rider.totalEarnings > 0 ? Math.round((rider.totalPaid / rider.totalEarnings) * 100) : 0;

  return (
    <div className="glass rounded-2xl border-2 theme-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <User size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black theme-text-primary uppercase">{rider.riderName}</p>
              <p className="text-[10px] font-bold text-gray-500">{rider.completedDeliveries} deliveries @ ₨{(rider.perOrder?.[0]?.amount || 200)}/order</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rider.remainingPayable > 0 && (
              <button onClick={() => onPay(rider)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all">
                <Banknote size={12} /> Pay
              </button>
            )}
            <button onClick={() => onViewHistory(rider)}
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
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Delivered</p>
            <p className="text-sm font-black text-emerald-400">{rider.completedDeliveries}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Earnings</p>
            <p className="text-sm font-black text-emerald-400">₨{(rider.totalEarnings || 0).toLocaleString()}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Paid</p>
            <p className="text-sm font-black text-blue-400">₨{(rider.totalPaid || 0).toLocaleString()}</p>
          </div>
          <div className="theme-bg-subtle rounded-xl p-2">
            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Remaining</p>
            <p className="text-sm font-black text-amber-400">₨{(rider.remainingPayable || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-800">
            <div className="p-4 bg-gray-900/30">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Per-Order Earnings</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[8px]">
                    <th className="text-left py-1 pr-2">Order #</th>
                    <th className="text-left px-1">Customer</th>
                    <th className="text-left px-1">Delivered</th>
                    <th className="text-right pl-1">Amount</th>
                  </tr></thead>
                  <tbody>
                    {(rider.perOrder || []).map((po, i) => (
                      <tr key={po.orderId || i} className="border-t border-gray-800">
                        <td className="py-1.5 pr-2 font-bold theme-text-primary">#{po.orderNumber || po.orderId?.slice(0, 6)}</td>
                        <td className="px-1 font-bold text-gray-400">{po.customerName || '—'}</td>
                        <td className="px-1 font-bold text-gray-500">{fmtDate(po.deliveredAt)}</td>
                        <td className="text-right pl-1">
                          <span className={`font-black ${po.isPaid ? 'text-emerald-400' : 'text-amber-400'}`}>₨{(po.amount || 0).toLocaleString()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'All Order Statuses' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'ENAMELS_DELIVERY', label: 'Enamels Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: 'All Delivery Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'inTransit', label: 'In Transit' },
  { value: 'noResponse', label: 'No Response' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'All Payment Types' },
  { value: 'CASH', label: 'Cash' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CARD', label: 'Card' },
  { value: 'CASH_ONLINE', label: 'Cash + Online' },
  { value: 'MULTIPLE_ONLINE', label: 'Multiple Online' },
];

const EnamelsDeliveryCard = ({ activeTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyEmployee, setHistoryEmployee] = useState('');
  const [showOutstandingList, setShowOutstandingList] = useState(false);
  const refreshRef = useRef(null);

  const dateRange = useDateRange({ initialRange: 'today', presets: DATE_PRESETS });
  const [riderFilter, setRiderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [jailRoadOnly, setJailRoadOnly] = useState(false);

  const [deposits, setDeposits] = useState([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [depositActionLoading, setDepositActionLoading] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  const fetchDeposits = useCallback(async () => {
    setDepositsLoading(true);
    try {
      const res = await api.get('/api/delivery/deposits/all?status=PENDING');
      setDeposits(res.data.deposits || res.data || []);
    } catch (err) { console.error('Deposit fetch error:', err); }
    setDepositsLoading(false);
  }, []);

  const handleApproveDeposit = async (depositId) => {
    try {
      setDepositActionLoading(depositId);
      await api.put(`/api/delivery/deposits/${depositId}/approve`);
      toast.success('Deposit approved!');
      fetchDeposits();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to approve'); }
    finally { setDepositActionLoading(null); }
  };

  const handleRejectDeposit = async () => {
    if (!rejectTarget) return;
    try {
      setDepositActionLoading(rejectTarget);
      await api.put(`/api/delivery/deposits/${rejectTarget}/reject`, { reason: rejectReason.trim() || 'Rejected by admin' });
      toast.success('Deposit rejected');
      setRejectTarget(null); setRejectReason('');
      fetchDeposits();
    } catch (err) { toast.error(err?.response?.data?.message || 'Failed to reject'); }
    finally { setDepositActionLoading(null); }
  };

  useEffect(() => { if (activeTab === 'enamels_delivery') fetchDeposits(); }, [activeTab, fetchDeposits]);

  const buildUrl = useCallback(() => {
    const qs = new URLSearchParams();
    if (dateRange.startISO) qs.set('dateFrom', dateRange.startISO);
    if (dateRange.endISO) qs.set('dateTo', dateRange.endISO);
    if (riderFilter) qs.set('riderName', riderFilter);
    if (statusFilter) qs.set('status', statusFilter);
    if (deliveryStatusFilter) qs.set('deliveryStatus', deliveryStatusFilter);
    if (paymentFilter) qs.set('paymentType', paymentFilter);
    if (jailRoadOnly) qs.set('outlet', 'jail road');
    return `/api/delivery/analytics?${qs.toString()}`;
  }, [dateRange.startISO, dateRange.endISO, riderFilter, statusFilter, deliveryStatusFilter, paymentFilter, jailRoadOnly]);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(buildUrl());
      setData(res.data);
    } catch (err) {
      console.error('Enamels analytics fetch error:', err);
      toast.error('Failed to load delivery analytics');
    } finally {
      setLoading(false);
    }
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

  const stats = data?.stats || {};
  const earnings = data?.earnings || { totalEarnings: 0, totalPaid: 0, outstandingEarnings: 0, completedDeliveries: 0, perRider: [] };
  const riders = data?.riders || [];
  const orders = data?.orders || [];

  const carryForwardCount = useMemo(() => orders.filter(o => isCarryForwardOrder(o) && ['pending', 'inTransit', 'noResponse'].includes(o.primaryStatus)).length, [orders]);

  const filteredOrders = useMemo(() => {
    if (!selectedFilter) return [];
    return orders.filter(o => o.primaryStatus === selectedFilter);
  }, [orders, selectedFilter]);

  const outstandingOrders = useMemo(() => {
    if (!showOutstandingList) return [];
    return orders.filter(o => o.outstanding > 0.01).sort((a, b) => b.outstanding - a.outstanding);
  }, [orders, showOutstandingList]);

  const handlePayRider = (rider) => { setSelectedRider(rider); setShowPayModal(true); };

  const handleViewHistory = async (rider) => {
    setHistoryEmployee(rider.riderName);
    try {
      const qs = new URLSearchParams({ riderName: rider.riderName });
      if (dateRange.startISO) qs.set('dateFrom', dateRange.startISO);
      if (dateRange.endISO) qs.set('dateTo', dateRange.endISO);
      const res = await api.get(`/api/delivery/payment-history?${qs.toString()}`);
      setHistoryPayments(res.data?.payments || []);
    } catch { setHistoryPayments([]); }
    setShowHistoryModal(true);
  };

  const handleStatClick = (filterKey) => { setSelectedFilter(prev => prev === filterKey ? null : filterKey); };

  const activePresetLabel = dateRange.label;
  const jailStats = C.jail;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-400" size={32} /></div>;
  }

  const safeStats = stats || {};
  const statCards = [
    { label: 'Total Assigned', key: 'total', value: safeStats.totalAssigned || 0, filterKey: null },
    { label: 'Accepted', key: 'accepted', value: safeStats.accepted || 0, filterKey: null },
    { label: 'Picked-Up', key: 'pickedUp', value: safeStats.pickedUp || 0, filterKey: null },
    { label: 'Delivered', key: 'delivered', value: safeStats.delivered || 0, filterKey: 'delivered' },
    { label: 'Pending', key: 'pending', value: safeStats.pending || 0, filterKey: 'pending' },
    { label: 'In Transit', key: 'inTransit', value: safeStats.inTransit || 0, filterKey: 'inTransit' },
    { label: 'Carry Forward', key: 'carryForward', value: safeStats.carryForward ?? carryForwardCount, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', filterKey: null },
    { label: 'Returned', key: 'returned', value: safeStats.returned || 0, filterKey: 'returned' },
    { label: 'No Response', key: 'noResponse', value: safeStats.noResponse || 0, filterKey: 'noResponse' },
    { label: 'Cancelled', key: 'cancelled', value: safeStats.cancelled || 0, filterKey: 'cancelled' },
    { label: 'Failed', key: 'failed', value: safeStats.failed || 0, filterKey: 'failed' },
  ];

  const paymentCards = [
    { label: 'Total Order Value', value: safeStats.totalOrderValue || 0, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: '# Paid Orders', value: safeStats.paidOrderCount || 0, isCount: true, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Paid Orders Amount', value: safeStats.totalPaidAmount || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: '# COD Orders', value: safeStats.codOrderCount || 0, isCount: true, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'COD Expected Amount', value: safeStats.codExpectedAmount ?? safeStats.totalCOD ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { label: 'Cash Received', value: safeStats.cashReceived ?? safeStats.cashCollected ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', sub: (safeStats.totalDeposited || 0) > 0 ? `₨${safeStats.totalDeposited.toLocaleString()} deposited` : undefined },
    { label: 'Online Received', value: safeStats.onlineReceived ?? safeStats.onlinePrepaid ?? 0, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { label: 'Total Received', value: safeStats.totalReceived ?? 0, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    { label: 'Remaining COD', value: safeStats.remainingCOD ?? safeStats.overallOutstanding ?? 0, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  ];

  const selectClass = "bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-[10px] font-bold theme-text-primary focus:outline-none focus:border-emerald-500 cursor-pointer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10">
            <Truck className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">
              {jailRoadOnly ? 'Jail Road Orders' : 'Enamels Delivery Analytics'}
            </h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">
              {jailRoadOnly ? 'Jail Road outlet delivery tracking' : 'Real-time delivery tracking & employee payments'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {jailRoadOnly && (
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${jailStats.bg} ${jailStats.text} border ${jailStats.border} flex items-center gap-1.5`}>
              <MapPin size={12} /> Jail Road Only
            </span>
          )}
          <button onClick={() => { if (refreshRef.current) clearInterval(refreshRef.current); fetchData(); refreshRef.current = setInterval(fetchData, 30000); }}
            disabled={loading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-2xl p-4 border-2 theme-border">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-emerald-400" />
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Filters</p>
          <span className="text-[10px] font-black text-emerald-400 ml-auto">{activePresetLabel}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.key} onClick={() => dateRange.setRange(p.key)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                dateRange.range === p.key ? 'bg-emerald-600 text-white' : 'theme-bg-subtle theme-text-muted hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
          <span className="w-px bg-gray-700 mx-1" />
          <button onClick={() => setJailRoadOnly(!jailRoadOnly)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
              jailRoadOnly ? 'bg-purple-600 text-white' : 'theme-bg-subtle theme-text-muted hover:bg-gray-700'
            }`}>
            <MapPin size={12} /> Jail Road
          </button>
        </div>
        {dateRange.range === 'custom' && (
          <div className="flex items-center gap-3 mt-3">
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">From</label>
              <input type="date" value={dateRange.dateFrom} onChange={e => dateRange.setDateFrom(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold theme-text-primary focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-gray-500 mb-1 block">To</label>
              <input type="date" value={dateRange.dateTo} onChange={e => dateRange.setDateTo(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold theme-text-primary focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-4">
          <select value={riderFilter} onChange={e => setRiderFilter(e.target.value)} className={selectClass}>
            <option value="">All Riders</option>
            {riders.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
            {ORDER_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={deliveryStatusFilter} onChange={e => setDeliveryStatusFilter(e.target.value)} className={selectClass}>
            {DELIVERY_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className={selectClass}>
            {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 ml-auto text-[10px] font-bold text-gray-500">
            <Phone size={12} className="text-emerald-400" />
            {orders.length} order(s) shown
          </div>
        </div>
      </div>

      {/* Empty-window note — no delivery activity in the selected date range */}
      {orders.length === 0 && dateRange.range !== 'all' && !riderFilter && !statusFilter && !paymentFilter && (
        <div className="glass rounded-2xl p-4 border-2 border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <Calendar size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-400 uppercase tracking-wider">No delivery activity in this range</p>
            <p className="text-[11px] font-bold theme-text-muted mt-1">
              {activePresetLabel} has no delivery activity. Every order is counted on the day any delivery work happened — assigned, accepted,
              attempted, delivered, payment collected, or a charge recorded. A genuinely quiet day legitimately shows zero, even if riders
              were already working on older orders. Switch to Today, All Time, or a wider range to see activity.
            </p>
          </div>
        </div>
      )}

      {/* 1. Order Statistics */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Package size={16} className="text-emerald-400" /> Order Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statCards.map(card => {
            const c = card.color ? { bg: card.bg, text: card.color, border: card.border } : (C[card.key] || C.total);
            return (
              <div key={card.label} onClick={() => handleStatClick(card.filterKey)}
                className={`${c.bg} rounded-2xl p-3 border ${c.border} text-center transition-all ${card.filterKey ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
                <p className={`text-xl font-black ${c.text}`}>{card.value || 0}</p>
                {card.sub && <p className="text-[8px] font-bold text-amber-400 mt-0.5">{card.sub}</p>}
                {card.filterKey && <p className="text-[8px] font-bold text-gray-600 mt-0.5 uppercase">Click to view</p>}
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {selectedFilter && (
            <InlineOrderList orders={filteredOrders} title={`${STATUS_LABEL[selectedFilter] || selectedFilter} delivery orders`}
              onClose={() => setSelectedFilter(null)} onSelect={o => setSelectedOrder(o)} />
          )}
        </AnimatePresence>
      </div>

      {/* 2. Payment Breakdown */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-purple-400" /> Payment Breakdown
          </h3>
          <button onClick={() => setShowOutstandingList(!showOutstandingList)}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-400 transition-all hover:bg-amber-500/20">
            Outstanding: ₨{(stats.outstandingCollection || 0).toLocaleString()}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {paymentCards.map(card => (
            <div key={card.label} className={`${card.bg} rounded-2xl p-3 border ${card.border} text-center`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className={`text-xl font-black ${card.color}`}>
                {card.isCount ? (card.value || 0) : `₨${(card.value || 0).toLocaleString()}`}
              </p>
            </div>
          ))}
          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/20 text-center cursor-pointer hover:scale-[1.02] transition-all" onClick={() => setShowOutstandingList(!showOutstandingList)}>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Outstanding Collection</p>
            <p className="text-xl font-black text-amber-400">₨{(stats.outstandingCollection || 0).toLocaleString()}</p>
          </div>
        </div>
        <AnimatePresence>
          {showOutstandingList && (
            <InlineOrderList orders={outstandingOrders} title={`Orders with outstanding balance (${outstandingOrders.length})`}
              onClose={() => setShowOutstandingList(false)} onSelect={o => setSelectedOrder(o)} />
          )}
        </AnimatePresence>
      </div>

      {/* 3. Delivery Earnings */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider flex items-center gap-2">
            <Banknote size={16} className="text-emerald-400" /> Delivery Earnings (per order)
          </h3>
          {earnings.outstandingEarnings > 0 && (
            <button onClick={async () => {
              if (!window.confirm(`Clear ALL ₨${(earnings.outstandingEarnings || 0).toLocaleString()} outstanding earnings for all delivery employees?`)) return;
              try {
                await api.post('/api/delivery/charges/clear', {
                  paidByName: 'Super Admin',
                  remarks: `Bulk clear — ₨${(earnings.outstandingEarnings || 0).toLocaleString()} outstanding earnings`
                });
                toast.success(`Cleared ₨${(earnings.outstandingEarnings || 0).toLocaleString()} — all employees paid`);
                fetchData();
              } catch (err) { toast.error(err.response?.data?.message || 'Clear failed'); }
            }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all">
              <Banknote size={14} /> Clear All Payments (₨{(earnings.outstandingEarnings || 0).toLocaleString()})
            </button>
          )}
          {(!earnings.outstandingEarnings || earnings.outstandingEarnings === 0) && (
            <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> All Paid
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Earnings', value: earnings.totalEarnings },
            { label: 'Paid to Riders', value: earnings.totalPaid },
            { label: 'Outstanding (Payable)', value: earnings.outstandingEarnings },
            { label: 'Completed Deliveries', value: earnings.completedDeliveries },
          ].map(card => (
            <div key={card.label} className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{card.label}</p>
              <p className="text-xl font-black text-emerald-400">{typeof card.value === 'number' ? `₨${card.value.toLocaleString()}` : card.value}</p>
            </div>
          ))}
        </div>
        {earnings.outstandingEarnings > 0 && (
          <div className="mt-3 theme-bg-subtle rounded-xl p-3 border theme-border flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Outstanding Earnings</p>
              <p className="text-lg font-black text-amber-400">₨{(earnings.outstandingEarnings || 0).toLocaleString()}</p>
            </div>
            <p className="text-[10px] font-bold text-gray-500">{earnings.perRider?.length || 0} riders • {earnings.completedDeliveries || 0} deliveries</p>
          </div>
        )}
        <div className="mt-4 space-y-4">
          {earnings.perRider?.length === 0 ? (
            <div className="text-center py-8"><p className="theme-text-muted font-black uppercase text-xs">No delivery riders found</p></div>
          ) : (
            earnings.perRider.map(rider => (
              <RiderCard key={rider.riderName} rider={rider} onPay={handlePayRider} onViewHistory={handleViewHistory} />
            ))
          )}
        </div>
      </div>

      {/* 4. Delivery Timeline */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Clock size={16} className="text-indigo-400" /> Delivery Timeline & Timing
        </h3>
        {orders.length === 0 ? (
          <div className="text-center py-10">
            <p className="theme-text-muted font-black uppercase text-xs">{dateRange.range === 'all' ? 'No delivery orders found' : `No delivery activity in this range (${activePresetLabel})`}</p>
            <p className="text-[10px] font-bold theme-text-muted mt-2 max-w-md mx-auto">Orders are counted on the day any delivery activity happened — assigned, accepted, attempted, delivered, payment collected, or a charge recorded. A day with no activity shows an empty timeline.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="text-gray-500 font-black uppercase tracking-wider text-[9px]">
                <th className="text-left py-2 pr-2">Order #</th>
                <th className="text-left px-1">Customer</th>
                <th className="text-left px-1">Rider</th>
                <th className="text-left px-1">Outlet</th>
                <th className="text-left px-1">Assigned</th>
                <th className="text-left px-1">Accepted</th>
                <th className="text-left px-1">Picked Up</th>
                <th className="text-left px-1">Delivered</th>
                <th className="text-left px-1">Duration</th>
                <th className="text-left px-1">Status</th>
              </tr></thead>
              <tbody>
                {orders.slice(0, 100).map(o => (
                  <tr key={o.id} className="border-t border-gray-800 hover:bg-white/5 cursor-pointer"
                    onClick={() => setSelectedOrder(o)}>
                    <td className="py-2 pr-2 font-bold theme-text-primary">
                      #{o.orderNumber || o.id?.slice(0, 6)}
                      {isCarryForwardOrder(o) && (
                        <span className="ml-1.5 text-[8px] font-black text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded-full border border-amber-500/25 uppercase tracking-wider">
                          CARRY
                        </span>
                      )}
                    </td>
                    <td className="px-1 font-bold">{o.customerName || '—'}</td>
                    <td className="px-1 font-bold text-indigo-400">{o.riderName || '—'}</td>
                    <td className="px-1 text-gray-400">{o.outletName || '—'}</td>
                    <td className="px-1">
                      <span className="text-gray-400">{fmt(o.timeline?.assignedAt)}</span>
                      {isCarryForwardOrder(o) && <span className="block text-[8px] font-black text-amber-400 uppercase">Carry Forward</span>}
                    </td>
                    <td className="px-1 text-gray-400">{fmt(o.timeline?.acceptedAt)}</td>
                    <td className="px-1 text-gray-400">{fmt(o.timeline?.pickedUpAt)}</td>
                    <td className="px-1 text-emerald-400 font-bold">{fmt(o.timeline?.deliveredAt)}</td>
                    <td className="px-1 font-black text-gray-400">{formatDuration(o.timeline?.durationMinutes)}</td>
                    <td className="px-1">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${STATUS_BADGE[o.primaryStatus] || 'bg-gray-500/20 text-gray-400'}`}>
                        {STATUS_LABEL[o.primaryStatus] || o.primaryStatus || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length > 100 && (
              <p className="text-[10px] font-bold text-gray-500 mt-3 text-center">Showing first 100 of {orders.length} — click a row for full details</p>
            )}
          </div>
        )}
      </div>

      {/* 5. Delivery Boy Deposits — Pending Review */}
      <div className="glass rounded-2xl p-5 border-2 theme-border">
        <h3 className="text-sm font-black theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-amber-400" /> Delivery Boy Deposits — Pending Review
          {deposits.length > 0 && <span className="ml-auto px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-black">{deposits.length}</span>}
        </h3>
        {depositsLoading ? (
          <div className="text-center py-6"><Loader2 size={20} className="animate-spin text-gray-400 mx-auto" /></div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-6"><p className="theme-text-muted font-black uppercase text-xs">No pending deposits</p></div>
        ) : (
          <div className="space-y-3">
            {deposits.map(d => (
              <div key={d.id} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-blue-400">{d.deliveryBoy}</span>
                    <span className="text-[10px] text-gray-500 font-bold">{formatDateTime(d.createdAt)}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-black uppercase border border-amber-500/30">Pending Review</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-emerald-500/10 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-emerald-400 font-black uppercase">Cash</p>
                    <p className="text-sm font-black text-emerald-400">₨{(d.cashAmount || 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-lg p-2 text-center">
                    <p className="text-[9px] text-purple-400 font-black uppercase">Total</p>
                    <p className="text-sm font-black text-purple-400">₨{(d.totalAmount || 0).toLocaleString()}</p>
                  </div>
                </div>
                {d.bankRef && <p className="text-[10px] text-gray-400 font-bold mb-1">Bank Ref: {d.bankRef}</p>}
                {d.depositDate && <p className="text-[10px] text-gray-500 font-bold mb-1">Deposit Date: {new Date(d.depositDate).toLocaleDateString()}</p>}
                {d.reference && <p className="text-[10px] text-gray-400 font-bold mb-1">Ref: {d.reference}</p>}
                {d.notes && <p className="text-[10px] text-gray-500 font-bold mb-2">Notes: {d.notes}</p>}
                {rejectTarget === d.id ? (
                  <div className="flex gap-2 mt-2">
                    <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..."
                      className="flex-1 px-3 py-2 rounded-xl bg-gray-900 border border-red-500/30 text-xs font-bold text-white outline-none" />
                    <button onClick={handleRejectDeposit} disabled={!!depositActionLoading}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-black">Confirm</button>
                    <button onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                      className="px-3 py-2 bg-gray-700 text-white rounded-xl text-xs font-black">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleApproveDeposit(d.id)} disabled={!!depositActionLoading}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">
                      {depositActionLoading === d.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button onClick={() => setRejectTarget(d.id)} disabled={!!depositActionLoading}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all">Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
      </AnimatePresence>

      {/* Pay Employee Modal */}
      <AnimatePresence>
        {showPayModal && selectedRider && (
          <PayEmployeeModal employee={selectedRider} onClose={() => { setShowPayModal(false); setSelectedRider(null); }}
            onSuccess={() => { setShowPayModal(false); setSelectedRider(null); fetchData(); }} />
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
