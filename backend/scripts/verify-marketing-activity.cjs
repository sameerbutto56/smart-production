const prisma = require('../src/prisma');
const { createActivity } = require('../src/controllers/marketing.controller');

async function testMarketingActivity() {
  console.log('--- Step 1: Testing createActivity handler ---');

  // Find a marketing user or admin user
  const user = await prisma.user.findFirst({ where: { role: 'MARKETING' } });
  if (!user) {
    throw new Error('No user with role MARKETING found');
  }

  const req = {
    user: { id: user.id, name: user.name, role: user.role },
    headers: {},
    body: {
      area: 'Johar Town',
      location: 'G1 Market',
      hospitalName: 'Doctors Hospital',
      companyName: null,
      notes: 'Initial introduction visit',
      latitude: '31.4697',
      longitude: '74.2728',
      status: 'COMPLETED',
      source: 'GPS'
    },
    app: {
      get: (key) => null
    }
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };

  await createActivity(req, res);

  console.log('Result status code:', statusCode);
  console.log('Response data:', responseData);

  if (statusCode !== 201 || !responseData?.success) {
    throw new Error(`Failed to create activity: status=${statusCode}, data=${JSON.stringify(responseData)}`);
  }

  const createdId = responseData.activity.id;
  console.log('✅ Activity successfully created with ID:', createdId);

  // Clean up
  await prisma.marketingActivity.delete({ where: { id: createdId } });
  console.log('✅ Cleaned up test activity record.');

  console.log('\n🎉 ALL MARKETING ACTIVITY TESTS PASSED!');
}

testMarketingActivity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
