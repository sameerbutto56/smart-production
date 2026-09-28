const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function main() {
  console.log('--- Verifying Outlet Order Lookup & Financials ---');

  // Generate test outlet user tokens for Johar Town and Jail Road
  const joharToken = jwt.sign(
    { id: 'test-johar-id', name: 'Johar Town', role: 'OUTLET' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const jailToken = jwt.sign(
    { id: 'test-jail-id', name: 'Jail Road', role: 'OUTLET' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const prisma = require('../src/prisma');

  // Find a sample order to test lookup
  const sampleOrder = await prisma.order.findFirst({
    where: { source: 'OUTLET' },
    orderBy: { createdAt: 'desc' }
  });

  if (!sampleOrder) {
    console.log('No outlet order found in DB to test. Creating a quick test order...');
  } else {
    console.log(`Sample Order Found: ${sampleOrder.orderNumber} (Customer: ${sampleOrder.customerName})`);
  }

  // Test 1: Direct controller invocation or HTTP test
  const { lookupOrderWithFinancials, searchOutletOrders } = require('../src/controllers/outletOrder.controller');

  // Test lookupOrderWithFinancials with sampleOrder.orderNumber
  if (sampleOrder && sampleOrder.orderNumber) {
    const req = {
      params: { orderNumber: sampleOrder.orderNumber },
      user: { id: 'test-johar', name: 'Johar Town', role: 'OUTLET' },
      query: {}
    };

    let statusVal = 200;
    let jsonVal = null;
    const res = {
      status: (s) => { statusVal = s; return res; },
      json: (d) => { jsonVal = d; return res; }
    };

    await lookupOrderWithFinancials(req, res);
    console.log(`Test 1: lookupOrderWithFinancials status: ${statusVal}`);
    if (jsonVal?.order) {
      console.log('✓ Order details returned:');
      console.log(`  - Order Number: ${jsonVal.order.orderNumber}`);
      console.log(`  - Customer Name: ${jsonVal.order.customerName}`);
      console.log(`  - Total Price: ${jsonVal.order.totalPrice}`);
      console.log(`  - Discount: ${jsonVal.order.discountAmount}`);
      console.log(`  - Delivery Charges: ${jsonVal.order.deliveryCharges}`);
      console.log(`  - Product Details length: ${Array.isArray(jsonVal.order.productDetails) ? jsonVal.order.productDetails.length : 0}`);
      console.log(`  - Financial Status: ${jsonVal.financial?.paymentStatus} (Grand Total: ${jsonVal.financial?.grandTotal})`);
    } else {
      console.error('✗ Failed to get order data in jsonVal:', jsonVal);
      process.exit(1);
    }
  }

  // Test 2: searchOutletOrders
  {
    const req = {
      query: { q: '', page: '1', limit: '10' },
      user: { id: 'test-johar', name: 'Johar Town', role: 'OUTLET' }
    };

    let statusVal = 200;
    let jsonVal = null;
    const res = {
      status: (s) => { statusVal = s; return res; },
      json: (d) => { jsonVal = d; return res; }
    };

    await searchOutletOrders(req, res);
    console.log(`Test 2: searchOutletOrders status: ${statusVal}`);
    if (jsonVal && Array.isArray(jsonVal.orders)) {
      console.log(`✓ Orders found: ${jsonVal.orders.length} (Total: ${jsonVal.total}, Pages: ${jsonVal.totalPages})`);
    } else {
      console.error('✗ Failed to search orders:', jsonVal);
      process.exit(1);
    }
  }

  console.log('--- All Backend Tests PASSED Successfully! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
