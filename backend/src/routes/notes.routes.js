const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getNotes, createNote } = require('../controllers/notes.controller');

const router = express.Router();

router.get('/', authenticate, getNotes);
router.post('/', authenticate, createNote);

module.exports = router;
