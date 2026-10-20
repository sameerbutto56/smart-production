import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, User, Phone, MapPin, ShoppingBag, Ruler, CheckCircle, ChevronLeft, ChevronRight, Plus, X, RefreshCw, Printer, AlertTriangle, Truck, Store, UserCheck, LogOut, Lock, Trash2, Save, FileText, Sparkles } from 'lucide-react';
import { formatDateOnly, formatDateTime, formatTimeOnly } from '../utils/dateTime';
import { printJobSheet } from '../utils/printReport';
import { printOutletOrderThermalSlip } from '../utils/POSPrint';
import {
  SHIRT_MEASUREMENT_FIELDS,
  TROUSER_MEASUREMENT_FIELDS,
  normalizeCustomerMeasurements,
  formatUrduMeasurementNote,
  mergeMeasurementSpecialNote,
  getProductMeasurementType
} from '../utils/measurementUtils';
import toast from 'react-hot-toast';

const STEPS = ['Customer', 'Products', 'Measurements', 'Review'];

const SLEEVE_LENGTH_OPTIONS = [
  { value: 'full', label: 'Full', labelUrdu: 'پوری بازو' },
  { value: 'half', label: 'Half', labelUrdu: 'آدھی بازو' },
  { value: 'three-quarter', label: 'Three-Quarter', labelUrdu: 'تین چوتھائی بازو' }
];

const SHIRT_LENGTH_OPTIONS = [
  { value: 'short', label: 'Short', labelUrdu: 'چھوٹی شرٹ' },
  { value: 'regular', label: 'Regular', labelUrdu: 'نارمل شرٹ' },
  { value: 'long', label: 'Long', labelUrdu: 'لمبی شرٹ' }
];

const THREAD_COLOR_OPTIONS = [
  { value: '', label: 'Standard White' },
  { value: 'Gold', label: 'Metallic Gold' },
  { value: 'Silver', label: 'Polished Silver' },
  { value: 'Navy', label: 'Royal Navy' },
  { value: 'Wine', label: 'Premium Wine' },
  { value: 'Custom', label: 'Custom Color' }
];

const PLACEMENT_OPTIONS = [
  { value: 'LeftChest', label: 'Left Chest' },
  { value: 'RightChest', label: 'Right Chest' }
];

const PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Standard', desc: 'Normal processing time' },
  { value: 'URGENT', label: 'Urgent', desc: 'Priority processing' },
  { value: 'SUPER_URGENT', label: 'Super Urgent', desc: 'Maximum priority' }
];

const FIELD_NAME_MAP = {
  chest: 'Chest', waist: 'Waist', shoulder: 'Shoulder',
  length: 'Length', sleeve: 'Sleeves Length', thigh: 'Thighs',
  mori: 'Mori', bottom: 'Bottom',
  shirtLength: 'Shirt Length', bottomWidth: 'Bottom Width',
  bottomZeer: 'Bottom Zeer', neck: 'Neck', cuff: 'Cuff',
  armhole: 'Armhole', hip: 'Hip', trouserLength: 'Trouser Length',
  sleevesLength: 'Sleeves Length', sleevesHole: 'Sleeves Hole',
  pancha: 'Pancha', thighs: 'Thighs', asan: 'Asan'
};

const EMPTY_PRODUCT = {
  name: '', fabric: '', color: '', size: '', quantity: 1, unitPrice: 0,
  design: '', stitchingNotes: '', accessories: '',
  sleeveLength: '', shirtLength: '', measurementSpecialNote: '',
  gender: 'Male', matchingCap: false, matchingCapQty: 0,
  engravingRequired: false, engravingLines: [''], engravingType: 'direct',
  engravingThreadColor: '', customThreadColor: '', engravingPlacement: 'LeftChest',
  logoEntries: [{ name: '', design: '' }], engravingInstructions: ''
};

// ── Auto-save Persistence Helpers ──
const getDraftStorageKey = (outlet, emp) => {
  const o = (outlet || 'outlet').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  const e = (emp?.id ? `id_${emp.id}` : (emp?.name ? `name_${emp.name}` : 'shared')).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `enamels_outlet_order_draft_${o}_${e}`;
};

const COMPLETED_ORDERS_KEY = 'enamels_completed_orders_registry';

