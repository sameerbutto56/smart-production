import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Hash, Save, Loader2, RefreshCw, Check, AlertTriangle } from 'lucide-react';

const OrderRangePanel = () => {
  const [config, setConfig] = useState({ enabled: false, startNumber: '', endNumber: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/software-settings/order-range');
      setConfig(res.data);
    } catch (err) {
      console.error('Failed to fetch order range config', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/api/software-settings/order-range', config);
      setConfig(res.data.config);
      toast.success('Order range configuration saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
    setSaving(false);
  };

  const rangeSize = config.enabled && config.startNumber && config.endNumber
    ? (parseInt(config.endNumber, 10) - parseInt(config.startNumber, 10) + 1)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Hash className="text-blue-400" size={24} />
            <div>
              <h2 className="text-lg font-black text-white">Order Range Selector</h2>
              <p className="text-sm text-gray-400 mt-1">Control which order numbers are allowed for new orders in Faisal Order Entry.</p>
            </div>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
            className={`relative w-14 h-7 rounded-full transition-colors ${config.enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? 'left-8' : 'left-1'}`} />
          </button>
        </div>

        <div className={`p-4 rounded-xl border-2 transition-colors ${config.enabled ? 'border-blue-600/40 bg-blue-600/5' : 'border-gray-700 bg-gray-800/30'}`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-blue-500' : 'bg-gray-500'}`} />
            <span className="text-sm font-bold text-white">
              {config.enabled ? 'Range Active — New orders restricted to configured range' : 'Range Disabled — All order numbers allowed'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Starting Order Number</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 50000"
                value={config.startNumber}
                disabled={!config.enabled}
                onChange={e => setConfig(c => ({ ...c, startNumber: e.target.value.replace(/[^\d]/g, '') }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-blue-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Ending Order Number</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 60000"
                value={config.endNumber}
                disabled={!config.enabled}
                onChange={e => setConfig(c => ({ ...c, endNumber: e.target.value.replace(/[^\d]/g, '') }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:border-blue-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed" />
            </div>
          </div>

          {config.enabled && config.startNumber && config.endNumber && (
            <div className="mt-4 p-3 rounded-xl bg-blue-600/10 border border-blue-600/30">
              <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
                <Check size={14} />
                <span>Allowed range: <span className="text-white">{config.startNumber}</span> to <span className="text-white">{config.endNumber}</span> ({rangeSize.toLocaleString()} possible order numbers)</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Existing orders outside this range remain fully accessible. Only new order creation is restricted.</p>
            </div>
          )}

          {config.enabled && (!config.startNumber || !config.endNumber) && (
            <div className="mt-4 p-3 rounded-xl bg-amber-600/10 border border-amber-600/30">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                <AlertTriangle size={14} />
                <span>Both start and end numbers are required when range is enabled.</span>
              </div>
            </div>
          )}

          {!config.enabled && (
            <div className="mt-4 p-3 rounded-xl bg-gray-700/30 border border-gray-600/30">
              <p className="text-xs text-gray-400">When disabled, any order number can be created. Toggle the switch above to enable range restriction.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4 gap-3">
          <button onClick={fetchConfig}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving || (config.enabled && (!config.startNumber || !config.endNumber))}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderRangePanel;
