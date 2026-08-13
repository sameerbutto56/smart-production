import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { UserCheck, Lock, Eye, EyeOff, LogOut, Loader2 } from 'lucide-react';

/**
 * Dynamic per-profile employee gate.
 *
 * When the logged-in user's role matches `role`, the gate loads the employees
 * assigned to `profile` (outlet-agnostic for non-outlet profiles) from Employee
 * Management data and requires the operator to select one and log in before the
 * profile content renders — the same workflow as the Faisal / Dispatch gates.
 *
 * It never locks the profile out:
 *  - if no employees are assigned to the profile, the gate passes through;
 *  - a "Continue as <label>" skip link bypasses the gate for shared accounts.
 *
 * Employee lists are always fetched live, so newly created / newly assigned
 * employees appear automatically and removed / unassigned ones disappear.
 */
const ProfileEmployeeGate = ({ role, profile, label, icon: Icon, onStateChange, logoutSignal, children }) => {
  const { user } = useAuth();

  const storageKey = `profileEmployee_${profile}`;

  const [employees, setEmployees] = useState(null);
  const [employee, setEmployee] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(`${storageKey}_in`) === '1');
  const [skipped, setSkipped] = useState(() => sessionStorage.getItem(`${storageKey}_skip`) === '1');
  const [loginLoading, setLoginLoading] = useState(false);

  const isTarget = user?.role === role;

  useEffect(() => {
    if (!isTarget) return;
    let mounted = true;
    api.get(`/api/outlet-orders/employees?profile=${profile}`)
      .then(res => {
        if (!mounted) return;
        const list = res.data?.employees || [];
        setEmployees(list);
        if (employee && !list.some(e => e.name === employee)) {
          setEmployee('');
          sessionStorage.removeItem(storageKey);
        }
      })
      .catch(() => { if (mounted) setEmployees([]); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTarget, profile]);

  // Header "Switch Employee" button bumps logoutSignal → reset the whole gate.
  useEffect(() => {
    if (!logoutSignal) return;
    setLoggedIn(false);
    setSkipped(false);
    setEmployee('');
    setPassword('');
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(`${storageKey}_in`);
    sessionStorage.removeItem(`${storageKey}_skip`);
  }, [logoutSignal, storageKey]);

  useEffect(() => {
    onStateChange?.({ role, loggedIn: isTarget && loggedIn, employee: isTarget ? employee : '' });
  }, [isTarget, loggedIn, employee, onStateChange, role]);

  const handleLogin = useCallback(async () => {
    if (!employee) { toast.error('Please select an employee'); return; }
    if (!password) { toast.error('Enter your password'); return; }
    setLoginLoading(true);
    try {
      const res = await api.post('/api/software-settings/verify-employee', { name: employee, password, profile });
      if (res.data?.ok) {
        setLoggedIn(true);
        setPassword('');
        sessionStorage.setItem(storageKey, employee);
        sessionStorage.setItem(`${storageKey}_in`, '1');
        sessionStorage.removeItem(`${storageKey}_skip`);
        toast.success(`Logged in as ${employee}`);
      } else {
        toast.error(res.data?.message || 'Login failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  }, [employee, password, profile, storageKey]);

  const handleSkip = useCallback(() => {
    setSkipped(true);
    sessionStorage.setItem(`${storageKey}_skip`, '1');
  }, [storageKey]);

  // Pass through for other roles, already-logged-in, skipped, or no employees.
  if (!isTarget) return children;
  if (loggedIn || skipped) return children;
  if (employees === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-500" size={22} />
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Loading {label} employees...</span>
        </div>
      </div>
    );
  }
  if (employees.length === 0) return children;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl p-8" style={{ background: 'var(--card-bg-solid)', border: '1px solid var(--glass-border)' }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              {Icon ? <Icon className="text-blue-400" size={32} /> : <UserCheck className="text-blue-400" size={32} />}
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">{label} Profile</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2">Employee Login</p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Select Employee</label>
              <select
                value={employee}
                onChange={(e) => { setEmployee(e.target.value); setPassword(''); }}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 text-white focus:border-blue-500 outline-none font-black appearance-none"
              >
                <option value="">— Select Employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-12 text-white focus:border-blue-500 outline-none font-black"
                  placeholder="Enter password..."
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              onClick={handleLogin}
              disabled={loginLoading || !employee || !password}
              className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loginLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <LogOut className="rotate-180" size={16} />
              )}
              Login as {employee || 'Employee'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-colors"
            >
              Continue as {label} (default) — Skip
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs font-bold text-gray-500 text-center">Secure {label} profile access</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileEmployeeGate;
