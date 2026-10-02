const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

/**
 * Format date and time in Pakistan Standard Time (PKT).
 */
const getPktDateString = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d); // YYYY-MM-DD
};

const getPktTimeString = (d = new Date()) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d); // e.g. '11:30 AM'
};

/**
 * Resolves the authenticated individual Marketing employee.
 * Uses x-marketing-employee-id header validated against active Marketing employees.
 */
const getEffectiveMarketingIdentity = async (req) => {
  const employeeIdHeader = req.headers['x-marketing-employee-id'];
  if (employeeIdHeader) {
    const emp = await prisma.outletEmployee.findUnique({
      where: { id: employeeIdHeader },
      select: { id: true, name: true, profiles: true, isActive: true }
    });
    if (emp && emp.isActive) {
      const profs = Array.isArray(emp.profiles) ? emp.profiles : [];
      if (profs.includes('MARKETING')) {
        return { employeeId: emp.id, employeeName: emp.name };
      }
    }
  }
  return { employeeId: req.user.id, employeeName: req.user.name || 'Marketing Employee' };
};

/**
 * Get all active employees assigned to the Marketing profile.
 */
const getMarketingEmployees = async (req, res) => {
  try {
    const employees = await prisma.outletEmployee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, outletName: true, profiles: true },
      orderBy: { name: 'asc' }
    });

    const filtered = employees.filter(e => {
      const profs = Array.isArray(e.profiles) ? e.profiles : [];
      return profs.includes('MARKETING');
    }).map(e => ({
      id: e.id,
      name: e.name,
      outletName: e.outletName
    }));

    // Deduplicate by name if assigned across multiple outlets
    const seenNames = new Set();
    const uniqueEmployees = [];
    for (const emp of filtered) {
      const key = emp.name.toLowerCase().trim();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        uniqueEmployees.push(emp);
      }
    }

    res.json({ success: true, employees: uniqueEmployees });
  } catch (error) {
    console.error('Error fetching marketing employees:', error);
    res.status(500).json({ message: 'Failed to fetch marketing employees', error: error.message });
  }
};

/**
 * Authenticate a selected marketing employee with their employee-level password.
 */
