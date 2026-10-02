import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  Compass,
  MapPin,
  Building2,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle2,
  Crosshair,
  AlertCircle,
  User,
  Check,
  X,
  Navigation,
  ArrowRight,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay } from './common/LoadingStates';
import { formatDateTime } from '../utils/dateTime';

export default function MarketingLocationsConfigPanel() {
  // General locations list
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Marketing Employees
  const [employees, setEmployees] = useState([]);
  const [fetchingEmployees, setFetchingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');

  // Active configured location for selected employee
  const [activeEmpLocation, setActiveEmpLocation] = useState(null);
  const [fetchingEmpLoc, setFetchingEmpLoc] = useState(false);

  // Link Extraction State
  const [locationMode, setLocationMode] = useState('CONFIGURED'); // 'CONFIGURED' | 'LIVE'
  const [mapUrlInput, setMapUrlInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  // Extracted Edit Form State (for review before saving)
  const [formName, setFormName] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formHospital, setFormHospital] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formRadius, setFormRadius] = useState('100');
  const [savingLocation, setSavingLocation] = useState(false);

  // Manual General Location Modal
  const [showModal, setShowModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [manualName, setManualName] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [manualHospital, setManualHospital] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualRadius, setManualRadius] = useState('100');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // 1. Fetch Marketing Employees
  const fetchEmployees = useCallback(async () => {
    setFetchingEmployees(true);
    try {
      const res = await api.get('/api/marketing/employees');
      const list = Array.isArray(res.data?.employees) ? res.data.employees : [];
      setEmployees(list);
      if (list.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(list[0].id);
        setSelectedEmployeeName(list[0].name);
      }
    } catch {
      toast.error('Failed to load marketing employees list');
    } finally {
      setFetchingEmployees(false);
    }
  }, [selectedEmployeeId]);

  // 2. Fetch Active Configured Location for selected employee
  const fetchEmployeeLocation = useCallback(async (empId) => {
    if (!empId) {
      setActiveEmpLocation(null);
      return;
    }
    setFetchingEmpLoc(true);
    try {
      const res = await api.get(`/api/marketing/employee-location/${empId}`);
      setActiveEmpLocation(res.data?.location || null);
    } catch {
      setActiveEmpLocation(null);
    } finally {
      setFetchingEmpLoc(false);
    }
  }, []);

  // 3. Fetch All Configured Locations
  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/marketing/locations');
      setLocations(res.data?.locations || []);
    } catch {
      toast.error('Failed to load configured locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLocations();
  }, [fetchEmployees, fetchLocations]);

  useEffect(() => {
    if (selectedEmployeeId) {
      const found = employees.find(e => e.id === selectedEmployeeId);
      if (found) setSelectedEmployeeName(found.name);
      fetchEmployeeLocation(selectedEmployeeId);
    }
  }, [selectedEmployeeId, employees, fetchEmployeeLocation]);

  // Handle Employee Change
  const handleEmployeeChange = (empId) => {
    setSelectedEmployeeId(empId);
    const found = employees.find(e => e.id === empId);
    if (found) setSelectedEmployeeName(found.name);
    // Reset any pending un-saved extraction
    setExtractedData(null);
    setExtractionError(null);
    setMapUrlInput('');
  };

  // 4. Extract Location from URL
  const handleExtractLocation = async (e) => {
    if (e) e.preventDefault();
    const cleanUrl = (mapUrlInput || '').trim();
    if (!cleanUrl) {
      toast.error('Please paste a Google Maps or location link');
      return;
    }

    setExtracting(true);
    setExtractionError(null);
    setExtractedData(null);

    try {
      const res = await api.post('/api/marketing/extract-location-link', { url: cleanUrl });
      if (res.data?.success) {
        const d = res.data;
        setExtractedData(d);
        // Pre-fill editable form with extracted details
        setFormName(d.placeName || d.area || 'Marketing Location');
        setFormArea(d.area || '');
        setFormCity(d.city || 'Lahore');
        setFormHospital(d.hospitalName || '');
        setFormCompany(d.companyName || '');
        setFormAddress(d.address || '');
        setFormLat(String(d.latitude));
        setFormLng(String(d.longitude));
        setFormRadius('100');
        toast.success(`Location extracted: ${d.placeName || d.area}`);
      } else {
        const errMsg = res.data?.message || 'Unable to extract location from this link.';
        setExtractionError({
          message: errMsg,
          reason: res.data?.reason || 'Coordinates unavailable'
        });
        toast.error(errMsg);
      }
    } catch (err) {
      const errRes = err.response?.data;
      const errMsg = errRes?.message || 'Unable to extract location from this link. Please paste a supported Google Maps/location link.';
      const errReason = errRes?.reason || err.message || 'Link could not be resolved';
      setExtractionError({
        message: errMsg,
        reason: errReason
      });
      toast.error(errMsg);
    } finally {
      setExtracting(false);
    }
  };

  // 5. Save Employee Location
  const handleSaveEmployeeLocation = async () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (!formLat || !formLng) {
      toast.error('Valid latitude and longitude are required');
      return;
    }

    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      toast.error('Latitude must be between -90 and 90, and longitude between -180 and 180.');
      return;
    }

    setSavingLocation(true);
    try {
      const payload = {
        employeeId: selectedEmployeeId,
        locationName: formName.trim() || `${selectedEmployeeName}'s Configured Location`,
        area: formArea.trim() || 'Lahore',
        city: formCity.trim() || 'Lahore',
        hospitalName: formHospital.trim() || null,
        companyName: formCompany.trim() || null,
        address: formAddress.trim() || null,
        latitude: latNum,
        longitude: lngNum,
        radius: parseFloat(formRadius) || 100,
        originalMapUrl: extractedData?.sourceUrl || mapUrlInput.trim(),
        locationMode,
        isActive: true
      };

      const res = await api.post('/api/marketing/employee-location', payload);
      if (res.data?.success) {
        toast.success(`Configured location saved for ${selectedEmployeeName}`);
        setActiveEmpLocation(res.data.location);
        // Reset extract state
        setExtractedData(null);
        setMapUrlInput('');
        fetchLocations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  // 6. Manual Reference Location modal handlers
  const handleOpenAdd = () => {
    setEditingLoc(null);
    setManualName('');
    setManualArea('');
    setManualHospital('');
    setManualCompany('');
    setManualAddress('');
    setManualLat('');
    setManualLng('');
    setManualRadius('100');
    setShowModal(true);
  };

  const handleOpenEdit = (loc) => {
    setEditingLoc(loc);
    setManualName(loc.name || '');
    setManualArea(loc.area || '');
    setManualHospital(loc.hospitalName || '');
    setManualCompany(loc.companyName || '');
    setManualAddress(loc.address || '');
    setManualLat(loc.latitude ? String(loc.latitude) : '');
    setManualLng(loc.longitude ? String(loc.longitude) : '');
    setManualRadius(loc.radius ? String(loc.radius) : '100');
    setShowModal(true);
  };

  const handleGetGps = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualLat(pos.coords.latitude.toFixed(6));
        setManualLng(pos.coords.longitude.toFixed(6));
        setGpsLoading(false);
        toast.success('Live GPS coordinates captured');
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Failed to get GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualName.trim() || !manualArea.trim() || !manualLat || !manualLng) {
      toast.error('Name, Area, Latitude, and Longitude are required');
      return;
    }

    setManualSubmitting(true);
    try {
      const payload = {
        name: manualName.trim(),
        area: manualArea.trim(),
        hospitalName: manualHospital.trim() || null,
        companyName: manualCompany.trim() || null,
        address: manualAddress.trim() || null,
        latitude: parseFloat(manualLat),
        longitude: parseFloat(manualLng),
        radius: parseFloat(manualRadius) || 100,
      };

      if (editingLoc) {
        await api.put(`/api/marketing/locations/${editingLoc.id}`, payload);
        toast.success('Location updated');
      } else {
        await api.post('/api/marketing/locations', payload);
        toast.success('Location created');
      }
      setShowModal(false);
      fetchLocations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save location');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleDelete = async (id, locName) => {
    if (!window.confirm(`Delete configured location "${locName}"?`)) return;
    try {
      await api.delete(`/api/marketing/locations/${id}`);
      toast.success('Location deleted');
      fetchLocations();
    } catch {
      toast.error('Failed to delete location');
    }
  };

  const handleToggleActive = async (loc) => {
    try {
      await api.put(`/api/marketing/locations/${loc.id}`, { isActive: !loc.isActive });
      toast.success(`Location ${loc.isActive ? 'disabled' : 'enabled'}`);
      fetchLocations();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-8">
      {/* ═════════════════════════════════════════════════════════════════
          SECTION 1: MARKETING EMPLOYEE LOCATION CONFIGURATION (LINK EXTRACTION)
          ═════════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl bg-gray-900 border border-gray-800 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30">
              <Compass size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight">Marketing Location Management</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Link Extraction
                </span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Configure a Marketing employee's location by pasting a Google Maps or compatible map link.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedEmployeeId) fetchEmployeeLocation(selectedEmployeeId);
              fetchEmployees();
              fetchLocations();
            }}
            className="self-start md:self-auto p-2.5 rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white transition-all border border-gray-700"
            title="Refresh"
          >
            <RefreshCw size={15} className={fetchingEmpLoc || fetchingEmployees ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>

        {/* Form Controls */}
        <div className="mt-6 space-y-6">
          {/* Employee Selection & Location Mode Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Select Employee */}
            <div className="p-4 rounded-2xl bg-gray-950/80 border border-gray-800/90 space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <User size={13} className="text-cyan-400" />
                <span>Select Marketing Employee *</span>
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                disabled={fetchingEmployees}
                className="w-full bg-gray-900 border border-gray-750 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
              >
                {employees.length === 0 ? (
                  <option value="">No marketing employees found</option>
                ) : (
                  employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.outletName ? `(${emp.outletName})` : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="text-[10px] text-gray-500 font-medium">
                Configured location will be attached directly to this employee's profile.
              </p>
            </div>

            {/* 2. Location Mode */}
            <div className="p-4 rounded-2xl bg-gray-950/80 border border-gray-800/90 space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Navigation size={13} className="text-cyan-400" />
                <span>Location Mode *</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocationMode('CONFIGURED')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    locationMode === 'CONFIGURED'
                      ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500 shadow-sm shadow-cyan-900/30'
                      : 'bg-gray-900 text-gray-400 border-gray-750 hover:text-white'
                  }`}
                >
                  <Building2 size={13} />
                  <span>Configured Location</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMode('LIVE')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    locationMode === 'LIVE'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500 shadow-sm shadow-blue-900/30'
                      : 'bg-gray-900 text-gray-400 border-gray-750 hover:text-white'
                  }`}
                >
                  <Crosshair size={13} />
                  <span>Live Location (GPS)</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                {locationMode === 'CONFIGURED'
                  ? 'Active configured location is enforced for visit quick-fill and verified reference coordinates.'
                  : 'Visits will prioritize live mobile browser GPS coordinates.'}
              </p>
            </div>
          </div>

          {/* Active Configured Location Summary (if already set) */}
          {activeEmpLocation && !extractedData && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-gray-950 border border-cyan-500/30 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      Active Configured Location for {selectedEmployeeName}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <MapPin size={16} className="text-cyan-400 shrink-0" />
                    <span>{activeEmpLocation.name}</span>
                    <span className="text-xs font-bold text-cyan-400/80">({activeEmpLocation.area})</span>
                  </h3>
                  {activeEmpLocation.hospitalName && (
                    <p className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                      <Building2 size={13} /> 🏥 {activeEmpLocation.hospitalName}
                    </p>
                  )}
                  {activeEmpLocation.companyName && (
                    <p className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <Building2 size={13} /> 🏢 {activeEmpLocation.companyName}
                    </p>
                  )}
                  {activeEmpLocation.address && (
                    <p className="text-[11px] font-medium text-gray-400 max-w-xl">
                      {activeEmpLocation.address}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 font-mono text-xs text-cyan-300 flex items-center gap-1.5">
                    <Compass size={13} />
                    <span>{activeEmpLocation.latitude.toFixed(6)}, {activeEmpLocation.longitude.toFixed(6)}</span>
                  </div>

                  <a
                    href={`https://www.google.com/maps?q=${activeEmpLocation.latitude},${activeEmpLocation.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-all border border-gray-700"
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {activeEmpLocation.updatedAt && (
                <div className="mt-3 pt-3 border-t border-gray-800/60 text-[10px] text-gray-500 font-medium flex items-center justify-between">
                  <span>Last Updated: {formatDateTime(activeEmpLocation.updatedAt)}</span>
                  <span className="text-cyan-400/70">Paste new link below to replace/update this location</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Paste Map/Location Link & Extract Action */}
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-cyan-400" />
                <span>Paste Map / Location Link *</span>
              </span>
              <span className="text-[10px] font-normal text-gray-500">
                Supports maps.app.goo.gl, place links, search URLs & coordinates
              </span>
            </label>

            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={mapUrlInput}
                  onChange={(e) => {
                    setMapUrlInput(e.target.value);
                    if (extractionError) setExtractionError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleExtractLocation();
                    }
                  }}
                  placeholder="https://maps.app.goo.gl/... or https://www.google.com/maps/place/..."
                  className="w-full bg-gray-950 border border-gray-750 focus:border-cyan-500 rounded-2xl px-4 py-3.5 text-xs font-medium text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                />
                {mapUrlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setMapUrlInput('');
                      setExtractedData(null);
                      setExtractionError(null);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExtractLocation}
                disabled={extracting || !mapUrlInput.trim()}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 shrink-0 active:scale-95"
              >
                {extracting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Extracting Location...</span>
                  </>
                ) : (
                  <>
                    <Compass size={15} />
                    <span>Extract Location</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. Extraction Failure Banner (Section 6 Specification) */}
          {extractionError && (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-start gap-3 shadow-lg animate-in fade-in">
              <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black text-rose-200">
                  {extractionError.message}
                </p>
                {extractionError.reason && (
                  <p className="text-[11px] font-medium text-rose-400/90">
                    <span className="font-bold">Reason:</span> {extractionError.reason}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  Tip: Open the location in Google Maps, click "Share", copy the share link, and paste it here.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              5. MAP PREVIEW & VERIFICATION (Section 3 Specification)
              ═══════════════════════════════════════════════════════════════ */}
          {extractedData && (
            <div className="p-6 rounded-3xl bg-gray-950 border border-cyan-500/40 space-y-6 shadow-2xl animate-in fade-in">
              {/* Verification Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    Extracted Location Preview • Verify Before Saving
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-full border border-cyan-800">
                    Marker Verified
                  </span>
                </div>
              </div>

              {/* Grid: Map Preview (Left) + Extracted Details (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Interactive Map with Marker */}
                <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 flex flex-col justify-between shadow-xl min-h-[340px]">
                  <div className="p-3 bg-gray-850 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-gray-300 flex items-center gap-1.5">
                      <MapPin size={13} className="text-cyan-400" />
                      <span>Interactive Location Map</span>
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${formLat},${formLng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>Google Maps View</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div className="flex-1 min-h-[280px] relative">
                    <iframe
                      title="Extracted Location Verification Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight="0"
                      marginWidth="0"
                      className="w-full h-full min-h-[280px]"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formLng) - 0.008}%2C${parseFloat(formLat) - 0.008}%2C${parseFloat(formLng) + 0.008}%2C${parseFloat(formLat) + 0.008}&layer=mapnik&marker=${formLat}%2C${formLng}`}
                    />
                  </div>

                  <div className="p-2.5 bg-gray-950/90 border-t border-gray-800 text-center text-[10px] text-gray-400 font-medium">
                    Marker pinned at extracted coordinates: <span className="font-mono text-cyan-300">{formLat}, {formLng}</span>
                  </div>
                </div>

                {/* Structured Details Review & Edit */}
                <div className="lg:col-span-6 space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Location Name */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Location Name / Place Name *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Doctors Hospital Main Gate"
                        className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                      />
                    </div>

                    {/* Area & City */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Area / Region *
                        </label>
                        <input
                          type="text"
                          value={formArea}
                          onChange={(e) => setFormArea(e.target.value)}
                          placeholder="e.g. Johar Town"
                          className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={formCity}
                          onChange={(e) => setFormCity(e.target.value)}
                          placeholder="e.g. Lahore"
                          className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Hospital / Company */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Hospital (if identifiable)
                        </label>
                        <input
                          type="text"
                          value={formHospital}
                          onChange={(e) => setFormHospital(e.target.value)}
                          placeholder="Hospital name"
                          className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-bold text-blue-300 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Company / Org (if identifiable)
                        </label>
                        <input
                          type="text"
                          value={formCompany}
                          onChange={(e) => setFormCompany(e.target.value)}
                          placeholder="Company name"
                          className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-bold text-purple-300 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Full Address */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                        Full Address
                      </label>
                      <textarea
                        rows={2}
                        value={formAddress}
                        onChange={(e) => setFormAddress(e.target.value)}
                        placeholder="Street details and full address"
                        className="w-full bg-gray-900 border border-gray-750 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-medium text-gray-300 focus:outline-none resize-none"
                      />
                    </div>

                    {/* Coordinates & Radius */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-gray-900/90 rounded-xl border border-gray-800">
                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-500 block">Latitude</span>
                        <span className="font-mono text-xs font-bold text-cyan-300">{formLat}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-500 block">Longitude</span>
                        <span className="font-mono text-xs font-bold text-cyan-300">{formLng}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-gray-500 block">Radius (m)</span>
                        <input
                          type="number"
                          value={formRadius}
                          onChange={(e) => setFormRadius(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-750 rounded-lg px-2 py-0.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions: Save or Cancel */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setExtractedData(null)}
                      className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-white text-xs font-bold transition-all"
                    >
                      Cancel / Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEmployeeLocation}
                      disabled={savingLocation}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 active:scale-95"
                    >
                      {savingLocation ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Saving Location...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Save Location for {selectedEmployeeName}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          SECTION 2: ALL CONFIGURED OPERATIONAL LOCATIONS (SYSTEM-WIDE)
          ═════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">System Configured Locations</h3>
              <p className="text-xs text-gray-400 font-medium">
                Standard reference sites, hospitals, and corporate premises available for Marketing quick-selection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLocations}
              className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all border border-gray-700"
              title="Refresh list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-cyan-900/30"
            >
              <Plus size={14} />
              <span>Add Reference Location</span>
            </button>
          </div>
        </div>

        <SectionOverlay isUpdating={loading} updatingText="Loading configured locations...">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 px-3">Location Name</th>
                    <th className="pb-3 px-3">Assigned Employee</th>
                    <th className="pb-3 px-3">Area & Address</th>
                    <th className="pb-3 px-3">Hospital / Company</th>
                    <th className="pb-3 px-3">Coordinates</th>
                    <th className="pb-3 px-3">Radius</th>
                    <th className="pb-3 px-3 text-center">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-gray-500 font-bold">
                        No configured locations yet. Extract a location above or click "Add Reference Location".
                      </td>
                    </tr>
                  ) : (
                    locations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-cyan-400 shrink-0" />
                            <span>{loc.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {loc.employeeName ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              👤 {loc.employeeName}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[10px] font-bold">Global Reference</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-cyan-400 font-bold">{loc.area}</span>
                          {loc.city && <span className="text-gray-400">, {loc.city}</span>}
                          {loc.address && <div className="text-[10px] text-gray-500 line-clamp-1">{loc.address}</div>}
                        </td>
                        <td className="py-3 px-3">
                          {loc.hospitalName && <div className="text-blue-400 font-bold">🏥 {loc.hospitalName}</div>}
                          {loc.companyName && <div className="text-purple-400 font-bold">🏢 {loc.companyName}</div>}
                          {!loc.hospitalName && !loc.companyName && <span className="text-gray-600">—</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <a
                            href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <span>{loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}</span>
                            <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="py-3 px-3 text-gray-400">
                          {loc.radius || 100}m
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleActive(loc)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              loc.isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-gray-800 text-gray-500'
                            }`}
                          >
                            {loc.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(loc)}
                              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(loc.id, loc.name)}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-400"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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

      {/* Manual Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-black text-white">
                {editingLoc ? 'Edit Reference Location' : 'Add Reference Location'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doctors Hospital Main Gate"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Area *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Johar Town"
                    value={manualArea}
                    onChange={(e) => setManualArea(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Radius (meters)</label>
                  <input
                    type="number"
                    value={manualRadius}
                    onChange={(e) => setManualRadius(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Hospital (optional)</label>
                  <input
                    type="text"
                    placeholder="Hospital name"
                    value={manualHospital}
                    onChange={(e) => setManualHospital(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Company (optional)</label>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  placeholder="Street or building details"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Coordinates */}
              <div className="p-3 bg-gray-950 rounded-2xl border border-gray-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-gray-400">Coordinates</span>
                  <button
                    type="button"
                    onClick={handleGetGps}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-bold hover:underline"
                  >
                    <Crosshair size={12} />
                    <span>{gpsLoading ? 'Acquiring...' : 'Get GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Latitude"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Longitude"
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/30"
                >
                  {manualSubmitting ? 'Saving...' : 'Save Reference'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
