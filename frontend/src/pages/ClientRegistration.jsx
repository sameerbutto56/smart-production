import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, User, Phone, MapPin, Ruler, X, Save, Trash2, Edit2, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GENDERS = ['Male', 'Female', 'Other'];
const MEASUREMENT_CHARTS = ['Standard Size Chart', 'Plus Size Chart', 'Custom Measurements'];
const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const ClientRegistration = () => {
  const { user } = useAuth();
  const outletName = user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
    user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
    user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : null;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const [tab, setTab] = useState('register');
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [additionalPhones, setAdditionalPhones] = useState([]);
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  const STANDARD_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const [form, setForm] = useState({
    name: '', gender: 'Male', phone: '',
    permanentAddress: '', city: '',
    measurementChart: '', sizeDetails: '',
    clientNumber: '',
    standardSizes: []
  });

  const [customMeasurements, setCustomMeasurements] = useState({});

  const MEASUREMENT_FIELDS = [
    { key: 'shirtLength', label: 'Shirt Length' },
    { key: 'waist', label: 'Waist' },
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'length', label: 'Length' },
    { key: 'sleeve', label: 'Sleeve' },
    { key: 'bottomWidth', label: 'Bottom Width (Pancha)' },
    { key: 'mori', label: 'Mori (Leg Opening)' },
    { key: 'thigh', label: 'Thigh' },
    { key: 'chest', label: 'Chest' },
    { key: 'bottomZeer', label: 'Bottom / Hem (Zeer)' },
    { key: 'bottom', label: 'Bottom' },
  ];

  const [extraMeasurements, setExtraMeasurements] = useState([]);

  const addExtraMeasurement = () => setExtraMeasurements([...extraMeasurements, { name: '', value: '' }]);
  const removeExtraMeasurement = (i) => setExtraMeasurements(extraMeasurements.filter((_, idx) => idx !== i));
  const updateExtraMeasurement = (i, field, val) => {
    const copy = [...extraMeasurements];
    copy[i] = { ...copy[i], [field]: val };
    setExtraMeasurements(copy);
  };

  const resetForm = () => {
    setForm({ name: '', gender: 'Male', phone: '', permanentAddress: '', city: '', measurementChart: '', sizeDetails: '', clientNumber: '', standardSizes: [] });
    setCustomMeasurements({});
    setExtraMeasurements([]);
    setAdditionalPhones([]);
    setDeliveryAddresses([]);
    setSelectedClient(null);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleMeasurementChange = (key, val) => {
    setCustomMeasurements({ ...customMeasurements, [key]: val });
  };

  const addPhone = () => setAdditionalPhones([...additionalPhones, '']);
  const removePhone = (i) => setAdditionalPhones(additionalPhones.filter((_, idx) => idx !== i));
  const updatePhone = (i, val) => {
    const copy = [...additionalPhones];
    copy[i] = val;
    setAdditionalPhones(copy);
  };

  const addAddress = () => setDeliveryAddresses([...deliveryAddresses, '']);
  const removeAddress = (i) => setDeliveryAddresses(deliveryAddresses.filter((_, idx) => idx !== i));
  const updateAddress = (i, val) => {
    const copy = [...deliveryAddresses];
    copy[i] = val;
    setDeliveryAddresses(copy);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return alert('Name and phone are required');
    setSaving(true);
    try {
      const sizeDetailsValue = form.measurementChart === 'Custom Measurements' && (Object.keys(customMeasurements).length > 0 || extraMeasurements.length > 0)
        ? JSON.stringify({ ...customMeasurements, _extra: extraMeasurements.filter(e => e.name && e.value) })
        : form.sizeDetails;
      const payload = {
        ...form,
        sizeDetails: sizeDetailsValue,
        additionalPhones: additionalPhones.filter(Boolean),
        deliveryAddresses: deliveryAddresses.filter(Boolean),
        outletName: selectedClient ? selectedClient.outletName : (isAdmin ? form.outletName : outletName)
      };
      if (selectedClient) {
        const res = await api.put(`/api/clients/${selectedClient.id}`, payload);
        setClients(clients.map(c => c.id === res.data.id ? res.data : c));
        setSelectedClient(res.data);
        alert('Client updated successfully');
      } else {
        const res = await api.post('/api/clients', payload);
        setForm(f => ({ ...f, clientNumber: res.data.clientNumber || '' }));
        setClients([res.data, ...clients]);
        alert(`Client registered! Number: ${res.data.clientNumber || 'N/A'}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving client');
    }
    setSaving(false);
  };

  const searchClients = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const params = { q: searchQuery };
      if (!isAdmin && outletName) params.outlet = outletName;
      const res = await api.get('/api/clients/search', { params });
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    }
    setLoading(false);
  }, [searchQuery, isAdmin, outletName]);

  const loadClients = useCallback(async () => {
    try {
      const params = {};
      if (!isAdmin && outletName) params.outlet = outletName;
      const res = await api.get('/api/clients', { params });
      setClients(res.data);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  }, [isAdmin, outletName]);

  useEffect(() => {
    if (tab === 'search') loadClients();
  }, [tab, loadClients]);

  useEffect(() => {
    if (searchQuery) {
      const timer = setTimeout(() => searchClients(), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchClients]);

  const editClient = (client) => {
    setSelectedClient(client);
    setForm({
      name: client.name || '',
      gender: client.gender || 'Male',
      phone: client.phone || '',
      permanentAddress: client.permanentAddress || '',
      city: client.city || '',
      measurementChart: client.measurementChart || '',
      sizeDetails: client.sizeDetails || '',
      clientNumber: client.clientNumber || '',
      standardSizes: client.standardSizes || []
    });
    if (client.sizeDetails && typeof client.sizeDetails === 'string' && client.sizeDetails.startsWith('{')) {
      try {
        const parsed = JSON.parse(client.sizeDetails);
        const { _extra, ...rest } = parsed;
        setCustomMeasurements(rest);
        setExtraMeasurements(Array.isArray(_extra) ? _extra : []);
      } catch (e) { setCustomMeasurements({}); setExtraMeasurements([]); }
    } else {
      setCustomMeasurements({});
      setExtraMeasurements([]);
    }
    setAdditionalPhones(client.additionalPhones || []);
    setDeliveryAddresses(client.deliveryAddresses || []);
    setTab('register');
  };

  const deactivateClient = async (id) => {
    if (!window.confirm('Deactivate this client?')) return;
    try {
      await api.delete(`/api/clients/${id}`);
      setClients(clients.filter(c => c.id !== id));
    } catch (err) {
      alert('Error deactivating client');
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 rotate-2">
            <User className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Client Registration</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">Outlet-Based Client Management</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-2 border-gray-700 rounded-2xl p-1.5">
        {[
          { key: 'register', label: 'Register Client', icon: Plus },
          { key: 'search', label: 'Search / All Clients', icon: Search }
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); resetForm(); }}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider ${
              tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          ><t.icon size={14} />{t.label}</button>
        ))}
      </div>

      {/* Outlet indicator for non-admin */}
      {!isAdmin && outletName && (
        <div className="flex items-center gap-2 text-sm font-bold text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2">
          <Building2 size={14} />Outlet: {outletName}
        </div>
      )}

      {tab === 'register' && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {selectedClient && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
              <span className="text-sm font-bold text-amber-400">Editing: {selectedClient.name}</span>
              <button type="button" onClick={resetForm} className="text-xs font-black text-gray-400 hover:text-white bg-gray-800 px-3 py-1.5 rounded-lg">Cancel</button>
            </div>
          )}

          {/* Basic Information */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2"><User size={14} />Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Client Name *</label>
                <input name="name" value={form.name} onChange={handleChange} required
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none">
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Phone Number *</label>
                <input name="phone" value={form.phone} onChange={handleChange} required
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                  placeholder="03XX-XXXXXXX" />
              </div>
            </div>
            {form.clientNumber && (
              <div className="bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-2.5 inline-block">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Client #</span>
                <p className="text-lg font-black text-blue-300">{form.clientNumber}</p>
              </div>
            )}

            {/* Additional Phones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold theme-text-secondary">Additional Phone Numbers</label>
                <button type="button" onClick={addPhone} className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} />Add Phone</button>
              </div>
              <div className="space-y-2">
                {additionalPhones.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={p} onChange={(e) => updatePhone(i, e.target.value)}
                      className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                      placeholder="Additional phone number" />
                    <button type="button" onClick={() => removePhone(i)} className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2"><MapPin size={14} />Address Information</h2>
            <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">City</label>
                <input name="city" value={form.city} onChange={handleChange}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                  placeholder="City" />
              </div>
            <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Permanent Address</label>
                <textarea name="permanentAddress" value={form.permanentAddress} onChange={handleChange} rows={2}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Permanent address" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold theme-text-secondary">Delivery Addresses</label>
                <button type="button" onClick={addAddress} className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} />Add Address</button>
              </div>
              <div className="space-y-2">
                {deliveryAddresses.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={a} onChange={(e) => updateAddress(i, e.target.value)}
                      className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                      placeholder="Delivery address" />
                    <button type="button" onClick={() => removeAddress(i)} className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Measurement Information */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2"><Ruler size={14} />Measurement Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Measurement Chart</label>
                <select name="measurementChart" value={form.measurementChart} onChange={(e) => {
                  handleChange(e);
                  if (e.target.value !== 'Custom Measurements') { setCustomMeasurements({}); setExtraMeasurements([]); }
                }}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none">
                  <option value="">Select chart...</option>
                  {MEASUREMENT_CHARTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                {form.measurementChart === 'Custom Measurements' ? (
                  <div className="flex items-center h-full">
                    <p className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/30">
                      Full measurement chart below
                    </p>
                  </div>
                ) : (
                  <>
                    <label className="text-xs font-bold theme-text-secondary block mb-1">Size Details</label>
                    <input name="sizeDetails" value={form.sizeDetails} onChange={handleChange}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                      placeholder="e.g., S, M, L, XL or custom" />
                  </>
                )}
              </div>
            </div>

            {form.measurementChart === 'Custom Measurements' && (
              <div className="border-t-2 border-gray-700 pt-4 mt-2">
                <p className="text-xs font-black theme-text-primary uppercase tracking-widest mb-4">Make Your Own Size (inches)</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {MEASUREMENT_FIELDS.map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] font-bold theme-text-secondary block mb-1 uppercase tracking-wider">{field.label}</label>
                      <input type="text" value={customMeasurements[field.key] || ''} onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                        className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                        placeholder="in" />
                    </div>
                  ))}
                </div>

                {/* Extra Measurements */}
                <div className="border-t border-gray-700 pt-4 mt-6">
                  <p className="text-xs font-bold theme-text-secondary mb-3">Additional Measurements</p>
                  <div className="space-y-2">
                    {extraMeasurements.map((em, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input value={em.name} onChange={(e) => updateExtraMeasurement(i, 'name', e.target.value)}
                          className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                          placeholder="Measurement name" />
                        <input value={em.value} onChange={(e) => updateExtraMeasurement(i, 'value', e.target.value)}
                          className="w-24 bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                          placeholder="in" />
                        <button type="button" onClick={() => removeExtraMeasurement(i)} className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addExtraMeasurement}
                    className="mt-2 text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} />Add More</button>
                </div>
              </div>
            )}
          </div>

          {/* Standard Sizes */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-3">
            <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2"><Ruler size={14} />Standard Sizes</h2>
            <p className="text-xs font-bold text-gray-500">Select standard garment sizes for this customer.</p>
            <div className="flex flex-wrap gap-2">
              {STANDARD_SIZE_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => {
                  const copy = [...(form.standardSizes || [])];
                  const idx = copy.indexOf(s);
                  if (idx >= 0) copy.splice(idx, 1); else copy.push(s);
                  setForm({ ...form, standardSizes: copy });
                }}
                  className={`px-4 py-2 text-xs font-black rounded-xl border-2 transition-all ${
                    (form.standardSizes || []).includes(s)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Outlet selection for admin */}
          {isAdmin && !selectedClient && (
            <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border">
              <label className="text-xs font-bold theme-text-secondary block mb-1">Outlet *</label>
              <select name="outletName" value={form.outletName || ''} onChange={(e) => setForm({ ...form, outletName: e.target.value })}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none">
                <option value="">Select outlet...</option>
                {OUTLETS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
            <Save size={18} />{saving ? 'Saving...' : selectedClient ? 'Update Client' : 'Register Client'}
          </button>
        </form>
      )}

      {/* Search / All Clients Tab */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2"><Search className="text-gray-500" size={16} /></div>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
              placeholder="Search by name, phone, or client number..." />
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-center text-gray-500 font-bold py-8">Searching...</p>
            ) : searchQuery && searchResults.length === 0 ? (
              <p className="text-center text-gray-500 font-bold py-8">No clients found</p>
            ) : (searchQuery ? searchResults : clients).map(client => (
              <div key={client.id} className="glass p-4 rounded-2xl border-2 theme-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-black text-lg theme-text-primary">{client.name}</h3>
                    <p className="text-sm font-bold text-gray-400">{client.gender} • {client.outletName}</p>
                    {client.clientNumber && <p className="text-xs font-black text-blue-400">Client #{client.clientNumber}</p>}
                    <p className="text-sm font-bold text-blue-400">{client.phone}</p>
                    {client.additionalPhones?.filter(Boolean).map((p, i) => (
                      <p key={i} className="text-sm font-bold text-gray-500">{p}</p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => editClient(client)} className="p-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl"><Edit2 size={14} /></button>
                    <button onClick={() => deactivateClient(client.id)} className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl"><Trash2 size={14} /></button>
                  </div>
                </div>
                <button onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                  className="mt-2 text-xs font-bold text-gray-500 hover:text-white flex items-center gap-1">
                  {expandedId === client.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedId === client.id ? 'Hide Details' : 'Show Details'}
                </button>
                {expandedId === client.id && (
                  <div className="mt-3 space-y-2 pt-3 border-t border-gray-700">
                    {client.additionalPhones?.filter(Boolean).map((p, i) => (
                      <p key={i} className="text-sm font-bold text-gray-400"><span className="text-gray-500">Alt Phone {i + 1}:</span> {p}</p>
                    ))}
                    {client.permanentAddress && <p className="text-sm font-bold text-gray-400"><span className="text-gray-500">Address:</span> {client.permanentAddress}</p>}
                    {client.deliveryAddresses?.filter(Boolean).map((a, i) => (
                      <p key={i} className="text-sm font-bold text-gray-400"><span className="text-gray-500">Delivery {i + 1}:</span> {a}</p>
                    ))}
                    {client.measurementChart && <p className="text-sm font-bold text-gray-400"><span className="text-gray-500">Chart:</span> {client.measurementChart}</p>}
                    {client.sizeDetails && typeof client.sizeDetails === 'string' && client.sizeDetails.startsWith('{') ? (
                      <div className="mt-2"><span className="text-sm font-bold text-gray-500">Measurements:</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 mt-1">
                          {(() => { try {
                            const parsed = JSON.parse(client.sizeDetails);
                            const { _extra, ...rest } = parsed;
                            const entries = Object.entries(rest).filter(([,v]) => v);
                            const extras = Array.isArray(_extra) ? _extra.filter(e => e.name && e.value) : [];
                            return <>
                              {entries.map(([k, v]) => <p key={k} className="text-xs font-bold text-gray-400"><span className="text-gray-600 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span> {v}"</p>)}
                              {extras.map((e, i) => <p key={`e${i}`} className="text-xs font-bold text-gray-400"><span className="text-gray-600">{e.name}:</span> {e.value}"</p>)}
                            </>;
                          } catch (e) { return <p className="text-xs text-gray-500">{client.sizeDetails}</p>; } })()}
                        </div>
                      </div>
                    ) : client.sizeDetails ? (
                      <p className="text-sm font-bold text-gray-400"><span className="text-gray-500">Size:</span> {client.sizeDetails}</p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {!searchQuery && clients.length === 0 && !loading && (
              <p className="text-center text-gray-500 font-bold py-8">No clients registered yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRegistration;