const loginMarketingEmployee = async (req, res) => {
  try {
    const { employeeId, password } = req.body || {};
    if (!employeeId || !password) {
      return res.status(400).json({ message: 'Employee and password are required' });
    }

    const emp = await prisma.outletEmployee.findUnique({
      where: { id: employeeId }
    });

    if (!emp || !emp.isActive) {
      return res.status(401).json({ message: 'Invalid employee password' });
    }

    const profs = Array.isArray(emp.profiles) ? emp.profiles : [];
    if (!profs.includes('MARKETING')) {
      return res.status(403).json({ message: 'Employee is not assigned to Marketing profile' });
    }

    const isValid = await bcrypt.compare(password.toString(), emp.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid employee password' });
    }

    res.json({
      success: true,
      employee: {
        id: emp.id,
        name: emp.name,
        outletName: emp.outletName
      },
      message: `Authenticated as ${emp.name}`
    });
  } catch (error) {
    console.error('Error authenticating marketing employee:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

/**
 * Record a new marketing activity / location visit.
 * Crucial rule: A new activity NEVER overwrites prior records.
 */
const createActivity = async (req, res) => {
  try {
    const {
      area,
      location,
      hospitalName,
      companyName,
      notes,
      latitude,
      longitude,
      status = 'COMPLETED',
      source = 'GPS',
    } = req.body;

    const cleanArea = (area || '').toString().trim();
    const cleanLocation = (location || '').toString().trim();

    if (!cleanArea && !cleanLocation) {
      return res.status(400).json({ message: 'Area or location name is required.' });
    }

    const now = new Date();
    const dateStr = getPktDateString(now);
    const timeStr = getPktTimeString(now);

    const parsedLat = latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null;
    const parsedLng = longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null;

    const identity = await getEffectiveMarketingIdentity(req);

    const activity = await prisma.marketingActivity.create({
      data: {
        userId: identity.employeeId,
        employeeName: identity.employeeName,
        date: dateStr,
        time: timeStr,
        timestamp: now,
        area: cleanArea || cleanLocation,
        location: cleanLocation || cleanArea,
        hospitalName: hospitalName ? hospitalName.toString().trim() : null,
        companyName: companyName ? companyName.toString().trim() : null,
        notes: notes ? notes.toString().trim() : null,
        latitude: isNaN(parsedLat) ? null : parsedLat,
        longitude: isNaN(parsedLng) ? null : parsedLng,
        status: status || 'COMPLETED',
        source: source === 'CONFIGURED' ? 'CONFIGURED' : 'GPS',
      }
    });

    // Notify connected admins
    if (req.app.get('io')) {
      req.app.get('io').emit('marketing:new-activity', {
        activity,
        employeeName: identity.employeeName,
      });
    }

    res.status(201).json({
      success: true,
      activity,
      message: 'Marketing visit recorded successfully.'
    });
  } catch (error) {
    console.error('Error recording marketing activity:', error);
    res.status(500).json({ message: 'Failed to record marketing activity', error: error.message });
  }
};

/**
 * Fetch marketing activities for the currently logged-in marketing user.
 */
const getMyActivities = async (req, res) => {
  try {
    const identity = await getEffectiveMarketingIdentity(req);
    const userId = identity.employeeId;
    const todayStr = getPktDateString(new Date());
    const { date, limit = 50 } = req.query;

    const targetDate = date || todayStr;

    // Fetch today's activities for summary calculations
    const todayActivities = await prisma.marketingActivity.findMany({
      where: { userId, date: todayStr },
      orderBy: { createdAt: 'desc' }
    });

    // Visited areas & institutions today
    const visitedAreasSet = new Set(todayActivities.map(a => a.area).filter(Boolean));
    const visitedHospitalsSet = new Set(todayActivities.map(a => a.hospitalName).filter(Boolean));
    const visitedCompaniesSet = new Set(todayActivities.map(a => a.companyName).filter(Boolean));

    // Latest overall activity
    const latestActivity = todayActivities.length > 0 ? todayActivities[0] : (
      await prisma.marketingActivity.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      })
    );

    // Filtered historical activities
    const where = { userId };
    if (date && date !== 'all') {
      where.date = date;
    }

    const history = await prisma.marketingActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit) || 50, 100)
    });

    res.json({
      summary: {
        todayDate: todayStr,
        todayCount: todayActivities.length,
        visitedAreasCount: visitedAreasSet.size,
        visitedAreas: Array.from(visitedAreasSet),
        visitedHospitalsCount: visitedHospitalsSet.size,
        visitedHospitals: Array.from(visitedHospitalsSet),
        visitedCompaniesCount: visitedCompaniesSet.size,
        visitedCompanies: Array.from(visitedCompaniesSet),
        latestLocation: latestActivity ? {
          area: latestActivity.area,
          location: latestActivity.location,
          hospitalName: latestActivity.hospitalName,
          companyName: latestActivity.companyName,
          time: latestActivity.time,
          date: latestActivity.date,
          latitude: latestActivity.latitude,
          longitude: latestActivity.longitude,
          status: latestActivity.status,
          source: latestActivity.source,
        } : null
      },
      todayActivities,
      history,
    });
  } catch (error) {
    console.error('Error fetching marketing activities:', error);
    res.status(500).json({ message: 'Failed to fetch marketing activities', error: error.message });
  }
};

/**
 * Admin view: Fetch all marketing activities across all employees with multi-dimensional filtering.
 */
