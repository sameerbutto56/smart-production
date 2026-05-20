const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const autoAssignCategory = (name) => {
  const n = name.toLowerCase();
  if (n.includes('shoe')) return 'SHOES';
  if (n.includes('scrub')) return 'SCRUBS';
  if (n.includes('coat')) return 'COAT';
  if (n.includes('mask')) return 'MASK';
  if (n.includes('sock')) return 'SOCKS';
  if (n.includes('cap')) return 'CAPS';
  if (n.includes('fabric')) return 'FABRIC';
  return 'UNCATEGORIZED';
};

async function fixCategories() {
  const items = await prisma.inventoryItem.findMany({
    where: { category: 'UNCATEGORIZED' }
  });

  let count = 0;
  for (const item of items) {
    const newCategory = autoAssignCategory(item.name);
    if (newCategory !== 'UNCATEGORIZED') {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { category: newCategory }
      });
      count++;
    }
  }
  console.log(`Updated ${count} items categories based on their names.`);
}

fixCategories()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
