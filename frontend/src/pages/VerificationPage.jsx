import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Shield, Search, CheckCircle, Clock, User, Phone, Package, FileText, ChevronDown, ChevronUp, AlertCircle, DollarSign, ArrowRight, History } from 'lucide-react';
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

  const handleMarkPending = async (orderId) => {
    try {
      await api.post(`/api/verification/${orderId}/pending`, { verificationNote: 'Marked as pending by ' + (user?.name || 'verifier') });
      toast.success('Order marked as pending');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const parseProducts = (pd) => {
    if (!pd) return [];
    if (typeof pd === 'string') { try { return JSON.parse(pd); } catch { return []; } }
    if (Array.isArray(pd)) return pd;
    return [];
  };

  const formatCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;
  const formatDateTime = (d) => d ? new Date(d).toLocaleString() : '';

  const orders = activeTab === 'pending' ? pendingOrders : historyOrders;

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-600 rounded-2xl"><Shield size={24} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Order Verification</h1>
            <p className="text-sm text-gray-400">Review and verify orders before Store allocation</p>
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

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-700 p-4 space-y-4">
                      {/* Customer Info */}
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
                          <p className="text-[10px] text-gray-500 uppercase">Type</p>
                          <p className="text-xs font-black text-white">{order.type}</p>
                        </div>
                      </div>

                      {/* Products */}
                      <div>
                        <h4 className="text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1"><Package size={12} /> Products</h4>
                        <div className="space-y-2">
                          {products.map((item, i) => {
                            const pd = item.productDetails || item;
                            return (
                              <div key={i} className="bg-gray-900 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-black text-white">{pd.name || pd.productType || 'Product'}</p>
                                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-400">
                                      {pd.gender && <span className="text-blue-400">{pd.gender}</span>}
                                      {pd.fabric && <span>Fabric: {pd.fabric}</span>}
                                      {pd.color && <span>Color: {pd.color}</span>}
                                      {pd.size && <span>Size: {pd.size}</span>}
                                      {item.quantity && <span>Qty: {item.quantity}</span>}
                                    </div>
                                  </div>
                                  <span className="text-xs font-black text-amber-400">{formatCurrency(item.totalPrice)}</span>
                                </div>
                                {pd.matchingCap && <p className="text-[10px] text-purple-400 mt-1">Matching Cap × {pd.matchingCapQty || 1}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Financial Summary */}
                      <div className="bg-gray-900 rounded-lg p-4">
                        <h4 className="text-xs font-black text-gray-400 uppercase mb-2 flex items-center gap-1"><DollarSign size={12} /> Financial Summary</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm"><span className="text-gray-400">Total Order Amount</span><span className="font-black text-white">{formatCurrency(order.totalPrice)}</span></div>
                          <div className="flex justify-between text-sm"><span className="text-gray-400">Advance (entered)</span><span className="font-black text-emerald-400">{formatCurrency(order.advanceAmount)}</span></div>
                          {activeTab === 'history' && order.verifiedAdvanceAmount != null && (
                            <>
                              <div className="flex justify-between text-sm border-t border-gray-700 pt-1 mt-1">
                                <span className="text-gray-400">Verified Advance</span><span className="font-black text-amber-400">{formatCurrency(order.verifiedAdvanceAmount)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Remaining Balance</span><span className="font-black text-red-400">{formatCurrency(order.verifiedRemainingBalance)}</span>
                              </div>
                              {order.verifiedByName && <p className="text-[10px] text-gray-500 mt-1">Verified by {order.verifiedByName} on {formatDateTime(order.verifiedAt)}</p>}
                              {order.verificationNote && <p className="text-[10px] text-gray-500">Note: {order.verificationNote}</p>}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons (Pending tab only) */}
                      {activeTab === 'pending' && (
                        <div className="flex gap-3">
                          <button onClick={() => { setVerifyModal(order); setAdvanceReceived(order.advanceAmount?.toString() || ''); setVerificationNote(''); }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                            <CheckCircle size={16} /> Verify & Send to Store
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
    </div>
  );
};

export default VerificationPage;
