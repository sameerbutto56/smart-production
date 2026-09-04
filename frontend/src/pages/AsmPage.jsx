import React, { useState, useMemo, useEffect, useCallback } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import {
  Search, RefreshCcw, FileText, X, User, Phone, MapPin, Calendar,
  Hash, CreditCard, Package, Truck, Plus, CheckCircle2, Printer, Receipt,
  Download, ClipboardList, Building2, TrendingUp, Users, ArrowDownToLine, Ban, RotateCcw,
} from 'lucide-react';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';
import { printOrderDocument, printThermalReceipt } from '../utils/vendorDocumentPrint';

const STAGE_LABELS = {
  CREATED: 'Created',
  SUBMITTED: 'Submitted',
  ADMIN_APPROVED: 'Admin Approved',
  PRODUCTION_READY: 'Production Ready',
  GIVE_STOCK: 'Stock Given',
  ASM_ACCEPTED: 'Accepted by ASM',
  DELIVER: 'Deliver',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

const STAGE_COLORS = {
  CREATED: 'bg-slate-500',
  SUBMITTED: 'bg-amber-500',
  ADMIN_APPROVED: 'bg-blue-500',
  PRODUCTION_READY: 'bg-indigo-500',
  GIVE_STOCK: 'bg-violet-500',
  ASM_ACCEPTED: 'bg-cyan-500',
  DELIVER: 'bg-orange-500',
  DELIVERED: 'bg-green-500',
  COMPLETED: 'bg-emerald-600',
  CANCELLED: 'bg-red-500',
  REJECTED: 'bg-rose-600',
};

const FILTERS = ['ALL', 'SUBMITTED', 'ADMIN_APPROVED', 'PRODUCTION_READY', 'GIVE_STOCK', 'ASM_ACCEPTED', 'DELIVER', 'DELIVERED', 'COMPLETED'];

const fmtCurrency = (n) => `Rs. ${(n || 0).toLocaleString()}`;

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
      active ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`}
  >
    {label}
  </button>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="h-5 w-5 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white truncate">{value}</p>
      {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
    </div>
  </div>
);

const AsmPage = () => {
  const { t, isUrdu } = useLanguage();
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const flexDir = isUrdu ? 'flex-row-reverse' : '';

  const { data: ordersData, loading, error, refresh } = useCache('asm:vendor-orders', {
    fetcher: () => api.get('/api/vendors/orders').then((r) => r.data?.orders || []),
    ttl: 30000,
  });

  const { data: analytics } = useCache('asm:analytics', {
    fetcher: () => api.get('/api/vendors/analytics').then((r) => r.data || {}),
    ttl: 60000,
  });

  const { data: catalog } = useCache('asm:catalog', {
    fetcher: () => api.get('/api/vendors/catalog').then((r) => r.data?.items || []),
    ttl: 600000,
  });

  const { data: vendors } = useCache('asm:vendors', {
    fetcher: () => api.get('/api/vendors').then((r) => r.data?.vendors || []),
    ttl: 600000,
  });

  const orders = Array.isArray(ordersData) ? ordersData : [];

  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];
    let list = orders;
    if (filter !== 'ALL') list = list.filter((o) => o.status === filter || o.currentStage === filter);
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          String(o.orderNumber || '').toLowerCase().includes(q) ||
          String(o.vendor?.name || '').toLowerCase().includes(q) ||
          String(o.deliveryCity || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, filter, searchTerm]);

  const viewDetail = async (order) => {
    setSelectedOrder(order);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/api/vendors/orders/${order.id}`);
      if (res.data?.order) setSelectedOrder(res.data.order);
    } catch (err) {
      console.error('Failed to load vendor order detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => setSelectedOrder(null);

  const runAction = async (orderId, endpoint, successMsg, { confirmText, payload } = {}) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const toastId = toast.loading('Processing...');
    try {
      const res = await api.post(`/api/vendors/orders/${orderId}${endpoint}`, payload || {});
      toast.success(successMsg || res.data?.message || 'Done');
      refresh();
      if (selectedOrder?.id === orderId) viewDetail({ id: orderId });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handlePrint = async (orderVal, kind) => {
    let docOrder = orderVal;
    const hasDoc = docOrder?.documents?.length || docOrder?.quotationNumber || docOrder?.invoiceNumber;
    if (!hasDoc) {
      const toastId = toast.loading(t('Generating documents...'));
      try {
        const res = await api.post(`/api/vendors/orders/${docOrder.id}/generate-documents`, {});
        const rel = res.data?.order || {};
        toast.success(res.data?.message || t('Documents generated'));
        docOrder = { ...docOrder, ...rel, quotationNumber: rel.quotationNumber || docOrder.quotationNumber, invoiceNumber: rel.invoiceNumber || docOrder.invoiceNumber };
      } catch (err) {
        toast.error(err?.response?.data?.message || t('Failed to generate documents'));
        toast.dismiss(toastId);
        return;
      }
      toast.dismiss(toastId);
      refresh();
      if (selectedOrder?.id === docOrder.id) viewDetail({ id: docOrder.id });
    }
    if (kind === 'quotation') printOrderDocument(docOrder, 'quotation');
    else if (kind === 'invoice') printOrderDocument(docOrder, 'invoice');
    else printThermalReceipt(docOrder);
  };

  const [mainTab, setMainTab] = useState('vendor-orders'); // 'vendor-orders' | 'asm-stock'
  const [asmRequests, setAsmRequests] = useState([]);
  const [asmRequestsLoading, setAsmRequestsLoading] = useState(false);
  const [asmReturns, setAsmReturns] = useState([]);
  const [asmReturnsLoading, setAsmReturnsLoading] = useState(false);

  // Return Modal state
  const [returnModalRequest, setReturnModalRequest] = useState(null);
  const [returnItemQty, setReturnItemQty] = useState({}); // { itemId: quantity }
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const fetchAsmStockData = useCallback(async () => {
    setAsmRequestsLoading(true);
    setAsmReturnsLoading(true);
    try {
      const [reqRes, retRes] = await Promise.all([
        api.get('/api/asm-stock/requests'),
        api.get('/api/asm-stock/returns')
      ]);
      setAsmRequests(reqRes.data?.requests || []);
      setAsmReturns(retRes.data?.returns || []);
    } catch (err) {
      toast.error('Failed to load ASM stock data');
    }
    setAsmRequestsLoading(false);
    setAsmReturnsLoading(false);
  }, []);

  useEffect(() => {
    if (mainTab === 'asm-stock') fetchAsmStockData();
  }, [mainTab, fetchAsmStockData]);

  const handleAcceptStock = async (requestId) => {
    const toastId = toast.loading('Accepting stock handover...');
    try {
      const res = await api.post(`/api/asm-stock/requests/${requestId}/accept`);
      toast.success(res.data?.message || 'Stock handover accepted!');
      fetchAsmStockData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to accept stock');
    } finally {
      toast.dismiss(toastId);
    }
  };

  const openReturnModal = (reqData) => {
    setReturnModalRequest(reqData);
    const initialQtys = {};
    reqData.items.forEach(item => {
      if (item.quantityRemaining > 0) initialQtys[item.id] = 0;
    });
    setReturnItemQty(initialQtys);
    setReturnNotes('');
  };

  const handleCreateReturnSubmit = async () => {
    if (!returnModalRequest) return;

    const returnItems = [];
    Object.entries(returnItemQty).forEach(([requestItemId, qtyStr]) => {
      const q = parseInt(qtyStr) || 0;
      if (q > 0) {
        returnItems.push({ requestItemId, quantityReturned: q });
      }
    });

    if (returnItems.length === 0) {
      return toast.error('Enter a return quantity of at least 1 for at least one item');
    }

    setSubmittingReturn(true);
    try {
      const res = await api.post('/api/asm-stock/returns', {
        requestId: returnModalRequest.id,
        notes: returnNotes,
        items: returnItems
      });
      toast.success(`Return ${res.data?.returnRecord?.returnNumber} submitted for Store Verification!`);
      setReturnModalRequest(null);
      fetchAsmStockData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit return');
    }
    setSubmittingReturn(false);
  };

  const openCreate = () => setShowCreate(true);
  const closeCreate = () => setShowCreate(false);

  return (
    <div className="p-5 min-h-screen" dir={isUrdu ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-cyan-400" />
            {t('ASM Dashboard')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('Agent Sales Manager — vendor orders & operational analytics')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Main Tab Switcher */}
          <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex gap-1">
            <button onClick={() => setMainTab('vendor-orders')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${mainTab === 'vendor-orders' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Vendor Orders
            </button>
            <button onClick={() => setMainTab('asm-stock')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${mainTab === 'asm-stock' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>
              Incoming Stock / ASM Allowed {asmRequests.filter(r => r.status === 'SUBMITTED').length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{asmRequests.filter(r => r.status === 'SUBMITTED').length}</span>}
            </button>
          </div>
          {mainTab === 'vendor-orders' && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              <Plus className="h-4 w-4" />
              {t('New Vendor Order')}
            </button>
          )}
        </div>
      </div>

      {mainTab === 'asm-stock' && (
        <div className="space-y-6">
          {/* Section 1: Incoming Stock Handovers */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-400" /> Incoming Stock Handovers from Store
                </h2>
                <p className="text-xs text-slate-400">Verify physical stock against the printed handover sheet and click Accept</p>
              </div>
              <button onClick={fetchAsmStockData} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>

            {asmRequestsLoading ? (
              <p className="text-slate-500 text-center py-8 text-xs font-bold">Loading stock handovers...</p>
            ) : asmRequests.filter(r => r.status === 'SUBMITTED').length === 0 ? (
              <p className="text-slate-500 text-center py-8 text-xs font-bold">No pending incoming stock handovers</p>
            ) : (
              <div className="space-y-4">
                {asmRequests.filter(r => r.status === 'SUBMITTED').map(reqData => (
                  <div key={reqData.id} className="bg-slate-950 rounded-xl p-4 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-sm font-bold text-amber-400">{reqData.requestNumber}</span>
                        <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full uppercase">Pending ASM Acceptance</span>
                        <p className="text-xs text-slate-400 mt-1">
                          Store: <span className="text-slate-200">{reqData.storeName}</span> | Submitted by: <span className="text-slate-200">{reqData.submittedByName}</span> | {formatDateTime(reqData.submittedAt)}
                        </p>
                      </div>
                      <button onClick={() => handleAcceptStock(reqData.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/40">
                        <CheckCircle2 className="h-4 w-4" /> Accept Stock Handover
                      </button>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-800 pt-2">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-slate-800">
                            <th className="py-2">Product Name</th>
                            <th className="py-2">Category</th>
                            <th className="py-2">Color / Size</th>
                            <th className="py-2 text-right">Quantity Offered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqData.items.map(item => (
                            <tr key={item.id} className="border-b border-slate-800/40 text-slate-300">
                              <td className="py-2 font-bold text-white">{item.productName}</td>
                              <td className="py-2 text-slate-400">{item.category}</td>
                              <td className="py-2 text-slate-400">{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                              <td className="py-2 text-right font-bold text-amber-400">{item.quantityGiven} {item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Accepted Stock Inventory & Return Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Accepted Stock & ASM Returns
              </h2>
              <p className="text-xs text-slate-400">Manage accepted stock and return items back to Store (requires Store verification)</p>
            </div>

            {asmRequests.filter(r => ['ACCEPTED', 'PARTIALLY_RETURNED'].includes(r.status)).length === 0 ? (
              <p className="text-slate-500 text-center py-8 text-xs font-bold">No active accepted stock handovers</p>
            ) : (
              <div className="space-y-4">
                {asmRequests.filter(r => ['ACCEPTED', 'PARTIALLY_RETURNED'].includes(r.status)).map(reqData => (
                  <div key={reqData.id} className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-sm font-bold text-emerald-400">{reqData.requestNumber}</span>
                        <span className="ml-2 text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full uppercase">
                          {reqData.status}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          Accepted on: {formatDateTime(reqData.acceptedAt)}
                        </p>
                      </div>
                      <button onClick={() => openReturnModal(reqData)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                        <RotateCcw className="h-4 w-4" /> Return Stock to Store
                      </button>
                    </div>

                    <div className="overflow-x-auto border-t border-slate-800 pt-2">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 font-bold uppercase border-b border-slate-800">
                            <th className="py-2">Product</th>
                            <th className="py-2">Color / Size</th>
                            <th className="py-2 text-right">Given</th>
                            <th className="py-2 text-right">Returned</th>
                            <th className="py-2 text-right">Remaining with ASM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reqData.items.map(item => (
                            <tr key={item.id} className="border-b border-slate-800/40 text-slate-300">
                              <td className="py-2 font-bold text-white">{item.productName}</td>
                              <td className="py-2 text-slate-400">{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                              <td className="py-2 text-right font-bold text-slate-400">{item.quantityGiven}</td>
                              <td className="py-2 text-right font-bold text-emerald-400">{item.quantityReturned}</td>
                              <td className="py-2 text-right font-bold text-amber-400">{item.quantityRemaining}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Submitted Returns Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-purple-400" /> Submitted ASM Returns Track
            </h2>
            {asmReturns.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-xs font-bold">No returned stock requests submitted yet</p>
            ) : (
              <div className="space-y-3">
                {asmReturns.map(retRec => (
                  <div key={retRec.id} className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-400">{retRec.returnNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${retRec.status === 'STORE_ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {retRec.status === 'STORE_ACCEPTED' ? '✓ Accepted by Store' : '⏳ Pending Store Verification'}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Handover #: <span className="text-slate-200">{retRec.request?.requestNumber}</span> | Submitted: {formatDateTime(retRec.submittedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-900">
                      {retRec.items.map(i => (
                        <span key={i.id} className="bg-slate-900 px-2 py-1 rounded text-[11px] text-slate-300">
                          {i.productName} ({[i.color, i.size].filter(Boolean).join('/')}): <strong className="text-emerald-400">+{i.quantityReturned}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return Modal */}
          {returnModalRequest && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-base">
                    Return ASM Stock to Store ({returnModalRequest.requestNumber})
                  </h3>
                  <button onClick={() => setReturnModalRequest(null)} className="text-slate-400 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Select the quantity of each product you are returning. Returned stock will enter Store Verification before being restored to inventory.
                </p>

                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {returnModalRequest.items.map(item => (
                    item.quantityRemaining > 0 && (
                      <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{item.productName}</p>
                          <p className="text-[10px] text-slate-400">
                            {[item.color, item.size].filter(Boolean).join(' / ')} | Remaining: <strong className="text-amber-400">{item.quantityRemaining}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px]">Return Qty:</span>
                          <input type="number" min="0" max={item.quantityRemaining}
                            value={returnItemQty[item.id] || 0}
                            onChange={e => setReturnItemQty({ ...returnItemQty, [item.id]: Math.min(item.quantityRemaining, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center font-bold outline-none" />
                        </div>
                      </div>
                    )
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Return Notes / Reason</label>
                  <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)}
                    placeholder="Reason for return..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none" />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => setReturnModalRequest(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">
                    Cancel
                  </button>
                  <button onClick={handleCreateReturnSubmit} disabled={submittingReturn}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs flex items-center gap-1.5">
                    {submittingReturn ? 'Submitting Return...' : 'Submit Return to Store'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mainTab === 'vendor-orders' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
            <StatCard icon={ClipboardList} label={t('Total Orders')} value={orders.length} color="bg-slate-700" />
            <StatCard icon={TrendingUp} label={t('Active')} value={analytics?.active ?? 0} color="bg-blue-600" />
            <StatCard icon={ClockIcon} label={t('Pending')} value={analytics?.pending ?? 0} color="bg-amber-600" />
            <StatCard icon={Package} label={t('Completed')} value={analytics?.completed ?? 0} color="bg-emerald-600" />
            <StatCard icon={Users} label={t('Vendors')} value={analytics?.vendorCount ?? 0} color="bg-violet-600" />
            <StatCard icon={CreditCard} label={t('Payments')} value={fmtCurrency(analytics?.totalPayments)} color="bg-cyan-600" />
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('Search order #, vendor, city...')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <button onClick={refresh} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition">
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {FILTERS.map((f) => (
                <FilterChip key={f} label={f === 'ALL' ? t('All') : t(STAGE_LABELS[f] || f)} active={filter === f} onClick={() => setFilter(f)} />
              ))}
            </div>

            {loading ? (
              <p className="text-slate-400 text-center py-8">{t('Loading...')}</p>
            ) : error ? (
              <p className="text-red-400 text-center py-8">{t('Error loading vendor orders')}</p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">{t('No vendor orders found')}</p>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((o) => (
                  <OrderRow key={o.id} order={o} onOpen={viewDetail} flexDir={flexDir} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {selectedOrder && (
        <OrderDetailDrawer order={selectedOrder} loading={loadingDetail} onClose={closeDetail} runAction={runAction} onPrint={handlePrint} flexDir={flexDir} />
      )}

      {showCreate && (
        <CreateOrderModal
          catalog={Array.isArray(catalog) ? catalog : []}
          vendors={Array.isArray(vendors) ? vendors : []}
          onClose={closeCreate}
          onCreated={() => { closeCreate(); refresh(); }}
        />
      )}
    </div>
  );
};

import { Clock as ClockIcon } from 'lucide-react';

const OrderRow = ({ order, onOpen, flexDir }) => {
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  const stage = order.status || order.currentStage;
  const color = STAGE_COLORS[stage] || 'bg-slate-500';
  const itemsCount = (order.items || []).length;
  const totalUnits = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <button
      onClick={() => onOpen(order)}
      className={`w-full text-left bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 border border-slate-700/50 transition ${flexDir}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">{order.orderNumber}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${color}`}>
            {STAGE_LABELS[stage] || stage}
          </span>
          {remaining > 0.01 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {t('Balance')}
            </span>
          )}
        </div>
        <div className="flex items-center text-xs text-slate-400">
          <User className="h-3.5 w-3.5 mr-1" />
          {order.vendor?.name || (order.vendorId ? order.vendorId.slice(0, 8) : '—')}
          {order.deliveryCity ? ` (${order.deliveryCity})` : ''}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>{itemsCount} {t('item(s)')} · {totalUnits} {t('units')}</span>
          <span className="font-semibold text-white">{fmtCurrency(order.grandTotal)}</span>
        </div>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDateOnly(order.createdAt)}
        </span>
      </div>
    </button>
  );
};

const OrderDetailDrawer = ({ order, loading, onClose, runAction, onPrint, flexDir }) => {
  const { t } = useLanguage();
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [showDeliverForm, setShowDeliverForm] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [address, setAddress] = useState(order.deliveryAddress || '');
  const [city, setCity] = useState(order.deliveryCity || '');

  const payments = Array.isArray(order.payments) ? order.payments : [];
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  const stage = order.status || order.currentStage;

  const recordPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return toast.error(t('Enter a positive amount'));
    await runAction(order.id, `/pay`, t('Payment recorded'), {
      payload: { amount: amt, paymentMethod: payMethod },
    });
    setPayAmount('');
    setShowPayForm(false);
  };

  const doDeliver = async () => {
    await runAction(order.id, `/deliver`, t('Order delivered'), {
      payload: { carrier, address, city, notes: order.notes || '' },
    });
    setShowDeliverForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
      <div className={`w-full max-w-xl bg-slate-900 h-full shadow-2xl flex flex-col ${flexDir}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-cyan-400" />
            {order.orderNumber}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <p className="text-slate-400 text-center py-8">{t('Loading...')}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${STAGE_COLORS[stage] || 'bg-slate-500'}`}>
                  {STAGE_LABELS[stage] || stage}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  remaining > 0.01 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {remaining > 0.01 ? `${t('Balance')}: ${fmtCurrency(remaining)}` : t('Paid')}
                </span>
              </div>

              <InfoRow icon={User} label={t('Vendor')} value={order.vendor?.name} />
              <InfoRow icon={Phone} label={t('Phone')} value={order.vendor?.phone} />
              <InfoRow icon={Hash} label={t('Quotation')} value={order.quotationNumber} />
              <InfoRow icon={Hash} label={t('Invoice')} value={order.invoiceNumber} />
              {order.deliveryAddress ? <InfoRow icon={MapPin} label={t('Address')} value={order.deliveryAddress} /> : null}
              {order.deliveryCity ? <InfoRow icon={MapPin} label={t('City')} value={order.deliveryCity} /> : null}
              {order.createdAt ? <InfoRow icon={Calendar} label={t('Created')} value={formatDateTime(order.createdAt)} /> : null}
              {order.notes ? <InfoRow icon={ClipboardList} label={t('Notes')} value={order.notes} /> : null}

              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('Items')}</h3>
                <div className="space-y-2">
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm gap-2">
                      <div className="min-w-0">
                        <p className="text-white truncate">{it.productName} {it.color ? `· ${it.color}` : ''} {it.size ? `· ${it.size}` : ''}</p>
                        <p className="text-xs text-slate-500">{it.quantity} × {fmtCurrency(it.unitPrice)}</p>
                      </div>
                      <p className="text-white font-semibold whitespace-nowrap">{fmtCurrency(it.lineTotal)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700 mt-3 pt-2 space-y-1 text-sm">
                  {(order.deliveryCharges || 0) > 0 && (
                    <div className="flex justify-between text-slate-400"><span>{t('Delivery')}</span><span>{fmtCurrency(order.deliveryCharges)}</span></div>
                  )}
                  {(order.discount || 0) > 0 && (
                    <div className="flex justify-between text-slate-400"><span>{t('Discount')}</span><span>-{fmtCurrency(order.discount)}</span></div>
                  )}
                  <div className="flex justify-between text-white font-bold"><span>{t('Grand Total')}</span><span>{fmtCurrency(order.grandTotal)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>{t('Paid')}</span><span>{fmtCurrency(totalPaid)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>{t('Remaining')}</span><span>{fmtCurrency(remaining)}</span></div>
                </div>
              </div>

              {payments.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('Payments')}</h3>
                  <div className="space-y-1 text-sm">
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>{p.paymentType} · {p.paymentMethod} {p.reference ? `(${p.reference})` : ''}</span>
                        <span className="text-white font-semibold">{fmtCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('Timeline')}</h3>
                <div className="space-y-1 text-xs text-slate-400">
                  {(order.statusHistory || []).map((h, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                      <div>
                        <span className="text-slate-200 font-medium">{h.fromStage || '—'} → {h.toStage}</span>
                        <span className="ml-2 text-slate-500">{formatDateTime(h.createdAt)}</span>
                        {h.remarks ? <p className="text-slate-500">{h.remarks} {h.changedBy ? `· ${h.changedBy}` : ''}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {stage === 'GIVE_STOCK' && (
                  <ActionBtn icon={CheckCircle2} color="bg-cyan-600 hover:bg-cyan-500" label={t('Accept Stock')}
                    onClick={() => runAction(order.id, `/accept`, t('Stock accepted'), { confirmText: t('Accept this stock?') })} />
                )}

                {(stage === 'ASM_ACCEPTED' || stage === 'DELIVER') && !showDeliverForm && (
                  <ActionBtn icon={Truck} color="bg-green-600 hover:bg-green-500" label={t('Deliver to Vendor')}
                    onClick={() => setShowDeliverForm(true)} />
                )}

                {stage === 'DELIVERED' && (
                  <ActionBtn icon={CheckCircle2} color="bg-emerald-600 hover:bg-emerald-500" label={t('Mark Completed')}
                    onClick={() => runAction(order.id, `/complete`, t('Order completed'), { confirmText: t('Mark this order completed?') })} />
                )}

                {remaining > 0.01 && !showPayForm && (
                  <ActionBtn icon={CreditCard} color="bg-amber-600 hover:bg-amber-500" label={`${t('Record Payment')} · ${fmtCurrency(remaining)}`}
                    onClick={() => setShowPayForm(true)} />
                )}

                <ActionBtn icon={Printer} color="bg-indigo-600 hover:bg-indigo-500" label={t('Print Quotation')}
                  onClick={() => onPrint(order, 'quotation')} />
                <ActionBtn icon={FileText} color="bg-blue-600 hover:bg-blue-500" label={t('Print Invoice')}
                  onClick={() => onPrint(order, 'invoice')} />
                <ActionBtn icon={Receipt} color="bg-slate-700 hover:bg-slate-600" label={t('Thermal')}
                  onClick={() => onPrint(order, 'thermal')} />

                {(stage === 'SUBMITTED' || stage === 'ADMIN_APPROVED' || stage === 'PRODUCTION_READY') && (
                  <ActionBtn icon={Ban} color="bg-slate-700 hover:bg-slate-600" label={t('Awaiting Admin')}
                    onClick={() => toast(t('This order is awaiting admin action'))} />
                )}
              </div>

              {showPayForm && (
                <div className="bg-slate-800 rounded-lg p-4 border border-amber-500/30">
                  <h3 className="text-sm font-semibold text-amber-400 mb-3">{t('Record Payment')}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400">{t('Amount')}</label>
                      <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={String(remaining || 0)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">{t('Method')}</label>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                        <option value="CASH">CASH</option>
                        <option value="ONLINE">ONLINE</option>
                        <option value="BANK_TRANSFER">BANK TRANSFER</option>
                        <option value="CHEQUE">CHEQUE</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <ActionBtn icon={CheckCircle2} color="bg-amber-600 hover:bg-amber-500" label={t('Save')} onClick={recordPayment} />
                      <button onClick={() => setShowPayForm(false)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm">{t('Cancel')}</button>
                    </div>
                  </div>
                </div>
              )}

              {showDeliverForm && (
                <div className="bg-slate-800 rounded-lg p-4 border border-green-500/30">
                  <h3 className="text-sm font-semibold text-green-400 mb-3">{t('Deliver to Vendor')}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400">{t('Carrier')}</label>
                      <input value={carrier} onChange={(e) => setCarrier(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={t('e.g. Company vehicle / TCS / PostEx')} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">{t('Delivery Address')}</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">{t('City')}</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <ActionBtn icon={Truck} color="bg-green-600 hover:bg-green-500" label={t('Confirm Delivery')} onClick={doDeliver} />
                      <button onClick={() => setShowDeliverForm(false)} className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm">{t('Cancel')}</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-4 w-4 text-slate-500 shrink-0" />
      <span className="text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-white break-words">{value}</span>
    </div>
  );
};

const ActionBtn = ({ icon: Icon, color, label, onClick }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-semibold transition ${color}`}>
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

const vendorVariants = (item) => {
  if (!item) return [];
  const v = item.variants;
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'string') {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p; } catch (e) { /* ignore */ }
  }
  return [];
};

const uniqValues = (variants, key) =>
  [...new Set(variants.map((x) => (x && x[key] ? String(x[key]).trim() : '')).filter(Boolean))];

const VendorFormModal = ({ onClose, onCreated }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: '', companyName: '', phone: '', email: '', address: '', city: '', contactPerson: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.name.trim()) return toast.error(t('Vendor name is required'));
    setSubmitting(true);
    try {
      const res = await api.post('/api/vendors', form);
      toast.success(t('New vendor created'));
      onCreated(res.data?.vendor);
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(err?.response?.data?.message || t('A vendor with this name already exists.'));
      } else {
        toast.error(err?.response?.data?.message || t('Failed to create vendor'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label, key, type = 'text', opts = {}) => (
    <div>
      <label className="text-xs text-slate-400">{t(label)}</label>
      <input
        type={type}
        value={form[key] || ''}
        onChange={(e) => set(key, e.target.value)}
        placeholder={opts.placeholder ? t(opts.placeholder) : ''}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-400" />
            {t('Create New Vendor')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field('Vendor Name *', 'name')}
            {field('Company Name', 'companyName')}
            {field('Phone Number', 'phone')}
            {field('Email', 'email', 'email')}
            {field('City', 'city')}
            {field('Contact Person', 'contactPerson')}
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">{t('Address')}</label>
              <input value={form.address || ''} onChange={(e) => set('address', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400">{t('Notes')}</label>
              <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows="2"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={submitting}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {submitting ? t('Saving...') : t('Create & Save Vendor')}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-200 text-sm">{t('Cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const emptyLine = () => ({ catalogItemId: '', productName: '', category: '', color: '', size: '', articleName: '', articleNumber: '', unit: '', variant: '', quantity: 1, unitPrice: '' });

const CreateOrderModal = ({ catalog, vendors, onClose, onCreated }) => {
  const { t } = useLanguage();
  const [localVendors, setLocalVendors] = useState(Array.isArray(vendors) ? vendors : []);
  const [vendorId, setVendorId] = useState(localVendors[0]?.id || '');
  const [lineItems, setLineItems] = useState([emptyLine()]);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [deliveryCharges, setDeliveryCharges] = useState('');
  const [discount, setDiscount] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [resultsOpen, setResultsOpen] = useState(null);

  const updateLine = (idx, field, value) => {
    setLineItems((prev) => prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li)));
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  // Resolve variants for a given line from its selected catalog item
  const lineItem = (idx) => catalog.find((c) => c.id === lineItems[idx]?.catalogItemId) || null;
  const lineVariants = (idx) => vendorVariants(lineItem(idx));
  const lineColors = (idx) => uniqValues(lineVariants(idx), 'color');
  const lineSizes = (idx) => uniqValues(lineVariants(idx), 'size');

  // A line is an "Other" manual product when it is not linked to a catalog item
  const lineIsOther = (idx) => !lineItems[idx]?.catalogItemId;

  // Filter the catalog by name / article / color / size / variant (case-insensitive)
  const filteredCatalog = (idx) => {
    const q = (catalogSearch || '').trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => {
      const haystack = [
        c.name, c.category, c.id,
        ...(Array.isArray(c.variants) ? c.variants : [])
          .flatMap((v) => [v.articleName, v.articleNumber, v.unit, v.variant, v.color, v.size]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  };

  // Set a line to manual "Other" mode (clears catalog link, keeps typed product name)
  const markAsOther = (idx) => {
    setResultsOpen(null);
    setLineItems((prev) => prev.map((li, i) =>
      i === idx ? { ...li, catalogItemId: '', category: null } : li
    ));
  };

  // When an item is picked, load its real variants into per-line color/size dropdowns
  const selectCatalogItem = (idx, cid) => {
    const item = catalog.find((c) => c.id === cid);
    if (!item) return;
    const firstVariant = vendorVariants(item)[0] || {};
    const defaultColor = lineColors(idx)[0] || firstVariant.color || '';
    const defaultSize = lineSizes(idx)[0] || firstVariant.size || '';
    setResultsOpen((prev) => (prev === idx ? null : prev));
    setLineItems((prev) => prev.map((li, i) =>
      i === idx
        ? {
            ...li,
            catalogItemId: cid,
            productName: item.name || item.category || '',
            category: item.category || null,
            color: defaultColor,
            size: defaultSize,
            unitPrice: firstVariant.price != null ? firstVariant.price : (item.price || ''),
          }
        : li
    ));
  };

  const pickCatalogResult = (idx, cid) => {
    selectCatalogItem(idx, cid);
    setCatalogSearch('');
  };

  const submit = async () => {
    if (!vendorId) return toast.error(t('Select a vendor'));
    const items = lineItems
      .filter((li) => li.productName || li.catalogItemId)
      .map((li) => ({
        catalogItemId: li.catalogItemId || null,
        productName: li.productName,
        productType: li.category || null,
        color: li.color || null,
        size: li.size || null,
        articleName: li.articleName || null,
        articleNumber: li.articleNumber || null,
        unit: li.unit || null,
        variant: li.variant || null,
        quantity: parseInt(li.quantity, 10) || 1,
        unitPrice: parseFloat(li.unitPrice) || 0,
        notes: null,
      }));
    if (!items.length) return toast.error(t('At least one product line is required'));
    const advance = parseFloat(advanceAmount);
    setSubmitting(true);
    try {
      await api.post('/api/vendors/orders', {
        vendorId,
        items,
        deliveryCharges: parseFloat(deliveryCharges) || 0,
        discount: parseFloat(discount) || 0,
        notes: notes || null,
        deliveryAddress: deliveryAddress || null,
        deliveryCity: deliveryCity || null,
        payments: advance > 0 ? [{ amount: advance, paymentType: 'ADVANCE', paymentMethod: 'CASH' }] : [],
      });
      toast.success(t('Vendor order created & submitted for approval'));
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('Failed to create order'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="h-5 w-5 text-cyan-400" />
            {t('New Vendor Order')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">{t('Vendor')} *</label>
              <div className="flex gap-2">
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                  {localVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button onClick={() => setShowVendorForm(true)}
                  className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition">
                  <Plus className="h-4 w-4" /> {t('New Vendor')}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('City')}</label>
              <input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('Product Lines')}</h3>
            <div className="space-y-3">
              {lineItems.map((li, idx) => {
                const colors = lineColors(idx);
                const sizes = lineSizes(idx);
                return (
                  <div key={idx} className="bg-slate-900 rounded-lg p-3 border border-slate-700/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{t('Line')} {idx + 1}</span>
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300 text-xs"><X className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-400">{t('Product')} *</label>
                        <div className="relative">
                          <div className="flex gap-1.5">
                            <input
                              value={lineIsOther(idx) ? li.productName : catalogSearch}
                              onChange={(e) => { setCatalogSearch(e.target.value); updateLine(idx, 'productName', e.target.value); updateLine(idx, 'catalogItemId', ''); setResultsOpen(idx); }}
                              onFocus={() => setResultsOpen(idx)}
                              onBlur={() => setTimeout(() => setResultsOpen(null), 150)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                              placeholder={t('Type to search catalog or choose Other...')}
                            />
                            {lineIsOther(idx) && (
                              <button type="button" onClick={() => setResultsOpen(null)}
                                className="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold">
                                {t('Manual')}
                              </button>
                            )}
                          </div>
                          {resultsOpen === idx && (
                            <div className="absolute z-20 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => markAsOther(idx)}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-slate-700 border-b border-slate-700"
                              >
                                + {t('Other (manual product)')}
                              </button>
                              {filteredCatalog(idx).map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={(e) => { e.preventDefault(); pickCatalogResult(idx, c.id); }}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                                >
                                  <span className="font-medium">{c.name || c.category || c.id}</span>
                                  <span className="block text-xs text-slate-500">{c.category} {c.id}</span>
                                </button>
                              ))}
                              {filteredCatalog(idx).length === 0 && (
                                <div className="px-3 py-2 text-xs text-slate-500">{t('No catalog match')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {lineIsOther(idx) && (
                        <>
                          <div>
                            <label className="text-xs text-slate-400">{t('Article Name / Number')}</label>
                            <input value={li.articleName} onChange={(e) => updateLine(idx, 'articleName', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">{t('Article Number')}</label>
                            <input value={li.articleNumber} onChange={(e) => updateLine(idx, 'articleNumber', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">{t('Unit')}</label>
                            <input value={li.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" placeholder={t('e.g. pcs')} />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">{t('Variant')}</label>
                            <input value={li.variant} onChange={(e) => updateLine(idx, 'variant', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                          </div>
                        </>
                      )}
                      {colors.length > 0 ? (
                        <div>
                          <label className="text-xs text-slate-400">{t('Color')}</label>
                          <select value={li.color} onChange={(e) => updateLine(idx, 'color', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                            <option value="">{t('Select color')}</option>
                            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-slate-400">{t('Color')}</label>
                          <input value={li.color} onChange={(e) => updateLine(idx, 'color', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                      )}
                      {sizes.length > 0 ? (
                        <div>
                          <label className="text-xs text-slate-400">{t('Size')}</label>
                          <select value={li.size} onChange={(e) => updateLine(idx, 'size', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                            <option value="">{t('Select size')}</option>
                            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-slate-400">{t('Size')}</label>
                          <input value={li.size} onChange={(e) => updateLine(idx, 'size', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-slate-400">{t('Quantity')}</label>
                        <input type="number" min="1" value={li.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">{t('Unit Price')}</label>
                        <input type="number" min="0" value={li.unitPrice} onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={addLine} className="mt-3 text-cyan-400 hover:text-cyan-300 text-sm font-medium flex items-center gap-1">
              <Plus className="h-4 w-4" /> {t('Add Line')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">{t('Delivery Charges')}</label>
              <input type="number" min="0" value={deliveryCharges} onChange={(e) => setDeliveryCharges(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('Discount')}</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">{t('Advance Payment')}</label>
              <input type="number" min="0" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">{t('Delivery Address')}</label>
            <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">{t('Notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={submitting}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {submitting ? t('Creating...') : t('Create & Submit for Approval')}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-slate-700 text-slate-200 text-sm">{t('Cancel')}</button>
          </div>
        </div>
      </div>
      {showVendorForm && (
        <VendorFormModal
          onClose={() => setShowVendorForm(false)}
          onCreated={(vendor) => {
            if (vendor?.id) {
              setLocalVendors((prev) => {
                if (prev.some((v) => v.id === vendor.id)) return prev;
                return [...prev, vendor];
              });
              setVendorId(vendor.id);
              setShowVendorForm(false);
            }
          }}
        />
      )}
    </div>
  );
};

export default AsmPage;
