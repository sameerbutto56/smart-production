const prisma = require('../prisma');
const notify = require('../utils/notify');

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
  if (sourceModule === 'INVENTORY_VIEW') return 'IV-';
  if (outletName === 'Johar Town') return 'JT-';
  if (outletName === 'Jail Road') return 'JL-';
  if (outletName === 'Abbottabad') return 'AB-';
  return 'OT-';
};

const generateEngravingNumber = async (outletName, sourceModule) => {
  const prefix = getPrefix(outletName, sourceModule);
  const seq = await prisma.engravingSequence.upsert({
    where: { prefix },
    update: { nextValue: { increment: 1 } },
    create: { prefix, nextValue: 1 }
  });
  return `${prefix}${String(seq.nextValue).padStart(5, '0')}`;
};

const generateEngravingNumberEndpoint = async (req, res) => {
  try {
    const outletName = getOutletName(req);
    const sourceModule = req.query.source || 'OUTLET';
    const num = await generateEngravingNumber(outletName, sourceModule);
    res.json({ engravingNumber: num });
  } catch (error) {
    res.status(500).json({ message: 'Error generating engraving number', error: error.message });
  }
};

const createEngraving = async (req, res) => {
  try {
    const { engravingNumber, sourceModule, sourceOutlet, sourceOrderId, orderNumber,
            customerName, customerPhone, outletName, products } = req.body;

    if (!products || !products.length) {
      return res.status(400).json({ message: 'At least one product is required' });
    }

    const engraving = await prisma.engravingRequest.create({
      data: {
        engravingNumber,
        sourceModule: sourceModule || 'OUTLET',
        sourceOutlet: sourceOutlet || getOutletName(req),
        sourceOrderId: sourceOrderId || null,
        orderNumber: orderNumber || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        outletName: outletName || getOutletName(req),
        products,
        status: 'PENDING',
        currentStage: 'ENGRAVING_PENDING',
        stages: {
          create: {
            stageName: 'ENGRAVING_PENDING',
            status: 'PENDING',
            startedAt: new Date()
          }
        }
      },
      include: { stages: true }
    });

    const io = req.app.get('io');
    if (io) io.emit('engraving-created', { engraving });

    await notify.create(req, { type: 'engraving_task', moduleName: 'Outlet Engraving', path: '/engraving-queue', role: 'LOGO_DESIGN', title: 'New Engraving Request', message: `Engraving request for ${engraving.productName || 'order'}`, orderId: engraving.orderId, orderNumber: engraving.orderNumber, customerName: engraving.customerName, action: 'Engraving Created', employeeName: req.user?.name }).catch(() => {});

    res.status(201).json(engraving);
  } catch (error) {
    console.error('Create engraving error:', error);
    res.status(500).json({ message: 'Error creating engraving', error: error.message });
  }
};

