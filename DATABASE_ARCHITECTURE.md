# Database Architecture - Two Database Setup

## Overview

The application connects to **TWO SEPARATE DATABASES**:

1. **MojoPortal Database** - Existing, read-only for this app
2. **Configurations Database** - Existing, read-write for config data

## Database: MojoPortal (Read-Only)

**Connection String:**
- Server: `MOJO_DB_SERVER`
- Database: `MOJO_DB_DATABASE`
- Used by: `queryMojo()` function

**Tables Used:**

### mp_Users
- UserID (referenced in JWT)
- LoginName
- Email
- Name (DisplayName)
- UserGuid
- IsDeleted

### mp_Roles
- RoleID
- RoleName (e.g., "ConfigAdmin", "MSPBEmployee")
- DisplayName

### mp_UserRoles (Junction)
- UserID → mp_Users.UserID
- RoleID → mp_Roles.RoleID

### mp_UserProperties
- UserGuid → mp_Users.UserGuid
- SettingName = 'Comment'
- SettingValue = 'CUSTID:123456...'

**Queries Made:**
- User authentication (in `authController.authenticateFromMojo`)
- User validation (in `auth.authenticate` middleware)
- Role checking (in `auth.requireRole` middleware)

## Database: Configurations (Read-Write)

**Connection String:**
- Server: `CONFIG_DB_SERVER`
- Database: `CONFIG_DB_DATABASE`
- Used by: `queryConfig()` function (default `query()`)

**Tables Used:**

### UserMfa (Already Exists)
- MfaID (PK)
- LoginName → References mp_Users.LoginName
- MfaSecret (TOTP key)
- MfaLastAuth (datetime)
- CreatedDate

### Configurations (Already Exists)
- ConfigID (PK)
- CustomerID (extracted from mp_UserProperties)
- Category
- Section
- Property
- Organization
- Site
- Agent
- DefaultValue
- OrgValue
- SiteValue
- AgentValue
- DataTypeID (1=Text, 2=Boolean, 23=Special)
- ToolTip
- SectionToolTip
- NonDefaultTask (custom vs default)
- DisplayOrder
- CreatedBy → References mp_Users.LoginName
- CreatedDate
- ModifiedBy → References mp_Users.LoginName
- LastModified

**Queries Made:**
- MFA operations (generate, verify)
- Configuration CRUD operations
- Dropdown data (categories, orgs, sites, agents)

## Code Usage

### Backend Database Functions

```javascript
const { queryMojo, queryConfig } = require('../config/database');

// Query MojoPortal database
const users = await queryMojo('SELECT * FROM mp_Users WHERE UserID = @id', { id: 123 });

// Query Configurations database  
const configs = await queryConfig('SELECT * FROM Configurations WHERE CustomerID = @id', { id: '000001' });

// Legacy function (defaults to queryConfig)
const mfa = await query('SELECT * FROM UserMfa WHERE LoginName = @name', { name: 'user@example.com' });
```

### Connection Pooling

Each database has its own connection pool:
- `mojoPool` - MojoPortal database
- `configPool` - Configurations database

Pools are initialized on first query and reused.

## Cross-Database References

**CustomerID Flow:**
1. JWT contains userId (from MojoPortal)
2. Query mp_Users to get UserGuid
3. Query mp_UserProperties for Comment field
4. Extract CustomerID from "CUSTID:XXXXXX" format
5. Use CustomerID to filter Configurations

**User References:**
- Configurations.CreatedBy/ModifiedBy = mp_Users.LoginName (string reference)
- UserMfa.LoginName = mp_Users.LoginName (string reference)
- **No foreign key constraints between databases**

## Security Considerations

### MojoPortal Database
- **Read-only access** - no INSERT/UPDATE/DELETE
- Only SELECT queries allowed
- Minimizes risk to production user database

### Configurations Database
- **Read-write access** for config management
- Audit trail via CreatedBy/ModifiedBy fields
- References MojoPortal users by LoginName (string)

## Error Handling

```javascript
try {
  const user = await queryMojo('SELECT * FROM mp_Users WHERE UserID = @id', { id: userId });
  if (user.recordset.length === 0) {
    return res.status(401).json({ error: 'User not found' });
  }
} catch (error) {
  console.error('MojoPortal query error:', error);
  return res.status(500).json({ error: 'Authentication error' });
}
```

## Environment Variables

```env
# MojoPortal Database (Read-Only)
MOJO_DB_SERVER=sql-server-1
MOJO_DB_DATABASE=MojoPortal
MOJO_DB_USER=readonly_user
MOJO_DB_PASSWORD=readonly_password
MOJO_DB_PORT=1433

# Configurations Database (Read-Write)
CONFIG_DB_SERVER=sql-server-2
CONFIG_DB_DATABASE=Configurations
CONFIG_DB_USER=config_admin
CONFIG_DB_PASSWORD=admin_password
CONFIG_DB_PORT=1433
```

## Testing Database Connectivity

```bash
# Test MojoPortal connection
sqlcmd -S ${MOJO_DB_SERVER} -d ${MOJO_DB_DATABASE} -U ${MOJO_DB_USER} -P ${MOJO_DB_PASSWORD} -Q "SELECT COUNT(*) FROM mp_Users"

# Test Configurations connection
sqlcmd -S ${CONFIG_DB_SERVER} -d ${CONFIG_DB_DATABASE} -U ${CONFIG_DB_USER} -P ${CONFIG_DB_PASSWORD} -Q "SELECT COUNT(*) FROM Configurations"
```

## Performance Optimization

### Indexes Recommended

**MojoPortal (if you have permissions):**
```sql
CREATE INDEX IX_mp_Users_UserID ON mp_Users(UserID) WHERE IsDeleted = 0;
CREATE INDEX IX_mp_UserRoles_UserID ON mp_UserRoles(UserID);
```

**Configurations:**
```sql
CREATE INDEX IX_Configurations_Customer ON Configurations(CustomerID, Category);
CREATE INDEX IX_UserMfa_LoginName ON UserMfa(LoginName);
```

### Query Optimization
- Always use parameterized queries
- Avoid N+1 queries
- Use appropriate WHERE clauses
- Consider caching role lookups

## Troubleshooting

**"Cannot connect to MojoPortal database":**
- Verify MOJO_DB_* environment variables
- Check network connectivity between servers
- Verify SQL Server allows remote connections
- Check firewall rules

**"User not found" errors:**
- Verify UserID in JWT matches mp_Users.UserID
- Check IsDeleted flag in mp_Users
- Verify JWT secret matches between systems

**"Configuration save fails":**
- Verify CONFIG_DB_* environment variables
- Check write permissions on Configurations database
- Verify LoginName exists in mp_Users
