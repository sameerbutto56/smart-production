import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Settings, 
  Trash2, 
  RefreshCcw,
  Zap,
  Timer,
  FileText,
  Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import socket from '../socket';
import { useLanguage } from '../context/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');

const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [durations, setDurations] = useState({});
  const [isUpdatingDurations, setIsUpdatingDurations] = useState(false);
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const navigate = useNavigate();
  
  const combinedManufacturingStats = useMemo(() => {
    if (!analytics?.stagePerformance) return null;
    const stages = ['CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING'];
    let totalHours = 0;
    let maxCount = 0;
    stages.forEach(s => {
      if (analytics.stagePerformance[s]) {
        totalHours += parseFloat(analytics.stagePerformance[s].avgHours) || 0;
        maxCount = Math.max(maxCount, analytics.stagePerformance[s].count);
      }
    });
    return totalHours > 0 ? { avgHours: totalHours.toFixed(1), count: maxCount } : null;
  }, [analytics]);

  useEffect(() => {
    fetchData();
    fetchDurations();
    socket.on('order-updated', fetchData);
    socket.on('inventory-updated', fetchData);

    return () => {
      socket.off('order-updated');
      socket.off('inventory-updated');
    };
  }, []);

  const fetchDurations = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.data.STAGE_DURATIONS) {
        setDurations(response.data.STAGE_DURATIONS);
      } else {
        // Fallback to defaults if not set in DB
        setDurations({
          'STORE': 2,
          'CUTTING': 24,
          'STITCHING': 96,
          'QA': 2,
          'PRESSING_PACKING': 2,
          'LOGO_DESIGN': 2,
          'DISPATCH': 2,
          'FAISAL_APPROVAL': 2
        });
      }
    } catch (error) {
      console.error('Error fetching durations:', error);
    }
  };

  const handleUpdateDurations = async () => {
    setIsUpdatingDurations(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/settings`, {
        key: 'STAGE_DURATIONS',
        value: durations
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Production deadlines updated successfully!');
    } catch (error) {
      alert('Failed to update deadlines.');
    } finally {
      setIsUpdatingDurations(false);
    }
  };

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const [analyticsRes, inventoryRes] = await Promise.all([
        axios.get(`${API_URL}/api/orders/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setAnalytics(analyticsRes.data);
      setInventory(inventoryRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      title: "Today's Revenue", 
      value: analytics?.todayRevenue ? `$${analytics.todayRevenue.toFixed(2)}` : '$0.00', 
      icon: TrendingUp, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-400/10',
      path: '/orders',
      state: { filterStatus: 'COMPLETED' }
    },
    { 
      title: 'Total Orders', 
      value: analytics?.totalOrders || 0, 
      icon: FileText, 
      color: 'text-blue-400', 
      bg: 'bg-blue-400/10',
      path: '/orders'
    },
    { 
      title: 'Avg Lead Time', 
      value: analytics?.stagePerformance ? `${(Object.values(analytics.stagePerformance).reduce((acc, curr) => acc + parseFloat(curr.avgHours), 0) / Object.keys(analytics.stagePerformance).length).toFixed(1)}h` : '0.0h', 
      icon: Timer, 
      color: 'text-purple-400', 
      bg: 'bg-purple-400/10',
      path: '/progress'
    },
    { 
      title: 'Delayed Tasks', 
      value: '12', 
      icon: AlertTriangle, 
      color: 'text-red-400', 
      bg: 'bg-red-400/10',
      path: '/orders',
      state: { filterUrgent: true }
    },
    { 
      title: 'Floor Lead Time', 
      value: combinedManufacturingStats ? `${combinedManufacturingStats.avgHours}h` : '0h', 
      icon: Zap, 
      color: 'text-yellow-400', 
      bg: 'bg-yellow-400/10',
      path: '/progress'
    },
  ];

  return (
    <div className="space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-900/30">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">{t('Admin Portal')}</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">Global System Oversight</p>
          </div>
        </div>
        <LanguageToggle />
      </div>


      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => stat.path && navigate(stat.path, { state: stat.state })}
            className="glass p-8 rounded-[2.5rem] border border-gray-800 hover:border-blue-500/50 hover:scale-[1.02] transition-all group cursor-pointer active:scale-95"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                <stat.icon className={stat.color} size={24} />
              </div>
            </div>
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">{stat.title}</h3>
            <p className="text-3xl font-black text-white mt-2 tracking-tighter">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Stage Performance Analytics */}
        <div className="lg:col-span-2 glass rounded-[3rem] p-12 border border-gray-800">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Production Efficiency</h3>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Average hours per manufacturing stage</p>
            </div>
            <BarChart3 className="text-blue-500" size={32} />
          </div>

          <div className="space-y-8">
            {analytics?.stagePerformance ? Object.entries(analytics.stagePerformance).map(([stage, stats]) => (
              <div key={stage} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{stage.replace(/_/g, ' ')}</span>
                    <span className="text-xl font-black text-white">{stats.count} Orders Processed</span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-blue-400 tracking-tighter">{stats.avgHours}</span>
                    <span className="text-[10px] font-black text-gray-600 uppercase ml-1">Avg Hours</span>
                  </div>
                </div>
                <div className="h-4 bg-gray-900/50 rounded-full border border-gray-800 overflow-hidden p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (parseFloat(stats.avgHours) / 48) * 100)}%` }}
                    className={`h-full rounded-full ${parseFloat(stats.avgHours) > 24 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                  />
                </div>
              </div>
            )) : (
              <div className="py-20 text-center border-2 border-dashed border-gray-800 rounded-3xl text-gray-600">
                Awaiting production data for analysis...
              </div>
            )}
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="glass rounded-[3rem] p-12 border border-gray-800">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Stock Levels</h3>
            <Package className="text-purple-500" size={32} />
          </div>

          <div className="space-y-6">
            {inventory.slice(0, 8).map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
                <div className="flex flex-col flex-1 min-w-0 mr-4">
                  <span className="text-xs font-black text-white tracking-tight truncate">{item.name}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">{item.category}</span>
                </div>
                <div className="text-right flex-shrink-0 whitespace-nowrap">
                  <span className={`text-sm font-black ${item.stock < 10 ? 'text-red-500' : 'text-emerald-400'}`}>
                    {item.stock}
                  </span>
                  <span className="text-[9px] font-bold text-gray-600 ml-1 uppercase">Units</span>
                </div>
              </div>
            ))}
            {inventory.length > 8 && (
              <button className="w-full py-4 text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors">
                View Full Catalog (+{inventory.length - 8} more)
              </button>
            )}
          </div>
        </div>

        {/* --- ENHANCED DEADLINE CONFIGURATION --- */}
        <div className="lg:col-span-3">
          <div className="glass rounded-[3.5rem] p-12 border border-gray-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-6 relative z-10">
              <div className="flex items-center space-x-6">
                <div className="p-5 bg-gradient-to-tr from-yellow-500 to-amber-600 rounded-[2rem] shadow-xl shadow-yellow-900/20">
                  <Timer className="text-white" size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight uppercase">Production Deadlines</h3>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Configure time limits & track performance</p>
                </div>
              </div>
              
              <button 
                onClick={handleUpdateDurations}
                disabled={isUpdatingDurations}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-10 py-5 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center space-x-3 active:scale-95"
              >
                {isUpdatingDurations ? <RefreshCcw className="animate-spin" size={18} /> : <Zap size={18} />}
                <span>{isUpdatingDurations ? 'Syncing...' : 'Save All Deadlines'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 relative z-10">
              {/* Group 1: Setup & Intake */}
              <div className="space-y-8 p-8 bg-gray-950/40 rounded-[2.5rem] border border-gray-800/50">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-2 h-8 bg-blue-500 rounded-full" />
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Phase 1: Intake</h4>
                </div>
                {['STORE', 'FAISAL_APPROVAL'].map(stage => (
                  <DeadlineItem 
                    key={stage} 
                    stage={stage} 
                    val={durations[stage]} 
                    avg={analytics?.stagePerformance?.[stage]?.avgHours}
                    onChange={(v) => setDurations({...durations, [stage]: v})}
                  />
                ))}
              </div>

              {/* Group 2: Combined Manufacturing (The Request) */}
              <div className="space-y-8 p-8 bg-gray-950/60 rounded-[2.5rem] border-2 border-yellow-500/20 shadow-inner relative">
                <div className="absolute -top-4 left-12 px-6 py-1 bg-yellow-500 rounded-full text-[9px] font-black text-black uppercase tracking-widest shadow-lg">
                  Combined Production Cycle
                </div>
                <div className="flex items-center justify-between mb-4 pt-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-8 bg-yellow-500 rounded-full" />
                    <h4 className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.3em]">Phase 2: Manufacturing</h4>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quick Set Total Cycle Hours</label>
                  <div className="relative group/total">
                    <input
                      type="number"
                      placeholder="Bulk set total..."
                      onChange={(e) => {
                        const total = parseInt(e.target.value) || 0;
                        const share = Math.floor(total / 4);
                        setDurations({
                          ...durations,
                          'CUTTING': share,
                          'STITCHING': share,
                          'QA': share,
                          'PRESSING_PACKING': share + (total % 4) // Add remainder to last
                        });
                      }}
                      className="w-full bg-yellow-500/10 border-2 border-yellow-500/20 rounded-2xl py-4 px-6 outline-none focus:border-yellow-500 transition-all font-black text-yellow-500 text-lg pr-20"
                    />
                    <Zap className="absolute right-6 top-1/2 -translate-y-1/2 text-yellow-500" size={18} />
                  </div>
                  <p className="text-[9px] text-gray-600 italic px-2">Sets Cutting, Stitching, QC, and Pressing at once</p>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {['CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING'].map(stage => (
                    <DeadlineItem 
                      key={stage} 
                      stage={stage} 
                      val={durations[stage]} 
                      avg={analytics?.stagePerformance?.[stage]?.avgHours}
                      onChange={(v) => setDurations({...durations, [stage]: v})}
                    />
                  ))}
                  
                  <div className="mt-4 pt-6 border-t border-gray-800">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Combined Cycle</span>
                      <span className="text-xl font-black text-yellow-500 tracking-tighter">
                        {['CUTTING', 'STITCHING', 'QA', 'PRESSING_PACKING'].reduce((acc, s) => acc + (durations[s] || 0), 0)} Hours
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group 3: Finishing & Logistics */}
              <div className="space-y-8 p-8 bg-gray-950/40 rounded-[2.5rem] border border-gray-800/50">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-2 h-8 bg-purple-500 rounded-full" />
                  <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">Phase 3: Finishing</h4>
                </div>
                {['LOGO_DESIGN', 'DISPATCH'].map(stage => (
                  <DeadlineItem 
                    key={stage} 
                    stage={stage} 
                    val={durations[stage]} 
                    avg={analytics?.stagePerformance?.[stage]?.avgHours}
                    onChange={(v) => setDurations({...durations, [stage]: v})}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeadlineItem = ({ stage, val, avg, onChange }) => (
  <div className="group space-y-3">
    <div className="flex justify-between items-center px-1">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">{stage.replace(/_/g, ' ')}</label>
      {avg && (
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800">
          <Clock size={10} className="text-emerald-500" />
          <span className="text-[9px] font-bold text-gray-500 tracking-tighter">Avg: {avg}h</span>
        </div>
      )}
    </div>
    <div className="relative group/input">
      <input
        type="number"
        value={val || 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full bg-gray-950 border-2 border-gray-900 rounded-2xl py-4 px-6 outline-none focus:border-blue-500/50 transition-all font-black text-white text-lg pr-20 shadow-inner group-hover/input:border-gray-800"
      />
      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase tracking-widest">Hrs</span>
    </div>
  </div>
);

export default SuperAdminDashboard;
