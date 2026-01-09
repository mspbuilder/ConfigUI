const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { queryMojo } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

authenticator.options = {
  window: parseInt(process.env.MFA_WINDOW || '2')
};

// Azure MFA API helper
// Operations:
//   - GetSetMfa (GET): Fetch existing MFA key for user
//   - SetMfa (POST): Save new MFA key for user
//   - UpdateMfaAuth (POST): Update last_auth timestamp for user
async function callAzureMfaApi(operation, user, secret = null, reqLog = log) {
  const url = new URL(`${process.env.MIDDLEWARE_URI_AZURE}/api/mfa`);
  url.searchParams.set('code', process.env.MIDDLEWARE_AZURE_MFA_AUTH);
  url.searchParams.set('user', user);

  const isGet = operation === 'GetSetMfa';
  const isTimestampUpdate = operation === 'UpdateMfaAuth';

  if (isTimestampUpdate) {
    url.searchParams.set('timeStampOnly', 'true');
  }

  const method = isGet ? 'GET' : 'POST';
  reqLog.info('Azure MFA API call', { operation, user, method });

  try {
    const fetchOptions = isGet
      ? { method: 'GET' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, secret })
        };

    const response = await fetch(url.toString(), fetchOptions);
    const text = await response.text();

    reqLog.debug('Azure MFA API response', {
      operation,
      status: response.status,
      bodyLength: text.length
    });

    // Handle empty or "OK" responses (POST success)
    if (!text || text.trim() === '' || text.trim() === '"OK"' || text.trim() === 'OK') {
      return { success: true };
    }

    // Handle plain text "no data" responses
    if (text.toLowerCase().includes('no data') && !text.startsWith('{')) {
      return { noData: true };
    }

    const data = JSON.parse(text);

    // Handle "No data" response from Azure as a valid "no MFA configured" state
    if (data.errorMsg) {
      if (data.errorMsg.toLowerCase().includes('no data')) {
        reqLog.debug('User has no MFA configured', { user });
        return { noData: true };
      }
      throw new Error(data.errorMsg);
    }

    return data;
  } catch (error) {
    reqLog.error('Azure MFA API error', { operation, user, err: error.message });
    throw error;
  }
}

async function authenticateFromMojo(req, res) {
  const reqLog = req.log || log;
  try {
    const { mojoToken } = req.body;

    if (!mojoToken) {
      return res.status(400).json({ error: 'MojoPortal token required' });
    }

    // Verify and decode MojoPortal JWT
    let mojoUser;
    try {
      mojoUser = jwt.verify(mojoToken, process.env.MOJO_JWT_SECRET || process.env.JWT_SECRET);
    } catch (error) {
      reqLog.warn('Invalid MojoPortal token', { err: error.message });
      return res.status(401).json({ error: 'Invalid MojoPortal token' });
    }

    // Look up user in MojoPortal database using existing view
    const result = await queryMojo(
      `SELECT u.UserID, u.LoginName, u.Email, u.Name as DisplayName, uc.CID as CustomerID
       FROM mp_Users u
       LEFT JOIN users_cid uc ON uc.LoginName = u.LoginName
       WHERE u.UserID = @userId AND u.IsDeleted = 0`,
      { userId: mojoUser.userId }
    );

    if (result.recordset.length === 0) {
      reqLog.warn('User not found in MojoPortal', { userId: mojoUser.userId });
      return res.status(401).json({ error: 'User not found in MojoPortal' });
    }

    const user = result.recordset[0];
    reqLog.info('User authenticated from MojoPortal', {
      username: user.LoginName,
      customerId: user.CustomerID
    });

    // Generate our app's JWT token
    const token = jwt.sign(
      {
        username: user.LoginName,
        userId: user.UserID,
        email: user.Email,
        customerId: user.CustomerID
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    // Check if user has MFA setup via Azure API
    let hasMfa = false;
    try {
      const mfaData = await callAzureMfaApi('GetSetMfa', user.LoginName, null, reqLog);
      hasMfa = mfaData && mfaData.key && !mfaData.noData;
    } catch (error) {
      reqLog.warn('MFA check failed, proceeding without MFA', { err: error.message });
    }

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 4 * 60 * 60 * 1000
    });

    reqLog.info('Auth response', { username: user.LoginName, hasMfa });

    res.json({
      success: true,
      requireMfa: hasMfa,
      user: {
        username: user.LoginName,
        email: user.Email,
        displayName: user.DisplayName,
        customerId: user.CustomerID
      }
    });
  } catch (error) {
    reqLog.error('MojoPortal auth error', { err: error.message, stack: error.stack });
    res.status(500).json({ error: 'Authentication failed' });
  }
}

