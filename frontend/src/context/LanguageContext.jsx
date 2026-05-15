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

  const LanguageToggle = () => (
    <button
      onClick={toggleLanguage}
      className={`px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 rounded-lg text-indigo-400 hover:text-white font-black text-[7px] uppercase tracking-tighter border border-indigo-600/30 transition-all active:scale-95 flex-shrink-0 z-50`}
    >
      {isUrdu ? 'ENG' : 'اردو'}
    </button>
  );

  const isUrdu = language === 'ur';

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
    'Approve': 'منظور کریں',
    'Reject': 'مسترد کریں',
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

  const LanguageToggle = () => (
    <button
      onClick={toggleLanguage}
      className={`px-4 py-2 bg-indigo-600 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 transition-all active:scale-95 flex-shrink-0 z-50`}
    >
      {isUrdu ? 'English Interface' : 'اردو انٹرفیس'}
    </button>
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isUrdu, LanguageToggle, t }}>
      <div className={isUrdu ? 'font-urdu' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};
