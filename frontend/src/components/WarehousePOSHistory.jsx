import React, { useState } from 'react';
import { Clock, Printer, RotateCcw, RefreshCw, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';

const WarehousePOSHistory = () => {
  const { isUrdu } = useLanguage();
  const { sales, salesLoading, refreshSales, printReceipt, processRefundInvoice, refundLoading, formatCurrency } = useWarehousePOS();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = sales.filter(s =>
    !searchTerm ||
    (s.receiptNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 h-[calc(100vh-80px)] overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Clock size={16} /> Sales History</h2>
        <div className="flex-1 relative max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search receipt or customer..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500" />
        </div>
        <button onClick={refreshSales} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && !salesLoading && (
          <div className="text-center text-gray-600 py-10 text-sm">No sales found</div>
        )}
        {filtered.map(sale => (
          <div key={sale.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{sale.receiptNumber}</span>
                  {sale.refundedAt ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-900/50 text-red-400">REFUNDED</span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400">COMPLETED</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{new Date(sale.createdAt).toLocaleString()}</div>
                {sale.customerName && <div className="text-[10px] text-gray-400 mt-0.5">{sale.customerName} {sale.customerPhone ? `(${sale.customerPhone})` : ''}</div>}
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">{formatCurrency(sale.grandTotal)}</div>
                <div className="text-[10px] text-gray-500">{sale.paymentMethod}</div>
                <div className="text-[9px] text-gray-600">{sale.cashierName}</div>
              </div>
            </div>

            {/* Item chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(sale.items || []).map(item => (
                <span key={item.id} className="text-[9px] bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full">
                  {item.productName} {item.color ? `(${isUrdu ? toUrduName(item.color) : item.color})` : ''}{item.size ? `/${item.size}` : ''} ×{item.quantity}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/50">
              <button onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gray-700 text-gray-400 hover:text-white flex items-center gap-1">
                {expandedId === sale.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Details
              </button>
              <button onClick={() => printReceipt(sale)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gray-700 text-gray-400 hover:text-white flex items-center gap-1">
                <Printer size={11} /> Print
              </button>
              {!sale.refundedAt && (
                <button onClick={() => processRefundInvoice(sale)} disabled={refundLoading}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-900/50 text-red-400 hover:text-red-300 flex items-center gap-1 disabled:opacity-50">
                  <RotateCcw size={11} /> {refundLoading ? 'Refunding...' : 'Refund Invoice'}
                </button>
              )}
            </div>

            {/* Expanded details */}
            {expandedId === sale.id && (
              <div className="mt-3 space-y-1.5 pt-2 border-t border-gray-700/30">
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div><span className="text-gray-500">Subtotal:</span> <span className="text-white">{formatCurrency(sale.subtotal)}</span></div>
                  <div><span className="text-gray-500">Discount:</span> <span className="text-emerald-400">-{formatCurrency(sale.discountAmount || 0)}</span></div>
                  <div><span className="text-gray-500">Payment:</span> <span className="text-white">{sale.paymentMethod}</span></div>
                  <div><span className="text-gray-500">Cashier:</span> <span className="text-white">{sale.cashierName || '-'}</span></div>
                </div>
                {sale.refundedAt && (
                  <div className="text-[10px] text-red-400 mt-1">Refunded: {new Date(sale.refundedAt).toLocaleString()}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WarehousePOSHistory;
