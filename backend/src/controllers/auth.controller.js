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

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error('LOGIN ERROR:', error.message, error.stack);
    const msg = error.message?.includes('connect')
      ? 'Database connection error — please try again in a moment'
      : 'Error logging in — ' + (error.message || 'unknown error');
    res.status(500).json({ message: msg, error: error.message });
  }
};

module.exports = { register, login };
