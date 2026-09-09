import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import socket, { resetSocket, connectSocket } from '../socket';
import { getDeviceInfo } from '../utils/deviceId';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const joinRoleRoom = useCallback((role) => {
    if (socket && role) socket.emit('join-room', `role:${role}`);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const savedUser = sessionStorage.getItem('user');
    if (token && savedUser) {
      const saved = JSON.parse(savedUser);
      setUser(saved);
      joinRoleRoom(saved.role);
      // Synchronize latest preferences from DB in the background
      api.get('/api/users/me/preferences')
        .then(res => {
          if (res.data) {
            setUser(prev => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                ...(res.data.dateFormatPreference ? { dateFormatPreference: res.data.dateFormatPreference } : {}),
                ...(res.data.shopifyMonthPreference !== undefined ? { shopifyMonthPreference: res.data.shopifyMonthPreference } : {}),
                ...(res.data.shopifyYearPreference !== undefined ? { shopifyYearPreference: res.data.shopifyYearPreference } : {})
              };
              sessionStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
        })
        .catch(() => {});
    }
    setLoading(false);
  }, [joinRoleRoom]);

  const updateDateFormatPreference = useCallback(async (format) => {
    try {
      const res = await api.put('/api/users/me/preferences', { dateFormatPreference: format });
      const newFmt = res.data?.dateFormatPreference || format;
      setUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, dateFormatPreference: newFmt };
        sessionStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
      return { success: true, dateFormatPreference: newFmt };
    } catch (err) {
      console.error('Failed to update date format preference:', err);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }, []);

  const updateShopifyMonthYearPreference = useCallback(async (month, year) => {
    try {
      const payload = {};
      if (month != null) payload.shopifyMonthPreference = parseInt(month, 10);
      if (year != null) payload.shopifyYearPreference = parseInt(year, 10);

      const res = await api.put('/api/users/me/preferences', payload);
      const newMonth = res.data?.shopifyMonthPreference ?? payload.shopifyMonthPreference;
      const newYear = res.data?.shopifyYearPreference ?? payload.shopifyYearPreference;

      setUser(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          shopifyMonthPreference: newMonth,
          shopifyYearPreference: newYear
        };
        sessionStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
      return { success: true, shopifyMonthPreference: newMonth, shopifyYearPreference: newYear };
    } catch (err) {
      console.error('Failed to update shopify month/year preference:', err);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }, []);

  const login = useCallback(async (email, password, extra = {}) => {
    try {
      const device = getDeviceInfo();
      const response = await api.post('/api/auth/login', {
        email,
        password,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        registrationCode: extra.registrationCode || undefined,
      });
      const { token, user } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      connectSocket(token);
      setUser(user);
      joinRoleRoom(user.role);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  }, [joinRoleRoom]);

  const logout = useCallback(() => {
    try {
      const token = sessionStorage.getItem('token');
      if (token) {
        const device = getDeviceInfo();
        api.post('/api/auth/logout', { deviceId: device.deviceId }).catch(() => {});
      }
    } catch (e) { /* ignore */ }
    resetSocket();
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  }, []);

  const dateFormatPreference = user?.dateFormatPreference || 'DD/MM/YYYY';
  const shopifyMonthPreference = user?.shopifyMonthPreference ?? null;
  const shopifyYearPreference = user?.shopifyYearPreference ?? null;

  const value = useMemo(() => ({
    user,
    login,
    logout,
    loading,
    dateFormatPreference,
    shopifyMonthPreference,
    shopifyYearPreference,
    updateDateFormatPreference,
    updateShopifyMonthYearPreference
  }), [user, login, logout, loading, dateFormatPreference, shopifyMonthPreference, shopifyYearPreference, updateDateFormatPreference, updateShopifyMonthYearPreference]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
