const prisma = require('../prisma');

async function create(req, { type, moduleName, path, role, title, message, orderId, orderNumber, customerName, action, employeeName }) {
  try {
    const roles = Array.isArray(role) ? role : [role];
    const results = [];

    for (const singleRole of roles) {
      if (!singleRole) continue;
      const notification = await prisma.notification.create({
        data: { type, moduleName, path, role: singleRole, title, message, orderId, orderNumber, customerName, action, employeeName }
      });

      const io = req.app?.get('io');
      const socketData = {
        id: notification.id,
        type: notification.type,
        moduleName: notification.moduleName,
        path: notification.path,
        role: notification.role,
        title: notification.title,
        message: notification.message,
        orderId: notification.orderId,
        orderNumber: notification.orderNumber,
        customerName: notification.customerName,
        action: notification.action,
        employeeName: notification.employeeName,
        isRead: false,
        createdAt: notification.createdAt
      };

      if (io && io.to) {
        io.to(`role:${singleRole}`).emit('notification:new', socketData);
      }

      results.push(notification);
    }

    return results.length === 1 ? results[0] : results;
  } catch (err) {
    console.error('notify.create error:', err.message);
    return null;
  }
}

async function createMany(req, notifications) {
  const results = [];
  for (const n of notifications) {
    const result = await create(req, n);
    results.push(result);
  }
  return results;
}

module.exports = { create, createMany };
