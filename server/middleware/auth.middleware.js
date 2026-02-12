const { db } = require('../database');

// Helper function to get API key from database
function getApiKey(callback) {
  db.get('SELECT config_value FROM admin_config WHERE config_key = ?', ['api_key'], (err, row) => {
    if (err) {
      console.error('Error fetching API key:', err);
      return callback(null, null);
    }
    const apiKey = row ? row.config_value : null;
    callback(null, apiKey);
  });
}

// Middleware for API key authentication
function apiKeyAuth(req, res, next) {
  getApiKey((err, storedApiKey) => {
    if (err || !storedApiKey) {
      // If no API key is configured, allow access (backward compatibility)
      // In production, you might want to require API key
      return next();
    }
    
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required. Please provide X-API-Key header or Authorization Bearer token.'
      });
    }
    
    if (apiKey !== storedApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }
    
    next();
  });
}

module.exports = {
  apiKeyAuth,
  getApiKey
};
