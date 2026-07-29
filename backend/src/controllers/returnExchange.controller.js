const prisma = require('../prisma');
const notify = require('../utils/notify');

const lookupOrder = async (req, res) => {
  try {
    const { query } = req.params;
    const orConditions = [
      { orderNumber: { equals: query, mode: 'insensitive' } },
      { orderNumber: { endsWith: query, mode: 'insensitive' } },
      { invoiceNumber: { equals: query, mode: 'insensitive' } },
      { invoiceNumber: { endsWith: query, mode: 'insensitive' } },
      { customerPhone: { contains: query } }
    ];
    const order = await prisma.order.findFirst({
      where: {
        OR: orConditions
      },
      include: {
        stages: { orderBy: { createdAt: 'asc' } },
        deliveryAttempts: { orderBy: { attemptNumber: 'desc' } },
        noResponseLogs: { orderBy: { createdAt: 'desc' } },
        deliveryPayments: { orderBy: { createdAt: 'desc' } },
        returnExchangeCases: { orderBy: { createdAt: 'desc' } }
      }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('Error looking up order:', error);
    res.status(500).json({ message: 'Failed to look up order', error: error.message });
  }
};

const createReturnExchange = async (req, res) => {
  try {
    const { orderId, type, returnReason, replacementItems, notes } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const record = await prisma.returnExchange.create({
      data: {
        orderId,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        type,
        status: 'PENDING',
        returnReason,
        originalProducts: order.productDetails,
        replacementItems: replacementItems ? JSON.stringify(replacementItems) : null,
        deliveryAttempts: order.noResponseCount || 0,
        nextDeliveryDate: order.nextDeliveryDate,
        handledBy: req.user?.name || null,
        handledById: req.user?.id || null
      }
    });

    if (type === 'RETURN') {
      await prisma.order.update({
        where: { id: orderId },
        data: { refundStatus: 'REQUESTED', refundReason: returnReason || 'Return initiated by Inventory View' }
      });
    }

    await prisma.auditLog.create({
      data: {
        orderId,
        action: type === 'RETURN' ? 'RETURN_INITIATED' : type === 'REPLACEMENT' ? 'REPLACEMENT_INITIATED' : 'NO_RESPONSE_LOGGED',
        details: `${type} initiated by ${req.user?.name || 'Inventory View'}. Reason: ${returnReason || 'N/A'}`,
        performedBy: req.user?.id || 'SYSTEM'
      }
    });

    await notify.create(req, { type: 'return_exchange', moduleName: 'Return & Exchange', path: '/return-exchange', role: 'STORE', title: 'New Return/Exchange Request', message: `${type} request for ${order?.customerName || 'customer'}`, orderId: order?.id, customerName: order?.customerName, action: `${type} Requested`, employeeName: req.user?.name }).catch(() => {});

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating return/exchange:', error);
    res.status(500).json({ message: 'Failed to create record', error: error.message });
  }
};

const rescheduleDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const attempt = (order.noResponseCount || 0) + 1;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          noResponseCount: attempt,
          nextDeliveryDate: tomorrow,
          lastDeliveryAttempt: new Date(),
          dispatchStatus: attempt >= 3 ? 'FAILED' : 'RESCHEDULED',
          status: attempt >= 3 ? 'MAX_ATTEMPTS_REACHED' : order.status
        }
      });

      await tx.noResponseLog.create({
        data: { orderId, attemptNumber: attempt, markedBy: req.user?.name || 'Inventory View', notes }
      });

      await tx.deliveryAttempt.create({
        data: {
          orderId, attemptNumber: attempt, status: 'NO_RESPONSE',
          riderName: order.dispatchOfficer || null,
          notes: notes || `Rescheduled by Inventory View - attempt ${attempt}`,
          rescheduledTo: tomorrow
        }
      });

      if (attempt >= 3) {
        await tx.returnExchange.create({
          data: {
            orderId,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            type: 'RETURN',
            status: 'PENDING',
            returnReason: 'Auto-moved after 3 failed delivery attempts',
            originalProducts: order.productDetails,
            deliveryAttempts: attempt,
            nextDeliveryDate: null,
            handledBy: req.user?.name || 'System (auto)',
            handledById: req.user?.id || null
          }
        });

        await tx.order.update({
          where: { id: orderId },
          data: { refundStatus: 'REQUESTED', refundReason: 'Auto-return after 3 failed delivery attempts' }
        });
      }

      await tx.auditLog.create({
        data: {
          orderId,
          action: attempt >= 3 ? 'AUTO_RETURN_AFTER_3_ATTEMPTS' : 'DELIVERY_RESCHEDULED',
          details: attempt >= 3
            ? `Auto-moved to Return after 3 failed attempts`
            : `Rescheduled for next day. Attempt ${attempt}/3. Notes: ${notes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.order.findUnique({
        where: { id: orderId },
        include: { stages: { orderBy: { createdAt: 'asc' } }, deliveryAttempts: { orderBy: { attemptNumber: 'desc' } }, noResponseLogs: { orderBy: { createdAt: 'desc' } }, returnExchangeCases: { orderBy: { createdAt: 'desc' } } }
      });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error rescheduling delivery:', error);
    res.status(500).json({ message: 'Failed to reschedule', error: error.message });
  }
};

const approveWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, warehouseNotes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const newStatus = action === 'APPROVE' ? 'WAREHOUSE_APPROVED' : 'WAREHOUSE_REJECTED';

    // For REPLACEMENT, check stock availability before approving
    if (action === 'APPROVE' && record.type === 'REPLACEMENT') {
      const replacements = typeof record.replacementItems === 'string' ? JSON.parse(record.replacementItems) : (record.replacementItems || []);
      if (Array.isArray(replacements) && replacements.length > 0) {
        for (const item of replacements) {
          const name = item.name || item.productName || '';
          if (!name) continue;
          const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
          let found = false;
          for (const inv of invItems) {
            const variants = inv.variants || [];
            const color = item.color || '';
            const size = item.size || '';
            const matchVariant = variants.find(v => {
              const colorMatch = color ? v.color === color : true;
              const sizeMatch = size ? v.size === size : true;
              return colorMatch && sizeMatch;
            });
            if (matchVariant && (matchVariant.stock || 0) >= (item.quantity || 1)) {
              found = true;
              break;
            }
          }
          if (!found) {
            return res.status(400).json({
              message: `"${name}" (${item.color || 'any color'}, ${item.size || 'any size'}) is not available in warehouse inventory.`,
              product: name
            });
          }
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update status
      const statusData = {
        status: newStatus,
        warehouseNotes,
        warehouseApprovedBy: req.user?.name || 'Warehouse',
        warehouseApprovedAt: new Date()
      };
      await tx.returnExchange.update({ where: { id }, data: statusData });

      if (action === 'APPROVE') {
        const order = await tx.order.findUnique({ where: { id: record.orderId } });

        // Step 1: Add original products back to warehouse inventory (RETURN + REPLACEMENT)
        const originals = typeof record.originalProducts === 'string' ? JSON.parse(record.originalProducts) : (record.originalProducts || []);
        for (const item of originals) {
          const pd = item.productDetails || item;
          const name = pd.name || pd.productType || '';
          if (!name) continue;
          const invItems = await tx.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
          for (const inv of invItems) {
            const variants = inv.variants || [];
            const color = pd.color || '';
            const size = pd.size || '';
            const updatedVariants = variants.map(v => {
              const colorMatch = color ? v.color === color : true;
              const sizeMatch = size ? v.size === size : true;
              if (colorMatch && sizeMatch) {
                return { ...v, stock: (v.stock || 0) + (item.quantity || 1) };
              }
              return v;
            });
            const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { variants: updatedVariants, totalStock: newTotal }
            });
          }
        }

        // Step 2: For REPLACEMENT, deduct new items from warehouse inventory
        if (record.type === 'REPLACEMENT') {
          const replacements = typeof record.replacementItems === 'string' ? JSON.parse(record.replacementItems) : (record.replacementItems || []);
          for (const item of replacements) {
            const name = item.name || item.productName || '';
            if (!name) continue;
            const invItems = await tx.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
            for (const inv of invItems) {
              const variants = inv.variants || [];
              const color = item.color || '';
              const size = item.size || '';
              const updatedVariants = variants.map(v => {
                const colorMatch = color ? v.color === color : true;
                const sizeMatch = size ? v.size === size : true;
                if (colorMatch && sizeMatch) {
                  return { ...v, stock: Math.max(0, (v.stock || 0) - (item.quantity || 1)) };
                }
                return v;
              });
              const newTotal = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
              await tx.inventoryItem.update({
                where: { id: inv.id },
                data: { variants: updatedVariants, totalStock: newTotal }
              });
            }
          }

          // Set to DISPATCH_READY so warehouse can dispatch
          await tx.returnExchange.update({
            where: { id },
            data: { status: 'DISPATCH_READY' }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: action === 'APPROVE' ? 'WAREHOUSE_RETURN_APPROVED' : 'WAREHOUSE_RETURN_REJECTED',
          details: `Warehouse ${action === 'APPROVE' ? 'approved' : 'rejected'} ${record.type} for ${record.orderNumber}. Notes: ${warehouseNotes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.returnExchange.findUnique({ where: { id } });
    });

    await notify.create(req, { type: 'return_exchange', moduleName: 'Return & Exchange', path: '/return-exchange', role: 'INVENTORY_VIEW', title: 'Return/Exchange Processed', message: `Request #${record.id} ${newStatus}`, action: `${newStatus}`, employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Error in warehouse approval:', error);
    res.status(500).json({ message: 'Failed to process', error: error.message });
  }
};

const dispatchReplacement = async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatchNotes } = req.body;
    const record = await prisma.returnExchange.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (record.status !== 'DISPATCH_READY') return res.status(400).json({ message: 'Not ready for dispatch' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.returnExchange.update({
        where: { id },
        data: { status: 'COMPLETED', dispatchNotes, dispatchedAt: new Date() }
      });

      await tx.order.update({
        where: { id: record.orderId },
        data: { dispatchStatus: 'DISPATCHED' }
      });

      await tx.auditLog.create({
        data: {
          orderId: record.orderId,
          action: 'REPLACEMENT_DISPATCHED',
          details: `Replacement dispatched for ${record.orderNumber}. Notes: ${dispatchNotes || 'N/A'}`,
          performedBy: req.user?.id || 'SYSTEM'
        }
      });

      return tx.returnExchange.findUnique({ where: { id } });
    });

    res.json(updated);
  } catch (error) {
    console.error('Error dispatching replacement:', error);
    res.status(500).json({ message: 'Failed to dispatch', error: error.message });
  }
};

