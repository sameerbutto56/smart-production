import React, { useState, useEffect } from 'react';
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
  Package, 
  FileText, 
  RefreshCcw 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import socket from '../socket';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [durations, setDurations] = useState({});
  const [isUpdatingDurations, setIsUpdatingDurations] = useState(false);
  const [loading, setLoading] = useState(true);

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
      const token = localStorage.getItem('token');
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
          'NAME_LOGO': 2,
          'CUSTOM_LOGO': 2,
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
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
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
    { title: 'Total Revenue Est.', value: '$24,500', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { title: 'Total Orders', value: analytics?.totalOrders || 0, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { title: 'Inventory Value', value: `$${inventory.reduce((acc, item) => acc + (item.stock * (item.price || 0)), 0).toLocaleString()}`, icon: Package, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { title: 'Delayed Tasks', value: '12', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
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
            <h1 className="text-4xl font-black text-white tracking-tight">Super Admin Portal</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">Global System Oversight</p>
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
            className="glass p-8 rounded-[2.5rem] border border-gray-800 hover:border-gray-700 transition-all group"
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
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white tracking-tight truncate max-w-[120px]">{item.name}</span>
                  <span className="text-[9px] font-bold text-gray-500 uppercase">{item.category}</span>
                </div>
                <div className="text-right">
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

        {/* Deadline Configuration */}
        <div className="glass rounded-[3rem] p-12 border border-gray-800">
          <div className="flex items-center justify-between mb-12">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Deadline Config</h3>
            <Clock className="text-yellow-500" size={32} />
          </div>

          <div className="space-y-6">
            {Object.entries(durations).map(([stage, hrs]) => (
              <div key={stage} className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{stage.replace(/_/g, ' ')}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={hrs}
                    onChange={(e) => setDurations({...durations, [stage]: parseInt(e.target.value)})}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 px-4 focus:border-yellow-500 outline-none font-bold text-white text-sm"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">Hours</span>
                </div>
              </div>
            ))}
            <button 
              onClick={handleUpdateDurations}
              disabled={isUpdatingDurations}
              className="w-full mt-6 bg-yellow-600 hover:bg-yellow-500 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-yellow-900/20 text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {isUpdatingDurations ? 'Saving...' : 'Update Production Deadlines'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
