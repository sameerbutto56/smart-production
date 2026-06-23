const prisma = require('../prisma');

const createAuditLog = async (orderId, action, details, userId) => {
  try {
    if (!userId) return;
    await prisma.auditLog.create({
      data: { orderId, action, details, performedBy: userId, timestamp: new Date() }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};

const restoreInventory = async (order, userId) => {
  if (!order) return;
  let parsedDetails = typeof order.productDetails === 'string' ? JSON.parse(order.productDetails) : order.productDetails;

  const productsToRestore = [];
  if (Array.isArray(parsedDetails)) {
    parsedDetails.forEach(item => {
      const pd = item.productDetails || item;
      if (pd?.productType) {
        productsToRestore.push({ productType: pd.productType, quantity: item.quantity || 1, color: pd.color, size: pd.size });
      }
    });
  } else if (parsedDetails?.productType) {
    productsToRestore.push({ productType: parsedDetails.productType, quantity: order.quantity || 1, color: parsedDetails.color, size: parsedDetails.size });
  }

  for (const prod of productsToRestore) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        name: { contains: prod.productType, mode: 'insensitive' },
        category: { not: 'FABRIC' }
      }
    });
    if (!inventoryItem) continue;

    const restoreQty = prod.quantity || 1;
    let variantLabel = '';

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];

      if (prod.color || prod.size) {
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
        );
        if (matchIdx >= 0) {
          const current = updatedVariants[matchIdx].stock || 0;
          updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: current + restoreQty };
          variantLabel = `${updatedVariants[matchIdx].color || ''} ${updatedVariants[matchIdx].size || ''}`.trim();
        }
      }

      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { increment: restoreQty } }
      });
    }

    await createAuditLog(order.id, 'INVENTORY_RESTORED', `Restored ${restoreQty} unit(s) of ${inventoryItem.name}${variantLabel ? ' (' + variantLabel + ')' : ''} to stock (order edit reversal). Product ID: ${inventoryItem.id}`, userId);
  }
};

const deductInventoryForEdit = async (order, productDetails, quantity, userId) => {
  let parsedDetails = typeof productDetails === 'string' ? JSON.parse(productDetails) : productDetails;

  const productsToDeduct = [];
  if (Array.isArray(parsedDetails)) {
    parsedDetails.forEach(item => {
      const pd = item.productDetails || item;
      if (pd?.productType) {
        productsToDeduct.push({ productType: pd.productType, quantity: item.quantity || 1, color: pd.color, size: pd.size });
      }
    });
  } else if (parsedDetails?.productType) {
    productsToDeduct.push({ productType: parsedDetails.productType, quantity: quantity || 1, color: parsedDetails.color, size: parsedDetails.size });
  }

  for (const prod of productsToDeduct) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        name: { contains: prod.productType, mode: 'insensitive' },
        category: { not: 'FABRIC' }
      }
    });
    if (!inventoryItem || inventoryItem.stock <= 0) continue;

    const deductQty = prod.quantity || 1;
    let variantLabel = '';

    if (inventoryItem.variants && Array.isArray(inventoryItem.variants)) {
      let updatedVariants = [...inventoryItem.variants];
      let deducted = 0;

      if (prod.color || prod.size) {
        const matchIdx = updatedVariants.findIndex(v =>
          (!prod.color || (v.color && v.color.toLowerCase() === prod.color.toLowerCase())) &&
          (!prod.size || (v.size && v.size.toLowerCase() === prod.size.toLowerCase()))
        );
        if (matchIdx >= 0) {
          const available = updatedVariants[matchIdx].stock || 0;
          if (available >= deductQty) {
            updatedVariants[matchIdx] = { ...updatedVariants[matchIdx], stock: available - deductQty };
            variantLabel = `${updatedVariants[matchIdx].color || ''} ${updatedVariants[matchIdx].size || ''}`.trim();
            deducted = deductQty;
          }
        }
      }

      if (deducted <= 0) continue;

      const newTotalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { variants: updatedVariants, stock: newTotalStock }
      });
    } else {
      const actualDeduct = Math.min(deductQty, inventoryItem.stock);
      await prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { stock: { decrement: actualDeduct } }
      });
    }

    await createAuditLog(order.id, 'INVENTORY_DEDUCTED', `Deducted ${deductQty} unit(s) of ${inventoryItem.name}${variantLabel ? ' (' + variantLabel + ')' : ''} from stock (order edit fulfillment). Product ID: ${inventoryItem.id}`, userId);
  }
};

