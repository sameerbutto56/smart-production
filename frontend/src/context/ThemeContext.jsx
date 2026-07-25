import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { THEMES, DEFAULT_THEME } from '../themes/themeConfig';

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

  // Load global + personal theme on mount (skip if no auth token)
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) return;
    const loadThemes = async () => {
      try {
        const res = await api.get('/api/users/me/theme');
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
      await api.put('/api/users/me/theme', { theme: id });
    } catch (e) {}
  }, []);

  const setGlobalThemeId = useCallback(async (id) => {
    setGlobalTheme(id);
    if (!personalTheme) {
      setThemeId(id);
    }
    try {
      await api.put('/api/admin/theme', { theme: id });
    } catch (e) {}
  }, [personalTheme]);

  const resetToGlobalTheme = useCallback(async () => {
    setPersonalTheme(null);
    if (globalTheme) {
      setThemeId(globalTheme);
    }
    try {
      await api.put('/api/users/me/theme', { theme: '' });
    } catch (e) {}
  }, [globalTheme]);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];

  const value = useMemo(() => ({
    themeId, currentTheme, changeTheme, setGlobalThemeId,
    resetToGlobalTheme, THEMES, globalTheme, personalTheme,
    isUsingPersonal: !!personalTheme
  }), [themeId, currentTheme, changeTheme, setGlobalThemeId, resetToGlobalTheme, globalTheme, personalTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
