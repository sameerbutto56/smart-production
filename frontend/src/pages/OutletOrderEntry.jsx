import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, User, Phone, MapPin, ShoppingBag, Type, Ruler, FileText, CreditCard, Send, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Plus, X, Save, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const STEPS = ['Order Number', 'Customer Details', 'Products', 'Engraving', 'Size Chart', 'Special Notes', 'Payment Summary', 'Destination', 'Place Order'];

const DESTINATIONS = [
  { value: 'STORE', label: 'Send to Store', desc: 'Route directly to Store' },
  { value: 'LOGO_DESIGN', label: 'Send to Logo Department', desc: 'Logo team receives immediately' },
  { value: 'PRODUCTION', label: 'Send to Production', desc: 'Production receives immediately' }
];

const OutletOrderEntry = () => {
  const { user } = useAuth();
  const outletName = user?.name || 'Outlet';

  const [step, setStep] = useState(0);
  const [clientNumber, setClientNumber] = useState('');
  const [clientData, setClientData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lookedUp, setLookedUp] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saveAfterOrder, setSaveAfterOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const [customer, setCustomer] = useState({
    name: '', phone: '', address: '', city: '', notes: ''
  });

  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [engravingRequired, setEngravingRequired] = useState(false);
  const [engravingText, setEngravingText] = useState('');
  const [engravingInstructions, setEngravingInstructions] = useState('');

  const [sizeData, setSizeData] = useState({});

  const [notes, setNotes] = useState('');

  const [advanceAmount, setAdvanceAmount] = useState(0);

  const [destination, setDestination] = useState('');

  /* ─── Lookup Client ─── */
  const handleLookup = useCallback(async () => {
    const num = clientNumber.trim();
    if (!num) return toast.error('Enter a client number');
    setLookupLoading(true);
    setLookedUp(false);
    setClientData(null);
    setRecentOrders([]);
    try {
      const res = await api.get('/api/outlet-orders/lookup', { params: { number: num } });
      const { client, recentOrders: orders } = res.data;
      setClientData(client);
      setRecentOrders(orders || []);
      setCustomer({
        name: client.name || '',
        phone: client.phone || '',
        address: client.permanentAddress || '',
        city: (Array.isArray(client.deliveryAddresses) ? client.deliveryAddresses[0] : '') || '',
        notes: ''
      });
      setLookedUp(true);
      setSaveAfterOrder(false);
      toast.success(`Client ${client.name} found`);
    } catch (err) {
      if (err.response?.status === 404) {
        setLookedUp(true);
        setClientData(null);
        toast('Client not found — enter details manually');
      } else {
        toast.error('Lookup failed');
      }
    }
    setLookupLoading(false);
  }, [clientNumber]);

  /* ─── Fetch Product Catalog (reference only) ─── */
  const fetchCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get(`/api/pos/products?outlet=${encodeURIComponent(outletName)}`);
      setCatalog(res.data || []);
    } catch { toast.error('Failed to load products'); }
    setCatalogLoading(false);
  }, [outletName]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const categories = [...new Map(catalog.map(p => [p.category, p])).values()].map(p => p.category).filter(Boolean).sort();

  const filteredCatalog = useMemo(() => {
    if (!selectedCategory) return [];
    return catalog.filter(p => p.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const uniqueProducts = useMemo(() => {
    const map = new Map();
    filteredCatalog.forEach(p => {
      const key = `${p.name}||${p.category}`;
      if (!map.has(key)) map.set(key, { ...p, variants: [] });
      map.get(key).variants.push(p);
    });
    return Array.from(map.values());
  }, [filteredCatalog]);

  /* ─── Product Management ─── */
  const addProduct = (prod) => {
    setProducts(prev => [...prev, {
      _tempId: Date.now() + Math.random(),
      name: prod.name,
      category: prod.category,
      color: '',
      size: '',
      quantity: 1,
      unitPrice: prod.price || 0
    }]);
  };

  const updateProduct = (idx, field, value) => {
    setProducts(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removeProduct = (idx) => setProducts(prev => prev.filter((_, i) => i !== idx));

  /* ─── Totals ─── */
  const totalAmount = useMemo(() => {
    return products.reduce((sum, p) => sum + (parseFloat(p.unitPrice) || 0) * (p.quantity || 1), 0);
  }, [products]);

  const advance = parseFloat(advanceAmount) || 0;
  const balance = totalAmount - advance;

  /* ─── Validation ─── */
  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return clientNumber.trim().length > 0 && lookedUp;
      case 1: return customer.name.trim().length > 0 && customer.phone.trim().length > 0;
      case 2: return products.length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      case 7: return destination.length > 0;
      case 8: return true;
      default: return false;
    }
  }, [step, clientNumber, lookedUp, customer, products, destination]);

  const nextStep = () => { if (canProceed) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  /* ─── Submit ─── */
  const handleSubmit = async () => {
    if (products.length === 0) return toast.error('Add at least one product');
    if (!destination) return toast.error('Select an order destination');
    setSubmitting(true);
    try {
      const payload = {
        clientNumber: clientData?.clientNumber || null,
        customerName: customer.name,
        customerPhone: customer.phone,
        address: customer.address,
        city: customer.city,
        notes: customer.notes,
        products: products.map(p => ({
          name: p.name,
          category: p.category,
          color: p.color,
          size: p.size,
          quantity: p.quantity,
          unitPrice: p.unitPrice
        })),
        engravingRequired,
        engravingText: engravingText || null,
        engravingInstructions: engravingInstructions || null,
        sizeData: Object.keys(sizeData).length > 0 ? sizeData : null,
        advanceAmount: advance,
        orderDestination: destination
      };
      const res = await api.post('/api/outlet-orders', payload);
      setCreatedOrder(res.data);
      setSubmitted(true);

      if (saveAfterOrder && !clientData) {
        try {
          await api.post('/api/outlet-orders/save-client', {
            clientNumber: clientNumber.trim(),
            customerName: customer.name,
            customerPhone: customer.phone,
            address: customer.address,
            city: customer.city,
            notes: customer.notes
          });
          toast.success('Client saved to registration');
        } catch { /* silent */ }
      }

      toast.success(`Order ${res.data.orderNumber} placed!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    }
    setSubmitting(false);
  };

  const resetAll = () => {
    setStep(0);
    setClientNumber('');
    setClientData(null);
    setRecentOrders([]);
    setLookedUp(false);
    setCustomer({ name: '', phone: '', address: '', city: '', notes: '' });
    setProducts([]);
    setEngravingRequired(false);
    setEngravingText('');
    setEngravingInstructions('');
    setSizeData({});
    setNotes('');
    setAdvanceAmount(0);
    setDestination('');
    setSaveAfterOrder(false);
    setSubmitted(false);
    setCreatedOrder(null);
  };

  /* ─── Render ─── */
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 border-2 border-emerald-700 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Order Placed!</h2>
          <p className="text-lg font-bold text-blue-400">{createdOrder?.orderNumber}</p>
          <p className="text-sm font-bold text-gray-400">Routed to: {destination}</p>
          <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-gray-400">Total: <span className="text-white font-black">₨{totalAmount.toLocaleString()}</span></p>
            {advance > 0 && <p className="text-gray-400">Advance: <span className="text-emerald-400 font-black">₨{advance.toLocaleString()}</span></p>}
            <p className="text-gray-400">Balance: <span className="text-amber-400 font-black">₨{Math.max(0, balance).toLocaleString()}</span></p>
          </div>
          {saveAfterOrder && !clientData && (
            <p className="text-xs font-bold text-emerald-400">Customer saved to Client Registration</p>
          )}
          <button onClick={resetAll} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm">
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-amber-600 rounded-2xl"><ShoppingBag className="text-white" size={24} /></div>
        <div>
          <h1 className="text-2xl font-black text-white">Outlet Order Entry</h1>
          <p className="text-sm font-bold text-gray-400">{outletName} — Custom Orders Only</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => { if (i < step || step > i) {}}}
            className={`text-[9px] font-black px-2 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider transition-all shrink-0 ${
              i === step ? 'bg-amber-600 text-white' :
              i < step ? 'bg-emerald-700/40 text-emerald-400' :
              'bg-gray-800 text-gray-500'
            }`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-4 md:p-6 space-y-4 min-h-[300px]">

        {/* Step 0: Order Number (Client Number) */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Search size={18} />Enter Client Number</h2>
            <p className="text-sm font-bold text-gray-400">Enter the unique 4-5 digit client number to auto-fill customer details.</p>
            <div className="flex gap-2">
              <input value={clientNumber} onChange={e => { setClientNumber(e.target.value); setLookedUp(false); }}
                placeholder="Client Number (e.g., 1001)"
                className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-lg font-black text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
              <button onClick={handleLookup} disabled={lookupLoading || !clientNumber.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-3 rounded-xl disabled:opacity-50">
                {lookupLoading ? '...' : 'Search'}
              </button>
            </div>
            {lookedUp && !clientData && (
              <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4">
                <p className="text-sm font-bold text-amber-400">Client not found. You can enter details manually in the next step.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Customer Details */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><User size={18} />Customer Details</h2>
            {clientData && (
              <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-400">Client #{clientData.clientNumber} — {clientData.name}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Name *</label>
                <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  placeholder="Customer name" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Phone *</label>
                <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  placeholder="03XX-XXXXXXX" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Address</label>
                <input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  placeholder="Address" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">City</label>
                <input value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                  placeholder="City" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Customer Notes</label>
              <textarea value={customer.notes} onChange={e => setCustomer({ ...customer, notes: e.target.value })}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none" rows={2}
                placeholder="Any notes about the customer" />
            </div>
            {!clientData && lookedUp && (
              <label className="flex items-center gap-2 text-sm font-bold text-emerald-400 cursor-pointer">
                <input type="checkbox" checked={saveAfterOrder} onChange={e => setSaveAfterOrder(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4" />
                Save customer to Client Registration after order
              </label>
            )}
            {/* Recent Orders */}
            {recentOrders.length > 0 && (
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Recent Orders (Last {recentOrders.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentOrders.map(o => {
                    let items = [];
                    try { items = JSON.parse(o.productDetails || '[]'); } catch {}
                    return (
                      <div key={o.id} className="bg-gray-800/50 rounded-xl p-3 text-xs">
                        <p className="font-black text-blue-400">#{o.orderNumber}</p>
                        <p className="text-gray-500">{new Date(o.createdAt).toLocaleDateString()} — {o.currentStage}</p>
                        {items.map((item, i) => (
                          <p key={i} className="text-gray-400">{item.name} x{item.quantity} {item.color && `(${item.color})`}{item.size && ` / ${item.size}`}</p>
                        ))}
                        <p className="text-gray-500 mt-1">Total: ₨{(o.totalPrice || 0).toLocaleString()} | Adv: ₨{(o.advanceAmount || 0).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Product Selection (reference only — no stock deduction) */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><ShoppingBag size={18} />Products</h2>
            <p className="text-xs font-bold text-gray-500">Inventory is reference only. Stock is not deducted.</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCategory('')}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap ${!selectedCategory ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                All
              </button>
              {categories.map(c => (
                <button key={c} onClick={() => setSelectedCategory(c)}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap ${selectedCategory === c ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {c}
                </button>
              ))}
            </div>
            {selectedCategory && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {uniqueProducts.map((p, i) => (
                  <button key={i} onClick={() => addProduct(p)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-3 text-left">
                    <p className="text-xs font-black text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.category}</p>
                  </button>
                ))}
              </div>
            )}
            {/* Cart Items */}
            {products.length > 0 && (
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Selected Products ({products.length})</h3>
                {products.map((p, idx) => (
                  <div key={p._tempId} className="bg-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-white">{p.name}</p>
                      <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500">Color</label>
                        <select value={p.color} onChange={e => updateProduct(idx, 'color', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none">
                          <option value="">Select</option>
                          {[...new Set(p.variants?.map(v => v.color).filter(Boolean))].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Size</label>
                        <select value={p.size} onChange={e => updateProduct(idx, 'size', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none">
                          <option value="">Select</option>
                          {[...new Set(p.variants?.map(v => v.size).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500">Qty</label>
                        <input type="number" value={p.quantity} onChange={e => updateProduct(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none" min="1" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">Unit Price (₨)</label>
                      <input type="number" value={p.unitPrice} onChange={e => updateProduct(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none" min="0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Engraving */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Type size={18} />Engraving</h2>
            <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
              <input type="checkbox" checked={engravingRequired} onChange={e => setEngravingRequired(e.target.checked)}
                className="accent-amber-500 w-5 h-5" />
              Engraving Required
            </label>
            {engravingRequired && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Engraving Text</label>
                  <input value={engravingText} onChange={e => setEngravingText(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                    placeholder="Text to engrave" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Engraving Instructions</label>
                  <textarea value={engravingInstructions} onChange={e => setEngravingInstructions(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none" rows={2}
                    placeholder="Font, position, style, etc." />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Size Chart */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Ruler size={18} />Size Chart</h2>
            <p className="text-xs font-bold text-gray-500">Enter measurements for each product (optional).</p>
            {products.length === 0 ? (
              <p className="text-sm text-gray-500">No products selected. Go back and add products first.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {products.map((p, idx) => (
                  <div key={p._tempId} className="bg-gray-800 rounded-xl p-3">
                    <p className="text-sm font-black text-white mb-2">{p.name}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['Chest', 'Waist', 'Shoulder', 'Length', 'Sleeve', 'Bottom', 'Thigh', 'Mori'].map(m => (
                        <div key={m}>
                          <label className="text-[10px] text-gray-500">{m}</label>
                          <input type="text" value={sizeData[`${idx}_${m}`] || ''} onChange={e => setSizeData({ ...sizeData, [`${idx}_${m}`]: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none" placeholder="in" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Special Notes */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><FileText size={18} />Special Notes</h2>
            <p className="text-xs font-bold text-gray-500">Production instructions, stitching notes, fabric preferences, urgent delivery, etc.</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none" rows={6}
              placeholder="Stitching instructions, fabric notes, urgent delivery, customer preferences..." />
          </div>
        )}

        {/* Step 6: Payment Summary */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><CreditCard size={18} />Payment Summary</h2>
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Total Amount</span><span className="text-white font-black">₨{totalAmount.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400 font-bold">Advance Received</span>
                <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-28 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-black text-emerald-400 text-right outline-none" min="0" />
              </div>
              <div className="border-t border-gray-700 pt-2 flex justify-between text-base">
                <span className="text-gray-400 font-bold">Remaining Balance</span>
                <span className={`font-black ${balance <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>₨{Math.max(0, balance).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Destination */}
        {step === 7 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Send size={18} />Order Destination</h2>
            <p className="text-xs font-bold text-gray-500">Choose where this order should be sent.</p>
            <div className="space-y-2">
              {DESTINATIONS.map(d => (
                <button key={d.value} onClick={() => setDestination(d.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    destination === d.value ? 'border-amber-500 bg-amber-900/20' : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                  }`}>
                  <p className="text-sm font-black text-white">{d.label}</p>
                  <p className="text-xs font-bold text-gray-400">{d.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 8: Place Order (Review) */}
        {step === 8 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><CheckCircle size={18} />Review & Place Order</h2>
            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-gray-400">Customer: <span className="text-white font-black">{customer.name}</span></p>
              <p className="text-gray-400">Phone: <span className="text-white font-black">{customer.phone}</span></p>
              <p className="text-gray-400">Products: <span className="text-white font-black">{products.length} item(s)</span></p>
              <p className="text-gray-400">Engraving: <span className="text-white font-black">{engravingRequired ? 'Yes' : 'No'}</span></p>
              <p className="text-gray-400">Destination: <span className="text-white font-black">{DESTINATIONS.find(d => d.value === destination)?.label || destination}</span></p>
              <div className="border-t border-gray-700 pt-2 flex justify-between text-base">
                <span className="text-gray-400 font-bold">Total</span>
                <span className="text-white font-black">₨{totalAmount.toLocaleString()}</span>
              </div>
              {advance > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">Advance</span>
                  <span className="text-emerald-400 font-black">₨{advance.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg border-t border-gray-700 pt-2">
                <span className="text-gray-400 font-bold">Balance</span>
                <span className={`font-black ${balance <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>₨{Math.max(0, balance).toLocaleString()}</span>
              </div>
            </div>
            {saveAfterOrder && !clientData && (
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle size={12} />Customer will be saved to Client Registration</p>
            )}
            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? 'Placing Order...' : `Place Order — ₨${totalAmount.toLocaleString()}`}
            </button>
          </div>
        )}

      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={prevStep} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            <ChevronLeft size={16} />Back
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={nextStep} disabled={!canProceed}
            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default OutletOrderEntry;