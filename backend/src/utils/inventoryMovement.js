/**
 * Inventory Movement Logger
 * 
 * Rules 43 & 44: Every + / - quantity change must be traceable without creating duplicate products.
 * Supported Movement Types:
 * - TRANSFER_IN, TRANSFER_OUT
 * - WAREHOUSE_RECEIVE, OUTLET_RECEIVE
 * - DISPATCH, ACCEPT
 * - SALE, RETURN
 * - STOCK_IN, STOCK_OUT
 * - ADJUSTMENT, DAMAGE
 */

const defaultPrisma = require('../prisma');

const recordInventoryMovement = async ({
  movementType,
  location,
  productId = null,
  productName,
  color = null,
  size = null,
  barcode = null,
  previousQty = 0,
  newQty = 0,
  difference = 0,
  referenceId = null,
  notes = null,
  performedBy = null,
  tx = null
}) => {
  const db = tx || defaultPrisma;
  try {
    const calcDiff = difference !== undefined ? difference : (newQty - previousQty);
    return await db.inventoryMovementLog.create({
      data: {
        movementType,
        location: location || 'Warehouse',
        productId: productId || null,
        productName: productName || 'Unknown Product',
        color: color || null,
        size: size || null,
        barcode: barcode || null,
        previousQty: parseInt(previousQty || 0),
        newQty: parseInt(newQty || 0),
        difference: parseInt(calcDiff || 0),
        referenceId: referenceId ? String(referenceId) : null,
        notes: notes || null,
        performedBy: performedBy ? String(performedBy) : null
      }
    });
  } catch (err) {
    console.error('Failed to record inventory movement log:', err.message);
    return null;
  }
};

module.exports = {
  recordInventoryMovement
};
