/**
 * verify-gender-conditional.cjs
 * 
 * Comprehensive automated test suite verifying product-dependent conditional
 * gender validation across backend and database for Order Entry.
 * 
 * Run with: node backend/scripts/verify-gender-conditional.cjs
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isProductGenderApplicable, isCategoryGenderApplicable, getCategoryConfigs } = require('../src/utils/productConfig');

async function main() {
  console.log('=== VERIFYING CONDITIONAL GENDER VALIDATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Category Configurations in DB
  console.log('1. Checking ProductCategoryConfig in DB:');
  const catConfigs = await getCategoryConfigs();
  assert(catConfigs !== null, 'Category configs loaded from DB');
  assert(isCategoryGenderApplicable('SCRUBS', catConfigs) === true, 'SCRUBS is gender applicable');
  assert(isCategoryGenderApplicable('LABCOAT', catConfigs) === true, 'LABCOAT is gender applicable');
  assert(isCategoryGenderApplicable('INNER TEES', catConfigs) === true, 'INNER TEES is gender applicable');
  assert(isCategoryGenderApplicable('CAPS', catConfigs) === false, 'CAPS is NOT gender applicable');
  assert(isCategoryGenderApplicable('BOTTLE', catConfigs) === false, 'BOTTLE is NOT gender applicable');
  assert(isCategoryGenderApplicable('UNSTICH', catConfigs) === false, 'UNSTICH is NOT gender applicable');
  assert(isCategoryGenderApplicable('SLEEVES', catConfigs) === false, 'SLEEVES is NOT gender applicable');
  assert(isCategoryGenderApplicable('BAG', catConfigs) === false, 'BAG is NOT gender applicable');
  assert(isCategoryGenderApplicable('SHOES', catConfigs) === false, 'SHOES is NOT gender applicable');
  assert(isCategoryGenderApplicable('CLOGS', catConfigs) === false, 'CLOGS is NOT gender applicable');

  // 2. Product-level gender applicability evaluation
  console.log('\n2. Checking isProductGenderApplicable utility:');
  assert(isProductGenderApplicable({ name: 'Sprinter Men', category: 'SCRUBS' }, null, catConfigs) === true, 'Sprinter Men scrub is gender applicable');
  assert(isProductGenderApplicable({ name: 'Lab-Coat Women Helium', category: 'LABCOAT' }, null, catConfigs) === true, 'Lab-Coat is gender applicable');
  assert(isProductGenderApplicable({ name: 'Matching Cap', category: 'CAPS' }, null, catConfigs) === false, 'Matching Cap is NOT gender applicable');
  assert(isProductGenderApplicable({ name: 'Temperature Bottle', category: 'BOTTLE' }, null, catConfigs) === false, 'Temperature Bottle is NOT gender applicable');
  assert(isProductGenderApplicable({ name: 'Unstich Fabric', category: 'UNSTICH' }, null, catConfigs) === false, 'Unstich Fabric is NOT gender applicable');

  // 3. Test Order Creation: Test 1 — Gender Product missing gender (Must Fail)
  console.log('\n3. Test 1 — Gender product (Shirt/Scrub) without gender:');
  const testOrderNo1 = `TEST-GEN-FAIL-${Date.now()}`;
  try {
    const item = { productDetails: { productType: 'Sprinter Men', category: 'SCRUBS', gender: '' } };
    const isGenderReq = isProductGenderApplicable(item, null, catConfigs);
    const g = item.productDetails.gender;
    const isValid = !isGenderReq || (typeof g === 'string' && ['Male', 'Female'].includes(g.trim()));
    assert(isValid === false, 'Rejected when gender is missing for SCRUBS');
  } catch (e) {
    assert(false, `Unexpected error: ${e.message}`);
  }

  // 4. Test 2 — Male Gender Product (Must Succeed)
  console.log('\n4. Test 2 — Gender product with Male:');
  const testOrderNo2 = `TEST-GEN-MALE-${Date.now()}`;
  const orderMale = await prisma.order.create({
    data: {
      orderNumber: testOrderNo2,
      customerName: 'Test Customer Male',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      totalPrice: 2500,
      productDetails: [{ productType: 'Sprinter Men', category: 'SCRUBS', gender: 'Male', color: 'Navy', size: 'M' }],
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY',
    }
  });
  assert(orderMale.id && orderMale.orderNumber === testOrderNo2, 'Order created with Male gender');
  assert(orderMale.productDetails[0].gender === 'Male', 'productDetails preserves Male gender');

  // 5. Test 3 — Female Gender Product (Must Succeed)
  console.log('\n5. Test 3 — Gender product with Female:');
  const testOrderNo3 = `TEST-GEN-FEM-${Date.now()}`;
  const orderFem = await prisma.order.create({
    data: {
      orderNumber: testOrderNo3,
      customerName: 'Test Customer Female',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      totalPrice: 2500,
      productDetails: [{ productType: 'Crown Women', category: 'SCRUBS', gender: 'Female', color: 'Teal', size: 'S' }],
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY',
    }
  });
  assert(orderFem.id && orderFem.orderNumber === testOrderNo3, 'Order created with Female gender');
  assert(orderFem.productDetails[0].gender === 'Female', 'productDetails preserves Female gender');

  // 6. Test 4 — Cap (Must Succeed with gender = null)
  console.log('\n6. Test 4 — Cap product without gender:');
  const testOrderNo4 = `TEST-GEN-CAP-${Date.now()}`;
  const itemCap = { productDetails: { productType: 'Matching Cap', category: 'CAPS', gender: null } };
  const isCapGenderReq = isProductGenderApplicable(itemCap, null, catConfigs);
  assert(isCapGenderReq === false, 'Cap is correctly identified as non-gender');
  const orderCap = await prisma.order.create({
    data: {
      orderNumber: testOrderNo4,
      customerName: 'Test Customer Cap',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      totalPrice: 500,
      productDetails: [{ productType: 'Matching Cap', category: 'CAPS', gender: null, color: 'Black' }],
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY',
    }
  });
  assert(orderCap.id && orderCap.productDetails[0].gender === null, 'Cap order stored with gender = NULL');

  // 7. Test 5 — Bottle (Must Succeed with gender = null)
  console.log('\n7. Test 5 — Bottle product without gender:');
  const testOrderNo5 = `TEST-GEN-BOT-${Date.now()}`;
  const itemBot = { productDetails: { productType: 'Temperature Bottle', category: 'BOTTLE', gender: null } };
  const isBotGenderReq = isProductGenderApplicable(itemBot, null, catConfigs);
  assert(isBotGenderReq === false, 'Bottle is correctly identified as non-gender');
  const orderBot = await prisma.order.create({
    data: {
      orderNumber: testOrderNo5,
      customerName: 'Test Customer Bottle',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      totalPrice: 1200,
      productDetails: [{ productType: 'Temperature Bottle', category: 'BOTTLE', gender: null }],
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY',
    }
  });
  assert(orderBot.id && orderBot.productDetails[0].gender === null, 'Bottle order stored with gender = NULL');

  // 8. Test 6 — Unstitched Fabric (Must Succeed with gender = null)
  console.log('\n8. Test 6 — Unstitched Fabric product without gender:');
  const testOrderNo6 = `TEST-GEN-UNST-${Date.now()}`;
  const itemUnst = { productDetails: { productType: 'Unstich Fabric', category: 'UNSTICH', gender: null } };
  const isUnstGenderReq = isProductGenderApplicable(itemUnst, null, catConfigs);
  assert(isUnstGenderReq === false, 'Unstitched Fabric is correctly identified as non-gender');
  const orderUnst = await prisma.order.create({
    data: {
      orderNumber: testOrderNo6,
      customerName: 'Test Customer Fabric',
      customerPhone: '03001234567',
      address: 'Test Address',
      city: 'Lahore',
      type: 'STANDARD',
      totalPrice: 3000,
      productDetails: [{ productType: 'Unstich Fabric', category: 'UNSTICH', gender: null, color: 'Navy' }],
      status: 'PENDING',
      currentStage: 'ORDER_ENTRY',
    }
  });
  assert(orderUnst.id && orderUnst.productDetails[0].gender === null, 'Unstitched Fabric order stored with gender = NULL');

  // 9. Test 7 — Mixed Order (Multi-item: Scrubs + Cap + Bottle + Unstitched Fabric)
  console.log('\n9. Test 7 — Mixed Order Validation:');
  const mixedItemsValid = [
    { productDetails: { productType: 'Sprinter Men', category: 'SCRUBS', gender: 'Male' } },
    { productDetails: { productType: 'Lab-Coat Women Helium', category: 'LABCOAT', gender: 'Female' } },
    { productDetails: { productType: 'Matching Cap', category: 'CAPS', gender: null } },
    { productDetails: { productType: 'Temperature Bottle', category: 'BOTTLE', gender: null } },
    { productDetails: { productType: 'Unstich Fabric', category: 'UNSTICH', gender: null } },
  ];

  let allMixedValid = true;
  for (const it of mixedItemsValid) {
    const isGReq = isProductGenderApplicable(it, null, catConfigs);
    const g = it.productDetails.gender;
    if (isGReq && (!g || !['Male', 'Female'].includes(g))) {
      allMixedValid = false;
    }
  }
  assert(allMixedValid === true, 'Mixed order with valid genders on apparel and null on non-apparel passes');

  const mixedItemsInvalid = [
    { productDetails: { productType: 'Sprinter Men', category: 'SCRUBS', gender: '' } }, // Missing gender on scrub!
    { productDetails: { productType: 'Matching Cap', category: 'CAPS', gender: null } },
    { productDetails: { productType: 'Unstich Fabric', category: 'UNSTICH', gender: null } },
  ];
  let mixedInvalidDetected = false;
  for (const it of mixedItemsInvalid) {
    const isGReq = isProductGenderApplicable(it, null, catConfigs);
    const g = it.productDetails.gender;
    if (isGReq && (!g || !['Male', 'Female'].includes(g))) {
      mixedInvalidDetected = true;
    }
  }
  assert(mixedInvalidDetected === true, 'Mixed order fails when apparel item is missing gender');

  // 10. Clean up test orders
  console.log('\n10. Cleaning up test orders...');
  await prisma.order.deleteMany({
    where: {
      orderNumber: { in: [testOrderNo2, testOrderNo3, testOrderNo4, testOrderNo5, testOrderNo6] }
    }
  });
  console.log('✓ Cleaned up test orders');

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
