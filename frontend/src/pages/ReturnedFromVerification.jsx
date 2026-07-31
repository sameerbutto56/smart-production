import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Search, Clock, User, Phone, Package, MessageSquare, FileEdit, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';

const ReturnedFromVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchReturned = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/api/verification/returned?${params}`);
      setOrders(res.data.orders || []);
    } catch (err) { console.error('Error:', err); setOrders([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchReturned(); }, [fetchReturned]);

  const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

  const handleEditOrder = (order) => {
    // Navigate to OrderEntry with both ID and order number for reliable loading.
    // orderNumber may start with '#' (e.g. "#49821") which would split the URL
    // into a fragment and swallow fromVerification=true — so it must be encoded.
    navigate(`/order-entry?editOrderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber || '')}&fromVerification=true`);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 rounded-2xl"><ArrowLeft size={24} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Return from Verification</h1>
            <p className="text-sm text-gray-400">Orders returned from verification that need corrections</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order #, customer name..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-amber-500" />
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No orders returned from verification</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 rounded-xl border border-amber-500/30 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/20"><ArrowLeft size={16} className="text-amber-400" /></div>
                      <div>
                        <p className="text-sm font-black text-white">{order.orderNumber || 'No #'}</p>
                        <p className="text-xs text-gray-400">{order.customerName} • {order.customerPhone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-amber-400">{formatCurrency(order.totalPrice)}</p>
                      <p className="text-[10px] text-gray-500">Returned {formatDateTime(order.verificationReturnedAt)}</p>
                    </div>
                  </div>

                  {/* Verifier's Note */}
                  {order.verificationReturnNote && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-[10px] font-black text-amber-400 uppercase flex items-center gap-1 mb-1"><MessageSquare size={10} /> Changes Requested</p>
                      <p className="text-xs text-amber-300 whitespace-pre-wrap">{order.verificationReturnNote}</p>
                    </div>
                  )}

                  {/* Product summary */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.isArray(order.productDetails) && order.productDetails.slice(0, 3).map((item, i) => {
                      const pd = item.productDetails || item;
                      return (
                        <span key={i} className="text-[10px] bg-gray-700 text-gray-300 px-2 py-1 rounded-lg">
                          {pd.name || pd.productType || 'Product'} ×{item.quantity || 1}
                        </span>
                      );
                    })}
                    {Array.isArray(order.productDetails) && order.productDetails.length > 3 && (
                      <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-1 rounded-lg">+{order.productDetails.length - 3} more</span>
                    )}
                  </div>

                  {/* Edit button */}
                  <button onClick={() => handleEditOrder(order)}
                    className="mt-4 w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                    <FileEdit size={16} /> Edit Order & Resubmit
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnedFromVerification;
