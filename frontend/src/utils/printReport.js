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
`;

/** Basic Roman English to Urdu transliteration for production staff */
function romanToUrdu(text) {
  if (!text) return '';
  // Common phrase dictionary (industry-specific)
  const phrases = {
    'double stitch': 'ڈبل سلائی',
    'single stitch': 'سنگل سلائی',
    'full sleeve': 'فل آستین',
    'half sleeve': 'آدھی آستین',
    'quarter sleeve': 'چوتھائی آستین',
    'long length': 'لمبی لمبائی',
    'short length': 'چھوٹی لمبائی',
    'regular length': 'ریگولر لمبائی',
    'matching cap': 'میچنگ کیپ',
    'with dupatta': 'دوپٹے کے ساتھ',
    'without dupatta': 'دوپٹے کے بغیر',
    'with zip': 'زپ کے ساتھ',
    'without zip': 'زپ کے بغیر',
    'embroidery': 'کڑھائی',
    'logo': 'لوگو',
    'color': 'رنگ',
    'size': 'سائز',
    'fabric': 'کپڑا',
    'measurement': 'پیمائش',
    'special note': 'خصوصی نوٹ',
    'note': 'نوٹ',
    'urgent': 'ارجنٹ',
    'super urgent': 'انتہائی ارجنٹ',
    'normal': 'عام',
    'custom': 'کسٹم',
    'standard': 'اسٹینڈرڈ',
    'ready logo': 'ریڈی لوگو',
    'enamels': 'اینملز',
    'johar town': 'جوہر ٹاؤن',
    'jail road': 'جیل روڈ',
    'abbottabad': 'ایبٹ آباد',
    'lahore': 'لاہور',
    'islamabad': 'اسلام آباد',
    'karachi': 'کراچی',
    'male': 'مرد',
    'female': 'خاتون',
    'stitch': 'سلائی',
    'fit': 'فٹ',
    'regular': 'ریگولر',
    'slim': 'سلم',
    'loose': 'ڈھیلا',
    'chest': 'سینہ',
    'shoulder': 'کندھا',
    'waist': 'کمر',
    'bottom': 'نیچے',
    'sleeve': 'آستین',
    'length': 'لمبائی',
    'thigh': 'ران',
    'hip': 'کولہ',
    'hips': 'کولہے',
    'mori': 'موڑی',
    'ganda': 'گانڈا',
    'neck': 'گردن',
    'armhole': 'بغل',
    'bicep': 'عضلہ',
    'wrist': 'کلائی',
    'inseam': 'ان سیون',
    'outseam': 'آؤٹ سیون',
    'calf': 'پنڈلی',
    'ankle': 'ٹخنہ',
    'trouser': 'پتلون',
    'shirt': 'قمیض',
    'dupatta': 'دوپٹہ',
    'zip': 'زپ',
    'cap': 'کیپ',
    'qty': 'تعداد',
    'quantity': 'تعداد',
    'price': 'قیمت',
    'total': 'کل',
    'order': 'آرڈر',
    'payment': 'ادائیگی',
    'paid': 'ادا شدہ',
    'pending': 'زیر التوا',
    'delivery': 'ڈلیوری',
    'free': 'مفت',
    'discount': 'چھوٹ',
    'advance': 'ایڈوانس',
    'grand total': 'کل رقم',
    'product': 'پروڈکٹ',
    'engraving': 'اینگرونگ',
    'measurements': 'پیمائش',
    'financial summary': 'مالی خلاصہ',
    'instruction notes': 'ہدایات',
    'job sheet': 'جاب شیٹ',
    'products': 'پروڈکٹس',
    'branding': 'اینگرونگ',
    'tailoring': 'درزی',
    'sewing': 'سلائی',
    'production': 'پروڈکشن',
    'dispatch': 'ڈسپیچ'
  };
  // Case-insensitive phrase replacement first
  let result = text;
  const lower = text.toLowerCase();
  for (const [eng, urd] of Object.entries(phrases)) {
    const regex = new RegExp('\\b' + eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(regex, urd);
  }
  // Simple character-level mapping for remaining words
  const charMap = {
    'a': 'ا', 'b': 'ب', 'p': 'پ', 't': 'ت', 's': 'س', 'j': 'ج', 'h': 'ہ',
    'k': 'ک', 'l': 'ل', 'm': 'م', 'n': 'ن', 'w': 'و', 'y': 'ی', 'r': 'ر',
    'z': 'ز', 'f': 'ف', 'q': 'ق', 'd': 'د', 'g': 'گ', 'e': 'ے', 'i': 'ی',
    'o': 'و', 'u': 'و', 'c': 'ک', 'v': 'و', 'x': 'کس'
  };
  // Apply char mapping to remaining English words (fallback for unmatched phrases)
  const words = result.split(/(\s+)/);
  result = words.map(word => {
    if (/[\u0600-\u06FF]/.test(word)) return word; // already has Urdu chars
    if (/[a-zA-Z]/.test(word)) {
      const len = word.length;
      if (len <= 2) return word; // short words likely names – keep as-is
      return word.toLowerCase().split('').map(ch => charMap[ch] || ch).join('');
    }
    return word;
  }).join('');
  return result;
}

export function openPrintWindow(title) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
  win.document.write('<div class="report-header">');
  win.document.write(`<h1>${title}</h1>`);
  win.document.write(`<p>Enamels Production — Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>`);
  win.document.write('</div>');
  return win;
}

export function closePrintWindow(win) {
  win.document.write('<div class="footer">Enamels Production — This is a computer-generated report.<br><span style="font-size:16px;font-weight:400;color:#aaa">Software is developed by Sameer Butt</span></div>');
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
  stitchingStyle: 'سلائی',
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
  stitchingStyle: 'Stitching',
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

  const slMap = { 'full':'Full Sleeve', 'half':'Half Sleeve', 'three-quarter':'3 Quarter Sleeve' };
  const shMap = { 'long':'Full Length', 'short':'Short Length', 'regular':'Regular Length' };
  const femSlMap = { 'full':'Full Sleeve', 'half':'Half Sleeve', 'medium':'Medium Sleeve' };
  const femShMap = { 'long':'Full Length', 'short':'Short Length' };
  const slDisplay = (v) => v ? (slMap[v] || v) : '';
  const shDisplay = (v) => v ? (shMap[v] || v) : '';
  const sec = lang === 'en' ? enSection : urduSection;
  const isUrdu = lang === 'ur';

  const orderType = order.type || 'STANDARD';
  const title = `${sec.jobSheet} — ${order.orderNumber || order.id?.slice(0, 8)}`;
  const win = openPrintWindow(title);

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
  win.document.write(`<p style="font-size:20px;color:#000;margin-top:3px;font-weight:700">Order #${order.orderNumber || order.id?.slice(0, 8)}</p>`);
  win.document.write(`</div>`);
  win.document.write(`<div style="text-align:right">`);
  win.document.write(`<p style="font-size:22px;font-weight:900">${order.customerName || '—'}</p>`);
  win.document.write(`<p style="font-size:20px;color:#000;font-weight:600">${order.customerPhone || ''}</p>`);
  if (order.address) win.document.write(`<p style="font-size:18px;color:#000">${order.address}</p>`);
  if (order.city) win.document.write(`<p style="font-size:24px;font-weight:900;color:#000;background:#fef3c7;display:inline-block;padding:4px 14px;border-radius:6px;margin-top:4px;text-transform:uppercase">📍 CITY: ${order.city}</p>`);
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
  const _payLabel = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? 'PAID' : (parseFloat(order.advanceAmount || 0) > 0 ? `REMAINING COD: ₨${Math.max(0, (order.totalPrice || 0) - parseFloat(order.advanceAmount || 0)).toLocaleString()}` : 'CASH ON DELIVERY');
  const _payColor = order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID' ? '#059669' : (parseFloat(order.advanceAmount || 0) > 0 ? '#d97706' : '#dc2626');
  [order.type, order.priority, order.outletName || order.source, _payLabel].filter(Boolean).forEach(label => {
    let color = '#6b7280';
    if (label === 'PAID' || label === 'FULL_CUSTOM') color = '#059669';
    else if (label === 'SUPER_URGENT') color = '#dc2626';
    else if (label === 'URGENT') color = '#d97706';
    else if (label === 'OUTLET') color = '#7c3aed';
    else if (label.startsWith('REMAINING COD')) color = '#d97706';
    else if (label === 'CASH ON DELIVERY') color = '#dc2626';
    win.document.write(`<span style="padding:3px 12px;border-radius:6px;font-size:20px;font-weight:700;text-transform:uppercase;background:${color}20;color:${color};border:2px solid ${color}40">${label}</span>`);
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
  win.document.write(`<div class="section-title" style="font-size:26px">${sec.products}</div>`);
  if (isMultiItem) {
    const showCap = orderType !== 'STANDARD';
    const headers = ['#', sec.product, sec.fabricColor, sec.sizeGender, sec.qty].concat(showCap ? [sec.cap] : []).concat(['Price']);
    win.document.write(`<table><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    allItems.forEach((item, idx) => {
      const p = item.productDetails || {};
      const capQty = showCap && p.matchingCap ? (p.matchingCapQty || 0) : (showCap && item.capCharges > 0 ? (p.femaleOptions?.cap || 0) : 0);
      win.document.write(`<tr>`);
      win.document.write(`<td style="font-weight:700">${idx + 1}</td>`);
      win.document.write(`<td style="font-weight:700">${p.productType || '—'}</td>`);
      win.document.write(`<td>${[p.fabricType, p.color].filter(Boolean).join(' • ')}</td>`);
      const extras = [p.sleeveLength ? `${sec.sleeves}: ${slDisplay(p.sleeveLength)}` : null, p.shirtLength ? `${sec.length}: ${shDisplay(p.shirtLength)}` : null].filter(Boolean).join(' | ');
      win.document.write(`<td>${p.size || cap('Custom')} • ${p.gender || 'Male'}${extras ? ` • ${extras}` : ''}</td>`);
      win.document.write(`<td style="text-align:center;font-weight:700">${item.quantity || 1}</td>`);
      if (showCap) win.document.write(`<td style="text-align:center;font-weight:700;color:#000">${capQty || '—'}</td>`);
      win.document.write(`<td style="text-align:right;font-weight:700">${priceDisplay(item.totalPrice)}</td>`);
      win.document.write(`</tr>`);
    });
    win.document.write(`</tbody></table>`);
  } else {
    const showCap = orderType !== 'STANDARD';
    const capQty = showCap && firstProduct.matchingCap ? (firstProduct.matchingCapQty || 0) : 0;
    const headers = [sec.product, 'Fabric', 'Color', 'Size', 'Gender', sec.qty].concat(showCap ? [sec.cap] : []).concat(['Price']);
    win.document.write(`<table><thead><tr>${headers.map(h => '<th>' + h + '</th>').join('')}</tr></thead><tbody>`);
    win.document.write(`<tr>`);
    win.document.write(`<td style="font-weight:700">${firstProduct.productType || '—'}</td>`);
    win.document.write(`<td>${firstProduct.fabricType || '—'}</td>`);
    win.document.write(`<td>${firstProduct.color || '—'}</td>`);
    const extras = [firstProduct.sleeveLength ? `${sec.sleeves}: ${slDisplay(firstProduct.sleeveLength)}` : null, firstProduct.shirtLength ? `${sec.length}: ${shDisplay(firstProduct.shirtLength)}` : null].filter(Boolean).join(' | ');
    win.document.write(`<td>${firstProduct.size || cap('Custom')}</td>`);
    win.document.write(`<td>${firstProduct.gender || 'Male'}${extras ? ` ${extras}` : ''}</td>`);
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
      return c?.engravingType || c?.nameSpelling || c?.nameColor || c?.logoPlacement || c?.logos?.length > 0 || c?.designNotes || c?.articleNames?.length > 0;
    });
    if (!hasAnyCustomization) { /* no customization data, skip engraving section */ }
    else {
      win.document.write(`<div class="section-title" style="font-size:26px">${sec.engraving}</div>`);
      brandingItems.forEach((item, idx) => {
        const p = item.productDetails || {};
        const c = item.customization ? parseJSON(item.customization) : custom;
        const hasNames = c?.articleNames?.length > 0 || c?.nameSpelling;
        const hasLogos = c?.logos?.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).length > 0;
        const hasSpecs = c?.nameColor || c?.logoPlacement || c?.engravingType;
        const hasNotes = c?.designNotes;

        if (!hasNames && !hasLogos && !hasSpecs && !hasNotes) return;

        win.document.write(`<div style="border:2px solid #ddd;border-radius:8px;padding:8px 10px;margin-bottom:8px;page-break-inside:avoid">`);
        win.document.write(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:2px solid #eee">`);
        win.document.write(`<span style="background:#111;color:#fff;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800">${idx + 1}</span>`);
        win.document.write(`<span style="font-weight:900;font-size:22px;text-transform:uppercase">${p.productType || 'Item ' + (idx + 1)}</span>`);
        if (p.color) win.document.write(`<span style="font-size:18px;color:#000">(${p.color})</span>`);
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
          if (c.articleNames?.length > 0) {
            c.articleNames.forEach((an, ai) => {
              win.document.write(`<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="background:#7c3aed20;color:#7c3aed;font-size:18px;font-weight:800;padding:2px 6px;border-radius:3px">L${ai + 1}</span><span style="font-size:24px;font-weight:700">${an}</span></div>`);
            });
          } else {
            win.document.write(`<div style="display:flex;align-items:center;gap:6px"><span style="background:#7c3aed20;color:#7c3aed;font-size:18px;font-weight:800;padding:2px 6px;border-radius:3px">L1</span><span style="font-size:24px;font-weight:700">${c.nameSpelling}</span></div>`);
          }
          win.document.write(`</div>`);
        }

        // Specs badges
        if (hasSpecs) {
          win.document.write(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">`);
          if (c.nameColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#fce7f3;color:#9d174d">${sec.color}: ${c.nameColor}</span>`);
          if (c.logoPlacement) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#ccfbf1;color:#0f766e">${sec.position}: ${c.logoPlacement}</span>`);
          if (c.logoColor) win.document.write(`<span style="font-size:18px;font-weight:700;padding:3px 8px;border-radius:4px;background:#fef3c7;color:#92400e">Logo: ${c.logoColor}</span>`);
          win.document.write(`</div>`);
        }

        // Logos
        if (hasLogos) {
          win.document.write(`<div style="margin-bottom:6px">`);
          win.document.write(`<p style="font-size:20px;font-weight:800;text-transform:uppercase;color:#000;margin-bottom:3px"${isUrdu ? ' class="urdu"' : ''}>${sec.logos}</p>`);
          c.logos.filter(l => (l.name && l.design) || (l.name?.length > 2 || l.design?.length > 2)).forEach((l, li) => {
            win.document.write(`<div style="font-size:22px;font-weight:700;background:#fffbeb;padding:3px 8px;border-radius:4px;margin-bottom:2px;border:2px solid #fef3c7">${l.name || l.design}${l.name && l.design ? ` — ${l.design}` : ''}</div>`);
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
          win.document.write(`<p style="font-size:20px;font-weight:900;text-transform:uppercase;color:#000;margin-bottom:4px">#${idx + 1} ${p.productType || ''}</p>`);
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
        const opts = [slv ? `${sec.sleeves}: ${slv && p.sleeveLength ? slDisplay(slv) : (femSlMap[slv] || slv)}` : null, slen ? `${sec.length}: ${slen && p.shirtLength ? shDisplay(slen) : (femShMap[slen] || slen)}` : null, (p.gender === 'Female' && p.femaleOptions?.dupatta) ? 'Dupatta' : null].filter(Boolean);
        if (opts.length > 0) {
          win.document.write(`<p style="font-size:20px;margin-top:6px;color:#000;font-weight:700">${opts.join(' | ')}</p>`);
        }
        const ic = item.customization ? (typeof item.customization === 'string' ? JSON.parse(item.customization) : item.customization) : custom;
        const hasAttr = ic?.stitchingStyle || ic?.fitType || p.fabricSourceProduct || p.colorSourceProduct || p.designSourceProduct || p.sizeSourceProduct || p.additionalProductRef;
        if (hasAttr) {
          win.document.write(`<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">`);
          if (ic?.stitchingStyle) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#dbeafe;color:#1e40af;border:1px solid #93c5fd">${isUrdu ? romanToUrdu(ic.stitchingStyle === 'DBL' ? 'Double Stitch' : 'Single Stitch') : (ic.stitchingStyle === 'DBL' ? 'Double Stitch' : 'Single Stitch')}</span>`);
          if (ic?.fitType) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc">${isUrdu ? romanToUrdu(ic.fitType + ' Fit') : ic.fitType + ' Fit'}</span>`);
          if (p.fabricSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.fabricSource}: ${p.fabricSourceProduct}</span>`);
          if (p.colorSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.colorSource}: ${p.colorSourceProduct}</span>`);
          if (p.designSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.designSource}: ${p.designSourceProduct}</span>`);
          if (p.sizeSourceProduct) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">${sec.sizeSource}: ${p.sizeSourceProduct}</span>`);
          if (p.additionalProductRef) win.document.write(`<span style="font-size:16px;font-weight:700;padding:4px 10px;border-radius:4px;background:#fef3c7;color:#d97706;border:1px solid #f59e0b">Extra: ${p.additionalProductRef}</span>`);
          win.document.write(`</div>`);
        }
        if (s.specialNote) {
          win.document.write(`<div style="margin-top:6px;background:#fef9e7;border:2px solid #f0c040;border-radius:6px;padding:8px 12px"><p style="font-size:18px;font-weight:800;color:#b8860b;margin-bottom:2px">${isUrdu ? romanToUrdu('Special Note') : 'Special Note'}</p><p style="font-size:20px;font-weight:600;color:#8b6914;font-style:italic">${isUrdu ? romanToUrdu(s.specialNote) : s.specialNote}</p></div>`);
        }
        win.document.write(`</div>`);
      });
    }
  }

  // ─── FOOTER ───
  win.document.write(`<div style="display:flex;justify-content:space-between;font-size:18px;color:#000;border-top:2px solid #ddd;padding-top:6px;margin-top:8px">`);
  win.document.write(`<span>${sec.orderEntryDate}: ${entryDate}</span>`);
  win.document.write(`<span>${orderType.replace(/_/g, ' ')}${isUrdu ? '' : ''}</span>`);
  win.document.write(`</div>`);

  closePrintWindow(win);
}