const createEditRequest = async (req, res) => {
  const { orderId } = req.params;
  const { requestedChanges, reason } = req.body;

  if (!requestedChanges) {
    return res.status(400).json({ message: 'requestedChanges is required' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Source verification — only the original source can request changes
    const userRole = req.user.role;
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      return res.status(403).json({ message: 'Admins cannot create edit requests. Use the Edit Request dashboard to review and manage requests.' });
    }

    if (order.outletName === 'ONLINE ORDER' && userRole !== 'FAISAL') {
      return res.status(403).json({ message: 'Only the Online order portal can request changes for online orders.' });
    }

    if (order.source === 'OUTLET') {
      let requesterOutlet = null;
      const name = req.user.name || '';
      if (name.includes('1') || name.toLowerCase().includes('johar')) requesterOutlet = 'JOHAR TOWN BRANCH';
      else if (name.includes('2') || name.toLowerCase().includes('jail')) requesterOutlet = 'JAIL ROAD BRANCH';
      else if (name.includes('3') || name.toLowerCase().includes('abbottabad')) requesterOutlet = 'ABBOTTABAD BRANCH';
      else requesterOutlet = name || 'OUTLET';

      if (order.outletName !== requesterOutlet) {
        return res.status(403).json({ message: `You can only request changes for orders from ${requesterOutlet}. This order belongs to ${order.outletName}.` });
      }
    }

    const editRequest = await prisma.orderEditRequest.create({
      data: {
        orderId,
        requestedById: req.user.id,
        requestedChanges: typeof requestedChanges === 'string' ? JSON.parse(requestedChanges) : requestedChanges,
        reason: reason || null,
        status: 'PENDING',
        requestedAt: new Date()
      },
      include: {
        order: true,
        requestedBy: { select: { id: true, name: true, role: true } }
      }
    });

    await createAuditLog(orderId, 'EDIT_REQUESTED', `Order edit request submitted. Reason: ${reason || 'No reason provided'}`, req.user.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('global-alert', {
        title: 'Order Edit Requested',
        message: `Edit request for Order #${order.orderNumber || orderId.substring(0, 8)} submitted by ${req.user.name}`,
        type: 'INFO'
      });
    }

    res.status(201).json({ message: 'Edit request submitted', editRequest });
  } catch (error) {
    console.error('Error creating edit request:', error);
    res.status(500).json({ message: 'Error creating edit request', error: error.message });
  }
};

const getEditRequests = async (req, res) => {
  try {
    const { status, stats } = req.query;

    const where = {};
    if (status && status !== 'ALL') where.status = status;

    const limit = parseInt(req.query.limit) || 200;
    const requests = await prisma.orderEditRequest.findMany({
      where,
      include: {
        order: {
          include: {
            stages: { orderBy: { createdAt: 'desc' }, select: { stageName: true, status: true, deadlineAt: true, completedAt: true, startedAt: true, rejectionReason: true, returnedFrom: true, returnReason: true, createdAt: true, updatedAt: true, requestNextStep: true } },
            auditLogs: { orderBy: { timestamp: 'desc' }, take: 20, select: { action: true, timestamp: true, details: true, performedBy: true } }
          }
        },
        requestedBy: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { requestedAt: 'desc' },
      take: limit
    });

    if (stats === 'true') {
      const total = requests.length;
      const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
      const bySource = {};
      for (const req of requests) {
        byStatus[req.status] = (byStatus[req.status] || 0) + 1;
        const source = req.requestedBy?.role === 'FAISAL' ? 'ONLINE' : (req.order?.outletName || 'UNKNOWN');
        bySource[source] = (bySource[source] || 0) + 1;
      }
      return res.json({ total, byStatus, bySource, requests });
    }

    res.json(requests);
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    res.status(500).json({ message: 'Error fetching edit requests', error: error.message });
  }
};

const approveEditRequest = async (req, res) => {
  const { requestId } = req.params;
  const { adminRemarks } = req.body;

  try {
    const editRequest = await prisma.orderEditRequest.findUnique({
      where: { id: requestId },
      include: { order: true }
    });

    if (!editRequest) {
      return res.status(404).json({ message: 'Edit request not found' });
    }

    if (editRequest.status !== 'PENDING') {
      return res.status(400).json({ message: `Edit request already ${editRequest.status.toLowerCase()}` });
    }

    if (!editRequest.order) {
      return res.status(404).json({ message: 'Associated order not found' });
    }

    const order = editRequest.order;
    const requestedChanges = editRequest.requestedChanges;

    // 1. Restore old inventory (add stock back)
    await restoreInventory(order, req.user.id);

    // 2. Update order with new product details
    const updateData = {};

    if (requestedChanges.productDetails) {
      updateData.productDetails = typeof requestedChanges.productDetails === 'string'
        ? requestedChanges.productDetails
        : JSON.stringify(requestedChanges.productDetails);
    }

    if (requestedChanges.quantity) {
      updateData.quantity = parseInt(requestedChanges.quantity);
    }

    if (requestedChanges.totalPrice !== undefined) {
      updateData.totalPrice = parseFloat(requestedChanges.totalPrice);
    }

    if (requestedChanges.items && Array.isArray(requestedChanges.items)) {
      // Multi-item update
      const items = requestedChanges.items.map(item => ({
        productDetails: item.productDetails,
        customization: item.customization,
        sizeData: item.sizeData,
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice || 0,
        logoName: item.logoName || '',
        logoDesign: item.logoDesign || '',
        logoCharges: parseFloat(item.logoCharges) || 0,
        namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
        customizationPrice: parseFloat(item.customizationPrice) || 0,
        capCharges: parseInt(item.capCharges) || 0
      }));
      updateData.productDetails = JSON.stringify(items);
      updateData.quantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      
      // Sync customization and sizeData to order for compatibility
      updateData.customization = items[0]?.customization ? JSON.stringify(items[0].customization) : null;
      updateData.sizeData = items[0]?.sizeData ? JSON.stringify(items[0].sizeData) : null;
    }

    // Map other order-level properties if present
    const fieldsToMap = [
      'customerName', 'customerPhone', 'address', 'city', 'type',
      'priority', 'advancePaid', 'advanceAmount', 'logoDesign', 'logoName',
      'logoCharges', 'namePrintingCharges', 'customizationPrice',
      'deliveryCharges', 'instructionNotes',
      'shopifyOrderDate'
    ];

    fieldsToMap.forEach(field => {
      if (requestedChanges[field] !== undefined) {
        if (field === 'advancePaid') {
          updateData[field] = !!requestedChanges[field];
        } else if (['logoCharges', 'namePrintingCharges', 'customizationPrice', 'advanceAmount', 'deliveryCharges'].includes(field)) {
          updateData[field] = parseFloat(requestedChanges[field]) || 0;
        } else if (field === 'shopifyOrderDate') {
          updateData[field] = requestedChanges[field] ? new Date(requestedChanges[field]) : null;
        } else {
          updateData[field] = requestedChanges[field];
        }
      }
    });

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: updateData
    });

    // 3. Deduct inventory for new products
    const newProductDetails = updateData.productDetails || order.productDetails;
    const newQuantity = updateData.quantity || order.quantity;
    await deductInventoryForEdit(order, newProductDetails, newQuantity, req.user.id);

    // 4. Mark edit request as approved
    await prisma.orderEditRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: req.user.id,
        adminRemarks: adminRemarks || null,
        reviewedAt: new Date()
      }
    });

    await createAuditLog(order.id, 'EDIT_APPROVED', `Order edit approved by ${req.user.name}. Remarks: ${adminRemarks || 'N/A'}`, req.user.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('global-alert', {
        title: 'Order Edit Approved',
        message: `Edit request for Order #${order.orderNumber || order.id.substring(0, 8)} approved by ${req.user.name}`,
        type: 'SUCCESS'
      });
      io.emit('order-updated', { orderId: order.id, createdById: order.createdById });
    }

    res.json({ message: 'Edit request approved', order: updatedOrder });
  } catch (error) {
    console.error('Error approving edit request:', error);
    res.status(500).json({ message: 'Error approving edit request', error: error.message });
  }
};

