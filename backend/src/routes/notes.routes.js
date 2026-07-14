const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getNotes, createNote, updateNote, deleteNote, verifyPassword } = require('../controllers/notes.controller');

const router = express.Router();

router.post('/verify-password', authenticate, verifyPassword);
router.get('/', authenticate, getNotes);
router.post('/', authenticate, createNote);
router.put('/:id', authenticate, updateNote);
router.delete('/:id', authenticate, deleteNote);

module.exports = router;
