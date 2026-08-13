// Device authorization + main-profile management backend.
// Login gate: unknown devices are blocked and a PENDING request is created for
// Software Settings. Control roles (SUPER_ADMIN/ADMIN/SOFTWARE_SETTINGS/CEO) are
// auto-registered as APPROVED on first login so management can always be reached.
// Profile management targets the main `User` accounts (email/password login).
const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const {
  sha256,
  isControlRole,
  DEVICE_BLOCK_MESSAGE,
  DEVICE_DISABLED_MESSAGE,
  DEVICE_PROFILE_DISABLED_MESSAGE,
  generateRegistrationCode,
} = require('../utils/deviceAuth');

const VALID_DEVICE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DISABLED'];

const devicePublic = (d) => ({
  id: d.id,
  deviceName: d.deviceName,
  assignedRole: d.assignedRole,
  assignedUserId: d.assignedUserId,
  assignedUserName: d.assignedUser?.name || null,
  status: d.status,
  requestNote: d.requestNote,
  registrationCode: d.deviceCodeHash ? null : d.registrationCode,
  lastLoginAt: d.lastLoginAt,
  lastIp: d.lastIp,
  lastUserAgent: d.lastUserAgent,
  approvedBy: d.approvedBy,
  approvedAt: d.approvedAt,
  rejectedBy: d.rejectedBy,
  rejectedAt: d.rejectedAt,
  createdAt: d.createdAt,
});

/**
 * Core login gate used by auth.controller.js.
 * Returns { allowed, message?, code?, device? }.
 */
const deviceGate = async (user, { deviceId, deviceName, registrationCode, ip, userAgent }) => {
  const role = String(user?.role || '').toUpperCase().trim();

  // Control roles can always reach the system; auto-register their device as APPROVED.
  if (isControlRole(role)) {
    const hash = sha256(deviceId);
    const existing = deviceId
      ? await prisma.deviceAuthorization.findFirst({ where: { deviceCodeHash: hash, assignedRole: role } })
      : null;
    if (existing) {
      if (existing.status === 'APPROVED') {
        await prisma.deviceAuthorization.update({
          where: { id: existing.id },
          data: { lastLoginAt: new Date(), lastIp: ip || null, lastUserAgent: userAgent || null },
        });
        return { allowed: true, device: existing };
      }
      await prisma.deviceAuthorization.update({ where: { id: existing.id }, data: { status: 'APPROVED' } });
      return { allowed: true, device: existing };
    }
    const created = await prisma.deviceAuthorization.create({
      data: {
        deviceCodeHash: deviceId ? hash : null,
        deviceName: deviceName || null,
        assignedRole: role,
        status: 'APPROVED',
        lastLoginAt: new Date(),
        lastIp: ip || null,
        lastUserAgent: userAgent || null,
      },
    });
    return { allowed: true, device: created };
  }

  if (!deviceId) {
    return { allowed: false, message: DEVICE_BLOCK_MESSAGE, code: 'DEVICE_NOT_AUTHORIZED' };
  }

  const hash = sha256(deviceId);

  // Manual registration binding: an APPROVED unclaimed device record carries a
  // one-time registration code. Entering it on login binds this computer.
  if (registrationCode && String(registrationCode).trim()) {
    const code = String(registrationCode).trim().toUpperCase();
    const target = await prisma.deviceAuthorization.findFirst({
      where: { registrationCode: code, status: 'APPROVED', deviceCodeHash: null },
      include: { assignedUser: true },
    });
    if (target) {
      const roleMatch = target.assignedRole === role || (target.assignedUserId && target.assignedUserId === user.id);
      if (roleMatch) {
        const updated = await prisma.deviceAuthorization.update({
          where: { id: target.id },
          data: {
            deviceCodeHash: hash,
            registrationCode: null,
            deviceName: target.deviceName || deviceName || null,
            lastLoginAt: new Date(),
            lastIp: ip || null,
            lastUserAgent: userAgent || null,
          },
          include: { assignedUser: true },
        });
        return { allowed: true, device: updated };
      }
    }
  }

  // Role-scoped lookup: the same physical device keeps a separate row per
  // profile (deviceCodeHash is intentionally not unique across rows), so an
  // APPROVED row for one profile does not shadow another profile's row.
  const existing = await prisma.deviceAuthorization.findFirst({
    where: { deviceCodeHash: hash, assignedRole: role },
    include: { assignedUser: true },
  });

  if (existing) {
    if (existing.status === 'APPROVED') {
      if (existing.assignedRole === role || (existing.assignedUserId && existing.assignedUserId === user.id)) {
        await prisma.deviceAuthorization.update({
          where: { id: existing.id },
          data: { lastLoginAt: new Date(), lastIp: ip || null, lastUserAgent: userAgent || null },
        });
        return { allowed: true, device: existing };
      }
    }
    if (existing.status === 'DISABLED') {
      return { allowed: false, message: DEVICE_DISABLED_MESSAGE, code: 'DEVICE_DISABLED' };
    }
    // PENDING / REJECTED for this profile → still blocked; no duplicate request.
    return { allowed: false, message: DEVICE_BLOCK_MESSAGE, code: 'DEVICE_NOT_AUTHORIZED' };
  }

  // No row for this profile. If the device is approved under another profile,
  // record it on the request so Software Settings sees the cross-profile intent.
  const otherApproved = await prisma.deviceAuthorization.findFirst({
    where: { deviceCodeHash: hash, status: 'APPROVED' },
    select: { assignedRole: true },
  });

  await prisma.deviceAuthorization.create({
    data: {
      deviceCodeHash: hash,
      deviceName: deviceName || null,
      assignedRole: role,
      status: 'PENDING',
      requestNote: otherApproved
        ? `Device is approved for ${otherApproved.assignedRole} but attempted ${role}`
        : null,
      lastIp: ip || null,
      lastUserAgent: userAgent || null,
    },
  });
  return { allowed: false, message: DEVICE_BLOCK_MESSAGE, code: 'DEVICE_NOT_AUTHORIZED' };
};

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
};

