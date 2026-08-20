import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Lock, User, DollarSign, FileText, Clock, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const EXPENSE_TITLES = [
  'Pen', 'Electricity Bill', 'Internet Bill', 'Cleaning Supplies',
  'Office Expense', 'Courier Charges', 'Fuel', 'Tea & Refreshments'
];

const OutletJournal = ({ outlet }) => {
  const [employees, setEmployees] = useState([]);
  const [authMode, setAuthMode] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState(null);

  // Entry form
  const [expenseTitle, setExpenseTitle] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const bcRef = useRef(null);

  useEffect(() => {
    api.get(`/api/pos/employees?outlet=${outlet}`).then(r => setEmployees(r.data)).catch(() => {});
  }, [outlet]);

  const fetchEntries = async () => {
    setEntriesLoading(true);
    try {
      const res = await api.get(`/api/journal?outlet=${outlet}`);
      setEntries(res.data);
    } catch (e) {
      console.error('Failed to fetch journal entries', e);
    } finally {
      setEntriesLoading(false);
    }
  };

  const fetchCashSummary = async () => {
    try {
      const res = await api.get(`/api/journal/cash-summary?outlet=${outlet}`);
      setCashSummary(res.data);
    } catch (e) {
      console.error('Failed to fetch cash summary', e);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !password) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post('/api/journal/auth', { name: selectedEmployee, password, outlet });
      if (res.data.name) {
        setAuthenticatedEmployee(res.data.name);
        setAuthMode(false);
        setPassword('');
        toast.success(`Welcome, ${res.data.name}!`);
        fetchEntries();
        fetchCashSummary();
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthenticatedEmployee(null);
    setAuthMode(true);
    setSelectedEmployee('');
    setPassword('');
    setExpenseTitle('');
    setCustomTitle('');
    setAmount('');
    setNotes('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const title = expenseTitle === 'Other' ? customTitle : expenseTitle;
    if (!title || !amount || parseFloat(amount) <= 0) {
      return toast.error('Please select an expense title and enter a valid amount');
    }
    setSubmitting(true);
    try {
      await api.post('/api/journal', {
        employeeName: authenticatedEmployee,
        expenseTitle: title,
        amount: parseFloat(amount),
        notes: notes || null,
        outlet
      });
      toast.success('Journal entry saved');
      setExpenseTitle('');
      setCustomTitle('');
      setAmount('');
      setNotes('');
      fetchEntries();
      fetchCashSummary();
      window.dispatchEvent(new CustomEvent('journal-entry-saved'));
      // Broadcast to other tabs/windows
      try {
        if (!bcRef.current) bcRef.current = new BroadcastChannel('smart-production');
        bcRef.current.postMessage('journal-entry-saved');
      } catch (_) {}
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => { try { bcRef.current?.close(); } catch (_) {} };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {authMode ? (
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 shadow-lg max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl inline-flex mb-3">
              <Lock size={28} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-black text-white">Employee Authentication</h2>
            <p className="text-xs text-gray-500 mt-1">Authenticate to record a journal entry</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Select Employee</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 appearance-none">
                  <option value="">Choose employee...</option>
                  {employees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter employee password"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            {authError && (
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl">
                <AlertTriangle size={14} /> {authError}
              </div>
            )}
            <button type="submit" disabled={authLoading || !selectedEmployee || !password}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg">
              {authLoading ? <RefreshCw className="animate-spin" size={16} /> : <Lock size={16} />}
              Authenticate
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Authenticated Header */}
          <div className="flex items-center justify-between bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl">
                <User size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white">{authenticatedEmployee}</p>
                <p className="text-[10px] text-gray-500 font-semibold">{outlet}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {cashSummary && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Available Cash</p>
                  <p className={`text-sm font-black ${cashSummary.availableCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(cashSummary.availableCash)}
                  </p>
                </div>
              )}
              <button onClick={handleLogout}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold rounded-xl transition-all border border-gray-700/50">
                Logout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Entry Form */}
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-5 flex items-center gap-2">
                <DollarSign size={14} className="text-blue-400" /> New Journal Entry
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Expense Title</label>
                  <select value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 appearance-none">
                    <option value="">Select expense...</option>
                    {EXPENSE_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="Other">Other (custom)</option>
                  </select>
                </div>
                {expenseTitle === 'Other' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Custom Title</label>
                    <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                      placeholder="Enter expense title"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Amount (PKR)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="Enter amount" min="0" step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Notes (Optional)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <Clock size={12} />
                  <span>{formatDateOnly(new Date())}</span>
                  <span className="text-gray-700">|</span>
                  <span>{formatTimeOnly(new Date())}</span>
                  <span className="text-gray-700">|</span>
                  <span className="text-emerald-400">{authenticatedEmployee}</span>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  <FileText size={16} /> {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </form>
            </div>

            {/* Cash Summary */}
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-lg">
              <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-5 flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-400" /> Cash Summary
              </h3>
              {cashSummary ? (
                <div className="space-y-4">
                  {[
                    { label: 'Total Cash Collected', value: cashSummary.totalCashCollected, color: 'text-blue-400' },
                    { label: 'Cash Refunded', value: cashSummary.totalCashRefunded, color: 'text-red-400' },
                    { label: 'Net Cash', value: cashSummary.netCash, color: 'text-emerald-400' },
                    { label: 'Total Expenses (Journal)', value: cashSummary.totalExpenses, color: 'text-amber-400' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
                      <span className="text-xs font-bold text-gray-400">{item.label}</span>
                      <span className={`text-sm font-black ${item.color}`}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-4 border border-gray-700">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Available Cash</span>
                    <span className={`text-lg font-black ${cashSummary.availableCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(cashSummary.availableCash)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="animate-spin text-gray-500" size={20} />
                </div>
              )}
              <button onClick={() => { fetchCashSummary(); fetchEntries(); }}
                className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold rounded-xl transition-all border border-gray-700/50 flex items-center justify-center gap-2">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* Journal Entry History */}
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Clock size={14} className="text-purple-400" /> Journal Entry History
            </h3>
            {entriesLoading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="animate-spin text-gray-500" size={24} />
              </div>
            ) : entries.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <FileText size={32} className="text-gray-600 mb-2" />
                <p className="text-gray-500 font-bold text-sm">No journal entries yet</p>
                <p className="text-xs text-gray-600 mt-1">Record an expense above to see it here</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {entries.map(entry => (
                  <div key={entry.id} className="flex items-start justify-between bg-gray-800/40 hover:bg-gray-800/60 rounded-xl p-4 transition-all border border-gray-800 hover:border-gray-700/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{entry.expenseTitle}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                          entry.amount > 1000 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          EXPENSE
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <User size={10} /> {entry.employeeName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatDateOnly(entry.createdAt)}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {formatTimeOnly(entry.createdAt)}
                        </span>
                      </div>
                      {entry.notes && (
                        <p className="text-[10px] text-gray-500 italic mt-1.5">{entry.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-black text-red-400">-{formatCurrency(entry.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OutletJournal;
