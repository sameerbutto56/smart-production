const prisma = require('../prisma');
const { PROFILES, DEFAULT_PROFILE_KEYS, VALID_KEYS } = require('./pauseProfiles');

// Global System Pause — canonical state store. State lives in SystemSetting rows:
//   SYSTEM_PAUSED         'true' | 'false'   (kept in sync with the legacy key)
//   SYSTEM_PAUSE_INFO     JSON { pausedBy, pausedById, pausedAt, source }
//   SYSTEM_PAUSE_PERIODS  JSON [{ startedAt, endedAt, profiles }]  (endedAt null = currently paused)
//   SYSTEM_PAUSE_PROFILES JSON [profileKey...] — the profiles the pause applies to
//                          (missing/empty = every profile, preserving global-pause behavior)
//   SYSTEM_PAUSE_HISTORY  JSON [{ action, by, byId, source, at, profiles }]  (newest first, capped)
//
// The middleware guard reads isSystemPaused() on every mutating /api request (5s cache)
// and then checks the caller's profile against the selected profiles, so the lock takes
// effect within seconds and only stops the profiles the admin/software settings chose.

const PAUSED_MESSAGE = 'System is paused. All functions are temporarily stopped by Admin. Please wait for resume.';

const stateCache = { value: null, expiresAt: 0 };
const CACHE_TTL = 5000;

const readSetting = async (key, fallback) => {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch { return fallback; }
  } catch { return fallback; }
};

const writeSetting = async (key, value) => {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: typeof value === 'string' ? value : JSON.stringify(value) },
    create: { key, value: typeof value === 'string' ? value : JSON.stringify(value) },
  });
};

const getPaused = async () => {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PAUSED' } });
    return row ? row.value === 'true' : false;
  } catch { return false; }
};

const isSystemPaused = async () => {
  if (Date.now() < stateCache.expiresAt && stateCache.value !== null) return stateCache.value;
  const paused = await getPaused();
  stateCache.value = paused;
  stateCache.expiresAt = Date.now() + CACHE_TTL;
  return paused;
};

const invalidateCache = () => {
  stateCache.value = null;
  stateCache.expiresAt = 0;
};

// Profiles the current (or next) pause applies to. Missing/empty = ALL profiles.
const getPauseProfiles = async () => {
  const raw = await readSetting('SYSTEM_PAUSE_PROFILES', null);
  if (Array.isArray(raw) && raw.length) return raw.filter((k) => VALID_KEYS.has(k));
  return [...DEFAULT_PROFILE_KEYS];
};

// Persist the selected profiles. Empty array resets to "all profiles" (global pause).
const setPauseProfiles = async (keys) => {
  const clean = Array.isArray(keys) ? keys.filter((k) => VALID_KEYS.has(k)) : [];
  await writeSetting('SYSTEM_PAUSE_PROFILES', clean);
  invalidateCache();
  return clean.length ? clean : [...DEFAULT_PROFILE_KEYS];
};

// True when the system is paused AND the given profile is selected for the pause.
const isProfilePaused = async (profileKey) => {
  if (!(await isSystemPaused())) return false;
  if (!profileKey) return false; // unauthenticated / unresolvable → never scoped
  if (profileKey === 'control') return false; // control roles are never paused
  const profiles = await getPauseProfiles();
  return profiles.includes(profileKey);
};

const getSystemState = async () => {
  const paused = await getPaused();
  const info = await readSetting('SYSTEM_PAUSE_INFO', null);
  const periods = await readSetting('SYSTEM_PAUSE_PERIODS', []);
  const profiles = await getPauseProfiles();
  return { paused, info, periods: Array.isArray(periods) ? periods : [], profiles };
};

const getSystemHistory = async (limit = 50) => {
  const history = await readSetting('SYSTEM_PAUSE_HISTORY', []);
  return Array.isArray(history) ? history.slice(0, limit) : [];
};

const pauseSystem = async ({ by, byId, source }) => {
  const now = new Date();
  const info = { pausedBy: by, pausedById: byId, pausedAt: now.toISOString(), source: source || 'Admin Dashboard' };
  const profiles = await getPauseProfiles();

  const periods = await readSetting('SYSTEM_PAUSE_PERIODS', []);
  const open = periods.find((p) => p && !p.endedAt);
  if (!open) periods.push({ startedAt: now.toISOString(), endedAt: null, profiles });

  const history = await readSetting('SYSTEM_PAUSE_HISTORY', []);
  history.unshift({ action: 'PAUSE', by, byId, source: source || 'Admin Dashboard', at: now.toISOString(), profiles });
  const capped = history.slice(0, 100);

  await writeSetting('SYSTEM_PAUSED', 'true');
  await writeSetting('SYSTEM_PAUSE_INFO', info);
  await writeSetting('SYSTEM_PAUSE_PERIODS', periods);
  await writeSetting('SYSTEM_PAUSE_HISTORY', capped);
  invalidateCache();
  return { paused: true, info, periods, profiles };
};

const resumeSystem = async ({ by, byId, source }) => {
  const now = new Date();

  const periods = await readSetting('SYSTEM_PAUSE_PERIODS', []);
  const openIdx = periods.findIndex((p) => p && !p.endedAt);
  if (openIdx !== -1) {
    const open = periods[openIdx];
    open.endedAt = now.toISOString();
    periods[openIdx] = open;
  }

  const history = await readSetting('SYSTEM_PAUSE_HISTORY', []);
  history.unshift({ action: 'RESUME', by, byId, source: source || 'Admin Dashboard', at: now.toISOString() });
  const capped = history.slice(0, 100);

  await writeSetting('SYSTEM_PAUSED', 'false');
  await writeSetting('SYSTEM_PAUSE_INFO', null);
  await writeSetting('SYSTEM_PAUSE_PERIODS', periods);
  await writeSetting('SYSTEM_PAUSE_HISTORY', capped);
  invalidateCache();
  return { paused: false, periods };
};

// Elapsed wall-clock milliseconds between startMs and endMs minus all paused overlap.
// periods: [{ startedAt, endedAt, profiles? }] — an entry with endedAt === null counts
// as paused up to endMs. When profileKey is given, only windows that include that
// profile (or windows without a profiles field, i.e. legacy global pauses) are subtracted.
const activeElapsedMs = (startMs, endMs, periods = [], profileKey = null) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  let overlap = 0;
  for (const p of periods) {
    if (!p || !p.startedAt) continue;
    if (profileKey && Array.isArray(p.profiles) && p.profiles.length && !p.profiles.includes(profileKey)) continue;
    const pStart = new Date(p.startedAt).getTime();
    const pEnd = p.endedAt ? new Date(p.endedAt).getTime() : endMs;
    const overlapStart = Math.max(startMs, pStart);
    const overlapEnd = Math.min(endMs, pEnd);
    if (overlapEnd > overlapStart) overlap += overlapEnd - overlapStart;
  }
  return Math.max(0, endMs - startMs - overlap);
};

module.exports = {
  PAUSED_MESSAGE,
  PROFILES,
  isSystemPaused,
  invalidateCache,
  getSystemState,
  getSystemHistory,
  getPauseProfiles,
  setPauseProfiles,
  isProfilePaused,
  pauseSystem,
  resumeSystem,
  activeElapsedMs,
};
