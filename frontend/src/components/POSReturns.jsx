import React from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency } from '../utils/POSPrint';
import { Barcode, RotateCcw, Search, Minus, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const POSReturns = () => {
  const { isUrdu } = useLanguage();
  const { returnTab, setReturnTab, returnBarcodeInput, setReturnBarcodeInput,
    returnProductSearch, setReturnProductSearch,
    invoiceReturnInput, setInvoiceReturnInput, invoiceReturnLoading, setInvoiceReturnLoading,
    lookedUpReturnSale, setLookedUpReturnSale, handleInvoiceLookup, handleRefundInvoice,
    returns, products, sales,
    returnCart, setReturnCart, returnReason, setReturnReason,
    refundPaymentMethod, setRefundPaymentMethod, returnLoading, setReturnLoading,
    processReturns, handleReturnBarcodeLookup,
    handleRefundInvoiceFromHistory } = usePOS();

  return (
    <div className="space-y-4 pb-20 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><RotateCcw size={24} />Returns</h1>
        <div className="flex gap-2">
          <button onClick={() => setReturnTab('scan')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'scan' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Scan Barcode</button>
          <button onClick={() => setReturnTab('invoice')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'invoice' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>By Invoice</button>
          <button onClick={() => setReturnTab('product')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'product' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>Select Product</button>
          <button onClick={() => setReturnTab('sales')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'sales' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>From Sales</button>
          <button onClick={() => setReturnTab('history')} className={`text-xs font-bold px-3 py-1.5 rounded-xl ${returnTab === 'history' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>History</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {returnTab === 'scan' && (
            <div className="glass p-4 rounded-2xl border-2 border-gray-700">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-20 h-20 rounded-2xl border-2 border-emerald-500 flex items-center justify-center mb-4">
                  <Barcode size={36} className="text-emerald-400" />
                </div>
                <h2 className="text-lg font-black text-emerald-400 mb-2">Scan Barcode to Return</h2>
                <p className="text-[10px] text-gray-500 mb-4 text-center">Point your scanner at a product barcode</p>
                <div className="relative w-full max-w-sm">
                  <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input value={returnBarcodeInput} onChange={e => setReturnBarcodeInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReturnBarcodeLookup()}
                    placeholder="Scan barcode..." autoFocus
                    className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
                </div>
                <p className="text-[10px] text-gray-600 mt-2">Scan a product barcode to add it to the return cart</p>
              </div>
            </div>
          )}

          {returnTab === 'invoice' && (
            <div className="glass p-4 rounded-2xl border-2 border-gray-700">
              <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Return by Invoice Number</h2>
              <div className="relative mb-3">
                <input value={invoiceReturnInput} onChange={e => setInvoiceReturnInput(e.target.value)}
                  placeholder="Enter invoice / receipt number..." autoFocus
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={handleInvoiceLookup} disabled={!invoiceReturnInput.trim() || invoiceReturnLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs">Search</button>
                <button onClick={() => { setInvoiceReturnInput(''); setLookedUpReturnSale(null); }}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold px-4 py-2.5 rounded-xl text-xs">Clear</button>
              </div>
              {invoiceReturnLoading && <p className="text-center text-gray-500 text-xs py-4">Searching...</p>}
              {lookedUpReturnSale && (
                <div className="bg-gray-800/80 rounded-xl p-3 border border-red-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{lookedUpReturnSale.receiptNumber}</p>
                      <p className="text-[10px] text-gray-400">{lookedUpReturnSale.customerName || 'No customer'} &bull; {new Date(lookedUpReturnSale.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-400">{formatCurrency(lookedUpReturnSale.grandTotal)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(lookedUpReturnSale.items || []).map((item, idx) => (
                      <span key={idx} className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                        {isUrdu ? toUrduName(item.productName) : item.productName} {item.color ? `(${isUrdu ? toUrduName(item.color) : item.color})` : ''} x{item.quantity}
                      </span>
                    ))}
                  </div>
                  {lookedUpReturnSale.refundedAt ? (
                    <p className="text-center text-[10px] font-bold text-red-500 py-2">Already Refunded</p>
                  ) : (
                    <button onClick={() => handleRefundInvoice(lookedUpReturnSale)}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2">
                      <RotateCcw size={14} /> Refund Full Invoice (-{formatCurrency(lookedUpReturnSale.grandTotal)})
                    </button>
                  )}
                </div>
              )}
              {!lookedUpReturnSale && !invoiceReturnLoading && (
                <p className="text-[10px] text-gray-600 mt-2">Enter an invoice number to load and refund the entire invoice.</p>
              )}
            </div>
          )}

          {returnTab === 'product' && (
            <div className="glass p-4 rounded-2xl border-2 border-gray-700">
              <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Search Products to Return</h2>
              <div className="relative mb-3">
                <input value={returnProductSearch} onChange={e => setReturnProductSearch(e.target.value)}
                  placeholder="Search by product name or SKU..." autoFocus
                  className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {products
                  .filter(p => p.name.toLowerCase().includes(returnProductSearch.toLowerCase()) || (p.barcode && p.barcode.toLowerCase().includes(returnProductSearch.toLowerCase())))
                  .slice(0, 100)
                  .map(p => {
                    const alreadyInCart = returnCart.find(i => i.variantId === p.id);
                    return (
                      <div key={p.id} className="bg-gray-800/50 rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{isUrdu ? toUrduName(p.name) : p.name}</p>
                          <p className="text-[9px] text-gray-400">
                            {[isUrdu ? toUrduName(p.color) : p.color, p.size].filter(Boolean).join(' • ') || 'Standard'}
                            {p.stock != null && <span className="ml-2 text-gray-500">Stock: {p.stock}</span>}
                            {p.barcode && <span className="ml-2 text-gray-600">#{p.barcode}</span>}
                          </p>
                          {p.price ? <p className="text-[10px] font-bold text-emerald-400">{formatCurrency(p.price)}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">{formatCurrency(p.price)}</span>
                          <button onClick={() => {
                            const existing = returnCart.find(i => i.variantId === p.id);
                            if (existing) {
                              setReturnCart(returnCart.map(i => i.variantId === p.id ? { ...i, qty: i.qty + 1 } : i));
                            } else {
                              setReturnCart([...returnCart, {
                                variantId: p.id, productName: p.name,
                                color: p.color, size: p.size, barcode: p.barcode || '',
                                unitPrice: p.price || 0, qty: 1, maxQty: 9999
                              }]);
                            }
                            toast.success(`${p.name} added to return cart`);
                          }} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 px-2 py-1 rounded-lg">
                            {alreadyInCart ? `+${alreadyInCart.qty + 1}` : 'Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {products.length === 0 && <p className="text-center text-gray-500 py-4 font-bold">No products available</p>}
                {returnProductSearch && products.filter(p => p.name.toLowerCase().includes(returnProductSearch.toLowerCase())).length === 0 && (
                  <p className="text-center text-gray-500 py-4 font-bold">No matching products</p>
                )}
              </div>
            </div>
          )}

          {returnTab === 'sales' && (
            <div className="glass p-4 rounded-2xl border-2 border-gray-700">
              <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Recent Sales</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sales.slice(0, 30).map(s => (
                  <div key={s.id} className="bg-gray-800/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-white">{s.receiptNumber} {s.orderId && <span className="text-[8px] bg-purple-600 text-white px-1 py-0.5 rounded-full ml-1">ORD</span>}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{formatCurrency(s.grandTotal)}</span>
                        <button onClick={() => {
                          s.items.forEach(item => {
                            const existing = returnCart.find(i => i.productName === item.productName && i.color === item.color && i.size === item.size);
                            if (existing) {
                              setReturnCart(returnCart.map(i => i.productName === item.productName && i.color === item.color && i.size === item.size ? { ...i, qty: i.qty + 1 } : i));
                            } else {
                              setReturnCart([...returnCart, {
                                variantId: item.outletVariantId, productName: item.productName,
                                color: item.color, size: item.size, barcode: '',
                                unitPrice: item.unitPrice, qty: 1, maxQty: 99,
                                saleId: s.id
                              }]);
                            }
                          });
                          setReturnTab('scan');
                          toast.success('Sale items added to return cart');
                        }} className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-gray-800 px-2 py-1 rounded-lg">Return All</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(s.items || []).map((item, idx) => (
                        <span key={idx} className="text-[9px] text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                          {isUrdu ? toUrduName(item.productName) : item.productName} {item.color ? `(${isUrdu ? toUrduName(item.color) : item.color})` : ''} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {sales.length === 0 && <p className="text-center text-gray-500 py-4 font-bold">No sales yet</p>}
              </div>
            </div>
          )}

          {returnTab === 'history' && (
            <div className="glass p-4 rounded-2xl border-2 border-gray-700">
              <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Return History</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {returns.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-red-900/10 rounded-xl px-3 py-2 border border-red-900/20">
                    <div>
                      <p className="text-xs font-bold text-white">{isUrdu ? toUrduName(r._variant?.product?.name || 'Unknown') : (r._variant?.product?.name || 'Unknown')} {r._variant?.color && `(${isUrdu ? toUrduName(r._variant.color) : r._variant.color})`}</p>
                      <p className="text-[10px] text-gray-500">Qty: {r.quantity} &bull; {new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="text-xs font-bold text-red-400">-{formatCurrency(r.refundAmount)}</p>
                  </div>
                ))}
                {returns.length === 0 && <p className="text-center text-gray-500 font-bold py-4">No returns</p>}
              </div>
            </div>
          )}
        </div>

        <div className="glass p-4 rounded-2xl border-2 border-gray-700">
          <h2 className="text-xs font-black text-gray-300 uppercase tracking-widest mb-3">Return Cart ({returnCart.reduce((s, i) => s + i.qty, 0)} items)</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
            {returnCart.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2 border border-gray-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{isUrdu ? toUrduName(item.productName) : item.productName}</p>
                  <p className="text-[9px] text-gray-500">{[isUrdu ? toUrduName(item.color) : item.color, item.size].filter(Boolean).join(' • ') || 'Standard'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => {
                    const copy = [...returnCart];
                    if (copy[i].qty <= 1) { copy.splice(i, 1); } else { copy[i].qty--; }
                    setReturnCart(copy);
                  }} className="p-0.5 text-gray-500 hover:text-white"><Minus size={10} /></button>
                  <span className="text-xs font-bold text-white min-w-[16px] text-center">{item.qty}</span>
                  <button onClick={() => {
                    const copy = [...returnCart];
                    if (copy[i].qty < copy[i].maxQty) copy[i].qty++;
                    setReturnCart(copy);
                  }} className="p-0.5 text-gray-500 hover:text-white"><Plus size={10} /></button>
                </div>
                <p className="text-xs font-bold text-red-400 min-w-[60px] text-right">-{formatCurrency(item.unitPrice * item.qty)}</p>
                <button onClick={() => setReturnCart(returnCart.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400"><X size={12} /></button>
              </div>
            ))}
            {returnCart.length === 0 && <p className="text-center text-gray-500 py-4 text-xs font-bold">No items to return</p>}
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-gray-400 block mb-1">Return Reason</label>
            <input value={returnReason} onChange={e => setReturnReason(e.target.value)}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none" />
          </div>
          <div className="mb-3">
            <label className="text-xs font-bold text-gray-400 block mb-1">Refund Payment Method</label>
            <div className="flex gap-1.5">
              {['CASH', 'CARD', 'ONLINE'].map(m => (
                <button key={m} onClick={() => setRefundPaymentMethod(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black border-2 ${refundPaymentMethod === m ? 'border-red-500 bg-red-600/20 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-gray-400 font-bold">Total Refund</span>
            <span className="text-lg font-black text-red-400">-{formatCurrency(returnCart.reduce((s, i) => s + i.unitPrice * i.qty, 0))}</span>
          </div>
          <button onClick={processReturns} disabled={returnCart.length === 0 || returnLoading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-black py-3 rounded-xl text-sm">
            {returnLoading ? 'Processing...' : `Process ${returnCart.reduce((s, i) => s + i.qty, 0)} Return(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSReturns;
