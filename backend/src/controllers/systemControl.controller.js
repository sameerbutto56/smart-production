const prisma = require('../prisma');
const { MODULES, FEATURES, ALL_PROFILES } = require('../utils/featureRegistry');
const { isFeatureAllowed, invalidatePermissionCache } = require('../middleware/systemControl.middleware');

/**
 * Returns permissions enabled for the currently logged-in user.
 */
const getMyPermissions = async (req, res) => {
  try {
    const role = req.user?.role || '';
    const permissions = {};

    for (const f of FEATURES) {
      permissions[f.id] = await isFeatureAllowed(role, f.id);
    }

    res.json({
      role,
      permissions,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching my permissions:', error);
    res.status(500).json({ message: 'Failed to fetch permissions', error: error.message });
  }
};

/**
 * Returns the entire permission matrix across all profiles and modules for Software Settings.
 */
const getSystemControlMatrix = async (req, res) => {
  try {
    const dbPermissions = await prisma.systemControlPermission.findMany();
    const permMap = new Map();
    dbPermissions.forEach(p => {
      permMap.set(`${p.profile.toUpperCase()}:${p.featureId}`, p.isEnabled);
    });

    // Build full matrix
    const matrix = {};
    for (const prof of ALL_PROFILES) {
      matrix[prof] = {};
      for (const feat of FEATURES) {
        matrix[prof][feat.id] = await isFeatureAllowed(prof, feat.id);
      }
    }

    res.json({
      modules: MODULES,
      features: FEATURES,
      profiles: ALL_PROFILES,
      matrix
    });
  } catch (error) {
    console.error('Error getting system control matrix:', error);
    res.status(500).json({ message: 'Failed to get system control matrix', error: error.message });
  }
};

/**
 * Updates a single feature permission for a given profile and records an audit log.
 */
const updateSystemControlPermission = async (req, res) => {
  try {
    const { profile, featureId, isEnabled } = req.body;
    if (!profile || !featureId || typeof isEnabled !== 'boolean') {
      return res.status(400).json({ message: 'Profile, featureId, and isEnabled (boolean) are required' });
    }

    const prof = profile.toUpperCase().trim();
    if (!ALL_PROFILES.includes(prof)) {
      return res.status(400).json({ message: `Invalid profile: ${profile}` });
    }

    const featureDef = FEATURES.find(f => f.id === featureId);
    if (!featureDef) {
      return res.status(400).json({ message: `Invalid feature identifier: ${featureId}` });
    }

    // Determine previous value
    const previous = await isFeatureAllowed(prof, featureId);

    // If updating ADMIN or SUPER_ADMIN, update both profiles in database so both stay synchronized
    const profilesToUpdate = (prof === 'ADMIN' || prof === 'SUPER_ADMIN')
      ? ['ADMIN', 'SUPER_ADMIN']
      : [prof];

    let lastUpdated = null;
    for (const pr of profilesToUpdate) {
      lastUpdated = await prisma.systemControlPermission.upsert({
        where: {
          profile_featureId: {
            profile: pr,
            featureId
          }
        },
        update: {
          isEnabled,
          updatedById: req.user?.id || null,
          updatedByName: req.user?.name || 'Admin',
        },
        create: {
          profile: pr,
          featureId,
          isEnabled,
          updatedById: req.user?.id || null,
          updatedByName: req.user?.name || 'Admin',
        }
      });
    }

    // Record Audit Log
    await prisma.systemControlAuditLog.create({
      data: {
        profile: prof,
        featureId,
        previousValue: previous,
        newValue: isEnabled,
        changedById: req.user?.id || null,
        changedByName: req.user?.name || 'Admin',
      }
    });

    // Invalidate memory cache immediately
    invalidatePermissionCache();

    // Notify connected clients via WebSockets if io is available for all synced profiles
    if (req.app.get('io')) {
      for (const pr of profilesToUpdate) {
        req.app.get('io').emit('system-control:updated', {
          profile: pr,
          featureId,
          isEnabled,
          updatedAt: new Date()
        });
      }
    }

    res.json({
      success: true,
      permission: lastUpdated,
      message: `Permission for '${featureDef.name}' (${prof}) updated to ${isEnabled ? 'ON' : 'OFF'}`
    });
  } catch (error) {
    console.error('Error updating system control permission:', error);
    res.status(500).json({ message: 'Failed to update system control permission', error: error.message });
  }
};

/**
 * Returns audit logs for System Control changes.
 */
const getSystemControlAuditLogs = async (req, res) => {
  try {
    const { limit = 50, profile } = req.query;
    const where = {};
    if (profile) where.profile = profile.toUpperCase().trim();

    const logs = await prisma.systemControlAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit) || 50, 100),
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs', error: error.message });
  }
};

module.exports = {
  getMyPermissions,
  getSystemControlMatrix,
  updateSystemControlPermission,
  getSystemControlAuditLogs,
};
