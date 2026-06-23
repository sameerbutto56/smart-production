import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

const DICT = {
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
  'Measurements': 'پیمائش',
  // Job Sheet Full Modal
  'Full Production Job Sheet': 'مکمل پروڈکشن جاب شیٹ',
  '01. Material & Product Specs': '01۔ مواد اور پروڈکٹ کی تفصیلات',
  'Fabric & Color': 'کپڑا اور رنگ',
  'Size & Gender': 'سائز اور جنس',
  'Qty': 'تعداد',
  'Stock': 'اسٹاک',
  'Price': 'قیمت',
  'To Be Manufactured': 'تیار کرنا ہے',
  'Available Items': 'دستیاب آئٹمز',
  'Sleeves': 'آستین',
  'Not Available': 'دستیاب نہیں',
  'Available': 'دستیاب',
  'Produced': 'تیار شدہ',
  'Article Name': 'نام',
  'Article Names': 'نام',
  'Logo': 'لوگو',
  'Logo Details': 'لوگو کی تفصیلات',
  'Engraving Type': 'اینگرونگ کی قسم',
  'Direct Engraving': 'ڈائریکٹ اینگرونگ',
  'Patch Engraving': 'پیچ اینگرونگ',
  'Embroidery Color': 'کڑھائی کا رنگ',
  'Logo Location': 'لوگو کا مقام',
  'Fit Type': 'فٹ کی قسم',
  'Stitching Style': 'سلائی کا انداز',
  '02. Precise Measurements (Inches)': '02۔ درست پیمائش (انچ)',
  'SLEEVES': 'آستین',
  'SHIRT LENGTH': 'شرٹ کی لمبائی',
  '03. Engraving': '03۔ اینگرونگ',
  '04. Design Notes & Special Requests': '04۔ ڈیزائن نوٹس اور خصوصی درخواستیں',
  'Instruction Notes': 'ہدایات (نوٹس)',
  'No special design notes provided for this order.': 'اس آرڈر کے لیے کوئی خصوصی ڈیزائن نوٹس فراہم نہیں کیے گئے۔',
  'Print Job Sheet': 'جاب شیٹ پرنٹ کریں',
  'Entry:': 'انٹری:',
  'Stage:': 'مرحلہ:',
  'Delivered:': 'ڈلیورڈ:',
  'Force': 'فورس',
  'Length': 'لمبائی',
  'Qty.': 'تعداد',
  'N/A': 'نہیں',
  'Name:': 'نام:',
  'Logo:': 'لوگو:',
  'Fabric:': 'کپڑا:',
  'Color:': 'رنگ:',
  'Design:': 'ڈیزائن:',
  'Size:': 'سائز:',
  'Extra:': 'اضافی:',
  'Double Stitch': 'ڈبل سلائی',
  'Single Stitch': 'سنگل سلائی',
  ' Fit': ' فٹ',
  'In Stock': 'اسٹاک میں',
  'Custom': 'کسٹم',
  'Close Job Sheet': 'جاب شیٹ بند کریں',
  '📋 Instruction Notes': '📋 ہدایات',
  'Gender': 'جنس',
  'Payment': 'ادائیگی',
  'Shirt Length': 'شرٹ کی لمبائی',
  'Sleeve': 'آستین',
  'Quarter Sleeve': 'چوتھائی آستین',
  'Half Sleeve': 'نصف آستین',
  'Full Sleeve': 'پوری آستین',
  'Full Length': 'پوری لمبائی',
  'Short Length': 'چھوٹی لمبائی',
  'Fabric Required': 'مطلوبہ کپڑا',
  'Color Required': 'مطلوبہ رنگ',
  'Design Required': 'مطلوبہ ڈیزائن',
  'Size Required': 'مطلوبہ سائز',
  'Additional Ref': 'اضافی حوالہ',
  'Logo Charge': 'لوگو چارج',
  'Name Printing': 'نام پرنٹنگ',
  'Customization Charge': 'کسٹمائزیشن چارج',
  'Product Base': 'پروڈکٹ بیس',
  'Primary Color': 'بنیادی رنگ',
  'Order Size': 'آرڈر سائز'
};

const LanguageToggle = ({ isUrdu, toggleLanguage }) => (
  <button
    onClick={toggleLanguage}
    className="group relative flex items-center gap-2 px-5 py-2.5 bg-gray-900 border-2 border-indigo-500/20 hover:border-indigo-500 rounded-2xl transition-all duration-300 active:scale-95 shadow-xl hover:shadow-indigo-500/20 overflow-hidden z-[9999]"
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

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('preferredLanguage') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => (prev === 'en' ? 'ur' : 'en'));
  }, []);

  const isUrdu = language === 'ur';

  const t = useCallback((text) => {
    if (!isUrdu) return text;
    return DICT[text] || text;
  }, [isUrdu]);

  const LanguageToggleBtn = useMemo(() => {
    const Btn = (props) => <LanguageToggle {...props} isUrdu={isUrdu} toggleLanguage={toggleLanguage} />;
    return Btn;
  }, [isUrdu, toggleLanguage]);

  const value = useMemo(() => ({
    language, setLanguage, toggleLanguage, isUrdu, LanguageToggle: LanguageToggleBtn, t
  }), [language, toggleLanguage, isUrdu, LanguageToggleBtn, t]);

  return (
    <LanguageContext.Provider value={value}>
      <div className={isUrdu ? 'font-urdu' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};
