/**
 * Phone Number Normalization & Search Utilities
 * Handles standard Pakistani mobile & landline variations (+92, 0092, 92, 0, spaces, dashes)
 */

/**
 * Normalizes any phone number input to standard 11-digit local format: 03XXXXXXXXX
 * E.g.:
 * '+92 300 1234567' -> '03001234567'
 * '0300-1234567'    -> '03001234567'
 * '923001234567'    -> '03001234567'
 * '3001234567'      -> '03001234567'
 */
const normalizePhone = (input) => {
  if (!input) return '';
  let digits = String(input).trim().replace(/\D/g, '');
  if (digits.startsWith('0092')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('92') && digits.length >= 11) digits = '0' + digits.slice(2);
  else if (digits.length === 10 && digits.startsWith('3')) digits = '0' + digits;
  return digits;
};

/**
 * Formats standard 11-digit mobile number for clean user display: 03XX-XXXXXXX
 */
const formatPhoneDisplay = (input) => {
  if (!input) return '';
  const norm = normalizePhone(input);
  if (norm.length === 11 && norm.startsWith('03')) {
    return `${norm.slice(0, 4)}-${norm.slice(4)}`;
  }
  return String(input).trim();
};

/**
 * Generates all possible search representations for a query to ensure 100% match rate
 * across database records that might contain raw, formatted, or normalized strings.
 */
const getPhoneSearchVariants = (input) => {
  if (!input) return [];
  const rawTrimmed = String(input).trim();
  const digits = rawTrimmed.replace(/\D/g, '');
  const variants = new Set();

  if (rawTrimmed.length > 0) variants.add(rawTrimmed);
  if (digits.length >= 3) {
    variants.add(digits);
    const norm = normalizePhone(input);
    if (norm) variants.add(norm);
    if (norm.startsWith('0') && norm.length === 11) {
      variants.add(norm.slice(1)); // '3001234567'
      variants.add('92' + norm.slice(1)); // '923001234567'
      variants.add('+92' + norm.slice(1)); // '+923001234567'
      variants.add(`${norm.slice(0, 4)}-${norm.slice(4)}`); // '0300-1234567'
      variants.add(`${norm.slice(0, 4)} ${norm.slice(4)}`); // '0300 1234567'
    } else if (digits.length >= 7) {
      variants.add(digits);
    }
  }
  return Array.from(variants).filter(Boolean);
};

const isValidPhone = (input) => {
  if (!input) return false;
  const digits = String(input).replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

module.exports = {
  normalizePhone,
  formatPhoneDisplay,
  getPhoneSearchVariants,
  isValidPhone
};
