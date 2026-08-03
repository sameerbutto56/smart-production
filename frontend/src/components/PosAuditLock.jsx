import React, { useState, useEffect, useCallback } from 'react';
import { Lock, RefreshCw, ClipboardCheck } from 'lucide-react';
import api from '../services/api';
import socket from '../socket';

// Gates a POS page while the branch has an inventory audit awaiting an Admin
// decision (status = SUBMITTED). The POS auto-unlocks when the Admin approves
// or rejects the audit — no manual intervention required.
const PosAuditLock = ({ type = 'OUTLET', outletName = null, children }) => {
  const [status, setStatus] = useState({ loading: true, locked: false, pending: null, error: null });

  const check = useCallback(async () => {
    try {
      const params = { type };
      if (type === 'OUTLET' && outletName) params.outletName = outletName;
      const res = await api.get('/api/audit/pos-lock', { params });
      setStatus({ loading: false, locked: !!res.data?.locked, pending: res.data?.pending || null, error: null });
    } catch (e) {
      // If the lock check itself fails, do not block the POS — fail open so a
      // transient network error never takes the branch down. The backend
      // createSale/return 423 guard remains the authoritative enforcement.
      setStatus({ loading: false, locked: false, pending: null, error: e.message });
    }
  }, [type, outletName]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) check(); };
    const onFocus = () => check();
    const timer = setInterval(check, 30000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    socket.on('audit-updated', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      socket.off('audit-updated', check);
    };
  }, [check]);

  if (status.loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm font-bold">Checking audit status…</span>
        </div>
      </div>
    );
  }

  if (status.locked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="mx-auto w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6 border-2 border-red-700/50">
            <Lock size={40} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black mb-2">POS Temporarily Locked</h2>
          <p className="text-sm text-gray-400 mb-4">
            Inventory audit approval is pending. The POS is temporarily locked until the audit is approved or rejected by the Admin.
          </p>
          <div className="inline-flex items-center gap-2 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-2 mb-4">
            <ClipboardCheck size={16} className="text-amber-400" />
            <span className="text-xs font-black text-amber-300">
              Audit {status.pending?.auditNumber || ''}
              {status.pending?.outletName ? ` • ${status.pending.outletName}` : ''}
              {status.pending?.type === 'WAREHOUSE' ? ' • Warehouse' : ''}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mb-6">
            The POS will unlock automatically as soon as the Admin approves or rejects the audit.
          </p>
          <button onClick={check}
            className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-black text-sm flex items-center gap-2 mx-auto transition-all active:scale-95">
            <RefreshCw size={16} /> Check Again
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default PosAuditLock;
