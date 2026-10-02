const prisma = require('../prisma');
const { FEATURES, ALL_PROFILES } = require('../utils/featureRegistry');

// In-memory cache for ultra-fast permission checks (TTL: 5 minutes, invalidated immediately on write)
const permissionCache = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

const invalidatePermissionCache = () => {
  permissionCache.clear();
  cacheLoadedAt = 0;
};

/**
 * Preload all configured permissions from database into memory.
 */
const loadPermissionsIntoMemory = async () => {
  try {
    const rows = await prisma.systemControlPermission.findMany();
    permissionCache.clear();
    for (const r of rows) {
      const key = `${r.profile.toUpperCase()}:${r.featureId}`;
      permissionCache.set(key, r.isEnabled);
    }
    cacheLoadedAt = Date.now();
  } catch (err) {
    console.error('[SystemControl] Failed to load permissions into memory:', err.message);
  }
};

/**
 * Evaluate if a given profile currently has permission for a feature.
 * @param {string} profile - e.g. 'ADMIN', 'STORE', 'MARKETING'
 * @param {string} featureId - e.g. 'ADMIN_MARKETING_VIEW'
 * @returns {Promise<boolean>}
 */
const isFeatureAllowed = async (profile, featureId) => {
  if (!profile || !featureId) return false;
  const p = profile.toUpperCase().trim();

  // Refresh cache if stale
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadPermissionsIntoMemory();
  }

  const key = `${p}:${featureId}`;

  // If explicitly configured in database, obey database decision
  if (permissionCache.has(key)) {
    return permissionCache.get(key);
  }

  // Fallback to default definition in feature registry
  const featureDef = FEATURES.find(f => f.id === featureId);
  if (!featureDef) return false;

  // By default, Super Admin has access unless explicitly toggled off
  if (p === 'SUPER_ADMIN') return true;

  return Array.isArray(featureDef.defaultProfiles) && featureDef.defaultProfiles.includes(p);
};

/**
 * Express middleware to guard APIs against disabled features.
 * @param {string} featureId
 */
const requirePermission = (featureId) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const allowed = await isFeatureAllowed(userRole, featureId);
      if (!allowed) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          code: 'FEATURE_DISABLED',
          featureId,
          message: `Access denied. The functionality '${featureId}' has been disabled for profile '${userRole}' in System Control.`
        });
      }

      next();
    } catch (error) {
      console.error(`[SystemControl] Error checking permission for ${featureId}:`, error);
      next(error);
    }
  };
};

module.exports = {
  isFeatureAllowed,
  requirePermission,
  invalidatePermissionCache,
};
