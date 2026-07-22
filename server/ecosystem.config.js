/**
 * PM2 ecosystem — web (HTTP) + worker (cron/scheduler).
 * Web can scale; only the worker runs ENABLE_SCHEDULER=true jobs.
 * Worker sets ENABLE_HTTP=false so it does not bind the app PORT.
 */
const path = require('path');

const cwd = __dirname;
const common = {
  script: 'index.js',
  cwd,
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '512M',
  kill_timeout: 12000,
  listen_timeout: 10000,
  wait_ready: false,
  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'manufacturing-app',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        ENABLE_SCHEDULER: 'false',
        ENABLE_HTTP: 'true',
      },
      error_file: path.join(cwd, 'logs/web-error.log'),
      out_file: path.join(cwd, 'logs/web-out.log'),
    },
    {
      ...common,
      name: 'manufacturing-app-worker',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ENABLE_SCHEDULER: 'true',
        ENABLE_HTTP: 'false',
      },
      error_file: path.join(cwd, 'logs/worker-error.log'),
      out_file: path.join(cwd, 'logs/worker-out.log'),
    },
    {
      ...common,
      name: 'manufacturing-app-staging',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 3467,
        ENABLE_SCHEDULER: 'false',
        ENABLE_HTTP: 'true',
      },
      error_file: path.join(cwd, 'logs/staging-web-error.log'),
      out_file: path.join(cwd, 'logs/staging-web-out.log'),
    },
    {
      ...common,
      name: 'manufacturing-app-staging-worker',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        ENABLE_SCHEDULER: 'true',
        ENABLE_HTTP: 'false',
      },
      error_file: path.join(cwd, 'logs/staging-worker-error.log'),
      out_file: path.join(cwd, 'logs/staging-worker-out.log'),
    },
  ],
};
