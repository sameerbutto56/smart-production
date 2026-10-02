const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- RECONSTRUCTING INVENTORY STATUS ---');
  
  // 1. Get all current products
  const products = await prisma.inventoryItem.findMany();
  console.log(`Found ${products.length} catalog products.`);

  // 2. Fetch all POS Sale Items to see what products were sold and their details
  const saleItems = await prisma.posSaleItem.findMany({
    include: {
      sale: true,
      outletVariant: {
        include: {
          inventoryItem: true
        }
      }
    }
  });
  console.log(`Found ${saleItems.length} historic sales items.`);

  // 3. Fetch all Stock Requests to see what was sent to outlets
  const stockRequests = await prisma.stockRequest.findMany();
  console.log(`Found ${stockRequests.length} stock requests.`);

  // 4. Fetch all Order Stages and Orders to see order item data
  const orders = await prisma.order.findMany();
  console.log(`Found ${orders.length} order history records.`);

  // Show details of some items to verify if their metadata is intact
  if (products.length > 0) {
    console.log('\nSample items remaining in DB:');
    products.slice(0, 5).forEach(p => {
      console.log(`- [${p.category}] ${p.name} (Color: ${p.color}, Size: ${p.size}, Price: ${p.price})`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
