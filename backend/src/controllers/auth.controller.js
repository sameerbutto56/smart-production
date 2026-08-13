const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { deviceGate, getClientIp, DEVICE_PROFILE_DISABLED_MESSAGE } = require('./device.controller');

const register = async (req, res) => {
  const { name, email, password, role, employeeId } = req.body;

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        employeeId
      }
    });

    res.status(201).json({ message: 'User created successfully', user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

const login = async (req, res) => {
  const { email, password, deviceId, deviceName, registrationCode } = req.body;

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(401).json({ message: 'Wrong email — no account found with this email address' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Wrong password — please try again' });
    }
    if (user.isActive === false) {
      return res.status(403).json({ message: DEVICE_PROFILE_DISABLED_MESSAGE });
    }

    // Device authorization gate — unknown computers are blocked with a fixed
    // message and a PENDING request is created for Software Settings.
    const device = await deviceGate(user, {
      deviceId,
      deviceName,
      registrationCode,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });
    if (!device.allowed) {
      return res.status(401).json({ message: device.message, code: device.code });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Record the login session (best-effort — a recording failure must never block login).
    try {
      await prisma.loginSession.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          role: user.role,
          deviceId: deviceId || null,
          deviceName: deviceName || null,
          ip: getClientIp(req) || null,
          userAgent: req.headers['user-agent'] || null,
          status: 'ACTIVE'
        }
      });
    } catch (sessionErr) {
      console.error('LOGIN SESSION RECORD ERROR:', sessionErr.message);
    }

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error('LOGIN ERROR:', error.message, error.stack);
    const msg = error.message?.includes('connect')
      ? 'Database connection error — please try again in a moment'
      : 'Error logging in — ' + (error.message || 'unknown error');
    res.status(500).json({ message: msg, error: error.message });
  }
};

// Closes the most recent ACTIVE login session for the logged-out user (best-effort,
// called fire-and-forget from the frontend so a failed call never blocks sign-out).
const logout = async (req, res) => {
  try {
    const deviceId = req.body?.deviceId || null;
    const where = { userId: req.user.id, status: 'ACTIVE' };
    if (deviceId) where.deviceId = deviceId;

    const active = await prisma.loginSession.findFirst({
      where,
      orderBy: { loginAt: 'desc' },
      select: { id: true }
    });
    if (active) {
      await prisma.loginSession.update({
        where: { id: active.id },
        data: { logoutAt: new Date(), status: 'LOGGED_OUT' }
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('LOGOUT SESSION ERROR:', error.message);
    res.status(500).json({ message: 'Error recording logout', error: error.message });
  }
};

// Login history used by Admin Dashboard "Profile Login Time" and Software Settings.
// SOFTWARE_SETTINGS / SUPER_ADMIN / ADMIN only.
const getLoginSessions = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sessions = await prisma.loginSession.findMany({
      where: {
        loginAt: { gte: since },
        ...(req.query.role ? { role: String(req.query.role) } : {}),
        ...(req.query.userId ? { userId: String(req.query.userId) } : {}),
        ...(req.query.status ? { status: String(req.query.status) } : {})
      },
      orderBy: { loginAt: 'desc' },
      take: limit
    });

    const activeCount = await prisma.loginSession.count({ where: { status: 'ACTIVE' } });

    res.json({ sessions, activeCount });
  } catch (error) {
    console.error('LOGIN SESSIONS ERROR:', error.message);
    res.status(500).json({ message: 'Error fetching login sessions', error: error.message });
  }
};

module.exports = { register, login, logout, getLoginSessions };
