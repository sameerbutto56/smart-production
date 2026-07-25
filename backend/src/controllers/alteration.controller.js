const prisma = require('../prisma');
const cache = require('../utils/cache');

const getOutletName = (req) => {
  let name = req.user?.name || req.query.outlet || '';
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return name;
};

const getPrefix = (outletName, sourceModule) => {
  if (sourceModule === 'CUSTOMER_QUERY') return 'CQ-';
  if (outletName === 'Johar Town') return 'JT-';
  if (outletName === 'Jail Road') return 'JL-';
  if (outletName === 'Abbottabad') return 'AB-';
  return 'OT-';
};

const generateAlterationNumber = async (outletName, sourceModule) => {
  const prefix = getPrefix(outletName, sourceModule);
  const seq = await prisma.alterationSequence.upsert({
    where: { prefix },
    update: { nextValue: { increment: 1 } },
    create: { prefix, nextValue: 1 }
  });
  return `${prefix}${String(seq.nextValue).padStart(5, '0')}`;
};

const generateAlterationNumberEndpoint = async (req, res) => {
  try {
    const outletName = getOutletName(req);
    const sourceModule = req.query.source || 'OUTLET';
    const num = await generateAlterationNumber(outletName, sourceModule);
    res.json({ alterationNumber: num });
  } catch (error) {
    res.status(500).json({ message: 'Error generating alteration number', error: error.message });
  }
};

const createAlteration = async (req, res) => {
  try {
    const { alterationNumber, sourceModule, sourceOutlet, sourceOrderId, orderNumber,
            customerName, customerPhone, outletName, products } = req.body;

    if (!products || !products.length) {
      return res.status(400).json({ message: 'At least one product is required' });
    }

    const alteration = await prisma.alteration.create({
      data: {
        alterationNumber,
        sourceModule: sourceModule || 'OUTLET',
        sourceOutlet: sourceOutlet || getOutletName(req),
        sourceOrderId: sourceOrderId || null,
        orderNumber: orderNumber || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        outletName: outletName || getOutletName(req),
        products,
        status: 'PENDING',
        currentStage: 'ALTERATION_PENDING',
        stages: {
          create: {
            stageName: 'ALTERATION_PENDING',
            status: 'PENDING',
            startedAt: new Date()
          }
        }
      },
      include: { stages: true }
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('alteration-created', { alteration });
    }

    res.status(201).json(alteration);
  } catch (error) {
    console.error('Create alteration error:', error);
    res.status(500).json({ message: 'Error creating alteration', error: error.message });
  }
};

const getAlterations = async (req, res) => {
  try {
    const { status, stage, outlet, source, search, limit = 50 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (stage) where.currentStage = stage;
    if (outlet) where.outletName = outlet;
    if (source) where.sourceModule = source;
    if (search) {
      where.OR = [
        { alterationNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const alterations = await prisma.alteration.findMany({
      where,
      include: {
        stages: true,
        acceptedBy: { select: { id: true, name: true, role: true } },
        completedBy: { select: { id: true, name: true, role: true } },
        doneBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json(alterations);
  } catch (error) {
    console.error('Get alterations error:', error);
    res.status(500).json({ message: 'Error fetching alterations', error: error.message });
  }
};

const getAlterationById = async (req, res) => {
  try {
    const alteration = await prisma.alteration.findUnique({
      where: { id: req.params.id },
      include: {
        stages: { orderBy: { createdAt: 'asc' } },
        acceptedBy: { select: { id: true, name: true, role: true } },
        completedBy: { select: { id: true, name: true, role: true } },
        doneBy: { select: { id: true, name: true, role: true } }
      }
    });
    if (!alteration) return res.status(404).json({ message: 'Alteration not found' });
    res.json(alteration);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alteration', error: error.message });
  }
};

const getAlterationStats = async (req, res) => {
  try {
    const { outlet } = req.query;
    const where = {};
    if (outlet) where.outletName = outlet;

    const [total, pending, accepted, inProgress, completed, rejected] = await Promise.all([
      prisma.alteration.count({ where }),
      prisma.alteration.count({ where: { ...where, status: 'PENDING' } }),
      prisma.alteration.count({ where: { ...where, status: 'ACCEPTED' } }),
      prisma.alteration.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.alteration.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.alteration.count({ where: { ...where, status: 'REJECTED' } })
    ]);

    const completedAlterations = await prisma.alteration.findMany({
      where: { ...where, status: 'COMPLETED', acceptedAt: { not: null }, completedAt: { not: null } },
      select: { acceptedAt: true, completedAt: true }
    });

    let avgProcessingTime = 0;
    if (completedAlterations.length > 0) {
      const totalMs = completedAlterations.reduce((sum, a) =>
        sum + (new Date(a.completedAt) - new Date(a.acceptedAt)), 0);
      avgProcessingTime = Math.round(totalMs / completedAlterations.length / (1000 * 60 * 60));
    }

    res.json({ total, pending, accepted, inProgress, completed, rejected, avgProcessingTime });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

const getProductionAlterations = async (req, res) => {
  try {
    const alterations = await prisma.alteration.findMany({
      where: {
        currentStage: { in: ['ALTERATION_PENDING', 'ALTERATION_IN'] },
        status: { in: ['PENDING', 'ACCEPTED'] }
      },
      include: {
        stages: true,
        acceptedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(alterations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production alterations', error: error.message });
  }
};

const getProductionOutAlterations = async (req, res) => {
  try {
    const alterations = await prisma.alteration.findMany({
      where: {
        currentStage: 'ALTERATION_IN',
        status: 'ACCEPTED'
      },
      include: {
        stages: true,
        acceptedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { acceptedAt: 'asc' }
    });
    res.json(alterations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching production out alterations', error: error.message });
  }
};

const acceptAlteration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alteration = await prisma.alteration.findUnique({ where: { id }, include: { stages: true } });
    if (!alteration) return res.status(404).json({ message: 'Alteration not found' });
    if (alteration.status !== 'PENDING') {
      return res.status(400).json({ message: 'Alteration is not in pending status' });
    }

    const now = new Date();
    const currentStage = alteration.stages.find(s => s.status === 'PENDING');

    const updated = await prisma.alteration.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        currentStage: 'ALTERATION_IN',
        acceptedById: userId,
        acceptedAt: now,
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: now }
          } : undefined,
          create: {
            stageName: 'ALTERATION_IN',
            status: 'IN_PROGRESS',
            assignedEmployeeId: userId,
            startedAt: now
          }
        }
      },
      include: { stages: true, acceptedBy: { select: { id: true, name: true } } }
    });

    const io = req.app.get('io');
    if (io) io.emit('alteration-updated', { alteration: updated });

    res.json(updated);
  } catch (error) {
    console.error('Accept alteration error:', error);
    res.status(500).json({ message: 'Error accepting alteration', error: error.message });
  }
};

const completeAlteration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alteration = await prisma.alteration.findUnique({ where: { id }, include: { stages: true } });
    if (!alteration) return res.status(404).json({ message: 'Alteration not found' });
    if (alteration.status !== 'ACCEPTED') {
      return res.status(400).json({ message: 'Alteration has not been accepted yet' });
    }

    const now = new Date();
    const currentStage = alteration.stages.find(s => s.status === 'IN_PROGRESS');

    const returnStage = alteration.sourceModule === 'CUSTOMER_QUERY'
      ? 'ALTERATION_CQ_RETURN'
      : 'ALTERATION_RETURN';

    const updated = await prisma.alteration.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        currentStage: returnStage,
        completedById: userId,
        completedAt: now,
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: now }
          } : undefined,
          create: {
            stageName: returnStage,
            status: 'PENDING',
            startedAt: now
          }
        }
      },
      include: { stages: true, completedBy: { select: { id: true, name: true } } }
    });

    const io = req.app.get('io');
    if (io) io.emit('alteration-updated', { alteration: updated });

    res.json(updated);
  } catch (error) {
    console.error('Complete alteration error:', error);
    res.status(500).json({ message: 'Error completing alteration', error: error.message });
  }
};

