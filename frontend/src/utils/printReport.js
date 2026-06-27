const PRINT_CSS = `
  @page { size: A4 portrait; margin: 4mm 6mm; }
  @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, 'Noto Nastaliq Urdu', sans-serif;
    color: #000;
    background: #fff;
    font-size: 24px;
    line-height: 1.15;
    padding: 0;
    direction: ltr;
  }
  .urdu { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; direction: rtl; text-align: right; }
  .report-header {
    text-align: center;
    border-bottom: 4px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
  }
  .report-header h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .report-header p { font-size: 18px; color: #000; margin-top: 3px; font-weight: 900; }
  .report-meta {
    display: flex;
    justify-content: space-between;
    font-size: 18px;
    font-weight: 900;
    color: #000;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 16px;
  }
  th {
    background: #000;
    color: #fff;
    padding: 4px 6px;
    text-align: left;
    font-size: 14px;
    font-weight: 900;
    text-transform: uppercase;
    border: 1px solid #333;
  }
  td {
    padding: 3px 6px;
    border: 1px solid #ccc;
    font-weight: 700;
  }
  tr:nth-child(even) td { background: #f0f0f0; }
  .section-title {
    font-size: 22px;
    font-weight: 900;
    margin: 12px 0 6px;
    text-transform: uppercase;
    border-bottom: 3px solid #999;
    padding-bottom: 3px;
    letter-spacing: 0.5px;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  .summary-card {
    border: 3px solid #ccc;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }
  .summary-card .label { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #000; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 24px; font-weight: 900; margin-top: 4px; }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 2px dashed #ccc;
    font-size: 18px;
    font-weight: 900;
  }
  .summary-row:last-child { border-bottom: none; }
  .footer {
    text-align: center;
    font-size: 16px;
    font-weight: 900;
    color: #000;
    border-top: 3px solid #ccc;
    padding-top: 8px;
    margin-top: 20px;
  }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 900;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .status-ok { background: #d1fae5; color: #065f46; }
  .status-warn { background: #fef3c7; color: #92400e; }
  .status-bad { background: #fee2e2; color: #991b1b; }
  .status-info { background: #dbeafe; color: #1e40af; }

  /* RTL / Urdu-specific overrides */
  .rtl { direction: rtl; text-align: right; }
  .rtl table th { text-align: right; }
  .rtl table td { text-align: right; }
  .rtl .report-header { text-align: center; }
  .rtl .report-meta { flex-direction: row-reverse; }
  .rtl .section-title { text-align: right; }
  .rtl .summary-row { flex-direction: row-reverse; }
  .rtl .summary-card { text-align: center; }
  .rtl .urdu-text { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; }
  .rtl td[style*="text-align:right"] { text-align: left !important; }
  .rtl .footer { text-align: center; }
`;

/**
 * Smart Urdu Translation Engine
 * Handles: English → Urdu, Roman Urdu → Urdu, mixed text
 * Preserves numbers, codes, IDs
 * Pattern-based for natural Roman Urdu phrases
 */
