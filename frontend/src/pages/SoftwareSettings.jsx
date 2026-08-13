import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSystemPause } from '../context/SystemPauseContext';
import { Users, Plus, KeyRound, ShieldCheck, Loader2, Power, PowerOff, Building2, ArrowLeftRight, Search, RefreshCw, Banknote, Wallet, CreditCard, Clock, Save, PauseCircle, PlayCircle, History, Laptop, Trash2, Ban, Check, X, UserCog, Copy, MoveRight } from 'lucide-react';

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

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CEO: 'CEO',
  SOFTWARE_SETTINGS: 'Software Settings',
  FAISAL: 'Faisal',
  STORE: 'Store',
  STORE_EMPLOYEE: 'Store Employee',
  PRODUCTION: 'Production',
  PRODUCTION_IN: 'Production In',
  PRODUCTION_OUT: 'Production Out',
  LOGO_DESIGN: 'Logo Design',
  LOGO_DESIGN_EMPLOYEE: 'Logo Design Employee',
  LOGO_DESIGNER: 'Logo Designer',
  DISPATCH: 'Dispatch',
  MAIN_EMPLOYEE: 'Main Employee',
  DELIVERY_BOY: 'Delivery Boy',
  INVENTORY_VIEW: 'Inventory View',
  ORDER_ENTRY: 'Order Entry',
  OUTLET: 'Outlet',
  OUTLET_ORDER_ENTRY: 'Outlet Order Entry',
};

const DEVICE_STATUS_LABELS = {
  PENDING: { label: 'Pending', cls: 'bg-amber-600/20 border-amber-600/50 text-amber-400' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-600/20 border-red-600/50 text-red-400' },
  DISABLED: { label: 'Disabled', cls: 'bg-gray-600/20 border-gray-500/50 text-gray-400' },
};
const DEVICE_STATUS_KEYS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'DISABLED'];

