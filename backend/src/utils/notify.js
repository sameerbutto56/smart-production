const prisma = require('../prisma');

async function create(req, { type, moduleName, path, role, title, message, orderId, orderNumber, customerName, action, employeeName }) {
  try {
    const roles = Array.isArray(role) ? role : [role];
    const results = [];

    // Notification.orderId is Int? but Order.id is a UUID string — writing the
    // UUID into the Int column throws and every caller swallows it with
    // .catch(() => {}), so delivery/other notifications were never created.
    // Persist orderId only when it is a finite integer; otherwise omit it.
    let dbOrderId = null;
    if (typeof orderId === 'number' && Number.isFinite(orderId)) dbOrderId = orderId;
    else if (typeof orderId === 'string' && /^\d+$/.test(orderId)) dbOrderId = parseInt(orderId, 10);

    for (const singleRole of roles) {
      if (!singleRole) continue;
      const data = { type, moduleName, path, role: singleRole, title, message, orderNumber, customerName, action, employeeName };
      if (dbOrderId != null) data.orderId = dbOrderId;
      const notification = await prisma.notification.create({ data });

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