async function generateMfa(req, res) {
  const reqLog = req.log || log;
  try {
    const username = req.user.username;

    // Call Azure API to check if MFA exists
    const mfaData = await callAzureMfaApi('GetSetMfa', username, null, reqLog);

    if (mfaData.noData || !mfaData.key) {
      // Generate new secret and save to Azure
      const secret = authenticator.generateSecret();
      await callAzureMfaApi('SetMfa', username, secret, reqLog);

      // Generate QR code
      const otpauth = authenticator.keyuri(username, process.env.MFA_ISSUER, secret);
      const qrCode = await QRCode.toDataURL(otpauth);

      reqLog.info('MFA setup initiated', { username });

      return res.json({
        needsSetup: true,
        secret,
        qrCode,
        issuer: process.env.MFA_ISSUER
      });
    }

    // User already has MFA - don't return QR code, just confirm
    reqLog.info('MFA already configured', { username });
    res.json({
      needsSetup: false,
      exists: true
    });
  } catch (error) {
    reqLog.error('MFA generation error', { err: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to generate MFA' });
  }
}

async function verifyMfa(req, res) {
  const reqLog = req.log || log;
  try {
    const { token: totpToken } = req.body;
    const username = req.user.username;

    if (!totpToken) {
      return res.status(400).json({ error: 'MFA token required' });
    }

    // Get MFA secret from Azure API
    const mfaData = await callAzureMfaApi('GetSetMfa', username, null, reqLog);

    if (mfaData.noData || !mfaData.key) {
      reqLog.warn('MFA not configured for user', { username });
      return res.status(400).json({ error: 'MFA not configured' });
    }

    // Verify TOTP
    const isValid = authenticator.verify({
      token: totpToken,
      secret: mfaData.key
    });

    if (!isValid) {
      reqLog.warn('Invalid MFA token attempt', { username });
      return res.status(401).json({ error: 'Invalid MFA token' });
    }

    // Update last auth time via Azure API (pass the mfa_key for record matching)
    try {
      await callAzureMfaApi('UpdateMfaAuth', username, mfaData.key, reqLog);
    } catch (error) {
      reqLog.warn('Failed to update MFA auth time', { username, err: error.message });
    }

    // Set MFA verified cookie as signed JWT (not spoofable like a boolean)
    const mfaToken = jwt.sign(
      {
        username: req.user.username,
        mfaVerified: true,
        verifiedAt: new Date().toISOString()
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    res.cookie('mfaToken', mfaToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 4 * 60 * 60 * 1000
    });

    reqLog.info('MFA verification successful', { username });

    res.json({ success: true });
  } catch (error) {
    reqLog.error('MFA verification error', { err: error.message, stack: error.stack });
    res.status(500).json({ error: 'MFA verification failed' });
  }
}

async function logout(req, res) {
  const reqLog = req.log || log;
  reqLog.info('User logged out', { username: req.user?.username });
  res.clearCookie('authToken', { path: '/' });
  res.clearCookie('mfaToken', { path: '/' });
  res.json({ success: true });
}

async function checkAuth(req, res) {
  const reqLog = req.log || log;
  // Verify MFA token is a valid signed JWT for this user (not spoofable)
  let mfaVerified = false;
  const mfaToken = req.cookies.mfaToken;

  if (mfaToken) {
    try {
      const decoded = jwt.verify(mfaToken, process.env.JWT_SECRET);
      // Ensure the MFA token belongs to the same user as the auth token
      mfaVerified = decoded.mfaVerified && decoded.username === req.user.username;
    } catch (error) {
      // Invalid or expired MFA token
      mfaVerified = false;
    }
  }

  reqLog.debug('Auth check', { username: req.user.username, mfaVerified });

  res.json({
    authenticated: true,
    mfaVerified,
    user: {
      username: req.user.username,
      email: req.user.email,
      customerId: req.user.customerId
    }
  });
}

module.exports = {
  authenticateFromMojo,
  generateMfa,
  verifyMfa,
  logout,
  checkAuth
};
