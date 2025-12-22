// Centralized configuration management
// Loads from environment variables with sensible defaults

require('dotenv').config();

module.exports = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '1234', 10),
  
  // Database
  databasePath: process.env.DATABASE_PATH || require('path').join(__dirname, 'database.sqlite'),
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Application
  appName: process.env.APP_NAME || 'Manufacturing Process Production Authenticity',
  appVersion: process.env.APP_VERSION || '1.0.0',
  
  // Helper to check if production
  isProduction: () => process.env.NODE_ENV === 'production',
  isDevelopment: () => process.env.NODE_ENV === 'development',
};

