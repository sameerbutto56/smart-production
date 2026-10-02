/**
 * High-performance In-Memory Cache with TTL, LRU eviction, pattern invalidation, and hit stats.
 * 100% Free, zero external services, zero network latency.
 * Used heavily by POS for instant product/barcode/dashboard lookups.
 */

const store = new Map();
const _lru = []; // front = LRU, back = MRU
const MAX_SIZE = 1000;              // Expanded capacity in RAM
const DEFAULT_TTL = 5 * 60 * 1000;  // 5 minutes
const POS_TTL = 3 * 60 * 1000;      // 3 minutes for product catalog
const DASHBOARD_TTL = 30 * 1000;    // 30 seconds for dashboard stats
const BARCODE_TTL = 20 * 60 * 1000; // 20 minutes for barcode lookups

let hits = 0;
let misses = 0;

const _touch = (key) => {
  const idx = _lru.indexOf(key);
  if (idx > -1) _lru.splice(idx, 1);
  _lru.push(key);
};

const _evict = () => {
  while (_lru.length > MAX_SIZE) {
    const key = _lru.shift();
    store.delete(key);
  }
};

/** Synchronous local in-memory cache lookup */
const get = (key) => {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (Date.now() > entry.expiry) {
    del(key);
    misses++;
    return null;
  }
  hits++;
  _touch(key);
  return entry.data;
};

/** Async wrapper for consistency */
const getAsync = async (key) => get(key);

/** Set key in memory */
const set = (key, data, ttl = DEFAULT_TTL) => {
  store.set(key, { data, expiry: Date.now() + ttl });
  _touch(key);
  _evict();
};

/** Delete key */
const del = (key) => {
  store.delete(key);
  const idx = _lru.indexOf(key);
  if (idx > -1) _lru.splice(idx, 1);
};

/** Delete all keys starting with pattern */
const delPattern = (pattern) => {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) del(key);
  }
};

/** Invalidate specific keys */
const delKeys = (...keys) => {
  for (const k of keys) {
    del(k);
  }
};

const stats = () => ({
  hits,
  misses,
  ratio: hits + misses > 0 ? (hits / (hits + misses) * 100).toFixed(1) + '%' : 'N/A',
  keys: store.size,
  lruSize: _lru.length,
  maxSize: MAX_SIZE,
});

module.exports = {
  get,
  getAsync,
  set,
  del,
  delPattern,
  delKeys,
  stats,
  isRedisEnabled: () => false,
  POS_TTL,
  DASHBOARD_TTL,
  BARCODE_TTL,
  DEFAULT_TTL
};
