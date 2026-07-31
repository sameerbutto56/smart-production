import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, Printer, Search, X, ChevronDown, ChevronUp, Book, User, DollarSign, CreditCard, Globe, FileText, RotateCcw, RefreshCw, Download, Calendar, Filter } from 'lucide-react';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import * as XLSX from 'xlsx';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const PRESETS = [
  { label: 'Today', getRange: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate(); return { from: new Date(y, m, dd).toISOString(), to: new Date(y, m, dd + 1).toISOString() }; } },
  { label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate(); return { from: new Date(y, m, dd).toISOString(), to: new Date(y, m, dd + 1).toISOString() }; } },
  { label: 'Last 7 Days', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6); const y1 = from.getFullYear(), m1 = from.getMonth(), d1 = from.getDate(); const y2 = to.getFullYear(), m2 = to.getMonth(), d2 = to.getDate(); return { from: new Date(y1, m1, d1).toISOString(), to: new Date(y2, m2, d2 + 1).toISOString() }; } },
  { label: 'Last 30 Days', getRange: () => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 29); const y1 = from.getFullYear(), m1 = from.getMonth(), d1 = from.getDate(); const y2 = to.getFullYear(), m2 = to.getMonth(), d2 = to.getDate(); return { from: new Date(y1, m1, d1).toISOString(), to: new Date(y2, m2, d2 + 1).toISOString() }; } },
  { label: 'This Month', getRange: () => { const now = new Date(); return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString() }; } },
  { label: 'All Time', getRange: () => ({ from: '', to: '' }) },
];

