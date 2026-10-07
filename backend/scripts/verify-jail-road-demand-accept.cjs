const prisma = require('../src/prisma');
const outletDemandCtrl = require('../src/controllers/outletDemand.controller');

async function verify() {
  console.log('--- Starting Demand Accept Verification ---');

  // Check Jail Road unaccepted demands
  const pendingJailDemands = await prisma.outletDemandRequest.findMany({
    where: {
      outletName: { contains: 'Jail', mode: 'insensitive' },
      status: { in: ['APPROVED', 'PARTIALLY_APPROVED'] },
      acceptedAt: null
    }
  });

  console.log('Unaccepted approved Jail Road demands:', pendingJailDemands.length);
  if (pendingJailDemands.length > 0) {
    throw new Error('Expected 0 unaccepted approved Jail Road demands, found ' + pendingJailDemands.length);
  }

  // Check that the previously failing demand 975829f5-e2cb-44a0-84d2-7ca0efa5f4a6 is now COMPLETED
  const demand97 = await prisma.outletDemandRequest.findUnique({
    where: { id: '975829f5-e2cb-44a0-84d2-7ca0efa5f4a6' }
  });
  console.log('Demand 975829f5 status:', demand97.status, 'acceptedAt:', demand97.acceptedAt);
  if (demand97.status !== 'COMPLETED' || !demand97.acceptedAt) {
    throw new Error('Demand 975829f5 was not properly completed');
  }

  // Check that Green Dot S in Jail Road has stock updated
  const greenDotS = await prisma.outletInventory.findFirst({
    where: {
      outletName: 'Jail Road',
      barcode: 'POS13WLLYY'
    }
  });
  console.log('Green Dot S stock in Jail Road:', greenDotS ? greenDotS.stock : 'NOT FOUND');
  if (!greenDotS || greenDotS.stock < 1) {
    throw new Error('Expected Green Dot S in Jail Road to have stock >= 1');
  }

  // Check inventory movement log for demand 97
  const movements = await prisma.inventoryMovementLog.findMany({
    where: {
      referenceId: demand97.transferNumber,
      movementType: 'TRANSFER_IN'
    }
  });
  console.log('Inventory movements recorded for 975829f5:', movements.length);
  if (movements.length < 8) {
    throw new Error('Expected at least 8 movement records, found ' + movements.length);
  }

  console.log('--- Verification PASSED 100% ---');
}

verify()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
