import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hash, User, Phone, Star, Layout } from 'lucide-react';
import { useOrderEntry } from '../context/OrderEntryContext';

const BasicInfoTab = () => {
  const {
    formData, setFormData, t, useUrdu, isOutlet, isEditMode,
    memoCartTotalItems, memoCartTotalPrice, memoIsFreeDelivery,
    preventEnterSubmit, dateInputRef, fmtDate, parseDate, cartItems,
    requiredErrors, setRequiredErrors
  } = useOrderEntry();

  const [shopifyInput, setShopifyInput] = useState(() => fmtDate(formData.shopifyOrderDate));

  useEffect(() => {
    setShopifyInput(fmtDate(formData.shopifyOrderDate));
  }, [formData.shopifyOrderDate, fmtDate]);

  const clearFieldError = (field) => setRequiredErrors(prev => {
    if (!prev || !prev[field]) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });

  const errStyle = (err) => err ? { borderColor: 'rgba(239,68,68,0.7)', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' } : undefined;

  return (
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
            <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ml-4">Order No. <span className="text-red-500">*</span></label>
            <div className="relative group">
              <Hash className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={16} />
              <input type="text" inputMode="numeric" onKeyDown={preventEnterSubmit} value={formData.orderNumber}
                onChange={(e) => { setFormData({ ...formData, orderNumber: e.target.value.replace(/\D/g, '') }); clearFieldError('orderNumber'); }}
                style={errStyle(requiredErrors?.orderNumber)}
                className={`w-full theme-input rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} transition-all text-2xl font-black shadow-inner`}
                placeholder="772" required />
            </div>
            {requiredErrors?.orderNumber && <p className="mt-1 text-xs font-black text-red-400 ml-4">{requiredErrors.orderNumber}</p>}
          </div>
          <div className="space-y-4">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerName')} <span className="text-red-500">*</span></label>
            <div className="relative group">
              <User className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-all duration-300`} size={16} />
              <input type="text" onKeyDown={preventEnterSubmit} value={formData.customerName}
                onChange={(e) => { setFormData({ ...formData, customerName: e.target.value }); clearFieldError('customerName'); }}
                style={errStyle(requiredErrors?.customerName)}
                className={`w-full theme-input rounded-[2rem] py-7 ${useUrdu ? 'pr-20 pl-10 text-right' : 'pl-20 pr-10'} transition-all text-2xl font-black shadow-inner`}
                placeholder={useUrdu ? 'کسٹمر کا نام' : "Dr. Alex Rivera"} required />
            </div>
            {requiredErrors?.customerName && <p className="mt-1 text-xs font-black text-red-400 ml-4">{requiredErrors.customerName}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{t('customerPhone')} <span className="text-red-500">*</span></label>
            <div className="relative group">
              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/10 text-pink-500`}>
                <Phone size={18} />
              </div>
              <input type="tel" onKeyDown={preventEnterSubmit} value={formData.customerPhone}
                onChange={(e) => { setFormData({ ...formData, customerPhone: e.target.value }); clearFieldError('customerPhone'); }}
                style={errStyle(requiredErrors?.customerPhone)}
                className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                placeholder="0300-1234567" required />
            </div>
            {requiredErrors?.customerPhone && <p className="mt-1 text-xs font-black text-red-400 ml-4">{requiredErrors.customerPhone}</p>}
          </div>
          <div className="space-y-4">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'پتہ (Address)' : 'Customer Address'} <span className="text-red-500">*</span></label>
            <div className="relative group">
              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500`}>
                <span className="font-black text-xs">📍</span>
              </div>
              <input type="text" onKeyDown={preventEnterSubmit} value={formData.address}
                onChange={(e) => { setFormData({ ...formData, address: e.target.value }); clearFieldError('address'); }}
                style={errStyle(requiredErrors?.address)}
                className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                placeholder={useUrdu ? 'گھر کا پتہ' : "House #123, Street #4"} required />
            </div>
            {requiredErrors?.address && <p className="mt-1 text-xs font-black text-red-400 ml-4">{requiredErrors.address}</p>}
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
              <input type="checkbox" checked={formData.paymentStatus === 'PAID'}
                onChange={e => setFormData({ ...formData, paymentStatus: e.target.checked ? 'PAID' : 'PENDING' })}
                className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-900 checked:bg-emerald-600 checked:border-emerald-600 transition-all cursor-pointer" />
            </label>
          </div>
          <div className="space-y-4">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'شہر (City)' : 'City'} <span className="text-red-500">*</span></label>
            <div className="relative group">
              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500`}>
                <span className="font-black text-xs">🏙️</span>
              </div>
              <input type="text" onKeyDown={preventEnterSubmit} value={formData.city}
                onChange={(e) => { setFormData({ ...formData, city: e.target.value }); clearFieldError('city'); }}
                style={errStyle(requiredErrors?.city)}
                className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`}
                placeholder={useUrdu ? 'شہر کا نام' : "Lahore"} required />
            </div>
            {requiredErrors?.city && <p className="mt-1 text-xs font-black text-red-400 ml-4">{requiredErrors.city}</p>}
          </div>
        </div>
          <div className="col-span-1 md:col-span-2 space-y-3">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'ڈیلیوری کی قسم' : 'Delivery Type'}</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'DELIVERY', label: useUrdu ? 'ڈیلیوری' : 'Delivery', icon: '🚚' },
                { value: 'SELF_COLLECTION', label: useUrdu ? 'خود لینا' : 'Self Collection', icon: '🏪' }
              ].map(dt => (
                <button key={dt.value} type="button"
                  onClick={() => setFormData({ ...formData, deliveryType: dt.value })}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 font-black text-sm transition-all ${
                    formData.deliveryType === dt.value
                      ? 'border-blue-500/60 bg-blue-500/10 text-blue-400 shadow-lg'
                      : 'border-gray-700/50 bg-gray-900 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                  }`}>
                  <span className="text-lg">{dt.icon}</span>
                  <span>{dt.label}</span>
                </button>
              ))}
            </div>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'شاپیفائے آرڈر کی تاریخ' : 'Shopify Order Date (Optional)'}</label>
            <div className="relative group">
              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform duration-300 flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-500`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
               <input ref={dateInputRef} type="text" onKeyDown={preventEnterSubmit}
                value={shopifyInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setShopifyInput(val);
                  const iso = parseDate(val);
                  if (iso) setFormData(s => ({ ...s, shopifyOrderDate: iso }));
                }}
                onBlur={() => {
                  const iso = parseDate(shopifyInput);
                  if (!iso) setShopifyInput(fmtDate(formData.shopifyOrderDate));
                }}
                placeholder="DD/MM/YYYY HH:mm"
                className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all text-xl font-bold`} />
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
        {formData.type === 'STANDARD' && (
          <div className="mt-6 space-y-3">
            <label className={`text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.2em] ${useUrdu ? 'mr-4' : 'ml-4'}`}>{useUrdu ? 'ہدایات' : 'Instruction Notes'}</label>
            <textarea value={formData.instructionNotes || ''}
              onChange={e => setFormData({ ...formData, instructionNotes: e.target.value })}
              className="w-full theme-input rounded-2xl py-4 px-5 text-sm font-bold resize-none" rows={3}
              placeholder={useUrdu ? 'اضافی ہدایات یہاں درج کریں...' : 'Enter any special instructions...'} />
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
              <button type="button"
                onClick={() => setFormData({ ...formData, type: 'STANDARD', advancePaid: false, advanceAmount: '', skipEngraving: true, engravingType: '' })}
                className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${formData.type === 'STANDARD' ? 'bg-blue-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}>
                {useUrdu ? 'اسٹینڈرڈ' : 'STD'}
              </button>
            )}
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'READY_LOGO', advancePaid: false, advanceAmount: '' })}
              className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${formData.type === 'READY_LOGO' ? 'bg-purple-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}>
              {useUrdu ? 'لوگو ڈیزائن' : 'LOGO'}
            </button>
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'FULL_CUSTOM', advancePaid: false, advanceAmount: '' })}
              className={`flex-1 py-3 md:py-4 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all leading-tight text-center ${formData.type === 'FULL_CUSTOM' ? 'bg-indigo-600 text-white shadow-2xl' : 'text-gray-600 hover:text-white'}`}>
              {useUrdu ? 'کسٹم آرڈر' : 'CUSTOM'}
            </button>
          </div>
          <div className="space-y-2 md:space-y-3">
            <label className="font-black text-xs md:text-sm uppercase tracking-widest theme-text-muted">{t('priority')}</label>
            <div className="grid grid-cols-3 gap-1.5 md:gap-2">
              {['NORMAL', 'URGENT', 'SUPER_URGENT'].map((p) => (
                <button key={p} type="button" onClick={() => setFormData({ ...formData, priority: p })}
                  className={`py-2.5 md:py-3 px-1 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all border-2 leading-tight text-center ${formData.priority === p
                    ? p === 'SUPER_URGENT' ? 'bg-red-600 text-white border-red-500 shadow-lg' : p === 'URGENT' ? 'bg-amber-600 text-white border-amber-500 shadow-lg' : 'bg-gray-800 text-white border-gray-600 shadow-lg'
                    : 'theme-bg text-gray-600 theme-border hover:border-gray-600'}`}>
                  {p === 'SUPER_URGENT' ? '⚡ SUPER' : p === 'URGENT' ? '⚡ URGENT' : 'NORMAL'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs md:text-sm font-black uppercase theme-text-muted tracking-[0.2em]">{useUrdu ? 'ایڈوانس رقم' : 'Advance Amount (₨)'}</label>
            <div className="relative">
              <input type="number" min="0" value={formData.advanceAmount || ''} placeholder="e.g. 2000"
                onChange={e => setFormData({ ...formData, advanceAmount: e.target.value })}
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
  );
};

export default BasicInfoTab;
