import { get, set, del, keys, createStore } from 'idb-keyval';

const store = createStore('enamels-cache', 'cache-store');

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function getItem(key) {
  try {
    const entry = await get(key, store);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      await del(key, store);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export async function setItem(key, data, ttl = DEFAULT_TTL) {
  try {
    await set(key, { data, expiry: Date.now() + ttl }, store);
  } catch (e) {
    console.warn('Cache setItem failed:', e);
  }
}

export async function removeItem(key) {
  try {
    await del(key, store);
  } catch {}
}

export async function clearAll() {
  try {
    const allKeys = await keys(store);
    await Promise.all(allKeys.map(k => del(k, store)));
  } catch {}
}

export async function getBulk(prefix) {
  try {
    const allKeys = await keys(store);
    const matching = allKeys.filter(k => k.startsWith(prefix));
    const entries = await Promise.all(matching.map(k => get(k, store).then(v => [k, v])));
    const result = {};
    for (const [k, v] of entries) {
      if (v && (!v.expiry || Date.now() <= v.expiry)) {
        result[k] = v.data;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// In-memory hot cache (faster than IndexedDB for repeated reads within a session)
const hotCache = new Map();

export function getHot(key) {
  const entry = hotCache.get(key);
  if (!entry) return null;
  if (entry.expiry && Date.now() > entry.expiry) {
    hotCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setHot(key, data, ttl = DEFAULT_TTL) {
  hotCache.set(key, { data, expiry: Date.now() + ttl });
}

export function removeHot(key) {
  hotCache.delete(key);
}

export function clearHot() {
  hotCache.clear();
}
