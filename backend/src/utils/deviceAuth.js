// Device authorization gate for the main username/password login.
// Every computer presents a stable client-generated device ID; the backend
// stores a SHA-256 hash of it (never the raw ID). Login from an unknown device
// is blocked with a fixed message and a PENDING DeviceAuthorization request is
// created for Software Settings to approve/reject. Approved devices pass on
// every subsequent login with no re-verification until disabled/revoked.

const crypto = require('crypto');

const CONTROL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS', 'CEO'];

const DEVICE_BLOCK_MESSAGE = 'This device is not authorized. Please contact the Software Provider.';
const DEVICE_DISABLED_MESSAGE = 'This device has been disabled. Please contact the Software Provider.';
const DEVICE_PROFILE_DISABLED_MESSAGE = 'This profile has been disabled. Please contact the Software Provider.';

const sha256 = (input) => crypto.createHash('sha256').update(String(input || '')).digest('hex');

const isControlRole = (role) => CONTROL_ROLES.includes(String(role || '').toUpperCase().trim());

const generateRegistrationCode = () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return code;
};

module.exports = {
  CONTROL_ROLES,
  DEVICE_BLOCK_MESSAGE,
  DEVICE_DISABLED_MESSAGE,
  DEVICE_PROFILE_DISABLED_MESSAGE,
  sha256,
  isControlRole,
  generateRegistrationCode,
};
