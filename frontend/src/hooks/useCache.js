import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem, removeItem, getHot, setHot, removeHot } from '../utils/db';
import api from '../services/api';

const DEFAULT_TTL = 5 * 60 * 1000;

export default function useCache(key, { fetcher, ttl = DEFAULT_TTL, staleWhileRevalidate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountRef = useRef(true);
  const keyRef = useRef(key);

  const load = useCallback(async (skipCache = false) => {
    const currentKey = keyRef.current;
    if (!currentKey) { setLoading(false); return; }

    // 1. Check hot cache (memory — instant)
    if (!skipCache) {
      const hot = getHot(currentKey);
      if (hot !== null) {
        setData(hot);
        setLoading(false);
        setError(null);
        return;
      }

      // 2. Check IndexedDB
      const cached = await getItem(currentKey);
      if (cached !== null) {
        setData(cached);
        setLoading(false);
        setError(null);
        if (!staleWhileRevalidate) return;
        // Continue to revalidate in background
      }
    }

    // 3. Fetch from API
    if (!fetcher) { setLoading(false); return; }
    try {
      setLoading(true);
      const freshData = await fetcher();
      if (!mountRef.current) return;
      setData(freshData);
      setError(null);
      setHot(currentKey, freshData, ttl);
      await setItem(currentKey, freshData, ttl);
    } catch (err) {
      if (!mountRef.current) return;
      setError(err);
      // Keep stale data if available
    } finally {
      if (mountRef.current) setLoading(false);
    }
  }, [fetcher, ttl, staleWhileRevalidate]);

  useEffect(() => {
    keyRef.current = key;
    load();
    return () => { mountRef.current = false; };
  }, [key, load]);

  const refresh = useCallback(() => load(true), [load]);

  const mutate = useCallback(async (newData) => {
    setData(newData);
    setHot(key, newData, ttl);
    await setItem(key, newData, ttl);
  }, [key, ttl]);

  const invalidate = useCallback(async () => {
    removeHot(key);
    await removeItem(key);
    await load(true);
  }, [key, load]);

  return { data, loading, error, refresh, mutate, invalidate };
}

// Bulk cache invalidation (e.g., on socket event)
export async function invalidateKey(key) {
  removeHot(key);
  await removeItem(key);
}

// Hook to manually set cache (for optimistic updates without data dependency)
export async function setCache(key, data, ttl = DEFAULT_TTL) {
  setHot(key, data, ttl);
  await setItem(key, data, ttl);
}
