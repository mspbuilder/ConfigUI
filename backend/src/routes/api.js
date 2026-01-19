const express = require('express');
const { authenticate, requireMFA, fetchUserRoles, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const configController = require('../controllers/configController');
const fileSpecController = require('../controllers/fileSpecController');
const sectionSpecController = require('../controllers/sectionSpecController');

const router = express.Router();

// Auth routes
router.post('/auth/mojo-login', authController.authenticateFromMojo);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/check', authenticate, authController.checkAuth);
router.get('/auth/roles', authenticate, requireMFA, authController.getUserRoles);

// MFA routes
router.post('/auth/mfa/generate', authenticate, authController.generateMfa);
router.post('/auth/mfa/verify', authenticate, authController.verifyMfa);

// Config routes (require auth + MFA)
// fetchUserRoles is added to populate req.userRoles for SQL echo in read-only mode
// Get configs by customer/category/org/site/agent
router.get('/configs', authenticate, requireMFA, fetchUserRoles, configController.getCustomerConfigs);

// Get default configs (global level)
router.get('/configs/defaults', authenticate, requireMFA, fetchUserRoles, configController.getDefaultConfigs);

// Get single config by ID
router.get('/configs/:configId', authenticate, requireMFA, fetchUserRoles, configController.getConfigById);

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

// Create custom section
router.post('/sections', authenticate, requireMFA, fetchUserRoles, configController.createSection);

// Dropdown data routes (with fetchUserRoles for SQL echo)
router.get('/categories', authenticate, requireMFA, fetchUserRoles, configController.getCategories);
router.get('/organizations', authenticate, requireMFA, fetchUserRoles, configController.getOrganizations);
router.get('/sites', authenticate, requireMFA, fetchUserRoles, configController.getSites);
router.get('/agents', authenticate, requireMFA, fetchUserRoles, configController.getAgents);

// Admin route - get customers list (requireRole already populates userRoles)
router.get('/customers', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.getCustomers);

// Get datatype values for dropdown
router.get('/datatypes/:dataTypeId/values', authenticate, requireMFA, fetchUserRoles, configController.getDataTypeValues);

// Create RMSDCC (Disk Capacity Check) entry - requires admin role
router.post('/rmsdcc', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.createRMSDCCEntry);

// Create RMUOBA Section (Org-based types) - requires admin role
router.post('/rmuoba/section', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.createRMUOBASection);

// Create RMUOBA Entry (ALL-based types) - requires admin role
router.post('/rmuoba/entry', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['Customer Config Admin', 'MSPB_Employees']);
  roleMiddleware(req, res, next);
}, configController.createRMUOBAEntry);

// Data Sync route - available to all authenticated users
router.post('/sync/request', authenticate, requireMFA, fetchUserRoles, configController.requestDataSync);

// Admin routes - File Spec management (MSPB_Employees only)
router.get('/admin/file-specs', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, fileSpecController.getFileSpecs);

router.put('/admin/file-specs/:fileSpecId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, fileSpecController.updateFileSpec);

// Admin routes - Section Spec management (MSPB_Employees only)
router.get('/admin/section-specs', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, sectionSpecController.getSectionSpecs);

router.put('/admin/section-specs/:sectionSpecId', authenticate, requireMFA, async (req, res, next) => {
  const roleMiddleware = await requireRole(['MSPB_Employees']);
  roleMiddleware(req, res, next);
}, sectionSpecController.updateSectionSpec);

module.exports = router;
