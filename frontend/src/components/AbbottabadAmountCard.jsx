import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Plus, Minus, RotateCcw, FileText, ArrowRightLeft, ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import socket from '../socket';

const fmt = (n) => {
  if (n === null || n === undefined) return '₨0';
  const val = Number(n);
  const formatted = Math.abs(val).toLocaleString();
  return val < 0 ? `-₨${formatted}` : `₨${formatted}`;
};

const AbbottabadAmountCard = ({ isAdmin = false, user = null }) => {
  const [account, setAccount] = useState({
    approvedAmount: 0,
    runningBalance: 0,
    totalConsumed: 0,
    isCleared: false
  });
  const [pendingProposal, setPendingProposal] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [proposalType, setProposalType] = useState('INCREASE'); // 'INITIAL_AMOUNT' | 'INCREASE' | 'DECREASE'
  const [proposalAmount, setProposalAmount] = useState('');
  const [proposalNotes, setProposalNotes] = useState('');
  const [proposalSubmitting, setProposalSubmitting] = useState(false);

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearNotes, setClearNotes] = useState('');
  const [clearSubmitting, setClearSubmitting] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchAmountState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/abbottabad/amount/state');
      if (res.data?.account) {
        setAccount(res.data.account);
      }
      setPendingProposal(res.data?.pendingProposal || null);
    } catch (err) {
      console.error('Error fetching Abbottabad amount state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAmountState();

    const handleUpdate = () => {
      fetchAmountState();
    };

    if (socket) {
      socket.on('abbottabad:amount-updated', handleUpdate);
      return () => {
        socket.off('abbottabad:amount-updated', handleUpdate);
      };
    }
  }, [fetchAmountState]);

  const handleProposeSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(proposalAmount);
    if (Number.isNaN(val) || val <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    setProposalSubmitting(true);
    try {
      await api.post('/api/abbottabad/amount/propose', {
        type: proposalType,
        amount: val,
        notes: proposalNotes
      });
      toast.success('Proposal submitted for dual approval');
      setProposeModalOpen(false);
      setProposalAmount('');
      setProposalNotes('');
      fetchAmountState();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit proposal');
    } finally {
      setProposalSubmitting(false);
    }
  };

  const handleClearSubmit = async () => {
    setClearSubmitting(true);
    try {
      await api.post('/api/abbottabad/amount/propose', {
        type: 'CLEAR',
        amount: 0,
        notes: clearNotes || 'Request to clear active Abbottabad amount'
      });
      toast.success('Clear amount request submitted for dual approval');
      setClearModalOpen(false);
      setClearNotes('');
      fetchAmountState();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit clear request');
    } finally {
      setClearSubmitting(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!pendingProposal) return;
    try {
      await api.post(`/api/abbottabad/amount/approve/${pendingProposal.id}`);
      toast.success('Proposal approved and applied!');
      fetchAmountState();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed');
    }
  };

  const handleRejectProposal = async () => {
    if (!pendingProposal) return;
    setRejectSubmitting(true);
    try {
      await api.post(`/api/abbottabad/amount/reject/${pendingProposal.id}`, {
        reason: rejectReason
      });
      toast.success('Proposal rejected. Active amount remains unchanged.');
      setRejectModalOpen(false);
      setRejectReason('');
      fetchAmountState();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const openLedger = async () => {
    setLedgerModalOpen(true);
    setLedgerLoading(true);
    try {
      const res = await api.get('/api/abbottabad/amount/ledger?limit=100');
      setLedgerEntries(res.data?.entries || []);
    } catch (err) {
      toast.error('Failed to load amount ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  const isOutletUser = !isAdmin;
  const canApprovePending = pendingProposal && (
    (pendingProposal.status === 'ADMIN_APPROVED' && isOutletUser) ||
    (pendingProposal.status === 'ABBOTTABAD_APPROVED' && isAdmin)
  );

  const isNegative = (account.runningBalance || 0) < 0;

  return (
    <div className="glass rounded-2xl md:rounded-3xl border-2 border-indigo-500/30 p-5 md:p-7 shadow-2xl relative overflow-hidden mb-6">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400">
            <Wallet size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Amount</h2>
              {isNegative && (
                <span className="px-2.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                  Over Limit
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Approved Abbottabad Demand Balance & Dual-Approval Control
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAmountState}
            disabled={loading}
            title="Refresh balance"
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all border border-gray-700/60 disabled:opacity-40"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              setProposalType(account.approvedAmount > 0 ? 'INCREASE' : 'INITIAL_AMOUNT');
              setProposeModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 active:scale-95"
          >
            <Plus size={14} />
            <span>Propose / Adjust</span>
          </button>
          {account.approvedAmount > 0 && (
            <button
              onClick={() => setClearModalOpen(true)}
              className="px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <RotateCcw size={14} />
              <span>Clear Amount</span>
            </button>
          )}
          <button
            onClick={openLedger}
            className="px-3.5 py-2.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 active:scale-95"
          >
            <FileText size={14} />
            <span>Ledger</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-5">
        {/* Approved / Input Amount */}
        <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
            Approved / Input Amount
          </p>
          <p className="text-xl md:text-2xl font-black text-white">
            {fmt(account.approvedAmount)}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">
            Mutually approved financial limit
          </p>
        </div>

        {/* Consumed by Demands */}
        <div className="p-4 bg-gray-900/60 border border-gray-800 rounded-2xl">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
            Consumed (Demands + Bilty)
          </p>
          <p className="text-xl md:text-2xl font-black text-amber-400">
            {fmt(account.totalConsumed)}
          </p>
          <p className="text-[10px] font-bold text-gray-500 mt-1">
            Total deductions from dispatched demands
          </p>
        </div>

        {/* Running Balance */}
        <div className={`p-4 rounded-2xl border ${
          isNegative
            ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-lg shadow-red-500/10'
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black uppercase tracking-wider">
              Current Running Balance
            </p>
            {isNegative && (
              <span className="text-[10px] font-black px-2 py-0.5 bg-red-500 text-white rounded-md uppercase">
                Deficit
              </span>
            )}
          </div>
          <p className={`text-2xl md:text-3xl font-black ${isNegative ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            {fmt(account.runningBalance)}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${isNegative ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
            {isNegative
              ? `Exceeded approved amount by ₨${Math.abs(account.runningBalance).toLocaleString()}`
              : 'Available balance for future demands'}
          </p>
        </div>
      </div>

      {/* Pending Proposal Banner (Dual Approval) */}
      {pendingProposal && (
        <div className="mt-2 p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-500/40 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl mt-0.5">
                <Clock size={20} className="animate-spin" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Dual Approval Pending: {pendingProposal.type.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold">
                    {pendingProposal.type === 'CLEAR' ? 'Clear to ₨0' : fmt(pendingProposal.proposedAmount)}
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-1">
                  Proposed by <span className="font-bold text-white">{pendingProposal.proposedBy}</span> ({pendingProposal.proposedByName})
                  {pendingProposal.notes ? ` — "${pendingProposal.notes}"` : ''}
                </p>
                <p className="text-[11px] font-semibold text-amber-400/90 mt-0.5">
                  Status: {pendingProposal.status === 'ADMIN_APPROVED' ? 'Waiting for Abbottabad Approval' : 'Waiting for Admin Approval'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {canApprovePending ? (
                <>
                  <button
                    onClick={handleApproveProposal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 flex items-center space-x-1.5 active:scale-95"
                  >
                    <CheckCircle size={14} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => setRejectModalOpen(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-red-600/20 flex items-center space-x-1.5 active:scale-95"
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                </>
              ) : (
                <div className="px-3 py-1.5 bg-gray-800/80 border border-gray-700 text-gray-400 text-xs font-bold rounded-xl flex items-center space-x-1.5">
                  <Clock size={13} />
                  <span>Waiting for other party to review</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Propose Amount / Adjustment */}
      {proposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass max-w-md w-full p-6 rounded-2xl border-2 border-indigo-500/40 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-1 flex items-center space-x-2">
              <ArrowRightLeft size={18} className="text-indigo-400" />
              <span>Propose Amount / Adjustment</span>
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Requires dual approval from both Admin and Abbottabad before taking effect.
            </p>

            <form onSubmit={handleProposeSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProposalType('INITIAL_AMOUNT')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      proposalType === 'INITIAL_AMOUNT'
                        ? 'bg-indigo-600 text-white border-2 border-indigo-400'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    Set New
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposalType('INCREASE')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      proposalType === 'INCREASE'
                        ? 'bg-emerald-600 text-white border-2 border-emerald-400'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    + Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposalType('DECREASE')}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                      proposalType === 'DECREASE'
                        ? 'bg-red-600 text-white border-2 border-red-400'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    - Decrease
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Amount (₨)
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={proposalAmount}
                  onChange={(e) => setProposalAmount(e.target.value)}
                  placeholder="e.g. 1000000"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl text-white text-sm font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                  Notes / Reason
                </label>
                <textarea
                  rows={2}
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="e.g. Monthly allocation increase"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 focus:border-indigo-500 rounded-xl text-white text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProposeModalOpen(false)}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposalSubmitting}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase transition-all disabled:opacity-50"
                >
                  {proposalSubmitting ? 'Submitting...' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Clear Amount */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass max-w-md w-full p-6 rounded-2xl border-2 border-red-500/40 shadow-2xl">
            <h3 className="text-lg font-black text-red-400 mb-2 flex items-center space-x-2">
              <ShieldAlert size={20} />
              <span>Request to Clear Amount</span>
            </h3>
            <p className="text-xs text-gray-300 mb-4 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              Clearing the amount will reset approved amount and balance to ₨0. Previous transaction history and demand deductions will remain intact. This requires dual approval.
            </p>

            <div className="mb-4">
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Reason for Clear
              </label>
              <textarea
                rows={2}
                value={clearNotes}
                onChange={(e) => setClearNotes(e.target.value)}
                placeholder="Reason for clearing balance..."
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setClearModalOpen(false)}
                className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearSubmit}
                disabled={clearSubmitting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase disabled:opacity-50"
              >
                {clearSubmitting ? 'Submitting...' : 'Request Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Proposal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass max-w-md w-full p-6 rounded-2xl border-2 border-red-500/40 shadow-2xl">
            <h3 className="text-lg font-black text-red-400 mb-2 flex items-center space-x-2">
              <XCircle size={20} />
              <span>Reject Proposal</span>
            </h3>
            <p className="text-xs text-gray-300 mb-4">
              Rejecting this proposal will keep the previous active amount and balance completely unchanged.
            </p>

            <div className="mb-4">
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Rejection Reason
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this proposal being rejected?"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectProposal}
                disabled={rejectSubmitting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase disabled:opacity-50"
              >
                {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Amount Ledger / History */}
      {ledgerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setLedgerModalOpen(false)}>
          <div className="glass max-w-4xl w-full max-h-[85vh] flex flex-col p-6 rounded-3xl border-2 border-gray-700/60 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Abbottabad Amount Ledger</h3>
                  <p className="text-xs text-gray-400">Complete immutable transaction log</p>
                </div>
              </div>
              <button
                onClick={() => setLedgerModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800 hover:bg-gray-700 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 pr-1">
              {ledgerLoading ? (
                <div className="py-12 text-center text-gray-400">Loading ledger transactions...</div>
              ) : ledgerEntries.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-semibold">
                  No transactions recorded yet in the amount ledger.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-400">
                        <th className="py-2.5 px-3">Date / Time</th>
                        <th className="py-2.5 px-3">Action Type</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3 text-right">Previous</th>
                        <th className="py-2.5 px-3 text-right">Change / Consumed</th>
                        <th className="py-2.5 px-3 text-right">New Balance</th>
                        <th className="py-2.5 px-3">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-semibold">
                      {ledgerEntries.map((e) => {
                        const isDeduction = e.actionType === 'DEMAND_DEDUCTION';
                        const isClear = e.actionType === 'CLEAR';
                        return (
                          <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                              {new Date(e.createdAt).toLocaleString('en-GB', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isDeduction ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : isClear ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {e.actionType.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-white">
                              {e.demandTransferNumber || e.details || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-400">
                              {fmt(e.previousBalance)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-black ${
                              isDeduction ? 'text-amber-400' : e.adjustmentAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {isDeduction
                                ? `-${fmt(e.consumedAmount)}`
                                : (e.adjustmentAmount >= 0 ? `+${fmt(e.adjustmentAmount)}` : fmt(e.adjustmentAmount))}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-black ${
                              e.newBalance < 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}>
                              {fmt(e.newBalance)}
                            </td>
                            <td className="py-2.5 px-3 text-gray-400 text-[11px] whitespace-nowrap">
                              {e.performedByName || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbbottabadAmountCard;
