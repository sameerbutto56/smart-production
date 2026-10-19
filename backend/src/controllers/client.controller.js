const prisma = require('../prisma');
const { Prisma } = require('@prisma/client');
const { normalizePhone, formatPhoneDisplay, getPhoneSearchVariants, isValidPhone } = require('../utils/phoneUtils');

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
  try {
    const [row] = await prisma.$queryRaw`
      SELECT MAX(CAST("clientNumber" AS BIGINT)) as "maxNum"
      FROM "public"."Client"
      WHERE "clientNumber" ~ '^[0-9]+'
    `;
    let next = row?.maxNum ? Number(row.maxNum) + 1 : 1000;
    while (true) {
      const exists = await prisma.client.findFirst({
        where: { clientNumber: String(next) },
        select: { id: true }
      });
      if (!exists) return String(next);
      next++;
    }
  } catch (err) {
    console.error('generateClientNumber error:', err);
    while (true) {
      const rand = String(Math.floor(10000 + Math.random() * 90000));
      const exists = await prisma.client.findFirst({
        where: { clientNumber: rand },
        select: { id: true }
      });
      if (!exists) return rand;
    }
  }
};

const findDuplicatePhoneClient = async (submittedPhones, excludeId = null) => {
  if (!Array.isArray(submittedPhones) || submittedPhones.length === 0) return null;
  const terms = new Set();
  submittedPhones.forEach(p => {
    if (!p) return;
    const variants = getPhoneSearchVariants(p);
    variants.forEach(v => terms.add(v));
    const norm = normalizePhone(p);
    if (norm) terms.add(norm);
    const digits = String(p).replace(/\D/g, '');
    if (digits.length >= 7) terms.add(digits);
  });

  const termArr = Array.from(terms).filter(Boolean);
  if (termArr.length === 0) return null;

  const patterns = termArr.map(t => `%${t}%`);

  const rows = await prisma.$queryRaw`
    SELECT id, "clientNumber", name, phone, "outletName", "additionalPhones", "permanentAddress", city, gender, "standardSizes", "measurementChart", "sizeDetails"
    FROM "public"."Client"
    WHERE "isActive" = true
      ${excludeId ? Prisma.sql`AND id <> ${excludeId}` : Prisma.empty}
      AND (
        phone = ANY(${termArr}::text[])
        OR phone LIKE ANY(${patterns}::text[])
        OR "additionalPhones"::text ILIKE ANY(${patterns}::text[])
      )
    LIMIT 1
  `;

  return rows && rows.length > 0 ? rows[0] : null;
};

