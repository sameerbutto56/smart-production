import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import socket from '../socket';
import {
  Compass,
  MapPin,
  Building2,
  Layers,
  Calendar,
  Search,
  RefreshCw,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
  Filter,
  Navigation
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay } from './common/LoadingStates';

export default function AdminMarketingSection() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    activities: [],
    employees: [],
    activeEmployees: [],
    filterOptions: {
      areas: [],
      hospitals: [],
      companies: []
    }
  });

  // Filters
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [search, setSearch] = useState('');

  const fetchActivities = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (selectedEmployee) params.employeeId = selectedEmployee;
      if (date) params.date = date;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedArea) params.area = selectedArea;
      if (selectedHospital) params.hospital = selectedHospital;
      if (selectedCompany) params.company = selectedCompany;
      if (search) params.location = search;

      const res = await api.get('/api/marketing/admin/activities', { params });
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin marketing activities:', err);
      if (!silent) toast.error('Could not load marketing data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEmployee, date, dateFrom, dateTo, selectedArea, selectedHospital, selectedCompany, search]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Real-time synchronization: refresh immediately on location configuration save or new activity
  useEffect(() => {
    const handleLocationUpdate = () => {
      fetchActivities(true);
    };

    if (socket) {
      socket.on('marketing:location-updated', handleLocationUpdate);
      socket.on('marketing:new-activity', handleLocationUpdate);
    }
    window.addEventListener('marketing:location-updated', handleLocationUpdate);
    window.addEventListener('storage', handleLocationUpdate);

    // Regular background polling interval (every 15s) ensuring fresh data without manual refresh
    const pollInterval = setInterval(() => {
      fetchActivities(true);
    }, 15000);

    return () => {
      if (socket) {
        socket.off('marketing:location-updated', handleLocationUpdate);
        socket.off('marketing:new-activity', handleLocationUpdate);
      }
      window.removeEventListener('marketing:location-updated', handleLocationUpdate);
      window.removeEventListener('storage', handleLocationUpdate);
      clearInterval(pollInterval);
    };
  }, [fetchActivities]);

  const activities = data.activities || [];
  const employees = data.employees || [];
  const activeEmployees = data.activeEmployees || [];
  const filterOptions = data.filterOptions || {};

  // Resolve target employee item for map display
  // Prioritizes explicitly focused employee, then filter selection, then first active employee with coordinates
  const targetEmployeeItem = useMemo(() => {
    if (focusedEmployeeId) {
      const match = activeEmployees.find(ae => ae.employee?.id === focusedEmployeeId || ae.employee?.allIds?.includes(focusedEmployeeId));
      if (match?.location?.latitude && match?.location?.longitude) return match;
    }
    if (selectedEmployee) {
      const match = activeEmployees.find(ae => ae.employee?.id === selectedEmployee || ae.employee?.allIds?.includes(selectedEmployee));
      if (match?.location?.latitude && match?.location?.longitude) return match;
    }
    // Default to first active employee with coordinates (e.g. Junaid)
    const withCoords = activeEmployees.find(ae => ae.location?.latitude && ae.location?.longitude);
    if (withCoords) return withCoords;

    // Fallback: search in activities
    const act = activities.find(a => a.latitude && a.longitude);
    if (act) {
      return {
        employee: { id: 'fallback', name: act.employeeName || 'Marketing Staff' },
        location: {
          name: act.location,
          locationName: act.location,
          area: act.area,
          city: 'Lahore',
          hospitalName: act.hospitalName,
          companyName: act.companyName,
          address: act.notes,
          latitude: act.latitude,
          longitude: act.longitude,
          radius: 100,
          updatedAt: act.createdAt
        }
      };
    }
    return null;
  }, [focusedEmployeeId, selectedEmployee, activeEmployees, activities]);

  // 100-meter simulated movement logic around underlying configured coordinates (Section 6)
  const [movementOffset, setMovementOffset] = useState({ dLat: 0, dLng: 0 });

  useEffect(() => {
    if (!targetEmployeeItem) return;
    const baseLat = Number(targetEmployeeItem.location?.latitude || targetEmployeeItem.latestActivity?.latitude);
    if (!baseLat) return;

    // Generate gentle live drift within 100m radius every 12 seconds
    const interval = setInterval(() => {
      const angle = Math.random() * 2 * Math.PI;
      const distanceMeters = 15 + Math.random() * 60; // strictly inside 100m
      const dLat = (distanceMeters * Math.cos(angle)) / 111320;
      const dLng = (distanceMeters * Math.sin(angle)) / (111320 * Math.cos((baseLat * Math.PI) / 180));
      setMovementOffset({ dLat, dLng });
    }, 12000);

    return () => clearInterval(interval);
  }, [targetEmployeeItem?.location?.latitude, targetEmployeeItem?.location?.longitude]);

  const mapLat = useMemo(() => {
    const base = Number(targetEmployeeItem?.location?.latitude || targetEmployeeItem?.latestActivity?.latitude);
    if (!base) return null;
    return Number((base + (movementOffset.dLat || 0)).toFixed(6));
  }, [targetEmployeeItem, movementOffset.dLat]);

  const mapLng = useMemo(() => {
    const base = Number(targetEmployeeItem?.location?.longitude || targetEmployeeItem?.latestActivity?.longitude);
    if (!base) return null;
    return Number((base + (movementOffset.dLng || 0)).toFixed(6));
  }, [targetEmployeeItem, movementOffset.dLng]);

  const resetFilters = () => {
    setSelectedEmployee('');
    setFocusedEmployeeId('');
    setDate('');
    setDateFrom('');
    setDateTo('');
    setSelectedArea('');
    setSelectedHospital('');
    setSelectedCompany('');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Compass size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Marketing Field Operations & Supervision</h2>
            <p className="text-xs text-gray-400 font-bold">Track marketing employees, visits to hospitals & companies, and live locations</p>
          </div>
        </div>

        <button
          onClick={fetchActivities}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold transition-all border border-gray-700"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <SectionOverlay isUpdating={loading} updatingText="Updating marketing activities...">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Activities</p>
            <p className="text-2xl font-black text-white mt-1">{activities.length}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Logged visits in view</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Marketing Staff</p>
            <p className="text-2xl font-black text-cyan-400 mt-1">{employees.length}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Registered employees</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Covered Areas</p>
            <p className="text-2xl font-black text-purple-400 mt-1">{filterOptions.areas?.length || 0}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Distinct geographical regions</p>
          </div>
        </div>

        {/* Current Active Location per Marketing Employee */}
        {activeEmployees.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Users size={16} className="text-cyan-400" />
                <span>Active Marketing Personnel & Current Locations</span>
              </h3>
              <span className="text-[10px] text-gray-500 font-bold">
                Click any staff member to view on map
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeEmployees.map(({ employee, location, latestActivity }) => {
                const loc = location || latestActivity || {};
                const isFocused = (focusedEmployeeId && (employee.id === focusedEmployeeId || employee.allIds?.includes(focusedEmployeeId))) ||
                  (!focusedEmployeeId && (targetEmployeeItem?.employee?.id === employee.id || targetEmployeeItem?.employee?.allIds?.includes(employee.id)));
                return (
                  <div
                    key={employee.id}
                    onClick={() => {
                      setFocusedEmployeeId(employee.id);
                      setSelectedEmployee(employee.id);
                    }}
                    className={`p-3.5 rounded-xl bg-gray-950 border transition-all cursor-pointer space-y-2 hover:border-cyan-500/50 ${
                      isFocused
                        ? 'border-cyan-500 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                        : 'border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isFocused ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'}`} />
                        <span className="text-xs font-black text-white">{employee.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
                        {loc.time || ''} {loc.date ? `(${loc.date})` : ''}
                      </span>
                    </div>

                    <div className="text-xs">
                      <span className="text-cyan-400 font-bold">{loc.area || loc.city || 'Lahore'}</span>
                      <span className="text-gray-400"> • {loc.locationName || loc.name || loc.location}</span>
                    </div>

                    {(loc.hospitalName || loc.companyName) && (
                      <div className="text-[11px] text-gray-300 font-medium">
                        {loc.hospitalName && <span>🏥 {loc.hospitalName} </span>}
                        {loc.companyName && <span>🏢 {loc.companyName}</span>}
                      </div>
                    )}

                    {loc.address && (
                      <p className="text-[11px] text-gray-400 truncate">
                        {loc.address}
                      </p>
                    )}

                    {loc.latitude && loc.longitude && (
                      <div className="pt-1 flex items-center justify-between text-[11px] border-t border-gray-900">
                        <span className="text-gray-500 font-mono text-[10px]">
                          {Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-cyan-400 hover:underline flex items-center gap-1 font-bold text-[10px]"
                        >
                          Google Maps <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Map and Filters Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters Form */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Filter size={14} className="text-cyan-400" /> Filter Activities
              </span>
              <button onClick={resetFilters} className="text-[10px] text-cyan-400 hover:underline font-bold">
                Reset All
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Marketing Employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.outletName ? `(${e.outletName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Specific Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Area
                </label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Areas</option>
                  {(filterOptions.areas || []).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Hospital
                </label>
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Hospitals</option>
                  {(filterOptions.hospitals || []).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Company
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Companies</option>
                  {(filterOptions.companies || []).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Search Location / Address
              </label>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Street, building, notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-1.5 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-gray-800 gap-2">
              <div className="flex items-center gap-2">
                <Navigation size={14} className="text-cyan-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {targetEmployeeItem ? `${targetEmployeeItem.employee.name} • Location Map` : 'Location Map'}
                </span>
                {targetEmployeeItem?.location?.name && (
                  <span className="text-[11px] font-bold text-cyan-400/90 hidden sm:inline">
                    ({targetEmployeeItem.location.name})
                  </span>
                )}
              </div>

              {mapLat && mapLng && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-cyan-400">
                    {mapLat}, {mapLng}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden bg-gray-950 border border-gray-800 relative">
              {mapLat && mapLng ? (
                <iframe
                  key={`${mapLat}-${mapLng}`}
                  title="Admin Marketing Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  className="w-full h-full min-h-[300px]"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.015}%2C${mapLat - 0.015}%2C${mapLng + 0.015}%2C${mapLat + 0.015}&layer=mapnik&marker=${mapLat}%2C${mapLng}`}
                />
              ) : (
                <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center text-gray-500">
                  <MapPin size={36} className="text-gray-700 mb-2" />
                  <p className="text-xs font-bold text-gray-400">No active coordinates available</p>
                </div>
              )}
            </div>

            {targetEmployeeItem?.location && (
              <div className="mt-3 p-3 rounded-xl bg-gray-950 border border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-cyan-400 shrink-0" />
                  <span className="font-bold text-white">
                    {targetEmployeeItem.location.name || targetEmployeeItem.location.locationName || 'Marketing Location'}
                  </span>
                  <span className="text-cyan-400 font-bold">• {targetEmployeeItem.location.area || 'Lahore'}</span>
                  {targetEmployeeItem.location.city && (
                    <span className="text-gray-400">({targetEmployeeItem.location.city})</span>
                  )}
                  {targetEmployeeItem.location.hospitalName && (
                    <span className="text-blue-300 font-bold">🏥 {targetEmployeeItem.location.hospitalName}</span>
                  )}
                  {targetEmployeeItem.location.companyName && (
                    <span className="text-purple-300 font-bold">🏢 {targetEmployeeItem.location.companyName}</span>
                  )}
                </div>

                {targetEmployeeItem.location.address && (
                  <p className="text-[11px] text-gray-400 w-full truncate">
                    {targetEmployeeItem.location.address}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full Activity Records Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Activity History Log ({activities.length} entries)
            </h3>
            <span className="text-[10px] font-bold text-gray-500">Chronological list</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Employee</th>
                  <th className="pb-3 px-3">Date & Time</th>
                  <th className="pb-3 px-3">Area & Location</th>
                  <th className="pb-3 px-3">Hospital / Company</th>
                  <th className="pb-3 px-3">Notes</th>
                  <th className="pb-3 px-3">Map Pin</th>
                  <th className="pb-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-medium">
                {activities.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500 font-bold">
                      No marketing visits match the current filters.
                    </td>
                  </tr>
                ) : (
                  activities.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{a.employeeName}</div>
                        <div className="text-[10px] text-gray-500">{a.user?.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{a.date}</div>
                        <div className="text-[10px] text-gray-400">{a.time}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-cyan-300">{a.area}</div>
                        <div className="text-[10px] text-gray-400">{a.location}</div>
                      </td>
                      <td className="py-3 px-3">
                        {a.hospitalName && <div className="text-blue-400 font-bold">🏥 {a.hospitalName}</div>}
                        {a.companyName && <div className="text-purple-400 font-bold">🏢 {a.companyName}</div>}
                        {!a.hospitalName && !a.companyName && <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-gray-400">
                        {a.notes || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {a.latitude && a.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-bold text-xs"
                          >
                            <span>Map Pin</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionOverlay>
    </div>
  );
}
