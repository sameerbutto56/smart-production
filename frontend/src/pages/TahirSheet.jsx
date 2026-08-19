import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar, Package, CheckCircle2, XCircle, Clock, MapPin,
  Phone, User, RefreshCcw, Printer, ChevronLeft, ChevronRight,
  Truck, IndianRupee, FileText, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateOnly } from '../utils/dateTime';
import { toUrduName } from '../utils/urduDictionary';

const fmtCurrency = (n) => `PKR ${(n || 0).toLocaleString()}`;

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const today = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const TahirSheet = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);

  const [selectedDate, setSelectedDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const printRef = useRef(null);

  const fetchSheet = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await api.get('/api/tahir-sheet', { params: { date, deliveryBoy: 'Tahir' } });
      setData(res.data);
    } catch (e) {
      console.error('Tahir Sheet error:', e);
      toast.error(e.response?.data?.message || 'Failed to load Tahir Sheet');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableDates = useCallback(async (month) => {
    try {
      const res = await api.get('/api/tahir-sheet/available-dates', { params: { deliveryBoy: 'Tahir', month } });
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => setSelectedDate(today());

  const isToday = selectedDate === today();
  const hasRecords = availableDates.includes(selectedDate);

  // Client-side filter
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

  const summary = data?.summary || { total: 0, delivered: 0, pending: 0, returned: 0, totalOrderValue: 0, totalAdvance: 0, totalDeliveryCharges: 0 };

  const printSheet = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=800,height=1000');
    win.document.write('<html><head><title>Tahir Sheet - ' + selectedDate + '</title>');
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

  // Calendar mini-grid for current month
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
            {dateStr ? new Date(dateStr + 'T00:00:00').getUTCDate() : ''}
          </button>
        ))}
      </div>
    );
  };

  if (!outletName.toLowerCase().includes('johar')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Access Restricted</h2>
          <p className="text-gray-500">Tahir Sheet is only available for Johar Town Outlet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print-only content */}
      <div ref={printRef} className="hidden print:block">
        <div className="header">
          <h1>ENAMELS — Daily Delivery Sheet</h1>
          <h2>Delivery Boy: {data?.deliveryBoy || 'Tahir'} &bull; Date: {selectedDate}</h2>
        </div>
        <div className="meta">
          <span>Outlet: {outletName}</span>
          <span>Total Orders: {summary.total}</span>
          <span>Generated: {new Date().toLocaleString()}</span>
        </div>
        <div className="stats">
          <div className="stat"><div className="label">Total</div><div className="value">{summary.total}</div></div>
          <div className="stat"><div className="label">Delivered</div><div className="value">{summary.delivered}</div></div>
          <div className="stat"><div className="label">Pending</div><div className="value">{summary.pending}</div></div>
          <div className="stat"><div className="label">Returned</div><div className="value">{summary.returned}</div></div>
          <div className="stat"><div className="label">Total Value</div><div className="value">{fmtCurrency(summary.totalOrderValue)}</div></div>
          <div className="stat"><div className="label">Advance</div><div className="value">{fmtCurrency(summary.totalAdvance)}</div></div>
          <div className="stat"><div className="label">Delivery Charges</div><div className="value">{fmtCurrency(summary.totalDeliveryCharges)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order #</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Address</th>
              <th>Products</th>
              <th>Total</th>
              <th>Advance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => {
              const pd = typeof a.productDetails === 'string' ? JSON.parse(a.productDetails || '[]') : (Array.isArray(a.productDetails) ? a.productDetails : []);
              const prodNames = pd.map(p => (p.name || p.productName || p.productType || 'Item') + (p.quantity > 1 ? ` x${p.quantity}` : '')).join(', ') || '-';
              return (
                <tr key={a.id || i}>
                  <td>{i + 1}</td>
                  <td><strong>{a.orderNumber || '-'}</strong></td>
                  <td>{a.customerName || '-'}</td>
                  <td>{a.customerPhone || '-'}</td>
                  <td>{(a.address || '') + (a.city ? ', ' + a.city : '')}</td>
                  <td style={{ maxWidth: 200, fontSize: 10 }}>{prodNames}</td>
                  <td>{fmtCurrency(a.totalPrice)}</td>
                  <td>{fmtCurrency(a.advanceAmount)}</td>
                  <td className={a.delivered ? 'status-delivered' : a.returned ? 'status-returned' : 'status-pending'}>
                    {a.delivered ? 'DELIVERED' : a.returned ? 'RETURNED' : 'PENDING'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="footer">
          Printed from ENAMELS Smart Production — {outletName} &bull; {selectedDate}
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
              <h1 className="text-2xl font-bold text-gray-900">Daily Tahir Sheet</h1>
              <p className="text-sm text-gray-500">{outletName} — Delivery Assignment Record</p>
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
              <Printer className="w-4 h-4" /> Print Sheet
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar — Date picker + calendar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Date navigation */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <button onClick={goToPrevDay} className="p-1 rounded hover:bg-gray-100">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <div className="font-bold text-gray-900">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</div>
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

            {/* Mini calendar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              {renderCalendar()}
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                Days with records
                <span className="inline-block w-3 h-3 rounded bg-blue-600 ml-2"></span>
                Selected
              </div>
            </div>

            {/* Search */}
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
                <span className="ml-3 text-gray-500">Loading sheet...</span>
              </div>
            ) : !data || assignments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Assignments</h3>
                <p className="text-gray-500 text-sm">
                  {hasRecords
                    ? `Records exist for ${selectedDate} but don't match the current filter.`
                    : `No orders were assigned to Tahir on ${selectedDate}.`
                  }
                </p>
                <p className="text-gray-400 text-xs mt-2">Orders appear here only after being routed to Enamels Delivery Boy.</p>
              </div>
            ) : (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <StatCard icon={<Package className="w-5 h-5" />} label="Total" value={summary.total} color="blue" />
                  <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Delivered" value={summary.delivered} color="emerald" />
                  <StatCard icon={<Clock className="w-5 h-5" />} label="Pending" value={summary.pending} color="amber" />
                  <StatCard icon={<XCircle className="w-5 h-5" />} label="Returned" value={summary.returned} color="red" />
                  <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Total Value" value={fmtCurrency(summary.totalOrderValue)} color="purple" />
                  <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Advance" value={fmtCurrency(summary.totalAdvance)} color="indigo" />
                  <StatCard icon={<Truck className="w-5 h-5" />} label="Del. Charges" value={fmtCurrency(summary.totalDeliveryCharges)} color="cyan" />
                </div>

                {/* Order list */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">
                      Orders Assigned ({assignments.length})
                    </h3>
                    <span className="text-xs text-gray-500">Assigned on {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
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
                          <th className="px-4 py-2.5 text-right">Total</th>
                          <th className="px-4 py-2.5 text-right">Advance</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Assigned At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {assignments.map((a, i) => {
                          const pd = typeof a.productDetails === 'string' ? JSON.parse(a.productDetails || '[]') : (Array.isArray(a.productDetails) ? a.productDetails : []);
                          const prodList = pd.map(p => ({
                            name: p.name || p.productName || p.productType || 'Item',
                            color: p.color,
                            size: p.size,
                            qty: p.quantity || 1,
                          }));
                          const statusLabel = a.delivered ? 'DELIVERED' : a.returned ? 'RETURNED' : 'PENDING';
                          const statusColor = a.delivered ? 'emerald' : a.returned ? 'red' : 'amber';
                          return (
                            <tr key={a.id || i} className="hover:bg-gray-50 transition-colors">
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
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtCurrency(a.totalPrice)}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{fmtCurrency(a.advanceAmount)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-${statusColor}-100 text-${statusColor}-700`}>
                                  {a.delivered && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                  {a.returned && <XCircle className="w-3 h-3 mr-1" />}
                                  {!a.delivered && !a.returned && <Clock className="w-3 h-3 mr-1" />}
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                {a.assignedAt ? new Date(a.assignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
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

export default TahirSheet;
