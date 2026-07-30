const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/ceo.controller');
const CEO_AUTH = authorize(['SUPER_ADMIN', 'ADMIN', 'CEO']);

router.get('/overview', authenticate, CEO_AUTH, ctrl.getOverview);
router.get('/sales', authenticate, CEO_AUTH, ctrl.getSales);
router.get('/financial', authenticate, CEO_AUTH, ctrl.getFinancial);
router.get('/branches', authenticate, CEO_AUTH, ctrl.getBranches);
router.get('/orders', authenticate, CEO_AUTH, ctrl.getOrders);
router.get('/products', authenticate, CEO_AUTH, ctrl.getProducts);
router.get('/inventory', authenticate, CEO_AUTH, ctrl.getInventory);
router.get('/production', authenticate, CEO_AUTH, ctrl.getProduction);
router.get('/employees', authenticate, CEO_AUTH, ctrl.getEmployees);
router.get('/payments', authenticate, CEO_AUTH, ctrl.getPayments);
router.get('/customization', authenticate, CEO_AUTH, ctrl.getCustomization);

module.exports = router;
