// Working Hours Engine — Phase-Based Delay System (Frontend ESM)
//
// Computes actual working milliseconds between two timestamps.
// Rules:
//   Working window: 9:00 AM – 7:00 PM (Pakistan Time, UTC+5)
//   Working days: Monday–Saturday
//   Sunday: fully excluded (non-working day)
//   Overnight (7 PM → 9 AM): excluded
//
// Mirrors backend/src/utils/workingHours.js exactly.

const PK_OFFSET = 5 * 60 * 60 * 1000; // UTC+5

export const WORK_START_HOUR = 9;  // 9:00 AM
export const WORK_END_HOUR = 19;   // 7:00 PM
export const WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR; // 10 hours

const toPKT = (ms) => new Date(ms + PK_OFFSET);

const dayStartUTC = (ms) => {
  const pkt = toPKT(ms);
  return Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate()) - PK_OFFSET;
};

const isSunday = (ms) => toPKT(ms).getUTCDay() === 0;

const getWorkingWindow = (dayStartUtcMs) => {
  if (isSunday(dayStartUtcMs)) return null;
  return {
    start: dayStartUtcMs + WORK_START_HOUR * 3600000,
    end: dayStartUtcMs + WORK_END_HOUR * 3600000,
  };
};

const nextDay = (dayStartUtcMs) => {
  let next = dayStartUtcMs + 86400000;
  while (isSunday(next)) next += 86400000;
  return next;
};

/**
 * Compute working milliseconds between two UTC timestamps.
 * Only counts time within 9AM–7PM PKT, Mon–Sat.
 * @param {number} startMs - UTC ms
 * @param {number} endMs - UTC ms
 * @returns {number} Working milliseconds (>= 0)
 */
export const computeWorkingMs = (startMs, endMs) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  let total = 0;
  let currentDayStart = dayStartUTC(startMs);
  while (currentDayStart < endMs) {
    const window = getWorkingWindow(currentDayStart);
    if (window) {
      const overlapStart = Math.max(startMs, window.start);
      const overlapEnd = Math.min(endMs, window.end);
      if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
    }
    currentDayStart = nextDay(currentDayStart);
  }
  return total;
};

/**
 * Compute working hours (decimal) between two UTC timestamps.
 * @param {number} startMs
 * @param {number} endMs
 * @returns {number} Working hours
 */
export const computeWorkingHours = (startMs, endMs) => computeWorkingMs(startMs, endMs) / 3600000;

/**
 * Check if a given UTC timestamp falls within working hours (Mon–Sat 9AM–7PM PKT).
 * @param {number} ms - UTC timestamp ms
 * @returns {boolean}
 */
export const isWorkingTime = (ms) => {
  if (isSunday(ms)) return false;
  const hour = toPKT(ms).getUTCHours();
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
};

/**
 * Get the current timer state based on the given UTC timestamp.
 * @param {number} nowMs - Current UTC timestamp ms
 * @returns {{ status: string, resumesAt: number|null, message: string }}
 */
export const getTimerState = (nowMs) => {
  if (isSunday(nowMs)) {
    let day = dayStartUTC(nowMs);
    day = nextDay(day); // Monday
    const resumesAt = day + WORK_START_HOUR * 3600000;
    return { status: 'stopped_sunday', resumesAt, message: 'Timer paused — Sunday is a non-working day. Resumes Monday at 9:00 AM.' };
  }

  const pkt = toPKT(nowMs);
  const totalMinutes = pkt.getUTCHours() * 60 + pkt.getUTCMinutes();
  const workStartMin = WORK_START_HOUR * 60;
  const workEndMin = WORK_END_HOUR * 60;
  const warningMin = workEndMin - 10; // 6:50 PM

  if (totalMinutes < workStartMin) {
    return { status: 'stopped_morning', resumesAt: dayStartUTC(nowMs) + WORK_START_HOUR * 3600000, message: `Timer starts at 9:00 AM today.` };
  }
  if (totalMinutes >= workEndMin) {
    return { status: 'stopped_evening', resumesAt: nextDay(dayStartUTC(nowMs)) + WORK_START_HOUR * 3600000, message: 'Timer stopped for today. Resumes tomorrow at 9:00 AM.' };
  }
  if (totalMinutes >= warningMin) {
    return { status: 'warning', resumesAt: null, message: `Timer will stop in ${workEndMin - totalMinutes} minute(s) at 7:00 PM.` };
  }
  return { status: 'running', resumesAt: null, message: 'Timer is running.' };
};

/**
 * Format working milliseconds into a human-readable string.
 * <1h → "Xm"; <24h → "Xh Ym"; ≥24h → "X Day(s) Yh"
 */
export const fmtWorkingDuration = (ms) => {
  if (!ms || ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (WORK_HOURS_PER_DAY * 60));
  const remainingMin = totalMin % (WORK_HOURS_PER_DAY * 60);
  const hours = Math.floor(remainingMin / 60);
  const minutes = remainingMin % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
