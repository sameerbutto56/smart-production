import React from 'react';
import { Printer, X, DollarSign, CreditCard, Landmark, Wallet } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';

const WarehousePOSModals = () => {
  const {
    showCheckout, set, checkoutLoading, cartSummary, formatCurrency,
    paymentMethod, cashAmount, onlineAmount, customerName, customerPhone,
    discountPct, discountFixed, cart, handleCheckout,
    lastSale, showPrintOptions, set: setState, printReceipt, pendingPrintSale,
  } = useWarehousePOS();

  return (
    <>
      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => set('showCheckout', false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-96 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">Checkout</h3>
              <button onClick={() => set('showCheckout', false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>

            {/* Customer */}
            <div className="space-y-2 mb-4">
              <input value={customerName} onChange={e => set('customerName', e.target.value)} placeholder="Customer name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500" />
              <input value={customerPhone} onChange={e => set('customerPhone', e.target.value)} placeholder="Phone"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500" />
            </div>

            {/* Order summary */}
            <div className="border-t border-gray-700 pt-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Items ({cartSummary.itemCount})</span>
                <span>{formatCurrency(cartSummary.subtotal)}</span>
              </div>
              {cartSummary.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(cartSummary.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-gray-700">
                <span>Grand Total</span>
                <span className="text-emerald-400">{formatCurrency(cartSummary.grandTotal)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Payment Method</label>
              <div className="flex gap-2">
                {['CASH', 'CARD', 'ONLINE', 'CASH_ONLINE'].map(m => {
                  const labels = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Online', CASH_ONLINE: 'Cash+Online' };
                  const colors = {
                    CASH: 'border-emerald-500 bg-emerald-600/20 text-emerald-300',
                    CARD: 'border-purple-500 bg-purple-600/20 text-purple-300',
                    ONLINE: 'border-blue-500 bg-blue-600/20 text-blue-300',
                    CASH_ONLINE: 'border-amber-500 bg-amber-600/20 text-amber-300',
                  };
                  return (
                    <button key={m} onClick={() => set('paymentMethod', m)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold border-2 ${paymentMethod === m ? colors[m] : 'border-gray-700 text-gray-500'}`}>
                      {labels[m]}
                    </button>
                  );
                })}
              </div>
              {paymentMethod === 'CASH_ONLINE' && (
                <div className="flex gap-2 mt-2">
                  <input type="number" value={cashAmount} onChange={e => set('cashAmount', parseFloat(e.target.value) || 0)}
                    placeholder="Cash" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none" />
                  <input type="number" value={onlineAmount} onChange={e => set('onlineAmount', parseFloat(e.target.value) || 0)}
                    placeholder="Online" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none" />
                </div>
              )}
            </div>

            {/* Cart items preview */}
            <div className="max-h-32 overflow-y-auto mb-4 space-y-1">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-[10px] text-gray-400">
                  <span>{item.name} {item.color ? `(${item.color})` : ''} {item.size ? `/ ${item.size}` : ''} × {item.quantity}</span>
                  <span>{formatCurrency((item.unitPrice || 0) * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => set('showCheckout', false)} className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-700">Cancel</button>
              <button onClick={handleCheckout} disabled={checkoutLoading}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                {checkoutLoading ? 'Processing...' : `Pay ${formatCurrency(cartSummary.grandTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal / Print Options */}
      {showPrintOptions && lastSale && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { set('showPrintOptions', false); set('lastSale', null); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-emerald-400 mb-3">✓ Sale Completed</h3>
            <div className="text-xs text-gray-400 mb-4 space-y-1">
              <div>Receipt: <span className="text-white font-bold">{lastSale.receiptNumber}</span></div>
              <div>Total: <span className="text-emerald-400 font-bold">{formatCurrency(lastSale.grandTotal)}</span></div>
              <div>Payment: {lastSale.paymentMethod}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { printReceipt(lastSale); set('showPrintOptions', false); set('lastSale', null); }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                <Printer size={12} /> Print Receipt
              </button>
              <button onClick={() => { set('showPrintOptions', false); set('lastSale', null); }}
                className="flex-1 py-2.5 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WarehousePOSModals;
