import React, { useEffect, useState } from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency, formatPaymentMethod } from '../utils/POSPrint';
import api from '../services/api';
import { Clock, ShoppingCart, BarChart3, Search, Download, Printer, RotateCcw, FileText } from 'lucide-react';

const POSHistory = () => {
  const { isUrdu } = useLanguage();
  const {
    salesRange, setSalesRange, salesDateFrom, setSalesDateFrom, salesDateTo, setSalesDateTo,
    receiptSearch, setReceiptSearch, sales, filteredSales,
    handleRefundInvoiceFromHistory, downloadExcel,
    setPendingPrintSale, setPrintOpts, setShowPrintOptions, setTab, selectedOutlet,
  } = usePOS();

  const [generalEntries, setGeneralEntries] = useState([]);
  const [geLoading, setGeLoading] = useState(false);
  const [showGE, setShowGE] = useState(false);

  useEffect(() => {
    if (showGE) {
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
    }
  }, [showGE, selectedOutlet, salesRange, salesDateFrom, salesDateTo]);

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={receiptSearch} onChange={e => setReceiptSearch(e.target.value)} placeholder="Search by bill / receipt number..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-purple-500 outline-none" />
        </div>
        <button onClick={downloadExcel} className="bg-green-700 hover:bg-green-600 text-white font-bold px-3 py-2.5 rounded-xl text-[10px] flex items-center gap-1"><Download size={14} />Excel</button>
        <button onClick={() => setShowGE(!showGE)} className={`font-bold px-3 py-2.5 rounded-xl text-[10px] flex items-center gap-1 border ${showGE ? 'bg-orange-700 text-white border-orange-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}>
          <FileText size={14} />General
        </button>
      </div>

      {/* General Entries Section */}
      {showGE && (
        <div className="bg-gray-800/60 rounded-2xl border border-orange-800/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-orange-400 flex items-center gap-1.5"><FileText size={14} />General Entries</h3>
            <span className="text-[10px] text-gray-500">{geLoading ? 'Loading...' : `${generalEntries.length} entries`}</span>
          </div>
          {geLoading ? (
            <p className="text-center text-gray-500 font-bold py-4 text-xs">Loading general entries...</p>
          ) : generalEntries.length === 0 ? (
            <p className="text-center text-gray-500 font-bold py-4 text-xs">No general entries in this period</p>
          ) : (
            <div className="space-y-2">
              {generalEntries.map((ge, idx) => (
                <div key={ge.id || idx} className="bg-gray-900 rounded-lg p-3 border border-gray-700/50 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white">{ge.expenseTitle}</p>
                      <p className="text-[10px] text-gray-400">{ge.employeeName} &bull; {ge.notes || ''}</p>
                    </div>
                    <span className="font-bold text-red-400">-{formatCurrency(ge.amount)}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(ge.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filteredSales.length === 0 && <p className="text-center text-gray-500 py-8 font-bold">{receiptSearch ? 'No sales match your search' : 'No sales yet'}</p>}
        {filteredSales.map(s => (
          <div key={s.id} className="bg-gray-800/60 rounded-2xl border border-gray-700/50 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-lg font-black text-white">
                  {s._invoiceNumber || s.receiptNumber || s.orderNumber || s.receiptNumber}
                  {s.orderId && <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full ml-1">ORDER</span>}
                  {s._invoiceNumber && <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">INV</span>}
                </p>
                <p className="text-xs text-gray-500 font-bold">{new Date(s.createdAt).toLocaleString()} &bull; {s.outletName}</p>
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
                  {isUrdu ? toUrduName(item.productName) : item.productName}{item.color ? ` (${isUrdu ? toUrduName(item.color) : item.color})` : ''}{item.size ? ` / ${item.size}` : ''} x{item.quantity} = {formatCurrency(item.lineTotal)}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
              <span>Cashier: {s.cashierName || 'N/A'} {s.customerName ? `| ${s.customerName}` : ''}</span>
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
        ))}
      </div>
    </div>
  );
};

export default POSHistory;
