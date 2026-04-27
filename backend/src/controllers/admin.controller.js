const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const clearAllData = async (req, res) => {
  const { password } = req.body;
  const adminId = req.user.id;

  try {
    // 1. Verify admin password
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password. Action unauthorized.' });
    }

    // 2. Perform deletion in order to respect constraints
    // AuditLogs and OrderStages depend on Order
    await prisma.auditLog.deleteMany({});
    await prisma.orderStage.deleteMany({});
    await prisma.order.deleteMany({});
    
    // Clear inventory
    await prisma.inventoryItem.deleteMany({});

    console.log(`⚠️ DATA WIPE: All production data cleared by Admin: ${admin.email}`);

    res.json({ message: 'System wiped successfully. All orders and inventory have been cleared.' });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ message: 'Failed to clear data', error: error.message });
  }
};

module.exports = { clearAllData };
