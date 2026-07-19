import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import useCache from '../hooks/useCache';
import { debounce } from '../utils/debounce';

const WarehousePOSContext = createContext(null);

const STATE_KEYS = [
  'activeCategory', 'search', 'cart', 'showConfig', 'selectedSize', 'selectedColor', 'selectedQty', 'configGroup',
  'discountPct', 'discountFixed', 'customerName', 'customerPhone',
  'paymentMethod',
  'showCheckout', 'checkoutLoading', 'lastSale',
  'tab', 'barcodeInput',
  'returnTab', 'returnBarcodeInput', 'returnCart', 'returnReason', 'refundPaymentMethod',
  'returnLoading', 'returnProductSearch', 'receiptSearch',
  'invoiceReturnInput', 'invoiceReturnLoading', 'lookedUpReturnSale', 'refundLoading',
  'showPrintOptions', 'pendingPrintSale', 'printOpts',
  'hideZeroStock',
];

function whReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE': {
      const { key, value } = action;
      const newValue = typeof value === 'function' ? value(state[key]) : value;
      let newState = { ...state, [key]: newValue };
      if (key === 'paymentMethod' && newValue === 'COD') {
        newState.cashAmount = 0;
        newState.onlineAmount = 0;
      }
      return newState;
    }
    default:
      return state;
  }
}

const initialState = STATE_KEYS.reduce((acc, k) => {
  if (k === 'cart') acc[k] = [];
  else if (k === 'returnCart') acc[k] = [];
  else if (k === 'paymentMethod') acc[k] = 'COD';
  else if (k === 'returnTab') acc[k] = 'barcode';
  else if (k === 'printOpts') acc[k] = { includeInvoice: true, includeGatePass: false };
  else acc[k] = k.includes('Loading') ? false : k.includes('show') ? false : k.includes('open') ? false : '';
  return acc;
}, {});

const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

