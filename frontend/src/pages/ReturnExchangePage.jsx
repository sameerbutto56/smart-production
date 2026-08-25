import React, { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Package, RotateCcw, RefreshCw, PhoneOff, CheckCircle, Clock, ArrowRight, AlertTriangle, FileText, Send, X, History, PackageCheck, Truck, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

const ReturnExchangePage = () => {
  const { user } = useAuth();
  const isInventoryView = user?.role === 'INVENTORY_VIEW' || user?.role === 'STORE' || user?.role === 'STORE_EMPLOYEE';
  const [searchQuery, setSearchQuery] = useState('');
  const [returnCase, setReturnCase] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [activeView, setActiveView] = useState(isInventoryView ? 'incoming' : 'lookup');
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [postexReturns, setPostexReturns] = useState([]);
  const [postexReturnsLoading, setPostexReturnsLoading] = useState(false);
  const [postexReturnStats, setPostexReturnStats] = useState([]);
  const [incomingReturns, setIncomingReturns] = useState([]);
  const [incomingReturnsLoading, setIncomingReturnsLoading] = useState(false);
  const [incomingReturnsStats, setIncomingReturnsStats] = useState(null);
  const [incomingFilterStatus, setIncomingFilterStatus] = useState('');
  const [incomingFilterSource, setIncomingFilterSource] = useState('');
  const [incomingSearchQuery, setIncomingSearchQuery] = useState('');

  const fetchIncomingReturns = useCallback(async (search, status, source) => {
    setIncomingReturnsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search && search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (source) params.set('source', source);
      const res = await api.get(`/api/return-exchange/incoming-returns?${params}`);
      setIncomingReturns(res.data.cases || []);
      setIncomingReturnsStats(res.data.stats || null);
    } catch (err) { setIncomingReturns([]); setIncomingReturnsStats(null); }
    setIncomingReturnsLoading(false);
  }, []);

  // Auto-fetch incoming returns when tab is selected
  useEffect(() => {
    if (activeView === 'incoming') {
      fetchIncomingReturns(incomingSearchQuery, incomingFilterStatus, incomingFilterSource);
    }
  }, [activeView, incomingFilterStatus, incomingFilterSource]);

  const lookupOrder = useCallback(async () => {
    if (!searchQuery.trim()) return toast.error('Enter order number, invoice #, customer name, or phone');
    setLoading(true);
    setReturnCase(null);
    setOrderData(null);
    setActiveAction(null);
    try {
      const res = await api.get(`/api/return-exchange/returns/search?orderNumber=${encodeURIComponent(searchQuery.trim())}`);
      const foundCases = res.data.cases || [];
      const foundOrder = res.data.order || null;
      if (foundCases.length > 0) {
        // Existing return cases found — load the first one as before
        const c = foundCases[0];
        setReturnCase(c);
        setOrderData(c.order || null);
      } else if (foundOrder) {
        // No existing return cases, but the order exists — show order details with initiate buttons
        setReturnCase(null);
        setOrderData(foundOrder);
        toast('Order found — you can initiate a Return or Replacement', { icon: '📦' });
      } else {
        toast.error('Order not found. Check the order number, invoice #, or customer phone.');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Order not found'); }
    setLoading(false);
  }, [searchQuery]);

  const fetchCases = useCallback(async (search) => {
    setCasesLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search && search.trim()) params.set('search', search.trim());
      const res = await api.get(`/api/return-exchange/cases?${params}`);
      setCases(res.data.cases || []);
    } catch { setCases([]); }
    setCasesLoading(false);
  }, []);

  const fetchPostExReturns = useCallback(async () => {
    setPostexReturnsLoading(true);
    try {
      const res = await api.get('/api/postex/returns');
      setPostexReturns(res.data.cases || []);
      setPostexReturnStats(res.data.stats || []);
    } catch { setPostexReturns([]); setPostexReturnStats([]); }
    setPostexReturnsLoading(false);
  }, []);

  const handleAcceptReturn = async () => {
    setAccepting(true);
    try {
      if (returnCase && returnCase.id) {
        // Existing case (delivery boy returned → PENDING case) — accept it
        const res = await api.post(`/api/return-exchange/${returnCase.id}/accept-return`);
        toast.success('Return accepted! You can now Return, Replace, or Re-Dispatch.');
        setReturnCase(prev => ({ ...prev, status: 'ACCEPTED', acceptedBy: user?.name, acceptedAt: res.data.acceptedAt || new Date().toISOString() }));
      } else if (orderData && orderData.id) {
        // Fresh order (no existing case) — create ACCEPTED case directly
        const res = await api.post('/api/return-exchange/new/accept-return', { orderId: orderData.id });
        toast.success('Return accepted! You can now Return, Replace, or Re-Dispatch.');
        setReturnCase({ id: res.data.caseId, status: 'ACCEPTED', orderId: orderData.id, orderNumber: orderData.orderNumber, customerName: orderData.customerName, originalProducts: orderData.productDetails, acceptedBy: user?.name, acceptedAt: res.data.acceptedAt || new Date().toISOString() });
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to accept return'); }
    setAccepting(false);
  };

  const handleCaseSearch = (e) => {
    e.preventDefault();
    fetchCases(caseSearchQuery);
  };

  const parseProducts = (pd) => {
    if (!pd) return [];
    if (typeof pd === 'string') { try { return JSON.parse(pd); } catch { return []; } }
    if (Array.isArray(pd)) return pd;
    return [];
  };

  const fmtCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;
  const fmtDate = (d) => d ? formatDateOnly(d) : '';
  const fmtDateTime = (d) => d ? formatDateTime(d) : '';

  const STAGE_MAP = { ORDER_ENTRY: 'Order Entry', STORE: 'Store', PRODUCTION: 'Production', DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered' };

  const isPending = returnCase && returnCase.status === 'PENDING';
  const isAccepted = returnCase && returnCase.status === 'ACCEPTED';
  const sentToStore = returnCase && returnCase.status === 'PENDING' && returnCase.routedTo === 'STORE';
  const canShowActions = isAccepted && !sentToStore;
  const hasCompletedReturn = orderData?.returnExchangeCases?.some(c => c.type === 'RETURN' && ['COMPLETED', 'CANCELLED'].includes(c.status));

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-600 rounded-2xl"><RotateCcw size={24} className="text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Return & Exchange</h1>
            <p className="text-sm text-gray-400">Manage returns, replacements, and no-response orders</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setActiveView('incoming'); fetchIncomingReturns(incomingSearchQuery, incomingFilterStatus, incomingFilterSource); }} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeView === 'incoming' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><Inbox size={16} /> Incoming Returns</div>
          </button>
          <button onClick={() => setActiveView('lookup')} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeView === 'lookup' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><Search size={16} /> Order Lookup</div>
          </button>
          <button onClick={() => { setActiveView('cases'); fetchCases(''); }} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeView === 'cases' ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><History size={16} /> All Cases</div>
          </button>
          <button onClick={() => { setActiveView('postex'); fetchPostExReturns(); }} className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${activeView === 'postex' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            <div className="flex items-center gap-2"><Truck size={16} /> PostEx Returns</div>
          </button>
        </div>

        {activeView === 'cases' ? (
          <AllCasesView cases={cases} loading={casesLoading} fmtDate={fmtDate} fmtDateTime={fmtDateTime}
            searchQuery={caseSearchQuery} setSearchQuery={setCaseSearchQuery} onSearch={handleCaseSearch}
            onRefresh={() => fetchCases(caseSearchQuery)} />
        ) : activeView === 'postex' ? (
          <PostExReturnsView cases={postexReturns} loading={postexReturnsLoading} stats={postexReturnStats} fmtDate={fmtDate} fmtDateTime={fmtDateTime} parseProducts={parseProducts} fmtCurrency={fmtCurrency} onRefresh={fetchPostExReturns} />
        ) : activeView === 'incoming' ? (
          <IncomingReturnsView
            cases={incomingReturns}
            loading={incomingReturnsLoading}
            stats={incomingReturnsStats}
            searchQuery={incomingSearchQuery}
            setSearchQuery={setIncomingSearchQuery}
            filterStatus={incomingFilterStatus}
            setFilterStatus={setIncomingFilterStatus}
            filterSource={incomingFilterSource}
            setFilterSource={setIncomingFilterSource}
            onSearch={() => fetchIncomingReturns(incomingSearchQuery, incomingFilterStatus, incomingFilterSource)}
            onRefresh={() => fetchIncomingReturns(incomingSearchQuery, incomingFilterStatus, incomingFilterSource)}
            onClearFilters={() => { setIncomingFilterStatus(''); setIncomingFilterSource(''); setIncomingSearchQuery(''); fetchIncomingReturns('', '', ''); }}
            fmtDate={fmtDate}
            fmtDateTime={fmtDateTime}
            fmtCurrency={fmtCurrency}
            parseProducts={parseProducts}
            user={user}
            setActiveView={setActiveView}
            onSearchReturn={lookupOrder}
            searchQueryMain={searchQuery}
            setSearchQueryMain={setSearchQuery}
            setLoadingMain={setLoading}
            setReturnCase={setReturnCase}
            setOrderData={setOrderData}
            setActiveAction={setActiveAction}
          />
        ) : (
          <>
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && lookupOrder()}
                  placeholder="Enter Order Number to search in Returns..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-rose-500" />
              </div>
              <button onClick={lookupOrder} disabled={loading}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm disabled:opacity-50 transition-all">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* No Results */}
            {!loading && searchQuery && !returnCase && !orderData && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-bold">Order not found</p>
                <p className="text-xs text-gray-600 mt-1">No order matches this search. Check the order number, invoice, or phone.</p>
              </div>
            )}

            {/* Pending Acceptance Banner */}
            {isPending && !sentToStore && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg"><Clock size={20} className="text-amber-400" /></div>
                  <div>
                    <h3 className="text-sm font-black text-amber-400">Pending Acceptance</h3>
                    <p className="text-xs text-gray-400">This order was returned by delivery and is awaiting your acceptance.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                  <span>Returned by: <span className="text-white font-bold">{returnCase.deliveryReturnedBy || 'Unknown'}</span></span>
                  {returnCase.deliveryReturnedAt && <span>at {fmtDateTime(returnCase.deliveryReturnedAt)}</span>}
                  {returnCase.returnReason && <span>Reason: <span className="text-amber-400">{returnCase.returnReason}</span></span>}
                </div>
                <button onClick={handleAcceptReturn} disabled={accepting}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  <PackageCheck size={16} />
                  {accepting ? 'Accepting...' : 'Accept Return'}
                </button>
              </div>
            )}

            {/* Already Sent to Store — Return Processed */}
            {sentToStore && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg"><CheckCircle size={20} className="text-blue-400" /></div>
                  <div>
                    <h3 className="text-sm font-black text-blue-400">Return Already Sent to Store</h3>
                    <p className="text-xs text-gray-400">This return has been processed and sent to Store. It cannot be re-accepted or re-processed.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                  {returnCase.returnReason && <span>Reason: <span className="text-blue-400">{returnCase.returnReason}</span></span>}
                  {returnCase.warehouseNotes && <span>Notes: <span className="text-gray-300">{returnCase.warehouseNotes}</span></span>}
                </div>
              </div>
            )}

            {/* Fresh Order — Accept Return (no existing case, no completed return) */}
            {!returnCase && orderData && !isPending && !isAccepted && !accepting && !hasCompletedReturn && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg"><Clock size={20} className="text-amber-400" /></div>
                  <div>
                    <h3 className="text-sm font-black text-amber-400">Accept Return First</h3>
                    <p className="text-xs text-gray-400">Accept this return before choosing Return, Replace, or Re-Dispatch.</p>
                  </div>
                </div>
                <button onClick={handleAcceptReturn} disabled={accepting}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  <PackageCheck size={16} />
                  {accepting ? 'Accepting...' : 'Accept Return'}
                </button>
              </div>
            )}

            {/* Return Already Processed — previous return case completed/cancelled */}
            {!returnCase && orderData && !isPending && !isAccepted && !accepting && hasCompletedReturn && (
              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-500/20 rounded-lg"><CheckCircle size={20} className="text-gray-400" /></div>
                  <div>
                    <h3 className="text-sm font-black text-gray-400">Return Already Processed</h3>
                    <p className="text-xs text-gray-500">This order's return has already been completed. No further return actions are available.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Accepted Banner */}
            {isAccepted && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-black text-emerald-400">Return Accepted</p>
                  <p className="text-[10px] text-gray-400">Accepted by {returnCase.acceptedBy || 'Unknown'} at {fmtDateTime(returnCase.acceptedAt)}. You can now Return or Re-Dispatch this order.</p>
                </div>
              </div>
            )}

            {/* Order Details */}
            {orderData && (
              <OrderDetails order={orderData} activeAction={activeAction} setActiveAction={setActiveAction}
                parseProducts={parseProducts} fmtCurrency={fmtCurrency} fmtDate={fmtDate} fmtDateTime={fmtDateTime}
                user={user} onRefresh={lookupOrder} STAGE_MAP={STAGE_MAP} canShowActions={canShowActions} returnCase={returnCase} />
            )}

            {/* Return Case Info (when no order data but case found) */}
            {returnCase && !orderData && (
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{returnCase.orderNumber || 'No Order #'}</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isAccepted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{returnCase.status}</span>
                </div>
                <p className="text-xs text-gray-400">{returnCase.customerName}</p>
                {returnCase.returnReason && <p className="text-xs text-gray-500">Reason: {returnCase.returnReason}</p>}
                {returnCase.originalProducts && (
                  <div className="space-y-1">
                    {parseProducts(returnCase.originalProducts).map((item, i) => {
                      const pd = item.productDetails || item;
                      return (
                        <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 text-xs flex justify-between">
                          <span className="text-white font-bold">{pd.name || pd.productType} {pd.color ? `(${pd.color})` : ''} x{item.quantity || 1}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Actions after acceptance */}
                {canShowActions && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-700">
                    <button onClick={() => setActiveAction('return')}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${activeAction === 'return' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      <RotateCcw size={20} className="mx-auto mb-1" />
                      <p className="text-xs font-black">Return</p>
                    </button>
                    <button onClick={() => setActiveAction('redispatch')}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${activeAction === 'redispatch' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                      <Send size={20} className="mx-auto mb-1" />
                      <p className="text-xs font-black">Re-Dispatch</p>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action Forms — rendered inside OrderDetails only (no duplicate here) */}
          </>
        )}
      </div>
    </div>
  );
};

const OrderDetails = ({ order, activeAction, setActiveAction, parseProducts, fmtCurrency, fmtDate, fmtDateTime, user, onRefresh, STAGE_MAP, canShowActions, returnCase }) => {
  const products = parseProducts(order.productDetails);
  const isDelivered = order.stages?.some(s => s.stageName === 'OUT_FOR_DELIVERY' && s.status === 'COMPLETED') || order.currentStage === 'DELIVERED';
  const isReturned = order.status === 'RETURNED' || order.refundStatus === 'REQUESTED';
  const hasActiveCase = order.returnExchangeCases?.some(c => !['COMPLETED', 'WAREHOUSE_REJECTED', 'CANCELLED'].includes(c.status));
  const noResponseCount = order.noResponseCount || 0;

  return (
    <div className="space-y-4">
      {/* Order Header Card */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-white">{order.orderNumber || 'No Order #'}</h3>
            <p className="text-sm text-gray-400">{order.customerName} - {order.customerPhone}</p>
            {order.invoiceNumber && <p className="text-xs text-amber-400 font-bold">Invoice: {order.invoiceNumber}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-amber-400">{fmtCurrency(order.totalPrice)}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDelivered ? 'bg-emerald-500/20 text-emerald-400' : isReturned ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {isReturned ? 'RETURNED' : isDelivered ? 'DELIVERED' : order.currentStage || order.status}
            </span>
          </div>
        </div>

        {/* Products */}
        <div className="mt-4 space-y-2">
          {products.map((item, i) => {
            const pd = item.productDetails || item;
            return (
              <div key={i} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-white">{pd.name || pd.productType || 'Product'}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 mt-0.5">
                    {pd.gender && <span className="text-blue-400">{pd.gender}</span>}
                    {pd.color && <span>Color: {pd.color}</span>}
                    {pd.size && <span>Size: {pd.size}</span>}
                    <span>Qty: {item.quantity || 1}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-400">{fmtCurrency(item.totalPrice)}</span>
              </div>
            );
          })}
        </div>

        {/* Delivery Attempts */}
        {order.deliveryAttempts?.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-lg p-3">
            <p className="text-xs font-black text-gray-400 uppercase mb-2">Delivery Attempts ({order.deliveryAttempts.length})</p>
            {order.deliveryAttempts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1">
                <span className={`px-1.5 py-0.5 rounded font-bold ${a.status === 'DELIVERED' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'NO_RESPONSE' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                  #{a.attemptNumber} {a.status}
                </span>
                <span className="text-gray-500">{fmtDateTime(a.attemptedAt)}</span>
                {a.rescheduledTo && <span className="text-gray-500">→ Rescheduled: {fmtDate(a.rescheduledTo)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning if max attempts */}
      {noResponseCount >= 3 && !hasActiveCase && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0" />
          <p className="text-sm font-bold text-red-400">Maximum 3 delivery attempts reached. This order should be returned.</p>
        </div>
      )}

      {/* Action Buttons — only when accepted and no active case */}
      {canShowActions && !hasActiveCase && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => setActiveAction('return')}
            className={`p-4 rounded-xl border-2 transition-all text-center ${activeAction === 'return' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            <RotateCcw size={24} className="mx-auto mb-2" />
            <p className="text-sm font-black">Return</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Send to Store</p>
          </button>
          <button onClick={() => setActiveAction('replace')}
            className={`p-4 rounded-xl border-2 transition-all text-center ${activeAction === 'replace' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            <RefreshCw size={24} className="mx-auto mb-2" />
            <p className="text-sm font-black">Replace</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Exchange items</p>
          </button>
          <button onClick={() => setActiveAction('noresponse')}
            className={`p-4 rounded-xl border-2 transition-all text-center ${activeAction === 'noresponse' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            <PhoneOff size={24} className="mx-auto mb-2" />
            <p className="text-sm font-black">No Response</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Reschedule delivery</p>
          </button>
          <button onClick={() => setActiveAction('redispatch')}
            className={`p-4 rounded-xl border-2 transition-all text-center ${activeAction === 'redispatch' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
            <Send size={24} className="mx-auto mb-2" />
            <p className="text-sm font-black">Re-Dispatch</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Route to Dispatch</p>
          </button>
        </div>
      )}

      {/* Active Case Display */}
      {hasActiveCase && (
        <ActiveCaseBanner cases={order.returnExchangeCases} fmtDateTime={fmtDateTime} />
      )}

      {/* Action Forms */}
      {activeAction === 'return' && <ReturnForm order={order} returnCase={returnCase} user={user} onRefresh={onRefresh} parseProducts={parseProducts} />}
      {activeAction === 'replace' && <ReplaceForm order={order} user={user} onRefresh={onRefresh} parseProducts={parseProducts} />}
      {activeAction === 'noresponse' && <NoResponseForm order={order} user={user} onRefresh={onRefresh} />}
      {activeAction === 'redispatch' && <ReDispatchForm orderId={order.id} order={order} user={user} onRefresh={onRefresh} />}

      {/* Existing Cases */}
      {order.returnExchangeCases?.length > 0 && !hasActiveCase && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h4 className="text-sm font-black text-gray-400 uppercase mb-3 flex items-center gap-1"><History size={14} /> Previous Cases</h4>
          {order.returnExchangeCases.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-lg p-3 mb-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.type === 'RETURN' ? 'bg-red-500/20 text-red-400' : c.type === 'REPLACEMENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.type}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded font-bold text-[10px] ${c.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>{c.status}</span>
                </div>
                <span className="text-gray-500">{fmtDateTime(c.createdAt)}</span>
              </div>
              {c.returnReason && <p className="text-gray-500 mt-1">Reason: {c.returnReason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ReturnForm = ({ order, returnCase, user, onRefresh, parseProducts }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const products = parseProducts(order.productDetails);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (returnCase && returnCase.id) {
        // Existing ACCEPTED case — route to Store with reason (does not create duplicate)
        await api.post(`/api/return-exchange/${returnCase.id}/send-return-to-store`, {
          returnReason: reason, notes: `Return sent by ${user?.name || 'Inventory View'}`
        });
        toast.success('Return sent to Store for processing!');
      } else {
        // Fallback — should not happen (must accept first), but handle gracefully
        await api.post('/api/return-exchange/initiate', {
          orderId: order.id, type: 'RETURN', returnReason: reason,
          notes: `Return initiated by ${user?.name || 'Inventory View'}`
        });
        toast.success('Return sent to Store for processing!');
      }
      setReason(''); onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-red-500/30 space-y-4">
      <h3 className="text-sm font-black text-red-400 flex items-center gap-2"><RotateCcw size={16} /> Send Return to Store</h3>
      <p className="text-xs text-gray-400">Items to be returned to Store (removed from Warehouse):</p>
      <div className="space-y-1">
        {products.map((item, i) => {
          const pd = item.productDetails || item;
          return (
            <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 text-xs flex justify-between">
              <span className="text-white font-bold">{pd.name || pd.productType} {pd.color ? `(${pd.color})` : ''} x{item.quantity || 1}</span>
              <span className="text-gray-500">Will be restocked by Store</span>
            </div>
          );
        })}
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">Return Reason</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why is this order being returned?"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500 resize-none" />
      </div>
      <button onClick={handleSubmit} disabled={submitting || !reason.trim()}
        className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
        {submitting ? 'Submitting...' : 'Send Return to Store'}
      </button>
    </div>
  );
};

const ReplaceForm = ({ order, user, onRefresh, parseProducts }) => {
  const [reason, setReason] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [replacementItems, setReplacementItems] = useState([{ name: '', color: '', size: '', quantity: 1, notes: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const products = parseProducts(order.productDetails);

  const addItem = () => setReplacementItems(prev => [...prev, { name: '', color: '', size: '', quantity: 1, notes: '' }]);
  const removeItem = (i) => setReplacementItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setReplacementItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.error('Enter replacement reason');
    if (!replacementItems.some(r => r.name.trim())) return toast.error('Enter at least one replacement item');
    setSubmitting(true);
    try {
      await api.post('/api/return-exchange/initiate', {
        orderId: order.id, type: 'REPLACEMENT', returnReason: reason,
        specialNote: specialNote.trim(),
        replacementItems: replacementItems.filter(r => r.name.trim()),
        notes: `Replacement initiated by ${user?.name || 'Inventory View'}`
      });
      toast.success('Replacement sent to Faisal for review!');
      setReason(''); setSpecialNote(''); setReplacementItems([{ name: '', color: '', size: '', quantity: 1, notes: '' }]); onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-blue-500/30 space-y-4">
      <h3 className="text-sm font-black text-blue-400 flex items-center gap-2"><RefreshCw size={16} /> Initiate Replacement</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-black text-gray-400 uppercase mb-2">Original Items</p>
          <div className="space-y-1">
            {products.map((item, i) => {
              const pd = item.productDetails || item;
              return (
                <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 text-xs">
                  <p className="text-white font-bold">{pd.name || pd.productType}</p>
                  <p className="text-gray-500">{pd.color || ''} {pd.size || ''} x{item.quantity || 1}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-black text-gray-400 uppercase mb-2">Replacement Items</p>
          <div className="space-y-2">
            {replacementItems.map((item, i) => (
              <div key={i} className="bg-gray-900 rounded-lg p-2 space-y-1 relative">
                {replacementItems.length > 1 && (
                  <button onClick={() => removeItem(i)} className="absolute top-1 right-1 text-gray-600 hover:text-red-400"><X size={12} /></button>
                )}
                <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Product name"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none" />
                <div className="grid grid-cols-2 gap-1">
                  <input value={item.color} onChange={e => updateItem(i, 'color', e.target.value)} placeholder="Color"
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none" />
                  <input value={item.size} onChange={e => updateItem(i, 'size', e.target.value)} placeholder="Size"
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none" />
                </div>
                <div className="flex gap-1">
                  <input type="number" value={item.quantity} min="1" onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none" />
                  <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)} placeholder="Notes"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none" />
                </div>
              </div>
            ))}
            <button onClick={addItem} className="text-[10px] font-bold text-blue-400 hover:text-blue-300">+ Add Item</button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">Replacement Reason <span className="text-red-400">*</span></label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why is this order being replaced? (required)"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 resize-none" />
      </div>
      <div>
        <label className="text-xs font-bold text-amber-400 block mb-1">Special Note (optional)</label>
        <textarea value={specialNote} onChange={e => setSpecialNote(e.target.value)} rows={2} placeholder="Special instructions for Faisal"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 resize-none" />
      </div>
      <button onClick={handleSubmit} disabled={submitting || !reason.trim()}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
        {submitting ? 'Submitting...' : 'Send Replacement to Faisal'}
      </button>
    </div>
  );
};

const ReDispatchForm = ({ orderId, order, user, onRefresh }) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/return-exchange/${orderId}/redispatch`, { notes });
      toast.success('Order routed to Dispatch queue successfully!');
      setNotes('');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate re-dispatch');
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-purple-500/30 space-y-4">
      <h3 className="text-sm font-black text-purple-400 flex items-center gap-2">
        <Send size={16} /> Re-Dispatch Order
      </h3>
      <p className="text-xs text-gray-400">
        This will mark the order as Re-Dispatch and route it directly back to the Dispatch queue's Unseen Tasks.
      </p>
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">Re-Dispatch Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Enter any specific instructions or reason for re-dispatch..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 resize-none" />
      </div>
      <button onClick={handleSubmit} disabled={submitting}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
        {submitting ? 'Routing...' : 'Confirm Re-Dispatch'}
      </button>
    </div>
  );
};

const NoResponseForm = ({ order, user, onRefresh }) => {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const attempt = (order.noResponseCount || 0);
  const maxReached = attempt >= 3;

  const handleReschedule = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/return-exchange/${order.id}/reschedule`, {
        notes: notes || `Rescheduled by ${user?.name || 'Inventory View'}`
      });
      toast.success(maxReached ? 'Max attempts reached — moved to Return workflow' : 'Rescheduled for next day!');
      setNotes(''); onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-amber-500/30 space-y-4">
      <h3 className="text-sm font-black text-amber-400 flex items-center gap-2"><PhoneOff size={16} /> No Response</h3>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(n => (
          <div key={n} className={`rounded-lg p-3 text-center ${attempt >= n ? 'bg-red-500/20 border border-red-500/30' : 'bg-gray-900 border border-gray-800'}`}>
            <p className="text-[10px] text-gray-500 uppercase">Attempt {n}</p>
            <p className={`text-xs font-black mt-0.5 ${attempt >= n ? 'text-red-400' : 'text-gray-600'}`}>
              {attempt >= n ? 'No Response' : 'Pending'}
            </p>
          </div>
        ))}
      </div>
      {maxReached ? (
        <div className="bg-red-500/10 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <p className="text-xs font-bold text-red-400">Maximum 3 attempts reached. Click below to auto-move to Return workflow.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Attempt {attempt + 1}/3 — Reschedule for next day</p>
      )}
      <div>
        <label className="text-xs font-bold text-gray-400 block mb-1">Notes (optional)</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-amber-500" />
      </div>
      <button onClick={handleReschedule} disabled={submitting}
        className={`w-full font-black py-3 rounded-xl text-sm disabled:opacity-50 transition-all ${maxReached ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
        {submitting ? 'Processing...' : maxReached ? 'Auto-Move to Return' : 'Reschedule for Next Day'}
      </button>
    </div>
  );
};

const ActiveCaseBanner = ({ cases, fmtDateTime }) => {
  const active = cases?.filter(c => !['COMPLETED', 'WAREHOUSE_REJECTED', 'CANCELLED'].includes(c.status)) || [];
  if (active.length === 0) return null;
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
      <p className="text-xs font-black text-blue-400 uppercase">Active Case(s)</p>
      {active.map(c => (
        <div key={c.id} className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.type === 'RETURN' ? 'bg-red-500/20 text-red-400' : c.type === 'REPLACEMENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.type}</span>
          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.status === 'DISPATCH_READY' || c.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>{c.status.replace(/_/g, ' ')}</span>
          <span className="text-gray-500">Started: {fmtDateTime(c.createdAt)}</span>
        </div>
      ))}
    </div>
  );
};

const AllCasesView = ({ cases, loading, fmtDate, fmtDateTime, searchQuery, setSearchQuery, onSearch, onRefresh }) => {
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const filtered = cases.filter(c => (!filterType || c.type === filterType) && (!filterStatus || c.status === filterStatus));

  const stats = { total: cases.length, returns: cases.filter(c => c.type === 'RETURN').length, replacements: cases.filter(c => c.type === 'REPLACEMENT').length, noResponse: cases.filter(c => c.type === 'NO_RESPONSE').length, pending: cases.filter(c => c.status === 'PENDING').length, completed: cases.filter(c => c.status === 'COMPLETED').length };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Order Number, Customer Name..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-rose-500" />
        </div>
        <button type="submit" className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-sm transition-all">
          Search
        </button>
        {searchQuery && (
          <button type="button" onClick={() => { setSearchQuery(''); onRefresh(); }}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl text-sm transition-all">
            Clear
          </button>
        )}
      </form>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Returns', value: stats.returns, color: 'text-red-400' },
          { label: 'Replacements', value: stats.replacements, color: 'text-blue-400' },
          { label: 'No Response', value: stats.noResponse, color: 'text-amber-400' },
          { label: 'Pending', value: stats.pending, color: 'text-orange-400' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' }
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
          <option value="">All Types</option>
          <option value="RETURN">Return</option>
          <option value="REPLACEMENT">Replacement</option>
          <option value="NO_RESPONSE">No Response</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="WAREHOUSE_APPROVED">Warehouse Approved</option>
          <option value="DISPATCH_READY">Dispatch Ready</option>
          <option value="COMPLETED">Completed</option>
          <option value="WAREHOUSE_REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Package className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No cases found</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.type === 'RETURN' ? 'bg-red-500/20 text-red-400' : c.type === 'REPLACEMENT' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>{c.type}</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${c.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'}`}>{c.status.replace(/_/g, ' ')}</span>
                  <span className="text-xs font-black text-white">{c.orderNumber || 'N/A'}</span>
                  <span className="text-xs text-gray-400">{c.customerName}</span>
                </div>
                <span className="text-[10px] text-gray-500">{fmtDateTime(c.createdAt)}</span>
              </div>
              {c.returnReason && <p className="text-[10px] text-gray-500 mt-1">Reason: {c.returnReason}</p>}
              {c.handledBy && <p className="text-[10px] text-gray-500">Handled by: {c.handledBy}</p>}
              {c.deliveryReturnedBy && <p className="text-[10px] text-gray-500">Returned by: {c.deliveryReturnedBy} at {fmtDateTime(c.deliveryReturnedAt)}</p>}
              {c.acceptedBy && <p className="text-[10px] text-emerald-400">Accepted by: {c.acceptedBy} at {fmtDateTime(c.acceptedAt)}</p>}
              {c.warehouseApprovedBy && <p className="text-[10px] text-emerald-400">Approved by: {c.warehouseApprovedBy} on {fmtDateTime(c.warehouseApprovedAt)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SOURCE_COLORS = {
  PostEx: 'bg-indigo-600', 'Delivery Boy': 'bg-amber-600', 'Enamels Delivery': 'bg-orange-600',
  TCS: 'bg-blue-600', POST_EX: 'bg-indigo-600', Online: 'bg-emerald-600',
  Outlet: 'bg-purple-600', Replacement: 'bg-rose-600', 'Inventory View': 'bg-cyan-600', Manual: 'bg-gray-600'
};
const STATUS_BADGES = {
  PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ACCEPTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  FAISAL_APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  IN_PRODUCTION: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const IncomingReturnsView = ({
  cases, loading, stats, searchQuery, setSearchQuery, filterStatus, setFilterStatus,
  filterSource, setFilterSource, onSearch, onRefresh, onClearFilters,
  fmtDate, fmtDateTime, fmtCurrency, parseProducts, user,
  setActiveView, onSearchReturn, searchQueryMain, setSearchQueryMain,
  setLoadingMain, setReturnCase, setOrderData, setActiveAction
}) => {
  const [expandedId, setExpandedId] = useState(null);
  const sources = stats?.sources ? Object.entries(stats.sources).sort((a, b) => b[1] - a[1]) : [];

  const openInLookup = (c) => {
    setSearchQueryMain(c.orderNumber || c.order?.orderNumber || '');
    setActiveView('lookup');
    setLoadingMain(true);
    setReturnCase(c);
    setOrderData(c.order || null);
    setActiveAction(null);
    api.get(`/api/return-exchange/returns/search?orderNumber=${encodeURIComponent(c.orderNumber || c.order?.orderNumber || '')}`)
      .then(res => { setReturnCase(res.data.returnCase || c); setOrderData(res.data.order || c.order); })
      .catch(() => {})
      .finally(() => setLoadingMain(false));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center"><Inbox className="text-emerald-400" size={20} /></div>
          <div>
            <h2 className="text-white font-black text-lg">Incoming Returns</h2>
            <p className="text-gray-400 text-[11px]">Auto-populated from all return sources</p>
          </div>
        </div>
        <button onClick={onRefresh} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"><RefreshCw size={16} /></button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-800/80 rounded-xl p-3 border border-gray-700"><div className="text-gray-400 text-[10px] font-bold uppercase">Total</div><div className="text-white font-black text-2xl">{stats.total}</div></div>
          <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20"><div className="text-yellow-400 text-[10px] font-bold uppercase">Pending</div><div className="text-yellow-400 font-black text-2xl">{stats.pending}</div></div>
          <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20"><div className="text-blue-400 text-[10px] font-bold uppercase">Accepted</div><div className="text-blue-400 font-black text-2xl">{stats.accepted}</div></div>
          <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20"><div className="text-emerald-400 text-[10px] font-bold uppercase">Sent to Store</div><div className="text-emerald-400 font-black text-2xl">{stats.sentToStore}</div></div>
        </div>
      )}

      {/* Source Chips */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map(([src, count]) => (
            <button key={src} onClick={() => setFilterSource(filterSource === src ? '' : src)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${filterSource === src ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${SOURCE_COLORS[src] || 'bg-gray-500'}`}></span>
              {src} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="Search by order #, customer name, or phone..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white font-bold text-sm outline-none focus:border-emerald-500" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm font-bold outline-none">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="FAISAL_APPROVED">Faisal Approved</option>
          <option value="IN_PRODUCTION">In Production</option>
        </select>
        <button onClick={onSearch} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all">Search</button>
        {(filterStatus || filterSource || searchQuery) && (
          <button onClick={onClearFilters} className="px-3 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-xl text-sm transition-all flex items-center gap-1"><X size={14} /> Clear</button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 font-bold text-sm">Loading incoming returns...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && cases.length === 0 && (
        <div className="text-center py-16">
          <Inbox className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-white font-black text-xl mb-2">No Incoming Returns</h3>
          <p className="text-gray-400 text-sm">No return orders from any source are currently pending.</p>
          {(filterStatus || filterSource || searchQuery) && (
            <button onClick={onClearFilters} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all">Clear Filters</button>
          )}
        </div>
      )}

      {/* Cases List */}
      {!loading && cases.length > 0 && (
        <div className="space-y-2">
          {cases.map(c => {
            const isExpanded = expandedId === c.id;
            const products = parseProducts(c.originalProducts || c.order?.productDetails);
            const src = c._returnSource || 'Manual';
            const srcColor = SOURCE_COLORS[src] || 'bg-gray-600';
            const stBadge = STATUS_BADGES[c.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            return (
              <div key={c.id} className="bg-gray-800/80 rounded-xl border border-gray-700 hover:border-gray-500 transition-all">
                <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div className={`w-8 h-8 rounded-lg ${srcColor} flex items-center justify-center flex-shrink-0`}>
                    {src === 'PostEx' ? <Truck size={14} className="text-white" /> : <Package size={14} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-black text-sm">{c.orderNumber || c.order?.orderNumber || 'N/A'}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${stBadge}`}>{c.status}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: SOURCE_COLORS[src] || '#6b7280' }}>{src}</span>
                      {c.postexShipment?.trackingNumber && <span className="text-[10px] text-indigo-400 font-mono">{c.postexShipment.trackingNumber}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-gray-400 text-[11px]">{c.customerName || c.order?.customerName || '-'}</span>
                      <span className="text-gray-500 text-[11px]">{c.customerPhone || c.order?.customerPhone || ''}</span>
                      <span className="text-gray-500 text-[11px]">{products.length} item{products.length !== 1 ? 's' : ''} ({c._totalQty || 0} qty)</span>
                      {c._orderTotal > 0 && <span className="text-emerald-400 text-[11px] font-bold">{fmtCurrency(c._orderTotal)}</span>}
                    </div>
                    {c.returnReason && <p className="text-gray-500 text-[10px] mt-1 truncate">{c.returnReason}</p>}
                  </div>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">{fmtDateTime(c.createdAt)}</span>
                  <ArrowRight size={14} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-700/50 pt-3 space-y-3">
                    {/* Products */}
                    {products.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-gray-400 text-[10px] font-bold uppercase">Products</h4>
                        {products.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 bg-gray-900/50 rounded-lg px-3 py-2">
                            <span className="text-gray-500 text-[10px] font-bold">#{i + 1}</span>
                            <span className="text-white text-xs font-bold flex-1">{p.name || p.productType || 'Product'}</span>
                            {p.color && <span className="text-gray-400 text-[10px]">{p.color}</span>}
                            {p.size && <span className="text-gray-400 text-[10px]">{p.size}</span>}
                            <span className="text-gray-400 text-[10px]">x{p.quantity || 1}</span>
                            {p.unitPrice > 0 && <span className="text-emerald-400 text-[10px] font-bold">{fmtCurrency(p.unitPrice)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Return Details */}
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div className="space-y-1">
                        <div className="text-gray-500">Return Reason: <span className="text-gray-300 font-bold">{c.returnReason || 'Not specified'}</span></div>
                        <div className="text-gray-500">Return Type: <span className="text-gray-300 font-bold">{c.type}</span></div>
                        <div className="text-gray-500">Routed To: <span className="text-gray-300 font-bold">{c.routedTo || 'Store'}</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-500">Order Source: <span className="text-gray-300 font-bold">{c.order?.source || 'N/A'}</span></div>
                        <div className="text-gray-500">Delivery Type: <span className="text-gray-300 font-bold">{c.order?.deliveryType || 'N/A'}</span></div>
                        <div className="text-gray-500">Warehouse Notes: <span className="text-gray-300 font-bold">{c.warehouseNotes || 'None'}</span></div>
                      </div>
                    </div>

                    {/* PostEx Shipment */}
                    {c.postexShipment && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                        <div className="flex items-center gap-2"><span className="font-bold text-indigo-400">PostEx Shipment</span>
                          <span className="text-gray-300 font-mono">{c.postexShipment.trackingNumber}</span></div>
                        <div className="flex gap-3 text-gray-400">
                          <span>Status: <span className="text-white font-bold">{(c.postexShipment.status || '').replace(/_/g, ' ')}</span></span>
                          {c.postexShipment.totalAmount > 0 && <span>Amount: <span className="text-amber-400">{fmtCurrency(c.postexShipment.totalAmount)}</span></span>}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); openInLookup(c); }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-2">
                        <Search size={12} /> View in Order Lookup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PostExReturnsView = ({ cases, loading, stats, fmtDate, fmtDateTime, parseProducts, fmtCurrency, onRefresh }) => {
  const [filterStatus, setFilterStatus] = useState('');
  const filtered = cases.filter(c => !filterStatus || c.status === filterStatus);

  const statusCounts = (stats || []).reduce((acc, s) => { acc[s.status] = s._count; return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-indigo-400 flex items-center gap-2"><Truck size={16} /> PostEx Incoming Returns</h3>
          <p className="text-xs text-gray-500 mt-0.5">Return cases from PostEx courier deliveries (auto-created via webhook)</p>
        </div>
        <button onClick={onRefresh} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs font-bold transition-all">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: filtered.length, color: 'text-white' },
          { label: 'Pending', value: statusCounts['PENDING'] || 0, color: 'text-orange-400' },
          { label: 'Accepted', value: statusCounts['ACCEPTED'] || 0, color: 'text-emerald-400' },
          { label: 'Store', value: statusCounts['PENDING'] && statusCounts['ACCEPTED'] ? '—' : '—', color: 'text-blue-400' },
          { label: 'Completed', value: statusCounts['COMPLETED'] || 0, color: 'text-emerald-300' }
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none">
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="ACCEPTED">Accepted</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading PostEx returns...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Truck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No PostEx returns found</p>
          <p className="text-xs text-gray-600 mt-1">Incoming returns from PostEx will appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-indigo-500/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-red-500/20 text-red-400">RETURN</span>
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      c.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                      c.status === 'ACCEPTED' ? 'bg-blue-500/20 text-blue-400' :
                      c.status === 'PENDING' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>{c.status.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-black text-white">{c.orderNumber || 'N/A'}</span>
                    <span className="text-xs text-gray-400">{c.customerName}</span>
                    {c.order?.deliveryType === 'POST_EX' && (
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PostEx</span>
                    )}
                  </div>
                  {c.returnReason && <p className="text-[10px] text-gray-500">Reason: {c.returnReason}</p>}
                  {c.handledBy && <p className="text-[10px] text-gray-500">Handled by: {c.handledBy}</p>}
                  {c.deliveryReturnedBy && <p className="text-[10px] text-gray-500">Returned by: {c.deliveryReturnedBy} at {fmtDateTime(c.deliveryReturnedAt)}</p>}

                  {/* PostEx shipment info */}
                  {c.postexShipment && (
                    <div className="mt-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-400">PostEx Shipment</span>
                        {c.postexShipment.trackingNumber && <span className="text-gray-300 font-mono">{c.postexShipment.trackingNumber}</span>}
                      </div>
                      <div className="flex gap-3 text-gray-400">
                        {c.postexShipment.status && <span>Status: <span className="text-white font-bold">{c.postexShipment.status.replace(/_/g, ' ')}</span></span>}
                        {c.postexShipment.totalAmount && <span>Amount: <span className="text-amber-400">{fmtCurrency(c.postexShipment.totalAmount)}</span></span>}
                        {c.postexShipment.destinationCity && <span>City: <span className="text-white">{c.postexShipment.destinationCity}</span></span>}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{fmtDateTime(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReturnExchangePage;
