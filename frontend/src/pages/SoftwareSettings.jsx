import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, KeyRound, ShieldCheck, Loader2, Power, PowerOff, Building2 } from 'lucide-react';

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

const SoftwareSettings = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [profileOptions, setProfileOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', outletName: 'Johar Town', password: '', profiles: ['POS'] });
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

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

  if (String(user?.role || '').toUpperCase() !== 'SOFTWARE_SETTINGS') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <ShieldCheck className="text-red-500" size={48} />
        <h2 className="text-xl font-black text-white">Access Restricted</h2>
        <p className="text-sm text-gray-400">Only the Software Settings profile can manage employee logins.</p>
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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-blue-400" /> Software Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">Centrally manage all employee logins — POS, Outlet Order Entry, Dispatch, Faisal Profile.</p>
        </div>
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
