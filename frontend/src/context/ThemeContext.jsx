import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { THEMES, DEFAULT_THEME } from '../themes/themeConfig';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
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

  // Apply theme immediately on mount and whenever themeId changes
  useEffect(() => {
    applyTheme(themeId);
    localStorage.setItem('app-theme', themeId);
  }, [themeId, applyTheme]);

  // Load persisted theme from backend (non-blocking)
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (token) {
          const res = await axios.get(`${API_URL}/api/admin/theme`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const serverTheme = res.data.theme;
          if (serverTheme && THEMES[serverTheme] && serverTheme !== themeId) {
            localStorage.setItem('app-theme', serverTheme);
            setThemeId(serverTheme);
          }
        }
      } catch (e) {
      }
    };
    loadTheme();
  }, []);

  const changeTheme = useCallback(async (id) => {
    setThemeId(id);
    localStorage.setItem('app-theme', id);
    try {
      const token = sessionStorage.getItem('token');
      await axios.put(`${API_URL}/api/admin/theme`, { theme: id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
    }
  }, []);

  const currentTheme = THEMES[themeId] || THEMES[DEFAULT_THEME];

  return (
    <ThemeContext.Provider value={{ themeId, currentTheme, changeTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
