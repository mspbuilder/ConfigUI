const { queryConfig } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

// Get configs using the actual stored procedure from ASCX
// Maps to: GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT
async function getCustomerConfigs(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, category, organization, site, agent } = req.query;

    if (!customerId || !category) {
      return res.status(400).json({ error: 'customerId and category are required' });
    }

    // Use the stored procedure that matches ASCX behavior
    const result = await queryConfig(
      `EXEC GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT
        @CustID = @customerId,
        @Category = @category,
        @Org = @organization,
        @Site = @site,
        @Agent = @agent`,
      {
        customerId,
        category,
        organization: organization || '',
        site: site || '',
        agent: agent || ''
      }
    );

    res.json({
      success: true,
      configs: result.recordset
    });
  } catch (error) {
    reqLog.error('Get configs error', { err: error.message, customerId: req.query.customerId });
    res.status(500).json({ error: 'Failed to retrieve configurations' });
  }
}

// Get default config data by category (for Global level)
// Maps to: GET_DEFAULT_CONFIG_DATA_BY_CATEGORY
async function getDefaultConfigs(req, res) {
  const reqLog = req.log || log;
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    const result = await queryConfig(
      `EXEC GET_DEFAULT_CONFIG_DATA_BY_CATEGORY @Category = @category`,
      { category }
    );

    res.json({
      success: true,
      configs: result.recordset
    });
  } catch (error) {
    reqLog.error('Get default configs error', { err: error.message, category: req.query.category });
    res.status(500).json({ error: 'Failed to retrieve default configurations' });
  }
}

