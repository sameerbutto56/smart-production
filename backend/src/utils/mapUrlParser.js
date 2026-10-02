/**
 * Utility for parsing and extracting structured location data from Google Maps,
 * Apple Maps, OpenStreetMap, and generic map/location URLs.
 */

/**
 * Checks if coordinates are valid numbers within latitude [-90, 90] and longitude [-180, 180].
 */
function isValidCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Extract coordinates from a string (URL or text).
 */
function extractCoordinatesFromString(text) {
  if (!text || typeof text !== 'string') return null;
  const decoded = decodeURIComponent(text);

  // 1. Raw coordinates pattern: "31.4795, 74.2796" or "31.4795,74.2796"
  const rawMatch = decoded.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 2. Google Maps @lat,lng,zoom pattern (e.g. /@31.4795287,74.2796245,17z)
  const atMatch = decoded.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 3. Google Maps protobuf data pattern: !3d<lat>!4d<lng> or !4d<lng>!3d<lat>
  const dMatch = decoded.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (dMatch) {
    const lat = parseFloat(dMatch[1]);
    const lng = parseFloat(dMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }
  const dReverseMatch = decoded.match(/!4d(-?\d{1,3}\.\d+)!3d(-?\d{1,2}\.\d+)/);
  if (dReverseMatch) {
    const lng = parseFloat(dReverseMatch[1]);
    const lat = parseFloat(dReverseMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 4. Query string parameters: q=lat,lng, query=lat,lng, ll=lat,lng, sll=lat,lng, daddr=lat,lng
  const qParamMatch = decoded.match(/[?&](?:q|query|ll|sll|daddr|saddr)=(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (qParamMatch) {
    const lat = parseFloat(qParamMatch[1]);
    const lng = parseFloat(qParamMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 5. center=lat,lng (e.g. Static Maps or embed URLs)
  const centerMatch = decoded.match(/[?&]center=(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (centerMatch) {
    const lat = parseFloat(centerMatch[1]);
    const lng = parseFloat(centerMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 6. destination=lat,lng
  const destMatch = decoded.match(/[?&]destination=(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (destMatch) {
    const lat = parseFloat(destMatch[1]);
    const lng = parseFloat(destMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 7. OpenStreetMap / Geo URLs: #map=17/lat/lng, mlat=lat&mlon=lng, geo:lat,lng
  const osmMapMatch = decoded.match(/openstreetmap\.org.*[#?]map=\d+\/(-?\d{1,2}\.\d+)\/(-?\d{1,3}\.\d+)/);
  if (osmMapMatch) {
    const lat = parseFloat(osmMapMatch[1]);
    const lng = parseFloat(osmMapMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }
  const osmMlatMatch = decoded.match(/[?&]mlat=(-?\d{1,2}\.\d+).*[?&]mlon=(-?\d{1,3}\.\d+)/);
  if (osmMlatMatch) {
    const lat = parseFloat(osmMlatMatch[1]);
    const lng = parseFloat(osmMlatMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }
  const geoMatch = decoded.match(/geo:(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (geoMatch) {
    const lat = parseFloat(geoMatch[1]);
    const lng = parseFloat(geoMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Extract coordinates from HTML content (meta tags, static maps, scripts).
 */
function extractCoordinatesFromHtml(html) {
  if (!html || typeof html !== 'string') return null;

  // 1. Check meta tags (itemprop="url", canonical, og:url)
  const metaUrlMatch = html.match(/<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]*itemprop=["']url["']/i) ||
                       html.match(/<meta[^>]+itemprop=["']url["'][^>]*content=["'](https?:\/\/[^"']+)["']/i) ||
                       html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["'](https?:\/\/[^"']+)["']/i) ||
                       html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["'](https?:\/\/[^"']+)["']/i);
  if (metaUrlMatch) {
    const coords = extractCoordinatesFromString(metaUrlMatch[1]);
    if (coords) return coords;
  }

  // 2. Check static map image meta or tags (itemprop="image")
  const staticMapMatch = html.match(/center(?:%3D|=)(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/) ||
                         html.match(/markers(?:%3D|=)(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/);
  if (staticMapMatch) {
    const lat = parseFloat(staticMapMatch[1]);
    const lng = parseFloat(staticMapMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 3. Look for @lat,lng or !3dlat!4dlng anywhere in the HTML
  const inlineAtMatch = html.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (inlineAtMatch) {
    const lat = parseFloat(inlineAtMatch[1]);
    const lng = parseFloat(inlineAtMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  const inlineDMatch = html.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (inlineDMatch) {
    const lat = parseFloat(inlineDMatch[1]);
    const lng = parseFloat(inlineDMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  // 4. Look for JavaScript array / state coordinate patterns e.g. [null,null,31.4795,74.2796]
  const arrayMatch = html.match(/\[null,\s*null,\s*(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})\]/);
  if (arrayMatch) {
    const lat = parseFloat(arrayMatch[1]);
    const lng = parseFloat(arrayMatch[2]);
    if (isValidCoordinates(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Extracts place name, place ID, and title from URL or HTML.
 */
function extractPlaceDetails(url, html = '') {
  let placeName = null;
  let placeId = null;

  if (url) {
    const decodedUrl = decodeURIComponent(url);
    // /place/Place+Name/
    const placeMatch = decodedUrl.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      placeName = placeMatch[1].replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Place ID (e.g. 1s0x391903e1e245a4a5:0x1b1168f8709a3cf6)
    const placeIdMatch = decodedUrl.match(/1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/) ||
                         decodedUrl.match(/[?&](?:place_id|query_place_id)=([^&]+)/);
    if (placeIdMatch) {
      placeId = placeIdMatch[1];
    }

    // Query param place name if not coordinates: ?q=Doctors+Hospital
    if (!placeName) {
      const qMatch = decodedUrl.match(/[?&]q=([^&]+)/);
      if (qMatch && !/^-?\d{1,2}\.\d+/.test(qMatch[1])) {
        placeName = qMatch[1].replace(/\+/g, ' ').trim();
      }
    }
  }

  if (html) {
    // Check og:title e.g. <meta property="og:title" content="Doctors Hospital & Medical Center - Google Maps">
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) {
      let t = ogTitleMatch[1].replace(/\s*[-·]\s*Google Maps/i, '').trim();
      if (t && t.toLowerCase() !== 'google maps' && !placeName) {
        placeName = t;
      }
    }

    if (!placeName) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        let t = titleMatch[1].replace(/\s*[-·]\s*Google Maps/i, '').trim();
        if (t && t.toLowerCase() !== 'google maps') {
          placeName = t;
        }
      }
    }
  }

  return { placeName, placeId };
}

/**
 * Follows HTTP redirects and returns the final destination URL and page HTML.
 */
async function resolveRedirects(initialUrl) {
  let targetUrl = initialUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  let finalUrl = targetUrl;
  let html = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    finalUrl = response.url || targetUrl;
    html = await response.text();
  } catch (err) {
    // Even if fetch aborts or network error, we can still attempt regex on the input URL
    return { finalUrl, html, error: err.message };
  }

  return { finalUrl, html };
}

/**
 * Reverse geocodes coordinates with OpenStreetMap Nominatim to extract structured
 * address, area, city, hospital, and company details.
 */
async function reverseGeocodeCoords(lat, lng) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Enamels-ERP/1.0 (contact@enamel.com)',
        'Accept-Language': 'en',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Main function: Extracts structured location data from a map link.
 * @param {string} rawUrl
 * @returns {Promise<{
 *   success: boolean,
 *   latitude?: number,
 *   longitude?: number,
 *   address?: string,
 *   area?: string,
 *   city?: string,
 *   placeName?: string,
 *   hospitalName?: string | null,
 *   companyName?: string | null,
 *   placeId?: string | null,
 *   sourceUrl?: string,
 *   message?: string,
 *   reason?: string
 * }>}
 */
async function extractLocationFromUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      success: false,
      message: 'Unable to extract location from this link. Please paste a supported Google Maps/location link.',
      reason: 'Empty or invalid URL provided.'
    };
  }

  const cleanedInput = rawUrl.trim();

  // Step 1: Quick check if raw coordinates were pasted (e.g. "31.5204, 74.3587")
  let coords = extractCoordinatesFromString(cleanedInput);
  let resolvedUrl = cleanedInput;
  let html = '';

  // Step 2: If not raw coordinates, resolve URL redirects
  if (!coords) {
    // Basic domain validation
    const isLikelyMapUrl = /maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google|maps\.apple\.com|openstreetmap\.org|waze\.com|geo:/i.test(cleanedInput) ||
                           /^-?\d{1,2}\.\d+[,\s]+-?\d{1,3}\.\d+$/.test(cleanedInput);
    if (!isLikelyMapUrl && !cleanedInput.includes('http')) {
      return {
        success: false,
        message: 'Unable to extract location from this link. Please paste a supported Google Maps/location link.',
        reason: 'Unsupported map provider or invalid URL.'
      };
    }

    const resolution = await resolveRedirects(cleanedInput);
    resolvedUrl = resolution.finalUrl || cleanedInput;
    html = resolution.html || '';

    // Step 3: Try extracting coords from resolved URL
    coords = extractCoordinatesFromString(resolvedUrl);

    // Step 4: If still not found, check original URL
    if (!coords) {
      coords = extractCoordinatesFromString(cleanedInput);
    }

    // Step 5: If still not found, search inside response HTML
    if (!coords && html) {
      coords = extractCoordinatesFromHtml(html);
    }
  }

  // Check if coordinates were found
  if (!coords || !isValidCoordinates(coords.lat, coords.lng)) {
    return {
      success: false,
      message: 'Unable to extract location from this link. Please paste a supported Google Maps/location link.',
      reason: 'Coordinates unavailable from the provided link. Please ensure the link points to a specific pin, place, or coordinates.'
    };
  }

  const { lat, lng } = coords;

  // Step 6: Extract place name & place ID from resolved URL and HTML
  const { placeName: extractedPlaceName, placeId } = extractPlaceDetails(resolvedUrl, html);

  // Step 7: Reverse geocode to get authoritative structured address, area, and city
  const geocodeData = await reverseGeocodeCoords(lat, lng);
  const addr = geocodeData?.address || {};

  const area = addr.suburb ||
               addr.neighbourhood ||
               addr.city_district ||
               addr.quarter ||
               addr.town ||
               addr.village ||
               addr.residential ||
               'Lahore';

  const city = addr.city ||
               addr.town ||
               addr.municipality ||
               addr.county ||
               addr.state_district ||
               'Lahore';

  const displayName = geocodeData?.display_name ||
                      (extractedPlaceName ? `${extractedPlaceName}, ${area}, ${city}` : `${area}, ${city}`);

  // Place name resolution
  let placeName = extractedPlaceName || geocodeData?.name || area;

  // Institution / facility detection
  let hospitalName = null;
  const hospitalRegex = /(hospital|clinic|medical\s*center|dispensary|health\s*care|dr\b|doctor|surgical|pharmacy)/i;
  if (placeName && hospitalRegex.test(placeName)) {
    hospitalName = placeName;
  } else if (addr.amenity && hospitalRegex.test(addr.amenity)) {
    hospitalName = geocodeData?.name || addr.amenity;
  }

  let companyName = null;
  const companyRegex = /(pvt|ltd|company|corp|office|plaza|tower|firm|technolog|enterprise|mall|center|centre)/i;
  if (!hospitalName) {
    if (placeName && companyRegex.test(placeName)) {
      companyName = placeName;
    } else if (addr.office || addr.commercial) {
      companyName = placeName || addr.office || addr.commercial;
    }
  }

  return {
    success: true,
    latitude: parseFloat(lat.toFixed(6)),
    longitude: parseFloat(lng.toFixed(6)),
    address: displayName,
    area,
    city,
    placeName,
    hospitalName,
    companyName,
    placeId: placeId || null,
    sourceUrl: cleanedInput
  };
}

module.exports = {
  isValidCoordinates,
  extractCoordinatesFromString,
  extractCoordinatesFromHtml,
  extractPlaceDetails,
  resolveRedirects,
  reverseGeocodeCoords,
  extractLocationFromUrl
};
