import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { THEMES, DEFAULT_THEME } from '../themes/themeConfig';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [globalTheme, setGlobalTheme] = useState(null);
  const [personalTheme, setPersonalTheme] = useState(null);
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('app-theme') || DEFAULT_THEME;
  });

  const applyTheme = useCallback((id) => {
    const theme = THEMES[id] || THEMES[DEFAULT_THEME];
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, val]) => {
      root.style.setProperty(`--${key}`, val);
    });
    root.style.setProperty('--background-image', theme.backgroundImage);
    root.style.setProperty('--gradient-1', theme.gradient1);
    root.style.setProperty('--gradient-2', theme.gradient2);
    root.style.setProperty('--gradient-3', theme.gradient3);
    document.documentElement.setAttribute('data-theme', id);
  }, []);

  useEffect(() => {
    applyTheme(themeId);
    localStorage.setItem('app-theme', themeId);
  }, [themeId, applyTheme]);

  // Load global + personal theme on mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API_URL}/api/users/me/theme`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const { personalTheme: pt, globalTheme: gt } = res.data;
        setGlobalTheme(gt);
        setPersonalTheme(pt);
        const effective = pt || gt || DEFAULT_THEME;
        if (THEMES[effective] && effective !== themeId) {
          setThemeId(effective);
        }
      } catch (e) {}
    };
    loadThemes();
  }, []);

  const changeTheme = useCallback(async (id) => {
    setPersonalTheme(id);
    setThemeId(id);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/users/me/theme`, { theme: id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  }, []);

  const setGlobalThemeId = useCallback(async (id) => {
    setGlobalTheme(id);
    if (!personalTheme) {
      setThemeId(id);
    }
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/theme`, { theme: id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  }, [personalTheme]);

  const resetToGlobalTheme = useCallback(async () => {
    setPersonalTheme(null);
    if (globalTheme) {
      setThemeId(globalTheme);
    }
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/users/me/theme`, { theme: '' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  }, [globalTheme]);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];

  return (
    <ThemeContext.Provider value={{
      themeId,
      currentTheme,
      changeTheme,
      setGlobalThemeId,
      resetToGlobalTheme,
      THEMES,
      globalTheme,
      personalTheme,
      isUsingPersonal: !!personalTheme
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
