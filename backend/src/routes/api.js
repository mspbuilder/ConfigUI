const express = require('express');
const { authenticate, requireMFA, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const configController = require('../controllers/configController');

const router = express.Router();

// Auth routes
router.post('/auth/mojo-login', authController.authenticateFromMojo);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/check', authenticate, authController.checkAuth);

// MFA routes
router.post('/auth/mfa/generate', authenticate, authController.generateMfa);
router.post('/auth/mfa/verify', authenticate, authController.verifyMfa);

// Config routes (require auth + MFA)
router.get('/configs', authenticate, requireMFA, configController.getCustomerConfigs);

// Routes with role checking - wrapped properly
router.put('/configs/:configId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = requireRole(['ConfigAdmin', 'MSPBEmployee']);
  await roleMiddleware(req, res, next);
}, configController.updateConfig);

router.post('/configs', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = requireRole(['ConfigAdmin', 'MSPBEmployee']);
  await roleMiddleware(req, res, next);
}, configController.createConfig);

router.delete('/configs/:configId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = requireRole(['ConfigAdmin', 'MSPBEmployee']);
  await roleMiddleware(req, res, next);
}, configController.deleteConfig);

// Dropdown data routes
router.get('/categories', authenticate, requireMFA, configController.getCategories);
router.get('/organizations', authenticate, requireMFA, configController.getOrganizations);
router.get('/sites', authenticate, requireMFA, configController.getSites);
router.get('/agents', authenticate, requireMFA, configController.getAgents);

module.exports = router;
