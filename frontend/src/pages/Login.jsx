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
    <div className="h-screen flex items-center justify-center bg-[#030712] px-4 relative overflow-hidden">
      <div className="absolute top-6 right-6 z-50">
        <LanguageToggle />
      </div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600 rounded-full blur-[150px]"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.15, 0.1],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600 rounded-full blur-[150px]"
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-4">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-2xl shadow-blue-900/40 rotate-6"
          >
            <Sparkles className="text-white" size={24} />
          </motion.div>
          
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic leading-none mb-1">
            SMART<br/>
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">PRODUCTION</span>
          </h1>
          <div className="h-0.5 w-12 bg-gradient-to-r from-blue-600 to-emerald-600 mx-auto rounded-full mb-2"></div>
          <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.4em]">Enterprise Workflow Intelligence</p>
        </div>

        <div className="glass p-6 md:p-8 rounded-[1.5rem] border border-gray-800 shadow-2xl backdrop-blur-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-[9px] font-bold mb-4 flex items-center space-x-3"
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-3">Authorized Identity</label>
              <div className="relative group/input">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within/input:text-blue-500 transition-colors" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3.5 pl-14 pr-6 focus:outline-none focus:border-blue-500 transition-all text-white font-bold placeholder-gray-700 text-xs"
                  placeholder={t('email')}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest ml-3">Access Encryption</label>
              <div className="relative group/input">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within/input:text-blue-500 transition-colors" size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-950/50 border-2 border-gray-800 rounded-xl py-3.5 pl-14 pr-12 focus:outline-none focus:border-blue-500 transition-all text-white font-bold placeholder-gray-700 text-xs"
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black py-3.5 rounded-xl shadow-2xl shadow-blue-900/40 transition-all active:scale-95 flex items-center justify-center space-x-3 group/btn overflow-hidden relative mt-2"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000"></div>
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span className="uppercase tracking-[0.2em] text-[10px]">{t('Login')}</span>
                  <ShieldCheck size={16} className="group-hover/btn:rotate-12 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center space-y-2">
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-[0.4em]">
            Build v1.0.5-OUTLET (READY)
          </p>
          <p className="text-[7px] text-gray-700 font-bold uppercase tracking-widest">
            If updates don't show, press Ctrl + F5
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
