const { isSystemPaused, PAUSED_MESSAGE } = require('../utils/systemPause');

// Global mutation lock: while the system is paused, every mutating /api request is
// rejected with 423 except a small whitelist needed to resume / authenticate.
// Read-only (GET/HEAD/OPTIONS) traffic is never blocked, so dashboards stay viewable.

// URL prefixes (matched against req.originalUrl) that must stay functional during a pause.
const WHITELIST_PREFIXES = [
  '/api/auth',          // login/logout/refresh — Admin must be able to sign back in to resume
  '/api/system',        // pause/resume/state/history endpoints themselves
  '/api/feedback',      // public QR customer feedback form (not an internal operation)
];

const systemPauseGuard = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  const url = req.originalUrl || req.url || '';
  if (WHITELIST_PREFIXES.some((p) => url.startsWith(p))) return next();

  try {
    const paused = await isSystemPaused();
    if (!paused) return next();
  } catch {
    // Fail-open on a state read error so a transient DB hiccup never takes the branch down.
    return next();
  }

  return res.status(423).json({ message: PAUSED_MESSAGE, code: 'SYSTEM_PAUSED' });
};

module.exports = { systemPauseGuard };
