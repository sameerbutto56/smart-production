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
  Grid
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import silhouetteMale from '../assets/silhouette.png';
import silhouetteFemale from '../assets/silhouette-female.png';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');
const socket = io(API_URL);

const SmartOrderForm = () => {
  const [activeTab, setActiveTab] = useState('basic');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState('SCRUBS');

  const [formData, setFormData] = useState({
    orderNumber: '',
    customerName: '',
    customerPhone: '',
    address: '',
    type: 'STANDARD', // STANDARD, READY_LOGO, FULL_CUSTOM
    urgent: false,
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
    required: 'یہ خانہ لازمی ہے'
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

    return () => {
      socket.off('inventory-updated');
    };
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/inventory`);
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

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
      if (!formData.productType) return 'Please select a Product Base (Step 1).';
      if (!formData.fabricType) return 'Please select a Fabric Type (Step 2).';
      if (!formData.color) return 'Please select a Color (Step 3).';
      if (!accessory && !formData.size) return 'Please select a Standard Size (Step 3).';
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

  const handleAddToCart = () => {
    const errMsg = validateCurrentTab();
    if (errMsg) {
      setError(errMsg);
      return;
    }
    
    const payload = {
      orderNumber: formData.orderNumber,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      address: formData.address,
      type: formData.type,
      urgent: formData.urgent,
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
    setSuccess(true);
    
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
    
    setActiveTab('product'); // Send them back to selection
    setTimeout(() => setSuccess(false), 2000);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (isSubmitting) return; 

    setIsSubmitting(true);
    setLoading(true);
    setError('');

    try {
      // If the factory requires independent tickets, we loop over cartItems and POST them
      // Promise.all to send them concurrently
      await Promise.all(cartItems.map(item => axios.post(`${API_URL}/api/orders`, item)));
      
      setCartItems([]);
      setSuccess(true);
      
      // Reset full form
      setFormData({
        orderNumber: '',
        customerName: '',
        customerPhone: '',
        address: '',
        type: 'STANDARD',
        urgent: false,
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

  const OptionCard = ({ label, value, current, onClick, icon: Icon, sublabel, color }) => (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`relative p-5 rounded-[1.5rem] border-2 transition-all flex flex-col items-start justify-between h-36 group ${
        current === value 
          ? `border-blue-500 bg-blue-500/10 text-white shadow-xl shadow-blue-900/30` 
          : `border-gray-800 bg-gray-800/40 text-gray-400 hover:border-gray-600 hover:bg-gray-800/60`
      }`}
    >
      <div className={`p-3 rounded-xl ${current === value ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`} style={color ? {backgroundColor: color} : {}}>
        {Icon ? <Icon size={20} /> : <Package size={20} />}
      </div>
      <div className="text-left w-full mt-2">
        <span className="block text-[11px] font-black uppercase tracking-wider truncate">{label}</span>
        {sublabel && <span className="block text-[10px] text-gray-500 mt-1 font-medium">{sublabel}</span>}
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
    return !['SCRUBS', 'COAT'].includes(catUpper);
  };
  const productsInCategory = inventory.filter(i => i.category === selectedProductCategory);
  const fabrics = inventory.filter(i => i.category === 'FABRIC');
  const colors = inventory.filter(i => i.category === 'COLOR');

  const allTabs = [
    { id: 'basic', label: '1. Basics', icon: Layout },
    { id: 'product', label: '2. Selection', icon: ShoppingCart },
    { id: 'custom', label: '3. Branding', icon: Scissors, customOnly: true },
    { id: 'sizes', label: '4. Tailoring', icon: Ruler, customOnly: true },
  ];

  const filteredTabs = allTabs.filter(tab => {
    if (tab.customOnly && formData.type === 'STANDARD') return false;
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
            <h1 className="text-3xl font-black text-white tracking-tight leading-none">{isUrdu ? 'سمارٹ آرڈر انٹری' : 'Smart Order Flow'}</h1>
            <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.3em] mt-1.5">{isUrdu ? 'پیداواری بہاؤ کی ذہانت' : 'Conveyor Belt Intelligence'}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-4 ${isUrdu ? 'flex-row-reverse' : ''}`}>
          <LanguageToggle />


          <div className="flex p-1.5 bg-gray-900/80 backdrop-blur-3xl rounded-[1.8rem] border-2 border-gray-800 shadow-2xl overflow-x-auto no-scrollbar">
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
              <div className={`lg:col-span-8 glass p-10 rounded-[3rem] space-y-10 border border-gray-800/50 shadow-2xl relative overflow-hidden ${useUrdu ? 'text-right' : ''}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
                  <h3 className="text-3xl font-black text-white tracking-tight">Identity</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-4">Order No.</label>
                    <div className="relative group">
                      <Hash className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={24} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={isOutlet ? 'AUTO-GENERATED' : formData.orderNumber}
                        disabled={isOutlet}
                        onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                        className={`w-full bg-gray-950/80 border-2 border-gray-800 rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-2xl font-black text-white placeholder-gray-800 shadow-inner ${isOutlet ? 'opacity-50 cursor-not-allowed' : ''}`}
                        placeholder={isOutlet ? 'Will be auto-assigned' : "ORD-772"}
                        required={!isOutlet}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className={`text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerName')}</label>
                    <div className="relative group">
                      <User className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={24} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                        className={`w-full bg-gray-950/80 border-2 border-gray-800 rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-2xl font-black text-white placeholder-gray-800 shadow-inner`}
                        placeholder={useUrdu ? 'کسٹمر کا نام' : "Dr. Alex Rivera"}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className={`text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerPhone')}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/10 text-pink-500`}>
                        <Phone size={18} />
                      </div>
                      <input
                        type="tel"
                        onKeyDown={preventEnterSubmit}
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-xl font-bold text-white placeholder-gray-700`}
                        placeholder="0300-1234567"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className={`text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'پتہ (Address) - اختیاری' : 'Customer Address (Optional)'}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500`}>
                        <span className="font-black text-xs">📍</span>
                      </div>
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-xl font-bold text-white placeholder-gray-700`}
                        placeholder={useUrdu ? 'گھر کا پتہ، شہر' : "House #123, Street #4, Lahore"}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className={`text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'کل رقم (Order Amount) - اختیاری' : 'Order Amount (Optional)'}</label>
                    <div className="relative group">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500`}>
                        <span className="font-black text-xs">₨</span>
                      </div>
                      <input
                        type="number"
                        onKeyDown={preventEnterSubmit}
                        value={formData.totalPrice}
                        onChange={(e) => setFormData({...formData, totalPrice: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-xl font-bold text-white placeholder-gray-700`}
                        placeholder="e.g. 2650"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">{useUrdu ? 'صنف (Gender)' : 'Gender Option'}</label>
                    <div className="flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 shadow-inner">
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
                      <label className="flex items-center justify-between p-3 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
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
                      <label className="flex items-center justify-between p-3 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-pink-500/30 transition-all group h-full overflow-hidden">
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

              <div className={`lg:col-span-4 glass p-12 rounded-[3.5rem] space-y-10 border border-gray-800 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <h3 className={`text-xl font-black text-yellow-500 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
                  <Star size={24} fill="currentColor" />
                  <span>{useUrdu ? 'آرڈر کی تفصیل' : 'Protocol'}</span>
                </h3>
                
                <div className="space-y-8">
                  <div className="flex p-2 bg-gray-950 rounded-2xl border-2 border-gray-800 shadow-inner">
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

                  <div className="space-y-5">
                    <label className={`flex items-center justify-between p-6 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-blue-500/30 transition-all group ${useUrdu ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center space-x-4 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`p-4 rounded-xl transition-all ${formData.urgent ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-600'}`}>
                          <Star size={20} />
                        </div>
                        <div className={useUrdu ? 'text-right' : ''}>
                          <p className="font-black text-sm uppercase">{t('urgent')}</p>
                          <p className="text-[10px] text-gray-600 font-bold">EXPRESS LANE</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={formData.urgent} onChange={(e) => setFormData({...formData, urgent: e.target.checked})} className="w-6 h-6 rounded-lg border-2 border-gray-700 bg-gray-900 checked:bg-blue-600 transition-all cursor-pointer" />
                    </label>

                    <label className={`flex items-center justify-between p-6 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-emerald-500/30 transition-all group ${useUrdu ? 'flex-row-reverse' : ''}`}>
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
              <div className="glass p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl">
                <div className={`flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <div className={`space-y-1 ${useUrdu ? 'text-right' : ''}`}>
                    <h3 className={`text-3xl font-black text-white flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                      <Package className="text-blue-500" size={32} />
                      <span>{t('productSelection')}</span>
                    </h3>
                    <p className={`text-gray-500 text-xs font-bold uppercase tracking-widest ${useUrdu ? 'mr-12' : 'ml-12'}`}>Step 1: Choose category & style</p>
                  </div>
                  <div className="flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 shadow-inner overflow-x-auto no-scrollbar max-w-full">
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {productsInCategory.map(item => (
                    <OptionCard
                      key={item.id}
                      label={item.name}
                      value={item.name}
                      current={formData.productType}
                      onClick={(val) => {
                        const selectedItem = inventory.find(i => i.name === val);
                        setFormData({
                          ...formData, 
                          productType: val,
                          fabricType: selectedItem?.fabric || formData.fabricType,
                          color: selectedItem?.color || formData.color,
                          productImage: selectedItem?.imageUrl || null
                        });
                      }}
                      sublabel={`${useUrdu ? 'اسٹاک' : 'Stock'}: ${item.stock}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className={`lg:col-span-5 glass p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className="space-y-1 mb-10">
                    <h3 className={`text-2xl font-black text-emerald-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                      <Layers size={28} />
                      <span>{t('fabric')}</span>
                    </h3>
                    <p className={`text-gray-500 text-[10px] font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 2: Define fabric feel</p>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    {fabrics.map(f => (
                      <OptionCard
                        key={f.id}
                        label={f.name}
                        value={f.name}
                        current={formData.fabricType}
                        onClick={(val) => setFormData({...formData, fabricType: val})}
                        icon={Layers}
                      />
                    ))}
                  </div>
                </div>

                <div className={`lg:col-span-7 glass p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                  <div className={`flex flex-col sm:flex-row items-center justify-between mb-10 gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-2xl font-black text-purple-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Palette size={28} />
                        <span>{t('color')} & {t('size')}</span>
                      </h3>
                      <p className={`text-gray-500 text-[10px] font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 3: Visual scaling</p>
                    </div>
                    {!isAccessory(selectedProductCategory) && (
                      <div className={`flex p-1.5 bg-gray-950 rounded-xl border-2 border-gray-800 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                        {['S', 'M', 'L', 'XL', '2XL'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSizeSelect(s)}
                            className={`w-12 h-12 rounded-lg font-black text-xs transition-all ${formData.size === s ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-5">
                    {colors.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormData({...formData, color: c.name})}
                        className={`group relative w-full aspect-square rounded-[1.25rem] border-4 transition-all duration-500 flex items-center justify-center ${formData.color === c.name ? 'border-white scale-110 shadow-2xl z-10' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                        style={{ backgroundColor: c.name.replace(' ', '').toLowerCase() }}
                      >
                        {formData.color === c.name && (
                          <div className="bg-white/30 backdrop-blur-md p-2 rounded-full border border-white/50">
                            <CheckCircle2 size={24} className="text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl" />
                        <span className="absolute bottom-1.5 left-0 right-0 text-[7px] font-black text-center text-white opacity-0 group-hover:opacity-100 uppercase tracking-tighter truncate px-2">
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className={`mt-10 pt-10 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
                    <div className="space-y-1">
                      <h3 className={`text-xl font-black text-blue-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                        <Hash size={24} />
                        <span>{useUrdu ? 'آرڈر کی تعداد' : 'Order Quantity'}</span>
                      </h3>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">How many sets are needed?</p>
                    </div>
                    
                    <div className="relative group w-full sm:w-64">
                      <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 font-black text-lg group-focus-within:text-blue-500 transition-colors`}>🔢</div>
                      <input
                        type="number"
                        min="1"
                        onKeyDown={preventEnterSubmit}
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-5 ${useUrdu ? 'pr-20 pl-8 text-right' : 'pl-20 pr-8'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-2xl font-black text-white shadow-inner`}
                        placeholder="1"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'custom' && (formData.type === 'FULL_CUSTOM' || formData.type === 'READY_LOGO') && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className={`glass p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-purple-600 rounded-[1.5rem] shadow-xl shadow-purple-900/30">
                    <ImageIcon className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{t('branding')}</h3>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Logo & embroidery details</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">{t('articleName')}</label>
                    <div className="relative group">
                      <Type className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={24} />
                      <input
                        type="text"
                        onKeyDown={preventEnterSubmit}
                        value={formData.nameSpelling}
                        onChange={(e) => setFormData({...formData, nameSpelling: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} focus:border-purple-500 focus:ring-8 focus:ring-purple-500/5 outline-none transition-all font-black text-xl text-white`}
                        placeholder={useUrdu ? 'آرٹیکل کا نام درج کریں' : "DR. VALERIE KING"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">{t('embroideryColor')}</label>
                      <select 
                        value={formData.nameColor}
                        onChange={(e) => setFormData({...formData, nameColor: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-8 focus:border-purple-500 outline-none font-bold text-gray-300 appearance-none shadow-inner ${useUrdu ? 'text-right' : ''}`}
                      >
                        <option value="">Standard White</option>
                        <option value="Gold">Metallic Gold</option>
                        <option value="Silver">Polished Silver</option>
                        <option value="Navy">Royal Navy</option>
                        <option value="Wine">Premium Wine</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">{t('placement')}</label>
                      <select 
                        value={formData.logoPlacement}
                        onChange={(e) => setFormData({...formData, logoPlacement: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-8 focus:border-purple-500 outline-none font-bold text-gray-300 appearance-none shadow-inner ${useUrdu ? 'text-right' : ''}`}
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

              <div className={`glass p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
                <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
                  <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-900/30">
                    <Scissors className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{t('stitching')}</h3>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Conveyor belt tailoring specs</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">{useUrdu ? 'ڈیزائن ریفرنس' : 'Design Reference'}</label>
                    <div className="relative group">
                      <Palette className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-6 text-gray-600 group-focus-within:text-blue-500 transition-colors`} size={24} />
                      <textarea
                        rows="4"
                        value={formData.designReference}
                        onChange={(e) => setFormData({...formData, designReference: e.target.value})}
                        className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all font-bold text-lg text-white placeholder-gray-800`}
                        placeholder={useUrdu ? 'مثال: شرٹ کا ڈیزائن پینٹ پر لگائیں، یا کسی دوسرے کپڑے کا حوالہ دیں' : "Example: Match shirt design on trousers, or reference another order's pattern..."}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">{t('stitchingStyle')}</label>
                      <div className={`flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 h-[72px] ${useUrdu ? 'flex-row-reverse' : ''}`}>
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
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">{t('fitProfile')}</label>
                      <div className={`flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 h-[72px] ${useUrdu ? 'flex-row-reverse' : ''}`}>
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
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">{t('notes')}</label>
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({...formData, designNotes: e.target.value})}
                      className={`w-full bg-gray-950 border-2 border-gray-800 rounded-[2rem] py-6 px-8 focus:border-blue-500 outline-none h-36 resize-none text-sm font-medium text-gray-300 shadow-inner ${useUrdu ? 'text-right' : ''}`}
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
              className="glass p-16 rounded-[4rem] border border-gray-800 shadow-2xl relative overflow-hidden"
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
                  <p className="text-gray-500 font-bold uppercase tracking-[0.4em]">All measurements in standard inches</p>
                </div>
                
                <div className="relative flex flex-col md:flex-row items-center justify-center max-w-6xl mx-auto gap-4 lg:gap-12">
                  
                  {/* Left Measurements */}
                  <div className="flex flex-col space-y-16 w-full md:w-1/3 z-20 items-center md:items-end">
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shoulder</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shoulder} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, shoulder: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Chest</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.chest} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, chest: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Sleeve</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
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
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Waist</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.waist} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, waist: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Hips</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hips: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Length</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.length} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, length: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>
                </div>

                {formData.gender === 'Female' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 bg-gray-900/50 p-8 rounded-[3rem] border border-gray-800">
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Include Dupatta</label>
                      <label className="flex items-center justify-between p-4 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-pink-500/30 transition-all group h-full">
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
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Sleeves Length</label>
                      <select
                        value={formData.femaleOptions.sleeves}
                        onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, sleeves: e.target.value}})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-5 px-6 outline-none font-bold text-gray-300 appearance-none h-full"
                      >
                        <option value="half">Half Sleeves</option>
                        <option value="medium">Medium Sleeves</option>
                        <option value="full">Full Sleeves</option>
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Shirt Length</label>
                      <select
                        value={formData.femaleOptions.shirtLength}
                        onChange={(e) => setFormData({...formData, femaleOptions: {...formData.femaleOptions, shirtLength: e.target.value}})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-5 px-6 outline-none font-bold text-gray-300 appearance-none h-full"
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
                    <p className="text-sm text-gray-500 font-bold leading-relaxed max-w-3xl">
                      Values are mapped to the "CUTTING" stage automated patterns. Double-check for 0.5" variance before deployment.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex flex-col sm:flex-row items-center justify-between pt-12 gap-8 border-t-2 border-gray-900 ${useUrdu ? 'flex-row-reverse' : ''}`}>
          <div className="flex flex-col space-y-4">
            <div className={`flex items-center space-x-3 text-gray-600 bg-gray-900/50 px-6 py-3 rounded-2xl border border-gray-800 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
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
                className="flex-1 sm:px-12 py-6 bg-gray-900 text-white rounded-[1.5rem] font-black text-sm border-2 border-gray-800 hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl"
              >
                {t('back').toUpperCase()}
              </button>
            )}
            
            {activeTab !== filteredTabs[filteredTabs.length - 1].id ? (
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
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={loading || isSubmitting}
                className="flex-1 sm:px-24 py-6 bg-gray-900 text-blue-400 border-2 border-blue-500/50 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50"
              >
                {loading || isSubmitting ? (useUrdu ? 'انتظار کریں...' : 'PROCESSING...') : (
                  <>
                    <ShoppingCart size={24} className={useUrdu ? "order-2" : "order-1"} />
                    <span className={useUrdu ? "order-1" : "order-2"}>{useUrdu ? 'کارٹ میں شامل کریں' : 'ADD TO CART'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Floating Cart Panel */}
      <AnimatePresence>
        {cartItems.length > 0 && (
          <motion.div
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 md:bottom-8 md:left-auto md:right-8 bg-gray-950/90 backdrop-blur-2xl border-t-2 md:border-2 border-gray-800 p-6 md:rounded-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-50 md:w-96"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <ShoppingCart className="text-blue-500" size={24} />
                <span>Your Cart</span>
              </h3>
              <span className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full">
                {cartItems.length} Items
              </span>
            </div>
            
            <div className="max-h-48 overflow-y-auto pr-2 space-y-3 custom-scrollbar mb-4">
              {cartItems.map((item, idx) => (
                <div key={idx} className="bg-gray-900/50 p-4 rounded-2xl flex justify-between items-center border border-gray-800">
                  <div className="flex-1 truncate">
                    <p className="text-sm font-bold text-white truncate">{item.productDetails?.productType || 'Custom Item'}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">{item.quantity}x • {item.productDetails?.size || 'Custom'} • {item.productDetails?.color}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-black text-emerald-400">${item.totalPrice}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleCheckout}
              disabled={loading || isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-900/50 hover:scale-[1.02] transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
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
