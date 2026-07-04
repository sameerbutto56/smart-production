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
    // Limit per-person stats to last 6 months to avoid full table scan timeouts
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const [stats, todayTotal, activeTotal, totalAllQty, recent] = await Promise.all([
      prisma.allocation.groupBy({
        by: ['personName'],
        where: { createdAt: { gte: sixMonthsAgo } },
        _sum: { quantity: true },
        _count: { id: true },
        _max: { createdAt: true }
      }),
      (() => { const d = new Date(); d.setHours(0,0,0,0); return prisma.allocation.count({ where: { createdAt: { gte: d } } }); })(),
      prisma.allocation.count({ where: { status: 'ACTIVE' } }),
      prisma.allocation.aggregate({ _sum: { quantity: true } }),
      prisma.allocation.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
    ]);

    const result = stats.map(s => ({
      personName: s.personName,
      totalItems: s._sum.quantity || 0,
      timesTaken: s._count.id,
      lastTaken: s._max.createdAt
    })).sort((a, b) => b.timesTaken - a.timesTaken);

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
          const matchIdx = (() => {
            const withStock = updatedVariants.findIndex(v =>
              (v.stock || 0) >= deductQty &&
              (!allocation.color || (v.color && v.color.toLowerCase() === allocation.color.toLowerCase())) &&
              (!allocation.size || (v.size && v.size.toLowerCase() === allocation.size.toLowerCase()))
            );
            if (withStock >= 0) return withStock;
            return updatedVariants.findIndex(v =>
              (!allocation.color || (v.color && v.color.toLowerCase() === allocation.color.toLowerCase())) &&
              (!allocation.size || (v.size && v.size.toLowerCase() === allocation.size.toLowerCase()))
            );
          })();
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
        const matchIdx = (() => {
          // prefer a variant with available stock
          const withStock = item.variants.findIndex(v =>
            (v.stock || 0) > 0 &&
            (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
            (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
          );
          if (withStock >= 0) return withStock;
          return item.variants.findIndex(v =>
            (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
            (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
          );
        })();
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
        const matchIdx = (() => {
          const withStock = item.variants.findIndex(v =>
            (v.stock || 0) > 0 &&
            (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
            (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
          );
          if (withStock >= 0) return withStock;
          return item.variants.findIndex(v =>
            (!c || (v.color && v.color.toLowerCase() === c.toLowerCase())) &&
            (!s || (v.size && v.size.toLowerCase() === s.toLowerCase()))
          );
        })();
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
    const { personName, status, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (personName) where.personName = { contains: personName, mode: 'insensitive' };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
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
          const matchIdx = (() => {
            const withStock = updatedVariants.findIndex(v =>
              (v.stock || 0) >= deductQty &&
              (!alloc.color || (v.color && v.color.toLowerCase() === alloc.color.toLowerCase())) &&
              (!alloc.size || (v.size && v.size.toLowerCase() === alloc.size.toLowerCase()))
            );
            if (withStock >= 0) return withStock;
            return updatedVariants.findIndex(v =>
              (!alloc.color || (v.color && v.color.toLowerCase() === alloc.color.toLowerCase())) &&
              (!alloc.size || (v.size && v.size.toLowerCase() === alloc.size.toLowerCase()))
            );
          })();
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

const fs = require('fs');
const path = require('path');

const exportBackup = async (req, res) => {
  try {
    const { outlet } = req.query; // e.g. "Johar Town"

    let items;
    let variants;
    let posSales = [];
    const posSaleItems = [];
    let posReturns = [];
    let clients = [];
    let transfers = [];
    let orders = [];

    if (outlet) {
      // Branch-specific backup
      variants = await prisma.outletInventory.findMany({ where: { outletName: outlet } });
      items = await prisma.inventoryItem.findMany();
      
      posSales = await prisma.posSale.findMany({ where: { outletName: outlet }, include: { items: true } });
      posSales.forEach(sale => {
        if (sale.items) posSaleItems.push(...sale.items);
      });
      posReturns = await prisma.posReturn.findMany({ where: { outletName: outlet } });
      clients = await prisma.client.findMany({ where: { outletName: outlet } });
      transfers = await prisma.outletTransfer.findMany({
        where: { OR: [{ fromOutlet: outlet }, { toOutlet: outlet }] },
        include: { items: true }
      });
      orders = await prisma.order.findMany({ where: { outletName: outlet } });
    } else {
      // Legacy/Full backup
      items = await prisma.inventoryItem.findMany();
      variants = await prisma.outletInventory.findMany();
      posSales = await prisma.posSale.findMany({ include: { items: true } });
      posSales.forEach(sale => {
        if (sale.items) posSaleItems.push(...sale.items);
      });
      posReturns = await prisma.posReturn.findMany();
      clients = await prisma.client.findMany();
      transfers = await prisma.outletTransfer.findMany({ include: { items: true } });
      orders = await prisma.order.findMany();
    }

    const backupData = {
      version: '1.1',
      timestamp: new Date().toISOString(),
      outletName: outlet || null,
      inventoryItems: items,
      outletInventory: variants,
      posSales,
      posSaleItems,
      posReturns,
      clients,
      transfers,
      orders
    };

    const filename = outlet 
      ? `inventory_backup_${outlet.replace(/\s+/g, '_')}_${Date.now()}.json`
      : `inventory_backup_full_${Date.now()}.json`;

    // 1. Save backup to server filesystem (wrap in try-catch to tolerate read-only environments)
    try {
      const backupDir = path.join(__dirname, '../../backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(path.join(backupDir, filename), JSON.stringify(backupData, null, 2));
    } catch (fsError) {
      console.warn('Warning: Local filesystem write skipped (e.g. read-only serverless env):', fsError.message);
    }

    // 2. Stream to client computer for download
    res.setHeader('Content-disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(backupData, null, 2));
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Failed to export backup', error: error.message });
  }
};

const importBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Backup file is required' });
    }
    const backupData = JSON.parse(req.file.buffer.toString());
    const outletVariants = backupData.outletInventory || backupData.outletVariants || [];
    if (!backupData.inventoryItems || !outletVariants) {
      return res.status(400).json({ message: 'Invalid backup file structure' });
    }

    const { 
      outletName: backupOutlet,
      inventoryItems = [], 
      posSales = [],
      posSaleItems = [],
      posReturns = [],
      clients = [],
      transfers = [],
      orders = []
    } = backupData;

    // Use query parameter or backup file outlet name
    const outlet = req.query.outlet || backupOutlet;

    await prisma.$transaction(async (tx) => {
      if (outlet) {
        // --- Branch-Specific Isolation Restore ---
        // 1. Clear target branch specific records
        const targetSaleIds = (await tx.posSale.findMany({ where: { outletName: outlet }, select: { id: true } })).map(s => s.id);
        await tx.posReturn.deleteMany({ where: { outletName: outlet } });
        await tx.posSaleItem.deleteMany({ where: { saleId: { in: targetSaleIds } } });
        await tx.posSale.deleteMany({ where: { outletName: outlet } });
        await tx.outletInventory.deleteMany({ where: { outletName: outlet } });
        await tx.client.deleteMany({ where: { outletName: outlet } });
        await tx.order.deleteMany({ where: { outletName: outlet } });
        
        const transferIds = (await tx.outletTransfer.findMany({
          where: { OR: [{ fromOutlet: outlet }, { toOutlet: outlet }] },
          select: { id: true }
        })).map(t => t.id);
        await tx.outletTransferItem.deleteMany({ where: { transferId: { in: transferIds } } });
        await tx.outletTransfer.deleteMany({ where: { id: { in: transferIds } } });

        // Build lookup for inventory item details (support old backup format with inventoryItemId)
        const itemLookup = {};
        for (const item of inventoryItems) {
          itemLookup[item.id] = item;
        }

        // 2. Restore main items (upsert them to avoid duplicate ID errors if items exist in another branch)
        for (const item of inventoryItems) {
          const exists = await tx.inventoryItem.findUnique({ where: { id: item.id } });
          if (!exists) {
            await tx.inventoryItem.create({
              data: {
                id: item.id,
                name: item.name,
                category: item.category,
                color: item.color,
                size: item.size,
                fabric: item.fabric,
                stock: item.stock,
                price: item.price,
                imageUrl: item.imageUrl,
                metadata: item.metadata,
                variants: item.variants,
                createdAt: new Date(item.createdAt),
                updatedAt: new Date(item.updatedAt)
              }
            });
          }
        }

        // 3. Restore branch variants
        for (const v of outletVariants) {
          const invItem = itemLookup[v.inventoryItemId] || {};
          await tx.outletInventory.create({
            data: {
              id: v.id,
              outletName: v.outletName || outlet,
              name: v.name || invItem.name || 'Unknown',
              category: v.category || invItem.category || 'UNCATEGORIZED',
              color: v.color || null,
              size: v.size || null,
              fabric: v.fabric || invItem.fabric || '',
              barcode: v.barcode || null,
              stock: parseInt(v.stock) || 0,
              price: parseFloat(v.price) || 0,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date()
            }
          });
        }

        // 4. Restore sales & returns & clients & orders & transfers
        for (const s of posSales) {
          await tx.posSale.create({
            data: {
              id: s.id,
              receiptNumber: s.receiptNumber,
              outletName: s.outletName,
              cashierName: s.cashierName,
              customerName: s.customerName,
              subtotal: s.subtotal,
              alterationCharges: s.alterationCharges,
              extraCharges: s.extraCharges,
              discountPercent: s.discountPercent,
              discountAmount: s.discountAmount,
              grandTotal: s.grandTotal,
              paymentMethod: s.paymentMethod,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt)
            }
          });
        }
        for (const si of posSaleItems) {
          await tx.posSaleItem.create({
            data: {
              id: si.id,
              saleId: si.saleId,
              outletVariantId: si.outletVariantId,
              productName: si.productName,
              size: si.size,
              color: si.color,
              quantity: si.quantity,
              unitPrice: si.unitPrice,
              alterationCharges: si.alterationCharges,
              lineTotal: si.lineTotal
            }
          });
        }
        for (const r of posReturns) {
          await tx.posReturn.create({
            data: {
              id: r.id,
              saleId: r.saleId,
              outletVariantId: r.outletVariantId,
              outletName: r.outletName,
              reason: r.reason,
              quantity: r.quantity,
              refundAmount: r.refundAmount,
              createdAt: new Date(r.createdAt)
            }
          });
        }
        for (const c of clients) {
          await tx.client.create({
            data: {
              id: c.id,
              name: c.name,
              gender: c.gender,
              phone: c.phone,
              additionalPhones: c.additionalPhones,
              permanentAddress: c.permanentAddress,
              deliveryAddresses: c.deliveryAddresses,
              measurementChart: c.measurementChart,
              sizeDetails: c.sizeDetails,
              outletName: c.outletName,
              createdById: c.createdById,
              isActive: c.isActive,
              createdAt: new Date(c.createdAt),
              updatedAt: new Date(c.updatedAt)
            }
          });
        }
        for (const t of transfers) {
          await tx.outletTransfer.create({
            data: {
              id: t.id,
              transferNumber: t.transferNumber,
              fromOutlet: t.fromOutlet,
              toOutlet: t.toOutlet,
              status: t.status,
              totalItems: t.totalItems,
              pickupMethod: t.pickupMethod,
              notes: t.notes,
              requestedById: t.requestedById,
              requestedByName: t.requestedByName,
              approvedById: t.approvedById,
              approvedAt: t.approvedAt ? new Date(t.approvedAt) : null,
              completedById: t.completedById,
              completedAt: t.completedAt ? new Date(t.completedAt) : null,
              createdAt: new Date(t.createdAt),
              updatedAt: new Date(t.updatedAt)
            }
          });
          if (t.items && Array.isArray(t.items)) {
            for (const ti of t.items) {
              await tx.outletTransferItem.create({
                data: {
                  id: ti.id,
                  transferId: ti.transferId,
                  outletVariantId: ti.outletVariantId,
                  productName: ti.productName,
                  color: ti.color,
                  size: ti.size,
                  barcode: ti.barcode,
                  quantity: ti.quantity,
                  unitPrice: ti.unitPrice
                }
              });
            }
          }
        }
        for (const o of orders) {
          await tx.order.create({
            data: {
              id: o.id,
              orderNumber: o.orderNumber,
              shopifyOrderId: o.shopifyOrderId,
              customerName: o.customerName,
              customerPhone: o.customerPhone,
              address: o.address,
              city: o.city,
              createdById: o.createdById,
              type: o.type,
              urgent: o.urgent,
              priority: o.priority,
              quantity: o.quantity,
              logoDesign: o.logoDesign,
              logoName: o.logoName,
              customization: o.customization,
              productDetails: o.productDetails,
              sizeData: o.sizeData,
              currentStage: o.currentStage,
              status: o.status,
              deliveryMethod: o.deliveryMethod,
              advancePaid: o.advancePaid,
              advanceAmount: o.advanceAmount,
              productImage: o.productImage,
              source: o.source,
              outletName: o.outletName,
              createdAt: new Date(o.createdAt),
              updatedAt: new Date(o.updatedAt),
              paymentDeadline: o.paymentDeadline ? new Date(o.paymentDeadline) : null,
              paymentStatus: o.paymentStatus,
              paymentMethod: o.paymentMethod,
              customizationPrice: o.customizationPrice,
              deliveryCharges: o.deliveryCharges,
              totalPrice: o.totalPrice,
              productionDeadline: o.productionDeadline ? new Date(o.productionDeadline) : null,
              trackingNumber: o.trackingNumber,
              courierDetails: o.courierDetails,
              dispatchStatus: o.dispatchStatus,
              deliveryType: o.deliveryType,
              deliveredAt: o.deliveredAt ? new Date(o.deliveredAt) : null,
              returnedAt: o.returnedAt ? new Date(o.returnedAt) : null,
              refundStatus: o.refundStatus,
              refundReason: o.refundReason,
              refundNote: o.refundNote,
              refundedAt: o.refundedAt ? new Date(o.refundedAt) : null,
              refundedById: o.refundedById,
              storeRequested: o.storeRequested,
              storeRequestedAt: o.storeRequestedAt ? new Date(o.storeRequestedAt) : null,
              storeAcceptedAt: o.storeAcceptedAt ? new Date(o.storeAcceptedAt) : null,
              instructionNotes: o.instructionNotes,
              shopifyOrderDate: o.shopifyOrderDate ? new Date(o.shopifyOrderDate) : null,
              riderAcceptedAt: o.riderAcceptedAt ? new Date(o.riderAcceptedAt) : null,
              noResponseCount: o.noResponseCount,
              nextDeliveryDate: o.nextDeliveryDate ? new Date(o.nextDeliveryDate) : null,
              lastDeliveryAttempt: o.lastDeliveryAttempt ? new Date(o.lastDeliveryAttempt) : null,
              productCost: o.productCost,
              logoCharges: o.logoCharges,
              namePrintingCharges: o.namePrintingCharges,
              productionCost: o.productionCost,
              grossProfit: o.grossProfit,
              netProfit: o.netProfit
            }
          });
        }
      } else {
        // --- Full Legacy Restore ---
        await tx.posReturn.deleteMany();
        await tx.posSaleItem.deleteMany();
        await tx.posSale.deleteMany();
        await tx.outletInventory.deleteMany();
        await tx.inventoryItem.deleteMany();

        for (const item of inventoryItems) {
          await tx.inventoryItem.create({
            data: {
              id: item.id,
              name: item.name,
              category: item.category,
              color: item.color,
              size: item.size,
              fabric: item.fabric,
              stock: item.stock,
              price: item.price,
              imageUrl: item.imageUrl,
              metadata: item.metadata,
              variants: item.variants,
              createdAt: new Date(item.createdAt),
              updatedAt: new Date(item.updatedAt)
            }
          });
        }

        const itemLookupFull = {};
        for (const item of inventoryItems) {
          itemLookupFull[item.id] = item;
        }

        for (const v of outletVariants) {
          const invItem = itemLookupFull[v.inventoryItemId] || {};
          await tx.outletInventory.create({
            data: {
              id: v.id,
              outletName: v.outletName || null,
              name: v.name || invItem.name || 'Unknown',
              category: v.category || invItem.category || 'UNCATEGORIZED',
              color: v.color || null,
              size: v.size || null,
              fabric: v.fabric || invItem.fabric || '',
              barcode: v.barcode || null,
              stock: parseInt(v.stock) || 0,
              price: parseFloat(v.price) || 0,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date()
            }
          });
        }
      }
    });

    const cacheKeyPrefix = 'pos:';
    const cache = require('../utils/cache');
    cache.delPattern(cacheKeyPrefix);

    res.json({ 
      message: outlet ? `Backup for ${outlet} imported successfully` : 'Full backup imported successfully', 
      itemsImported: inventoryItems.length, 
      variantsImported: outletVariants.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to import backup', error: error.message });
  }
};

const XLSX = require('xlsx');

const exportBackupExcel = async (req, res) => {
  try {
    const { outlet } = req.query; // e.g. "Johar Town"

    let items;
    let variants;

    if (outlet) {
      variants = await prisma.outletInventory.findMany({ where: { outletName: outlet } });
      items = await prisma.inventoryItem.findMany();
    } else {
      items = await prisma.inventoryItem.findMany();
      variants = await prisma.outletInventory.findMany();
    }

    // Flatten items for Excel (stringify JSON fields)
    const itemRows = items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      color: item.color || '',
      size: item.size || '',
      fabric: item.fabric || '',
      stock: item.stock,
      price: item.price,
      imageUrl: item.imageUrl || '',
      metadata: item.metadata ? JSON.stringify(item.metadata) : '',
      variants: item.variants ? JSON.stringify(item.variants) : '',
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : '',
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : ''
    }));

    const variantRows = variants.map(v => ({
      id: v.id,
      outletName: v.outletName || '',
      name: v.name || '',
      category: v.category || '',
      color: v.color || '',
      size: v.size || '',
      fabric: v.fabric || '',
      barcode: v.barcode || '',
      stock: v.stock,
      price: v.price,
      imageUrl: v.imageUrl || '',
      metadata: v.metadata ? JSON.stringify(v.metadata) : '',
      variants: v.variants ? JSON.stringify(v.variants) : '',
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : '',
      updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : ''
    }));

    const wb = XLSX.utils.book_new();
    const wsItems = XLSX.utils.json_to_sheet(itemRows);
    const wsVariants = XLSX.utils.json_to_sheet(variantRows);
    XLSX.utils.book_append_sheet(wb, wsItems, 'Products');
    XLSX.utils.book_append_sheet(wb, wsVariants, 'OutletInventory');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = outlet 
      ? `inventory_backup_${outlet.replace(/\s+/g, '_')}_${Date.now()}.xlsx`
      : `inventory_backup_full_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('EXCEL EXPORT ERROR:', error);
    res.status(500).json({ message: 'Failed to export Excel backup', error: error.message });
  }
};

const importBackupExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel backup file is required' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const productsSheet = wb.Sheets['Products'];
    const variantsSheet = wb.Sheets['OutletInventory'] || wb.Sheets['OutletVariants'];

    if (!productsSheet || !variantsSheet) {
      return res.status(400).json({ message: 'Invalid Excel file — must contain "Products" and "OutletInventory" (or "OutletVariants") sheets' });
    }

    const inventoryItems = XLSX.utils.sheet_to_json(productsSheet);
    const outletVariants = XLSX.utils.sheet_to_json(variantsSheet);

    const outlet = req.query.outlet;

    await prisma.$transaction(async (tx) => {
      if (outlet) {
        // --- Branch-Specific Isolation Restore ---
        await tx.outletInventory.deleteMany({ where: { outletName: outlet } });

        // Restore items (upsert them to avoid duplicate ID errors if items exist in another branch)
        for (const item of inventoryItems) {
          const exists = await tx.inventoryItem.findUnique({ where: { id: item.id } });
          if (!exists) {
            await tx.inventoryItem.create({
              data: {
                id: item.id,
                name: item.name,
                category: item.category,
                color: item.color || null,
                size: item.size || null,
                fabric: item.fabric || null,
                stock: parseInt(item.stock) || 0,
                price: parseFloat(item.price) || 0,
                imageUrl: item.imageUrl || null,
                metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
                variants: item.variants ? JSON.parse(item.variants) : undefined,
                createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
                updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
              }
            });
          }
        }

        // Build lookup for inventory item details (support old XLSX format with inventoryItemId)
        const itemLookupXlsx = {};
        for (const item of inventoryItems) {
          itemLookupXlsx[item.id] = item;
        }

        // Restore branch variants
        for (const v of outletVariants) {
          const invItem = itemLookupXlsx[v.inventoryItemId] || {};
          await tx.outletInventory.create({
            data: {
              id: v.id,
              outletName: v.outletName || outlet || null,
              name: v.name || invItem.name || 'Unknown',
              category: v.category || invItem.category || 'UNCATEGORIZED',
              color: v.color || null,
              size: v.size || null,
              fabric: v.fabric || invItem.fabric || '',
              barcode: v.barcode || null,
              stock: parseInt(v.stock) || 0,
              price: parseFloat(v.price) || 0,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date()
            }
          });
        }
      } else {
        // --- Full Legacy Restore ---
        await tx.posReturn.deleteMany();
        await tx.posSaleItem.deleteMany();
        await tx.posSale.deleteMany();
        await tx.outletInventory.deleteMany();
        await tx.inventoryItem.deleteMany();

        // Restore items
        for (const item of inventoryItems) {
          await tx.inventoryItem.create({
            data: {
              id: item.id,
              name: item.name,
              category: item.category,
              color: item.color || null,
              size: item.size || null,
              fabric: item.fabric || null,
              stock: parseInt(item.stock) || 0,
              price: parseFloat(item.price) || 0,
              imageUrl: item.imageUrl || null,
              metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
              variants: item.variants ? JSON.parse(item.variants) : undefined,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
            }
          });
        }

        // Build lookup for inventory item details (support old XLSX format with inventoryItemId)
        const itemLookupXlsxFull = {};
        for (const item of inventoryItems) {
          itemLookupXlsxFull[item.id] = item;
        }

        // Restore outlet variants
        for (const v of outletVariants) {
          const invItem = itemLookupXlsxFull[v.inventoryItemId] || {};
          await tx.outletInventory.create({
            data: {
              id: v.id,
              outletName: v.outletName || null,
              name: v.name || invItem.name || 'Unknown',
              category: v.category || invItem.category || 'UNCATEGORIZED',
              color: v.color || null,
              size: v.size || null,
              fabric: v.fabric || invItem.fabric || '',
              barcode: v.barcode || null,
              stock: parseInt(v.stock) || 0,
              price: parseFloat(v.price) || 0,
              createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
              updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date()
            }
          });
        }
      }
    });

    const cache = require('../utils/cache');
    cache.delPattern('pos:');

    res.json({ message: outlet ? `Excel Backup for ${outlet} imported successfully` : 'Excel backup imported successfully', itemsImported: inventoryItems.length, variantsImported: outletVariants.length });
  } catch (error) {
    console.error('EXCEL IMPORT ERROR:', error);
    res.status(500).json({ message: 'Failed to import Excel backup', error: error.message });
  }
};

module.exports = {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  clearAllInventory,
  bulkUploadInventory,
  allocateInventory,
  getAllocations,
  getAllocationStats,
  searchInventory,
  updateAllocationStatus,
  createCartAllocation,
  getCarts,
  updateCartStatus,
  exportBackup,
  importBackup,
  exportBackupExcel,
  importBackupExcel
};
