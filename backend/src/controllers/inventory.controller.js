const prisma = require('../prisma');
const xlsx = require('xlsx');

const getInventory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' }, take: limit });
    if (req.user?.role === 'OUTLET') {
      const sanitized = items.map(({ stock, ...rest }) => rest);
      return res.json(sanitized);
    }
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

const createInventoryItem = async (req, res) => {
  const { name, category, stock, price, color, fabric, imageUrl, variants } = req.body;
  try {
    let computedStock = stock;
    let computedPrice = price;
    let primaryColor = color;
    let primarySize = null;

    if (variants && Array.isArray(variants) && variants.length > 0) {
      computedStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
      const firstPrice = parseFloat(variants[0].price);
      if (!price || price === 0) computedPrice = isNaN(firstPrice) ? 0 : firstPrice;
      primaryColor = variants[0].color || color;
      primarySize = variants[0].size || null;
    }

    const item = await prisma.inventoryItem.create({
      data: { 
        name, 
        category, 
        stock: computedStock, 
        price: computedPrice, 
        color: primaryColor, 
        size: primarySize, 
        fabric, 
        imageUrl,
        variants: variants || null
      }
    });
    
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', item);
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating inventory item', error: error.message });
  }
};

const updateInventoryItem = async (req, res) => {
  const { id } = req.params;
  const { name, category, stock, price, color, fabric, imageUrl, variants } = req.body;
  try {
    let computedStock = stock;
    let computedPrice = price;

    if (variants && Array.isArray(variants) && variants.length > 0) {
      computedStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
      const firstPrice = parseFloat(variants[0].price);
      if (!price || price === 0) computedPrice = isNaN(firstPrice) ? 0 : firstPrice;
    }

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { 
        name, 
        category, 
        stock: computedStock, 
        price: computedPrice, 
        color, 
        fabric, 
        imageUrl,
        variants: variants || null
      }
    });
    
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

const clearAllInventory = async (req, res) => {
  try {
    const result = await prisma.inventoryItem.deleteMany();
    
    const io = req.app.get('io');
    if (io) io.emit('inventory-updated', { cleared: true });
    
    res.json({ message: `All ${result.count} items deleted` });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing inventory', error: error.message });
  }
};

