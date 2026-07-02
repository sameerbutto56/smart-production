import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, Plus, Minus, X, Trash2, Printer, Barcode, Percent, RotateCcw, CreditCard, DollarSign, Package, Tag, Grid3X3, List, ChevronDown, ChevronUp, AlertCircle, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const OutletPOS = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState(() => {
    try {
      const cached = localStorage.getItem('pos_products');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [activeCategory, setActiveCategory] = useState(() => localStorage.getItem('pos_active_category') || '');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => {
    try {
      const cached = localStorage.getItem('pos_cart');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [showConfig, setShowConfig] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [discountPct, setDiscountPct] = useState(() => {
    const val = localStorage.getItem('pos_discount_pct');
    return val ? parseFloat(val) : 0;
  });
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('pos_customer_name') || '');
  const [paymentMethod, setPaymentMethod] = useState(() => localStorage.getItem('pos_payment_method') || 'CASH');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [tab, setTab] = useState('pos');
  const [dashboard, setDashboard] = useState(() => {
    try {
      const cached = localStorage.getItem('pos_dashboard');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [sales, setSales] = useState(() => {
    try {
      const cached = localStorage.getItem('pos_sales');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [returns, setReturns] = useState(() => {
    try {
      const cached = localStorage.getItem('pos_returns');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);

  const fetchData = async (skipCache = false) => {
    try {
      const [p, d, s, r] = await Promise.all([
        api.get(`/api/pos/products${skipCache ? '?skipCache=true' : ''}`),
        api.get(`/api/pos/sales/dashboard${skipCache ? '?skipCache=true' : ''}`),
        api.get(`/api/pos/sales${skipCache ? '?skipCache=true' : ''}`),
        api.get(`/api/pos/returns${skipCache ? '?skipCache=true' : ''}`)
      ]);
      setProducts(p.data);
      setDashboard(d.data);
      setSales(s.data);
      setReturns(r.data);
      localStorage.setItem('pos_products', JSON.stringify(p.data));
      localStorage.setItem('pos_dashboard', JSON.stringify(d.data));
      localStorage.setItem('pos_sales', JSON.stringify(s.data));
      localStorage.setItem('pos_returns', JSON.stringify(r.data));
    } catch { toast.error('Failed to load data'); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Persist states to local storage on changes
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('pos_discount_pct', discountPct.toString());
  }, [discountPct]);

  useEffect(() => {
    localStorage.setItem('pos_customer_name', customerName);
  }, [customerName]);

  useEffect(() => {
    localStorage.setItem('pos_payment_method', paymentMethod);
  }, [paymentMethod]);

  useEffect(() => {
    localStorage.setItem('pos_active_category', activeCategory);
  }, [activeCategory]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const filtered = useMemo(() => {
    let p = products;
    if (activeCategory) p = p.filter(x => x.category === activeCategory);
    if (search) p = p.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    return p;
  }, [products, activeCategory, search]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.qty, 0), [cart]);
  const altCharges = useMemo(() => cart.reduce((s, i) => s + (i.alterationAmount || 0), 0), [cart]);
  const discountAmount = ((subtotal + altCharges) * discountPct) / 100;
  const grandTotal = subtotal + altCharges - discountAmount;

  /* ─── Barcode Scan ─── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && barcodeInput) {
        handleBarcodeLookup(barcodeInput);
        setBarcodeInput('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [barcodeInput]);

  const handleBarcodeLookup = async (code) => {
    if (!code) return;
    try {
      const res = await api.get(`/api/pos/barcode/${code}`);
      const v = res.data;
      const existing = cart.find(i => i.variantId === v.id);
      if (existing) {
        setCart(cart.map(i => i.variantId === v.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        setCart([...cart, {
          variantId: v.id, productName: v.productName,
          size: v.size, color: v.color, unitPrice: v.price || 0,
          qty: 1, alterationAmount: 0, alterationLabel: ''
        }]);
      }
      toast.success(`${v.productName} added via barcode`);
    } catch { toast.error('Barcode not found'); }
  };

  const handleAddToCart = (product) => {
    const hasColors = product.colors?.length > 0;
    const hasSizes = product.sizes?.length > 0;
    if (hasColors || hasSizes) {
      setShowConfig(product);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedQty(1);
    } else {
      const v = product.outletVariants?.[0];
      if (!v) return toast.error('No variant available');
      setCart([...cart, {
        variantId: v.id, productName: product.name,
        size: null, color: null, unitPrice: v.price || product.price || 0,
        qty: 1, alterationAmount: 0, alterationLabel: ''
      }]);
      toast.success(`${product.name} added`);
    }
  };

  const confirmConfig = () => {
    const product = showConfig;
    const hasColors = product.colors?.length > 0;
    const hasSizes = product.sizes?.length > 0;
    if (hasColors && !selectedColor) return toast.error('Please select a color');
    if (hasSizes && !selectedSize) return toast.error('Please select a size');
    if (selectedQty < 1) return toast.error('Quantity must be at least 1');
    const variant = product.outletVariants.find(v =>
      (!hasColors || v.color === selectedColor) &&
      (!hasSizes || v.size === selectedSize)
    );
    if (!variant) return toast.error('Variant not found');
    setCart([...cart, {
      variantId: variant.id, productName: product.name,
      size: variant.size, color: variant.color, unitPrice: variant.price || product.price || 0,
      qty: selectedQty, alterationAmount: 0, alterationLabel: ''
    }]);
    setShowConfig(null);
    toast.success(`${product.name} added`);
  };

  const removeCartItem = (i) => setCart(cart.filter((_, idx) => idx !== i));
  const updateQty = (i, qty) => {
    if (qty < 1) return;
    const copy = [...cart];
    copy[i] = { ...copy[i], qty };
    setCart(copy);
  };
  const updateAlteration = (i, label, amount) => {
    const copy = [...cart];
    copy[i] = { ...copy[i], alterationLabel: label, alterationAmount: amount };
    setCart(copy);
  };

  /* ─── Checkout ─── */
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await api.post('/api/pos/sales', {
        items: cart.map(i => ({ variantId: i.variantId, quantity: i.qty, unitPrice: i.unitPrice, alterationCharges: i.alterationAmount })),
        customerName: customerName || null,
        alterationCharges: altCharges,
        extraCharges: 0,
        discountPercent: discountPct,
        paymentMethod,
        receiptNumber: orderNumber || undefined
      });
      setLastSale(res.data);
      setShowCheckout(true);
      setCart([]);
      setDiscountPct(0);
      setCustomerName('');
      setOrderNumber('');
      fetchData();
      toast.success('Sale completed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    }
    setCheckoutLoading(false);
  };

  /* ─── Receipt Print ─── */
  const printReceipt = (sale) => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      @page { margin: 0; size: 80mm auto; }
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 4mm 0; color: #000; }
      .header { text-align: center; margin-bottom: 4px; }
      .header h1 { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
      .header p { font-size: 10px; margin: 2px 0; }
      hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
      table { width: 100%; font-size: 10px; border-collapse: collapse; }
      th { text-align: left; font-size: 9px; padding: 2px 0; border-bottom: 1px solid #000; }
      td { padding: 2px 0; vertical-align: top; }
      .right { text-align: right; }
      .center { text-align: center; }
      .total-row td { font-weight: 900; font-size: 12px; padding-top: 4px; }
      .footer { text-align: center; font-size: 9px; margin-top: 6px; }
      .barcode { text-align: center; margin: 4px 0; }
    </style></head><body>`);
    w.document.write(`<div class="header"><h1>ENAMELS</h1><p>${sale.outletName || ''}</p><p>Receipt #${sale.receiptNumber}</p><p>${new Date(sale.createdAt).toLocaleString()}</p><p>Cashier: ${sale.cashierName || ''}</p>${sale.customerName ? `<p>Customer: ${sale.customerName}</p>` : ''}</div>`);
    w.document.write('<hr><table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>');
    (sale.items || []).forEach(item => {
      const details = [item.productName, item.color, item.size].filter(Boolean).join(' ');
      w.document.write(`<tr><td>${details}</td><td class="right">${item.quantity}</td><td class="right">${formatCurrency(item.unitPrice)}</td><td class="right">${formatCurrency(item.lineTotal)}</td></tr>`);
      if (item.alterationCharges > 0) {
        w.document.write(`<tr><td style="padding-left:8px;font-size:9px">+ Alteration</td><td></td><td></td><td class="right">${formatCurrency(item.alterationCharges)}</td></tr>`);
      }
    });
    w.document.write('</tbody></table><hr>');
    w.document.write(`<table><tr><td>Subtotal</td><td class="right">${formatCurrency(sale.subtotal)}</td></tr>`);
    if (sale.alterationCharges > 0) w.document.write(`<tr><td>Alteration</td><td class="right">${formatCurrency(sale.alterationCharges)}</td></tr>`);
    if (sale.extraCharges > 0) w.document.write(`<tr><td>Extra Charges</td><td class="right">${formatCurrency(sale.extraCharges)}</td></tr>`);
    if (sale.discountPercent > 0) w.document.write(`<tr><td>Discount (${sale.discountPercent}%)</td><td class="right">-${formatCurrency(sale.discountAmount)}</td></tr>`);
    w.document.write(`<tr class="total-row"><td>Grand Total</td><td class="right">${formatCurrency(sale.grandTotal)}</td></tr>`);
    w.document.write(`<tr><td>Payment: ${sale.paymentMethod}</td><td></td></tr></table>`);
    w.document.write('<hr><div class="footer"><p>Thank you for your purchase!</p><p>Visit us again</p></div>');
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 200);
  };

  /* ─── Return ─── */
  const handleReturn = async (variantId) => {
    const qty = prompt('Return quantity:');
    if (!qty || parseInt(qty) < 1) return;
    try {
      await api.post('/api/pos/returns', { variantId, quantity: parseInt(qty), reason: 'Customer return' });
      toast.success('Return processed, stock updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed');
    }
  };

  if (tab === 'dashboard') {
    return (
      <div className="space-y-6 pb-20 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Sales Dashboard</h1>
          <button onClick={() => setTab('pos')} className="text-sm font-bold text-blue-400 hover:text-blue-300"><ShoppingCart size={16} className="inline mr-1" />Back to POS</button>
        </div>
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Today', sales: dashboard.todaySales, orders: dashboard.todayOrders },
              { label: 'Yesterday', sales: dashboard.yesterdaySales, orders: dashboard.yesterdayOrders },
              { label: 'This Week', sales: dashboard.weekSales, orders: dashboard.weekOrders },
              { label: 'This Month', sales: dashboard.monthSales, orders: dashboard.monthOrders },
              { label: 'This Year', sales: dashboard.yearSales, orders: dashboard.yearOrders },
              { label: 'All Time', sales: dashboard.totalSales, orders: dashboard.totalOrders },
            ].map((item, i) => (
              <div key={i} className="glass p-4 rounded-2xl border-2 border-gray-700">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{item.label}</p>
                <p className="text-2xl font-black text-white mt-1">{formatCurrency(item.sales)}</p>
                <p className="text-xs font-bold text-gray-400">{item.orders} orders</p>
              </div>
            ))}
          </div>
        )}
        <div className="glass p-4 rounded-2xl border-2 border-gray-700">
          <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sales.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-gray-800/50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-white">{s.receiptNumber}</p>
                  <p className="text-[10px] text-gray-500">{new Date(s.createdAt).toLocaleString()} &bull; {s.items?.length || 0} items</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-400">{formatCurrency(s.grandTotal)}</p>
                  <p className="text-[10px] text-gray-500">{s.paymentMethod}</p>
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No sales yet</p>}
          </div>
        </div>
        <div className="glass p-4 rounded-2xl border-2 border-gray-700">
          <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Returns</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {returns.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-red-900/10 rounded-xl px-3 py-2 border border-red-900/20">
                <div>
                  <p className="text-xs font-bold text-white">{r._variant?.product?.name || 'Unknown'} {r._variant?.color && `(${r._variant.color})`}</p>
                  <p className="text-[10px] text-gray-500">Qty: {r.quantity} &bull; {new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-xs font-bold text-red-400">-{formatCurrency(r.refundAmount)}</p>
              </div>
            ))}
            {returns.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No returns</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b-2 border-gray-800 flex-shrink-0">
        <button onClick={() => setTab('dashboard')} className="text-xs font-bold text-gray-400 hover:text-white bg-gray-800 px-3 py-2 rounded-xl"><BarChart3 size={14} className="inline mr-1" />Dashboard</button>
        <div className="relative flex-1 max-w-md">
          <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="Scan barcode..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none max-w-xs" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-gray-500 mr-1">Pay:</span>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-blue-500 outline-none">
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="ONLINE">Online</option>
          </select>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Categories (from warehouse) */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 flex-shrink-0">
            <button onClick={() => setActiveCategory('')}
              className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${!activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              All
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${activeCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Products */}
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {filtered.map(p => {
              const totalStock = p.outletVariants?.reduce((s, v) => s + v.stock, 0) || 0;
              return (
                <button key={p.id} onClick={() => handleAddToCart(p)}
                  className="glass bg-gray-800/80 rounded-xl border-2 border-gray-700/50 p-2 text-left hover:border-blue-500/50 transition-all active:scale-95">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="w-full h-20 object-cover rounded-lg mb-1.5" />
                  ) : (
                    <div className="w-full h-20 bg-gray-800 rounded-lg mb-1.5 flex items-center justify-center">
                      <Package size={24} className="text-gray-600" />
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(p.price)}</p>
                  <p className="text-[8px] text-gray-600 font-bold">{p.outletVariants?.length || 0} variants &bull; Stock: {totalStock}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="w-96 bg-gray-900/80 border-l-2 border-gray-800 flex flex-col flex-shrink-0">
          <div className="p-3 border-b-2 border-gray-800 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><ShoppingCart size={16} />Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={() => { if (window.confirm('Clear cart?')) { setCart([]); setDiscountPct(0); } }} className="text-[10px] font-bold text-red-400 hover:text-red-300"><Trash2 size={12} className="inline mr-1" />Clear</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.map((item, i) => (
              <div key={i} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white">{item.productName}</p>
                    <p className="text-[10px] text-gray-400">{[item.color, item.size].filter(Boolean).join(' \u2022 ') || 'Standard'}</p>
                    <p className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(item.unitPrice)} each</p>
                  </div>
                  <button onClick={() => removeCartItem(i)} className="text-gray-600 hover:text-red-400 ml-1"><X size={14} /></button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center bg-gray-900 rounded-lg border border-gray-700">
                    <button onClick={() => updateQty(i, item.qty - 1)} className="p-1.5 hover:text-white text-gray-500"><Minus size={12} /></button>
                    <span className="px-2 text-xs font-bold text-white min-w-[20px] text-center">{item.qty}</span>
                    <button onClick={() => updateQty(i, item.qty + 1)} className="p-1.5 hover:text-white text-gray-500"><Plus size={12} /></button>
                  </div>
                  <span className="text-xs font-black text-white ml-auto">{formatCurrency(item.unitPrice * item.qty)}</span>
                </div>
                <div className="mt-1.5">
                  <select value={item.alterationLabel} onChange={e => {
                    const val = e.target.value;
                    const amounts = { '': 0, 'Trouser Shorten': 150, 'Trouser Lengthen': 200, 'Sleeve Shorten': 100, 'Sleeve Lengthen': 150, 'Waist Alter': 200, 'Custom Alteration': 250 };
                    updateAlteration(i, val, amounts[val] || 0);
                  }} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white focus:border-blue-500 outline-none">
                    <option value="">No alteration</option>
                    <option value="Trouser Shorten">Trouser Shorten (+₨150)</option>
                    <option value="Trouser Lengthen">Trouser Lengthen (+₨200)</option>
                    <option value="Sleeve Shorten">Sleeve Shorten (+₨100)</option>
                    <option value="Sleeve Lengthen">Sleeve Lengthen (+₨150)</option>
                    <option value="Waist Alter">Waist Alter (+₨200)</option>
                    <option value="Custom Alteration">Custom Alteration (+₨250)</option>
                  </select>
                  {item.alterationAmount > 0 && <p className="text-[9px] text-amber-400 font-bold mt-0.5">+{formatCurrency(item.alterationAmount)} alteration</p>}
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart size={40} className="mx-auto text-gray-700 mb-3" />
                <p className="text-sm font-bold text-gray-600">Cart is empty</p>
                <p className="text-[10px] text-gray-700 font-bold">Scan barcode or select products</p>
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="p-3 border-t-2 border-gray-800 space-y-1.5 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {altCharges > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-400">
                <span>Alteration</span>
                <span>{formatCurrency(altCharges)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Percent size={12} className="text-blue-400" />
              <input type="number" value={discountPct} onChange={e => setDiscountPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" min="0" max="100" />
              <span className="text-[10px] text-gray-500">% Disc: -{formatCurrency(discountAmount)}</span>
            </div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order # (leave blank for auto-generate)"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            <div className="flex items-center justify-between text-sm font-black text-white border-t border-gray-700 pt-2">
              <span>Grand Total</span>
              <span className="text-emerald-400">{formatCurrency(grandTotal)}</span>
            </div>
            <button onClick={handleCheckout} disabled={cart.length === 0 || checkoutLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 mt-2">
              {checkoutLoading ? 'Processing...' : `Checkout ${formatCurrency(grandTotal)}`}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setTab('dashboard')} className="flex-1 text-[10px] font-bold text-gray-500 hover:text-white bg-gray-800 py-2 rounded-xl text-center">Dashboard</button>
              <button onClick={() => {
                const vid = prompt('Enter variant ID to return:');
                if (vid) handleReturn(vid);
              }} className="flex-1 text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 py-2 rounded-xl text-center flex items-center justify-center gap-1">
                <RotateCcw size={12} />Return
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowConfig(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4">{showConfig.name}</h3>
            {showConfig.colors?.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-400 block mb-1">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {showConfig.colors.map(c => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${selectedColor === c ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{c}</button>
                  ))}
                </div>
              </div>
            )}
            {showConfig.sizes?.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-400 block mb-1">Size</label>
                <div className="flex flex-wrap gap-1.5">
                  {showConfig.sizes.map(s => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${selectedSize === s ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 block mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))} className="p-2 bg-gray-800 rounded-xl text-white"><Minus size={14} /></button>
                <span className="text-lg font-black text-white min-w-[40px] text-center">{selectedQty}</span>
                <button onClick={() => setSelectedQty(selectedQty + 1)} className="p-2 bg-gray-800 rounded-xl text-white"><Plus size={14} /></button>
              </div>
            </div>
            <button onClick={confirmConfig} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm">
              Add to Cart &bull; {formatCurrency((showConfig.price || 0) * selectedQty)}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckout && lastSale && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingCart size={32} className="text-emerald-400" /></div>
            <h3 className="text-xl font-black text-white mb-1">Sale Complete!</h3>
            <p className="text-sm font-bold text-gray-400 mb-2">{lastSale.receiptNumber}</p>
            <p className="text-3xl font-black text-emerald-400 mb-4">{formatCurrency(lastSale.grandTotal)}</p>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(lastSale)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Printer size={16} />Print Receipt
              </button>
              <button onClick={() => setShowCheckout(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-sm">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletPOS;
