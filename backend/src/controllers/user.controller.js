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
      select: { id: true, dateFormatPreference: true, theme: true }
    });
    res.json({
      dateFormatPreference: user?.dateFormatPreference || 'DD/MM/YYYY',
      theme: user?.theme || 'luxe'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching preferences', error: error.message });
  }
};

const updateUserPreferences = async (req, res) => {
  try {
    const { dateFormatPreference, theme } = req.body;
    const allowedFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY/MM/DD'];
    if (dateFormatPreference && !allowedFormats.includes(dateFormatPreference)) {
      return res.status(400).json({
        message: 'Invalid date format preference. Allowed formats: DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD'
      });
    }

    const data = {};
    if (dateFormatPreference) data.dateFormatPreference = dateFormatPreference;
    if (theme) data.theme = theme;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, dateFormatPreference: true, theme: true }
    });

    res.json({
      message: 'Preferences updated successfully',
      dateFormatPreference: updated.dateFormatPreference,
      theme: updated.theme
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update preferences', error: error.message });
  }
};

module.exports = { getUsers, getUserTheme, updateUserTheme, getUserPreferences, updateUserPreferences };

