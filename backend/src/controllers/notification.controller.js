const prisma = require('../prisma');

exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const role = req.user?.role;
    if (!role) return res.status(400).json({ message: 'Role required' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { role },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.notification.count({ where: { role } })
    ]);

    res.json({ notifications, total, page: parseInt(page), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!role) return res.status(400).json({ message: 'Role required' });

    const unread = await prisma.notification.groupBy({
      by: ['moduleName', 'path'],
      where: { role, isRead: false },
      _count: { id: true }
    });

    const counts = {};
    unread.forEach(g => {
      counts[g.path] = g._count.id;
    });

    res.json({ counts });
  } catch (error) {
    console.error('getUnreadCounts error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.markModuleRead = async (req, res) => {
  try {
    const { path, moduleName } = req.body;
    const role = req.user?.role;
    if (!role) return res.status(400).json({ message: 'Role required' });

    const where = { role, isRead: false };
    if (path) where.path = path;
    if (moduleName) where.moduleName = moduleName;

    await prisma.notification.updateMany({
      where,
      data: { isRead: true }
    });

    const unread = await prisma.notification.groupBy({
      by: ['moduleName', 'path'],
      where: { role, isRead: false },
      _count: { id: true }
    });

    const counts = {};
    unread.forEach(g => { counts[g.path] = g._count.id; });

    const io = req.app?.get('io');
    if (io) {
      io.to(`role:${role}`).emit('notification:read', { path, role, counts });
      io.emit('notification:read', { path, role, counts });
    }

    res.json({ success: true, counts });
  } catch (error) {
    console.error('markModuleRead error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.markOneRead = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('markOneRead error:', error);
    res.status(500).json({ message: error.message });
  }
};
