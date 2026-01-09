# MSPBuilder Config Manager - Updated Architecture

## MojoPortal Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        MojoPortal CMS                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  User logs in via MojoPortal authentication              │  │
│  │  (mp_Users, mp_Roles, mp_UserRoles tables)               │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │  ConfigLauncher.ascx                                     │  │
│  │  • Queries mp_Users for current user                     │  │
│  │  • Extracts CustomerID from mp_UserProperties            │  │
│  │  • Generates JWT token with user claims                  │  │
│  │  • Opens Vue app in new tab with JWT in URL              │  │
│  └───────────────────────┬──────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ JWT Token
                             │ (URL parameter)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vue 3 SPA (New Tab)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Router extracts JWT from URL parameter                  │  │
│  │  POST /api/auth/mojo-login with JWT                      │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Backend validates JWT                                   │  │
│  │  • Verifies signature with shared secret                 │  │
│  │  • Queries mp_Users to verify user still active          │  │
│  │  • Issues session cookie                                 │  │
│  │  • Returns requireMfa flag                               │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MFA Check (if configured)                               │  │
│  │  • Show QR code for setup OR                             │  │
│  │  • Request 6-digit TOTP code                             │  │
│  │  • Store MFA verified in session                         │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Configuration Manager                                   │  │
│  │  • Select filters (Category, Org, Site, Agent)           │  │
│  │  • Load configs via REST API                             │  │
│  │  • Edit values inline                                    │  │
│  │  • Create/delete custom configs                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema (MojoPortal Database)

### Existing MojoPortal Tables (Used, Not Modified)
```sql
mp_Users
├── UserID (referenced in JWT)
├── LoginName
├── Email
├── Name (DisplayName)
└── IsDeleted

mp_Roles
├── RoleID
├── RoleName (ConfigAdmin, MSPBEmployee)
└── DisplayName

mp_UserRoles
├── UserID → mp_Users.UserID
└── RoleID → mp_Roles.RoleID

mp_UserProperties
├── UserGuid → mp_Users.UserGuid
├── SettingName = 'Comment'
└── SettingValue = 'CUSTID:123456...'
```

### New Tables (Added by schema.sql)
```sql
UserMfa
├── MfaID (PK)
├── LoginName → mp_Users.LoginName
├── MfaSecret (TOTP key)
├── MfaLastAuth (datetime)
└── CreatedDate

Configurations
├── ConfigID (PK)
├── CustomerID (from mp_UserProperties)
├── Category
├── Section
├── Property
├── Organization
├── Site
├── Agent
├── DefaultValue
├── OrgValue
├── SiteValue
├── AgentValue
├── DataTypeID
├── ToolTip
├── SectionToolTip
├── NonDefaultTask
├── DisplayOrder
├── CreatedBy → mp_Users.LoginName
├── CreatedDate
├── ModifiedBy → mp_Users.LoginName
└── LastModified
```

## JWT Token Flow

### 1. MojoPortal Generates Token (ConfigLauncher.ascx)
```csharp
var tokenDescriptor = new SecurityTokenDescriptor
{
    Subject = new ClaimsIdentity(new[]
    {
        new Claim("userId", user.UserId.ToString()),
        new Claim("username", user.LoginName),
        new Claim("email", user.Email),
        new Claim("displayName", user.Name)
    }),
    Expires = DateTime.UtcNow.AddHours(4),
    SigningCredentials = new SigningCredentials(
        new SymmetricSecurityKey(key),
        SecurityAlgorithms.HmacSha256Signature
    )
};
```

### 2. Vue App Receives Token
```javascript
// URL: https://config.mspbuilder.com/?token=eyJhbG...
const urlParams = new URLSearchParams(window.location.search);
const mojoToken = urlParams.get('token');
await authStore.authenticateFromMojo(mojoToken);
```

### 3. Backend Validates Token
```javascript
// Verify JWT signature
const decoded = jwt.verify(mojoToken, process.env.MOJO_JWT_SECRET);

// Verify user in MojoPortal
const user = await query(`
  SELECT UserID, LoginName, Email FROM mp_Users 
  WHERE UserID = @userId AND IsDeleted = 0
`);

// Issue session cookie
const sessionToken = jwt.sign({ userId, username, email, customerId });
res.cookie('authToken', sessionToken, { httpOnly: true });
```

## Authentication vs Authorization

### Authentication (Who are you?)
- **MojoPortal**: Initial user login
- **ConfigLauncher.ascx**: JWT generation
- **Vue Router**: JWT extraction from URL
- **Backend**: JWT validation → session cookie

### Authorization (What can you do?)
- **mp_Roles**: Role definitions (ConfigAdmin, MSPBEmployee)
- **mp_UserRoles**: User role assignments
- **Backend Middleware**: Role checking on protected routes
- **Frontend**: UI shows/hides based on user roles

## Files Changed from Original Design

### Removed
- `Login.vue` - No longer needed (auth from MojoPortal)
- Custom Users/Roles tables in schema.sql

### Added
- `mojoportal-launcher/ConfigLauncher.ascx`
- `mojoportal-launcher/Web.config.snippet`

### Modified
- `authController.js` - Added `authenticateFromMojo()`
- `auth.js` middleware - Query mp_Users/mp_UserRoles
- `api.js` routes - Changed `/auth/login` to `/auth/mojo-login`
- `router/index.js` - Extract JWT from URL parameter
- `auth.js` store - Changed `login()` to `authenticateFromMojo()`
- `schema.sql` - Removed custom user tables, added MojoPortal integration notes
- `.env.example` - Added MOJO_JWT_SECRET

## Security Considerations

### JWT Secret Management
- **CRITICAL**: Same secret in MojoPortal Web.config and backend .env
- Generate with: `openssl rand -base64 32`
- Never commit to source control
- Rotate periodically

### Token Transport
- JWT passed via URL parameter (one-time use)
- Immediately exchanged for HTTP-only cookie
- URL parameter removed after exchange
- Cookie: `httpOnly: true, secure: true (production), sameSite: 'lax'`

### Cross-Origin Considerations
- MojoPortal domain must be in ALLOWED_ORIGINS
- SameSite=lax allows cookie on navigation from MojoPortal
- Strict CORS validation on all API endpoints

### MFA Implementation
- TOTP secrets stored encrypted (consider adding encryption layer)
- 4-hour MFA session validity
- Re-prompt MFA on sensitive operations

## Development Workflow

1. **Start MojoPortal** (Visual Studio/IIS)
2. **Start Backend** (`npm run dev` in backend/)
3. **Start Frontend** (`npm run dev` in frontend/)
4. **Access**: Navigate to ConfigLauncher in MojoPortal
5. **Test**: Click launch button → Vue app opens in new tab

## Production Deployment

### MojoPortal
- Deploy ConfigLauncher.ascx to production site
- Update Web.config VueAppUrl to production URL
- Ensure JWT secret matches backend

### Backend
- Deploy Node.js app to server (PM2, Docker, etc.)
- Set environment variables
- Configure reverse proxy (nginx)
- Enable HTTPS

### Frontend  
- `npm run build`
- Deploy dist/ to CDN or static host
- Update backend ALLOWED_ORIGINS
- Configure domain (config.mspbuilder.com)

### Database
- Run schema.sql on production MojoPortal database
- Migrate existing configuration data
- Create production roles
- Assign user roles
