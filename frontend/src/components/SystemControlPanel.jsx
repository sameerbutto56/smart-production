import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import {
  Shield,
  Check,
  X,
  History,
  RefreshCw,
  Search,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Layers,
  Clock,
  User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SectionOverlay } from './common/LoadingStates';
import { MODULES, FEATURES, ALL_PROFILES } from '../utils/featureRegistry';

const PROFILE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CEO: 'CEO',
  SOFTWARE_SETTINGS: 'Software Settings',
  OUTLET: 'Outlet / POS',
  STORE: 'Store & Warehouse',
  MARKETING: 'Marketing',
  ASM: 'ASM (Area Sales Manager)',
  PRODUCTION: 'Production',
  PRODUCTION_IN: 'Production In',
  PRODUCTION_OUT: 'Production Out',
  LOGO_DESIGN: 'Logo Design',
  DISPATCH: 'Dispatch',
  DELIVERY_BOY: 'Delivery Boy / Rider',
  INVENTORY_VIEW: 'Inventory View',
  ORDER_ENTRY: 'Order Entry',
  FAISAL: 'Faisal',
  EMPLOYEE: 'Employee',
};

export default function SystemControlPanel() {
  const [selectedProfile, setSelectedProfile] = useState('ADMIN');
  const [loading, setLoading] = useState(true);
  const [savingFeature, setSavingFeature] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [matrix, setMatrix] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch full system control matrix
  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/system-control/matrix');
      if (res.data?.matrix) {
        setMatrix(res.data.matrix);
      }
    } catch (err) {
      console.error('Failed to load system control matrix:', err);
      toast.error('Could not load permission matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Toggle individual permission
  const handleToggle = async (featureId, currentValue) => {
    const nextValue = !currentValue;
    setSavingFeature(featureId);

    // Optimistic UI update
    setMatrix(prev => ({
      ...prev,
      [selectedProfile]: {
        ...(prev[selectedProfile] || {}),
        [featureId]: nextValue
      }
    }));

    try {
      await api.put('/api/system-control/permission', {
        profile: selectedProfile,
        featureId,
        isEnabled: nextValue
      });
      toast.success(`${nextValue ? 'Enabled' : 'Disabled'} for ${PROFILE_LABELS[selectedProfile] || selectedProfile}`);
    } catch (err) {
      console.error('Failed to update permission:', err);
      toast.error('Failed to update permission');
      // Revert on error
      setMatrix(prev => ({
        ...prev,
        [selectedProfile]: {
          ...(prev[selectedProfile] || {}),
          [featureId]: currentValue
        }
      }));
    } finally {
      setSavingFeature(null);
    }
  };

  // Bulk toggle for a specific module
  const handleBulkToggleModule = async (moduleId, enable) => {
    const moduleFeatures = FEATURES.filter(f => f.module === moduleId);
    if (moduleFeatures.length === 0) return;

    setLoading(true);
    try {
      for (const feat of moduleFeatures) {
        await api.put('/api/system-control/permission', {
          profile: selectedProfile,
          featureId: feat.id,
          isEnabled: enable
        });
      }
      toast.success(`${enable ? 'Enabled' : 'Disabled'} all ${moduleId} features for ${PROFILE_LABELS[selectedProfile]}`);
      await fetchMatrix();
    } catch (e) {
      toast.error('Bulk update encountered an error');
      fetchMatrix();
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    setShowAuditModal(true);
    try {
      const res = await api.get('/api/system-control/audit-logs', {
        params: { profile: selectedProfile, limit: 100 }
      });
      setAuditLogs(res.data?.logs || []);
    } catch (e) {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  const profilePermissions = matrix[selectedProfile] || {};

  // Group features by module
  const groupedFeatures = useMemo(() => {
    const groups = {};
    MODULES.forEach(m => {
      groups[m.id] = [];
    });

    FEATURES.forEach(f => {
      if (selectedModule !== 'ALL' && f.module !== selectedModule) return;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesDesc = f.description.toLowerCase().includes(q);
        const matchesId = f.id.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesId) return;
      }
      if (groups[f.module]) {
        groups[f.module].push(f);
      }
    });

    return groups;
  }, [selectedModule, search]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Profile Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-3xl bg-gray-900 border border-gray-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">System Control & Feature Permissions</h2>
            <p className="text-xs text-gray-400 font-bold mt-0.5">
              Centrally enable or disable system features, menu items, actions, and API access per profile
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Profile Dropdown */}
          <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 p-1.5 rounded-2xl">
            <UserCheck size={16} className="text-blue-400 ml-2" />
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="bg-transparent text-white font-black text-sm px-2 py-1 outline-none cursor-pointer"
            >
              {ALL_PROFILES.map(p => (
                <option key={p} value={p} className="bg-gray-900 text-white font-bold">
                  {PROFILE_LABELS[p] || p} ({p})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchAuditLogs}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold transition-all border border-gray-700"
            title="View permission changes audit trail"
          >
            <History size={15} />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700"
            title="Refresh matrix"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gray-950 border border-gray-800/80">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search functionalities or permissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setSelectedModule('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedModule === 'ALL' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
            >
              All Modules
            </button>
            {MODULES.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModule(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedModule === m.id ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-400 font-bold px-2">
          Targeting Profile: <span className="text-blue-400 font-black">{PROFILE_LABELS[selectedProfile] || selectedProfile}</span>
        </div>
      </div>

      <SectionOverlay isUpdating={loading} updatingText="Updating system control permissions...">
        {/* Module Groups */}
        <div className="space-y-6">
          {MODULES.map(mod => {
            const features = groupedFeatures[mod.id] || [];
            if (features.length === 0) return null;

            const enabledCount = features.filter(f => profilePermissions[f.id] !== false).length;

            return (
              <div key={mod.id} className="bg-gray-900 border border-gray-800 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center text-blue-400 font-black text-xs">
                      <Layers size={16} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">{mod.name}</h3>
                      <p className="text-[11px] text-gray-400 font-bold">
                        {enabledCount} of {features.length} features active for {PROFILE_LABELS[selectedProfile]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBulkToggleModule(mod.id, true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/40 text-[11px] font-bold transition-all"
                    >
                      Enable All
                    </button>
                    <button
                      onClick={() => handleBulkToggleModule(mod.id, false)}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 text-[11px] font-bold transition-all"
                    >
                      Disable All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {features.map(feat => {
                    const isEnabled = profilePermissions[feat.id] !== false;
                    const isSaving = savingFeature === feat.id;

                    return (
                      <div
                        key={feat.id}
                        className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${isEnabled ? 'bg-gray-950/80 border-gray-800 hover:border-blue-500/40' : 'bg-gray-950/40 border-gray-800/50 opacity-70'}`}
                      >
                        <div className="space-y-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{feat.name}</span>
                            <span className="text-[9px] font-mono font-bold text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded">
                              {feat.id}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed font-medium">
                            {feat.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggle(feat.id, isEnabled)}
                          disabled={isSaving}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEnabled ? 'bg-blue-600' : 'bg-gray-800'}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionOverlay>

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-400" />
                <h3 className="text-base font-black text-white">System Control Audit History</h3>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-gray-500 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {auditLoading ? (
                <div className="py-12 flex justify-center text-blue-400">
                  <RefreshCw className="animate-spin" size={24} />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center text-gray-500 font-bold py-12">
                  No permission changes recorded yet
                </p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-gray-950 border border-gray-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{PROFILE_LABELS[log.profile] || log.profile}</span>
                        <span className="text-gray-500">•</span>
                        <span className="font-bold text-cyan-400">{log.featureId}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Changed by <span className="text-gray-300 font-bold">{log.changedByName}</span> on {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-black">
                      <span className={`px-2 py-0.5 rounded ${log.previousValue ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                        {log.previousValue ? 'ON' : 'OFF'}
                      </span>
                      <span className="text-gray-600">→</span>
                      <span className={`px-2 py-0.5 rounded ${log.newValue ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                        {log.newValue ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
