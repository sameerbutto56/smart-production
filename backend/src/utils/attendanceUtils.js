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

// Helper to check if a shift has ended according to Asia/Karachi local date and time
function hasShiftEnded(dateStr, scheduledOutStr) {
  if (!dateStr) return false;
  try {
    const pktFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = pktFormatter.formatToParts(new Date());
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    const currentPktDate = `${map.year}-${map.month}-${map.day}`;
    const currentPktMins = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);

    if (dateStr < currentPktDate) return true;
    if (dateStr > currentPktDate) return false;

    const sOutMins = parseTimeToMinutes(scheduledOutStr || '18:00') ?? 1080;
    return currentPktMins >= sOutMins;
  } catch (_) {
    return false;
  }
}

// Compute Late, Early Checkout, and Overtime minutes according to rules
function calculateAttendanceMetrics(scheduledIn, scheduledOut, actualIn, actualOut, status = 'PRESENT', options = {}) {
  if (status === 'ABSENT' || status === 'LEAVE' || status === 'WEEKLY_OFF') {
    return {
      earlyArrivalMinutes: 0,
      earlyCheckInOt: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      checkoutOtMinutes: 0,
      overtimeMinutes: 0,
      workingHours: 0
    };
  }

  const isAutoCheckout = Boolean(options.isAutoCheckout);
  const sIn = parseTimeToMinutes(scheduledIn || '10:00') ?? 600; // 10:00 AM default
  const sOut = parseTimeToMinutes(scheduledOut || '18:00') ?? 1080; // 6:00 PM default
  const aIn = parseTimeToMinutes(actualIn);
  const aOut = parseTimeToMinutes(actualOut);

  let earlyArrivalMinutes = 0;
  let earlyCheckInOt = 0;
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let checkoutOtMinutes = 0;

  // 1. Check-In Dimension (Section 1 & 2)
  if (aIn !== null) {
    if (aIn < sIn) {
      // Early arrival before scheduled check-in
      earlyArrivalMinutes = sIn - aIn;
      // 10-minute early check-in tolerance:
      // Beyond 10 minutes tolerance becomes Early Check-In Overtime
      if (earlyArrivalMinutes > 10) {
        earlyCheckInOt = earlyArrivalMinutes - 10;
      }
    } else if (aIn > sIn + 15) {
      // 15-minute check-in grace period:
      // Up to sIn + 15 (e.g. 10:15) is On Time. After 10:15 counts as late.
      lateMinutes = aIn - (sIn + 15);
    }
  }

  // 2. Check-Out Dimension (Section 3, 4 & 5)
  if (aOut !== null) {
    if (isAutoCheckout) {
      // Auto Checkout: Employee assigned scheduled shift end
      // Requirement 5: Do not treat employee as late checkout, do not award checkout overtime,
      // and do not apply an early-checkout penalty.
      earlyMinutes = 0;
      checkoutOtMinutes = 0;
    } else {
      if (aOut < sOut - 10) {
        // 10-minute early checkout tolerance:
        // Before sOut - 10 records exact early checkout duration (e.g. 5:49 -> 11 mins)
        earlyMinutes = sOut - aOut;
      } else if (aOut > sOut + 15) {
        // 15-minute checkout overtime tolerance:
        // Beyond 15 minutes tolerance becomes Checkout Overtime (e.g. 6:30 -> 15 mins)
        checkoutOtMinutes = (aOut - sOut) - 15;
      }
    }
  }

  // 3. Total Daily Overtime (Early Check-In OT + Checkout OT)
  const overtimeMinutes = earlyCheckInOt + checkoutOtMinutes;

  // 4. Worked Hours
  let workingHours = 0;
  if (status === 'HALF_DAY') {
    workingHours = 4;
  } else if (aIn !== null && aOut !== null && aOut > aIn) {
    workingHours = Math.round(((aOut - aIn) / 60) * 10) / 10;
  }

  return {
    earlyArrivalMinutes,
    earlyCheckInOt,
    lateMinutes,
    earlyMinutes,
    checkoutOtMinutes,
    overtimeMinutes,
    workingHours
  };
}

module.exports = {
  parseTimeToMinutes,
  normalizeDateStr,
  hasShiftEnded,
  calculateAttendanceMetrics
};
