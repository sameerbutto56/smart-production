const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sha256 } = require('../src/utils/deviceAuth');

// Standalone seed for the Device Authorization gate (bootstrap device approval).
// Clears only DeviceAuthorization rows (never touches inventory/user data) and
// inserts pre-approved devices for the control profiles plus one registration-code
// row to demonstrate the one-time manual binding path.
//
// Run with: node backend/prisma/seed-device-authorization.js

// Pre-hashed rows (deviceCodeHash set, status APPROVED) are recognized by the
// automatic per-role lookup on login — no registration code needed. A
// registration-code row (registrationCode set, deviceCodeHash null, status
// APPROVED) binds to the first login that enters that code (the code is then
// nulled and the device hash written), demonstrating the manual one-time path.
const DEVICES = [
  // Deterministic pre-hashed rows (hash = sha256(deviceId), computed below).
  { role: 'SUPER_ADMIN', deviceName: 'Admin #1', deviceId: 'bootstrap-admin-1', status: 'APPROVED' },
  { role: 'ADMIN', deviceName: 'Admin #2', deviceId: 'bootstrap-admin-2', status: 'APPROVED' },
  { role: 'SOFTWARE_SETTINGS', deviceName: 'Software Settings - Office', deviceId: 'bootstrap-ss-office', status: 'APPROVED' },
  { role: 'CEO', deviceName: 'CEO Laptop', deviceId: 'bootstrap-ceo', status: 'APPROVED' },
  // Registration-code demo row (no hash yet — binds on first login with the code).
  { role: 'SOFTWARE_SETTINGS', deviceName: 'Registration-code demo (SS remote)', status: 'APPROVED', registrationCode: 'DEMO-SS' },
];

async function main() {
  // Clear existing device authorizations (no FKs into other modules).
  await prisma.deviceAuthorization.deleteMany({});

  // --- ROWS ---
  let hashed = 0;
  let codes = 0;
  for (const d of DEVICES) {
    const row = {
      deviceCodeHash: d.deviceId ? sha256(d.deviceId) : null,
      registrationCode: d.deviceId ? null : (d.registrationCode || null),
      deviceName: d.deviceName,
      assignedRole: d.role,
      status: d.status || 'APPROVED',
      requestNote: 'Seeded for bootstrap.',
      approvedBy: 'SEED',
      approvedAt: new Date(),
    };
    await prisma.deviceAuthorization.create({ data: row });
    if (row.deviceCodeHash) hashed += 1;
    if (row.registrationCode) codes += 1;
  }

  console.log(`✓ Device authorization seed completed (${DEVICES.length} rows)`);
  console.log('');
  console.log('=== DEVICE AUTHORIZATION SEED ===');
  console.log(` Rows: ${DEVICES.length}`);
  console.log(` Pre-hashed auto-lookup rows: ${hashed}`);
  console.log(` Registration-code rows: ${codes}`);
  console.log(' Roles: SUPER_ADMIN, ADMIN, SOFTWARE_SETTINGS, CEO');
  console.log(' Note: SOFTWARE_SETTINGS cannot self-register at runtime; the seeded row lets its device log in immediately.');
  console.log(' Note: the DEMO-SS row binds on first login with registrationCode DEMO-SS (code is then consumed to null).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });