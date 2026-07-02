/**
 * In-memory cache with TTL, pattern invalidation, and hit stats.
 * Used heavily by POS for instant product/barcode/dashboard lookups.
 */
const store = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const POS_TTL = 10 * 60 * 1000;    // 10 minutes for product catalog (changes rarely)
const DASHBOARD_TTL = 30 * 1000;    // 30 seconds for dashboard stats (changes on every sale)
const BARCODE_TTL = 15 * 60 * 1000; // 15 minutes for barcode lookups (very stable data)

let hits = 0;
let misses = 0;

const get = (key) => {
  const entry = store[key];
  if (!entry) { misses++; return null; }
  if (Date.now() > entry.expiry) {
    delete store[key];
    misses++;
    return null;
  }
  hits++;
  return entry.data;
};

const set = (key, data, ttl = DEFAULT_TTL) => {
  store[key] = { data, expiry: Date.now() + ttl };
};

const del = (key) => {
  delete store[key];
};

const delPattern = (pattern) => {
  for (const key of Object.keys(store)) {
    if (key.startsWith(pattern)) delete store[key];
  }
};

/** Invalidate only specific cache families instead of wiping everything */
const delKeys = (...keys) => {
  for (const k of keys) delete store[k];
};

const stats = () => ({ hits, misses, ratio: hits + misses > 0 ? (hits / (hits + misses) * 100).toFixed(1) + '%' : 'N/A', keys: Object.keys(store).length });

module.exports = { get, set, del, delPattern, delKeys, stats, POS_TTL, DASHBOARD_TTL, BARCODE_TTL, DEFAULT_TTL };
