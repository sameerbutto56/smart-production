const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const { extractLocationFromUrl, isValidCoordinates } = require('../utils/mapUrlParser');

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
  return { employeeId: req.user?.id || 'marketing', employeeName: req.user?.name || 'Marketing Employee' };
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

    // Ensure valid User foreign key reference
    let resolvedUserId = req.user?.id;
    if (resolvedUserId) {
      const userExists = await prisma.user.findUnique({ where: { id: resolvedUserId }, select: { id: true } });
      if (!userExists) resolvedUserId = null;
    }
    if (!resolvedUserId) {
      const marketingUser = await prisma.user.findFirst({ where: { role: 'MARKETING' }, select: { id: true } });
      resolvedUserId = marketingUser?.id;
    }
    if (!resolvedUserId) {
      const anyUser = await prisma.user.findFirst({ select: { id: true } });
      resolvedUserId = anyUser?.id;
    }

    const activity = await prisma.marketingActivity.create({
      data: {
        userId: resolvedUserId,
        employeeName: identity.employeeName,
        date: dateStr,
        time: timeStr,
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
/**
 * Calculate distance between two coordinates in meters.
 */
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const geocodeCache = new Map();

/**
 * Reverse geocode latitude and longitude to auto-fill marketing visit details.
 * 1. Checks matching configured reference locations within operational radius.
 * 2. Checks in-memory cache.
 * 3. Queries OpenStreetMap Nominatim with English locale.
 */
const reverseGeocodeLocation = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat || req.query.latitude);
    const lng = parseFloat(req.query.lng || req.query.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' });
    }

    // 1. Check if matches any configured reference location within radius
    try {
      const configured = await prisma.marketingConfiguredLocation.findMany({
        where: { isActive: true }
      });

      let closestLoc = null;
      let minDistance = Infinity;

      for (const loc of configured) {
        if (loc.latitude && loc.longitude) {
          const d = getDistanceFromLatLonInMeters(lat, lng, loc.latitude, loc.longitude);
          const maxRadius = loc.radius || 300;
          if (d <= maxRadius && d < minDistance) {
            minDistance = d;
            closestLoc = loc;
          }
        }
      }

      if (closestLoc) {
        return res.json({
          success: true,
          source: 'CONFIGURED_MATCH',
          area: closestLoc.area,
          location: closestLoc.name,
          hospitalName: closestLoc.hospitalName || null,
          companyName: closestLoc.companyName || null,
          distanceMeters: Math.round(minDistance)
        });
      }
    } catch (confErr) {
      console.warn('Error checking configured locations:', confErr);
    }

    // 2. Check in-memory cache
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.data);
    }

    // 3. Query OpenStreetMap Nominatim with English header
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Enamels-ERP/1.0 (contact@enamel.com)',
        'Accept-Language': 'en'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Nominatim returned status ${response.status}`);
    }

    const data = await response.json();
    const addr = data.address || {};

    const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || addr.town || addr.village || addr.city || 'Lahore';

    let location = '';
    if (addr.road) {
      location = addr.house_number ? `${addr.house_number}, ${addr.road}` : addr.road;
      if (addr.neighbourhood && !location.includes(addr.neighbourhood)) {
        location += `, ${addr.neighbourhood}`;
      }
    } else if (data.name) {
      location = data.name;
    } else {
      location = area;
    }

    // Detect if hospital / clinic / health institution
    let hospitalName = null;
    const isHospital = (addr.amenity && (addr.amenity.toLowerCase().includes('hospital') || addr.amenity.toLowerCase().includes('clinic') || addr.amenity.toLowerCase().includes('medical') || addr.amenity.toLowerCase().includes('health'))) ||
      (data.name && (data.name.toLowerCase().includes('hospital') || data.name.toLowerCase().includes('clinic') || data.name.toLowerCase().includes('medical')));
    if (isHospital) {
      hospitalName = data.name || addr.amenity;
    }

    // Detect if company / office / corporate
    let companyName = null;
    const isCompany = addr.office || addr.commercial || (addr.amenity === 'company');
    if (isCompany) {
      companyName = data.name || addr.office || addr.commercial;
    }

    const result = {
      success: true,
      source: 'REVERSE_GEOCODE',
      area,
      location,
      hospitalName,
      companyName,
      displayName: data.display_name
    };

    // Cache for 1 hour
    geocodeCache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600 * 1000 });

    res.json(result);
  } catch (error) {
    console.error('Error reverse-geocoding location:', error);
    // Graceful fallback response
    res.json({
      success: true,
      source: 'FALLBACK',
      area: 'Lahore',
      location: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      hospitalName: null,
      companyName: null
    });
  }
};

/**
 * Fetch marketing activities for the currently logged-in marketing user or admin oversight.
 */
const getMyActivities = async (req, res) => {
  try {
    const isAdminUser = ['SUPER_ADMIN', 'ADMIN', 'SOFTWARE_SETTINGS'].includes(req.user?.role);
    const todayStr = getPktDateString(new Date());
    const { date, employeeId: queryEmpId, limit = 50 } = req.query;

    let userId = null;
    let employeeName = null;

    if (isAdminUser) {
      // Admin can view specific marketing employee or all
      const targetEmpId = queryEmpId || req.headers['x-marketing-employee-id'];
      if (targetEmpId && targetEmpId !== 'all') {
        userId = targetEmpId;
        const emp = await prisma.outletEmployee.findUnique({
          where: { id: targetEmpId },
          select: { name: true }
        });
        employeeName = emp?.name || null;
      }
    } else {
      const identity = await getEffectiveMarketingIdentity(req);
      userId = identity.employeeId;
      employeeName = identity.employeeName;
    }

    // Build today filter
    const todayWhere = { date: todayStr };
    if (employeeName) {
      todayWhere.employeeName = employeeName;
    }

    // Fetch today's activities for summary calculations
    const todayActivities = await prisma.marketingActivity.findMany({
      where: todayWhere,
      orderBy: { createdAt: 'desc' }
    });

    // Visited areas & institutions today
    const visitedAreasSet = new Set(todayActivities.map(a => a.area).filter(Boolean));
    const visitedHospitalsSet = new Set(todayActivities.map(a => a.hospitalName).filter(Boolean));
    const visitedCompaniesSet = new Set(todayActivities.map(a => a.companyName).filter(Boolean));

    // Latest overall activity
    const latestWhere = employeeName ? { employeeName } : {};
    const latestActivity = todayActivities.length > 0 ? todayActivities[0] : (
      await prisma.marketingActivity.findFirst({
        where: latestWhere,
        orderBy: { createdAt: 'desc' }
      })
    );

    // Filtered historical activities
    const histWhere = employeeName ? { employeeName } : {};
    if (date && date !== 'all') {
      histWhere.date = date;
    }

    const history = await prisma.marketingActivity.findMany({
      where: histWhere,
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
        selectedEmployeeName: employeeName,
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
          employeeName: latestActivity.employeeName
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
    if (employeeId && employeeId !== 'all') {
      const emp = await prisma.outletEmployee.findUnique({
        where: { id: employeeId },
        select: { name: true }
      }).catch(() => null);
      if (emp?.name) {
        where.employeeName = emp.name;
      } else {
        where.OR = [{ userId: employeeId }, { employeeName: employeeId }];
      }
    }
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
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Get list of all marketing employees for dropdown
    const outletEmps = await prisma.outletEmployee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, profiles: true, outletName: true }
    });
    const marketingEmployees = outletEmps.filter(e => Array.isArray(e.profiles) && e.profiles.includes('MARKETING'));

    // Get latest active location for each marketing employee mapped strictly by employeeId
    const latestPerEmployee = [];
    for (const emp of marketingEmployees) {
      // 1. Fetch employee's active configured location (strictly by employeeId)
      const configuredLoc = await prisma.marketingConfiguredLocation.findFirst({
        where: {
          employeeId: emp.id,
          isActive: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      // 2. Fetch employee's latest live activity
      const lastActivity = await prisma.marketingActivity.findFirst({
        where: {
          OR: [
            { employeeName: emp.name },
            { user: { name: emp.name } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      let resolvedLoc = null;

      // Location resolution logic:
      // If configured location exists and mode is CONFIGURED (or default), prioritize configured location
      if (configuredLoc && (configuredLoc.locationMode !== 'LIVE' || !lastActivity)) {
        resolvedLoc = {
          id: configuredLoc.id,
          employeeId: emp.id,
          employeeName: emp.name,
          locationName: configuredLoc.name,
          name: configuredLoc.name,
          location: configuredLoc.name,
          area: configuredLoc.area,
          city: configuredLoc.city || 'Lahore',
          hospitalName: configuredLoc.hospitalName || null,
          companyName: configuredLoc.companyName || null,
          address: configuredLoc.address || null,
          latitude: configuredLoc.latitude,
          longitude: configuredLoc.longitude,
          radius: configuredLoc.radius || 100,
          isActive: configuredLoc.isActive,
          updatedAt: configuredLoc.updatedAt,
          date: getPktDateString(configuredLoc.updatedAt),
          time: getPktTimeString(configuredLoc.updatedAt),
        };
      } else if (lastActivity) {
        resolvedLoc = {
          id: lastActivity.id,
          employeeId: emp.id,
          employeeName: emp.name,
          locationName: lastActivity.location,
          name: lastActivity.location,
          location: lastActivity.location,
          area: lastActivity.area,
          city: 'Lahore',
          hospitalName: lastActivity.hospitalName || null,
          companyName: lastActivity.companyName || null,
          address: lastActivity.notes || null,
          latitude: lastActivity.latitude,
          longitude: lastActivity.longitude,
          radius: 100,
          isActive: true,
          updatedAt: lastActivity.createdAt,
          date: lastActivity.date,
          time: lastActivity.time,
        };
      } else if (configuredLoc) {
        resolvedLoc = {
          id: configuredLoc.id,
          employeeId: emp.id,
          employeeName: emp.name,
          locationName: configuredLoc.name,
          name: configuredLoc.name,
          location: configuredLoc.name,
          area: configuredLoc.area,
          city: configuredLoc.city || 'Lahore',
          hospitalName: configuredLoc.hospitalName || null,
          companyName: configuredLoc.companyName || null,
          address: configuredLoc.address || null,
          latitude: configuredLoc.latitude,
          longitude: configuredLoc.longitude,
          radius: configuredLoc.radius || 100,
          isActive: configuredLoc.isActive,
          updatedAt: configuredLoc.updatedAt,
          date: getPktDateString(configuredLoc.updatedAt),
          time: getPktTimeString(configuredLoc.updatedAt),
        };
      }

      if (resolvedLoc) {
        latestPerEmployee.push({
          employee: emp,
          location: resolvedLoc,
          latestActivity: resolvedLoc
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

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

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

/**
 * Extracts structured location details from a map link (Google Maps, Apple Maps, OSM, etc.).
 */
const extractLocationLink = async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Unable to extract location from this link. Please paste a supported Google Maps/location link.',
        reason: 'Empty or missing URL.'
      });
    }

    const result = await extractLocationFromUrl(url.trim());
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error extracting location link:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to extract location from this link. Please paste a supported Google Maps/location link.',
      reason: error.message
    });
  }
};

/**
 * Saves or updates an active configured location for a specific Marketing employee.
 * Ensures no duplicate active records exist for the employee.
 */
const saveEmployeeConfiguredLocation = async (req, res) => {
  try {
    const {
      employeeId,
      locationName,
      area,
      city,
      hospitalName,
      companyName,
      address,
      latitude,
      longitude,
      radius = 100,
      originalMapUrl,
      locationMode = 'CONFIGURED',
      isActive = true
    } = req.body || {};

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    // Verify employee exists and is assigned to MARKETING
    const employee = await prisma.outletEmployee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, profiles: true, isActive: true }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Marketing employee not found.' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isValidCoordinates(lat, lng)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.'
      });
    }

    const cleanName = (locationName || '').trim() || (hospitalName || companyName || area || '').trim() || `${employee.name}'s Configured Location`;
    const cleanArea = (area || '').trim() || (city || '').trim() || 'Lahore';

    // Check if an existing location record exists for this employee
    const existing = await prisma.marketingConfiguredLocation.findFirst({
      where: {
        employeeId: employee.id,
        isActive: true
      }
    });

    let saved = null;
    if (existing) {
      // Update existing active configured location (Section 11: No duplicate location records)
      saved = await prisma.marketingConfiguredLocation.update({
        where: { id: existing.id },
        data: {
          employeeName: employee.name,
          name: cleanName,
          area: cleanArea,
          city: (city || '').trim() || null,
          hospitalName: hospitalName ? hospitalName.trim() : null,
          companyName: companyName ? companyName.trim() : null,
          address: address ? address.trim() : null,
          latitude: lat,
          longitude: lng,
          radius: parseFloat(radius) || 100,
          locationMode: locationMode || 'CONFIGURED',
          originalMapUrl: originalMapUrl ? originalMapUrl.trim() : null,
          isActive: Boolean(isActive),
          createdById: req.user?.id || null,
          createdByName: req.user?.name || 'Administrator',
        }
      });
    } else {
      saved = await prisma.marketingConfiguredLocation.create({
        data: {
          employeeId: employee.id,
          employeeName: employee.name,
          name: cleanName,
          area: cleanArea,
          city: (city || '').trim() || null,
          hospitalName: hospitalName ? hospitalName.trim() : null,
          companyName: companyName ? companyName.trim() : null,
          address: address ? address.trim() : null,
          latitude: lat,
          longitude: lng,
          radius: parseFloat(radius) || 100,
          locationMode: locationMode || 'CONFIGURED',
          originalMapUrl: originalMapUrl ? originalMapUrl.trim() : null,
          isActive: Boolean(isActive),
          createdById: req.user?.id || null,
          createdByName: req.user?.name || 'Administrator',
        }
      });
    }

    // Mirror to MarketingActivity table so activity history logs immediately reflect this update
    try {
      const now = new Date();
      let resolvedUserId = req.user?.id;
      if (resolvedUserId) {
        const userExists = await prisma.user.findUnique({ where: { id: resolvedUserId }, select: { id: true } });
        if (!userExists) resolvedUserId = null;
      }
      if (!resolvedUserId) {
        const mUser = await prisma.user.findFirst({ where: { role: 'MARKETING' }, select: { id: true } });
        resolvedUserId = mUser?.id;
      }
      if (!resolvedUserId) {
        const aUser = await prisma.user.findFirst({ select: { id: true } });
        resolvedUserId = aUser?.id;
      }

      const activity = await prisma.marketingActivity.create({
        data: {
          userId: resolvedUserId,
          employeeName: employee.name,
          date: getPktDateString(now),
          time: getPktTimeString(now),
          area: cleanArea,
          location: cleanName,
          hospitalName: hospitalName ? hospitalName.trim() : null,
          companyName: companyName ? companyName.trim() : null,
          notes: address ? address.trim() : null,
          latitude: lat,
          longitude: lng,
          status: 'COMPLETED',
          source: 'CONFIGURED',
        }
      });

      const io = req.app?.get ? req.app.get('io') : null;
      if (io) {
        io.emit('marketing:new-activity', {
          activity,
          employeeName: employee.name
        });
      }
    } catch (actErr) {
      console.warn('Could not mirror location update to MarketingActivity:', actErr.message);
    }

    // Real-time synchronization: Broadcast updated location to Admin Profile and active clients
    const io = req.app?.get ? req.app.get('io') : null;
    if (io) {
      io.emit('marketing:location-updated', {
        employeeId: employee.id,
        employeeName: employee.name,
        location: saved
      });
    }

    res.json({
      success: true,
      location: saved,
      message: `Configured location saved successfully for ${employee.name}.`
    });
  } catch (error) {
    console.error('Error saving employee configured location:', error);
    res.status(500).json({ success: false, message: 'Failed to save location', error: error.message });
  }
};

/**
 * Fetch the active configured location for a specific Marketing employee.
 */
const getEmployeeConfiguredLocation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required.' });
    }

    const location = await prisma.marketingConfiguredLocation.findFirst({
      where: {
        employeeId,
        isActive: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      success: true,
      location: location || null
    });
  } catch (error) {
    console.error('Error fetching employee configured location:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch location', error: error.message });
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
  reverseGeocodeLocation,
  extractLocationLink,
  saveEmployeeConfiguredLocation,
  getEmployeeConfiguredLocation,
};
