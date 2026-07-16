/**
 * In-memory cache with TTL, LRU eviction, pattern invalidation, and hit stats.
 * Used heavily by POS for instant product/barcode/dashboard lookups.
 */
const store = {};
const _lru = []; // front = LRU, back = MRU
const MAX_SIZE = 500;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const POS_TTL = 2 * 60 * 1000;     // 2 minutes for product catalog
const DASHBOARD_TTL = 30 * 1000;    // 30 seconds for dashboard stats (changes on every sale)
const BARCODE_TTL = 15 * 60 * 1000; // 15 minutes for barcode lookups (very stable data)

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
    delete store[key];
  }
};

const get = (key) => {
  const entry = store[key];
  if (!entry) { misses++; return null; }
  if (Date.now() > entry.expiry) {
    del(key);
    misses++;
    return null;
  }
  hits++;
  _touch(key);
  return entry.data;
};

const set = (key, data, ttl = DEFAULT_TTL) => {
  store[key] = { data, expiry: Date.now() + ttl };
  _touch(key);
  _evict();
};

const del = (key) => {
  delete store[key];
  const idx = _lru.indexOf(key);
  if (idx > -1) _lru.splice(idx, 1);
};

const delPattern = (pattern) => {
  for (const key of Object.keys(store)) {
    if (key.startsWith(pattern)) del(key);
  }
};

/** Invalidate only specific cache families instead of wiping everything */
const delKeys = (...keys) => {
  for (const k of keys) del(k);
};

const stats = () => ({ hits, misses, ratio: hits + misses > 0 ? (hits / (hits + misses) * 100).toFixed(1) + '%' : 'N/A', keys: Object.keys(store).length, lruSize: _lru.length, maxSize: MAX_SIZE });

module.exports = { get, set, del, delPattern, delKeys, stats, POS_TTL, DASHBOARD_TTL, BARCODE_TTL, DEFAULT_TTL };
