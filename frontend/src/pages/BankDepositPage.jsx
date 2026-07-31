import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Landmark, CheckCircle, Clock, Search, Calendar, X,
  AlertTriangle, RefreshCw, FileText, Download, Printer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const fmt = (n) => `PKR ${(n || 0).toLocaleString()}`;
const fmtDate = (d) => d ? formatDateOnly(d) : '-';
const fmtTime = (d) => d ? formatTimeOnly(d) : '';

const BankDepositPage = () => {
  const { user } = useAuth();
  const outlet = getOutletName(user);

  const [employees, setEmployees] = useState([]);
  const [authEmployee, setAuthEmployee] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [slipNumber, setSlipNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deposits, setDeposits] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [depositCount, setDepositCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showSuccess, setShowSuccess] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get(`/api/journal/employees?outlet=${encodeURIComponent(outlet)}`);
        setEmployees(res.data || []);
      } catch {
        try {
          const res = await api.get(`/api/pos/employees?outlet=${encodeURIComponent(outlet)}`);
          setEmployees(res.data || []);
        } catch {
          setEmployees([]);
        }
      }
    };
    fetchEmployees();
  }, [outlet]);

  const handleAuth = async () => {
    if (!authEmployee || !authPassword) return toast.error('Select employee and enter password');
    setAuthLoading(true);
    try {
      await api.post('/api/bank-deposit/auth', { name: authEmployee, password: authPassword, outlet });
      setAuthenticated(true);
      toast.success('Authenticated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (search) params.set('search', search);
      const res = await api.get(`/api/bank-deposit/deposits?${params.toString()}`);
      setDeposits(res.data.deposits || []);
      setTotalAmount(res.data.totalAmount || 0);
      setDepositCount(res.data.count || 0);
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authenticated) return toast.error('Please authenticate first');
    if (!slipNumber.trim()) return toast.error('Deposit slip number is required');
    if (!amount || parseFloat(amount) <= 0) return toast.error('Enter a valid amount');

    setSubmitting(true);
    try {
      const res = await api.post('/api/bank-deposit/deposit', {
        employeeName: authEmployee,
        password: authPassword,
        slipNumber: slipNumber.trim(),
        amount: parseFloat(amount),
        notes: notes.trim() || undefined,
        outlet,
      });
      setShowSuccess(res.data.deposit);
      toast.success('Bank deposit recorded successfully');
      setSlipNumber('');
      setAmount('');
      setNotes('');
      fetchDeposits();
      // Notify dashboard to refresh cash balance
      try { new BroadcastChannel('smart-production').postMessage('bank-deposit-saved'); } catch (_) {}
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record deposit');
    } finally {
      setSubmitting(false);
    }
  };

  const todayTotal = deposits.filter(d => {
    const dt = new Date(d.createdAt);
    const today = new Date();
    return dt.toDateString() === today.toDateString();
  }).reduce((s, d) => s + d.amount, 0);

  const monthTotal = deposits.filter(d => {
    const dt = new Date(d.createdAt);
    const now = new Date();
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }).reduce((s, d) => s + d.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl shadow-lg shadow-emerald-600/20">
          <Landmark className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Bank Deposit</h1>
          <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">{outlet}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-5">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Today's Deposits</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{fmt(todayTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-5">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{fmt(monthTotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-5">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Deposits</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{fmt(totalAmount)}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{depositCount} deposit{depositCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Deposit Form */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-6">
            <h2 className="text-sm font-black text-white uppercase tracking-wider mb-4">New Bank Deposit</h2>

            {!authenticated ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-400 font-bold">Employee Verification Required</p>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Employee</label>
                  <select value={authEmployee} onChange={(e) => setAuthEmployee(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all">
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Password</label>
                  <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="Enter password" />
                </div>
                <button onClick={handleAuth} disabled={authLoading || !authEmployee || !authPassword}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50">
                  {authLoading ? 'Verifying...' : 'Verify Employee'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-xs font-black text-emerald-400">{authEmployee}</span>
                  <button type="button" onClick={() => { setAuthenticated(false); setAuthEmployee(''); setAuthPassword(''); }}
                    className="ml-auto text-[10px] text-gray-400 hover:text-white font-bold">Change</button>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Deposit Slip Number *</label>
                  <input type="text" value={slipNumber} onChange={(e) => setSlipNumber(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g., SLIP-001234" required />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Deposit Amount (PKR) *</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-lg font-black text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="0" min="0.01" step="0.01" required />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">Notes (Optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all resize-none"
                    rows={3} placeholder="Optional notes..." />
                </div>
                <div className="bg-gray-800/30 rounded-xl px-4 py-2.5 border border-gray-700/30">
                  <p className="text-[10px] text-gray-500 font-bold">Date & Time</p>
                  <p className="text-xs font-black text-white">{fmtDate(new Date())} {fmtTime(new Date())}</p>
                </div>
                <button type="submit" disabled={submitting || !slipNumber.trim() || !amount || parseFloat(amount) <= 0}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? 'Processing...' : <>
                    <Landmark size={16} /> Record Deposit
                  </>}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Deposit History */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Deposit History</h2>
              <button onClick={fetchDeposits}
                className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 transition-all">
                <RefreshCw size={14} className="text-gray-400" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search slip # or employee..."
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all" />
              </div>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 transition-all" />
              {(dateFrom || dateTo || search) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); }}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all">
                  <X size={12} />
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12"><RefreshCw size={20} className="animate-spin text-gray-500 mx-auto" /></div>
            ) : deposits.length === 0 ? (
              <div className="text-center py-12">
                <Landmark size={40} className="text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-bold">No deposits found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {deposits.map(d => (
                  <div key={d.id} className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-4 hover:border-emerald-500/20 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={12} className="text-emerald-400" />
                          <span className="text-xs font-black text-emerald-400">{d.slipNumber}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold">{d.employeeName} • {fmtDate(d.createdAt)} {fmtTime(d.createdAt)}</p>
                        {d.notes && <p className="text-[10px] text-gray-500 mt-1">{d.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{fmt(d.amount)}</p>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{d.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSuccess(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700/50 p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-black text-white mb-2">Deposit Recorded!</h3>
                <div className="bg-gray-800/50 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Slip #</span>
                    <span className="font-black text-white">{showSuccess.slipNumber}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Amount</span>
                    <span className="font-black text-emerald-400">{fmt(showSuccess.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Employee</span>
                    <span className="font-black text-white">{showSuccess.employeeName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Outlet</span>
                    <span className="font-black text-white">{showSuccess.outletName}</span>
                  </div>
                </div>
                <button onClick={() => setShowSuccess(null)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BankDepositPage;
