// Performance configuration for handling multiple concurrent users
// This file contains optimizations for database and server performance

module.exports = {
  // Database optimizations
  database: {
    // Connection pool settings (SQLite doesn't support traditional pooling,
    // but we can optimize the connection)
    maxConnections: 10,
    timeout: 30000,
    
    // WAL mode settings (already set in index.js)
    walMode: true,
    synchronous: 'NORMAL', // Balance between safety and performance
    cacheSize: 10000, // 10MB cache
    
    // Query optimizations
    enableForeignKeys: true,
    busyTimeout: 5000 // Wait up to 5 seconds if database is locked
  },
  
  // Server optimizations
  server: {
    // Request timeout
    requestTimeout: 60000, // 60 seconds
    
    // Keep-alive settings
    keepAliveTimeout: 65000,
    headersTimeout: 66000,
    
    // Body parser limits
    jsonLimit: '10mb',
    urlencodedLimit: '10mb',
    
    // CORS settings
    cors: {
      origin: '*', // In production, specify your domain
      credentials: true,
      maxAge: 86400 // 24 hours
    }
  },
  
  // Rate limiting (handled by Nginx, but can be added here too)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per windowMs
  },
  
  // PM2 cluster settings
  cluster: {
    instances: 'max', // Use all CPU cores
    execMode: 'cluster'
  }
};

