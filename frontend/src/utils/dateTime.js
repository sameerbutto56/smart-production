const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export function toDate(d) {
  if (d === null || d === undefined || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** 01:15 PM — AM/PM stays English in both English and Urdu UI. Optional includeSeconds for live clocks. */
export function formatTimeOnly(d, includeSeconds = false) {
  const dt = toDate(d);
  if (!dt) return '—';
  const h = dt.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const base = `${pad(h12)}:${pad(dt.getMinutes())}`;
  const secs = includeSeconds ? `:${pad(dt.getSeconds())}` : '';
  return `${base}${secs} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 31 Jul 2026 */
export function formatDateOnly(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

/** 31 Jul 2026, 01:15 PM — global standard across all screens and prints */
export function formatDateTime(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return `${formatDateOnly(dt)}, ${formatTimeOnly(dt)}`;
}

export default { formatDateTime, formatDateOnly, formatTimeOnly, toDate };
