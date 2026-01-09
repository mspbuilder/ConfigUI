-- ============================================================================
-- ConfigUI Backend - Database Permission Setup
-- ============================================================================
-- Run this script on the Configurations database to grant execute permissions
-- to the Config_API user for all required stored procedures.
-- ============================================================================

USE [Configurations]
GO

-- ============================================================================
-- STORED PROCEDURE PERMISSIONS FOR Config_API
-- ============================================================================

-- Config data retrieval
GRANT EXECUTE ON [dbo].[GET_CONFIG_DATA_BY_CUSTID_CATEGORY_ORG_SITE_AGENT] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_DEFAULT_CONFIG_DATA_BY_CATEGORY] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_CONFIG_DATA_BY_Configuration_Overrides_ID] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_DEFAULT_CATEGORIES] TO [Config_API];

-- Dropdown data
GRANT EXECUTE ON [dbo].[GET_ORGS_BY_CUSTID] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_SITES_BY_CUSTID_ORG] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_AGENTS_BY_CUSTID_ORG_SITE] TO [Config_API];
GRANT EXECUTE ON [dbo].[Get_Customers_For_Dropdown] TO [Config_API];
GRANT EXECUTE ON [dbo].[GET_CONFIG_VALUES_BY_DATATYPE_ID] TO [Config_API];

-- Config modifications
GRANT EXECUTE ON [dbo].[UPDATE_CONFIGURATION_OVERRIDES] TO [Config_API];
GRANT EXECUTE ON [dbo].[DELETE_OVERRIDE_BY_CONFIGURATION_OVERRIDE_ID] TO [Config_API];
GRANT EXECUTE ON [dbo].[ADD_RMM_MAINTENANCE_TASK] TO [Config_API];

GO

-- ============================================================================
-- ALTERNATIVE: Grant EXECUTE on ALL stored procedures in the database
-- Uncomment the line below if you prefer broader access
-- ============================================================================
-- GRANT EXECUTE TO [Config_API];
-- GO

PRINT 'Permissions granted successfully to Config_API';
GO
