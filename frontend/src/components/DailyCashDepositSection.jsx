import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Landmark, PlusCircle, RefreshCw, Calendar, Search, ArrowRight,
  CheckCircle, Clock, AlertTriangle, FileSpreadsheet, X, Sparkles
} from 'lucide-react';
import { formatDateTime, formatDateOnly, formatDateTimePKT } from '../utils/dateTime';
import { exportDailyDepositsToExcel } from '../utils/outletExportExcel';
import toast from 'react-hot-toast';

const fmt = (n) => `₨${(Math.round(n) || 0).toLocaleString()}`;

const STATUS_BADGES = {
  DEPOSITED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CLEARED_BY_CARRY_FORWARD: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  PARTIALLY_DEPOSITED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PENDING: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  EXCESS: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ADJUSTED: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const DailyCashDepositSection = ({ outlet, isOutletRole = false }) => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedDate, setExpandedDate] = useState(null);

  // Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [businessDate, setBusinessDate] = useState('');
  const [actualDepositDate, setActualDepositDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [notes, setNotes] = useState('');
  const [employeeName, setEmployeeName] = useState(user?.name || '');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/daily-deposits/${encodeURIComponent(outlet)}`, { timeout: 60000 });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch daily deposits:', err);
      toast.error('Failed to load daily deposit ledger');
    } finally {
      setLoading(false);
    }
  }, [outlet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = data?.summary || {};
  const requirements = data?.requirements || [];
  const deposits = data?.deposits || [];

  const getPktInputDateTime = () => {
    const now = new Date();
    const pktMs = now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000;
    const pktDate = new Date(pktMs);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pktDate.getFullYear()}-${pad(pktDate.getMonth() + 1)}-${pad(pktDate.getDate())}T${pad(pktDate.getHours())}:${pad(pktDate.getMinutes())}`;
  };

  const handleOpenModal = (targetDate = null) => {
    const todayStr = data?.todayDate || new Date().toISOString().slice(0, 10);
    
    // If a specific date was chosen, use it; otherwise default to oldest pending date (or today)
    let selectedDate = targetDate;
    if (!selectedDate) {
      const oldestPending = [...(requirements || [])].reverse().find(r => r.pendingAmount > 0);
      selectedDate = oldestPending ? oldestPending.businessDate : todayStr;
    }

    const reqForDate = (requirements || []).find(r => r.businessDate === selectedDate);
    const amountToSuggest = (reqForDate && typeof reqForDate.netRequired === 'number' && reqForDate.netRequired > 0)
      ? reqForDate.netRequired
      : (reqForDate && reqForDate.pendingAmount > 0
        ? reqForDate.pendingAmount
        : (summary.todayNetRequired > 0 ? summary.todayNetRequired : (summary.todayRequiredDeposit > 0 ? summary.todayRequiredDeposit : '')));

    setBusinessDate(selectedDate);
    setActualDepositDate(getPktInputDateTime());
    setDepositAmount(amountToSuggest ? amountToSuggest.toString() : '');
    setReferenceNumber(`DEP-${Date.now().toString().slice(-6)}`);
    setBankName('');
    setNotes('');
    setEmployeeName(user?.name || '');
    setShowModal(true);
  };

  const handleSubmitDeposit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid deposit amount');
      return;
    }

    let actualIso;
    if (actualDepositDate) {
      actualIso = actualDepositDate.length === 16
        ? new Date(`${actualDepositDate}:00+05:00`).toISOString()
        : new Date(actualDepositDate).toISOString();
    } else {
      actualIso = new Date().toISOString();
    }

    setSubmitting(true);
    try {
      await api.post(`/api/daily-deposits/${encodeURIComponent(outlet)}`, {
        amount: amt,
        businessDate,
        actualDepositDate: actualIso,
        referenceNumber,
        bankName,
        notes,
        employeeName,
      });

      toast.success(`Deposit of ${fmt(amt)} recorded for business date ${businessDate}!`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Submit deposit error:', err);
      toast.error(err.response?.data?.message || 'Failed to record deposit');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequirements = requirements.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.businessDate.includes(q) ||
      (r.status || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  });

  const cutoffDisplay = data?.cutoffDate
    ? new Date(data.cutoffDate + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '15 September 2026';

  const handleRebuild = async () => {
    if (!window.confirm(`Are you sure you want to rebuild and reallocate all cash deposit requirements for ${outlet} starting from ${cutoffDisplay}?`)) {
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/daily-deposits/rebuild`, { outletName: outlet });
      toast.success(`Deposit ledger state rebuilt successfully for ${outlet}`);
      fetchData();
    } catch (err) {
      console.error('Rebuild error:', err);
      toast.error('Failed to rebuild deposit ledger');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="glass rounded-2xl p-5 border border-gray-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-emerald-400" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Daily Cash Deposit Ledger — {outlet}
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Tracking daily cash generated, required deposits, partial deposits, excess amounts, and carry-forward allocations starting from {cutoffDisplay}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportDailyDepositsToExcel(requirements, outlet)}
            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Export Daily Cash Deposits to Excel"
          >
            <FileSpreadsheet size={14} /> Export Excel
          </button>

          <button
            onClick={handleRebuild}
            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title={`Rebuild Deposit Allocations from ${cutoffDisplay}`}
          >
            <RefreshCw size={14} /> Rebuild Ledger
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
          >
            <PlusCircle size={14} /> Make Deposit
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700/50 transition-all"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-400' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Today's Cash Generated */}
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cash Generated Today</p>
          <p className="text-xl font-black text-white mt-1">{fmt(summary.todayCashGenerated)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Authoritative POS / Till Cash</p>
        </div>

        {/* Net Required Deposit */}
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Net Required Deposit</p>
            <span className="text-[9px] font-bold text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Reconciled</span>
          </div>
          <p className="text-xl font-black text-amber-400 mt-1">{fmt(summary.todayNetRequired || summary.todayRequiredDeposit)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {summary.todayPreviousPending > 0
              ? `Includes +${fmt(summary.todayPreviousPending)} Carried Pending`
              : summary.todayPreviousExcess > 0
              ? `After -${fmt(summary.todayPreviousExcess)} Carried Excess Credit`
              : summary.todayGeneralEntryReduction > 0
              ? `Base ${fmt(summary.todayAvailableCash)} after -${fmt(summary.todayGeneralEntryReduction)} Expense`
              : 'Base Register Cash'}
          </p>
        </div>

        {/* Deposited */}
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deposited Today</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{fmt(summary.todayDeposited)}</p>
          <p className="text-[10px] text-emerald-500/70 mt-0.5">Direct deposits recorded today</p>
        </div>

        {/* Pending Deposit */}
        <div className={`glass rounded-2xl p-4 border ${summary.todayPending > 0 ? 'border-red-500/50 bg-red-500/5' : 'border-emerald-500/40 bg-emerald-500/5'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pending Deposit</p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${STATUS_BADGES[summary.depositStatus] || 'text-gray-400'}`}>
              {summary.depositStatus?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className={`text-xl font-black mt-1 ${summary.todayPending > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {fmt(summary.todayPending)}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {summary.excessDeposit > 0 ? `Excess Credit: +${fmt(summary.excessDeposit)}` : summary.todayPending > 0 ? 'Carried forward until cleared' : 'Fully reconciled'}
          </p>
        </div>
      </div>

      {/* Last Deposit Banner */}
      {summary.lastDeposit && (
        <div className="bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <CheckCircle size={15} className="text-emerald-400" />
            <span className="font-bold">Last Deposit:</span>
            <span className="font-black text-white">{fmt(summary.lastDeposit.amount)}</span>
            <span className="text-gray-400">({summary.lastDeposit.referenceNumber || 'Slip #'})</span>
            <span className="text-gray-500 text-[11px]">• Actual Date: {formatDateTimePKT(summary.lastDeposit.actualDepositDate)}</span>
          </div>
          <div className="text-gray-400 text-[11px]">
            Recorded by: <span className="text-gray-200 font-bold">{summary.lastDeposit.createdByName || 'Staff'}</span>
          </div>
        </div>
      )}

      {/* Table Filter & Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search date (YYYY-MM-DD) or status..."
            className="w-full bg-gray-800/60 border border-gray-700/50 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Daily Requirements Table */}
      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw size={20} className="animate-spin text-emerald-400 mx-auto" />
          <p className="text-xs text-gray-500 font-bold mt-2">Loading deposit ledger...</p>
        </div>
      ) : filteredRequirements.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center border border-gray-700/40">
          <Landmark size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-400">No deposit requirements found for this date range</p>
        </div>
      ) : (
        <div className="glass rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-800/80 text-gray-400 uppercase text-[9px] font-black tracking-wider border-b border-gray-700/50 whitespace-nowrap">
                  <th className="py-3 px-3 text-left">Cash Business Date</th>
                  <th className="py-3 px-2 text-right">Generated Cash</th>
                  <th className="py-3 px-2 text-right">General Entry</th>
                  <th className="py-3 px-2 text-right">Base Required</th>
                  <th className="py-3 px-2 text-center">Prev Balance</th>
                  <th className="py-3 px-2 text-right">Net Required</th>
                  <th className="py-3 px-2 text-right">Deposited</th>
                  <th className="py-3 px-2 text-right">Applied Prev</th>
                  <th className="py-3 px-2 text-right">Applied Day</th>
                  <th className="py-3 px-2 text-right">Remaining Pending</th>
                  <th className="py-3 px-2 text-right">Excess Credit</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Slips</th>
                  <th className="py-3 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredRequirements.map((r) => {
                  const isExpanded = expandedDate === r.id;

                  return (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-gray-800/40 transition-all group">
                        <td className="py-3 px-3 font-black text-white whitespace-nowrap">
                          {r.businessDate}
                          {r.businessDate === data?.todayDate && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-md font-bold uppercase">
                              Today
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-gray-300">{fmt(r.generatedCash ?? r.registerCash ?? r.cashGenerated)}</td>
                        <td className="py-3 px-2 text-right font-bold">
                          {r.generalEntryReduction > 0 ? (
                            <span className="text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20" title="General Entry Deduction">
                              -{fmt(r.generalEntryReduction)}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-gray-200">{fmt(r.baseRequired ?? r.availableCash ?? r.requiredAmount)}</td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {r.previousPending > 0 ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Carried Shortage">
                              +{fmt(r.previousPending)}
                            </span>
                          ) : r.previousExcess > 0 ? (
                            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20" title="Carried Credit">
                              -{fmt(r.previousExcess)}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-amber-300">{fmt(r.netRequired ?? r.requiredAmount)}</td>
                        <td className="py-3 px-2 text-right font-bold text-white">{fmt(r.depositedAmount)}</td>
                        <td className="py-3 px-2 text-right font-bold text-amber-400">
                          {r.appliedToPrev > 0 ? fmt(r.appliedToPrev) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-emerald-400">
                          {r.appliedToCurrent > 0 ? fmt(r.appliedToCurrent) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className={`py-3 px-2 text-right font-black ${r.pendingAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {fmt(r.pendingAmount)}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-purple-300">
                          {r.excessAmount > 0 ? (
                            <span className="bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                              +{fmt(r.excessAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border uppercase tracking-wider ${STATUS_BADGES[r.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                            {r.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {(r.allocations || []).length > 0 || r.generalEntryReduction > 0 || r.previousExcess > 0 ? (
                            <button
                              onClick={() => setExpandedDate(isExpanded ? null : r.id)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline"
                            >
                              {(r.allocations || []).length > 0
                                ? `${r.allocations.length} ${r.allocations.length === 1 ? 'Slip' : 'Slips'}`
                                : 'Audit'}
                            </button>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {r.pendingAmount > 0 ? (
                            <button
                              onClick={() => handleOpenModal(r.businessDate)}
                              className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                            >
                              + Deposit
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-500/80 font-bold">✓ Cleared</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Allocations & General Entry Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-gray-900/80">
                          <td colSpan="14" className="p-4 border-l-2 border-emerald-500">
                            {r.generalEntryReduction > 0 && (
                              <div className="mb-3 p-3 bg-orange-950/20 rounded-xl border border-orange-500/30 max-w-3xl">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                  <span>General Entry Reductions Credited to {r.businessDate}:</span>
                                  <span className="text-red-400 font-black">Total: -{fmt(r.generalEntryReduction)}</span>
                                </p>
                                <div className="space-y-1">
                                  {(r.journalEntries && r.journalEntries.length > 0) ? (
                                    r.journalEntries.map((j, jIdx) => (
                                      <div key={jIdx} className="flex justify-between items-center text-xs bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700/60">
                                        <span className="text-gray-300 font-bold">{j.expenseTitle} <span className="text-gray-500 font-normal">— {j.employeeName}</span></span>
                                        <span className="font-black text-red-400">-{fmt(j.amount)}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex justify-between items-center text-xs bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700/60">
                                      <span className="text-gray-300">Total General Entry Deductions</span>
                                      <span className="font-black text-red-400">-{fmt(r.generalEntryReduction)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {r.consumedCredit > 0 && (
                              <div className="mb-3 p-3 bg-purple-950/20 rounded-xl border border-purple-500/30 max-w-3xl flex items-center justify-between text-xs">
                                <span className="text-purple-300 font-bold">Previous Excess Credit Consumed</span>
                                <span className="font-black text-purple-400">-{fmt(r.consumedCredit)}</span>
                              </div>
                            )}

                            {r.appliedToPrev > 0 && (
                              <div className="mb-3 p-3 bg-amber-950/20 rounded-xl border border-amber-500/30 max-w-3xl flex items-center justify-between text-xs">
                                <span className="text-amber-300 font-bold">Deposit on this date cleared older outstanding pending</span>
                                <span className="font-black text-amber-400">+{fmt(r.appliedToPrev)}</span>
                              </div>
                            )}

                            {(r.allocations || []).length > 0 ? (
                              <>
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-2">
                                  Allocated Deposits Credited to {r.businessDate}:
                                </p>
                                <div className="space-y-2 max-w-3xl">
                                  {r.allocations.map((a, idx) => (
                                    <div key={idx} className="flex flex-wrap items-center justify-between text-xs bg-gray-800/80 p-2.5 rounded-xl border border-gray-700/60 gap-2">
                                      <div className="flex items-center gap-3">
                                        <span className="font-black text-white text-sm">{fmt(a.amount)}</span>
                                        <span className="text-gray-400 text-[11px]">
                                          Slip: <span className="font-bold text-gray-200">{a.cashDeposit?.referenceNumber || 'DEP'}</span>
                                        </span>
                                        {a.cashDeposit?.bankName && (
                                          <span className="text-gray-400 text-[11px]">
                                            Bank: <span className="font-bold text-gray-300">{a.cashDeposit.bankName}</span>
                                          </span>
                                        )}
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${a.allocationType === 'PREVIOUS_PENDING' ? 'bg-amber-500/20 text-amber-300' : a.allocationType === 'EXCESS' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                          {a.allocationType?.replace(/_/g, ' ')}
                                        </span>
                                      </div>
                                      <div className="text-right text-[11px] text-gray-400">
                                        <span>Actual Deposit Time: <span className="font-bold text-gray-300">{formatDateTimePKT(a.cashDeposit?.actualDepositDate || a.createdAt)}</span></span>
                                        {a.cashDeposit?.createdByName && (
                                          <span className="ml-2 text-gray-500">• By {a.cashDeposit.createdByName}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 italic">No direct deposit slips recorded yet for this date.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Make Deposit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass rounded-2xl border border-gray-700/60 w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-gray-900/90 border-b border-gray-700/60 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Record Cash Deposit</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitDeposit} className="p-6 space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles size={14} /> Cash Business Date Credit
                </p>
                <p className="text-[11px] text-emerald-400/80 mt-1">
                  The deposit amount will be directly credited and allocated against the selected <strong>Cash Business Date</strong> requirement.
                </p>
              </div>

              <div>
                <label htmlFor="deposit-amount" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Deposit Amount (PKR) <span className="text-red-400">*</span>
                </label>
                <input
                  id="deposit-amount"
                  name="depositAmount"
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="deposit-business-date" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Cash Business Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="deposit-business-date"
                    name="businessDate"
                    type="date"
                    required
                    value={businessDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setBusinessDate(newDate);
                      const req = (requirements || []).find(r => r.businessDate === newDate);
                      if (req && req.pendingAmount > 0) {
                        setDepositAmount(req.pendingAmount.toString());
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Date of cash requirement being deposited
                  </p>
                </div>
                <div>
                  <label htmlFor="deposit-actual-date" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Actual Deposit Time
                  </label>
                  <input
                    id="deposit-actual-date"
                    name="actualDepositDate"
                    type="datetime-local"
                    value={actualDepositDate}
                    onChange={(e) => setActualDepositDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-gray-300 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Physical submission timestamp
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="deposit-reference-number" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Slip / Reference #
                  </label>
                  <input
                    id="deposit-reference-number"
                    name="referenceNumber"
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="SLIP-00123"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="deposit-bank-name" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Bank / Account Name
                  </label>
                  <input
                    id="deposit-bank-name"
                    name="bankName"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Meezan Bank, HBL..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="deposit-employee-name" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Depositor Name / Employee
                </label>
                <input
                  id="deposit-employee-name"
                  name="employeeName"
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Employee name"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="deposit-notes" className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  id="deposit-notes"
                  name="notes"
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details or deposit slip notes..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-700/50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirm Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyCashDepositSection;
