import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, Plus, Minus, X, Trash2, Printer, Barcode, Percent, RotateCcw, CreditCard, DollarSign, Package, Tag, Grid3X3, List, ChevronDown, ChevronUp, AlertCircle, BarChart3, RefreshCw, Calendar, TrendingUp, Award, Clock, CheckCircle2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import useCache, { invalidateKey } from '../hooks/useCache';
import { enqueue } from '../utils/syncQueue';
import { normalizeInventoryEvent } from '../utils/normalizeEvents';
import socket from '../socket';
import { debounce } from '../utils/debounce';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const OutletPOS = () => {
  const { user } = useAuth();
  const defaultOutlet = (() => {
    if (user?.role !== 'OUTLET') return 'Johar Town';
    const n = (user?.name || '').toLowerCase();
    if (n.includes('jail')) return 'Jail Road';
    if (n.includes('abbottabad')) return 'Abbottabad';
    return 'Johar Town';
  })();
  const [selectedOutlet, setSelectedOutlet] = useState(defaultOutlet);

  const [dashboardRange, setDashboardRange] = useState('all');
  const [dashboardDateFrom, setDashboardDateFrom] = useState('');
  const [dashboardDateTo, setDashboardDateTo] = useState('');

  const productsKey = `pos:products:${selectedOutlet}`;
  const dashboardKey = `pos:dashboard:${selectedOutlet}:${dashboardRange}:${dashboardDateFrom}:${dashboardDateTo}`;
  const salesKey = `pos:sales:${selectedOutlet}`;
  const returnsKey = `pos:returns:${selectedOutlet}`;

  const { data: products = [], loading: productsLoading, refresh: refreshProducts } = useCache(productsKey, {
    fetcher: () => api.get(`/api/pos/products?outlet=${selectedOutlet}`).then(r => r.data),
    ttl: 5 * 60 * 1000,
  });
  const { data: dashboard = null, loading: dashboardLoading, refresh: refreshDashboard } = useCache(dashboardKey, {
    fetcher: () => api.get('/api/pos/sales/dashboard', {
      params: {
        outlet: selectedOutlet,
        range: dashboardRange,
        dateFrom: dashboardDateFrom || undefined,
        dateTo: dashboardDateTo || undefined
      }
    }).then(r => r.data),
    ttl: 30000,
  });
  const [salesRange, setSalesRange] = useState('all');
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const { data: sales = [], loading: salesLoading, refresh: refreshSales } = useCache(`${salesKey}:range:${salesRange}:${salesDateFrom}:${salesDateTo}`, {
    fetcher: () => {
      let url = `/api/pos/sales?outlet=${selectedOutlet}`;
      if (salesRange !== 'all') url += `&range=${salesRange}`;
      if (salesDateFrom) url += `&dateFrom=${salesDateFrom}`;
      if (salesDateTo) url += `&dateTo=${salesDateTo}`;
      return api.get(url).then(r => r.data);
    },
    ttl: 5 * 60 * 1000,
  });
  const { data: returns = [], loading: returnsLoading, refresh: refreshReturns } = useCache(returnsKey, {
    fetcher: () => api.get(`/api/pos/returns?outlet=${selectedOutlet}`).then(r => r.data),
    ttl: 5 * 60 * 1000,
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
  const [discountFixed, setDiscountFixed] = useState(() => {
    const val = localStorage.getItem('pos_discount_fixed');
    return val ? parseFloat(val) : 0;
  });
  const [orderNumber, setOrderNumber] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('pos_customer_name') || '');
  const [paymentMethod, setPaymentMethod] = useState(() => localStorage.getItem('pos_payment_method') || 'CASH');
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [lookedUpOrder, setLookedUpOrder] = useState(null);
  const [tab, setTab] = useState('pos');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef(null);
  const [returnTab, setReturnTab] = useState('scan');
  const [returnBarcodeInput, setReturnBarcodeInput] = useState('');
  const [returnCart, setReturnCart] = useState([]);
  const [returnReason, setReturnReason] = useState('Customer return');
  const [returnLoading, setReturnLoading] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');

  // Persist ephemeral state to localStorage
  useEffect(() => { localStorage.setItem('pos_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('pos_discount_pct', discountPct.toString()); }, [discountPct]);
  useEffect(() => { localStorage.setItem('pos_discount_fixed', discountFixed.toString()); }, [discountFixed]);
  useEffect(() => { localStorage.setItem('pos_customer_name', customerName); }, [customerName]);
  useEffect(() => { localStorage.setItem('pos_payment_method', paymentMethod); }, [paymentMethod]);
  useEffect(() => { localStorage.setItem('pos_active_category', activeCategory); }, [activeCategory]);

  // Order lookup — when order number entered, fetch order details
  useEffect(() => {
    if (!orderNumber.trim()) { setLookedUpOrder(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/pos/order-lookup?orderNumber=${encodeURIComponent(orderNumber.trim())}`);
        setLookedUpOrder(res.data);
        setAdvanceAmount(parseFloat(res.data.advanceAmount) || 0);
        setCustomerName(res.data.customerName || '');
      } catch { setLookedUpOrder(null); }
    }, 600);
    return () => clearTimeout(timer);
  }, [orderNumber]);

  // Socket listener for inventory updates — invalidate products cache
  useEffect(() => {
    const handleInventoryUpdate = debounce(() => {
      invalidateKey(`pos:products:${selectedOutlet}`);
      invalidateKey(`pos:dashboard:${selectedOutlet}:${dashboardRange}:${dashboardDateFrom}:${dashboardDateTo}`);
      invalidateKey(`pos:sales:${selectedOutlet}`);
      invalidateKey(`pos:returns:${selectedOutlet}`);
    }, 500);
    socket.on('inventory-updated', handleInventoryUpdate);
    return () => { socket.off('inventory-updated', handleInventoryUpdate); };
  }, [selectedOutlet, dashboardRange, dashboardDateFrom, dashboardDateTo]);

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

  const groupedProducts = useMemo(() => {
    const map = new Map();
    for (const item of filtered) {
      const key = `${item.name}||${item.category}||${item.outletName}`;
      if (!map.has(key)) {
        map.set(key, {
          id: item.id,
          name: item.name,
          category: item.category,
          outletName: item.outletName,
          imageUrl: item.imageUrl,
          fabric: item.fabric,
          colors: [],
          sizes: [],
          variants: [],
          totalStock: 0,
          price: item.price || 0
        });
      }
      const g = map.get(key);
      g.variants.push(item);
      g.totalStock += (item.stock || 0);
      if (item.color) g.colors.push(item.color);
      if (item.size) g.sizes.push(item.size);
      const firstVariant = g.variants[0];
      g.imageUrl = g.imageUrl || firstVariant.imageUrl;
      g.fabric = g.fabric || firstVariant.fabric;
      g.price = g.price || firstVariant.price || 0;
    }
    for (const g of map.values()) {
      g.colors = [...new Set(g.colors)].sort();
      g.sizes = [...new Set(g.sizes)].sort();
    }
    return Array.from(map.values());
  }, [filtered]);

  const barcodeMap = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      if (p.barcode) {
        map.set(p.barcode, {
          id: p.id,
          productName: p.name,
          color: p.color,
          size: p.size,
          stock: p.stock,
          price: p.price || 0
        });
      }
    }
    return map;
  }, [products]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.qty, 0), [cart]);
  const altCharges = useMemo(() => cart.reduce((s, i) => s + (i.alterationAmount || 0), 0), [cart]);
  const discountAmount = ((subtotal + altCharges) * discountPct) / 100 + discountFixed;
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

  const handleBarcodeLookup = (code) => {
    if (!code) return;
    const v = barcodeMap.get(code);
    if (!v) return toast.error('Barcode not found');
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
  };

  const handleAddToCart = (product) => {
    if (product.stock != null && product.stock <= 0) return toast.error(`"${product.name}" is out of stock`);
    const hasColors = product.colors?.length > 0;
    const hasSizes = product.sizes?.length > 0;
    if (hasColors || hasSizes) {
      setShowConfig(product);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedQty(1);
    } else {
      setCart([...cart, {
        variantId: product.id, productName: product.name,
        size: product.size || null, color: product.color || null, unitPrice: product.price || 0,
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
    const variant = products.find(v =>
      v.name === product.name &&
      (!hasColors || v.color === selectedColor) &&
      (!hasSizes || v.size === selectedSize)
    );
    if (!variant) return toast.error('Variant not found');
    if (variant.stock != null && variant.stock < selectedQty) return toast.error(`Only ${variant.stock} in stock for ${variant.name}` + (variant.color ? ` (${variant.color})` : '') + (variant.size ? ` ${variant.size}` : ''));
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

  /* ─── Checkout (try fast path, fallback to sync queue) ─── */
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    const payload = {
      items: cart.map(i => ({ variantId: i.variantId, quantity: i.qty, unitPrice: i.unitPrice, alterationCharges: i.alterationAmount })),
      customerName: customerName || null,
      alterationCharges: altCharges,
      extraCharges: 0,
      discountPercent: discountPct,
      discountFixed: discountFixed,
      advanceAmount: parseFloat(advanceAmount) || 0,
      orderId: lookedUpOrder?.id || null,
      paymentMethod,
      receiptNumber: orderNumber || undefined,
      outlet: selectedOutlet
    };
    setCheckoutLoading(true);
    try {
      const res = await api.post(`/api/pos/sales?outlet=${selectedOutlet}`, payload);
      setLastSale(res.data);
      setShowCheckout(true);
      setCart([]);
      setDiscountPct(0);
      setDiscountFixed(0);
      setAdvanceAmount(0);
      setLookedUpOrder(null);
      setCustomerName('');
      setOrderNumber('');
      refreshProducts();
      refreshDashboard();
      refreshSales();
      refreshReturns();
      toast.success('Sale completed!');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error('Checkout failed: ' + msg);
      if (err.response?.status === 400) {
        console.error('Checkout validation error:', msg);
        return;
      }
      await enqueue('sale', 'create', payload);
    }
    setCheckoutLoading(false);
  }, [cart, customerName, altCharges, discountPct, discountFixed, advanceAmount, lookedUpOrder, paymentMethod, orderNumber, selectedOutlet, refreshProducts, refreshDashboard, refreshSales, refreshReturns]);

  /* ─── Receipt Print ─── */
  const printReceipt = (sale) => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      @page { margin: 0; size: 80mm auto; }
      body { font-family: monospace; font-size: 16px; padding: 4mm 6mm; color: #000; line-height: 1.5; background: #fff; margin: 0; }
      .header { text-align: center; margin-bottom: 6px; }
      .header h1 { font-size: 26px; font-weight: 900; margin: 0; }
      .header p { font-size: 14px; margin: 2px 0; font-weight: bold; }
      hr { border: none; border-top: 2px solid #000; margin: 6px 0; }
      .items { margin: 4px 0; }
      .items-heading { display: flex; font-size: 12px; font-weight: 900; text-transform: uppercase; padding: 2px 0 4px; border-bottom: 3px solid #000; margin-bottom: 2px; }
      .items-heading .col-item { flex: 1; text-align: left; }
      .items-heading .col-qty { min-width: 90px; text-align: right; }
      .items-heading .col-total { min-width: 75px; text-align: right; }
      .item { margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid #000; }
      .item-name { font-size: 16px; font-weight: 900; word-break: break-word; }
      .item-variant { font-size: 13px; font-weight: bold; color: #444; margin-top: 1px; }
      .item-line { display: flex; justify-content: flex-end; gap: 12px; font-size: 15px; font-weight: bold; margin-top: 2px; }
      .item-total { font-weight: 900; min-width: 75px; text-align: right; }
      .section-label { font-size: 13px; font-weight: 900; text-align: center; letter-spacing: 2px; margin: 4px 0 2px; padding: 3px 0; border-bottom: 2px solid #000; }
      .summary { width: 100%; font-size: 15px; margin: 4px 0; border-collapse: collapse; }
      .summary tr td { padding: 4px 0; font-weight: bold; }
      .summary .value { text-align: right; }
      .summary .sub td { padding-top: 6px; border-top: 1px solid #000; }
      .summary .final td { font-size: 19px; font-weight: 900; padding-top: 8px; border-top: 3px solid #000; }
      .footer { text-align: center; font-size: 14px; margin-top: 10px; font-weight: bold; }
    </style></head><body>`);
    const phones = { 'Johar Town': '0325-6666063', 'Jail Road': '(042) 36282641', 'Abbottabad': '' };
    const phone = phones[sale.outletName] || '';
    w.document.write(`<div class="header"><h1>ENAMELS</h1><p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p><p>${sale.outletName || ''}</p>${phone ? `<p>${phone}</p>` : ''}<p>Invoice: ${sale.receiptNumber}</p><p>${new Date(sale.createdAt).toLocaleString()}</p><p>Cashier: ${sale.cashierName || ''}</p>${sale.customerName ? `<p>Customer: ${sale.customerName}</p>` : ''}</div>`);
    w.document.write('<hr><div class="items"><div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">TOTAL</span></div>');
    (sale.items || []).forEach(item => {
      const name = item.productName || '';
      const variantParts = [item.color, item.size].filter(Boolean);
      w.document.write('<div class="item">');
      w.document.write(`<div class="item-name">${name}</div>`);
      if (variantParts.length > 0) w.document.write(`<div class="item-variant">${variantParts.join(' / ')}</div>`);
      w.document.write(`<div class="item-line"><span>${item.quantity} × ${formatCurrency(item.unitPrice)}</span><span class="item-total">${formatCurrency(item.lineTotal)}</span></div>`);
      if (item.alterationCharges > 0) {
        w.document.write(`<div class="item-line"><span>+ Alteration</span><span class="item-total">${formatCurrency(item.alterationCharges)}</span></div>`);
      }
      w.document.write('</div>');
    });
    w.document.write('</div><div class="section-label">SUMMARY</div>');
    w.document.write(`<table class="summary"><tr class="sub"><td>Subtotal</td><td class="value">${formatCurrency(sale.subtotal)}</td></tr>`);
    if (sale.alterationCharges > 0) w.document.write(`<tr><td>Alteration</td><td class="value">${formatCurrency(sale.alterationCharges)}</td></tr>`);
    if (sale.extraCharges > 0) w.document.write(`<tr><td>Extra Charges</td><td class="value">${formatCurrency(sale.extraCharges)}</td></tr>`);
    if (sale.discountPercent > 0 || sale.discountAmount > 0) w.document.write(`<tr><td>Discount${sale.discountPercent > 0 ? ` (${sale.discountPercent}%)` : ''}</td><td class="value">-${formatCurrency(sale.discountAmount)}</td></tr>`);
    const adv = parseFloat(sale.advanceAmount) || 0;
    const balance = sale.grandTotal - adv;
    w.document.write(`<tr class="final"><td>Final Amount</td><td class="value">${formatCurrency(sale.grandTotal)}</td></tr>`);
    if (adv > 0) w.document.write(`<tr><td>Advance</td><td class="value">-${formatCurrency(adv)}</td></tr>`);
    if (adv > 0) w.document.write(`<tr style="font-size:17px;font-weight:900;"><td>Balance</td><td class="value">${formatCurrency(balance)}</td></tr>`);
    w.document.write(`<tr><td>Payment</td><td class="value">${sale.paymentMethod}</td></tr></table>`);
    w.document.write('<hr><div class="footer"><p>Thank You for Shopping with Enamels.</p><p>Visit Again!</p></div>');
    const reviewUrls = {
      'Johar Town': 'https://www.google.com/maps/search/Enamels+375+A2+Block+A+2+Phase+1+Johar+Town+Lahore',
      'Jail Road': 'https://www.google.com/maps/search/Enamels+Jail+Road+7+sharahe+Shahrah+Aiwan-e-Sanat-o-Tijarat+Lahore',
      'Abbottabad': 'https://www.google.com/maps/search/Enamels+Abbottabad',
    };
    const reviewUrl = reviewUrls[sale.outletName] || 'https://www.google.com/maps/search/Enamels';
    w.document.write(`<div style="text-align:center;margin:10px 0 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(reviewUrl)}" width="120" height="120" alt="Review QR" style="display:inline-block;" onload="window.print()" onerror="window.print()"><p style="font-size:10px;margin:3px 0 0;font-weight:bold;">Scan to Review us on Google</p></div>`);
    w.document.write('<hr><p style="text-align:center;font-size:9px;margin-top:4px;">Software is develop by Sameer Butt</p>');
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
  };

  /* ─── Return ─── */
  const handleReturn = async (variantId) => {
    const qty = prompt('Return quantity:');
    if (!qty || parseInt(qty) < 1) return;
    try {
      await api.post(`/api/pos/returns?outlet=${selectedOutlet}`, { variantId, quantity: parseInt(qty), reason: 'Customer return' });
      toast.success('Return processed, stock updated');
      refreshProducts();
      refreshDashboard();
      refreshSales();
      refreshReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed');
    }
  };

  /* ─── Return by Barcode ─── */
  const handleReturnBarcodeLookup = (code) => {
    if (!code) return;
    const v = barcodeMap.get(code);
    if (!v) return toast.error('Barcode not found');
    if (v.stock <= 0) return toast.error('No stock to return');
    const existing = returnCart.find(i => i.variantId === v.id);
    if (existing) {
      setReturnCart(returnCart.map(i => i.variantId === v.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setReturnCart([...returnCart, {
        variantId: v.id, productName: v.productName, color: v.color, size: v.size,
        barcode: code, unitPrice: v.price, qty: 1, maxQty: v.stock
      }]);
    }
    toast.success(`${v.productName} added to return cart`);
    setReturnBarcodeInput('');
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && returnBarcodeInput && tab === 'returns') {
        handleReturnBarcodeLookup(returnBarcodeInput);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [returnBarcodeInput, tab]);

  const processReturns = async () => {
    if (returnCart.length === 0) return;
    setReturnLoading(true);
    try {
      for (const item of returnCart) {
        await api.post(`/api/pos/returns?outlet=${selectedOutlet}`, { variantId: item.variantId, quantity: item.qty, reason: returnReason, saleId: item.saleId || undefined });
      }
      toast.success(`${returnCart.reduce((s, i) => s + i.qty, 0)} item(s) returned successfully`);
      setReturnCart([]);
      setReturnReason('Customer return');
      refreshProducts();
      refreshDashboard();
      refreshSales();
      refreshReturns();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed');
    }
    setReturnLoading(false);
  };

  if (tab === 'history') {
    const filteredSales = receiptSearch
      ? sales.filter(s => s.receiptNumber?.toLowerCase().includes(receiptSearch.toLowerCase()))
      : sales;
    return (
      <div className="space-y-4 pb-20 px-4 overflow-y-auto h-full pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Clock size={24} className="text-purple-500" />Sales History</h1>
          <div className="flex gap-2">
            <button onClick={() => setTab('pos')} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"><ShoppingCart size={14} className="inline mr-1" />POS</button>
            <button onClick={() => setTab('dashboard')} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"><BarChart3 size={14} className="inline mr-1" />Dashboard</button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'today', 'yesterday', 'week', 'month', 'year'].map(p => (
            <button key={p} onClick={() => { setSalesRange(p); if (p !== 'custom') { setSalesDateFrom(''); setSalesDateTo(''); } }}
              className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all ${salesRange === p ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button onClick={() => setSalesRange('custom')}
            className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all ${salesRange === 'custom' ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>Custom</button>
          {salesRange === 'custom' && (
            <div className="flex items-center gap-1">
              <input type="date" value={salesDateFrom} onChange={e => setSalesDateFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none" />
              <span className="text-gray-500 text-xs">→</span>
              <input type="date" value={salesDateTo} onChange={e => setSalesDateTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none" />
            </div>
          )}
        </div>
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="Search by bill / receipt number..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none" />
        </div>
        <div className="space-y-2">
          {filteredSales.length === 0 && <p className="text-center text-gray-500 py-8 font-bold">{receiptSearch ? 'No sales match your search' : 'No sales yet'}</p>}
          {filteredSales.map(s => (
            <div key={s.id} className="bg-gray-800/60 rounded-2xl border border-gray-700/50 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-lg font-black text-white">{s.receiptNumber} {s.orderId && <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full ml-1">ORDER</span>}</p>
                  <p className="text-xs text-gray-500 font-bold">{new Date(s.createdAt).toLocaleString()} &bull; {s.outletName}</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const refundTotal = (s.returns || []).reduce((sum, r) => sum + r.refundAmount, 0);
                    const netAmount = s.grandTotal - refundTotal;
                    const hasReturn = refundTotal > 0;
                    return (
                      <>
                        <p className="text-lg font-black text-emerald-400">{formatCurrency(netAmount)}</p>
                        {hasReturn && <p className="text-[9px] text-red-400 font-bold line-through opacity-60">{formatCurrency(s.grandTotal)}</p>}
                        <p className="text-[10px] text-gray-500 font-bold">{s.paymentMethod}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(s.items || []).map((item, idx) => (
                  <span key={idx} className="text-[10px] font-bold text-gray-400 bg-gray-900 px-2 py-0.5 rounded-lg">
                    {item.productName}{item.color ? ` (${item.color})` : ''}{item.size ? ` / ${item.size}` : ''} x{item.quantity} = {formatCurrency(item.lineTotal)}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                <span>Cashier: {s.cashierName || 'N/A'} {s.customerName ? `| Customer: ${s.customerName}` : ''}</span>
                <button onClick={() => printReceipt(s)} className="text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-xl"><Printer size={12} className="inline mr-1" />Reprint</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'returns') {
    return (
      <div className="space-y-4 pb-20 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><RotateCcw size={24} />Returns</h1>
          <div className="flex gap-2">
            <button onClick={() => setReturnTab('scan')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'scan' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Scan Barcode</button>
            <button onClick={() => setReturnTab('sales')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'sales' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>From Sales</button>
            <button onClick={() => setReturnTab('history')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'history' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>History</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            {returnTab === 'scan' && (
              <div className="glass p-4 rounded-2xl border-2 border-gray-700">
                <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Scan Barcode to Return</h2>
                <div className="relative">
                  <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={returnBarcodeInput} onChange={e => setReturnBarcodeInput(e.target.value)}
                    placeholder="Scan barcode..." autoFocus
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
                </div>
                <p className="text-[10px] text-gray-600 mt-2">Scan a product barcode to add it to the return cart</p>
              </div>
            )}

            {returnTab === 'sales' && (
              <div className="glass p-4 rounded-2xl border-2 border-gray-700">
                <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sales.slice(0, 30).map(s => (
                    <div key={s.id} className="bg-gray-800/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-white">{s.receiptNumber} {s.orderId && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded-full ml-1">ORD</span>}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">{formatCurrency(s.grandTotal)}</span>
                          <button onClick={() => {
                            s.items.forEach(item => {
                              const existing = returnCart.find(i => i.productName === item.productName && i.color === item.color && i.size === item.size);
                              if (existing) {
                                setReturnCart(returnCart.map(i => i.productName === item.productName && i.color === item.color && i.size === item.size ? { ...i, qty: i.qty + 1 } : i));
                              } else {
                                setReturnCart([...returnCart, {
                                  variantId: item.outletVariantId, productName: item.productName,
                                  color: item.color, size: item.size, barcode: '',
                                  unitPrice: item.unitPrice, qty: 1, maxQty: 99,
                                  saleId: s.id
                                }]);
                              }
                            });
                            setReturnTab('scan');
                            toast.success('Sale items added to return cart');
                          }} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 px-2 py-1 rounded-lg">Return All</button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(s.items || []).map((item, idx) => (
                          <span key={idx} className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                            {item.productName} {item.color ? `(${item.color})` : ''} x{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {sales.length === 0 && <p className="text-center text-gray-500 py-4 font-bold">No sales yet</p>}
                </div>
              </div>
            )}

            {returnTab === 'history' && (
              <div className="glass p-4 rounded-2xl border-2 border-gray-700">
                <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Return History</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">
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
            )}
          </div>

          <div className="glass p-4 rounded-2xl border-2 border-gray-700">
            <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Return Cart ({returnCart.reduce((s, i) => s + i.qty, 0)} items)</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
              {returnCart.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2 border border-gray-700/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.productName}</p>
                    <p className="text-[9px] text-gray-500">{[item.color, item.size].filter(Boolean).join(' • ') || 'Standard'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => {
                      const copy = [...returnCart];
                      if (copy[i].qty <= 1) { copy.splice(i, 1); } else { copy[i].qty--; }
                      setReturnCart(copy);
                    }} className="p-0.5 text-gray-500 hover:text-white"><Minus size={10} /></button>
                    <span className="text-xs font-bold text-white min-w-[16px] text-center">{item.qty}</span>
                    <button onClick={() => {
                      const copy = [...returnCart];
                      if (copy[i].qty < copy[i].maxQty) copy[i].qty++;
                      setReturnCart(copy);
                    }} className="p-0.5 text-gray-500 hover:text-white"><Plus size={10} /></button>
                  </div>
                  <p className="text-xs font-bold text-red-400 min-w-[60px] text-right">-{formatCurrency(item.unitPrice * item.qty)}</p>
                  <button onClick={() => setReturnCart(returnCart.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
              {returnCart.length === 0 && <p className="text-center text-gray-500 py-4 text-xs font-bold">No items to return</p>}
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-gray-400 block mb-1">Return Reason</label>
              <input value={returnReason} onChange={e => setReturnReason(e.target.value)}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-400 font-bold">Total Refund</span>
              <span className="text-lg font-black text-red-400">-{formatCurrency(returnCart.reduce((s, i) => s + i.unitPrice * i.qty, 0))}</span>
            </div>
            <button onClick={processReturns} disabled={returnCart.length === 0 || returnLoading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm">
              {returnLoading ? 'Processing...' : `Process ${returnCart.reduce((s, i) => s + i.qty, 0)} Return(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'dashboard') {
    const kpis = dashboard ? [
      { label: 'Total Sales', value: formatCurrency(dashboard.totalSales), sub: `${dashboard.totalOrders} orders`, color: 'from-blue-600 to-indigo-600', icon: DollarSign },
      { label: 'Net Revenue', value: formatCurrency(dashboard.netRevenue), sub: `Refunds: ${formatCurrency(dashboard.totalSales - dashboard.netRevenue)}`, color: 'from-emerald-600 to-teal-600', icon: TrendingUp },
      { label: 'Total Discount', value: formatCurrency(dashboard.totalDiscount), sub: 'Discounts given', color: 'from-amber-600 to-orange-600', icon: Percent },
      { label: 'Returned Orders', value: dashboard.returnedOrders, sub: 'Items returned', color: 'from-red-600 to-rose-600', icon: RotateCcw },
      { label: 'Completed Orders', value: dashboard.completedOrders, sub: 'POS + Standard Completed', color: 'from-purple-600 to-violet-600', icon: CheckCircle2 },
      { label: 'Pending Orders', value: dashboard.pendingOrders, sub: 'Awaiting production/dispatch', color: 'from-cyan-600 to-blue-600', icon: Clock },
      { label: 'Cancelled Orders', value: dashboard.cancelledOrders, sub: 'Rejected / Cancelled', color: 'from-gray-600 to-slate-600', icon: X },
    ] : [];

    const datePresets = [
      { label: 'All Time', value: 'all' },
      { label: 'Today', value: 'today' },
      { label: 'Yesterday', value: 'yesterday' },
      { label: 'Last 7 Days', value: 'week' },
      { label: 'Last 30 Days', value: 'month' },
      { label: 'This Year', value: 'year' },
      { label: 'Custom Range', value: 'custom' }
    ];

    return (
      <div className="space-y-6 pb-20 px-4 overflow-y-auto h-full pt-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <BarChart3 size={24} className="text-blue-500" />
              Sales & Performance Dashboard
            </h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">
              Outlet: {selectedOutlet}
            </p>
          </div>
          <button onClick={() => setTab('pos')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 self-start">
            <ShoppingCart size={14} />
            Back to POS Register
          </button>
        </div>

        {/* Date Filters */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-gray-500 uppercase tracking-wider mr-2">Select Range:</span>
            {datePresets.map(preset => (
              <button
                key={preset.value}
                onClick={() => {
                  setDashboardRange(preset.value);
                  if (preset.value !== 'custom') {
                    setDashboardDateFrom('');
                    setDashboardDateTo('');
                  }
                }}
                className={`text-[10px] font-black px-3.5 py-2 rounded-xl border transition-all ${
                  dashboardRange === preset.value
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {dashboardRange === 'custom' && (
            <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800 w-fit">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar size={14} />
                <span>From:</span>
              </div>
              <input
                type="date"
                value={dashboardDateFrom}
                onChange={e => setDashboardDateFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
              />
              <span className="text-xs text-gray-500 font-bold">&rarr;</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar size={14} />
                <span>To:</span>
              </div>
              <input
                type="date"
                value={dashboardDateTo}
                onChange={e => setDashboardDateTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  invalidateKey(dashboardKey);
                  refreshDashboard();
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Dashboard statistics */}
        {dashboardLoading ? (
          <div className="py-20 flex justify-center items-center">
            <RefreshCw className="animate-spin text-blue-500" size={32} />
          </div>
        ) : dashboard && (
          <div className="space-y-6">
            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <div key={i} className={`bg-gradient-to-br ${kpi.color} p-[1px] rounded-2xl shadow-lg`}>
                    <div className="bg-gray-950/90 rounded-2xl p-4 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                        <Icon size={14} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-xl md:text-2xl font-black text-white">{kpi.value}</p>
                        <p className="text-[10px] text-gray-500 font-bold mt-1">{kpi.sub}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method Breakdown */}
            {dashboard.paymentBreakdown && dashboard.paymentBreakdown.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {dashboard.paymentBreakdown.map(pm => {
                  const icons = { CASH: DollarSign, ONLINE: Globe, CARD: CreditCard };
                  const colors = { CASH: 'from-emerald-600 to-green-600', ONLINE: 'from-blue-600 to-indigo-600', CARD: 'from-purple-600 to-violet-600' };
                  const bgColors = { CASH: 'text-emerald-400', ONLINE: 'text-blue-400', CARD: 'text-purple-400' };
                  const Icon = icons[pm.method] || DollarSign;
                  return (
                    <div key={pm.method} className={`bg-gradient-to-br ${colors[pm.method] || 'from-gray-600 to-slate-600'} p-[1px] rounded-2xl shadow-lg`}>
                      <div className="bg-gray-950/90 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Icon size={14} className={bgColors[pm.method] || 'text-gray-400'} />
                            {pm.method}
                          </span>
                        </div>
                        <p className="text-lg font-black text-white">{formatCurrency(pm.net)}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                          <span className="text-emerald-400 font-bold">Gross: {formatCurrency(pm.gross)}</span>
                          {pm.returns > 0 && (
                            <span className="text-red-400 font-bold">Returns: -{formatCurrency(pm.returns)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Peak day & comparisons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Award size={14} className="text-amber-500" />
                    Highest Sales Day
                  </h3>
                  <p className="text-xl font-black text-white">{formatCurrency(dashboard.highestSalesDay?.amount || 0)}</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestSalesDay?.date || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Award size={14} className="text-blue-500" />
                    Highest Orders Day
                  </h3>
                  <p className="text-xl font-black text-white">{dashboard.highestOrdersDay?.count || 0} Orders</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1">Date: {dashboard.highestOrdersDay?.date || 'N/A'}</p>
                </div>
              </div>

              {/* Best branch performance comparison (if viewing 'all' admin mode) */}
              {dashboard.branchPerformance && dashboard.branchPerformance.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Branch Comparison</h3>
                  <div className="space-y-2">
                    {dashboard.branchPerformance.map((bp, idx) => (
                      <div key={bp.branch} className="flex items-center justify-between text-xs border-b border-gray-800 pb-1.5">
                        <span className="font-bold text-gray-300">{idx + 1}. {bp.branch}</span>
                        <span className="font-black text-emerald-400">{formatCurrency(bp.revenue)} ({bp.orders} ord)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sales Chart */}
            {dashboard.reportData && dashboard.reportData.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4">Sales Trend</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.reportData}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} tickFormatter={(v) => `₨${(v/1000)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px' }} formatter={(v) => formatCurrency(v)} labelStyle={{ color: '#fff', fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Best Selling Products */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Top Selling Products</h3>
                <div className="space-y-2">
                  {dashboard.bestSellingProducts && dashboard.bestSellingProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                      <span className="font-black text-white">{p.name}</span>
                      <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">{p.qty} sold</span>
                    </div>
                  ))}
                  {(!dashboard.bestSellingProducts || dashboard.bestSellingProducts.length === 0) && (
                    <p className="text-center text-gray-500 py-4 font-bold">No product sales data in range</p>
                  )}
                </div>
              </div>

              {/* Recent Sales list */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales Transactions</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sales.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                      <div>
                        <p className="font-black text-white">{s.receiptNumber} {s.orderId && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded-full ml-1">ORD</span>}</p>
                        <p className="text-[10px] text-gray-500">{new Date(s.createdAt).toLocaleDateString()} &bull; {s.items?.length || 0} items</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-400">{formatCurrency(s.grandTotal)}</p>
                        <p className="text-[10px] text-gray-500">{s.paymentMethod}</p>
                      </div>
                    </div>
                  ))}
                  {sales.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No recent sales</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b-2 border-gray-800 flex-shrink-0">
        <button onClick={() => setTab('pos')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'pos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><ShoppingCart size={14} className="inline mr-1" />POS</button>
        <button onClick={() => setTab('dashboard')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><BarChart3 size={14} className="inline mr-1" />Dashboard</button>
        <button onClick={() => setTab('returns')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'returns' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><RotateCcw size={14} className="inline mr-1" />Returns</button>
        <button onClick={() => setTab('history')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><Clock size={14} className="inline mr-1" />History</button>
        <button onClick={() => {
          invalidateKey(productsKey);
          invalidateKey(dashboardKey);
          invalidateKey(salesKey);
          invalidateKey(returnsKey);
          refreshProducts();
          refreshDashboard();
          refreshSales();
          refreshReturns();
        }} className="text-xs font-bold px-2 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white" title="Refresh data"><RefreshCw size={14} className={`inline ${productsLoading ? 'animate-spin' : ''}`} /></button>
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

      {/* POS Branch Selector Tabs (Admin only) */}
      {user?.role !== 'OUTLET' && (
        <div className="flex gap-1.5 px-4 py-2 bg-gray-950 border-b border-gray-800 overflow-x-auto flex-shrink-0">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center mr-2">POS Branch:</span>
          {['Johar Town', 'Jail Road', 'Abbottabad'].map(outlet => {
            const isActive = outlet === selectedOutlet;
            return (
              <button key={outlet} onClick={() => setSelectedOutlet(outlet)}
                className={`text-[9px] font-black px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-all ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>
                {outlet}
              </button>
            );
          })}
        </div>
      )}

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
          {productsLoading && filtered.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-600">
              <RefreshCw size={24} className="animate-spin mr-2" />
              <span className="font-bold">Loading products...</span>
            </div>
          ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {groupedProducts.map(g => {
              const colorLabel = g.colors.length > 0 ? g.colors.join(', ') : null;
              const sizeLabel = g.sizes.length > 0 ? g.sizes.join(', ') : null;
              const isOutOfStock = (g.totalStock != null && g.totalStock <= 0) || (g.variants.length === 1 && g.variants[0].stock != null && g.variants[0].stock <= 0);
              return (
                <button key={g.id} onClick={() => handleAddToCart(g.variants.length === 1 ? g.variants[0] : g)}
                  disabled={isOutOfStock}
                  className={`glass bg-gray-800/80 rounded-xl border-2 p-2 text-left transition-all active:scale-95 ${
                    isOutOfStock
                      ? 'border-red-900/30 opacity-50 cursor-not-allowed'
                      : 'border-gray-700/50 hover:border-blue-500/50'
                  }`}>
                  {g.imageUrl ? (
                    <img src={g.imageUrl} className="w-full h-20 object-cover rounded-lg mb-1.5" />
                  ) : (
                    <div className="w-full h-20 bg-gray-800 rounded-lg mb-1.5 flex items-center justify-center">
                      <Package size={24} className="text-gray-600" />
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">{g.name}</p>
                  {(colorLabel || sizeLabel) && (
                    <p className="text-[8px] text-gray-500 font-bold">{[colorLabel, sizeLabel].filter(Boolean).join(' | ')}</p>
                  )}
                  <p className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(g.price)}</p>
                  <p className={`text-[8px] font-bold ${isOutOfStock ? 'text-red-400' : 'text-gray-600'}`}>{isOutOfStock ? 'OUT OF STOCK' : `Stock: ${g.totalStock}`}</p>
                </button>
              );
            })}
          </div>
          )}
        </div>

        {/* Cart */}
        <div className="w-96 bg-gray-900/80 border-l-2 border-gray-800 flex flex-col flex-shrink-0">
          <div className="p-3 border-b-2 border-gray-800 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-black text-white flex items-center gap-2"><ShoppingCart size={16} />Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={() => { if (window.confirm('Clear cart?')) { setCart([]); setDiscountPct(0); } }} className="text-[10px] font-bold text-red-400 hover:text-red-300"><Trash2 size={12} className="inline mr-1" />Clear</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-340px)]">
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
              <span className="text-[10px] text-gray-500">%</span>
              <input type="number" value={discountFixed} onChange={e => setDiscountFixed(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white text-center focus:border-blue-500 outline-none" min="0" />
              <span className="text-[10px] text-gray-500">Fixed: -{formatCurrency(discountAmount)}</span>
            </div>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
              <label className="text-[10px] font-bold text-gray-400">Advance ₨</label>
              <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-24 bg-transparent border-b border-gray-600 px-1 py-1 text-xs font-bold text-white text-right focus:border-blue-500 outline-none" min="0" />
            </div>
            <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order # — enter to fetch advance/balance"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
            {lookedUpOrder && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-3 py-2 space-y-1">
                <p className="text-xs font-bold text-blue-300">{lookedUpOrder.customerName} ({lookedUpOrder.customerPhone || 'no phone'})</p>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-400">Total</span>
                  <span className="text-white font-bold">{formatCurrency(lookedUpOrder.totalPrice)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-400">Advance</span>
                  <span className="text-amber-400 font-bold">-{formatCurrency(lookedUpOrder.advanceAmount)}</span>
                </div>
                <div className="flex justify-between text-xs font-black border-t border-blue-800 pt-1">
                  <span className="text-emerald-400">Balance Due</span>
                  <span className="text-emerald-400">{formatCurrency(lookedUpOrder.balance)}</span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-black text-white border-t border-gray-700 pt-2">
              <span>Grand Total</span>
              <span className="text-emerald-400">{formatCurrency(grandTotal)}</span>
            </div>
            {parseFloat(advanceAmount) > 0 && (
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-400">Balance</span>
                <span className="text-amber-400">{formatCurrency(grandTotal - parseFloat(advanceAmount))}</span>
              </div>
            )}
            <button onClick={handleCheckout} disabled={cart.length === 0 || checkoutLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 mt-2">
              {checkoutLoading ? 'Processing...' : `Checkout ${parseFloat(advanceAmount) > 0 ? formatCurrency(grandTotal - parseFloat(advanceAmount)) + ' (Bal)' : formatCurrency(grandTotal)}`}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setTab('dashboard')} className="flex-1 text-[10px] font-bold text-gray-500 hover:text-white bg-gray-800 py-2 rounded-xl text-center">Dashboard</button>
              <button onClick={() => setTab('returns')} className="flex-1 text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 py-2 rounded-xl text-center flex items-center justify-center gap-1">
                <RotateCcw size={12} />Returns
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
