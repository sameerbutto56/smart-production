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
  const lastNotifRef = useRef(null);

  const isVercel = window.location.hostname.includes('vercel.app');

  const fetchUnreadCounts = useCallback(async () => {
    if (!user?.role) return;
    try {
      const res = await api.get('/api/notifications/unread-counts');
      setUnreadCounts(res.data.counts || {});
    } catch (e) { /* silent */ }
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
      await api.put('/api/notifications/mark-read', { path });
      setUnreadCounts(prev => ({ ...prev, [path]: 0 }));
    } catch (e) { /* silent */ }
  }, [user?.role]);

  // Socket listener for real-time notifications
  useEffect(() => {
    if (!user?.role) return;

    const handleNewNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      const path = data.path;
      if (!path) return;

      // Deduplicate
      const key = `${data.id}`;
      if (lastNotifRef.current === key) return;
      lastNotifRef.current = key;

      setUnreadCounts(prev => ({
        ...prev,
        [path]: (prev[path] || 0) + 1
      }));

      playNotificationSound();
    };

    const handleReadNotification = (data) => {
      if (data.role && data.role !== user.role) return;
      if (data.counts) {
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

  // Polling fallback for Vercel (no socket)
  useEffect(() => {
    if (!user?.role) return;
    if (!isVercel) return;

    const poll = () => {
      fetchUnreadCounts();
    };
    poll();
    pollingRef.current = setInterval(poll, 30000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [user?.role, isVercel, fetchUnreadCounts]);

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
