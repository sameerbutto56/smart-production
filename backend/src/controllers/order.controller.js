const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createOrder = async (req, res) => {
  const { orderNumber, customerName, type, urgent, logoDesign, logoName, customization, productDetails, sizeData, advancePaid, shopifyOrderId } = req.body;

  try {
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        type,
        urgent,
        logoDesign,
        logoName,
        customization: customization ? JSON.stringify(customization) : null,
        productDetails: productDetails ? JSON.stringify(productDetails) : null,
        sizeData: sizeData ? JSON.stringify(sizeData) : null,
        advancePaid,
        shopifyOrderId,
        currentStage: 'STORE',
        status: 'PENDING'
      }
    });

    // Inventory Update Logic
    if (productDetails) {
      const itemsToDecrement = [
        productDetails.productType,
        productDetails.fabricType,
        productDetails.color
      ].filter(Boolean);

      for (const itemName of itemsToDecrement) {
        await prisma.inventoryItem.updateMany({
          where: { name: itemName },
          data: { stock: { decrement: 1 } }
        });
      }
    }

    // Initialize first stage
    await prisma.orderStage.create({
      data: {
        orderId: order.id,
        stageName: 'STORE',
        status: 'PENDING',
        deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours from now
      }
    });

    const io = req.app.get('io');
    io.emit('new-order', order);

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        stages: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

const updateStage = async (req, res) => {
  const { orderId, stageId } = req.params;
  const { status, nextStage } = req.body;

  try {
    const currentStage = await prisma.orderStage.update({
      where: { id: stageId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        assignedEmployeeId: req.user.id
      }
    });

    let updatedOrder = await prisma.order.findUnique({ where: { id: orderId } });

    if (status === 'COMPLETED' && nextStage) {
      // Logic for next stage deadline
      let deadline = new Date();
      if (nextStage === 'CUTTING') deadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day
      else if (nextStage === 'STITCHING') deadline = new Date(Date.now() + 96 * 60 * 60 * 1000); // 4 days
      else deadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours default

      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: nextStage,
          status: 'PENDING',
          deadlineAt: deadline
        }
      });

      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: nextStage,
          status: 'PENDING' // Reset to PENDING if it was REJECTED
        }
      });
    } else if (status === 'COMPLETED' && !nextStage) {
      // Final completion
      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'OUT FOR DELIVERY'
        }
      });
    } else if (status === 'REJECTED') {
      // Send back to Order Entry with a new stage record
      await prisma.orderStage.create({
        data: {
          orderId,
          stageName: 'ORDER_ENTRY',
          status: 'PENDING',
          deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
        }
      });

      updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { 
          currentStage: 'ORDER_ENTRY',
          status: 'REJECTED'
        }
      });
    }

    const io = req.app.get('io');
    io.emit('order-updated', updatedOrder);

    res.json({ message: 'Stage updated successfully', order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error updating stage', error: error.message });
  }
};

module.exports = { createOrder, getOrders, updateStage };