const getCompletedOrdersRegistry = () => {
  try {
    const raw = localStorage.getItem(COMPLETED_ORDERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const markOrderCompletedInRegistry = (num) => {
  if (!num || !String(num).trim()) return;
  try {
    const clean = String(num).trim();
    const existing = getCompletedOrdersRegistry();
    const updated = [clean, ...existing.filter(n => n !== clean)].slice(0, 100);
    localStorage.setItem(COMPLETED_ORDERS_KEY, JSON.stringify(updated));
  } catch {}
};

const hasDraftData = (d) => {
  if (!d || typeof d !== 'object') return false;
  const hasCust = !!(d.customer?.name?.trim() || d.customer?.phone?.trim() || d.customer?.address?.trim() || d.customer?.notes?.trim());
  const hasProds = Array.isArray(d.products) && d.products.length > 0;
  const hasNewProd = !!(d.newProduct?.name?.trim());
  const hasNotes = !!(d.specialNotes?.trim());
  const hasClient = !!d.clientData;
  const hasPayment = !!(d.paymentStatus || (d.advanceAmount && d.advanceAmount > 0) || (d.balanceAmount && String(d.balanceAmount).trim() !== ''));
  return hasCust || hasProds || hasNewProd || hasNotes || hasClient || hasPayment;
};

const readDraft = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const completedRegistry = getCompletedOrdersRegistry();
      if (parsed.orderNumber && completedRegistry.includes(parsed.orderNumber.trim())) {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
      if (parsed.posSaleInfo?.orderNumber && completedRegistry.includes(parsed.posSaleInfo.orderNumber.trim())) {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
      if (parsed.posSaleInfo?.receiptNumber && completedRegistry.includes(parsed.posSaleInfo.receiptNumber.trim())) {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
      const lastCompleted = sessionStorage.getItem('enamels_last_completed_order');
      if (lastCompleted && parsed.orderNumber && parsed.orderNumber.trim() === lastCompleted.trim()) {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
      if (parsed.posSaleInfo?.orderExists) {
        delete parsed.posSaleInfo;
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error reading outlet order draft:', e);
  }
  return null;
};

const OutletOrderEntry = () => {
  const { user } = useAuth();
  const outletName = user?.name || 'Outlet';
  const [searchParams] = useSearchParams();
  const prefilledOrderNumber = searchParams.get('orderNumber') || '';
  const prefilledClientNumber = searchParams.get('clientNumber') || '';
  const prefilledClientId = searchParams.get('clientId') || '';
  const prefilledPhone = searchParams.get('phone') || '';
  const repeatOrderId = searchParams.get('repeatOrderId') || '';

  const employeeOutlet = (() => {
    const n = (user?.name || '').toLowerCase();
    if (n.includes('jail')) return 'Jail Road';
    if (n.includes('abbottabad')) return 'Abbottabad';
    return 'Johar Town';
  })();

  // ── Auto-save Draft helpers & Initial synchronous hydration ──
  const initialEmployee = useMemo(() => {
    try { const s = sessionStorage.getItem('outlet_employee'); return s ? JSON.parse(s) : null; } catch { return null; }
  }, []);
  const initialDraftKey = useMemo(() => {
    return getDraftStorageKey(employeeOutlet, initialEmployee);
  }, [employeeOutlet, initialEmployee]);

  const initialDraft = useMemo(() => {
    return readDraft(initialDraftKey);
  }, [initialDraftKey]);

  // ── Employee login ──
  const [employee, setEmployee] = useState(initialEmployee);
  const [employeeList, setEmployeeList] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const draftKey = useMemo(() => {
    return getDraftStorageKey(employeeOutlet, employee);
  }, [employeeOutlet, employee]);

  const [draftStatus, setDraftStatus] = useState(() => (hasDraftData(initialDraft) ? 'saved' : null));
  const [draftSavedAt, setDraftSavedAt] = useState(() => initialDraft?.savedAt || null);
  const [isDraftRestored, setIsDraftRestored] = useState(() => hasDraftData(initialDraft));
  const isHydratedRef = useRef(true);
  const isOrderSubmittedRef = useRef(false);
  const isDraftClearedRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setEmployeesLoading(true);
    api.get(`/api/outlet-orders/employees?outlet=${encodeURIComponent(employeeOutlet)}&profile=OUTLET_ORDER_ENTRY`)
      .then(res => { if (mounted) setEmployeeList(res.data?.employees || []); })
      .catch(() => { if (mounted) setEmployeeList([]); })
      .finally(() => { if (mounted) setEmployeesLoading(false); });
    return () => { mounted = false; };
  }, [employeeOutlet]);

  const handleEmployeeLogin = useCallback(async () => {
    if (!selectedEmployeeName.trim()) return setLoginError('Select your employee name');
    if (!employeePassword) return setLoginError('Enter your password');
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await api.post('/api/outlet-orders/verify-employee', {
        name: selectedEmployeeName,
        password: employeePassword,
        outlet: employeeOutlet
      });
      if (res.data?.ok) {
        const emp = res.data.employee;
        setEmployee(emp);
        try { sessionStorage.setItem('outlet_employee', JSON.stringify(emp)); } catch {}
        setEmployeePassword('');
        toast.success(`Logged in as ${emp.name}`);
      } else {
        setLoginError(res.data?.message || 'Login failed');
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed');
    }
    setLoggingIn(false);
  }, [selectedEmployeeName, employeePassword, employeeOutlet]);

  const handleEmployeeLogout = useCallback(() => {
    setEmployee(null);
    setSelectedEmployeeName('');
    setEmployeePassword('');
    setLoginError('');
    try { sessionStorage.removeItem('outlet_employee'); } catch {}
  }, []);

  const [step, setStep] = useState(() => (typeof initialDraft?.step === 'number' ? initialDraft.step : 0));

  const [customerMode, setCustomerMode] = useState(() => initialDraft?.customerMode || null);
  const [searchQuery, setSearchQuery] = useState(() => initialDraft?.searchQuery || '');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [clientData, setClientData] = useState(() => initialDraft?.clientData || null);
  const [recentOrders, setRecentOrders] = useState(() => (Array.isArray(initialDraft?.recentOrders) ? initialDraft.recentOrders : []));
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(() => !!initialDraft?.lookedUp);

  const [customer, setCustomer] = useState(() => initialDraft?.customer || { name: '', phone: '', address: '', city: '', notes: '' });

  const [orderNumber, setOrderNumber] = useState(() => prefilledOrderNumber || initialDraft?.orderNumber || '');
  const [generatingNumber, setGeneratingNumber] = useState(false);

  const [products, setProducts] = useState(() => (Array.isArray(initialDraft?.products) ? initialDraft.products : []));
  const [newProduct, setNewProduct] = useState(() => (initialDraft?.newProduct ? { ...EMPTY_PRODUCT, ...initialDraft.newProduct } : { ...EMPTY_PRODUCT }));

  const [specialNotes, setSpecialNotes] = useState(() => initialDraft?.specialNotes || '');

  const [sizeData, setSizeData] = useState(() => initialDraft?.sizeData || {});
  const [clientStandardSizes, setClientStandardSizes] = useState(() => (Array.isArray(initialDraft?.clientStandardSizes) ? initialDraft.clientStandardSizes : []));
  const [clientMeasurements, setClientMeasurements] = useState(() => initialDraft?.clientMeasurements || {});
  const [sizingMode, setSizingMode] = useState(() => initialDraft?.sizingMode || null);
  const [selectedStandardSize, setSelectedStandardSize] = useState(() => initialDraft?.selectedStandardSize || '');
  const [clientMeasurementChart, setClientMeasurementChart] = useState(() => initialDraft?.clientMeasurementChart || '');

  const [advanceAmount, setAdvanceAmount] = useState(() => (initialDraft?.advanceAmount != null ? initialDraft.advanceAmount : 0));
  const [priority, setPriority] = useState(() => initialDraft?.priority || 'NORMAL');
  const [deliveryType, setDeliveryType] = useState(() => initialDraft?.deliveryType || 'DELIVERY');
  const [paymentStatus, setPaymentStatus] = useState(() => initialDraft?.paymentStatus || '');
  const [balanceAmount, setBalanceAmount] = useState(() => (initialDraft?.balanceAmount != null ? String(initialDraft.balanceAmount) : ''));

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const [showJobSheetPreview, setShowJobSheetPreview] = useState(false);
  const [posSaleInfo, setPosSaleInfo] = useState(() => initialDraft?.posSaleInfo || null);
  const [posSaleLoading, setPosSaleLoading] = useState(false);

  // ── Clear saved draft ──
  const clearSavedDraft = useCallback(() => {
    isDraftClearedRef.current = true;
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      localStorage.removeItem(draftKey);
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (k.startsWith('enamels_outlet_order_draft_')) {
          try { localStorage.removeItem(k); } catch {}
        }
      }
    } catch (e) {
      console.error('Error clearing draft:', e);
    }
    setDraftStatus(null);
    setDraftSavedAt(null);
    setIsDraftRestored(false);
  }, [draftKey]);

  const applyDraftState = useCallback((draft) => {
    if (!draft || typeof draft !== 'object') return;
    if (prefilledClientNumber || prefilledClientId || prefilledPhone || repeatOrderId) {
      clearSavedDraft();
      return;
    }
    setStep(typeof draft.step === 'number' ? draft.step : 0);
    setCustomerMode(draft.customerMode || null);
    setSearchQuery(draft.searchQuery || '');
    setLookedUp(!!draft.lookedUp);
    setClientData(draft.clientData || null);
    setRecentOrders(Array.isArray(draft.recentOrders) ? draft.recentOrders : []);
    setCustomer(draft.customer || { name: '', phone: '', address: '', city: '', notes: '' });
    if (draft.orderNumber) setOrderNumber(draft.orderNumber);
    setDeliveryType(draft.deliveryType || 'DELIVERY');
    setPriority(draft.priority || 'NORMAL');
    setProducts(Array.isArray(draft.products) ? draft.products : []);
    if (draft.newProduct) setNewProduct({ ...EMPTY_PRODUCT, ...draft.newProduct });
    setSpecialNotes(draft.specialNotes || '');
    setSizeData(draft.sizeData || {});
    setClientStandardSizes(Array.isArray(draft.clientStandardSizes) ? draft.clientStandardSizes : []);
    setClientMeasurements(draft.clientMeasurements || {});
    setSizingMode(draft.sizingMode || null);
    setSelectedStandardSize(draft.selectedStandardSize || '');
    setClientMeasurementChart(draft.clientMeasurementChart || '');
    setAdvanceAmount(draft.advanceAmount != null ? draft.advanceAmount : 0);
    setBalanceAmount(draft.balanceAmount != null ? String(draft.balanceAmount) : '');
    setPaymentStatus(draft.paymentStatus || '');
    if (draft.posSaleInfo && !draft.posSaleInfo.orderExists) {
      setPosSaleInfo(draft.posSaleInfo);
    } else {
      setPosSaleInfo(null);
    }
    setDraftSavedAt(draft.savedAt || null);
    setDraftStatus('saved');
    setIsDraftRestored(true);
  }, [prefilledClientNumber, prefilledClientId, prefilledPhone, repeatOrderId, clearSavedDraft]);

  // ── Auto-purge draft if its orderNumber was already placed and exists in database ──
  useEffect(() => {
    const draftNum = initialDraft?.orderNumber;
    const posNum = initialDraft?.posSaleInfo?.orderNumber || initialDraft?.posSaleInfo?.receiptNumber;
    const checkTarget = draftNum || posNum;
    if (checkTarget && String(checkTarget).trim().length >= 3) {
      api.get(`/api/outlet-orders/order-lookup/${encodeURIComponent(String(checkTarget).trim())}`)
        .then(res => {
          if (res.data?.found && res.data?.order) {
            markOrderCompletedInRegistry(checkTarget);
            if (draftNum) markOrderCompletedInRegistry(draftNum);
            clearSavedDraft();
            resetAll();
          }
        })
        .catch(() => {});
    }
  }, [initialDraft?.orderNumber, initialDraft?.posSaleInfo]);

  // ── When employee logs in, restore their saved draft if found ──
  useEffect(() => {
    if (!employee || isOrderSubmittedRef.current || submitted) return;
    const key = getDraftStorageKey(employeeOutlet, employee);
    const empDraft = readDraft(key);
    if (hasDraftData(empDraft)) {
      if (prefilledClientNumber || prefilledClientId || prefilledPhone || repeatOrderId) {
        clearSavedDraft();
        return;
      }
      const draftNum = empDraft.orderNumber;
      const posNum = empDraft.posSaleInfo?.orderNumber || empDraft.posSaleInfo?.receiptNumber;
      const checkTarget = draftNum || posNum;
      if (checkTarget && String(checkTarget).trim().length >= 3) {
        api.get(`/api/outlet-orders/order-lookup/${encodeURIComponent(String(checkTarget).trim())}`)
          .then(res => {
            if (res.data?.found && res.data?.order) {
              markOrderCompletedInRegistry(checkTarget);
              if (draftNum) markOrderCompletedInRegistry(draftNum);
              clearSavedDraft();
              resetAll();
              return;
            }
            applyDraftState(empDraft);
          })
          .catch(() => {
            applyDraftState(empDraft);
          });
      } else {
        applyDraftState(empDraft);
      }
    }
  }, [employee, employeeOutlet, submitted, prefilledClientNumber, prefilledClientId, prefilledPhone, repeatOrderId, applyDraftState, clearSavedDraft]);

  // ── Auto-save Draft Effect ──
  useEffect(() => {
    if (!isHydratedRef.current || submitted || isOrderSubmittedRef.current) return;
    if (isDraftClearedRef.current) return;

    const currentData = {
      step,
      customerMode,
      searchQuery,
      lookedUp,
      clientData,
      recentOrders,
      customer,
      orderNumber,
      deliveryType,
      priority,
      products,
      newProduct,
      specialNotes,
      sizeData,
      clientStandardSizes,
      clientMeasurements,
      sizingMode,
      selectedStandardSize,
      clientMeasurementChart,
      advanceAmount,
      paymentStatus,
      balanceAmount,
      posSaleInfo
    };

    if (!hasDraftData(currentData)) {
      return;
    }

    setDraftStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (isOrderSubmittedRef.current || isDraftClearedRef.current || submitted) return;
        const payload = {
          ...currentData,
          savedAt: new Date().toISOString(),
          version: 1
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
        setDraftStatus('saved');
        setDraftSavedAt(payload.savedAt);
      } catch (err) {
        console.error('Error saving draft to localStorage:', err);
        setDraftStatus('error');
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    draftKey, submitted, step, customerMode, searchQuery, lookedUp, clientData,
    recentOrders, customer, orderNumber, deliveryType, priority, products,
    newProduct, specialNotes, sizeData, clientStandardSizes, clientMeasurements,
    sizingMode, selectedStandardSize, clientMeasurementChart, advanceAmount,
    paymentStatus, balanceAmount, posSaleInfo
  ]);

  // ── Flush on BeforeUnload / Component Unmount ──
  useEffect(() => {
    const flushDraft = () => {
      if (!isHydratedRef.current || submitted || isOrderSubmittedRef.current) return;
      if (isDraftClearedRef.current) return;
      const currentData = {
        step, customerMode, searchQuery, lookedUp, clientData, recentOrders,
        customer, orderNumber, deliveryType, priority, products, newProduct,
        specialNotes, sizeData, clientStandardSizes, clientMeasurements,
        sizingMode, selectedStandardSize, clientMeasurementChart, advanceAmount,
        paymentStatus, balanceAmount, posSaleInfo
      };
      if (hasDraftData(currentData)) {
        try {
          if (isOrderSubmittedRef.current || isDraftClearedRef.current || submitted) return;
          localStorage.setItem(draftKey, JSON.stringify({
            ...currentData,
            savedAt: new Date().toISOString(),
            version: 1
          }));
        } catch {}
      }
    };

    window.addEventListener('beforeunload', flushDraft);
    return () => {
      window.removeEventListener('beforeunload', flushDraft);
      if (!isOrderSubmittedRef.current && !submitted && !isDraftClearedRef.current) {
        flushDraft();
      }
    };
  }, [
    draftKey, submitted, step, customerMode, searchQuery, lookedUp, clientData,
    recentOrders, customer, orderNumber, deliveryType, priority, products,
    newProduct, specialNotes, sizeData, clientStandardSizes, clientMeasurements,
    sizingMode, selectedStandardSize, clientMeasurementChart, advanceAmount,
    paymentStatus, balanceAmount, posSaleInfo
  ]);

  const fetchPosSaleData = useCallback(async (targetNum) => {
    const q = (targetNum || '').trim();
    if (!q || q.length < 3) return;
    setPosSaleLoading(true);
    try {
      const res = await api.get(`/api/outlet-orders/pos-sale-lookup/${encodeURIComponent(q)}`);
      const data = res.data;
      if (data && data.found) {
        if (data.orderExists) {
          toast.error(`Order ${data.orderNumber || q} (Receipt: ${data.receiptNumber || 'N/A'}) was already placed in the database. Starting a fresh order.`);
          setPosSaleInfo(null);
          generateNewOrderNumber();
          return;
        }
        setPosSaleInfo(data);
        // Pre-fill customer info (fully editable)
        if (data.customerName || data.customerPhone) {
          setCustomer(prev => ({
            ...prev,
            name: data.customerName || prev.name,
            phone: data.customerPhone || prev.phone
          }));
          setCustomerMode('new');
        }
        // Pre-fill products from POS items
        if (Array.isArray(data.items) && data.items.length > 0) {
          setProducts(
            data.items.map((it, idx) => ({
              _tempId: Date.now() + idx,
              name: it.productName || 'Scrubs',
              fabric: '',
              color: it.color || '',
              size: it.size || '',
              quantity: it.quantity || 1,
              unitPrice: it.unitPrice || 0,
              gender: 'Male',
              matchingCap: false,
              matchingCapQty: 0,
              engravingRequired: false,
              stitchingNotes: '',
              measurementSpecialNote: ''
            }))
          );
        }
        // Pre-fill financial amounts
        const isPaidStatus = String(data.paymentStatus || '').toUpperCase() === 'PAID' || (data.balanceAmount != null && parseFloat(data.balanceAmount) <= 0.01);
        const grandTot = data.grandTotal || 0;
        const paid = isPaidStatus ? grandTot : (data.paidAmount != null ? data.paidAmount : (data.advanceAmount || 0));
        const bal = isPaidStatus ? 0 : (data.balanceAmount != null ? data.balanceAmount : Math.max(0, grandTot - paid));
        setAdvanceAmount(paid);
        setBalanceAmount(bal > 0 ? String(bal) : '0');
        setPaymentStatus(isPaidStatus || bal <= 0.01 ? 'PAID' : 'BALANCE');
        toast.success(`POS Bill connected: ${data.customerName || 'Customer'} (Total: ₨${grandTot.toLocaleString()}, Paid: ₨${paid.toLocaleString()}, Balance: ₨${bal.toLocaleString()})`);
      }
    } catch (e) {
      // not a fatal error
    } finally {
      setPosSaleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (prefilledOrderNumber) {
      setOrderNumber(prefilledOrderNumber);
      if (!initialDraft || initialDraft.orderNumber !== prefilledOrderNumber || !initialDraft.products?.length) {
        fetchPosSaleData(prefilledOrderNumber);
      }
    }
  }, [prefilledOrderNumber, fetchPosSaleData, initialDraft]);

  useEffect(() => {
    if (!prefilledOrderNumber && !orderNumber) {
      const gen = async () => {
        setGeneratingNumber(true);
        try {
          const res = await api.get('/api/outlet-orders/generate-number');
          if (res.data?.orderNumber) setOrderNumber(res.data.orderNumber);
        } catch {}
        setGeneratingNumber(false);
      };
      gen();
    }
  }, [prefilledOrderNumber, orderNumber]);

  const generateNewOrderNumber = useCallback(async () => {
    setGeneratingNumber(true);
    try {
      const res = await api.get('/api/outlet-orders/generate-number');
      if (res.data?.orderNumber) {
        setOrderNumber(res.data.orderNumber);
        toast.success(`Generated: ${res.data.orderNumber}`);
      }
    } catch {
      toast.error('Failed to generate order number');
    }
    setGeneratingNumber(false);
  }, []);

  const handleLookup = useCallback(async () => {
    const q = (searchQuery || '').trim();
    if (!q) return toast.error('Enter phone number, name, address, or client #');
    setLookupLoading(true);
    setLookedUp(false);
    setClientData(null);
    setRecentOrders([]);
    setShowResults(false);
    try {
      const isPhone = /^[\d\-+ ]{7,}$/.test(q);
      const params = { q, ...(isPhone ? { phone: q } : { name: q }) };
      const res = await api.get('/api/outlet-orders/lookup', { params });
      const { clients } = res.data;
      if (clients.length === 1) {
        selectClient(clients[0].client, clients[0].recentOrders);
      } else {
        setSearchResults(clients);
        setShowResults(true);
        if (clients.length === 0) toast('Client not found — try a different search');
      }
      setLookedUp(true);
    } catch (err) {
      if (err.response?.status === 404) {
        setLookedUp(true);
        setClientData(null);
        toast('Client not found — try a different search');
      } else {
        toast.error('Lookup failed');
      }
    }
    setLookupLoading(false);
  }, [searchQuery]);

  const applyMeasurementsToProducts = useCallback((measurementsToApply) => {
    const meas = measurementsToApply || clientMeasurements;
    if (!meas || typeof meas !== 'object') return;
    const hasAny = Object.keys(meas).filter(k => k !== '_extra').some(k => meas[k]) || (Array.isArray(meas._extra) && meas._extra.length > 0);
    if (!hasAny) return;

    setProducts(prev => prev.map(p => {
      const pType = getProductMeasurementType(p.name);
      const urduNote = formatUrduMeasurementNote(meas, pType);
      if (!urduNote) return p;
      const updatedNote = mergeMeasurementSpecialNote(p.measurementSpecialNote || '', urduNote);
      return { ...p, measurementSpecialNote: updatedNote };
    }));
  }, [clientMeasurements]);

  const selectClient = useCallback((client, orders) => {
    setPosSaleInfo(null);
    setClientData(client);
    setShowResults(false);
    setSearchResults([]);
    setRecentOrders(orders || []);
    setCustomer({
      name: client.name || '',
      phone: client.phone || '',
      address: client.permanentAddress || '',
      city: client.city || (Array.isArray(client.deliveryAddresses) ? client.deliveryAddresses[0] : '') || '',
      notes: ''
    });

    const sizes = client.standardSizes || [];
    const chart = client.measurementChart || '';
    setClientStandardSizes(sizes);
    setClientMeasurementChart(chart);

    let loaded = false;
    let hasCustomFromDetails = false;
    let hasStandardFromDetails = false;
    let preSelectedSize = '';
    setSizeData({});
    setClientMeasurements({});

    // 1. Normalize customer's actual saved measurements from client.sizeDetails
    const normalizedMeasurements = normalizeCustomerMeasurements(client.sizeDetails);
    const hasCustomInClient = Object.keys(normalizedMeasurements).filter(k => k !== '_extra').some(k => normalizedMeasurements[k]);

    if (hasCustomInClient || (Array.isArray(normalizedMeasurements._extra) && normalizedMeasurements._extra.length > 0)) {
      setClientMeasurements(normalizedMeasurements);
      hasCustomFromDetails = true;
      loaded = true;
      applyMeasurementsToProducts(normalizedMeasurements);
    } else if (typeof client.sizeDetails === 'string' && client.sizeDetails.trim() && !client.sizeDetails.startsWith('{')) {
      hasStandardFromDetails = true;
      preSelectedSize = client.sizeDetails.trim().toUpperCase();
    }

    // 2. Only if the customer has NO saved measurements in their profile, and past orders exist, check previous orders as a fallback
    // Never overwrite existing customer database measurements with orders[0].sizeData!
    if (!loaded && orders && orders.length > 0 && orders[0].sizeData) {
      try {
        const raw = typeof orders[0].sizeData === 'string' ? JSON.parse(orders[0].sizeData) : orders[0].sizeData;
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
          const normalizedOrderMeasurements = normalizeCustomerMeasurements(raw);
          const hasInOrder = Object.keys(normalizedOrderMeasurements).filter(k => k !== '_extra').some(k => normalizedOrderMeasurements[k]);
          if (hasInOrder) {
            setClientMeasurements(normalizedOrderMeasurements);
            hasCustomFromDetails = true;
            loaded = true;
            applyMeasurementsToProducts(normalizedOrderMeasurements);
          }
        }
      } catch {}
    }

    const hasStandardOption = chart !== 'Custom Measurements' && (sizes.length > 0 || hasStandardFromDetails);
    const hasCustom = hasCustomFromDetails || chart === 'Custom Measurements';
    setSelectedStandardSize(preSelectedSize);
    if (hasCustom) setSizingMode('custom');
    else if (hasStandardOption) setSizingMode('standard');
    else setSizingMode(null);

    toast.success(`Client ${client.name} loaded`);
  }, [applyMeasurementsToProducts]);

  // ── Auto-load client when navigated with clientNumber, clientId, phone or repeatOrderId ──
  const clientLoadedRef = useRef(false);
  useEffect(() => {
    if (clientLoadedRef.current) return;
    const clientTarget = prefilledClientNumber || prefilledClientId || prefilledPhone;
    if (!clientTarget) return;

    const loadPrefilledClient = async () => {
      clientLoadedRef.current = true;
      setCustomerMode('existing');
      setLookupLoading(true);
      setPosSaleInfo(null);
      if (!repeatOrderId) {
        setProducts([]);
        setAdvanceAmount(0);
        setBalanceAmount('');
        setPaymentStatus('');
      }
      try {
        const params = prefilledClientId
          ? { id: prefilledClientId }
          : prefilledClientNumber
          ? { number: prefilledClientNumber }
          : { phone: prefilledPhone };

        const res = await api.get('/api/outlet-orders/lookup', { params });
        const { clients } = res.data;
        if (Array.isArray(clients) && clients.length > 0) {
          const target = clients[0];
          selectClient(target.client, target.recentOrders);
          setSearchQuery(target.client.phone || target.client.clientNumber || '');
          setLookedUp(true);

          // If repeatOrderId is present, find that past order and populate products/customizations
          if (repeatOrderId && Array.isArray(target.recentOrders)) {
            const pastOrder = target.recentOrders.find(o => o.id === repeatOrderId || o.orderNumber === repeatOrderId);
            if (pastOrder) {
              let pastProducts = [];
              try {
                pastProducts = typeof pastOrder.productDetails === 'string'
                  ? JSON.parse(pastOrder.productDetails)
                  : (Array.isArray(pastOrder.productDetails) ? pastOrder.productDetails : []);
              } catch {}

              if (pastProducts.length > 0) {
                setProducts(pastProducts.map((p, idx) => ({
                  _tempId: Date.now() + idx,
                  name: p.name || p.productType || 'Custom Scrub',
                  fabric: p.fabric || p.fabricType || '',
                  color: p.color || '',
                  size: p.size || '',
                  quantity: parseInt(p.quantity) || 1,
                  unitPrice: parseFloat(p.unitPrice || p.price) || 0,
                  design: p.design || '',
                  stitchingNotes: p.stitchingNotes || '',
                  accessories: p.accessories || '',
                  sleeveLength: p.sleeveLength || '',
                  shirtLength: p.shirtLength || '',
                  gender: p.gender || 'Male',
                  matchingCap: !!p.matchingCap,
                  matchingCapQty: parseInt(p.matchingCapQty) || 0,
                  capCharges: p.matchingCap ? (parseInt(p.matchingCapQty) || 0) * 500 : 0,
                  engravingRequired: !!p.engravingRequired,
                  engravingType: p.engravingType || 'direct',
                  engravingLines: Array.isArray(p.engravingLines) ? p.engravingLines : [],
                  engravingThreadColor: p.engravingThreadColor || '',
                  engravingPlacement: p.engravingPlacement || 'LeftChest',
                  logoEntries: Array.isArray(p.logoEntries) ? p.logoEntries : [],
                  engravingInstructions: p.engravingInstructions || ''
                })));
                toast.success(`Repeated past order items for Customer #${target.client.clientNumber}`);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to prefill client:', err);
      } finally {
        setLookupLoading(false);
      }
    };

    loadPrefilledClient();
  }, [prefilledClientNumber, prefilledClientId, prefilledPhone, repeatOrderId, selectClient]);

  const handleStartNewCustomer = useCallback(() => {
    setCustomerMode('new');
    setClientData(null);
    setRecentOrders([]);
    setPosSaleInfo(null);
    setProducts([]);
    setAdvanceAmount(0);
    setBalanceAmount('');
    setPaymentStatus('');
    setCustomer({ name: '', phone: '', address: '', city: '', notes: '' });
    setSizeData({});
    setClientMeasurements({});
    setClientStandardSizes([]);
    setSizingMode(null);
    setSelectedStandardSize('');
    setClientMeasurementChart('');
  }, []);

  const handleStartExistingCustomer = useCallback(() => setCustomerMode('existing'), []);

  const addProduct = useCallback(() => {
    if (!newProduct.name.trim()) return toast.error('Enter product name');
    let initialNote = newProduct.measurementSpecialNote || '';
    const pType = getProductMeasurementType(newProduct.name);
    const urduNote = formatUrduMeasurementNote(clientMeasurements, pType);
    if (urduNote) {
      initialNote = mergeMeasurementSpecialNote(initialNote, urduNote);
    }
    setProducts(prev => [...prev, { ...newProduct, measurementSpecialNote: initialNote, _tempId: Date.now() + Math.random() }]);
    setNewProduct({ ...EMPTY_PRODUCT });
  }, [newProduct, clientMeasurements]);

  const removeProduct = useCallback((idx) => setProducts(prev => prev.filter((_, i) => i !== idx)), []);

  const updateNewProduct = useCallback((field, value) => {
    setNewProduct(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateProductField = useCallback((idx, field, value) => {
    setProducts(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }, []);

  const CAP_UNIT_PRICE = 500;
  const handleDisconnectPosSale = useCallback(() => {
    setPosSaleInfo(null);
    toast.success('POS Bill disconnected. Order total and payments are now calculated from current items.');
  }, []);

  const totalAmount = useMemo(() => {
    if (posSaleInfo?.grandTotal > 0) return posSaleInfo.grandTotal;
    const prodTotal = products.reduce((sum, p) => {
      const line = (parseFloat(p.unitPrice) || 0) * (p.quantity || 1);
      const cap = p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0;
      return sum + line + cap;
    }, 0);
    return prodTotal;
  }, [products, posSaleInfo]);
  const advance = parseFloat(advanceAmount) || 0;
  const balance = paymentStatus === 'PAID' ? 0 : Math.max(0, totalAmount - advance);

  // Synchronize financial amounts with totalAmount and paymentStatus
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      setAdvanceAmount(totalAmount);
      setBalanceAmount('0');
    } else if (paymentStatus === 'BALANCE') {
      const adv = parseFloat(advanceAmount) || 0;
      if (adv > 0 && adv < totalAmount) {
        setBalanceAmount(String(totalAmount - adv));
      } else if (balanceAmount !== '' && balanceAmount != null) {
        const bal = parseFloat(balanceAmount) || 0;
        if (bal > 0 && bal <= totalAmount) {
          setAdvanceAmount(Math.max(0, totalAmount - bal));
        } else {
          setBalanceAmount(String(totalAmount));
          setAdvanceAmount(0);
        }
      } else {
        setBalanceAmount(String(totalAmount));
        setAdvanceAmount(0);
      }
    }
  }, [totalAmount, paymentStatus]);

  const handleSelectPaid = useCallback(() => {
    setPaymentStatus('PAID');
    setAdvanceAmount(totalAmount);
    setBalanceAmount('0');
  }, [totalAmount]);

  const handleSelectBalance = useCallback(() => {
    setPaymentStatus('BALANCE');
    const currentAdv = parseFloat(advanceAmount) || 0;
    if (currentAdv >= totalAmount && totalAmount > 0) {
      setAdvanceAmount(0);
      setBalanceAmount(String(totalAmount));
    } else {
      const newBal = Math.max(0, totalAmount - currentAdv);
      setBalanceAmount(newBal > 0 ? String(newBal) : String(totalAmount));
    }
  }, [advanceAmount, totalAmount]);

  const handleAdvanceChange = useCallback((val) => {
    const newPaid = Math.max(0, parseFloat(val) || 0);
    setAdvanceAmount(newPaid);
    const newBal = Math.max(0, totalAmount - newPaid);
    setBalanceAmount(newBal > 0 ? String(newBal) : '0');
    if (newBal <= 0 && newPaid >= totalAmount && totalAmount > 0) {
      setPaymentStatus('PAID');
    } else {
      setPaymentStatus('BALANCE');
    }
  }, [totalAmount]);

  const handleBalanceChange = useCallback((val) => {
    setBalanceAmount(val);
    const newBal = Math.max(0, parseFloat(val) || 0);
    const newPaid = Math.max(0, totalAmount - newBal);
    setAdvanceAmount(newPaid);
    if (newBal <= 0 && totalAmount > 0) {
      setPaymentStatus('PAID');
    } else {
      setPaymentStatus('BALANCE');
    }
  }, [totalAmount]);

  const canProceed = useMemo(() => {
    const hasOrderNumber = orderNumber.trim().length > 0;
    switch (step) {
      case 0:
        if (customerMode === 'existing') return lookedUp && clientData && customer.name.trim().length > 0 && hasOrderNumber;
        if (customerMode === 'new') return customer.name.trim().length > 0 && customer.phone.trim().length > 0 && hasOrderNumber;
        return false;
      case 1: return products.length > 0;
      case 2: return true;
      case 3:
        if (paymentStatus === 'PAID') return true;
        if (paymentStatus === 'BALANCE') {
          const amt = parseFloat(balanceAmount);
          return balanceAmount != null && String(balanceAmount).trim() !== '' && !isNaN(amt) && amt > 0;
        }
        return false;
      case 4: return true;
      default: return false;
    }
  }, [step, customerMode, lookedUp, clientData, customer, products, orderNumber, paymentStatus, balanceAmount]);

  const nextStep = () => { if (canProceed) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const buildCustomization = useCallback(() => {
    const anyEngraving = products.some(p => p.engravingRequired);
    if (!anyEngraving) {
      return { articleNames: [], nameSpelling: '', nameColor: '', logoColor: '', logoPlacement: '', designNotes: '', designReference: '', additionalFeatures: [], logos: [], engravingType: '', skipEngraving: true };
    }
    const names = [];
    const logos = [];
    products.forEach(p => {
      if (!p.engravingRequired) return;
      const pNames = (p.engravingLines || []).filter(l => l && l.trim());
      const pLogos = (p.logoEntries || []).filter(l => l.name?.trim() || l.design?.trim());
      const label = p.name ? `${p.name}: ` : '';
      names.push(...pNames.map(n => `${label}${n}`));
      logos.push(...pLogos.map(l => `${label}${l.name}${l.design ? ' — ' + l.design : ''}`));
    });
    return {
      articleNames: names,
      nameSpelling: names.join(', '),
      nameColor: '',
      logoColor: '',
      logoPlacement: '',
      designNotes: '',
      designReference: '',
      additionalFeatures: [],
      logos,
      engravingType: 'direct',
      skipEngraving: false
    };
  }, [products]);

  const handleSubmit = async () => {
    if (products.length === 0) return toast.error('Add at least one product');
    const payStatus = (paymentStatus || '').toString().trim().toUpperCase();
    if (!payStatus || !['PAID', 'BALANCE'].includes(payStatus)) {
      return toast.error('Please select Paid or Balance before proceeding.');
    }
    if (payStatus === 'BALANCE') {
      const amt = parseFloat(balanceAmount);
      if (balanceAmount == null || String(balanceAmount).trim() === '' || isNaN(amt) || amt <= 0) {
        return toast.error('Please enter a valid remaining balance amount greater than zero.');
      }
    }
    setSubmitting(true);
    try {
      const isPaid = payStatus === 'PAID';
      const computedBal = isPaid ? 0 : Math.max(0, parseFloat(balanceAmount) || Math.max(0, totalAmount - (parseFloat(advanceAmount) || 0)));
      const computedAdv = isPaid ? totalAmount : Math.max(0, totalAmount - computedBal);

      const payload = {
        orderNumber: orderNumber.trim() || undefined,
        clientNumber: clientData?.clientNumber || null,
        isNewCustomer: customerMode === 'new' && !clientData,
        customerName: customer.name,
        customerPhone: customer.phone,
        address: customer.address,
        city: customer.city,
        notes: specialNotes || null,
        measurementSpecialNote: null,
        engravingRequired: products.some(p => !!p.engravingRequired),
        products: products.map(p => ({
          name: p.name,
          fabric: p.fabric,
          color: p.color,
          size: p.size,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          design: p.design,
          stitchingNotes: p.stitchingNotes,
          accessories: p.accessories,
          sleeveLength: p.sleeveLength || '',
          shirtLength: p.shirtLength || '',
          measurementSpecialNote: p.measurementSpecialNote || '',
          gender: p.gender || 'Male',
          matchingCap: p.matchingCap || false,
          matchingCapQty: p.matchingCapQty || 0,
          capCharges: p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0,
          engravingRequired: p.engravingRequired || false,
          engravingType: p.engravingRequired ? (p.engravingType || 'direct') : null,
          engravingLines: p.engravingRequired ? ((p.engravingLines || []).filter(l => l && l.trim()) || []) : [],
          engravingThreadColor: p.engravingRequired ? (p.engravingThreadColor === 'Custom' ? p.customThreadColor : (p.engravingThreadColor || '')) : null,
          engravingPlacement: p.engravingRequired ? (p.engravingPlacement || 'LeftChest') : null,
          logoEntries: p.engravingRequired ? ((p.logoEntries || []).filter(l => l.name?.trim() || l.design?.trim()) || []) : [],
          engravingInstructions: p.engravingRequired ? (p.engravingInstructions || '') : ''
        })),
        customization: buildCustomization(),
        sizeData: Object.keys(sizeData).length > 0 ? sizeData : (Object.keys(clientMeasurements).length > 0 ? clientMeasurements : null),
        standardSize: sizingMode === 'standard' ? selectedStandardSize : null,
        measurementChart: sizingMode === 'custom' ? 'Custom Measurements' : (selectedStandardSize || (Object.keys(clientMeasurements).length > 0 ? 'Custom Measurements' : null)),
        advanceAmount: computedAdv,
        placedBy: employee?.name || user?.name || user?.id || null,
        placedByEmployeeId: employee?.id || null,
        placedByEmployeeName: employee?.name || null,
        priority,
        deliveryType,
        totalPrice: totalAmount,
        paymentStatus: isPaid ? 'PAID' : (computedBal <= 0 ? 'PAID' : 'BALANCE'),
        balanceAmount: isPaid ? 0 : computedBal
      };
      const res = await api.post('/api/outlet-orders', payload);
      // CONFIRMED SUCCESS FROM SERVER:
      isOrderSubmittedRef.current = true;
      isDraftClearedRef.current = true;
      const finalPlacedOrderNum = res.data?.orderNumber || orderNumber;
      if (finalPlacedOrderNum) {
        markOrderCompletedInRegistry(finalPlacedOrderNum);
        try {
          sessionStorage.setItem('enamels_last_completed_order', finalPlacedOrderNum);
        } catch {}
      }
      clearSavedDraft();
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
      setCreatedOrder(res.data);
      setSubmitted(true);
      toast.success(`Order ${res.data.orderNumber} placed!`);
    } catch (err) {
      console.error('Failed to place order:', err);
      // DO NOT clear draft on validation or server failure
      const errMsg = err.response?.data?.message || 'Failed to place order';
      // Idempotency check: if order number already exists, verify whether this order was already placed
      if (errMsg.toLowerCase().includes('already exists') && orderNumber) {
        try {
          const verifyRes = await api.get(`/api/outlet-orders/order-lookup/${encodeURIComponent(orderNumber.trim())}`);
          if (verifyRes.data?.found && verifyRes.data.order) {
            isOrderSubmittedRef.current = true;
            isDraftClearedRef.current = true;
            markOrderCompletedInRegistry(orderNumber);
            try {
              sessionStorage.setItem('enamels_last_completed_order', orderNumber);
              window.history.replaceState({}, '', window.location.pathname);
            } catch {}
            clearSavedDraft();
            setCreatedOrder(verifyRes.data.order);
            setSubmitted(true);
            toast.success(`Order ${orderNumber} verified and placed successfully!`);
            setSubmitting(false);
            return;
          }
        } catch (verifyErr) {
          // If verify fails, fall through to error toast
        }
      }
      toast.error(errMsg);
    }
    setSubmitting(false);
  };

  const handlePrintPreviewJobSheet = () => {
    const enrichedProducts = products.map(p => ({
      ...p,
      productType: p.name,
      fabricType: p.fabric || '',
      gender: p.gender || 'Male',
      matchingCap: p.matchingCap || false,
      matchingCapQty: p.matchingCapQty || 0,
      capCharges: p.matchingCap ? (parseInt(p.matchingCapQty) || 0) * CAP_UNIT_PRICE : 0,
      sleeveLength: p.sleeveLength || '',
      shirtLength: p.shirtLength || '',
      femaleOptions: p.femaleOptions || null,
      alteration: p.alteration || null,
      measurementSpecialNote: (p.measurementSpecialNote || '').trim()
    }));

    const isPaid = (paymentStatus || '').toString().trim().toUpperCase() === 'PAID';
    const computedBal = isPaid ? 0 : Math.max(0, parseFloat(balanceAmount) || Math.max(0, totalAmount - (parseFloat(advanceAmount) || 0)));
    const computedAdv = isPaid ? totalAmount : Math.max(0, totalAmount - computedBal);

    const previewOrder = {
      orderNumber: orderNumber || 'DRAFT',
      customerName: customer.name || 'Walk-in Customer',
      customerPhone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      outletName,
      source: 'OUTLET',
      priority,
      deliveryType,
      type: 'STANDARD',
      paymentStatus: isPaid ? 'PAID' : (computedBal <= 0 ? 'PAID' : 'BALANCE'),
      balanceAmount: computedBal,
      totalPrice: totalAmount,
      advanceAmount: computedAdv,
      notes: specialNotes || null,
      productDetails: JSON.stringify(enrichedProducts),
      engravingRequired: products.some(p => !!p.engravingRequired),
      createdAt: new Date().toISOString()
    };

    printJobSheet(previewOrder, user?.role || 'OUTLET', 'en');
  };

  const handlePrintThermalSlipPreview = () => {
    const isPaid = (paymentStatus || '').toString().trim().toUpperCase() === 'PAID';
    const computedBal = isPaid ? 0 : Math.max(0, parseFloat(balanceAmount) || Math.max(0, totalAmount - (parseFloat(advanceAmount) || 0)));
    const computedAdv = isPaid ? totalAmount : Math.max(0, totalAmount - computedBal);

    const previewOrder = {
      orderNumber: orderNumber || 'DRAFT',
      customerName: customer.name || 'Walk-in Customer',
      customerPhone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      clientNumber: clientData?.clientNumber || null,
      outletName,
      source: 'OUTLET',
      priority,
      deliveryType,
      type: 'STANDARD',
      paymentStatus: isPaid ? 'PAID' : (computedBal <= 0 ? 'PAID' : 'BALANCE'),
      balanceAmount: computedBal,
      totalPrice: totalAmount,
      advanceAmount: computedAdv,
      notes: specialNotes || null,
      products,
      sizeData: Object.keys(sizeData).length > 0 ? sizeData : (Object.keys(clientMeasurements).length > 0 ? clientMeasurements : null),
      placedByEmployeeName: employee?.name || user?.name || null,
      createdAt: new Date().toISOString()
    };
    printOutletOrderThermalSlip(previewOrder);
  };

  const resetAll = useCallback(() => {
    isOrderSubmittedRef.current = false;
    isDraftClearedRef.current = true;
    clearSavedDraft();
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {}
    setStep(0);
    setCustomerMode(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setClientData(null);
    setRecentOrders([]);
    setLookedUp(false);
    setCustomer({ name: '', phone: '', address: '', city: '', notes: '' });
    setProducts([]);
    setNewProduct({ ...EMPTY_PRODUCT });
    setSpecialNotes('');
    setSizeData({});
    setClientMeasurements({});
    setAdvanceAmount(0);
    setBalanceAmount('');
    setPriority('NORMAL');
    setDeliveryType('DELIVERY');
    setPaymentStatus('');
    setSubmitted(false);
    setCreatedOrder(null);
    setClientStandardSizes([]);
    setSizingMode(null);
    setSelectedStandardSize('');
    setClientMeasurementChart('');
    setOrderNumber('');
    setPosSaleInfo(null);
    generateNewOrderNumber();
    setTimeout(() => {
      isDraftClearedRef.current = false;
    }, 500);
  }, [clearSavedDraft, generateNewOrderNumber]);

  const handleDiscardDraft = useCallback(() => {
    if (!window.confirm('Are you sure you want to discard this unfinished draft? All entered fields will be cleared.')) {
      return;
    }
    resetAll();
    toast.success('Draft discarded. Starting fresh order.');
  }, [resetAll]);

  if (submitted) {
    const isPaid = (createdOrder?.paymentStatus || paymentStatus || '').toString().trim().toUpperCase() === 'PAID';
    const computedBal = isPaid ? 0 : (createdOrder?.balanceAmount != null ? parseFloat(createdOrder.balanceAmount) : Math.max(0, parseFloat(balanceAmount) || Math.max(0, totalAmount - (parseFloat(advanceAmount) || 0))));
    const computedAdv = isPaid ? totalAmount : (createdOrder?.advanceAmount != null ? parseFloat(createdOrder.advanceAmount) : Math.max(0, totalAmount - computedBal));

    const slipOrder = createdOrder ? {
      ...createdOrder,
      advanceAmount: computedAdv,
      balanceAmount: computedBal,
      paymentStatus: isPaid ? 'PAID' : (computedBal <= 0 ? 'PAID' : 'BALANCE')
    } : {
      orderNumber,
      customerName: customer.name,
      customerPhone: customer.phone,
      address: customer.address,
      city: customer.city,
      clientNumber: clientData?.clientNumber || null,
      outletName,
      products,
      sizeData: Object.keys(sizeData).length > 0 ? sizeData : (Object.keys(clientMeasurements).length > 0 ? clientMeasurements : null),
      totalPrice: totalAmount,
      advanceAmount: computedAdv,
      balanceAmount: computedBal,
      paymentStatus: isPaid ? 'PAID' : (computedBal <= 0 ? 'PAID' : 'BALANCE'),
      priority,
      deliveryType,
      notes: specialNotes,
      placedByEmployeeName: employee?.name || user?.name,
      createdAt: new Date().toISOString()
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 border-2 border-emerald-700 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Order Placed!</h2>
          <p className="text-2xl font-black text-blue-400 font-mono tracking-wider">{createdOrder?.orderNumber || orderNumber}</p>
          {createdOrder?.invoiceNumber && <p className="text-sm font-bold text-amber-400">Invoice: {createdOrder.invoiceNumber}</p>}
          {priority !== 'NORMAL' && <p className="text-xs font-bold text-red-400">Priority: {PRIORITY_OPTIONS.find(p => p.value === priority)?.label}</p>}
          {customerMode === 'new' && (
            <p className="text-xs font-bold text-emerald-400">Customer saved to Client Registration</p>
          )}
          <div className="bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm text-left">
            <p className="text-gray-400">Customer: <span className="text-white font-bold">{customer.name} ({customer.phone})</span></p>
            {clientData?.clientNumber && <p className="text-gray-400">Client #: <span className="text-blue-400 font-bold">#{clientData.clientNumber}</span></p>}
            <p className="text-gray-400">Total: <span className="text-white font-black">₨{totalAmount.toLocaleString()}</span></p>
            <p className="text-gray-400">Paid / Advance: <span className="text-emerald-400 font-black">₨{computedAdv.toLocaleString()}</span></p>
            <p className="text-gray-400">Balance: <span className={computedBal > 0 ? "text-amber-400 font-black" : "text-emerald-400 font-black"}>₨{computedBal.toLocaleString()}</span></p>
            <p className="text-gray-400">Status: <span className={isPaid || computedBal <= 0 ? "text-emerald-400 font-black" : "text-red-400 font-black"}>{isPaid || computedBal <= 0 ? "✓ FULLY PAID" : "⚠ BALANCE DUE"}</span></p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => printOutletOrderThermalSlip(slipOrder)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Printer size={16} />
              Print Thermal Slip (Customer Copy)
            </button>

            <button
              onClick={handlePrintPreviewJobSheet}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-gray-700 transition-all cursor-pointer"
            >
              <FileText size={14} />
              Print Production Job Sheet (A4)
            </button>

            <button
              onClick={resetAll}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm transition-all cursor-pointer mt-2"
            >
              Start New Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-md mx-auto space-y-6 pb-20 px-4 mt-6">
        <div className="flex items-center gap-4 justify-center">
          <div className="p-3 bg-amber-600 rounded-2xl"><Lock className="text-white" size={24} /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Outlet Order Entry</h1>
            <p className="text-sm font-bold text-gray-400">{employeeOutlet}</p>
          </div>
        </div>

        <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black text-white flex items-center justify-center gap-2"><UserCheck size={18} />Employee Login</h2>
            <p className="text-xs font-bold text-gray-500">Authenticate to begin creating orders</p>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Employee Name</label>
            <select
              value={selectedEmployeeName}
              onChange={e => { setSelectedEmployeeName(e.target.value); setLoginError(''); }}
              disabled={employeesLoading}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-amber-500 outline-none appearance-none disabled:opacity-50">
              <option value="">{employeesLoading ? 'Loading employees...' : 'Select employee'}</option>
              {employeeList.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            {!employeesLoading && employeeList.length === 0 && (
              <p className="text-[11px] font-bold text-red-400 mt-1">No active employees found for {employeeOutlet}. Contact Admin.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              value={employeePassword}
              onChange={e => { setEmployeePassword(e.target.value); setLoginError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleEmployeeLogin(); }}
              placeholder="Enter employee password"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
          </div>

          {loginError && (
            <div className="bg-red-900/20 border border-red-700 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-400">{loginError}</p>
            </div>
          )}

          <button onClick={handleEmployeeLogin} disabled={loggingIn || employeesLoading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loggingIn ? 'Verifying...' : 'Login & Start Order'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 rounded-2xl"><ShoppingBag className="text-white" size={24} /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Outlet Order Entry</h1>
            <p className="text-sm font-bold text-gray-400">{outletName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap ml-auto">
          {/* Draft status indicator */}
          {draftStatus === 'saving' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              <span>Saving draft…</span>
            </div>
          )}
          {draftStatus === 'saved' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <CheckCircle size={12} />
              <span>Draft saved {draftSavedAt ? formatTimeOnly(draftSavedAt) : ''}</span>
            </div>
          )}
          {draftStatus === 'error' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
              <AlertTriangle size={12} />
              <span>Could not save draft</span>
            </div>
          )}

          {/* Discard draft / Start fresh button */}
          {(hasDraftData({ customer, products, newProduct, specialNotes, clientData, advanceAmount, balanceAmount, paymentStatus, orderNumber }) || isDraftRestored || posSaleInfo || step > 0) && (
            <button
              type="button"
              onClick={handleDiscardDraft}
              title="Discard data and start fresh order"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 hover:border-red-600 text-red-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Start Fresh / Reset</span>
            </button>
          )}

          {/* Employee badge */}
          <div className="flex items-center gap-2 bg-emerald-700/30 border border-emerald-600 rounded-xl px-3 py-1.5">
            <UserCheck size={15} className="text-emerald-400" />
            <span className="text-xs font-black text-emerald-300">{employee?.name}</span>
            <button onClick={handleEmployeeLogout} title="Logout employee" className="text-gray-400 hover:text-red-400 ml-1 cursor-pointer">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Restored draft notice */}
      {isDraftRestored && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <CheckCircle size={16} className="text-amber-400 shrink-0" />
            <span>
              Restored unfinished draft {draftSavedAt ? `from ${formatDateTime(draftSavedAt)}` : ''}. All entered customer, product, and customization data is preserved.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsDraftRestored(false)}
              className="text-gray-400 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-gray-800 transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-red-400 hover:text-red-300 text-xs font-bold underline cursor-pointer"
            >
              Discard Draft
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => { if (i <= step) setStep(i); }}
            className={`text-[9px] font-black px-2 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
              i === step ? 'bg-amber-600 text-white' :
              i < step ? 'bg-emerald-700/40 text-emerald-400' :
              'bg-gray-800 text-gray-500'
            }`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-4 md:p-6 space-y-4 min-h-[300px]">

        {/* ═══════════════════ Step 0: Customer ═══════════════════ */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><User size={18} />Customer</h2>

            {!customerMode && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-400">How would you like to proceed?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={handleStartExistingCustomer}
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-amber-500 rounded-2xl p-6 text-left transition-all">
                    <Search size={24} className="text-amber-400 mb-3" />
                    <p className="text-sm font-black text-white">Existing Customer</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Search by phone number to load saved data</p>
                  </button>
                  <button onClick={handleStartNewCustomer}
                    className="bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all">
                    <Plus size={24} className="text-emerald-400 mb-3" />
                    <p className="text-sm font-black text-white">New Customer</p>
                    <p className="text-xs font-bold text-gray-400 mt-1">Enter details directly — saved after order</p>
                  </button>
                </div>
              </div>
            )}

            {customerMode === 'existing' && !clientData && (
              <div className="space-y-3">
                <button onClick={() => setCustomerMode(null)} className="text-xs font-bold text-gray-500 hover:text-white flex items-center gap-1">
                  <ChevronLeft size={12} /> Back
                </button>
                <p className="text-sm font-bold text-gray-400">Search by phone (primary or additional), name, address, or client #:</p>
                <div className="flex gap-2">
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setLookedUp(false); setShowResults(false); }}
                    placeholder="Search by phone, alternate phone, name, address, or client #..."
                    className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-lg font-black text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
                  <button onClick={handleLookup} disabled={lookupLoading || !searchQuery.trim()}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-3 rounded-xl disabled:opacity-50">
                    {lookupLoading ? '...' : 'Search'}
                  </button>
                </div>
                {showResults && searchResults.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-400">{searchResults.length} clients found — select one:</p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {searchResults.map(({ client, recentOrders: ro }, i) => (
                        <button key={i} onClick={() => selectClient(client, ro)}
                          className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-3 text-left transition-all">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-white">{client.name} <span className="text-blue-400 text-xs">#{client.clientNumber}</span></p>
                            {client.outletName && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {client.outletName}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                            <span className="font-mono text-blue-300 font-bold">Primary: {client.phone}</span>
                            {Array.isArray(client.additionalPhones) && client.additionalPhones.filter(Boolean).length > 0 && (
                              <span className="font-mono text-indigo-300">Alt: {client.additionalPhones.filter(Boolean).join(', ')}</span>
                            )}
                            {client.city && <span className="text-gray-300">• {client.city}</span>}
                          </div>
                          {client.permanentAddress && (
                            <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{client.permanentAddress}</p>
                          )}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleStartNewCustomer} className="text-xs font-bold text-amber-400 hover:text-amber-300 underline">
                      Not found — enter as new customer
                    </button>
                  </div>
                )}
                {lookedUp && !clientData && !showResults && (
                  <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-400">Client not found. </p>
                    <button onClick={handleStartNewCustomer} className="text-xs font-bold text-amber-300 underline mt-1">Enter as new customer instead</button>
                  </div>
                )}
              </div>
            )}

            {customerMode === 'existing' && clientData && (
              <div className="space-y-3">
                <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-3">
                  <p className="text-xs font-bold text-blue-400">Client #{clientData.clientNumber} — {clientData.name}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Name *</label>
                    <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Phone *</label>
                    <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Address</label>
                    <input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">City</label>
                    <input value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none" />
                  </div>
                </div>
                {recentOrders.length > 0 && (
                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Recent Orders</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {recentOrders.map(o => (
                        <div key={o.id} className="bg-gray-800/50 rounded-xl p-3 text-xs">
                          <p className="font-black text-blue-400">#{o.orderNumber}</p>
                          <p className="text-gray-500">{formatDateOnly(o.createdAt)} — {o.currentStage}</p>
                          <p className="text-gray-500 mt-1">Total: ₨{(o.totalPrice || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {customerMode === 'new' && (
              <div className="space-y-3">
                <button onClick={() => setCustomerMode(null)} className="text-xs font-bold text-gray-500 hover:text-white flex items-center gap-1">
                  <ChevronLeft size={12} /> Back
                </button>
                <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-3">
                  <p className="text-xs font-bold text-emerald-400">New customer — details will be saved to Client Registration after order is placed.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Customer Name *</label>
                    <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                      placeholder="Full name" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Phone Number *</label>
                    <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                      placeholder="03XX-XXXXXXX" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Address</label>
                    <input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                      placeholder="Street address" />
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
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <label className="text-xs font-bold text-gray-400">Delivery Method</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeliveryType('DELIVERY')}
                  className={`rounded-xl p-3 text-left border-2 transition-all ${deliveryType === 'DELIVERY' ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}>
                  <Truck size={20} className={deliveryType === 'DELIVERY' ? 'text-blue-400' : 'text-gray-500'} />
                  <p className="text-sm font-black text-white mt-1">Delivery</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">Home delivery to customer address</p>
                </button>
                <button type="button" onClick={() => setDeliveryType('SELF_COLLECTION')}
                  className={`rounded-xl p-3 text-left border-2 transition-all ${deliveryType === 'SELF_COLLECTION' ? 'bg-purple-600/20 border-purple-500' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}>
                  <Store size={20} className={deliveryType === 'SELF_COLLECTION' ? 'text-purple-400' : 'text-gray-500'} />
                  <p className="text-sm font-black text-white mt-1">Self Collection</p>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">Customer will pick up from shop</p>
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400">Order Number *</label>
                <div className="flex items-center gap-2">
                  {prefilledOrderNumber && (
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-lg">From POS</span>
                  )}
                  {!prefilledOrderNumber && (
                    <button onClick={generateNewOrderNumber} disabled={generatingNumber}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1">
                      <RefreshCw size={10} className={generatingNumber ? 'animate-spin' : ''} /> Generate New
                    </button>
                  )}
                </div>
              </div>
              <input
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-black text-white placeholder-gray-500 outline-none focus:border-amber-500 tracking-wider uppercase"
                placeholder="Auto-generated" />
            </div>
          </div>
        )}

        {/* ═══════════════════ Step 1: Products ═══════════════════ */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><ShoppingBag size={18} />Product Details</h2>
            <p className="text-xs font-bold text-gray-500">Enter each product manually. Add as many as needed.</p>

            <div className="bg-gray-800 rounded-2xl p-4 space-y-3 border border-gray-700">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">Add Product</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 md:col-span-4">
                  <label className="text-[10px] font-bold text-gray-500">Article / Product Name *</label>
                  <input value={newProduct.name} onChange={e => updateNewProduct('name', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Men's Scrub Top, Lab Coat" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Gender</label>
                  <select value={newProduct.gender} onChange={e => updateNewProduct('gender', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Fabric</label>
                  <input value={newProduct.fabric} onChange={e => updateNewProduct('fabric', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Cotton, Polyester" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Color</label>
                  <input value={newProduct.color} onChange={e => updateNewProduct('color', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Navy Blue" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Size</label>
                  <input value={newProduct.size} onChange={e => updateNewProduct('size', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. M, L, XL" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Qty</label>
                  <input type="number" value={newProduct.quantity} min="1"
                    onChange={e => updateNewProduct('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Unit Price (₨)</label>
                  <input type="number" value={newProduct.unitPrice} min="0"
                    onChange={e => updateNewProduct('unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Design / Style</label>
                  <input value={newProduct.design} onChange={e => updateNewProduct('design', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. V-Neck, Round Neck" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-500">Stitching Details</label>
                  <input value={newProduct.stitchingNotes} onChange={e => updateNewProduct('stitchingNotes', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Double stitch, French seam" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-500">Required Accessories</label>
                  <input value={newProduct.accessories} onChange={e => updateNewProduct('accessories', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Pocket, Zip, Buttons" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Sleeve Length</label>
                  <select value={newProduct.sleeveLength} onChange={e => updateNewProduct('sleeveLength', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500">
                    <option value="">Select</option>
                    {SLEEVE_LENGTH_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label} — {o.labelUrdu}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Shirt Length</label>
                  <select value={newProduct.shirtLength} onChange={e => updateNewProduct('shirtLength', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500">
                    <option value="">Select</option>
                    {SHIRT_LENGTH_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label} — {o.labelUrdu}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex items-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newProduct.matchingCap}
                      onChange={e => updateNewProduct('matchingCap', e.target.checked)}
                      className="accent-amber-500 w-4 h-4" />
                    <span className="text-[10px] font-bold text-gray-500">Matching Cap</span>
                  </label>
                  {newProduct.matchingCap && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-500">Qty:</span>
                      <input type="number" value={newProduct.matchingCapQty} min="0"
                        onChange={e => updateNewProduct('matchingCapQty', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white outline-none focus:border-amber-500" />
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-500">Measurement Special Note</label>
                  <input value={newProduct.measurementSpecialNote} onChange={e => updateNewProduct('measurementSpecialNote', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-500 outline-none focus:border-amber-500"
                    placeholder="e.g. Chest 42, Waist 34, Loose fitting..." />
                </div>
              </div>
              <button onClick={addProduct}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                <Plus size={16} /> Add Product
              </button>
            </div>

            {products.length > 0 && (
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Products ({products.length}) — Total: ₨{totalAmount.toLocaleString()}{products.some(p => p.matchingCap) ? ` (incl. ₨${products.reduce((s, p) => s + (p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0), 0).toLocaleString()} caps)` : ''}</h3>
                {products.map((p, idx) => (
                  <div key={p._tempId} className="bg-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-black text-white">{p.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400 font-bold">
                          <span className="text-blue-400">{p.gender}</span>
                          {p.fabric && <span>Fabric: {p.fabric}</span>}
                          {p.color && <span>Color: {p.color}</span>}
                          {p.size && <span>Size: {p.size}</span>}
                          <span>Qty: {p.quantity}</span>
                          <span className="text-amber-400 font-black">₨{((p.unitPrice || 0) * (p.quantity || 1)).toLocaleString()}</span>
                        </div>
                         {p.matchingCap && <p className="text-[10px] text-purple-400 mt-0.5">Matching Cap × {p.matchingCapQty} (₨{(p.matchingCapQty || 0) * CAP_UNIT_PRICE})</p>}
                         {p.sleeveLength && <p className="text-[10px] text-gray-500 mt-0.5">Sleeve: {SLEEVE_LENGTH_OPTIONS.find(o => o.value === p.sleeveLength)?.labelUrdu || p.sleeveLength}</p>}
                         {p.shirtLength && <p className="text-[10px] text-gray-500 mt-0.5">Shirt Length: {SHIRT_LENGTH_OPTIONS.find(o => o.value === p.shirtLength)?.labelUrdu || p.shirtLength}</p>}
                        {p.design && <p className="text-[10px] text-gray-500 mt-0.5">Design: {p.design}</p>}
                        {p.stitchingNotes && <p className="text-[10px] text-gray-500">Stitching: {p.stitchingNotes}</p>}
                        {p.accessories && <p className="text-[10px] text-gray-500">Accessories: {p.accessories}</p>}
                         {p.measurementSpecialNote && <p className="text-[10px] text-amber-400 font-bold mt-0.5">Measurement Note: {p.measurementSpecialNote}</p>}
                         <label className="flex items-center gap-2 cursor-pointer mt-1.5">
                           <input type="checkbox" checked={!!p.engravingRequired}
                             onChange={e => updateProductField(idx, 'engravingRequired', e.target.checked)}
                             className="accent-purple-500 w-4 h-4" />
                           <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Engraving</span>
                         </label>
                         {!!p.engravingRequired && (
                           <div className="mt-2 space-y-2 bg-gray-900/60 rounded-lg p-2.5 border border-purple-500/30">
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 block mb-1">Method</label>
                               <div className="flex gap-2">
                                 {[{ value: 'direct', label: 'Direct' }, { value: 'patch', label: 'Patch' }].map(opt => (
                                   <button key={opt.value} type="button" onClick={() => updateProductField(idx, 'engravingType', opt.value)}
                                     className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                                       (p.engravingType || 'direct') === opt.value
                                         ? 'bg-purple-600/20 text-purple-400 border-purple-500'
                                         : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                                     }`}>
                                     {opt.label}
                                   </button>
                                 ))}
                               </div>
                             </div>
                             <div>
                               <div className="flex items-center justify-between mb-1">
                                 <label className="text-[10px] font-bold text-gray-400">Engraving Lines</label>
                                 {((p.engravingLines || []).length) < 5 && (
                                   <button type="button" onClick={() => updateProductField(idx, 'engravingLines', [...(p.engravingLines || []), ''])}
                                     className="text-[10px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                     <Plus size={11} /> Add Line
                                   </button>
                                 )}
                               </div>
                               <div className="space-y-1.5">
                                 {(p.engravingLines || ['']).map((line, li) => (
                                   <div key={li} className="flex items-center gap-1.5">
                                     <span className="bg-purple-500/20 text-purple-400 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0">L{li + 1}</span>
                                     <input value={line} onChange={e => { const next = [...(p.engravingLines || [''])]; next[li] = e.target.value; updateProductField(idx, 'engravingLines', next); }}
                                       className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-bold text-white placeholder-gray-500 outline-none"
                                       placeholder={`Engraving line ${li + 1}`} />
                                     {(p.engravingLines || []).length > 1 && (
                                       <button onClick={() => updateProductField(idx, 'engravingLines', (p.engravingLines || []).filter((_, j) => j !== li))}
                                         className="text-red-400 hover:text-red-300 p-0.5"><X size={12} /></button>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             </div>
                             <div className="grid grid-cols-2 gap-2">
                               <div>
                                 <label className="text-[10px] font-bold text-gray-400 block mb-1">Thread / Text Color</label>
                                 <select value={p.engravingThreadColor === 'Custom' ? 'Custom' : (p.engravingThreadColor || '')}
                                   onChange={e => updateProductField(idx, 'engravingThreadColor', e.target.value)}
                                   className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:border-purple-500 outline-none appearance-none">
                                   {THREAD_COLOR_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                   ))}
                                 </select>
                                 {(p.engravingThreadColor === 'Custom') && (
                                   <input value={p.customThreadColor || ''} onChange={e => updateProductField(idx, 'customThreadColor', e.target.value)}
                                     className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none mt-1"
                                     placeholder="Custom color" />
                                 )}
                               </div>
                               <div>
                                 <label className="text-[10px] font-bold text-gray-400 block mb-1">Placement</label>
                                 <select value={p.engravingPlacement || 'LeftChest'} onChange={e => updateProductField(idx, 'engravingPlacement', e.target.value)}
                                   className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white focus:border-purple-500 outline-none appearance-none">
                                   {PLACEMENT_OPTIONS.map(o => (
                                     <option key={o.value} value={o.value}>{o.label}</option>
                                   ))}
                                 </select>
                               </div>
                             </div>
                             <div>
                               <div className="flex items-center justify-between mb-1">
                                 <label className="text-[10px] font-bold text-gray-400">Logos</label>
                                 <button type="button" onClick={() => updateProductField(idx, 'logoEntries', [...(p.logoEntries || []), { name: '', design: '' }])}
                                   className="text-[10px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                   <Plus size={11} /> Add Logo
                                 </button>
                               </div>
                               <div className="space-y-1.5">
                                 {(p.logoEntries || []).map((logo, li) => (
                                   <div key={li} className="flex items-center gap-1.5">
                                     <input value={logo.name || ''} onChange={e => { const next = [...(p.logoEntries || [])]; next[li] = { ...next[li], name: e.target.value }; updateProductField(idx, 'logoEntries', next); }}
                                       className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-bold text-white placeholder-gray-500 outline-none"
                                       placeholder="Logo name" />
                                     <input value={logo.design || ''} onChange={e => { const next = [...(p.logoEntries || [])]; next[li] = { ...next[li], design: e.target.value }; updateProductField(idx, 'logoEntries', next); }}
                                       className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-bold text-white placeholder-gray-500 outline-none"
                                       placeholder="Design" />
                                     {(p.logoEntries || []).length > 1 && (
                                       <button onClick={() => updateProductField(idx, 'logoEntries', (p.logoEntries || []).filter((_, j) => j !== li))}
                                         className="text-red-400 hover:text-red-300 p-0.5"><X size={12} /></button>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             </div>
                             <div>
                               <label className="text-[10px] font-bold text-gray-400 block mb-1">Engraving Instructions</label>
                               <input value={p.engravingInstructions || ''} onChange={e => updateProductField(idx, 'engravingInstructions', e.target.value)}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs font-bold text-white placeholder-gray-500 outline-none"
                                 placeholder="Font, style, special instructions..." />
                             </div>
                           </div>
                         )}
                       </div>
                      <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ Step 2: Measurements ═══════════════════ */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Ruler size={18} className="text-amber-400" />
                  Measurements & Special Notes
                </h2>
                <p className="text-xs font-bold text-gray-400">
                  Custom sizes prefilled from customer profile. Applied automatically to product Special Notes below.
                </p>
              </div>

              {/* Quick Action to sync/apply measurements */}
              <button
                type="button"
                onClick={() => {
                  applyMeasurementsToProducts(clientMeasurements);
                  toast.success('Applied custom measurements to all product Special Notes!');
                }}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Apply to Special Notes (کسٹم سائز اپلائی کریں)</span>
              </button>
            </div>

            {/* Urdu Custom Measurement Chart Card */}
            <div className="bg-gray-800/90 rounded-2xl p-5 border border-amber-500/30 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-700 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                    کسٹم سائز (انچ میں)
                  </span>
                  <span className="text-sm font-black text-white tracking-wide">
                    Custom Measurement Chart (Inches)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-gray-400" dir="rtl">
                  یہ ناپ آرڈر کے ساتھ محفوظ ہوں گے اور پروڈکٹ نوٹس میں شامل ہوں گے
                </span>
              </div>

              {/* Shirt Section (شرٹ) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    Shirt Measurements (شرٹ)
                  </span>
                  <span className="text-xs font-bold text-blue-300" dir="rtl">
                    شرٹ کا کسٹم ناپ
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {SHIRT_MEASUREMENT_FIELDS.map(f => (
                    <div key={f.key} className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-700/70 focus-within:border-blue-500 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</span>
                        <span className="text-[11px] font-bold text-blue-400" dir="rtl">{f.labelUrdu}</span>
                      </div>
                      <input
                        type="text"
                        value={clientMeasurements[f.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = { ...clientMeasurements, [f.key]: val };
                          setClientMeasurements(updated);
                          applyMeasurementsToProducts(updated);
                        }}
                        placeholder={`e.g. ${f.example}`}
                        className="w-full bg-transparent text-sm font-black text-white placeholder-gray-600 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Trouser Section (ٹراؤزر) */}
              <div className="space-y-3 border-t border-gray-700/70 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    Trouser Measurements (ٹراؤزر)
                  </span>
                  <span className="text-xs font-bold text-emerald-300" dir="rtl">
                    ٹراؤزر کا کسٹم ناپ
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {TROUSER_MEASUREMENT_FIELDS.map(f => (
                    <div key={f.key} className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-700/70 focus-within:border-emerald-500 transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{f.label}</span>
                        <span className="text-[11px] font-bold text-emerald-400" dir="rtl">{f.labelUrdu}</span>
                      </div>
                      <input
                        type="text"
                        value={clientMeasurements[f.key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = { ...clientMeasurements, [f.key]: val };
                          setClientMeasurements(updated);
                          applyMeasurementsToProducts(updated);
                        }}
                        placeholder={`e.g. ${f.example}`}
                        className="w-full bg-transparent text-sm font-black text-white placeholder-gray-600 outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra Custom Measurements if present */}
              {Array.isArray(clientMeasurements._extra) && clientMeasurements._extra.length > 0 && (
                <div className="space-y-2 border-t border-gray-700/70 pt-3">
                  <span className="text-xs font-black text-purple-400 uppercase tracking-wider block">
                    Additional Measurements
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {clientMeasurements._extra.map((em, idx) => (
                      <div key={idx} className="bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-700 text-xs">
                        <span className="text-gray-400 font-bold">{em.name}: </span>
                        <span className="text-white font-black">{em.value}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order Special Notes */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
              <label className="text-xs font-bold text-gray-400 block">General Order Notes (Optional)</label>
              <textarea
                value={specialNotes}
                onChange={e => setSpecialNotes(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none"
                rows={2}
                placeholder="Production instructions, urgent packaging notes..."
              />
            </div>

            {/* Product Special Notes (With Auto-Populated Urdu Measurements) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400">
                  Product Special Notes (Measurements & Tailoring Details)
                </p>
                <span className="text-[10px] text-amber-400 font-bold">
                  Auto-formatted with Urdu labels for tailors & cutters
                </span>
              </div>

              {products.length === 0 ? (
                <div className="bg-gray-800 rounded-xl p-6 text-center border border-gray-700 text-gray-400 text-xs font-bold">
                  No products added yet. Go back to Step 1 to add products.
                </div>
              ) : (
                products.map((p, idx) => (
                  <div key={p._tempId} className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-amber-400">
                        {idx + 1}. {p.name} {p.color ? `(${p.color})` : ''}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const pType = getProductMeasurementType(p.name);
                          const urdu = formatUrduMeasurementNote(clientMeasurements, pType);
                          if (urdu) {
                            const updated = [...products];
                            updated[idx] = {
                              ...updated[idx],
                              measurementSpecialNote: mergeMeasurementSpecialNote(updated[idx].measurementSpecialNote || '', urdu)
                            };
                            setProducts(updated);
                            toast.success(`Updated notes for ${p.name}`);
                          } else {
                            toast('No measurements entered in chart yet', { icon: 'ℹ️' });
                          }
                        }}
                        className="text-[10px] font-black text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/30 transition-all cursor-pointer"
                      >
                        Refresh Measurement Note
                      </button>
                    </div>
                    <textarea
                      value={p.measurementSpecialNote || ''}
                      onChange={e => {
                        const updated = [...products];
                        updated[idx] = { ...updated[idx], measurementSpecialNote: e.target.value };
                        setProducts(updated);
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none font-sans"
                      rows={4}
                      dir="auto"
                      placeholder={`Measurement instructions for ${p.name}...`}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════ Step 3: Review & Place ═══════════════════ */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><CheckCircle size={18} />Review & Place Order</h2>

            <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
              <p className="text-gray-400">Customer: <span className="text-white font-black">{customer.name}</span></p>
              <p className="text-gray-400">Phone: <span className="text-white font-black">{customer.phone}</span></p>
              {customer.address && <p className="text-gray-400">Address: <span className="text-white font-bold">{customer.address}</span></p>}
              {customer.city && <p className="text-gray-400">City: <span className="text-white font-bold">{customer.city}</span></p>}
              {orderNumber && <p className="text-gray-400">Order #: <span className="text-white font-black">{orderNumber}</span></p>}
              {priority !== 'NORMAL' && (
                <p className="text-gray-400">Priority: <span className={`font-black ${priority === 'SUPER_URGENT' ? 'text-red-400' : 'text-orange-400'}`}>{PRIORITY_OPTIONS.find(p => p.value === priority)?.label}</span></p>
              )}
              <p className="text-gray-400">Delivery: <span className={`font-black ${deliveryType === 'SELF_COLLECTION' ? 'text-purple-400' : 'text-blue-400'}`}>{deliveryType === 'DELIVERY' ? '🚚 Delivery' : '🏪 Self Collection'}</span></p>
              {customerMode === 'new' && !clientData && (
                <p className="text-[10px] font-bold text-emerald-400 mt-1">New customer — will be saved to Client Registration</p>
              )}
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-gray-400 mb-2">Products: <span className="text-white font-black">{products.length} item(s)</span></p>
              {products.map((p, i) => (
                <div key={p._tempId} className="bg-gray-900 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold">{p.name}</span>
                      <span className="text-blue-400 ml-1">({p.gender})</span>
                      {p.fabric && <span className="text-gray-500 ml-1">{p.fabric}</span>}
                      {p.color && <span className="text-gray-500 ml-1">{p.color}</span>}
                      {p.size && <span className="text-gray-500 ml-1">{`/ ${p.size}`}</span>}
                      {p.quantity > 1 && <span className="text-gray-500 ml-1">{`x${p.quantity}`}</span>}
                    </div>
                    <span className="text-amber-400 font-black">₨{((p.unitPrice || 0) * (p.quantity || 1) + (p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1 text-[10px] text-gray-500">
                    {p.sleeveLength && <span>Sleeve: {SLEEVE_LENGTH_OPTIONS.find(o => o.value === p.sleeveLength)?.labelUrdu || p.sleeveLength}</span>}
                    {p.shirtLength && <span>Shirt: {SHIRT_LENGTH_OPTIONS.find(o => o.value === p.shirtLength)?.labelUrdu || p.shirtLength}</span>}
                    {p.matchingCap && <span className="text-purple-400">Cap ×{p.matchingCapQty} (₨{(p.matchingCapQty || 0) * CAP_UNIT_PRICE})</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-2">
              <p className="text-gray-400 font-bold">Engraving:</p>
              {products.filter(p => p.engravingRequired).length === 0 ? (
                <p className="text-white font-black">No products require engraving</p>
              ) : (
                products.filter(p => p.engravingRequired).map(p => {
                  const lines = (p.engravingLines || []).filter(l => l && l.trim());
                  const logos = (p.logoEntries || []).filter(l => l.name?.trim() || l.design?.trim());
                  return (
                    <div key={p._tempId} className="bg-gray-900 rounded-lg px-3 py-2">
                      <p className="text-white font-black">{p.name}</p>
                      <p className="text-gray-400">Method: <span className="text-white font-black">{(p.engravingType || 'direct') === 'direct' ? 'Direct' : 'Patch'}</span></p>
                      {lines.length > 0 && <p className="text-gray-400">Lines: <span className="text-white font-black">{lines.join(' | ')}</span></p>}
                      {p.engravingThreadColor && <p className="text-gray-400">Thread: <span className="text-purple-400 font-black">{p.engravingThreadColor === 'Custom' ? p.customThreadColor : p.engravingThreadColor}</span></p>}
                      <p className="text-gray-400">Placement: <span className="text-white font-black">{PLACEMENT_OPTIONS.find(o => o.value === (p.engravingPlacement || 'LeftChest'))?.label || p.engravingPlacement}</span></p>
                      {logos.length > 0 && <p className="text-gray-400">Logos: <span className="text-white font-black">{logos.map(l => `${l.name}${l.design ? ' — ' + l.design : ''}`).join(', ')}</span></p>}
                      {p.engravingInstructions && <p className="text-gray-400">Instructions: <span className="text-white font-black">{p.engravingInstructions}</span></p>}
                    </div>
                  );
                })
              )}
            </div>

            {/* Unified Payment & Balance Details Card */}
            <div className={`bg-gray-800/90 border-2 rounded-2xl p-5 space-y-4 transition-all ${
              !paymentStatus
                ? 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-red-950/10'
                : 'border-gray-700'
            }`}>
              {/* Header with Total Amount */}
              <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-amber-300 block">
                    Payment Status <span className="text-red-400 font-black">* Mandatory</span>
                  </label>
                  {posSaleInfo && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                        From POS ({posSaleInfo.receiptNumber})
                      </span>
                      <button
                        type="button"
                        onClick={handleDisconnectPosSale}
                        className="text-[10px] font-black text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-900/60 border border-red-700/60 px-2 py-0.5 rounded-full flex items-center gap-1 transition-all cursor-pointer"
                        title="Disconnect POS receipt and calculate total from current products"
                      >
                        <X size={10} /> Disconnect POS Bill
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">Total Order Amount</span>
                  <span className="text-2xl font-black text-white">₨{totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Status Toggle Buttons */}
              <p className="text-[11px] font-bold text-gray-400">Select whether this order is fully Paid or has a Remaining Balance:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSelectPaid}
                  className={`py-3.5 px-4 rounded-xl border-2 font-black text-sm text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentStatus === 'PAID'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/40 scale-[1.02]'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 border-current flex items-center justify-center ${paymentStatus === 'PAID' ? 'border-white' : ''}`}>
                    {paymentStatus === 'PAID' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                  </span>
                  ✓ PAID
                </button>
                <button
                  type="button"
                  onClick={handleSelectBalance}
                  className={`py-3.5 px-4 rounded-xl border-2 font-black text-sm text-center flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentStatus === 'BALANCE'
                      ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40 scale-[1.02]'
                      : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 border-current flex items-center justify-center ${paymentStatus === 'BALANCE' ? 'border-white' : ''}`}>
                    {paymentStatus === 'BALANCE' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                  </span>
                  ⚠ BALANCE
                </button>
              </div>

              {/* If PAID: confirmation banner */}
              {paymentStatus === 'PAID' && (
                <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <p className="font-black text-emerald-300">✓ Fully Paid at Order Placement</p>
                    <p className="text-gray-400 text-[11px]">Paid: ₨{totalAmount.toLocaleString()} &bull; Remaining Balance: ₨0</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 rounded-lg font-black text-xs">
                    PAID IN FULL
                  </span>
                </div>
              )}

              {/* If BALANCE: advance & balance input fields */}
              {paymentStatus === 'BALANCE' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Advance Paid */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-emerald-400 block">
                        Advance / Paid Amount (₨)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={totalAmount}
                        placeholder="0"
                        value={advanceAmount || ''}
                        onChange={(e) => handleAdvanceChange(e.target.value)}
                        className="w-full bg-gray-900 border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-3 py-2 text-base font-black text-emerald-300 outline-none"
                      />
                      <p className="text-[10px] text-gray-400">Amount received at POS / in advance</p>
                    </div>

                    {/* Remaining Balance */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                        Remaining Balance (₨) <span className="text-red-400">* Required</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="Enter remaining balance"
                        value={balanceAmount}
                        onChange={(e) => handleBalanceChange(e.target.value)}
                        className={`w-full bg-gray-900 border-2 rounded-xl px-3 py-2 text-base font-black text-amber-300 outline-none transition-all ${
                          !(balanceAmount != null && String(balanceAmount).trim() !== '' && parseFloat(balanceAmount) > 0)
                            ? 'border-red-500/70 focus:border-red-400'
                            : 'border-amber-500/50 focus:border-amber-400'
                        }`}
                      />
                      <p className="text-[10px] text-gray-400">Remaining amount to collect upon delivery</p>
                    </div>
                  </div>

                  {!(balanceAmount != null && String(balanceAmount).trim() !== '' && !isNaN(parseFloat(balanceAmount)) && parseFloat(balanceAmount) > 0) && (
                    <p className="text-[11px] font-black text-red-400 flex items-center gap-1 bg-red-950/30 p-2 rounded-lg border border-red-800/40">
                      ⚠️ Balance must be greater than zero. If the customer paid in full, select PAID above.
                    </p>
                  )}
                </div>
              )}

              {!paymentStatus && (
                <p className="text-[11px] font-black text-red-400 flex items-center gap-1 bg-red-950/30 p-2 rounded-lg border border-red-800/40">
                  ⚠️ Please select Paid or Balance before proceeding.
                </p>
              )}

              {/* Real-time Financial Breakdown Strip */}
              <div className="flex flex-wrap items-center justify-between text-xs pt-2 border-t border-gray-700/60 gap-2">
                <div className="flex items-center gap-4 text-gray-400 font-bold">
                  <span>Paid: <strong className="text-emerald-400 font-black">₨{(paymentStatus === 'PAID' ? totalAmount : (parseFloat(advanceAmount) || 0)).toLocaleString()}</strong></span>
                  <span>Balance: <strong className={paymentStatus === 'PAID' || (parseFloat(balanceAmount) || 0) === 0 ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>₨{(paymentStatus === 'PAID' ? 0 : Math.max(0, parseFloat(balanceAmount) || 0)).toLocaleString()}</strong></span>
                </div>
                <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                  paymentStatus === 'PAID'
                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                    : paymentStatus === 'BALANCE'
                    ? 'bg-red-900/40 text-red-300 border border-red-700/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {paymentStatus === 'PAID' ? '✓ FULLY PAID' : paymentStatus === 'BALANCE' ? `⚠ BALANCE DUE: ₨${(parseFloat(balanceAmount) || 0).toLocaleString()}` : 'STATUS PENDING'}
                </span>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-2">
              {products.some(p => (p.measurementSpecialNote || '').trim()) && (
                <div>
                  <p className="text-gray-400 font-bold mb-1.5 text-xs uppercase tracking-wider">Special Notes:</p>
                  <div className="space-y-1.5">
                    {products.map((p, idx) => {
                      const note = (p.measurementSpecialNote || '').trim();
                      if (!note) return null;
                      return (
                        <div key={p._tempId} className="flex items-start gap-2 bg-gray-900/60 p-2 rounded-lg border border-gray-700/50">
                          <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-black px-2 py-0.5 rounded-full shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 text-xs">
                            <span className="font-bold text-gray-300">{p.name}{p.color ? ` (${p.color})` : ''}: </span>
                            <span className="text-white font-medium whitespace-pre-wrap">{note}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {specialNotes && (
                <div className="pt-1 border-t border-gray-700/50 text-xs">
                  <span className="text-gray-400 font-bold">Order Notes: </span>
                  <span className="text-white font-medium">{specialNotes}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowJobSheetPreview(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-black py-4 px-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-pointer">
                <FileText size={18} /> Preview Job Sheet
              </button>
              <button onClick={handlePrintThermalSlipPreview}
                className="bg-slate-700 hover:bg-slate-600 text-white font-black py-4 px-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-pointer">
                <Printer size={18} /> Print Thermal Slip
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30">
                {submitting ? 'Placing Order...' : `Place Order — ₨${totalAmount.toLocaleString()}`}
              </button>
            </div>
          </div>
        )}

      </div>

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

      {/* ═══════════════════ Job Sheet Preview Modal ═══════════════════ */}
      {showJobSheetPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-black p-6 space-y-4">
            <div className="flex items-center justify-between border-b-4 border-black pb-3">
              <div className="text-center flex-1">
                <h1 className="text-xl font-black uppercase tracking-wider">Job Sheet</h1>
                <p className="text-xs font-bold text-gray-600">{outletName}</p>
              </div>
              <button onClick={() => setShowJobSheetPreview(false)} className="text-gray-400 hover:text-black"><X size={20} /></button>
            </div>
            <div className="flex justify-between text-xs font-black uppercase">
              <span>Order: {orderNumber}</span>
              <span>{formatDateOnly(new Date())}</span>
            </div>
            {priority !== 'NORMAL' && (
              <div className={`text-center py-1 rounded font-black text-xs uppercase ${priority === 'SUPER_URGENT' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {PRIORITY_OPTIONS.find(p => p.value === priority)?.label} PRIORITY
              </div>
            )}
            <div className={`text-center py-2 rounded-lg font-black text-xs uppercase border-2 ${deliveryType === 'SELF_COLLECTION' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
              {deliveryType === 'DELIVERY' ? '🚚 DELIVERY' : '🏪 SELF COLLECTION'}
            </div>
            {paymentStatus && (
              <div className={`text-center py-2.5 rounded-lg font-black text-sm uppercase border-2 tracking-wider ${paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-400' : 'bg-red-100 text-red-800 border-red-400'}`}>
                {paymentStatus === 'PAID' ? 'ORDER PAID' : `ORDER BALANCE${balanceAmount ? `: ₨ ${balanceAmount}` : ''}`}
              </div>
            )}
            <div className="text-xs font-bold space-y-0.5 border-b border-gray-200 pb-2">
              <p>Customer: {customer.name} — {customer.phone}</p>
              {customer.address && <p>Address: {customer.address}{customer.city ? `, ${customer.city}` : ''}</p>}
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-1 font-black">#</th>
                  <th className="text-left py-1 font-black">Product</th>
                  <th className="text-left py-1 font-black">Details</th>
                  <th className="text-right py-1 font-black">Qty</th>
                  <th className="text-right py-1 font-black">Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p._tempId} className="border-b border-gray-200">
                    <td className="py-1 font-bold">{i + 1}</td>
                    <td className="py-1 font-bold">{p.name}<span className="text-gray-500 ml-1">({p.gender})</span></td>
                    <td className="py-1 text-gray-600">
                      {[p.fabric, p.color, p.size, p.sleeveLength ? `Sleeve: ${p.sleeveLength}` : '', p.shirtLength ? `Shirt: ${p.shirtLength}` : ''].filter(Boolean).join(' • ')}
                      {p.matchingCap && <span className="text-purple-600 block">Cap ×{p.matchingCapQty}</span>}
                    </td>
                    <td className="py-1 text-right font-bold">{p.quantity}</td>
                    <td className="py-1 text-right font-black">₨{((p.unitPrice || 0) * (p.quantity || 1)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.some(p => p.engravingRequired) && (
              <div className="border-2 border-purple-300 rounded-lg p-3 space-y-2">
                <p className="text-xs font-black uppercase text-purple-700">Engraving / Branding</p>
                {products.map((p, idx) => {
                  if (!p.engravingRequired) return null;
                  const lines = (p.engravingLines || []).filter(l => l && l.trim());
                  const logos = (p.logoEntries || []).filter(l => l.name?.trim() || l.design?.trim());
                  return (
                    <div key={p._tempId} className="border-t border-purple-200 pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-purple-700 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black uppercase text-purple-950">
                          Article {idx + 1} — {p.name}{p.color ? ` (${p.color})` : ''}
                        </span>
                      </div>
                      <div className="pl-7 space-y-0.5 text-xs text-gray-700">
                        <p>Method: <span className="font-bold text-black">{(p.engravingType || 'direct') === 'direct' ? 'Direct' : 'Patch'}</span></p>
                        {lines.map((line, li) => (
                          <p key={li}>Line {li + 1}: <span className="font-bold text-black">{line}</span></p>
                        ))}
                        {p.engravingThreadColor && <p>Thread Color: <span className="font-bold text-black">{p.engravingThreadColor === 'Custom' ? p.customThreadColor : p.engravingThreadColor}</span></p>}
                        <p>Placement: <span className="font-bold text-black">{PLACEMENT_OPTIONS.find(o => o.value === (p.engravingPlacement || 'LeftChest'))?.label || p.engravingPlacement}</span></p>
                        {logos.map((l, li) => (
                          <p key={li}>Logo: <span className="font-bold text-black">{l.name}{l.design ? ` — ${l.design}` : ''}</span></p>
                        ))}
                        {p.engravingInstructions && <p className="mt-1 text-gray-800 font-medium">Instructions: <span className="font-bold">{p.engravingInstructions}</span></p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {products.some(p => (p.measurementSpecialNote || '').trim()) && (
              <div className="border-2 border-amber-300 rounded-lg p-3 space-y-2">
                <p className="text-xs font-black uppercase text-amber-700">Special Notes</p>
                {products.map((p, idx) => {
                  const note = (p.measurementSpecialNote || '').trim();
                  if (!note) return null;
                  return (
                    <div key={p._tempId} className="border-t border-amber-200 pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-start gap-2">
                        <span className="bg-amber-600 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-black text-amber-950 uppercase">
                            {idx + 1}. Special Note — {p.name}{p.color ? ` (${p.color})` : ''}
                          </p>
                          <p className="text-xs font-bold text-black whitespace-pre-wrap mt-0.5">{note}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {specialNotes && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-xs font-black uppercase mb-1 text-gray-700">Order Notes</p>
                <p className="text-xs font-bold text-black whitespace-pre-wrap">{specialNotes}</p>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t-2 border-black pt-2">
              <span>Total</span>
              <span>₨{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowJobSheetPreview(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-black font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <X size={16} /> Close Preview
              </button>
              <button onClick={handlePrintPreviewJobSheet}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Printer size={16} /> Print Job Sheet
              </button>
              <button onClick={async () => { setShowJobSheetPreview(false); await handleSubmit(); }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Accept & Place Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletOrderEntry;
