import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import socket from '../socket';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const URDU_LABELS = {
  identity: 'شناختی معلومات', orderNo: 'آرڈر نمبر', customerName: 'کسٹمر کا نام', customerPhone: 'فون نمبر',
  orderType: 'آرڈر کی قسم', urgent: 'ارجنٹ', totalPrice: 'کل قیمت', quantity: 'تعداد',
  productSelection: 'پروڈکٹ کا انتخاب', productBase: 'پروڈکٹ کی بنیاد', fabric: 'کپڑا', color: 'رنگ', size: 'سائز',
  branding: 'اینگرونگ (Engraving)', articleName: 'آرٹیکل کا نام', embroideryColor: 'کڑھائی کا رنگ', placement: 'جگہ',
  stitching: 'سلائی کی تفصیلات', notes: 'خصوصی ہدایات (نوٹس)',
  measurements: 'پیمائش (انچ میں)', chest: 'چھاتی', shoulder: 'گندھا', shirtLength: 'شرٹ لمبائی', sleeves: 'بازو',
  waist: 'ویسٹ', hips: 'ہپس', trouserLength: 'لمبائی', thigh: 'تھائی', bottom: 'بوٹم / پہنچا', mori: 'موری',
  options: 'آپشنز', dupatta: 'دوپٹہ', zip: 'زپ', cap: 'کیپ', submit: 'آرڈر درج کریں', next: 'اگلا مرحلہ', back: 'پیچھے',
  standard: 'اسٹینڈرڈ', logo: 'لوگو ڈیزائن', custom: 'کسٹم آرڈر', advance: 'ایڈوانس ادائیگی',
  required: 'یہ خانہ لازمی ہے', priority: 'ترجیح', normal: 'عام', super_urgent: 'انتہائی اہم'
};

const MEN_SCRUBS_SIZE_CHART = {
  'XS': { shoulder: '16.5', chest: '19', bottom: '19', shirtLength: '28', sleeve: '8.5', trouserLength: '38', hips: '7' },
  'S':  { shoulder: '17',   chest: '20', bottom: '20', shirtLength: '29', sleeve: '8.75', trouserLength: '39', hips: '7.25' },
  'M':  { shoulder: '17.5', chest: '21', bottom: '21', shirtLength: '30', sleeve: '9',    trouserLength: '40', hips: '7.5' },
  'L':  { shoulder: '18.5', chest: '22', bottom: '22', shirtLength: '31', sleeve: '9.5',  trouserLength: '41', hips: '8' },
  'XL': { shoulder: '19.5', chest: '24', bottom: '24', shirtLength: '32', sleeve: '10',   trouserLength: '42', hips: '8.5' },
  'XXL':{ shoulder: '20.5', chest: '26', bottom: '26', shirtLength: '33', sleeve: '10.5', trouserLength: '43', hips: '9' }
};

const WOMEN_SCRUBS_SIZE_CHART = {
  'XS': { shoulder: '14.5', chest: '19', waist: '16', bottom: '20', shirtLength: '30', hip: '19.5', sleeve: '8.25', trouserLength: '37', hips: '6.5' },
  'S':  { shoulder: '15',   chest: '20', waist: '16.75', bottom: '21', shirtLength: '31', hip: '20.5', sleeve: '8.5',  trouserLength: '38', hips: '6.75' },
  'M':  { shoulder: '15.5', chest: '21', waist: '17.5',  bottom: '22', shirtLength: '32', hip: '21.5', sleeve: '9',    trouserLength: '39', hips: '7' },
  'L':  { shoulder: '16.5', chest: '22', waist: '18.5',  bottom: '23', shirtLength: '33', hip: '22.5', sleeve: '9.5',  trouserLength: '40', hips: '7.5' },
  'XL': { shoulder: '17.5', chest: '24', waist: '19.5',  bottom: '25', shirtLength: '34', hip: '24.5', sleeve: '10',   trouserLength: '41', hips: '8' },
  'XXL':{ shoulder: '18.5', chest: '26', waist: '20.5',  bottom: '27', shirtLength: '35', hip: '26.5', sleeve: '10.5', trouserLength: '42', hips: '8.5' }
};

const WOMEN_SHORT_SHIRT_LENGTHS = { XS: '28', S: '28', M: '28', L: '30', XL: '30', XXL: '31' };

const OrderEntryContext = createContext(null);

