import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Search, CheckCircle, Clock, User, Phone, Package, FileText, ChevronDown, ChevronUp, AlertCircle, DollarSign, ArrowRight, History, Scissors, Star, Ruler, MessageSquare, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const VerificationPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);
  const [advanceReceived, setAdvanceReceived] = useState('');
  const [verificationNote, setVerificationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [returnModal, setReturnModal] = useState(null);
  const [returnNote, setReturnNote] = useState('');

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/api/verification/pending?${params}`);
      setPendingOrders(res.data.orders || []);
    } catch (err) { console.error('Verification fetch error:', err); setPendingOrders([]); } finally { setLoading(false); }
  }, [search]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get(`/api/verification/history?${params}`);
      setHistoryOrders(res.data.orders || []);
    } catch (err) { console.error('Verification history error:', err); setHistoryOrders([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { activeTab === 'pending' ? fetchPending() : fetchHistory(); }, [activeTab, fetchPending, fetchHistory]);

  const handleVerify = async () => {
    if (!verifyModal) return;
    setSubmitting(true);
    try {
      await api.post(`/api/verification/${verifyModal.id}/verify`, {
        advanceAmountReceived: parseFloat(advanceReceived) || 0,
        verificationNote
      });
      toast.success('Order verified and sent to Store!');
      setVerifyModal(null); setAdvanceReceived(''); setVerificationNote('');
      fetchPending();
      fetchHistory();
      setActiveTab('history');
    } catch (err) { toast.error(err.response?.data?.message || 'Verification failed'); }
    setSubmitting(false);
  };

  const handleReturnToFaisal = async () => {
    if (!returnModal) return;
    setSubmitting(true);
    try {
      await api.post(`/api/verification/${returnModal.id}/return-to-faisal`, { returnNote });
      toast.success('Order returned to Faisal for corrections');
      setReturnModal(null); setReturnNote('');
      fetchPending();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to return order'); }
    setSubmitting(false);
  };

  const parseProducts = (pd) => {
    if (!pd) return [];
    if (typeof pd === 'string') { try { return JSON.parse(pd); } catch { return []; } }
    if (Array.isArray(pd)) return pd;
    return [];
  };

  const getCust = (item) => {
    if (!item) return {};
    if (typeof item.customization === 'object' && item.customization !== null) return item.customization;
    return {};
  };

  const getSizeData = (item) => {
    if (!item) return {};
    if (typeof item.sizeData === 'object' && item.sizeData !== null) return item.sizeData;
    return {};
  };

  const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;
  const formatDateTime = (d) => d ? new Date(d).toLocaleString() : '';

  const renderProductDetails = (products, order) => (
    <div className="space-y-3">
      {products.map((item, i) => {
        const pd = item.productDetails || item;
        const cust = getCust(item);
        const sd = getSizeData(item);
        const measurements = Object.entries(sd).filter(([k, v]) => v && k !== 'specialNote');
        const hasEng = item.engravingText || item.engravingType || item.engravingNames || item.engravingLogos || item.engravingInstructions || item.instructionNotes || order.engravingInstructions || order.instructionNotes;
        return (
          <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-black text-white">{pd.name || pd.productType || 'Product'} <span className="text-[10px] text-gray-500">×{item.quantity || 1}</span></p>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                  {pd.gender && <span className="text-blue-400 font-bold">{pd.gender}</span>}
                  {pd.fabric && <span className="text-gray-400">Fabric: {pd.fabric}</span>}
                  {pd.fabricType && <span className="text-gray-400">Fabric: {pd.fabricType}</span>}
                  {pd.color && <span className="text-purple-400 font-bold">{pd.color}</span>}
                  {pd.size && <span className="text-emerald-400 font-bold">Size: {pd.size}</span>}
                  {pd.sleeveLength && <span className="text-amber-400">Sleeve: {pd.sleeveLength}</span>}
                  {pd.shirtLength && <span className="text-amber-400">Shirt: {pd.shirtLength}</span>}
                  {pd.matchingCap && <span className="text-purple-400">Cap ×{pd.matchingCapQty || 1}</span>}
                </div>
              </div>
              <span className="text-sm font-black text-amber-400">{formatCurrency(item.totalPrice)}</span>
            </div>

            {/* Measurements */}
            {measurements.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-black text-blue-400 uppercase mb-1.5 flex items-center gap-1"><Ruler size={10} /> Measurements</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
                  {measurements.map(([k, v]) => (
                    <div key={k} className="bg-gray-800 rounded-lg px-2 py-1">
                      <span className="text-[9px] text-gray-500 uppercase block">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-xs font-bold text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Branding */}
            {(cust.nameSpelling || cust.logoColor || cust.logoPlacement || cust.designNotes || item.logoCharges || item.namePrintingCharges) && (
              <div className="mb-3">
                <p className="text-[10px] font-black text-purple-400 uppercase mb-1.5 flex items-center gap-1"><Star size={10} /> Branding</p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {cust.nameSpelling && <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-lg">Name: {cust.nameSpelling}</span>}
                  {cust.nameColor && <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-lg">Color: {cust.nameColor}</span>}
                  {cust.logoColor && <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-lg">Logo: {cust.logoColor}</span>}
                  {cust.logoPlacement && <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-lg">Place: {cust.logoPlacement}</span>}
                  {cust.designNotes && <span className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded-lg">Notes: {cust.designNotes}</span>}
                  {item.logoCharges > 0 && <span className="bg-amber-500/10 text-amber-300 px-2 py-1 rounded-lg">Logo: {formatCurrency(item.logoCharges)}</span>}
                  {item.namePrintingCharges > 0 && <span className="bg-amber-500/10 text-amber-300 px-2 py-1 rounded-lg">Print: {formatCurrency(item.namePrintingCharges)}</span>}
                </div>
              </div>
            )}

            {/* Engraving */}
            {hasEng && (
              <div>
                <p className="text-[10px] font-black text-orange-400 uppercase mb-1.5 flex items-center gap-1"><Scissors size={10} /> Engraving</p>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  {item.engravingText && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">Text: {item.engravingText}</span>}
                  {item.engravingType && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">{item.engravingType}</span>}
                  {item.engravingNames && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">Names: {item.engravingNames}</span>}
                  {item.engravingLogos && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">Logos: {item.engravingLogos}</span>}
                  {item.engravingInstructions && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">{item.engravingInstructions}</span>}
                  {item.instructionNotes && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">{item.instructionNotes}</span>}
                </div>
                {(order.engravingInstructions || order.instructionNotes) && !item.engravingInstructions && !item.instructionNotes && (
                  <div className="flex flex-wrap gap-2 text-[10px] mt-1">
                    {order.engravingInstructions && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">Order: {order.engravingInstructions}</span>}
                    {order.instructionNotes && <span className="bg-orange-500/10 text-orange-300 px-2 py-1 rounded-lg">{order.instructionNotes}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderFinancialSummary = (order) => {
    const productPrice = parseFloat(order.totalPrice) || 0;
    const delivery = parseFloat(order.deliveryCharges) || 0;
    const total = productPrice;
    const advance = parseFloat(order.advanceAmount) || 0;
    return (
      <div className="bg-gray-900 rounded-xl p-4">
        <h4 className="text-xs font-black text-gray-400 uppercase mb-3 flex items-center gap-1"><DollarSign size={12} /> Financial Summary</h4>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-gray-400">Product Price</span><span className="font-bold text-white">{formatCurrency(productPrice)}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Delivery Charges</span><span className="font-bold text-white">{formatCurrency(delivery)}</span></div>
          {order.logoCharges > 0 && <div className="flex justify-between"><span className="text-gray-400">Logo Charges</span><span className="font-bold text-white">{formatCurrency(order.logoCharges)}</span></div>}
          {order.namePrintingCharges > 0 && <div className="flex justify-between"><span className="text-gray-400">Name Printing</span><span className="font-bold text-white">{formatCurrency(order.namePrintingCharges)}</span></div>}
          {order.customizationPrice > 0 && <div className="flex justify-between"><span className="text-gray-400">Customization</span><span className="font-bold text-white">{formatCurrency(order.customizationPrice)}</span></div>}
          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><span className="text-white font-black">Total Order Amount</span><span className="font-black text-amber-400">{formatCurrency(total)}</span></div>
          <div className="flex justify-between"><span className="text-emerald-400 font-bold">Advance Payment Received</span><span className="font-bold text-emerald-400">{formatCurrency(advance)}</span></div>
          <div className="flex justify-between border-t border-gray-700 pt-2 mt-2"><span className="text-orange-400 font-black">Remaining Balance</span><span className="font-black text-orange-400">{formatCurrency(Math.max(0, total - advance))}</span></div>
        </div>
      </div>
    );
  };

  const orders = activeTab === 'pending' ? pendingOrders : historyOrders;

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 rounded-2xl"><Shield size={24} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Order Verification</h1>
            <p className="text-sm text-gray-400">Review orders before Store allocation</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'pending' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><Clock size={16} /> Pending ({pendingOrders.length})</div>
          </button>
          <button onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><History size={16} /> Verified ({historyOrders.length})</div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order #, customer name, or phone..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-amber-500" />
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No {activeTab === 'pending' ? 'pending' : 'verified'} orders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const products = parseProducts(order.productDetails);
              const isExpanded = expandedOrder === order.id;
              return (
                <div key={order.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 cursor-pointer hover:bg-gray-750 transition-colors" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeTab === 'pending' ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                          {activeTab === 'pending' ? <Clock size={16} className="text-amber-400" /> : <CheckCircle size={16} className="text-emerald-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">{order.orderNumber || 'No #'}
                            {activeTab === 'history' && order.verifiedByName && <span className="text-xs text-emerald-400 ml-2">Verified by {order.verifiedByName}</span>}
                          </p>
                          <p className="text-xs text-gray-400">{order.customerName} • {order.customerPhone || 'No phone'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-black text-amber-400">{formatCurrency(order.totalPrice)}</p>
                          {activeTab === 'history' && (
                            <p className="text-[10px] text-gray-500">Advance: {formatCurrency(order.verifiedAdvanceAmount)}</p>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Full Job Sheet */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4 space-y-4">
                      {/* Customer Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Customer</p>
                          <p className="text-xs font-black text-white">{order.customerName}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Phone</p>
                          <p className="text-xs font-black text-white">{order.customerPhone || '-'}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Order #</p>
                          <p className="text-xs font-black text-blue-400">{order.orderNumber || '-'}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Type / Priority</p>
                          <p className="text-xs font-black text-white">{order.type} {order.priority !== 'NORMAL' && <span className="text-red-400">• {order.priority}</span>}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Invoice #</p>
                          <p className="text-xs font-black text-cyan-400">{order.invoiceNumber || '-'}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Address</p>
                          <p className="text-xs font-black text-white">{order.address || order.city || '-'}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Source</p>
                          <p className="text-xs font-black text-white">{order.source || '-'}</p>
                        </div>
                        <div className="bg-gray-900 rounded-lg p-3">
                          <p className="text-[10px] text-gray-500 uppercase">Created</p>
                          <p className="text-xs font-black text-gray-400">{formatDateTime(order.createdAt)}</p>
                        </div>
                      </div>

                      {/* Products with full details */}
                      {products.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1"><Package size={12} /> Products ({products.length})</h4>
                          {renderProductDetails(products, order)}
                        </div>
                      )}

                      {/* Logo Design toggle */}
                      {order.logoDesign && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                          <p className="text-[10px] font-black text-purple-400 uppercase">Logo Design</p>
                          <p className="text-xs font-bold text-purple-300">{order.logoDesign}</p>
                          {order.logoName && <p className="text-[10px] text-purple-400 mt-1">Logo: {order.logoName}</p>}
                        </div>
                      )}

                      {/* Financial Summary */}
                      {renderFinancialSummary(order)}

                      {/* History verified details */}
                      {activeTab === 'history' && order.verifiedAt && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2"><CheckCircle size={14} className="text-emerald-400" /><span className="text-xs font-black text-emerald-400 uppercase">Verification Details</span></div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div><span className="text-gray-400">Verified by</span><p className="font-bold text-white">{order.verifiedByName || '—'}</p></div>
                            <div><span className="text-gray-400">Verified at</span><p className="font-bold text-white">{formatDateTime(order.verifiedAt)}</p></div>
                            <div><span className="text-gray-400">Advance Received</span><p className="font-bold text-emerald-400">{formatCurrency(order.verifiedAdvanceAmount)}</p></div>
                            <div><span className="text-gray-400">Remaining Balance</span><p className="font-bold text-orange-400">{formatCurrency(order.verifiedRemainingBalance)}</p></div>
                          </div>
                          {order.verificationNote && <p className="text-[10px] text-gray-500 mt-2">Note: {order.verificationNote}</p>}
                        </div>
                      )}

                      {/* Action Buttons (Pending tab only) */}
                      {activeTab === 'pending' && (
                        <div className="flex gap-3">
                          <button onClick={() => { setVerifyModal(order); setAdvanceReceived(order.advanceAmount?.toString() || ''); setVerificationNote(''); }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                            <CheckCircle size={16} /> Verify & Send to Store
                          </button>
                          <button onClick={() => { setReturnModal(order); setReturnNote(''); }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black py-3 px-5 rounded-xl text-sm transition-all flex items-center gap-2">
                            <MessageSquare size={16} /> Changes Needed
                          </button>
                          <button onClick={() => handleMarkPending(order.id)}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-black py-3 px-5 rounded-xl text-sm transition-all">
                            <Clock size={16} className="inline mr-1" /> Mark Pending
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Verify Modal */}
      {verifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setVerifyModal(null)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-400" />
              <h3 className="text-lg font-black text-white">Verify Order</h3>
            </div>
            <p className="text-sm text-gray-400">Order: <span className="text-white font-black">{verifyModal.orderNumber}</span></p>
            <div className="bg-gray-900 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Total Amount</span><span className="font-black text-white">{formatCurrency(verifyModal.totalPrice)}</span></div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Advance Payment Received (PKR)</label>
              <input type="number" value={advanceReceived} onChange={e => setAdvanceReceived(e.target.value)} min="0"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white font-black text-lg outline-none focus:border-emerald-500" />
            </div>
            <div className="bg-gray-900 rounded-xl p-3 flex justify-between items-center">
              <span className="text-sm text-gray-400">Remaining Balance</span>
              <span className="text-lg font-black text-amber-400">{formatCurrency((verifyModal.totalPrice || 0) - (parseFloat(advanceReceived) || 0))}</span>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Note (optional)</label>
              <input value={verificationNote} onChange={e => setVerificationNote(e.target.value)} placeholder="Add a note..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setVerifyModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-black py-3 rounded-xl text-sm transition-all">Cancel</button>
              <button onClick={handleVerify} disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
                {submitting ? 'Verifying...' : 'Verify & Send to Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Faisal Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setReturnModal(null)}>
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <ArrowLeft size={20} className="text-amber-400" />
              <h3 className="text-lg font-black text-white">Return to Faisal</h3>
            </div>
            <p className="text-sm text-gray-400">Order: <span className="text-white font-black">{returnModal.orderNumber}</span></p>
            <p className="text-xs text-gray-500">Record what changes the customer requested. The order will be sent back to Faisal for corrections.</p>
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Changes Requested *</label>
              <textarea value={returnNote} onChange={e => setReturnNote(e.target.value)} rows={4} placeholder="e.g. Change scrub color to Navy Blue. Increase sleeve length by 2 inches."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-amber-500 resize-none" />
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-[10px] text-amber-400 font-bold">Changes will be recorded in the order notes. Faisal will update the order after reviewing your notes.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setReturnModal(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-black py-3 rounded-xl text-sm transition-all">Cancel</button>
              <button onClick={handleReturnToFaisal} disabled={submitting || !returnNote.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {submitting ? 'Returning...' : <><ArrowLeft size={16} /> Return to Faisal</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationPage;
