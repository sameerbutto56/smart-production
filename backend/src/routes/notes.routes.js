const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getNotes, createNote, deleteNote } = require('../controllers/notes.controller');

const router = express.Router();

router.get('/', authenticate, getNotes);
router.post('/', authenticate, createNote);
router.delete('/:id', authenticate, deleteNote);

module.exports = router;
