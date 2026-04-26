'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Mail, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const login = useAuthStore(state => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      await api.post('/orders/seed');
      alert('Database seeded! Use admin@enamels.com / pass123');
    } catch (err) {
      alert('Seeding failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-tighter italic">SMART PROD</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">Order Tracking & Production System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-blue-500 transition-all"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-blue-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-bold text-center uppercase tracking-widest">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Enter Station'}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-800">
          <button 
            onClick={handleSeed}
            className="w-full text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-[0.3em] transition-all"
          >
            First time? Initialize Database
          </button>
        </div>
      </motion.div>
    </div>
  );
}
