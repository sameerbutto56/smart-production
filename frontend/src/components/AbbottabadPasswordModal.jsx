import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const AbbottabadPasswordModal = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/abbottabad/auth/verify', { password });
      if (res.data?.success && res.data?.token) {
        sessionStorage.setItem('abbottabad_token', res.data.token);
        toast.success('Abbottabad dashboard unlocked');
        onSuccess(res.data.token);
      } else {
        setError(res.data?.message || 'Authentication failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid Abbottabad password. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass max-w-md w-full p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 border-teal-500/30 shadow-[0_25px_50px_rgba(0,0,0,0.5)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800/50 hover:bg-gray-700/50 transition-all"
        >
          <X size={18} />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Enter Abbottabad Password</h2>
            <p className="text-xs font-semibold text-gray-400">Sensitive Financial & Cost Control Access</p>
          </div>
        </div>

        <p className="text-xs text-gray-300 mb-6 bg-gray-900/60 p-3 rounded-xl border border-gray-800">
          This section contains confidential Abbottabad demand financials, cost prices, Bilty amounts, and financial limits. Authentication is required.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center space-x-2 text-red-400 text-xs font-bold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
              Abbottabad Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                autoFocus
                className="w-full px-4 py-3 bg-gray-900/80 border border-gray-700 focus:border-teal-500 rounded-xl text-white text-sm font-semibold placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 pr-12 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1 rounded-lg"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <ShieldCheck size={16} />
              <span>{loading ? 'Verifying...' : 'Unlock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AbbottabadPasswordModal;