const getAdminActivities = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      dateFrom,
      dateTo,
      area,
      hospital,
      company,
      location,
      status,
      limit = 100
    } = req.query;

    const where = {};
    if (employeeId && employeeId !== 'all') where.userId = employeeId;
    if (date && date !== 'all') where.date = date;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) where.date.lte = dateTo;
    }
    if (area && area !== 'all') where.area = { contains: area, mode: 'insensitive' };
    if (hospital && hospital !== 'all') where.hospitalName = { contains: hospital, mode: 'insensitive' };
    if (company && company !== 'all') where.companyName = { contains: company, mode: 'insensitive' };
    if (location && location !== 'all') where.location = { contains: location, mode: 'insensitive' };
    if (status && status !== 'all') where.status = status;

    const activities = await prisma.marketingActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit) || 100, 300),
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true }
        }
      }
    });

    // Get list of all marketing employees for dropdown
    const marketingEmployees = await prisma.user.findMany({
      where: { role: 'MARKETING' },
      select: { id: true, name: true, email: true, employeeId: true }
    });

    // Get latest active location for each marketing employee
    const latestPerEmployee = [];
    for (const emp of marketingEmployees) {
      const last = await prisma.marketingActivity.findFirst({
        where: { userId: emp.id },
        orderBy: { createdAt: 'desc' }
      });
      if (last) {
        latestPerEmployee.push({
          employee: emp,
          latestActivity: last
        });
      }
    }

    // Unique filter options for autocomplete/selectors
    const distinctAreas = await prisma.marketingActivity.findMany({
      select: { area: true },
      distinct: ['area']
    });
    const distinctHospitals = await prisma.marketingActivity.findMany({
      where: { hospitalName: { not: null } },
      select: { hospitalName: true },
      distinct: ['hospitalName']
    });
    const distinctCompanies = await prisma.marketingActivity.findMany({
      where: { companyName: { not: null } },
      select: { companyName: true },
      distinct: ['companyName']
    });

    res.json({
      activities,
      employees: marketingEmployees,
      activeEmployees: latestPerEmployee,
      filterOptions: {
        areas: distinctAreas.map(d => d.area).filter(Boolean),
        hospitals: distinctHospitals.map(d => d.hospitalName).filter(Boolean),
        companies: distinctCompanies.map(d => d.companyName).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error fetching admin marketing activities:', error);
    res.status(500).json({ message: 'Failed to fetch admin activities', error: error.message });
  }
};

/**
 * Configured operational locations management (Software Settings).
 */
const getConfiguredLocations = async (req, res) => {
  try {
    const locations = await prisma.marketingConfiguredLocation.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ locations });
  } catch (error) {
    console.error('Error fetching configured locations:', error);
    res.status(500).json({ message: 'Failed to fetch configured locations', error: error.message });
  }
};

const createConfiguredLocation = async (req, res) => {
  try {
    const { name, area, hospitalName, companyName, address, latitude, longitude, radius = 100 } = req.body;
    if (!name || !area || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: 'Name, area, latitude, and longitude are required.' });
    }

    const created = await prisma.marketingConfiguredLocation.create({
      data: {
        name: name.toString().trim(),
        area: area.toString().trim(),
        hospitalName: hospitalName ? hospitalName.toString().trim() : null,
        companyName: companyName ? companyName.toString().trim() : null,
        address: address ? address.toString().trim() : null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius) || 100,
        createdById: req.user?.id || null,
        createdByName: req.user?.name || null,
      }
    });

    res.status(201).json({ success: true, location: created });
  } catch (error) {
    console.error('Error creating configured location:', error);
    res.status(500).json({ message: 'Failed to create configured location', error: error.message });
  }
};

const updateConfiguredLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, area, hospitalName, companyName, address, latitude, longitude, radius, isActive } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.toString().trim();
    if (area !== undefined) data.area = area.toString().trim();
    if (hospitalName !== undefined) data.hospitalName = hospitalName ? hospitalName.toString().trim() : null;
    if (companyName !== undefined) data.companyName = companyName ? companyName.toString().trim() : null;
    if (address !== undefined) data.address = address ? address.toString().trim() : null;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (radius !== undefined) data.radius = parseFloat(radius);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.marketingConfiguredLocation.update({
      where: { id },
      data
    });

    res.json({ success: true, location: updated });
  } catch (error) {
    console.error('Error updating configured location:', error);
    res.status(500).json({ message: 'Failed to update configured location', error: error.message });
  }
};

const deleteConfiguredLocation = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.marketingConfiguredLocation.delete({ where: { id } });
    res.json({ success: true, message: 'Configured location deleted' });
  } catch (error) {
    console.error('Error deleting configured location:', error);
    res.status(500).json({ message: 'Failed to delete configured location', error: error.message });
  }
};

module.exports = {
  createActivity,
  getMyActivities,
  getAdminActivities,
  getConfiguredLocations,
  createConfiguredLocation,
  updateConfiguredLocation,
  deleteConfiguredLocation,
  getMarketingEmployees,
  loginMarketingEmployee,
};
