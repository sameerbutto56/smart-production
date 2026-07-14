import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  TrendingUp, DollarSign, Package, Layers, ShoppingCart, Store,
  Truck, Archive, AlertTriangle, BarChart3, PieChart, Activity,
  Filter, CalendarDays, Loader2, X, FileText, Printer, MapPin, Building2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

const LOCATIONS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];
const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6', '#f97316'];
const LOCATION_COLORS = { 'Johar Town': '#6366f1', 'Jail Road': '#f59e0b', 'Abbottabad': '#22c55e' };
const fmt = (v) => `₨${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtNum = (v) => (v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const KpiCard = ({ label, value, icon: Icon, color, prefix, sub, onClick }) => (
  <div onClick={onClick} className={`glass rounded-2xl p-4 md:p-5 border border-gray-800 hover:border-gray-700 transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}>
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] md:text-xs font-black text-gray-500 uppercase tracking-widest">{label}</p>
      <div className={`p-2 rounded-xl ${color}`}><Icon size={14} className="text-white" /></div>
    </div>
    <p className="text-lg md:text-2xl font-black text-white truncate">{prefix || ''}{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value || 0}</p>
    {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
  </div>
);

const LocationCard = ({ location, inventory, consumption, financial }) => {
  const color = LOCATION_COLORS[location] || '#6366f1';
  return (
    <div className="rounded-2xl border border-gray-700/50 overflow-hidden" style={{ borderColor: `${color}44` }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: `${color}15` }}>
        <MapPin size={14} style={{ color }} />
        <span className="text-sm font-black text-white uppercase tracking-wider">{location}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-gray-800/40 rounded-xl p-2.5">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Inventory Value</p>
          <p className="text-sm font-black text-white">{fmt(inventory?.value)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-2.5">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Inventory Qty</p>
          <p className="text-sm font-black text-white">{fmtNum(inventory?.quantity)}</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-2.5">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Consumption</p>
          <p className="text-sm font-black text-purple-400">{fmt(consumption?.consumption)}</p>
          <p className="text-[9px] text-gray-500">{fmtNum(consumption?.orders)} orders</p>
        </div>
        <div className="bg-gray-800/40 rounded-xl p-2.5">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Revenue</p>
          <p className="text-sm font-black text-emerald-400">{fmt(financial?.revenue)}</p>
          <p className="text-[9px] text-gray-500">{fmtNum(financial?.orders)} orders</p>
        </div>
      </div>
    </div>
  );
};

const outletForSource = (sourceId) => {
  if (sourceId === 'jail_road') return 'Johar Town';
  if (sourceId === 'johar_town') return 'Johar Town';
  if (sourceId === 'abbottabad') return 'Abbottabad';
  if (sourceId === 'online') return null;
  return null;
};

const sourceToBranch = (sourceId) => {
  if (sourceId === 'jail_road') return 'Jail Road';
  if (sourceId === 'johar_town') return 'Johar Town';
  if (sourceId === 'abbottabad') return 'Abbottabad';
  return null;
};

