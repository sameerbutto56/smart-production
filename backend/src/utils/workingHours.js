// Working Hours Engine — Phase-Based Delay System
//
// Computes actual working milliseconds between two timestamps.
// Rules:
//   Working window: 9:00 AM – 7:00 PM (Pakistan Time, UTC+5)
//   Working days: Monday–Saturday
//   Sunday: fully excluded (non-working day)
//   Overnight (7 PM → 9 AM): excluded
//
// All computations convert to Pakistan local time for day/hour detection,
// then convert back to UTC for arithmetic.

const PK_OFFSET = 5 * 60 * 60 * 1000; // UTC+5

const WORK_START_HOUR = 9;  // 9:00 AM
const WORK_END_HOUR = 19;   // 7:00 PM
const WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR; // 10 hours

// Convert a UTC timestamp to a PKT-adjusted Date (methods return PKT values)
const toPKT = (ms) => new Date(ms + PK_OFFSET);
// Convert a PKT Date back to UTC ms
const toUTC = (pktDate) => pktDate.getTime() - PK_OFFSET;

// Build a PKT Date from year/month/day/hour/minute
const makePKT = (y, m, d, h = 0, min = 0) => {
  const utcMs = Date.UTC(y, m, d, h - 5, min, 0, 0);
  return new Date(utcMs);
};

// Get the start of a PKT day as UTC ms
const dayStartUTC = (ms) => {
  const pkt = toPKT(ms);
  return Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), pkt.getUTCDate()) - PK_OFFSET;
};

// Sunday = 0 in JS getUTCDay()
const isSunday = (ms) => toPKT(ms).getUTCDay() === 0;

// Get the working window [start, end) for a given PKT day (as UTC ms)
// Returns null if the day is Sunday (non-working)
const getWorkingWindow = (dayStartUtcMs) => {
  if (isSunday(dayStartUtcMs)) return null;
  const windowStart = dayStartUtcMs + WORK_START_HOUR * 3600000;
  const windowEnd = dayStartUtcMs + WORK_END_HOUR * 3600000;
  return { start: windowStart, end: windowEnd };
};

// Advance to the next PKT day (skip Sundays)
const nextDay = (dayStartUtcMs) => {
  let next = dayStartUtcMs + 86400000;
  while (isSunday(next)) next += 86400000;
  return next;
};

/**
 * Compute working milliseconds between two UTC timestamps.
 * Only counts time within 9AM–7PM PKT, Mon–Sat.
 * Sundays are fully excluded. Overnight hours excluded.
 *
 * @param {number} startMs - Start timestamp in UTC ms
 * @param {number} endMs - End timestamp in UTC ms
 * @returns {number} Working milliseconds (>= 0)
 */
