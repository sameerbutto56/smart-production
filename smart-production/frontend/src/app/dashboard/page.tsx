'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useOrderStore } from '@/store/useOrderStore';
import { useAuthStore } from '@/store/useAuthStore';
import OrderCard from '@/components/OrderCard';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function DashboardOverview() {
  const { orders, fetchOrders, isLoading } = useOrderStore();
  const { user, checkAuth } = useAuthStore();
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    checkAuth();
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [checkAuth, fetchOrders]);

  const stats = [
    { label: 'Active Pipeline', value: orders.filter(o => o.status === 'IN_PROGRESS').length, icon: Activity, color: 'text-blue-500' },
    { label: 'Urgent Tasks', value: orders.filter(o => o.urgent).length, icon: AlertTriangle, color: 'text-orange-500' },
    { label: 'Today Completed', value: orders.filter(o => o.status === 'COMPLETED').length, icon: CheckCircle, color: 'text-green-500' },
    { label: 'System Efficiency', value: '94%', icon: TrendingUp, color: 'text-purple-500' },
  ];

  // Filtering logic based on role
  const roleStageMap: Record<string, string> = {
    'STORE_EMPLOYEE': 'STORE',
    'CUTTING_EMPLOYEE': 'CUTTING',
    'STITCHING_EMPLOYEE': 'STITCHING',
    'QUALITY_CHECK_EMPLOYEE': 'QUALITY_CHECK',
    'PRESSING_EMPLOYEE': 'PRESSING',
    'PACKAGING_EMPLOYEE': 'PACKAGING',
  };

  const userStage = roleStageMap[user?.role];
  const filteredOrders = user?.role === 'ADMIN' || user?.role === 'MAIN_EMPLOYEE'
    ? orders 
    : orders.filter(o => o.currentStage === userStage);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">Station Overview</h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px] mt-2">Real-time Production Monitoring</p>
          </div>
          
          {(user?.role === 'ADMIN' || user?.role === 'MAIN_EMPLOYEE') && (
            <button className="bg-white text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-all text-xs uppercase tracking-widest">
              <Plus size={16} /> New Production Order
            </button>
          )}
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-slate-900/50 border border-slate-900 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <stat.icon size={20} className={stat.color} />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Global</span>
              </div>
              <p className="text-3xl font-black text-white tabular-nums">{stat.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Order Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Current Workflow</h3>
            <div className="flex gap-2 p-1 bg-slate-900 rounded-lg">
              {['ALL', 'URGENT', 'DELAYED'].map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                    filter === f ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode='popLayout'>
              {filteredOrders.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="py-20 text-center bg-slate-900/20 border-2 border-dashed border-slate-900 rounded-3xl"
                >
                  <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No orders active in this station</p>
                </motion.div>
              ) : (
                filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
