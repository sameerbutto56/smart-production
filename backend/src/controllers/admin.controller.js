const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

const clearAllData = async (req, res) => {
  const { password } = req.body;
  const adminId = req.user.id;

  try {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password. Action unauthorized.' });
    }
    await prisma.stockRequest.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.orderStage.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.inventoryItem.deleteMany({});
    res.json({ message: 'System wiped successfully. All orders and inventory have been cleared.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear data', error: error.message });
  }
};

const togglePause = async (req, res) => {
  const { password } = req.body;
  const adminId = req.user.id;
  try {
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid password.' });
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PAUSED' } });
    const currentPaused = existing ? existing.value === 'true' : false;
    const newPaused = !currentPaused;
    await prisma.systemSetting.upsert({
      where: { key: 'SYSTEM_PAUSED' },
      update: { value: String(newPaused) },
      create: { key: 'SYSTEM_PAUSED', value: String(newPaused) }
    });
    res.json({ paused: newPaused, message: newPaused ? 'System paused for holidays.' : 'System resumed.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle pause', error: error.message });
  }
};

const getPauseStatus = async (req, res) => {
  try {
    const existing = await prisma.systemSetting.findUnique({ where: { key: 'SYSTEM_PAUSED' } });
    res.json({ paused: existing ? existing.value === 'true' : false });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get pause status', error: error.message });
  }
};

const getDeadlineConfig = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'DEADLINE_CONFIG' } });
    const defaultConfig = {
      stageDurations: { STORE: 24, PRODUCTION: 48, LOGO_DESIGN: 24, DISPATCH: 12, OUT_FOR_DELIVERY: 12 },
      slaMultipliers: { NORMAL: 1, URGENT: 0.75, SUPER_URGENT: 0.5 }
    };
    const config = setting ? { ...defaultConfig, ...JSON.parse(setting.value) } : defaultConfig;
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get deadline config', error: error.message });
  }
};

const updateDeadlineConfig = async (req, res) => {
  try {
    const { stageDurations, slaMultipliers } = req.body;
    const config = {};
    if (stageDurations) config.stageDurations = stageDurations;
    if (slaMultipliers) config.slaMultipliers = slaMultipliers;
    await prisma.systemSetting.upsert({
      where: { key: 'DEADLINE_CONFIG' },
      update: { value: JSON.stringify(config) },
      create: { key: 'DEADLINE_CONFIG', value: JSON.stringify(config) }
    });
    res.json({ message: 'Deadline configuration saved.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update deadline config', error: error.message });
  }
};

const getTheme = async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'APP_THEME' } });
    res.json({ theme: setting ? setting.value : 'luxe' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get theme', error: error.message });
  }
};

const updateTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    const validThemes = ['clinical', 'couture', 'boutique', 'luxe'];
    if (!validThemes.includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme. Must be one of: ' + validThemes.join(', ') });
    }
    await prisma.systemSetting.upsert({
      where: { key: 'APP_THEME' },
      update: { value: theme },
      create: { key: 'APP_THEME', value: theme }
    });
    res.json({ message: 'Theme updated successfully.', theme });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update theme', error: error.message });
  }
};

const getPerformanceAnalytics = async (req, res) => {
  try {
    const stages = await prisma.orderStage.findMany({
      where: { completedAt: { not: null } },
      select: { stageName: true, startedAt: true, completedAt: true, createdAt: true }
    });

    // Calculate average completion time per stage
    const stageTimes = {};
    for (const s of stages) {
      if (!s.startedAt || !s.completedAt) continue;
      const durationMs = new Date(s.completedAt) - new Date(s.startedAt);
      const hours = durationMs / (1000 * 60 * 60);
      if (!stageTimes[s.stageName]) stageTimes[s.stageName] = [];
      stageTimes[s.stageName].push(hours);
    }

    const avgCompletionTime = {};
    const bottleneckStages = [];
    for (const [stage, times] of Object.entries(stageTimes)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      avgCompletionTime[stage] = Math.round(avg * 100) / 100;
      if (times.length >= 2 && avg > 48) {
        bottleneckStages.push({ stage, avgHours: Math.round(avg * 100) / 100, count: times.length });
      }
    }

    // Count delayed and on-time orders using deadline tracking
    const allStages = await prisma.orderStage.findMany({
      where: { status: 'COMPLETED', deadlineAt: { not: null } },
      select: { stageName: true, completedAt: true, deadlineAt: true }
    });
    let delayedCount = 0;
    let onTimeCount = 0;
    for (const s of allStages) {
      if (s.completedAt && s.deadlineAt && new Date(s.completedAt) > new Date(s.deadlineAt)) {
        delayedCount++;
      } else {
        onTimeCount++;
      }
    }

    // Count orders by priority
    const orderCounts = await prisma.order.groupBy({
      by: ['priority'],
      _count: { id: true }
    });
    const totalOrders = orderCounts.reduce((sum, o) => sum + o._count.id, 0);
    const urgentCounts = { NORMAL: 0, URGENT: 0, SUPER_URGENT: 0 };
    for (const o of orderCounts) {
      urgentCounts[o.priority] = o._count.id;
    }

    // Delayed orders count (current pending stages past deadline)
    const overdueStages = await prisma.orderStage.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, deadlineAt: { lt: new Date() } },
      include: { order: { select: { orderNumber: true, customerName: true, priority: true } } }
    });

    res.json({
      avgCompletionTime,
      bottleneckStages: bottleneckStages.sort((a, b) => b.avgHours - a.avgHours),
      delayedCount,
      onTimeCount,
      slaLate: totalOrders > 0 ? Math.round((delayedCount / (delayedCount + onTimeCount)) * 100) : 0,
      slaOnTime: totalOrders > 0 ? Math.round((onTimeCount / (delayedCount + onTimeCount)) * 100) : 100,
      totalOrders,
      urgentOrders: urgentCounts.URGENT,
      superUrgentOrders: urgentCounts.SUPER_URGENT,
      normalOrders: urgentCounts.NORMAL,
      overdueStages: overdueStages.slice(0, 20).map(s => ({
        orderNumber: s.order?.orderNumber || 'N/A',
        customerName: s.order?.customerName || 'N/A',
        priority: s.order?.priority || 'NORMAL',
        stageName: s.stageName,
        deadlineAt: s.deadlineAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get analytics', error: error.message });
  }
};

const changeUserPassword = async (req, res) => {
  try {
    const { userId, newPassword, adminPassword } = req.body;
    
    if (!userId || !newPassword || !adminPassword) {
      return res.status(400).json({ message: 'userId, newPassword, and adminPassword are required' });
    }

    // Verify admin's own password
    const admin = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!admin || !(await bcrypt.compare(adminPassword, admin.password))) {
      return res.status(401).json({ message: 'Admin password is incorrect' });
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: `Password updated for ${targetUser.name} (${targetUser.email})` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
};

module.exports = { clearAllData, togglePause, getPauseStatus, getDeadlineConfig, updateDeadlineConfig, getPerformanceAnalytics, getTheme, updateTheme, changeUserPassword };
