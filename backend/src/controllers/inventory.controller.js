const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xlsx = require('xlsx');

const getInventory = async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

const createInventoryItem = async (req, res) => {
  const { name, category, stock, price, color, fabric, imageUrl } = req.body;
  try {
    const item = await prisma.inventoryItem.create({
      data: { name, category, stock, price, color, fabric, imageUrl }
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
  const { name, category, stock, price, color, fabric, imageUrl } = req.body;
  try {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { name, category, stock, price, color, fabric, imageUrl }
    });
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', item);
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error updating inventory item', error: error.message });
  }
};

const deleteInventoryItem = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.inventoryItem.delete({ where: { id } });
    
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', { deleted: id });
    
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting inventory item', error: error.message });
  }
};

const bulkUploadInventory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    const parsedData = data.map(row => {
      const rowKeys = Object.keys(row);
      const getVal = (keyStr) => {
        const foundKey = rowKeys.find(k => k.toLowerCase().includes(keyStr.toLowerCase()));
        return foundKey ? row[foundKey] : undefined;
      };

      const name = getVal('name') || getVal('product') || getVal('item') || 'Unknown Item';
      const category = getVal('category') || getVal('type') || 'UNCATEGORIZED';
      const stock = parseInt(getVal('stock') || getVal('qty') || getVal('quantity')) || 0;
      const price = parseFloat(getVal('price') || getVal('cost')) || 0;
      const color = getVal('color') || '';
      const fabric = getVal('fabric') || getVal('material') || '';

      return {
        name: String(name).trim(),
        category: String(category).toUpperCase().trim(),
        stock,
        price,
        color: String(color).trim(),
        fabric: String(fabric).trim()
      };
    });

    const result = await prisma.inventoryItem.createMany({
      data: parsedData,
      skipDuplicates: true
    });

    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', { bulkUpdate: true });

    res.json({ message: `Successfully imported ${result.count} items`, count: result.count });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: 'Error importing inventory', error: error.message });
  }
};

module.exports = { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, bulkUploadInventory };
