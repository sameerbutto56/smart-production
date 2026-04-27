import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Activity,
  Layers,
  Zap,
  CheckCircle2,
  LogOut
} from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL);

const ProgressChart = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pipeline = ['STORE', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'PRESSING', 'PACKAGING', 'DISPATCH'];

  useEffect(() => {
    fetchData();
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    
    socket.on('order-updated', fetchData);
    socket.on('new-order', fetchData);

    return () => {
      clearInterval(clock);
      socket.off('order-updated');
      socket.off('new-order');
    };
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      const data = response.data;
      setOrders(data);

      const stageStats = {};
      pipeline.forEach(stage => {
        stageStats[stage] = data.filter(o => o.currentStage === stage && o.status !== 'COMPLETED').length;
      });
      setStats(stageStats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const urgentOrders = orders.filter(o => {
    if (o.status === 'COMPLETED' || o.status === 'OUT_FOR_DELIVERY') return false;
    const deadline = new Date(o.stages?.[0]?.deadlineAt).getTime();
    const diff = deadline - Date.now();
    return diff < 7200000; // Increased to 2 hours for big screen visibility
  }).sort((a, b) => new Date(a.stages?.[0]?.deadlineAt) - new Date(b.stages?.[0]?.deadlineAt));

  return (
    <div className="min-h-screen lg:h-screen bg-black text-white p-4 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.3)]">
            <Zap size={24} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic leading-none">ENAMELS COMMAND</h1>
            <div className="flex items-center gap-2 text-blue-500 font-bold tracking-widest text-[8px] mt-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
              REAL-TIME PRODUCTION FEED
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="text-right hidden sm:block">
            <div className="text-4xl font-black tracking-tighter font-mono leading-none">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mt-1">
              {currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-500 transition-colors flex items-center justify-center"
            title="Logout"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Floor Status - Left Sidebar */}
        <div className="lg:col-span-2 glass-dark p-6 rounded-[2rem] border border-white/5 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="text-blue-500" size={20} />
            <h2 className="text-sm font-black uppercase tracking-wider">Floor Load</h2>
          </div>
          
          <div className="space-y-4 flex-1 overflow-hidden">
            {pipeline.map((stage) => (
              <div key={stage}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">{stage.replace('_', ' ')}</span>
                  <span className="text-lg font-black">{stats[stage] || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(((stats[stage] || 0) / 10) * 100, 100)}%` }}
                    className={`h-full bg-blue-600`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
            <p className="text-[8px] text-blue-400 font-black uppercase mb-1">Shift Efficiency</p>
            <p className="text-2xl font-black italic tracking-tighter">98.2%</p>
          </div>
        </div>

        {/* Live Stream - Center */}
        <div className="lg:col-span-7 flex flex-col gap-6 overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="glass-dark p-6 rounded-[2rem] border border-white/5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="text-indigo-500" size={20} />
              <h2 className="text-sm font-black uppercase tracking-wider">Active Batch Stream</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-hidden">
              {orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'OUT_FOR_DELIVERY').slice(0, 6).map((order) => (
                <div key={order.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col justify-between h-32">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[7px] font-black text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase">
                        {order.currentStage.replace('_', ' ')}
                      </span>
                      {order.urgent && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />}
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

          {/* Quick Metrics - Bottom Center */}
          <div className="h-32 grid grid-cols-3 gap-4">
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Ready to Ship</p>
              <p className="text-3xl font-black text-emerald-500">{orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length}</p>
            </div>
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-[8px] text-gray-500 font-black uppercase mb-1">In Production</p>
              <p className="text-3xl font-black text-blue-500">{orders.filter(o => o.status !== 'COMPLETED').length}</p>
            </div>
            <div className="glass-dark p-4 rounded-[2rem] border border-white/5 flex flex-col justify-center items-center">
              <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Active Staff</p>
              <p className="text-3xl font-black text-indigo-500">12</p>
            </div>
          </div>
        </div>

        {/* Alerts & Personnel - Right Sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="glass-dark p-6 rounded-[2rem] border border-red-500/20 bg-red-500/5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <AlertCircle size={20} />
              <h2 className="text-sm font-black uppercase tracking-wider">Critical Deadlines</h2>
            </div>
            
            <div className="space-y-3 flex-1 overflow-hidden">
              {urgentOrders.slice(0, 5).map(order => (
                <div key={order.id} className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 flex justify-between items-center">
                  <div className="overflow-hidden">
                    <div className="text-[9px] font-black text-white truncate">{order.customerName}</div>
                    <div className="text-[7px] text-red-400 font-bold">{order.currentStage.replace('_', ' ')}</div>
                  </div>
                  <div className="text-xs font-black font-mono text-red-500 flex items-center gap-1">
                    <Clock size={10} />
                    {Math.max(0, Math.floor((new Date(order.stages?.[0]?.deadlineAt).getTime() - Date.now()) / 60000))}m
                  </div>
                </div>
              ))}
              {urgentOrders.length === 0 && (
                <div className="h-full flex items-center justify-center text-[10px] text-gray-700 font-black uppercase italic">
                  All Systems nominal
                </div>
              )}
            </div>
          </div>

          <div className="h-32 glass-dark p-6 rounded-[2rem] border border-white/5 flex items-center justify-center">
             <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-4 border-black bg-blue-600 flex items-center justify-center text-[8px] font-black">
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
