import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem, removeItem, getHot, setHot, removeHot } from '../utils/db';
import api from '../services/api';

const DEFAULT_TTL = 5 * 60 * 1000;

export default function useCache(key, { fetcher, ttl = DEFAULT_TTL, staleWhileRevalidate = true, freshMs } = {}) {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountRef = useRef(true);
  const keyRef = useRef(key);
  const fetcherRef = useRef(fetcher);
  const reqRef = useRef(0);
  const lastFetchRef = useRef({});
  fetcherRef.current = fetcher;

  const load = useCallback(async (skipCache = false) => {
    const currentKey = keyRef.current;
    if (!currentKey) { setLoading(false); return; }

    const reqId = ++reqRef.current;
    let hadCachedData = false;

    if (!skipCache) {
      // Freshness check: skip fetch if data was fetched recently enough
      if (freshMs && lastFetchRef.current[currentKey]) {
        const age = Date.now() - lastFetchRef.current[currentKey];
        if (age < freshMs) {
          setLoading(false);
          return;
        }
      }

      // 1. Hot cache (memory) — if staleWhileRevalidate, show stale but still revalidate
      const hot = getHot(currentKey);
      if (hot !== null) {
        setData(hot);
        setError(null);
        if (staleWhileRevalidate) {
          // With freshMs and staleWhileRevalidate, check if hot cache is fresh enough
          if (freshMs) {
            const hotAge = Date.now() - (lastFetchRef.current[currentKey] || 0);
            if (hotAge < freshMs) { setLoading(false); return; }
          }
          setLoading(false);
          hadCachedData = true;
        } else {
          setLoading(false);
          return;
        }
      }

      // 2. IndexedDB
      if (!hadCachedData) {
        const cached = await getItem(currentKey);
        if (cached !== null) {
          hadCachedData = true;
          setData(cached);
          setError(null);
          if (staleWhileRevalidate) {
            setLoading(false);
          } else {
            setLoading(false);
            return;
          }
        }
      }
    }

    // 3. Fetch fresh from API (revalidation or cold load)
    const fn = fetcherRef.current;
    if (!fn) { setLoading(false); return; }
    if (!hadCachedData) setLoading(true);
    try {
      const freshData = await fn();
      if (!mountRef.current || reqRef.current !== reqId) return;
      setData(freshData);
      setError(null);
      lastFetchRef.current[currentKey] = Date.now();
      setHot(currentKey, freshData, ttl);
      await setItem(currentKey, freshData, ttl);
    } catch (err) {
      if (!mountRef.current || reqRef.current !== reqId) return;
      setError(err);
    } finally {
      if (mountRef.current && reqRef.current === reqId) setLoading(false);
    }
  }, [ttl, staleWhileRevalidate, freshMs]);

  useEffect(() => {
    mountRef.current = true;
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
