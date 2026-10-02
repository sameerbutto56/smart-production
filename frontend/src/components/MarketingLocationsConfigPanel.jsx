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
  Crosshair
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay } from './common/LoadingStates';

export default function MarketingLocationsConfigPanel() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/marketing/locations');
      setLocations(res.data?.locations || []);
    } catch (e) {
      toast.error('Failed to load configured locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenAdd = () => {
    setEditingLoc(null);
    setName('');
    setArea('');
    setHospitalName('');
    setCompanyName('');
    setAddress('');
    setLatitude('');
    setLongitude('');
    setRadius('100');
    setShowModal(true);
  };

  const handleOpenEdit = (loc) => {
    setEditingLoc(loc);
    setName(loc.name || '');
    setArea(loc.area || '');
    setHospitalName(loc.hospitalName || '');
    setCompanyName(loc.companyName || '');
    setAddress(loc.address || '');
    setLatitude(loc.latitude ? String(loc.latitude) : '');
    setLongitude(loc.longitude ? String(loc.longitude) : '');
    setRadius(loc.radius ? String(loc.radius) : '100');
    setShowModal(true);
  };

  const handleGetGps = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !area.trim() || !latitude || !longitude) {
      toast.error('Name, Area, Latitude, and Longitude are required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        area: area.trim(),
        hospitalName: hospitalName.trim() || null,
        companyName: companyName.trim() || null,
        address: address.trim() || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius) || 100,
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
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, locName) => {
    if (!window.confirm(`Delete configured location "${locName}"?`)) return;
    try {
      await api.delete(`/api/marketing/locations/${id}`);
      toast.success('Location deleted');
      fetchLocations();
    } catch (e) {
      toast.error('Failed to delete location');
    }
  };

  const handleToggleActive = async (loc) => {
    try {
      await api.put(`/api/marketing/locations/${loc.id}`, { isActive: !loc.isActive });
      toast.success(`Location ${loc.isActive ? 'disabled' : 'enabled'}`);
      fetchLocations();
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
            <Compass size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Configured Operational Locations</h2>
            <p className="text-xs text-gray-400 font-bold">Standard reference locations, client offices & hospital premises for marketing quick-fill</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLocations}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all border border-gray-700"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-cyan-900/30"
          >
            <Plus size={16} />
            <span>Add Location</span>
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
                  <th className="pb-3 px-3">Area & Address</th>
                  <th className="pb-3 px-3">Hospital / Company</th>
                  <th className="pb-3 px-3">GPS Coordinates</th>
                  <th className="pb-3 px-3">Radius</th>
                  <th className="pb-3 px-3 text-center">Status</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-medium">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500 font-bold">
                      No configured locations yet. Click "Add Location" to add one.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-white">
                        {loc.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-cyan-400 font-bold">{loc.area}</span>
                        {loc.address && <div className="text-[10px] text-gray-500">{loc.address}</div>}
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
                          <MapPin size={12} />
                          <span>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                        </a>
                      </td>
                      <td className="py-3 px-3 text-gray-400">
                        {loc.radius || 100}m
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleActive(loc)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${loc.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-500'}`}
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-black text-white">
                {editingLoc ? 'Edit Configured Location' : 'Add Configured Location'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white p-1">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doctors Hospital Main Gate"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Radius (meters)</label>
                  <input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
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
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Company (optional)</label>
                  <input
                    type="text"
                    placeholder="Company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-gray-400 block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  placeholder="Street or building details"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
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
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/30"
                >
                  {submitting ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
