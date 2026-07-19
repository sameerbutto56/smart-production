import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { Search, Clock, Printer, RefreshCw, DollarSign, AlertTriangle, Download, ChevronDown, ChevronUp, X, CreditCard, RotateCcw } from 'lucide-react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const datePresets = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
  { label: 'This Year', value: 'year' },
  { label: 'Custom Range', value: 'custom' }
];

const OutletInvoiceHistory = ({ outlet }) => {
  const { isUrdu } = useLanguage();
  const [range, setRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cashier, setCashier] = useState('');
  const [employees, setEmployees] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [refunding, setRefunding] = useState(null);

  useEffect(() => {
    api.get(`/api/pos/employees?outlet=${outlet}`).then(r => setEmployees(r.data)).catch(() => {});
  }, [outlet]);

  /* ─── Balance Payment Modals ─── */
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [paying, setPaying] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPayHistory, setShowPayHistory] = useState(false);
  const [payHistory, setPayHistory] = useState([]);
  const [payHistoryLoading, setPayHistoryLoading] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/pos/sales?outlet=${outlet}&range=${range}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      if (statusFilter !== 'all') url += `&statusFilter=${statusFilter}`;
      if (cashier) url += `&cashier=${encodeURIComponent(cashier)}`;
      const res = await api.get(url);
      setSales(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [outlet, range, dateFrom, dateTo, statusFilter, cashier]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  /* ─── Print Receipt ─── */
  const printReceipt = async (sale) => {
    setPrinting(sale.id);
    try {
    const isFT = sale.faisalTake;
    let logoUrl = window.location.origin + '/logo.png';
    try {
      const logoResp = await fetch(logoUrl);
      const logoBlob = await logoResp.blob();
      logoUrl = URL.createObjectURL(logoBlob);
    } catch {}
    const reviewUrls = {
      'Johar Town': 'https://www.google.com/maps/search/Enamels+375+A2+Block+A+2+Phase+1+Johar+Town+Lahore',
      'Jail Road': 'https://www.google.com/maps/search/Enamels+Jail+Road+7+sharahe+Shahrah+Aiwan-e-Sanat-o-Tijarat+Lahore',
      'Abbottabad': 'https://www.google.com/maps/search/Enamels+Abbottabad',
    };
    const reviewUrl = reviewUrls[sale.outletName] || 'https://www.google.com/maps/search/Enamels';
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(reviewUrl, { width: 150, margin: 1 }); } catch {}
    const phones = { 'Johar Town': '0325-6666063', 'Jail Road': '(042) 36282641', 'Abbottabad': '' };
    const phone = phones[sale.outletName] || '';
    const pf = (n) => (n || 0).toLocaleString();
    const adv = parseFloat(sale.advanceAmount) || 0;
    const isOrderSale = !!sale.orderId;
    let gpPaid, gpBalance;
    if (isFT) { gpPaid = 0; gpBalance = 0; }
    else if (isOrderSale) { gpPaid = sale.grandTotal + adv; gpBalance = 0; }
    else if (adv > 0) { gpPaid = adv; gpBalance = sale.grandTotal - adv; }
    else { gpPaid = sale.grandTotal; gpBalance = 0; }
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    iframe.title = 'Receipt Print';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    const style = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/NotoNaskhArabic-Regular.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/NotoNaskhArabic-Medium.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/NotoNaskhArabic-SemiBold.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/NotoNaskhArabic-Bold.ttf')format('truetype');}
      @page{margin:0;size:80mm auto;}
      body{font-family:'Noto Naskh Arabic',monospace;font-size:16px;padding:4mm 6mm;color:#000;line-height:1.5;background:#fff;margin:0;}
      .header{text-align:center;margin-bottom:6px;}
      .header h1{font-size:26px;font-weight:900;margin:0;}
      .header p{font-size:14px;margin:2px 0;font-weight:bold;}
      hr{border:none;border-top:2px solid #000;margin:6px 0;}
      .items{margin:4px 0;}
      .items-heading{display:flex;font-size:12px;font-weight:900;text-transform:uppercase;padding:2px 0 4px;border-bottom:3px solid #000;margin-bottom:2px;}
      .items-heading .col-item{flex:1;text-align:left;}
      .items-heading .col-qty{min-width:90px;text-align:right;}
      .items-heading .col-total{min-width:75px;text-align:right;}
      .item{margin-bottom:8px;padding:4px 0;border-bottom:1px solid #000;}
      .item-name{font-size:16px;font-weight:900;word-break:break-word;}
      .item-variant{font-size:13px;font-weight:bold;color:#444;margin-top:1px;}
      .item-line{display:flex;justify-content:flex-end;gap:12px;font-size:15px;font-weight:bold;margin-top:2px;}
      .item-total{font-weight:900;min-width:75px;text-align:right;}
      .section-label{font-size:13px;font-weight:900;text-align:center;letter-spacing:2px;margin:4px 0 2px;padding:3px 0;border-bottom:2px solid #000;}
      .summary{width:100%;font-size:15px;margin:4px 0;border-collapse:collapse;}
      .summary tr td{padding:4px 0;font-weight:bold;}
      .summary .value{text-align:right;}
      .summary .sub td{padding-top:6px;border-top:1px solid #000;}
      .summary .final td{font-size:19px;font-weight:900;padding-top:8px;border-top:3px solid #000;}
      .footer{text-align:center;font-size:14px;margin-top:10px;font-weight:bold;}
    </style></head><body>`;
    doc.write(style);
    doc.write(`<div class="header"><img src="${logoUrl}" alt="ENAMELS" style="height:80px;margin-bottom:4px;"><p style="font-size:12px;font-style:italic;margin-bottom:8px;">Premium Medical Apparels</p>${isFT ? '<p style="font-size:22px;font-weight:900;color:#c00;margin:6px 0;text-transform:uppercase;letter-spacing:3px;">FAISAL TAKE — NO CHARGE</p>' : ''}<p>${sale.outletName || ''}</p>${phone ? `<p>${phone}</p>` : ''}<p>Invoice: ${sale.receiptNumber}</p><p>${new Date(sale.createdAt).toLocaleString()}</p><p>Cashier: ${sale.cashierName || ''}</p>${sale.customerName ? `<p>Customer: ${sale.customerName}</p>` : ''}${sale.customerPhone ? `<p>Phone: ${sale.customerPhone}</p>` : ''}</div>`);
    doc.write('<hr><div class="items"><div class="items-heading"><span class="col-item">ITEM</span><span class="col-qty">QTY × PRICE</span><span class="col-total">TOTAL</span></div>');
    (sale.items || []).forEach(item => {
      const name = isUrdu ? toUrduName(item.productName || '') : (item.productName || '');
      const variantParts = [isUrdu ? toUrduName(item.color) : item.color, item.size].filter(Boolean);
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
      const rcust = (sale.items || []).reduce((s, i) => s + (i.customizationCharges || 0), 0);
      if (rcust > 0) doc.write(`<tr><td>Customization</td><td class="value">${pf(rcust)}</td></tr>`);
      const rother = (sale.items || []).reduce((s, i) => s + (parseFloat(i.otherCharges) || 0), 0);
      if (rother > 0) doc.write(`<tr><td>Other Charges</td><td class="value">${pf(rother)}</td></tr>`);
      if (sale.extraCharges > 0) doc.write(`<tr><td>Extra Charges</td><td class="value">${pf(sale.extraCharges)}</td></tr>`);
      if (sale.discountPercent > 0 || sale.discountAmount > 0) doc.write(`<tr><td>Discount${sale.discountPercent > 0 ? ` (${sale.discountPercent}%)` : ''}</td><td class="value">-${pf(sale.discountAmount)}</td></tr>`);
      if (sale.cardChargesPct > 0) doc.write(`<tr><td>Card Charges (${sale.cardChargesPct}%)</td><td class="value">+${pf(sale.cardChargesAmount)}</td></tr>`);
      if (isOrderSale && adv > 0) {
        doc.write(`<tr class="final"><td>Current Payment</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
        doc.write(`<tr><td>Advance (Order)</td><td class="value">${pf(adv)}</td></tr>`);
        doc.write(`<tr style="font-size:17px;font-weight:900;"><td>Total Paid</td><td class="value">${pf(sale.grandTotal + adv)}</td></tr>`);
      } else {
        const balance = sale.grandTotal - adv;
        doc.write(`<tr class="final"><td>Final Amount</td><td class="value">${pf(sale.grandTotal)}</td></tr>`);
        if (adv > 0) doc.write(`<tr><td>Advance</td><td class="value">-${pf(adv)}</td></tr>`);
        if (adv > 0) doc.write(`<tr style="font-size:17px;font-weight:900;"><td>Balance</td><td class="value">${pf(balance)}</td></tr>`);
      }
      if (sale.paymentMethod === 'CASH_ONLINE') {
        doc.write(`<tr><td>Cash Amount</td><td class="value">${pf(sale.cashAmount)}</td></tr>`);
        doc.write(`<tr><td>Online Amount</td><td class="value">${pf(sale.onlineAmount)}</td></tr>`);
      }
      doc.write(`<tr><td>Payment</td><td class="value">${sale.paymentMethod === 'CASH_ONLINE' ? 'Cash+Online' : sale.paymentMethod}</td></tr></table>`);
    }
    doc.write('<div style="font-size:11px;font-weight:bold;margin:6px 0 0;border-top:2px solid #000;padding-top:4px;"><p style="font-size:12px;font-weight:900;text-align:center;margin:0 0 3px;">TERMS &amp; CONDITIONS</p><p style="margin:2px 0;text-align:center;">Exchanges are allowed only within 7 days with original tags and invoice.</p></div>');
    doc.write(`<div style="text-align:center;margin:6px 0 0;padding:3px;"><img src="${qrDataUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(reviewUrl)}" width="150" height="150" alt="Review QR" style="display:inline-block;"><p style="font-size:8px;margin:3px 0 0;font-weight:bold;">Scan to Review us and Avail Special Offers</p><p style="font-size:13px;font-weight:900;margin:4px 0 0;">Thank you for shopping! Visit Again!</p></div>`);
    doc.write('<hr><p style="text-align:center;font-size:9px;margin-top:4px;">Software is develop by Sameer Butt</p>');
    doc.write('</body></html>');
    doc.close();
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) { toast.error('Print failed: ' + e.message); }
      setTimeout(() => { document.body.removeChild(iframe); if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); setPrinting(null); }, 1000);
    }, 500);
    } catch (e) { toast.error('Print failed: ' + e.message); setPrinting(null); }
  };

  /* ─── Refund Invoice ─── */
  const handleReturnInvoice = async (sale) => {
    if (sale.refundedAt) return toast.error('Invoice already refunded');
    if (sale.faisalTake) return toast.error('Cannot refund Faisal Take');
    if (!window.confirm(`Refund full invoice ${sale.receiptNumber} for ${formatCurrency(sale.grandTotal)}? All items will be returned to inventory. This cannot be undone.`)) return;
    setRefunding(sale.id);
    try {
      await api.post(`/api/pos/sales/${sale.id}/refund`);
      toast.success('Invoice fully refunded');
      fetchSales();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed');
    }
    setRefunding(null);
  };

  /* ─── Pay Balance ─── */
  const handlePayOpen = async (sale) => {
    try {
      const res = await api.get(`/api/pos/balance-invoices/${sale.id}`);
      setSelectedInvoice(res.data);
      setPayAmount(Math.ceil(res.data.remaining));
      setShowPayModal(true);
    } catch (e) {
      toast.error('Failed to load invoice');
    }
  };

  const handlePayBalance = async () => {
    if (!selectedInvoice || payAmount <= 0) return toast.error('Enter a valid amount');
    if (payAmount > selectedInvoice.remaining) return toast.error(`Amount exceeds remaining balance of ₨${selectedInvoice.remaining.toLocaleString()}`);
    setPaying(true);
    try {
      const res = await api.post(`/api/pos/balance-invoices/${selectedInvoice.id}/pay`, {
        amountPaidNow: payAmount,
        paymentMethod: 'CASH'
      });
      setLastPayment(res.data);
      setShowPayModal(false);
      toast.success('Balance payment recorded — invoice status will update automatically');
      fetchSales();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const printBalanceReceipt = () => {
    if (!lastPayment) return;
    const bp = lastPayment;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '-9999px';
    iframe.style.bottom = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    iframe.title = 'Balance Receipt';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.write(`<html><head><title>Balance Receipt</title><style>
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/NotoNaskhArabic-Regular.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/NotoNaskhArabic-Medium.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/NotoNaskhArabic-SemiBold.ttf')format('truetype');}
      @font-face{font-family:'Noto Naskh Arabic';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/NotoNaskhArabic-Bold.ttf')format('truetype');}
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
    </style></head><body>`);
    doc.write('<h2>BALANCE PAYMENT</h2>');
    doc.write(`<p class="sub">Receipt &mdash; ${new Date().toLocaleString()}</p><hr>`);
    doc.write('<table>');
    doc.write(`<tr><td class="label">Original Invoice</td><td>${bp.posSale?.receiptNumber || bp.receiptNumber || ''}</td></tr>`);
    doc.write(`<tr><td class="label">Customer</td><td>${bp.posSale?.customerName || bp.customerName || ''}</td></tr>`);
    doc.write(`<tr><td class="label">Original Total</td><td>${formatCurrency(bp.posSale?.grandTotal || bp.grandTotal || 0)}</td></tr>`);
    doc.write(`<tr><td class="label">Total Paid</td><td>${formatCurrency(bp.totalPaid || (bp.posSale?.grandTotal || 0))}</td></tr>`);
    doc.write(`<tr class="total-row"><td>Amount Paid Now</td><td>${formatCurrency(bp.amountPaidNow || bp.amount || 0)}</td></tr>`);
    doc.write(`<tr><td class="label">Remaining</td><td class="${(bp.remaining || 0) <= 0 ? 'zero' : ''}">${(bp.remaining || 0) <= 0 ? 'FULLY PAID' : formatCurrency(bp.remaining)}</td></tr>`);
    doc.write(`<tr><td class="label">Payment Method</td><td>${bp.paymentMethod || 'CASH'}</td></tr>`);
    doc.write('</table><hr>');
    doc.write('<p style="font-size:10px;color:#999;">Thank you!</p>');
    doc.write('</body></html>');
    doc.close();
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) { toast.error('Print failed: ' + e.message); }
      setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 1000);
    }, 300);
  };

  /* ─── Payment History ─── */
  const openPayHistory = async (sale) => {
    setShowPayHistory(true);
    setPayHistoryLoading(true);
    try {
      const res = await api.get(`/api/pos/balance-invoices/${sale.id}/history`);
      setPayHistory(res.data);
    } catch (e) {
      toast.error('Failed to load payment history');
    } finally {
      setPayHistoryLoading(false);
    }
  };

  /* ─── Download Excel ─── */
  const downloadExcel = () => {
    const data = filteredSales.map(s => ({
      'Receipt #': s.receiptNumber || '',
      'Date': new Date(s.createdAt).toLocaleString(),
      'Cashier': s.cashierName || '',
      'Customer': s.customerName || '',
      'Phone': s.customerPhone || '',
      'Items': (s.items || []).map(i => `${isUrdu ? toUrduName(i.productName) : i.productName}${i.color ? ' ('+(isUrdu ? toUrduName(i.color) : i.color)+')' : ''}${i.size ? ' '+i.size : ''} x${i.quantity}`).join(', '),
      'Subtotal': s.subtotal || 0,
      'Discount': s.discountAmount || 0,
      'Card Charges': s.cardChargesAmount || 0,
      'Grand Total': s.grandTotal || 0,
      'Payment': s.paymentMethod || '',
      'Advance': s.advanceAmount || 0,
      'Balance': s._balanceRemaining || 0,
      'Status': s._balanceStatus || 'paid'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `sales_${outlet}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel downloaded');
  };

  /* ─── Derived ─── */
  const filteredSales = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.receiptNumber || '').toLowerCase().includes(q)
        || (s.customerName || '').toLowerCase().includes(q)
        || (s.cashierName || '').toLowerCase().includes(q);
  });

  /* ─── Payment Summary ─── */
  const paymentSummary = filteredSales.reduce((acc, s) => {
    const method = s.paymentMethod || 'CASH';
    if (method === 'CASH_ONLINE') {
      acc.CASH = (acc.CASH || 0) + (parseFloat(s.cashAmount) || 0);
      acc.ONLINE = (acc.ONLINE || 0) + (parseFloat(s.onlineAmount) || 0);
      acc.CASH_ONLINE = (acc.CASH_ONLINE || 0) + s.grandTotal;
    } else if (['CASH', 'ONLINE', 'CARD'].includes(method)) {
      acc[method] = (acc[method] || 0) + s.grandTotal;
    } else {
      acc.CASH = (acc.CASH || 0) + s.grandTotal;
    }
    return acc;
  }, {});

  const paymentMethods = [
    { key: 'CASH', label: 'Cash', color: 'from-emerald-600 to-green-600' },
    { key: 'ONLINE', label: 'Online', color: 'from-blue-600 to-indigo-600' },
    { key: 'CARD', label: 'Card', color: 'from-purple-600 to-violet-600' },
    { key: 'CASH_ONLINE', label: 'Cash+Online', color: 'from-cyan-600 to-teal-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        {datePresets.map(p => (
          <button key={p.value} onClick={() => { setRange(p.value); if (p.value !== 'custom') { setDateFrom(''); setDateTo(''); } }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${range === p.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {p.label}
          </button>
        ))}
        {range === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" />
            <span className="text-gray-500 text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white" />
          </div>
        )}
      </div>

      {/* Search + Filter + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input type="text" placeholder="Search receipt, customer, cashier..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2 pl-9 pr-4 text-xs text-white font-bold focus:outline-none focus:border-blue-500/50" />
        </div>
        <div className="flex bg-gray-800 rounded-xl p-0.5">
          {[
            { value: 'all', label: 'All Invoices' },
            { value: 'paid', label: 'Paid' },
            { value: 'balance', label: 'Balance' }
          ].map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${statusFilter === f.value ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={cashier} onChange={e => setCashier(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-2 text-[10px] text-white font-bold focus:outline-none focus:border-blue-500/50">
          <option value="">All Employees</option>
          {employees.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={fetchSales} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all">
          <RefreshCw size={14} />
        </button>
        <button onClick={downloadExcel} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all">
          <Download size={14} /> Excel
        </button>
      </div>

      {/* Summary counts */}
      {!loading && !error && filteredSales.length > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{filteredSales.length} invoice{filteredSales.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-700">|</span>
          <span className="text-emerald-400 font-bold">{filteredSales.filter(s => s._balanceStatus === 'paid').length} Paid</span>
          <span className="text-gray-700">|</span>
          <span className="text-amber-400 font-bold">{filteredSales.filter(s => s._balanceStatus === 'balance').length} Balance</span>
        </div>
      )}

      {/* Payment Method Summary */}
      {!loading && !error && filteredSales.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {paymentMethods.map(pm => {
            const total = paymentSummary[pm.key] || 0;
            return (
              <div key={pm.key} className={`bg-gradient-to-br ${pm.color} p-[1px] rounded-xl`}>
                <div className="bg-gray-950 rounded-xl p-3">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{pm.label}</p>
                  <p className="text-sm font-black text-white mt-1">{formatCurrency(total)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading / Error / Empty */}
      {loading ? (
        <div className="py-16 flex justify-center"><RefreshCw className="animate-spin text-blue-500" size={28} /></div>
      ) : error ? (
        <div className="py-16 flex flex-col items-center text-center">
          <AlertTriangle className="text-red-400 mb-2" size={32} />
          <p className="text-red-400 font-black text-sm mb-2">{error}</p>
          <button onClick={fetchSales} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs">Retry</button>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="py-16 text-center">
          <Clock className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-500 font-bold">No invoices found</p>
        </div>
      ) : (
        /* Sales list */
        <div className="space-y-3">
          {filteredSales.map(sale => {
            const isExpanded = expandedId === sale.id;
            const isBalance = sale._balanceStatus === 'balance';
            const adv = parseFloat(sale.advanceAmount) || 0;
            return (
              <div key={sale.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Header row */}
                <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : sale.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white truncate">{sale.receiptNumber}</span>
                        {sale.faisalTake && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold">FT</span>}
                        {isBalance && <span className="text-[9px] bg-amber-600 text-white px-1.5 py-0.5 rounded-full font-bold">BAL</span>}
                        {!isBalance && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">PAID</span>}
                        {!!sale.orderId && <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-bold">ORD</span>}
                      </div>
                      <p className="text-xs text-gray-400">{sale.customerName || 'Walk-in'} {sale.customerPhone ? `(${sale.customerPhone})` : ''}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-600 mt-1">
                        <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                        <span>{sale.cashierName || ''}</span>
                        <span>{sale.paymentMethod === 'CASH_ONLINE' ? 'Cash+Online' : sale.paymentMethod}</span>
                        <span>{(sale.items || []).length} items</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-base font-black text-white">{formatCurrency(sale.grandTotal)}</p>
                      {isBalance && <p className="text-[10px] text-amber-400 font-bold">Rem: {formatCurrency(sale._balanceRemaining)}</p>}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                    {/* Items */}
                    {(sale.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                        <div>
                          <p className="font-black text-white">{isUrdu ? toUrduName(item.productName) : item.productName}</p>
                          <p className="text-[10px] text-gray-500">{[isUrdu ? toUrduName(item.color) : item.color, item.size].filter(Boolean).join(' / ')}{item.alterationCharges ? ` +Alt:${item.alterationCharges}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                          <p className="text-[10px] text-gray-500">{formatCurrency(item.lineTotal)}</p>
                        </div>
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                        <p className="text-gray-500">Subtotal</p>
                        <p className="font-bold text-white">{formatCurrency(sale.subtotal)}</p>
                      </div>
                      {sale.alterationCharges > 0 && (
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <p className="text-gray-500">Alteration</p>
                          <p className="font-bold text-white">{formatCurrency(sale.alterationCharges)}</p>
                        </div>
                      )}
                      {sale.discountAmount > 0 && (
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <p className="text-gray-500">Discount</p>
                          <p className="font-bold text-red-400">-{formatCurrency(sale.discountAmount)}</p>
                        </div>
                      )}
                      {sale.cardChargesAmount > 0 && (
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <p className="text-gray-500">Card Charges</p>
                          <p className="font-bold text-amber-400">+{formatCurrency(sale.cardChargesAmount)}</p>
                        </div>
                      )}
                      {adv > 0 && (
                        <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                          <p className="text-gray-500">Advance Paid</p>
                          <p className="font-bold text-emerald-400">{formatCurrency(adv)}</p>
                        </div>
                      )}
                      {sale.paymentMethod === 'CASH_ONLINE' && (
                        <>
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Cash Amount</p>
                            <p className="font-bold text-emerald-400">{formatCurrency(sale.cashAmount)}</p>
                          </div>
                          <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800">
                            <p className="text-gray-500">Online Amount</p>
                            <p className="font-bold text-blue-400">{formatCurrency(sale.onlineAmount)}</p>
                          </div>
                        </>
                      )}
                      <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 col-span-2">
                        <p className="text-gray-500">Grand Total</p>
                        <p className="text-base font-black text-white">{formatCurrency(sale.grandTotal)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button onClick={() => printReceipt(sale)} disabled={printing === sale.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {printing === sale.id ? <RefreshCcw className="animate-spin" size={12} /> : <Printer size={12} />} Print
                      </button>
                      {!sale.refundedAt && !sale.faisalTake && (
                        <button onClick={() => handleReturnInvoice(sale)} disabled={refunding === sale.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                          {refunding === sale.id ? <RefreshCcw className="animate-spin" size={12} /> : <RotateCcw size={12} />} Return
                        </button>
                      )}
                      {sale.refundedAt && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><RotateCcw size={12} /> Refunded</span>}
                      {isBalance && (
                        <button onClick={() => handlePayOpen(sale)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all">
                          <DollarSign size={12} /> Pay Balance
                        </button>
                      )}
                      <button onClick={() => openPayHistory(sale)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-xl transition-all">
                        <Clock size={12} /> Payment History
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pay Balance Modal ─── */}
      {showPayModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white">Pay Remaining Balance</h3>
            <div className="space-y-2 text-xs bg-gray-950 p-3 rounded-xl">
              <p className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-bold text-white">{selectedInvoice.receiptNumber}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold text-white">{selectedInvoice.customerName || 'Walk-in'}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Original Total</span><span className="font-bold text-white">{formatCurrency(selectedInvoice.grandTotal)}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-bold text-emerald-400">{formatCurrency(selectedInvoice.totalPaid || (selectedInvoice.grandTotal - selectedInvoice.remaining))}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Remaining</span><span className="font-bold text-amber-400">{formatCurrency(selectedInvoice.remaining)}</span></p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">Payment Amount</p>
              <input type="number" value={payAmount} min={0} max={selectedInvoice.remaining}
                onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayModal(false)}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Cancel</button>
              <button onClick={handlePayBalance} disabled={paying}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                {paying ? <RefreshCcw className="animate-spin" size={14} /> : <DollarSign size={14} />} Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Balance Payment Success / Receipt ─── */}
      {lastPayment && showReceipt && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => { setShowReceipt(false); setLastPayment(null); }}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <DollarSign size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-sm font-black text-white">Payment Successful</h3>
              <p className="text-[10px] text-gray-500 mt-1">Balance payment recorded — status updated automatically</p>
            </div>
            <div className="text-xs bg-gray-950 p-3 rounded-xl space-y-1.5">
              <p className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-emerald-400">{formatCurrency(lastPayment.amount)}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Remaining</span><span className="font-bold text-white">{formatCurrency(lastPayment.remaining)}</span></p>
              {lastPayment.remaining <= 0 && <p className="text-[10px] text-emerald-400 font-bold text-center mt-1">✓ Fully Paid — Invoice moved to Paid</p>}
              <p className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-bold text-white">{lastPayment.paymentMethod || 'CASH'}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-bold text-white">{new Date(lastPayment.paidAt || lastPayment.createdAt).toLocaleString()}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { printBalanceReceipt(); }}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <Printer size={14} /> Print Receipt
              </button>
              <button onClick={() => { setShowReceipt(false); setLastPayment(null); }}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Payment History Modal ─── */}
      {showPayHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowPayHistory(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white mb-4">Balance Payment History</h3>
            {payHistoryLoading ? (
              <div className="py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-500" size={24} /></div>
            ) : payHistory.length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-8">No balance payments recorded</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                  {payHistory.map((ph, i) => (
                    <div key={i} className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-emerald-400">{formatCurrency(ph.amountPaidNow || ph.amount)}</span>
                        <span className="text-[10px] text-gray-500">{new Date(ph.paidAt || ph.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span>Method: {ph.paymentMethod || 'CASH'}</span>
                        {ph.remaining > 0 && <span className="text-amber-400">Rem: {formatCurrency(ph.remaining)}</span>}
                        {ph.remaining <= 0 && <span className="text-emerald-400">Fully Paid</span>}
                      </div>
                      {ph.notes && <p className="text-[10px] text-gray-600 mt-1">Note: {ph.notes}</p>}
                    </div>
                  ))}
              </div>
            )}
            <button onClick={() => setShowPayHistory(false)}
              className="mt-4 w-full py-2.5 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutletInvoiceHistory;
