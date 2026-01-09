# MSPBuilder Configuration Manager - Vue 3 SPA

Standalone Vue 3 Single Page Application with Node.js REST API, converted from MojoPortal ASCX module.

## Architecture

- **Frontend**: Vue 3 SPA with Vite
- **Backend**: Node.js with Express REST API
- **Database**: Microsoft SQL Server (MojoPortal database)
- **Authentication**: JWT tokens from MojoPortal launcher ASCX
- **MFA**: TOTP (Time-based One-Time Password)

## Authentication Flow

1. User accesses ConfigLauncher.ascx in MojoPortal
2. ASCX queries MojoPortal user from `mp_Users` table
3. ASCX generates JWT token with user info
4. ASCX opens Vue app in new tab with JWT in URL parameter
5. Vue app exchanges JWT for session cookie
6. User prompted for MFA if configured
7. User accesses configuration manager

**Key Point**: This app does NOT have its own login page. Users must launch it from MojoPortal.

## Project Structure

```
config-manager/
├── mojoportal-launcher/
│   ├── ConfigLauncher.ascx       # MojoPortal module (generates JWT, opens Vue app)
│   └── Web.config.snippet        # Config settings for MojoPortal
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js         # SQL Server connection
│   │   ├── controllers/
│   │   │   ├── authController.js   # JWT validation, MFA
│   │   │   └── configController.js # Configuration CRUD
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT auth & role checking
│   │   ├── routes/
│   │   │   └── api.js              # API routes
│   │   └── server.js               # Express server
│   ├── .env.example
│   ├── package.json
│   └── schema.sql                  # Database schema
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── MFA.vue             # MFA verification
    │   │   └── ConfigManager.vue   # Main config interface
    │   ├── stores/
    │   │   ├── auth.js             # Pinia auth store
    │   │   └── config.js           # Pinia config store
    │   ├── router/
    │   │   └── index.js            # Vue Router (handles JWT from URL)
    │   ├── services/
    │   │   └── api.js              # Axios API client
    │   ├── App.vue
    │   ├── main.js
    │   └── style.css
    ├── index.html
    ├── package.json
    └── vite.config.js

```

## Installation

### Prerequisites
- Node.js 18+
- SQL Server 2016+ (with MojoPortal database)
- MojoPortal CMS installed and running
- npm or yarn

### MojoPortal Setup

1. Add to MojoPortal Web.config `<appSettings>`:
```xml
<add key="VueAppUrl" value="http://localhost:5173" />
<add key="JwtSecret" value="generate-secure-random-string-here" />
```

2. Copy ConfigLauncher.ascx to MojoPortal:
```
/Data/Sites/[YourSiteID]/skins/[YourSkin]/ConfigLauncher.ascx
```

3. Create roles in MojoPortal Admin → Security → Role Manager:
   - ConfigAdmin
   - MSPBEmployee

4. Assign roles to users who need config access

5. Add ConfigLauncher to a page:
   - Create new page or edit existing
   - Add HTML Content module
   - Reference the ASCX file

**No NuGet packages needed** - ConfigLauncher uses only built-in .NET Framework libraries (System.Security.Cryptography for HMAC-SHA256).

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env:
# - Set MOJO_DB_DATABASE to your MojoPortal database name
# - Set CONFIG_DB_DATABASE to your Configurations database name
# - Set JWT_SECRET to match MojoPortal Web.config JwtSecret
# - Set MOJO_JWT_SECRET to same value as JWT_SECRET
# - Configure database credentials
```

3. Verify database tables exist:
   - MojoPortal DB: `mp_Users`, `mp_Roles`, `mp_UserRoles`, `mp_UserProperties`
   - Configurations DB: `UserMfa`, `Configurations`

4. Start server:
```bash
npm run dev  # Development
npm start    # Production
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Configuration

### MojoPortal Web.config

```xml
<appSettings>
  <!-- Vue app URL - update for production -->
  <add key="VueAppUrl" value="http://localhost:5173" />
  <!-- Production: https://config.mspbuilder.com -->
  
  <!-- JWT Secret - MUST match backend .env -->
  <add key="JwtSecret" value="your-super-secret-jwt-key-change-this" />
</appSettings>
```

### Backend Environment Variables (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# MojoPortal Database (for user authentication)
MOJO_DB_SERVER=localhost
MOJO_DB_DATABASE=MojoPortal
MOJO_DB_USER=sa
MOJO_DB_PASSWORD=yourpassword
MOJO_DB_PORT=1433

# Configurations Database (for config data and MFA)
CONFIG_DB_SERVER=localhost
CONFIG_DB_DATABASE=Configurations
CONFIG_DB_USER=sa
CONFIG_DB_PASSWORD=yourpassword
CONFIG_DB_PORT=1433

# JWT - MUST match MojoPortal Web.config JwtSecret
JWT_SECRET=your-super-secret-jwt-key-change-this
MOJO_JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=4h

# MFA
MFA_ISSUER=MSPBuilder
MFA_WINDOW=2

