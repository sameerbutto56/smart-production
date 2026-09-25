import React, { useState, useMemo, useEffect, useCallback } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import {
  DollarSign, CreditCard, TrendingUp, Users, CheckCircle2, Clock as ClockIcon,
  Package, Truck, ArrowDownToLine, RefreshCcw, Search, Eye, Filter, Edit3,
  Building2, Hash, Calendar, Phone, AlertCircle, ChevronRight, X, FileText,
  ShieldCheck, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

const fmtCurrency = (n) => `Rs. ${(n || 0).toLocaleString()}`;

export default function AsmFinancialDashboard({ isAdmin, onViewOrder }) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [activeSubTab, setActiveSubTab] = useState('vendors'); // 'vendors' | 'payments'
  
  // Drawer states
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [vendorDetail, setVendorDetail] = useState(null);
  const [vendorDetailLoading, setVendorDetailLoading] = useState(false);

  // Edit Payment Modal state
  const [editingPayment, setEditingPayment] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState('CASH');
  const [editType, setEditType] = useState('ADDITIONAL');
  const [editRef, setEditRef] = useState('');
  const [editChequeNo, setEditChequeNo] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editChequeDate, setEditChequeDate] = useState('');
  const [editStatus, setEditStatus] = useState('CLEARED');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Fetch financial summary
  const { data: finData, loading, error, refresh } = useCache('asm:financial-summary', {
    fetcher: () => api.get('/api/vendors/financial-summary').then((r) => r.data || {}),
    ttl: 30000,
  });

  const summary = finData?.summary || {
    totalOrders: 0,
    totalOrderValue: 0,
    totalAdvanceReceived: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalSpentFulfilled: 0,
    totalOutstanding: 0,
  };

  const methodBreakdown = finData?.methodBreakdown || {};
  const vendorSummary = Array.isArray(finData?.vendorSummary) ? finData.vendorSummary : [];
  const recentPayments = Array.isArray(finData?.recentPayments) ? finData.recentPayments : [];

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return vendorSummary;
    return vendorSummary.filter((v) =>
      String(v.vendorName || '').toLowerCase().includes(q) ||
      String(v.companyName || '').toLowerCase().includes(q) ||
      String(v.phone || '').toLowerCase().includes(q)
    );
  }, [vendorSummary, searchTerm]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    let list = recentPayments;
    if (paymentMethodFilter !== 'ALL') {
      list = list.filter((p) => {
        const m = String(p.paymentMethod || '').toUpperCase();
        if (paymentMethodFilter === 'ONLINE_BANK') return m === 'ONLINE' || m === 'BANK_TRANSFER';
        return m === paymentMethodFilter;
      });
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        String(p.order?.orderNumber || '').toLowerCase().includes(q) ||
        String(p.order?.vendor?.name || '').toLowerCase().includes(q) ||
        String(p.reference || '').toLowerCase().includes(q) ||
        String(p.chequeNumber || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [recentPayments, paymentMethodFilter, searchTerm]);

  // Load vendor detail view
  const openVendorDetail = async (vendorId) => {
    setSelectedVendorId(vendorId);
    setVendorDetailLoading(true);
    try {
      const res = await api.get(`/api/vendors/${vendorId}/financials`);
      setVendorDetail(res.data || null);
    } catch (err) {
      toast.error('Failed to load vendor financial detail');
    } finally {
      setVendorDetailLoading(false);
    }
  };

  const closeVendorDetail = () => {
    setSelectedVendorId(null);
    setVendorDetail(null);
  };

  // Open edit payment modal
  const openEditPayment = (p) => {
    setEditingPayment(p);
    setEditAmount(String(p.amount || ''));
    setEditMethod(p.paymentMethod || 'CASH');
    setEditType(p.paymentType || 'ADDITIONAL');
    setEditRef(p.reference || '');
    setEditChequeNo(p.chequeNumber || '');
    setEditBank(p.bankName || '');
    setEditChequeDate(p.chequeDate ? p.chequeDate.slice(0, 10) : '');
    setEditStatus(p.status || 'CLEARED');
    setEditNotes(p.notes || '');
    setEditReason('');
  };

  const closeEditPayment = () => {
    setEditingPayment(null);
  };

  // Save edited payment
  const handleSavePaymentEdit = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) return toast.error('Enter a valid positive payment amount');
    if (!editReason.trim()) return toast.error('A reason for editing this payment is required for the audit trail');

    setSavingPayment(true);
    try {
      const res = await api.put(`/api/vendors/payments/${editingPayment.id}`, {
        amount: amt,
        paymentType: editType,
        paymentMethod: editMethod,
        reference: editRef,
        chequeNumber: editChequeNo,
        bankName: editBank,
        chequeDate: editChequeDate || null,
        status: editStatus,
        notes: editNotes,
        reason: editReason.trim(),
      });
      toast.success(res.data?.message || 'Payment updated and audit recorded');
      closeEditPayment();
      refresh();
      if (selectedVendorId) {
        openVendorDetail(selectedVendorId);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update payment');
    } finally {
      setSavingPayment(false);
    }
  };

  // Calculate percentage of paid vs order value
  const paidPercent = summary.totalOrderValue > 0
    ? Math.min(100, Math.round((summary.totalPaid / summary.totalOrderValue) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* ── TOP SECTION: 7 STAT SUMMARY CARDS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              ASM Bulk Orders Financial Overview
            </h2>
            <p className="text-xs text-slate-400">
              Complete authoritative financial ledger, payments, advances, and vendor-wise positions
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Financials
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total ASM Orders</p>
            <p className="text-xl font-black text-white mt-1">{summary.totalOrders}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Bulk requests placed</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Total Order Value</p>
            <p className="text-xl font-black text-white mt-1">{fmtCurrency(summary.totalOrderValue)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Gross order value</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Advance Received</p>
            <p className="text-xl font-black text-amber-400 mt-1">{fmtCurrency(summary.totalAdvanceReceived)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Initial advance received</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Total Paid</p>
            <p className="text-xl font-black text-emerald-400 mt-1">{fmtCurrency(summary.totalPaid)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{paidPercent}% of gross value</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Total Remaining</p>
            <p className="text-xl font-black text-rose-400 mt-1">{fmtCurrency(summary.totalRemaining)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Outstanding balance</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">Spent / Fulfilled</p>
            <p className="text-xl font-black text-teal-300 mt-1">{fmtCurrency(summary.totalSpentFulfilled)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Allocated / delivered</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Total Outstanding</p>
            <p className="text-xl font-black text-indigo-300 mt-1">{fmtCurrency(summary.totalOutstanding)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Active non-completed</p>
          </div>
        </div>
      </div>

      {/* ── VISUAL FINANCIAL CHART & METHOD BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress & Financial Comparison */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" /> Financial Progress
            </h3>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {paidPercent}% Collected
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${paidPercent}%` }}
              title={`Total Paid: ${fmtCurrency(summary.totalPaid)}`}
            />
            <div
              className="bg-rose-500/70 h-full transition-all duration-500"
              style={{ width: `${100 - paidPercent}%` }}
              title={`Remaining: ${fmtCurrency(summary.totalRemaining)}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <p className="text-slate-400">Total Paid</p>
              <p className="text-base font-bold text-emerald-400 mt-0.5">{fmtCurrency(summary.totalPaid)}</p>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
              <p className="text-slate-400">Remaining Balance</p>
              <p className="text-base font-bold text-rose-400 mt-0.5">{fmtCurrency(summary.totalRemaining)}</p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-800/30 p-2.5 rounded-xl border border-slate-800">
            <p className="font-semibold text-slate-300">Data Integrity Rule:</p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
              Total Order Value ({fmtCurrency(summary.totalOrderValue)}) = Paid ({fmtCurrency(summary.totalPaid)}) + Remaining ({fmtCurrency(summary.totalRemaining)})
            </p>
          </div>
        </div>

        {/* Payment Method Breakdown Cards */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" /> Payment Method Breakdown
              </h3>
              <p className="text-xs text-slate-400">Reconciled breakdown from valid payment transaction records</p>
            </div>
            <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              Total: {fmtCurrency(summary.totalPaid)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Cash */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>💵 Cash</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  {methodBreakdown.CASH?.count || 0} txns
                </span>
              </div>
              <p className="text-base font-bold text-white mt-1.5">{fmtCurrency(methodBreakdown.CASH?.amount || 0)}</p>
              <p className="text-[10px] text-emerald-400 mt-1">Cleared</p>
            </div>

            {/* Online / Bank Transfer */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>🌐 Online / Bank</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  {((methodBreakdown.ONLINE?.count || 0) + (methodBreakdown.BANK_TRANSFER?.count || 0))} txns
                </span>
              </div>
              <p className="text-base font-bold text-cyan-300 mt-1.5">
                {fmtCurrency((methodBreakdown.ONLINE?.amount || 0) + (methodBreakdown.BANK_TRANSFER?.amount || 0))}
              </p>
              <p className="text-[10px] text-cyan-400 mt-1">Cleared & Traced</p>
            </div>

            {/* Cheque */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>📄 Cheque</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  {methodBreakdown.CHEQUE?.count || 0} cleared
                </span>
              </div>
              <p className="text-base font-bold text-amber-300 mt-1.5">{fmtCurrency(methodBreakdown.CHEQUE?.amount || 0)}</p>
              <p className="text-[10px] text-amber-400 mt-1">
                {(methodBreakdown.CHEQUE?.pendingCount || 0) > 0
                  ? `Pending: ${fmtCurrency(methodBreakdown.CHEQUE?.pendingAmount || 0)} (${methodBreakdown.CHEQUE?.pendingCount})`
                  : 'Zero pending cheques'}
              </p>
            </div>

            {/* Card / Other */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>💳 Card / Other</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                  {((methodBreakdown.CARD?.count || 0) + (methodBreakdown.OTHER?.count || 0))} txns
                </span>
              </div>
              <p className="text-base font-bold text-violet-300 mt-1.5">
                {fmtCurrency((methodBreakdown.CARD?.amount || 0) + (methodBreakdown.OTHER?.amount || 0))}
              </p>
              <p className="text-[10px] text-violet-400 mt-1">Processed</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS: VENDOR-WISE FINANCIAL SUMMARY VS COMPLETE PAYMENT HISTORY ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('vendors')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'vendors'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" /> Vendor-Wise Financial Summary
            </button>
            <button
              onClick={() => setActiveSubTab('payments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'payments'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="h-4 w-4" /> Complete Payment History Ledger
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeSubTab === 'vendors' ? 'Search vendor name / phone...' : 'Search order #, vendor, ref...'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            {activeSubTab === 'payments' && (
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="ONLINE_BANK">Online / Bank</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
              </select>
            )}
          </div>
        </div>

        {/* ── SUB-TAB 1: VENDOR-WISE FINANCIAL SUMMARY TABLE ── */}
        {activeSubTab === 'vendors' && (
          <div className="overflow-x-auto">
            {filteredVendors.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm font-semibold">
                No vendors found with recorded bulk orders
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Vendor</th>
                    <th className="py-3 px-3 text-center">Orders</th>
                    <th className="py-3 px-3 text-right">Total Order Value</th>
                    <th className="py-3 px-3 text-right">Advance Received</th>
                    <th className="py-3 px-3 text-right">Total Paid</th>
                    <th className="py-3 px-3 text-right">Remaining Balance</th>
                    <th className="py-3 px-3 text-center">Payment Status</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredVendors.map((v) => {
                    const isFullyPaid = v.remaining <= 0.01 && v.totalOrderValue > 0;
                    const isPartiallyPaid = v.totalPaid > 0 && !isFullyPaid;
                    const isUnpaid = v.totalPaid <= 0.01;

                    return (
                      <tr key={v.vendorId} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-semibold text-white">
                          <div>
                            <span className="font-bold text-slate-100">{v.vendorName}</span>
                            {v.companyName && <span className="text-slate-400 text-[10px] ml-1.5">({v.companyName})</span>}
                          </div>
                          {v.phone && <p className="text-[10px] text-slate-500">{v.phone}</p>}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-300">{v.ordersCount}</td>
                        <td className="py-3 px-3 text-right font-bold text-blue-300">{fmtCurrency(v.totalOrderValue)}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">{fmtCurrency(v.advancePaid)}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">{fmtCurrency(v.totalPaid)}</td>
                        <td className="py-3 px-3 text-right font-bold text-rose-400">{fmtCurrency(v.remaining)}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isFullyPaid
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isPartiallyPaid
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isFullyPaid ? 'PAID' : isPartiallyPaid ? 'PARTIALLY PAID' : 'UNPAID'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => openVendorDetail(v.vendorId)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white font-bold text-xs transition shadow"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── SUB-TAB 2: COMPLETE PAYMENT HISTORY LEDGER TABLE ── */}
        {activeSubTab === 'payments' && (
          <div className="overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm font-semibold">
                No payment transactions found
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3">Date / Time</th>
                    <th className="py-3 px-3">Vendor</th>
                    <th className="py-3 px-3">Bulk Order #</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-center">Method</th>
                    <th className="py-3 px-3 text-center">Type</th>
                    <th className="py-3 px-3">Reference / Cheque Details</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Recorded By</th>
                    {isAdmin && <th className="py-3 px-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredPayments.map((p) => {
                    const isCheque = String(p.paymentMethod || '').toUpperCase() === 'CHEQUE';
                    const isCleared = p.status === 'CLEARED' || !p.status;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {formatDateTime(p.paymentDate || p.createdAt)}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {p.order?.vendor?.name || '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-400">
                          {p.order?.orderNumber || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-emerald-400 text-sm">
                          {fmtCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
                            {p.paymentType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {isCheque ? (
                            <div className="text-[11px]">
                              <p className="font-semibold text-amber-300">Chq #: {p.chequeNumber || 'N/A'}</p>
                              {p.bankName && <p className="text-slate-400 text-[10px]">{p.bankName}</p>}
                              {p.chequeDate && <p className="text-slate-500 text-[10px]">Chq Date: {formatDateOnly(p.chequeDate)}</p>}
                            </div>
                          ) : (
                            <span>{p.reference || p.notes || '—'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isCleared
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {p.status || 'CLEARED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 text-[11px]">
                          {p.recordedBy || 'Admin'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => openEditPayment(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700"
                            >
                              <Edit3 className="h-3 w-3" /> Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── VENDOR FINANCIAL DETAIL DRAWER ── */}
      {selectedVendorId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                  {vendorDetail?.vendor?.name || 'Vendor Financial Details'}
                </h2>
                <p className="text-xs text-slate-400">
                  {vendorDetail?.vendor?.companyName ? `${vendorDetail.vendor.companyName} · ` : ''}
                  {vendorDetail?.vendor?.phone || ''}
                </p>
              </div>
              <button onClick={closeVendorDetail} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {vendorDetailLoading ? (
                <div className="py-12 text-center text-slate-500 font-bold">Loading vendor financials...</div>
              ) : !vendorDetail ? (
                <div className="py-12 text-center text-red-400 font-bold">Failed to load vendor details</div>
              ) : (
                <>
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Orders</p>
                      <p className="text-lg font-black text-white mt-0.5">{vendorDetail.totals?.totalOrders}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">Order Value</p>
                      <p className="text-lg font-black text-blue-300 mt-0.5">{fmtCurrency(vendorDetail.totals?.totalOrderValue)}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Total Paid</p>
                      <p className="text-lg font-black text-emerald-400 mt-0.5">{fmtCurrency(vendorDetail.totals?.totalPaid)}</p>
                    </div>
                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                      <p className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold">Remaining</p>
                      <p className="text-lg font-black text-rose-400 mt-0.5">{fmtCurrency(vendorDetail.totals?.totalRemaining)}</p>
                    </div>
                  </div>

                  {/* Bulk Orders List */}
                  <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-800 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Package className="h-4 w-4 text-amber-400" />
                      Bulk Orders for this Vendor ({vendorDetail.orders?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {(vendorDetail.orders || []).map((o) => (
                        <div key={o.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{o.orderNumber}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {o.currentStage}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                o.paymentStatus === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : o.paymentStatus === 'PARTIALLY_PAID'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}>
                                {o.paymentStatus.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {o.totalUnits} units requested · {o.allocatedUnits || 0} units allocated · {formatDateOnly(o.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{fmtCurrency(o.grandTotal)}</p>
                            <p className="text-[10px] text-emerald-400 font-semibold">Paid: {fmtCurrency(o.paidAmount)}</p>
                            <p className="text-[10px] text-rose-400 font-semibold">Rem: {fmtCurrency(o.remainingBalance)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chronological Payment History for Vendor */}
                  <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-800 space-y-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-400" />
                      Vendor Payment History ({vendorDetail.payments?.length || 0})
                    </h3>
                    <div className="space-y-2">
                      {(vendorDetail.payments || []).length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">No payment transactions recorded for this vendor</p>
                      ) : (
                        vendorDetail.payments.map((p) => (
                          <div key={p.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-400 text-xs">{fmtCurrency(p.amount)}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                  {p.paymentType}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {p.paymentMethod}
                                </span>
                                {p.status && (
                                  <span className="text-[10px] font-bold text-slate-400">
                                    Status: {p.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">
                                Order: <span className="text-amber-400 font-semibold">{p.orderNumber}</span> · {formatDateTime(p.paymentDate)} · By {p.recordedBy || 'Admin'}
                                {p.reference ? ` · Ref: ${p.reference}` : ''}
                                {p.chequeNumber ? ` · Chq #: ${p.chequeNumber} (${p.bankName || ''})` : ''}
                              </p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => openEditPayment(p)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Payment Audits (if any corrections were made) */}
                  {(vendorDetail.audits || []).length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4" /> Payment Correction Audit Logs
                      </h4>
                      <div className="space-y-1.5">
                        {vendorDetail.audits.map((a) => (
                          <div key={a.id} className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                            <span className="text-amber-400 font-semibold">{fmtCurrency(a.previousAmount)} → {fmtCurrency(a.newAmount)}</span>
                            <span className="text-slate-400 ml-2">({a.difference > 0 ? `+${fmtCurrency(a.difference)}` : fmtCurrency(a.difference)})</span>
                            <span className="text-slate-500 ml-2">by {a.editedBy} at {formatDateTime(a.createdAt)}</span>
                            {a.reason && <p className="text-slate-400 text-[10px] mt-0.5 font-medium">Reason: {a.reason}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / CORRECT PAYMENT MODAL ── */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-amber-400" />
                  Edit / Correct Payment Record
                </h3>
                <p className="text-xs text-slate-400">Order: {editingPayment.order?.orderNumber || editingPayment.orderNumber}</p>
              </div>
              <button onClick={closeEditPayment} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentEdit} className="space-y-3">
              {/* Financial Difference Indicator */}
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Original Amount:</span>
                  <span className="font-bold text-white ml-1.5">{fmtCurrency(editingPayment.amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400">Difference:</span>
                  <span className={`font-black ml-1.5 ${
                    (parseFloat(editAmount) || 0) - editingPayment.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {((parseFloat(editAmount) || 0) - editingPayment.amount) >= 0 ? '+' : ''}
                    {fmtCurrency((parseFloat(editAmount) || 0) - editingPayment.amount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Amount (Rs.)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="ONLINE">Online</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="ADVANCE">Advance</option>
                    <option value="ADDITIONAL">Additional Payment</option>
                    <option value="BALANCE">Balance</option>
                    <option value="FULL">Full Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                  >
                    <option value="CLEARED">CLEARED (Recognized)</option>
                    <option value="PENDING">PENDING (Uncleared Cheque)</option>
                    <option value="BOUNCED">BOUNCED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Cheque Specific Fields */}
              {editMethod === 'CHEQUE' && (
                <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/60 space-y-2.5">
                  <p className="text-[11px] font-bold text-amber-400">Cheque Information</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Cheque Number</label>
                      <input
                        type="text"
                        value={editChequeNo}
                        onChange={(e) => setEditChequeNo(e.target.value)}
                        placeholder="e.g. 1045892"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={editBank}
                        onChange={(e) => setEditBank(e.target.value)}
                        placeholder="e.g. Meezan Bank"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Cheque Date</label>
                      <input
                        type="date"
                        value={editChequeDate}
                        onChange={(e) => setEditChequeDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Online / Bank Transfer Reference */}
              {(editMethod === 'ONLINE' || editMethod === 'BANK_TRANSFER') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Transaction / Reference ID</label>
                  <input
                    type="text"
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    placeholder="e.g. TXN-8921820"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-amber-300 mb-1">
                  Reason for Correction (Mandatory Audit Trail)*
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Entered incorrect digit from bank slip / Cheque bounced"
                  className="w-full bg-slate-800 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeEditPayment}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingPayment ? 'Saving...' : 'Save Correction & Log Audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