// Get single config by ID
// Maps to: GET_CONFIG_DATA_BY_Configuration_Overrides_ID
async function getConfigById(req, res) {
  const reqLog = req.log || log;
  try {
    const { configId } = req.params;

    const result = await queryConfig(
      `EXEC GET_CONFIG_DATA_BY_Configuration_Overrides_ID @ID = @configId`,
      { configId }
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json({
      success: true,
      config: result.recordset[0]
    });
  } catch (error) {
    reqLog.error('Get config by ID error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
}

// Update config using the actual stored procedure from ASCX
// Maps to: UPDATE_CONFIGURATION_OVERRIDES
async function updateConfig(req, res) {
  const reqLog = req.log || log;
  try {
    const { configId } = req.params;
    const { value, property, level } = req.body;

    // Level maps to: GLOBAL, CUSTOMER, ORG, SITE, AGENT
    const validLevels = ['GLOBAL', 'CUSTOMER', 'ORG', 'SITE', 'AGENT'];
    const upperLevel = (level || '').toUpperCase();

    if (!validLevels.includes(upperLevel)) {
      return res.status(400).json({ error: 'Invalid level. Must be one of: GLOBAL, CUSTOMER, ORG, SITE, AGENT' });
    }

    // Use the stored procedure that matches ASCX behavior
    await queryConfig(
      `EXEC UPDATE_CONFIGURATION_OVERRIDES
        @ConfigID = @configId,
        @Value = @value,
        @Property = @property,
        @Level = @level,
        @CurrentUserName = @username`,
      {
        configId,
        value: value || '',
        property: property || '',
        level: upperLevel,
        username: req.user.username
      }
    );

    reqLog.info('Config updated', { configId, level: upperLevel, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Update config error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
}

// Delete config using the actual stored procedure from ASCX
// Maps to: DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID
async function deleteConfig(req, res) {
  const reqLog = req.log || log;
  try {
    const { configId } = req.params;

    await queryConfig(
      `EXEC DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID
        @ConfigID = @configId,
        @CurrentUserName = @username`,
      {
        configId,
        username: req.user.username
      }
    );

    reqLog.info('Config deleted', { configId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Delete config error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
}

// Get categories using stored procedure
// Maps to: GET_DEFAULT_CATEGORIES
async function getCategories(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(`EXEC GET_DEFAULT_CATEGORIES`, {});

    res.json({
      success: true,
      categories: result.recordset.map(r => r.Category || r.category)
    });
  } catch (error) {
    reqLog.error('Get categories error', { err: error.message });
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
}

// Get organizations using stored procedure
// Maps to: GET_ORGS_BY_CUSTID
async function getOrganizations(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // ASCX uses first 6 chars of customerId
    const custIdShort = customerId.substring(0, 6);

    const result = await queryConfig(
      `EXEC GET_ORGS_BY_CUSTID @CustID = @customerId`,
      { customerId: custIdShort }
    );

    res.json({
      success: true,
      organizations: result.recordset
    });
  } catch (error) {
    reqLog.error('Get organizations error', { err: error.message, customerId: req.query.customerId });
    res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
}

// Get sites using stored procedure
// Maps to: GET_SITES_BY_CUSTID_ORG
async function getSites(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, organization } = req.query;

    if (!customerId || !organization) {
      return res.status(400).json({ error: 'customerId and organization are required' });
    }

    const result = await queryConfig(
      `EXEC GET_SITES_BY_CUSTID_ORG @CUSTID = @customerId, @ORG = @organization`,
      { customerId, organization }
    );

    res.json({
      success: true,
      sites: result.recordset
    });
  } catch (error) {
    reqLog.error('Get sites error', { err: error.message, customerId: req.query.customerId });
    res.status(500).json({ error: 'Failed to retrieve sites' });
  }
}

// Get agents using stored procedure
// Maps to: GET_AGENTS_BY_CUSTID_ORG_SITE
async function getAgents(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, organization, site } = req.query;

    if (!customerId || !organization || !site) {
      return res.status(400).json({ error: 'customerId, organization, and site are required' });
    }

    const result = await queryConfig(
      `EXEC GET_AGENTS_BY_CUSTID_ORG_SITE @CustID = @customerId, @Org = @organization, @Site = @site`,
      { customerId, organization, site }
    );

    res.json({
      success: true,
      agents: result.recordset
    });
  } catch (error) {
    reqLog.error('Get agents error', { err: error.message, customerId: req.query.customerId });
    res.status(500).json({ error: 'Failed to retrieve agents' });
  }
}

// Get customers for dropdown (admin only)
// Maps to: Get_Customers_For_Dropdown
async function getCustomers(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(`EXEC Get_Customers_For_Dropdown`, {});

    res.json({
      success: true,
      customers: result.recordset
    });
  } catch (error) {
    reqLog.error('Get customers error', { err: error.message });
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
}

// Create new maintenance task
// Maps to: ADD_RMM_MAINTENANCE_TASK
async function createMaintenanceTask(req, res) {
  const reqLog = req.log || log;
  try {
    const {
      customerId,
      organizationId,
      organization,
      organizationCode,
      site,
      agentId,
      agent,
      section
    } = req.body;

    if (!section) {
      return res.status(400).json({ error: 'section (task name) is required' });
    }

    await queryConfig(
      `EXEC ADD_RMM_MAINTENANCE_TASK
        @CustID = @customerId,
        @OrgID = @organizationId,
        @Org = @organization,
        @OrgCode = @organizationCode,
        @Site = @site,
        @AgentID = @agentId,
        @Agent = @agent,
        @NewSection = @section,
        @CurrentUserName = @username`,
      {
        customerId: customerId || '',
        organizationId: organizationId || '',
        organization: organization || '',
        organizationCode: organizationCode || '',
        site: site || '',
        agentId: agentId || '',
        agent: agent || '',
        section,
        username: req.user.username
      }
    );

    reqLog.info('Maintenance task created', { section, customerId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Create maintenance task error', { err: error.message });
    res.status(500).json({ error: 'Failed to create maintenance task' });
  }
}

// Get datatype values for dropdown
// Maps to: GET_CONFIG_VALUES_BY_DATATYPE_ID
async function getDataTypeValues(req, res) {
  const reqLog = req.log || log;
  try {
    const { dataTypeId } = req.params;

    const result = await queryConfig(
      `EXEC GET_CONFIG_VALUES_BY_DATATYPE_ID @DataTypeID = @dataTypeId`,
      { dataTypeId }
    );

    res.json({
      success: true,
      values: result.recordset
    });
  } catch (error) {
    reqLog.error('Get datatype values error', { err: error.message, dataTypeId: req.params.dataTypeId });
    res.status(500).json({ error: 'Failed to retrieve datatype values' });
  }
}

module.exports = {
  getCustomerConfigs,
  getDefaultConfigs,
  getConfigById,
  updateConfig,
  deleteConfig,
  getCategories,
  getOrganizations,
  getSites,
  getAgents,
  getCustomers,
  createMaintenanceTask,
  getDataTypeValues
};
