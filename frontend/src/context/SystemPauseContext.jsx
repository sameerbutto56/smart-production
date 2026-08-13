import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import socket from '../socket';

const SystemPauseContext = createContext(null);

export const useSystemPause = () => {
  const ctx = useContext(SystemPauseContext);
  if (!ctx) throw new Error('useSystemPause must be used within SystemPauseProvider');
  return ctx;
};

// Profile-level system pause state shared across every profile. Polls /api/system/state
// (30s + window focus) and listens for socket broadcast events. `periods` is the pause
// interval history used by the delay helpers to freeze timers; `affected` tells whether
// THIS profile is paused (banner / timer freeze) and `profiles` is the selected set.
export const SystemPauseProvider = ({ children }) => {
  const [state, setState] = useState({ paused: false, info: null, periods: [], affected: false, profiles: [], profileDefs: [], myProfile: null });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/api/system/state');
      setState({
        paused: !!res.data?.paused,
        info: res.data?.info || null,
        periods: res.data?.periods || [],
        affected: !!res.data?.affected,
        profiles: res.data?.profiles || [],
        profileDefs: res.data?.profileDefs || [],
        myProfile: res.data?.myProfile || null,
      });
    } catch { /* keep last known state */ }
    setLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/system/history');
      setHistory(res.data?.history || []);
    } catch { /* non-admin roles get 403 — ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    socket.on('system-paused', refresh);
    socket.on('system-resumed', refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      socket.off('system-paused', refresh);
      socket.off('system-resumed', refresh);
    };
  }, [refresh]);

  const setPaused = useCallback(async (action, password) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    try {
      const res = await api.post(`/api/system/${action}`, { password });
      setState((prev) => ({
        ...prev,
        paused: action === 'pause',
        info: res.data?.info || (action === 'pause' ? prev.info : null),
        periods: res.data?.periods || prev.periods || [],
        profiles: res.data?.profiles || prev.profiles || [],
        affected: action === 'pause' ? true : false,
      }));
      fetchHistory();
      return res.data;
    } finally {
      busyRef.current = false;
    }
  }, [fetchHistory]);

  const pause = useCallback((password) => setPaused('pause', password), [setPaused]);
  const resume = useCallback((password) => setPaused('resume', password), [setPaused]);

  // Save which profiles the pause applies to (Software Settings / Admin).
  const saveProfiles = useCallback(async (profiles) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    try {
      const res = await api.put('/api/system/pause-profiles', { profiles });
      if (res.data?.saved) setState((prev) => ({ ...prev, profiles: res.data?.profiles || prev.profiles }));
      return res.data;
    } finally {
      busyRef.current = false;
    }
  }, []);

  return (
    <SystemPauseContext.Provider value={{ ...state, history, loading, refresh, fetchHistory, pause, resume, saveProfiles }}>
      {children}
    </SystemPauseContext.Provider>
  );
};
