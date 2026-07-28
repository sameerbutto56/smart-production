import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Printer, Send, ArrowLeft, Search, CheckCircle, ListChecks, RefreshCcw, Calendar } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { openPrintWindow, closePrintWindow } from '../utils/printReport';

export default function EngravingRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userRole = (user?.role || '').toUpperCase();

  const prefillEngNumber = searchParams.get('engravingNumber') || '';
  const prefillOrderNumber = searchParams.get('orderNumber') || '';
  const isOutlet = userRole === 'OUTLET';
  const defaultSource = isOutlet ? 'OUTLET' : 'INVENTORY_VIEW';

  const [activeTab, setActiveTab] = useState('create');
  const [engravingNumber, setEngravingNumber] = useState(prefillEngNumber);
  const [orderNumber, setOrderNumber] = useState(prefillOrderNumber);
  const [sourceModule, setSourceModule] = useState(searchParams.get('source') || defaultSource);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [outletName, setOutletName] = useState(user?.name || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(!!prefillEngNumber);
  const [submittedData, setSubmittedData] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.get('/api/engravings/outlet-tasks');
      setTasks(res.data);
    } catch (e) {
      console.error('Engraving tasks error:', e);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const handleDone = async (id) => {
    setActionLoading(id + 'done');
    try {
      await api.patch(`/api/engravings/${id}/done`);
      toast.success('Engraving received');
      fetchTasks();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks();
  }, [activeTab, fetchTasks]);

  useEffect(() => {
    if (!engravingNumber && !prefillEngNumber && activeTab === 'create') {
      generateNumber();
    }
  }, []);

  const generateNumber = async () => {
    try {
      const res = await api.get(`/api/engravings/generate-number?source=${sourceModule}`);
      setEngravingNumber(res.data.engravingNumber);
    } catch {
      toast.error('Failed to generate engraving number');
    }
  };

  const lookupOrder = async () => {
    if (!orderNumber.trim()) return;
    try {
      const res = await api.get(`/api/engravings/lookup-order?orderNumber=${orderNumber}`);
      const order = res.data;
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');

      if (order.productDetails && Array.isArray(order.productDetails)) {
        const mapped = order.productDetails.map((p, i) => ({
          id: Date.now() + i,
          productName: p.productName || p.name || '',
          gender: p.gender || 'Male',
          quantity: p.quantity || 1,
          line1: '',
          line2: '',
          line3: '',
          logoRequired: false
        }));
        setProducts(mapped);
        toast.success(`Loaded ${mapped.length} product(s) from order`);
      }
    } catch {
      toast.error('Order not found');
    }
  };

  const addProduct = () => {
    setProducts([...products, {
      id: Date.now(),
      productName: '',
      gender: 'Male',
      quantity: 1,
      line1: '',
      line2: '',
      line3: '',
      logoRequired: false
    }]);
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const canSubmit = engravingNumber && products.length > 0 && products.every(p => p.productName);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Fill all required fields (product name for each product)');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        engravingNumber,
        sourceModule,
        sourceOutlet: outletName,
        orderNumber: orderNumber || null,
        customerName,
        customerPhone,
        outletName,
        products: products.map(p => ({
          productName: p.productName,
          gender: p.gender,
          quantity: p.quantity,
          line1: p.line1,
          line2: p.line2,
          line3: p.line3,
          logoRequired: p.logoRequired
        }))
      };
      const res = await api.post('/api/engravings', payload);
      setSubmitted(true);
      setSubmittedData(res.data);
      toast.success('Engraving request created and sent to Logo Department!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create engraving');
    } finally {
      setLoading(false);
    }
  };

  const printEngravingSlip = () => {
    const data = submittedData || { engravingNumber, orderNumber, customerName, customerPhone, outletName, products };
    const win = openPrintWindow('Engraving Job Sheet', false);
    win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Engraving Job Sheet</title><style>
      @page{margin:15mm;size:A4}
      body{font-family:'Courier New',monospace;font-size:13px;color:#000;margin:0;padding:0}
      .header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #000}
      .header h1{font-size:28px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin:0}
      .header p{font-size:11px;color:#555;margin:2px 0}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:12px 0;padding:12px;border:2px solid #000;border-radius:6px}
      .meta .item{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #ccc}
      .meta .label{font-weight:bold;font-size:11px;color:#333;text-transform:uppercase}
      .meta .value{font-weight:900;font-size:13px}
      .products{margin:16px 0}
      .products h2{font-size:16px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:10px}
      .product-card{border:2px solid #000;border-radius:6px;padding:12px;margin-bottom:10px;page-break-inside:avoid}
      .product-card h3{font-size:14px;font-weight:900;margin:0 0 6px 0;border-bottom:1px dashed #999;padding-bottom:4px}
      .product-card .detail{display:flex;justify-content:space-between;font-size:12px;margin:2px 0}
      .engraving-box{background:#f8f8f0;border:2px solid #000;border-left:6px solid #e6a817;padding:10px 14px;margin-top:8px;border-radius:0 6px 6px 0}
      .engraving-box .line{font-size:15px;font-weight:900;margin:3px 0;line-height:1.5}
      .engraving-box .line-label{font-size:10px;color:#666;text-transform:uppercase;font-weight:700;margin-right:6px}
      .logo-badge{display:inline-block;background:#1a5276;color:#fff;font-size:10px;font-weight:900;padding:2px 8px;border-radius:4px;margin-top:4px;text-transform:uppercase}
      .footer{text-align:center;border-top:2px solid #000;padding-top:8px;margin-top:16px;font-size:10px;color:#666}
    </style></head><body>`);

    win.document.write(`<div class="header">
      <h1>ENGRAVING JOB SHEET</h1>
      <p>Enamels Production</p>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>`);

    win.document.write('<div class="meta">');
    win.document.write(`<div class="item"><span class="label">Engraving #</span><span class="value">${data.engravingNumber}</span></div>`);
    if (data.orderNumber) win.document.write(`<div class="item"><span class="label">Order #</span><span class="value">${data.orderNumber}</span></div>`);
    win.document.write(`<div class="item"><span class="label">Customer</span><span class="value">${data.customerName || 'N/A'}</span></div>`);
    win.document.write(`<div class="item"><span class="label">Phone</span><span class="value">${data.customerPhone || 'N/A'}</span></div>`);
    win.document.write(`<div class="item"><span class="label">Source</span><span class="value">${data.outletName || 'N/A'}</span></div>`);
    win.document.write(`<div class="item"><span class="label">Date</span><span class="value">${new Date().toLocaleDateString('en-GB')}</span></div>`);
    win.document.write(`<div class="item"><span class="label">Status</span><span class="value">PENDING</span></div>`);
    win.document.write('</div>');

    win.document.write('<div class="products">');
    win.document.write(`<h2>Products (${data.products.length})</h2>`);
    data.products.forEach((p, i) => {
      win.document.write('<div class="product-card">');
      win.document.write(`<h3>${i + 1}. ${p.productName}</h3>`);
      win.document.write(`<div class="detail"><span>Gender</span><span>${p.gender || 'N/A'}</span></div>`);
      win.document.write(`<div class="detail"><span>Quantity</span><span>${p.quantity}</span></div>`);
      // Engraving text — printed verbatim, NO translation (lang="en" on html tag)
      const hasEngraving = p.line1 || p.line2 || p.line3;
      if (hasEngraving) {
        win.document.write('<div class="engraving-box">');
        if (p.line1) win.document.write(`<div class="line"><span class="line-label">Line 1:</span>${p.line1}</div>`);
        if (p.line2) win.document.write(`<div class="line"><span class="line-label">Line 2:</span>${p.line2}</div>`);
        if (p.line3) win.document.write(`<div class="line"><span class="line-label">Line 3:</span>${p.line3}</div>`);
        win.document.write('</div>');
      }
      if (p.logoRequired) {
        win.document.write('<div class="logo-badge">★ Logo Required</div>');
      }
      win.document.write('</div>');
    });
    win.document.write('</div>');

    win.document.write(`<div class="footer"><p>Engraving #${data.engravingNumber} | Generated ${new Date().toLocaleString()}</p></div>`);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  if (submitted) {
    const data = submittedData || { engravingNumber, orderNumber, customerName, products };
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Engraving Created!</h2>
            <p className="text-sm text-gray-400 mb-4">Sent to Logo Department automatically</p>

            <div className="bg-gray-800 rounded-xl p-4 mb-4 text-left space-y-2">
              <div className="flex justify-between"><span className="text-gray-400 text-sm">Engraving #</span><span className="text-cyan-400 font-black">{data.engravingNumber}</span></div>
              {data.customerName && <div className="flex justify-between"><span className="text-gray-400 text-sm">Customer</span><span className="text-white font-bold">{data.customerName}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400 text-sm">Products</span><span className="text-white font-bold">{(data.products || []).length}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={printEngravingSlip} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Printer size={16} />Print Slip
              </button>
              <button onClick={() => navigate(-1)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-sm">
                Back
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl"><ArrowLeft size={20} className="text-white" /></button>
          <div>
            <h1 className="text-2xl font-black text-white">Engraving</h1>
            <p className="text-sm text-gray-400">Create engraving requests & manage returned tasks</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'create' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            New Engraving
          </button>
          <button onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'tasks' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <ListChecks size={14} /> My Tasks ({tasks.length})
          </button>
        </div>

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{tasks.length} completed engraving{tasks.length !== 1 ? 's' : ''} returned</p>
              <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 border border-gray-700/50">
                <RefreshCcw size={14} /> Refresh
              </button>
            </div>

            {tasksLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}
              </div>
            ) : tasks.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-12 text-center">
                <CheckCircle className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-500 font-bold">No completed engravings returned</p>
                <p className="text-xs text-gray-600 mt-1">Completed engravings will appear here</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {tasks.map(eng => {
                  let prods = [];
                  try { prods = typeof eng.products === 'string' ? JSON.parse(eng.products) : (eng.products || []); } catch {}
                  return (
                    <motion.div key={eng.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-6 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-black text-white">{eng.engravingNumber}</p>
                          {eng.orderNumber && eng.orderNumber !== eng.engravingNumber && <p className="text-xs text-gray-400">Order: {eng.orderNumber}</p>}
                          <p className="text-sm text-gray-400">{eng.customerName}</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">RETURNED</span>
                      </div>
                      {prods.map((p, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
                          <p className="text-xs font-bold text-white">{p.productName} {p.gender ? `(${p.gender})` : ''} × {p.quantity || 1}</p>
                          {p.line1 && <p className="text-[11px] text-cyan-300">Line 1: {p.line1}</p>}
                          {p.line2 && <p className="text-[11px] text-cyan-300">Line 2: {p.line2}</p>}
                          {p.line3 && <p className="text-[11px] text-cyan-300">Line 3: {p.line3}</p>}
                          {p.logoRequired && <p className="text-[11px] text-amber-400">★ Logo Required</p>}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar size={12} />
                        {eng.completedAt && new Date(eng.completedAt).toLocaleDateString('en-PK')}
                      </div>
                      <button onClick={() => handleDone(eng.id)} disabled={actionLoading === eng.id + 'done'}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === eng.id + 'done' ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle size={14} />} Done
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (<>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Engraving Number</label>
            <button onClick={generateNumber} className="text-xs font-bold text-blue-400 hover:text-blue-300">Generate New</button>
          </div>
          <input value={engravingNumber} onChange={e => setEngravingNumber(e.target.value)}
            placeholder="e.g. JT-00001" className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg font-black text-cyan-400 tracking-wider border border-gray-700 focus:border-cyan-500 focus:outline-none" />
        </div>

        {/* Source + Order Lookup */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Source</label>
              <input value={sourceModule === 'OUTLET' ? 'Outlet' : 'Inventory View'} readOnly
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold cursor-not-allowed opacity-70" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Order Number (Lookup)</label>
              <div className="flex gap-1">
                <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Lookup existing order" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold" />
                <button onClick={lookupOrder} className="bg-blue-600 hover:bg-blue-500 px-3 rounded-xl"><Search size={16} className="text-white" /></button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Customer Name</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold" />
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Customer Phone</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold" />
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Products ({products.length})</h3>
            <button onClick={addProduct} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Plus size={14} />Add Product
            </button>
          </div>

          {products.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm font-bold">No products added yet</p>
              <p className="text-xs mt-1">Look up an order or add products manually</p>
            </div>
          )}

          <div className="space-y-3">
            {products.map((p, idx) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-cyan-400">#{idx + 1}</span>
                  <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input value={p.productName} onChange={e => updateProduct(p.id, 'productName', e.target.value)} placeholder="Product Name" className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                  <select value={p.gender} onChange={e => updateProduct(p.id, 'gender', e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                  <div className="flex gap-1 items-center">
                    <input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', parseInt(e.target.value) || 1)} min="1" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-center" />
                  </div>
                </div>
                <div className="space-y-1.5 mb-2">
                  <input value={p.line1} onChange={e => updateProduct(p.id, 'line1', e.target.value)} placeholder="Line 1 (engraving text)" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                  <input value={p.line2} onChange={e => updateProduct(p.id, 'line2', e.target.value)} placeholder="Line 2 (optional)" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                  <input value={p.line3} onChange={e => updateProduct(p.id, 'line3', e.target.value)} placeholder="Line 3 (optional)" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateProduct(p.id, 'logoRequired', !p.logoRequired)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${p.logoRequired ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-400' : 'bg-gray-900 border border-gray-700 text-gray-400'}`}>
                    {p.logoRequired ? '✓' : '○'} Logo Required
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={!canSubmit || loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            {loading ? 'Submitting...' : <><Send size={16} />Submit & Send to Logo Department</>}
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
}
