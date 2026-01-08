// Centralized configuration management
// Loads from environment variables with sensible defaults

require('dotenv').config();

module.exports = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '1234', 10),
  
  // Database - PostgreSQL
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'manufacturing_db',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'Admin123',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Connection pool max
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },
  
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

