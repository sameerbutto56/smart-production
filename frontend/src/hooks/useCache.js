import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem, removeItem, getHot, setHot, removeHot } from '../utils/db';
import api from '../services/api';

const DEFAULT_TTL = 5 * 60 * 1000;

export default function useCache(key, { fetcher, ttl = DEFAULT_TTL, staleWhileRevalidate = true } = {}) {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountRef = useRef(true);
  const keyRef = useRef(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (skipCache = false) => {
    const currentKey = keyRef.current;
    if (!currentKey) { setLoading(false); return; }

    let hadCachedData = false;

    if (!skipCache) {
      // 1. Hot cache (memory)
      const hot = getHot(currentKey);
      if (hot !== null) {
        setData(hot);
        setLoading(false);
        setError(null);
        return;
      }

      // 2. IndexedDB
      const cached = await getItem(currentKey);
      if (cached !== null) {
        hadCachedData = true;
        setData(cached);
        setError(null);
        if (staleWhileRevalidate) {
          setLoading(false); // Show stale data now, revalidate below
        } else {
          setLoading(false);
          return;
        }
      }
    }

    // 3. Fetch fresh from API (revalidation or cold load)
    const fn = fetcherRef.current;
    if (!fn) { setLoading(false); return; }
    if (!hadCachedData) setLoading(true);
    try {
      const freshData = await fn();
      if (!mountRef.current) return;
      setData(freshData);
      setError(null);
      setHot(currentKey, freshData, ttl);
      await setItem(currentKey, freshData, ttl);
    } catch (err) {
      if (!mountRef.current) return;
      setError(err);
    } finally {
      if (mountRef.current) setLoading(false);
    }
  }, [ttl, staleWhileRevalidate]);

  useEffect(() => {
    mountRef.current = true;
    keyRef.current = key;
    if (key !== undefined && key !== null) {
      setData(undefined);
      setLoading(true);
    }
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
