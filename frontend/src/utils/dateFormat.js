/**
 * Date formatting and parsing utility supporting customizable user preferences:
 * - 'DD/MM/YYYY' (e.g. 05/09/2026)
 * - 'MM/DD/YYYY' (e.g. 09/05/2026)
 * - 'YYYY/MM/DD' (e.g. 2026/09/05)
 */

export const SUPPORTED_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';

export const MONTHS_LIST = [
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' }
];

export const YEARS_LIST = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const pad = (n) => String(n).padStart(2, '0');

export function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/**
 * Formats a Date or ISO string according to the given format preference.
 * Extracts date components directly without timezone shifts.
 *
 * @param {Date|string|number} dateValue - Date instance or ISO string
 * @param {string} formatPreference - 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY/MM/DD'
 * @param {boolean} includeTime - whether to append HH:mm (default: false)
 * @returns {string} Formatted date string, or '' if invalid
 */
export function formatDateWithPreference(dateValue, formatPreference = DEFAULT_DATE_FORMAT, includeTime = false) {
  if (!dateValue) return '';

  let day, month, year;
  let hours = '00', minutes = '00';

  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    const isoMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = pad(parseInt(isoMatch[2], 10));
      day = pad(parseInt(isoMatch[3], 10));
      if (isoMatch[4] && isoMatch[5]) {
        hours = pad(parseInt(isoMatch[4], 10));
        minutes = pad(parseInt(isoMatch[5], 10));
      }
    } else {
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return '';
      day = pad(d.getUTCDate());
      month = pad(d.getUTCMonth() + 1);
      year = d.getUTCFullYear();
      hours = pad(d.getUTCHours());
      minutes = pad(d.getUTCMinutes());
    }
  } else if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return '';
    day = pad(dateValue.getDate());
    month = pad(dateValue.getMonth() + 1);
    year = dateValue.getFullYear();
    hours = pad(dateValue.getHours());
    minutes = pad(dateValue.getMinutes());
  } else {
    return '';
  }

  let datePart;
  const fmt = (formatPreference || DEFAULT_DATE_FORMAT).toUpperCase().replace(/\s+/g, '');

  if (fmt.startsWith('MM')) {
    datePart = `${month}/${day}/${year}`;
  } else if (fmt.startsWith('YYYY')) {
    datePart = `${year}/${month}/${day}`;
  } else {
    datePart = `${day}/${month}/${year}`;
  }

  if (includeTime) {
    return `${datePart} ${hours}:${minutes}`;
  }

  return datePart;
}

/**
 * Parses a user input string according to the format preference into a pure date-only UTC ISO string (00:00:00.000Z).
 * Supports delimiters `/`, `-`, or `.`.
 *
 * @param {string} inputStr - The raw date string typed or entered
 * @param {string} formatPreference - 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY/MM/DD'
 * @returns {string} ISO Date String (UTC midnight) or '' if unparseable
 */
export function parseDateWithPreference(inputStr, formatPreference = DEFAULT_DATE_FORMAT) {
  if (!inputStr || typeof inputStr !== 'string') return '';
  const trimmed = inputStr.trim();
  if (!trimmed) return '';

  const fmt = (formatPreference || DEFAULT_DATE_FORMAT).toUpperCase().replace(/\s+/g, '');

  // Regex matching date (e.g. DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD)
  const parts = trimmed.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!parts) {
    // If standard ISO string was passed directly
    const isoMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).toISOString();
    }
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? '' : new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate(), 0, 0, 0, 0)).toISOString();
  }

  let year;
  let month;
  let day;

  if (fmt.startsWith('YYYY')) {
    year = parseInt(parts[1], 10);
    month = parseInt(parts[2], 10);
    day = parseInt(parts[3], 10);
  } else if (fmt.startsWith('MM')) {
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
    year = parseInt(parts[3], 10);
  } else {
    // DD/MM/YYYY default
    day = parseInt(parts[1], 10);
    month = parseInt(parts[2], 10);
    year = parseInt(parts[3], 10);
  }

  // Basic sanity validation
  if (month < 1 || month > 12) return '';
  if (day < 1 || day > 31) return '';
  if (year < 100) year += 2000; // e.g. 26 -> 2026
  if (year < 1900 || year > 2100) return '';

  const maxDays = getDaysInMonth(month, year);
  if (day > maxDays) return '';

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)).toISOString();
}

/**
 * Returns placeholder format text according to preference (date-only by default)
 */
export function getDateFormatPlaceholder(formatPreference = DEFAULT_DATE_FORMAT, includeTime = false) {
  const fmt = (formatPreference || DEFAULT_DATE_FORMAT).toUpperCase().replace(/\s+/g, '');
  let base = 'DD/MM/YYYY';
  if (fmt.startsWith('MM')) base = 'MM/DD/YYYY';
  else if (fmt.startsWith('YYYY')) base = 'YYYY/MM/DD';
  return includeTime ? `${base} HH:mm` : base;
}
