import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Truck, Loader2, RefreshCw, Check, X, Package, AlertTriangle, ExternalLink } from 'lucide-react';

const MODES = [
  { key: 'OFF', label: 'Off', color: 'bg-gray-600', desc: 'PostEx integration disabled. No API calls made.' },
  { key: 'TEST', label: 'Test Mode', color: 'bg-amber-600', desc: 'Sandbox mode. Shipments created with test data. No real PostEx API calls.' },
  { key: 'LIVE', label: 'Live', color: 'bg-emerald-600', desc: 'Production mode. Real PostEx API calls. Shipments created on PostEx system.' },
];

const PostExIntegrationPanel = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('OFF');
  const [apiKey, setApiKey] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [shipments, setShipments] = useState([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [returns, setReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [tab, setTab] = useState('config');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/postex/config');
      const c = res.data;
      setConfig(c);
      setMode(c.mode || 'OFF');
      setApiKey(c.credentials?.apiKey || '');
      setSenderName(c.credentials?.senderName || '');
      setSenderPhone(c.credentials?.senderPhone || '');
    } catch (err) {
      console.error('Failed to fetch PostEx config:', err);
    }
    setLoading(false);
  }, []);

  const fetchShipments = useCallback(async () => {
    setShipmentsLoading(true);
    try {
      const res = await api.get('/api/postex/all?limit=50');
      setShipments(res.data.shipments || []);
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
    }
    setShipmentsLoading(false);
  }, []);

  const fetchReturns = useCallback(async () => {
    setReturnsLoading(true);
    try {
      const res = await api.get('/api/postex/returns?limit=50');
      setReturns(res.data.cases || []);
    } catch (err) {
      console.error('Failed to fetch returns:', err);
    }
    setReturnsLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => {
    if (tab === 'shipments') fetchShipments();
    if (tab === 'returns') fetchReturns();
  }, [tab, fetchShipments, fetchReturns]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const credentials = {
        apiKey: apiKey.trim() || undefined,
        senderName: senderName.trim() || undefined,
        senderPhone: senderPhone.trim() || undefined,
      };
      const res = await api.put('/api/postex/config', { mode, credentials });
      setConfig(res.data);
      toast.success(`PostEx integration set to ${mode}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
    setSaving(false);
  };

  const getStatusBadge = (status) => {
    const map = {
      CREATED: 'bg-blue-600/20 text-blue-400 border-blue-600/50',
      BOOKED: 'bg-indigo-600/20 text-indigo-400 border-indigo-600/50',
      PICKED_UP: 'bg-amber-600/20 text-amber-400 border-amber-600/50',
      IN_TRANSIT: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/50',
      OUT_FOR_DELIVERY: 'bg-orange-600/20 text-orange-400 border-orange-600/50',
      DELIVERED: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/50',
      FAILED_DELIVERY: 'bg-red-600/20 text-red-400 border-red-600/50',
      RETURNED: 'bg-rose-600/20 text-rose-400 border-rose-600/50',
      RETURN_IN_TRANSIT: 'bg-rose-600/20 text-rose-400 border-rose-600/50',
      RETURN_RECEIVED: 'bg-rose-600/20 text-rose-400 border-rose-600/50',
      CANCELLED: 'bg-gray-600/20 text-gray-400 border-gray-600/50',
    };
    return map[status] || 'bg-gray-600/20 text-gray-400 border-gray-600/50';
  };

  const fmtDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-blue-400" size={32} />
    </div>
  );

  const currentMode = MODES.find(m => m.key === mode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Truck className="text-indigo-400" size={24} /> PostEx Courier Integration
          </h2>
          <p className="text-sm text-gray-400 mt-1">Manage PostEx API connection, shipments, and incoming returns.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${currentMode?.color || 'bg-gray-600'} text-white border-white/20`}>
          Mode: {currentMode?.label || mode}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 bg-gray-900 border-2 border-gray-700 rounded-xl p-1">
        {[
          { key: 'config', label: 'Configuration' },
          { key: 'shipments', label: 'Shipments' },
          { key: 'returns', label: 'Incoming Returns' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ CONFIG TAB ═══ */}
      {tab === 'config' && (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-black text-white mb-4">Integration Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODES.map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === m.key
                      ? 'border-indigo-500 bg-indigo-600/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${m.color}`} />
                    <span className="font-bold text-white text-sm">{m.label}</span>
                    {mode === m.key && <Check size={14} className="text-indigo-400 ml-auto" />}
                  </div>
                  <p className="text-xs text-gray-400">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Credentials (shown when not OFF) */}
          {mode !== 'OFF' && (
            <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white mb-4">
                {mode === 'TEST' ? 'Sandbox ' : 'Production '} Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">API Key</label>
                  <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                    type="password" placeholder={mode === 'TEST' ? 'Sandbox API key' : 'Production API key'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Sender Name</label>
                  <input value={senderName} onChange={e => setSenderName(e.target.value)}
                    placeholder="e.g. Enamels"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1 block">Sender Phone</label>
                  <input value={senderPhone} onChange={e => setSenderPhone(e.target.value)}
                    placeholder="e.g. 03001234567"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none" />
                </div>
              </div>
              {mode === 'LIVE' && (
                <div className="mt-4 p-3 bg-amber-600/10 border border-amber-600/30 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300">
                    <strong>Live mode active.</strong> Shipments will be created on the real PostEx system.
                    Orders dispatched with PostEx will be tracked via the PostEx API.
                    Ensure credentials are correct before saving.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Webhook info */}
          <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-black text-white mb-3">Webhook Configuration</h3>
            <p className="text-sm text-gray-400 mb-3">
              Configure this webhook URL in your PostEx merchant dashboard to receive real-time status updates.
            </p>
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <code className="text-sm text-indigo-400 font-mono flex-1 break-all">
                {window.location.origin}/api/postex/webhook
              </code>
              <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/api/postex/webhook'); toast.success('Webhook URL copied!'); }}
                className="text-gray-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Status updates (picked up, in transit, delivered, returned) will automatically update orders and create return cases.
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* ═══ SHIPMENTS TAB ═══ */}
      {tab === 'shipments' && (
        <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-white">PostEx Shipments</h3>
            <button onClick={fetchShipments} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {shipmentsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-400" size={24} /></div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No PostEx shipments yet. Shipments are created when dispatching orders via PostEx.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-700">
                    <th className="text-left py-2 px-2 font-bold">Order #</th>
                    <th className="text-left py-2 px-2 font-bold">Tracking #</th>
                    <th className="text-left py-2 px-2 font-bold">Customer</th>
                    <th className="text-left py-2 px-2 font-bold">Status</th>
                    <th className="text-left py-2 px-2 font-bold">Mode</th>
                    <th className="text-left py-2 px-2 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(s => (
                    <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-2 font-bold text-white">{s.order?.orderNumber || '-'}</td>
                      <td className="py-2 px-2 font-mono text-xs text-indigo-400">{s.trackingNumber || s.referenceNumber || '-'}</td>
                      <td className="py-2 px-2 text-gray-300">{s.customerName || '-'}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getStatusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-gray-400">{s.integrationMode || '-'}</td>
                      <td className="py-2 px-2 text-xs text-gray-400">{fmtDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ RETURNS TAB ═══ */}
      {tab === 'returns' && (
        <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-white">PostEx Incoming Returns</h3>
            <button onClick={fetchReturns} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            These are return cases automatically created when PostEx marks a shipment as returned.
            Process them from the Returns module (/returns).
          </p>
          {returnsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-400" size={24} /></div>
          ) : returns.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No incoming PostEx returns.</div>
          ) : (
            <div className="space-y-3">
              {returns.map(c => (
                <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-rose-400" />
                        <span className="font-bold text-white">{c.order?.orderNumber || c.orderId}</span>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          c.status === 'PENDING' ? 'bg-amber-600/20 text-amber-400 border-amber-600/50' :
                          c.status === 'ACCEPTED' ? 'bg-blue-600/20 text-blue-400 border-blue-600/50' :
                          'bg-emerald-600/20 text-emerald-400 border-emerald-600/50'
                        }`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{c.order?.customerName} — {c.order?.customerPhone}</p>
                      <p className="text-xs text-gray-500 mt-1">Reason: {c.returnReason || 'PostEx return'}</p>
                    </div>
                    <span className="text-xs text-gray-500">{fmtDate(c.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostExIntegrationPanel;
