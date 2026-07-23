import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { User, Lock, LogIn, X, RefreshCcw } from 'lucide-react';
import { useEmployee } from '../context/EmployeeContext';

const EmployeeLoginModal = ({ isOpen, onClose, title, role, outletName, onLogin }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { login } = useEmployee();

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEmail(''); setPassword(''); setError('');
    setLoading(true);
    const params = { isActive: 'true' };
    if (role) params.role = role;
    if (outletName) params.outletName = outletName;
    api.get('/api/employees/by-role', { params })
      .then(res => setEmployees(res.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, [isOpen, role, outletName]);

  const handleLogin = async () => {
    if (!selectedEmail) { setError('Select an employee'); return; }
    if (!password) { setError('Enter password'); return; }
    setVerifying(true); setError('');
    try {
      const res = await api.post('/api/employees/verify', { email: selectedEmail, password });
      const emp = res.data;
      login(emp);
      if (onLogin) onLogin(emp);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    }
    setVerifying(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center"><LogIn size={16} className="text-purple-400" /></div>
            <div>
              <h2 className="text-sm font-black text-white">{title || 'Employee Login'}</h2>
              <p className="text-[10px] text-gray-500 font-bold">Select employee and enter password</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="text-center py-4"><RefreshCcw size={16} className="text-purple-400 animate-spin mx-auto" /></div>
        ) : employees.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-xs font-bold">No employees found for this module. Create employees in Admin Panel first.</div>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Employee</label>
              <select value={selectedEmail} onChange={e => setSelectedEmail(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors">
                <option value="">Select employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.email || e.name}>{e.name}{e.subRole ? ` (${e.subRole})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter password" />
              </div>
            </div>
            {error && <p className="text-xs font-bold text-red-400">{error}</p>}
            <button onClick={handleLogin} disabled={verifying}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
              {verifying ? <RefreshCcw size={12} className="animate-spin" /> : <LogIn size={12} />}
              {verifying ? 'Verifying...' : 'Login'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeLoginModal;
