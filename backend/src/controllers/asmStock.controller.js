const prisma = require('../prisma');
const notify = require('../utils/notify');

/**
 * Generate atomic sequence number for ASM Stock Request (ASH-YYYYMMDD-#####)
 */
const nextRequestNumber = async (tx) => {
  const now = new Date();
  const year = now.getFullYear();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = await tx.asmStockRequestSequence.upsert({
    where: { prefix_year: { prefix: 'ASH', year } },
    update: { nextValue: { increment: 1 } },
    create: { prefix: 'ASH', year, nextValue: 1 }
  });
  return `ASH-${dateStr}-${String(seq.nextValue).padStart(5, '0')}`;
};

/**
 * Generate atomic sequence number for ASM Stock Return (ASR-YYYYMMDD-#####)
 */
const nextReturnNumber = async (tx) => {
  const now = new Date();
  const year = now.getFullYear();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = await tx.asmStockReturnSequence.upsert({
    where: { prefix_year: { prefix: 'ASR', year } },
    update: { nextValue: { increment: 1 } },
    create: { prefix: 'ASR', year, nextValue: 1 }
  });
  return `ASR-${dateStr}-${String(seq.nextValue).padStart(5, '0')}`;
};

/**
 * GET /api/asm-stock/warehouse-catalog
 * Fetch live Warehouse inventory items for Store -> ASM Allowed cart
 */
const getWarehouseCatalog = async (req, res) => {
  try {
    const { search, category } = req.query;
    const where = {
      stock: { gt: 0 }
    };
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
        { color: { contains: s, mode: 'insensitive' } },
        { size: { contains: s, mode: 'insensitive' } },
        { fabric: { contains: s, mode: 'insensitive' } }
      ];
    }
    if (category && category.trim()) {
      where.category = { equals: category.trim(), mode: 'insensitive' };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    return res.json({ items });
  } catch (err) {
    console.error('getWarehouseCatalog error:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch warehouse catalog' });
  }
};

/**
 * GET /api/asm-stock/asms
 * List active ASM users
 */
const getAsmUsers = async (req, res) => {
  try {
    const asms = await prisma.user.findMany({
      where: { role: 'ASM', isActive: true },
      select: { id: true, name: true, email: true }
    });
    return res.json({ asms });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch ASM users' });
  }
};

/**
 * POST /api/asm-stock/requests
 * Submit ASM Stock Handover Request from Store
 */
const createStockRequest = async (req, res) => {
  try {
    const { storeName, asmId, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required' });
    }

    // Resolve target ASM
    let asmUser = null;
    if (asmId) {
      asmUser = await prisma.user.findUnique({ where: { id: asmId }, select: { id: true, name: true } });
    }

    const request = await prisma.$transaction(async (tx) => {
      const requestNumber = await nextRequestNumber(tx);

      // Validate stock and deduct inventory
      const preparedItems = [];
      for (const item of items) {
        const qty = parseInt(item.quantityGiven || item.quantity) || 0;
        if (qty <= 0) continue;

        let inv = null;
        if (item.inventoryItemId) {
          inv = await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
        }
        if (!inv && item.productName) {
          inv = await tx.inventoryItem.findFirst({
            where: { name: item.productName, color: item.color || null, size: item.size || null }
          });
        }

        if (inv) {
          if (inv.stock < qty) {
            throw new Error(`Insufficient stock for ${inv.name} (${inv.color || ''} ${inv.size || ''}). Available: ${inv.stock}, Requested: ${qty}`);
          }
          // Deduct from inventory
          await tx.inventoryItem.update({
            where: { id: inv.id },
            data: { stock: { decrement: qty } }
          });
        }

        preparedItems.push({
          inventoryItemId: inv ? inv.id : (item.inventoryItemId || null),
          productName: item.productName || inv?.name || 'Item',
          category: item.category || inv?.category || 'General',
          color: item.color || inv?.color || null,
          size: item.size || inv?.size || null,
          fabric: item.fabric || inv?.fabric || null,
          quantityGiven: qty,
          quantityReturned: 0,
          quantityRemaining: qty,
          unit: item.unit || 'Pieces',
          price: item.price !== undefined ? parseFloat(item.price) : (inv?.price || null),
          metadata: item.variant ? JSON.stringify(item.variant) : (item.metadata || null)
        });
      }

      if (preparedItems.length === 0) {
        throw new Error('No valid items to request');
      }

      const created = await tx.asmStockRequest.create({
        data: {
          requestNumber,
          storeName: storeName || 'Warehouse Store',
          submittedById: req.user.id,
          submittedByName: req.user.name || 'Store User',
          asmId: asmUser ? asmUser.id : (asmId || null),
          asmName: asmUser ? asmUser.name : (req.body.asmName || null),
          status: 'SUBMITTED',
          notes: notes || null,
          items: {
            create: preparedItems
          }
        },
        include: {
          items: true
        }
      });

      await tx.asmStockAuditLog.create({
        data: {
          requestId: created.id,
          action: 'SUBMITTED',
          details: `ASM Stock Handover request ${created.requestNumber} submitted by ${req.user.name || 'Store'} for ${created.asmName || 'ASM'}`,
          performedBy: req.user.id
        }
      });

      return created;
    });

    notify.create({
      role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
      title: '📦 New ASM Stock Handover',
      message: `Stock Handover ${request.requestNumber} submitted to ${request.asmName || 'ASM'}`
    }).catch(() => {});

    return res.status(201).json({ ok: true, request });
  } catch (err) {
    console.error('createStockRequest error:', err);
    return res.status(400).json({ message: err.message || 'Failed to create ASM stock request' });
  }
};

