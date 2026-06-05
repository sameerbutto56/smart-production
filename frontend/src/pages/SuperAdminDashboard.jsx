import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  BarChart3, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Zap,
  Timer,
  FileText,
  Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import { useLanguage } from '../context/LanguageContext';
import AdminSettings from './AdminSettings';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, LanguageToggle, isUrdu } = useLanguage();
  const navigate = useNavigate();
  
  const combinedManufacturingStats = useMemo(() => {
    if (!analytics?.stagePerformance) return null;
    const prod = analytics.stagePerformance['PRODUCTION'];
    return prod ? { avgHours: prod.avgHours, count: prod.count } : null;
  }, [analytics]);

  useEffect(() => {
    fetchData();
    socket.on('order-updated', fetchData);
    socket.on('inventory-updated', fetchData);

    return () => {
      socket.off('order-updated');
      socket.off('inventory-updated');
    };
  }, []);

  async function fetchData() {
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
      value: (analytics?.stagePerformance && Object.keys(analytics.stagePerformance).length > 0) 
        ? `${(Object.values(analytics.stagePerformance).reduce((acc, curr) => acc + parseFloat(curr.avgHours), 0) / Object.keys(analytics.stagePerformance).length).toFixed(1)}h` 
        : '0.0h', 
      icon: Timer, 
      color: 'text-purple-400', 
      bg: 'bg-purple-400/10',
      path: '/progress'
    },
    { 
      title: 'Delayed Tasks', 
      value: analytics?.delayedOrders || 0, 
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
            <h1 className="text-4xl font-black text-white tracking-tight">Admin Portal</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">Global System Oversight</p>
          </div>
        </div>
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

      </div>

      {/* Settings (Deadline Config, Themes, Performance) */}
      <AdminSettings />
    </div>
  );
};

export default SuperAdminDashboard;
