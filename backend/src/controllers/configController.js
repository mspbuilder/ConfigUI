const { queryConfig, sql, READ_ONLY_MODE, formatSqlForLog } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

log.info('Config controller initialized', { readOnlyMode: READ_ONLY_MODE, envValue: process.env.DB_READ_ONLY });

// Admin roles that should see SQL echo
const ADMIN_ROLES = ['Customer Config Admin', 'MSPB_Employees'];

// Check if user has admin role
function isAdmin(req) {
  const userRoles = req.userRoles || [];
  return userRoles.some(role => ADMIN_ROLES.includes(role));
}

// Get query options for SQL logging
function getQueryOptions(req) {
  const admin = isAdmin(req);
  return {
    reqLog: req.log || log,
    isAdmin: admin
  };
}

// Build response with optional SQL echo
function buildResponse(baseResponse, result, req) {
  // Only include sqlEcho if in read-only mode, user is admin, and sqlEcho exists
  if (READ_ONLY_MODE && isAdmin(req) && result?.sqlEcho) {
    return {
      ...baseResponse,
      sqlEcho: result.sqlEcho
    };
  }
  return baseResponse;
}

function logBlockedWrite(reqLog, operation, sqlQuery, params) {
  const formatted = formatSqlForLog(sqlQuery, params);
  reqLog.warn('BLOCKED WRITE (read-only mode)', {
    operation,
    sql: sqlQuery,
    params,
    formattedSql: formatted
  });
  return { sql: sqlQuery, params, formattedSql: formatted };
}

