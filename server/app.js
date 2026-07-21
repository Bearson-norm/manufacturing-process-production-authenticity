const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const {
  requireAuth,
  requireRole,
  apiKeyAuth,
  authenticateLogin,
  resolveProductionTable,
} = require('./middleware/auth.middleware');
const config = require('./config');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // SPA + inline styles; tighten later with nonce if needed
  crossOriginEmbedderPolicy: false,
}));

// CORS — allowlist from CORS_ORIGIN (comma-separated). "*" only outside production/staging.
const isProdLike = config.nodeEnv === 'production' || config.nodeEnv === 'staging';
const corsOriginEnv = (config.corsOrigin || '*').trim();
let corsOrigin = corsOriginEnv;
if (corsOriginEnv === '*') {
  if (isProdLike) {
    console.warn('⚠️  CORS_ORIGIN=* is insecure; set explicit origins in production/staging');
  }
  corsOrigin = isProdLike ? false : true;
} else {
  const list = corsOriginEnv.split(',').map((o) => o.trim()).filter(Boolean);
  corsOrigin = list.length === 1 ? list[0] : list;
}

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

// Health check endpoint for Traefik and monitoring (public)
app.get('/health', (req, res) => {
  const { db } = require('./database');
  db.get('SELECT 1', (err) => {
    if (err) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        status: 'healthy',
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }
  });
});

// Favicon route
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

// Authentication endpoint (public, rate-limited)
app.post('/api/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const result = authenticateLogin(String(username).trim(), String(password));
    if (result.error) {
      const status = result.error.includes('must be set') ? 503 : 401;
      return res.status(status).json({ success: false, message: result.error === 'Invalid credentials' ? 'Invalid credentials' : result.error });
    }

    res.json({
      success: true,
      message: 'Login successful',
      role: result.role,
      username: result.username,
      token: result.token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// External / inbound APIs — API key only (no JWT)
app.use('/api/external', apiKeyAuth, require('./routes/external.routes'));
app.use('/api/receiver', apiKeyAuth, require('./routes/receiver.routes'));

// All other /api routes require JWT
app.use('/api', (req, res, next) => {
  // /api/login handled above; /api/external and /api/receiver handled above
  if (req.path === '/login' || req.path.startsWith('/external') || req.path.startsWith('/receiver')) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Admin routes — admin role only
app.use('/api/admin', requireRole('admin'), require('./routes/admin.routes').router);

// Load routes (authenticated)
app.use('/api/production', require('./routes/production.routes'));
app.use('/api/buffer', require('./routes/buffer.routes'));
app.use('/api/reject', require('./routes/reject.routes'));
app.use('/api/pic', require('./routes/pic.routes'));
app.use('/api/authenticity-vendors', require('./routes/authenticity-vendor.routes'));
app.use('/api/odoo', require('./routes/odoo.routes'));
app.use('/api/statistics', require('./routes/statistics.routes'));
app.use('/api/reports', requireRole('admin'), require('./routes/reports.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/wms', requireRole('admin'), require('./routes/wms.routes'));

// Alias for backward compatibility - /api/combined-production
app.get('/api/combined-production', (req, res) => {
  const { db } = require('./database');
  const { parseAuthenticityData } = require('./utils/authenticity.utils');
  const { mo_number, production_type, start_date, end_date } = req.query;

  const tables = [];
  if (!production_type || production_type === 'all' || production_type === 'liquid') {
    tables.push({ name: 'production_liquid', type: 'liquid' });
  }
  if (!production_type || production_type === 'all' || production_type === 'device') {
    tables.push({ name: 'production_device', type: 'device' });
  }
  if (!production_type || production_type === 'all' || production_type === 'cartridge') {
    tables.push({ name: 'production_cartridge', type: 'cartridge' });
  }

  if (production_type && production_type !== 'all') {
    const resolved = resolveProductionTable(production_type);
    if (!resolved && production_type !== 'all') {
      return res.status(400).json({
        success: false,
        error: 'Invalid production type',
      });
    }
  }

  const allResults = [];
  let completedQueries = 0;

  tables.forEach((table) => {
    let query = `SELECT *, '${table.type}' as production_type FROM ${table.name} WHERE 1=1`;
    const params = [];

    if (mo_number) {
      query += ` AND mo_number = $${params.length + 1}`;
      params.push(mo_number);
    }

    if (start_date) {
      query += ` AND DATE(created_at) >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(created_at) <= $${params.length + 1}`;
      params.push(end_date);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error querying ${table.name}:`, err);
      } else {
        const parsedRows = rows.map((row) => parseAuthenticityData(row));
        allResults.push(...parsedRows);
      }

      completedQueries++;

      if (completedQueries === tables.length) {
        allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({
          success: true,
          count: allResults.length,
          data: allResults,
        });
      }
    });
  });

  if (tables.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid production type',
    });
  }
});

// Serve static files AFTER all API routes (only for non-API routes)
const clientBuildPath = path.join(__dirname, '../client-build');
const clientPublicPath = path.join(__dirname, '../client/public');

let staticPath;
if (fs.existsSync(clientBuildPath) && fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  staticPath = clientBuildPath;
  console.log('📦 Serving static files from client-build (production)');
} else if (fs.existsSync(clientPublicPath)) {
  staticPath = clientPublicPath;
  console.log('🔧 Serving static files from client/public (development)');
} else {
  console.warn('⚠️  Warning: Neither client-build nor client/public directory found!');
  staticPath = clientBuildPath;
}

const staticMiddleware = express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'development') {
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  },
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  staticMiddleware(req, res, next);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  if (req.path.startsWith('/static/')) {
    return next();
  }

  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      success: false,
      error: 'Route not found',
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
