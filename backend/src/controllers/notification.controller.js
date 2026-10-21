const prisma = require('../prisma');
const cache = require('../utils/cache');

exports.getNotifications = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const { page = 1, limit = 50, unread } = req.query;
    const role = req.user?.role;
    if (!role) return res.status(400).json({ message: 'Role required' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = { role };
    if (unread === 'true') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.notification.count({ where })
    ]);

    res.json({ notifications, total, page: parseInt(page), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getUnreadCounts = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const role = req.user?.role;
    if (!role) return res.status(400).json({ message: 'Role required' });

    // In-memory cache for 8 seconds per role to coalesce concurrent polling from multiple open tabs
    const cacheKey = `notif:unread:${role}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ counts: cached });
    }

    const unread = await prisma.notification.groupBy({
      by: ['moduleName', 'path'],
      where: { role, isRead: false },
      _count: { id: true }
    });

    const counts = {};
    unread.forEach(g => {
      counts[g.path] = g._count.id;
    });

    cache.set(cacheKey, counts, 8000);
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

    cache.invalidatePattern('notif:unread:');

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
    cache.set(`notif:unread:${role}`, counts, 8000);

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
    cache.invalidatePattern('notif:unread:');
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
