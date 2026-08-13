import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { PauseCircle, PlayCircle, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemPause } from '../context/SystemPauseContext';
import { motion, AnimatePresence } from 'framer-motion';

const CONTROL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS'];

// One central Pause/Resume control shown in the global top navigation bar.
// Only roles the backend authorizes to pause/resume see it; everyone else is
// covered by the app-wide status banner. The profile-level configuration of
// which profiles are affected stays in Software Settings -> System Pause Settings.
const SystemPauseControl = () => {
  const { user } = useAuth();
  const { paused: systemPaused, info: pauseInfo, pause, resume } = useSystemPause();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const role = String(user?.role || '').toUpperCase().trim();
  if (!CONTROL_ROLES.includes(role)) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    try {
      const res = systemPaused ? await resume(password) : await pause(password);
      if (!res) return;
      toast.success(res.message || (systemPaused ? 'System resumed.' : 'System paused.'));
      setOpen(false);
      setPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update system state');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setPassword(''); }}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-lg active:scale-95 ${
          systemPaused
            ? 'bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20'
            : 'bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 border border-emerald-500/20'
        }`}
        title={systemPaused ? 'Resume the system — all functions become active' : 'Pause the system temporarily — selected profiles stop'}
      >
        {systemPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
        <span className="hidden md:inline">{systemPaused ? '🔴 Resume System' : '🟢 Pause System'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-[2rem] border-2 border-gray-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-xl ${systemPaused ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                  {systemPaused ? <PlayCircle className="text-red-400" size={28} /> : <PauseCircle className="text-emerald-400" size={28} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">{systemPaused ? 'Resume System' : 'Pause System'}</h2>
                  <p className="text-gray-400 text-sm font-bold">{systemPaused ? 'Reactivate all functions for the selected profiles.' : 'Stop the selected profiles temporarily. No operations can run while paused.'}</p>
                </div>
              </div>

              {systemPaused && pauseInfo && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs text-red-300 font-black uppercase tracking-wider">
                    Paused by {pauseInfo.pausedBy} {pauseInfo.source ? `· ${pauseInfo.source}` : ''} · {pauseInfo.pausedAt ? new Date(pauseInfo.pausedAt).toLocaleString() : ''}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Confirm Password</label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3 pl-12 pr-4 focus:border-blue-500 outline-none font-black text-white"
                      placeholder="Enter your password"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 font-bold">Enter your password to {systemPaused ? 'resume' : 'pause'} the system.</p>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => { setOpen(false); setPassword(''); }}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={busy || !password}
                    className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                      systemPaused ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    } disabled:opacity-50`}>
                    {busy ? <Loader2 className="animate-spin" size={16} /> : systemPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                    <span>{busy ? 'Processing...' : systemPaused ? 'Resume System' : 'Pause System'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SystemPauseControl;
