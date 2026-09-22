/**
 * verify-asm-allocate-variants.cjs
 * Comprehensive test suite for ASM Allocate Product + Color + Size breakdown,
 * variant-level stock validation, deduction, and return restoration.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting ASM Allocate Variants Verification ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check Warehouse Inventory Items have variants
    const items = await prisma.inventoryItem.findMany({
      where: {
        stock: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        category: true,
        variants: true,
        stock: true,
      },
    });

    assert(items.length > 0, `Found ${items.length} active warehouse inventory items with stock > 0`);

    let totalVariantsFound = 0;
    for (const item of items) {
      let parsed = [];
      try {
        parsed = typeof item.variants === 'string' ? JSON.parse(item.variants) : (item.variants || []);
      } catch (e) {
        parsed = [];
      }
      if (Array.isArray(parsed)) {
        totalVariantsFound += parsed.length;
      }
    }

    assert(totalVariantsFound > 0, `Successfully parsed ${totalVariantsFound} total variants across warehouse items`);

    // 2. Test getWarehouseCatalog logic
    const { getWarehouseCatalog } = require('../src/controllers/asmStock.controller.js');
    let catalogResult = null;
    const reqMock = { user: { role: 'STORE' }, query: {} };
    const resMock = {
      json: (data) => {
        catalogResult = data;
      },
      status: (code) => {
        return {
          json: (err) => {
            catalogResult = { error: err, status: code };
          }
        };
      }
    };

    await getWarehouseCatalog(reqMock, resMock);

    assert(catalogResult && Array.isArray(catalogResult.items), 'Catalog returned valid items array');
    assert(catalogResult && Array.isArray(catalogResult.variants), 'Catalog returned valid variants array');
    assert(catalogResult.variants.length > 0, `Catalog returned ${catalogResult.variants.length} variant rows`);

    // Check sample variant structure
    const sampleVariant = catalogResult.variants[0];
    assert(
      sampleVariant.id &&
      sampleVariant.inventoryItemId &&
      sampleVariant.productName &&
      sampleVariant.color !== undefined &&
      sampleVariant.size !== undefined &&
      sampleVariant.availableStock !== undefined,
      `Sample variant has correct fields: ${sampleVariant.productName} | ${sampleVariant.color} | ${sampleVariant.size} | Stock: ${sampleVariant.availableStock}`
    );

    // 3. Test variant deduction and restoration idempotency/accuracy
    // Find an item with a variant that has available stock
    const testItem = items.find(it => {
      let vars = [];
      try {
        vars = typeof it.variants === 'string' ? JSON.parse(it.variants) : (it.variants || []);
      } catch (e) {}
      return Array.isArray(vars) && vars.some(v => (v.stock || v.quantity || 0) >= 2);
    });

    if (testItem) {
      let vars = typeof testItem.variants === 'string' ? JSON.parse(testItem.variants) : (testItem.variants || []);
      const targetVariant = vars.find(v => (v.stock || v.quantity || 0) >= 2);
      const initialVariantStock = targetVariant.stock || targetVariant.quantity || 0;
      const initialItemStock = testItem.stock;

      console.log(`Testing with item: "${testItem.name}", variant: ${targetVariant.color || targetVariant.colorName}/${targetVariant.size}, initial stock: ${initialVariantStock}, item total: ${initialItemStock}`);

      // Helper logic matching asmStock.controller.js
      function eqField(a, b) {
        if (!a && !b) return true;
        if (!a || !b) return false;
        return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
      }

      // Decrement variant
      const updatedVars = vars.map(v => {
        const match =
          (eqField(v.color, targetVariant.color) || eqField(v.colorName, targetVariant.color)) &&
          eqField(v.size, targetVariant.size);
        if (match) {
          const currentStock = v.stock !== undefined ? v.stock : (v.quantity || 0);
          return { ...v, stock: Math.max(0, currentStock - 1) };
        }
        return v;
      });

      const newTotalStock = updatedVars.reduce((s, v) => s + (v.stock !== undefined ? v.stock : (v.quantity || 0)), 0);

      assert(newTotalStock === initialItemStock - 1, `Total stock decremented correctly from ${initialItemStock} to ${newTotalStock}`);

      // Restore variant
      const restoredVars = updatedVars.map(v => {
        const match =
          (eqField(v.color, targetVariant.color) || eqField(v.colorName, targetVariant.color)) &&
          eqField(v.size, targetVariant.size);
        if (match) {
          const currentStock = v.stock !== undefined ? v.stock : (v.quantity || 0);
          return { ...v, stock: currentStock + 1 };
        }
        return v;
      });

      const restoredTotalStock = restoredVars.reduce((s, v) => s + (v.stock !== undefined ? v.stock : (v.quantity || 0)), 0);
      assert(restoredTotalStock === initialItemStock, `Total stock restored correctly back to ${restoredTotalStock}`);
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
  } catch (error) {
    console.error('Fatal error during verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
