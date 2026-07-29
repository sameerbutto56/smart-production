import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { /* audio not available */ }
}

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef(null);
  const prevCountsRef = useRef({});
  const notifSoundCooldown = useRef(0);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user?.role) return;
    try {
      const res = await api.get('/api/notifications/unread-counts');
      const counts = res.data.counts || {};
      const prev = prevCountsRef.current;

      // Detect new notifications via delta comparison
      const now = Date.now();
      let totalBefore = Object.values(prev).reduce((a, b) => a + b, 0);
      let totalAfter = Object.values(counts).reduce((a, b) => a + b, 0);
      for (const [path, count] of Object.entries(counts)) {
        const prevCount = prev[path] || 0;
        if (count > prevCount && now - notifSoundCooldown.current > 5000) {
          playNotificationSound();
          notifSoundCooldown.current = now;
          break;
        }
      }

      if (totalAfter !== totalBefore) {
        console.log('[Notif] delta:', totalBefore, '→', totalAfter, counts);
      }

      prevCountsRef.current = counts;
      setUnreadCounts(counts);
    } catch (e) { console.warn('[Notif] fetchCounts error:', e?.message || e); }
  }, [user?.role]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.role) return;
    setLoading(true);
    try {
      const res = await api.get('/api/notifications?limit=50');
      setNotifications(res.data.notifications || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  }, [user?.role]);

  const markModuleRead = useCallback(async (path) => {
    if (!user?.role) return;
    try {
      await api.put('/api/notifications/mark-read', { path: path || undefined });
      if (path) {
        setUnreadCounts(prev => {
          const next = { ...prev, [path]: 0 };
          prevCountsRef.current = next;
          return next;
        });
      } else {
        setUnreadCounts({});
        prevCountsRef.current = {};
      }
    } catch (e) { /* silent */ }
  }, [user?.role]);

  // Socket listener for real-time notifications (optimization — fires instantly when socket works)
  useEffect(() => {
    if (!user?.role) return;

    const handleNewNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      const path = data.path;
      if (!path) return;

      setUnreadCounts(prev => {
        const next = { ...prev, [path]: (prev[path] || 0) + 1 };
        prevCountsRef.current = next;
        return next;
      });

      playNotificationSound();
    };

    const handleReadNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      if (data.counts) {
        prevCountsRef.current = data.counts;
        setUnreadCounts(data.counts);
      }
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleReadNotification);

    fetchUnreadCounts();

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleReadNotification);
    };
  }, [user, fetchUnreadCounts]);

  // Core polling — 3s interval for near-real-time badge/sound on all environments (Vercel/localhost)
  useEffect(() => {
    if (!user?.role) return;

    console.log('[Notif] Polling started for', user.role, '(15s interval)');
    const poll = () => { fetchUnreadCounts(); };

    poll();
    pollingRef.current = setInterval(poll, 15000);
    return () => {
      console.log('[Notif] Polling stopped for', user.role);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [user?.role, fetchUnreadCounts]);

  // Tab focus handler — fetch immediately when user returns to the tab
  useEffect(() => {
    if (!user?.role) return;
    const onFocus = () => { fetchUnreadCounts(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.role, fetchUnreadCounts]);

  const value = {
    unreadCounts,
    notifications,
    loading,
    markModuleRead,
    fetchNotifications,
    fetchUnreadCounts
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
