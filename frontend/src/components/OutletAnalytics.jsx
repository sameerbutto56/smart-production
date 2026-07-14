import React, { useState } from 'react';
import api from '../services/api';
import useCache from '../hooks/useCache';
import { Store, DollarSign, ShoppingCart, CalendarDays, Loader2 } from 'lucide-react';

const BRANCHES = [
  { value: '', label: 'All Outlets' },
  { value: 'JOHAR TOWN BRANCH', label: 'Johar Town Branch' },
  { value: 'ABBOTTABAD BRANCH', label: 'Abbottabad Branch' },
  { value: 'JAIL ROAD BRANCH', label: 'Jail Road Branch' },
  { value: 'ONLINE ORDER', label: 'Online System' },
];

const OutletAnalytics = () => {
  const [outletFilter, setOutletFilter] = useState('');
  const [outletDateRange, setOutletDateRange] = useState('all');
  const [outletCustomFrom, setOutletCustomFrom] = useState('');
  const [outletCustomTo, setOutletCustomTo] = useState('');
  const [outletCustomNonce, setOutletCustomNonce] = useState(0);

  const outletAnalyticsKey = outletDateRange !== 'custom'
    ? `analytics:outlet:${outletFilter}:${outletDateRange}`
    : `analytics:outlet:${outletFilter}:custom:${outletCustomFrom}:${outletCustomTo}:${outletCustomNonce}`;
  const { data: outletAnalytics, loading: outletAnalyticsLoading, refresh: refreshOutletAnalytics } = useCache(outletAnalyticsKey, { fetcher: () => {
    const params = {};
    if (outletFilter) params.outletName = outletFilter;
    const now = new Date();
    if (outletDateRange === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      params.dateFrom = weekAgo.toISOString();
    } else if (outletDateRange === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      params.dateFrom = monthAgo.toISOString();
    } else if (outletDateRange === 'custom') {
      if (outletCustomFrom) params.dateFrom = new Date(outletCustomFrom).toISOString();
      if (outletCustomTo) params.dateTo = new Date(outletCustomTo).toISOString();
    }
    return api.get('/api/orders/outlet-analytics', { params }).then(r => r.data);
  }, ttl: 60000 });

  return (
    <section className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-purple-500/10 rounded-2xl">
          <Store className="text-purple-400" size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Outlet Analytics</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Branch-wise performance &amp; revenue</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BRANCHES.map(b => (
          <button
            key={b.value}
            onClick={() => setOutletFilter(b.value)}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all ${
              outletFilter === b.value
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                : 'bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: 'All Time' },
          { key: 'week', label: 'Weekly' },
          { key: 'month', label: 'Monthly' },
        ].map(r => (
          <button
            key={r.key}
            onClick={() => setOutletDateRange(r.key)}
            className={`px-3 py-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all ${
              outletDateRange === r.key ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setOutletDateRange('custom')}
          className={`px-3 py-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-widest transition-all flex items-center gap-1 ${
            outletDateRange === 'custom' ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
          }`}
        >
          <CalendarDays size={12} /> Custom
        </button>
        {outletDateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={outletCustomFrom} onChange={(e) => setOutletCustomFrom(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-purple-500" />
            <span className="text-gray-600 text-xs">—</span>
            <input type="date" value={outletCustomTo} onChange={(e) => setOutletCustomTo(e.target.value)}
              className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-purple-500" />
            <button
              onClick={() => setOutletCustomNonce(n => n + 1)}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs md:text-sm font-black uppercase tracking-widest hover:bg-purple-500 transition-all"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {outletAnalyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : outletAnalytics ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Total Orders</p>
              <p className="text-2xl font-black text-white mt-1">{outletAnalytics.summary.totalOrders}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Completed</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{outletAnalytics.summary.completedOrders}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">In Progress</p>
              <p className="text-2xl font-black text-blue-400 mt-1">{outletAnalytics.summary.inProgressOrders}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Pending</p>
              <p className="text-2xl font-black text-yellow-400 mt-1">{outletAnalytics.summary.pendingOrders}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Cancelled</p>
              <p className="text-2xl font-black text-red-400 mt-1">{outletAnalytics.summary.cancelledOrders}</p>
            </div>
            <div className="glass rounded-xl p-4 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Total Revenue</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">PKR {Number(outletAnalytics.summary.totalRevenue).toLocaleString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-5 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={12} className="text-emerald-400" /> Total Revenue
              </p>
              <p className="text-xl md:text-3xl font-black text-emerald-400 mt-2">PKR {Number(outletAnalytics.summary.totalRevenue).toLocaleString()}</p>
              <p className="text-xs text-gray-600 font-bold uppercase tracking-widest mt-1">Completed &amp; Delivered Orders Only</p>
            </div>
            <div className="glass rounded-xl p-5 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart size={12} className="text-blue-400" /> Avg Order Value
              </p>
              <p className="text-xl md:text-3xl font-black text-blue-400 mt-2">PKR {Number(outletAnalytics.summary.avgOrderValue).toFixed(2)}</p>
              <p className="text-xs text-gray-600 font-bold uppercase tracking-widest mt-1">Completed &amp; Delivered Orders Only</p>
            </div>
          </div>

          {outletAnalytics.recentOrders?.length > 0 && (
            <div className="glass rounded-xl p-5 border border-gray-800">
              <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-3">Recent Orders</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest border-b border-gray-800">
                      <th className="py-2 pr-4">Order</th>
                      <th className="py-2 pr-4">Customer</th>
                      <th className="py-2 pr-4">Outlet</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outletAnalytics.recentOrders.map(o => (
                      <tr key={o.id} className="border-b border-gray-800/50 text-sm">
                        <td className="py-2 pr-4 font-bold text-white">#{o.orderNumber || o.id.substring(0, 6)}</td>
                        <td className="py-2 pr-4 text-gray-300">{o.customerName}</td>
                        <td className="py-2 pr-4 text-gray-400 text-xs md:text-sm">{o.outletName || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs md:text-sm font-black px-2 py-1 rounded ${
                            o.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                            o.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                            o.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>{o.status}</span>
                          {(() => {
                            const _p = o.paymentStatus === 'PAID' || o.paymentStatus === 'FULL_PAID';
                            const _a = parseFloat(o.advanceAmount || 0) > 0;
                            if (_p) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">PAID</span>;
                            if (_a) return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-orange-500/20 text-orange-400">REMAINING COD</span>;
                            return <span className="ml-1 text-xs font-black px-2 py-1 rounded bg-red-500/20 text-red-400">COD</span>;
                          })()}
                        </td>
                        <td className="py-2 pr-4 text-right font-bold text-white">PKR {o.totalPrice || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default OutletAnalytics;