const createClient = async (req, res) => {
  try {
    const {
      name, gender, phone, additionalPhones,
      permanentAddress, deliveryAddresses, city,
      measurementChart, sizeDetails, standardSizes, outletName,
      force, allowSharedPhone
    } = req.body;

    const resolvedOutlet = outletName || getOutletName(req);
    if (!name || !phone || !resolvedOutlet) {
      return res.status(400).json({ message: 'Name, phone, and outlet are required' });
    }

    const cleanPrimaryPhone = String(phone).trim();
    const cleanAdditionalPhones = Array.isArray(additionalPhones)
      ? additionalPhones.map(p => String(p).trim()).filter(Boolean)
      : [];

    const cleanDeliveryAddresses = Array.isArray(deliveryAddresses)
      ? deliveryAddresses.map(a => typeof a === 'string' ? a.trim() : a).filter(Boolean)
      : [];

    // Duplicate phone check across primary and additional phone numbers
    if (!force && !allowSharedPhone) {
      const allPhones = [cleanPrimaryPhone, ...cleanAdditionalPhones];
      const dup = await findDuplicatePhoneClient(allPhones);
      if (dup) {
        return res.status(409).json({
          code: 'DUPLICATE_PHONE',
          message: `A customer with phone number ${dup.phone} is already registered: ${dup.name} (Client #${dup.clientNumber || 'N/A'}, ${dup.outletName || 'Outlet'}).`,
          existingClient: {
            id: dup.id,
            name: dup.name,
            phone: dup.phone,
            additionalPhones: dup.additionalPhones,
            clientNumber: dup.clientNumber,
            outletName: dup.outletName,
            permanentAddress: dup.permanentAddress,
            city: dup.city,
            gender: dup.gender,
            standardSizes: dup.standardSizes,
            measurementChart: dup.measurementChart,
            sizeDetails: dup.sizeDetails
          },
          matchedPhone: dup.phone
        });
      }
    }

    const clientNumber = await generateClientNumber();
    const client = await prisma.client.create({
      data: {
        clientNumber,
        name: name.trim(),
        gender: gender || 'Male',
        phone: cleanPrimaryPhone,
        additionalPhones: cleanAdditionalPhones,
        permanentAddress: permanentAddress ? permanentAddress.trim() : null,
        deliveryAddresses: cleanDeliveryAddresses,
        city: city ? city.trim() : null,
        measurementChart: measurementChart || null,
        sizeDetails: parseJsonField(sizeDetails),
        standardSizes: standardSizes || null,
        outletName: resolvedOutlet,
        createdById: req.user?.id || null
      }
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
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
    if (!q || !q.trim()) return res.json([]);
    const cleanQ = q.trim();

    const digitsOnly = cleanQ.replace(/\D/g, '');
    const hasDigits = digitsOnly.length >= 3;
    const phoneVariants = hasDigits ? getPhoneSearchVariants(cleanQ) : [];
    const phonePatterns = phoneVariants.length > 0 ? phoneVariants.map(v => `%${v}%`) : ['__NEVER_MATCH__'];
    if (hasDigits && digitsOnly.length >= 7) {
      phonePatterns.push(`%${digitsOnly}%`);
    }

    const generalPattern = `%${cleanQ}%`;
    const words = cleanQ.split(/\s+/).filter(w => w.length > 0);
    const wordPatterns = words.map(w => `%${w}%`);
    const hashNum = cleanQ.startsWith('#') ? cleanQ.slice(1).trim() : cleanQ;

    // Filter by outlet if specified and not ALL
    const outletFilter = (outlet && allOutlets !== 'true' && allOutlets !== true && outlet !== 'ALL') ? outlet : null;

    let rows;
    if (words.length > 1) {
      rows = await prisma.$queryRaw`
        SELECT id, "clientNumber", name, gender, phone, "additionalPhones", "permanentAddress", "deliveryAddresses", city, "measurementChart", "sizeDetails", "standardSizes", "outletName", "createdAt", "updatedAt"
        FROM "public"."Client"
        WHERE "isActive" = true
          ${outletFilter ? Prisma.sql`AND "outletName" = ${outletFilter}` : Prisma.empty}
          AND (
            "phone" ILIKE ANY(${phonePatterns}::text[])
            OR "additionalPhones"::text ILIKE ANY(${phonePatterns}::text[])
            OR "name" ILIKE ${generalPattern}
            OR "name" ILIKE ALL(${wordPatterns}::text[])
            OR "permanentAddress" ILIKE ${generalPattern}
            OR "permanentAddress" ILIKE ALL(${wordPatterns}::text[])
            OR "city" ILIKE ${generalPattern}
            OR "deliveryAddresses"::text ILIKE ${generalPattern}
            OR "clientNumber" ILIKE ${generalPattern}
            OR "clientNumber" = ${cleanQ}
            OR "clientNumber" = ${hashNum}
          )
        ORDER BY "createdAt" DESC
        LIMIT 50
      `;
    } else {
      rows = await prisma.$queryRaw`
        SELECT id, "clientNumber", name, gender, phone, "additionalPhones", "permanentAddress", "deliveryAddresses", city, "measurementChart", "sizeDetails", "standardSizes", "outletName", "createdAt", "updatedAt"
        FROM "public"."Client"
        WHERE "isActive" = true
          ${outletFilter ? Prisma.sql`AND "outletName" = ${outletFilter}` : Prisma.empty}
          AND (
            "phone" ILIKE ANY(${phonePatterns}::text[])
            OR "additionalPhones"::text ILIKE ANY(${phonePatterns}::text[])
            OR "name" ILIKE ${generalPattern}
            OR "permanentAddress" ILIKE ${generalPattern}
            OR "city" ILIKE ${generalPattern}
            OR "deliveryAddresses"::text ILIKE ${generalPattern}
            OR "clientNumber" ILIKE ${generalPattern}
            OR "clientNumber" = ${cleanQ}
            OR "clientNumber" = ${hashNum}
          )
        ORDER BY "createdAt" DESC
        LIMIT 50
      `;
    }

    res.json(rows);
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ message: 'Error searching clients', error: error.message });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    // Fetch order history for this client across primary phone and all additional phones with variants
    const allPhones = [client.phone, ...(Array.isArray(client.additionalPhones) ? client.additionalPhones : [])]
      .filter(Boolean)
      .map(p => String(p).trim());

    let recentOrders = [];
    if (allPhones.length > 0) {
      const orConditions = [];
      const seenSearchTerms = new Set();

      allPhones.forEach(p => {
        const variants = getPhoneSearchVariants(p);
        variants.forEach(v => {
          if (!seenSearchTerms.has(v)) {
            seenSearchTerms.add(v);
            orConditions.push({ customerPhone: { contains: v } });
          }
        });
        const clean = p.replace(/\D/g, '');
        if (clean.length >= 7 && !seenSearchTerms.has(clean)) {
          seenSearchTerms.add(clean);
          orConditions.push({ customerPhone: { contains: clean } });
        }
      });

      if (orConditions.length > 0) {
        recentOrders = await prisma.order.findMany({
          where: { OR: orConditions },
          orderBy: { createdAt: 'desc' },
          take: 20,
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

    const {
      name, gender, phone, additionalPhones,
      permanentAddress, deliveryAddresses, city,
      measurementChart, sizeDetails, standardSizes,
      force, allowSharedPhone
    } = req.body;

    const cleanPrimaryPhone = phone !== undefined ? String(phone).trim() : existing.phone;
    const cleanAdditionalPhones = additionalPhones !== undefined
      ? (Array.isArray(additionalPhones) ? additionalPhones.map(p => String(p).trim()).filter(Boolean) : [])
      : (Array.isArray(existing.additionalPhones) ? existing.additionalPhones : []);

    const cleanDeliveryAddresses = deliveryAddresses !== undefined
      ? (Array.isArray(deliveryAddresses) ? deliveryAddresses.map(a => typeof a === 'string' ? a.trim() : a).filter(Boolean) : [])
      : (Array.isArray(existing.deliveryAddresses) ? existing.deliveryAddresses : []);

    // Duplicate phone check against other active clients
    if (!force && !allowSharedPhone && (phone !== undefined || additionalPhones !== undefined)) {
      const allPhones = [cleanPrimaryPhone, ...cleanAdditionalPhones];
      const dup = await findDuplicatePhoneClient(allPhones, req.params.id);
      if (dup) {
        return res.status(409).json({
          code: 'DUPLICATE_PHONE',
          message: `A customer with phone number ${dup.phone} is already registered: ${dup.name} (Client #${dup.clientNumber || 'N/A'}, ${dup.outletName || 'Outlet'}).`,
          existingClient: {
            id: dup.id,
            name: dup.name,
            phone: dup.phone,
            additionalPhones: dup.additionalPhones,
            clientNumber: dup.clientNumber,
            outletName: dup.outletName,
            permanentAddress: dup.permanentAddress,
            city: dup.city,
            gender: dup.gender,
            standardSizes: dup.standardSizes,
            measurementChart: dup.measurementChart,
            sizeDetails: dup.sizeDetails
          },
          matchedPhone: dup.phone
        });
      }
    }

    // Preserve valid existing values if the user leaves a field blank
    const updatedName = (name !== undefined && String(name).trim()) ? String(name).trim() : existing.name;
    const updatedGender = gender !== undefined && gender ? gender : existing.gender;
    const updatedAddress = (permanentAddress !== undefined && String(permanentAddress).trim()) ? String(permanentAddress).trim() : existing.permanentAddress;
    const updatedCity = (city !== undefined && String(city).trim()) ? String(city).trim() : existing.city;
    const updatedChart = measurementChart !== undefined && measurementChart ? measurementChart : existing.measurementChart;
    const parsedIncomingSizeDetails = sizeDetails !== undefined ? parseJsonField(sizeDetails) : undefined;
    const updatedSizeDetails = (parsedIncomingSizeDetails && Object.keys(parsedIncomingSizeDetails).length > 0)
      ? parsedIncomingSizeDetails
      : existing.sizeDetails;
    const updatedStandardSizes = (Array.isArray(standardSizes) && standardSizes.length > 0)
      ? standardSizes
      : existing.standardSizes;

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name: updatedName,
        gender: updatedGender,
        phone: cleanPrimaryPhone,
        additionalPhones: cleanAdditionalPhones,
        permanentAddress: updatedAddress || null,
        deliveryAddresses: cleanDeliveryAddresses,
        city: updatedCity || null,
        measurementChart: updatedChart || null,
        sizeDetails: updatedSizeDetails,
        standardSizes: updatedStandardSizes
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

