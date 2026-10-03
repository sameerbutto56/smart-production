import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Printer,
  Search,
  CheckCircle2,
  Edit3,
  Building2,
  DollarSign,
  User,
  Phone,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Landmark,
  ArrowLeft,
  Plus,
  Trash2,
  PlusCircle,
  Package,
  ShoppingBag,
  Tag,
  X,
  Save,
  Clock,
  Layers,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  A4_PRINT_CSS,
  buildOutletDocumentHTML,
  printOutletDocument,
  getLogoSrc
} from '../utils/outletInvoiceQuotationPrint';

// Helper: Group raw outlet inventory into clean unique products with variants, colors, and sizes
function groupOutletProducts(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const map = new Map();

  for (const it of rawItems) {
    if (!it.name) continue;
    const key = it.name.trim();

    if (!map.has(key)) {
      let rawVariants = it.variants;
      if (typeof rawVariants === 'string') {
        try { rawVariants = JSON.parse(rawVariants); } catch (e) {}
      }

      map.set(key, {
        id: it.id,
        name: it.name.trim(),
        category: (it.category || 'SCRUBS').toUpperCase(),
        price: parseFloat(it.price) || 0,
        imageUrl: it.imageUrl || null,
        colorImages: (it.colorImages && typeof it.colorImages === 'object') ? it.colorImages : {},
        colors: new Set(it.color ? [it.color.trim()] : []),
        sizes: new Set(it.size ? [it.size.trim()] : []),
        rawVariants: Array.isArray(rawVariants) ? rawVariants : []
      });
    }

    const p = map.get(key);
    if (it.color) p.colors.add(it.color.trim());
    if (it.size) p.sizes.add(it.size.trim());
    if (!p.price && it.price) p.price = parseFloat(it.price) || 0;
    if (!p.imageUrl && it.imageUrl) p.imageUrl = it.imageUrl;

    if (it.colorImages && typeof it.colorImages === 'object') {
      p.colorImages = { ...p.colorImages, ...it.colorImages };
    }

    if (it.variants) {
      let vArr = it.variants;
      if (typeof vArr === 'string') {
        try { vArr = JSON.parse(vArr); } catch (e) {}
      }
      if (Array.isArray(vArr)) {
        for (const v of vArr) {
          if (v && v.color) p.colors.add(v.color.trim());
          if (v && v.size) p.sizes.add(v.size.trim());
          if (v && v.price && !p.price) p.price = parseFloat(v.price) || 0;
        }
      }
    }
  }

  return Array.from(map.values())
    .map(p => ({
      ...p,
      colors: Array.from(p.colors).filter(Boolean),
      sizes: Array.from(p.sizes).filter(Boolean)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Generate unique clean document sequence number
function generateDocRefNumber(type = 'INVOICE') {
  const d = new Date();
  const dateStr = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = type.toUpperCase() === 'INVOICE' ? 'INV-JT' : 'QT-JT';
  return `${prefix}-${dateStr}-${rand}`;
}

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Products' },
  { id: 'SCRUBS', label: 'Scrubs' },
  { id: 'LABCOAT', label: 'Lab Coats' },
  { id: 'CAPS', label: 'Caps' },
  { id: 'SHOES', label: 'Shoes / Clogs' },
  { id: 'ACCESSORIES', label: 'Accessories' }
];

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'C', 'Free Size'];

export default function OutletInvoiceQuotation() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const outletRaw = String(user?.name || '').toLowerCase();
  const isJoharTown = outletRaw.includes('johar') || user?.name?.includes('1');
  const outletDisplayName = user?.outletName || (isJoharTown ? 'Johar Town Outlet' : user?.name || 'Johar Town Outlet');

  // Top Mode: 'CREATE_NEW' (default) vs 'LOAD_EXISTING'
  const [mode, setMode] = useState('CREATE_NEW');

  // Document state
  const [docType, setDocType] = useState('INVOICE'); // 'INVOICE' | 'QUOTATION'
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  // Loaded Order State (Mode: LOAD_EXISTING)
  const [orderQuery, setOrderQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadedOrder, setLoadedOrder] = useState(null);

  // Products Catalog State (Mode: CREATE_NEW)
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // New Document Header Data
  const [docRefNumber, setDocRefNumber] = useState(() => generateDocRefNumber('INVOICE'));
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('Lahore');
  const [deliveryMethod, setDeliveryMethod] = useState('Store Pickup');

  // New Document Financial Data
  const [discountAmount, setDiscountAmount] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('BALANCE');

  // New Document Line Items
  const [docItems, setDocItems] = useState([
    {
      id: 'default-1',
      name: 'Sprinter Men',
      category: 'SCRUBS',
      color: 'Navy Blue',
      size: 'M',
      fabric: 'Sprinter',
      quantity: 1,
      unitPrice: 5150,
      customizations: ''
    }
  ]);

  // Current Item Adder Form
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'SCRUBS',
    color: '',
    customColor: '',
    size: '',
    customSize: '',
    quantity: 1,
    unitPrice: 0,
    customizations: ''
  });

  // Permitted editable fields (Terms & Remarks)
  const [customFields, setCustomFields] = useState({
    customerRemarks: '',
    specialInstructions: '',
    termsAndConditions: '',
    preparedBy: user?.name || 'Johar Town Outlet'
  });

  // Recent Documents (Stored in localStorage)
  const [recentDocs, setRecentDocs] = useState([]);
  const [showRecentModal, setShowRecentModal] = useState(false);

  // Preview zoom & iframe ref
  const [zoomLevel, setZoomLevel] = useState(85);
  const iframeRef = useRef(null);

  // Load logo
  useEffect(() => {
    getLogoSrc().then((url) => setLogoUrl(url));
  }, []);

  // Load Saved Recent Documents from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('enamels_saved_outlet_docs');
      if (saved) {
        setRecentDocs(JSON.parse(saved));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Fetch Full Products List from Johar Town Outlet Inventory
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      // Fetch Johar Town products
      const res = await api.get('/api/pos/products?outlet=Johar Town');
      const raw = Array.isArray(res.data) ? res.data : [];
      const grouped = groupOutletProducts(raw);
      setProducts(grouped);
      if (grouped.length > 0 && !selectedProductId) {
        const first = grouped[0];
        setSelectedProductId(first.id);
        setItemForm({
          name: first.name,
          category: first.category,
          color: first.colors[0] || '',
          customColor: '',
          size: first.sizes[0] || 'M',
          customSize: '',
          quantity: 1,
          unitPrice: first.price || 0,
          customizations: ''
        });
      }
    } catch (err) {
      console.warn('Could not fetch outlet-specific products, trying general catalog:', err);
      try {
        const res2 = await api.get('/api/pos/products');
        const raw2 = Array.isArray(res2.data) ? res2.data : [];
        const grouped2 = groupOutletProducts(raw2);
        setProducts(grouped2);
      } catch (err2) {
        console.error('Failed to load products list:', err2);
      }
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle URL Query Params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderNum = params.get('orderNumber');
    const typeParam = params.get('type');
    if (typeParam && (typeParam.toUpperCase() === 'INVOICE' || typeParam.toUpperCase() === 'QUOTATION')) {
      const t = typeParam.toUpperCase();
      setDocType(t);
      setDocRefNumber(generateDocRefNumber(t));
    }
    if (orderNum) {
      setMode('LOAD_EXISTING');
      setOrderQuery(orderNum);
      handleLoadOrder(orderNum);
    }
  }, [location.search]);

  // Handle Doc Type Toggle (updates reference prefix)
  const handleDocTypeChange = (newType) => {
    setDocType(newType);
    setDocRefNumber(generateDocRefNumber(newType));
  };

  // When a product is selected in Adder dropdown
  const handleSelectProduct = (prodId) => {
    setSelectedProductId(prodId);
    const found = products.find(p => p.id === prodId);
    if (found) {
      setItemForm({
        name: found.name,
        category: found.category,
        color: found.colors[0] || '',
        customColor: '',
        size: found.sizes[0] || 'M',
        customSize: '',
        quantity: 1,
        unitPrice: found.price || 0,
        customizations: ''
      });
    }
  };

  // Add Item to Document
  const handleAddItemToDocument = (e) => {
    if (e) e.preventDefault();
    const finalName = itemForm.name.trim();
    if (!finalName) {
      toast.error('Please enter or select a product name');
      return;
    }

    const finalColor = itemForm.color === '__custom__' ? itemForm.customColor.trim() : (itemForm.color || itemForm.customColor).trim();
    const finalSize = itemForm.size === '__custom__' ? itemForm.customSize.trim() : (itemForm.size || itemForm.customSize).trim();
    const qty = parseInt(itemForm.quantity, 10) || 1;
    const unitPrice = parseFloat(itemForm.unitPrice) || 0;

    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: finalName,
      category: itemForm.category || 'SCRUBS',
      color: finalColor,
      size: finalSize,
      fabric: itemForm.category === 'SCRUBS' ? 'Sprinter' : '',
      quantity: qty,
      unitPrice,
      customizations: itemForm.customizations.trim()
    };

    setDocItems(prev => [...prev, newItem]);
    toast.success(`Added ${finalName}`);

    // Reset customizations and quantity
    setItemForm(prev => ({
      ...prev,
      quantity: 1,
      customizations: ''
    }));
  };

  // Quick Add from Catalog Modal
  const handleQuickAddFromCatalog = (prod) => {
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: prod.name,
      category: prod.category || 'SCRUBS',
      color: prod.colors[0] || 'Standard',
      size: prod.sizes[0] || 'M',
      fabric: '',
      quantity: 1,
      unitPrice: prod.price || 0,
      customizations: ''
    };
    setDocItems(prev => [...prev, newItem]);
    toast.success(`Added ${prod.name}`);
  };

  // Remove Item
  const handleRemoveItem = (itemId) => {
    setDocItems(prev => {
      const filtered = prev.filter(it => it.id !== itemId);
      if (filtered.length === 0) {
        toast('Document is now empty', { icon: 'ℹ️' });
      }
      return filtered;
    });
  };

  // Update Item Quantity
  const handleUpdateItemQty = (itemId, delta) => {
    setDocItems(prev =>
      prev.map(it => {
        if (it.id === itemId) {
          const newQty = Math.max(1, (it.quantity || 1) + delta);
          return { ...it, quantity: newQty };
        }
        return it;
      })
    );
  };

  // Update Item Price Inline
  const handleUpdateItemPrice = (itemId, newPrice) => {
    const priceVal = Math.max(0, parseFloat(newPrice) || 0);
    setDocItems(prev =>
      prev.map(it => (it.id === itemId ? { ...it, unitPrice: priceVal } : it))
    );
  };

  // Load order data (Mode: LOAD_EXISTING)
  const handleLoadOrder = async (orderNum) => {
    const q = (orderNum || orderQuery).trim();
    if (!q) {
      toast.error('Please enter an order number');
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/api/outlet-orders/order-lookup/${q}`);
      if (res.data?.order) {
        setLoadedOrder(res.data.order);
        toast.success(`Loaded order ${res.data.order.orderNumber || ''}`);
      } else {
        toast.error('Order not found');
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      toast.error(err.response?.data?.message || 'Order lookup failed');
    } finally {
      setSearching(false);
    }
  };

  // Filtered Products for Catalog Search & Category Tabs
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = !catalogSearch ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.colors.some(c => c.toLowerCase().includes(catalogSearch.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, catalogSearch, selectedCategory]);

  // Calculate Subtotal and Grand Total for newly created document
  const newDocSubtotal = useMemo(() => {
    return docItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  }, [docItems]);

  const newDocGrandTotal = useMemo(() => {
    return Math.max(0, newDocSubtotal + (parseFloat(deliveryCharges) || 0) - (parseFloat(discountAmount) || 0));
  }, [newDocSubtotal, deliveryCharges, discountAmount]);

  const newDocBalance = useMemo(() => {
    return Math.max(0, newDocGrandTotal - (parseFloat(advanceAmount) || 0));
  }, [newDocGrandTotal, advanceAmount]);

  // Compute Active Order for live A4 document generation
  const activeOrder = useMemo(() => {
    if (mode === 'LOAD_EXISTING' && loadedOrder) {
      return loadedOrder;
    }

    // Format synthesized order object for CREATE_NEW mode
    const productDetails = docItems.map(it => ({
      name: it.name,
      category: it.category,
      color: it.color,
      size: it.size,
      fabric: it.fabric,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.quantity * it.unitPrice,
      engravingRequired: Boolean(it.customizations),
      engravingText: it.customizations
    }));

    return {
      orderNumber: docRefNumber,
      invoiceNumber: docType === 'INVOICE' ? docRefNumber : undefined,
      quotationNumber: docType === 'QUOTATION' ? docRefNumber : undefined,
      customerName: customerName.trim() || (hospitalName ? `${hospitalName} (Valued Client)` : 'VALUED CUSTOMER'),
      customerPhone: customerPhone.trim() || '—',
      address: [hospitalName ? `Hospital/Org: ${hospitalName}` : '', customerAddress].filter(Boolean).join(', '),
      city: customerCity.trim() || 'Lahore',
      outletName: outletDisplayName,
      createdAt: docDate ? new Date(docDate).toISOString() : new Date().toISOString(),
      deliveryMethod,
      totalPrice: newDocSubtotal,
      deliveryCharges: parseFloat(deliveryCharges) || 0,
      discountAmount: parseFloat(discountAmount) || 0,
      advanceAmount: parseFloat(advanceAmount) || 0,
      balanceAmount: newDocBalance,
      paymentStatus: docType === 'QUOTATION' ? 'QUOTATION' : (newDocBalance <= 0.01 ? 'PAID' : paymentStatus),
      productDetails
    };
  }, [
    mode,
    loadedOrder,
    docItems,
    docRefNumber,
    docType,
    customerName,
    hospitalName,
    customerPhone,
    customerAddress,
    customerCity,
    outletDisplayName,
    docDate,
    deliveryMethod,
    newDocSubtotal,
    deliveryCharges,
    discountAmount,
    advanceAmount,
    newDocBalance,
    paymentStatus
  ]);

  // Update iframe document preview whenever activeOrder, docType, customFields, or logoUrl changes
  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentWindow?.document;
    if (!doc) return;

    const htmlContent = buildOutletDocumentHTML({
      order: activeOrder,
      docType,
      customFields,
      logoUrl
    });

    doc.open();
    doc.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${A4_PRINT_CSS}</style>
          <style>
            body { padding: 12px; background: #ffffff; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>`);
    doc.close();
  }, [activeOrder, docType, customFields, logoUrl]);

  // Trigger print
  const handlePrint = () => {
    if (mode === 'LOAD_EXISTING' && !loadedOrder) {
      toast.error('Please load an order first before printing');
      return;
    }
    if (mode === 'CREATE_NEW' && docItems.length === 0) {
      toast.error('Please add at least one product before printing');
      return;
    }

    // Auto-save to recent documents
    if (mode === 'CREATE_NEW') {
      handleSaveDocument(false);
    }

    printOutletDocument({
      order: activeOrder,
      docType,
      customFields
    });
  };

  // Save current document to localStorage
  const handleSaveDocument = (showNotification = true) => {
    try {
      const record = {
        id: docRefNumber,
        docRefNumber,
        docType,
        customerName: customerName.trim() || 'Valued Customer',
        customerPhone,
        grandTotal: newDocGrandTotal,
        itemsCount: docItems.length,
        savedAt: new Date().toISOString(),
        orderData: activeOrder,
        customFieldsData: customFields
      };

      const updated = [record, ...recentDocs.filter(d => d.docRefNumber !== docRefNumber)].slice(0, 30);
      setRecentDocs(updated);
      localStorage.setItem('enamels_saved_outlet_docs', JSON.stringify(updated));
      if (showNotification) {
        toast.success(`Saved ${docType} ${docRefNumber} to recent documents`);
      }
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  // Load a saved document
  const handleLoadSavedDocument = (savedDoc) => {
    setMode('CREATE_NEW');
    setDocType(savedDoc.docType || 'INVOICE');
    setDocRefNumber(savedDoc.docRefNumber || generateDocRefNumber(savedDoc.docType || 'INVOICE'));
    setCustomerName(savedDoc.orderData?.customerName || '');
    setCustomerPhone(savedDoc.orderData?.customerPhone || '');
    setCustomerAddress(savedDoc.orderData?.address || '');
    setCustomerCity(savedDoc.orderData?.city || 'Lahore');
    setDeliveryMethod(savedDoc.orderData?.deliveryMethod || 'Store Pickup');
    setDiscountAmount(savedDoc.orderData?.discountAmount || 0);
    setDeliveryCharges(savedDoc.orderData?.deliveryCharges || 0);
    setAdvanceAmount(savedDoc.orderData?.advanceAmount || 0);

    if (Array.isArray(savedDoc.orderData?.productDetails)) {
      setDocItems(
        savedDoc.orderData.productDetails.map((p, idx) => ({
          id: `saved-item-${idx}`,
          name: p.name,
          category: p.category || 'SCRUBS',
          color: p.color || '',
          size: p.size || '',
          fabric: p.fabric || '',
          quantity: p.quantity || 1,
          unitPrice: p.unitPrice || 0,
          customizations: p.engravingText || ''
        }))
      );
    }

    if (savedDoc.customFieldsData) {
      setCustomFields(savedDoc.customFieldsData);
    }

    setShowRecentModal(false);
    toast.success(`Loaded ${savedDoc.docRefNumber}`);
  };

  // Reset / Clear Form for New Invoice
  const handleResetNewDocument = () => {
    const newRef = generateDocRefNumber(docType);
    setDocRefNumber(newRef);
    setDocDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerPhone('');
    setHospitalName('');
    setCustomerAddress('');
    setCustomerCity('Lahore');
    setDiscountAmount(0);
    setDeliveryCharges(0);
    setAdvanceAmount(0);
    setPaymentStatus('BALANCE');
    setDocItems([]);
    toast.success('Started a fresh blank document');
  };

  // Currently selected product object in adder
  const activeSelectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/outlet-orders')}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Invoice &amp; Quotation Generator
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Johar Town
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Create new custom invoices &amp; quotations from full product catalog, or load existing order numbers
            </p>
          </div>
        </div>

        {/* Action Buttons: Recent, New, Print */}
        <div className="flex flex-wrap items-center gap-2.5">
          {recentDocs.length > 0 && (
            <button
              onClick={() => setShowRecentModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold transition-colors"
            >
              <Clock size={14} className="text-cyan-400" />
              Recent ({recentDocs.length})
            </button>
          )}

          {mode === 'CREATE_NEW' && (
            <>
              <button
                onClick={handleResetNewDocument}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-bold transition-colors"
                title="Start a blank document"
              >
                <RefreshCw size={14} />
                New Blank
              </button>

              <button
                onClick={() => handleSaveDocument(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-bold transition-colors"
                title="Save Draft"
              >
                <Save size={14} className="text-emerald-400" />
                Save Draft
              </button>
            </>
          )}

          <button
            onClick={handlePrint}
            disabled={mode === 'LOAD_EXISTING' ? !loadedOrder : docItems.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 border border-emerald-500/30 transition-all active:scale-95"
          >
            <Printer size={16} />
            Print A4 {docType}
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Preview (7 cols), Right Controls (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: A4 DOCUMENT PREVIEW (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col items-center sticky top-4">
          {/* Preview Toolbar */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5 text-slate-300">
              <FileText size={14} className="text-emerald-400" />
              Live A4 Print Preview
              {mode === 'CREATE_NEW' ? (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  (Live Editing • {docItems.length} {docItems.length === 1 ? 'Item' : 'Items'})
                </span>
              ) : !loadedOrder ? (
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  (Sample Preview)
                </span>
              ) : (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                  ({loadedOrder.orderNumber})
                </span>
              )}
            </span>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="font-mono text-[11px] w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>

          {/* Realistic A4 Paper Simulation Container */}
          <div
            className="w-full overflow-auto flex justify-center p-2 rounded-xl bg-slate-950/70 border border-slate-800/80"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            <div
              style={{
                width: `${(210 * 3.7795 * zoomLevel) / 100}px`,
                minHeight: `${(297 * 3.7795 * zoomLevel) / 100}px`,
                transformOrigin: 'top center',
                transition: 'all 0.15s ease'
              }}
              className="bg-white shadow-2xl rounded-sm overflow-hidden"
            >
              <iframe
                ref={iframeRef}
                title="A4 Document Preview"
                className="w-full border-none"
                style={{
                  height: `${(297 * 3.7795 * zoomLevel) / 100}px`,
                  minHeight: '750px'
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CONTROLS & SELECTION (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Mode Switcher & Document Type Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3.5">
            {/* Mode Switcher: Create New vs Load Existing */}
            <div>
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('CREATE_NEW')}
                  className={`flex-1 py-2 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    mode === 'CREATE_NEW'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PlusCircle size={14} />
                  <span>Create New</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('LOAD_EXISTING')}
                  className={`flex-1 py-2 px-3 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    mode === 'LOAD_EXISTING'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Search size={14} />
                  <span>Load Order #</span>
                </button>
              </div>
            </div>

            {/* Document Type: Invoice vs Quotation */}
            <div className="pt-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Document Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDocTypeChange('INVOICE')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    docType === 'INVOICE'
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${docType === 'INVOICE' ? 'border-white bg-white' : 'border-slate-500'}`}>
                    {docType === 'INVOICE' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </div>
                  INVOICE
                </button>

                <button
                  type="button"
                  onClick={() => handleDocTypeChange('QUOTATION')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    docType === 'QUOTATION'
                      ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-900/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${docType === 'QUOTATION' ? 'border-white bg-white' : 'border-slate-500'}`}>
                    {docType === 'QUOTATION' && <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                  </div>
                  QUOTATION
                </button>
              </div>
            </div>
          </div>

          {/* ────────────────── MODE 1: CREATE NEW DOCUMENT ────────────────── */}
          {mode === 'CREATE_NEW' && (
            <>
              {/* Customer & Reference Details Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-emerald-400" />
                    Customer &amp; Document Info
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDocRefNumber(generateDocRefNumber(docType))}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                    title="Generate new reference number"
                  >
                    <RefreshCw size={11} /> {docRefNumber}
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Customer Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Dr. Sarah Ahmed"
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Contact Phone #
                      </label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="e.g. 0300-1234567"
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Hospital / Company (Optional)
                      </label>
                      <input
                        type="text"
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="e.g. Shaukat Khanum, Doctors Hospital..."
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        placeholder="Lahore"
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Document Date
                      </label>
                      <input
                        type="date"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Delivery Method
                      </label>
                      <select
                        value={deliveryMethod}
                        onChange={(e) => setDeliveryMethod(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Store Pickup">Store Pickup (Johar Town)</option>
                        <option value="Courier Delivery">Courier Delivery (TCS/PostEx)</option>
                        <option value="Direct Handover">Direct Handover</option>
                        <option value="Corporate Dispatch">Corporate Dispatch</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Delivery Address / Notes
                    </label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="e.g. 152-G1 Canal Bank Road, Johar Town..."
                      className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Product Selection & Adder Card ("Full List of All My Products") */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={14} className="text-teal-400" />
                    Product Catalog Selector ({products.length} Products)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCatalogModal(true)}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20"
                  >
                    <Layers size={12} /> Browse Catalog
                  </button>
                </div>

                {/* Product Search & Dropdown Picker */}
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Choose Product from Catalog
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectProduct(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-medium"
                    >
                      <option value="" disabled>-- Select a Product ({products.length} available) --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} • {p.category} (Rs. {p.price.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Product Pill & Available Colors/Sizes Preview */}
                  {activeSelectedProduct && (
                    <div className="p-2.5 bg-slate-950/50 rounded-xl border border-slate-800 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1">
                          <ShoppingBag size={12} className="text-teal-400" />
                          {activeSelectedProduct.name}
                        </span>
                        <span className="font-bold text-emerald-400 font-mono">
                          Base: Rs. {activeSelectedProduct.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
                        <span className="text-slate-500 font-semibold">Available Colors:</span>
                        {activeSelectedProduct.colors.slice(0, 6).map(c => (
                          <span key={c} className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded text-[9.5px]">
                            {c}
                          </span>
                        ))}
                        {activeSelectedProduct.colors.length > 6 && (
                          <span className="text-slate-500">+{activeSelectedProduct.colors.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Item Specific Fields: Color, Size, Qty, Unit Price */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Color
                      </label>
                      <select
                        value={itemForm.color}
                        onChange={(e) => setItemForm({ ...itemForm, color: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                      >
                        <option value="">Standard / Default</option>
                        {activeSelectedProduct?.colors.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__custom__">Custom Color...</option>
                      </select>
                      {itemForm.color === '__custom__' && (
                        <input
                          type="text"
                          value={itemForm.customColor}
                          onChange={(e) => setItemForm({ ...itemForm, customColor: e.target.value })}
                          placeholder="Type color name..."
                          className="mt-1 w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Size
                      </label>
                      <select
                        value={itemForm.size}
                        onChange={(e) => setItemForm({ ...itemForm, size: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                      >
                        <option value="">Standard / Free</option>
                        {(activeSelectedProduct?.sizes.length ? activeSelectedProduct.sizes : STANDARD_SIZES).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__custom__">Custom Size...</option>
                      </select>
                      {itemForm.size === '__custom__' && (
                        <input
                          type="text"
                          value={itemForm.customSize}
                          onChange={(e) => setItemForm({ ...itemForm, customSize: e.target.value })}
                          placeholder="Type custom size (e.g. 42 Regular)..."
                          className="mt-1 w-full px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-teal-500"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={itemForm.quantity}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-semibold block mb-1">
                        Unit Price (PKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={itemForm.unitPrice}
                        onChange={(e) => setItemForm({ ...itemForm, unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-teal-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Customization / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={itemForm.customizations}
                      onChange={(e) => setItemForm({ ...itemForm, customizations: e.target.value })}
                      placeholder="e.g. Name: Dr. Sarah, Chest Logo, Matching Cap..."
                      className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={handleAddItemToDocument}
                    className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/30 transition-all active:scale-95"
                  >
                    <Plus size={15} />
                    <span>Add Item to {docType}</span>
                  </button>
                </div>
              </div>

              {/* Items List in Document */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" />
                    Items in Document ({docItems.length})
                  </h3>
                  {docItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDocItems([])}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {docItems.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    No products added yet. Select a product above or click "Browse Catalog" to add items.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {docItems.map((it, idx) => (
                      <div
                        key={it.id}
                        className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                            <span>{it.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex flex-wrap gap-1 mt-0.5">
                            {it.color && <span>Color: <strong className="text-slate-300">{it.color}</strong></span>}
                            {it.size && <span>• Size: <strong className="text-slate-300">{it.size}</strong></span>}
                            {it.customizations && <span className="text-blue-400 italic">• {it.customizations}</span>}
                          </div>
                        </div>

                        {/* Inline Qty Controls & Line Total */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center border border-slate-800 rounded-lg bg-slate-900">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.id, -1)}
                              className="px-2 py-0.5 text-slate-400 hover:text-white"
                            >
                              -
                            </button>
                            <span className="px-2 text-xs font-bold text-white">{it.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.id, 1)}
                              className="px-2 py-0.5 text-slate-400 hover:text-white"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right w-20">
                            <span className="font-bold text-emerald-400 font-mono text-xs block">
                              Rs. {(it.quantity * it.unitPrice).toLocaleString()}
                            </span>
                            <span className="text-[9.5px] text-slate-500">
                              @{it.unitPrice.toLocaleString()}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            title="Remove Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal & Adjustment Controls */}
                {docItems.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Subtotal ({docItems.length} items):</span>
                      <span className="font-bold text-white font-mono">Rs. {newDocSubtotal.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                          Discount (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-2 py-1 bg-slate-950/70 border border-slate-700 rounded-lg text-xs text-emerald-400 font-bold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                          Delivery Charges (Rs.)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={deliveryCharges}
                          onChange={(e) => setDeliveryCharges(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-2 py-1 bg-slate-950/70 border border-slate-700 rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="font-bold text-white uppercase tracking-wider text-xs">Grand Total:</span>
                      <span className="text-base font-black text-emerald-400 font-mono">
                        Rs. {newDocGrandTotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Invoice Payment Breakdown */}
                    {docType === 'INVOICE' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Advance Received (Rs.)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={advanceAmount}
                            onChange={(e) => setAdvanceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1 bg-slate-950/70 border border-slate-700 rounded-lg text-xs text-white focus:outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                            Balance Due (Rs.)
                          </label>
                          <div className={`px-2 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-black font-mono ${newDocBalance > 0.01 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            Rs. {newDocBalance.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ────────────────── MODE 2: LOAD EXISTING ORDER ────────────────── */}
          {mode === 'LOAD_EXISTING' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Search Existing Order</span>
                {loadedOrder && (
                  <span className="text-emerald-400 font-bold font-mono text-[11px]">
                    ✓ {loadedOrder.orderNumber}
                  </span>
                )}
              </h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadOrder()}
                  placeholder="Enter Order # (e.g. JT-132222, 50335)..."
                  className="flex-1 px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleLoadOrder()}
                  disabled={searching}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Search size={14} className={searching ? 'animate-spin' : ''} />
                  Load
                </button>
              </div>

              {loadedOrder && (
                <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-bold text-white">{loadedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-mono text-slate-200">{loadedOrder.customerPhone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total:</span>
                    <span className="font-bold text-emerald-400">Rs. {parseFloat(loadedOrder.totalPrice || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Permitted Custom Remarks & Terms Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 size={14} className="text-blue-400" />
              Custom Remarks &amp; Terms
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Customer Remarks / Notes:
                </label>
                <input
                  type="text"
                  value={customFields.customerRemarks}
                  onChange={(e) => setCustomFields({ ...customFields, customerRemarks: e.target.value })}
                  placeholder="e.g. Urgent handover requested, Special packaging..."
                  className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Special Instructions:
                </label>
                <input
                  type="text"
                  value={customFields.specialInstructions}
                  onChange={(e) => setCustomFields({ ...customFields, specialInstructions: e.target.value })}
                  placeholder="e.g. Fit check required on collection..."
                  className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Terms &amp; Conditions (Optional Override):
                </label>
                <textarea
                  rows={2}
                  value={customFields.termsAndConditions}
                  onChange={(e) => setCustomFields({ ...customFields, termsAndConditions: e.target.value })}
                  placeholder="Leave empty to use official standard terms..."
                  className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Prepared By (Signature Line):
                </label>
                <input
                  type="text"
                  value={customFields.preparedBy}
                  onChange={(e) => setCustomFields({ ...customFields, preparedBy: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Official Bank Account Information Badge */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4 shadow-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
              <Landmark size={15} />
              Included Meezan Bank Details
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-emerald-900/30 text-[11px] space-y-1 font-mono">
              <p className="text-white font-bold">ENAMELS</p>
              <p className="text-slate-300">Meezan Bank - College Road Lahore</p>
              <p className="text-emerald-400 font-bold">A/C: 02220105077642</p>
              <p className="text-slate-300">IBAN: PK78MEZN0002220105077642</p>
              <p className="text-amber-400 italic text-[10px] mt-1">
                "Please deposit here. Do send a screenshot when you're done."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── CATALOG BROWSER MODAL ────────────────── */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Package size={18} className="text-emerald-400" />
                  Johar Town Products Catalog ({filteredProducts.length} Products)
                </h3>
                <p className="text-xs text-slate-400">Click any product to add it immediately to your {docType}</p>
              </div>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Filters: Search & Categories */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search products by name or color..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedCategory === tab.id
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredProducts.map(p => (
                <div
                  key={p.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-emerald-500/50 transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                        {p.category}
                      </span>
                      <span className="font-black text-emerald-400 text-xs font-mono">
                        Rs. {p.price.toLocaleString()}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {p.name}
                    </h4>

                    {p.colors.length > 0 && (
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-1">
                        {p.colors.slice(0, 4).map(c => (
                          <span key={c} className="bg-slate-900 px-1.5 py-0.2 rounded text-[9px] text-slate-300">
                            {c}
                          </span>
                        ))}
                        {p.colors.length > 4 && (
                          <span className="text-slate-500 text-[9px]">+{p.colors.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectProduct(p.id);
                        setShowCatalogModal(false);
                      }}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      Configure
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddFromCatalog(p)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── RECENT DOCUMENTS MODAL ────────────────── */}
      {showRecentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Clock size={16} className="text-cyan-400" />
                  Recent Invoices &amp; Quotations ({recentDocs.length})
                </h3>
                <p className="text-xs text-slate-400">Click any previous document to reload and print</p>
              </div>
              <button
                onClick={() => setShowRecentModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {recentDocs.map((docItem) => (
                <div
                  key={docItem.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between hover:border-cyan-500/50 transition-all cursor-pointer"
                  onClick={() => handleLoadSavedDocument(docItem)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${docItem.docType === 'INVOICE' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>
                        {docItem.docType}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{docItem.docRefNumber}</span>
                    </div>
                    <div className="text-xs text-slate-300 font-semibold">
                      {docItem.customerName} {docItem.customerPhone ? `(${docItem.customerPhone})` : ''}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(docItem.savedAt).toLocaleString()} • {docItem.itemsCount} items
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-emerald-400 font-mono text-xs block">
                      Rs. {Number(docItem.grandTotal || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-cyan-400 hover:underline">
                      Load &amp; View →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
