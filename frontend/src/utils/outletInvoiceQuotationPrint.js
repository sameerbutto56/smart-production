// Outlet Invoice and Quotation A4 printing utility and HTML generators for Johar Town Outlet.
// Strictly designed for A4 (210mm x 297mm) standard printing with Enamels branding and Meezan Bank details.

export const A4_PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 10mm 12mm 10mm 12mm;
}
* {
  box-sizing: border-box;
}
body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
  color: #0f172a;
  background: #ffffff;
  margin: 0;
  padding: 0;
  font-size: 9.5px;
  line-height: 1.35;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.a4-container {
  width: 100%;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  padding: 4px 6px;
}
@media print {
  .no-print {
    display: none !important;
  }
  .page-break {
    page-break-before: always;
  }
}
`;

// Helper: Convert Number to Words in Pakistani / International Format
export function numberToWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'ZERO';

  const a = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function convertHundreds(val) {
    let str = '';
    if (val >= 100) {
      str += a[Math.floor(val / 100)] + ' HUNDRED ';
      val %= 100;
      if (val > 0) str += '& ';
    }
    if (val >= 20) {
      str += b[Math.floor(val / 10)] + (val % 10 > 0 ? ' ' + a[val % 10] : '') + ' ';
    } else if (val > 0) {
      str += a[val] + ' ';
    }
    return str.trim();
  }

  const billion = Math.floor(n / 1000000000);
  const million = Math.floor((n % 1000000000) / 1000000);
  const thousand = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  let result = '';
  if (billion) result += convertHundreds(billion) + ' BILLION ';
  if (million) result += convertHundreds(million) + ' MILLION ';
  if (thousand) result += convertHundreds(thousand) + ' THOUSAND ';
  if (remainder) {
    if (result && !result.endsWith('& ') && remainder < 100) result += '& ';
    result += convertHundreds(remainder);
  }

  return result.trim().replace(/\s+/g, ' ');
}

// Logo helper
export async function getLogoSrc() {
  const originLogo = window.location.origin + '/logo.png';
  try {
    const res = await fetch(originLogo);
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    // fallback to url
  }
  return originLogo;
}

// Extract product items from order object (supports productDetails JSON array or fallback single item)
export function extractOrderItems(order) {
  if (!order) return [];
  if (Array.isArray(order.productDetails) && order.productDetails.length > 0) {
    return order.productDetails.map((p, idx) => {
      const nested = (p.productDetails && typeof p.productDetails === 'object') ? p.productDetails : {};
      const custom = (p.customization && typeof p.customization === 'object') ? p.customization : {};

      // Accurate Product Name: check top-level, then nested productType/name/productName
      const name = (p.name || p.productType || p.productName || nested.productType || nested.name || nested.productName || 'Medical Scrub / Apparel').trim();

      // Accurate Size: standard size or nested size or measurement object/string
      let size = p.size || nested.size || '';
      if (!size && p.sizeData) {
        if (typeof p.sizeData === 'string') {
          // If sizeData is a simple string (e.g. "M", "42"), use it; if JSON measurements, leave size clean
          if (!p.sizeData.startsWith('{') && !p.sizeData.startsWith('[')) {
            size = p.sizeData.trim();
          }
        }
      }

      // Accurate Color: top-level or nested
      const color = (p.color || nested.color || '').trim();

      // Accurate Fabric
      const fabric = (p.fabric || p.fabricType || nested.fabricType || nested.fabric || '').trim();

      // Accurate Gender
      const gender = (p.gender || nested.gender || '').trim();

      const qty = parseInt(p.quantity, 10) || 1;
      const unitPrice = parseFloat(p.unitPrice || 0);
      const lineTotal = parseFloat(p.totalPrice || (qty * unitPrice) || 0);

      // Engravings / Logos / Customization Details
      const customizations = [];

      // 1. Engraving text & Doctor name
      const engText = p.engravingText || custom.nameSpelling || (Array.isArray(custom.articleNames) ? custom.articleNames.filter(Boolean).join(', ') : '') || (Array.isArray(p.engravingLines) ? p.engravingLines.map(l => typeof l === 'object' ? l.text : l).filter(Boolean).join(', ') : '');
      const engType = p.engravingType || custom.engravingType || '';
      if (engText && engText.trim()) {
        customizations.push(`Engraving: ${engText.trim()}${engType ? ` (${engType})` : ''}`);
      }

      // 2. Logos
      let logoInfo = '';
      if (Array.isArray(custom.logos) && custom.logos.length > 0) {
        const logoNames = custom.logos.map(l => typeof l === 'object' ? (l.name || l.design) : l).filter(Boolean).join(', ');
        if (logoNames) logoInfo = logoNames;
      }
      if (!logoInfo && Array.isArray(p.logoEntries) && p.logoEntries.length > 0) {
        logoInfo = p.logoEntries.map(l => typeof l === 'object' ? l.name : l).filter(Boolean).join(', ');
      }
      if (!logoInfo && (p.logoName || p.logoDesign || custom.logoPlacement)) {
        logoInfo = [p.logoName, p.logoDesign, custom.logoPlacement].filter(Boolean).join(' ');
      }
      if (logoInfo && logoInfo.trim()) {
        customizations.push(`Logo: ${logoInfo.trim()}`);
      }

      // 3. Matching Cap
      if (p.matchingCap || nested.matchingCap) {
        const capQty = p.matchingCapQty || nested.matchingCapQty || 1;
        customizations.push(`Matching Cap: ${capQty}x`);
      }

      // 4. Special Notes & Alterations
      const specNote = p.measurementSpecialNote || custom.designNotes || nested.customSpecifications || '';
      if (specNote && specNote.trim()) {
        customizations.push(`Note: ${specNote.trim()}`);
      }

      // 5. Alteration specifications (shirt, sleeve, trouser length)
      if (nested.alteration && typeof nested.alteration === 'object') {
        const alts = Object.entries(nested.alteration)
          .filter(([, v]) => v && String(v).trim().length > 0)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        if (alts) customizations.push(`Alteration: ${alts}`);
      }

      return {
        sr: idx + 1,
        name,
        size,
        color,
        fabric,
        gender,
        qty,
        unitPrice,
        lineTotal: lineTotal > 0 ? lineTotal : (qty * unitPrice),
        customizations: customizations.join(' · ')
      };
    });
  }

  // Fallback to order-level fields if productDetails is not an array
  const total = parseFloat(order.totalPrice || 0);
  const qty = parseInt(order.quantity, 10) || 1;
  const unit = qty > 0 ? (total / qty) : total;
  return [{
    sr: 1,
    name: order.productType || 'Custom Medical Apparel',
    size: (typeof order.sizeData === 'string' && !order.sizeData.startsWith('{') ? order.sizeData : '') || '',
    color: '',
    fabric: '',
    gender: order.gender || '',
    qty,
    unitPrice: unit,
    lineTotal: total,
    customizations: [
      order.engravingRequired ? `Engraving: ${order.engravingText || ''}` : '',
      order.logoRequired ? `Logo: ${order.logoName || ''}` : '',
      order.instructionNotes ? `Note: ${order.instructionNotes}` : ''
    ].filter(Boolean).join(' · ')
  }];
}

// Generate the complete HTML for either INVOICE or QUOTATION
export function buildOutletDocumentHTML({ order, docType = 'INVOICE', customFields = {}, logoUrl = '/logo.png' }) {
  const isInvoice = docType.toUpperCase() === 'INVOICE';
  const docTitle = isInvoice ? 'INVOICE' : 'QUOTATION';
  const docNumber = isInvoice
    ? (order.invoiceNumber || (order.orderNumber ? `INV-${order.orderNumber}` : `INV-${Date.now().toString().slice(-6)}`))
    : (order.quotationNumber || (order.orderNumber ? `QT-${order.orderNumber}` : `QT-${Date.now().toString().slice(-6)}`));

  const items = extractOrderItems(order);

  // Financial calculations
  const itemsSubtotal = items.reduce((s, it) => s + (it.lineTotal || 0), 0);
  const baseOrderTotal = parseFloat(order.totalPrice || 0);
  const subtotal = itemsSubtotal > 0 ? itemsSubtotal : baseOrderTotal;
  const deliveryCharges = parseFloat(order.deliveryCharges || 0);
  const discountAmount = parseFloat(order.discountAmount || 0);
  const grandTotal = Math.max(0, subtotal + deliveryCharges - discountAmount);
  
  const advanceAmount = parseFloat(order.advanceAmount || 0);
  const balanceAmount = order.balanceAmount != null ? parseFloat(order.balanceAmount) : Math.max(0, grandTotal - advanceAmount);
  const paymentStatus = order.paymentStatus ? String(order.paymentStatus).toUpperCase() : (balanceAmount <= 0.01 ? 'PAID' : 'BALANCE');

  const customerName = order.customerName || 'Valued Customer';
  const customerPhone = order.customerPhone || '—';
  const address = order.address || '';
  const city = order.city || 'Lahore';
  const outletName = order.outletName || 'Johar Town Outlet';

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

  // Rows for Items Table
  const rowsHTML = items.map((it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
      <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600; color: #64748b; font-size: 9px;">
        ${String(idx + 1).padStart(2, '0')}
      </td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">
        <div style="font-weight: 700; color: #0f172a; font-size: 10px;">${it.name}</div>
        <div style="font-size: 8px; color: #475569; margin-top: 1px;">
          ${[it.color ? `Color: ${it.color}` : '', it.size ? `Size: ${it.size}` : '', it.fabric ? `Fabric: ${it.fabric}` : '', it.gender ? `Gender: ${it.gender}` : ''].filter(Boolean).join(' | ')}
        </div>
        ${it.customizations ? `<div style="font-size: 7.5px; color: #1e3a8a; margin-top: 2px; font-weight: 600;">✨ ${it.customizations}</div>` : ''}
      </td>
      <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 10px;">
        ${it.qty}
      </td>
      <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; color: #334155; font-size: 9.5px;">
        Rs. ${it.unitPrice.toLocaleString()}
      </td>
      <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 10px;">
        Rs. ${it.lineTotal.toLocaleString()}
      </td>
    </tr>
  `).join('');

  // Default terms & conditions
  const defaultTerms = isInvoice
    ? `1. Customized apparel and embroidered goods cannot be exchanged or refunded once processed.\n2. Please inspect garments upon receipt. Any sizing discrepancies must be reported within 48 hours.\n3. Orders kept uncollected for over 30 days are subject to handling charges.`
    : `1. This quotation is valid for 15 days from the date of issue.\n2. Prices are based on requested fabric, design, and size specifications.\n3. Production commences upon confirmation and receipt of the advance payment.\n4. Standard delivery timelines apply as agreed upon order confirmation.`;

  const termsContent = customFields.termsAndConditions || defaultTerms;

  return `
    <div class="a4-container">
      <!-- HEADER BRANDING -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoUrl}" alt="ENAMELS" style="height: 52px; width: auto; object-fit: contain;">
          <div>
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase;">
              ENAMELS
            </div>
            <div style="font-size: 8px; font-weight: 700; color: #b8860b; letter-spacing: 1.2px; text-transform: uppercase;">
              PREMIUM MEDICAL APPAREL &amp; SCRUBS
            </div>
            <div style="font-size: 7.5px; color: #475569; margin-top: 1px;">
              375A-2 Johar Town, Lahore | Contact: 030 11 33 11 33 | info@enamelsonline.com
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="display: inline-block; background: ${isInvoice ? '#1e293b' : '#047857'}; color: #ffffff; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">
            ${docTitle}
          </div>
          <div style="margin-top: 4px; font-size: 8.5px; color: #334155;">
            <div><strong>${isInvoice ? 'Invoice #' : 'Quotation #'}:</strong> <span style="font-weight: 800; color: #0f172a;">${docNumber}</span></div>
            <div><strong>Order Ref:</strong> ${order.orderNumber || '—'}</div>
            <div><strong>Date:</strong> ${orderDate}</div>
            <div><strong>Outlet:</strong> ${outletName}</div>
          </div>
        </div>
      </div>

      <!-- CUSTOMER / CLIENT INFO BOX -->
      <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; font-size: 8.5px;">
        <div style="flex: 1;">
          <div style="font-weight: 900; font-size: 8px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ${isInvoice ? 'INVOICE BILLED TO' : 'QUOTATION PREPARED FOR'}
          </div>
          <div style="font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase;">
            ${customerName}
          </div>
          <div style="color: #334155; margin-top: 2px;">
            <strong>Phone:</strong> ${customerPhone}
          </div>
          ${address ? `<div style="color: #334155; margin-top: 1px;"><strong>Address:</strong> ${address}</div>` : ''}
          <div style="color: #334155; margin-top: 1px;">
            <strong>City:</strong> ${city}
          </div>
        </div>

        <div style="flex: 1; border-left: 1px dashed #cbd5e1; padding-left: 12px;">
          <div style="font-weight: 900; font-size: 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
            ORDER &amp; DELIVERY DETAILS
          </div>
          <div><strong>Delivery Method:</strong> ${order.deliveryMethod || order.deliveryType || 'Store Pickup'}</div>
          ${order.trackingNumber ? `<div><strong>Tracking #:</strong> ${order.trackingNumber}</div>` : ''}
          ${order.placedBy ? `<div><strong>Staff / Served By:</strong> ${order.placedBy}</div>` : ''}
          ${isInvoice ? `<div><strong>Payment Status:</strong> <span style="font-weight: 800; color: ${paymentStatus === 'PAID' ? '#16a34a' : '#b91c1c'};">${paymentStatus}</span></div>` : ''}
        </div>
      </div>

      <!-- PRODUCTS TABLE -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
        <thead>
          <tr style="background: #1e293b; color: #ffffff;">
            <th style="padding: 5px 6px; text-align: center; width: 32px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">#</th>
            <th style="padding: 5px 8px; text-align: left; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Item Description &amp; Customizations</th>
            <th style="padding: 5px 6px; text-align: center; width: 45px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Qty</th>
            <th style="padding: 5px 8px; text-align: right; width: 85px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Unit Price</th>
            <th style="padding: 5px 8px; text-align: right; width: 95px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Total (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>

      <!-- SUMMARY ROW: Bank Details (Left) & Financial Totals (Right) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
        <!-- BANK DETAILS (Meezan Bank) -->
        <div style="flex: 1.1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 10px; font-size: 8px; color: #166534;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
            <span style="font-weight: 900; font-size: 9px; text-transform: uppercase; color: #14532d; letter-spacing: 0.5px;">
              OFFICIAL BANK ACCOUNT DETAILS
            </span>
          </div>
          <div style="font-weight: 800; font-size: 9.5px; color: #0f172a;">Account Title: ENAMELS</div>
          <div style="color: #14532d; margin-top: 1px;"><strong>Bank:</strong> Meezan Bank - College Road Lahore</div>
          <div style="color: #14532d; margin-top: 1px;"><strong>Account #:</strong> <span style="font-family: monospace; font-size: 9px; font-weight: 700; color: #0f172a;">02220105077642</span></div>
          <div style="color: #14532d; margin-top: 1px;"><strong>IBAN:</strong> <span style="font-family: monospace; font-size: 8.5px; font-weight: 700; color: #0f172a;">PK78MEZN0002220105077642</span></div>
          <div style="margin-top: 4px; padding: 2px 6px; background: #dcfce7; border-left: 2px solid #22c55e; font-style: italic; font-weight: 600; color: #15803d; font-size: 7.5px;">
            "Please deposit here. Do send a screenshot when you're done."
          </div>
        </div>

        <!-- FINANCIAL TOTALS BOX -->
        <div style="flex: 0.9; display: flex; justify-content: flex-end;">
          <table style="border-collapse: collapse; font-size: 8.5px; width: 100%; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;">
            <tr>
              <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Subtotal:</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #dbeafe;">Rs. ${subtotal.toLocaleString()}</td>
            </tr>
            ${deliveryCharges > 0 ? `
            <tr>
              <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Delivery Charges:</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #dbeafe;">Rs. ${deliveryCharges.toLocaleString()}</td>
            </tr>` : ''}
            ${discountAmount > 0 ? `
            <tr>
              <td style="padding: 3px 8px; font-weight: 700; color: #16a34a; border-bottom: 1px solid #dbeafe;">Discount:</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #16a34a; border-bottom: 1px solid #dbeafe;">-Rs. ${discountAmount.toLocaleString()}</td>
            </tr>` : ''}
            <tr style="background: #dbeafe;">
              <td style="padding: 4px 8px; font-weight: 900; color: #1e3a8a; border-bottom: 1px solid #bfdbfe; font-size: 9px;">Grand Total:</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 900; font-size: 10px; color: #1e3a8a; border-bottom: 1px solid #bfdbfe;">Rs. ${grandTotal.toLocaleString()}</td>
            </tr>
            ${isInvoice ? `
            <tr>
              <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Advance / Paid:</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #16a34a; border-bottom: 1px solid #dbeafe;">Rs. ${advanceAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 3px 8px; font-weight: 900; color: ${balanceAmount > 0.01 ? '#b91c1c' : '#15803d'};">Balance Due:</td>
              <td style="padding: 3px 8px; text-align: right; font-weight: 900; color: ${balanceAmount > 0.01 ? '#b91c1c' : '#15803d'};">Rs. ${balanceAmount.toLocaleString()}</td>
            </tr>
            ` : `
            <tr>
              <td colspan="2" style="padding: 3px 8px; font-size: 7.5px; color: #047857; text-align: center; font-weight: 700; background: #ecfdf5;">
                Quotation valid for 15 days
              </td>
            </tr>
            `}
          </table>
        </div>
      </div>

      <!-- AMOUNT IN WORDS -->
      <div style="margin: 4px 0 6px 0; padding: 4px 8px; background: #f1f5f9; border-left: 3px solid #1e3a8a; border-radius: 2px; font-size: 8px;">
        <strong style="color: #1e3a8a; text-transform: uppercase;">Amount in Words:</strong>
        <span style="font-weight: 700; font-style: italic; color: #0f172a; text-transform: uppercase; margin-left: 4px;">
          ${numberToWords(grandTotal)} RUPEES ONLY.
        </span>
      </div>

      <!-- REMARKS & NOTES (If any) -->
      ${customFields.customerRemarks ? `
      <div style="margin: 3px 0 6px 0; padding: 4px 8px; font-size: 8px; color: #334155; background: #f8fafc; border-left: 3px solid #64748b;">
        <strong>Customer Remarks:</strong>
        <span style="margin-left: 4px;">${customFields.customerRemarks}</span>
      </div>` : ''}

      ${customFields.specialInstructions ? `
      <div style="margin: 3px 0 6px 0; padding: 4px 8px; font-size: 8px; color: #1e3a8a; background: #eff6ff; border-left: 3px solid #3b82f6;">
        <strong>Special Instructions:</strong>
        <span style="margin-left: 4px;">${customFields.specialInstructions}</span>
      </div>` : ''}

      <!-- TERMS & CONDITIONS -->
      <div style="margin: 4px 0 8px 0; padding: 5px 8px; font-size: 7.5px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px;">
        <div style="font-weight: 800; text-transform: uppercase; color: #0f172a; font-size: 7.5px; margin-bottom: 2px;">
          ${isInvoice ? 'Terms &amp; Conditions' : 'Quotation Terms &amp; Validity'}
        </div>
        <div style="white-space: pre-wrap; line-height: 1.35;">${termsContent}</div>
      </div>

      <!-- SIGNATURE BLOCKS -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding: 0 16px;">
        <div style="text-align: center;">
          <div style="width: 140px; border-top: 1.5px solid #0f172a; margin-bottom: 2px;"></div>
          <div style="font-size: 8px; font-weight: 800; color: #0f172a;">${customFields.preparedBy || 'Johar Town Outlet / Authorized'}</div>
          <div style="font-size: 7px; color: #64748b;">Prepared &amp; Issued By</div>
        </div>

        <div style="text-align: center;">
          <div style="width: 140px; border-top: 1.5px solid #0f172a; margin-bottom: 2px;"></div>
          <div style="font-size: 8px; font-weight: 800; color: #0f172a;">Customer Acceptance</div>
          <div style="font-size: 7px; color: #64748b;">Received &amp; Accepted</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top: 14px; padding: 5px 10px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 7.5px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
        <div><strong>FB:</strong> ENAMELSOFFICIAL &nbsp;|&nbsp; <strong>Insta:</strong> ENAMELS_OFFICIAL</div>
        <div>375A-2 Johar Town, Lahore &nbsp;|&nbsp; 030 11 33 11 33</div>
        <div style="font-weight: 700; color: #0f172a;">www.enamelsonline.com</div>
      </div>
    </div>
  `;
}

// Print trigger via clean iframe
export async function printOutletDocument({ order, docType = 'INVOICE', customFields = {} }) {
  const logoUrl = await getLogoSrc();
  const html = buildOutletDocumentHTML({ order, docType, customFields, logoUrl });
  const title = `${docType.toUpperCase()}-${order.orderNumber || order.invoiceNumber || 'Document'}`;

  const iframe = document.createElement('iframe');
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.position = 'absolute';
  iframe.style.left = '0';
  iframe.style.top = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' + A4_PRINT_CSS + '</style></head><body>');
  doc.write(html);
  doc.write('</body></html>');
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {
        // noop
      }
    }, 1200);
  }, 350);
}