const fmtMoney = (n) => 'PKR ' + Number(n || 0).toLocaleString();
const fmtDate = (d) => {
  if (!d) return '-';
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    x.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const DEFAULT_DELAY_CONFIG = {
  VERIFICATION: 2, // 2 hours
  STORE: 2,        // 2 hours
  LOGO: 4,         // 4 hours
  PRODUCTION: 10,  // 10 hours
  DISPATCH: 4      // 4 hours
};

const SoftwareSettings = () => {
  const { user } = useAuth();
  const { paused: systemPaused, info: pauseInfo, profiles: pauseProfiles, profileDefs: pauseProfileDefs, history: pauseHistory, refresh: refreshPauseState, fetchHistory: fetchPauseHistory, saveProfiles: savePauseProfiles } = useSystemPause();
  const [activeTab, setActiveTab] = useState('employees');
  const [pauseProfilesSel, setPauseProfilesSel] = useState([]);
  const [pauseProfilesBusy, setPauseProfilesBusy] = useState(false);

  // Load the saved pause-profile selection whenever the backend state changes.
  useEffect(() => {
    if (Array.isArray(pauseProfiles) && pauseProfiles.length) setPauseProfilesSel(pauseProfiles);
  }, [pauseProfiles]);

  const togglePauseProfile = (key) => setPauseProfilesSel((prev) =>
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  );

  const handleSavePauseProfiles = async () => {
    if (pauseProfilesBusy) return;
    setPauseProfilesBusy(true);
    try {
      const res = await savePauseProfiles(pauseProfilesSel);
      toast.success(res?.saved ? 'Pause profile configuration saved.' : 'Failed to save pause profile configuration.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save pause profile configuration.');
    } finally {
      setPauseProfilesBusy(false);
    }
  };

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

  // ── Device management state ──
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceFilter, setDeviceFilter] = useState('ALL');
  const [showRegisterDevice, setShowRegisterDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({ deviceName: '', assignedRole: 'STORE', assignedUserId: '' });
  const [registerResult, setRegisterResult] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);

  // ── Main profile management state ──
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileResetTarget, setProfileResetTarget] = useState(null);
  const [profilePassword, setProfilePassword] = useState('');

  // ── Profile login history state ──
  const [sessions, setSessions] = useState([]);
  const [sessionsActive, setSessionsActive] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await api.get('/api/auth/sessions', { params: { limit: 500, days: 90 } });
      setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []);
      setSessionsActive(res.data?.activeCount || 0);
    } catch (err) {
      toast.error('Failed to load login history: ' + (err.response?.data?.message || err.message));
    } finally {
      setSessionsLoading(false);
    }
  }, []);

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
      if (res.data) {
        // Convert any legacy nested config format to new flat number format
        const normalized = {};
        Object.keys(DEFAULT_DELAY_CONFIG).forEach(k => {
          const val = res.data[k];
          if (typeof val === 'number') {
            normalized[k] = val;
          } else if (val && typeof val.totalHours === 'number') {
            normalized[k] = val.totalHours;
          } else {
            normalized[k] = DEFAULT_DELAY_CONFIG[k];
          }
        });
        setDelayConfig(normalized);
      }
    } catch (err) {
      toast.error('Failed to load delay config: ' + (err.response?.data?.message || err.message));
    } finally {
      setDelayLoading(false);
    }
  }, []);

  useEffect(() => { fetchDelayConfig(); }, [fetchDelayConfig]);

  const fetchDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await api.get('/api/system/devices');
      setDevices(res.data?.devices || []);
    } catch (err) {
      toast.error('Failed to load devices: ' + (err.response?.data?.message || err.message));
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const res = await api.get('/api/system/profiles');
      setProfiles(res.data?.profiles || []);
    } catch (err) {
      toast.error('Failed to load profiles: ' + (err.response?.data?.message || err.message));
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

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

  const userRole = String(user?.role || '').toUpperCase().trim();
  if (userRole !== 'SOFTWARE_SETTINGS') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <ShieldCheck className="text-red-500" size={48} />
        <h2 className="text-xl font-black text-white">Access Restricted</h2>
        <p className="text-sm text-gray-400">Only the Software Settings profile can manage employee logins and configuration settings.</p>
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

  // ── Device actions ──
  const deviceAction = async (fn, successMsg) => {
    setDeviceBusy(true);
    try {
      const res = await fn();
      toast.success(res.data?.message || successMsg);
      fetchDevices();
    } catch (err) {
      toast.error('Action failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleApproveDevice = (id) => deviceAction(() => api.post(`/api/system/devices/${id}/approve`), 'Device approved');
  const handleRejectDevice = (id) => deviceAction(() => api.post(`/api/system/devices/${id}/reject`), 'Device request rejected');
  const handleSetDeviceStatus = (id, status) => deviceAction(() => api.post(`/api/system/devices/${id}/status`, { status }), `Device set to ${status}`);
  const handleRemoveDevice = (id) => deviceAction(() => api.delete(`/api/system/devices/${id}`), 'Device removed');

  const handleRegisterDevice = async () => {
    if (!newDevice.deviceName.trim()) return toast.error('Enter a device name');
    setDeviceBusy(true);
    try {
      const res = await api.post('/api/system/devices', newDevice);
      setRegisterResult(res.data);
      setNewDevice({ deviceName: '', assignedRole: 'STORE', assignedUserId: '' });
      fetchDevices();
    } catch (err) {
      toast.error('Failed to register device: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleMoveDevice = async () => {
    if (!moveTarget) return;
    setDeviceBusy(true);
    try {
      await api.patch(`/api/system/devices/${moveTarget.id}`, {
        assignedRole: moveTarget.assignedRole,
        assignedUserId: moveTarget.assignedUserId,
      });
      toast.success(`Device moved to ${moveTarget.assignedRole}`);
      setMoveTarget(null);
      fetchDevices();
    } catch (err) {
      toast.error('Move failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeviceBusy(false);
    }
  };

  // ── Main profile actions ──
  const handleProfileToggleActive = async (profile) => {
    try {
      await api.patch(`/api/system/profiles/${profile.id}`, { isActive: !profile.isActive });
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, isActive: !profile.isActive } : p));
      toast.success(`${profile.name} ${profile.isActive ? 'disabled' : 'enabled'}`);
    } catch (err) {
      toast.error('Failed to update profile: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleProfileSave = async (profile, field, value) => {
    try {
      await api.patch(`/api/system/profiles/${profile.id}`, { [field]: value });
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, [field]: value } : p));
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleProfilePasswordReset = async () => {
    if (!profileResetTarget) return;
    if (profilePassword.length < 4) return toast.error('Password must be at least 4 characters');
    setDeviceBusy(true);
    try {
      await api.post(`/api/system/profiles/${profileResetTarget.id}/password`, { password: profilePassword });
      toast.success(`Password reset for ${profileResetTarget.name}`);
      setProfileResetTarget(null);
      setProfilePassword('');
    } catch (err) {
      toast.error('Failed to reset password: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeviceBusy(false);
    }
  };

  const tabs = [
    { key: 'employees', label: 'Employee Management', icon: <Users size={16} /> },
    { key: 'payment', label: 'Payment Method Change', icon: <ArrowLeftRight size={16} /> },
    { key: 'delay', label: 'Set Delay', icon: <Clock size={16} /> },
    { key: 'devices', label: 'Device Management', icon: <Laptop size={16} /> },
    { key: 'profiles', label: 'Profile Management', icon: <UserCog size={16} /> },
    { key: 'sessions', label: 'Profile Login History', icon: <History size={16} /> },
    { key: 'system', label: 'System Pause', icon: <PauseCircle size={16} /> },
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

      {activeTab === 'delay' && (
        <div className="glass rounded-2xl p-6 border-2 border-gray-700/50 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Clock className="text-amber-400" /> Operational Phase Delay Configuration
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Configure maximum allowed deadline hours for each operational department.
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
                const current = delayConfig[phase.key] ?? DEFAULT_DELAY_CONFIG[phase.key];
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
                          Deadline (Hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={current}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setDelayConfig(prev => ({
                              ...prev,
                              [phase.key]: val
                            }));
                          }}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-amber-500 outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Maximum allowed hours for the {phase.title} phase.
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

      {/* ═══════════════ SYSTEM PAUSE TAB ═══════════════ */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className={`glass rounded-2xl p-6 border-2 ${systemPaused ? 'border-red-500/40' : 'border-emerald-500/30'} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {systemPaused
                    ? <PauseCircle className="text-red-400" /> 
                    : <PlayCircle className="text-emerald-400" />}
                  System Pause Status
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Use the <span className="text-white font-bold">Pause System / Resume System</span> button in the top navigation bar.
                  While paused, the selected profiles are stopped — order entry, POS sales, production, store, verification, dispatch, delivery, returns and cancellations. Unselected profiles keep working. No existing data is changed.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { fetchPauseHistory(); refreshPauseState(); }}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all">
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
            </div>

            {systemPaused && pauseInfo ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4">
                <p className="font-black text-red-300 text-sm">🔴 SYSTEM PAUSED — Functions are temporarily stopped for the selected profiles by Admin.</p>
                <p className="text-xs text-red-400/90 mt-1 font-bold">
                  Paused by {pauseInfo.pausedBy} · {pauseInfo.source} · {fmtDate(pauseInfo.pausedAt)}
                </p>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4">
                <p className="font-black text-emerald-300 text-sm">🟢 SYSTEM ACTIVE — All functions have been resumed.</p>
              </div>
            )}
          </div>

          {/* ═══════ SYSTEM PAUSE SETTINGS — profile selection ═══════ */}
          <div className="glass rounded-2xl border-2 border-indigo-500/30 overflow-hidden">
            <div className="px-5 py-3 bg-indigo-900/40 flex items-center gap-2 border-b border-indigo-500/30">
              <ShieldCheck className="text-indigo-400" size={18} />
              <h3 className="font-black text-white">System Pause Settings</h3>
              <span className="ml-auto text-xs font-bold text-gray-400">Which profiles the pause applies to</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400 font-bold">
                Checked profiles are <span className="text-red-400">paused</span> when Pause System is used from the top bar; unchecked profiles
                keep working normally. No profiles saved yet means the pause applies to <span className="text-red-400">every</span> profile (global pause).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(pauseProfileDefs.length ? pauseProfileDefs : [
                  { key: 'order_entry', label: 'Order Entry' },
                  { key: 'verification', label: 'Verification / Inventory View' },
                  { key: 'faisal', label: 'Faisal' },
                  { key: 'store', label: 'Store' },
                  { key: 'logo_design', label: 'Logo Design' },
                  { key: 'production', label: 'Production' },
                  { key: 'dispatch', label: 'Dispatch' },
                  { key: 'delivery', label: 'Delivery Boy' },
                  { key: 'outlet_johar', label: 'Johar Town Outlet' },
                  { key: 'outlet_abbottabad', label: 'Abbottabad Outlet' },
                  { key: 'outlet_jail', label: 'Jail Road Outlet' },
                  { key: 'outlet_other', label: 'Other Outlet Profiles' },
                ]).map((p) => {
                  const on = pauseProfilesSel.includes(p.key);
                  return (
                    <button key={p.key} onClick={() => togglePauseProfile(p.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${on
                        ? 'bg-red-600/20 border-red-500/50 text-red-300'
                        : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      <span className={`w-4 h-4 rounded flex items-center justify-center border-2 text-[10px] ${on ? 'bg-red-500 border-red-400 text-white' : 'border-gray-600'}`}>
                        {on ? '✓' : ''}
                      </span>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={handleSavePauseProfiles} disabled={pauseProfilesBusy}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
                  {pauseProfilesBusy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                  Save Pause Profile Configuration
                </button>
                <button onClick={() => setPauseProfilesSel([])}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all">
                  All Profiles (Global Pause)
                </button>
                <span className="text-xs font-bold text-gray-500">{pauseProfilesSel.length || 'All'} profile{pauseProfilesSel.length === 1 ? '' : 's'} selected</span>
              </div>
            </div>
          </div>

          {/* Pause history */}
          <div className="glass rounded-2xl border-2 border-gray-700/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800/70 flex items-center gap-2 border-b border-gray-700">
              <History className="text-blue-400" size={18} />
              <h3 className="font-black text-white">Pause / Resume History</h3>
              <span className="ml-auto text-xs font-bold text-gray-400">{pauseHistory.length} events</span>
            </div>
            {pauseHistory.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm font-bold">No pause/resume events recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-700/70 max-h-[420px] overflow-y-auto">
                {pauseHistory.map((h, i) => {
                  const isPause = String(h.action || '').toUpperCase() === 'PAUSE';
                  return (
                    <div key={i} className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${isPause ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <span className={`text-xs font-black uppercase tracking-wider ${isPause ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isPause ? 'Paused' : 'Resumed'}
                      </span>
                      <span className="text-sm font-bold text-white">{h.by || h.pausedBy || h.resumedBy || '—'}</span>
                      <span className="text-xs text-gray-400 font-bold">{h.source}</span>
                      <span className="ml-auto text-xs text-gray-500 font-bold">{fmtDate(h.at || h.pausedAt || h.resumedAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ DEVICE MANAGEMENT TAB ═══════════════ */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><Laptop className="text-blue-400" /> Device Management</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Every computer that logs in is checked against the authorized list. A new computer is <span className="text-amber-400 font-bold">blocked</span> and a
                  request is created here for approval. Approve / Reject / Disable / Re-enable / Remove / Move a device below.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                  {DEVICE_STATUS_KEYS.map(k => <option key={k} value={k}>{k === 'ALL' ? 'All Statuses' : k}</option>)}
                </select>
                <button onClick={() => { setShowRegisterDevice(true); setRegisterResult(null); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm">
                  <Plus size={15} /> Add Device
                </button>
                <button onClick={fetchDevices}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {DEVICE_STATUS_KEYS.filter(k => k !== 'ALL').map(k => {
                const count = devices.filter(d => d.status === k).length;
                return (
                  <span key={k} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${DEVICE_STATUS_LABELS[k].cls}`}>
                    {DEVICE_STATUS_LABELS[k].label}: {count}
                  </span>
                );
              })}
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-gray-700/40 border-gray-600 text-gray-300">Total: {devices.length}</span>
            </div>
          </div>

          {devicesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : devices.length === 0 ? (
            <div className="glass rounded-2xl border-2 border-gray-700 py-16 text-center text-sm text-gray-500 font-bold">
              No devices registered yet. Devices appear here when a login attempt is made from an unknown computer.
            </div>
          ) : (
            <div className="glass rounded-2xl border-2 border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5">Device</th>
                      <th className="px-4 py-2.5">Profile</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Last Activity</th>
                      <th className="px-4 py-2.5">Added</th>
                      <th className="px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {devices.filter(d => deviceFilter === 'ALL' || d.status === deviceFilter).map(d => (
                      <tr key={d.id} className={`hover:bg-gray-800/40 ${d.status === 'DISABLED' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Laptop size={15} className="text-gray-500 shrink-0" />
                            <div>
                              <p className="font-bold text-white">{d.deviceName || 'Unknown device'}</p>
                              {d.lastUserAgent && <p className="text-[10px] text-gray-500 max-w-[220px] truncate">{d.lastUserAgent}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-blue-600/20 border-blue-600/50 text-blue-300">
                            {ROLE_LABELS[d.assignedRole] || d.assignedRole}
                          </span>
                          {d.assignedUserName && <p className="text-[10px] text-gray-500 mt-0.5">{d.assignedUserName}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${DEVICE_STATUS_LABELS[d.status]?.cls || 'bg-gray-700 border-gray-600 text-gray-300'}`}>
                            {DEVICE_STATUS_LABELS[d.status]?.label || d.status}
                          </span>
                          {d.status === 'PENDING' && (
                            <p className="text-[10px] text-amber-500 mt-0.5">{d.requestNote || 'Awaiting approval'}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {fmtDate(d.lastLoginAt)}
                          {d.lastIp && <p className="text-[10px] text-gray-500">IP {d.lastIp}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {d.status === 'PENDING' && (
                              <>
                                <button onClick={() => handleApproveDevice(d.id)} disabled={deviceBusy}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                  <Check size={12} /> Approve
                                </button>
                                <button onClick={() => handleRejectDevice(d.id)} disabled={deviceBusy}
                                  className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                  <X size={12} /> Reject
                                </button>
                              </>
                            )}
                            {d.status === 'APPROVED' && (
                              <>
                                <button onClick={() => setMoveTarget({ ...d, assignedRole: d.assignedRole, assignedUserId: d.assignedUserId || '' })}
                                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                  <MoveRight size={12} /> Move
                                </button>
                                <button onClick={() => handleSetDeviceStatus(d.id, 'DISABLED')} disabled={deviceBusy}
                                  className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                  <Ban size={12} /> Disable
                                </button>
                              </>
                            )}
                            {d.status === 'DISABLED' && (
                              <button onClick={() => handleSetDeviceStatus(d.id, 'APPROVED')} disabled={deviceBusy}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">
                                <Power size={12} /> Re-enable
                              </button>
                            )}
                            <button onClick={() => { if (window.confirm(`Remove device "${d.deviceName || 'Unknown'}"? It will need re-approval to log in again.`)) handleRemoveDevice(d.id); }} disabled={deviceBusy}
                              className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ PROFILE MANAGEMENT TAB ═══════════════ */}
      {activeTab === 'profiles' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><UserCog className="text-indigo-400" /> Profile Management</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Manage the main system accounts (Admin, Faisal, Store, Production, etc.). Set or reset passwords, enable / disable profiles,
                  and see how many authorized devices each profile has.
                </p>
              </div>
              <button onClick={fetchProfiles}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {profilesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : profiles.length === 0 ? (
            <div className="glass rounded-2xl border-2 border-gray-700 py-16 text-center text-sm text-gray-500 font-bold">
              No profiles found.
            </div>
          ) : (
            <div className="glass rounded-2xl border-2 border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/60 text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Devices</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {profiles.map(p => (
                      <tr key={p.id} className={`hover:bg-gray-800/40 ${!p.isActive ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-black text-indigo-300 text-xs">
                              {(p.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-white">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-300">{p.email}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-blue-600/20 border-blue-600/50 text-blue-300">
                            {ROLE_LABELS[p.role] || p.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-white"><Laptop size={13} className="text-gray-500" /> {p._count?.authorizedDevices || 0}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${p.isActive ? 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' : 'bg-red-600/20 border-red-600/50 text-red-400'}`}>
                            {p.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button onClick={() => { setProfileResetTarget(p); setProfilePassword(''); }}
                              className="flex items-center gap-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/50 text-amber-400 font-bold px-2.5 py-1 rounded-lg text-[11px]">
                              <KeyRound size={12} /> Set Password
                            </button>
                            <button onClick={() => handleProfileToggleActive(p)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${p.isActive ? 'bg-red-600/20 border-red-600/50 text-red-400' : 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400'}`}>
                              {p.isActive ? <><Ban size={12} /> Disable</> : <><Power size={12} /> Enable</>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl border-2 border-gray-700 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2"><History className="text-emerald-400" /> Profile Login History</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Real login / logout session records for system profiles. Each row is created automatically on a successful login
                  (after the device authorization gate) and closed when that profile logs out.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${sessionsActive > 0 ? 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                  {sessionsActive} currently logged in
                </span>
                <button onClick={fetchSessions}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm">
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
          ) : sessions.length === 0 ? (
            <div className="glass rounded-2xl border-2 border-gray-700 py-16 text-center text-sm text-gray-500 font-bold">
              No login records found in the last 90 days.
            </div>
          ) : (
            <div className="glass rounded-2xl border-2 border-gray-700 overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900/60 text-[11px] uppercase tracking-wide text-gray-400 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Profile</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Login Time</th>
                      <th className="px-4 py-2.5">Logout Time</th>
                      <th className="px-4 py-2.5">Device</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sessions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-800/40">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center font-black text-emerald-300 text-xs">
                              {(s.userName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{s.userName}</span>
                              <span className="text-[10px] text-gray-500">{s.userEmail}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-blue-600/20 border-blue-600/50 text-blue-300">
                            {ROLE_LABELS[s.role] || s.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-300">{fmtDate(s.loginAt)}</td>
                        <td className="px-4 py-2.5 text-gray-300">{s.logoutAt ? fmtDate(s.logoutAt) : '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400">{s.deviceName || '—'}</td>
                        <td className="px-4 py-2.5">
                          {s.status === 'ACTIVE'
                            ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-emerald-600/20 border-emerald-600/50 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
                              </span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border bg-gray-700/40 border-gray-600 text-gray-400">
                                Logged Out
                              </span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

      {/* ── Register device modal ── */}
      {showRegisterDevice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-16 pb-10 overflow-y-auto" onClick={() => setShowRegisterDevice(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><Laptop className="text-blue-400" /> Add Device</h3>
            <p className="text-sm text-gray-400 mb-4">
              Register a new computer without waiting for a login attempt. After saving, the one-time registration code below is
              entered on that computer's login screen.
            </p>
            {registerResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 font-bold mb-2">ONE-TIME REGISTRATION CODE</p>
                  <p className="text-2xl font-black tracking-[0.35em] text-emerald-300 select-all">{registerResult.registrationCode}</p>
                  <button onClick={() => navigator.clipboard?.writeText(registerResult.registrationCode)}
                    className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs">
                    <Copy size={13} /> Copy Code
                  </button>
                  <p className="text-[10px] text-gray-500 mt-3">
                    Enter this code on the new computer's login screen (I have a device registration code). The code works once.
                  </p>
                </div>
                <button onClick={() => { setShowRegisterDevice(false); setRegisterResult(null); }}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Done</button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <input value={newDevice.deviceName} onChange={e => setNewDevice({ ...newDevice, deviceName: e.target.value })}
                    placeholder="Device / computer name (e.g. Store PC 2)" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
                  <select value={newDevice.assignedRole} onChange={e => setNewDevice({ ...newDevice, assignedRole: e.target.value, assignedUserId: '' })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={handleRegisterDevice} disabled={deviceBusy}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                    {deviceBusy ? <Loader2 className="animate-spin inline" size={15} /> : 'Register Device'}
                  </button>
                  <button onClick={() => setShowRegisterDevice(false)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Move device modal ── */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-24 pb-10 overflow-y-auto" onClick={() => setMoveTarget(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><MoveRight className="text-blue-400" /> Move Device to Another Profile</h3>
            <p className="text-sm text-gray-400 mb-4">
              Move <span className="font-bold text-white">{moveTarget.deviceName || 'Unknown'}</span> to a different profile. The computer
              keeps its authorization but becomes valid only for the new profile.
            </p>
            <div className="space-y-3">
              <select value={moveTarget.assignedRole} onChange={e => setMoveTarget({ ...moveTarget, assignedRole: e.target.value, assignedUserId: '' })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={moveTarget.assignedUserId || ''} onChange={e => setMoveTarget({ ...moveTarget, assignedUserId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none">
                <option value="">Any user of that profile</option>
                {profiles.filter(p => p.role === moveTarget.assignedRole).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleMoveDevice} disabled={deviceBusy}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                {deviceBusy ? <Loader2 className="animate-spin inline" size={15} /> : 'Move Device'}
              </button>
              <button onClick={() => setMoveTarget(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile password reset modal ── */}
      {profileResetTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-24 pb-10 overflow-y-auto" onClick={() => setProfileResetTarget(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><KeyRound className="text-amber-400" /> Set New Password</h3>
            <p className="text-sm text-gray-400 mb-4">Set a new login password for <span className="font-bold text-white">{profileResetTarget.name}</span> ({ROLE_LABELS[profileResetTarget.role] || profileResetTarget.role})</p>
            <input value={profilePassword} onChange={e => setProfilePassword(e.target.value)}
              type="password" placeholder="New password" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-blue-500 outline-none" />
            <div className="flex gap-2 mt-5">
              <button onClick={handleProfilePasswordReset} disabled={deviceBusy}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-50">
                {deviceBusy ? <Loader2 className="animate-spin inline" size={15} /> : 'Save Password'}
              </button>
              <button onClick={() => setProfileResetTarget(null)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoftwareSettings;
