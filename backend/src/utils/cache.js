/**
 * Distributed + In-memory hybrid cache with TTL, LRU eviction, pattern invalidation, and hit stats.
 * - L1: Fast in-memory LRU cache (synchronous, 0 network overhead)
 * - L2: Optional Upstash Redis cache (via @upstash/redis REST client, serverless-friendly, zero connection leaks)
 * 
 * If UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN are set, writes and invalidations replicate
 * to Redis asynchronously, enabling multi-device and multi-instance cache coherence across Vercel.
 * If credentials are not set, it operates seamlessly as pure high-speed in-memory cache.
 */

let redis = null;
try {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL || process.env.REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN || process.env.REDIS_REST_TOKEN;
  if (url && token) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url, token });
  }
} catch (err) {
  console.warn('[Cache] Upstash Redis initialization skipped/failed:', err.message);
  redis = null;
}

const store = new Map();
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
    store.delete(key);
  }
};

/** Synchronous local cache lookup (fastest, preserves existing sync interface) */
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

/** Asynchronous lookup: checks local L1 first; on miss, queries Upstash Redis L2 */
const getAsync = async (key) => {
  const localVal = get(key);
  if (localVal !== null) return localVal;

  if (!redis) return null;

  try {
    const remoteData = await redis.get(key);
    if (remoteData !== null && remoteData !== undefined) {
      // Re-populate L1 memory with default TTL
      store.set(key, { data: remoteData, expiry: Date.now() + DEFAULT_TTL });
      _touch(key);
      _evict();
      hits++;
      return remoteData;
    }
  } catch (err) {
    if (process.env.DEBUG_CACHE) console.warn('[Cache] Redis get error:', err.message);
  }
  return null;
};

/** Set in local memory synchronously; fire-and-forget write-through to Redis */
const set = (key, data, ttl = DEFAULT_TTL) => {
  store.set(key, { data, expiry: Date.now() + ttl });
  _touch(key);
  _evict();

  if (redis) {
    // px sets expiration in milliseconds
    redis.set(key, data, { px: ttl }).catch((err) => {
      if (process.env.DEBUG_CACHE) console.warn('[Cache] Redis set error:', err.message);
    });
  }
};

/** Delete from local memory synchronously; fire-and-forget deletion in Redis */
const del = (key) => {
  store.delete(key);
  const idx = _lru.indexOf(key);
  if (idx > -1) _lru.splice(idx, 1);

  if (redis) {
    redis.del(key).catch((err) => {
      if (process.env.DEBUG_CACHE) console.warn('[Cache] Redis del error:', err.message);
    });
  }
};

/** Delete matching pattern from local memory; async distributed invalidation in Redis */
const delPattern = (pattern) => {
  for (const key of store.keys()) {
    if (key.startsWith(pattern)) del(key);
  }

  if (redis) {
    (async () => {
      try {
        const matchedKeys = await redis.keys(pattern + '*');
        if (Array.isArray(matchedKeys) && matchedKeys.length > 0) {
          await redis.del(...matchedKeys);
        }
      } catch (err) {
        if (process.env.DEBUG_CACHE) console.warn('[Cache] Redis delPattern error:', err.message);
      }
    })();
  }
};

/** Invalidate only specific cache families instead of wiping everything */
const delKeys = (...keys) => {
  for (const k of keys) {
    store.delete(k);
    const idx = _lru.indexOf(k);
    if (idx > -1) _lru.splice(idx, 1);
  }

  if (redis && keys.length > 0) {
    redis.del(...keys).catch((err) => {
      if (process.env.DEBUG_CACHE) console.warn('[Cache] Redis delKeys error:', err.message);
    });
  }
};

const stats = () => ({
  hits,
  misses,
  ratio: hits + misses > 0 ? (hits / (hits + misses) * 100).toFixed(1) + '%' : 'N/A',
  keys: store.size,
  lruSize: _lru.length,
  maxSize: MAX_SIZE,
  redisEnabled: !!redis,
});

module.exports = {
  get,
  getAsync,
  set,
  del,
  delPattern,
  delKeys,
  stats,
  isRedisEnabled: () => !!redis,
  POS_TTL,
  DASHBOARD_TTL,
  BARCODE_TTL,
  DEFAULT_TTL
};
