const { queryConfig } = require('../config/database');

async function getCustomerConfigs(req, res) {
  try {
    const { customerId, category, organization, site, agent } = req.query;
    
    let sql = `
      SELECT 
        ConfigID,
        CustomerID,
        Category,
        Section,
        Property,
        Organization,
        Site,
        Agent,
        DefaultValue,
        OrgValue,
        SiteValue,
        AgentValue,
        DataTypeID,
        ToolTip,
        SectionToolTip,
        NonDefaultTask,
        DisplayOrder
      FROM Configurations
      WHERE CustomerID = @customerId
    `;
    
    const params = { customerId };
    
    if (category) {
      sql += ' AND Category = @category';
      params.category = category;
    }
    if (organization) {
      sql += ' AND (Organization = @organization OR Organization IS NULL)';
      params.organization = organization;
    }
    if (site) {
      sql += ' AND (Site = @site OR Site IS NULL)';
      params.site = site;
    }
    if (agent) {
      sql += ' AND (Agent = @agent OR Agent IS NULL)';
      params.agent = agent;
    }
    
    sql += ' ORDER BY DisplayOrder, Section, Property';
    
    const result = await queryConfig(sql, params);
    
    res.json({
      success: true,
      configs: result.recordset
    });
  } catch (error) {
    console.error('Get configs error:', error);
    res.status(500).json({ error: 'Failed to retrieve configurations' });
  }
}

async function updateConfig(req, res) {
  try {
    const { configId } = req.params;
    const { value, level } = req.body; // level: 'default', 'org', 'site', 'agent'
    
    const fieldMap = {
      default: 'DefaultValue',
      org: 'OrgValue',
      site: 'SiteValue',
      agent: 'AgentValue'
    };
    
    const field = fieldMap[level];
    if (!field) {
      return res.status(400).json({ error: 'Invalid level' });
    }
    
    const result = await queryConfig(
      `UPDATE Configurations 
       SET ${field} = @value, 
           LastModified = GETUTCDATE(),
           ModifiedBy = @username
       WHERE ConfigID = @configId`,
      { value, username: req.user.username, configId }
    );
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
}

async function createConfig(req, res) {
  try {
    const {
      customerId,
      category,
      section,
      property,
      organization,
      site,
      agent,
      defaultValue,
      dataTypeId,
      toolTip,
      sectionToolTip
    } = req.body;
    
    const result = await queryConfig(
      `INSERT INTO Configurations (
        CustomerID, Category, Section, Property,
        Organization, Site, Agent,
        DefaultValue, DataTypeID, ToolTip, SectionToolTip,
        NonDefaultTask, CreatedBy, CreatedDate
      )
      VALUES (
        @customerId, @category, @section, @property,
        @organization, @site, @agent,
        @defaultValue, @dataTypeId, @toolTip, @sectionToolTip,
        1, @username, GETUTCDATE()
      );
      SELECT SCOPE_IDENTITY() AS ConfigID`,
      {
        customerId,
        category,
        section,
        property,
        organization,
        site,
        agent,
        defaultValue,
        dataTypeId,
        toolTip,
        sectionToolTip,
        username: req.user.username
      }
    );
    
    res.json({
      success: true,
      configId: result.recordset[0].ConfigID
    });
  } catch (error) {
    console.error('Create config error:', error);
    res.status(500).json({ error: 'Failed to create configuration' });
  }
}

async function deleteConfig(req, res) {
  try {
    const { configId } = req.params;
    
    // Only allow deletion of non-default tasks
    const result = await queryConfig(
      `DELETE FROM Configurations 
       WHERE ConfigID = @configId AND NonDefaultTask = 1`,
      { configId }
    );
    
    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({ error: 'Can only delete custom entries' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
}

async function getCategories(req, res) {
  try {
    const { customerId } = req.query;
    
    const result = await queryConfig(
      `SELECT DISTINCT Category 
       FROM Configurations 
       WHERE CustomerID = @customerId 
       ORDER BY Category`,
      { customerId }
    );
    
    res.json({
      success: true,
      categories: result.recordset.map(r => r.Category)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to retrieve categories' });
  }
}

async function getOrganizations(req, res) {
  try {
    const { customerId } = req.query;
    
    const result = await queryConfig(
      `SELECT DISTINCT Organization 
       FROM Configurations 
       WHERE CustomerID = @customerId AND Organization IS NOT NULL
       ORDER BY Organization`,
      { customerId }
    );
    
    res.json({
      success: true,
      organizations: result.recordset.map(r => r.Organization)
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
}

async function getSites(req, res) {
  try {
    const { customerId, organization } = req.query;
    
    const result = await queryConfig(
      `SELECT DISTINCT Site 
       FROM Configurations 
       WHERE CustomerID = @customerId 
         AND Organization = @organization 
         AND Site IS NOT NULL
       ORDER BY Site`,
      { customerId, organization }
    );
    
    res.json({
      success: true,
      sites: result.recordset.map(r => r.Site)
    });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to retrieve sites' });
  }
}

async function getAgents(req, res) {
  try {
    const { customerId, organization, site } = req.query;
    
    const result = await queryConfig(
      `SELECT DISTINCT Agent 
       FROM Configurations 
       WHERE CustomerID = @customerId 
         AND Organization = @organization 
         AND Site = @site 
         AND Agent IS NOT NULL
       ORDER BY Agent`,
      { customerId, organization, site }
    );
    
    res.json({
      success: true,
      agents: result.recordset.map(r => r.Agent)
    });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to retrieve agents' });
  }
}

module.exports = {
  getCustomerConfigs,
  updateConfig,
  createConfig,
  deleteConfig,
  getCategories,
  getOrganizations,
  getSites,
  getAgents
};
