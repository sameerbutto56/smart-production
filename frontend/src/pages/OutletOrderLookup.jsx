import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  ClipboardList,
  Eye,
  FileText,
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Truck,
  Sparkles,
  RefreshCw,
  X,
  CreditCard,
  Receipt,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry',
  STORE: 'Store',
  WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production',
  STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  OUTLET_RECEIVE: 'Outlet Receive',
  IN_DISPATCH: 'In Dispatch',
  VERIFICATION: 'Verification',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const getStageBadgeColor = (stage) => {
  switch (stage) {
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'OUTLET_RECEIVE':
    case 'IN_DISPATCH':
    case 'DISPATCH':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'PRODUCTION':
    case 'LOGO_DESIGN':
    case 'WORKERS':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'CANCELLED':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    default:
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  }
};

export default function OutletOrderLookup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const outletRaw = String(user?.name || '').toLowerCase();
  const isJoharTown = outletRaw.includes('johar') || user?.name?.includes('1');
  const isJailRoad = outletRaw.includes('2') || outletRaw.includes('jail');

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Selected order details drawer
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch orders list
  const fetchOrders = useCallback(async (search = searchQuery, p = page, stage = stageFilter) => {
    setLoading(true);
    try {
      const res = await api.get('/api/outlet-orders/lookup-list', {
        params: {
          q: search.trim() || undefined,
          stage: stage !== 'ALL' ? stage : undefined,
          page: p,
          limit: 20
        }
      });
      setOrders(res.data?.orders || []);
      setTotalOrders(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, page, stageFilter]);

  // Initial load
  useEffect(() => {
    fetchOrders(searchQuery, page, stageFilter);
  }, [page, stageFilter]);

  // Load single order details
  const openOrderDetails = async (orderNumber) => {
    if (!orderNumber) return;
    setLoadingDetails(true);
    try {
      const res = await api.get(`/api/outlet-orders/order-lookup/${orderNumber.trim()}`);
      setSelectedOrderData(res.data);
    } catch (err) {
      console.error('Failed to fetch order details:', err);
      toast.error(err.response?.data?.message || 'Order not found');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Check if query param exists (e.g. from redirect)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderNum = params.get('orderNumber');
    if (orderNum) {
      setSearchQuery(orderNum);
      openOrderDetails(orderNum);
    }
  }, [location.search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders(searchQuery, 1, stageFilter);
    // If it looks like a direct order number (starts with JT-, JL-, OUT- or is 4-6 digits)
    if (searchQuery.trim().length >= 4) {
      openOrderDetails(searchQuery.trim());
    }
  };

  const currentOrder = selectedOrderData?.order;
  const currentFinancial = selectedOrderData?.financial;
  const currentClient = selectedOrderData?.client;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ClipboardList size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Order Lookup
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {isJoharTown ? 'Johar Town' : isJailRoad ? 'Jail Road' : 'Outlet'}
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Look up active and historical outlet orders, customer measurements, and financial balances
              </p>
            </div>
          </div>
        </div>

        {/* Quick Johar Town Invoice Button */}
        {isJoharTown && (
          <button
            onClick={() => navigate('/outlet-invoice-quotation')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 border border-emerald-500/30 transition-all"
          >
            <FileText size={16} />
            Invoice / Quotation Generator
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order # (e.g. 50335, JT-132222), Invoice #, Customer Name, or Phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  fetchOrders('', 1, stageFilter);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Stages</option>
              <option value="ORDER_ENTRY">Order Entry</option>
              <option value="STORE">Store</option>
              <option value="PRODUCTION">Production</option>
              <option value="DISPATCH">Dispatch</option>
              <option value="OUTLET_RECEIVE">Outlet Receive</option>
              <option value="DELIVERED">Delivered</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Search size={14} />
              Search
            </button>

            <button
              type="button"
              onClick={() => fetchOrders(searchQuery, page, stageFilter)}
              disabled={loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Found <strong className="text-white font-bold">{totalOrders}</strong> orders</span>
          <span>Page {page} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Total (PKR)</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Stage</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-blue-400" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500">
                    No orders found matching your search.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => {
                  const bal = ord.balanceAmount != null ? ord.balanceAmount : Math.max(0, (ord.totalPrice || 0) - (ord.advanceAmount || 0));
                  const isPaid = (ord.paymentStatus || '').toUpperCase() === 'PAID' || bal <= 0.01;

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => openOrderDetails(ord.orderNumber)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-400 group-hover:text-blue-300">
                        {ord.orderNumber || ord.invoiceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {ord.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {ord.customerPhone || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">
                        {ord.quantity || 1}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">
                        Rs. {parseFloat(ord.totalPrice || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                        Rs. {parseFloat(ord.advanceAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        <span className={bal > 0.01 ? 'text-rose-400' : 'text-emerald-400'}>
                          Rs. {parseFloat(bal).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStageBadgeColor(ord.currentStage)}`}>
                          {STAGE_LABELS[ord.currentStage] || ord.currentStage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          isPaid ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}>
                          {isPaid ? 'PAID' : 'BALANCE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openOrderDetails(ord.orderNumber)}
                            className="p-1.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                            title="View Full Details"
                          >
                            <Eye size={14} />
                          </button>
                          {isJoharTown && (
                            <button
                              onClick={() => navigate(`/outlet-invoice-quotation?orderNumber=${ord.orderNumber}&type=INVOICE`)}
                              className="p-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                              title="Generate Invoice / Quotation"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg"
            >
              Previous
            </button>
            <span className="text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* FULL READ-ONLY ORDER DETAILS DRAWER / MODAL */}
      {selectedOrderData && currentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white font-mono">
                      {currentOrder.orderNumber || currentOrder.invoiceNumber}
                    </h2>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStageBadgeColor(currentOrder.currentStage)}`}>
                      {STAGE_LABELS[currentOrder.currentStage] || currentOrder.currentStage}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      currentFinancial?.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {currentFinancial?.paymentStatus || 'PENDING'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Outlet: <strong>{currentOrder.outletName || 'Johar Town'}</strong> • Created: {new Date(currentOrder.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isJoharTown && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const ordNum = currentOrder.orderNumber;
                        setSelectedOrderData(null);
                        navigate(`/outlet-invoice-quotation?orderNumber=${ordNum}&type=INVOICE`);
                      }}
                      className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                    >
                      <FileText size={13} />
                      Invoice
                    </button>
                    <button
                      onClick={() => {
                        const ordNum = currentOrder.orderNumber;
                        setSelectedOrderData(null);
                        navigate(`/outlet-invoice-quotation?orderNumber=${ordNum}&type=QUOTATION`);
                      }}
                      className="px-3 py-1.5 bg-teal-600/80 hover:bg-teal-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                    >
                      <FileText size={13} />
                      Quotation
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setSelectedOrderData(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* Top Banner: Read Only Notice */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-300">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={15} />
                  Strict Read-Only Mode: All product pricing, order stages, and financial figures are verified records.
                </span>
                <span className="text-[11px] text-blue-400 font-mono">
                  {currentOrder.placedBy ? `Entered by: ${currentOrder.placedBy}` : ''}
                </span>
              </div>

              {/* 1. Customer & Delivery Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <User size={14} className="text-blue-400" />
                    Customer Details
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400">Customer Name:</span>
                      <p className="font-bold text-white text-sm">{currentOrder.customerName}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-mono text-white font-semibold">{currentOrder.customerPhone || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">City:</span>
                      <span className="text-white font-medium">{currentOrder.city || 'Lahore'}</span>
                    </div>
                    {currentOrder.address && (
                      <div>
                        <span className="text-slate-400">Address:</span>
                        <p className="text-slate-300 mt-0.5">{currentOrder.address}</p>
                      </div>
                    )}
                    {currentClient?.clientNumber && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Registered Client #:</span>
                        <span className="font-mono text-emerald-400 font-bold">{currentClient.clientNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Truck size={14} className="text-emerald-400" />
                    Order &amp; Delivery Meta
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Delivery Method:</span>
                      <span className="font-semibold text-white">{currentOrder.deliveryMethod || currentOrder.deliveryType || 'Store Pickup'}</span>
                    </div>
                    {currentOrder.trackingNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tracking #:</span>
                        <span className="font-mono text-blue-400 font-bold">{currentOrder.trackingNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Urgent Priority:</span>
                      <span className={currentOrder.urgent ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                        {currentOrder.urgent ? '🔥 Urgent' : 'Normal'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Order Source:</span>
                      <span className="text-slate-300">{currentOrder.outletName || 'OUTLET'}</span>
                    </div>
                    {currentOrder.instructionNotes && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <span className="text-slate-400">General Notes:</span>
                        <p className="text-slate-300 mt-0.5">{currentOrder.instructionNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Products & Specifications */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Package size={14} className="text-purple-400" />
                  Product Line Items ({Array.isArray(currentOrder.productDetails) ? currentOrder.productDetails.length : 1})
                </h3>

                {Array.isArray(currentOrder.productDetails) && currentOrder.productDetails.length > 0 ? (
                  <div className="space-y-3">
                    {currentOrder.productDetails.map((p, idx) => (
                      <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-white text-sm">
                              {p.name || p.productType || p.productName || 'Medical Scrub'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-400">Qty: <strong className="text-white">{p.quantity || 1}</strong></span>
                            <span className="text-slate-400">Unit: <strong className="text-white">Rs. {parseFloat(p.unitPrice || 0).toLocaleString()}</strong></span>
                            <span className="text-emerald-400 font-bold">Total: Rs. {parseFloat(p.totalPrice || (p.quantity * p.unitPrice) || 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Specs grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                          <div><span className="text-slate-500">Color:</span> {p.color || (p.productDetails && p.productDetails.color) || '—'}</div>
                          <div><span className="text-slate-500">Size:</span> {p.size || (p.productDetails && p.productDetails.size) || '—'}</div>
                          <div><span className="text-slate-500">Fabric:</span> {p.fabric || p.fabricType || '—'}</div>
                          <div><span className="text-slate-500">Gender:</span> {p.gender || '—'}</div>
                        </div>

                        {/* Customizations / Engravings / Alterations */}
                        {(p.engravingRequired || p.logoRequired || p.matchingCap || p.measurementSpecialNote || p.alteration) && (
                          <div className="pt-2 border-t border-slate-800/40 text-[11px] space-y-1">
                            {p.engravingRequired && (
                              <div className="text-blue-300 flex items-center gap-1">
                                <Sparkles size={12} />
                                <strong>Engraving:</strong> {p.engravingText || (Array.isArray(p.engravingLines) ? p.engravingLines.map(l => typeof l === 'object' ? l.text : l).join(', ') : 'Yes')} ({p.engravingType || 'Direct'})
                              </div>
                            )}
                            {p.logoRequired && (
                              <div className="text-purple-300 flex items-center gap-1">
                                <Sparkles size={12} />
                                <strong>Logo:</strong> {p.logoName || (Array.isArray(p.logoEntries) ? p.logoEntries.map(l => typeof l === 'object' ? l.name : l).join(', ') : 'Yes')}
                              </div>
                            )}
                            {p.matchingCap && (
                              <div className="text-amber-300">
                                <strong>Matching Cap:</strong> {p.matchingCapQty || 1}x (Rs. {p.capCharges || 0})
                              </div>
                            )}
                            {p.measurementSpecialNote && (
                              <div className="text-emerald-300 bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                                <strong>Special Measurements / Notes:</strong> {p.measurementSpecialNote}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg">
                    <p className="font-bold text-white">{currentOrder.productType || 'Custom Medical Apparel'}</p>
                    <p className="text-slate-400 mt-1">Size / Specs: {currentOrder.sizeData || 'Standard'}</p>
                  </div>
                )}
              </div>

              {/* 3. Financial Summary & POS Details */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-400" />
                  Financial Summary &amp; Payments
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Totals Breakdown */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-white">Rs. {parseFloat(currentFinancial?.subtotal || currentOrder.totalPrice || 0).toLocaleString()}</span>
                    </div>
                    {parseFloat(currentFinancial?.deliveryCharges || currentOrder.deliveryCharges || 0) > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Delivery Charges:</span>
                        <span className="font-semibold text-white">Rs. {parseFloat(currentFinancial?.deliveryCharges || currentOrder.deliveryCharges).toLocaleString()}</span>
                      </div>
                    )}
                    {parseFloat(currentFinancial?.discountAmount || currentOrder.discountAmount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount:</span>
                        <span className="font-semibold">-Rs. {parseFloat(currentFinancial?.discountAmount || currentOrder.discountAmount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                      <span>Grand Total:</span>
                      <span className="text-blue-400">Rs. {parseFloat(currentFinancial?.grandTotal || currentOrder.totalPrice || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Paid / Advance:</span>
                      <span>Rs. {parseFloat(currentFinancial?.totalPaid || currentOrder.advanceAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm">
                      <span className="text-slate-300">Remaining Balance:</span>
                      <span className={parseFloat(currentFinancial?.remaining || currentFinancial?.balanceAmount || 0) > 0.01 ? 'text-rose-400' : 'text-emerald-400'}>
                        Rs. {parseFloat(currentFinancial?.remaining != null ? currentFinancial.remaining : (currentFinancial?.balanceAmount || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* POS & Transaction Info */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payment Status:</span>
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                        currentFinancial?.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {currentFinancial?.paymentStatus || 'PENDING'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payment Method:</span>
                      <span className="font-semibold text-white">{currentFinancial?.paymentMethod || currentOrder.paymentMethod || 'CASH'}</span>
                    </div>
                    {currentFinancial?.receiptNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">POS Receipt #:</span>
                        <span className="font-mono text-blue-400 font-bold">{currentFinancial.receiptNumber}</span>
                      </div>
                    )}
                    {currentFinancial?.cashierName && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Cashier:</span>
                        <span className="text-white">{currentFinancial.cashierName}</span>
                      </div>
                    )}

                    {/* Balance Payments History */}
                    {Array.isArray(currentFinancial?.balancePayments) && currentFinancial.balancePayments.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <span className="text-[11px] font-bold text-slate-400 block mb-1">Subsequent Payments:</span>
                        <div className="space-y-1">
                          {currentFinancial.balancePayments.map((bp) => (
                            <div key={bp.id} className="flex justify-between text-[11px] text-slate-300 bg-slate-950/40 px-2 py-1 rounded">
                              <span>{new Date(bp.paidAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })} ({bp.paymentMethod})</span>
                              <span className="text-emerald-400 font-bold">+Rs. {parseFloat(bp.amountPaidNow || 0).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Stages & Workflow History */}
              {Array.isArray(currentOrder.stages) && currentOrder.stages.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock size={14} className="text-cyan-400" />
                    Stage Progression Timeline
                  </h3>
                  <div className="space-y-2">
                    {currentOrder.stages.map((st, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-900/60 border border-slate-800/40">
                        <span className="font-bold text-slate-200">{STAGE_LABELS[st.stageName || st.stage] || st.stageName || st.stage}</span>
                        <span className="text-[11px] text-slate-400">
                          {(st.startedAt || st.enteredAt || st.createdAt) ? new Date(st.startedAt || st.enteredAt || st.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-950/60">
              <button
                onClick={() => setSelectedOrderData(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
