import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, KeyRound, ShieldCheck, Loader2, Power, PowerOff, Building2, ArrowLeftRight, Search, RefreshCw, Banknote, Wallet, CreditCard, Clock, Save } from 'lucide-react';

const PROFILE_LABELS = {
  POS: 'POS',
  OUTLET_ORDER_ENTRY: 'Outlet Order Entry',
  DISPATCH: 'Dispatch',
  FAISAL_PROFILE: 'Faisal Profile',
  INVENTORY_VIEW: 'Inventory View',
  STORE: 'Store',
  PRODUCTION: 'Production',
};

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad', 'Dispatch'];

const METHOD_LABELS = { CASH: 'Cash', ONLINE: 'Online', CARD: 'Card', CASH_ONLINE: 'Cash+Online' };
const METHOD_STYLES = {
  CASH: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400',
  ONLINE: 'bg-violet-600/20 border-violet-600/50 text-violet-400',
  CARD: 'bg-amber-600/20 border-amber-600/50 text-amber-400',
  CASH_ONLINE: 'bg-blue-600/20 border-blue-600/50 text-blue-400',
};
const CHANGE_TARGETS = ['CASH', 'ONLINE', 'CARD'];

const fmtMoney = (n) => 'PKR ' + Number(n || 0).toLocaleString();
const fmtDate = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    x.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const DEFAULT_DELAY_CONFIG = {
  VERIFICATION: { acceptanceMinutes: 30, totalHours: 2 },
  STORE: { acceptanceMinutes: 30, totalHours: 4 },
  LOGO: { acceptanceMinutes: 30, totalHours: 3 },
  PRODUCTION: { acceptanceMinutes: 30, totalHours: 24 },
  DISPATCH: { acceptanceMinutes: 30, totalHours: 4 }
};

const SoftwareSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');

  // ── Employee management state ──
  const [employees, setEmployees] = useState([]);
  const [profileOptions, setProfileOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', outletName: 'Johar Town', password: '', profiles: ['POS'] });
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // ── Payment method change state ──
  const [payOutlets, setPayOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [newMethod, setNewMethod] = useState('ONLINE');
  const [changing, setChanging] = useState(false);

  // ── Delay Configuration state ──
  const [delayConfig, setDelayConfig] = useState(DEFAULT_DELAY_CONFIG);
  const [delayLoading, setDelayLoading] = useState(false);
  const [delaySaving, setDelaySaving] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/software-settings/employees');
      setEmployees(res.data?.employees || []);
      setProfileOptions(res.data?.profileOptions || []);
    } catch (err) {
      toast.error('Failed to load employees: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const fetchDelayConfig = useCallback(async () => {
    setDelayLoading(true);
    try {
      const res = await api.get('/api/software-settings/delay-config');
      if (res.data) setDelayConfig(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      toast.error('Failed to load delay config: ' + (err.response?.data?.message || err.message));
    } finally {
      setDelayLoading(false);
    }
  }, []);

  useEffect(() => { fetchDelayConfig(); }, [fetchDelayConfig]);

  const handleSaveDelayConfig = async () => {
    setDelaySaving(true);
    try {
      await api.post('/api/software-settings/delay-config', delayConfig);
      toast.success('Delay thresholds saved successfully!');
    } catch (err) {
      toast.error('Failed to save delay thresholds: ' + (err.response?.data?.message || err.message));
    } finally {
      setDelaySaving(false);
    }
  };

  const fetchPaymentOutlets = useCallback(async () => {
    try {
      const res = await api.get('/api/software-settings/payment-change/outlets');
      setPayOutlets(res.data || []);
      if (res.data?.length && !selectedOutlet) setSelectedOutlet(res.data[0]);
    } catch (err) {
      toast.error('Failed to load outlets: ' + (err.response?.data?.message || err.message));
    }
  }, [selectedOutlet]);

  useEffect(() => { fetchPaymentOutlets(); }, [fetchPaymentOutlets]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/software-settings/payment-change/history', { params: selectedOutlet ? { outlet: selectedOutlet } : {} });
      setHistoryList(res.data || []);
    } catch (err) {
      toast.error('Failed to load history: ' + (err.response?.data?.message || err.message));
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const runInvoiceSearch = useCallback(async (q) => {
    if (!selectedOutlet || String(q || '').trim().length < 2) {
      setInvoiceResults([]);
      setInvoiceLoading(false);
      return;
    }
    setInvoiceLoading(true);
    try {
      const res = await api.get('/api/software-settings/payment-change/invoices', { params: { outlet: selectedOutlet, search: q } });
      setInvoiceResults(res.data || []);
    } catch (err) {
      toast.error('Search failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setInvoiceLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => {
    if (!selectedOutlet) return;
    const q = invoiceQuery;
    if (String(q || '').trim().length < 2) { setInvoiceResults([]); setInvoiceLoading(false); return; }
    let cancelled = false;
    const t = setTimeout(() => { runInvoiceSearch(q); }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [invoiceQuery, selectedOutlet, runInvoiceSearch]);

  if (String(user?.role || '').toUpperCase() !== 'SOFTWARE_SETTINGS') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <ShieldCheck className="text-red-500" size={48} />
        <h2 className="text-xl font-black text-white">Access Restricted</h2>
        <p className="text-sm text-gray-400">Only the Software Settings profile can manage employee logins and payment methods.</p>
      </div>
    );
  }

  const grouped = employees.reduce((acc, e) => {
    (acc[e.outletName] = acc[e.outletName] || []).push(e);
    return acc;
  }, {});

  const handleToggleProfile = async (emp, profile) => {
    const next = emp.profiles.includes(profile)
      ? emp.profiles.filter(p => p !== profile)
      : [...emp.profiles, profile];
    try {
      await api.patch(`/api/software-settings/employees/${emp.id}`, { profiles: next });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, profiles: next } : e));
      toast.success(`Updated ${emp.name}`);
    } catch (err) {
      toast.error('Failed to update: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleActive = async (emp) => {
    try {
      await api.patch(`/api/software-settings/employees/${emp.id}`, { isActive: !emp.isActive });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, isActive: !e.isActive } : e));
      toast.success(`${emp.name} ${emp.isActive ? 'deactivated' : 'activated'}`);
    } catch (err) {
      toast.error('Failed to update: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCreate = async () => {
    if (!newEmp.name.trim()) return toast.error('Enter employee name');
    if (newEmp.password.length < 4) return toast.error('Password must be at least 4 characters');
    setSaving(true);
    try {
      await api.post('/api/software-settings/employees', newEmp);
      toast.success('Employee created');
      setShowCreate(false);
      setNewEmp({ name: '', outletName: 'Johar Town', password: '', profiles: ['POS'] });
      fetchEmployees();
    } catch (err) {
      toast.error('Failed to create: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 4) return toast.error('Password must be at least 4 characters');
    setSaving(true);
    try {
      await api.post(`/api/software-settings/employees/${resetTarget.id}/reset-password`, { password: newPassword });
      toast.success(`Password reset for ${resetTarget.name}`);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to reset: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleChangeSubmit = async () => {
    if (!selectedInvoice) return;
    if (!newMethod) return toast.error('Select a payment method');
    if (newMethod === selectedInvoice.paymentMethod) {
      return toast.error(`This invoice is already paid via ${METHOD_LABELS[newMethod]}`);
    }
    setChanging(true);
    try {
      const res = await api.post('/api/software-settings/payment-change', { saleId: selectedInvoice.id, newMethod });
      toast.success(res.data?.message || 'Payment method changed');
      const currentQuery = invoiceQuery;
      setSelectedInvoice(null);
      setNewMethod('ONLINE');
      fetchHistory();
      runInvoiceSearch(currentQuery);
    } catch (err) {
      toast.error('Change failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setChanging(false);
    }
  };

  const tabs = [
    { key: 'employees', label: 'Employee Management', icon: <Users size={16} /> },
    { key: 'payment', label: 'Payment Method Change', icon: <ArrowLeftRight size={16} /> },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-blue-400" /> Software Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage employee logins and correct POS payment methods.</p>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border-2 border-gray-700 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ EMPLOYEE MANAGEMENT TAB ═══════════════ */}
      {activeTab === 'employees' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
              <Plus size={16} /> New Employee
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            Object.entries(grouped).map(([outlet, list]) => (
              <div key={outlet} className="glass rounded-2xl border-2 border-gray-700 overflow-hidden">
                <div className="px-5 py-3 bg-gray-800/70 flex items-center gap-2 border-b border-gray-700">
                  <Building2 className="text-emerald-400" size={18} />
                  <h2 className="font-black text-white">{outlet}</h2>
                  <span className="ml-auto text-xs font-bold text-gray-400">{list.length} employee{list.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-700/70">
                  {list.map(emp => (
                    <div key={emp.id} className={`px-5 py-4 ${emp.isActive ? '' : 'opacity-60'}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center font-black text-blue-300">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white">{emp.name}</p>
                            <p className="text-[11px] text-gray-400">{emp.outletName}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          {profileOptions.map(p => {
                            const on = emp.profiles.includes(p);
                            return (
                              <button key={p} onClick={() => handleToggleProfile(emp, p)}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors ${on ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'}`}>
                                {on && '✓ '}{PROFILE_LABELS[p] || p}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setResetTarget(emp); setNewPassword(''); }}
                            className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/50 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-[11px]">
                            <KeyRound size={13} /> Reset Password
                          </button>
                          <button onClick={() => handleToggleActive(emp)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border ${emp.isActive ? 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' : 'bg-red-600/20 border-red-600/50 text-red-400'}`}>
                            {emp.isActive ? <Power size={13} /> : <PowerOff size={13} />}
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ═══════════════ PAYMENT METHOD CHANGE TAB ═══════════════ */}
      {activeTab === 'payment' && (
        <>
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-400">Outlet</label>
                <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                  {payOutlets.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[260px]">
                <label className="text-xs font-bold text-gray-400">Search invoice — receipt #, order #, invoice #, customer, phone</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input value={invoiceQuery} onChange={e => setInvoiceQuery(e.target.value)}
                    placeholder="RCP-20260812-…, JT-…, INV-…, customer name or phone"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                  {invoiceLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={16} />}
                </div>
              </div>
              <button onClick={() => runInvoiceSearch(invoiceQuery)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
                <RefreshCw size={15} /> Search
              </button>
            </div>
            <div className="mt-4 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 text-[12px] text-gray-400 leading-relaxed">
              The full paid amount moves from the old method to the new one (no duplication, no loss). Cash+Online invoices
              are converted to a single method — the whole paid amount is counted under the method you pick. Faisal Take
              invoices are excluded. POS History, Registers, Close Book and dashboards update immediately; already-closed
              Registers for that day are recomputed automatically.
            </div>

            {invoiceQuery.trim().length >= 2 ? (
              invoiceResults.length === 0 ? (
                <div className="mt-5 text-center py-10 text-sm text-gray-400">
                  {invoiceLoading ? 'Searching…' : 'No invoices match your search.'}
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {invoiceResults.map(inv => (
                    <div key={inv.id} className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white">{inv.receiptNumber}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${METHOD_STYLES[inv.paymentMethod] || 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                          {METHOD_LABELS[inv.paymentMethod] || inv.paymentMethod}
                        </span>
                        {inv.refundedAt && <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-red-600/20 border border-red-600/50 text-red-400">REFUNDED</span>}
                        <span className="ml-auto text-xs text-gray-400">{fmtDate(inv.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm">
                        <div>
                          <p className="text-gray-400 text-[11px]">Customer</p>
                          <p className="font-bold text-white">{inv.customerName || '-'} {inv.customerPhone && <span className="text-gray-400 font-normal">· {inv.customerPhone}</span>}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">Order / Invoice</p>
                          <p className="font-bold text-white">{inv.orderNumber || '-'}{inv.invoiceNumber ? ` · ${inv.invoiceNumber}` : ''}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">Total</p>
                          <p className="font-bold text-white">{fmtMoney(inv.grandTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">Paid</p>
                          <p className="font-bold text-emerald-400">{fmtMoney(inv.paid)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">Balance</p>
                          <p className="font-bold text-amber-400">{fmtMoney(inv.remaining)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[11px]">Cashier</p>
                          <p className="font-bold text-white">{inv.cashierName || '-'}</p>
                        </div>
                        <button onClick={() => { setSelectedInvoice(inv); setNewMethod(inv.paymentMethod === 'CASH' ? 'ONLINE' : 'CASH'); }}
                          className="ml-auto flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs">
                          <ArrowLeftRight size={14} /> Change Method
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="mt-5 text-center py-8 text-sm text-gray-500">
                Type at least 2 characters to search invoices for this outlet.
              </div>
            )}
          </div>

          {/* Change history */}
          <div className="glass rounded-2xl border-2 border-gray-700 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800/70 flex items-center gap-2 border-b border-gray-700">
              <ArrowLeftRight className="text-amber-400" size={18} />
              <h2 className="font-black text-white">Payment Method Change History</h2>
              <span className="ml-auto text-xs font-bold text-gray-400">{historyList.length} change{historyList.length !== 1 ? 's' : ''}</span>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={26} /></div>
            ) : historyList.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">No payment method changes yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5">Date / Time</th>
                      <th className="px-4 py-2.5">Outlet</th>
                      <th className="px-4 py-2.5">Receipt</th>
                      <th className="px-4 py-2.5">Order / Invoice</th>
                      <th className="px-4 py-2.5">Customer</th>
                      <th className="px-4 py-2.5">Total</th>
                      <th className="px-4 py-2.5">Amount Moved</th>
                      <th className="px-4 py-2.5">Change</th>
                      <th className="px-4 py-2.5">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {historyList.map(h => (
                      <tr key={h.id} className="hover:bg-gray-800/40">
                        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(h.changedAt)}</td>
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{h.outletName}</td>
                        <td className="px-4 py-2.5 font-bold text-white whitespace-nowrap">{h.receiptNumber}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{h.orderNumber || '-'}{h.invoiceNumber ? ` · ${h.invoiceNumber}` : ''}</td>
                        <td className="px-4 py-2.5 text-gray-300">{h.customerName || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{fmtMoney(h.grandTotal)}</td>
                        <td className="px-4 py-2.5 font-bold text-amber-400 whitespace-nowrap">{fmtMoney(h.amountMoved)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${METHOD_STYLES[h.previousMethod] || 'bg-gray-700 border-gray-600 text-gray-300'}`}>{METHOD_LABELS[h.previousMethod] || h.previousMethod}</span>
                          <ArrowLeftRight className="inline mx-1 text-gray-500" size={12} />
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${METHOD_STYLES[h.newMethod] || 'bg-gray-700 border-gray-600 text-gray-300'}`}>{METHOD_LABELS[h.newMethod] || h.newMethod}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{h.changedByName || h.changedBy || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════ SET DELAY TAB ═══════════════ */}
      {activeTab === 'delay' && (
        <div className="glass rounded-2xl p-6 border-2 border-gray-700/50 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Clock className="text-amber-400" /> Operational Phase Delay Configuration
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Configure allowed Acceptance Delay (minutes) and Total Phase Delay (hours) for each operational department.
              </p>
            </div>
            <button onClick={handleSaveDelayConfig} disabled={delaySaving || delayLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-950/40">
              {delaySaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save Thresholds
            </button>
          </div>

          {delayLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-amber-500" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'VERIFICATION', title: 'Verification', color: 'from-purple-900/40 to-indigo-900/40', border: 'border-purple-700/50' },
                { key: 'STORE', title: 'Store', color: 'from-blue-900/40 to-cyan-900/40', border: 'border-blue-700/50' },
                { key: 'LOGO', title: 'Logo Department', color: 'from-amber-900/40 to-yellow-900/40', border: 'border-amber-700/50' },
                { key: 'PRODUCTION', title: 'Production', color: 'from-orange-900/40 to-red-900/40', border: 'border-orange-700/50' },
                { key: 'DISPATCH', title: 'Dispatch', color: 'from-emerald-900/40 to-teal-900/40', border: 'border-emerald-700/50' },
              ].map(phase => {
                const current = delayConfig[phase.key] || { acceptanceMinutes: 30, totalHours: 24 };
                return (
                  <div key={phase.key} className={`bg-gradient-to-br ${phase.color} p-5 rounded-2xl border-2 ${phase.border} space-y-4 shadow-xl`}>
                    <div className="flex items-center justify-between border-b border-gray-700/50 pb-2">
                      <h3 className="font-black text-white text-base">{phase.title}</h3>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-700">
                        {phase.key}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          Acceptance Delay (Minutes)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={current.acceptanceMinutes ?? 30}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setDelayConfig(prev => ({
                              ...prev,
                              [phase.key]: { ...prev[phase.key], acceptanceMinutes: val }
                            }));
                          }}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-amber-500 outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Max time order can remain waiting to be accepted.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-300 mb-1">
                          Total Phase Delay (Hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={current.totalHours ?? 24}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setDelayConfig(prev => ({
                              ...prev,
                              [phase.key]: { ...prev[phase.key], totalHours: val }
                            }));
                          }}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-amber-500 outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Max time allowed for complete phase execution.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Change method modal ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-16 pb-10 overflow-y-auto" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1"><ArrowLeftRight className="text-amber-400" /> Change Payment Method</h3>
            <p className="text-sm text-gray-400 mb-4">{selectedInvoice.receiptNumber} · {selectedInvoice.outletName}</p>
            <div className="space-y-2 bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-400">Customer</span><span className="font-bold text-white">{selectedInvoice.customerName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Order / Invoice</span><span className="font-bold text-white">{selectedInvoice.orderNumber || '-'}{selectedInvoice.invoiceNumber ? ` · ${selectedInvoice.invoiceNumber}` : ''}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="font-bold text-white">{fmtMoney(selectedInvoice.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Paid / Balance</span><span className="font-bold text-white">{fmtMoney(selectedInvoice.paid)} / {fmtMoney(selectedInvoice.remaining)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Method</span>
                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${METHOD_STYLES[selectedInvoice.paymentMethod] || 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                  {METHOD_LABELS[selectedInvoice.paymentMethod] || selectedInvoice.paymentMethod}
                </span>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-400 mb-2">Change to</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CHANGE_TARGETS.map(m => (
                <button key={m} onClick={() => setNewMethod(m)}
                  className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-sm font-bold border transition-colors ${newMethod === m ? METHOD_STYLES[m] : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'}`}>
                  {m === 'CASH' && <Banknote size={18} />}
                  {m === 'ONLINE' && <Wallet size={18} />}
                  {m === 'CARD' && <CreditCard size={18} />}
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              The full paid amount ({(fmtMoney(selectedInvoice.paid))}) will be counted under {METHOD_LABELS[newMethod]}.
              {selectedInvoice.paymentMethod === 'CASH_ONLINE' && ' The existing Cash+Online split will be reset — the whole amount moves to the method above.'}
            </p>
            <div className="flex gap-2">
              <button onClick={handleChangeSubmit} disabled={changing || newMethod === selectedInvoice.paymentMethod}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {changing ? <><Loader2 className="animate-spin" size={15} /> Changing…</> : 'Confirm Change'}
              </button>
              <button onClick={() => setSelectedInvoice(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-16 pb-10 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4">New Employee</h3>
            <div className="space-y-3">
              <input value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })}
                placeholder="Employee name" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
              <select value={newEmp.outletName} onChange={e => setNewEmp({ ...newEmp, outletName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                {OUTLETS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input value={newEmp.password} onChange={e => setNewEmp({ ...newEmp, password: e.target.value })}
                type="text" placeholder="Password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
              <div>
                <p className="text-xs font-bold text-gray-400 mb-2">Profiles</p>
                <div className="flex flex-wrap gap-2">
                  {profileOptions.map(p => (
                    <button key={p} onClick={() => setNewEmp({
                      ...newEmp,
                      profiles: newEmp.profiles.includes(p) ? newEmp.profiles.filter(x => x !== p) : [...newEmp.profiles, p]
                    })}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${newEmp.profiles.includes(p) ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                      {newEmp.profiles.includes(p) && '✓ '}{PROFILE_LABELS[p] || p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin inline" size={15} /> : 'Create Employee'}
              </button>
              <button onClick={() => setShowCreate(false)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-24 pb-10 overflow-y-auto" onClick={() => setResetTarget(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><KeyRound className="text-amber-400" /> Reset Password</h3>
            <p className="text-sm text-gray-400 mb-4">Set a new password for <span className="font-bold text-white">{resetTarget.name}</span> ({resetTarget.outletName})</p>
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
            <div className="flex gap-2 mt-5">
              <button onClick={handleResetPassword} disabled={saving}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin inline" size={15} /> : 'Save Password'}
              </button>
              <button onClick={() => setResetTarget(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoftwareSettings;
