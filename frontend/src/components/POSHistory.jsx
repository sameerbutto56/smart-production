import React, { useEffect, useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency, formatPaymentMethod, printBalanceReceipt, printBalanceGatePass, printPosFinancialSummary } from '../utils/POSPrint';
import { computePosFinancialSummary } from '../utils/posFinancialSummary';
import { formatDateTime } from '../utils/dateTime';
import api from '../services/api';
import { Clock, ShoppingCart, BarChart3, Search, Download, Printer, RotateCcw, FileText, CreditCard } from 'lucide-react';

const POSHistory = () => {
  const { isUrdu } = useLanguage();
  const {
    salesRange, setSalesRange, salesDateFrom, setSalesDateFrom, salesDateTo, setSalesDateTo,
    receiptSearch, setReceiptSearch, sales, filteredSales, salesLoading, historySearchLoading,
    handleRefundInvoiceFromHistory, downloadExcel,
    setPendingPrintSale, setPrintOpts, setShowPrintOptions, setTab, selectedOutlet,
  } = usePOS();

  const [generalEntries, setGeneralEntries] = useState([]);
  const [geLoading, setGeLoading] = useState(false);

  const [balancePayments, setBalancePayments] = useState([]);
  const [bpLoading, setBpLoading] = useState(false);

  const [historyFilter, setHistoryFilter] = useState('all');

  useEffect(() => {
    setBpLoading(true);
    const params = { outlet: selectedOutlet };
    if (salesDateFrom) params.dateFrom = salesDateFrom;
    if (salesDateTo) params.dateTo = salesDateTo;
    if (salesRange === 'today') params.range = 'today';
    else if (salesRange === 'week') params.range = 'week';
    else if (salesRange === 'month') params.range = 'month';
    else if (salesRange === 'yesterday') params.range = 'yesterday';
    else if (salesRange === 'year') params.range = 'year';
    api.get('/api/pos/balance-collections', { params })
      .then(r => setBalancePayments(r.data?.payments || []))
      .catch(() => setBalancePayments([]))
      .finally(() => setBpLoading(false));
  }, [selectedOutlet, salesRange, salesDateFrom, salesDateTo]);

  const matchSearch = React.useCallback((q, ...fields) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return fields.some(f => (f || '').toLowerCase().includes(ql));
  }, []);

  const searchQuery = (receiptSearch || '').trim();

  const filteredBalancePayments = React.useMemo(() => {
    if (!searchQuery) return balancePayments || [];
    return (balancePayments || []).filter(bp =>
      matchSearch(searchQuery, bp.posSale?.customerName, bp.posSale?.customerPhone, bp.receiptNumber, bp.originalInvoiceNumber, bp.posSale?.receiptNumber)
    );
  }, [balancePayments, searchQuery, matchSearch]);

  const filteredGeneralEntries = React.useMemo(() => {
    if (!searchQuery) return generalEntries || [];
    return (generalEntries || []).filter(ge =>
      matchSearch(searchQuery, ge.expenseTitle, ge.employeeName, ge.notes)
    );
  }, [generalEntries, searchQuery, matchSearch]);

  const unifiedTimeline = React.useMemo(() => {
    const saleItems = (filteredSales || []).map(s => ({
      _type: 'sale',
      _date: s.createdAt,
      _data: s,
    }));
    const bpItems = filteredBalancePayments.map(bp => ({
      _type: 'balance_payment',
      _date: bp.paidAt || bp.createdAt,
      _data: bp,
    }));
    const geItems = filteredGeneralEntries.map(ge => ({
      _type: 'general_entry',
      _date: ge.createdAt,
      _data: ge,
    }));
    let all;
    if (historyFilter === 'general') all = geItems;
    else if (historyFilter === 'balance') all = bpItems;
    else all = [...saleItems, ...bpItems, ...geItems];
    all.sort((a, b) => new Date(b._date) - new Date(a._date));
    return all;
  }, [filteredSales, filteredBalancePayments, filteredGeneralEntries, historyFilter]);

  useEffect(() => {
    setGeLoading(true);
    const params = { outlet: selectedOutlet };
    if (salesDateFrom) params.dateFrom = salesDateFrom;
    if (salesDateTo) params.dateTo = salesDateTo;
    if (salesRange === 'today') params.range = 'today';
    else if (salesRange === 'week') params.range = 'week';
    else if (salesRange === 'month') params.range = 'month';
    else if (salesRange === 'yesterday') params.range = 'yesterday';
    else if (salesRange === 'year') params.range = 'year';
    api.get('/api/pos/journal-entries', { params })
      .then(r => setGeneralEntries(r.data || []))
      .catch(() => setGeneralEntries([]))
      .finally(() => setGeLoading(false));
  }, [selectedOutlet, salesRange, salesDateFrom, salesDateTo]);

  const totalBPCollected = filteredBalancePayments.reduce((sum, bp) => sum + (bp.amountPaidNow || 0), 0);
  const totalGE = filteredGeneralEntries.reduce((sum, ge) => sum + (ge.amount || 0), 0);
  const totalBPSales = filteredSales?.length || 0;
  const anyLoading = salesLoading || bpLoading || geLoading;

  // Real-time financial summary metrics for the active filtered timeline
  const summaryMetrics = React.useMemo(() => {
    let cash = 0, card = 0, online = 0, totalReceived = 0, totalReturns = 0;
    (filteredSales || []).forEach(s => {
      const rec = s._amountReceived != null ? s._amountReceived : (s.grandTotal || 0);
      totalReceived += rec;
      if (s.paymentMethod === 'CASH') cash += rec;
      else if (s.paymentMethod === 'CARD') card += rec;
      else if (s.paymentMethod === 'ONLINE') online += rec;
      else if (s.paymentMethod === 'CASH_ONLINE') {
        const c = s.cashAmount || 0;
        const o = s.onlineAmount || 0;
        const declared = c + o;
        if (declared > 0 && Math.abs(declared - rec) > 0.5) {
          const ratio = rec / declared;
          const scaledCash = Math.round(c * ratio);
          cash += scaledCash;
          online += (rec - scaledCash);
        } else if (declared === 0) {
          const half = Math.round(rec / 2);
          cash += half;
          online += (rec - half);
        } else {
          cash += c;
          online += o;
        }
      } else {
        cash += rec;
      }
      (s.returns || []).forEach(r => { totalReturns += (r.refundAmount || 0); });
    });

    (filteredBalancePayments || []).forEach(bp => {
      const amt = bp.amountPaidNow || 0;
      totalReceived += amt;
      if (bp.paymentMethod === 'CASH_ONLINE') {
        const c = bp.cashAmount ?? Math.round(amt / 2);
        const o = bp.onlineAmount ?? (amt - c);
        cash += c;
        online += o;
      } else if (bp.paymentMethod === 'CARD') {
        card += amt;
      } else if (bp.paymentMethod === 'ONLINE') {
        online += amt;
      } else {
        cash += amt;
      }
    });

    return {
      cash,
      card,
      online,
      totalReceived,
      totalReturns,
      netRevenue: Math.max(0, totalReceived - totalReturns - totalGE),
      netCash: cash - totalGE,
    };
  }, [filteredSales, filteredBalancePayments, totalGE]);

  // Authoritative 4-tier financial summary calculation
  const finSummary = React.useMemo(() => {
    return computePosFinancialSummary({
      sales: filteredSales || [],
      balancePayments: filteredBalancePayments || [],
      journalEntries: filteredGeneralEntries || [],
      isFiltered: true,
    });
  }, [filteredSales, filteredBalancePayments, filteredGeneralEntries]);

  const handlePrintSummary = () => {
    const rangeLabel = salesRange === 'custom'
      ? `${salesDateFrom || 'Start'} to ${salesDateTo || 'End'}`
      : (salesRange ? salesRange.toUpperCase() : 'ALL');
    printPosFinancialSummary({
      outlet: selectedOutlet || 'Outlet',
      dateRangeLabel: rangeLabel,
      salesSummary: finSummary.salesSummary,
      paymentBreakdown: finSummary.paymentBreakdown,
      deductions: finSummary.deductions,
      finalPosition: finSummary.finalPosition,
      invoiceCount: finSummary.invoiceCount,
    });
  };

  const filterTabs = [
    { key: 'all', label: 'All', icon: ShoppingCart, badge: totalBPSales + filteredBalancePayments.length + filteredGeneralEntries.length, activeBg: 'bg-purple-700', activeBorder: 'border-purple-500' },
    { key: 'general', label: 'General', icon: FileText, badge: filteredGeneralEntries.length, activeBg: 'bg-orange-700', activeBorder: 'border-orange-500' },
    { key: 'balance', label: 'Balance', icon: CreditCard, badge: filteredBalancePayments.length, activeBg: 'bg-cyan-700', activeBorder: 'border-cyan-500' },
  ];

  return (
    <div className="space-y-4 pb-20 px-4 overflow-y-auto h-full pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Clock size={24} className="text-purple-500" />Sales History</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('pos')} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"><ShoppingCart size={14} className="inline mr-1" />POS</button>
          <button onClick={() => setTab('dashboard')} className="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"><BarChart3 size={14} className="inline mr-1" />Dashboard</button>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'today', 'yesterday', 'week', 'month', 'year'].map(p => (
          <button key={p} onClick={() => { setSalesRange(p); if (p !== 'custom') { setSalesDateFrom(''); setSalesDateTo(''); } }}
            className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all ${salesRange === p ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
            {p === 'all' ? 'All' : p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : p === 'year' ? 'Yearly' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <button onClick={() => setSalesRange('custom')}
          className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all ${salesRange === 'custom' ? 'bg-purple-600 text-white border-purple-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>Custom</button>
        {salesRange === 'custom' && (
          <div className="flex items-center gap-1">
            <input type="date" value={salesDateFrom} onChange={e => setSalesDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none" />
            <span className="text-gray-500 text-xs">→</span>
            <input type="date" value={salesDateTo} onChange={e => setSalesDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="Search invoice #, customer name, or phone..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none" />
          {receiptSearch && historySearchLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-400 animate-pulse">Searching…</span>
          )}
        </div>
        <button onClick={handlePrintSummary} className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-3 py-2.5 rounded-xl text-[10px] flex items-center gap-1 shadow-md"><Printer size={14} />Print</button>
        <button onClick={downloadExcel} className="bg-green-700 hover:bg-green-600 text-white font-bold px-3 py-2.5 rounded-xl text-[10px] flex items-center gap-1 shadow-md"><Download size={14} />Excel</button>
      </div>

      {/* 4-Tier Simplified Financial Summary Dashboard */}
      {!anyLoading && (finSummary.invoiceCount > 0 || finSummary.deductions.generalEntries > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Tier 1: Sales Summary */}
          <div className="bg-gray-950 border border-blue-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">1. Sales Summary</span>
                <span className="text-[9px] font-bold text-gray-500">{finSummary.invoiceCount} invoices</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Gross Sales:</span>
                  <span className="font-black text-white">{formatCurrency(finSummary.salesSummary.grossSales)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Discount:</span>
                  <span className="font-bold text-amber-400">-{formatCurrency(finSummary.salesSummary.discount)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-gray-800 flex items-center justify-between bg-blue-950/20 -mx-4 -mb-4 p-3 rounded-b-2xl border-t border-blue-500/20">
              <span className="text-xs font-black uppercase text-blue-300">Net Revenue</span>
              <span className="text-base font-black text-blue-400">{formatCurrency(finSummary.salesSummary.netRevenue)}</span>
            </div>
          </div>

          {/* Tier 2: Payment Breakdown */}
          <div className="bg-gray-950 border border-purple-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">2. Payment Breakdown</span>
                <span className="text-[9px] font-bold text-gray-500">Net: {formatCurrency(finSummary.paymentBreakdown.total)}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>Cash:</span>
                  <span className="font-black text-white">{formatCurrency(finSummary.paymentBreakdown.cash)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>Online:</span>
                  <span className="font-black text-white">{formatCurrency(finSummary.paymentBreakdown.online)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block"></span>Card:</span>
                  <span className="font-black text-white">{formatCurrency(finSummary.paymentBreakdown.card)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-gray-800 flex items-center justify-between bg-purple-950/20 -mx-4 -mb-4 p-3 rounded-b-2xl border-t border-purple-500/20">
              <span className="text-xs font-black uppercase text-purple-300">Total Payments</span>
              <span className="text-base font-black text-purple-400">{formatCurrency(finSummary.paymentBreakdown.total)}</span>
            </div>
          </div>

          {/* Tier 3: Deductions / Adjustments */}
          <div className="bg-gray-950 border border-red-500/20 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">3. Deductions & Adjustments</span>
                <span className="text-[9px] font-bold text-red-400">-{formatCurrency(finSummary.deductions.totalReturns + finSummary.deductions.generalEntries)}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Cash Returns:</span>
                  <span className="font-bold text-red-400">-{formatCurrency(finSummary.deductions.cashReturns)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Online Returns:</span>
                  <span className="font-bold text-red-400">-{formatCurrency(finSummary.deductions.onlineReturns)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Card Returns:</span>
                  <span className="font-bold text-gray-500">{finSummary.deductions.cardReturns > 0 ? `-${formatCurrency(finSummary.deductions.cardReturns)}` : '₨0'}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-800/60">
                  <span className="text-gray-400">General Entries:</span>
                  <span className="font-bold text-orange-400">-{formatCurrency(finSummary.deductions.generalEntries)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between bg-red-950/20 -mx-4 -mb-4 p-3 rounded-b-2xl border-t border-red-500/20">
              <span className="text-xs font-black uppercase text-red-300">Total Deductions</span>
              <span className="text-base font-black text-red-400">-{formatCurrency(finSummary.deductions.totalReturns + finSummary.deductions.generalEntries)}</span>
            </div>
          </div>

          {/* Tier 4: Final Position */}
          <div className="bg-gradient-to-br from-emerald-950/80 to-gray-950 border-2 border-emerald-500/50 rounded-2xl p-4 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div>
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-800/40">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">4. Final Position</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">Authoritative</span>
              </div>
              <div className="mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Available Cash</p>
                <p className="text-2xl font-black text-emerald-400 tracking-tight mt-0.5">{formatCurrency(finSummary.finalPosition.availableCash)}</p>
              </div>
              <div className="space-y-1.5 text-xs pt-2 border-t border-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Available Online:</span>
                  <span className="font-bold text-blue-300">{formatCurrency(finSummary.finalPosition.availableOnline)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Available Card:</span>
                  <span className="font-bold text-purple-300">{formatCurrency(finSummary.finalPosition.availableCard)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-gray-500 italic">
              * Cash − Cash Returns − General Entries
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {filterTabs.map(tab => {
          const isActive = historyFilter === tab.key;
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setHistoryFilter(tab.key)}
              className={`font-bold px-3 py-2.5 rounded-xl text-[10px] flex items-center gap-1 border transition-all ${isActive ? `${tab.activeBg} text-white ${tab.activeBorder}` : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
              <Icon size={14} />{tab.label}{tab.badge > 0 ? ` (${tab.badge})` : ''}
            </button>
          );
        })}
        {historyFilter === 'balance' && totalBPCollected > 0 && (
          <span className="ml-auto text-[10px] font-bold text-cyan-400">{formatCurrency(totalBPCollected)} collected</span>
        )}
        {historyFilter === 'general' && totalGE > 0 && (
          <span className="ml-auto text-[10px] font-bold text-red-400">-{formatCurrency(totalGE)} expenses</span>
        )}
      </div>

      <div className="space-y-2">
        {anyLoading && unifiedTimeline.length === 0 && (
          <div className="py-10 flex justify-center"><BarChart3 className="animate-spin text-blue-500" size={24} /></div>
        )}
        {!anyLoading && unifiedTimeline.length === 0 && (
          <p className="text-center text-gray-500 py-8 font-bold">
            {receiptSearch ? 'No invoices match your search' : historyFilter === 'general' ? 'No general entries in this period' : historyFilter === 'balance' ? 'No balance payments in this period' : 'No transactions yet'}
          </p>
        )}

        {unifiedTimeline.map(item => {
          if (item._type === 'sale') {
            const s = item._data;
            return (
              <div key={`sale-${s.id}`} className="bg-gray-800/60 rounded-2xl border border-gray-700/50 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-lg font-black text-white">
                      {s._invoiceNumber || s.receiptNumber || s.orderNumber || s.receiptNumber}
                      {s.orderId && <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full ml-1">ORDER</span>}
                      {s._invoiceNumber && <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">INV</span>}
                    </p>
                    <p className="text-xs text-gray-500 font-bold">{formatDateTime(s.createdAt)} &bull; {s.outletName}</p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const refundTotal = (s.returns || []).reduce((sum, r) => sum + r.refundAmount, 0);
                      const netAmount = s.grandTotal - refundTotal;
                      const hasReturn = refundTotal > 0;
                      const amountReceived = s._amountReceived || s.grandTotal;
                      const outstanding = s._outstandingBalance || 0;
                      return (
                        <>
                          {s._amountReceived != null && s._amountReceived !== s.grandTotal && (
                            <>
                              <p className="text-xs text-emerald-400 font-bold">Recv: {formatCurrency(amountReceived)}</p>
                              {outstanding > 0.01 && <p className="text-[10px] text-amber-400 font-bold">Bal: {formatCurrency(outstanding)}</p>}
                            </>
                          )}
                          <p className={`text-lg font-black ${hasReturn ? 'text-gray-500 line-through' : 'text-emerald-400'}`}>{formatCurrency(netAmount)}</p>
                          {hasReturn && <p className="text-[9px] text-red-400 font-bold">Returned: {formatCurrency(refundTotal)}</p>}
                          <p className="text-[10px] text-gray-500 font-bold">{formatPaymentMethod(s.paymentMethod)}</p>
                          {s.paymentMethod === 'CASH_ONLINE' && (
                            <p className="text-[9px] text-purple-400 font-bold">Cash: {formatCurrency(s.cashAmount || 0)} | Online: {formatCurrency(s.onlineAmount || 0)}</p>
                          )}
                          {s._balanceStatus === 'balance' && <span className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block">BAL</span>}
                          {s._balanceStatus === 'paid' && s.advanceAmount > 0 && <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block">PAID</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(s.items || []).map((item, idx) => (
                    <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${item.isExchange ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-900 text-gray-400'}`}>
                      {item.isExchange ? '🔄 ' : ''}
                      {item.productName}{item.color ? ` (${isUrdu ? toUrduName(item.color) : item.color})` : ''}{item.size ? ` / ${item.size}` : ''} x{item.quantity} = {formatCurrency(item.lineTotal)}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>Cashier: {s.cashierName || 'N/A'} {s.customerName ? `| ${s.customerName}` : ''} {s.customerPhone ? `(${s.customerPhone})` : ''}</span>
                  <div className="flex items-center gap-1">
                    {!s.refundedAt && !s.faisalTake && (
                      <button onClick={() => handleRefundInvoiceFromHistory(s)}
                        className="text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-xl"><RotateCcw size={12} className="inline mr-1" />Refund</button>
                    )}
                    {s.refundedAt && <span className="text-[10px] font-bold text-red-500 mr-2">Refunded</span>}
                    <button onClick={() => { setPendingPrintSale(s); setPrintOpts({ invoice: true, gatePass: true }); setShowPrintOptions(true); }} className="text-purple-400 hover:text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-xl"><Printer size={12} className="inline mr-1" />Reprint</button>
                  </div>
                </div>
              </div>
            );
          }

          if (item._type === 'balance_payment') {
            const bp = item._data;
            return (
              <div key={`bp-${bp.id}`} className="bg-gray-800/60 rounded-2xl border border-cyan-800/40 p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-lg font-black text-white flex items-center gap-2">
                      <span className="text-cyan-400"><CreditCard size={16} /></span>
                      {bp.receiptNumber || 'Balance Payment'}
                      <span className="text-[9px] bg-cyan-600 text-white px-2 py-0.5 rounded-full">BALANCE CLEARED</span>
                    </p>
                    {bp.originalInvoiceNumber && (
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">Original Invoice: {bp.originalInvoiceNumber} {bp.posSale?.receiptNumber && bp.posSale.receiptNumber !== bp.originalInvoiceNumber ? `• POS: ${bp.posSale.receiptNumber}` : ''}</p>
                    )}
                    <p className="text-xs text-gray-500 font-bold">{formatDateTime(bp.paidAt || bp.createdAt)} &bull; {bp.posSale?.outletName || selectedOutlet}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-cyan-400">+{formatCurrency(bp.amountPaidNow)}</p>
                    <p className="text-[10px] text-gray-500 font-bold">{formatPaymentMethod(bp.paymentMethod)}</p>
                    {bp.paymentMethod === 'CASH_ONLINE' && (
                      <p className="text-[9px] text-cyan-300 font-bold">Cash: {formatCurrency(bp.cashAmount ?? Math.round((bp.amountPaidNow || 0) / 2))} | Online: {formatCurrency(bp.onlineAmount ?? Math.round((bp.amountPaidNow || 0) / 2))}</p>
                    )}
                    {bp.outstandingBalanceAfterPayment > 0.01 && (
                      <p className="text-[9px] text-amber-400 font-bold">Remaining: {formatCurrency(bp.outstandingBalanceAfterPayment)}</p>
                    )}
                    {bp.outstandingBalanceAfterPayment <= 0.01 && (
                      <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block">FULLY PAID</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold mt-2">
                  <span>Customer: {bp.posSale?.customerName || 'N/A'} {bp.posSale?.customerPhone ? `(${bp.posSale.customerPhone})` : ''} {bp.cashierName ? `| Cashier: ${bp.cashierName}` : ''}</span>
                  <div className="flex items-center gap-1">
                    {bp.originalInvoiceTotal > 0 && (
                      <span className="text-[10px] mr-1">Invoice: {formatCurrency(bp.originalInvoiceTotal)} | Paid: {formatCurrency((bp.previouslyPaidAmount || 0) + bp.amountPaidNow)}</span>
                    )}
                    <button onClick={() => printBalanceReceipt(bp, bp.posSale)} className="text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded-xl"><Printer size={12} className="inline mr-1" />Print Invoice</button>
                    <button onClick={() => printBalanceGatePass(bp, bp.posSale)} className="text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl"><Printer size={12} className="inline mr-1" />Gate Pass</button>
                  </div>
                </div>
              </div>
            );
          }

          if (item._type === 'general_entry') {
            const ge = item._data;
            return (
              <div key={`ge-${ge.id}`} className="bg-gray-800/60 rounded-2xl border border-orange-800/40 p-4">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-lg font-black text-white flex items-center gap-2">
                      <span className="text-orange-400"><FileText size={16} /></span>
                      {ge.expenseTitle || 'General Entry'}
                      <span className="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded-full">EXPENSE</span>
                    </p>
                    <p className="text-xs text-gray-500 font-bold">{formatDateTime(ge.createdAt)} &bull; {ge.employeeName || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-red-400">-{formatCurrency(ge.amount)}</p>
                    <p className="text-[10px] text-gray-500 font-bold">GENERAL ENTRY</p>
                  </div>
                </div>
                {ge.notes && (
                  <p className="text-[10px] text-gray-400 font-bold mt-1">{ge.notes}</p>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default POSHistory;
