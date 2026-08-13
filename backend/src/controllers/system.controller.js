const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const {
  PAUSED_MESSAGE,
  getSystemState,
  getSystemHistory,
  pauseSystem,
  resumeSystem,
} = require('../utils/systemPause');
const notify = require('../utils/notify');

// Every distinct role that has at least one protected route — pause/resume
// broadcasts a notification to all of them so every profile sees the change.
const NOTIFY_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'CEO', 'FAISAL',
  'STORE', 'STORE_EMPLOYEE',
  'PRODUCTION', 'PRODUCTION_IN', 'PRODUCTION_OUT',
  'LOGO_DESIGN', 'LOGO_DESIGN_EMPLOYEE', 'LOGO_DESIGNER',
  'DISPATCH', 'MAIN_EMPLOYEE',
  'OUTLET', 'ORDER_ENTRY', 'INVENTORY_VIEW',
  'DELIVERY_BOY', 'SOFTWARE_SETTINGS',
];

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

const broadcastSystemEvent = async (req, action, byName, source = '') => {
  const isPause = action === 'PAUSE';
  const title = isPause ? 'System Paused' : 'System Resumed';
  const fromSettings = /settings/i.test(source);
  const message = isPause
    ? (fromSettings
        ? `${byName} paused the system. All functions are currently stopped.`
        : 'Admin paused the system. All functions are currently stopped.')
    : (fromSettings
        ? `${byName} resumed the system. All functions are now active.`
        : 'System resumed. All functions are now active.');
  for (const role of NOTIFY_ROLES) {
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
    res.json(state);
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

const pause = async (req, res) => {
  const admin = await verifyPassword(req, res);
  if (!admin) return;

  try {
    const { source } = req.body || {};
    const src = source || (admin.role === 'SOFTWARE_SETTINGS' ? 'Software Settings' : 'Admin Dashboard');
    const state = await pauseSystem({ by: admin.name, byId: admin.id, source: src });
    await broadcastSystemEvent(req, 'PAUSE', admin.name, src);
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
    await broadcastSystemEvent(req, 'RESUME', admin.name, src);
    res.json({ ...state, message: 'System resumed. All functions are now active.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to resume system', error: error.message });
  }
};

module.exports = { getState, getHistory, pause, resume };
