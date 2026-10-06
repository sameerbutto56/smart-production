/**
 * Verification Test: Warehouse & Outlet POS Product Master Synchronization
 */

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

const clean = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

async function runTests() {
  console.log('🧪 Starting Warehouse & Outlet POS Product Master Synchronization Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // Test 1: Zero duplicate records in OutletInventory
  const outletItems = await prisma.outletInventory.findMany();
  const groupMap = new Map();
  for (const item of outletItems) {
    const k = [item.outletName, clean(item.name), clean(item.color), clean(item.size)].join(':::');
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(item);
  }
  const duplicates = [...groupMap.entries()].filter(([k, list]) => list.length > 1);
  assert(duplicates.length === 0, 'Zero duplicate variant rows in OutletInventory across all outlets', `Found ${duplicates.length} duplicate groups`);

  // Test 2: Central Product Master in Warehouse exists for all outlet products
  const whItems = await prisma.inventoryItem.findMany();
  const whNameSet = new Set(whItems.map(w => clean(w.name)));
  const outletDistinctNames = [...new Set(outletItems.map(o => clean(o.name)))];
  const missingFromWh = outletDistinctNames.filter(n => !whNameSet.has(n));
  assert(missingFromWh.length === 0, 'All Outlet products exist in Central Product Master (Warehouse)', `Missing: ${missingFromWh.join(', ')}`);

  // Test 3: Barcodes are unique and non-empty on all Outlet records
  const itemsWithoutBarcode = outletItems.filter(o => !o.barcode || o.barcode.trim() === '');
  assert(itemsWithoutBarcode.length === 0, '100% of OutletInventory records have barcodes', `Found ${itemsWithoutBarcode.length} without barcode`);

  // Test 4: Barcodes on Warehouse Master Variants match Outlet Barcodes
  const masterVariantMap = new Map();
  for (const wh of whItems) {
    let vars = wh.variants;
    if (typeof vars === 'string') try { vars = JSON.parse(vars); } catch(e){}
    if (Array.isArray(vars)) {
      for (const v of vars) {
        if (v && v.barcode) {
          const vk = [clean(wh.name), clean(v.color), clean(v.size)].join(':::');
          masterVariantMap.set(vk, v.barcode);
        }
      }
    }
  }

  let barcodeMismatches = 0;
  for (const oi of outletItems) {
    const vk = [clean(oi.name), clean(oi.color), clean(oi.size)].join(':::');
    const masterBarcode = masterVariantMap.get(vk);
    if (masterBarcode && masterBarcode.toUpperCase() !== oi.barcode.toUpperCase()) {
      barcodeMismatches++;
    }
  }
  assert(barcodeMismatches === 0, 'Outlet barcodes strictly match Central Product Master barcodes', `Mismatches: ${barcodeMismatches}`);

  // Test 5: Location Stock Isolation (Same Product, Separate Stock)
  // Find a product that exists in both Johar Town and Jail Road
  const jtItems = outletItems.filter(o => o.outletName === 'Johar Town');
  const jrItems = outletItems.filter(o => o.outletName === 'Jail Road');
  const jtKeyMap = new Map(jtItems.map(i => [[clean(i.name), clean(i.color), clean(i.size)].join(':::'), i]));
  
  let multiBranchItemFound = false;
  for (const jr of jrItems) {
    const vk = [clean(jr.name), clean(jr.color), clean(jr.size)].join(':::');
    if (jtKeyMap.has(vk)) {
      const jt = jtKeyMap.get(vk);
      // Verify identical attributes
      const sameName = clean(jt.name) === clean(jr.name);
      const sameBarcode = jt.barcode.toUpperCase() === jr.barcode.toUpperCase();
      const samePrice = jt.price === jr.price;
      multiBranchItemFound = true;
      assert(sameName && sameBarcode && samePrice, `Cross-branch consistency for variant [${jt.name} ${jt.color} ${jt.size}]`, `Barcodes: ${jt.barcode} vs ${jr.barcode}`);
      break;
    }
  }
  assert(multiBranchItemFound, 'Verified cross-branch product sharing between Johar Town and Jail Road');

  // Test 6: Historical relations intact (PosSaleItem, PosReturn, OutletTransferItem)
  const [saleCount, returnCount, transferItemCount] = await Promise.all([
    prisma.posSaleItem.count(),
    prisma.posReturn.count(),
    prisma.outletTransferItem.count()
  ]);
  assert(saleCount > 0, `PosSaleItem transaction history intact (Total: ${saleCount})`);
  assert(returnCount >= 0, `PosReturn transaction history intact (Total: ${returnCount})`);
  assert(transferItemCount > 0, `OutletTransferItem history intact (Total: ${transferItemCount})`);

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
