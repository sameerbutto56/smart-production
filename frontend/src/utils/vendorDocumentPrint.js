// Shared Quotation & Invoice A4 printing utility for ASM and Admin profiles.
// Implements:
// 1. Single Enamels logo with authentic brand styling & purple/gold divider bar.
// 2. Microsoft Word layout from Picture 2: centered title, subheaders, blue callout box, dark navy table.
// 3. Professional financial summary table with integrated "Amount in Words" accent strip.
// 4. Compact 2-row multi-column contact box at the very bottom taking minimal space without strange graphics.

export const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 8mm 12mm 8mm 12mm;
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
`;

export async function fetchLogoUrl() {
  let logoUrl = window.location.origin + '/logo.png';
  try {
    const r = await fetch(logoUrl);
    const b = await r.blob();
    logoUrl = URL.createObjectURL(b);
  } catch (e) {
    /* fallback to origin path */
  }
  return logoUrl;
}

export function printIframe(html, title, cleanups, style) {
  const iframe = document.createElement('iframe');
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.position = 'absolute';
  iframe.style.left = '0';
  iframe.style.top = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' + (style || PRINT_CSS) + '</style></head><body>');
  doc.write(html);
  doc.write('</body></html>');
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch (e) { /* ignore */ }
      (cleanups || []).forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    }, 1000);
  }, 350);
}

// Converts number to uppercase English words for the "Amount in Words" section
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

// Letterhead Header (Single Logo + sleek purple/gold divider bar)
function buildHeaderHTML(logoUrl) {
  return `
  <div class="a4-header" style="margin-bottom: 6px;">
    <div style="display: flex; align-items: flex-end; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${logoUrl}" alt="ENAMELS" style="height: 40px; width: auto; object-fit: contain; display: block;">
      </div>
      <div style="font-size: 7.5px; font-weight: 700; letter-spacing: 1.8px; color: #b8860b; text-transform: uppercase; margin-bottom: 3px;">
        FASHION | PROFESSION | SCRUBS
      </div>
    </div>
    <div style="display: flex; align-items: center; width: 100%; margin-top: 3px;">
      <div style="height: 3px; width: 130px; background: #4d3a86; border-radius: 1px;"></div>
      <div style="height: 1px; flex: 1; background: #c59b27;"></div>
    </div>
  </div>`;
}

// Letterhead Footer (Compact box form with phone, email, website, facebook, instagram)
function buildFooterHTML() {
  return `
  <div class="a4-footer" style="margin-top: 14px; padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 8px; color: #475569;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; flex-wrap: wrap; gap: 6px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#25D366"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
        <span style="font-weight: 700; color: #1e293b;">030 11 33 11 33</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#475569"><path d="M0 3v18h24v-18h-24zm6.623 7.929l-4.623 5.712v-11.425l4.623 5.713zm-3.883-6.929h18.52l-9.26 7.606-9.26-7.606zm8.625 8.718l-1.365 1.118-1.365-1.118-4.635 5.723h18.365l-4.635-5.723zm7.015-1.789l4.62 5.713v-11.425l-4.62 5.712z"/></svg>
        <span style="font-weight: 700;">info@enamelsonline.com</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#475569"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm1 16.015v4.907c3.915-.783 7-4.238 7-8.422 0-.602-.07-1.19-.19-1.758-1.693 1.155-4.243 3.284-6.81 5.273zm-2-10.999v-3.938c-3.951.493-7.142 3.486-7.838 7.371 1.745-.078 4.391-.576 7.838-3.433zm0 15.906v-4.908c-2.569-1.99-5.118-4.119-6.811-5.274-.12.569-.189 1.157-.189 1.76 0 4.184 3.085 7.639 7 8.422zm2-15.907v-3.937c3.447 2.857 6.094 3.355 7.839 3.433-.697-3.886-3.888-6.879-7.839-7.372zm-7.957 6.471c.712 1.096 1.838 2.454 3.238 3.659 1.346 1.157 2.923 2.19 4.719 3.033v-6.692h-7.957zm9.957 0v6.692c1.796-.843 3.373-1.876 4.719-3.033 1.4-1.205 2.526-2.563 3.238-3.659h-7.957z"/></svg>
        <span style="font-weight: 700;">www.enamelsonline.com</span>
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 3px; flex-wrap: wrap; gap: 6px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        <span><strong>FB:</strong> ENAMELSOFFICIAL</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        <span><strong>Insta:</strong> ENAMELS_OFFICIAL</span>
      </div>
      <div style="font-weight: 600; color: #64748b;">
        375A-2 Johar Town, Lahore
      </div>
    </div>
  </div>`;
}

// Builds the full A4 document HTML matching Picture 2 (Body layout) with professional executive styling
export function generateDocumentHTML(order, kind, logoUrl) {
  const isInvoice = kind === 'invoice';
  const totalPaid = (order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(order.grandTotal) || 0) - totalPaid);

  const refNumber = isInvoice
    ? (order.invoiceNumber || order.orderNumber || '—')
    : (order.quotationNumber || order.orderNumber || '—');

  // Format dates
  const dateFormatted = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const deliveryDateFormatted = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  // Vendor / Client Info
  const vendorName = order.vendor?.name || 'VALUED CLIENT';
  const locationParts = [order.vendor?.address, order.deliveryCity, 'Lahore, Pakistan'].filter(Boolean);
  const locationStr = locationParts.join(', ') || 'Lahore, Pakistan';

  // Subject line
  const firstItem = (order.items || [])[0];
  const itemsCount = (order.items || []).length;
  let subjectDetail = firstItem ? `${firstItem.productName}${firstItem.color ? ` (${firstItem.color})` : ''}` : 'Medical Apparel & Scrubs';
  if (itemsCount > 1) subjectDetail += ` & ${itemsCount - 1} other item${itemsCount > 2 ? 's' : ''}`;
  const subjectStr = `Price ${isInvoice ? 'Invoice' : 'Quotation'} For ${subjectDetail}`;

  // Items table rows
  let itemsRows = '';
  (order.items || []).forEach((it, idx) => {
    const specs = [it.articleName, it.articleNumber ? `#${it.articleNumber}` : null, it.color, it.size, it.variant, it.unit, it.productType]
      .filter(Boolean)
      .join(' · ');

    itemsRows += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 5px 6px; text-align: center; border: 1px solid #cbd5e1; font-weight: 600; color: #64748b; font-size: 9px;">
          ${String(idx + 1).padStart(2, '0')}
        </td>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">
          <div style="font-weight: 700; color: #0f172a; font-size: 9.5px;">${it.productName || 'Product'}</div>
          ${specs ? `<div style="font-size: 8px; color: #64748b; margin-top: 1px;">${specs}</div>` : ''}
          ${it.notes ? `<div style="font-size: 7.5px; color: #94a3b8; font-style: italic;">Note: ${it.notes}</div>` : ''}
        </td>
        <td style="padding: 5px 6px; text-align: center; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 9.5px;">
          ${it.quantity || 1}
        </td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; color: #334155; font-size: 9.5px;">
          Rs. ${parseFloat(it.unitPrice || 0).toLocaleString()}
        </td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 9.5px;">
          Rs. ${parseFloat(it.lineTotal || 0).toLocaleString()}
        </td>
      </tr>
    `;
  });

  return `
  <div class="a4-container">
    <!-- TOP LETTERHEAD (Picture 1) -->
    ${buildHeaderHTML(logoUrl)}

    <!-- DOCUMENT TITLE -->
    <div style="text-align: center; margin: 4px 0 6px 0;">
      <span style="font-size: 15px; font-weight: 900; letter-spacing: 2px; color: #0f172a; text-transform: uppercase; border-bottom: 2px solid #0f172a; padding-bottom: 1px;">
        ${isInvoice ? 'INVOICE' : 'QUOTATION'}
      </span>
    </div>

    <!-- SUBHEADER: Company Info (Left) & Document Details (Right) -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-size: 8.5px; line-height: 1.35; color: #334155;">
      <div>
        <div style="font-weight: 800; color: #0f172a; font-size: 9px;">Premium Medical Apparel &amp; Accessories</div>
        <div>Contact: +92 3298888060</div>
        <div>Lahore, Pakistan</div>
        <div>375A-2 JOHAR TOWN LAHORE</div>
        <div>info@enamelsonline.com</div>
      </div>
      <div style="text-align: right;">
        <div><span style="color: #64748b; font-weight: 600;">${isInvoice ? 'Invoice Ref #:' : 'Quote Ref #:'}</span> <strong style="color: #0f172a; font-size: 9px;">${refNumber}</strong></div>
        <div><span style="color: #64748b; font-weight: 600;">Date:</span> <strong style="color: #0f172a;">${dateFormatted}</strong></div>
        ${deliveryDateFormatted ? `<div><span style="color: #64748b; font-weight: 600;">Delivery:</span> ${deliveryDateFormatted}</div>` : ''}
        ${order.deliveryCity ? `<div><span style="color: #64748b; font-weight: 600;">City:</span> ${order.deliveryCity}</div>` : ''}
        ${order.asm?.name ? `<div><span style="color: #64748b; font-weight: 600;">ASM:</span> ${order.asm.name}</div>` : ''}
      </div>
    </div>

    <!-- BLUE CALLOUT BOX (Picture 2) -->
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; font-size: 8.5px; line-height: 1.35;">
      <div style="font-weight: 900; font-size: 9px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px;">
        ${isInvoice ? 'INVOICE PREPARED FOR' : 'QUOTATION PREPARED FOR'}
      </div>
      <div style="font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase; margin-top: 2px;">
        ${vendorName}
      </div>
      <div style="color: #334155; margin-top: 2px;">
        <strong>Location:</strong> ${locationStr}
      </div>
      <div style="color: #334155; margin-top: 1px;">
        <strong>Subject :</strong> ${subjectStr}
      </div>
    </div>

    <!-- ITEMS TABLE (Dark Navy Header) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <thead>
        <tr style="background: #1e293b; color: #ffffff;">
          <th style="padding: 4px 6px; text-align: center; width: 36px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Sr. #</th>
          <th style="padding: 4px 8px; text-align: left; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Item Description</th>
          <th style="padding: 4px 6px; text-align: center; width: 45px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Qty</th>
          <th style="padding: 4px 8px; text-align: right; width: 85px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Unit Price</th>
          <th style="padding: 4px 8px; text-align: right; width: 100px; font-size: 8.5px; font-weight: 700; border: 1px solid #1e293b;">Total (PKR)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- FINANCIAL TOTALS BOX (Right Aligned, Picture 2 Style) -->
    <div style="display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 6px;">
      <table style="border-collapse: collapse; font-size: 8.5px; width: 260px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;">
        <tr>
          <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Net Total / (PKR):</td>
          <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #dbeafe;">Rs. ${parseFloat(order.totalOrderValue || 0).toLocaleString()}</td>
        </tr>
        ${parseFloat(order.deliveryCharges || 0) > 0 ? `
        <tr>
          <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Delivery Charges / (PKR):</td>
          <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #dbeafe;">Rs. ${parseFloat(order.deliveryCharges).toLocaleString()}</td>
        </tr>` : ''}
        ${parseFloat(order.discount || 0) > 0 ? `
        <tr>
          <td style="padding: 3px 8px; font-weight: 700; color: #16a34a; border-bottom: 1px solid #dbeafe;">Discount / (PKR):</td>
          <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #16a34a; border-bottom: 1px solid #dbeafe;">-Rs. ${parseFloat(order.discount).toLocaleString()}</td>
        </tr>` : ''}
        <tr style="background: #dbeafe;">
          <td style="padding: 4px 8px; font-weight: 900; color: #1e3a8a; border-bottom: 1px solid #bfdbfe;">Grand Total / (PKR):</td>
          <td style="padding: 4px 8px; text-align: right; font-weight: 900; font-size: 10px; color: #1e3a8a; border-bottom: 1px solid #bfdbfe;">Rs. ${parseFloat(order.grandTotal || 0).toLocaleString()}</td>
        </tr>
        ${totalPaid > 0 ? `
        <tr>
          <td style="padding: 3px 8px; font-weight: 700; color: #334155; border-bottom: 1px solid #dbeafe;">Paid Amount / (PKR):</td>
          <td style="padding: 3px 8px; text-align: right; font-weight: 700; color: #0f172a; border-bottom: 1px solid #dbeafe;">Rs. ${totalPaid.toLocaleString()}</td>
        </tr>` : ''}
        ${isInvoice || remaining > 0 ? `
        <tr>
          <td style="padding: 3px 8px; font-weight: 900; color: ${remaining > 0.01 ? '#b91c1c' : '#15803d'};">Remaining Balance / (PKR):</td>
          <td style="padding: 3px 8px; text-align: right; font-weight: 900; color: ${remaining > 0.01 ? '#b91c1c' : '#15803d'};">Rs. ${remaining.toLocaleString()}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- AMOUNT IN WORDS (Directly under totals, executive left-accent strip) -->
    <div style="margin: 6px 0 10px 0; padding: 4px 10px; background: #f1f5f9; border-left: 3px solid #1e3a8a; border-radius: 2px; font-size: 8.5px;">
      <strong style="color: #1e3a8a; text-transform: uppercase;">Amount in Words :</strong>
      <span style="font-weight: 700; font-style: italic; color: #0f172a; text-transform: uppercase; margin-left: 4px;">
        ${numberToWords(order.grandTotal || 0)} ONLY.
      </span>
    </div>

    <!-- Notes if any -->
    ${order.notes ? `
    <div style="margin: 4px 0 8px 0; padding: 3px 8px; font-size: 8px; color: #475569; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 3px;">
      <strong>Notes:</strong> ${order.notes}
    </div>` : ''}

    <!-- DUAL SIGNATURES (Picture 2) -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; margin-bottom: 10px; padding: 0 20px;">
      <div style="text-align: center;">
        <div style="width: 150px; border-top: 1.5px solid #0f172a; margin-bottom: 3px;"></div>
        <div style="font-size: 8.5px; font-weight: 800; color: #0f172a;">Issued &amp; Authorized By</div>
      </div>
      <div style="text-align: center;">
        <div style="width: 150px; border-top: 1.5px solid #0f172a; margin-bottom: 3px;"></div>
        <div style="font-size: 8.5px; font-weight: 800; color: #0f172a;">Accepted &amp; Confirmed By</div>
      </div>
    </div>

    <!-- BOTTOM CONTACT FOOTER (Clean 2-row multi-column box) -->
    ${buildFooterHTML()}
  </div>
  `;
}

