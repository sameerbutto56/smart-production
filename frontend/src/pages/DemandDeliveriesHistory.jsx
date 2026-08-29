import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';
import { toUrduName } from '../utils/urduDictionary';
import { Truck, RefreshCw, UserCheck, Clock, FileText, PackageCheck, CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';

const STAGES = [
  { key: 'pending',   label: 'Pending Dispatch Pickup', color: 'blue' },
  { key: 'inTransit', label: 'In Transit (Boy Accepted)', color: 'amber' },
  { key: 'delivered', label: 'Delivered — Awaiting Outlet Accept', color: 'emerald' },
  { key: 'completed', label: 'Completed (Outlet Accepted)', color: 'purple' }
];

const STATUS_CHANNEL = {
  ENAMELS: 'bg-blue-600 text-white',
  SELF_DELIVERY: 'bg-gray-600 text-white'
};

export default function DemandDeliveriesHistory() {
  const [deliveries, setDeliveries] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, inTransit: 0, delivered: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({ status: '', outletName: '', deliveryBoyName: '', channel: '', dateFrom: '', dateTo: '' });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.outletName) params.outletName = filters.outletName;
      if (filters.deliveryBoyName) params.deliveryBoyName = filters.deliveryBoyName;
      if (filters.channel) params.channel = filters.channel;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      const { data } = await api.get('/api/demand/history', { params });
      setDeliveries(data.deliveries || []);
      setCounts({ total: data.total || 0, pending: data.pending || 0, inTransit: data.inTransit || 0, delivered: data.delivered || 0, completed: data.completed || 0 });
    } catch (err) {
      console.error('Error loading demand delivery history', err);
      toast.error(err?.response?.data?.message || 'Error loading demand delivery history');
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.outletName, filters.deliveryBoyName, filters.channel, filters.dateFrom, filters.dateTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const groupedByStage = (list) => STAGES.map((s) => ({
    ...s,
    list: list.filter((d) => {
      const accepted = !!d.deliveryBoyAcceptedAt;
      const delivered = !!d.deliveredAt;
      const completed = !!d.acceptedAt;
      if (s.key === 'pending') return !accepted && !delivered && !completed;
      if (s.key === 'inTransit') return accepted && !delivered && !completed;
      if (s.key === 'delivered') return delivered && !completed;
      return completed;
    })
  }));

  const filtered = activeStage === 'all' ? deliveries : groupedByStage(deliveries).find((s) => s.key === activeStage)?.list || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-blue-400" />
          <h1 className="text-lg font-black text-white">Enamels Demand Deliveries</h1>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Ledger</span>
        </div>
        <button onClick={fetchHistory} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs font-black text-gray-300 hover:bg-gray-700 transition-all">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Dispatched" value={counts.total} color="text-blue-400" icon={<PackageCheck size={16} />} />
        <StatCard label="Pending Pickup" value={counts.pending} color="text-gray-300" icon={<CircleDashed size={16} />} />
        <StatCard label="In Transit" value={counts.inTransit} color="text-amber-400" icon={<Truck size={16} />} />
        <StatCard label="Delivered — Awaiting Accept" value={counts.delivered} color="text-emerald-400" icon={<CheckCircle2 size={16} />} />
        <StatCard label="Completed" value={counts.completed} color="text-purple-400" icon={<FileText size={16} />} />
      </div>

      {/* Filters */}
      <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-3 space-y-3">
        <div className="flex items-center gap-2">
          {['all', ...STAGES.map((s) => s.key)].map((key) => {
            const label = key === 'all' ? 'All Delivery States' : STAGES.find((s) => s.key === key).label;
            const count = key === 'all' ? counts.total : counts[key];
            const active = activeStage === key;
            return (
              <button key={key} onClick={() => { setActiveStage(key); setExpandedId(null); }}
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all border ${active ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
                {label} ({count})
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <input value={filters.status} onChange={(e) => setFilter('status', e.target.value)} placeholder="Status (e.g. APPROVED)" className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" />
          <input value={filters.outletName} onChange={(e) => setFilter('outletName', e.target.value)} placeholder="Outlet name" className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" />
          <input value={filters.deliveryBoyName} onChange={(e) => setFilter('deliveryBoyName', e.target.value)} placeholder="Delivery boy name" className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" />
          <select value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500">
            <option value="">All Channels</option>
            <option value="ENAMELS">Enamels Delivery Boy</option>
            <option value="SELF_DELIVERY">Self Delivery</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" title="Dispatched from" />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500" title="Dispatched to" />
        </div>
      </div>

      {/* Delivery cards grouped by stage */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm font-bold">
          <Loader2 size={18} className="animate-spin" /> Loading delivery history…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500 text-sm font-bold">No deliveries found for the selected filters.</div>
      ) : (
        <div className="space-y-3">
          {groupedByStage(filtered.length === deliveries.length ? deliveries : filtered).map((g) => (
            g.list.length > 0 && (
              <div key={g.label}>
                <div className="flex items-center gap-2 py-1">
                  <div className={`h-px flex-1 bg-${g.color}-500/30`} />
                  <span className={`text-[10px] font-black text-${g.color}-400 uppercase tracking-widest`}>{g.label} ({g.list.length})</span>
                  <div className={`h-px flex-1 bg-${g.color}-500/30`} />
                </div>
                {g.list.map((t) => <DeliveryCard key={t.id} task={t} expanded={expandedId === t.id} onToggle={() => setExpandedId((cur) => (cur === t.id ? null : t.id))} />)}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

const StatCard = ({ label, value, color, icon }) => (
  <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-3">
    <div className={`flex items-center gap-1.5 ${color}`}>
      {icon}
      <span className="text-2xl font-black leading-none">{value}</span>
    </div>
    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{label}</p>
  </div>
);

const DeliveryCard = ({ task, expanded, onToggle }) => {
  const accepted = !!task.deliveryBoyAcceptedAt;
  const delivered = !!task.deliveredAt;
  const completed = !!task.acceptedAt;
  const stageBadge = completed ? 'bg-purple-600 text-white' : delivered ? 'bg-emerald-600 text-white' : accepted ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white';
  const stageLabel = completed ? 'Completed' : delivered ? 'Delivered' : accepted ? 'In Transit' : 'Pending Pickup';

  return (
    <div className="bg-gray-800/40 rounded-xl border border-blue-500/20 overflow-hidden">
      <div className="px-3 py-2.5 bg-gray-900/60 border-b border-gray-700/50 flex items-center justify-between cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2 min-w-0">
          <Truck size={16} className={completed ? 'text-purple-400' : delivered ? 'text-emerald-400' : accepted ? 'text-amber-400' : 'text-blue-400'} />
          <span className="text-xs font-black text-white truncate">TRF-{task.transferNumber || task.id?.slice(0, 8)}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_CHANNEL[task.deliveryChannel] || 'bg-gray-600 text-white'}`}>
            {task.deliveryChannel || '—'}
          </span>
          {task.deliveryBoyName && (
            <span className="hidden md:flex items-center gap-1 text-[10px] font-bold text-blue-300">
              <UserCheck size={12} /> {task.deliveryBoyName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${stageBadge}`}>{stageLabel}</span>
          <span className="text-xs text-gray-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-400">Warehouse → Receiving Outlet</span>
            <span className="text-gray-200">{task.outletName || '—'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px] font-bold text-gray-500">
            <span className="flex items-center gap-1.5"><Clock size={12} /> Dispatched {task.dispatchedAt ? formatDateTime(task.dispatchedAt) : '—'}</span>
            {accepted && <span className="flex items-center gap-1.5 text-amber-400"><UserCheck size={12} /> Boy accepted {formatDateTime(task.deliveryBoyAcceptedAt)}</span>}
            {delivered && <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 size={12} /> Delivered {formatDateTime(task.deliveredAt)}</span>}
            {completed && <span className="flex items-center gap-1.5 text-purple-400"><FileText size={12} /> Outlet accepted {formatDateTime(task.acceptedAt)}</span>}
          </div>

          {task.items && task.items.length > 0 && (
            <div className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
              <div className="px-2.5 py-1.5 grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[9px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-700/50">
                <span>Product / Variant</span><span>Color</span><span>Size</span><span className="text-right">Units</span>
              </div>
              {task.items.map((it, i) => (
                <div key={i} className="px-2.5 py-1.5 grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[11px] font-bold text-gray-300 border-b border-gray-800/30 last:border-0">
                  <span className="truncate">{toUrduName(it.productName || '—')}</span>
                  <span className="text-gray-500">{toUrduName(it.color || '—')}</span>
                  <span className="text-gray-500">{toUrduName(it.size || '—')}</span>
                  <span className="text-right text-white">{it.units ?? '—'}</span>
                </div>
              ))}
              <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] font-black text-gray-400 border-t border-gray-700/50">
                <span>{task.productCount ?? 0} product(s)</span>
                <span>Total Units: <span className="text-white">{task.totalUnits ?? 0}</span></span>
              </div>
            </div>
          )}

          {task.notes && (
            <div className="px-2 py-1.5 bg-gray-900/40 rounded-lg border border-gray-700/40 text-[11px] font-medium text-gray-400">
              <span className="font-black text-gray-500 uppercase tracking-widest text-[9px]">Notes: </span>{task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};