const OutletRegisters = ({ outlet }) => {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  // Date filter state
  const [activePreset, setActivePreset] = useState('All Time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const applyPreset = (preset) => {
    const range = preset.getRange();
    setActivePreset(preset.label);
    setDateFrom(range.from);
    setDateTo(range.to);
    setShowDatePicker(false);
  };

  const applyCustomDates = () => {
    setActivePreset('Custom');
    setShowDatePicker(false);
  };

  const clearDateFilter = () => {
    setActivePreset('All Time');
    setDateFrom('');
    setDateTo('');
  };

  const isFiltered = dateFrom || dateTo;

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ outlet, _: Date.now() });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/api/pos/book/history?${params.toString()}`);
      setRegisters(res.data);
    } catch (e) {
      console.error('Failed to fetch register history:', e);
      toast.error('Failed to load register history');
    }
    setLoading(false);
  }, [outlet, dateFrom, dateTo]);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  const filtered = useMemo(() =>
    registers.filter(r =>
      !search || r.openedBy?.toLowerCase().includes(search.toLowerCase()) ||
      r.closedBy?.toLowerCase().includes(search.toLowerCase()) ||
      formatDateOnly(r.openedAt).includes(search)
    ), [registers, search]);

  // ─── Print helpers ──────────────────────────────────────────
  const buildThermalLines = (reg) => {
    const s = reg.summary;
    if (!s) return null;
    const lines = [];
    lines.push(`${outlet.toUpperCase()}\nCLOSE BOOK REPORT\n`);
    lines.push('REGISTER INFORMATION');
    lines.push('─'.repeat(32));
    lines.push(`Register #:  ${reg.id?.slice(0, 8) || 'N/A'}`);
    lines.push(`Opened by:  ${reg.openedBy || 'N/A'}`);
    lines.push(`Open Date:  ${formatDateOnly(reg.openedAt)}`);
    lines.push(`Open Time:  ${formatTimeOnly(reg.openedAt)}`);
    lines.push(`Closed by:  ${reg.closedBy || 'N/A'}`);
    lines.push(`Close Date: ${formatDateOnly(reg.closedAt)}`);
    lines.push(`Close Time: ${formatTimeOnly(reg.closedAt)}`);
    lines.push('');
    lines.push('PAYMENT SUMMARY');
    lines.push('─'.repeat(32));
    lines.push(`Cash:         ${formatCurrency(s.paymentSummary?.cash || 0)}`);
    lines.push(`Card:         ${formatCurrency(s.paymentSummary?.card || 0)}`);
    lines.push(`Online:       ${formatCurrency(s.paymentSummary?.online || 0)}`);
    lines.push(`Cash+Online:  ${formatCurrency(s.paymentSummary?.cashOnlineTotal || 0)}`);
    lines.push(`Grand Total:  ${formatCurrency(s.paymentSummary?.grandTotal || 0)}`);
    lines.push('');
    lines.push('EMPLOYEE COLLECTIONS');
    lines.push('─'.repeat(32));
    (s.employeeCollections || []).forEach(e => {
      lines.push(`${e.name}`);
      lines.push(`  Cash: ${formatCurrency(e.cash)}  Card: ${formatCurrency(e.card)}`);
      lines.push(`  Online: ${formatCurrency(e.online)}  Total: ${formatCurrency(e.total)}`);
    });
    lines.push('');
    lines.push('CASH SUMMARY');
    lines.push('─'.repeat(32));
    lines.push(`Cash Sales:      ${formatCurrency(s.paymentSummary?.cashCollected || s.paymentSummary?.cash || 0)}`);
    lines.push(`Gen Entry:      -${formatCurrency(s.totalJournalEntries || 0)}`);
    lines.push(`Cash Returns:   -${formatCurrency(s.returnSummary?.cash || 0)}`);
    lines.push(`Available Cash:  ${formatCurrency(s.availableCash || 0)}`);
    const transferred = s.transferToSystem || 0;
    if (transferred > 0) {
      lines.push(`Transfer to Sys: ${formatCurrency(transferred)}`);
      lines.push(`Remaining:       ${formatCurrency((s.availableCash || 0) - transferred)}`);
    }
    lines.push('');
    lines.push('─'.repeat(32));
    lines.push('   BOOK CLOSED');
    lines.push('─'.repeat(32));
    return lines;
  };

  const buildA4Body = (reg) => {
    const s = reg.summary;
    if (!s) return '';
    const avail = s.availableCash || 0;
    const transferred = s.transferToSystem || 0;
    const remaining = avail - transferred;
    return `
      <div class="section" style="page-break-inside:avoid;">
        <h3>Register Information</h3>
        <table>
          <tr><td>Register #</td><td><strong>${reg.id?.slice(0, 8) || 'N/A'}</strong></td></tr>
          <tr><td>Opened by</td><td><strong>${reg.openedBy || 'N/A'}</strong></td></tr>
          <tr><td>Open Date</td><td><strong>${formatDateOnly(reg.openedAt)}</strong></td></tr>
          <tr><td>Open Time</td><td><strong>${formatTimeOnly(reg.openedAt)}</strong></td></tr>
          <tr><td>Closed by</td><td><strong>${reg.closedBy || 'N/A'}</strong></td></tr>
          <tr><td>Close Date</td><td><strong>${formatDateOnly(reg.closedAt)}</strong></td></tr>
          <tr><td>Close Time</td><td><strong>${formatTimeOnly(reg.closedAt)}</strong></td></tr>
        </table>
      </div>
      <h2>Payment Summary</h2>
      <table>
        <tr><th>Method</th><th class="right">Amount</th></tr>
        <tr><td>Cash</td><td class="right">${formatCurrency(s.paymentSummary?.cash || 0)}</td></tr>
        <tr><td>Card</td><td class="right">${formatCurrency(s.paymentSummary?.card || 0)}</td></tr>
        <tr><td>Online</td><td class="right">${formatCurrency(s.paymentSummary?.online || 0)}</td></tr>
        <tr><td>Cash + Online</td><td class="right">${formatCurrency(s.paymentSummary?.cashOnlineTotal || 0)}</td></tr>
        <tr class="total"><td>Grand Total</td><td class="right">${formatCurrency(s.paymentSummary?.grandTotal || 0)}</td></tr>
      </table>
      <h2>Employee Collections</h2>
      <table>
        <tr><th>Employee</th><th class="right">Cash</th><th class="right">Card</th><th class="right">Online</th><th class="right">Total</th></tr>
        ${(s.employeeCollections || []).map(e => `<tr><td>${e.name}</td><td class="right">${formatCurrency(e.cash)}</td><td class="right">${formatCurrency(e.card)}</td><td class="right">${formatCurrency(e.online)}</td><td class="right">${formatCurrency(e.total)}</td></tr>`).join('')}
      </table>
      ${s.totalFaisalTake > 0 ? `<p><strong>Faisal Takes:</strong> ${formatCurrency(s.totalFaisalTake)}</p>` : ''}
      <h2>General Entry Deduction</h2>
      <table>
        <tr><td>Journal Entries</td><td class="right">${formatCurrency(s.totalJournalEntries || 0)}</td></tr>
        ${(s.journalEntries || []).map(j => `<tr><td style="padding-left:20px;font-size:12px;color:#666;">${j.expenseTitle} — ${j.employeeName}</td><td class="right">${formatCurrency(j.amount)}</td></tr>`).join('')}
      </table>
      <h2>Returns &amp; Refunds</h2>
      <table>
        <tr><td>Cash Returns</td><td class="right">${formatCurrency(s.returnSummary?.cash || 0)}</td></tr>
        <tr><td>Card Returns</td><td class="right">${formatCurrency(s.returnSummary?.card || 0)}</td></tr>
        <tr><td>Online Returns</td><td class="right">${formatCurrency(s.returnSummary?.online || 0)}</td></tr>
        <tr class="total"><td>Total Returns</td><td class="right">${formatCurrency((s.returnSummary?.cash || 0) + (s.returnSummary?.card || 0) + (s.returnSummary?.online || 0))}</td></tr>
      </table>
      <h2>Cash Summary</h2>
      <table>
        <tr><td>Cash Sales</td><td class="right">${formatCurrency(s.paymentSummary?.cashCollected || s.paymentSummary?.cash || 0)}</td></tr>
        <tr><td>General Entry Deduction</td><td class="right">-${formatCurrency(s.totalJournalEntries || 0)}</td></tr>
        <tr><td>Cash Returns</td><td class="right">-${formatCurrency(s.returnSummary?.cash || 0)}</td></tr>
        <tr class="total"><td>Available Cash</td><td class="right">${formatCurrency(avail)}</td></tr>
        ${transferred > 0 ? `<tr><td>Transfer to System</td><td class="right">-${formatCurrency(transferred)}</td></tr><tr class="total"><td>Remaining Cash in Locker</td><td class="right">${formatCurrency(remaining)}</td></tr>` : ''}
      </table>
    `;
  };

  // Single register thermal print
  const printThermal = (reg) => {
    const lines = buildThermalLines(reg);
    if (!lines) { toast.error('No summary data'); return; }
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:16px;margin:0;">${lines.join('\n')}</pre><div style="text-align:center;font-size:10px;color:#888;margin-top:12px;padding-top:6px;border-top:1px solid #ccc;">Software is developed by Sameer Butt</div>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // Single register A4 print
  const printA4 = (reg) => {
    const body = buildA4Body(reg);
    if (!body) { toast.error('No summary data'); return; }
    const dateLabel = formatDateOnly(reg.closedAt || reg.openedAt);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    w.document.write(`<html><head><style>
      body { font-family: Arial, sans-serif; padding: 40px; font-size: 14px; }
      h1 { text-align: center; font-size: 20px; }
      h2 { font-size: 16px; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background: #f5f5f5; font-weight: bold; }
      .total { font-weight: bold; font-size: 15px; }
      .right { text-align: right; }
      .section { margin-top: 24px; }
      .section h3 { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
      @media print { body { padding: 20px; } }
    </style></head><body>
      ${getPrintLogoHTML()}
      <h1>${outlet.toUpperCase()}</h1>
      <p style="text-align:center;font-size:16px;font-weight:bold;">CLOSE BOOK REPORT — ${dateLabel}</p>
      ${body}
      ${getPrintFooterHTML()}
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // ─── Bulk Print ─────────────────────────────────────────────
  const printBulk = (type) => {
    if (filtered.length === 0) { toast.error('No registers to print'); return; }
    const isThermal = type === 'thermal';
    const allBody = filtered.map((reg, i) => {
      const dateLabel = formatDateOnly(reg.closedAt || reg.openedAt);
      const openedLabel = formatDateOnly(reg.openedAt);
      const closedLabel = reg.closedAt ? formatDateOnly(reg.closedAt) : 'N/A';
      if (isThermal) {
        const lines = buildThermalLines(reg);
        if (!lines) return '';
        return lines.join('\n');
      }
      return `
        <div style="page-break-before:always;">
          ${getPrintLogoHTML()}
          <h1>${outlet.toUpperCase()}</h1>
          <p style="text-align:center;font-size:16px;font-weight:bold;">CLOSE BOOK REPORT — ${dateLabel}</p>
          ${buildA4Body(reg)}
          ${getPrintFooterHTML()}
        </div>
      `;
    }).filter(Boolean);

    if (isThermal) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const w = iframe.contentWindow;
      w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:16px;margin:0;white-space:pre-wrap;">${allBody.join('\n\n\n')}</pre><div style="text-align:center;font-size:10px;color:#888;margin-top:12px;padding-top:6px;border-top:1px solid #ccc;">Software is developed by Sameer Butt</div>`);
      w.document.close();
      w.focus();
      w.print();
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const w = iframe.contentWindow;
      w.document.write(`<html><head><style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 14px; }
        h1 { text-align: center; font-size: 20px; }
        h2 { font-size: 16px; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; font-weight: bold; }
        .total { font-weight: bold; font-size: 15px; }
        .right { text-align: right; }
        .section { margin-top: 24px; }
        .section h3 { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        @media print { body { padding: 10px; } }
      </style></head><body>${allBody.join('')}</body></html>`);
      w.document.close();
      w.focus();
      w.print();
    }
    toast.success(`Printing ${filtered.length} register(s)...`);
  };

  // ─── Bulk Excel Export ──────────────────────────────────────
  const exportExcel = () => {
    if (filtered.length === 0) { toast.error('No registers to export'); return; }
    const rows = [];
    for (const reg of filtered) {
      const s = reg.summary || {};
      const ps = s.paymentSummary || {};
      const rs = s.returnSummary || {};
      const dateLabel = formatDateOnly(reg.closedAt || reg.openedAt);
      const openTime = formatTimeOnly(reg.openedAt);
      const closeTime = reg.closedAt ? formatTimeOnly(reg.closedAt) : 'N/A';

      rows.push({
        'Register Date': dateLabel,
        'Outlet': outlet,
        'Register ID': reg.id?.slice(0, 8) || 'N/A',
        'Opened By': reg.openedBy || 'N/A',
        'Open Time': `${dateLabel} ${openTime}`,
        'Closed By': reg.closedBy || 'N/A',
        'Close Time': reg.closedAt ? `${dateLabel} ${closeTime}` : 'N/A',
        'Status': reg.status,
        'Grand Total': ps.grandTotal || 0,
        'Cash': ps.cash || 0,
        'Card': ps.card || 0,
        'Online': ps.online || 0,
        'Cash+Online': ps.cashOnlineTotal || 0,
        'Cash Collected (Raw)': ps.cashCollected || 0,
        'Total Faisal Take': s.totalFaisalTake || 0,
        'Journal Entries': s.totalJournalEntries || 0,
        'Total Returns': rs.total || 0,
        'Cash Returns': rs.cash || 0,
        'Card Returns': rs.card || 0,
        'Online Returns': rs.online || 0,
        'Available Cash': s.availableCash || 0,
        'Transfer to System': s.transferToSystem || 0,
      });

      // Employee collections sub-rows
      for (const ec of (s.employeeCollections || [])) {
        rows.push({
          'Register Date': dateLabel,
          'Outlet': outlet,
          'Register ID': reg.id?.slice(0, 8) || 'N/A',
          'Opened By': `  → ${ec.name}`,
          'Open Time': '',
          'Closed By': '',
          'Close Time': '',
          'Status': '',
          'Grand Total': ec.total || 0,
          'Cash': ec.cash || 0,
          'Card': ec.card || 0,
          'Online': ec.online || 0,
          'Cash+Online': 0,
          'Cash Collected (Raw)': 0,
          'Total Faisal Take': 0,
          'Journal Entries': 0,
          'Total Returns': 0,
          'Cash Returns': 0,
          'Card Returns': 0,
          'Online Returns': 0,
          'Available Cash': 0,
          'Transfer to System': 0,
        });
      }

      // Separator row
      rows.push({});
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 22 },
      { wch: 20 }, { wch: 22 }, { wch: 8 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registers');

    // Summary sheet
    const summaryRows = filtered.map(reg => {
      const s = reg.summary || {};
      const ps = s.paymentSummary || {};
      const rs = s.returnSummary || {};
      return {
        'Date': formatDateOnly(reg.closedAt || reg.openedAt),
        'Outlet': outlet,
        'ID': reg.id?.slice(0, 8) || 'N/A',
        'Opened By': reg.openedBy || 'N/A',
        'Closed By': reg.closedBy || 'N/A',
        'Grand Total': ps.grandTotal || 0,
        'Cash': ps.cash || 0,
        'Card': ps.card || 0,
        'Online': ps.online || 0,
        'Faisal Take': s.totalFaisalTake || 0,
        'Journal': s.totalJournalEntries || 0,
        'Returns': rs.total || 0,
        'Available Cash': s.availableCash || 0,
        'Transfer': s.transferToSystem || 0,
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2['!cols'] = [
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    const range = isFiltered ? `${dateFrom || 'start'}_to_${dateTo || 'now'}` : 'all';
    XLSX.writeFile(wb, `Registers_${outlet}_${range}.xlsx`);
    toast.success(`Exported ${filtered.length} register(s)`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Book size={20} className="text-blue-400" />
          <h2 className="text-lg font-black text-white">Register History</h2>
          <span className="text-xs text-gray-500 font-bold bg-gray-800 px-2 py-0.5 rounded-lg">{filtered.length} of {registers.length} closed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registers..." className="w-48 bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          </div>
          <button onClick={fetchRegisters} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"><RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-blue-400" />
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Date Range Filter</span>
            {isFiltered && (
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {dateFrom || '...'} to {dateTo || '...'}
              </span>
            )}
          </div>
          {isFiltered && (
            <button onClick={clearDateFilter} className="text-[10px] font-bold text-gray-500 hover:text-white transition-all flex items-center gap-1">
              <X size={10} /> Clear
            </button>
          )}
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                activePreset === p.label
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
              activePreset === 'Custom' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}>
            <Filter size={10} /> Custom Range
          </button>
        </div>

        {/* Custom date picker */}
        {showDatePicker && (
          <div className="flex items-center gap-2 pt-1">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500" />
            <span className="text-gray-500 text-xs font-bold">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500" />
            <button onClick={applyCustomDates} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all">
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={() => printBulk('a4')} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all">
            <Printer size={14} /> Print All (A4)
          </button>
          <button onClick={() => printBulk('thermal')} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-all">
            <Printer size={14} /> Print All (Thermal)
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all">
            <Download size={14} /> Export to Excel
          </button>
        </div>
      )}

      {/* Register List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-gray-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 font-bold">No closed registers found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(reg => (
            <div key={reg.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Summary row */}
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-all" onClick={() => setExpandedId(expandedId === reg.id ? null : reg.id)}>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/10 p-2 rounded-xl"><Book size={18} className="text-blue-400" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{formatDateOnly(reg.openedAt)}</span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-md">{reg.id?.slice(0, 8)}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reg.status === 'CLOSED' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{reg.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500 font-bold">
                      <span className="flex items-center gap-1"><User size={10} /> {reg.openedBy || 'N/A'}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><User size={10} /> {reg.closedBy || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatTimeOnly(reg.openedAt)} - {formatTimeOnly(reg.closedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-emerald-400">{formatCurrency(reg.summary?.paymentSummary?.grandTotal || 0)}</span>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">{formatCurrency(reg.summary?.availableCash || 0)} cash</span>
                  {expandedId === reg.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === reg.id && (
                <div className="border-t border-gray-800 p-4 space-y-4">
                  {/* Payment Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Cash</span>
                      <p className="text-sm font-black text-emerald-400">{formatCurrency(reg.summary?.paymentSummary?.cash || 0)}</p>
                    </div>
                    <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Card</span>
                      <p className="text-sm font-black text-purple-400">{formatCurrency(reg.summary?.paymentSummary?.card || 0)}</p>
                    </div>
                    <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Online</span>
                      <p className="text-sm font-black text-blue-400">{formatCurrency(reg.summary?.paymentSummary?.online || 0)}</p>
                    </div>
                    <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <span className="text-[10px] font-black text-gray-500 uppercase">Cash+Online</span>
                      <p className="text-sm font-black text-amber-400">{formatCurrency(reg.summary?.paymentSummary?.cashOnlineTotal || 0)}</p>
                    </div>
                  </div>

                  {/* Employee Collections */}
                  {(reg.summary?.employeeCollections || []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Employee Collections</h4>
                      <div className="space-y-1">
                        {reg.summary.employeeCollections.map((e, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                            <span className="font-bold text-white">{e.name} <span className="text-gray-500">({e.salesCount} sales)</span></span>
                            <div className="flex items-center gap-3">
                              <span className="text-emerald-400 font-bold">{formatCurrency(e.cash)}</span>
                              <span className="text-purple-400 font-bold">{formatCurrency(e.card)}</span>
                              <span className="text-blue-400 font-bold">{formatCurrency(e.online)}</span>
                              <span className="text-white font-black">{formatCurrency(e.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Journal Entries */}
                  {(reg.summary?.journalEntries || []).length > 0 && (
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">General Entry Deduction</h4>
                      <div className="space-y-1">
                        {reg.summary.journalEntries.map((j, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs">
                            <span className="text-gray-300">{j.expenseTitle} <span className="text-gray-500">— {j.employeeName}</span></span>
                            <span className="font-bold text-red-400">-{formatCurrency(j.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cash Summary */}
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cash Summary</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-400">Cash Sales</span><span className="font-bold text-emerald-400">{formatCurrency(reg.summary?.paymentSummary?.cashCollected || reg.summary?.paymentSummary?.cash || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-orange-400 font-bold">General Entry Deduction</span><span className="font-bold text-red-400">-{formatCurrency(reg.summary?.totalJournalEntries || 0)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Cash Returns</span><span className="font-bold text-red-400">-{formatCurrency(reg.summary?.returnSummary?.cash || 0)}</span></div>
                      <div className="flex justify-between pt-2 border-t border-gray-700"><span className="font-bold text-white">Available Cash</span><span className="font-bold text-emerald-400">{formatCurrency(reg.summary?.availableCash || 0)}</span></div>
                      {(reg.summary?.transferToSystem || 0) > 0 && (
                        <>
                          <div className="flex justify-between"><span className="text-gray-400">Transfer to System</span><span className="font-bold text-red-400">-{formatCurrency(reg.summary.transferToSystem)}</span></div>
                          <div className="flex justify-between pt-2 border-t border-gray-700"><span className="font-bold text-white">Remaining Cash</span><span className="font-bold text-emerald-400">{formatCurrency((reg.summary?.availableCash || 0) - reg.summary.transferToSystem)}</span></div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reprint buttons */}
                  <div className="flex gap-2">
                    <button onClick={() => printThermal(reg)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-all">
                      <Printer size={14} /> Thermal
                    </button>
                    <button onClick={() => printA4(reg)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all">
                      <Printer size={14} /> A4
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OutletRegisters;
