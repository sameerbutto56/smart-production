import React, { createContext, useState, useContext, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('preferredLanguage') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'en' ? 'ur' : 'en'));
  };

  const isUrdu = language === 'ur';

  const LanguageToggle = () => (
    <button
      onClick={toggleLanguage}
      className={`group relative flex items-center gap-2 px-5 py-2.5 bg-gray-900 border-2 border-indigo-500/20 hover:border-indigo-500 rounded-2xl transition-all duration-300 active:scale-95 shadow-xl hover:shadow-indigo-500/20 overflow-hidden z-[9999]`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 group-hover:text-white transition-colors relative z-10">
        {isUrdu ? 'English Mode' : 'اردو ورژن'}
      </span>
    </button>
  );

  // Basic dictionary. Can be expanded infinitely.
  const dict = {
    // Layout & General
    'Admin Portal': 'ایڈمن پورٹل',
    'Control Center': 'کنٹرول سینٹر',
    'Order Entry': 'آرڈر انٹری',
    'Inventory': 'اسٹاک / انوینٹری',
    'My Tasks': 'میرے ٹاسکس',
    'All Orders': 'تمام آرڈرز',
    'History': 'ہسٹری / ریکارڈ',
    'Deliveries': 'ڈلیوریز',
    
    // Order Entry Page
    'Smart Order Entry': 'سمارٹ آرڈر انٹری',
    'Customer Information': 'کسٹمر کی معلومات',
    'Product Details': 'پروڈکٹ کی تفصیلات',
    'Customization': 'کسٹمائزیشن',
    'Sizes & Measurements': 'سائز اور پیمائش',
    'Order No.': 'آرڈر نمبر',
    'Customer Name': 'کسٹمر کا نام',
    'Phone Number': 'فون نمبر',
    'Order Type': 'آرڈر کی قسم',
    'Quantity': 'تعداد',
    'Urgent Order': 'ارجنٹ آرڈر',
    'Advance Paid': 'ایڈوانس ادا شدہ',
    'Total Price (Rs)': 'کل رقم',
    
    // Delivery
    'Pending': 'زیر التوا',
    'Delivered': 'پہنچ گیا / ڈلیورڈ',
    'No Reply': 'کوئی جواب نہیں',
    'Show All': 'تمام دکھائیں',
    'Update Status': 'اسٹیٹس اپڈیٹ کریں',
    
    // Tasks
    'Production Tasks': 'پروڈکشن ٹاسکس',
    'Approve': 'منظور کریں',
    'Reject': 'مسترد کریں',
    'Start Work': 'کام شروع کریں',
    'Complete Task': 'ٹاسک مکمل کریں',
    'Time Left': 'باقی وقت',
    'Job Sheet Summary': 'جاب شیٹ خلاصہ',
    'Production Chart': 'پروڈکشن چارٹ',
    'LIVE FEED': 'براہ راست فیڈ',
    'email': 'ای میل',
    'Login': 'لاگ ان',
    'Add New': 'نیا شامل کریں',
    'MOVE TO': 'منتقلی کی طرف',
    'CUTTING': 'کٹائی',
    'STITCHING': 'سلائی',
    'QA': 'کوالٹی چیک',
    'LOGO_DESIGN': 'لوگو ڈیزائن',
    'PRESSING_PACKING': 'پریسنگ اور پیکنگ',
    'DISPATCH': 'روانگی',
    'OUT_FOR_DELIVERY': 'ڈلیوری کے لیے روانہ',
    'STORE': 'اسٹور',
    'Delayed': 'تاخیر / لیٹ',
    'h': 'گھنٹے',
    'm': 'منٹ',
    's': 'سیکنڈ',
    'to Faisal': 'فیصل کو',
    'Cancel': 'کینسل / ختم کریں',
    'Hold': 'روک دیں / ہولڈ',
    'Delete': 'ڈیلیٹ کریں',
    'Pay': 'ادائیگی (پے)',
    'Initiate Next Phase': 'اگلا مرحلہ شروع کریں',
    'Send Again': 'دوبارہ بھیجیں',
    'Production History': 'پیداواری تاریخ',
    'Click to Expand Job Sheet': 'جاب شیٹ کھولنے کے لیے کلک کریں',
    'Special Tailor Notes:': 'درزی کے لیے خصوصی نوٹ:',
    'Base Size Pattern': 'بنیادی سائز پیٹرن',
    'chest': 'چھاتی',
    'shoulder': 'کندھا',
    'length': 'لمبائی',
    'sleeve': 'بازو',
    'waist': 'کمر',
    'hips': 'ہپس',
    'shirtLength': 'شرٹ کی لمبائی',
    'trouserLength': 'ٹراؤزر کی لمبائی',
    'bottom': 'پانچہ / بوٹم',
    'thigh': 'تھائی',
    'mori': 'موری',
    'ganda': 'گندہ',
    'Fabric': 'کپڑا',
    'Color': 'رنگ',
    'Size': 'سائز',
    'Product': 'پروڈکٹ',
    'Fit': 'فٹ',
    'Style': 'اسٹائل',
    'Design Notes': 'ڈیزائن نوٹس',
    'Measurements': 'پیمائش'
  };

  const t = (text) => {
    if (!isUrdu) return text;
    return dict[text] || text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isUrdu, LanguageToggle, t }}>
      <div className={isUrdu ? 'font-urdu' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};