/* ─── Device management ─── */

const getDevices = async (req, res) => {
  try {
    const devices = await prisma.deviceAuthorization.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assignedUser: { select: { id: true, name: true, role: true } } },
      take: 500,
    });
    res.json({ devices: devices.map(devicePublic) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch devices', error: error.message });
  }
};

const registerDevice = async (req, res) => {
  try {
    const { deviceName, assignedRole, assignedUserId } = req.body || {};
    const name = String(deviceName || '').trim();
    const role = String(assignedRole || '').trim().toUpperCase();
    if (!name) return res.status(400).json({ message: 'Device name is required' });
    if (!role) return res.status(400).json({ message: 'Profile (role) is required' });

    let code = generateRegistrationCode();
    let clash = await prisma.deviceAuthorization.findUnique({ where: { registrationCode: code } });
    while (clash) {
      code = generateRegistrationCode();
      clash = await prisma.deviceAuthorization.findUnique({ where: { registrationCode: code } });
    }

    const device = await prisma.deviceAuthorization.create({
      data: {
        deviceName: name,
        assignedRole: role,
        assignedUserId: assignedUserId || null,
        status: 'APPROVED',
        registrationCode: code,
        approvedBy: req.user?.name || null,
        approvedAt: new Date(),
      },
      include: { assignedUser: { select: { id: true, name: true, role: true } } },
    });

    res.status(201).json({ ok: true, device: devicePublic(device), registrationCode: code });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register device', error: error.message });
  }
};

const approveDevice = async (req, res) => {
  try {
    const device = await prisma.deviceAuthorization.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ message: 'Device request not found' });
    await prisma.deviceAuthorization.update({
      where: { id: device.id },
      data: { status: 'APPROVED', approvedBy: req.user?.name || null, approvedAt: new Date() },
    });
    res.json({ ok: true, message: `Device "${device.deviceName || 'Unknown'}" approved` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve device', error: error.message });
  }
};

