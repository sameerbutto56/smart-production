import React, { useState, useMemo } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { Search, ArrowLeft, RefreshCcw, Package, FileText, Printer, X, User, Phone, MapPin, Calendar, Hash, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printJobSheet } from '../utils/printReport';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', VERIFICATION: 'Verification', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive', DISPATCH: 'Dispatch',
  OUT_FOR_DELIVERY: 'Out for Delivery', OUTLET_RECEIVE: 'Outlet Receive',
  IN_DISPATCH: 'In Dispatch', ENAMELS_DELIVERY: 'Enamels Delivery',
  RETURNED_FROM_VERIFICATION: 'Returned from Verification', DELIVERED: 'Delivered'
};

const parseJSON = (v) => { if (!v) return null; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return null; } };

const fmtCurrency = (n) => `Rs. ${(n || 0).toLocaleString()}`;

const StoreOrders = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: orders, loading, error, refresh } = useCache('store:orders:all', {
    fetcher: () => api.get('/api/orders').then(r => Array.isArray(r.data) ? r.data : []),
    ttl: 60000,
  });

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      String(o.orderNumber || '').toLowerCase().includes(q) ||
      String(o.customerName || '').toLowerCase().includes(q) ||
      String(o.customerPhone || '').includes(q) ||
      String(o.invoiceNumber || '').toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const viewJobSheet = async (order) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/api/orders/track/${encodeURIComponent(order.orderNumber || order.id)}`);
      const fullOrder = res.data?.order || res.data;
      if (fullOrder) {
        setSelectedOrder(fullOrder);
      }
    } catch (err) {
      console.error('Failed to load order for Job Sheet:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeJobSheet = () => setSelectedOrder(null);

  const handlePrint = () => {
    if (selectedOrder) {
      printJobSheet(selectedOrder, 'STORE', 'ur');
    }
  };

  const order = selectedOrder;
  const productDetails = order ? (parseJSON(order.productDetails) || []) : [];
  const items = Array.isArray(productDetails) ? productDetails : [productDetails];
  const firstItem = items[0] || {};
  const financialSummary = parseJSON(order?.financialSummary);
  const custom = parseJSON(order?.customization);
  const sizeData = parseJSON(order?.sizeData);

  return (
    <div className="p-2 md:p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
            <ArrowLeft size={16} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">Orders</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">View Job Sheets ({filteredOrders.length})</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading}
          className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
          <RefreshCcw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search order #, customer, phone, invoice #..."
            className="w-full bg-gray-900 border-2 border-gray-800 rounded-xl pl-9 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500 transition-colors" />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
          <p className="text-xs font-black text-red-400 uppercase tracking-widest">Failed to load orders</p>
          <button onClick={refresh} className="mt-2 text-[10px] font-bold text-gray-400 hover:text-white underline">Retry</button>
        </div>
      )}

      {!error && !loading && filteredOrders.length === 0 && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-8 text-center">
          <Package size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-black text-gray-500">{searchTerm ? 'No orders match your search' : 'No orders yet'}</p>
        </div>
      )}

      <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {filteredOrders.map((o) => (
          <div key={o.id}
            className="w-full bg-gray-900/60 hover:bg-gray-900 border border-gray-800/50 hover:border-purple-500/50 rounded-2xl p-3 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-base md:text-lg font-black text-white">#{o.orderNumber || '—'}</p>
                <p className="text-xs text-gray-400 font-bold mt-0.5 truncate">
                  {o.customerName}{o.customerPhone ? ` · ${o.customerPhone}` : ''}
                </p>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                  {STAGE_LABELS[o.trackingStatus || o.currentStage] || o.currentStage || '—'}
                  {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => viewJobSheet(o)}
                disabled={loadingDetail}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-colors shrink-0"
              >
                {loadingDetail ? (
                  <RefreshCcw size={13} className="animate-spin" />
                ) : (
                  <FileText size={13} />
                )}
                <span className="hidden sm:inline">Job Sheet</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Job Sheet Modal */}
      {order && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-xl" onClick={closeJobSheet} />
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-xl md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h2 className="text-xl md:text-3xl font-black tracking-tighter text-white">#{order.orderNumber || order.id?.substring(0, 8) || '—'}</h2>
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                    Job Sheet
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-bold">
                  {STAGE_LABELS[order.currentStage] || order.currentStage || '—'}
                  {order.createdAt ? ` · Created ${new Date(order.createdAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button onClick={closeJobSheet} className="p-3 hover:bg-gray-800 rounded-full text-gray-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">

              {/* Customer Info */}
              <section>
                <h4 className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-4">Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
                    <User size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Name</p>
                      <p className="text-sm font-black text-white">{order.customerName || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
                    <Phone size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">Phone</p>
                      <p className="text-sm font-black text-white">{order.customerPhone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
                    <MapPin size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase">City</p>
                      <p className="text-sm font-black text-white">{order.city || '—'}</p>
                    </div>
                  </div>
                  {order.customerAddress && (
                    <div className="md:col-span-3 flex items-center gap-3 bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
                      <MapPin size={14} className="text-blue-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Address</p>
                        <p className="text-sm font-black text-white">{order.customerAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Order Info */}
              <section>
                <h4 className="text-[10px] md:text-xs font-black text-purple-500 uppercase tracking-[0.3em] mb-4">Order Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Type', value: order.type },
                    { label: 'Priority', value: order.priority },
                    { label: 'Source', value: order.source },
                    { label: 'Invoice', value: order.invoiceNumber },
                  ].filter(f => f.value).map((f, i) => (
                    <div key={i} className="bg-gray-950/50 p-3 rounded-xl border border-gray-800/50">
                      <p className="text-[10px] text-gray-500 font-bold uppercase">{f.label}</p>
                      <p className="text-sm font-black text-white">{f.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Products */}
              <section>
                <h4 className="text-[10px] md:text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Products ({items.length})</h4>
                <div className="overflow-x-auto rounded-2xl border border-gray-800">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-950/80">
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">#</th>
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Product</th>
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Color</th>
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">Size</th>
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest text-center">Qty</th>
                        <th className="py-3 px-4 text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const p = item.productDetails || item;
                        return (
                          <tr key={idx} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                            <td className="py-3 px-4 text-gray-500 font-black text-sm">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-white text-sm uppercase">{p.productType || p.name || '—'}</td>
                            <td className="py-3 px-4 text-gray-300 text-sm">{p.color || '—'}</td>
                            <td className="py-3 px-4 text-gray-300 text-sm">{p.size || 'Custom'}</td>
                            <td className="py-3 px-4 text-center text-white font-black text-sm">{item.quantity || 1}</td>
                            <td className="py-3 px-4 text-right text-white font-black text-sm">{fmtCurrency(item.totalPrice || p.unitPrice * (item.quantity || 1))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Financial Summary */}
              <section>
                <h4 className="text-[10px] md:text-xs font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Financial Summary</h4>
                <div className="bg-gray-950/50 p-4 rounded-2xl border border-gray-800/50 space-y-2">
                  {financialSummary ? (
                    <>
                      {financialSummary.productPrice > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Product Price</span><span className="text-white font-black">{fmtCurrency(financialSummary.productPrice)}</span></div>
                      )}
                      {financialSummary.logoCharges > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Logo Charges</span><span className="text-white font-black">{fmtCurrency(financialSummary.logoCharges)}</span></div>
                      )}
                      {financialSummary.namePrinting > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Name Printing</span><span className="text-white font-black">{fmtCurrency(financialSummary.namePrinting)}</span></div>
                      )}
                      {financialSummary.customization > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Customization</span><span className="text-white font-black">{fmtCurrency(financialSummary.customization)}</span></div>
                      )}
                      {financialSummary.cap > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Cap Charges</span><span className="text-white font-black">{fmtCurrency(financialSummary.cap)}</span></div>
                      )}
                      {financialSummary.delivery > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Delivery</span><span className="text-white font-black">{fmtCurrency(financialSummary.delivery)}</span></div>
                      )}
                      {financialSummary.discount > 0 && (
                        <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold">Discount</span><span className="text-emerald-400 font-black">-{fmtCurrency(financialSummary.discount)}</span></div>
                      )}
                      <div className="border-t border-gray-700 pt-2 flex justify-between text-sm">
                        <span className="text-gray-300 font-black uppercase tracking-widest">Total</span>
                        <span className="text-white font-black text-lg">{fmtCurrency(financialSummary.total || order.totalPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300 font-black uppercase tracking-widest">Total</span>
                        <span className="text-white font-black text-lg">{fmtCurrency(order.totalPrice)}</span>
                      </div>
                      {order.advanceAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">Advance Paid</span>
                          <span className="text-emerald-400 font-black">{fmtCurrency(order.advanceAmount)}</span>
                        </div>
                      )}
                      {order.deliveryCharges > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">Delivery</span>
                          <span className="text-white font-black">{fmtCurrency(order.deliveryCharges)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">Payment Status</span>
                    <span className={`font-black uppercase tracking-widest text-xs px-2 py-0.5 rounded ${order.paymentStatus === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {order.paymentStatus || 'PENDING'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Engraving / Customization */}
              {custom && (
                <section>
                  <h4 className="text-[10px] md:text-xs font-black text-purple-400 uppercase tracking-[0.3em] mb-4">Engraving / Customization</h4>
                  <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10 space-y-2">
                    {custom.nameSpelling && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 font-bold">Name Spelling</span>
                        <span className="text-purple-300 font-black">{custom.nameSpelling}</span>
                      </div>
                    )}
                    {custom.engravingType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 font-bold">Engraving Type</span>
                        <span className="text-purple-300 font-black">{custom.engravingType === 'direct' ? 'Direct' : 'Patch'}</span>
                      </div>
                    )}
                    {custom.articleNames && custom.articleNames.filter(Boolean).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">Article Names</p>
                        <div className="flex flex-wrap gap-1">
                          {custom.articleNames.filter(Boolean).map((an, i) => (
                            <span key={i} className="text-[10px] font-black text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded">L{i+1}: {an}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {custom.logos && custom.logos.filter(l => l.name || l.design).length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 font-bold mb-1">Logos</p>
                        <div className="flex flex-wrap gap-1">
                          {custom.logos.filter(l => l.name || l.design).map((l, i) => (
                            <span key={i} className="text-[10px] font-black text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded">
                              {l.name || `#${i+1}`}{l.design ? ` — ${l.design}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {custom.designNotes && (
                      <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 mt-2">
                        <p className="text-[10px] font-black text-yellow-400 uppercase mb-1">Design Notes</p>
                        <p className="text-xs text-yellow-300 font-medium italic">{custom.designNotes}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Measurements */}
              {sizeData && typeof sizeData === 'object' && Object.keys(sizeData).length > 0 && (
                <section>
                  <h4 className="text-[10px] md:text-xs font-black text-cyan-500 uppercase tracking-[0.3em] mb-4">Measurements</h4>
                  <div className="bg-cyan-500/5 p-4 rounded-2xl border border-cyan-500/10 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(sizeData).filter(([k]) => !k.startsWith('_') && sizeData[k]).map(([key, val]) => (
                      <div key={key} className="bg-gray-950/50 p-2 rounded-xl">
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{key}</p>
                        <p className="text-sm font-black text-cyan-300">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Special Note */}
              {order.specialNote && (
                <section>
                  <h4 className="text-[10px] md:text-xs font-black text-yellow-500 uppercase tracking-[0.3em] mb-4">Special Note</h4>
                  <div className="bg-yellow-500/5 p-4 rounded-2xl border border-yellow-500/10">
                    <p className="text-sm text-yellow-300 italic">{order.specialNote}</p>
                  </div>
                </section>
              )}
            </div>

            {/* Footer with Print */}
            <div className="p-4 md:p-6 bg-gray-950/80 border-t border-gray-800 flex justify-end items-center gap-3 sticky bottom-0">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <Printer size={14} /> Print Job Sheet
              </button>
              <button
                onClick={closeJobSheet}
                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreOrders;
