import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Users, Plus, Search, Edit2, Trash2, Key, CheckCircle, XCircle, RefreshCcw, ArrowLeft, UserPlus, Shield, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'FAISAL', 'ORDER_ENTRY', 'OUTLET', 'PRODUCTION',
  'STORE', 'LOGO_DESIGN', 'DISPATCH', 'DELIVERY_BOY', 'INVENTORY_VIEW'
];
const SUB_ROLES = ['POS', 'GENERAL', 'ALL'];
const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-red-500/20 text-red-400', ADMIN: 'bg-purple-500/20 text-purple-400',
  FAISAL: 'bg-amber-500/20 text-amber-400', ORDER_ENTRY: 'bg-blue-500/20 text-blue-400',
  OUTLET: 'bg-emerald-500/20 text-emerald-400', PRODUCTION: 'bg-indigo-500/20 text-indigo-400',
  STORE: 'bg-orange-500/20 text-orange-400', LOGO_DESIGN: 'bg-pink-500/20 text-pink-400',
  DISPATCH: 'bg-teal-500/20 text-teal-400', DELIVERY_BOY: 'bg-cyan-500/20 text-cyan-400',
  INVENTORY_VIEW: 'bg-gray-500/20 text-gray-400'
};
const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', FAISAL: 'Faisal',
  ORDER_ENTRY: 'Order Entry', OUTLET: 'Outlet', PRODUCTION: 'Production',
  STORE: 'Store', LOGO_DESIGN: 'Logo Design', DISPATCH: 'Dispatch',
  DELIVERY_BOY: 'Delivery Boy', INVENTORY_VIEW: 'Inventory View'
};

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OUTLET', outletName: '', subRole: '', employeeId: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterRole) params.role = filterRole;
      if (search) params.search = search;
      const res = await api.get('/api/employees', { params });
      setEmployees(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filterRole, search]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openCreate = () => {
    setEditEmployee(null);
    setForm({ name: '', email: '', password: '', role: 'OUTLET', outletName: '', subRole: '', employeeId: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditEmployee(emp);
    setForm({ name: emp.name, email: emp.email, password: '', role: emp.role, outletName: emp.outletName || '', subRole: emp.subRole || '', employeeId: emp.employeeId || '' });
    setFormError('');
    setShowModal(true);
  };

  const openPasswordReset = (emp) => {
    setPasswordTarget(emp);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setFormError('');
    try {
      if (editEmployee) {
        const payload = { name: form.name, email: form.email, role: form.role, outletName: form.outletName || null, subRole: form.subRole || null, employeeId: form.employeeId || null };
        await api.put(`/api/employees/${editEmployee.id}`, payload);
      } else {
        if (!form.password) { setFormError('Password is required for new employee'); setSaving(false); return; }
        await api.post('/api/employees', form);
      }
      setShowModal(false);
      fetchEmployees();
    } catch (err) { setFormError(err.response?.data?.message || 'Error saving employee'); }
    setSaving(false);
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 4) { setFormError('Password must be at least 4 characters'); return; }
    try {
      await api.put(`/api/employees/${passwordTarget.id}/reset-password`, { password: newPassword });
      setShowPasswordModal(false);
    } catch (err) { setFormError(err.response?.data?.message || 'Error resetting password'); }
  };

  const handleDeactivate = async (emp) => {
    if (!window.confirm(`Deactivate ${emp.name}? They will no longer be able to log in.`)) return;
    try {
      await api.put(`/api/employees/${emp.id}/deactivate`);
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const filtered = employees.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-2 md:p-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
          <ArrowLeft size={16} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2"><Users size={20} /> Employee Management</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Manage employees for all departments & outlets</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
          <UserPlus size={14} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
              className="w-full bg-gray-900 border-2 border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors" />
          </div>
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-gray-900 border-2 border-gray-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* Employee Table */}
      {loading ? (
        <div className="text-center py-8"><RefreshCcw size={20} className="text-purple-400 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-xs font-bold">No employees found</div>
      ) : (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Name</th>
                  <th className="text-left p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Email</th>
                  <th className="text-left p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Role</th>
                  <th className="text-left p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Outlet</th>
                  <th className="text-left p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Sub-Role</th>
                  <th className="text-center p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Status</th>
                  <th className="text-right p-3 text-gray-500 font-black uppercase tracking-widest text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-black text-white">{emp.name?.charAt(0)?.toUpperCase()}</div>
                        <span className="font-black text-white">{emp.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-400 font-bold">{emp.email}</td>
                    <td className="p-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${ROLE_COLORS[emp.role] || 'bg-gray-500/20 text-gray-400'}`}>
                        {ROLE_LABELS[emp.role] || emp.role}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 font-bold">{emp.outletName || '—'}</td>
                    <td className="p-3">
                      {emp.subRole ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">{emp.subRole}</span>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {emp.isActive ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit mx-auto"><CheckCircle size={10} /> Active</span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1 w-fit mx-auto"><XCircle size={10} /> Inactive</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors" title="Edit">
                          <Edit2 size={12} className="text-blue-400" />
                        </button>
                        <button onClick={() => openPasswordReset(emp)} className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors" title="Reset Password">
                          <Key size={12} className="text-amber-400" />
                        </button>
                        {emp.role !== 'SUPER_ADMIN' && (
                          <button onClick={() => handleDeactivate(emp)} className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors" title="Deactivate">
                            <Trash2 size={12} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white">{editEmployee ? 'Edit Employee' : 'Create Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><XCircle size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="Employee name" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="email@example.com" />
              </div>
              {!editEmployee && (
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Password</label>
                  <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password"
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="Minimum 4 characters" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, subRole: e.target.value !== 'OUTLET' ? '' : form.subRole })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Sub-Role</label>
                  <select value={form.subRole} onChange={e => setForm({ ...form, subRole: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500">
                    <option value="">None</option>
                    {SUB_ROLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {(form.role === 'OUTLET') && (
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Outlet Name</label>
                  <input value={form.outletName} onChange={e => setForm({ ...form, outletName: e.target.value })}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="e.g., Johar Town, Jail Road" />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Employee ID (optional)</label>
                <input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="Auto-generated or custom" />
              </div>
            </div>

            {formError && <p className="text-xs font-bold text-red-400">{formError}</p>}

            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
              {saving ? 'Saving...' : editEmployee ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && passwordTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white">Reset Password — {passwordTarget.name}</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-500 hover:text-white"><XCircle size={18} /></button>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">New Password</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" autoFocus
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500" placeholder="Minimum 4 characters" />
            </div>
            {formError && <p className="text-xs font-bold text-red-400">{formError}</p>}
            <button onClick={handlePasswordReset}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
              Reset Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
