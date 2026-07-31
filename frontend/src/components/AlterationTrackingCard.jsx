import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Clock, CheckCircle, AlertTriangle, Calendar, Search, Filter, ChevronDown, User, Timer } from 'lucide-react';
import api from '../services/api';
import { formatDateOnly, formatDateTime } from '../utils/dateTime';

const STATUS_COLORS = {
  PENDING: 'bg-amber-500/20 text-amber-400',
  ACCEPTED: 'bg-blue-500/20 text-blue-400',
  IN_PROGRESS: 'bg-purple-500/20 text-purple-400',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400',
  DONE: 'bg-gray-500/20 text-gray-400',
  REJECTED: 'bg-red-500/20 text-red-400'
};

const STAGE_LABELS = {
  ALTERATION_PENDING: 'Pending',
  ALTERATION_IN: 'In Production',
  ALTERATION_RETURN: 'Completed — Outlet',
  ALTERATION_IV_RETURN: 'Completed — Inventory View',
  DONE: 'Done',
  REJECTED: 'Rejected'
};

const AlterationTrackingCard = () => {
  const [stats, setStats] = useState(null);
  const [alterations, setAlterations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlteration, setSelectedAlteration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, altRes] = await Promise.all([
        api.get('/api/alterations/stats'),
        api.get('/api/alterations?limit=100')
      ]);
      setStats(statsRes.data);
      setAlterations(altRes.data);
    } catch (e) {
      console.error('Error fetching alterations:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const filtered = alterations.filter(a => {
    if (selectedFilter !== 'all' && a.status !== selectedFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (a.alterationNumber || '').toLowerCase().includes(s) ||
             (a.customerName || '').toLowerCase().includes(s) ||
             (a.orderNumber || '').toLowerCase().includes(s);
    }
    return true;
  });

  const StatCard = ({ label, value, color, icon: Icon }) => (
    <div className={`bg-gray-900/80 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-600 transition-all ${selectedFilter === label.toUpperCase().replace(' ', '_') ? 'ring-2 ring-white/30' : ''}`}
      onClick={() => setSelectedFilter(selectedFilter === label.toUpperCase().replace(' ', '_') ? 'all' : label.toUpperCase().replace(' ', '_'))}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-20" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} color="text-white" icon={AlertTriangle} />
          <StatCard label="Pending" value={stats.pending} color="text-amber-400" icon={Clock} />
          <StatCard label="In Progress" value={stats.inProgress} color="text-blue-400" icon={Timer} />
          <StatCard label="Completed" value={stats.completed} color="text-emerald-400" icon={CheckCircle} />
          <StatCard label="Avg Hours" value={stats.avgProcessingTime + 'h'} color="text-gray-400" icon={Calendar} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by #, customer, order..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-white text-xs font-bold" />
        </div>
        <button onClick={handleRefresh} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl border border-gray-700/50">
          <RefreshCcw size={14} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alterations List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 font-bold text-sm">No alterations found</div>
        ) : (
          filtered.map(alt => {
            let products = [];
            try { products = typeof alt.products === 'string' ? JSON.parse(alt.products) : (alt.products || []); } catch {}

            return (
              <motion.div key={alt.id} layout
                className={`bg-gray-900/80 border rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selectedAlteration?.id === alt.id ? 'border-white/30' : 'border-gray-800 hover:border-gray-700'
                }`}
                onClick={() => setSelectedAlteration(selectedAlteration?.id === alt.id ? null : alt)}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{alt.alterationNumber}</p>
                        <p className="text-[11px] text-gray-500">{alt.customerName || 'N/A'} {alt.orderNumber ? `• Order: ${alt.orderNumber}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">{formatDateOnly(alt.createdAt)}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_COLORS[alt.status] || 'bg-gray-800 text-gray-400'}`}>
                        {alt.status}
                      </span>
                      <ChevronDown size={14} className={`text-gray-500 transition-transform ${selectedAlteration?.id === alt.id ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {selectedAlteration?.id === alt.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-gray-800 p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-gray-500 block">Source</span><span className="text-white font-bold">{alt.sourceOutlet || alt.sourceModule}</span></div>
                      <div><span className="text-gray-500 block">Stage</span><span className="text-white font-bold">{STAGE_LABELS[alt.currentStage] || alt.currentStage}</span></div>
                      <div><span className="text-gray-500 block">Phone</span><span className="text-white font-bold">{alt.customerPhone || 'N/A'}</span></div>
                      <div><span className="text-gray-500 block">Created</span><span className="text-white font-bold">{formatDateTime(alt.createdAt)}</span></div>
                    </div>

                    {alt.acceptedBy && (
                      <div className="text-xs"><span className="text-gray-500">Accepted by: </span><span className="text-emerald-400 font-bold">{alt.acceptedBy.name}</span>
                        {alt.acceptedAt && <span className="text-gray-600 ml-2">{formatDateTime(alt.acceptedAt)}</span>}
                      </div>
                    )}
                    {alt.completedBy && (
                      <div className="text-xs"><span className="text-gray-500">Completed by: </span><span className="text-blue-400 font-bold">{alt.completedBy.name}</span>
                        {alt.completedAt && <span className="text-gray-600 ml-2">{formatDateTime(alt.completedAt)}</span>}
                      </div>
                    )}
                    {alt.doneBy && (
                      <div className="text-xs"><span className="text-gray-500">Done by: </span><span className="text-purple-400 font-bold">{alt.doneBy.name}</span>
                        {alt.doneAt && <span className="text-gray-600 ml-2">{formatDateTime(alt.doneAt)}</span>}
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Products</p>
                      {products.map((p, i) => (
                        <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 mb-1">
                          <p className="text-xs font-bold text-white">{p.productName} {p.color ? `(${p.color})` : ''} {p.size ? `(${p.size})` : ''}</p>
                          <p className="text-[11px] text-purple-300 italic">{p.alterationNote}</p>
                        </div>
                      ))}
                    </div>

                    {alt.stages && alt.stages.length > 0 && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Stage History</p>
                        <div className="space-y-1">
                          {alt.stages.map(s => (
                            <div key={s.id} className="flex items-center gap-2 text-[11px]">
                              <span className={`w-2 h-2 rounded-full ${s.status === 'COMPLETED' ? 'bg-emerald-500' : s.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-600'}`} />
                              <span className="text-gray-400">{STAGE_LABELS[s.stageName] || s.stageName}</span>
                              <span className={`font-bold ${s.status === 'COMPLETED' ? 'text-emerald-400' : s.status === 'IN_PROGRESS' ? 'text-blue-400' : 'text-gray-500'}`}>{s.status}</span>
                              {s.completedAt && <span className="text-gray-600 ml-auto">{formatDateTime(s.completedAt)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AlterationTrackingCard;
