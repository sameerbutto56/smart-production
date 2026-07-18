import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Barcode, ShoppingCart, Trash2, Plus, Minus, X, RotateCcw, Clock, Printer, Download, RefreshCw, ChevronDown, ChevronUp, ArrowLeft, CreditCard, DollarSign, Landmark, Wallet } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const paymentIcons = { CASH: DollarSign, CARD: CreditCard, ONLINE: Landmark, CASH_ONLINE: Wallet };

const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

/* ─── Barcode generation (matches backend) ─── */
const djb2 = (str) => {
  let hash = 5381;
  for (let i = 0; i < (str || '').length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};
const genBarcode = (itemId, size, color) => {
  const prefix = 'WRH';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|0`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

const WarehousePOS = () => {
  const [tab, setTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [extraCharges, setExtraCharges] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountFixed, setDiscountFixed] = useState(0);
  const [sales, setSales] = useState([]);
  const [showSaleItems, setShowSaleItems] = useState(null);
  const [returnQty, setReturnQty] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successSale, setSuccessSale] = useState(null);
  const [hideZero, setHideZero] = useState(false);

  const barcodeRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await api.get('/api/warehouse/products?skipCache=true');
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get('/api/warehouse/sales?skipCache=true');
      setSales(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setSales([]);
    }
  }, []);

  useEffect(() => { fetchProducts(); fetchSales(); }, [fetchProducts, fetchSales]);

  const handleBarcodeLookup = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    try {
      const res = await api.get(`/api/warehouse/barcode/${encodeURIComponent(code.trim())}`);
      const item = res.data;
      if (!item) return toast.error('Product not found');
      const existing = cart.find(c => c.barcode === item.barcode);
      if (existing) {
        setCart(prev => prev.map(c => c.barcode === item.barcode ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
        setCart(prev => [...prev, { ...item, productId: item.id, quantity: 1, unitPrice: item.price, discountPct: 0, discountFixed: 0, alterationCharges: 0, otherCharges: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false }]);
      }
      setBarcodeInput('');
      toast.success(`Added ${item.productName}`);
    } catch {
      toast.error('Barcode not found');
    }
  }, [cart]);

  const handleSearchAdd = useCallback((product) => {
    const barcode = genBarcode(product.id, product.size || null, product.color || null);
    const existing = cart.find(c => c.barcode === barcode);
    if (existing) {
      setCart(prev => prev.map(c => c.barcode === barcode ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        color: product.color || null,
        size: product.size || null,
        barcode,
        stock: product.stock,
        price: product.price,
        quantity: 1,
        unitPrice: product.price,
        discountPct: 0, discountFixed: 0,
        alterationCharges: 0, otherCharges: 0,
        customization1: false, customization2: false, nameEngrave: false, logoDesign: false
      }]);
    }
  }, [cart]);

  useEffect(() => {
    if (barcodeInput && barcodeInput.length >= 6) {
      const timer = setTimeout(() => handleBarcodeLookup(barcodeInput), 300);
      return () => clearTimeout(timer);
    }
  }, [barcodeInput, handleBarcodeLookup]);

  // Compute totals
  const { subtotal, grandTotal, discountAmount, itemCount } = useMemo(() => {
    let sub = 0;
    let discount = 0;
    let count = 0;
    cart.forEach(c => {
      const lineBase = (c.unitPrice || 0) * c.quantity;
      const d = (lineBase * (c.discountPct || 0) / 100) + (c.discountFixed || 0);
      sub += lineBase;
      discount += d;
      count += c.quantity;
    });
    const globalDiscount = ((sub - discount) * (discountPercent || 0) / 100) + (discountFixed || 0);
    const totalDiscount = discount + globalDiscount;
    const net = Math.max(0, sub - totalDiscount);
    return {
      subtotal: sub,
      discountAmount: totalDiscount,
      grandTotal: net,
      itemCount: count
    };
  }, [cart, discountPercent, discountFixed]);

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setProcessing(true);
    try {
      const payload = {
        items: cart.map(c => ({
          productId: c.productId,
          color: c.color,
          size: c.size,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          alterationCharges: c.alterationCharges,
          customization1: c.customization1,
          customization2: c.customization2,
          nameEngrave: c.nameEngrave,
          logoDesign: c.logoDesign,
          otherCharges: c.otherCharges,
          discountPct: c.discountPct,
          discountFixed: c.discountFixed
        })),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        paymentMethod,
        cashAmount: paymentMethod === 'CASH_ONLINE' ? parseFloat(cashAmount || 0) : undefined,
        onlineAmount: paymentMethod === 'CASH_ONLINE' ? parseFloat(onlineAmount || 0) : undefined,
        discountPercent,
        discountFixed,
      };
      const res = await api.post('/api/warehouse/sales', payload);
      setSuccessSale(res.data);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCashAmount('');
      setOnlineAmount('');
      setDiscountPercent(0);
      setDiscountFixed(0);
      setShowCheckoutModal(false);
      fetchProducts();
      fetchSales();
      toast.success('Sale completed!');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async (sale) => {
    const itemsToReturn = sale.items.filter(item => (returnQty[item.id] || 0) > 0);
    if (itemsToReturn.length === 0) return toast.error('Select items to return');
    setProcessing(true);
    try {
      for (const item of itemsToReturn) {
        const qty = returnQty[item.id];
        // Find productId by productName
        const product = products.find(p => p.name === item.productName);
        await api.post('/api/warehouse/returns', {
          productId: product?.id,
          color: item.color || undefined,
          size: item.size || undefined,
          quantity: qty,
          reason: returnReason || 'Customer return',
          saleId: sale.id,
          refundPaymentMethod: sale.paymentMethod
        });
      }
      toast.success('Return processed');
      setReturnQty({});
      setReturnReason('');
      fetchSales();
      fetchProducts();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Return failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRefundInvoice = async (sale) => {
    if (!window.confirm('Refund entire invoice? This cannot be undone.')) return;
    setProcessing(true);
    try {
      await api.post(`/api/warehouse/sales/${sale.id}/refund`);
      toast.success('Invoice refunded');
      fetchSales();
      fetchProducts();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed');
    } finally {
      setProcessing(false);
    }
  };

  const printReceipt = (sale) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.write(`<html><head><style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; }
      h2 { text-align: center; margin: 5px 0; font-size: 16px; }
      .center { text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 5px 0; }
      th, td { padding: 2px 4px; text-align: left; font-size: 11px; }
      th { border-bottom: 1px dashed #000; }
      .right { text-align: right; }
      .total { border-top: 1px solid #000; font-weight: bold; }
      .mt { margin-top: 8px; }
    </style></head><body>
      <h2>WAREHOUSE POS</h2>
      <p class="center">Receipt: ${sale.receiptNumber}<br>${new Date(sale.createdAt).toLocaleString()}</p>
      <p class="center">Cashier: ${sale.cashierName || '-'}</p>
      ${sale.customerName ? `<p>Customer: ${sale.customerName} ${sale.customerPhone ? `(${sale.customerPhone})` : ''}</p>` : ''}
      <table><tr><th>ITEM</th><th class="right">QTY×PRICE</th><th class="right">TOTAL</th></tr>
      ${(sale.items || []).map(item => `<tr>
        <td>${item.productName}${item.color ? ` (${item.color})` : ''}${item.size ? ` / ${item.size}` : ''}</td>
        <td class="right">${item.quantity}×${formatCurrency(item.unitPrice)}</td>
        <td class="right">${formatCurrency(item.lineTotal)}</td>
      </tr>`).join('')}
      </table>
      <table>
        <tr><td>Subtotal</td><td class="right">${formatCurrency(sale.subtotal)}</td></tr>
        <tr><td>Discount</td><td class="right">-${formatCurrency(sale.discountAmount || 0)}</td></tr>
        <tr class="total"><td>Grand Total</td><td class="right">${formatCurrency(sale.grandTotal)}</td></tr>
        <tr><td>Payment</td><td class="right">${sale.paymentMethod}</td></tr>
      </table>
      <p class="center mt">Thank you!</p>
    </body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const filteredProducts = products.filter(p => {
    if (hideZero && (p.stock || 0) <= 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
      (p.color || '').toLowerCase().includes(q) ||
      (p.size || '').toLowerCase().includes(q);
  });

  const getVariantStock = (product, color, size) => {
    if (!product.variants || !Array.isArray(product.variants)) return product.stock || 0;
    const match = product.variants.find(v =>
      (v.color || null) === (color || null) && (v.size || null) === (size || null)
    );
    return match ? (match.stock || 0) : 0;
  };

  /* ─── Tab: POS ─── */
  const renderPOS = () => (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-800">
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <Barcode size={14} className="text-gray-500" />
          <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
            placeholder="Scan barcode..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none max-w-xs" />
          <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="accent-blue-500" />
            Hide 0 stock
          </label>
          <button onClick={fetchProducts} className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white">
            <RefreshCw size={14} className={productsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {productsLoading ? (
            <div className="text-center text-gray-500 py-10 text-sm">Loading...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-gray-500 py-10 text-sm">No products found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filteredProducts.map(p => (
                <div key={p.id} onClick={() => handleSearchAdd(p)}
                  className="bg-gray-800/50 hover:bg-gray-700 border border-gray-700 rounded-lg p-2 cursor-pointer transition-colors">
                  {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-16 object-cover rounded mb-1" />}
                  <div className="text-xs font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-gray-400">{p.color || ''} {p.size || ''}</div>
                  <div className="text-xs font-bold text-emerald-400 mt-1">{formatCurrency(p.price)}</div>
                  <div className="text-[10px] text-gray-500">Stock: {p.stock || 0}</div>
                  {p.variants && p.variants.length > 1 && (
                    <div className="text-[9px] text-gray-600">{p.variants.length} variants</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 flex flex-col bg-gray-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-xs font-bold text-white flex items-center gap-1"><ShoppingCart size={14} /> Cart ({itemCount})</h3>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-[10px] text-red-400 hover:text-red-300">Clear</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="text-center text-gray-600 py-10 text-xs">Cart is empty</div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.productName}</div>
                    <div className="text-[10px] text-gray-400">{item.color || ''} {item.size || ''} {item.barcode && <span className="text-gray-600">| {item.barcode}</span>}</div>
                    <div className="text-[10px] text-emerald-400 font-bold">{formatCurrency(item.unitPrice)} ea</div>
                  </div>
                  <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-400 p-1">
                    <X size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
                    className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Minus size={10} /></button>
                  <span className="text-xs font-bold text-white w-6 text-center">{item.quantity}</span>
                  <button onClick={() => setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c))}
                    className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Plus size={10} /></button>
                  <span className="text-xs font-bold text-white ml-auto">{formatCurrency((item.unitPrice || 0) * item.quantity)}</span>
                </div>
                {(item.customization1 || item.customization2 || item.nameEngrave || item.logoDesign) && (
                  <div className="text-[9px] text-amber-400 mt-1">
                    {item.customization1 && 'C1(₨500) '}{item.customization2 && 'C2(₨1000) '}{item.nameEngrave && 'Engrave(₨300) '}{item.logoDesign && 'Logo(₨300) '}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className="p-3 border-t border-gray-800 flex-shrink-0 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>Discount</span><span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-white">
              <span>Total</span><span>{formatCurrency(grandTotal)}</span>
            </div>
            <button onClick={() => setShowCheckoutModal(true)}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
              Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ─── Tab: History ─── */
  const renderHistory = () => (
    <div className="p-4 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white">Sales History</h2>
        <button onClick={fetchSales} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="space-y-2">
        {sales.map(sale => (
          <div key={sale.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{sale.receiptNumber}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sale.refundedAt ? 'bg-red-900/50 text-red-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                    {sale.refundedAt ? 'REFUNDED' : 'COMPLETED'}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{new Date(sale.createdAt).toLocaleString()}</div>
                {sale.customerName && <div className="text-[10px] text-gray-400">{sale.customerName}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white">{formatCurrency(sale.grandTotal)}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{sale.paymentMethod}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={() => setShowSaleItems(showSaleItems === sale.id ? null : sale.id)}
                className="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-white flex items-center gap-1">
                {showSaleItems === sale.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Items
              </button>
              <button onClick={() => printReceipt(sale)} className="text-[10px] px-2 py-1 rounded bg-gray-700 text-gray-400 hover:text-white flex items-center gap-1">
                <Printer size={10} /> Print
              </button>
              {!sale.refundedAt && (
                <button onClick={() => handleRefundInvoice(sale)} className="text-[10px] px-2 py-1 rounded bg-red-900/50 text-red-400 hover:text-red-300 flex items-center gap-1">
                  <RotateCcw size={10} /> Refund
                </button>
              )}
            </div>
            {showSaleItems === sale.id && (
              <div className="mt-2 space-y-1">
                {sale.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-[10px] text-gray-400 pl-3 py-0.5 border-l-2 border-gray-700">
                    <span>{item.productName}{item.color ? ` (${item.color})` : ''}{item.size ? ` / ${item.size}` : ''} × {item.quantity}</span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                  {sale.items.map(item => (
                    <div key={item.id} className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500">{item.productName}:</span>
                      <input type="number" min="0" max={item.quantity} value={returnQty[item.id] || 0}
                        onChange={e => setReturnQty(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))}
                        className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-white text-center" />
                    </div>
                  ))}
                  <input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Reason"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-white placeholder-gray-600" />
                  <button onClick={() => handleReturn(sale)} disabled={processing}
                    className="text-[10px] px-2 py-1 rounded bg-amber-600 text-white disabled:opacity-50 flex items-center gap-1">
                    <RotateCcw size={10} /> Return
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {sales.length === 0 && <div className="text-center text-gray-600 py-10 text-sm">No sales yet</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => setTab('pos')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'pos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <ShoppingCart size={14} className="inline mr-1" />POS
        </button>
        <button onClick={() => setTab('history')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <Clock size={14} className="inline mr-1" />History
        </button>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-600 font-bold">WAREHOUSE POS</span>
      </div>

      {tab === 'pos' && renderPOS()}
      {tab === 'history' && renderHistory()}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowCheckoutModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-96 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">Checkout</h3>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Customer Name</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Optional"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Phone</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Optional"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Discount %</label>
                <input type="number" min="0" max="100" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white mt-1" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3 mb-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Items</span><span>{itemCount}</span></div>
              <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {discountAmount > 0 && <div className="flex justify-between text-xs text-emerald-400 mb-1"><span>Discount</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between text-sm font-bold text-white mt-2"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Payment Method</label>
              <div className="flex gap-2">
                {['CASH','CARD','ONLINE','CASH_ONLINE'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold border-2 ${paymentMethod === m ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                    {m.replace('_', ' + ')}
                  </button>
                ))}
              </div>
              {paymentMethod === 'CASH_ONLINE' && (
                <div className="flex gap-2 mt-2">
                  <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Cash amount"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white" />
                  <input type="number" value={onlineAmount} onChange={e => setOnlineAmount(e.target.value)} placeholder="Online amount"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold">Cancel</button>
              <button onClick={handleCheckout} disabled={processing}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50">
                {processing ? 'Processing...' : `Pay ${formatCurrency(grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successSale && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSuccessSale(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-emerald-400 mb-3">✓ Sale Completed</h3>
            <div className="text-xs text-gray-400 mb-4">
              <div>Receipt: {successSale.receiptNumber}</div>
              <div>Total: {formatCurrency(successSale.grandTotal)}</div>
              <div>Payment: {successSale.paymentMethod}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => printReceipt(successSale)} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                <Printer size={12} /> Print Receipt
              </button>
              <button onClick={() => setSuccessSale(null)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehousePOS;
