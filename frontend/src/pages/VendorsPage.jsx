import React, { useState, useMemo } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import {
  Search, RefreshCcw, Plus, X, Building2, Phone, Mail, MapPin, Users,
  ClipboardList, TrendingUp, CreditCard, Package, CheckCircle2, Ban, Truck, Eye, Hash,
  ArrowDownToLine, Printer, FileText, Receipt,
} from 'lucide-react';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

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

const FILTERS = ['ALL', 'SUBMITTED', 'ADMIN_APPROVED', 'PRODUCTION_READY', 'GIVE_STOCK', 'ASM_ACCEPTED', 'DELIVER', 'DELIVERED', 'COMPLETED', 'REJECTED'];

const fmtCurrency = (n) => `Rs. ${(n || 0).toLocaleString()}`;

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
      active ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

const VendorsPage = () => {
  const { t, isUrdu } = useLanguage();
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [asmFilter, setAsmFilter] = useState('');
  const [showPayments, setShowPayments] = useState(false);

  const flexDir = isUrdu ? 'flex-row-reverse' : '';

  const { data: vendorsData, loading: vendorsLoading, refresh: refreshVendors } = useCache('vendors:list', {
    fetcher: () => api.get('/api/vendors').then((r) => r.data?.vendors || []),
    ttl: 60000,
  });

  const { data: ordersData, loading: ordersLoading, error: ordersError, refresh: refreshOrders } = useCache('vendors:orders', {
    fetcher: async () => {
      const params = {};
      if (asmFilter) params.asmId = asmFilter;
      return api.get('/api/vendors/orders', { params }).then((r) => r.data?.orders || []);
    },
    ttl: 30000,
  });

  const { data: analytics, refresh: refreshAnalytics } = useCache('vendors:analytics', {
    fetcher: () => api.get('/api/vendors/analytics').then((r) => r.data || {}),
    ttl: 60000,
  });

  const { data: asmList } = useCache('vendors:asm', {
    fetcher: () => api.get('/api/vendors/asm').then((r) => r.data?.asm || r.data?.users || []),
    ttl: 60000,
  });

  const { data: paymentsData, refresh: refreshPayments } = useCache('vendors:payments', {
    fetcher: () => api.get('/api/vendors/payments').then((r) => r.data?.payments || []),
    ttl: 60000,
  });

  const vendors = Array.isArray(vendorsData) ? vendorsData : [];
  const orders = Array.isArray(ordersData) ? ordersData : [];
  const payments = Array.isArray(paymentsData) ? paymentsData : [];

  const vendorById = useMemo(() => {
    const m = {};
    vendors.forEach((v) => (m[v.id] = v));
    return m;
  }, [vendors]);

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
          String(o.deliveryCity || '').toLowerCase().includes(q) ||
          String(o.asm?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, filter, searchTerm]);

  const refreshAll = () => {
    refreshOrders();
    refreshVendors();
    refreshAnalytics();
    refreshPayments();
  };

  const viewOrder = async (order) => {
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

  const runAction = async (orderId, endpoint, successMsg, { confirmText, payload } = {}) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const toastId = toast.loading('Processing...');
    try {
      const res = await api.post(`/api/vendors/orders/${orderId}${endpoint}`, payload || {});
      toast.success(successMsg || res.data?.message || 'Done');
      refreshAll();
      if (selectedOrder?.id === orderId) viewOrder({ id: orderId });
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
      const toastId = toast.loading('Generating documents...');
      try {
        const res = await api.post(`/api/vendors/orders/${docOrder.id}/generate-documents`, {});
        const rel = res.data?.order || {};
        toast.success(res.data?.message || 'Documents generated');
        docOrder = { ...docOrder, ...rel, quotationNumber: rel.quotationNumber || docOrder.quotationNumber, invoiceNumber: rel.invoiceNumber || docOrder.invoiceNumber };
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to generate documents');
        toast.dismiss(toastId);
        return;
      }
      toast.dismiss(toastId);
      refreshAll();
      if (selectedOrder?.id === docOrder.id) viewOrder({ id: docOrder.id });
    }
    if (kind === 'quotation') printOrderDocument(docOrder, 'quotation');
    else if (kind === 'invoice') printOrderDocument(docOrder, 'invoice');
    else printThermalReceipt(docOrder);
  };

  const openVendor = (v) => setSelectedVendor(v);
  const closeVendor = () => setSelectedVendor(null);

  return (
    <div className="p-5 min-h-screen" dir={isUrdu ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-400" />
            {t('Admin Vendors')}
          </h1>
          <p className="text-sm text-slate-400">
            {t('Manage vendors & vendor orders — approve, give stock, record payments')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPayments((s) => !s)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <CreditCard className="h-4 w-4" />
            {t('Payments')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="h-4 w-4" />
            {t('New Vendor')}
          </button>
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
          <StatCard icon={ClipboardList} label={t('Total Orders')} value={orders.length} color="bg-slate-700" />
          <StatCard icon={TrendingUp} label={t('Active')} value={analytics.active ?? 0} color="bg-blue-600" />
          <StatCard icon={Ban} label={t('Pending')} value={analytics.pending ?? 0} color="bg-amber-600" />
          <StatCard icon={CheckCircle2} label={t('Completed')} value={analytics.completed ?? 0} color="bg-emerald-600" />
          <StatCard icon={Users} label={t('Vendors')} value={analytics.vendorCount ?? vendors.length} color="bg-violet-600" />
          <StatCard icon={CreditCard} label={t('Payments')} value={fmtCurrency(analytics.totalPayments)} color="bg-cyan-600" />
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-5">
        {/* Vendors sidebar */}
        <div className="lg:col-span-1 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            {t('Vendors')} ({vendors.length})
          </h2>
          {vendorsLoading ? (
            <p className="text-slate-400 text-center py-6 text-sm">{t('Loading...')}</p>
          ) : vendors.length === 0 ? (
            <p className="text-slate-500 text-center py-6 text-sm">{t('No vendors yet.')}</p>
          ) : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => openVendor(v)}
                  className={`w-full text-left bg-slate-800/50 hover:bg-slate-800 rounded-lg p-2.5 border transition ${
                    selectedVendor?.id === v.id ? 'border-blue-500 bg-slate-800' : 'border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm truncate">{v.name}</span>
                    {!v.isActive && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        {t('Inactive')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {v.companyName || v.city || '—'} · {v._count?.orders ?? 0} {t('orders')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Orders list */}
        <div className="lg:col-span-3 bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search order #, vendor, city, ASM...')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={asmFilter}
              onChange={(e) => setAsmFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="">{t('All ASMs')}</option>
              {(Array.isArray(asmList) ? asmList : []).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button onClick={refreshAll} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {FILTERS.map((f) => (
              <FilterChip key={f} label={f === 'ALL' ? t('All') : t(STAGE_LABELS[f] || f)} active={filter === f} onClick={() => setFilter(f)} />
            ))}
          </div>

          {ordersLoading ? (
            <p className="text-slate-400 text-center py-8">{t('Loading...')}</p>
          ) : ordersError ? (
            <p className="text-red-400 text-center py-8">{t('Failed to load orders.')}</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-slate-500 text-center py-10">{t('No vendor orders found.')}</p>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {filteredOrders.map((o) => (
                <AdminOrderRow key={o.id} order={o} onOpen={viewOrder} onReject={(id) => {
                  const reason = window.prompt('Rejection reason:');
                  if (reason === null) return;
                  runAction(id, '/reject', null, { payload: { reason } });
                }} onAction={(id, endpoint, label, confirm) => runAction(id, endpoint, null, { confirmText: confirm })} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vendor detail modal */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          vendorWithOrders={vendorById[selectedVendor.id]}
          onClose={closeVendor}
          onOpenOrder={viewOrder}
          onRefresh={refreshAll}
          t={t}
        />
      )}

      {/* Order detail drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedOrder(null)} />
          <div className="relative ml-auto w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full overflow-y-auto">
            {loadingDetail ? (
              <p className="text-slate-400 text-center py-16">{t('Loading...')}</p>
            ) : (
              <OrderDetailDrawer
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                runAction={runAction}
                handlePrint={handlePrint}
                flexDir={flexDir}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {/* Payments modal */}
      {showPayments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowPayments(false)} />
          <div className="relative w-full max-w-3xl bg-slate-900 rounded-xl border border-slate-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" />
                {t('Vendor Payments')}
              </h2>
              <button onClick={() => setShowPayments(false)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {payments.length === 0 ? (
                <p className="text-slate-400 text-center py-8">{t('No payments recorded yet.')}</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex-wrap gap-2">
                      <div>
                        <p className="font-bold text-white">{p.order?.orderNumber}</p>
                        <p className="text-xs text-slate-400">{p.order?.vendor?.name} · {formatDateTime(p.paymentDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-cyan-400">{fmtCurrency(p.amount)}</p>
                        <p className="text-[11px] text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">{p.paymentType}</span>{' '}
                          {p.paymentMethod} {p.reference ? `· ${p.reference}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateVendorModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refreshAll(); }}
          t={t}
        />
      )}
    </div>
  );
};

