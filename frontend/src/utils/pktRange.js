// PKT (Asia/Karachi, UTC+5, no DST) date-range engine — single source of truth
// for the standard dashboard/card date filter.
//
// Every boundary is computed in Pakistan local time (same technique as
// backend/src/utils/workingHours.js), so records never shift between dates for
// on-site users regardless of the machine/server timezone.
//
// Range keys (match the existing API contract of pos/outlet backends):
//   today | yesterday | week | month | year | all | custom
//
// Display labels follow the QA spec (seed date used as reference):
//   Today     — 31 August 2026
//   Yesterday — 30 August 2026
//   Weekly    — 25 August 2026 to 31 August 2026
//   Monthly   — 1 August 2026 to 31 August 2026
//   All       — 1 January 2026 to 31 August 2026   (dynamic earliest→latest from records)
//   Custom    — 15 August 2026 to 22 August 2026
//   Year      — 1 January 2026 to 31 August 2026

const PK_OFFSET = 5 * 60 * 60 * 1000; // UTC+5 (Pakistan Standard Time)

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// PKT calendar date parts of a given UTC ms
const pktParts = (ms) => {
  const p = new Date(ms + PK_OFFSET);
  return { y: p.getUTCFullYear(), m: p.getUTCMonth(), d: p.getUTCDate() };
};

// Start (00:00:00) of the PKT day containing ms, as a UTC Date
const pktDayStart = (ms) => {
  const p = pktParts(ms);
  return new Date(Date.UTC(p.y, p.m, p.d) - PK_OFFSET);
};

// End (23:59:59.999) of the PKT day containing ms, as a UTC Date
const pktDayEnd = (ms) => new Date(pktDayStart(ms).getTime() + DAY_MS - 1);

const toMs = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

/** "31 August 2026" — PKT calendar date (full month name, per QA label spec). */
export function formatFullDate(v) {
  const ms = toMs(v);
  if (ms === null) return '—';
  const p = pktParts(ms);
  return `${p.d} ${MONTHS_FULL[p.m]} ${p.y}`;
}

/** "2026-08-31" — PKT calendar day, for backend date params. */
export function pktDayISO(v) {
  const ms = toMs(v);
  if (ms === null) return '';
  const p = pktParts(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

/** Parse a 'YYYY-MM-DD' PKT calendar day into its 00:00 UTC boundary (Date). */
export function pktDateFromISO(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - PK_OFFSET);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Earliest→latest timestamps across a record list for the 'All' label/bounds. */
export function boundsFromRecords(records, field = 'createdAt') {
  if (!Array.isArray(records) || records.length === 0) return { dataStart: null, dataEnd: null };
  let min = null;
  let max = null;
  for (const r of records) {
    const t = toMs(r && r[field]);
    if (t === null) continue;
    if (min === null || t < min) min = t;
    if (max === null || t > max) max = t;
  }
  return { dataStart: min === null ? null : new Date(min), dataEnd: max === null ? null : new Date(max) };
}

/**
 * Compute PKT boundaries + display label for a range filter.
 *
 * @param {object} opts
 * @param {string} opts.range — today|yesterday|week|month|year|all|custom
 * @param {string} [opts.dateFrom=''] — 'YYYY-MM-DD' PKT calendar day (custom start)
 * @param {string} [opts.dateTo='']   — 'YYYY-MM-DD' PKT calendar day (custom end)
 * @param {Date|number|string} [opts.dataStart] — earliest record ts (for 'all' label/bounds)
 * @param {Date|number|string} [opts.dataEnd]   — latest record ts (for 'all')
 * @param {Date|number} [opts.now] — reference timestamp (defaults to Date.now(); tests override)
 * @returns {{ start: Date|null, end: Date|null, label: string, startISO: string, endISO: string }}
 *   start/end are inclusive UTC boundary Dates; ISO strings for backend query params.
 *   For 'all' with no data bounds, start/end are null (backend returns everything).
 */
export function resolvePktRange(opts = {}) {
  const now = toMs(opts.now ?? new Date()) ?? Date.now();
  const range = opts.range || 'today';
  const dateFrom = opts.dateFrom || '';
  const dateTo = opts.dateTo || '';

  const pfx = {
    today: 'Today', yesterday: 'Yesterday', week: 'Weekly', month: 'Monthly',
    year: 'Year', all: 'All', custom: 'Custom',
  }[range] || 'Today';

  if (range === 'today') {
    const start = pktDayStart(now);
    return { start, end: new Date(now), label: `${pfx} — ${formatFullDate(now)}`, startISO: start.toISOString(), endISO: new Date(now).toISOString() };
  }

  if (range === 'yesterday') {
    const yMs = now - DAY_MS;
    const start = pktDayStart(yMs);
    const end = pktDayEnd(yMs);
    const day = formatFullDate(yMs);
    return { start, end, label: `${pfx} — ${day}`, startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (range === 'week') {
    const start = pktDayStart(now - 6 * DAY_MS);
    const end = new Date(now);
    return { start, end, label: `${pfx} — ${formatFullDate(start)} to ${formatFullDate(now)}`, startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (range === 'month') {
    const p = pktParts(now);
    const start = new Date(Date.UTC(p.y, p.m, 1) - PK_OFFSET);
    const end = new Date(now);
    return { start, end, label: `${pfx} — ${formatFullDate(start)} to ${formatFullDate(now)}`, startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (range === 'year') {
    const p = pktParts(now);
    const start = new Date(Date.UTC(p.y, 0, 1) - PK_OFFSET);
    const end = new Date(now);
    return { start, end, label: `${pfx} — ${formatFullDate(start)} to ${formatFullDate(now)}`, startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (range === 'all') {
    const ds = toMs(opts.dataStart);
    const de = toMs(opts.dataEnd);
    if (ds !== null && de !== null) {
      const start = pktDayStart(ds);
      return { start, end: new Date(de), label: `${pfx} — ${formatFullDate(ds)} to ${formatFullDate(de)}`, startISO: start.toISOString(), endISO: new Date(de).toISOString() };
    }
    return { start: null, end: null, label: `${pfx} Records`, startISO: '', endISO: '' };
  }

  if (range === 'custom') {
    const a = pktDateFromISO(dateFrom);
    const b = pktDateFromISO(dateTo);
    const start = a || pktDayStart(now);
    const end = b ? pktDayEnd(b.getTime()) : new Date(start.getTime() + DAY_MS - 1);
    const label = b
      ? `${pfx} — ${formatFullDate(start)} to ${formatFullDate(end)}`
      : `${pfx} — ${formatFullDate(start)}`;
    return { start, end, label, startISO: start.toISOString(), endISO: end.toISOString() };
  }

  // Unknown range — safest default: today
  const start = pktDayStart(now);
  return { start, end: new Date(now), label: `${pfx} — ${formatFullDate(now)}`, startISO: start.toISOString(), endISO: new Date(now).toISOString() };
}

export default { resolvePktRange, formatFullDate, pktDayISO, pktDateFromISO, boundsFromRecords };