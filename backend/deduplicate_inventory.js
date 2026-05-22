const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deduplicateInventory() {
  const allItems = await prisma.inventoryItem.findMany();
  
  // Group by name + category + color + fabric
  const groups = {};
  for (const item of allItems) {
    const key = `${item.name}-${item.category}-${item.color || ''}-${item.fabric || ''}`.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  let deletedCount = 0;
  let mergedStockCount = 0;

  for (const key in groups) {
    const group = groups[key];
    if (group.length > 1) {
      console.log(`Found ${group.length} duplicates for ${group[0].name}`);
      
      // Keep the first one, add the stock of all others to it, then delete the others.
      const primaryItem = group[0];
      let totalAdditionalStock = 0;
      
      const idsToDelete = [];
      for (let i = 1; i < group.length; i++) {
        totalAdditionalStock += group[i].stock;
        idsToDelete.push(group[i].id);
      }

      // Update primary
      if (totalAdditionalStock > 0) {
        await prisma.inventoryItem.update({
          where: { id: primaryItem.id },
          data: { stock: primaryItem.stock + totalAdditionalStock }
        });
        mergedStockCount += totalAdditionalStock;
      }

      // Delete duplicates
      await prisma.inventoryItem.deleteMany({
        where: { id: { in: idsToDelete } }
      });
      
      deletedCount += idsToDelete.length;
    }
  }

  console.log(`Deduplication complete. Deleted ${deletedCount} duplicate entries. Merged ${mergedStockCount} stock units into primary items.`);
}

deduplicateInventory()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
