const cache = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const get = (key) => {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    delete cache[key];
    return null;
  }
  return entry.data;
};

const set = (key, data, ttl = DEFAULT_TTL) => {
  cache[key] = { data, expiry: Date.now() + ttl };
};

const del = (key) => {
  delete cache[key];
};

const delPattern = (pattern) => {
  for (const key of Object.keys(cache)) {
    if (key.startsWith(pattern)) delete cache[key];
  }
};

module.exports = { get, set, del, delPattern };
