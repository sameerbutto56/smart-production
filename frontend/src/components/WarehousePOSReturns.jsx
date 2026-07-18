import React from 'react';
import { Barcode, Search, RotateCcw, X, Minus, Plus, FileText, RefreshCw } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';

const WarehousePOSReturns = () => {
  const {
    returnTab, set, returnBarcodeInput, returnBarcodeRef, returnCart, returnReason,
    refundPaymentMethod, returnLoading, returnProductSearch,
    invoiceReturnInput, invoiceReturnLoading, lookedUpReturnSale,
    sales, handleReturnBarcode, handleReturnByInvoice, addToReturnCart,
    processReturns, refreshSales, formatCurrency,
  } = useWarehousePOS();

  const tabs = [
    { key: 'barcode', label: 'Scan Barcode', icon: Barcode },
    { key: 'invoice', label: 'By Invoice', icon: FileText },
    { key: 'sales', label: 'From Sales', icon: RotateCcw },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Left: Return methods */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-tabs */}
        <div className="flex gap-1 px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => set('returnTab', t.key)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${returnTab === t.key ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
          <button onClick={refreshSales} className="ml-auto text-xs px-2 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white">
            <RefreshCw size={12} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {returnTab === 'barcode' && (
            <div>
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 mb-4">
                <Barcode size={16} className="text-gray-500" />
                <input ref={returnBarcodeRef} value={returnBarcodeInput} onChange={e => set('returnBarcodeInput', e.target.value)}
                  placeholder="Scan barcode to return..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none" />
              </div>
              <p className="text-[10px] text-gray-600">Scan a product barcode to add it to the return list on the right.</p>
            </div>
          )}

          {returnTab === 'invoice' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <input value={invoiceReturnInput} onChange={e => set('invoiceReturnInput', e.target.value)}
                  placeholder="Enter receipt number..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-blue-500" />
                <button onClick={handleReturnByInvoice} disabled={invoiceReturnLoading}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50">
                  {invoiceReturnLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
              {lookedUpReturnSale && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-3">
                  <div className="text-xs font-bold text-white">{lookedUpReturnSale.receiptNumber}</div>
                  <div className="text-[10px] text-gray-500">{new Date(lookedUpReturnSale.createdAt).toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 mt-1">Total: {formatCurrency(lookedUpReturnSale.grandTotal)} | {lookedUpReturnSale.paymentMethod}</div>
                  <p className="text-[9px] text-gray-600 mt-1">Adjust quantities on the right, then click Return.</p>
                </div>
              )}
            </div>
          )}

          {returnTab === 'sales' && (
            <div className="space-y-2">
              <input value={returnProductSearch} onChange={e => set('returnProductSearch', e.target.value)}
                placeholder="Search sales..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none mb-3" />
              {sales.filter(s => !s.refundedAt).filter(s =>
                !returnProductSearch ||
                s.receiptNumber?.toLowerCase().includes(returnProductSearch.toLowerCase()) ||
                s.items?.some(i => i.productName?.toLowerCase().includes(returnProductSearch.toLowerCase()))
              ).slice(0, 30).map(sale => (
                <div key={sale.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 cursor-pointer hover:border-gray-500"
                  onClick={() => { set('lookedUpReturnSale', sale); set('returnCart', sale.items.map(i => ({ id: i.id, name: i.productName, color: i.color, size: i.size, quantity: i.quantity, qty: 0, maxQty: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal, saleId: sale.id }))); set('returnTab', 'invoice'); }}>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-white">{sale.receiptNumber}</span>
                    <span className="text-xs text-emerald-400">{formatCurrency(sale.grandTotal)}</span>
                  </div>
                  <div className="text-[10px] text-gray-500">{new Date(sale.createdAt).toLocaleString()}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sale.items.map(item => (
                      <span key={item.id} className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                        {item.productName} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Return cart */}
      <div className="w-96 flex flex-col bg-gray-900 border-l border-gray-800">
        <div className="px-4 py-2.5 border-b border-gray-800 flex-shrink-0">
          <h3 className="text-xs font-bold text-red-400 flex items-center gap-1.5"><RotateCcw size={14} /> Return Items ({returnCart.filter(r => r.qty > 0).length})</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {returnCart.length === 0 ? (
            <div className="text-center text-gray-600 py-10 text-xs">No items added for return</div>
          ) : (
            returnCart.map((item, idx) => (
              <div key={item.id || idx} className="bg-gray-800/70 rounded-lg p-2.5 border border-gray-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">{item.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {item.color || ''}{item.color && item.size ? ' / ' : ''}{item.size || ''}
                      {item.saleId && <span className="text-gray-600 ml-1">| {item.saleId.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <button onClick={() => set('returnCart', prev => prev.filter((_, i) => i !== idx))}
                    className="text-gray-600 hover:text-red-400 p-0.5"><X size={12} /></button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button onClick={() => set('returnCart', prev => prev.map((r, i) => i === idx ? { ...r, qty: Math.max(0, r.qty - 1) } : r))}
                    className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Minus size={10} /></button>
                  <span className="text-xs font-bold text-white w-6 text-center">{item.qty}</span>
                  <button onClick={() => set('returnCart', prev => prev.map((r, i) => i === idx ? { ...r, qty: Math.min(r.qty + 1, r.maxQty) } : r))}
                    className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Plus size={10} /></button>
                  <span className="text-[10px] text-gray-500 ml-auto">max {item.maxQty}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {returnCart.filter(r => r.qty > 0).length > 0 && (
          <div className="p-3 border-t border-gray-800 flex-shrink-0 space-y-2">
            <input value={returnReason} onChange={e => set('returnReason', e.target.value)} placeholder="Return reason"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none" />
            <div className="flex gap-2">
              {['CASH', 'CARD', 'ONLINE'].map(m => (
                <button key={m} onClick={() => set('refundPaymentMethod', m)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold border ${refundPaymentMethod === m ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                  {m}
                </button>
              ))}
            </div>
            <button onClick={processReturns} disabled={returnLoading}
              className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50">
              {returnLoading ? 'Processing...' : `Return ${returnCart.filter(r => r.qty > 0).length} item(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarehousePOSReturns;
