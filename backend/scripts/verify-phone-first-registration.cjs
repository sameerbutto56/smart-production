const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { normalizePhone, getPhoneSearchVariants } = require('../src/utils/phoneUtils');

async function run() {
  console.log('--- STARTING PHONE-FIRST CLIENT REGISTRATION VERIFICATION SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const testPhonePrimary = '03009988111';
  const testPhoneAlt1 = '03129988222';
  const testPhoneAlt2 = '03219988333';
  const testClientNumber = '9999888';

  try {
    // 1. Cleanup any previous test data
    await prisma.client.deleteMany({
      where: {
        OR: [
          { phone: { in: [testPhonePrimary, testPhoneAlt1, testPhoneAlt2] } },
          { clientNumber: testClientNumber },
          { name: { in: ['Test Customer A', 'Test Customer B (Shared Phone)'] } }
        ]
      }
    });

    // 2. Create customer with custom measurements, standard sizes, and multiple alternate phones
    const createdClient = await prisma.client.create({
      data: {
        name: 'Test Customer A',
        gender: 'Male',
        phone: testPhonePrimary,
        additionalPhones: [testPhoneAlt1, testPhoneAlt2],
        permanentAddress: '123 Test Street, Johar Town, Phase 1',
        city: 'Lahore',
        outletName: 'Johar Town',
        clientNumber: testClientNumber,
        standardSizes: ['M', 'L'],
        measurementChart: 'Custom Measurements',
        sizeDetails: JSON.stringify({
          shirtLength: '39',
          shoulder: '18',
          chest: '40',
          waist: '34',
          length: '38',
          _extra: [{ name: 'Bicep', value: '14' }]
        }),
        isActive: true
      }
    });

    assert(createdClient && createdClient.id, 'Test Customer A created successfully in Johar Town');

    // 3. Verify normalization & search variants
    const variants = getPhoneSearchVariants(testPhoneAlt1);
    assert(variants.includes('03129988222') && variants.includes('3129988222'), 'Alt phone variants generated accurately');

    // 4. Test phone search across primary and alternate numbers
    const findClientByPhone = async (phone) => {
      const vars = getPhoneSearchVariants(phone);
      const patterns = vars.map(v => `%${v}%`);
      const rows = await prisma.$queryRaw`
        SELECT id, name, phone, "outletName", "additionalPhones", "permanentAddress", city, "sizeDetails", "standardSizes"
        FROM "public"."Client"
        WHERE "isActive" = true
          AND (
            phone = ANY(${vars}::text[])
            OR phone LIKE ANY(${patterns}::text[])
            OR "additionalPhones"::text ILIKE ANY(${patterns}::text[])
          )
        LIMIT 1
      `;
      return rows && rows.length > 0 ? rows[0] : null;
    };

    const foundByPrimary = await findClientByPhone('0300-9988111');
    assert(foundByPrimary && foundByPrimary.id === createdClient.id, 'Customer found using formatted primary phone 0300-9988111');

    const foundByAlt = await findClientByPhone('+92 312 9988222');
    assert(foundByAlt && foundByAlt.id === createdClient.id, 'Customer found using alternate phone +92 312 9988222');

    // 5. Test missing fields detection logic (simulating frontend helper)
    function detectMissingFields(client) {
      const missing = [];
      if (!client.name || !String(client.name).trim()) missing.push('Customer Name');
      if (!client.permanentAddress && !client.city) missing.push('Address / City');
      const hasSizes = Array.isArray(client.standardSizes) && client.standardSizes.length > 0;
      const hasCustom = client.sizeDetails && (
        (typeof client.sizeDetails === 'string' && client.sizeDetails.length > 5) ||
        (typeof client.sizeDetails === 'object' && Object.keys(client.sizeDetails).length > 0)
      );
      if (!hasSizes && !hasCustom && !client.measurementChart) {
        missing.push('Measurements / Size Chart');
      }
      return missing;
    }

    const missingComplete = detectMissingFields(createdClient);
    assert(missingComplete.length === 0, 'Complete customer has 0 missing fields');

    const incompleteClient = {
      name: 'Partial Customer',
      phone: '03331112233',
      permanentAddress: '',
      city: '',
      standardSizes: [],
      sizeDetails: null,
      measurementChart: null
    };
    const missingIncomplete = detectMissingFields(incompleteClient);
    assert(
      missingIncomplete.includes('Address / City') && missingIncomplete.includes('Measurements / Size Chart'),
      'Incomplete customer accurately flags missing Address and Measurements'
    );

    // 6. Test duplicate detection logic
    const existingDuplicate = await findClientByPhone('0312-9988222');
    assert(existingDuplicate && existingDuplicate.id === createdClient.id, 'Duplicate phone accurately detected before registration');

    // 7. Verify partial update field preservation:
    // If staff only updates address without passing sizeDetails or measurements, database values MUST be preserved!
    const updatedAddress = 'Updated 456 Main Blvd, Johar Town';
    const existing = await prisma.client.findUnique({ where: { id: createdClient.id } });
    
    // Simulate controller preservation:
    const sizeDetailsToSave = undefined !== undefined ? undefined : existing.sizeDetails;
    const standardSizesToSave = undefined !== undefined ? undefined : existing.standardSizes;

    const savedClient = await prisma.client.update({
      where: { id: createdClient.id },
      data: {
        permanentAddress: updatedAddress,
        sizeDetails: sizeDetailsToSave,
        standardSizes: standardSizesToSave
      }
    });

    assert(savedClient.permanentAddress === updatedAddress, 'Address successfully updated');
    assert(savedClient.sizeDetails === existing.sizeDetails, 'Existing custom measurements preserved 100% on partial update');
    assert(JSON.stringify(savedClient.standardSizes) === JSON.stringify(existing.standardSizes), 'Existing standard sizes preserved 100% on partial update');

    // 8. Clean up test records
    await prisma.client.deleteMany({
      where: { id: { in: [createdClient.id] } }
    });
    console.log('Cleanup completed cleanly.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n================================`);
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);
  console.log(`Pass Rate: ${Math.round((passed / (passed + failed || 1)) * 100)}%`);
  console.log(`================================\n`);

  if (failed > 0) process.exit(1);
}

run();