const INITIAL_FORM_DATA = {
  orderNumber: '', customerName: '', customerPhone: '', address: '', type: 'STANDARD', priority: 'NORMAL',
  advancePaid: false, advanceAmount: '', paymentStatus: 'PENDING', totalPrice: '', quantity: 1,
  matchingCap: false, matchingCapQty: 0, sleeveLength: '', shirtLength: '',
  alteration: { trouserLength: '', shirtLength: '', sleeveLength: '' },
  instructionNotes: '', shopifyOrderDate: '',
  productType: '', fabricType: '', color: '', size: '',
  fabricSourceProduct: '', colorSourceProduct: '', designSourceProduct: '', sizeSourceProduct: '', additionalProductRef: '',
  customProductName: '', customFabric: '', customMaterial: '', customColor: '', customDesign: '',
  customRequirements: '', customSpecifications: '',
  engravingType: '', skipEngraving: true, engravingInstructions: '',
  logoDesign: '', logoName: '', nameSpelling: '', nameColor: '', logoColor: '', logoPlacement: '',
  logoCharges: '', namePrintingCharges: '', customizationPrice: '', deliveryCharges: '',
  designNotes: '', designReference: '', additionalFeatures: [],
  measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hip: '', hips: '',
    shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: '', specialNote: '' },
  gender: 'Male',
  femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
  adjProductPrice: '', adjLogoCharges: '', adjNamePrinting: '', adjCustomization: '', adjCapCharges: '', adjDiscount: ''
};

const CLEAR_FORM_AFTER_CART = {
  quantity: 1, totalPrice: '', logoCharges: '', namePrintingCharges: '', customizationPrice: '',
  productType: '', fabricType: '', color: '', size: '', logoDesign: '', logoName: '', nameSpelling: '',
  nameColor: '', logoColor: '', logoPlacement: '', designNotes: '', designReference: '',
  additionalFeatures: [], matchingCap: false, matchingCapQty: 0, sleeveLength: '', shirtLength: '',
  alteration: { trouserLength: '', shirtLength: '', sleeveLength: '' },
  measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hip: '', hips: '',
    shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: '', specialNote: '' },
  gender: 'Male',
  femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
  fabricSourceProduct: '', colorSourceProduct: '', designSourceProduct: '', sizeSourceProduct: '', additionalProductRef: '',
  customProductName: '', customFabric: '', customMaterial: '', customColor: '', customDesign: '',
    customRequirements: '', customSpecifications: '', engravingType: '', skipEngraving: true, engravingInstructions: ''
};

