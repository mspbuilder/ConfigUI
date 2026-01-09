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
// Get configs by customer/category/org/site/agent
router.get('/configs', authenticate, requireMFA, configController.getCustomerConfigs);

// Get default configs (global level)
router.get('/configs/defaults', authenticate, requireMFA, configController.getDefaultConfigs);

// Get single config by ID
router.get('/configs/:configId', authenticate, requireMFA, configController.getConfigById);

// Update config - requires admin role
router.put('/configs/:configId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.updateConfig);

// Delete config - requires admin role
router.delete('/configs/:configId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.deleteConfig);

// Create maintenance task - requires admin role
router.post('/configs/tasks', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.createMaintenanceTask);

// Dropdown data routes
router.get('/categories', authenticate, requireMFA, configController.getCategories);
router.get('/organizations', authenticate, requireMFA, configController.getOrganizations);
router.get('/sites', authenticate, requireMFA, configController.getSites);
router.get('/agents', authenticate, requireMFA, configController.getAgents);

// Admin route - get customers list
router.get('/customers', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.getCustomers);

// Get datatype values for dropdown
router.get('/datatypes/:dataTypeId/values', authenticate, requireMFA, configController.getDataTypeValues);

module.exports = router;
