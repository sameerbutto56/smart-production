const prisma = require('../prisma');

// Global System Pause — canonical state store. State lives in SystemSetting rows:
//   SYSTEM_PAUSED         'true' | 'false'   (kept in sync with the legacy key)
//   SYSTEM_PAUSE_INFO     JSON { pausedBy, pausedById, pausedAt, source }
//   SYSTEM_PAUSE_PERIODS  JSON [{ startedAt, endedAt }]  (endedAt null = currently paused)
//   SYSTEM_PAUSE_HISTORY  JSON [{ action, by, byId, source, at }]  (newest first, capped)
//
// The middleware guard reads isSystemPaused() on every mutating /api request (5s cache),
// so the lock takes effect within seconds and is not bypassable through direct API calls.

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

const getSystemState = async () => {
  const paused = await getPaused();
  const info = await readSetting('SYSTEM_PAUSE_INFO', null);
  const periods = await readSetting('SYSTEM_PAUSE_PERIODS', []);
  return { paused, info, periods: Array.isArray(periods) ? periods : [] };
};

const getSystemHistory = async (limit = 50) => {
  const history = await readSetting('SYSTEM_PAUSE_HISTORY', []);
  return Array.isArray(history) ? history.slice(0, limit) : [];
};

const pauseSystem = async ({ by, byId, source }) => {
  const now = new Date();
  const info = { pausedBy: by, pausedById: byId, pausedAt: now.toISOString(), source: source || 'Admin Dashboard' };

  const periods = await readSetting('SYSTEM_PAUSE_PERIODS', []);
  const open = periods.find((p) => p && !p.endedAt);
  if (!open) periods.push({ startedAt: now.toISOString(), endedAt: null });

  const history = await readSetting('SYSTEM_PAUSE_HISTORY', []);
  history.unshift({ action: 'PAUSE', by, byId, source: source || 'Admin Dashboard', at: now.toISOString() });
  const capped = history.slice(0, 100);

  await writeSetting('SYSTEM_PAUSED', 'true');
  await writeSetting('SYSTEM_PAUSE_INFO', info);
  await writeSetting('SYSTEM_PAUSE_PERIODS', periods);
  await writeSetting('SYSTEM_PAUSE_HISTORY', capped);
  invalidateCache();
  return { paused: true, info, periods };
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
// periods: [{ startedAt, endedAt }] — an entry with endedAt === null counts as paused up to endMs.
const activeElapsedMs = (startMs, endMs, periods = []) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  let overlap = 0;
  for (const p of periods) {
    if (!p || !p.startedAt) continue;
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
  isSystemPaused,
  invalidateCache,
  getSystemState,
  getSystemHistory,
  pauseSystem,
  resumeSystem,
  activeElapsedMs,
};
