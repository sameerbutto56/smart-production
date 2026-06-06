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

module.exports = { getUsers, getUserTheme, updateUserTheme };
