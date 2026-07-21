import { toUrduName } from './urduDictionary';
import { getPrintLogoHTML, getPrintFooterHTML } from './printTemplate';

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 15mm 10mm 15mm 10mm; }
  @font-face { font-family: 'Noto Nastaliq Urdu'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNastaliqUrdu-Regular.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Nastaliq Urdu'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNastaliqUrdu-Medium.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Nastaliq Urdu'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNastaliqUrdu-SemiBold.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Nastaliq Urdu'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNastaliqUrdu-Bold.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNaskhArabic-Medium.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNaskhArabic-SemiBold.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNaskhArabic-Bold.ttf') format('truetype'); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Jameel Noori Nastaleeq', serif;
    color: #000;
    background: #fff;
    font-size: 17px;
    font-weight: 500;
    line-height: 2.0;
    word-spacing: 2px;
    letter-spacing: 0;
    padding: 0;
    direction: ltr;
  }
  .urdu { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; direction: rtl; text-align: right; }
  .report-header {
    text-align: center;
    border-bottom: 1.2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .report-header h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
  .report-header p { font-size: 16px; color: #000; margin-top: 3px; font-weight: 700; }
  .report-meta {
    display: flex;
    justify-content: space-between;
    font-size: 16px;
    font-weight: 700;
    color: #000;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
  }
  th {
    background: none;
    color: #000;
    padding: 10px 12px;
    text-align: left;
    font-size: 17px;
    font-weight: 700;
    text-transform: uppercase;
    border-bottom: 1.2px solid #000;
    letter-spacing: 0;
  }
  td {
    padding: 10px 12px;
    border: 1.2px solid #000;
    font-weight: 500;
    font-size: 17px;
    line-height: 2.1;
  }
  td.num {
    font-family: Inter, Arial, sans-serif;
    font-size: 15px;
    font-weight: 600;
  }
  .product-name { font-size: 18px; font-weight: 600; line-height: 2.1; }
  .section-title {
    font-size: 19px;
    font-weight: 700;
    margin: 14px 0 8px;
    text-transform: uppercase;
    color: #000;
    border-bottom: 1.2px solid #000;
    padding-bottom: 4px;
    letter-spacing: 0;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .summary-card {
    border: 1.2px solid #000;
    border-radius: 0;
    padding: 10px;
    text-align: center;
  }
  .summary-card .label { font-size: 14px; font-weight: 600; text-transform: uppercase; color: #000; letter-spacing: 0; }
  .summary-card .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid #000;
    font-size: 16px;
    font-weight: 700;
  }
  .summary-row:last-child { border-bottom: none; }
  .footer {
    text-align: center;
    font-family: Inter, Arial, sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #000;
    border-top: 1.2px solid #000;
    padding-top: 8px;
    margin-top: 20px;
  }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 0;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    border: 1.2px solid #000;
    color: #000;
    background: #fff;
  }
  .status-ok, .status-warn, .status-bad, .status-info {
    color: #000;
    background: #fff;
  }

  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

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
 * Handles: English â†’ Urdu, Roman Urdu â†’ Urdu, mixed text
 * Preserves numbers, codes, IDs
 * Pattern-based for natural Roman Urdu phrases
 */
/** Custom phonetic dictionary â€” checked before patterns/dictionary */
const customDict = {
  // Colors (phonetic â€” not literal)
  'purple': 'Ù¾Ø±Ù¾Ù„', 'black': 'Ø¨Ù„ÛŒÚ©', 'white': 'ÙˆØ§Ø¦Ù¹', 'blue': 'Ø¨Ù„ÛŒÙˆ',
  'red': 'Ø±ÛŒÚˆ', 'green': 'Ú¯Ø±ÛŒÙ†', 'yellow': 'ÛŒÙ„Ùˆ', 'pink': 'Ù¾Ù†Ú©',
  'orange': 'Ø§ÙˆØ±ÛŒÙ†Ø¬', 'golden': 'Ú¯ÙˆÙ„ÚˆÙ†', 'silver': 'Ø³Ù„ÙˆØ±',
  'grey': 'Ú¯Ø±Û’', 'gray': 'Ú¯Ø±Û’', 'brown': 'Ø¨Ø±Ø§Ø¤Ù†',
  'maroon': 'Ù…ÛŒØ±ÙˆÙ†', 'cream': 'Ú©Ø±ÛŒÙ…', 'beige': 'Ø¨ÛŒØ¬',
  'navy': 'Ù†ÛŒÙˆÛŒ', 'mustard': 'Ù…Ø³Ù¹Ø±Úˆ',
  // Multi-word & specialty colors
  'navy blue': 'Ù†ÛŒÙˆÛŒ Ø¨Ù„ÛŒÙˆ',
  'royal blue': 'Ø±Ø§Ø¦Ù„ Ø¨Ù„ÛŒÙˆ',
  'sky blue': 'Ø§Ø³Ú©Ø§Ø¦ÛŒ Ø¨Ù„ÛŒÙˆ',
  'dark grey': 'ÚˆØ§Ø±Ú© Ú¯Ø±Û’',
  'dark gray': 'ÚˆØ§Ø±Ú© Ú¯Ø±Û’',
  'silver grey': 'Ø³Ù„ÙˆØ± Ú¯Ø±Û’',
  'silver gray': 'Ø³Ù„ÙˆØ± Ú¯Ø±Û’',
  'sage': 'Ø³ÛŒØ¬',
  'sage green': 'Ø³ÛŒØ¬ Ú¯Ø±ÛŒÙ†',
  'olive green': 'Ø§ÙˆÙ„ÛŒÙˆ Ú¯Ø±ÛŒÙ†',
  'olive emboss': 'Ø§ÙˆÙ„ÛŒÙˆ Ø§ÛŒÙ…Ø¨ÙˆØ³',
  'ivy green': 'Ø¢Ø¦ÛŒÙˆÛŒ Ú¯Ø±ÛŒÙ†',
  'sea green': 'Ø³ÛŒ Ú¯Ø±ÛŒÙ†',
  'bell bottom sea-green': 'Ø¨ÛŒÙ„ Ø¨Ø§Ù¹Ù… Ø³ÛŒ Ú¯Ø±ÛŒÙ†',
  'ecg white': 'Ø§ÛŒ Ø³ÛŒ Ø¬ÛŒ ÙˆØ§Ø¦Ù¹',
  'ecg black': 'Ø§ÛŒ Ø³ÛŒ Ø¬ÛŒ Ø¨Ù„ÛŒÚ©',
  'ecg': 'Ø§ÛŒ Ø³ÛŒ Ø¬ÛŒ',
  'propofol': 'Ù¾Ø±ÙˆÙ¾ÙˆÙÙˆÙ„',
  'ent': 'Ø§ÛŒ Ø§ÛŒÙ† Ù¹ÛŒ',
  'molar': 'Ù…ÙˆÙ„Ø±',
  'ajrak': 'Ø§Ø¬Ø±Ú©',
  'batman': 'Ø¨ÛŒÙ¹ Ù…ÛŒÙ†',
  'x-ray': 'Ø§ÛŒÚ©Ø³ Ø±Û’',
  'brain': 'Ø¨Ø±ÛŒÙ†',
  'funky radiology': 'ÙÙ†Ú©ÛŒ Ø±ÛŒÚˆÛŒØ§Ù„ÙˆØ¬ÛŒ',
  'general surgery': 'Ø¬Ù†Ø±Ù„ Ø³Ø±Ø¬Ø±ÛŒ',
  'medical logos': 'Ù…ÛŒÚˆÛŒÚ©Ù„ Ù„ÙˆÚ¯ÙˆØ²',
  'cardinal rosa': 'Ú©Ø§Ø±ÚˆÛŒÙ†Ù„ Ø±ÙˆØ²Ø§',
  'vat navy': 'ÙˆÛŒÙ¹ Ù†ÛŒÙˆÛŒ',
  'montana pick': 'Ù…ÙˆÙ†Ù¹Ø§Ù†Ø§ Ù¾ÙÚ©',
  'peach dusk': 'Ù¾ÛŒÚ† ÚˆØ³Ú©',
  'black shine': 'Ø¨Ù„ÛŒÚ© Ø´Ø§Ø¦Ù†',
  'zinc': 'Ø²Ù†Ú©',
  'burgundy': 'Ø¨Ø±Ú¯Ù†ÚˆÛŒ',
  'camel': 'Ú©ÛŒÙ…Ù„',
  'rust': 'Ø±Ø³Ù¹',
  'mehroon': 'Ù…ÛØ±ÙˆÙ†',
  'grace': 'Ú¯Ø±ÛŒØ³',
  'maternity': 'Ù…ÛŒÙ¹Ø±Ù†Ù¹ÛŒ',
  'stormy': 'Ø³Ù¹ÙˆØ±Ù…ÛŒ',
  'dental': 'ÚˆÛŒÙ†Ù¹Ù„',
  'gray nova': 'Ú¯Ø±Û’ Ù†ÙˆÙˆØ§',
  'grey nova': 'Ú¯Ø±Û’ Ù†ÙˆÙˆØ§',
  'navy nova': 'Ù†ÛŒÙˆÛŒ Ù†ÙˆÙˆØ§',
  'pink nova': 'Ù¾Ù†Ú© Ù†ÙˆÙˆØ§',
  'influential pink nova': 'Ø§Ù†ÙÙ„ÙˆØ¦Ù†Ø´Ù„ Ù¾Ù†Ú© Ù†ÙˆÙˆØ§',
  'grey nova 2': 'Ú¯Ø±Û’ Ù†ÙˆÙˆØ§ 2',
  'black nova 2.0': 'Ø¨Ù„ÛŒÚ© Ù†ÙˆÙˆØ§ 2.0',
  // Production measurements (phonetic)
  'bottom': 'Ø¨Ø§Ù¹Ù…', 'hip': 'ÛÙ¾', 'hips': 'ÛÙ¾',
  'waist': 'ÙˆÛŒØ³Ù¹', 'thigh': 'ØªÚ¾Ø§Ø¦ÛŒ', 'thighs': 'ØªÚ¾Ø§Ø¦Ø²',
  'belt': 'Ø¨ÛŒÙ„Ù¹', 'narrow': 'Ù†ÛŒØ±Ùˆ',
  // Proper Urdu for specific terms
  'chest': 'Ú†Ú¾Ø§ØªÛŒ',
  'length': 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ', 'sleeve': 'Ø¢Ø³ØªÛŒÙ†',
  'shoulder': 'Ú©Ù†Ø¯Ú¾Ø§', 'neck': 'Ú¯Ø±Ø¯Ù†',
  'armhole': 'Ø¨ØºÙ„', 'bicep': 'Ø¹Ø¶Ù„Û',
  'wrist': 'Ú©Ù„Ø§Ø¦ÛŒ', 'inseam': 'Ø§Ù† Ø³ÛŒÙˆÙ†',
  'outseam': 'Ø¢Ø¤Ù¹ Ø³ÛŒÙˆÙ†', 'calf': 'Ù¾Ù†ÚˆÙ„ÛŒ',
  'ankle': 'Ù¹Ø®Ù†Û', 'mori': 'Ù…ÙˆÚ‘ÛŒ', 'ganda': 'Ú¯Ø§Ù†ÚˆØ§',
  'trouser': 'Ù¾ØªÙ„ÙˆÙ†',
  // Product names
  'sprinter': 'Ø³Ù¾Ø±Ù†Ù¹Ø±',
  'unisex': 'ÛŒÙˆÙ†ÛŒ Ø³ÛŒÚ©Ø³',
  'joggers': 'Ø¬Ø§Ú¯Ø±Ø²',
  'ketamine': 'Ú©ÛŒÙ¹Ø§Ù…ÛŒÙ†',
  'katamine': 'Ú©ÛŒÙ¹Ø§Ù…ÛŒÙ†',
  'men': 'Ù…ÛŒÙ†',
  'women': 'ÙˆÛŒÙ…Ù†',
  // Full product names
  'accessories': 'Ø§ÛŒÚ©Ø³Ø³Ø±ÛŒØ²',
  'plain surgical caps': 'Ù¾Ù„Û’Ù† Ø³ÙˆØ±Ú¯ÛŒÚ©Ø§Ù„ Ú©Ø§Ù¾Ø³',
  'inner tees': 'Ø§Ù†Ø± Ù¹ÛŒØ²',
  'sleeves': 'Ø³Ù„ÛŒÙˆØ²',
  'bottle': 'Ø¨Ø§Ù¹Ù„',
  'temperature bottle': 'Ù¹ÛŒÙ…Ù¾Ø±ÛŒÚ†Ø± Ø¨Ø§Ù¹Ù„',
  'caps': 'Ú©Ø§Ù¾Ø³',
  'sprinter cap unisex': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ú©ÛŒÙ¾ ÛŒÙˆÙ†ÛŒ Ø³ÛŒÚ©Ø³',
  'clogs': 'Ú©Ù„Ø§Ú¯Ø²',
  'flufftail': 'ÙÙ„Ù Ù¹ÛŒÙ„',
  'monostarlings': 'Ù…ÙˆÙ†Ùˆ Ø³Ù¹Ø§Ø±Ù„Ù†Ú¯Ø²',
  'muffle bird sole': 'Ù…ÙÙ„ Ø¨Ø±Úˆ Ø³ÙˆÙ„',
  'snug-blockies': 'Ø³Ù†Ú¯ Ø¨Ù„Ø§Ú©ÛŒØ²',
  'tumble jays': 'Ù¹Ù…Ø¨Ù„ Ø¬ÛŒØ²',
  'work duo': 'ÙˆØ±Ú© ÚˆÙˆØ¤',
  'labcoat': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹',
  'lab coat women wrinkle free': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ ÙˆÛŒÙ…Ù† Ø±ÙÙ†Ú©Ù„ ÙØ±ÛŒ',
  'lab-coat women wrinkle free': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ ÙˆÛŒÙ…Ù† Ø±ÙÙ†Ú©Ù„ ÙØ±ÛŒ',
  'lab-coat men suiting': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ Ù…ÛŒÙ† Ø³ÙˆÙ¹Ù†Ú¯',
  'lab coat men suiting': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ Ù…ÛŒÙ† Ø³ÙˆÙ¹Ù†Ú¯',
  'lab-coat men wrinkle free': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ Ù…ÛŒÙ† Ø±ÙÙ†Ú©Ù„ ÙØ±ÛŒ',
  'lab coat men wrinkle free': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ Ù…ÛŒÙ† Ø±ÙÙ†Ú©Ù„ ÙØ±ÛŒ',
  'scrubs': 'Ø§Ø³Ú©Ø±Ø¨Ø²',
  'basic men': 'Ø¨ÛŒØ³Ú© Ù…ÛŒÙ†',
  'cotton': 'Ú©Ø§Ù¹Ù†',
  'crown women': 'Ú©Ø±Ø§Ø¤Ù† ÙˆÛŒÙ…Ù†',
  'crown men': 'Ú©Ø±Ø§Ø¤Ù† Ù…ÛŒÙ†',
  'flexfit unisex': 'ÙÙ„ÛŒÚ©Ø³ ÙÙ¹ ÛŒÙˆÙ†ÛŒ Ø³ÛŒÚ©Ø³',
  'lab-coat women suiting': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ ÙˆÛŒÙ…Ù† Ø³ÙˆÙ¹Ù†Ú¯',
  'lab coat women suiting': 'Ù„ÛŒØ¨ Ú©ÙˆÙ¹ ÙˆÛŒÙ…Ù† Ø³ÙˆÙ¹Ù†Ú¯',
  'sprinter explode men': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ø§ÛŒÚ©Ø³Ù¾Ù„ÙˆÚˆ Ù…ÛŒÙ†',
  'sprinter explode women': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ø§ÛŒÚ©Ø³Ù¾Ù„ÙˆÚˆ ÙˆÛŒÙ…Ù†',
  'sprinter gradient men': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ú¯Ø±ÛŒÚˆÛŒÙ†Ù¹ Ù…ÛŒÙ†',
  'sprinter gradient women': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ú¯Ø±ÛŒÚˆÛŒÙ†Ù¹ ÙˆÛŒÙ…Ù†',
  'sprinter joggers men': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ø¬Ø§Ú¯Ø±Ø² Ù…ÛŒÙ†',
  'sprinter joggers women': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ø¬Ø§Ú¯Ø±Ø² ÙˆÛŒÙ…Ù†',
  'sprinter men': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ù…ÛŒÙ†',
  'sprinter nova men': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ù†ÙˆÙˆØ§ Ù…ÛŒÙ†',
  'sprinter nova women': 'Ø³Ù¾Ø±Ù†Ù¹Ø± Ù†ÙˆÙˆØ§ ÙˆÛŒÙ…Ù†',
  'sprinter women': 'Ø³Ù¾Ø±Ù†Ù¹Ø± ÙˆÛŒÙ…Ù†',
  'tote bag': 'Ù¹ÙˆÙ¹ Ø¨ÛŒÚ¯',
  'velora men': 'ÙˆÛŒÙ„ÙˆØ±Ø§ Ù…ÛŒÙ†',
  'velora men summit': 'ÙˆÛŒÙ„ÙˆØ±Ø§ Ù…ÛŒÙ† Ø³Ù…Ù¹',
  'velora women': 'ÙˆÛŒÙ„ÙˆØ±Ø§ ÙˆÛŒÙ…Ù†',
  'velora women long skirt': 'ÙˆÛŒÙ„ÙˆØ±Ø§ ÙˆÛŒÙ…Ù† Ù„Ø§Ù†Ú¯ Ø§Ø³Ú©Ø±Ù¹',
  'velora women summit': 'ÙˆÛŒÙ„ÙˆØ±Ø§ ÙˆÛŒÙ…Ù† Ø³Ù…Ù¹',
  'aeros': 'Ø§ÛŒØ±ÙˆØ³',
  'socks': 'Ø³Ø§Ú©Ø³',
};

export function romanToUrdu(text) {
  try {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map(line => romanToUrduSingleLine(line)).join('\n');
  } catch (e) {
    return text;
  }
}

function romanToUrduSingleLine(text) {
  try {
  if (!text) return '';
  if (/^[\d\s\-./#]+$/.test(text)) return text;
  // Check custom phonetic dictionary first (exact match)
  const ckey = text.trim().toLowerCase();
  if (customDict[ckey]) return customDict[ckey];

  let result = text.trim();

  // â”€â”€â”€ PRE-PROCESSING â”€â”€â”€
  // Normalize whitespace
  result = result.replace(/[ \t]+/g, ' ');
  // If already mostly Urdu, return as-is
  const urduChars = (result.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = result.replace(/\s/g, '').length;
  if (totalChars > 0 && urduChars / totalChars > 0.5) return result;

  const lower = result.toLowerCase();

  // â”€â”€â”€ PATTERN-BASED REPLACEMENTS (Roman Urdu grammar) â”€â”€â”€
  // These handle common Roman Urdu sentence structures
  const patterns = [
    // "[adj] color" â†’ "[adj] Ø±Ù†Ú¯"  (e.g., "lal color" â†’ "Ù„Ø§Ù„ Ø±Ù†Ú¯")
    { regex: /\b(lal|laal)\s+color\b/gi, replace: 'Ù„Ø§Ù„ Ø±Ù†Ú¯' },
    { regex: /\b(neela|neela|nila)\s+color\b/gi, replace: 'Ù†ÛŒÙ„Ø§ Ø±Ù†Ú¯' },
    { regex: /\b(hara|haara)\s+color\b/gi, replace: 'Ø³Ø¨Ø² Ø±Ù†Ú¯' },
    { regex: /\b(peela|peela|pila)\s+color\b/gi, replace: 'Ù¾ÛŒÙ„Ø§ Ø±Ù†Ú¯' },
    { regex: /\b(narangi|orange)\s+color\b/gi, replace: 'Ù†Ø§Ø±Ù†Ø¬ÛŒ Ø±Ù†Ú¯' },
    { regex: /\b(gulabi|pink)\s+color\b/gi, replace: 'Ú¯Ù„Ø§Ø¨ÛŒ Ø±Ù†Ú¯' },
    { regex: /\b(bhoora|brown)\s+color\b/gi, replace: 'Ø¨Ú¾ÙˆØ±Ø§ Ø±Ù†Ú¯' },
    { regex: /\b(safed|white)\s+color\b/gi, replace: 'Ø³ÙÛŒØ¯ Ø±Ù†Ú¯' },
    { regex: /\b(kala|kalaa|black)\s+color\b/gi, replace: 'Ø³ÛŒØ§Û Ø±Ù†Ú¯' },
    { regex: /\b(surkh?i?|red)\s+color\b/gi, replace: 'Ø³Ø±Ø® Ø±Ù†Ú¯' },
    { regex: /\b(grey|gray)\s+color\b/gi, replace: 'Ú¯Ø±Û’ Ø±Ù†Ú¯' },
    { regex: /\b(badami|skin)\s+color\b/gi, replace: 'Ø¨Ø§Ø¯Ø§Ù…ÛŒ Ø±Ù†Ú¯' },
    { regex: /\b(bottle green|bottle)\s+color\b/gi, replace: 'Ø¨ÙˆØªÙ„ Ú¯Ø±ÛŒÙ†' },
    { regex: /\b(navy|navy blue)\s+color\b/gi, replace: 'Ù†ÛŒÙˆÛŒ Ø¨Ù„ÛŒÙˆ' },
    { regex: /\b(maroon)\s+color\b/gi, replace: 'Ù…ÛŒØ±ÙˆÙ† Ø±Ù†Ú¯' },
    { regex: /\b(golden|gold)\s+color\b/gi, replace: 'Ú¯ÙˆÙ„ÚˆÙ† Ø±Ù†Ú¯' },
    { regex: /\b(silver)\s+color\b/gi, replace: 'Ø³Ù„ÙˆØ± Ø±Ù†Ú¯' },
    { regex: /\b(purple)\s+color\b/gi, replace: 'Ù¾Ø±Ù¾Ù„ Ø±Ù†Ú¯' },

    // "left/right [body part] [action]" patterns
    // "left sleeve logo" â†’ "Ø¨Ø§Ø¦ÛŒÚº Ø¢Ø³ØªÛŒÙ† Ù¾Ø± Ù„ÙˆÚ¯Ùˆ"
    { regex: /\bleft\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+logo\b/gi, replace: 'Ø¨Ø§Ø¦ÛŒÚº $1 Ù¾Ø± Ù„ÙˆÚ¯Ùˆ' },
    { regex: /\bright\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+logo\b/gi, replace: 'Ø¯Ø§Ø¦ÛŒÚº $1 Ù¾Ø± Ù„ÙˆÚ¯Ùˆ' },
    { regex: /\bleft\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+name\b/gi, replace: 'Ø¨Ø§Ø¦ÛŒÚº $1 Ù¾Ø± Ù†Ø§Ù…' },
    { regex: /\bright\s+(sleeve|arm|chest|pocket|side|shoulder|thigh|leg)\s+name\b/gi, replace: 'Ø¯Ø§Ø¦ÛŒÚº $1 Ù¾Ø± Ù†Ø§Ù…' },
    { regex: /\bleft\s+side\b/gi, replace: 'Ø¨Ø§Ø¦ÛŒÚº Ø¬Ø§Ù†Ø¨' },
    { regex: /\bright\s+side\b/gi, replace: 'Ø¯Ø§Ø¦ÛŒÚº Ø¬Ø§Ù†Ø¨' },

    // "[body part] pe/par [action]" patterns
    // "name chest pe" â†’ "Ø³ÛŒÙ†Û’ Ù¾Ø± Ù†Ø§Ù…"
    { regex: /\b(name|logo|design|embroidery|print|writing)\s+(chest|seena|sine|gala|neck|sleeve|bazu|kandha|shoulder|pocket|back|pith|thigh|leg)\s+(pe|par|pai)\b/gi, replace: '$2 Ù¾Ø± $1' },
    // "chest pe name" â†’ "Ø³ÛŒÙ†Û’ Ù¾Ø± Ù†Ø§Ù…"
    { regex: /\b(chest|seena|sine|gala|neck|sleeve|bazu|kandha|shoulder|pocket|back|pith|thigh)\s+(pe|par|pai)\s+(name|logo|design|embroidery|print)\b/gi, replace: '$1 Ù¾Ø± $3' },

    // "samne [thing]" â†’ "Ø³Ø§Ù…Ù†Û’ [thing]"
    { regex: /\bsamne\s+(logo|name|design|print|embroidery|writing)\b/gi, replace: 'Ø³Ø§Ù…Ù†Û’ $1' },
    // "[thing] samne" â†’ "[thing] Ø³Ø§Ù…Ù†Û’"
    { regex: /\b(logo|name|design|print|embroidery)\s+samne\b/gi, replace: '$1 Ø³Ø§Ù…Ù†Û’' },

    // "andar [thing]" â†’ "Ø§Ù†Ø¯Ø± [thing]"
    { regex: /\bandar\s+(logo|name|design|print|writing|embroidery)\b/gi, replace: 'Ø§Ù†Ø¯Ø± $1' },
    // "[thing] andar" â†’ "[thing] Ú©Û’ Ø§Ù†Ø¯Ø±"
    { regex: /\b(logo|name|design|print|writing)\s+andar\b/gi, replace: '$1 Ú©Û’ Ø§Ù†Ø¯Ø±' },

    // "gala [adj] karna" â†’ "[adj] Ú¯Ù„Ø§ Ø¨Ù†Ø§Ø¦ÛŒÚº"
    { regex: /\bgala\s+(round|gol|chota|small|bara|large|v|deep)\s+(karna|karain|karein|rakhna)\b/gi, replace: '$1 Ú¯Ù„Ø§ Ø¨Ù†Ø§Ø¦ÛŒÚº' },
    { regex: /\b(gola|round)\s+gala\b/gi, replace: 'Ú¯ÙˆÙ„ Ú¯Ù„Ø§' },
    { regex: /\bgala\s+(round|gol)\b/gi, replace: 'Ú¯ÙˆÙ„ Ú¯Ù„Ø§' },
    { regex: /\bgala\s+(chota|small)\b/gi, replace: 'Ú†Ú¾ÙˆÙ¹Ø§ Ú¯Ù„Ø§' },
    { regex: /\bgala\s+(bara|bada|large)\b/gi, replace: 'Ø¨Ú‘Ø§ Ú¯Ù„Ø§' },

    // "sleeve [adj] karna" â†’ "[adj] Ø¢Ø³ØªÛŒÙ†"
    { regex: /\bsleeve\s+(short|chota|full|lamba|long|half|aadha|quarter)\s+(karna|karain|rakhna)\b/gi, replace: '$2 Ø¢Ø³ØªÛŒÙ†' },
    { regex: /\bsleeve\s+(short|chota|small)\b/gi, replace: 'Ú†Ú¾ÙˆÙ¹ÛŒ Ø¢Ø³ØªÛŒÙ†' },
    { regex: /\bsleeve\s+(long|full|lamba)\b/gi, replace: 'Ù„Ù…Ø¨ÛŒ Ø¢Ø³ØªÛŒÙ†' },
    { regex: /\bsleeve\s+(half|aadha)\b/gi, replace: 'Ø¢Ø¯Ú¾ÛŒ Ø¢Ø³ØªÛŒÙ†' },
    { regex: /\bsleeve\s+(quarter)\b/gi, replace: 'Ú†ÙˆØªÚ¾Ø§Ø¦ÛŒ Ø¢Ø³ØªÛŒÙ†' },

    // "shirt [adj] karna" â†’ "[adj] Ù‚Ù…ÛŒØ¶"
    { regex: /\bshirt\s+(long|lamba|short|chota|regular)\s+(karna|karain|rakhna)\b/gi, replace: '$2 Ù‚Ù…ÛŒØ¶' },
    { regex: /\bshirt\s+(long|lamba)\b/gi, replace: 'Ù„Ù…Ø¨ÛŒ Ù‚Ù…ÛŒØ¶' },
    { regex: /\bshirt\s+(short|chota)\b/gi, replace: 'Ú†Ú¾ÙˆÙ¹ÛŒ Ù‚Ù…ÛŒØ¶' },
    { regex: /\bshirt\s+(regular)\b/gi, replace: 'Ø±ÛŒÚ¯ÙˆÙ„Ø± Ù‚Ù…ÛŒØ¶' },

    // "karna" verb suffix
    { regex: /\b(karna|karain|karein|rakhna|rakho|rako|lagana)\b/gi, replace: '' },

    // Common Roman Urdu measurement patterns
    { regex: /\b(lamba?i?|length)?\s*(\d+)\s*(inch|fit|feet|cm|meter)\b/gi, replace: '$2 Ø§Ù†Ú†' },
  ];

  for (const p of patterns) {
    result = result.replace(p.regex, p.replace);
  }

  // â”€â”€â”€ DICTIONARY-BASED REPLACEMENT (industry-specific terms) â”€â”€â”€
  const dictionary = {
    // Colors (English â†’ phonetic; Roman Urdu â†’ literal)
    'lal': 'Ù„Ø§Ù„', 'laal': 'Ù„Ø§Ù„', 'red': 'Ø±ÛŒÚˆ',
    'neela': 'Ù†ÛŒÙ„Ø§', 'nila': 'Ù†ÛŒÙ„Ø§', 'blue': 'Ø¨Ù„ÛŒÙˆ', 'navy blue': 'Ù†ÛŒÙˆÛŒ Ø¨Ù„ÛŒÙˆ',
    'hara': 'Ø³Ø¨Ø²', 'haara': 'Ø³Ø¨Ø²', 'green': 'Ú¯Ø±ÛŒÙ†', 'bottle green': 'Ø¨ÙˆØªÙ„ Ú¯Ø±ÛŒÙ†',
    'peela': 'Ù¾ÛŒÙ„Ø§', 'pila': 'Ù¾ÛŒÙ„Ø§', 'yellow': 'ÛŒÙ„Ùˆ',
    'narangi': 'Ù†Ø§Ø±Ù†Ø¬ÛŒ', 'orange': 'Ø§ÙˆØ±ÛŒÙ†Ø¬',
    'gulabi': 'Ú¯Ù„Ø§Ø¨ÛŒ', 'pink': 'Ù¾Ù†Ú©',
    'bhoora': 'Ø¨Ú¾ÙˆØ±Ø§', 'brown': 'Ø¨Ø±Ø§Ø¤Ù†',
    'safed': 'Ø³ÙÛŒØ¯', 'white': 'ÙˆØ§Ø¦Ù¹',
    'kala': 'Ø³ÛŒØ§Û', 'kalaa': 'Ø³ÛŒØ§Û', 'black': 'Ø¨Ù„ÛŒÚ©',
    'surkh': 'Ø³Ø±Ø®', 'surkhi': 'Ø³Ø±Ø®',
    'golden': 'Ú¯ÙˆÙ„ÚˆÙ†', 'gold': 'Ú¯ÙˆÙ„ÚˆÙ†',
    'silver': 'Ø³Ù„ÙˆØ±',
    'grey': 'Ú¯Ø±Û’', 'gray': 'Ú¯Ø±Û’',
    'purple': 'Ù¾Ø±Ù¾Ù„', 'jamni': 'Ø¬Ø§Ù…Ù†ÛŒ',
    'maroon': 'Ù…ÛŒØ±ÙˆÙ†',
    'badami': 'Ø¨Ø§Ø¯Ø§Ù…ÛŒ', 'skin': 'Ø¨Ø§Ø¯Ø§Ù…ÛŒ',
    'mustard': 'Ù…Ø³Ù¹Ø±Úˆ',
    'khaki': 'Ø®Ø§Ú©ÛŒ',
    'indigo': 'Ø§Ù†ÚˆÚ¯Ùˆ',
    'cream': 'Ú©Ø±ÛŒÙ…',
    'beige': 'Ø¨ÛŒØ¬',
    'magenta': 'Ù…ÛŒØ¬Ù†Ù¹Ø§',
    'turquoise': 'ÙÛŒØ±ÙˆØ²ÛŒ',
    'olive': 'Ø§ÙˆÙ„ÛŒÙˆ',
    'emboss': 'Ø§ÛŒÙ…Ø¨ÙˆØ³',

    // Body parts (tailoring)
    'chest': 'Ú†Ú¾Ø§ØªÛŒ', 'seena': 'Ø³ÛŒÙ†Û', 'sina': 'Ø³ÛŒÙ†Û',
    'shoulder': 'Ú©Ù†Ø¯Ú¾Ø§', 'kandha': 'Ú©Ù†Ø¯Ú¾Ø§',
    'waist': 'ÙˆÛŒØ³Ù¹', 'kamar': 'Ú©Ù…Ø±',
    'sleeve': 'Ø¢Ø³ØªÛŒÙ†', 'bazu': 'Ø¢Ø³ØªÛŒÙ†',
    'length': 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ',
    'thigh': 'ØªÚ¾Ø§Ø¦ÛŒ',
    'neck': 'Ú¯Ø±Ø¯Ù†', 'gardan': 'Ú¯Ø±Ø¯Ù†',
    'gala': 'Ú¯Ù„Ø§',
    'armhole': 'Ø¨ØºÙ„', 'baghal': 'Ø¨ØºÙ„',
    'bicep': 'Ø¹Ø¶Ù„Û',
    'wrist': 'Ú©Ù„Ø§Ø¦ÛŒ',
    'inseam': 'Ø§Ù† Ø³ÛŒÙˆÙ†',
    'outseam': 'Ø¢Ø¤Ù¹ Ø³ÛŒÙˆÙ†',
    'calf': 'Ù¾Ù†ÚˆÙ„ÛŒ',
    'ankle': 'Ù¹Ø®Ù†Û',
    'trouser': 'Ù¾ØªÙ„ÙˆÙ†', 'pant': 'Ù¾ØªÙ„ÙˆÙ†', 'pataloon': 'Ù¾ØªÙ„ÙˆÙ†',
    'shirt': 'Ù‚Ù…ÛŒØµ', 'kameez': 'Ù‚Ù…ÛŒØµ',
    'dupatta': 'Ø¯ÙˆÙ¾Ù¹Û',
    'zip': 'Ø²Ù¾',
    'button': 'Ø¨Ù¹Ù†', 'butan': 'Ø¨Ù¹Ù†',
    'pocket': 'Ø¬ÛŒØ¨', 'jeb': 'Ø¬ÛŒØ¨',
    'collar': 'Ú©Ø§Ù„Ø±', 'kolar': 'Ú©Ø§Ù„Ø±',
    'back': 'Ù¾Ø´Øª', 'pith': 'Ù¾Ø´Øª', 'peeth': 'Ù¾Ø´Øª',
    'front': 'Ø³Ø§Ù…Ù†Û’', 'samne': 'Ø³Ø§Ù…Ù†Û’', 'agay': 'Ø³Ø§Ù…Ù†Û’',
    'side': 'Ø¬Ø§Ù†Ø¨', 'janib': 'Ø¬Ø§Ù†Ø¨',

    // Positions & Directions
    'left': 'Ø¨Ø§Ø¦ÛŒÚº', 'bayen': 'Ø¨Ø§Ø¦ÛŒÚº', 'bayein': 'Ø¨Ø§Ø¦ÛŒÚº',
    'right': 'Ø¯Ø§Ø¦ÛŒÚº', 'dayen': 'Ø¯Ø§Ø¦ÛŒÚº', 'dayein': 'Ø¯Ø§Ø¦ÛŒÚº',
    'center': 'Ø¯Ø±Ù…ÛŒØ§Ù†', 'centre': 'Ø¯Ø±Ù…ÛŒØ§Ù†', 'middle': 'Ø¯Ø±Ù…ÛŒØ§Ù†', 'darmiyan': 'Ø¯Ø±Ù…ÛŒØ§Ù†',
    'up': 'Ø§ÙˆÙ¾Ø±', 'upper': 'Ø§ÙˆÙ¾Ø±', 'uper': 'Ø§ÙˆÙ¾Ø±',
    'down': 'Ù†ÛŒÚ†Û’', 'lower': 'Ù†ÛŒÚ†Û’', 'neeche': 'Ù†ÛŒÚ†Û’',
    'inside': 'Ø§Ù†Ø¯Ø±', 'andar': 'Ø§Ù†Ø¯Ø±',
    'outside': 'Ø¨Ø§ÛØ±', 'bahar': 'Ø¨Ø§ÛØ±',
    'top': 'Ø§ÙˆÙ¾Ø±',
    'above': 'Ø§ÙˆÙ¾Ø±',
    'below': 'Ù†ÛŒÚ†Û’',

    // Fabrics
    'cotton': 'Ø³ÙˆØªÛŒ', 'suti': 'Ø³ÙˆØªÛŒ',
    'silk': 'Ø±ÛŒØ´Ù…', 'resham': 'Ø±ÛŒØ´Ù…',
    'aspire': 'Ø§Ø³Ù¾Ø§Ø¦Ø±',
    'surgical': 'Ø³ÙˆØ±Ú¯ÛŒÚ©Ø§Ù„',
    'plain': 'Ù¾Ù„Û’Ù†',
    'caps': 'Ú©Ø§Ù¾Ø³',
    'polyester': 'Ù¾Ø§Ù„Ø¦ÛŒÛ’Ø³Ù¹Ø±',
    'jersey': 'Ø¬Ø±Ø³ÛŒ',
    'denim': 'ÚˆÛŒÙ†Ù…',
    'canvas': 'Ú©ÛŒÙ†ÙˆØ³',
    'velvet': 'Ù…Ø®Ù…Ù„', 'makhmal': 'Ù…Ø®Ù…Ù„',
    'wool': 'Ø§ÙˆÙ†', 'oen': 'Ø§ÙˆÙ†',
    'lace': 'Ù„ÛŒØ³',
    'net': 'Ù†ÛŒÙ¹',
    'chiffon': 'Ø´ÛŒÙÙˆÙ†',
    'georgette': 'Ø¬Ø§Ø±Ø¬Ù¹',
    'drill': 'ÚˆØ±Ù„',
    'satin': 'Ø³Ø§Ù¹Ù†',
    'mesh': 'Ù…ÛŒØ´',

    // Actions & Verbs
    'print': 'Ù¾Ø±Ù†Ù¹', 'printing': 'Ù¾Ø±Ù†Ù¹Ù†Ú¯',
    'embroidery': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ', 'embroidary': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ', 'kadhai': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ',
    'stitch': 'Ø³Ù„Ø§Ø¦ÛŒ', 'stitching': 'Ø³Ù„Ø§Ø¦ÛŒ',
    'cut': 'Ú©Ù¹', 'cutting': 'Ú©Ù¹Ù†Ú¯',
    'sew': 'Ø³Ù„Ø§Ø¦ÛŒ Ú©Ø±Ùˆ', 'sewing': 'Ø³Ù„Ø§Ø¦ÛŒ',
    'design': 'ÚˆÛŒØ²Ø§Ø¦Ù†',
    'make': 'Ø¨Ù†Ø§Ø¦ÛŒÚº', 'banaye': 'Ø¨Ù†Ø§Ø¦ÛŒÚº',
    'fix': 'Ù„Ú¯Ø§Ø¦ÛŒÚº', 'fit': 'ÙÙ¹',
    'attach': 'Ù„Ú¯Ø§Ø¦ÛŒÚº', 'lagao': 'Ù„Ú¯Ø§Ø¦ÛŒÚº',
    'remove': 'ÛÙ¹Ø§Ø¦ÛŒÚº', 'hataye': 'ÛÙ¹Ø§Ø¦ÛŒÚº',
    'add': 'Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº', 'dalain': 'Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
    'patch': 'Ù¾ÛŒÚ†',
    'direct': 'ÚˆØ§Ø¦Ø±ÛŒÚ©Ù¹',
    'wash': 'Ø¯Ú¾Ù„Ø§Ø¦ÛŒ', 'dhulai': 'Ø¯Ú¾Ù„Ø§Ø¦ÛŒ',
    'iron': 'Ø§Ø³ØªØ±ÛŒ', 'istari': 'Ø§Ø³ØªØ±ÛŒ',
    'fold': 'ØªÛÛ', 'teh': 'ØªÛÛ',

    // Tailoring/Production terms
    'tailoring': 'Ø¯Ø±Ø²ÛŒ', 'darzi': 'Ø¯Ø±Ø²ÛŒ',
    'cutting': 'Ú©Ù¹Ù†Ú¯',
    'stitching': 'Ø³Ù„Ø§Ø¦ÛŒ',
    'finishing': 'ÙÙ†Ø´Ù†Ú¯',
    'checking': 'Ú†ÛŒÚ©Ù†Ú¯',
    'packing': 'Ù¾ÛŒÚ©Ù†Ú¯',
    'dispatch': 'ÚˆØ³Ù¾ÛŒÚ†',
    'production': 'Ù¾Ø±ÙˆÚˆÚ©Ø´Ù†',
    'sewing': 'Ø³Ù„Ø§Ø¦ÛŒ',
    'fitting': 'ÙÙ¹Ù†Ú¯',
    'alteration': 'ØªØ±Ù…ÛŒÙ…',
    'repair': 'Ù…Ø±Ù…Øª', 'marammat': 'Ù…Ø±Ù…Øª',
    'measure': 'Ù†Ø§Ù¾', 'naap': 'Ù†Ø§Ù¾',
    'measurement': 'Ù¾ÛŒÙ…Ø§Ø¦Ø´', 'measurements': 'Ù¾ÛŒÙ…Ø§Ø¦Ø´',

    // Accessories
    'zip': 'Ø²Ù¾',
    'button': 'Ø¨Ù¹Ù†',
    'hook': 'ÛÚ©',
    'eye': 'Ø¢Ø¦ÛŒ',
    'thread': 'Ø¯Ú¾Ø§Ú¯Û', 'dhaga': 'Ø¯Ú¾Ø§Ú¯Û',
    'ribbon': 'Ø±Ø¨Ù†',
    'lace': 'Ù„ÛŒØ³',
    'elastic': 'Ù„Ú†Ú©', 'loochak': 'Ù„Ú†Ú©',
    'label': 'Ù„ÛŒØ¨Ù„',
    'tag': 'Ù¹ÛŒÚ¯',
    'badge': 'Ø¨ÛŒØ¬',
    'matching cap': 'Ù…ÛŒÚ†Ù†Ú¯ Ú©ÛŒÙ¾',
    'cap': 'Ú©ÛŒÙ¾',

    // Order Status
    'standard': 'Ø§Ø³Ù¹ÛŒÙ†ÚˆØ±Úˆ',
    'custom': 'Ú©Ø³Ù¹Ù…',
    'ready logo': 'Ø±ÛŒÚˆÛŒ Ù„ÙˆÚ¯Ùˆ',
    'full custom': 'ÙÙ„ Ú©Ø³Ù¹Ù…',
    'urgent': 'Ø§Ø±Ø¬Ù†Ù¹',
    'super urgent': 'Ø§Ù†ØªÛØ§Ø¦ÛŒ Ø§Ø±Ø¬Ù†Ù¹',
    'normal': 'Ø¹Ø§Ù…',
    'pending': 'Ø²ÛŒØ± Ø§Ù„ØªÙˆØ§',
    'paid': 'Ø§Ø¯Ø§ Ø´Ø¯Û',
    'unpaid': 'ØºÛŒØ± Ø§Ø¯Ø§ Ø´Ø¯Û',
    'completed': 'Ù…Ú©Ù…Ù„',
    'delivered': 'ÚˆÙ„ÛŒÙˆØ±Úˆ',
    'returned': 'ÙˆØ§Ù¾Ø³',
    'cancelled': 'Ù…Ù†Ø³ÙˆØ®',
    'processing': 'Ù¾Ø±ÙˆØ³ÛŒØ³Ù†Ú¯',
    'ready': 'ØªÛŒØ§Ø±',
    'hold': 'ÛÙˆÙ„Úˆ',
    'delivery': 'ÚˆÙ„ÛŒÙˆØ±ÛŒ',
    'advance': 'Ø§ÛŒÚˆÙˆØ§Ù†Ø³',

    // Quantity & Numbers
    'one': 'Ø§ÛŒÚ©', 'ek': 'Ø§ÛŒÚ©',
    'two': 'Ø¯Ùˆ', 'do': 'Ø¯Ùˆ',
    'three': 'ØªÛŒÙ†', 'teen': 'ØªÛŒÙ†',
    'four': 'Ú†Ø§Ø±', 'chaar': 'Ú†Ø§Ø±',
    'five': 'Ù¾Ø§Ù†Ú†', 'panch': 'Ù¾Ø§Ù†Ú†',
    'single': 'Ø³Ù†Ú¯Ù„',
    'double': 'ÚˆØ¨Ù„',
    'qty': 'ØªØ¹Ø¯Ø§Ø¯', 'quantity': 'ØªØ¹Ø¯Ø§Ø¯',
    'total': 'Ú©Ù„',
    'half': 'ÛØ§Ù', 'aadha': 'Ø¢Ø¯Ú¾Ø§', 'aadhi': 'Ø¢Ø¯Ú¾ÛŒ',
    'full': 'Ù¾ÙˆØ±Ø§', 'poora': 'Ù¾ÙˆØ±Ø§',
    'all': 'ØªÙ…Ø§Ù…',
    'some': 'Ú©Ú†Ú¾',
    'many': 'Ø¨ÛØª',
    'few': 'ØªÚ¾ÙˆÚ‘Û’', 'thora': 'ØªÚ¾ÙˆÚ‘Ø§',
    'more': 'Ù…Ø²ÛŒØ¯', 'mazeed': 'Ù…Ø²ÛŒØ¯',

    // Financial
    'price': 'Ù‚ÛŒÙ…Øª', 'qimat': 'Ù‚ÛŒÙ…Øª',
    'cost': 'Ù„Ø§Ú¯Øª', 'lagat': 'Ù„Ø§Ú¯Øª',
    'discount': 'Ú†Ú¾ÙˆÙ¹', 'chhoot': 'Ú†Ú¾ÙˆÙ¹',
    'payment': 'Ø§Ø¯Ø§Ø¦ÛŒÚ¯ÛŒ',
    'total price': 'Ú©Ù„ Ù‚ÛŒÙ…Øª',
    'grand total': 'Ú©Ù„ Ø±Ù‚Ù…',
    'advance': 'Ø§ÛŒÚˆÙˆØ§Ù†Ø³',
    'remaining': 'Ø¨Ø§Ù‚ÛŒ', 'baqi': 'Ø¨Ø§Ù‚ÛŒ',
    'balance': 'Ø¨ÛŒÙ„Ù†Ø³',
    'free': 'ÙØ±ÛŒ', 'muft': 'Ù…ÙØª',
    'delivery charges': 'ÚˆÙ„ÛŒÙˆØ±ÛŒ Ú†Ø§Ø±Ø¬Ø²',
    'charges': 'Ú†Ø§Ø±Ø¬Ø²',

    // General
    'order': 'Ø¢Ø±ÚˆØ±',
    'product': 'Ù¾Ø±ÙˆÚˆÚ©Ù¹',
    'products': 'Ù¾Ø±ÙˆÚˆÚ©Ù¹Ø³',
    'customer': 'Ú©Ø³Ù¹Ù…Ø±',
    'name': 'Ù†Ø§Ù…',
    'phone': 'ÙÙˆÙ†',
    'address': 'Ù¾ØªÛ', 'pata': 'Ù¾ØªÛ',
    'city': 'Ø´ÛØ±', 'sheher': 'Ø´ÛØ±',
    'note': 'Ù†ÙˆÙ¹', 'notes': 'Ù†ÙˆÙ¹Ø³',
    'special note': 'Ø®ØµÙˆØµÛŒ Ù†ÙˆÙ¹',
    'instruction notes': 'ÛØ¯Ø§ÛŒØ§Øª',
    'instruction': 'ÛØ¯Ø§ÛŒØª',
    'remark': 'Ø±ÛŒÙ…Ø§Ø±Ú©Ø³', 'remarks': 'Ø±ÛŒÙ…Ø§Ø±Ú©Ø³',
    'engraving': 'Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯',
    'measurements': 'Ù¾ÛŒÙ…Ø§Ø¦Ø´',
    'financial summary': 'Ù…Ø§Ù„ÛŒ Ø®Ù„Ø§ØµÛ',
    'job sheet': 'Ø¬Ø§Ø¨ Ø´ÛŒÙ¹',
    'branding': 'Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯',
    'logo': 'Ù„ÙˆÚ¯Ùˆ',
    'sleeves': 'Ø¢Ø³ØªÛŒÙ†',
    'color': 'Ø±Ù†Ú¯',
    'size': 'Ø³Ø§Ø¦Ø²',
    'gender': 'Ø¬Ù†Ø³', 'jins': 'Ø¬Ù†Ø³',
    'male': 'Ù…Ø±Ø¯', 'mard': 'Ù…Ø±Ø¯',
    'female': 'Ø®Ø§ØªÙˆÙ†', 'khawateen': 'Ø®ÙˆØ§ØªÛŒÙ†',
    'fit': 'ÙÙ¹',
    'regular': 'Ø±ÛŒÚ¯ÙˆÙ„Ø±',
    'slim': 'Ø³Ù„Ù…',
    'loose': 'ÚˆÚ¾ÛŒÙ„Ø§', 'dheela': 'ÚˆÚ¾ÛŒÙ„Ø§',
    'tight': 'ØªÙ†Ú¯', 'tang': 'ØªÙ†Ú¯',
    'medium': 'Ø¯Ø±Ù…ÛŒØ§Ù†Û',

    // Locations
    'enamels': 'Ø§ÛŒÙ†Ù…Ù„Ø²',
    'johar town': 'Ø¬ÙˆÛØ± Ù¹Ø§Ø¤Ù†',
    'jail road': 'Ø¬ÛŒÙ„ Ø±ÙˆÚˆ',
    'abbottabad': 'Ø§ÛŒØ¨Ù¹ Ø¢Ø¨Ø§Ø¯',
    'lahore': 'Ù„Ø§ÛÙˆØ±', 'lhr': 'Ù„Ø§ÛÙˆØ±',
    'islamabad': 'Ø§Ø³Ù„Ø§Ù… Ø¢Ø¨Ø§Ø¯',
    'karachi': 'Ú©Ø±Ø§Ú†ÛŒ', 'khi': 'Ú©Ø±Ø§Ú†ÛŒ',
    'rawalpindi': 'Ø±Ø§ÙˆÙ„Ù¾Ù†ÚˆÛŒ',
    'lab coat': 'Ù„Ø¨ Ú©ÙˆÙ¹',
    'lab-coat': 'Ù„Ø¨-Ú©ÙˆÙ¹',
    'wrinkle': 'Ø±Ù†Ú©Ù„',
    'faisalabad': 'ÙÛŒØµÙ„ Ø¢Ø¨Ø§Ø¯',
    'multan': 'Ù…Ù„ØªØ§Ù†',
    'gujranwala': 'Ú¯ÙˆØ¬Ø±Ø§Ù†ÙˆØ§Ù„Û',
    'online': 'Ø¢Ù† Ù„Ø§Ø¦Ù†',
    'outlet': 'Ø¢Ø¤Ù¹ Ù„ÛŒÙ¹',

    // Product names
    'sprinter': 'Ø³Ù¾Ø±Ø§Ù†Ù¹Ø±',
    'joggers': 'Ø¬ÙˆÚ¯Ø±Ø²',
    'unisex': 'ÛŒÙˆÙ†ÛŒØ³ÛŒÚ©Ø³',
    'men': 'Ù…ÛŒÙ†',
    'women': 'ÙˆÛŒÙ…Ù†',

    // Sizes
    'xs': 'Ø§ÛŒÚ©Ø³ Ø§ÛŒØ³', 'small': 'Ú†Ú¾ÙˆÙ¹Ø§', 's': 'Ø§ÛŒØ³',
    'medium': 'Ø¯Ø±Ù…ÛŒØ§Ù†Û', 'm': 'Ø§ÛŒÙ…',
    'large': 'Ø¨Ú‘Ø§', 'l': 'Ø§ÛŒÙ„',
    'xl': 'Ø§ÛŒÚ©Ø³ Ø§ÛŒÙ„',
    'xxl': 'ÚˆØ¨Ù„ Ø§ÛŒÚ©Ø³ Ø§ÛŒÙ„',
    'xxxl': 'Ù¹Ø±Ù¾Ù„ Ø§ÛŒÚ©Ø³ Ø§ÛŒÙ„',
    'c': 'Ú©Ø³Ù¹Ù…', 'C': 'Ú©Ø³Ù¹Ù…', 'custom': 'Ú©Ø³Ù¹Ù…',

    // English words that should stay/not be translated
    'id': 'Ø¢Ø¦ÛŒ ÚˆÛŒ',
    'date': 'ØªØ§Ø±ÛŒØ®',
    'time': 'ÙˆÙ‚Øª',

    // Additional common terms
    'thread color': 'Ø¯Ú¾Ø§Ú¯Û’ Ú©Ø§ Ø±Ù†Ú¯',
    'embroidery color': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ Ú©Ø§ Ø±Ù†Ú¯',
    'embroidery type': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ Ú©ÛŒ Ù‚Ø³Ù…',
    'embroidery thread': 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ Ú©Ø§ Ø¯Ú¾Ø§Ú¯Û',
  };

  // Sort dictionary keys by length (longest first) to match multi-word phrases before single words
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length);

  // Apply dictionary replacements (case-insensitive, whole-word)
  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
    result = result.replace(regex, dictionary[key]);
  }

  // â”€â”€â”€ POST-PROCESSING: Map remaining Roman Urdu via transliteration â”€â”€â”€
  // Improved char mapping with digraph support
  const digraphMap = {
    'sh': 'Ø´', 'ch': 'Ú†', 'kh': 'Ø®', 'gh': 'Øº', 'zh': 'Ú˜',
    'th': 'ØªÚ¾', 'dh': 'Ø¯Ú¾', 'nh': 'Ù†Û', 'nh': 'Ù†Û',
    'aa': 'Ø¢', 'ee': 'ÛŒ', 'oo': 'Ùˆ', 'ai': 'Û’', 'au': 'Ø§Ùˆ',
    'iy': 'ÛŒ', 'ay': 'Û’', 'ya': 'ÛŒØ§', 'yu': 'ÛŒÙˆ',
  };
  const charMap = {
    'a': 'Ø§', 'b': 'Ø¨', 'p': 'Ù¾', 't': 'Øª', 's': 'Ø³', 'j': 'Ø¬',
    'h': 'Û', 'k': 'Ú©', 'l': 'Ù„', 'm': 'Ù…', 'n': 'Ù†', 'w': 'Ùˆ',
    'y': 'ÛŒ', 'r': 'Ø±', 'z': 'Ø²', 'f': 'Ù', 'q': 'Ù‚', 'd': 'Ø¯',
    'g': 'Ú¯', 'e': 'Û’', 'i': 'ÛŒ', 'o': 'Ùˆ', 'u': 'Ùˆ', 'c': 'Ú©',
    'v': 'Ùˆ', 'x': 'Ú©Ø³',
  };

  // Process each word: transliterate remaining English/Roman words
  const words = result.split(/(\s+)/);
  result = words.map(word => {
    if (!word.trim() || /[\u0600-\u06FF]/.test(word)) return word; // already Urdu or whitespace
    if (/^\d+$/.test(word)) return word; // pure numbers â€“ keep
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
  result = result.replace(/[ \t]+/g, ' ').trim();

  return result || text;
  } catch (e) { return text; }
}

export function openPrintWindow(title, isRtl = false) {
  const win = window.open('', '_blank');
  const bodyAttrs = isRtl ? ' dir="rtl" class="rtl"' : '';
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body${bodyAttrs}>`);
  win.document.write(getPrintLogoHTML());
  win.document.write('<div class="report-header">');
  win.document.write(`<h1>${title}</h1>`);
  win.document.write(`<p>Enamels Production â€” Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>`);
  win.document.write('</div>');
  return win;
}

export function closePrintWindow(win) {
  win.document.write(getPrintFooterHTML());
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
      win.document.write(`<tr><td>${p.productName || 'â€”'}</td><td style="text-align:right">${p.quantity || 0} units</td><td style="text-align:right;font-weight:700">${currency(p.profit)}</td></tr>`);
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
      const variants = item.variants && item.variants.length > 0 ? item.variants : [{ color: 'â€”', size: 'â€”', stock: 0, price: item.price || 0 }];
      variants.filter(v => variantMatchesFilter(v.stock || 0)).forEach(v => {
        const stock = v.stock || 0;
        const price = v.price || 0;
        const val = stock * price;
        let statusClass = 'status-ok';
        let statusText = 'In Stock';
        if (stock === 0) { statusClass = 'status-bad'; statusText = 'Out of Stock'; }
        else if (stock <= 5) { statusClass = 'status-warn'; statusText = 'Low Stock'; }
        win.document.write(`<tr><td style="font-weight:700">${item.name}</td><td>${v.color || 'â€”'}</td><td>${v.size || 'â€”'}</td><td style="text-align:right;font-weight:700">${stock}</td><td style="text-align:right">${currency(price)}</td><td style="text-align:right;font-weight:700">${currency(val)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`);
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
      const method = o.deliveryMethod || o.deliveryType || 'â€”';
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || 'â€”'}</td><td>${o.customerPhone || 'â€”'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.outletName || 'â€”'}</td><td>${method}</td><td style="text-align:center;font-weight:700">${attemptStr}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Completed deliveries
  if (completed.length > 0) {
    win.document.write('<div class="section-title">Completed Deliveries</div>');
    win.document.write('<table><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Delivered At</th><th>Method</th></tr></thead><tbody>');
    completed.forEach(o => {
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || 'â€”'}</td><td>${o.customerPhone || 'â€”'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.deliveredAt ? new Date(o.deliveredAt).toLocaleString() : 'â€”'}</td><td>${o.deliveryMethod || o.deliveryType || 'â€”'}</td></tr>`);
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
      win.document.write(`<tr><td style="font-weight:700">${name}</td><td style="text-align:right">${stats.total}</td><td style="text-align:right;color:#000;font-weight:700">${stats.delivered}</td><td style="text-align:right;color:#000">${stats.noResponse}</td><td style="text-align:right;font-weight:700">${rate}%</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  closePrintWindow(win);
}

function kpiCard(label, value) {
  return `<div class="summary-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function summaryRow(label, value) {
  return `<div class="summary-row"><span style="font-weight:600">${label}</span><span style="font-weight:700">${value}</span></div>`;
}

function currency(v) {
  return `â‚¨${(v || 0).toLocaleString()}`;
}

function parseJSON(data) {
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return {}; }
}

/** Normalize a cart item to its product object (handles both wrapped and flat formats) */
const getItemProduct = (item) => {
  if (!item) return {};
  if (item.productDetails) return item.productDetails;
  if (item.name || item.productType || item.fabricType) return item;
  return {};
};

/** Format date for display */
function fmtDate(d) {
  if (!d) return 'â€”';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'â€”';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return 'â€”';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'â€”';
  return dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Urdu labels for production sections */
const urduSection = {
  products: 'Ø¢Ø±Ù¹ÛŒÚ©Ù„Ø²',
  engraving: 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ',
  measurements: 'Ù¾ÛŒÙ…Ø§Ø¦Ø´',
  instructionNotes: 'ÛØ¯Ø§ÛŒØ§Øª (Ù†ÙˆÙ¹Ø³)',
  product: 'Ø¢Ø±Ù¹ÛŒÚ©Ù„',
  fabricColor: 'Ú©Ù¾Ú‘Ø§ Ø§ÙˆØ± Ø±Ù†Ú¯',
  sizeGender: 'Ø³Ø§Ø¦Ø² Ø§ÙˆØ± Ø¬Ù†Ø³',
  qty: 'ØªØ¹Ø¯Ø§Ø¯',
  cap: 'Ú©ÛŒÙ¾',
  sleeves: 'Ø¨Ø§Ø²Ùˆ',
  length: 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ',
  nameLines: 'Ù†Ø§Ù… Ú©ÛŒ Ù„Ø§Ø¦Ù†ÛŒÚº',
  logos: 'Ù„ÙˆÚ¯Ùˆ',
  specialNote: 'Ø®ØµÙˆØµÛŒ Ù†ÙˆÙ¹',
  matchingCap: 'Ù…ÛŒÚ†Ù†Ú¯ Ú©ÛŒÙ¾',
  fitType: 'ÙÙ¹',
  color: 'Ø±Ù†Ú¯',
  position: 'Ù…Ù‚Ø§Ù…',
  orderEntryDate: 'Ø¢Ø±ÚˆØ± Ø§Ù†Ù¹Ø±ÛŒ Ú©ÛŒ ØªØ§Ø±ÛŒØ®',
  shopifyDate: 'Ø´Ø§Ù¾ÛŒÙØ§Ø¦Û’ Ø¢Ø±ÚˆØ± Ú©ÛŒ ØªØ§Ø±ÛŒØ®',
  orderDate: 'Ø¢Ø±ÚˆØ± Ú©ÛŒ ØªØ§Ø±ÛŒØ®',
  engravingType: 'Ú©Ú‘Ú¾Ø§Ø¦ÛŒ Ú©ÛŒ Ù‚Ø³Ù…',
  directEngraving: 'ÚˆØ§Ø¦Ø±ÛŒÚ©Ù¹ Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯',
  patchEngraving: 'Ù¾ÛŒÚ† Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯',
  customAttributes: 'Ú©Ø³Ù¹Ù… Ø§ÛŒÙ¹Ø±ÛŒØ¨ÛŒÙˆÙ¹Ø³',
  fabricSource: 'Ù…Ø·Ù„ÙˆØ¨Û Ú©Ù¾Ú‘Ø§',
  colorSource: 'Ù…Ø·Ù„ÙˆØ¨Û Ø±Ù†Ú¯',
  designSource: 'Ù…Ø·Ù„ÙˆØ¨Û ÚˆÛŒØ²Ø§Ø¦Ù†',
  sizeSource: 'Ù…Ø·Ù„ÙˆØ¨Û Ø³Ø§Ø¦Ø²',
  sourceProducts: 'Ú©Ø³Ù¹Ù… Ø¶Ø±ÙˆØ±ÛŒØ§Øª',
  jobSheet: 'Ø¬Ø§Ø¨ Ø´ÛŒÙ¹',
  specialNote: 'Ø®ØµÙˆØµÛŒ Ù†ÙˆÙ¹',
  price: 'Ù‚ÛŒÙ…Øª',
  fabric: 'Ú©Ù¾Ú‘Ø§',
  color: 'Ø±Ù†Ú¯',
  size: 'Ø³Ø§Ø¦Ø²',
  gender: 'Ø¬Ù†Ø³',
  qty: 'ØªØ¹Ø¯Ø§Ø¯',
  orderNo: 'Ø¢Ø±ÚˆØ± Ù†Ù…Ø¨Ø±',
  status: 'Ø­Ø§Ù„Øª',
  customerInfo: 'Ú©Ø³Ù¹Ù…Ø± Ú©ÛŒ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª',
  phone: 'ÙÙˆÙ†',
  city: 'Ø´ÛØ±',
  COD: 'Ù†Ù‚Ø¯ ÚˆÙ„ÛŒÙˆØ±ÛŒ',
  paid: 'Ø§Ø¯Ø§ Ø´Ø¯Û',
  fullyPaid: 'Ù…Ú©Ù…Ù„ Ø§Ø¯Ø§ Ø´Ø¯Û',
  custom: 'Ú©Ø³Ù¹Ù…',
  standard: 'Ø§Ø³Ù¹ÛŒÙ†ÚˆØ±Úˆ',
  readyLogo: 'Ø±ÛŒÚˆÛŒ Ù„ÙˆÚ¯Ùˆ',
  male: 'Ù…Ø±Ø¯',
  female: 'Ø¹ÙˆØ±Øª',
  dupatta: 'Ø¯ÙˆÙ¾Ù¹Û',
  extra: 'Ø§Ø¶Ø§ÙÛŒ',
};

/** English labels for production sections */
const enSection = {
  products: 'Articles',
  engraving: 'Engraving',
  measurements: 'Measurements',
  instructionNotes: 'Instruction Notes',
  product: 'Article',
  fabricColor: 'Fabric & Color',
  sizeGender: 'Size & Gender',
  qty: 'Qty',
  cap: 'Cap',
  sleeves: 'Sleeves Ø¨Ø§Ø²Ùˆ',
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
  shoulder: 'Ú©Ù†Ø¯Ú¾Ø§',
  chest: 'Ø³ÛŒÙ†Û',
  waist: 'Ú©Ù…Ø±',
  shirtLength: 'Ù‚Ù…ÛŒØ¶ Ú©ÛŒ Ù„Ù…Ø¨Ø§Ø¦ÛŒ',
  sleeve: 'Ø¢Ø³ØªÛŒÙ†',
  trouserLength: 'Ù¾ØªÙ„ÙˆÙ† Ú©ÛŒ Ù„Ù…Ø¨Ø§Ø¦ÛŒ',
  length: 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ'
};

/** Capitalize first letter */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export function printJobSheet(order, userRole, lang = 'ur', sections = {}) {
  const showMeas = sections.measurements !== false;
  const showEngraving = sections.engraving !== false;
  const showPrice = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

  const slMap = { 'full':'Full', 'half':'Half ÛØ§Ù', 'three-quarter':'3 Quarter' };
  const shMap = { 'long':'Long', 'short':'Short', 'regular':'Regular Ø±ÛŒÚ¯ÙˆÙ„Ø±' };
  const femSlMap = { 'full':'Full', 'half':'Half ÛØ§Ù', 'medium':'Medium' };
  const femShMap = { 'long':'Long', 'short':'Short' };
  const urduSlMap = { 'full':'ÙÙ„ Ø¨Ø§Ø²Ùˆ', 'half':'ÛØ§Ù', 'three-quarter':'ØªÚ¾Ø±ÛŒ Ú©ÙˆØ§Ø±Ù¹Ø±', 'quarter':'Ú©ÙˆØ§Ø±Ù¹Ø±' };
  const urduShMap = { 'long':'Ù„Ù…Ø¨Û’ Ø¨Ø§Ø²Ùˆ', 'short':'Ú†Ú¾ÙˆÙ¹Û’ Ø¨Ø§Ø²Ùˆ', 'regular':'Ø±ÛŒÚ¯ÙˆÙ„Ø±' };
  const urduFemSlMap = { 'full':'ÙÙ„ Ø¨Ø§Ø²Ùˆ', 'half':'Half ÛØ§Ù', 'medium':'Ø¯Ø±Ù…ÛŒØ§Ù†ÛŒ' };
  const urduFemShMap = { 'long':'Ù„Ù…Ø¨ÛŒ Ø¨Ø§Ø²Ùˆ', 'short':'Ú†Ú¾ÙˆÙ¹ÛŒ Ø¨Ø§Ø²Ùˆ' };
  // Sleeve & Length column display maps (values only, no label prefix)
  const colSleeveEN = { 'full':'Full', 'half':'Half', 'three-quarter':'Three Quarter', 'regular':'Regular', 'medium':'Medium' };
  const colSleeveUR = { 'full':'ÙÙ„', 'half':'ÛØ§Ù', 'three-quarter':'ØªÚ¾Ø±ÛŒ Ú©ÙˆØ§Ø±Ù¹Ø±', 'regular':'Ø±ÛŒÚ¯ÙˆÙ„Ø±', 'medium':'Ù…ÛŒÚˆÛŒÙ…' };
  const colLengthEN = { 'long':'Long', 'regular':'Regular', 'short':'Short' };
  const colLengthUR = { 'long':'Ù„Ø§Ù†Ú¯', 'regular':'Ø±ÛŒÚ¯ÙˆÙ„Ø±', 'short':'Ø´Ø§Ø±Ù¹' };
  const isUrdu = lang === 'ur';
  const sec = lang === 'en' ? enSection : urduSection;

  const tu = (t) => {
    if (!t) return '';
    if (!isUrdu) return t;
    return toUrduName(t);
  };

  const ru = (t) => isUrdu && t ? romanToUrdu(t) : t;
  const pu = tu;
  const vu = tu;

  const colSleeveDisp = (v) => {
    if (!v) return 'â€”';
    const key = v.toLowerCase().trim();
    return isUrdu ? (colSleeveUR[key] || tu(v)) : (colSleeveEN[key] || v);
  };
  const colLengthDisp = (v) => {
    if (!v) return 'â€”';
    const key = v.toLowerCase().trim();
    return isUrdu ? (colLengthUR[key] || tu(v)) : (colLengthEN[key] || v);
  };
  const slDisplay = (v) => v ? (isUrdu ? (urduSlMap[v.toLowerCase().trim()] || tu(v)) : (slMap[v] || v)) : '';
  const shDisplay = (v) => v ? (isUrdu ? (urduShMap[v.toLowerCase().trim()] || tu(v)) : (shMap[v] || v)) : '';
  const genDisplay = (g) => {
    if (!g) return '';
    const key = g.toLowerCase().trim();
    return isUrdu ? (key === 'male' ? 'Ù…Ø±Ø¯' : key === 'female' ? 'Ø¹ÙˆØ±Øª' : tu(g)) : g;
  };
  const dir = isUrdu ? 'rtl' : 'ltr';

  const orderType = order.type || 'STANDARD';
  const title = `${sec.jobSheet} â€” ${order.orderNumber || order.id?.slice(0, 8)}`;
  const win = openPrintWindow(title, isUrdu);

  const rawPd = parseJSON(order.productDetails);
  const allItems = Array.isArray(rawPd) ? rawPd : null;
  const isMultiItem = allItems && allItems.length > 0;
  const firstProduct = isMultiItem ? getItemProduct(allItems[0]) : (rawPd || {});
  const custom = parseJSON(order.customization);
  const rawSizes = parseJSON(order.sizeData);
  const isOutletSizeData = rawSizes && typeof rawSizes === 'object' && !Array.isArray(rawSizes) && Object.values(rawSizes).some(v => typeof v === 'object' && v !== null && !Array.isArray(v) && !v._extra);
  const flatSizes = isOutletSizeData ? Object.values(rawSizes).reduce((acc, v) => ({ ...acc, ...v }), {}) : rawSizes;
  const sizes = (flatSizes && Object.keys(flatSizes).length > 0) ? flatSizes : ({});
  const productVerification = order.productVerification && typeof order.productVerification === 'object' ? order.productVerification : {};

  // Hide the default .report-header from openPrintWindow â€” we write our own header below
  win.document.write('<style>.report-header{display:none!important}</style>');

  // â”€â”€â”€ GENERATED DATE/TIME â”€â”€â”€
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const generatedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // â”€â”€â”€ ENTRY DATE/TIME & SHOPIFY DATE â”€â”€â”€
  const entryDt = order.createdAt ? new Date(order.createdAt) : null;
  const entryDate = entryDt && !isNaN(entryDt.getTime())
    ? entryDt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'â€”';
  const entryTime = entryDt && !isNaN(entryDt.getTime())
    ? entryDt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : 'â€”';
  const shopifyDate = order.shopifyOrderDate ? fmtDate(order.shopifyOrderDate) : null;

  // â”€â”€â”€ HEADER â”€â”€â”€
  win.document.write(`<div style="text-align:center;margin-bottom:8px;border-bottom:3px solid #111;padding-bottom:8px">`);
  win.document.write(`<h1 style="font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:0;color:#000">${sec.jobSheet}</h1>`);
  win.document.write(`<p style="font-size:20px;color:#000;margin-top:2px;font-weight:700">${isUrdu ? 'Ø¢Ø±ÚˆØ± #' : 'Order #'}<span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${order.orderNumber || order.id?.slice(0, 8)}</span></p>`);
  win.document.write(`<p style="font-size:18px;color:#000;font-weight:600;margin-top:2px"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ø§ÛŒÙ†Ù…Ù„Ø² Ù¾Ø±ÙˆÚˆÚ©Ø´Ù†' : 'ENAMELS Production'}</p>`);
  win.document.write(`<p style="font-size:15px;color:#000;font-weight:500;margin-top:2px">${isUrdu ? 'ØªÛŒØ§Ø± Ú©Ø±Ø¯Û:' : 'Generated:'} <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${generatedDate} ${generatedTime}</span></p>`);
  win.document.write(`</div>`);

  // â”€â”€â”€ CUSTOMER INFO (always LTR â€” customer data is English/Roman script) â”€â”€â”€
  win.document.write(`<div dir="ltr" style="border:1.2px solid #000;border-radius:0;padding:8px 12px;margin-bottom:8px">`);
  win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;margin-bottom:2px">${order.customerName || 'â€”'}</p>`);
  if (order.customerPhone) {
    win.document.write(`<p style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000;margin-bottom:2px">${order.customerPhone}</p>`);
  }
  if (order.address) {
    win.document.write(`<p style="font-size:16px;color:#000;margin-bottom:2px">${order.address}</p>`);
  }
  if (order.city) {
    const cityLabel = isUrdu ? 'Ø´ÛØ±:' : 'CITY:';
    win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;display:inline-block;padding:4px 14px;border-radius:0;margin-top:4px;text-transform:uppercase;border:1.2px solid #000">${cityLabel} ${order.city}</p>`);
  }
  win.document.write(`</div>`);

  // â”€â”€â”€ DATES ROW (always LTR â€” date values are English) â”€â”€â”€
  win.document.write(`<div dir="ltr" style="display:flex;justify-content:space-between;margin-bottom:8px;border:1.2px solid #000;border-radius:0;padding:6px 10px;flex-wrap:wrap">`);
  win.document.write(`<div><span style="font-size:16px;font-weight:700;color:#000">${sec.orderEntryDate}:</span> <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000">${entryDate}</span></div>`);
  win.document.write(`<div><span style="font-size:16px;font-weight:700;color:#000">${isUrdu ? 'Ø§Ù†Ø¯Ø±Ø§Ø¬ Ú©Ø§ ÙˆÙ‚Øª:' : 'Entry Time:'}</span> <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000">${entryTime}</span></div>`);
  if (shopifyDate) {
    win.document.write(`<div><span style="font-size:16px;font-weight:700;color:#000">${sec.shopifyDate}:</span> <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000">${shopifyDate}</span></div>`);
  }
  win.document.write(`</div>`);

  // â”€â”€â”€ ORDER PLACED BY â”€â”€â”€
  if (order.placedBy) {
    const placedLabel = isUrdu ? 'Ø¢Ø±ÚˆØ± Ú©Ø³ Ù†Û’ Ø¯ÛŒØ§:' : 'Order Placed By:';
    win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:5px 10px;margin-bottom:8px;text-align:center">`);
    win.document.write(`<span style="font-size:18px;font-weight:700;color:#000">${placedLabel} ${order.placedBy}</span>`);
    win.document.write(`</div>`);
  }

  // â”€â”€â”€ OUTLET SOURCE LABEL â”€â”€â”€
  if (order.source === 'OUTLET' && order.outletName) {
    win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:6px 12px;margin-bottom:8px;text-align:center">`);
    win.document.write(`<span style="font-size:20px;font-weight:700;color:#000;text-transform:uppercase"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ù…Ø§Ø®Ø°: Ø¢Ø¤Ù¹ Ù„ÛŒÙ¹ â€”' : 'Source: Outlet â€”'} ${order.outletName}</span>`);
    win.document.write(`</div>`);
  }

  // â”€â”€â”€ ORDER META BADGES â”€â”€â”€
  win.document.write(`<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">`);
  const badgeLabels = {
    'PAID': isUrdu ? 'Ø§Ø¯Ø§ Ø´Ø¯Û' : 'PAID',
    'FULL_CUSTOM': isUrdu ? 'ÙÙ„ Ú©Ø³Ù¹Ù…' : 'FULL CUSTOM',
    'STANDARD': isUrdu ? 'Ø§Ø³Ù¹ÛŒÙ†ÚˆØ±Úˆ' : 'STANDARD',
    'READY_LOGO': isUrdu ? 'Ø±ÛŒÚˆÛŒ Ù„ÙˆÚ¯Ùˆ' : 'READY LOGO',
    'SUPER_URGENT': isUrdu ? 'Ø§Ù†ØªÛØ§Ø¦ÛŒ Ø§Ø±Ø¬Ù†Ù¹' : 'SUPER URGENT',
    'URGENT': isUrdu ? 'Ø§Ø±Ø¬Ù†Ù¹' : 'URGENT',
    'OUTLET': isUrdu ? 'Ø¢Ø¤Ù¹ Ù„ÛŒÙ¹' : 'OUTLET',
    'CASH ON DELIVERY': isUrdu ? 'Ù†Ù‚Ø¯ ÚˆÙ„ÛŒÙˆØ±ÛŒ' : 'CASH ON DELIVERY',
  };
  const _payLabel = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : 'CASH ON DELIVERY';
  [order.type, order.priority, order.outletName || order.source, _payLabel].filter(Boolean).forEach(label => {
    let color = '#6b7280';
    if (label === 'PAID' || label === 'FULL_CUSTOM') color = '#059669';
    else if (label === 'SUPER_URGENT') color = '#dc2626';
    else if (label === 'URGENT') color = '#000';
    else if (label === 'OUTLET') color = '#000';
    else if (label === 'CASH ON DELIVERY') color = '#dc2626';
    const displayLabel = badgeLabels[label] || ru(label);
    win.document.write(`<span style="padding:3px 12px;border-radius:0;font-size:20px;font-weight:700;text-transform:uppercase;background:#fff;color:#000;border:1.2px solid #000"${isUrdu ? ' class="urdu-text"' : ''}>${displayLabel}</span>`);
  });
  win.document.write(`</div>`);

  // â”€â”€â”€ PRODUCTS TABLE â”€â”€â”€
  const sleeveLabel = isUrdu ? 'Ø¨Ø§Ø²Ùˆ' : 'Sleeve';
  const lengthLabel = isUrdu ? 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ' : 'Length';
  win.document.write(`<div class="section-title" style="font-size:26px">${sec.products}</div>`);
  // Helper to extract sleeve/length value from product
  const getSleeveVal = (p) => p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves ? p.femaleOptions.sleeves : null);
  const getLengthVal = (p) => p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength ? p.femaleOptions.shirtLength : null);
  if (isMultiItem) {
    const showCap = orderType !== 'STANDARD';
    const headers = ['#', sec.product, sec.fabricColor, sec.sizeGender, sec.qty].concat(showCap ? [sec.cap] : []).concat([sleeveLabel, lengthLabel]);
    win.document.write(`<table dir="${dir}"><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    allItems.forEach((item, idx) => {
      const p = getItemProduct(item);
      const capQty = showCap && p.matchingCap ? (p.matchingCapQty || 0) : (showCap && item.capCharges > 0 ? (p.femaleOptions?.cap || 0) : 0);
      const sv = getSleeveVal(p);
      const lv = getLengthVal(p);
      win.document.write(`<tr>`);
      win.document.write(`<td style="font-weight:700">${idx + 1}</td>`);
      const verified = productVerification[String(idx)] === true;
      win.document.write(`<td class="product-name">${verified ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:0;background:#fff;color:#000;border:1.2px solid #000;font-size:10px;margin-right:4px" title="Verified">âœ“</span>' : ''}${pu(p.productType || p.name) || 'â€”'}</td>`);
      // Fabric & Color column (no size mixed in)
      const fcParts = [vu(p.fabricType), vu(p.color)].filter(Boolean);
      win.document.write(`<td>${fcParts.join(' â€¢ ') || 'â€”'}</td>`);
      // Size & Gender column (only size + gender)
      const sizeVal = p.size ? (p.size.trim().toUpperCase() === 'CUSTOM' ? 'C' : p.size.trim().toUpperCase()) : 'C';
      const sgParts = [isUrdu ? `Ø³Ø§Ø¦Ø² ${pu(sizeVal)}` : `Size ${sizeVal}`, genDisplay(p.gender)].filter(Boolean);
      win.document.write(`<td>${sgParts.join(' â€¢ ') || 'â€”'}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:700">${item.quantity || 1}</td>`);
      if (showCap) win.document.write(`<td style="text-align:center;font-weight:700;color:#000">${capQty || 'â€”'}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:600;font-size:16px">${colSleeveDisp(sv)}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:600;font-size:16px">${colLengthDisp(lv)}</td>`);
      win.document.write(`</tr>`);
    });
    win.document.write(`</tbody></table>`);
  } else {
    const showCap = orderType !== 'STANDARD';
    const capQty = showCap && firstProduct.matchingCap ? (firstProduct.matchingCapQty || 0) : 0;
    const sv = getSleeveVal(firstProduct);
    const lv = getLengthVal(firstProduct);
    const headers = [sec.product, sec.fabricColor, sec.sizeGender, sec.qty].concat(showCap ? [sec.cap] : []).concat([sleeveLabel, lengthLabel]);
    win.document.write(`<table dir="${dir}"><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    win.document.write(`<tr>`);
    const singleVerified = productVerification['0'] === true;
    win.document.write(`<td class="product-name">${singleVerified ? '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:0;background:#fff;color:#000;border:1.2px solid #000;font-size:10px;margin-right:4px" title="Verified">âœ“</span>' : ''}${pu(firstProduct.productType || firstProduct.name) || 'â€”'}</td>`);
    const fcParts = [vu(firstProduct.fabricType), vu(firstProduct.color)].filter(Boolean);
    win.document.write(`<td>${fcParts.join(' â€¢ ') || 'â€”'}</td>`);
    const singleSizeVal = firstProduct.size ? (firstProduct.size.trim().toUpperCase() === 'CUSTOM' ? 'C' : firstProduct.size.trim().toUpperCase()) : 'C';
    const sgParts = [isUrdu ? `Ø³Ø§Ø¦Ø² ${pu(singleSizeVal)}` : `Size ${singleSizeVal}`, genDisplay(firstProduct.gender)].filter(Boolean);
    win.document.write(`<td>${sgParts.join(' â€¢ ') || 'â€”'}</td>`);
    win.document.write(`<td style="text-align:center;font-weight:700">${order.quantity || 1}</td>`);
    if (showCap) win.document.write(`<td style="text-align:center;font-weight:700;color:#000">${capQty || 'â€”'}</td>`);
    win.document.write(`<td style="text-align:center;font-weight:600;font-size:16px">${colSleeveDisp(sv)}</td>`);
    win.document.write(`<td style="text-align:center;font-weight:600;font-size:16px">${colLengthDisp(lv)}</td>`);
    win.document.write(`</tr></tbody></table>`);
  }

  // â”€â”€â”€ MEASUREMENTS SECTION â”€â”€â”€
  if (showMeas) {
    win.document.write(`<div class="section-title" style="font-size:26px">${sec.measurements}</div>`);
    win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:8px 12px;margin-bottom:8px;page-break-inside:avoid">`);
    if (isMultiItem) {
      allItems.forEach((item, idx) => {
        const p = getItemProduct(item);
        const pName = p.productType || p.name;
        const sizeVal = p.size ? (p.size.trim().toUpperCase() === 'CUSTOM' ? 'C' : p.size.trim().toUpperCase()) : 'C';
        const perProductSizes = (rawSizes && typeof rawSizes === 'object' && !Array.isArray(rawSizes) && rawSizes[pName]) ? rawSizes[pName] : null;
        const itemSizeData = perProductSizes || (item.sizeData ? (typeof item.sizeData === 'string' ? JSON.parse(item.sizeData) : item.sizeData) : null) || {};
        const sizeSpecialNote = itemSizeData?.specialNote;
        
        win.document.write(`<div style="margin-bottom:6px;${idx > 0 ? 'border-top:1.2px solid #000;padding-top:6px;' : ''}">`);
        win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;margin-bottom:2px">`);
        win.document.write(`<span style="background:#111;color:#fff;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;margin-right:6px">${idx + 1}</span>`);
        win.document.write(`${pu(pName)} â€” ${isUrdu ? 'Ø¬Ù†Ø³' : 'Gender'}: <span style="font-weight:700">${genDisplay(p.gender) || 'â€”'}</span> â€¢ ${isUrdu ? 'Ø³Ø§Ø¦Ø²' : 'Size'}: <span style="font-weight:700">${pu(sizeVal)}</span>`);
        win.document.write(`</p>`);
        if (sizeSpecialNote) {
          win.document.write(`<p style="font-size:17px;font-weight:500;line-height:2.2;color:#000;white-space:pre-wrap;word-break:break-word;margin-top:2px"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? romanToUrdu(sizeSpecialNote) : sizeSpecialNote}</p>`);
        }
        win.document.write(`</div>`);
      });
    } else {
      const sizeVal = firstProduct.size ? (firstProduct.size.trim().toUpperCase() === 'CUSTOM' ? 'C' : firstProduct.size.trim().toUpperCase()) : 'C';
      const sizeSpecialNote = (rawSizes && rawSizes.specialNote) || (sizes && sizes.specialNote);
      win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;margin-bottom:2px">`);
      win.document.write(`${isUrdu ? 'Ø¬Ù†Ø³' : 'Gender'}: <span style="font-weight:900">${genDisplay(firstProduct.gender) || 'â€”'}</span> â€¢ ${isUrdu ? 'Ø³Ø§Ø¦Ø²' : 'Size'}: <span style="font-weight:700">${pu(sizeVal)}</span>`);
      win.document.write(`</p>`);
      if (sizeSpecialNote) {
        win.document.write(`<p style="font-size:17px;font-weight:500;line-height:2.2;color:#000;white-space:pre-wrap;word-break:break-word;margin-top:2px"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? romanToUrdu(sizeSpecialNote) : sizeSpecialNote}</p>`);
      }
    }
    win.document.write(`</div>`);
  }

  // â”€â”€â”€ ENGRAVING / BRANDING â”€â”€â”€
  if (orderType !== 'STANDARD' && showEngraving) {
    // Parse order-level outlet engraving fields
    const outEngravingNames = order.engravingNames ? parseJSON(order.engravingNames) : [];
    const outEngravingLogos = order.engravingLogos ? parseJSON(order.engravingLogos) : [];
    const outHasEngraving = (order.engravingRequired && (outEngravingNames.length > 0 || outEngravingLogos.length > 0 || order.engravingText || order.engravingInstructions || order.logoRequired)) || !!order.instructionNotes || !!order.engravingInstructions;

    const brandingItems = isMultiItem ? allItems : [{ productDetails: firstProduct, customization: custom }];
    const hasAnyCustomization = brandingItems.some(item => {
      const c = item.customization ? (typeof item.customization === 'string' ? JSON.parse(item.customization) : item.customization) : custom;
      if (c?.skipEngraving) return false;
      return c?.engravingType || c?.nameSpelling?.trim() || c?.nameColor || c?.logoPlacement || c?.logos?.length > 0 || c?.designNotes || c?.articleNames?.filter(n => n?.trim())?.length > 0;
    });

    if (hasAnyCustomization || outHasEngraving) {
      win.document.write(`<div class="section-title" style="font-size:26px">${sec.engraving}</div>`);
      // Per-item customization (standard flow)
      if (hasAnyCustomization) {
        brandingItems.forEach((item, idx) => {
          const p = getItemProduct(item);
          const c = item.customization ? parseJSON(item.customization) : custom;
          const filteredNames = c?.articleNames?.filter(n => n?.trim()) || [];
          const hasNames = filteredNames.length > 0 || c?.nameSpelling?.trim();
          const hasLogos = c?.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0;
          const hasSpecs = c?.nameColor || c?.logoPlacement || c?.engravingType;
          const hasNotes = c?.designNotes;

          if (!hasNames && !hasLogos && !hasSpecs && !hasNotes) return;

          win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid">`);
          win.document.write(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1.2px solid #000">`);
          win.document.write(`<span style="background:#111;color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${idx + 1}</span>`);
            win.document.write(`<span style="font-weight:700;font-size:19px;text-transform:uppercase">${pu(p.productType || p.name) || (isUrdu ? 'Ø¢Ø¦Ù¹Ù… ' : 'Item ') + (idx + 1)}</span>`);
          if (p.color) win.document.write(`<span style="font-size:18px;color:#000">(${vu(p.color)})</span>`);
          win.document.write(`</div>`);

          if (c?.engravingType) {
            win.document.write(`<div style="margin-bottom:6px">`);
            const engravingLabel = c.engravingType === 'direct' ? sec.directEngraving : sec.patchEngraving;
            win.document.write(`<p style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;text-transform:uppercase;color:#000;margin-bottom:2px">${sec.engravingType}: ${engravingLabel}</p>`);
            win.document.write(`</div>`);
          }

          if (hasNames) {
            win.document.write(`<div style="margin-bottom:6px">`);
            win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.nameLines}</p>`);
            if (filteredNames.length > 0) {
              filteredNames.forEach((an, ai) => {
                win.document.write(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="background:#fff;color:#000;font-size:18px;font-weight:700;padding:2px 6px;border-radius:0;border:1.2px solid #000">L${ai + 1}</span><span style="font-size:24px;font-weight:700">${an}</span></div>`);
              });
            } else {
              win.document.write(`<div style="display:flex;align-items:center;gap:6px"><span style="background:#fff;color:#000;font-size:18px;font-weight:700;padding:2px 6px;border-radius:0;border:1.2px solid #000">L1</span><span style="font-size:24px;font-weight:700">${c.nameSpelling}</span></div>`);
            }
            win.document.write(`</div>`);
          }

          if (hasSpecs) {
            win.document.write(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">`);
            if (c.nameColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:0;border:1.2px solid #000;color:#000">${sec.color}: ${vu(c.nameColor)}</span>`);
            if (c.logoPlacement) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:0;border:1.2px solid #000;color:#000">${sec.position}: ${vu(c.logoPlacement)}</span>`);
            if (c.logoColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:0;border:1.2px solid #000;color:#000">${isUrdu ? 'Ù„ÙˆÚ¯Ùˆ:' : 'Logo:'} ${vu(c.logoColor)}</span>`);
            win.document.write(`</div>`);
          }

          if (hasLogos) {
            win.document.write(`<div style="margin-bottom:6px">`);
            win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.logos}</p>`);
            c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).forEach((l, li) => {
              win.document.write(`<div style="font-size:20px;font-weight:700;padding:3px 8px;border-radius:0;margin-bottom:2px;border:1.2px solid #000">${l.name || l.design}${l.name && l.design ? ` â€” ${l.design}` : ''}</div>`);
            });
            win.document.write(`</div>`);
          }

          if (hasNotes) {
            win.document.write(`<div style="border-left:1.2px solid #000;padding:6px 10px;border-radius:0">`);
            win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:4px;border-bottom:1.2px solid #000;padding-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.specialNote}</p>`);
            win.document.write(`<p style="font-size:17px;font-weight:500;line-height:2.2;color:#000;white-space:pre-wrap;word-break:break-word"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? romanToUrdu(c.designNotes) : c.designNotes}</p></div>`);
          }

          win.document.write(`</div>`);
        });
      }
      // Outlet-style engraving (order-level fields)
      if (outHasEngraving) {
        win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid">`);
        win.document.write(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1.2px solid #000">`);
        win.document.write(`<span style="background:#000;color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">âœ¦</span>`);
        win.document.write(`<span style="font-weight:700;font-size:19px;text-transform:uppercase;color:#000"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ø¢Ø¤Ù¹ Ù„ÛŒÙ¹ Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯' : 'Outlet Engraving'}</span>`);
        win.document.write(`</div>`);

        if (order.engravingType) {
          const etLabel = order.engravingType === 'direct' ? (isUrdu ? 'ÚˆØ§Ø¦Ø±ÛŒÚ©Ù¹ Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯' : 'Direct Engraving') : (isUrdu ? 'Ù¾ÛŒÚ† Ø§ÛŒÙ†Ú¯Ø±ÙˆÙ†Ú¯' : 'Patch Engraving');
          const typeLabel = isUrdu ? 'Ù‚Ø³Ù…' : 'Type';
          win.document.write(`<p style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000;margin-bottom:4px">${typeLabel}: ${etLabel}</p>`);
        }
        if (order.engravingText) {
          win.document.write(`<p style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000;margin-bottom:4px">${sec.engravingType}: ${order.engravingText}</p>`);
        }
        if (outEngravingNames.length > 0) {
          win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:3px">${sec.nameLines}</p>`);
          outEngravingNames.forEach((an, ai) => {
            if (an?.trim()) {
              win.document.write(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="background:#fff;color:#000;font-size:18px;font-weight:700;padding:2px 6px;border-radius:0;border:1.2px solid #000">L${ai + 1}</span><span style="font-size:24px;font-weight:700">${an}</span></div>`);
            }
          });
        }
        if (order.logoRequired && outEngravingLogos.length > 0) {
          win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin:6px 0 3px">${sec.logos}</p>`);
          outEngravingLogos.forEach((logo, li) => {
            if (logo?.trim()) {
              win.document.write(`<div style="font-size:20px;font-weight:700;padding:3px 8px;border-radius:0;margin-bottom:2px;border:1.2px solid #000">${logo}</div>`);
            }
          });
        }
        if (order.engravingInstructions) {
          const engInstDisplay = isUrdu ? romanToUrdu(order.engravingInstructions) : order.engravingInstructions;
          win.document.write(`<div style="border-left:1.2px solid #000;padding:6px 10px;border-radius:0;margin-top:6px">`);
          win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:4px;border-bottom:1.2px solid #000;padding-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.specialNote}</p>`);
          win.document.write(`<p style="font-size:17px;font-weight:500;line-height:2.2;color:#000;white-space:pre-wrap;word-break:break-word"${isUrdu ? ' class="urdu"' : ''}>${engInstDisplay}</p></div>`);
        }
        if (order.instructionNotes) {
          const notesDisplay = isUrdu ? romanToUrdu(order.instructionNotes) : order.instructionNotes;
          win.document.write(`<div style="border-left:1.2px solid #000;padding:6px 10px;border-radius:0;margin-top:6px">`);
          win.document.write(`<p style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;margin-bottom:4px;border-bottom:1.2px solid #000;padding-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.instructionNotes}</p>`);
          win.document.write(`<p style="font-size:17px;font-weight:500;line-height:2.2;color:#000;white-space:pre-wrap;word-break:break-word"${isUrdu ? ' class="urdu"' : ''}>${notesDisplay}</p></div>`);
        }
        win.document.write(`</div>`);
      }
    }
  }


  // â”€â”€â”€ FOOTER â”€â”€â”€
  win.document.write(`<div style="display:flex;justify-content:space-between;font-size:18px;color:#000;border-top:1.2px solid #000;padding-top:6px;margin-top:8px">`);
  win.document.write(`<span>${sec.orderEntryDate}: ${entryDate}</span>`);
  win.document.write(`<span${isUrdu ? ' class="urdu-text"' : ''}>${ru(orderType.replace(/_/g, ' '))}</span>`);
  win.document.write(`</div>`);

  closePrintWindow(win);
}

export function printDispatchSheet(order, lang = 'ur') {
  const isUrdu = lang === 'ur';
  const ru = (t) => isUrdu && t ? romanToUrdu(t) : t;
  const pu = (t) => { if (!t) return 'â€”'; if (!isUrdu) return t; return toUrduName(t); };
  const vu = pu;
  const title = (isUrdu ? 'ÚˆØ³Ù¾ÛŒÚ† Ø´ÛŒÙ¹ â€” ' : 'Dispatch Sheet â€” ') + (order.orderNumber || order.id?.slice(0, 8));
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
  win.document.write(getPrintLogoHTML());

  // â”€â”€â”€ ORDER NUMBER â”€â”€â”€
  win.document.write(`<div style="text-align:center;margin-bottom:10px">`);
  win.document.write(`<h2 style="font-size:20px;font-weight:700;text-transform:uppercase;color:#000;letter-spacing:0"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ø¢Ø±ÚˆØ± Ù†Ù…Ø¨Ø±' : 'Order #'}<span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${order.orderNumber || order.id?.slice(0, 8)}</span></h2>`);
  win.document.write(`</div>`);

  // â”€â”€â”€ CUSTOMER DETAILS â”€â”€â”€
  win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:10px 14px;margin-bottom:12px">`);
  win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;margin-bottom:4px">${order.customerName || 'â€”'}</p>`);
  win.document.write(`<p style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#000;margin-bottom:2px">${order.customerPhone || ''}</p>`);
  if (order.address) win.document.write(`<p style="font-size:16px;color:#000;margin-bottom:2px">${order.address}</p>`);
  if (order.city) win.document.write(`<p style="font-size:20px;font-weight:700;color:#000;display:inline-block;padding:4px 14px;border-radius:0;margin-top:4px;text-transform:uppercase;border:1.2px solid #000"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ø´ÛØ±:' : 'CITY:'} ${order.city}</p>`);
  win.document.write(`</div>`);

  // â”€â”€â”€ ORDER META â”€â”€â”€
  win.document.write(`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">`);
  const badgeLabels = {
    'PAID': isUrdu ? 'Ø§Ø¯Ø§ Ø´Ø¯Û' : 'PAID',
    'COD': isUrdu ? 'Ù†Ù‚Ø¯ ÚˆÙ„ÛŒÙˆØ±ÛŒ' : 'COD',
    'CASH ON DELIVERY': isUrdu ? 'Ù†Ù‚Ø¯ ÚˆÙ„ÛŒÙˆØ±ÛŒ' : 'CASH ON DELIVERY',
    'SUPER_URGENT': isUrdu ? 'Ø§Ù†ØªÛØ§Ø¦ÛŒ Ø§Ø±Ø¬Ù†Ù¹' : 'SUPER URGENT',
    'URGENT': isUrdu ? 'Ø§Ø±Ø¬Ù†Ù¹' : 'URGENT',
    'FULL_CUSTOM': isUrdu ? 'ÙÙ„ Ú©Ø³Ù¹Ù…' : 'FULL CUSTOM',
    'STANDARD': isUrdu ? 'Ø§Ø³Ù¹ÛŒÙ†ÚˆØ±Úˆ' : 'STANDARD',
  };
  const payLabel = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : 'COD';
  [order.type, order.priority, order.outletName || order.source, payLabel].filter(Boolean).forEach(label => {
    let color = '#6b7280';
    if (label === 'PAID') color = '#059669';
    else if (label === 'SUPER_URGENT') color = '#dc2626';
    else if (label === 'URGENT') color = '#000';
    else if (label === 'CASH ON DELIVERY' || label === 'COD') color = '#dc2626';
    else if (label === 'FULL_CUSTOM') color = '#059669';
    const displayLabel = badgeLabels[label] || ru(label);
    win.document.write(`<span style="padding:3px 12px;border-radius:0;font-size:18px;font-weight:700;text-transform:uppercase;background:#fff;color:#000;border:1.2px solid #000"${isUrdu ? ' class="urdu-text"' : ''}>${displayLabel}</span>`);
  });
  win.document.write(`</div>`);

  // â”€â”€â”€ PRODUCTS TABLE â”€â”€â”€
  win.document.write(`<div class="section-title${isUrdu ? ' urdu' : ''}" style="margin-top:4px">${isUrdu ? 'Ø¢Ø±Ù¹ÛŒÚ©Ù„Ø²' : 'Products'}</div>`);
  const rawPd = parseJSON(order.productDetails);
  const allItems = Array.isArray(rawPd) ? rawPd : null;
  const firstProduct = allItems ? getItemProduct(allItems[0]) : (rawPd || {});
  const isMultiItem = allItems && allItems.length > 0;

  if (isMultiItem) {
    const th = (t) => isUrdu ? t : t;
    const thU = (en, ur) => isUrdu ? ur : en;
    win.document.write(`<table><thead><tr><th>#</th><th>${thU('Product', 'Ø¢Ø±Ù¹ÛŒÚ©Ù„')}</th><th>${thU('Color / Size', 'Ø±Ù†Ú¯ / Ø³Ø§Ø¦Ø²')}</th><th style="text-align:center">${thU('Qty', 'ØªØ¹Ø¯Ø§Ø¯')}</th><th style="text-align:right">${thU('Price', 'Ù‚ÛŒÙ…Øª')}</th></tr></thead><tbody>`);
    allItems.forEach((item, idx) => {
      const p = getItemProduct(item);
      const slMap = isUrdu ? { 'full':'ÙÙ„', 'half':'ÛØ§Ù', 'three-quarter':'ØªÚ¾Ø±ÛŒ Ú©ÙˆØ§Ø±Ù¹Ø±' } : { 'full':'Full', 'half':'Half', 'three-quarter':'3 Quarter' };
      const shMap = isUrdu ? { 'long':'Ù„Ø§Ù†Ú¯', 'short':'Ø´Ø§Ø±Ù¹', 'regular':'Ø±ÛŒÚ¯ÙˆÙ„Ø±' } : { 'long':'Long', 'short':'Short', 'regular':'Regular' };
      const sleeveLabel = isUrdu ? 'Ø¢Ø³ØªÛŒÙ†:' : 'Sleeve:';
      const lengthLabel = isUrdu ? 'Ù„Ù…Ø¨Ø§Ø¦ÛŒ:' : 'Length:';
      const extras = [p.sleeveLength ? `${sleeveLabel} ${slMap[p.sleeveLength] || p.sleeveLength}` : null, p.shirtLength ? `${lengthLabel} ${shMap[p.shirtLength] || p.shirtLength}` : null].filter(Boolean).join(' | ');
      win.document.write(`<tr>`);
      win.document.write(`<td style="font-weight:700">${idx + 1}</td>`);
      win.document.write(`<td class="product-name">${pu(p.productType || p.name) || 'â€”'}</td>`);
      win.document.write(`<td>${[vu(p.fabricType), vu(p.color), p.size, p.gender].filter(Boolean).join(' â€¢ ') || 'â€”'}${extras ? ` â€¢ ${extras}` : ''}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:700">${item.quantity || 1}</td>`);
      win.document.write(`<td style="text-align:right;font-weight:700">${currency(item.totalPrice)}</td>`);
      win.document.write(`</tr>`);
    });
    win.document.write(`</tbody></table>`);
  } else {
    const thU = (en, ur) => isUrdu ? ur : en;
    win.document.write(`<table><thead><tr><th>${thU('Product', 'Ø¢Ø±Ù¹ÛŒÚ©Ù„')}</th><th>${thU('Color / Size', 'Ø±Ù†Ú¯ / Ø³Ø§Ø¦Ø²')}</th><th style="text-align:center">${thU('Qty', 'ØªØ¹Ø¯Ø§Ø¯')}</th><th style="text-align:right">${thU('Price', 'Ù‚ÛŒÙ…Øª')}</th></tr></thead><tbody>`);
    win.document.write(`<tr>`);
    win.document.write(`<td style="font-weight:700">${pu(firstProduct.productType || firstProduct.name) || 'â€”'}</td>`);
    win.document.write(`<td>${[vu(firstProduct.fabricType), vu(firstProduct.color), firstProduct.size, firstProduct.gender].filter(Boolean).join(' â€¢ ') || 'â€”'}</td>`);
    win.document.write(`<td style="text-align:center;font-weight:700">${order.quantity || 1}</td>`);
    win.document.write(`<td style="text-align:right;font-weight:700">${currency(order.totalPrice)}</td>`);
    win.document.write(`</tr></tbody></table>`);
  }

  // â”€â”€â”€ FINANCIAL SUMMARY â”€â”€â”€
  win.document.write(`<div class="section-title${isUrdu ? ' urdu' : ''}" style="margin-top:8px">${isUrdu ? 'Ù…Ø§Ù„ÛŒ Ø®Ù„Ø§ØµÛ' : 'Financial Summary'}</div>`);
  win.document.write(`<div style="border:1.2px solid #000;border-radius:0;padding:10px 14px">`);
  win.document.write(summaryRow(isUrdu ? 'Ú©Ù„ Ù‚ÛŒÙ…Øª' : 'Total Price', currency(order.totalPrice)));
  if (parseFloat(order.deliveryCharges || 0) > 0) {
    win.document.write(summaryRow(isUrdu ? 'ÚˆÙ„ÛŒÙˆØ±ÛŒ Ú†Ø§Ø±Ø¬Ø²' : 'Delivery Charges', currency(order.deliveryCharges)));
  }
  if (parseFloat(order.discount || 0) > 0) {
    win.document.write(summaryRow(isUrdu ? 'ÚˆØ³Ú©Ø§Ø¤Ù†Ù¹' : 'Discount', `-${currency(order.discount)}`));
  }
  if (parseFloat(order.advanceAmount || 0) > 0) {
    win.document.write(summaryRow(isUrdu ? 'Ø§ÛŒÚˆÙˆØ§Ù†Ø³ Ø§Ø¯Ø§ Ø´Ø¯Û' : 'Advance Paid', `-${currency(order.advanceAmount)}`));
  }
  win.document.write(`<div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:3px solid #000;margin-top:6px;font-size:22px"${isUrdu ? ' class="urdu"' : ''}>`);
  win.document.write(`<span style="font-weight:700">${isUrdu ? 'Ú©Ù„ Ø±Ù‚Ù…' : 'Grand Total'}</span>`);
  win.document.write(`<span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${currency(order.totalPrice)}</span>`);
  win.document.write(`</div>`);
  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID') {
    win.document.write(`<div style="text-align:center;margin-top:8px;padding:6px 0;border:1.2px solid #000;border-radius:0;font-size:20px;font-weight:700;color:#000"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ø§Ø¯Ø§ Ø´Ø¯Û âœ“' : 'PAID âœ“'}</div>`);
  } else if (parseFloat(order.advanceAmount || 0) > 0) {
    win.document.write(`<div style="display:flex;justify-content:space-between;margin-top:8px;padding:6px 10px;border:1.2px solid #000;border-radius:0;font-size:18px;font-weight:700"${isUrdu ? ' class="urdu"' : ''}>`);
    win.document.write(`<span style="color:#000">${isUrdu ? 'Ø§ÛŒÚˆÙˆØ§Ù†Ø³ Ù…ÙˆØµÙˆÙ„:' : 'Advance Received:'} <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${currency(order.advanceAmount)}</span></span>`);
    win.document.write(`<span style="color:#000">${isUrdu ? 'Ø¨Ø§Ù‚ÛŒ:' : 'Remaining:'} <span style="font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600">${currency(parseFloat(order.totalPrice) - parseFloat(order.advanceAmount || 0))}</span></span>`);
    win.document.write(`</div>`);
  } else {
    win.document.write(`<div style="text-align:center;margin-top:8px;padding:6px 0;border:1.2px solid #000;border-radius:0;font-size:20px;font-weight:700;color:#000"${isUrdu ? ' class="urdu"' : ''}>${isUrdu ? 'Ù†Ù‚Ø¯ ÚˆÙ„ÛŒÙˆØ±ÛŒ' : 'CASH ON DELIVERY'}</div>`);
  }
  win.document.write(`</div>`);

  // â”€â”€â”€ DISPATCH METHOD â”€â”€â”€
  if (order.deliveryMethod) {
    win.document.write(`<div style="margin-top:10px;padding:8px 14px;border:1.2px solid #000;border-radius:0;text-align:center"${isUrdu ? ' class="urdu"' : ''}>`);
    win.document.write(`<span style="font-size:20px;font-weight:700;color:#000;text-transform:uppercase">${isUrdu ? 'ÚˆØ³Ù¾ÛŒÚ† Ø·Ø±ÛŒÙ‚Û:' : 'Dispatch Method:'} ${order.deliveryMethod}</span>`);
    if (order.trackingNumber) {
      win.document.write(`<p style="font-size:18px;font-weight:700;color:#000;margin-top:4px">${isUrdu ? 'Ù¹Ø±ÛŒÚ©Ù†Ú¯:' : 'Tracking:'} ${order.trackingNumber}</p>`);
    }
    win.document.write(`</div>`);
  }

  closePrintWindow(win);
}