// Get configs using Config.CfgOverridesWithHierarchy TVF (replaces GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT)
// TVF provides hierarchy context (ParentValue, ParentLevel, ParentConfigID) and excludes legacy Count column
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

    // Use TVF with ORDER BY for consistent sorting
    // TVF params: @CUSTID varchar(10), @CAT varchar(100), @ORG varchar(100), @SITE varchar(255), @AGENT varchar(255)
    const result = await queryConfig(
      `SELECT * FROM Config.CfgOverridesWithHierarchy(@p1, @p2, @p3, @p4, @p5)
       ORDER BY Category_Sort, Section_Sort, Property_Sort, Comment_Sort`,
      {
        p1: { type: sql.VarChar(10), value: customerId },
        p2: { type: sql.VarChar(100), value: category },
        p3: { type: sql.VarChar(100), value: orgString },
        p4: { type: sql.VarChar(255), value: siteString },
        p5: { type: sql.VarChar(255), value: agentString }
      },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      configs: result.recordset
    }, result, req));
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
      { p1: category },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      configs: result.recordset
    }, result, req));
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
      { p1: configId },
      getQueryOptions(req)
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    res.json(buildResponse({
      success: true,
      config: result.recordset[0]
    }, result, req));
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

    const sqlQuery = `EXEC UPDATE_CONFIGURATION_OVERRIDES @p1, @p2, @p3, @p4, @p5`;
    const params = {
      p1: configId,
      p2: value || '',
      p3: property || '',
      p4: upperLevel,
      p5: req.user.username
    };

    if (READ_ONLY_MODE) {
      const sqlEcho = logBlockedWrite(reqLog, 'UPDATE_CONFIG', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      // Include SQL echo for admin users
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
    }

    await queryConfig(sqlQuery, params, getQueryOptions(req));

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

    const sqlQuery = `EXEC DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID @p1, @p2`;
    const params = {
      p1: configId,
      p2: req.user.username
    };

    if (READ_ONLY_MODE) {
      const sqlEcho = logBlockedWrite(reqLog, 'DELETE_CONFIG', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
    }

    await queryConfig(sqlQuery, params, getQueryOptions(req));

    reqLog.info('Config deleted', { configId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Delete config error', { err: error.message, configId: req.params.configId });
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
}

// Get categories from Config.File_Spec
// Returns full category objects including legacy_category_name for SP/cfg_overrides compatibility
async function getCategories(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(
      `SELECT file_spec_id, f_name, file_desc, legacy_category_name, sort_order, custom_sections_allowed
       FROM Config.File_Spec
       ORDER BY sort_order`,
      {},
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      categories: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get categories error', { err: error.message });
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
}

// Get organizations using Config.OrgsFlagged TVF (requires category to show override flags)
async function getOrganizations(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, category } = req.query;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    // ASCX uses first 6 chars of customerId
    const custIdShort = customerId.substring(0, 6);

    // Call the TVF with CustomerID and Category parameters
    const result = await queryConfig(
      `SELECT orgid, orgcode, orgname, flag_overriden_here, flag_overriden_below
       FROM Config.OrgsFlagged(@p1, @p2)
       ORDER BY orgname`,
      {
        p1: { type: sql.VarChar(100), value: custIdShort },
        p2: { type: sql.VarChar(100), value: category }
      },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      organizations: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get organizations error', { err: error.message, customerId: req.query.customerId, category: req.query.category });
    res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
}

// Get sites using Config.SitesFlagged TVF (requires category to show override flags)
async function getSites(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, organization, category } = req.query;

    if (!customerId || !organization) {
      return res.status(400).json({ error: 'customerId and organization are required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    // Ensure organization is a string (not an object from JSON)
    const orgString = typeof organization === 'string' ? organization : String(organization);

    // ASCX uses first 6 chars of customerId
    const custIdShort = customerId.substring(0, 6);

    // Call the TVF with CustomerID, Category, and Organization parameters
    const result = await queryConfig(
      `SELECT site, flag_overriden_here, flag_overriden_below
       FROM Config.SitesFlagged(@p1, @p2, @p3)
       ORDER BY site`,
      {
        p1: { type: sql.VarChar(100), value: custIdShort },
        p2: { type: sql.VarChar(100), value: category },
        p3: { type: sql.VarChar(100), value: orgString }
      },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      sites: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get sites error', { err: error.message, customerId: req.query.customerId, organization: req.query.organization, category: req.query.category });
    res.status(500).json({ error: 'Failed to retrieve sites' });
  }
}

// Get agents using Config.AgentsFlagged TVF (requires category to show override flags)
async function getAgents(req, res) {
  const reqLog = req.log || log;
  try {
    const { customerId, organization, site, category } = req.query;

    if (!customerId || !organization || !site) {
      return res.status(400).json({ error: 'customerId, organization, and site are required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    // Ensure string types
    const orgString = typeof organization === 'string' ? organization : String(organization);
    const siteString = typeof site === 'string' ? site : String(site);

    // ASCX uses first 6 chars of customerId
    const custIdShort = customerId.substring(0, 6);

    // Call the TVF with CustomerID, Category, Organization, and Site parameters
    const result = await queryConfig(
      `SELECT agent, flag_overriden_here
       FROM Config.AgentsFlagged(@p1, @p2, @p3, @p4)
       ORDER BY agent`,
      {
        p1: { type: sql.VarChar(100), value: custIdShort },
        p2: { type: sql.VarChar(100), value: category },
        p3: { type: sql.VarChar(100), value: orgString },
        p4: { type: sql.VarChar(255), value: siteString }
      },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      agents: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get agents error', { err: error.message, customerId: req.query.customerId, organization: req.query.organization, site: req.query.site, category: req.query.category });
    res.status(500).json({ error: 'Failed to retrieve agents' });
  }
}

// Get customers for dropdown (admin only)
// Maps to: Get_Customers_For_Dropdown
async function getCustomers(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(`EXEC Get_Customers_For_Dropdown`, {}, getQueryOptions(req));

    res.json(buildResponse({
      success: true,
      customers: result.recordset
    }, result, req));
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

    const sqlQuery = `EXEC ADD_RMM_MAINTENANCE_TASK @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9`;
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
      const sqlEcho = logBlockedWrite(reqLog, 'CREATE_MAINTENANCE_TASK', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
    }

    await queryConfig(sqlQuery, params, getQueryOptions(req));

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
    const sqlQuery = `-- STUB: INSERT custom section
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
      const sqlEcho = logBlockedWrite(reqLog, 'CREATE_SECTION', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
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
      { p1: dataTypeId },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      values: result.recordset
    }, result, req));
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