const getEngravings = async (req, res) => {
  try {
    const { status, stage, outlet, source, search, limit = 50 } = req.query;
    const where = {};

    if (status) where.status = status;
    if (stage) where.currentStage = stage;
    if (outlet) where.outletName = outlet;
    if (source) where.sourceModule = source;
    if (search) {
      where.OR = [
        { engravingNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { orderNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const engravings = await prisma.engravingRequest.findMany({
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

    res.json(engravings);
  } catch (error) {
    console.error('Get engravings error:', error);
    res.status(500).json({ message: 'Error fetching engravings', error: error.message });
  }
};

const getEngravingById = async (req, res) => {
  try {
    const engraving = await prisma.engravingRequest.findUnique({
      where: { id: req.params.id },
      include: {
        stages: { orderBy: { createdAt: 'asc' } },
        acceptedBy: { select: { id: true, name: true, role: true } },
        completedBy: { select: { id: true, name: true, role: true } },
        doneBy: { select: { id: true, name: true, role: true } }
      }
    });
    if (!engraving) return res.status(404).json({ message: 'Engraving not found' });
    res.json(engraving);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching engraving', error: error.message });
  }
};

const getEngravingStats = async (req, res) => {
  try {
    const { outlet } = req.query;
    const where = {};
    if (outlet) where.outletName = outlet;

    const [total, pending, accepted, inProgress, completed] = await Promise.all([
      prisma.engravingRequest.count({ where }),
      prisma.engravingRequest.count({ where: { ...where, status: 'PENDING' } }),
      prisma.engravingRequest.count({ where: { ...where, status: 'ACCEPTED' } }),
      prisma.engravingRequest.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.engravingRequest.count({ where: { ...where, status: 'COMPLETED' } })
    ]);

    res.json({ total, pending, accepted, inProgress, completed });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats', error: error.message });
  }
};

const getLogoDeptEngravings = async (req, res) => {
  try {
    const engravings = await prisma.engravingRequest.findMany({
      where: {
        currentStage: 'ENGRAVING_PENDING',
        status: 'PENDING'
      },
      include: {
        stages: true,
        acceptedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(engravings);
  } catch (error) {
    console.error('Error fetching logo dept engravings:', error);
    res.status(500).json({ message: 'Error fetching logo dept engravings', error: error.message });
  }
};

const getLogoDeptCompleted = async (req, res) => {
  try {
    const engravings = await prisma.engravingRequest.findMany({
      where: {
        currentStage: 'ENGRAVING_IN',
        status: 'ACCEPTED'
      },
      include: {
        stages: true,
        acceptedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { acceptedAt: 'asc' }
    });
    res.json(engravings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching completed engravings', error: error.message });
  }
};

const acceptEngraving = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const engraving = await prisma.engravingRequest.findUnique({ where: { id }, include: { stages: true } });
    if (!engraving) return res.status(404).json({ message: 'Engraving not found' });
    if (engraving.status !== 'PENDING') {
      return res.status(400).json({ message: 'Engraving is not in pending status' });
    }

    const now = new Date();
    const currentStage = engraving.stages.find(s => s.status === 'PENDING');

    const updated = await prisma.engravingRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        currentStage: 'ENGRAVING_IN',
        acceptedById: userId,
        acceptedAt: now,
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'COMPLETED', completedAt: now }
          } : undefined,
          create: {
            stageName: 'ENGRAVING_IN',
            status: 'IN_PROGRESS',
            assignedEmployeeId: userId,
            startedAt: now
          }
        }
      },
      include: { stages: true, acceptedBy: { select: { id: true, name: true } } }
    });

    const io = req.app.get('io');
    if (io) io.emit('engraving-updated', { engraving: updated });

    res.json(updated);
  } catch (error) {
    console.error('Accept engraving error:', error);
    res.status(500).json({ message: 'Error accepting engraving', error: error.message });
  }
};

const completeEngraving = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const engraving = await prisma.engravingRequest.findUnique({ where: { id }, include: { stages: true } });
    if (!engraving) return res.status(404).json({ message: 'Engraving not found' });
    if (engraving.status !== 'ACCEPTED') {
      return res.status(400).json({ message: 'Engraving has not been accepted yet' });
    }

    const now = new Date();
    const currentStage = engraving.stages.find(s => s.status === 'IN_PROGRESS');

    const returnStage = engraving.sourceModule === 'INVENTORY_VIEW'
      ? 'ENGRAVING_IV_RETURN'
      : 'ENGRAVING_RETURN';

    const updated = await prisma.engravingRequest.update({
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
    if (io) io.emit('engraving-updated', { engraving: updated });

    const engravingReturnRole = returnStage === 'ENGRAVING_IV_RETURN' ? 'INVENTORY_VIEW' : 'OUTLET';
    await notify.create(req, { type: 'engraving_completed', moduleName: engravingReturnRole === 'INVENTORY_VIEW' ? 'Engraving' : 'Engraving', path: '/engraving-request', role: engravingReturnRole, title: 'Engraving Completed', message: `Engraving for ${engraving.productName || 'order'} is ready`, orderId: engraving.orderId, orderNumber: engraving.orderNumber, customerName: engraving.customerName, action: 'Engraving Returned', employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Complete engraving error:', error);
    res.status(500).json({ message: 'Error completing engraving', error: error.message });
  }
};

const markEngravingDone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const engraving = await prisma.engravingRequest.findUnique({ where: { id }, include: { stages: true } });
    if (!engraving) return res.status(404).json({ message: 'Engraving not found' });

    const validReturnStages = ['ENGRAVING_RETURN', 'ENGRAVING_IV_RETURN'];
    if (!validReturnStages.includes(engraving.currentStage)) {
      return res.status(400).json({ message: 'Engraving has not been returned yet' });
    }

    const now = new Date();
    const currentStage = engraving.stages.find(s => s.status === 'PENDING' && validReturnStages.includes(s.stageName));

    const updated = await prisma.engravingRequest.update({
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
    if (io) io.emit('engraving-updated', { engraving: updated });

    res.json(updated);
  } catch (error) {
    console.error('Mark done error:', error);
    res.status(500).json({ message: 'Error marking engraving done', error: error.message });
  }
};

const rejectEngraving = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const engraving = await prisma.engravingRequest.findUnique({ where: { id }, include: { stages: true } });
    if (!engraving) return res.status(404).json({ message: 'Engraving not found' });

    const now = new Date();
    const currentStage = engraving.stages.find(s => ['PENDING', 'IN_PROGRESS'].includes(s.status));

    const updated = await prisma.engravingRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        currentStage: 'REJECTED',
        stages: {
          update: currentStage ? {
            where: { id: currentStage.id },
            data: { status: 'REJECTED', completedAt: now, rejectionReason: reason || 'Rejected by Logo Department' }
          } : undefined
        }
      },
      include: { stages: true }
    });

    const io = req.app.get('io');
    if (io) io.emit('engraving-updated', { engraving: updated });

    await notify.create(req, { type: 'engraving_rejected', moduleName: 'Engraving', path: '/engraving-request', role: 'OUTLET', title: 'Engraving Rejected', message: `Engraving for ${engraving.productName || 'order'} was rejected`, orderId: engraving.orderId, orderNumber: engraving.orderNumber, customerName: engraving.customerName, action: 'Engraving Rejected', employeeName: req.user?.name }).catch(() => {});

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting engraving', error: error.message });
  }
};

