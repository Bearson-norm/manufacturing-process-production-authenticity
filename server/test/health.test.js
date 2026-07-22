const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-pass';
process.env.PRODUCTION_PASSWORD = process.env.PRODUCTION_PASSWORD || 'test-prod-pass';

function get(server, path) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get({ hostname: '127.0.0.1', port, path }, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
        });
      })
      .on('error', reject);
  });
}

describe('GET /health', () => {
  it('returns healthy when SELECT 1 succeeds', async () => {
    const database = require('../database');
    const originalGet = database.db.get.bind(database.db);
    database.db.get = (sql, params, cb) => {
      if (typeof params === 'function') {
        cb = params;
      }
      cb(null, { '?column?': 1 });
    };

    delete require.cache[require.resolve('../app')];
    const app = require('../app');
    const server = app.listen(0);
    try {
      const res = await get(server, '/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'healthy');
      assert.equal(res.body.database, 'connected');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      database.db.get = originalGet;
      await database.db.close().catch(() => {});
    }
  });
});
