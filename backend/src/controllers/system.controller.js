const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const {
  PAUSED_MESSAGE,
  getSystemState,
  getSystemHistory,
  getPauseProfiles,
  setPauseProfiles,
  pauseSystem,
  resumeSystem,
} = require('../utils/systemPause');
const { PROFILES, CONTROL_ROLES, resolveProfileKey, rolesForProfiles } = require('../utils/pauseProfiles');
const notify = require('../utils/notify');

// Profiles the current pause applies to — computed at pause/resume time from the
// saved configuration, then expanded to concrete role strings for notifications.
// Control roles are excluded from notifications (they operate the pause itself).

const verifyPassword = async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    res.status(400).json({ message: 'Password is required to pause or resume the system.' });
    return null;
  }
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      res.status(404).json({ message: 'User not found' });
      return null;
    }
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      res.status(401).json({ message: 'Invalid password. Action unauthorized.' });
      return null;
    }
    return admin;
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify password', error: error.message });
    return null;
  }
};

const broadcastSystemEvent = async (req, action, byName, profiles = []) => {
  const isPause = action === 'PAUSE';
  const title = isPause ? 'System Paused' : 'System Resumed';
  const message = isPause
    ? 'System is stopped by Admin for your profile. All functions are temporarily stopped.'
    : 'System has been resumed by Admin. All functions are now active.';
  // Notify ONLY the concrete roles that belong to the selected profiles.
  const roles = rolesForProfiles(profiles).filter((r) => !CONTROL_ROLES.includes(r));
  for (const role of roles) {
    await notify.create(req, {
      type: 'system',
      moduleName: 'System',
      path: '/',
      role,
      title,
      message,
      action,
      employeeName: byName,
    }).catch(() => {});
  }
  try {
    const io = req.app?.get('io');
    if (io && io.emit) io.emit(isPause ? 'system-paused' : 'system-resumed', { by: byName, at: new Date().toISOString() });
  } catch { /* socket is best-effort (safe stub on serverless) */ }
};

const getState = async (req, res) => {
  try {
    const state = await getSystemState();
    const profileKey = resolveProfileKey(req.user);
    // affected = system paused AND caller's profile is selected (control never affected).
    const affected = state.paused && profileKey !== 'control' && profileKey !== null
      && state.profiles.includes(profileKey);
    res.json({
      ...state,
      affected,
      myProfile: profileKey,
      profileDefs: PROFILES.map((p) => ({ key: p.key, label: p.label })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get system state', error: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await getSystemHistory();
    res.json({ history });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get system history', error: error.message });
  }
};

// Current saved profile selection (all profiles = global pause).
const getPauseProfileConfig = async (req, res) => {
  try {
    const profiles = await getPauseProfiles();
    res.json({
      profiles,
      profileDefs: PROFILES.map((p) => ({ key: p.key, label: p.label })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get pause profile config', error: error.message });
  }
};

// Save which profiles the pause applies to. Empty array → all profiles (global pause).
const updatePauseProfileConfig = async (req, res) => {
  try {
    const { profiles } = req.body || {};
    const clean = Array.isArray(profiles) ? profiles.filter((k) => typeof k === 'string') : [];
    const saved = await setPauseProfiles(clean);
    res.json({ profiles: saved, saved: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save pause profile config', error: error.message });
  }
};

const pause = async (req, res) => {
  const admin = await verifyPassword(req, res);
  if (!admin) return;

  try {
    const { source } = req.body || {};
    const src = source || (admin.role === 'SOFTWARE_SETTINGS' ? 'Software Settings' : 'Admin Dashboard');
    const state = await pauseSystem({ by: admin.name, byId: admin.id, source: src });
    await broadcastSystemEvent(req, 'PAUSE', admin.name, state.profiles);
    res.json({ ...state, message: PAUSED_MESSAGE });
  } catch (error) {
    res.status(500).json({ message: 'Failed to pause system', error: error.message });
  }
};

const resume = async (req, res) => {
  const admin = await verifyPassword(req, res);
  if (!admin) return;

  try {
    const { source } = req.body || {};
    const src = source || (admin.role === 'SOFTWARE_SETTINGS' ? 'Software Settings' : 'Admin Dashboard');
    const state = await resumeSystem({ by: admin.name, byId: admin.id, source: src });
    // Notify the profiles that were actually paused (from the period just closed).
    const lastPeriod = state.periods?.[state.periods.length - 1];
    await broadcastSystemEvent(req, 'RESUME', admin.name, lastPeriod?.profiles || []);
    res.json({ ...state, message: 'System resumed. All functions are now active.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resume system', error: error.message });
  }
};

module.exports = { getState, getHistory, getPauseProfileConfig, updatePauseProfileConfig, pause, resume };
