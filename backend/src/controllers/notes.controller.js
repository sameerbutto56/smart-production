const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

const getNotes = async (req, res) => {
  try {
    const notes = await prisma.personalNote.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notes', error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const note = await prisma.personalNote.create({
      data: { userId: req.user.id, title: title || '', content: content || '' },
    });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create note', error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Note not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    const note = await prisma.personalNote.update({
      where: { id },
      data: { title: title ?? existing.title, content: content ?? existing.content },
    });
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update note', error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Note not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });

    await prisma.personalNote.delete({ where: { id } });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete note', error: error.message });
  }
};

const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

module.exports = { getNotes, createNote, updateNote, deleteNote, verifyPassword };
