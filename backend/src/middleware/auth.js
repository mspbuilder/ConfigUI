const jwt = require('jsonwebtoken');
const { queryMojo, queryConfig } = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active in MojoPortal
    const result = await queryMojo(
      'SELECT UserID, LoginName, Email, Name FROM mp_Users WHERE UserID = @userId AND IsDeleted = 0',
      { userId: decoded.userId }
    );
    
    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    
    req.user = {
      username: decoded.username,
      userId: decoded.userId,
      email: decoded.email,
      customerId: decoded.customerId
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

async function requireMFA(req, res, next) {
  try {
    const mfaToken = req.cookies.mfaToken;
    
    if (!mfaToken) {
      return res.status(403).json({ error: 'MFA required', requireMfa: true });
    }
    
    const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
    
    // Check if MFA token is still valid (4 hours)
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp - now < 0) {
      return res.status(403).json({ error: 'MFA expired', requireMfa: true });
    }
    
    req.mfaVerified = true;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'MFA verification failed', requireMfa: true });
  }
}

async function requireRole(roles = []) {
  return async (req, res, next) => {
    try {
      // Query MojoPortal's role system
      const result = await queryMojo(
        `SELECT r.RoleName, r.DisplayName
         FROM mp_UserRoles ur 
         JOIN mp_Roles r ON ur.RoleID = r.RoleID 
         WHERE ur.UserID = @userId`,
        { userId: req.user.userId }
      );
      
      const userRoles = result.recordset.map(r => r.RoleName);
      
      // Check for required roles
      const hasRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      req.userRoles = userRoles;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = {
  authenticate,
  requireMFA,
  requireRole
};
