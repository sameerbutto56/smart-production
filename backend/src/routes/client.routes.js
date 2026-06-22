const express = require('express');
const { createClient, getClients, searchClients, getClientById, updateClient, deactivateClient } = require('../controllers/client.controller');
const { authenticate } = require('../middleware/auth.middleware');
const router = express.Router();

router.post('/', authenticate, createClient);
router.get('/', authenticate, getClients);
router.get('/search', authenticate, searchClients);
router.get('/:id', authenticate, getClientById);
router.put('/:id', authenticate, updateClient);
router.delete('/:id', authenticate, deactivateClient);

module.exports = router;
