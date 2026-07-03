import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import socket from '../socket';

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
    }
    setLoading(false);
  }, [joinRoleRoom]);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user } = response.data;
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      joinRoleRoom(user.role);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  }, [joinRoleRoom]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout, loading }), [user, login, logout, loading]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
