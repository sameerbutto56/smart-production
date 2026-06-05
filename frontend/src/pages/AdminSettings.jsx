import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, BarChart3, TrendingUp, Loader2, Save, Gauge, Target, Users, Palette, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const STAGES = ['ORDER_ENTRY', 'STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY', 'FAISAL_APPROVAL'];

const AdminSettings = () => {
  const { themeId, currentTheme, changeTheme, THEMES } = useTheme();
  const [durations, setDurations] = useState({});
  const [sla, setSla] = useState({ urgentMultiplier: 0.75, superUrgentMultiplier: 0.5 });
  const [profileDeadlines, setProfileDeadlines] = useState({});
  const [performance, setPerformance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('durations');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    fetchPerformance();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/stage-durations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDurations(res.data.durations);
      setSla(res.data.sla);
      setProfileDeadlines(res.data.profileDeadlines);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/performance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPerformance(res.data);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    }
  };

  const saveDurations = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/stage-durations`,
        { durations },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('Stage durations saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save durations.');
    }
    setSaving(false);
  };

  const saveSLA = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/sla-config`,
        sla,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('SLA configuration saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save SLA.');
    }
    setSaving(false);
  };

  const saveProfileDeadlines = async () => {
    setSavingProfile(true);
    setMessage('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/profile-deadlines`,
        { profileDeadlines },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('Profile deadlines saved successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save profile deadlines.');
    }
    setSavingProfile(false);
  };

  const sectionBtn = (id, label, icon) => (
    <button
      onClick={() => setActiveSection(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        activeSection === id ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 border border-gray-800'
      }`}
      style={activeSection === id ? { background: 'var(--primary)', boxShadow: '0 4px 15px var(--primary-glow)' } : { background: 'var(--card-bg-solid)' }}
    >
      {icon} {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <section className="mb-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-2xl">
          <Gauge className="text-indigo-400" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Settings</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Configure stage timelines, priority multipliers, themes, and view performance</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {sectionBtn('durations', 'Stage Durations', <Clock size={14} />)}
        {sectionBtn('profiles', 'Profile Deadlines', <Users size={14} />)}
        {sectionBtn('sla', 'SLA Config', <Target size={14} />)}
        {sectionBtn('themes', 'Themes', <Palette size={14} />)}
        {sectionBtn('performance', 'Performance', <BarChart3 size={14} />)}
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
          {message}
        </div>
      )}

      {/* Stage Durations */}
      {activeSection === 'durations' && (
        <div className="glass rounded-[2rem] border border-gray-800 p-6 space-y-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Set expected completion time (hours) per workflow stage</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STAGES.map(stage => (
              <div key={stage} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  {stage.replace(/_/g, ' ')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={durations[stage] || ''}
                    onChange={(e) => setDurations({ ...durations, [stage]: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 focus:border-indigo-500 outline-none font-black text-lg text-white"
                  />
                  <span className="text-gray-500 text-xs font-black">hrs</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveDurations}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Durations
          </button>
        </div>
      )}

      {/* Profile Deadlines */}
      {activeSection === 'profiles' && (
        <div className="glass rounded-[2rem] border border-gray-800 p-6 space-y-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Set deadline hours per user profile/role. Affects per-stage deadline calculation for each role's assigned work.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(profileDeadlines).map(([role, hours]) => (
              <div key={role} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  {role.replace(/_/g, ' ')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={profileDeadlines[role] || 0}
                    onChange={(e) => setProfileDeadlines({ ...profileDeadlines, [role]: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 focus:border-indigo-500 outline-none font-black text-lg text-white"
                  />
                  <span className="text-gray-500 text-xs font-black">hrs</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveProfileDeadlines}
            disabled={savingProfile}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Profile Deadlines
          </button>
        </div>
      )}

      {/* SLA Config */}
      {activeSection === 'sla' && (
        <div className="glass rounded-[2rem] border border-gray-800 p-6 space-y-6">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
            Configure how much of the normal duration is allocated for priority orders (multiplier)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full" />
                <label className="text-sm font-black text-amber-400 uppercase tracking-wider">Urgent Multiplier</label>
              </div>
              <p className="text-[10px] text-gray-500 font-bold mb-4">e.g., 0.75 means Urgent orders get 75% of the normal stage time</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={sla.urgentMultiplier}
                  onChange={(e) => setSla({ ...sla, urgentMultiplier: parseFloat(e.target.value) || 0.75 })}
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-amber-500 outline-none font-black text-2xl text-white"
                />
                <span className="text-gray-500 text-xs font-black">x</span>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <label className="text-sm font-black text-red-400 uppercase tracking-wider">Super Urgent Multiplier</label>
              </div>
              <p className="text-[10px] text-gray-500 font-bold mb-4">e.g., 0.50 means Super Urgent orders get 50% of the normal stage time</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={sla.superUrgentMultiplier}
                  onChange={(e) => setSla({ ...sla, superUrgentMultiplier: parseFloat(e.target.value) || 0.5 })}
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-red-500 outline-none font-black text-2xl text-white"
                />
                <span className="text-gray-500 text-xs font-black">x</span>
              </div>
            </div>
          </div>
          <button
            onClick={saveSLA}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save SLA Config
          </button>
        </div>
      )}

      {/* Themes */}
      {activeSection === 'themes' && (
        <div className="glass rounded-[2rem] border border-gray-800 p-6 space-y-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Choose a theme for the entire application — applies to all users and profiles instantly</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(THEMES).map(([id, theme]) => {
              const isActive = themeId === id;
              const previewBg = id === 'clinical' ? '#f0f9ff' : id === 'couture' ? '#09090b' : id === 'boutique' ? '#fef2f2' : '#030712';
              const previewAccent = theme.colors.primary;
              const previewText = id === 'clinical' || id === 'boutique' ? '#0c4a6e' : '#fafafa';
              return (
                <motion.button
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => changeTheme(id)}
                  className={`relative rounded-2xl p-5 text-left transition-all border-2 ${
                    isActive ? 'shadow-lg' : 'border-gray-800 hover:border-gray-600'
                  }`}
                  style={{ background: previewBg, borderColor: isActive ? 'var(--primary)' : undefined, boxShadow: isActive ? '0 10px 25px var(--primary-glow)' : undefined }}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: previewAccent }}>
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <span className="text-2xl mb-2 block">{theme.icon}</span>
                  <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: previewText }}>{theme.name}</p>
                  <p className="text-[10px]" style={{ color: id === 'clinical' || id === 'boutique' ? '#64748b' : '#a1a1aa' }}>{theme.description}</p>
                  <div className="flex gap-1 mt-3">
                    <div className="w-4 h-4 rounded-full" style={{ background: theme.colors.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: theme.colors.secondary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: theme.colors.background }} />
                  </div>
                </motion.button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--badge-bg)', border: '1px solid var(--glass-border)' }}>
            <Palette size={16} style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--section-title)' }}>Active Theme: {currentTheme.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{currentTheme.description} {currentTheme.nameUrdu && `· ${currentTheme.nameUrdu}`}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Analytics */}
      {activeSection === 'performance' && (
        <div className="space-y-4">
          {performance ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Orders</p>
                  <p className="text-4xl font-black text-white">{performance.totalOrders}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Urgent</p>
                  <p className="text-4xl font-black text-amber-400">{performance.urgentOrders || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Super Urgent</p>
                  <p className="text-4xl font-black text-red-400">{performance.superUrgentOrders || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">SLA On-Time</p>
                  <p className="text-4xl font-black text-emerald-400">{performance.slaOnTime || 100}%</p>
                </div>
              </div>

              {/* Delayed & Overdue Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle size={18} className="text-red-400" />
                    <p className="text-xs font-black text-red-400 uppercase tracking-wider">Delayed Stages</p>
                  </div>
                  <p className="text-5xl font-black text-white">{performance.delayedCount || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">On-Time Stages</p>
                  </div>
                  <p className="text-5xl font-black text-white">{performance.onTimeCount || 0}</p>
                </div>
              </div>

              {/* Average Completion Time per Stage */}
              {performance.avgCompletionTime && Object.keys(performance.avgCompletionTime).length > 0 && (
                <div className="glass rounded-[2rem] border border-gray-800 p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-blue-400" /> Average Completion Time Per Stage
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(performance.avgCompletionTime).map(([stage, hours]) => (
                      <div key={stage} className="flex items-center justify-between bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800">
                        <span className="text-xs font-black text-gray-300 uppercase tracking-wider">{stage.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-black text-white">{Math.round(hours * 10) / 10} hrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottleneck Stages */}
              {performance.bottleneckStages && performance.bottleneckStages.length > 0 && (
                <div className="glass rounded-[2rem] border border-red-500/20 p-6">
                  <h3 className="text-sm font-black text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} /> Bottleneck Stages
                  </h3>
                  <div className="space-y-3">
                    {performance.bottleneckStages.map((b, i) => (
                      <div key={i} className="flex items-center justify-between bg-red-500/5 rounded-xl px-4 py-3 border border-red-500/20">
                        <span className="text-xs font-black text-red-300 uppercase tracking-wider">{b.stage.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-black text-red-400">{b.avgHours} hrs avg ({b.count} stages)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overdue Critical Stages */}
              {performance.overdueStages && performance.overdueStages.length > 0 && (
                <div className="glass rounded-[2rem] border border-red-500/30 p-6">
                  <h3 className="text-sm font-black text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} /> Critical Overdue Orders
                  </h3>
                  <div className="space-y-2">
                    {performance.overdueStages.map((o, i) => (
                      <div key={i} className="flex items-center justify-between bg-red-500/5 rounded-xl px-4 py-2 border border-red-500/10">
                        <div className="flex items-center gap-3">
                          {o.priority === 'SUPER_URGENT' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                          {o.priority === 'URGENT' && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
                          <span className="text-xs font-black text-gray-300">#{o.orderNumber}</span>
                          <span className="text-[10px] text-gray-500">{o.customerName}</span>
                        </div>
                        <span className="text-[10px] font-black text-red-400">{o.stageName.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={fetchPerformance}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-gray-400 rounded-xl text-xs font-black hover:text-white transition-all border border-gray-800"
              >
                <TrendingUp size={14} /> Refresh Analytics
              </button>
            </>
          ) : (
            <div className="glass rounded-[2rem] border border-gray-800 p-16 text-center">
              <BarChart3 className="mx-auto text-gray-700 mb-4" size={48} />
              <p className="text-gray-500 font-black uppercase">No analytics data available yet.</p>
              <p className="text-gray-600 text-xs font-bold mt-2">Complete some orders to see performance metrics.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminSettings;