const rejectEditRequest = async (req, res) => {
  const { requestId } = req.params;
  const { adminRemarks } = req.body;

  try {
    const editRequest = await prisma.orderEditRequest.findUnique({
      where: { id: requestId },
      include: { order: true }
    });

    if (!editRequest) {
      return res.status(404).json({ message: 'Edit request not found' });
    }

    if (editRequest.status !== 'PENDING') {
      return res.status(400).json({ message: `Edit request already ${editRequest.status.toLowerCase()}` });
    }

    await prisma.orderEditRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedById: req.user.id,
        adminRemarks: adminRemarks || null,
        reviewedAt: new Date()
      }
    });

    await createAuditLog(editRequest.orderId, 'EDIT_REJECTED', `Order edit rejected by ${req.user.name}. Remarks: ${adminRemarks || 'N/A'}`, req.user.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('global-alert', {
        title: 'Order Edit Rejected',
        message: `Edit request for Order #${editRequest.order?.orderNumber || editRequest.orderId.substring(0, 8)} rejected by ${req.user.name}`,
        type: 'WARNING'
      });
    }

    res.json({ message: 'Edit request rejected' });
  } catch (error) {
    console.error('Error rejecting edit request:', error);
    res.status(500).json({ message: 'Error rejecting edit request', error: error.message });
  }
};

module.exports = { createEditRequest, getEditRequests, approveEditRequest, rejectEditRequest };
