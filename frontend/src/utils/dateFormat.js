/**
 * Date formatting and parsing utility supporting customizable user preferences:
 * - 'DD/MM/YYYY' (e.g. 05/09/2026)
 * - 'MM/DD/YYYY' (e.g. 09/05/2026)
 * - 'YYYY/MM/DD' (e.g. 2026/09/05)
 */

export const SUPPORTED_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Formats a Date or ISO string according to the given format preference.
 *
 * @param {Date|string|number} dateValue - Date instance or ISO string
 * @param {string} formatPreference - 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY/MM/DD'
 * @param {boolean} includeTime - whether to append HH:mm
 * @returns {string} Formatted date string, or '' if invalid
 */
export function formatDateWithPreference(dateValue, formatPreference = DEFAULT_DATE_FORMAT, includeTime = false) {
  if (!dateValue) return '';
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return '';

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

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
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${datePart} ${hours}:${minutes}`;
  }

  return datePart;
}

/**
 * Parses a user input string according to the format preference into an ISO string.
 * Supports delimiters `/`, `-`, or `.`.
 *
 * @param {string} inputStr - The raw date string typed or entered
 * @param {string} formatPreference - 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY/MM/DD'
 * @returns {string} ISO Date String or '' if unparseable
 */
export function parseDateWithPreference(inputStr, formatPreference = DEFAULT_DATE_FORMAT) {
  if (!inputStr || typeof inputStr !== 'string') return '';
  const trimmed = inputStr.trim();
  if (!trimmed) return '';

  const fmt = (formatPreference || DEFAULT_DATE_FORMAT).toUpperCase().replace(/\s+/g, '');

  // Regex matching date with optional time (HH:mm or HH:mm:ss)
  // Handles / or - or . as separators
  const parts = trimmed.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!parts) {
    // If standard ISO string was passed directly
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? '' : fallback.toISOString();
  }

  let year;
  let month;
  let day;
  const hours = parts[4] ? parseInt(parts[4], 10) : 0;
  const minutes = parts[5] ? parseInt(parts[5], 10) : 0;
  const seconds = parts[6] ? parseInt(parts[6], 10) : 0;

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
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

  const d = new Date(year, month - 1, day, hours, minutes, seconds);
  if (isNaN(d.getTime())) return '';

  // Confirm rollover didn't happen (e.g. Feb 31 -> Mar 3)
  if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) {
    return '';
  }

  return d.toISOString();
}

/**
 * Returns placeholder format text according to preference
 */
export function getDateFormatPlaceholder(formatPreference = DEFAULT_DATE_FORMAT, includeTime = true) {
  const fmt = (formatPreference || DEFAULT_DATE_FORMAT).toUpperCase().replace(/\s+/g, '');
  let base = 'DD/MM/YYYY';
  if (fmt.startsWith('MM')) base = 'MM/DD/YYYY';
  else if (fmt.startsWith('YYYY')) base = 'YYYY/MM/DD';
  return includeTime ? `${base} HH:mm` : base;
}
