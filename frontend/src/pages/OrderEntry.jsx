import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, User, Star, ChevronRight, Hash, Image as ImageIcon, Type, Layout, Scissors, Ruler, Palette,
  Search, ShoppingCart, Plus, ArrowRight, ArrowLeft, Sparkles, AlertCircle, Trash2, Phone, List, Grid, X,
  FileEdit, Loader2, CheckCircle2
} from 'lucide-react';
import { PageLoader } from '../components/LoadingSpinner';
import { OrderEntryProvider, useOrderEntry } from '../context/OrderEntryContext';
import BasicInfoTab from '../components/BasicInfoTab';
import ProductSelectionTab from '../components/ProductSelectionTab';
import EngravingTab from '../components/EngravingTab';
import SizeChartTab from '../components/SizeChartTab';
import EditOrderComparison from '../components/EditOrderComparison';

const TAB_ICONS = { Layout, ShoppingCart, Scissors, Ruler };

const FinancialSummarySection = React.memo(({
  formData, setFormData, useUrdu,
  memoCartProductPriceExBranding, memoCartTotalLogoCharges, memoCartTotalNamePrinting,
  memoCartTotalCustomization, memoCartTotalCap, memoIsFreeDelivery, memoCalcDelivery,
  memoCartTotalItems
}) => {
  const calcProductPrice = memoCartProductPriceExBranding;
  const calcLogo = memoCartTotalLogoCharges;
  const calcName = memoCartTotalNamePrinting;
  const calcCustomization = memoCartTotalCustomization;
  const calcCap = memoCartTotalCap;
  const calcTotal = calcProductPrice + calcLogo + calcName + calcCustomization + calcCap + (memoIsFreeDelivery ? 0 : (memoCalcDelivery || 0));
  const adjProductPrice = parseFloat(formData.adjProductPrice) || calcProductPrice;
  const adjLogoCharges = parseFloat(formData.adjLogoCharges) || calcLogo;
  const adjNamePrinting = parseFloat(formData.adjNamePrinting) || calcName;
  const adjCustomization = parseFloat(formData.adjCustomization) || calcCustomization;
  const adjCap = parseFloat(formData.adjCapCharges) || calcCap;
  const adjDelivery = memoIsFreeDelivery ? 0 : (memoCalcDelivery || 0);
  const discount = parseFloat(formData.adjDiscount) || 0;
  const advanceAmt = parseFloat(formData.advanceAmount) || 0;
  const adjTotal = adjProductPrice + adjLogoCharges + adjNamePrinting + adjCustomization + adjCap + adjDelivery - discount;
  const remainingBalance = Math.max(0, adjTotal - advanceAmt);
  const INP_COLORS = {
    'emerald-400': 'text-emerald-400 focus:border-emerald-400',
    'amber-400': 'text-amber-400 focus:border-amber-400',
    'purple-400': 'text-purple-400 focus:border-purple-400',
    'cyan-400': 'text-cyan-400 focus:border-cyan-400',
    'rose-400': 'text-rose-400 focus:border-rose-400',
  };
  const handleChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  const inp = (name, calcVal, color = 'emerald-400') => (
    <input type="text" inputMode="decimal" value={formData[name] ?? ''} placeholder={String(calcVal)}
      onChange={e => handleChange(name, e.target.value)}
      className={`w-full text-right bg-gray-900/80 border border-gray-600/70 hover:border-gray-500 rounded-lg py-1.5 px-2 text-xs font-black ${INP_COLORS[color] || INP_COLORS['emerald-400']} outline-none transition-all cursor-text shadow-inner`} />
  );
  const fmt = (n) => n.toLocaleString();
  return (
    <div className="theme-bg border border-gray-800/50 rounded-[2rem] p-4 md:p-6">
      <h3 className="text-xs md:text-sm font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        ₨ {useUrdu ? 'مالی خلاصہ' : 'Financial Summary'} <span className="text-[8px] text-gray-500 tracking-[0.3em]">{useUrdu ? 'گنیتی / تبديل شدہ' : 'CALCULATED / ADJUSTED'}</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800/50">
              <th className="text-left text-gray-500 font-black uppercase tracking-wider py-1.5 pr-2">{useUrdu ? 'آئٹم' : 'Item'}</th>
              <th className="text-right text-gray-500 font-black uppercase tracking-wider py-1.5 px-2 w-20">{useUrdu ? 'گنیتی' : 'Calculated'}</th>
              <th className="text-right text-gray-500 font-black uppercase tracking-wider py-1.5 pl-2 w-20">{useUrdu ? 'تبدیل شدہ' : 'Adjusted'}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-800/30">
              <td className="text-gray-300 font-bold py-1.5 pr-2">{useUrdu ? 'پروڈکٹ کی قیمت' : 'Product Price'}</td>
              <td className="text-right text-gray-300 font-black py-1.5 px-2">₨{fmt(calcProductPrice)}</td>
              <td className="text-right py-1.5 pl-2">{inp('adjProductPrice', calcProductPrice)}</td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-amber-400 font-bold py-1.5 pr-2">{useUrdu ? 'لوگو چارجز' : 'Logo Charges'}</td>
              <td className="text-right text-amber-400 font-black py-1.5 px-2">₨{fmt(calcLogo)}</td>
              <td className="text-right py-1.5 pl-2">{inp('adjLogoCharges', calcLogo, 'amber-400')}</td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-purple-400 font-bold py-1.5 pr-2">{useUrdu ? 'نام چارجز' : 'Name Charges'}</td>
              <td className="text-right text-purple-400 font-black py-1.5 px-2">₨{fmt(calcName)}</td>
              <td className="text-right py-1.5 pl-2">{inp('adjNamePrinting', calcName, 'purple-400')}</td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-cyan-400 font-bold py-1.5 pr-2">{useUrdu ? 'کسٹمائزیشن' : 'Customization'}</td>
              <td className="text-right text-cyan-400 font-black py-1.5 px-2">₨{fmt(calcCustomization)}</td>
              <td className="text-right py-1.5 pl-2">{inp('adjCustomization', calcCustomization, 'cyan-400')}</td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-rose-400 font-bold py-1.5 pr-2">{useUrdu ? 'کیپ چارجز' : 'Cap Charges'}</td>
              <td className="text-right text-rose-400 font-black py-1.5 px-2">₨{fmt(calcCap)}</td>
              <td className="text-right py-1.5 pl-2">{inp('adjCapCharges', calcCap, 'rose-400')}</td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className={`font-bold py-1.5 pr-2 ${memoIsFreeDelivery ? 'text-emerald-400' : 'text-amber-400'}`}>
                {useUrdu ? 'ڈلیوری چارجز' : 'Delivery'} {memoIsFreeDelivery && <span className="text-[9px] tracking-widest text-emerald-500">(FREE)</span>}
              </td>
              <td className={`text-right font-black py-1.5 px-2 ${memoIsFreeDelivery ? 'text-emerald-500' : 'text-amber-400'}`}>
                {memoIsFreeDelivery ? 'FREE' : `₨${fmt(memoCalcDelivery || 0)}`}
              </td>
              <td className="text-right py-1.5 pl-2">
                <span className={`font-black text-xs ${memoIsFreeDelivery ? 'text-emerald-500' : 'text-amber-400'}`}>{memoIsFreeDelivery ? 'FREE' : `₨${fmt(memoCalcDelivery || 0)}`}</span>
              </td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-red-400 font-bold py-1.5 pr-2">{useUrdu ? 'رعایت' : 'Discount'}</td>
              <td className="text-right text-gray-500 font-black py-1.5 px-2">—</td>
              <td className="text-right py-1.5 pl-2">
                <input type="text" inputMode="decimal" value={formData.adjDiscount ?? ''} placeholder="0"
                  onChange={e => handleChange('adjDiscount', e.target.value)}
                  className="w-full text-right bg-gray-900/80 border border-red-500/50 hover:border-red-400 rounded-lg py-1.5 px-2 text-xs font-black text-red-400 focus:border-red-500 outline-none transition-all cursor-text shadow-inner" />
              </td>
            </tr>
            <tr className="border-b border-gray-800/30">
              <td className="text-gray-200 font-black text-sm py-2 pr-2">{useUrdu ? 'کل رقم' : 'Grand Total'}</td>
              <td className="text-right text-gray-200 font-black text-sm py-2 px-2">₨{fmt(calcTotal)}</td>
              <td className="text-right font-black text-white text-lg py-2 pl-2">₨{fmt(adjTotal)}</td>
            </tr>
            <tr>
              <td className="text-emerald-400 font-bold py-1.5 pr-2">{useUrdu ? 'پیشگی وصول' : 'Advance Received'}</td>
              <td className="text-right text-emerald-400 font-black py-1.5 px-2">{advanceAmt > 0 ? '✓ ' : ''}₨{fmt(advanceAmt)}</td>
              <td className="text-right text-emerald-400 font-black py-1.5 pl-2">{advanceAmt > 0 ? '✓ ' : ''}₨{fmt(advanceAmt)}</td>
            </tr>
            <tr>
              <td className="text-orange-400 font-black text-sm py-2 pr-2">{useUrdu ? 'باقی رقم' : 'Remaining Balance'}</td>
              <td className="text-right text-orange-400 font-black text-sm py-2 px-2">₨{fmt(Math.max(0, calcTotal - advanceAmt))}</td>
              <td className="text-right text-orange-400 font-black text-lg py-2 pl-2">₨{fmt(remainingBalance)}</td>
            </tr>
            <tr className="border-t-2 border-gray-700">
              <td className="text-red-400 font-black text-sm py-2 pr-2 uppercase">{useUrdu ? 'کیش آن ڈلیوری' : 'COD Amount'}</td>
              <td className="text-right text-red-400 font-black text-sm py-2 px-2">
                {formData.paymentStatus === 'PAID' ? '₨0' : `₨${fmt(remainingBalance)}`}
              </td>
              <td className="text-right text-red-400 font-black text-lg py-2 pl-2">
                {formData.paymentStatus === 'PAID' ? '₨0 (PAID)' : `₨${fmt(remainingBalance)}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-800/50">
        <span className="text-xs text-gray-400">{useUrdu ? 'کل آئٹمز' : 'Total Items'}</span>
        <span className="font-black theme-text-primary">{memoCartTotalItems}</span>
      </div>
    </div>
  );
});
FinancialSummarySection.displayName = 'FinancialSummarySection';

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('SectionErrorBoundary['+this.props.name+']:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 m-2"><p className="text-xs text-red-400 font-mono">Error in {this.props.name}: {this.state.error?.message}</p></div>;
    }
    return this.props.children;
  }
}

const SmartOrderForm = () => {
  const {
    activeTab, setActiveTab, dataLoading, loading, error, success, isSubmitting,
    formData, cartItems, isEditMode, isOutlet, useUrdu, user, LanguageToggle,
    showReview, setShowReview, showEditReview, showAddMore, showProductSelector, isCartOpen,
    editOrderNumber, setEditOrderNumber, editOrderLoading, editOrderError, editOrderData,
    originalOrder, editReason, setEditReason,
    memoCartTotalItems, memoCartTotalPrice, memoIsFreeDelivery, memoCalcDelivery,
    memoCartTotalLogoCharges, memoCartTotalNamePrinting, memoCartTotalCustomization,
    memoCartTotalCap, memoOrderTotalBeforeDelivery, memoCartProductPriceExBranding,
    toggleEditMode, fetchOrderByNumber, submitOrderEditRequest,
    validateCurrentTab, handleAddToCart, removeCartItem, editCartItem,
    handleAddMoreProducts, handleCheckout, setShowAddMore, setIsCartOpen, setShowProductSelector,
    setShowEditReview, setError, filteredTabs, setLoading, setIsSubmitting,
    goForVerification, setGoForVerification, fromVerification, setIsEditMode, setFromVerification,
    duplicateOrder, setDuplicateOrder, openDuplicateOrder, setFormData
  } = useOrderEntry();

  if (dataLoading) return <PageLoader text="Loading Order Entry..." />;

  return (
    <div className="max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-6">
        <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
          <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-2xl shadow-blue-900/40 rotate-3">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className={useUrdu ? 'text-right' : ''}>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight leading-none">{useUrdu ? 'سمارٹ آرڈر انٹری' : 'Smart Order Flow'}</h1>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-[0.3em] mt-1.5">{useUrdu ? 'پیداواری بہاؤ کی ذہانت' : 'Conveyor Belt Intelligence'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-4 ${useUrdu ? 'flex-row-reverse' : ''}`}>
          <LanguageToggle />
          {user?.role !== 'SUPER_ADMIN' && user?.role !== 'ADMIN' && (
            <button type="button" onClick={toggleEditMode}
              className={`flex items-center gap-2 px-5 py-3 ${isEditMode ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-white'} rounded-[1.2rem] font-black text-xs md:text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg whitespace-nowrap`}>
              <FileEdit size={14} />
              <span className="hidden sm:inline">{isEditMode ? (useUrdu ? 'ترمیم منسوخ کریں' : 'CANCEL EDIT') : (useUrdu ? 'آرڈر میں تبدیلی' : 'EDIT ORDER')}</span>
            </button>
          )}
          <div className="flex p-1.5 theme-bg backdrop-blur-3xl rounded-[1.8rem] border-2 theme-border shadow-2xl overflow-x-auto no-scrollbar">
            {(filteredTabs || []).map((tab) => {
              const Icon = TAB_ICONS[tab.icon] || Layout;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.2rem] text-xs md:text-sm font-black uppercase tracking-widest transition-all duration-500 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' : 'text-gray-600 hover:text-white hover:bg-gray-800/50'} ${useUrdu ? 'flex-row-reverse' : ''}`}>
                  <Icon size={16} className={activeTab === tab.id ? 'animate-pulse' : ''} />
                  <span className="hidden sm:inline">{(tab.label.split('. ')[1] || tab.label).toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {formData.productType && (
        <div className="theme-bg border-2 border-blue-500/20 rounded-[2rem] p-5 flex flex-wrap items-center gap-4 text-sm backdrop-blur-sm mb-6">
          <div className="flex items-center gap-3">
            <span className="text-blue-400 font-black text-base">Selected:</span>
            <span className="theme-text-primary font-black text-lg">{formData.productType}</span>
          </div>
          {formData.fabricType && <span className="theme-text-secondary font-bold text-sm">• {formData.fabricType}</span>}
          {formData.color && <span className="theme-text-secondary font-bold text-sm">• {formData.color}</span>}
          {formData.size && <span className="theme-text-secondary font-bold text-sm">• Size {formData.size}</span>}
          <span className="theme-text-muted font-bold text-sm">• Qty: {formData.quantity}</span>
          {cartItems.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white px-5 py-2 rounded-full font-black text-xs">Cart: {cartItems.length} item{cartItems.length > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {fromVerification && !originalOrder && (
        <div className="mb-6 glass border-2 border-emerald-500/30 rounded-[2rem] p-10 bg-emerald-500/5 text-center">
          <div className="flex flex-col items-center gap-4">
            {editOrderError ? (
              <>
                <AlertCircle size={40} className="text-red-400" />
                <div>
                  <h3 className="text-lg md:text-xl font-black text-red-400 uppercase tracking-wider">Failed to Load Order</h3>
                  <p className="text-gray-400 text-sm font-bold mt-2">{editOrderError}</p>
                </div>
              </>
            ) : (
              <>
                <Loader2 size={40} className="text-emerald-400 animate-spin" />
                <div>
                  <h3 className="text-lg md:text-xl font-black text-emerald-400 uppercase tracking-wider">Loading Order...</h3>
                  <p className="text-gray-400 text-sm font-bold mt-2">Please wait while the complete order is being loaded.</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isEditMode && !originalOrder && !fromVerification && (
        <div className="mb-6 glass border-2 border-amber-500/30 rounded-[2rem] p-6 md:p-8 bg-amber-500/5 relative overflow-hidden backdrop-blur-md shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl animate-pulse"><FileEdit size={24} /></div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-amber-400 uppercase tracking-wider">{useUrdu ? 'ترمیم کا طریقہ کار فعال ہے' : 'Edit Request Mode Active'}</h3>
                <p className="theme-text-muted text-xs font-bold mt-1">{useUrdu ? 'کسی بھی فعال آرڈر میں تبدیلی کی درخواست پیش کرنے کے لیے نیچے آرڈر نمبر درج کریں۔' : 'Enter an order number below to load the complete Job Sheet for comparison editing.'}</p>
              </div>
            </div>
            <button type="button" onClick={toggleEditMode}
              className="px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap">
              {useUrdu ? 'منسوخ کریں' : 'Cancel Edit Mode'}
            </button>
          </div>
          <div className="mt-6 border-t border-amber-500/20 pt-6">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-black text-amber-400 uppercase tracking-widest ml-2">{useUrdu ? 'آرڈر نمبر درج کریں' : 'Enter Order Number'}</label>
                <div className="relative group">
                  <Hash className="absolute left-6 top-1/2 -translate-y-1/2 text-amber-500/50 group-focus-within:text-amber-400 transition-colors" size={16} />
                  <input type="text" value={editOrderNumber} onChange={(e) => setEditOrderNumber(e.target.value)}
                    placeholder="e.g. JT-836194"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchOrderByNumber(); } }}
                    className="w-full theme-input rounded-[1.5rem] py-5 pl-16 pr-6 border-amber-500/20 focus:border-amber-400 text-lg font-black tracking-wider shadow-inner text-amber-400 placeholder-amber-500/30" />
                </div>
              </div>
              <button type="button" disabled={editOrderLoading} onClick={() => fetchOrderByNumber()}
                className="px-8 py-5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-[1.5rem] hover:bg-amber-400 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 min-w-[150px] active:scale-95">
                {editOrderLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {useUrdu ? 'آرڈر تلاش کریں' : 'Fetch Order'}
              </button>
            </div>
            {editOrderError && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fadeIn">
                <AlertCircle size={16} className="shrink-0" /><span>{editOrderError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {fromVerification && originalOrder && (
        <div className="space-y-6">
          <div className="glass border-2 border-emerald-500/30 rounded-[2rem] p-4 md:p-6 bg-emerald-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl animate-pulse"><ArrowLeft size={20} /></div>
              <div>
                <h3 className="text-base md:text-lg font-black text-emerald-400 uppercase tracking-wider">Return from Verification — #{originalOrder.orderNumber}</h3>
                <p className="theme-text-muted text-xs font-bold">{originalOrder.customerName}</p>
                {originalOrder.verificationReturnNote && (
                  <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <p className="text-[10px] font-black text-amber-400 uppercase">Changes Requested by Verifier</p>
                    <p className="text-xs text-amber-300 mt-0.5 whitespace-pre-wrap">{originalOrder.verificationReturnNote}</p>
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={() => { setIsEditMode(false); setFromVerification(false); }}
              className="px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap">
              {useUrdu ? 'منسوخ کریں' : 'Cancel'}
            </button>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'basic' && <BasicInfoTab key="basic" />}
            {activeTab === 'product' && <ProductSelectionTab key="product" />}
            {activeTab === 'custom' && <EngravingTab key="custom" />}
            {activeTab === 'sizes' && <SizeChartTab key="sizes" />}
          </AnimatePresence>
          <div className={`flex flex-col sm:flex-row items-center justify-between pt-6 md:pt-12 gap-4 md:gap-8 border-t-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="flex flex-col space-y-4">
              <div className={`flex items-center space-x-3 text-gray-600 theme-bg-subtle px-6 py-3 rounded-2xl border theme-border ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
                <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em]">{useUrdu ? 'تصدیق شدہ نظام' : 'Validated System Protocol'}</span>
              </div>
              {error && (
                <div className={`flex items-center space-x-3 text-red-500 bg-red-500/10 px-6 py-3 rounded-2xl border border-red-500/20 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <AlertCircle size={16} /><span className="text-xs font-bold">{error}</span>
                </div>
              )}
            </div>
            <div className={`flex space-x-6 w-full sm:w-auto ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {activeTab !== 'basic' && (
                <button type="button" onClick={() => { const ci = filteredTabs.findIndex(t => t.id === activeTab); setActiveTab(filteredTabs[ci - 1].id); }}
                  className="flex-1 sm:px-12 py-6 theme-bg theme-text-primary rounded-[1.5rem] font-black text-sm border-2 theme-border hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl">
                  {useUrdu ? 'پیچھے' : 'BACK'}
                </button>
              )}
              {activeTab !== filteredTabs[filteredTabs.length - 1].id && (
                <button type="button"
                  onClick={() => { const err = validateCurrentTab(); if (err) { setError(err); return; } const ci = filteredTabs.findIndex(t => t.id === activeTab); setActiveTab(filteredTabs[ci + 1].id); }}
                  className="flex-1 sm:px-16 py-6 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group">
                  <span className={useUrdu ? "order-2" : "order-1"}>{useUrdu ? 'اگلا مرحلہ' : 'NEXT'}</span>
                  <ArrowRight size={22} className={`transition-transform ${useUrdu ? 'order-1 rotate-180 group-hover:-translate-x-2' : 'order-2 group-hover:translate-x-2'}`} />
                </button>
              )}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && (
                <button type="button" onClick={handleAddToCart} disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 theme-bg text-blue-400 border-2 border-blue-500/50 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50">
                  {loading || isSubmitting ? (useUrdu ? 'انتظار کریں...' : 'PROCESSING...') : (
                    <><Plus size={16} className={useUrdu ? "order-2" : "order-1"} /><span className={useUrdu ? "order-1" : "order-2"}>{useUrdu ? 'کارٹ میں شامل کریں' : 'ADD ITEM TO CART'}</span></>
                  )}
                </button>
              )}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && cartItems.length > 0 && (
                <button type="button" onClick={() => setShowReview(true)} disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group disabled:opacity-50">
                  <CheckCircle2 size={16} /><span>{fromVerification ? (useUrdu ? 'اسٹور کو دوبارہ جمع کریں' : 'RESUBMIT TO STORE') : (useUrdu ? 'آرڈر چیک آؤٹ کریں' : 'CHECKOUT')}</span>
                </button>
              )}
            </div>
          </div>
      </form>
        </div>
      )}

      {isEditMode && originalOrder && !fromVerification && (
        <div className="space-y-6">
          <div className="glass border-2 border-amber-500/30 rounded-[2rem] p-4 md:p-6 bg-amber-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl animate-pulse"><FileEdit size={20} /></div>
              <div>
                <h3 className="text-base md:text-lg font-black text-amber-400 uppercase tracking-wider">Editing Order #{originalOrder.orderNumber}</h3>
                <p className="theme-text-muted text-xs font-bold">{originalOrder.customerName} — {originalOrder.outletName || 'ONLINE ORDER'}</p>
              </div>
            </div>
            <button type="button" onClick={toggleEditMode}
              className="px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-[1.2rem] font-black text-xs uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap">
              {useUrdu ? 'منسوخ کریں' : 'Cancel Edit'}
            </button>
          </div>
          <EditOrderComparison
            order={originalOrder}
            onSubmit={submitOrderEditRequest}
            onCancel={toggleEditMode}
            isSubmitting={isSubmitting || loading}
            useUrdu={useUrdu}
          />
        </div>
      )}

      {!isEditMode && !fromVerification && (
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {duplicateOrder && (
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-red-500/10 border-2 border-red-500/30 rounded-[1.5rem] px-6 py-4 ${useUrdu ? 'text-right' : ''}`}>
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle size={18} className="shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider">
                  {useUrdu ? `آرڈر نمبر ${duplicateOrder} پہلے سے موجود ہے` : `Order #${duplicateOrder} already exists`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={openDuplicateOrder}
                  className="px-4 py-2 bg-amber-500 text-black rounded-xl font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-all active:scale-95">
                  {useUrdu ? 'موجودہ آرڈر کھولیں' : 'OPEN EXISTING ORDER'}
                </button>
                <button type="button" onClick={() => setDuplicateOrder(null)}
                  className="px-3 py-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95">
                  {useUrdu ? 'بند کریں' : 'DISMISS'}
                </button>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {activeTab === 'basic' && <BasicInfoTab key="basic" />}
            {activeTab === 'product' && <ProductSelectionTab key="product" />}
            {activeTab === 'custom' && <EngravingTab key="custom" />}
            {activeTab === 'sizes' && <SizeChartTab key="sizes" />}
          </AnimatePresence>

          <div className={`flex flex-col sm:flex-row items-center justify-between pt-6 md:pt-12 gap-4 md:gap-8 border-t-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="flex flex-col space-y-4">
              <div className={`flex items-center space-x-3 text-gray-600 theme-bg-subtle px-6 py-3 rounded-2xl border theme-border ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse" />
                <span className="text-xs md:text-sm font-black uppercase tracking-[0.2em]">{useUrdu ? 'تصدیق شدہ نظام' : 'Validated System Protocol'}</span>
              </div>
              {error && (
                <div className={`flex items-center space-x-3 text-red-500 bg-red-500/10 px-6 py-3 rounded-2xl border border-red-500/20 ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <AlertCircle size={16} /><span className="text-xs font-bold">{error}</span>
                </div>
              )}
            </div>
            <div className={`flex space-x-6 w-full sm:w-auto ${useUrdu ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {activeTab !== 'basic' && (
                <button type="button" onClick={() => { const ci = filteredTabs.findIndex(t => t.id === activeTab); setActiveTab(filteredTabs[ci - 1].id); }}
                  className="flex-1 sm:px-12 py-6 theme-bg theme-text-primary rounded-[1.5rem] font-black text-sm border-2 theme-border hover:bg-gray-800 hover:border-gray-700 transition-all active:scale-95 shadow-xl">
                  {useUrdu ? 'پیچھے' : 'BACK'}
                </button>
              )}
              {activeTab !== filteredTabs[filteredTabs.length - 1].id && (
                <button type="button"
                  onClick={() => { const err = validateCurrentTab(); if (err) { setError(err); return; } const ci = filteredTabs.findIndex(t => t.id === activeTab); setActiveTab(filteredTabs[ci + 1].id); }}
                  className="flex-1 sm:px-16 py-6 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group">
                  <span className={useUrdu ? "order-2" : "order-1"}>{useUrdu ? 'اگلا مرحلہ' : 'NEXT'}</span>
                  <ArrowRight size={22} className={`transition-transform ${useUrdu ? 'order-1 rotate-180 group-hover:-translate-x-2' : 'order-2 group-hover:translate-x-2'}`} />
                </button>
              )}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && (
                <button type="button" onClick={handleAddToCart} disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 theme-bg text-blue-400 border-2 border-blue-500/50 rounded-[1.5rem] font-black text-sm shadow-2xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 flex items-center justify-center space-x-4 disabled:opacity-50">
                  {loading || isSubmitting ? (useUrdu ? 'انتظار کریں...' : 'PROCESSING...') : (
                    <><Plus size={16} className={useUrdu ? "order-2" : "order-1"} /><span className={useUrdu ? "order-1" : "order-2"}>{useUrdu ? 'کارٹ میں شامل کریں' : 'ADD ITEM TO CART'}</span></>
                  )}
                </button>
              )}
              {activeTab === filteredTabs[filteredTabs.length - 1].id && cartItems.length > 0 && (
                <button type="button" onClick={() => setShowReview(true)} disabled={loading || isSubmitting}
                  className="flex-1 sm:px-16 py-6 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm shadow-2xl hover:translate-y-[-4px] transition-all active:scale-95 flex items-center justify-center space-x-4 group disabled:opacity-50">
                  <CheckCircle2 size={16} /><span>{fromVerification ? (useUrdu ? 'اسٹور کو دوبارہ جمع کریں' : 'RESUBMIT TO STORE') : (useUrdu ? 'آرڈر چیک آؤٹ کریں' : 'CHECKOUT')}</span>
                </button>
              )}
            </div>
          </div>
      </form>
      )}

      <AnimatePresence>
        {showAddMore && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-md w-full p-10 rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] text-center">
              <div className="bg-emerald-500/10 p-6 rounded-[2rem] inline-block mb-6"><CheckCircle2 size={48} className="text-emerald-400" /></div>
              <h2 className="text-2xl font-black theme-text-primary uppercase tracking-tight mb-2">{useUrdu ? 'پروڈکٹ کارٹ میں شامل ہو گئی!' : 'Added to Cart!'}</h2>
              <p className="theme-text-muted text-xs font-bold uppercase tracking-widest mb-8">{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in cart</p>
              <div className="space-y-4">
                <button onClick={handleAddMoreProducts}
                  className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-900/50 hover:bg-blue-500 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3">
                  <Plus size={16} /><span>{useUrdu ? 'دوسری پروڈکٹ شامل کریں' : 'ADD ANOTHER PRODUCT'}</span>
                </button>
                <button onClick={() => { setShowAddMore(false); setShowReview(true); }}
                  className="w-full py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3">
                  <CheckCircle2 size={16} /><span>{fromVerification ? 'RESUBMIT TO STORE' : isEditMode ? 'SUBMIT EDIT REQUEST' : 'CHECKOUT'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {(
        <>
          <AnimatePresence>
            {(cartItems || []).length > 0 && !isCartOpen && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setIsCartOpen(true)}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-blue-600 text-white p-4 rounded-full shadow-[0_10px_30px_rgba(37,99,235,0.4)] z-50 flex items-center justify-center border-2 border-blue-400/30 backdrop-blur-md">
                <div className="relative">
                  <ShoppingCart size={28} />
                  <span className="absolute -top-3 -right-3 bg-pink-500 text-white text-xs md:text-sm font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-gray-900 shadow-lg">{(cartItems || []).length}</span>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {(cartItems || []).length > 0 && isCartOpen && (
              <motion.div initial={{ y: 150, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 150, opacity: 0, scale: 0.9 }}
                className="fixed bottom-4 right-4 left-4 md:left-auto md:bottom-8 md:right-8 theme-bg backdrop-blur-3xl border-2 theme-border p-6 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-50 md:w-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500/20 p-2.5 rounded-2xl"><ShoppingCart className="text-blue-500" size={16} /></div>
                    <h3 className="text-xl font-black theme-text-primary tracking-tight">Your Cart</h3>
                    <span className="bg-gray-800 text-gray-300 text-xs md:text-sm font-black px-3 py-1.5 rounded-full ml-2">{(cartItems || []).length} Items</span>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="theme-text-muted hover:text-white hover:bg-gray-800 p-2 rounded-full transition-all active:scale-95"><X size={16} /></button>
                </div>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scrollbar mb-6">
                  {(cartItems || []).map((item, idx) => (
                    <div key={idx} className="theme-bg-subtle p-4 rounded-2xl flex justify-between items-center border theme-border hover:border-gray-700 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-black theme-text-primary truncate">{item.productDetails?.productType || 'Custom Item'}</p>
                        <p className="text-xs md:text-sm theme-text-muted font-bold uppercase mt-1 truncate">{item.quantity}x • {item.productDetails?.size || 'Custom'} • {item.productDetails?.color}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {item.quantity > 1 && item.totalPrice > 0 && <p className="text-xs theme-text-muted font-bold">₨{Number(item.totalPrice / item.quantity).toLocaleString()} × {item.quantity}</p>}
                        <p className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">₨{Number(item.totalPrice).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setIsCartOpen(false); fromVerification ? submitOrderEditRequest() : isEditMode ? submitOrderEditRequest() : handleCheckout(); }} disabled={loading || isSubmitting}
                  className="w-full py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/40 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center space-x-3 disabled:opacity-50">
                  <CheckCircle2 size={16} /><span>{loading || isSubmitting ? (useUrdu ? 'جمع کر رہا ہے...' : 'SUBMITTING...') : fromVerification ? (useUrdu ? 'اسٹور کو دوبارہ جمع کریں' : 'Resubmit to Store') : isEditMode ? (useUrdu ? 'ترمیم کی درخواست جمع کریں' : 'Submit Edit Request') : (useUrdu ? 'آرڈر چیک آؤٹ کریں' : 'Checkout Order')}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {success && (
        <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-32 md:bottom-12 inset-x-6 sm:left-auto sm:right-12 max-w-md bg-emerald-600 text-white p-8 rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex items-center space-x-6 z-50 border-2 border-emerald-400/20 backdrop-blur-3xl ${useUrdu ? 'flex-row-reverse space-x-reverse text-right' : ''}`}>
          <div className="bg-white/20 p-5 rounded-[1.5rem] shadow-inner"><CheckCircle2 size={40} /></div>
          <div>
            <p className="font-black text-2xl tracking-tighter leading-none uppercase">{useUrdu ? 'آرڈر درج ہوگیا!' : 'Order Placed!'}</p>
            <p className="text-xs md:text-sm font-black text-white/80 mt-2 uppercase tracking-[0.2em]">{useUrdu ? 'پیداواری لائن میں شامل کر دیا گیا' : 'Synced with Production Floor'}</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showReview && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="glass max-w-3xl w-full p-6 md:p-10 rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] shadow-xl"><List className="text-white" size={24} /></div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight">{useUrdu ? 'آرڈر کا جائزہ' : 'Order Review & Summary'}</h2>
                  <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">{useUrdu ? 'جمع کرانے سے پہلے تصدیق کریں' : 'Please verify before submitting'}</p>
                </div>
              </div>
              <div className="space-y-6 mb-8">
                {(formData.orderNumber || cartItems[0]?.orderNumber) && (
                  <div className="theme-bg border border-blue-500/20 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'آرڈر نمبر' : 'Order No.'}</span><span className="theme-text-primary font-black">{formData.orderNumber || cartItems[0]?.orderNumber}</span></div>
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'صارف' : 'Customer'}</span><span className="theme-text-primary font-black">{formData.customerName || cartItems[0]?.customerName}</span></div>
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'فون' : 'Phone'}</span><span className="theme-text-primary">{formData.customerPhone || cartItems[0]?.customerPhone}</span></div>
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'شہر' : 'City'}</span><span className="theme-text-primary">{formData.city || cartItems[0]?.city || '-'}</span></div>
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'قسم' : 'Type'}</span><span className="theme-text-primary font-black uppercase">{formData.type || cartItems[0]?.type}</span></div>
                    <div><span className="text-blue-400 font-black text-xs uppercase tracking-widest block mb-1">{useUrdu ? 'ترجیح' : 'Priority'}</span><span className={`font-black uppercase ${formData.priority === 'RUSH' ? 'text-red-400' : formData.priority === 'URGENT' ? 'text-amber-400' : 'theme-text-primary'}`}>{formData.priority || cartItems[0]?.priority}</span></div>
                  </div>
                )}
                {/* Products Section */}
                {(cartItems || []).length > 0 && (
                  <SectionErrorBoundary name="review-products">
                  <div className="theme-bg border border-purple-500/20 rounded-2xl p-5">
                    <h3 className="text-xs md:text-sm font-black text-purple-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <ShoppingCart size={12} /> {useUrdu ? 'پروڈکٹس' : 'Products'} ({(cartItems || []).length})
                    </h3>
                    <div className="space-y-3">
                      {(cartItems || []).map((item, idx) => {
                        const pd = item.productDetails || {};
                        const cust = item.customization || {};
                        const hasCust = cust.nameSpelling || cust.designNotes || item.logoName || item.logoDesign || cust.logos || cust.engravingType;
                        return (
                          <div key={idx} className="bg-gray-900/50 rounded-xl border border-gray-800/70 p-3 md:p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-gray-500">#{idx + 1}</span>
                                  <span className="text-sm font-black text-white uppercase truncate">{pd.productType || '\u2014'}</span>
                                  {pd.gender && <span className="text-[9px] font-black text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{pd.gender}</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span className="text-xs text-gray-300 uppercase font-bold">{pd.color || '\u2014'} / {pd.size || '\u2014'}</span>
                                  {pd.fabricType && <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{pd.fabricType}</span>}
                                  {pd.sleeveLength && <span className="text-xs font-black text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded">{pd.sleeveLength === 'full' ? 'Full' : pd.sleeveLength === 'half' ? 'Half' : pd.sleeveLength === 'three-quarter' ? '3 Quarter' : 'Quarter'}</span>}
                                  {pd.shirtLength && <span className="text-xs font-black text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded">{pd.shirtLength === 'long' ? 'Long' : pd.shirtLength === 'short' ? 'Short' : 'Regular'}</span>}
                                  {item.capCharges > 0 && <span className="text-xs font-black text-rose-400">x{pd.matchingCapQty || 0} Matching Cap</span>}
                                  {pd.alteration && (pd.alteration.trouserLength || pd.alteration.shirtLength || pd.alteration.sleeveLength) && (
                                    <span className="text-xs font-black text-amber-400 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                      Alt: {[pd.alteration.trouserLength && `Trouser ${pd.alteration.trouserLength}"`, pd.alteration.shirtLength && `Shirt ${pd.alteration.shirtLength}"`, pd.alteration.sleeveLength && `Sleeve ${pd.alteration.sleeveLength}"`].filter(Boolean).join(' ')}
                                    </span>
                                  )}
                                  <span className="text-xs md:text-sm font-black text-blue-400">x{item.quantity || 1}</span>
                                </div>
                                {(pd.fabricSourceProduct || pd.colorSourceProduct || pd.designSourceProduct || pd.sizeSourceProduct || pd.additionalProductRef) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {pd.fabricSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Fabric: {pd.fabricSourceProduct}</span>}
                                    {pd.colorSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Color: {pd.colorSourceProduct}</span>}
                                    {pd.designSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Design: {pd.designSourceProduct}</span>}
                                    {pd.sizeSourceProduct && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Size: {pd.sizeSourceProduct}</span>}
                                    {pd.additionalProductRef && <span className="text-[9px] font-black text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded border border-amber-500/20">Extra: {pd.additionalProductRef}</span>}
                                  </div>
                                )}
                                {(item.logoCharges > 0 || item.namePrintingCharges > 0 || item.customizationPrice > 0) && (
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {item.logoCharges > 0 && <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Logo Fee: Rs{item.logoCharges}</span>}
                                    {item.namePrintingCharges > 0 && <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">Name Charges: Rs{item.namePrintingCharges}</span>}
                                    {item.customizationPrice > 0 && <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">Custom Fee: Rs{item.customizationPrice}</span>}
                                  </div>
                                )}
                                {hasCust && (
                                  <div className="mt-2 space-y-2">
                                    {(cust.articleNames?.length > 0 || cust.nameSpelling) && (
                                      <div className="bg-purple-500/5 rounded-lg p-2 border border-purple-500/10">
                                        <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest mb-1">Name Lines</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {Array.isArray(cust.articleNames) && cust.articleNames.length > 0 ? (
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
                                    {(cust.nameColor || cust.logoColor || cust.logoPlacement || cust.engravingType) && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {cust.engravingType && <span className="text-[10px] font-black text-violet-400 bg-violet-900/30 px-2 py-0.5 rounded border border-violet-500/20">{cust.engravingType === 'direct' ? 'Direct Engraving' : 'Patch Engraving'}</span>}
                                        {cust.nameColor && <span className="text-[10px] font-black text-rose-400 bg-rose-900/30 px-2 py-0.5 rounded border border-rose-500/20">Color: {cust.nameColor}</span>}
                                        {cust.logoColor && <span className="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Logo: {cust.logoColor}</span>}
                                        {cust.logoPlacement && <span className="text-[10px] font-black text-teal-400 bg-teal-900/30 px-2 py-0.5 rounded border border-teal-500/20">Position: {cust.logoPlacement}</span>}
                                        {item.logoName && <span className="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">Logo: {item.logoName}</span>}
                                      </div>
                                    )}
                                    {Array.isArray(cust.logos) && cust.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {(cust.logos || []).filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).map((l, li) => (
                                          <span key={li} className="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">{l.name || l.design}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {item.sizeData && Object.keys(item.sizeData).length > 0 && (
                                  <div className="mt-2 bg-gray-900/50 rounded-lg p-2 border border-gray-800/50">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Measurements</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Object.entries(item.sizeData).filter(([k, v]) => v && k !== 'specialNote').map(([k, v]) => (
                                        <span key={k} className="text-[10px] font-black text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">{k}: {v}</span>
                                      ))}
                                    </div>
                                    {item.sizeData.specialNote && (
                                      <p className="text-[10px] text-yellow-400 font-black mt-1 italic">Note: {item.sizeData.specialNote}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                                {item.quantity > 1 && item.totalPrice > 0 && (
                                  <p className="text-xs theme-text-muted font-bold">Rs{Number(item.totalPrice / item.quantity).toLocaleString()} x {item.quantity}</p>
                                )}
                                <p className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">Rs{Number(item.totalPrice).toLocaleString()}</p>
                                <div className="flex gap-1 mt-1">
                                  <button type="button" onClick={() => editCartItem(idx, 'product')}
                                    className="text-[9px] font-black text-blue-400 bg-blue-500/10 hover:bg-blue-500 hover:text-white px-2 py-1 rounded-lg uppercase tracking-wider transition-all active:scale-95">
                                    {useUrdu ? 'ترمیم' : 'Edit'}
                                  </button>
                                  <button type="button" onClick={() => removeCartItem(idx)}
                                    className="text-[9px] font-black text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white px-2 py-1 rounded-lg uppercase tracking-wider transition-all active:scale-95">
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <button type="button" onClick={handleAddMoreProducts}
                        className="w-full py-3 border-2 border-dashed border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Plus size={14} /> {useUrdu ? 'دوسری پروڈکٹ شامل کریں' : 'ADD ANOTHER PRODUCT'}
                      </button>
                    </div>
                  </div>
                  </SectionErrorBoundary>
                )}
                <FinancialSummarySection
                  formData={formData} setFormData={setFormData} useUrdu={useUrdu}
                  memoCartProductPriceExBranding={memoCartProductPriceExBranding}
                  memoCartTotalLogoCharges={memoCartTotalLogoCharges}
                  memoCartTotalNamePrinting={memoCartTotalNamePrinting}
                  memoCartTotalCustomization={memoCartTotalCustomization}
                  memoCartTotalCap={memoCartTotalCap}
                  memoIsFreeDelivery={memoIsFreeDelivery}
                  memoCalcDelivery={memoCalcDelivery}
                  memoCartTotalItems={memoCartTotalItems}
                />
              </div>
              <div className="bg-gray-800/50 rounded-2xl p-4 mb-4 border border-amber-500/20">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={goForVerification} onChange={e => setGoForVerification(e.target.checked)}
                    className="accent-amber-500 w-5 h-5" />
                  <div>
                    <span className="text-sm font-black text-amber-400">Go for Verification</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">Send to Inventory View for payment verification before Store allocation</p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowReview(false)}
                  className="flex-1 py-5 bg-gray-800 text-gray-400 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-gray-700 transition-all active:scale-95 border border-gray-700">
                  {useUrdu ? 'ترمیم کریں' : 'EDIT'}
                </button>
                <button onClick={() => { setShowReview(false); fromVerification ? submitOrderEditRequest() : handleCheckout(); }} disabled={loading || isSubmitting}
                  className="flex-1 py-5 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-900/50 hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
                  <CheckCircle2 size={16} />
                  <span>{loading || isSubmitting ? (useUrdu ? 'جمع کر رہا ہے...' : 'SUBMITTING...') : fromVerification ? (useUrdu ? 'اسٹور کو دوبارہ جمع کریں' : 'RESUBMIT TO STORE') : goForVerification ? (useUrdu ? 'تصدیق کو بھیجیں' : 'SEND FOR VERIFICATION') : (useUrdu ? 'تصدیق کریں' : 'CONFIRM & SUBMIT')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const OrderEntryWrapper = () => (
  <OrderEntryProvider>
    <SmartOrderForm />
  </OrderEntryProvider>
);

export default OrderEntryWrapper;
