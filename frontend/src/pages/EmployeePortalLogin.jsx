import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Users, Lock, Mail, ArrowRight, ShieldAlert, CheckCircle2, Building2 } from 'lucide-react';

export default function EmployeePortalLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [portalStatus, setPortalStatus] = useState(null); // true | false | null

  useEffect(() => {
    // Check if portal is enabled
    axios.get('/api/employee-portal/auth/status')
      .then(res => setPortalStatus(res.data?.enabled))
      .catch(() => setPortalStatus(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Please enter email/Employee ID and password');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/employee-portal/auth/login', {
        email: email.trim(),
        password
      });

      if (res.data?.success) {
        localStorage.setItem('employee_portal_token', res.data.token);
        localStorage.setItem('employee_portal_user', JSON.stringify(res.data.employee));
        toast.success(`Welcome, ${res.data.employee.name}!`);
        navigate('/employee-portal/dashboard');
      }
    } catch (err) {
      if (err.response?.data?.portalDisabled) {
        setPortalStatus(false);
      }
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md">
        {/* Company Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400 mb-3 shadow-lg shadow-blue-500/10">
            <Users size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            Enamels Production
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mt-1">
            Employee Self-Service Portal
          </p>
        </div>

        {/* Portal Disabled Warning if OFF */}
        {portalStatus === false && (
          <div className="bg-rose-500/10 border-2 border-rose-500/40 rounded-2xl p-4 mb-6 flex items-start gap-3 text-xs text-rose-300">
            <ShieldAlert size={20} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-rose-200">Employee Portal is Currently Disabled</div>
              <p className="mt-1 text-slate-300 leading-relaxed">
                Employee Self-Service access has been turned OFF by administrator in Software Settings.
                Please contact your HR or administrator if you require access.
              </p>
            </div>
          </div>
        )}

        {/* Login Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-black text-white">Staff Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your assigned company email or Employee ID
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Company Email / Employee ID
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. employee@enamels.com or EMP-001"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="Enter your portal password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || portalStatus === false}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              Need help accessing your account? Please contact management or accounts office.
            </p>
            <div className="mt-3">
              <Link to="/login" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">
                ← Return to Staff & Management Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
