import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
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
  Sparkles,
  AlertCircle,
  Trash2,
  Phone,
  Users,
  List,
  Grid,
  X
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePolling } from '../hooks/usePolling';
import silhouetteMale from '../assets/silhouette.png';
import silhouetteFemale from '../assets/silhouette-female.png';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);
const socket = io(API_URL);

const SmartOrderForm = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState('SCRUBS');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    orderNumber: '',
    customerName: '',
    customerPhone: '',
    address: '',
    type: 'STANDARD', // STANDARD, READY_LOGO, FULL_CUSTOM
    priority: 'NORMAL',
    advancePaid: false,
    totalPrice: '',
    quantity: 1,
    
    // Product Selection
    productType: '',
    fabricType: '',
    color: '',
    size: '',

    // Customization
    logoDesign: '',
    logoName: '',
    nameSpelling: '',
    nameColor: '',
    logoColor: '',
    logoPlacement: '',

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
      hips: '',
      shirtLength: '',
      trouserLength: '',
      bottom: '',
      thigh: '',
      mori: '',
      ganda: ''
    },
    gender: 'Male',
    femaleOptions: {
      dupatta: false,
      sleeves: 'full',
      shirtLength: 'long',
      zip: false,
      cap: false
    }
  });

  const { user } = useAuth();
  const { isUrdu, LanguageToggle } = useLanguage();
  const useUrdu = isUrdu;
  const isOutlet = user?.role === 'OUTLET';

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
    branding: 'برانڈنگ اور کڑھائی',
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
    urgent: 'ارجنٹ',
    super_urgent: 'انتہائی اہم'
  };

  const t = (key) => {
    if (!key) return '';
    if (isUrdu) return URDU_LABELS[key] || key;
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  useEffect(() => {
    fetchInventory();

    socket.on('inventory-updated', () => {
      fetchInventory();
    });

    const onFocus = () => fetchInventory();
    window.addEventListener('focus', onFocus);

    return () => {
      socket.off('inventory-updated');
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const fetchInventory = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  usePolling(fetchInventory, 5000);

  // Standard Measurements Mapping
  const standardMeasurements = {
    'S': { chest: '36', shoulder: '14.5', length: '26', sleeve: '22', waist: '30', hips: '38' },
    'M': { chest: '38', shoulder: '15', length: '27', sleeve: '23', waist: '32', hips: '40' },
    'L': { chest: '40', shoulder: '16', length: '28', sleeve: '24', waist: '34', hips: '42' },
    'XL': { chest: '44', shoulder: '17', length: '29', sleeve: '25', waist: '38', hips: '46' },
    '2XL': { chest: '48', shoulder: '18', length: '30', sleeve: '26', waist: '42', hips: '50' }
  };

  const handleSizeSelect = (s) => {
    const autoMeasurements = standardMeasurements[s] || formData.measurements;
    setFormData({
      ...formData,
      size: s,
      measurements: { ...autoMeasurements }
    });
  };

  const validateCurrentTab = () => {
    setError('');
    const accessory = isAccessory(selectedProductCategory);
    
    if (activeTab === 'basic') {
      if (!isOutlet && !formData.orderNumber.trim()) return t('orderNo') + ' ' + t('required');
      if (!formData.customerName.trim()) return t('customerName') + ' ' + t('required');
      if (!formData.customerPhone.trim()) return t('customerPhone') + ' ' + t('required');
      if (formData.type === 'FULL_CUSTOM' && !formData.advancePaid) return 'Advance payment is compulsory for custom orders.';
    }
    if (activeTab === 'product') {
      if (!formData.productType && cartItems.length === 0) return 'Please select a Product (Step 1).';
    }
    if (activeTab === 'custom') {
      if (formData.type === 'FULL_CUSTOM' && !formData.stitchingStyle) return 'Please select a Stitch Pattern.';
      if (formData.type === 'FULL_CUSTOM' && !formData.fitType) return 'Please select a Fit Profile.';
    }
    if (activeTab === 'sizes' && formData.type === 'FULL_CUSTOM' && !accessory) {
      const m = formData.measurements;
      if (!m.chest || !m.shoulder || !m.length || !m.sleeve || !m.waist || !m.hips) {
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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [customModalData, setCustomModalData] = useState({
    nameText: '',
    placement: 'left',
    logoDetails: '',
    embroideryInstructions: '',
    stitchType: 'single',
    threadColor: '',
    resizeScale: 100,
  });

  const resetProductFields = () => {
    setFormData(prev => ({
      ...prev,
      quantity: 1,
      totalPrice: '',
      productType: '',
      fabricType: '',
      color: '',
      size: '',
      logoDesign: '',
      logoName: '',
      gender: 'Male',
      femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long' }
    }));
  };

  const handleAddToCart = () => {
    if (!formData.productType) {
      setError('Please select a Product first.');
      return;
    }

    // Check stock before adding to cart
    const selectedItem = productsInCategory.find(i => i.name === formData.productType);
    if (selectedItem) {
      const variants = selectedItem.variants && Array.isArray(selectedItem.variants) ? selectedItem.variants : [];
      let availableStock = 0;
      if (formData.color && formData.size) {
        availableStock = variants
          .filter(v => v.color === formData.color && v.size === formData.size)
          .reduce((s, v) => s + (v.stock || 0), 0);
      } else if (formData.color) {
        availableStock = variants
          .filter(v => v.color === formData.color)
          .reduce((s, v) => s + (v.stock || 0), 0);
      } else {
        availableStock = variants.reduce((s, v) => s + (v.stock || 0), 0);
      }
      if (availableStock <= 0) {
        setError('This product is out of stock and cannot be added to cart.');
        return;
      }
      if (parseInt(formData.quantity) > availableStock) {
        setError(`Only ${availableStock} units available in stock. Please reduce quantity.`);
        return;
      }
    }
    
    const payload = {
      orderNumber: formData.orderNumber,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      address: formData.address,
      city: formData.city,
      type: formData.type,
      priority: formData.priority,
      quantity: formData.quantity,
      advancePaid: formData.advancePaid,
      logoDesign: formData.logoDesign,
      logoName: formData.logoName,
      productDetails: {
        productType: formData.productType,
        fabricType: formData.fabricType,
        color: formData.color,
        size: formData.size,
        gender: formData.gender,
        femaleOptions: formData.gender === 'Female' ? formData.femaleOptions : null
      },
      customization: {
        nameSpelling: formData.nameSpelling,
        nameColor: formData.nameColor,
        logoColor: formData.logoColor,
        logoPlacement: formData.logoPlacement,
        stitchingStyle: formData.stitchingStyle,
        fitType: formData.fitType,
        designNotes: formData.designNotes,
        designReference: formData.designReference,
        additionalFeatures: formData.additionalFeatures
      },
      sizeData: formData.measurements,
      totalPrice: parseFloat(formData.totalPrice) || 0
    };

    setCartItems([...cartItems, payload]);

    if (formData.type === 'STANDARD') {
      setShowAddMore(true);
    } else if (formData.type !== 'STANDARD' && isCustomizableProduct(selectedProductCategory)) {
      setShowAddMore(false);
      setCustomModalData({
        nameText: formData.nameSpelling || '',
        placement: formData.logoPlacement === 'RightChest' ? 'right' : 'left',
        logoDetails: formData.logoDesign || '',
        embroideryInstructions: formData.designNotes || '',
        stitchType: formData.stitchingStyle === 'DBL' ? 'double' : 'single',
        threadColor: formData.nameColor || '',
        resizeScale: 100,
      });
      setShowCustomizationModal(true);
    } else {
      setShowAddMore(false);
      const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
      if (currentIdx !== -1 && currentIdx < filteredTabs.length - 1) {
        resetProductFields();
        setActiveTab(filteredTabs[currentIdx + 1].id);
      }
    }
  };

  const handleAddMoreProducts = () => {
    // Reset product selection but KEEP customer basics
    setFormData(prev => ({
      ...prev,
      quantity: 1,
      totalPrice: '',
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
      additionalFeatures: [],
      measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '' },
      gender: 'Male',
      femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long' }
    }));
    setShowAddMore(false);
    setActiveTab('product');
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (isSubmitting) return; 

    setIsSubmitting(true);
    setLoading(true);
    setError('');

    try {
      // Apply the final customization and measurements to ALL items in the cart
      const finalItems = cartItems.map(item => ({
        productDetails: item.productDetails,
        customization: {
          nameSpelling: formData.nameSpelling || item.customization?.nameSpelling,
          nameColor: formData.nameColor || item.customization?.nameColor,
          logoColor: formData.logoColor || item.customization?.logoColor,
          logoPlacement: formData.logoPlacement || item.customization?.logoPlacement,
          stitchingStyle: formData.stitchingStyle || item.customization?.stitchingStyle,
          fitType: formData.fitType || item.customization?.fitType,
          designNotes: formData.designNotes || item.customization?.designNotes,
          designReference: formData.designReference || item.customization?.designReference,
          additionalFeatures: formData.additionalFeatures?.length > 0 ? formData.additionalFeatures : item.customization?.additionalFeatures
        },
        sizeData: {
          chest: formData.measurements.chest || item.sizeData?.chest,
          shoulder: formData.measurements.shoulder || item.sizeData?.shoulder,
          length: formData.measurements.length || item.sizeData?.length,
          sleeve: formData.measurements.sleeve || item.sizeData?.sleeve,
          waist: formData.measurements.waist || item.sizeData?.waist,
          hips: formData.measurements.hips || item.sizeData?.hips,
        },
        quantity: parseInt(item.quantity) || 1,
        totalPrice: parseFloat(item.totalPrice) || 0
      }));

      // Build ONE single order with all items combined
      const firstItem = cartItems[0];
      const combinedOrder = {
        orderNumber: firstItem.orderNumber,
        customerName: firstItem.customerName,
        customerPhone: firstItem.customerPhone,
        address: firstItem.address,
        city: firstItem.city,
        type: firstItem.type,
        priority: firstItem.priority,
        advancePaid: firstItem.advancePaid,
        logoDesign: firstItem.logoDesign,
        logoName: firstItem.logoName,
        // Items array — all products in this single order
        items: finalItems,
        // Use first item's product as the primary (for backward compat)
        productDetails: finalItems[0].productDetails,
        customization: finalItems[0].customization,
        sizeData: finalItems[0].sizeData,
        // Sum totals across all items
        quantity: finalItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
        totalPrice: finalItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0),
      };

      // Send ONE single API call for the entire order
      await axios.post(`${API_URL}/api/orders`, combinedOrder);
      
      setCartItems([]);
      setSuccess(true);
      
      // Reset full form
      setFormData({
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        address: '',
        city: '',
    city: '',
        type: 'STANDARD',
        priority: 'NORMAL',
        advancePaid: false,
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
        stitchingStyle: '',
        fitType: 'Regular',
        designNotes: '',
        additionalFeatures: [],
        measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '' },
        gender: 'Male',
        femaleOptions: { dupatta: false, sleeves: 'full', shirtLength: 'long' }
      });
      setActiveTab('basic');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error during checkout:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      setError(serverMsg || 'Error processing checkout. Please try again.');
    }
    setLoading(false);
    setIsSubmitting(false);
  };

  const handleCustomizationSave = () => {
    setFormData(prev => ({
      ...prev,
      nameSpelling: customModalData.nameText,
      logoPlacement: customModalData.placement === 'right' ? 'RightChest' : 'LeftChest',
      logoDesign: customModalData.logoDetails,
      designNotes: customModalData.embroideryInstructions,
      stitchingStyle: customModalData.stitchType === 'double' ? 'DBL' : 'STD',
      nameColor: customModalData.threadColor,
    }));
    setShowCustomizationModal(false);
    resetProductFields();
    const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
    if (currentIdx !== -1 && currentIdx < filteredTabs.length - 1) {
      setActiveTab(filteredTabs[currentIdx + 1].id);
    }
  };

  const handleCustomizationSkip = () => {
    setShowCustomizationModal(false);
    resetProductFields();
    const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
    if (currentIdx !== -1 && currentIdx < filteredTabs.length - 1) {
      setActiveTab(filteredTabs[currentIdx + 1].id);
    }
  };

  const OptionCard = ({ label, value, current, onClick, icon: Icon, sublabel, color, disabled = false }) => (
    <button
      type="button"
      onClick={() => { if (!disabled) onClick(value); }}
      className={`relative p-5 rounded-[1.5rem] border-2 transition-all flex flex-col items-start justify-between min-h-[9rem] h-auto w-full group ${
        disabled
          ? 'border-red-900/50 bg-gray-800/20 text-gray-600 cursor-not-allowed opacity-50'
          : current === value 
            ? `border-blue-500 bg-blue-500/10 theme-text-primary shadow-xl shadow-blue-900/30` 
            : `theme-border theme-bg-subtle theme-text-secondary hover:border-gray-600 hover:bg-gray-800/60`
      }`}
    >
      <div className={`p-3 rounded-xl ${disabled ? 'bg-gray-700/50 text-gray-600' : current === value ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`} style={color ? {backgroundColor: color} : {}}>
        {Icon ? <Icon size={20} /> : <Package size={20} />}
      </div>
      <div className="text-left w-full mt-2">
        <span className="block text-[11px] font-black uppercase tracking-wider whitespace-normal break-words leading-snug">{label}</span>
        {sublabel &&           <span className={`block text-[10px] mt-1 font-medium whitespace-normal break-words ${disabled ? 'text-red-400' : 'theme-text-muted'}`}>{sublabel}</span>}
      </div>
      {!disabled && current === value && (
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
    return !['SCRUBS', 'COAT', 'CAP', 'CAPS'].includes(catUpper);
  };
  const isCustomizableProduct = (cat) => {
    if (!cat) return false;
    const catUpper = cat.toUpperCase();
    return ['SCRUBS', 'COAT', 'CAP', 'CAPS'].includes(catUpper);
  };
  const productsInCategory = inventory.filter(i => i.category === selectedProductCategory);
  // Get unique product names in selected category
  const uniqueProductNames = [...new Set(productsInCategory.map(i => i.name))];
  // Selected product item (single product with variants array)
  const selectedProduct = formData.productType 
    ? productsInCategory.find(i => i.name === formData.productType) 
    : null;
  // Get variants array from selected product, or empty
  const selectedProductVariants = selectedProduct?.variants && Array.isArray(selectedProduct.variants)
    ? selectedProduct.variants
    : (selectedProduct ? [{ color: selectedProduct.color, size: selectedProduct.size, stock: selectedProduct.stock, price: selectedProduct.price }] : []);
  // Fabric from selected product
  const fabrics = formData.productType && selectedProduct
    ? (selectedProduct.fabric ? [selectedProduct.fabric] : [])
    : inventory.filter(i => i.category === 'FABRIC');
  // Colors from variant color values
  const colors = formData.productType && selectedProductVariants.length > 0
    ? [...new Set(selectedProductVariants.filter(v => v.color).map(v => v.color))]
    : [];
  // Sizes from variant size values
  const availableSizes = formData.productType && selectedProductVariants.length > 0
    ? [...new Set(selectedProductVariants.filter(v => v.size).map(v => v.size))]
    : [];

  const allTabs = [
    { id: 'basic', label: '1. Basics', icon: Layout },
    { id: 'product', label: '2. Selection', icon: ShoppingCart },
    { id: 'custom', label: '3. Branding', icon: Scissors, customOnly: true },
    { id: 'sizes', label: '4. Tailoring', icon: Ruler, customOnly: true },
  ];

  const filteredTabs = allTabs.filter(tab => {
    if (tab.customOnly && formData.type === 'STANDARD') return false;
    if (tab.customOnly && !isCustomizableProduct(selectedProductCategory)) return false;
    if (tab.id === 'sizes' && (isAccessory(selectedProductCategory) || formData.type !== 'FULL_CUSTOM')) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-6">
        <div className={`flex items-center ${isUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
          <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-2xl shadow-blue-900/40 rotate-3">
            <Sparkles className="text-white" size={24} />
          </div>
          <div className={isUrdu ? 'text-right' : ''}>
            <h1 className="text-3xl font-black theme-text-primary tracking-tight leading-none">{isUrdu ? 'سمارٹ آرڈر انٹری' : 'Smart Order Flow'}</h1>
            <p className="theme-text-muted text-[9px] font-black uppercase tracking-[0.3em] mt-1.5">{isUrdu ? 'پیداواری بہاؤ کی ذہانت' : 'Conveyor Belt Intelligence'}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-4 ${isUrdu ? 'flex-row-reverse' : ''}`}>
          <LanguageToggle />


          <div className="flex p-1.5 theme-bg backdrop-blur-3xl rounded-[1.8rem] border-2 theme-border shadow-2xl overflow-x-auto no-scrollbar">
            {filteredTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${
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

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'basic' && (
            <motion.div
              key="basic"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className={`lg:col-span-8 glass p-10 rounded-[3rem] space-y-10 border theme-border shadow-2xl relative overflow-hidden ${useUrdu ? 'text-right' : ''}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  <h3 className="text-3xl font-black theme-text-primary tracking-tight">Identity</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-4">Order No.</label>
                    <div className="relative group">
                      <Hash className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={24} />
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
                    <label className={`text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerName')}</label>
                    <div className="relative group">
                      <User className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={24} />
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
                    <label className={`text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerPhone')}</label>
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
                    <label className={`text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'پتہ (Address) - اختیاری' : 'Customer Address (Optional)'}</label>
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
                  <div className="space-y-4">
                    <label className={`text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'شہر (City) - اختیاری' : 'City (Optional)'}</label>
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
                    <label className={`text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'کل رقم (Order Amount) - اختیاری' : 'Order Amount (Optional)'}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500`}>
                        <span className="font-black text-xs">₨</span>
                      </div>
                      <input
                        type="number"
                        onKeyDown={preventEnterSubmit}
                        value={formData.totalPrice}
                        onChange={(e) => setFormData({...formData, totalPrice: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                        placeholder="e.g. 2650"
                      />
                    </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-3 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-2.5 rounded-xl transition-all shrink-0 ${formData.femaleOptions.dupatta ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <Layers size={16} />
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-black text-[10px] uppercase truncate">{t('dupatta')}</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.dupatta} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, dupatta: e.target.checked}})} className="w-5 h-5 shrink-0 ml-2 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                      <label className="flex items-center justify-between p-3 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center ${formData.femaleOptions.zip ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                            <span className="font-black text-[9px]">ZIP</span>
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="font-black text-[10px] uppercase truncate">{t('zip')}</p>
                          </div>
                        </div>
                        <input type="checkbox" checked={formData.femaleOptions.zip} onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, zip: e.target.checked}})} className="w-5 h-5 shrink-0 ml-2 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className={`lg:col-span-4 glass p-12 rounded-[3.5rem] space-y-10 border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <h3 className={`text-xl font-black text-yellow-500 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
                  <Star size={24} fill="currentColor" />
                  <span>{useUrdu ? 'آرڈر کی تفصیل' : 'Protocol'}</span>
                </h3>
                
                <div className="space-y-8">
                  <div className="flex p-2 theme-bg rounded-2xl border-2 theme-border shadow-inner">
                    {!isOutlet && (
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, type: 'STANDARD', advancePaid: false})}
                        className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all ${formData.type === 'STANDARD' ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}
                      >
                        {useUrdu ? URDU_LABELS.standard : 'STANDARD'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'READY_LOGO', advancePaid: false})}
                      className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all ${formData.type === 'READY_LOGO' ? 'bg-purple-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}
                    >
                      {useUrdu ? URDU_LABELS.logo : 'LOGO'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'FULL_CUSTOM', advancePaid: true})}
                      className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all ${formData.type === 'FULL_CUSTOM' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}
                    >
                      {useUrdu ? URDU_LABELS.custom : 'CUSTOM'}
                    </button>
                  </div>

                  {/* Priority Level */}
                  <div className="space-y-3">
                    <label className="font-black text-xs uppercase tracking-widest theme-text-muted">{t('priority')}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['NORMAL', 'URGENT', 'SUPER_URGENT'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData({...formData, priority: p})}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black transition-all border-2 ${
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

                  <div className="space-y-5">
                    <label className={`flex items-center justify-between p-6 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-emerald-500/30 transition-all group ${useUrdu ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center space-x-4 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`p-4 rounded-xl transition-all ${formData.advancePaid ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-800 text-gray-600'}`}>
                          <CheckCircle2 size={20} />
                        </div>
                        <div className={useUrdu ? 'text-right' : ''}>
                          <p className="font-black text-sm uppercase">{t('advance')}</p>
                          <p className="text-[10px] text-gray-600 font-bold">CONFIRMATION</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={formData.advancePaid} onChange={(e) => setFormData({...formData, advancePaid: e.target.checked})} className="w-6 h-6 rounded-lg border-2 border-gray-700 bg-gray-900 checked:bg-emerald-600 transition-all cursor-pointer" />
                    </label>

                    {/* Total Price */}

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
              className="space-y-10"
            >
              <div className="glass p-12 rounded-[3.5rem] border theme-border shadow-2xl">
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className={`space-y-1 ${useUrdu ? 'text-right' : ''}`}>
                    <h3 className={`text-3xl font-black theme-text-primary flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
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
                          if (isAccessory(cat)) {
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {Array.from(new Set(productsInCategory.map(i => i.name)))
                    .map(name => productsInCategory.find(i => i.name === name))
                    .filter(item => !productSearchTerm || item.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                    .map(item => {
                      const totalStock = item.variants && Array.isArray(item.variants)
                        ? item.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
                        : (item.stock || 0);
                      const outOfStock = totalStock <= 0;
                      return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (outOfStock) return;
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
            : outOfStock
            ? 'border-red-900/50 bg-gray-800/20 text-gray-600 cursor-not-allowed opacity-50'
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
                        <div className={`p-3 rounded-xl ${formData.productType === item.name ? 'bg-blue-500 text-white' : outOfStock ? 'bg-gray-700/50 text-gray-600' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`}>
                          <Package size={22} />
                        </div>
                        <div className="text-center w-full mt-2 space-y-2">
                          <span className="block text-sm font-black uppercase tracking-wider leading-snug">{item.name}</span>
                          <span className="block text-lg font-black tracking-tight">
                            <span className={`${totalStock > 50 ? 'text-emerald-400' : totalStock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {totalStock}
                            </span>
                            <span className="text-[9px] theme-text-muted ml-1">in stock</span>
                          </span>
                          {item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap justify-center gap-1">
                                {[...new Set(item.variants.filter(v => v.color).map(v => v.color))].map(c => (
                                  <span key={c} className="text-[8px] font-bold theme-text-secondary bg-gray-800/60 px-2 py-0.5 rounded-full truncate max-w-[70px]">{c}</span>
                                ))}
                              </div>
                              <div className="flex flex-wrap justify-center gap-1">
                                {[...new Set(item.variants.filter(v => v.size).map(v => v.size))].map(s => (
                                  <span key={s} className="text-[8px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full">{s}</span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            item.color && <span className="block text-[9px] theme-text-muted font-bold truncate">{item.color}</span>
                          )}
                          {outOfStock && <span className="block text-[9px] text-red-400 font-black uppercase">Out of Stock</span>}
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

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className={`lg:col-span-5 glass p-12 rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className="space-y-1 mb-10">
                    <h3 className={`text-2xl font-black text-emerald-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                      <Layers size={28} />
                      <span>{t('fabric')}</span>
                    </h3>
                    <p className={`theme-text-muted text-[10px] font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 2: Define fabric feel</p>
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
                          sublabel={fStock > 0 ? `${fStock} units` : 'Out of stock'}
                          disabled={fStock <= 0}
                        />
                      )})}
                    </div>
                  ) : (
                    <div className="theme-bg-subtle p-6 rounded-2xl border theme-border text-center mt-4">
                      <p className="theme-text-secondary font-bold text-base">Select a product first to see available fabrics</p>
                    </div>
                  )}
                </div>

                <div className={`lg:col-span-7 glass p-12 rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className={`flex flex-col sm:flex-row items-center justify-between mb-10 gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-2xl font-black text-purple-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Palette size={28} />
                        <span>{t('color')} & {t('size')}</span>
                      </h3>
                      <p className={`theme-text-muted text-[10px] font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 3: Visual scaling</p>
                    </div>
                    {!isAccessory(selectedProductCategory) && (
                      <div className={`flex p-1.5 theme-bg rounded-xl border-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {(availableSizes.length > 0 ? availableSizes : ['S', 'M', 'L', 'XL', '2XL']).map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSizeSelect(s)}
                            className={`w-14 h-14 rounded-lg font-black text-xs transition-all ${
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
                    <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-4 mt-6">
                      {colors.map(c => {
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
                          onClick={() => { if (stockForColor > 0) setFormData({...formData, color: c}); }}
                          className={`group relative w-full rounded-xl border-2 transition-all duration-200 flex flex-col items-center overflow-hidden ${
                            formData.color === c ? 'border-white ring-2 ring-blue-500 scale-105 z-10' : stockForColor <= 0 ? 'border-red-900/50 opacity-40 cursor-not-allowed' : 'border-gray-700/50 hover:border-gray-500'
                          }`}
                        >
                          <div className="w-full aspect-square flex items-center justify-center relative" style={{ backgroundColor: bgHex }}>
                            {formData.color === c && (
                              <div className={`${textClass} bg-black/20 backdrop-blur-sm p-1.5 rounded-full`}>
                                <CheckCircle2 size={20} className={textClass} />
                              </div>
                            )}
                            {stockForColor <= 0 && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <X size={24} className="text-red-400" />
                              </div>
                            )}
                          </div>
                          <div className="w-full py-1.5 px-1 theme-bg text-center">
                            <p className={`text-[9px] font-black truncate ${stockForColor <= 0 ? 'text-red-400' : 'theme-text-primary'}`}>{c}</p>
                            <p className="text-[7px] font-bold theme-text-muted">{stockForColor} in stock</p>
                          </div>
                        </button>
                      )})}
                    </div>
                  )}
                  {/* Show message if product has no color variants */}
                  {formData.productType && colors.length === 0 && (
                    <div className="mt-6 theme-bg-subtle p-6 rounded-2xl border theme-border text-center">
                      <p className="theme-text-secondary text-sm font-bold">Colors: Available (Standard)</p>
                    </div>
                  )}

                  <div className={`mt-10 pt-10 border-t theme-border flex flex-col sm:flex-row items-center justify-between gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-xl font-black text-blue-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Hash size={24} />
                        <span>{useUrdu ? 'آرڈر کی تعداد' : 'Order Quantity'}</span>
                      </h3>
                      <p className="theme-text-muted text-[10px] font-bold uppercase tracking-widest">How many sets are needed?</p>
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
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className={`glass p-12 rounded-[3.5rem] border theme-border space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-purple-600 rounded-[1.5rem] shadow-xl shadow-purple-900/30">
                    <ImageIcon className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black theme-text-primary">{t('branding')}</h3>
                    <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Logo & embroidery details</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('articleName')}</label>
                    <div className="relative group">
                      <Type className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={24} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.nameSpelling}
                        onChange={(e) => setFormData({...formData, nameSpelling: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-black text-xl`}
                        placeholder={useUrdu ? 'آرٹیکل کا نام درج کریں' : "DR. VALERIE KING"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                </div>
              </div>

              <div className={`glass p-12 rounded-[3.5rem] border theme-border space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-900/30">
                    <Scissors className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black theme-text-primary">{t('stitching')}</h3>
                    <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Conveyor belt tailoring specs</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{useUrdu ? 'ڈیزائن ریفرنس' : 'Design Reference'}</label>
                    <div className="relative group">
                      <Palette className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-6 text-gray-600 group-focus-within:text-blue-500 transition-colors`} size={24} />
                      <textarea
                        rows="4"
                        value={formData.designReference}
                        onChange={(e) => setFormData({...formData, designReference: e.target.value})}
                        className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-bold text-lg`}
                        placeholder={useUrdu ? 'مثال: شرٹ کا ڈیزائن پینٹ پر لگائیں، یا کسی دوسرے کپڑے کا حوالہ دیں' : "Example: Match shirt design on trousers, or reference another order's pattern..."}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">{t('stitchingStyle')}</label>
                      <div className={`flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border h-[72px] ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {['STD', 'DBL'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({...formData, stitchingStyle: s})}
                            className={`flex-1 rounded-xl text-[11px] font-black transition-all ${formData.stitchingStyle === s ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}
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
                            className={`flex-1 rounded-xl text-[11px] font-black transition-all ${formData.fitType === f ? 'bg-indigo-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}
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
            </motion.div>
          )}

          {activeTab === 'sizes' && formData.type === 'FULL_CUSTOM' && (
            <motion.div
              key="sizes"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="glass p-16 rounded-[4rem] border theme-border shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-20 -right-20 opacity-5 select-none pointer-events-none">
                <Ruler size={500} />
              </div>
              
              <div className="relative z-10 space-y-16">
                <div className="space-y-2 text-center mb-16">
                  <h3 className="text-4xl font-black text-emerald-400 flex justify-center items-center space-x-6 uppercase tracking-tighter">
                    <Ruler size={42} />
                    <span>Anatomical Precision Chart</span>
                  </h3>
                  <p className="theme-text-muted font-bold uppercase tracking-[0.4em]">All measurements in standard inches</p>
                </div>
                
                <div className="relative flex flex-col md:flex-row items-center justify-center max-w-6xl mx-auto gap-4 lg:gap-12">
                  
                  {/* Left Measurements */}
                  <div className="flex flex-col space-y-16 w-full md:w-1/3 z-20 items-center md:items-end">
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shoulder</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shoulder} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, shoulder: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Chest</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.chest} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, chest: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Sleeve</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.sleeve} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, sleeve: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Silhouette */}
                  <div className="hidden md:flex relative w-1/3 justify-center items-center min-h-[500px]">
                    <img 
                      src={formData.gender === 'Female' ? silhouetteFemale : silhouetteMale} 
                      alt="Tailor Silhouette" 
                      className="h-[550px] object-contain opacity-60 filter drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]" 
                      loading="lazy"
                    />
                    
                    {/* Connecting Lines */}
                    <div className="absolute top-[20%] left-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[35%] left-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[50%] left-[-5%] w-[55%] border-t border-dashed border-emerald-500/40"></div>

                    <div className="absolute top-[45%] right-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[60%] right-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                    <div className="absolute top-[80%] right-[15%] w-[35%] border-t border-dashed border-emerald-500/40"></div>
                  </div>

                  {/* Right Measurements */}
                  <div className="flex flex-col space-y-16 w-full md:w-1/3 z-20 items-center md:items-start">
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Waist</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.waist} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, waist: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Hips</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hips: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Length</label>
                      <div className="relative flex items-end w-48 theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.length} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, length: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {formData.gender === 'Female' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 theme-bg-subtle p-8 rounded-[3rem] border theme-border">
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

                <div className="mt-16 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-[3rem] p-10 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-inner">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex flex-col sm:flex-row items-center justify-between pt-12 gap-8 border-t-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
          <div className="flex flex-col space-y-4">
            <div className={`flex items-center space-x-3 text-gray-600 theme-bg-subtle px-6 py-3 rounded-2xl border theme-border ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{useUrdu ? 'تصدیق شدہ نظام' : 'Validated System Protocol'}</span>
            </div>
            {error && (
              <div className={`flex items-center space-x-3 text-red-500 bg-red-500/10 px-6 py-3 rounded-2xl border border-red-500/20 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <AlertCircle size={16} />
                <span className="text-xs font-bold">{error}</span>
              </div>
            )}
          </div>
          
          <div className={`flex space-x-6 w-full sm:w-auto ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
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

            {/* Add to Cart button - only on the product selection tab */}
            {activeTab === 'product' && (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={loading || isSubmitting}
                className="flex-1 sm:px-16 py-6 theme-bg text-blue-400 border-2 border-blue-500/50 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50"
              >
                {loading || isSubmitting ? (useUrdu ? 'انتظار کریں...' : 'PROCESSING...') : (
                  <>
                    <ShoppingCart size={24} className={useUrdu ? "order-2" : "order-1"} />
                    <span className={useUrdu ? "order-1" : "order-2"}>{useUrdu ? 'کارٹ میں شامل کریں' : 'ADD TO CART'}</span>
                  </>
                )}
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
                  
                  // Special behavior for selection tab on logo/custom orders:
                  // If product selected, automatically add to cart and transition
                  if (activeTab === 'product' && formData.type !== 'STANDARD') {
                    if (formData.productType) {
                      handleAddToCart();
                    } else if (cartItems.length > 0) {
                      const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                      setActiveTab(filteredTabs[currentIdx + 1].id);
                    } else {
                      setError('Please select a Product first.');
                    }
                  } else {
                    const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                    setActiveTab(filteredTabs[currentIdx + 1].id);
                  }
                }}
                className="flex-1 sm:px-16 py-6 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group"
              >
                <span className={useUrdu ? "order-2" : "order-1"}>{t('next').toUpperCase()}</span>
                <ArrowRight size={22} className={`transition-transform ${useUrdu ? 'order-1 rotate-180 group-hover:-translate-x-2' : 'order-2 group-hover:translate-x-2'}`} />
              </button>
            )}

            {/* SUBMIT ORDER button - on the last tab */}
            {(activeTab === filteredTabs[filteredTabs.length - 1].id && (formData.type !== 'STANDARD' || cartItems.length > 0)) && (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading || isSubmitting}
                className="flex-1 sm:px-16 py-6 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group disabled:opacity-50"
              >
                <CheckCircle2 size={24} />
                <span>{useUrdu ? 'آرڈر جمع کرائیں' : 'SUBMIT ORDER'}</span>
              </button>
            )}
          </div>
        </div>
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
                {useUrdu ? 'پروڈکٹ کارٹ میں شامل ہو گئی!' : 'Added to Cart!'}
              </h2>
              <p className="theme-text-muted text-xs font-bold uppercase tracking-widest mb-8">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in cart
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={handleAddMoreProducts}
                  className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <Plus size={20} />
                  <span>{useUrdu ? 'مزید پروڈکٹس شامل کریں' : 'ADD MORE PRODUCTS'}</span>
                </button>
                
                {activeTab !== filteredTabs[filteredTabs.length - 1].id ? (
                  <button
                    onClick={() => {
                      setShowAddMore(false);
                      const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                      setActiveTab(filteredTabs[currentIdx + 1].id);
                    }}
                    className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-900/50 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3"
                  >
                    <ArrowRight size={20} />
                    <span>{useUrdu ? 'اگلے مرحلے پر جائیں' : 'PROCEED TO NEXT STEP'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowAddMore(false);
                      handleCheckout();
                    }}
                    disabled={loading || isSubmitting}
                    className="w-full py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/50 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50"
                  >
                    <CheckCircle2 size={20} />
                    <span>{useUrdu ? 'آرڈر جمع کرائیں' : 'CHECKOUT ORDER'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customization Modal */}
      <AnimatePresence>
        {showCustomizationModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-2xl w-full p-8 md:p-12 rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[1.5rem] shadow-xl">
                  <Scissors className="text-white" size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight">Customization Details</h2>
                  <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Configure your product</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Custom Name / Text */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Custom Name / Text</label>
                  <input
                    type="text"
                    value={customModalData.nameText}
                    onChange={(e) => setCustomModalData({...customModalData, nameText: e.target.value})}
                    className="w-full theme-input rounded-[1.2rem] py-4 px-6 transition-all font-bold text-lg"
                    placeholder="e.g. DR. ALEX RIVERA"
                  />
                </div>

                {/* Placement */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Placement</label>
                  <div className="flex p-1.5 theme-bg rounded-[1.2rem] border-2 theme-border">
                    <button
                      type="button"
                      onClick={() => setCustomModalData({...customModalData, placement: 'left'})}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${customModalData.placement === 'left' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                      Left Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomModalData({...customModalData, placement: 'right'})}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${customModalData.placement === 'right' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                      Right Side
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomModalData({...customModalData, placement: 'center'})}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${customModalData.placement === 'center' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                      Center
                    </button>
                  </div>
                </div>

                {/* Logo Details */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Logo Details</label>
                  <textarea
                    value={customModalData.logoDetails}
                    onChange={(e) => setCustomModalData({...customModalData, logoDetails: e.target.value})}
                    className="w-full theme-input rounded-[1.2rem] py-4 px-6 transition-all font-medium text-sm resize-none h-24"
                    placeholder="Describe logo, file reference, or upload instructions..."
                  />
                </div>

                {/* Embroidery / Printing Instructions */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Embroidery / Printing Instructions</label>
                  <textarea
                    value={customModalData.embroideryInstructions}
                    onChange={(e) => setCustomModalData({...customModalData, embroideryInstructions: e.target.value})}
                    className="w-full theme-input rounded-[1.2rem] py-4 px-6 transition-all font-medium text-sm resize-none h-24"
                    placeholder={'E.g. Single needle, 1 color logo, 1" height...'}
                  />
                </div>

                {/* Stitch Type */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Stitch Type</label>
                  <div className="flex p-1.5 theme-bg rounded-[1.2rem] border-2 theme-border">
                    <button
                      type="button"
                      onClick={() => setCustomModalData({...customModalData, stitchType: 'single'})}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${customModalData.stitchType === 'single' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomModalData({...customModalData, stitchType: 'double'})}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${customModalData.stitchType === 'double' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                      Double
                    </button>
                  </div>
                </div>

                {/* Thread Color */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Thread Color</label>
                  <select
                    value={customModalData.threadColor}
                    onChange={(e) => setCustomModalData({...customModalData, threadColor: e.target.value})}
                    className="w-full theme-input rounded-[1.2rem] py-4 px-6 font-bold appearance-none"
                  >
                    <option value="">Standard White</option>
                    <option value="Gold">Metallic Gold</option>
                    <option value="Silver">Polished Silver</option>
                    <option value="Navy">Royal Navy</option>
                    <option value="Wine">Premium Wine</option>
                    <option value="Black">Deep Black</option>
                    <option value="Red">Signature Red</option>
                  </select>
                </div>

                {/* Size Adjustment */}
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] ml-2">Size Adjustment / Scale: {customModalData.resizeScale}%</label>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest w-12 text-right">50%</span>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={customModalData.resizeScale}
                      onChange={(e) => setCustomModalData({...customModalData, resizeScale: parseInt(e.target.value)})}
                      className="flex-1 h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-purple-500"
                    />
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest w-12">200%</span>
                  </div>
                  <div className="flex justify-center mt-2">
                    <div className="theme-bg border-2 theme-border rounded-[1rem] px-6 py-3 inline-flex items-center gap-3">
                      <span className="text-[10px] font-black theme-text-muted uppercase">Preview Scale:</span>
                      <span className="text-lg font-black text-purple-400">{customModalData.resizeScale}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={handleCustomizationSave}
                  className="flex-1 py-5 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-purple-900/50 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3"
                >
                  <CheckCircle2 size={20} />
                  <span>Save & Continue</span>
                </button>
                <button
                  type="button"
                  onClick={handleCustomizationSkip}
                  className="py-5 px-8 theme-bg theme-text-secondary rounded-[1.5rem] font-black text-sm uppercase tracking-widest border-2 theme-border hover:border-gray-600 hover:text-white transition-all active:scale-95"
                >
                  Skip Customization
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Cart Panel & FAB */}
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
              <span className="absolute -top-3 -right-3 bg-pink-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg">
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
                  <ShoppingCart className="text-blue-500" size={24} />
                </div>
                <h3 className="text-xl font-black theme-text-primary tracking-tight">Your Cart</h3>
                <span className="bg-gray-800 text-gray-300 text-[10px] font-black px-3 py-1.5 rounded-full ml-2">
                  {cartItems.length} Items
                </span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="theme-text-muted hover:text-white hover:bg-gray-800 p-2 rounded-full transition-all active:scale-95"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scrollbar mb-6">
              {cartItems.map((item, idx) => (
                <div key={idx} className="theme-bg-subtle p-4 rounded-2xl flex justify-between items-center border theme-border hover:border-gray-700 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-black theme-text-primary truncate">{item.productDetails?.productType || 'Custom Item'}</p>
                    <p className="text-[10px] theme-text-muted font-bold uppercase mt-1 truncate">
                      {item.quantity}x • {item.productDetails?.size || 'Custom'} • {item.productDetails?.color}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
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
              <CheckCircle2 size={20} />
              <span>Checkout Order</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
            <p className="text-[10px] font-black text-white/80 mt-2 uppercase tracking-[0.2em]">{useUrdu ? 'پیداواری لائن میں شامل کر دیا گیا' : 'Synced with Production Floor'}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const tabs = [
  { id: 'basic', label: '1. Basics', icon: Layout },
  { id: 'product', label: '2. Selection', icon: ShoppingCart },
  { id: 'custom', label: '3. Branding', icon: Scissors },
  { id: 'sizes', label: '4. Tailoring', icon: Ruler },
];

export default SmartOrderForm;
