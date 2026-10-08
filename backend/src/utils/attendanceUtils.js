// Helper to convert time strings ("10:00", "10:15 AM", "18:00", "06:30 PM") to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim();
  const is12Hour = /am|pm/i.test(str);
  if (is12Hour) {
    const match = str.match(/(\d+):(\d+)(?::\d+)?\s*(am|pm)/i);
    if (!match) return null;
    let [_, hours, mins, modifier] = match;
    hours = parseInt(hours, 10);
    mins = parseInt(mins, 10);
    if (modifier.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;
    return hours * 60 + mins;
  } else {
    const parts = str.split(':');
    if (parts.length < 2) return null;
    const hours = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    return hours * 60 + mins;
  }
}

// Helper to normalize various date formats (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, Excel serial)
function normalizeDateStr(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const dateObj = new Date((num - 25569) * 86400 * 1000);
    return dateObj.toISOString().slice(0, 10);
  }
  return null;
}

// Compute Late, Early Checkout, and Overtime minutes according to rules
function calculateAttendanceMetrics(scheduledIn, scheduledOut, actualIn, actualOut, status = 'PRESENT') {
  if (status === 'ABSENT' || status === 'LEAVE' || status === 'WEEKLY_OFF') {
    return { lateMinutes: 0, earlyMinutes: 0, overtimeMinutes: 0, workingHours: 0 };
  }

  const sIn = parseTimeToMinutes(scheduledIn || '10:00') ?? 600; // 10:00 AM
  const sOut = parseTimeToMinutes(scheduledOut || '18:00') ?? 1080; // 6:00 PM
  const aIn = parseTimeToMinutes(actualIn);
  const aOut = parseTimeToMinutes(actualOut);

  let lateMinutes = 0;
  let earlyMinutes = 0;
  let overtimeMinutes = 0;

  // 1. Check-in grace period: 15 minutes allowed
  // 10:00 - 10:15 -> On Time. After 10:15 -> Late (e.g. 10:20 -> Late = 5 minutes)
  if (aIn !== null) {
    if (aIn > sIn + 15) {
      lateMinutes = aIn - (sIn + 15);
    }
  }

  // 2. Check-out early check: Up to 10 minutes early allowed (5:50 PM).
  // Before 5:50 PM -> early checkout minutes apply (e.g. 5:40 -> 20 minutes)
  if (aOut !== null) {
    if (aOut < sOut - 10) {
      earlyMinutes = sOut - aOut;
    }
    // 3. Overtime: Up to 15 min after checkout (6:15 PM) -> no overtime.
    // After 6:15 PM -> overtime begins (e.g. 6:30 -> Overtime = 15 minutes)
    if (aOut > sOut + 15) {
      overtimeMinutes = aOut - (sOut + 15);
    }
  }

  // Working hours
  let workingHours = 8;
  if (status === 'HALF_DAY' || status === 'INCOMPLETE') {
    workingHours = 4;
  } else if (aIn !== null && aOut !== null && aOut > aIn) {
    workingHours = Math.round(((aOut - aIn) / 60) * 10) / 10;
  }

  return { lateMinutes, earlyMinutes, overtimeMinutes, workingHours };
}

module.exports = {
  parseTimeToMinutes,
  normalizeDateStr,
  calculateAttendanceMetrics
};
