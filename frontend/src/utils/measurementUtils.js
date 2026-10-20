/**
 * Measurement Utilities for Enamels ERP
 * Standardized field definitions, Urdu labels, normalization, and note generation.
 */

export const SHIRT_MEASUREMENT_FIELDS = [
  { key: 'shirtLength', label: 'Shirt Length', labelUrdu: 'شرٹ لمبائی', example: '28' },
  { key: 'shoulder', label: 'Shoulder', labelUrdu: 'کندھا', example: '17' },
  { key: 'sleevesLength', label: 'Sleeve Length', labelUrdu: 'بازو لمبائی', example: '18' },
  { key: 'chest', label: 'Chest', labelUrdu: 'چیسٹ', example: '23.5' },
  { key: 'shirtWaist', label: 'Shirt Waist', labelUrdu: 'کمر', example: '21.5' },
  { key: 'bottom', label: 'Bottom', labelUrdu: 'باٹم', example: '25' },
];

export const TROUSER_MEASUREMENT_FIELDS = [
  { key: 'trouserLength', label: 'Trouser Length', labelUrdu: 'لمبائی', example: '39.5' },
  { key: 'trouserWaist', label: 'Waist', labelUrdu: 'ویسٹ', example: '40' },
  { key: 'thighs', label: 'Thighs', labelUrdu: 'تھائی', example: '28' },
  { key: 'pancha', label: 'Pancha', labelUrdu: 'پانچا', example: '24' },
  { key: 'trouserQamar', label: 'Qamar', labelUrdu: 'کمر', example: '21.5' },
];

// Additional legacy/optional fields
export const OPTIONAL_MEASUREMENT_FIELDS = [
  { key: 'sleevesHole', label: 'Sleeves Hole', labelUrdu: 'موری / بازو ہول', category: 'shirt' },
  { key: 'asan', label: 'Asan', labelUrdu: 'آسن', category: 'trouser' },
];

/**
 * Normalizes customer sizeDetails into standard keys, preserving:
 * - Shirt waist vs Trouser waist vs Trouser Qamar as distinct fields
 * - Exact decimal values (e.g. 23.5, 21.5, 39.5)
 * - Custom extra measurements in _extra
 */
