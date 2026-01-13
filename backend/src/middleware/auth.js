const jwt = require('jsonwebtoken');
const { queryMojo, queryConfig } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

async function authenticate(req, res, next) {
  const reqLog = req.log || log;
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
      reqLog.warn('Invalid user attempted access', { userId: decoded.userId });
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
    reqLog.error('Authentication error', { err: error.message });
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

    // Ensure MFA token belongs to the authenticated user (prevents token theft)
    if (decoded.username !== req.user.username) {
      return res.status(403).json({ error: 'MFA token mismatch', requireMfa: true });
    }

    // Ensure the token has mfaVerified claim
    if (!decoded.mfaVerified) {
      return res.status(403).json({ error: 'Invalid MFA token', requireMfa: true });
    }

    req.mfaVerified = true;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'MFA session expired', requireMfa: true });
    }
    return res.status(403).json({ error: 'MFA verification failed', requireMfa: true });
  }
}

// Fetch user roles and attach to request (for SQL echo in read-only mode)
// This does not enforce any role requirements, just populates req.userRoles
async function fetchUserRoles(req, res, next) {
  const reqLog = req.log || log;
  try {
    // Skip if roles already fetched
    if (req.userRoles) {
      return next();
    }

    const result = await queryMojo(
      `SELECT r.RoleName, r.DisplayName
       FROM mp_UserRoles ur
       JOIN mp_Roles r ON ur.RoleID = r.RoleID
       WHERE ur.UserID = @userId`,
      { userId: req.user.userId }
    );

    req.userRoles = result.recordset.map(r => r.RoleName);
    next();
  } catch (error) {
    reqLog.error('Fetch roles error', { err: error.message, userId: req.user.userId });
    // Don't fail the request, just set empty roles
    req.userRoles = [];
    next();
  }
}

async function requireRole(roles = []) {
  return async (req, res, next) => {
    const reqLog = req.log || log;
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
        reqLog.warn('Insufficient permissions', { username: req.user.username, requiredRoles: roles, userRoles });
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.userRoles = userRoles;
      next();
    } catch (error) {
      reqLog.error('Role check error', { err: error.message, userId: req.user.userId });
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = {
  authenticate,
  requireMFA,
  fetchUserRoles,
  requireRole
};
