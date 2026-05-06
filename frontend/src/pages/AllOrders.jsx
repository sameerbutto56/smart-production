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
  Truck,
  X,
  Layers,
  ClipboardList
} from 'lucide-react';
import { motion } from 'framer-motion';
import socket from '../socket';
import toast from 'react-hot-toast';

const AllOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchOrders();

    socket.on('order-updated', fetchOrders);
    socket.on('new-order', () => {
      fetchOrders();
      toast('New order created', { icon: '📦' });
    });

    return () => {
      socket.off('order-updated');
      socket.off('new-order');
    };
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
                <th className="px-6 py-4 text-right"></th>
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
                filteredOrders.map((order) => {
                  const product = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;
                  const isWaitingApproval = order.stages?.some(s => s.status === 'WAITING_APPROVAL' && s.stageName === order.currentStage);
                  
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
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-200">
                        {product?.productType || 'Standard Item'}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-medium bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                          {product?.fabricType || 'STD FABRIC'}
                        </span>
                        {product?.color && (
                          <div className="flex items-center space-x-1 bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: product.color.toLowerCase().replace(' ', '') }}></div>
                            <span className="text-[10px] text-gray-500 font-medium uppercase">{product.color}</span>
                          </div>
                        )}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${product?.gender === 'Female' ? 'bg-pink-500/10 text-pink-500' : 'bg-blue-500/10 text-blue-400'}`}>
                          {product?.gender || 'MALE'}
                        </span>
                        {product?.femaleOptions?.dupatta && (
                          <span className="text-[9px] font-black bg-pink-600 text-white px-1.5 py-0.5 rounded uppercase">Dupatta</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">
                        {order.advancePaid ? 'Payment: Advance' : 'Payment: Pending'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`bg-gray-800 px-2 py-1 rounded-md text-[10px] font-black border border-gray-700 uppercase tracking-wider ${isWaitingApproval ? 'text-yellow-400 border-yellow-400/30' : 'text-gray-300'}`}>
                          {isWaitingApproval ? `WAITING: ${order.currentStage.replace(/_/g, ' ')}` : order.currentStage.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.urgent ? (
                        <div className="flex items-center space-x-2 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>URGENT</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase border ${getStatusStyle(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {order.status === 'READY_FOR_DELIVERY' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendForDelivery(order.id);
                          }}
                          className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ml-auto"
                        >
                          <Truck size={16} />
                          <span>Send for Delivery</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight size={18} className="text-gray-500" />
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- JOB SHEET MODAL --- */}
      {showModal && selectedOrder && (() => {
        const product = typeof selectedOrder.productDetails === 'string' ? JSON.parse(selectedOrder.productDetails) : selectedOrder.productDetails;
        const custom = typeof selectedOrder.customization === 'string' ? JSON.parse(selectedOrder.customization) : selectedOrder.customization;
        const sizes = typeof selectedOrder.sizeData === 'string' ? JSON.parse(selectedOrder.sizeData) : selectedOrder.sizeData;
        
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl"
              onClick={() => setShowModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <div className="flex items-center space-x-4 mb-2">
                    <h2 className="text-4xl font-black tracking-tighter text-white">#{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}</h2>
                    <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                      Full Production Job Sheet
                    </span>
                  </div>
                  <p className="text-gray-400 font-bold tracking-wide">{selectedOrder.customerName}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-4 hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar text-white">
                
                <section>
                  <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6">01. Material & Product Specs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { label: 'Product Base', val: product?.productType },
                      { label: 'Fabric Type', val: product?.fabricType },
                      { label: 'Primary Color', val: product?.color },
                      { label: 'Order Size', val: product?.size },
                      { label: 'Gender', val: product?.gender },
                      ...(product?.femaleOptions?.dupatta ? [{ label: 'Dupatta', val: 'Included' }] : []),
                      { label: 'Payment', val: selectedOrder.paymentStatus || (selectedOrder.advancePaid ? 'ADVANCE' : 'PENDING') }
                    ].filter(i => i.val).map((item, i) => (
                      <div key={i} className="bg-gray-950/50 p-6 rounded-3xl border border-gray-800/50">
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{item.label}</p>
                        <p className="text-lg font-bold text-gray-200">{item.val || 'STANDARD'}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-blue-600/5 p-8 rounded-[2rem] border border-blue-500/10">
                  <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">02. Precise Measurements (Inches)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(sizes || {}).map(([key, val], i) => (
                      <div key={i} className="text-center p-4 bg-gray-900 rounded-2xl border border-gray-800 shadow-sm">
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-tighter mb-1">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-xl font-black text-blue-400">{val}"</p>
                      </div>
                    ))}
                    {product?.gender === 'Female' && product?.femaleOptions?.sleeves && (
                      <div className="text-center p-4 bg-gray-900 rounded-2xl border border-pink-500/20 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter mb-1">SLEEVES</p>
                        <p className="text-sm font-black text-white uppercase">{product.femaleOptions.sleeves}</p>
                      </div>
                    )}
                    {product?.gender === 'Female' && product?.femaleOptions?.shirtLength && (
                      <div className="text-center p-4 bg-gray-900 rounded-2xl border border-pink-500/20 shadow-sm flex flex-col justify-center">
                        <p className="text-[9px] text-pink-500 font-black uppercase tracking-tighter mb-1">SHIRT LENGTH</p>
                        <p className="text-sm font-black text-white uppercase">{product.femaleOptions.shirtLength}</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-6">03. Branding & Tailoring</h4>
                    <div className="space-y-4">
                      {[
                        { l: 'Branding Name', v: custom?.nameSpelling },
                        { l: 'Embroidery Color', v: custom?.nameColor },
                        { l: 'Logo Location', v: custom?.logoPlacement },
                        { l: 'Fit Type', v: custom?.fitType },
                        { l: 'Stitching Style', v: custom?.stitchingStyle }
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-gray-950/30 rounded-2xl border border-gray-800/30">
                          <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{item.l}</span>
                          <span className="text-sm font-black text-emerald-400">{item.v || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-[0.3em] mb-6">04. Design Notes</h4>
                    <div className="h-full min-h-[150px] bg-yellow-500/5 p-8 rounded-3xl border border-yellow-500/10 italic text-gray-300 leading-relaxed text-sm shadow-inner">
                      {custom?.designNotes || 'No special design notes provided.'}
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-8 bg-gray-950/80 border-t border-gray-800 flex justify-between items-center">
                <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                  <span>Created: {new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                  <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
                  <span>Stage: {selectedOrder.currentStage}</span>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close Job Sheet
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
};

export default AllOrders;
