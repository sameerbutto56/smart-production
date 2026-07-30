import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, X, User, Phone } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';

const WarehousePOSCart = () => {
  const {
    cart, cartSummary, set, removeFromCart, clearCart,
    customerName, customerPhone, discountPct, discountFixed, paymentMethod,
    cashAmount, onlineAmount, formatCurrency,
  } = useWarehousePOS();

  return (
    <div className="w-96 flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 flex-shrink-0 bg-gray-900/95">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <ShoppingCart size={14} /> Cart ({cartSummary.itemCount})
        </h3>
        {cart.length > 0 && (
          <button onClick={clearCart} className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1">
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <ShoppingCart size={32} className="mb-2 opacity-30" />
            <span className="text-xs">Cart is empty</span>
            <span className="text-[10px]">Scan or click products to add</span>
          </div>
        ) : (
          cart.map((item, idx) => (
            <CartItem key={`${item.barcode}-${idx}`} item={item} idx={idx} />
          ))
        )}
      </div>

      {/* Summary + Checkout */}
      {cart.length > 0 && (
        <div className="border-t border-gray-800 flex-shrink-0 bg-gray-900/95">
          {/* Customer fields */}
          <div className="px-3 pt-2 space-y-1.5">
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1.5">
              <User size={12} className="text-gray-500" />
              <input value={customerName} onChange={e => set('customerName', e.target.value)}
                placeholder="Customer name (opt)" className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none" />
            </div>
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1.5">
              <Phone size={12} className="text-gray-500" />
              <input value={customerPhone} onChange={e => set('customerPhone', e.target.value)}
                placeholder="Phone (opt)" className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none" />
            </div>
          </div>

          {/* Discount inputs */}
          <div className="px-3 pt-2 flex gap-2">
            <input type="number" min="0" max="100" value={discountPct} onChange={e => set('discountPct', parseFloat(e.target.value) || 0)}
              placeholder="Disc %" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white text-center placeholder-gray-600 outline-none" />
            <input type="number" min="0" value={discountFixed} onChange={e => set('discountFixed', parseFloat(e.target.value) || 0)}
              placeholder="Disc ₨" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[10px] text-white text-center placeholder-gray-600 outline-none" />
          </div>

          {/* Totals */}
          <div className="px-3 pt-2 pb-1.5 space-y-1">
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Subtotal ({cartSummary.itemCount} items)</span>
              <span>{formatCurrency(cartSummary.subtotal)}</span>
            </div>
            {cartSummary.discountAmount > 0 && (
              <div className="flex justify-between text-[11px] text-emerald-400">
                <span>Discount</span>
                <span>-{formatCurrency(cartSummary.discountAmount)}</span>
              </div>
            )}
          </div>

          {/* Grand total + checkout */}
          <div className="px-3 pb-3">
            <div className="flex justify-between text-sm font-bold text-white mb-2">
              <span>Grand Total</span>
              <span className="text-emerald-400">{formatCurrency(cartSummary.grandTotal)}</span>
            </div>
            <button onClick={() => set('showCheckout', true)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CartItem = React.memo(({ item, idx }) => {
  const { isUrdu } = useLanguage();
  const { set, removeFromCart, formatCurrency } = useWarehousePOS();

  return (
    <div className="bg-gray-800/70 rounded-lg p-2.5 border border-gray-700/50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">{item.name}</div>
          <div className="text-[10px] text-gray-400">
            {(isUrdu ? toUrduName(item.color) : item.color) || ''}{(item.color && item.size) ? ' / ' : ''}{item.size || ''}
            {item.barcode && <span className="text-gray-600 ml-1">| {item.barcode}</span>}
          </div>
        </div>
        <button onClick={() => removeFromCart(idx)} className="text-gray-600 hover:text-red-400 p-0.5">
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <button onClick={() => set('cart', prev => prev.map((c, i) => i === idx ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
          className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Minus size={10} /></button>
        <span className="text-xs font-bold text-white w-6 text-center">{item.quantity}</span>
        <button onClick={() => set('cart', prev => prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c))}
          className="p-1 rounded bg-gray-700 text-gray-400 hover:text-white"><Plus size={10} /></button>
        <span className="text-xs font-bold text-white ml-auto">{formatCurrency((item.unitPrice || 0) * item.quantity)}</span>
      </div>
    </div>
  );
});

const PaymentMethodBtn = React.memo(({ method, current, onClick }) => {
  const labels = { COD: 'COD', ONLINE: 'Online Paid' };
  const colors = {
    COD: 'border-emerald-500 bg-emerald-600/20 text-emerald-300',
    ONLINE: 'border-blue-500 bg-blue-600/20 text-blue-300',
  };
  return (
    <button onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-[10px] font-bold border-2 ${current === method ? colors[method] : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
      {labels[method]}
    </button>
  );
});

export default WarehousePOSCart;