# CORS (include MojoPortal domain)
ALLOWED_ORIGINS=http://localhost:5173,https://www.mspbuilder.com
```

### Database Architecture

**Two Separate Databases:**

1. **MojoPortal Database** (existing)
   - `mp_Users` - User accounts
   - `mp_Roles` - Role definitions  
   - `mp_UserRoles` - User-to-role assignments
   - `mp_UserProperties` - CustomerID in Comment field

2. **Configurations Database** (existing)
   - `UserMfa` - TOTP secrets (already exists)
   - `Configurations` - Config data (already exists)
   - All other config-related tables

## API Endpoints

### Authentication
- `POST /api/auth/mojo-login` - Exchange MojoPortal JWT for session
- `POST /api/auth/logout` - Logout and clear cookies
- `GET /api/auth/check` - Check authentication status
- `POST /api/auth/mfa/generate` - Generate MFA QR code
- `POST /api/auth/mfa/verify` - Verify MFA token

### Configurations (requires auth + MFA)
- `GET /api/configs` - Get configurations with filters
- `PUT /api/configs/:id` - Update configuration value
- `POST /api/configs` - Create new configuration
- `DELETE /api/configs/:id` - Delete custom configuration

### Dropdowns (requires auth + MFA)
- `GET /api/categories?customerId=X` - Get categories
- `GET /api/organizations?customerId=X` - Get organizations
- `GET /api/sites?customerId=X&organization=Y` - Get sites
- `GET /api/agents?customerId=X&organization=Y&site=Z` - Get agents

## Features

### Security
- JWT-based authentication with HTTP-only cookies
- TOTP multi-factor authentication
- Rate limiting (100 requests/15 minutes)
- Helmet.js security headers
- bcrypt password hashing
- Role-based access control

### Configuration Management
- Hierarchical configuration levels (Default → Org → Site → Agent)
- Category-based organization
- Custom vs. default task differentiation
- Bulk update capabilities
- Tooltips and help text

### User Interface
- Responsive Vue 3 SPA
- Dropdown filters for navigation
- Real-time configuration editing
- QR code MFA setup
- 6-digit OTP input with auto-advance

## Conversion from ASCX

### Key Changes

1. **Authentication**:
   - MojoPortal inline auth → JWT token passing
   - `Request.ServerVariables["LOGON_USER"]` → JWT claims
   - Direct mp_Users query → JWT validation
   - ASCX launcher generates JWT → Vue app validates

2. **Data Access**:
   - C# inline SQL → Node.js with mssql library
   - Page_Load events → API endpoints
   - ViewState → Pinia reactive stores
   - Direct mp_Users/mp_UserRoles queries → Maintained

3. **UI Framework**:
   - ASP.NET WebForms → Vue 3 SPA
   - Server-side controls → Vue components
   - Postback model → REST API calls
   - UpdatePanel → Axios + reactive state

4. **State Management**:
   - Cookies → Pinia stores + JWT
   - Session state → Client-side state
   - ViewState → Component reactive data

5. **MojoPortal Integration**:
   - Original: Embedded ASCX module
   - New: Launcher ASCX + separate Vue app
   - User management: Still in MojoPortal admin
   - Roles: Defined in mp_Roles, checked via API

## Development

### Running in Development

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Terminal 3 (MojoPortal):
```bash
# Run MojoPortal from Visual Studio or IIS
# Access: http://localhost/mojoportal
```

### Usage Flow

1. Login to MojoPortal
2. Navigate to page with ConfigLauncher module
3. Click "Launch Configuration Manager" button
4. Vue app opens in new tab with automatic authentication
5. Complete MFA if configured
6. Manage configurations

### Accessing Without MojoPortal (Development Only)

For testing, you can manually create a JWT:

```javascript
// In browser console on http://localhost:5173
const token = 'eyJ...' // Get from MojoPortal launcher
window.location.href = `/?token=${token}`
```

### Production Deployment

1. Build frontend:
```bash
cd frontend
npm run build
```

2. Serve static files from backend or use nginx:
```nginx
server {
    listen 80;
    server_name config.mspbuilder.com;
    
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Considerations

1. **Change default passwords** in schema.sql
2. **Use strong JWT_SECRET** (generate with `openssl rand -base64 32`)
3. **Enable HTTPS** in production
4. **Configure CORS** properly for production domains
5. **Set secure cookies** (secure: true, sameSite: 'strict')
6. **Implement rate limiting** per user (not just IP)
7. **Add SQL injection protection** via parameterized queries
8. **Enable audit logging** for config changes
9. **Regular password rotation** policy
10. **MFA backup codes** for account recovery

## Migration Guide

1. Install launcher ASCX in MojoPortal
2. Configure Web.config with JWT secret
3. Verify required database tables exist:
   - MojoPortal DB: `mp_Users`, `mp_Roles`, `mp_UserRoles`, `mp_UserProperties`
   - Configurations DB: `UserMfa`, `Configurations`
4. Create ConfigAdmin/MSPBEmployee roles in MojoPortal if they don't exist
5. Assign roles to appropriate users
6. Deploy Vue app to hosting
7. Update VueAppUrl in Web.config
8. Test authentication flow
9. Verify configuration data integrity

## Troubleshooting

**"Not authenticated" alert when opening Vue app:**
- Verify JWT_SECRET matches in MojoPortal Web.config and backend .env
- Check browser console for JWT errors
- Ensure user is logged into MojoPortal
- Verify ConfigLauncher.ascx has correct VueAppUrl

**Database connection fails:**
- Verify SQL Server is running
- Check DB_DATABASE name matches MojoPortal database
- Ensure TCP/IP is enabled in SQL Server Configuration
- Test connection string

**MFA not working:**
- Verify system time is synchronized
- Check MFA_WINDOW setting (increase if needed)
- Ensure HTTPS for QR code scanning

**CORS errors:**
- Add MojoPortal domain to ALLOWED_ORIGINS in .env
- Verify frontend proxy in vite.config.js
- Check browser console for specific origin

**Role permissions not working:**
- Verify roles exist in mp_Roles table
- Check user has role in mp_UserRoles
- Role names are case-sensitive
- Look for role names in backend logs

**ConfigLauncher button does nothing:**
- Check browser popup blocker
- Verify VueAppUrl is accessible
- Check browser console for JavaScript errors
- Ensure NuGet packages are installed

## License

Proprietary - MSPBuilder

## Support

For assistance: support@mspbuilder.com