/**
 * GET /api/asm-stock/requests
 * Fetch ASM Stock Handover Requests (Active / History)
 */
const listStockRequests = async (req, res) => {
  try {
    const { status, asmId, storeName, search, mode } = req.query;
    const where = {};

    if (req.user?.role === 'ASM') {
      where.OR = [
        { asmId: req.user.id },
        { asmName: { contains: req.user.name, mode: 'insensitive' } }
      ];
    } else if (asmId) {
      where.asmId = asmId;
    }

    if (storeName) where.storeName = { contains: storeName, mode: 'insensitive' };

    if (mode === 'history') {
      where.status = 'FULLY_RETURNED';
    } else if (mode === 'active') {
      where.status = { in: ['SUBMITTED', 'ACCEPTED', 'PARTIALLY_RETURNED'] };
    } else if (status) {
      where.status = status;
    }

    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        ...(where.OR || []),
        { requestNumber: { contains: s, mode: 'insensitive' } },
        { asmName: { contains: s, mode: 'insensitive' } },
        { submittedByName: { contains: s, mode: 'insensitive' } }
      ];
    }

    const requests = await prisma.asmStockRequest.findMany({
      where,
      include: {
        items: true,
        returns: {
          include: { items: true },
          orderBy: { submittedAt: 'desc' }
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return res.json({ requests });
  } catch (err) {
    console.error('listStockRequests error:', err);
    return res.status(500).json({ message: err.message || 'Failed to list stock requests' });
  }
};

/**
 * GET /api/asm-stock/requests/:id
 */
const getStockRequestById = async (req, res) => {
  try {
    const request = await prisma.asmStockRequest.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        returns: {
          include: { items: true },
          orderBy: { submittedAt: 'desc' }
        },
        auditLogs: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!request) return res.status(404).json({ message: 'Request not found' });
    return res.json({ request });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch request' });
  }
};

/**
 * POST /api/asm-stock/requests/:id/accept
 * ASM accepts physical stock handover
 */
const acceptStockRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const reqRecord = await prisma.asmStockRequest.findUnique({ where: { id } });

    if (!reqRecord) return res.status(404).json({ message: 'Stock request not found' });

    if (reqRecord.status === 'ACCEPTED' || reqRecord.status === 'PARTIALLY_RETURNED' || reqRecord.status === 'FULLY_RETURNED') {
      return res.json({ ok: true, message: 'Request already accepted', request: reqRecord });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const resReq = await tx.asmStockRequest.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedById: req.user.id,
          acceptedByName: req.user.name || 'ASM'
        },
        include: { items: true, auditLogs: true }
      });

      await tx.asmStockAuditLog.create({
        data: {
          requestId: id,
          action: 'ACCEPTED',
          details: `Stock Handover ${resReq.requestNumber} accepted by ${req.user.name || 'ASM'}`,
          performedBy: req.user.id
        }
      });

      return resReq;
    });

    notify.create({
      role: ['STORE', 'SUPER_ADMIN', 'ADMIN'],
      title: '✅ ASM Accepted Stock',
      message: `ASM ${req.user.name || ''} accepted stock handover ${updated.requestNumber}`
    }).catch(() => {});

    return res.json({ ok: true, request: updated });
  } catch (err) {
    console.error('acceptStockRequest error:', err);
    return res.status(400).json({ message: err.message || 'Failed to accept stock request' });
  }
};

