const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../database');

const VALID_PRODUCTION_TYPES = Object.freeze(['liquid', 'device', 'cartridge']);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && String(secret).trim()) {
    return String(secret).trim();
  }
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
    return null;
  }
  // Dev-only fallback so local `npm run dev` works without a full .env
  return 'dev-only-insecure-jwt-secret-change-me';
}

function getAuthUsers() {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const productionUser = process.env.PRODUCTION_USERNAME || 'production';
  const adminPass = process.env.ADMIN_PASSWORD;
  const productionPass = process.env.PRODUCTION_PASSWORD;
  const isProdLike = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  if (isProdLike && (!adminPass || !productionPass)) {
    return { error: 'ADMIN_PASSWORD and PRODUCTION_PASSWORD must be set in production/staging' };
  }

  return {
    users: [
      {
        username: adminUser,
        password: adminPass || 'admin123',
        role: 'admin',
      },
      {
        username: productionUser,
        password: productionPass || 'production123',
        role: 'production',
      },
    ],
  };
}

function assertAuthConfigOrThrow() {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET must be set when NODE_ENV is production or staging');
  }
  const { error } = getAuthUsers();
  if (error) {
    throw new Error(error);
  }
}

function signToken(payload) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (typeof stored === 'string' && stored.startsWith('$2')) {
    return bcrypt.compareSync(plain, stored);
  }
  return plain === stored;
}

function authenticateLogin(username, password) {
  const { users, error } = getAuthUsers();
  if (error) {
    return { error };
  }
  const user = users.find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.password)) {
    return { error: 'Invalid credentials' };
  }
  const token = signToken({ sub: user.username, role: user.role });
  return { token, role: user.role, username: user.username };
}

function getApiKey(callback) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['api_key'], (err, row) => {
    if (err) {
      console.error('Error fetching API key:', err);
      return callback(err, null);
    }
    callback(null, row ? row.config_value : null);
  });
}

function extractBearerOrApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return { type: 'apiKey', value: String(headerKey) };
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return { type: 'bearer', value: auth.slice(7).trim() };
  }
  return null;
}

/** Require JWT for browser/app APIs */
function requireAuth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(503).json({
      success: false,
      error: 'Authentication is not configured (JWT_SECRET missing)',
    });
  }

  const extracted = extractBearerOrApiKey(req);
  if (!extracted || extracted.type !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide Authorization: Bearer <token>.',
    });
  }

  try {
    const decoded = jwt.verify(extracted.value, secret);
    req.user = {
      username: decoded.sub || decoded.username,
      role: decoded.role,
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: insufficient role',
      });
    }
    return next();
  };
}

/**
 * External API key auth.
 * Fail-closed in production/staging when no key is configured.
 */
function apiKeyAuth(req, res, next) {
  const isProdLike = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  getApiKey((err, storedApiKey) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Failed to verify API key' });
    }

    if (!storedApiKey) {
      if (isProdLike) {
        return res.status(503).json({
          success: false,
          error: 'API key is not configured. External API is disabled until an API key is set.',
        });
      }
      // Development only: allow without key for local testing
      return next();
    }

    const extracted = extractBearerOrApiKey(req);
    const apiKey = extracted ? extracted.value : null;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required. Please provide X-API-Key header or Authorization Bearer token.',
      });
    }

    if (apiKey !== storedApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    req.authType = 'apiKey';
    return next();
  });
}

function resolveProductionTable(productionType, defaultType = 'liquid') {
  const type = String(productionType || defaultType).toLowerCase();
  if (!VALID_PRODUCTION_TYPES.includes(type)) {
    return null;
  }
  return { type, table: `production_${type}` };
}

module.exports = {
  apiKeyAuth,
  getApiKey,
  requireAuth,
  requireRole,
  authenticateLogin,
  assertAuthConfigOrThrow,
  getJwtSecret,
  signToken,
  resolveProductionTable,
  VALID_PRODUCTION_TYPES,
};
