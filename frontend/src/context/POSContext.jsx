import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo, useCallback, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import useCache, { invalidateKey } from '../hooks/useCache';
import { enqueue } from '../utils/syncQueue';
import { debounce } from '../utils/debounce';
import { formatDateTime } from '../utils/dateTime';
import socket from '../socket';

const POSContext = createContext(null);

const STATE_KEYS = [
  'selectedOutlet', 'dashboardRange', 'dashboardDateFrom', 'dashboardDateTo',
  'salesRange', 'salesDateFrom', 'salesDateTo',
  'activeCategory', 'search', 'cart', 'showConfig', 'selectedSize', 'selectedColor', 'selectedQty',
  'discountPct', 'discountFixed', 'orderNumber', 'advanceAmount', 'deliveryEnabled',
  'customerName', 'customerPhone', 'paymentMethod', 'cashAmount', 'onlineAmount',
  'showCheckout', 'checkoutLoading', 'lastSale',
  'showPrintOptions', 'pendingPrintSale', 'printOpts',
  'lookedUpOrder', 'faisalTake', 'tab', 'barcodeInput',
  'returnTab', 'returnBarcodeInput', 'returnCart', 'returnReason', 'refundPaymentMethod',
  'returnLoading', 'returnProductSearch', 'receiptSearch',
  'historySearchResults', 'historySearchLoading',
  'invoiceReturnInput', 'invoiceReturnLoading', 'lookedUpReturnSale', 'refundLoading',
  'employeeName', 'employeePassword', 'employeeLoggedIn',
  'currentBook', 'bookLoading', 'openBookLoading', 'showCloseBook', 'closeBookSummary',
  'summaryLoading', 'transferCashAmount', 'closeBookLoading', 'showBookReminder',
  'showPaymentDetail', 'showEmployeeDetail', 'showAuthModal', 'authMode',
  'authEmployee', 'authPassword', 'authError', 'verifiedCloser',
  'balanceInvoices', 'balanceInvoicesLoading', 'selectedBalanceInvoice',
  'showPayBalanceModal', 'payAmount', 'balancePaymentMethod', 'balanceCashAmount', 'balanceOnlineAmount', 'paying',
  'balanceCollectionRange', 'balanceCollectionDateFrom', 'balanceCollectionDateTo',
    'balanceCollectionData', 'balanceHistory', 'showBalanceHistoryModal',
    'lastBalancePayment', 'loadingBalanceAction', 'bookPrintOpts',
    'createOrderNumber', 'generatedOrderNumber',
    'createAlterationNumber', 'generatedAlterationNumber',
    'createEngravingNumber', 'generatedEngravingNumber',
    'additionalNote',
  ];

function posReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE': {
      const { key, value } = action;
      const newValue = typeof value === 'function' ? value(state[key]) : value;
      let newState = { ...state, [key]: newValue };
      if (key === 'paymentMethod' && newValue !== 'CASH_ONLINE') {
        newState.cashAmount = 0;
        newState.onlineAmount = 0;
      }
      return newState;
    }
    default:
      return state;
  }
}

function createInitialState(user) {
  const n = (user?.name || '').toLowerCase();
  const isJR = n.includes('jail');
  const isAB = n.includes('abbottabad');
  return {
    selectedOutlet: user?.role !== 'OUTLET' ? 'Johar Town' : isJR ? 'Jail Road' : isAB ? 'Abbottabad' : 'Johar Town',
    dashboardRange: 'all',
    dashboardDateFrom: '',
    dashboardDateTo: '',
    salesRange: 'all',
    salesDateFrom: '',
    salesDateTo: '',
    activeCategory: (() => { try { return localStorage.getItem('pos_active_category') || ''; } catch { return ''; } })(),
    search: '',
    cart: (() => { try { const c = localStorage.getItem('pos_cart'); return c ? JSON.parse(c) : []; } catch { return []; } })(),
    showConfig: null,
    selectedSize: '',
    selectedColor: '',
    selectedQty: 1,
    discountPct: (() => { const v = localStorage.getItem('pos_discount_pct'); return v ? parseFloat(v) : 0; })(),
    discountFixed: (() => { const v = localStorage.getItem('pos_discount_fixed'); return v ? parseFloat(v) : 0; })(),
    orderNumber: '',
    advanceAmount: 0,
    deliveryEnabled: false,
    customerName: (() => { try { return localStorage.getItem('pos_customer_name') || ''; } catch { return ''; } })(),
    customerPhone: (() => { try { return localStorage.getItem('pos_customer_phone') || ''; } catch { return ''; } })(),
    paymentMethod: (() => { try { return localStorage.getItem('pos_payment_method') || ''; } catch { return ''; } })(),
    cashAmount: 0,
    onlineAmount: 0,
    showCheckout: false,
    checkoutLoading: false,
    lastSale: null,
    showPrintOptions: false,
    pendingPrintSale: null,
    printOpts: { invoice: true, gatePass: true },
    lookedUpOrder: null,
    faisalTake: false,
    tab: 'pos',
    barcodeInput: '',
    returnTab: 'scan',
    returnBarcodeInput: '',
    returnCart: [],
    returnReason: 'Customer return',
    refundPaymentMethod: 'CASH',
    returnLoading: false,
    returnProductSearch: '',
    receiptSearch: '',
    historySearchResults: null,
    historySearchLoading: false,
    invoiceReturnInput: '',
    invoiceReturnLoading: false,
    lookedUpReturnSale: null,
    refundLoading: false,
    employeeName: (() => { try { return localStorage.getItem('pos_employee_name') || ''; } catch { return ''; } })(),
    employeePassword: '',
    employeeLoggedIn: (() => { try { return localStorage.getItem('pos_employee_logged_in') === 'true'; } catch { return false; } })(),
    currentBook: null,
    bookLoading: true,
    openBookLoading: false,
    showCloseBook: false,
    closeBookSummary: null,
    summaryLoading: false,
    transferCashAmount: 0,
    closeBookLoading: false,
    showBookReminder: false,
    showPaymentDetail: null,
    showEmployeeDetail: null,
    showAuthModal: false,
    authMode: null,
    authEmployee: '',
    authPassword: '',
    authError: '',
    verifiedCloser: null,
    balanceInvoices: [],
    balanceInvoicesLoading: false,
    selectedBalanceInvoice: null,
    showPayBalanceModal: false,
    payAmount: 0,
    balancePaymentMethod: 'CASH',
    balanceCashAmount: 0,
    balanceOnlineAmount: 0,
    paying: false,
    balanceCollectionRange: 'today',
    balanceCollectionDateFrom: '',
    balanceCollectionDateTo: '',
    balanceCollectionData: null,
    balanceHistory: [],
    showBalanceHistoryModal: false,
    lastBalancePayment: null,
    loadingBalanceAction: false,
    bookPrintOpts: { thermal: false, a4: false },
    createOrderNumber: false,
    generatedOrderNumber: '',
    createAlterationNumber: false,
    generatedAlterationNumber: '',
    createEngravingNumber: false,
    generatedEngravingNumber: '',
    additionalNote: '',
  };
}

