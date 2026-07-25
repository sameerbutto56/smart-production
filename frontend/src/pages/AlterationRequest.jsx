import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Trash2, Printer, Send, ArrowLeft, Search, CheckCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { openPrintWindow, closePrintWindow } from '../utils/printReport';
import { toUrduName } from '../utils/urduDictionary';

export default function AlterationRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefillAltNumber = searchParams.get('alterationNumber') || '';
  const prefillOrderNumber = searchParams.get('orderNumber') || '';
  const prefillSource = searchParams.get('source') || 'OUTLET';

  const [alterationNumber, setAlterationNumber] = useState(prefillAltNumber);
  const [orderNumber, setOrderNumber] = useState(prefillOrderNumber);
  const [sourceModule, setSourceModule] = useState(prefillSource);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [outletName, setOutletName] = useState(user?.name || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(!!prefillAltNumber);
  const [submittedData, setSubmittedData] = useState(null);

  const getOutletPrefix = useCallback(() => {
    const n = (outletName || '').toLowerCase();
    if (n.includes('johar')) return 'JT-';
    if (n.includes('jail')) return 'JL-';
    if (n.includes('abbottabad')) return 'AB-';
    if (sourceModule === 'CUSTOMER_QUERY') return 'CQ-';
    return 'OT-';
  }, [outletName, sourceModule]);

  useEffect(() => {
    if (!alterationNumber && !prefillAltNumber) {
      generateNumber();
    }
  }, []);

  const generateNumber = async () => {
    try {
      const res = await api.get(`/api/alterations/generate-number?source=${sourceModule}`);
      setAlterationNumber(res.data.alterationNumber);
    } catch {
      toast.error('Failed to generate alteration number');
    }
  };

  const lookupOrder = async () => {
    if (!orderNumber.trim()) return;
    try {
      const res = await api.get(`/api/alterations/lookup-order?orderNumber=${orderNumber}`);
      const order = res.data;
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');

      if (order.productDetails && Array.isArray(order.productDetails)) {
        const mapped = order.productDetails.map((p, i) => ({
          id: Date.now() + i,
          productName: p.productName || p.name || '',
          color: p.color || '',
          size: p.size || '',
          quantity: p.quantity || 1,
          alterationNote: ''
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
      color: '',
      size: '',
      quantity: 1,
      alterationNote: ''
    }]);
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const canSubmit = alterationNumber && products.length > 0 && products.every(p => p.productName && p.alterationNote);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Fill all required fields (product name + alteration note for each product)');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        alterationNumber,
        sourceModule,
        sourceOutlet: outletName,
        orderNumber: orderNumber || null,
        customerName,
        customerPhone,
        outletName,
        products: products.map(p => ({
          productName: p.productName,
          color: p.color,
          size: p.size,
          quantity: p.quantity,
          alterationNote: p.alterationNote
        }))
      };
      const res = await api.post('/api/alterations', payload);
      setSubmitted(true);
      setSubmittedData(res.data);
      toast.success('Alteration request created and sent to Production!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create alteration');
    } finally {
      setLoading(false);
    }
  };

  const printAlterationSlip = () => {
    const data = submittedData || { alterationNumber, orderNumber, customerName, customerPhone, outletName, products };
    const win = openPrintWindow('Alteration Request', false);
    win.document.write('<style>');
    win.document.write('@page { size: 80mm auto; margin: 2mm; }');
    win.document.write('body { font-family: "Courier New", monospace; font-size: 12px; margin: 0; padding: 4px; color: #000; }');
    win.document.write('.header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }');
    win.document.write('.header h2 { font-size: 14px; margin: 0; text-transform: uppercase; }');
    win.document.write('.row { display: flex; justify-content: space-between; margin: 2px 0; }');
    win.document.write('.label { font-weight: bold; }');
    win.document.write('.product { border: 1px solid #000; padding: 4px; margin: 4px 0; }');
    win.document.write('.product-name { font-weight: bold; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 2px; }');
    win.document.write('.note { font-style: italic; margin-top: 2px; }');
    win.document.write('.footer { text-align: center; border-top: 2px solid #000; padding-top: 4px; margin-top: 6px; font-size: 10px; }');
    win.document.write('</style>');

    win.document.write('<div class="header"><h2>ALTERATION REQUEST</h2></div>');
    win.document.write(`<div class="row"><span class="label">Alt #:</span><span>${data.alterationNumber}</span></div>`);
    if (data.orderNumber) win.document.write(`<div class="row"><span class="label">Order #:</span><span>${data.orderNumber}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Customer:</span><span>${data.customerName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Phone:</span><span>${data.customerPhone || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Outlet:</span><span>${data.outletName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Date:</span><span>${new Date().toLocaleDateString('en-GB')}</span></div>`);

    win.document.write('<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>');
    win.document.write(`<div style="font-weight: bold; margin-bottom: 4px;">PRODUCTS (${data.products.length})</div>`);

    data.products.forEach((p, i) => {
      win.document.write('<div class="product">');
      win.document.write(`<div class="product-name">${i + 1}. ${p.productName}${p.color ? ' — ' + p.color : ''}${p.size ? ' (' + p.size + ')' : ''} × ${p.quantity}</div>`);
      win.document.write(`<div class="note">Note: ${p.alterationNote}</div>`);
      win.document.write('</div>');
    });

    win.document.write('<div class="footer">');
    win.document.write(`<p>Generated: ${new Date().toLocaleString()}</p>`);
    win.document.write('</div>');

    closePrintWindow(win);
  };

  if (submitted) {
    const data = submittedData || { alterationNumber, orderNumber, customerName, products };
    return (
      <div className="min-h-screen bg-black p-4 md:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Alteration Created!</h2>
            <p className="text-sm text-gray-400 mb-4">Sent to Production In automatically</p>

            <div className="bg-gray-800 rounded-xl p-4 mb-4 text-left space-y-2">
              <div className="flex justify-between"><span className="text-gray-400 text-sm">Alteration #</span><span className="text-white font-black">{data.alterationNumber}</span></div>
              {data.orderNumber && <div className="flex justify-between"><span className="text-gray-400 text-sm">Order #</span><span className="text-white font-black">{data.orderNumber}</span></div>}
              {data.customerName && <div className="flex justify-between"><span className="text-gray-400 text-sm">Customer</span><span className="text-white font-bold">{data.customerName}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400 text-sm">Products</span><span className="text-white font-bold">{(data.products || []).length}</span></div>
            </div>

            <div className="flex gap-2">
              <button onClick={printAlterationSlip} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
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
            <h1 className="text-2xl font-black text-white">Alteration Request</h1>
            <p className="text-sm text-gray-400">Create and submit alteration to production</p>
          </div>
        </div>

        {/* Alteration Number */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Alteration Number</label>
            <button onClick={generateNumber} className="text-xs font-bold text-blue-400 hover:text-blue-300">Regenerate</button>
          </div>
          <div className="bg-gray-800 rounded-xl px-4 py-3">
            <span className="text-lg font-black text-purple-400 tracking-wider">{alterationNumber || 'Generating...'}</span>
          </div>
        </div>

        {/* Source + Order Lookup */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Source</label>
              <select value={sourceModule} onChange={e => setSourceModule(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold">
                <option value="OUTLET">Outlet</option>
                <option value="CUSTOMER_QUERY">Customer Query</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-1">Order Number</label>
              <div className="flex gap-1">
                <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="e.g. JT-123456" className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-bold" />
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
            <button onClick={addProduct} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1">
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
                  <span className="text-xs font-black text-purple-400">#{idx + 1}</span>
                  <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input value={p.productName} onChange={e => updateProduct(p.id, 'productName', e.target.value)} placeholder="Product Name" className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                  <input value={p.color} onChange={e => updateProduct(p.id, 'color', e.target.value)} placeholder="Color" className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                  <div className="flex gap-1">
                    <input value={p.size} onChange={e => updateProduct(p.id, 'size', e.target.value)} placeholder="Size" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold" />
                    <input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', parseInt(e.target.value) || 1)} min="1" className="w-12 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold text-center" />
                  </div>
                </div>
                <textarea value={p.alterationNote} onChange={e => updateProduct(p.id, 'alterationNote', e.target.value)} placeholder="Alteration instructions for this product..." rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs font-bold resize-none" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={!canSubmit || loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            {loading ? 'Submitting...' : <><Send size={16} />Submit & Send to Production</>}
          </button>
        </div>
      </div>
    </div>
  );
}