export function normalizeCustomerMeasurements(rawSizeDetails) {
  if (!rawSizeDetails) return {};

  let parsed = rawSizeDetails;
  if (typeof rawSizeDetails === 'string') {
    try {
      parsed = JSON.parse(rawSizeDetails);
    } catch {
      return {};
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  // Handle nested per-product structure if present
  const isPerProduct = Object.values(parsed).some(
    v => typeof v === 'object' && v !== null && !Array.isArray(v)
  );
  if (isPerProduct) {
    const firstNested = Object.values(parsed).find(
      v => typeof v === 'object' && v !== null && !Array.isArray(v)
    );
    if (firstNested) {
      return normalizeCustomerMeasurements(firstNested);
    }
  }

  const result = {};
  const { _extra, ...rest } = parsed;

  const getVal = (val) => {
    if (val == null) return '';
    const str = String(val).trim();
    return str;
  };

  // Shirt fields
  result.shirtLength = getVal(rest.shirtLength ?? rest.shirt_length ?? rest.shirtLengthInches);
  result.shoulder = getVal(rest.shoulder);
  result.sleevesLength = getVal(rest.sleevesLength ?? rest.sleeveLength ?? rest.sleeve ?? rest.sleeves);
  result.chest = getVal(rest.chest);
  result.shirtWaist = getVal(rest.shirtWaist ?? rest.shirt_waist);
  result.bottom = getVal(rest.bottom ?? rest.bottomWidth ?? rest.ghera);

  // Trouser fields
  result.trouserLength = getVal(rest.trouserLength ?? rest.trouser_length ?? rest.trouserLengthInches ?? rest.trouser_length_inches);
  result.trouserWaist = getVal(rest.trouserWaist ?? rest.trouser_waist);
  result.thighs = getVal(rest.thighs ?? rest.thigh);
  result.pancha = getVal(rest.pancha ?? rest.mori);
  result.trouserQamar = getVal(rest.trouserQamar ?? rest.trouser_qamar);

  // Legacy fallbacks:
  // If `waist` was saved in old format:
  if (!result.shirtWaist && !result.trouserWaist && rest.waist) {
    result.trouserWaist = getVal(rest.waist);
  } else if (!result.trouserWaist && rest.waist && result.shirtWaist) {
    result.trouserWaist = getVal(rest.waist);
  }

  // If `length` was saved:
  if (!result.trouserLength && rest.length) {
    result.trouserLength = getVal(rest.length);
  }

  // If `qamar` was saved:
  if (!result.trouserQamar && rest.qamar) {
    result.trouserQamar = getVal(rest.qamar);
  }

  // Optional fields:
  if (rest.sleevesHole) result.sleevesHole = getVal(rest.sleevesHole);
  if (rest.asan) result.asan = getVal(rest.asan);

  // Copy any other custom properties
  Object.keys(rest).forEach(k => {
    if (!result[k] && rest[k] != null && String(rest[k]).trim() !== '') {
      result[k] = getVal(rest[k]);
    }
  });

  // Preserve _extra measurements
  if (Array.isArray(_extra)) {
    result._extra = _extra.filter(e => e && e.name && e.value != null && String(e.value).trim() !== '');
  } else {
    result._extra = [];
  }

  return result;
}

/**
 * Checks if the measurements object has at least one valid measurement value.
 */
export function hasMeasurementValues(measurements) {
  if (!measurements || typeof measurements !== 'object') return false;
  const values = Object.entries(measurements)
    .filter(([k, v]) => k !== '_extra' && k !== '_standardSize' && v != null && String(v).trim() !== '');
  if (values.length > 0) return true;
  if (Array.isArray(measurements._extra) && measurements._extra.some(e => e?.name && e?.value)) return true;
  return false;
}

/**
 * Detects whether an article/product is a Shirt, Trouser, or Both (Suit/Scrub set).
 */
export function getProductMeasurementType(productName = '') {
  const lower = String(productName || '').toLowerCase().trim();
  if (!lower) return 'both';

  const hasSuitOrSet = /\b(suit|set|2pc|2-piece|2 pc|uniform)\b/i.test(lower);
  const hasTrouserKeyword = /\b(trouser|pant|pants|shalwar|pyjama|pajama)\b/i.test(lower);
  const hasShirtKeyword = /\b(shirt|top|kurta|kameez|lab coat|coat|apron|gown)\b/i.test(lower);

  if (hasSuitOrSet || (hasTrouserKeyword && hasShirtKeyword)) {
    return 'both';
  }
  if (hasTrouserKeyword && !hasShirtKeyword) {
    return 'trouser';
  }
  if (hasShirtKeyword && !hasTrouserKeyword) {
    return 'shirt';
  }
  return 'both';
}

/**
 * Formats custom measurements into the required Urdu Special Notes block.
 *
 * Example format:
 * کسٹم سائز (انچ میں)
 *
 * شرٹ
 * - شرٹ لمبائی: 28
 * - کندھا: 17
 * - بازو لمبائی: 18
 * - چیسٹ: 23.5
 * - کمر: 21.5
 * - باٹم: 25
 *
 * ٹراؤزر
 * - لمبائی: 39.5
 * - ویسٹ: 40
 * - تھائی: 28
 * - پانچا: 24
 * - کمر: 21.5
 */
export function formatUrduMeasurementNote(measurements, productType = 'both') {
  if (!measurements || typeof measurements !== 'object') return '';

  const shirtLines = [];
  const trouserLines = [];

  // Shirt lines
  if (productType === 'shirt' || productType === 'both') {
    SHIRT_MEASUREMENT_FIELDS.forEach(f => {
      const val = measurements[f.key];
      if (val != null && String(val).trim() !== '') {
        shirtLines.push(`- ${f.labelUrdu}: ${String(val).trim()}`);
      }
    });
    if (measurements.sleevesHole && String(measurements.sleevesHole).trim() !== '') {
      shirtLines.push(`- موری / بازو ہول: ${String(measurements.sleevesHole).trim()}`);
    }
  }

  // Trouser lines
  if (productType === 'trouser' || productType === 'both') {
    TROUSER_MEASUREMENT_FIELDS.forEach(f => {
      const val = measurements[f.key];
      if (val != null && String(val).trim() !== '') {
        trouserLines.push(`- ${f.labelUrdu}: ${String(val).trim()}`);
      }
    });
    if (measurements.asan && String(measurements.asan).trim() !== '') {
      trouserLines.push(`- آسن: ${String(measurements.asan).trim()}`);
    }
  }

  const extraLines = [];
  if (Array.isArray(measurements._extra)) {
    measurements._extra.forEach(e => {
      if (e && e.name && e.value != null && String(e.value).trim() !== '') {
        extraLines.push(`- ${e.name}: ${String(e.value).trim()}`);
      }
    });
  }

  if (shirtLines.length === 0 && trouserLines.length === 0 && extraLines.length === 0) {
    return '';
  }

  const sections = ['کسٹم سائز (انچ میں)'];

  if (shirtLines.length > 0) {
    sections.push(`شرٹ\n${shirtLines.join('\n')}`);
  }

  if (trouserLines.length > 0) {
    sections.push(`ٹراؤزر\n${trouserLines.join('\n')}`);
  }

  if (extraLines.length > 0) {
    sections.push(`اضافی پیمائش\n${extraLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

const MEASUREMENT_BLOCK_START = 'کسٹم سائز (انچ میں)';

/**
 * Merges new measurement notes into existing Special Notes, preserving any manually written notes.
 * Updates existing measurement block rather than appending duplicate blocks.
 */
export function mergeMeasurementSpecialNote(existingNote = '', newMeasurementNote = '') {
  const current = String(existingNote || '').trim();
  const cleanNew = String(newMeasurementNote || '').trim();

  // If no current note, return the new measurement note directly
  if (!current) return cleanNew;

  // Check if current note contains the measurement block
  const blockIdx = current.indexOf(MEASUREMENT_BLOCK_START);

  if (blockIdx === -1) {
    // Current note does not have the measurement block:
    // If no new measurement note, just return current note.
    if (!cleanNew) return current;
    // Append measurement note below manual note
    return `${current}\n\n${cleanNew}`;
  }

  // Extract manual text before the measurement block
  const manualPrefix = current.substring(0, blockIdx).trim();

  if (!cleanNew) {
    return manualPrefix;
  }

  if (manualPrefix) {
    return `${manualPrefix}\n\n${cleanNew}`;
  }

  return cleanNew;
}
