import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, Printer, Search, X, ChevronDown, ChevronUp, Book, User, DollarSign, CreditCard, Globe, FileText, RotateCcw, RefreshCw } from 'lucide-react';
import { getPrintLogoHTML, getPrintFooterHTML } from '../utils/printTemplate';

const formatCurrency = (n) => `₨${(n || 0).toLocaleString()}`;

const formatPaymentMethod = (m) => {
  const map = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online', CASH_ONLINE: 'Cash + Online' };
  return map[m] || m;
};

const OutletRegisters = ({ outlet }) => {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/pos/book/history?outlet=${outlet}&_=${Date.now()}`);
      setRegisters(res.data);
    } catch (e) {
      console.error('Failed to fetch register history:', e);
      toast.error('Failed to load register history');
    }
    setLoading(false);
  }, [outlet]);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  // Print thermal
  const printThermal = (reg) => {
    const s = reg.summary;
    if (!s) { toast.error('No summary data'); return; }
    const lines = [];
    lines.push(`${outlet.toUpperCase()}\nCLOSE BOOK REPORT\n`);
    lines.push('REGISTER INFORMATION');
    lines.push('─'.repeat(32));
    lines.push(`Opened by:  ${reg.openedBy || 'N/A'}`);
    lines.push(`Open Date:  ${new Date(reg.openedAt).toLocaleDateString()}`);
    lines.push(`Open Time:  ${new Date(reg.openedAt).toLocaleTimeString()}`);
    lines.push(`Closed by:  ${reg.closedBy || 'N/A'}`);
    lines.push(`Close Date: ${new Date(reg.closedAt).toLocaleDateString()}`);
    lines.push(`Close Time: ${new Date(reg.closedAt).toLocaleTimeString()}`);
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
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const w = iframe.contentWindow;
    w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:16px;margin:0;">${lines.join('\n')}</pre><div style="text-align:center;font-size:10px;color:#888;margin-top:12px;padding-top:6px;border-top:1px solid #ccc;">Software is developed by Sameer Butt</div>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // Print A4
  const printA4 = (reg) => {
    const s = reg.summary;
    if (!s) { toast.error('No summary data'); return; }
    const avail = s.availableCash || 0;
    const transferred = s.transferToSystem || 0;
    const remaining = avail - transferred;
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
    </style></head><body>
      ${getPrintLogoHTML()}
      <h1>${outlet.toUpperCase()}</h1>
      <p style="text-align:center;font-size:16px;font-weight:bold;">CLOSE BOOK REPORT</p>
      <div class="section">
        <h3>Register Information</h3>
        <table>
          <tr><td>Opened by</td><td><strong>${reg.openedBy || 'N/A'}</strong></td></tr>
          <tr><td>Open Date</td><td><strong>${new Date(reg.openedAt).toLocaleDateString()}</strong></td></tr>
          <tr><td>Open Time</td><td><strong>${new Date(reg.openedAt).toLocaleTimeString()}</strong></td></tr>
          <tr><td>Closed by</td><td><strong>${reg.closedBy || 'N/A'}</strong></td></tr>
          <tr><td>Close Date</td><td><strong>${new Date(reg.closedAt).toLocaleDateString()}</strong></td></tr>
          <tr><td>Close Time</td><td><strong>${new Date(reg.closedAt).toLocaleTimeString()}</strong></td></tr>
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
      ${getPrintFooterHTML()}
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const filtered = registers.filter(r =>
    !search || r.openedBy?.toLowerCase().includes(search.toLowerCase()) ||
    r.closedBy?.toLowerCase().includes(search.toLowerCase()) ||
    new Date(r.openedAt).toLocaleDateString().includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Book size={20} className="text-blue-400" />
          <h2 className="text-lg font-black text-white">Register History</h2>
          <span className="text-xs text-gray-500 font-bold bg-gray-800 px-2 py-0.5 rounded-lg">{registers.length} closed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registers..." className="w-48 bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          </div>
          <button onClick={fetchRegisters} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"><RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

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
                      <span className="text-sm font-black text-white">{new Date(reg.openedAt).toLocaleDateString()}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reg.status === 'CLOSED' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{reg.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-500 font-bold">
                      <span className="flex items-center gap-1"><User size={10} /> {reg.openedBy || 'N/A'}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><User size={10} /> {reg.closedBy || 'N/A'}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(reg.openedAt).toLocaleTimeString()} - {new Date(reg.closedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-emerald-400">{formatCurrency(reg.summary?.paymentSummary?.grandTotal || 0)}</span>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">₨{formatCurrency(reg.summary?.availableCash || 0)} cash</span>
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
                              <span className="text-emerald-400 font-bold">₨{formatCurrency(e.cash)}</span>
                              <span className="text-purple-400 font-bold">₨{formatCurrency(e.card)}</span>
                              <span className="text-blue-400 font-bold">₨{formatCurrency(e.online)}</span>
                              <span className="text-white font-black">₨{formatCurrency(e.total)}</span>
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