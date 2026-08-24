const prisma = require('../prisma');
const postexService = require('../services/postex.service');

// ─── Feature Flag ──────────────────────────────────────────────────────────

const getConfig = async (req, res) => {
  try {
    const config = await postexService.getConfig();
    res.json(config);
  } catch (err) {
    console.error('POSTEX_CONFIG_ERROR', err.message);
    res.status(500).json({ message: 'Failed to fetch PostEx config.' });
  }
};

const setConfig = async (req, res) => {
  try {
    const { mode, apiKey, senderName, senderPhone, endpoint } = req.body;
    const credentials = (apiKey || senderName || senderPhone || endpoint) ? {
      apiKey: apiKey || undefined,
      senderName: senderName || undefined,
      senderPhone: senderPhone || undefined,
      endpoint: endpoint || undefined
    } : undefined;

    const result = await postexService.setIntegrationMode(mode, credentials);
    res.json({ message: `PostEx integration set to ${result.mode}`, ...result });
  } catch (err) {
    console.error('POSTEX_SET_CONFIG_ERROR', err.message);
    res.status(400).json({ message: err.message });
  }
};

// ─── Shipment CRUD ─────────────────────────────────────────────────────────

const createShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { parcelWeight, specialInstructions, notes } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check if order already has an active (non-terminal) PostEx shipment
    const existingActive = await prisma.postExShipment.findFirst({
      where: {
        orderId,
        status: { notIn: ['DELIVERED', 'RETURNED', 'RETURN_RECEIVED', 'CANCELLED'] }
      }
    });
    if (existingActive) {
      return res.status(409).json({
        message: 'This order already has an active PostEx shipment. Complete or cancel it first.',
        existingShipment: existingActive
      });
    }

    const payload = postexService.buildShipmentPayload(order, { parcelWeight, specialInstructions });
    const mode = await postexService.getIntegrationMode();

    // Call PostEx API (simulated in OFF/TEST mode)
    const apiResult = await postexService.createPostExShipment(payload);

    // Create shipment record
    const shipment = await prisma.postExShipment.create({
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        shipmentNumber: apiResult.shipmentNumber || null,
        trackingNumber: apiResult.trackingNumber || null,
        referenceNumber: payload.referenceNumber,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        address: payload.address,
        city: payload.city,
        productDetails: payload.productDetails,
        totalAmount: payload.totalAmount,
        codAmount: payload.codAmount,
        paymentMethod: payload.paymentMethod,
        parcelWeight: parcelWeight || null,
        parcelDescription: payload.parcelDescription,
        destinationCity: payload.destinationCity,
        destinationOutlet: payload.destinationOutlet,
        specialInstructions: payload.specialInstructions,
        status: apiResult.success ? 'CREATED' : 'FAILED_DELIVERY',
        integrationMode: mode,
        dispatchedBy: req.user?.name || null,
        dispatchedById: req.user?.id || null,
        dispatchMethod: 'POST_EX',
        notes: notes || null,
        errorMessage: apiResult.success ? null : apiResult.error
      }
    });

    // Create initial status log
    await prisma.postExStatusLog.create({
      data: {
        shipmentId: shipment.id,
        previousStatus: null,
        newStatus: shipment.status,
        postexRawPayload: apiResult.raw || null,
        changedBy: req.user?.name || 'system',
        notes: apiResult.simulated ? `Simulated (${mode} mode)` : 'Created via PostEx API'
      }
    });

    // If API call succeeded, also update the order's courierDetails and dispatchStatus
    if (apiResult.success) {
      const courierDetails = {
        courierName: 'PostEx',
        trackingNumber: apiResult.trackingNumber,
        shipmentNumber: apiResult.shipmentNumber,
        bookedAt: new Date().toISOString(),
        status: 'BOOKED',
        estimatedDelivery: apiResult.estimatedDelivery || null,
        postexMode: mode
      };

      await prisma.order.update({
        where: { id: orderId },
        data: {
          trackingNumber: apiResult.trackingNumber,
          courierDetails,
          deliveryType: 'POST_EX',
          deliveryMethod: 'PostEx',
          dispatchStatus: 'BOOKED'
        }
      });
    }

    // Emit socket
    const io = req.app?.get('io');
    if (io) io.emit('postex-shipment-updated', { orderId, shipmentId: shipment.id });

    res.status(201).json({
      message: apiResult.success
        ? `PostEx shipment ${apiResult.simulated ? 'prepared' : 'created'} successfully.`
        : `Shipment record created but PostEx API returned an error: ${apiResult.error}`,
      shipment,
      apiResult
    });
  } catch (err) {
    console.error('POSTEX_CREATE_SHIPMENT_ERROR', err.message, err.stack);
    res.status(500).json({ message: 'Failed to create PostEx shipment.' });
  }
};