/**
 * POST /api/asm-stock/returns
 * ASM submits stock return request
 */
const createStockReturn = async (req, res) => {
  try {
    const { requestId, notes, items } = req.body;

    if (!requestId) return res.status(400).json({ message: 'Request ID is required' });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Return items are required' });
    }

    const stockReq = await prisma.asmStockRequest.findUnique({
      where: { id: requestId },
      include: { items: true }
    });

    if (!stockReq) return res.status(404).json({ message: 'Handover request not found' });

    const returnRecord = await prisma.$transaction(async (tx) => {
      const returnNumber = await nextReturnNumber(tx);

      const preparedItems = [];
      for (const retItem of items) {
        const qtyRet = parseInt(retItem.quantityReturned) || 0;
        if (qtyRet <= 0) continue;

        const originalItem = stockReq.items.find(i => i.id === retItem.requestItemId);
        if (!originalItem) {
          throw new Error(`Item ${retItem.requestItemId} not found on handover request`);
        }

        if (qtyRet > originalItem.quantityRemaining) {
          throw new Error(`Cannot return ${qtyRet} units of ${originalItem.productName}. Maximum remaining with ASM: ${originalItem.quantityRemaining}`);
        }

        preparedItems.push({
          requestItemId: originalItem.id,
          inventoryItemId: originalItem.inventoryItemId || null,
          productName: originalItem.productName,
          category: originalItem.category,
          color: originalItem.color || null,
          size: originalItem.size || null,
          fabric: originalItem.fabric || null,
          quantityReturned: qtyRet,
          unit: originalItem.unit || 'Pieces'
        });
      }

      if (preparedItems.length === 0) {
        throw new Error('No valid return items provided');
      }

      const createdReturn = await tx.asmStockReturn.create({
        data: {
          returnNumber,
          requestId,
          asmId: req.user.id,
          asmName: req.user.name || 'ASM',
          status: 'PENDING_STORE_ACCEPT',
          notes: notes || null,
          items: {
            create: preparedItems
          }
        },
        include: { items: true }
      });

      await tx.asmStockAuditLog.create({
        data: {
          requestId,
          action: 'RETURN_SUBMITTED',
          details: `ASM Stock Return ${createdReturn.returnNumber} submitted by ${req.user.name || 'ASM'} (${preparedItems.length} item types)`,
          performedBy: req.user.id
        }
      });

      return createdReturn;
    });

    notify.create({
      role: ['STORE', 'SUPER_ADMIN', 'ADMIN'],
      title: '↩️ New ASM Stock Return',
      message: `ASM ${req.user.name || ''} submitted stock return ${returnRecord.returnNumber}`
    }).catch(() => {});

    return res.status(201).json({ ok: true, returnRecord });
  } catch (err) {
    console.error('createStockReturn error:', err);
    return res.status(400).json({ message: err.message || 'Failed to submit stock return' });
  }
};

/**
 * GET /api/asm-stock/returns
 * List ASM stock return requests
 */
