import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Loader2, Sparkles, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { t, LanguageToggle } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #fdf2f8 100%)' }}>
      <div className="absolute top-6 right-6 z-50">
        <LanguageToggle />
      </div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.06, 0.1, 0.06],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: 'radial-gradient(circle, #f43f5e 0%, transparent 70%)' }}
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.06, 0.1, 0.06],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #f43f5e, #06b6d4)' }}>
              <Sparkles className="text-white" size={28} />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-extrabold tracking-tight leading-none mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <span style={{ background: 'linear-gradient(135deg, #f43f5e, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Sameer Special</span>
          </h1>
          <div className="h-1 w-16 mx-auto rounded-full mb-3" style={{ background: 'linear-gradient(90deg, #f43f5e, #06b6d4)' }}></div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>Enamels Production Management</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border relative" style={{ borderColor: '#f1f5f9' }}
        >
          <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl" style={{ background: 'linear-gradient(90deg, #f43f5e, #06b6d4)' }}></div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl text-sm font-semibold mb-4 flex items-center space-x-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: '#ef4444' }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={16} style={{ color: '#94a3b8' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-3 pl-11 pr-4 text-sm font-medium rounded-xl border-2 outline-none transition-all"
                  style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                  placeholder="Enter your email"
                  onFocus={(e) => e.target.style.borderColor = '#f43f5e'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={16} style={{ color: '#94a3b8' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-3 pl-11 pr-12 text-sm font-medium rounded-xl border-2 outline-none transition-all"
                  style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                  placeholder="Enter your password"
                  onFocus={(e) => e.target.style.borderColor = '#f43f5e'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors focus:outline-none" style={{ color: '#94a3b8' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-3 overflow-hidden relative mt-2 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span className="font-semibold tracking-wide text-sm">Sign In</span>
                  <ShieldCheck size={16} />
                </>
              )}
            </button>
          </form>
        </motion.div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: '#94a3b8' }}>
            Enamels Production Management System
          </p>
          <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: '#cbd5e1' }}>
            Ctrl + F5 to refresh if updates don't show
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
