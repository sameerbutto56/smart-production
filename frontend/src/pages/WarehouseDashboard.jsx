import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Package, ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  RefreshCcw, Search, Clock, Truck, Building2, PlusCircle,
  Eye, ThumbsUp, ThumbsDown, FileText, BarChart3, MinusCircle,
  CheckCircle, AlertCircle, Download, TrendingUp, User, Gift, Send,
  Factory, Trash2, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import OrderCard from '../components/OrderCard';
import toast from 'react-hot-toast';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { usePolling } from '../hooks/usePolling';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const TABS = ['dashboard', 'tasks', 'requests', 'inventory', 'production', 'analytics', 'history', 'allocation'];
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

const WarehouseDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [approveQty, setApproveQty] = useState(0);
  const [personName, setPersonName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [allocationQty, setAllocationQty] = useState(1);
  const [allocationNotes, setAllocationNotes] = useState('');
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationRecords, setAllocationRecords] = useState([]);
  const [allocationStats, setAllocationStats] = useState([]);
  const [allocTotal, setAllocTotal] = useState(0);
  const [allocPage, setAllocPage] = useState(1);
  const [allocSearch, setAllocSearch] = useState('');
  const [allocLoading, setAllocLoading] = useState(false);
  const [productionInventory, setProductionInventory] = useState([]);
  const [unseenTasks, setUnseenTasks] = useState(null);
  const [productionTasks, setProductionTasks] = useState(null);
  const [tasksSubTab, setTasksSubTab] = useState('unseen');

  useEffect(() => {
    if (activeTab === 'allocation') {
      fetchAllocations();
      fetchAllocationStats();
    }
  }, [activeTab, allocPage]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const token = sessionStorage.getItem('token');
    try {
      if (activeTab === 'requests' || activeTab === 'dashboard') {
        const [reqRes, invRes] = await Promise.all([
          axios.get(`${API_URL}/api/stock-requests`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setRequests(reqRes.data);
        setInventory(invRes.data);
      } else if (activeTab === 'inventory' || activeTab === 'history') {
        const invRes = await axios.get(`${API_URL}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setInventory(invRes.data);
        const reqRes = await axios.get(`${API_URL}/api/stock-requests`, { headers: { Authorization: `Bearer ${token}` } });
        setRequests(reqRes.data);
      } else if (activeTab === 'production') {
        const invRes = await axios.get(`${API_URL}/api/production/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        setProductionInventory(invRes.data);
      } else if (activeTab === 'tasks') {
        const [unseenRes, prodRes] = await Promise.all([
          axios.get(`${API_URL}/api/orders/unseen-tasks`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/api/orders/production-returned`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setUnseenTasks(unseenRes.data);
        setProductionTasks(prodRes.data);
      }
    } catch (error) {
      if (!silent) {
        console.error('Error fetching data:', error);
        toast.error(`Failed: ${error.response?.data?.message || error.message || 'load data'}`);
      }
    }
    if (!silent) setLoading(false);
  };

  const fetchAllocations = async () => {
    setAllocLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const params = { page: allocPage, limit: 50 };
      if (allocSearch.trim()) params.personName = allocSearch.trim();
      const res = await axios.get(`${API_URL}/api/inventory/allocations`, { params, headers: { Authorization: `Bearer ${token}` } });
      setAllocationRecords(res.data.records);
      setAllocTotal(res.data.total);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
    setAllocLoading(false);
  };

  const fetchAllocationStats = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/inventory/allocations/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setAllocationStats(res.data);
    } catch (error) {
      console.error('Error fetching allocation stats:', error);
    }
  };

  const fetchUnseenTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/orders/unseen-tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnseenTasks(res.data);
    } catch (e) {
      console.error('Failed to fetch unseen tasks:', e);
    }
  };

  const fetchProductionTasks = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/orders/production-returned`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionTasks(res.data);
    } catch (e) {
      console.error('Failed to fetch production tasks:', e);
    }
  };

  const handleMarkSeen = async (orderId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/orders/${orderId}/mark-seen`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUnseenTasks();
      fetchProductionTasks();
    } catch (e) {
      console.error('Failed to mark order as seen:', e);
    }
  };

  const handleAllocate = async () => {
    if (!personName.trim() || !selectedProduct || !selectedColor || !selectedSize || allocationQty < 1) {
      toast.error('Please fill all required fields');
      return;
    }
    setAllocationLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(`${API_URL}/api/inventory/allocate`, {
        personName: personName.trim(),
        itemId: selectedProduct.id,
        color: selectedColor,
        size: selectedSize,
        quantity: allocationQty,
        notes: allocationNotes,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Product allocated successfully');
      setPersonName('');
      setSelectedProduct(null);
      setSelectedColor('');
      setSelectedSize('');
      setAllocationQty(1);
      setAllocationNotes('');
      fetchData(true);
      fetchAllocations();
      fetchAllocationStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error allocating product');
    }
    setAllocationLoading(false);
  };

  // Check tab visibility to avoid polling when user isn't looking
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const handler = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  usePolling(() => { if (pageVisible) fetchData(true); }, 60000);

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIALLY_APPROVED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'REJECTED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'COMPLETED': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getOutletColor = (outlet) => {
    const name = (outlet || '').toLowerCase();
    if (name.includes('johar')) return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' };
    if (name.includes('jail')) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
    if (name.includes('abbottabad')) return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' };
    return { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/stock-requests/${approveModal.id}/approve`,
        { approvedQty: approveQty },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Approved ${approveQty} units for ${approveModal.itemName}`);
      setApproveModal(null);
      setApproveQty(0);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error approving request');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/stock-requests/${rejectModal.id}/reject`,
        { notes: rejectNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Rejected ${rejectModal.itemName} request`);
      setRejectModal(null);
      setRejectNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error rejecting request');
    }
  };

  const handleComplete = async (id) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/stock-requests/${id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Request marked as completed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error completing request');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/stock-requests/export/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-requests-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Excel file downloaded');
    } catch (error) {
      toast.error('Error downloading Excel');
    }
  };

  // Analytics data
  const outletStats = requests.reduce((acc, r) => {
    if (!acc[r.outletName]) acc[r.outletName] = { name: r.outletName, requested: 0, approved: 0, pending: 0, count: 0, completed: 0, rejected: 0, received: 0 };
    acc[r.outletName].requested += r.quantity;
    acc[r.outletName].approved += r.approvedQty;
    acc[r.outletName].pending += (r.quantity - r.approvedQty);
    acc[r.outletName].count += 1;
    if (r.status === 'COMPLETED') { acc[r.outletName].completed += 1; acc[r.outletName].received += r.approvedQty; }
    if (r.status === 'REJECTED') acc[r.outletName].rejected += 1;
    return acc;
  }, {});
  const outletChartData = Object.values(outletStats);

  const statusData = [
    { name: 'Pending', value: requests.filter(r => r.status === 'PENDING').length },
    { name: 'Approved', value: requests.filter(r => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length },
    { name: 'Rejected', value: requests.filter(r => r.status === 'REJECTED').length },
    { name: 'Completed', value: requests.filter(r => r.status === 'COMPLETED').length },
  ].filter(d => d.value > 0);

  // Monthly trend
  const monthlyMap = {};
  requests.forEach(r => {
    const month = new Date(r.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
    if (!monthlyMap[month]) monthlyMap[month] = { name: month, requested: 0, approved: 0 };
    monthlyMap[month].requested += r.quantity;
    monthlyMap[month].approved += r.approvedQty;
  });
  const monthlyData = Object.values(monthlyMap).sort((a, b) => {
    const da = new Date(a.name + ' 2000'), db = new Date(b.name + ' 2000');
    return da - db;
  });

  const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const lowStockItems = inventory.filter(item => item.stock <= 10);
  const completedThisMonth = requests.filter(r =>
    r.status === 'COMPLETED' && new Date(r.updatedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  const filteredInventory = inventory.filter(item =>
    !searchTerm || item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-amber-600 rounded-2xl shadow-xl shadow-amber-900/20 -rotate-2">
            <Building2 className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Warehouse</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Store & Inventory Management</p>
          </div>
        </div>
        <button onClick={fetchData} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95 border border-gray-700">
          <RefreshCcw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${
              activeTab === tab ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'
            }`}
          >
                {tab === 'dashboard' && <><BarChart3 size={14} className="inline mr-2" />Dashboard</>}
                {tab === 'tasks' && <><ClipboardList size={14} className="inline mr-2" />Tasks</>}
                {tab === 'requests' && <><ShoppingCart size={14} className="inline mr-2" />Requests {pendingRequests.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs md:text-sm px-1.5 py-0.5 rounded-full">{pendingRequests.length}</span>}</>}
                {tab === 'inventory' && <><Package size={14} className="inline mr-2" />Inventory</>}
                {tab === 'production' && <><Factory size={14} className="inline mr-2" />Production Inventory</>}
                {tab === 'analytics' && <><TrendingUp size={14} className="inline mr-2" />Analytics</>}
                {tab === 'history' && <><Clock size={14} className="inline mr-2" />History</>}
                {tab === 'allocation' && <><Gift size={14} className="inline mr-2" />Allocation</>}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader text="Loading Warehouse Data..." />
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 md:space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-500/10 rounded-xl"><Package className="text-blue-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Total</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{totalStock}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Units in Stock</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-yellow-500/10 rounded-xl"><ShoppingCart className="text-yellow-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Pending</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{pendingRequests.length}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Outlet Requests</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-red-500/10 rounded-xl"><AlertTriangle className="text-red-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Low</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{lowStockItems.length}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Low Stock Items</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-emerald-500/10 rounded-xl"><CheckCircle2 className="text-emerald-400" size={20} /></div>
                      <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Month</span>
                    </div>
                    <p className="text-xl md:text-3xl font-black theme-text-primary">{completedThisMonth}</p>
                    <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Completed Requests</p>
                </motion.div>
              </div>

              {/* Low Stock Alert */}
              {lowStockItems.length > 0 && (
                <div className="glass p-4 md:p-6 rounded-2xl border-2 border-red-500/20">
                  <div className="flex items-center space-x-3 mb-6">
                    <AlertTriangle className="text-red-400" size={20} />
                    <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm">Low Stock Alert</h2>
                  </div>
                  <div className="space-y-3">
                    {lowStockItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                        <div>
                          <p className="font-bold theme-text-primary text-sm">{item.name}</p>
                          <p className="text-xs md:text-sm theme-text-muted font-bold uppercase">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-red-400">{item.stock}</p>
                          <p className="text-xs md:text-sm theme-text-muted font-bold uppercase">Remaining</p>
                        </div>
                      </div>
                    ))}
                    {lowStockItems.length > 5 && (
                      <p className="text-xs theme-text-muted font-bold text-center">+{lowStockItems.length - 5} more items low on stock</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Pending Requests */}
              {pendingRequests.length > 0 && (
                <div className="glass p-4 md:p-6 rounded-2xl border-2 border-yellow-500/20">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <ShoppingCart className="text-yellow-400" size={20} />
                      <h2 className="font-black theme-text-primary uppercase tracking-wider text-sm">Pending Requests</h2>
                    </div>
                    <button onClick={() => setActiveTab('requests')} className="text-xs md:text-sm font-black text-amber-500 hover:text-amber-400 uppercase tracking-wider">View All</button>
                  </div>
                  <div className="space-y-3">
                    {pendingRequests.slice(0, 5).map(req => {
                      const oc = getOutletColor(req.outletName);
                      return (
                        <div key={req.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-xl theme-border">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${oc.bg} ${oc.text}`}>
                              <Building2 size={16} />
                            </div>
                            <div>
                              <p className="font-bold theme-text-primary text-sm">{req.itemName}</p>
                              <p className="text-xs md:text-sm theme-text-muted font-bold">{req.outletName} • Qty: {req.quantity}</p>
                            </div>
                          </div>
                          <button onClick={() => { setSelectedRequest(req); setActiveTab('requests'); }}
                            className="p-2 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 transition-all">
                            <Eye size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-4 md:space-y-6">
              {/* Three-filter tabs */}
              <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
                <button onClick={() => setTasksSubTab('unseen')}
                  className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'unseen' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                >
                  <Eye size={14} />Unseen Tasks {unseenTasks?.unseen?.length > 0 && <span className="ml-1 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{unseenTasks.unseen.length}</span>}
                </button>
                <button onClick={() => setTasksSubTab('assigned')}
                  className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'assigned' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                >
                  <CheckCircle size={14} />Assigned/Accepted ({unseenTasks?.seen?.length || 0})
                </button>
                <button onClick={() => setTasksSubTab('production')}
                  className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${tasksSubTab === 'production' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                >
                  <RefreshCcw size={14} />Production Tasks {((productionTasks?.unseen?.length || 0) + (productionTasks?.seen?.length || 0)) > 0 && <span className="ml-1 bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{(productionTasks?.unseen?.length || 0) + (productionTasks?.seen?.length || 0)}</span>}
                </button>
              </div>

              {/* Unseen Tasks */}
              {tasksSubTab === 'unseen' && (
                <div className="space-y-6">
                  {unseenTasks === null ? (
                    <PageLoader text="Loading tasks..." />
                  ) : (
                    <>
                      <div>
                        <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          Unseen ({unseenTasks.unseen?.length || 0})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                          {(unseenTasks.unseen || []).length > 0 ? (
                            unseenTasks.unseen.map(order => (
                              <OrderCard key={order.id} order={order} userRole={user?.role} isUnseen={true} onMarkSeen={() => handleMarkSeen(order.id)} />
                            ))
                          ) : (
                            <div className="col-span-full text-center py-12 glass rounded-2xl theme-border">
                              <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                              <p className="theme-text-muted font-black text-xs uppercase tracking-widest">All caught up! No unseen tasks.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Assigned/Accepted Tasks */}
              {tasksSubTab === 'assigned' && (
                <div className="space-y-6">
                  {unseenTasks?.seen?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                      {unseenTasks.seen.map(order => (
                        <OrderCard key={order.id} order={order} userRole={user?.role} />
                      ))}
                    </div>
                  ) : (
                    <div className="col-span-full text-center py-12 glass rounded-2xl theme-border">
                      <CheckCircle size={48} className="mx-auto text-gray-600 mb-4" />
                      <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No assigned tasks yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Production Tasks */}
              {tasksSubTab === 'production' && (
                <div className="space-y-6">
                  {productionTasks === null ? (
                    <PageLoader text="Loading production tasks..." />
                  ) : (
                    <>
                      {productionTasks?.unseen?.length > 0 && (
                        <div>
                          <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                            New Production Returns ({productionTasks.unseen.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                            {productionTasks.unseen.map(order => (
                              <OrderCard key={order.id} order={order} userRole={user?.role} isUnseen={true} onMarkSeen={() => handleMarkSeen(order.id)} />
                            ))}
                          </div>
                        </div>
                      )}
                      {productionTasks?.seen?.length > 0 && (
                        <div>
                          <h3 className="font-black text-sm theme-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-400" />
                            Reviewed Production ({productionTasks.seen.length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
                            {productionTasks.seen.map(order => (
                              <OrderCard key={order.id} order={order} userRole={user?.role} />
                            ))}
                          </div>
                        </div>
                      )}
                      {(!productionTasks?.unseen?.length && !productionTasks?.seen?.length) && (
                        <div className="col-span-full text-center py-12 glass rounded-2xl theme-border">
                          <RefreshCcw size={48} className="mx-auto text-gray-600 mb-4" />
                          <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No production tasks yet.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Outlet Stock Requests</h2>
                <span className="text-xs font-bold theme-text-muted">{pendingRequests.length} pending</span>
              </div>

              {/* Filter */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                <input type="text" placeholder="Search by outlet, item, or status..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full theme-input rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:border-amber-500 transition-all font-medium theme-text-secondary"
                />
              </div>

              {/* Requests list grouped by status */}
              <div className="space-y-4">
                {['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'COMPLETED', 'REJECTED'].map(status => {
                  const filtered = requests.filter(r =>
                    r.status === status &&
                    (!searchTerm || r.outletName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     r.itemName?.toLowerCase().includes(searchTerm.toLowerCase()))
                  );
                  if (!filtered.length) return null;
                  return (
                    <div key={status}>
                      <h3 className="font-black text-xs uppercase tracking-widest theme-text-muted mb-3 ml-1">{status.replace('_', ' ')} ({filtered.length})</h3>
                      <div className="space-y-3">
                        {filtered.map(req => {
                          const oc = getOutletColor(req.outletName);
                          const sc = getStatusColor(req.status);
                          return (
                            <motion.div key={req.id} layout
                              className="glass p-5 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all cursor-pointer"
                              onClick={() => setSelectedRequest(selectedRequest?.id === req.id ? null : req)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className={`p-3 rounded-xl ${oc.bg} ${oc.text} ${oc.border} border`}>
                                    <Building2 size={16} />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <p className="font-black theme-text-primary">{req.itemName}</p>
                                      <span className={`px-2 py-0.5 rounded-full text-xs md:text-sm font-black uppercase border ${sc}`}>{req.status.replace('_', ' ')}</span>
                                    </div>
                                    <p className="text-xs font-bold theme-text-muted mt-0.5">
                                      {req.outletName} • Requested: {req.quantity} • Approved: {req.approvedQty}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {req.status === 'PENDING' && (
                                    <>
                                      <button onClick={(e) => { e.stopPropagation(); setApproveModal(req); setApproveQty(req.quantity); }}
                                        className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all"
                                        title="Approve">
                                        <ThumbsUp size={18} />
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); setRejectModal(req); setRejectNotes(''); }}
                                        className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                                        title="Reject">
                                        <ThumbsDown size={18} />
                                      </button>
                                    </>
                                  )}
                                  {['APPROVED', 'PARTIALLY_APPROVED'].includes(req.status) && (
                                    <button onClick={(e) => { e.stopPropagation(); handleComplete(req.id); }}
                                      className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl hover:bg-purple-500/20 transition-all"
                                      title="Complete">
                                      <CheckCircle size={18} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Expanded Details */}
                              {selectedRequest?.id === req.id && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                  className="mt-4 pt-4 border-t theme-border">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Requested</p>
                                      <p className="font-black theme-text-primary text-lg">{req.quantity}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Approved</p>
                                      <p className="font-black text-emerald-400 text-lg">{req.approvedQty}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Pending</p>
                                      <p className="font-black text-yellow-400 text-lg">{req.quantity - req.approvedQty}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Date</p>
                                      <p className="font-bold theme-text-secondary text-xs">{new Date(req.createdAt).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  {req.notes && (
                                    <div className="mt-3 p-3 bg-gray-800/30 rounded-xl">
                                      <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider mb-1">Notes</p>
                                      <p className="text-sm theme-text-secondary">{req.notes}</p>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Warehouse Stock</h2>
                <div className="flex items-center space-x-4">
                  <input type="text" placeholder="Search inventory..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="theme-input rounded-xl py-2 px-4 focus:outline-none focus:border-amber-500 transition-all text-xs font-medium theme-text-secondary w-48"
                  />
                  <a href="/inventory" className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 text-xs uppercase tracking-wider active:scale-95">
                    <PlusCircle size={16} />
                    <span>Manage Inventory</span>
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className={`glass p-5 rounded-2xl border-2 transition-all ${
                      item.stock <= 10 ? 'border-red-500/20 hover:border-red-500/40' : item.stock <= 50 ? 'border-yellow-500/20 hover:border-yellow-500/40' : 'theme-border hover:border-emerald-500/30'
                    }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-black theme-text-primary text-sm">{item.name}</h3>
                        <p className="text-xs md:text-sm font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs md:text-sm font-black uppercase border ${
                        item.stock <= 10 ? 'border-red-500/20 bg-red-500/5 text-red-500' :
                        item.stock <= 50 ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500' :
                        'border-emerald-500/20 bg-emerald-500/5 text-emerald-500'
                      }`}>
                        {item.stock <= 10 ? 'Low' : item.stock <= 50 ? 'Medium' : 'In Stock'}
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-black theme-text-primary">{item.stock}</p>
                      <span className="text-xs md:text-sm font-bold theme-text-muted uppercase">units</span>
                    </div>
                    {item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (
                      <div className="mt-3 pt-3 border-t theme-border space-y-1.5">
                        <div className="flex items-center justify-between text-xs theme-text-muted font-black uppercase tracking-wider pb-1">
                          <span>Variant</span>
                          <span>Stock</span>
                        </div>
                        {item.variants.filter(v => (v.stock || 0) > 0).map((v, vi) => (
                          <div key={vi} className="flex items-center justify-between text-xs md:text-sm">
                            <span className="theme-text-secondary font-bold">{v.color || ''} {v.size || ''}</span>
                            <span className="theme-text-primary font-black">{v.stock || 0} <span className="theme-text-muted font-bold">units</span></span>
                          </div>
                        ))}
                      </div>
                    ) : (item.color || item.size || item.fabric ? (
                      <p className="text-xs md:text-sm theme-text-muted font-bold mt-2">
                        {[item.color, item.size, item.fabric].filter(Boolean).join(' • ')}
                      </p>
                    ) : null)}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Production Inventory Tab */}
          {activeTab === 'production' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Production Inventory</h2>
                <span className="text-xs font-bold theme-text-muted">Finished products from Production</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {productionInventory.length === 0 ? (
                  <div className="col-span-full text-center py-16">
                    <Factory size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No production inventory items yet</p>
                  </div>
                ) : (
                  productionInventory.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass p-5 rounded-2xl border-2 theme-border hover:border-amber-500/30 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-amber-500/10 rounded-xl">
                            <Factory size={18} className="text-amber-400" />
                          </div>
                          <div>
                            <h3 className="font-black theme-text-primary text-sm">{item.productName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black uppercase border border-blue-500/20 bg-blue-500/5 text-blue-400">
                              {item.source}
                            </span>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full text-xs md:text-sm font-black uppercase border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                          {item.quantity} units
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t theme-border text-center">
                        <div>
                          <p className="text-xs font-black theme-text-muted uppercase">Cost</p>
                          <p className="font-bold text-xs theme-text-primary">₨{item.productionCost?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black theme-text-muted uppercase">Value</p>
                          <p className="font-bold text-xs text-emerald-400">₨{item.sellingValue?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black theme-text-muted uppercase">Margin</p>
                          <p className={`font-bold text-xs ${item.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.profitMargin?.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-xs font-bold theme-text-muted mt-3">
                        {new Date(item.productionDate).toLocaleDateString()}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-4 md:space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Outlet Analytics</h2>
                <button onClick={handleDownloadExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-6 rounded-2xl transition-all flex items-center space-x-3 active:scale-95">
                  <Download size={16} />
                  <span>Download Excel</span>
                </button>
              </div>

              {outletChartData.length === 0 ? (
                <div className="text-center py-16">
                  <BarChart3 size={48} className="mx-auto text-gray-700 mb-4" />
                  <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No data yet</p>
                </div>
              ) : (
                <>
                  {/* Per-Outlet Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                    {outletChartData.map(outlet => {
                      const perf = outlet.approved > 0 ? Math.round((outlet.approved / outlet.requested) * 100) : 0;
                      return (
                        <motion.div key={outlet.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                          className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 bg-blue-500/10 rounded-xl"><Building2 className="text-blue-400" size={16} /></div>
                            <h3 className="font-black theme-text-primary">{outlet.name}</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Requests</p>
                              <p className="text-xl font-black theme-text-primary">{outlet.count}</p>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Approval Rate</p>
                              <p className="text-xl font-black text-emerald-400">{perf}%</p>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Requested</p>
                              <p className="text-xl font-black text-yellow-400">{outlet.requested}</p>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-wider">Approved</p>
                              <p className="text-xl font-black text-emerald-400">{outlet.approved}</p>
                            </div>
                          </div>
                          {outlet.completed > 0 && (
                            <div className="mt-3 pt-3 border-t theme-border flex justify-between text-xs md:text-sm font-bold">
                              <span className="text-purple-400">{outlet.completed} Requests Completed</span>
                              <span className="text-emerald-400">{outlet.received} Products Received</span>
                              {outlet.rejected > 0 && <span className="text-red-400">{outlet.rejected} Rejected</span>}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Bar Chart: Stock Distribution (CSS) */}
                  <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                    <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-8 flex items-center space-x-3">
                      <BarChart3 size={16} className="text-blue-400" />
                      <span>Stock Distribution by Outlet</span>
                    </h3>
                    {(() => {
                      const maxRequested = Math.max(...outletChartData.map(d => d.requested), 1);
                      return (
                        <div className="space-y-4 md:space-y-6">
                          {outletChartData.map(outlet => (
                            <div key={outlet.name}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold theme-text-secondary uppercase tracking-wider">{outlet.name}</span>
                                <div className="flex space-x-4 text-xs md:text-sm font-bold">
                                  <span className="text-blue-400">Req: {outlet.requested}</span>
                                  <span className="text-emerald-400">App: {outlet.approved}</span>
                                </div>
                              </div>
                              <div className="relative h-8 bg-gray-900 rounded-xl overflow-hidden">
                                <div className="absolute inset-0 flex">
                                  <div className="h-full bg-blue-500/40 transition-all" style={{ width: `${(outlet.requested / maxRequested) * 100}%` }} />
                                  <div className="h-full bg-emerald-500/60 transition-all" style={{ width: `${(outlet.approved / maxRequested) * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-center space-x-3 md:space-x-6 text-xs md:text-sm font-bold">
                            <span className="flex items-center space-x-2"><span className="w-3 h-3 rounded bg-blue-500/40" /><span>Requested</span></span>
                            <span className="flex items-center space-x-2"><span className="w-3 h-3 rounded bg-emerald-500/60" /><span>Approved</span></span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Donut + Monthly Trend */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                    {/* Status Donut (CSS SVG) */}
                    <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                      <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        <span>Request Status Overview</span>
                      </h3>
                      {statusData.length > 0 ? (
                        <div className="flex flex-col items-center">
                          <svg width="220" height="220" viewBox="0 0 220 220">
                            {(() => {
                              const total = statusData.reduce((s, d) => s + d.value, 0);
                              let cumulative = 0;
                              const r = 80, cx = 110, cy = 110;
                              return statusData.map((d, i) => {
                                const pct = d.value / total;
                                const angle = pct * 360;
                                const startAngle = (cumulative / total) * 360;
                                cumulative += d.value;
                                const startRad = ((startAngle - 90) * Math.PI) / 180;
                                const endRad = ((startAngle + angle - 90) * Math.PI) / 180;
                                const x1 = cx + r * Math.cos(startRad);
                                const y1 = cy + r * Math.sin(startRad);
                                const x2 = cx + r * Math.cos(endRad);
                                const y2 = cy + r * Math.sin(endRad);
                                const largeArc = angle > 180 ? 1 : 0;
                                if (angle <= 0) return null;
                                return (
                                  <path key={d.name}
                                    d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                    fill={COLORS[i % COLORS.length]} opacity="0.85"
                                  />
                                );
                              });
                            })()}
                            <circle cx="110" cy="110" r="50" fill="#030712" />
                            <text x="110" y="105" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="900">
                              {statusData.reduce((s, d) => s + d.value, 0)}
                            </text>
                            <text x="110" y="125" textAnchor="middle" fill="#6b7280" fontSize="10" fontWeight="bold" textTransform="uppercase">Total</text>
                          </svg>
                          <div className="flex flex-wrap justify-center gap-4 mt-4">
                            {statusData.map((d, i) => (
                              <span key={d.name} className="flex items-center space-x-2 text-xs md:text-sm font-bold">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="theme-text-secondary">{d.name}</span>
                                <span className="theme-text-primary">{d.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="theme-text-muted text-center py-10 font-bold text-xs uppercase tracking-widest">No data</p>
                      )}
                    </div>

                    {/* Monthly Trend (CSS) */}
                    {monthlyData.length > 0 && (
                      <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                        <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                          <TrendingUp size={18} className="text-purple-400" />
                          <span>Monthly Trend</span>
                        </h3>
                        {(() => {
                          const maxVal = Math.max(...monthlyData.flatMap(d => [d.requested, d.approved]), 1);
                          return (
                            <div className="space-y-4">
                              {monthlyData.map(month => (
                                <div key={month.name}>
                                  <div className="flex justify-between text-xs md:text-sm font-bold mb-1">
                                    <span className="theme-text-secondary">{month.name}</span>
                                    <span className="text-blue-400">{month.requested}</span>
                                  </div>
                                  <div className="relative h-6 bg-gray-900 rounded-lg overflow-hidden">
                                    <div className="h-full bg-blue-500/40 transition-all" style={{ width: `${(month.requested / maxVal) * 100}%` }} />
                                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                                      <span className="text-xs font-black text-emerald-300">{month.approved}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className="flex justify-center space-x-3 md:space-x-6 text-xs md:text-sm font-bold pt-2">
                                <span className="flex items-center space-x-2"><span className="w-3 h-3 rounded bg-blue-500/40" /><span>Requested</span></span>
                                <span className="flex items-center space-x-2"><span className="w-3 h-3 rounded bg-emerald-500/60" /><span>Approved</span></span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Request History</h2>
                <button onClick={handleDownloadExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 active:scale-95 text-xs uppercase tracking-wider">
                  <Download size={16} />
                  <span>Download Excel</span>
                </button>
              </div>
              <div className="space-y-3">
                {requests.filter(r => r.status !== 'PENDING').map(req => {
                  const oc = getOutletColor(req.outletName);
                  const sc = getStatusColor(req.status);
                  return (
                    <motion.div key={req.id} layout
                      className="glass p-4 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2.5 rounded-xl ${oc.bg} ${oc.text}`}><Building2 size={18} /></div>
                        <div>
                          <p className="font-bold theme-text-primary text-sm">{req.itemName}</p>
                          <p className="text-xs md:text-sm theme-text-muted font-bold">{req.outletName}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 md:space-x-6">
                        <div className="text-right">
                          <p className="text-xs font-bold theme-text-secondary">Requested: {req.quantity}</p>
                          <p className="text-xs font-bold text-emerald-400">Approved: {req.approvedQty}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs md:text-sm font-black uppercase border ${sc}`}>
                          {req.status.replace('_', ' ')}
                        </span>
                        <p className="text-xs md:text-sm theme-text-muted font-bold w-16 text-right">{new Date(req.createdAt).toLocaleDateString()}</p>
                      </div>
                    </motion.div>
                  );
                })}
                {requests.filter(r => r.status !== 'PENDING').length === 0 && (
                  <div className="text-center py-16">
                    <Clock size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No request history yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Allocation Tab */}
          {activeTab === 'allocation' && (
            <div className="space-y-4 md:space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Allocate Products</h2>
                <span className="text-xs font-bold theme-text-muted">Assign inventory to workers</span>
              </div>

              {/* Allocation Form */}
              <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 border-gray-900">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div>
                      <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Person Name *</label>
                    <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Enter person's name"
                      className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2" />
                  </div>
                  <div>
                      <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Product *</label>
                    <select value={selectedProduct?.id || ''} onChange={(e) => {
                      const prod = inventory.find(i => i.id === e.target.value);
                      setSelectedProduct(prod || null);
                      setSelectedColor('');
                      setSelectedSize('');
                    }}
                      className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2">
                      <option value="">Select Product</option>
                      {inventory.filter(i => i.stock > 0).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.stock} units)</option>
                      ))}
                    </select>
                  </div>
                  {selectedProduct && (() => {
                    const variants = selectedProduct.variants || [];
                    if (!variants.length) {
                      return (<>
                        <div>
                          <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Color</label>
                          <input type="text" value={selectedProduct.color || ''} disabled
                            className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 font-medium theme-text-muted mt-2" />
                        </div>
                        <div>
                          <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Size</label>
                          <input type="text" value={selectedProduct.size || ''} disabled
                            className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 font-medium theme-text-muted mt-2" />
                        </div>
                      </>);
                    }
                    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
                    const uniqueSizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
                    const availableSizes = selectedColor
                      ? [...new Set(variants.filter(v => v.color === selectedColor).map(v => v.size).filter(Boolean))]
                      : uniqueSizes;
                    return (<>
                      <div>
                        <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Color *</label>
                        <select value={selectedColor} onChange={(e) => { setSelectedColor(e.target.value); setSelectedSize(''); }}
                          className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2">
                          <option value="">Select Color</option>
                          {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Size *</label>
                        <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}
                          className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2">
                          <option value="">Select Size</option>
                          {availableSizes.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </>);
                  })()}
                  <div>
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Quantity *</label>
                    <input type="number" min="1" value={allocationQty}
                      onChange={(e) => {
                        const max = (() => {
                          if (!selectedProduct) return 1;
                          const vs = selectedProduct.variants || [];
                          if (vs.length && selectedColor && selectedSize) {
                            const v = vs.find(x => x.color === selectedColor && x.size === selectedSize);
                            if (v) return v.stock;
                          }
                          if (!vs.length) return selectedProduct.stock || 1;
                          return 1;
                        })();
                        setAllocationQty(Math.min(parseInt(e.target.value) || 1, max));
                      }}
                      className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-black text-lg text-white mt-2" />
                    {selectedProduct && (() => {
                      const vs = selectedProduct.variants || [];
                      if (vs.length && selectedColor && selectedSize) {
                        const v = vs.find(x => x.color === selectedColor && x.size === selectedSize);
                        if (v) return <p className="text-xs md:text-sm theme-text-muted font-bold mt-1">Available: {v.stock}</p>;
                      }
                      if (!vs.length) return <p className="text-xs md:text-sm theme-text-muted font-bold mt-1">Available: {selectedProduct.stock}</p>;
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Notes</label>
                    <textarea value={allocationNotes} onChange={(e) => setAllocationNotes(e.target.value)}
                      className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-medium text-white mt-2 min-h-[80px]"
                      placeholder="Optional notes about this allocation..." />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={handleAllocate}
                    disabled={allocationLoading || !personName.trim() || !selectedProduct || !selectedColor || !selectedSize || allocationQty < 1}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3.5 px-8 rounded-2xl transition-all flex items-center space-x-3 active:scale-95">
                    {allocationLoading ? <RefreshCcw className="animate-spin" size={16} /> : <Send size={16} />}
                    <span>{allocationLoading ? 'Allocating...' : 'Allocate Product'}</span>
                  </button>
                </div>
              </div>

              {/* Person Stats */}
              {allocationStats.length > 0 && (
              <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                    <User size={18} className="text-amber-400" />
                    <span>Allocation Summary by Person</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                          <tr className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                          <th className="pb-3 pr-4">Person</th>
                          <th className="pb-3 pr-4">Times Taken</th>
                          <th className="pb-3 pr-4">Total Items</th>
                          <th className="pb-3">Last Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocationStats.map(stat => (
                          <tr key={stat.personName} className="border-b border-gray-800/50 text-sm">
                            <td className="py-3 pr-4 font-bold theme-text-primary">{stat.personName}</td>
                            <td className="py-3 pr-4"><span className="font-black text-amber-400">{stat.timesTaken}x</span></td>
                            <td className="py-3 pr-4"><span className="font-black text-emerald-400">{stat.totalItems}</span></td>
                            <td className="py-3 text-xs theme-text-secondary">{new Date(stat.lastTaken).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Allocation History */}
              <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm flex items-center space-x-3">
                    <Clock size={18} className="text-blue-400" />
                    <span>Allocation History</span>
                  </h3>
                  <div className="flex items-center space-x-3">
                    <input type="text" placeholder="Search by person name..." value={allocSearch}
                      onChange={(e) => setAllocSearch(e.target.value)}
                      className="theme-input rounded-xl py-2 px-4 focus:border-amber-500 outline-none text-xs font-medium theme-text-secondary w-48"
                    />
                    <button onClick={() => { setAllocPage(1); fetchAllocations(); }}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2 px-4 rounded-xl transition-all text-xs active:scale-95 border border-gray-700">
                      <Search size={14} className="inline" />
                    </button>
                  </div>
                </div>
                {allocLoading ? (
                  <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
                ) : allocationRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No allocation records yet</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                        <tr className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest border-b theme-border">
                            <th className="pb-3 pr-4">Person</th>
                            <th className="pb-3 pr-4">Item</th>
                            <th className="pb-3 pr-4">Variant</th>
                            <th className="pb-3 pr-4">Qty</th>
                            <th className="pb-3 pr-4">Notes</th>
                            <th className="pb-3">Date & Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocationRecords.map(rec => (
                            <tr key={rec.id} className="border-b border-gray-800/50 text-sm hover:bg-gray-900/30">
                              <td className="py-3 pr-4 font-bold theme-text-primary">{rec.personName}</td>
                              <td className="py-3 pr-4 theme-text-secondary">{rec.itemName}</td>
                              <td className="py-3 pr-4 theme-text-secondary text-xs">{[rec.color, rec.size].filter(Boolean).join(' / ') || '-'}</td>
                              <td className="py-3 pr-4"><span className="font-black text-amber-400">{rec.quantity}</span></td>
                              <td className="py-3 pr-4 theme-text-muted text-xs max-w-[120px] truncate">{rec.notes || '-'}</td>
                              <td className="py-3 text-xs theme-text-secondary">{new Date(rec.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-xs theme-text-muted font-bold">{allocTotal} total records</p>
                      <div className="flex space-x-2">
                        <button disabled={allocPage <= 1} onClick={() => { setAllocPage(p => p - 1); }}
                          className="px-4 py-2 bg-gray-800 rounded-xl text-xs font-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Previous
                        </button>
                        <button disabled={allocationRecords.length < 50} onClick={() => { setAllocPage(p => p + 1); }}
                          className="px-4 py-2 bg-gray-800 rounded-xl text-xs font-black text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Approve Modal */}
      <AnimatePresence>
        {approveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Approve Request</h2>
              <p className="theme-text-secondary text-sm font-bold mb-6">
                {approveModal.outletName} requested <span className="theme-text-primary">{approveModal.quantity}</span> × {approveModal.itemName}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Quantity to Approve</label>
                  <input type="number" min="0" max={approveModal.quantity} value={approveQty}
                    onChange={(e) => setApproveQty(Math.min(parseInt(e.target.value) || 0, approveModal.quantity))}
                    className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-black text-lg text-white mt-2"
                  />
                </div>
                <p className="text-xs theme-text-muted font-bold">
                  Max: {approveModal.quantity} | Enter 0 to reject
                </p>
                <div className="flex space-x-3">
                  <button onClick={() => setApproveModal(null)}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleApprove}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-500 transition-all flex items-center justify-center space-x-2">
                    <CheckCircle size={16} />
                    <span>Approve {approveQty}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="glass max-w-md w-full p-4 md:p-8 rounded-xl md:rounded-[2rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              <h2 className="text-2xl font-black theme-text-primary mb-2">Reject Request</h2>
              <p className="theme-text-secondary text-sm font-bold mb-6">
                {rejectModal.outletName} • {rejectModal.itemName} × {rejectModal.quantity}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Reason / Notes (optional)</label>
                  <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)}
                    className="w-full theme-bg-subtle border-2 theme-border rounded-xl py-3 px-4 focus:border-red-500 outline-none font-medium text-white mt-2 min-h-[80px]"
                    placeholder="Why is this request being rejected?"
                  />
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setRejectModal(null)}
                    className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-gray-700 transition-all">
                    Cancel
                  </button>
                  <button onClick={handleReject}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-red-500 transition-all flex items-center justify-center space-x-2">
                    <XCircle size={16} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WarehouseDashboard;
