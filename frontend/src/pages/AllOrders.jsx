import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Package, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  Download,
  RefreshCcw,
  Truck
} from 'lucide-react';
import { motion } from 'framer-motion';

const AllOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_URL}/api/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
    setLoading(false);
  };

  const handleSendForDelivery = async (orderId) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/orders/${orderId}/send-for-delivery`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error sending for delivery:', error);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'READY_FOR_DELIVERY':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  const filteredOrders = orders.filter(order => 
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Production Orders</h1>
          <p className="text-gray-400 text-sm">Full list of active and pending orders</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchOrders}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="flex items-center space-x-2 bg-gray-800 border border-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by customer name or order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
        <button className="flex items-center space-x-2 bg-gray-800 border border-gray-700 px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors">
          <Filter size={18} />
          <span>Filters</span>
        </button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-xs uppercase border-b border-gray-700 bg-gray-900/50">
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Order Details</th>
                <th className="px-6 py-4">Current Stage</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                      Loading production orders...
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-20 text-center text-gray-500">
                    No orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                        #{order.orderNumber || order.id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        {order.customerName}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {order.type === 'custom' ? (
                          <span className="text-purple-400 flex items-center space-x-1">
                            <span>Custom Design</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">Standard Product</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.advancePaid ? 'Payment: Advance' : 'Payment: Pending'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="bg-gray-800 px-2 py-1 rounded-md text-[10px] font-bold text-gray-300 border border-gray-700 uppercase">
                          {order.currentStage.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.urgent ? (
                        <div className="flex items-center space-x-2 text-blue-400 text-xs font-bold">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>URGENT</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${getStatusStyle(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.status === 'READY_FOR_DELIVERY' ? (
                        <button 
                          onClick={() => handleSendForDelivery(order.id)}
                          className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ml-auto"
                        >
                          <Truck size={16} />
                          <span>Send for Delivery</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <MoreVertical size={18} />
                          </button>
                          <button className="p-2 hover:bg-blue-600 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllOrders;
