const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || process.env.MANAGER_AUTH_SECRET || 'paranjape_foods_jwt_secret_key_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Generate a JWT token for a customer
 */
function generateCustomerToken(customer) {
  return jwt.sign(
    {
      customerId: customer._id.toString(),
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
      role: 'customer',
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

/**
 * Verify customer JWT token
 */
function verifyCustomerToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Express Middleware: Require authenticated customer
 */
function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-customer-token'];
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please log in.',
      code: 'UNAUTHORIZED_CUSTOMER',
    });
  }

  const decoded = verifyCustomerToken(token);
  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.',
      code: 'INVALID_TOKEN',
    });
  }

  req.customer = decoded;
  next();
}

/**
 * Verify a Google ID token from frontend Google Identity Services
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required');
  }

  try {
    if (GOOGLE_CLIENT_ID) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      return ticket.getPayload();
    } else {
      // In development / before GOOGLE_CLIENT_ID is configured in environment,
      // verify against Google public certs without strict audience check
      const ticket = await googleClient.verifyIdToken({ idToken });
      return ticket.getPayload();
    }
  } catch (err) {
    logger.warn('[Auth] Google ID token verification failed:', err.message);
    throw new Error('Invalid Google credential: ' + err.message);
  }
}

/**
 * Generate a JWT token for a staff user (owner, manager, delivery)
 */
function generateStaffUserToken(staffUser) {
  return jwt.sign(
    {
      staffId: staffUser._id.toString(),
      name: staffUser.name,
      phone: staffUser.phone,
      role: staffUser.role,
      vehicleNumber: staffUser.vehicleNumber || '',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verify staff user JWT token
 */
function verifyStaffUserToken(token, allowedRoles = ['owner', 'manager', 'delivery']) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.staffId) return null;
    if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

module.exports = {
  JWT_SECRET,
  generateCustomerToken,
  verifyCustomerToken,
  requireCustomerAuth,
  verifyGoogleIdToken,
  generateStaffUserToken,
  verifyStaffUserToken,
};
