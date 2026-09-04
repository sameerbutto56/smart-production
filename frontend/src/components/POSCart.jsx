import React from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency } from '../utils/POSPrint';
import { ShoppingCart, Trash2, Minus, Plus, X, RotateCcw, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';

const POSCart = () => {
  const { isUrdu } = useLanguage();
  const {
    cart, setCart, removeCartItem, updateQty, updateCartCustomization, updateCartDiscount, updateCartExchange,
    subtotal, altCharges, cust1Total, cust2Total, engraveTotal, logoDesignTotal, otherChargesTotal,
    perItemDiscount, deliveryCharge, globalDiscountAmt, cardChargesAmt, grandTotal,
    exchangeItemsTotal, newItemsTotal, exchangeDiff,
    discountPct, setDiscountPct, discountFixed, setDiscountFixed,
    paymentMethod, cashAmount, setCashAmount, onlineAmount, setOnlineAmount,
    cardChargesPct,
    faisalTake, setFaisalTake,
    customerName, setCustomerName, customerPhone, setCustomerPhone,
    deliveryEnabled, setDeliveryEnabled,
    advanceAmount, setAdvanceAmount,
    employeeName, setEmployeeName, employeePassword, setEmployeePassword,
    employeeLoggedIn, setEmployeeLoggedIn,
    employees, loginEmployee, orderNumber, setOrderNumber,
    lookedUpOrder, setLookedUpOrder,
    checkoutLoading, handleCheckout,
    createOrderNumber, setCreateOrderNumber,
    createAlterationNumber, setCreateAlterationNumber,
    createEngravingNumber, setCreateEngravingNumber,
    additionalNote, setAdditionalNote,
    setTab,
  } = usePOS();

  return (
    <div className="w-96 bg-gray-900/80 border-l-2 border-gray-800 flex flex-col flex-shrink-0 h-full">
      <div className="p-3 border-b-2 border-gray-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><ShoppingCart size={16} />Cart ({cart.length})</h2>
        {cart.length > 0 && (
          <button onClick={() => { if (window.confirm('Clear cart?')) { setCart([]); setDiscountPct(0); setDiscountFixed(0); } }} className="text-[10px] font-bold text-red-400 hover:text-red-300"><Trash2 size={12} className="inline mr-1" />Clear</button>
        )}
      </div>

      {/* Faisal Take toggle */}
      <div className="px-3 pt-1 pb-0 flex-shrink-0">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => { if (cart.length > 0 && !faisalTake && !window.confirm('Enable Faisal Take? All prices will be set to 0.')) return; setFaisalTake(!faisalTake); }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${faisalTake ? 'bg-amber-500 border-amber-500' : 'border-gray-600 bg-gray-800'}`}>
            {faisalTake && <span className="text-white text-[10px] font-black">✓</span>}
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${faisalTake ? 'text-amber-400' : 'text-gray-600'}`}>
            Faisal Take {faisalTake ? '(ON — prices excluded)' : ''}
          </span>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {cart.map((item, i) => (
          <div key={i} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-2.5">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{item.productName}</p>
                <p className="text-[10px] text-gray-400">{[isUrdu ? toUrduName(item.color) : item.color, item.size].filter(Boolean).join(' \u2022 ') || 'Standard'}</p>
                <p className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(item.unitPrice)} each</p>
              </div>
              <button onClick={() => removeCartItem(i)} className="text-gray-600 hover:text-red-400 ml-1"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center bg-gray-900 rounded-lg border border-gray-700">
                <button onClick={() => updateQty(i, item.qty - 1)} className="p-1.5 hover:text-white text-gray-500"><Minus size={12} /></button>
                <span className="px-2 text-xs font-bold text-white min-w-[20px] text-center">{item.qty}</span>
                <button onClick={() => updateQty(i, item.qty + 1)} className="p-1.5 hover:text-white text-gray-500"><Plus size={12} /></button>
              </div>
               <span className="text-xs font-black text-white ml-auto">{formatCurrency(item.unitPrice * item.qty + ((item.customization1 ? 500 : 0) + (item.customization2 ? 1000 : 0) + (item.nameEngrave ? 300 : 0) + (item.logoDesign ? 300 : 0)) * item.qty + (parseFloat(item.otherCharges) || 0))}</span>
            </div>

            <div className="flex flex-wrap gap-1 mt-1.5">
              <button onClick={() => updateCartCustomization(i, 'customization1')}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${item.customization1 ? 'border-purple-500 bg-purple-600/20 text-purple-300' : 'border-gray-700 text-gray-500'}`}>
                Custom 1 (+₨500)
              </button>
              <button onClick={() => updateCartCustomization(i, 'customization2')}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${item.customization2 ? 'border-purple-500 bg-purple-600/20 text-purple-300' : 'border-gray-700 text-gray-500'}`}>
                Custom 2 (+₨1000)
              </button>
              <button onClick={() => updateCartCustomization(i, 'nameEngrave')}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${item.nameEngrave ? 'border-purple-500 bg-purple-600/20 text-purple-300' : 'border-gray-700 text-gray-500'}`}>
                Name Engrave (+₨300)
              </button>
              <button onClick={() => updateCartCustomization(i, 'logoDesign')}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold border ${item.logoDesign ? 'border-purple-500 bg-purple-600/20 text-purple-300' : 'border-gray-700 text-gray-500'}`}>
                Logo Design (+₨300)
              </button>
            </div>
            {item.nameEngrave && (
              <div className="mt-1.5 flex items-center gap-1.5 bg-purple-950/30 border border-purple-800/40 rounded-lg p-1.5">
                <span className="text-[10px] font-black text-purple-400 whitespace-nowrap">Engrave Text:</span>
                <input
                  type="text"
                  placeholder="Enter name/text to engrave..."
                  value={item.engravingText || ''}
                  onChange={e => updateCartCustomization(i, 'engravingText', e.target.value)}
                  className="flex-1 bg-gray-900 border border-purple-700/60 rounded px-2 py-0.5 text-[10px] font-medium text-white focus:border-purple-400 outline-none"
                />
              </div>
            )}
            <div className="mt-1.5">
              <button onClick={() => updateCartExchange(i)}
                className={`w-full px-2 py-1 rounded-lg text-[9px] font-bold border ${item.isExchange ? 'border-amber-500 bg-amber-600/20 text-amber-300' : 'border-gray-700 text-gray-500'}`}>
                {item.isExchange ? '🔄 Exchange/Return — Stock will be added back' : 'Mark as Exchange/Return'}
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-orange-400">Other Charges ₨</span>
              <input type="number" value={item.otherCharges || 0} onChange={e => updateCartDiscount(i, 'otherCharges', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white text-center focus:border-orange-500 outline-none" min="0" />
            </div>
            <div className="mt-1.5 flex gap-1 items-center">
              <span className="text-[10px] font-bold text-blue-400">%</span>
              <input type="number" value={item.discountPct || 0} onChange={e => updateCartDiscount(i, 'discountPct', Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                className="w-14 bg-gray-900 border border-gray-700 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white text-center focus:border-blue-500 outline-none" min="0" max="100" />
              <span className="text-[10px] font-bold text-blue-400">₨</span>
              <input type="number" value={item.discountFixed || 0} onChange={e => updateCartDiscount(i, 'discountFixed', Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white text-center focus:border-blue-500 outline-none" min="0" />
            </div>
          </div>
        ))}
        {cart.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-sm font-bold text-gray-600">Cart is empty</p>
            <p className="text-[10px] text-gray-700 font-bold">Scan barcode or select products</p>
          </div>
        )}
        {/* Cart Summary — inside scrollable area */}
        <div className="border-t-2 border-gray-800 pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {altCharges > 0 && (
            <div className="flex items-center justify-between text-xs text-amber-400">
              <span>Alteration</span>
              <span>{formatCurrency(altCharges)}</span>
            </div>
          )}
          {cust1Total > 0 && (
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Customization 1</span>
              <span>{formatCurrency(cust1Total)}</span>
            </div>
          )}
          {cust2Total > 0 && (
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Customization 2</span>
              <span>{formatCurrency(cust2Total)}</span>
            </div>
          )}
          {engraveTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Name Engraving</span>
              <span>{formatCurrency(engraveTotal)}</span>
            </div>
          )}
          {logoDesignTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Logo Design</span>
              <span>{formatCurrency(logoDesignTotal)}</span>
            </div>
          )}
          {otherChargesTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-orange-400">
              <span>Other Charges</span>
              <span>{formatCurrency(otherChargesTotal)}</span>
            </div>
          )}
          {perItemDiscount > 0 && (
            <div className="flex items-center justify-between text-xs text-blue-400">
              <span>Item Discounts</span>
              <span>-{formatCurrency(perItemDiscount)}</span>
            </div>
          )}
          {deliveryCharge > 0 && (
            <div className="flex items-center justify-between text-xs text-orange-400">
              <span>Delivery Charges</span>
              <span>{formatCurrency(deliveryCharge)}</span>
            </div>
          )}
          {cart.some(i => i.isExchange) && (
            <div className="bg-amber-900/10 border border-amber-800/50 rounded-xl px-3 py-2 space-y-1">
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Exchange Summary</p>
              <div className="flex justify-between text-xs"><span className="text-red-400">Returning Items</span><span className="text-red-400">{formatCurrency(exchangeItemsTotal)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-emerald-400">New Items</span><span className="text-emerald-400">{formatCurrency(newItemsTotal)}</span></div>
              <div className="flex justify-between text-xs font-black border-t border-amber-800/50 pt-1">
                <span className="text-white">Difference</span>
                <span className={exchangeDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {exchangeDiff >= 0 ? `Customer Pays ${formatCurrency(exchangeDiff)}` : `Refund ${formatCurrency(Math.abs(exchangeDiff))}`}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="number" value={discountPct} onChange={e => setDiscountPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              className="w-14 bg-gray-800 border border-gray-700 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white text-center focus:border-blue-500 outline-none" min="0" max="100" />
            <span className="text-[10px] text-gray-500">%</span>
            <input type="number" value={discountFixed} onChange={e => setDiscountFixed(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-1.5 py-1 text-[10px] font-bold text-white text-center focus:border-blue-500 outline-none" min="0" />
            <span className="text-[10px] text-gray-500">fix: -{formatCurrency(globalDiscountAmt)}</span>
          </div>
          {paymentMethod === 'CARD' && cardChargesAmt > 0 && (
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Card Charges ({cardChargesPct}%)</span>
              <span>+{formatCurrency(cardChargesAmt)}</span>
            </div>
          )}
          {paymentMethod === 'CASH_ONLINE' && (
            <div className="bg-amber-900/10 border border-amber-800/50 rounded-xl px-3 py-2 space-y-2">
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Split Payment</p>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400">Cash Amount</label>
                <input type="number" value={cashAmount} onChange={e => { const c = Math.max(0, parseFloat(e.target.value) || 0); setCashAmount(c); setOnlineAmount(Math.max(0, Math.round((grandTotal - c) * 100) / 100)); }}
                  className="w-28 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-right focus:border-amber-500 outline-none" min="0" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-400">Online Amount</label>
                <input type="number" value={onlineAmount} onChange={e => { const o = Math.max(0, parseFloat(e.target.value) || 0); setOnlineAmount(o); setCashAmount(Math.max(0, Math.round((grandTotal - o) * 100) / 100)); }}
                  className="w-28 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-right focus:border-amber-500 outline-none" min="0" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-black border-t border-amber-800/50 pt-1.5">
                <span className="text-gray-400">Total</span>
                <span className="text-emerald-400">
                  {formatCurrency((parseFloat(cashAmount) || 0) + (parseFloat(onlineAmount) || 0))} / {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          )}
          <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)"
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Customer phone *required"
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          <label className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={deliveryEnabled} onChange={e => setDeliveryEnabled(e.target.checked)}
              className="accent-orange-500 w-4 h-4" />
            <span className="text-[10px] font-bold text-orange-400">Delivery (+₨250)</span>
          </label>
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
            <label className="text-[10px] font-bold text-gray-400">Advance ₨</label>
            <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-24 bg-transparent border-b border-gray-600 px-1 py-1 text-xs font-bold text-white text-right focus:border-blue-500 outline-none" min="0" />
          </div>
          <div className={`rounded-lg px-3 py-2 space-y-2 ${employeeLoggedIn ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-gray-800/50 border border-gray-700'}`}>
            <div className="flex items-center gap-2">
               <select value={employeeName} onChange={e => { setEmployeeName(e.target.value); setEmployeePassword(''); setEmployeeLoggedIn(false); }}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:border-blue-500 outline-none">
                <option value="">Select Employee</option>
                {Object.keys(employees).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="password" value={employeePassword} disabled={!employeeName || employeeLoggedIn}
                onChange={e => setEmployeePassword(e.target.value)} placeholder="Password"
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
              {!employeeLoggedIn ? (
                <button onClick={async () => {
                  if (!employeeName) return toast.error('Select an employee');
                  const r = await loginEmployee(employeeName, employeePassword);
                  if (r.ok) toast.success(r.message); else toast.error(r.message);
                }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px]">Login</button>
              ) : (
                <button onClick={() => { setEmployeeLoggedIn(false); setEmployeeName(''); setEmployeePassword(''); }}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px]">Logout</button>
              )}
            </div>
            {employeeLoggedIn && <p className="text-[10px] font-bold text-emerald-400 text-center">✓ {employeeName} logged in</p>}
          </div>
          <input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Order # or phone — fetch balance"
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
          {lookedUpOrder && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-3 py-2 space-y-1">
              <p className="text-xs font-bold text-blue-300">{lookedUpOrder.customerName} ({lookedUpOrder.customerPhone || 'no phone'})</p>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Total</span>
                <span className="text-white font-bold">{formatCurrency(lookedUpOrder.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-amber-400">Advance</span>
                <span className="text-amber-400 font-bold">-{formatCurrency(lookedUpOrder.advanceAmount)}</span>
              </div>
              <div className="flex justify-between text-xs font-black border-t border-blue-800 pt-1">
                <span className="text-emerald-400">Balance Due</span>
                <span className="text-emerald-400">{formatCurrency(lookedUpOrder.balance)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-sm font-black text-white border-t border-gray-700 pt-2">
            <span>{lookedUpOrder ? 'Current Payment' : 'Grand Total'}</span>
            <span className="text-emerald-400">{formatCurrency(grandTotal)}</span>
          </div>
          {lookedUpOrder && parseFloat(advanceAmount) > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-amber-400">
              <span>Advance (Order)</span>
              <span>{formatCurrency(parseFloat(advanceAmount))}</span>
            </div>
          )}
          {lookedUpOrder && parseFloat(advanceAmount) > 0 && (
            <div className="flex items-center justify-between text-xs font-black border-t border-gray-700 pt-1">
              <span className="text-white">Total Paid</span>
              <span className="text-emerald-400">{formatCurrency(grandTotal + parseFloat(advanceAmount))}</span>
            </div>
          )}
          {!lookedUpOrder && parseFloat(advanceAmount) > 0 && (
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-amber-400">Balance</span>
              <span className="text-amber-400">{formatCurrency(grandTotal - parseFloat(advanceAmount))}</span>
            </div>
          )}
          {!faisalTake && !lookedUpOrder && (
            <label className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-750 border border-gray-700">
              <div onClick={() => setCreateOrderNumber(!createOrderNumber)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${createOrderNumber ? 'bg-blue-500 border-blue-500' : 'border-gray-600 bg-gray-800'}`}>
                {createOrderNumber && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${createOrderNumber ? 'text-blue-400' : 'text-gray-600'}`}>
                Create Order Number
              </span>
            </label>
          )}
          {!faisalTake && !lookedUpOrder && (
            <label className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-750 border border-gray-700">
              <div onClick={() => setCreateAlterationNumber(!createAlterationNumber)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${createAlterationNumber ? 'bg-purple-500 border-purple-500' : 'border-gray-600 bg-gray-800'}`}>
                {createAlterationNumber && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${createAlterationNumber ? 'text-purple-400' : 'text-gray-600'}`}>
                Create Alteration Number
              </span>
            </label>
          )}
          {!faisalTake && !lookedUpOrder && (
            <label className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2 cursor-pointer hover:bg-gray-750 border border-gray-700">
              <div onClick={() => setCreateEngravingNumber(!createEngravingNumber)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${createEngravingNumber ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 bg-gray-800'}`}>
                {createEngravingNumber && <span className="text-white text-[10px] font-black">✓</span>}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${createEngravingNumber ? 'text-cyan-400' : 'text-gray-600'}`}>
                Generate Engraving Number
              </span>
            </label>
          )}
          {!faisalTake && !lookedUpOrder && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Additional Note</label>
              <textarea
                value={additionalNote}
                onChange={(e) => setAdditionalNote(e.target.value)}
                placeholder="Optional note for invoice..."
                rows={2}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-cyan-500 outline-none resize-none"
              />
            </div>
          )}
          <button onClick={handleCheckout} disabled={cart.length === 0 || checkoutLoading || !employeeLoggedIn || !paymentMethod}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 mt-2">
            {checkoutLoading ? 'Processing...' : !employeeLoggedIn ? 'Login Employee First' : !paymentMethod ? 'Select Payment Method' : faisalTake ? 'Record Faisal Take' : lookedUpOrder ? `Pay Balance ${formatCurrency(grandTotal)}` : `Checkout ${formatCurrency(grandTotal)}`}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setTab('dashboard')} className="flex-1 text-[10px] font-bold text-gray-500 hover:text-white bg-gray-800 py-2 rounded-xl text-center flex items-center justify-center gap-1">
              <BarChart3 size={12} />Dashboard
            </button>
            <button onClick={() => setTab('returns')} className="flex-1 text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 py-2 rounded-xl text-center flex items-center justify-center gap-1">
              <RotateCcw size={12} />Returns
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSCart;
