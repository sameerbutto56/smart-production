const prisma = require('../prisma');

const EMPLOYEE_CREDENTIALS = {
  'Sajawal': 'S170',
  'Junaid': 'J170',
  'Gul': 'G170',
  'Zain': 'Z170',
  'Aamir': 'A170',
  'Ibrar': 'I170',
  'Ali': 'A170',
  'Mudassir': 'M170',
  'Faisal': 'F170',
};

const EMPLOYEES_BY_ROLE = {
  OUTLET_JOHAR_TOWN: ['Sajawal', 'Junaid', 'Gul', 'Zain'],
  OUTLET_JAIL_ROAD: ['Aamir', 'Ibrar', 'Junaid'],
  STORE: ['Ali', 'Mudassir'],
  FAISAL: ['Faisal'],
};

const getUserOutletKey = (user) => {
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '').toLowerCase();

  if (role === 'FAISAL') return 'FAISAL';
  if (role === 'STORE') return 'STORE';
  if (role === 'OUTLET') {
    if (name.includes('johar')) return 'OUTLET_JOHAR_TOWN';
    if (name.includes('jail')) return 'OUTLET_JAIL_ROAD';
    return 'OUTLET_JOHAR_TOWN';
  }
  return null;
};

const getEmployees = (req, res) => {
  const key = getUserOutletKey(req.user);
  const employees = key ? EMPLOYEES_BY_ROLE[key] : [];
  res.json(employees);
};

const verifyPassword = (req, res) => {
  try {
    const { employeeName, password } = req.body;
    if (!employeeName || !password) {
      return res.status(400).json({ message: 'Employee name and password required' });
    }

    const key = getUserOutletKey(req.user);
    const allowed = key ? EMPLOYEES_BY_ROLE[key] || [] : [];
    if (!allowed.includes(employeeName)) {
      return res.status(403).json({ message: 'Employee not found for your profile' });
    }

    if (EMPLOYEE_CREDENTIALS[employeeName] !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    res.json({ success: true, employeeName });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
};

const getNotes = async (req, res) => {
  try {
    const { employeeName } = req.query;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });

    const notes = await prisma.personalNote.findMany({
      where: { ownerName: employeeName },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notes', error: error.message });
  }
};

const createNote = async (req, res) => {
  try {
    const { employeeName, title, content } = req.body;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });

    const note = await prisma.personalNote.create({
      data: { ownerName: employeeName, title: title || '', content: content || '' },
    });
    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create note', error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeName, title, content } = req.body;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });

    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Note not found' });
    if (existing.ownerName !== employeeName) return res.status(403).json({ message: 'Unauthorized' });

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
    const { employeeName } = req.query;
    if (!employeeName) return res.status(400).json({ message: 'employeeName required' });

    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Note not found' });
    if (existing.ownerName !== employeeName) return res.status(403).json({ message: 'Unauthorized' });

    await prisma.personalNote.delete({ where: { id } });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete note', error: error.message });
  }
};

module.exports = { getEmployees, getNotes, createNote, updateNote, deleteNote, verifyPassword };