const getCaseHistory = async (req, res) => {
  try {
    const { orderId } = req.params;
    const cases = await prisma.returnExchange.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(cases);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Failed to fetch history', error: error.message });
  }
};

const getAllCases = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 50, dateFrom, dateTo } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } }
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); where.createdAt.lte = d; }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [cases, total] = await Promise.all([
      prisma.returnExchange.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }),
      prisma.returnExchange.count({ where })
    ]);
    res.json({ cases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ message: 'Failed to fetch cases', error: error.message });
  }
};

const checkStockAvailability = async (req, res) => {
  try {
    const { items } = req.body; // [{ name, color, size, quantity }]
    if (!items || !Array.isArray(items)) return res.status(400).json({ message: 'Items array required' });

    const results = [];
    for (const item of items) {
      const name = item.name || '';
      if (!name) { results.push({ ...item, available: false, stock: 0 }); continue; }
      const invItems = await prisma.inventoryItem.findMany({ where: { name: { contains: name, mode: 'insensitive' } } });
      let availableStock = 0;
      for (const inv of invItems) {
        const variants = inv.variants || [];
        const color = item.color || '';
        const size = item.size || '';
        const matchVariant = variants.find(v => {
          const colorMatch = color ? v.color === color : true;
          const sizeMatch = size ? v.size === size : true;
          return colorMatch && sizeMatch;
        });
        if (matchVariant) availableStock += (matchVariant.stock || 0);
      }
      results.push({
        name, color: item.color, size: item.size, quantity: item.quantity,
        available: availableStock >= (item.quantity || 1),
        stock: availableStock
      });
    }
    res.json(results);
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ message: 'Failed to check stock', error: error.message });
  }
};

module.exports = { lookupOrder, createReturnExchange, rescheduleDelivery, approveWarehouse, dispatchReplacement, getCaseHistory, getAllCases, checkStockAvailability };
