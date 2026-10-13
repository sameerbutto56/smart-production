require('dotenv').config();
const prisma = require('../src/prisma');
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');

async function runTests() {
  console.log('--- RUNNING ATTENDANCE & DEDUCTIONS SYSTEM TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Pre-connect Prisma
  await prisma.$connect();

  // Setup express test app
  const app = express();
  app.use(express.json());
  const biometricRoutes = require('../src/routes/biometric.routes');
  const employeeRoutes = require('../src/routes/employee.routes');
  app.use('/api/biometric', biometricRoutes);
  app.use('/api/employees', employeeRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const secret = process.env.JWT_SECRET || 'enamels_jwt_secret_production_2026_super_secure_key_never_share';
  const token = jwt.sign(
    { id: '00000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN', name: 'Super Admin', username: 'admin' },
    secret,
    { expiresIn: '1h' }
  );

  // Test 1: Biometric Gateway Status
  console.log('\n[Test 1] Biometric Gateway Status & Verification');
  const bioRes = await fetch(`${baseUrl}/api/biometric/status`);
  const bioJson = await bioRes.json();
  assert(bioRes.status === 200, 'GET /api/biometric/status returns 200 OK');
  assert(bioJson.gateway?.model?.includes('DS-K1T342MFWX'), `Gateway model is Hikvision DS-K1T342MFWX: ${bioJson.gateway?.model}`);
  assert(bioJson.gateway?.totalRawPunches >= 2740, `Gateway reports ${bioJson.gateway?.totalRawPunches} total raw punches`);
  assert(bioJson.gateway?.lastPunch !== null, `Last punch received is recorded: ${bioJson.gateway?.lastPunch?.employeeName}`);
  assert(bioJson.gateway?.measuredLatency !== undefined, `Latency measured: ${bioJson.gateway?.measuredLatency}`);

  // Test 2: Deduction Cases for 2026-10
  console.log('\n[Test 2] Late Deduction Cases Generation (Three-Late Policy)');
  const casesRes = await fetch(`${baseUrl}/api/employees/deductions/cases?period=2026-10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const casesJson = await casesRes.json();
  assert(casesRes.status === 200, 'GET /api/employees/deductions/cases returns 200 OK');
  assert(Array.isArray(casesJson.cases), 'Returns cases array');
  assert(casesJson.summary !== undefined, 'Summary object present in deduction cases response');
  console.log('Deduction summary:', casesJson.summary);

  // Test 3: Individual Employee Attendance History & Traceable Lates
  console.log('\n[Test 3] Individual Employee Attendance History');
  // Find an employee with late records (e.g. Sajawal, Tahir, or any with late punches)
  const emp = await prisma.employeeRecord.findFirst({
    where: { status: 'ACTIVE', employeeId: '02' }
  }) || await prisma.employeeRecord.findFirst({ where: { status: 'ACTIVE' } });

  const histRes = await fetch(`${baseUrl}/api/employees/${emp.employeeId}/attendance-history?startDate=2026-10-01&endDate=2026-10-13`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const histJson = await histRes.json();
  assert(histRes.status === 200, `GET /api/employees/${emp.employeeId}/attendance-history returns 200 OK`);
  assert(histJson.employee?.name === emp.name, `Correct employee profile returned: ${emp.name}`);
  assert(Array.isArray(histJson.records), 'Records array returned');
  assert(Array.isArray(histJson.lateHistory), 'Traceable lateHistory array returned');
  assert(histJson.summary !== undefined, 'Summary stats returned');

  if (histJson.lateHistory.length > 0) {
    const firstLate = histJson.lateHistory[0];
    assert(firstLate.occurrenceNumber === 1, 'First late occurrence has occurrenceNumber === 1');
    assert(firstLate.lateMinutes > 0, `First late occurrence has lateMinutes: ${firstLate.lateMinutes}`);
    assert(firstLate.date !== undefined, `First late date: ${firstLate.date}`);
  }

  // Test 4: Admin Deduction Review & Audit Trail
  console.log('\n[Test 4] Admin Deduction Review Action (Waive / Accept)');
  const pendingCase = casesJson.cases.find(c => c.status === 'PENDING_REVIEW' && c.id);
  if (pendingCase) {
    const reviewRes = await fetch(`${baseUrl}/api/employees/deductions/${pendingCase.id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        decision: 'WAIVE',
        reason: 'Authorized waiver by Super Admin for testing audit flow'
      })
    });
    const reviewJson = await reviewRes.json();
    assert(reviewRes.status === 200, 'POST /api/employees/deductions/:id/review returns 200');
    assert(reviewJson.deductionCase?.status === 'WAIVED', 'Deduction status updated to WAIVED');
    assert(reviewJson.deductionCase?.approvedAmount === 0, 'Approved amount is 0 for waived deduction');

    // Verify audit log
    const auditLog = await prisma.attendanceAuditLog.findFirst({
      where: { employeeId: pendingCase.employeeId, attendanceDate: pendingCase.period },
      orderBy: { createdAt: 'desc' }
    });
    assert(auditLog !== null, 'AttendanceAuditLog record created for deduction review');
    assert(auditLog?.reason?.includes('Authorized waiver'), 'Audit log records admin reason');
  } else {
    console.log('ℹ️ Note: No PENDING_REVIEW case with an id found to review in test 4 (all under 3 lates or already reviewed).');
  }

  // Test 5: Payroll Pre-Check Warnings
  console.log('\n[Test 5] Payroll Pre-Check Warnings');
  const preCheckRes = await fetch(`${baseUrl}/api/employees/payroll/pre-check?monthYear=2026-10`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const preCheckJson = await preCheckRes.json();
  assert(preCheckRes.status === 200, 'GET /api/employees/payroll/pre-check returns 200 OK');
  assert(typeof preCheckJson.readyForPayroll === 'boolean', `readyForPayroll boolean returned: ${preCheckJson.readyForPayroll}`);
  assert(Array.isArray(preCheckJson.warnings), 'Warnings list returned');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  server.close();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
