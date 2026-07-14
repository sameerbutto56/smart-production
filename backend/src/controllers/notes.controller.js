const prisma = require('../prisma');

const ensureColumn = (() => {
  let done = false;
  return async () => {
    if (done) return;
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "PersonalNote" ADD COLUMN IF NOT EXISTS "outletName" TEXT DEFAULT '';`);
    } catch (_e) { /* already exists or no perms */ }
    done = true;
  };
})();

const getOutletName = (req) => {
  if (req.query.outlet) return req.query.outlet;
  if (req.body.outlet) return req.body.outlet;
  const n = String(req.user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return req.user?.name || 'Outlet';
};

const getNotes = async (req, res) => {
  try {
    await ensureColumn();
    const outlet = getOutletName(req);
    const notes = await prisma.personalNote.findMany({
      where: { outletName: outlet },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notes', error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    await ensureColumn();
    const { employeeName, content } = req.body;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });
    if (!content) return res.status(400).json({ message: 'content required' });
    const outlet = getOutletName(req);

    const note = await prisma.personalNote.create({
      data: { ownerName: employeeName, outletName: outlet, content: content || '', title: '' },
    });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create note', error: error.message });
  }
};

module.exports = { getNotes, createNote };