const genBarcode = (itemId, size, color) => {
  const djb2 = (str) => {
    let hash = 5381;
    for (let i = 0; i < (str || '').length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  const prefix = 'WRH';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|0`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

export const WarehousePOSProvider = ({ children }) => {
  const [state, dispatch] = useReducer(whReducer, initialState);
  const { user } = useAuth();
  const barcodeRef = useRef(null);
  const returnBarcodeRef = useRef(null);

  const set = useCallback((key, value) => dispatch({ type: 'SET_STATE', key, value }), []);

  const productsKey = 'wh-products';

  const { data: products = [], loading: productsLoading, refresh: refreshProducts } = useCache(productsKey, {
    fetcher: () => api.get('/api/warehouse/products?skipCache=true').then(r => r.data),
    staleWhileRevalidate: true
  }, [productsKey]);

  const salesKey = useMemo(() => `wh-sales`, []);

  const { data: sales = [], loading: salesLoading, refresh: refreshSales } = useCache(salesKey, {
    fetcher: () => api.get('/api/warehouse/sales?skipCache=true').then(r => r.data),
    staleWhileRevalidate: true
  }, [salesKey]);

  const refreshAll = useCallback(() => {
    refreshProducts();
    refreshSales();
  }, [refreshProducts, refreshSales]);

  // Grouped products — expand each product's variants array into individual _variants entries
  const groupedProducts = useMemo(() => {
    const map = {};
    for (const p of products) {
      const key = p.name;
      if (!map[key]) {
        map[key] = { ...p, _variants: [], colors: [], sizes: [], totalStock: 0, minPrice: Infinity, maxPrice: 0 };
      }
      const variantDefs = Array.isArray(p.variants) ? p.variants : [];
      for (const v of variantDefs) {
        const barcode = v.barcode || genBarcode(p.id, v.size || null, v.color || null);
        const vStock = v.stock || 0;
        const vPrice = v.price || p.price || 0;
        // Deduplicate by color+size across all InventoryItems sharing the same name
        const exists = map[key]._variants.some(
          ev => (ev.color || null) === (v.color || null) && (ev.size || null) === (v.size || null)
        );
        if (exists) continue;
        map[key]._variants.push({
          id: p.id,
          name: p.name,
          category: p.category,
          color: v.color || null,
          size: v.size || null,
          variantStock: vStock,
          variantPrice: vPrice,
          barcode,
        });
        if (v.color && !map[key].colors.includes(v.color)) map[key].colors.push(v.color);
        if (v.size && !map[key].sizes.includes(v.size)) map[key].sizes.push(v.size);
        map[key].totalStock += vStock;
        if (vPrice < map[key].minPrice) map[key].minPrice = vPrice;
        if (vPrice > map[key].maxPrice) map[key].maxPrice = vPrice;
      }
    }
    return Object.values(map);
  }, [products]);

  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);

  const filteredProducts = useMemo(() => {
    let filtered = groupedProducts;
    if (state.activeCategory) {
      filtered = filtered.filter(g => g.category === state.activeCategory);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g._variants.some(v => (v.color || '').toLowerCase().includes(q) || (v.size || '').toLowerCase().includes(q))
      );
    }
    if (state.hideZeroStock) {
      filtered = filtered.filter(g => g._variants.some(v => v.variantStock > 0));
    }
    return filtered;
  }, [groupedProducts, state.activeCategory, state.search, state.hideZeroStock]);

  // Cart totals
  const cartSummary = useMemo(() => {
    let subtotal = 0, discount = 0, count = 0;
    state.cart.forEach(c => {
      const lineBase = (c.unitPrice || 0) * c.quantity;
      const d = (lineBase * (c.discountPct || 0) / 100) + (c.discountFixed || 0);
      subtotal += lineBase;
      discount += d;
      count += c.quantity;
    });
    const globalPct = parseFloat(state.discountPct || 0);
    const globalFixed = parseFloat(state.discountFixed || 0);
    const globalDiscount = ((subtotal - discount) * globalPct / 100) + globalFixed;
    const totalDiscount = discount + globalDiscount;
    return {
      subtotal,
      discountAmount: totalDiscount,
      grandTotal: Math.max(0, subtotal - totalDiscount),
      itemCount: count
    };
  }, [state.cart, state.discountPct, state.discountFixed]);

  // Barcode lookup
  const handleBarcodeLookup = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    try {
      const res = await api.get(`/api/warehouse/barcode/${encodeURIComponent(code.trim())}`);
      const item = res.data;
      if (!item) return toast.error('Product not found');
      const grp = groupedProducts.find(g => g._variants.some(v =>
        v.color === item.color && v.size === item.size && v.name === item.productName
      ));
      if (!grp) return toast.error('Product group not found');
      const variant = grp._variants.find(v => v.color === item.color && v.size === item.size && v.name === item.productName);
      if (!variant) return toast.error('Variant not found');

      const existing = state.cart.find(c => c.barcode === item.barcode);
      if (existing) {
        set('cart', prev => prev.map(c => c.barcode === item.barcode ? { ...c, quantity: c.quantity + 1 } : c));
      } else {
        set('cart', prev => [...prev, {
          id: variant.id, name: variant.name, color: variant.color, size: variant.size,
          barcode: item.barcode, stock: item.stock, unitPrice: item.price, price: item.price,
          quantity: 1, discountPct: 0, discountFixed: 0, alterationCharges: 0, otherCharges: 0,
          customization1: false, customization2: false, nameEngrave: false, logoDesign: false
        }]);
      }
      set('barcodeInput', '');
      toast.success(`Added ${item.productName}`);
    } catch {
      toast.error('Barcode not found');
    }
  }, [groupedProducts, state.cart, set]);

  // Auto lookup barcode
  useEffect(() => {
    if (state.barcodeInput && state.barcodeInput.length >= 6) {
      const timer = setTimeout(() => handleBarcodeLookup(state.barcodeInput), 300);
      return () => clearTimeout(timer);
    }
  }, [state.barcodeInput, handleBarcodeLookup]);

  const addToCart = useCallback((group, variant) => {
    const barcode = variant.barcode || genBarcode(variant.id, variant.size, variant.color);
    const existing = state.cart.find(c => c.barcode === barcode);
    if (existing) {
      set('cart', prev => prev.map(c => c.barcode === barcode ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      set('cart', prev => [...prev, {
        id: variant.id, name: variant.name, color: variant.color, size: variant.size,
        barcode, stock: variant.variantStock, unitPrice: variant.variantPrice, price: variant.variantPrice,
        quantity: 1, discountPct: 0, discountFixed: 0, alterationCharges: 0, otherCharges: 0,
        customization1: false, customization2: false, nameEngrave: false, logoDesign: false
      }]);
    }
  }, [state.cart, set]);

  // Open config modal when product has more than one variant
  const handleAddToCart = useCallback((group) => {
    if (group._variants.length <= 1) {
      addToCart(group, group._variants[0]);
      return;
    }
    set('configGroup', group);
    set('selectedColor', group.colors[0] || '');
    set('selectedSize', group.sizes[0] || '');
    set('selectedQty', 1);
    set('showConfig', true);
  }, [addToCart, set]);

  // Confirm variant from config modal, add to cart
  const confirmConfig = useCallback(() => {
    const group = state.configGroup;
    if (!group) return;
    const variant = group._variants.find(v =>
      (v.color || null) === (state.selectedColor || null) &&
      (v.size || null) === (state.selectedSize || null)
    );
    if (!variant) { toast.error('Variant not found'); return; }
    const qty = state.selectedQty || 1;
    for (let i = 0; i < qty; i++) {
      addToCart(group, variant);
    }
    set('showConfig', false);
    set('configGroup', null);
  }, [state.configGroup, state.selectedColor, state.selectedSize, state.selectedQty, addToCart, set]);

  const removeFromCart = useCallback((idx) => {
    set('cart', prev => prev.filter((_, i) => i !== idx));
  }, [set]);

  const clearCart = useCallback(() => {
    set('cart', []);
    set('customerName', '');
    set('customerPhone', '');
    set('discountPct', 0);
    set('discountFixed', 0);
    set('paymentMethod', 'CASH');
    set('cashAmount', 0);
    set('onlineAmount', 0);
  }, [set]);

  // Checkout
  const handleCheckout = async () => {
    if (state.cart.length === 0) return toast.error('Cart is empty');
    set('checkoutLoading', true);
    try {
      const payload = {
        items: state.cart.map(c => ({
          productId: c.id,
          color: c.color,
          size: c.size,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          otherCharges: c.otherCharges || 0,
          discountPct: c.discountPct || 0,
          discountFixed: c.discountFixed || 0,
        })),
        customerName: state.customerName || undefined,
        customerPhone: state.customerPhone || undefined,
        paymentMethod: state.paymentMethod,
        cashierName: user?.name || 'Cashier',
        discountPercent: state.discountPct || 0,
        discountFixed: state.discountFixed || 0,
      };
      const res = await api.post('/api/warehouse/sales', payload);
      set('lastSale', res.data);
      clearCart();
      set('showCheckout', false);
      refreshAll();
      toast.success('Sale completed!');
      set('showPrintOptions', true);
      set('pendingPrintSale', res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Checkout failed');
    } finally {
      set('checkoutLoading', false);
    }
  };

  // Returns
  const addToReturnCart = useCallback((item) => {
    set('returnCart', prev => {
      const existing = prev.find(r => r.id === item.id);
      if (existing) {
        return prev.map(r => r.id === item.id ? { ...r, qty: Math.min(r.qty + 1, r.maxQty) } : r);
      }
      return [...prev, { ...item, qty: 1, maxQty: item.maxQty || item.quantity || 1 }];
    });
  }, [set]);

  const handleReturnBarcode = useCallback(async (code) => {
    if (!code || !code.trim()) return;
    try {
      const res = await api.get(`/api/warehouse/barcode/${encodeURIComponent(code.trim())}`);
      const item = res.data;
      if (!item) return toast.error('Product not found');
      // Find matching sale items for this product
      const matching = sales.filter(s =>
        !s.refundedAt && s.items.some(i =>
          i.productName === item.productName &&
          (i.color || null) === (item.color || null) &&
          (i.size || null) === (item.size || null)
        )
      );
      if (matching.length === 0) return toast.error('No sale found for this product');
      // Add from first matching sale
      const saleItem = matching[0].items.find(i =>
        i.productName === item.productName &&
        (i.color || null) === (item.color || null) &&
        (i.size || null) === (item.size || null)
      );
      addToReturnCart({
        id: saleItem.id, name: saleItem.productName, color: saleItem.color, size: saleItem.size,
        quantity: 1, maxQty: saleItem.quantity, unitPrice: saleItem.unitPrice, saleId: matching[0].id
      });
      set('returnBarcodeInput', '');
      toast.success(`Added ${item.productName} to return`);
    } catch {
      toast.error('Barcode not found');
    }
  }, [sales, addToReturnCart, set]);

  useEffect(() => {
    if (state.returnBarcodeInput && state.returnBarcodeInput.length >= 6) {
      const timer = setTimeout(() => handleReturnBarcode(state.returnBarcodeInput), 300);
      return () => clearTimeout(timer);
    }
  }, [state.returnBarcodeInput, handleReturnBarcode]);

  const handleReturnByInvoice = useCallback(async () => {
    if (!state.invoiceReturnInput) return toast.error('Enter receipt number');
    set('invoiceReturnLoading', true);
    try {
      const found = sales.find(s =>
        s.receiptNumber?.toLowerCase().includes(state.invoiceReturnInput.toLowerCase())
      );
      if (!found) return toast.error('Sale not found');
      set('lookedUpReturnSale', found);
      // Pre-fill return cart with all items
      const items = found.items.map(i => ({
        id: i.id, name: i.productName, color: i.color, size: i.size,
        quantity: i.quantity, qty: 0, maxQty: i.quantity,
        unitPrice: i.unitPrice, lineTotal: i.lineTotal, saleId: found.id
      }));
      set('returnCart', items);
    } catch (e) {
      toast.error('Failed to look up invoice');
    } finally {
      set('invoiceReturnLoading', false);
    }
  }, [state.invoiceReturnInput, sales, set]);

  const processReturns = async () => {
    const items = state.returnCart.filter(r => r.qty > 0);
    if (items.length === 0) return toast.error('Select items to return');
    set('returnLoading', true);
    try {
      for (const item of items) {
        const match = products.find(p =>
          p.name === item.name &&
          (p.color || null) === (item.color || null) &&
          (p.size || null) === (item.size || null)
        );
        await api.post('/api/warehouse/returns', {
          productId: match?.id || item.id,
          color: item.color || undefined,
          size: item.size || undefined,
          quantity: item.qty,
          reason: state.returnReason || 'Customer return',
          saleId: item.saleId,
          refundPaymentMethod: state.refundPaymentMethod || 'CASH'
        });
      }
      toast.success(`${items.length} item(s) returned`);
      set('returnCart', []);
      set('returnReason', '');
      set('lookedUpReturnSale', null);
      set('invoiceReturnInput', '');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Return failed');
    } finally {
      set('returnLoading', false);
    }
  };

  const processRefundInvoice = async (sale) => {
    if (!window.confirm('Refund entire invoice? This cannot be undone.')) return;
    set('refundLoading', true);
    try {
      await api.post(`/api/warehouse/sales/${sale.id}/refund`);
      toast.success('Invoice refunded');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed');
    } finally {
      set('refundLoading', false);
    }
  };

  // Print receipt
  const printReceipt = useCallback((sale) => {
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
      ${sale.customerName ? `<p>Customer: ${sale.customerName}${sale.customerPhone ? ` (${sale.customerPhone})` : ''}</p>` : ''}
      <table><tr><th>ITEM</th><th class="right">QTY×PRICE</th><th class="right">TOTAL</th></tr>
      ${(sale.items || []).map(item => `<tr>
        <td>${item.productName}${item.color ? ` (${item.color})` : ''}${item.size ? ` / ${item.size}` : ''}</td>
        <td class="right">${item.quantity}×${formatCurrency(item.unitPrice)}</td>
        <td class="right">${formatCurrency(item.lineTotal)}</td>
      </tr>`).join('')}
      </table>
      <table>
        <tr><td>Subtotal</td><td class="right">${formatCurrency(sale.subtotal)}</td></tr>
        ${sale.discountAmount > 0 ? `<tr><td>Discount</td><td class="right">-${formatCurrency(sale.discountAmount)}</td></tr>` : ''}
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
  }, []);

  const contextValue = useMemo(() => ({
    ...state, set,
    user, products, productsLoading, sales, salesLoading,
    groupedProducts, categories, filteredProducts, cartSummary,
    barcodeRef, returnBarcodeRef,
    refreshAll, refreshProducts, refreshSales,
    handleBarcodeLookup, addToCart, handleAddToCart, confirmConfig, removeFromCart, clearCart,
    handleCheckout, printReceipt,
    handleReturnBarcode, handleReturnByInvoice, addToReturnCart,
    processReturns, processRefundInvoice,
    formatCurrency, genBarcode,
  }), [state, set, user, products, productsLoading, sales, salesLoading,
      groupedProducts, categories, filteredProducts, cartSummary,
      refreshAll, refreshProducts, refreshSales,
      handleBarcodeLookup, addToCart, handleAddToCart, confirmConfig, removeFromCart, clearCart,
      handleCheckout, printReceipt,
      handleReturnBarcode, handleReturnByInvoice, addToReturnCart,
      processReturns, processRefundInvoice]);

  return (
    <WarehousePOSContext.Provider value={contextValue}>
      {children}
    </WarehousePOSContext.Provider>
  );
};

export const useWarehousePOS = () => {
  const ctx = useContext(WarehousePOSContext);
  if (!ctx) throw new Error('useWarehousePOS must be used within WarehousePOSProvider');
  return ctx;
};
