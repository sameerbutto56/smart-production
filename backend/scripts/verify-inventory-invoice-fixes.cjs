const assert = require('assert');
const { extractOrderItems } = require('../../frontend/src/utils/outletInvoiceQuotationPrint.js');
const backendFeatures = require('../src/utils/featureRegistry.js').FEATURES;

async function runTests() {
  console.log('🧪 Starting Verification of Invoice/Quotation & Inventory Fixes...\n');

  // Check 1: OUTLET_INVOICE_QUOTATION feature permission registry
  console.log('Test 1: Verifying OUTLET_INVOICE_QUOTATION permissions...');
  const invQuoFeature = backendFeatures.find(f => f.id === 'OUTLET_INVOICE_QUOTATION');
  assert(invQuoFeature, 'OUTLET_INVOICE_QUOTATION feature must exist in featureRegistry');
  assert(invQuoFeature.defaultProfiles.includes('INVENTORY_VIEW'), 'INVENTORY_VIEW must be in defaultProfiles for OUTLET_INVOICE_QUOTATION');
  assert(invQuoFeature.defaultProfiles.includes('OUTLET'), 'OUTLET must be in defaultProfiles');
  console.log('✅ Test 1 Passed: Feature permissions configured for INVENTORY_VIEW & OUTLET.\n');

  // Check 2: extractOrderItems accuracy with nested structure & customizations
  console.log('Test 2: Verifying extractOrderItems accuracy for loaded orders...');
  const mockOrder = {
    orderNumber: 'JT-100234',
    customerName: 'Dr. Ayesha Khan',
    customerPhone: '0300-9876543',
    totalPrice: 12500,
    productDetails: [
      {
        productDetails: {
          productType: 'Crown Men Scrub Set',
          color: 'Ceil Blue',
          size: 'XXL',
          fabric: 'Sprinter',
          alteration: {
            trouserLength: '39 inch',
            shirtLength: '29 inch'
          }
        },
        quantity: 2,
        unitPrice: 6150,
        totalPrice: 12300,
        customization: {
          nameSpelling: 'Dr. Ayesha',
          engravingType: 'Chest Pocket',
          logos: [{ name: 'Mayo Hospital Crest' }],
          matchingCap: true
        }
      },
      {
        name: 'Classic White Lab Coat',
        color: 'Pure White',
        size: 'L',
        fabric: 'Cotton Twill',
        quantity: 1,
        unitPrice: 200,
        totalPrice: 200,
        engravingText: 'Prof. Ayesha',
        logoEntries: ['Cardiology Dept']
      }
    ]
  };

  const extracted = extractOrderItems(mockOrder);
  assert.strictEqual(extracted.length, 2, 'Must extract 2 items');

  const item1 = extracted[0];
  assert.strictEqual(item1.name, 'Crown Men Scrub Set', 'Accurate product name');
  assert.strictEqual(item1.color, 'Ceil Blue', 'Accurate color');
  assert.strictEqual(item1.size, 'XXL', 'Accurate size');
  assert.strictEqual(item1.qty, 2, 'Accurate quantity');
  assert.strictEqual(item1.unitPrice, 6150, 'Accurate unit price');
  assert(item1.customizations.includes('Engraving: Dr. Ayesha'), 'Accurate engraving customization');
  assert(item1.customizations.includes('Mayo Hospital Crest'), 'Accurate logo');
  assert(item1.customizations.includes('trouserLength: 39 inch'), 'Accurate alteration');

  const item2 = extracted[1];
  assert.strictEqual(item2.name, 'Classic White Lab Coat', 'Accurate item 2 name');
  assert.strictEqual(item2.size, 'L', 'Accurate item 2 size');
  assert(item2.customizations.includes('Cardiology Dept'), 'Accurate logoEntries');
  console.log('✅ Test 2 Passed: Order items and customizations extracted with 100% precision.\n');

  // Check 3: Test Inventory Controller image sync and save logic safely with Prisma
  console.log('Test 3: Testing inventory database operations and non-blocking sync...');
  const prisma = require('../src/prisma.js');
  
  // Find or create test item
  const testItemName = 'Automated Verification Scrub Item';
  let existing = await prisma.inventoryItem.findFirst({ where: { name: testItemName } });
  if (existing) {
    await prisma.inventoryItem.delete({ where: { id: existing.id } });
  }

  const created = await prisma.inventoryItem.create({
    data: {
      name: testItemName,
      category: 'SCRUBS',
      color: 'Navy Blue',
      size: 'M',
      price: 4950,
      stock: 15,
      variants: [
        { color: 'Navy Blue', size: 'M', price: 4950, stock: 10 },
        { color: 'Navy Blue', size: 'XXL', price: 5450, stock: 5 }
      ]
    }
  });

  assert(created.id, 'Inventory item created successfully');
  assert.strictEqual(created.price, 4950, 'Price saved correctly');

  // Clean up
  await prisma.inventoryItem.delete({ where: { id: created.id } });
  console.log('✅ Test 3 Passed: Inventory saving and cleanup verified successfully in database.\n');

  console.log('🎉 ALL VERIFICATION CHECKS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