const computeWorkingMs = (startMs, endMs) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  let total = 0;

  // Start from the PKT day containing startMs
  let currentDayStart = dayStartUTC(startMs);

  // Walk day by day until we pass endMs
  while (currentDayStart < endMs) {
    const window = getWorkingWindow(currentDayStart);
    if (window) {
      // Overlap of [startMs, endMs] with this day's working window
      const overlapStart = Math.max(startMs, window.start);
      const overlapEnd = Math.min(endMs, window.end);
      if (overlapEnd > overlapStart) {
        total += overlapEnd - overlapStart;
      }
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
const computeWorkingHours = (startMs, endMs) => computeWorkingMs(startMs, endMs) / 3600000;

/**
 * Check if a given UTC timestamp falls within working hours (Mon–Sat 9AM–7PM PKT).
 * @param {number} ms - UTC timestamp ms
 * @returns {boolean}
 */
const isWorkingTime = (ms) => {
  if (isSunday(ms)) return false;
  const hour = toPKT(ms).getUTCHours();
  return hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
};

/**
 * Get the current timer state based on the given UTC timestamp.
 * Returns one of: 'running', 'stopped_evening', 'stopped_sunday'
 *
 * @param {number} nowMs - Current UTC timestamp ms
 * @returns {{ status: string, resumesAt: number|null, message: string }}
 */
const getTimerState = (nowMs) => {
  if (isSunday(nowMs)) {
    // Sunday — find next Monday 9 AM
    let day = dayStartUTC(nowMs);
    day = nextDay(day); // advance to Monday
    const resumesAt = day + WORK_START_HOUR * 3600000;
    return {
      status: 'stopped_sunday',
      resumesAt,
      message: 'Timer paused — Sunday is a non-working day. Resumes Monday at 9:00 AM.',
    };
  }

  const pkt = toPKT(nowMs);
  const hour = pkt.getUTCHours();
  const minute = pkt.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;
  const workStartMinutes = WORK_START_HOUR * 60;       // 540 = 9:00 AM
  const workEndMinutes = WORK_END_HOUR * 60;           // 1140 = 7:00 PM
  const warningMinutes = workEndMinutes - 10;           // 1130 = 6:50 PM

  if (totalMinutes < workStartMinutes) {
    // Before 9 AM — timer hasn't started today
    const todayStart = dayStartUTC(nowMs) + WORK_START_HOUR * 3600000;
    return {
      status: 'stopped_morning',
      resumesAt: todayStart,
      message: `Timer starts at 9:00 AM today.`,
    };
  }

  if (totalMinutes >= workEndMinutes) {
    // After 7 PM — timer stopped for today
    const tomorrow = nextDay(dayStartUTC(nowMs));
    const resumesAt = tomorrow + WORK_START_HOUR * 3600000;
    return {
      status: 'stopped_evening',
      resumesAt,
      message: 'Timer stopped for today. Resumes tomorrow at 9:00 AM.',
    };
  }

  if (totalMinutes >= warningMinutes) {
    // 6:50 PM – 7:00 PM — warning period
    return {
      status: 'warning',
      resumesAt: null,
      message: `Timer will stop in ${workEndMinutes - totalMinutes} minute(s) at 7:00 PM.`,
    };
  }

  // Within working hours
  return {
    status: 'running',
    resumesAt: null,
    message: 'Timer is running.',
  };
};

/**
 * Compute working milliseconds with system-pause awareness.
 * Subtracts both non-working time AND pause-window overlaps.
 *
 * @param {number} startMs - Start UTC ms
 * @param {number} endMs - End UTC ms
 * @param {Array} pausePeriods - [{ startedAt, endedAt|null, profiles? }]
 * @param {string|null} profileKey - Caller's pause profile
 * @returns {number} Active working milliseconds
 */
const computeActiveWorkingMs = (startMs, endMs, pausePeriods = [], profileKey = null) => {
  // Start with raw working time
  let workingMs = computeWorkingMs(startMs, endMs);
  if (workingMs <= 0) return 0;

  // Subtract pause overlaps (but only the portion that falls within working hours)
  if (!Array.isArray(pausePeriods) || pausePeriods.length === 0) return workingMs;

  const now = endMs;
  for (const p of pausePeriods) {
    if (!p || !p.startedAt) continue;
    // Skip pauses that don't apply to this profile
    if (profileKey && Array.isArray(p.profiles) && p.profiles.length && !p.profiles.includes(profileKey)) continue;

    const pStart = new Date(p.startedAt).getTime();
    if (!Number.isFinite(pStart)) continue;
    const pEnd = p.endedAt ? new Date(p.endedAt).getTime() : now;
    if (!Number.isFinite(pEnd)) continue;

    // Only count pause overlap that falls within working hours
    const overlapMs = computeWorkingMs(Math.max(startMs, pStart), Math.min(endMs, pEnd));
    workingMs -= overlapMs;
  }

  return Math.max(0, workingMs);
};

module.exports = {
  WORK_START_HOUR,
  WORK_END_HOUR,
  WORK_HOURS_PER_DAY,
  computeWorkingMs,
  computeWorkingHours,
  isWorkingTime,
  getTimerState,
  computeActiveWorkingMs,
};
