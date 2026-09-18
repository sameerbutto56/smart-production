const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.inventoryItem.findMany({
    select: { id: true, name: true, category: true, metadata: true }
  });
  const withMeta = items.filter(i => i.metadata);
  console.log(`Total inventory items: ${items.length}, items with metadata: ${withMeta.length}`);
  if (withMeta.length > 0) {
    console.log('Sample metadata:', withMeta.slice(0, 5));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
