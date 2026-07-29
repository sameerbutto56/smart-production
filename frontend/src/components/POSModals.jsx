import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../context/POSContext';
import { ShoppingCart, X, Check, Printer, Minus, Plus, CheckCircle2, Book, BookOpen, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { printReceipt, printBalanceReceipt, formatCurrency, formatPaymentMethod } from '../utils/POSPrint';

const POSModals = () => {
  const {
    showConfig, setShowConfig, selectedColor, setSelectedColor,
    selectedSize, setSelectedSize, selectedQty, setSelectedQty,
    products, confirmConfig,
    showCheckout, setShowCheckout, lastSale, setLastSale,
    showPrintOptions, setShowPrintOptions, pendingPrintSale, setPendingPrintSale,
    printOpts, setPrintOpts,
    showPayBalanceModal, setShowPayBalanceModal, selectedBalanceInvoice,
    payAmount, setPayAmount, balancePaymentMethod, setBalancePaymentMethod,
    balanceCashAmount, setBalanceCashAmount, balanceOnlineAmount, setBalanceOnlineAmount,
    paying, handlePayBalance,
    showBalanceHistoryModal, setShowBalanceHistoryModal, balanceHistory,
    showCloseBook, setShowCloseBook, closeBookSummary, summaryLoading,
    transferCashAmount, setTransferCashAmount, closeBookLoading, handleCloseBook,
    bookPrintOpts, setBookPrintOpts,
    showAuthModal, setShowAuthModal, authMode,
    authEmployee, setAuthEmployee, authPassword, setAuthPassword,
    authError, setAuthError, handleOpenBook, handleFetchCloseBookSummary,
    showPaymentDetail, setShowPaymentDetail,
    showEmployeeDetail, setShowEmployeeDetail,
    lastBalancePayment, setLastBalancePayment,
    user, selectedOutlet, employeeName, employees,
    currentBook, verifiedCloser, setVerifiedCloser,
    setCloseBookSummary,
    createOrderNumber, setCreateOrderNumber,
    createAlterationNumber, setCreateAlterationNumber,
    createEngravingNumber, setCreateEngravingNumber,
  } = usePOS();

  const navigate = useNavigate();

  const handlePrint = () => {
    if (!pendingPrintSale) return;
    printReceipt(pendingPrintSale, { includeInvoice: printOpts.invoice, includeGatePass: printOpts.gatePass });
    setShowPrintOptions(false);
    setPendingPrintSale(null);
  };

  const handlePrintBalanceReceipt = () => {
    printBalanceReceipt(lastBalancePayment, selectedBalanceInvoice);
    setLastBalancePayment(null);
  };

  const handleAuth = () => {
    if (!authEmployee) { setAuthError('Select an employee'); return; }
    if (!authPassword) { setAuthError('Enter password'); return; }
    if (employees[authEmployee] !== authPassword) { setAuthError('Wrong password'); return; }
    setAuthError('');
    setShowAuthModal(false);
    if (authMode === 'open') {
      handleOpenBook(authEmployee);
    } else if (authMode === 'close') {
      handleFetchCloseBookSummary(authEmployee);
    }
    setAuthEmployee('');
    setAuthPassword('');
  };

  const handlePrintCloseBook = async (summary) => {
    const { printCloseBook } = await import('../utils/POSPrint');
    printCloseBook(summary, { ...bookPrintOpts, closedBy: verifiedCloser }, currentBook, selectedOutlet, transferCashAmount);
  };

  return (
    <>
      {/* Product Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-10 pb-10 overflow-y-auto" onClick={() => setShowConfig(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4">{showConfig.name}</h3>
            {showConfig.colors?.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-400 block mb-1">Color</label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {showConfig.colors.map(c => {
                    const colorStockTotal = products.filter(v => v.name === showConfig.name && v.color === c).reduce((s, v) => s + (v.stock || 0), 0);
                    const hasColorStock = colorStockTotal > 0;
                    return (
                      <button key={c} onClick={() => { setSelectedColor(c); setSelectedSize(''); }}
                        disabled={!hasColorStock}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${!hasColorStock ? 'border-red-900/40 text-red-500/50 cursor-not-allowed' : selectedColor === c ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        {c} ({colorStockTotal})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showConfig.sizes?.length > 0 && (
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-400 block mb-1">Size</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {showConfig.sizes.map(s => {
                    const sizeStockTotal = selectedColor
                      ? products.filter(v => v.name === showConfig.name && v.color === selectedColor && v.size === s).reduce((acc, v) => acc + (v.stock || 0), 0)
                      : products.filter(v => v.name === showConfig.name && v.size === s).reduce((acc, v) => acc + (v.stock || 0), 0);
                    const hasSizeStock = sizeStockTotal > 0;
                    return (
                      <button key={s} onClick={() => setSelectedSize(s)}
                        disabled={!hasSizeStock}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${!hasSizeStock ? 'border-red-900/40 text-red-500/50 cursor-not-allowed' : selectedSize === s ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                        {s} ({sizeStockTotal})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 block mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))} className="p-2 bg-gray-800 rounded-xl text-white"><Minus size={14} /></button>
                <span className="text-lg font-black text-white min-w-[40px] text-center">{selectedQty}</span>
                <button onClick={() => setSelectedQty(selectedQty + 1)} className="p-2 bg-gray-800 rounded-xl text-white"><Plus size={14} /></button>
              </div>
            </div>
            <button onClick={confirmConfig} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm">
              Add to Cart &bull; {formatCurrency((showConfig.price || 0) * selectedQty)}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Success Modal */}
      {showCheckout && lastSale && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { setShowCheckout(false); setCreateOrderNumber(false); setCreateAlterationNumber(false); setCreateEngravingNumber(false); }}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingCart size={32} className="text-emerald-400" /></div>
            <h3 className="text-xl font-black text-white mb-1">{lastSale.isFaisalTake ? 'Faisal Take' : 'Sale Complete!'}</h3>
            <p className="text-sm font-bold text-gray-400 mb-2">{lastSale.receiptNumber}</p>
            <p className={`text-3xl font-black mb-4 ${lastSale.isFaisalTake ? 'text-red-400' : 'text-emerald-400'}`}>{lastSale.isFaisalTake ? '₨0 — NO CHARGE' : formatCurrency(lastSale.grandTotal)}</p>
            {/* Exchange Summary */}
            {(lastSale.items || []).some(i => i.isExchange) && (
              <div className="bg-amber-900/20 border border-amber-700 rounded-xl px-4 py-3 mb-3 text-left">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Exchange Transaction</p>
                {lastSale.items.filter(i => i.isExchange).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-red-400"><span>Return: {item.productName} x{item.quantity}</span><span>{formatCurrency(item.lineTotal || 0)}</span></div>
                ))}
                {lastSale.items.filter(i => !i.isExchange).length > 0 && (
                  <div className="border-t border-amber-800/50 mt-1 pt-1">
                    {lastSale.items.filter(i => !i.isExchange).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-emerald-400"><span>New: {item.productName} x{item.quantity}</span><span>{formatCurrency(item.lineTotal || 0)}</span></div>
                    ))}
                  </div>
                )}
                {(() => {
                  const exTotal = lastSale.items.filter(i => i.isExchange).reduce((s, i) => s + (i.lineTotal || 0), 0);
                  const nxTotal = lastSale.items.filter(i => !i.isExchange).reduce((s, i) => s + (i.lineTotal || 0), 0);
                  const diff = nxTotal - exTotal;
                  return (
                    <div className="border-t border-amber-800/50 mt-2 pt-2 flex justify-between text-sm font-black">
                      <span className="text-white">Difference</span>
                      <span className={diff >= 0 ? 'text-emerald-400' : 'text-red-400'}>{diff >= 0 ? `Pay ${formatCurrency(diff)}` : `Refund ${formatCurrency(Math.abs(diff))}`}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {lastSale.orderNumber && (
              <div className={`${lastSale.alterationNumber ? 'bg-purple-900/30 border-purple-700' : 'bg-amber-900/30 border-amber-700'} border rounded-xl px-4 py-2 mb-2`}>
                <p className={`text-xs font-bold ${lastSale.alterationNumber ? 'text-purple-400' : 'text-amber-400'}`}>{lastSale.alterationNumber ? 'Alteration & Order Number' : 'Your Order Number'}</p>
                <p className="text-lg font-black text-white tracking-wider">{lastSale.orderNumber}</p>
              </div>
            )}
            {lastSale.engravingNumber && (
              <div className="bg-cyan-900/30 border-cyan-700 border rounded-xl px-4 py-2 mb-4">
                <p className="text-xs font-bold text-cyan-400">Engraving Number</p>
                <p className="text-lg font-black text-white tracking-wider">{lastSale.engravingNumber}</p>
              </div>
            )}
            {!lastSale.orderNumber && !lastSale.engravingNumber && !(lastSale.items || []).some(i => i.isExchange) && <div className="mb-4"></div>}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={() => { setPendingPrintSale(lastSale); setPrintOpts({ invoice: true, gatePass: true }); setShowPrintOptions(true); }} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  <Printer size={16} />Print
                </button>
                {lastSale.orderNumber && !lastSale.alterationNumber && !lastSale.engravingNumber && (
                  <button onClick={() => { setShowCheckout(false); setCreateOrderNumber(false); setCreateAlterationNumber(false); setCreateEngravingNumber(false); navigate(`/outlet-order-entry?orderNumber=${lastSale.orderNumber}`); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                    <FileText size={16} />Create Order
                  </button>
                )}
              </div>
              {lastSale.alterationNumber && (
                <button onClick={() => { setShowCheckout(false); setCreateOrderNumber(false); setCreateAlterationNumber(false); setCreateEngravingNumber(false); navigate(`/alteration-request?alterationNumber=${lastSale.alterationNumber}`); }} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  <FileText size={16} />Create Alteration Request
                </button>
              )}
              {lastSale.engravingNumber && (
                <button onClick={() => { setShowCheckout(false); setCreateOrderNumber(false); setCreateAlterationNumber(false); setCreateEngravingNumber(false); navigate(`/engraving-request?engravingNumber=${lastSale.engravingNumber}`); }} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  <FileText size={16} />Send for Engraving
                </button>
              )}
              <button onClick={() => { setShowCheckout(false); setCreateOrderNumber(false); setCreateAlterationNumber(false); setCreateEngravingNumber(false); }} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Options Modal */}
      {showPrintOptions && pendingPrintSale && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowPrintOptions(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2"><Printer size={18} />Print Options</h3>
            <p className="text-xs font-bold text-gray-400 mb-4">Select what to print:</p>
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750">
                <input type="checkbox" checked={printOpts.invoice} onChange={e => setPrintOpts(p => ({ ...p, invoice: e.target.checked }))}
                  className="accent-blue-500 w-5 h-5" />
                <div>
                  <p className="text-sm font-black text-white">Complete Invoice</p>
                  <p className="text-[10px] font-bold text-gray-500">Full invoice with items, summary, and QR</p>
                </div>
              </label>
              <label className="flex items-center gap-3 bg-gray-800 rounded-xl p-4 cursor-pointer hover:bg-gray-750">
                <input type="checkbox" checked={printOpts.gatePass} onChange={e => setPrintOpts(p => ({ ...p, gatePass: e.target.checked }))}
                  className="accent-amber-500 w-5 h-5" />
                <div>
                  <p className="text-sm font-black text-white">Gate Pass</p>
                  <p className="text-[10px] font-bold text-gray-500">Gate pass with amount summary</p>
                </div>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPrintOptions(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={handlePrint}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                disabled={!printOpts.invoice && !printOpts.gatePass}>
                <Printer size={16} />Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Remaining Balance Modal */}
      {showPayBalanceModal && selectedBalanceInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowPayBalanceModal(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-1">Pay Remaining Balance</h3>
            <p className="text-xs text-gray-400 mb-4">Invoice #{selectedBalanceInvoice.receiptNumber}</p>

            <div className="space-y-3 bg-gray-950 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Customer</span>
                <span className="font-bold text-white">{selectedBalanceInvoice.customerName || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Original Total</span>
                <span className="font-bold text-white">{formatCurrency(selectedBalanceInvoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Amount Already Paid</span>
                <span className="font-bold text-emerald-400">{formatCurrency(selectedBalanceInvoice.totalPaid)}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-gray-800 pt-2">
                <span className="font-bold text-amber-400">Remaining Balance</span>
                <span className="font-bold text-amber-400">{formatCurrency(selectedBalanceInvoice.remaining)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 block mb-2">Payment Method</label>
              <div className="flex gap-2 flex-wrap">
                {['CASH', 'CARD', 'ONLINE', 'CASH_ONLINE'].map(m => (
                  <button key={m} onClick={() => { setBalancePaymentMethod(m); if (m !== 'CASH_ONLINE') { setBalanceCashAmount(0); setBalanceOnlineAmount(0); } }}
                    className={`flex-1 px-2 py-2 rounded-xl text-xs font-bold border-2 ${balancePaymentMethod === m ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300' : 'border-gray-700 text-gray-500'}`}>
                    {m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : m === 'ONLINE' ? 'Online' : 'Cash+Online'}
                  </button>
                ))}
              </div>
            </div>
            {balancePaymentMethod === 'CASH_ONLINE' && (
              <div className="mb-4 space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Cash Amount</label>
                  <input type="number" value={balanceCashAmount} min="0" max={payAmount}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; setBalanceCashAmount(v); setBalanceOnlineAmount(Math.max(0, payAmount - v)); }}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-2 text-sm font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Online Amount</label>
                  <input type="number" value={balanceOnlineAmount} min="0" max={payAmount}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; setBalanceOnlineAmount(v); setBalanceCashAmount(Math.max(0, payAmount - v)); }}
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-2 text-sm font-bold text-white focus:border-emerald-500 outline-none" />
                </div>
                <p className="text-[10px] text-gray-500 text-center">Total: {formatCurrency(balanceCashAmount + balanceOnlineAmount)} / {formatCurrency(payAmount)}</p>
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 block mb-1">Amount to Pay</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-4 py-3 text-lg font-black text-white focus:border-emerald-500 outline-none"
                min="1" max={selectedBalanceInvoice.remaining} />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPayBalanceModal(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={handlePayBalance} disabled={paying || payAmount <= 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 rounded-xl text-sm">
                {paying ? 'Processing...' : `Pay ${formatCurrency(payAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Payment Success + Receipt */}
      {lastBalancePayment && !showPayBalanceModal && !showBalanceHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { setLastBalancePayment(null); }}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-1">Balance Payment</h3>
            <p className="text-sm font-bold text-gray-400 mb-1">{lastBalancePayment.receiptNumber}</p>
            <p className="text-2xl font-black text-emerald-400 mb-4">{formatCurrency(lastBalancePayment.amountPaidNow)}</p>
            {lastBalancePayment.outstandingBalanceAfterPayment <= 0 && (
              <p className="text-xs font-bold text-emerald-500 mb-4">✓ Invoice Fully Paid</p>
            )}
            <div className="flex gap-2">
              <button onClick={handlePrintBalanceReceipt} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                <Printer size={16} />Print Receipt
              </button>
              <button onClick={() => setLastBalancePayment(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-black py-3 rounded-xl text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Payment History Modal */}
      {showBalanceHistoryModal && selectedBalanceInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowBalanceHistoryModal(false)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-white">Payment History</h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedBalanceInvoice.remaining <= 0.01 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {selectedBalanceInvoice.remaining <= 0.01 ? 'PAID' : 'BALANCE'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">Invoice #{selectedBalanceInvoice.receiptNumber} &mdash; {selectedBalanceInvoice.customerName || 'N/A'}</p>

            <div className="bg-gray-950 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Total Bill Amount</span><span className="font-bold text-white">{formatCurrency(selectedBalanceInvoice.grandTotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Initial Payment (Advance)</span><span className="font-bold text-white">{formatCurrency(selectedBalanceInvoice.advanceAmount || 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Paid</span><span className="font-bold text-emerald-400">{formatCurrency(selectedBalanceInvoice.totalPaid)}</span></div>
              {selectedBalanceInvoice.remaining > 0.01 && (
                <div className="flex justify-between border-t border-gray-800 pt-1.5"><span className="text-amber-400 font-bold">Remaining Balance</span><span className="font-bold text-amber-400">{formatCurrency(selectedBalanceInvoice.remaining)}</span></div>
              )}
            </div>

            {balanceHistory.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Payment History</p>
                <div className="space-y-2">
                  {balanceHistory.map(p => (
                    <div key={p.id} className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-white">{p.receiptNumber}</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(p.amountPaidNow)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>{formatPaymentMethod(p.paymentMethod)} &bull; {p.cashierName || 'Cashier'}</span>
                        <span>{new Date(p.paidAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {balanceHistory.length === 0 && (
              <p className="text-center text-gray-500 font-bold py-4 text-xs">No balance payments yet</p>
            )}
            <button onClick={() => setShowBalanceHistoryModal(false)} className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Close Book Modal */}
      {showCloseBook && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto" onClick={() => { if (!closeBookLoading) setShowCloseBook(false); }}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-white flex items-center gap-2"><Book size={20} className="text-emerald-400" />Close Register</h2>
              {!closeBookLoading && (
                <button onClick={() => { setShowCloseBook(false); setCloseBookSummary(null); }} className="text-gray-500 hover:text-white"><X size={20} /></button>
              )}
            </div>

            {summaryLoading ? (
              <div className="text-center py-12 text-gray-400 font-bold">Loading summary...</div>
            ) : closeBookSummary ? (
              <div className="space-y-4">
                {/* Session Info */}
                <div className="bg-gray-800 rounded-xl p-4 text-xs">
                  <div className="flex justify-between mb-1"><span className="text-gray-500">Opened</span><span className="text-white font-bold">{new Date(currentBook?.openedAt).toLocaleString()}</span></div>
                  <div className="flex justify-between mb-1"><span className="text-gray-500">Opened by</span><span className="text-white font-bold">{currentBook?.openedBy || 'Unknown'}</span></div>
                  <div className="flex justify-between mb-1"><span className="text-gray-500">Closing by</span><span className="text-white font-bold text-amber-400">{verifiedCloser || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Sales</span><span className="text-white font-bold">{closeBookSummary.totalSales} transactions</span></div>
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Payment Summary</h3>
                  <div className="space-y-2 text-xs">
                    <button onClick={() => setShowPaymentDetail({ method: 'Cash', sales: (closeBookSummary.sales || []).filter(s => s.paymentMethod === 'CASH') })}
                      className="w-full flex justify-between items-center hover:bg-gray-750 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <span className="text-gray-400">Cash</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(closeBookSummary.paymentSummary.cash)}</span>
                    </button>
                    <button onClick={() => setShowPaymentDetail({ method: 'Card', sales: (closeBookSummary.sales || []).filter(s => s.paymentMethod === 'CARD') })}
                      className="w-full flex justify-between items-center hover:bg-gray-750 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <span className="text-gray-400">Card</span>
                      <span className="font-bold text-purple-400">{formatCurrency(closeBookSummary.paymentSummary.card)}</span>
                    </button>
                    <button onClick={() => setShowPaymentDetail({ method: 'Online', sales: (closeBookSummary.sales || []).filter(s => s.paymentMethod === 'ONLINE') })}
                      className="w-full flex justify-between items-center hover:bg-gray-750 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <span className="text-gray-400">Online</span>
                      <span className="font-bold text-blue-400">{formatCurrency(closeBookSummary.paymentSummary.online)}</span>
                    </button>
                    <button onClick={() => setShowPaymentDetail({ method: 'Cash+Online', sales: (closeBookSummary.sales || []).filter(s => s.paymentMethod === 'CASH_ONLINE') })}
                      className="w-full flex justify-between items-center hover:bg-gray-750 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <span className="text-gray-400">Cash + Online</span>
                      <span className="text-[10px] font-bold text-gray-500 italic">Already Added</span>
                    </button>
                    <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><span className="font-bold text-white">Grand Total</span><span className="font-black text-lg text-white">{formatCurrency(closeBookSummary.paymentSummary.grandTotal)}</span></div>
                  </div>
                  {/* Net after deductions */}
                  {(closeBookSummary.paymentBreakdown || []).map(pb => (
                    <div key={pb.method} className="flex justify-between text-[10px] mt-1 text-gray-500"><span>{pb.method} Net</span><span className={pb.net >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}>{formatCurrency(pb.net)}</span></div>
                  ))}
                </div>

                {/* Employee-wise Collections */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Employee Collections</h3>
                  <div className="space-y-2">
                    {closeBookSummary.employeeCollections.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">No collections</p>
                    ) : (
                      closeBookSummary.employeeCollections.map((emp, i) => (
                        <button key={i} onClick={() => setShowEmployeeDetail(emp)} className="w-full bg-gray-850 rounded-lg p-3 border border-gray-700/50 hover:border-indigo-500/50 transition-colors text-left">
                          <p className="text-xs font-bold text-indigo-400 mb-2">{emp.name} <span className="text-gray-500 font-normal">({emp.salesCount} sale{emp.salesCount !== 1 ? 's' : ''})</span></p>
                          <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <span className="text-gray-500">Cash:</span><span className="font-bold text-emerald-400 text-right">{formatCurrency(emp.cash)}</span>
                            <span className="text-gray-500">Card:</span><span className="font-bold text-purple-400 text-right">{formatCurrency(emp.card)}</span>
                            <span className="text-gray-500">Online:</span><span className="font-bold text-blue-400 text-right">{formatCurrency(emp.online)}</span>
                            <span className="text-gray-400 font-bold">Total:</span><span className="font-bold text-white text-right">{formatCurrency(emp.total)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Faisal Takes */}
                {closeBookSummary.totalFaisalTake > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Faisal Takes</h3>
                    <p className="text-xs font-bold text-amber-400">Total: {formatCurrency(closeBookSummary.totalFaisalTake)} ({closeBookSummary.totalFaisalTakesCount} transaction{closeBookSummary.totalFaisalTakesCount !== 1 ? 's' : ''})</p>
                  </div>
                )}

                {/* General Entry Deduction */}
                <div className="bg-gray-800 rounded-xl p-4 border border-orange-800/50">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <FileText size={14} className="text-orange-400" /> General Entry Deduction
                  </h3>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400">Total Deducted</span>
                    <span className="font-bold text-red-400">-{formatCurrency(closeBookSummary.totalJournalEntries)}</span>
                  </div>
                  {closeBookSummary.totalJournalCount > 0 && (
                    <div className="pl-2 text-[10px] text-gray-600 space-y-0.5 border-t border-gray-700/50 pt-2">
                      {(closeBookSummary.journalEntries || []).map((j, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{j.expenseTitle} — {j.employeeName}</span>
                          <span className="text-red-400/70">{formatCurrency(j.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Returns & Refunds */}
                <div className="bg-gray-800 rounded-xl p-4 border border-red-800/30">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Returns & Refunds</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Total Returns</span><span className="font-bold text-red-400">{formatCurrency(closeBookSummary.totalReturns)}</span></div>
                    {closeBookSummary.totalReturnsCount > 0 && (
                      <div className="pl-2 text-[10px] text-gray-600 space-y-0.5">
                        <div className="flex justify-between"><span className="text-gray-500">Cash Returns:</span><span className="text-red-400/70">{formatCurrency(closeBookSummary.returnSummary.cash)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Card Returns:</span><span className="text-red-400/70">{formatCurrency(closeBookSummary.returnSummary.card)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Online Returns:</span><span className="text-red-400/70">{formatCurrency(closeBookSummary.returnSummary.online)}</span></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cash Summary — from today's total sales down to available cash */}
                <div className="bg-gray-800 rounded-xl p-4 border-2 border-emerald-800/50">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Cash Summary</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between pb-2 border-b border-gray-700"><span className="font-bold text-white">Today's Total Sales</span><span className="font-bold text-white">{formatCurrency(closeBookSummary.paymentSummary.grandTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Cash Sales</span><span className="font-bold text-emerald-400">{formatCurrency(closeBookSummary.paymentSummary.cashCollected)}</span></div>
                    <div className="flex justify-between"><span className="text-orange-400 font-bold">General Entry Deduction</span><span className="font-bold text-red-400">-{formatCurrency(closeBookSummary.totalJournalEntries)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Cash Returns</span><span className="font-bold text-red-400">-{formatCurrency(closeBookSummary.returnSummary.cash)}</span></div>
                    <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                      <span className="font-bold text-white">Available Cash</span>
                      <span className="font-black text-lg text-emerald-400">{formatCurrency(closeBookSummary.availableCash)}</span>
                    </div>
                  </div>
                </div>

                {/* Transfer Cash */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest mb-3">Transfer Cash to System</h3>
                  <input type="number" value={transferCashAmount} onChange={e => setTransferCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Enter amount to transfer..."
                    className="w-full bg-gray-950 border-2 border-gray-700 rounded-xl px-4 py-3 text-lg font-black text-white placeholder-gray-500 focus:border-emerald-500 outline-none mb-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Cash in Locker</span>
                    <span className="font-bold text-emerald-400">{formatCurrency(closeBookSummary.availableCash)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500">Transfer to System</span>
                    <span className="font-bold text-amber-400">-{formatCurrency(parseFloat(transferCashAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1 border-t border-gray-700 pt-2">
                    <span className="font-bold text-white">Remaining Cash in Locker</span>
                    <span className="font-bold text-white">{formatCurrency(closeBookSummary.availableCash - (parseFloat(transferCashAmount) || 0))}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <div className="flex gap-1 mr-auto">
                    <button onClick={() => setBookPrintOpts(p => ({ ...p, thermal: !p.thermal }))}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 ${bookPrintOpts.thermal ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-gray-700 text-gray-500'}`}>
                      <Printer size={12} className="inline mr-1" />Thermal
                    </button>
                    <button onClick={() => setBookPrintOpts(p => ({ ...p, a4: !p.a4 }))}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold border-2 ${bookPrintOpts.a4 ? 'border-purple-500 bg-purple-600/20 text-purple-300' : 'border-gray-700 text-gray-500'}`}>
                      <FileText size={12} className="inline mr-1" />A4
                    </button>
                  </div>
                  <button onClick={handleCloseBook} disabled={closeBookLoading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm flex items-center gap-2">
                    {closeBookLoading ? 'Closing...' : <><CheckCircle2 size={16} /> Done / Close Register</>}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => { setShowAuthModal(false); setAuthError(''); }}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {authMode === 'open' ? <BookOpen size={18} className="text-emerald-400" /> : <Book size={18} className="text-amber-400" />}
                {authMode === 'open' ? 'Open Register' : 'Close Register'}
              </h2>
              <button onClick={() => { setShowAuthModal(false); setAuthError(''); }} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Employee Name</label>
                <select value={authEmployee} onChange={e => { setAuthEmployee(e.target.value); setAuthError(''); }}
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-emerald-500 outline-none">
                  <option value="">Select Employee</option>
                  {Object.keys(employees).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Password</label>
                <input type="password" value={authPassword} onChange={e => { setAuthPassword(e.target.value); setAuthError(''); }}
                  placeholder="Enter password"
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white placeholder-gray-500 focus:border-emerald-500 outline-none" />
              </div>

              {authError && <p className="text-[10px] font-bold text-red-400 text-center">{authError}</p>}

              <button onClick={handleAuth}
                className="w-full py-2.5 rounded-xl font-black text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-[0.98]">
                {authMode === 'open' ? 'Open Register' : 'View Close Summary'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Detail Modal */}
      {showPaymentDetail && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowPaymentDetail(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">{showPaymentDetail.method} Transactions <span className="text-gray-500 font-normal text-sm">({showPaymentDetail.sales.length})</span></h3>
              <button onClick={() => setShowPaymentDetail(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            {showPaymentDetail.sales.length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-4 text-xs">No transactions</p>
            ) : (
              <div className="space-y-2">
                {showPaymentDetail.sales.map((s, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-white">{s.receiptNumber || 'N/A'}</p>
                        <p className="text-[10px] text-gray-400">{s.customerName || 'Walk-in'}</p>
                      </div>
                      <span className="text-xs font-black text-emerald-400">{formatCurrency(s.revenue || s.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>{s.cashierName || 'Unknown'}</span>
                      <span>{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {showEmployeeDetail && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowEmployeeDetail(null)}>
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white">{showEmployeeDetail.name} <span className="text-gray-500 font-normal text-sm">({showEmployeeDetail.salesCount} sales)</span></h3>
              <button onClick={() => setShowEmployeeDetail(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              <div className="bg-gray-800 rounded-lg p-2 border border-emerald-800/30"><span className="text-gray-500">Cash</span><p className="font-bold text-emerald-400">{formatCurrency(showEmployeeDetail.cash)}</p></div>
              <div className="bg-gray-800 rounded-lg p-2 border border-purple-800/30"><span className="text-gray-500">Card</span><p className="font-bold text-purple-400">{formatCurrency(showEmployeeDetail.card)}</p></div>
              <div className="bg-gray-800 rounded-lg p-2 border border-blue-800/30"><span className="text-gray-500">Online</span><p className="font-bold text-blue-400">{formatCurrency(showEmployeeDetail.online)}</p></div>
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-700"><span className="text-gray-500">Total</span><p className="font-bold text-white">{formatCurrency(showEmployeeDetail.total)}</p></div>
            </div>
            {/* Transactions */}
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Transactions</h4>
            {(showEmployeeDetail.sales || []).length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-4 text-xs">No transactions</p>
            ) : (
              <div className="space-y-2">
                {(showEmployeeDetail.sales || []).map((s, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-white">{s.receiptNumber || 'N/A'}</p>
                        <p className="text-[10px] text-gray-400">{s.customerName || 'Walk-in'}</p>
                      </div>
                      <span className="text-xs font-black" style={{ color: s.paymentMethod === 'CASH' ? '#34d399' : s.paymentMethod === 'CARD' ? '#a78bfa' : s.paymentMethod === 'ONLINE' ? '#60a5fa' : '#fbbf24' }}>{formatCurrency(s.revenue || s.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span className="font-medium">{formatPaymentMethod(s.paymentMethod)}</span>
                      <span>{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default POSModals;
