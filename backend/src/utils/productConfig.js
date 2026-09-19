/**
 * productConfig.js
 * 
 * Authoritative backend product and category configuration utility.
 * Determines product-dependent validation rules such as gender applicability.
 */

const prisma = require('../prisma');

// Default category rules in case DB is unavailable or for instant sync
const DEFAULT_GENDER_APPLICABLE_CATEGORIES = new Set([
  'SCRUBS',
  'LABCOAT',
  'INNER TEES',
  'SHIRTS',
  'PANTS',
  'SUITS',
  'JACKETS',
  'UNIFORMS'
]);

const DEFAULT_NON_GENDER_CATEGORIES = new Set([
  'CAPS',
  'CAP',
  'BOTTLE',
  'SLEEVES',
  'UNSTICH',
  'UNSTITCHED',
  'FABRIC',
  'BAG',
  'SOCKS',
  'SHOES',
  'CLOGS',
  'LOGO',
  'ACCESSORIES',
  'PRODUCTION'
]);

let _categoryConfigCache = null;
let _categoryConfigCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Fetches all product category configurations from DB with in-memory caching.
 */
async function getCategoryConfigs() {
  const now = Date.now();
  if (_categoryConfigCache && (now - _categoryConfigCacheTime < CACHE_TTL_MS)) {
    return _categoryConfigCache;
  }
  try {
    const configs = await prisma.productCategoryConfig.findMany();
    const map = {};
    configs.forEach(c => {
      map[c.category.toUpperCase().trim()] = c;
    });
    _categoryConfigCache = map;
    _categoryConfigCacheTime = now;
    return map;
  } catch (err) {
    console.error('getCategoryConfigs error:', err.message);
    return null;
  }
}

/**
 * Determines whether a category supports/requires Gender selection.
 * @param {string} category 
 * @param {Object} [categoryConfigsMap]
 * @returns {boolean}
 */
function isCategoryGenderApplicable(category, categoryConfigsMap = null) {
  if (!category || typeof category !== 'string') return false;
  const catUpper = category.toUpperCase().trim();

  // 1. Check DB category configs if provided
  if (categoryConfigsMap && categoryConfigsMap[catUpper]) {
    return Boolean(categoryConfigsMap[catUpper].genderApplicable);
  }

  // 2. Check explicit non-gender list first (e.g. CAPS, UNSTICH, BOTTLE, etc.)
  if (DEFAULT_NON_GENDER_CATEGORIES.has(catUpper)) {
    return false;
  }

  // 3. Check explicit gender list
  if (DEFAULT_GENDER_APPLICABLE_CATEGORIES.has(catUpper)) {
    return true;
  }

  // 4. Substring / pattern fallback
  if (catUpper.includes('SCRUB') || catUpper.includes('COAT') || catUpper.includes('LAB') || catUpper.includes('SHIRT') || catUpper.includes('PANT') || catUpper.includes('TEE')) {
    return true;
  }

  return false;
}

/**
 * Determines whether a specific product item requires Gender.
 * Evaluates item metadata, explicit genderApplicable flag, category, and matching inventory item.
 * 
 * @param {Object} item - Product item or productDetails object
 * @param {Array} [inventoryItems] - Optional pre-fetched inventory items array
 * @param {Object} [categoryConfigsMap] - Optional category configs map
 * @returns {boolean}
 */