const AdminOrderRow = ({ order, onOpen, onReject, onAction, t }) => {
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  const stage = order.status || order.currentStage;
  const color = STAGE_COLORS[stage] || 'bg-slate-500';
  const totalUnits = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);

  return (
    <div className="bg-slate-800/50 hover:bg-slate-800 rounded-lg p-3 border border-slate-700/50 transition">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => onOpen(order)} className="flex items-center gap-3 text-left flex-1 min-w-[200px]">
          <span className="font-bold text-white">{order.orderNumber}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${color}`}>
            {STAGE_LABELS[stage] || stage}
          </span>
          {remaining > 0.01 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {t('Balance')}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {stage === 'SUBMITTED' && (
            <>
              <button
                onClick={() => onAction(order.id, '/approve', null, null)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('Approve')}
              </button>
              <button
                onClick={() => onReject(order.id)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                <Ban className="h-3.5 w-3.5" /> {t('Reject')}
              </button>
            </>
          )}
          {stage === 'ADMIN_APPROVED' && (
            <button
              onClick={() => onAction(order.id, '/production-ready', null, null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              <Package className="h-3.5 w-3.5" /> {t('Prod Ready')}
            </button>
          )}
          {(stage === 'ADMIN_APPROVED' || stage === 'PRODUCTION_READY') && (
            <button
              onClick={() => onAction(order.id, '/give-stock', null, null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> {t('Give Stock')}
            </button>
          )}
          {stage === 'DELIVERED' && (
            <button
              onClick={() => onAction(order.id, '/complete', null, null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('Complete')}
            </button>
          )}
          <button onClick={() => onOpen(order)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{order.vendor?.name}</span>
        {order.asm?.name && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{order.asm.name}</span>}
        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{totalUnits} {t('units')}</span>
        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{fmtCurrency(order.grandTotal)}</span>
        {order.deliveryCity && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.deliveryCity}</span>}
      </div>
    </div>
  );
};

const VendorDetailModal = ({ vendor, vendorWithOrders, onClose, onOpenOrder, onRefresh, t }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-xl border border-slate-700 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            {vendor.name}
          </h2>
          <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <Info icon={Building2} label={t('Company')} value={vendor.companyName || '—'} />
            <Info icon={Phone} label={t('Phone')} value={vendor.phone || '—'} />
            <Info icon={Mail} label={t('Email')} value={vendor.email || '—'} />
            <Info icon={MapPin} label={t('City')} value={vendor.city || '—'} />
            <Info icon={MapPin} label={t('Address')} value={vendor.address || '—'} />
            <Info icon={Hash} label={t('Orders')} value={String(vendorWithOrders?._count?.orders ?? vendor._count?.orders ?? 0)} />
          </div>
          {vendor.notes && (
            <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-300">
              <p className="text-xs text-slate-500 mb-1">{t('Notes')}</p>
              {vendor.notes}
            </div>
          )}
          <p className="text-xs text-slate-500">{t('Created')} {formatDateTime(vendor.createdAt)} {vendor.createdBy ? `· ${vendor.createdBy}` : ''}</p>
        </div>
      </div>
    </div>
  );
};

const Info = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 text-slate-300">
    <Icon className="h-4 w-4 text-slate-500" />
    <span className="text-slate-500">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

const CreateVendorModal = ({ onClose, onCreated, t }) => {
  const [form, setForm] = useState({ name: '', companyName: '', contactPerson: '', phone: '', email: '', address: '', city: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error('Vendor name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/vendors', form);
      toast.success('Vendor created.');
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create vendor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">{t('New Vendor')}</h2>
          <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('Name')} required>
            <input value={form.name} onChange={set('name')} placeholder="ABC Traders" className={inputCls} />
          </Field>
          <Field label={t('Company')}>
            <input value={form.companyName} onChange={set('companyName')} className={inputCls} />
          </Field>
          <Field label={t('Contact Person')}>
            <input value={form.contactPerson} onChange={set('contactPerson')} className={inputCls} />
          </Field>
          <Field label={t('Phone')}>
            <input value={form.phone} onChange={set('phone')} className={inputCls} />
          </Field>
          <Field label={t('Email')}>
            <input value={form.email} onChange={set('email')} type="email" className={inputCls} />
          </Field>
          <Field label={t('City')}>
            <input value={form.city} onChange={set('city')} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('Address')}>
              <input value={form.address} onChange={set('address')} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('Notes')}>
              <textarea value={form.notes} onChange={set('notes')} rows={2} className={inputCls} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            {submitting ? t('Saving...') : t('Create Vendor')}
          </button>
        </div>
      </div>
    </div>
  );
};

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="block text-xs text-slate-400 mb-1">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    {children}
  </label>
);

const OrderDetailDrawer = ({ order, onClose, runAction, handlePrint, flexDir, t }) => {
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  const stage = order.status || order.currentStage;
  const color = STAGE_COLORS[stage] || 'bg-slate-500';

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-lg">{order.orderNumber}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${color}`}>
            {STAGE_LABELS[stage] || stage}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
        <p className="text-sm font-bold text-white flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-400" />{order.vendor?.name || '—'}</p>
        {order.asm?.name && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Users className="h-3 w-3" />{t('ASM')}: {order.asm.name}{order.asm?.email ? ` · ${order.asm.email}` : ''}</p>}
        <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-400">
          <span>{t('Quotation')}: {order.quotationNumber}</span>
          <span>{t('Invoice')}: {order.invoiceNumber}</span>
          <span>{t('Created')}: {formatDateTime(order.createdAt)}</span>
          {order.deliveryDate && <span>{t('Delivery')}: {formatDateOnly(order.deliveryDate)}</span>}
          {order.deliveryCity && <span>{t('City')}: {order.deliveryCity}</span>}
          {order.notes && <span className="col-span-2">{t('Notes')}: {order.notes}</span>}
        </div>
        <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-slate-700/50">
          <ActionBtn color="bg-indigo-600 hover:bg-indigo-500" onClick={() => handlePrint(order, 'quotation')} icon={Printer} label={t('Print Quotation')} />
          <ActionBtn color="bg-indigo-600 hover:bg-indigo-500" onClick={() => handlePrint(order, 'invoice')} icon={FileText} label={t('Print Invoice')} />
          <ActionBtn color="bg-slate-600 hover:bg-slate-500" onClick={() => handlePrint(order, 'thermal')} icon={Receipt} label={t('Thermal')} />
        </div>
      </div>

      {/* Items */}
      <h3 className="text-sm font-bold text-white mb-2">{t('Items')}</h3>
      {(order.items || []).length === 0 ? (
        <p className="text-slate-500 text-sm">{t('No items.')}</p>
      ) : (
        <div className="space-y-1 mb-4">
          {(order.items || []).map((it) => (
            <div key={it.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2 text-sm">
              <div>
                <p className="font-semibold text-white">{it.productName}</p>
                <p className="text-xs text-slate-400">
                  {[it.color, it.size, it.productType].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="text-slate-300">{it.quantity} × {fmtCurrency(it.unitPrice)}</p>
                <p className="text-cyan-400 font-bold">{fmtCurrency(it.lineTotal)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Financials */}
      <h3 className="text-sm font-bold text-white mb-2">{t('Financials')}</h3>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Financial label={t('Total Order Value')} value={fmtCurrency(order.totalOrderValue)} />
        <Financial label={t('Advance')} value={fmtCurrency(order.advancePaid)} />
        <Financial label={t('Additional')} value={fmtCurrency(order.additionalPaid)} />
        <Financial label={t('Delivery')} value={fmtCurrency(order.deliveryCharges)} />
        <Financial label={t('Discount')} value={fmtCurrency(order.discount)} />
        <Financial label={t('Grand Total')} value={fmtCurrency(order.grandTotal)} highlight />
        <Financial label={t('Paid')} value={fmtCurrency(totalPaid)} />
        <Financial label={t('Remaining Balance')} value={fmtCurrency(remaining)} warn={remaining > 0.01} />
      </div>

      {/* Admin actions */}
      <h3 className="text-sm font-bold text-white mb-2">{t('Actions')}</h3>
      <div className="flex gap-2 flex-wrap mb-4">
        {stage === 'SUBMITTED' && (
          <>
            <ActionBtn color="bg-blue-600 hover:bg-blue-500" onClick={() => runAction(order.id, '/approve', null, null)} icon={CheckCircle2} label={t('Approve')} />
            <ActionBtn
              color="bg-rose-600 hover:bg-rose-500"
              onClick={() => {
                const reason = window.prompt('Rejection reason:');
                if (reason === null) return;
                runAction(order.id, '/reject', null, { payload: { reason } });
              }}
              icon={Ban}
              label={t('Reject')}
            />
          </>
        )}
        {stage === 'ADMIN_APPROVED' && (
          <ActionBtn color="bg-indigo-600 hover:bg-indigo-500" onClick={() => runAction(order.id, '/production-ready', null, null)} icon={Package} label={t('Mark Production Ready')} />
        )}
        {(stage === 'ADMIN_APPROVED' || stage === 'PRODUCTION_READY') && (
          <ActionBtn color="bg-violet-600 hover:bg-violet-500" onClick={() => runAction(order.id, '/give-stock', null, null)} icon={ArrowDownToLine} label={t('Give Stock')} />
        )}
        {stage === 'DELIVERED' && (
          <ActionBtn color="bg-emerald-600 hover:bg-emerald-500" onClick={() => runAction(order.id, '/complete', null, null)} icon={CheckCircle2} label={t('Mark Completed')} />
        )}
      </div>

      {/* Payments */}
      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4 text-cyan-400" />{t('Payments')}</h3>
      {(order.payments || []).length === 0 ? (
        <p className="text-slate-500 text-sm mb-4">{t('No payments yet.')}</p>
      ) : (
        <div className="space-y-1 mb-4">
          {(order.payments || []).map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2 text-sm">
              <span className="text-slate-300">{t(p.paymentType)} · {p.paymentMethod} · {formatDateTime(p.paymentDate)}</span>
              <span className="font-bold text-cyan-400">{fmtCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <h3 className="text-sm font-bold text-white mb-2">{t('Timeline')}</h3>
      {(order.statusHistory || []).length === 0 ? (
        <p className="text-slate-500 text-sm">{t('No history yet.')}</p>
      ) : (
        <div className="space-y-1">
          {(order.statusHistory || []).map((h) => (
            <div key={h.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2 text-xs">
              <div>
                <p className="font-semibold text-slate-200">
                  {h.fromStage ? `${STAGE_LABELS[h.fromStage] || h.fromStage} → ` : ''}{STAGE_LABELS[h.status] || h.status}
                </p>
                {h.remarks && <p className="text-slate-500">{h.remarks}</p>}
              </div>
              <div className="text-right text-slate-400">
                <p>{formatDateTime(h.createdAt)}</p>
                {h.changedBy && <p>{h.changedBy}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Financial = ({ label, value, highlight, warn }) => (
  <div className={`rounded-lg p-2 text-sm ${highlight ? 'bg-blue-600/20 border border-blue-500/30' : warn ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`font-bold ${highlight ? 'text-white' : warn ? 'text-amber-400' : 'text-slate-200'}`}>{value}</p>
  </div>
);

const ActionBtn = ({ color, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${color}`}>
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

const PRINT_CSS = `@page{margin:6mm}body{font-family:sans-serif;color:#000;padding:6px;font-size:11px}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:3px 5px;border:1px solid #000;text-align:left}th{background:#f3f4f6;font-size:10px;font-weight:900;text-transform:uppercase}td{font-size:11px}`;

async function fetchLogoUrl() {
  let logoUrl = window.location.origin + '/logo.png';
  try {
    const r = await fetch(logoUrl);
    const b = await r.blob();
    logoUrl = URL.createObjectURL(b);
  } catch (e) { /* fallback to path */ }
  return logoUrl;
}

function printIframe(html, title, cleanups, style) {
  const iframe = document.createElement('iframe');
  iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.position = 'absolute'; iframe.style.left = '0'; iframe.style.top = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' + (style || PRINT_CSS) + '</style></head><body>');
  doc.write(html);
  doc.write('</body></html>');
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      (cleanups || []).forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    }, 1000);
  }, 300);
}

// A4 professional Quotation / Invoice document (vendor purchase orders)
async function printOrderDocument(order, kind) {
  const isInvoice = kind === 'invoice';
  const logoUrl = await fetchLogoUrl();
  const title = `${isInvoice ? 'INVOICE' : 'QUOTATION'} — ${order.orderNumber || ''}`;
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  let html = '';
  html += `<div style="text-align:center;margin-bottom:6px;padding-bottom:6px;border-bottom:3px solid #000">`;
  html += `<img src="${logoUrl}" alt="ENAMELS" style="height:50px;margin-bottom:2px;"><p style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;color:#000">${isInvoice ? 'INVOICE' : 'QUOTATION'}</p>`;
  html += `<p style="font-size:10px;margin:2px 0 0;color:#333">VENDOR ORDER · ${order.orderNumber || order.id?.slice(0, 8)}</p></div>`;
  html += `<div style="display:flex;justify-content:space-between;margin-bottom:6px">`;
  html += `<div><p style="font-size:12px;font-weight:900;margin:0 0 2px">Vendor</p><p style="font-size:11px;font-weight:700;margin:0">${order.vendor?.name || '—'}</p>${order.vendor?.contact ? `<p style="font-size:10px;margin:0">${order.vendor.contact}</p>` : ''}${order.vendor?.address ? `<p style="font-size:10px;margin:0">${order.vendor.address}</p>` : ''}</div>`;
  html += `<div style="text-align:right"><p style="font-size:10px;margin:0">DOC: ${isInvoice ? (order.invoiceNumber || '—') : (order.quotationNumber || '—')}</p><p style="font-size:10px;margin:0">Date: ${formatDateTime(order.createdAt)}</p>${order.deliveryDate ? `<p style="font-size:10px;margin:0">Delivery: ${formatDateOnly(order.deliveryDate)}</p>` : ''}${order.deliveryCity ? `<p style="font-size:10px;margin:0">City: ${order.deliveryCity}</p>` : ''}${order.asm?.name ? `<p style="font-size:10px;margin:0">ASM: ${order.asm.name}</p>` : ''}</div>`;
  html += `</div>`;
  html += `<table><thead><tr><th>#</th><th>Product</th><th>Color / Size</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>`;
  (order.items || []).forEach((it, idx) => {
    html += `<tr><td>${idx + 1}</td><td style="font-weight:700">${it.productName}</td><td>${[it.color, it.size, it.productType].filter(Boolean).join(' · ') || '—'}</td><td style="text-align:center;font-weight:700">${it.quantity}</td><td style="text-align:right">₨${parseFloat(it.unitPrice || 0).toLocaleString()}</td><td style="text-align:right;font-weight:700">₨${parseFloat(it.lineTotal || 0).toLocaleString()}</td></tr>`;
  });
  html += `</tbody></table>`;
  html += `<table><tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Total Order Value</td><td style="font-weight:700">₨${parseFloat(order.totalOrderValue || 0).toLocaleString()}</td></tr>`;
  if (parseFloat(order.deliveryCharges || 0) > 0) html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Delivery Charges</td><td style="font-weight:700">₨${parseFloat(order.deliveryCharges).toLocaleString()}</td></tr>`;
  if (parseFloat(order.discount || 0) > 0) html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Discount</td><td style="font-weight:700;color:#16a34a">-₨${parseFloat(order.discount).toLocaleString()}</td></tr>`;
  html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Grand Total</td><td style="font-weight:900;font-size:12px">₨${parseFloat(order.grandTotal || 0).toLocaleString()}</td></tr>`;
  html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Advance Paid</td><td style="font-weight:700">₨${parseFloat(order.advancePaid || 0).toLocaleString()}</td></tr>`;
  html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Total Paid</td><td style="font-weight:700">₨${totalPaid.toLocaleString()}</td></tr>`;
  html += `<tr><td style="width:50%;background:#f3f4f6;font-weight:800;text-transform:uppercase;font-size:10px">Remaining Balance</td><td style="font-weight:900;color:${remaining > 0.01 ? '#dc2626' : '#16a34a'}">₨${remaining.toLocaleString()}</td></tr>`;
  html += `</table>`;
  if (order.notes) html += `<p style="font-size:11px;font-weight:700;margin:6px 0 2px">Notes: ${order.notes}</p>`;
  html += `<div style="display:flex;justify-content:space-between;margin-top:18px"><div style="text-align:center"><div style="width:150px;border-top:1.5px solid #000;margin:0 auto 2px"></div><span style="font-size:10px;font-weight:700">Authorized Signature</span></div><div style="text-align:center"><div style="width:150px;border-top:1.5px solid #000;margin:0 auto 2px"></div><span style="font-size:10px;font-weight:700">Vendor Signature</span></div></div>`;
  printIframe(html, title, [() => { if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }]);
}

// Thermal (58mm) receipt — compact vendor order summary
async function printThermalReceipt(order) {
  const logoUrl = await fetchLogoUrl();
  const totalPaid = (order.payments || []).reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, (order.grandTotal || 0) - totalPaid);
  let html = `<div style="text-align:center"><img src="${logoUrl}" alt="ENAMELS" style="height:30px"><p style="font-weight:900;font-size:12px;margin:2px 0 0">VENDOR RECEIPT</p><p style="margin:1px 0">${order.orderNumber || ''}</p><p style="margin:1px 0">${formatDateTime(order.createdAt)}</p></div>`;
  for (const it of (order.items || [])) {
    html += `<div style="margin-top:4px"><div style="font-weight:700">${it.productName}</div><div style="display:flex;justify-content:space-between"><span>${[it.color, it.size].filter(Boolean).join('/') || '—'} x ${it.quantity}</span><span>₨${parseFloat(it.lineTotal || 0).toLocaleString()}</span></div></div>`;
  }
  html += `<div style="border-top:1px dashed #000;margin-top:6px;padding-top:4px">`;
  html += `<div style="display:flex;justify-content:space-between"><span>GRAND TOTAL</span><span style="font-weight:900">₨${parseFloat(order.grandTotal || 0).toLocaleString()}</span></div>`;
  html += `<div style="display:flex;justify-content:space-between"><span>PAID</span><span>₨${totalPaid.toLocaleString()}</span></div>`;
  html += `<div style="display:flex;justify-content:space-between"><span>REMAINING</span><span>₨${remaining.toLocaleString()}</span></div>`;
  html += `</div>`;
  html += `<div style="text-align:center;margin-top:10px">——————————</div><div style="text-align:center;font-size:9px">Thank you</div>`;
  const title = `Receipt — ${order.orderNumber || ''}`;
  const thermalCss = `@page{margin:2mm;width:58mm}body{font-family:monospace;color:#000;width:58mm;font-size:10px;padding:2px;word-break:break-word}`;
  printIframe(html, title, [() => { if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl); }], thermalCss);
}

export default VendorsPage;