const bulkUploadInventory = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
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
      const size = getVal('size') || '';
      const fabric = getVal('fabric') || getVal('material') || '';

      const nameStr = String(name).trim();
      let finalCategory = String(category).toUpperCase().trim();
      
      // Auto-categorize if no explicit valid category is provided or it's unknown
      if (!category || finalCategory === 'UNCATEGORIZED' || finalCategory === '') {
        const lowerName = nameStr.toLowerCase();
        if (lowerName.includes('shoe')) finalCategory = 'SHOES';
        else if (lowerName.includes('scrub')) finalCategory = 'SCRUBS';
        else if (lowerName.includes('coat')) finalCategory = 'COAT';
        else if (lowerName.includes('mask')) finalCategory = 'MASK';
        else if (lowerName.includes('sock')) finalCategory = 'SOCKS';
        else if (lowerName.includes('cap')) finalCategory = 'CAPS';
        else if (lowerName.includes('fabric')) finalCategory = 'FABRIC';
        else finalCategory = 'UNCATEGORIZED';
      }

      return {
        name: nameStr,
        category: finalCategory,
        stock,
        price,
        color: String(color).trim(),
        size: String(size).trim(),
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

const allocateInventory = async (req, res) => {
  const { itemId, color, size, quantity, notes, personName, items } = req.body;
  if (!personName || !personName.trim()) {
    return res.status(400).json({ message: 'personName is required' });
  }

  const allocateItems = items || [{ itemId, color, size, quantity }];
  if (!allocateItems.length) {
    return res.status(400).json({ message: 'At least one item is required' });
  }

  try {
    const allocations = [];
    for (const alloc of allocateItems) {
      const { itemId: id, color: c, size: s, quantity: qty } = alloc;
      if (!id || !qty || qty <= 0) {
        return res.status(400).json({ message: 'Each item must have itemId and quantity > 0' });
      }

      const item = await prisma.inventoryItem.findUnique({ where: { id } });
      if (!item) return res.status(404).json({ message: `Item not found: ${id}` });

      let allocColor = c || item.color;
      let allocSize = s || item.size;

      if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
        if (!c && !s) {
          return res.status(400).json({ message: `color and/or size are required for ${item.name} (has variants)` });
        }
        const matchIdx = item.variants.findIndex(v =>
          (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
          (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
        );
        if (matchIdx < 0) {
          return res.status(400).json({ message: `Variant not found for ${item.name}: ${c || ''} ${s || ''}`.trim() });
        }
        allocColor = item.variants[matchIdx].color || item.color;
        allocSize = item.variants[matchIdx].size || item.size;
      }

      const allocation = await prisma.allocation.create({
        data: {
          personName: personName.trim(),
          itemName: item.name,
          itemCategory: item.category,
          color: allocColor,
          size: allocSize,
          quantity: parseInt(qty),
          notes: notes || '',
          itemId: item.id,
          allocatedById: req.user?.id || null,
          allocatedByName: req.user?.name || null,
          status: 'ACTIVE'
        }
      });
      allocations.push(allocation);

      await prisma.auditLog.create({
        data: {
          orderId: null,
          action: 'INVENTORY_ALLOCATED',
          details: `Allocated ${parseInt(qty)}x ${item.name}${allocColor || allocSize ? ' (' + [allocColor, allocSize].filter(Boolean).join(' ') + ')' : ''} to ${personName.trim()}`,
          performedBy: req.user.id
        }
      });
    }

    res.status(201).json({ message: `${allocations.length} product(s) allocated successfully`, count: allocations.length, allocations });
  } catch (error) {
    res.status(500).json({ message: 'Error allocating products', error: error.message });
  }
};

const getAllocations = async (req, res) => {
  try {
    const { personName, page = 1, limit = 50 } = req.query;
    const where = personName ? { personName: { contains: personName, mode: 'insensitive' } } : {};
    const [records, total] = await Promise.all([
      prisma.allocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.allocation.count({ where })
    ]);
    res.json({ records, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching allocations', error: error.message });
  }
};

const getAllocationStats = async (req, res) => {
  try {
    const stats = await prisma.allocation.groupBy({
      by: ['personName'],
      _sum: { quantity: true },
      _count: { id: true },
      _max: { createdAt: true }
    });
    const result = stats.map(s => ({
      personName: s.personName,
      totalItems: s._sum.quantity || 0,
      timesTaken: s._count.id,
      lastTaken: s._max.createdAt
    })).sort((a, b) => b.timesTaken - a.timesTaken);

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayTotal = await prisma.allocation.count({ where: { createdAt: { gte: todayStart } } });
    const activeTotal = await prisma.allocation.count({ where: { status: 'ACTIVE' } });
    const totalAllQty = await prisma.allocation.aggregate({ _sum: { quantity: true } });

    // Recent 5 allocations
    const recent = await prisma.allocation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({ perPerson: result, todayTotal, activeTotal, totalAllocated: totalAllQty._sum.quantity || 0, recent });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching allocation stats', error: error.message });
  }
};

const searchInventory = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.status(400).json({ message: 'Product name query parameter is required' });
    }
    const items = await prisma.inventoryItem.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' }
      }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error searching inventory', error: error.message });
  }
};

const updateAllocationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['ACTIVE', 'ACCEPTED', 'REJECTED', 'COMPLETED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
  }
  try {
    const allocation = await prisma.allocation.findUnique({ where: { id } });
    if (!allocation) return res.status(404).json({ message: 'Allocation not found' });

    if (status === 'ACCEPTED') {
      const item = allocation.itemId ? await prisma.inventoryItem.findUnique({ where: { id: allocation.itemId } }) : null;
      if (!item) return res.status(404).json({ message: 'Inventory item not found for this allocation' });

      const deductQty = allocation.quantity;

      await prisma.$transaction(async (tx) => {
        if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
          let updatedVariants = [...item.variants];
          const matchIdx = updatedVariants.findIndex(v =>
            (!allocation.color || (v.color && v.color.toLowerCase() === allocation.color.toLowerCase())) &&
            (!allocation.size || (v.size && v.size.toLowerCase() === allocation.size.toLowerCase()))
          );
          if (matchIdx < 0) {
            throw new Error(`Variant not found for ${item.name}`);
          }
          const available = updatedVariants[matchIdx].stock || 0;
          if (available < deductQty) {
            throw new Error(`Insufficient stock for ${item.name}. Only ${available} of ${deductQty} available.`);
          }
          updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - deductQty };
          const newTotal = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { variants: updatedVariants, stock: newTotal }
          });
        } else {
          if ((item.stock || 0) < deductQty) {
            throw new Error(`Insufficient stock for ${item.name}. Only ${item.stock} of ${deductQty} available.`);
          }
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { stock: { decrement: deductQty } }
          });
        }

        await tx.auditLog.create({
          data: {
            orderId: null,
            action: 'ALLOCATION_ACCEPTED',
            details: `Accepted allocation of ${deductQty}x ${item.name} to ${allocation.personName}`,
            performedBy: req.user.id
          }
        });

        await tx.allocation.update({
          where: { id },
          data: { status }
        });
      });
    } else {
      if (status === 'REJECTED') {
        await prisma.auditLog.create({
          data: {
            orderId: null,
            action: 'ALLOCATION_REJECTED',
            details: `Rejected allocation of ${allocation.quantity}x ${allocation.itemName} to ${allocation.personName}`,
            performedBy: req.user.id
          }
        });
      }

      await prisma.allocation.update({
        where: { id },
        data: { status }
      });
    }

    const updated = await prisma.allocation.findUnique({ where: { id } });
    res.json(updated);
  } catch (error) {
    if (error.message && (error.message.includes('Insufficient') || error.message.includes('not found'))) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating allocation status', error: error.message });
  }
};