const getShipments = async (req, res) => {
  try {
    const { orderId } = req.params;
    const shipments = await prisma.postExShipment.findMany({
      where: { orderId },
      include: { logs: { orderBy: { changedAt: 'desc' }, take: 20 } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ shipments });
  } catch (err) {
    console.error('POSTEX_GET_SHIPMENTS_ERROR', err.message);
    res.status(500).json({ message: 'Failed to fetch shipments.' });
  }
};

const getShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.postExShipment.findUnique({
      where: { id },
      include: { logs: { orderBy: { changedAt: 'desc' } } }
    });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
    res.json(shipment);
  } catch (err) {
    console.error('POSTEX_GET_SHIPMENT_ERROR', err.message);
    res.status(500).json({ message: 'Failed to fetch shipment.' });
  }
};

const cancelShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.postExShipment.findUnique({ where: { id } });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
    if (['DELIVERED', 'RETURNED', 'RETURN_RECEIVED', 'CANCELLED'].includes(shipment.status)) {
      return res.status(400).json({ message: `Shipment is already ${shipment.status}.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.postExShipment.update({
        where: { id },
        data: { status: 'CANCELLED', errorMessage: 'Cancelled by user' }
      });
      await tx.postExStatusLog.create({
        data: {
          shipmentId: id,
          previousStatus: shipment.status,
          newStatus: 'CANCELLED',
          changedBy: req.user?.name || 'system',
          notes: 'Cancelled by user'
        }
      });
      return s;
    });

    const io = req.app?.get('io');
    if (io) io.emit('postex-shipment-updated', { orderId: shipment.orderId, shipmentId: id });

    res.json({ message: 'Shipment cancelled.', shipment: updated });
  } catch (err) {
    console.error('POSTEX_CANCEL_SHIPMENT_ERROR', err.message);
    res.status(500).json({ message: 'Failed to cancel shipment.' });
  }
};

const trackShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await prisma.postExShipment.findUnique({ where: { id } });
    if (!shipment) return res.status(404).json({ message: 'Shipment not found.' });
    if (!shipment.trackingNumber) {
      return res.status(400).json({ message: 'No tracking number available.' });
    }

    const result = await postexService.trackPostExShipment(shipment.trackingNumber);
    res.json(result);
  } catch (err) {
    console.error('POSTEX_TRACK_SHIPMENT_ERROR', err.message);
    res.status(500).json({ message: 'Failed to track shipment.' });
  }
};

// ─── Webhook Handler ───────────────────────────────────────────────────────

const handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('POSTEX_WEBHOOK_RECEIVED', JSON.stringify(payload).slice(0, 500));

    if (!postexService.validateWebhookPayload(payload)) {
      return res.status(400).json({ message: 'Invalid webhook payload.' });
    }

    const trackingNumber = payload.trackingNumber || payload.tracking_number;
    const rawStatus = payload.status || payload.currentStatus || payload.Status;

    // Find shipment by tracking number
    const shipment = await prisma.postExShipment.findFirst({
      where: { trackingNumber }
    });
    if (!shipment) {
      console.log('POSTEX_WEBHOOK_SHIPMENT_NOT_FOUND', trackingNumber);
      return res.status(200).json({ message: 'Shipment not found. Ignored.' });
    }

    const newStatus = postexService.mapPostExStatus(rawStatus);
    const oldStatus = shipment.status;

    if (newStatus === oldStatus) {
      return res.status(200).json({ message: 'Status unchanged.' });
    }

    // Build timestamp updates
    const timestampUpdates = {};
    const now = new Date();
    if (newStatus === 'PICKED_UP') timestampUpdates.pickedUpAt = now;
    if (newStatus === 'IN_TRANSIT') timestampUpdates.inTransitAt = now;
    if (newStatus === 'OUT_FOR_DELIVERY') timestampUpdates.outForDeliveryAt = now;
    if (newStatus === 'DELIVERED') timestampUpdates.deliveredAt = now;
    if (newStatus === 'RETURNED') timestampUpdates.returnedAt = now;
    if (newStatus === 'RETURN_RECEIVED') timestampUpdates.returnReceivedAt = now;

    await prisma.$transaction(async (tx) => {
      // Update shipment status
      await tx.postExShipment.update({
        where: { id: shipment.id },
        data: { status: newStatus, ...timestampUpdates }
      });

      // Log status change
      await tx.postExStatusLog.create({
        data: {
          shipmentId: shipment.id,
          previousStatus: oldStatus,
          newStatus,
          postexRawStatus: rawStatus,
          postexRawPayload: payload,
          changedBy: 'system',
          notes: `Webhook: ${rawStatus}`
        }
      });

      // Update order delivery status
      const deliveryStatus = postexService.toDeliveryStatus(newStatus);
      const orderUpdate = { dispatchStatus: deliveryStatus };

      if (newStatus === 'DELIVERED') {
        orderUpdate.deliveredAt = now;
        orderUpdate.status = 'COMPLETED';
        // Find and complete the active OUT_FOR_DELIVERY stage
        const activeStage = await tx.orderStage.findFirst({
          where: { orderId: shipment.orderId, stageName: 'OUT_FOR_DELIVERY', status: { in: ['PENDING', 'IN_PROGRESS'] } }
        });
        if (activeStage) {
          await tx.orderStage.update({
            where: { id: activeStage.id },
            data: { status: 'COMPLETED', completedAt: now }
          });
        }
        orderUpdate.currentStage = 'DELIVERED';
      }

      if (newStatus === 'RETURNED' || newStatus === 'RETURN_IN_TRANSIT' || newStatus === 'RETURN_RECEIVED') {
        orderUpdate.returnedAt = orderUpdate.returnedAt || now;
        // Create a ReturnExchange case for the returned order
        const existingReturn = await tx.returnExchange.findFirst({
          where: {
            orderId: shipment.orderId,
            type: 'RETURN',
            status: { notIn: ['COMPLETED', 'CANCELLED'] }
          }
        });
        if (!existingReturn) {
          const order = await tx.order.findUnique({ where: { id: shipment.orderId } });
          if (order) {
            await tx.returnExchange.create({
              data: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                type: 'RETURN',
                status: 'PENDING',
                routedTo: 'STORE',
                returnReason: `PostEx return: ${rawStatus}`,
                originalProducts: order.productDetails,
                warehouseNotes: `Auto-created by PostEx webhook. Tracking: ${trackingNumber}`
              }
            });
          }
        }
      }

      await tx.order.update({ where: { id: shipment.orderId }, data: orderUpdate });
    });

    // Emit socket events
    const io = req.app?.get('io');
    if (io) {
      io.emit('postex-shipment-updated', { orderId: shipment.orderId, shipmentId: shipment.id });
      io.emit('order-updated', { orderId: shipment.orderId });
    }

    res.status(200).json({ message: 'Webhook processed.', newStatus, previousStatus: oldStatus });
  } catch (err) {
    console.error('POSTEX_WEBHOOK_ERROR', err.message, err.stack);
    res.status(200).json({ message: 'Webhook processing failed.' }); // Return 200 to prevent retries
  }
};

// ─── All Shipments (for admin/inventory view) ──────────────────────────────

const getAllShipments = async (req, res) => {
  try {
    const { status, dateFrom, dateTo, search, limit = 100 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lt = new Date(new Date(dateTo).setDate(new Date(dateTo).getDate() + 1));
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { shipmentNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const shipments = await prisma.postExShipment.findMany({
      where,
      include: { logs: { orderBy: { changedAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit) || 100, 500)
    });

    const stats = await prisma.postExShipment.groupBy({
      by: ['status'],
      _count: true
    });

    res.json({ shipments, stats });
  } catch (err) {
    console.error('POSTEX_GET_ALL_ERROR', err.message);
    res.status(500).json({ message: 'Failed to fetch shipments.' });
  }
};

// ─── Incoming Returns (for Inventory View) ─────────────────────────────────

const getIncomingReturns = async (req, res) => {
  try {
    const { status, search } = req.query;

    // All ReturnExchange cases that are incoming returns (from any source)
    const where = {
      type: 'RETURN',
      status: { notIn: ['COMPLETED', 'CANCELLED'] }
    };

    if (status) where.status = status;

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search } }
      ];
    }

    const cases = await prisma.returnExchange.findMany({
      where,
      include: {
        order: {
          select: {
            id: true, orderNumber: true, source: true, deliveryType: true,
            deliveryMethod: true, productDetails: true, totalPrice: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    // Enrich with PostEx shipment info where applicable
    const enriched = await Promise.all(cases.map(async (c) => {
      let postexShipment = null;
      if (c.order) {
        postexShipment = await prisma.postExShipment.findFirst({
          where: { orderId: c.orderId, status: { in: ['RETURNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED'] } },
          orderBy: { updatedAt: 'desc' }
        });
      }
      return { ...c, postexShipment };
    }));

    const stats = await prisma.returnExchange.groupBy({
      by: ['status'],
      where: { type: 'RETURN', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      _count: true
    });

    res.json({ cases: enriched, stats });
  } catch (err) {
    console.error('POSTEX_INCOMING_RETURNS_ERROR', err.message);
    res.status(500).json({ message: 'Failed to fetch incoming returns.' });
  }
};

module.exports = {
  getConfig,
  setConfig,
  createShipment,
  getShipments,
  getShipment,
  cancelShipment,
  trackShipment,
  handleWebhook,
  getAllShipments,
  getIncomingReturns
};
