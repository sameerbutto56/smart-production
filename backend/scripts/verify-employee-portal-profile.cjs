const prisma = require('../src/prisma');
const employeePortalCtrl = require('../src/controllers/employeePortal.controller');

async function verify() {
  console.log('--- Verifying Employee Portal Profile Data ---');

  const req = {
    user: { employeeId: '02', name: 'MUHAMMAD SAJAWAL' }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; }
  };

  await employeePortalCtrl.getMyDashboard(req, res);

  if (statusCode !== 200 || !responseData?.success) {
    throw new Error('Failed to fetch dashboard, statusCode=' + statusCode);
  }

  const emp = responseData.employee;
  console.log('Employee Profile Data Received:');
  console.log('  Employee ID:', emp.employeeId);
  console.log('  Full Name:', emp.name);
  console.log('  Father Name:', emp.fatherName);
  console.log('  Phone:', emp.phone);
  console.log('  CNIC:', emp.cnic);
  console.log('  Address:', emp.address);
  console.log('  Date of Birth:', emp.dateOfBirth);
  console.log('  Designation:', emp.designation);
  console.log('  Department:', emp.department);
  console.log('  Branch:', emp.branch);
  console.log('  Salary:', emp.monthlySalary);
  console.log('  Login Email:', emp.loginEmail);

  if (emp.fatherName !== 'SHAKEEL') {
    throw new Error('Expected fatherName "SHAKEEL", got: ' + emp.fatherName);
  }
  if (emp.phone !== '03228504405') {
    throw new Error('Expected phone "03228504405", got: ' + emp.phone);
  }
  if (emp.cnic !== '3520203712921') {
    throw new Error('Expected cnic "3520203712921", got: ' + emp.cnic);
  }
  if (!emp.address || !emp.address.includes('EDEN VALUE HOMES')) {
    throw new Error('Expected address to contain EDEN VALUE HOMES, got: ' + emp.address);
  }
  if (emp.loginEmail !== 'samisajawal12@enamels.com') {
    throw new Error('Expected loginEmail "samisajawal12@enamels.com", got: ' + emp.loginEmail);
  }
  if (emp.passwordHash) {
    throw new Error('passwordHash MUST NOT be exposed in response!');
  }

  console.log('--- ALL CHECKS PASSED 100% ---');
}

verify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
