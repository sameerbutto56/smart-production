import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  History as HistoryIcon, 
  Search, 
  CheckCircle2, 
  Clock, 
  FileText,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

const History = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/api/orders`);
      // In a real app, you'd filter for COMPLETED/CANCELLED or fetch from a dedicated endpoint
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-900/20">
          <HistoryIcon className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Production History</h1>
          <p className="text-gray-400 text-sm">Review past orders and performance logs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="glass p-20 text-center rounded-3xl text-gray-500">
            No history logs available yet.
          </div>
        ) : (
          orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between hover:border-indigo-500/50 transition-all group"
            >
              <div className="flex items-start space-x-4 mb-4 md:mb-0">
                <div className={`p-3 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-800 text-gray-400'}`}>
                  {order.status === 'COMPLETED' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                </div>
                <div>
                  <h3 className="font-black text-2xl tracking-tighter text-white group-hover:text-indigo-400 transition-colors">#{order.orderNumber || order.id.substring(0, 8)}</h3>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400 font-bold">
                    <span>{order.customerName}</span>
                    <span className="flex items-center text-xs text-gray-500 font-normal">
                      <Calendar size={12} className="mr-1" />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-gray-900/50 border border-gray-700 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 uppercase">
                  {order.type}
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  order.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {order.status}
                </div>
                <button className="p-2 bg-indigo-600/10 text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-xs font-bold px-4">
                  View Audit Log
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default History;
