const prisma = require('../src/prisma');
const { lookupInvoiceForDeletion, getPaymentChangeOutlets } = require('../src/controllers/softwareSettings.controller');

async function test() {
  console.log('--- 1. Testing getPaymentChangeOutlets ---');
  let outletsResult = null;
  const mockResOutlets = {
    json: (data) => { outletsResult = data; },
    status: (code) => ({ json: (data) => { console.error('Error status:', code, data); } })
  };
  await getPaymentChangeOutlets({}, mockResOutlets);
  console.log('Outlets fetched:', outletsResult);

  if (!Array.isArray(outletsResult) || outletsResult.length === 0) {
    throw new Error('Outlets list is empty or invalid');
  }

  console.log('\n--- 2. Testing lookupInvoiceForDeletion with "RCP-20260928-00009" ---');
  let data1 = null;
  let status1 = 200;
  const mockRes1 = {
    status: (s) => ({ json: (d) => { status1 = s; data1 = d; } }),
    json: (d) => { data1 = d; }
  };
  await lookupInvoiceForDeletion({ query: { query: 'RCP-20260928-00009' } }, mockRes1);
  console.log('Status 1:', status1);
  console.log('Result 1 targetType:', data1?.targetType, 'receipt/invoice:', data1?.invoiceNumber, 'outlet:', data1?.outletName, 'totalAmount:', data1?.totalAmount);
  if (status1 !== 200 || !data1) {
    throw new Error('Lookup 1 failed: ' + JSON.stringify(data1));
  }

  console.log('\n--- 3. Testing lookupInvoiceForDeletion with "20260928-00009" ---');
  let data2 = null;
  let status2 = 200;
  const mockRes2 = {
    status: (s) => ({ json: (d) => { status2 = s; data2 = d; } }),
    json: (d) => { data2 = d; }
  };
  await lookupInvoiceForDeletion({ query: { query: '20260928-00009' } }, mockRes2);
  console.log('Status 2:', status2);
  console.log('Result 2 targetType:', data2?.targetType, 'receipt/invoice:', data2?.invoiceNumber);
  if (status2 !== 200 || !data2) {
    throw new Error('Lookup 2 failed: ' + JSON.stringify(data2));
  }

  console.log('\n--- 4. Testing lookup with outlet="Jail Road" ---');
  let data3 = null;
  let status3 = 200;
  const mockRes3 = {
    status: (s) => ({ json: (d) => { status3 = s; data3 = d; } }),
    json: (d) => { data3 = d; }
  };
  await lookupInvoiceForDeletion({ query: { query: '20260928-00009', outlet: 'Jail Road' } }, mockRes3);
  console.log('Status 3:', status3);
  if (status3 !== 200 || !data3) {
    throw new Error('Lookup 3 failed: ' + JSON.stringify(data3));
  }

  console.log('\n--- 5. Testing lookup with mismatched outlet="Johar Town" ---');
  let data4 = null;
  let status4 = 200;
  const mockRes4 = {
    status: (s) => ({ json: (d) => { status4 = s; data4 = d; } }),
    json: (d) => { data4 = d; }
  };
  await lookupInvoiceForDeletion({ query: { query: '20260928-00009', outlet: 'Johar Town' } }, mockRes4);
  console.log('Status 4 (expect 404):', status4, 'message:', data4?.message);
  if (status4 !== 404) {
    throw new Error('Expected 404 for mismatched outlet, got ' + status4);
  }

  console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

test().catch(async (e) => {
  console.error('Test failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
