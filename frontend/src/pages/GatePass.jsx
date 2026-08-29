import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  Calendar, Package, CheckCircle2, XCircle, Clock,
  RefreshCcw, Printer, ChevronLeft, ChevronRight,
  Truck, FileText, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { toUrduName } from '../utils/urduDictionary';

const today = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const GatePass = () => {
  const [selectedDate, setSelectedDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const printRef = useRef(null);

  const fetchSheet = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await api.get('/api/gate-pass', { params: { date } });
      setData(res.data);
    } catch (e) {
      console.error('Gate Pass error:', e);
      toast.error(e.response?.data?.message || 'Failed to load Gate Pass');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableDates = useCallback(async (month) => {
    try {
      const res = await api.get('/api/gate-pass/available-dates', { params: { month } });
      setAvailableDates(res.data.dates || []);
    } catch (e) {
      console.error('Available dates error:', e);
    }
  }, []);

  useEffect(() => {
    fetchSheet(selectedDate);
  }, [selectedDate, fetchSheet]);

  useEffect(() => {
    const month = selectedDate.slice(0, 7);
    fetchAvailableDates(month);
  }, [selectedDate, fetchAvailableDates]);

  const goToPrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => setSelectedDate(today());

  const isToday = selectedDate === today();
  const hasRecords = availableDates.includes(selectedDate);

  const computeUnits = (a) => {
    const rawPd = typeof a.productDetails === 'string' ? JSON.parse(a.productDetails || '[]') : (Array.isArray(a.productDetails) ? a.productDetails : (a.productDetails && typeof a.productDetails === 'object' ? [a.productDetails] : []));
    return rawPd.reduce((sum, entry) => {
      const p = entry?.productDetails || entry || {};
      return sum + (entry.quantity || p.quantity || 1);
    }, 0);
  };

  const assignments = (data?.assignments || []).filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.orderNumber || '').toLowerCase().includes(q) ||
      (a.customerName || '').toLowerCase().includes(q) ||
      (a.customerPhone || '').includes(q) ||
      (a.address || '').toLowerCase().includes(q)
    );
  });

  const summary = data?.summary || { total: 0, totalUnits: 0, orderUnits: 0, demandUnits: 0, transferUnits: 0, delivered: 0, pending: 0, returned: 0, carryForward: 0, todayAssigned: 0, todayDemands: 0, todayTransfers: 0 };

  const searchMatches = (s, fields) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return fields.some(f => (s[f] || '').toLowerCase().includes(q))
      || (Array.isArray(s.items) && s.items.some(it => (it.productName || '').toLowerCase().includes(q)));
  };
  const demands = (data?.demands || []).filter(d => searchMatches(d, ['transferNumber', 'outletName']));
  const transfers = (data?.transfers || []).filter(t => searchMatches(t, ['transferNumber', 'fromOutlet', 'toOutlet']));

  const orderUnits = assignments.reduce((s, a) => s + computeUnits(a), 0);
  const demandUnits = demands.reduce((s, d) => s + (d.units || 0), 0);
  const transferUnits = transfers.reduce((s, t) => s + (t.units || 0), 0);
  const totalUnits = orderUnits + demandUnits + transferUnits;

  const todayOrders = assignments.filter(a => a.isToday);
  const carryForwardOrders = assignments.filter(a => !a.isToday);

  const renderOrderRow = (a, i, type) => {
    const rawPd = typeof a.productDetails === 'string' ? JSON.parse(a.productDetails || '[]') : (Array.isArray(a.productDetails) ? a.productDetails : (a.productDetails && typeof a.productDetails === 'object' ? [a.productDetails] : []));
    const prodList = rawPd.map(entry => {
      const p = entry?.productDetails || entry || {};
      return {
        name: p.name || p.productName || p.productType || entry.name || entry.productName || entry.productType || 'Item',
        color: p.color || entry.color,
        size: p.size || entry.size,
        qty: entry.quantity || p.quantity || 1,
      };
    });
    const statusLabel = a.delivered ? 'DELIVERED' : a.returned ? 'RETURNED' : 'PENDING';
    const statusColor = a.delivered ? 'emerald' : a.returned ? 'red' : 'amber';
    const assignedDateStr = a.assignedDate || today();
    const assignedDateFormatted = new Date(assignedDateStr + 'T00:00:00.000Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const rowBg = type === 'carryForward' ? 'bg-amber-50/50' : '';
    return (
      <tr key={a.id || i} className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
        <td className="px-4 py-3 text-gray-500">{i + 1}</td>
        <td className="px-4 py-3 font-bold text-gray-900">{a.orderNumber || '-'}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-800">{a.customerName || '-'}</div>
        </td>
        <td className="px-4 py-3 text-gray-600">{a.customerPhone || '-'}</td>
        <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px]">
          {a.address || '-'}{a.city ? `, ${a.city}` : ''}
        </td>
        <td className="px-4 py-3 max-w-[250px]">
          {prodList.length > 0 ? prodList.map((p, pi) => (
            <div key={pi} className="text-xs leading-relaxed">
              <span className="font-medium">{p.name}</span>
              {p.color && <span className="text-gray-500"> — {p.color}</span>}
              {p.size && <span className="text-gray-400"> ({p.size})</span>}
              {p.qty > 1 && <span className="text-gray-400"> x{p.qty}</span>}
            </div>
          )) : <span className="text-gray-400">-</span>}
        </td>
        <td className="px-4 py-3 text-center font-semibold text-gray-700">{computeUnits(a)}</td>
        <td className="px-4 py-3 text-xs whitespace-nowrap">
          {type === 'carryForward' ? (
            <div>
              <span className="text-amber-600 font-semibold">Carry Forward</span>
              <span className="text-gray-400 ml-1">· {assignedDateFormatted}</span>
            </div>
          ) : (
            <span className="text-gray-500">
              {a.assignedAt ? new Date(a.assignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
            </span>
          )}
        </td>
      </tr>
    );
  };

  const printSheet = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=800,height=1000');
    win.document.write('<html><head><title>Gate Pass - ' + selectedDate + '</title>');
    win.document.write('<style>');
    win.document.write('body { font-family: Arial, sans-serif; margin: 20px; color: #111; }');
    win.document.write('.header { text-align: center; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 16px; }');
    win.document.write('.header h1 { margin: 0; font-size: 22px; color: #1e40af; }');
    win.document.write('.header h2 { margin: 4px 0 0; font-size: 14px; color: #444; }');
    win.document.write('.meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; color: #555; }');
    win.document.write('.stats { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }');
    win.document.write('.stat { flex: 1; min-width: 120px; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; }');
    win.document.write('.stat .label { font-size: 11px; color: #666; }');
    win.document.write('.stat .value { font-size: 18px; font-weight: bold; color: #111; }');
    win.document.write('table { width: 100%; border-collapse: collapse; font-size: 11px; }');
    win.document.write('th { background: #1e40af; color: #fff; padding: 6px 8px; text-align: left; font-weight: 600; }');
    win.document.write('td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }');
    win.document.write('tr:nth-child(even) { background: #f9fafb; }');
    win.document.write('.status-delivered { color: #16a34a; font-weight: bold; }');
    win.document.write('.status-pending { color: #d97706; font-weight: bold; }');
    win.document.write('.status-returned { color: #dc2626; font-weight: bold; }');
    win.document.write('.footer { margin-top: 20px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }');
    win.document.write('.signature { margin-top: 40px; display: flex; justify-content: space-between; }');
    win.document.write('.sig-line { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 12px; }');
    win.document.write('</style></head><body>');
    win.document.write(el.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const renderCalendar = () => {
    const [y, m] = selectedDate.split('-').map(Number);
    const firstDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dateStr);
    }
    return (
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center font-semibold text-gray-500 py-1">{d}</div>
        ))}
        {cells.map((dateStr, i) => (
          <button
            key={i}
            disabled={!dateStr}
            onClick={() => dateStr && setSelectedDate(dateStr)}
            className={`py-1.5 rounded text-center transition-all ${
              !dateStr ? '' :
              dateStr === selectedDate ? 'bg-blue-600 text-white font-bold' :
              availableDates.includes(dateStr) ? 'bg-emerald-100 text-emerald-700 font-semibold hover:bg-emerald-200 cursor-pointer' :
              'text-gray-600 hover:bg-gray-100 cursor-pointer'
            }`}
          >
            {dateStr ? new Date(dateStr + 'T00:00:00.000Z').getUTCDate() : ''}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print-only content */}
      <div ref={printRef} className="hidden print:block">
        <div className="header">
          <h1>ENAMELS — Gate Pass</h1>
          <h2>Date: {selectedDate}</h2>
        </div>
        <div className="meta">
          <span>Total Orders: {summary.total} | Total Units: {totalUnits} (Transfers: {transferUnits}, Demands: {demandUnits})</span>
          <span>Generated: {new Date().toLocaleString()}</span>
        </div>
        <div className="stats">
          <div className="stat"><div className="label">Total</div><div className="value">{summary.total}</div></div>
          <div className="stat"><div className="label">Total Units</div><div className="value">{totalUnits}</div></div>
          <div className="stat"><div className="label">Transfer Units</div><div className="value">{transferUnits}</div></div>
          <div className="stat"><div className="label">Demand Units</div><div className="value">{demandUnits}</div></div>
          <div className="stat"><div className="label">Delivered</div><div className="value">{summary.delivered}</div></div>
          <div className="stat"><div className="label">Pending</div><div className="value">{summary.pending}</div></div>
          <div className="stat"><div className="label">Returned</div><div className="value">{summary.returned}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order #</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Products (Qty)</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => {
              const rawPd = typeof a.productDetails === 'string' ? JSON.parse(a.productDetails || '[]') : (Array.isArray(a.productDetails) ? a.productDetails : (a.productDetails && typeof a.productDetails === 'object' ? [a.productDetails] : []));
              const prodNames = rawPd.map(entry => {
                const p = entry?.productDetails || entry || {};
                const name = p.name || p.productName || p.productType || entry.name || entry.productName || entry.productType || 'Item';
                const color = p.color || entry.color;
                const size = p.size || entry.size;
                const qty = entry.quantity || p.quantity || 1;
                return `${name}${color ? ' — ' + color : ''}${size ? ' (' + size + ')' : ''}${qty > 1 ? ' x' + qty : ''}`;
              }).join(', ') || '-';
              const unitsForPrint = rawPd.reduce((sum, entry) => {
                const p = entry?.productDetails || entry || {};
                return sum + (entry.quantity || p.quantity || 1);
              }, 0);
              return (
                <tr key={a.id || i}>
                  <td>{i + 1}</td>
                  <td><strong>{a.orderNumber || '-'}</strong></td>
                  <td>{a.customerName || '-'}</td>
                  <td>{a.customerPhone || '-'}</td>
                  <td>{(a.address || '') + (a.city ? ', ' + a.city : '')}</td>
                  <td style={{ maxWidth: 250, fontSize: 10 }}>{prodNames}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{unitsForPrint}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {transfers.length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 6px', fontSize: 14, color: '#1e40af' }}>Outlet Transfers (NBD Dispatch) — {transfers.length}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Transfer #</th>
                  <th>From → To</th>
                  <th>Products (Qty)</th>
                  <th>Units</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => {
                  const items = Array.isArray(t.items) ? t.items : [];
                  const prodNames = items.map(it => {
                    const name = it.productName || it.name || 'Item';
                    const color = it.color || '';
                    const size = it.size || '';
                    const qty = it.approvedQty ?? it.quantity ?? 1;
                    return `${name}${color ? ' — ' + color : ''}${size ? ' (' + size + ')' : ''}${qty > 1 ? ' x' + qty : ''}`;
                  }).join(', ') || '-';
                  return (
                    <tr key={t.id || i}>
                      <td>{i + 1}</td>
                      <td><strong>{t.transferNumber || '-'}</strong></td>
                      <td>{(t.fromOutlet || '-') + ' → ' + (t.toOutlet || '-')}</td>
                      <td style={{ maxWidth: 260, fontSize: 10 }}>{prodNames}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{t.units}</td>
                      <td><span className="status-pending">{t.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {demands.length > 0 && (
          <>
            <h3 style={{ margin: '14px 0 6px', fontSize: 14, color: '#1e40af' }}>Enamels Boy Demands (In Transit) — {demands.length}</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Demand #</th>
                  <th>Outlet</th>
                  <th>Products (Qty)</th>
                  <th>Units</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demands.map((d, i) => {
                  const items = Array.isArray(d.items) ? d.items : [];
                  const prodNames = items.map(it => {
                    const name = it.productName || it.name || 'Item';
                    const color = it.color || '';
                    const size = it.size || '';
                    const qty = it.approvedQty ?? it.quantity ?? 1;
                    return `${name}${color ? ' — ' + color : ''}${size ? ' (' + size + ')' : ''}${qty > 1 ? ' x' + qty : ''}`;
                  }).join(', ') || '-';
                  return (
                    <tr key={d.id || i}>
                      <td>{i + 1}</td>
                      <td><strong>{d.transferNumber || '-'}</strong></td>
                      <td>{d.outletName || '-'}</td>
                      <td style={{ maxWidth: 260, fontSize: 10 }}>{prodNames}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{d.units}</td>
                      <td><span className="status-pending">{d.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        <div className="footer">
          Printed from ENAMELS Smart Production — Gate Pass &bull; {selectedDate}
        </div>
        <div className="signature">
          <div className="sig-line">Delivery Boy Signature</div>
          <div className="sig-line">Supervisor Signature</div>
        </div>
      </div>

      {/* Screen UI */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Truck className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gate Pass</h1>
              <p className="text-sm text-gray-500">Delivery Assignment Record</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSheet(selectedDate)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={printSheet}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Printer className="w-4 h-4" /> Print Gate Pass
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar — Date picker + calendar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={goToPrevDay} className="p-1 rounded hover:bg-gray-100">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <div className="font-bold text-gray-900">{new Date(selectedDate + 'T00:00:00.000Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</div>
                  {hasRecords && (
                    <span className="text-xs text-emerald-600 font-medium">Has Records</span>
                  )}
                </div>
                <button onClick={goToNextDay} className="p-1 rounded hover:bg-gray-100">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                {!isToday && (
                  <button
                    onClick={goToToday}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                {new Date(selectedDate + 'T00:00:00.000Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              {renderCalendar()}
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                Days with records
                <span className="inline-block w-3 h-3 rounded bg-blue-600 ml-2"></span>
                Selected
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Right — Stats + Orders */}
          <div className="lg:col-span-3 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-500">Loading Gate Pass...</span>
              </div>
            ) : !data || (assignments.length === 0 && demands.length === 0 && transfers.length === 0) ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Assignments</h3>
                <p className="text-gray-500 text-sm">
                  {hasRecords
                    ? `Records exist for ${selectedDate} but don't match the current filter.`
                    : `No orders were assigned on ${selectedDate}.`
                  }
                </p>
                <p className="text-gray-400 text-xs mt-2">Orders appear here only after being routed to Enamels Delivery Boy.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3">
                  <StatCard icon={<Package className="w-5 h-5" />} label="Total" value={summary.total} color="blue" />
                  <StatCard icon={<Package className="w-5 h-5" />} label="Total Units" value={totalUnits} color="violet" />
                  <StatCard icon={<Truck className="w-5 h-5" />} label="Transfers" value={transfers.length} color="blue" />
                  <StatCard icon={<FileText className="w-5 h-5" />} label="Demands" value={demands.length} color="teal" />
                  <StatCard icon={<Clock className="w-5 h-5" />} label="Today Assigned" value={summary.todayAssigned} color="indigo" />
                  <StatCard icon={<Truck className="w-5 h-5" />} label="Carry Forward" value={summary.carryForward} color="amber" />
                  <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Delivered" value={summary.delivered} color="emerald" />
                  <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={summary.pending} color="orange" />
                  <StatCard icon={<XCircle className="w-5 h-5" />} label="Returned" value={summary.returned} color="red" />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      Orders ({assignments.length})
                      {summary.carryForward > 0 && (
                        <span className="ml-2 text-xs font-normal text-amber-600">({summary.carryForward} carry-forward)</span>
                      )}
                    </h3>
                    <span className="text-xs text-gray-500">Viewing: {new Date(selectedDate + 'T00:00:00.000Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          <th className="px-4 py-2.5">#</th>
                          <th className="px-4 py-2.5">Order #</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Phone</th>
                          <th className="px-4 py-2.5">Address</th>
                          <th className="px-4 py-2.5">Products</th>
                          <th className="px-4 py-2.5 text-center">Units</th>
                          <th className="px-4 py-2.5">Assigned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {todayOrders.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-2 bg-indigo-50 text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                              Today's Assigned ({todayOrders.length})
                            </td>
                          </tr>
                        )}
                        {todayOrders.map((a, i) => renderOrderRow(a, i, 'today'))}

                        {carryForwardOrders.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-2 bg-amber-50 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                              Carry Forward — Pending from Previous Days ({carryForwardOrders.length})
                            </td>
                          </tr>
                        )}
                        {carryForwardOrders.map((a, i) => renderOrderRow(a, i + todayOrders.length, 'carryForward'))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {transfers.length > 0 && (
                  <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                      <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Outlet Transfers (NBD Dispatch) ({transfers.length})
                      </h3>
                      <span className="text-xs text-blue-600 font-medium">{transferUnits} units</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50 text-left text-xs font-semibold text-blue-700 uppercase tracking-wide">
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Transfer #</th>
                            <th className="px-4 py-2.5">From → To</th>
                            <th className="px-4 py-2.5">Products</th>
                            <th className="px-4 py-2.5">Delivery Boy</th>
                            <th className="px-4 py-2.5">Dispatch</th>
                            <th className="px-4 py-2.5 text-center">Units</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {transfers.map((t, i) => {
                            const tItems = Array.isArray(t.items) ? t.items : [];
                            return (
                              <tr key={t.id || i}>
                                <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                                <td className="px-4 py-2.5 font-bold text-gray-900">{t.transferNumber || '-'}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{(t.fromOutlet || '-') + ' → ' + (t.toOutlet || '-')}</td>
                                <td className="px-4 py-2.5">
                                  <div className="max-w-[260px] text-xs space-y-0.5">
                                    {tItems.map((it, ti) => {
                                      const iname = it.productName || it.name || 'Item';
                                      const icolor = it.color || '';
                                      const isize = it.size || '';
                                      const iqty = it.approvedQty ?? it.quantity ?? 1;
                                      return (
                                        <div key={ti}>
                                          <span className="font-medium text-gray-700">{toUrduName(iname)}</span>
                                          {icolor && <span className="text-gray-500"> — {toUrduName(icolor)}</span>}
                                          {isize && <span className="text-gray-400"> ({toUrduName(isize)})</span>}
                                          {iqty > 1 && <span className="text-gray-400"> ×{iqty}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{t.deliveryBoyName || 'NBD Rider'}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{t.dispatchedAt ? new Date(t.dispatchedAt).toLocaleString() : '-'}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-blue-700">{t.units}</td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                    {t.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {demands.length > 0 && (
                  <div className="bg-white rounded-xl border border-teal-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-teal-100 flex items-center justify-between">
                      <h3 className="font-semibold text-teal-800 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Enamels Boy Demands (In Transit) ({demands.length})
                      </h3>
                      <span className="text-xs text-teal-600 font-medium">{demandUnits} units</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-teal-50 text-left text-xs font-semibold text-teal-700 uppercase tracking-wide">
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Demand #</th>
                            <th className="px-4 py-2.5">Outlet</th>
                            <th className="px-4 py-2.5">Products</th>
                            <th className="px-4 py-2.5">Delivery Boy</th>
                            <th className="px-4 py-2.5">Dispatch</th>
                            <th className="px-4 py-2.5 text-center">Units</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-teal-50">
                          {demands.map((d, i) => {
                            const dItems = Array.isArray(d.items) ? d.items : [];
                            return (
                              <tr key={d.id || i}>
                                <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                                <td className="px-4 py-2.5 font-bold text-gray-900">{d.transferNumber || '-'}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{d.outletName || '-'}</td>
                                <td className="px-4 py-2.5">
                                  <div className="max-w-[260px] text-xs space-y-0.5">
                                    {dItems.map((it, ti) => {
                                      const iname = it.productName || it.name || 'Item';
                                      const icolor = it.color || '';
                                      const isize = it.size || '';
                                      const iqty = it.approvedQty ?? it.quantity ?? 1;
                                      return (
                                        <div key={ti}>
                                          <span className="font-medium text-gray-700">{toUrduName(iname)}</span>
                                          {icolor && <span className="text-gray-500"> — {toUrduName(icolor)}</span>}
                                          {isize && <span className="text-gray-400"> ({toUrduName(isize)})</span>}
                                          {iqty > 1 && <span className="text-gray-400"> ×{iqty}</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{d.deliveryBoyName || 'Enamels Delivery'}</td>
                                <td className="px-4 py-2.5 text-xs text-gray-600">{d.dispatchedAt ? new Date(d.dispatchedAt).toLocaleString() : '-'}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-teal-700">{d.units}</td>
                                <td className="px-4 py-2.5">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-teal-700">
                                    {d.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => (
  <div className={`bg-white rounded-xl border border-gray-200 p-3 text-center`}>
    <div className={`text-${color}-500 mb-1 flex justify-center`}>{icon}</div>
    <div className="text-xs text-gray-500 mb-0.5">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
  </div>
);

export default GatePass;