const markAlterationDone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const alteration = await prisma.alteration.findUnique({ where: { id }, include: { stages: true } });
    if (!alteration) return res.status(404).json({ message: 'Alteration not found' });

    const validReturnStages = ['ALTERATION_RETURN', 'ALTERATION_CQ_RETURN'];
    if (!validReturnStages.includes(alteration.currentStage)) {
      return res.status(400).json({ message: 'Alteration has not been returned yet' });
    }

    const now = new Date();
    const currentStage = alteration.stages.find(s => s.status === 'PENDING' && validReturnStages.includes(s.stageName));

    const updated = await prisma.alteration.update({
      where: { id },
      data: {
        status: 'DONE',
        currentStage: 'DONE',
        doneById: userId,
        doneAt: now,
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: now }
          } : undefined
        }
      },
      include: {
        stages: true,
        doneBy: { select: { id: true, name: true } }
      }
    });

    const io = req.app.get('io');
    if (io) io.emit('alteration-updated', { alteration: updated });

    res.json(updated);
  } catch (error) {
    console.error('Mark done error:', error);
    res.status(500).json({ message: 'Error marking alteration done', error: error.message });
  }
};

const rejectAlteration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const alteration = await prisma.alteration.findUnique({ where: { id }, include: { stages: true } });
    if (!alteration) return res.status(404).json({ message: 'Alteration not found' });

    const now = new Date();
    const currentStage = alteration.stages.find(s => ['PENDING', 'IN_PROGRESS'].includes(s.status));

    const updated = await prisma.alteration.update({
      where: { id },
      data: {
        status: 'REJECTED',
        currentStage: 'REJECTED',
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'REJECTED', completedAt: now, rejectionReason: reason || 'Rejected by production' }
          } : undefined
        }
      },
      include: { stages: true }
    });

    const io = req.app.get('io');
    if (io) io.emit('alteration-updated', { alteration: updated });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting alteration', error: error.message });
  }
};

const getOutletAlterationTasks = async (req, res) => {
  try {
    const outletName = getOutletName(req);
    const alterations = await prisma.alteration.findMany({
      where: {
        OR: [
          { outletName, currentStage: 'ALTERATION_RETURN', status: 'COMPLETED' },
          { sourceModule: 'CUSTOMER_QUERY', currentStage: 'ALTERATION_CQ_RETURN', status: 'COMPLETED' }
        ]
      },
      include: {
        stages: true,
        completedBy: { select: { id: true, name: true } }
      },
      orderBy: { completedAt: 'desc' }
    });
    res.json(alterations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching alteration tasks', error: error.message });
  }
};

const lookupOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.query;
    if (!orderNumber) return res.status(400).json({ message: 'Order number is required' });

    const order = await prisma.order.findFirst({
      where: { orderNumber },
      select: {
        id: true, orderNumber: true, customerName: true, customerPhone: true,
        productDetails: true, sizeData: true, outletName: true, source: true
      }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error looking up order', error: error.message });
  }
};

module.exports = {
  generateAlterationNumberEndpoint,
  createAlteration,
  getAlterations,
  getAlterationById,
  getAlterationStats,
  getProductionAlterations,
  getProductionOutAlterations,
  acceptAlteration,
  completeAlteration,
  markAlterationDone,
  rejectAlteration,
  getOutletAlterationTasks,
  lookupOrderByNumber,
  generateAlterationNumber
};
