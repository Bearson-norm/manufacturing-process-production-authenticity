const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint for Traefik and monitoring
app.get('/health', (req, res) => {
  const { db } = require('./database');
  db.get('SELECT 1', (err) => {
    if (err) {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({ 
        status: 'healthy', 
        database: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Favicon route
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Authentication endpoint
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    
    // Admin credentials
    if (username === 'admin' && password === 'admin123') {
      res.json({ success: true, message: 'Login successful', role: 'admin' });
    }
    // Production credentials
    else if (username === 'production' && password === 'production123') {
      res.json({ success: true, message: 'Login successful', role: 'production' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Load routes
app.use('/api/production', require('./routes/production.routes'));
app.use('/api/buffer', require('./routes/buffer.routes'));
app.use('/api/reject', require('./routes/reject.routes'));
app.use('/api/external', require('./routes/external.routes'));
app.use('/api/admin', require('./routes/admin.routes').router);
app.use('/api/pic', require('./routes/pic.routes'));
app.use('/api/odoo', require('./routes/odoo.routes'));
app.use('/api/statistics', require('./routes/statistics.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/search', require('./routes/search.routes'));
app.use('/api/receiver', require('./routes/receiver.routes'));

// Alias for backward compatibility - /api/combined-production
// This endpoint combines data from all production types (liquid, device, cartridge)
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
        const parsedRows = rows.map(row => parseAuthenticityData(row));
        allResults.push(...parsedRows);
      }
      
      completedQueries++;
      
      if (completedQueries === tables.length) {
        allResults.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({
          success: true,
          count: allResults.length,
          data: allResults
        });
      }
    });
  });
  
  if (tables.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid production type'
    });
  }
});

// Serve static files AFTER all API routes (only for non-API routes)
const clientBuildPath = path.join(__dirname, '../client-build');
const clientPublicPath = path.join(__dirname, '../client/public');

// Check which path exists (production build or development)
let staticPath;
if (fs.existsSync(clientBuildPath) && fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  staticPath = clientBuildPath;
  console.log('📦 Serving static files from client-build (production)');
} else if (fs.existsSync(clientPublicPath)) {
  staticPath = clientPublicPath;
  console.log('🔧 Serving static files from client/public (development)');
} else {
  console.warn('⚠️  Warning: Neither client-build nor client/public directory found!');
  staticPath = clientBuildPath; // Default to production path
}

const staticMiddleware = express.static(staticPath, {
  setHeaders: (res, filePath) => {
    // Disable cache for HTML files
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Disable cache for JS and CSS files in staging
    if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'development') {
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }
});

app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Serve static files for non-API routes
  staticMiddleware(req, res, next);
});

// Serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res, next) => {
  // Skip for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip for static files
  if (req.path.startsWith('/static/')) {
    return next();
  }
  
  // Serve index.html for SPA routing
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If index.html doesn't exist, return 404
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
  }
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
