import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Package, 
  User, 
  Star, 
  ChevronRight, 
  CheckCircle2, 
  Hash, 
  Image as ImageIcon, 
  Type, 
  Layout, 
  Scissors, 
  Ruler, 
  Palette, 
  Layers,
  Search,
  ShoppingCart,
  Plus,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Trash2,
  Phone,
  Users,
  List,
  Grid,
  X,
  FileEdit,
  Loader2,
  Lock
} from 'lucide-react';
import socket from '../socket';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePolling } from '../hooks/usePolling';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import silhouetteMale from '../assets/silhouette.png';
import silhouetteFemale from '../assets/silhouette-female.png';

// Static constants extracted outside component to prevent re-creation on every render
const URDU_LABELS = {
  identity: 'شناختی معلومات',
  orderNo: 'آرڈر نمبر',
  customerName: 'کسٹمر کا نام',
  customerPhone: 'فون نمبر',
  orderType: 'آرڈر کی قسم',
  urgent: 'ارجنٹ',
  totalPrice: 'کل قیمت',
  quantity: 'تعداد',
  productSelection: 'پروڈکٹ کا انتخاب',
  productBase: 'پروڈکٹ کی بنیاد',
  fabric: 'کپڑا',
  color: 'رنگ',
  size: 'سائز',
  branding: 'اینگرونگ (Engraving)',
  articleName: 'آرٹیکل کا نام',
  embroideryColor: 'کڑھائی کا رنگ',
  placement: 'جگہ',
  stitching: 'سلائی کی تفصیلات',
  stitchingStyle: 'سلائی کا اسٹائل',
  fitProfile: 'فٹ پروفائل',
  notes: 'خصوصی ہدایات (نوٹس)',
  measurements: 'پیمائش (انچ میں)',
  chest: 'چھاتی',
  shoulder: 'گندھا',
  shirtLength: 'شرٹ لمبائی',
  sleeves: 'بازو',
  waist: 'ویسٹ',
  hips: 'ہپس',
  trouserLength: 'لمبائی',
  thigh: 'تھائی',
  bottom: 'بوٹم / پہنچا',
  mori: 'موری',
  options: 'آپشنز',
  dupatta: 'دوپٹہ',
  zip: 'زپ',
  cap: 'کیپ',
  submit: 'آرڈر درج کریں',
  next: 'اگلا مرحلہ',
  back: 'پیچھے',
  standard: 'اسٹینڈرڈ',
  logo: 'لوگو ڈیزائن',
  custom: 'کسٹم آرڈر',
  advance: 'ایڈوانس ادائیگی',
  required: 'یہ خانہ لازمی ہے',
  priority: 'ترجیح',
  normal: 'عام',
  super_urgent: 'انتہائی اہم'
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

const SmartOrderForm = () => {
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

  const [formData, setFormData] = useState({
    orderNumber: '',
    customerName: '',
    customerPhone: '',
    address: '',
    type: 'STANDARD', // STANDARD, READY_LOGO, FULL_CUSTOM
    priority: 'NORMAL',
    advancePaid: false,
    advanceAmount: '',
    paymentStatus: 'PENDING', // PENDING or PAID
    totalPrice: '',
    quantity: 1,
    matchingCap: false,
    matchingCapQty: 0,
    sleeveLength: '',
    shirtLength: '',
    instructionNotes: '',
    shopifyOrderDate: '',

    // Product Selection
    productType: '',
    fabricType: '',
    color: '',
    size: '',

    // Custom attribute source products
    fabricSourceProduct: '',
    colorSourceProduct: '',
    designSourceProduct: '',
    sizeSourceProduct: '',
    additionalProductRef: '',

    // Custom manual entry (FULL_CUSTOM)
    customProductName: '',
    customFabric: '',
    customMaterial: '',
    customColor: '',
    customDesign: '',
    customRequirements: '',
    customSpecifications: '',

    // Engraving type
    engravingType: 'direct',
    skipEngraving: false,

    // Customization
    logoDesign: '',
    logoName: '',
    nameSpelling: '',
    nameColor: '',
    logoColor: '',
    logoPlacement: '',

    // Branding Charges (optional manual input)
    logoCharges: '',
    namePrintingCharges: '',
    customizationPrice: '',
    deliveryCharges: '',

    // Advanced Stitching
    stitchingStyle: '',
    fitType: 'Regular',
    designNotes: '',
    designReference: '',
    additionalFeatures: [],

    // Size Data (Measurements)
    measurements: {
      chest: '',
      shoulder: '',
      length: '',
      sleeve: '',
      waist: '',
      hip: '',
      hips: '',
      shirtLength: '',
      trouserLength: '',
      bottom: '',
      thigh: '',
      mori: '',
      ganda: '',
      specialNote: ''
    },
    gender: 'Male',
    femaleOptions: {
      dupatta: false,
      sleeves: 'full',
      shirtLength: 'long',
      zip: false
    },
    adjProductPrice: '',
    adjLogoCharges: '',
    adjNamePrinting: '',
    adjCustomization: '',
    adjCapCharges: '',
    adjDiscount: ''
  });

  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isUrdu, LanguageToggle } = useLanguage();
  const useUrdu = isUrdu;
  const isOutlet = user?.role === 'OUTLET';

  const t = (key) => {
    if (!key) return '';
    if (isUrdu) return URDU_LABELS[key] || key;
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setIsEditMode(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchInventory();

    socket.on('inventory-updated', () => {
      fetchInventory();
    });

    const onFocus = () => { if (!document.hidden) fetchInventory(); };
    window.addEventListener('focus', onFocus);

    return () => {
      socket.off('inventory-updated');
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await api.get('/api/inventory');
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setDataLoading(false);
    }
  };

  usePolling(() => { if (!document.hidden) fetchInventory(); }, 30000);

  const hasChanged = (val1, val2) => {
    const normalize = (v) => (v === null || v === undefined ? '' : String(v).trim().toLowerCase());
    return normalize(val1) !== normalize(val2);
  };

  const hasChangedBool = (b1, b2) => {
    return !!b1 !== !!b2;
  };

  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      setIsEditMode(false);
      setEditOrderId(null);
      setOriginalOrder(null);
      setEditOrderNumber('');
      setEditOrderData(null);
      setEditOrderError('');
      setCartItems([]);
      setFormData({
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        address: '',
        city: '',
        type: 'STANDARD',
        priority: 'NORMAL',
        advancePaid: false,
        advanceAmount: '',
        paymentStatus: 'PENDING',
        totalPrice: '',
        quantity: 1,
        productType: '',
        fabricType: '',
        color: '',
        size: '',
        logoDesign: '',
        logoName: '',
        nameSpelling: '',
        nameColor: '',
        logoColor: '',
        logoPlacement: '',
        logoCharges: '',
        namePrintingCharges: '',
        customizationPrice: '',
        stitchingStyle: '',
        fitType: 'Regular',
        designNotes: '',
        designReference: '',
        additionalFeatures: [],
        measurements: {
          chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '',
          shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: ''
        },
        gender: 'Male',
        femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
        shopifyOrderDate: ''
      });
      setLogoEntries([{ name: '', design: '' }]);
      setArticleNameEntries(['']);
    } else {
      setIsEditMode(true);
    }
  }, [isEditMode]);

  const fetchOrderByNumber = useCallback(async () => {
    if (!editOrderNumber.trim()) {
      setEditOrderError('Please enter an order number');
      return;
    }
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
        // Source verification
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
            setEditOrderLoading(false);
            return;
          }
        } else if (userRole === 'FAISAL' && foundSource !== 'ONLINE ORDER') {
          setEditOrderError('You can only request changes for Online orders.');
          setEditOrderLoading(false);
          return;
        }

        setEditOrderData(found);
        setEditOrderId(found.id);
        setOriginalOrder(found);

        // Populate form basics
        setFormData({
          orderNumber: found.orderNumber || '',
          customerName: found.customerName || '',
          customerPhone: found.customerPhone || '',
          address: found.address || '',
          city: found.city || '',
          type: found.type || 'STANDARD',
          priority: found.priority || 'NORMAL',
          advancePaid: !!found.advancePaid,
          advanceAmount: found.advanceAmount || '',
          totalPrice: found.totalPrice || '',
          quantity: found.quantity || 1,
          productType: '',
          fabricType: '',
          color: '',
          size: '',
          logoDesign: found.logoDesign || '',
          logoName: found.logoName || '',
          nameSpelling: '',
          nameColor: '',
          logoColor: '',
          logoPlacement: '',
          logoCharges: found.logoCharges?.toString() || '',
          namePrintingCharges: found.namePrintingCharges?.toString() || '',
          customizationPrice: found.customizationPrice?.toString() || '',
          stitchingStyle: '',
          fitType: 'Regular',
          designNotes: '',
          designReference: '',
          additionalFeatures: [],
          measurements: {
            chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '',
            shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: ''
          },
        gender: 'Male',
        femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
        shopifyOrderDate: found.shopifyOrderDate ? (() => { const d = new Date(found.shopifyOrderDate); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,16); })() : '',
        });

        // Parse and populate product items into cart
        let pd = [];
        try {
          pd = typeof found.productDetails === 'string' ? JSON.parse(found.productDetails) : found.productDetails;
        } catch {
          pd = found.productDetails || [];
        }

        if (Array.isArray(pd)) {
          const parsedItems = pd.map(item => {
            const pdItem = item.productDetails || item;
            const custItem = item.customization || {};
            return {
              orderNumber: found.orderNumber,
              customerName: found.customerName,
              customerPhone: found.customerPhone,
              address: found.address,
              city: found.city,
              type: found.type,
              priority: found.priority,
              quantity: item.quantity || 1,
              advancePaid: found.advancePaid,
              advanceAmount: found.advanceAmount || '',
              logoDesign: found.logoDesign,
              logoName: found.logoName,
              logoCharges: parseFloat(item.logoCharges) || 0,
              namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
              customizationPrice: parseFloat(item.customizationPrice) || 0,
              productDetails: {
                productType: pdItem.productType || '',
                fabricType: pdItem.fabricType || '',
                color: pdItem.color || '',
                size: pdItem.size || '',
                gender: pdItem.gender || 'Male',
                femaleOptions: pdItem.femaleOptions || null
              },
              customization: {
                nameSpelling: custItem.nameSpelling || '',
                nameColor: custItem.nameColor || '',
                logoColor: custItem.logoColor || '',
                logoPlacement: custItem.logoPlacement || '',
                stitchingStyle: custItem.stitchingStyle || '',
                fitType: custItem.fitType || 'Regular',
                designNotes: custItem.designNotes || '',
                designReference: custItem.designReference || '',
                additionalFeatures: custItem.additionalFeatures || []
              },
              sizeData: item.sizeData || {},
              totalPrice: parseFloat(item.totalPrice) || 0
            };
          });
          setCartItems(parsedItems);
        } else if (pd && pd.productType) {
          let custData = {};
          try {
            custData = found.customization ? (typeof found.customization === 'string' ? JSON.parse(found.customization) : found.customization) : {};
          } catch {
            custData = {};
          }
          let sizeDataObj = {};
          try {
            sizeDataObj = found.sizeData ? (typeof found.sizeData === 'string' ? JSON.parse(found.sizeData) : found.sizeData) : {};
          } catch {
            sizeDataObj = {};
          }
          const legacyItem = {
            orderNumber: found.orderNumber,
            customerName: found.customerName,
            customerPhone: found.customerPhone,
            address: found.address,
            city: found.city,
            type: found.type,
            priority: found.priority,
            quantity: found.quantity || 1,
            advancePaid: found.advancePaid,
            advanceAmount: found.advanceAmount || '',
            logoDesign: found.logoDesign,
            logoName: found.logoName,
            logoCharges: parseFloat(found.logoCharges) || 0,
            namePrintingCharges: parseFloat(found.namePrintingCharges) || 0,
            customizationPrice: parseFloat(found.customizationPrice) || 0,
            productDetails: {
              productType: pd.productType || '',
              fabricType: pd.fabricType || '',
              color: pd.color || '',
              size: pd.size || '',
              gender: pd.gender || 'Male',
              femaleOptions: pd.femaleOptions || null
            },
            customization: {
              nameSpelling: custData.nameSpelling || '',
              nameColor: custData.nameColor || '',
              logoColor: custData.logoColor || '',
              logoPlacement: custData.logoPlacement || '',
              stitchingStyle: custData.stitchingStyle || '',
              fitType: custData.fitType || 'Regular',
              designNotes: custData.designNotes || '',
              designReference: custData.designReference || '',
              additionalFeatures: custData.additionalFeatures || []
            },
            sizeData: sizeDataObj || {},
            totalPrice: parseFloat(found.totalPrice) || 0
          };
          setCartItems([legacyItem]);
        }
      } else {
        setEditOrderError('No order found with that number/ID');
      }
    } catch (err) {
      setEditOrderError('Error fetching order: ' + (err.response?.data?.message || err.message));
    }

    // If order not found in active orders, check deleted records with source isolation
    if (!found) {
      try {
        const userRole = user?.role;
        let mySource = '';
        if (userRole === 'FAISAL') {
          mySource = 'ONLINE ORDER';
        } else if (userRole === 'OUTLET') {
          const name = user?.name || '';
          if (name.includes('1') || name.toLowerCase().includes('johar')) mySource = 'JOHAR TOWN BRANCH';
          else if (name.includes('2') || name.toLowerCase().includes('jail')) mySource = 'JAIL ROAD BRANCH';
          else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) mySource = 'ABBOTTABAD BRANCH';
        }
        const delRes = await api.get('/api/orders/deleted-check', {
          params: { number: editOrderNumber.trim(), source: mySource || undefined }
        });
        if (delRes.data) {
          setEditOrderData(null);
          setEditOrderError(`This order (${delRes.data.orderNumber || editOrderNumber.trim()}) was deleted by Admin on ${new Date(delRes.data.deletedAt).toLocaleDateString()}. No changes can be made.`);
          setEditOrderLoading(false);
          return;
        }
      } catch (delErr) {
        // keep error
      }
    }

    setEditOrderLoading(false);
  }, [editOrderNumber, user]);

  const submitOrderEditRequest = async () => {
    if (!editOrderId || cartItems.length === 0) {
      setError('No items in the edit request or no order selected.');
      return;
    }
    setIsSubmitting(true);
    setLoading(true);
    setError('');
    try {
      const finalItems = cartItems.map(item => ({
        productDetails: item.productDetails,
        customization: item.customization || {},
        sizeData: item.sizeData || {},
        quantity: parseInt(item.quantity) || 1,
        totalPrice: parseFloat(item.totalPrice) || 0,
        logoName: item.logoName || '',
        logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0,
        namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0,
        capCharges: parseInt(item.capCharges) || 0
      }));

      const totalLogoCharges = cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0);
      const totalNamePrintingCharges = cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0);
      const totalCustomizationPrice = cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0);

      const requestedChanges = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        address: formData.address,
        city: formData.city,
        type: formData.type,
        priority: formData.priority,
        advancePaid: formData.advancePaid,
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        items: finalItems,
        quantity: finalItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
        totalPrice: cartItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0),
        logoDesign: formData.logoDesign,
        logoName: formData.logoName,
        logoCharges: totalLogoCharges,
        namePrintingCharges: totalNamePrintingCharges,
        customizationPrice: totalCustomizationPrice
      };

      await api.post(`/api/orders/${editOrderId}/edit-request`,
        { requestedChanges, reason: editReason }
      );

      // Reset everything out of edit request mode
      setIsEditMode(false);
      setEditOrderId(null);
      setOriginalOrder(null);
      setShowEditReview(false);
      setEditReason('');
      setEditOrderNumber('');
      setEditOrderData(null);
      setCartItems([]);

      setFormData({
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        address: '',
        city: '',
        type: 'STANDARD',
        priority: 'NORMAL',
        advancePaid: false,
        advanceAmount: '',
        paymentStatus: 'PENDING',
        totalPrice: '',
        quantity: 1,
        productType: '',
        fabricType: '',
        color: '',
        size: '',
        logoDesign: '',
        logoName: '',
        nameSpelling: '',
        nameColor: '',
        logoColor: '',
        logoPlacement: '',
        logoCharges: '',
        namePrintingCharges: '',
        customizationPrice: '',
        stitchingStyle: '',
        fitType: 'Regular',
        designNotes: '',
        designReference: '',
        additionalFeatures: [],
        measurements: {
          chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '',
          shirtLength: '', trouserLength: '', bottom: '', thigh: '', mori: '', ganda: ''
        },
        gender: 'Male',
        femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false }
      });
      setLogoEntries([{ name: '', design: '' }]);
      setArticleNameEntries(['']);
      setActiveTab('basic');
      alert('Edit request submitted successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting edit request');
    }
    setLoading(false);
    setIsSubmitting(false);
  };

  const isScrubsProduct = (productType) => {
    const pt = (productType || formData.productType || '').toLowerCase();
    return pt.includes('scrub') || pt.includes('uniform') || pt === '';
  };

  const getSizeChart = () => {
    return formData.gender === 'Female' ? WOMEN_SCRUBS_SIZE_CHART : MEN_SCRUBS_SIZE_CHART;
  };

  const handleSizeSelect = useCallback((s) => {
    setFormData(prev => {
      const chart = prev.gender === 'Female' ? WOMEN_SCRUBS_SIZE_CHART : MEN_SCRUBS_SIZE_CHART;
      const autoMeasurements = chart[s] || prev.measurements;
      return {
        ...prev,
        size: s,
        measurements: { ...autoMeasurements }
      };
    });
  }, []);

  const validateProductConfig = () => {
    const accessory = isAccessory(selectedProductCategory);
    
    // 1. Basic validation (customer details must be present)
    if (!isOutlet && !formData.orderNumber.trim()) return t('orderNo') + ' ' + t('required');
    if (!formData.customerName.trim()) return t('customerName') + ' ' + t('required');
    if (!formData.customerPhone.trim()) return t('customerPhone') + ' ' + t('required');
    if (formData.type === 'FULL_CUSTOM' && !(parseFloat(formData.advanceAmount) > 0)) return 'Advance payment is compulsory for custom orders.';

    // 2. Product validation (optional for FULL_CUSTOM)
    if (!formData.productType && formData.type !== 'FULL_CUSTOM') return 'Please select a Product first.';
    
    // 3. Customizations validation
    if (formData.type !== 'STANDARD') {
      if (formData.type === 'FULL_CUSTOM' && !formData.stitchingStyle) return 'Please select a Stitch Pattern.';
      if (formData.type === 'FULL_CUSTOM' && !formData.fitType) return 'Please select a Fit Profile.';
      
      // 4. Tailoring measurements validation
      if (formData.type === 'FULL_CUSTOM' && !accessory) {
        const m = formData.measurements;
        const required = formData.gender === 'Female'
          ? ['shoulder', 'chest', 'waist', 'bottom', 'shirtLength', 'hip', 'sleeve', 'trouserLength', 'hips']
          : ['shoulder', 'chest', 'bottom', 'shirtLength', 'sleeve', 'trouserLength', 'hips'];
        if (required.some(f => !m[f])) {
          return 'All precise measurements are required for custom tailoring.';
        }
      }
    }
    
    return null;
  };

  const validateCurrentTab = () => {
    setError('');
    const accessory = isAccessory(selectedProductCategory);
    
    if (activeTab === 'basic') {
      if (!isOutlet && !formData.orderNumber.trim()) return t('orderNo') + ' ' + t('required');
      if (!formData.customerName.trim()) return t('customerName') + ' ' + t('required');
      if (!formData.customerPhone.trim()) return t('customerPhone') + ' ' + t('required');
    }
    if (activeTab === 'product') {
      if (!formData.productType && formData.type !== 'FULL_CUSTOM') return 'Please select a Product.';
    }
    if (activeTab === 'custom') {
      if (formData.type === 'FULL_CUSTOM' && !formData.stitchingStyle) return 'Please select a Stitch Pattern.';
      if (formData.type === 'FULL_CUSTOM' && !formData.fitType) return 'Please select a Fit Profile.';
    }
    if (activeTab === 'sizes' && formData.type === 'FULL_CUSTOM' && !accessory && isScrubsProduct(selectedProductCategory)) {
      const m = formData.measurements;
      const required = formData.gender === 'Female'
        ? ['shoulder', 'chest', 'waist', 'bottom', 'shirtLength', 'hip', 'sleeve', 'trouserLength', 'hips']
        : ['shoulder', 'chest', 'bottom', 'shirtLength', 'sleeve', 'trouserLength', 'hips'];
      if (required.some(f => !m[f])) {
        return 'All precise measurements are required for custom tailoring.';
      }
    }
    return null;
  };

  const preventEnterSubmit = (e) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const [cartItems, setCartItems] = useState([]);
  const [showAddMore, setShowAddMore] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleAddToCart = useCallback(() => {
    const validationError = validateProductConfig();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    const brandingTotal = (parseFloat(formData.logoCharges) || 0) + (parseFloat(formData.namePrintingCharges) || 0) + (parseFloat(formData.customizationPrice) || 0);
    const payload = {
      orderNumber: formData.orderNumber,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      address: formData.address,
      city: formData.city,
      type: formData.type,
      priority: formData.priority,
      quantity: parseInt(formData.quantity) || 1,
      advancePaid: formData.advancePaid,
      advanceAmount: parseFloat(formData.advanceAmount) || 0,
      paymentStatus: formData.paymentStatus,
      logoDesign: formData.logoDesign,
      logoName: formData.logoName,
      logoCharges: parseFloat(formData.logoCharges) || 0,
      namePrintingCharges: parseFloat(formData.namePrintingCharges) || 0,
      customizationPrice: parseFloat(formData.customizationPrice) || 0,
      productDetails: {
        productType: formData.productType || formData.customProductName,
        fabricType: formData.fabricType || formData.customFabric,
        color: formData.color || formData.customColor,
        size: formData.size,
        gender: formData.gender,
        femaleOptions: formData.femaleOptions,
        sleeveLength: formData.sleeveLength || '',
        shirtLength: formData.shirtLength || '',
        matchingCap: formData.matchingCap,
        matchingCapQty: formData.matchingCapQty,
        fabricSourceProduct: formData.fabricSourceProduct || formData.customFabric,
        colorSourceProduct: formData.colorSourceProduct || formData.customColor,
        designSourceProduct: formData.designSourceProduct || formData.customDesign,
        sizeSourceProduct: formData.sizeSourceProduct,
        additionalProductRef: formData.additionalProductRef || formData.customRequirements,
        customMaterial: formData.customMaterial,
        customSpecifications: formData.customSpecifications
      },
      customization: {
        nameSpelling: articleNameEntries.filter(Boolean).join(', '),
        articleNames: articleNameEntries,
        nameColor: formData.nameColor,
        logoColor: formData.logoColor,
        logoPlacement: formData.logoPlacement,
        stitchingStyle: formData.stitchingStyle,
        fitType: formData.fitType,
        designNotes: formData.designNotes,
        designReference: formData.designReference,
        additionalFeatures: formData.additionalFeatures,
        logos: logoEntries,
        engravingType: formData.engravingType || 'direct',
        skipEngraving: formData.skipEngraving || false
      },
      sizeData: formData.measurements,
      capCharges,
      totalPrice: (computedTotalPrice > 0 ? computedTotalPrice : (parseFloat(formData.totalPrice) || 0)) + brandingTotal + capCharges
    };

    setCartItems([...cartItems, payload]);

    // Completely clear product/customization/measurement fields in formData
    setFormData(prev => ({
      ...prev,
      quantity: 1,
      totalPrice: '',
      logoCharges: '',
      namePrintingCharges: '',
      customizationPrice: '',
      productType: '',
      fabricType: '',
      color: '',
      size: '',
      logoDesign: '',
      logoName: '',
      nameSpelling: '',
      nameColor: '',
      logoColor: '',
      logoPlacement: '',
      stitchingStyle: '',
      fitType: 'Regular',
      designNotes: '',
      designReference: '',
      additionalFeatures: [],
      measurements: {
        chest: '',
        shoulder: '',
        length: '',
        sleeve: '',
        waist: '',
        hips: '',
        shirtLength: '',
        trouserLength: '',
        bottom: '',
        thigh: '',
        mori: '',
        ganda: '',
        specialNote: ''
      },
      gender: 'Male',
      femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
      matchingCap: false,
      matchingCapQty: 0,
      sleeveLength: '',
      shirtLength: '',
      fabricSourceProduct: '',
      colorSourceProduct: '',
      designSourceProduct: '',
      sizeSourceProduct: '',
      additionalProductRef: '',
      customProductName: '',
      customFabric: '',
      customMaterial: '',
      customColor: '',
      customDesign: '',
      customRequirements: '',
      customSpecifications: '',
      engravingType: 'direct',
      skipEngraving: false
    }));
    setLogoEntries([{ name: '', design: '' }]);
    setArticleNameEntries(['']);

    setShowAddMore(true);
  }, [formData, cartItems, articleNameEntries, logoEntries]);

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
      productType: pd.productType || '',
      fabricType: pd.fabricType || '',
      color: pd.color || '',
      size: pd.size || '',
      gender: pd.gender || 'Male',
      femaleOptions: pd.femaleOptions || { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
      matchingCap: pd.matchingCap || false,
      matchingCapQty: pd.matchingCapQty || 0,
      sleeveLength: pd.sleeveLength || '',
      shirtLength: pd.shirtLength || '',
      fabricSourceProduct: pd.fabricSourceProduct || '',
      colorSourceProduct: pd.colorSourceProduct || '',
      designSourceProduct: pd.designSourceProduct || '',
      sizeSourceProduct: pd.sizeSourceProduct || '',
      additionalProductRef: pd.additionalProductRef || '',
      engravingType: cust.engravingType || 'direct',
      quantity: item.quantity || 1,
      totalPrice: '',
      logoCharges: item.logoCharges?.toString() || '',
      namePrintingCharges: item.namePrintingCharges?.toString() || '',
      customizationPrice: item.customizationPrice?.toString() || '',
      logoDesign: item.logoDesign || '',
      logoName: item.logoName || '',
      nameSpelling: cust.nameSpelling || '',
      nameColor: cust.nameColor || '',
      logoColor: cust.logoColor || '',
      logoPlacement: cust.logoPlacement || '',
      stitchingStyle: cust.stitchingStyle || '',
      fitType: cust.fitType || 'Regular',
      designNotes: cust.designNotes || '',
      designReference: cust.designReference || '',
      additionalFeatures: cust.additionalFeatures || [],
      measurements: {
        chest: item.sizeData?.chest || '',
        shoulder: item.sizeData?.shoulder || '',
        length: item.sizeData?.length || '',
        sleeve: item.sizeData?.sleeve || '',
        waist: item.sizeData?.waist || '',
        hip: item.sizeData?.hip || '',
        hips: item.sizeData?.hips || '',
        shirtLength: item.sizeData?.shirtLength || '',
        trouserLength: item.sizeData?.trouserLength || '',
        bottom: item.sizeData?.bottom || '',
        thigh: item.sizeData?.thigh || '',
        mori: item.sizeData?.mori || '',
        ganda: item.sizeData?.ganda || ''
      },
    }));
    setLogoEntries(cust.logos && cust.logos.length > 0 ? cust.logos : [{ name: item.logoName || '', design: item.logoDesign || '' }]);
    setArticleNameEntries(cust.articleNames && cust.articleNames.length > 0 ? cust.articleNames : (cust.nameSpelling ? [cust.nameSpelling] : ['']));
    setShowReview(false);
    if (isEditMode) setShowProductSelector(true);
    setActiveTab(tab);
  }, [cartItems, isEditMode]);

  const handleAddMoreProducts = () => {
    setShowAddMore(false);
    setActiveTab('product');
  };

  const handleCheckout = useCallback(async () => {
    if (cartItems.length === 0) return;
    if (isSubmitting) return; 

    setIsSubmitting(true);
    setLoading(true);
    setError('');

    try {
      const finalItems = cartItems.map(item => ({
        productDetails: item.productDetails,
        customization: item.customization || {},
        sizeData: item.sizeData || {},
        quantity: parseInt(item.quantity) || 1,
        totalPrice: parseFloat(item.totalPrice) || 0,
        logoName: item.logoName || '',
        logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0,
        namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0,
        capCharges: parseInt(item.capCharges) || 0
      }));

      const firstItem = cartItems[0];
      const calcProductPrice = cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) - parseFloat(i.logoCharges || 0) - parseFloat(i.namePrintingCharges || 0) - parseFloat(i.customizationPrice || 0) - (parseInt(i.capCharges) || 0)), 0);
      const calcLogo = cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0);
      const calcName = cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0);
      const calcCustomization = cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0);
      const calcCap = cartItems.reduce((s, i) => s + (parseInt(i.capCharges) || 0), 0);
      const orderTotalBeforeDelivery = calcProductPrice + calcLogo + calcName + calcCustomization + calcCap;
      const calcDelivery = orderTotalBeforeDelivery > 7000 ? 0 : 250;
      const adjProductPrice = parseFloat(formData.adjProductPrice) || calcProductPrice;
      const adjLogoCharges = parseFloat(formData.adjLogoCharges) || calcLogo;
      const adjNamePrinting = parseFloat(formData.adjNamePrinting) || calcName;
      const adjCustomization = parseFloat(formData.adjCustomization) || calcCustomization;
      const adjCap = parseFloat(formData.adjCapCharges) || calcCap;
      const adjDelivery = calcDelivery;
      const discount = parseFloat(formData.adjDiscount) || 0;
      const adjTotal = adjProductPrice + adjLogoCharges + adjNamePrinting + adjCustomization + adjCap + adjDelivery - discount;

      const combinedOrder = {
        orderNumber: firstItem.orderNumber,
        customerName: firstItem.customerName,
        customerPhone: firstItem.customerPhone,
        address: firstItem.address,
        city: firstItem.city,
        type: firstItem.type,
        priority: firstItem.priority,
        advancePaid: firstItem.advancePaid,
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        paymentStatus: firstItem.paymentStatus || 'PENDING',
        logoDesign: firstItem.logoDesign,
        logoName: firstItem.logoName,
        logoCharges: cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0),
        namePrintingCharges: cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0),
        customizationPrice: cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0),
        deliveryCharges: adjDelivery,
        discount,
        items: finalItems,
        productDetails: finalItems[0].productDetails,
        customization: finalItems[0].customization,
        sizeData: finalItems[0].sizeData,
        quantity: finalItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
        totalPrice: adjTotal,
        instructionNotes: formData.instructionNotes || '',
        shopifyOrderDate: formData.shopifyOrderDate || null,
      };

      await api.post('/api/orders', combinedOrder);
      
      setCartItems([]);
      setSuccess(true);
      
      setFormData({
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        address: '',
        city: '',
        type: 'STANDARD',
        priority: 'NORMAL',
        advancePaid: false,
        advanceAmount: '',
        paymentStatus: 'PENDING',
        totalPrice: '',
    // deliveryCharges auto-calculated: 250 or FREE if > 7000

        quantity: 1,
        productType: '',
        fabricType: '',
        color: '',
        size: '',
        logoDesign: '',
        logoName: '',
        nameSpelling: '',
        nameColor: '',
        logoColor: '',
        logoPlacement: '',
        stitchingStyle: '',
        fitType: 'Regular',
        designNotes: '',
        designReference: '',
        additionalFeatures: [],
        measurements: {
          chest: '',
          shoulder: '',
          length: '',
          sleeve: '',
          waist: '',
          hip: '',
          hips: '',
          shirtLength: '',
          trouserLength: '',
          bottom: '',
          thigh: '',
          mori: '',
          ganda: ''
        },
          gender: 'Male',
          femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long', zip: false },
          matchingCap: false,
          matchingCapQty: 0,
          sleeveLength: '',
          shirtLength: '',
          instructionNotes: '',
          shopifyOrderDate: '',
          adjProductPrice: '',
          adjLogoCharges: '',
          adjNamePrinting: '',
          adjCustomization: '',
          adjCapCharges: '',
          adjDiscount: ''
        });
        setLogoEntries([{ name: '', design: '' }]);
        setArticleNameEntries(['']);
        setActiveTab('basic');
        setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error during checkout:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      setError(serverMsg || 'Error processing checkout. Please try again.');
    }
    setLoading(false);
    setIsSubmitting(false);
  }, [cartItems, isSubmitting, formData]);

  const OptionCard = ({ label, value, current, onClick, icon: Icon, sublabel, color, disabled = false }) => (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`relative p-5 rounded-[1.5rem] border-2 transition-all flex flex-col items-start justify-between min-h-[9rem] h-auto w-full group ${
        disabled
          ? 'border-red-900/50 bg-gray-800/20 text-gray-600'
          : current === value 
            ? `border-blue-500 bg-blue-500/10 theme-text-primary shadow-xl shadow-blue-900/30` 
            : `theme-border theme-bg-subtle theme-text-secondary hover:border-gray-600 hover:bg-gray-800/60`
      }`}
    >
      <div className={`p-3 rounded-xl ${disabled ? 'bg-gray-700/50 text-gray-600' : current === value ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`} style={color ? {backgroundColor: color} : {}}>
        {Icon ? <Icon size={16} /> : <Package size={16} />}
      </div>
      <div className="text-left w-full mt-2">
        <span className="block text-xs md:text-sm font-black uppercase tracking-wider whitespace-normal break-words leading-snug">{label}</span>
        {sublabel &&           <span className={`block text-xs md:text-sm mt-1 font-medium whitespace-normal break-words ${disabled ? 'text-red-400' : 'theme-text-muted'}`}>{sublabel}</span>}
      </div>
      {current === value && (
        <motion.div layoutId="activeMark" className="absolute top-4 right-4 bg-blue-500 rounded-full p-1 shadow-lg">
          <CheckCircle2 size={14} className="text-white" />
        </motion.div>
      )}
    </button>
  );

  const productCategories = [...new Set(inventory.filter(i => i.category && i.category !== 'FABRIC' && i.category !== 'COLOR').map(i => i.category))];
  const isAccessory = (cat) => {
    if (!cat) return false;
    const catUpper = cat.toUpperCase();
    return !['SCRUBS', 'CAP', 'CAPS'].includes(catUpper) && !catUpper.includes('COAT');
  };
  const isCustomizableProduct = (cat) => {
    if (!cat) return false;
    const catUpper = cat.toUpperCase();
    return ['SCRUBS', 'CAP', 'CAPS'].includes(catUpper) || catUpper.includes('COAT');
  };
  const isShoes = (cat) => cat?.toUpperCase() === 'SHOES';
  const productsInCategory = inventory
    .filter(i => i.category === selectedProductCategory)
    .sort((a, b) => a.name.localeCompare(b.name));
  // Get unique product names in selected category
  const uniqueProductNames = [...new Set(productsInCategory.map(i => i.name))];
  // Selected product item (single product with variants array)
  const selectedProduct = formData.productType 
    ? productsInCategory.find(i => i.name === formData.productType) 
    : null;
  // Get variants array from selected product, or empty
  const selectedProductVariants = selectedProduct?.variants && Array.isArray(selectedProduct.variants) && selectedProduct.variants.length > 0
    ? selectedProduct.variants
    : (selectedProduct ? [{ color: selectedProduct.color, size: selectedProduct.size, stock: selectedProduct.stock, price: selectedProduct.price }] : []);
  // Fabric from selected product
  const fabrics = formData.productType && selectedProduct
    ? (selectedProduct.fabric ? [selectedProduct.fabric] : [])
    : inventory.filter(i => i.category === 'FABRIC');
  // Colors from variant color values
  const colors = formData.productType && selectedProductVariants.length > 0
    ? [...new Set(selectedProductVariants.filter(v => v.color != null && v.color !== '').map(v => v.color))]
    : [];
  // Sizes from variant size values
  const availableSizes = formData.productType && selectedProductVariants.length > 0
    ? [...new Set(selectedProductVariants.filter(v => v.size != null && v.size !== '').map(v => v.size))]
    : [];

  // Compute inventory-based unit price  
  const computedUnitPrice = (() => {
    if (!selectedProduct) return 0;
    const price = selectedProduct.price || 0;
    if (selectedProductVariants.length > 0) {
      const match = selectedProductVariants.find(v =>
        (!formData.color || v.color === formData.color) &&
        (!formData.size || v.size === formData.size)
      );
      return match?.price || price;
    }
    return price;
  })();
  const computedTotalPrice = computedUnitPrice * (formData.quantity || 1);
  const capUnitPrice = 500;
  const capCharges = (formData.matchingCap ? (formData.matchingCapQty || 0) : 0) * capUnitPrice;

  // Memoized cart computations
  const memoCartTotalItems = useMemo(() => cartItems.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0), [cartItems]);
  const memoCartTotalPrice = useMemo(() => cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0), [cartItems]);
  const memoCartTotalLogoCharges = useMemo(() => cartItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0), [cartItems]);
  const memoCartTotalNamePrinting = useMemo(() => cartItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0), [cartItems]);
  const memoCartTotalCustomization = useMemo(() => cartItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0), [cartItems]);
  const memoCartProductPriceExBranding = useMemo(() => cartItems.reduce((s, i) => s + (parseFloat(i.totalPrice) - parseFloat(i.logoCharges || 0) - parseFloat(i.namePrintingCharges || 0) - parseFloat(i.customizationPrice || 0) - (parseInt(i.capCharges) || 0)), 0), [cartItems]);
  const memoCartTotalCap = useMemo(() => cartItems.reduce((s, i) => s + (parseInt(i.capCharges) || 0), 0), [cartItems]);
  const memoOrderTotalBeforeDelivery = useMemo(() => memoCartProductPriceExBranding + memoCartTotalCustomization + memoCartTotalCap, [memoCartProductPriceExBranding, memoCartTotalCustomization, memoCartTotalCap]);
  const memoCalcDelivery = useMemo(() => memoOrderTotalBeforeDelivery > 7000 ? 0 : 250, [memoOrderTotalBeforeDelivery]);
  const memoIsFreeDelivery = useMemo(() => memoCartTotalPrice > 7000, [memoCartTotalPrice]);

  const allTabs = [
    { id: 'basic', label: '1. Basics', icon: Layout },
    { id: 'product', label: '2. Selection', icon: ShoppingCart },
    { id: 'custom', label: '3. Engraving', icon: Scissors, customOnly: true },
    { id: 'sizes', label: '4. Tailoring', icon: Ruler, customOnly: true },
  ];

  const filteredTabs = allTabs.filter(tab => {
    if (tab.customOnly && formData.type === 'STANDARD') return false;
    if (tab.customOnly && !isCustomizableProduct(selectedProductCategory)) return false;
    if (tab.id === 'sizes' && isAccessory(selectedProductCategory)) return false;
    return true;
  });

  if (dataLoading) return <PageLoader text="Loading Order Entry..." />;

  return (
    <div className="max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-6">
        <div className={`flex items-center ${isUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
          <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-2xl shadow-blue-900/40 rotate-3">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className={isUrdu ? 'text-right' : ''}>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight leading-none">{isUrdu ? 'سمارٹ آرڈر انٹری' : 'Smart Order Flow'}</h1>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-[0.3em] mt-1.5">{isUrdu ? 'پیداواری بہاؤ کی ذہانت' : 'Conveyor Belt Intelligence'}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-4 ${isUrdu ? 'flex-row-reverse' : ''}`}>
          <LanguageToggle />

          {user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN' && (
            <button
              type="button"
              onClick={toggleEditMode}
              className={`flex items-center gap-2 px-5 py-3 ${
                isEditMode
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white'
              } rounded-[1.2rem] font-black text-xs md:text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg whitespace-nowrap`}
            >
              <FileEdit size={14} />
              <span className="hidden sm:inline">
                {isEditMode
                  ? (useUrdu ? 'ترمیم منسوخ کریں' : 'CANCEL EDIT')
                  : (useUrdu ? 'آرڈر میں تبدیلی' : 'EDIT ORDER')}
              </span>
            </button>
          )}

          <div className="flex p-1.5 theme-bg backdrop-blur-3xl rounded-[1.8rem] border-2 theme-border shadow-2xl overflow-x-auto no-scrollbar">
            {filteredTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.2rem] text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-500 ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' 
                    : 'text-gray-600 hover:text-white hover:bg-gray-800/50'
                } ${isUrdu ? 'flex-row-reverse' : ''}`}
              >
                <tab.icon size={16} className={activeTab === tab.id ? 'animate-pulse' : ''} />
                <span className="hidden sm:inline">{(tab.label.split('. ')[1] || tab.label).toUpperCase()}</span>
              </button>
            ))}
                    </div>
                  </div>
                </div>

      {/* Selection Summary Bar */}
      {formData.productType && (
        <div className="theme-bg border-2 border-blue-500/20 rounded-[2rem] p-5 flex flex-wrap items-center gap-4 text-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-black text-base">Selected:</span>
            <span className="theme-text-primary font-black text-lg">{formData.productType}</span>
          </div>
          {formData.fabricType && (
            <span className="theme-text-secondary font-bold text-sm">• {formData.fabricType}</span>
          )}
          {formData.color && (
            <span className="theme-text-secondary font-bold text-sm">• {formData.color}</span>
          )}
          {formData.size && (
            <span className="theme-text-secondary font-bold text-sm">• Size {formData.size}</span>
          )}
            <span className="theme-text-muted font-bold text-sm">• Qty: {formData.quantity}</span>
          {cartItems.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-full font-black text-xs">
              Cart: {cartItems.length} item{cartItems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {isEditMode && (
        <div className="mb-6 glass border-2 border-amber-500/30 rounded-[2rem] p-6 md:p-8 bg-amber-500/5 relative overflow-hidden backdrop-blur-md shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl animate-pulse">
                <FileEdit size={24} />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-amber-400 uppercase tracking-wider">
                  {isUrdu ? 'ترمیم کا طریقہ کار فعال ہے' : 'Edit Request Mode Active'}
                </h3>
                <p className="theme-text-muted text-xs font-bold mt-1">
                  {isUrdu 
                    ? 'کسی بھی فعال آرڈر میں تبدیلی کی درخواست پیش کرنے کے لیے نیچے آرڈر نمبر درج کریں۔' 
                    : 'Modify any active order details below, then submit for Admin approval.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleEditMode}
              className="px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap"
            >
              {isUrdu ? 'منسوخ کریں' : 'Cancel Edit Mode'}
            </button>
          </div>

          {!originalOrder ? (
            <div className="mt-6 border-t border-amber-500/20 pt-6">
              <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-black text-amber-400 uppercase tracking-widest ml-2">
                    {isUrdu ? 'آرڈر نمبر درج کریں' : 'Enter Order Number / ID'}
                  </label>
                  <div className="relative group">
                    <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-400 transition-colors" size={16} />
                    <input
                      type="text"
                      value={editOrderNumber}
                      onChange={(e) => setEditOrderNumber(e.target.value)}
                      placeholder="e.g. ORD-1002"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          fetchOrderByNumber();
                        }
                      }}
                      className="w-full theme-input rounded-[1.5rem] py-5 pl-16 pr-6 border-amber-500/20 focus:border-amber-400 text-lg font-black tracking-wider shadow-inner text-amber-400 placeholder-amber-500/30"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={editOrderLoading}
                  onClick={fetchOrderByNumber}
                  className="px-8 py-5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-[1.5rem] hover:bg-amber-400 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 min-w-[150px] active:scale-95"
                >
                  {editOrderLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  {isUrdu ? 'آرڈر تلاش کریں' : 'Fetch Order'}
                </button>
              </div>

              {editOrderError && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fadeIn">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{editOrderError}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 border-t border-amber-500/20 pt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-amber-500 font-black">Loaded Order:</span>
                <span className="theme-text-primary font-black bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                  #{originalOrder.orderNumber}
                </span>
                <span className="theme-text-secondary">•</span>
                <span className="theme-text-primary font-bold">{originalOrder.customerName}</span>
                <span className="theme-text-secondary">•</span>
                <span className="theme-text-muted text-xs capitalize">{originalOrder.type}</span>
                {originalOrder.outletName && (
                  <>
                    <span className="theme-text-secondary">•</span>
                    <span className="text-amber-400/80 text-xs font-semibold">{originalOrder.outletName}</span>
                  </>
                )}
              </div>
              <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl font-black uppercase tracking-wider">
                {isUrdu ? 'آرڈر ڈیٹا لوڈ ہو گیا ہے' : 'Data loaded successfully'}
              </div>
            </div>
          )}

          {/* Edit Mode — Comparison Summary (hidden when comparison view is shown) */}
          {originalOrder && cartItems.length > 0 && !(isEditMode && !showProductSelector) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-xl">
              <div className="flex items-center gap-3 text-xs md:text-sm">
                <span className="font-black text-indigo-400 uppercase tracking-wider">Changes Summary</span>
                <span className="text-gray-700">|</span>
                <span className="theme-text-muted font-bold">
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} ({memoCartTotalItems} units)
                </span>
                {(() => {
                  const newTotal = memoCartTotalPrice;
                  const oldTotal = parseFloat(originalOrder.totalPrice) || 0;
                  const diff = newTotal - oldTotal;
                  if (diff === 0) return null;
                  return (
                    <span className={`font-black ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      ₨{diff > 0 ? '+' : ''}{diff.toLocaleString()}
                    </span>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setShowEditReview(true)}
                className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black border border-amber-500/20 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                {useUrdu ? 'تبدیلیاں دیکھیں' : 'View Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {isEditMode && originalOrder && !showProductSelector ? (
          <motion.div
            key="comparison"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* ---- COMPARISON VIEW: Original vs Requested ---- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* LEFT PANEL — Original Order (Read Only) */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>{useUrdu ? 'موجودہ آرڈر (صرف پڑھیں)' : 'Existing Order (Read Only)'}</span>
                </div>

                {/* Customer Info */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{useUrdu ? 'آرڈر نمبر' : 'Order #'}</span>
                    <span className="font-bold theme-text-primary">{originalOrder.orderNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{useUrdu ? 'گاہک' : 'Customer'}</span>
                    <span className="font-bold theme-text-primary">{originalOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{useUrdu ? 'فون' : 'Phone'}</span>
                    <span className="font-bold theme-text-primary">{originalOrder.customerPhone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{useUrdu ? 'قسم' : 'Type'}</span>
                    <span className="font-bold uppercase theme-text-primary">{originalOrder.type || 'STANDARD'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{useUrdu ? 'ترجیح' : 'Priority'}</span>
                    <span className={`font-bold uppercase ${originalOrder.priority === 'SUPER_URGENT' ? 'text-red-400' : originalOrder.priority === 'URGENT' ? 'text-amber-400' : 'theme-text-primary'}`}>{originalOrder.priority || 'NORMAL'}</span>
                  </div>
                </div>

                {/* Original Products */}
                <div className="border-t border-red-500/10 pt-4">
                  <p className="text-xs md:text-sm font-black text-red-400 uppercase tracking-wider mb-3">{useUrdu ? 'پروڈکٹس' : 'Products'} ({(() => { try { const pd = typeof originalOrder.productDetails === 'string' ? JSON.parse(originalOrder.productDetails) : originalOrder.productDetails; return Array.isArray(pd) ? pd.length : (pd ? 1 : 0); } catch { return 0; } })()})</p>
                  {(() => {
                    let items = [];
                    try {
                      const pd = typeof originalOrder.productDetails === 'string' ? JSON.parse(originalOrder.productDetails) : originalOrder.productDetails;
                      items = Array.isArray(pd) ? pd : (pd ? [pd] : []);
                    } catch { items = []; }
                    return items.map((item, idx) => {
                      const d = item.productDetails || item;
                      const cust = item.customization || {};
                      return (
                        <div key={idx} className="bg-red-900/10 rounded-xl p-3 mb-2 border border-red-500/10 last:mb-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold theme-text-primary">{d.productType || 'Unknown'}</p>
                              <p className="text-xs md:text-sm theme-text-muted mt-0.5">
                                {[d.color, d.size].filter(Boolean).join(' / ') || '—'} × {item.quantity || originalOrder.quantity || 1}
                              </p>
                              {d.fabricType && <p className="text-xs text-gray-500 mt-0.5">{d.fabricType}</p>}
                            </div>
                            <span className="text-xs font-black text-red-400">₨{((parseFloat(item.totalPrice) || parseFloat(originalOrder.totalPrice) || 0) / (items.length || 1)).toLocaleString()}</span>
                          </div>
                          {/* Branding/Customization */}
                          {(cust.nameSpelling || cust.stitchingStyle || originalOrder.logoDesign || cust.logos) && (
                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-red-500/10">
                              {cust.articleNames && cust.articleNames.map((an, ai) => (
                                <span key={ai} className="text-[9px] font-bold text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">Name: {an}</span>
                              ))}
                              {!cust.articleNames && cust.nameSpelling && <span className="text-[9px] font-bold text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">Name: {cust.nameSpelling}</span>}
                              {cust.stitchingStyle && <span className="text-[9px] font-bold text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">{cust.stitchingStyle === 'DBL' ? 'Double' : 'Single'} Stitch</span>}
                              {cust.fitType && <span className="text-[9px] font-bold text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded">{cust.fitType} Fit</span>}
                              {originalOrder.logoDesign && <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">Has Logo</span>}
                              {cust.logos && cust.logos.length > 0 && cust.logos.map((l, li) => (
                                <span key={li} className="text-[9px] font-bold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">{l.name || `Logo ${li + 1}`}</span>
                              ))}
                              {d.gender && <span className="text-[9px] font-bold text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded">{d.gender}</span>}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Original Total */}
                <div className="border-t border-red-500/10 pt-3 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-400 uppercase">{useUrdu ? 'اصل کل' : 'Original Total'}</span>
                  <span className="text-sm font-black text-red-400">₨{parseFloat(originalOrder.totalPrice || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* RIGHT PANEL — Requested Changes (Editable) */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{useUrdu ? 'مجوزہ تبدیلیاں (ترمیم)' : 'Requested Changes (Editable)'}</span>
                </div>

                {/* Editable Customer Info */}
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'گاہک کا نام' : 'Customer Name'}</span>
                      <input type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2 px-3 text-sm font-bold ${hasChanged(originalOrder.customerName, formData.customerName) ? 'border-amber-500/50 bg-amber-500/10' : ''}`} />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'فون' : 'Phone'}</span>
                      <input type="text" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2 px-3 text-sm font-bold ${hasChanged(originalOrder.customerPhone, formData.customerPhone) ? 'border-amber-500/50 bg-amber-500/10' : ''}`} />
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">{useUrdu ? 'پتہ' : 'Address'}</span>
                    <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}
                      className={`w-full theme-input rounded-xl py-2 px-3 text-sm font-bold ${hasChanged(originalOrder.address, formData.address) ? 'border-amber-500/50 bg-amber-500/10' : ''}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'شہر' : 'City'}</span>
                      <input type="text" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2 px-3 text-sm font-bold ${hasChanged(originalOrder.city, formData.city) ? 'border-amber-500/50 bg-amber-500/10' : ''}`} />
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'ترجیح' : 'Priority'}</span>
                      <div className="flex gap-1">
                        {['NORMAL', 'URGENT', 'SUPER_URGENT'].map(p => (
                          <button key={p} type="button" onClick={() => setFormData({...formData, priority: p})}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all uppercase ${formData.priority === p ? (p === 'SUPER_URGENT' ? 'bg-red-600 text-white' : p === 'URGENT' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-white') : 'bg-gray-900 text-gray-600 hover:bg-gray-800'}`}>{p === 'SUPER_URGENT' ? 'SUPER' : p}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'آرڈر کی قسم' : 'Type'}</span>
                      <div className="flex gap-1">
                        {['STANDARD', 'READY_LOGO', 'FULL_CUSTOM'].map(t => (
                          <button key={t} type="button" onClick={() => setFormData({...formData, type: t})}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all uppercase ${formData.type === t ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-600 hover:bg-gray-800'}`}>{t === 'READY_LOGO' ? 'LOGO' : t === 'FULL_CUSTOM' ? 'CUSTOM' : 'STD'}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">{useUrdu ? 'ایڈوانس رقم' : 'Advance Amount (₨)'}</span>
                      <input type="number" min="0" value={formData.advanceAmount || ''} placeholder="e.g. 2000"
                        onChange={e => setFormData({...formData, advanceAmount: e.target.value})}
                        className="w-full bg-gray-900 border-2 border-emerald-500/30 rounded-xl py-2.5 px-4 text-sm font-bold text-emerald-400 focus:border-emerald-500 outline-none transition-all" />
                      {parseFloat(formData.advanceAmount) > 0 && (
                        <p className="text-xs text-emerald-400 font-bold mt-1">
                          {useUrdu ? 'ایڈوانس وصول: ' : 'Advance Received: '}₨{parseFloat(formData.advanceAmount).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editable Items List */}
                <div className="border-t border-emerald-500/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-wider">{useUrdu ? 'آئٹمز' : 'Items'} ({cartItems.length})</p>
                    <button
                      type="button"
                      onClick={() => { setShowProductSelector(true); setActiveTab('product'); }}
                      className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Plus size={10} /> {useUrdu ? 'شامل کریں' : 'Add Product'}
                    </button>
                  </div>
                  {cartItems.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs md:text-sm font-bold">
                      <Plus size={24} className="mx-auto mb-2 opacity-30" />
                      <p>{useUrdu ? 'کوئی آئٹم نہیں — پروڈکٹ شامل کرنے کے لیے کلک کریں' : 'No items yet — click Add Product above'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartItems.map((item, idx) => {
                        const d = item.productDetails || {};
                        const cust = item.customization || {};
                        return (
                          <div key={idx} className="bg-gray-900/50 rounded-xl p-3 border border-emerald-500/10">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold theme-text-primary truncate">{d.productType || 'Unknown'}</p>
                                <p className="text-xs theme-text-muted truncate mt-0.5">
                                  {[d.color, d.size].filter(Boolean).join(' / ') || '—'} {d.fabricType ? `• ${d.fabricType}` : ''}
                                </p>
                                {/* Branding tags */}
                                {(cust.nameSpelling || cust.stitchingStyle || item.logoDesign || cust.logos) && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {cust.articleNames && cust.articleNames.map((an, ai) => (
                                      <span key={ai} className="text-[6px] font-bold text-purple-400 bg-purple-900/20 px-1 rounded">Name: {an}</span>
                                    ))}
                                    {!cust.articleNames && cust.nameSpelling && <span className="text-[6px] font-bold text-purple-400 bg-purple-900/20 px-1 rounded">Name: {cust.nameSpelling}</span>}
                                    {cust.stitchingStyle && <span className="text-[6px] font-bold text-blue-400 bg-blue-900/20 px-1 rounded">{cust.stitchingStyle === 'DBL' ? 'Double' : 'Single'}</span>}
                                    {item.logoDesign && <span className="text-[6px] font-bold text-amber-400 bg-amber-900/20 px-1 rounded">Logo</span>}
                                    {cust.logos && cust.logos.length > 0 && cust.logos.map((l, li) => (
                                      <span key={li} className="text-[6px] font-bold text-amber-400 bg-amber-900/20 px-1 rounded">{l.name || `Logo ${li + 1}`}</span>
                                    ))}
                                  </div>
                                )}
                                {/* Inline Qty + Price */}
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-500 font-bold">{useUrdu ? 'تعداد' : 'Qty'}:</span>
                                    <input type="number" min="1" value={item.quantity || 1}
                                      onChange={e => {
                                        const newCart = [...cartItems];
                                        newCart[idx] = {...newCart[idx], quantity: parseInt(e.target.value) || 1};
                                        setCartItems(newCart);
                                      }}
                                      className="w-14 theme-input rounded-lg py-1 px-2 text-xs md:text-sm font-bold text-center" />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-gray-500 font-bold">₨:</span>
                                    <input type="number" min="0" value={item.totalPrice || 0}
                                      onChange={e => {
                                        const newCart = [...cartItems];
                                        newCart[idx] = {...newCart[idx], totalPrice: parseFloat(e.target.value) || 0};
                                        setCartItems(newCart);
                                      }}
                                      className="w-20 theme-input rounded-lg py-1 px-2 text-xs md:text-sm font-bold text-center" />
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                <button type="button" onClick={() => editCartItem(idx, 'product')}
                                  className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all">
                                  <FileEdit size={10} />
                                </button>
                                <button type="button" onClick={() => {
                                  const newCart = cartItems.filter((_, i) => i !== idx);
                                  setCartItems(newCart);
                                }}
                                  className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---- PRICE CALCULATION BAR ---- */}
            <div className="glass rounded-[2rem] p-5 border-2 border-amber-500/20 bg-amber-500/5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{useUrdu ? 'اصل کل' : 'Original Total'}</p>
                  <p className="text-lg font-black text-red-400">₨{parseFloat(originalOrder.totalPrice || 0).toLocaleString()}</p>
                </div>
                <div className="hidden md:block border-l border-amber-500/20" />
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{useUrdu ? 'مجوزہ کل' : 'Updated Total'}</p>
                  <p className="text-lg font-black text-emerald-400">₨{memoCartTotalPrice.toLocaleString()}</p>
                </div>
                <div className="hidden md:block border-l border-amber-500/20" />
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">{useUrdu ? 'فرق' : 'Difference'}</p>
                  {(() => {
                    const oldT = parseFloat(originalOrder.totalPrice) || 0;
                    const newT = memoCartTotalPrice;
                    const diff = newT - oldT;
                    return (
                      <p className={`text-lg font-black ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {diff > 0 ? '+' : ''}{diff === 0 ? '₨0' : `₨${diff.toLocaleString()}`}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ---- REASON + SUBMIT ---- */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.2em] ml-2">
                  {useUrdu ? 'ترمیم کی وجہ (لازمی)' : 'Reason for Edit Request (Required)'}
                </label>
                <textarea required value={editReason} onChange={e => setEditReason(e.target.value)}
                  className="w-full theme-input rounded-[1.5rem] py-4 px-6 text-sm font-semibold resize-none h-20 border border-amber-500/20 focus:border-amber-400"
                  placeholder={useUrdu ? 'تبدیلی کی وجہ بتائیں' : 'Provide justification for these changes...'} />
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={toggleEditMode}
                  disabled={loading || isSubmitting}
                  className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all active:scale-95 border border-gray-700 disabled:opacity-50">
                  {useUrdu ? 'منسوخ کریں' : 'CANCEL'}
                </button>
                <button type="button" onClick={submitOrderEditRequest}
                  disabled={loading || isSubmitting || !editReason.trim() || cartItems.length === 0}
                  className="flex-1 py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                  {loading || isSubmitting ? (<Loader2 size={16} className="animate-spin" />) : (<FileEdit size={16} />)}
                  <span>{loading || isSubmitting ? (useUrdu ? 'بھیج رہا ہے...' : 'SUBMITTING...') : (useUrdu ? 'درخواست جمع کروائیں' : 'SUBMIT EDIT REQUEST')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
          {activeTab === 'basic' && (
            <motion.div
              key="basic"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className={`lg:col-span-8 glass p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] space-y-6 md:space-y-10 border theme-border shadow-2xl relative overflow-hidden ${useUrdu ? 'text-right' : ''}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  <h3 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Identity</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ml-4">Order No.</label>
                    <div className="relative group">
                      <Hash className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={16} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={isOutlet ? 'AUTO-GENERATED' : formData.orderNumber}
                        disabled={isOutlet}
                        onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                        className={`w-full theme-input rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} transition-all text-2xl font-black shadow-inner ${isOutlet ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={isOutlet ? 'Will be auto-assigned' : "ORD-772"}
                        required={!isOutlet}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerName')}</label>
                    <div className="relative group">
                      <User className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={16} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                        className={`w-full theme-input rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} transition-all text-2xl font-black shadow-inner`}
                        placeholder={useUrdu ? 'کسٹمر کا نام' : "Dr. Alex Rivera"}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerPhone')}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/10 text-pink-500`}>
                        <Phone size={18} />
                      </div>
                      <input
                        type="tel"
                        onKeyDown={preventEnterSubmit}
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                        placeholder="0300-1234567"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'پتہ (Address) - اختیاری' : 'Customer Address (Optional)'}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500`}>
                        <span className="font-black text-xs">📍</span>
                      </div>
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                        placeholder={useUrdu ? 'گھر کا پتہ' : "House #123, Street #4"}
                      />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <label className={`flex items-center justify-between p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentStatus === 'PAID' ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-900/20' : 'border-gray-700/50 bg-gray-900'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-all ${formData.paymentStatus === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                          <p className="text-xs md:text-sm font-black uppercase tracking-wider">{useUrdu ? 'آرڈر پہلے سے ادا شدہ' : 'Order Already Paid'}</p>
                          <p className="text-[10px] text-gray-500 font-semibold">{useUrdu ? 'رقم موصول ہو چکی ہے - براہِ کرم دوبارہ وصول نہ کریں' : 'Payment already collected — do not collect again'}</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={formData.paymentStatus === 'PAID'} onChange={e => setFormData({...formData, paymentStatus: e.target.checked ? 'PAID' : 'PENDING'})} className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-900 checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer" />
                    </label>
                  </div>
                  <div className="space-y-4">
                    <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'شہر (City) - اختیاری' : 'City (Optional)'}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500`}>
                        <span className="font-black text-xs">🏙️</span>
                      </div>
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                        placeholder={useUrdu ? 'شہر کا نام' : "Lahore"}
                      />
                    </div>
                  </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'شاپیفائے آرڈر کی تاریخ' : 'Shopify Order Date (Optional)'}</label>
                      <div className="relative group">
                        <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-500`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <input
                          type="datetime-local"
                          onKeyDown={preventEnterSubmit}
                          value={formData.shopifyOrderDate}
                          onChange={(e) => setFormData({...formData, shopifyOrderDate: e.target.value})}
                          className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        const isFree = memoIsFreeDelivery;
                        return (
                          <>
                            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'ڈلیوری چارجز' : 'Delivery Charges'}</label>
                            <div className={`relative group ${isFree ? 'opacity-60' : ''}`}>
                              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full ${isFree ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                <span className="font-black text-xs">🚚</span>
                              </div>
                              <div className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} text-xl font-bold flex items-center ${isFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {isFree ? 'FREE' : '₨250'}
                              </div>
                            </div>
                            {isFree && (
                              <div className="flex items-center gap-2 mt-2 px-2">
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full tracking-wider uppercase">FREE DELIVERY</span>
                                <span className="text-[10px] text-emerald-400/60">(Order &gt; ₨7,000)</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{useUrdu ? 'صنف (Gender)' : 'Gender Option'}</label>
                    <div className="flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border shadow-inner">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, gender: 'Male'})}
                        className={`flex-1 py-4 rounded-xl text-sm font-black transition-all ${formData.gender === 'Male' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}
                      >
                        {useUrdu ? 'مردانہ' : 'MALE'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, gender: 'Female'})}
                        className={`flex-1 py-4 rounded-xl text-sm font-black transition-all ${formData.gender === 'Female' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}
                      >
                        {useUrdu ? 'زنانہ' : 'FEMALE'}
                      </button>
                    </div>
                  </div>

                  {formData.gender === 'Female' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <label className="flex items-center justify-between p-3 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-2.5 rounded-xl transition-all shrink-0 ${formData.femaleOptions.dupatta ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <Layers size={16} />
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-black text-xs md:text-sm uppercase truncate">{t('dupatta')}</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.dupatta} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, dupatta: e.target.checked}})} className="w-5 h-5 shrink-0 ml-2 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                      <label className="flex items-center justify-between p-3 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${formData.femaleOptions.zip ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <span className="font-black text-xs md:text-sm">ZIP</span>
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-black text-xs md:text-sm uppercase truncate">{t('zip')}</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.zip} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, zip: e.target.checked}})} className="w-5 h-5 shrink-0 ml-2 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                    </div>
                  )}
                </div>

                  {formData.type === 'STANDARD' && (
                    <div className="mt-6 space-y-3">
                      <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'ہدایات' : 'Instruction Notes'}</label>
                      <textarea value={formData.instructionNotes || ''}
                        onChange={e => setFormData({...formData, instructionNotes: e.target.value})}
                        className="w-full theme-input rounded-2xl py-4 px-5 text-sm font-bold resize-none"
                        rows={3} placeholder={useUrdu ? 'اضافی ہدایات یہاں درج کریں...' : 'Enter any special instructions...'}
                      />
                    </div>
                  )}
              </div>

              <div className={`lg:col-span-4 glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] space-y-8 md:space-y-10 border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <h3 className={`text-lg md:text-xl font-black text-yellow-500 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
                  <Star size={16} fill="currentColor" />
                  <span>{useUrdu ? 'آرڈر کی تفصیل' : 'Protocol'}</span>
                </h3>
                
                <div className="space-y-6 md:space-y-8">
                  <div className="flex p-1.5 md:p-2 theme-bg rounded-xl md:rounded-2xl border-2 theme-border shadow-inner">
                    {!isOutlet && (
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'STANDARD', advancePaid: false, advanceAmount: ''})}
                        className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${
                          formData.type === 'STANDARD' ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'
                        }`}
                      >
                        {useUrdu ? URDU_LABELS.standard : 'STD'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'READY_LOGO', advancePaid: false, advanceAmount: ''})}
                      className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${
                        formData.type === 'READY_LOGO' ? 'bg-purple-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'
                      }`}
                    >
                      {useUrdu ? URDU_LABELS.logo : 'LOGO'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'FULL_CUSTOM', advancePaid: true, advanceAmount: ''})}
                      className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${
                        formData.type === 'FULL_CUSTOM' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'
                      }`}
                    >
                      {useUrdu ? URDU_LABELS.custom : 'CUSTOM'}
                    </button>
                  </div>

                  {/* Priority Level */}
                  <div className="space-y-2 md:space-y-3">
                    <label className="font-black text-xs md:text-sm uppercase tracking-widest theme-text-muted">{t('priority')}</label>
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                      {['NORMAL', 'URGENT', 'SUPER_URGENT'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({...formData, priority: p})}
                          className={`py-2.5 md:py-3 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all border-2 leading-tight text-center ${
                            formData.priority === p
                              ? p === 'SUPER_URGENT'
                                ? 'bg-red-600 text-white border-red-500 shadow-lg'
                                : p === 'URGENT'
                                ? 'bg-amber-600 text-white border-amber-500 shadow-lg'
                                : 'bg-gray-800 text-white border-gray-600 shadow-lg'
                              : 'theme-bg text-gray-600 theme-border hover:border-gray-600'
                          }`}
                        >
                          {p === 'SUPER_URGENT' ? '⚡ SUPER' : p === 'URGENT' ? '⚡ URGENT' : 'NORMAL'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs md:text-sm font-black uppercase theme-text-muted tracking-[0.2em]">{useUrdu ? 'ایڈوانس رقم' : 'Advance Amount (₨)'}</label>
                    <div className="relative">
                      <input type="number" min="0" value={formData.advanceAmount || ''} placeholder="e.g. 2000"
                        onChange={e => setFormData({...formData, advanceAmount: e.target.value})}
                        className="w-full bg-gray-900 border-2 border-emerald-500/30 rounded-xl py-3 md:py-4 px-4 text-sm md:text-base font-bold text-emerald-400 focus:border-emerald-500 outline-none transition-all" />
                      {parseFloat(formData.advanceAmount) > 0 && (
                        <p className="text-xs text-emerald-400 font-bold mt-1.5">
                          {useUrdu ? 'ایڈوانس وصول: ' : 'Advance Received: '}₨{parseFloat(formData.advanceAmount).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'product' && (
            <motion.div
              key="product"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6 md:space-y-10"
            >
              <div className="glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl">
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between mb-6 md:mb-10 gap-4 md:gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className={`space-y-1 ${useUrdu ? 'text-right' : ''}`}>
                    <h3 className={`text-xl md:text-3xl font-black theme-text-primary flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                      <Package className="text-blue-500" size={32} />
                      <span>{t('productSelection')}</span>
                    </h3>
                    <p className={`theme-text-muted text-xs font-bold uppercase tracking-widest ${useUrdu ? 'mr-12' : 'ml-12'}`}>Step 1: Choose category & style</p>
                  </div>
                  <div className="flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border shadow-inner overflow-x-auto no-scrollbar max-w-full">
                    {productCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedProductCategory(cat);
                          if (isAccessory(cat) && !isShoes(cat)) {
                            setFormData(prev => ({...prev, size: 'Standard', measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '' }}));
                          } else {
                            setFormData(prev => ({...prev, size: ''}));
                          }
                        }}
                        className={`px-8 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${selectedProductCategory === cat ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-600 hover:text-white hover:bg-gray-800'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Search Bar */}
                <div className="relative mb-2">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
                  <input
                    type="text"
                    placeholder={useUrdu ? 'پروڈکٹ تلاش کریں...' : 'Search products by name...'}
                    value={productSearchTerm}
                    onChange={e => setProductSearchTerm(e.target.value)}
                    className={`w-full pl-14 pr-10 py-4 theme-input rounded-2xl text-sm font-bold transition-colors ${useUrdu ? 'text-right pr-14 pl-10' : ''}`}
                  />
                  {productSearchTerm && (
                    <button type="button" onClick={() => setProductSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted hover:text-white transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Manual Product Entry for FULL_CUSTOM */}
                {formData.type === 'FULL_CUSTOM' && (
                  <div className="mb-6 p-4 md:p-6 theme-bg-subtle rounded-2xl border border-blue-500/20 bg-blue-500/5">
                    <h3 className="text-sm font-black text-blue-400 uppercase mb-1 flex items-center gap-2">
                      <span>✏️</span> Manual Product Entry
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">Enter custom product details if not selecting from catalog</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Product Name</label>
                        <input type="text" value={formData.customProductName} onChange={e => setFormData({...formData, customProductName: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Custom Tunic" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Fabric</label>
                        <input type="text" value={formData.customFabric} onChange={e => setFormData({...formData, customFabric: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Cotton Twill" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Material Details</label>
                        <input type="text" value={formData.customMaterial} onChange={e => setFormData({...formData, customMaterial: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. 100% Cotton, 200 GSM" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Color</label>
                        <input type="text" value={formData.customColor} onChange={e => setFormData({...formData, customColor: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Navy Blue" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Design Details</label>
                        <input type="text" value={formData.customDesign} onChange={e => setFormData({...formData, customDesign: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Mandarin collar, patch pockets" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Custom Requirements</label>
                        <input type="text" value={formData.customRequirements} onChange={e => setFormData({...formData, customRequirements: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="Any special requirements" />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Product Specifications</label>
                        <textarea value={formData.customSpecifications} onChange={e => setFormData({...formData, customSpecifications: e.target.value})} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold resize-none" rows={2} placeholder="Any additional specifications or notes" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {Array.from(new Set(productsInCategory.map(i => i.name)))
                    .map(name => productsInCategory.find(i => i.name === name))
                    .filter(item => !productSearchTerm || item.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                    .map(item => {
                      const totalStock = item.variants && Array.isArray(item.variants)
                        ? item.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
                        : (item.stock || 0);
                      return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (formData.productType === item.name) {
                            setFormData({...formData, productType: '', fabricType: '', color: '', productImage: null});
                          } else {
                            setFormData({
                              ...formData, 
                              productType: item.name,
                              fabricType: item.fabric || formData.fabricType,
                              color: item.color || formData.color,
                              productImage: item.imageUrl || null
                            });
                          }
                        }}
                        className={`relative p-4 rounded-[1.5rem] border-2 transition-all flex flex-col items-center justify-between min-h-[10rem] w-full group ${
          formData.productType === item.name 
            ? 'border-blue-500 bg-blue-500/10 theme-text-primary shadow-xl shadow-blue-900/30' 
            : 'theme-border theme-bg-subtle theme-text-secondary hover:border-gray-600 hover:bg-gray-800/60'
                        }`}
                      >
                        {item.imageUrl && (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-16 h-16 object-contain rounded-xl mb-2"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        )}
                        <div className={`p-3 rounded-xl ${formData.productType === item.name ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`}>
                          <Package size={22} />
                        </div>
                        <div className="text-center w-full mt-2 space-y-2">
                          <span className="block text-sm font-black uppercase tracking-wider leading-snug">{item.name}</span>
                          {!isEditMode && (
                            <span className="block text-lg font-black tracking-tight">
                              <span className={`${totalStock > 50 ? 'text-emerald-400' : totalStock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {totalStock}
                              </span>
                              <span className="text-xs md:text-sm theme-text-muted ml-1">in stock</span>
                            </span>
                          )}
                          {(item.price > 0 || (item.variants && Array.isArray(item.variants) && item.variants.some(v => v.price))) && (
                            <span className="block text-xs font-black text-emerald-400">
                              ₨{Number(
                                (item.variants && Array.isArray(item.variants) && item.variants.length > 0
                                  ? (item.variants.find(v => v.price)?.price || item.price)
                                  : item.price)
                              ).toLocaleString()}
                              <span className="text-xs theme-text-muted ml-0.5">/unit</span>
                            </span>
                          )}
                          {expandedProducts[item.id] && item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap justify-center gap-1">
                                {[...new Set(item.variants.filter(v => v.color).map(v => v.color))].map(c => (
                                  <span key={c} className="text-xs font-bold theme-text-secondary bg-gray-800/60 px-2 py-0.5 rounded-full truncate max-w-[70px]">{c}</span>
                                ))}
                              </div>
                              <div className="flex flex-wrap justify-center gap-1">
                                {[...new Set(item.variants.filter(v => v.size).map(v => v.size))].map(s => (
                                  <span key={s} className="text-xs font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full">{s}</span>
                                ))}
                              </div>
                            </div>
                          ) : expandedProducts[item.id] && item.color ? (
                            <span className="block text-xs md:text-sm theme-text-muted font-bold truncate">{item.color}</span>
                          ) : null}
                          {item.variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExpandedProducts(prev => ({...prev, [item.id]: !prev[item.id]})); }}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors mt-1"
                            >
                              {expandedProducts[item.id] ? 'Show Less' : 'View Details'}
                            </button>
                          )}
                        </div>
                        {formData.productType === item.name && (
                          <motion.div layoutId="activeProduct" className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-lg">
                            <CheckCircle2 size={14} className="text-white" />
                          </motion.div>
                        )}
                      </button>
                    )})}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
                <div className={`lg:col-span-5 glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className="space-y-1 mb-6 md:mb-10">
                    <h3 className={`text-2xl font-black text-emerald-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                      <Layers size={28} />
                      <span>{t('fabric')}</span>
                    </h3>
                    <p className={`theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 2: Define fabric feel</p>
                  </div>
                  {fabrics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-5">
                      {fabrics.map((f, fi) => {
                        const fName = typeof f === 'string' ? f : (f.fabric || f.name);
                        const fStock = typeof f === 'string'
                          ? selectedProductVariants.reduce((s, v) => s + (v.stock || 0), 0)
                          : (f.stock || 0);
                        return (
                        <OptionCard
                          key={fi}
                          label={fName}
                          value={fName}
                          current={formData.fabricType}
                          onClick={(val) => setFormData({...formData, fabricType: val})}
                          icon={Layers}
                           sublabel={isEditMode ? '' : (fStock > 0 ? `${fStock} units` : 'Out of stock')}
                        />
                      )})}
                    </div>
                  ) : (
                    <div className="theme-bg-subtle p-6 rounded-2xl border theme-border text-center mt-4">
                      <p className="theme-text-secondary font-bold text-base">Select a product first to see available fabrics</p>
                    </div>
                  )}
                </div>

                <div className={`lg:col-span-7 glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className={`flex flex-col sm:flex-row items-center justify-between mb-6 md:mb-10 gap-3 md:gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-2xl font-black text-purple-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Palette size={28} />
                        <span>{t('color')} & {t('size')}</span>
                      </h3>
                      <p className={`theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 3: Visual scaling</p>
                    </div>
                    {(!isAccessory(selectedProductCategory) || (isShoes(selectedProductCategory) && formData.productType)) && (
                      <div className={`flex flex-wrap gap-1.5 p-1.5 theme-bg rounded-xl border-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {(availableSizes.length > 0 ? availableSizes : ['S', 'M', 'L', 'XL', '2XL']).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSizeSelect(s)}
                            className={`font-black transition-all rounded-lg ${
                              isShoes(selectedProductCategory)
                                ? 'px-3 py-1.5 text-[10px] leading-tight'
                                : 'w-14 h-14 text-xs'
                            } ${
                              formData.size === s 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'text-gray-600 hover:text-white'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {colors.length > 0 && (
                    <>
                    <div className="relative mb-3 mt-2">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
                      <input
                        type="text"
                        placeholder={useUrdu ? 'رنگ تلاش کریں...' : 'Search colors...'}
                        value={colorSearchTerm}
                        onChange={e => setColorSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-10 py-2.5 theme-input rounded-xl text-sm font-bold transition-colors ${useUrdu ? 'text-right pr-10 pl-10' : ''}`}
                      />
                      {colorSearchTerm && (
                        <button type="button" onClick={() => setColorSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-muted hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-4 mt-2">
                      {colors
                        .filter(c => !colorSearchTerm || c.toLowerCase().includes(colorSearchTerm.toLowerCase()))
                        .map(c => {
                        const stockForColor = selectedProductVariants
                          .filter(v => v.color === c)
                          .reduce((s, v) => s + (v.stock || 0), 0);
                        const colorMap = {
                          'white': '#ffffff', 'black': '#1a1a1a', 'navy': '#1e3a5f', 'royal blue': '#4169e1',
                          'dark blue': '#0a2351', 'light blue': '#add8e6', 'sky blue': '#87ceeb',
                          'red': '#dc2626', 'dark red': '#8b0000', 'maroon': '#800000', 'wine': '#722f37',
                          'green': '#16a34a', 'dark green': '#064e3b', 'olive': '#808000', 'teal': '#008080',
                          'grey': '#6b7280', 'gray': '#6b7280', 'dark grey': '#374151', 'dark gray': '#374151',
                          'light grey': '#d1d5db', 'light gray': '#d1d5db', 'silver': '#c0c0c0', 'gold': '#d4af37',
                          'purple': '#9333ea', 'indigo': '#4f46e5', 'pink': '#ec4899', 'brown': '#8b4513',
                          'khaki': '#c3b091', 'beige': '#f5f5dc', 'cream': '#fffdd0', 'tan': '#d2b48c',
                          'orange': '#f97316', 'yellow': '#eab308', 'coral': '#ff7f50', 'mint': '#98ff98',
                          'peach': '#ffdab9', 'lavender': '#e6e6fa', 'turquoise': '#40e0d0', 'magenta': '#ff00ff',
                          'burgundy': '#900020', 'charcoal': '#36454f', 'camel': '#c19a6b', 'rust': '#b7410e'
                        };
                        const normalizedKey = c.toLowerCase().trim();
                        const bgHex = colorMap[normalizedKey] || normalizedKey;
                        // Determine if text should be light or dark
                        const darkColors = new Set(['black','navy','dark blue','dark red','maroon','wine','dark green','olive','teal','grey','gray','dark grey','dark gray','purple','indigo','brown','charcoal','burgundy','rust']);
                        const textClass = darkColors.has(normalizedKey) ? 'text-white' : 'text-gray-900';
                        return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormData({...formData, color: c})}
                          className={`group relative w-full rounded-xl border-2 transition-all duration-200 flex flex-col items-center overflow-hidden ${
                            formData.color === c ? 'border-white ring-2 ring-blue-500 scale-105 z-10' : 'border-gray-700/50 hover:border-gray-500'
                          }`}
                        >
                          <div className="w-full aspect-square flex items-center justify-center relative" style={{ backgroundColor: bgHex }}>
                            {formData.color === c && (
                              <div className={`${textClass} bg-black/20 backdrop-blur-sm p-1.5 rounded-full`}>
                                <CheckCircle2 size={16} className={textClass} />
                              </div>
                            )}
                          </div>
                          <div className="w-full py-1.5 px-1 theme-bg text-center">
                            <p className={`text-xs md:text-sm font-black theme-text-primary ${formData.color === c ? 'whitespace-normal break-words' : 'truncate'}`}>{c}</p>
                            {!isEditMode && <p className="text-[9px] font-bold theme-text-muted">{stockForColor} in stock</p>}
                          </div>
                        </button>
                      )})}
                    </div>
                  </>
                  )}
                  {/* Show message if product has no color variants */}
                  {formData.productType && colors.length === 0 && (
                    <div className="mt-6 theme-bg-subtle p-6 rounded-2xl border theme-border text-center">
                      <p className="theme-text-secondary text-sm font-bold">Colors: Available (Standard)</p>
                    </div>
                  )}

                  {/* Sleeve Length & Shirt Length */}
                  {formData.productType && (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="theme-bg-subtle p-4 md:p-5 rounded-2xl border theme-border">
                        <h3 className="text-sm font-black text-cyan-400 uppercase mb-3">Sleeve Length</h3>
                        <div className="flex gap-2">
                          {[
                            { value: 'full', label: 'Full' },
                            { value: 'three-quarter', label: '3 Quarter' },
                            { value: 'half', label: 'Half' }
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setFormData({...formData, sleeveLength: formData.sleeveLength === opt.value ? '' : opt.value})}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                formData.sleeveLength === opt.value
                                  ? 'bg-cyan-600 text-white shadow-lg'
                                  : 'bg-gray-800 text-gray-500 hover:text-white'
                              }`}
                            >{opt.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="theme-bg-subtle p-4 md:p-5 rounded-2xl border theme-border">
                        <h3 className="text-sm font-black text-indigo-400 uppercase mb-3">Shirt Length</h3>
                        <div className="flex gap-2">
                          {[
                            { value: 'long', label: 'Long' },
                            { value: 'short', label: 'Short' },
                            { value: 'regular', label: 'Regular' }
                          ].map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setFormData({...formData, shirtLength: formData.shirtLength === opt.value ? '' : opt.value})}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                formData.shirtLength === opt.value
                                  ? 'bg-indigo-600 text-white shadow-lg'
                                  : 'bg-gray-800 text-gray-500 hover:text-white'
                              }`}
                            >{opt.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Matching Cap */}
                  {formData.productType && !isAccessory(selectedProductCategory) && (
                    <div className="mt-6 theme-bg-subtle p-4 md:p-6 rounded-2xl border theme-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-black text-rose-400 uppercase">Matching Cap</h3>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, matchingCap: !formData.matchingCap, matchingCapQty: formData.matchingCap ? 0 : 1})}
                            className={`relative w-12 h-6 rounded-full transition-all ${formData.matchingCap ? 'bg-rose-600' : 'bg-gray-700'}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formData.matchingCap ? 'left-6' : 'left-0.5'}`} />
                          </button>
                        </div>
                        {formData.matchingCap && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-black">Qty:</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setFormData({...formData, matchingCapQty: Math.max(1, (formData.matchingCapQty || 1) - 1)})}
                                className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 font-black hover:bg-gray-700 transition-all">−</button>
                              <span className="w-8 text-center font-black text-white">{formData.matchingCapQty || 1}</span>
                              <button type="button" onClick={() => setFormData({...formData, matchingCapQty: (formData.matchingCapQty || 1) + 1})}
                                className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 font-black hover:bg-gray-700 transition-all">+</button>
                            </div>
                            <span className="text-xs text-rose-400 font-black">₨{(((formData.matchingCapQty || 0) * capUnitPrice)).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`mt-6 md:mt-10 pt-6 md:pt-10 border-t theme-border flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-xl font-black text-blue-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Hash size={16} />
                        <span>{useUrdu ? 'آرڈر کی تعداد' : 'Order Quantity'}</span>
                      </h3>
                      <p className="theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest">How many sets are needed?</p>
                    </div>
                    
                    <div className="relative group w-full sm:w-64">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 font-black text-lg group-focus-within:text-blue-500 transition-colors`}>🔢</div>
                      <input
                        type="number"
                        min="1"
                        onKeyDown={preventEnterSubmit}
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-5 ${useUrdu ? 'pr-20 pl-8 text-right' : 'pl-20 pr-8'} transition-all text-2xl font-black shadow-inner`}
                        placeholder="1"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'custom' && (formData.type === 'FULL_CUSTOM' || formData.type === 'READY_LOGO') && isCustomizableProduct(selectedProductCategory) && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10"
            >
              <div className={`glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border space-y-6 md:space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-purple-600 rounded-[1.5rem] shadow-xl shadow-purple-900/30">
                    <ImageIcon className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black theme-text-primary">{t('branding')}</h3>
                    <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">Engraving details</p>
                  </div>
                </div>

                <div className="space-y-4 md:space-y-8">
                  {/* Skip Engraving Toggle */}
                  <div className="flex items-center justify-between p-4 theme-bg rounded-2xl border border-gray-700">
                    <div>
                      <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em]">Engraving</label>
                      <p className="text-[10px] text-gray-500 font-bold mt-0.5">{formData.skipEngraving ? 'Engraving skipped for this item' : 'Add engraving details below'}</p>
                    </div>
                    <button type="button" onClick={() => setFormData({...formData, skipEngraving: !formData.skipEngraving})}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${formData.skipEngraving ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}
                    >
                      {formData.skipEngraving ? 'Skipped' : 'Active'}
                    </button>
                  </div>

                  {!formData.skipEngraving && (<>
                  {/* Engraving Type */}
                  <div className="space-y-3">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">Engraving Method</label>
                    <div className="flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border h-[72px]">
                      {[
                        { value: 'direct', label: 'Direct Engraving' },
                        { value: 'patch', label: 'Patch Engraving' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setFormData({...formData, engravingType: opt.value})}
                          className={`flex-1 rounded-xl text-xs md:text-sm font-black transition-all ${
                            formData.engravingType === opt.value
                              ? 'bg-purple-600 text-white shadow-xl'
                              : 'text-gray-600 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('articleName')}</label>
                      <button
                        type="button"
                        onClick={() => setArticleNameEntries([...articleNameEntries, ''])}
                        className="text-xs font-black text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition-all"
                      >
                        + Add
                      </button>
                    </div>
                    {articleNameEntries.map((entry, ei) => (
                      <div key={ei} className="relative group">
                        <div className="flex gap-2 items-center">
                          <Type className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={16} />
                          <input
                            type="text"
                            onKeyDown={preventEnterSubmit}
                            value={entry}
                            onChange={(e) => {
                              const next = [...articleNameEntries];
                              next[ei] = e.target.value;
                              setArticleNameEntries(next);
                            }}
                            className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-black text-xl`}
                            placeholder={useUrdu ? 'آرٹیکل کا نام درج کریں' : "DR. VALERIE KING"}
                          />
                          {articleNameEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setArticleNameEntries(articleNameEntries.filter((_, i) => i !== ei))}
                              className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('embroideryColor')}</label>
                      <select 
                        value={formData.nameColor}
                        onChange={(e) => setFormData({...formData, nameColor: e.target.value})}
                        className={`w-full theme-input rounded-2xl py-5 px-8 font-bold appearance-none ${useUrdu ? 'text-right' : ''}`}
                      >
                        <option value="">Standard White</option>
                        <option value="Gold">Metallic Gold</option>
                        <option value="Silver">Polished Silver</option>
                        <option value="Navy">Royal Navy</option>
                        <option value="Wine">Premium Wine</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('placement')}</label>
                      <select 
                        value={formData.logoPlacement}
                        onChange={(e) => setFormData({...formData, logoPlacement: e.target.value})}
                        className={`w-full theme-input rounded-2xl py-5 px-8 font-bold appearance-none ${useUrdu ? 'text-right' : ''}`}
                      >
                        <option value="">Left Chest</option>
                        <option value="RightChest">Right Chest</option>
                        <option value="Sleeve">Sleeve Cuff</option>
                        <option value="Back">Upper Back</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{useUrdu ? 'لوگو ڈیزائن' : 'Logo Design'}</label>
                      <button
                        type="button"
                        onClick={() => setLogoEntries([...logoEntries, { name: '', design: '' }])}
                        className="text-xs font-black text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition-all"
                      >
                        + Add
                      </button>
                    </div>
                    {logoEntries.map((entry, ei) => (
                      <div key={ei} className="relative group">
                        <div className="flex gap-2 items-start mb-2">
                          <input
                            type="text"
                            value={entry.name}
                            onChange={(e) => {
                              const next = [...logoEntries];
                              next[ei] = { ...next[ei], name: e.target.value };
                              setLogoEntries(next);
                            }}
                            placeholder={useUrdu ? 'لوگو کا نام/لیبل' : 'Logo name/label'}
                            className={`flex-1 theme-input rounded-2xl py-3 px-4 text-sm font-bold ${useUrdu ? 'text-right' : ''}`}
                          />
                          {logoEntries.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLogoEntries(logoEntries.filter((_, i) => i !== ei))}
                              className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <ImageIcon className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-[3.25rem] text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={16} />
                        <textarea
                          rows="3"
                          value={entry.design}
                          onChange={(e) => {
                            const next = [...logoEntries];
                            next[ei] = { ...next[ei], design: e.target.value };
                            setLogoEntries(next);
                          }}
                          className={`w-full theme-input rounded-[1.5rem] py-5 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-medium text-sm resize-none`}
                          placeholder={useUrdu ? 'لوگو کی تفصیلات، فائل ریفرنس، یا اپ لوڈ ہدایات...' : "Describe logo, file reference, or upload instructions..."}
                        />
                      </div>
                    ))}
                  </div>
                </>)}
              </div>
              </div>

              <div className={`glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border space-y-6 md:space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-900/30">
                    <Scissors className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black theme-text-primary">{t('stitching')}</h3>
                    <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">Conveyor belt tailoring specs</p>
                  </div>
                </div>

                <div className="space-y-4 md:space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{useUrdu ? 'ڈیزائن ریفرنس' : 'Design Reference'}</label>
                    <div className="relative group">
                      <Palette className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-6 text-gray-600 group-focus-within:text-blue-500 transition-colors`} size={16} />
                      <textarea
                        rows="4"
                        value={formData.designReference}
                        onChange={(e) => setFormData({...formData, designReference: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-bold text-lg`}
                        placeholder={useUrdu ? 'مثال: شرٹ کا ڈیزائن پینٹ پر لگائیں، یا کسی دوسرے کپڑے کا حوالہ دیں' : "Example: Match shirt design on trousers, or reference another order's pattern..."}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{t('stitchingStyle')}</label>
                      <div className={`flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border h-[72px] ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {['STD', 'DBL'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({...formData, stitchingStyle: s})}
                            className={`flex-1 rounded-xl text-xs md:text-sm font-black transition-all ${formData.stitchingStyle === s ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}
                          >
                            {s === 'STD' ? (useUrdu ? 'سنگل' : 'SINGLE') : (useUrdu ? 'ڈبل' : 'DOUBLE')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{t('fitProfile')}</label>
                      <div className={`flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border h-[72px] ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {['Slim', 'Regular'].map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFormData({...formData, fitType: f})}
                            className={`flex-1 rounded-xl text-xs md:text-sm font-black transition-all ${formData.fitType === f ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}
                          >
                            {f.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{t('notes')}</label>
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({...formData, designNotes: e.target.value})}
                      className={`w-full theme-input rounded-[2rem] py-6 px-8 h-36 resize-none text-sm font-medium ${useUrdu ? 'text-right' : ''}`}
                      placeholder={useUrdu ? 'خصوصی ہدایات یہاں درج کریں...' : "Add special requests for the production floor..."}
                    />
                  </div>
                </div>
              </div>

              {/* Optional Branding Charges Input */}
              <div className="lg:col-span-2 glass p-4 md:p-6 rounded-[2rem] border border-amber-500/20 bg-amber-500/5">
                <h4 className="text-xs md:text-sm font-black text-amber-400 uppercase tracking-[0.2em] mb-4">{useUrdu ? 'اختیاری برانڈنگ چارجز' : 'Optional Branding Charges'}</h4>
                <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider mb-4">{useUrdu ? 'اگر لاگو ہو تو چارجز درج کریں، ورنہ خالی چھوڑ دیں' : 'Enter charges if applicable, leave blank if none'}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'لوگو چارج' : 'Logo Charge (₨)'}</label>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={preventEnterSubmit}
                      value={formData.logoCharges}
                      onChange={(e) => setFormData({...formData, logoCharges: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'نام پرنٹنگ چارج' : 'Name Printing Charge (₨)'}</label>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={preventEnterSubmit}
                      value={formData.namePrintingCharges}
                      onChange={(e) => setFormData({...formData, namePrintingCharges: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'کسٹمائزیشن چارج' : 'Customization Charge (₨)'}</label>
                    <input
                      type="number"
                      min="0"
                      onKeyDown={preventEnterSubmit}
                      value={formData.customizationPrice}
                      onChange={(e) => setFormData({...formData, customizationPrice: e.target.value})}
                      className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="border-t border-amber-500/10 pt-3 mt-4 flex justify-between items-center">
                  <span className="text-xs md:text-sm font-bold text-gray-400">{useUrdu ? 'برانڈنگ چارجز کل' : 'Total Branding Charges'}</span>
                  <span className="font-black text-white">₨{(
                    (parseFloat(formData.logoCharges) || 0) +
                    (parseFloat(formData.namePrintingCharges) || 0) +
                    (parseFloat(formData.customizationPrice) || 0)
                  ).toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sizes' && (
            <motion.div
              key="sizes"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="glass p-6 md:p-16 rounded-2xl md:rounded-[4rem] border theme-border shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 opacity-5 select-none pointer-events-none">
                <Ruler size={500} />
              </div>
              
              <div className="relative z-10 space-y-8 md:space-y-16">
                <div className="space-y-2 text-center mb-8 md:mb-16">
                  <h3 className="text-2xl md:text-4xl font-black text-emerald-400 flex justify-center items-center space-x-6 uppercase tracking-tighter">
                    <Ruler size={42} />
                    <span>{formData.type === 'FULL_CUSTOM' ? 'Anatomical Precision Chart' : 'Standard Size Selection'}</span>
                  </h3>
                  <p className="theme-text-muted font-bold uppercase tracking-[0.4em]">All measurements in standard inches</p>
                </div>

                {/* Size Selection Buttons - Always Visible */}
                <div className="flex flex-col items-center space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Gender</label>
                      <p className="text-lg font-black text-emerald-400">{formData.gender}</p>
                    </div>
                    {formData.size && (
                      <div className="text-center">
                        <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Size</label>
                        <p className="text-lg font-black text-emerald-400">{formData.size}</p>
                      </div>
                    )}
                  </div>
                  <div className={`flex p-1.5 theme-bg rounded-xl border-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    {(availableSizes.length > 0 ? availableSizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL']).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSizeSelect(s)}
                        className={`w-14 h-14 rounded-lg font-black text-xs transition-all ${
                          formData.size === s 
                            ? 'bg-emerald-600 text-white shadow-lg' 
                            : 'text-gray-600 hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Measurement Fields - Only for FULL_CUSTOM + SCRUBS */}
                {false && (
                  <>
                <div className="relative flex flex-col md:flex-row items-center justify-center max-w-6xl mx-auto gap-4 lg:gap-12">
                  
                  {/* Left Measurements */}
                  <div className="flex flex-row flex-wrap justify-center md:flex-col space-y-0 md:space-y-16 gap-4 md:gap-0 w-full md:w-1/3 z-20 items-center md:items-end">
                    <div className="group relative flex flex-col items-center md:items-end w-full max-w-[220px] md:max-w-none">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shoulder</label>
                      <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shoulder || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, shoulder: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].shoulder : '00'} />
                        <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Chest / Bust</label>
                      <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.chest || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, chest: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].chest : '00'} />
                        <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    {formData.gender === 'Female' ? (
                      <div className="group relative flex flex-col items-center md:items-end">
                        <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Waist</label>
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.waist || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, waist: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].waist : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    ) : (
                      <div className="group relative flex flex-col items-center md:items-end">
                        <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Bottom Width</label>
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.bottom || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, bottom: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].bottom : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Center Silhouette */}
                  <div className="hidden md:flex relative w-1/3 justify-center items-center min-h-[500px]">
                    <img 
                      src={formData.gender === 'Female' ? silhouetteFemale : silhouetteMale} 
                      alt="Tailor Silhouette" 
                      className="h-[550px] object-contain opacity-60 filter drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]" 
                      loading="lazy"
                    />
                    
                    <div className="absolute top-[20%] left-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[35%] left-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[50%] left-[-5%] w-[55%] border-t border-dashed border-emerald-500/40"></div>

                    <div className="absolute top-[45%] right-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[60%] right-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[80%] right-[15%] w-[35%] border-t border-dashed border-emerald-500/40"></div>
                  </div>

                  {/* Right Measurements */}
                  <div className="flex flex-col space-y-8 md:space-y-16 w-full md:w-1/3 z-20 items-center md:items-start">
                    {formData.gender === 'Female' ? (
                      <div className="group relative flex flex-col items-center md:items-start">
                        <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Bottom</label>
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.bottom || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, bottom: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].bottom : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shirt Length</label>
                      <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shirtLength || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, shirtLength: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].shirtLength : '00'} />
                        <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    {formData.gender === 'Female' ? (
                      <div className="group relative flex flex-col items-center md:items-start">
                        <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Hip</label>
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hip || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hip: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hip : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    ) : (
                      <div className="group relative flex flex-col items-center md:items-start">
                        <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Sleeves Length</label>
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.sleeve || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, sleeve: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].sleeve : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    )}
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Trouser Length</label>
                      <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.trouserLength || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, trouserLength: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].trouserLength : '00'} />
                        <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Sleeves (female), Trouser Bottom */}
                {formData.gender === 'Female' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto mt-4">
                    <div className="flex flex-col items-center space-y-4">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Sleeves Length</label>
                      <div className="group relative flex flex-col items-center">
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.sleeve || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, sleeve: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].sleeve : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center space-y-4">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Length</label>
                      <div className="group relative flex flex-col items-center">
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.trouserLength || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, trouserLength: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].trouserLength : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center space-y-4">
                      <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Bottom</label>
                      <div className="group relative flex flex-col items-center">
                        <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                          <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hips: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hips : '00'} />
                          <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4 pt-4">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Bottom</label>
                    <div className="group relative flex flex-col items-center">
                      <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips || ''} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hips: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center" placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hips : '00'} />
                        <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.gender === 'Female' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mt-6 md:mt-12 theme-bg-subtle p-4 md:p-8 rounded-2xl md:rounded-[3rem] border theme-border">
                    <div className="space-y-4">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Include Dupatta</label>
                      <label className="flex items-center justify-between p-4 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl transition-all ${formData.femaleOptions.dupatta ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <Layers size={18} />
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase">Dupatta</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.dupatta} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, dupatta: e.target.checked}})} className="w-5 h-5 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Include Zip</label>
                      <label className="flex items-center justify-between p-4 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl transition-all flex items-center justify-center ${formData.femaleOptions.zip ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <span className="font-black text-sm">ZIP</span>
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase">Zip</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.zip} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, zip: e.target.checked}})} className="w-5 h-5 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Sleeves Length</label>
                      <select
                        value={formData.femaleOptions.sleeves}
                        onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, sleeves: e.target.value}})}
                        className="w-full theme-input rounded-[1.5rem] py-5 px-6 font-bold appearance-none h-full"
                      >
                        <option value="half">Half Sleeves</option>
                        <option value="medium">Medium Sleeves</option>
                        <option value="full">Full Sleeves</option>
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Shirt Length</label>
                      <select
                        value={formData.femaleOptions.shirtLength}
                        onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, shirtLength: e.target.value}})}
                        className="w-full theme-input rounded-[1.5rem] py-5 px-6 font-bold appearance-none h-full"
                      >
                        <option value="short">Short Shirt</option>
                        <option value="long">Long Shirt</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="mt-8 md:mt-16 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-2xl md:rounded-[3rem] p-6 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 shadow-inner">
                  <div className="p-6 bg-emerald-600 rounded-[2rem] shadow-2xl shadow-emerald-900/50 rotate-6">
                    <CheckCircle2 size={28} className="text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black text-emerald-400 tracking-tight uppercase">Tailor-Ready Verification</p>
                    <p className="text-sm theme-text-muted font-bold leading-relaxed max-w-3xl">
                      Values are mapped to the "CUTTING" stage automated patterns. Double-check for 0.5" variance before deployment.
                    </p>
                  </div>
                </div>
                </>
                )}

                {/* Special Note - always visible */}
                <div className="col-span-full mt-6 p-4 md:p-6 theme-bg rounded-2xl border border-emerald-500/20">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-3">Measurement Special Notes</label>
                  <textarea
                    value={formData.measurements.specialNote || ''}
                    onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, specialNote: e.target.value}})}
                    className="w-full theme-input rounded-2xl p-4 text-sm font-bold border-2 border-gray-700 focus:border-emerald-500/50 transition-all resize-none"
                    rows={3}
                    placeholder="Any special instructions or remarks for the tailor..."
                  />
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        )}

        {!(isEditMode && originalOrder && !showProductSelector) && (
          <div className={`flex flex-col sm:flex-row items-center justify-between pt-6 md:pt-12 gap-4 md:gap-8 border-t-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="flex flex-col space-y-4">
              <div className={`flex items-center space-x-3 text-gray-600 theme-bg-subtle px-6 py-3 rounded-2xl border theme-border ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
                <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em]">{useUrdu ? 'تصدیق شدہ نظام' : 'Validated System Protocol'}</span>
              </div>
              {error && (
                <div className={`flex items-center space-x-3 text-red-500 bg-red-500/10 px-6 py-3 rounded-2xl border border-red-500/20 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold">{error}</span>
                </div>
              )}
            </div>
            
            <div className={`flex space-x-6 w-full sm:w-auto ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {showProductSelector && (
                <button
                  type="button"
                  onClick={() => setShowProductSelector(false)}
                  className="flex-1 sm:px-12 py-6 theme-bg theme-text-primary rounded-[1.5rem] font-black text-sm border-2 theme-border hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl"
                >
                  {useUrdu ? 'ترمیم پر واپس جائیں' : 'BACK TO EDIT'}
                </button>
              )}
              {activeTab !== 'basic' && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                    setActiveTab(filteredTabs[currentIdx - 1].id);
                  }}
                  className="flex-1 sm:px-12 py-6 theme-bg theme-text-primary rounded-[1.5rem] font-black text-sm border-2 theme-border hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl"
                >
                  {t('back').toUpperCase()}
                </button>
              )}

              {/* NEXT button - for intermediate tabs */}
              {activeTab !== filteredTabs[filteredTabs.length - 1].id && (
                <button
                  type="button"
                  onClick={() => {
                    const errMsg = validateCurrentTab();
                    if (errMsg) {
                      setError(errMsg);
                      return;
                    }
                    const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                    setActiveTab(filteredTabs[currentIdx + 1].id);
                  }}
                  className="flex-1 sm:px-16 py-6 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group"
                >
                  <span className={useUrdu ? "order-2" : "order-1"}>{t('next').toUpperCase()}</span>
                  <ArrowRight size={22} className={`transition-transform ${useUrdu ? 'order-1 rotate-180 group-hover:-translate-x-2' : 'order-2 group-hover:translate-x-2'}`} />
                </button>
              )}

              {/* Add to Cart / Add to Request button - only on the last tab */}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 theme-bg text-blue-400 border-2 border-blue-500/50 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50"
                >
                  {loading || isSubmitting ? (useUrdu ? 'انتظار کریں...' : 'PROCESSING...') : (
                    <>
                      {isEditMode ? <Plus size={16} className={useUrdu ? "order-2" : "order-1"} /> : <ShoppingCart size={16} className={useUrdu ? "order-2" : "order-1"} />}
                      <span className={useUrdu ? "order-1" : "order-2"}>{isEditMode ? (useUrdu ? 'درخواست میں شامل کریں' : 'ADD TO REQUEST') : (useUrdu ? 'کارٹ میں شامل کریں' : 'ADD ITEM TO CART')}</span>
                    </>
                  )}
                </button>
              )}

              {/* CHECKOUT button - only on the last tab when cart has items (not in edit mode) */}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && cartItems.length > 0 && !isEditMode && (
                <button
                  type="button"
                  onClick={() => setShowReview(true)}
                  disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{useUrdu ? 'آرڈر چیک آؤٹ کریں' : 'CHECKOUT'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      {/* "Add More Products?" Modal */}
      <AnimatePresence>
        {showAddMore && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-md w-full p-10 rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] text-center"
            >
              <div className="bg-emerald-500/10 p-6 rounded-[2rem] inline-block mb-6">
                <CheckCircle2 size={48} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight mb-2">
                {isEditMode ? (useUrdu ? 'پروڈکٹ شامل ہو گئی!' : 'Product Added!') : (useUrdu ? 'پروڈکٹ کارٹ میں شامل ہو گئی!' : 'Added to Cart!')}
              </h2>
              <p className="theme-text-muted text-xs font-bold uppercase tracking-widest mb-8">
                {isEditMode ? `${cartItems.length} ${cartItems.length === 1 ? 'product' : 'products'} in request` : `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'} in cart`}
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={handleAddMoreProducts}
                  className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Plus size={16} />
                  <span>{useUrdu ? 'دوسری پروڈکٹ شامل کریں' : 'ADD ANOTHER PRODUCT'}</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowAddMore(false);
                    if (isEditMode) {
                      setShowProductSelector(false);
                    } else {
                      setShowReview(true);
                    }
                  }}
                  className={`w-full py-5 bg-gradient-to-r ${isEditMode ? 'from-amber-600 to-orange-600' : 'from-emerald-600 to-blue-600'} text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3`}
                >
                  {isEditMode ? <ArrowLeft size={16} /> : <CheckCircle2 size={16} />}
                  <span>{isEditMode ? (useUrdu ? 'ترمیم پر واپس جائیں' : 'BACK TO EDIT') : (useUrdu ? 'آرڈر چیک آؤٹ کریں' : 'CHECKOUT')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customization Modal */}
      <AnimatePresence>
        
      </AnimatePresence>

      {/* Floating Cart Panel & FAB (hidden in edit mode) */}
      {!isEditMode && (<>
      <AnimatePresence>
        {cartItems.length > 0 && !isCartOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-blue-600 text-white p-4 rounded-full shadow-[0_10px_30px_rgba(37,99,235,0.4)] z-50 flex items-center justify-center border-2 border-blue-400/30 backdrop-blur-md"
          >
            <div className="relative">
              <ShoppingCart size={28} />
              <span className="absolute -top-3 -right-3 bg-pink-500 text-white text-xs md:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg">
                {cartItems.length}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartItems.length > 0 && isCartOpen && (
          <motion.div
            initial={{ y: 150, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 150, opacity: 0, scale: 0.9 }}
            className="fixed bottom-4 right-4 left-4 md:left-auto md:bottom-8 md:right-8 theme-bg backdrop-blur-3xl border-2 theme-border p-6 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-50 md:w-[400px]"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-500/20 p-2.5 rounded-2xl">
                  <ShoppingCart className="text-blue-500" size={16} />
                </div>
                <h3 className="text-xl font-black theme-text-primary tracking-tight">Your Cart</h3>
                <span className="bg-gray-800 text-gray-300 text-xs md:text-sm font-black px-3 py-1.5 rounded-full ml-2">
                  {cartItems.length} Items
                </span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="theme-text-muted hover:text-white hover:bg-gray-800 p-2 rounded-full transition-all active:scale-95"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scrollbar mb-6">
              {cartItems.map((item, idx) => (
                <div key={idx} className="theme-bg-subtle p-4 rounded-2xl flex justify-between items-center border theme-border hover:border-gray-700 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-black theme-text-primary truncate">{item.productDetails?.productType || 'Custom Item'}</p>
                    <p className="text-xs md:text-sm theme-text-muted font-bold uppercase mt-1 truncate">
                      {item.quantity}x • {item.productDetails?.size || 'Custom'} • {item.productDetails?.color}
                    </p>
                    {(item.logoName || item.logoCharges || item.namePrintingCharges || item.customizationPrice) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.logoName && <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Logo: {item.logoName}</span>}
                        {item.logoCharges > 0 && <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Logo Fee: ₨{item.logoCharges}</span>}
                        {item.namePrintingCharges > 0 && <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">Name: ₨{item.namePrintingCharges}</span>}
                        {item.customizationPrice > 0 && <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">Custom: ₨{item.customizationPrice}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {item.quantity > 1 && item.totalPrice > 0 && (
                      <p className="text-xs theme-text-muted font-bold">
                        ₨{Number(item.totalPrice / item.quantity).toLocaleString()} × {item.quantity}
                      </p>
                    )}
                    <p className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                      ₨{Number(item.totalPrice).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setIsCartOpen(false);
                handleCheckout();
              }}
              disabled={loading || isSubmitting}
              className="w-full py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/40 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>Checkout Order</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </>)}
      
      {success && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-32 md:bottom-12 inset-x-6 sm:left-auto sm:right-12 max-w-md bg-emerald-600 text-white p-8 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex items-center space-x-6 z-50 border-2 border-emerald-400/20 backdrop-blur-3xl ${useUrdu ? 'flex-row-reverse space-x-reverse text-right' : ''}`}
        >
          <div className="bg-white/20 p-5 rounded-[1.5rem] shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <p className="font-black text-2xl tracking-tighter leading-none uppercase">{useUrdu ? 'آرڈر درج ہوگیا!' : 'Order Placed!'}</p>
            <p className="text-xs md:text-sm font-black text-white/80 mt-2 uppercase tracking-[0.2em]">{useUrdu ? 'پیداواری لائن میں شامل کر دیا گیا' : 'Synced with Production Floor'}</p>
          </div>
        </motion.div>
      )}

      {/* Order Review Modal */}
      <AnimatePresence>
        {showReview && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-3xl w-full p-6 md:p-10 rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] shadow-xl">
                  <List className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">
                    {useUrdu ? 'آرڈر کا جائزہ' : 'Order Review & Summary'}
                  </h2>
                  <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">
                    {useUrdu ? 'جمع کرانے سے پہلے تصدیق کریں' : 'Please verify before submitting'}
                  </p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-950/50 p-4 md:p-6 rounded-[2rem] border border-gray-800/50 mb-4">
                <h3 className="text-xs md:text-sm font-black text-blue-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <User size={12} /> {useUrdu ? 'گاہک کی معلومات' : 'Customer Information'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{useUrdu ? 'نام' : 'Name'}</span>
                    <p className="font-bold text-white">{cartItems[0]?.customerName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{useUrdu ? 'فون' : 'Phone'}</span>
                    <p className="font-bold text-white">{cartItems[0]?.customerPhone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{useUrdu ? 'پتہ' : 'Address'}</span>
                    <p className="font-bold text-white">{cartItems[0]?.address || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">{useUrdu ? 'شہر' : 'City'}</span>
                    <p className="font-bold text-white">{cartItems[0]?.city || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-gray-950/50 p-4 md:p-6 rounded-[2rem] border border-gray-800/50 mb-4">
                <h3 className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Package size={12} /> {useUrdu ? 'آرڈر کی تفصیلات' : 'Order Details'}
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.orderNumber && <span className="text-xs font-black px-2 py-1 bg-blue-900/30 text-blue-400 rounded-md uppercase">#{formData.orderNumber}</span>}
                  <span className="text-xs font-black px-2 py-1 bg-gray-900 rounded-md text-gray-300 uppercase">{cartItems[0]?.type}</span>
                  <span className="text-xs font-black px-2 py-1 bg-gray-900 rounded-md text-gray-300 uppercase">{cartItems[0]?.priority}</span>
                  {parseFloat(cartItems[0]?.advanceAmount) > 0 && <span className="text-xs font-black px-2 py-1 bg-amber-900/30 rounded-md text-amber-400 uppercase">ADVANCE: ₨{parseFloat(cartItems[0]?.advanceAmount).toLocaleString()}</span>}
                </div>
              </div>

              {/* Products Table with Per-Item Customization & Inline Edit */}
              <div className="bg-gray-950/50 p-4 md:p-6 rounded-[2rem] border border-gray-800/50 mb-4">
                <h3 className="text-xs md:text-sm font-black text-purple-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <ShoppingCart size={12} /> {useUrdu ? 'پروڈکٹس' : 'Products'} ({cartItems.length})
                </h3>
                <div className="space-y-3">
                  {cartItems.map((item, idx) => {
                    const pd = item.productDetails || {};
                    const cust = item.customization || {};
                    const hasCust = cust.nameSpelling || cust.stitchingStyle || cust.fitType || cust.designNotes || item.logoName || item.logoDesign || cust.logos || cust.engravingType;
                    const hasMeas = Object.values(item.sizeData || {}).some(v => v);
                    const isCustom = item.type === 'FULL_CUSTOM';
                    return (
                      <div key={idx} className="bg-gray-900/50 rounded-xl border border-gray-800/70 p-3 md:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-gray-500">#{idx + 1}</span>
                              <span className="text-sm font-black text-white uppercase truncate">{pd.productType || '—'}</span>
                              {pd.gender && <span className="text-[9px] font-black text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{pd.gender}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              <span className="text-xs text-gray-300 uppercase font-bold">{pd.color || '—'} / {pd.size || '—'}</span>
                              {pd.fabricType && <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{pd.fabricType}</span>}
                              {pd.sleeveLength && <span className="text-xs font-black text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded">{pd.sleeveLength === 'full' ? 'Full Sleeve' : pd.sleeveLength === 'half' ? 'Half Sleeve' : pd.sleeveLength === 'three-quarter' ? '3 Quarter Sleeve' : 'Quarter Sleeve'}</span>}
                              {pd.shirtLength && <span className="text-xs font-black text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded">{pd.shirtLength === 'long' ? 'Full Length' : 'Short Length'}</span>}
                              {item.capCharges > 0 && <span className="text-xs font-black text-rose-400">×{pd.matchingCapQty || 0} Matching Cap</span>}
                              <span className="text-xs md:text-sm font-black text-blue-400">×{item.quantity || 1}</span>
                            </div>
                            {/* Custom Requirements */}
                            {(pd.fabricSourceProduct || pd.colorSourceProduct || pd.designSourceProduct || pd.sizeSourceProduct || pd.additionalProductRef) && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {pd.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Fabric: {pd.fabricSourceProduct}</span>}
                                {pd.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Color: {pd.colorSourceProduct}</span>}
                                {pd.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Design: {pd.designSourceProduct}</span>}
                                {pd.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Size: {pd.sizeSourceProduct}</span>}
                                {pd.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Extra: {pd.additionalProductRef}</span>}
                              </div>
                            )}
                            {/* Branding Charges */}
                            {(item.logoCharges > 0 || item.namePrintingCharges > 0 || item.customizationPrice > 0) && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {item.logoCharges > 0 && <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Logo Fee: ₨{item.logoCharges}</span>}
                                {item.namePrintingCharges > 0 && <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Name Fee: ₨{item.namePrintingCharges}</span>}
                                {item.customizationPrice > 0 && <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">Custom Fee: ₨{item.customizationPrice}</span>}
                              </div>
                            )}
                            {hasCust && (
                              <div className="mt-2 space-y-2">
                                {/* Article Names / Name Lines */}
                                {(cust.articleNames?.length > 0 || cust.nameSpelling) && (
                                  <div className="bg-purple-500/5 rounded-lg p-2 border border-purple-500/10">
                                    <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-1">Name Lines</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {cust.articleNames?.length > 0 ? (
                                        cust.articleNames.map((an, ai) => (
                                          <span key={ai} className="text-xs font-black text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/20">
                                            {cust.nameSpelling?.includes(',') ? `Line ${ai + 1}: ${an}` : an}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-xs font-black text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded border border-purple-500/20">{cust.nameSpelling}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Branding Specs */}
                                {(cust.stitchingStyle || cust.fitType || cust.nameColor || cust.logoColor || cust.logoPlacement || cust.engravingType) && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {cust.engravingType && <span className="text-[10px] font-black text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded border border-violet-500/20">{cust.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                                    {cust.stitchingStyle && <span className="text-[10px] font-black text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-500/20">{cust.stitchingStyle === 'DBL' ? 'Double Stitch' : 'Single Stitch'}</span>}
                                    {cust.fitType && <span className="text-[10px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20">{cust.fitType} Fit</span>}
                                    {cust.nameColor && <span className="text-[10px] font-black text-rose-400 bg-rose-900/30 px-2 py-0.5 rounded border border-rose-500/20">Color: {cust.nameColor}</span>}
                                    {cust.logoColor && <span className="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Logo: {cust.logoColor}</span>}
                                    {cust.logoPlacement && <span className="text-[10px] font-black text-teal-400 bg-teal-900/30 px-2 py-0.5 rounded border border-teal-500/20">Position: {cust.logoPlacement}</span>}
                                    {item.logoName && <span className="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Logo: {item.logoName}</span>}
                                  </div>
                                )}
                                {/* Logos */}
                                {cust.logos?.length > 0 && (
                                  <div className="bg-amber-500/5 rounded-lg p-2 border border-amber-500/10">
                                    <p className="text-[9px] text-amber-400 font-black uppercase tracking-widest mb-1">Logos</p>
                                    {cust.logos.map((l, li) => (
                                      <div key={li} className="text-xs font-black text-amber-300 bg-amber-900/20 px-2 py-0.5 rounded border border-amber-500/20 mb-0.5 last:mb-0">
                                        {l.name || `Logo ${li + 1}`}{l.design ? ` — ${l.design}` : ''}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Special Instructions */}
                                {cust.designNotes && (
                                  <div className="bg-yellow-500/5 rounded-lg p-2 border border-yellow-500/10">
                                    <p className="text-[9px] text-yellow-400 font-black uppercase tracking-widest mb-0.5">Special Note</p>
                                    <p className="text-xs font-bold text-yellow-300/90 italic leading-tight">{cust.designNotes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            {hasMeas && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {Object.entries(item.sizeData || {}).filter(([k, v]) => v && k !== 'specialNote').map(([key, val]) => (
                                  <span key={key} className="text-[9px] font-black text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded">{key}: {val}"</span>
                                ))}
                              </div>
                            )}
                            {item.sizeData?.specialNote && (
                              <div className="mt-2 bg-yellow-500/5 rounded-lg p-2 border border-yellow-500/10">
                                <p className="text-[9px] text-yellow-400 font-black uppercase tracking-widest mb-0.5">Special Note</p>
                                <p className="text-xs font-bold text-yellow-300/90 italic leading-tight">{item.sizeData.specialNote}</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            <span className="text-sm font-black text-emerald-400">₨{Number(item.totalPrice || 0).toLocaleString()}</span>
                            <div className="flex flex-wrap gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => editCartItem(idx, 'product')}
                                className="text-[9px] font-black text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-md hover:bg-blue-700 transition-colors"
                              >
                                {useUrdu ? 'پروڈکٹ' : 'Product'}
                              </button>
                              <button
                                type="button"
                                onClick={() => editCartItem(idx, 'custom')}
                                className="text-[9px] font-black text-purple-400 bg-purple-900/40 px-2 py-0.5 rounded-md hover:bg-purple-700 transition-colors"
                              >
                                {useUrdu ? 'کسٹم' : 'Custom'}
                              </button>
                              {isCustom && (
                                <button
                                  type="button"
                                  onClick={() => editCartItem(idx, 'sizes')}
                                  className="text-[9px] font-black text-cyan-400 bg-cyan-900/40 px-2 py-0.5 rounded-md hover:bg-cyan-700 transition-colors"
                                >
                                  {useUrdu ? 'سائز' : 'Size'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeCartItem(idx)}
                                className="text-[9px] font-black text-red-400 bg-red-900/40 px-2 py-0.5 rounded-md hover:bg-red-700 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {cartItems.length > 0 && (
                  <div className="flex justify-end items-center gap-4 mt-3 pt-3 border-t border-gray-800/50">
                    <span className="text-xs md:text-sm text-gray-400 font-black uppercase tracking-wider">{useUrdu ? 'کل آئٹمز' : 'Total Items'}: <span className="text-white">{memoCartTotalItems}</span></span>
                    <span className="text-sm font-black text-emerald-400">{useUrdu ? 'کل قیمت' : 'Total'}: ₨{(memoCartTotalPrice + (memoCartTotalPrice > 7000 ? 0 : 250)).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Customization & Measurements now shown per-item in the products table above */}

              {/* Financial Summary - hidden for FULL_CUSTOM orders */}
              {formData.type !== 'FULL_CUSTOM' && (
              <div className="bg-gray-950/50 p-4 md:p-6 rounded-[2rem] border border-gray-800/50 mb-6">
                <h3 className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  ₨ {useUrdu ? 'مالیاتی خلاصہ' : 'Financial Summary'} <span className="text-[8px] text-gray-500 tracking-[0.3em]">CALCULATED / ADJUSTED</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800/50">
                        <th className="text-left text-gray-500 font-black uppercase tracking-wider py-1.5 pr-2">{useUrdu ? 'آئٹم' : 'Item'}</th>
                        <th className="text-right text-gray-500 font-black uppercase tracking-wider py-1.5 px-2 w-20">{useUrdu ? 'کیلکولیٹڈ' : 'Calculated'}</th>
                        <th className="text-right text-gray-500 font-black uppercase tracking-wider py-1.5 pl-2 w-20">{useUrdu ? 'ایڈجسٹڈ' : 'Adjusted'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const calcProductPrice = memoCartProductPriceExBranding;
                        const calcLogo = memoCartTotalLogoCharges;
                        const calcName = memoCartTotalNamePrinting;
                        const calcCustomization = memoCartTotalCustomization;
                        const calcCap = memoCartTotalCap;
                        const orderTotalBeforeDelivery = calcProductPrice + calcLogo + calcName + calcCustomization + calcCap;
                        const calcDelivery = orderTotalBeforeDelivery > 7000 ? 0 : 250;
                        const adjProductPrice = parseFloat(formData.adjProductPrice) || calcProductPrice;
                        const adjLogoCharges = parseFloat(formData.adjLogoCharges) || calcLogo;
                        const adjNamePrinting = parseFloat(formData.adjNamePrinting) || calcName;
                        const adjCustomization = parseFloat(formData.adjCustomization) || calcCustomization;
                        const adjCap = parseFloat(formData.adjCapCharges) || calcCap;
                        const adjDelivery = calcDelivery;
                        const discount = parseFloat(formData.adjDiscount) || 0;
                        const advanceAmt = parseFloat(formData.advanceAmount) || 0;
                        const calcTotal = calcProductPrice + calcLogo + calcName + calcCustomization + calcCap + calcDelivery;
                        const adjTotal = adjProductPrice + adjLogoCharges + adjNamePrinting + adjCustomization + adjCap + adjDelivery - discount;
                        const remainingBalance = adjTotal - advanceAmt;
                        const inp = (name, calcVal, color = 'emerald-400') => (
                          <input type="number" min="0" value={formData[name] ?? ''} placeholder={String(calcVal)}
                            onChange={e => setFormData({...formData, [name]: e.target.value})}
                            className={`w-full text-right bg-gray-900 border border-gray-700/50 rounded-lg py-1 px-2 text-xs font-black text-${color} focus:border-${color} outline-none transition-all`} />
                        );
                        return (
                          <>
                            <tr className="border-b border-gray-800/30">
                              <td className="text-gray-300 font-bold py-1.5 pr-2">{useUrdu ? 'پروڈکٹ کی قیمت' : 'Product Price'}</td>
                              <td className="text-right text-gray-300 font-black py-1.5 px-2">₨{calcProductPrice.toLocaleString()}</td>
                              <td className="text-right py-1.5 pl-2">{inp('adjProductPrice', calcProductPrice)}</td>
                            </tr>
                            {(calcLogo > 0) && (
                              <tr className="border-b border-gray-800/30">
                                <td className="text-amber-400 font-bold py-1.5 pr-2">{useUrdu ? 'لوگو چارجز' : 'Logo Charges'}</td>
                                <td className="text-right text-amber-400 font-black py-1.5 px-2">₨{calcLogo.toLocaleString()}</td>
                                <td className="text-right py-1.5 pl-2">{inp('adjLogoCharges', calcLogo, 'amber-400')}</td>
                              </tr>
                            )}
                            {(calcName > 0) && (
                              <tr className="border-b border-gray-800/30">
                                <td className="text-purple-400 font-bold py-1.5 pr-2">{useUrdu ? 'نام پرنٹنگ' : 'Name Printing'}</td>
                                <td className="text-right text-purple-400 font-black py-1.5 px-2">₨{calcName.toLocaleString()}</td>
                                <td className="text-right py-1.5 pl-2">{inp('adjNamePrinting', calcName, 'purple-400')}</td>
                              </tr>
                            )}
                            {(calcCustomization > 0) && (
                              <tr className="border-b border-gray-800/30">
                                <td className="text-cyan-400 font-bold py-1.5 pr-2">{useUrdu ? 'کسٹمائزیشن چارجز' : 'Customization Charges'}</td>
                                <td className="text-right text-cyan-400 font-black py-1.5 px-2">₨{calcCustomization.toLocaleString()}</td>
                                <td className="text-right py-1.5 pl-2">{inp('adjCustomization', calcCustomization, 'cyan-400')}</td>
                              </tr>
                            )}
                            {(calcCap > 0) && (
                              <tr className="border-b border-gray-800/30">
                                <td className="text-rose-400 font-bold py-1.5 pr-2">{useUrdu ? 'میچنگ کیپ چارجز' : 'Matching Cap Charges'}</td>
                                <td className="text-right text-rose-400 font-black py-1.5 px-2">₨{calcCap.toLocaleString()}</td>
                                <td className="text-right py-1.5 pl-2">{inp('adjCapCharges', calcCap, 'rose-400')}</td>
                              </tr>
                            )}
                            <tr className="border-b border-gray-800/30">
                              <td className={`font-bold py-1.5 pr-2 ${calcDelivery === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {calcDelivery === 0
                                  ? <>{useUrdu ? 'ڈلیوری چارجز' : 'Delivery Charges'} <span className="text-[9px] tracking-widest text-emerald-500">(FREE)</span></>
                                  : (useUrdu ? 'ڈلیوری چارجز' : 'Delivery Charges')}
                              </td>
                              <td className={`text-right font-black py-1.5 px-2 ${calcDelivery === 0 ? 'text-emerald-500' : 'text-amber-400'}`}>
                                {calcDelivery === 0 ? 'FREE' : `₨${calcDelivery.toLocaleString()}`}
                              </td>
                              <td className="text-right py-1.5 pl-2">
                                <span className={`font-black text-xs ${calcDelivery === 0 ? 'text-emerald-500' : 'text-amber-400'}`}>{calcDelivery === 0 ? 'FREE' : `₨${calcDelivery.toLocaleString()}`}</span>
                              </td>
                            </tr>
                            <tr className="border-b border-gray-800/30">
                              <td className="text-emerald-400 font-bold py-1.5 pr-2">{useUrdu ? 'ڈسکاؤنٹ' : 'Discount'}</td>
                              <td className="text-right text-gray-500 font-black py-1.5 px-2">—</td>
                              <td className="text-right py-1.5 pl-2">
                                <input type="number" min="0" value={formData.adjDiscount ?? ''} placeholder="0"
                                  onChange={e => setFormData({...formData, adjDiscount: e.target.value})}
                                  className="w-full text-right bg-gray-900 border border-red-500/50 rounded-lg py-1 px-2 text-xs font-black text-red-400 focus:border-red-500 outline-none transition-all" />
                              </td>
                            </tr>
                            <tr>
                              <td className="text-gray-200 font-black text-sm py-2 pr-2">{useUrdu ? 'گرینڈ ٹوٹل' : 'Grand Total'}</td>
                              <td className="text-right text-gray-200 font-black text-sm py-2 px-2">₨{calcTotal.toLocaleString()}</td>
                              <td className="text-right font-black text-white text-lg py-2 pl-2">₨{adjTotal.toLocaleString()}</td>
                            </tr>
                            {advanceAmt > 0 && (
                              <>
                                <tr>
                                  <td className="text-emerald-400 font-bold py-1 pr-2">{useUrdu ? 'ایڈوانس وصول' : 'Advance Received'}</td>
                                  <td className="text-right text-emerald-400 font-black py-1 px-2">−₨{advanceAmt.toLocaleString()}</td>
                                  <td className="text-right text-emerald-400 font-black py-1 pl-2">−₨{advanceAmt.toLocaleString()}</td>
                                </tr>
                                <tr>
                                  <td className="text-orange-400 font-black text-sm py-2 pr-2">{useUrdu ? 'باقی رقم' : 'Remaining Balance'}</td>
                                  <td className="text-right text-orange-400 font-black text-sm py-2 px-2">₨{Math.max(0, calcTotal - advanceAmt).toLocaleString()}</td>
                                  <td className="text-right text-orange-400 font-black text-lg py-2 pl-2">₨{Math.max(0, remainingBalance).toLocaleString()}</td>
                                </tr>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-800/50">
                  <span className="text-xs text-gray-400">{useUrdu ? 'کل آئٹمز' : 'Total Items'}</span>
                  <span className="font-black text-white">{memoCartTotalItems}</span>
                </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReview(false)}
                  className="flex-1 py-5 bg-gray-800 text-gray-400 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-gray-700 transition-all active:scale-95 border border-gray-700"
                >
                  {useUrdu ? 'ترمیم کریں' : 'EDIT'}
                </button>
                <button
                  onClick={() => {
                    setShowReview(false);
                    handleCheckout();
                  }}
                  disabled={loading || isSubmitting}
                  className="flex-1 py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/50 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{loading || isSubmitting ? (useUrdu ? 'جمع کر رہا ہے...' : 'SUBMITTING...') : (useUrdu ? 'تصدیق کریں' : 'CONFIRM & SUBMIT')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Side-by-side Order Edit Review Modal */}
      <AnimatePresence>
        {showEditReview && originalOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-4xl w-full p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6 border-b theme-border pb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-xl">
                    <FileEdit className="text-amber-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black theme-text-primary uppercase tracking-tight">
                      {useUrdu ? 'ترمیم کی درخواست کا جائزہ' : 'Review Edit Request'}
                    </h2>
                    <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-0.5">
                      {useUrdu ? 'آرڈر میں تبدیلیوں کا جائزہ لیں' : 'Verify original details vs requested changes'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditReview(false)}
                  className="theme-text-muted hover:text-white hover:bg-gray-800 p-2 rounded-full transition-all active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Side by Side Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                
                {/* Original Order Panel */}
                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 md:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {useUrdu ? 'اصل آرڈر' : 'Original Order'}
                  </div>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-gray-400 block">{useUrdu ? 'گاہک کا نام' : 'Customer Name'}</span>
                      <span className="theme-text-primary font-bold">{originalOrder.customerName}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">{useUrdu ? 'فون نمبر' : 'Phone'}</span>
                      <span className="theme-text-primary font-bold">{originalOrder.customerPhone}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">{useUrdu ? 'پتہ' : 'Address'}</span>
                      <span className="theme-text-primary font-medium">{originalOrder.address || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 block">{useUrdu ? 'شہر' : 'City'}</span>
                        <span className="theme-text-primary font-bold">{originalOrder.city || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">{useUrdu ? 'ترجیح' : 'Priority'}</span>
                        <span className="theme-text-primary font-bold uppercase">{originalOrder.priority || 'NORMAL'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 block">{useUrdu ? 'آرڈر کی قسم' : 'Order Type'}</span>
                        <span className="theme-text-primary font-bold uppercase">{originalOrder.type || 'STANDARD'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">{useUrdu ? 'ایڈوانس رقم' : 'Advance Amount'}</span>
                        <span className="theme-text-primary font-bold">
                          ₨{(parseFloat(originalOrder.advanceAmount) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="border-t border-red-500/10 pt-4 space-y-3">
                    <span className="text-xs font-black text-red-400 uppercase tracking-widest block">
                      {useUrdu ? 'اصل آئٹمز' : 'Original Items'}
                    </span>
                    {(() => {
                      let items = [];
                      try {
                        const pd = typeof originalOrder.productDetails === 'string' ? JSON.parse(originalOrder.productDetails) : originalOrder.productDetails;
                        items = Array.isArray(pd) ? pd : (pd ? [pd] : []);
                      } catch {
                        items = [];
                      }
                      return items.map((item, idx) => {
                        const d = item.productDetails || item;
                        return (
                          <div key={idx} className="flex justify-between items-start py-2 border-b border-red-500/10 last:border-0">
                            <div>
                              <span className="text-xs font-bold theme-text-primary">{d.productType || 'Unknown'}</span>
                              <span className="text-xs theme-text-muted block mt-0.5">
                                {d.color ? `${d.color}` : ''}{d.color && d.size ? ' / ' : ''}{d.size ? `${d.size}` : ''} × {item.quantity || originalOrder.quantity || 1}
                              </span>
                            </div>
                            <span className="text-xs font-black theme-text-primary">
                              ₨{((parseFloat(item.totalPrice) || parseFloat(originalOrder.totalPrice) || 0) / (items.length || 1)).toLocaleString()}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Pricing Subtotal */}
                  <div className="border-t border-red-500/10 pt-4 flex justify-between items-center text-xs font-black">
                    <span className="text-gray-400 uppercase">{useUrdu ? 'کل رقم' : 'Original Total'}</span>
                    <span className="text-red-400 text-sm">₨{parseFloat(originalOrder.totalPrice || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Requested Changes Panel — Editable */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 md:p-6 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{useUrdu ? 'تبدل شدہ آرڈر — ترمیم کریں' : 'Requested Changes — Edit'}</span>
                    <span className="text-[9px] font-bold text-gray-500 ml-auto">Click to edit fields directly</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-gray-400 block mb-1">{useUrdu ? 'گاہک کا نام' : 'Customer Name'}</span>
                      <input type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold ${hasChanged(originalOrder.customerName, formData.customerName) ? 'border-amber-500/50 bg-amber-500/5' : ''}`} />
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-1">{useUrdu ? 'فون نمبر' : 'Phone'}</span>
                      <input type="text" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold ${hasChanged(originalOrder.customerPhone, formData.customerPhone) ? 'border-amber-500/50 bg-amber-500/5' : ''}`} />
                    </div>
                    <div>
                      <span className="text-gray-400 block mb-1">{useUrdu ? 'پتہ' : 'Address'}</span>
                      <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}
                        className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold ${hasChanged(originalOrder.address, formData.address) ? 'border-amber-500/50 bg-amber-500/5' : ''}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-gray-400 block mb-1">{useUrdu ? 'شہر' : 'City'}</span>
                        <input type="text" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})}
                          className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold ${hasChanged(originalOrder.city, formData.city) ? 'border-amber-500/50 bg-amber-500/5' : ''}`} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">{useUrdu ? 'ترجیح' : 'Priority'}</span>
                        <div className="flex gap-1">
                          {['NORMAL', 'URGENT', 'SUPER_URGENT'].map(p => (
                            <button key={p} type="button" onClick={() => setFormData({...formData, priority: p})}
                              className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${formData.priority === p
                                ? p === 'SUPER_URGENT' ? 'bg-red-600 text-white' : p === 'URGENT' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-white'
                                : 'bg-gray-900 text-gray-600 hover:bg-gray-800'}`}>
                              {p === 'SUPER_URGENT' ? 'SUPER' : p === 'URGENT' ? 'URGENT' : 'NORMAL'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-gray-400 block mb-1">{useUrdu ? 'آرڈر کی قسم' : 'Order Type'}</span>
                        <div className="flex gap-1">
                          {['STANDARD', 'READY_LOGO', 'FULL_CUSTOM'].map(t => (
                            <button key={t} type="button" onClick={() => setFormData({...formData, type: t})}
                              className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all uppercase ${formData.type === t
                                ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-600 hover:bg-gray-800'}`}>
                              {t === 'READY_LOGO' ? 'LOGO' : t === 'FULL_CUSTOM' ? 'CUSTOM' : 'STD'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-1">{useUrdu ? 'ایڈوانس رقم' : 'Advance Amount (₨)'}</span>
                        <input type="number" min="0" value={formData.advanceAmount || ''} placeholder="e.g. 2000"
                          onChange={e => setFormData({...formData, advanceAmount: e.target.value})}
                          className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold ${hasChanged(String(originalOrder.advanceAmount || ''), String(formData.advanceAmount || '')) ? 'border-amber-500/50 bg-amber-500/5' : ''}`} />
                        {parseFloat(formData.advanceAmount) > 0 && (
                          <p className="text-xs text-emerald-400 font-bold mt-1">
                            {useUrdu ? 'ایڈوانس وصول: ' : 'Advance Received: '}₨{parseFloat(formData.advanceAmount).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-gray-400 block mb-1">{useUrdu ? 'ڈلیوری چارجز' : 'Delivery Charges'}</span>
                      {(() => {
                        const isFree = memoIsFreeDelivery;
                        return (
                          <div className={`w-full theme-input rounded-xl py-2.5 px-3 text-sm font-bold flex items-center gap-2 ${isFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isFree ? 'FREE DELIVERY' : '₨250'}
                            {isFree && <span className="text-[9px] text-emerald-500/60">(Order &gt; ₨7,000)</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Items List with inline editing */}
                  <div className="border-t border-emerald-500/10 pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                        {useUrdu ? 'نئے آئٹمز' : 'New Items'} ({cartItems.length})
                      </span>
                    </div>
                    {cartItems.map((item, idx) => {
                      const d = item.productDetails || {};
                      return (
                        <div key={idx} className="flex items-start justify-between gap-2 p-2.5 bg-gray-900/50 rounded-xl border border-emerald-500/10">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{d.productType || 'Unknown'}</p>
                            <p className="text-xs theme-text-muted truncate">
                              {[d.color, d.size].filter(Boolean).join(' / ') || '—'}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-500">Qty:</span>
                                <input type="number" min="1" value={item.quantity || 1}
                                  onChange={e => {
                                    const newCart = [...cartItems];
                                    newCart[idx] = {...newCart[idx], quantity: parseInt(e.target.value) || 1};
                                    setCartItems(newCart);
                                  }}
                                  className="w-14 theme-input rounded-lg py-1 px-2 text-xs md:text-sm font-bold text-center" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-500">₨:</span>
                                <input type="number" min="0" value={item.totalPrice || 0}
                                  onChange={e => {
                                    const newCart = [...cartItems];
                                    newCart[idx] = {...newCart[idx], totalPrice: parseFloat(e.target.value) || 0};
                                    setCartItems(newCart);
                                  }}
                                  className="w-20 theme-input rounded-lg py-1 px-2 text-xs md:text-sm font-bold text-center" />
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => {
                            const newCart = cartItems.filter((_, i) => i !== idx);
                            setCartItems(newCart);
                          }}
                            className="shrink-0 p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {cartItems.length === 0 && (
                      <p className="text-xs md:text-sm theme-text-muted italic text-center py-3">No items — add products through the form tabs below</p>
                    )}
                  </div>

                  {/* Pricing Subtotal */}
                  {(() => {
                    const orderTotalNoDelivery = memoCartTotalPrice;
                    const newDelivery = orderTotalNoDelivery > 7000 ? 0 : 250;
                    const totalNewPrice = orderTotalNoDelivery + newDelivery;
                    const origOrderTotal = parseFloat(originalOrder.totalPrice) || 0;
                    const origDelivery = parseFloat(originalOrder.deliveryCharges) || 0;
                    const origPrice = origOrderTotal + origDelivery;
                    const diff = totalNewPrice - origPrice;
                    return (
                      <div className="border-t border-emerald-500/10 pt-3 flex justify-between items-center text-xs font-black">
                        <span className="text-gray-400 uppercase">{useUrdu ? 'کل نئی رقم' : 'New Total'}</span>
                        <div className="text-right">
                          <span className={`text-sm ${diff !== 0 ? 'text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded' : 'text-emerald-400'}`}>
                            ₨{totalNewPrice.toLocaleString()}
                          </span>
                          {diff !== 0 && (
                            <span className="text-xs text-gray-500 block mt-0.5">
                              ({diff > 0 ? '+' : ''}₨{diff.toLocaleString()} vs original)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Reason For Request */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.2em] ml-2">
                  {useUrdu ? 'ترمیم کی وجہ (لازمی)' : 'Reason for Edit Request (Required)'}
                </label>
                <textarea
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full theme-input rounded-[1.5rem] py-4 px-6 text-sm font-semibold resize-none h-24 border border-amber-500/20 focus:border-amber-400"
                  placeholder={useUrdu ? 'براہ کرم تبدیلی کی تفصیلی وجہ بتائیں (مثلاً: کسٹمر نے سائز تبدیل کروایا ہے۔)' : 'Provide a justification for these changes (e.g., Customer requested a size change)...'}
                />
              </div>

              {/* Submit/Cancel Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowEditReview(false)}
                  disabled={loading || isSubmitting}
                  className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all active:scale-95 border border-gray-700 disabled:opacity-50"
                >
                  {useUrdu ? 'پیچھے جائیں' : 'BACK TO EDIT'}
                </button>
                <button
                  type="button"
                  onClick={submitOrderEditRequest}
                  disabled={loading || isSubmitting || !editReason.trim()}
                  className="flex-1 py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading || isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileEdit size={16} />
                  )}
                  <span>
                    {loading || isSubmitting
                      ? (useUrdu ? 'درخواست بھیجی جا رہی ہے...' : 'SUBMITTING...')
                      : (useUrdu ? 'درخواست جمع کروائیں' : 'SUBMIT EDIT REQUEST')}
                  </span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const tabs = [
  { id: 'basic', label: '1. Basics', icon: Layout },
  { id: 'product', label: '2. Selection', icon: ShoppingCart },
  { id: 'custom', label: '3. Engraving', icon: Scissors },
  { id: 'sizes', label: '4. Tailoring', icon: Ruler },
];

export default SmartOrderForm;
