import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';
import { formatDateOnly, formatTimeOnly } from '../utils/dateTime';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { Truck, Package, CheckCircle2, XCircle, RotateCcw, Clock, RefreshCw, Search, Eye, MapPin, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';

const STATUS_COLORS = {
  CREATED: { bg: 'bg-gray-600/20', border: 'border-gray-500/50', text: 'text-gray-400', icon: Package },
  BOOKED: { bg: 'bg-blue-600/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: Package },
  PICKED_UP: { bg: 'bg-indigo-600/20', border: 'border-indigo-500/50', text: 'text-indigo-400', icon: Truck },
  IN_TRANSIT: { bg: 'bg-amber-600/20', border: 'border-amber-500/50', text: 'text-amber-400', icon: Truck },
  OUT_FOR_DELIVERY: { bg: 'bg-violet-600/20', border: 'border-violet-500/50', text: 'text-violet-400', icon: MapPin },
  DELIVERED: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: CheckCircle2 },
  RETURNED: { bg: 'bg-orange-600/20', border: 'border-orange-500/50', text: 'text-orange-400', icon: RotateCcw },
  RETURN_IN_TRANSIT: { bg: 'bg-red-600/20', border: 'border-red-500/50', text: 'text-red-400', icon: RotateCcw },
  RETURN_RECEIVED: { bg: 'bg-red-600/20', border: 'border-red-500/50', text: 'text-red-400', icon: RotateCcw },
  CANCELLED: { bg: 'bg-gray-600/20', border: 'border-gray-500/50', text: 'text-gray-400', icon: XCircle },
  FAILED_DELIVERY: { bg: 'bg-red-600/20', border: 'border-red-500/50', text: 'text-red-400', icon: AlertTriangle },
};

const fmtMoney = (n) => 'PKR ' + Number(n || 0).toLocaleString();

const PostExDashboard = () => {
  const { isUrdu } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [trackingModal, setTrackingModal] = useState(null);
  const [trackData, setTrackData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/postex/dashboard-stats');
      setStats(res.data);
    } catch (err) {
      console.error('PostEx dashboard stats error:', err);
      toast.error('Failed to load PostEx dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/postex/sync-statuses');
      toast.success(res.data.message || 'Sync complete.');
      await fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleTrack = async (shipment) => {
    setTrackingModal(shipment);
    setTrackData(null);
    setTrackingLoading(true);
    try {
      const res = await api.get(`/api/postex/track-live/${shipment.trackingNumber}`);
      setTrackData(res.data);
    } catch (err) {
      toast.error('Failed to fetch tracking data.');
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  const ov = stats?.overview || {};
  const recent = stats?.recentShipments || [];

  const filteredShipments = recent.filter(s => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (s.orderNumber || '').toLowerCase().includes(q) ||
        (s.trackingNumber || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black theme-text-primary uppercase tracking-tight flex items-center gap-3">
            <Truck className="text-amber-400" size={28} />
            {isUrdu ? 'پوسٹ ایکس ڈیش بورڈ' : 'PostEx Dashboard'}
          </h1>
          <p className="text-sm font-bold theme-text-muted mt-1 uppercase tracking-wider">
            {isUrdu ? 'courier شپمنٹ کی مکمل نگرانی' : 'Complete courier shipment monitoring & tracking'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 border border-amber-600/50 text-amber-400 font-bold text-sm hover:bg-amber-600/30 transition-all disabled:opacity-50">
            {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isUrdu ? 'سٹیٹس سنک' : 'Sync Statuses'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
        {[
          { label: isUrdu ? 'کل شپمنٹ' : 'Total Shipments', value: ov.totalShipments || 0, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: isUrdu ? 'آج کے شپمنٹ' : 'Today', value: ov.todayShipments || 0, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: isUrdu ? 'ڈلیور شدہ' : 'Delivered', value: ov.deliveredCount || 0, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: isUrdu ? 'ٹرانزٹ میں' : 'In Transit', value: ov.inTransitCount || 0, icon: Truck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: isUrdu ? 'واپس آئے' : 'Returned', value: (ov.returnedCount || 0) + (ov.failedCount || 0), icon: RotateCcw, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: isUrdu ? 'کینسل' : 'Cancelled', value: ov.cancelledCount || 0, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon size={14} className={s.color} /></div>
              <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{s.label}</span>
            </div>
            <div className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      {/* Revenue + Rates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{isUrdu ? 'کل ریونیو' : 'Total Revenue'}</span>
          <div className="text-xl font-black text-emerald-400 mt-1">{fmtMoney(ov.totalRevenue)}</div>
        </div>
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{isUrdu ? 'COD کل' : 'Total COD'}</span>
          <div className="text-xl font-black text-amber-400 mt-1">{fmtMoney(ov.totalCOD)}</div>
        </div>
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{isUrdu ? 'ڈلیوری شرح' : 'Delivery Rate'}</span>
          <div className="text-xl font-black text-cyan-400 mt-1">{ov.deliveryRate || 0}%</div>
        </div>
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{isUrdu ? 'واپسی شرح' : 'Return Rate'}</span>
          <div className="text-xl font-black text-orange-400 mt-1">{ov.returnRate || 0}%</div>
        </div>
      </div>

      {/* Status Breakdown Chips */}
      {stats?.statusBreakdown && Object.keys(stats.statusBreakdown).length > 0 && (
        <div className="glass rounded-2xl p-4 border border-gray-700/50">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-widest mb-3">{isUrdu ? 'سٹیٹس کی تقسیم' : 'Status Breakdown'}</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${statusFilter === 'ALL' ? 'bg-white/20 border-white/50 text-white' : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white'}`}>
              All ({recent.length})
            </button>
            {Object.entries(stats.statusBreakdown).sort(([, a], [, b]) => b - a).map(([status, count]) => {
              const sc = STATUS_COLORS[status] || STATUS_COLORS.CREATED;
              return (
                <button key={status} onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${statusFilter === status ? `${sc.bg} ${sc.border} ${sc.text}` : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white'}`}>
                  {status.replace(/_/g, ' ')} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="glass rounded-2xl p-4 border border-gray-700/50">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={isUrdu ? 'آرڈر #، ٹیکنگ نمبر، یا گاہک کا نام تلاش کریں...' : 'Search order #, tracking #, or customer name...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white text-sm font-bold placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all" />
        </div>
      </div>

      {/* Recent Shipments Table */}
      <div className="glass rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="p-4 border-b border-gray-700/50">
          <h3 className="text-sm font-black theme-text-primary uppercase tracking-widest">
            {isUrdu ? 'حالیہ شپمنٹ' : 'Recent Shipments'} ({filteredShipments.length})
          </h3>
        </div>
        {filteredShipments.length === 0 ? (
          <div className="p-8 text-center theme-text-muted">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">{isUrdu ? 'کوئی شپمنٹ نہیں ملا' : 'No shipments found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Order #</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Tracking #</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Customer</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">City</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black theme-text-muted uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredShipments.map((s) => {
                  const sc = STATUS_COLORS[s.status] || STATUS_COLORS.CREATED;
                  const Icon = sc.icon;
                  return (
                    <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-black text-white">{s.orderNumber || '-'}</td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{s.trackingNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-300">{s.customerName || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-400">{s.city || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-400">{fmtMoney(s.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${sc.bg} ${sc.border} ${sc.text}`}>
                          <Icon size={12} />
                          {s.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-gray-500">
                        {s.createdAt ? formatDateOnly(s.createdAt) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {s.trackingNumber && (
                          <button onClick={() => handleTrack(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-600/50 text-amber-400 text-xs font-black hover:bg-amber-600/30 transition-all">
                            <Eye size={12} /> Track
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tracking Modal */}
      {trackingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTrackingModal(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl max-h-[80vh] bg-gray-900 rounded-3xl border border-gray-700/50 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black theme-text-primary uppercase tracking-tight">
                  {isUrdu ? 'شپمنٹ ٹیکنگ' : 'Shipment Tracking'}
                </h3>
                <p className="text-xs font-bold theme-text-muted mt-0.5">{trackingModal.orderNumber} &middot; {trackingModal.trackingNumber}</p>
              </div>
              <button onClick={() => setTrackingModal(null)} className="p-2 rounded-xl hover:bg-gray-800 transition-all">
                <X size={18} className="theme-text-muted" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)]">
              {trackingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-amber-400" />
                </div>
              ) : trackData ? (
                <div className="space-y-4">
                  {/* Current Status */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
                    {(() => { const sc = STATUS_COLORS[trackData.currentStatus] || STATUS_COLORS.CREATED; const Icon = sc.icon; return (
                      <><div className={`p-2 rounded-lg ${sc.bg}`}><Icon size={18} className={sc.text} /></div>
                      <div><div className="text-xs font-black theme-text-muted uppercase tracking-widest">Current Status</div>
                      <div className={`text-sm font-black ${sc.text}`}>{trackData.currentStatus?.replace(/_/g, ' ')}</div></div></>
                    ); })()}
                    <div className="ml-auto text-right">
                      <div className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Source</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${trackData.isLive ? 'bg-emerald-600/20 text-emerald-400' : 'bg-gray-600/20 text-gray-400'}`}>
                        {trackData.isLive ? 'LIVE' : trackData.mode}
                      </span>
                    </div>
                  </div>

                  {/* Timeline */}
                  {trackData.timeline && trackData.timeline.length > 0 ? (
                    <div className="space-y-0">
                      {trackData.timeline.map((entry, idx) => {
                        const sc = STATUS_COLORS[entry.status] || STATUS_COLORS.CREATED;
                        const Icon = sc.icon;
                        return (
                          <div key={idx} className="flex gap-3 relative">
                            <div className="flex flex-col items-center">
                              <div className={`p-1.5 rounded-full ${sc.bg} border ${sc.border} z-10`}>
                                <Icon size={12} className={sc.text} />
                              </div>
                              {idx < trackData.timeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-700/50 my-1" />}
                            </div>
                            <div className="pb-4 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-black uppercase tracking-wider ${sc.text}`}>{entry.label}</span>
                                {entry.source === 'postex' && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-600/20 text-amber-400 border border-amber-600/30">API</span>
                                )}
                              </div>
                              {entry.timestamp && (
                                <div className="text-[10px] font-bold text-gray-500 mt-0.5">
                                  {formatDateOnly(entry.timestamp)} {formatTimeOnly(entry.timestamp)}
                                </div>
                              )}
                              {entry.location && (
                                <div className="text-[10px] font-bold text-gray-500 mt-0.5 flex items-center gap-1">
                                  <MapPin size={10} /> {entry.location}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 theme-text-muted">
                      <Clock size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-bold">No timeline data available</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PostExDashboard;