// ====== CART-BASED ALLOCATION ======
const createCartAllocation = async (req, res) => {
  const { personName, items, notes } = req.body;
  if (!personName || !personName.trim()) {
    return res.status(400).json({ message: 'personName is required' });
  }
  if (!items || !items.length) {
    return res.status(400).json({ message: 'At least one item is required' });
  }

  try {
    // Validate all items first
    for (const alloc of items) {
      const { itemId, color: c, size: s, quantity: qty } = alloc;
      if (!itemId || !qty || qty <= 0) {
        return res.status(400).json({ message: 'Each item must have itemId and quantity > 0' });
      }
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) return res.status(404).json({ message: `Item not found: ${itemId}` });

      if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
        if (!c && !s) {
          return res.status(400).json({ message: `color and/or size are required for ${item.name} (has variants)` });
        }
        const matchIdx = item.variants.findIndex(v =>
          (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
          (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
        );
        if (matchIdx < 0) {
          return res.status(400).json({ message: `Variant not found for ${item.name}: ${c || ''} ${s || ''}`.trim() });
        }
      }
    }

    // Auto-generate display ID
    const count = await prisma.allocationCart.count();
    const displayId = `ALC-${String(count + 1).padStart(3, '0')}`;

    // Create cart
    const cart = await prisma.allocationCart.create({
      data: {
        displayId,
        personName: personName.trim(),
        notes: notes || '',
        totalItems: items.length,
        totalQuantity: items.reduce((s, i) => s + (parseInt(i.quantity) || 1), 0),
        status: 'PENDING',
        allocatedById: req.user?.id || null,
        allocatedByName: req.user?.name || null,
      }
    });

    // Create individual allocation records linked to cart
    const allocations = [];
    for (const alloc of items) {
      const { itemId, color: c, size: s, quantity: qty } = alloc;
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      let allocColor = c || item.color;
      let allocSize = s || item.size;

      if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
        const matchIdx = item.variants.findIndex(v =>
          (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
          (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
        );
        if (matchIdx >= 0) {
          allocColor = item.variants[matchIdx].color || item.color;
          allocSize = item.variants[matchIdx].size || item.size;
        }
      }

      const allocation = await prisma.allocation.create({
        data: {
          cartId: cart.id,
          personName: personName.trim(),
          itemName: item.name,
          itemCategory: item.category,
          color: allocColor,
          size: allocSize,
          quantity: parseInt(qty),
          notes: notes || '',
          itemId: item.id,
          allocatedById: req.user?.id || null,
          allocatedByName: req.user?.name || null,
          status: 'ACTIVE'
        }
      });
      allocations.push(allocation);

      await prisma.auditLog.create({
        data: {
          orderId: null,
          action: 'INVENTORY_ALLOCATED',
          details: `Cart ${displayId}: Allocated ${parseInt(qty)}x ${item.name} to ${personName.trim()}`,
          performedBy: req.user.id
        }
      });
    }

    const created = await prisma.allocationCart.findUnique({
      where: { id: cart.id },
      include: { items: true }
    });

    res.status(201).json({ message: `Cart ${displayId} created with ${allocations.length} product(s)`, cart: created });
  } catch (error) {
    res.status(500).json({ message: 'Error creating cart allocation', error: error.message });
  }
};

const getCarts = async (req, res) => {
  try {
    const { personName, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (personName) where.personName = { contains: personName, mode: 'insensitive' };
    if (status) where.status = status;
    const [records, total] = await Promise.all([
      prisma.allocationCart.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.allocationCart.count({ where })
    ]);
    res.json({ records, total });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching carts', error: error.message });
  }
};

const updateCartStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['APPROVED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const cart = await prisma.allocationCart.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    if (cart.status !== 'PENDING') {
      return res.status(400).json({ message: `Cart already ${cart.status.toLowerCase()}. Cannot modify.` });
    }

    if (status === 'APPROVED') {
      // Pre-validate all items upfront
      const updates = [];
      for (const alloc of cart.items) {
        if (!alloc.itemId) continue;
        const item = await prisma.inventoryItem.findUnique({ where: { id: alloc.itemId } });
        if (!item) throw new Error(`Inventory item not found for allocation ${alloc.id}`);

        const deductQty = alloc.quantity;
        if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
          let updatedVariants = [...item.variants];
          const matchIdx = updatedVariants.findIndex(v =>
            (!alloc.color || (v.color && v.color.toLowerCase() === alloc.color.toLowerCase())) &&
            (!alloc.size || (v.size && v.size.toLowerCase() === alloc.size.toLowerCase()))
          );
          if (matchIdx < 0) throw new Error(`Variant not found for ${item.name}`);
          const available = updatedVariants[matchIdx].stock || 0;
          if (available < deductQty) throw new Error(`Insufficient stock for ${item.name}. Only ${available} of ${deductQty} available.`);
          updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - deductQty };
          const newTotal = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
          updates.push(
            prisma.inventoryItem.update({ where: { id: item.id }, data: { variants: updatedVariants, stock: newTotal } }),
            prisma.allocation.update({ where: { id: alloc.id }, data: { status: 'ACCEPTED' } })
          );
        } else {
          if ((item.stock || 0) < deductQty) throw new Error(`Insufficient stock for ${item.name}. Only ${item.stock} of ${deductQty} available.`);
          updates.push(
            prisma.inventoryItem.update({ where: { id: item.id }, data: { stock: { decrement: deductQty } } }),
            prisma.allocation.update({ where: { id: alloc.id }, data: { status: 'ACCEPTED' } })
          );
        }
      }

      updates.push(
        prisma.allocationCart.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date() } }),
        prisma.auditLog.create({ data: { orderId: null, action: 'CART_APPROVED', details: `Cart ${cart.displayId || id} approved. ${cart.items.length} product(s) to ${cart.personName}.`, performedBy: req.user.id } })
      );

      await prisma.$transaction(updates);
    } else {
      // REJECTED — just update status
      await prisma.$transaction([
        prisma.allocation.updateMany({ where: { cartId: id }, data: { status: 'REJECTED' } }),
        prisma.allocationCart.update({ where: { id }, data: { status: 'REJECTED' } }),
        prisma.auditLog.create({ data: { orderId: null, action: 'CART_REJECTED', details: `Cart ${cart.displayId || id} rejected. ${cart.items.length} product(s) to ${cart.personName}.`, performedBy: req.user.id } })
      ]);
    }

    const updated = await prisma.allocationCart.findUnique({
      where: { id },
      include: { items: true }
    });
    res.json(updated);
  } catch (error) {
    if (error.message && (error.message.includes('Insufficient') || error.message.includes('not found'))) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating cart status', error: error.message });
  }
};

module.exports = { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, clearAllInventory, bulkUploadInventory, allocateInventory, getAllocations, getAllocationStats, searchInventory, updateAllocationStatus, createCartAllocation, getCarts, updateCartStatus };
