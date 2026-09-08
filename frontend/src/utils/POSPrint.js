import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { toUrduName } from '../utils/urduDictionary';
import { getPrintLogoHTML, getPrintFooterHTML } from './printTemplate';
import { formatDateTime, formatDateOnly, formatTimeOnly } from './dateTime';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const isUrduReceipt = () => { try { return localStorage.getItem('opencode_language') === 'ur'; } catch { return false; } };

export const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;
export const formatPaymentMethod = (m) => m === 'CASH_ONLINE' ? 'Cash+Online' : m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : m === 'ONLINE' ? 'Online' : m || '—';

const reviewUrls = {
  'Johar Town': 'https://www.google.com/maps/search/Enamels+375+A2+Block+A+2+Phase+1+Johar+Town+Lahore',
  'Jail Road': 'https://www.google.com/maps/search/Enamels+Jail+Road+7+sharahe+Shahrah+Aiwan-e-Sanat-o-Tijarat+Lahore',
  'Abbottabad': 'https://www.google.com/maps/search/Enamels+Abbottabad',
};
const phones = { 'Johar Town': '0325-6666063', 'Jail Road': '(042) 36282641', 'Abbottabad': '' };

/**
 * Shared Master 80mm Thermal Receipt CSS
 * Used across Normal POS Sales, Balance Clearance, Returns, and Replacements
 */
export const getThermalMasterCSS = (customStyles = '') => `
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNaskhArabic-Medium.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNaskhArabic-SemiBold.ttf') format('truetype'); }
  @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNaskhArabic-Bold.ttf') format('truetype'); }
  @page { margin: 0; size: 80mm auto; }
  *, *:before, *:after { box-sizing: border-box; }
  body {
    font-family: 'Noto Naskh Arabic', monospace;
    font-size: 16px;
    padding: 4mm 6mm;
    color: #000;
    line-height: 1.45;
    background: #fff;
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header { text-align: center; margin-bottom: 6px; }
  .header h1 { font-size: 26px; font-weight: 900; margin: 0; color: #000; }
  .header p { font-size: 14px; margin: 2px 0; font-weight: bold; color: #000; }
  .banner {
    font-size: 20px;
    font-weight: 900;
    color: #000;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 6px 0;
    padding: 4px 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }
  hr { border: none; border-top: 2px solid #000; margin: 6px 0; }
  .items { margin: 4px 0; }
  .items-heading {
    display: flex;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    padding: 2px 0 4px;
    border-bottom: 3px solid #000;
    margin-bottom: 2px;
    color: #000;
  }
  .items-heading .col-item { flex: 1; text-align: left; }
  .items-heading .col-qty { min-width: 90px; text-align: right; }
  .items-heading .col-total { min-width: 75px; text-align: right; }
  .item { margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid #000; }
  .item-name { font-size: 16px; font-weight: 900; word-break: break-word; color: #000; }
  .item-variant { font-size: 13px; font-weight: bold; color: #222; margin-top: 1px; }
  .item-line {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    font-size: 15px;
    font-weight: bold;
    margin-top: 2px;
    color: #000;
  }
  .item-total { font-weight: 900; min-width: 75px; text-align: right; color: #000; }
  .section-label {
    font-size: 14px;
    font-weight: 900;
    text-align: center;
    letter-spacing: 2px;
    margin: 6px 0 3px;
    padding: 3px 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    text-transform: uppercase;
    color: #000;
  }
  .summary { width: 100%; font-size: 15px; margin: 4px 0; border-collapse: collapse; }
  .summary tr td { padding: 4px 0; font-weight: bold; color: #000; }
  .summary .value { text-align: right; color: #000; }
  .summary .sub td { padding-top: 6px; border-top: 1px solid #000; }
  .summary .final td { font-size: 19px; font-weight: 900; padding-top: 8px; border-top: 3px solid #000; color: #000; }
  .badge {
    display: block;
    text-align: center;
    padding: 6px 8px;
    font-size: 14px;
    font-weight: 900;
    border: 2px solid #000;
    border-radius: 4px;
    margin: 8px 0;
    letter-spacing: 0.5px;
    color: #000;
  }
  .info-table { width: 100%; font-size: 14px; border-collapse: collapse; margin: 4px 0; }
  .info-table td { padding: 3px 0; font-weight: bold; color: #000; }
  .info-table .label { text-align: left; width: 45%; }
  .info-table .val { text-align: right; width: 55%; font-weight: 900; }
  .sig {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 11px;
    font-weight: 900;
    color: #000;
    width: 100%;
  }
  .sig .line { border-top: 2px solid #000; padding-top: 4px; min-width: 120px; text-align: center; }
  .footer { text-align: center; font-size: 13px; margin-top: 10px; font-weight: bold; color: #000; }
  ${customStyles}
`;

/**
 * Fetch and return a blob URL for the Enamels logo
 */
export async function getThermalLogoBlobUrl() {
  let logoUrl = window.location.origin + '/logo.png';
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    return logoUrl;
  }
}

/**
 * Print HTML content via hidden iframe ensuring proper focus and cleanup
 */
export function printThermalDocument(htmlContent, title = 'Thermal Print', onDone) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.title = title;
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      toast.error('Print failed: ' + (e?.message || 'Unknown error'));
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      if (typeof onDone === 'function') onDone();
    }, 1000);
  }, 500);
}

/**
 * Standard POS Sale Receipt (Master Template)
 * Handles Normal Sales, Exchange / Replacement sales, and Refunded Sales
 */
