import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  TrendingUp, DollarSign, Package, BarChart3, RefreshCcw,
  Factory, Globe, Building2, Clock, Calendar, Filter,
  X, PlusCircle, Edit3, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

const TABS = ['dashboard', 'records', 'inventory'];

const ProductionDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [records, setRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    productName: '', quantity: 1, rawMaterialCost: '', productionCost: '',
    sellingValue: '', source: 'OUTLET', notes: '', productionDate: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const token = sessionStorage.getItem('token');
    try {
      let startDate, endDate;
      const now = new Date();
      if (dateFilter === 'today') { startDate = new Date(now.setHours(0,0,0,0)).toISOString(); endDate = new Date().toISOString(); }
      else if (dateFilter === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); startDate = d.toISOString(); endDate = new Date().toISOString(); }
      else if (dateFilter === 'month') { const d = new Date(); d.setMonth(d.getMonth() - 1); startDate = d.toISOString(); endDate = new Date().toISOString(); }

      const params = { page, limit: 50 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [dashRes, recRes, invRes] = await Promise.all([
        axios.get(`${API_URL}/api/production/dashboard`, { params: startDate ? { startDate, endDate } : {}, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/production/records`, { params, headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/production/inventory`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setDashboard(dashRes.data);
      setRecords(recRes.data.records);
      setRecordsTotal(recRes.data.total);
      setInventory(invRes.data);
    } catch (error) {
      if (!silent) toast.error('Error fetching production data');
    }
    if (!silent) setLoading(false);
  }, [page, dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.productName.trim() || !formData.quantity) {
      toast.error('Product name and quantity are required');
      return;
    }
    setSubmitting(true);
    const token = sessionStorage.getItem('token');
    try {
      const payload = {
        productName: formData.productName.trim(),
        quantity: parseInt(formData.quantity),
        rawMaterialCost: parseFloat(formData.rawMaterialCost) || 0,
        productionCost: parseFloat(formData.productionCost) || 0,
        sellingValue: parseFloat(formData.sellingValue) || 0,
        source: formData.source,
        notes: formData.notes,
        productionDate: formData.productionDate || undefined
      };
      if (editingRecord) {
        await axios.put(`${API_URL}/api/production/records/${editingRecord.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Production record updated');
      } else {
        await axios.post(`${API_URL}/api/production/records`, payload, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Production record created');
      }
      setShowForm(false);
      setEditingRecord(null);
      setFormData({ productName: '', quantity: 1, rawMaterialCost: '', productionCost: '', sellingValue: '', source: 'OUTLET', notes: '', productionDate: '' });
      fetchData(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving record');
    }
    setSubmitting(false);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      productName: record.productName,
      quantity: record.quantity,
      rawMaterialCost: record.rawMaterialCost?.toString() || '',
      productionCost: record.productionCost?.toString() || '',
      sellingValue: record.sellingValue?.toString() || '',
      source: record.source,
      notes: record.notes || '',
      productionDate: record.productionDate ? new Date(record.productionDate).toISOString().split('T')[0] : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this production record?')) return;
    const token = sessionStorage.getItem('token');
    try {
      await axios.delete(`${API_URL}/api/production/records/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Record deleted');
      fetchData(true);
    } catch (error) {
      toast.error('Error deleting record');
    }
  };

  const filteredRecords = records.filter(r =>
    !searchTerm || r.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.source?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/20 -rotate-2">
            <Factory className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Production</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Manufacturing & Earnings Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="theme-input rounded-xl py-2.5 px-4 text-xs font-bold appearance-none cursor-pointer">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button onClick={() => fetchData()} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-black py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 active:scale-95 border border-gray-700 text-xs">
            <RefreshCcw size={14} />
            <span>Refresh</span>
          </button>
          <button onClick={() => { setEditingRecord(null); setFormData({ productName: '', quantity: 1, rawMaterialCost: '', productionCost: '', sellingValue: '', source: 'OUTLET', notes: '', productionDate: '' }); setShowForm(true); }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 active:scale-95 text-xs">
            <PlusCircle size={14} />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex theme-bg border-2 theme-border rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${
              activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-800'
            }`}>
            {tab === 'dashboard' && <><BarChart3 size={14} className="inline mr-2" />Dashboard</>}
            {tab === 'records' && <><Package size={14} className="inline mr-2" />Records</>}
            {tab === 'inventory' && <><Factory size={14} className="inline mr-2" />Inventory</>}
          </button>
        ))}
      </div>

      {loading && !dashboard ? (
        <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4">
          <RefreshCcw className="animate-spin text-emerald-500" size={48} />
          <p className="theme-text-muted font-black text-xs uppercase tracking-widest">Loading Production Data...</p>
        </div>
      ) : (
        <>
          {/* ============ DASHBOARD TAB ============ */}
          {activeTab === 'dashboard' && dashboard && (
            <div className="space-y-4 md:space-y-8">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl"><DollarSign className="text-emerald-400" size={20} /></div>
                    <span className="text-[9px] font-black theme-text-muted uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black theme-text-primary">₨{dashboard.totalEarnings.toLocaleString()}</p>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Total Earnings</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl"><TrendingUp className="text-blue-400" size={20} /></div>
                    <span className="text-[9px] font-black theme-text-muted uppercase tracking-wider">Total</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black text-emerald-400">₨{dashboard.totalProfit.toLocaleString()}</p>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Total Profit</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl"><Package className="text-purple-400" size={20} /></div>
                    <span className="text-[9px] font-black theme-text-muted uppercase tracking-wider">Units</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black theme-text-primary">{dashboard.totalQuantity}</p>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Total Produced</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl"><BarChart3 className="text-orange-400" size={20} /></div>
                    <span className="text-[9px] font-black theme-text-muted uppercase tracking-wider">Records</span>
                  </div>
                  <p className="text-xl md:text-3xl font-black theme-text-primary">{dashboard.recordCount}</p>
                  <p className="text-xs font-bold theme-text-muted uppercase tracking-wider mt-1">Production Batches</p>
                </motion.div>
              </div>

              {/* Source Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                    <Globe size={18} className="text-blue-400" />
                    <span>Earnings by Source</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <div className="flex items-center space-x-3">
                        <Globe className="text-blue-400" size={20} />
                        <span className="font-bold theme-text-primary">Online Orders</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-blue-400">₨{dashboard.onlineEarnings.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-emerald-400">Profit: ₨{dashboard.onlineProfit.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <div className="flex items-center space-x-3">
                        <Building2 className="text-emerald-400" size={20} />
                        <span className="font-bold theme-text-primary">Outlet Orders</span>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-400">₨{dashboard.outletEarnings.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-blue-400">Profit: ₨{dashboard.outletProfit.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="text-gray-400" size={20} />
                        <span className="font-bold theme-text-primary">Total Cost</span>
                      </div>
                      <p className="font-black text-gray-400">₨{dashboard.totalCost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Monthly Trend */}
                {dashboard.monthlyData?.length > 0 && (
                  <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                    <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                      <TrendingUp size={18} className="text-purple-400" />
                      <span>Monthly Production Trend</span>
                    </h3>
                    {(() => {
                      const maxQty = Math.max(...dashboard.monthlyData.map(d => d.quantity), 1);
                      return (
                        <div className="space-y-4">
                          {dashboard.monthlyData.map(month => (
                            <div key={month.name}>
                              <div className="flex justify-between text-[9px] md:text-[10px] font-bold mb-1">
                                <span className="theme-text-secondary">{month.name}</span>
                                <div className="flex space-x-4">
                                  <span className="text-emerald-400">{month.quantity} units</span>
                                  <span className="text-blue-400">₨{month.profit.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="relative h-6 bg-gray-900 rounded-lg overflow-hidden">
                                <div className="h-full bg-emerald-500/40 transition-all" style={{ width: `${(month.quantity / maxQty) * 100}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Product-wise Breakdown */}
              {dashboard.productBreakdown?.length > 0 && (
                <div className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border">
                  <h3 className="font-black theme-text-primary uppercase tracking-wider text-sm mb-6 flex items-center space-x-3">
                    <Package size={18} className="text-amber-400" />
                    <span>Production-wise Profit Analysis</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[9px] font-black theme-text-muted uppercase tracking-wider border-b theme-border">
                          <th className="text-left py-3 px-2">Product</th>
                          <th className="text-right py-3 px-2">Qty</th>
                          <th className="text-right py-3 px-2">Batches</th>
                          <th className="text-right py-3 px-2">Cost</th>
                          <th className="text-right py-3 px-2">Revenue</th>
                          <th className="text-right py-3 px-2">Profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.productBreakdown.map((p, i) => (
                          <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                            <td className="py-3 px-2 font-bold theme-text-primary">{p.productName}</td>
                            <td className="py-3 px-2 text-right font-bold theme-text-primary">{p.quantity}</td>
                            <td className="py-3 px-2 text-right font-bold theme-text-secondary">{p.count}</td>
                            <td className="py-3 px-2 text-right font-bold text-gray-400">₨{p.totalCost.toLocaleString()}</td>
                            <td className="py-3 px-2 text-right font-bold text-emerald-400">₨{p.sellingValue.toLocaleString()}</td>
                            <td className={`py-3 px-2 text-right font-bold ${p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              ₨{p.profit.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ RECORDS TAB ============ */}
          {activeTab === 'records' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Production Records</h2>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input type="text" placeholder="Search products or source..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 sm:w-64 theme-input rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-all text-xs font-medium" />
                </div>
              </div>

              <div className="space-y-3">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-16">
                    <Package size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No production records found</p>
                  </div>
                ) : (
                  filteredRecords.map((record, i) => (
                    <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass p-4 md:p-6 rounded-2xl border-2 theme-border hover:border-emerald-500/20 transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="p-3 bg-emerald-500/10 rounded-xl mt-1">
                            <Factory size={20} className="text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-black theme-text-primary text-base">{record.productName}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                                Qty: {record.quantity}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border border-blue-500/20 bg-blue-500/5 text-blue-400">
                                {record.source}
                              </span>
                              <span className="text-[9px] font-bold theme-text-muted">
                                {new Date(record.productionDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleEdit(record)} className="p-2 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all" title="Edit">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t theme-border">
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider">Raw Material</p>
                          <p className="font-bold text-sm theme-text-primary">₨{record.rawMaterialCost?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider">Production</p>
                          <p className="font-bold text-sm theme-text-primary">₨{record.productionCost?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider">Total Cost</p>
                          <p className="font-bold text-sm text-gray-400">₨{record.totalCost?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase tracking-wider">Profit</p>
                          <p className={`font-bold text-sm ${record.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ₨{record.profit?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {record.notes && (
                        <div className="mt-3 p-3 bg-gray-800/30 rounded-xl">
                          <p className="text-[9px] font-black theme-text-muted uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-xs theme-text-secondary">{record.notes}</p>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {recordsTotal > 50 && (
                <div className="flex justify-center space-x-4 mt-6">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                    className="px-6 py-2 bg-gray-800 rounded-xl font-bold text-xs disabled:opacity-30">
                    Previous
                  </button>
                  <span className="px-4 py-2 font-bold text-xs theme-text-muted">Page {page} of {Math.ceil(recordsTotal / 50)}</span>
                  <button disabled={page >= Math.ceil(recordsTotal / 50)} onClick={() => setPage(p => p + 1)}
                    className="px-6 py-2 bg-gray-800 rounded-xl font-bold text-xs disabled:opacity-30">
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============ INVENTORY TAB ============ */}
          {activeTab === 'inventory' && (
            <div className="space-y-4 md:space-y-6">
              <h2 className="font-black theme-text-primary text-lg uppercase tracking-wider">Production Inventory</h2>
              <p className="text-xs font-bold theme-text-muted">Finished products received from Production department</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.length === 0 ? (
                  <div className="col-span-full text-center py-16">
                    <Package size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="theme-text-muted font-black text-xs uppercase tracking-widest">No inventory items yet</p>
                  </div>
                ) : (
                  inventory.map((item, i) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass p-5 rounded-2xl border-2 theme-border hover:border-emerald-500/30 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                            <Factory size={18} className="text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="font-black theme-text-primary text-sm">{item.productName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase border border-blue-500/20 bg-blue-500/5 text-blue-400">
                              {item.source}
                            </span>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                          {item.quantity} units
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t theme-border text-center">
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase">Cost</p>
                          <p className="font-bold text-xs theme-text-primary">₨{item.productionCost?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase">Value</p>
                          <p className="font-bold text-xs text-emerald-400">₨{item.sellingValue?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black theme-text-muted uppercase">Margin</p>
                          <p className={`font-bold text-xs ${item.profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {item.profitMargin?.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-[8px] font-bold theme-text-muted mt-3">
                        {new Date(item.productionDate).toLocaleDateString()}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============ ADD/EDIT MODAL ============ */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl theme-bg rounded-[2rem] border-2 theme-border p-6 md:p-10 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-black theme-text-primary uppercase tracking-wider">
                  {editingRecord ? 'Edit Production Record' : 'New Production Record'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 bg-gray-800 rounded-xl hover:bg-gray-700 transition-all">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Product Name *</label>
                    <input type="text" value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})}
                      placeholder="e.g. Premium Scrub Set"
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" required />
                  </div>
                  <div>
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Quantity *</label>
                    <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" required />
                  </div>
                  <div>
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Source</label>
                    <select value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1 appearance-none cursor-pointer">
                      <option value="OUTLET">Outlet</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Raw Material Cost (₨)</label>
                    <input type="number" min="0" step="0.01" value={formData.rawMaterialCost} onChange={(e) => setFormData({...formData, rawMaterialCost: e.target.value})}
                      placeholder="0"
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Production Cost (₨)</label>
                    <input type="number" min="0" step="0.01" value={formData.productionCost} onChange={(e) => setFormData({...formData, productionCost: e.target.value})}
                      placeholder="0"
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Selling Value (₨)</label>
                    <input type="number" min="0" step="0.01" value={formData.sellingValue} onChange={(e) => setFormData({...formData, sellingValue: e.target.value})}
                      placeholder="0"
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Production Date</label>
                    <input type="date" value={formData.productionDate} onChange={(e) => setFormData({...formData, productionDate: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Notes</label>
                    <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3} placeholder="Optional notes..."
                      className="w-full theme-input rounded-xl py-3 px-4 focus:border-emerald-500 outline-none font-medium mt-1 resize-none" />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-8 py-3 bg-gray-800 text-gray-300 font-black rounded-xl hover:bg-gray-700 transition-all text-xs uppercase tracking-wider">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition-all text-xs uppercase tracking-wider disabled:opacity-50">
                    {submitting ? 'Saving...' : editingRecord ? 'Update Record' : 'Create Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductionDashboard;
