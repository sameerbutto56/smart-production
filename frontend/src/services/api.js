import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Attach AbortController for GET requests — old in-flight requests are cancelled on duplicate
  if (config.method === 'get' && !config.signal) {
    const controller = new AbortController();
    config.signal = controller.signal;
    config._controller = controller;
  }
  return config;
});

// Deduplication: cancel previous in-flight GET to the same URL
const inflight = new Map();
api.interceptors.request.use(config => {
  if (config.method === 'get') {
    const key = `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
    const prev = inflight.get(key);
    if (prev) {
      prev.abort();
    }
    inflight.set(key, config._controller);
    config._inflightKey = key;
  }
  return config;
});

api.interceptors.response.use(
  response => {
    if (response.config._inflightKey) {
      inflight.delete(response.config._inflightKey);
    }
    return response;
  },
  error => {
    if (axios.isCancel(error)) {
      return Promise.reject(new Error('CANCELLED'));
    }
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
