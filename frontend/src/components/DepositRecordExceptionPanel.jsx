import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Banknote,
  Building2,
  Calendar,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
  Save,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  FileText,
  BadgeAlert,
  Check,
  X,
  CreditCard,
  Sliders,
} from 'lucide-react';

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const getPktDateString = () => {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  return new Date(pktMs).toISOString().slice(0, 10);
};

const getYesterdayPktDateString = () => {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;
  return new Date(pktMs).toISOString().slice(0, 10);
};

const fmtMoney = (n) => '₨' + Number(n || 0).toLocaleString();

const STATUS_BADGES = {
  DEPOSITED: { label: 'Deposited', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  CLEARED_BY_CARRY_FORWARD: { label: 'Cleared by Credit', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  PARTIALLY_DEPOSITED: { label: 'Partially Deposited', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  EXCESS: { label: 'Excess Deposited', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  PENDING: { label: 'Pending Deposit', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  CLEARED: { label: 'Cleared', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
};

const DepositRecordExceptionPanel = () => {
  const [selectedOutlet, setSelectedOutlet] = useState('Jail Road');
  const [businessDate, setBusinessDate] = useState(getPktDateString());

  // Record data state
  const [loading, setLoading] = useState(false);
  const [recordData, setRecordData] = useState(null);

  // Edit form state
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [actionType, setActionType] = useState('CORRECTION');
  const [saving, setSaving] = useState(false);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Audit history state
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch deposit record for selected outlet and business date
  const fetchRecord = useCallback(async () => {
    if (!selectedOutlet || !businessDate) return;
    setLoading(true);
    try {
      const res = await api.get('/api/software-settings/deposit-exception/record', {
        params: { outletName: selectedOutlet, businessDate },
      });
      setRecordData(res.data);
      // Pre-fill corrected amount with existing deposit amount if available
      setCorrectedAmount(String(res.data.totalDepositedAmount ?? 0));
      // Pre-fill bank or ref if single slip exists
      if (res.data.slips && res.data.slips.length === 1) {
        setBankName(res.data.slips[0].bankName || '');
        setReferenceNumber(res.data.slips[0].referenceNumber || '');
      } else {
        setBankName('');
        setReferenceNumber('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load deposit record');
      setRecordData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet, businessDate]);

  // Fetch audit history
  const fetchAuditHistory = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/api/software-settings/deposit-exception/history', {
        params: { outletName: selectedOutlet, limit: 30 },
      });
      setAuditHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to load audit history:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  useEffect(() => {
    fetchAuditHistory();
  }, [fetchAuditHistory]);

  const existingAmount = Number(recordData?.totalDepositedAmount || 0);
  const targetAmount = Math.max(0, parseFloat(correctedAmount) || 0);
  const diff = Math.round((targetAmount - existingAmount) * 100) / 100;
  const isReversal = targetAmount === 0 && existingAmount > 0;

  const handleOpenConfirm = (isDirectReversal = false) => {
    if (isDirectReversal) {
      setCorrectedAmount('0');
      setActionType('REVERSAL');
    } else {
      setActionType(targetAmount === 0 ? 'REVERSAL' : 'CORRECTION');
    }

    if (!reason || !reason.trim()) {
      toast.error('Please enter a reason or note explaining this change');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleExecuteCorrection = async () => {
    setSaving(true);
    try {
      const finalAmount = actionType === 'REVERSAL' ? 0 : targetAmount;
      const res = await api.post('/api/software-settings/deposit-exception/correct', {
        outletName: selectedOutlet,
        businessDate,
        correctedAmount: finalAmount,
        actionType,
        reason: reason.trim(),
        bankName: bankName.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
      });

      toast.success(res.data.message || 'Deposit record successfully updated!');
      setShowConfirmModal(false);
      setReason('');
      await fetchRecord();
      await fetchAuditHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update deposit record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 rounded-2xl border-2 border-gray-700 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-blue-400">
              <Banknote size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Deposit Record Edit / Reverse Exception</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Software Settings Only
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Correct or reverse bank deposit records for any business date. Automatically recalculates the deposit ledger, carry forward, and outlet totals without touching POS sales or register cash.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              fetchRecord();
              fetchAuditHistory();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-600 transition-all self-start md:self-auto"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Selection Bar: Outlet & Business Date ── */}
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Outlet Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-400" />
              1. Select Outlet
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTLETS.map((outlet) => (
                <button
                  key={outlet}
                  onClick={() => setSelectedOutlet(outlet)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    selectedOutlet === outlet
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-102 border border-blue-400'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                  }`}
                >
                  {outlet}
                </button>
              ))}
            </div>
          </div>

          {/* Business Date Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-emerald-400" />
              2. Select Business Date
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="bg-gray-800 border-2 border-gray-700 rounded-xl px-3.5 py-2 text-white font-bold text-sm focus:border-blue-500 focus:outline-none flex-1"
              />
              <button
                type="button"
                onClick={() => setBusinessDate(getPktDateString())}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  businessDate === getPktDateString()
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setBusinessDate(getYesterdayPktDateString())}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  businessDate === getYesterdayPktDateString()
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                Yesterday
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Work Area: Existing Record Overview & Correction Form ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-gray-900 border-2 border-gray-700 rounded-2xl">
          <Loader2 className="animate-spin text-blue-400 mb-3" size={32} />
          <p className="text-sm font-bold text-gray-400">Loading deposit record for {selectedOutlet} on {businessDate}...</p>
        </div>
      ) : recordData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Existing Deposit Status & Register Baseline (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Status Card */}
            <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Record Status</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-black border uppercase tracking-wider ${
                    STATUS_BADGES[recordData.status]?.cls || 'bg-gray-800 text-gray-300 border-gray-700'
                  }`}
                >
                  {STATUS_BADGES[recordData.status]?.label || recordData.status}
                </span>
              </div>

              {/* Deposit Metric Pills */}
              <div className="space-y-3">
                <div className="p-3.5 bg-gray-800/80 rounded-xl border border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Recorded Deposit Amount:</span>
                  <span className="text-lg font-black text-emerald-400">{fmtMoney(recordData.totalDepositedAmount)}</span>
                </div>

                <div className="p-3.5 bg-gray-800/50 rounded-xl border border-gray-700/60 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Available Cash (Base Required):</span>
                  <span className="text-sm font-black text-white">{fmtMoney(recordData.availableCash)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Remaining Short</span>
                    <span className="font-black text-orange-400 text-sm">{fmtMoney(recordData.pendingAmount)}</span>
                  </div>
                  <div className="p-2.5 bg-gray-800/40 rounded-xl border border-gray-700/50">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Excess Credit</span>
                    <span className="font-black text-blue-400 text-sm">{fmtMoney(recordData.excessAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Register Baseline Notice (Non-Editable Integrity Guard) */}
              <div className="p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert size={14} className="text-blue-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-300">Protected Register Baseline</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Generated Cash: <strong className="text-gray-200">{fmtMoney(recordData.generatedCash)}</strong> | General Entries: <strong className="text-gray-200">{fmtMoney(recordData.generalEntryReduction)}</strong>. Register data will not be modified by this exception.
                </p>
              </div>

              {/* Existing Deposit Slips */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Existing Deposit Slips ({recordData.slips?.length || 0}):
                </p>
                {recordData.slips && recordData.slips.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {recordData.slips.map((s, idx) => (
                      <div key={idx} className="bg-gray-800 p-2.5 rounded-xl border border-gray-700 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white">{fmtMoney(s.amount)}</span>
                          <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono font-bold">
                            {s.referenceNumber || 'NO REF'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>Bank: {s.bankName || 'General Bank'}</span>
                          <span>By: {s.createdByName || 'Staff'}</span>
                        </div>
                        {s.notes && <p className="text-[10px] text-gray-500 italic truncate">{s.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-800/40 p-3 rounded-xl border border-gray-800 text-center">
                    No deposit slips currently recorded for this date.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Edit / Reverse Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 shadow-lg space-y-5">
              <div className="border-b border-gray-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Sliders size={18} className="text-blue-400" />
                    Correct / Reverse Deposit Record
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Modifies the bank deposit record for <strong className="text-white">{selectedOutlet}</strong> on <strong className="text-white">{businessDate}</strong>.
                  </p>
                </div>
                {existingAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm(true)}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-black rounded-xl border border-red-500/30 transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={12} />
                    Reverse Deposit (₨0)
                  </button>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Corrected Amount Field */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>Corrected Deposit Amount (₨) *</span>
                    <span className="text-[11px] text-gray-400 lowercase font-normal">
                      previously: <strong className="text-gray-300">{fmtMoney(existingAmount)}</strong>
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₨</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={correctedAmount}
                      onChange={(e) => setCorrectedAmount(e.target.value)}
                      placeholder="e.g. 28000"
                      className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl pl-8 pr-4 py-2.5 text-white font-black text-base focus:outline-none"
                    />
                  </div>
                  {/* Quick Helper Buttons */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setCorrectedAmount(String(recordData.availableCash || 0))}
                      className="text-[11px] px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 font-bold"
                    >
                      Fill Available Cash ({fmtMoney(recordData.availableCash)})
                    </button>
                    {existingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCorrectedAmount('0')}
                        className="text-[11px] px-2.5 py-1 bg-red-950/30 hover:bg-red-900/40 text-red-300 rounded-lg border border-red-800/40 font-bold"
                      >
                        Set to ₨0 (Reversal)
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Difference Pill */}
                <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700 flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-bold">Financial Impact:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-400">{fmtMoney(existingAmount)}</span>
                    <ArrowRight size={13} className="text-gray-500" />
                    <span className="font-black text-white">{fmtMoney(targetAmount)}</span>
                    <span
                      className={`ml-1 font-black px-2 py-0.5 rounded text-[11px] ${
                        diff > 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : diff < 0
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {diff > 0 ? `+${fmtMoney(diff)}` : diff < 0 ? `-${fmtMoney(Math.abs(diff))}` : 'No Change'}
                    </span>
                  </div>
                </div>

                {/* Bank Name (Optional) & Reference Number (Optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Bank Name (Optional)</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Meezan Bank, Alfalah"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-3 py-2 text-white text-xs font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Slip / Reference # (Optional)</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. DEP-20260924-001"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-xl px-3 py-2 text-white text-xs font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Reason for Correction / Reversal (Required) */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-300 mb-1.5 flex items-center justify-between">
                    <span>Reason / Audit Note *</span>
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Required for Audit Trail</span>
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this deposit is being corrected or reversed (e.g. Bank slip misread as 25,000 instead of 28,000, validated against branch statement)..."
                    className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-white text-xs font-medium focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setCorrectedAmount(String(existingAmount));
                    setReason('');
                  }}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-all"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenConfirm(false)}
                  disabled={saving || (diff === 0 && !isReversal)}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 ${
                    isReversal
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <Save size={15} />
                  {isReversal ? 'Confirm & Reverse Deposit' : 'Save Corrected Deposit Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl border ${
                  actionType === 'REVERSAL'
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                }`}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Confirm {actionType === 'REVERSAL' ? 'Deposit Reversal' : 'Deposit Record Correction'}
                </h3>
                <p className="text-xs text-gray-400">
                  {selectedOutlet} • Business Date: {businessDate}
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-800/80 rounded-xl border border-gray-700 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Previous Deposit:</span>
                <span className="font-bold text-gray-200">{fmtMoney(existingAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Corrected Deposit:</span>
                <span className="font-black text-white text-sm">{fmtMoney(actionType === 'REVERSAL' ? 0 : targetAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-700">
                <span className="text-gray-400">Net Difference:</span>
                <span
                  className={`font-black ${
                    diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-300'
                  }`}
                >
                  {diff > 0 ? `+${fmtMoney(diff)}` : diff < 0 ? `-${fmtMoney(Math.abs(diff))}` : '₨0'}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <span className="text-gray-400 block mb-0.5">Audit Reason:</span>
                <p className="font-medium text-gray-200 italic bg-gray-900/60 p-2 rounded border border-gray-750">
                  "{reason}"
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300 leading-relaxed">
              <strong>Notice:</strong> This correction will immediately update the bank deposit ledger and recalculate carry-forward balances across all subsequent dates for {selectedOutlet}. The outlet portal will immediately reflect this change. POS sales and register cash will remain untouched.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCorrection}
                disabled={saving}
                className={`px-5 py-2 font-black text-xs rounded-xl uppercase tracking-wider text-white shadow-lg transition-all flex items-center gap-1.5 ${
                  actionType === 'REVERSAL'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/50'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'
                }`}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit History Table ── */}
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-purple-400" />
            <h3 className="text-base font-black text-white">Deposit Exception Audit History</h3>
            <span className="text-xs text-gray-400">({auditHistory.length} recorded operations)</span>
          </div>
          <button
            onClick={fetchAuditHistory}
            disabled={auditLoading}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw size={12} className={auditLoading ? 'animate-spin' : ''} />
            Refresh Log
          </button>
        </div>

        {auditLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="animate-spin text-purple-400" size={24} />
          </div>
        ) : auditHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-800/40">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Outlet</th>
                  <th className="py-2.5 px-3">Business Date</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Previous</th>
                  <th className="py-2.5 px-3">Corrected</th>
                  <th className="py-2.5 px-3">Difference</th>
                  <th className="py-2.5 px-3">Performed By</th>
                  <th className="py-2.5 px-3">Reason / Note</th>
                  <th className="py-2.5 px-3">Original Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 font-medium">
                {auditHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
                      {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{item.outletName}</td>
                    <td className="py-2.5 px-3 font-bold text-blue-300 whitespace-nowrap">{item.businessDate}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider border ${
                          item.actionType === 'REVERSAL'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {item.actionType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 font-mono whitespace-nowrap">
                      {fmtMoney(item.previousDepositAmount)}
                    </td>
                    <td className="py-2.5 px-3 font-black text-white font-mono whitespace-nowrap">
                      {fmtMoney(item.correctedDepositAmount)}
                    </td>
                    <td className="py-2.5 px-3 font-black font-mono whitespace-nowrap">
                      <span
                        className={
                          item.difference > 0
                            ? 'text-emerald-400'
                            : item.difference < 0
                            ? 'text-red-400'
                            : 'text-gray-400'
                        }
                      >
                        {item.difference > 0 ? `+${fmtMoney(item.difference)}` : fmtMoney(item.difference)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 font-bold whitespace-nowrap">{item.performedByName}</td>
                    <td className="py-2.5 px-3 text-gray-300 max-w-xs truncate" title={item.reason || ''}>
                      {item.reason || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-[10px] whitespace-nowrap">
                      {item.originalReference || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic py-6 text-center">
            No deposit correction operations recorded yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default DepositRecordExceptionPanel;
