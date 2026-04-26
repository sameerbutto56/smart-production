const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getInventory = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

const createInventoryItem = async (req, res) => {
  const { name, category, stock, price, color, fabric } = req.body;
  try {
    const item = await prisma.inventoryItem.create({
      data: { name, category, stock, price, color, fabric }
    });
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', item);
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating inventory item', error: error.message });
  }
};

const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { name, category, stock, price, color, fabric } = req.body;
  try {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { name, category, stock, price, color, fabric }
    });
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', item);
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating inventory item', error: error.message });
  }
};

module.exports = { getInventory, createInventoryItem, updateInventoryItem };
