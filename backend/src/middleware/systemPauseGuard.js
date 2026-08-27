const jwt = require('jsonwebtoken');
const { isSystemPaused, isProfilePaused, PAUSED_MESSAGE } = require('../utils/systemPause');
const { resolveProfileKey } = require('../utils/pauseProfiles');

// Profile-scoped mutation lock: while the system is paused, every mutating /api request
// from an AFFECTED profile is rejected with 423. Profiles not selected in the pause
// configuration continue working normally. Control roles (Admin / Software Settings) are
// never locked so the pause can always be resumed.
// Read-only (GET/HEAD/OPTIONS) traffic is never blocked, so dashboards stay viewable.

// URL prefixes (matched against req.originalUrl) that must stay functional during a pause.
const WHITELIST_PREFIXES = [
  '/api/auth',          // login/logout/refresh — Admin must be able to sign back in to resume
  '/api/system',        // pause/resume/state/history/profile-config endpoints themselves
  '/api/feedback',      // public QR customer feedback form (not an internal operation)
  '/api/notifications', // mark-read / unread-counts — harmless housekeeping, must not 423 during pause
  '/api/return-exchange/bulk-complete-stale', // background housekeeping — marks stale RETURN cases completed, not a business mutation
];

const decodeUser = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return decoded || null;
  } catch {
    return null; // fail-open: invalid/malformed token is handled by authenticate later
  }
};

const systemPauseGuard = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const url = req.originalUrl || req.url || '';
  if (WHITELIST_PREFIXES.some((p) => url.startsWith(p))) return next();

  try {
    const paused = await isSystemPaused();
    if (!paused) return next();

    // Only requests from profiles selected in the pause configuration are locked.
    const user = decodeUser(req);
    const profileKey = resolveProfileKey(user);
    const locked = await isProfilePaused(profileKey);
    if (!locked) return next();
  } catch {
    // Fail-open on a state read error so a transient DB hiccup never takes the branch down.
    return next();
  }

  return res.status(423).json({ message: PAUSED_MESSAGE, code: 'SYSTEM_PAUSED' });
};

module.exports = { systemPauseGuard };
