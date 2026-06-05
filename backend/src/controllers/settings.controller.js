const prisma = require('../prisma');

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = {};
    settings.forEach(s => {
      try {
        settingsMap[s.key] = JSON.parse(s.value);
      } catch (e) {
        settingsMap[s.key] = s.value;
      }
    });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

const updateSetting = async (req, res) => {
  const { key, value } = req.body;
  try {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: typeof value === 'object' ? JSON.stringify(value) : String(value) },
      create: { 
        key, 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value) 
      }
    });
    res.json(setting);
  } catch (error) {
    res.status(500).json({ message: 'Error updating setting', error: error.message });
  }
};

module.exports = { getSettings, updateSetting };
