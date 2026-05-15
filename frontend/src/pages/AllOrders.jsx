import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  Package, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronRight,
  Download,
  RefreshCcw,
  Truck,
  X,
  Layers,
  ClipboardList,
  Trash2,
  Phone,
  Users,
  List,
  Grid
} from 'lucide-react';
import { motion } from 'framer-motion';
import socket from '../socket';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');

const AllOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isGroupedView, setIsGroupedView] = useState(false);
  const location = useLocation();

  useEffect(() => {
    fetchOrders();
    
    socket.on('orderUpdated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => socket.off('orderUpdated');
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    }
    setLoading(false);
  };

  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order permanently?')) return;
    try {
      await axios.delete(`${API_URL}/api/orders/${id}`);
      setOrders(prev => prev.filter(o => o.id !== id));
      toast.success('Order deleted');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = 
        o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerPhone?.includes(searchTerm);
      
      if (activeTab === 'all') return matchesSearch;
      return matchesSearch && o.status === activeTab;
    });
  }, [orders, searchTerm, activeTab]);

  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const phone = order.customerPhone || 'No Phone';
      if (!groups[phone]) {
        groups[phone] = {
          id: `group-${phone}`,
          customerPhone: phone,
          customerName: order.customerName,
          totalQuantity: 0,
          orderCount: 0,
          statusSummary: {},
          latestOrderDate: order.createdAt,
        };
      }
      const qty = parseInt(order.quantity) || 1;
      groups[phone].totalQuantity += qty;
      groups[phone].orderCount += 1;
      groups[phone].statusSummary[order.status] = (groups[phone].statusSummary[order.status] || 0) + 1;
      if (new Date(order.createdAt) > new Date(groups[phone].latestOrderDate)) {
        groups[phone].latestOrderDate = order.createdAt;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestOrderDate) - new Date(a.latestOrderDate));
  }, [filteredOrders]);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'COMPLETED': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'CANCELLED': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Production Queue</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Real-time Order Monitoring</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all w-full sm:w-64"
            />
          </div>
          
          <button
            onClick={() => setIsGroupedView(!isGroupedView)}
            className={`p-2 rounded-xl border transition-all ${isGroupedView ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}
            title={isGroupedView ? "Show Individual Orders" : "Group by Customer"}
          >
            {isGroupedView ? <List size={20} /> : <Users size={20} />}
          </button>
        </div>
      </div>

      <div className="glass rounded-[2rem] border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                {isGroupedView ? (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Orders</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Quantity</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status Breakdown</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Latest Order</th>
                    <th className="px-6 py-4 text-right"></th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Order Details</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Current Stage</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Priority</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-right"></th>
                  </>
                )}
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
              ) : isGroupedView ? (
                groupedOrders.map((group) => (
                  <tr 
                    key={group.id}
                    onClick={() => {
                      setSearchTerm(group.customerPhone);
                      setIsGroupedView(false);
                    }}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                        {group.customerName}
                      </div>
                      <div className="flex items-center space-x-2 text-gray-500 font-bold mt-1">
                        <Phone size={12} className="text-blue-500" />
                        <span className="text-xs">{group.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center bg-gray-800 w-10 h-10 rounded-full border border-gray-700 text-white font-black">
                        {group.orderCount}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center bg-blue-600/10 text-blue-400 px-4 py-2 rounded-xl border border-blue-500/20 font-black text-xl">
                        {group.totalQuantity}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(group.statusSummary).map(([status, count]) => (
                          <span key={status} className={`text-[9px] font-black px-2 py-1 rounded-lg border ${getStatusStyle(status)}`}>
                            {count} {status.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-gray-400 font-bold">
                        {new Date(group.latestOrderDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1 uppercase font-black tracking-widest">
                        {new Date(group.latestOrderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight size={18} className="text-gray-500 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : (
                filteredOrders.map((order) => {
                  const product = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                  
                  return (
                  <tr 
                    key={order.id} 
                    onClick={() => {
                      setSelectedOrder(order);
                      setShowModal(true);
                    }}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                        #{order.orderNumber || order.id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        {order.customerName}
                      </div>
                      {order.customerPhone && (
                        <div className="text-[10px] text-gray-600 font-bold mt-0.5">
                          {order.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-200">
                        {product?.productType || 'Standard Item'}
                        {order.quantity > 1 && <span className="ml-2 text-blue-400">x{order.quantity}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                          {product?.fabricType || 'STD FABRIC'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-xs font-black text-white uppercase tracking-widest">{order.currentStage}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                         order.priority === 'URGENT' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                         order.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                         'bg-blue-500/10 text-blue-400 border-blue-500/20'
                       }`}>
                         {order.priority}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(order.status)}`}>
                         {order.status.replace(/_/g, ' ')}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(user?.role === 'SUPER_ADMIN' || user?.role === 'FAISAL') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(order.id);
                              }}
                              className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                              title="Delete Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <ChevronRight size={18} className="text-gray-500" />
                        </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllOrders;
