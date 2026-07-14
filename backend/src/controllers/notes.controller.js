const prisma = require('../prisma');

const getNotes = async (req, res) => {
  try {
    const notes = await prisma.personalNote.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notes', error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { employeeName, content } = req.body;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });
    if (!content) return res.status(400).json({ message: 'content required' });

    const note = await prisma.personalNote.create({
      data: { ownerName: employeeName, content: content || '', title: '' },
    });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create note', error: error.message });
  }
};

module.exports = { getNotes, createNote };