const BiSection = ({ source: parentSource, startDate: parentStartDate, endDate: parentEndDate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [source, setSource] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const printRef = useRef(null);

  // When parent provides source/date, use those instead of internal state
  const effectiveSource = (parentSource && parentSource !== 'all' && parentSource !== 'online') ? 'OUTLET' : (source === 'all' ? 'all' : source);
  const effectiveBranch = parentSource ? sourceToBranch(parentSource) : branchFilter;
  const hasParentProps = parentSource !== undefined;

  const fetchData = useCallback(async (preset, from, to, src, branch, parentSrc, parentSd, parentEd) => {
    setLoading(true);
    try {
      const params = {};
      if (parentSd || parentEd) {
        if (parentSd) params.startDate = new Date(parentSd).toISOString();
        if (parentEd) params.endDate = new Date(parentEd + 'T23:59:59.999Z').toISOString();
      } else {
        const now = new Date();
        if (preset === 'today') {
          params.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        } else if (preset === 'week') {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          params.startDate = start.toISOString();
        } else if (preset === 'month') {
          params.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        } else if (preset === 'year') {
          params.startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        } else if (preset === 'custom' && from) {
          params.startDate = new Date(from).toISOString();
          if (to) params.endDate = new Date(to).toISOString();
        }
      }
      if (src && src !== 'all') params.source = src;
      // Map parent source to BI branch parameter
      const pb = sourceToBranch(parentSrc);
      if (pb) params.branch = pb;
      else if (branch && branch !== 'all') params.branch = branch;
      const res = await api.get('/api/bi/dashboard', { params });
      setData(res.data);
    } catch (err) {
      console.error('BI fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasParentProps) {
      fetchData(datePreset, customFrom, customTo, effectiveSource, effectiveBranch, parentSource, parentStartDate, parentEndDate);
    } else {
      fetchData(datePreset, customFrom, customTo, source, branchFilter, null, null, null);
    }
  }, [datePreset, source, branchFilter, effectiveSource, effectiveBranch, parentSource, parentStartDate, parentEndDate, fetchData, hasParentProps]);

  const applyCustom = () => fetchData('custom', customFrom, customTo, source, branchFilter, parentSource, parentStartDate, parentEndDate);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Business Intelligence Report</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#333}h2{color:#6366f1}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{padding:8px 12px;text-align:left;border:1px solid #ddd}
      th{background:#f0f0f0}.section{margin:20px 0}
      .kpi-grid{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
      .kpi-item{background:#f9f9f9;padding:12px;border-radius:8px;flex:1;min-width:150px}
      .kpi-label{font-size:11px;color:#666;text-transform:uppercase}
      .kpi-value{font-size:18px;font-weight:bold;color:#111}
    </style></head><body>`);
    w.document.write('<h1>Business Intelligence Report</h1>');
    w.document.write(`<p>Period: ${datePreset} | Source: ${source} | Branch: ${branchFilter}</p>`);
    w.document.write(`<p>Generated: ${new Date().toLocaleString()}</p>`);
    if (data) {
      const { inventoryValuation: iv, perLocationInventory, consumption: cons, allocationAnalytics, demandAnalytics, profitAnalytics: pa, perLocationFinancials } = data;
      w.document.write('<div class="section"><h2>Overall Inventory</h2><div class="kpi-grid">');
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Total Value</div><div class="kpi-value">₨${(iv?.totalValue||0).toLocaleString()}</div></div>`);
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Total Quantity</div><div class="kpi-value">${(iv?.totalQuantity||0).toLocaleString()}</div></div>`);
      w.document.write('</div></div>');
      if (perLocationInventory) {
        w.document.write('<div class="section"><h2>Per-Location Inventory</h2>');
        LOCATIONS.forEach(loc => {
          const inv = perLocationInventory[loc];
          if (inv) {
            w.document.write(`<h3>${loc}</h3><div class="kpi-grid">`);
            w.document.write(`<div class="kpi-item"><div class="kpi-label">Value</div><div class="kpi-value">₨${(inv.value||0).toLocaleString()}</div></div>`);
            w.document.write(`<div class="kpi-item"><div class="kpi-label">Quantity</div><div class="kpi-value">${(inv.quantity||0).toLocaleString()}</div></div>`);
            w.document.write('</div>');
          }
        });
        w.document.write('</div>');
      }
      if (perLocationFinancials) {
        w.document.write('<div class="section"><h2>Financial by Location</h2><table><tr><th>Location</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr>');
        LOCATIONS.forEach(loc => {
          const f = perLocationFinancials[loc];
          if (f) w.document.write(`<tr><td>${loc}</td><td>₨${(f.revenue||0).toLocaleString()}</td><td>₨${(f.cost||0).toLocaleString()}</td><td>₨${(f.profit||0).toLocaleString()}</td></tr>`);
        });
        w.document.write('</table></div>');
      }
      w.document.write(`<div class="section"><h2>Profit Summary</h2><div class="kpi-grid">`);
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Total Revenue</div><div class="kpi-value">₨${(pa?.totalRevenue||0).toLocaleString()}</div></div>`);
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Total Cost</div><div class="kpi-value">₨${(pa?.totalCost||0).toLocaleString()}</div></div>`);
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Gross Profit</div><div class="kpi-value">₨${(pa?.grossProfit||0).toLocaleString()}</div></div>`);
      w.document.write(`<div class="kpi-item"><div class="kpi-label">Margin</div><div class="kpi-value">${(pa?.profitMargin||0).toFixed(1)}%</div></div>`);
      w.document.write('</div></div>');
    }
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const handleDownloadCSV = () => {
    if (!data) return;
    const rows = [['Metric', 'Value']];
    const { inventoryValuation: iv, perLocationInventory, consumption: cons, allocationAnalytics, demandAnalytics, profitAnalytics: pa, perLocationFinancials } = data;
    rows.push(['Total Inventory Value', iv?.totalValue || 0]);
    rows.push(['Total Inventory Quantity', iv?.totalQuantity || 0]);
    rows.push(['']);
    rows.push(['--- Per-Location Inventory ---', '']);
    LOCATIONS.forEach(loc => {
      const inv = perLocationInventory?.[loc];
      if (inv) { rows.push([`${loc} - Value`, inv.value || 0]); rows.push([`${loc} - Quantity`, inv.quantity || 0]); }
    });
    rows.push(['']);
    rows.push(['--- Per-Location Financials ---', '']);
    LOCATIONS.forEach(loc => {
      const f = perLocationFinancials?.[loc];
      if (f) { rows.push([`${loc} - Revenue`, f.revenue || 0]); rows.push([`${loc} - Cost`, f.cost || 0]); rows.push([`${loc} - Profit`, f.profit || 0]); }
    });
    rows.push(['']);
    rows.push(['Total Revenue', pa?.totalRevenue || 0]);
    rows.push(['Total Cost', pa?.totalCost || 0]);
    rows.push(['Gross Profit', pa?.grossProfit || 0]);
    rows.push(['Profit Margin %', pa?.profitMargin || 0]);
    rows.push(['Allocation Quantity', allocationAnalytics?.totalQuantity || 0]);
    rows.push(['Demand Quantity', demandAnalytics?.totalQuantity || 0]);
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bi_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={36} /></div>;
  }

  const { inventoryValuation, perLocationInventory, consumption, remainingValue, profitAnalytics, charts, perLocationFinancials, perLocationCharts, allocationAnalytics, demandAnalytics } = data || {};
  const iv = inventoryValuation || {};
  const cons = consumption || {};
  const pa = profitAnalytics || {};
  const ch = charts || {};

  return (
    <section className="space-y-6" ref={printRef}>
      {/* Header with Print/Download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl"><BarChart3 className="text-blue-400" size={20} /></div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Business Intelligence</h2>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Inventory valuation, consumption &amp; profit analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <>
              <button onClick={handleDownloadCSV} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"><FileText size={14} /> CSV</button>
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg"><Printer size={14} /> Print</button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {!parentStartDate && (
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.key} onClick={() => setDatePreset(p.key)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${datePreset === p.key ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>{p.label}</button>
          ))}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
              <span className="text-gray-600 text-xs">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 text-xs font-bold text-white outline-none focus:border-blue-500" />
              <button onClick={applyCustom} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-500 transition-all">Apply</button>
            </div>
          )}
        </div>
      )}

      {!parentSource && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider mr-1">Source:</span>
          {[{ value: 'all', label: 'All Sources' }, { value: 'ONLINE', label: 'Online Orders' }, { value: 'OUTLET', label: 'Outlet Orders' }].map(s => (
            <button key={s.value} onClick={() => setSource(s.value)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${source === s.value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>{s.label}</button>
          ))}
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider ml-2 mr-1">Branch:</span>
          <button onClick={() => setBranchFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${branchFilter === 'all' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>All</button>
          {LOCATIONS.map(loc => (
            <button key={loc} onClick={() => setBranchFilter(branchFilter === loc ? 'all' : loc)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${branchFilter === loc ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-900 text-gray-500 hover:text-gray-300'}`}>{loc}</button>
          ))}
        </div>
      )}

      {/* Overall KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Inventory Value" value={iv.totalValue} icon={DollarSign} color="bg-emerald-600" prefix="₨" />
        <KpiCard label="Total Inventory Qty" value={iv.totalQuantity} icon={Package} color="bg-blue-600" />
        <KpiCard label="Total Consumed Value" value={cons.totalConsumed?.value} icon={BarChart3} color="bg-rose-600" prefix="₨" />
        <KpiCard label="Remaining Inventory" value={remainingValue} icon={Activity} color="bg-teal-600" prefix="₨" />
      </div>

      {/* Per-Location Inventory Cards */}
      {perLocationInventory && (
        <div>
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Building2 size={14} /> Per-Location Inventory &amp; Consumption
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LOCATIONS.map(loc => (
              <LocationCard key={loc} location={loc}
                inventory={perLocationInventory[loc]}
                consumption={cons.perLocationConsumption?.[loc]}
                financial={perLocationFinancials?.[loc]} />
            ))}
          </div>
        </div>
      )}

      {/* Consumption Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Online Consumed" value={cons.onlineOrders?.value} icon={ShoppingCart} color="bg-indigo-600" prefix="₨" sub={`${fmtNum(cons.onlineOrders?.quantity)} units`} />
        <KpiCard label="Outlet Consumed" value={cons.outletOrders?.value} icon={Store} color="bg-purple-600" prefix="₨" sub={`${fmtNum(cons.outletOrders?.quantity)} units`} />
        <KpiCard label="Allocation Consumed" value={cons.allocation?.value} icon={Archive} color="bg-amber-600" prefix="₨" sub={`${fmtNum(allocationAnalytics?.totalQuantity)} allocated`} />
        <KpiCard label="Demand Consumed" value={cons.demandOrders?.value} icon={Truck} color="bg-orange-600" prefix="₨" sub={`${fmtNum(demandAnalytics?.totalQuantity)} demanded`} />
      </div>

      {/* Allocation Analytics */}
      {allocationAnalytics && (
        <div className="glass rounded-2xl p-4 md:p-5 border border-gray-800">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Archive size={14} /> Allocation Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Allocated</p>
              <p className="text-lg font-black text-white">{fmtNum(allocationAnalytics.totalQuantity)} units</p>
              <p className="text-[10px] text-gray-500">{fmt(allocationAnalytics.totalValue)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Pending</p>
              <p className="text-lg font-black text-yellow-400">{fmtNum(allocationAnalytics.byStatus?.PENDING)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Approved / Completed</p>
              <p className="text-lg font-black text-emerald-400">{fmtNum((allocationAnalytics.byStatus?.APPROVED||0)+(allocationAnalytics.byStatus?.COMPLETED||0))}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Rejected</p>
              <p className="text-lg font-black text-red-400">{fmtNum(allocationAnalytics.byStatus?.REJECTED||0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Demand Analytics */}
      {demandAnalytics && (
        <div className="glass rounded-2xl p-4 md:p-5 border border-gray-800">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Truck size={14} /> Demand Analytics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Demanded</p>
              <p className="text-lg font-black text-white">{fmtNum(demandAnalytics.totalQuantity)} units</p>
              <p className="text-[10px] text-gray-500">{fmt(demandAnalytics.totalValue)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Pending Requests</p>
              <p className="text-lg font-black text-yellow-400">{fmtNum(demandAnalytics.byStatus?.PENDING)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Approved</p>
              <p className="text-lg font-black text-blue-400">{fmtNum(demandAnalytics.byStatus?.APPROVED)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Completed</p>
              <p className="text-lg font-black text-emerald-400">{fmtNum(demandAnalytics.byStatus?.COMPLETED)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Rejected</p>
              <p className="text-lg font-black text-red-400">{fmtNum(demandAnalytics.byStatus?.REJECTED)}</p>
            </div>
          </div>
          {demandAnalytics.byLocation && Object.keys(demandAnalytics.byLocation).length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">By Location</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(demandAnalytics.byLocation).map(([loc, qty]) => (
                  <span key={loc} className="text-[10px] font-bold bg-gray-800/60 px-2.5 py-1 rounded-lg border border-gray-700/30">
                    {loc}: <span className="text-emerald-400">{fmtNum(qty)} units</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profit Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={pa.totalRevenue} icon={TrendingUp} color="bg-emerald-600" prefix="₨" />
        <KpiCard label="Total Cost" value={pa.totalCost} icon={DollarSign} color="bg-red-600" prefix="₨" />
        <KpiCard label="Gross Profit" value={pa.grossProfit} icon={Activity} color="bg-blue-600" prefix="₨" />
        <KpiCard label="Profit Margin" value={pa.profitMargin ? pa.profitMargin.toFixed(2) + '%' : '0%'} icon={PieChart} color="bg-violet-600" />
      </div>

      {/* Per-Location Financials */}
      {perLocationFinancials && (
        <div className="glass rounded-2xl p-4 md:p-5 border border-gray-800">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <DollarSign size={14} /> Per-Location Financial Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="font-black text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4 text-right">Revenue</th>
                  <th className="py-2 pr-4 text-right">Cost</th>
                  <th className="py-2 pr-4 text-right">Profit</th>
                  <th className="py-2 pr-4 text-right">Orders</th>
                  <th className="py-2 pr-4 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {LOCATIONS.map(loc => {
                  const f = perLocationFinancials[loc] || {};
                  const margin = f.revenue > 0 ? ((f.profit / f.revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={loc} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 font-bold text-white">{loc}</td>
                      <td className="py-2 pr-4 text-right font-bold text-emerald-400">{fmt(f.revenue)}</td>
                      <td className="py-2 pr-4 text-right font-bold text-red-400">{fmt(f.cost)}</td>
                      <td className="py-2 pr-4 text-right font-bold text-blue-400">{fmt(f.profit)}</td>
                      <td className="py-2 pr-4 text-right font-bold text-white">{fmtNum(f.orders)}</td>
                      <td className="py-2 pr-4 text-right font-bold text-violet-400">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      {(ch.inventoryDistribution?.length > 0 || ch.revenueSources?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ch.inventoryDistribution?.length > 0 && (
            <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <BarChart3 size={14} /> Inventory Distribution by Category {branchFilter !== 'all' && `(${branchFilter})`}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={branchFilter !== 'all' && perLocationCharts?.inventoryDistribution?.[branchFilter] ? perLocationCharts.inventoryDistribution[branchFilter] : ch.inventoryDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {ch.revenueSources?.length > 0 && (
            <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <PieChart size={14} /> Revenue Sources {branchFilter !== 'all' && `(${branchFilter})`}
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie data={ch.revenueSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {ch.revenueSources.map((_, idx) => (<Cell key={idx} fill={COLORS[idx % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Profit Trend */}
      {ch.profitTrend?.length > 0 && (
        <div className="glass rounded-2xl p-4 md:p-6 border border-gray-800">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} /> Profit Trend {branchFilter !== 'all' && `(${branchFilter})`}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ch.profitTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#fff' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-16">
          <BarChart3 className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-500 font-bold">No data available</p>
        </div>
      )}
    </section>
  );
};

export default BiSection;
