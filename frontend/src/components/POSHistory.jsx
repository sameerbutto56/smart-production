import React from 'react';
import { usePOS } from '../context/POSContext';
import { formatCurrency, formatPaymentMethod } from '../utils/POSPrint';
import { Clock, ShoppingCart, BarChart3, Search, Download, Printer, RotateCcw, DollarSign, CreditCard, Globe } from 'lucide-react';

const POSHistory = () => {
  const { salesRange, setSalesRange, salesDateFrom, setSalesDateFrom, salesDateTo, setSalesDateTo,
    receiptSearch, setReceiptSearch, sales, filteredSales,
    handleRefundInvoiceFromHistory, downloadExcel,
    setPendingPrintSale, setPrintOpts, setShowPrintOptions, setTab } = usePOS();

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
      </div>
      <div className="space-y-2">
        {filteredSales.length === 0 && <p className="text-center text-gray-500 py-8 font-bold">{receiptSearch ? 'No sales match your search' : 'No sales yet'}</p>}
        {filteredSales.map(s => (
          <div key={s.id} className="bg-gray-800/60 rounded-2xl border border-gray-700/50 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-lg font-black text-white">{s.receiptNumber} {s.orderId && <span className="text-[9px] bg-purple-600 text-white px-2 py-0.5 rounded-full ml-1">ORDER</span>}</p>
                <p className="text-xs text-gray-500 font-bold">{new Date(s.createdAt).toLocaleString()} &bull; {s.outletName}</p>
              </div>
              <div className="text-right">
                {(() => {
                  const refundTotal = (s.returns || []).reduce((sum, r) => sum + r.refundAmount, 0);
                  const netAmount = s.grandTotal - refundTotal;
                  const hasReturn = refundTotal > 0;
                  return (
                    <>
                      <p className="text-lg font-black text-emerald-400">{formatCurrency(netAmount)}</p>
                      {hasReturn && <p className="text-[9px] text-red-400 font-bold line-through opacity-60">{formatCurrency(s.grandTotal)}</p>}
                      <p className="text-[10px] text-gray-500 font-bold">{formatPaymentMethod(s.paymentMethod)}</p>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {(s.items || []).map((item, idx) => (
                <span key={idx} className="text-[10px] font-bold text-gray-400 bg-gray-900 px-2 py-0.5 rounded-lg">
                  {item.productName}{item.color ? ` (${item.color})` : ''}{item.size ? ` / ${item.size}` : ''} x{item.quantity} = {formatCurrency(item.lineTotal)}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
              <span>Cashier: {s.cashierName || 'N/A'} {s.customerName ? `| Customer: ${s.customerName}` : ''}</span>
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
