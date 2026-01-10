const { queryConfig } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

// Read-only mode - blocks all write operations and logs SQL instead
const READ_ONLY_MODE = process.env.DB_READ_ONLY === 'true';
log.info('Config controller initialized', { readOnlyMode: READ_ONLY_MODE, envValue: process.env.DB_READ_ONLY });

function logBlockedWrite(reqLog, operation, sql, params) {
  reqLog.warn('BLOCKED WRITE (read-only mode)', {
    operation,
    sql,
    params
  });
}

// Get configs using the actual stored procedure from ASCX
// Maps to: GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT
async function getCustomerConfigs(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, category, organization, site, agent } = req.query;

    if (!customerId || !category) {
      return res.status(400).json({ error: 'customerId and category are required' });
    }

    // Ensure string types for all parameters
    const orgString = organization ? String(organization) : '';
    const siteString = site ? String(site) : '';
    const agentString = agent ? String(agent) : '';

    // Use positional parameters like ASCX does (SP params: @CustID, @CAT, @Org, @Site, @Agent)
    const result = await queryConfig(
      `EXEC GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT @p1, @p2, @p3, @p4, @p5`,
      {
        p1: customerId,
        p2: category,
        p3: orgString,
        p4: siteString,
        p5: agentString
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

    // Use positional parameter like ASCX does
    const result = await queryConfig(
      `EXEC GET_DEFAULT_CONFIG_DATA_BY_CATEGORY @p1`,
      { p1: category }
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
      `EXEC GET_CONFIG_DATA_BY_Configuration_Overrides_ID @p1`,
      { p1: configId }
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
// Params: ConfigID, Value, Property, Level, Username
async function updateConfig(req, res) {
  const reqLog = req.log || log;
  try {
    const { configId } = req.params;
    const { value, property, level } = req.body;

    if (!configId || configId === 'undefined') {
      return res.status(400).json({ error: 'configId is required' });
    }

    // Level maps to: GLOBAL, CUSTOMER, ORG, SITE, AGENT
    const validLevels = ['GLOBAL', 'CUSTOMER', 'ORG', 'SITE', 'AGENT'];
    const upperLevel = (level || '').toUpperCase();

    if (!validLevels.includes(upperLevel)) {
      return res.status(400).json({ error: 'Invalid level. Must be one of: GLOBAL, CUSTOMER, ORG, SITE, AGENT' });
    }

    const sql = `EXEC UPDATE_CONFIGURATION_OVERRIDES @p1, @p2, @p3, @p4, @p5`;
    const params = {
      p1: configId,
      p2: value || '',
      p3: property || '',
      p4: upperLevel,
      p5: req.user.username
    };

    if (READ_ONLY_MODE) {
      logBlockedWrite(reqLog, 'UPDATE_CONFIG', sql, params);
      return res.json({ success: true, blocked: true, message: 'Write blocked (read-only mode)' });
    }

    await queryConfig(sql, params);

    reqLog.info('Config updated', { configId, level: upperLevel, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Update config error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
}

// Delete config using the actual stored procedure from ASCX
// Maps to: DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID
// Params: ConfigID, Username
async function deleteConfig(req, res) {
  const reqLog = req.log || log;
  try {
    const { configId } = req.params;

    if (!configId || configId === 'undefined') {
      return res.status(400).json({ error: 'configId is required' });
    }

    const sql = `EXEC DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID @p1, @p2`;
    const params = {
      p1: configId,
      p2: req.user.username
    };

    if (READ_ONLY_MODE) {
      logBlockedWrite(reqLog, 'DELETE_CONFIG', sql, params);
      return res.json({ success: true, blocked: true, message: 'Write blocked (read-only mode)' });
    }

    await queryConfig(sql, params);

    reqLog.info('Config deleted', { configId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Delete config error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
}

// Get categories from Config.File_Spec
// Returns full category objects with f_name, sort_order, custom_sections_allowed
async function getCategories(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(
      `SELECT file_spec_id, f_name, file_desc, sort_order, custom_sections_allowed
       FROM Config.File_Spec
       ORDER BY sort_order`,
      {}
    );

    res.json({
      success: true,
      categories: result.recordset
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

    // Use positional parameter like ASCX does
    const result = await queryConfig(
      `EXEC GET_ORGS_BY_CUSTID @p1`,
      { p1: custIdShort }
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

    // Ensure organization is a string (not an object from JSON)
    const orgString = typeof organization === 'string' ? organization : String(organization);

    // Use positional parameters like ASCX does
    const result = await queryConfig(
      `EXEC GET_SITES_BY_CUSTID_ORG @p1, @p2`,
      { p1: customerId, p2: orgString }
    );

    res.json({
      success: true,
      sites: result.recordset
    });
  } catch (error) {
    reqLog.error('Get sites error', { err: error.message, customerId: req.query.customerId, organization: req.query.organization });
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

    // Ensure string types
    const orgString = typeof organization === 'string' ? organization : String(organization);
    const siteString = typeof site === 'string' ? site : String(site);

    // Use positional parameters like ASCX does
    const result = await queryConfig(
      `EXEC GET_AGENTS_BY_CUSTID_ORG_SITE @p1, @p2, @p3`,
      { p1: customerId, p2: orgString, p3: siteString }
    );

    res.json({
      success: true,
      agents: result.recordset
    });
  } catch (error) {
    reqLog.error('Get agents error', { err: error.message, customerId: req.query.customerId, organization: req.query.organization, site: req.query.site });
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
// Params: CustID, OrgID, Org, OrgCode, Site, AgentID, Agent, NewSection, CurrentUserName
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

    const sql = `EXEC ADD_RMM_MAINTENANCE_TASK @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9`;
    const params = {
      p1: customerId || '',
      p2: organizationId || '',
      p3: organization || '',
      p4: organizationCode || '',
      p5: site || '',
      p6: agentId || '',
      p7: agent || '',
      p8: section,
      p9: req.user.username
    };

    if (READ_ONLY_MODE) {
      logBlockedWrite(reqLog, 'CREATE_MAINTENANCE_TASK', sql, params);
      return res.json({ success: true, blocked: true, message: 'Write blocked (read-only mode)' });
    }

    await queryConfig(sql, params);

    reqLog.info('Maintenance task created', { section, customerId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Create maintenance task error', { err: error.message });
    res.status(500).json({ error: 'Failed to create maintenance task' });
  }
}

// Create a custom section for a category
// Requires: category (file_spec f_name), sectionName, and context (customerId, org, site, agent)
async function createSection(req, res) {
  const reqLog = req.log || log;
  try {
    const { category, sectionName, customerId, organization, site, agent } = req.body;

    if (!category || !sectionName) {
      return res.status(400).json({ error: 'category and sectionName are required' });
    }

    // TODO: Replace with actual stored procedure once created
    // For now, this is a stub that logs the intent
    const sql = `-- STUB: INSERT custom section
      -- Category: @p1, Section: @p2, CustomerId: @p3, Org: @p4, Site: @p5, Agent: @p6, User: @p7`;
    const params = {
      p1: category,
      p2: sectionName,
      p3: customerId || '',
      p4: organization || '',
      p5: site || '',
      p6: agent || '',
      p7: req.user.username
    };

    if (READ_ONLY_MODE) {
      logBlockedWrite(reqLog, 'CREATE_SECTION', sql, params);
      return res.json({ success: true, blocked: true, message: 'Write blocked (read-only mode)' });
    }

    // TODO: Execute actual SQL/SP when ready
    reqLog.info('Section creation requested (stub)', params);

    res.json({ success: true, stub: true, message: 'Section creation not yet implemented in database' });
  } catch (error) {
    reqLog.error('Create section error', { err: error.message });
    res.status(500).json({ error: 'Failed to create section' });
  }
}

// Get datatype values for dropdown
// Maps to: GET_CONFIG_VALUES_BY_DATATYPE_ID
async function getDataTypeValues(req, res) {
  const reqLog = req.log || log;
  try {
    const { dataTypeId } = req.params;

    // Use positional parameter
    const result = await queryConfig(
      `EXEC GET_CONFIG_VALUES_BY_DATATYPE_ID @p1`,
      { p1: dataTypeId }
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
  createSection,
  getDataTypeValues
};
