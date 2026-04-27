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
  AlertCircle
} from 'lucide-react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
    type: 'simple',
    urgent: false,
    advancePaid: false,
    
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
    additionalFeatures: [],

    // Size Data (Measurements)
    measurements: {
      chest: '',
      shoulder: '',
      length: '',
      sleeve: '',
      waist: '',
      hips: ''
    }
  });

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
      if (!formData.orderNumber.trim()) return 'Order ID is required.';
      if (!formData.customerName.trim()) return 'Customer Name is required.';
      if (formData.type === 'custom' && !formData.advancePaid) return 'Advance payment is compulsory for custom orders.';
    }
    if (activeTab === 'product') {
      if (!formData.productType) return 'Please select a Product Base (Step 1).';
      if (!formData.fabricType) return 'Please select a Fabric Type (Step 2).';
      if (!formData.color) return 'Please select a Color (Step 3).';
      if (!accessory && !formData.size) return 'Please select a Standard Size (Step 3).';
    }
    if (activeTab === 'custom') {
      if (!formData.stitchingStyle) return 'Please select a Stitch Pattern in Advanced Stitching.';
      if (!formData.fitType) return 'Please select a Fit Profile in Advanced Stitching.';
    }
    if (activeTab === 'sizes' && formData.type === 'custom' && !accessory) {
      const m = formData.measurements;
      if (!m.chest || !m.shoulder || !m.length || !m.sleeve || !m.waist || !m.hips) {
        return 'All precise measurements are required for custom tailoring.';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double submit
    const errMsg = validateCurrentTab();
    if (errMsg) {
      setError(errMsg);
      return;
    }
    setIsSubmitting(true);
    setLoading(true);
    try {
      const payload = {
        orderNumber: formData.orderNumber,
        customerName: formData.customerName,
        type: formData.type,
        urgent: formData.urgent,
        advancePaid: formData.advancePaid,
        logoDesign: formData.logoDesign,
        logoName: formData.logoName,
        productDetails: {
          productType: formData.productType,
          fabricType: formData.fabricType,
          color: formData.color,
          size: formData.size
        },
        customization: {
          nameSpelling: formData.nameSpelling,
          nameColor: formData.nameColor,
          logoColor: formData.logoColor,
          logoPlacement: formData.logoPlacement,
          stitchingStyle: formData.stitchingStyle,
          fitType: formData.fitType,
          designNotes: formData.designNotes,
          additionalFeatures: formData.additionalFeatures
        },
        sizeData: formData.measurements
      };

      await axios.post(`${API_URL}/api/orders`, payload);
      setSuccess(true);
      // Reset form after successful submission
      setFormData({
        orderNumber: '',
        customerName: '',
        type: 'simple',
        urgent: false,
        advancePaid: false,
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
        measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '' }
      });
      setActiveTab('basic');
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating order:', error);
      setError(error.response?.data?.message || 'Error creating order. Please try again.');
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
    if (tab.customOnly && formData.type !== 'custom') return false;
    if (tab.id === 'sizes' && isAccessory(selectedProductCategory)) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto pb-24 px-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-8">
        <div className="flex items-center space-x-5">
          <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] shadow-2xl shadow-blue-900/40 rotate-3">
            <Sparkles className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Smart Order Flow</h1>
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-[0.2em] mt-1">Conveyor Belt Intelligence</p>
          </div>
        </div>
        
        <div className="flex p-2 bg-gray-900/90 backdrop-blur-xl rounded-3xl border-2 border-gray-800 shadow-2xl">
          {filteredTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-3 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-500 ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-2xl shadow-blue-900/60 scale-105' 
                  : 'text-gray-500 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <tab.icon size={20} />
              <span className="hidden sm:inline">{`${index + 1}. ${tab.label.split('. ')[1] || tab.label}`.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <AnimatePresence mode="wait">
          {activeTab === 'basic' && (
            <motion.div
              key="basic"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-8 glass p-12 rounded-[3.5rem] space-y-10 border border-gray-800 shadow-2xl">
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-10 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                  <h3 className="text-3xl font-black text-white">Identity Hub</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Order ID / Shopify #</label>
                    <div className="relative group">
                      <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={24} />
                      <input
                        type="text"
                        value={formData.orderNumber}
                        onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 pl-16 pr-8 focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-xl font-bold text-white placeholder-gray-700"
                        placeholder="ORD-772"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Client Full Identity</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={24} />
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 pl-16 pr-8 focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all text-xl font-bold text-white placeholder-gray-700"
                        placeholder="Dr. Alex Rivera"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 glass p-12 rounded-[3.5rem] space-y-10 border border-gray-800 shadow-2xl">
                <h3 className="text-xl font-black text-yellow-500 flex items-center space-x-3">
                  <Star size={24} fill="currentColor" />
                  <span>Protocol</span>
                </h3>
                
                <div className="space-y-8">
                  <div className="flex p-2 bg-gray-950 rounded-2xl border-2 border-gray-800 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'simple', advancePaid: false})}
                      className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${formData.type === 'simple' ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}
                    >
                      SIMPLE
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, type: 'custom', advancePaid: true})}
                      className={`flex-1 py-4 rounded-xl text-xs font-black transition-all ${formData.type === 'custom' ? 'bg-purple-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}
                    >
                      CUSTOM
                    </button>
                  </div>

                  <div className="space-y-5">
                    <label className="flex items-center justify-between p-6 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 cursor-pointer hover:border-blue-500/30 transition-all group">
                      <div className="flex items-center space-x-4">
                        <div className={`p-4 rounded-xl transition-all ${formData.urgent ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-600'}`}>
                          <Star size={20} />
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase">Urgent</p>
                          <p className="text-[10px] text-gray-600 font-bold">EXPRESS LANE</p>
                        </div>
                      </div>
                      <input type="checkbox" checked={formData.urgent} onChange={(e) => setFormData({...formData, urgent: e.target.checked})} className="w-6 h-6 rounded-lg border-2 border-gray-700 bg-gray-900 checked:bg-blue-600 transition-all cursor-pointer" />
                    </label>

                    <label className={`flex items-center justify-between p-6 bg-gray-950 rounded-[1.5rem] border-2 ${formData.type === 'custom' ? 'border-emerald-500/30' : 'border-gray-800'} cursor-pointer hover:border-emerald-500/30 transition-all group`}>
                      <div className="flex items-center space-x-4">
                        <div className={`p-4 rounded-xl transition-all ${formData.advancePaid ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-800 text-gray-600'}`}>
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase text-emerald-400">Paid</p>
                          <p className="text-[10px] text-gray-600 font-bold">
                            {formData.type === 'custom' ? 'REQUIRED FOR CUSTOM' : 'READY TO CUT'}
                          </p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.advancePaid} 
                        onChange={(e) => {
                          if (formData.type === 'custom') return; // Can't uncheck for custom
                          setFormData({...formData, advancePaid: e.target.checked});
                        }} 
                        disabled={formData.type === 'custom'}
                        className="w-6 h-6 rounded-lg border-2 border-gray-700 bg-gray-900 checked:bg-emerald-600 transition-all cursor-pointer disabled:opacity-70" 
                      />
                    </label>
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
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-8">
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-white flex items-center space-x-4">
                      <Package className="text-blue-500" size={32} />
                      <span>Product Selection</span>
                    </h3>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest ml-12">Step 1: Choose category & style</p>
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
                          color: selectedItem?.color || formData.color
                        });
                      }}
                      sublabel={`Stock: ${item.stock}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 glass p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl">
                  <div className="space-y-1 mb-10">
                    <h3 className="text-2xl font-black text-emerald-400 flex items-center space-x-4">
                      <Layers size={28} />
                      <span>Material Selection</span>
                    </h3>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-11">Step 2: Define fabric feel</p>
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

                <div className="lg:col-span-7 glass p-12 rounded-[3.5rem] border border-gray-800 shadow-2xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-purple-400 flex items-center space-x-4">
                        <Palette size={28} />
                        <span>{isAccessory(selectedProductCategory) ? 'Color Selection' : 'Color & Standard Size'}</span>
                      </h3>
                      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest ml-11">Step 3: Visual scaling</p>
                    </div>
                    {!isAccessory(selectedProductCategory) && (
                      <div className="flex p-1.5 bg-gray-950 rounded-xl border-2 border-gray-800">
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
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'custom' && formData.type === 'custom' && (
            <motion.div
              key="custom"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-10"
            >
              <div className="glass p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl">
                <div className="flex items-center space-x-5">
                  <div className="p-4 bg-purple-600 rounded-[1.5rem] shadow-xl shadow-purple-900/30">
                    <ImageIcon className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Visual Branding</h3>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Logo & embroidery details</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Name Spelling</label>
                    <div className="relative group">
                      <Type className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors" size={24} />
                      <input
                        type="text"
                        value={formData.nameSpelling}
                        onChange={(e) => setFormData({...formData, nameSpelling: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-[1.5rem] py-6 pl-16 pr-8 focus:border-purple-500 focus:ring-8 focus:ring-purple-500/5 outline-none transition-all font-black text-xl text-white"
                        placeholder="DR. VALERIE KING"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Thread</label>
                      <select 
                        value={formData.nameColor}
                        onChange={(e) => setFormData({...formData, nameColor: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-8 focus:border-purple-500 outline-none font-bold text-gray-300 appearance-none shadow-inner"
                      >
                        <option value="">Standard White</option>
                        <option value="Gold">Metallic Gold</option>
                        <option value="Silver">Polished Silver</option>
                        <option value="Navy">Royal Navy</option>
                        <option value="Wine">Premium Wine</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] ml-2">Placement</label>
                      <select 
                        value={formData.logoPlacement}
                        onChange={(e) => setFormData({...formData, logoPlacement: e.target.value})}
                        className="w-full bg-gray-950 border-2 border-gray-800 rounded-2xl py-5 px-8 focus:border-purple-500 outline-none font-bold text-gray-300 appearance-none shadow-inner"
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

              <div className="glass p-12 rounded-[3.5rem] border border-gray-800 space-y-10 shadow-2xl">
                <div className="flex items-center space-x-5">
                  <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-900/30">
                    <Scissors className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Advanced Stitching</h3>
                    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-1">Conveyor belt tailoring specs</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Stitch Pattern</label>
                      <div className="flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 h-[72px]">
                        {['STD', 'DBL'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({...formData, stitchingStyle: s})}
                            className={`flex-1 rounded-xl text-[11px] font-black transition-all ${formData.stitchingStyle === s ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}
                          >
                            {s === 'STD' ? 'SINGLE' : 'DOUBLE'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Fit Profile</label>
                      <div className="flex p-2 bg-gray-950 rounded-[1.5rem] border-2 border-gray-800 h-[72px]">
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
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-2">Master Tailor Notes</label>
                    <textarea
                      value={formData.designNotes}
                      onChange={(e) => setFormData({...formData, designNotes: e.target.value})}
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-[2rem] py-6 px-8 focus:border-blue-500 outline-none h-36 resize-none text-sm font-medium text-gray-300 shadow-inner"
                      placeholder="Add special requests for the production floor..."
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sizes' && formData.type === 'custom' && (
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
                        <input type="number" step="0.1" value={formData.measurements.shoulder} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, shoulder: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Chest</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" value={formData.measurements.chest} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, chest: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-end">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Sleeve</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" value={formData.measurements.sleeve} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, sleeve: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Silhouette */}
                  <div className="hidden md:flex relative w-1/3 justify-center items-center min-h-[500px]">
                    <img src="/silhouette.png" alt="Tailor Silhouette" className="h-[550px] object-contain opacity-60 filter drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]" />
                    
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
                        <input type="number" step="0.1" value={formData.measurements.waist} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, waist: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Hips</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" value={formData.measurements.hips} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, hips: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                    <div className="group relative flex flex-col items-center md:items-start">
                      <label className="block text-[11px] font-black text-gray-500 uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Length</label>
                      <div className="relative flex items-end w-48 bg-gray-900/80 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                        <input type="number" step="0.1" value={formData.measurements.length} onChange={(e) => setFormData({...formData, measurements: {...formData.measurements, length: e.target.value}})} className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left" placeholder="00" />
                        <span className="absolute right-4 bottom-5 text-[10px] font-black text-emerald-500/50">IN</span>
                      </div>
                    </div>
                  </div>
                </div>

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

        <div className="flex flex-col sm:flex-row items-center justify-between pt-12 gap-8 border-t-2 border-gray-900">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3 text-gray-600 bg-gray-900/50 px-6 py-3 rounded-2xl border border-gray-800">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Validated System Protocol</span>
            </div>
            {error && (
              <div className="flex items-center space-x-3 text-red-500 bg-red-500/10 px-6 py-3 rounded-2xl border border-red-500/20">
                <AlertCircle size={16} />
                <span className="text-xs font-bold">{error}</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-6 w-full sm:w-auto">
            {activeTab !== 'basic' && (
              <button
                type="button"
                onClick={() => {
                  const currentIdx = filteredTabs.findIndex(t => t.id === activeTab);
                  setActiveTab(filteredTabs[currentIdx - 1].id);
                }}
                className="flex-1 sm:px-12 py-6 bg-gray-900 text-white rounded-[1.5rem] font-black text-sm border-2 border-gray-800 hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl"
              >
                BACK
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
                <span>NEXT STEP</span>
                <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || isSubmitting}
                className="flex-1 sm:px-24 py-6 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-blue-900/50 hover:scale-[1.03] hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
              >
                {loading || isSubmitting ? 'PROCESSING...' : (
                  <>
                    <ShoppingCart size={24} />
                    <span>FINALIZE & DEPLOY ORDER</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-12 inset-x-6 sm:left-auto sm:right-12 max-w-md bg-emerald-600 text-white p-8 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex items-center space-x-6 z-50 border-2 border-emerald-400/20 backdrop-blur-3xl"
        >
          <div className="bg-white/20 p-5 rounded-[1.5rem] shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <p className="font-black text-2xl tracking-tighter leading-none uppercase">Conveyor Synced!</p>
            <p className="text-[10px] font-black text-white/80 mt-2 uppercase tracking-[0.2em]">Queue: "ORDER_ENTRY" Floor</p>
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
