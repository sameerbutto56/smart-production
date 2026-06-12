import { useState, useCallback, useRef } from 'react';

export function useLoading(initialState = false) {
  const [loading, setLoading] = useState(initialState);
  const [error, setError] = useState(null);
  const countRef = useRef(0);

  const withLoading = useCallback(async (asyncFn, ...args) => {
    countRef.current += 1;
    const callId = countRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn(...args);
      if (callId === countRef.current) {
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (callId === countRef.current) {
        setError(err.response?.data?.message || err.message || 'An error occurred');
        setLoading(false);
      }
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, withLoading, reset };
}

export function useMultiLoading(keys = []) {
  const [loadingStates, setLoadingStates] = useState(() => {
    const initial = {};
    keys.forEach(k => { initial[k] = false; });
    return initial;
  });
  const countRefs = useRef({});

  const withLoading = useCallback(async (key, asyncFn, ...args) => {
    if (!countRefs.current[key]) countRefs.current[key] = 0;
    countRefs.current[key] += 1;
    const callId = countRefs.current[key];
    setLoadingStates(prev => ({ ...prev, [key]: true }));
    try {
      const result = await asyncFn(...args);
      if (callId === countRefs.current[key]) {
        setLoadingStates(prev => ({ ...prev, [key]: false }));
      }
      return result;
    } catch (err) {
      if (callId === countRefs.current[key]) {
        setLoadingStates(prev => ({ ...prev, [key]: false }));
      }
      throw err;
    }
  }, []);

  const isLoading = useCallback((key) => loadingStates[key] || false, [loadingStates]);
  const anyLoading = Object.values(loadingStates).some(Boolean);

  return { loadingStates, isLoading, anyLoading, withLoading };
}