function romanToUrdu(text) {
  if (!text) return '';
  if (/^[\d\s\-./#]+$/.test(text)) return text; // pure numbers/codes – skip

  let result = text.trim();

  // ─── PRE-PROCESSING ───
  // Normalize whitespace
  result = result.replace(/\s+/g, ' ');
  // If already mostly Urdu, return as-is
  const urduChars = (result.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = result.replace(/\s/g, '').length;
  if (totalChars > 0 && urduChars / totalChars > 0.5) return result;

  const lower = result.toLowerCase();

  // ─── PATTERN-BASED REPLACEMENTS (Roman Urdu grammar) ───
  // These handle common Roman Urdu sentence structures
  const patterns = [
    // "[adj] color" → "[adj] رنگ"  (e.g., "lal color" → "لال رنگ")
    { regex: /\b(lal|laal)\s+color\b/gi, replace: 'لال رنگ' },
    { regex: /\b(neela|neela|nila)\s+color\b/gi, replace: 'نیلا رنگ' },
    { regex: /\b(hara|haara)\s+color\b/gi, replace: 'سبز رنگ' },
    { regex: /\b(peela|peela|pila)\s+color\b/gi, replace: 'پیلا رنگ' },
    { regex: /\b(narangi|orange)\s+color\b/gi, replace: 'نارنجی رنگ' },
    { regex: /\b(gulabi|pink)\s+color\b/gi, replace: 'گلابی رنگ' },
    { regex: /\b(bhoora|brown)\s+color\b/gi, replace: 'بھورا رنگ' },
    { regex: /\b(safed|white)\s+color\b/gi, replace: 'سفید رنگ' },
    { regex: /\b(kala|kalaa|black)\s+color\b/gi, replace: 'سیاہ رنگ' },
    { regex: /\b(surkh?i?|red)\s+color\b/gi, replace: 'سرخ رنگ' },
    { regex: /\b(grey|gray)\s+color\b/gi, replace: 'خاکستری رنگ' },
    { regex: /\b(badami|skin)\s+color\b/gi, replace: 'بادامی رنگ' },
    { regex: /\b(bottle green|bottle)\s+color\b/gi, replace: 'بوتل سبز' },
    { regex: /\b(navy|navy blue)\s+color\b/gi, replace: 'نیوی بلیو' },
    { regex: /\b(maroon)\s+color\b/gi, replace: 'میرون رنگ' },
    { regex: /\b(golden|gold)\s+color\b/gi, replace: 'سنہری رنگ' },
    { regex: /\b(silver)\s+color\b/gi, replace: 'چاندی رنگ' },
    { regex: /\b(purple)\s+color\b/gi, replace: 'جامنی رنگ' },

    // "left/right [body part] [action]" patterns
    // "left sleeve logo" → "بائیں آستین پر لوگو"
    { regex: /\bleft\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+logo\b/gi, replace: 'بائیں $1 پر لوگو' },
    { regex: /\bright\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+logo\b/gi, replace: 'دائیں $1 پر لوگو' },
    { regex: /\bleft\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+name\b/gi, replace: 'بائیں $1 پر نام' },
    { regex: /\bright\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+name\b/gi, replace: 'دائیں $1 پر نام' },
    { regex: /\bleft\s+side\b/gi, replace: 'بائیں جانب' },
    { regex: /\bright\s+side\b/gi, replace: 'دائیں جانب' },

    // "[body part] pe/par [action]" patterns
    // "name chest pe" → "سینے پر نام"
    { regex: /\b(name|logo|design|embroidery|print|writing)\s+(chest|seena|sine|gala|neck|sleeve|bazu|kandha|shoulder|pocket|back|pith|thigh|leg)\s+(pe|par|pai)\b/gi, replace: '$2 پر $1' },
    // "chest pe name" → "سینے پر نام"
    { regex: /\b(chest|seena|sine|gala|neck|sleeve|bazu|kandha|shoulder|pocket|back|pith|thigh)\s+(pe|par|pai)\s+(name|logo|design|embroidery|print)\b/gi, replace: '$1 پر $3' },

    // "samne [thing]" → "سامنے [thing]"
    { regex: /\bsamne\s+(logo|name|design|print|embroidery|writing)\b/gi, replace: 'سامنے $1' },
    // "[thing] samne" → "[thing] سامنے"
    { regex: /\b(logo|name|design|print|embroidery)\s+samne\b/gi, replace: '$1 سامنے' },

    // "andar [thing]" → "اندر [thing]"
    { regex: /\bandar\s+(logo|name|design|print|writing|embroidery)\b/gi, replace: 'اندر $1' },
    // "[thing] andar" → "[thing] کے اندر"
    { regex: /\b(logo|name|design|print|writing)\s+andar\b/gi, replace: '$1 کے اندر' },

    // "gala [adj] karna" → "[adj] گلا بنائیں"
    { regex: /\bgala\s+(round|gol|chota|small|bara|large|v|deep)\s+(karna|karain|karein|rakhna)\b/gi, replace: '$1 گلا بنائیں' },
    { regex: /\b(gola|round)\s+gala\b/gi, replace: 'گول گلا' },
    { regex: /\bgala\s+(round|gol)\b/gi, replace: 'گول گلا' },
    { regex: /\bgala\s+(chota|small)\b/gi, replace: 'چھوٹا گلا' },
    { regex: /\bgala\s+(bara|bada|large)\b/gi, replace: 'بڑا گلا' },

    // "sleeve [adj] karna" → "[adj] آستین"
    { regex: /\bsleeve\s+(short|chota|full|lamba|long|half|aadha|quarter)\s+(karna|karain|rakhna)\b/gi, replace: '$2 آستین' },
    { regex: /\bsleeve\s+(short|chota|small)\b/gi, replace: 'چھوٹی آستین' },
    { regex: /\bsleeve\s+(long|full|lamba)\b/gi, replace: 'لمبی آستین' },
    { regex: /\bsleeve\s+(half|aadha)\b/gi, replace: 'آدھی آستین' },
    { regex: /\bsleeve\s+(quarter)\b/gi, replace: 'چوتھائی آستین' },

    // "shirt [adj] karna" → "[adj] قمیض"
    { regex: /\bshirt\s+(long|lamba|short|chota|regular)\s+(karna|karain|rakhna)\b/gi, replace: '$2 قمیض' },
    { regex: /\bshirt\s+(long|lamba)\b/gi, replace: 'لمبی قمیض' },
    { regex: /\bshirt\s+(short|chota)\b/gi, replace: 'چھوٹی قمیض' },
    { regex: /\bshirt\s+(regular)\b/gi, replace: 'ریگولر قمیض' },

    // "karna" verb suffix
    { regex: /\b(karna|karain|karein|rakhna|rakho|rako|lagana)\b/gi, replace: '' },

    // Common Roman Urdu measurement patterns
    { regex: /\b(lamba?i?|length)?\s*(\d+)\s*(inch|fit|feet|cm|meter)\b/gi, replace: '$2 انچ' },
  ];

  for (const p of patterns) {
    result = result.replace(p.regex, p.replace);
  }

  // ─── DICTIONARY-BASED REPLACEMENT (industry-specific terms) ───
  const dictionary = {
    // Colors (English & Roman Urdu)
    'lal': 'لال', 'laal': 'لال', 'red': 'سرخ',
    'neela': 'نیلا', 'neela': 'نیلا', 'nila': 'نیلا', 'blue': 'نیلا', 'navy blue': 'نیوی بلیو',
    'hara': 'سبز', 'haara': 'سبز', 'green': 'سبز', 'bottle green': 'بوتل سبز',
    'peela': 'پیلا', 'pila': 'پیلا', 'yellow': 'پیلا',
    'narangi': 'نارنجی', 'orange': 'نارنجی',
    'gulabi': 'گلابی', 'pink': 'گلابی',
    'bhoora': 'بھورا', 'brown': 'بھورا',
    'safed': 'سفید', 'white': 'سفید',
    'kala': 'سیاہ', 'kalaa': 'سیاہ', 'black': 'سیاہ',
    'surkh': 'سرخ', 'surkhi': 'سرخ',
    'golden': 'سنہری', 'gold': 'سنہری',
    'silver': 'چاندی',
    'grey': 'خاکستری', 'gray': 'خاکستری',
    'purple': 'جامنی', 'jamni': 'جامنی',
    'maroon': 'میرون',
    'badami': 'بادامی', 'skin': 'بادامی',
    'mustard': 'مصطردی', 'rust': 'زنگ آلود',
    'khaki': 'خاکی',
    'indigo': 'انڈگو',
    'cream': 'کریم',
    'beige': 'بیج',
    'magenta': 'میجنٹا',
    'turquoise': 'فیروزی',

    // Body parts (tailoring)
    'chest': 'سینہ', 'seena': 'سینہ', 'sina': 'سینہ',
    'shoulder': 'کندھا', 'kandha': 'کندھا',
    'waist': 'کمر', 'kamar': 'کمر',
    'hip': 'کولہ', 'hips': 'کولہے',
    'bottom': 'نیچے',
    'sleeve': 'آستین', 'bazu': 'آستین',
    'length': 'لمبائی',
    'thigh': 'ران',
    'neck': 'گردن', 'gardan': 'گردن',
    'gala': 'گلا',
    'armhole': 'بغل', 'baghal': 'بغل',
    'bicep': 'عضلہ',
    'wrist': 'کلائی',
    'inseam': 'ان سیون',
    'outseam': 'آؤٹ سیون',
    'calf': 'پنڈلی',
    'ankle': 'ٹخنہ',
    'trouser': 'پتلون', 'pant': 'پتلون', 'pataloon': 'پتلون',
    'shirt': 'قمیص', 'kameez': 'قمیص',
    'dupatta': 'دوپٹہ',
    'zip': 'زپ',
    'button': 'بٹن', 'butan': 'بٹن',
    'pocket': 'جیب', 'jeb': 'جیب',
    'collar': 'کالر', 'kolar': 'کالر',
    'back': 'پشت', 'pith': 'پشت', 'peeth': 'پشت',
    'front': 'سامنے', 'samne': 'سامنے', 'agay': 'سامنے',
    'side': 'جانب', 'janib': 'جانب',

    // Positions & Directions
    'left': 'بائیں', 'bayen': 'بائیں', 'bayein': 'بائیں',
    'right': 'دائیں', 'dayen': 'دائیں', 'dayein': 'دائیں',
    'center': 'درمیان', 'centre': 'درمیان', 'middle': 'درمیان', 'darmiyan': 'درمیان',
    'up': 'اوپر', 'upper': 'اوپر', 'uper': 'اوپر',
    'down': 'نیچے', 'lower': 'نیچے', 'neeche': 'نیچے',
    'inside': 'اندر', 'andar': 'اندر',
    'outside': 'باہر', 'bahar': 'باہر',
    'top': 'اوپر',
    'above': 'اوپر',
    'below': 'نیچے',

    // Fabrics
    'fabric': 'کپڑا', 'kapra': 'کپڑا', 'cloth': 'کپڑا',
    'cotton': 'سوتی', 'suti': 'سوتی',
    'lawn': 'لان',
    'khadi': 'کھادی',
    'linen': 'لینن',
    'silk': 'ریشم', 'resham': 'ریشم',
    'polyester': 'پالئیےسٹر',
    'jersey': 'جرسی',
    'denim': 'ڈینم',
    'canvas': 'کینوس',
    'velvet': 'مخمل', 'makhmal': 'مخمل',
    'wool': 'اون', 'oen': 'اون',
    'lace': 'لیس',
    'net': 'نیٹ',
    'chiffon': 'شیفون',
    'georgette': 'جارجٹ',
    'drill': 'ڈرل',
    'satin': 'ساٹن',
    'mesh': 'میش',

    // Actions & Verbs
    'print': 'پرنٹ', 'printing': 'پرنٹنگ',
    'embroidery': 'کڑھائی', 'embroidary': 'کڑھائی', 'kadhai': 'کڑھائی',
    'stitch': 'سلائی', 'stitching': 'سلائی',
    'cut': 'کٹ', 'cutting': 'کٹنگ',
    'sew': 'سلائی کرو', 'sewing': 'سلائی',
    'design': 'ڈیزائن',
    'make': 'بنائیں', 'banaye': 'بنائیں',
    'fix': 'لگائیں', 'fit': 'فٹ',
    'attach': 'لگائیں', 'lagao': 'لگائیں',
    'remove': 'ہٹائیں', 'hataye': 'ہٹائیں',
    'add': 'شامل کریں', 'dalain': 'شامل کریں',
    'patch': 'پیچ',
    'direct': 'ڈائریکٹ',
    'wash': 'دھلائی', 'dhulai': 'دھلائی',
    'iron': 'استری', 'istari': 'استری',
    'fold': 'تہہ', 'teh': 'تہہ',

    // Tailoring/Production terms
    'tailoring': 'درزی', 'darzi': 'درزی',
    'cutting': 'کٹنگ',
    'stitching': 'سلائی',
    'finishing': 'فنشنگ',
    'checking': 'چیکنگ',
    'packing': 'پیکنگ',
    'dispatch': 'ڈسپیچ',
    'production': 'پروڈکشن',
    'sewing': 'سلائی',
    'fitting': 'فٹنگ',
    'alteration': 'ترمیم',
    'repair': 'مرمت', 'marammat': 'مرمت',
    'measure': 'ناپ', 'naap': 'ناپ',
    'measurement': 'پیمائش', 'measurements': 'پیمائش',

    // Accessories
    'zip': 'زپ',
    'button': 'بٹن',
    'hook': 'ہک',
    'eye': 'آئی',
    'thread': 'دھاگہ', 'dhaga': 'دھاگہ',
    'ribbon': 'ربن',
    'lace': 'لیس',
    'elastic': 'لچک', 'loochak': 'لچک',
    'label': 'لیبل',
    'tag': 'ٹیگ',
    'badge': 'بیج',
    'matching cap': 'میچنگ کیپ',
    'cap': 'کیپ',

    // Order Status
    'standard': 'اسٹینڈرڈ',
    'custom': 'کسٹم',
    'ready logo': 'ریڈی لوگو',
    'full custom': 'فل کسٹم',
    'urgent': 'ارجنٹ',
    'super urgent': 'انتہائی ارجنٹ',
    'normal': 'عام',
    'pending': 'زیر التوا',
    'paid': 'ادا شدہ',
    'unpaid': 'غیر ادا شدہ',
    'completed': 'مکمل',
    'delivered': 'ڈلیورڈ',
    'returned': 'واپس',
    'cancelled': 'منسوخ',
    'processing': 'پروسیسنگ',
    'ready': 'تیار',
    'hold': 'ہولڈ',
    'delivery': 'ڈلیوری',
    'advance': 'ایڈوانس',

    // Quantity & Numbers
    'one': 'ایک', 'ek': 'ایک',
    'two': 'دو', 'do': 'دو',
    'three': 'تین', 'teen': 'تین',
    'four': 'چار', 'chaar': 'چار',
    'five': 'پانچ', 'panch': 'پانچ',
    'single': 'سنگل',
    'double': 'ڈبل',
    'qty': 'تعداد', 'quantity': 'تعداد',
    'total': 'کل',
    'half': 'آدھا', 'aadha': 'آدھا', 'aadhi': 'آدھی',
    'full': 'پورا', 'poora': 'پورا',
    'all': 'تمام',
    'some': 'کچھ',
    'many': 'بہت',
    'few': 'تھوڑے', 'thora': 'تھوڑا',
    'more': 'مزید', 'mazeed': 'مزید',

    // Financial
    'price': 'قیمت', 'qimat': 'قیمت',
    'cost': 'لاگت', 'lagat': 'لاگت',
    'discount': 'چھوٹ', 'chhoot': 'چھوٹ',
    'payment': 'ادائیگی',
    'total price': 'کل قیمت',
    'grand total': 'کل رقم',
    'advance': 'ایڈوانس',
    'remaining': 'باقی', 'baqi': 'باقی',
    'balance': 'بیلنس',
    'free': 'مفت', 'muft': 'مفت',
    'delivery charges': 'ڈلیوری چارجز',
    'charges': 'چارجز',

    // General
    'order': 'آرڈر',
    'product': 'پروڈکٹ',
    'products': 'پروڈکٹس',
    'customer': 'کسٹمر',
    'name': 'نام',
    'phone': 'فون',
    'address': 'پتہ', 'pata': 'پتہ',
    'city': 'شہر', 'sheher': 'شہر',
    'note': 'نوٹ', 'notes': 'نوٹس',
    'special note': 'خصوصی نوٹ',
    'instruction notes': 'ہدایات',
    'instruction': 'ہدایت',
    'remark': 'ریمارکس', 'remarks': 'ریمارکس',
    'engraving': 'اینگرونگ',
    'measurements': 'پیمائش',
    'financial summary': 'مالی خلاصہ',
    'job sheet': 'جاب شیٹ',
    'branding': 'اینگرونگ',
    'logo': 'لوگو',
    'sleeves': 'آستین',
    'color': 'رنگ',
    'size': 'سائز',
    'gender': 'جنس', 'jins': 'جنس',
    'male': 'مرد', 'mard': 'مرد',
    'female': 'خاتون', 'khawateen': 'خواتین',
    'fit': 'فٹ',
    'regular': 'ریگولر',
    'slim': 'سلم',
    'loose': 'ڈھیلا', 'dheela': 'ڈھیلا',
    'tight': 'تنگ', 'tang': 'تنگ',
    'medium': 'درمیانہ',

    // Locations
    'enamels': 'اینملز',
    'johar town': 'جوہر ٹاؤن',
    'jail road': 'جیل روڈ',
    'abbottabad': 'ایبٹ آباد',
    'lahore': 'لاہور', 'lhr': 'لاہور',
    'islamabad': 'اسلام آباد',
    'karachi': 'کراچی', 'khi': 'کراچی',
    'rawalpindi': 'راولپنڈی',
    'faisalabad': 'فیصل آباد',
    'multan': 'ملتان',
    'gujranwala': 'گوجرانوالہ',
    'online': 'آن لائن',
    'outlet': 'آؤٹ لیٹ',

    // Sizes
    'xs': 'ایکس ایس', 'small': 'چھوٹا', 's': 'ایس',
    'medium': 'درمیانہ', 'm': 'ایم',
    'large': 'بڑا', 'l': 'ایل',
    'xl': 'ایکس ایل',
    'xxl': 'ڈبل ایکس ایل',
    'xxxl': 'ٹرپل ایکس ایل',

    // English words that should stay/not be translated
    'id': 'آئی ڈی',
    'date': 'تاریخ',
    'time': 'وقت',

    // Additional common terms
    'thread color': 'دھاگے کا رنگ',
    'embroidery color': 'کڑھائی کا رنگ',
    'embroidery type': 'کڑھائی کی قسم',
    'embroidery thread': 'کڑھائی کا دھاگہ',
  };

  // Sort dictionary keys by length (longest first) to match multi-word phrases before single words
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length);

  // Apply dictionary replacements (case-insensitive, whole-word)
  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
    result = result.replace(regex, dictionary[key]);
  }

  // ─── POST-PROCESSING: Map remaining Roman Urdu via transliteration ───
  // Improved char mapping with digraph support
  const digraphMap = {
    'sh': 'ش', 'ch': 'چ', 'kh': 'خ', 'gh': 'غ', 'zh': 'ژ',
    'th': 'تھ', 'dh': 'دھ', 'nh': 'نہ', 'nh': 'نہ',
    'aa': 'آ', 'ee': 'ی', 'oo': 'و', 'ai': 'ے', 'au': 'او',
    'iy': 'ی', 'ay': 'ے', 'ya': 'یا', 'yu': 'یو',
  };
  const charMap = {
    'a': 'ا', 'b': 'ب', 'p': 'پ', 't': 'ت', 's': 'س', 'j': 'ج',
    'h': 'ہ', 'k': 'ک', 'l': 'ل', 'm': 'م', 'n': 'ن', 'w': 'و',
    'y': 'ی', 'r': 'ر', 'z': 'ز', 'f': 'ف', 'q': 'ق', 'd': 'د',
    'g': 'گ', 'e': 'ے', 'i': 'ی', 'o': 'و', 'u': 'و', 'c': 'ک',
    'v': 'و', 'x': 'کس',
  };

  // Process each word: transliterate remaining English/Roman words
  const words = result.split(/(\s+)/);
  result = words.map(word => {
    if (!word.trim() || /[\u0600-\u06FF]/.test(word)) return word; // already Urdu or whitespace
    if (/^\d+$/.test(word)) return word; // pure numbers – keep
    // Preserve codes (mixed letters+numbers, uppercase)
    if (/[A-Z0-9]/.test(word) && !/[a-z]/.test(word) && word.length > 1) return word;

    if (/[a-zA-Z]/.test(word)) {
      const w = word.toLowerCase();
      // Skip very short words (likely names/abbreviations)
      if (w.length <= 2 && !['to', 'in', 'on', 'at', 'by', 'or', 'is', 'be', 'do'].includes(w)) return word;
      // Skip URLs, codes
      if (/[A-Z]{2,}/.test(word)) return word;

      // Apply digraph mapping first, then single char mapping
      let mapped = '';
      let i = 0;
      while (i < w.length) {
        // Try 2-char digraph
        if (i + 1 < w.length) {
          const pair = w.substring(i, i + 2);
          if (digraphMap[pair]) {
            mapped += digraphMap[pair];
            i += 2;
            continue;
          }
        }
        // Single char
        mapped += charMap[w[i]] || w[i];
        i++;
      }
      return mapped;
    }
    return word;
  }).join('');

  // Clean up extra whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result || text;
}

export function openPrintWindow(title, isRtl = false) {
  const win = window.open('', '_blank');
  const bodyAttrs = isRtl ? ' dir="rtl" class="rtl"' : '';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body${bodyAttrs}>`);
  win.document.write('<div class="report-header">');
  win.document.write(`<h1>${title}</h1>`);
  win.document.write(`<p>Enamels Production — Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>`);
  win.document.write('</div>');
  return win;
}

export function closePrintWindow(win, isUrdu = false) {
  if (isUrdu) {
    win.document.write('<div class="footer">اینملز پروڈکشن — یہ کمپیوٹر سے تیار کردہ رپورٹ ہے۔<br><span style="font-size:16px;font-weight:400;color:#aaa">سافٹ ویئر ڈویلپر: ثمر بٹ</span></div>');
  } else {
    win.document.write('<div class="footer">Enamels Production — This is a computer-generated report.<br><span style="font-size:16px;font-weight:400;color:#aaa">Software is developed by Sameer Butt</span></div>');
  }
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

export function printAnalyticsReport(data, branch) {
  const branchLabel = branch === 'all' ? 'All Branches' : branch.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const title = `Analytics Report - ${branchLabel}`;
  const win = openPrintWindow(title);
  const s = data?.summary || {};
  const prod = data?.production || {};

  win.document.write('<div class="report-meta"><span>Enamels Production</span><span>Branch: ' + branchLabel + '</span></div>');

  // Summary cards
  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Orders', s.totalOrders || 0));
  win.document.write(kpiCard('Total Revenue', currency(s.totalRevenue)));
  win.document.write(kpiCard('Gross Profit', currency(s.totalGrossProfit)));
  win.document.write(kpiCard('Net Profit', currency(s.totalNetProfit)));
  win.document.write(kpiCard('Items Produced', s.totalProduced || 0));
  win.document.write(kpiCard('Inventory Items', s.totalInventoryItems || 0));
  win.document.write(kpiCard('Dispatch Pending', s.dispatchPending || 0));
  win.document.write(kpiCard('Completed Orders', s.completedOrders || 0));
  win.document.write('</div>');

  // Stage counts table
  win.document.write('<div class="section-title">Orders by Stage</div>');
  win.document.write('<table><thead><tr><th>Stage</th><th style="text-align:right">Count</th></tr></thead><tbody>');
  Object.entries(data?.stageCounts || {}).forEach(([name, count]) => {
    win.document.write(`<tr><td>${name.replace(/_/g, ' ')}</td><td style="text-align:right;font-weight:700">${count}</td></tr>`);
  });
  win.document.write('</tbody></table>');

  // Production breakdown
  if (prod.byProduct?.length > 0) {
    win.document.write('<div class="section-title">Production by Product</div>');
    win.document.write('<table><thead><tr><th>Product</th><th style="text-align:right">Quantity</th><th style="text-align:right">Profit</th></tr></thead><tbody>');
    prod.byProduct.forEach(p => {
      win.document.write(`<tr><td>${p.productName || '—'}</td><td style="text-align:right">${p.quantity || 0} units</td><td style="text-align:right;font-weight:700">${currency(p.profit)}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Profit summary
  win.document.write('<div class="section-title">Financial Summary</div>');
  win.document.write('<div style="max-width:400px">');
  win.document.write(summaryRow('Total Revenue', currency(s.totalRevenue)));
  win.document.write(summaryRow('Total Production Cost', currency(s.totalProductionCost)));
  win.document.write(summaryRow('Gross Profit', currency(s.totalGrossProfit)));
  win.document.write(summaryRow('Net Profit', currency(s.totalNetProfit)));
  win.document.write(summaryRow('Online Revenue', currency(s.onlineRevenue)));
  win.document.write(summaryRow('Outlet Revenue', currency(s.outletRevenue)));
  win.document.write('</div>');

  closePrintWindow(win);
}

const FILTER_LABELS = { ALL: 'All Items', LOW: 'Low Stock (1-5)', OUT: 'Out of Stock (0)' };

export function printInventoryReport(items, filter = 'ALL') {
  const title = `Inventory Report - ${FILTER_LABELS[filter] || 'All Items'}`;
  const win = openPrintWindow(title);

  win.document.write('<div class="report-meta"><span>Enamels Production</span><span>Stock as of ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>');

  const totalValue = items.reduce((s, i) => s + ((i.variants || []).reduce((sv, v) => sv + ((v.stock || 0) * (v.price || 0)), 0)), 0);
  const totalStock = items.reduce((s, i) => s + ((i.variants || []).reduce((sv, v) => sv + (v.stock || 0), 0)), 0);

  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Items', items.length));
  win.document.write(kpiCard('Total Stock Units', totalStock));
  win.document.write(kpiCard('Total Value', currency(totalValue)));
  win.document.write(kpiCard('Categories', [...new Set(items.map(i => i.category))].length));
  win.document.write('</div>');

  // Filter variants based on active stock filter
  function variantMatchesFilter(stock) {
    if (filter === 'ALL') return true;
    if (filter === 'OUT') return stock === 0;
    if (filter === 'LOW') return stock > 0 && stock <= 5;
    return true;
  }

  // Group by category
  const categories = [...new Set(items.map(i => i.category))].sort();
  categories.forEach(cat => {
    const catItems = items.filter(i => i.category === cat);
    win.document.write(`<div class="section-title">${cat} (${catItems.length} items)</div>`);
    win.document.write('<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th style="text-align:right">Stock</th><th style="text-align:right">Price</th><th style="text-align:right">Value</th><th>Status</th></tr></thead><tbody>');
    catItems.forEach(item => {
      const variants = item.variants && item.variants.length > 0 ? item.variants : [{ color: '—', size: '—', stock: 0, price: item.price || 0 }];
      variants.filter(v => variantMatchesFilter(v.stock || 0)).forEach(v => {
        const stock = v.stock || 0;
        const price = v.price || 0;
        const val = stock * price;
        let statusClass = 'status-ok';
        let statusText = 'In Stock';
        if (stock === 0) { statusClass = 'status-bad'; statusText = 'Out of Stock'; }
        else if (stock <= 5) { statusClass = 'status-warn'; statusText = 'Low Stock'; }
        win.document.write(`<tr><td style="font-weight:700">${item.name}</td><td>${v.color || '—'}</td><td>${v.size || '—'}</td><td style="text-align:right;font-weight:700">${stock}</td><td style="text-align:right">${currency(price)}</td><td style="text-align:right;font-weight:700">${currency(val)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`);
      });
    });
    win.document.write('</tbody></table>');
  });

  closePrintWindow(win);
}

export function printDeliveryReport(orders) {
  const title = 'Delivery Report';
  const win = openPrintWindow(title);

  const now = new Date();
  win.document.write('<div class="report-meta"><span>Enamels Production</span><span>Report Date: ' + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>');

  const active = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.status !== 'COMPLETED');
  const completed = orders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'COMPLETED');
  const pending = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.status !== 'COMPLETED' && !o.riderAcceptedAt);

  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Orders', orders.length));
  win.document.write(kpiCard('Active', active.length));
  win.document.write(kpiCard('Completed', completed.length));
  win.document.write(kpiCard('Pending Accept', pending.length));
  win.document.write('</div>');

  // Active deliveries
  if (active.length > 0) {
    win.document.write('<div class="section-title">Active Deliveries</div>');
    win.document.write('<table><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Area</th><th>Method</th><th>Attempts</th></tr></thead><tbody>');
    active.forEach(o => {
      const attemptStr = o.noResponseCount ? `${o.noResponseCount}/3` : '0';
      const method = o.deliveryMethod || o.deliveryType || '—';
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || '—'}</td><td>${o.customerPhone || '—'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.outletName || '—'}</td><td>${method}</td><td style="text-align:center;font-weight:700">${attemptStr}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Completed deliveries
  if (completed.length > 0) {
    win.document.write('<div class="section-title">Completed Deliveries</div>');
    win.document.write('<table><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Delivered At</th><th>Method</th></tr></thead><tbody>');
    completed.forEach(o => {
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || '—'}</td><td>${o.customerPhone || '—'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.deliveredAt ? new Date(o.deliveredAt).toLocaleString() : '—'}</td><td>${o.deliveryMethod || o.deliveryType || '—'}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Rider-wise summary
  const riderMap = {};
  (orders || []).forEach(o => {
    const attempts = o.deliveryAttempts || [];
    attempts.forEach(a => {
      if (a.riderName) {
        if (!riderMap[a.riderName]) riderMap[a.riderName] = { delivered: 0, noResponse: 0, total: 0 };
        riderMap[a.riderName].total++;
        if (a.status === 'DELIVERED') riderMap[a.riderName].delivered++;
        else if (a.status === 'NO_RESPONSE') riderMap[a.riderName].noResponse++;
      }
    });
  });

  if (Object.keys(riderMap).length > 0) {
    win.document.write('<div class="section-title">Rider Performance Summary</div>');
    win.document.write('<table><thead><tr><th>Rider</th><th style="text-align:right">Total Attempts</th><th style="text-align:right">Delivered</th><th style="text-align:right">No Response</th><th style="text-align:right">Success Rate</th></tr></thead><tbody>');
    Object.entries(riderMap).forEach(([name, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
      win.document.write(`<tr><td style="font-weight:700">${name}</td><td style="text-align:right">${stats.total}</td><td style="text-align:right;color:#065f46;font-weight:700">${stats.delivered}</td><td style="text-align:right;color:#92400e">${stats.noResponse}</td><td style="text-align:right;font-weight:700">${rate}%</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  closePrintWindow(win);
}

function kpiCard(label, value) {
  return `<div class="summary-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function summaryRow(label, value) {
  return `<div class="summary-row"><span style="font-weight:600">${label}</span><span style="font-weight:800">${value}</span></div>`;
}

function currency(v) {
  return `₨${(v || 0).toLocaleString()}`;
}

function parseJSON(data) {
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return {}; }
}

/** Format date for display */
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Urdu labels for production sections */
const urduSection = {
  products: 'پروڈکٹس',
  engraving: 'اینگرونگ',
  measurements: 'پیمائش',
  instructionNotes: 'ہدایات (نوٹس)',
  product: 'پروڈکٹ',
  fabricColor: 'کپڑا اور رنگ',
  sizeGender: 'سائز اور جنس',
  qty: 'تعداد',
  cap: 'کیپ',
  sleeves: 'آستین',
  length: 'لمبائی',
  nameLines: 'نام کی لائنیں',
  logos: 'لوگو',
  specialNote: 'خصوصی نوٹ',
  matchingCap: 'میچنگ کیپ',
  fitType: 'فٹ',
  color: 'رنگ',
  position: 'مقام',
  orderEntryDate: 'آرڈر انٹری کی تاریخ',
  shopifyDate: 'شاپیفائے آرڈر کی تاریخ',
  orderDate: 'آرڈر کی تاریخ',
  engravingType: 'اینگرونگ کی قسم',
  directEngraving: 'ڈائریکٹ اینگرونگ',
  patchEngraving: 'پیچ اینگرونگ',
  customAttributes: 'کسٹم ایٹریبیوٹس',
  fabricSource: 'مطلوبہ کپڑا',
  colorSource: 'مطلوبہ رنگ',
  designSource: 'مطلوبہ ڈیزائن',
  sizeSource: 'مطلوبہ سائز',
  sourceProducts: 'کسٹم ضروریات',
  jobSheet: 'جاب شیٹ',
  specialNote: 'خصوصی نوٹ',
  price: 'قیمت',
  fabric: 'کپڑا',
  color: 'رنگ',
  size: 'سائز',
  gender: 'جنس',
  qty: 'تعداد',
  orderNo: 'آرڈر نمبر',
  status: 'حالت',
  customerInfo: 'کسٹمر کی معلومات',
  phone: 'فون',
  city: 'شہر',
  COD: 'نقد ڈلیوری',
  paid: 'ادا شدہ',
  fullyPaid: 'مکمل ادا شدہ',
  custom: 'کسٹم',
  standard: 'اسٹینڈرڈ',
  readyLogo: 'ریڈی لوگو',
  male: 'مرد',
  female: 'خاتون',
  dupatta: 'دوپٹہ',
  extra: 'اضافی',
};

/** English labels for production sections */
const enSection = {
  products: 'Products',
  engraving: 'Engraving',
  measurements: 'Measurements',
  instructionNotes: 'Instruction Notes',
  product: 'Product',
  fabricColor: 'Fabric & Color',
  sizeGender: 'Size & Gender',
  qty: 'Qty',
  cap: 'Cap',
  sleeves: 'Sleeves',
  length: 'Length',
  nameLines: 'Name Lines',
  logos: 'Logos',
  specialNote: 'Special Note',
  matchingCap: 'Matching Cap',
  fitType: 'Fit',
  color: 'Color',
  position: 'Position',
  orderEntryDate: 'Entry Date',
  shopifyDate: 'Shopify Date',
  orderDate: 'Order Date',
  engravingType: 'Engraving Type',
  directEngraving: 'Direct Engraving',
  patchEngraving: 'Patch Engraving',
  customAttributes: 'Custom Attributes',
  fabricSource: 'Fabric Required',
  colorSource: 'Color Required',
  designSource: 'Design Required',
  sizeSource: 'Size Required',
  sourceProducts: 'Custom Requirements',
  jobSheet: 'Job Sheet',
  specialNote: 'Special Note',
  price: 'Price',
  fabric: 'Fabric',
  color: 'Color',
  size: 'Size',
  gender: 'Gender',
  qty: 'Qty',
  orderNo: 'Order #',
  status: 'Status',
  customerInfo: 'Customer Info',
  phone: 'Phone',
  city: 'City',
  COD: 'Cash on Delivery',
  paid: 'Paid',
  fullyPaid: 'Fully Paid',
  custom: 'Custom',
  standard: 'Standard',
  readyLogo: 'Ready Logo',
  male: 'Male',
  female: 'Female',
  dupatta: 'Dupatta',
  extra: 'Extra',
};

/** Urdu measurement labels */
const urduLabels = {
  shoulder: 'کندھا',
  chest: 'سینہ',
  waist: 'کمر',
  bottom: 'نیچے',
  shirtLength: 'قمیض کی لمبائی',
  hip: 'کولہ',
  sleeve: 'آستین',
  trouserLength: 'پتلون کی لمبائی',
  hips: 'کولہے',
  thigh: 'ران',
  mori: 'موڑی',
  ganda: 'گانڈا',
  neck: 'گردن',
  armhole: 'بغل',
  bicep: 'عضلہ',
  wrist: 'کلائی',
  length: 'لمبائی',
  inseam: 'ان سیون',
  outseam: 'آؤٹ سیون',
  calf: 'پنڈلی',
  ankle: 'ٹخنہ'
};

/** Capitalize first letter */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export function printJobSheet(order, userRole, lang = 'ur', sections = {}) {
  const showMeas = sections.measurements !== false;
  const showEngraving = sections.engraving !== false;
  const showPrice = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const priceDisplay = (v) => showPrice ? currency(v) : '★ ★ ★';

  const slMap = { 'full':'Full', 'half':'Half', 'three-quarter':'3 Quarter' };
  const shMap = { 'long':'Long', 'short':'Short', 'regular':'Regular' };
  const femSlMap = { 'full':'Full', 'half':'Half', 'medium':'Medium' };
  const femShMap = { 'long':'Long', 'short':'Short' };
  const slDisplay = (v) => v ? (slMap[v] || v) : '';
  const shDisplay = (v) => v ? (shMap[v] || v) : '';
  const sec = lang === 'en' ? enSection : urduSection;
  const isUrdu = lang === 'ur';

  const orderType = order.type || 'STANDARD';
  const title = `${sec.jobSheet} — ${order.orderNumber || order.id?.slice(0, 8)}`;
  const win = openPrintWindow(title, isUrdu);

  const rawPd = parseJSON(order.productDetails);
  const allItems = Array.isArray(rawPd) ? rawPd : null;
  const isMultiItem = allItems && allItems.length > 0;
  const firstProduct = isMultiItem ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
  const custom = parseJSON(order.customization);
  const rawSizes = parseJSON(order.sizeData);
  const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : ({});

  // ─── DATE SECTION ───
  const entryDate = fmtDateTime(order.createdAt);
  const shopifyDate = order.shopifyOrderDate ? fmtDate(order.shopifyOrderDate) : null;

  // ─── HEADER ───
  win.document.write(`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:3px solid #111;padding-bottom:8px">`);
  win.document.write(`<div>`);
  win.document.write(`<h1 style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px">${sec.jobSheet}</h1>`);
  win.document.write(`<p style="font-size:20px;color:#000;margin-top:3px;font-weight:700">${isUrdu ? 'آرڈر' : 'Order'} ${order.orderNumber || order.id?.slice(0, 8)}</p>`);
  win.document.write(`</div>`);
  win.document.write(`<div style="text-align:right">`);
  win.document.write(`<p style="font-size:22px;font-weight:900"${isUrdu ? ' class="urdu-text"' : ''}>${ru(order.customerName) || '—'}</p>`);
  win.document.write(`<p style="font-size:20px;color:#000;font-weight:600">${order.customerPhone || ''}</p>`);
  if (order.address) win.document.write(`<p style="font-size:18px;color:#000"${isUrdu ? ' class="urdu-text"' : ''}>${ru(order.address)}</p>`);
  if (order.city) win.document.write(`<p style="font-size:24px;font-weight:900;color:#000;background:#fef3c7;display:inline-block;padding:4px 14px;border-radius:6px;margin-top:4px;text-transform:uppercase">${isUrdu ? 'شہر:' : '📍 CITY:'} ${ru(order.city)}</p>`);
  win.document.write(`</div></div>`);

  // ─── DATES ROW ───
  win.document.write(`<div style="display:flex;justify-content:space-between;margin-bottom:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px;">`);
  win.document.write(`<div><span style="font-size:18px;font-weight:700;color:#000">${sec.orderEntryDate}:</span> <span style="font-size:20px;font-weight:900;color:#111">${entryDate}</span></div>`);
  if (shopifyDate) {
    const shopifyLabel = isUrdu ? `${sec.shopifyDate}:` : `${sec.shopifyDate}:`;
    win.document.write(`<div><span style="font-size:18px;font-weight:700;color:#000">${shopifyLabel}</span> <span style="font-size:20px;font-weight:900;color:#111">${shopifyDate}</span></div>`);
  }
  win.document.write(`</div>`);

  // ─── ORDER META BADGES ───
  win.document.write(`<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">`);
  const badgeLabels = {
    'PAID': isUrdu ? 'ادا شدہ' : 'PAID',
    'FULL_CUSTOM': isUrdu ? 'فل کسٹم' : 'FULL CUSTOM',
    'STANDARD': isUrdu ? 'اسٹینڈرڈ' : 'STANDARD',
    'READY_LOGO': isUrdu ? 'ریڈی لوگو' : 'READY LOGO',
    'SUPER_URGENT': isUrdu ? 'انتہائی ارجنٹ' : 'SUPER URGENT',
    'URGENT': isUrdu ? 'ارجنٹ' : 'URGENT',
    'OUTLET': isUrdu ? 'آؤٹ لیٹ' : 'OUTLET',
    'CASH ON DELIVERY': isUrdu ? 'نقد ڈلیوری' : 'CASH ON DELIVERY',
  };
  const _payLabel = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : 'CASH ON DELIVERY';
  const _payColor = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? '#059669' : (parseFloat(order.advanceAmount || 0) > 0 ? '#d97706' : '#dc2626');
  [order.type, order.priority, order.outletName || order.source, _payLabel].filter(Boolean).forEach(label => {
    let color = '#6b7280';
    if (label === 'PAID' || label === 'FULL_CUSTOM') color = '#059669';
    else if (label === 'SUPER_URGENT') color = '#dc2626';
    else if (label === 'URGENT') color = '#d97706';
    else if (label === 'OUTLET') color = '#7c3aed';
    else if (label === 'CASH ON DELIVERY') color = '#dc2626';
    const displayLabel = badgeLabels[label] || ru(label);
    win.document.write(`<span style="padding:3px 12px;border-radius:6px;font-size:20px;font-weight:700;text-transform:uppercase;background:${color}20;color:${color};border:2px solid ${color}40"${isUrdu ? ' class="urdu-text"' : ''}>${displayLabel}</span>`);
  });
  win.document.write(`</div>`);

  // ─── INSTRUCTION NOTES ───
  if (order.instructionNotes) {
    const notesDisplay = isUrdu ? romanToUrdu(order.instructionNotes) : order.instructionNotes;
    win.document.write(`<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:8px 12px;margin-bottom:8px;page-break-inside:avoid">`);
    win.document.write(`<p style="font-size:20px;font-weight:900;text-transform:uppercase;color:#000;margin-bottom:4px"${isUrdu ? ' class="urdu"' : ''}>${sec.instructionNotes}</p>`);
    win.document.write(`<p style="font-size:26px;font-weight:700;color:#000"${isUrdu ? ' class="urdu"' : ''}>${notesDisplay}</p></div>`);
  }

  // ─── PRODUCTS TABLE ───
  const ru = (t) => isUrdu && t ? romanToUrdu(t) : t;
  win.document.write(`<div class="section-title" style="font-size:26px">${sec.products}</div>`);
  if (isMultiItem) {
    const showCap = orderType !== 'STANDARD';
    const headers = ['#', sec.product, sec.fabricColor, sec.sizeGender, sec.qty].concat(showCap ? [sec.cap] : []).concat([sec.price]);
    win.document.write(`<table><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    allItems.forEach((item, idx) => {
      const p = item.productDetails || {};
      const capQty = showCap && p.matchingCap ? (p.matchingCapQty || 0) : (showCap && item.capCharges > 0 ? (p.femaleOptions?.cap || 0) : 0);
      win.document.write(`<tr>`);
      win.document.write(`<td style="font-weight:700">${idx + 1}</td>`);
      win.document.write(`<td style="font-weight:700">${ru(p.productType)}</td>`);
      win.document.write(`<td>${[ru(p.fabricType), ru(p.color)].filter(Boolean).join(' • ')}</td>`);
      const extras = [p.sleeveLength ? `${sec.sleeves}: ${slDisplay(p.sleeveLength)}` : null, p.shirtLength ? `${sec.length}: ${shDisplay(p.shirtLength)}` : null].filter(Boolean).join(' | ');
      win.document.write(`<td>${ru(p.size || sec.custom)} • ${ru(p.gender || 'Male')}${extras ? ` • ${extras}` : ''}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:700">${item.quantity || 1}</td>`);
      if (showCap) win.document.write(`<td style="text-align:center;font-weight:700;color:#000">${capQty || '—'}</td>`);
      win.document.write(`<td style="text-align:right;font-weight:700">${priceDisplay(item.totalPrice)}</td>`);
      win.document.write(`</tr>`);
    });
    win.document.write(`</tbody></table>`);
  } else {
    const showCap = orderType !== 'STANDARD';
    const capQty = showCap && firstProduct.matchingCap ? (firstProduct.matchingCapQty || 0) : 0;
    const headers = [sec.product, sec.fabric, sec.color, sec.size, sec.gender, sec.qty].concat(showCap ? [sec.cap] : []).concat([sec.price]);
    win.document.write(`<table><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    win.document.write(`<tr>`);
    win.document.write(`<td style="font-weight:700">${ru(firstProduct.productType)}</td>`);
    win.document.write(`<td>${ru(firstProduct.fabricType)}</td>`);
    win.document.write(`<td>${ru(firstProduct.color)}</td>`);
    const extras = [firstProduct.sleeveLength ? `${sec.sleeves}: ${slDisplay(firstProduct.sleeveLength)}` : null, firstProduct.shirtLength ? `${sec.length}: ${shDisplay(firstProduct.shirtLength)}` : null].filter(Boolean).join(' | ');
    win.document.write(`<td>${ru(firstProduct.size || sec.custom)}</td>`);
    win.document.write(`<td>${ru(firstProduct.gender || sec.male)}${extras ? ` ${extras}` : ''}</td>`);
    win.document.write(`<td style="text-align:center;font-weight:700">${order.quantity || 1}</td>`);
    if (showCap) win.document.write(`<td style="text-align:center;font-weight:700;color:#000">${capQty || '—'}</td>`);
    win.document.write(`<td style="text-align:right;font-weight:700">${priceDisplay(order.totalPrice)}</td>`);
    win.document.write(`</tr></tbody></table>`);
  }

  // ─── ENGRAVING ───
  if (orderType !== 'STANDARD' && showEngraving) {
    const brandingItems = isMultiItem ? allItems : [{ productDetails: firstProduct, customization: custom }];
    const hasAnyCustomization = brandingItems.some(item => {
      const c = item.customization ? (typeof item.customization === 'string' ? JSON.parse(item.customization) : item.customization) : custom;
      if (c?.skipEngraving) return false;
      return c?.engravingType || c?.nameSpelling?.trim() || c?.nameColor || c?.logoPlacement || c?.logos?.length > 0 || c?.designNotes || c?.articleNames?.filter(n => n?.trim())?.length > 0;
    });
    if (!hasAnyCustomization) { /* no customization data, skip engraving section */ }
    else {
      win.document.write(`<div class="section-title" style="font-size:26px">${sec.engraving}</div>`);
      brandingItems.forEach((item, idx) => {
        const p = item.productDetails || {};
        const c = item.customization ? parseJSON(item.customization) : custom;
        const filteredNames = c?.articleNames?.filter(n => n?.trim()) || [];
        const hasNames = filteredNames.length > 0 || c?.nameSpelling?.trim();
        const hasLogos = c?.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0;
        const hasSpecs = c?.nameColor || c?.logoPlacement || c?.engravingType;
        const hasNotes = c?.designNotes;

        if (!hasNames && !hasLogos && !hasSpecs && !hasNotes) return;

        win.document.write(`<div style="border:2px solid #ddd;border-radius:8px;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid">`);
        win.document.write(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #eee">`);
        win.document.write(`<span style="background:#111;color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800">${idx + 1}</span>`);
          win.document.write(`<span style="font-weight:900;font-size:22px;text-transform:uppercase">${ru(p.productType) || 'Item ' + (idx + 1)}</span>`);
        if (p.color) win.document.write(`<span style="font-size:18px;color:#000">(${ru(p.color)})</span>`);
        win.document.write(`</div>`);

        // Engraving Type
        if (c?.engravingType) {
          win.document.write(`<div style="margin-bottom:6px">`);
          const engravingLabel = c.engravingType === 'direct' ? sec.directEngraving : sec.patchEngraving;
          win.document.write(`<p style="font-size:18px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:2px"${isUrdu ? ' class="urdu"' : ''}>${sec.engravingType}: ${engravingLabel}</p>`);
          win.document.write(`</div>`);
        }

        // Name Lines
        if (hasNames) {
          win.document.write(`<div style="margin-bottom:6px">`);
          win.document.write(`<p style="font-size:20px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.nameLines}</p>`);
          if (filteredNames.length > 0) {
            filteredNames.forEach((an, ai) => {
              win.document.write(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="background:#7c3aed20;color:#7c3aed;font-size:18px;font-weight:800;padding:2px 6px;border-radius:3px">L${ai + 1}</span><span style="font-size:24px;font-weight:700">${ru(an)}</span></div>`);
            });
          } else {
            win.document.write(`<div style="display:flex;align-items:center;gap:6px"><span style="background:#7c3aed20;color:#7c3aed;font-size:18px;font-weight:800;padding:2px 6px;border-radius:3px">L1</span><span style="font-size:24px;font-weight:700">${ru(c.nameSpelling)}</span></div>`);
          }
          win.document.write(`</div>`);
        }

        // Specs badges
        if (hasSpecs) {
          win.document.write(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">`);
          if (c.nameColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#fce7f3;color:#9d174d">${sec.color}: ${ru(c.nameColor)}</span>`);
          if (c.logoPlacement) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#ccfbf1;color:#0f766e">${sec.position}: ${ru(c.logoPlacement)}</span>`);
          if (c.logoColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#fef3c7;color:#92400e">${isUrdu ? 'لوگو:' : 'Logo:'} ${ru(c.logoColor)}</span>`);
          win.document.write(`</div>`);
        }

        // Logos
        if (hasLogos) {
          win.document.write(`<div style="margin-bottom:6px">`);
          win.document.write(`<p style="font-size:20px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.logos}</p>`);
          c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).forEach((l, li) => {
            win.document.write(`<div style="font-size:22px;font-weight:700;background:#fffbeb;padding:3px 8px;border-radius:4px;margin-bottom:2px;border:2px solid #fef3c7">${ru(l.name) || l.design}${l.name && l.design ? ` — ${ru(l.design)}` : ''}</div>`);
          });
          win.document.write(`</div>`);
        }

        // Special Notes
        if (hasNotes) {
          const notesDisplay = isUrdu ? romanToUrdu(c.designNotes) : c.designNotes;
          win.document.write(`<div style="background:#fef3c7;border-left:4px solid #d97706;padding:6px 10px;border-radius:4px">`);
          win.document.write(`<p style="font-size:18px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:2px"${isUrdu ? ' class="urdu"' : ''}>${sec.specialNote}</p>`);
          win.document.write(`<p style="font-size:22px;font-style:italic;color:#000"${isUrdu ? ' class="urdu"' : ''}>${notesDisplay}</p></div>`);
        }

        // Matching Cap
        const capQty = p.matchingCap ? (p.matchingCapQty || 0) : 0;
        if (capQty > 0) {
          win.document.write(`<p style="font-size:20px;margin-top:4px;color:#000;font-weight:700">${sec.matchingCap} ×${capQty}</p>`);
        }

        win.document.write(`</div>`);
      });
    }
  }
  // ─── MEASUREMENTS ───
  if (orderType === 'FULL_CUSTOM' && showMeas) {
    const measItems = isMultiItem ? allItems : [{ productDetails: firstProduct, sizeData: sizes }];
    const hasAnyMeas = measItems.some(item => {
      const s = item.sizeData || {};
      return Object.entries(s).some(([k, v]) => v && k !== 'specialNote');
    });
    if (hasAnyMeas) {
      win.document.write(`<div class="section-title" style="font-size:26px">${sec.measurements}</div>`);
      measItems.forEach((item, idx) => {
        const p = item.productDetails || {};
        const s = item.sizeData || {};
        const productSize = p.size || 'Custom';
        const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'C'];
        win.document.write(`<div style="margin-bottom:6px;page-break-inside:avoid">`);
        if (isMultiItem) {
          win.document.write(`<p style="font-size:20px;font-weight:900;text-transform:uppercase;color:#000;margin-bottom:4px">#${idx + 1} ${ru(p.productType) || ''}</p>`);
        }
        win.document.write(`<div style="display:flex;gap:4px;flex-wrap:wrap">`);
        allSizes.forEach(sz => {
          const isSelected = sz === productSize || (sz === 'C' && productSize === 'Custom');
          win.document.write(`<div style="text-align:center;border:2px solid ${isSelected ? '#000' : '#ccc'};border-radius:6px;padding:6px 14px;background:${isSelected ? '#000' : '#fff'};color:${isSelected ? '#fff' : '#666'};font-size:18px;font-weight:800">${sz}</div>`);
        });
        win.document.write(`</div>`);
        // Sleeve / Shirt Length
        const slv = p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves ? p.femaleOptions.sleeves : null);
        const slen = p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength ? p.femaleOptions.shirtLength : null);
        const opts = [slv ? `${sec.sleeves}: ${slv && p.sleeveLength ? slDisplay(slv) : (femSlMap[slv] || slv)}` : null, slen ? `${sec.length}: ${slen && p.shirtLength ? shDisplay(slen) : (femShMap[slen] || slen)}` : null, (p.gender === 'Female' && p.femaleOptions?.dupatta) ? sec.dupatta : null].filter(Boolean);
        if (opts.length > 0) {
          win.document.write(`<p style="font-size:20px;margin-top:6px;color:#000;font-weight:700">${opts.join(' | ')}</p>`);
        }
        const ic = item.customization ? (typeof item.customization === 'string' ? JSON.parse(item.customization) : item.customization) : custom;
        const hasAttr = ic?.fitType || p.fabricSourceProduct || p.colorSourceProduct || p.designSourceProduct || p.sizeSourceProduct || p.additionalProductRef;
        if (hasAttr) {
          win.document.write(`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">`);
          if (ic?.fitType) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc">${ru(ic.fitType)} ${ru('Fit')}</span>`);
          if (p.fabricSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.fabricSource}: ${ru(p.fabricSourceProduct)}</span>`);
          if (p.colorSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.colorSource}: ${ru(p.colorSourceProduct)}</span>`);
          if (p.designSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.designSource}: ${ru(p.designSourceProduct)}</span>`);
          if (p.sizeSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.sizeSource}: ${ru(p.sizeSourceProduct)}</span>`);
          if (p.additionalProductRef) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.extra}: ${ru(p.additionalProductRef)}</span>`);
          win.document.write(`</div>`);
        }
        if (s.specialNote) {
          win.document.write(`<div style="margin-top:6px;background:#fef9e7;border:2px solid #f0c040;border-radius:6px;padding:8px 12px"><p style="font-size:18px;font-weight:800;color:#b8860b;margin-bottom:2px"${isUrdu ? ' class="urdu-text"' : ''}>${sec.specialNote}</p><p style="font-size:20px;font-weight:600;color:#8b6914;font-style:italic"${isUrdu ? ' class="urdu-text"' : ''}>${ru(s.specialNote)}</p></div>`);
        }
        win.document.write(`</div>`);
      });
    }
  }

  // ─── FOOTER ───
  win.document.write(`<div style="display:flex;justify-content:space-between;font-size:18px;color:#000;border-top:2px solid #ddd;padding-top:6px;margin-top:8px">`);
  win.document.write(`<span>${sec.orderEntryDate}: ${entryDate}</span>`);
  win.document.write(`<span${isUrdu ? ' class="urdu-text"' : ''}>${ru(orderType.replace(/_/g, ' '))}</span>`);
  win.document.write(`</div>`);

  closePrintWindow(win, isUrdu);
}
