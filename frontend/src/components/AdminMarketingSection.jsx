import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
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
  const [date, setDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [search, setSearch] = useState('');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
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
      toast.error('Could not load marketing data');
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, date, dateFrom, dateTo, selectedArea, selectedHospital, selectedCompany, search]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const activities = data.activities || [];
  const employees = data.employees || [];
  const activeEmployees = data.activeEmployees || [];
  const filterOptions = data.filterOptions || {};

  // Find latest coordinate for map center
  const latestActivityWithCoords = useMemo(() => {
    return activities.find(a => a.latitude && a.longitude);
  }, [activities]);

  const resetFilters = () => {
    setSelectedEmployee('');
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Hospitals Visited</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{filterOptions.hospitals?.length || 0}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Distinct medical sites</p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Companies Covered</p>
            <p className="text-2xl font-black text-purple-400 mt-1">{filterOptions.companies?.length || 0}</p>
            <p className="text-[10px] text-gray-500 font-bold mt-1">Corporate clients</p>
          </div>
        </div>

        {/* Current Active Location per Marketing Employee */}
        {activeEmployees.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-3 flex items-center gap-2">
              <Users size={16} className="text-cyan-400" />
              <span>Active Marketing Personnel & Latest Visited Points</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeEmployees.map(({ employee, latestActivity }) => (
                <div key={employee.id} className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">{employee.name}</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-900 px-2 py-0.5 rounded">
                      {latestActivity.time} ({latestActivity.date})
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-cyan-400 font-bold">{latestActivity.area}</span>
                    <span className="text-gray-400"> • {latestActivity.location}</span>
                  </div>
                  {(latestActivity.hospitalName || latestActivity.companyName) && (
                    <div className="text-[11px] text-gray-300 font-medium">
                      {latestActivity.hospitalName && <span>🏥 {latestActivity.hospitalName} </span>}
                      {latestActivity.companyName && <span>🏢 {latestActivity.companyName}</span>}
                    </div>
                  )}
                  {latestActivity.latitude && latestActivity.longitude && (
                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-mono">
                        {latestActivity.latitude.toFixed(4)}, {latestActivity.longitude.toFixed(4)}
                      </span>
                      <a
                        href={`https://www.google.com/maps?q=${latestActivity.latitude},${latestActivity.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        Map <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              ))}
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
                  <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
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
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
              <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                <Navigation size={14} className="text-cyan-400" /> Location Map
              </span>
              {latestActivityWithCoords && (
                <span className="text-[10px] font-mono text-cyan-400">
                  {latestActivityWithCoords.latitude?.toFixed(4)}, {latestActivityWithCoords.longitude?.toFixed(4)}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-[260px] rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
              {latestActivityWithCoords ? (
                <iframe
                  title="Admin Marketing Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  className="w-full h-full min-h-[260px]"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${latestActivityWithCoords.longitude - 0.02}%2C${latestActivityWithCoords.latitude - 0.02}%2C${latestActivityWithCoords.longitude + 0.02}%2C${latestActivityWithCoords.latitude + 0.02}&layer=mapnik&marker=${latestActivityWithCoords.latitude}%2C${latestActivityWithCoords.longitude}`}
                />
              ) : (
                <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 text-center text-gray-500">
                  <MapPin size={36} className="text-gray-700 mb-2" />
                  <p className="text-xs font-bold text-gray-400">No GPS coordinates in current filter</p>
                </div>
              )}
            </div>
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
                  <th className="pb-3 px-3">Source & GPS</th>
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
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-700/40">
                              {a.source}
                            </span>
                            <a
                              href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline font-mono text-[11px]"
                            >
                              Pin <ExternalLink size={10} className="inline ml-0.5" />
                            </a>
                          </div>
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