export async function printReceipt(sale, { includeInvoice = true, includeGatePass = true } = {}) {
  try {
    console.log('printReceipt called for', sale?.receiptNumber);
    const isFT = sale.isFaisalTake ?? sale.faisalTake;
    const isRefunded = !!sale.refundedAt;
    const isExchange = (sale.items || []).some(i => i.isExchange) || sale.orderType === 'REPLACEMENT';
    const logoUrl = await getThermalLogoBlobUrl();
    const reviewUrl = reviewUrls[sale.outletName] || 'https://www.google.com/maps/search/Enamels';
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(reviewUrl, { width: 150, margin: 1 }); } catch {}
    const phone = phones[sale.outletName] || '';
    const pf = (n) => (n || 0).toLocaleString();
    const adv = parseFloat(sale.advanceAmount) || 0;
    const isOrderSale = !!sale.orderId;
    const totalQty = (sale.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
    const isPartialPayment = !isFT && adv > 0 && adv < sale.grandTotal;

    let gpPaid, gpBalance;
    if (isFT) { gpPaid = 0; gpBalance = 0; }
    else if (isOrderSale) { gpPaid = sale.grandTotal + adv; gpBalance = 0; }
    else if (isPartialPayment) { gpPaid = adv; gpBalance = sale.grandTotal - adv; }
    else { gpPaid = sale.grandTotal; gpBalance = 0; }

    const exchangeItems = (sale.items || []).filter(i => i.isExchange);
    const newItems = (sale.items || []).filter(i => !i.isExchange);

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      ${getThermalMasterCSS()}
    </style></head><body>`;

    if (includeInvoice) {
      let bannerHTML = '';
      if (isFT) {
        bannerHTML = '<div class="banner">FAISAL TAKE — NO CHARGE</div>';
      } else if (isRefunded) {
        bannerHTML = '<div class="banner">RETURN / REFUND RECEIPT</div>';
      } else if (isExchange) {
        bannerHTML = '<div class="banner">EXCHANGE / REPLACEMENT RECEIPT</div>';
      }

      html += `<div class="header">
        <img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;">
        <p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p>
        ${bannerHTML}
        <p>${sale.outletName || ''}</p>
        ${phone ? `<p>${phone}</p>` : ''}
        <p>Invoice: ${sale.receiptNumber}</p>
        ${sale.orderNumber ? `<p style="font-size:18px;font-weight:900;margin:6px 0;">Your Order #: ${sale.orderNumber}</p>` : ''}
        <p>${formatDateTime(sale.createdAt)}</p>
        <p>Cashier: ${sale.cashierName || ''}</p>
        ${sale.customerName ? `<p>Customer: ${sale.customerName}</p>` : ''}
        ${sale.customerPhone ? `<p>Phone: ${sale.customerPhone}</p>` : ''}
      </div>`;

      html += '<hr><div class="items">';

      if (isExchange) {
        if (newItems.length > 0) {
          html += '<div class="section-label">NEW / REPLACEMENT ITEMS</div>';
          html += '<div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">TOTAL</span></div>';
          newItems.forEach(item => {
            const isUrd = isUrduReceipt();
            const name = item.productName || '';
            const variantParts = [isUrd ? toUrduName(item.color) : item.color, item.size].filter(Boolean);
            html += `<div class="item">
              <div class="item-name">${name}</div>
              ${variantParts.length > 0 ? `<div class="item-variant">${variantParts.join(' / ')}</div>` : ''}
              <div class="item-line"><span>${item.quantity} × ${pf(item.unitPrice)}</span><span class="item-total">${pf(item.lineTotal)}</span></div>
            </div>`;
          });
        }

        if (exchangeItems.length > 0) {
          html += '<div class="section-label" style="margin-top:10px;">RETURNED / EXCHANGED ITEMS</div>';
          html += '<div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">CREDIT</span></div>';
          exchangeItems.forEach(item => {
            const isUrd = isUrduReceipt();
            const name = item.productName || '';
            const variantParts = [isUrd ? toUrduName(item.color) : item.color, item.size].filter(Boolean);
            html += `<div class="item">
              <div class="item-name">${name}</div>
              ${variantParts.length > 0 ? `<div class="item-variant">${variantParts.join(' / ')}</div>` : ''}
              <div class="item-line"><span>${item.quantity} × ${pf(item.unitPrice)}</span><span class="item-total">-${pf(item.lineTotal)}</span></div>
            </div>`;
          });
        }
      } else {
        html += '<div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">TOTAL</span></div>';
        (sale.items || []).forEach(item => {
          const isUrd = isUrduReceipt();
          const name = item.productName || '';
          const variantParts = [isUrd ? toUrduName(item.color) : item.color, item.size].filter(Boolean);
          html += '<div class="item">';
          html += `<div class="item-name">${name}</div>`;
          if (variantParts.length > 0) html += `<div class="item-variant">${variantParts.join(' / ')}</div>`;
          html += `<div class="item-line"><span>${item.quantity} × ${pf(isFT ? 0 : item.unitPrice)}</span><span class="item-total">${pf(isFT ? 0 : item.lineTotal)}</span></div>`;
          if (!isFT && item.alterationCharges > 0) {
            html += `<div class="item-line"><span>+ Alteration</span><span class="item-total">${pf(item.alterationCharges * (item.quantity || 1))}</span></div>`;
          }
          if (!isFT) {
            const custParts = [];
            if (item.customization1) custParts.push('Custom 1');
            if (item.customization2) custParts.push('Custom 2');
            const custAmt = ((item.customization1 ? 500 : 0) + (item.customization2 ? 1000 : 0)) * (item.quantity || 1);
            const engraveAmt = (item.engravingCharges || (item.nameEngrave ? 300 : 0)) * (item.quantity || 1);
            const logoAmt = (item.logoCharges || (item.logoDesign ? 300 : 0)) * (item.quantity || 1);
            if (custParts.length > 0) {
              html += `<div style="font-size:11px;font-weight:bold;color:#000;margin-top:2px;">${custParts.join(' + ')} (+${pf(custAmt)})</div>`;
            }
            if (engraveAmt > 0) {
              html += `<div style="font-size:11px;font-weight:bold;color:#000;margin-top:1px;">Engraving (+${pf(engraveAmt)})</div>`;
            }
            if (logoAmt > 0) {
              html += `<div style="font-size:11px;font-weight:bold;color:#000;margin-top:1px;">Logo Design (+${pf(logoAmt)})</div>`;
            }
            if (item.otherCharges > 0) {
              html += `<div style="font-size:11px;font-weight:bold;color:#000;margin-top:1px;">Other Charges: +${pf(item.otherCharges)}</div>`;
            }
          }
          html += '</div>';
        });
      }

      html += '</div>';

      if (isFT) {
        html += '<div style="text-align:center;font-size:24px;font-weight:900;color:#000;margin:12px 0;text-transform:uppercase;letter-spacing:2px;">NO CHARGE</div>';
      } else {
        html += '<div class="section-label">BILL SUMMARY</div>';
        const receiptExchangeCredit = exchangeItems.reduce((s, i) => s + (i.lineTotal || 0), 0);
        html += `<table class="summary"><tr class="sub"><td>Subtotal</td><td class="value">${pf(sale.subtotal)}</td></tr>`;
        if (receiptExchangeCredit > 0) html += `<tr><td style="color:#000;font-weight:900;">Exchange Credit</td><td class="value" style="color:#000;font-weight:900;">-${pf(receiptExchangeCredit)}</td></tr>`;
        if (sale.alterationCharges > 0) html += `<tr><td>Alteration</td><td class="value">${pf(sale.alterationCharges)}</td></tr>`;
        if (sale.deliveryCharges > 0) html += `<tr><td>Delivery Charges</td><td class="value">${pf(sale.deliveryCharges)}</td></tr>`;
        const receiptCustTotal = (sale.items || []).reduce((s, i) => s + (((i.customization1 ? 500 : 0) + (i.customization2 ? 1000 : 0)) * (i.quantity || 1)), 0);
        if (receiptCustTotal > 0) html += `<tr><td>Customization</td><td class="value">${pf(receiptCustTotal)}</td></tr>`;
        const receiptEngrTotal = (sale.items || []).reduce((s, i) => s + ((i.engravingCharges || (i.nameEngrave ? 300 : 0)) * (i.quantity || 1)), 0);
        if (receiptEngrTotal > 0) html += `<tr><td>Engraving</td><td class="value">${pf(receiptEngrTotal)}</td></tr>`;
        const receiptLogoTotal = (sale.items || []).reduce((s, i) => s + ((i.logoCharges || (i.logoDesign ? 300 : 0)) * (i.quantity || 1)), 0);
        if (receiptLogoTotal > 0) html += `<tr><td>Logo Design</td><td class="value">${pf(receiptLogoTotal)}</td></tr>`;
        const receiptOtherTotal = (sale.items || []).reduce((s, i) => s + (parseFloat(i.otherCharges) || 0), 0);
        if (receiptOtherTotal > 0) html += `<tr><td>Other Charges</td><td class="value">${pf(receiptOtherTotal)}</td></tr>`;
        if (sale.extraCharges > 0) html += `<tr><td>Extra Charges</td><td class="value">${pf(sale.extraCharges)}</td></tr>`;
        if (sale.discountPercent > 0 || sale.discountAmount > 0) html += `<tr><td>Discount${sale.discountPercent > 0 ? ` (${sale.discountPercent}%)` : ''}</td><td class="value">-${pf(sale.discountAmount)}</td></tr>`;
        if (sale.cardChargesPct > 0) html += `<tr><td>Card Charges (${sale.cardChargesPct}%)</td><td class="value">+${pf(sale.cardChargesAmount)}</td></tr>`;
        
        const balance = sale.grandTotal - adv;
        if (isRefunded) {
          html += `<tr class="final"><td>Total Refunded</td><td class="value">-${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr><td>Status</td><td class="value">Refunded</td></tr>`;
        } else if (isOrderSale) {
          html += `<tr class="final"><td>Total</td><td class="value">${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr><td>Paid (This Transaction)</td><td class="value">${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr style="font-weight:900;"><td>Advance (Previous)</td><td class="value" style="font-weight:900;">${pf(adv)}</td></tr>`;
          html += `<tr style="font-size:17px;font-weight:900;"><td>Cumulative Paid</td><td class="value">${pf(sale.grandTotal + adv)}</td></tr>`;
          html += `<tr><td>Status</td><td class="value">Fully Paid</td></tr>`;
        } else if (isPartialPayment) {
          html += `<tr class="final"><td>Total Bill</td><td class="value">${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr style="font-weight:900;"><td>Paid</td><td class="value" style="font-weight:900;">${pf(adv)}</td></tr>`;
          html += `<tr style="font-size:17px;font-weight:900;"><td>Balance</td><td class="value">${pf(balance)}</td></tr>`;
          html += `<tr><td>Status</td><td class="value">Partially Paid</td></tr>`;
        } else {
          html += `<tr class="final"><td>Total Bill</td><td class="value">${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr style="font-weight:900;"><td>Paid</td><td class="value" style="font-weight:900;">${pf(sale.grandTotal)}</td></tr>`;
          html += `<tr style="font-weight:900;"><td>Balance</td><td class="value">₨0</td></tr>`;
          html += `<tr><td>Status</td><td class="value">Fully Paid</td></tr>`;
        }

        if (sale.paymentMethod === 'CASH_ONLINE') {
          html += `<tr><td>Cash Amount</td><td class="value">${pf(sale.cashAmount)}</td></tr>`;
          html += `<tr><td>Online Amount</td><td class="value">${pf(sale.onlineAmount)}</td></tr>`;
          html += `<tr><td>Payment</td><td class="value">Cash + Online</td></tr></table>`;
        } else {
          const pmLabel = sale.paymentMethod === 'CASH' ? 'Cash' : sale.paymentMethod === 'CARD' ? 'Card' : sale.paymentMethod === 'ONLINE' ? 'Online' : sale.paymentMethod;
          html += `<tr><td>Payment</td><td class="value">${pmLabel}</td></tr></table>`;
        }
      }

      html += '<div style="font-size:11px;font-weight:bold;margin:6px 0 0;border-top:2px solid #000;padding-top:4px;"><p style="font-size:12px;font-weight:900;text-align:center;margin:0 0 3px;">TERMS &amp; CONDITIONS</p><p style="margin:2px 0;text-align:center;">Exchanges are allowed only within 7 days with original tags and invoice.</p></div>';
      
      if (sale.additionalNote) {
        html += `<div style="border:1px solid #000;border-radius:4px;padding:4px 6px;margin:6px 0;"><p style="font-size:11px;font-weight:900;margin:0 0 2px;">Note:</p><p style="font-size:12px;font-weight:bold;margin:0;white-space:pre-wrap;">${sale.additionalNote}</p></div>`;
      }

      html += `<div style="text-align:center;margin:6px 0 0;padding:3px;"><img src="${qrDataUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(reviewUrl)}" width="150" height="150" alt="Review QR" style="display:inline-block;"><p style="font-size:8px;margin:3px 0 0;font-weight:bold;">Scan to Review us and Avail Special Offers</p><p style="font-size:13px;font-weight:900;margin:4px 0 0;">Thank you for shopping! Visit Again!</p></div>`;
      html += getPrintFooterHTML();
      html += '<br><br>';
    }

    if (includeGatePass) {
      html += '<hr style="border-top:2px dashed #000;"><div style="text-align:center;margin:6px 0 0;padding:6px;border:3px solid #000;border-radius:4px;">';
      html += `<p style="font-size:20px;font-weight:900;margin:0 0 4px;text-transform:uppercase;">GATE PASS${isExchange ? ' — EXCHANGE' : ''}</p>`;
      html += `<p style="font-size:12px;font-weight:bold;margin:0 0 4px;">${formatDateOnly(sale.createdAt)} | Invoice: ${sale.receiptNumber}</p>`;
      html += '<table style="width:100%;font-size:14px;font-weight:bold;border-collapse:collapse;margin:4px 0;">';
      html += `<tr><td style="text-align:left;padding:2px 4px;">Total Products</td><td style="text-align:right;padding:2px 4px;">${totalQty}</td></tr>`;
      html += `<tr><td style="text-align:left;padding:2px 4px;">Total Amount</td><td style="text-align:right;padding:2px 4px;">${pf(sale.grandTotal)}</td></tr>`;
      html += `<tr><td style="text-align:left;padding:2px 4px;font-weight:900;">Paid Amount</td><td style="text-align:right;padding:2px 4px;font-weight:900;">${pf(gpPaid)}</td></tr>`;
      html += `<tr><td style="text-align:left;padding:2px 4px;font-weight:900;">Balance Amount</td><td style="text-align:right;padding:2px 4px;font-weight:900;">${pf(gpBalance)}</td></tr>`;
      html += '</table>';
      html += '<div class="sig" style="margin-top:10px;"><div style="text-align:left;">Cashier:<br/><span style="font-size:12px;font-weight:900;">' + (sale.cashierName || 'Cashier') + '</span></div><div class="line">Authorised Signature</div></div>';
      html += '</div>';
    }

    html += '</body></html>';

    printThermalDocument(html, 'Receipt Print', () => {
      if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
    });
  } catch (e) {
    console.error('printReceipt error:', e);
    toast.error('Print failed: ' + (e.message || 'Unknown error'));
  }
}

/**
 * Balance Clearance Print
 * Uses the exact same printer configuration and visual design as the standard POS print
 */
export async function printBalanceReceipt(lastBalancePayment, selectedBalanceInvoice) {
  if (!lastBalancePayment) return;
  const bp = lastBalancePayment;
  const sale = selectedBalanceInvoice || bp.posSale || {};
  const logoUrl = await getThermalLogoBlobUrl();
  const phone = phones[sale.outletName] || '';

  const customerName = sale.customerName || 'Walk-in Customer';
  const customerPhone = sale.customerPhone || '';
  const originalInvoiceReceipt = sale.receiptNumber || bp.originalInvoiceNumber || 'N/A';
  const orderNumber = sale.orderNumber || (sale.order ? sale.order.orderNumber : '') || '';
  const originalInvoiceDate = sale.createdAt || '';
  const clearanceDate = bp.paidAt || bp.createdAt || new Date();
  const cashierName = bp.cashierName || sale.cashierName || 'Cashier';

  const origTotal = bp.originalInvoiceTotal ?? sale.grandTotal ?? 0;
  const prevPaid = bp.previouslyPaidAmount ?? 0;
  const prevBalance = bp.remainingBalanceBeforePayment ?? Math.max(0, origTotal - prevPaid);
  const amountCleared = bp.amountPaidNow ?? bp.amount ?? 0;
  const remainingBal = bp.outstandingBalanceAfterPayment ?? Math.max(0, prevBalance - amountCleared);
  const statusPaid = remainingBal <= 0.01;

  const methodLabel = bp.paymentMethod === 'CASH_ONLINE'
    ? `Cash + Online (Cash: ${formatCurrency(bp.cashAmount || 0)}, Online: ${formatCurrency(bp.onlineAmount || 0)})`
    : formatPaymentMethod(bp.paymentMethod || 'CASH');

  const items = Array.isArray(sale.items) ? sale.items : [];

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Balance Clearance Receipt</title><style>
    ${getThermalMasterCSS()}
  </style></head><body>
    <div class="header">
      <img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;">
      <p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p>
      <div class="banner">BALANCE CLEARANCE</div>
      <p>${sale.outletName || 'Enamels'}</p>
      ${phone ? `<p>${phone}</p>` : ''}
    </div>
    <hr/>
    <table class="info-table">
      <tr><td class="label">Clearance Receipt #:</td><td class="val">${bp.receiptNumber || 'N/A'}</td></tr>
      <tr><td class="label">Original Invoice #:</td><td class="val">${originalInvoiceReceipt}</td></tr>
      ${orderNumber ? `<tr><td class="label">Order #:</td><td class="val" style="font-size:16px;">${orderNumber}</td></tr>` : ''}
      <tr><td class="label">Clearance Date:</td><td class="val">${formatDateTime(clearanceDate)}</td></tr>
      ${originalInvoiceDate ? `<tr><td class="label">Invoice Date:</td><td class="val">${formatDateTime(originalInvoiceDate)}</td></tr>` : ''}
      <tr><td class="label">Cashier:</td><td class="val">${cashierName}</td></tr>
      ${customerName ? `<tr><td class="label">Customer:</td><td class="val">${customerName}</td></tr>` : ''}
      ${customerPhone ? `<tr><td class="label">Phone:</td><td class="val">${customerPhone}</td></tr>` : ''}
    </table>
    <div class="section-label">PAYMENT BREAKDOWN</div>
    <table class="summary">
      <tr class="sub"><td>Original Invoice Total</td><td class="value">${formatCurrency(origTotal)}</td></tr>
      <tr><td>Previously Paid / Advance</td><td class="value">${formatCurrency(prevPaid)}</td></tr>
      <tr style="border-top:1px solid #000;font-size:16px;"><td>Previous Balance</td><td class="value">${formatCurrency(prevBalance)}</td></tr>
      <tr style="font-size:18px;font-weight:900;"><td>Amount Cleared</td><td class="value">${formatCurrency(amountCleared)}</td></tr>
      <tr><td>Payment Method</td><td class="value" style="font-size:13px;">${methodLabel}</td></tr>
      ${bp.paymentMethod === 'CASH_ONLINE' ? `
        <tr><td style="padding-left:12px;font-size:13px;">↳ Cash Cleared</td><td class="value" style="font-size:13px;">${formatCurrency(bp.cashAmount || 0)}</td></tr>
        <tr><td style="padding-left:12px;font-size:13px;">↳ Online Cleared</td><td class="value" style="font-size:13px;">${formatCurrency(bp.onlineAmount || 0)}</td></tr>
      ` : ''}
      <tr class="final"><td>Remaining Balance</td><td class="value">${formatCurrency(remainingBal)}</td></tr>
    </table>
    <div class="badge">${statusPaid ? '✓ FULLY PAID — BALANCE CLEARED' : 'PARTIAL PAYMENT — BALANCE REMAINING'}</div>
    ${items.length > 0 ? `
      <div class="section-label">ORIGINAL INVOICE GOODS</div>
      <div class="items">
        <div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY</span><span class="col-total">TOTAL</span></div>
        ${items.map(i => {
          const isUrd = isUrduReceipt();
          const variantParts = [isUrd ? toUrduName(i.color) : i.color, i.size].filter(Boolean);
          return `<div class="item">
            <div class="item-name">${i.productName || ''}</div>
            ${variantParts.length ? `<div class="item-variant">${variantParts.join(' / ')}</div>` : ''}
            <div class="item-line"><span>${i.quantity || 1} pcs</span><span class="item-total">${formatCurrency(i.lineTotal)}</span></div>
          </div>`;
        }).join('')}
      </div>
    ` : ''}
    <div class="sig">
      <div>Cashier:<br/><span style="font-size:13px;font-weight:900;">${cashierName}</span></div>
      <div class="line">Customer Signature</div>
    </div>
    <div style="font-size:11px;font-weight:bold;margin:8px 0 0;border-top:2px solid #000;padding-top:4px;text-align:center;">
      <p style="font-size:12px;font-weight:900;margin:0 0 2px;">TERMS &amp; CONDITIONS</p>
      <p style="margin:0;">Please retain this receipt as authentic proof of balance clearance.</p>
    </div>
    ${getPrintFooterHTML()}
  </body></html>`;

  printThermalDocument(html, 'Balance Clearance Receipt', () => {
    if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
  });
}

/**
 * Balance Clearance Gate Pass
 * Uses master 80mm thermal styles and clear high-contrast borders
 */
export async function printBalanceGatePass(lastBalancePayment, selectedBalanceInvoice) {
  if (!lastBalancePayment) return;
  const bp = lastBalancePayment;
  const sale = selectedBalanceInvoice || bp.posSale || {};
  const logoUrl = await getThermalLogoBlobUrl();
  const phone = phones[sale.outletName] || '';

  const customerName = sale.customerName || 'Walk-in Customer';
  const customerPhone = sale.customerPhone || '';
  const originalInvoiceReceipt = sale.receiptNumber || bp.originalInvoiceNumber || 'N/A';
  const orderNumber = sale.orderNumber || (sale.order ? sale.order.orderNumber : '') || '';
  const clearanceDate = bp.paidAt || bp.createdAt || new Date();
  const cashierName = bp.cashierName || sale.cashierName || 'Cashier';

  const origTotal = bp.originalInvoiceTotal ?? sale.grandTotal ?? 0;
  const prevPaid = bp.previouslyPaidAmount ?? 0;
  const amountCleared = bp.amountPaidNow ?? bp.amount ?? 0;
  const remainingBal = bp.outstandingBalanceAfterPayment ?? Math.max(0, origTotal - prevPaid - amountCleared);
  const statusPaid = remainingBal <= 0.01;

  const methodLabel = bp.paymentMethod === 'CASH_ONLINE'
    ? `Cash + Online (${formatCurrency(bp.cashAmount || 0)} + ${formatCurrency(bp.onlineAmount || 0)})`
    : formatPaymentMethod(bp.paymentMethod || 'CASH');

  const items = Array.isArray(sale.items) ? sale.items : [];
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Balance Gate Pass</title><style>
    ${getThermalMasterCSS()}
  </style></head><body>
    <div class="header">
      <img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;">
      <p style="font-size:12px;font-style:italic;margin-bottom:6px;">Premium Medical Apparels</p>
    </div>
    <div style="border:3px solid #000;border-radius:4px;padding:6px;text-align:center;margin-bottom:8px;">
      <h2 style="font-size:22px;font-weight:900;margin:0;text-transform:uppercase;">GATE PASS</h2>
      <p style="font-size:12px;font-weight:900;margin:2px 0 0;">BALANCE CLEARANCE &mdash; ${statusPaid ? 'GOODS RELEASE AUTHORIZED' : 'PARTIAL PAYMENT RECORD'}</p>
    </div>
    <table class="info-table">
      <tr><td class="label">Original Invoice #:</td><td class="val">${originalInvoiceReceipt}</td></tr>
      <tr><td class="label">Clearance Receipt #:</td><td class="val">${bp.receiptNumber || 'N/A'}</td></tr>
      ${orderNumber ? `<tr><td class="label">Order #:</td><td class="val" style="font-size:16px;">${orderNumber}</td></tr>` : ''}
      <tr><td class="label">Date / Time:</td><td class="val">${formatDateTime(clearanceDate)}</td></tr>
      ${customerName ? `<tr><td class="label">Customer:</td><td class="val">${customerName}</td></tr>` : ''}
      ${customerPhone ? `<tr><td class="label">Phone:</td><td class="val">${customerPhone}</td></tr>` : ''}
    </table>
    <div class="section-label">PAYMENT DETAILS</div>
    <table class="summary">
      <tr class="sub"><td>Total Invoice Amount</td><td class="value">${formatCurrency(origTotal)}</td></tr>
      <tr><td>Previously Paid</td><td class="value">${formatCurrency(prevPaid)}</td></tr>
      <tr style="font-size:17px;font-weight:900;"><td>Paid This Transaction</td><td class="value">${formatCurrency(amountCleared)}</td></tr>
      <tr><td>Payment Method</td><td class="value" style="font-size:13px;">${methodLabel}</td></tr>
      <tr class="final"><td>Remaining Balance</td><td class="value">${formatCurrency(remainingBal)}</td></tr>
    </table>
    <div class="badge">${statusPaid ? '✓ FULLY PAID &mdash; GOODS RELEASED' : 'PARTIAL &mdash; BALANCE REMAINS'}</div>
    ${items.length > 0 ? `
      <div class="section-label">GOODS SUMMARY (${totalQty} ITEM${totalQty === 1 ? '' : 'S'})</div>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:4px 0;">
        ${items.map(i => {
          const isUrd = isUrduReceipt();
          const variantParts = [isUrd ? toUrduName(i.color) : i.color, i.size].filter(Boolean);
          return `<tr style="border-bottom:1px solid #000;">
            <td style="text-align:left;padding:4px 0;">
              <div style="font-weight:900;">${i.productName || ''}</div>
              ${variantParts.length ? `<div style="font-size:12px;color:#222;">${variantParts.join(' / ')}</div>` : ''}
            </td>
            <td style="text-align:right;font-weight:900;padding:4px 0;">x${i.quantity || 1}</td>
          </tr>`;
        }).join('')}
      </table>
    ` : ''}
    <div class="sig">
      <div>Cashier:<br/><span style="font-size:13px;font-weight:900;">${cashierName}</span></div>
      <div class="line">Authorised Signature</div>
    </div>
    ${getPrintFooterHTML()}
  </body></html>`;

  printThermalDocument(html, 'Balance Gate Pass', () => {
    if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
  });
}

/**
 * Return / Refund Receipt
 * Dedicated thermal receipt matching master 80mm POS print settings
 */
export async function printReturnReceipt(sale, returnDetails = {}) {
  if (!sale) return;
  const logoUrl = await getThermalLogoBlobUrl();
  const phone = phones[sale.outletName] || '';
  const pf = (n) => (n || 0).toLocaleString();

  const customerName = sale.customerName || 'Walk-in Customer';
  const customerPhone = sale.customerPhone || '';
  const originalInvoiceReceipt = sale.receiptNumber || returnDetails.originalInvoiceNumber || 'N/A';
  const orderNumber = sale.orderNumber || (sale.order ? sale.order.orderNumber : '') || '';
  const returnDate = returnDetails.returnedAt || sale.refundedAt || new Date();
  const originalDate = sale.createdAt || null;
  const cashierName = returnDetails.cashierName || sale.cashierName || 'Cashier';
  const refundMethod = formatPaymentMethod(returnDetails.refundPaymentMethod || sale.paymentMethod || 'CASH');
  const returnReason = returnDetails.reason || sale.refundReason || 'Customer Return';

  const items = returnDetails.items || sale.items || [];
  const refundAmount = returnDetails.refundAmount ?? sale.grandTotal ?? 0;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Return Receipt</title><style>
    ${getThermalMasterCSS()}
  </style></head><body>
    <div class="header">
      <img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;">
      <p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p>
      <div class="banner">RETURN / REFUND RECEIPT</div>
      <p>${sale.outletName || 'Enamels'}</p>
      ${phone ? `<p>${phone}</p>` : ''}
    </div>
    <hr/>
    <table class="info-table">
      <tr><td class="label">Invoice #:</td><td class="val">${originalInvoiceReceipt}</td></tr>
      ${orderNumber ? `<tr><td class="label">Order #:</td><td class="val" style="font-size:16px;">${orderNumber}</td></tr>` : ''}
      <tr><td class="label">Return Date:</td><td class="val">${formatDateTime(returnDate)}</td></tr>
      ${originalDate ? `<tr><td class="label">Original Date:</td><td class="val">${formatDateTime(originalDate)}</td></tr>` : ''}
      <tr><td class="label">Cashier:</td><td class="val">${cashierName}</td></tr>
      ${customerName ? `<tr><td class="label">Customer:</td><td class="val">${customerName}</td></tr>` : ''}
      ${customerPhone ? `<tr><td class="label">Phone:</td><td class="val">${customerPhone}</td></tr>` : ''}
      <tr><td class="label">Return Reason:</td><td class="val">${returnReason}</td></tr>
      <tr><td class="label">Refund Mode:</td><td class="val">${refundMethod}</td></tr>
    </table>
    <div class="section-label">RETURNED ITEMS</div>
    <div class="items">
      <div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">REFUND</span></div>
      ${items.map(i => {
        const isUrd = isUrduReceipt();
        const variantParts = [isUrd ? toUrduName(i.color) : i.color, i.size].filter(Boolean);
        return `<div class="item">
          <div class="item-name">${i.productName || ''}</div>
          ${variantParts.length ? `<div class="item-variant">${variantParts.join(' / ')}</div>` : ''}
          <div class="item-line"><span>${i.quantity || 1} × ${pf(i.unitPrice || 0)}</span><span class="item-total">-${pf(i.lineTotal || (i.quantity || 1) * (i.unitPrice || 0))}</span></div>
        </div>`;
      }).join('')}
    </div>
    <div class="section-label">REFUND SUMMARY</div>
    <table class="summary">
      <tr class="sub"><td>Total Original Bill</td><td class="value">${formatCurrency(sale.grandTotal)}</td></tr>
      <tr class="final"><td>Total Amount Refunded</td><td class="value">-${formatCurrency(refundAmount)}</td></tr>
      <tr><td>Refund Payment Mode</td><td class="value">${refundMethod}</td></tr>
      <tr><td>Status</td><td class="value">Completed</td></tr>
    </table>
    <div class="badge">✓ RETURN / REFUND PROCESSED</div>
    <div class="sig">
      <div>Cashier:<br/><span style="font-size:13px;font-weight:900;">${cashierName}</span></div>
      <div class="line">Customer Signature</div>
    </div>
    <div style="font-size:11px;font-weight:bold;margin:8px 0 0;border-top:2px solid #000;padding-top:4px;text-align:center;">
      <p style="font-size:12px;font-weight:900;margin:0 0 2px;">RETURN POLICY</p>
      <p style="margin:0;">Returned items restocked into outlet inventory as per policy.</p>
    </div>
    ${getPrintFooterHTML()}
  </body></html>`;

  printThermalDocument(html, 'Return Receipt', () => {
    if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
  });
}

/**
 * Register Close Book Report (unchanged logic, formatted)
 */
export function printCloseBook(summary, opts, currentBook, selectedOutlet, transferCashAmount) {
  const outlet = selectedOutlet;
  const now = new Date();
  const openedAt = currentBook ? new Date(currentBook.openedAt) : now;
  const closedAt = now;
  const lines = [];

  const header = `${outlet.toUpperCase()}\nCLOSE BOOK REPORT\n`;
  lines.push(header);
  lines.push('REGISTER INFORMATION');
  lines.push('─'.repeat(32));
  if (currentBook?.openedBy) lines.push(`Opened by:  ${currentBook.openedBy}`);
  lines.push(`Open Date:  ${formatDateOnly(openedAt)}`);
  lines.push(`Open Time:  ${formatTimeOnly(openedAt)}`);
  if (opts.closedBy) lines.push(`Closed by:  ${opts.closedBy}`);
  lines.push(`Close Date: ${formatDateOnly(closedAt)}`);
  lines.push(`Close Time: ${formatTimeOnly(closedAt)}`);
  lines.push('');
  lines.push('PAYMENT SUMMARY');
  lines.push('─'.repeat(32));
  lines.push(`Cash:         ${formatCurrency(summary.paymentSummary.cash)}`);
  lines.push(`Card:         ${formatCurrency(summary.paymentSummary.card)}`);
  lines.push(`Online:       ${formatCurrency(summary.paymentSummary.online)}`);
  lines.push(`Cash+Online:  Already Added`);
  lines.push(`Grand Total:  ${formatCurrency(summary.paymentSummary.grandTotal)}`);
  lines.push('');
  lines.push('SALES DETAIL (Invoice / Total / Received / Customer)');
  lines.push('─'.repeat(32));
  (summary.sales || []).forEach(s => {
    const amtRec = s.advanceAmount > 0 ? s.advanceAmount : s.grandTotal;
    const bal = Math.max(0, s.grandTotal - amtRec);
    const cust = s.customerName || 'Walk-in';
    lines.push(`${s.receiptNumber || 'N/A'}`);
    lines.push(`  Total: ${formatCurrency(s.grandTotal)}  Recv: ${formatCurrency(amtRec)}  Bal: ${formatCurrency(bal)}`);
    lines.push(`  ${cust}`);
  });
  lines.push('');
  lines.push('EMPLOYEE COLLECTIONS');
  lines.push('─'.repeat(32));
  (summary.employeeCollections || []).forEach(e => {
    lines.push(`${e.name}`);
    lines.push(`  Cash: ${formatCurrency(e.cash)}  Card: ${formatCurrency(e.card)}`);
    lines.push(`  Online: ${formatCurrency(e.online)}  Total: ${formatCurrency(e.total)}`);
  });
  if (summary.totalFaisalTake > 0) {
    lines.push('');
    lines.push(`Faisal Takes: ${formatCurrency(summary.totalFaisalTake)}`);
  }
  const { availableCash: avail } = summary;
  const transferred = parseFloat(transferCashAmount) || 0;
  const remaining = avail - transferred;
  lines.push('');
  lines.push('CASH SUMMARY');
  lines.push('─'.repeat(32));
  lines.push(`Today's Total:   ${formatCurrency(summary.paymentSummary.grandTotal)}`);
  lines.push(`Cash Sales:      ${formatCurrency(summary.paymentSummary.cashCollected)}`);
  lines.push(`Gen Entry:      -${formatCurrency(summary.totalJournalEntries)}`);
  lines.push(`Cash Returns:   -${formatCurrency(summary.returnSummary.cash)}`);
  lines.push(`Available Cash:  ${formatCurrency(avail)}`);
  if (transferred > 0) {
    lines.push(`Transfer to Sys: ${formatCurrency(transferred)}`);
    lines.push(`Remaining:       ${formatCurrency(remaining)}`);
  }
  lines.push('');
  lines.push('─'.repeat(32));
  lines.push('   BOOK CLOSED');
  lines.push('─'.repeat(32));

  const text = lines.join('\n');

  const printIframe = (htmlContent) => {
    printThermalDocument(htmlContent, 'Close Book Print');
  };

  if (opts.thermal) {
    printIframe(`<pre style="font-family:monospace;font-size:12px;padding:16px;margin:0;">${text}</pre>`);
  }
  if (opts.a4) {
    printIframe(`<html><head><style>
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNaskhArabic-Medium.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNaskhArabic-SemiBold.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNaskhArabic-Bold.ttf') format('truetype'); }
      body { font-family: 'Noto Naskh Arabic', Arial, sans-serif; padding: 40px; font-size: 14px; }
      h1 { text-align: center; font-size: 20px; }
      h2 { font-size: 16px; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background: #f5f5f5; font-weight: bold; }
      .total { font-weight: bold; font-size: 15px; }
      .right { text-align: right; }
      .footer { margin-top: 30px; text-align: center; font-size: 16px; font-weight: bold; }
      .section { margin-top: 24px; }
      .section h3 { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
    </style></head><body>
      ${getPrintLogoHTML()}
      <h1>${outlet.toUpperCase()}</h1>
      <p style="text-align:center;font-size:16px;font-weight:bold;">CLOSE BOOK REPORT</p>
      <div class="section"><h3>Register Information</h3><table>
        ${currentBook?.openedBy ? `<tr><td>Opened by</td><td><strong>${currentBook.openedBy}</strong></td></tr>` : ''}
        <tr><td>Open Date</td><td><strong>${formatDateOnly(openedAt)}</strong></td></tr>
        <tr><td>Open Time</td><td><strong>${formatTimeOnly(openedAt)}</strong></td></tr>
        ${opts.closedBy ? `<tr><td>Closed by</td><td><strong>${opts.closedBy}</strong></td></tr>` : ''}
        <tr><td>Close Date</td><td><strong>${formatDateOnly(closedAt)}</strong></td></tr>
        <tr><td>Close Time</td><td><strong>${formatTimeOnly(closedAt)}</strong></td></tr>
      </table></div>
      <h2>Payment Summary</h2>
      <table><tr><th>Method</th><th class="right">Amount</th></tr>
        <tr><td>Cash</td><td class="right">${formatCurrency(summary.paymentSummary.cash)}</td></tr>
        <tr><td>Card</td><td class="right">${formatCurrency(summary.paymentSummary.card)}</td></tr>
        <tr><td>Online</td><td class="right">${formatCurrency(summary.paymentSummary.online)}</td></tr>
        <tr><td>Cash + Online</td><td class="right" style="font-style:italic;color:#888;">Already Added</td></tr>
        <tr class="total"><td>Grand Total</td><td class="right">${formatCurrency(summary.paymentSummary.grandTotal)}</td></tr>
      </table>
      <h2>Sales Detail</h2>
      <table><tr><th>Invoice</th><th class="right">Total</th><th class="right">Received</th><th class="right">Balance</th><th>Customer</th></tr>
        ${(summary.sales || []).map(s => {
          const amtRec = s.advanceAmount > 0 ? s.advanceAmount : s.grandTotal;
          const bal = Math.max(0, s.grandTotal - amtRec);
          return `<tr><td>${s.receiptNumber || 'N/A'}</td><td class="right">${formatCurrency(s.grandTotal)}</td><td class="right">${formatCurrency(amtRec)}</td><td class="right">${formatCurrency(bal)}</td><td>${s.customerName || 'Walk-in'}</td></tr>`;
        }).join('')}
      </table>
      <h2>Employee Collections</h2>
      <table><tr><th>Employee</th><th class="right">Cash</th><th class="right">Card</th><th class="right">Online</th><th class="right">Total</th></tr>
        ${(summary.employeeCollections || []).map(e => `<tr><td>${e.name}</td><td class="right">${formatCurrency(e.cash)}</td><td class="right">${formatCurrency(e.card)}</td><td class="right">${formatCurrency(e.online)}</td><td class="right">${formatCurrency(e.total)}</td></tr>`).join('')}
      </table>
      ${summary.totalFaisalTake > 0 ? `<p><strong>Faisal Takes:</strong> ${formatCurrency(summary.totalFaisalTake)}</p>` : ''}
      <h2>General Entry Deduction</h2>
      <table><tr><td>Journal Entries</td><td class="right">${formatCurrency(summary.totalJournalEntries)}</td></tr>
        ${(summary.journalEntries || []).map(j => `<tr><td style="padding-left:20px;font-size:12px;color:#666;">${j.expenseTitle} — ${j.employeeName}</td><td class="right">${formatCurrency(j.amount)}</td></tr>`).join('')}
      </table>
      <h2>Returns &amp; Refunds</h2>
      <table><tr><td>Cash Returns</td><td class="right">${formatCurrency(summary.returnSummary.cash)}</td></tr>
        <tr><td>Card Returns</td><td class="right">${formatCurrency(summary.returnSummary.card)}</td></tr>
        <tr><td>Online Returns</td><td class="right">${formatCurrency(summary.returnSummary.online)}</td></tr>
        <tr class="total"><td>Total Returns</td><td class="right">${formatCurrency(summary.totalReturns)}</td></tr>
      </table>
      <h2>Cash Summary</h2>
      <table><tr><td>Today's Total Sales</td><td class="right">${formatCurrency(summary.paymentSummary.grandTotal)}</td></tr>
        <tr><td>Cash Sales</td><td class="right">${formatCurrency(summary.paymentSummary.cashCollected)}</td></tr>
        <tr><td>General Entry Deduction</td><td class="right">-${formatCurrency(summary.totalJournalEntries)}</td></tr>
        <tr><td>Cash Returns</td><td class="right">-${formatCurrency(summary.returnSummary.cash)}</td></tr>
        <tr class="total"><td>Available Cash</td><td class="right">${formatCurrency(avail)}</td></tr>
        ${transferred > 0 ? `<tr><td>Transfer to System</td><td class="right">-${formatCurrency(transferred)}</td></tr><tr class="total"><td>Remaining Cash in Locker</td><td class="right">${formatCurrency(remaining)}</td></tr>` : ''}
      </table>
      <div class="footer">BOOK CLOSED</div>
      ${getPrintFooterHTML()}
    </body></html>`);
  }
}
