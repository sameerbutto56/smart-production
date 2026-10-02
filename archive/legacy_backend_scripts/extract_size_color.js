const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function extractSizeColor() {
  const items = await prisma.inventoryItem.findMany();
  
  let count = 0;
  for (const item of items) {
    let newName = item.name;
    let newSize = item.size || '';
    let newColor = item.color || '';
    
    // Look for parentheses: e.g. "Aeros Shoes (CL-021-35)" or "COTTON (S, Pink)"
    const match = item.name.match(/\((.*?)\)/);
    
    if (match) {
      const inside = match[1]; // "CL-021-35" or "S, Pink"
      newName = item.name.replace(/\(.*?\)/, '').trim(); // "Aeros Shoes" or "COTTON"
      
      if (inside.includes(',')) {
        // "S, Pink" -> size: "S", color: "Pink"
        const parts = inside.split(',').map(s => s.trim());
        newSize = parts[0];
        newColor = parts[1] || newColor;
      } else if (inside.includes('-')) {
        // "CL-021-35" -> size: "35", color: "CL-021"
        const parts = inside.split('-');
        newSize = parts[parts.length - 1]; // "35"
        newColor = parts.slice(0, parts.length - 1).join('-'); // "CL-021"
      } else {
        // Just one value, assume size
        newSize = inside;
      }
      
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          name: newName,
          size: newSize,
          color: newColor
        }
      });
      count++;
    }
  }

  console.log(`Extracted size/color for ${count} items.`);
}

extractSizeColor()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