export const OrderEntryProvider = ({ children }) => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isUrdu, LanguageToggle } = useLanguage();
  const useUrdu = isUrdu;
  const isOutlet = user?.role === 'OUTLET';

  const [activeTab, setActiveTab] = useState('basic');
  const [inventory, setInventory] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState('SCRUBS');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [colorSearchTerm, setColorSearchTerm] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});
  const [showReview, setShowReview] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  const [originalOrder, setOriginalOrder] = useState(null);
  const [showEditReview, setShowEditReview] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editOrderNumber, setEditOrderNumber] = useState('');
  const [editOrderData, setEditOrderData] = useState(null);
  const [editOrderLoading, setEditOrderLoading] = useState(false);
  const [editOrderError, setEditOrderError] = useState('');
  const [logoEntries, setLogoEntries] = useState([{ name: '', design: '' }]);
  const [articleNameEntries, setArticleNameEntries] = useState(['']);
  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA });
  const [cartItems, setCartItems] = useState([]);
  const [showAddMore, setShowAddMore] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const dateInputRef = useRef(null);

  const t = useCallback((key) => {
    if (!key) return '';
    if (isUrdu) return URDU_LABELS[key] || key;
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  }, [isUrdu]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') setIsEditMode(true);
  }, [searchParams]);

  const fetchInventory = useCallback(async () => {
    try {
      const response = await api.get('/api/inventory');
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    socket.on('inventory-updated', fetchInventory);
    const onFocus = () => { if (!document.hidden) fetchInventory(); };
    window.addEventListener('focus', onFocus);
    return () => {
      socket.off('inventory-updated', fetchInventory);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchInventory]);

  const hasChanged = useCallback((val1, val2) => {
    const normalize = (v) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase());
    return normalize(val1) !== normalize(val2);
  }, []);

  const hasChangedBool = useCallback((b1, b2) => !!b1 !== !!b2, []);

  const resetFormData = useCallback(() => {
    setFormData({ ...INITIAL_FORM_DATA });
  }, []);

  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      setIsEditMode(false);
      setEditOrderId(null);
      setOriginalOrder(null);
      setEditOrderNumber('');
      setEditOrderData(null);
      setEditOrderError('');
      setCartItems([]);
      resetFormData();
      setLogoEntries([{ name: '', design: '' }]);
      setArticleNameEntries(['']);
    } else {
      setIsEditMode(true);
    }
  }, [isEditMode, resetFormData]);

  const fetchOrderByNumber = useCallback(async () => {
    if (!editOrderNumber.trim()) { setEditOrderError('Please enter an order number'); return; }
    setEditOrderLoading(true);
    setEditOrderError('');
    setEditOrderData(null);
    let found = null;
    try {
      const response = await api.get('/api/orders', { params: { limit: 'all' } });
      const orders = Array.isArray(response.data) ? response.data : [];
      found = orders.find(o =>
        o.orderNumber?.toLowerCase() === editOrderNumber.trim().toLowerCase() ||
        o.id?.toLowerCase() === editOrderNumber.trim().toLowerCase()
      );
      if (found) {
        const userRole = user?.role;
        const foundSource = found.outletName || '';
        if (userRole === 'OUTLET') {
          const name = user?.name || '';
          let myOutlet = name;
          if (name.includes('1') || name.toLowerCase().includes('johar')) myOutlet = 'JOHAR TOWN BRANCH';
          else if (name.includes('2') || name.toLowerCase().includes('jail')) myOutlet = 'JAIL ROAD BRANCH';
          else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) myOutlet = 'ABBOTTABAD BRANCH';
          if (foundSource !== myOutlet) {
            setEditOrderError(`This order belongs to ${foundSource}. You can only request changes for ${myOutlet} orders.`);
            setEditOrderLoading(false); return;
          }
        } else if (userRole === 'FAISAL' && foundSource !== 'ONLINE ORDER') {
          setEditOrderError('You can only request changes for Online orders.');
          setEditOrderLoading(false); return;
        }
        setEditOrderData(found);
        setEditOrderId(found.id);
        setOriginalOrder(found);
        setFormData({
          orderNumber: found.orderNumber || '', customerName: found.customerName || '', customerPhone: found.customerPhone || '',
          address: found.address || '', city: found.city || '', type: found.type || 'STANDARD', priority: found.priority || 'NORMAL',
          advancePaid: !!found.advancePaid, advanceAmount: found.advanceAmount || '', totalPrice: found.totalPrice || '',
          quantity: found.quantity || 1, productType: '', fabricType: '', color: '', size: '',
          logoDesign: found.logoDesign || '', logoName: found.logoName || '', nameSpelling: '', nameColor: '',
          logoColor: '', logoPlacement: '', logoCharges: found.logoCharges?.toString() || '',
          namePrintingCharges: found.namePrintingCharges?.toString() || '',
          customizationPrice: found.customizationPrice?.toString() || '', designNotes: '', designReference: '',
          additionalFeatures: [],
          measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '',
            shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: '', specialNote: '' },
          gender: found.gender || 'Male',
          femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
          matchingCap: false, matchingCapQty: 0, sleeveLength: '', shirtLength: '', instructionNotes: '',
          shopifyOrderDate: found.shopifyOrderDate ? (() => { const d = new Date(found.shopifyOrderDate); return isNaN(d.getTime()) ? '' : d.toISOString(); })() : '',
          adjProductPrice: '', adjLogoCharges: '', adjNamePrinting: '', adjCustomization: '', adjCapCharges: '', adjDiscount: ''
        });
        let pd = [];
        try { pd = found.productDetails; }
        catch { pd = found.productDetails || []; }
        const mapItem = (item) => {
          const pdItem = item.productDetails || item;
          const custItem = item.customization || {};
          return {
            orderNumber: found.orderNumber, customerName: found.customerName, customerPhone: found.customerPhone,
            address: found.address, city: found.city, type: found.type, priority: found.priority,
            quantity: item.quantity || 1, advancePaid: found.advancePaid, advanceAmount: found.advanceAmount || '',
            logoDesign: found.logoDesign, logoName: found.logoName,
            logoCharges: parseFloat(item.logoCharges) || 0, namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
            customizationPrice: parseFloat(item.customizationPrice) || 0,
            productDetails: {
              ...pdItem, productType: pdItem.productType || '', fabricType: pdItem.fabricType || '',
              color: pdItem.color || '', size: pdItem.size || '', gender: pdItem.gender || 'Male',
              femaleOptions: pdItem.femaleOptions || null, sleeveLength: pdItem.sleeveLength || '',
              shirtLength: pdItem.shirtLength || '', matchingCap: pdItem.matchingCap || false,
              matchingCapQty: pdItem.matchingCapQty || 0,
              alteration: pdItem.alteration || { trouserLength: '', shirtLength: '', sleeveLength: '' }
            },
            customization: {
              nameSpelling: custItem.nameSpelling || '', nameColor: custItem.nameColor || '',
              logoColor: custItem.logoColor || '', logoPlacement: custItem.logoPlacement || '',
              designNotes: custItem.designNotes || '',
              designReference: custItem.designReference || '', additionalFeatures: custItem.additionalFeatures || []
            },
            sizeData: item.sizeData || {}, totalPrice: parseFloat(item.totalPrice) || 0
          };
        };
        if (Array.isArray(pd)) {
          setCartItems(pd.map(mapItem));
        } else if (pd && pd.productType) {
          let custData = {}, sizeDataObj = {};
          try { custData = found.customization ? (typeof found.customization === 'string' ? JSON.parse(found.customization) : found.customization) : {}; }
          catch { custData = {}; }
          try { sizeDataObj = found.sizeData ? (typeof found.sizeData === 'string' ? JSON.parse(found.sizeData) : found.sizeData) : {}; }
          catch { sizeDataObj = {}; }
          setCartItems([{
            ...mapItem(pd), customization: custData, sizeData: sizeDataObj
          }]);
        }
      } else {
        setEditOrderError('No order found with that number/ID');
      }
    } catch (err) {
      setEditOrderError('Error fetching order: ' + (err.response?.data?.message || err.message));
    }
    if (!found) {
      try {
        const userRole = user?.role;
        let mySource = '';
        if (userRole === 'FAISAL') mySource = 'ONLINE ORDER';
        else if (userRole === 'OUTLET') {
          const name = user?.name || '';
          if (name.includes('1') || name.toLowerCase().includes('johar')) mySource = 'JOHAR TOWN BRANCH';
          else if (name.includes('2') || name.toLowerCase().includes('jail')) mySource = 'JAIL ROAD BRANCH';
          else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) mySource = 'ABBOTTABAD BRANCH';
        }
        const delRes = await api.get('/api/orders/deleted-check', { params: { number: editOrderNumber.trim(), source: mySource || undefined } });
        if (delRes.data) {
          setEditOrderData(null);
          setEditOrderError(`This order (${delRes.data.orderNumber || editOrderNumber.trim()}) was deleted by Admin on ${new Date(delRes.data.deletedAt).toLocaleDateString()}. No changes can be made.`);
          setEditOrderLoading(false); return;
        }
      } catch (delErr) { }
    }
    setEditOrderLoading(false);
  }, [editOrderNumber, user]);

  const submitOrderEditRequest = useCallback(async () => {
    if (!editOrderId || cartItems.length === 0) { setError('No items in the edit request or no order selected.'); return; }
    setIsSubmitting(true); setLoading(true); setError('');
    try {
      const finalItems = cartItems.map(item => ({
        productDetails: { ...item.productDetails, gender: formData.gender },
        customization: item.customization || {}, sizeData: item.sizeData || {},
        quantity: parseInt(item.quantity) || 1, totalPrice: parseFloat(item.totalPrice) || 0,
        logoName: item.logoName || '', logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0, namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0, capCharges: parseInt(item.capCharges) || 0
      }));
      await api.post(`/api/orders/${editOrderId}/edit-request`, {
        requestedChanges: {
          customerName: formData.customerName, customerPhone: formData.customerPhone, address: formData.address,
          city: formData.city, type: formData.type, priority: formData.priority,
          advancePaid: formData.advancePaid, advanceAmount: parseFloat(formData.advanceAmount) || 0,
          items: finalItems, quantity: finalItems.reduce((s, i) => s + (i.quantity || 1), 0),
          totalPrice: cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0),
          logoDesign: formData.logoDesign, logoName: formData.logoName,
          logoCharges: cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0),
          namePrintingCharges: cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0),
          customizationPrice: cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0),
          shopifyOrderDate: formData.shopifyOrderDate || null,
          deliveryCharges: parseFloat(formData.deliveryCharges) || 0,
          engravingInstructions: formData.engravingInstructions || null,
          engravingRequired: !formData.skipEngraving,
          instructionNotes: [formData.instructionNotes, formData.measurements.specialNote].filter(Boolean).join('\n---\n') || null
        },
        reason: editReason
      });
      setIsEditMode(false); setEditOrderId(null); setOriginalOrder(null); setShowEditReview(false);
      setEditReason(''); setEditOrderNumber(''); setEditOrderData(null); setCartItems([]);
      resetFormData();
      setLogoEntries([{ name: '', design: '' }]); setArticleNameEntries(['']);
      setActiveTab('basic');
      alert('Edit request submitted successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting edit request');
    }
    setLoading(false); setIsSubmitting(false);
  }, [editOrderId, cartItems, formData, editReason, resetFormData]);

  const getSizeChart = useCallback(() => {
    return formData.gender === 'Female' ? WOMEN_SCRUBS_SIZE_CHART : MEN_SCRUBS_SIZE_CHART;
  }, [formData.gender]);

  const handleSizeSelect = useCallback((s) => {
    if (s === 'Custom') { setFormData(prev => ({ ...prev, size: s })); return; }
    setFormData(prev => {
      const chart = prev.gender === 'Female' ? WOMEN_SCRUBS_SIZE_CHART : MEN_SCRUBS_SIZE_CHART;
      return { ...prev, size: s, measurements: { ...chart[s] || prev.measurements } };
    });
  }, []);

  const validateProductConfig = useCallback(() => {
    if (!formData.orderNumber.trim()) return t('orderNo') + ' ' + t('required');
    if (!formData.customerName.trim()) return t('customerName') + ' ' + t('required');
    if (!formData.customerPhone.trim()) return t('customerPhone') + ' ' + t('required');
    if (formData.type === 'FULL_CUSTOM' && !(parseFloat(formData.advanceAmount) > 0)) return 'Advance payment is compulsory for custom orders.';
    if (!formData.productType && formData.type !== 'FULL_CUSTOM') return 'Please select a Product first.';

    return null;
  }, [formData, t]);

  const validateCurrentTab = useCallback(() => {
    setError('');
    if (activeTab === 'basic') {
      if (!formData.orderNumber.trim()) return t('orderNo') + ' ' + t('required');
      if (!formData.customerName.trim()) return t('customerName') + ' ' + t('required');
      if (!formData.customerPhone.trim()) return t('customerPhone') + ' ' + t('required');
    }
    if (activeTab === 'product') {
      if (!formData.productType && formData.type !== 'FULL_CUSTOM') return 'Please select a Product.';
    }
    if (activeTab === 'custom') {
    }
    return null;
  }, [activeTab, formData, t]);

  const preventEnterSubmit = useCallback((e) => { if (e.key === 'Enter') e.preventDefault(); }, []);

  const fmtDate = useCallback((iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const parseDate = useCallback((str) => {
    if (!str) return '';
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (!m) return '';
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }, []);

  const capUnitPrice = 500;
  const capCharges = (formData.matchingCap ? (formData.matchingCapQty || 0) : 0) * capUnitPrice;

  const removeCartItem = useCallback((idx) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const editCartItem = useCallback((idx, tab) => {
    const item = cartItems[idx];
    const pd = item.productDetails || {};
    const cust = item.customization || {};
    removeCartItem(idx);
    setFormData(prev => ({
      ...prev,
      productType: pd.productType || '', fabricType: pd.fabricType || '', color: pd.color || '', size: pd.size || '',
      gender: pd.gender || 'Male',
      femaleOptions: pd.femaleOptions || { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
      matchingCap: pd.matchingCap || false, matchingCapQty: pd.matchingCapQty || 0,
      sleeveLength: pd.sleeveLength || '', shirtLength: pd.shirtLength || '',
      alteration: pd.alteration || { trouserLength: '', shirtLength: '', sleeveLength: '' },
      fabricSourceProduct: pd.fabricSourceProduct || '', colorSourceProduct: pd.colorSourceProduct || '',
      designSourceProduct: pd.designSourceProduct || '', sizeSourceProduct: pd.sizeSourceProduct || '',
      additionalProductRef: pd.additionalProductRef || '',
      engravingType: cust.engravingType || '', skipEngraving: item.skipEngraving !== undefined ? item.skipEngraving : true,
      quantity: item.quantity || 1, totalPrice: '', logoCharges: item.logoCharges?.toString() || '',
      namePrintingCharges: item.namePrintingCharges?.toString() || '',
      customizationPrice: item.customizationPrice?.toString() || '',
      logoDesign: item.logoDesign || '', logoName: item.logoName || '',
      nameSpelling: cust.nameSpelling || '', nameColor: cust.nameColor || '',
      logoColor: cust.logoColor || '', logoPlacement: cust.logoPlacement || '',
      designNotes: cust.designNotes || '',
      designReference: cust.designReference || '', additionalFeatures: cust.additionalFeatures || [],
      measurements: {
        chest: item.sizeData?.chest || '', shoulder: item.sizeData?.shoulder || '',
        length: item.sizeData?.length || '', sleeve: item.sizeData?.sleeve || '',
        waist: item.sizeData?.waist || '', hip: item.sizeData?.hip || '', hips: item.sizeData?.hips || '',
        shirtLength: item.sizeData?.shirtLength || '', trouserLength: item.sizeData?.trouserLength || '',
        bottom: item.sizeData?.bottom || '', thigh: item.sizeData?.thigh || '',
        mori: item.sizeData?.mori || '', ganda: item.sizeData?.ganda || ''
      }
    }));
    setLogoEntries(cust.logos && cust.logos.length > 0 ? cust.logos : [{ name: item.logoName || '', design: item.logoDesign || '' }]);
    setArticleNameEntries(cust.articleNames && cust.articleNames.length > 0 ? cust.articleNames : (cust.nameSpelling ? [cust.nameSpelling] : ['']));
    setShowReview(false);
    if (isEditMode) setShowProductSelector(true);
    setActiveTab(tab);
  }, [cartItems, isEditMode, removeCartItem]);

  const handleAddMoreProducts = useCallback(() => {
    setShowAddMore(false);
    setActiveTab('product');
  }, []);

  const handleCheckout = useCallback(async () => {
    if (cartItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true); setLoading(true); setError('');
    try {
      const finalItems = cartItems.map(item => ({
        productDetails: item.productDetails, customization: item.customization || {}, sizeData: item.sizeData || {},
        quantity: parseInt(item.quantity) || 1, totalPrice: parseFloat(item.totalPrice) || 0,
        logoName: item.logoName || '', logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0, namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0, capCharges: parseInt(item.capCharges) || 0
      }));
      const firstItem = cartItems[0];
      const calcProductPrice = cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) - parseFloat(i.logoCharges || 0) - parseFloat(i.namePrintingCharges || 0) - parseFloat(i.customizationPrice || 0) - (parseInt(i.capCharges) || 0)), 0);
      const calcLogo = cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0);
      const calcName = cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0);
      const calcCustomization = cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0);
      const calcCap = cartItems.reduce((s, i) => s + (parseInt(i.capCharges) || 0), 0);
      const orderTotalBeforeDelivery = calcProductPrice + calcLogo + calcName + calcCustomization + calcCap;
      const calcDelivery = orderTotalBeforeDelivery > 7000 ? 0 : 250;
      const adjTotal = (parseFloat(formData.adjProductPrice) || calcProductPrice) + (parseFloat(formData.adjLogoCharges) || calcLogo) + (parseFloat(formData.adjNamePrinting) || calcName) + (parseFloat(formData.adjCustomization) || calcCustomization) + (parseFloat(formData.adjCapCharges) || calcCap) + calcDelivery - (parseFloat(formData.adjDiscount) || 0);
      const faisalEmp = localStorage.getItem('faisalEmployee') || null;
      await api.post('/api/orders', {
        orderNumber: firstItem.orderNumber, customerName: firstItem.customerName,
        customerPhone: firstItem.customerPhone, address: firstItem.address, city: firstItem.city,
        type: firstItem.type, priority: firstItem.priority, advancePaid: firstItem.advancePaid,
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        paymentStatus: firstItem.paymentStatus || 'PENDING',
        logoDesign: firstItem.logoDesign, logoName: firstItem.logoName,
        logoCharges: cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0),
        namePrintingCharges: cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0),
        customizationPrice: cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0),
        deliveryCharges: calcDelivery, discount: parseFloat(formData.adjDiscount) || 0,
        items: finalItems, productDetails: finalItems[0].productDetails,
        customization: finalItems[0].customization, sizeData: finalItems[0].sizeData,
        quantity: finalItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
        totalPrice: adjTotal,
        engravingInstructions: formData.engravingInstructions || '',
        engravingRequired: !formData.skipEngraving,
        instructionNotes: [formData.instructionNotes, formData.measurements.specialNote].filter(Boolean).join('\n---\n') || '',
        shopifyOrderDate: formData.shopifyOrderDate || null,
        placedBy: faisalEmp
      });
      setCartItems([]); setSuccess(true);
      resetFormData();
      setLogoEntries([{ name: '', design: '' }]); setArticleNameEntries(['']);
      setActiveTab('basic');
      setError('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error during checkout:', error);
      setError(error.response?.data?.message || error.response?.data?.error || 'Error processing checkout. Please try again.');
    }
    setLoading(false); setIsSubmitting(false);
  }, [cartItems, isSubmitting, formData, resetFormData]);

  // Derived data
  const productCategories = useMemo(() => {
    try { if (Array.isArray(inventory)) return [...new Set(inventory.filter(i => i.category && i.category !== 'FABRIC' && i.category !== 'COLOR').map(i => i.category))]; } catch (e) { console.error('productCategories:', e); }
    return [];
  }, [inventory]);

  const isAccessory = useCallback((cat) => {
    if (!cat) return false;
    const catUpper = cat.toUpperCase();
    return !['SCRUBS', 'CAP', 'CAPS'].includes(catUpper) && !catUpper.includes('COAT');
  }, []);

  const isCustomizableProduct = useCallback((cat) => {
    if (!cat) return false;
    const catUpper = cat.toUpperCase();
    return ['SCRUBS', 'CAP', 'CAPS'].includes(catUpper) || catUpper.includes('COAT');
  }, []);

  const isShoes = useCallback((cat) => cat?.toUpperCase() === 'SHOES', []);

  const productsInCategory = useMemo(() => {
    try { if (Array.isArray(inventory)) return (inventory || []).filter(i => i.category === selectedProductCategory).sort((a, b) => a.name.localeCompare(b.name)); } catch (e) { console.error('productsInCategory:', e); }
    return [];
  }, [inventory, selectedProductCategory]);

  const uniqueProductNames = useMemo(() => { try { return productsInCategory && productsInCategory.length > 0 ? [...new Set(productsInCategory.map(i => i.name))] : []; } catch (e) { console.error('uniqueProductNames:', e); return []; } }, [productsInCategory]);

  const selectedProduct = useMemo(() =>
    formData.productType ? productsInCategory.find(i => i.name === formData.productType) : null,
    [formData.productType, productsInCategory]
  );

  const selectedProductVariants = useMemo(() =>
    selectedProduct?.variants && Array.isArray(selectedProduct.variants) && selectedProduct.variants.length > 0
      ? selectedProduct.variants
      : (selectedProduct ? [{ color: selectedProduct.color, size: selectedProduct.size, stock: selectedProduct.stock, price: selectedProduct.price }] : []),
    [selectedProduct]
  );

  const fabrics = useMemo(() =>
    formData.productType && selectedProduct
      ? (selectedProduct.fabric ? [selectedProduct.fabric] : [])
      : (inventory || []).filter(i => i.category === 'FABRIC'),
    [formData.productType, selectedProduct, inventory]
  );

  const defaultSizes = useMemo(() => {
    const base = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'C'];
    return formData.type === 'FULL_CUSTOM' ? [...base, 'Custom'] : base;
  }, [formData.type]);

  const colors = useMemo(() => {
    try {
      if (formData.productType && selectedProductVariants && selectedProductVariants.length > 0)
        return [...new Set(selectedProductVariants.filter(v => v.color != null && v.color !== '').map(v => v.color))];
    } catch (e) { console.error('colors memo:', e); }
    return [];
  }, [formData.productType, selectedProductVariants]);

  const availableSizes = useMemo(() => {
    try {
      if (formData.productType && selectedProductVariants && selectedProductVariants.length > 0)
        return [...new Set(selectedProductVariants.filter(v => v.size != null && v.size !== '').map(v => v.size))];
    } catch (e) { console.error('availableSizes memo:', e); }
    return [];
  }, [formData.productType, selectedProductVariants]);

  const computedUnitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const price = selectedProduct.price || 0;
    if (selectedProductVariants.length > 0) {
      const match = selectedProductVariants.find(v =>
        (!formData.color || v.color === formData.color) && (!formData.size || v.size === formData.size)
      );
      return match?.price || price;
    }
    return price;
  }, [selectedProduct, selectedProductVariants, formData.color, formData.size]);

  const computedTotalPrice = useMemo(() => computedUnitPrice * (formData.quantity || 1), [computedUnitPrice, formData.quantity]);

  // Cart memos (defensive: try-catch each to prevent crash on unexpected data)
  const memoCartTotalItems = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0); } catch (e) { console.error('memoCartTotalItems:', e); return 0; } }, [cartItems]);
  const memoCartTotalPrice = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0); } catch (e) { console.error('memoCartTotalPrice:', e); return 0; } }, [cartItems]);
  const memoCartTotalLogoCharges = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0); } catch (e) { console.error('memoCartTotalLogoCharges:', e); return 0; } }, [cartItems]);
  const memoCartTotalNamePrinting = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0); } catch (e) { console.error('memoCartTotalNamePrinting:', e); return 0; } }, [cartItems]);
  const memoCartTotalCustomization = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0); } catch (e) { console.error('memoCartTotalCustomization:', e); return 0; } }, [cartItems]);
  const memoCartProductPriceExBranding = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) - parseFloat(i.logoCharges || 0) - parseFloat(i.namePrintingCharges || 0) - parseFloat(i.customizationPrice || 0) - (parseInt(i.capCharges) || 0)), 0); } catch (e) { console.error('memoCartProductPriceExBranding:', e); return 0; } }, [cartItems]);
  const memoCartTotalCap = useMemo(() => { try { return cartItems.reduce((s, i) => s + (parseInt(i.capCharges) || 0), 0); } catch (e) { console.error('memoCartTotalCap:', e); return 0; } }, [cartItems]);
  const memoOrderTotalBeforeDelivery = useMemo(() => memoCartProductPriceExBranding + memoCartTotalCustomization + memoCartTotalCap, [memoCartProductPriceExBranding, memoCartTotalCustomization, memoCartTotalCap]);
  const memoCalcDelivery = useMemo(() => memoOrderTotalBeforeDelivery > 7000 ? 0 : 250, [memoOrderTotalBeforeDelivery]);
  const memoIsFreeDelivery = useMemo(() => memoCartTotalPrice > 7000, [memoCartTotalPrice]);

  const handleAddToCart = useCallback(() => {
    const validationError = validateProductConfig();
    if (validationError) { setError(validationError); return; }
    const brandingTotal = (parseFloat(formData.logoCharges) || 0) + (parseFloat(formData.namePrintingCharges) || 0) + (parseFloat(formData.customizationPrice) || 0);
    const computedTotalPriceCalc = (() => {
      if (!selectedProduct) return 0;
      const price = selectedProduct.price || 0;
      if (selectedProductVariants.length > 0) {
        const match = selectedProductVariants.find(v =>
          (!formData.color || v.color === formData.color) && (!formData.size || v.size === formData.size)
        );
        return (match?.price || price) * (formData.quantity || 1);
      }
      return price * (formData.quantity || 1);
    })();
    const payload = {
      orderNumber: formData.orderNumber, customerName: formData.customerName, customerPhone: formData.customerPhone,
      address: formData.address, city: formData.city, type: formData.type, priority: formData.priority,
      quantity: parseInt(formData.quantity) || 1, advancePaid: formData.advancePaid,
      advanceAmount: parseFloat(formData.advanceAmount) || 0, paymentStatus: formData.paymentStatus,
      logoDesign: formData.logoDesign, logoName: formData.logoName,
      logoCharges: parseFloat(formData.logoCharges) || 0,
      namePrintingCharges: parseFloat(formData.namePrintingCharges) || 0,
      customizationPrice: parseFloat(formData.customizationPrice) || 0,
      productDetails: {
        productType: formData.productType || formData.customProductName,
        fabricType: formData.fabricType || formData.customFabric,
        color: formData.color || formData.customColor, size: formData.size, gender: formData.gender,
        femaleOptions: formData.femaleOptions, sleeveLength: formData.sleeveLength || '',
        shirtLength: formData.shirtLength || '', matchingCap: formData.matchingCap,
        matchingCapQty: formData.matchingCapQty,
        fabricSourceProduct: formData.fabricSourceProduct || formData.customFabric,
        colorSourceProduct: formData.colorSourceProduct || formData.customColor,
        designSourceProduct: formData.designSourceProduct || formData.customDesign,
        sizeSourceProduct: formData.sizeSourceProduct,
        additionalProductRef: formData.additionalProductRef || formData.customRequirements,
        customMaterial: formData.customMaterial, customSpecifications: formData.customSpecifications,
        alteration: formData.alteration ? {
          trouserLength: formData.alteration.trouserLength || '',
          shirtLength: formData.alteration.shirtLength || '',
          sleeveLength: formData.alteration.sleeveLength || ''
        } : { trouserLength: '', shirtLength: '', sleeveLength: '' }
      },
      customization: {
        nameSpelling: articleNameEntries.filter(Boolean).join(', '), articleNames: articleNameEntries,
        nameColor: formData.nameColor, logoColor: formData.logoColor, logoPlacement: formData.logoPlacement,
        designNotes: formData.designNotes, designReference: formData.designReference,
        additionalFeatures: formData.additionalFeatures, logos: logoEntries,
        engravingType: formData.engravingType || '', skipEngraving: formData.skipEngraving || false
      },
      sizeData: formData.measurements, capCharges,
      totalPrice: (computedTotalPriceCalc > 0 ? computedTotalPriceCalc : (parseFloat(formData.totalPrice) || 0)) + brandingTotal + capCharges
    };
    setCartItems(prev => [...prev, payload]);
    setFormData(prev => ({ ...prev, ...CLEAR_FORM_AFTER_CART }));
    setLogoEntries([{ name: '', design: '' }]);
    setArticleNameEntries(['']);
    setShowAddMore(true);
  }, [formData, selectedProduct, selectedProductVariants, articleNameEntries, logoEntries, validateProductConfig, capCharges]);

  // Tab configuration
  const allTabs = useMemo(() => [
    { id: 'basic', label: '1. Basics', icon: 'Layout' },
    { id: 'product', label: '2. Selection', icon: 'ShoppingCart' },
    { id: 'custom', label: '3. Engraving', icon: 'Scissors', customOnly: true },
    { id: 'sizes', label: '4. Tailoring', icon: 'Ruler', customOnly: true }
  ], []);

  const filteredTabs = useMemo(() => allTabs.filter(tab => {
    if (tab.customOnly && formData.type === 'STANDARD') return false;
    if (tab.customOnly && !isCustomizableProduct(selectedProductCategory)) return false;
    if (tab.id === 'sizes' && isAccessory(selectedProductCategory)) return false;
    return true;
  }), [allTabs, formData.type, isCustomizableProduct, selectedProductCategory, isAccessory]);

  const value = {
    // State
    activeTab, setActiveTab, inventory, dataLoading, loading, success, error, isSubmitting,
    selectedProductCategory, productSearchTerm, colorSearchTerm, expandedProducts,
    showReview, isEditMode, editOrderId, originalOrder, showEditReview,
    editReason, editOrderNumber, editOrderData, editOrderLoading, editOrderError,
    logoEntries, articleNameEntries, formData, cartItems, showAddMore, showProductSelector, isCartOpen, dateInputRef,
    // Setters
    setSelectedProductCategory, setProductSearchTerm, setColorSearchTerm, setExpandedProducts,
    setShowReview, setIsEditMode, setEditOrderId, setOriginalOrder, setShowEditReview,
    setEditReason, setEditOrderNumber, setEditOrderData, setEditOrderLoading, setEditOrderError,
    setLogoEntries, setArticleNameEntries, setFormData, setCartItems, setShowAddMore,
    setShowProductSelector, setIsCartOpen, setError, setLoading, setSuccess, setIsSubmitting,
    // Handlers
    t, useUrdu, isUrdu, isOutlet, LanguageToggle,
    fetchInventory, toggleEditMode, fetchOrderByNumber, submitOrderEditRequest,
    getSizeChart, handleSizeSelect, validateProductConfig, validateCurrentTab,
    preventEnterSubmit, fmtDate, parseDate,
    handleAddToCart, removeCartItem, editCartItem, handleAddMoreProducts, handleCheckout,
    hasChanged, hasChangedBool,
    // Derived data
    productCategories, isAccessory, isCustomizableProduct, isShoes,
    productsInCategory, uniqueProductNames, selectedProduct, selectedProductVariants,
    fabrics, defaultSizes, colors, availableSizes, computedUnitPrice, computedTotalPrice,
    capUnitPrice, capCharges,
    memoCartTotalItems, memoCartTotalPrice, memoCartTotalLogoCharges, memoCartTotalNamePrinting,
    memoCartTotalCustomization, memoCartProductPriceExBranding, memoCartTotalCap,
    memoOrderTotalBeforeDelivery, memoCalcDelivery, memoIsFreeDelivery,
    allTabs, filteredTabs
  };

  return <OrderEntryContext.Provider value={value}>{children}</OrderEntryContext.Provider>;
};

export const useOrderEntry = () => {
  const ctx = useContext(OrderEntryContext);
  if (!ctx) throw new Error('useOrderEntry must be used within OrderEntryProvider');
  return ctx;
};
