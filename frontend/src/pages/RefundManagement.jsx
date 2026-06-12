import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, RefreshCw, Search, RotateCcw, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const RefundManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = sessionStorage.getItem('token');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRefundQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/orders/refund-queue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data || []);
    } catch {
      toast.error('Failed to load refund queue');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRefundQueue();
    socket.on('order-updated', fetchRefundQueue);
    return () => { socket.off('order-updated', fetchRefundQueue); };
  }, [fetchRefundQueue]);

  const processRefund = async (orderId, action) => {
    try {
      const note = action === 'PROCESSING' ? prompt('Refund processing notes:') || 'Processing' : '';
      await axios.post(`${API_URL}/api/orders/${orderId}/process-refund`, { action, note }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Refund ${action === 'PROCESSING' ? 'marked as PROCESSING' : 'marked as REFUNDED'}`);
      fetchRefundQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const filtered = orders.filter(o =>
    !search ||
    o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.customerPhone?.includes(search)
  );

  const statusColor = (status) => {
    switch (status) {
      case 'REQUESTED': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'PROCESSING': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'REFUNDED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'theme-text-muted bg-gray-800 border-gray-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-32 px-3 md:px-6 space-y-6">
      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black theme-text-primary leading-none">Refund Management</h1>
            <p className="text-[9px] md:text-[10px] theme-text-muted font-bold mt-0.5">{orders.length} refund requests</p>
          </div>
        </div>
        <button onClick={fetchRefundQueue} className="w-11 h-11 flex items-center justify-center theme-bg border theme-border rounded-2xl theme-text-secondary hover:text-white active:scale-90 transition-all">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, order, or phone..."
          className="w-full theme-input rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
        />
      </div>

      {loading ? (
        <PageLoader text="Loading refund queue..." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-24 gap-4 text-center">
          <RotateCcw size={40} className="theme-text-muted" />
          <p className="theme-text-muted font-black text-lg">No refund requests</p>
          <p className="text-gray-700 text-sm max-w-[220px]">All refunds processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((order) => (
            <div key={order.id} className="glass rounded-[1.8rem] border theme-border overflow-hidden transition-all hover:border-orange-500/30">
              <div className={`h-1.5 w-full ${
                order.refundStatus === 'REFUNDED' ? 'bg-emerald-500' :
                order.refundStatus === 'PROCESSING' ? 'bg-blue-500' : 'bg-orange-500'
              }`} />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black theme-text-primary text-lg leading-tight">{order.customerName}</p>
                    <p className="text-[9px] text-blue-400 font-black mt-0.5">
                      ORDER #{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black border uppercase ${statusColor(order.refundStatus)}`}>
                    {order.refundStatus}
                  </span>
                </div>

                {order.customerPhone && (
                  <p className="text-sm theme-text-secondary font-bold">📞 {order.customerPhone}</p>
                )}

                {order.refundReason && (
                  <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                    <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Reason</p>
                    <p className="text-sm font-bold theme-text-primary">{order.refundReason}</p>
                  </div>
                )}

                {order.refundNote && (
                  <div className="bg-gray-800/50 rounded-xl px-3 py-2">
                    <p className="text-[9px] theme-text-muted font-black uppercase tracking-widest">Note</p>
                    <p className="text-sm font-bold theme-text-primary">{order.refundNote}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <p className="text-lg font-black text-emerald-400">₨{Number(order.totalPrice || 0).toLocaleString()}</p>
                  <p className="text-[9px] theme-text-muted font-bold">
                    {order.refundedAt ? new Date(order.refundedAt).toLocaleDateString() : '—'}
                  </p>
                </div>

                {order.refundStatus !== 'REFUNDED' && (
                  <div className="flex gap-2 pt-1">
                    {order.refundStatus === 'REQUESTED' && (
                      <button
                        onClick={() => processRefund(order.id, 'PROCESSING')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                      >
                        <RotateCcw size={14} />
                        Start Processing
                      </button>
                    )}
                    {order.refundStatus === 'PROCESSING' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Confirm refund completed for this order?')) processRefund(order.id, 'REFUNDED');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                      >
                        <CheckCircle size={14} />
                        Mark Refunded
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RefundManagement;