// A4 professional Quotation / Invoice document printer
export async function printOrderDocument(order, kind) {
  const isInvoice = kind === 'invoice';
  const logoUrl = await fetchLogoUrl();
  const title = `${isInvoice ? 'INVOICE' : 'QUOTATION'} — ${order.orderNumber || ''}`;
  const html = generateDocumentHTML(order, kind, logoUrl);
  printIframe(html, title, [() => { if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }]);
}

// Thermal (58mm) receipt — compact vendor order summary (POS / counter)
export async function printThermalReceipt(order) {
  const logoUrl = await fetchLogoUrl();
  const totalPaid = (order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, (Number(order.grandTotal) || 0) - totalPaid);

  let html = `<div style="text-align:center"><img src="${logoUrl}" alt="ENAMELS" style="height:30px"><p style="font-weight:900;font-size:12px;margin:2px 0 0">VENDOR RECEIPT</p><p style="margin:1px 0">${order.orderNumber || ''}</p><p style="margin:1px 0">${order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}</p></div>`;
  for (const it of (order.items || [])) {
    html += `<div style="margin-top:4px"><div style="font-weight:700">${it.productName}</div><div style="display:flex;justify-content:space-between"><span>${[it.color, it.size].filter(Boolean).join('/') || '—'} x ${it.quantity}</span><span>₨${parseFloat(it.lineTotal || 0).toLocaleString()}</span></div></div>`;
  }
  html += `<div style="border-top:1px dashed #000;margin-top:6px;padding-top:4px">`;
  html += `<div style="display:flex;justify-content:space-between"><span>GRAND TOTAL</span><span style="font-weight:900">₨${parseFloat(order.grandTotal || 0).toLocaleString()}</span></div>`;
  html += `<div style="display:flex;justify-content:space-between"><span>PAID</span><span>₨${totalPaid.toLocaleString()}</span></div>`;
  html += `<div style="display:flex;justify-content:space-between"><span>REMAINING</span><span>₨${remaining.toLocaleString()}</span></div>`;
  html += `</div>`;
  html += `<div style="text-align:center;margin-top:10px">——————————</div><div style="text-align:center;font-size:9px">Thank you</div>`;
  const title = `Receipt — ${order.orderNumber || ''}`;
  const thermalCss = `@page{margin:2mm;width:58mm}body{font-family:monospace;color:#000;width:58mm;font-size:10px;padding:2px;word-break:break-word}`;
  printIframe(html, title, [() => { if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }], thermalCss);
}
