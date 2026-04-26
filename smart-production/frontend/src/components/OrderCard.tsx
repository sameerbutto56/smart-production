'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Tag,
  Clock,
  Layers,
  Truck
} from 'lucide-react';
import CountdownTimer from './CountdownTimer';
import { cn } from '@/lib/utils';
import { useOrderStore } from '@/store/useOrderStore';
import { useAuthStore } from '@/store/useAuthStore';

interface Props {
  order: any;
}

export default function OrderCard({ order }: Props) {
  const { user } = useAuthStore();
  const updateStage = useOrderStore(state => state.updateOrderStage);
  
  const currentStage = order.stages.find((s: any) => s.stageName === order.currentStage);
  const isUrgent = order.urgent;

  const handleAction = async (extraData: any = {}) => {
    try {
      await updateStage(order.id, { 
        employeeId: user.id,
        ...extraData 
      });
    } catch (err) {
      alert('Failed to update stage');
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "bg-slate-900 border-l-[6px] p-6 rounded-2xl shadow-xl flex flex-col gap-6",
        isUrgent ? "border-blue-600 ring-1 ring-blue-600/20" : "border-slate-700"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-white tabular-nums tracking-tighter">#{order.shopifyId || order.id.substring(0, 8)}</h3>
            {isUrgent && (
              <span className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-blue-900/40">
                <AlertCircle size={10} /> Urgent Priority
              </span>
            )}
            <span className="px-3 py-1 bg-slate-800 text-slate-400 text-[9px] font-bold uppercase tracking-widest rounded-full">
              {order.type}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <User size={12} /> {order.customerName}
          </div>
        </div>

        {currentStage?.deadlineAt && (
          <CountdownTimer deadline={currentStage.deadlineAt} className="bg-slate-950 px-4 py-2 rounded-xl" />
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg">
          <Layers size={14} className="text-slate-700" /> Current: <span className="text-white">{order.currentStage.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg">
          <Clock size={14} className="text-slate-700" /> Started: <span className="text-slate-300">{new Date(currentStage?.startedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {order.customization && (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs">
          <p className="text-slate-500 font-bold uppercase tracking-tighter mb-2 flex items-center gap-2">
            <Tag size={12} /> Customization Details
          </p>
          <p className="text-slate-300 leading-relaxed italic">"{JSON.stringify(order.customization)}"</p>
        </div>
      )}

      {/* Action Area */}
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          Stage Progress: {order.stages.length} / 8
        </div>

        <div className="flex gap-2">
          {order.currentStage === 'STORE' && (
            <>
              <button 
                onClick={() => handleAction({ stockAvailable: true })}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-green-900/20"
              >
                In Stock (Skip)
              </button>
              <button 
                onClick={() => handleAction({ stockAvailable: false })}
                className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-white/10"
              >
                Out of Stock
              </button>
            </>
          )}

          {order.currentStage !== 'STORE' && order.currentStage !== 'DELIVERED' && (
            <button 
              onClick={() => handleAction()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 group shadow-lg shadow-blue-900/20"
            >
              Complete & Approve <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
