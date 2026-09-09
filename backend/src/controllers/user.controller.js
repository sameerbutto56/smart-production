const prisma = require('../prisma');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

const getUserTheme = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { theme: true }
    });
    const globalSetting = await prisma.systemSetting.findUnique({
      where: { key: 'APP_THEME' }
    });
    res.json({
      personalTheme: user?.theme || null,
      globalTheme: globalSetting?.value || 'luxe'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching theme', error: error.message });
  }
};

const updateUserTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { theme }
    });
    res.json({ message: 'Personal theme updated', theme });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update theme', error: error.message });
  }
};

const getUserPreferences = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        dateFormatPreference: true,
        shopifyMonthPreference: true,
        shopifyYearPreference: true,
        theme: true
      }
    });
    res.json({
      dateFormatPreference: user?.dateFormatPreference || 'DD/MM/YYYY',
      shopifyMonthPreference: user?.shopifyMonthPreference ?? null,
      shopifyYearPreference: user?.shopifyYearPreference ?? null,
      theme: user?.theme || 'luxe'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching preferences', error: error.message });
  }
};

const updateUserPreferences = async (req, res) => {
  try {
    const { dateFormatPreference, shopifyMonthPreference, shopifyYearPreference, theme } = req.body;
    const allowedFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
    if (dateFormatPreference && !allowedFormats.includes(dateFormatPreference)) {
      return res.status(400).json({
        message: 'Invalid date format preference. Allowed formats: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD'
      });
    }

    const data = {};
    if (dateFormatPreference) data.dateFormatPreference = dateFormatPreference;
    if (theme) data.theme = theme;

    if (shopifyMonthPreference !== undefined && shopifyMonthPreference !== null) {
      const m = parseInt(shopifyMonthPreference, 10);
      if (isNaN(m) || m < 1 || m > 12) {
        return res.status(400).json({ message: 'Month preference must be an integer between 1 and 12.' });
      }
      data.shopifyMonthPreference = m;
    }

    if (shopifyYearPreference !== undefined && shopifyYearPreference !== null) {
      const y = parseInt(shopifyYearPreference, 10);
      if (isNaN(y) || y < 2000 || y > 2100) {
        return res.status(400).json({ message: 'Year preference must be an integer between 2000 and 2100.' });
      }
      data.shopifyYearPreference = y;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        id: true,
        name: true,
        dateFormatPreference: true,
        shopifyMonthPreference: true,
        shopifyYearPreference: true,
        theme: true
      }
    });

    res.json({
      message: 'Preferences updated successfully',
      dateFormatPreference: updated.dateFormatPreference,
      shopifyMonthPreference: updated.shopifyMonthPreference,
      shopifyYearPreference: updated.shopifyYearPreference,
      theme: updated.theme
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update preferences', error: error.message });
  }
};

module.exports = { getUsers, getUserTheme, updateUserTheme, getUserPreferences, updateUserPreferences };

