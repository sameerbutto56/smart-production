/**
 * productImageUtils.js
 * Central image resolution logic for color-wise product images.
 * Adheres strictly to the color-wise (not size-wise) product model:
 *
 * 1. Checks specific color image (from product.colorImages or product.metadata.colorImages)
 * 2. Checks variant-level color image if present
 * 3. Falls back to default product.imageUrl
 * 4. Returns null (signaling UI placeholder) if no image exists
 */

export const parseMetadata = (metadata) => {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch (e) {
    return {};
  }
};

/**
 * Extracts normalized colorImages dictionary { [colorName]: imageUrl } from a product or item.
 */
export const extractColorImages = (product) => {
  if (!product) return {};
  
  if (product.colorImages && typeof product.colorImages === 'object') {
    return { ...product.colorImages };
  }

  const meta = parseMetadata(product.metadata);
  if (meta && meta.colorImages && typeof meta.colorImages === 'object') {
    return { ...meta.colorImages };
  }

  // Check if any variant has color and imageUrl stamped
  let variants = product.variants;
  if (typeof variants === 'string') {
    try { variants = JSON.parse(variants); } catch (e) {}
  }
  const variantColorImages = {};
  if (Array.isArray(variants)) {
    for (const v of variants) {
      if (v && v.color && v.imageUrl && !variantColorImages[v.color]) {
        variantColorImages[v.color] = v.imageUrl;
      }
    }
  }

  return variantColorImages;
};

/**
 * Retrieves the unique, trimmed colors currently configured for a product from its variants or color field.
 */
export const getProductConfiguredColors = (product) => {
  if (!product) return [];
  const colorSet = new Set();

  let variants = product.variants;
  if (typeof variants === 'string') {
    try { variants = JSON.parse(variants); } catch (e) {}
  }

  if (Array.isArray(variants) && variants.length > 0) {
    for (const v of variants) {
      if (v && v.color && typeof v.color === 'string' && v.color.trim()) {
        colorSet.add(v.color.trim());
      }
    }
  }

  if (product.color && typeof product.color === 'string' && product.color.trim()) {
    colorSet.add(product.color.trim());
  }

  if (Array.isArray(product.colors)) {
    for (const c of product.colors) {
      if (c && typeof c === 'string' && c.trim()) {
        colorSet.add(c.trim());
      }
    }
  }

  // Also include any colors that have an uploaded image
  const colorImgs = extractColorImages(product);
  for (const c of Object.keys(colorImgs)) {
    if (c && c.trim()) colorSet.add(c.trim());
  }

  return Array.from(colorSet);
};

/**
 * Resolves the display image for a product given an optional selected color.
 * Follows color-wise priority with seamless fallback to product master image.
 *
 * @param {Object} product - Product or inventory item
 * @param {string|null} selectedColor - The currently selected color
 * @returns {string|null} The resolved image URL or null if none
 */
export const getProductColorImage = (product, selectedColor = null) => {
  if (!product) return null;

  const colorImages = extractColorImages(product);

  // If a specific color is selected, try to find matching image
  if (selectedColor && typeof selectedColor === 'string' && selectedColor.trim()) {
    const cleanColor = selectedColor.trim().toLowerCase();
    
    // Direct or case-insensitive match in colorImages map
    for (const [colName, url] of Object.entries(colorImages)) {
      if (colName && colName.trim().toLowerCase() === cleanColor && url) {
        return url;
      }
    }

    // Check variants for this color
    let variants = product.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    if (Array.isArray(variants)) {
      const matchingVariant = variants.find(
        v => v && v.color && v.color.trim().toLowerCase() === cleanColor && v.imageUrl
      );
      if (matchingVariant && matchingVariant.imageUrl) {
        return matchingVariant.imageUrl;
      }
    }

    // CRITICAL: A specific color was requested, but that color does NOT have an uploaded image.
    // Must return null immediately — NEVER fall back to another color's image or product.imageUrl.
    return null;
  }

  // ONLY when NO specific color is selected (general catalog card thumbnail):
  if (product.imageUrl && typeof product.imageUrl === 'string' && product.imageUrl.trim()) {
    return product.imageUrl;
  }

  const firstColorUrl = Object.values(colorImages).find(url => Boolean(url));
  if (firstColorUrl) {
    return firstColorUrl;
  }

  return null;
};
