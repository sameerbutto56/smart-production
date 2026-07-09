const prisma = require('../prisma');

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
    if (!name || !phone || !outletName) return res.status(400).json({ message: 'Name, phone, and outlet are required' });
    const clientNumber = await generateClientNumber();
    const client = await prisma.client.create({
      data: {
        clientNumber, name, gender, phone,
        additionalPhones: additionalPhones || [],
        permanentAddress: permanentAddress || null,
        deliveryAddresses: deliveryAddresses || [],
        city: city || null,
        measurementChart: measurementChart || null,
        sizeDetails: sizeDetails || null,
        standardSizes: standardSizes || null,
        outletName,
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
    const { outlet } = req.query;
    const where = { isActive: true };
    if (outlet) where.outletName = outlet;
    const clients = await prisma.client.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error: error.message });
  }
};

const searchClients = async (req, res) => {
  try {
    const { q, outlet } = req.query;
    if (!q) return res.json([]);
    const where = {
      isActive: true,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { clientNumber: { contains: q } }
      ]
    };
    if (outlet) where.outletName = outlet;
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
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error: error.message });
  }
};

const updateClient = async (req, res) => {
  try {
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
        ...(sizeDetails !== undefined && { sizeDetails }),
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

module.exports = { createClient, getClients, searchClients, getClientById, updateClient, deactivateClient };
