/**
 * productConfig.js
 * 
 * Frontend product and category configuration utility.
 * Evaluates whether products/categories require Gender selection.
 */

export const GENDER_APPLICABLE_CATEGORIES = new Set([
  'SCRUBS',
  'LABCOAT',
  'INNER TEES',
  'SHIRTS',
  'PANTS',
  'SUITS',
  'JACKETS',
  'UNIFORMS'
]);

export const NON_GENDER_CATEGORIES = new Set([
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

/**
 * Checks whether a category supports/requires Gender selection.
 * @param {string} category 
 * @returns {boolean}
 */
export function isCategoryGenderApplicable(category) {
  if (!category || typeof category !== 'string') return false;
  const catUpper = category.toUpperCase().trim();

  // 1. Explicit non-gender list (CAPS, UNSTICH, BOTTLE, etc.)
  if (NON_GENDER_CATEGORIES.has(catUpper)) {
    return false;
  }

  // 2. Explicit gender list
  if (GENDER_APPLICABLE_CATEGORIES.has(catUpper)) {
    return true;
  }

  // 3. Pattern / substring check
  if (
    catUpper.includes('SCRUB') ||
    catUpper.includes('COAT') ||
    catUpper.includes('LAB') ||
    catUpper.includes('SHIRT') ||
    catUpper.includes('PANT') ||
    catUpper.includes('TEE')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a product item requires Gender selection.
 * @param {Object|string} product - Product object, product details, or product name
 * @param {string} [category] - Optional category override
 * @returns {boolean}
 */
export function isProductGenderApplicable(product, category = null) {
  if (!product && !category) return false;

  // 1. If product is a string category name or product name
  if (typeof product === 'string') {
    if (category) return isCategoryGenderApplicable(category);
    // If it's a category name directly
    const catCheck = isCategoryGenderApplicable(product);
    if (NON_GENDER_CATEGORIES.has(product.toUpperCase().trim())) return false;
    if (GENDER_APPLICABLE_CATEGORIES.has(product.toUpperCase().trim())) return true;
    return catCheck;
  }

  // 2. Check explicit genderApplicable flag if present
  if (typeof product?.genderApplicable === 'boolean') {
    return product.genderApplicable;
  }
  if (typeof product?.productDetails?.genderApplicable === 'boolean') {
    return product.productDetails.genderApplicable;
  }

  // 3. Check product category
  const itemCategory = category || product?.category || product?.productCategory || product?.productDetails?.category;
  if (itemCategory) {
    return isCategoryGenderApplicable(itemCategory);
  }

  // 4. Check product name patterns
  const prodName = (product?.productType || product?.name || '').toUpperCase().trim();
  if (
    prodName.includes('CAP') ||
    prodName.includes('BOTTLE') ||
    prodName.includes('UNSTICH') ||
    prodName.includes('UNSTITCHED') ||
    prodName.includes('BAG') ||
    prodName.includes('SLEEVES') ||
    prodName.includes('SOCK') ||
    prodName.includes('SHOE') ||
    prodName.includes('CLOG') ||
    prodName.includes('LOGO') ||
    prodName.includes('ENGRAVING')
  ) {
    return false;
  }

  if (
    prodName.includes('SCRUB') ||
    prodName.includes('COAT') ||
    prodName.includes('LAB') ||
    prodName.includes('SHIRT') ||
    prodName.includes('TROUSER') ||
    prodName.includes('JOGGER') ||
    prodName.includes('JACKET') ||
    prodName.includes('TEE')
  ) {
    return true;
  }

  return false;
}
