import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import api from '../services/api';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

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
  const notifQueueRef = useRef([]);
  const queueTimerRef = useRef(null);
  const bellNotifCallbackRef = useRef(null);

  // Allow Layout to register a callback for real-time bell updates
  const setBellNotifCallback = useCallback((cb) => {
    bellNotifCallbackRef.current = cb;
  }, []);

  // Batched update: coalesce rapid events into a single setState
  const queueIncrement = useCallback((path, data) => {
    notifQueueRef.current.push({ path, data });
    if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    queueTimerRef.current = setTimeout(() => {
      const batch = [...notifQueueRef.current];
      notifQueueRef.current = [];
      setUnreadCounts(prev => {
        const next = { ...prev };
        for (const item of batch) {
          next[item.path] = (next[item.path] || 0) + 1;
        }
        prevCountsRef.current = next;
        return next;
      });
      // Forward to bell callback if registered
      if (bellNotifCallbackRef.current) {
        for (const item of batch) {
          bellNotifCallbackRef.current(item.data);
        }
      }
      // Show a single toast per unique module in the batch
      const modules = {};
      for (const item of batch) {
        const key = item.data?.moduleName || item.data?.path || 'Notification';
        if (!modules[key]) {
          modules[key] = { count: 0, item };
        }
        modules[key].count++;
      }
      for (const [mod, info] of Object.entries(modules)) {
        const n = info.item.data || info.item;
        const count = info.count;
        const label = count > 1 ? `${count} new` : 'New';
        toast(
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            <span style={{ color: '#f87171' }}>{mod}</span>
            <br />
            <span style={{ color: '#fff' }}>{n.title || label} {count > 1 ? 'notifications' : ''}</span>
          </div>,
          {
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #374151',
              borderRadius: 12,
              padding: '8px 14px'
            },
            position: 'top-right'
          }
        );
      }
    }, 50);
  }, []);

  const fetchUnreadCounts = useCallback(async () => {
    if (!user?.role) return;
    try {
      const res = await api.get('/api/notifications/unread-counts');
      const counts = res.data.counts || {};
      const prev = prevCountsRef.current;

      // Compare total to detect new notifications for sound/popup
      let totalBefore = Object.values(prev).reduce((a, b) => a + b, 0);
      let totalAfter = Object.values(counts).reduce((a, b) => a + b, 0);
      const now = Date.now();
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

      // Merge poll results with current state — KEEP the higher count per path
      // This prevents polling from overwriting socket-driven increments
      setUnreadCounts(prev => {
        const merged = { ...prev };
        for (const [path, count] of Object.entries(counts)) {
          merged[path] = Math.max(prev[path] || 0, count);
        }
        prevCountsRef.current = merged;
        return merged;
      });
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

  // Socket listener for real-time notifications
  useEffect(() => {
    if (!user?.role) return;

    const handleNewNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      const path = data.path;
      if (!path) return;

      // Use batched increment to handle rapid-fire events correctly
      queueIncrement(path, data);

      // Play sound with cooldown
      const now = Date.now();
      if (now - notifSoundCooldown.current > 3000) {
        playNotificationSound();
        notifSoundCooldown.current = now;
      }
    };

    const handleReadNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      setUnreadCounts(prev => {
        const next = { ...prev };
        if (data.path) {
          next[data.path] = 0;
        }
        // For paths in server response, merge — keep local if higher
        // (local may have received new notifications since the read)
        if (data.counts) {
          for (const [p, c] of Object.entries(data.counts)) {
            if (p !== data.path) {
              next[p] = c;
            }
          }
        }
        prevCountsRef.current = next;
        return next;
      });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleReadNotification);

    fetchUnreadCounts();

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleReadNotification);
      if (queueTimerRef.current) clearTimeout(queueTimerRef.current);
    };
  }, [user, fetchUnreadCounts, queueIncrement]);

  // Core polling — 15s interval
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

  // Tab focus handler
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
    fetchUnreadCounts,
    setBellNotifCallback
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
