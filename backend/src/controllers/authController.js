const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { queryMojo } = require('../config/database');

authenticator.options = {
  window: parseInt(process.env.MFA_WINDOW || '2')
};

// Azure MFA API helper
async function callAzureMfaApi(clientId, user, totp = null) {
  const url = new URL(`${process.env.MIDDLEWARE_URI_AZURE}/api/mfa`);
  url.searchParams.set('code', process.env.MIDDLEWARE_AZURE_MFA_AUTH);
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('user', user);
  if (totp) {
    url.searchParams.set('totp', totp);
  }

  const fullUrl = url.toString();
  console.log('=== AZURE MFA API CALL ===');
  console.log('URL:', fullUrl);
  console.log('Auth Code:', process.env.MIDDLEWARE_AZURE_MFA_AUTH ? 'SET' : 'NOT SET');

  try {
    const response = await fetch(fullUrl);
    
    console.log('HTTP Status:', response.status);
    console.log('HTTP Status Text:', response.statusText);
    
    const text = await response.text();
    console.log('Response Body:', text);
    console.log('Response Body Length:', text.length);
    
    // Handle empty or "no data" responses
    if (!text || text.trim() === '' || text.toLowerCase().includes('no data')) {
      console.log('Returning noData=true');
      return { noData: true };
    }
    
    const data = JSON.parse(text);
    console.log('Parsed JSON:', JSON.stringify(data));
    
    if (data.errorMsg) {
      throw new Error(data.errorMsg);
    }
    
    return data;
  } catch (error) {
    console.error('Azure MFA API error:', error.message);
    throw error;
  }
}

async function authenticateFromMojo(req, res) {
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
      return res.status(401).json({ error: 'User not found in MojoPortal' });
    }
    
    const user = result.recordset[0];
    
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
      const mfaData = await callAzureMfaApi('GetSetMfa', user.LoginName);
      hasMfa = mfaData && mfaData.key && !mfaData.noData;
    } catch (error) {
      console.log('MFA check failed, proceeding without MFA:', error.message);
    }
    
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000
    });
console.log('=== AUTH RESPONSE ===');
console.log('hasMfa:', hasMfa);
console.log('Response:', JSON.stringify({
  success: true,
  requireMfa: hasMfa,
  user: {
    username: user.LoginName,
    email: user.Email,
    displayName: user.DisplayName,
    customerId: user.CustomerID
  }
}));    


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
    console.error('MojoPortal auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

async function generateMfa(req, res) {
  try {
    const username = req.user.username;

    // Call Azure API to check if MFA exists
    const mfaData = await callAzureMfaApi('GetSetMfa', username);

    if (mfaData.noData || !mfaData.key) {
      // Generate new secret and save to Azure
      const secret = authenticator.generateSecret();
      await callAzureMfaApi('SetMfa', username, secret);

      // Generate QR code
      const otpauth = authenticator.keyuri(username, process.env.MFA_ISSUER, secret);
      const qrCode = await QRCode.toDataURL(otpauth);

      return res.json({
        needsSetup: true,
        secret,
        qrCode,
        issuer: process.env.MFA_ISSUER
      });
    }

    // User already has MFA - don't return QR code, just confirm
    res.json({
      needsSetup: false,
      exists: true
    });
  } catch (error) {
    console.error('MFA generation error:', error);
    res.status(500).json({ error: 'Failed to generate MFA' });
  }
}

async function verifyMfa(req, res) {
  try {
    const { token: totpToken } = req.body;
    const username = req.user.username;
    
    if (!totpToken) {
      return res.status(400).json({ error: 'MFA token required' });
    }
    
    // Get MFA secret from Azure API
    const mfaData = await callAzureMfaApi('GetSetMfa', username);
    
    if (mfaData.noData || !mfaData.key) {
      return res.status(400).json({ error: 'MFA not configured' });
    }
    
    // Verify TOTP
    const isValid = authenticator.verify({
      token: totpToken,
      secret: mfaData.key
    });
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }
    
    // Update last auth time via Azure API (call SetMfa with current timestamp)
    try {
      await callAzureMfaApi('UpdateMfaAuth', username, new Date().toISOString());
    } catch (error) {
      console.log('Failed to update MFA auth time:', error.message);
    }
    
    // Set MFA verified cookie
    res.cookie('mfaVerified', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
}

async function logout(req, res) {
  res.clearCookie('authToken');
  res.clearCookie('mfaVerified');
  res.json({ success: true });
}

async function checkAuth(req, res) {
  const mfaVerified = req.cookies.mfaVerified === 'true';
  
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
