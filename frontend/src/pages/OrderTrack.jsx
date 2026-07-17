import React, { useState } from 'react';
import api from '../services/api';
import { Search, Package, Clock, CheckCircle, AlertCircle, Truck, RotateCcw, XCircle, RefreshCcw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry', STORE: 'Store', WORKERS: 'Workers',
  LOGO_DESIGN: 'Logo Design', PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production', STORE_RECEIVE: 'Store Receive',
  DISPATCH: 'Dispatch', OUT_FOR_DELIVERY: 'Out for Delivery'
};

const OrderTrack = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleTrack = async () => {
    if (!orderNumber.trim()) { setError('Please enter an order number'); return; }
    setLoading(true); setError(''); setOrder(null);
    try {
      const res = await api.get(`/api/orders/track/${orderNumber.trim().replace(/^#/, '')}`);
      setOrder(res.data);
    } catch (e) {
      setError(e.response?.status === 404 ? 'Order not found' : 'Error fetching order');
    } finally { setLoading(false); }
  };

  const stageIcon = (stage) => {
    if (stage.status === 'COMPLETED') return <CheckCircle size={16} className="text-emerald-400" />;
    if (stage.status === 'ACTIVE' && stage.startedAt) return <Clock size={16} className="text-blue-400" />;
    if (stage.returnReason) return <RotateCcw size={16} className="text-red-400" />;
    return <Clock size={16} className="text-gray-500" />;
  };

  const statusBadge = (order) => {
    if (order.status === 'COMPLETED') return <span className="text-[10px] font-black px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg">COMPLETED</span>;
    if (order.status === 'CANCELLED') return <span className="text-[10px] font-black px-2 py-1 bg-red-500/20 text-red-400 rounded-lg">CANCELLED</span>;
    if (order.status === 'HOLD') return <span className="text-[10px] font-black px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg">ON HOLD</span>;
    return <span className="text-[10px] font-black px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg">IN PROGRESS</span>;
  };

  return (
    <div className="p-2 md:p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors"><ArrowLeft size={16} className="text-gray-400" /></button>
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Order Track</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Search order by number</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={orderNumber}
          onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTrack()}
          placeholder="Enter order number..."
          className="flex-1 bg-gray-900 border-2 border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-purple-500"
        />
        <button onClick={handleTrack} disabled={loading} className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
          {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />} Track
        </button>
      </div>
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      {order && (
        <div className="space-y-3">
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-lg font-black text-white">#{order.orderNumber}</p>
                <p className="text-xs text-gray-400 font-bold">{order.customerName} — {order.customerPhone}</p>
              </div>
              <div className="flex gap-2">{statusBadge(order)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-gray-500 font-bold uppercase">Outlet:</span> <span className="text-white font-bold">{order.outletName || '—'}</span></div>
              <div><span className="text-gray-500 font-bold uppercase">Order Type:</span> <span className="text-white font-bold">{order.orderType || '—'}</span></div>
              <div><span className="text-gray-500 font-bold uppercase">Total:</span> <span className="text-emerald-400 font-black">₨{order.totalPrice?.toLocaleString() || '0'}</span></div>
              <div><span className="text-gray-500 font-bold uppercase">Delivery:</span> <span className="text-white font-bold">{order.deliveryMethod || order.deliveryType || '—'}</span></div>
            </div>
            {order.advanceAmount > 0 && <p className="text-xs text-orange-400 font-bold mt-2">Advance Paid: ₨{order.advanceAmount}</p>}
          </div>

          <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Workflow Timeline</p>
            <div className="space-y-0">
              {order.stages?.map((s, i) => (
                <div key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${s.status === 'COMPLETED' ? 'bg-emerald-500/20 border-emerald-500' : s.startedAt ? 'bg-blue-500/20 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
                      {stageIcon(s)}
                    </div>
                    {i < order.stages.length - 1 && <div className="w-0.5 h-8 bg-gray-800" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <p className="text-sm font-black text-white">{STAGE_LABELS[s.stageName] || s.stageName}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : s.startedAt ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
                        {s.status === 'COMPLETED' ? 'Done' : s.startedAt ? 'In Progress' : 'Pending'}
                      </span>
                      {s.returnReason && <span className="text-[10px] font-bold text-red-400">Returned: {s.returnReason}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.routingHistory?.length > 0 && (
            <div className="bg-gray-900/60 rounded-2xl border border-gray-800/50 p-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Routing History</p>
              <div className="space-y-2">
                {order.routingHistory.map(rh => (
                  <div key={rh.id} className="flex items-center gap-2 text-xs">
                    <Truck size={12} className="text-gray-500 shrink-0" />
                    <span className="text-gray-400">{rh.previousStage || '—'} → <span className="text-white font-bold">{rh.newStage}</span></span>
                    <span className="text-gray-600">by {rh.sentByUser?.name || 'System'}</span>
                    <span className="text-gray-600 ml-auto">{new Date(rh.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderTrack;