const listStockReturns = async (req, res) => {
  try {
    const { status, requestId, mode } = req.query;
    const where = {};

    if (req.user?.role === 'ASM') {
      where.asmId = req.user.id;
    }

    if (requestId) where.requestId = requestId;

    if (mode === 'history') {
      where.status = 'STORE_ACCEPTED';
    } else if (mode === 'pending') {
      where.status = 'PENDING_STORE_ACCEPT';
    } else if (status) {
      where.status = status;
    }

    const returns = await prisma.asmStockReturn.findMany({
      where,
      include: {
        items: true,
        request: {
          select: { id: true, requestNumber: true, storeName: true, submittedByName: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return res.json({ returns });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to list returns' });
  }
};

/**
 * POST /api/asm-stock/returns/:id/accept
 * Store accepts returned stock -> restores inventory & updates remaining quantities
 */
const acceptStockReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const returnRec = await prisma.asmStockReturn.findUnique({
      where: { id },
      include: { items: true, request: { include: { items: true } } }
    });

    if (!returnRec) return res.status(404).json({ message: 'Return record not found' });

    if (returnRec.status === 'STORE_ACCEPTED') {
      return res.json({ ok: true, message: 'Return already accepted', returnRecord: returnRec });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark return accepted
      const updatedReturn = await tx.asmStockReturn.update({
        where: { id },
        data: {
          status: 'STORE_ACCEPTED',
          acceptedAt: new Date(),
          acceptedById: req.user.id,
          acceptedByName: req.user.name || 'Store User'
        },
        include: { items: true }
      });

      // 2. Restore inventory & update request items
      for (const retItem of returnRec.items) {
        const qty = retItem.quantityReturned;
        if (qty <= 0) continue;

        // Restore to Warehouse InventoryItem
        if (retItem.inventoryItemId) {
          await tx.inventoryItem.update({
            where: { id: retItem.inventoryItemId },
            data: { stock: { increment: qty } }
          });
        } else if (retItem.productName) {
          const inv = await tx.inventoryItem.findFirst({
            where: { name: retItem.productName, color: retItem.color || null, size: retItem.size || null }
          });
          if (inv) {
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { stock: { increment: qty } }
            });
          }
        }

        // Update original handover request item
        if (retItem.requestItemId) {
          const reqItem = await tx.asmStockRequestItem.findUnique({ where: { id: retItem.requestItemId } });
          if (reqItem) {
            const nextRet = reqItem.quantityReturned + qty;
            const nextRem = Math.max(0, reqItem.quantityGiven - nextRet);
            await tx.asmStockRequestItem.update({
              where: { id: reqItem.id },
              data: {
                quantityReturned: nextRet,
                quantityRemaining: nextRem
              }
            });
          }
        }
      }

      // 3. Recompute request overall status
      const updatedReqItems = await tx.asmStockRequestItem.findMany({
        where: { requestId: returnRec.requestId }
      });
      const allFullyReturned = updatedReqItems.every(i => i.quantityRemaining === 0);
      const anyReturned = updatedReqItems.some(i => i.quantityReturned > 0);
      const nextReqStatus = allFullyReturned ? 'FULLY_RETURNED' : (anyReturned ? 'PARTIALLY_RETURNED' : 'ACCEPTED');

      await tx.asmStockRequest.update({
        where: { id: returnRec.requestId },
        data: { status: nextReqStatus }
      });

      await tx.asmStockAuditLog.create({
        data: {
          requestId: returnRec.requestId,
          action: 'RETURN_ACCEPTED',
          details: `Store ${req.user.name || ''} accepted returned stock (${returnRec.returnNumber}). Inventory restored for returned items.`,
          performedBy: req.user.id
        }
      });

      return updatedReturn;
    });

    notify.create({
      role: ['ASM', 'SUPER_ADMIN', 'ADMIN'],
      title: '🎉 Store Accepted Stock Return',
      message: `Store accepted return ${result.returnNumber}. Inventory has been restored.`
    }).catch(() => {});

    return res.json({ ok: true, returnRecord: result });
  } catch (err) {
    console.error('acceptStockReturn error:', err);
    return res.status(400).json({ message: err.message || 'Failed to accept stock return' });
  }
};

module.exports = {
  getWarehouseCatalog,
  getAsmUsers,
  createStockRequest,
  listStockRequests,
  getStockRequestById,
  acceptStockRequest,
  createStockReturn,
  listStockReturns,
  acceptStockReturn
};
