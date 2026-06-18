import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, BarChart3, TrendingUp, Loader2, Save, Gauge, Target, Users, Palette, Check, KeyRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const STAGES = ['STORE', 'LOGO_DESIGN', 'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'DISPATCH', 'OUT_FOR_DELIVERY'];

const AdminSettings = () => {
  const { themeId, currentTheme, changeTheme, setGlobalThemeId, THEMES, isUsingPersonal } = useTheme();
  const [deadlineConfig, setDeadlineConfig] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('deadlines');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchPerformance();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await axios.get(`${API_URL}/api/admin/deadline-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeadlineConfig(res.data);
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

  const saveDeadlineConfig = async () => {
    setSaving(true);
    setMessage('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/deadline-config`,
        { stageDurations: deadlineConfig.stageDurations, slaMultipliers: deadlineConfig.slaMultipliers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('Deadline configuration saved.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save.');
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!selectedUserId || !newPassword || !adminPassword) {
      setPasswordMsg('All fields required');
      return;
    }
    setPasswordChanging(true);
    setPasswordMsg('');
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/change-password`,
        { userId: selectedUserId, newPassword, adminPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPasswordMsg('Password changed successfully');
      setNewPassword('');
      setAdminPassword('');
      setSelectedUserId('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch (err) {
      setPasswordMsg(err.response?.data?.message || 'Failed to change password');
    }
    setPasswordChanging(false);
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
    return <PageLoader text="Loading Settings..." />;
  }

  return (
    <section className="mb-6 md:mb-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-2xl">
          <Gauge className="text-indigo-400" size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Settings</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Configure stage timelines, priority multipliers, themes, and view performance</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {sectionBtn('deadlines', 'Deadline Config', <Clock size={14} />)}
        {sectionBtn('themes', 'Themes', <Palette size={14} />)}
        {sectionBtn('performance', 'Performance', <BarChart3 size={14} />)}
        {sectionBtn('passwords', 'Passwords', <KeyRound size={14} />)}
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
          {message}
        </div>
      )}

      {/* Unified Deadline Config */}
      {activeSection === 'deadlines' && deadlineConfig && (
        <div className="glass rounded-xl md:rounded-[2rem] border border-gray-800 p-4 md:p-6 space-y-4 md:space-y-8">
          {/* Stage Durations */}
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock size={16} className="text-blue-400" /> Stage Durations (hours)
            </h3>
            <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Default completion time per pipeline stage. SLA multipliers shrink these for priority orders.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {STAGES.map(stage => (
                <div key={stage} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                  <label className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">
                    {stage.replace(/_/g, ' ')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={deadlineConfig.stageDurations[stage] || ''}
                      onChange={(e) => setDeadlineConfig({
                        ...deadlineConfig,
                        stageDurations: { ...deadlineConfig.stageDurations, [stage]: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 focus:border-indigo-500 outline-none font-black text-lg text-white"
                    />
                    <span className="text-gray-500 text-xs font-black">hrs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLA Multipliers */}
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Target size={16} className="text-amber-400" /> SLA Priority Multipliers
            </h3>
            <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-4">How much of the stage duration is allocated per priority level (1 = full time, 0.5 = half time)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'NORMAL', label: 'Normal', color: 'bg-blue-500' },
                { key: 'URGENT', label: 'Urgent', color: 'bg-amber-500' },
                { key: 'SUPER_URGENT', label: 'Super Urgent', color: 'bg-red-500 animate-pulse' }
              ].map(p => (
                <div key={p.key} className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                    <label className="text-xs font-black uppercase tracking-wider" style={{ color: p.key === 'URGENT' ? '#fbbf24' : p.key === 'SUPER_URGENT' ? '#f87171' : '#60a5fa' }}>
                      {p.label}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={deadlineConfig.slaMultipliers[p.key]}
                      onChange={(e) => setDeadlineConfig({
                        ...deadlineConfig,
                        slaMultipliers: { ...deadlineConfig.slaMultipliers, [p.key]: parseFloat(e.target.value) || 1 }
                      })}
                      className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-2 px-3 outline-none font-black text-lg text-white"
                      style={{ borderColor: p.key === 'URGENT' ? '#f59e0b40' : p.key === 'SUPER_URGENT' ? '#ef444440' : '#3b82f640' }}
                    />
                    <span className="text-gray-500 text-xs font-black">x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={saveDeadlineConfig}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:bg-indigo-500 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Deadline Config
          </button>
        </div>
      )}

      {/* Themes */}
      {activeSection === 'themes' && (
        <div className="glass rounded-xl md:rounded-[2rem] border border-gray-800 p-4 md:p-6 space-y-4">
          <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-2">Choose a global theme for the entire system — applies to all users by default. Individual users can override in their personal settings.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(THEMES).map(([id, theme]) => {
              const isActive = themeId === id && !isUsingPersonal;
              const lightThemes = ['clinical', 'boutique', 'coral', 'lavender', 'slate'];
              const previewBg = lightThemes.includes(id) ? theme.colors.background : '#030712';
              const previewAccent = theme.colors.primary;
              const previewText = lightThemes.includes(id) ? theme.colors['text-primary'] : '#fafafa';
              return (
                <motion.button
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setGlobalThemeId(id)}
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
                  <p className="text-xs md:text-sm" style={{ color: lightThemes.includes(id) ? theme.colors['text-secondary'] : '#a1a1aa' }}>{theme.description}</p>
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
              <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>{currentTheme.description} {currentTheme.nameUrdu && `· ${currentTheme.nameUrdu}`}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Analytics */}
      {activeSection === 'performance' && (
        <div className="space-y-4">
          {performance ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-1">Total Orders</p>
                  <p className="text-2xl md:text-4xl font-black text-white">{performance.totalOrders}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-1">Urgent</p>
                  <p className="text-2xl md:text-4xl font-black text-amber-400">{performance.urgentOrders || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-1">Super Urgent</p>
                  <p className="text-2xl md:text-4xl font-black text-red-400">{performance.superUrgentOrders || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-1">SLA On-Time</p>
                  <p className="text-2xl md:text-4xl font-black text-emerald-400">{performance.slaOnTime || 100}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle size={18} className="text-red-400" />
                    <p className="text-xs font-black text-red-400 uppercase tracking-wider">Delayed Stages</p>
                  </div>
                  <p className="text-3xl md:text-5xl font-black text-white">{performance.delayedCount || 0}</p>
                </div>
                <div className="glass rounded-[1.5rem] border border-gray-800 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 size={18} className="text-emerald-400" />
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">On-Time Stages</p>
                  </div>
                  <p className="text-3xl md:text-5xl font-black text-white">{performance.onTimeCount || 0}</p>
                </div>
              </div>

              {performance.avgCompletionTime && Object.keys(performance.avgCompletionTime).length > 0 && (
                <div className="glass rounded-xl md:rounded-[2rem] border border-gray-800 p-4 md:p-6">
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

              {performance.bottleneckStages && performance.bottleneckStages.length > 0 && (
                <div className="glass rounded-xl md:rounded-[2rem] border border-red-500/20 p-4 md:p-6">
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

              {performance.overdueStages && performance.overdueStages.length > 0 && (
                <div className="glass rounded-xl md:rounded-[2rem] border border-red-500/30 p-4 md:p-6">
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
                          <span className="text-xs md:text-sm text-gray-500">{o.customerName}</span>
                        </div>
                        <span className="text-xs md:text-sm font-black text-red-400">{o.stageName.replace(/_/g, ' ')}</span>
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
            <div className="glass rounded-xl md:rounded-[2rem] border border-gray-800 p-4 md:p-16 text-center">
              <BarChart3 className="mx-auto text-gray-700 mb-4" size={48} />
              <p className="text-gray-500 font-black uppercase">No analytics data available yet.</p>
              <p className="text-gray-600 text-xs font-bold mt-2">Complete some orders to see performance metrics.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'passwords' && (
        <div className="glass rounded-xl md:rounded-[2rem] border border-gray-800 p-4 md:p-6 space-y-6">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <KeyRound size={16} className="text-purple-400" /> Change Account Password
          </h3>
          <p className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest">Select a user and set a new password</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">Select User</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-indigo-500 outline-none font-medium text-white"
              >
                <option value="">— Choose a user —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-indigo-500 outline-none font-medium text-white"
              />
            </div>

            <div>
              <label className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest mb-2 block">Your Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter your own password to confirm"
                className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl py-3 px-4 focus:border-indigo-500 outline-none font-medium text-white"
              />
            </div>

            {passwordMsg && (
              <div className={`px-4 py-3 rounded-xl text-xs font-bold ${
                passwordMsg.includes('success') ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {passwordMsg}
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={passwordChanging}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white border border-gray-700 hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {passwordChanging ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {passwordChanging ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSettings;