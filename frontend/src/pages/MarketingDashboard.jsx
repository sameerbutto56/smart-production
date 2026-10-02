import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
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
  AlertCircle,
  UserCheck,
  User,
  Lock,
  LogOut,
  ArrowRightLeft,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay } from '../components/common/LoadingStates';
import { useSystemControl, FeatureGate } from '../context/SystemControlContext';

export default function MarketingDashboard() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { hasPermission } = useSystemControl();

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'SOFTWARE_SETTINGS';
  const [adminSelectedEmployee, setAdminSelectedEmployee] = useState('');

  // Active Marketing Employee session state
  const [activeEmployee, setActiveEmployee] = useState(() => {
    try {
      const saved = sessionStorage.getItem('activeMarketingEmployee');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Employee selection & authentication state
  const [marketingEmployees, setMarketingEmployees] = useState([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [selectedEmpForAuth, setSelectedEmpForAuth] = useState(null);
  const [empPassword, setEmpPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Active tab within the Marketing shell
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'activities' | 'add' | 'map' | 'history'

  const [loading, setLoading] = useState(false);
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

  // Visit form state
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

  // Fetch employees assigned to Marketing
  const fetchMarketingEmployees = useCallback(async () => {
    setFetchingEmployees(true);
    try {
      const res = await api.get('/api/marketing/employees');
      if (res.data?.employees) {
        setMarketingEmployees(res.data.employees);
      }
    } catch (err) {
      console.error('Failed to load marketing employees:', err);
      toast.error('Could not load marketing employees list');
    } finally {
      setFetchingEmployees(false);
    }
  }, []);

  // Fetch marketing activities for active employee or admin supervision
  const fetchMyActivities = useCallback(async () => {
    if (!activeEmployee && user?.role === 'MARKETING') return;
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      const headers = {};
      if (isAdmin) {
        if (adminSelectedEmployee) {
          params.employeeId = adminSelectedEmployee;
        }
      } else if (activeEmployee?.id) {
        headers['x-marketing-employee-id'] = activeEmployee.id;
      }
      const res = await api.get('/api/marketing/my-activities', { params, headers });
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load marketing activities:', err);
      toast.error('Could not load marketing activities');
    } finally {
      setLoading(false);
    }
  }, [activeEmployee, filterDate, user?.role, isAdmin, adminSelectedEmployee]);

  // Load configured reference locations
  const fetchConfiguredLocations = useCallback(async () => {
    try {
      const res = await api.get('/api/marketing/locations');
      if (res.data?.locations) {
        setConfiguredLocations(res.data.locations.filter(l => l.isActive !== false));
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    if ((user?.role === 'MARKETING' && !activeEmployee) || isAdmin) {
      fetchMarketingEmployees();
    }
  }, [user?.role, activeEmployee, isAdmin, fetchMarketingEmployees]);

  useEffect(() => {
    if (activeEmployee || user?.role !== 'MARKETING') {
      fetchMyActivities();
      fetchConfiguredLocations();
    }
  }, [activeEmployee, user?.role, fetchMyActivities, fetchConfiguredLocations]);

  // Authenticate selected marketing employee
  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    if (!selectedEmpForAuth) return;
    if (!empPassword.trim()) {
      setAuthError('Please enter password');
      return;
    }

    setAuthenticating(true);
    setAuthError('');
    try {
      const res = await api.post('/api/marketing/employee-login', {
        employeeId: selectedEmpForAuth.id,
        password: empPassword.trim()
      });

      if (res.data?.success && res.data?.employee) {
        const emp = res.data.employee;
        sessionStorage.setItem('activeMarketingEmployee', JSON.stringify(emp));
        setActiveEmployee(emp);
        setSelectedEmpForAuth(null);
        setEmpPassword('');
        toast.success(`Welcome, ${emp.name}!`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid employee password';
      setAuthError(msg);
      toast.error(msg);
    } finally {
      setAuthenticating(false);
    }
  };

  // Switch marketing employee
  const handleSwitchEmployee = () => {
    sessionStorage.removeItem('activeMarketingEmployee');
    setActiveEmployee(null);
    setSelectedEmpForAuth(null);
    setEmpPassword('');
    setAuthError('');
    fetchMarketingEmployees();
  };

  // Capture GPS using HTML5 Geolocation and auto-fill details using reverse-geocoding
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        try {
          const res = await api.get('/api/marketing/reverse-geocode', {
            params: { lat, lng }
          });
          if (res.data?.success) {
            const info = res.data;
            if (info.area) setArea(info.area);
            if (info.location) setLocationName(info.location);
            if (info.hospitalName) setHospitalName(info.hospitalName);
            if (info.companyName) setCompanyName(info.companyName);
            toast.success(`Live GPS acquired & details auto-filled: ${info.area || 'Location resolved'}`);
          } else {
            toast.success('Live GPS coordinates acquired');
          }
        } catch (geoErr) {
          console.warn('Reverse geocode error:', geoErr);
          toast.success('Live GPS coordinates acquired');
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Could not acquire GPS: ' + (err.message || 'Permission denied'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Quick fill from configured reference location
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

      const headers = {};
      if (activeEmployee?.id) {
        headers['x-marketing-employee-id'] = activeEmployee.id;
      }

      await api.post('/api/marketing/activities', payload, { headers });
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
      if (activeTab === 'add') setActiveTab('dashboard');
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

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: EMPLOYEE SELECTION SCREEN (Required after marketing login)
  // ══════════════════════════════════════════════════════════════════════════
  if (user?.role === 'MARKETING' && !activeEmployee) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-xl bg-gray-900 border-2 border-cyan-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle glow header */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center mb-8 relative">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-cyan-900/40">
              <Compass size={32} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Marketing System</h1>
            <p className="text-xs md:text-sm font-bold text-gray-400 mt-1.5 uppercase tracking-wider">
              Select Marketing Employee
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Choose your profile to access your personal marketing activities & history
            </p>
          </div>

          {fetchingEmployees ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400 space-y-3">
              <RefreshCw size={28} className="animate-spin text-cyan-400" />
              <p className="text-xs font-bold uppercase tracking-wider">Loading Marketing Staff...</p>
            </div>
          ) : marketingEmployees.length === 0 ? (
            <div className="p-8 text-center bg-gray-950/80 rounded-2xl border border-gray-800 space-y-3">
              <AlertCircle size={36} className="mx-auto text-amber-400" />
              <p className="text-sm font-bold text-white">No Marketing Employees Assigned</p>
              <p className="text-xs text-gray-400">
                Please assign employees to the <span className="font-bold text-cyan-300">Marketing</span> profile in Employee Management.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {marketingEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmpForAuth(emp);
                    setEmpPassword('');
                    setAuthError('');
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-950 hover:bg-gray-800/80 border border-gray-800 hover:border-cyan-500/50 transition-all group active:scale-[0.99] text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-black text-lg group-hover:scale-105 transition-transform">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors">
                        {emp.name}
                      </h3>
                      <p className="text-[11px] font-bold text-gray-400">
                        {emp.outletName || 'Marketing Profile'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider opacity-80 group-hover:opacity-100">
                    <span>Select Profile</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
            <span>Enamels Production System</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-red-400 font-bold transition-colors"
            >
              <LogOut size={13} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Password Authentication Modal */}
        {selectedEmpForAuth && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gray-900 border-2 border-cyan-500/40 rounded-3xl p-6 md:p-7 shadow-2xl relative">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">
                      Enter Password for {selectedEmpForAuth.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-semibold">
                      Employee Authentication
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmpForAuth(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {authError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleEmployeeLogin} className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                    Employee Password
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter password (e.g. J1-2-5)"
                    value={empPassword}
                    onChange={(e) => setEmpPassword(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmpForAuth(null)}
                    className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={authenticating}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authenticating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>Unlock Dashboard</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: EMPLOYEE-SPECIFIC MARKETING DASHBOARD & SHELL
  // ══════════════════════════════════════════════════════════════════════════
  const employeeDisplayName = isAdmin
    ? (data.summary?.selectedEmployeeName || (adminSelectedEmployee ? marketingEmployees.find(e => e.id === adminSelectedEmployee)?.name : 'All Staff') || 'All Marketing Staff')
    : (activeEmployee?.name || user?.name || 'Marketing');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Marketing Top App Shell Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
            <Compass size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {isAdmin ? 'Marketing Operations Supervision' : `${employeeDisplayName}'s Marketing Dashboard`}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isAdmin
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}>
                {isAdmin ? 'Supervisory Oversight (Read Only)' : 'Personal Activity'}
              </span>
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs font-bold text-gray-400">Viewing Staff:</span>
                <select
                  value={adminSelectedEmployee}
                  onChange={(e) => setAdminSelectedEmployee(e.target.value)}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">All Marketing Personnel</option>
                  {marketingEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.outletName || 'Marketing'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-bold text-gray-400">
                  Active Employee: <span className="text-white font-extrabold">{employeeDisplayName}</span>
                </span>
                {activeEmployee && (
                  <button
                    onClick={handleSwitchEmployee}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-400 hover:text-cyan-300 text-[11px] font-bold border border-gray-700 transition-colors"
                  >
                    <ArrowRightLeft size={11} />
                    <span>Switch Employee</span>
                  </button>
                )}
              </div>
            )}
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

          {!isAdmin && (
            <FeatureGate feature="MARKETING_LOCATION_ENTRY">
              <button
                onClick={() => setShowLogModal(true)}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-900/40 active:scale-95"
              >
                <Plus size={16} />
                <span>Log New Visit</span>
              </button>
            </FeatureGate>
          )}
        </div>
      </div>

      {/* ── Marketing Navigation Tabs (Section 9 Specification) ── */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-950 border border-gray-800 rounded-2xl overflow-x-auto scrollbar-none">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: Layers },
          { key: 'activities', label: "Today's Activities", icon: Clock },
          ...(!isAdmin ? [{ key: 'add', label: 'Add Activity', icon: Plus }] : []),
          { key: 'map', label: 'Locations & Map', icon: MapPin },
          { key: 'history', label: 'Activity History', icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'add') {
                  setShowLogModal(true);
                } else {
                  setActiveTab(tab.key);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                active
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-850'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <SectionOverlay isUpdating={loading} updatingText="Synchronizing marketing activities...">
        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Today Visits */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Today's Visits</p>
                <p className="text-2xl md:text-3xl font-black text-white mt-1">{summary.todayCount || 0}</p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Logged today</p>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Card 2: Visited Areas */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Visited Areas</p>
                <p className="text-2xl md:text-3xl font-black text-cyan-400 mt-1">{summary.visitedAreasCount || 0}</p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">
                  {summary.visitedAreas?.length > 0 ? summary.visitedAreas.slice(0, 2).join(', ') : 'No areas yet'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Navigation size={20} />
              </div>
            </div>
          </div>

          {/* Card 3: Total Visits */}
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Total Activities</p>
                <p className="text-2xl md:text-3xl font-black text-purple-400 mt-1">{data.history?.length || 0}</p>
                <p className="text-[11px] font-bold text-gray-500 mt-1">Historical total</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <MapPin size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Active Tab Content ── */}
        {(activeTab === 'dashboard' || activeTab === 'map') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Latest Location Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-cyan-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Current / Latest Location</h3>
                  </div>
                  {latestLoc?.source === 'GPS' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      GPS Verified
                    </span>
                  )}
                </div>

                {latestLoc ? (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-500">Area</span>
                      <p className="text-lg font-black text-white">{latestLoc.area}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-500">Location / Address</span>
                      <p className="text-sm font-bold text-gray-300">{latestLoc.location}</p>
                    </div>

                    {latestLoc.hospitalName && (
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-500">Hospital</span>
                        <p className="text-sm font-bold text-blue-300 flex items-center gap-1.5 mt-0.5">
                          <Building2 size={13} /> {latestLoc.hospitalName}
                        </p>
                      </div>
                    )}

                    {latestLoc.companyName && (
                      <div>
                        <span className="text-[10px] font-black uppercase text-gray-500">Company</span>
                        <p className="text-sm font-bold text-purple-300 flex items-center gap-1.5 mt-0.5">
                          <Building2 size={13} /> {latestLoc.companyName}
                        </p>
                      </div>
                    )}

                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-500">Last Activity Time</span>
                      <p className="text-xs font-bold text-gray-300 flex items-center gap-1.5 mt-0.5">
                        <Clock size={13} className="text-gray-400" /> {latestLoc.time} ({latestLoc.date})
                      </p>
                    </div>

                    {latestLoc.notes && (
                      <div className="p-3 bg-gray-950/60 rounded-xl border border-gray-800 text-xs text-gray-300">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Notes:</span>
                        {latestLoc.notes}
                      </div>
                    )}

                    {latestLoc.latitude && latestLoc.longitude && (
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-gray-500">
                          {latestLoc.latitude.toFixed(4)}, {latestLoc.longitude.toFixed(4)}
                        </span>
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
                    <p className="text-[10px] text-gray-600">
                      {isAdmin ? 'Awaiting field visits from marketing staff' : 'Click "Log New Visit" to record your first activity today'}
                    </p>
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
        )}

        {/* ── Today's Activities Timeline (Must Never Overwrite Previous Records) ── */}
        {(activeTab === 'dashboard' || activeTab === 'activities') && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Today's Visits ({data.todayActivities?.length || 0})
                </h3>
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
                <p className="text-[11px] text-gray-600">
                  {isAdmin ? 'Awaiting field visits from marketing staff' : 'Click "Log New Visit" to record your first visit today'}
                </p>
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
                              {act.hospitalName}
                            </span>
                          )}
                          {act.companyName && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/40 text-purple-300 border border-purple-700/40">
                              {act.companyName}
                            </span>
                          )}
                        </div>
                        {act.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">"{act.notes}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-xs font-bold text-white block">{act.time}</span>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase">{act.source}</span>
                      </div>
                      {act.latitude && act.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${act.latitude},${act.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
                          title="View on Google Maps"
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
        )}

        {/* ── Activity History (Historical Records) ── */}
        {(activeTab === 'dashboard' || activeTab === 'history') && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Personal Activity History
                </h3>
                <p className="text-[11px] text-gray-400 font-bold">Search past marketing visits and locations</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search area/hospital..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
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
                    className="text-xs text-gray-400 hover:text-white underline font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <FileText size={32} className="mx-auto text-gray-600 mb-2 opacity-50" />
                <p className="text-xs font-bold">No historical records match your filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950 text-gray-400 uppercase tracking-wider text-[10px] font-black border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Area & Location</th>
                      <th className="px-4 py-3">Hospital / Company</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">GPS / Source</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-gray-300 font-semibold">
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-850/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-white block">{item.date}</span>
                          <span className="text-[10px] text-gray-400">{item.time}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-black text-white block">{item.area}</span>
                          <span className="text-[11px] text-gray-400">{item.location}</span>
                        </td>
                        <td className="px-4 py-3">
                          {item.hospitalName ? (
                            <span className="inline-flex items-center gap-1 text-blue-300 font-bold">
                              <Building2 size={12} /> {item.hospitalName}
                            </span>
                          ) : item.companyName ? (
                            <span className="inline-flex items-center gap-1 text-purple-300 font-bold">
                              <Building2 size={12} /> {item.companyName}
                            </span>
                          ) : (
                            <span className="text-gray-500 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-400" title={item.notes || ''}>
                          {item.notes || <span className="text-gray-600 italic">No notes</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.source === 'GPS'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {item.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {item.latitude && item.longitude ? (
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold text-xs"
                            >
                              <span>Map</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-gray-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SectionOverlay>

      {/* ── Log New Visit Modal (Field Marketing Staff Only) ── */}
      {!isAdmin && showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border-2 border-cyan-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Compass size={20} className="text-cyan-400" />
                <h3 className="text-base font-black text-white">Record Marketing Visit</h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Quick pre-fill from configured locations */}
            {configuredLocations.length > 0 && (
              <div className="mb-4 p-3 bg-gray-950 rounded-2xl border border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                  Quick Select Reference Location
                </span>
                <select
                  onChange={(e) => handleSelectConfigured(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                  defaultValue=""
                >
                  <option value="" disabled>Choose a configured hospital/site...</option>
                  {configuredLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.area})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleCreateActivity} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-1 block">
                    Area / Region *
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
                    <span>{gpsLoading ? 'Acquiring & Auto-Filling...' : 'Acquire Current Location'}</span>
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
                {latitude && longitude && (
                  <p className="text-[10px] text-cyan-300 font-bold flex items-center gap-1.5 pt-1">
                    <CheckCircle2 size={12} className="text-cyan-400 shrink-0" />
                    <span>Location acquired & details auto-filled above (editable if needed)</span>
                  </p>
                )}
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
