import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, User, Phone, MapPin, Ruler, X, Save, Trash2, Edit2,
  ChevronDown, ChevronUp, Building2, ShoppingCart, Lock, Clock,
  Calendar, Package, Check, RotateCcw, AlertTriangle, ShieldCheck, Sparkles, Filter,
  UserCheck, UserPlus, Users, CheckCircle2, ArrowRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../utils/dateTime';
import {
  SHIRT_MEASUREMENT_FIELDS,
  TROUSER_MEASUREMENT_FIELDS,
  normalizeCustomerMeasurements
} from '../utils/measurementUtils';

const GENDERS = ['Male', 'Female', 'Other'];
const MEASUREMENT_CHARTS = ['Standard Size Chart', 'Plus Size Chart', 'Custom Measurements'];
const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];
const STANDARD_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const ClientRegistration = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletName = user?.name?.toLowerCase().includes('johar') ? 'Johar Town' :
    user?.name?.toLowerCase().includes('jail') ? 'Jail Road' :
    user?.name?.toLowerCase().includes('abbottabad') ? 'Abbottabad' : null;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(user?.role || '');

  const [tab, setTab] = useState('register');
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [outletFilter, setOutletFilter] = useState('ALL');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [additionalPhones, setAdditionalPhones] = useState([]);
  const [deliveryAddresses, setDeliveryAddresses] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [clientDetails, setClientDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  const [duplicateModalData, setDuplicateModalData] = useState(null);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState(null);

  const [form, setForm] = useState({
    name: '', gender: 'Male', phone: '',
    permanentAddress: '', city: '',
    measurementChart: '', sizeDetails: '',
    clientNumber: '',
    standardSizes: [],
    outletName: ''
  });

  const [customMeasurements, setCustomMeasurements] = useState({});
  const [extraMeasurements, setExtraMeasurements] = useState([]);

  const addExtraMeasurement = () => setExtraMeasurements([...extraMeasurements, { name: '', value: '' }]);
  const removeExtraMeasurement = (i) => setExtraMeasurements(extraMeasurements.filter((_, idx) => idx !== i));
  const updateExtraMeasurement = (i, field, val) => {
    const copy = [...extraMeasurements];
    copy[i] = { ...copy[i], [field]: val };
    setExtraMeasurements(copy);
  };

  const loadClientIntoForm = useCallback((client, opts = {}) => {
    setSelectedClient(client);

    // Identify missing mandatory fields for customer profile completion
    const missing = [];
    if (!client.name || !String(client.name).trim()) missing.push('Customer Name');
    if (!client.permanentAddress && !client.city) missing.push('Address / City');
    const hasSizes = Array.isArray(client.standardSizes) && client.standardSizes.length > 0;
    const hasCustom = client.sizeDetails && (
      (typeof client.sizeDetails === 'string' && client.sizeDetails.length > 5) ||
      (typeof client.sizeDetails === 'object' && Object.keys(client.sizeDetails).length > 0)
    );
    if (!hasSizes && !hasCustom && !client.measurementChart) {
      missing.push('Measurements / Size Chart');
    }

    setForm({
      name: client.name || '',
      gender: client.gender || 'Male',
      phone: client.phone || '',
      permanentAddress: client.permanentAddress || '',
      city: client.city || '',
      measurementChart: client.measurementChart || '',
      sizeDetails: typeof client.sizeDetails === 'string' ? client.sizeDetails : JSON.stringify(client.sizeDetails || {}),
      clientNumber: client.clientNumber || '',
      standardSizes: Array.isArray(client.standardSizes) ? client.standardSizes : [],
      outletName: client.outletName || ''
    });

    const normalized = normalizeCustomerMeasurements(client.sizeDetails);
    const { _extra, ...rest } = normalized;
    setCustomMeasurements(rest || {});
    setExtraMeasurements(Array.isArray(_extra) ? _extra : []);

    setAdditionalPhones(Array.isArray(client.additionalPhones) ? client.additionalPhones : []);
    setDeliveryAddresses(Array.isArray(client.deliveryAddresses) ? client.deliveryAddresses : []);

    if (missing.length > 0) {
      setPhoneVerification({
        status: 'incomplete',
        client,
        missing,
        message: `Existing customer profile loaded with missing details (${missing.join(', ')}). Complete the missing fields below.`
      });
      if (!opts.silent) {
        toast(`Existing customer loaded (${client.name}). Missing: ${missing.join(', ')}`, { icon: '⚠️' });
      }
    } else {
      setPhoneVerification({
        status: 'exists',
        client,
        missing: [],
        message: 'This customer is already registered. Existing details have been loaded.'
      });
      if (!opts.silent) {
        toast.success(`Existing customer loaded: ${client.name} (#${client.clientNumber || 'N/A'})`);
      }
    }

    setTab('register');
  }, []);

  const handlePhoneLookup = useCallback(async (phoneVal) => {
    const raw = String(phoneVal || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7) {
      setPhoneVerification(null);
      return;
    }

    setPhoneLookupLoading(true);
    try {
      const res = await api.get('/api/clients/search', {
        params: { q: raw, allOutlets: 'true' }
      });
      const matches = Array.isArray(res.data) ? res.data : [];

      if (matches.length === 0) {
        setPhoneVerification({
          status: 'new',
          phone: raw,
          message: 'New customer — complete registration details below.'
        });
        setSelectedClient(null);
      } else if (matches.length === 1) {
        const matched = matches[0];
        try {
          const fullRes = await api.get(`/api/clients/${matched.id}`);
          loadClientIntoForm(fullRes.data || matched);
        } catch {
          loadClientIntoForm(matched);
        }
      } else {
        setPhoneVerification({
          status: 'multiple',
          phone: raw,
          matches,
          message: `${matches.length} registered customers share this phone number. Select one:`
        });
      }
    } catch (err) {
      console.error('Phone lookup error:', err);
    }
    setPhoneLookupLoading(false);
  }, [loadClientIntoForm]);

  // Debounced auto-lookup on phone input change
  useEffect(() => {
    if (tab !== 'register') return;
    const raw = String(form.phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7) {
      if (!selectedClient) {
        setPhoneVerification(null);
      }
      return;
    }

    // If currently selected client already has this phone, don't re-query
    if (selectedClient && selectedClient.phone && selectedClient.phone.replace(/\D/g, '') === digits) {
      return;
    }

    const timer = setTimeout(() => {
      handlePhoneLookup(raw);
    }, 450);

    return () => clearTimeout(timer);
  }, [form.phone, tab, selectedClient, handlePhoneLookup]);

  const selectCandidate = useCallback(async (candidate) => {
    try {
      const fullRes = await api.get(`/api/clients/${candidate.id}`);
      loadClientIntoForm(fullRes.data || candidate);
    } catch {
      loadClientIntoForm(candidate);
    }
  }, [loadClientIntoForm]);

  const registerAsNewWithSharedPhone = () => {
    setSelectedClient(null);
    setPhoneVerification({
      status: 'new_shared',
      phone: form.phone,
      message: 'Registering new customer profile with shared family phone number.'
    });
    setForm(prev => ({
      name: '',
      gender: 'Male',
      phone: prev.phone,
      permanentAddress: '',
      city: '',
      measurementChart: '',
      sizeDetails: '',
      clientNumber: '',
      standardSizes: [],
      outletName: ''
    }));
    setCustomMeasurements({});
    setExtraMeasurements([]);
    setAdditionalPhones([]);
    setDeliveryAddresses([]);
  };

  const resetForm = () => {
    setForm({
      name: '', gender: 'Male', phone: '',
      permanentAddress: '', city: '',
      measurementChart: '', sizeDetails: '',
      clientNumber: '', standardSizes: [],
      outletName: ''
    });
    setCustomMeasurements({});
    setExtraMeasurements([]);
    setAdditionalPhones([]);
    setDeliveryAddresses([]);
    setSelectedClient(null);
    setDuplicateModalData(null);
    setPhoneVerification(null);
    setPhoneLookupLoading(false);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, phone: val }));
    if (!val || val.trim().length < 7) {
      setPhoneVerification(null);
    }
  };

  const handleMeasurementChange = (key, val) => {
    setCustomMeasurements(prev => ({ ...prev, [key]: val }));
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

  // Branch ownership check
  const canEditClient = useCallback((client) => {
    if (!client) return true;
    if (isAdmin) return true;
    if (!client.outletName) return true;
    if (!outletName) return false;
    return client.outletName.toLowerCase().trim() === outletName.toLowerCase().trim();
  }, [isAdmin, outletName]);

  const handleSubmit = async (e, options = {}) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error('Name and phone are required');
    }

    if (selectedClient && !canEditClient(selectedClient)) {
      return toast.error(`Only ${selectedClient.outletName} staff or an administrator can edit this customer's profile.`);
    }

    setSaving(true);
    try {
      // Custom measurements persistence: preserve both custom measurements and standard sizes
      const hasCustomValues = Object.values(customMeasurements).some(v => v && String(v).trim() !== '') || extraMeasurements.some(e => e.name && e.value);
      let sizeDetailsValue = form.sizeDetails;
      if (hasCustomValues) {
        sizeDetailsValue = JSON.stringify({
          ...customMeasurements,
          _extra: extraMeasurements.filter(e => e.name && e.value)
        });
      }

      const payload = {
        name: form.name.trim(),
        gender: form.gender,
        phone: form.phone.trim(),
        city: form.city ? form.city.trim() : null,
        permanentAddress: form.permanentAddress ? form.permanentAddress.trim() : null,
        measurementChart: form.measurementChart || (hasCustomValues ? 'Custom Measurements' : null),
        sizeDetails: sizeDetailsValue,
        standardSizes: form.standardSizes || [],
        additionalPhones: additionalPhones.filter(p => p && p.trim()),
        deliveryAddresses: deliveryAddresses.filter(a => a && a.trim()),
        outletName: selectedClient ? selectedClient.outletName : (isAdmin ? (form.outletName || 'Johar Town') : (outletName || 'Johar Town')),
        ...(options.force || phoneVerification?.status === 'new_shared' ? { force: true } : {})
      };

      if (selectedClient) {
        const res = await api.put(`/api/clients/${selectedClient.id}`, payload);
        setClients(prev => prev.map(c => c.id === res.data.id ? res.data : c));
        if (searchResults.length > 0) {
          setSearchResults(prev => prev.map(c => c.id === res.data.id ? res.data : c));
        }
        setClientDetails(prev => ({ ...prev, [res.data.id]: res.data }));
        loadClientIntoForm(res.data, { silent: true });
        toast.success('Customer profile updated successfully');
      } else {
        const res = await api.post('/api/clients', payload);
        setClients(prev => [res.data, ...prev]);
        loadClientIntoForm(res.data, { silent: true });
        toast.success(`Client registered successfully! Client #: ${res.data.clientNumber || 'N/A'}`);
      }
      setDuplicateModalData(null);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'DUPLICATE_PHONE') {
        setDuplicateModalData(err.response.data);
      } else {
        toast.error(err.response?.data?.message || 'Error saving client');
      }
    }
    setSaving(false);
  };

  // Cross-outlet search
  const searchClients = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const params = { q: searchQuery.trim(), allOutlets: 'true' };
      if (outletFilter !== 'ALL') {
        params.outlet = outletFilter;
        delete params.allOutlets;
      }
      const res = await api.get('/api/clients/search', { params });
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed');
    }
    setLoading(false);
  }, [searchQuery, outletFilter]);

  // Load all clients across branches or filtered
  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { allOutlets: 'true' };
      if (outletFilter !== 'ALL') {
        params.outlet = outletFilter;
        delete params.allOutlets;
      }
      const res = await api.get('/api/clients', { params });
      setClients(res.data);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
    setLoading(false);
  }, [outletFilter]);

  useEffect(() => {
    if (tab === 'search') {
      if (searchQuery.trim()) {
        searchClients();
      } else {
        loadClients();
      }
    }
  }, [tab, outletFilter, loadClients, searchClients, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => searchClients(), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchClients]);

  // Fetch full details and order history on toggle
  const toggleDetails = async (client) => {
    const clientId = client.id;
    if (expandedId === clientId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(clientId);
    if (!clientDetails[clientId]) {
      setLoadingDetails(prev => ({ ...prev, [clientId]: true }));
      try {
        const res = await api.get(`/api/clients/${clientId}`);
        setClientDetails(prev => ({ ...prev, [clientId]: res.data }));
      } catch (err) {
        console.error('Failed to load client details:', err);
      } finally {
        setLoadingDetails(prev => ({ ...prev, [clientId]: false }));
      }
    }
  };

  const editClient = (client) => {
    if (!canEditClient(client)) {
      return toast.error(`Editing restricted: Customer profile is owned by ${client.outletName}. Only staff from ${client.outletName} or an administrator can edit registration details.`);
    }

    setSelectedClient(client);
    setForm({
      name: client.name || '',
      gender: client.gender || 'Male',
      phone: client.phone || '',
      permanentAddress: client.permanentAddress || '',
      city: client.city || '',
      measurementChart: client.measurementChart || '',
      sizeDetails: typeof client.sizeDetails === 'string' ? client.sizeDetails : JSON.stringify(client.sizeDetails || {}),
      clientNumber: client.clientNumber || '',
      standardSizes: Array.isArray(client.standardSizes) ? client.standardSizes : [],
      outletName: client.outletName || ''
    });

    // Parse custom measurements
    const normalized = normalizeCustomerMeasurements(client.sizeDetails);
    const { _extra, ...rest } = normalized;
    setCustomMeasurements(rest || {});
    setExtraMeasurements(Array.isArray(_extra) ? _extra : []);

    setAdditionalPhones(Array.isArray(client.additionalPhones) ? client.additionalPhones : []);
    setDeliveryAddresses(Array.isArray(client.deliveryAddresses) ? client.deliveryAddresses : []);
    setTab('register');
  };

  const deactivateClient = async (id, client) => {
    if (!canEditClient(client)) {
      return toast.error(`Action restricted: Customer profile is owned by ${client.outletName}.`);
    }
    if (!window.confirm('Deactivate this client?')) return;
    try {
      await api.delete(`/api/clients/${id}`);
      setClients(prev => prev.filter(c => c.id !== id));
      setSearchResults(prev => prev.filter(c => c.id !== id));
      toast.success('Client deactivated');
    } catch (err) {
      toast.error('Error deactivating client');
    }
  };

  // One-Click Proceed to Order
  const handleProceedToOrder = (client, repeatOrder = null) => {
    const params = new URLSearchParams();
    if (client.clientNumber) params.set('clientNumber', client.clientNumber);
    if (client.id) params.set('clientId', client.id);
    if (client.phone) params.set('phone', client.phone);
    if (repeatOrder?.id) params.set('repeatOrderId', repeatOrder.id);
    navigate(`/outlet-order-entry?${params.toString()}`);
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
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">
              Shared Client Database &bull; Cross-Branch Access
            </p>
          </div>
        </div>

        {/* Current Branch indicator */}
        <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-2.5 self-start md:self-auto">
          <Building2 size={16} />
          <span>Current Session Branch: {outletName || (isAdmin ? 'Admin / Multi-Branch' : 'Outlet')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-900 border-2 border-gray-700 rounded-2xl p-1.5 max-w-md">
        {[
          { key: 'register', label: selectedClient ? 'Edit Client' : 'Register Client', icon: selectedClient ? Edit2 : Plus },
          { key: 'search', label: 'Search All Clients', icon: Search }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === 'register' && tab !== 'register' && !selectedClient) {
                resetForm();
              }
              setTab(t.key);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer ${
              tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* REGISTER / EDIT FORM */}
      {tab === 'register' && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {/* STEP 1: PHONE NUMBER FIRST (SEARCH & IDENTIFICATION) */}
          <div className="glass p-5 md:p-6 rounded-2xl border-2 theme-border space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                  <Phone size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-black theme-text-primary uppercase tracking-wider flex items-center gap-2">
                    1. Customer Phone Number
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      Primary Identification & Search
                    </span>
                  </h2>
                  <p className="text-xs font-bold text-gray-400">
                    Enter the phone number first. The system searches across all outlets and auto-loads existing records.
                  </p>
                </div>
              </div>
              {(form.phone || selectedClient || phoneVerification) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-black text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-xl border border-gray-700 transition-all cursor-pointer flex items-center gap-1 self-start sm:self-auto"
                >
                  <RotateCcw size={12} />
                  Clear / New Customer
                </button>
              )}
            </div>

            <div className="relative">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                    <Phone size={18} />
                  </div>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    onBlur={() => {
                      if (form.phone && form.phone.replace(/\D/g, '').length >= 7) {
                        handlePhoneLookup(form.phone);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (form.phone && form.phone.replace(/\D/g, '').length >= 7) {
                          handlePhoneLookup(form.phone);
                        }
                      }
                    }}
                    required
                    autoFocus
                    className="w-full bg-gray-900 border-2 border-gray-700 focus:border-blue-500 rounded-xl py-3.5 pl-12 pr-4 text-base font-extrabold text-white placeholder-gray-500 outline-none transition-all"
                    placeholder="Enter phone number (e.g. 0300-1234567 or 03001234567)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {phoneLookupLoading ? (
                    <div className="px-5 py-3.5 bg-blue-600/20 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap animate-pulse">
                      <RefreshCw size={14} className="animate-spin" />
                      Searching...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePhoneLookup(form.phone)}
                      disabled={!form.phone || form.phone.replace(/\D/g, '').length < 7}
                      className="px-5 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-lg shadow-blue-900/30"
                    >
                      <Search size={14} />
                      Verify Phone
                    </button>
                  )}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 font-bold block mt-1.5">
                Checks primary and alternate phone numbers across Johar Town, Jail Road, Abbottabad, and all outlets.
              </span>
            </div>

            {/* Additional Phones Section inside Phone block */}
            <div className="pt-2 border-t border-gray-800/80">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs font-bold theme-text-secondary block">
                    Additional / Alternate Phone Numbers (Up to 4+ numbers)
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold block">
                    Customers can be found by searching ANY of these alternate numbers.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addPhone}
                  className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20"
                >
                  <Plus size={12} />Add Alt Phone
                </button>
              </div>
              <div className="space-y-2">
                {additionalPhones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="px-2.5 py-2 rounded-xl text-xs font-black bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shrink-0">
                      Alt #{i + 1}
                    </span>
                    <input
                      value={p}
                      onChange={(e) => updatePhone(i, e.target.value)}
                      className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-2 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                      placeholder={i === 0 ? "Alternate Phone #1 (e.g. 0312-XXXXXXX)" : i === 1 ? "Alternate Phone #2 (e.g. 0321-XXXXXXX)" : `Alternate Phone #${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removePhone(i)}
                      className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                      title="Remove number"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* DYNAMIC STATUS ALERT BANNERS: SCENARIOS A, B, C, D */}
          {phoneVerification?.status === 'exists' && phoneVerification.client && (
            <div className="bg-gradient-to-r from-emerald-950/70 via-gray-900 to-emerald-950/50 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40 shrink-0">
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-emerald-300">
                        This customer is already registered. Existing details have been loaded.
                      </span>
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                        Complete Profile
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-300 mt-1">
                      <span className="text-white font-black text-sm">{phoneVerification.client.name}</span>
                      {phoneVerification.client.clientNumber && ` • Client #${phoneVerification.client.clientNumber}`}
                      {` • Registered at `}
                      <span className="text-amber-300 font-bold">{phoneVerification.client.outletName || 'Johar Town'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleProceedToOrder(phoneVerification.client)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer"
                  >
                    <ShoppingCart size={15} />
                    Proceed to Order
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              {!canEditClient(phoneVerification.client) && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  <Lock size={14} className="shrink-0" />
                  <span>
                    Owned by {phoneVerification.client.outletName}. Customer registration details and address are protected and cannot be modified by other outlets. You can proceed to create orders directly.
                  </span>
                </div>
              )}
            </div>
          )}

          {phoneVerification?.status === 'incomplete' && phoneVerification.client && (
            <div className="bg-gradient-to-r from-amber-950/70 via-gray-900 to-amber-950/50 border-2 border-amber-500/50 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-black text-amber-300">
                        Existing Customer Profile Loaded — Missing Details Detected
                      </span>
                      <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                        Incomplete Profile
                      </span>
                    </div>
                    <p className="text-xs font-bold text-gray-300 mt-1">
                      <span className="text-white font-black text-sm">{phoneVerification.client.name}</span>
                      {phoneVerification.client.clientNumber && ` • Client #${phoneVerification.client.clientNumber}`}
                      {` • Registered at `}
                      <span className="text-amber-300 font-bold">{phoneVerification.client.outletName || 'Johar Town'}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-400">Please complete highlighted fields:</span>
                      {phoneVerification.missing.map((m, idx) => (
                        <span key={idx} className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                          ⚠️ {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleProceedToOrder(phoneVerification.client)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer"
                  >
                    <ShoppingCart size={15} />
                    Proceed to Order
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              {!canEditClient(phoneVerification.client) && (
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  <Lock size={14} className="shrink-0" />
                  <span>
                    Owned by {phoneVerification.client.outletName}. Profile details are locked for editing by other branches, but you can create orders directly.
                  </span>
                </div>
              )}
            </div>
          )}

          {phoneVerification?.status === 'new' && (
            <div className="bg-gradient-to-r from-blue-950/70 via-gray-900 to-indigo-950/50 border-2 border-blue-500/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/40 shrink-0">
                  <UserPlus size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-blue-300">
                      New customer — complete registration details below.
                    </span>
                    <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/40">
                      Unregistered Phone
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    No customer found with phone <span className="text-white font-extrabold">{phoneVerification.phone}</span>. Fill in the profile fields below to register.
                  </p>
                </div>
              </div>
            </div>
          )}

          {phoneVerification?.status === 'multiple' && (
            <div className="bg-gradient-to-r from-purple-950/70 via-gray-900 to-indigo-950/60 border-2 border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/40 shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <span className="text-sm font-black text-purple-200 block">
                      {phoneVerification.matches.length} Registered Customers Share This Phone Number
                    </span>
                    <p className="text-xs font-bold text-gray-400 mt-0.5">
                      Select the matching customer below to load their profile, or register a new customer with this shared phone:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={registerAsNewWithSharedPhone}
                  className="text-xs font-black text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-600 px-3.5 py-2.5 rounded-xl border border-purple-500/30 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <UserPlus size={14} />
                  Register as New Family Member
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {phoneVerification.matches.map(c => (
                  <div key={c.id} className="bg-gray-900/90 border border-purple-500/30 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:border-purple-400 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white">{c.name}</span>
                        <span className="text-[10px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30">
                          #{c.clientNumber}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-gray-400 flex items-center gap-2 flex-wrap">
                        <span>Branch: <span className="text-amber-300">{c.outletName}</span></span>
                        <span>•</span>
                        <span>Phone: <span className="text-gray-200">{c.phone}</span></span>
                      </div>
                      {c.permanentAddress && (
                        <p className="text-[11px] font-medium text-gray-400 truncate">
                          📍 {c.permanentAddress}{c.city ? `, ${c.city}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => selectCandidate(c)}
                        className="flex-1 text-xs font-black bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        Load This Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProceedToOrder(c)}
                        className="text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        title="Proceed to Order"
                      >
                        <ShoppingCart size={13} />
                        Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phoneVerification?.status === 'new_shared' && (
            <div className="bg-purple-950/40 border-2 border-purple-500/40 rounded-xl p-3 flex items-center justify-between text-xs font-bold text-purple-200">
              <span>Registering new customer profile with shared family phone: <strong className="text-white">{phoneVerification.phone}</strong></span>
              <span className="text-[10px] bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">Shared Phone Mode</span>
            </div>
          )}

          {/* STEP 2: CUSTOMER PROFILE & BASIC DETAILS */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2">
                <User size={14} />
                2. Customer Profile Information
              </h2>
              {phoneVerification?.missing?.includes('Customer Name') && (
                <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                  ⚠️ Name Required
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-bold theme-text-secondary block mb-1">
                  Customer Name * {phoneVerification?.missing?.includes('Customer Name') && <span className="text-amber-400 font-extrabold">(Missing in Profile)</span>}
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className={`w-full bg-gray-900 border-2 ${
                    phoneVerification?.missing?.includes('Customer Name')
                      ? 'border-amber-500 focus:border-amber-400 ring-2 ring-amber-500/20'
                      : 'border-gray-700 focus:border-blue-500'
                  } rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none transition-all`}
                  placeholder="Full customer name"
                />
              </div>

              <div>
                <label className="text-xs font-bold theme-text-secondary block mb-1">Gender</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none"
                >
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {form.clientNumber ? (
              <div className="bg-blue-900/30 border border-blue-700/60 rounded-xl px-4 py-2.5 inline-flex items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Assigned Client #</span>
                  <p className="text-lg font-black text-blue-300">#{form.clientNumber}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl px-3 py-2 inline-flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400">Client # will be automatically assigned upon registration</span>
              </div>
            )}
          </div>

          {/* Address Information */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2">
                <MapPin size={14} />
                3. Address & Delivery Details
              </h2>
              <div className="flex items-center gap-2">
                {phoneVerification?.missing?.includes('Address / City') && (
                  <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                    ⚠️ Missing in Profile
                  </span>
                )}
                {selectedClient && (
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                    Owned by {selectedClient.outletName}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold theme-text-secondary block mb-1">
                City {phoneVerification?.missing?.includes('Address / City') && !form.city && <span className="text-amber-400 font-extrabold">(Missing)</span>}
              </label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className={`w-full bg-gray-900 border-2 ${
                  phoneVerification?.missing?.includes('Address / City') && !form.city
                    ? 'border-amber-500/80 focus:border-amber-400 ring-2 ring-amber-500/20'
                    : 'border-gray-700 focus:border-blue-500'
                } rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none transition-all`}
                placeholder="e.g. Lahore, Abbottabad, Islamabad"
              />
            </div>
            <div>
              <label className="text-xs font-bold theme-text-secondary block mb-1">
                Permanent / Registered Address {phoneVerification?.missing?.includes('Address / City') && !form.permanentAddress && <span className="text-amber-400 font-extrabold">(Missing)</span>}
              </label>
              <textarea
                name="permanentAddress"
                value={form.permanentAddress}
                onChange={handleChange}
                rows={2}
                className={`w-full bg-gray-900 border-2 ${
                  phoneVerification?.missing?.includes('Address / City') && !form.permanentAddress
                    ? 'border-amber-500/80 focus:border-amber-400 ring-2 ring-amber-500/20'
                    : 'border-gray-700 focus:border-blue-500'
                } rounded-xl px-4 py-3 text-sm font-bold text-white placeholder-gray-500 outline-none resize-none transition-all`}
                placeholder="Official permanent address"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold theme-text-secondary">Additional Delivery Addresses</label>
                <button
                  type="button"
                  onClick={addAddress}
                  className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />Add Address
                </button>
              </div>
              <div className="space-y-2">
                {deliveryAddresses.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={a}
                      onChange={(e) => updateAddress(i, e.target.value)}
                      className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                      placeholder={`Delivery address #${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeAddress(i)}
                      className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Standard Sizes Selection */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-3">
            <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2">
              <Ruler size={14} />
              Standard Garment Sizes
            </h2>
            <p className="text-xs font-bold text-gray-400">
              Select standard sizes that fit this customer. Preserved independently from custom measurements.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {STANDARD_SIZE_OPTIONS.map(s => {
                const isSelected = (form.standardSizes || []).includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const copy = [...(form.standardSizes || [])];
                      const idx = copy.indexOf(s);
                      if (idx >= 0) copy.splice(idx, 1);
                      else copy.push(s);
                      setForm({ ...form, standardSizes: copy });
                    }}
                    className={`px-4 py-2 text-xs font-black rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Measurements Section */}
          <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black theme-text-primary uppercase tracking-widest flex items-center gap-2">
                <Ruler size={14} />
                4. Custom Tailoring Measurements (Inches)
              </h2>
              <div className="flex items-center gap-2">
                {phoneVerification?.missing?.includes('Measurements / Size Chart') && (
                  <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md">
                    ⚠️ Missing in Profile
                  </span>
                )}
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/30">
                  Always Persisted
                </span>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-400">
              Enter custom measurements below. They will be saved to the client profile and prefill automatically when creating orders.
            </p>

            {/* Shirt Measurements */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-blue-400 uppercase tracking-wider">Shirt Measurements (شرٹ)</p>
                <span className="text-[10px] text-gray-500 font-bold" dir="rtl">کسٹم شرٹ سائز (انچ میں)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {SHIRT_MEASUREMENT_FIELDS.map(field => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold theme-text-secondary uppercase tracking-wider">
                        {field.label}
                      </label>
                      <span className="text-[10px] font-bold text-blue-400" dir="rtl">
                        {field.labelUrdu}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={customMeasurements[field.key] || ''}
                      onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                      placeholder={`e.g. ${field.example}"`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Trouser Measurements */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">Trouser Measurements (ٹراؤزر)</p>
                <span className="text-[10px] text-gray-500 font-bold" dir="rtl">کسٹم ٹراؤزر سائز (انچ میں)</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {TROUSER_MEASUREMENT_FIELDS.map(field => (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold theme-text-secondary uppercase tracking-wider">
                        {field.label}
                      </label>
                      <span className="text-[10px] font-bold text-emerald-400" dir="rtl">
                        {field.labelUrdu}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={customMeasurements[field.key] || ''}
                      onChange={(e) => handleMeasurementChange(field.key, e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                      placeholder={`e.g. ${field.example}"`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Additional Custom Measurements */}
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-gray-300 uppercase tracking-wider">Additional Custom Measurements</p>
                <button
                  type="button"
                  onClick={addExtraMeasurement}
                  className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />Add Extra Measurement
                </button>
              </div>
              <div className="space-y-2">
                {extraMeasurements.map((em, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={em.name}
                      onChange={(e) => updateExtraMeasurement(i, 'name', e.target.value)}
                      className="flex-1 bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                      placeholder="Measurement label (e.g. Bicep, Collar, Calf)"
                    />
                    <input
                      value={em.value}
                      onChange={(e) => updateExtraMeasurement(i, 'value', e.target.value)}
                      className="w-28 bg-gray-900 border-2 border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                      placeholder='Value in "'
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraMeasurement(i)}
                      className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Registration Branch for Admin */}
          {isAdmin && !selectedClient && (
            <div className="glass p-4 md:p-6 rounded-2xl border-2 theme-border">
              <label className="text-xs font-bold theme-text-secondary block mb-1">Registration Outlet *</label>
              <select
                name="outletName"
                value={form.outletName || ''}
                onChange={(e) => setForm({ ...form, outletName: e.target.value })}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-blue-500 outline-none"
              >
                <option value="">Select outlet...</option>
                {OUTLETS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {selectedClient ? (
              <>
                <button
                  type="submit"
                  disabled={saving || !canEditClient(selectedClient)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer shadow-lg shadow-blue-900/30"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : canEditClient(selectedClient) ? 'Save Customer Profile Changes' : `Profile Owned by ${selectedClient.outletName} (View Only)`}
                </button>
                <button
                  type="button"
                  onClick={() => handleProceedToOrder(selectedClient)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/30"
                >
                  <ShoppingCart size={18} />
                  Proceed to Order with #{selectedClient.clientNumber}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-4 py-4 rounded-2xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-gray-700 text-xs"
                >
                  <RotateCcw size={14} />
                  Search Another
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-900/30"
                >
                  <Save size={18} />
                  {saving ? 'Registering...' : 'Register Customer & Assign Client #'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-5 py-4 rounded-2xl transition-all flex items-center justify-center gap-1 cursor-pointer border border-gray-700 text-xs"
                >
                  <RotateCcw size={14} />
                  Reset Form
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {/* SEARCH / ALL CLIENTS TAB */}
      {tab === 'search' && (
        <div className="space-y-4">
          {/* Search bar & Branch Filter */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3 relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Search className="text-gray-500" size={18} />
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none"
                placeholder="Search across all outlets by phone (primary or additional), name, address, locality, or client #..."
              />
            </div>
            <div>
              <div className="relative">
                <select
                  value={outletFilter}
                  onChange={(e) => setOutletFilter(e.target.value)}
                  className="w-full bg-gray-900 border-2 border-gray-700 rounded-2xl py-4 px-4 text-xs font-bold text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
                >
                  <option value="ALL">All Outlets (Combined)</option>
                  {OUTLETS.map(o => (
                    <option key={o} value={o}>{o} Only</option>
                  ))}
                </select>
                <Filter size={14} className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Client List */}
          <div className="space-y-3">
            {loading ? (
              <div className="glass p-12 rounded-2xl text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-bold text-gray-400">Searching clients across all outlets...</p>
              </div>
            ) : searchQuery && searchResults.length === 0 ? (
              <div className="glass p-12 rounded-2xl text-center space-y-2">
                <AlertTriangle size={32} className="text-amber-400 mx-auto" />
                <p className="text-base font-black text-white">No clients found matching "{searchQuery}"</p>
                <p className="text-xs font-bold text-gray-500">Search by primary phone, any alternate phone, customer name, street/area address, or client #.</p>
              </div>
            ) : (searchQuery ? searchResults : clients).map(client => {
              const isOwner = canEditClient(client);
              const isExpanded = expandedId === client.id;
              const details = clientDetails[client.id] || client;
              const hasRecentOrders = Array.isArray(details.recentOrders) && details.recentOrders.length > 0;

              return (
                <div key={client.id} className="glass p-5 rounded-2xl border-2 theme-border space-y-3 transition-all hover:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-lg md:text-xl text-white">{client.name}</h3>
                        {client.clientNumber && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            Client #{client.clientNumber}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {client.gender || 'Other'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <Building2 size={12} />
                          Registered at {client.outletName || 'Outlet'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 font-bold">
                        <span className="flex items-center gap-1 text-blue-400 font-mono">
                          <Phone size={13} />
                          Primary: {client.phone}
                        </span>
                        {client.city && (
                          <span className="flex items-center gap-1 text-gray-300">
                            <MapPin size={13} />
                            {client.city}
                          </span>
                        )}
                        {client.createdAt && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <Calendar size={13} />
                            Registered: {formatDateTime(client.createdAt)}
                          </span>
                        )}
                      </div>

                      {Array.isArray(client.additionalPhones) && client.additionalPhones.filter(Boolean).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Alternate Phones:</span>
                          {client.additionalPhones.filter(Boolean).map((altP, pIdx) => (
                            <span key={pIdx} className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              {altP}
                            </span>
                          ))}
                        </div>
                      )}

                      {client.permanentAddress && (
                        <p className="text-xs text-gray-400 line-clamp-1">
                          <span className="text-gray-500 font-bold">Address:</span> {client.permanentAddress}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-start">
                      <button
                        onClick={() => handleProceedToOrder(client)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer whitespace-nowrap"
                        title="Open POS Order Entry prefilled with this client"
                      >
                        <ShoppingCart size={14} />
                        Proceed to Order
                      </button>

                      {isOwner ? (
                        <>
                          <button
                            onClick={() => editClient(client)}
                            className="p-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Edit customer registration"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => deactivateClient(client.id, client)}
                            className="p-2 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Deactivate customer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <div
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-xs font-bold"
                          title={`Profile owned by ${client.outletName}. Only ${client.outletName} or Admin can edit registration details.`}
                        >
                          <Lock size={13} />
                          <span className="text-[11px] hidden sm:inline">Owned by {client.outletName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expand / Collapse Details Button */}
                  <button
                    onClick={() => toggleDetails(client)}
                    className="text-xs font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 pt-1 cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Hide Customer Profile & Order History' : 'Show Details & Previous Orders'}
                  </button>

                  {/* EXPANDED PROFILE & ORDER HISTORY */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t-2 border-gray-800 space-y-4">
                      {loadingDetails[client.id] ? (
                        <div className="py-6 text-center text-xs text-gray-400 font-bold">
                          Loading complete customer profile and order history...
                        </div>
                      ) : (
                        <>
                          {/* 1. Complete Customer Profile Breakdown */}
                          <div className="bg-gray-950/70 border border-gray-800 rounded-2xl p-4 space-y-3">
                            <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck size={14} className="text-blue-400" />
                              Complete Customer Profile & Contact Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <span className="text-gray-500 font-bold block">Full Name:</span>
                                <span className="text-white font-bold">{client.name}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-bold block">Client Number:</span>
                                <span className="text-blue-400 font-black">#{client.clientNumber || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-bold block">Registration Branch:</span>
                                <span className="text-purple-300 font-bold">{client.outletName}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-bold block">Primary Phone:</span>
                                <span className="text-white font-mono">{client.phone}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-bold block">Gender:</span>
                                <span className="text-white">{client.gender || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-bold block">City:</span>
                                <span className="text-white">{client.city || '—'}</span>
                              </div>
                              <div className="sm:col-span-2 md:col-span-3">
                                <span className="text-gray-500 font-bold block">Permanent Address:</span>
                                <span className="text-white">{client.permanentAddress || '—'}</span>
                              </div>

                              {Array.isArray(client.additionalPhones) && client.additionalPhones.filter(Boolean).length > 0 && (
                                <div className="sm:col-span-2 md:col-span-3">
                                  <span className="text-gray-500 font-bold block">Alternate Phones:</span>
                                  <span className="text-gray-300 font-mono">
                                    {client.additionalPhones.filter(Boolean).join(', ')}
                                  </span>
                                </div>
                              )}

                              {Array.isArray(client.deliveryAddresses) && client.deliveryAddresses.filter(Boolean).length > 0 && (
                                <div className="sm:col-span-2 md:col-span-3">
                                  <span className="text-gray-500 font-bold block">Delivery Addresses:</span>
                                  <ul className="list-disc list-inside text-gray-300 mt-0.5 space-y-0.5">
                                    {client.deliveryAddresses.filter(Boolean).map((addr, i) => (
                                      <li key={i}>{addr}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Measurements Breakdown (Standard Sizes + Custom Measurements) */}
                          <div className="bg-gray-950/70 border border-gray-800 rounded-2xl p-4 space-y-3">
                            <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Ruler size={14} className="text-emerald-400" />
                              Garment Sizing & Tailoring Measurements
                            </h4>

                            {/* Standard Sizes */}
                            {Array.isArray(client.standardSizes) && client.standardSizes.length > 0 && (
                              <div>
                                <span className="text-xs font-bold text-gray-400 block mb-1.5">Standard Fit Sizes:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {client.standardSizes.map(s => (
                                    <span key={s} className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-600/30 text-blue-300 border border-blue-500/40">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Custom Measurements Grid */}
                            {(() => {
                              try {
                                if (!client.sizeDetails) return null;
                                const parsed = typeof client.sizeDetails === 'string'
                                  ? (client.sizeDetails.startsWith('{') ? JSON.parse(client.sizeDetails) : null)
                                  : client.sizeDetails;

                                if (!parsed || typeof parsed !== 'object') {
                                  return (
                                    <p className="text-xs text-gray-400">
                                      <span className="text-gray-500 font-bold">Size Details:</span> {String(client.sizeDetails)}
                                    </p>
                                  );
                                }

                                const { _extra, ...rest } = parsed;
                                const hasRest = Object.keys(rest).length > 0;
                                const hasExtra = Array.isArray(_extra) && _extra.filter(e => e.name && e.value).length > 0;

                                if (!hasRest && !hasExtra) return null;

                                return (
                                  <div className="pt-2 border-t border-gray-800 space-y-3">
                                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider block">
                                      Custom Measurements (Inches)
                                    </span>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                      {Object.entries(rest).filter(([, v]) => v && String(v).trim()).map(([k, v]) => {
                                        const def = SHIRT_MEASUREMENT_FIELDS.find(f => f.key === k) || TROUSER_MEASUREMENT_FIELDS.find(f => f.key === k);
                                        const labelEn = def?.label || k.replace(/([A-Z])/g, ' $1');
                                        const labelUrdu = def?.labelUrdu;
                                        return (
                                          <div key={k} className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                                            <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                              <span className="text-gray-400 uppercase tracking-wider truncate">{labelEn}</span>
                                              {labelUrdu && <span className="text-blue-400 ml-1" dir="rtl">{labelUrdu}</span>}
                                            </div>
                                            <span className="text-sm font-black text-white">{v}"</span>
                                          </div>
                                        );
                                      })}
                                      {hasExtra && _extra.filter(e => e.name && e.value).map((e, idx) => (
                                        <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                                          <span className="text-[10px] font-bold text-amber-400 uppercase block tracking-wider">
                                            {e.name}
                                          </span>
                                          <span className="text-sm font-black text-white">{e.value}"</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              } catch {
                                return null;
                              }
                            })()}
                          </div>

                          {/* 3. Previous Order History */}
                          <div className="bg-gray-950/70 border border-gray-800 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-cyan-400" />
                                Previous Orders ({details.recentOrders?.length || 0})
                              </h4>
                              <button
                                onClick={() => handleProceedToOrder(client)}
                                className="text-xs font-black text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                              >
                                <ShoppingCart size={13} />
                                Start New Order For Customer &rarr;
                              </button>
                            </div>

                            {hasRecentOrders ? (
                              <div className="space-y-2">
                                {details.recentOrders.map(ord => {
                                  let prods = [];
                                  try {
                                    prods = typeof ord.productDetails === 'string'
                                      ? JSON.parse(ord.productDetails)
                                      : (Array.isArray(ord.productDetails) ? ord.productDetails : []);
                                  } catch {
                                    prods = [];
                                  }

                                  return (
                                    <div
                                      key={ord.id}
                                      className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-black text-blue-400 font-mono text-sm">{ord.orderNumber}</span>
                                          <span className="text-gray-500">&bull;</span>
                                          <span className="text-gray-400 font-bold">{ord.outletName || 'Outlet'}</span>
                                          <span className="text-gray-500">&bull;</span>
                                          <span className="text-gray-400">{formatDateTime(ord.createdAt)}</span>
                                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                                            {ord.currentStage || ord.status || 'ORDER_ENTRY'}
                                          </span>
                                        </div>

                                        {prods.length > 0 && (
                                          <p className="text-gray-300">
                                            <span className="text-gray-500 font-bold">Items:</span>{' '}
                                            {prods.map(p => `${p.name || p.productType || 'Product'} (${[p.size, p.color].filter(Boolean).join('/')}) x${p.quantity || 1}`).join(', ')}
                                          </p>
                                        )}

                                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                                          <span>Total: <strong className="text-white">₨{(ord.totalPrice || 0).toLocaleString()}</strong></span>
                                          {ord.paymentStatus === 'PAID' || (ord.balanceAmount != null && parseFloat(ord.balanceAmount) <= 0.01) ? (
                                            <span className="text-emerald-400 font-bold">✓ Fully Paid</span>
                                          ) : (
                                            <>
                                              {ord.advanceAmount > 0 && <span>Adv: <strong className="text-emerald-400">₨{(ord.advanceAmount || 0).toLocaleString()}</strong></span>}
                                              <span>Bal: <strong className="text-amber-400">₨{(ord.balanceAmount != null ? ord.balanceAmount : Math.max(0, (ord.totalPrice || 0) - (ord.advanceAmount || 0))).toLocaleString()}</strong></span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          onClick={() => handleProceedToOrder(client, ord)}
                                          className="bg-blue-600 hover:bg-blue-500 text-white font-black px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                          title="Repeat this previous order with prefilled products & sizes"
                                        >
                                          <RotateCcw size={12} />
                                          Repeat Order
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 font-bold py-2">
                                No previous orders found for this customer phone.
                              </p>
                            )}
                          </div>

                          {/* 4. Bottom Action Bar */}
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => handleProceedToOrder(client)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
                            >
                              <ShoppingCart size={16} />
                              Proceed to Order with Customer #{client.clientNumber}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!searchQuery && clients.length === 0 && !loading && (
              <div className="glass p-12 rounded-2xl text-center space-y-2">
                <User size={32} className="text-gray-600 mx-auto" />
                <p className="text-base font-bold text-gray-400">No clients registered yet</p>
                <button
                  onClick={() => setTab('register')}
                  className="mt-2 text-xs font-black text-blue-400 hover:underline"
                >
                  Register your first customer &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DUPLICATE PHONE WARNING MODAL */}
      {duplicateModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border-2 border-amber-500/60 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-amber-950/50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-black text-white">Phone Number Already Registered</h3>
                <p className="text-xs text-gray-400 font-bold leading-relaxed">
                  A registered customer profile already matches phone number{' '}
                  <span className="text-amber-400 font-mono font-black">{duplicateModalData.matchedPhone}</span>.
                </p>
              </div>
            </div>

            {/* Existing Customer Profile Card */}
            {duplicateModalData.existingClient && (
              <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-base font-black text-white">{duplicateModalData.existingClient.name}</p>
                  <span className="px-2 py-0.5 rounded text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    Client #{duplicateModalData.existingClient.clientNumber || 'N/A'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-400">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Registered Branch:</span>
                    <span className="text-emerald-400">{duplicateModalData.existingClient.outletName || 'Outlet'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Primary Phone:</span>
                    <span className="text-blue-300 font-mono">{duplicateModalData.existingClient.phone}</span>
                  </div>
                  {duplicateModalData.existingClient.permanentAddress && (
                    <div className="col-span-2">
                      <span className="text-gray-500 block text-[10px] uppercase">Address:</span>
                      <span className="text-gray-300 line-clamp-1">{duplicateModalData.existingClient.permanentAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const existing = duplicateModalData.existingClient;
                  setDuplicateModalData(null);
                  handleEdit(existing);
                  toast.success(`Loaded existing customer #${existing.clientNumber}`);
                }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/30 transition-all cursor-pointer"
              >
                <User size={14} />
                View & Load Existing Customer Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setDuplicateModalData(null);
                  handleSubmit(null, { force: true });
                }}
                className="w-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShieldCheck size={14} />
                Register Anyway (Different Customer / Shared Family Phone)
              </button>

              <button
                type="button"
                onClick={() => setDuplicateModalData(null)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel & Edit Phone Number
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientRegistration;
