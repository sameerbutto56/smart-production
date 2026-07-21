import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { toUrduName } from '../utils/urduDictionary';
import { getPrintLogoHTML, getPrintFooterHTML } from './printTemplate';

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

export async function printReceipt(sale, { includeInvoice = true, includeGatePass = true } = {}) {
  try {
    console.log('printReceipt called for', sale?.receiptNumber);
    const isFT = sale.isFaisalTake ?? sale.faisalTake;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.title = 'Receipt Print';
    document.body.appendChild(iframe);
    let logoUrl = window.location.origin + '/logo.png';
    try {
      const logoResp = await fetch(logoUrl);
      const logoBlob = await logoResp.blob();
      logoUrl = URL.createObjectURL(logoBlob);
    } catch {}
    const reviewUrl = reviewUrls[sale.outletName] || 'https://www.google.com/maps/search/Enamels';
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(reviewUrl, { width: 150, margin: 1 }); } catch {}
    const phone = phones[sale.outletName] || '';
    const pf = (n) => (n || 0).toLocaleString();
    const adv = parseFloat(sale.advanceAmount) || 0;
    const isOrderSale = !!sale.orderId;
    const totalQty = (sale.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
    const isPartialPayment = !isFT && adv > 0 && adv < sale.grandTotal;
    const isRefunded = !!sale.refundedAt;
    let gpPaid, gpBalance;
    if (isFT) { gpPaid = 0; gpBalance = 0; }
    else if (isOrderSale) { gpPaid = sale.grandTotal + adv; gpBalance = 0; }
    else if (isPartialPayment) { gpPaid = adv; gpBalance = sale.grandTotal - adv; }
    else { gpPaid = sale.grandTotal; gpBalance = 0; }
    const doc = iframe.contentWindow.document;
    doc.open();
    const receiptStyle = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNaskhArabic-Medium.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNaskhArabic-SemiBold.ttf') format('truetype'); }
      @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNaskhArabic-Bold.ttf') format('truetype'); }
      @page { margin: 0; size: 80mm auto; }
      body { font-family: 'Noto Naskh Arabic', monospace; font-size: 16px; padding: 4mm 6mm; color: #000; line-height: 1.5; background: #fff; margin: 0; }
      .header { text-align: center; margin-bottom: 6px; }
      .header h1 { font-size: 26px; font-weight: 900; margin: 0; }
      .header p { font-size: 14px; margin: 2px 0; font-weight: bold; }
      hr { border: none; border-top: 2px solid #000; margin: 6px 0; }
      .items { margin: 4px 0; }
      .items-heading { display: flex; font-size: 12px; font-weight: 900; text-transform: uppercase; padding: 2px 0 4px; border-bottom: 3px solid #000; margin-bottom: 2px; }
      .items-heading .col-item { flex: 1; text-align: left; }
      .items-heading .col-qty { min-width: 90px; text-align: right; }
      .items-heading .col-total { min-width: 75px; text-align: right; }
      .item { margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid #000; }
      .item-name { font-size: 16px; font-weight: 900; word-break: break-word; }
      .item-variant { font-size: 13px; font-weight: bold; color: #444; margin-top: 1px; }
      .item-line { display: flex; justify-content: flex-end; gap: 12px; font-size: 15px; font-weight: bold; margin-top: 2px; }
      .item-total { font-weight: 900; min-width: 75px; text-align: right; }
      .section-label { font-size: 13px; font-weight: 900; text-align: center; letter-spacing: 2px; margin: 4px 0 2px; padding: 3px 0; border-bottom: 2px solid #000; }
      .summary { width: 100%; font-size: 15px; margin: 4px 0; border-collapse: collapse; }
      .summary tr td { padding: 4px 0; font-weight: bold; }
      .summary .value { text-align: right; }
      .summary .sub td { padding-top: 6px; border-top: 1px solid #000; }
      .summary .final td { font-size: 19px; font-weight: 900; padding-top: 8px; border-top: 3px solid #000; }
      .footer { text-align: center; font-size: 14px; margin-top: 10px; font-weight: bold; }
    </style></head><body>`;
    doc.write(receiptStyle);
    if (includeInvoice) {
      doc.write(`<div class="header"><img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;"><p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p>${isFT ? '<p style="font-size:22px;font-weight:900;color:#c00;margin:6px 0;text-transform:uppercase;letter-spacing:3px;">FAISAL TAKE — NO CHARGE</p>' : ''}<p>${sale.outletName || ''}</p>${phone ? `<p>${phone}</p>` : ''}<p>Invoice: ${sale.receiptNumber}</p><p>${new Date(sale.createdAt).toLocaleString()}</p><p>Cashier: ${sale.cashierName || ''}</p>${sale.customerName ? `<p>Customer: ${sale.customerName}</p>` : ''}${sale.customerPhone ? `<p>Phone: ${sale.customerPhone}</p>` : ''}</div>`);
      doc.write('<hr><div class="items"><div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">TOTAL</span></div>');
      (sale.items || []).forEach(item => {
        const isUrd = isUrduReceipt();
        const name = isUrd ? toUrduName(item.productName || '') : (item.productName || '');
        const variantParts = [isUrd ? toUrduName(item.color) : item.color, item.size].filter(Boolean);
        doc.write('<div class="item">');
        doc.write(`<div class="item-name">${name}</div>`);
        if (variantParts.length > 0) doc.write(`<div class="item-variant">${variantParts.join(' / ')}</div>`);
        doc.write(`<div class="item-line"><span>${item.quantity} × ${pf(isFT ? 0 : item.unitPrice)}</span><span class="item-total">${pf(isFT ? 0 : item.lineTotal)}</span></div>`);
        if (!isFT && item.alterationCharges > 0) {
          doc.write(`<div class="item-line"><span>+ Alteration</span><span class="item-total">${pf(item.alterationCharges)}</span></div>`);
        }
        if (!isFT) {
          const custParts = [];
          if (item.customization1) custParts.push('Custom 1');
          if (item.customization2) custParts.push('Custom 2');
          if (item.nameEngrave) custParts.push('Engrave');
          if (custParts.length > 0) {
            doc.write(`<div style="font-size:11px;font-weight:bold;color:#555;margin-top:2px;">${custParts.join(' + ')} (+${pf(item.customizationCharges || 0)})</div>`);
          }
          if (item.otherCharges > 0) {
            doc.write(`<div style="font-size:11px;font-weight:bold;color:#a06600;margin-top:1px;">Other Charges: +${pf(item.otherCharges)}</div>`);
          }
        }
        doc.write('</div>');
      });
      if (isFT) {
        doc.write('<div style="text-align:center;font-size:24px;font-weight:900;color:#c00;margin:12px 0;text-transform:uppercase;letter-spacing:2px;">NO CHARGE</div>');
      } else {
        doc.write('</div><div class="section-label">SUMMARY</div>');
        doc.write(`<table class="summary"><tr class="sub"><td>Subtotal</td><td class="value">${pf(sale.subtotal)}</td></tr>`);
        if (sale.alterationCharges > 0) doc.write(`<tr><td>Alteration</td><td class="value">${pf(sale.alterationCharges)}</td></tr>`);
        if (sale.deliveryCharges > 0) doc.write(`<tr><td>Delivery Charges</td><td class="value">${pf(sale.deliveryCharges)}</td></tr>`);
        const receiptCustTotal = (sale.items || []).reduce((s, i) => s + (i.customizationCharges || 0), 0);
        if (receiptCustTotal > 0) doc.write(`<tr><td>Customization</td><td class="value">${pf(receiptCustTotal)}</td></tr>`);
        const receiptOtherTotal = (sale.items || []).reduce((s, i) => s + (parseFloat(i.otherCharges) || 0), 0);
        if (receiptOtherTotal > 0) doc.write(`<tr><td>Other Charges</td><td class="value">${pf(receiptOtherTotal)}</td></tr>`);
        if (sale.extraCharges > 0) doc.write(`<tr><td>Extra Charges</td><td class="value">${pf(sale.extraCharges)}</td></tr>`);
        if (sale.discountPercent > 0 || sale.discountAmount > 0) doc.write(`<tr><td>Discount${sale.discountPercent > 0 ? ` (${sale.discountPercent}%)` : ''}</td><td class="value">-${pf(sale.discountAmount)}</td></tr>`);
        if (sale.cardChargesPct > 0) doc.write(`<tr><td>Card Charges (${sale.cardChargesPct}%)</td><td class="value">+${pf(sale.cardChargesAmount)}</td></tr>`);
        const balance = sale.grandTotal - adv;
        if (isRefunded) {
          doc.write(`<tr style="font-size:17px;font-weight:900;"><td>Refunded</td><td class="value">-${pf(sale.grandTotal)}</td></tr>`);
        } else if (isOrderSale) {
          doc.write(`<tr class="final"><td>Total</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
          doc.write(`<tr><td>Paid (This Transaction)</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
          doc.write(`<tr style="font-weight:900;"><td>Advance (Previous)</td><td class="value" style="font-weight:900;">${pf(adv)}</td></tr>`);
          doc.write(`<tr style="font-size:17px;font-weight:900;"><td>Cumulative Paid</td><td class="value">${pf(sale.grandTotal + adv)}</td></tr>`);
          doc.write(`<tr><td style="font-size:11px;font-weight:900;">Status</td><td class="value" style="font-size:11px;font-weight:900;">Fully Paid</td></tr>`);
        } else if (isPartialPayment) {
          doc.write(`<tr class="final"><td>Total Bill</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
          doc.write(`<tr style="font-weight:900;"><td>Paid</td><td class="value" style="font-weight:900;">${pf(adv)}</td></tr>`);
          doc.write(`<tr style="font-size:17px;font-weight:900;"><td>Balance</td><td class="value" style="font-weight:900;">${pf(balance)}</td></tr>`);
          doc.write(`<tr><td style="font-size:11px;font-weight:900;">Status</td><td class="value" style="font-size:11px;font-weight:900;">Partially Paid</td></tr>`);
        } else {
          doc.write(`<tr class="final"><td>Total Bill</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
          doc.write(`<tr style="font-weight:900;"><td>Paid</td><td class="value" style="font-weight:900;">${pf(sale.grandTotal)}</td></tr>`);
          doc.write(`<tr style="font-weight:900;"><td>Balance</td><td class="value" style="font-weight:900;">₨0</td></tr>`);
          doc.write(`<tr><td style="font-size:11px;font-weight:900;">Status</td><td class="value" style="font-size:11px;font-weight:900;">Fully Paid</td></tr>`);
        }
        if (sale.paymentMethod === 'CASH_ONLINE') {
          doc.write(`<tr><td>Cash Amount</td><td class="value">${pf(sale.cashAmount)}</td></tr>`);
          doc.write(`<tr><td>Online Amount</td><td class="value">${pf(sale.onlineAmount)}</td></tr>`);
          doc.write(`<tr><td>Payment</td><td class="value">Cash + Online</td></tr></table>`);
        } else {
          const pmLabel = sale.paymentMethod === 'CASH' ? 'Cash' : sale.paymentMethod === 'CARD' ? 'Card' : sale.paymentMethod === 'ONLINE' ? 'Online' : sale.paymentMethod;
          doc.write(`<tr><td>Payment</td><td class="value">${pmLabel}</td></tr></table>`);
        }
      }
      doc.write('<div style="font-size:11px;font-weight:bold;margin:6px 0 0;border-top:2px solid #000;padding-top:4px;"><p style="font-size:12px;font-weight:900;text-align:center;margin:0 0 3px;">TERMS &amp; CONDITIONS</p><p style="margin:2px 0;text-align:center;">Exchanges are allowed only within 7 days with original tags and invoice.</p></div>');
      doc.write(`<div style="text-align:center;margin:6px 0 0;padding:3px;"><img src="${qrDataUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(reviewUrl)}" width="150" height="150" alt="Review QR" style="display:inline-block;"><p style="font-size:8px;margin:3px 0 0;font-weight:bold;">Scan to Review us and Avail Special Offers</p><p style="font-size:13px;font-weight:900;margin:4px 0 0;">Thank you for shopping! Visit Again!</p></div>`);
      doc.write(getPrintFooterHTML());
      doc.write('<br><br>');
    }
    if (includeGatePass) {
      doc.write('<hr style="border-top:2px dashed #000;"><div style="text-align:center;margin:6px 0 0;padding:4px;background:#ffd700;border:2px solid #000;border-radius:4px;">');
      doc.write('<p style="font-size:18px;font-weight:900;margin:0 0 4px;text-transform:uppercase;">Gate Pass</p>');
      doc.write(`<p style="font-size:11px;font-weight:bold;margin:0 0 4px;">${new Date(sale.createdAt).toLocaleDateString()} | Invoice: ${sale.receiptNumber}</p>`);
      doc.write('<table style="width:100%;font-size:14px;font-weight:bold;border-collapse:collapse;">');
      doc.write(`<tr><td style="text-align:left;padding:2px 4px;">Total Products</td><td style="text-align:right;padding:2px 4px;">${totalQty}</td></tr>`);
      doc.write(`<tr><td style="text-align:left;padding:2px 4px;">Total Amount</td><td style="text-align:right;padding:2px 4px;">${pf(sale.grandTotal)}</td></tr>`);
      doc.write(`<tr><td style="text-align:left;padding:2px 4px;font-weight:900;">Paid Amount</td><td style="text-align:right;padding:2px 4px;font-weight:900;">${pf(gpPaid)}</td></tr>`);
      doc.write(`<tr><td style="text-align:left;padding:2px 4px;font-weight:900;">Balance Amount</td><td style="text-align:right;padding:2px 4px;font-weight:900;">${pf(gpBalance)}</td></tr>`);
      doc.write('</table></div>');
    }
    doc.write('</body></html>');
    doc.close();
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) { toast.error('Print failed: ' + e.message); }
      setTimeout(() => { document.body.removeChild(iframe); if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }, 1000);
    }, 500);
  } catch (e) {
    console.error('printReceipt error:', e);
    toast.error('Print failed: ' + (e.message || 'Unknown error'));
  }
}

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
  lines.push(`Open Date:  ${openedAt.toLocaleDateString()}`);
  lines.push(`Open Time:  ${openedAt.toLocaleTimeString()}`);
  if (opts.closedBy) lines.push(`Closed by:  ${opts.closedBy}`);
  lines.push(`Close Date: ${closedAt.toLocaleDateString()}`);
  lines.push(`Close Time: ${closedAt.toLocaleTimeString()}`);
  lines.push('');
  lines.push('PAYMENT SUMMARY');
  lines.push('─'.repeat(32));
  lines.push(`Cash:         ${formatCurrency(summary.paymentSummary.cash)}`);
  lines.push(`Card:         ${formatCurrency(summary.paymentSummary.card)}`);
  lines.push(`Online:       ${formatCurrency(summary.paymentSummary.online)}`);
  lines.push(`Cash+Online:  Already Added`);
  lines.push(`Grand Total:  ${formatCurrency(summary.paymentSummary.grandTotal)}`);
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

  if (opts.thermal) {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return toast.error('Popup blocked');
    w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:16px;margin:0;">${text}</pre>`);
    w.document.close();
    w.focus();
    w.print();
  }
  if (opts.a4) {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return toast.error('Popup blocked');
    w.document.write(`<html><head><style>
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
        <tr><td>Open Date</td><td><strong>${openedAt.toLocaleDateString()}</strong></td></tr>
        <tr><td>Open Time</td><td><strong>${openedAt.toLocaleTimeString()}</strong></td></tr>
        ${opts.closedBy ? `<tr><td>Closed by</td><td><strong>${opts.closedBy}</strong></td></tr>` : ''}
        <tr><td>Close Date</td><td><strong>${closedAt.toLocaleDateString()}</strong></td></tr>
        <tr><td>Close Time</td><td><strong>${closedAt.toLocaleTimeString()}</strong></td></tr>
      </table></div>
      <h2>Payment Summary</h2>
      <table><tr><th>Method</th><th class="right">Amount</th></tr>
        <tr><td>Cash</td><td class="right">${formatCurrency(summary.paymentSummary.cash)}</td></tr>
        <tr><td>Card</td><td class="right">${formatCurrency(summary.paymentSummary.card)}</td></tr>
        <tr><td>Online</td><td class="right">${formatCurrency(summary.paymentSummary.online)}</td></tr>
        <tr><td>Cash + Online</td><td class="right" style="font-style:italic;color:#888;">Already Added</td></tr>
        <tr class="total"><td>Grand Total</td><td class="right">${formatCurrency(summary.paymentSummary.grandTotal)}</td></tr>
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
    w.document.close();
    w.focus();
    w.print();
  }
}

export function printBalanceReceipt(lastBalancePayment, selectedBalanceInvoice) {
  if (!lastBalancePayment) return;
  const bp = lastBalancePayment;
  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<html><head><title>Balance Receipt</title><style>
    @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 400; font-display: swap; src: url('/fonts/NotoNaskhArabic-Regular.ttf') format('truetype'); }
    @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 500; font-display: swap; src: url('/fonts/NotoNaskhArabic-Medium.ttf') format('truetype'); }
    @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 600; font-display: swap; src: url('/fonts/NotoNaskhArabic-SemiBold.ttf') format('truetype'); }
    @font-face { font-family: 'Noto Naskh Arabic'; font-style: normal; font-weight: 700; font-display: swap; src: url('/fonts/NotoNaskhArabic-Bold.ttf') format('truetype'); }
    body{font-family:'Noto Naskh Arabic','Courier New',monospace;margin:0;padding:16px;font-size:14px;text-align:center;width:300px;background:#fff;color:#000;}
    h2{font-size:18px;font-weight:900;margin:0 0 4px;color:#000;text-transform:uppercase;}
    .sub{font-size:10px;color:#666;margin-bottom:12px;}
    hr{border:1px dashed #ccc;margin:10px 0;}
    table{width:100%;font-size:12px;border-collapse:collapse;}
    td{padding:4px 2px;text-align:left;}
    td:last-child{text-align:right;font-weight:900;}
    .label{color:#666;font-size:10px;}
    .total-row td{border-top:2px solid #000;padding-top:6px;font-size:14px;font-weight:900;}
    .zero{color:#059669;font-weight:900;}
    .footer{font-size:9px;color:#999;margin-top:12px;}
  </style></head><body>
    ${getPrintLogoHTML()}
    <h2>Remaining Balance Payment</h2>
    <p class="sub">Payment Receipt</p>
    <hr/>
    <table>
      <tr><td class="label">Receipt #</td><td>${bp.receiptNumber}</td></tr>
      <tr><td class="label">Original Invoice</td><td>${bp.originalInvoiceNumber}</td></tr>
      <tr><td class="label">Customer</td><td>${selectedBalanceInvoice?.customerName || 'N/A'}</td></tr>
      <tr><td class="label">Date</td><td>${new Date(bp.paidAt || new Date()).toLocaleString()}</td></tr>
      <tr><td class="label">Cashier</td><td>${bp.cashierName || 'Cashier'}</td></tr>
    </table>
    <hr/>
    <table>
      <tr><td>Original Invoice Total</td><td>₨${(bp.originalInvoiceTotal || 0).toLocaleString()}</td></tr>
      <tr><td>Previously Paid</td><td>₨${(bp.previouslyPaidAmount || 0).toLocaleString()}</td></tr>
      <tr><td>Remaining Balance</td><td>₨${(bp.remainingBalanceBeforePayment || 0).toLocaleString()}</td></tr>
      <tr><td>Amount Paid Now</td><td>₨${(bp.amountPaidNow || 0).toLocaleString()}</td></tr>
      <tr class="total-row"><td>Current Outstanding</td><td class="${bp.outstandingBalanceAfterPayment <= 0 ? 'zero' : ''}">₨${(bp.outstandingBalanceAfterPayment || 0).toLocaleString()}</td></tr>
    </table>
    ${bp.outstandingBalanceAfterPayment <= 0 ? '<p style="color:#059669;font-weight:900;font-size:14px;margin-top:10px;">✓ FULLY PAID</p>' : ''}
    <hr/>
    ${getPrintFooterHTML()}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}
