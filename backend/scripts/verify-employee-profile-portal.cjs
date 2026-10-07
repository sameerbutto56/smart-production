const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = require('../src/app');
let server;
let BASE_URL;

async function verify() {
  console.log('=== VERIFYING EMPLOYEE PROFILE & EMPLOYEE LOGIN PORTAL ===\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}`;
      console.log(`Test server running on ${BASE_URL}`);
      resolve();
    });
  });

  // Step 1: Verify employee record exists in DB
  console.log('1. Checking default employee record in database...');
  const emp = await prisma.employeeRecord.findFirst({
    where: { loginEmail: 'employee@enamel.com' }
  });
  if (!emp) {
    throw new Error('Default employee record employee@enamel.com not found');
  }
  console.log(`✓ Found employee record: [${emp.employeeId}] ${emp.name} | Status: ${emp.status} | LoginEnabled: ${emp.loginEnabled}`);

  // Step 2: Test Employee Portal Login
  console.log('\n2. Testing POST /api/employee-portal/auth/login with Enamel12312...');
  const loginRes = await fetch(`${BASE_URL}/api/employee-portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@enamel.com', password: 'Enamel12312' })
  });
  const loginData = await loginRes.json();
  if (!loginData?.success || !loginData?.token) {
    throw new Error('Employee portal login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  console.log(`✓ Login successful! Token received. Employee: ${loginData.employee.name} (${loginData.employee.employeeId})`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Step 3: Test Dashboard & Ownership Isolation
  console.log('\n3. Testing GET /api/employee-portal/dashboard...');
  const dashRes = await fetch(`${BASE_URL}/api/employee-portal/dashboard`, { headers: authHeaders });
  const dashData = await dashRes.json();
  if (!dashData?.success || dashData.employee.employeeId !== 'EMP-001') {
    throw new Error('Dashboard returned incorrect employee data: ' + JSON.stringify(dashData));
  }
  console.log(`✓ Dashboard loaded for: ${dashData.employee.name} | Salary: Rs. ${dashData.employee.monthlySalary}`);
  console.log(`  Attendance summary: Present=${dashData.attendanceSummary?.presentDays}, Absent=${dashData.attendanceSummary?.absentDays}`);

  // Step 4: Test Attendance
  console.log('\n4. Testing GET /api/employee-portal/attendance...');
  const attRes = await fetch(`${BASE_URL}/api/employee-portal/attendance?monthYear=2026-09`, { headers: authHeaders });
  const attData = await attRes.json();
  if (!attData?.success || !Array.isArray(attData.records)) {
    throw new Error('Attendance records failed: ' + JSON.stringify(attData));
  }
  console.log(`✓ Attendance records: ${attData.records.length} days found for September 2026`);

  // Step 5: Test Leaves
  console.log('\n5. Testing GET /api/employee-portal/leaves...');
  const leaveRes = await fetch(`${BASE_URL}/api/employee-portal/leaves`, { headers: authHeaders });
  const leaveData = await leaveRes.json();
  if (!leaveData?.success) {
    throw new Error('Leaves failed: ' + JSON.stringify(leaveData));
  }
  console.log(`✓ Leaves: Allowed=${leaveData.allowedLeaves}, Used=${leaveData.usedLeaves}, Remaining=${leaveData.remainingLeaves}`);

  // Step 6: Test Loans
  console.log('\n6. Testing GET /api/employee-portal/loans...');
  const loanRes = await fetch(`${BASE_URL}/api/employee-portal/loans`, { headers: authHeaders });
  const loanData = await loanRes.json();
  if (!loanData?.success) {
    throw new Error('Loans failed: ' + JSON.stringify(loanData));
  }
  console.log(`✓ Loans: Active loans count = ${loanData.loans?.length || 0}`);

  // Step 7: Test Payroll
  console.log('\n7. Testing GET /api/employee-portal/payroll...');
  const payRes = await fetch(`${BASE_URL}/api/employee-portal/payroll`, { headers: authHeaders });
  const payData = await payRes.json();
  if (!payData?.success || !Array.isArray(payData.payrolls)) {
    throw new Error('Payroll failed: ' + JSON.stringify(payData));
  }
  console.log(`✓ Payroll records: ${payData.payrolls.length} historical statements found`);
  if (payData.payrolls.length > 0) {
    const p = payData.payrolls[0];
    console.log(`  Latest slip: ${p.monthYear} | Net Pay: Rs. ${p.netPayable} | Status: ${p.status}`);
  }

  // Step 8: Test Production / Incentive
  console.log('\n8. Testing GET /api/employee-portal/production...');
  const prodRes = await fetch(`${BASE_URL}/api/employee-portal/production?monthYear=2026-09`, { headers: authHeaders });
  const prodData = await prodRes.json();
  if (!prodData?.success) {
    throw new Error('Production endpoint failed: ' + JSON.stringify(prodData));
  }
  console.log(`✓ Production info: Eligible=${prodData.isEligible}, Percentage=${prodData.productionPercentage}%`);

  // Step 9: Test Work & Sales Records
  console.log('\n9. Testing GET /api/employee-portal/work-records...');
  const workRes = await fetch(`${BASE_URL}/api/employee-portal/work-records`, { headers: authHeaders });
  const workData = await workRes.json();
  if (!workData?.success) {
    throw new Error('Work records endpoint failed: ' + JSON.stringify(workData));
  }
  console.log(`✓ Work records: ${workData.totalCount} entries found, total volume = Rs. ${workData.totalSalesVolume}`);

  // Step 10: Test Main Login Screen Endpoint (/api/auth/login)
  console.log('\n10. Testing POST /api/auth/login with employee credentials...');
  const mainLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@enamel.com', password: 'Enamel12312' })
  });
  const mainLoginData = await mainLoginRes.json();
  if (!mainLoginData?.token || mainLoginData?.user?.role !== 'EMPLOYEE') {
    throw new Error('Main auth login did not recognize employee role: ' + JSON.stringify(mainLoginData));
  }
  console.log(`✓ Main auth endpoint returned: Role=${mainLoginData.user.role}, Name=${mainLoginData.user.name}`);

  // Step 11: Security check - invalid password
  console.log('\n11. Testing security check (wrong password)...');
  const badLoginRes = await fetch(`${BASE_URL}/api/employee-portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'employee@enamel.com', password: 'WrongPassword999' })
  });
  if (badLoginRes.status === 401) {
    console.log('✓ Rejected correctly with HTTP 401 (Invalid email or password)');
  } else {
    throw new Error(`Expected HTTP 401 but got ${badLoginRes.status}`);
  }

  console.log('\n======================================================');
  console.log('ALL 11 VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)');
  console.log('======================================================\n');
}

verify().catch((err) => {
  console.error('\n❌ Verification Failed:', err.response?.data || err.message);
  process.exit(1);
}).finally(() => {
  if (server) server.close();
  prisma.$disconnect();
});
