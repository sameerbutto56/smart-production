import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, User, Phone, MapPin, ShoppingBag, Ruler, FileText, CreditCard, CheckCircle, ChevronLeft, ChevronRight, Plus, X, RefreshCw, Printer, AlertTriangle, Truck, Store } from 'lucide-react';
import { formatDateOnly } from '../utils/dateTime';
import toast from 'react-hot-toast';

const STEPS = ['Customer', 'Products', 'Engraving', 'Measurements', 'Review'];

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
  gender: 'Male', matchingCap: false, matchingCapQty: 0
};

const OutletOrderEntry = () => {
  const { user } = useAuth();
  const outletName = user?.name || 'Outlet';
  const [searchParams] = useSearchParams();
  const prefilledOrderNumber = searchParams.get('orderNumber') || '';

  const [step, setStep] = useState(0);

  const [customerMode, setCustomerMode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);

  const [customer, setCustomer] = useState({ name: '', phone: '', address: '', city: '', notes: '' });

  const [orderNumber, setOrderNumber] = useState(prefilledOrderNumber || '');
  const [generatingNumber, setGeneratingNumber] = useState(false);

  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ ...EMPTY_PRODUCT });

  const [engravingRequired, setEngravingRequired] = useState(false);
  const [engravingType, setEngravingType] = useState('direct');
  const [engravingLines, setEngravingLines] = useState(['']);
  const [engravingThreadColor, setEngravingThreadColor] = useState('');
  const [customThreadColor, setCustomThreadColor] = useState('');
  const [engravingPlacement, setEngravingPlacement] = useState('LeftChest');
  const [logoEntries, setLogoEntries] = useState([{ name: '', design: '' }]);
  const [engravingInstructions, setEngravingInstructions] = useState('');

  const [logoDesign, setLogoDesign] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  const [sizeData, setSizeData] = useState({});
  const [clientStandardSizes, setClientStandardSizes] = useState([]);
  const [clientMeasurements, setClientMeasurements] = useState({});
  const [sizingMode, setSizingMode] = useState(null);
  const [selectedStandardSize, setSelectedStandardSize] = useState('');
  const [clientMeasurementChart, setClientMeasurementChart] = useState('');

  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [priority, setPriority] = useState('NORMAL');
  const [deliveryType, setDeliveryType] = useState('DELIVERY');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const [showJobSheetPreview, setShowJobSheetPreview] = useState(false);

  useEffect(() => {
    if (prefilledOrderNumber) setOrderNumber(prefilledOrderNumber);
  }, [prefilledOrderNumber]);

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
  }, []);

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
    const q = searchQuery.trim();
    if (!q) return toast.error('Enter phone number or name');
    setLookupLoading(true);
    setLookedUp(false);
    setClientData(null);
    setRecentOrders([]);
    setShowResults(false);
    try {
      const isPhone = /^[\d\-+ ]{7,}$/.test(q);
      const params = isPhone ? { phone: q } : { name: q };
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

  const selectClient = useCallback((client, orders) => {
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
    let normalized = {};
    setSizeData({});
    setClientMeasurements({});

    if (client.sizeDetails) {
      const raw = typeof client.sizeDetails === 'string'
        ? (() => { try { return JSON.parse(client.sizeDetails); } catch { return client.sizeDetails; } })()
        : client.sizeDetails;

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const { _extra, ...rest } = raw;
        const isPerProduct = Object.values(raw).some(v => typeof v === 'object' && v !== null && !Array.isArray(v));
        if (isPerProduct) {
          const normalizedPerProduct = {};
          Object.entries(raw).forEach(([prodName, measurements]) => {
            if (typeof measurements === 'object' && measurements !== null && !Array.isArray(measurements)) {
              normalizedPerProduct[prodName] = {};
              Object.entries(measurements).forEach(([k, v]) => {
                if (k === '_extra' || k === '_standardSize') { normalizedPerProduct[prodName][k] = v; return; }
                const mapped = FIELD_NAME_MAP[k.toLowerCase()] || k;
                normalizedPerProduct[prodName][mapped] = v;
              });
            } else { normalizedPerProduct[prodName] = measurements; }
          });
          setSizeData(normalizedPerProduct);
          const first = Object.values(normalizedPerProduct).find(v => typeof v === 'object' && v !== null);
          if (first) { setClientMeasurements(first); hasCustomFromDetails = Object.keys(first).filter(k => k !== '_extra').length > 0; }
          loaded = true;
        } else if (Object.keys(rest).length > 0) {
          hasCustomFromDetails = true;
          Object.keys(rest).forEach(k => {
            const mapped = FIELD_NAME_MAP[k.toLowerCase()] || k;
            normalized[mapped] = rest[k];
          });
          if (_extra && Array.isArray(_extra)) normalized._extra = _extra;
          setClientMeasurements(normalized);
        }
      } else if (typeof raw === 'string' && raw.trim()) {
        hasStandardFromDetails = true;
        preSelectedSize = raw.trim().toUpperCase();
      }
    }

    if (!loaded && orders && orders.length > 0 && orders[0].sizeData) {
      try {
        const raw = typeof orders[0].sizeData === 'string' ? JSON.parse(orders[0].sizeData) : orders[0].sizeData;
        if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
          setSizeData(raw);
          const first = Object.values(raw).find(v => typeof v === 'object' && v !== null);
          if (first) { setClientMeasurements(first); hasCustomFromDetails = true; }
          loaded = true;
        }
      } catch {}
    }

    const hasStandardOption = chart !== 'Custom Measurements' && (sizes.length > 0 || hasStandardFromDetails);
    const hasCustom = hasCustomFromDetails || chart === 'Custom Measurements';
    setSelectedStandardSize(preSelectedSize);
    if (hasStandardOption && hasCustom) setSizingMode('standard');
    else if (hasStandardOption) setSizingMode('standard');
    else if (hasCustom) setSizingMode('custom');
    else setSizingMode(null);

    toast.success(`Client ${client.name} loaded`);
  }, []);

  const handleStartNewCustomer = useCallback(() => {
    setCustomerMode('new');
    setClientData(null);
    setRecentOrders([]);
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
    setProducts(prev => [...prev, { ...newProduct, _tempId: Date.now() + Math.random() }]);
    setNewProduct({ ...EMPTY_PRODUCT });
  }, [newProduct]);

  const removeProduct = useCallback((idx) => setProducts(prev => prev.filter((_, i) => i !== idx)), []);

  const updateNewProduct = useCallback((field, value) => {
    setNewProduct(prev => ({ ...prev, [field]: value }));
  }, []);

  const CAP_UNIT_PRICE = 500;
  const totalAmount = useMemo(() => products.reduce((sum, p) => {
    const line = (parseFloat(p.unitPrice) || 0) * (p.quantity || 1);
    const cap = p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0;
    return sum + line + cap;
  }, 0), [products]);
  const advance = parseFloat(advanceAmount) || 0;
  const balance = totalAmount - advance;

  const canProceed = useMemo(() => {
    const hasOrderNumber = orderNumber.trim().length > 0;
    switch (step) {
      case 0:
        if (customerMode === 'existing') return lookedUp && clientData && customer.name.trim().length > 0 && hasOrderNumber;
        if (customerMode === 'new') return customer.name.trim().length > 0 && customer.phone.trim().length > 0 && hasOrderNumber;
        return false;
      case 1: return products.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  }, [step, customerMode, lookedUp, clientData, customer, products, orderNumber]);

  const nextStep = () => { if (canProceed) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const buildCustomization = useCallback(() => {
    const filteredNames = engravingLines.filter(l => l.trim());
    const filteredLogos = logoEntries.filter(l => l.name?.trim() || l.design?.trim());
    return {
      articleNames: filteredNames,
      nameSpelling: filteredNames.join(', '),
      nameColor: engravingThreadColor === 'Custom' ? customThreadColor : (engravingThreadColor || ''),
      logoColor: '',
      logoPlacement: engravingPlacement || '',
      designNotes: '',
      designReference: '',
      additionalFeatures: [],
      logos: filteredLogos,
      engravingType: engravingType || '',
      skipEngraving: !engravingRequired
    };
  }, [engravingLines, logoEntries, engravingThreadColor, customThreadColor, engravingPlacement, engravingType, engravingRequired]);

  const handleSubmit = async () => {
    if (products.length === 0) return toast.error('Add at least one product');
    setSubmitting(true);
    try {
      const engravingNames = engravingLines.filter(l => l.trim());
      const engravingLogos = logoEntries.filter(l => l.name?.trim() || l.design?.trim()).map(l => `${l.name}${l.design ? ' — ' + l.design : ''}`);
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
          capCharges: p.matchingCap ? (p.matchingCapQty || 0) * CAP_UNIT_PRICE : 0
        })),
        engravingRequired,
        engravingType: engravingRequired ? engravingType : null,
        engravingInstructions: engravingInstructions || null,
        logoRequired: logoEntries.some(l => l.name?.trim() || l.design?.trim()),
        logoDesign: logoDesign || null,
        engravingNames: engravingNames.length > 0 ? engravingNames : null,
        engravingLogos: engravingLogos.length > 0 ? engravingLogos : null,
        customization: buildCustomization(),
        sizeData: Object.keys(sizeData).length > 0 ? sizeData : null,
        standardSize: sizingMode === 'standard' ? selectedStandardSize : null,
        measurementChart: sizingMode === 'custom' ? 'Custom Measurements' : (selectedStandardSize || null),
        advanceAmount: advance,
        placedBy: user?.name || user?.id || null,
        priority,
        deliveryType
      };
      const res = await api.post('/api/outlet-orders', payload);
      setCreatedOrder(res.data);
      setSubmitted(true);
      toast.success(`Order ${res.data.orderNumber} placed!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    }
    setSubmitting(false);
  };

  const resetAll = () => {
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
    setEngravingRequired(false);
    setEngravingLines(['']);
    setEngravingThreadColor('');
    setCustomThreadColor('');
    setEngravingPlacement('LeftChest');
    setLogoEntries([{ name: '', design: '' }]);
    setEngravingInstructions('');
    setLogoDesign('');
    setSpecialNotes('');
    setSizeData({});
    setClientMeasurements({});
    setAdvanceAmount(0);
    setPriority('NORMAL');
    setDeliveryType('DELIVERY');
    setSubmitted(false);
    setCreatedOrder(null);
    setClientStandardSizes([]);
    setSizingMode(null);
    setSelectedStandardSize('');
    setClientMeasurementChart('');
    setOrderNumber('');
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 border-2 border-emerald-700 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Order Placed!</h2>
          <p className="text-lg font-bold text-blue-400">{createdOrder?.orderNumber}</p>
          {createdOrder?.invoiceNumber && <p className="text-sm font-bold text-amber-400">Invoice: {createdOrder.invoiceNumber}</p>}
          {priority !== 'NORMAL' && <p className="text-xs font-bold text-red-400">Priority: {PRIORITY_OPTIONS.find(p => p.value === priority)?.label}</p>}
          {customerMode === 'new' && (
            <p className="text-xs font-bold text-emerald-400">Customer saved to Client Registration</p>
          )}
          <div className="bg-gray-800 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-gray-400">Total: <span className="text-white font-black">₨{totalAmount.toLocaleString()}</span></p>
            {advance > 0 && <p className="text-gray-400">Advance: <span className="text-emerald-400 font-black">₨{advance.toLocaleString()}</span></p>}
            <p className="text-gray-400">Balance: <span className="text-amber-400 font-black">₨{Math.max(0, balance).toLocaleString()}</span></p>
          </div>
          <button onClick={resetAll} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm">
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 px-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-amber-600 rounded-2xl"><ShoppingBag className="text-white" size={24} /></div>
        <div>
          <h1 className="text-2xl font-black text-white">Outlet Order Entry</h1>
          <p className="text-sm font-bold text-gray-400">{outletName}</p>
        </div>
      </div>

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
                <p className="text-sm font-bold text-gray-400">Search by phone number or name:</p>
                <div className="flex gap-2">
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setLookedUp(false); setShowResults(false); }}
                    placeholder="Phone number or name"
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
                          className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl p-3 text-left">
                          <p className="text-sm font-black text-white">{client.name} <span className="text-blue-400 text-xs">#{client.clientNumber}</span></p>
                          <p className="text-xs text-gray-400">{client.phone}{client.city ? ` — ${client.city}` : ''}</p>
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
                      </div>
                      <button onClick={() => removeProduct(idx)} className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ Step 2: Engraving ═══════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><FileText size={18} />Engraving / Branding</h2>
            <label className="flex items-center gap-2 text-sm font-bold text-white cursor-pointer">
              <input type="checkbox" checked={engravingRequired} onChange={e => setEngravingRequired(e.target.checked)}
                className="accent-amber-500 w-5 h-5" />
              Engraving Required
            </label>
            {engravingRequired && (
              <div className="space-y-4 pl-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Engraving Method</label>
                  <div className="flex gap-2">
                    {[{ value: 'direct', label: 'Direct Engraving' }, { value: 'patch', label: 'Patch Engraving' }].map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEngravingType(opt.value)}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-2 ${
                          engravingType === opt.value
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
                    <label className="text-xs font-bold text-gray-400">Engraving Lines</label>
                    {engravingLines.length < 5 && (
                      <button type="button" onClick={() => setEngravingLines(prev => [...prev, ''])}
                        className="text-[10px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1">
                        <Plus size={12} /> Add Line
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {engravingLines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="bg-purple-500/20 text-purple-400 text-[10px] font-black px-2 py-1 rounded-lg shrink-0">L{i + 1}</span>
                        <input value={line} onChange={e => { const next = [...engravingLines]; next[i] = e.target.value; setEngravingLines(next); }}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none"
                          placeholder={`Engraving line ${i + 1}`} />
                        {engravingLines.length > 1 && (
                          <button onClick={() => setEngravingLines(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Thread / Text Color</label>
                    <select value={engravingThreadColor === 'Custom' ? 'Custom' : (engravingThreadColor || '')}
                      onChange={e => setEngravingThreadColor(e.target.value)}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-purple-500 outline-none appearance-none">
                      {THREAD_COLOR_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {engravingThreadColor === 'Custom' && (
                      <input value={customThreadColor} onChange={e => setCustomThreadColor(e.target.value)}
                        className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none mt-2"
                        placeholder="Enter custom color" />
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Placement</label>
                    <select value={engravingPlacement} onChange={e => setEngravingPlacement(e.target.value)}
                      className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-purple-500 outline-none appearance-none">
                      {PLACEMENT_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-400">Logos</label>
                    <button type="button" onClick={() => setLogoEntries(prev => [...prev, { name: '', design: '' }])}
                      className="text-[10px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1">
                      <Plus size={12} /> Add Logo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {logoEntries.map((logo, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={logo.name} onChange={e => { const next = [...logoEntries]; next[i] = { ...next[i], name: e.target.value }; setLogoEntries(next); }}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none"
                          placeholder="Logo name" />
                        <input value={logo.design} onChange={e => { const next = [...logoEntries]; next[i] = { ...next[i], design: e.target.value }; setLogoEntries(next); }}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white placeholder-gray-500 outline-none"
                          placeholder="Design description" />
                        {logoEntries.length > 1 && (
                          <button onClick={() => setLogoEntries(prev => prev.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Engraving Instructions</label>
                  <textarea value={engravingInstructions} onChange={e => setEngravingInstructions(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none resize-none" rows={2}
                    placeholder="Font, style, special instructions..." />
                </div>
              </div>
            )}
            {!engravingRequired && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">No engraving — tap Next to continue.</p>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Logo Design</label>
                  <input value={logoDesign} onChange={e => setLogoDesign(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                    placeholder="Logo name or design description" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Special Notes</label>
                  <textarea value={specialNotes} onChange={e => setSpecialNotes(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none" rows={2}
                    placeholder="Production instructions, fabric notes, urgent delivery..." />
                </div>
              </div>
            )}
            {engravingRequired && (
              <div className="pl-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Logo Design</label>
                  <input value={logoDesign} onChange={e => setLogoDesign(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none"
                    placeholder="Logo name or design description" />
                </div>
                <div className="mt-3">
                  <label className="text-xs font-bold text-gray-400 block mb-1">Special Notes</label>
                  <textarea value={specialNotes} onChange={e => setSpecialNotes(e.target.value)}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none resize-none" rows={2}
                    placeholder="Production instructions, fabric notes, urgent delivery..." />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ Step 3: Measurements ═══════════════════ */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2"><Ruler size={18} />Measurement Special Notes</h2>
            <p className="text-xs font-bold text-gray-500">Enter measurement instructions for each product separately.</p>
            {products.map((p, idx) => (
              <div key={p._tempId} className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
                <p className="text-sm font-black text-amber-400">{idx + 1}. {p.name} {p.color ? `(${p.color})` : ''}</p>
                <textarea
                  value={p.measurementSpecialNote}
                  onChange={e => {
                    const updated = [...products];
                    updated[idx] = { ...updated[idx], measurementSpecialNote: e.target.value };
                    setProducts(updated);
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-amber-500 outline-none resize-none"
                  rows={3}
                  placeholder={`Measurement instructions for ${p.name}...`}
                />
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════ Step 4: Review & Place ═══════════════════ */}
        {step === 4 && (
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

            <div className="bg-gray-800 rounded-xl p-4 text-sm space-y-1">
              <p className="text-gray-400">Engraving: <span className="text-white font-black">{engravingRequired ? 'Yes' : 'No'}</span></p>
              {engravingRequired && (
                <>
                  <p className="text-gray-400">Method: <span className="text-white font-black">{engravingType === 'direct' ? 'Direct' : 'Patch'}</span></p>
                  {engravingLines.some(l => l.trim()) && (
                    <p className="text-gray-400">Lines: <span className="text-white font-black">{engravingLines.filter(l => l.trim()).join(' | ')}</span></p>
                  )}
                  {engravingThreadColor && <p className="text-gray-400">Thread: <span className="text-purple-400 font-black">{engravingThreadColor === 'Custom' ? customThreadColor : engravingThreadColor}</span></p>}
                  <p className="text-gray-400">Placement: <span className="text-white font-black">{PLACEMENT_OPTIONS.find(p => p.value === engravingPlacement)?.label}</span></p>
                  {logoEntries.some(l => l.name?.trim() || l.design?.trim()) && (
                    <p className="text-gray-400">Logos: <span className="text-white font-black">{logoEntries.filter(l => l.name?.trim() || l.design?.trim()).map(l => `${l.name}${l.design ? ' — ' + l.design : ''}`).join(', ')}</span></p>
                  )}
                </>
              )}
              {logoDesign && <p className="text-gray-400">Logo Design: <span className="text-white font-black">{logoDesign}</span></p>}
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-bold">Total Amount</span>
                <span className="text-white font-black">₨{totalAmount.toLocaleString()}</span>
              </div>
              <p className="text-[10px] font-bold text-gray-500">Payment handled at POS — no advance required here.</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 text-sm">
              {products.filter(p => p.measurementSpecialNote).length > 0 && (
                <div className="mb-1">
                  <p className="text-gray-400 font-bold mb-1">Measurement Notes:</p>
                  {products.filter(p => p.measurementSpecialNote).map((p, i) => (
                    <p key={p._tempId} className="text-amber-400 font-bold ml-2">• {p.name}: <span className="text-white">{p.measurementSpecialNote}</span></p>
                  ))}
                </div>
              )}
              {specialNotes && <p className="text-gray-400">Special Notes: <span className="text-white font-black">{specialNotes}</span></p>}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowJobSheetPreview(true)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl text-lg flex items-center justify-center gap-2">
                <Printer size={20} /> Preview Job Sheet
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-lg disabled:opacity-50 flex items-center justify-center gap-2">
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
            {engravingRequired && (
              <div className="border-2 border-purple-300 rounded-lg p-3 space-y-2">
                <p className="text-xs font-black uppercase text-purple-700">Engraving / Branding</p>
                <p className="text-xs">Method: <span className="font-black">{engravingType === 'direct' ? 'Direct' : 'Patch'}</span></p>
                {engravingLines.filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-xs">Line {i + 1}: <span className="font-black">{line}</span></p>
                ))}
                {engravingThreadColor && <p className="text-xs">Thread Color: <span className="font-black">{engravingThreadColor === 'Custom' ? customThreadColor : engravingThreadColor}</span></p>}
                <p className="text-xs">Placement: <span className="font-black">{PLACEMENT_OPTIONS.find(p => p.value === engravingPlacement)?.label}</span></p>
                {logoEntries.filter(l => l.name?.trim() || l.design?.trim()).map((l, i) => (
                  <p key={i} className="text-xs">Logo: <span className="font-black">{l.name}{l.design ? ` — ${l.design}` : ''}</span></p>
                ))}
                {engravingInstructions && <p className="text-xs mt-1">Instructions: <span className="font-black">{engravingInstructions}</span></p>}
              </div>
            )}
            {products.some(p => p.measurementSpecialNote) && (
              <div className="border-2 border-amber-300 rounded-lg p-3 space-y-1">
                <p className="text-xs font-black uppercase text-amber-700">Measurement Notes</p>
                {products.filter(p => p.measurementSpecialNote).map((p, i) => (
                  <p key={p._tempId} className="text-xs">{p.name}: <span className="font-bold">{p.measurementSpecialNote}</span></p>
                ))}
              </div>
            )}
            {specialNotes && (
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-xs font-black uppercase mb-1">Special Notes</p>
                <p className="text-xs font-bold">{specialNotes}</p>
              </div>
            )}
            <div className="flex justify-between text-sm font-black border-t-2 border-black pt-2">
              <span>Total</span>
              <span>₨{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowJobSheetPreview(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-black font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <X size={16} /> Reject
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
