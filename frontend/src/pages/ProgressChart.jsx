import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { debounce } from '../utils/debounce';
import { 
  Clock, 
  AlertCircle, 
  Activity,
  Layers,
  Zap,
  LogOut,
  Printer
} from 'lucide-react';
import socket from '../socket';
import { useLanguage } from '../context/LanguageContext';
import { useSystemPause } from '../context/SystemPauseContext';
import { PageLoader } from '../components/LoadingSpinner';
import useCache from '../hooks/useCache';
import api from '../services/api';
import { formatTimeOnly, formatDateOnly } from '../utils/dateTime';
import { computeActiveWorkingMs } from '../utils/delayUtils';

const ProgressChart = () => {
  const { t, LanguageToggle } = useLanguage();
  const [currentTime, setCurrentTime] = useState(new Date());
  const { periods: pausePeriods, myProfile: pauseProfile } = useSystemPause();

  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pipeline = useMemo(() => ['STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'], []);

  // Cache-first: orders + analytics (combined)
  const { data: progressData, loading: progressLoading, refresh } = useCache('progress:all', {
    fetcher: async () => {
      const [ordersRes, analyticsRes] = await Promise.all([
        api.get('/api/orders'),
        api.get('/api/orders/analytics')
      ]);
      return { orders: ordersRes.data, analytics: analyticsRes.data };
    },
    ttl: 30 * 1000,
  });
  const orders = progressData?.orders ?? [];
  const analytics = progressData?.analytics ?? null;

  const stageStats = useMemo(() => {
    const s = {};
    pipeline.forEach(stage => {
      s[stage] = orders.filter(o => o.currentStage === stage && o.status !== 'COMPLETED').length;
    });
    return s;
  }, [orders, pipeline]);

  // Socket re-fetch
  useEffect(() => {
    const debouncedRefresh = debounce(refresh, 300);
    socket.on('order-updated', debouncedRefresh);
    socket.on('new-order', debouncedRefresh);
    return () => {
      socket.off('order-updated', debouncedRefresh);
      socket.off('new-order', debouncedRefresh);
    };
  }, [refresh]);

  // Clock
  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const urgentOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter(o => {
      if (o.status === 'COMPLETED' || o.status === 'OUT_FOR_DELIVERY') return false;
      const deadline = new Date(o.stages?.[0]?.deadlineAt).getTime();
      if (!deadline) return false;
      const remaining = computeActiveWorkingMs(now, deadline, pausePeriods, pauseProfile);
      return remaining < 7200000; // 2 hours working time remaining
    }).sort((a, b) => new Date(a.stages?.[0]?.deadlineAt) - new Date(b.stages?.[0]?.deadlineAt));
  }, [orders, pausePeriods, pauseProfile]);

  if (progressLoading) return <PageLoader text="Loading Production Chart..." />;

  return (
    <div className="min-h-screen lg:h-screen bg-black text-white p-4 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)]">
            <Zap size={20} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black tracking-tighter uppercase italic leading-none">{t('Production Chart')}</h1>
            <div className="flex items-center gap-2 text-blue-500 font-bold tracking-widest text-xs mt-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
              {t('LIVE FEED')}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8 no-print">
          <LanguageToggle />
          <div className="text-right hidden sm:block">
            <div className="text-2xl md:text-4xl font-black tracking-tighter font-mono leading-none">
              {formatTimeOnly(currentTime, true)}
            </div>
            <div className="text-gray-500 font-bold uppercase tracking-widest text-xs md:text-sm mt-1">
              {formatDateOnly(currentTime)}
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="p-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 rounded-xl text-emerald-500 hover:text-emerald-400 transition-colors flex items-center justify-center"
            title="Print Chart"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={() => window.history.length > 1 ? window.history.back() : window.location.href = '/'}
            className="p-3 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center justify-center font-bold text-sm space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-500 transition-colors flex items-center justify-center"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-6 flex-1 min-h-0">
        
        <div className="lg:col-span-2 glass-dark p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-white/5 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="text-blue-500" size={16} />
            <h2 className="text-sm font-black uppercase tracking-wider">Floor Load</h2>
          </div>
          
          <div className="space-y-4 flex-1 overflow-hidden">
            {pipeline.map((stage) => (
              <div key={stage}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-black text-gray-500 uppercase tracking-tighter">{stage.replace('_', ' ')}</span>
                  <span className="text-lg font-black">{stageStats[stage] || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(((stageStats[stage] || 0) / 10) * 100, 100)}%` }}
                    className={`h-full bg-blue-600`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
            <p className="text-xs text-yellow-500 font-black uppercase mb-1">Avg Lead Time</p>
            <p className="text-2xl font-black italic tracking-tighter text-white">
              {analytics?.stagePerformance ? (Object.values(analytics.stagePerformance).reduce((acc, curr) => acc + parseFloat(curr.avgHours), 0) / Object.keys(analytics.stagePerformance).length).toFixed(1) : '0.0'}h
            </p>
          </div>
        </div>

          <div className="lg:col-span-7 flex flex-col gap-3 md:gap-6 overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="glass-dark p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-white/5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-indigo-500" size={16} />
              <h2 className="text-sm font-black uppercase tracking-wider">Active Batch Stream</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden">
              {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'OUT_FOR_DELIVERY').slice(0, 6).map((order) => (
                <div key={order.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col justify-between h-32">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase">
                        {order.currentStage.replace('_', ' ')}
                      </span>
                      {order.priority === 'SUPER_URGENT' && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />}
                      {order.priority === 'URGENT' && <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_#d97706]" />}
                    </div>
                    <h3 className="text-lg font-black truncate uppercase leading-tight">{order.customerName}</h3>
                  </div>
                  <div className="h-1 bg-gray-900 rounded-full mt-2">
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `${(pipeline.indexOf(order.currentStage) + 1) / pipeline.length * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-32 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-xs text-gray-500 font-black uppercase mb-1">Ready to Ship</p>
              <p className="text-xl md:text-3xl font-black text-emerald-500">{orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length}</p>
            </div>
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-xs text-gray-500 font-black uppercase mb-1">In Production</p>
              <p className="text-xl md:text-3xl font-black text-blue-500">{orders.filter(o => o.status !== 'COMPLETED').length}</p>
            </div>
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-xs text-gray-500 font-black uppercase mb-1">Active Staff</p>
              <p className="text-xl md:text-3xl font-black text-indigo-500">12</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-3 md:gap-6 overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="glass-dark p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-red-500/20 bg-red-500/5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertCircle size={16} />
              <h2 className="text-sm font-black uppercase tracking-wider">Critical Deadlines</h2>
            </div>
            
            <div className="space-y-3 flex-1 overflow-hidden">
              {urgentOrders.slice(0, 5).map(order => (
                <div key={order.id} className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 flex justify-between items-center">
                  <div className="overflow-hidden">
                    <div className="text-xs md:text-sm font-black text-white truncate">{order.customerName}</div>
                    <div className="text-[9px] text-red-400 font-bold">{order.currentStage.replace('_', ' ')}</div>
                  </div>
                  <div className="text-xs font-black font-mono text-red-500 flex items-center gap-1">
                    <Clock size={10} />
                    {(() => {
                      const deadline = new Date(order.stages?.[0]?.deadlineAt).getTime();
                      const remaining = computeActiveWorkingMs(Date.now(), deadline, pausePeriods, pauseProfile);
                      return `${Math.max(0, Math.floor(remaining / 60000))}m`;
                    })()}
                  </div>
                </div>
              ))}
              {urgentOrders.length === 0 && (
                <div className="h-full flex items-center justify-center text-xs text-gray-700 font-black uppercase italic">
                  All Systems nominal
                </div>
              )}
            </div>
          </div>

          <div className="h-32 glass-dark p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-white/5 flex items-center justify-center">
             <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-4 border-black bg-blue-600 flex items-center justify-center text-xs font-black">
                  EMP
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProgressChart;
