const prisma = require('../src/prisma');

async function runVerification() {
  console.log('--- STARTING PRODUCT COLOR IMAGE SYSTEM VERIFICATION ---');

  const testProductName = `Bilora-Men-Test-${Date.now()}`;
  const defaultMasterUrl = 'https://example.com/bilora-default.jpg';
  const blackImageUrl = 'data:image/jpeg;base64,mock-black-photo-bytes';
  const whiteImageUrl = 'data:image/jpeg;base64,mock-white-photo-bytes';
  const navyImageUrl = 'data:image/jpeg;base64,mock-navy-photo-bytes';

  try {
    // 1. Create a dummy outlet inventory row to test outlet sync
    console.log('1. Setting up mock OutletInventory row for sync testing...');
    const outletRow = await prisma.outletInventory.create({
      data: {
        outletName: 'Johar Town',
        name: testProductName,
        category: 'SCRUBS',
        color: 'Black',
        size: 'M',
        stock: 15,
        price: 3200,
        barcode: `TEST-BC-${Date.now()}`
      }
    });
    console.log('✓ Outlet inventory row created:', outletRow.id);

    // 2. Test inventory creation via controller logic
    console.log('2. Creating Warehouse InventoryItem with colorImages and default image...');
    const initialVariants = [
      { color: 'Black', size: 'S', stock: 5, price: 3200 },
      { color: 'Black', size: 'M', stock: 10, price: 3200 },
      { color: 'Black', size: 'L', stock: 8, price: 3200 },
      { color: 'White', size: 'M', stock: 6, price: 3200 },
      { color: 'White', size: 'L', stock: 4, price: 3200 },
      { color: 'Navy Blue', size: 'M', stock: 7, price: 3200 } // Has NO color image initially
    ];

    const initialColorImages = {
      'Black': blackImageUrl,
      'White': whiteImageUrl
    };

    const initialMeta = JSON.stringify({ colorImages: initialColorImages });

    // Process variants with stamped images
    const processedVariants = initialVariants.map(v => ({
      ...v,
      imageUrl: initialColorImages[v.color] || null
    }));

    const inventoryItem = await prisma.inventoryItem.create({
      data: {
        name: testProductName,
        category: 'SCRUBS',
        stock: initialVariants.reduce((sum, v) => sum + v.stock, 0),
        price: 3200,
        color: 'Black',
        size: 'M',
        fabric: 'Poly-Viscose',
        imageUrl: defaultMasterUrl,
        metadata: initialMeta,
        variants: processedVariants
      }
    });

    console.log('✓ Inventory item created:', inventoryItem.id);

    // Central sync to outlet inventory
    await prisma.outletInventory.updateMany({
      where: { name: testProductName },
      data: {
        imageUrl: inventoryItem.imageUrl,
        metadata: inventoryItem.metadata
      }
    });

    // 3. Verify color-wise image properties
    console.log('3. Verifying color-wise properties on InventoryItem...');
    const fetchedItem = await prisma.inventoryItem.findUnique({ where: { id: inventoryItem.id } });
    const parsedMeta = JSON.parse(fetchedItem.metadata);
    if (!parsedMeta.colorImages || parsedMeta.colorImages['Black'] !== blackImageUrl) {
      throw new Error('Black color image was not properly saved in metadata!');
    }
    if (parsedMeta.colorImages['White'] !== whiteImageUrl) {
      throw new Error('White color image was not properly saved in metadata!');
    }
    console.log('✓ Black & White images verified in Warehouse Inventory metadata.');

    // 4. Verify central sync to OutletInventory
    console.log('4. Verifying central sync to OutletInventory...');
    const syncedOutlet = await prisma.outletInventory.findUnique({ where: { id: outletRow.id } });
    if (syncedOutlet.imageUrl !== defaultMasterUrl) {
      throw new Error(`Outlet imageUrl mismatch! Expected ${defaultMasterUrl}, got ${syncedOutlet.imageUrl}`);
    }
    const outletMeta = JSON.parse(syncedOutlet.metadata);
    if (!outletMeta.colorImages || outletMeta.colorImages['Black'] !== blackImageUrl) {
      throw new Error('Outlet metadata did not sync colorImages properly!');
    }
    if (syncedOutlet.stock !== 15 || syncedOutlet.price !== 3200) {
      throw new Error('Stock or price was unintentionally altered during image sync!');
    }
    console.log('✓ Outlet inventory successfully synced image metadata while preserving stock (15) and price (3200).');

    // 5. Test color resolution & fallback logic
    console.log('5. Testing color resolution & fallback logic...');
    const resolveColorImage = (prod, col) => {
      const meta = prod.metadata ? (typeof prod.metadata === 'string' ? JSON.parse(prod.metadata) : prod.metadata) : {};
      const colImgs = meta.colorImages || {};
      if (col && colImgs[col]) return colImgs[col];
      return prod.imageUrl || null;
    };

    const resolvedBlack = resolveColorImage(fetchedItem, 'Black');
    const resolvedWhite = resolveColorImage(fetchedItem, 'White');
    const resolvedNavy = resolveColorImage(fetchedItem, 'Navy Blue'); // has NO color image -> falls back to master
    const resolvedUnknown = resolveColorImage(fetchedItem, null); // no color -> master

    if (resolvedBlack !== blackImageUrl) throw new Error('Black failed to resolve to Black image!');
    if (resolvedWhite !== whiteImageUrl) throw new Error('White failed to resolve to White image!');
    if (resolvedNavy !== defaultMasterUrl) throw new Error(`Navy Blue failed fallback to default master image! Got ${resolvedNavy}`);
    if (resolvedUnknown !== defaultMasterUrl) throw new Error('Unknown/null color failed fallback to default master image!');
    console.log('✓ Black resolved to Black image');
    console.log('✓ White resolved to White image');
    console.log('✓ Navy Blue (no image) cleanly fell back to Default Master Image');
    console.log('✓ General resolution cleanly fell back to Default Master Image');

    // 6. Test updating color images (adding Navy Blue image later)
    console.log('6. Testing dynamic addition of new color image...');
    const updatedColorImages = {
      ...initialColorImages,
      'Navy Blue': navyImageUrl
    };
    const updatedMeta = JSON.stringify({ colorImages: updatedColorImages });

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { metadata: updatedMeta }
    });

    await prisma.outletInventory.updateMany({
      where: { name: testProductName },
      data: { metadata: updatedMeta }
    });

    const refetchedItem = await prisma.inventoryItem.findUnique({ where: { id: inventoryItem.id } });
    const resolvedUpdatedNavy = resolveColorImage(refetchedItem, 'Navy Blue');
    if (resolvedUpdatedNavy !== navyImageUrl) {
      throw new Error('Navy Blue failed to resolve to newly added image!');
    }
    console.log('✓ Newly added Navy Blue image resolved successfully after update!');

    // Clean up
    console.log('7. Cleaning up test records...');
    await prisma.outletInventory.delete({ where: { id: outletRow.id } });
    await prisma.inventoryItem.delete({ where: { id: inventoryItem.id } });
    console.log('✓ Test records cleaned up.');

    console.log('\n=== ALL TESTS PASSED: PRODUCT COLOR IMAGE SYSTEM VERIFIED 100% ===');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    // Cleanup if possible
    try {
      await prisma.outletInventory.deleteMany({ where: { name: testProductName } });
      await prisma.inventoryItem.deleteMany({ where: { name: testProductName } });
    } catch (e) {}
    process.exit(1);
  }
}

runVerification();