function isProductGenderApplicable(item, inventoryItems = null, categoryConfigsMap = null) {
  if (!item) return false;

  // 1. If explicit genderApplicable boolean is defined on the item
  if (typeof item.genderApplicable === 'boolean') {
    return item.genderApplicable;
  }

  const pd = item.productDetails || item;
  if (typeof pd.genderApplicable === 'boolean') {
    return pd.genderApplicable;
  }

  // 2. Check item category if present
  const category = pd.category || item.category || pd.productCategory || item.productCategory;
  if (category) {
    return isCategoryGenderApplicable(category, categoryConfigsMap);
  }

  // 3. Match against inventoryItems if provided
  const prodName = (pd.productType || pd.name || item.productType || item.name || '').trim();
  if (prodName && inventoryItems && Array.isArray(inventoryItems)) {
    const matched = inventoryItems.find(i => 
      i.name.toLowerCase() === prodName.toLowerCase() ||
      prodName.toLowerCase().includes(i.name.toLowerCase()) ||
      i.name.toLowerCase().includes(prodName.toLowerCase())
    );
    if (matched) {
      if (typeof matched.genderApplicable === 'boolean') {
        return matched.genderApplicable;
      }
      if (matched.category) {
        return isCategoryGenderApplicable(matched.category, categoryConfigsMap);
      }
    }
  }

  // 4. Fallback: if product name contains clear non-gender keywords (Cap, Bottle, Unstich, Bag, Sleeves, Socks, Shoes, Clog)
  const nameUpper = prodName.toUpperCase();
  if (
    nameUpper.includes('CAP') ||
    nameUpper.includes('BOTTLE') ||
    nameUpper.includes('UNSTICH') ||
    nameUpper.includes('UNSTITCHED') ||
    nameUpper.includes('FABRIC') ||
    nameUpper.includes('BAG') ||
    nameUpper.includes('SLEEVES') ||
    nameUpper.includes('SOCK') ||
    nameUpper.includes('SHOE') ||
    nameUpper.includes('CLOG') ||
    nameUpper.includes('ENGRAVING') ||
    nameUpper.includes('LOGO')
  ) {
    return false;
  }

  // 5. If product name contains apparel or gender-defining keywords
  if (
    nameUpper.includes('SCRUB') ||
    nameUpper.includes('COAT') ||
    nameUpper.includes('LAB') ||
    nameUpper.includes('SHIRT') ||
    nameUpper.includes('TROUSER') ||
    nameUpper.includes('JOGGER') ||
    nameUpper.includes('JACKET') ||
    nameUpper.includes('TEE') ||
    nameUpper.includes('INNER T') ||
    nameUpper.includes('INNER-T') ||
    nameUpper.includes('INNER') ||
    nameUpper.includes('SUIT') ||
    nameUpper.includes('UNIFORM') ||
    /\bMEN\b/.test(nameUpper) ||
    /\bWOMEN\b/.test(nameUpper) ||
    /\bLADIES\b/.test(nameUpper) ||
    /\bGENTS\b/.test(nameUpper) ||
    /\bUNISEX\b/.test(nameUpper)
  ) {
    return true;
  }

  // Default: non-apparel / unknown products do not require gender
  return false;
}

/**
 * Asynchronously resolves gender applicability with DB inventory lookup fallback.
 */
async function resolveProductGenderApplicability(item, inventoryItems = null, categoryConfigsMap = null) {
  if (!item) return false;

  // First try synchronous resolution
  const syncResult = isProductGenderApplicable(item, inventoryItems, categoryConfigsMap);
  if (syncResult) return true;

  const pd = item.productDetails || item;
  const prodName = (pd.productType || pd.name || item.productType || item.name || '').trim();
  if (!prodName) return false;

  // Explicit non-gender keywords take absolute precedence
  const nameUpper = prodName.toUpperCase();
  if (
    nameUpper.includes('CAP') ||
    nameUpper.includes('BOTTLE') ||
    nameUpper.includes('UNSTICH') ||
    nameUpper.includes('UNSTITCHED') ||
    nameUpper.includes('FABRIC') ||
    nameUpper.includes('BAG') ||
    nameUpper.includes('SLEEVES') ||
    nameUpper.includes('SOCK') ||
    nameUpper.includes('SHOE') ||
    nameUpper.includes('CLOG') ||
    nameUpper.includes('ENGRAVING') ||
    nameUpper.includes('LOGO')
  ) {
    return false;
  }

  // Look up inventory item in DB if not found in pre-fetched inventoryItems
  try {
    const inv = await prisma.inventoryItem.findFirst({
      where: {
        OR: [
          { name: { equals: prodName, mode: 'insensitive' } },
          { name: { contains: prodName, mode: 'insensitive' } }
        ]
      },
      select: { category: true, genderApplicable: true }
    });

    if (inv) {
      if (typeof inv.genderApplicable === 'boolean') return inv.genderApplicable;
      if (inv.category) return isCategoryGenderApplicable(inv.category, categoryConfigsMap);
    }
  } catch (err) {
    console.error('resolveProductGenderApplicability DB lookup error:', err.message);
  }

  return false;
}

module.exports = {
  getCategoryConfigs,
  isCategoryGenderApplicable,
  isProductGenderApplicable,
  resolveProductGenderApplicability,
  DEFAULT_GENDER_APPLICABLE_CATEGORIES,
  DEFAULT_NON_GENDER_CATEGORIES,
};