const rejectDevice = async (req, res) => {
  try {
    const device = await prisma.deviceAuthorization.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ message: 'Device request not found' });
    await prisma.deviceAuthorization.update({
      where: { id: device.id },
      data: { status: 'REJECTED', rejectedBy: req.user?.name || null, rejectedAt: new Date() },
    });
    res.json({ ok: true, message: `Device request for "${device.deviceName || 'Unknown'}" rejected` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject device', error: error.message });
  }
};

const setDeviceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const device = await prisma.deviceAuthorization.findUnique({ where: { id } });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    if (!VALID_DEVICE_STATUSES.includes(String(status || '').toUpperCase())) {
      return res.status(400).json({ message: `status must be one of: ${VALID_DEVICE_STATUSES.join(', ')}` });
    }
    const next = String(status).toUpperCase();
    await prisma.deviceAuthorization.update({ where: { id }, data: { status: next } });
    res.json({ ok: true, message: `Device "${device.deviceName || 'Unknown'}" is now ${next}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update device', error: error.message });
  }
};

const removeDevice = async (req, res) => {
  try {
    const device = await prisma.deviceAuthorization.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    await prisma.deviceAuthorization.delete({ where: { id: device.id } });
    res.json({ ok: true, message: `Device "${device.deviceName || 'Unknown'}" removed` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove device', error: error.message });
  }
};

const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceName, assignedRole, assignedUserId } = req.body || {};
    const device = await prisma.deviceAuthorization.findUnique({ where: { id } });
    if (!device) return res.status(404).json({ message: 'Device not found' });

    const data = {};
    if (deviceName !== undefined) data.deviceName = String(deviceName || '').trim();
    if (assignedRole !== undefined) data.assignedRole = String(assignedRole || '').trim().toUpperCase();
    if (assignedUserId !== undefined) data.assignedUserId = assignedUserId || null;

    const updated = await prisma.deviceAuthorization.update({
      where: { id },
      data,
      include: { assignedUser: { select: { id: true, name: true, role: true } } },
    });
    res.json({ ok: true, device: devicePublic(updated), message: 'Device updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update device', error: error.message });
  }
};

/* ─── Main profile (User) management ─── */

const getProfiles = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
        _count: { select: { authorizedDevices: true } },
      },
    });
    res.json({ profiles: users });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profiles', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, isActive } = req.body || {};
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Profile not found' });

    const data = {};
    if (name !== undefined) {
      const clean = String(name || '').trim();
      if (!clean) return res.status(400).json({ message: 'Name is required' });
      data.name = clean;
    }
    if (email !== undefined) {
      const clean = String(email || '').trim().toLowerCase();
      if (!clean) return res.status(400).json({ message: 'Email is required' });
      const clash = await prisma.user.findUnique({ where: { email: clean } });
      if (clash && clash.id !== id) return res.status(409).json({ message: 'This email is already in use by another profile' });
      data.email = clean;
    }
    if (isActive !== undefined) data.isActive = !!isActive;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ ok: true, profile: updated, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

const resetProfilePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const newPass = String(password || '');
    if (newPass.length < 4) return res.status(400).json({ message: 'Password must be at least 4 characters' });
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'Profile not found' });
    await prisma.user.update({ where: { id }, data: { password: await bcrypt.hash(newPass, 10) } });
    res.json({ ok: true, message: `Password reset for ${user.name}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
  }
};

module.exports = {
  deviceGate,
  DEVICE_PROFILE_DISABLED_MESSAGE,
  getClientIp,
  getDevices,
  registerDevice,
  approveDevice,
  rejectDevice,
  setDeviceStatus,
  removeDevice,
  updateDevice,
  getProfiles,
  updateProfile,
  resetProfilePassword,
};
