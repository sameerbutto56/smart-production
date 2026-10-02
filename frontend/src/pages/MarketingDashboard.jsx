import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime } from '../utils/dateTime';
import {
  MapPin,
  Building2,
  Navigation,
  Clock,
  Calendar,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText,
  Compass,
  Crosshair,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay, FilterLoadingBadge } from '../components/common/LoadingStates';
import { useSystemControl, FeatureGate } from '../context/SystemControlContext';

export default function MarketingDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasPermission } = useSystemControl();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {
      todayDate: '',
      todayCount: 0,
      visitedAreasCount: 0,
      visitedAreas: [],
      visitedHospitalsCount: 0,
      visitedHospitals: [],
      visitedCompaniesCount: 0,
      visitedCompanies: [],
      latestLocation: null
    },
    todayActivities: [],
    history: []
  });

  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);

  // New visit form state
  const [area, setArea] = useState('');
  const [locationName, setLocationName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('COMPLETED');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [configuredLocations, setConfiguredLocations] = useState([]);

  // Fetch marketing activities
  const fetchMyActivities = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/marketing/my-activities';
      const params = {};
      if (filterDate) params.date = filterDate;
      const res = await api.get(url, { params });
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load marketing activities:', err);
      toast.error('Could not load marketing activities');
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  // Load configured locations for quick selection
  const fetchConfiguredLocations = useCallback(async () => {
    try {
      const res = await api.get('/api/marketing/locations');
      if (res.data?.locations) {
        setConfiguredLocations(res.data.locations.filter(l => l.isActive !== false));
      }
    } catch (e) {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchMyActivities();
    fetchConfiguredLocations();
  }, [fetchMyActivities, fetchConfiguredLocations]);

  // Capture GPS using HTML5 Geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success('Live GPS coordinates acquired');
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Could not acquire GPS: ' + (err.message || 'Permission denied'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Quick fill from configured location
  const handleSelectConfigured = (locId) => {
    const found = configuredLocations.find(l => l.id === locId);
    if (!found) return;
    setArea(found.area || '');
    setLocationName(found.name || '');
    if (found.hospitalName) setHospitalName(found.hospitalName);
    if (found.companyName) setCompanyName(found.companyName);
    if (found.latitude) setLatitude(found.latitude);
    if (found.longitude) setLongitude(found.longitude);
  };

  // Submit new visit activity
  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (!area.trim() && !locationName.trim()) {
      toast.error('Please enter an area or location name');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        area: area.trim(),
        location: locationName.trim(),
        hospitalName: hospitalName.trim() || null,
        companyName: companyName.trim() || null,
        notes: notes.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        status,
        source: latitude && longitude ? 'GPS' : 'MANUAL'
      };

      await api.post('/api/marketing/activities', payload);
      toast.success('Marketing visit recorded successfully');
      setShowLogModal(false);
      // Reset form
      setArea('');
      setLocationName('');
      setHospitalName('');
      setCompanyName('');
      setNotes('');
      setLatitude('');
      setLongitude('');
      setStatus('COMPLETED');
      // Refresh
      fetchMyActivities();
    } catch (err) {
      console.error('Failed to record activity:', err);
      toast.error(err.response?.data?.message || 'Failed to record activity');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    const list = data.history || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(item =>
      (item.area && item.area.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.hospitalName && item.hospitalName.toLowerCase().includes(q)) ||
      (item.companyName && item.companyName.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  }, [data.history, search]);

  const summary = data.summary || {};
  const latestLoc = summary.latestLocation;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
            <Compass size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Marketing Portal</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Field Operations
              </span>
            </div>
            <p className="text-xs text-gray-400 font-bold mt-0.5">
              Logged in as <span className="text-white font-extrabold">{user?.name}</span> ({user?.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={fetchMyActivities}
            disabled={loading}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700 active:scale-95"
            title="Refresh activities"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>

          <FeatureGate feature="MARKETING_LOCATION_ENTRY">
            <button
              onClick={() => setShowLogModal(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-900/40 active:scale-95"
            >
              <Plus size={16} />
              <span>Log New Visit</span>
            </button>
          </FeatureGate>
        </div>
      </div>

      <SectionOverlay isUpdating={loading} updatingText="Synchronizing marketing activities...">
        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today Visits */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Today's Visits</p>
                <p className="text-2xl md:text-3xl font-black text-white mt-1">{summary.todayCount || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Activities logged today</p>
              </div>
              <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>

          {/* Card 2: Visited Areas */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Areas Covered</p>
                <p className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">{summary.visitedAreasCount || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Distinct zones visited</p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                <MapPin size={20} />
              </div>
            </div>
          </div>

          {/* Card 3: Visited Hospitals */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Hospitals Visited</p>
                <p className="text-2xl md:text-3xl font-black text-blue-400 mt-1">{summary.visitedHospitalsCount || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Medical institutions</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                <Building2 size={20} />
              </div>
            </div>
          </div>

          {/* Card 4: Visited Companies */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Companies / Orgs</p>
                <p className="text-2xl md:text-3xl font-black text-purple-400 mt-1">{summary.visitedCompaniesCount || 0}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Corporate clients</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                <Layers size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Latest Active Location & Map Spotlight */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest Location Details */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Current / Latest Location</span>
                </div>
                {latestLoc && (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
                    {latestLoc.time}
                  </span>
                )}
              </div>

              {latestLoc ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Area</p>
                    <p className="text-lg font-black text-white mt-0.5">{latestLoc.area}</p>
                    <p className="text-xs text-gray-300 font-medium">{latestLoc.location}</p>
                  </div>

                  {(latestLoc.hospitalName || latestLoc.companyName) && (
                    <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                      {latestLoc.hospitalName && (
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-blue-400 shrink-0" />
                          <span className="text-xs font-bold text-gray-200">Hospital: {latestLoc.hospitalName}</span>
                        </div>
                      )}
                      {latestLoc.companyName && (
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-purple-400 shrink-0" />
                          <span className="text-xs font-bold text-gray-200">Company: {latestLoc.companyName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {latestLoc.latitude && latestLoc.longitude && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs">
                      <div className="flex items-center gap-2 text-cyan-300 font-mono">
                        <Navigation size={14} />
                        <span>{latestLoc.latitude.toFixed(4)}, {latestLoc.longitude.toFixed(4)}</span>
                      </div>
                      <a
                        href={`https://www.google.com/maps?q=${latestLoc.latitude},${latestLoc.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 text-[11px]"
                      >
                        Google Maps <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 space-y-2">
                  <MapPin size={36} className="mx-auto text-gray-600 opacity-60" />
                  <p className="text-xs font-bold">No location recorded yet</p>
                  <p className="text-[10px] text-gray-600">Click "Log New Visit" to record your first activity today</p>
                </div>
              )}
            </div>

            {latestLoc && (
              <div className="mt-6 pt-3 border-t border-gray-800 text-[11px] text-gray-500 flex justify-between items-center">
                <span>Recorded on {latestLoc.date}</span>
                <span className="text-emerald-400 font-bold uppercase tracking-wider">Status: {latestLoc.status}</span>
              </div>
            )}
          </div>

          {/* Interactive Map Spotlight */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Compass size={16} className="text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Visual Map View</h3>
              </div>
              <span className="text-[10px] font-bold text-gray-500">
                {latestLoc?.latitude ? 'Live Coordinates Center' : 'Lahore Operational Region'}
              </span>
            </div>

            <div className="flex-1 min-h-[260px] rounded-xl overflow-hidden bg-gray-950 border border-gray-800 relative">
              {latestLoc?.latitude && latestLoc?.longitude ? (
                <iframe
                  title="Marketing Location Map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  className="w-full h-full min-h-[260px]"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${latestLoc.longitude - 0.01}%2C${latestLoc.latitude - 0.01}%2C${latestLoc.longitude + 0.01}%2C${latestLoc.latitude + 0.01}&layer=mapnik&marker=${latestLoc.latitude}%2C${latestLoc.longitude}`}
                />
              ) : (
                <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 text-center text-gray-500">
                  <MapPin size={40} className="text-gray-700 mb-2" />
                  <p className="text-xs font-bold text-gray-400">Map coordinates pending</p>
                  <p className="text-[11px] text-gray-600 mt-1 max-w-sm">
                    When you log visits with GPS, your active location pin will render automatically on OpenStreetMap.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Activities Timeline (Must Never Overwrite Previous Records) */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Today's Visits ({data.todayActivities?.length || 0})</h3>
              <p className="text-[11px] text-gray-400 font-bold">Every visit logged remains intact and historical</p>
            </div>
            <span className="text-xs font-bold text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-800/40">
              {summary.todayDate || 'Today'}
            </span>
          </div>

          {data.todayActivities?.length === 0 ? (
            <div className="py-10 text-center text-gray-500 space-y-1">
              <Clock size={32} className="mx-auto text-gray-600 mb-2 opacity-50" />
              <p className="text-xs font-bold">No activities recorded today yet</p>
              <p className="text-[11px] text-gray-600">Click "Log New Visit" to record your first visit today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.todayActivities.map((act, idx) => (
                <div
                  key={act.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gray-950 border border-gray-800/80 hover:border-gray-700 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                      #{data.todayActivities.length - idx}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-white">{act.area}</span>
                        <span className="text-xs text-gray-400 font-semibold">• {act.location}</span>
                        {act.hospitalName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-900/40 text-blue-300 border border-blue-700/40">
                            🏥 {act.hospitalName}
                          </span>
                        )}
                        {act.companyName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/40 text-purple-300 border border-purple-700/40">
                            🏢 {act.companyName}
                          </span>
                        )}
                      </div>
                      {act.notes && (
                        <p className="text-xs text-gray-400 mt-1 italic bg-gray-900/80 p-2 rounded-lg border border-gray-800">
                          "{act.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:text-right shrink-0">
                    <div>
                      <p className="text-xs font-black text-cyan-400">{act.time}</p>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        {act.status}
                      </span>
                    </div>
                    {act.latitude && act.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${act.latitude},${act.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all"
                        title="View pin on map"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity History Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">All Marketing History</h3>
              <p className="text-[11px] text-gray-400 font-bold">Search and inspect your past activities</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search area, hospital, company..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl py-1.5 pl-9 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />

              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-xs text-cyan-400 hover:underline font-bold"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="pb-3 px-3">Date & Time</th>
                  <th className="pb-3 px-3">Area & Location</th>
                  <th className="pb-3 px-3">Hospital / Company</th>
                  <th className="pb-3 px-3">Notes</th>
                  <th className="pb-3 px-3">Coordinates</th>
                  <th className="pb-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-medium">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500 font-bold">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{h.date}</div>
                        <div className="text-[10px] text-gray-500 font-bold">{h.time}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{h.area}</div>
                        <div className="text-[10px] text-gray-400">{h.location}</div>
                      </td>
                      <td className="py-3 px-3">
                        {h.hospitalName && (
                          <div className="text-blue-400 font-bold">🏥 {h.hospitalName}</div>
                        )}
                        {h.companyName && (
                          <div className="text-purple-400 font-bold">🏢 {h.companyName}</div>
                        )}
                        {!h.hospitalName && !h.companyName && (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-gray-400">
                        {h.notes || '—'}
                      </td>
                      <td className="py-3 px-3">
                        {h.latitude && h.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            <MapPin size={12} />
                            <span>{h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</span>
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {h.status || 'COMPLETED'}
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

      {/* Log Visit Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Record Marketing Visit</h3>
                  <p className="text-[10px] text-gray-400 font-bold">Log client meeting, hospital visit, or field inspection</p>
                </div>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-gray-500 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="space-y-4">
              {configuredLocations.length > 0 && (
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Quick Fill from Operational Location
                  </label>
                  <select
                    onChange={(e) => handleSelectConfigured(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose standard location (optional) --</option>
                    {configuredLocations.map(cl => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name} ({cl.area}{cl.hospitalName ? ` - ${cl.hospitalName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Area *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johar Town, Gulberg, Model Town"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Specific Location / Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Boulevard, Phase 2"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Hospital Name (if applicable)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shaukat Khanum, Doctors Hospital"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Company / Organization (if applicable)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Beaconhouse, Gourmet, MCB"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Coordinates & GPS auto-detect */}
              <div className="p-3 bg-gray-950 rounded-2xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                    GPS Coordinates
                  </span>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Crosshair size={13} className={gpsLoading ? 'animate-spin' : ''} />
                    <span>{gpsLoading ? 'Acquiring GPS...' : 'Acquire Live GPS'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Latitude (e.g. 31.4697)"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Longitude (e.g. 74.2728)"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                  Activity Notes & Discussion Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about the meeting, client requirements, uniforms needed, follow-up..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Save Activity</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
