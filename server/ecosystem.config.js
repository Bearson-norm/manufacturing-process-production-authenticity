// PM2 Ecosystem configuration for cluster mode
// This allows the app to handle multiple concurrent requests

module.exports = {
  apps: [
    {
      name: 'manufacturing-app',
      script: './index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode
      env: {
        NODE_ENV: 'production',
        PORT: 1234
      },
      // Auto restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Performance monitoring
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'manufacturing-app-staging',
      script: './index.js',
      instances: 1, // Single instance for staging
      exec_mode: 'fork', // Fork mode for staging
      env: {
        NODE_ENV: 'staging',
        PORT: 5678
      },
      // Auto restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Logging
      error_file: './logs/staging-err.log',
      out_file: './logs/staging-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Performance monitoring
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    },
    {
      name: 'manufacturing-app-kmi',
      script: './index.js',
      instances: 1, // Single instance for KMI
      exec_mode: 'fork', // Fork mode for KMI
      env: {
        NODE_ENV: 'kmi',
        PORT: 3366
      },
      // Auto restart on crash
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // Logging
      error_file: './logs/kmi-err.log',
      out_file: './logs/kmi-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Performance monitoring
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