const getOutletEngravingTasks = async (req, res) => {
  try {
    const userRole = (req.user?.role || '').toUpperCase();
    const outletName = getOutletName(req);

    if (userRole === 'INVENTORY_VIEW') {
      const engravings = await prisma.engravingRequest.findMany({
        where: { sourceModule: 'INVENTORY_VIEW', currentStage: 'ENGRAVING_IV_RETURN', status: 'COMPLETED' },
        include: {
          stages: true,
          completedBy: { select: { id: true, name: true } }
        },
        orderBy: { completedAt: 'desc' }
      });
      return res.json(engravings);
    }

    const engravings = await prisma.engravingRequest.findMany({
      where: {
        OR: [
          { outletName, currentStage: 'ENGRAVING_RETURN', status: 'COMPLETED' },
          { sourceModule: 'INVENTORY_VIEW', currentStage: 'ENGRAVING_IV_RETURN', status: 'COMPLETED' }
        ]
      },
      include: {
        stages: true,
        completedBy: { select: { id: true, name: true } }
      },
      orderBy: { completedAt: 'desc' }
    });
    res.json(engravings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching engraving tasks', error: error.message });
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
  generateEngravingNumberEndpoint,
  createEngraving,
  getEngravings,
  getEngravingById,
  getEngravingStats,
  getLogoDeptEngravings,
  getLogoDeptCompleted,
  acceptEngraving,
  completeEngraving,
  markEngravingDone,
  rejectEngraving,
  getOutletEngravingTasks,
  lookupOrderByNumber,
  generateEngravingNumber
};
