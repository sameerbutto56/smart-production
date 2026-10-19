const prisma = require('../prisma');

const getOutletName = (req) => {
  let name = req.user?.name || req.query.outlet || req.headers['x-outlet-name'] || '';
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return name;
};

const parseJsonField = (val) => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

const generateClientNumber = async () => {
  // Find the highest existing clientNumber, then increment
  const last = await prisma.client.findFirst({ where: { clientNumber: { not: null } }, orderBy: { clientNumber: 'desc' }, select: { clientNumber: true } });
  let next = last?.clientNumber ? parseInt(last.clientNumber, 10) + 1 : 1000;
  if (next > 99999) next = 1000; // wrap if exceeds 5 digits
  return String(next);
};

const createClient = async (req, res) => {
  try {
    const { name, gender, phone, additionalPhones, permanentAddress, deliveryAddresses, city, measurementChart, sizeDetails, standardSizes, outletName } = req.body;
    const resolvedOutlet = outletName || getOutletName(req);
    if (!name || !phone || !resolvedOutlet) return res.status(400).json({ message: 'Name, phone, and outlet are required' });
    const clientNumber = await generateClientNumber();
    const client = await prisma.client.create({
      data: {
        clientNumber, name, gender, phone,
        additionalPhones: additionalPhones || [],
        permanentAddress: permanentAddress || null,
        deliveryAddresses: deliveryAddresses || [],
        city: city || null,
        measurementChart: measurementChart || null,
        sizeDetails: parseJsonField(sizeDetails),
        standardSizes: standardSizes || null,
        outletName: resolvedOutlet,
        createdById: req.user?.id || null
      }
    });
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error creating client', error: error.message });
  }
};

const getClients = async (req, res) => {
  try {
    const { outlet, allOutlets } = req.query;
    const where = { isActive: true };
    if (outlet && allOutlets !== 'true' && allOutlets !== true && outlet !== 'ALL') {
      where.outletName = outlet;
    }
    const clients = await prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
  }
};

const searchClients = async (req, res) => {
  try {
    const { q, outlet, allOutlets } = req.query;
    if (!q) return res.json([]);
    const cleanQ = q.trim();
    const where = {
      isActive: true,
      OR: [
        { name: { contains: cleanQ, mode: 'insensitive' } },
        { phone: { contains: cleanQ } },
        { clientNumber: { contains: cleanQ } }
      ]
    };
    // Only restrict to outlet if explicitly provided and allOutlets is not true
    if (outlet && allOutlets !== 'true' && allOutlets !== true && outlet !== 'ALL') {
      where.outletName = outlet;
    }
    const clients = await prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Fetch order history for this client by phone or additionalPhones
    const phones = [client.phone, ...(Array.isArray(client.additionalPhones) ? client.additionalPhones : [])]
      .filter(Boolean)
      .map(p => String(p).trim());

    let recentOrders = [];
    if (phones.length > 0) {
      const orConditions = phones.flatMap(p => {
        const clean = p.replace(/\D/g, '');
        const conditions = [{ customerPhone: { contains: p } }];
        if (clean.length >= 7) {
          conditions.push({ customerPhone: { contains: clean } });
        }
        return conditions;
      });

      recentOrders = await prisma.order.findMany({
        where: { OR: orConditions },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          outletName: true,
          source: true,
          customerName: true,
          customerPhone: true,
          productDetails: true,
          totalPrice: true,
          advanceAmount: true,
          advancePaid: true,
          balanceAmount: true,
          currentStage: true,
          status: true,
          deliveryMethod: true,
          sizeData: true,
          customization: true,
          engravingRequired: true,
          engravingText: true,
          engravingInstructions: true,
          instructionNotes: true,
          measurementSpecialNote: true
        }
      });
    }

    res.json({ ...client, recentOrders });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error: error.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const existing = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Client not found' });

    // Branch ownership check: only registering outlet or Super Admin/Admin/CEO can edit
    const userRole = req.user?.role;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'CEO'].includes(userRole);
    if (!isAdmin) {
      const userOutlet = getOutletName(req);
      if (existing.outletName && userOutlet && existing.outletName.toLowerCase().trim() !== userOutlet.toLowerCase().trim()) {
        return res.status(403).json({
          message: `Only ${existing.outletName} staff or an administrator can edit this customer's registration profile.`
        });
      }
    }

    const { name, gender, phone, additionalPhones, permanentAddress, deliveryAddresses, city, measurementChart, sizeDetails, standardSizes } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(gender !== undefined && { gender }),
        ...(phone !== undefined && { phone }),
        ...(additionalPhones !== undefined && { additionalPhones }),
        ...(permanentAddress !== undefined && { permanentAddress }),
        ...(deliveryAddresses !== undefined && { deliveryAddresses }),
        ...(city !== undefined && { city }),
        ...(measurementChart !== undefined && { measurementChart }),
        ...(sizeDetails !== undefined && { sizeDetails: parseJsonField(sizeDetails) }),
        ...(standardSizes !== undefined && { standardSizes })
      }
    });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error updating client', error: error.message });
  }
};

const deactivateClient = async (req, res) => {
  try {
    await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Client deactivated' });
  } catch (error) {
    res.status(500).json({ message: 'Error deactivating client', error: error.message });
  }
};

module.exports = { createClient, getClients, searchClients, getClientById, updateClient, deactivateClient, getOutletName };