export function POSProvider({ children }) {
  const { user } = useAuth();

  const [state, dispatch] = useReducer(posReducer, user, createInitialState);

  const setters = useMemo(() => {
    const s = {};
    STATE_KEYS.forEach(key => {
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      s[`set${cap}`] = (valueOrFn) => dispatch({ type: 'SET_STATE', key, value: valueOrFn });
    });
    return s;
  }, []);

  const {
    selectedOutlet, dashboardRange, dashboardDateFrom, dashboardDateTo,
    salesRange, salesDateFrom, salesDateTo,
    activeCategory, search, cart, showConfig, selectedSize, selectedColor, selectedQty,
    discountPct, discountFixed, orderNumber, advanceAmount, deliveryEnabled,
    customerName, customerPhone, paymentMethod, cashAmount, onlineAmount,
    showCheckout, checkoutLoading, lastSale,
    showPrintOptions, pendingPrintSale, printOpts,
    lookedUpOrder, faisalTake, tab, barcodeInput,
    returnTab, returnBarcodeInput, returnCart, returnReason,
    refundPaymentMethod, returnLoading,
    returnProductSearch, receiptSearch,
    historySearchResults, historySearchLoading,
    invoiceReturnInput, invoiceReturnLoading, lookedUpReturnSale, refundLoading,
    employeeName, employeePassword, employeeLoggedIn,
    currentBook, bookLoading, openBookLoading, showCloseBook, closeBookSummary,
    summaryLoading, transferCashAmount, closeBookLoading, showBookReminder,
    showPaymentDetail, showEmployeeDetail, showAuthModal, authMode,
    authEmployee, authPassword, authError, verifiedCloser,
    balanceInvoices, balanceInvoicesLoading, selectedBalanceInvoice,
    showPayBalanceModal, payAmount, balancePaymentMethod, balanceCashAmount, balanceOnlineAmount, paying,
    balanceCollectionRange, balanceCollectionDateFrom, balanceCollectionDateTo,
    balanceCollectionData, balanceHistory, showBalanceHistoryModal,
    lastBalancePayment, loadingBalanceAction, bookPrintOpts,
    createOrderNumber, generatedOrderNumber,
    createAlterationNumber, generatedAlterationNumber,
    createEngravingNumber, generatedEngravingNumber,
    additionalNote,
  } = state;

  const {
    setSelectedOutlet, setDashboardRange, setDashboardDateFrom, setDashboardDateTo,
    setSalesRange, setSalesDateFrom, setSalesDateTo,
    setActiveCategory, setSearch, setCart, setShowConfig, setSelectedSize, setSelectedColor, setSelectedQty,
    setDiscountPct, setDiscountFixed, setOrderNumber, setAdvanceAmount, setDeliveryEnabled,
    setCustomerName, setCustomerPhone, setPaymentMethod, setCashAmount, setOnlineAmount,
    setShowCheckout, setCheckoutLoading, setLastSale,
    setShowPrintOptions, setPendingPrintSale, setPrintOpts,
    setLookedUpOrder, setFaisalTake, setTab, setBarcodeInput,
    setReturnTab, setReturnBarcodeInput, setReturnCart, setReturnReason,
    setRefundPaymentMethod, setReturnLoading, setReturnProductSearch,
    setReceiptSearch, setHistorySearchResults, setHistorySearchLoading, setInvoiceReturnInput, setInvoiceReturnLoading,
    setLookedUpReturnSale, setRefundLoading,
    setEmployeeName, setEmployeePassword, setEmployeeLoggedIn,
    setCurrentBook, setBookLoading, setOpenBookLoading, setShowCloseBook,
    setCloseBookSummary, setSummaryLoading, setTransferCashAmount, setCloseBookLoading,
    setShowBookReminder, setShowPaymentDetail, setShowEmployeeDetail,
    setShowAuthModal, setAuthMode, setAuthEmployee, setAuthPassword, setAuthError,
    setVerifiedCloser, setBalanceInvoices, setBalanceInvoicesLoading,
    setSelectedBalanceInvoice, setShowPayBalanceModal, setPayAmount,
    setBalancePaymentMethod, setBalanceCashAmount, setBalanceOnlineAmount, setPaying, setBalanceCollectionRange,
    setBalanceCollectionDateFrom, setBalanceCollectionDateTo, setBalanceCollectionData,
    setBalanceHistory, setShowBalanceHistoryModal, setLastBalancePayment,
    setLoadingBalanceAction, setBookPrintOpts,
    setCreateOrderNumber, setGeneratedOrderNumber,
    setCreateAlterationNumber, setGeneratedAlterationNumber,
    setCreateEngravingNumber, setGeneratedEngravingNumber,
    setAdditionalNote,
  } = setters;

  const CACHE_VERSION = 'v3';
  const productsKey = `pos:products:${CACHE_VERSION}:${selectedOutlet}`;
  const dashboardKey = `pos:dashboard:${CACHE_VERSION}:${selectedOutlet}:${dashboardRange}:${dashboardDateFrom}:${dashboardDateTo}`;
  const salesKey = `pos:sales:${CACHE_VERSION}:${selectedOutlet}`;
  const returnsKey = `pos:returns:${CACHE_VERSION}:${selectedOutlet}`;

  const { data: products = [], loading: productsLoading, refresh: refreshProducts, invalidate: invalidateProducts } = useCache(productsKey, {
    fetcher: () => api.get(`/api/pos/products?outlet=${selectedOutlet}`).then(r => r.data),
    ttl: 5 * 60 * 1000,
  });
  const { data: dashboard = null, loading: dashboardLoading, error: dashboardError, refresh: refreshDashboard } = useCache(dashboardKey, {
    fetcher: () => api.get('/api/pos/sales/dashboard', {
      params: { outlet: selectedOutlet, range: dashboardRange, dateFrom: dashboardDateFrom || undefined, dateTo: dashboardDateTo || undefined }
    }).then(r => r.data),
    ttl: 30000,
  });
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

  // History multi-search: invoice/receipt number, customer name, or customer phone.
  // Debounced server query over the ENTIRE POS database (ignores the selected date range).
  const historySearchRef = useRef(0);
  const historySearchDebounceRef = useRef(null);
  useEffect(() => {
    const q = (receiptSearch || '').trim();
    if (historySearchDebounceRef.current) clearTimeout(historySearchDebounceRef.current);
    if (!q) {
      historySearchRef.current++;
      setHistorySearchResults(null);
      setHistorySearchLoading(false);
      return;
    }
    setHistorySearchLoading(true);
    const reqId = ++historySearchRef.current;
    historySearchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/pos/sales', { params: { outlet: selectedOutlet, search: q } });
        if (historySearchRef.current === reqId) {
          setHistorySearchResults(res.data);
          setHistorySearchLoading(false);
        }
      } catch (err) {
        if (historySearchRef.current === reqId) {
          setHistorySearchResults(null);
          setHistorySearchLoading(false);
        }
      }
    }, 350);
    return () => { if (historySearchDebounceRef.current) clearTimeout(historySearchDebounceRef.current); };
  }, [receiptSearch, selectedOutlet, setHistorySearchResults, setHistorySearchLoading]);

  const barcodeRef = useRef(null);

  // Employee list + login now backed by the centralized DB (Software Settings)
  const [employeeList, setEmployeeList] = useState([]);
  const [employeeListLoading, setEmployeeListLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    setEmployeeListLoading(true);
    try {
      const res = await api.get(`/api/outlet-orders/employees?outlet=${encodeURIComponent(selectedOutlet)}&profile=POS`);
      setEmployeeList(res.data?.employees || []);
    } catch {
      setEmployeeList([]);
    } finally {
      setEmployeeListLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const employees = useMemo(() => Object.fromEntries(employeeList.map(e => [e.name, { label: e.name }])), [employeeList]);

  const loginEmployee = useCallback(async (name, password) => {
    if (!name) return { ok: false, message: 'Select an employee' };
    if (!password) return { ok: false, message: 'Enter password' };
    try {
      const res = await api.post('/api/software-settings/verify-employee', { name, password, outlet: selectedOutlet, profile: 'POS' });
      if (res.data?.ok) {
        setEmployeeName(name);
        setEmployeeLoggedIn(true);
        setEmployeePassword('');
        return { ok: true, message: `${name} logged in` };
      }
      return { ok: false, message: 'Login failed' };
    } catch (err) {
      return { ok: false, message: err.response?.data?.message || 'Login failed' };
    }
  }, [selectedOutlet, setEmployeeName, setEmployeePassword, setEmployeeLoggedIn]);

  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const barcodeMap = useMemo(() => {
    const map = new Map();
    products.forEach(p => { if (p.barcode) map.set(p.barcode, p); });
    return map;
  }, [products]);

  useEffect(() => { localStorage.setItem('pos_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('pos_discount_pct', discountPct.toString()); }, [discountPct]);
  useEffect(() => { localStorage.setItem('pos_discount_fixed', discountFixed.toString()); }, [discountFixed]);
  useEffect(() => { localStorage.setItem('pos_customer_name', customerName); }, [customerName]);
  useEffect(() => { localStorage.setItem('pos_customer_phone', customerPhone); }, [customerPhone]);
  useEffect(() => { localStorage.setItem('pos_payment_method', paymentMethod); }, [paymentMethod]);
  useEffect(() => { localStorage.setItem('pos_active_category', activeCategory); }, [activeCategory]);
  useEffect(() => { localStorage.setItem('pos_employee_name', employeeLoggedIn ? employeeName : ''); }, [employeeLoggedIn, employeeName]);
  useEffect(() => { localStorage.setItem('pos_employee_logged_in', employeeLoggedIn ? 'true' : 'false'); }, [employeeLoggedIn]);

  useEffect(() => {
    const val = orderNumber.trim();
    if (!val) { setLookedUpOrder(null); return; }
    const isPhone = /^[\d\+\-\s]{7,}$/.test(val);
    const param = isPhone ? `phone=${encodeURIComponent(val)}` : `orderNumber=${encodeURIComponent(val)}`;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/pos/order-lookup?${param}`);
        if (res.data.paid) { toast.info(res.data.message); setLookedUpOrder(null); return; }
        setLookedUpOrder(res.data);
        setAdvanceAmount(parseFloat(res.data.advanceAmount) || 0);
        setCustomerName(res.data.customerName || '');
        const orderItems = res.data.productDetails || [];
        if (orderItems.length > 0) {
          const newCartItems = [];
          orderItems.forEach(oi => {
            const pd = oi.productDetails || oi;
            const prodName = pd.productType || oi.productName || '';
            const prodColor = pd.color || '';
            const prodSize = pd.size || '';
            const qty = oi.quantity || 1;
            const unitPrice = oi.unitPrice || 0;
            const match = products.find(p => p.name.toLowerCase() === prodName.toLowerCase() && (!prodColor || p.color === prodColor) && (!prodSize || p.size === prodSize));
            if (match) {
              newCartItems.push({ variantId: match.id, productName: match.name, size: match.size || null, color: match.color || null, unitPrice: match.price || 0, qty, alterationAmount: 0, alterationLabel: '', discountPct: 0, discountFixed: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false, otherCharges: 0, isExchange: false });
            } else {
              newCartItems.push({ variantId: null, productName: prodName, size: prodSize || null, color: prodColor || null, unitPrice: unitPrice || 0, qty, alterationAmount: 0, alterationLabel: '', discountPct: 0, discountFixed: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false, otherCharges: 0, isExchange: false });
            }
          });
          setCart(prev => {
            const merged = [...prev];
            newCartItems.forEach(ni => {
              const existing = merged.find(i => i.variantId === ni.variantId);
              if (existing) existing.qty += ni.qty;
              else merged.push(ni);
            });
            return merged;
          });
        }
      } catch (e) {
        if (e?.response?.status === 404) { setLookedUpOrder(null); }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [orderNumber, products]);

  const handleInventoryUpdate = debounce(() => { invalidateProducts(); refreshProducts(); }, 1000);
  useEffect(() => {
    socket.on('inventory-updated', handleInventoryUpdate);
    const onFocus = () => { refreshProducts(); };
    window.addEventListener('focus', onFocus);
    return () => { socket.off('inventory-updated', handleInventoryUpdate); window.removeEventListener('focus', onFocus); };
  }, []);

  const fetchCurrentBook = useCallback(async () => {
    setBookLoading(true);
    try {
      const res = await api.get(`/api/pos/book/current?outlet=${selectedOutlet}`);
      setCurrentBook(res.data?.status === 'OPEN' ? res.data : null);
    } catch { setCurrentBook(null); }
    setBookLoading(false);
  }, [selectedOutlet]);

  useEffect(() => { fetchCurrentBook(); }, [fetchCurrentBook]);
  useEffect(() => {
    const checkTime = () => {
      const h = new Date().getHours();
      if (h >= 21 && currentBook) setShowBookReminder(true);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [currentBook]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && barcodeInput && tab === 'pos' && document.activeElement === barcodeRef.current) {
        handleBarcodeLookup(barcodeInput);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [barcodeInput, tab]);

  const handleBarcodeLookup = async (code) => {
    if (!employeeLoggedIn) {
      toast.error('Please login employee first');
      setBarcodeInput('');
      if (barcodeRef.current) barcodeRef.current.focus();
      return;
    }
    if (!code) { if (barcodeRef.current) barcodeRef.current.focus(); return; }
    code = code.trim();
    let v = barcodeMap.get(code);
    if (!v) {
      const upper = code.toUpperCase();
      for (const [key, val] of barcodeMap) {
        if (key.toUpperCase() === upper) { v = val; break; }
      }
    }
    try {
      const res = await api.get(`/api/pos/barcode/${encodeURIComponent(code)}?outlet=${selectedOutlet}`);
      if (res.data) v = { id: res.data.id, productName: res.data.productName, color: res.data.color, size: res.data.size, price: res.data.price || 0, stock: res.data.stock };
    } catch (e) { console.warn(`Barcode API lookup failed for "${code}":`, e?.response?.data || e.message); }
    if (!v) {
      toast.error(`Barcode not found: ${code}`);
      setBarcodeInput('');
      if (barcodeRef.current) barcodeRef.current.focus();
      return;
    }
    if (v.stock != null && v.stock < 1) toast(`"${v.productName}" is out of stock — use Exchange toggle to process as return`);
    const existing = cart.find(i => i.variantId === v.id);
    if (existing) {
      setCart(cart.map(i => i.variantId === v.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCart([...cart, { variantId: v.id, productName: v.productName, size: v.size, color: v.color, unitPrice: v.price || 0, qty: 1, alterationAmount: 0, alterationLabel: '', discountPct: 0, discountFixed: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false, otherCharges: 0, isExchange: false }]);
    }
    toast.success(`${v.productName} added via barcode`);
    setBarcodeInput('');
    if (barcodeRef.current) barcodeRef.current.focus();
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

  const handleReturnBarcodeLookup = async (code) => {
    if (!code) return;
    code = code.trim();
    let v = barcodeMap.get(code);
    if (!v) {
      const upper = code.toUpperCase();
      for (const [key, val] of barcodeMap) {
        if (key.toUpperCase() === upper) { v = val; break; }
      }
    }
    if (!v) {
      try {
        const res = await api.get(`/api/pos/barcode/${encodeURIComponent(code)}?outlet=${selectedOutlet}`);
        if (res.data) v = { id: res.data.id, productName: res.data.productName, color: res.data.color, size: res.data.size, price: res.data.price || 0, stock: res.data.stock };
      } catch (e) { console.warn(`Return barcode lookup failed for "${code}":`, e?.response?.data || e.message); }
    }
    if (!v) return toast.error(`Barcode not found: ${code}`);
    const existing = returnCart.find(i => i.variantId === v.id);
    if (existing) {
      setReturnCart(returnCart.map(i => i.variantId === v.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setReturnCart([...returnCart, { variantId: v.id, productName: v.productName, color: v.color, size: v.size, barcode: code, unitPrice: v.price, qty: 1, maxQty: 9999 }]);
    }
    toast.success(`${v.productName} added to return cart`);
    setReturnBarcodeInput('');
  };

  const handleAddToCart = (product) => {
    if (!employeeLoggedIn) return toast.error('Please login employee first');
    if (product.stock != null && product.stock <= 0) toast(`"${product.name}" is out of stock — use Exchange toggle to process as return`);
    const hasColors = product.colors?.length > 0;
    const hasSizes = product.sizes?.length > 0;
    if (hasColors || hasSizes) {
      setShowConfig(product);
      setSelectedSize('');
      setSelectedColor('');
      setSelectedQty(1);
      refreshProducts();
    } else {
      setCart([...cart, { variantId: product.id, productName: product.name, size: product.size || null, color: product.color || null, unitPrice: product.price || 0, qty: 1, alterationAmount: 0, alterationLabel: '', discountPct: 0, discountFixed: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false, otherCharges: 0, isExchange: false }]);
      toast.success(`${product.name} added`);
    }
  };

  const confirmConfig = () => {
    if (!employeeLoggedIn) return toast.error('Please login employee first');
    const product = showConfig;
    if (selectedQty < 1) return toast.error('Quantity must be at least 1');
    const matchColor = (v) => !selectedColor || v.color === selectedColor;
    const matchSize = (v) => !selectedSize || v.size === selectedSize;
    const hasSize = (v) => v.size != null && v.size !== '';
    const inStock = (v) => v.stock != null && v.stock >= selectedQty;
    let variant = products.find(v => v.name === product.name && matchColor(v) && matchSize(v) && inStock(v));
    if (!variant && !selectedSize) variant = products.find(v => v.name === product.name && matchColor(v) && hasSize(v) && inStock(v));
    if (!variant) variant = products.find(v => v.name === product.name && matchColor(v) && matchSize(v));
    if (!variant) return toast.error('Variant not found');
    if (!inStock(variant)) return toast.error(`Only ${variant.stock} in stock for ${variant.name}` + (variant.color ? ` (${variant.color})` : '') + (variant.size ? ` ${variant.size}` : ''));
    setCart([...cart, { variantId: variant.id, productName: product.name, size: variant.size, color: variant.color, unitPrice: variant.price || product.price || 0, qty: selectedQty, alterationAmount: 0, alterationLabel: '', discountPct: 0, discountFixed: 0, customization1: false, customization2: false, nameEngrave: false, logoDesign: false, otherCharges: 0, isExchange: false }]);
    setShowConfig(null);
    toast.success(`${product.name} added`);
  };

  const removeCartItem = (i) => setCart(cart.filter((_, idx) => idx !== i));
  const updateQty = (i, qty) => { if (qty < 1) return; const copy = [...cart]; copy[i] = { ...copy[i], qty }; setCart(copy); };
  const updateAlteration = (i, label, amount) => { const copy = [...cart]; copy[i] = { ...copy[i], alterationLabel: label, alterationAmount: amount }; setCart(copy); };
  const updateCartDiscount = (i, field, value) => { const copy = [...cart]; copy[i] = { ...copy[i], [field]: value }; setCart(copy); };
  const updateCartCustomization = (i, field) => { const copy = [...cart]; copy[i] = { ...copy[i], [field]: !copy[i][field] }; setCart(copy); };
  const updateCartExchange = (i) => { const copy = [...cart]; copy[i] = { ...copy[i], isExchange: !copy[i].isExchange }; setCart(copy); };

  const cardChargesPct = paymentMethod === 'CARD' ? 2 : 0;

  const nonExchangeCart = useMemo(() => cart.filter(i => !i.isExchange), [cart]);

  const subtotal = useMemo(() => nonExchangeCart.reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * i.qty, 0), [nonExchangeCart]);
  const altCharges = useMemo(() => nonExchangeCart.reduce((s, i) => s + (parseFloat(i.alterationAmount) || 0) * i.qty, 0), [nonExchangeCart]);
  const cust1Total = useMemo(() => nonExchangeCart.reduce((s, i) => s + (i.customization1 ? 500 : 0) * i.qty, 0), [nonExchangeCart]);
  const cust2Total = useMemo(() => nonExchangeCart.reduce((s, i) => s + (i.customization2 ? 1000 : 0) * i.qty, 0), [nonExchangeCart]);
  const engraveTotal = useMemo(() => nonExchangeCart.reduce((s, i) => s + (i.nameEngrave ? 300 : 0) * i.qty, 0), [nonExchangeCart]);
  const logoDesignTotal = useMemo(() => nonExchangeCart.reduce((s, i) => s + (i.logoDesign ? 300 : 0) * i.qty, 0), [nonExchangeCart]);
  const otherChargesTotal = useMemo(() => nonExchangeCart.reduce((s, i) => s + (parseFloat(i.otherCharges) || 0), 0), [nonExchangeCart]);
  const perItemDiscount = useMemo(() => nonExchangeCart.reduce((s, i) => s + ((parseFloat(i.discountPct) || 0) / 100 * parseFloat(i.unitPrice) + (parseFloat(i.discountFixed) || 0)) * i.qty, 0), [nonExchangeCart]);
  const deliveryCharge = deliveryEnabled ? 250 : 0;
  const globalDiscountAmt = useMemo(() => {
    const afterItemD = Math.max(0, subtotal + altCharges + cust1Total + cust2Total + engraveTotal + logoDesignTotal + otherChargesTotal - perItemDiscount);
    return (discountPct / 100 * afterItemD) + discountFixed;
  }, [subtotal, altCharges, cust1Total, cust2Total, engraveTotal, logoDesignTotal, otherChargesTotal, perItemDiscount, discountPct, discountFixed]);
  const cardChargesAmt = useMemo(() => {
    const afterDiscount = Math.max(0, subtotal + altCharges + cust1Total + cust2Total + engraveTotal + logoDesignTotal + otherChargesTotal - perItemDiscount - globalDiscountAmt);
    return paymentMethod === 'CARD' ? Math.round(afterDiscount * cardChargesPct / 100) : 0;
  }, [subtotal, altCharges, cust1Total, cust2Total, engraveTotal, logoDesignTotal, otherChargesTotal, perItemDiscount, globalDiscountAmt, paymentMethod, cardChargesPct]);

  // Exchange-related memo values (based on ALL cart items for display + grandTotal deduction)
  const exchangeItemsTotal = useMemo(() =>
    cart.filter(i => i.isExchange).reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * i.qty, 0),
  [cart]);
  const newItemsTotal = useMemo(() =>
    cart.filter(i => !i.isExchange).reduce((s, i) => s + (parseFloat(i.unitPrice) || 0) * i.qty, 0),
  [cart]);
  const exchangeDiff = useMemo(() => newItemsTotal - exchangeItemsTotal, [newItemsTotal, exchangeItemsTotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal + altCharges + cust1Total + cust2Total + engraveTotal + logoDesignTotal + otherChargesTotal - perItemDiscount - globalDiscountAmt + cardChargesAmt + deliveryCharge - exchangeItemsTotal);
  }, [subtotal, altCharges, cust1Total, cust2Total, engraveTotal, logoDesignTotal, otherChargesTotal, perItemDiscount, globalDiscountAmt, cardChargesAmt, deliveryCharge, exchangeItemsTotal]);

  useEffect(() => {
    if (paymentMethod === 'CASH_ONLINE' && grandTotal > 0) {
      const c = parseFloat(cashAmount) || 0;
      setOnlineAmount(Math.max(0, Math.round((grandTotal - c) * 100) / 100));
    }
  }, [grandTotal, paymentMethod]);

  const filteredSales = useMemo(() => {
    const q = (receiptSearch || '').trim();
    if (!q) return sales;
    // Instant pass over the currently loaded list (date window).
    const ql = q.toLowerCase();
    const local = sales.filter(s =>
      (s.receiptNumber || '').toLowerCase().includes(ql)
      || (s._invoiceNumber || '').toLowerCase().includes(ql)
      || (s.orderNumber || '').toLowerCase().includes(ql)
      || (s.customerName || '').toLowerCase().includes(ql)
      || (s.customerPhone || '').toLowerCase().includes(ql)
    );
    // Once the whole-DB server search lands, use it as authoritative.
    if (historySearchResults !== null) return historySearchResults;
    return local;
  }, [sales, receiptSearch, historySearchResults]);

  const filteredProducts = useMemo(() => {
    let f = products;
    if (activeCategory) f = f.filter(p => p.category === activeCategory);
    if (search) { const s = search.toLowerCase(); f = f.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.toLowerCase().includes(s))); }
    return f;
  }, [products, activeCategory, search]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    filteredProducts.forEach(p => {
      const key = p.name;
      if (!groups[key]) groups[key] = { id: key, name: key, price: p.price, imageUrl: p.imageUrl, category: p.category, totalStock: 0, colors: [], sizes: [], variants: [] };
      groups[key].variants.push(p);
      groups[key].totalStock += p.stock || 0;
      if (p.color && !groups[key].colors.includes(p.color)) groups[key].colors.push(p.color);
      if (p.size && !groups[key].sizes.includes(p.size)) groups[key].sizes.push(p.size);
    });
    return Object.values(groups);
  }, [filteredProducts]);

  const handleCheckout = useCallback(async () => {
    if (cart.length === 0) return;
    if (!employeeLoggedIn) return toast.error('Please select employee and enter password first');
    if (!faisalTake && !customerPhone.trim()) return toast.error('Customer phone is required');
    if (!paymentMethod) return toast.error('Please select a payment method before completing the checkout');
    if (paymentMethod === 'CASH_ONLINE') {
      const cash = parseFloat(cashAmount) || 0;
      const online = parseFloat(onlineAmount) || 0;
      if (Math.abs(cash + online - grandTotal) > 0.01) return toast.error(`Cash+Online total (₨${(cash + online).toLocaleString()}) must equal invoice amount (₨${grandTotal.toLocaleString()})`);
    }
    setCheckoutLoading(true);
    for (const c of cart) {
      if (c.isExchange) continue; // exchange items return to stock — no stock check needed
      const pr = products.find(p => p.id === c.variantId);
      if (!pr) { setCheckoutLoading(false); return toast.error(`"${c.productName}" not found in outlet inventory`); }
      if (pr.stock != null && pr.stock < c.qty) { setCheckoutLoading(false); return toast.error(`"${c.productName}" has only ${pr.stock} in stock (need ${c.qty})`); }
    }
    // Generate numbers — alteration number serves as both order + alteration number
    let orderNum = null;
    let alterationNum = null;
    let engravingNum = null;
    if (createAlterationNumber) {
      try {
        const altRes = await api.get('/api/alterations/generate-number');
        alterationNum = altRes.data.alterationNumber;
        orderNum = alterationNum; // unified: same number for both
      } catch { /* proceed without alteration number */ }
    } else if (createOrderNumber) {
      try {
        const ordRes = await api.get('/api/outlet-orders/generate-number');
        orderNum = ordRes.data.orderNumber;
      } catch { /* proceed without order number */ }
    }
    if (createEngravingNumber) {
      try {
        const engRes = await api.get('/api/engravings/generate-number');
        engravingNum = engRes.data.engravingNumber;
      } catch { /* proceed without engraving number */ }
    }
    const payload = {
      items: cart.map(i => ({ variantId: i.variantId, quantity: i.qty, unitPrice: i.unitPrice, alterationCharges: i.alterationAmount, discountPct: parseFloat(i.discountPct) || 0, discountFixed: parseFloat(i.discountFixed) || 0, customization1: i.customization1 || false, customization2: i.customization2 || false, nameEngrave: i.nameEngrave || false, logoDesign: i.logoDesign || false, otherCharges: parseFloat(i.otherCharges) || 0, isExchange: i.isExchange || false })),
      customerName: customerName || null, customerPhone: customerPhone || null,
      extraCharges: 0, discountPercent: discountPct, discountFixed: discountFixed,
      advanceAmount: parseFloat(advanceAmount) || 0, deliveryCharges: deliveryCharge,
      cardChargesPct: parseFloat(cardChargesPct) || 0, orderId: lookedUpOrder?.id || null,
      paymentMethod, receiptNumber: orderNumber || undefined, outlet: selectedOutlet,
      cashierName: employeeName, faisalTake,
      cashAmount: parseFloat(cashAmount) || 0, onlineAmount: parseFloat(onlineAmount) || 0,
      orderNumber: orderNum || undefined,
      additionalNote: additionalNote || undefined,
    };
    try {
      const res = await api.post(`/api/pos/sales?outlet=${selectedOutlet}`, payload);
      const saleData = { ...res.data, orderNumber: orderNum, alterationNumber: alterationNum, engravingNumber: engravingNum };
      if (faisalTake) {
        setLastSale({ ...saleData, isFaisalTake: true });
      } else {
        setLastSale(saleData);
      }
      setShowCheckout(true);
      setCart([]); setDiscountPct(0); setDiscountFixed(0); setAdvanceAmount(0);
      setDeliveryEnabled(false); setCashAmount(0); setOnlineAmount(0); setPaymentMethod('');
      setLookedUpOrder(null); setCustomerName(''); setCustomerPhone(''); setOrderNumber('');
      setFaisalTake(false); setAdditionalNote('');
      invalidateKey(productsKey); invalidateKey(dashboardKey); invalidateKey(salesKey); invalidateKey(returnsKey);
      toast.success(faisalTake ? 'Faisal Take recorded!' : 'Sale completed!');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error('Checkout failed: ' + msg);
      if (err.response?.status === 400) { invalidateProducts(); setCheckoutLoading(false); return; }
      await enqueue('sale', 'create', payload);
    }
    setCheckoutLoading(false);
  }, [cart, products, customerName, customerPhone, discountPct, discountFixed, advanceAmount, cardChargesPct, lookedUpOrder, paymentMethod, cashAmount, onlineAmount, orderNumber, selectedOutlet, employeeLoggedIn, faisalTake, employeeName, productsKey, dashboardKey, salesKey, returnsKey, deliveryCharge, grandTotal, createOrderNumber, createAlterationNumber, createEngravingNumber, additionalNote]);

  const handleReturn = async (variantId) => {
    const qty = prompt('Return quantity:');
    if (!qty || parseInt(qty) < 1) return;
    try {
      await api.post(`/api/pos/returns?outlet=${selectedOutlet}`, { variantId, quantity: parseInt(qty), reason: 'Customer return' });
      toast.success('Return processed, stock updated');
      refreshProducts(); refreshDashboard(); refreshSales(); refreshReturns();
    } catch (err) { toast.error(err.response?.data?.message || 'Return failed'); }
  };

  const processReturns = async () => {
    if (returnCart.length === 0) return;
    setReturnLoading(true);
    try {
      for (const item of returnCart) {
        await api.post(`/api/pos/returns?outlet=${selectedOutlet}`, { variantId: item.variantId, quantity: item.qty, reason: returnReason, saleId: item.saleId || undefined, refundPaymentMethod });
      }
      toast.success(`${returnCart.reduce((s, i) => s + i.qty, 0)} item(s) returned successfully`);
      setReturnCart([]); setReturnReason('Customer return'); setRefundPaymentMethod('CASH');
      refreshProducts(); refreshDashboard(); refreshSales(); refreshReturns();
    } catch (err) { toast.error(err.response?.data?.message || 'Return failed'); }
    setReturnLoading(false);
  };

  const handleInvoiceLookup = async () => {
    const input = invoiceReturnInput.trim();
    if (!input) return;
    setInvoiceReturnLoading(true);
    setLookedUpReturnSale(null);
    try {
      const res = await api.get(`/api/pos/sales?outlet=${selectedOutlet}&search=${encodeURIComponent(input)}`);
      const sale = res.data?.[0];
      if (!sale) return toast.error('Invoice not found');
      setLookedUpReturnSale(sale);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to look up invoice'); }
    setInvoiceReturnLoading(false);
  };

  const handleRefundInvoice = async (sale) => {
    if (!window.confirm(`Refund full invoice ${sale.receiptNumber} for ₨${sale.grandTotal?.toLocaleString()}? This cannot be undone.`)) return;
    setRefundLoading(true);
    try {
      await api.post(`/api/pos/sales/${sale.id}/refund`);
      toast.success('Invoice fully refunded');
      setLookedUpReturnSale(null); setInvoiceReturnInput('');
      refreshProducts(); refreshDashboard(); refreshSales(); refreshReturns();
    } catch (e) { toast.error(e.response?.data?.message || 'Refund failed'); }
    setRefundLoading(false);
  };

  const handleRefundInvoiceFromHistory = async (sale) => {
    if (!window.confirm(`Refund full invoice ${sale.receiptNumber} for ₨${sale.grandTotal?.toLocaleString()}? All items will be returned to inventory.`)) return;
    try {
      await api.post(`/api/pos/sales/${sale.id}/refund`);
      toast.success('Invoice fully refunded');
      refreshProducts(); refreshDashboard(); refreshSales(); refreshReturns();
    } catch (e) { toast.error(e.response?.data?.message || 'Refund failed'); }
  };

  const handleOpenBook = async (openedBy) => {
    setOpenBookLoading(true);
    try {
      const res = await api.post('/api/pos/book/open', { outlet: selectedOutlet, employeeName: openedBy });
      setCurrentBook(res.data);
      toast.success('Register opened successfully');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to open register'); }
    setOpenBookLoading(false);
  };

  const handleFetchCloseBookSummary = async (closedBy) => {
    if (!currentBook) return;
    setVerifiedCloser(closedBy);
    setSummaryLoading(true);
    setShowCloseBook(true);
    try {
      const res = await api.get(`/api/pos/book/${currentBook.id}/summary?outlet=${selectedOutlet}`);
      setCloseBookSummary(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch summary');
      setShowCloseBook(false);
    }
    setSummaryLoading(false);
  };

  const handleCloseBook = async () => {
    if (!currentBook || !closeBookSummary) return;
    setCloseBookLoading(true);
    try {
      const closedBy = verifiedCloser || user?.name || 'Unknown';
      const summary = { ...closeBookSummary, transferredCash: parseFloat(transferCashAmount) || 0, remainingCash: closeBookSummary.availableCash - (parseFloat(transferCashAmount) || 0) };
      await api.post(`/api/pos/book/${currentBook.id}/close`, { closedBy, summary });
      setCloseBookSummary(null); setShowCloseBook(false); setCurrentBook(null);
      setTransferCashAmount(0); setVerifiedCloser(null);
      toast.success('Register closed successfully');
      if (bookPrintOpts.thermal || bookPrintOpts.a4) {
        const { printCloseBook } = await import('../utils/POSPrint');
        printCloseBook(summary, { ...bookPrintOpts, closedBy }, currentBook, selectedOutlet, transferCashAmount);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to close register'); }
    setCloseBookLoading(false);
  };

  const downloadExcel = useCallback(async () => {
    try {
      const src = filteredSales;
      const fmtPayment = (s) => s.paymentMethod === 'CASH_ONLINE' ? 'Cash+Online' : s.paymentMethod === 'CASH' ? 'Cash' : s.paymentMethod === 'CARD' ? 'Card' : s.paymentMethod === 'ONLINE' ? 'Online' : s.paymentMethod || '';

      let journalEntries = [];
      try {
        const params = { outlet: selectedOutlet };
        if (salesDateFrom) params.dateFrom = salesDateFrom;
        if (salesDateTo) params.dateTo = salesDateTo;
        if (!salesDateFrom && !salesDateTo && salesRange !== 'all') params.range = salesRange;
        const res = await api.get('/api/pos/journal-entries', { params });
        journalEntries = res.data || [];
      } catch (e) { /* silent */ }

      const totalGeneralEntries = journalEntries.reduce((sum, ge) => sum + (ge.amount || 0), 0);

      const data = src.map(s => ({
        'Receipt #': s.receiptNumber || '',
        'Date': formatDateTime(s.createdAt),
        'Cashier': s.cashierName || '',
        'Customer': s.customerName || '',
        'Phone': s.customerPhone || '',
        'Items': (s.items || []).map(i => `${i.productName}${i.color ? ' ('+i.color+')' : ''}${i.size ? ' '+i.size : ''} x${i.quantity}`).join(', '),
        'Subtotal': s.subtotal || 0,
        'Discount': s.discountAmount || 0,
        'Card Charges': s.cardChargesAmount || 0,
        'Cash Amount': s.cashAmount || 0,
        'Online Amount': s.onlineAmount || 0,
        'Grand Total': s._amountReceived || 0,
        'Invoice Total': s.grandTotal || 0,
        'Payment': fmtPayment(s),
        'Advance': s.advanceAmount || 0,
        'Balance': s._balanceRemaining || 0,
        'Order #': s.orderId || '',
        'Status': s.refundedAt ? 'RETURN' : (s._balanceStatus === 'balance' ? 'BALANCE' : '')
      }));

      // Canonical summary from the shared backend endpoint (same source & rules as the
      // Register / Close Book and POS History). Search-mode exports span the whole DB with
      // no date window, so they fall back to a client-side canonical computation over the
      // filtered rows instead. Revenue counts for ALL rows (incl. refunded — the refund is
      // deducted via returnedAmount), matching the backend canonical convention.
      const canonicalSummary = (rows) => {
        let CASH = 0, ONLINE = 0, CARD = 0, CASH_ONLINE = 0;
        rows.forEach(s => {
          const received = s._amountReceived || 0;
          if (s.paymentMethod === 'CASH') CASH += received;
          else if (s.paymentMethod === 'ONLINE') ONLINE += received;
          else if (s.paymentMethod === 'CARD') CARD += received;
          else if (s.paymentMethod === 'CASH_ONLINE') {
            CASH_ONLINE += received;
          } else CASH += received;
        });
        const returnedAmount = rows.flatMap(s => (s.returns || [])).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
        const discountTotal = rows.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
        const receivedTotal = CASH + ONLINE + CARD + CASH_ONLINE;
        return {
          cash: CASH, online: ONLINE, card: CARD, cashOnline: CASH_ONLINE,
          returnedAmount,
          grossSales: receivedTotal + discountTotal,
          discountTotal,
          invoiceCount: rows.length,
        };
      };

      let summary = null;
      if (!(receiptSearch || '').trim()) {
        try {
          const params = { outlet: selectedOutlet, skipCache: 'true' };
          if (salesDateFrom) params.dateFrom = salesDateFrom;
          if (salesDateTo) params.dateTo = salesDateTo;
          if (!salesDateFrom && !salesDateTo && salesRange !== 'all') params.range = salesRange;
          const res = await api.get('/api/pos/sales-summary', { params });
          summary = res.data || null;
        } catch (e) { /* silent fallback below */ }
      }
      if (!summary) summary = canonicalSummary(src);

      const cashPayments = Math.round(summary.cash || 0);
      const onlinePayments = Math.round(summary.online || 0);
      const cardPayments = Math.round(summary.card || 0);
      const cashOnlinePayments = Math.round(summary.cashOnline || 0);
      const grandTotalSales = cashPayments + onlinePayments + cardPayments + cashOnlinePayments;
      const returnedAmount = summary.returnedAmount || 0;
      const discountTotal = summary.discountTotal || 0;
      const invoiceCount = summary.invoiceCount ?? src.length;
      const totalAdvancePayments = src.reduce((sum, s) => sum + (s.advanceAmount || 0), 0);
      const outstandingBalance = src.reduce((sum, s) => sum + (s._outstandingBalance || 0), 0);
      const netCash = cashPayments - totalGeneralEntries;
      const netSales = grandTotalSales - returnedAmount;

      const journalDataRows = journalEntries.map(ge => ({
        'Receipt #': 'GENERAL ENTRY',
        'Date': formatDateTime(ge.createdAt),
        'Cashier': ge.employeeName || '',
        'Customer': ge.expenseTitle || '',
        'Phone': '',
        'Items': ge.notes || '',
        'Subtotal': '',
        'Discount': '',
        'Card Charges': '',
        'Cash Amount': '',
        'Online Amount': '',
        'Grand Total': -(ge.amount || 0),
        'Invoice Total': '',
        'Payment': 'EXPENSE',
        'Advance': '',
        'Balance': '',
        'Order #': '',
        'Status': 'GENERAL'
      }));

      const summaryRows = [
        {}, {},
        { 'Receipt #': 'S U M M A R Y', 'Grand Total': '' },
        { 'Receipt #': 'Invoice Count', 'Grand Total': invoiceCount },
        { 'Receipt #': 'Gross Sales', 'Grand Total': Math.round(summary.grossSales || 0) },
        { 'Receipt #': 'Grand Total Sales (Received)', 'Grand Total': grandTotalSales },
        { 'Receipt #': 'Cash Payments', 'Grand Total': cashPayments },
        { 'Receipt #': 'Online Payments', 'Grand Total': onlinePayments },
        { 'Receipt #': 'Card Payments', 'Grand Total': cardPayments },
        { 'Receipt #': 'Cash + Online Payments', 'Grand Total': cashOnlinePayments },
        { 'Receipt #': 'Total Advance Payments', 'Grand Total': totalAdvancePayments },
        { 'Receipt #': 'Discounts', 'Grand Total': Math.round(discountTotal) },
        { 'Receipt #': 'Outstanding Balance', 'Grand Total': outstandingBalance },
        { 'Receipt #': 'General Entries (Expenses)', 'Grand Total': totalGeneralEntries },
        { 'Receipt #': 'Net Cash', 'Grand Total': netCash },
        { 'Receipt #': 'Returned Amount', 'Grand Total': Math.round(returnedAmount) },
        { 'Receipt #': 'Net Sales', 'Grand Total': Math.round(netSales) },
      ];

      const allRows = [...data, ...journalDataRows, ...summaryRows];
      const ws = XLSX.utils.json_to_sheet(allRows);

      const colWidths = [
        { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
        { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
        { wch: 10 }, { wch: 12 }, { wch: 10 }
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_${selectedOutlet}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (err) {
      console.error('Excel download failed:', err);
      toast.error('Excel download failed');
    }
  }, [sales, receiptSearch, historySearchResults, filteredSales, selectedOutlet, salesRange, salesDateFrom, salesDateTo]);

  const downloadDashboardExcel = useCallback(() => {
    if (!dashboard) return toast.error('No dashboard data to export');
    const kpiRows = [
      { Metric: 'Total Sales', Value: dashboard.totalSales || 0 },
      { Metric: 'Net Revenue', Value: dashboard.netRevenue || 0 },
      { Metric: 'Total Discount', Value: dashboard.totalDiscount || 0 },
      { Metric: 'Returned Orders', Value: dashboard.returnedOrders || 0 },
      { Metric: 'Completed Orders', Value: dashboard.completedOrders || 0 },
      { Metric: 'Pending Orders', Value: dashboard.pendingOrders || 0 },
      { Metric: 'Cancelled Orders', Value: dashboard.cancelledOrders || 0 },
    ];
    const paymentRows = (dashboard.paymentBreakdown || []).map(p => ({ Method: p.method, Gross: p.gross || 0, Returns: p.returns || 0, Net: p.net || 0 }));
    const productRows = (dashboard.bestSellingProducts || []).map(p => ({ Product: p.name, Sold: p.qty }));
    const balanceRows = (dashboard.balanceOrders || []).map(bo => ({ Receipt: bo.receiptNumber, Customer: bo.customerName || '', Payment: bo.paymentMethod || '', 'POS Paid': bo.paid || 0, Advance: bo.advanceAmount || 0, 'Total Paid': bo.totalWithAdvance || 0 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'KPIs');
    if (paymentRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), 'Payment Breakdown');
    if (productRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Top Products');
    if (balanceRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balanceRows), 'Balance Orders');
    XLSX.writeFile(wb, `dashboard_${selectedOutlet}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Dashboard Excel downloaded');
  }, [dashboard, selectedOutlet]);

  const fetchBalanceInvoices = useCallback(async () => {
    setBalanceInvoicesLoading(true);
    try { const res = await api.get(`/api/pos/balance-invoices?outlet=${selectedOutlet}`); setBalanceInvoices(res.data); }
    catch (e) { console.error('Failed to fetch balance invoices:', e); }
    finally { setBalanceInvoicesLoading(false); }
  }, [selectedOutlet]);

  const fetchBalanceCollections = useCallback(async (range, dateFrom, dateTo) => {
    try {
      const params = { outlet: selectedOutlet };
      if (range) params.range = range;
      if (range === 'custom' && dateFrom) params.dateFrom = dateFrom;
      if (range === 'custom' && dateTo) params.dateTo = dateTo;
      const res = await api.get('/api/pos/balance-collections', { params });
      setBalanceCollectionData(res.data);
    } catch (e) { console.error('Failed to fetch balance collections:', e); }
  }, [selectedOutlet]);

  useEffect(() => {
    if (tab === 'dashboard') {
      fetchBalanceInvoices();
      fetchBalanceCollections(balanceCollectionRange, balanceCollectionDateFrom, balanceCollectionDateTo);
    }
  }, [tab, dashboardRange, dashboardDateFrom, dashboardDateTo, balanceCollectionRange, balanceCollectionDateFrom, balanceCollectionDateTo]);

  const handlePayBalanceOpen = async (invoice) => {
    if (!invoice?.id) { toast.error('Invalid invoice'); return; }
    setLoadingBalanceAction(true);
    try {
      const res = await api.get(`/api/pos/balance-invoices/${invoice.id}`, { timeout: 15000 });
      setSelectedBalanceInvoice(res.data);
      setPayAmount(Math.ceil(res.data.remaining));
      setShowPayBalanceModal(true);
    } catch (e) {
      console.error('PayBalanceOpen error:', e?.response?.data || e?.message || e);
      toast.error(e?.response?.data?.message || 'Failed to load invoice details');
    } finally { setLoadingBalanceAction(false); }
  };

  const handlePayBalance = async () => {
    if (!selectedBalanceInvoice || payAmount <= 0) return toast.error('Enter a valid amount');
    if (payAmount > selectedBalanceInvoice.remaining) return toast.error(`Amount exceeds remaining balance of ₨${selectedBalanceInvoice.remaining.toLocaleString()}`);
    if (balancePaymentMethod === 'CASH_ONLINE') {
      if (balanceCashAmount + balanceOnlineAmount <= 0) return toast.error('Enter cash or online amount');
      if (Math.abs((balanceCashAmount + balanceOnlineAmount) - payAmount) > 0.01) return toast.error(`Cash + Online must equal payment amount`);
    }
    setPaying(true);
    try {
      const payload = { amountPaidNow: payAmount, paymentMethod: balancePaymentMethod };
      if (balancePaymentMethod === 'CASH_ONLINE') {
        payload.cashAmount = balanceCashAmount;
        payload.onlineAmount = balanceOnlineAmount;
      }
      const res = await api.post(`/api/pos/balance-invoices/${selectedBalanceInvoice.id}/pay`, payload);
      setLastBalancePayment(res.data);
      setShowPayBalanceModal(false);
      toast.success('Balance payment recorded');
      fetchBalanceInvoices();
      fetchBalanceCollections(balanceCollectionRange, balanceCollectionDateFrom, balanceCollectionDateTo);
    } catch (e) { toast.error(e.response?.data?.message || 'Payment failed'); }
    finally { setPaying(false); }
  };

  const handleViewBalanceHistory = async (invoice) => {
    if (!invoice?.id) { toast.error('Invalid invoice'); return; }
    setLoadingBalanceAction(true);
    try {
      const detailRes = await api.get(`/api/pos/balance-invoices/${invoice.id}`, { timeout: 15000 });
      setSelectedBalanceInvoice(detailRes.data);
      setBalanceHistory(detailRes.data.paymentHistory || []);
      setShowBalanceHistoryModal(true);
    } catch (e) {
      console.error('ViewBalanceHistory error:', e?.response?.data || e?.message || e);
      toast.error(e?.response?.data?.message || 'Failed to load payment history');
    } finally { setLoadingBalanceAction(false); }
  };

  const refreshAll = useCallback(() => {
    invalidateKey(productsKey);
    invalidateKey(dashboardKey);
    invalidateKey(salesKey);
    invalidateKey(returnsKey);
    refreshProducts();
    refreshDashboard();
    refreshSales();
    refreshReturns();
  }, [productsKey, dashboardKey, salesKey, returnsKey]);

  const value = {
    user, selectedOutlet, setSelectedOutlet,
    dashboardRange, setDashboardRange, dashboardDateFrom, setDashboardDateFrom, dashboardDateTo, setDashboardDateTo,
    products, productsLoading, refreshProducts, invalidateProducts,
    dashboard, dashboardLoading, dashboardError, refreshDashboard,
    sales, salesLoading, refreshSales, salesRange, setSalesRange, salesDateFrom, setSalesDateFrom, salesDateTo, setSalesDateTo,
    returns, returnsLoading, refreshReturns,
    activeCategory, setActiveCategory, search, setSearch,
    cart, setCart, showConfig, setShowConfig, selectedSize, setSelectedSize, selectedColor, setSelectedColor, selectedQty, setSelectedQty,
    discountPct, setDiscountPct, discountFixed, setDiscountFixed,
    orderNumber, setOrderNumber, advanceAmount, setAdvanceAmount,
    deliveryEnabled, setDeliveryEnabled, cardChargesPct,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    paymentMethod, setPaymentMethod, cashAmount, setCashAmount, onlineAmount, setOnlineAmount,
    showCheckout, setShowCheckout, checkoutLoading, setCheckoutLoading,
    lastSale, setLastSale,
    showPrintOptions, setShowPrintOptions, pendingPrintSale, setPendingPrintSale, printOpts, setPrintOpts,
    lookedUpOrder, setLookedUpOrder, faisalTake, setFaisalTake,
    tab, setTab, barcodeInput, setBarcodeInput, barcodeRef,
    returnTab, setReturnTab, returnBarcodeInput, setReturnBarcodeInput,
    returnCart, setReturnCart, returnReason, setReturnReason,
    refundPaymentMethod, setRefundPaymentMethod, returnLoading, setReturnLoading,
    returnProductSearch, setReturnProductSearch,
    receiptSearch, setReceiptSearch,
    historySearchResults, setHistorySearchResults, historySearchLoading, setHistorySearchLoading,
    invoiceReturnInput, setInvoiceReturnInput, invoiceReturnLoading, setInvoiceReturnLoading,
    lookedUpReturnSale, setLookedUpReturnSale, refundLoading, setRefundLoading,
    employeeName, setEmployeeName, employeePassword, setEmployeePassword,
    employeeLoggedIn, setEmployeeLoggedIn,
    currentBook, setCurrentBook, bookLoading, setBookLoading,
    openBookLoading, setOpenBookLoading, showCloseBook, setShowCloseBook,
    closeBookSummary, setCloseBookSummary, summaryLoading, setSummaryLoading,
    transferCashAmount, setTransferCashAmount, closeBookLoading, setCloseBookLoading,
    showBookReminder, setShowBookReminder,
    showPaymentDetail, setShowPaymentDetail, showEmployeeDetail, setShowEmployeeDetail,
    showAuthModal, setShowAuthModal, authMode, setAuthMode,
    authEmployee, setAuthEmployee, authPassword, setAuthPassword, authError, setAuthError,
    verifiedCloser, setVerifiedCloser,
    employees, categories, barcodeMap, employeeListLoading, loginEmployee,
    balanceInvoices, setBalanceInvoices, balanceInvoicesLoading, setBalanceInvoicesLoading,
    selectedBalanceInvoice, setSelectedBalanceInvoice,
    showPayBalanceModal, setShowPayBalanceModal, payAmount, setPayAmount,
    balancePaymentMethod, setBalancePaymentMethod, balanceCashAmount, setBalanceCashAmount, balanceOnlineAmount, setBalanceOnlineAmount, paying, setPaying,
    balanceCollectionRange, setBalanceCollectionRange,
    balanceCollectionDateFrom, setBalanceCollectionDateFrom, balanceCollectionDateTo, setBalanceCollectionDateTo,
    balanceCollectionData, setBalanceCollectionData,
    balanceHistory, setBalanceHistory, showBalanceHistoryModal, setShowBalanceHistoryModal,
    lastBalancePayment, setLastBalancePayment, loadingBalanceAction, setLoadingBalanceAction,
    bookPrintOpts, setBookPrintOpts,
    createOrderNumber, setCreateOrderNumber, generatedOrderNumber, setGeneratedOrderNumber,
    createAlterationNumber, setCreateAlterationNumber, generatedAlterationNumber, setGeneratedAlterationNumber,
    createEngravingNumber, setCreateEngravingNumber, generatedEngravingNumber, setGeneratedEngravingNumber,
    additionalNote, setAdditionalNote,
    productsKey, dashboardKey, salesKey, returnsKey,
    subtotal, altCharges, cust1Total, cust2Total, engraveTotal, logoDesignTotal, otherChargesTotal,
    perItemDiscount, deliveryCharge, globalDiscountAmt, cardChargesAmt, grandTotal,
    exchangeItemsTotal, newItemsTotal, exchangeDiff,
    filteredSales, filteredProducts, groupedProducts,
    handleBarcodeLookup, handleAddToCart, confirmConfig, removeCartItem, updateQty,
    updateAlteration, updateCartDiscount, updateCartCustomization, updateCartExchange,
    handleCheckout, handleReturn, processReturns,
    handleInvoiceLookup, handleRefundInvoice, handleReturnBarcodeLookup, handleRefundInvoiceFromHistory,
    handleOpenBook, handleFetchCloseBookSummary, handleCloseBook,
    downloadExcel, downloadDashboardExcel,
    fetchBalanceInvoices, fetchBalanceCollections, handlePayBalanceOpen, handlePayBalance, handleViewBalanceHistory,
    refreshAll, fetchCurrentBook, invalidateKey,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}

export default POSContext;
